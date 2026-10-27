import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { schemaDocument } from "../formats/registry.ts";
import { validateManifestShape } from "../formats/manifest.ts";
import {
  arr,
  bool,
  obj,
  str,
  validateCapabilities,
  validateCatalog,
  validateManifest,
  type Capabilities,
  type Manifest,
} from "../index.ts";
import catalogData from "./fixtures/catalog.json" with { type: "json" };
import type { Catalog } from "../index.ts";
const catalog = catalogData as Catalog;

const text = str({ maxLength: 128 });
const capabilities: Capabilities = {
  format: "liveframe-capabilities/1",
  actions: { "tasks.claim": { description: "Claim a task", args: obj({ id: text }), confirm: true } },
  sources: { "tasks.queue": { description: "Read tasks", params: obj({ cursor: text, limit: text }), result: text } },
};
const manifest: Manifest = {
  format: "liveframe-manifest/1",
  id: "agent-home",
  version: "1.0.0",
  catalogId: catalog.catalogId,
  params: obj({ limit: text }),
  state: obj({ cursors: obj({ tasks: text }), flag: bool() }),
  context: obj({ size: text }),
  initialState: { cursors: { tasks: "start" }, flag: false },
  sources: {
    queue: { source: "tasks.queue", params: { cursor: { from: "state", path: "cursors.tasks" }, limit: "50" } },
  },
  actions: ["tasks.claim"],
};
const context = { catalog, capabilities };
function rejects(doc: unknown, pointer: string, kind = "invalid-document") {
  const result = validateManifest(doc, context);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ pointer, kind }));
}
function binding(params: unknown) {
  return { ...manifest, sources: { queue: { source: "tasks.queue", params } } };
}

test("widget_schema_accepts_min_length_rejects_pattern", () => {
  const bounded = obj({
    reason: str({ minLength: 1, maxLength: 500 }),
    flags: arr(bool(), { minItems: 1, maxItems: 2 }),
  });
  const doc = {
    ...manifest,
    params: bounded,
    state: bounded,
    context: bounded,
    initialState: { reason: "😀", flags: [true] },
    sources: {},
  };
  expect(validateManifest(doc, context).ok).toBe(true);
  expect(new Ajv2020({ strict: true }).compile(schemaDocument("manifest"))(doc)).toBe(true);
  rejects(
    { ...doc, state: obj({ reason: str({ minLength: 1, maxLength: 500, pattern: "." }) }) },
    "/state/properties/reason/pattern",
  );
});

test("min_above_max_is_rejected", () => {
  for (const [schema, keyword] of [
    [str({ minLength: 3, maxLength: 2 }), "minLength"],
    [arr(bool(), { minItems: 3, maxItems: 2 }), "minItems"],
  ] as const) {
    const nested = obj({ "a/~": arr(schema, { maxItems: 2 }) });
    rejects({ ...manifest, state: nested }, `/state/properties/a~1~0/items/${keyword}`);
    const result = validateCatalog({ ...catalog, definitions: [{ ...catalog.definitions[0], props: nested }] });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          kind: "invalid-document",
          pointer: `/definitions/0/props/properties/a~1~0/items/${keyword}`,
        }),
      );
    const capability = validateCapabilities({
      ...capabilities,
      sources: { test: { description: "Test", params: obj({}), result: schema } },
    });
    expect(capability.ok).toBe(false);
    if (!capability.ok)
      expect(capability.errors).toContainEqual(
        expect.objectContaining({ kind: "invalid-document", pointer: `/sources/test/result/${keyword}` }),
      );
  }
});

test("manifest_names_only_declared_capabilities", () => {
  rejects({ ...manifest, actions: ["tasks.delete"] }, "/actions/0", "unknown-name");
  rejects(
    { ...manifest, sources: { queue: { source: "missing", params: {} } } },
    "/sources/queue/source",
    "unknown-name",
  );
  rejects({ ...manifest, actions: ["toString"] }, "/actions/0", "unknown-name");
});

