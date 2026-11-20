// 0.3.x patches compare against the 0.3.0 tag baseline through an additive-only 0.3.1 register.
// The 0.2.3 baseline and 0.3.0 register remain in scripts/release/api/ as release history.
import { expect, test } from "bun:test";
import { resolve } from "node:path";
import baselineJson from "../../scripts/release/api/0.3.0.json" with { type: "json" };
import runnerBaselineJson from "../../scripts/release/api/0.3.0-runner-quickjs.json" with { type: "json" };
import starterBaselineJson from "../../scripts/release/api/0.3.0-starter.json" with { type: "json" };
import register030Json from "../../scripts/release/api/register-0.3.0.json" with { type: "json" };
import registerJson from "../../scripts/release/api/register-0.3.1.json" with { type: "json" };
import register040Json from "../../scripts/release/api/register-0.4.0.json" with { type: "json" };
import starterRegister040Json from "../../scripts/release/api/register-0.4.0-starter.json" with { type: "json" };
import {
  type ApiSurface,
  compareApiSurface,
  type RegisterEntry,
  readApiSurface,
} from "../../scripts/release/api-surface.ts";

const root = resolve(import.meta.dir, "../..");
const baseline = baselineJson as unknown as ApiSurface;
const register = registerJson as unknown as readonly RegisterEntry[];
const register030 = register030Json as unknown as readonly RegisterEntry[];
const register040 = register040Json as unknown as readonly RegisterEntry[];
const starterRegister040 = starterRegister040Json as unknown as readonly RegisterEntry[];
const migrationGuides = await Promise.all(
  ["migration-0.3.md", "migration-0.4.md"].map((name) => Bun.file(resolve(root, "docs", name)).text()),
);
const releaseMigration = migrationGuides.join("\n");

/** Layers the 0.4.0 register over the 0.3.1 patch register while 0.3.0 remains the on-disk baseline. */
function combineRegisters(patch: readonly RegisterEntry[], minor: readonly RegisterEntry[]): readonly RegisterEntry[] {
  const merged = new Map<string, RegisterEntry>();
  for (const entry of patch) merged.set(`${entry.subpath}\0${entry.name}`, entry);
  for (const entry of minor) merged.set(`${entry.subpath}\0${entry.name}`, entry);
  return [...merged.values()];
}

const fixture: ApiSurface = {
  exports: {
    ".": {
      states: 'states: readonly [ "rest", "hover" ]',
      validateCatalog: "export declare function validateCatalog(doc: unknown): Result<Catalog>;",
    },
    "./react": {
      createRenderer: "export declare function createRenderer(): { Surface: (props: SurfaceProps) => Element };",
    },
  },
  schemas: {
    "schemas/design-system.json": "aaa111",
    "schemas/ui-tree.json": "bbb222",
  },
  corpus: {
    "conformance/corpus/ui-tree/valid.json": "ccc333",
  },
  hash: {
    "conformance/hash/numbers.json": "ddd444",
  },
  patch: {
    "conformance/patch/diff.json": "eee555",
  },
};

test("baseline_0_3_0_matches_the_checkout_through_the_0_3_1_register", async () => {
  expect(baseline.generatedFrom).toContain("v0.3.0");
  const current = await readApiSurface(root);
  expect(compareApiSurface(baseline, current, combineRegisters(register, register040), releaseMigration)).toEqual([]);
}, 20_000);

test("register_0_4_0_is_read_by_the_api_gate", async () => {
  expect(Array.isArray(register040)).toBe(true);
  expect(register040.length).toBeGreaterThan(0);
  const current = await readApiSurface(root);
  expect(compareApiSurface(baseline, current, register).length).toBeGreaterThan(0);
  expect(compareApiSurface(baseline, current, combineRegisters(register, register040), releaseMigration)).toEqual([]);
}, 20_000);

test("register_0_3_1_holds_only_additive_entries", () => {
  for (const entry of register) {
    expect(entry.change === "added" || entry.change === "widened").toBe(true);
  }
});

test("baseline_0_3_0_matches_the_companion_packages", async () => {
  // The two companion packages release with the core; the starter's generated primitives change only through
  // its own 0.4.0 register, kept beside the core's.
  for (const [dir, json, entries] of [
    ["packages/runner-quickjs", runnerBaselineJson, []],
    ["packages/starter", starterBaselineJson, starterRegister040],
  ] as const) {
    const baseline = json as unknown as ApiSurface;
    expect(baseline.generatedFrom).toContain("0.3.0");
    expect(compareApiSurface(baseline, await readApiSurface(resolve(root, dir)), entries)).toEqual([]);
  }
}, 20_000);

// Placeholder until 0.4.0: `@arnilo/liveframe-a2ui` is new, so it has no tag baseline yet. Its release generates
// `scripts/release/api/0.4.0-a2ui.json` and this test then compares against it like the two companions above.
test("a2ui_package_exports_only_the_converter_until_its_baseline", async () => {
  const surface = await readApiSurface(resolve(root, "packages/a2ui"));
  expect(Object.keys(surface.exports)).toEqual(["."]);
  expect(Object.keys(surface.exports["."] ?? {}).sort()).toEqual([
    "A2uiComponent",
    "A2uiConversion",
    "A2uiItem",
    "A2uiMapping",
    "A2uiOptions",
    "fromA2ui",
  ]);
}, 20_000);

