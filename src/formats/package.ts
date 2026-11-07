import type { Result } from "../errors.ts";
import { utf8Length } from "../internal.ts";
import { arr, bool, type Infer, obj, str } from "../schema.ts";
import type { Template } from "../template/document.ts";
import { TEMPLATE_BYTES, templateSchema } from "../template/schema.ts";
import { documentChecks, isRecord } from "./capabilities.ts";
import { checkFormat } from "./check.ts";
import { validateJson } from "./json.ts";
import { type Manifest, manifestSchema, validateManifestShape } from "./manifest.ts";
import { type Json, treeSchema } from "./tree.ts";

const scenarioFields = obj(
  { name: str({ maxLength: 128, pattern: "^.+$" }), params: bool(), context: bool(), data: bool() },
  { state: bool() },
);
export type Scenario = Omit<Infer<typeof scenarioFields>, "params" | "context" | "state" | "data"> & {
  readonly params: Json;
  readonly context: Json;
  readonly state?: Json;
  readonly data: Readonly<Record<string, Json>>;
};
const fields = obj(
  {
    format: str({ maxLength: 32, enum: ["liveframe-package/1"] }),
    manifest: bool(),
    scenarios: arr(bool(), { maxItems: 64 }),
    hash: str({ maxLength: 71, pattern: "^sha256-[0-9a-f]{64}$" }),
  },
  { code: str({ maxLength: 1048576 }), template: bool() },
);
type PackageFields = {
  readonly format: "liveframe-package/1";
  readonly manifest: Manifest;
  readonly scenarios: readonly Scenario[];
  readonly hash: string;
};
/**
 * Exactly one of `code` (a TSX widget's linked module) and `template` (a template widget's
 * document) is present; `validateWidgetPackageShape` enforces it, so a verified package that has no
 * `template` has `code`.
 */
export type WidgetPackage = PackageFields & { readonly code?: string; readonly template?: Template };
const json = { $ref: "#/$defs/json" } as const;
const scenarioSchema = {
  ...scenarioFields,
  properties: {
    ...scenarioFields.properties,
    params: json,
    context: json,
    state: json,
    data: { type: "object", additionalProperties: json },
  },
} as const;
export const widgetPackageSchema = {
  ...fields,
  properties: {
    ...fields.properties,
    manifest: { $ref: "urn:liveframe:manifest:1" },
    scenarios: { ...fields.properties.scenarios, minItems: 1, items: { $ref: "#/$defs/scenario" } },
    template: { $ref: "urn:liveframe:template:1" },
  },
  $defs: { json: treeSchema.$defs.json, scenario: scenarioSchema },
} as const;

/** Checks fixture structure, without interpreting the manifest or resolving data sources. */
export function validateScenario(doc: unknown): Result<Scenario> {
  const json = validateJson(doc);
  if (!json.ok) return json;
  const c = documentChecks();
  c.collect(checkFormat(widgetPackageSchema, doc, "/$defs/scenario"), "");
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as Scenario };
}

type Checks = ReturnType<typeof documentChecks>;

/** At most 1 MiB of UTF-8 code, counted without allocating a copy. */
function checkCodeSize(code: unknown, c: Checks): void {
  if (typeof code !== "string") return;
  if (utf8Length(code, 1048576) > 1048576) c.reject("/code", "Expected at most 1 MiB of UTF-8 code");
}

/** Every scenario is valid and its name is unique. */
function checkScenarios(scenarios: readonly unknown[], c: Checks): void {
  const seen = new Set<string>();
  for (const [i, scenario] of scenarios.entries()) {
    if (c.errors.length >= 20) break;
    const checked = scenario as Scenario;
    if (seen.has(checked.name)) c.reject(`/scenarios/${i}/name`, "Duplicate scenario name");
    seen.add(checked.name);
  }
}

/** Exactly one of `code` and `template`, and a template within its size bound. */
function checkBody(doc: Record<string, unknown>, c: Checks): void {
  const hasCode = Object.hasOwn(doc, "code");
  const hasTemplate = Object.hasOwn(doc, "template");
  if (hasCode === hasTemplate) c.reject("/code", "Expected exactly one of code and template", "invalid-document");
  else if (hasCode) checkCodeSize(doc.code, c);
  else if (utf8Length(JSON.stringify(doc.template), TEMPLATE_BYTES) > TEMPLATE_BYTES)
    c.reject("/template", "Expected at most 1 MiB of UTF-8 JSON", "limit-exceeded");
}

/** Transport structure only: never executes code or checks hashes and manifest semantics. */
export function validateWidgetPackageShape(doc: unknown): Result<WidgetPackage> {
  const json = validateJson(doc, true);
  if (!json.ok) return json;
  const c = documentChecks();
  if (!isRecord(doc)) c.reject("", "Expected a widget package object");
  else {
    const shape = checkFormat(widgetPackageSchema, doc, "", {
      "urn:liveframe:manifest:1": manifestSchema,
      "urn:liveframe:template:1": templateSchema,
    });
    if (!shape.ok) {
      c.collect(
        {
          ok: false,
          errors: shape.errors.filter(
            (error) => error.pointer !== "/manifest" && !error.pointer.startsWith("/manifest/"),
          ),
        },
        "",
      );
      c.collect(validateManifestShape(doc.manifest), "/manifest");
      return { ok: false, errors: c.errors };
    }
    checkBody(doc, c);
    c.collect(validateManifestShape(doc.manifest), "/manifest");
    if (Array.isArray(doc.scenarios)) checkScenarios(doc.scenarios, c);
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as WidgetPackage };
}
