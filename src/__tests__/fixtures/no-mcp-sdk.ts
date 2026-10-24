import { mock } from "bun:test";

// Makes every MCP SDK import fail, as on an install without the optional peer.
for (const specifier of [
  "@modelcontextprotocol/server",
  "@modelcontextprotocol/server/stdio",
  "@modelcontextprotocol/client",
  "@modelcontextprotocol/client/stdio",
])
  mock.module(specifier, () => {
    throw new Error(`${specifier} is not installed`);
  });
