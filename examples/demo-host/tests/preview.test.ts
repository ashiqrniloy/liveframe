import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { startHost } from "../server.ts";
import { cleanup, type Host, hello, tempDir } from "./host.ts";

const root = new URL("../", import.meta.url).pathname;
const liveframe = join(root, "node_modules/.bin/liveframe");
let dir: string;
let host: Host;
const scratch: string[] = [];
beforeAll(async () => {
  dir = await tempDir();
  host = await startHost({ dataDir: dir, port: 0 });
});
afterAll(async () => {
  await host?.stop();
  await cleanup(dir);
  await Promise.all(scratch.map((path) => rm(path, { recursive: true, force: true })));
});

type Index = { cells: { png: string; snapshot: string; errors: unknown[] }[] };

test("demo_preview_captures_every_cell", async () => {
  const out = await mkdtemp(join(tmpdir(), "liveframe-demo-capture-"));
  scratch.push(out);
  const start = performance.now();
  const proc = Bun.spawn(["bun", liveframe, "preview", "capture", new URL("/preview", host.url).href, "--out", out], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  expect(await proc.exited, stdout + stderr).toBe(0);
  const index = (await Bun.file(join(out, "index.json")).json()) as Index;
  // Two scenarios × two widths × two themes × two design systems.
  expect(index.cells).toHaveLength(16);
  const files = new Set(await readdir(out));
  for (const cell of index.cells) {
    expect(cell.errors).toEqual([]);
    expect(files.has(cell.png)).toBe(true);
    expect(files.has(cell.snapshot)).toBe(true);
  }
  console.log(
    `Captured ${index.cells.length} cells in ${((performance.now() - start) / index.cells.length).toFixed(0)} ms each`,
  );
}, 120000);

test("demo_mcp_lists_seven_tools_and_captures", async () => {
  const client = new Client({ name: "demo", version: "0" });
  await client.connect(
    new StdioClientTransport({ command: "bun", args: [liveframe, "mcp", "mcp.config.ts"], cwd: root }),
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
    const packed = await client.callTool({ name: "pack_draft", arguments: await hello() });
    expect(packed.isError).toBeFalsy();
    const start = performance.now();
    const captured = await client.callTool({
      name: "capture_preview",
      arguments: { scenarios: ["ready"], widths: [360], themes: ["demo@1.0.0"], designSystems: ["demo@1.0.0"] },
    });
    expect(captured.isError).toBeFalsy();
    const content = captured.content as { type: string; text?: string }[];
    expect(JSON.parse(content[0]?.text ?? "[]")).toEqual([
      expect.objectContaining({ scenario: "ready", width: 360, errors: [] }),
    ]);
    expect(content.some((block) => block.type === "image")).toBe(true);
    console.log(`MCP capture of one cell: ${(performance.now() - start).toFixed(0)} ms`);
  } finally {
    await client.close();
  }
}, 120000);

test("preview_bundle_has_no_draft_code", async () => {
  const bundle = await (await fetch(new URL("/preview/client.js", host.url))).text();
  const page = await (await fetch(new URL("/preview/render", host.url))).text();
  // Widget strings exist only in the widget's source and in the trees the runner returns.
  expect(bundle).not.toContain("Notify asks the host");
  expect(bundle).not.toContain("Hello from");
  expect(page).not.toMatch(/export default|jsxDEV|=>/);
});

test("preview_logs_an_action_and_never_dispatches_it", async () => {
  const send = (body: unknown) =>
    fetch(new URL("/preview/intent", host.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const intent = { type: "action", name: "demo.notify", args: { message: "from preview" } };
  const result = (await (await send(intent)).json()) as { intents: unknown[] };
  expect(result.intents).toContainEqual(intent);
  expect(host.actions).toEqual([]);
  const unknown = (await (await send({ type: "action", name: "demo.unknown", args: {} })).json()) as {
    result: { ok: boolean };
  };
  expect(unknown.result.ok).toBe(false);
});
