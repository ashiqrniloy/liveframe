import type { UiNode } from "../../src/formats/tree.ts";
import { renderWorkloads } from "../../src/__tests__/fixtures/render-workloads.ts";

export const elementsFixture = "src/__tests__/fixtures/elements.json";

function relative(node: UiNode, parentId: string): string[] {
  return node.id.slice(parentId.length + 1).split("/");
}

function elementOf(node: UiNode, parentId: string): Record<string, unknown> {
  const parts = relative(node, parentId);
  const segment = parts.pop() ?? node.kind;
  const element: Record<string, unknown> = { kind: node.kind };
  if (parentId && segment !== node.kind) element.key = decodeURIComponent(segment);
  if (!parentId && node.id !== "root") throw new Error(`Unexpected root id: ${node.id}`);
  if (node.variant !== undefined) element.variant = node.variant;
  element.props = node.props;
  if (node.style) element.style = node.style;
  if (node.events) element.events = node.events;
  if (node.children) element.children = childrenOf(node);
  return element;
}

/** Rebuilds keyed fragments, which scope ids in the tree but have no node of their own. */
function childrenOf(node: UiNode): Record<string, unknown>[] {
  const children = node.children ?? [];
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < children.length; ) {
    const child = children[i];
    if (!child) break;
    const parts = relative(child, node.id);
    parts.pop();
    const fragments = parts;
    const group: Record<string, unknown>[] = [];
    while (i < children.length) {
      const next = children[i];
      if (!next) break;
      const nextParts = relative(next, node.id);
      nextParts.pop();
      if (nextParts.join("/") !== fragments.join("/")) break;
      group.push(elementOf(next, node.id));
      i++;
    }
    let wrapped = group;
    for (const fragment of [...fragments].reverse())
      wrapped = [{ kind: "fragment", key: decodeURIComponent(fragment), children: wrapped }];
    out.push(...wrapped);
  }
  return out;
}

export function toElements(node: UiNode): Record<string, unknown> {
  return elementOf(node, "");
}

if (import.meta.main) {
  const cases = renderWorkloads().map((workload) => ({
    name: workload.name,
    elements: toElements(workload.run(0).root),
  }));
  await Bun.write(elementsFixture, `${JSON.stringify(cases, null, 2)}\n`);
  console.log(`Wrote ${cases.length} element cases to ${elementsFixture}`);
}
