import { LiveframeFailure, type Result } from "../errors.ts";
import { sameJson } from "../formats/json.ts";
import type { WidgetPackage } from "../formats/package.ts";
import { canonicalJson } from "../pack/hash.ts";
import { verifyPackage } from "../pack/verify.ts";
import { DEFAULT_LIMITS } from "../validate/tree.ts";

/** Host-owned LRU of verified frozen packages; keys include package identity and installation documents. */
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

const installKeys = new WeakMap<object, WeakMap<object, string>>();

function deepFrozen(value: unknown): boolean {
  if (value === null || typeof value !== "object") return true;
  if (!Object.isFrozen(value)) return false;
  for (const entry of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if (!("value" in entry) || !deepFrozen(entry.value)) return false;
  }
  return true;
}

function installKey(install: Parameters<typeof verifyPackage>[1]): string {
  const { catalog, capabilities } = install;
  if (typeof catalog === "object" && catalog !== null && typeof capabilities === "object" && capabilities !== null) {
    const cached = installKeys.get(catalog)?.get(capabilities);
    if (cached !== undefined) return cached;
    const key = JSON.stringify([canonicalJson(catalog), canonicalJson(capabilities)]);
    if (deepFrozen(catalog) && deepFrozen(capabilities)) {
      let byCapabilities = installKeys.get(catalog);
      if (!byCapabilities) {
        byCapabilities = new WeakMap();
        installKeys.set(catalog, byCapabilities);
      }
      byCapabilities.set(capabilities, key);
    }
    return key;
  }
  return JSON.stringify([canonicalJson(catalog), canonicalJson(capabilities)]);
}

function keyOf(doc: unknown, install: string): string | undefined {
  if (typeof doc !== "object" || doc === null) return undefined;
  const manifest = (doc as { readonly manifest?: unknown }).manifest;
  if (typeof manifest !== "object" || manifest === null) return undefined;
  const { id, version } = manifest as { readonly id?: unknown; readonly version?: unknown };
  return typeof id === "string" && typeof version === "string" ? JSON.stringify([id, version, install]) : undefined;
}

/** Stored records stay untrusted even when the host retains a previous verification. */
export function verifyStoredPackage(
  doc: unknown,
  install: Parameters<typeof verifyPackage>[1],
  cache?: ReturnType<typeof verifiedPackages>,
): Result<WidgetPackage> {
  if (!cache) return verifyPackage(doc, install);
  let installPart: string;
  try {
    const { nodes = DEFAULT_LIMITS.nodes } = install.limits ?? {};
    installPart = `${Number.isSafeInteger(nodes) ? nodes : "invalid"}:${installKey(install)}`;
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return { ok: false, errors: [{ kind: "invalid-document", pointer: "", message: error.message }] };
  }
  const key = keyOf(doc, installPart);
  if (key !== undefined) {
    const cached = cache.get(key);
    if (cached && sameJson(cached, doc)) return { ok: true, value: cached };
  }
  const verified = verifyPackage(doc, install);
  if (verified.ok)
    cache.set(
      key ?? JSON.stringify([verified.value.manifest.id, verified.value.manifest.version, installPart]),
      verified.value,
    );
  return verified;
}
