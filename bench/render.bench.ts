import { strict as assert } from "node:assert";
import { cpus, loadavg, platform, release } from "node:os";
import { countNodes, renderWorkloads } from "../src/__tests__/fixtures/render-workloads.ts";

const runs = 1_000;
/** Independent samples per workload; the verdict is their median, not one noisy batch. */
const BATCHES = 5;
/** A batch runs at least this long, so a 5-node tree is not dominated by timer and loop overhead. */
const BATCH_MS = 50;
/** One batch's mean milliseconds per run, grown until it covers `BATCH_MS`. */
function batch(run: (i: number) => void): number {
  let iterations = 16;
  for (;;) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) run(i);
    const elapsed = performance.now() - start;
    if (elapsed >= BATCH_MS || iterations >= 10_000_000) return elapsed / iterations;
    iterations *= 2;
  }
}
function measure(run: (i: number) => void): number {
  for (let i = 0; i < 200; i++) run(i);
  const samples = Array.from({ length: BATCHES }, () => batch(run)).sort((a, b) => a - b);
  return samples[Math.floor(BATCHES / 2)] ?? 0;
}

console.log(`Bun ${Bun.version}; ${platform()} ${release()}; ${cpus()[0]?.model}; ${cpus().length} logical CPUs`);
console.log(
  `Load average (1/5/15 min): ${loadavg().join(", ")}; 200 warm-ups, then the median of ${BATCHES} batches of at least ${BATCH_MS} ms`,
);
console.log("Compile/load and first data resolution excluded; selection/state changes included.");
console.log(
  "Split: standalone validateTree on emitted trees; render minus validation estimates other work, not an in-render profile.",
);
console.log(
  "Budgets: total ≤ 3 µs/node; reserved validation ≤ 1.5 / other ≤ 1.5 µs/node; agent-home/core-queue medium…full ≤ 2 ms.",
);
let failed = false;
const workloads = renderWorkloads();
assert.deepEqual(
  workloads.map(({ name }) => name),
  [
    "agent-home",
    "core-queue.small",
    "core-queue.medium",
    "core-queue.large",
    "core-queue.full",
    "git-status",
    "rack-module",
    "synthetic-queue",
  ],
);
for (const workload of workloads) {
  const trees = Array.from({ length: workload.period }, (_, i) => workload.run(i));
  const counts = trees.map((tree) => {
    assert(workload.validator.validateTree(tree).ok, `${workload.name}: invalid emitted tree`);
    return countNodes(tree.root);
  });
  const expected = {
    "agent-home": 679,
    "core-queue.small": 5,
    "core-queue.medium": 414,
    "core-queue.large": 446,
    "core-queue.full": 473,
    "git-status": 145,
    "rack-module": 236,
    "synthetic-queue": 353,
  }[workload.name];
  if (expected !== undefined) for (const count of counts) assert.equal(count, expected, workload.name);
  // Use the same selection/tab cycle when counting and timing.
  let nodes = 0;
  for (let i = 0; i < runs; i++) nodes += counts[i % counts.length] ?? 0;
  nodes /= runs;
  const renderMs = measure((i) => {
    workload.run(i);
  });
  const validationMs = measure((i) => {
    const tree = trees[i % trees.length];
    assert(tree && workload.validator.validateTree(tree).ok, `${workload.name}: validation failed`);
  });
  const total = (renderMs * 1_000) / nodes;
  const validation = (validationMs * 1_000) / nodes;
  const other = total - validation;
  console.log(
    `${workload.name}: ${nodes.toFixed(2)} mean nodes; render ${renderMs.toFixed(4)} ms, ${total.toFixed(3)} µs/node; validation ${validationMs.toFixed(4)} ms, ${validation.toFixed(3)} µs/node (${((validationMs / renderMs) * 100).toFixed(1)}%); other estimate ${other.toFixed(3)} µs/node`,
  );
  const wallGate =
    workload.name === "agent-home" || (workload.name.startsWith("core-queue.") && workload.name !== "core-queue.small");
  if (total > 3 || (wallGate && renderMs > 2)) {
    console.error(`${workload.name}: failed render budget`);
    failed = true;
  }
}
console.log(`Load average at end: ${loadavg().join(", ")}`);
if (failed) process.exitCode = 1;
