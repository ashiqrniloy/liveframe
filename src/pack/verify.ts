import type { LiveframeError, Result } from "../errors.ts";
import { type Capabilities, documentChecks } from "../formats/capabilities.ts";
import type { Catalog } from "../formats/catalog.ts";
import { validateManifest } from "../formats/manifest.ts";
import { validateWidgetPackageShape, type WidgetPackage } from "../formats/package.ts";
import { freezeCopy } from "../internal.ts";
import { librarySpecifier } from "../runner-kit/link.ts";
import type { LanguageSchema } from "../schema.ts";
import { validateTemplate } from "../template/document.ts";
import { compileActions } from "../validate/actions.ts";
import { compileSchema } from "../validate/schema.ts";
import { checkModule } from "./bundle.ts";
import { packageHash } from "./hash.ts";
import {
  checkLinks,
  indexLibraries,
  libraryKey,
  MAX_GRAPH_DEPTH,
  MAX_GRAPH_PACKAGES,
  usesBySpecifier,
} from "./libraries.ts";
import { linkScan } from "./links.ts";

export type PackageContext = { catalog: Catalog; capabilities: Capabilities };

/** Called only after transport validation, with installed host documents. */
export function validatePackageInputs(pkg: WidgetPackage, options: PackageContext): Result<WidgetPackage> {
  const c = documentChecks();
  const manifest = validateManifest(pkg.manifest, options);
  c.collect(manifest, "/manifest");
  if (!manifest.ok) return { ok: false, errors: c.errors };
  const { params, state, context, initialState, sources } = manifest.value;
  const dataProperties: Record<string, LanguageSchema> = {};
  for (const [name, declared] of Object.entries(sources)) {
    const source = options.capabilities.sources[declared.source];
    if (source) dataProperties[name] = source.result;
  }
  const checks = {
    params: compileSchema(params),
    state: compileSchema(state),
    context: compileSchema(context),
    data: compileSchema({
      type: "object",
      properties: dataProperties,
      required: Object.keys(sources),
      additionalProperties: false,
    }),
    actions: compileActions(manifest.value, options.capabilities),
  };
  const sink = { errors: c.errors, maxErrors: 20 };
  for (const [i, scenario] of pkg.scenarios.entries()) {
    if (c.errors.length >= 20) break;
    checks.params(scenario.params, `/scenarios/${i}/params`, sink);
    checks.state(scenario.state === undefined ? initialState : scenario.state, `/scenarios/${i}/state`, sink);
    checks.context(scenario.context, `/scenarios/${i}/context`, sink);
    checks.data(scenario.data, `/scenarios/${i}/data`, sink);
    if (scenario.actions !== undefined) checks.actions(scenario.actions, `/scenarios/${i}/actions`, sink);
  }
  if (c.errors.length) return { ok: false, errors: c.errors.map((error) => ({ ...error, kind: "invalid-document" })) };
  // Template errors keep their own kinds (`unknown-name`, `invalid-prop`, …): they say what to fix.
  if (pkg.template !== undefined) {
    const template = validateTemplate(pkg.template, { ...options, manifest: manifest.value });
    c.collect(template, "/template");
    if (!template.ok) return { ok: false, errors: c.errors };
  }
  return { ok: true, value: pkg };
}

export type VerifyOptions = PackageContext & {
  /**
   * Library packages to check the dependency pins and imported names against. Without it a package is
   * checked only for consistency between its code and its manifest's pins (plan 030 Task 9).
   */
  readonly libraries?: readonly WidgetPackage[];
};

/** A verified package and the length of the longest dependency chain below it. */
type Verified = { readonly package: WidgetPackage; readonly height: number };
type Libraries = ReadonlyMap<string, WidgetPackage>;

function failure(kind: LiveframeError["kind"], pointer: string, message: string): Result<never> {
  return { ok: false, errors: [{ kind, pointer, message }] };
}

/**
 * Each pin must name a supplied library with that hash; the names read from it must be among its
 * exports; and the library must itself verify, with the same rules, so a graph is checked once per
 * package. `trail` holds the ancestors, which is how a cycle shows even among unverified documents.
 */
