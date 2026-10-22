import { expect, test } from "bun:test";
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
