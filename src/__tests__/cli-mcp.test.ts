import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { McpSdkMissing, mcp } from "../cli/mcp.ts";
import type { Result } from "../errors.ts";
import { type Capabilities, validateCapabilities } from "../formats/capabilities.ts";
import { type Catalog, validateCatalog } from "../formats/catalog.ts";
import type { LiveframeError } from "../index.ts";
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import catalog from "./fixtures/proof/catalog.json" with { type: "json" };

const fixtures = "src/__tests__/fixtures";
const config = `${fixtures}/mcp.config.ts`;

function cli(args: string[], preload?: string, env: Record<string, string> = {}) {
  return Bun.spawnSync(["bun", ...(preload ? ["--preload", preload] : []), "src/cli/liveframe.ts", "mcp", ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });
}

function valid<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const proofCatalog = valid(validateCatalog(catalog));
const proofCapabilities = valid(validateCapabilities(capabilities));
const [firstDefinition, secondDefinition] = proofCatalog.definitions;
if (!firstDefinition || !secondDefinition) throw new Error("The proof catalog needs at least two definitions");

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: "cli-mcp-test", version: "0" });
  await client.connect(
    new StdioClientTransport({ command: "bun", args: ["src/cli/liveframe.ts", "mcp", config], stderr: "pipe" }),
  );
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const [block] = result.content as [{ type: "text"; text: string }];
  return { isError: result.isError === true, text: block.text, json: () => JSON.parse(block.text) as unknown };
}

async function temp(): Promise<string> {
  const dir = join(tmpdir(), `lf-mcp-${crypto.randomUUID()}`);
  await Bun.write(join(dir, ".keep"), "");
  return dir;
}

test("tools_list_has_the_four_read_only_tools", async () => {
  const tools = await withClient(async (client) => (await client.listTools()).tools);
  expect(tools.map((tool) => tool.name).sort()).toEqual([
    "generated_types",
    "list_capabilities",
    "list_primitives",
    "list_vocabulary",
  ]);
  for (const tool of tools) expect(tool.description?.length ?? 0).toBeGreaterThan(20);
  expect(JSON.stringify(tools.find((tool) => tool.name === "list_primitives")?.inputSchema)).toContain('"kinds"');
}, 30000);

test("list_primitives_returns_every_definition_or_the_named_ones", async () => {
  const [all, named] = await withClient(async (client) => [
    await call(client, "list_primitives"),
    await call(client, "list_primitives", { kinds: [secondDefinition.kind] }),
  ]);
  expect(all?.isError).toBe(false);
  expect(all?.json() as Catalog["definitions"]).toEqual(proofCatalog.definitions);
  expect(named?.json() as Catalog["definitions"]).toEqual([secondDefinition]);
}, 30000);

test("unknown_kind_is_an_error_naming_known_kinds", async () => {
  const result = await withClient((client) => call(client, "list_primitives", { kinds: ["not-a-kind"] }));
  expect(result.isError).toBe(true);
  const [error] = result.json() as LiveframeError[];
  expect(error?.kind).toBe("unknown-component");
  expect(error?.message).toContain("not-a-kind");
  expect(error?.expected).toContain(firstDefinition.kind);
}, 30000);

test("list_vocabulary_matches_the_catalog_vocabulary", async () => {
  const result = await withClient((client) => call(client, "list_vocabulary"));
  expect(result.isError).toBe(false);
  expect(result.json()).toEqual(proofCatalog.vocabulary);
}, 30000);

test("list_capabilities_lists_sources_and_actions_with_schemas", async () => {
  const result = await withClient((client) => call(client, "list_capabilities"));
  const declared = result.json() as Capabilities;
  expect(declared).toEqual(proofCapabilities);
  for (const source of Object.values(declared.sources)) {
    expect(source.params.type).toBe("object");
    expect(source.result).toBeDefined();
  }
  for (const action of Object.values(declared.actions)) expect(action.args.type).toBe("object");
}, 30000);

