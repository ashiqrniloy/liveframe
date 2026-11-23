import { DEFAULT_MAX_ERRORS, type LiveframeError, type Result } from "../../errors.ts";
import type { WidgetPackage } from "../../formats/package.ts";
import type { UiTree } from "../../formats/tree.ts";
import { errorMessage, MAX_WIDGET_DEBUG_LENGTH, queue, widgetThrown, withoutDebug } from "../../internal.ts";
import { compiledValidator } from "../../runner-kit/cache.ts";
import { isRecord } from "../../schema.ts";
import { verifyPackageHash } from "../cache.ts";
import { collectLibraries } from "../dependencies.ts";
import type { Runner, RunnerOptions } from "../runner.ts";
import type { WorkerMessage } from "./protocol.ts";

export type WorkerRunnerDefaults = {
  timeoutMs?: number;
  maxPackages?: number;
  startTimeoutMs?: number;
};

type Pending = {
  readonly id: number;
  readonly debug: boolean;
  posted: boolean;
  clearTimer?: (() => void) | undefined;
  onReady?: (() => void) | undefined;
  readonly validate: (result: unknown) => Result<UiTree>;
  readonly resolve: (result: Result<UiTree>) => void;
};

const ERROR_FIELDS = new Set(["kind", "pointer", "message", "expected", "nodeId", "debug"]);

/** The envelope of a worker answer; a tree's `value` is checked by the validator, not here. */
function isResult(result: unknown): result is Result<unknown> {
  if (!isRecord(result)) return false;
  return result.ok === true ? "value" in result : result.ok === false && isErrorList(result.errors);
}

/** A validator's own bound marker comes after `maxErrors` errors, so one more is legitimate. */
function isErrorList(errors: unknown): boolean {
  return (
    Array.isArray(errors) &&
    errors.length > 0 &&
    errors.length <= DEFAULT_MAX_ERRORS + 1 &&
    errors.every(
      (error) =>
        isRecord(error) &&
        Object.keys(error).every((key) => ERROR_FIELDS.has(key)) &&
        typeof error.kind === "string" &&
        typeof error.pointer === "string" &&
        typeof error.message === "string" &&
        (error.expected === undefined || typeof error.expected === "string") &&
        (error.nodeId === undefined || typeof error.nodeId === "string") &&
        (error.debug === undefined ||
          (typeof error.debug === "string" && error.debug.length <= MAX_WIDGET_DEBUG_LENGTH)),
    )
  );
}

/** The repository's source sits beside `entry.ts`; the published build beside `entry.js`. */
const entry = new URL(`./entry${import.meta.url.endsWith(".ts") ? ".ts" : ".js"}`, import.meta.url);

