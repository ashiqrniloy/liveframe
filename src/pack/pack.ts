import type { Result } from "../errors.ts";
import { type WidgetPackage, validateWidgetPackageShape } from "../formats/package.ts";
import { bundle } from "./bundle.ts";
import { packageHash } from "./hash.ts";
import { validatePackageInputs } from "./verify.ts";

/** Validate fixtures, link source files and hash one package without executing widget code. */
export function pack(
  input: {
    readonly files: Readonly<Record<string, string>>;
    readonly entry: string;
    readonly manifest: unknown;
    readonly scenarios: unknown;
  },
  options: Parameters<typeof validatePackageInputs>[1],
): Result<WidgetPackage> {
  const shape = validateWidgetPackageShape({
    format: "liveframe-package/1",
    manifest: input.manifest,
    scenarios: input.scenarios,
    code: "",
    hash: `sha256-${"0".repeat(64)}`,
  });
  if (!shape.ok) return shape;
  const inputs = validatePackageInputs(shape.value, options);
  if (!inputs.ok) return inputs;
  const linked = bundle(input);
  if (!linked.ok) return linked;
  const pkg = { ...inputs.value, code: linked.value };
  const bounded = validateWidgetPackageShape(pkg);
  if (!bounded.ok) return bounded;
  try {
    return { ok: true, value: { ...pkg, hash: packageHash(pkg) } };
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return { ok: false, errors: [{ kind: "invalid-document", pointer: "", message: error.message }] };
  }
}