test("bindings_resolve_and_match_types", () => {
  for (const path of ["missing", "cursors.missing", "cursors.0", "cursors.tasks.x", "toString", `${"x.".repeat(8)}x`])
    rejects(binding({ cursor: { from: "state", path }, limit: "50" }), "/sources/queue/params/cursor/path");
  rejects(binding({ cursor: { from: "state", path: "flag" }, limit: "50" }), "/sources/queue/params/cursor");
  rejects(binding({ limit: "50" }), "/sources/queue/params/cursor");
  rejects(binding({ cursor: 1, limit: "50" }), "/sources/queue/params/cursor");
  rejects(binding({ cursor: "start", limit: "50", extra: true }), "/sources/queue/params/extra", "unknown-name");
  rejects(binding({ cursor: { from: "data", path: "flag" }, limit: "50" }), "/sources/queue/params/cursor/from");
  rejects(
    binding({ cursor: { from: "state", path: "cursors.tasks", extra: true }, limit: "50" }),
    "/sources/queue/params/cursor/extra",
  );
  for (const from of ["params", "state", "context"] as const) {
    const path = { params: "limit", state: "cursors.tasks", context: "size" }[from];
    expect(validateManifest(binding({ cursor: { from, path }, limit: "50" }), context).ok).toBe(true);
  }
});

test("nullable_manifest_state_requires_a_declaration", () => {
  const state = obj({ flag: bool({ nullable: true }) });
  expect(validateManifest({ ...manifest, state, initialState: { flag: null }, sources: {} }, context).ok).toBe(true);
  rejects(
    { ...manifest, state: obj({ flag: bool() }), initialState: { flag: null }, sources: {} },
    "/initialState/flag",
  );
});

