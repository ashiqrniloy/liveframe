import { expect, test } from "bun:test";
import {
  type Json,
  type LiveframeError,
  obj,
  type Result,
  sourceOutcome,
  str,
  validateCapabilities,
  validateCatalog,
} from "@arnilo/liveframe";
import { renderPlacement } from "@arnilo/liveframe/host";
import { pack, type Scenario } from "@arnilo/liveframe/pack";
import { inProcessRunner, type Runner, templateRunner } from "@arnilo/liveframe/preview";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import { memoryStore } from "@arnilo/liveframe/store";
import type { Template } from "@arnilo/liveframe/template";
import { quickjsRunner } from "../../packages/runner-quickjs/src/index.ts";
import type { HostEvent, Served, SourceResult } from "../host/index.ts";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const catalog = value(validateCatalog(catalogDoc));
const capabilities = value(
  validateCapabilities({
    format: "liveframe-capabilities/1",
    actions: {},
    sources: {
      "notes.read": { description: "A note", params: obj({}), result: str({ maxLength: 20 }) },
      "tasks.read": { description: "A task", params: obj({}), result: sourceOutcome(str({ maxLength: 20 })) },
      "rows.read": {
        description: "Rows",
        params: obj({}),
        result: sourceOutcome(str({ maxLength: 20 }), { pending: true }),
      },
    },
  }),
);
const install = { catalog, capabilities };
const installs = { "proof.ui@1": install };

const schema = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const manifest = (sources: Record<string, string>) => ({
  format: "liveframe-manifest/1",
  id: "notes",
  version: "1.0.0",
  catalogId: "proof.ui@1",
  params: { ...schema({ label: str({ maxLength: 40 }) }), required: [] },
  state: schema({ label: { type: "string", maxLength: 40 } }),
  context: schema({}),
  initialState: { label: "first" },
  sources: Object.fromEntries(Object.entries(sources).map(([alias, source]) => [alias, { source, params: {} }])),
  actions: [],
});
const template: Template = {
  format: "liveframe-template/1",
  root: { kind: "text", props: { text: { $path: "state.label" } } },
};

/** A store holding one placement of a template widget that declares the given sources. */
async function installed(sources: Record<string, string>, data: Record<string, Json>, doc: Template = template) {
  const scenario: Scenario = { name: "default", params: {}, state: { label: "first" }, context: {}, data };
  const pkg = value(pack({ template: doc, manifest: manifest(sources), scenarios: [scenario] }, install));
  const store = memoryStore();
  await store.putPackage(pkg);
  await store.putPlacement({ id: "p1", slot: "main", widget: { id: "notes", version: "1.0.0" }, params: {} });
  return store;
}

type Call = { data: unknown };
/** The real template runner, recording what each render received. */
function spyRunner(mutate?: (result: Result<unknown>) => Result<unknown>): Runner & { calls: Call[] } {
  const real = templateRunner();
  const calls: Call[] = [];
  return {
    calls,
    async render(pkg, inputs, options) {
      calls.push({ data: inputs.data });
      const result = await real.render(pkg, inputs, options);
      return (mutate ? mutate(result) : result) as never;
    },
  };
}

const ok = (data: Record<string, SourceResult>) => async () => data;
const base = (store: Awaited<ReturnType<typeof installed>>, runner: Runner, extra = {}) => ({
  store,
  runner,
  installs,
  resolve: ok({}),
  placementId: "p1",
  catalogId: "proof.ui@1",
  viewer: "alice",
  context: {},
  ...extra,
});
const served = (result: Result<Served>) => value(result);
const errorsOf = (result: Result<unknown>): readonly LiveframeError[] => {
  if (result.ok) throw new Error("Expected a failure");
  return result.errors;
};

test("skips_render_when_key_unchanged", async () => {
  const runner = spyRunner();
  const events: HostEvent[] = [];
  const args = base(await installed({}, {}), runner, { onEvent: (event: HostEvent) => events.push(event) });
  const first = served(await renderPlacement(args));
  expect(first.revision).toBe(1);
  const second = served(await renderPlacement({ ...args, previous: first }));
  expect(second).toBe(first);
  expect(runner.calls).toHaveLength(1);
  expect(events).toEqual([{ type: "render-skipped", placementId: "p1", revision: 1 }]);
});

