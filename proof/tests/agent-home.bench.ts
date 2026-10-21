import { agentHomeFixture } from "../host/fixtures/queue.ts";
import { render, type UiNode, WidgetError } from "../runtime/index.ts";
import { agentHomeOptions, initialQueueState, queueParams } from "../widgets/agent-home/manifest.ts";
import { AgentHomeQueue } from "../widgets/agent-home/queue.tsx";

const task = agentHomeFixture.groups.find((group) => group.id === "tasks")?.pages[0]?.rows[0];
if (!task) throw new Error("Missing task fixture");
const rows = Array.from({ length: 50 }, (_, i) => ({ ...task, id: `task-${i}`, title: `Synthetic task ${i}` }));
const data = {
  ...agentHomeFixture,
  groups: agentHomeFixture.groups.map((group) => ({
    ...group,
    total: group.id === "tasks" ? rows.length : 0,
    pages: [{ cursor: "start", rows: group.id === "tasks" ? rows : [] }],
  })),
};
function run(selected: string) {
  const tree = render(
    AgentHomeQueue,
    {
      params: queueParams,
      state: { ...initialQueueState, selected },
      data,
      context: { size: "full" },
    },
    agentHomeOptions,
  );
  if (tree instanceof WidgetError) throw tree;
  return tree;
}
for (let i = 0; i < 200; i++) run(`task-${i % rows.length}`);
const iterations = 1000;
const start = performance.now();
for (let i = 0; i < iterations; i++) run(`task-${i % rows.length}`);
const mean = (performance.now() - start) / iterations;
const count = (node: UiNode): number => 1 + (node.children ?? []).reduce((sum, child) => sum + count(child), 0);
console.log(
  `agent_home_selection_under_budget: 50 rows, ${count(run("task-0").root)} nodes, ${mean.toFixed(3)} ms mean (${iterations} renders, 2 ms budget)`,
);
if (mean >= 2) throw new Error(`Agent-home render mean ${mean.toFixed(3)} ms exceeds 2 ms`);