test("initial_state_matches_schema", () => {
  rejects({ ...manifest, initialState: { cursors: { tasks: true }, flag: false } }, "/initialState/cursors/tasks");
});
test("manifest_description_bounded", () => {
  expect(validateManifest({ ...manifest, description: "d".repeat(500) }, context).ok).toBe(true);
  expect(validateManifest({ ...manifest, description: "😀".repeat(500) }, context).ok).toBe(true);
  rejects({ ...manifest, description: "d".repeat(501) }, "/description");
  rejects({ ...manifest, description: 1 }, "/description");
  expect(validateManifestShape({ ...manifest, description: "d".repeat(501) }).ok).toBe(false);
});
const nest = (levels: number): unknown => (levels === 0 ? 1 : { a: nest(levels - 1) });
test("meta_depth_and_bytes_bounded", () => {
  const meta = { sizes: ["m", "l"], provenance: { scope: "org" }, ok: [null, true, 1.5] };
  expect(validateManifest({ ...manifest, meta }, context).ok).toBe(true);
  expect(validateManifestShape({ ...manifest, meta }).ok).toBe(true);
  expect(validateManifest({ ...manifest, meta: nest(8) }, context).ok).toBe(true);
  rejects({ ...manifest, meta: nest(9) }, "/meta/a/a/a/a/a/a/a/a", "limit-exceeded");
  // 4096 compact bytes: {"k":"<4088 chars>"} is 8 + 4088 = 4096.
  const exact = { k: "x".repeat(4088) };
  expect(validateManifest({ ...manifest, meta: exact }, context).ok).toBe(true);
  rejects({ ...manifest, meta: { k: "x".repeat(4089) } }, "/meta", "limit-exceeded");
  rejects({ ...manifest, meta: { k: "é".repeat(2045) } }, "/meta", "limit-exceeded");
  rejects({ ...manifest, meta: Array.from({ length: 5000 }, () => 0) }, "/meta", "limit-exceeded");
  const shape = validateManifestShape({ ...manifest, meta: { k: "x".repeat(4089) } });
  expect(shape.ok).toBe(false);
  if (!shape.ok)
    expect(shape.errors).toContainEqual(expect.objectContaining({ pointer: "/meta", kind: "limit-exceeded" }));
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  rejects({ ...manifest, meta: cycle }, "/meta/self/self/self/self/self/self/self/self", "limit-exceeded");
  rejects({ ...manifest, meta: { n: Number.NaN } }, "/meta/n");
  rejects({ ...manifest, meta: { u: undefined } }, "/meta/u");
  rejects({ ...manifest, meta: undefined }, "/meta");
  rejects({ ...manifest, meta: { d: new Date(0) } }, "/meta/d");
});
test("capability_meta_bounded", () => {
  const meta = { tier: "gold", nested: { ok: [1, 2] } };
  const ok = validateCapabilities({
    ...capabilities,
    actions: { "tasks.claim": { ...capabilities.actions["tasks.claim"], meta } },
    sources: { "tasks.queue": { ...capabilities.sources["tasks.queue"], meta } },
  });
  expect(ok.ok).toBe(true);
  for (const [bad, pointer, kind] of [
    [nest(9), "/meta/a/a/a/a/a/a/a/a", "limit-exceeded"],
    [{ k: "x".repeat(4089) }, "/meta", "limit-exceeded"],
    [{ n: Infinity }, "/meta/n", "invalid-document"],
  ] as const) {
    for (const key of ["actions", "sources"] as const) {
      const name = key === "actions" ? "tasks.claim" : "tasks.queue";
      const result = validateCapabilities({
        ...capabilities,
        [key]: { [name]: { ...capabilities[key][name], meta: bad } },
      });
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.errors).toContainEqual(expect.objectContaining({ pointer: `/${key}/${name}${pointer}`, kind }));
    }
  }
});
test("published_manifest_schema_accepts_meta", () => {
  const meta = { sizes: ["m"], provenance: { scope: "org" } };
  const ajv = new Ajv2020({ strict: true });
  const validate = ajv.compile(schemaDocument("manifest"));
  expect(validate({ ...manifest, description: "Pending.", meta })).toBe(true);
  expect(validate({ ...manifest, description: "d".repeat(501) })).toBe(false);
  const capabilitiesValidate = new Ajv2020({ strict: true, formats: { regex: true } }).compile(
    schemaDocument("capabilities"),
  );
  expect(
    capabilitiesValidate({
      ...capabilities,
      actions: { "tasks.claim": { ...capabilities.actions["tasks.claim"], meta } },
      sources: { "tasks.queue": { ...capabilities.sources["tasks.queue"], meta } },
    }),
  ).toBe(true);
});
test("manifest_catalog_must_match", () => {
  rejects({ ...manifest, catalogId: "other.ui@1" }, "/catalogId", "catalog-mismatch");
});
test("capability_schemas_are_in_language", () => {
  for (const doc of [
    null,
    { ...capabilities, extra: true },
    { ...capabilities, actions: { bad_name: capabilities.actions["tasks.claim"] } },
    { ...capabilities, actions: { x: { description: "x", args: { type: "string" } } } },
    { ...capabilities, sources: { x: { description: "x", params: text, result: text } } },
    { ...capabilities, sources: { x: { description: "x", params: obj({}), result: { type: "string" } } } },
    { ...capabilities, actions: { x: { description: "x".repeat(501), args: obj({}) } } },
    {
      ...capabilities,
      actions: Object.fromEntries(
        Array.from({ length: 513 }, (_, i) => [`a${i}`, { description: "x", args: obj({}) }]),
      ),
    },
  ])
    expect(validateCapabilities(doc).ok).toBe(false);
});
test("documents_are_closed_and_errors_bounded", () => {
  for (const doc of [
    null,
    {},
    { ...manifest, extra: true },
    { ...manifest, params: text },
    { ...manifest, state: { type: "object" } },
    { ...manifest, actions: ["tasks.claim", "tasks.claim"] },
    { ...manifest, sources: { queue: { source: "tasks.queue", params: {}, extra: true } } },
  ])
    expect(validateManifest(doc, context).ok).toBe(false);
  const result = validateManifest(
    { ...manifest, actions: Array.from({ length: 100 }, (_, i) => `missing${i}`) },
    context,
  );
  if (result.ok) throw new Error("Expected errors");
  expect(result.errors).toHaveLength(20);
  rejects({ ...manifest, sources: { "bad/~": {} } }, "/sources/bad~1~0");
});
test("published_capabilities_and_manifest_match_structure", () => {
  const ajv = new Ajv2020({ strict: true });
  ajv.addFormat("regex", {
    type: "string",
    validate: (s: string) => {
      try {
        new RegExp(s, "u");
        return true;
      } catch {
        return false;
      }
    },
  });
  for (const [name, value, validate] of [
    ["capabilities", capabilities, validateCapabilities],
    ["manifest", manifest, (doc: unknown) => validateManifest(doc, context)],
  ] as const) {
    const oracle = ajv.compile(schemaDocument(name));
    expect(oracle(value)).toBe(true);
    const result = validate(value);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(value);
    expect(oracle({ ...value, extra: true })).toBe(false);
  }
});
test("agent_home_manifest_validates_under_two_milliseconds", () => {
  // Mirrors the proof contracts; Task 8 supplies the reproducible export fixture.
  const id = str({ maxLength: 128, pattern: "^.+$" });
  const cursor = str({ maxLength: 128 });
  const actions = {
    "decisions.review": obj({ id }),
    "tasks.claim": obj({ id }),
    "tasks.escalate": obj({ id, reason: str({ maxLength: 500, pattern: "[\\s\\S]" }) }),
    "alerts.acknowledge": obj({ id }),
    "alerts.snooze": obj({ id, duration: str({ maxLength: 4, enum: ["hour", "day"] }) }),
    "alerts.convert": obj({ id }),
    "queue.retry": obj({}),
    "queue.about": obj({}),
  };
  const agentHome: Manifest = {
    ...manifest,
    params: obj({ canAct: bool(), canEscalate: bool(), canViewAlerts: bool() }),
    state: obj({
      filter: str({ maxLength: 9, enum: ["all", "decisions", "tasks", "alerts"] }),
      selected: text,
      cursors: obj({ decisions: cursor, tasks: cursor, alerts: cursor }),
      escalating: text,
      reason: str({ maxLength: 500 }),
    }),
    context: obj({ size: str({ maxLength: 6, enum: ["small", "medium", "large", "full"] }) }),
    initialState: {
      filter: "all",
      selected: "decision-8812",
      cursors: { decisions: "start", tasks: "start", alerts: "start" },
      escalating: "",
      reason: "",
    },
    sources: {
      queue: { source: "tasks.queue", params: { cursor: { from: "state", path: "cursors.tasks" }, limit: "50" } },
    },
    actions: Object.keys(actions),
  };
  const installed = {
    catalog,
    capabilities: {
      ...capabilities,
      actions: Object.fromEntries(Object.entries(actions).map(([name, args]) => [name, { description: name, args }])),
    },
  };
  expect(validateCapabilities(installed.capabilities).ok).toBe(true);
  for (let i = 0; i < 20; i++) validateManifest(agentHome, installed);
  const start = performance.now();
  expect(validateManifest(agentHome, installed).ok).toBe(true);
  expect(performance.now() - start).toBeLessThan(2);
});

