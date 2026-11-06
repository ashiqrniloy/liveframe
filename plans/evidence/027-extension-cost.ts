// Regenerate with: timeout 180s bun --conditions liveframe:source plans/evidence/027-extension-cost.ts
// Plan 027 Task 4: CSS size and projection time with one colour extension set on every recipe.
import { designSystemCss } from "../../src/css/index.ts";
import type { Catalog, DesignSystem } from "../../src/index.ts";

const read = (name: string) =>
  Bun.file(new URL(`../../src/__tests__/fixtures/proof/${name}.json`, import.meta.url)).json();
const plain: Catalog = await read("catalog");
const extended: Catalog = {
  ...plain,
  vocabulary: { ...plain.vocabulary, extensions: { sheen: { type: "colour" } } },
};
const role = plain.vocabulary.colourRoles[0] ?? "";

function project(system: DesignSystem, catalog: Catalog): string {
  const result = designSystemCss(system, { catalog, registry: {} });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}
function time(run: () => void, calls: number): number {
  const start = performance.now();
  for (let i = 0; i < calls; i++) run();
  return (performance.now() - start) / calls;
}

for (const name of ["certified", "rack"]) {
  const system: DesignSystem = await read(`${name}.design-system`);
  const every: DesignSystem = {
    ...system,
    recipes: Object.fromEntries(
      Object.entries(system.recipes).map(([key, recipe]) => [key, { ...recipe, extensions: { sheen: role } }]),
    ),
  };
  const base = project(system, plain);
  const declaredOnly = project(system, extended);
  const full = project(every, extended);
  const bytes = (text: string) => new TextEncoder().encode(text).length;
  if (declaredOnly !== base) throw new Error(`${name}: declaring an extension changed the sheet`);
  for (let i = 0; i < 100; i++) {
    project(system, plain);
    project(every, extended);
  }
  const ratios: number[] = [];
  const times = { base: [] as number[], full: [] as number[] };
  for (let pair = 0; pair < 15; pair++) {
    const a = time(() => project(system, plain), 30);
    const b = time(() => project(every, extended), 30);
    times.base.push(a);
    times.full.push(b);
    ratios.push(b / a);
  }
  console.log(
    `${name}: no extensions ${bytes(base)} B (identical with the extension declared); one colour extension on every recipe ${bytes(full)} B (${(((bytes(full) - bytes(base)) / bytes(base)) * 100).toFixed(1)}%); time ${median(times.base).toFixed(2)} -> ${median(times.full).toFixed(2)} ms (median paired growth ${((median(ratios) - 1) * 100).toFixed(1)}%)`,
  );
}
