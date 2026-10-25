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

test("initial_state_matches_schema", () => {
  rejects({ ...manifest, initialState: { cursors: { tasks: true }, flag: false } }, "/initialState/cursors/tasks");
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