test("host_applies_its_node_limit_before_invoking_the_runner", async () => {
  const doc: Template = { ...template, root: { kind: "stack", children: [template.root] } };
  const store = await installed({}, {}, doc);
  const runner = spyRunner();
  const result = await renderPlacement(base(store, runner, { runOptions: { limits: { nodes: 1 } } }));
  expect(errorsOf(result)[0]).toMatchObject({ kind: "limit-exceeded", pointer: "/template/root/children/0" });
  expect(runner.calls).toHaveLength(0);
});

test("no_skip_for_other_surface_or_scope", async () => {
  const runner = spyRunner();
  const args = base(await installed({}, {}), runner);
  const first = served(await renderPlacement(args));
  const otherScope = served(await renderPlacement({ ...args, scope: "bob", previous: first }));
  expect(otherScope).not.toBe(first);
  const otherSurface = served(await renderPlacement({ ...args, surfaceId: "elsewhere", previous: first }));
  expect(otherSurface.tree.surfaceId).toBe("elsewhere");
  expect(otherSurface.patch).toBeUndefined();
  expect(runner.calls).toHaveLength(3);
});

test("patch_when_previous_matches_whole_tree_otherwise", async () => {
  const args = base(await installed({}, {}), spyRunner());
  const first = served(await renderPlacement(args));
  expect(first.patch).toBeUndefined();
  const second = served(await renderPlacement({ ...args, state: { label: "second" }, previous: first }));
  expect(second.revision).toBe(2);
  expect(second.patch?.base).toBe(1);
  expect(second.state).toEqual({ label: "second" });
  const other = served(await renderPlacement({ ...args, surfaceId: "elsewhere", previous: second }));
  expect(other.patch).toBeUndefined();
});

test("resolver_failure_becomes_outcome_envelope", async () => {
  const runner = spyRunner();
  const events: HostEvent[] = [];
  const store = await installed({ task: "tasks.read" }, { task: { status: "ok", value: "x" } });
  const down = ok({ task: { ok: false, reason: "unavailable", message: "down" } });
  served(
    await renderPlacement(base(store, runner, { resolve: down, onEvent: (event: HostEvent) => events.push(event) })),
  );
  expect(runner.calls[0]?.data).toEqual({ task: { status: "unavailable", reason: "down" } });
  expect(events).toEqual([
    { type: "source-failed", placementId: "p1", alias: "task", source: "tasks.read", reason: "unavailable" },
  ]);
  const good = ok({ task: { ok: true, value: { status: "ok", value: "fine" } } });
  served(await renderPlacement(base(store, runner, { resolve: good })));
  expect(runner.calls[1]?.data).toEqual({ task: { status: "ok", value: "fine" } });
});

test("lone_surrogate_in_source_data_fails_that_source_only", async () => {
  const runner = spyRunner();
  const events: HostEvent[] = [];
  const store = await installed(
    { task: "tasks.read", row: "rows.read", note: "notes.read" },
    { task: { status: "ok", value: "x" }, row: { status: "ok", value: "x" }, note: "x" },
  );
  const onEvent = (event: HostEvent) => events.push(event);
  const resolve = ok({
    task: { ok: true, value: { status: "ok", value: "\ud800" } },
    row: { ok: true, value: { status: "ok", value: "\udfff" } },
    note: { ok: true, value: "😀" },
  });
  const args = base(store, runner, { resolve, onEvent });
  const rendered = served(await renderPlacement(args));
  expect(runner.calls).toEqual([{ data: { task: { status: "failed" }, row: { status: "failed" }, note: "😀" } }]);
  expect(events).toEqual([
    { type: "source-failed", placementId: "p1", alias: "task", source: "tasks.read", reason: "invalid-result" },
    { type: "source-failed", placementId: "p1", alias: "row", source: "rows.read", reason: "invalid-result" },
  ]);
  expect(served(await renderPlacement({ ...args, previous: rendered }))).toBe(rendered);

  const plain = await installed({ note: "notes.read" }, { note: "x" });
  const plainArgs = base(plain, runner, { resolve: ok({ note: { ok: true, value: "\ud800" } }) });
  expect(errorsOf(await renderPlacement(plainArgs))).toMatchObject([{ kind: "render-failed", pointer: "/data/note" }]);

  await plain.putPlacement({
    id: "p1",
    slot: "main",
    widget: { id: "notes", version: "1.0.0" },
    params: { label: "\ud800" },
  });
  expect(errorsOf(await renderPlacement(plainArgs))).toMatchObject([{ kind: "render-failed", pointer: "/params" }]);

  expect(errorsOf(await renderPlacement({ ...args, state: { label: "\ud800" } }))).toMatchObject([
    { kind: "render-failed", pointer: "/state" },
  ]);
  expect(errorsOf(await renderPlacement({ ...args, context: { label: "\ud800" } }))).toMatchObject([
    { kind: "render-failed", pointer: "/context" },
  ]);
  expect(runner.calls).toHaveLength(1);
});

