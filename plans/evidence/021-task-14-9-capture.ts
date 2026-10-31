/** Regenerate: timeout 240s bun --conditions liveframe:source plans/evidence/021-task-14-9-capture.ts */
import { strict as assert } from "node:assert";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { drafts } from "../../src/__tests__/fixtures/widgets/drafts.ts";

const client = new Client({ name: "mcp-capture-bound", version: "0" });
await client.connect(
  new StdioClientTransport({
    command: "bun",
    args: ["--conditions", "liveframe:source", "src/cli/liveframe.ts", "mcp", "plans/evidence/021-task-14-9.config.ts"],
    stderr: "pipe",
  }),
);
try {
  const tools = await client.listTools();
  assert(tools.tools.find(({ name }) => name === "capture_preview")?.description?.includes("at most 48 per call"));
  assert(!(await client.callTool({ name: "pack_draft", arguments: drafts[0]! })).isError);
  const start = performance.now();
  const result = await client.callTool(
    {
      name: "capture_preview",
      arguments: { scenarios: ["ready", "host-ready", "loading", "empty"] },
    },
    undefined,
    { timeout: 120000 },
  );
  const wallMs = performance.now() - start;
  assert(!result.isError);
  const cells = JSON.parse((result.content[0] as { text: string }).text);
  assert.equal(cells.length, 48);
  assert(cells.every(({ errors }: { errors: unknown[] }) => errors.length === 0));
  const images = result.content.filter((block) => block.type === "image");
  assert.equal(images.length, 48);
  assert(result.structuredContent);
  console.log(
    JSON.stringify({
      cells: cells.length,
      axes: "4 scenarios × 3 widths × 2 themes × 2 design systems",
      protocol: client.getNegotiatedProtocolVersion(),
      wallMs,
      pngBytes: images.reduce((sum, block) => sum + Buffer.from(block.data, "base64").byteLength, 0),
      resultJsonBytes: Buffer.byteLength(JSON.stringify(result)),
    }),
  );
} finally {
  await client.close();
}
