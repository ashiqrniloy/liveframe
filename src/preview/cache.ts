import type { WidgetPackage } from "../formats/package.ts";
import { packageHash } from "../pack/hash.ts";

export { cachedValidatorCount } from "../runner-kit/cache.ts";

const verified = new WeakSet<WidgetPackage>();
function frozen(value: unknown): boolean {
  return (
    value === null ||
    typeof value !== "object" ||
    (Object.isFrozen(value) &&
      Object.values(Object.getOwnPropertyDescriptors(value)).every((entry) => "value" in entry && frozen(entry.value)))
  );
}
export function verifyPackageHash(pkg: WidgetPackage): boolean {
  if (verified.has(pkg)) return true;
  try {
    if (packageHash(pkg) !== pkg.hash) return false;
    if (frozen(pkg)) verified.add(pkg);
    return true;
  } catch {
    return false;
  }
}