test("generated_types_equals_liveframe_gen_output", async () => {
  const result = await withClient((client) => call(client, "generated_types"));
  const { note, types } = result.json() as { note: string; types: string };
  expect(types).toBe(await Bun.file("src/__tests__/fixtures/widgets/ui.gen.ts").text());
  expect(note).toContain("ui.gen.ts");
}, 30000);

test("mcp_server_initializes_over_stdio", async () => {
  const client = new Client({ name: "cli-mcp-test", version: "0" });
  await client.connect(
    new StdioClientTransport({ command: "bun", args: ["src/cli/liveframe.ts", "mcp", config], stderr: "pipe" }),
  );
  expect(client.getServerVersion()?.name).toBe("liveframe");
  expect(client.getServerCapabilities()).toBeDefined();
  await client.close();
}, 30000);

test("invalid_config_exits_2_with_errors_on_stderr_and_empty_stdout", () => {
  for (const fixture of [
    `${fixtures}/mcp-does-not-exist.ts`,
    `${fixtures}/mcp-no-default.ts`,
    `${fixtures}/mcp-bad-catalog.config.ts`,
    `${fixtures}/mcp-bad-capabilities.config.ts`,
  ]) {
    const run = cli([fixture]);
    expect(run.exitCode).toBe(2);
    expect(run.stdout.toString()).toBe("");
    const errors = JSON.parse(run.stderr.toString()) as LiveframeError[];
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.kind).toBeString();
    expect(errors[0]?.pointer).toBeString();
  }
});

test("missing_argument_prints_the_usage_line", () => {
  const run = cli([]);
  expect(run.exitCode).toBe(2);
  expect(run.stdout.toString()).toBe("");
  expect(run.stderr.toString()).toContain("Usage: liveframe mcp <config-module>");
});

test("missing_mcp_sdk_reports_how_to_install", async () => {
  const error = await mcp(config, () => Promise.reject(new Error("missing"))).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(McpSdkMissing);
  expect((error as Error).message).toContain("bun add @modelcontextprotocol/server");

  const run = cli([config], `./${fixtures}/no-mcp-sdk.ts`);
  expect(run.exitCode).toBe(1);
  expect(run.stdout.toString()).toBe("");
  expect(run.stderr.toString()).toContain("bun add @modelcontextprotocol/server");
}, 30000);

test("gen_runs_without_the_mcp_sdk", async () => {
  const dir = await temp();
  try {
    const run = Bun.spawnSync(
      [
        "bun",
        "--preload",
        `./${fixtures}/no-mcp-sdk.ts`,
        "src/cli/liveframe.ts",
        "gen",
        "src/__tests__/fixtures/proof/catalog.json",
        "--out",
        join(dir, "ui.gen.ts"),
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    expect(run.stderr.toString()).toBe("");
    expect(run.exitCode).toBe(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 30000);

test("default_worker_runner_is_closed_on_shutdown", async () => {
  const dir = await temp();
  try {
    const marker = join(dir, "closed");
    const child = Bun.spawn(["bun", "src/cli/liveframe.ts", "mcp", `${fixtures}/mcp-runner-close.config.ts`], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, LF_MCP_CLOSE_MARKER: marker },
    });
    // Let the server start and connect before ending its input.
    await Bun.sleep(500);
    child.stdin.end();
    const code = await Promise.race([child.exited, Bun.sleep(10000).then(() => "timeout" as const)]);
    expect(code).toBe(0);
    // A config-supplied runner is never closed by the server.
    expect(await Bun.file(marker).exists()).toBe(false);

    // SIGTERM shuts the server down the same way stdin end does, with a clean exit.
    const signalled = Bun.spawn(["bun", "src/cli/liveframe.ts", "mcp", `${fixtures}/mcp-worker.config.ts`], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    await Bun.sleep(500);
    signalled.kill("SIGTERM");
    expect(await Promise.race([signalled.exited, Bun.sleep(10000).then(() => "timeout" as const)])).toBe(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 30000);
