import { expect, test } from "bun:test";
import { dependents } from "@arnilo/liveframe/host";

const call = (source: string, params: Record<string, unknown> = {}) => ({ source, params }) as never;
const placement = (placementId: string, bound: Record<string, { source: string; params: unknown }>) => ({
  placementId,
  bound: bound as never,
});

test("dependents_match_source_name", () => {
  const placements = [
    placement("list", { sel: call("selection.current"), rows: call("tasks.read") }),
    placement("detail", { sel: call("selection.current") }),
    placement("other", { rows: call("tasks.read") }),
    placement("none", {}),
  ];
  expect(dependents(placements, { source: "selection.current" })).toEqual(["list", "detail"]);
  expect(dependents(placements, { source: "unknown.source" })).toEqual([]);
});

test("dependents_match_params_canonically", () => {
  const placements = [
    placement("a", { t: call("task.read", { id: "1", deep: { x: 1, y: 2 } }) }),
    placement("b", { t: call("task.read", { id: "2" }) }),
    placement("c", { t: call("task.read", { id: "1", deep: { x: 1, y: 2 } }), u: call("task.read", { id: "2" }) }),
  ];
  // Key order does not matter; each placement is listed once even when two of its calls match.
  expect(dependents(placements, { source: "task.read", params: { deep: { y: 2, x: 1 }, id: "1" } })).toEqual([
    "a",
    "c",
  ]);
  expect(dependents(placements, { source: "task.read", params: { id: "2" } })).toEqual(["b", "c"]);
  expect(dependents(placements, { source: "task.read" })).toEqual(["a", "b", "c"]);
  expect(dependents(placements, { source: "task.read", params: null })).toEqual([]);
});

test("dependents_linear_scale", () => {
  const scan = (n: number) => {
    const placements = Array.from({ length: n }, (_, i) =>
      placement(`p${i}`, { a: call("rows", { page: i }), s: call("selection.current") }),
    );
    const start = performance.now();
    const ids = dependents(placements, { source: "selection.current" });
    expect(ids.length).toBe(n);
    return performance.now() - start;
  };
  scan(1000);
  // 1,000 placements finish in well under a frame; the bench records the figure.
  expect(scan(1000)).toBeLessThan(20);
});
