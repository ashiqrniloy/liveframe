import { expect, test } from "bun:test";
import {
  applyPatch,
  type Intent,
  type IntentOrigin,
  type Json,
  obj,
  type Result,
  str,
  type TreePatch,
  type UiNode,
  type UiTree,
  validateCapabilities,
  validateCatalog,
} from "@arnilo/liveframe";
import {
  dependents,
  type HostEvent,
  handleIntent,
  renderPlacement,
  type Served,
  type SourceCall,
  type SourceResult,
} from "@arnilo/liveframe/host";
import { canonicalJson, pack, type Scenario } from "@arnilo/liveframe/pack";
import { templateRunner } from "@arnilo/liveframe/preview";
import { memoryStore, verifiedPackages } from "@arnilo/liveframe/store";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const catalog = value(validateCatalog({ ...catalogDoc, catalogId: "acme.ui@1" }));
const capabilities = value(
  validateCapabilities({
    format: "liveframe-capabilities/1",
    actions: {
      "tasks.claim": {
        description: "Claim a task",
        args: obj({ id: str({ maxLength: 20 }) }),
        result: obj({ owner: str({ maxLength: 20 }) }),
      },
      "selection.select": {
        description: "Select a task",
        args: obj({ id: str({ maxLength: 20 }) }),
      },
    },
    sources: {
      "selection.current": {
        description: "Current selection",
        params: obj({}),
        result: str({ maxLength: 20 }),
      },
    },
  }),
);
const install = { catalog, capabilities };

const schema = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const tasksManifest = {
  format: "liveframe-manifest/1",
  id: "tasks",
  version: "1.0.0",
  catalogId: "acme.ui@1",
  params: schema({}),
  state: schema({ label: { type: "string", maxLength: 40 } }),
  context: schema({ locale: { type: "string", maxLength: 10 } }),
  initialState: { label: "first" },
  sources: {},
  actions: ["tasks.claim"],
};
const tasksTemplate = {
  format: "liveframe-template/1",
  root: {
    kind: "stack",
    children: [
      { key: "title", kind: "text", props: { text: { $path: "state.label" } } },
      {
        key: "claim",
        kind: "button",
        props: { label: "Claim" },
        events: { onPress: { type: "action", name: "tasks.claim", args: { id: "t1" } } },
      },
      {
        key: "field",
        kind: "textField",
        props: { label: "Label", value: { $path: "state.label" } },
        events: { onChange: { type: "setState", key: "label" } },
      },
    ],
  },
};

const listManifest = {
  format: "liveframe-manifest/1",
  id: "list",
  version: "1.0.0",
  catalogId: "acme.ui@1",
  params: schema({}),
  state: schema({}),
  context: schema({ locale: { type: "string", maxLength: 10 } }),
  initialState: {},
  sources: {},
  actions: ["selection.select"],
};
const listTemplate = {
  format: "liveframe-template/1",
  root: {
    kind: "stack",
    children: [
      {
        key: "select",
        kind: "button",
        props: { label: "Select" },
        events: { onPress: { type: "action", name: "selection.select", args: { id: "t2" } } },
      },
    ],
  },
};

const detailManifest = {
  format: "liveframe-manifest/1",
  id: "detail",
  version: "1.0.0",
  catalogId: "acme.ui@1",
  params: schema({}),
  state: schema({}),
  context: schema({ locale: { type: "string", maxLength: 10 } }),
  initialState: {},
  sources: { selected: { source: "selection.current", params: {} } },
  actions: [],
};
const detailTemplate = {
  format: "liveframe-template/1",
  root: { key: "selected", kind: "text", props: { text: { $path: "data.selected" } } },
};

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => (...values: unknown[]) => Promise<unknown>;
const transpiler = new Bun.Transpiler({ loader: "ts" });

/** Extract fenced `ts` blocks from `docs/host.md` and compile one against injected bindings. */
function compileBlock(block: string, params: readonly string[], tail = "") {
  const withoutImports = block.replace(/^import\s+[\s\S]*?from\s+["'][^"']+["'];\s*$/gm, "");
  const js = transpiler.transformSync(`${withoutImports}\n${tail}`);
  return new AsyncFunction(...params, js);
}

function nodeByKind(tree: UiTree, kind: string): UiNode {
  const walk = (node: UiNode): UiNode | undefined => {
    if (node.kind === kind) return node;
    for (const child of node.children ?? []) {
      const found = walk(child);
      if (found) return found;
    }
    return undefined;
  };
  const found = walk(tree.root);
  if (!found) throw new Error(`Missing ${kind}`);
  return found;
}

