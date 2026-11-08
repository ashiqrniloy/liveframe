import type { LiveframeError, Result } from "../errors.ts";
import { validateWidgetPackageShape, type WidgetPackage } from "../formats/package.ts";
import { librarySpecifier } from "../runner-kit/link.ts";
import type { Links } from "./links.ts";

/** The transitive graph under one package: at most 32 libraries, at most 4 deep (plan 030 Task 9). */
export const MAX_GRAPH_PACKAGES = 32;
export const MAX_GRAPH_DEPTH = 4;

/** `id@version`: how supplied libraries are looked up. */
export function libraryKey(id: string, version: string): string {
  return `${id}@${version}`;
}

/** What each supplied library exports, by the specifier that imports it. */
export function exportsBySpecifier(libraries: ReadonlyMap<string, WidgetPackage>): Map<string, Set<string>> {
  return new Map(
    [...libraries.values()].map((lib) => [
      librarySpecifier(lib.manifest.id, lib.manifest.version),
      new Set(lib.manifest.exports ?? []),
    ]),
  );
}

function reject(i: number, message: string, kind: LiveframeError["kind"] = "invalid-document"): Result<never> {
  return { ok: false, errors: [{ kind, pointer: `/libraries/${i}`, message }] };
}

/**
 * Supplied library packages by `id@version`. Each must pass the transport checks and be a code
 * package; two with one `(id, version)` must be the same package. Verifying them is the graph walk's job.
 */
export function indexLibraries(libraries: readonly WidgetPackage[]): Result<Map<string, WidgetPackage>> {
  const index = new Map<string, WidgetPackage>();
  for (const [i, doc] of libraries.entries()) {
    const shape = validateWidgetPackageShape(doc);
    if (!shape.ok)
      return { ok: false, errors: shape.errors.map((e) => ({ ...e, pointer: `/libraries/${i}${e.pointer}` })) };
    const lib = shape.value;
    if (lib.template !== undefined) return reject(i, "Expected a code package: a template package cannot be a library");
    const key = libraryKey(lib.manifest.id, lib.manifest.version);
    const known = index.get(key);
    if (known && known.hash !== lib.hash) return reject(i, `Two different packages supplied for ${key}`);
    index.set(key, lib);
  }
  return { ok: true, value: index };
}

/**
 * The code's library header lines must be the manifest's pins: one namespace import per
 * dependency, bound in order as `__lf_lib0…`, and the code reads libraries only through those
 * bindings. A library package must also export every name its manifest declares.
 */
export function checkLinks(pkg: WidgetPackage, links: Links): Result<undefined> {
  const fail = (pointer: string, message: string): Result<undefined> => ({
    ok: false,
    errors: [{ kind: "invalid-document", pointer, message }],
  });
  if (links.stray !== undefined)
    return fail(`/code/${links.stray}`, "Expected library bindings only as header imports read by string key");
  const pins = pkg.manifest.dependencies ?? [];
  const wanted = pins.map((pin) => librarySpecifier(pin.id, pin.version));
  const same =
    links.imports.length === wanted.length &&
    links.imports.every((item, i) => item.local === `__lf_lib${i}`) &&
    new Set(links.imports.map((item) => item.specifier)).size === wanted.length &&
    wanted.every((specifier) => links.imports.some((item) => item.specifier === specifier));
  if (!same)
    return fail("/manifest/dependencies", "Expected one library import in the code for each dependency, and no other");
  for (const name of pkg.manifest.exports ?? [])
    if (!links.exports.has(name))
      return fail("/code", `Expected the code to export ${name}, which the manifest declares`);
  return { ok: true, value: undefined };
}

/** The names read from each library, by specifier. */
export function usesBySpecifier(links: Links): Map<string, ReadonlySet<string>> {
  const bySpecifier = new Map<string, ReadonlySet<string>>();
  for (const item of links.imports) bySpecifier.set(item.specifier, links.used.get(item.local) ?? new Set());
  return bySpecifier;
}
