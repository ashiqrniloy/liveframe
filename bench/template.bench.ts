import { strict as assert } from "node:assert";
import { arr, compileValidator, int, obj, str, validateCapabilities, validateCatalog } from "@arnilo/liveframe";
import catalog from "../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import { countNodes } from "../src/__tests__/fixtures/render-workloads.ts";
import { agentHomeTemplate } from "../src/__tests__/fixtures/templates/agent-home.ts";
import capabilities from "../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "../src/__tests__/fixtures/widgets/index.ts";
import { freezeCopy } from "../src/internal.ts";
import { pack } from "../src/pack/index.ts";
import { templateRunner } from "../src/preview/template.ts";
import { compileExpression, type Frame } from "../src/template/expr.ts";
import { validateTemplate } from "../src/template/index.ts";
import { renderTemplate } from "../src/template/render.ts";
import { dynamicScope, rootScope } from "../src/template/scope.ts";
import { budget, metric, timed } from "./metrics.ts";

// Evaluation cost per expression node (plan 028 Task 2). The target is 50 ns per node on the reference
// machine: recorded, not gated. This expression's step count measures expression evaluation only.
const row = obj({ id: str({ maxLength: 32 }), n: int(), title: str({ maxLength: 64 }) });
const scope = rootScope({ data: obj({ rows: arr(row, { maxItems: 1000 }) }), params: obj({ k: int() }) });
const expr = {
  $sum: {
    $map: {
      in: { $filter: { in: { $path: "data.rows" }, as: "r", where: { $gt: [{ $path: "r.n" }, 10] } } },
      as: "r",
      index: "i",
      value: {
        $cond: [
          { $gt: [{ $path: "i" }, 5] },
          {
            $add: [
              { $mul: [{ $path: "r.n" }, { $path: "params.k" }] },
              { $len: { $concat: [{ $path: "r.id" }, "-", { $path: "r.title" }] } },
            ],
          },
          { $sub: [{ $path: "i" }, 1] },
        ],
      },
    },
  },
};
const compiled = compileExpression(expr, scope);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.errors));
const rows = Array.from({ length: 1000 }, (_, i) => ({ id: `row-${i}`, n: i, title: `Title number ${i}` }));
const slots: unknown[] = [];
slots[scope.names.get("data")?.slot as number] = { rows };
slots[scope.names.get("params")?.slot as number] = { k: 3 };
const run = compiled.value;
const frame = (): Frame => ({ slots, steps: 100_000_000 });

for (let i = 0; i < 20; i++) run(frame());
const f = frame();
run(f);
const nodes = 100_000_000 - f.steps;
const rounds = 200;
const times: number[] = [];
for (let i = 0; i < rounds; i++) {
  const start = performance.now();
  run(frame());
  times.push(performance.now() - start);
}
const median = times.sort((a, b) => a - b)[rounds >> 1] as number;
const ns = (median * 1e6) / nodes;
metric("template.expr.nsPerNode", ns);
console.log(`template expression evaluation: ${ns.toFixed(1)} ns/node over ${nodes} nodes (target 50, recorded)`);

// renderTemplate on the agent-home template (plan 028 Task 4): ≤ 3 µs per output node, the bar `render()` meets.
// Each run includes the input checks and the shared build and validation, as the render bench's do; the
// selected row cycles so the focus card changes between runs.
const home = proofWidgets.find((widget) => widget.name === "agent-home");
assert(home, "agent-home widget missing");
const ready = freezeCopy(home.scenarios.find((scenario) => scenario.name === "ready") ?? home.scenarios[0]);
const validator = compileValidator({ catalog, capabilities, manifest: home.manifest });
const frozen = freezeCopy(agentHomeTemplate);
const inputsAt = (i: number) => ({
  params: ready.params,
  data: ready.data,
  context: ready.context,
  state: { ...(ready.state as object), selected: `task-${i % 50}` },
});
// Count the steps for the first selection without instrumenting the timed renders.
let low = 1;
let high = 1_000_000;
while (low < high) {
  const steps = Math.floor((low + high) / 2);
  const result = renderTemplate(frozen, inputsAt(0), { validator, surfaceId: "proof", revision: 0, limits: { steps } });
  if (result.ok) high = steps;
  else {
    assert.equal(result.errors[0]?.expected, "a template that fits limits.steps");
    low = steps + 1;
  }
}
metric("template.agentHome.steps", low);
console.log(`agent-home template: ${low} steps for the first selection`);

