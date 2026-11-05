import type { Result } from "../errors.ts";
import { utf8Length } from "../internal.ts";
import { arr, bool, type Infer, obj, str } from "../schema.ts";
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
const fields = obj({
  format: str({ maxLength: 32, enum: ["liveframe-package/1"] }),
  manifest: bool(),
  code: str({ maxLength: 1048576 }),
  scenarios: arr(bool(), { maxItems: 64 }),
  hash: str({ maxLength: 71, pattern: "^sha256-[0-9a-f]{64}$" }),
});
export type WidgetPackage = Omit<Infer<typeof fields>, "manifest" | "scenarios"> & {
  readonly manifest: Manifest;
  readonly scenarios: readonly Scenario[];
};
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

/** Transport structure only: never executes code or checks hashes and manifest semantics. */
export function validateWidgetPackageShape(doc: unknown): Result<WidgetPackage> {
  const json = validateJson(doc, true);
  if (!json.ok) return json;
  const c = documentChecks();
  if (!isRecord(doc)) c.reject("", "Expected a widget package object");
  else {
    const shape = checkFormat(widgetPackageSchema, doc, "", { "urn:liveframe:manifest:1": manifestSchema });
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
    checkCodeSize(doc.code, c);
    c.collect(validateManifestShape(doc.manifest), "/manifest");
    if (Array.isArray(doc.scenarios)) checkScenarios(doc.scenarios, c);
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as WidgetPackage };
}
