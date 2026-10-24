import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

test("mcp_guide_config_starts_and_lists_the_tools", async () => {
  const source = await Bun.file(new URL("./fixtures/mcp-guide.config.ts", import.meta.url)).text();
  const example = source.replaceAll("./mcp-guide-host.ts", "./host.ts");
  const guide = await Bun.file(new URL("../../docs/mcp.md", import.meta.url)).text();
  expect(guide).toContain(`\`\`\`ts\n${example}\`\`\``);

  const client = new Client({ name: "guide", version: "0" });
  await client.connect(
    new StdioClientTransport({
      command: "bun",
      args: ["src/cli/liveframe.ts", "mcp", "src/__tests__/fixtures/mcp-guide.config.ts"],
    }),
  );
  try {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "capture_preview",
      "generated_types",
      "list_capabilities",
      "list_primitives",
      "list_vocabulary",
      "pack_draft",
      "render_scenarios",
    ]);
    const capabilities = await client.callTool({ name: "list_capabilities", arguments: {} });
    expect(capabilities.isError).toBeUndefined();
  } finally {
    await client.close();
  }
}, 30000);
