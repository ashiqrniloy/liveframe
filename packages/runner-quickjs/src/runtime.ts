import releaseSyncModule from "@jitl/quickjs-wasmfile-release-sync";
import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
  type QuickJSContext,
  type QuickJSRuntime,
  shouldInterruptAfterDeadline,
} from "quickjs-emscripten-core";
import type { Limits } from "./protocol.ts";

/** The package types describe its CommonJS build; Bun loads the ESM build, whose default export is the variant. */
const releaseSync = releaseSyncModule as unknown as Extract<
  Parameters<typeof newQuickJSWASMModuleFromVariant>[0],
  { type: "sync" }
>;

/** What one render needs inside the sandbox; the host linked `code` and the libraries already. */
export type Job = {
  readonly code: string;
  readonly libraries: Readonly<Record<string, string>>;
  readonly request: string;
  readonly limits: Limits;
  /** Keep the runtime under this key for the next render (`reuse: "package"`). */
  readonly key?: string;
};

export type Outcome = { readonly json: string } | { readonly error: string };

/**
 * The entry module: it holds the render function in the sandbox's own global. It is the only code that
 * touches the request, as one JSON string in and one out; nothing of the host is exposed to the realm.
 */
const entry = `import { renderModule } from "liveframe:kit";
import widget from "liveframe:pkg";
globalThis.__render = (text) => {
  const request = JSON.parse(text);
  return JSON.stringify(renderModule(widget, request.inputs, request.options));
};`;

/** One QuickJS runtime in its own wasm instance, with the package loaded. */
type Sandbox = {
  readonly runtime: QuickJSRuntime;
  readonly context: QuickJSContext;
};

export type Engine = {
  render(job: Job): Promise<Outcome>;
  /** Runtimes kept for `reuse: "package"`. */
  kept(): number;
  /** Instances dropped because the engine threw to the host; a leaked handle shows up here. */
  tainted(): number;
  close(): void;
};

/**
 * The QuickJS side of the runner. `wasm` is compiled once and shared; every sandbox gets its own
 * instance of it, so no heap is shared between renders. `kit` is the runner-kit bundle's text.
 *
 * Rules (decision 2026-11-08-2310): `executePendingJobs()` is never called, so a hostile microtask
 * loop never runs and a package whose top-level `await` does not settle is a failed render; a
 * sandbox whose engine throws to the host, `dispose()` included, is dropped and never reused.
 */
export function createEngine(wasm: WebAssembly.Module, kit: string, options: { maxRuntimes?: number } = {}): Engine {
  const variant = newVariant(releaseSync, { wasmModule: wasm });
  const maxRuntimes = options.maxRuntimes ?? 16;
  /** Kept sandboxes, least recently used first. */
  const kept = new Map<string, Sandbox>();
  let taintedCount = 0;

  function drop(sandbox: Sandbox): void {
    try {
      sandbox.context.dispose();
      sandbox.runtime.dispose();
    } catch {
      taintedCount++;
    }
  }

  async function open(job: Job): Promise<Sandbox | string> {
    const quickjs = await newQuickJSWASMModuleFromVariant(variant);
    const runtime = quickjs.newRuntime();
    runtime.setMemoryLimit(job.limits.memoryBytes);
    runtime.setMaxStackSize(job.limits.stackBytes);
    const sources: Record<string, string> = { ...job.libraries, "liveframe:kit": kit, "liveframe:pkg": job.code };
    runtime.setModuleLoader((name) => sources[name] ?? { error: new Error("module not found") });
    const context = runtime.newContext();
    const sandbox = { runtime, context };
    try {
      runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + job.limits.timeoutMs));
      const loaded = context.evalCode(entry, "entry.js", { type: "module" });
      if (loaded.error) {
        const message = describe(context, loaded.error);
        drop(sandbox);
        return message;
      }
      loaded.value.dispose();
      const render = context.getProp(context.global, "__render");
      const ready = context.typeof(render) === "function";
      render.dispose();
      if (!ready) {
        drop(sandbox);
        return "The package did not finish loading: top-level await is not supported";
      }
      return sandbox;
    } catch (error) {
      taintedCount++;
      return `QuickJS failed: ${describeHost(error)}`;
    }
  }

  function call(sandbox: Sandbox, job: Job): Outcome {
    const { runtime, context } = sandbox;
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + job.limits.timeoutMs));
    const render = context.getProp(context.global, "__render");
    const text = context.newString(job.request);
    const result = context.callFunction(render, context.undefined, text);
    text.dispose();
    render.dispose();
    if (result.error) return { error: describe(context, result.error) };
    const value = result.value;
    const json = context.typeof(value) === "string" ? context.getString(value) : undefined;
    value.dispose();
    return json === undefined ? { error: "The render function did not return a string" } : { json };
  }

  return {
    async render(job) {
      let sandbox = job.key === undefined ? undefined : kept.get(job.key);
      if (sandbox && job.key !== undefined) {
        kept.delete(job.key);
        kept.set(job.key, sandbox);
      }
      if (!sandbox) {
        const opened = await open(job);
        if (typeof opened === "string") return { error: opened };
        sandbox = opened;
        if (job.key !== undefined) {
          kept.set(job.key, sandbox);
          const oldest = kept.entries().next();
          if (kept.size > maxRuntimes && !oldest.done) {
            kept.delete(oldest.value[0]);
            drop(oldest.value[1]);
          }
        }
      }
      let outcome: Outcome;
      try {
        outcome = call(sandbox, job);
      } catch (error) {
        taintedCount++;
        outcome = { error: `QuickJS failed: ${describeHost(error)}` };
        if (job.key !== undefined) kept.delete(job.key);
        // The instance threw to the host: it is not disposed again and never reused.
        return outcome;
      }
      // A kept runtime is only reused after a clean render: a stopped or failed one may hold half-built state.
      if ("error" in outcome || job.key === undefined) {
        if (job.key !== undefined) kept.delete(job.key);
        drop(sandbox);
      }
      return outcome;
    },
    kept: () => kept.size,
    tainted: () => taintedCount,
    close() {
      for (const sandbox of kept.values()) drop(sandbox);
      kept.clear();
    },
  };
}

/** The message of an error value the engine produced, disposing the handle. */
function describe(context: QuickJSContext, handle: Parameters<QuickJSContext["dump"]>[0]): string {
  const error = context.dump(handle) as { message?: unknown } | string | undefined;
  handle.dispose();
  const message = typeof error === "string" ? error : error?.message;
  return String(message ?? "Render failed").slice(0, 500);
}

function describeHost(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 200);
}
