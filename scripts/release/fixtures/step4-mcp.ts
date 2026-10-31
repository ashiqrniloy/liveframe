/** Gate step 4: the installed binary serves the authoring MCP tools over stdio. */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { draft } from "./gate.ts";

const expected = [
  "capture_preview",
  "generated_types",
  "list_capabilities",
  "list_primitives",
  "list_vocabulary",
  "pack_draft",
  "render_scenarios",
  "set_state",
];
const bin = new URL("../node_modules/.bin/liveframe", import.meta.url).pathname;
const config = new URL("../liveframe.config.ts", import.meta.url).pathname;
const client = new Client({ name: "archive-gate", version: "0" });
await client.connect(
  new StdioClientTransport({ command: process.execPath, args: [bin, "mcp", config], stderr: "pipe" }),
);
try {
  const tools = (await client.listTools()).tools.map((tool) => tool.name).sort();
  if (JSON.stringify(tools) !== JSON.stringify(expected)) throw new Error(`Tools are ${tools.join(", ")}`);
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    const [block] = result.content as unknown as [{ text: string }];
    return { isError: result.isError === true, json: JSON.parse(block.text) as unknown };
  };
  const input = await draft();
  const packed = await call("pack_draft", { ...input });
  if (packed.isError) throw new Error(`pack_draft failed: ${JSON.stringify(packed.json)}`);
  const rendered = await call("render_scenarios", { scenario: input.scenarios[0]?.name });
  if (rendered.isError) throw new Error(`render_scenarios failed: ${JSON.stringify(rendered.json)}`);
  if ((rendered.json as { format?: string }).format !== "liveframe/1")
    throw new Error(`Rendered ${JSON.stringify(rendered.json).slice(0, 120)}`);
} finally {
  await client.close();
}
console.log("MCP server listed eight tools, packed and rendered a draft");
