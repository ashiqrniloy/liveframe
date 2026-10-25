import type { Result } from "../errors.ts";
import type { WidgetPackage } from "../formats/package.ts";
import type { UiTree } from "../formats/tree.ts";
import { render } from "../sdk/render.ts";
import type { WidgetProps } from "../sdk/types.ts";
import { compiledValidator, verifyPackageHash } from "./cache.ts";
import { type LoadedModule, loadModule } from "./load.ts";
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

/**
 * For backend tests and trusted code; not an isolation boundary.
 * A render that returns after timeoutMs (default 100) is reported as
 * limit-exceeded, and module evaluation is raced against it, so a module that
 * never settles (a hand-built package whose top-level await stays pending) also
 * ends there. A synchronous loop still cannot be interrupted. The package's hash
 * is checked once per object, and a mismatch is hash-mismatch with nothing loaded.
 * Loaded modules cannot be unloaded, so its memory grows with every distinct
 * package it renders; a host with unbounded drafts should use workerRunner(),
 * which recycles its worker.
 */
export function inProcessRunner(): Runner {
  return {
    async render(pkg, inputs, options) {
      if (!verifyPackageHash(pkg))
        return {
          ok: false,
          errors: [{ kind: "hash-mismatch", pointer: "/hash", message: "Package content does not match its hash" }],
        };
      return renderPackage(pkg, inputs, options);
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
    const widget = module.default;
    if (typeof widget !== "function") throw new Error("Widget module must have a function default export");
    const validator = compiledValidator({ ...options, manifest: pkg.manifest }, pkg.hash);
    result = render((props) => widget(props), inputs, { ...options, validator });
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
