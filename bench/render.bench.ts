import { strict as assert } from "node:assert";
import { cpus, loadavg, platform, release } from "node:os";
import { toElements } from "../scripts/fixtures/elements.ts";
import { countNodes, renderWorkloads } from "../src/__tests__/fixtures/render-workloads.ts";
import catalog from "../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "../src/__tests__/fixtures/widgets/index.ts";
import { Stack, Text } from "../src/__tests__/fixtures/widgets/ui.gen.ts";
import { compileValidator, int, obj, str } from "../src/index.ts";
import { freezeCopy } from "../src/internal.ts";
import { canonicalJson, renderKey } from "../src/pack/hash.ts";
import { renderElements } from "../src/sdk/elements.ts";
import { render, type WidgetProps } from "../src/sdk/index.ts";
import { jsx } from "../src/sdk/jsx-runtime.ts";
import { budget, metric, timed } from "./metrics.ts";

const runs = 1_000;
/** Independent samples per workload; the verdict is their median, not one noisy batch. */
const BATCHES = 5;
/** A batch runs at least this long, so a 5-node tree is not dominated by timer and loop overhead. */
const BATCH_MS = 50;
/** One batch's mean wall and CPU milliseconds per run, grown until it covers `BATCH_MS`. */
function batch(run: (i: number) => void): { wallMs: number; cpuMs: number } {
  let iterations = 16;
  for (;;) {
    const sample = timed(run, iterations);
    if (sample.wallMs * iterations >= BATCH_MS || iterations >= 10_000_000) return sample;
    iterations *= 2;
  }
}
/** Wall and CPU milliseconds per run, each the median of `BATCHES` batches. */
function measure(run: (i: number) => void): { wallMs: number; cpuMs: number } {
  for (let i = 0; i < 200; i++) run(i);
  const samples = Array.from({ length: BATCHES }, () => batch(run));
  const mid = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(BATCHES / 2)] ?? 0;
  return { wallMs: mid(samples.map((s) => s.wallMs)), cpuMs: mid(samples.map((s) => s.cpuMs)) };
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
  const { wallMs: renderMs, cpuMs: renderCpuMs } = measure((i) => {
    workload.run(i);
  });
  const { wallMs: validationMs, cpuMs: validationCpuMs } = measure((i) => {
    const tree = trees[i % trees.length];
    assert(tree && workload.validator.validateTree(tree).ok, `${workload.name}: validation failed`);
  });
  const total = (renderMs * 1_000) / nodes;
  const validation = (validationMs * 1_000) / nodes;
  const other = total - validation;
  metric(`${workload.name}.renderMs`, renderMs);
  metric(`${workload.name}.renderUsPerNode`, total);
  metric(`${workload.name}.validationMs`, validationMs);
  metric(`${workload.name}.validationUsPerNode`, validation);
  metric(`${workload.name}.renderCpuMs`, renderCpuMs);
  metric(`${workload.name}.validationCpuMs`, validationCpuMs);
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
const agent = workloads.find((workload) => workload.name === "agent-home");
assert(agent, "agent-home workload missing");
const agentTree = agent.run(0);
const agentElements = toElements(agentTree.root);
const agentNodes = countNodes(agentTree.root);
const { wallMs: elementsMs, cpuMs: elementsCpuMs } = measure(() => {
  const result = renderElements(agentElements, { validator: agent.validator, surfaceId: "proof", revision: 0 });
  assert(result.ok, `agent-home elements: ${JSON.stringify(result.errors)}`);
});
const elementsPerNode = (elementsMs * 1_000) / agentNodes;
metric("agent-home-elements.renderMs", elementsMs);
metric("agent-home-elements.usPerNode", elementsPerNode);
metric("agent-home-elements.renderCpuMs", elementsCpuMs);
console.log(
  `agent-home elements: ${agentNodes} nodes; renderElements ${elementsMs.toFixed(4)} ms, ${elementsPerNode.toFixed(3)} µs/node`,
);
if (elementsPerNode > 3) {
  console.error("agent-home elements: failed render budget");
  failed = true;
}
// Informational: the re-run cache key (spec §8) over the agent-home render's real inputs.
const home = proofWidgets.find((widget) => widget.name === "agent-home");
assert(home, "agent-home widget missing");
const homeScenario = home.scenarios.find((scenario) => scenario.name === "default") ?? home.scenarios[0];
assert(homeScenario, "agent-home scenario missing");
const keyInputs = {
  hash: `sha256-${"0".repeat(64)}`,
  catalogId: home.manifest.catalogId,
  params: homeScenario.params,
  state: homeScenario.state,
  data: homeScenario.data,
  context: homeScenario.context,
};
const keyBytes = canonicalJson(keyInputs).length;
const { wallMs: keyMs, cpuMs: keyCpuMs } = measure(() => renderKey(keyInputs));
metric("agent-home-renderKey.ms", keyMs);
metric("agent-home-renderKey.cpuMs", keyCpuMs);
console.log(`agent-home renderKey: ${keyBytes} canonical bytes; ${keyMs.toFixed(4)} ms per key`);

