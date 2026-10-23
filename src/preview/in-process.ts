import type { Result } from "../errors.ts";
import type { Capabilities } from "../formats/capabilities.ts";
import type { Catalog } from "../formats/catalog.ts";
import type { UiTree } from "../formats/tree.ts";
import { render } from "../sdk/render.ts";
import { type CompiledValidator, compileValidator } from "../validate/compile.ts";
import { loadModule } from "./load.ts";
import type { Runner } from "./runner.ts";

/**
 * For backend tests and trusted code; not an isolation boundary.
 * Cannot interrupt a loop. A render that returns after timeoutMs (default 100)
 * is reported as limit-exceeded. Verify packages before passing them here.
 */
export function inProcessRunner(): Runner {
  const validators = new WeakMap<Catalog, WeakMap<Capabilities, Map<string, CompiledValidator>>>();
  return {
    async render(pkg, inputs, options) {
      const start = Date.now();
      let result: Result<UiTree>;
      try {
        const module = await loadModule(pkg.code, pkg.hash);
        const widget = module.default;
        if (typeof widget !== "function") throw new Error("Widget module must have a function default export");
        let byCapabilities = validators.get(options.catalog);
        if (!byCapabilities) {
          byCapabilities = new WeakMap();
          validators.set(options.catalog, byCapabilities);
        }
        let byHash = byCapabilities.get(options.capabilities);
        if (!byHash) {
          byHash = new Map();
          byCapabilities.set(options.capabilities, byHash);
        }
        let validator = byHash.get(pkg.hash);
        if (!validator) {
          validator = compileValidator({ ...options, manifest: pkg.manifest });
          byHash.set(pkg.hash, validator);
        }
        result = render((props) => widget(props), inputs, { ...options, validator });
      } catch (error) {
        result = {
          ok: false,
          errors: [
            { kind: "render-failed", pointer: "", message: error instanceof Error ? error.message : String(error) },
          ],
        };
      }
      const timeoutMs = options.timeoutMs ?? 100;
      if (Date.now() - start > timeoutMs)
        return {
          ok: false,
          errors: [{ kind: "limit-exceeded", pointer: "", message: `Render exceeded ${timeoutMs} ms` }],
        };
      return result;
    },
  };
}
