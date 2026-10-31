import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { expect, test } from "bun:test";
import {
  LiveframeFailure,
  obj,
  sourceOutcome,
  str,
  type UiNode,
  type UiTree,
  validateCapabilities,
} from "@arnilo/liveframe";
import { createAuthoring } from "@arnilo/liveframe/authoring";
import type { PreviewBinding } from "@arnilo/liveframe/preview";
import { inProcessRunner } from "@arnilo/liveframe/preview";
import { generate, generateDefinitions, generateElementsSchema } from "@arnilo/liveframe/sdk/gen";
import { validateManifestShape } from "../formats/manifest.ts";
import { fakeCapture } from "./fixtures/capture-backend.ts";
import { drafts, packageOptions, value } from "./fixtures/widgets/drafts.ts";

const draft = { ...drafts[0]!, manifest: value(validateManifestShape(drafts[0]!.manifest)) };
const options = () => ({ ...packageOptions, runner: inProcessRunner() });

test("set_state_applies_offered_event_and_refuses_invalid_origins_and_actions", async () => {
  let binding!: PreviewBinding;
  let renders = 0;
  const delegate = inProcessRunner();
  const a = createAuthoring({
    ...options(),
    runner: {
      render(...args) {
        renders++;
        return delegate.render(...args);
      },
    },
    capture: fakeCapture().backend,
    preview: async (b) => {
      binding = b;
      return { url: "https://example.test", async close() {} };
    },
  });
  const input = drafts[4]!;
  const beforeRender = () =>
    expect(a.setState({ origin: { nodeId: "root", event: "onPress" } })).resolves.toMatchObject({
      ok: false,
      errors: [{ kind: "not-found", message: "Call render_scenarios with a scenario first" }],
    });
  try {
    await beforeRender();
    value(await a.packDraft(input));
    await a.renderScenarios();
    await beforeRender();
    const tree = value(await a.renderScenarios({ scenario: input.scenarios[0]!.name })) as UiTree;
    const nodes = (node: UiNode): UiNode[] => [node, ...(node.children ?? []).flatMap(nodes)];
    const all = nodes(tree.root);
    const query = all.find((n) => n.props.label === "Query")!;
    const literal = all.find((n) => n.props.label === "Select task:0")!;
    const action = all.find((n) => n.props.label === "Bound reason")!;
    await a.capturePreview();
    const log = binding.session.intents();
    for (const [input, kind, pointer] of [
      [{}, "invalid-document", "/origin"],
      [{ key: "query", value: "forged" }, "invalid-document", "/origin"],
      [{ origin: { nodeId: query.id } }, "invalid-document", "/origin/event"],
      [{ origin: { nodeId: "missing", event: "onChange" } }, "not-found", "/origin/nodeId"],
      [{ origin: { nodeId: query.id, event: "toString" } }, "undeclared-event", "/origin/event"],
      [{ origin: { nodeId: action.id, event: "onCommit" }, value: "reason" }, "invalid-prop", "/origin/event"],
      [{ origin: { nodeId: query.id, event: "onChange" }, value: 42 }, "invalid-prop", "/value"],
    ] as const) {
      expect(await a.setState(input as never)).toMatchObject({ ok: false, errors: [{ kind, pointer }] });
      expect(binding.session.intents()).toEqual(log);
    }
    // These calls share the draft queue, including checks that must not change selection.
    const count = renders;
    const next = value(await a.setState({ origin: { nodeId: query.id, event: "onChange" }, value: "kept" }));
    expect(renders).toBe(count + 1);
    const changed = a.setState({ origin: { nodeId: query.id, event: "onChange" }, value: "queued" });
    const checked = a.renderScenarios({ outcomes: true });
    value(await changed);
    expect(nodes(next.root).find((n) => n.props.label === "Query")?.props.value).toBe("kept");
    await checked;
    expect((await a.packDraft({ ...input, files: {} } as never)).ok).toBe(false);
    const selected = value(await a.setState({ origin: { nodeId: literal.id, event: "onPress" }, value: "ignored" }));
    expect(nodes(selected.root).some((n) => n.props.text === "Selected: task:0")).toBe(true);
    const snapshot = value(await binding.session.render({ scenario: input.scenarios[0]!.name, preserveState: true }));
    expect(nodes(snapshot.root).find((n) => n.props.label === "Query")?.props.value).toBe("queued");
    value(await a.setState({ origin: { nodeId: query.id, event: "onChange" }, value: "after snapshot" }));
    const reset = value(
      await a.renderScenarios({ scenario: input.scenarios[0]!.name, preserveState: true } as never),
    ) as UiTree;
    expect(nodes(reset.root).find((n) => n.props.label === "Query")?.props.value).toBe("");
    value(await a.packDraft(input));
    await beforeRender();
  } finally {
    await a.close();
  }
});

