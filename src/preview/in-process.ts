import type { Result } from "../errors.ts";
import type { WidgetPackage } from "../formats/package.ts";
import type { UiTree } from "../formats/tree.ts";
import { render } from "../sdk/render.ts";
import type { WidgetProps } from "../sdk/types.ts";
import { compiledValidator, verifyPackageHash } from "./cache.ts";
import { loadModule } from "./load.ts";
import type { Runner, RunnerOptions } from "./runner.ts";

/**
 * For backend tests and trusted code; not an isolation boundary.
 * Cannot interrupt a loop. A render that returns after timeoutMs (default 100)
 * is reported as limit-exceeded. The package's hash is checked once per object,
 * and a mismatch is hash-mismatch with nothing loaded.
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
  const start = Date.now();
  let result: Result<UiTree>;
  try {
    const module = await loadModule(pkg.code, pkg.hash);
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
  const timeoutMs = options.timeoutMs ?? 100;
  if (Date.now() - start > timeoutMs)
    return {
      ok: false,
      errors: [{ kind: "limit-exceeded", pointer: "", message: `Render exceeded ${timeoutMs} ms` }],
    };
  return result;
}
