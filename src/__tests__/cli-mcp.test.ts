import { expect, test } from "bun:test";
import { mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { CallToolResultSchema } from "@modelcontextprotocol/core";
import { McpSdkMissing, checkAll, mcp } from "../cli/mcp.ts";
import { createAuthoring } from "../authoring/index.ts";
import type { Result } from "../errors.ts";
import { type Capabilities, validateCapabilities } from "../formats/capabilities.ts";
import { type Catalog, validateCatalog } from "../formats/catalog.ts";
import { pack } from "../pack/pack.ts";
import type { LiveframeError } from "../index.ts";
import { inProcessRunner } from "../preview/index.ts";
import { createPreview } from "../preview/session.ts";
import { drafts } from "./fixtures/widgets/drafts.ts";
import capabilities from "./fixtures/widgets/capabilities.json" with { type: "json" };
import catalog from "./fixtures/proof/catalog.json" with { type: "json" };
import manifestDoc from "../../schemas/manifest.json" with { type: "json" };
import packageDoc from "../../schemas/widget-package.json" with { type: "json" };
import outcomesConfig from "./fixtures/mcp-outcomes.config.ts";
import mcpTexts from "./fixtures/mcp-texts.json" with { type: "json" };

const fixtures = "src/__tests__/fixtures";
const config = `${fixtures}/mcp.config.ts`;

function cli(args: string[], preload?: string, env: Record<string, string> = {}) {
  return Bun.spawnSync(
    [
      "bun",
      "--conditions",
      "liveframe:source",
      ...(preload ? ["--preload", preload] : []),
      "src/cli/liveframe.ts",
      "mcp",
      ...args,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, ...env },
    },
  );
}

function valid<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const proofCatalog = valid(validateCatalog(catalog));
const proofCapabilities = valid(validateCapabilities(capabilities));
const [firstDefinition, secondDefinition] = proofCatalog.definitions;
if (!firstDefinition || !secondDefinition) throw new Error("The proof catalog needs at least two definitions");

async function withClient<T>(
  fn: (client: Client) => Promise<T>,
  options: { config?: string; env?: Record<string, string>; protocolVersion?: string } = {},
): Promise<T> {
  const client = new Client(
    { name: "cli-mcp-test", version: "0" },
    options.protocolVersion ? { supportedProtocolVersions: [options.protocolVersion] } : undefined,
  );
  const environment = options.env ? { ...(process.env as Record<string, string>), ...options.env } : undefined;
  await client.connect(
    new StdioClientTransport({
      command: "bun",
      args: ["--conditions", "liveframe:source", "src/cli/liveframe.ts", "mcp", options.config ?? config],
      stderr: "pipe",
      ...(environment ? { env: environment } : {}),
    }),
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
  if (result.isError) expect(result.structuredContent).toBeUndefined();
  return {
    isError: result.isError === true,
    structuredContent: result.structuredContent,
    text: block.text,
    json: () => JSON.parse(block.text) as unknown,
  };
}

async function temp(): Promise<string> {
  const dir = join(tmpdir(), `lf-mcp-${crypto.randomUUID()}`);
  await Bun.write(join(dir, ".keep"), "");
  return dir;
}

async function resultSamples(client: Client) {
  const results: Record<string, Awaited<ReturnType<Client["callTool"]>>> = {};
  const sample = async (key: string, name = key, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError).not.toBe(true);
    results[key] = result;
    return JSON.parse((result.content[0] as { text: string }).text);
  };
  for (const name of ["list_primitives", "list_vocabulary", "list_capabilities", "generated_types"]) await sample(name);
  for (const module of ["implementations", "elementsSchema"])
    await sample(`generated_${module}`, "generated_types", { module });
  await sample("pack_draft", "pack_draft", drafts[4]!);
  const tree = await sample("render_scenarios", "render_scenarios", { scenario: drafts[4]!.scenarios[0]!.name });
  const findQuery = (node: import("../formats/tree.ts").UiNode): import("../formats/tree.ts").UiNode | undefined =>
    node.props.label === "Query" ? node : node.children?.map(findQuery).find(Boolean);
  await sample("set_state", "set_state", {
    origin: { nodeId: findQuery(tree.root)!.id, event: "onChange" },
    value: "changed",
  });
  await sample("statuses", "render_scenarios");
  await sample("outcomes", "render_scenarios", { outcomes: true });
  await sample("capture_preview", "capture_preview", { scenarios: ["ready"], widths: [360] });
  const throwing = {
    ...drafts[4]!,
    files: { "entry.tsx": 'export default () => { throw new Error("sample failure"); };' },
    entry: "entry.tsx",
  };
  await sample("throwing_pack", "pack_draft", throwing);
  await sample("failed_statuses", "render_scenarios");
  results.error = await client.callTool({
    name: "render_scenarios",
    arguments: { scenario: throwing.scenarios[0]!.name },
  });
  expect(results.error.isError).toBe(true);
  return results;
}

