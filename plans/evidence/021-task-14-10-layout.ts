/** Regenerate: timeout 240s bun --conditions liveframe:source plans/evidence/021-task-14-10-layout.ts */
import { strict as assert } from "node:assert";
import * as playwright from "playwright";
import { drafts } from "../../src/__tests__/fixtures/widgets/drafts.ts";
import { playwrightBackend } from "../../src/preview/capture/index.ts";
import { startHost } from "../../proof/host/server.ts";

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
const server = await startHost(0);
const backend = playwrightBackend(playwright);
try {
  const html = await (await fetch(`${server.url}preview`)).text();
  const session = /"session":"([^"]+)"/.exec(html)?.[1];
  const posted = await fetch(`${server.url}preview/draft?session=${session}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(drafts[0]),
  });
  assert((await posted.json()).ok);
  const page = await backend.open(`${server.url}preview?session=${session}&scenario=ready`);
  await page.waitReady("[data-lf-ready]");
  const cells = (await page.cells()).filter((cell) => cell.scenario === "ready" && cell.width === 360);
  assert(cells.length > 0 && page.layout);
  const shot: number[] = [];
  const layout: number[] = [];
  let nodes = 0;
  for (let i = 0; i < 10; i++) {
    const cell = cells[i % cells.length]!;
    let start = performance.now();
    await page.screenshot(cell.handle);
    shot.push(performance.now() - start);
    start = performance.now();
    const measured = await page.layout(cell.handle);
    layout.push(performance.now() - start);
    nodes = measured!.nodes.length;
    assert(measured!.nodes.some((node) => node.height > 0));
  }
  console.log(
    JSON.stringify({
      cellsPerRun: 10,
      width: 360,
      layoutNodes: nodes,
      layoutMedianMs: median(layout),
      layoutMaxMs: Math.max(...layout),
      screenshotMedianMs: median(shot),
    }),
  );
  await page.close();
} finally {
  await backend.close?.();
  await server.stop(true);
}
