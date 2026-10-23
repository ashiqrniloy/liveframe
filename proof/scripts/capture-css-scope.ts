// Capture the proof host's server render without loading its client or legacy sheets.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { slotClass, styleDeclarations } from "../../src/css/index.ts";
import type { Catalog } from "../../src/index.ts";
import { slotClasses, styleProps } from "../css/project.ts";
import { agentHomeFixture } from "../host/fixtures/queue.ts";
import { ProofSurface } from "../host/view.tsx";
import { render, type UiNode, WidgetError } from "../runtime/index.ts";
import { agentHomeOptions, initialQueueState, queueParams } from "../widgets/agent-home/manifest.ts";
import { AgentHomeQueue } from "../widgets/agent-home/queue.tsx";

const catalog: Catalog = await Bun.file("src/__tests__/fixtures/proof/catalog.json").json();
// Use the same realistic 50-row workload as proof/tests/agent-home.bench.ts.
const task = agentHomeFixture.groups.find((group) => group.id === "tasks")?.pages[0]?.rows[0];
if (!task) throw new Error("Missing task fixture");
const rows = Array.from({ length: 50 }, (_, i) => ({ ...task, id: `task-${i}`, title: `Synthetic task ${i}` }));
const tree = render(
  AgentHomeQueue,
  {
    params: queueParams,
    state: { ...initialQueueState, selected: "task-0" },
    data: {
      ...agentHomeFixture,
      groups: agentHomeFixture.groups.map((group) => ({
        ...group,
        total: group.id === "tasks" ? rows.length : 0,
        pages: [{ cursor: "start", rows: group.id === "tasks" ? rows : [] }],
      })),
    },
    context: { size: "full" },
  },
  agentHomeOptions,
);
if (tree instanceof WidgetError) throw tree;
const snapshot = { tree, options: agentHomeOptions, actions: [] };
const classes = new Map<string, string>([
  ["lf-surface", ""],
  ["lf-container", ""],
]);
for (const definition of catalog.definitions) {
  for (const variant of definition.variants) {
    for (const slot of definition.slots) {
      for (const [index, legacy] of slotClasses(definition.kind, variant, slot).split(" ").entries())
        classes.set(legacy, index === 0 ? slotClass(definition.kind, variant, slot) : "");
    }
  }
}
const styles = new Map<string, string>();
const serialize = (style: React.CSSProperties) =>
  renderToString(createElement("div", { style })).match(/style="([^"]*)"/)?.[1] ?? "";
function collect(node: UiNode) {
  // shortcut: capture maps legacy fit tracks to 1fr; remove when Task 10 migrates QueueRow.
  const style = { ...node.style };
  if (Array.isArray(style.columns)) style.columns = style.columns.map((track) => (track === "fit" ? "1fr" : track));
  const projected = styleDeclarations(style, catalog);
  styles.set(serialize(styleProps(node.style ?? {})), serialize(projected.style));
  const legacy = slotClasses(node.kind, node.variant ?? "default", "root", node.style ?? {})
    .split(" ")
    .slice(8);
  for (const name of legacy) classes.set(name, projected.classes.join(" "));
  for (const child of node.children ?? []) collect(child);
}
collect(snapshot.tree.root);
const rendered = renderToString(createElement(ProofSurface, { snapshot, onIntent: () => {} }));
const html = await new HTMLRewriter()
  .on("[class]", {
    element(el) {
      const value = el.getAttribute("class") ?? "";
      el.setAttribute(
        "class",
        [...new Set(value.split(" ").flatMap((name) => (classes.get(name) ?? name).split(" ").filter(Boolean)))].join(
          " ",
        ),
      );
    },
  })
  .on("[style]", {
    element(el) {
      const value = el.getAttribute("style") ?? "";
      // HTMLRewriter decodes attributes; React's serializer escapes them.
      const escaped = value
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("'", "&#x27;");
      const projected = styles.get(escaped);
      if (projected !== undefined)
        el.setAttribute("style", projected.replaceAll("&quot;", '"').replaceAll("&amp;", "&"));
    },
  })
  .transform(new Response(rendered))
  .text();
if (!html.includes("lf_heading_default_root") || /(?:class="[^"]*lf-|--lf-(?:colour|type|value)-)/.test(html))
  throw new Error("Capture must contain projected agent-home markup, with no legacy CSS names");
await Bun.write(
  "src/__tests__/fixtures/css/agent-home.html",
  `<!-- biome-ignore-all lint: Generated proof-host markup; regenerate with proof/scripts/capture-css-scope.ts -->\n<!-- biome-ignore-all format: Preserve the captured server markup -->\n${html}\n`,
);
console.log(`Captured agent-home server markup: ${new TextEncoder().encode(html).length} bytes`);
