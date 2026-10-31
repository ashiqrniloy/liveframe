/** Regenerate on the before/after revision: timeout 60s bun --conditions liveframe:source plans/evidence/021-task-14-8-roundtrip.ts */
import { strict as assert } from "node:assert";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { drafts } from "../../src/__tests__/fixtures/widgets/drafts.ts";

const client = new Client({ name: "mcp-roundtrip", version: "0" }, { supportedProtocolVersions: ["2025-11-25"] });
await client.connect(
  new StdioClientTransport({
    command: "bun",
    args: ["--conditions", "liveframe:source", "src/cli/liveframe.ts", "mcp", "src/__tests__/fixtures/mcp.config.ts"],
    stderr: "pipe",
  }),
);
try {
  assert.equal(client.getNegotiatedProtocolVersion(), "2025-11-25");
  assert(!(await client.callTool({ name: "pack_draft", arguments: drafts[0]! })).isError);
  const times: number[] = [];
  for (let index = 0; index < 20; index++) {
    const start = performance.now();
    const result = await client.callTool({ name: "render_scenarios", arguments: { scenario: "ready" } });
    const ms = performance.now() - start;
    assert(!result.isError);
    const tree = JSON.parse((result.content[0] as { text: string }).text);
    const count = (node: { children?: (typeof node)[] }): number =>
      1 + (node.children ?? []).reduce((sum, child) => sum + count(child), 0);
    assert.equal(count(tree.root), 679);
    if (index >= 10) times.push(ms);
  }
  times.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      protocol: client.getNegotiatedProtocolVersion(),
      nodes: 679,
      warmups: 10,
      calls: times.length,
      medianMs: times[5],
      timesMs: times,
    }),
  );
} finally {
  await client.close();
}
