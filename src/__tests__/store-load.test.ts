import { expect, test } from "bun:test";
import { pack, type WidgetPackage, verifyPackage } from "@arnilo/liveframe/pack";
import { loadPlacement, memoryStore, type Placement, type Store } from "@arnilo/liveframe/store";
import { int, obj, str, type Result, validateCatalog, validateCapabilities } from "../index.ts";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "./fixtures/proof/capabilities.json" with { type: "json" };

function value<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
}
const options = {
  catalog: value(validateCatalog(catalogDoc)),
  capabilities: value(validateCapabilities(capabilitiesDoc)),
};
const manifest = {
  format: "liveframe-manifest/1",
  id: "counter",
  version: "1",
  catalogId: options.catalog.catalogId,
  params: obj({ "a/~": str({ maxLength: 10 }) }),
  state: obj({ count: int() }),
  initialState: { count: 0 },
  context: obj({}),
  sources: {},
  actions: [],
};
const files = { "entry.ts": 'throw new Error("must not run"); export default () => null;' };
const pkg = value(
  pack(
    {
      files,
      entry: "entry.ts",
      manifest,
      scenarios: [{ name: "default", params: { "a/~": "ok" }, context: {}, data: {} }],
    },
    options,
  ),
);
const placement: Placement = {
  id: "home",
  slot: "main",
  widget: { id: manifest.id, version: "1" },
  params: { "a/~": "ok" },
};

function rejects(r: Result<unknown>, kind: string, pointer?: string) {
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.errors).toContainEqual(expect.objectContaining({ kind, ...(pointer === undefined ? {} : { pointer }) }));
    expect(r.errors.length).toBeLessThanOrEqual(20);
  }
}
async function installed() {
  const store = memoryStore();
  await store.putPackage(pkg);
  await store.putPlacement(placement);
  return store;
}

test("load_placement_rejections", async () => {
  const store = memoryStore();
  rejects(await loadPlacement(store, "home", options), "not-found");
  await store.putPlacement(placement);
  rejects(await loadPlacement(store, "home", options), "not-found");
  const tampered = { ...pkg, code: `${pkg.code}\n// changed` };
  await store.putPackage(tampered);
  expect<Result<unknown>>(await loadPlacement(store, "home", options)).toEqual(verifyPackage(tampered, options));
  rejects(await loadPlacement(store, "home", options), "hash-mismatch", "/hash");

  const good = await installed();
  await good.putPlacement({ ...placement, params: { "a/~": 1 } });
  rejects(await loadPlacement(good, "home", options), "invalid-prop", "/params/a~1~0");
  for (const corrupt of [{ id: "home" }, null, { ...placement, params: { bad: undefined } }]) {
    const untrusted: Store = { ...good, getPlacement: async () => corrupt as Placement };
    rejects(await loadPlacement(untrusted, "home", options), "invalid-document");
  }
});

test("load_placement_checks_package_identity_and_passes_verification_errors", async () => {
  const store = await installed();
  for (const changed of [{ id: "other" }, { version: "2" }]) {
    const other = value(
      pack({ files, entry: "entry.ts", manifest: { ...manifest, ...changed }, scenarios: pkg.scenarios }, options),
    );
    const wrong: Store = { ...store, getPackage: async () => other };
    rejects(await loadPlacement(wrong, "home", options), "invalid-document", "/widget");
  }
  for (const corrupt of [null, { ...pkg, manifest: { ...pkg.manifest, catalogId: "wrong@1" } }]) {
    const bad: Store = { ...store, getPackage: async () => corrupt as WidgetPackage };
    expect<Result<unknown>>(await loadPlacement(bad, "home", options)).toEqual(verifyPackage(corrupt, options));
  }
});

test("load_placement_resets_state", async () => {
  const store = await installed();
  const expected = { package: pkg, params: placement.params, state: { count: 0 } };
  expect(value(await loadPlacement(store, "home", options))).toEqual(expected);
  await store.putState("home", { count: 4 });
  expect(value(await loadPlacement(store, "home", options))).toEqual({ ...expected, state: { count: 4 } });
  const next = value(
    pack(
      {
        files,
        entry: "entry.ts",
        manifest: { ...manifest, version: "2", state: obj({}), initialState: {} },
        scenarios: pkg.scenarios,
      },
      options,
    ),
  );
  await store.putPackage(next);
  await store.putPlacement({ ...placement, widget: { id: manifest.id, version: "2" } });
  const reset = value(await loadPlacement(store, "home", options));
  expect(reset).toMatchObject({ package: next, state: {}, reset: [{ kind: "invalid-prop", pointer: "/state/count" }] });
  expect(await store.getState("home")).toEqual({ count: 4 });
  for (const state of [null, false, { count: Infinity }]) {
    const bad: Store = { ...store, getState: async () => state };
    const loaded = value(await loadPlacement(bad, "home", options));
    expect(loaded.state).toEqual({});
    expect(loaded.reset?.length).toBeGreaterThan(0);
    expect(loaded.reset?.length).toBeLessThanOrEqual(20);
  }
});
