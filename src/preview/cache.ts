import type { WidgetPackage } from "../formats/package.ts";
import { packageHash } from "../pack/hash.ts";

export { cachedValidatorCount } from "../runner-kit/cache.ts";

const verified = new WeakMap<WidgetPackage, WidgetPackage>();

/**
 * A package's hash may key a module or validator cache only after it has been
 * checked against the package's content. The check is remembered per object, with
 * the references it covered: a package whose `hash`, `format`, `code`, `manifest` or
 * `scenarios` was reassigned since is hashed again, so it cannot load new code under
 * an old verified hash. Mutating inside `manifest` or `scenarios` is not detected;
 * packed packages are treated as immutable, and freezing them is a 0.3.0 contract.
 */
export function verifyPackageHash(pkg: WidgetPackage): boolean {
  const seen = verified.get(pkg);
  if (
    seen &&
    seen.hash === pkg.hash &&
    seen.format === pkg.format &&
    seen.code === pkg.code &&
    seen.manifest === pkg.manifest &&
    seen.scenarios === pkg.scenarios
  ) {
    return true;
  }
  try {
    if (packageHash(pkg) !== pkg.hash) return false;
  } catch {
    return false; // Content that cannot be hashed cannot match a hash either.
  }
  // A shallow copy, never `pkg` itself: reassigning a field on `pkg` must not change what was verified.
  verified.set(pkg, {
    hash: pkg.hash,
    format: pkg.format,
    code: pkg.code,
    manifest: pkg.manifest,
    scenarios: pkg.scenarios,
  });
  return true;
}