const isPatch = (payload: UiTree | TreePatch): payload is TreePatch => "ops" in payload;

test("guide_examples_send_nothing_for_a_skipped_render", async () => {
  const guide = await Bun.file(new URL("../../docs/host.md", import.meta.url)).text();
  const spec = await Bun.file(new URL("../../docs/spec.md", import.meta.url)).text();
  expect(guide).toContain("you get `previous` itself\n  back unchanged");
  expect(guide).toContain("send nothing for a skipped render");
  expect(spec).toContain(
    "the returned `previous` still carries the `patch` that produced it; a host sends nothing for a skipped render",
  );

  const blocks = [...guide.matchAll(/```ts\n([\s\S]*?)```/g)].map((match) => match[1] ?? "");
  expect(blocks).toHaveLength(5);
  const [renderBlock, resolveBlock, , intentBlock, coordinateBlock] = blocks as [
    string,
    string,
    string,
    string,
    string,
  ];

  const store = memoryStore();
  await store.putPackage(
    value(
      pack(
        {
          template: tasksTemplate,
          manifest: tasksManifest,
          scenarios: [{ name: "default", params: {}, state: { label: "first" }, context: { locale: "en" }, data: {} }],
        } as never,
        install,
      ),
    ),
  );
  await store.putPlacement({ id: "tasks", slot: "main", widget: { id: "tasks", version: "1.0.0" }, params: {} });

  let currentSelection = "t1";
  await store.putPackage(
    value(
      pack(
        {
          template: listTemplate,
          manifest: listManifest,
          scenarios: [
            {
              name: "default",
              params: {},
              state: {},
              context: { locale: "en" },
              data: {},
            } satisfies Scenario,
          ],
        } as never,
        install,
      ),
    ),
  );
  await store.putPlacement({ id: "list", slot: "list", widget: { id: "list", version: "1.0.0" }, params: {} });

  await store.putPackage(
    value(
      pack(
        {
          template: detailTemplate,
          manifest: detailManifest,
          scenarios: [
            {
              name: "default",
              params: {},
              state: {},
              context: { locale: "en" },
              data: { selected: "t1" },
            } satisfies Scenario,
          ],
        } as never,
        install,
      ),
    ),
  );
  await store.putPlacement({ id: "detail", slot: "detail", widget: { id: "detail", version: "1.0.0" }, params: {} });

  // 1. Run the guide's `resolve` block.
  const runResolve = compileBlock(resolveBlock, ["allowed", "read"], "return resolve;");
  const resolve = (await runResolve(
    () => true,
    async (source: string) => (source === "selection.current" ? currentSelection : ""),
  )) as (calls: readonly SourceCall[], viewer: string) => Promise<Record<string, SourceResult>>;

  // 2. Run the guide's `Wire it once` render example: initial -> patched -> skipped.
  const runner = templateRunner();
  const events: HostEvent[] = [];
  const servedByPlacement = new Map<string, Served>();
  const actionsByPlacement = new Map<string, Record<string, never>>();
  const sent: Array<{ target: unknown; payload: UiTree | TreePatch }> = [];
  const session = { userId: "alice", user: "alice" };

  const runRenderExample = compileBlock(renderBlock, [
    "renderPlacement",
    "store",
    "runner",
    "catalog",
    "capabilities",
    "resolve",
    "verifiedPackages",
    "log",
    "servedByPlacement",
    "session",
    "send",
    "client",
  ]);
  const callRenderExample = () =>
    runRenderExample(
      renderPlacement,
      store,
      runner,
      catalog,
      capabilities,
      resolve,
      verifiedPackages,
      (_type: string, event: HostEvent) => events.push(event),
      servedByPlacement,
      session,
      (target: unknown, payload: UiTree | TreePatch) => sent.push({ target, payload }),
      "client-1",
    );

  // First render sends the whole tree (revision 1).
  await callRenderExample();
  expect(sent).toHaveLength(1);
  expect(isPatch(sent[0]!.payload)).toBe(false);
  let clientTree = sent[0]!.payload as UiTree;
  expect(clientTree.revision).toBe(1);

  // Change state and render again: sends a patch (base 1 -> revision 2).
  await store.putState("tasks", session.userId, { label: "second" });
  await callRenderExample();
  expect(sent).toHaveLength(2);
  expect(isPatch(sent[1]!.payload)).toBe(true);
  const rev2Patch = sent[1]!.payload as TreePatch;
  expect(rev2Patch.base).toBe(1);
  expect(rev2Patch.revision).toBe(2);
  clientTree = value(applyPatch(clientTree, rev2Patch));
  expect(servedByPlacement.get("tasks")?.patch).toEqual(rev2Patch);

  // Render again unchanged: skipped render returns `previous`, and NOTHING is sent.
  await callRenderExample();
  expect(sent).toHaveLength(2);
  expect(events.at(-1)).toEqual({ type: "render-skipped", placementId: "tasks", revision: 2 });

  // 3. Run the guide's `Handle an intent` example.
  const host = {
    store,
    runner,
    installs: { "acme.ui@1": install },
    resolve,
    verified: verifiedPackages(),
    onEvent: (event: HostEvent) => events.push(event),
  };
  const runIntentExample = compileBlock(intentBlock, [
    "handleIntent",
    "host",
    "served",
    "origin",
    "intent",
    "session",
    "actionsByPlacement",
    "policy",
    "claim",
    "servedByPlacement",
    "send",
    "client",
  ]);

  // 3a. A `setState` that writes the already-current value skips the render; `publish` sends nothing.
  const servedBefore = servedByPlacement.get("tasks")!;
  const field = nodeByKind(servedBefore.tree, "textField");
  await runIntentExample(
    handleIntent,
    host,
    servedBefore,
    {
      surfaceId: servedBefore.tree.surfaceId,
      revision: servedBefore.revision,
      nodeId: field.id as string,
      event: "onChange",
    } satisfies IntentOrigin,
    { type: "setState", key: "label", value: "second" } satisfies Intent,
    session,
    actionsByPlacement,
    { allows: () => true },
    async () => ({ owner: session.user }),
    servedByPlacement,
    (target: unknown, payload: UiTree | TreePatch) => sent.push({ target, payload }),
    "client-1",
  );
  expect(sent).toHaveLength(2);

  // 3b. A real action sends `pending` (rev 3) and `ok` (rev 4), each patching cleanly.
  const claimButton = nodeByKind(servedBefore.tree, "button");
  await runIntentExample(
    handleIntent,
    host,
    servedBefore,
    {
      surfaceId: servedBefore.tree.surfaceId,
      revision: servedBefore.revision,
      nodeId: claimButton.id as string,
      event: "onPress",
    } satisfies IntentOrigin,
    claimButton.events!.onPress as Intent,
    session,
    actionsByPlacement,
    { allows: () => true },
    async () => ({ owner: session.user }),
    servedByPlacement,
    (target: unknown, payload: UiTree | TreePatch) => sent.push({ target, payload }),
    "client-1",
  );
  expect(sent).toHaveLength(4);
  for (const entry of sent.slice(2)) {
    expect(isPatch(entry.payload)).toBe(true);
    clientTree = value(applyPatch(clientTree, entry.payload as TreePatch));
  }
  expect(clientTree.revision).toBe(4);

  // 4. Run the guide's `Coordinate placements` example: changed dependent sends patch; skipped dependent sends nothing.
  for (const id of ["list", "detail"]) {
    servedByPlacement.set(
      id,
      value(
        await renderPlacement({
          ...host,
          placementId: id,
          catalogId: "acme.ui@1",
          viewer: "alice",
          context: { locale: "en" },
        }),
      ),
    );
  }
  const runCoordinateExample = compileBlock(coordinateBlock, [
    "dependents",
    "handleIntent",
    "renderPlacement",
    "host",
    "servedByPlacement",
    "catalogId",
    "viewer",
    "context",
    "send",
  ]);
  const callCoordinate = (listServed: Served, nextSelection: string) => {
    const selectButton = nodeByKind(listServed.tree, "button");
    const intentHost = {
      ...host,
      origin: {
        surfaceId: listServed.tree.surfaceId,
        revision: listServed.revision,
        nodeId: selectButton.id as string,
        event: "onPress",
      } satisfies IntentOrigin,
      intent: selectButton.events!.onPress as Intent,
      viewer: "alice",
      context: { locale: "en" },
      authorize: () => true,
      dispatch: async () => {
        currentSelection = nextSelection;
        return { ok: true };
      },
    };
    return runCoordinateExample(
      dependents,
      handleIntent,
      renderPlacement,
      intentHost,
      servedByPlacement,
      "acme.ui@1",
      "alice",
      { locale: "en" },
      (target: unknown, payload: UiTree | TreePatch) => sent.push({ target, payload }),
    );
  };

  // Selection changes from "t1" -> "t2": `detail` renders rev 2 and sends a patch (`base: 1`).
  const countBeforeCoord = sent.length;
  await callCoordinate(servedByPlacement.get("list")!, "t2");
  expect(sent.slice(countBeforeCoord).map((entry) => entry.target)).toEqual(["detail"]);
  expect(isPatch(sent.at(-1)!.payload)).toBe(true);
  expect((sent.at(-1)!.payload as TreePatch).base).toBe(1);
  expect(servedByPlacement.get("detail")?.patch?.base).toBe(1);

  // Selection stays "t2": `detail` skips and returns `previous` (still carrying its rev-2 patch), and NOTHING is sent.
  const countAfterFirstCoord = sent.length;
  await callCoordinate(servedByPlacement.get("list")!, "t2");
  expect(sent).toHaveLength(countAfterFirstCoord);
});

