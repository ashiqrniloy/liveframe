import { expect, test } from "bun:test";
import { resolve } from "node:path";
import baselineJson from "../../scripts/release/api/0.2.1.json" with { type: "json" };
import registerJson from "../../scripts/release/api/register-0.2.2.json" with { type: "json" };
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

test("baseline_matches_the_checkout_before_any_022_change", async () => {
  expect(baseline.generatedFrom).toContain("v0.2.1");
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