const treeAt = (i: number) => {
  const result = renderTemplate(frozen, inputsAt(i), { validator, surfaceId: "proof", revision: 0 });
  assert(result.ok, `agent-home template: ${JSON.stringify(!result.ok && result.errors)}`);
  return result.value;
};
const BATCHES = 5;
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
const middle = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1] as number;

// Compile once per operator so the gate measures evaluation, including dynamic operand checks.
{
  const x = { $path: "x" };
  const y = { $path: "y" };
  const cases: [string, unknown, (size: number, items: number) => unknown[]][] = [
    ["len", { $len: x }, (n) => ["😀".repeat(n / 2)]],
    ["lenAscii", { $len: x }, (n) => ["a".repeat(n)]],
    ["lenMixed", { $len: x }, (n) => [`😀${"Ā".repeat(n - 2)}`]],
    ["concat", { $concat: [x, x] }, (n) => ["é".repeat(n / 2)]],
    ["join", { $join: [x, y] }, (n, items) => [Array(items).fill("é".repeat(n / items - 1)), ","]],
    ["joinEmptyParts", { $join: [x, ""] }, (_, items) => [Array(items).fill("")]],
    ["containsString", { $contains: [x, y] }, (n) => ["a".repeat(n), `${"a".repeat(n / 4)}b`]],
    ["containsArray", { $contains: [x, 0] }, (_, items) => [Array(items).fill(1)]],
    [
      "containsStringItems",
      { $contains: [x, y] },
      (n, items) => [Array(items).fill("a".repeat(n / items)), "b".repeat(n / items)],
    ],
    ["equalStrings", { $eq: [x, y] }, (n) => ["Ā".repeat(n), `${"Ā".repeat(n - 1)}b`]],
    ["split", { $split: [x, ","] }, (n, items) => [`${",".repeat(items - 1)}${"a".repeat(n - items + 1)}`]],
    ["sliceString", { $slice: [x, 0, y] }, (n) => ["😀".repeat(n / 2), n]],
    ["sliceAscii", { $slice: [x, 0, y] }, (n) => ["a".repeat(n), n]],
    ["sliceArray", { $slice: [x, 0] }, (_, items) => [Array(items).fill(true)]],
    ["sum", { $sum: x }, (_, items) => [Array(items).fill(1.5)]],
    ["flat", { $flat: x }, (_, items) => [Array.from({ length: items }, () => [1])]],
    ["flatEmptyParts", { $flat: x }, (_, items) => [Array.from({ length: items }, () => [])]],
    [
      "merge",
      { $merge: [x, y] },
      (_, items) => [Object.fromEntries(Array.from({ length: items }, (_, i) => [`k${i}`, i])), {}],
    ],
    ["fromEntries", { $fromEntries: x }, (_, items) => [Array.from({ length: items }, (_, i) => [`k${i}`, i])]],
    ["map", { $map: { in: x, as: "item", value: { $path: "item" } } }, (_, items) => [Array(items).fill(1)]],
    ["filter", { $filter: { in: x, as: "item", where: true } }, (_, items) => [Array(items).fill(1)]],
    ["findIndex", { $findIndex: { in: x, as: "item", where: false } }, (_, items) => [Array(items).fill(1)]],
  ];
  let worst = 0;
  for (const [name, expr, input] of cases) {
    const scope = dynamicScope(["x", "y"]);
    const compiled = compileExpression(expr, scope);
    assert(compiled.ok, `${name}: ${JSON.stringify(!compiled.ok && compiled.errors)}`);
    const measurements: number[] = [];
    for (const size of [1024, 65_536, 1_048_576]) {
      const slots = input(size, size / 16);
      slots.length = scope.budget.slots;
      const f = { slots, steps: 100_000_000 };
      const run = () => {
        f.steps = 100_000_000;
        return compiled.value(f);
      };
      run();
      const steps = 100_000_000 - f.steps;
      const cpuMs = middle(Array.from({ length: 3 }, () => batch(run).cpuMs));
      const ns = (cpuMs * 1e6) / steps;
      metric(`template.operator.${name}.${size}.nsPerStep`, ns);
      measurements.push(ns);
      worst = Math.max(worst, ns);
    }
    console.log(
      `template ${name}: ${measurements.map((ns) => ns.toFixed(2)).join(", ")} ns/step (1 KiB, 64 KiB, 1 MiB inputs)`,
    );
  }
  metric("template.operator.worstNsPerStep", worst);
  console.log(`template worst operator per step: ${worst.toFixed(2)} ns/step (budget 25)`);
  budget(worst <= 25, `template worst operator per step: ${worst.toFixed(2)} ns/step exceeds the 25 ns budget`);
}

