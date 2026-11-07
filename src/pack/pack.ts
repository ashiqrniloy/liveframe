import type { Result } from "../errors.ts";
import { validateWidgetPackageShape, type WidgetPackage } from "../formats/package.ts";
import { freezeCopy } from "../internal.ts";
import { bundle } from "./bundle.ts";
import { packageHash } from "./hash.ts";
import { validatePackageInputs } from "./verify.ts";

type Install = Parameters<typeof validatePackageInputs>[1];
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
function seal(pkg: Omit<WidgetPackage, "hash">): Result<WidgetPackage> {
  try {
    return { ok: true, value: freezeCopy({ ...pkg, hash: packageHash(pkg) }) };
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return { ok: false, errors: [{ kind: "invalid-document", pointer: "", message: error.message }] };
  }
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
  const linked = bundle(input);
  if (!linked.ok) return linked;
  const pkg = { ...inputs.value, code: linked.value };
  const bounded = validateWidgetPackageShape(pkg);
  if (!bounded.ok) return bounded;
  return seal(pkg);
}
