// Regenerate with the baseline bundle described in 026-validator-realm.md:
// timeout 120s bun --conditions liveframe:source plans/evidence/026-validator-realm.ts /tmp/liveframe-t5-baseline.mjs
import assert from "node:assert/strict";
import { loadavg } from "node:os";
import manifest from "../../src/__tests__/fixtures/proof/agent-home.manifest.json";
import capabilities from "../../src/__tests__/fixtures/proof/capabilities.json";
import { validatorCatalog, validatorFixtures } from "../../src/__tests__/fixtures/validator.ts";
import { compileTree } from "../../src/validate/tree.ts";

assert(Bun.argv[2], "Pass the pre-task validator bundle path");
const baseline = await import(Bun.argv[2]);
const median = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1]!;
const time = (run: () => unknown) => {
  const start = performance.now();
  for (let i = 0; i < 300; i++) run();
  return (performance.now() - start) / 300;
};
console.log({ load: loadavg() });
for (const fixture of (await validatorFixtures()).filter(({ name }) => name === "agent-home")) {
  // Reuse the same per-kind checks to isolate the tree walk; the schema checker is unchanged.
  const before = baseline.compileValidator({ catalog: validatorCatalog, capabilities, manifest });
  const after = compileTree(validatorCatalog, before.checkNode);
  const a = () => before.validateTree(fixture.tree);
  const b = () => after(fixture.tree);
  assert.deepEqual(a(), b());
  const ratios: number[] = [];
  for (let round = 0; round < 15; round++) {
    for (let i = 0; i < 100; i++) {
      a();
      b();
    }
    let x: number, y: number;
    if (round % 2) {
      y = time(b);
      x = time(a);
    } else {
      x = time(a);
      y = time(b);
    }
    ratios.push(y / x);
  }
  console.log({ name: fixture.name, pairedRatio: median(ratios) });
}