test("source_literals_validate_nested_values_and_bindings_stay_closed", () => {
  const nested = obj({ page: obj({ cursor: text }), flags: arr(bool(), { maxItems: 2 }) });
  const installed = {
    catalog,
    capabilities: {
      ...capabilities,
      sources: { nested: { description: "Nested input", params: nested, result: bool() } },
    },
  };
  const doc = {
    ...manifest,
    sources: { queue: { source: "nested", params: { page: { cursor: "start" }, flags: [true, false] } } },
  };
  expect(validateManifest(doc, installed).ok).toBe(true);
  expect(
    validateManifest(
      { ...doc, sources: { queue: { source: "nested", params: { page: { cursor: true }, flags: [true] } } } },
      installed,
    ).ok,
  ).toBe(false);
  const ajv = new Ajv2020({ strict: true });
  ajv.addFormat("regex", { type: "string", validate: () => true });
  const oracle = ajv.compile(schemaDocument("manifest"));
  for (const cursor of [
    { from: "data", path: "cursor" },
    { from: "state" },
    { from: "state", path: "cursors.0" },
    { from: "state", path: "cursors.tasks", extra: 1 },
  ]) {
    expect(oracle(binding({ cursor, limit: "50" }))).toBe(false);
    expect(validateManifest(binding({ cursor, limit: "50" }), context).ok).toBe(false);
  }
});