test("resolver_throw_without_envelope_render_failed_no_leak", async () => {
  const events: HostEvent[] = [];
  const store = await installed({ note: "notes.read" }, { note: "x" });
  const resolve = async () => {
    throw new Error("password=hunter2 at db.internal");
  };
  const result = await renderPlacement(
    base(store, spyRunner(), { resolve, onEvent: (event: HostEvent) => events.push(event) }),
  );
  expect(errorsOf(result)).toContainEqual(expect.objectContaining({ kind: "render-failed", pointer: "/data/note" }));
  expect(JSON.stringify([result, events])).not.toContain("hunter2");
  expect(events.map((event) => event.type)).toEqual(["source-failed", "render-failed"]);
});

test("resolver_result_failing_schema_rejected", async () => {
  const events: HostEvent[] = [];
  const store = await installed({ note: "notes.read" }, { note: "x" });
  const resolve = ok({ note: { ok: true, value: "x".repeat(21) } });
  const runner = spyRunner();
  const result = await renderPlacement(
    base(store, runner, { resolve, onEvent: (event: HostEvent) => events.push(event) }),
  );
  expect(errorsOf(result)[0]?.pointer).toBe("/data/note");
  expect(runner.calls).toHaveLength(0);
  expect(events[0]).toEqual({
    type: "source-failed",
    placementId: "p1",
    alias: "note",
    source: "notes.read",
    reason: "invalid-result",
  });
  // A failure with no envelope in the schema is never faked into a value either.
  const broken = ok({ note: { ok: false, reason: "failed" } });
  expect(errorsOf(await renderPlacement(base(store, runner, { resolve: broken })))[0]?.pointer).toBe("/data/note");
});

test("runner_tree_validated_on_host", async () => {
  const store = await installed({}, {});
  const hostile = spyRunner((result) => {
    const tree = value(result as Result<{ root: object }>);
    return { ok: true, value: { ...tree, root: { ...tree.root, kind: "javascript" } } };
  });
  const events: HostEvent[] = [];
  const result = await renderPlacement(base(store, hostile, { onEvent: (event: HostEvent) => events.push(event) }));
  expect(result.ok).toBe(false);
  expect(events.map((event) => event.type)).toEqual(["tree-rejected"]);
});

test("runner_tree_wrong_revision_rejected", async () => {
  const store = await installed({}, {});
  const stale = spyRunner((result) => ({ ok: true, value: { ...(value(result) as object), revision: 99 } }));
  const result = await renderPlacement(base(store, stale));
  expect(errorsOf(result)).toContainEqual(expect.objectContaining({ kind: "invalid-document", pointer: "/revision" }));
  const moved = spyRunner((result) => ({ ok: true, value: { ...(value(result) as object), surfaceId: "elsewhere" } }));
  expect(errorsOf(await renderPlacement(base(store, moved)))).toContainEqual(
    expect.objectContaining({ pointer: "/surfaceId" }),
  );
});

test("unknown_catalog_id_catalog_mismatch", async () => {
  const store = await installed({}, {});
  const result = await renderPlacement(base(store, spyRunner(), { catalogId: "other.ui@1" }));
  expect(errorsOf(result)).toEqual([expect.objectContaining({ kind: "catalog-mismatch", pointer: "/catalogId" })]);
});

