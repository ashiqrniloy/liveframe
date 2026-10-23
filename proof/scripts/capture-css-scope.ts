// Capture the migrated proof host server render; no browser or translation required.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { agentHomeFixture } from "../host/fixtures/queue.ts";
import { ProofSurface } from "../host/view.tsx";
import { render, WidgetError } from "../runtime/index.ts";
import { agentHomeOptions, initialQueueState, queueParams } from "../widgets/agent-home/manifest.ts";
import { AgentHomeQueue } from "../widgets/agent-home/queue.tsx";

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
const html = renderToString(createElement(ProofSurface, { snapshot, onIntent: () => {} }));
if (!html.includes("lf_heading_default_root") || /(?:class="[^"]*lf-|--lf-(?:colour|type|value)-)/.test(html))
  throw new Error("Capture must contain projected agent-home markup, with no legacy CSS names");
await Bun.write(
  "src/__tests__/fixtures/css/agent-home.html",
  `<!-- biome-ignore-all lint: Generated proof-host markup; regenerate with proof/scripts/capture-css-scope.ts -->\n<!-- biome-ignore-all format: Preserve the captured server markup -->\n${html}\n`,
);
console.log(`Captured agent-home server markup: ${new TextEncoder().encode(html).length} bytes`);
