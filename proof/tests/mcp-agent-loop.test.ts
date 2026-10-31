import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const marker = "DraftOnlyMarkerB7c2";
type Block = { type: string; text?: string; data?: string };
type ToolResult = Awaited<ReturnType<Client["callTool"]>>;

const texts = (result: ToolResult) =>
  (result.content as Block[]).flatMap((b) => (b.type === "text" ? [b.text ?? ""] : []));
const json = (result: ToolResult) => JSON.parse(texts(result).join("\n"));
const images = (result: ToolResult) =>
  (result.content as Block[]).flatMap((b) => (b.type === "image" ? [b.data ?? ""] : []));
const pngSize = (base64: string) => {
  const bytes = Buffer.from(base64, "base64");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

const manifest = (catalogId: string, action: string) => ({
  format: "liveframe-manifest/1",
  id: "agent-widget",
  version: "1.0.0",
  catalogId,
  params: { type: "object", properties: {}, required: [], additionalProperties: false },
  state: { type: "object", properties: {}, required: [], additionalProperties: false },
  context: { type: "object", properties: {}, required: [], additionalProperties: false },
  initialState: {},
  sources: {},
  actions: [action],
});

const widget = ({ layout, gap, action }: { layout: "Stack" | "Inline"; gap: string; action: string }) => `
/** @jsxImportSource @arnilo/liveframe/sdk */
import { action } from "@arnilo/liveframe/sdk";
import { Button, Heading, Inline, Stack } from "./ui.gen";

const ${marker} = 1;
const labels = ["One", "Two", "Three"];

export default function AgentWidget() {
  return (
    <Stack gap="space.3">
      <Heading text="Agent widget" level={2} />
      <${layout} gap="${gap}">
        {labels.map((label, index) => (
          <Button key={label} label={label} onPress={action("${action}", { id: label })} />
        ))}
      </${layout}>
    </Stack>
  );
}
`;

const scenarios = [
  { name: "ready", params: {}, state: {}, context: {}, data: {} },
  { name: "empty", params: {}, state: {}, context: {}, data: {} },
];

type Ask = (name: string, args?: Record<string, unknown>) => Promise<ToolResult>;

async function agent(fn: (ask: Ask, pageLog: string, tools: () => Promise<string[]>) => Promise<void>) {
  const client = new Client({ name: "scripted-agent", version: "0" });
  const dir = await mkdtemp(join(tmpdir(), "liveframe-agent-mcp-"));
  const pageLog = join(dir, "pages.log");
  await client.connect(
    new StdioClientTransport({
      command: "bun",
      args: [
        "--conditions",
        "liveframe:source",
        "src/cli/liveframe.ts",
        "mcp",
        "proof/tests/fixtures/mcp-loop.config.ts",
      ],
      env: { ...(process.env as Record<string, string>), LF_MCP_PAGE_LOG: pageLog },
    }),
  );
  const ask = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) throw new Error(`${name} failed: ${texts(result).join(" ")}`);
    return result;
  };
  const tools = async () => (await client.listTools()).tools.map((tool) => tool.name).sort();
  try {
    await fn(ask, pageLog, tools);
  } finally {
    await client.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test("scripted_agent_writes_fixes_and_lays_out_a_widget_through_mcp_tools_only", async () => {
  const start = performance.now();
  await agent(async (ask, pageLog, tools) => {
    // 1. Write: read the catalog, the vocabulary, the capabilities and the generated types.
    const definitions = json(await ask("list_primitives", { kinds: ["heading", "button", "inline", "stack"] })) as {
      kind: string;
      props: { properties: Record<string, unknown> };
    }[];
    expect(definitions.map((d) => d.kind).sort()).toEqual(["button", "heading", "inline", "stack"]);
    // The catalog id comes from the server, not from the test: an agent authors against what it was told.
    const { catalogId, vocabulary } = json(await ask("list_vocabulary")) as {
      catalogId: string;
      vocabulary: { space: string[] };
    };
    expect(catalogId).toBe("proof.ui@1");
    const gap = vocabulary.space.includes("space.3") ? "space.3" : vocabulary.space[0];
    if (!gap) throw new Error("No space values");
    const capabilities = json(await ask("list_capabilities")) as { actions: Record<string, unknown> };
    const action = Object.keys(capabilities.actions)[0];
    if (!action) throw new Error("No actions");
    const generated = (json(await ask("generated_types")) as { types: string }).types;
    expect(generated).toContain("export const Button");

    const draft = (options: { layout: "Stack" | "Inline"; gap: string; action: string; declared: string }) => ({
      files: { "ui.gen.ts": generated, "entry.tsx": widget(options) },
      entry: "entry.tsx",
      manifest: manifest(catalogId, options.declared),
      scenarios,
    });

    const written = draft({ layout: "Inline", gap, action, declared: action });
    expect(await ask("pack_draft", written)).toBeDefined();
    const all = json(await ask("render_scenarios")) as { scenario: string; ok: boolean }[];
    expect(all.map(({ scenario, ok }) => ({ scenario, ok }))).toEqual([
      { scenario: "ready", ok: true },
      { scenario: "empty", ok: true },
    ]);

    // 2. Fix invalid: an action that is not declared and a style value outside the vocabulary.
    const broken = draft({ layout: "Inline", gap: "space.99", action: "queue.load", declared: action });
    await ask("pack_draft", broken);
    // Each distinct error arrives once, with the scenarios that share it.
    const checked = json(await ask("render_scenarios")) as {
      ok: boolean;
      kind?: string;
      pointer: string;
      expected?: string;
      scenarios: string[];
    }[];
    expect(checked.every((entry) => entry.ok)).toBe(false);
    expect(checked.every((entry) => entry.scenarios.length === 2)).toBe(true);
    const errors = checked;
    const actionError = errors.find((error) => error.kind === "undeclared-action");
    const styleError = errors.find((error) => error.kind === "invalid-prop");
    if (!actionError?.expected || !styleError?.expected) throw new Error("Errors carry no expected text");

    // The fix comes from that text: the action the error allows, a value the vocabulary declares.
    const allowedAction = actionError.expected.replace(/^.*: /, "");
    expect(Object.keys(capabilities.actions)).toContain(allowedAction);
    const allowedValues = styleError.expected.replace(/^one of: /, "").split(", ");
    const fixedGap = allowedValues.find((value) => vocabulary.space.includes(value));
    if (!fixedGap) throw new Error("No offered value is a declared space");
    expect(styleError.pointer).toBe("/root/inline/style/gap");

    const fixed = draft({ layout: "Inline", gap: fixedGap, action: allowedAction, declared: allowedAction });
    await ask("pack_draft", fixed);
    const repaired = json(await ask("render_scenarios")) as { scenario: string; ok: boolean }[];
    expect(repaired.map(({ scenario, ok }) => ({ scenario, ok }))).toEqual([
      { scenario: "ready", ok: true },
      { scenario: "empty", ok: true },
    ]);

    // 3. Fix layout: a valid draft whose button row is a stack, not a row.
    const scan = async () => {
      const url = (await Bun.file(pageLog).text()).trim().split("\n").at(-1) ?? "";
      const page = await (await fetch(url)).text();
      const bundle = await (await fetch(`${new URL(url).origin}/preview-client.js`)).text();
      expect(page).not.toContain(marker);
      expect(bundle).not.toContain(marker);
      expect(page).toContain("Agent widget");
    };
    const capture = async (layout: "Stack" | "Inline") => {
      await ask("pack_draft", draft({ layout, gap: fixedGap, action: allowedAction, declared: allowedAction }));
      const rendered = json(await ask("render_scenarios")) as { ok: boolean }[];
      expect(rendered.every((entry) => entry.ok)).toBe(true);
      const result = await ask("capture_preview", { scenarios: ["ready"], widths: [360] });
      await scan();
      const heights = images(result).map((png) => pngSize(png).height);
      return { heights, max: Math.max(...heights), result };
    };
    const stacked = await capture("Stack");
    const inline = await capture("Inline");
    // Measured when this test was written: inline cells 102–113 px, stacked 163–177 px at width 360.
    const oneRowMax = 113 + 20;
    expect(inline.max).toBeLessThanOrEqual(oneRowMax);
    expect(stacked.max).toBeGreaterThan(oneRowMax);

    // The whole tool surface: adding or renaming a tool needs a spec change.
    expect(await tools()).toEqual([
      "capture_preview",
      "generated_types",
      "list_capabilities",
      "list_primitives",
      "list_vocabulary",
      "pack_draft",
      "render_scenarios",
      "set_state",
    ]);
  });
  console.log("agent loop:", (performance.now() - start).toFixed(0), "ms");
}, 180000);
