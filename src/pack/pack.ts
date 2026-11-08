import type { LiveframeError, Result } from "../errors.ts";
import { MAX_DIRECT_DEPENDENCIES } from "../formats/manifest.ts";
import { validateWidgetPackageShape, type WidgetPackage } from "../formats/package.ts";
import { freezeCopy } from "../internal.ts";
import { parseLibrarySpecifier } from "../runner-kit/link.ts";
import { bundleLinked, type LibraryUses } from "./bundle.ts";
import { canonicalJson, packageHash } from "./hash.ts";
import { exportsBySpecifier, indexLibraries, libraryKey } from "./libraries.ts";
import { checkLibraries, validatePackageInputs } from "./verify.ts";

type Install = Parameters<typeof validatePackageInputs>[1] & {
  /** Verified library packages a code draft may import as `liveframe:lib/<id>@<version>` (plan 030 Task 9). */
  readonly libraries?: readonly WidgetPackage[];
};
type CodeDraft = {
  readonly files: Readonly<Record<string, string>>;
  readonly entry: string;
  readonly manifest: unknown;
  readonly scenarios: unknown;
};
type TemplateDraft = {
  readonly template: unknown;
  readonly manifest: unknown;
  readonly scenarios: unknown;
};

/** Hashes a validated package and freezes it; the hash walk is where a non-JSON value surfaces. */
export function seal(pkg: Omit<WidgetPackage, "hash">): Result<WidgetPackage> {
  try {
    return { ok: true, value: freezeCopy({ ...pkg, hash: packageHash(pkg) }) };
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return { ok: false, errors: [{ kind: "invalid-document", pointer: "", message: error.message }] };
  }
}

type Dependencies = NonNullable<WidgetPackage["manifest"]["dependencies"]>;

function problem(kind: LiveframeError["kind"], pointer: string, message: string): Result<never> {
  return { ok: false, errors: [{ kind, pointer, message }] };
}

/**
 * The pins `pack()` records for the libraries a bundle imported, ascending by id. A draft that
 * already lists dependencies must list exactly these: the pins come from the code, not the author.
 */
function pinsFor(
  uses: LibraryUses,
  libraries: ReadonlyMap<string, WidgetPackage>,
  declared: unknown,
): Result<Dependencies> {
  if (uses.size > MAX_DIRECT_DEPENDENCIES)
    return problem("limit-exceeded", "/manifest/dependencies", `Expected at most ${MAX_DIRECT_DEPENDENCIES} libraries`);
  const pins = [...uses.keys()]
    .map((specifier) => {
      const { id, version } = parseLibrarySpecifier(specifier) as { id: string; version: string };
      return { id, version, hash: (libraries.get(libraryKey(id, version)) as WidgetPackage).hash };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (new Set(pins.map((pin) => pin.id)).size !== pins.length)
    return problem("invalid-document", "/manifest/dependencies", "Expected one version of each library");
  if (declared !== undefined && canonicalJson(declared) !== canonicalJson(pins))
    return problem(
      "invalid-document",
      "/manifest/dependencies",
      "Expected dependencies to be the libraries the code imports; pack() records them",
    );
  return { ok: true, value: pins };
}

/**
 * Validate fixtures and hash one package without executing widget code. A code draft links source
 * files into one module; a template draft is validated against the install documents and never
 * transpiled. The package holds exactly one of `code` and `template`.
 */
export function pack(input: CodeDraft | TemplateDraft, options: Install): Result<WidgetPackage> {
  const body = "template" in input ? { template: input.template } : { code: "" };
  const shape = validateWidgetPackageShape({
    format: "liveframe-package/1",
    manifest: input.manifest,
    scenarios: input.scenarios,
    ...body,
    hash: `sha256-${"0".repeat(64)}`,
  });
  if (!shape.ok) return shape;
  const inputs = validatePackageInputs(shape.value, options);
  if (!inputs.ok) return inputs;
  if ("template" in input) return seal(inputs.value);
  const supplied = indexLibraries(options.libraries ?? []);
  if (!supplied.ok) return supplied;
  const linked = bundleLinked({
    files: input.files,
    entry: input.entry,
    exports: inputs.value.manifest.exports ?? [],
    libraries: exportsBySpecifier(supplied.value),
  });
  if (!linked.ok) return linked;
  const { code, uses } = linked.value;
  const pins = pinsFor(uses, supplied.value, inputs.value.manifest.dependencies);
  if (!pins.ok) return pins;
  const { dependencies: _, ...bare } = inputs.value.manifest;
  const pkg = { ...inputs.value, manifest: pins.value.length ? { ...bare, dependencies: pins.value } : bare, code };
  const bounded = validateWidgetPackageShape(pkg);
  if (!bounded.ok) return bounded;
  if (pins.value.length) {
    const graph = checkLibraries(pkg, uses, supplied.value, options);
    if (!graph.ok) return graph;
  }
  return seal(pkg);
}