test("skipped_render_returns_previous_with_its_patch", async () => {
  const store = memoryStore();
  await store.putPackage(
    value(
      pack(
        {
          template: tasksTemplate,
          manifest: tasksManifest,
          scenarios: [{ name: "default", params: {}, state: { label: "first" }, context: { locale: "en" }, data: {} }],
        } as never,
        install,
      ),
    ),
  );
  await store.putPlacement({ id: "tasks", slot: "main", widget: { id: "tasks", version: "1.0.0" }, params: {} });

  const events: HostEvent[] = [];
  const args = {
    store,
    runner: templateRunner(),
    installs: { "acme.ui@1": install },
    resolve: async () => ({}),
    placementId: "tasks",
    catalogId: "acme.ui@1",
    viewer: "alice",
    context: { locale: "en" } satisfies Json,
    onEvent: (event: HostEvent) => events.push(event),
  };

  const first = value(await renderPlacement(args));
  expect(first.revision).toBe(1);
  expect(first.patch).toBeUndefined();

  const second = value(await renderPlacement({ ...args, state: { label: "second" }, previous: first }));
  expect(second.revision).toBe(2);
  expect(second.patch?.base).toBe(1);
  expect(second.patch?.revision).toBe(2);

  const third = value(await renderPlacement({ ...args, state: { label: "second" }, previous: second }));
  expect(third).toBe(second);
  expect(third.patch).toBe(second.patch);
  expect(third.patch?.base).toBe(1);
  expect(events).toEqual([{ type: "render-skipped", placementId: "tasks", revision: 2 }]);
});

