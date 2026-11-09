// Plan 031 Task 8 soak: does the QuickJS runner's child process grow, and does a kill leave nothing behind?
// Run: bun --conditions liveframe:source plans/evidence/031-soak.ts   (Linux: reads /proc)
import { readFileSync } from "node:fs";
import { codePackages, renderOptions, widget } from "../../packages/runner-quickjs/src/__tests__/fixtures.ts";
import { quickjsRunner } from "../../packages/runner-quickjs/src/index.ts";

const children = (): number[] =>
  Bun.spawnSync(["pgrep", "-P", String(process.pid)])
    .stdout.toString()
    .split("\n")
    .filter(Boolean)
    .map(Number);
const rssMiB = (pid: number): number => {
  const line = readFileSync(`/proc/${pid}/status`, "utf8")
    .split("\n")
    .find((l) => l.startsWith("VmRSS"));
  return Math.round(Number(line?.match(/\d+/)?.[0] ?? 0) / 1024);
};
const options = { ...renderOptions, timeoutMs: 5000 };
const empty = { params: {}, state: {}, context: {}, data: {}, actions: {} };
const home = codePackages[0];
if (!home) throw new Error("no agent-home");
const ready = home.scenarios.find((s) => s.name === "ready") ?? home.scenarios[0];
if (!ready) throw new Error("no scenario");
const homeInputs = {
  params: ready.params,
  state: ready.state ?? home.manifest.initialState,
  context: ready.context,
  data: ready.data,
  actions: ready.actions ?? {},
};

async function soak(name: string, make: () => ReturnType<typeof quickjsRunner>, renders: number, every: number) {
  const runner = await make();
  const [pid] = children();
  if (pid === undefined) throw new Error("no child");
  const samples: string[] = [`start ${rssMiB(pid)}`];
  for (let i = 1; i <= renders; i++) {
    const pkg = codePackages[i % codePackages.length] as (typeof codePackages)[number];
    const result = await runner.render(
      pkg,
      (pkg === home ? homeInputs : { ...empty, state: pkg.manifest.initialState }) as never,
      options,
    );
    if (!result.ok && pkg === home) throw new Error(JSON.stringify(result.errors));
    if (i % every === 0) samples.push(`${i}:${rssMiB(pid)}`);
  }
  runner.close();
  console.log(`${name} (MiB resident): ${samples.join("  ")}`);
}

await soak("reuse none, 5 packages", () => quickjsRunner(), 500, 100);
await soak("reuse package, 5 packages", () => quickjsRunner({ reuse: "package" }), 1000, 200);

// Kills: each hold ends the child; nothing may be left running afterwards.
const runner = await quickjsRunner({ timeoutMs: 50 });
const spin = widget("soak.spin", 'export default () => show("a".repeat(1e7).indexOf("a".repeat(5e6) + "b"));');
const seen = new Set<number>();
for (let i = 0; i < 15; i++) {
  for (const pid of children()) seen.add(pid);
  const start = performance.now();
  const result = await runner.render(spin, empty as never, { ...renderOptions, timeoutMs: 50 });
  if (result.ok) throw new Error("the hold was not stopped");
  if (i === 0) console.log(`first kill: ${Math.round(performance.now() - start)} ms, ${result.errors[0]?.kind}`);
}
const recovered = await runner.render(widget("soak.ok", 'export default () => show("ok");'), empty as never, options);
runner.close();
await Bun.sleep(300);
const alive = [...seen].filter((pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
});
console.log(
  `15 kills, recovered=${recovered.ok}, children seen ${seen.size}, still alive after close: ${alive.length}`,
);
