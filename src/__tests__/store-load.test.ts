import { expect, spyOn, test } from "bun:test";
import { pack, packageHash, verifyPackage, type WidgetPackage } from "@arnilo/liveframe/pack";
import { inProcessRunner } from "@arnilo/liveframe/preview";
import {
  loadPlacement,
  memoryStore,
  type Placement,
  type Store,
  verifiedPackages,
  verifyPlacementInputs,
} from "@arnilo/liveframe/store";
import * as packageFormat from "../formats/package.ts";
import { int, obj, type Result, str, validateCapabilities, validateCatalog } from "../index.ts";
import { freezeCopy } from "../internal.ts";
import * as hashing from "../pack/hash.ts";
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

test("load_placement_explicit_state_resets_like_stored", async () => {
  const store = await installed();
  const noRead: Store = {
    ...store,
    getState: async () => {
      throw new Error("State must not be read");
    },
  };
  for (const state of [{ count: 4 }, { count: "old" }, null, false, { count: Infinity }, undefined]) {
    const stored = await loadPlacement({ ...store, getState: async () => state as never }, "home", options);
    expect(await loadPlacement(noRead, "home", options, { state })).toEqual(stored);
  }
});

test("verify_placement_inputs_matches_load_placement", async () => {
  const store = await installed();
  for (const params of [placement.params, {}, { "a/~": 1 }]) {
    await store.putPlacement({ ...placement, params });
    for (const state of [{ count: 4 }, { count: "old" }, null, false, { count: Infinity }, undefined]) {
      const loaded = await loadPlacement(store, "home", options, { state });
      const expected = loaded.ok ? { ok: true, value: { ...loaded.value, package: undefined } } : loaded;
      const verified = verifyPlacementInputs(pkg, { params, state });
      expect(verified.ok ? { ok: true, value: { ...verified.value, package: undefined } } : verified).toEqual(expected);
    }
  }
});

test("load_placement_selects_scope_and_rejects_invalid_scope_before_reads", async () => {
  const store = await installed();
  await store.putState("home", "", { count: 1 });
  await store.putState("home", "viewer:42", { count: 42 });
  expect(value(await loadPlacement(store, "home", options)).state).toEqual({ count: 1 });
  expect(value(await loadPlacement(store, "home", options, { scope: "viewer:42" })).state).toEqual({ count: 42 });
  expect(value(await loadPlacement(store, "home", options, { scope: "absent" })).state).toEqual({ count: 0 });
  const noRead: Store = {
    ...store,
    getPlacement: async () => {
      throw new Error("Invalid scope must fail before I/O");
    },
  };
  rejects(
    await loadPlacement(noRead, "home", options, { scope: "x".repeat(129), state: { count: 1 } }),
    "invalid-document",
    "/scope",
  );
});

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
  await store.putState("home", "", { count: 4 });
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
  expect(await store.getState("home", "")).toEqual({ count: 4 });
  for (const state of [null, false, { count: Infinity }]) {
    const bad: Store = { ...store, getState: async () => state };
    const loaded = value(await loadPlacement(bad, "home", options));
    expect(loaded.state).toEqual({});
    expect(loaded.reset?.length).toBeGreaterThan(0);
    expect(loaded.reset?.length).toBeLessThanOrEqual(20);
  }
});

test("cache_hit_skips_reverification_but_checks_state", async () => {
  const store = await installed();
  const verified = verifiedPackages();
  const first = value(await loadPlacement(store, "home", options, { verified }));
  expect(Object.isFrozen(first.package.manifest)).toBe(true);
  await store.putState("home", "viewer", { count: 7 });
  const reordered = {
    catalog: Object.fromEntries(Object.entries(options.catalog).reverse()) as typeof options.catalog,
    capabilities: Object.fromEntries(Object.entries(options.capabilities).reverse()) as typeof options.capabilities,
  };
  const second = value(await loadPlacement(store, "home", reordered, { verified, scope: "viewer" }));
  expect(second.package).toBe(first.package);
  expect(second.state).toEqual({ count: 7 });
  const other = await installed();
  expect(value(await loadPlacement(other, "home", options, { verified })).package).toBe(first.package);
  expect(value(await loadPlacement(store, "home", options)).package).not.toBe(first.package);
  await store.putPlacement({ ...placement, params: { "a/~": 1 } });
  rejects(await loadPlacement(store, "home", options, { verified }), "invalid-prop", "/params/a~1~0");
  rejects(
    await loadPlacement({ ...store, getPlacement: async () => ({ ...placement, id: "wrong" }) }, "home", options, {
      verified,
    }),
    "invalid-document",
    "/id",
  );
});

