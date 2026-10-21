import { agentHomeFixture } from "../host/fixtures/queue.ts";
import { render, WidgetError } from "../runtime/index.ts";
import { initialQueueState, queueParams } from "../widgets/agent-home/manifest.ts";
import { coreQueueOptions } from "../widgets/core-queue/manifest.ts";
import { CoreQueue } from "../widgets/core-queue/widget.tsx";

const decision = agentHomeFixture.groups[0]?.pages[0]?.rows[0];
if (!decision) throw new Error("Missing decision fixture");
const rows = Array.from({ length: 50 }, (_, i) => ({
  ...decision,
  id: `decision-${i}`,
  title: `Synthetic decision ${i}`,
}));
const data = {
  ...agentHomeFixture,
  groups: agentHomeFixture.groups.map((group) => ({
    ...group,
    total: group.id === "decisions" ? rows.length : 0,
    pages: [{ cursor: "start", rows: group.id === "decisions" ? rows : [] }],
  })),
};
for (const size of ["small", "medium", "large", "full"]) {
  const run = (i: number) => {
    const result = render(
      CoreQueue,
      { params: queueParams, state: { ...initialQueueState, selected: `decision-${i % 50}` }, data, context: { size } },
      coreQueueOptions,
    );
    if (result instanceof WidgetError) throw result;
  };
  for (let i = 0; i < 200; i++) run(i);
  const start = performance.now();
  for (let i = 0; i < 1000; i++) run(i);
  const mean = (performance.now() - start) / 1000;
  console.log(`core.queue ${size}: ${mean.toFixed(3)} ms mean (50 rows, 1000 renders, 2 ms budget)`);
  if (mean >= 2) throw new Error(`${size} exceeds 2 ms render budget`);
}
