#!/usr/bin/env bun
/**
 * Operator tool for the agent acceptance run (plan 032 Task 4). An agent that cannot register an MCP server in its
 * own session drives `liveframe mcp` through this: it runs an ordered list of tool calls in ONE stdio session (the
 * server holds a single preview session, so `pack_draft` must precede `render_scenarios` and `capture_preview` in
 * the same process), prints each result, writes captured images to a directory and appends every call and its
 * outcome to `transcript.jsonl`, the record of what the agent asked for.
 *
 *   bun mcp-session.ts calls.json [--out captures] [--transcript transcript.jsonl]
 *
 * `calls.json` is `[{ "tool": "pack_draft", "arguments": { ... } }, ...]`. It adds no authority: it forwards to the
 * server the agent is entitled to, and the server has no tool that installs, places or dispatches anything.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? (args[at + 1] ?? fallback) : fallback;
};
const [callsPath] = args;
if (!callsPath || callsPath.startsWith("--")) throw new Error("usage: bun mcp-session.ts calls.json [--out dir]");
const out = option("--out", "captures");
const transcript = option("--transcript", "transcript.jsonl");

const calls = (await Bun.file(callsPath).json()) as { tool: string; arguments?: Record<string, unknown> }[];
await mkdir(out, { recursive: true });

const client = new Client({ name: "agent-acceptance", version: "0" });
await client.connect(
  new StdioClientTransport({
    command: "./node_modules/.bin/liveframe",
    args: ["mcp", "./mcp.config.ts"],
    stderr: "inherit",
  }),
);
try {
  let image = 0;
  for (const call of calls) {
    const started = new Date().toISOString();
    const result = await client.callTool({ name: call.tool, arguments: call.arguments ?? {} });
    const content: unknown[] = [];
    for (const block of result.content as { type: string; text?: string; data?: string; mimeType?: string }[]) {
      if (block.type === "image" && block.data) {
        const file = join(out, `${String(++image).padStart(3, "0")}.${block.mimeType?.split("/")[1] ?? "png"}`);
        await Bun.write(file, Buffer.from(block.data, "base64"));
        content.push({ image: file });
      } else content.push(block);
    }
    const record = { at: started, tool: call.tool, isError: result.isError === true, content };
    await appendFile(transcript, `${JSON.stringify({ ...record, arguments: call.arguments ?? {} })}\n`);
    console.log(`## ${call.tool}${record.isError ? " (error)" : ""}`);
    for (const block of content)
      console.log(typeof block === "object" && block && "text" in block ? block.text : JSON.stringify(block));
  }
} finally {
  await client.close();
}