test("changed_record_misses_cache_and_corrupt_record_still_fails", async () => {
  const store = await installed();
  const verified = verifiedPackages();
  const first = value(await loadPlacement(store, "home", options, { verified }));
  const changed = { ...pkg, code: `${pkg.code}\n// changed` };
  const rehashed = { ...changed, hash: packageHash(changed) };
  const loaded = value(
    await loadPlacement({ ...store, getPackage: async () => rehashed }, "home", options, { verified }),
  );
  expect(loaded.package).not.toBe(first.package);
  expect(loaded.package.code).toBe(rehashed.code);
  for (const corrupt of [
    null,
    { ...pkg, extra: true },
    { ...pkg, scenarios: [] },
    { ...pkg, manifest: { ...pkg.manifest, extra: true } },
  ]) {
    rejects(
      await loadPlacement({ ...store, getPackage: async () => corrupt as WidgetPackage }, "home", options, {
        verified,
      }),
      "invalid-document",
    );
  }
  const forbidden = { ...pkg, code: 'import x from "forbidden"; export default x;' };
  rejects(
    await loadPlacement(
      { ...store, getPackage: async () => ({ ...forbidden, hash: packageHash(forbidden) }) },
      "home",
      options,
      { verified },
    ),
    "forbidden-import",
  );
  for (const corrupt of [changed, { ...pkg, hash: `sha256-${"0".repeat(64)}` }]) {
    rejects(
      await loadPlacement({ ...store, getPackage: async () => corrupt }, "home", options, { verified }),
      "hash-mismatch",
      "/hash",
    );
  }
});

test("changed_install_documents_miss_cache", async () => {
  const store = await installed();
  const verified = verifiedPackages();
  const install = structuredClone(options);
  const first = value(await loadPlacement(store, "home", install, { verified }));
  Object.assign(install.capabilities, { actions: {}, sources: {} });
  const second = value(await loadPlacement(store, "home", install, { verified }));
  expect(second.package).not.toBe(first.package);
  Object.assign(install.catalog, { definitions: [...install.catalog.definitions].reverse() });
  const third = value(await loadPlacement(store, "home", install, { verified }));
  expect(third.package).not.toBe(second.package);
  Object.assign(install.catalog, { catalogId: "other@1" });
  rejects(await loadPlacement(store, "home", install, { verified }), "catalog-mismatch");
});

test("invalid_state_still_resets_with_cache", async () => {
  const store = await installed();
  const verified = verifiedPackages();
  const first = value(await loadPlacement(store, "home", options, { verified }));
  await store.putState("home", "", { count: "old" });
  const loaded = value(await loadPlacement(store, "home", options, { verified }));
  expect(loaded.package).toBe(first.package);
  expect(loaded.state).toEqual({ count: 0 });
  expect(loaded.reset).toContainEqual(expect.objectContaining({ kind: "invalid-prop", pointer: "/state/count" }));
  expect(await store.getState("home", "")).toEqual({ count: "old" });
});

test("verified_packages_lru_bound_and_invalid_max", () => {
  const cache = verifiedPackages({ max: 2 });
  cache.set("a", pkg);
  cache.set("b", pkg);
  expect(cache.get("a")).toBe(pkg);
  cache.set("c", pkg);
  expect(cache.get("b")).toBeUndefined();
  cache.set("a", pkg);
  cache.set("d", pkg);
  expect(cache.get("c")).toBeUndefined();
  for (const max of [0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => verifiedPackages({ max })).toThrow();
  }
  const defaults = verifiedPackages();
  for (let i = 0; i < 257; i++) defaults.set(String(i), pkg);
  expect(defaults.get("0")).toBeUndefined();
  expect(defaults.get("1")).toBe(pkg);
});

test("verified_hit_returns_the_cached_object_without_hashing", async () => {
  const store = await installed();
  const verified = verifiedPackages();
  const frozenInstall = freezeCopy(options);
  const first = value(await loadPlacement(store, "home", frozenInstall, { verified }));
  const hashed = spyOn(hashing, "packageHash");
  const shaped = spyOn(packageFormat, "validateWidgetPackageShape");
  const canonicalised = spyOn(hashing, "canonicalJson");
  try {
    const second = value(await loadPlacement(store, "home", frozenInstall, { verified }));
    expect(second.package).toBe(first.package);
    expect(hashed).toHaveBeenCalledTimes(0);
    expect(shaped).toHaveBeenCalledTimes(0);
    expect(canonicalised).toHaveBeenCalledTimes(0);

    // Documents that are not deeply frozen are canonicalised on every call, as before, while still skipping packageHash.
    const unfrozen = structuredClone(options);
    const third = value(await loadPlacement(store, "home", unfrozen, { verified }));
    expect(third.package).toBe(first.package);
    expect(hashed).toHaveBeenCalledTimes(0);
    expect(shaped).toHaveBeenCalledTimes(0);
    expect(canonicalised).toHaveBeenCalledTimes(2);
  } finally {
    hashed.mockRestore();
    shaped.mockRestore();
    canonicalised.mockRestore();
  }
});

