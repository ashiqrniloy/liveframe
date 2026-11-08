import { fileURLToPath } from "node:url";
import type { Result, UiTree } from "@arnilo/liveframe";
import type { WidgetPackage } from "@arnilo/liveframe/pack";
import type { Runner, RunnerOptions } from "@arnilo/liveframe/preview";
import { renderTemplatePackage } from "@arnilo/liveframe/runner-kit";
import { hashMatches, prepare } from "./load.ts";
import type { ChildMessage, Limits, RenderRequest } from "./protocol.ts";
import { accept, failed, limitFailure } from "./result.ts";

export type QuickJsRunnerOptions = {
  /** QuickJS's heap limit per runtime (default 32 MiB). */
  readonly memoryBytes?: number;
  /**
   * QuickJS's stack limit (default 256 KiB). QuickJS recurses on the host stack: at 1 MiB some call
   * shapes overflow it first, and the engine then aborts (decision 2026-11-08-2310).
   */
  readonly stackBytes?: number;
  /** The default per-render limit in ms (default 250); a render's `options.timeoutMs` overrides it. */
  readonly timeoutMs?: number;
  /**
   * `"none"` (default): every render gets a new runtime in a new wasm instance. `"package"`: a runtime
   * per package hash is kept between renders, so module state survives. Faster; for code you trust
   * to behave but have not tested, not for hostile code.
   */
  readonly reuse?: "none" | "package";
  /** Runtimes kept with `reuse: "package"`, least recently used evicted first (default 16). */
  readonly maxRuntimes?: number;
};

export type QuickJsRunner = Runner & { close(): void };

/** The hard kill comes this long after the soft deadline: QuickJS cannot interrupt one native call. */
const KILL_GRACE_MS = 100;
const childEntry = fileURLToPath(new URL(`./child${import.meta.url.endsWith(".ts") ? ".ts" : ".js"}`, import.meta.url));

type Child = { readonly proc: Bun.Subprocess; readonly ready: Promise<void> };
type Answer = { readonly json: string } | { readonly error: string } | { readonly killed: true };

