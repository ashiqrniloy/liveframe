import { type Result, validateCapabilities, validateCatalog } from "../src/index.ts";
import { bundle } from "../src/pack/bundle.ts";
import { canonicalJson, packageHash, renderKey, sha256, utf8 } from "../src/pack/hash.ts";
import { pack, type Scenario, verifyPackage } from "../src/pack/index.ts";
import catalogDoc from "../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import capabilitiesDoc from "../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "../src/__tests__/fixtures/widgets/index.ts";
import { budget, metric } from "./metrics.ts";

/** Median wall time in ms of `run` over `rounds` calls, after a warm-up. */
function median(run: () => unknown, rounds: number): number {
  for (let i = 0; i < 3; i++) run();
  const times: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  return times.sort((a, b) => a - b)[Math.floor(rounds / 2)] as number;
}

/** Median CPU time in ms of `run` over `rounds` samples of `batch` calls, after a warm-up. */
function medianCpu(run: () => unknown, rounds: number, batch = 1): number {
  for (let i = 0; i < 3; i++) run();
  const times: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const start = process.cpuUsage();
    for (let j = 0; j < batch; j++) run();
    const used = process.cpuUsage(start);
    times.push((used.user + used.system) / 1000 / batch);
  }
  return times.sort((a, b) => a - b)[Math.floor(rounds / 2)] as number;
}

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const mib = new Uint8Array(1 << 20);
for (let i = 0; i < mib.length; i++) mib[i] = (i * 31 + 7) & 255;
const shaMs = median(() => sha256(mib), 15);
metric("sha256.msPerMiB", shaMs);
console.log(`sha256: ${shaMs.toFixed(3)} ms per MiB`);

const text = "a".repeat(1 << 20);
const utfMs = median(() => utf8(text), 15);
metric("utf8.asciiMsPerMiB", utfMs);
console.log(`utf8 ascii: ${utfMs.toFixed(3)} ms per MiB`);

const mixed = "aé€😀".repeat(1 << 16);
const mixedMs = median(() => utf8(mixed), 15);
metric("utf8.mixedMsPerMiBChars", mixedMs);
console.log(`utf8 mixed: ${mixedMs.toFixed(3)} ms for ${mixed.length} UTF-16 units`);

// A package-shaped value: nested objects with sorted-key work, strings, numbers, arrays.
const rows = Array.from({ length: 2000 }, (_, i) => ({ id: `row-${i}`, label: `Label ${i}`, n: i, tags: ["x", "y"] }));
const value = { format: "liveframe-package/1", manifest: { rows }, code: "a".repeat(256 * 1024), scenarios: [] };
const canonicalMs = median(() => canonicalJson(value), 15);
metric("canonicalJson.ms", canonicalMs);
console.log(`canonicalJson: ${canonicalMs.toFixed(3)} ms`);

const pkg = {
  format: "liveframe-package/1" as const,
  manifest: { rows } as never,
  code: "a".repeat(512 * 1024),
  scenarios: [],
};
const packageMs = median(() => packageHash(pkg), 15);
metric("packageHash.512KiB.ms", packageMs);
console.log(`packageHash (512 KiB code + rows): ${packageMs.toFixed(3)} ms`);

// Plan 033 T9: CPU-time budgets moved from pack/pack-hash/pack-bundle unit tests.
const pkg1MiB = {
  format: "liveframe-package/1" as const,
  manifest: { rows: [] } as never,
  code: "a".repeat(1024 * 1024),
  scenarios: [],
};
const hash1MiBCpuMs = medianCpu(() => packageHash(pkg1MiB), 9);
metric("packageHash.1MiB.cpuMs", hash1MiBCpuMs);
console.log(`packageHash (1 MiB code): ${hash1MiBCpuMs.toFixed(3)} ms CPU (<= 50 ms)`);
budget(hash1MiBCpuMs <= 50, `packageHash 1 MiB CPU time ${hash1MiBCpuMs.toFixed(3)} ms exceeds 50 ms`);

const catalog = unwrap(validateCatalog(catalogDoc));
const capabilities = unwrap(validateCapabilities(capabilitiesDoc));
const options = { catalog, capabilities };
const fixture = proofWidgets[0];
if (!fixture) throw new Error("Missing agent-home fixture");
const widgetRoot = new URL("../src/__tests__/fixtures/widgets/", import.meta.url);
const paths = [
  "ui.gen.ts",
  ...["queue", "task-card", "decision-card", "alert-card", "facts", "queue-row"].map(
    (name) => `agent-home/${name}.tsx`,
  ),
];
const files = Object.fromEntries(
  await Promise.all(paths.map(async (path) => [path, await Bun.file(new URL(path, widgetRoot)).text()] as const)),
);
files["agent-home/queue.tsx"] += "\nexport default AgentHomeQueue;";
const packedAgentHome = unwrap(
  pack(
    {
      files,
      entry: "agent-home/queue.tsx",
      manifest: fixture.manifest,
      scenarios: fixture.scenarios as readonly Scenario[],
    },
    options,
  ),
);

