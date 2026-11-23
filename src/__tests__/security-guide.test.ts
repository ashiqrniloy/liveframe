import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pack, type WidgetPackage } from "@arnilo/liveframe/pack";
import { loadPlacement, memoryStore, type Placement, verifiedPackages } from "@arnilo/liveframe/store";
import { int, obj, type Result, validateCapabilities, validateCatalog } from "../index.ts";
import capabilitiesDoc from "./fixtures/proof/capabilities.json" with { type: "json" };
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };

const root = resolve(import.meta.dir, "../..");
// The one citation form: a link to a test file on `main`, then the test's name in backticks.
const CITATION = /\]\(https:\/\/github\.com\/ashiqrniloy\/liveframe\/blob\/main\/([^)#\s]+)\), `([A-Za-z0-9_]+)`/g;
const GUIDES = ["docs/security.md", "docs/security-checklist.md"];

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function citations(text: string): { path: string; name: string }[] {
  return [...text.matchAll(CITATION)].map(([, path, name]) => ({ path: path as string, name: name as string }));
}

// `test("name"` or `test.each([...])("name (%i …)"`.
function declaresTest(source: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\btest(?:\\.each\\([^)]*\\))?\\(\\s*"${escaped}[" ]`).test(source);
}

test("security_guide_citations_name_existing_tests", () => {
  let checked = 0;
  for (const guide of GUIDES) {
    if (!existsSync(resolve(root, guide))) continue;
    for (const { path, name } of citations(read(guide))) {
      expect(existsSync(resolve(root, path)), `${guide} cites a missing file ${path}`).toBe(true);
      expect(declaresTest(read(path), name), `${guide} cites ${name}, which ${path} does not declare`).toBe(true);
      checked++;
    }
  }
  expect(checked).toBeGreaterThan(0);
});

test("security_guide_corrections_each_cite_a_test", () => {
  const paragraphs = read("docs/security.md").split(/\n\s*\n/);
  for (const marker of ["`limits.steps`", "`hash-mismatch`", "A2UI document"]) {
    const holding = paragraphs.filter((paragraph) => paragraph.includes(marker));
    expect(holding.length, `no paragraph mentions ${marker}`).toBeGreaterThan(0);
    for (const paragraph of holding)
      expect(citations(paragraph).length, `a paragraph about ${marker} cites no test:\n${paragraph}`).toBeGreaterThan(
        0,
      );
  }
});

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
  params: obj({}),
  state: obj({ count: int() }),
  initialState: { count: 0 },
  context: obj({}),
  sources: {},
  actions: [],
};
const packWith = (code: string) =>
  value(
    pack(
      {
        files: { "entry.ts": code },
        entry: "entry.ts",
        manifest,
        scenarios: [{ name: "default", params: {}, context: {}, data: {} }],
      },
      options,
    ),
  );
const placement: Placement = { id: "home", slot: "main", widget: { id: "counter", version: "1" }, params: {} };

test("hash_mismatch_detects_a_stale_hash_and_not_a_recomputed_one", async () => {
  const original = packWith("export default () => null;");
  const store = memoryStore();
  await store.putPackage(original);
  await store.putPlacement(placement);
  const verified = verifiedPackages();
  expect(value(await loadPlacement(store, "home", options, { verified })).package.hash).toBe(original.hash);
  const serving = (pkg: WidgetPackage) => ({ ...store, getPackage: async () => pkg });

  // Content changed under its old `hash` field: corruption or a careless edit is caught.
  const stale: WidgetPackage = { ...original, code: `${original.code}\n// edited`, hash: original.hash };
  const caught = await loadPlacement(serving(stale), "home", options, { verified });
  expect(caught.ok).toBe(false);
  if (!caught.ok) expect(caught.errors).toContainEqual(expect.objectContaining({ kind: "hash-mismatch" }));

  // Different content under the same id@version with its hash recomputed is accepted in 0.4.x:
  // a placement does not pin content. Plan 043 (LF-19) inverts this half for a pinned placement.
  const substituted = packWith('export default () => null; // "substituted"');
  expect(substituted.hash).not.toBe(original.hash);
  const accepted = value(await loadPlacement(serving(substituted), "home", options, { verified }));
  expect(accepted.package.hash).toBe(substituted.hash);
});
