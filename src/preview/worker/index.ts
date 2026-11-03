import { DEFAULT_MAX_ERRORS, type LiveframeError, type Result } from "../../errors.ts";
import type { WidgetPackage } from "../../formats/package.ts";
import type { UiTree } from "../../formats/tree.ts";
import { compiledValidator } from "../../runner-kit/cache.ts";
import { isRecord } from "../../schema.ts";
import { verifyPackageHash } from "../cache.ts";
import type { Runner, RunnerOptions } from "../runner.ts";
import type { WorkerMessage } from "./protocol.ts";

type Pending = {
  readonly id: number;
  readonly validate: (result: unknown) => Result<UiTree>;
  readonly resolve: (result: Result<UiTree>) => void;
};

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const ERROR_FIELDS = new Set(["kind", "pointer", "message", "expected", "nodeId"]);

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
        (error.nodeId === undefined || typeof error.nodeId === "string"),
    )
  );
}

/** The repository's source sits beside `entry.ts`; the published build beside `entry.js`. */
const entry = new URL(`./entry${import.meta.url.endsWith(".ts") ? ".ts" : ".js"}`, import.meta.url);

/**
 * Backend runner that bounds time and crashes, not what code can reach.
 * Not an isolation boundary. Verify packages before rendering them.
 * Requests run serially; timeoutMs defaults to 100 and render options override it.
 * Each render carries an id, and only that id's result is accepted. Every tree is
 * re-validated on the host, and a worker that answers out of turn or with a tree
 * the host rejects is terminated. A package's hash is checked once per object
 * before anything is loaded, and the worker restarts after maxPackages (64)
 * distinct hashes, since loaded modules cannot be unloaded. One worker still
 * serves every package, so hostile code needs the app's own isolated runner.
 * close() stops active work and returns render-failed for queued and future renders.
 */
export function workerRunner(defaults: { timeoutMs?: number; maxPackages?: number } = {}): Runner & { close(): void } {
  const maxPackages = defaults.maxPackages ?? 64;
  let worker: Worker | undefined;
  let configuration: Pick<RunnerOptions, "catalog" | "capabilities"> | undefined;
  /** Distinct hashes loaded into the current worker; modules cannot be unloaded. */
  let loaded = new Set<string>();
  let pending: Pending | undefined;
  let nextId = 1;
  let queue = Promise.resolve();
  let closed = false;

  function settle(result: Result<UiTree>): void {
    const active = pending;
    pending = undefined;
    active?.resolve(result);
  }

  function recycle(): void {
    worker?.terminate();
    worker = undefined;
    configuration = undefined;
    loaded = new Set();
  }

  function stop(kind: LiveframeError["kind"], message: string, expected?: string): void {
    recycle();
    settle({ ok: false, errors: [{ kind, pointer: "", message, ...(expected === undefined ? {} : { expected }) }] });
  }

  /** Why this render cannot start, if it cannot. */
  function refusal(pkg: WidgetPackage): Result<never> | undefined {
    if (closed) return { ok: false, errors: [{ kind: "render-failed", pointer: "", message: "Runner closed" }] };
    if (verifyPackageHash(pkg)) return undefined;
    return {
      ok: false,
      errors: [{ kind: "hash-mismatch", pointer: "/hash", message: "Package content does not match its hash" }],
    };
  }

  /** A worker result is only accepted after the host re-validates its tree or shape-checks its errors. */
  function validateResult(result: unknown, pkg: WidgetPackage, options: RunnerOptions): Result<UiTree> {
    if (!isResult(result))
      return {
        ok: false,
        errors: [{ kind: "render-failed", pointer: "", message: "Worker returned a malformed result" }],
      };
    if (!result.ok) return result;
    try {
      const validator = compiledValidator({ ...options, manifest: pkg.manifest }, pkg.hash);
      return validator.validateTree(result.value, options.limits ? { limits: options.limits } : undefined);
    } catch (error) {
      return { ok: false, errors: [{ kind: "render-failed", pointer: "", message: reason(error) }] };
    }
  }

  /** Wires a fresh worker: results by id, crashes, and exits all recycle it. */
  function attach(current: Worker): void {
    current.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
      if (worker !== current || data.type !== "result") return;
      const active = pending;
      if (!active || data.id !== active.id) {
        stop("render-failed", "Worker answered a render it was not asked for", "one result for the pending render id");
        return;
      }
      const validated = active.validate(data.result);
      // A crashed realm, a malformed result or a tree the host rejects is not reused.
      if (
        !validated.ok &&
        ((isRecord(data.result) && data.result.ok === true) ||
          validated.errors.some((error) => error.kind === "render-failed"))
      )
        recycle();
      settle(validated);
    };
    current.onerror = (event) => {
      event.preventDefault();
      if (worker === current) stop("render-failed", event.message || "Worker error");
    };
    current.addEventListener("close", () => {
      if (worker === current) stop("render-failed", "Worker exited");
    });
  }

  /** Starts or reuses the worker, sends it the configuration it lacks, then the render. */
  function send(pkg: WidgetPackage, inputs: Parameters<Runner["render"]>[1], options: RunnerOptions, id: number): void {
    if (!loaded.has(pkg.hash) && loaded.size >= maxPackages) recycle();
    loaded.add(pkg.hash);
    if (!worker) {
      const current = new Worker(entry);
      worker = current;
      attach(current);
    }
    const { catalog, capabilities, ...renderOptions } = options;
    if (configuration?.catalog !== catalog || configuration?.capabilities !== capabilities) {
      worker.postMessage({ type: "configure", catalog, capabilities } satisfies WorkerMessage);
      configuration = { catalog, capabilities };
    }
    worker.postMessage({ type: "render", id, pkg, inputs, options: renderOptions } satisfies WorkerMessage);
  }

  return {
    render(pkg, inputs, options) {
      const result = queue.then(
        () =>
          new Promise<Result<UiTree>>((resolve) => {
            const refused = refusal(pkg);
            if (refused) {
              resolve(refused);
              return;
            }
            const id = nextId++;
            const timeoutMs = options.timeoutMs ?? defaults.timeoutMs ?? 100;
            const timer = setTimeout(() => stop("limit-exceeded", `Render exceeded ${timeoutMs} ms`), timeoutMs);
            pending = {
              id,
              resolve: (result) => {
                clearTimeout(timer);
                resolve(result);
              },
              validate: (result) => validateResult(result, pkg, options),
            };
            try {
              send(pkg, inputs, { ...options, timeoutMs }, id);
            } catch (error) {
              stop("render-failed", reason(error));
            }
          }),
      );
      queue = result.then(() => {});
      return result;
    },
    close() {
      closed = true;
      stop("render-failed", "Runner closed");
    },
  };
}
