import { LiveframeFailure, type Result } from "../errors.ts";
import { validateWidgetPackageShape, type WidgetPackage } from "../formats/package.ts";
import { canonicalJson, packageHash } from "../pack/hash.ts";
import { verifyPackage } from "../pack/verify.ts";

/** Host-owned LRU of verified frozen packages; keys include content and installation documents. */
export function verifiedPackages({ max = 256 }: { max?: number } = {}) {
  if (!Number.isSafeInteger(max) || max <= 0)
    throw new LiveframeFailure([
      { kind: "invalid-document", pointer: "/max", message: "Expected a positive safe integer" },
    ]);
  const entries = new Map<string, WidgetPackage>();
  return {
    get(key: string): WidgetPackage | undefined {
      const pkg = entries.get(key);
      if (pkg) {
        entries.delete(key);
        entries.set(key, pkg);
      }
      return pkg;
    },
    set(key: string, pkg: WidgetPackage): void {
      entries.delete(key);
      entries.set(key, pkg);
      if (entries.size > max) entries.delete(entries.keys().next().value as string);
    },
  };
}

/** Stored records stay untrusted even when the host retains a previous verification. */
export function verifyStoredPackage(
  doc: unknown,
  install: Parameters<typeof verifyPackage>[1],
  cache?: ReturnType<typeof verifiedPackages>,
): Result<WidgetPackage> {
  if (!cache) return verifyPackage(doc, install);
  const shape = validateWidgetPackageShape(doc);
  if (!shape.ok) return shape;
  let key: string;
  try {
    const hash = packageHash(shape.value);
    if (hash !== shape.value.hash) return verifyPackage(doc, install);
    key = JSON.stringify([hash, canonicalJson(install.catalog), canonicalJson(install.capabilities)]);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return { ok: false, errors: [{ kind: "invalid-document", pointer: "", message: error.message }] };
  }
  const cached = cache.get(key);
  if (cached) return { ok: true, value: cached };
  const verified = verifyPackage(doc, install);
  if (verified.ok) cache.set(key, verified.value);
  return verified;
}
