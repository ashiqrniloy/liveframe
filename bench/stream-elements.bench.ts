import { strict as assert } from "node:assert";
import { cpus, loadavg, platform, release } from "node:os";
import cases from "../src/__tests__/fixtures/elements.json" with { type: "json" };
import catalog from "../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import { countNodes, renderWorkloads } from "../src/__tests__/fixtures/render-workloads.ts";
import capabilities from "../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "../src/__tests__/fixtures/widgets/index.ts";
import { compileValidator, obj, str } from "../src/index.ts";
import { renderElements } from "../src/sdk/elements.ts";
import { streamElements } from "../src/sdk/stream.ts";
import { budget, metric, timed } from "./metrics.ts";

// streamElements (plan 028 Task 7): the total work over a whole stream of the agent-home element document
// (679 nodes) in 64-byte chunks, against one renderElements of the same document. Budget: ≤ 3×.
const CHUNK = 64;
const BATCHES = 5;
const BATCH_MS = 50;
/** One batch's mean wall and CPU milliseconds per run, grown until it covers `BATCH_MS`. */
function batch(run: () => void): { wallMs: number; cpuMs: number } {
  let iterations = 4;
  for (;;) {
    const sample = timed(run, iterations);
    if (sample.wallMs * iterations >= BATCH_MS || iterations >= 1_000_000) return sample;
    iterations *= 2;
  }
}
const middle = (values: number[]) => values.toSorted((a, b) => a - b)[values.length >> 1] as number;
function measure(run: () => void): number {
  for (let i = 0; i < 50; i++) run();
  return middle(Array.from({ length: BATCHES }, () => batch(run).wallMs));
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
const timedPairs = Array.from({ length: PAIRS }, () => ({ render: batch(renderOnce), stream: batch(streamed) }));
const pairs = timedPairs
  .map(({ render, stream }) => ({ render: render.wallMs, stream: stream.wallMs, ratio: stream.wallMs / render.wallMs }))
  .sort((a, b) => a.ratio - b.ratio);
const { render: renderMs, stream: streamMs, ratio } = pairs[PAIRS >> 1] as (typeof pairs)[number];
const renderCpuMs = middle(timedPairs.map((pair) => pair.render.cpuMs));
const streamCpuMs = middle(timedPairs.map((pair) => pair.stream.cpuMs));
const parseMs = measure(parseOnly);

metric("stream.agentHome.renderMs", renderMs);
metric("stream.agentHome.streamMs", streamMs);
metric("stream.agentHome.ratio", ratio);
metric("stream.agentHome.renderCpuMs", renderCpuMs);
metric("stream.agentHome.streamCpuMs", streamCpuMs);
console.log(`Bun ${Bun.version}; ${platform()} ${release()}; ${cpus()[0]?.model}; load ${loadavg().join(", ")}`);
console.log(
  `agent-home element document: ${nodes} nodes, ${text.length} chars in ${chunks.length} chunks of ${CHUNK}; ${trees} trees drawn`,
);
console.log(
  `renderElements ${renderMs.toFixed(3)} ms (${((renderMs * 1000) / nodes).toFixed(2)} µs/node); JSON.parse + renderElements ${parseMs.toFixed(3)} ms; ` +
    `streamElements ${streamMs.toFixed(3)} ms = ${ratio.toFixed(2)}× renderElements (budget 3×)`,
);
budget(ratio <= 3, `streamElements: ${ratio.toFixed(2)}× renderElements exceeds the 3× budget`);

// Expressions (plan 039 Task 2): the same document with a filter field bound to `local.q` and a `when` on
// each keyed row box. Budgets: renderElements ≤ 1.3× the expression-free document; the stream ≤ 3× its own.
type Node = { kind: string; key?: unknown; children?: Node[]; [field: string]: unknown };
function withExpressions(node: Node): Node {
  const children = node.children?.map(withExpressions);
  const out: Node = { ...node, ...(children ? { children } : {}) };
  if (node.kind === "box" && node.key !== undefined)
    out.when = { $contains: [{ $lit: String(node.key) }, { $path: "local.q" }] };
  return out;
}
const filtered = withExpressions(structuredClone(doc) as Node);
const shell = filtered.children?.[0];
assert(shell?.children, "agent-home root stack missing");
shell.children.unshift({
  kind: "textField",
  key: "filter",
  props: { label: "Filter", value: "" },
  bind: { value: { $path: "local.q" } },
  events: { onChange: { type: "setLocal", key: "q" } },
});
const agentHome = proofWidgets.find((widget) => widget.name === "agent-home");
assert(agentHome, "agent-home manifest missing");
const filteredOptions = {
  validator: compileValidator({
    catalog,
    capabilities,
    manifest: { ...agentHome.manifest, local: obj({ q: str({ maxLength: 80 }) }), initialLocal: { q: "" } },
  }),
  surfaceId: "bench",
};
const filteredText = JSON.stringify(filtered);
const filteredChunks = Array.from({ length: Math.ceil(filteredText.length / CHUNK) }, (_, i) =>
  filteredText.slice(i * CHUNK, (i + 1) * CHUNK),
);
const renderFiltered = () => {
  const result = renderElements(filtered, { ...filteredOptions, revision: 0 });
  assert(result.ok, JSON.stringify(result.ok ? [] : result.errors.slice(0, 2)));
};
const streamFiltered = () => {
  const stream = streamElements(filteredOptions);
  for (const chunk of filteredChunks) stream.push(chunk);
  assert(stream.end().ok);
};
// An A/B base from before element JSON took expressions (`bench/ab.ts`) reports the plain rows only.
const accepted = renderElements(filtered, { ...filteredOptions, revision: 0 }).ok;
if (!accepted) console.log("agent-home with expressions: skipped, this checkout's element JSON takes no when");
for (let i = 0; accepted && i < 50; i++) {
  renderOnce();
  renderFiltered();
  streamFiltered();
}
const filteredPairs = Array.from({ length: accepted ? PAIRS : 0 }, () => {
  const plain = batch(renderOnce).wallMs;
  const render = batch(renderFiltered).wallMs;
  const stream = batch(streamFiltered).wallMs;
  return { plain, render, stream };
});
if (accepted) {
  const exprRatio = middle(filteredPairs.map((pair) => pair.render / pair.plain));
  const exprStreamRatio = middle(filteredPairs.map((pair) => pair.stream / pair.render));
  const exprRenderMs = middle(filteredPairs.map((pair) => pair.render));
  metric("stream.agentHomeFiltered.renderMs", exprRenderMs);
  metric("stream.agentHomeFiltered.renderRatio", exprRatio);
  metric("stream.agentHomeFiltered.streamRatio", exprStreamRatio);
  console.log(
    `agent-home with a filter and a when on each row: renderElements ${exprRenderMs.toFixed(3)} ms = ${exprRatio.toFixed(2)}× the plain document (budget 1.3×); ` +
      `streamElements ${exprStreamRatio.toFixed(2)}× its renderElements (budget 3×)`,
  );
  budget(exprRatio <= 1.3, `renderElements with expressions: ${exprRatio.toFixed(2)}× exceeds the 1.3× budget`);
  budget(exprStreamRatio <= 3, `streamElements with expressions: ${exprStreamRatio.toFixed(2)}× exceeds the 3× budget`);
}