/** Internal implementation of `workerRunner`, accepting a custom `spawn` for handshake tests. */
export function createWorkerRunner(
  defaults: WorkerRunnerDefaults = {},
  spawn: (url: URL) => Worker = (url) => new Worker(url),
): Runner & { close(): void } {
  const maxPackages = defaults.maxPackages ?? 64;
  const startTimeoutMs = defaults.startTimeoutMs ?? 5000;
  let worker: Worker | undefined;
  let workerReady = false;
  let configuration: Pick<RunnerOptions, "catalog" | "capabilities"> | undefined;
  /** Distinct hashes loaded into the current worker; modules cannot be unloaded. */
  let loaded = new Set<string>();
  let pending: Pending | undefined;
  let nextId = 1;
  const serial = queue();
  let closed = false;

  function settle(result: Result<UiTree>): void {
    const active = pending;
    pending = undefined;
    active?.clearTimer?.();
    active?.resolve(result);
  }

  function recycle(): void {
    pending?.clearTimer?.();
    if (pending) pending.clearTimer = undefined;
    worker?.terminate();
    worker = undefined;
    workerReady = false;
    configuration = undefined;
    loaded = new Set();
  }

  function stop(kind: LiveframeError["kind"], message: string, expected?: string): void {
    recycle();
    settle({ ok: false, errors: [{ kind, pointer: "", message, ...(expected === undefined ? {} : { expected }) }] });
  }

  /** Why this render cannot start, if it cannot. */
  function refusal(pkg: WidgetPackage, libraries: Result<readonly WidgetPackage[]>): Result<never> | undefined {
    if (closed) return { ok: false, errors: [{ kind: "render-failed", pointer: "", message: "Runner closed" }] };
    if (!verifyPackageHash(pkg))
      return {
        ok: false,
        errors: [{ kind: "hash-mismatch", pointer: "/hash", message: "Package content does not match its hash" }],
      };
    return libraries.ok ? undefined : libraries;
  }

  /** A worker result is only accepted after the host re-validates its tree or shape-checks its errors. */
  function validateResult(result: unknown, pkg: WidgetPackage, options: RunnerOptions): Result<UiTree> {
    if (!isResult(result))
      return {
        ok: false,
        errors: [{ kind: "render-failed", pointer: "", message: "Worker returned a malformed result" }],
      };
    if (!result.ok) return options.debug === true ? result : { ok: false, errors: withoutDebug(result.errors) };
    try {
      const validator = compiledValidator({ ...options, manifest: pkg.manifest }, pkg.hash);
      return validator.validateTree(result.value, options.limits ? { limits: options.limits } : undefined);
    } catch (error) {
      return { ok: false, errors: [{ kind: "render-failed", pointer: "", message: errorMessage(error) }] };
    }
  }

  function handleReady(): void {
    // Ignore duplicate ready messages once the worker has started.
    if (workerReady) return;
    workerReady = true;
    const active = pending;
    if (!active) return;
    active.clearTimer?.();
    active.clearTimer = undefined;
    active.onReady?.();
  }

  function handleResult(id: unknown, result: unknown): void {
    const active = pending;
    if (!active?.posted || id !== active.id) {
      stop("render-failed", "Worker answered a render it was not asked for", "one result for the pending render id");
      return;
    }
    const validated = active.validate(result);
    // A crashed realm, a malformed result or a tree the host rejects is not reused.
    if (
      !validated.ok &&
      ((isRecord(result) && result.ok === true) || validated.errors.some((error) => error.kind === "render-failed"))
    )
      recycle();
    settle(validated);
  }

  /** Wires a fresh worker: ready handshake, results by id, crashes, and exits. */
  function attach(current: Worker): void {
    current.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
      if (worker !== current || !isRecord(data)) return;
      if (data.type === "ready") handleReady();
      else if (data.type === "result") handleResult(data.id, data.result);
    };
    current.onerror = (event) => {
      event.preventDefault();
      if (worker !== current) return;
      const debug = pending?.debug;
      const error = widgetThrown(event.error ?? new Error(debug ? event.message : ""), debug);
      recycle();
      settle({ ok: false, errors: [error] });
    };
    current.addEventListener("close", () => {
      if (worker === current) stop("render-failed", "Worker exited");
    });
  }

  /** Starts or reuses the worker, waits for ready if fresh, sends configuration and render, and times only the render. */
  function send(
    pkg: WidgetPackage,
    libraries: readonly WidgetPackage[],
    inputs: Parameters<Runner["render"]>[1],
    options: RunnerOptions,
    id: number,
  ): void {
    // Only code is loaded into the worker, and modules cannot be unloaded; a template is data.
    // A library is a module like any other, so it counts toward the bound.
    if (pkg.template === undefined) {
      const hashes = [pkg, ...libraries].map((item) => item.hash);
      if (
        hashes.some((hash) => !loaded.has(hash)) &&
        loaded.size + hashes.filter((hash) => !loaded.has(hash)).length > maxPackages
      )
        recycle();
      for (const hash of hashes) loaded.add(hash);
    }

    const timeoutMs = options.timeoutMs ?? defaults.timeoutMs ?? 100;
    const { catalog, capabilities, ...renderOptions } = { ...options, libraries };

    const postRender = (current: Worker): void => {
      const active = pending;
      if (closed || worker !== current || !active || active.id !== id) return;
      try {
        active.posted = true;
        const timer = setTimeout(() => stop("limit-exceeded", `Render exceeded ${timeoutMs} ms`), timeoutMs);
        active.clearTimer = () => clearTimeout(timer);
        if (configuration?.catalog !== catalog || configuration?.capabilities !== capabilities) {
          current.postMessage({ type: "configure", catalog, capabilities } satisfies WorkerMessage);
          configuration = { catalog, capabilities };
        }
        current.postMessage({ type: "render", id, pkg, inputs, options: renderOptions } satisfies WorkerMessage);
      } catch (error) {
        stop("render-failed", errorMessage(error));
      }
    };

    if (worker && workerReady) {
      postRender(worker);
      return;
    }

    const current = spawn(entry);
    worker = current;
    workerReady = false;
    const active = pending;
    if (active) {
      const startTimer = setTimeout(() => {
        if (worker === current && !workerReady) stop("render-failed", "Worker did not start");
      }, startTimeoutMs);
      active.clearTimer = () => clearTimeout(startTimer);
      active.onReady = () => postRender(current);
    }
    attach(current);
  }

  return {
    render(pkg, inputs, options) {
      const result = serial(
        () =>
          new Promise<Result<UiTree>>((resolve) => {
            // Libraries are matched to the pins and re-hashed on this side; the worker only renders.
            const libraries = collectLibraries(pkg, options.libraries);
            const refused = refusal(pkg, libraries);
            if (refused) {
              resolve(refused);
              return;
            }
            const id = nextId++;
            const timeoutMs = options.timeoutMs ?? defaults.timeoutMs ?? 100;
            pending = {
              id,
              posted: false,
              debug: options.debug === true,
              resolve,
              validate: (result) => validateResult(result, pkg, options),
            };
            try {
              send(pkg, libraries.ok ? libraries.value : [], inputs, { ...options, timeoutMs }, id);
            } catch (error) {
              stop("render-failed", errorMessage(error));
            }
          }),
      );
      return result;
    },
    close() {
      closed = true;
      stop("render-failed", "Runner closed");
    },
  };
}
