import type { WidgetPackage } from "../formats/package.ts";
import { packageHash } from "../pack/hash.ts";

export { cachedValidatorCount } from "../runner-kit/cache.ts";

const verified = new WeakSet<WidgetPackage>();

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
