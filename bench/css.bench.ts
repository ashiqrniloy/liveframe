import { baseCss, designSystemCss, styleDeclarations, themeCss } from "../src/css/index.ts";
import type { Catalog, DesignSystem, Result, Theme, UiNode, UiTree } from "../src/index.ts";

const read = (name: string) =>
  Bun.file(new URL(`../src/__tests__/fixtures/proof/${name}.json`, import.meta.url)).json();
const catalog: Catalog = await read("catalog");
const runs = 1000;

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
  console.log(
    `${name}: ${((performance.now() - start) / runs).toFixed(3)} ms/sheet; ${new TextEncoder().encode(result.value).length} bytes`,
  );
}

measure("base", () => baseCss(catalog));
for (const name of ["certified", "rack"]) {
  const theme: Theme = await read(`${name}.theme`);
  measure(`${name} theme`, () => themeCss(theme, catalog));
  const system: DesignSystem = await read(`${name}.design-system`);
  measure(`${name} design system`, () => designSystemCss(system, { catalog, registry: {} }));
}