function checkDependencies(
  pkg: WidgetPackage,
  uses: ReadonlyMap<string, ReadonlySet<string>>,
  libraries: Libraries,
  context: PackageContext,
  trail: readonly string[],
  seen: Map<string, Result<Verified>>,
): Result<number> {
  const self = libraryKey(pkg.manifest.id, pkg.manifest.version);
  let height = 0;
  for (const [i, pin] of (pkg.manifest.dependencies ?? []).entries()) {
    const key = libraryKey(pin.id, pin.version);
    const at = `/manifest/dependencies/${i}`;
    if (key === self || trail.includes(key))
      return failure("invalid-document", at, `Dependency cycle: ${[...trail, self, key].join(" → ")}`);
    const lib = libraries.get(key);
    if (!lib) return failure("not-found", at, `No library package was supplied for ${key}`);
    if (lib.hash !== pin.hash) return failure("hash-mismatch", `${at}/hash`, `${key} does not match the pinned hash`);
    for (const name of uses.get(librarySpecifier(pin.id, pin.version)) ?? [])
      if (!lib.manifest.exports?.includes(name))
        return failure("unknown-name", "/code", `${key} does not export ${name}`);
    let verified = seen.get(lib.hash);
    if (!verified) {
      verified = verifyWith(lib, context, libraries, [...trail, self], seen);
      seen.set(lib.hash, verified);
    }
    if (!verified.ok) {
      const [first] = verified.errors as [LiveframeError];
      return failure(first.kind, at, `Library ${key}: ${first.message} (${first.pointer})`);
    }
    height = Math.max(height, verified.value.height + 1);
  }
  if (seen.size > MAX_GRAPH_PACKAGES)
    return failure(
      "limit-exceeded",
      "/manifest/dependencies",
      `Expected at most ${MAX_GRAPH_PACKAGES} libraries in all`,
    );
  if (height > MAX_GRAPH_DEPTH)
    return failure("limit-exceeded", "/manifest/dependencies", `Expected dependencies at most ${MAX_GRAPH_DEPTH} deep`);
  return { ok: true, value: height };
}

/**
 * `pack()`'s own check of the package it just sealed: the pins, names and graph rules of
 * `verifyPackage`, without hashing or parsing the package again.
 */
export function checkLibraries(
  pkg: WidgetPackage,
  uses: ReadonlyMap<string, ReadonlySet<string>>,
  libraries: Libraries,
  context: PackageContext,
): Result<undefined> {
  const checked = checkDependencies(pkg, uses, libraries, context, [], new Map());
  return checked.ok ? { ok: true, value: undefined } : checked;
}

function verifyWith(
  doc: unknown,
  context: PackageContext,
  libraries: Libraries | undefined,
  trail: readonly string[],
  seen: Map<string, Result<Verified>>,
): Result<Verified> {
  const shape = validateWidgetPackageShape(doc);
  if (!shape.ok) return shape;
  const inputs = validatePackageInputs(shape.value, context);
  if (!inputs.ok) return inputs;
  const pkg = inputs.value;
  const scan = linkScan();
  if (pkg.template === undefined) {
    const code = checkModule(pkg.code as string, "/code", false, scan.visit);
    if (!code.ok) return code;
  }
  try {
    if (packageHash(pkg) !== pkg.hash)
      return failure("hash-mismatch", "/hash", "Package content does not match its hash");
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return failure("invalid-document", "", error.message);
  }
  const links = scan.result();
  const linked = checkLinks(pkg, links);
  if (!linked.ok) return linked;
  const verified = freezeCopy(pkg);
  if (!libraries) return { ok: true, value: { package: verified, height: 0 } };
  const depth = checkDependencies(pkg, usesBySpecifier(links), libraries, context, trail, seen);
  return depth.ok ? { ok: true, value: { package: verified, height: depth.value } } : depth;
}

/**
 * Re-check an untrusted package's structure, inputs, import rule and integrity without executing code.
 * A package that imports libraries must also have a header matching its pins; with `libraries`
 * supplied, the pins, the imported names and the graph bounds are checked against them too.
 */
export function verifyPackage(doc: unknown, options: VerifyOptions): Result<WidgetPackage> {
  let libraries: Libraries | undefined;
  if (options.libraries) {
    const index = indexLibraries(options.libraries);
    if (!index.ok) return index;
    libraries = index.value;
  }
  const verified = verifyWith(doc, options, libraries, [], new Map());
  return verified.ok ? { ok: true, value: verified.value.package } : verified;
}
