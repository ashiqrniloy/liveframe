import { strict as assert } from "node:assert";
import { cpus, loadavg, platform, release } from "node:os";
import type { WidgetPackage } from "@arnilo/liveframe/pack";
import { inProcessRunner, type Runner, templateRunner } from "@arnilo/liveframe/preview";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import { quickjsRunner } from "../packages/runner-quickjs/src/index.ts";
import {
  codePackages,
  renderOptions,
  templatePackage,
  widget,
} from "../packages/runner-quickjs/src/__tests__/fixtures.ts";
import { budget, metric } from "./metrics.ts";

// Runner cost (plan 031 Task 5; budgets from decision-logs/2026-11-08-2310-isolated-runner-starter-and-workspace.md).
// Every figure is wall time through `Runner.render`, so it includes validation and, for QuickJS, the IPC.
// The code package is agent-home (the proof surface); "smallest" is a one-text-node widget.
const agentHome = codePackages[0] as WidgetPackage;
const ready = agentHome.scenarios.find((scenario) => scenario.name === "ready") ?? (agentHome.scenarios[0] as never);
const homeInputs = {
  params: ready.params,
  state: ready.state ?? agentHome.manifest.initialState,
  context: ready.context,
  data: ready.data,
  actions: ready.actions ?? {},
};
const smallest = widget("bench.small", 'export default () => show("hello");');
const smallInputs = { params: {}, state: {}, context: {}, data: {}, actions: {} };
// A render must outlive nothing: a long limit keeps a slow host from failing a measured render.
const options = { ...renderOptions, timeoutMs: 5000 };

const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1] as number;
const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length * 0.95)] as number;

async function once(runner: Runner, pkg: WidgetPackage, inputs: typeof homeInputs | typeof smallInputs) {
  const start = performance.now();
  const result = await runner.render(pkg, inputs as never, options);
  const ms = performance.now() - start;
  assert(result.ok, `render failed: ${JSON.stringify(!result.ok && result.errors)}`);
  return ms;
}
async function warm(runner: Runner, pkg: WidgetPackage, inputs: typeof homeInputs | typeof smallInputs, runs: number) {
  for (let i = 0; i < 3; i++) await once(runner, pkg, inputs);
  const times: number[] = [];
  for (let i = 0; i < runs; i++) times.push(await once(runner, pkg, inputs));
  return times;
}

console.log(`Bun ${Bun.version}; ${platform()} ${release()}; ${cpus()[0]?.model}; ${cpus().length} logical CPUs`);
console.log(`Load average (1/5/15 min): ${loadavg().join(", ")}; 3 warm-ups, then the median of N renders per row`);
console.log("runner               surface   cold ms   median ms   p95 ms");

type Row = { name: string; key: string; make: () => Runner | Promise<Runner>; runs: number };
const rows: Row[] = [
  { name: "inProcessRunner", key: "inProcess", make: () => inProcessRunner(), runs: 200 },
  { name: "workerRunner", key: "worker", make: () => workerRunner(), runs: 100 },
  { name: "quickjs none", key: "quickjsNone", make: () => quickjsRunner(), runs: 30 },
  { name: "quickjs package", key: "quickjsPackage", make: () => quickjsRunner({ reuse: "package" }), runs: 100 },
];
const figures: Record<string, { median: number; p95: number; cold: number }> = {};
for (const row of rows) {
  for (const [surface, pkg, inputs] of [
    ["agent-home", agentHome, homeInputs],
    ["smallest", smallest, smallInputs],
  ] as const) {
    const runner = await row.make();
    const cold = await once(runner, pkg, inputs);
    const times = await warm(runner, pkg, inputs, row.runs);
    (runner as { close?(): void }).close?.();
    const figure = { median: median(times), p95: p95(times), cold };
    figures[`${row.key}.${surface}`] = figure;
    metric(`runner.${row.key}.${surface}.medianMs`, figure.median);
    metric(`runner.${row.key}.${surface}.coldMs`, figure.cold);
    console.log(
      `${row.name.padEnd(20)} ${surface.padEnd(9)} ${cold.toFixed(2).padStart(8)} ${figure.median.toFixed(3).padStart(11)} ${figure.p95.toFixed(3).padStart(8)}`,
    );
  }
}
{
  // The template port of agent-home: the same tree from `templateRunner`, with no author code.
  const runner = templateRunner();
  const cold = await once(runner, templatePackage, homeInputs);
  const times = await warm(runner, templatePackage, homeInputs, 200);
  metric("runner.template.agent-home.medianMs", median(times));
  console.log(
    `${"templateRunner".padEnd(20)} ${"agent-home".padEnd(9)} ${cold.toFixed(2).padStart(8)} ${median(times).toFixed(3).padStart(11)} ${p95(times).toFixed(3).padStart(8)}`,
  );
}

// Child cold start: spawn, compile the wasm, read the kit, report ready.
const starts: number[] = [];
for (let i = 0; i < 9; i++) {
  const start = performance.now();
  (await quickjsRunner()).close();
  starts.push(performance.now() - start);
}
const coldStart = median(starts);
metric("runner.quickjs.childColdStartMs", coldStart);
console.log(`quickjs child cold start: median ${coldStart.toFixed(1)} ms (budget 60)`);

// A hold in one uninterruptible native call: wait for the deadline, kill, start a child, render the next request.
const hold = widget("bench.hold", 'export default () => show("a".repeat(1e7).indexOf("a".repeat(5e6) + "b"));');
const recoveries: number[] = [];
{
  const runner = await quickjsRunner();
  await once(runner, smallest, smallInputs);
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const held = await runner.render(hold, smallInputs as never, { ...renderOptions, timeoutMs: 50 });
    assert(!held.ok && held.errors[0]?.kind === "limit-exceeded", "the hold was not stopped");
    await once(runner, smallest, smallInputs);
    recoveries.push(performance.now() - start);
  }
  runner.close();
}
const recovery = median(recoveries);
metric("runner.quickjs.recoveryMs", recovery);
console.log(
  `quickjs hold, kill, recover and next render (timeoutMs 50): median ${recovery.toFixed(1)} ms (budget 300)`,
);

const get = (key: string) => figures[key] as { median: number };
budget(
  get("quickjsNone.agent-home").median <= 110,
  `quickjs none agent-home ${get("quickjsNone.agent-home").median.toFixed(1)} ms exceeds 110 ms`,
);
budget(
  get("quickjsNone.smallest").median <= 60,
  `quickjs none smallest ${get("quickjsNone.smallest").median.toFixed(1)} ms exceeds 60 ms`,
);
budget(
  get("quickjsPackage.agent-home").median <= 60,
  `quickjs package agent-home ${get("quickjsPackage.agent-home").median.toFixed(1)} ms exceeds 60 ms`,
);
budget(
  get("quickjsPackage.smallest").median <= 8,
  `quickjs package smallest ${get("quickjsPackage.smallest").median.toFixed(1)} ms exceeds 8 ms`,
);
budget(coldStart <= 60, `quickjs child cold start ${coldStart.toFixed(1)} ms exceeds 60 ms`);
budget(recovery <= 300, `quickjs recovery ${recovery.toFixed(1)} ms exceeds 300 ms`);