function positive(name: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer`);
  return value;
}

/**
 * An isolated runner: widget code runs in QuickJS (WebAssembly) inside a Bun child process this
 * runner owns. The realm holds no host API, has a heap and stack limit and a soft deadline; a render
 * that outlives the soft deadline plus 100 ms (one native call QuickJS cannot interrupt) is ended by
 * killing the child, which the next render replaces. The host verifies the package hash and the
 * library pins before anything is loaded, and validates every tree the child returns (law 2).
 * Template packages run no author code and render on the host. `close()` kills the child.
 *
 * The child runs with the host's privileges and an empty environment; only QuickJS stands between
 * widget code and the file system and network. Wrap it in an OS sandbox for defence in depth.
 */
export async function quickjsRunner(options: QuickJsRunnerOptions = {}): Promise<QuickJsRunner> {
  const memoryBytes = positive("memoryBytes", options.memoryBytes ?? 32 << 20);
  const stackBytes = positive("stackBytes", options.stackBytes ?? 256 << 10);
  const defaultTimeoutMs = positive("timeoutMs", options.timeoutMs ?? 250);
  const maxRuntimes = positive("maxRuntimes", options.maxRuntimes ?? 16);
  const reuse = options.reuse ?? "none";

  let current: Child | undefined;
  let pending: { readonly id: number; readonly settle: (answer: Answer) => void } | undefined;
  let nextId = 1;
  let closed = false;
  let chain: Promise<unknown> = Promise.resolve();

  function settle(answer: Answer): void {
    const active = pending;
    pending = undefined;
    active?.settle(answer);
  }

  /** Kills the child and forgets it; the next render starts a new one. */
  function retire(child: Child): void {
    if (current === child) current = undefined;
    child.proc.kill("SIGKILL");
  }

  function start(): Child {
    let ready!: () => void;
    let refuse!: (error: Error) => void;
    const started = new Promise<void>((resolve, reject) => {
      ready = resolve;
      refuse = reject;
    });
    const proc: Bun.Subprocess = Bun.spawn([process.execPath, childEntry, String(maxRuntimes)], {
      env: {},
      stdio: ["ignore", "ignore", "ignore"],
      serialization: "json",
      ipc(message) {
        const reply = message as ChildMessage;
        if (current?.proc !== proc) return;
        if (reply.type === "ready") ready();
        else if (reply.type === "result" && pending?.id === reply.id)
          settle("json" in reply ? { json: reply.json } : { error: reply.error });
        else if (reply.type === "result") {
          // An answer for a render nobody asked for: the child is not trusted any more.
          retire(child);
          settle({ error: "The sandbox answered a render it was not asked for" });
        }
      },
      onExit(_, code) {
        if (current?.proc !== proc) return;
        current = undefined;
        refuse(new Error(`The QuickJS child process exited before it was ready (code ${code})`));
        settle({ error: `The QuickJS child process exited (code ${code})` });
      },
    });
    // The child never keeps the host alive; its death with the host is `disconnect` in the child
    // and, when the child is stuck in a native call, this hook.
    proc.unref();
    const child: Child = { proc, ready: started };
    current = child;
    return child;
  }

  async function exchange(
    job: Omit<RenderRequest, "type" | "id" | "limits">,
    limits: Limits,
  ): Promise<Answer | { readonly refused: string }> {
    let child = current ?? start();
    try {
      await child.ready;
    } catch (error) {
      return { refused: error instanceof Error ? error.message : "The QuickJS child process did not start" };
    }
    // `closed` may have been set while the child started.
    if (closed) return { refused: "Runner closed" };
    child = current ?? child;
    const id = nextId++;
    return new Promise<Answer>((resolve) => {
      const hard = setTimeout(() => {
        retire(child);
        settle({ killed: true });
      }, limits.timeoutMs + KILL_GRACE_MS);
      pending = {
        id,
        settle(answer) {
          clearTimeout(hard);
          resolve(answer);
        },
      };
      child.proc.send({ type: "render", id, ...job, limits } satisfies RenderRequest);
    });
  }

  const killAtExit = () => current?.proc.kill("SIGKILL");
  process.once("exit", killAtExit);
  const first = start();
  try {
    await first.ready;
  } catch (error) {
    process.off("exit", killAtExit);
    throw error;
  }

  async function renderCode(
    pkg: WidgetPackage,
    inputs: Parameters<Runner["render"]>[1],
    runnerOptions: RunnerOptions,
  ): Promise<Result<UiTree>> {
    const linked = prepare(pkg, runnerOptions.libraries);
    if (!linked.ok) return linked;
    const timeoutMs = runnerOptions.timeoutMs ?? defaultTimeoutMs;
    const { catalog, capabilities, surfaceId, revision, limits } = runnerOptions;
    let request: string;
    try {
      request = JSON.stringify({
        inputs,
        options: { catalog, capabilities, manifest: pkg.manifest, surfaceId, revision, ...(limits ? { limits } : {}) },
      });
    } catch {
      return failed("render-failed", "The render inputs must be JSON");
    }
    const answer = await exchange(
      {
        code: linked.value.code,
        libraries: linked.value.libraries,
        request,
        ...(reuse === "package" ? { key: pkg.hash } : {}),
      },
      { memoryBytes, stackBytes, timeoutMs },
    );
    if ("refused" in answer) return failed("render-failed", answer.refused);
    if ("killed" in answer)
      return failed("limit-exceeded", `Render stopped: timeout (killed after ${timeoutMs + KILL_GRACE_MS} ms)`);
    if ("error" in answer) return limitFailure(answer.error) ?? failed("render-failed", answer.error.slice(0, 500));
    return accept(
      answer.json,
      { catalog, capabilities, manifest: pkg.manifest },
      pkg.hash,
      limits ? { limits } : undefined,
    );
  }

  return {
    render(pkg, inputs, runnerOptions) {
      if (closed) return Promise.resolve(failed("render-failed", "Runner closed"));
      if (!hashMatches(pkg))
        return Promise.resolve(failed("hash-mismatch", "Package content does not match its hash", "/hash"));
      if (pkg.template !== undefined)
        return Promise.resolve(renderTemplate(pkg, pkg.template, inputs, runnerOptions, defaultTimeoutMs));
      const run = chain.then(() =>
        closed ? failed("render-failed", "Runner closed") : renderCode(pkg, inputs, runnerOptions),
      );
      chain = run.catch(() => undefined);
      return run;
    },
    close() {
      closed = true;
      process.off("exit", killAtExit);
      if (current) retire(current);
      settle({ error: "Runner closed" });
    },
  };
}

/** A template is data the library evaluates in bounded steps: no author code runs, so no sandbox is needed. */
function renderTemplate(
  pkg: WidgetPackage,
  template: NonNullable<WidgetPackage["template"]>,
  inputs: Parameters<Runner["render"]>[1],
  options: RunnerOptions,
  defaultTimeoutMs: number,
): Result<UiTree> {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const start = Date.now();
  const result = renderTemplatePackage(template, inputs, { ...options, manifest: pkg.manifest });
  return Date.now() - start > timeoutMs ? failed("limit-exceeded", `Render exceeded ${timeoutMs} ms`) : result;
}
