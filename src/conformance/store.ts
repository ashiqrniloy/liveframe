import { loadPlacement, type Store } from "../store/index.ts";
import { check, type ConformanceCase, ConformanceFailure } from "./case.ts";
import { storeFixture } from "./fixture.ts";

// Compare JSON records independent of the backend's object-key order.
function json(value: unknown): string | undefined {
  return JSON.stringify(value, (_, entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.keys(entry)
            .sort()
            .map((key) => [key, entry[key]]),
        )
      : entry,
  );
}

/** Each create call must open a fresh, empty scope; reopen opens that same scope again. */
export function storeSuite({
  create,
  reopen,
}: {
  create(): Store | Promise<Store>;
  reopen?(store: Store): Store | Promise<Store>;
}): ConformanceCase[] {
  const cases: ConformanceCase[] = [];
  function add(
    suffix: string,
    run: (store: Store, equal: (actual: unknown, expected: unknown, detail: string) => void) => Promise<void>,
  ) {
    const name = `store_${suffix}`;
    cases.push({
      name,
      async run() {
        try {
          await run(await create(), (actual, expected, detail) =>
            check(json(actual) === json(expected), name, "§7.4", [detail]),
          );
        } catch (error) {
          if (error instanceof ConformanceFailure) throw error;
          throw new ConformanceFailure(name, "§7.4", [
            error instanceof Error ? error.message : "Store operation rejected",
          ]);
        }
      },
    });
  }
  add("opens_empty_and_returns_undefined_for_missing_records", async (store, equal) => {
    equal(await store.listPlacements(), [], "A new scope must have no placements");
    equal(await store.getPackage("missing", "1"), undefined, "Missing package must be undefined");
    equal(await store.getState("missing"), undefined, "Missing state must be undefined");
    for (const kind of ["theme", "designSystem"] as const)
      equal(await store.getStyle(kind, "missing", "1"), undefined, "Missing style must be undefined");
    await store.putPlacement(storeFixture().placement);
    equal(await (await create()).listPlacements(), [], "create must open an independent empty scope");
  });
  add("rejects_a_second_hash_for_an_existing_version", async (store, equal) => {
    const { pkg } = storeFixture();
    await store.putPackage(pkg);
    let kind: unknown;
    try {
      await store.putPackage({ ...pkg, hash: `sha256-${"0".repeat(64)}` });
    } catch (error) {
      if (typeof error === "object" && error !== null && "kind" in error) kind = error.kind;
    }
    equal(kind, "version-conflict", "Changed hashes must reject with version-conflict");
    equal(await store.getPackage(pkg.manifest.id, pkg.manifest.version), pkg, "Conflict must preserve the original");
    const next = { ...pkg, manifest: { ...pkg.manifest, version: "2" } };
    await store.putPackage(next);
    equal(await store.getPackage(next.manifest.id, "2"), next, "Different versions must coexist");
    equal(await store.getPackage(pkg.manifest.id, pkg.manifest.version), pkg, "New versions must preserve old ones");
  });
  add("ignores_a_same_hash_put", async (store, equal) => {
    const { pkg } = storeFixture();
    await store.putPackage(pkg);
    await store.putPackage({ ...pkg, code: "ignored same-hash content" });
    equal(
      await store.getPackage(pkg.manifest.id, pkg.manifest.version),
      pkg,
      "Same-hash puts must preserve the original",
    );
  });
  add("copies_every_record_on_put_and_get", async (store, equal) => {
    const { pkg, placement, style } = storeFixture();
    const input = JSON.parse(JSON.stringify(pkg));
    await store.putPackage(input);
    input.manifest.id = "changed";
    const read = await store.getPackage(pkg.manifest.id, pkg.manifest.version);
    equal(read, pkg, "Package put must copy nested records");
    if (read) (read.scenarios[0] as { name: string }).name = "changed";
    equal(await store.getPackage(pkg.manifest.id, pkg.manifest.version), pkg, "Package get must copy nested records");
    const placed = { ...placement, params: { nested: [1] } };
    await store.putPlacement(placed);
    placed.params.nested.push(2);
    const listed = await store.listPlacements();
    equal(listed[0]?.params, { nested: [1] }, "Placement put must copy nested params");
    if (listed[0]) (listed[0].params as { nested: number[] }).nested.push(3);
    equal((await store.listPlacements())[0]?.params, { nested: [1] }, "Placement list must copy nested params");
    const state = { nested: [1] };
    await store.putState(placement.id, state);
    state.nested.push(2);
    const saved = await store.getState(placement.id);
    equal(saved, { nested: [1] }, "State put must copy nested values");
    (saved as typeof state).nested.push(3);
    equal(await store.getState(placement.id), { nested: [1] }, "State get must copy nested values");
    await store.putStyle(style);
    style.body.nested.push(2);
    const styled = await store.getStyle(style.kind, style.id, style.version);
    equal(styled?.body, { nested: [1] }, "Style put must copy nested values");
    if (styled) (styled.body as typeof state).nested.push(3);
    equal(
      (await store.getStyle(style.kind, style.id, style.version))?.body,
      { nested: [1] },
      "Style get must copy nested values",
    );
  });
  add("lists_placements_sorted_and_replaces_by_id", async (store, equal) => {
    const { placement } = storeFixture();
    await store.putPlacement(placement);
    await store.putPlacement({ ...placement, id: "a" });
    await store.putPlacement({ ...placement, slot: "other" });
    equal(
      await store.listPlacements(),
      [
        { ...placement, id: "a" },
        { ...placement, slot: "other" },
      ],
      "Placements must sort by id and replace rather than duplicate",
    );
  });
  add("keeps_null_and_false_state_distinct_from_missing", async (store, equal) => {
    for (const state of [null, false]) {
      await store.putState("home", state);
      equal(await store.getState("home"), state, "Null and false are stored values");
      equal(await store.getState("missing"), undefined, "Missing state must remain undefined");
    }
  });
  add("keys_styles_by_kind_id_and_version", async (store, equal) => {
    const { style } = storeFixture();
    const styles = [
      style,
      { ...style, version: "2" },
      { ...style, id: "other" },
      { ...style, kind: "designSystem" as const },
    ];
    for (const record of styles) await store.putStyle(record);
    for (const record of styles)
      equal(
        await store.getStyle(record.kind, record.id, record.version),
        record,
        "Style keys must include kind, id and version",
      );
  });
  add("deletes_state_with_its_placement", async (store, equal) => {
    const { pkg, placement } = storeFixture();
    await store.putPackage(pkg);
    await store.putPlacement(placement);
    await store.putPlacement({ ...placement, id: "other" });
    await store.putState("other", false);
    for (const id of [placement.id, "orphan"]) {
      await store.putState(id, 1);
      await store.deletePlacement(id);
      equal(await store.getState(id), undefined, "Deletion must remove state including orphan state");
    }
    await store.deletePlacement(placement.id);
    equal(
      await store.listPlacements(),
      [{ ...placement, id: "other" }],
      "Deletion must remove only the named placement",
    );
    equal(await store.getState("other"), false, "Deletion must preserve unrelated state");
    equal(await store.getPackage(pkg.manifest.id, pkg.manifest.version), pkg, "Deletion must preserve packages");
  });
  add("records_load_through_load_placement", async (store, equal) => {
    const { pkg, placement, options } = storeFixture();
    await store.putPackage(pkg);
    await store.putPlacement(placement);
    const expected = { package: pkg, params: placement.params, state: pkg.manifest.initialState };
    equal(
      await loadPlacement(store, placement.id, options),
      { ok: true, value: expected },
      "Stored records must verify and load",
    );
    await store.putState(placement.id, { count: 4 });
    equal(
      await loadPlacement(store, placement.id, options),
      { ok: true, value: { ...expected, state: { count: 4 } } },
      "Valid stored state must load",
    );
    await store.putState(placement.id, { count: "outdated" });
    const reset = await loadPlacement(store, placement.id, options);
    check(reset.ok, "store_records_load_through_load_placement", "§7.4", reset.ok ? [] : reset.errors);
    equal({ ...reset.value, reset: undefined }, expected, "Invalid state must reset to initial state");
    check(
      reset.value.reset?.some((error) => error.pointer === "/state/count"),
      "store_records_load_through_load_placement",
      "§7.4",
      ["State reset must report the invalid field"],
    );
    equal(await store.getState(placement.id), { count: "outdated" }, "Loading must not persist the reset");
  });
  if (reopen)
    add("records_survive_reopen", async (store, equal) => {
      const { pkg, placement, style } = storeFixture();
      await store.putPackage(pkg);
      await store.putPlacement(placement);
      await store.putState(placement.id, { count: 3 });
      await store.putStyle(style);
      const opened = await reopen(store);
      equal(await opened.getPackage(pkg.manifest.id, pkg.manifest.version), pkg, "Package must survive reopen");
      equal(await opened.listPlacements(), [placement], "Placement must survive reopen");
      equal(await opened.getState(placement.id), { count: 3 }, "State must survive reopen");
      equal(await opened.getStyle(style.kind, style.id, style.version), style, "Style must survive reopen");
    });
  return cases;
}