test("set_state_bounds_the_rerendered_tree", async () => {
  const delegate = inProcessRunner();
  let large = false;
  const a = createAuthoring({
    ...options(),
    runner: {
      async render(...args) {
        const result = await delegate.render(...args);
        if (!large || !result.ok) return result;
        return {
          ok: true,
          value: { ...result.value, root: { ...result.value.root, props: { text: "😀".repeat(70000) } } },
        };
      },
    },
  });
  try {
    const input = drafts[4]!;
    value(await a.packDraft(input));
    const tree = value(await a.renderScenarios({ scenario: input.scenarios[0]!.name })) as UiTree;
    const find = (node: UiNode): UiNode | undefined =>
      node.props.label === "Query" ? node : node.children?.map(find).find(Boolean);
    large = true;
    expect(
      await a.setState({ origin: { nodeId: find(tree.root)!.id, event: "onChange" }, value: "large" }),
    ).toMatchObject({
      ok: false,
      errors: [{ kind: "limit-exceeded", pointer: "/scenario" }],
    });
    expect(await a.setState({ origin: { nodeId: "root", event: "onChange" } })).toMatchObject({
      ok: false,
      errors: [{ kind: "not-found" }],
    });
  } finally {
    await a.close();
  }
});

test("generated_types_default_unchanged", async () => {
  const a = createAuthoring(options());
  try {
    const expected = {
      note: 'Save this as ui.gen.ts beside the widget and import from "./ui.gen".',
      types: generate(packageOptions.catalog),
    };
    expect(value(await a.generatedTypes())).toEqual(expected);
    expect(value(await a.generatedTypes({ module: "types" }))).toEqual(expected);
    expect(value(await a.generatedTypes({ module: "implementations" })).types).toBe(
      generateDefinitions(packageOptions.catalog),
    );
    expect(value(await a.generatedTypes({ module: "elementsSchema" })).types).toBe(
      generateElementsSchema(packageOptions.catalog),
    );
    for (const module of ["unknown", null, 42, {}, []])
      expect(await a.generatedTypes({ module } as never)).toMatchObject({
        ok: false,
        errors: [
          { kind: "invalid-document", pointer: "/module", expected: '"types", "implementations", "elementsSchema"' },
        ],
      });
  } finally {
    await a.close();
  }
});

test("authoring_operations_match_mcp_tools", async () => {
  const a = createAuthoring(options());
  expect(value(await a.listPrimitives())).toEqual(packageOptions.catalog.definitions);
  expect(await a.listPrimitives({ kinds: ["missing"] })).toMatchObject({
    ok: false,
    errors: [{ kind: "unknown-component", pointer: "/kinds/0" }],
  });
  expect(value(await a.listVocabulary())).toEqual({
    catalogId: packageOptions.catalog.catalogId,
    vocabulary: packageOptions.catalog.vocabulary,
  });
  expect(value(await a.generatedTypes()).types).toBe(generate(packageOptions.catalog));
  expect(value(await a.listCapabilities()).sources).toEqual(packageOptions.capabilities.sources);
  expect(await a.renderScenarios()).toMatchObject({ ok: false, errors: [{ kind: "not-found" }] });
  const packed = value(await a.packDraft(draft));
  expect(packed).toMatchObject({ id: draft.manifest.id, scenarios: draft.scenarios.map((s) => s.name) });
  expect(value(await a.renderScenarios())).toEqual(
    draft.scenarios.map((s) => expect.objectContaining({ scenario: s.name, ok: true })),
  );
  expect(await a.renderScenarios({ scenario: draft.scenarios[0]!.name })).toMatchObject({
    ok: true,
    value: { root: { kind: expect.any(String) } },
  });
  expect(await a.packDraft({ ...draft, manifest: {} } as never)).toMatchObject({
    ok: false,
    errors: expect.arrayContaining([expect.objectContaining({ pointer: "/manifest/format" })]),
  });
  expect((await a.renderScenarios()).ok).toBe(true);
  expect(await a.renderScenarios({ outcomes: "yes" } as never)).toMatchObject({
    ok: false,
    errors: [{ pointer: "/outcomes" }],
  });
  expect(await a.capturePreview()).toMatchObject({ ok: false, errors: [{ kind: "not-found" }] });
  await a.close();
});