// Plan 034 T5 (P3): a 51-node page fed 1,000 rows directly vs through six composed layers.
type ComposedRow = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly owner: string;
  readonly status: string;
  readonly count: number;
};
const thousandRows: readonly ComposedRow[] = Array.from({ length: 1000 }, (_, i) => ({
  id: `task-${i}`,
  title: `Synthetic task ${i}`,
  detail: "Waiting on you",
  owner: "You",
  status: "ok",
  count: i % 10,
}));
const composedValidator = compileValidator({
  catalog,
  capabilities: {
    ...capabilities,
    sources: {
      ...capabilities.sources,
      "benchmark.thousandRows": {
        description: "Thousand synthetic rows",
        params: obj({}),
        result: {
          type: "array",
          maxItems: 1000,
          items: obj({
            id: str({ maxLength: 64 }),
            title: str({ maxLength: 128 }),
            detail: str({ maxLength: 128 }),
            owner: str({ maxLength: 64 }),
            status: str({ maxLength: 32 }),
            count: int({ minimum: 0, maximum: 10 }),
          }),
        },
      },
    },
  },
  manifest: {
    format: "liveframe-manifest/1",
    id: "composed-layers",
    version: "1.0.0",
    catalogId: catalog.catalogId,
    params: obj({}),
    context: obj({ size: str({ enum: ["full"], maxLength: 4 }) }),
    state: obj({}),
    initialState: {},
    sources: { rows: { source: "benchmark.thousandRows", params: {} } },
    actions: [],
  },
});
const composedInputs = freezeCopy({
  params: {},
  state: {},
  data: { rows: thousandRows },
  context: { size: "full" },
});
function DirectPage({ rows }: { readonly rows: readonly ComposedRow[] }) {
  return jsx(Stack, {
    gap: "space.3",
    children: rows.slice(0, 50).map((row) => jsx(Text, { text: row.title }, row.id)),
  });
}
function Layer6(props: { readonly rows: readonly ComposedRow[] }) {
  return jsx(DirectPage, props);
}
function Layer5(props: { readonly rows: readonly ComposedRow[] }) {
  return jsx(Layer6, props);
}
function Layer4(props: { readonly rows: readonly ComposedRow[] }) {
  return jsx(Layer5, props);
}
function Layer3(props: { readonly rows: readonly ComposedRow[] }) {
  return jsx(Layer4, props);
}
function Layer2(props: { readonly rows: readonly ComposedRow[] }) {
  return jsx(Layer3, props);
}
function Layer1(props: { readonly rows: readonly ComposedRow[] }) {
  return jsx(Layer2, props);
}
const directWidget = ({ data }: WidgetProps<object, object, { rows: readonly ComposedRow[] }, { size: string }>) =>
  DirectPage({ rows: data.rows });
const layeredWidget = ({ data }: WidgetProps<object, object, { rows: readonly ComposedRow[] }, { size: string }>) =>
  jsx(Layer1, { rows: data.rows });
const composedOptions = { validator: composedValidator, surfaceId: "proof", revision: 0 };
const directCheck = render(directWidget, composedInputs, composedOptions);
const layeredCheck = render(layeredWidget, composedInputs, composedOptions);
assert(directCheck.ok && layeredCheck.ok, "composed-6-layers render failed");
assert.equal(countNodes(directCheck.value.root), 51);
assert.equal(JSON.stringify(layeredCheck.value), JSON.stringify(directCheck.value));

for (let i = 0; i < 200; i++) {
  render(directWidget, composedInputs, composedOptions);
  render(layeredWidget, composedInputs, composedOptions);
}
const pairedRounds = 9;
const pairedBatch = 50;
const directCpuSamples: number[] = [];
const layeredCpuSamples: number[] = [];
const ratioSamples: number[] = [];
for (let r = 0; r < pairedRounds; r++) {
  const startDirect = process.cpuUsage();
  for (let i = 0; i < pairedBatch; i++) render(directWidget, composedInputs, composedOptions);
  const usedDirect = process.cpuUsage(startDirect);
  const startLayered = process.cpuUsage();
  for (let i = 0; i < pairedBatch; i++) render(layeredWidget, composedInputs, composedOptions);
  const usedLayered = process.cpuUsage(startLayered);
  const directMs = (usedDirect.user + usedDirect.system) / 1000 / pairedBatch;
  const layeredMs = (usedLayered.user + usedLayered.system) / 1000 / pairedBatch;
  directCpuSamples.push(directMs);
  layeredCpuSamples.push(layeredMs);
  ratioSamples.push(layeredMs / directMs);
}
const medianOf = (values: number[]) => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)] as number;
const directCpuMs = medianOf(directCpuSamples);
const layeredCpuMs = medianOf(layeredCpuSamples);
const composedRatio = medianOf(ratioSamples);
metric("composed-6-layers.directMs", directCpuMs);
metric("composed-6-layers.composedMs", layeredCpuMs);
metric("composed-6-layers.ratio", composedRatio);
console.log(
  `composed-6-layers (51 nodes, 1,000 rows): direct ${directCpuMs.toFixed(4)} ms CPU, 6 layers ${layeredCpuMs.toFixed(4)} ms CPU (${composedRatio.toFixed(3)}×, budget <= 1.100×)`,
);
budget(
  composedRatio <= 1.1,
  `composed-6-layers ratio ${composedRatio.toFixed(3)}× exceeds 1.100× (direct ${directCpuMs.toFixed(4)} ms vs 6 layers ${layeredCpuMs.toFixed(4)} ms)`,
);

console.log(`Load average at end: ${loadavg().join(", ")}`);
if (failed) process.exitCode = 1;