test("removed_export_fails", () => {
  const current: ApiSurface = {
    ...fixture,
    exports: {
      ...fixture.exports,
      ".": { states: 'states: readonly [ "rest", "hover" ]' },
    },
  };
  expect(compareApiSurface(fixture, current, [])).toEqual(["Removed export: . validateCatalog"]);
});

test("changed_declaration_without_entry_fails", () => {
  const current: ApiSurface = {
    ...fixture,
    exports: {
      ...fixture.exports,
      ".": {
        ...fixture.exports["."],
        states: 'states: readonly [ "rest", "hover", "pending" ]',
      },
    },
  };
  expect(compareApiSurface(fixture, current, [])).toEqual(["Declaration changed without a register entry: . states"]);
  expect(
    compareApiSurface(fixture, current, [
      {
        subpath: ".",
        name: "states",
        change: "widened",
        reason: "adds pending",
        hostAction: "none",
        task: 8,
      },
    ]),
  ).toEqual([]);
});

test("stale_register_entry_fails", () => {
  expect(
    compareApiSurface(fixture, fixture, [
      {
        subpath: ".",
        name: "states",
        change: "widened",
        reason: "adds pending",
        hostAction: "none",
        task: 8,
      },
    ]),
  ).toEqual(["Stale register entry (declaration did not change): . states"]);

  expect(
    compareApiSurface(fixture, fixture, [
      {
        subpath: ".",
        name: "bindSources",
        change: "added",
        reason: "new helper",
        hostAction: "none",
        task: 5,
      },
    ]),
  ).toEqual(["Stale register entry (target not found or unchanged): . bindSources"]);

  expect(
    compareApiSurface(
      fixture,
      {
        ...fixture,
        schemas: { ...fixture.schemas, "schemas/design-system.json": "changed" },
      },
      [],
    ),
  ).toEqual(["Schema changed without a register entry: schemas/design-system.json"]);
});

test("changed_corpus_file_fails", () => {
  const changedCorpus: ApiSurface = {
    ...fixture,
    corpus: { "conformance/corpus/ui-tree/valid.json": "tampered" },
  };
  expect(compareApiSurface(fixture, changedCorpus, [])).toEqual([
    "Changed corpus file: conformance/corpus/ui-tree/valid.json",
  ]);

  const changedHash: ApiSurface = {
    ...fixture,
    hash: { "conformance/hash/numbers.json": "tampered" },
  };
  expect(compareApiSurface(fixture, changedHash, [])).toEqual(["Changed hash file: conformance/hash/numbers.json"]);

  const changedPatch: ApiSurface = {
    ...fixture,
    patch: { "conformance/patch/diff.json": "tampered" },
  };
  expect(compareApiSurface(fixture, changedPatch, [])).toEqual(["Changed patch file: conformance/patch/diff.json"]);
});

test("deferred_entry_with_shipped_change_fails", () => {
  const deferredExisting: RegisterEntry = {
    subpath: ".",
    name: "states",
    change: "deferred",
    reason: "moved to 0.3.0",
    hostAction: "none",
    task: 8,
  };
  // Unchanged declaration with a deferred entry is allowed.
  expect(compareApiSurface(fixture, fixture, [deferredExisting])).toEqual([]);

  // Changed declaration with a deferred entry fails.
  const changedExisting: ApiSurface = {
    ...fixture,
    exports: {
      ...fixture.exports,
      ".": { ...fixture.exports["."], states: 'states: readonly [ "rest" ]' },
    },
  };
  expect(compareApiSurface(fixture, changedExisting, [deferredExisting])).toEqual([
    "Deferred register entry shipped a declaration change: . states (task 8)",
  ]);

  // Added export with a deferred entry fails if it actually shipped.
  const deferredNew: RegisterEntry = {
    subpath: ".",
    name: "nodeRef",
    change: "deferred",
    reason: "moved to 0.3.0",
    hostAction: "none",
    task: 10,
  };
  expect(compareApiSurface(fixture, fixture, [deferredNew])).toEqual([]);
  const shippedNew: ApiSurface = {
    ...fixture,
    exports: {
      ...fixture.exports,
      ".": { ...fixture.exports["."], nodeRef: "export declare function nodeRef(): LanguageSchema;" },
    },
  };
  expect(compareApiSurface(fixture, shippedNew, [deferredNew])).toEqual([
    "Deferred register entry shipped a new export: . nodeRef (task 10)",
  ]);
});

test("register_host_actions_appear_in_adopter_notes", async () => {
  const adopters = await Bun.file(resolve(root, "docs/migration-0.3.md")).text();
  for (const entry of register030) {
    expect(adopters).toContain(entry.hostAction);
  }
});