test("text_results_unchanged_from_0_2_0", async () => {
  await withClient(
    async (client) => {
      const results = await resultSamples(client);
      const texts = Object.fromEntries(Object.entries(results).map(([name, result]) => [name, result.content]));
      expect<unknown>(texts).toEqual(mcpTexts);
    },
    { config: `${fixtures}/mcp-capture.config.ts` },
  );
}, 30000);

test("structured_content_matches_text_2025_11_25_and_output_schemas_resolve", async () => {
  const protocolVersion = "2025-11-25";
  await withClient(
    async (client) => {
      expect(client.getNegotiatedProtocolVersion()).toBe(protocolVersion);
      const tools = (await client.listTools()).tools;
      expect(tools).toHaveLength(8);
      for (const tool of tools) {
        expect(tool.outputSchema).toBeDefined();
        const refs = JSON.stringify(tool.outputSchema).matchAll(/"\$ref":"([^"]+)"/g);
        for (const [, ref] of refs) expect(ref!.startsWith("#/")).toBe(true);
      }
      const results = await resultSamples(client);
      for (const [name, result] of Object.entries(results)) {
        if (result.isError) {
          expect(result.structuredContent).toBeUndefined();
          continue;
        }
        const value = JSON.parse((result.content[0] as { text: string }).text);
        const enveloped = [
          "list_primitives",
          "render_scenarios",
          "statuses",
          "outcomes",
          "failed_statuses",
          "capture_preview",
        ].includes(name);
        expect(result.structuredContent).toEqual(enveloped ? { result: value } : value);
      }
    },
    { config: `${fixtures}/mcp-capture.config.ts`, protocolVersion },
  );
}, 30000);

test("tools_list_descriptions_and_kinds", async () => {
  const tools = await withClient(async (client) => (await client.listTools()).tools);
  expect(tools.map((tool) => tool.name)).toEqual(
    expect.arrayContaining([
      "generated_types",
      "list_capabilities",
      "list_primitives",
      "list_vocabulary",
      "pack_draft",
      "render_scenarios",
      "set_state",
    ]),
  );
  for (const tool of tools) expect(tool.description?.length ?? 0).toBeGreaterThan(20);
  expect(JSON.stringify(tools.find((tool) => tool.name === "list_primitives")?.inputSchema)).toContain('"kinds"');
}, 30000);

test("tools_list_has_the_eight_tools", async () => {
  const tools = await withClient(async (client) => (await client.listTools()).tools);
  expect(tools.map((tool) => tool.name).sort()).toEqual([
    "capture_preview",
    "generated_types",
    "list_capabilities",
    "list_primitives",
    "list_vocabulary",
    "pack_draft",
    "render_scenarios",
    "set_state",
  ]);
}, 30000);

