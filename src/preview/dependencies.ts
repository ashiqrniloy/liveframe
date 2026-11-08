import type { LiveframeError, Result } from "../errors.ts";
import type { WidgetPackage } from "../formats/package.ts";
import { libraryKey, MAX_GRAPH_DEPTH, MAX_GRAPH_PACKAGES } from "../pack/libraries.ts";
import { verifyPackageHash } from "./cache.ts";

function fail(kind: LiveframeError["kind"], pointer: string, message: string): Result<never> {
  return { ok: false, errors: [{ kind, pointer, message }] };
}

type Pin = NonNullable<WidgetPackage["manifest"]["dependencies"]>[number];

/** The supplied library a pin names, or why there is none. */
function pinned(pin: Pin, at: string, supplied: ReadonlyMap<string, WidgetPackage>): Result<WidgetPackage> {
  const key = libraryKey(pin.id, pin.version);
  const lib = supplied.get(key);
  if (!lib) return fail("not-found", at, `No library package was supplied for ${key}`);
  if (lib.hash !== pin.hash) return fail("hash-mismatch", `${at}/hash`, `${key} does not match the pinned hash`);
  return { ok: true, value: lib };
}

/**
 * The library packages `pkg` needs, dependencies first and each once (plan 030 Task 10): every pin must
 * name a supplied library with that hash (`not-found`, `hash-mismatch`), and the graph stays within
 * the bounds `verifyPackage` enforces. Each library's content is also re-hashed once per object
 * (`hash-mismatch`); a worker that received libraries from a host that already did that passes
 * `trusted`. This is the one dependency loader both reference runners share.
 */
export function collectLibraries(
  pkg: WidgetPackage,
  libraries: readonly WidgetPackage[] | undefined,
  { trusted = false }: { readonly trusted?: boolean } = {},
): Result<readonly WidgetPackage[]> {
  if (!pkg.manifest.dependencies?.length) return { ok: true, value: [] };
  const supplied = new Map((libraries ?? []).map((lib) => [libraryKey(lib.manifest.id, lib.manifest.version), lib]));
  const ordered = new Map<string, WidgetPackage>();
  const visit = (owner: WidgetPackage, trail: readonly string[]): Result<undefined> => {
    for (const [i, pin] of (owner.manifest.dependencies ?? []).entries()) {
      const at = `/manifest/dependencies/${i}`;
      const key = libraryKey(pin.id, pin.version);
      const found = pinned(pin, at, supplied);
      if (!found.ok) return found;
      const lib = found.value;
      if (trail.includes(key)) return fail("invalid-document", at, `Dependency cycle at ${key}`);
      if (trail.length >= MAX_GRAPH_DEPTH)
        return fail("limit-exceeded", at, `Expected dependencies at most ${MAX_GRAPH_DEPTH} deep`);
      if (ordered.has(lib.hash)) continue;
      if (!trusted && !verifyPackageHash(lib))
        return fail("hash-mismatch", at, `${key} content does not match its hash`);
      const inner = visit(lib, [...trail, key]);
      if (!inner.ok) return inner;
      ordered.set(lib.hash, lib);
      if (ordered.size > MAX_GRAPH_PACKAGES)
        return fail("limit-exceeded", at, `Expected at most ${MAX_GRAPH_PACKAGES} libraries in all`);
    }
    return { ok: true, value: undefined };
  };
  const walked = visit(pkg, []);
  return walked.ok ? { ok: true, value: [...ordered.values()] } : walked;
}
