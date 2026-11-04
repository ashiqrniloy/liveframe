// 0.3.0 may break 0.2.1/0.2.2 by design; their checkout comparisons are retired.
// The last patch, 0.2.3, is the single baseline for registered 0.3.0 changes.
import { expect, test } from "bun:test";
import { resolve } from "node:path";
import baselineJson from "../../scripts/release/api/0.2.3.json" with { type: "json" };
import registerJson from "../../scripts/release/api/register-0.3.0.json" with { type: "json" };
import {
  type ApiSurface,
  compareApiSurface,
  type RegisterEntry,
  readApiSurface,
} from "../../scripts/release/api-surface.ts";

const root = resolve(import.meta.dir, "../..");
const baseline = baselineJson as unknown as ApiSurface;
const register = registerJson as unknown as readonly RegisterEntry[];

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

test("baseline_0_2_3_matches_the_checkout_through_the_0_3_0_register", async () => {
  expect(baseline.generatedFrom).toContain("v0.2.3");
  const current = await readApiSurface(root);
  expect(compareApiSurface(baseline, current, register)).toEqual([]);
});

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
  for (const entry of register) {
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