test("tools_carry_approved_annotations", async () => {
  const tools = await withClient(async (client) => (await client.listTools()).tools);
  expect(
    tools
      .map(({ name, title, annotations }) => [
        name,
        title,
        annotations?.readOnlyHint,
        annotations?.destructiveHint,
        annotations?.idempotentHint,
        annotations?.openWorldHint,
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ).toEqual([
    ["capture_preview", "Capture preview", true, false, true, false],
    ["generated_types", "Generate catalog module", true, false, true, false],
    ["list_capabilities", "List capabilities", true, false, true, false],
    ["list_primitives", "List primitives", true, false, true, false],
    ["list_vocabulary", "List vocabulary", true, false, true, false],
    ["pack_draft", "Pack draft", false, false, true, false],
    ["render_scenarios", "Render scenarios", false, false, true, false],
    ["set_state", "Apply offered state event", false, false, false, false],
  ]);
}, 30000);

test("set_state_tool_validates_and_applies_offered_events", async () => {
  await withClient(async (client) => {
    const input = drafts[4]!;
    expect((await call(client, "set_state")).json()).toMatchObject([{ kind: "not-found" }]);
    expect((await call(client, "pack_draft", input)).isError).toBe(false);
    const rendered = await call(client, "render_scenarios", { scenario: input.scenarios[0]!.name });
    const tree = rendered.json() as import("../formats/tree.ts").UiTree;
    const nodes = (node: typeof tree.root): (typeof tree.root)[] => [node, ...(node.children ?? []).flatMap(nodes)];
    const query = nodes(tree.root).find((n) => n.props.label === "Query")!;
    const action = nodes(tree.root).find((n) => n.props.label === "Bound reason")!;
    for (const [args, kind, pointer] of [
      [{}, "invalid-document", "/origin"],
      [{ origin: { nodeId: query.id } }, "invalid-document", "/origin/event"],
      [{ origin: { nodeId: action.id, event: "onCommit" } }, "invalid-prop", "/origin/event"],
      [{ origin: { nodeId: query.id, event: "onChange" }, value: false }, "invalid-prop", "/value"],
    ] as const) {
      const result = await call(client, "set_state", args);
      expect(result.isError).toBe(true);
      expect(result.json()).toMatchObject([{ kind, pointer }]);
    }
    const next = await call(client, "set_state", {
      origin: { nodeId: query.id, event: "onChange" },
      value: "MCP changed",
    });
    expect(next.isError).toBe(false);
    expect(nodes((next.json() as typeof tree).root).find((n) => n.props.label === "Query")?.props.value).toBe(
      "MCP changed",
    );
  });
}, 30000);

test("tools_list_advertises_outcomes", async () => {
  const tools = await withClient(async (client) => (await client.listTools()).tools);
  const render = tools.find((tool) => tool.name === "render_scenarios");
  const properties = render?.inputSchema.properties;
  expect(Object.keys(properties ?? {}).sort()).toEqual(["context", "outcomes", "scenario", "state"]);
  const outcomes = properties?.outcomes as { description: string };
  for (const status of ["ok", "unauthorized", "unavailable", "stale", "failed"])
    expect(outcomes.description).toContain(status);
  expect(outcomes.description).toContain("boolean");
  expect(render?.description).toContain("outcomes");
}, 30000);

test("mcp_server_imports_no_store", async () => {
  const source = await Bun.file("src/cli/mcp.ts").text();
  expect(source).not.toMatch(/from ".*\/store/);
  expect(source).not.toMatch(/import\(".*\/store/);
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

test("list_vocabulary_names_the_catalog", async () => {
  const result = await withClient((client) => call(client, "list_vocabulary"));
  expect(result.isError).toBe(false);
  expect(result.json()).toEqual({ catalogId: proofCatalog.catalogId, vocabulary: proofCatalog.vocabulary });
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

test("list_capabilities_hides_meta_by_default", async () => {
  const hidden = await withClient((client) => call(client, "list_capabilities"), {
    config: `${fixtures}/mcp-meta.config.ts`,
  });
  expect(hidden.text).not.toContain("tier");
  expect(hidden.structuredContent).toEqual(proofCapabilities);
  expect(hidden.json()).toEqual(proofCapabilities);
  const shown = await withClient((client) => call(client, "list_capabilities"), {
    config: `${fixtures}/mcp-meta-exposed.config.ts`,
  });
  expect(shown.text).toContain('"meta":{"tier":"gold"}');
  expect(shown.text).toContain('"meta":{"tier":"silver"}');
  expect(shown.structuredContent).toEqual(shown.json());
}, 30000);

test("generated_types_equals_liveframe_gen_output", async () => {
  const result = await withClient((client) => call(client, "generated_types"));
  const { note, types } = result.json() as { note: string; types: string };
  expect(types).toBe(await Bun.file("src/__tests__/fixtures/widgets/ui.gen.ts").text());
  expect(note).toContain("ui.gen.ts");
}, 30000);

test("generated_modules_match_cli_bytes", async () => {
  const dir = await temp();
  try {
    await withClient(async (client) => {
      const tool = (await client.listTools()).tools.find((tool) => tool.name === "generated_types");
      const description = (tool?.inputSchema.properties?.module as { description: string } | undefined)?.description;
      for (const [module, flag, filename] of [
        ["types", undefined, "ui.gen.ts"],
        ["implementations", "--implementations", "ui.definitions.gen.ts"],
        ["elementsSchema", "--elements-schema", "elements.schema.json"],
      ] as const) {
        expect(description).toContain(module);
        const out = join(dir, filename);
        const proc = Bun.spawnSync([
          "bun",
          "src/cli/liveframe.ts",
          "gen",
          `${fixtures}/proof/catalog.json`,
          "--out",
          out,
          ...(flag ? [flag] : []),
        ]);
        expect(proc.exitCode).toBe(0);
        const result = await call(client, "generated_types", { module });
        expect(result.isError).toBe(false);
        expect(result.json()).toEqual({ note: expect.stringContaining(filename), types: await Bun.file(out).text() });
      }
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 30000);

test("generated_types_rejects_unknown_module", async () => {
  await withClient(async (client) => {
    for (const module of ["unknown", null, 42, {}, []]) {
      const result = await call(client, "generated_types", { module });
      expect(result.isError).toBe(true);
      expect(result.json()).toEqual([
        expect.objectContaining({
          kind: "invalid-document",
          pointer: "/module",
          expected: '"types", "implementations", "elementsSchema"',
        }),
      ]);
    }
  });
}, 30000);

const agentHome = drafts[0];
if (!agentHome) throw new Error("Missing agent-home draft");
const agentManifest = agentHome.manifest as Record<string, unknown>;
const agentScenario = agentHome.scenarios[0]?.name;
if (!agentScenario) throw new Error("The agent-home draft needs a scenario");

test("render_outcomes_over_mcp_matches_library", async () => {
  const input = {
    ...agentHome,
    files: {
      "entry.ts":
        'import { jsx, primitive } from "@arnilo/liveframe/sdk"; export default ({ data }) => jsx(primitive("text"), { text: data.result.status });',
    },
    entry: "entry.ts",
    manifest: { ...agentManifest, sources: { result: { source: "outcome", params: {} } } },
    scenarios: [{ ...agentHome.scenarios[0]!, data: { result: { status: "ok", value: "ready" } } }],
  };
  const authoring = createAuthoring({
    catalog: proofCatalog,
    capabilities: valid(validateCapabilities(outcomesConfig.capabilities)),
    runner: inProcessRunner(),
  });
  try {
    valid(await authoring.packDraft(input));
    await withClient(
      async (client) => {
        expect((await call(client, "pack_draft", input)).isError).toBe(false);
        for (const args of [{ outcomes: true }, { scenario: agentScenario, outcomes: true }]) {
          const result = await call(client, "render_scenarios", args);
          expect(result.isError).toBe(false);
          expect(result.json()).toEqual(valid(await authoring.renderScenarios(args)));
          expect(result.json()).toEqual(
            ["ok", "unauthorized", "unavailable", "stale", "failed"].map((status) => ({
              scenario: `${agentScenario}.${status}`,
              ok: true,
              nodes: 1,
            })),
          );
        }
      },
      { config: `${fixtures}/mcp-outcomes.config.ts` },
    );
  } finally {
    await authoring.close();
  }
}, 30000);

test("render_outcomes_rejects_non_boolean", async () => {
  const result = await withClient((client) => call(client, "render_scenarios", { outcomes: "yes" }));
  expect(result.isError).toBe(true);
  expect(result.json()).toMatchObject([{ kind: "invalid-document", pointer: "/outcomes" }]);
}, 30000);

function countNodes(node: { children?: readonly unknown[] }): number {
  const children = node.children ?? [];
  return 1 + children.reduce<number>((sum, child) => sum + countNodes(child as { children?: readonly unknown[] }), 0);
}

test("pack_draft_returns_the_hash_session_update_returns", async () => {
  const result = await withClient((client) => call(client, "pack_draft", agentHome));
  expect(result.isError).toBe(false);
  const expected = valid(pack(agentHome, { catalog: proofCatalog, capabilities: proofCapabilities }));
  expect(result.json()).toEqual({
    hash: expected.hash,
    id: expected.manifest.id,
    version: expected.manifest.version,
    scenarios: expected.scenarios.map(({ name }) => name),
  });
}, 30000);

test("pack_draft_shows_description_and_hides_meta_unless_exposed", async () => {
  const described = {
    ...agentHome,
    manifest: { ...agentManifest, description: "Pending decisions.", meta: { sizes: ["m"] } },
  };
  const hidden = await withClient((client) => call(client, "pack_draft", described));
  expect(hidden.isError).toBe(false);
  expect(hidden.json()).toMatchObject({ description: "Pending decisions." });
  expect(hidden.text).not.toContain("tier");
  expect(hidden.structuredContent).toEqual(hidden.json());
  expect(hidden.structuredContent).not.toHaveProperty("meta");
  const shown = await withClient((client) => call(client, "pack_draft", described), {
    config: `${fixtures}/mcp-meta-exposed.config.ts`,
  });
  expect(shown.json()).toMatchObject({ description: "Pending decisions.", meta: { sizes: ["m"] } });
  expect(shown.structuredContent).toEqual(shown.json());
}, 30000);

test("pack_errors_keep_the_previous_package", async () => {
  const failed = await withClient(async (client) => {
    expect((await call(client, "pack_draft", agentHome)).isError).toBe(false);
    const broken = { ...agentHome, files: { "entry.ts": "export default (" } };
    const result = await call(client, "pack_draft", broken);
    expect(result.isError).toBe(true);
    expect((result.json() as LiveframeError[])[0]?.kind).toBe("transpile-failed");
    return call(client, "render_scenarios", { scenario: agentScenario });
  });
  expect(failed.isError).toBe(false);
  expect((failed.json() as { format: string }).format).toBe("liveframe/1");
}, 30000);

test("argument_errors_are_liveframe_errors", async () => {
  const result = await withClient((client) =>
    call(client, "pack_draft", { ...agentHome, manifest: { ...agentManifest, id: "Bad Id" } }),
  );
  expect(result.isError).toBe(true);
  // One error shape, and the pointer is rooted at the document the agent edits.
  expect(result.text).not.toContain("Input validation error");
  const [error] = result.json() as LiveframeError[];
  expect(error?.kind).toBe("invalid-document");
  expect(error?.pointer).toBe("/manifest/id");
  // The envelope is checked too, with the same shape.
  const empty = await withClient((client) =>
    call(client, "pack_draft", { files: {}, entry: "missing.ts", manifest: {}, scenarios: [] }),
  );
  const [first] = empty.json() as LiveframeError[];
  expect(first?.pointer).toBe("/files");
  expect(empty.text).not.toContain("Input validation error");
}, 30000);

test("oversized_tree_is_refused_with_a_typed_error", async () => {
  const draft = {
    ...agentHome,
    files: {
      ...agentHome.files,
      "big.tsx": `/** @jsxImportSource @arnilo/liveframe/sdk */
import { Stack, Text } from "./ui.gen.ts";
const rows = Array.from({ length: 1200 }, (_, index) => index);
export default function Big() {
  return (
    <Stack gap="space.1">
      {rows.map((index) => (
        <Text key={String(index)} text={"row-" + index + "-" + "x".repeat(200)} />
      ))}
    </Stack>
  );
}
`,
    },
  };
  const result = await withClient(async (client) => {
    const packed = await call(client, "pack_draft", { ...draft, entry: "big.tsx" });
    expect(packed.isError).toBe(false);
    return call(client, "render_scenarios", { scenario: agentScenario });
  });
  expect(result.isError).toBe(true);
  const [error] = result.json() as LiveframeError[];
  expect(error?.kind).toBe("limit-exceeded");
  expect(error?.pointer).toBe("/scenario");
  expect(error?.expected).toContain(String(262144));
  expect(error?.message).toMatch(/rendered \d+ bytes/);
  expect(Number(error?.message.match(/rendered (\d+) bytes/)?.[1])).toBeGreaterThan(262144);
}, 60000);

test("all_scenarios_errors_are_deduplicated", async () => {
  const throwing = {
    files: { "entry.ts": 'export default () => { throw new Error("boom"); };' },
    entry: "entry.ts",
    manifest: agentManifest,
    scenarios: agentHome.scenarios,
  };
  const result = await withClient(async (client) => {
    await call(client, "pack_draft", throwing);
    return call(client, "render_scenarios");
  });
  const statuses = result.json() as { ok: boolean; kind?: string; scenarios?: string[] }[];
  const shared = statuses.filter((status) => !status.ok);
  expect(shared).toHaveLength(1);
  expect(shared[0]?.kind).toBe("render-failed");
  expect(shared[0]?.scenarios).toEqual(agentHome.scenarios.map((scenario) => scenario.name));
  // The identical error appears once in the answer, not once per scenario.
  expect(result.text.split("boom")).toHaveLength(2);
}, 60000);

test("errors_differing_only_in_expected_are_kept", () => {
  const shared = { kind: "invalid-prop", pointer: "/root/params/gap", message: "Invalid prop" } as const;
  const results = [
    { scenario: "a", result: { ok: false, errors: [{ ...shared, expected: "a number" }] } },
    { scenario: "b", result: { ok: false, errors: [{ ...shared, expected: "a string" }] } },
    { scenario: "c", result: { ok: false, errors: [{ ...shared, expected: "a number" }] } },
  ] as unknown as Parameters<typeof checkAll>[0];
  const statuses = checkAll(results);
  expect(statuses.map((status) => (status.ok ? "ok" : [status.expected, status.scenarios]))).toEqual([
    ["a number", ["a", "c"]],
    ["a string", ["b"]],
  ]);
}, 60000);

test("cross_reference_error_is_a_liveframe_error", async () => {
  const result = await withClient((client) =>
    call(client, "pack_draft", { ...agentHome, manifest: { ...agentManifest, actions: ["not.declared"] } }),
  );
  expect(result.isError).toBe(true);
  const [error] = result.json() as LiveframeError[];
  expect(error).toEqual(expect.objectContaining({ kind: "unknown-name", pointer: "/manifest/actions/0" }));
}, 30000);

test("render_scenarios_returns_tree_or_errors", async () => {
  const throwing = {
    files: { "entry.ts": 'export default () => { throw new Error("boom"); };' },
    entry: "entry.ts",
    manifest: agentManifest,
    scenarios: agentHome.scenarios,
  };
  const [tree, errors, absent] = await withClient(async (client) => {
    await call(client, "pack_draft", agentHome);
    const tree = await call(client, "render_scenarios", { scenario: agentScenario });
    await call(client, "pack_draft", throwing);
    return [
      tree,
      await call(client, "render_scenarios", { scenario: agentScenario }),
      await call(client, "render_scenarios", { scenario: "absent" }),
    ];
  });
  expect(tree?.isError).toBe(false);
  expect(tree?.json()).toEqual(expect.objectContaining({ format: "liveframe/1", catalogId: proofCatalog.catalogId }));
  expect(errors?.isError).toBe(true);
  const [renderError] = (errors?.json() ?? []) as LiveframeError[];
  expect(renderError?.kind).toBe("render-failed");
  expect(absent?.isError).toBe(true);
  const [notFound] = (absent?.json() ?? []) as LiveframeError[];
  expect(notFound?.kind).toBe("not-found");
}, 30000);

test("render_all_matches_session_check", async () => {
  const session = createPreview({ catalog: proofCatalog, capabilities: proofCapabilities, runner: inProcessRunner() });
  expect(session.update(agentHome).ok).toBe(true);
  const checked = valid(await session.check());
  const expected = checked.map(({ scenario, result }) =>
    result.ok
      ? { scenario, ok: true, nodes: countNodes(result.value.root) }
      : { scenario, ok: false, errors: result.errors },
  );
  const result = await withClient(async (client) => {
    await call(client, "pack_draft", agentHome);
    return call(client, "render_scenarios");
  });
  expect(result.isError).toBe(false);
  expect(result.json()).toEqual(expected);
  expect(expected.length).toBeGreaterThan(1);
}, 60000);

test("render_before_pack_says_to_pack_first", async () => {
  const result = await withClient((client) => call(client, "render_scenarios", { scenario: "ready" }));
  expect(result.isError).toBe(true);
  expect((result.json() as LiveframeError[])[0]?.message).toContain("pack_draft");
}, 30000);

test("config_runner_is_used_for_every_render", async () => {
  const dir = await temp();
  try {
    const log = join(dir, "renders.log");
    const result = await withClient(
      async (client) => {
        await call(client, "pack_draft", agentHome);
        await call(client, "render_scenarios");
        return call(client, "render_scenarios", { scenario: agentScenario });
      },
      { config: `${fixtures}/mcp-spy.config.ts`, env: { LF_MCP_RENDER_LOG: log } },
    );
    expect(result.isError).toBe(false);
    const lines = (await Bun.file(log).text()).trim().split("\n");
    expect(lines.length).toBe(agentHome.scenarios.length + 1);
    expect(new Set(lines).size).toBe(1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 60000);

test("pack_draft_schema_embeds_the_published_schemas", async () => {
  const tools = await withClient(async (client) => (await client.listTools()).tools);
  const schema = tools.find((tool) => tool.name === "pack_draft")?.inputSchema as unknown as {
    properties: Record<string, object>;
    required?: string[];
    $defs: Record<string, unknown>;
  };
  // The handler validates the nested documents, so the argument object stays permissive and documented.
  expect(schema.required ?? []).toEqual([]);
  expect(Object.keys(schema.properties).sort()).toEqual(["dir", "entry", "files", "manifest", "scenarios"]);
  for (const shape of Object.values(schema.properties)) expect(Object.keys(shape)).toEqual(["description"]);
  // The published shapes stay visible to an agent reading `tools/list`.
  expect(schema.$defs.scenario).toEqual(packageDoc.$defs.scenario);
  expect(schema.$defs.schema).toEqual(manifestDoc.$defs.schema);
}, 30000);

test("pack_missing_key_is_a_liveframe_error", async () => {
  await withClient(async (client) => {
    for (const key of ["files", "entry", "manifest", "scenarios"]) {
      const input: Record<string, unknown> = { ...agentHome };
      delete input[key];
      const result = await call(client, "pack_draft", input);
      expect(result.isError).toBe(true);
      expect(result.json()).toContainEqual(
        expect.objectContaining({ kind: "invalid-document", pointer: `/${key}`, message: expect.any(String) }),
      );
    }
  });
}, 30000);

test("pack_missing_keys_reports_each", async () => {
  await withClient(async (client) => {
    for (const params of [{ name: "pack_draft", arguments: {} }, { name: "pack_draft" }]) {
      const result = await client.callTool(params);
      expect(result.isError).toBe(true);
      const [block] = result.content as [{ type: "text"; text: string }];
      const errors = JSON.parse(block.text) as LiveframeError[];
      expect([...new Set(errors.map(({ pointer }) => pointer))].sort()).toEqual([
        "/entry",
        "/files",
        "/manifest",
        "/scenarios",
      ]);
      for (const error of errors) expect(error.kind).toBe("invalid-document");
    }
  });
}, 30000);

test("tools_list_describes_required_keys", async () => {
  const tools = await withClient(async (client) => (await client.listTools()).tools);
  const properties = tools.find((tool) => tool.name === "pack_draft")?.inputSchema.properties;
  for (const key of ["files", "entry", "manifest", "scenarios"])
    expect((properties?.[key] as { description?: string } | undefined)?.description).toContain("Required");
}, 30000);

test("pack_non_object_arguments_are_protocol_errors", async () => {
  await withClient(async (client) => {
    for (const args of [null, [], "invalid", 1]) {
      await expect(
        client.request({ method: "tools/call", params: { name: "pack_draft", arguments: args } }, CallToolResultSchema),
      ).rejects.toMatchObject({ code: -32602 });
    }
  });
}, 30000);

test("default_runner_warns_on_stderr", async () => {
  const defaulted = cli([`${fixtures}/mcp-worker.config.ts`]);
  expect(defaulted.stderr.toString()).toContain("workerRunner()");
  expect(defaulted.stderr.toString()).toContain("permissions");
  // A configured runner needs no warning: the app already chose the isolation it wants.
  const configured = cli([config]);
  expect(configured.stderr.toString()).not.toContain("workerRunner()");
});

test("mcp_server_initializes_over_stdio", async () => {
  const client = new Client({ name: "cli-mcp-test", version: "0" });
  await client.connect(
    new StdioClientTransport({
      command: "bun",
      args: ["--conditions", "liveframe:source", "src/cli/liveframe.ts", "mcp", config],
      stderr: "pipe",
    }),
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
        "--conditions",
        "liveframe:source",
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
    const child = Bun.spawn(
      [
        "bun",
        "--conditions",
        "liveframe:source",
        "src/cli/liveframe.ts",
        "mcp",
        `${fixtures}/mcp-runner-close.config.ts`,
      ],
      {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, LF_MCP_CLOSE_MARKER: marker },
      },
    );
    // Let the server start and connect before ending its input.
    await Bun.sleep(500);
    child.stdin.end();
    const code = await Promise.race([child.exited, Bun.sleep(10000).then(() => "timeout" as const)]);
    expect(code).toBe(0);
    // A config-supplied runner is never closed by the server.
    expect(await Bun.file(marker).exists()).toBe(false);

    // SIGTERM shuts the server down the same way stdin end does, with a clean exit.
    const signalled = Bun.spawn(
      ["bun", "--conditions", "liveframe:source", "src/cli/liveframe.ts", "mcp", `${fixtures}/mcp-worker.config.ts`],
      {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    await Bun.sleep(2000);
    signalled.kill("SIGTERM");
    expect(await Promise.race([signalled.exited, Bun.sleep(10000).then(() => "timeout" as const)])).toBe(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 30000);

test("mcp_capture_with_injected_backend", async () => {
  await withClient(
    async (client) => {
      const packed = await call(client, "pack_draft", drafts[0] as unknown as Record<string, unknown>);
      expect(packed.isError).toBe(false);
      const result = await client.callTool({
        name: "capture_preview",
        arguments: { scenarios: ["ready"], widths: [360] },
      });
      expect(result.isError).not.toBe(true);
      expect(result.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "image", data: "iVBORw==" }),
          expect.objectContaining({ type: "text", text: 'ready @360px\n- text "Hello"\n' }),
        ]),
      );
    },
    { config: `${fixtures}/mcp-capture.config.ts` },
  );
});

test("mcp_capture_maps_backend_errors", async () => {
  await withClient(
    async (client) => {
      await call(client, "pack_draft", drafts[0] as unknown as Record<string, unknown>);
      const result = await call(client, "capture_preview");
      expect(result.isError).toBe(true);
      expect(result.json()).toEqual([expect.objectContaining({ kind: "render-failed", message: "backend failed" })]);
    },
    { config: `${fixtures}/mcp-capture.config.ts`, env: { LF_CAPTURE_FAILURE: "1" } },
  );
});

test("mcp_capture_without_snapshot", async () => {
  await withClient(
    async (client) => {
      await call(client, "pack_draft", drafts[0] as unknown as Record<string, unknown>);
      const result = await client.callTool({
        name: "capture_preview",
        arguments: { scenarios: ["ready"], widths: [360] },
      });
      expect(result.isError).not.toBe(true);
      expect(result.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "text", text: "ready @360px\n" }),
          expect.objectContaining({ type: "image" }),
        ]),
      );
    },
    { config: `${fixtures}/mcp-capture.config.ts`, env: { LF_NULL_SNAPSHOT: "1" } },
  );
});

async function withDraftDirectory(work: (root: string, client: Client) => Promise<void>) {
  const root = await temp();
  try {
    await Bun.write(
      join(root, "widget", "entry.tsx"),
      "throw new Error('directory-draft-marker'); export default () => null;",
    );
    await Bun.write(join(root, "widget", "manifest.json"), JSON.stringify(agentManifest));
    await Bun.write(join(root, "widget", "scenarios.json"), JSON.stringify(drafts[0]!.scenarios));
    await withClient((client) => work(root, client), {
      config: `${fixtures}/mcp-draft-root.config.ts`,
      env: { LIVEFRAME_TEST_DRAFT_ROOT: relative(process.cwd(), root) },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(`${root}-sibling`, { recursive: true, force: true });
  }
}

test("pack_dir_matches_inline_hash", async () => {
  await withDraftDirectory(async (root, client) => {
    const { readDraft } = await import("../../examples/demo-host/widgets/draft.ts");
    const inline = await call(client, "pack_draft", await readDraft(join(root, "widget")));
    expect(inline.isError).toBe(false);
    await Bun.write(join(root, "widget/ignored.txt"), "ignored");
    await Bun.write(join(root, "widget/nested/ignored.ts"), "invalid syntax ignored");
    await symlink(join(root, "widget"), join(root, "alias"));
    const directory = await call(client, "pack_draft", { dir: "alias" });
    expect(directory.isError).toBe(false);
    expect(directory.json()).toEqual(inline.json());
    await Bun.write(join(root, "widget/helper.ts"), "throw new Error('packing must not execute this');");
    expect((await call(client, "pack_draft", { dir: "widget" })).isError).toBe(false);
    await rm(join(root, "widget/helper.ts"));
    expect((await call(client, "pack_draft", { dir: "widget", entry: "entry.tsx" })).json()).toEqual(inline.json());
    const tools = (await client.listTools()).tools;
    expect(tools.find((tool) => tool.name === "pack_draft")?.inputSchema.properties).toHaveProperty("dir");
  });
}, 30000);

const directoryCases: Record<
  string,
  { args?: Record<string, unknown>; kind: string; prepare?: (root: string) => Promise<unknown> }
> = {
  absolute: { args: { dir: "/tmp" }, kind: "invalid-document" },
  dotdot: { args: { dir: "widget/../widget" }, kind: "invalid-document" },
  empty: { args: { dir: "" }, kind: "invalid-document" },
  nonstring: { args: { dir: 42 }, kind: "invalid-document" },
  missing_directory: { args: { dir: "absent" }, kind: "not-found" },
  missing_manifest: { kind: "not-found", prepare: (root) => rm(join(root, "widget/manifest.json")) },
  missing_scenarios: { kind: "not-found", prepare: (root) => rm(join(root, "widget/scenarios.json")) },
  missing_entry: { args: { dir: "widget", entry: "absent.tsx" }, kind: "not-found" },
  malformed_json: { kind: "invalid-document", prepare: (root) => Bun.write(join(root, "widget/manifest.json"), "{") },
  nonregular_file: {
    kind: "invalid-document",
    prepare: async (root) => {
      await mkdir(join(root, "widget/directory.ts"));
    },
  },
  source_count_bound: {
    kind: "limit-exceeded",
    prepare: async (root) => {
      for (let i = 0; i < 129; i++) await Bun.write(join(root, `widget/source${i}.ts`), "");
    },
  },
  aggregate_byte_bound: {
    kind: "limit-exceeded",
    prepare: (root) => Bun.write(join(root, "widget/large.ts"), " ".repeat(1048576)),
  },
  with_files: { args: { dir: "widget", files: {} }, kind: "invalid-document" },
  with_manifest: { args: { dir: "widget", manifest: {} }, kind: "invalid-document" },
  with_scenarios: { args: { dir: "widget", scenarios: [] }, kind: "invalid-document" },
  symlink_escape: {
    args: { dir: "escape" },
    kind: "invalid-document",
    prepare: (root) => symlink(tmpdir(), join(root, "escape")),
  },
  file_symlink_escape: {
    kind: "invalid-document",
    prepare: async (root) => {
      await rm(join(root, "widget/manifest.json"));
      await symlink(join(process.cwd(), "package.json"), join(root, "widget/manifest.json"));
    },
  },
  sibling_prefix_escape: {
    args: { dir: "escape" },
    kind: "invalid-document",
    prepare: async (root) => {
      const sibling = `${root}-sibling`;
      await mkdir(sibling);
      await symlink(sibling, join(root, "escape"));
    },
  },
};
for (const [name, { args = { dir: "widget" }, kind, prepare }] of Object.entries(directoryCases)) {
  test(`pack_dir_rejects_${name}`, async () => {
    await withDraftDirectory(async (root, client) => {
      await prepare?.(root);
      const result = await call(client, "pack_draft", args);
      expect(result.isError).toBe(true);
      expect(result.json()).toEqual([expect.objectContaining({ kind, pointer: "/dir" })]);
    });
  }, 30000);
}

test("pack_dir_without_root_names_draftRoot", async () => {
  const result = await withClient((client) => call(client, "pack_draft", { dir: "widget" }));
  expect(result.isError).toBe(true);
  expect(result.json()).toEqual([
    expect.objectContaining({ kind: "not-found", pointer: "/dir", message: expect.stringContaining("draftRoot") }),
  ]);
});

test("config_rejects_missing_draft_root", () => {
  for (const root of ["/liveframe-missing-draft-root", "package.json"]) {
    const result = cli([`${fixtures}/mcp-draft-root.config.ts`], undefined, { LIVEFRAME_TEST_DRAFT_ROOT: root });
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stderr.toString())).toEqual([
      expect.objectContaining({ kind: "invalid-document", pointer: "/draftRoot" }),
    ]);
  }
});

test("pack_dir_accepts_exact_read_bounds", async () => {
  await withDraftDirectory(async (root, client) => {
    for (let i = 0; i < 127; i++) await Bun.write(join(root, `widget/source${i}.ts`), "");
    const jsonBytes =
      Bun.file(join(root, "widget/manifest.json")).size + Bun.file(join(root, "widget/scenarios.json")).size;
    const source = "export default () => null;";
    await Bun.write(join(root, "widget/entry.tsx"), source + " ".repeat(1048576 - jsonBytes - source.length));
    expect((await call(client, "pack_draft", { dir: "widget" })).isError).toBe(false);
  });
}, 30000);

test("config_rejects_nonstring_draft_root", async () => {
  const root = await temp();
  try {
    const path = join(root, "config.ts");
    await Bun.write(
      path,
      `import config from ${JSON.stringify(join(process.cwd(), config))}; export default { ...config, draftRoot: 42 };`,
    );
    const result = cli([path]);
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stderr.toString())).toEqual([
      expect.objectContaining({ kind: "invalid-document", pointer: "/draftRoot" }),
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pack_dir_joins_arrival_order_before_render", async () => {
  await withDraftDirectory(async (_root, client) => {
    const packing = call(client, "pack_draft", { dir: "widget" });
    const rendering = call(client, "render_scenarios", { scenario: agentScenario });
    expect((await packing).isError).toBe(false);
    const rendered = await rendering;
    expect(rendered.isError).toBe(true);
    expect(rendered.text).toContain("directory-draft-marker");
  });
}, 30000);
