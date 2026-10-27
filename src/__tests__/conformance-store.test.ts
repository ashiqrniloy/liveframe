import { expect, test } from "bun:test";
import { ConformanceFailure, storeSuite, type ConformanceCase } from "@arnilo/liveframe/conformance";
import { memoryStore, type Store } from "@arnilo/liveframe/store";

const rule = (suffix: string) => `store_${suffix}`;
async function fails(create: () => Store, suffix: string, reopen?: (store: Store) => Store) {
  const name = rule(suffix);
  const c = storeSuite({ create, ...(reopen ? { reopen } : {}) }).find((c) => c.name === name);
  expect(c).toBeDefined();
  if (!c) throw new Error("Missing conformance case");
  try {
    await c.run();
    throw new Error("Mutant passed");
  } catch (error) {
    expect(error).toBeInstanceOf(ConformanceFailure);
    expect(error).toMatchObject({ rule: name, spec: "§7.4" });
    expect((error as ConformanceFailure).details.length).toBeGreaterThan(0);
  }
}

test("store_suite_catches_broken_stores", async () => {
  await fails(() => {
    const store = memoryStore();
    let saved: Parameters<Store["putState"]>[2];
    return {
      ...store,
      putState: async (_, _scope, state) => {
        saved = state;
      },
      getState: async () => saved,
    };
  }, "copies_every_record_on_put_and_get");
  await fails(() => {
    let saved: Parameters<Store["putPackage"]>[0];
    return {
      ...memoryStore(),
      putPackage: async (pkg) => {
        saved = pkg;
      },
      getPackage: async () => saved,
    };
  }, "rejects_a_second_hash_for_an_existing_version");
  await fails(() => {
    const store = memoryStore();
    return {
      ...store,
      async deletePlacement(id) {
        const state = await store.getState(id, "");
        await store.deletePlacement(id);
        if (state !== undefined) await store.putState(id, "", state);
      },
    };
  }, "deletes_state_with_its_placement");
  await fails(() => {
    const store = memoryStore();
    return { ...store, listPlacements: async () => (await store.listPlacements()).reverse() };
  }, "lists_placements_sorted_and_replaces_by_id");
  await fails(memoryStore, "records_survive_reopen", () => memoryStore());
});

test("store_suite_cases_are_independent_and_runner_agnostic", async () => {
  const cases: ConformanceCase[] = storeSuite({ create: async () => memoryStore() });
  expect(cases).toHaveLength(16);
  expect(new Set(cases.map((c) => c.name)).size).toBe(16);
  await Promise.all(cases.map((c) => c.run()));
  const reopened = storeSuite({ create: memoryStore, reopen: async (store) => store });
  expect(reopened).toHaveLength(17);
  await Promise.all(reopened.map((c) => c.run()));
});

test("store_suite_catches_scope_leaks_and_incomplete_deletion", async () => {
  await fails(() => {
    const store = memoryStore();
    return {
      ...store,
      putState: (id, _scope, state) => store.putState(id, "", state),
      getState: (id, _scope) => store.getState(id, ""),
    };
  }, "scoped_state_is_isolated");
  await fails(() => {
    const store = memoryStore();
    return {
      ...store,
      async deletePlacement(id) {
        const saved = await store.getState(id, "viewer:42");
        await store.deletePlacement(id);
        if (saved !== undefined) await store.putState(id, "viewer:42", saved);
      },
    };
  }, "delete_placement_removes_all_scopes");
  await fails(() => {
    const store = memoryStore();
    return {
      ...store,
      getState: (id, scope) => store.getState(id, typeof scope === "string" ? scope.slice(0, 128) : ""),
    };
  }, "scope_bound_enforced");
});

test("store_suite_wraps_adapter_errors_and_bounds_details", async () => {
  await fails(() => {
    throw new Error("offline");
  }, "opens_empty_and_returns_undefined_for_missing_records");
  const failure = new ConformanceFailure("rule", "§7.4", Array(30).fill("x".repeat(3000)));
  expect(failure.name).toBe("ConformanceFailure");
  expect(failure.details).toHaveLength(20);
  expect((failure.details[0] as string).length).toBeLessThanOrEqual(2000);
});

test("store_suite_catches_missing_values_style_collisions_and_corrupt_loads", async () => {
  await fails(
    () => ({ ...memoryStore(), getPackage: async () => null as never }),
    "opens_empty_and_returns_undefined_for_missing_records",
  );
  await fails(
    () => ({ ...memoryStore(), getState: async () => undefined }),
    "keeps_null_and_false_state_distinct_from_missing",
  );
  await fails(() => {
    let saved: Parameters<Store["putStyle"]>[0];
    return {
      ...memoryStore(),
      putStyle: async (style) => {
        saved = style;
      },
      getStyle: async () => saved,
    };
  }, "keys_styles_by_kind_id_and_version");
  await fails(() => {
    const store = memoryStore();
    return {
      ...store,
      async getPackage(id, version) {
        const pkg = await store.getPackage(id, version);
        return pkg && { ...pkg, code: `${pkg.code}// corrupted` };
      },
    };
  }, "records_load_through_load_placement");
  await fails(() => {
    let saved: Parameters<Store["putPackage"]>[0];
    return {
      ...memoryStore(),
      putPackage: async (pkg) => {
        saved = pkg;
      },
      getPackage: async () => saved,
    };
  }, "ignores_a_same_hash_put");
});
