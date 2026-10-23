import type { Result } from "../errors.ts";
import { arr, bool, checkValue, type Infer, obj, str } from "../schema.ts";
import { documentChecks, isRecord, shell } from "./capabilities.ts";
import { validateJson } from "./json.ts";
import { type Manifest, validateManifestShape } from "./manifest.ts";
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
export const scenarioSchema = {
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
    manifest: { $ref: "https://liveframe.dev/schemas/manifest.json" },
    scenarios: { ...fields.properties.scenarios, minItems: 1, items: { $ref: "#/$defs/scenario" } },
  },
  $defs: { json: treeSchema.$defs.json, scenario: scenarioSchema },
} as const;

/** Checks fixture structure, without interpreting the manifest or resolving data sources. */
export function validateScenario(doc: unknown): Result<Scenario> {
  const c = documentChecks();
  c.collect(validateJson(doc), "");
  if (!isRecord(doc)) c.reject("", "Expected a scenario object");
  else {
    c.collect(checkValue(scenarioFields, shell(doc, ["params", "context", "state", "data"])), "");
    if (!isRecord(doc.data)) c.reject("/data", "Expected a data source map");
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as Scenario };
}

/** Transport structure only: never executes code or checks hashes and manifest semantics. */
export function validateWidgetPackageShape(doc: unknown): Result<WidgetPackage> {
  const c = documentChecks();
  if (!isRecord(doc)) c.reject("", "Expected a widget package object");
  else {
    const input = shell(doc, ["manifest"]);
    if (Array.isArray(doc.scenarios)) input.scenarios = doc.scenarios.map(() => true);
    c.collect(checkValue(fields, input), "");
    if (typeof doc.code === "string") {
      let bytes = 0;
      for (const char of doc.code) {
        const unit = char.charCodeAt(0);
        bytes += char.length === 2 ? 4 : unit <= 0x7f ? 1 : unit <= 0x7ff ? 2 : 3;
        if (bytes > 1048576) {
          c.reject("/code", "Expected at most 1 MiB of UTF-8 code");
          break;
        }
      }
    }
    c.collect(validateManifestShape(doc.manifest), "/manifest");
    if (Array.isArray(doc.scenarios)) {
      if (!doc.scenarios.length) c.reject("/scenarios", "Expected at least one scenario");
      const seen = new Set<string>();
      for (const [i, scenario] of doc.scenarios.entries()) {
        if (c.errors.length >= 20) break;
        const checked = validateScenario(scenario);
        c.collect(checked, `/scenarios/${i}`);
        if (checked.ok) {
          if (seen.has(checked.value.name)) c.reject(`/scenarios/${i}/name`, "Duplicate scenario name");
          seen.add(checked.value.name);
        }
      }
    }
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as WidgetPackage };
}