test("revision_floor_used_without_previous", async () => {
  const store = await installed({}, {});
  const floor = served(await renderPlacement(base(store, spyRunner(), { revision: 41 })));
  expect(floor.revision).toBe(41);
  expect(floor.tree.revision).toBe(41);
  const next = served(await renderPlacement(base(store, spyRunner(), { state: { label: "b" }, previous: floor })));
  expect(next.revision).toBe(42);
});

test("revision_floor_below_previous_still_advances", async () => {
  const store = await installed({}, {});
  const previous = served(await renderPlacement(base(store, spyRunner(), { revision: 8 })));
  expect(previous.revision).toBe(8);
  const next = served(
    await renderPlacement(base(store, spyRunner(), { state: { label: "b" }, previous, revision: 5 })),
  );
  expect(next.revision).toBe(9);
  expect(next.tree.revision).toBe(9);
  expect(next.patch?.base).toBe(8);
  const equal = served(
    await renderPlacement(base(store, spyRunner(), { state: { label: "c" }, previous: next, revision: 9 })),
  );
  expect(equal.revision).toBe(10);
  expect(equal.patch?.base).toBe(9);
});

test("revision_floor_above_previous_is_used", async () => {
  const store = await installed({}, {});
  const previous = served(await renderPlacement(base(store, spyRunner(), { revision: 8 })));
  const next = served(
    await renderPlacement(base(store, spyRunner(), { state: { label: "b" }, previous, revision: 41 })),
  );
  expect(next.revision).toBe(41);
  expect(next.tree.revision).toBe(41);
  expect(next.patch?.base).toBe(8);
});

test("thrown_widget_text_never_reaches_a_host_event", async () => {
  const secret = "private-state-marker";
  const pkg = value(
    pack(
      {
        files: { "entry.ts": "export default (inputs) => { throw new Error(JSON.stringify(inputs)); };" },
        entry: "entry.ts",
        manifest: manifest({}),
        scenarios: [{ name: "default", params: {}, context: {}, data: {} }],
      },
      install,
    ),
  );
  const store = memoryStore();
  await store.putPackage(pkg);
  await store.putPlacement({ id: "p1", slot: "main", widget: { id: "notes", version: "1.0.0" }, params: {} });

  for (const open of [inProcessRunner, workerRunner, quickjsRunner]) {
    const runner = await open();
    try {
      const events: HostEvent[] = [];
      const args = base(store, runner, {
        state: { label: secret },
        runOptions: { timeoutMs: 5000 },
        onEvent: (event: HostEvent) => events.push(event),
      });
      const result = await renderPlacement(args);
      expect(errorsOf(result)[0]).toMatchObject({ kind: "render-failed", pointer: "", message: "Widget threw Error" });
      expect(events).toEqual([{ type: "render-failed", placementId: "p1", errors: errorsOf(result) }]);
      expect(JSON.stringify([result, events])).not.toContain(secret);
      expect(JSON.stringify([result, events])).not.toContain('"debug"');
      events.length = 0;
      const debug = await renderPlacement({ ...args, runOptions: { timeoutMs: 5000, debug: true } });
      expect(errorsOf(debug)[0]?.debug).toContain(secret);
      expect(events).toEqual([{ type: "render-failed", placementId: "p1", errors: errorsOf(debug) }]);
    } finally {
      if ("close" in runner) runner.close();
    }
  }

  const events: HostEvent[] = [];
  const refused = await renderPlacement(
    base(store, templateRunner(), {
      state: { label: secret },
      onEvent: (event: HostEvent) => events.push(event),
    }),
  );
  expect(errorsOf(refused)[0]).toMatchObject({ kind: "invalid-document", pointer: "/code" });
  expect(events.map((event) => event.type)).toEqual(["render-failed"]);
  expect(JSON.stringify([refused, events])).not.toContain(secret);
});

