import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { createPreview, inProcessRunner } from "@arnilo/liveframe/preview";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drafts, packageOptions, value } from "../../src/__tests__/fixtures/widgets/drafts.ts";
import config from "../host/mcp.config.ts";

const proofConfig = "proof/host/mcp.config.ts";
const plainConfig = "src/__tests__/fixtures/mcp.config.ts";
const agentHome = drafts[0] as (typeof drafts)[0] & { files: Record<string, string> };
if (!agentHome) throw new Error("Missing agent-home draft");
const marker = "DraftOnlyMarkerAa41";
const queue = agentHome.files["agent-home/queue.tsx"] ?? "";
const draftWith = (heading: string) => ({
  ...agentHome,
  files: {
    ...agentHome.files,
    "agent-home/queue.tsx": `${queue.replace('text="Queue"', `text="${heading}"`)}\nexport const ${marker} = 1;\n`,
  },
});

type Content = { type: string; text?: string; data?: string; mimeType?: string };

async function withClient<T>(
  module: string,
  fn: (client: Client) => Promise<T>,
  env: Record<string, string> = {},
): Promise<T> {
  const client = new Client({ name: "mcp-capture-test", version: "0" });
  await client.connect(
    new StdioClientTransport({
      command: "bun",
      args: ["src/cli/liveframe.ts", "mcp", module],
      env: { ...(process.env as Record<string, string>), ...env },
    }),
  );
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

const call = (client: Client, name: string, args: Record<string, unknown>) =>
  client.callTool({ name, arguments: args });
const texts = (content: Content[]) => content.flatMap((block) => (block.type === "text" ? [block.text ?? ""] : []));
const images = (content: Content[]) => content.flatMap((block) => (block.type === "image" ? [block.data ?? ""] : []));

test("capture_returns_png_snapshot_and_errors_per_cell", async () => {
  const result = await withClient(proofConfig, async (client) => {
    expect((await call(client, "pack_draft", agentHome)).isError ?? false).toBe(false);
    return call(client, "capture_preview", { scenarios: ["ready"], widths: [360] });
  });
  expect(result.isError).toBeFalsy();
  const content = result.content as Content[];
  const summary = texts(content)[0] ?? "";
  expect(JSON.parse(summary)).toHaveLength(4);
  expect(JSON.parse(summary)).toEqual(
    expect.arrayContaining([expect.objectContaining({ scenario: "ready", width: 360, errors: [] })]),
  );
  const snapshots = texts(content).slice(1);
  expect(snapshots).toHaveLength(4);
  for (const snapshot of snapshots) expect(snapshot).toContain("- ");
  const pngs = images(content);
  expect(pngs).toHaveLength(4);
  for (const png of pngs) expect(png.startsWith("iVBORw0KGgo")).toBe(true);
}, 180000);

test("capture_shows_the_draft_last_packed", async () => {
  const [before, after] = await withClient(proofConfig, async (client) => {
    await call(client, "pack_draft", agentHome);
    const before = await call(client, "capture_preview", { scenarios: ["ready"], widths: [360] });
    await call(client, "pack_draft", draftWith("SecondDraftHeading"));
    const after = await call(client, "capture_preview", { scenarios: ["ready"], widths: [360] });
    return [before, after];
  });
  expect(texts(before.content as Content[]).join("\n")).toContain("Queue");
  expect(texts(before.content as Content[]).join("\n")).not.toContain("SecondDraftHeading");
  expect(texts(after.content as Content[]).join("\n")).toContain("SecondDraftHeading");
}, 180000);

test("capture_over_12_cells_is_an_error_naming_the_narrowing_arguments", async () => {
  const scenarios = agentHome.scenarios.slice(0, 2).map(({ name }) => name);
  const result = await withClient(proofConfig, async (client) => {
    await call(client, "pack_draft", agentHome);
    return call(client, "capture_preview", { scenarios });
  });
  expect(result.isError).toBe(true);
  const [error] = (result.content as Content[]).flatMap((block) => (block.type === "text" ? [block.text ?? ""] : []));
  expect(error).toContain("24");
  expect(error).toContain("widths");
  expect(error).toContain("designSystems");
}, 120000);

test("capture_before_pack_and_without_preview_config_are_errors", async () => {
  const [before, unconfigured] = await withClient(plainConfig, async (client) => {
    const before = await call(client, "capture_preview", {});
    await call(client, "pack_draft", agentHome);
    return [before, await call(client, "capture_preview", {})];
  });
  expect(before.isError).toBe(true);
  expect(texts(before.content as Content[])[0]).toContain("pack_draft");
  expect(unconfigured.isError).toBe(true);
  expect(texts(unconfigured.content as Content[])[0]).toContain("preview");
}, 60000);

test("capture_page_and_bundle_hold_no_draft_code", async () => {
  const session = createPreview({ ...packageOptions, runner: inProcessRunner() });
  const pkg = value(session.update(draftWith("LawOneMarker")));
  const bound = await config.preview?.({ session, package: () => pkg });
  if (!bound) throw new Error("The proof config needs a preview()");
  try {
    const origin = new URL(bound.url).origin;
    const page = await (await fetch(bound.url)).text();
    const bundle = await (await fetch(`${origin}/preview-client.js`)).text();
    expect(page).toContain("LawOneMarker");
    expect(page).not.toContain(marker);
    expect(page).not.toContain("export const");
    expect(bundle).not.toContain(marker);
  } finally {
    await bound.close();
  }
}, 60000);

test("capture_temp_directory_and_binding_are_freed_on_shutdown", async () => {
  const dir = await mkdtemp(join(tmpdir(), "liveframe-mcp-test-"));
  const log = join(dir, "preview.log");
  try {
    await withClient(
      "proof/tests/fixtures/mcp-preview-close.config.ts",
      async (client) => {
        await call(client, "pack_draft", agentHome);
        expect((await call(client, "capture_preview", { scenarios: ["ready"], widths: [360] })).isError).toBeFalsy();
        expect((await readdir(dir)).some((name) => name.startsWith("liveframe-mcp-"))).toBe(true);
      },
      { TMPDIR: dir, LF_MCP_PREVIEW_LOG: log },
    );
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && (await readdir(dir)).some((name) => name.startsWith("liveframe-mcp-")))
      await Bun.sleep(100);
    expect((await readdir(dir)).filter((name) => name.startsWith("liveframe-mcp-"))).toEqual([]);
    expect(await Bun.file(log).text()).toBe("open\nclose\n");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 120000);