for (let i = 0; i < 200; i++) treeAt(i);
const samples = Array.from({ length: BATCHES }, () => batch(treeAt));
const renderMs = middle(samples.map((sample) => sample.wallMs));
const renderCpuMs = middle(samples.map((sample) => sample.cpuMs));
const outputNodes = Array.from({ length: 50 }, (_, i) => countNodes(treeAt(i).root)).reduce((a, b) => a + b) / 50;
const perNode = (renderMs * 1_000) / outputNodes;
metric("template.agentHome.renderMs", renderMs);
metric("template.agentHome.usPerNode", perNode);
metric("template.agentHome.renderCpuMs", renderCpuMs);
console.log(
  `agent-home template: ${outputNodes.toFixed(1)} mean nodes; renderTemplate ${renderMs.toFixed(4)} ms, ${perNode.toFixed(3)} µs/node (budget 3)`,
);
budget(perNode <= 3, `agent-home template: ${perNode.toFixed(3)} µs/node exceeds the 3 µs budget`);

// templateRunner (plan 028 Task 5): it adds the hash check (cached for a frozen package), a validator lookup,
// a clock read and a promise to renderTemplate. Budget: ≤ 5% over it on the same template and inputs.
const installed = { catalog: validateCatalog(catalog), capabilities: validateCapabilities(capabilities) };
assert(installed.catalog.ok && installed.capabilities.ok, "proof documents invalid");
const packed = pack(
  { template: agentHomeTemplate, manifest: home.manifest, scenarios: home.scenarios },
  { catalog: installed.catalog.value, capabilities: installed.capabilities.value },
);
assert(packed.ok, `agent-home template package: ${JSON.stringify(!packed.ok && packed.errors)}`);
const runner = templateRunner();
const runnerOptions = {
  catalog: catalog as never,
  capabilities: capabilities as never,
  surfaceId: "proof",
  revision: 0,
};
const runnerAt = async (i: number) => {
  const result = await runner.render(packed.value, inputsAt(i), runnerOptions);
  assert(result.ok, "agent-home template package");
};
async function asyncBatch(run: (i: number) => Promise<void>): Promise<number> {
  let iterations = 16;
  for (;;) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) await run(i);
    const elapsed = performance.now() - start;
    if (elapsed >= BATCH_MS || iterations >= 10_000_000) return elapsed / iterations;
    iterations *= 2;
  }
}
for (let i = 0; i < 200; i++) await runnerAt(i);
const direct: number[] = [];
const viaRunner: number[] = [];
for (let round = 0; round < 7; round++) {
  direct.push(batch(treeAt).wallMs);
  viaRunner.push(await asyncBatch(runnerAt));
}
const overhead = middle(viaRunner) / middle(direct) - 1;
metric("template.runner.overhead", overhead);
console.log(`templateRunner: ${(overhead * 100).toFixed(2)}% over renderTemplate (budget 5%)`);
budget(overhead <= 0.05, `templateRunner adds ${(overhead * 100).toFixed(2)}% over renderTemplate, over the 5% budget`);

// Plan 033 T9: validateTemplate CPU-time budget moved from template-document.test.ts (<= 5 ms).
{
  const context = { catalog: catalog as never, capabilities: capabilities as never, manifest: home.manifest };
  for (let i = 0; i < 5; i++) assert(validateTemplate(agentHomeTemplate, context).ok, "agentHomeTemplate warmup");
  const samples: number[] = [];
  for (let r = 0; r < 9; r++) {
    const start = process.cpuUsage();
    for (let b = 0; b < 10; b++) assert(validateTemplate(agentHomeTemplate, context).ok, "agentHomeTemplate");
    const used = process.cpuUsage(start);
    samples.push((used.user + used.system) / 1000 / 10);
  }
  samples.sort((a, b) => a - b);
  const validateCpuMs = samples[Math.floor(samples.length / 2)] as number;
  metric("validateTemplate.agentHome.cpuMs", validateCpuMs);
  console.log(`validateTemplate (agent-home): ${validateCpuMs.toFixed(3)} ms CPU (<= 5 ms)`);
  budget(validateCpuMs <= 5, `validateTemplate agent-home CPU time ${validateCpuMs.toFixed(3)} ms exceeds 5 ms`);
}