test("render_placement_drops_unrequested_runner_debug", async () => {
  const store = await installed({}, {});
  const events: HostEvent[] = [];
  const error: LiveframeError = {
    kind: "render-failed",
    pointer: "",
    message: "Runner failed",
    get debug(): string {
      throw new TypeError("private-debug");
    },
  };
  const runner = spyRunner(() => ({ ok: false, errors: [error] }));
  const result = await renderPlacement(base(store, runner, { onEvent: (event: HostEvent) => events.push(event) }));
  expect(events).toEqual([{ type: "render-failed", placementId: "p1", errors: errorsOf(result) }]);
  expect(errorsOf(result)).toEqual([{ kind: "render-failed", pointer: "", message: "Runner failed" }]);
});

test("events_carry_no_values", async () => {
  const events: HostEvent[] = [];
  const store = await installed(
    { note: "notes.read", task: "tasks.read" },
    { note: "x", task: { status: "ok", value: "x" } },
  );
  const resolve = ok({
    note: { ok: true, value: "SECRET-DATA" },
    task: { ok: false, reason: "stale", message: "SECRET-REASON" },
  });
  const args = base(store, spyRunner(), {
    resolve,
    viewer: "SECRET-VIEWER",
    state: { label: "SECRET-STATE" },
    onEvent: (event: HostEvent) => events.push(event),
  });
  const first = served(await renderPlacement(args));
  served(await renderPlacement({ ...args, previous: first }));
  // Sources resolve before the skip decision (R4–R6), so the failure is reported on each call.
  expect(events.map((event) => event.type)).toEqual(["source-failed", "source-failed", "render-skipped"]);
  expect(JSON.stringify(events)).not.toContain("SECRET");
  expect(events.every(Object.isFrozen)).toBe(true);
});

test("throwing_on_event_contained", async () => {
  const store = await installed({}, {});
  const calls: string[] = [];
  const throwing = (event: HostEvent) => {
    calls.push(event.type);
    throw new Error("logger down");
  };
  const first = served(await renderPlacement(base(store, spyRunner(), { onEvent: throwing })));
  served(
    await renderPlacement(
      base(store, spyRunner(), { previous: first, onEvent: async () => Promise.reject(new Error("x")) }),
    ),
  );
  const missing = await renderPlacement(base(store, spyRunner(), { placementId: "none", onEvent: throwing }));
  expect(missing.ok).toBe(false);
  expect(calls).toEqual(["load-failed"]);
});

test("validator_reused_only_for_the_same_install", async () => {
  const args = base(await installed({}, {}), spyRunner());
  const first = served(await renderPlacement(args));
  const same = served(await renderPlacement({ ...args, state: { label: "b" }, previous: first }));
  expect(same.validator).toBe(first.validator);
  // An equal but distinct install document is not trusted to have compiled the same validator.
  const other = { "proof.ui@1": { ...install } };
  const fresh = served(await renderPlacement({ ...args, installs: other, state: { label: "c" }, previous: same }));
  expect(fresh.validator).not.toBe(first.validator);
});

test("migrated_state_is_served_and_reported_without_values", async () => {
  const upgraded = { ...manifest({}), migrateState: { label: { $path: "previous.title" } } };
  const scenario: Scenario = { name: "default", params: {}, state: { label: "first" }, context: {}, data: {} };
  const pkg = value(pack({ template, manifest: upgraded, scenarios: [scenario] } as never, install));
  const store = memoryStore();
  await store.putPackage(pkg);
  await store.putPlacement({ id: "p1", slot: "main", widget: { id: "notes", version: "1.0.0" }, params: {} });
  const events: HostEvent[] = [];
  const out = served(
    await renderPlacement(
      base(store, spyRunner(), { state: { title: "secret" }, onEvent: (e: HostEvent) => events.push(e) }),
    ),
  );
  expect(out.state).toEqual({ label: "secret" });
  expect(out.migrated?.length).toBeGreaterThan(0);
  expect(out.reset).toBeUndefined();
  expect(events.map((e) => e.type)).toEqual(["state-migrated"]);
  expect(JSON.stringify(events)).not.toContain("secret");
});

test("render_placement_forwards_run_options_limits_to_host_validation", async () => {
  const store = await installed({}, {});
  const largeRunner = spyRunner((result) => {
    const tree = value(result as Result<{ root: object }>);
    const children = Array.from({ length: 5_000 }, (_, index) => ({ ...tree.root, id: `root/${index}` }));
    return { ok: true, value: { ...tree, root: { id: "root", kind: "box", props: {}, children } } };
  });
  const rejected = await renderPlacement(base(store, largeRunner));
  expect(errorsOf(rejected)[0]?.kind).toBe("limit-exceeded");

  const accepted = served(
    await renderPlacement(base(store, largeRunner, { runOptions: { limits: { nodes: 6_000 } } })),
  );
  expect(accepted.tree.root.children?.length).toBe(5_000);
});

