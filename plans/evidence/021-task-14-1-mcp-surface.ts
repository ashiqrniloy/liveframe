/** Regenerate: timeout 240s bun --conditions liveframe:source plans/evidence/021-task-14-1-mcp-surface.ts */
import { strict as assert } from "node:assert";
import { CallToolRequestSchema } from "@modelcontextprotocol/core";
import { fromJsonSchema } from "@modelcontextprotocol/server";
import * as playwright from "playwright";
import { startHost } from "../../proof/host/server.ts";
import treeSchema from "../../schemas/ui-tree.json" with { type: "json" };
import catalog from "../../src/__tests__/fixtures/proof/catalog.json" with { type: "json" };
import { countNodes } from "../../src/__tests__/fixtures/render-workloads.ts";
import capabilities from "../../src/__tests__/fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "../../src/__tests__/fixtures/widgets/index.ts";
import { compileValidator } from "../../src/index.ts";
import { capture, playwrightBackend } from "../../src/preview/capture/index.ts";
import { render } from "../../src/sdk/render.ts";

for (const arguments$ of [null, [], "invalid", 1]) {
  assert.equal(
    CallToolRequestSchema.safeParse({ method: "tools/call", params: { name: "pack_draft", arguments: arguments$ } })
      .success,
    false,
  );
}
const permissive = fromJsonSchema({ type: "object", properties: { files: { description: "Required." } } });
assert.equal((await permissive["~standard"].validate({})).issues, undefined);
console.log("Protocol rejects non-object arguments; omitting required lets {} reach the handler.");

const fixture = proofWidgets.find(({ name }) => name === "agent-home");
assert(fixture);
const scenario = fixture.scenarios.find(({ name }) => name === "ready");
assert(scenario);
const validator = compileValidator({ catalog, capabilities, manifest: fixture.manifest });
const rendered = render(fixture.widget, scenario, { validator, surfaceId: "mcp-surface-probe", revision: 1 });
assert(rendered.ok);
assert.equal(countNodes(rendered.value.root), 679);
const schema = fromJsonSchema(treeSchema as Parameters<typeof fromJsonSchema>[0]);
const timings: number[] = [];
for (let index = 0; index < 20; index++) {
  const start = performance.now();
  assert.equal((await schema["~standard"].validate(rendered.value)).issues, undefined);
  if (index >= 10) timings.push(performance.now() - start);
}
timings.sort((a, b) => a - b);
console.log(JSON.stringify({ nodes: 679, warmValidations: timings.length, medianSchemaMs: timings[5] }));

const host = await startHost(0);
try {
  const start = performance.now();
  const result = await capture(`${host.url}preview`, {
    backend: playwrightBackend(playwright),
    scenarios: ["ready", "host-ready", "loading", "empty"],
    maxCells: 48,
  });
  const wallMs = performance.now() - start;
  assert.equal(result.index.cells.length, 48);
  assert(result.index.cells.every(({ errors }) => errors.length === 0));
  const metadata = result.index.cells.map(({ scenario, width, theme, designSystem, errors }) => ({
    scenario,
    width,
    theme,
    designSystem,
    errors,
  }));
  const content: object[] = [{ type: "text", text: JSON.stringify(metadata) }];
  let pngBytes = 0;
  for (const cell of result.index.cells) {
    const png = result.files.get(cell.png);
    assert(png);
    pngBytes += png.byteLength;
    const aria = cell.snapshot === null ? "" : new TextDecoder().decode(result.files.get(cell.snapshot));
    content.push({ type: "text", text: `${cell.scenario} @${cell.width}px\n${aria}` });
    content.push({ type: "image", data: Buffer.from(png).toString("base64"), mimeType: "image/png" });
  }
  console.log(
    JSON.stringify({
      cells: 48,
      axes: "4 scenarios × 3 widths × 2 themes × 2 design systems",
      wallMs,
      pngBytes,
      resultJsonBytes: Buffer.byteLength(JSON.stringify({ content })),
      withStructuredMetadataBytes: Buffer.byteLength(JSON.stringify({ content, structuredContent: metadata })),
    }),
  );
} finally {
  await host.stop(true);
}
