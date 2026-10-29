import type { Result } from "../errors.ts";
import type { WidgetPackage } from "../formats/package.ts";
import type { UiTree } from "../formats/tree.ts";
import { renderWidget } from "../runner-kit/render.ts";
import type { WidgetProps } from "../sdk/types.ts";
import { verifyPackageHash } from "./cache.ts";
import { isModuleLoaded, type LoadedModule, loadedModuleCount, loadModule } from "./load.ts";
import type { Runner, RunnerOptions } from "./runner.ts";

const expired = Symbol("expired");

/** Module evaluation may never settle: a hand-built package can carry a pending top-level await. */
async function loadWithin(code: string, hash: string, timeoutMs: number): Promise<LoadedModule | typeof expired> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof expired>((resolve) => {
    timer = setTimeout(() => resolve(expired), timeoutMs);
  });
  try {
    return await Promise.race([loadModule(code, hash), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export interface InProcessRunner extends Runner {
  /** Modules loaded by this process's loader, which every in-process runner shares. */
  stats(): { readonly modules: number };
}

/**
 * For backend tests and trusted code; not an isolation boundary.
 * A render that returns after timeoutMs (default 100) is reported as
 * limit-exceeded, and module evaluation is raced against it, so a module that
 * never settles (a hand-built package whose top-level await stays pending) also
 * ends there. A synchronous loop still cannot be interrupted. The package's hash
 * is checked once per object, and a mismatch is hash-mismatch with nothing loaded.
 * Loaded modules cannot be unloaded, so the loader's process-wide module count is
 * bounded: a render of a package whose hash is not loaded yet is refused with
 * limit-exceeded once maxModules (default 256) modules are loaded, while loaded
 * hashes still render. stats() reports the count. A host with unbounded drafts
 * should use workerRunner(), which recycles its worker.
 */
export function inProcessRunner(options: { readonly maxModules?: number } = {}): InProcessRunner {
  const maxModules = options.maxModules ?? 256;
  return {
    stats: () => ({ modules: loadedModuleCount() }),
    async render(pkg, inputs, runnerOptions) {
      if (!verifyPackageHash(pkg))
        return {
          ok: false,
          errors: [{ kind: "hash-mismatch", pointer: "/hash", message: "Package content does not match its hash" }],
        };
      if (!isModuleLoaded(pkg.hash) && loadedModuleCount() >= maxModules)
        return {
          ok: false,
          errors: [
            {
              kind: "limit-exceeded",
              pointer: "",
              message: `The in-process runner has loaded ${maxModules} modules; use workerRunner() or raise maxModules`,
            },
          ],
        };
      return renderPackage(pkg, inputs, runnerOptions);
    },
  };
}

/**
 * @internal The render the worker entry runs. Its packages arrive by structured
 * clone, so the host's one-check-per-object cannot carry over: the host is the side
 * that verified them, and widget code cannot post into the worker's own queue.
 */
export async function renderPackage(
  pkg: WidgetPackage,
  inputs: WidgetProps,
  options: RunnerOptions,
): Promise<Result<UiTree>> {
  const timeoutMs = options.timeoutMs ?? 100;
  const start = Date.now();
  let result: Result<UiTree>;
  try {
    const module = await loadWithin(pkg.code, pkg.hash, timeoutMs);
    if (module === expired)
      return {
        ok: false,
        errors: [{ kind: "limit-exceeded", pointer: "", message: `Module evaluation exceeded ${timeoutMs} ms` }],
      };
    result = renderWidget(module.default, inputs, { ...options, manifest: pkg.manifest }, pkg.hash);
  } catch (error) {
    result = {
      ok: false,
      errors: [{ kind: "render-failed", pointer: "", message: error instanceof Error ? error.message : String(error) }],
    };
  }
  if (Date.now() - start > timeoutMs)
    return {
      ok: false,
      errors: [{ kind: "limit-exceeded", pointer: "", message: `Render exceeded ${timeoutMs} ms` }],
    };
  return result;
}
