import type { Result } from "../errors.ts";
import { validateWidgetPackageShape, type WidgetPackage } from "../formats/package.ts";
import { librarySpecifier } from "../runner-kit/link.ts";
import { checkModule } from "./bundle.ts";
import { checkLinks, indexLibraries } from "./libraries.ts";
import { linkScan } from "./links.ts";
import { seal } from "./pack.ts";

function problem(
  kind: "invalid-document" | "not-found" | "unknown-name",
  pointer: string,
  message: string,
): Result<never> {
  return { ok: false, errors: [{ kind, pointer, message }] };
}

const headerLine = (local: string, specifier: string): string =>
  `import * as ${local} from ${JSON.stringify(specifier)};`;

/**
 * A new version of a code package whose dependency pins move to other versions of the libraries it
 * uses (plan 030 Task 9), without transpiling again: the code is the same bytes except the version in
 * each library's header line. `libraries` holds one verified package for every dependency's id, at
 * the version to pin; each name the code reads must still be exported (`unknown-name` otherwise).
 * Nothing is mutated or stored, and the result is a new package with its own hash; run
 * `verifyPackage` with the libraries to check it against an install.
 */
export function rebindDependencies(
  pkg: unknown,
  { libraries, version }: { readonly libraries: readonly WidgetPackage[]; readonly version: string },
): Result<WidgetPackage> {
  if (typeof version !== "string" || version.length < 1 || version.length > 128)
    return problem("invalid-document", "/version", "Expected a version of 1–128 characters");
  const shape = validateWidgetPackageShape(pkg);
  if (!shape.ok) return shape;
  const source = shape.value;
  const pins = source.manifest.dependencies;
  if (source.code === undefined || !pins?.length)
    return problem("invalid-document", "/manifest/dependencies", "Expected a code package with dependencies to rebind");
  const scan = linkScan();
  const code = checkModule(source.code, "/code", false, scan.visit);
  if (!code.ok) return code;
  const links = scan.result();
  const linked = checkLinks(source, links);
  if (!linked.ok) return linked;
  const supplied = indexLibraries(libraries);
  if (!supplied.ok) return supplied;

  let moved = source.code;
  const next = [];
  for (const [i, pin] of pins.entries()) {
    const at = `/manifest/dependencies/${i}`;
    const matches = [...supplied.value.values()].filter((lib) => lib.manifest.id === pin.id);
    if (!matches.length) return problem("not-found", at, `No library package was supplied for ${pin.id}`);
    const [lib, other] = matches as [WidgetPackage, ...WidgetPackage[]];
    if (other) return problem("invalid-document", at, `Expected one version of ${pin.id}`);
    const was = librarySpecifier(pin.id, pin.version);
    const now = librarySpecifier(lib.manifest.id, lib.manifest.version);
    const used = links.imports.find((item) => item.specifier === was);
    for (const name of links.used.get(used?.local ?? "") ?? [])
      if (!lib.manifest.exports?.includes(name)) return problem("unknown-name", at, `${now} does not export ${name}`);
    const line = headerLine(used?.local ?? "", was);
    if (!moved.includes(line))
      return problem("invalid-document", "/code", `Expected the canonical header line ${line}`);
    moved = moved.replace(line, () => headerLine(used?.local ?? "", now));
    next.push({ id: pin.id, version: lib.manifest.version, hash: lib.hash });
  }
  const rebound = { ...source, manifest: { ...source.manifest, version, dependencies: next }, code: moved };
  const bounded = validateWidgetPackageShape(rebound);
  if (!bounded.ok) return bounded;
  const { hash: _, ...content } = rebound;
  return seal(content);
}