test("record_differing_in_one_nested_value_misses", async () => {
  const store = await installed();
  const verified = verifiedPackages();
  const first = value(await loadPlacement(store, "home", options, { verified }));

  const changedScenario = {
    ...pkg,
    scenarios: [{ name: "default", params: { "a/~": "changed" }, context: {}, data: {} }],
  };
  const rehashedScenario = { ...changedScenario, hash: packageHash(changedScenario) };
  const invalidScenario = {
    ...pkg,
    scenarios: [{ name: "default", params: { "a/~": "x".repeat(20) }, context: {}, data: {} }],
  };
  const changedCode = { ...pkg, code: (pkg.code as string).replace("null", "0") };
  const rehashedCode = { ...changedCode, hash: packageHash(changedCode) };
  const addedTopKey = { ...pkg, extra: 1 };
  const addedManifestKey = { ...pkg, manifest: { ...pkg.manifest, extra: 1 } };
  const addedScenarioKey = {
    ...pkg,
    scenarios: [{ name: "default", params: { "a/~": "ok", extra: "1" }, context: {}, data: {} }],
  };

  for (const candidate of [
    changedScenario,
    rehashedScenario,
    invalidScenario,
    changedCode,
    rehashedCode,
    addedTopKey,
    addedManifestKey,
    addedScenarioKey,
  ]) {
    const loaded = await loadPlacement(
      { ...store, getPackage: async () => candidate as WidgetPackage },
      "home",
      options,
      { verified },
    );
    const direct = verifyPackage(candidate, options);
    if (!direct.ok) {
      expect<Result<unknown>>(loaded).toEqual(direct);
    } else {
      const unwrapped = value(loaded);
      expect(unwrapped.package).toEqual(direct.value);
      expect(unwrapped.package).not.toBe(first.package);
    }
  }
});

test("tampered_code_with_the_original_hash_is_hash_mismatch", async () => {
  const store = await installed();
  const verified = verifiedPackages();
  const first = value(await loadPlacement(store, "home", options, { verified }));
  const tampered: WidgetPackage = { ...pkg, code: `${pkg.code}\n// tampered`, hash: pkg.hash };
  const loaded = await loadPlacement({ ...store, getPackage: async () => tampered }, "home", options, { verified });
  rejects(loaded, "hash-mismatch", "/hash");
  // The failed load must not displace or taint the valid cached entry.
  expect(value(await loadPlacement(store, "home", options, { verified })).package).toBe(first.package);
});

test("same_package_under_another_install_misses", async () => {
  const store = await installed();
  const verified = verifiedPackages();
  const firstInstall = freezeCopy(options);
  const secondInstall = freezeCopy({
    ...options,
    capabilities: { ...options.capabilities, actions: {}, sources: {} },
  });
  const first = value(await loadPlacement(store, "home", firstInstall, { verified }));
  const hashed = spyOn(hashing, "packageHash");
  try {
    const second = value(await loadPlacement(store, "home", secondInstall, { verified }));
    expect(second.package).not.toBe(first.package);
    expect(hashed).toHaveBeenCalledTimes(1);
    const otherCatalog = freezeCopy({
      ...options,
      catalog: { ...options.catalog, catalogId: "other@1" },
    });
    rejects(await loadPlacement(store, "home", otherCatalog, { verified }), "catalog-mismatch", "/manifest/catalogId");
  } finally {
    hashed.mockRestore();
  }
});

test("runner_does_not_rehash_a_cached_package", async () => {
  const runnable = value(
    pack(
      {
        files: {
          "entry.ts":
            'import { primitive } from "@arnilo/liveframe/sdk"; import { jsx } from "@arnilo/liveframe/sdk/jsx-runtime"; const Stack = primitive("stack"); export default () => jsx(Stack, {});',
        },
        entry: "entry.ts",
        manifest,
        scenarios: pkg.scenarios,
      },
      options,
    ),
  );
  const store = memoryStore();
  await store.putPackage(runnable);
  await store.putPlacement(placement);
  const verified = verifiedPackages();
  const runner = inProcessRunner();
  const first = value(await loadPlacement(store, "home", options, { verified }));
  value(
    await runner.render(
      first.package,
      { params: first.params, state: first.state, context: {}, data: {}, actions: {} },
      { ...options, surfaceId: "home", revision: 1 },
    ),
  );
  const hashed = spyOn(hashing, "packageHash");
  try {
    const second = value(await loadPlacement(store, "home", options, { verified }));
    expect(second.package).toBe(first.package);
    const tree = value(
      await runner.render(
        second.package,
        { params: second.params, state: second.state, context: {}, data: {}, actions: {} },
        { ...options, surfaceId: "home", revision: 2 },
      ),
    );
    expect(tree.root.kind).toBe("stack");
    expect(hashed).toHaveBeenCalledTimes(0);
  } finally {
    hashed.mockRestore();
  }
});
