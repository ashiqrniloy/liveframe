import { expect, test } from "bun:test";
import { countNodes, renderWorkloads } from "./fixtures/render-workloads.ts";

test("render_smoke_budget", () => {
  const workload = renderWorkloads().find((entry) => entry.name === "agent-home");
  if (!workload) throw new Error("Missing agent-home workload");
  expect(countNodes(workload.run(0).root)).toBe(679);
  for (let i = 0; i < 200; i++) workload.run(i);
  const start = performance.now();
  for (let i = 0; i < 1_000; i++) workload.run(i);
  const perNode = (performance.now() - start) / 679;
  expect(perNode, "agent-home: µs per node").toBeLessThanOrEqual(10);
}, 30_000);
