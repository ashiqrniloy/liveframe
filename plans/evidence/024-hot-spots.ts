// Plan 024 Task 6 (R16, R25): does each minor hot-spot candidate gain at least 10% on its own call?
//
//   bun --conditions liveframe:source plans/evidence/024-hot-spots.ts [rounds]   (default 31; about 3 minutes at load 8)
//
// The condition makes the fixture widgets' SDK imports resolve to src/, as `bun run test` does.
//
// Base is each file as it stood at the task's starting commit (`git show 8dac0fa:<file>`), written
// next to the original so its relative imports resolve. Head is either a throwaway edit of that
// source (rejected candidates) or the live file (kept candidates). Both run interleaved in this
// process, outputs are compared first, and every written file is deleted on exit. The micro-bench
// for each item is the smallest public call that contains it:
//   1  validateJson  [Object.prototype, null].includes(...) → two comparisons   validateJson(agent-home tree)
//   2  bundle walk   for…in, a Set for function types, one walk (live src, kept) bundle(agent-home widget)
//   5  themeCss      a content-checked cache of validateCatalog (live src, kept) themeCss(certified theme), hit and miss
//   6  diffTrees     a "first unplaced child" pointer, no indexOf or splice      diffTrees (live src, kept)
//   7  R25           compileValidator per render (content LRU alone)             lookup + validateTree(agent-home)
//   4  render        /^on[A-Z]/ → a char-code test                                render(each proof widget's scenarios)
// Item 3 is already in src/validate/schema.ts.
// The rejected bundle variants of the first pass are in the record with their figures.
import { readdirSync, rmSync } from "node:fs";
import { loadavg } from "node:os";
import widgetCapabilities from "../../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "../../src/__tests__/fixtures/widgets/index.ts";
import { bundle as headBundle } from "../../src/pack/bundle.ts";
import type { render as Render } from "../../src/sdk/render.ts";
import { diffTrees as headDiff } from "../../src/validate/patch.ts";
import { themeCss as headTheme } from "../../src/css/theme.ts";
import { compileValidator, type UiNode, type UiTree } from "../../src/index.ts";
import { compiledValidator } from "../../src/runner-kit/cache.ts";
import catalog from "../../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "../../src/__tests__/fixtures/proof/capabilities.json" with { type: "json" };
import manifest from "../../src/__tests__/fixtures/proof/agent-home.manifest.json" with { type: "json" };
import theme from "../../src/__tests__/fixtures/proof/certified.theme.json" with { type: "json" };

const start = "8dac0fa";
const root = new URL("../../", import.meta.url);
const written: URL[] = [];

/** The file at the starting commit plus `edits`, as an importable sibling module. */
async function load(file: string, tag: string, edits: [string, string][] = [], appended = "") {
  let source = await Bun.$`git -C ${root.pathname} show ${start}:${file}`.text();
  for (const [from, to] of edits) {
    if (!source.includes(from)) throw new Error(`${file}: edit did not apply: ${from.slice(0, 60)}`);
    source = source.replace(from, to);
  }
  const target = new URL(file.replace(/\.ts$/, `.hotspot-${tag}.ts`), root);
  written.push(target);
  await Bun.write(target, source + appended);
  return (await import(target.href)) as Record<string, unknown>;
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1] as number;
const rounds = Number(process.argv[2] ?? 31);

function pair(name: string, base: () => unknown, head: () => unknown, inner: number) {
  const a: number[] = [];
  const b: number[] = [];
  const time = (run: () => unknown) => {
    for (let i = 0; i < inner >> 2; i++) run();
    const begin = performance.now();
    for (let i = 0; i < inner; i++) run();
    return (performance.now() - begin) / inner;
  };
  for (let round = 0; round < rounds; round++) {
    a.push(time(base));
    b.push(time(head));
  }
  const ratio = median(b.map((value, i) => value / (a[i] as number)));
  console.log(
    `${name.padEnd(28)} base ${median(a).toFixed(4)} ms  head ${median(b).toFixed(4)} ms  paired ratio ${ratio.toFixed(3)}`,
  );
}

function same(name: string, left: unknown, right: unknown) {
  if (JSON.stringify(left) !== JSON.stringify(right)) throw new Error(`${name}: outputs differ`);
}

