import type { Result } from "../errors.ts";
import type { WidgetPackage } from "../formats/package.ts";
import type { UiTree } from "../formats/tree.ts";
import { renderTemplateWidget } from "../runner-kit/render.ts";
import type { WidgetInputs } from "../sdk/types.ts";
import { verifyPackageHash } from "./cache.ts";
import type { Runner, RunnerOptions } from "./runner.ts";

/**
 * @internal Renders a template package's document and reports a render that returns after
 * `timeoutMs` (default 100) as `limit-exceeded`, as the code runners do. The validator is cached
 * under the package hash, which the caller has verified.
 */
export function renderTemplateRun(
  template: NonNullable<WidgetPackage["template"]>,
  pkg: WidgetPackage,
  inputs: WidgetInputs,
  options: RunnerOptions,
): Result<UiTree> {
  const timeoutMs = options.timeoutMs ?? 100;
  const start = Date.now();
  const result = renderTemplateWidget(template, inputs, { ...options, manifest: pkg.manifest }, pkg.hash);
  if (Date.now() - start > timeoutMs)
    return {
      ok: false,
      errors: [{ kind: "limit-exceeded", pointer: "", message: `Render exceeded ${timeoutMs} ms` }],
    };
  return result;
}

/**
 * A runner for template packages. It loads and evaluates no author code: a template is data that
 * the library evaluates in bounded steps (spec §7.6), so this runner needs no isolation and is the
 * one to give authors you do not trust when templates are enough. A code package is refused with
 * `invalid-document` at `/code`. The package's hash is checked once per object, as in the other
 * reference runners, so still use `verifyPackage` or `loadPlacement` before rendering.
 */
export function templateRunner(): Runner {
  return {
    async render(pkg, inputs, options) {
      if (pkg.template === undefined)
        return {
          ok: false,
          errors: [
            {
              kind: "invalid-document",
              pointer: "/code",
              message: "templateRunner renders template packages only",
              expected: "a template package",
            },
          ],
        };
      if (!verifyPackageHash(pkg))
        return {
          ok: false,
          errors: [{ kind: "hash-mismatch", pointer: "/hash", message: "Package content does not match its hash" }],
        };
      return renderTemplateRun(pkg.template, pkg, inputs, options);
    },
  };
}
