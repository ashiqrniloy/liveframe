import { expect, test } from "bun:test";
import { pack, verifyPackage, type WidgetPackage } from "@arnilo/liveframe/pack";
import { loadPlacement, memoryStore, type Placement, verifyPlacementInputs } from "@arnilo/liveframe/store";
import { int, obj, type Result, str, validateCapabilities, validateCatalog, validateManifest } from "../index.ts";
import capabilitiesDoc from "./fixtures/proof/capabilities.json" with { type: "json" };
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };

function value<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
}
const options = {
  catalog: value(validateCatalog(catalogDoc)),
  capabilities: value(validateCapabilities(capabilitiesDoc)),
};
// Version 1 stored `filter: "mine"`; version 2 stores `scope.owner` (the demo's upgrade).
const mine = { $eq: [{ $path: "previous.filter" }, { $lit: "mine" }] };
const migrateState = { scope: { $cond: [mine, { $lit: { owner: "me" } }, { $lit: { owner: null } }] } };
const manifest = {
  format: "liveframe-manifest/1",
  id: "queue",
  version: "2",
  catalogId: options.catalog.catalogId,
  params: obj({}),
  state: obj({ scope: obj({ owner: str({ maxLength: 16, nullable: true }) }), page: int() }),
  initialState: { scope: { owner: null }, page: 1 },
  context: obj({}),
  sources: {},
  actions: [],
  migrateState,
};
const files = { "entry.ts": "export default () => null;" };
const scenarios = [{ name: "default", params: {}, context: {}, data: {} }];
function packed(extra: Record<string, unknown> = {}): WidgetPackage {
  return value(pack({ files, entry: "entry.ts", manifest: { ...manifest, ...extra }, scenarios }, options));
}
const placement: Placement = { id: "q", slot: "main", widget: { id: "queue", version: "2" }, params: {} };
async function loadWith(state: unknown, pkg = packed()) {
  const store = memoryStore();
  await store.putPackage(pkg);
  await store.putPlacement(placement);
  return loadPlacement(store, "q", options, { state });
}

test("migration_applies_when_state_fails", async () => {
  const loaded = value(await loadWith({ filter: "mine", page: 3 }));
  // Only declared keys are overlaid on the initial state; `page` is not carried over implicitly.
  expect(loaded.state).toEqual({ scope: { owner: "me" }, page: 1 });
  expect(loaded.reset).toBeUndefined();
  expect(loaded.migrated?.length).toBeGreaterThan(0);
  expect(loaded.migrated?.[0]?.pointer).toStartWith("/state");
  expect(value(await loadWith({ filter: "all" })).state).toEqual({ scope: { owner: null }, page: 1 });
});

test("valid_stored_state_is_not_migrated", async () => {
  const loaded = value(await loadWith({ scope: { owner: "ann" }, page: 2 }));
  expect(loaded.state).toEqual({ scope: { owner: "ann" }, page: 2 });
  expect(loaded.migrated).toBeUndefined();
  expect(loaded.reset).toBeUndefined();
});

test("verify_placement_inputs_migrates_like_load_placement", async () => {
  const pkg = packed();
  for (const state of [{ filter: "mine" }, { filter: 1 }, null, [], { scope: 4 }]) {
    const loaded = value(await loadWith(state, pkg));
    const verified = value(verifyPlacementInputs(pkg, { params: {}, state }));
    expect({ ...loaded, package: undefined }).toEqual({ ...verified, package: undefined });
  }
});

test("failed_migration_falls_back_to_reset", async () => {
  // The expression is well formed but yields a value the state schema refuses.
  const bad = packed({ migrateState: { scope: { $lit: { owner: "a name longer than sixteen" } } } });
  const loaded = value(await loadWith({ filter: "mine" }, bad));
  expect(loaded.state).toEqual({ scope: { owner: null }, page: 1 });
  expect(loaded.migrated).toBeUndefined();
  expect(loaded.reset?.length).toBeGreaterThan(0);
  // A stored value that is not JSON never reaches an expression.
  const notJson = value(await loadWith({ filter: Infinity }));
  expect(notJson.migrated).toBeUndefined();
  expect(notJson.reset?.length).toBeGreaterThan(0);
  // A runtime failure inside the expression also resets, never throws.
  const failing = packed({
    migrateState: { scope: { $lit: { owner: null } }, page: { $div: [{ $lit: 1 }, { $lit: 0 }] } },
  });
  const reset = value(await loadWith({ filter: "mine" }, failing));
  expect(reset.reset?.length).toBeGreaterThan(0);
});

test("no_migrate_state_resets_as_before", async () => {
  const { migrateState: _omit, ...rest } = manifest;
  const plain = value(pack({ files, entry: "entry.ts", manifest: rest, scenarios }, options));
  const loaded = value(await loadWith({ filter: "mine" }, plain));
  expect(loaded.state).toEqual(manifest.initialState);
  expect(loaded.reset?.length).toBeGreaterThan(0);
  expect(loaded.migrated).toBeUndefined();
});

function rejects(doc: unknown, pointer: string, kind: string) {
  const result = validateManifest(doc, options);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ pointer, kind }));
}

test("migrate_key_not_in_state_schema_rejected", () => {
  rejects({ ...manifest, migrateState: { missing: { $lit: 1 } } }, "/migrateState/missing", "unknown-name");
  // pack and verifyPackage reach the same check.
  const result = pack(
    { files, entry: "entry.ts", manifest: { ...manifest, migrateState: { missing: { $lit: 1 } } }, scenarios },
    options,
  );
  expect(result.ok).toBe(false);
});

test("migration_cannot_read_data_root", () => {
  for (const root of ["data", "params", "state", "context", "actions"]) {
    const result = validateManifest({ ...manifest, migrateState: { page: { $path: `${root}.x` } } }, options);
    expect(result.ok).toBe(false);
  }
  expect(validateManifest(manifest, options).ok).toBe(true);
});

test("migrate_state_expression_shape_and_bounds_checked", () => {
  rejects({ ...manifest, migrateState: { page: { $nope: 1 } } }, "/migrateState/page/$nope", "invalid-document");
  let deep: unknown = { $lit: 1 };
  for (let i = 0; i < 40; i++) deep = { $coalesce: [deep, { $lit: 1 }] };
  const result = validateManifest({ ...manifest, migrateState: { page: deep } }, options);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ kind: "limit-exceeded" }));
  const many = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, { $lit: 1 }]));
  expect(validateManifest({ ...manifest, migrateState: many }, options).ok).toBe(false);
});

test("migrate_state_is_in_the_package_hash", () => {
  const a = packed();
  const b = packed({ migrateState: { page: { $lit: 2 } } });
  expect(a.hash).not.toBe(b.hash);
  expect(verifyPackage(a, options).ok).toBe(true);
  expect(verifyPackage({ ...a, manifest: { ...a.manifest, migrateState: {} } }, options).ok).toBe(false);
});
