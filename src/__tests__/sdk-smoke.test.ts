import { expect, test } from "bun:test";
import { countNodes, renderWorkloads } from "./fixtures/render-workloads.ts";

test("render_smoke_budget", () => {
  const workload = renderWorkloads().find((entry) => entry.name === "agent-home");
  if (!workload) throw new Error("Missing agent-home workload");
  const tree = workload.run(0);
  expect(countNodes(tree.root)).toBe(679);
  expect(workload.validator.validateTree(tree).ok).toBe(true);
});