const breaking: RegisterEntry = {
  subpath: ".",
  name: "validateCatalog",
  change: "removed",
  reason: "fixture removal",
  hostAction: "use the replacement",
  task: "026 T1",
  migration: "Removed validator",
};
const migration = "# Migrating\n\n## Breaking changes\n\n### Removed validator\n";
const removed: ApiSurface = {
  ...fixture,
  exports: { ...fixture.exports, ".": { states: fixture.exports["."]?.states as string } },
};

test("register_break_without_migration_heading_fails", () => {
  const { migration: _, ...withoutMigration } = breaking;
  expect(compareApiSurface(fixture, removed, [withoutMigration], migration).join("\n")).toContain(
    "Migration heading not found",
  );
  for (const heading of ["", "   ", "Unknown heading"]) {
    expect(compareApiSurface(fixture, removed, [{ ...breaking, migration: heading }], migration).join("\n")).toContain(
      "Migration heading not found",
    );
  }
  expect(compareApiSurface(fixture, removed, [breaking], `Example: ${breaking.migration}`)).not.toEqual([]);
  expect(compareApiSurface(fixture, removed, [breaking], `\`\`\`md\n${migration}\`\`\`\n`)).not.toEqual([]);
  expect(compareApiSurface(fixture, removed, [breaking], migration)).toEqual([]);
});

test("register_removed_entry_for_existing_export_fails", () => {
  expect(compareApiSurface(fixture, fixture, [breaking], migration)).toEqual([
    "Stale register entry (declaration did not change): . validateCatalog",
  ]);
});

test("register_changed_requires_a_changed_declaration_and_heading", () => {
  const entry: RegisterEntry = { ...breaking, change: "changed" };
  const current: ApiSurface = {
    ...fixture,
    exports: { ...fixture.exports, ".": { ...fixture.exports["."], validateCatalog: "changed declaration" } },
  };
  expect(compareApiSurface(fixture, current, [entry], migration)).toEqual([]);
  expect(compareApiSurface(fixture, current, [entry], "").join("\n")).toContain("Migration heading not found");
  expect(compareApiSurface(fixture, fixture, [entry], migration)).toEqual([
    "Stale register entry (declaration did not change): . validateCatalog",
  ]);
  expect(compareApiSurface(fixture, current, [breaking], migration)).not.toEqual([]);
  expect(compareApiSurface(fixture, removed, [entry], migration)).not.toEqual([]);
});

test("registered_removal_of_a_whole_subpath_passes", () => {
  const current = { ...fixture, exports: { ".": fixture.exports["."] as Record<string, string> } };
  const entry = { ...breaking, subpath: "./react", name: "createRenderer" };
  expect(compareApiSurface(fixture, current, [entry], migration)).toEqual([]);
  expect(compareApiSurface(fixture, current, [], migration)).not.toEqual([]);
});

test("schemas_and_vectors_require_matching_break_entries", () => {
  for (const group of ["schemas", "corpus", "hash", "patch"] as const) {
    const file = Object.keys(fixture[group])[0] as string;
    const subpath = group === "schemas" ? "./schemas/*" : `./conformance/${group}/*`;
    const entry = { ...breaking, subpath, name: file, change: "changed" as const };
    const current = { ...fixture, [group]: { ...fixture[group], [file]: "changed" } };
    expect(compareApiSurface(fixture, current, [entry], migration)).toEqual([]);
    expect(compareApiSurface(fixture, current, [entry], "")).not.toEqual([]);
    expect(compareApiSurface(fixture, current, [{ ...entry, change: "removed" }], migration)).not.toEqual([]);
    const remaining = { ...fixture[group] };
    delete remaining[file];
    expect(
      compareApiSurface(fixture, { ...fixture, [group]: remaining }, [{ ...entry, change: "removed" }], migration),
    ).toEqual([]);
  }
});

test("behavior_break_requires_existing_regression_evidence", () => {
  const entry: RegisterEntry = {
    subpath: ".",
    name: "validateCatalog",
    change: "changed",
    task: "026 T3",
    reason: "ownership",
    hostAction: "migrate",
    migration: "Ownership",
    behavior: { file: "src/__tests__/pack.test.ts", test: "packed_and_verified_packages_are_deeply_frozen" },
  };
  expect(compareApiSurface(fixture, fixture, [entry], "### Ownership")).toEqual([]);
  expect(
    compareApiSurface(
      fixture,
      fixture,
      [{ ...entry, behavior: { ...entry.behavior!, test: "missing_test" } }],
      "### Ownership",
    ),
  ).not.toEqual([]);
});

test("new_corpus_case_accepts_only_an_added_register_entry", () => {
  const name = "conformance/corpus/ui-tree/dimension-fraction-rejected.json";
  const current = { ...fixture, corpus: { ...fixture.corpus, [name]: "new" } };
  const entry: RegisterEntry = { ...breaking, subpath: "./conformance/corpus/*", name, change: "added" };
  expect(compareApiSurface(fixture, current, [entry], migration)).toEqual([]);
  expect(compareApiSurface(fixture, current, [{ ...entry, change: "changed" }], migration)).not.toEqual([]);
  expect(compareApiSurface(fixture, fixture, [entry], migration)).not.toEqual([]);
});
