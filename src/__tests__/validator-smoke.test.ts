import { expect, test } from "bun:test";
import { LiveframeFailure } from "../errors.ts";
import { buildFacts, catalogCompileCount, compileValidator } from "../validate/compile.ts";
import manifestDocument from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import catalogDocument from "./fixtures/proof/catalog.json" with { type: "json" };
import { validatorFixtures } from "./fixtures/validator.ts";

test("validator_smoke_accepts_every_fixture", async () => {
  for (const { tree, validateTree } of await validatorFixtures()) {
    expect(validateTree(tree)).toEqual({ ok: true, value: tree });
  }
});

/** A catalog and manifest pair nothing else compiles, so the cache count is this test's alone. */
const documents = (version: number) => ({
  catalog: { ...catalogDocument, catalogId: `proof.ui@${version}` },
  capabilities,
  manifest: { ...manifestDocument, catalogId: `proof.ui@${version}` },
});

test("second_compile_reuses_catalog_work_and_returns_a_new_validator", () => {
  const first = compileValidator(documents(101));
  const compiles = catalogCompileCount();
  const copy = JSON.parse(JSON.stringify(documents(101)));
  const second = compileValidator({ ...copy, manifest: { ...copy.manifest, version: "1.0.1" } });
  expect(catalogCompileCount()).toBe(compiles);
  expect(second).not.toBe(first);
  expect(second.checkNode).not.toBe(first.checkNode);
  expect(second.validateTree).not.toBe(first.validateTree);
  expect(buildFacts(second)).not.toBe(buildFacts(first));
  expect(buildFacts(second).structure).toBe(buildFacts(first).structure);
  expect(buildFacts(second).catalogId).toBe("proof.ui@101");
});

test("mutated_catalog_compiles_fresh", () => {
  const options = documents(102);
  const first = compileValidator(options);
  const compiles = catalogCompileCount();
  options.catalog.catalogId = "proof.ui@103";
  const second = compileValidator({ ...options, manifest: { ...options.manifest, catalogId: "proof.ui@103" } });
  expect(catalogCompileCount()).toBe(compiles + 1);
  expect(buildFacts(first).catalogId).toBe("proof.ui@102");
  expect(buildFacts(second).catalogId).toBe("proof.ui@103");
});

test("mutating_the_compiled_catalog_never_stales_an_equal_catalog", () => {
  const options = documents(105);
  compileValidator(options);
  const compiles = catalogCompileCount();
  // The cache reads the documents of the call that compiled it; changing them must evict the entry,
  // not make a later, equal catalog compile against the changed content.
  options.catalog.catalogId = "proof.ui@106";
  const fresh = JSON.parse(JSON.stringify(documents(105)));
  const validator = compileValidator(fresh);
  expect(catalogCompileCount()).toBe(compiles + 1);
  expect(buildFacts(validator).catalogId).toBe("proof.ui@105");
});

test("invalid_catalog_never_hits_cache", () => {
  const options = documents(104);
  compileValidator(options);
  const compiles = catalogCompileCount();
  // JSON drops the undefined-valued key, so this document's key text is the cached one and only
  // the content check can reject it.
  const invalid = { ...options.catalog, unexpected: undefined };
  expect(() => compileValidator({ ...options, catalog: invalid })).toThrow(LiveframeFailure);
  expect(catalogCompileCount()).toBe(compiles);
  compileValidator(options);
  expect(catalogCompileCount()).toBe(compiles);
});

/** Compile each version in turn and return how many catalog-level compiles that took. */
const compileAll = (versions: readonly number[]): number => {
  const compiles = catalogCompileCount();
  for (const version of versions) compileValidator(documents(version));
  return catalogCompileCount() - compiles;
};
const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);

test("sixty_four_catalog_pairs_all_hit", () => {
  const pairs = range(1_000, 64);
  expect(compileAll(pairs)).toBe(64);
  expect(compileAll(pairs)).toBe(0);
});

test("sixty_fifth_pair_evicts_the_least_recently_used", () => {
  const pairs = range(2_000, 64);
  compileAll(pairs);
  compileAll([2_000]); // Now the most recent; 2_001 is the oldest.
  expect(compileAll([2_064])).toBe(1);
  expect(compileAll([2_001])).toBe(1);
  expect(compileAll([2_000, ...range(2_003, 61), 2_064])).toBe(0);
});

test("a_changed_document_never_hits", () => {
  const options = documents(3_000);
  compileValidator(options);
  options.catalog.catalogId = "proof.ui@3001";
  const compiles = catalogCompileCount();
  const validator = compileValidator(documents(3_000));
  expect(catalogCompileCount()).toBe(compiles + 1);
  expect(buildFacts(validator).catalogId).toBe("proof.ui@3000");
});