try {
  const tree = (await Bun.file(new URL("src/__tests__/fixtures/proof/agent-home.tree.json", root)).json()) as UiTree;
  const load1 = loadavg().map((l) => l.toFixed(1));
  console.log(`${rounds} interleaved rounds per item; base ${start}; load before ${load1.join(" ")}`);

  // 1. validateJson
  type Validate = (doc: unknown) => unknown;
  const baseJson = (await load("src/formats/json.ts", "base")).validateJson as Validate;
  const headJson = (
    await load(
      "src/formats/json.ts",
      "head",
      [["![Object.prototype, null].includes(Object.getPrototypeOf(value))", "!plainPrototype(value)"]],
      `\nfunction plainPrototype(value: object): boolean {\n  const prototype = Object.getPrototypeOf(value);\n  return prototype === Object.prototype || prototype === null;\n}\n`,
    )
  ).validateJson as Validate;
  for (const value of [tree, { a: new Date() }, { a: [1, Number.NaN] }, Object.create(null), new Map(), [undefined]])
    same("validateJson", baseJson(value), headJson(value));
  pair(
    "1  validateJson agent-home",
    () => baseJson(tree),
    () => headJson(tree),
    300,
  );

  // 2. bundle walk
  type Bundle = (input: { files: Record<string, string>; entry: string }) => { ok: boolean };
  const dir = new URL("proof/widgets/agent-home/", root);
  const files: Record<string, string> = {};
  for (const name of readdirSync(dir))
    files[name] = (await Bun.file(new URL(name, dir)).text()).replaceAll(
      "../../runtime/index.ts",
      "@arnilo/liveframe/sdk",
    );
  files["queue.tsx"] += "\nexport default AgentHomeQueue;\n";
  const input = { files, entry: "queue.tsx" };
  const baseBundle = (await load("src/pack/bundle.ts", "base")).bundle as Bundle;
  const bundled = baseBundle(input);
  if (!bundled.ok) throw new Error(`bundle fixture failed: ${JSON.stringify(bundled)}`);
  same("bundle", bundled, headBundle(input));
  pair(
    "2  bundle agent-home",
    () => baseBundle(input),
    () => headBundle(input),
    60,
  );

  // 4. render's event-name test
  const baseRender = (await load("src/sdk/render.ts", "base")).render as typeof Render;
  const headRender = (
    await load(
      "src/sdk/render.ts",
      "head",
      [["definition.events.has(name) || /^on[A-Z]/.test(name)", "definition.events.has(name) || isEventName(name)"]],
      `\nfunction isEventName(name: string): boolean {
  const third = name.charCodeAt(2);
  return name.charCodeAt(0) === 111 && name.charCodeAt(1) === 110 && third >= 65 && third <= 90;
}\n`,
    )
  ).render as typeof Render;
  for (const fixture of proofWidgets) {
    const validator = compileValidator({
      catalog,
      capabilities: widgetCapabilities,
      manifest: fixture.manifest,
    } as never);
    const options = { validator, surfaceId: "hot-spots", revision: 0 };
    const scenarios = fixture.scenarios;
    for (const scenario of scenarios) {
      const rendered = headRender(fixture.widget, scenario, options);
      if (!rendered.ok) throw new Error(`render ${fixture.name}/${scenario.name}: ${JSON.stringify(rendered.errors)}`);
      same("render", baseRender(fixture.widget, scenario, options), rendered);
    }
    let i = 0;
    let j = 0;
    pair(
      `4  render ${fixture.name}`,
      () => baseRender(fixture.widget, scenarios[i++ % scenarios.length] as never, options),
      () => headRender(fixture.widget, scenarios[j++ % scenarios.length] as never, options),
      100,
    );
  }

  // 5. themeCss (kept: head is the live src/css/theme.ts)
  type ThemeCss = (theme: unknown, catalog: unknown) => unknown;
  const baseTheme = (await load("src/css/theme.ts", "base")).themeCss as ThemeCss;
  same("themeCss", baseTheme(theme, catalog), headTheme(theme, catalog));
  pair(
    "5  themeCss, catalog hit",
    () => baseTheme(theme, catalog),
    () => headTheme(theme, catalog),
    300,
  );
  // Nine distinct catalogs through an eight-entry cache: every head call misses and pays the key,
  // the parse and the comparison on top of validation.
  const distinct = Array.from({ length: 9 }, (_, i) => ({ ...catalog, description: `${catalog.description} ${i}` }));
  let k = 0;
  let m = 0;
  pair(
    "5  themeCss, catalog miss",
    () => baseTheme(theme, distinct[k++ % 9]),
    () => headTheme(theme, distinct[m++ % 9]),
    297,
  );

  // 6. diffTrees (kept: head is the live src/validate/patch.ts)
  const baseDiff = (await load("src/validate/patch.ts", "base")).diffTrees as typeof headDiff;
  const rows = (n: number, prefix = "r"): UiNode[] =>
    Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, kind: "Text", props: { text: `row ${i}` } }) as UiNode);
  const list = (children: UiNode[], revision: number): UiTree =>
    ({ ...tree, revision, root: { id: "root", kind: "Stack", props: {}, children } }) as UiTree;
  let seed = 7;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };
  const shuffle = <T>(values: T[]) =>
    values
      .map((v) => [random(), v] as const)
      .sort((x, y) => x[0] - y[0])
      .map(([, v]) => v);
  const shuffled = shuffle(rows(1000));
  const oneChange = rows(1000).map((row, i) => (i === 500 ? { ...row, props: { text: "changed" } } : row));
  const cases: [string, UiTree, UiTree, number][] = [
    ["shuffled 1,000", list(rows(1000), 1), list(shuffled, 2), 30],
    ["one change in 1,000", list(rows(1000), 1), list(oneChange, 2), 300],
    ["agent-home unchanged", tree, { ...tree, revision: tree.revision + 1 }, 300],
  ];
  for (const [name, prev, next, inner] of cases) {
    same(`diffTrees ${name}`, baseDiff(prev, next), headDiff(prev, next));
    pair(
      `6  diffTrees ${name}`,
      () => baseDiff(prev, next),
      () => headDiff(prev, next),
      inner,
    );
  }

  // 7. R25: the runner-kit identity cache against the content-keyed LRU alone.
  const options = { catalog, capabilities, manifest } as never;
  compiledValidator(options, "hash");
  pair(
    "7  lookup + validateTree",
    () => compiledValidator(options, "hash").validateTree(tree),
    () => compileValidator(options).validateTree(tree),
    150,
  );
  console.log(
    `load after ${loadavg()
      .map((l) => l.toFixed(1))
      .join(" ")}`,
  );
} finally {
  for (const file of written) rmSync(file, { force: true });
}
