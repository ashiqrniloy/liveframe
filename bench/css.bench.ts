import { strict as assert } from "node:assert";
import { baseCss, designSystemCss, styleDeclarations, themeCss } from "../src/css/index.ts";
import {
  type Catalog,
  type DesignSystem,
  type Result,
  resolveRecipes,
  type Theme,
  type UiNode,
  type UiTree,
  validateDesignSystem,
  validateTheme,
} from "../src/index.ts";
import { budget, metric } from "./metrics.ts";

const read = (name: string) =>
  Bun.file(new URL(`../src/__tests__/fixtures/proof/${name}.json`, import.meta.url)).json();
const catalog: Catalog = await read("catalog");
const runsFlag = Bun.argv.indexOf("--runs");
/** `--runs <n>` shortens a smoke run; the default is the measured figure. */
const runs = runsFlag >= 0 ? Number(Bun.argv[runsFlag + 1]) : 1000;

const tree: UiTree = await read("agent-home.tree");
const nodes: UiNode[] = [];
function collect(node: UiNode): void {
  nodes.push(node);
  for (const child of node.children ?? []) collect(child);
}
collect(tree.root);
function projectTree(): void {
  for (const node of nodes) styleDeclarations(node.style ?? {}, catalog);
}
for (let i = 0; i < 200; i++) projectTree();
const styleStart = performance.now();
for (let i = 0; i < runs; i++) projectTree();
const treeMs = (performance.now() - styleStart) / runs;
metric("styleDeclarations.usPerNode", (treeMs * 1000) / nodes.length);
metric("styleDeclarations.msPerTree", treeMs);
console.log(
  `style_declarations_per_node: ${((treeMs * 1000) / nodes.length).toFixed(3)} µs/node; ${treeMs.toFixed(3)} ms/tree; ${nodes.length} nodes`,
);

function measure(name: string, project: () => Result<string>): void {
  const result = project();
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  for (let i = 0; i < 200; i++) project();
  const start = performance.now();
  for (let i = 0; i < runs; i++) {
    const next = project();
    if (!next.ok || next.value !== result.value) throw new Error(`Non-deterministic projection: ${name}`);
  }
  const sheetMs = (performance.now() - start) / runs;
  metric(`${name.replaceAll(" ", "-")}.msPerSheet`, sheetMs);
  console.log(`${name}: ${sheetMs.toFixed(3)} ms/sheet; ${new TextEncoder().encode(result.value).length} bytes`);
}

measure("base", () => baseCss(catalog));
for (const name of ["certified", "rack"]) {
  const theme: Theme = await read(`${name}.theme`);
  measure(`${name} theme`, () => themeCss(theme, catalog));
  const system: DesignSystem = await read(`${name}.design-system`);
  measure(`${name} design system`, () => designSystemCss(system, { catalog, registry: {} }));
}

