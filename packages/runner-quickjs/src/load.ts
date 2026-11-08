import type { LiveframeError, Result } from "@arnilo/liveframe";
import { packageHash, type WidgetPackage } from "@arnilo/liveframe/pack";
import { linkPackage } from "@arnilo/liveframe/runner-kit";

/** The bounds `verifyPackage` enforces on a package's library graph (spec §7.3). */
const MAX_GRAPH_DEPTH = 4;
const MAX_GRAPH_PACKAGES = 32;

/** What the sandbox is given: the package's linked code and its libraries' by specifier. */
export type Linked = { readonly code: string; readonly libraries: Readonly<Record<string, string>> };

type Pin = NonNullable<WidgetPackage["manifest"]["dependencies"]>[number];

const keyOf = (id: string, version: string): string => `${id}@${version}`;
const specifierOf = (id: string, version: string): string => `liveframe:lib/${keyOf(id, version)}`;

function fail(kind: LiveframeError["kind"], pointer: string, message: string): Result<never> {
  return { ok: false, errors: [{ kind, pointer, message }] };
}

/** A package's hash against its content. The caller refuses a package that fails it before loading anything. */
export function hashMatches(pkg: WidgetPackage): boolean {
  try {
    return packageHash(pkg) === pkg.hash;
  } catch {
    return false;
  }
}

/**
 * The libraries `pkg` needs, dependencies first and each once: every pin must name a supplied library
 * with that hash (`not-found`, `hash-mismatch`), each library's content is re-hashed, and the graph stays
 * within the bounds `verifyPackage` enforces.
 */
function collect(pkg: WidgetPackage, supplied: readonly WidgetPackage[] | undefined): Result<readonly WidgetPackage[]> {
  if (!pkg.manifest.dependencies?.length) return { ok: true, value: [] };
  const byKey = new Map((supplied ?? []).map((lib) => [keyOf(lib.manifest.id, lib.manifest.version), lib]));
  const ordered = new Map<string, WidgetPackage>();
  const visit = (owner: WidgetPackage, trail: readonly string[]): Result<undefined> => {
    for (const [i, pin] of (owner.manifest.dependencies ?? []).entries() as Iterable<[number, Pin]>) {
      const at = `/manifest/dependencies/${i}`;
      const key = keyOf(pin.id, pin.version);
      const lib = byKey.get(key);
      if (!lib) return fail("not-found", at, `No library package was supplied for ${key}`);
      if (lib.hash !== pin.hash) return fail("hash-mismatch", `${at}/hash`, `${key} does not match the pinned hash`);
      if (trail.includes(key)) return fail("invalid-document", at, `Dependency cycle at ${key}`);
      if (trail.length >= MAX_GRAPH_DEPTH)
        return fail("limit-exceeded", at, `Expected dependencies at most ${MAX_GRAPH_DEPTH} deep`);
      if (ordered.has(lib.hash)) continue;
      if (!hashMatches(lib)) return fail("hash-mismatch", at, `${key} content does not match its hash`);
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

/** Sends the SDK specifiers to the kit module and leaves library specifiers for the sandbox's loader. */
function link(code: string, at: string): Result<string> {
  const linked = linkPackage(code, (specifier) =>
    specifier.startsWith("liveframe:lib/") ? specifier : "liveframe:kit",
  );
  return linked.ok ? linked : { ok: false, errors: linked.errors.map((error) => ({ ...error, pointer: at })) };
}

/** Links `pkg` and the libraries its pins name, or says why it cannot be loaded. */
export function prepare(pkg: WidgetPackage, supplied: readonly WidgetPackage[] | undefined): Result<Linked> {
  const libraries = collect(pkg, supplied);
  if (!libraries.ok) return libraries;
  const code = link(pkg.code as string, "/code");
  if (!code.ok) return code;
  const linkedLibraries: Record<string, string> = {};
  for (const lib of libraries.value) {
    const linked = link(lib.code as string, "/code");
    if (!linked.ok) return linked;
    linkedLibraries[specifierOf(lib.manifest.id, lib.manifest.version)] = linked.value;
  }
  return { ok: true, value: { code: code.value, libraries: linkedLibraries } };
}