const patternInput = {
  state: obj({ evil: str({ maxLength: 100, pattern: "^(a+)+$" }) }),
  initialState: { evil: "a" },
};

test("manifest_schemas_reject_patterns", () => {
  for (const key of ["params", "state", "context"] as const) {
    rejects({ ...manifest, ...patternInput, [key]: patternInput.state }, `/${key}/properties/evil/pattern`);
  }
  const nested = obj({ deep: arr(obj({ evil: str({ maxLength: 4, pattern: "^a$" }) }), { maxItems: 2 }) });
  for (const key of ["params", "state", "context"] as const) {
    rejects({ ...manifest, [key]: nested }, `/${key}/properties/deep/items/properties/evil/pattern`);
  }
  const shape = validateManifestShape({ ...manifest, ...patternInput });
  expect(shape.ok).toBe(false);
  if (!shape.ok)
    expect(shape.errors).toContainEqual(
      expect.objectContaining({
        kind: "invalid-document",
        pointer: "/state/properties/evil/pattern",
        expected: expect.stringContaining("no pattern in widget schemas"),
      }),
    );
  expect(validateManifest({ ...manifest, ...patternInput }, context).ok).toBe(false);
  expect(validateManifest(manifest, context).ok).toBe(true);
});

test("catalog_and_capability_patterns_still_install", () => {
  // The app owns these documents, and a catalog keeps its patterns.
  const first = catalog.definitions[0];
  if (!first) throw new Error("Fixture catalog has no definitions");
  const labelled = {
    ...first,
    props: {
      ...first.props,
      properties: { ...first.props.properties, label: str({ maxLength: 80, pattern: "^[a-z]+$" }) },
    },
  };
  expect(validateCatalog({ ...catalog, definitions: [labelled] }).ok).toBe(true);
  const patterned = {
    ...capabilities,
    actions: {
      "tasks.claim": { description: "Claim a task", args: obj({ id: str({ maxLength: 8, pattern: "^t-" }) }) },
    },
  };
  expect(validateCapabilities(patterned).ok).toBe(true);
  const doc = { ...manifest, sources: {}, actions: ["tasks.claim"] as const };
  expect(validateManifest(doc, { catalog, capabilities: patterned }).ok).toBe(true);
});

test("redos_manifest_fails_fast", () => {
  // "^(a+)+$" against 40 "a"s takes longer than any run would; rejection precedes matching.
  const doc = { ...manifest, state: patternInput.state, initialState: { evil: `${"a".repeat(40)}!` } };
  const start = performance.now();
  const result = validateManifest(doc, context);
  const elapsed = performance.now() - start;
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.map((error) => error.pointer)).toContain("/state/properties/evil/pattern");
  expect(elapsed).toBeLessThan(50);
});

test("published_manifest_schema_rejects_patterns", () => {
  const ajv = new Ajv2020({ strict: true });
  ajv.addFormat("regex", { type: "string", validate: () => true });
  const oracle = ajv.compile(schemaDocument("manifest"));
  expect(oracle(manifest)).toBe(true);
  for (const key of ["params", "state", "context"] as const)
    expect(oracle({ ...manifest, [key]: patternInput.state })).toBe(false);
  // Capabilities keep pattern: the app owns them, and the published schema agrees.
  const args = obj({ id: str({ maxLength: 8, pattern: "^t-" }) });
  const capabilityOracle = ajv.compile(schemaDocument("capabilities"));
  expect(capabilityOracle({ ...capabilities, actions: { "tasks.claim": { description: "Claim", args } } })).toBe(true);
});
