import type { Capabilities } from "../formats/capabilities.ts";
import type { Catalog } from "../formats/catalog.ts";
import type { Manifest } from "../formats/manifest.ts";
import { type CompiledValidator, compileValidator } from "../validate/compile.ts";

/** Validators kept per `(catalog, capabilities)`, least recently used evicted first. */
const MAX_VALIDATORS = 64;
const validators = new WeakMap<Catalog, WeakMap<Capabilities, Map<string, CompiledValidator>>>();

/**
 * Compiles a validator once per key and keeps the 64 most recently used. The key must
 * identify the manifest: a verified package hash for the runners, the manifest's
 * canonical JSON for `renderModule`.
 */
export function compiledValidator(
  options: { readonly catalog: Catalog; readonly capabilities: Capabilities; readonly manifest: Manifest },
  key: string,
): CompiledValidator {
  let byCapabilities = validators.get(options.catalog);
  if (!byCapabilities) {
    byCapabilities = new WeakMap();
    validators.set(options.catalog, byCapabilities);
  }
  let byKey = byCapabilities.get(options.capabilities);
  if (!byKey) {
    byKey = new Map();
    byCapabilities.set(options.capabilities, byKey);
  }
  const cached = byKey.get(key);
  if (cached) {
    byKey.delete(key);
    byKey.set(key, cached);
    return cached;
  }
  const validator = compileValidator(options);
  byKey.set(key, validator);
  if (byKey.size > MAX_VALIDATORS) {
    const oldest = byKey.keys().next();
    if (!oldest.done) byKey.delete(oldest.value);
  }
  return validator;
}

/** @internal For tests only; the cache is not part of the published surface. */
export function cachedValidatorCount(catalog: Catalog, capabilities: Capabilities): number {
  return validators.get(catalog)?.get(capabilities)?.size ?? 0;
}
