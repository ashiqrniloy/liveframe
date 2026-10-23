import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { validateScenario, validateWidgetPackageShape } from "@arnilo/liveframe/pack";
import { validatePlacement, validateState, validateStyleRecord } from "@arnilo/liveframe/store";
import { formats, schemaDocument } from "../formats/registry.ts";
import manifest from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };

const scenario = { name: "default", params: {}, context: {}, data: {} };
const pkg = {
  format: "liveframe-package/1",
  manifest,
  code: "export default () => null;",
  scenarios: [scenario],
  hash: `sha256-${"a".repeat(64)}`,
};
const placement = {
  id: "home-1",
  slot: "home.main",
  widget: { id: manifest.id, version: manifest.version },
  params: {},
};
const style = { kind: "theme", id: "certified", version: "1", body: {} };

function rejects(result: ReturnType<typeof validateState>, pointer: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors.length).toBeLessThanOrEqual(20);
    expect(result.errors).toContainEqual(expect.objectContaining({ kind: "invalid-document", pointer }));
  }
}

test("package_format_rejects_malformed", () => {
  const { hash: _, ...missingHash } = pkg;
  for (const [doc, pointer] of [
    [missingHash, "/hash"],
    [{ ...pkg, hash: `sha256-${"A".repeat(64)}` }, "/hash"],
    [{ ...pkg, scenarios: [] }, "/scenarios"],
    [{ ...pkg, scenarios: [scenario, scenario] }, "/scenarios/1/name"],
    [{ ...pkg, scenarios: Array.from({ length: 65 }, (_, i) => ({ ...scenario, name: String(i) })) }, "/scenarios"],
    [{ ...pkg, code: "a".repeat(1048577) }, "/code"],
    [{ ...pkg, code: "👍".repeat(262145) }, "/code"],
    [{ ...pkg, extra: true }, "/extra"],
    [{ ...pkg, manifest: { ...manifest, id: 42 } }, "/manifest/id"],
    [{ ...pkg, manifest: { ...manifest, params: { type: "string" } } }, "/manifest/params"],
    [{ ...pkg, scenarios: [{ ...scenario, data: [] }] }, "/scenarios/0/data"],
    [{ ...pkg, scenarios: [{ ...scenario, name: "" }] }, "/scenarios/0/name"],
  ] as const)
    rejects(validateWidgetPackageShape(doc), pointer);
});

test("record_formats_reject_malformed", () => {
  const { slot: _, ...missingSlot } = placement;
  rejects(validatePlacement(missingSlot), "/slot");
  rejects(validatePlacement({ ...placement, widget: { id: "widget" } }), "/widget/version");
  rejects(validateStyleRecord({ ...style, kind: "unknown" }), "/kind");
  rejects(validateStyleRecord({ ...style, body: undefined }), "/body");
  rejects(validatePlacement({ ...placement, params: { "a/b~": NaN } }), "/params/a~1b~0");
});

test("json_fields_reject_non_json_and_bound_errors", () => {
  const cycle: unknown[] = [];
  cycle.push(cycle);
  for (const value of [undefined, NaN, Infinity, 1n, () => {}, Symbol(), new Date(), cycle, [undefined]]) {
    expect(validateState(value).ok).toBe(false);
    expect(validateScenario({ ...scenario, params: value }).ok).toBe(false);
  }
  const errors = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [i, undefined]));
  const result = validatePlacement({ ...placement, params: errors });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toHaveLength(20);
});

test("package_and_record_schemas_agree_with_structural_validators", () => {
  const ajv = new Ajv2020({ strict: true, formats: { regex: true } });
  for (const name of Object.keys(formats) as (keyof typeof formats)[]) ajv.addSchema(schemaDocument(name));
  for (const [name, validate, documents] of [
    [
      "widget-package",
      validateWidgetPackageShape,
      [pkg, { ...pkg, scenarios: [] }, { ...pkg, hash: "bad" }, { ...pkg, manifest: null }],
    ],
    ["placement", validatePlacement, [placement, { ...placement, slot: 1 }, { ...placement, params: null }]],
    [
      "style-record",
      validateStyleRecord,
      [style, { ...style, kind: "designSystem", body: null }, { ...style, kind: "bad" }],
    ],
  ] as const) {
    const published = ajv.getSchema(schemaDocument(name).$id);
    if (!published) throw new Error(`Missing schema: ${name}`);
    for (const doc of documents) expect(published(doc)).toBe(validate(doc).ok);
  }
  const accepted = validateWidgetPackageShape(pkg);
  expect(accepted.ok).toBe(true);
  if (accepted.ok) expect<unknown>(accepted.value).toBe(pkg);
  expect(validateScenario({ ...scenario, state: null }).ok).toBe(true);
  for (const state of [null, true, 1, "state", [], { nested: [null, false] }])
    expect(validateState(state).ok).toBe(true);
});

test("package_boundaries_and_transport_semantics", () => {
  const full = {
    ...pkg,
    code: "a".repeat(1048576),
    scenarios: Array.from({ length: 64 }, (_, i) => ({ ...scenario, name: String(i) })),
  };
  expect(validateWidgetPackageShape(full).ok).toBe(true);
  expect(validateWidgetPackageShape({ ...pkg, code: "👍".repeat(262144) }).ok).toBe(true);
  // Installation, not transport structure, checks these values against the manifest.
  expect(
    validateWidgetPackageShape({
      ...pkg,
      manifest: { ...manifest, initialState: null },
      scenarios: [{ ...scenario, params: null }],
    }).ok,
  ).toBe(true);
  rejects(
    validateWidgetPackageShape({ ...pkg, scenarios: [scenario, { ...scenario, params: null }] }),
    "/scenarios/1/name",
  );
  rejects(
    validateWidgetPackageShape({
      ...pkg,
      manifest: {
        ...manifest,
        sources: { tasks: { source: "tasks.list", params: { user: { from: "bad", path: "id" } } } },
      },
    }),
    "/manifest/sources/tasks/params/user/from",
  );
});
