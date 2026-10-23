import { baseCss, themeCss } from "../src/css/index.ts";
import type { Catalog, Result, Theme } from "../src/index.ts";

const read = (name: string) =>
  Bun.file(new URL(`../src/__tests__/fixtures/proof/${name}.json`, import.meta.url)).json();
const catalog: Catalog = await read("catalog");
const runs = 1000;

function measure(name: string, project: () => Result<string>): void {
  const result = project();
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  for (let i = 0; i < 200; i++) project();
  const start = performance.now();
  for (let i = 0; i < runs; i++) {
    const next = project();
    if (!next.ok || next.value !== result.value) throw new Error(`Non-deterministic projection: ${name}`);
  }
  console.log(
    `${name}: ${((performance.now() - start) / runs).toFixed(3)} ms/sheet; ${new TextEncoder().encode(result.value).length} bytes`,
  );
}

measure("base", () => baseCss(catalog));
for (const name of ["certified", "rack"]) {
  const theme: Theme = await read(`${name}.theme`);
  measure(`${name} theme`, () => themeCss(theme, catalog));
}