function pairedSpeedup(baseline: () => unknown, streamed: () => unknown, rounds = 9, batch = 15): number {
  for (let i = 0; i < 5; i++) {
    baseline();
    streamed();
  }
  const speedups: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const startBase = process.cpuUsage();
    for (let j = 0; j < batch; j++) baseline();
    const usedBase = process.cpuUsage(startBase);
    const startStream = process.cpuUsage();
    for (let j = 0; j < batch; j++) streamed();
    const usedStream = process.cpuUsage(startStream);
    speedups.push((usedBase.user + usedBase.system) / (usedStream.user + usedStream.system));
  }
  return speedups.sort((a, b) => a - b)[Math.floor(rounds / 2)] as number;
}

const { format, manifest, scenarios, code } = packedAgentHome;
const agentHomeContent = { format, manifest, scenarios, code };
const packageAgentHomeMs = median(() => packageHash(packedAgentHome), 15);
const packageAgentHomeCpuMs = medianCpu(() => packageHash(packedAgentHome), 9, 10);
const packageAgentHomeSpeedup = pairedSpeedup(
  () => `sha256-${sha256(utf8(canonicalJson(agentHomeContent)))}`,
  () => packageHash(packedAgentHome),
);
metric("packageHash.agentHome.ms", packageAgentHomeMs);
metric("packageHash.agentHome.cpuMs", packageAgentHomeCpuMs);
metric("packageHash.agentHome.speedup", packageAgentHomeSpeedup);
console.log(
  `packageHash (agent-home, 199 KiB): ${packageAgentHomeMs.toFixed(3)} ms wall, ${packageAgentHomeCpuMs.toFixed(3)} ms CPU (<= 5 ms), ${packageAgentHomeSpeedup.toFixed(2)}× vs 2-pass (>= 2×)`,
);
budget(
  packageAgentHomeCpuMs <= 5,
  `packageHash agent-home CPU time ${packageAgentHomeCpuMs.toFixed(3)} ms exceeds 5 ms`,
);
budget(
  packageAgentHomeSpeedup >= 2,
  `packageHash agent-home speedup ${packageAgentHomeSpeedup.toFixed(2)}× is below 2×`,
);

// Plan 034 T4: 1,000-row synthetic renderKey input (~109 KB of canonical JSON).
const renderKeyRows = Array.from({ length: 1000 }, (_, i) => ({
  id: `task-${i}`,
  title: `Synthetic task ${i}`,
  detail: "Waiting on you",
  owner: "You",
  status: "ok",
  count: i % 10,
}));
const renderKeyInput = {
  hash: packedAgentHome.hash,
  catalogId: catalog.catalogId,
  params: {},
  state: { selected: "task-0" },
  data: { rows: renderKeyRows },
  context: { size: "md" },
};
const renderKeyFull = { ...renderKeyInput, actions: {} };
const renderKeyMs = median(() => renderKey(renderKeyInput), 15);
const renderKeyCpuMs = medianCpu(() => renderKey(renderKeyInput), 9, 10);
const renderKeySpeedup = pairedSpeedup(
  () => sha256(utf8(canonicalJson(renderKeyFull))),
  () => renderKey(renderKeyInput),
);
metric("renderKey.109KiB.ms", renderKeyMs);
metric("renderKey.109KiB.cpuMs", renderKeyCpuMs);
metric("renderKey.109KiB.speedup", renderKeySpeedup);
console.log(
  `renderKey (1,000 rows, ${canonicalJson(renderKeyFull).length} B): ${renderKeyMs.toFixed(3)} ms wall, ${renderKeyCpuMs.toFixed(3)} ms CPU (<= 3 ms), ${renderKeySpeedup.toFixed(2)}× vs 2-pass (>= 2×)`,
);
budget(renderKeyCpuMs <= 3, `renderKey 109 KiB CPU time ${renderKeyCpuMs.toFixed(3)} ms exceeds 3 ms`);
budget(renderKeySpeedup >= 2, `renderKey 109 KiB speedup ${renderKeySpeedup.toFixed(2)}× is below 2×`);

const verifyCpuMs = medianCpu(() => unwrap(verifyPackage(packedAgentHome, options)), 9, 5);
metric("verifyPackage.agentHome.cpuMs", verifyCpuMs);
console.log(`verifyPackage (agent-home): ${verifyCpuMs.toFixed(3)} ms CPU (<= 20 ms)`);
budget(verifyCpuMs <= 20, `verifyPackage agent-home CPU time ${verifyCpuMs.toFixed(3)} ms exceeds 20 ms`);

const bundleCpuMs = medianCpu(() => unwrap(bundle({ files, entry: "agent-home/queue.tsx" })), 9, 5);
metric("bundle.agentHome.cpuMs", bundleCpuMs);
console.log(`bundle (agent-home): ${bundleCpuMs.toFixed(3)} ms CPU (<= 100 ms)`);
budget(bundleCpuMs <= 100, `bundle agent-home CPU time ${bundleCpuMs.toFixed(3)} ms exceeds 100 ms`);
