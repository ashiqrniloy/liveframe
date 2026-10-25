import type { Capabilities } from "../formats/capabilities.ts";
import type { Catalog } from "../formats/catalog.ts";
import type { Manifest } from "../formats/manifest.ts";
import type { WidgetPackage } from "../formats/package.ts";
import { packageHash } from "../pack/hash.ts";
import { type CompiledValidator, compileValidator } from "../validate/compile.ts";

/** Validators kept per `(catalog, capabilities)`, least recently used evicted first. */
const MAX_VALIDATORS = 64;
const verified = new WeakSet<WidgetPackage>();
const validators = new WeakMap<Catalog, WeakMap<Capabilities, Map<string, CompiledValidator>>>();

/**
 * A package's hash may key a module or validator cache only after it has been
 * checked once against the package's content, and checked for that object: packed
 * packages are immutable, so one check covers every later render. A mutated
 * package object would break that assumption, which is why the check is per object.
 */
export function verifyPackageHash(pkg: WidgetPackage): boolean {
  if (verified.has(pkg)) return true;
  try {
    if (packageHash(pkg) !== pkg.hash) return false;
  } catch {
    return false; // Content that cannot be hashed cannot match a hash either.
  }
  verified.add(pkg);
  return true;
}

/** Compiles a validator once per verified hash and keeps the 64 most recently used. */
export function compiledValidator(
  options: { readonly catalog: Catalog; readonly capabilities: Capabilities; readonly manifest: Manifest },
  hash: string,
): CompiledValidator {
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
  const cached = byHash.get(hash);
  if (cached) {
    byHash.delete(hash);
    byHash.set(hash, cached);
    return cached;
  }
  const validator = compileValidator(options);
  byHash.set(hash, validator);
  if (byHash.size > MAX_VALIDATORS) {
    const oldest = byHash.keys().next();
    if (!oldest.done) byHash.delete(oldest.value);
  }
  return validator;
}

/** @internal For tests only; the cache is not part of the published surface. */
export function cachedValidatorCount(catalog: Catalog, capabilities: Capabilities): number {
  return validators.get(catalog)?.get(capabilities)?.size ?? 0;
}
