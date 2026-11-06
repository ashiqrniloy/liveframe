// Regenerate with: timeout 300s bun --conditions liveframe:source plans/evidence/027-axes-cost.ts
// Plan 027 Task 5: sheet size and projection time with one two-axis kind (design §3 gates a and b).
import { designSystemCss } from "../../src/css/index.ts";
import type { Catalog, DesignSystem } from "../../src/index.ts";
import { resolveRecipes } from "../../src/index.ts";
import { axesCatalog, axesSystem } from "../../src/__tests__/fixtures/axes.ts";

const read = (name: string) =>
  Bun.file(new URL(`../../src/__tests__/fixtures/proof/${name}.json`, import.meta.url)).json();
const plain: Catalog = await read("catalog");
const axes = axesCatalog(plain);
const bytes = (text: string) => new TextEncoder().encode(text).length;

function project(system: DesignSystem, catalog: Catalog): string {
  const result = designSystemCss(system, { catalog, registry: {} });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
function time(run: () => void, calls: number): number {
  const start = performance.now();
  for (let i = 0; i < calls; i++) run();
  return (performance.now() - start) / calls;
}
const buttonBytes = (css: string) =>
  css
    .split("\n")
    .filter((line) => line.includes(".lf_button_"))
    .reduce((sum, line) => sum + bytes(line), 0);

for (const name of ["certified", "rack"]) {
  const system: DesignSystem = await read(`${name}.design-system`);
  const withAxes = axesSystem(system);
  const base = project(system, plain);
  const declaredOnly = project(system, axes);
  const full = project(withAxes, axes);
  const entries = (catalog: Catalog, doc: DesignSystem) =>
    Object.keys(resolveRecipes(doc, { catalog, registry: {} })).length;
  const before = entries(plain, system);
  const after = entries(axes, withAxes);
  for (let i = 0; i < 100; i++) {
    project(system, plain);
    project(withAxes, axes);
  }
  const ratios: number[] = [];
  const times = { base: [] as number[], axes: [] as number[] };
  for (let pair = 0; pair < 15; pair++) {
    const a = time(() => project(system, plain), 30);
    const b = time(() => project(withAxes, axes), 30);
    times.base.push(a);
    times.axes.push(b);
    ratios.push(b / a);
  }
  const t0 = median(times.base);
  const t1 = median(times.axes);
  const predicted = (t0 / before) * after;
  const combos = 24;
  console.log(
    [
      `${name}: no axes ${bytes(base)} B; axes declared but no overlay set ${bytes(declaredOnly)} B (expansion alone); overlays on top ${bytes(full)} B (+${(((bytes(full) - bytes(base)) / bytes(base)) * 100).toFixed(1)}% over no axes)`,
      `  button rules ${buttonBytes(base)} -> ${buttonBytes(full)} B (4 -> ${combos} combinations), ${((buttonBytes(full) - buttonBytes(base)) / (combos - 4)).toFixed(0)} B per added combination`,
      `  resolved entries ${before} -> ${after}; time ${t0.toFixed(2)} -> ${t1.toFixed(2)} ms (median paired growth ${((median(ratios) - 1) * 100).toFixed(1)}%); linear extrapolation by entries predicts ${predicted.toFixed(2)} ms, measured ${(t1 / predicted).toFixed(2)}x`,
    ].join("\n"),
  );
}
