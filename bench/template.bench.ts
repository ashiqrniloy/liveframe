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
import { renderTemplate } from "../src/template/render.ts";
import { rootScope } from "../src/template/scope.ts";
import { budget, metric } from "./metrics.ts";

// Evaluation cost per expression node (plan 028 Task 2). The target is 50 ns per node on the reference
// machine: recorded, not gated. One step is one node evaluated, so `steps spent` is the node count.
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
const treeAt = (i: number) => {
  const result = renderTemplate(frozen, inputsAt(i), { validator, surfaceId: "proof", revision: 0 });
  assert(result.ok, `agent-home template: ${JSON.stringify(!result.ok && result.errors)}`);
  return result.value;
};
const BATCHES = 5;
const BATCH_MS = 50;
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
for (let i = 0; i < 200; i++) treeAt(i);
const samples = Array.from({ length: BATCHES }, () => batch(treeAt)).sort((a, b) => a - b);
const renderMs = samples[BATCHES >> 1] as number;
const outputNodes = Array.from({ length: 50 }, (_, i) => countNodes(treeAt(i).root)).reduce((a, b) => a + b) / 50;
const perNode = (renderMs * 1_000) / outputNodes;
metric("template.agentHome.renderMs", renderMs);
metric("template.agentHome.usPerNode", perNode);
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
  direct.push(batch(treeAt));
  viaRunner.push(await asyncBatch(runnerAt));
}
const middle = (values: number[]) => values.sort((a, b) => a - b)[values.length >> 1] as number;
const overhead = middle(viaRunner) / middle(direct) - 1;
metric("template.runner.overhead", overhead);
console.log(`templateRunner: ${(overhead * 100).toFixed(2)}% over renderTemplate (budget 5%)`);
budget(overhead <= 0.05, `templateRunner adds ${(overhead * 100).toFixed(2)}% over renderTemplate, over the 5% budget`);
