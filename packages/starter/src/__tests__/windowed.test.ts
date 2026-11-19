import { expect, test } from "bun:test";
import { diffTrees } from "@arnilo/liveframe";
import { MAX_ROWS, pageTree, rowsAt, TOTAL, validator, windowTree } from "./windowed.tsx";

test("windowed_list_never_exceeds_the_row_budget", () => {
  // A scripted scroll from the top to the bottom and back, in uneven steps, ending on the last rows.
  const starts = [
    ...Array.from({ length: 200 }, (_, i) => i * 251),
    TOTAL - 10,
    TOTAL,
    ...Array.from({ length: 50 }, (_, i) => TOTAL - i * 997),
  ];
  for (const [revision, start] of starts.entries()) {
    const tree = windowTree({ start, end: start + 10 }, revision);
    const rows = tree.root.children ?? [];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(MAX_ROWS);
    expect(validator.validateTree(tree).ok).toBe(true);
    const offset = tree.root.props.itemStart as number;
    expect(offset + rows.length).toBeLessThanOrEqual(TOTAL);
    expect(rows[0]?.id).toBe(`root/${offset}`);
  }
});

test("range_change_patch_holds_only_entering_and_leaving_rows", () => {
  const before = pageTree(rowsAt(1000, 1200), 1);
  const after = pageTree(rowsAt(1020, 1220), 2);
  const patch = diffTrees(before, after);
  if (!patch.ok) throw new Error(JSON.stringify(patch.errors));
  const { ops } = patch.value;
  // The scroll's `itemStart`, then the 20 rows that left and the 20 that entered; the 180 shared rows are untouched.
  expect(ops.length).toBeLessThanOrEqual(42);
  expect(ops.filter((op) => op.op === "set").map((op) => ("id" in op ? op.id : ""))).toEqual(["root"]);
  const removed = ops.flatMap((op) => (op.op === "remove" ? [op.id] : []));
  const inserted = ops.flatMap((op) => (op.op === "insert" ? [op.node.id] : []));
  expect(removed.sort()).toEqual(Array.from({ length: 20 }, (_, i) => `root/${1000 + i}`).sort());
  expect(inserted.sort()).toEqual(Array.from({ length: 20 }, (_, i) => `root/${1200 + i}`).sort());
  expect(ops.some((op) => op.op === "move")).toBe(false);
  const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
  expect(bytes(patch.value)).toBeLessThanOrEqual(bytes(after) * 0.25);
});