test("authoring_serializes_draft_operations_and_binds_lazily", async () => {
  const fake = fakeCapture({
    scenarios: [draft.scenarios[0]!.name],
    widths: [360],
    themes: ["light"],
    designSystems: ["plain"],
  });
  let bound = 0;
  let closed = 0;
  let binding: PreviewBinding | undefined;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const a = createAuthoring({
    ...options(),
    capture: fake.backend,
    preview: async (b) => {
      binding = b;
      bound++;
      await gate;
      return {
        url: "https://example.test/preview",
        async close() {
          closed++;
        },
      };
    },
  });
  await a.packDraft(draft);
  expect(bound).toBe(0);
  const capture = a.capturePreview();
  let packed = false;
  const next = a.packDraft({ ...draft, manifest: { ...draft.manifest, version: "2.0.0" } }).then((r) => {
    packed = true;
    return r;
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(bound).toBe(1);
  expect(packed).toBe(false);
  expect(binding!.package().manifest.version).toBe(draft.manifest.version);
  release();
  const cells = value(await capture);
  expect(cells[0]).toMatchObject({ png: new Uint8Array([137, 80, 78, 71]), aria: '- text "Hello"\n' });
  await next;
  expect(binding!.package().manifest.version).toBe("2.0.0");
  await a.capturePreview();
  expect(bound).toBe(1);
  await a.close();
  expect(closed).toBe(1);
});

test("authoring_expands_outcome_scenarios_without_changing_preview_selection", async () => {
  const capabilities = value(
    validateCapabilities({
      ...packageOptions.capabilities,
      sources: { outcome: { description: "Outcome", params: obj({}), result: sourceOutcome(str({ maxLength: 20 })) } },
    }),
  );
  const calls: string[] = [];
  const states: unknown[] = [];
  let binding!: PreviewBinding;
  const runner = inProcessRunner();
  const a = createAuthoring({
    catalog: packageOptions.catalog,
    capabilities,
    runner: {
      render(pkg, inputs, opts) {
        calls.push(JSON.stringify(inputs.data));
        states.push(inputs.state);
        return runner.render(pkg, inputs, opts);
      },
    },
    capture: fakeCapture().backend,
    preview: async (b) => {
      binding = b;
      return { url: "https://example.test", async close() {} };
    },
  });
  const input = {
    ...draft,
    files: {
      "entry.ts":
        'import { jsx, primitive } from "@arnilo/liveframe/sdk"; export default ({ data }) => jsx(primitive("text"), { text: data.result.status });',
    },
    entry: "entry.ts",
    manifest: { ...draft.manifest, sources: { result: { source: "outcome", params: {} } } },
    scenarios: [{ ...draft.scenarios[0]!, data: { result: { status: "ok", value: "ready" } } }],
  };
  // Each expanded source status is rendered by the same widget.
  value(await a.packDraft(input));
  await a.capturePreview();
  const initialState = input.manifest.initialState;
  if (typeof initialState !== "object" || initialState === null || Array.isArray(initialState))
    throw new Error("Expected object state");
  const before = value(
    await binding.session.render({
      scenario: input.scenarios[0]!.name,
      state: { ...initialState, selected: "preserved" },
    }),
  );
  calls.length = 0;
  const statuses = value(await a.renderScenarios({ outcomes: true }));
  expect(statuses).toEqual(
    ["ok", "unauthorized", "unavailable", "stale", "failed"].map((status) => ({
      scenario: `${input.scenarios[0]!.name}.${status}`,
      ok: true,
      nodes: 1,
    })),
  );
  expect(calls).toHaveLength(5);
  expect(calls.map((s) => JSON.parse(s).result.status)).toEqual([
    "ok",
    "unauthorized",
    "unavailable",
    "stale",
    "failed",
  ]);
  const after = value(await binding.session.intent({ type: "setState", key: "filter", value: "alerts" }));
  expect(after.revision).toBe(before.revision + 1);
  expect(states.at(-1)).toMatchObject({ selected: "preserved", filter: "alerts" });
  expect(binding.session.intents()).toEqual([]);
  expect(binding.package().scenarios).toEqual(input.scenarios);
  const ambiguous = {
    ...input,
    manifest: { ...input.manifest, sources: { ...input.manifest.sources, other: { source: "outcome", params: {} } } },
    scenarios: [
      { ...input.scenarios[0]!, data: { result: { status: "ok", value: "x" }, other: { status: "ok", value: "y" } } },
    ],
  };
  value(await a.packDraft(ambiguous));
  calls.length = 0;
  expect(await a.renderScenarios({ outcomes: true })).toMatchObject({
    ok: false,
    errors: [{ kind: "invalid-document", pointer: "/scenarios/0" }],
  });
  expect(calls).toHaveLength(0);
  value(
    await a.packDraft({
      ...input,
      scenarios: [
        input.scenarios[0]!,
        { ...input.scenarios[0]!, name: "invalid-seed", data: { result: { status: "failed" } } },
      ],
    }),
  );
  expect(await a.renderScenarios({ outcomes: true })).toMatchObject({
    ok: false,
    errors: [{ kind: "invalid-document", pointer: "/scenarios/1/source" }],
  });
  expect(calls).toHaveLength(0);
  await a.close();
});

test("authoring_without_mcp_sdk", () => {
  const result = Bun.spawnSync(
    [
      "bun",
      "--conditions",
      "liveframe:source",
      "--preload",
      "./src/__tests__/fixtures/no-mcp-sdk.ts",
      "--preload",
      "./src/__tests__/fixtures/no-playwright.ts",
      "--eval",
      'const { createAuthoring } = await import("@arnilo/liveframe/authoring"); if (typeof createAuthoring !== "function") throw Error("missing");',
    ],
    { timeout: 10000 },
  );
  expect(result.exitCode).toBe(0);
});

test("authoring_capture_retries_binding_and_maps_backend_errors", async () => {
  let attempts = 0;
  const a = createAuthoring({
    ...options(),
    preview: async () => {
      if (++attempts === 1) throw new Error("binding failed");
      return { url: "https://example.test", async close() {} };
    },
  });
  await a.packDraft(draft);
  expect(await a.capturePreview()).toMatchObject({
    ok: false,
    errors: [{ kind: "not-found", message: "binding failed" }],
  });
  expect(await a.capturePreview()).toMatchObject({
    ok: false,
    errors: [{ kind: "not-found", message: expect.stringContaining("No capture backend") }],
  });
  expect(attempts).toBe(2);
  await a.close();
  for (const [backend, kind] of [
    [
      fakeCapture({
        scenarios: ["ready"],
        widths: Array.from({ length: 13 }, (_, i) => 300 + i),
        themes: ["light"],
        designSystems: ["plain"],
      }).backend,
      "limit-exceeded",
    ],
    [
      {
        async open() {
          throw new Error("backend failed");
        },
      },
      "render-failed",
    ],
  ] as const) {
    const b = createAuthoring({
      ...options(),
      capture: backend,
      preview: async () => ({ url: "https://example.test", async close() {} }),
    });
    await b.packDraft(draft);
    expect(await b.capturePreview()).toMatchObject({ ok: false, errors: [{ kind }] });
    await b.close();
  }
  const b = createAuthoring({
    ...options(),
    capture: fakeCapture(undefined, null).backend,
    preview: async () => ({ url: "https://example.test", async close() {} }),
  });
  await b.packDraft(draft);
  expect(value(await b.capturePreview())[0]!.aria).toBeNull();
  await b.close();
});

test("authoring_hides_host_meta_unless_requested_and_bounds_trees", async () => {
  const capabilities = {
    ...packageOptions.capabilities,
    actions: Object.fromEntries(
      Object.entries(packageOptions.capabilities.actions).map(([name, entry]) => [
        name,
        { ...entry, meta: { secret: "host-only" } },
      ]),
    ),
  };
  for (const exposeMeta of [false, true]) {
    const a = createAuthoring({ ...options(), capabilities, exposeMeta });
    const declared = value(await a.listCapabilities());
    expect(Object.values(declared.actions)[0]!.meta).toEqual(exposeMeta ? { secret: "host-only" } : undefined);
    const packed = value(await a.packDraft({ ...draft, manifest: { ...draft.manifest, meta: { private: true } } }));
    expect(packed.meta).toEqual(exposeMeta ? { private: true } : undefined);
    await a.close();
  }
  const a = createAuthoring({
    ...options(),
    runner: {
      async render(_pkg, _inputs, opts) {
        return {
          ok: true,
          value: {
            format: "liveframe/1",
            catalogId: packageOptions.catalog.catalogId,
            surfaceId: opts.surfaceId,
            revision: opts.revision,
            root: { id: "root", kind: "text", props: { text: "😀".repeat(70000) } },
          },
        };
      },
    },
  });
  await a.packDraft(draft);
  expect(await a.renderScenarios({ scenario: draft.scenarios[0]!.name })).toMatchObject({
    ok: false,
    errors: [{ kind: "limit-exceeded", pointer: "/scenario" }],
  });
  await a.close();
});

test("authoring_results_match_mcp_json", async () => {
  const client = new Client({ name: "authoring-parity", version: "0" });
  const a = createAuthoring(options());
  await client.connect(
    new StdioClientTransport({
      command: "bun",
      args: ["--conditions", "liveframe:source", "src/cli/liveframe.ts", "mcp", "src/__tests__/fixtures/mcp.config.ts"],
      stderr: "pipe",
    }),
  );
  try {
    const pairs = [
      ["list_primitives", {}, await a.listPrimitives()],
      ["list_primitives", { kinds: ["missing"] }, await a.listPrimitives({ kinds: ["missing"] })],
      ["list_vocabulary", {}, await a.listVocabulary()],
      ["list_capabilities", {}, await a.listCapabilities()],
      ["generated_types", {}, await a.generatedTypes()],
      ["pack_draft", draft, await a.packDraft(draft)],
      ["render_scenarios", {}, await a.renderScenarios()],
    ] as const;
    for (const [name, arguments_, result] of pairs) {
      const tool = await client.callTool({ name, arguments: arguments_ });
      const block = tool.content[0];
      if (!block || block.type !== "text") throw new Error("Expected MCP text content");
      expect(tool.isError === true).toBe(!result.ok);
      expect(JSON.parse(block.text)).toEqual(result.ok ? result.value : result.errors);
    }
  } finally {
    await client.close();
    await a.close();
  }
});

test("capture_bound_defaults_to_twelve_and_raised_by_config", async () => {
  for (const maxCaptureCells of [undefined, 1, 16, 48]) {
    const widths = Array.from({ length: 49 }, (_, i) => 360 + i);
    const fake = fakeCapture({ scenarios: ["ready"], widths, themes: ["light"], designSystems: ["plain"] });
    const a = createAuthoring({
      ...options(),
      ...(maxCaptureCells === undefined ? {} : { maxCaptureCells }),
      capture: fake.backend,
      preview: async () => ({ url: "https://example.test", async close() {} }),
    });
    try {
      value(await a.packDraft(draft));
      const bound = maxCaptureCells ?? 12;
      const refused = await a.capturePreview({ widths: widths.slice(0, bound + 1) });
      expect(refused).toMatchObject({
        ok: false,
        errors: [{ kind: "limit-exceeded", message: expect.stringContaining(`maxCaptureCells: ${bound}`) }],
      });
      expect(fake.shots).toBe(0);
      const count = bound === 16 ? 13 : bound;
      expect(value(await a.capturePreview({ widths: widths.slice(0, count) }))).toHaveLength(count);
      expect(fake.shots).toBe(count);
    } finally {
      await a.close();
    }
  }
});

test("capture_bound_rejects_invalid_config", () => {
  for (const maxCaptureCells of [0, -1, 1.5, 49, NaN, Infinity, null, "16"]) {
    try {
      createAuthoring({ ...options(), maxCaptureCells } as never);
      throw new Error("Expected startup failure");
    } catch (error) {
      expect(error).toBeInstanceOf(LiveframeFailure);
      expect((error as LiveframeFailure).errors).toMatchObject([
        { kind: "invalid-document", pointer: "/maxCaptureCells" },
      ]);
    }
  }
});