test("pending_answer_becomes_the_envelope_when_declared", async () => {
  const runner = spyRunner();
  const events: HostEvent[] = [];
  const store = await installed({ rows: "rows.read" }, { rows: { status: "ok", value: "x" } });
  const resolve = ok({ rows: { ok: false, reason: "pending" } });
  served(await renderPlacement(base(store, runner, { resolve, onEvent: (event: HostEvent) => events.push(event) })));
  expect(runner.calls[0]?.data).toEqual({ rows: { status: "pending" } });
  expect(events).toEqual([{ type: "source-pending", placementId: "p1", alias: "rows", source: "rows.read" }]);
});

test("pending_answer_fails_the_render_when_not_declared", async () => {
  const events: HostEvent[] = [];
  const runner = spyRunner();
  for (const [alias, source] of [
    ["task", "tasks.read"],
    ["note", "notes.read"],
  ] as const) {
    events.length = 0;
    const store = await installed(
      { [alias]: source },
      { [alias]: source === "notes.read" ? "x" : { status: "ok", value: "x" } },
    );
    const resolve = ok({ [alias]: { ok: false, reason: "pending" } });
    const result = await renderPlacement(
      base(store, runner, { resolve, onEvent: (event: HostEvent) => events.push(event) }),
    );
    expect(errorsOf(result)).toContainEqual(
      expect.objectContaining({ kind: "render-failed", pointer: `/data/${alias}` }),
    );
    expect(events.map((event) => event.type)).toEqual(["source-pending", "render-failed"]);
  }
  expect(runner.calls).toHaveLength(0);
});

test("pending_answer_raises_source_pending_not_source_failed", async () => {
  const events: HostEvent[] = [];
  const store = await installed({ rows: "rows.read" }, { rows: { status: "ok", value: "x" } });
  const resolve = ok({ rows: { ok: false, reason: "pending", message: "SECRET-QUEUE-DEPTH" } as never });
  const runner = spyRunner();
  served(await renderPlacement(base(store, runner, { resolve, onEvent: (event: HostEvent) => events.push(event) })));
  expect(events.map((event) => event.type)).toEqual(["source-pending"]);
  expect(JSON.stringify([events, runner.calls])).not.toContain("SECRET");
});

test("pending_answer_with_a_value_is_treated_as_failed", async () => {
  const events: HostEvent[] = [];
  const runner = spyRunner();
  const store = await installed({ rows: "rows.read" }, { rows: { status: "ok", value: "x" } });
  const resolve = ok({ rows: { ok: false, reason: "pending", value: "SMUGGLED" } as never });
  served(await renderPlacement(base(store, runner, { resolve, onEvent: (event: HostEvent) => events.push(event) })));
  expect(runner.calls[0]?.data).toEqual({ rows: { status: "failed" } });
  expect(events).toEqual([
    { type: "source-failed", placementId: "p1", alias: "rows", source: "rows.read", reason: "failed" },
  ]);
});

test("pending_then_resolved_is_not_skipped", async () => {
  const runner = spyRunner();
  const store = await installed({ rows: "rows.read" }, { rows: { status: "ok", value: "x" } });
  const first = served(
    await renderPlacement(base(store, runner, { resolve: ok({ rows: { ok: false, reason: "pending" } }) })),
  );
  const resolved = ok({ rows: { ok: true, value: { status: "ok", value: "ready" } } });
  const second = served(await renderPlacement(base(store, runner, { resolve: resolved, previous: first })));
  expect(second).not.toBe(first);
  expect(second.key).not.toBe(first.key);
  expect(second.revision).toBe(2);
  expect(second.patch?.base).toBe(1);
  expect(runner.calls.map((call) => call.data)).toEqual([
    { rows: { status: "pending" } },
    { rows: { status: "ok", value: "ready" } },
  ]);
});
