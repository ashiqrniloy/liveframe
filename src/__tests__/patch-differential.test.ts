import { expect, test } from "bun:test";
import { applyPatch, diffTrees, type UiNode, type UiTree } from "../index.ts";
import { diffTrees022 } from "./fixtures/diff-trees-0.2.2.ts";

// A seeded generator, so a failure names a reproducible case.
let seed = 1;
const random = () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
};
const pick = (n: number) => Math.floor(random() * n);
const shuffle = <T>(values: T[]): T[] =>
  values
    .map((value) => [random(), value] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, value]) => value);

/** A list with nested children, so a moved node can itself have reordered children. */
function nodes(prefix: string, depth: number): UiNode[] {
  return Array.from({ length: 1 + pick(12) }, (_, i) => {
    const id = `${prefix}${i}`;
    const node: UiNode = { id, kind: "text", props: { text: id } };
    return depth > 0 && random() < 0.3 ? { ...node, kind: "stack", children: nodes(`${id}/`, depth - 1) } : node;
  });
}

/** Removes, inserts, reorders and edits children at every level; ids stay unique. */
function mutate(list: readonly UiNode[], fresh: () => string): UiNode[] {
  const kept = list
    .filter(() => random() > 0.2)
    .map((node) => {
      const edited = random() < 0.1 ? { ...node, props: { text: `${node.id}!` } } : node;
      return node.children ? { ...edited, children: mutate(node.children, fresh) } : edited;
    })
    .filter((node) => node.children === undefined || node.children.length > 0);
  for (let i = pick(4); i > 0; i--) kept.splice(pick(kept.length + 1), 0, { id: fresh(), kind: "text", props: {} });
  return random() < 0.7 ? shuffle(kept) : kept;
}

const tree = (children: UiNode[], revision: number): UiTree => ({
  format: "liveframe/1",
  catalogId: "test@1",
  surfaceId: "s",
  revision,
  root: { id: "root", kind: "stack", props: {}, children },
});

test("diff_trees_ops_identical_on_generated_reorders", () => {
  let added = 0;
  const fresh = () => `root/new${added++}`;
  let moves = 0;
  for (let n = 0; n < 1000; n++) {
    const before = nodes("root/n", 2);
    const after = mutate(before, fresh);
    if (!after.length) continue;
    const prev = tree(before, 1);
    const next = tree(after, 2);
    const result = diffTrees(prev, next);
    expect(JSON.stringify(result), `case ${n}`).toBe(JSON.stringify(diffTrees022(prev, next)));
    if (!result.ok) throw new Error(`case ${n}: ${JSON.stringify(result.errors)}`);
    moves += result.value.ops.filter((op) => op.op === "move").length;
    expect(applyPatch(prev, result.value), `case ${n}`).toEqual({ ok: true, value: next });
  }
  expect(moves).toBeGreaterThan(1000);
});

test("diff_trees_moves_a_large_shuffle_like_0_2_2", () => {
  const before = Array.from({ length: 2000 }, (_, i): UiNode => ({ id: `root/r${i}`, kind: "text", props: {} }));
  const prev = tree(before, 1);
  const next = tree(shuffle(before), 2);
  expect(JSON.stringify(diffTrees(prev, next))).toBe(JSON.stringify(diffTrees022(prev, next)));
});