test("guide_pending_example_answers_pending_then_rerenders_the_readers", async () => {
  const guide = await Bun.file(new URL("../../docs/host.md", import.meta.url)).text();
  const block = [...guide.matchAll(/```ts\n([\s\S]*?)```/g)].map((match) => match[1] ?? "")[2] ?? "";
  expect(block).toContain('reason: "pending"');
  let land: (value: Json) => void = () => undefined;
  const slowRead = () => new Promise<Json>((resolve) => (land = resolve));
  const servedByPlacement = new Map([
    ["digest", { placementId: "digest", bound: { digest: { source: "tasks.digest", params: {} } } }],
    ["other", { placementId: "other", bound: {} }],
  ]);
  const rerendered: string[] = [];
  let settled: () => void = () => undefined;
  const done = new Promise<void>((resolve) => (settled = resolve));
  const rerender = async (id: string) => {
    rerendered.push(id);
    settled();
  };
  const make = compileBlock(
    block,
    ["canonicalJson", "slowRead", "dependents", "servedByPlacement", "rerender"],
    "return resolve;",
  );
  const resolve = (await make(canonicalJson, slowRead, dependents, servedByPlacement, rerender)) as (
    calls: readonly SourceCall[],
    viewer: unknown,
  ) => Promise<Record<string, SourceResult>>;
  const calls = [{ alias: "digest", source: "tasks.digest", params: {} }];
  expect(await resolve(calls, "ada")).toEqual({ digest: { ok: false, reason: "pending" } });
  // A second render before the read lands does not start a second read.
  expect(await resolve(calls, "ada")).toEqual({ digest: { ok: false, reason: "pending" } });
  land({ summary: "9 of 12" });
  await done;
  expect(rerendered).toEqual(["digest"]);
  expect(await resolve(calls, "ada")).toEqual({
    digest: { ok: true, value: { status: "ok", value: { summary: "9 of 12" } } },
  });
});
