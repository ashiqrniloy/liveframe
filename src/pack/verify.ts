import type { Result } from "../errors.ts";
import { type Capabilities, documentChecks } from "../formats/capabilities.ts";
import type { Catalog } from "../formats/catalog.ts";
import { validateManifest } from "../formats/manifest.ts";
import { type WidgetPackage, validateWidgetPackageShape } from "../formats/package.ts";
import type { LanguageSchema } from "../schema.ts";
import { compileSchema } from "../validate/schema.ts";
import { checkModule } from "./bundle.ts";
import { packageHash } from "./hash.ts";

type PackageContext = { catalog: Catalog; capabilities: Capabilities };

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
  };
  const sink = { errors: c.errors, maxErrors: 20 };
  for (const [i, scenario] of pkg.scenarios.entries()) {
    if (c.errors.length >= 20) break;
    checks.params(scenario.params, `/scenarios/${i}/params`, sink);
    checks.state(scenario.state === undefined ? initialState : scenario.state, `/scenarios/${i}/state`, sink);
    checks.context(scenario.context, `/scenarios/${i}/context`, sink);
    checks.data(scenario.data, `/scenarios/${i}/data`, sink);
  }
  return c.errors.length
    ? { ok: false, errors: c.errors.map((error) => ({ ...error, kind: "invalid-document" })) }
    : { ok: true, value: pkg };
}

/** Re-check an untrusted package's structure, inputs, import rule and integrity without executing code. */
export function verifyPackage(doc: unknown, options: PackageContext): Result<WidgetPackage> {
  const shape = validateWidgetPackageShape(doc);
  if (!shape.ok) return shape;
  const inputs = validatePackageInputs(shape.value, options);
  if (!inputs.ok) return inputs;
  const pkg = inputs.value;
  const code = checkModule(pkg.code, "/code");
  if (!code.ok) return code;
  try {
    if (packageHash(pkg) !== pkg.hash)
      return {
        ok: false,
        errors: [{ kind: "hash-mismatch", pointer: "/hash", message: "Package content does not match its hash" }],
      };
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return { ok: false, errors: [{ kind: "invalid-document", pointer: "", message: error.message }] };
  }
  return { ok: true, value: pkg };
}
