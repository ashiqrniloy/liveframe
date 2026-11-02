import { expect, test } from "bun:test";
import { LiveframeFailure } from "../errors.ts";
import { buildFacts, catalogCompileCount, compileValidator } from "../validate/compile.ts";
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import catalogDocument from "./fixtures/proof/catalog.json" with { type: "json" };
import manifestDocument from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };
import { validatorFixtures } from "./fixtures/validator.ts";

test("validator_smoke_under_5us_per_node", async () => {
  for (const { name, tree, nodes, validateTree } of await validatorFixtures()) {
    expect(validateTree(tree)).toEqual({ ok: true, value: tree });
    for (let i = 0; i < 200; i++) validateTree(tree);
    const start = performance.now();
    for (let i = 0; i < 1_000; i++) {
      if (!validateTree(tree).ok) throw new Error(`${name}: validation failed during timing`);
    }
    const perNode = (performance.now() - start) / nodes;
    expect(perNode, `${name}: µs per node`).toBeLessThanOrEqual(5);
  }
}, 30_000);

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