// `src/__tests__/bench-json.test.ts` asserts exact metric keys when `--runs <n>` is passed.
if (runsFlag < 0) {
  const medianCpu = (fn: () => void, rounds = 9, batch = 10) => {
    for (let i = 0; i < 3; i++) fn();
    const samples: number[] = [];
    for (let r = 0; r < rounds; r++) {
      const start = process.cpuUsage();
      for (let b = 0; b < batch; b++) fn();
      const used = process.cpuUsage(start);
      samples.push((used.user + used.system) / 1000 / batch);
    }
    samples.sort((a, b) => a - b);
    return samples[Math.floor(samples.length / 2)] as number;
  };

  for (const name of ["certified", "rack"]) {
    const theme = await read(`${name}.theme`);
    const cpuMs = medianCpu(() => {
      assert(validateTheme(theme, catalog.vocabulary).ok, `${name} theme validates`);
    });
    metric(`${name}ThemeValidate.cpuMs`, cpuMs);
    console.log(`validateTheme (${name}): ${cpuMs.toFixed(3)} ms CPU (<= 2 ms)`);
    budget(cpuMs <= 2, `validateTheme (${name}) CPU ${cpuMs.toFixed(3)} ms exceeds 2 ms`);
  }

  const rackDoc = await Bun.file(new URL("../src/__tests__/fixtures/rack.design-system.json", import.meta.url)).json();
  const rackCatalog = (await Bun.file(
    new URL("../src/__tests__/fixtures/catalog.json", import.meta.url),
  ).json()) as Catalog;
  rackCatalog.vocabulary = await Bun.file(
    new URL("../src/__tests__/fixtures/rack.design-system-vocabulary.json", import.meta.url),
  ).json();
  const rackCpuMs = medianCpu(
    () => {
      const validated = validateDesignSystem(rackDoc, { catalog: rackCatalog, registry: {} });
      assert(validated.ok, "rack design system validates");
      const resolved = resolveRecipes(validated.value, { catalog: rackCatalog, registry: {} });
      assert(Object.keys(resolved).length === 948, "rack recipes resolve");
    },
    7,
    3,
  );
  metric("rackDesignSystemValidateResolve.cpuMs", rackCpuMs);
  console.log(`validateDesignSystem + resolveRecipes (rack): ${rackCpuMs.toFixed(3)} ms CPU (<= 50 ms)`);
  budget(rackCpuMs <= 50, `rack validate+resolve CPU ${rackCpuMs.toFixed(3)} ms exceeds 50 ms`);

  // Plan 033 T9: 16.67 ms (60 Hz frame) browser switch budgets moved out of bun run check.
  const runSwitchTest = async (args: string[]): Promise<string> => {
    const child = Bun.spawn({
      cmd: ["bun", "test", "--conditions", "liveframe:source", ...args],
      stdout: "pipe",
      stderr: "pipe",
      timeout: 120_000,
    });
    const [out, err] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
    assert.equal(await child.exited, 0, out + err);
    return out + err;
  };

  const proofOut = await runSwitchTest(["proof/tests/switch.test.ts"]);
  const proofMatches = [...proofOut.matchAll(/(\S+) CSS switch: cold [\d.]+ ms; ([\d.]+) ms max/g)];
  assert.equal(proofMatches.length, 2, proofOut);
  for (const [, name, maxStr] of proofMatches) {
    const max = Number(maxStr);
    metric(`browserSwitch.${name}.maxMs`, max);
    budget(max <= 16.67, `${name} CSS switch max ${max.toFixed(2)} ms exceeds 16.67 ms`);
  }

  const scopeOut = await runSwitchTest([
    "src/__tests__/css-scope-browser.test.ts",
    "--test-name-pattern",
    "^(switch_under_budget_with_blur|switch_under_budget_with_a_two_axis_kind_installed)$",
  ]);
  for (const [label, key] of [
    ["Two-surface CSS switch with blur", "twoSurfaceBlur"],
    ["Two-surface CSS switch with a two-axis kind", "twoSurfaceTwoAxis"],
  ] as const) {
    const match = scopeOut.match(new RegExp(`${label}: (\\{[^\\n]*\\})`));
    assert(match?.[1], scopeOut);
    const parsed = JSON.parse(match[1]) as { samples: { library: number }[] };
    const max = Math.max(...parsed.samples.map((s) => s.library));
    assert(Number.isFinite(max), scopeOut);
    metric(`browserSwitch.${key}.maxMs`, max);
    budget(max <= 16.67, `${label} max ${max.toFixed(2)} ms exceeds 16.67 ms`);
  }

  const reactOut = await runSwitchTest([
    "src/__tests__/react-browser.test.tsx",
    "--test-name-pattern",
    "^switch_under_budget_with_blur_through_surface$",
  ]);
  const reactMatch = reactOut.match(/Surface two-surface switch with blur: (\{[^\n]*\})/);
  assert(reactMatch?.[1], reactOut);
  const reactMax = Math.max(
    ...(JSON.parse(reactMatch[1]) as { samples: { library: number }[] }).samples.map((s) => s.library),
  );
  assert(Number.isFinite(reactMax), reactOut);
  metric("browserSwitch.surfaceBlur.maxMs", reactMax);
  budget(reactMax <= 16.67, `Surface two-surface switch with blur max ${reactMax.toFixed(2)} ms exceeds 16.67 ms`);

  const starterOut = await runSwitchTest(["packages/starter/src/__tests__/switch.test.tsx"]);
  const starterMatch = starterOut.match(/Starter switch \(\d+ elements\): cold [\d.]+ ms, warm max ([\d.]+) ms/);
  assert(starterMatch?.[1], starterOut);
  const starterMax = Number(starterMatch[1]);
  metric("browserSwitch.starter.maxMs", starterMax);
  budget(starterMax <= 16.67, `Starter switch warm max ${starterMax.toFixed(2)} ms exceeds 16.67 ms`);
}
