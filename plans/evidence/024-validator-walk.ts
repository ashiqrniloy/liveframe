// Plan 024 Task 4 (R14): how much of the whole-tree validator's time can a single-traversal walk save?
//
//   bun plans/evidence/024-validator-walk.ts [rounds]      (default 31; ~10 minutes at load 20)
//
// It writes four throwaway variants of src/validate/tree.ts next to it, runs them interleaved
// with the real one on the agent-home tree, prints paired medians, and deletes the variants.
// The variants are measurement bounds, not implementations: they return wrong results on bad input.
//   ceiling  skip the JSON pass for every value                        (nothing could be cheaper)
//   props    skip it for the `props` key only                          (what counting inside compileSchema can reach)
//   payload  skip it for `style` and `events`                          (what counting inside those checks can reach)
//   floor    replace walkJson with a bare recursive byte count         (counting alone: no validity, no cycle set, no path)
import { rmSync } from "node:fs";
import { compileValidator } from "../../src/index.ts";
import { validatorCatalog } from "../../src/__tests__/fixtures/validator.ts";
import { compileStructure } from "../../src/validate/structure.ts";
import manifest from "../../src/__tests__/fixtures/proof/agent-home.manifest.json" with { type: "json" };
import capabilities from "../../src/__tests__/fixtures/proof/capabilities.json" with { type: "json" };

const dir = new URL("../../src/validate/", import.meta.url);
const original = await Bun.file(new URL("tree.ts", dir)).text();
const walkJsonCall = `        jsonSink.bytes = bytes;
        walkJson(value, jsonSink);
        bytes = jsonSink.bytes;
        return;`;
const entryLine = "          const entry = (value as Record<string, unknown>)[key];\n";
const skip = (keys: string) =>
  original.replace(
    entryLine,
    `${entryLine}          if (mode === "node" && (${keys})) { path.pop(); first = false; continue; }\n`,
  );
const countOnly = `
function countOnly(value: unknown): number {
  if (value === null) return 4;
  if (typeof value === "string") return stringBytes(value);
  if (typeof value === "boolean") return value ? 4 : 5;
  if (typeof value === "number") return String(value).length;
  let total = 2;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) total += countOnly(value[i]) + (i ? 1 : 0);
    return total;
  }
  let first = true;
  for (const key in value as object) {
    if (!Object.hasOwn(value as object, key)) continue;
    total += stringBytes(key) + 1 + (first ? 0 : 1) + countOnly((value as Record<string, unknown>)[key]);
    first = false;
  }
  return total;
}
`;
const sources: Record<string, string> = {
  ceiling: original.replace(walkJsonCall, "        return;"),
  props: skip('key === "props"'),
  payload: skip('key === "style" || key === "events"'),
  floor:
    original.replace(
      walkJsonCall,
      `        bytes += countOnly(value);
        if (bytes > budget.bytes) limit("a tree within budget", parentId);
        return;`,
    ) + countOnly,
};
for (const [name, source] of Object.entries(sources)) {
  if (source === original) throw new Error(`variant ${name} did not apply: tree.ts changed`);
}

const files = Object.keys(sources).map((name) => new URL(`tree-walk-variant-${name}.ts`, dir));
try {
  await Promise.all(Object.keys(sources).map((name, i) => Bun.write(files[i] as URL, sources[name] as string)));
  const { compileTree: base } = await import("../../src/validate/tree.ts");
  const variants: Record<string, typeof base> = { base };
  for (const [i, name] of Object.keys(sources).entries())
    variants[name] = (await import((files[i] as URL).href)).compileTree;

  const tree: unknown = await Bun.file(
    new URL("../../src/__tests__/fixtures/proof/agent-home.tree.json", import.meta.url),
  ).json();
  const { checkNode } = compileValidator({ catalog: validatorCatalog, capabilities, manifest });
  const structure = compileStructure(validatorCatalog);
  const run = Object.fromEntries(
    Object.entries(variants).map(([name, compile]) => [name, compile(validatorCatalog, checkNode, structure)]),
  );
  const nodes = 679;
  const samples: Record<string, number[]> = Object.fromEntries(Object.keys(run).map((name) => [name, []]));
  const rounds = Number(process.argv[2] ?? 31);
  for (let round = 0; round < rounds; round++) {
    for (const [name, validate] of Object.entries(run)) {
      for (let i = 0; i < 100; i++) validate(tree);
      const start = performance.now();
      for (let i = 0; i < 300; i++) if (!validate(tree).ok) throw new Error(`${name} rejected the valid fixture`);
      (samples[name] as number[]).push(((performance.now() - start) / 300 / nodes) * 1000);
    }
  }
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1] as number;
  const reference = samples.base as number[];
  console.log(`agent-home, ${nodes} nodes, ${rounds} interleaved rounds of 300 runs`);
  for (const [name, values] of Object.entries(samples)) {
    const ratio = median(values.map((value, i) => value / (reference[i] as number)));
    console.log(`${name.padEnd(8)} median ${median(values).toFixed(3)} µs/node   paired ratio ${ratio.toFixed(3)}`);
  }
} finally {
  for (const file of files) rmSync(file, { force: true });
}
