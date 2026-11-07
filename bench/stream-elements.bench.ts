import { strict as assert } from "node:assert";
import { cpus, loadavg, platform, release } from "node:os";
import cases from "../src/__tests__/fixtures/elements.json" with { type: "json" };
import { countNodes, renderWorkloads } from "../src/__tests__/fixtures/render-workloads.ts";
import { renderElements } from "../src/sdk/elements.ts";
import { streamElements } from "../src/sdk/stream.ts";
import { budget, metric } from "./metrics.ts";

// streamElements (plan 028 Task 7): the total work over a whole stream of the agent-home element document
// (679 nodes) in 64-byte chunks, against one renderElements of the same document. Budget: ≤ 3×.
const CHUNK = 64;
const BATCHES = 5;
const BATCH_MS = 50;
function batch(run: () => void): number {
  let iterations = 4;
  for (;;) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) run();
    const elapsed = performance.now() - start;
    if (elapsed >= BATCH_MS || iterations >= 1_000_000) return elapsed / iterations;
    iterations *= 2;
  }
}
function measure(run: () => void): number {
  for (let i = 0; i < 50; i++) run();
  const samples = Array.from({ length: BATCHES }, () => batch(run)).sort((a, b) => a - b);
  return samples[BATCHES >> 1] as number;
}

const [workload] = renderWorkloads();
const entry = cases[0];
assert(workload && entry?.name === "agent-home", "agent-home workload missing");
const { validator } = workload;
const doc = entry.elements as unknown;
const text = JSON.stringify(doc);
const chunks = Array.from({ length: Math.ceil(text.length / CHUNK) }, (_, i) => text.slice(i * CHUNK, (i + 1) * CHUNK));
const options = { validator, surfaceId: "bench" };

const whole = renderElements(doc, { ...options, revision: 0 });
assert(whole.ok, "agent-home element document must render");
const nodes = countNodes(whole.value.root);

let trees = 0;
const streamed = () => {
  const stream = streamElements(options);
  trees = 0;
  for (const chunk of chunks) if (stream.push(chunk)?.ok) trees++;
  const result = stream.end();
  assert(result.ok);
};
const parseOnly = () => {
  // The floor any reader pays: one JSON.parse of the whole text, then renderElements.
  const result = renderElements(JSON.parse(text), { ...options, revision: 0 });
  assert(result.ok);
};

// Each pair runs back to back, so a busy machine slows both halves alike; the verdict is the median pair.
const renderOnce = () => {
  const result = renderElements(doc, { ...options, revision: 0 });
  assert(result.ok);
};
for (let i = 0; i < 50; i++) {
  renderOnce();
  streamed();
}
const PAIRS = 9;
const pairs = Array.from({ length: PAIRS }, () => {
  const render = batch(renderOnce);
  const stream = batch(streamed);
  return { render, stream, ratio: stream / render };
}).sort((a, b) => a.ratio - b.ratio);
const { render: renderMs, stream: streamMs, ratio } = pairs[PAIRS >> 1] as (typeof pairs)[number];
const parseMs = measure(parseOnly);

metric("stream.agentHome.renderMs", renderMs);
metric("stream.agentHome.streamMs", streamMs);
metric("stream.agentHome.ratio", ratio);
console.log(`Bun ${Bun.version}; ${platform()} ${release()}; ${cpus()[0]?.model}; load ${loadavg().join(", ")}`);
console.log(
  `agent-home element document: ${nodes} nodes, ${text.length} chars in ${chunks.length} chunks of ${CHUNK}; ${trees} trees drawn`,
);
console.log(
  `renderElements ${renderMs.toFixed(3)} ms (${((renderMs * 1000) / nodes).toFixed(2)} µs/node); JSON.parse + renderElements ${parseMs.toFixed(3)} ms; ` +
    `streamElements ${streamMs.toFixed(3)} ms = ${ratio.toFixed(2)}× renderElements (budget 3×)`,
);
budget(ratio <= 3, `streamElements: ${ratio.toFixed(2)}× renderElements exceeds the 3× budget`);
