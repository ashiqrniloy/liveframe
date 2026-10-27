import { expect, test } from "bun:test";
import {
  arr,
  type Intent,
  obj,
  type Result,
  sourceOutcome,
  type UiTree,
  validateCapabilities,
} from "@arnilo/liveframe";
import { outcomeScenarios, pack } from "@arnilo/liveframe/pack";
import { createPreview, inProcessRunner, type Runner } from "@arnilo/liveframe/preview";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import type { WidgetProps } from "@arnilo/liveframe/sdk";
import { loadPlacement, memoryStore } from "@arnilo/liveframe/store";
import * as numeric from "./fixtures/numeric-events.ts";
import * as form from "./fixtures/object-events.ts";
import { drafts, packageOptions, value } from "./fixtures/widgets/drafts.ts";

test("preview_intent_rejects_out_of_range_number", async () => {
  const session = createPreview({
    catalog: numeric.catalog,
    capabilities: {
      ...packageOptions.capabilities,
      actions: { ...packageOptions.capabilities.actions, ...numeric.capabilities.actions },
    },
    runner: inProcessRunner(),
  });
  value(
    session.update({
      ...draft,
      manifest: { ...base.manifest, actions: [...base.manifest.actions, "numbers.commit", "integers.commit"] },
    }),
  );
  value(await session.render({ scenario: "first" }));
  for (const name of ["numbers.commit", "integers.commit"]) {
    for (const invalid of [0, 11, NaN, Infinity, -Infinity, ...(name === "integers.commit" ? [1.5] : [])]) {
      rejects(await session.intent({ type: "action", name, args: { value: invalid } }), "invalid-prop", "/args/value");
      expect(session.intents()).toEqual([]);
    }
  }
  for (const value of [1, 1.5, 10])
    expect((await session.intent({ type: "action", name: "numbers.commit", args: { value } })).ok).toBe(true);
  expect(session.intents()).toHaveLength(3);
});

const harness = drafts[4];
if (!harness) throw new Error("Missing harness draft");
const base = value(pack(harness, packageOptions));
const draft = {
  ...harness,
  scenarios: [
    { name: "first", params: {}, context: { size: "small" }, data: { items: [] } },
    {
      name: "second",
      params: {},
      context: { size: "large" },
      state: { selected: "second", query: "scenario" },
      data: { items: [] },
    },
  ],
};

test("preview_rechecks_bind_all_args", async () => {
  const session = createPreview({
    catalog: form.catalog,
    capabilities: {
      ...packageOptions.capabilities,
      actions: { ...packageOptions.capabilities.actions, ...form.capabilities.actions },
    },
    runner: inProcessRunner(),
  });
  value(
    session.update({ ...draft, manifest: { ...base.manifest, actions: [...base.manifest.actions, "form.submit"] } }),
  );
  value(await session.render({ scenario: "first" }));
  for (const reason of ["", "x".repeat(101)]) {
    rejects(
      await session.intent({ type: "action", name: "form.submit", args: { id: "row", reason, confirm: true } }),
      "invalid-prop",
      "/args/reason",
    );
    expect(session.intents()).toEqual([]);
  }
  rejects(
    await session.intent({ type: "action", name: "form.submit", args: { id: "row" }, bindAll: true }),
    "invalid-prop",
  );
  value(
    await session.intent({ type: "action", name: "form.submit", args: { id: "row", reason: "valid", confirm: true } }),
  );
  expect(session.intents()).toHaveLength(1);
});

function rejects(result: Result<unknown>, kind: string, pointer?: string) {
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(result.errors).toContainEqual(expect.objectContaining({ kind, ...(pointer ? { pointer } : {}) }));
}

function setup() {
  const calls: { inputs: WidgetProps; revision: number; surfaceId: string }[] = [];
  const delegate = inProcessRunner();
  const runner: Runner = {
    render(pkg, inputs, options) {
      calls.push({ inputs, revision: options.revision, surfaceId: options.surfaceId });
      return delegate.render(pkg, inputs, options);
    },
  };
  const session = createPreview({ ...packageOptions, runner });
  return { session, calls, runner };
}

test("empty_session_and_unknown_scenario_return_not_found", async () => {
  const { session } = setup();
  rejects(await session.render({ scenario: "first" }), "not-found");
  rejects(await session.intent({ type: "setState", key: "query", value: "x" }), "not-found");
  expect(session.intents()).toEqual([]);
  rejects(await session.check(), "not-found");
  value(session.update(draft));
  rejects(await session.render({ scenario: "absent" }), "not-found", "/scenario");
  rejects(await session.intent({ type: "action", name: "tasks.claim", args: { id: "x" } }), "not-found");
});

test("update_returns_the_packed_package_or_pack_errors", async () => {
  const { session, calls } = setup();
  expect(session.update(draft)).toEqual(pack(draft, packageOptions));
  await session.render({ scenario: "second" });
  await session.intent({ type: "setState", key: "query", value: "kept" });
  const action: Intent = { type: "action", name: "tasks.claim", args: { id: "x" } };
  await session.intent(action);
  for (const change of [
    { files: { "entry.ts": 'import "node:fs"; export default () => null;' } },
    { files: { "entry.ts": "export default (<" } },
    { scenarios: [] },
  ]) {
    const invalid = { ...draft, ...change };
    expect(session.update(invalid)).toEqual(pack(invalid, packageOptions));
    expect(session.update(invalid).ok).toBe(false);
    value(await session.intent({ type: "setState", key: "selected", value: "kept" }));
    expect(calls.at(-1)?.inputs.state).toEqual({ selected: "kept", query: "kept" });
    expect(session.intents()).toEqual([action]);
  }
  value(session.update(draft));
  expect(session.intents()).toEqual([]);
  rejects(await session.intent(action), "not-found");
  value(await session.render({ scenario: "first" }));
  expect(calls.at(-1)?.inputs.state).toEqual(base.manifest.initialState);
});

test("render_selects_scenario_state_and_increments_revision", async () => {
  const { session, calls } = setup();
  value(session.update(draft));
  value(await session.render({ scenario: "first" }));
  value(await session.render({ scenario: "second" }));
  const override = { selected: "explicit", query: "override" };
  value(await session.render({ scenario: "second", state: override, context: { size: "medium" } }));
  expect(calls.map((call) => call.inputs.state)).toEqual([
    base.manifest.initialState,
    draft.scenarios[1]?.state,
    override,
  ]);
  expect(calls.at(-1)?.inputs.context).toEqual({ size: "medium" });
  expect(calls.map((call) => call.revision)).toEqual([1, 2, 3]);
  expect(new Set(calls.map((call) => call.surfaceId)).size).toBe(1);
  rejects(await session.render({ scenario: "absent" }), "not-found", "/scenario");
  value(await session.intent({ type: "setState", key: "query", value: "next" }));
  expect(calls.at(-1)?.inputs.context).toEqual({ size: "medium" });
  expect(calls.at(-1)?.inputs.state).toEqual({ ...override, query: "next" });
  value(session.update(draft));
  value(await session.render({ scenario: "first" }));
  expect(calls.at(-1)?.revision).toBe(5);
  const other = setup();
  value(other.session.update(draft));
  value(await other.session.render({ scenario: "first" }));
  expect(other.calls[0]?.surfaceId).not.toBe(calls[0]?.surfaceId);
});

test("set_state_rerenders_and_invalid_intents_change_nothing", async () => {
  const { session, calls } = setup();
  value(session.update(draft));
  const before = value(await session.render({ scenario: "first" }));
  const after = value(await session.intent({ type: "setState", key: "query", value: "changed" }));
  expect(after.root).not.toEqual(before.root);
  expect(after.revision).toBe(before.revision + 1);
  const invalid: Intent[] = [
    { type: "setState", key: "missing", value: "x" },
    { type: "setState", key: "__proto__", value: "x" },
    { type: "setState", key: "query", value: 1 },
    { type: "setState", key: "query", value: "x".repeat(101) },
    { type: "setState", key: "query" },
    { type: "action", name: "tasks.claim", args: { id: 1 } },
    { type: "action", name: "tasks.claim", args: { id: "" } },
    { type: "action", name: "tasks.claim", args: { id: "x", extra: true } },
  ];
  for (const intent of invalid) rejects(await session.intent(intent), "invalid-prop");
  for (const name of ["missing", "queue.about", "toString"])
    rejects(await session.intent({ type: "action", name, args: {} }), "undeclared-action");
  expect(calls).toHaveLength(2);
  expect(session.intents()).toEqual([]);
  const action: Intent = { type: "action", name: "tasks.claim", args: { id: "x" } };
  expect(value(await session.intent(action))).toBe(after);
  expect(session.intents()).toEqual([action]);
  expect(calls).toHaveLength(2);
  const snapshot = session.intents();
  await session.intent(action);
  expect(snapshot).toEqual([action]);
  expect(session.intents()).toEqual([action, action]);
});

test("check_renders_every_scenario_without_changing_current_state", async () => {
  const { session, calls } = setup();
  value(session.update(draft));
  value(await session.render({ scenario: "second", context: { size: "full" } }));
  const current = value(await session.intent({ type: "setState", key: "query", value: "kept" }));
  const checked = value(await session.check());
  expect(checked.map((entry) => entry.scenario)).toEqual(["first", "second"]);
  for (const entry of checked) value(entry.result);
  expect(calls.slice(2).map((call) => call.inputs.state)).toEqual([
    base.manifest.initialState,
    draft.scenarios[1]?.state,
  ]);
  expect(value(await session.intent({ type: "action", name: "tasks.claim", args: { id: "x" } }))).toBe(current);
  value(await session.intent({ type: "setState", key: "selected", value: "next" }));
  expect(calls.at(-1)?.inputs.state).toEqual({ selected: "next", query: "kept" });
  expect(calls.at(-1)?.inputs.context).toEqual({ size: "full" });
});

test("preview_checks_generated_outcomes", async () => {
  const capabilities = value(
    validateCapabilities({
      ...packageOptions.capabilities,
      sources: {
        ...packageOptions.capabilities.sources,
        "queue.items": { description: "Items", params: obj({}), result: sourceOutcome(arr(obj({}), { maxItems: 10 })) },
      },
    }),
  );
  const manifest = { ...base.manifest, sources: { items: { source: "queue.items", params: {} } } };
  const scenarios = value(
    outcomeScenarios(
      {
        ...draft.scenarios[0]!,
        data: { items: { status: "ok", value: [] } },
      },
      { source: "items", manifest, capabilities },
    ),
  );
  const session = createPreview({ ...packageOptions, capabilities, runner: inProcessRunner() });
  value(
    session.update({
      ...draft,
      manifest,
      scenarios,
      files: {
        "entry.ts":
          'import { primitive } from "@arnilo/liveframe/sdk"; import { jsx } from "@arnilo/liveframe/sdk/jsx-runtime"; const Text = primitive("text"); export default ({data}) => jsx(Text, {text: data.items.status});',
      },
    }),
  );
  const checked = value(await session.check());
  expect(checked.map((entry) => entry.scenario)).toEqual(scenarios.map((entry) => entry.name));
  for (const entry of checked) {
    expect(value(entry.result).root.props.text).toBe(entry.scenario.slice("first.".length));
  }
});

test("every_proof_scenario_passes_check", async () => {
  const worker = workerRunner();
  try {
    for (const runner of [inProcessRunner(), worker])
      for (const input of drafts) {
        const session = createPreview({ ...packageOptions, runner });
        const pkg = value(session.update(input));
        const results = value(await session.check());
        expect(results.map((entry) => entry.scenario)).toEqual(pkg.scenarios.map((scenario) => scenario.name));
        for (const entry of results) value(entry.result);
      }
  } finally {
    worker.close();
  }
});

test("published_package_matches_the_last_preview", async () => {
  const { session, calls, runner } = setup();
  const pkg = value(session.update(draft));
  const preview = value(await session.render({ scenario: "second" }));
  const store = memoryStore();
  await store.putPackage(pkg);
  await store.putPlacement({
    id: "preview",
    slot: "main",
    widget: { id: pkg.manifest.id, version: pkg.manifest.version },
    params: {},
  });
  await store.putState("preview", "", { selected: "second", query: "scenario" });
  const loaded = value(await loadPlacement(store, "preview", packageOptions));
  expect(loaded.package.hash).toBe(pkg.hash);
  const call = calls[0];
  if (!call) throw new Error("Missing preview render");
  expect(
    value(
      await runner.render(
        loaded.package,
        { ...call.inputs, params: loaded.params, state: loaded.state },
        { ...packageOptions, surfaceId: call.surfaceId, revision: call.revision },
      ),
    ),
  ).toEqual(preview);
});

test("scenario_data_is_the_packages_own_and_frozen_by_the_sdk", async () => {
  const { session, calls } = setup();
  const pkg = value(session.update(draft));
  value(await session.render({ scenario: "first" }));
  value(await session.intent({ type: "setState", key: "query", value: "next" }));
  value(await session.check());
  const data = calls.map((call) => call.inputs.data);
  const own = pkg.scenarios.map((scenario) => scenario.data);
  expect(data.every((entry) => own.includes(entry as never))).toBe(true);
  expect(Object.isFrozen((data[0] as { items: unknown }).items)).toBe(true);
  const mutating = {
    ...draft,
    files: { ...draft.files, "entry.ts": "export default ({data}) => { data.items.push({}); return null; };" },
  };
  value(session.update(mutating));
  rejects(await session.render({ scenario: "first" }), "render-failed");
  rejects(await session.render({ scenario: "first" }), "render-failed");
  expect(draft.scenarios[0]?.data).toEqual({ items: [] });
});

test("runner_errors_pass_through_including_node_ids", async () => {
  const failure: Result<UiTree> = {
    ok: false,
    errors: [{ kind: "invalid-prop", pointer: "/root/props/text", nodeId: "root", message: "bad text" }],
  };
  const session = createPreview({
    ...packageOptions,
    runner: {
      async render() {
        return failure;
      },
    },
  });
  value(session.update(draft));
  expect(await session.render({ scenario: "first" })).toBe(failure);
  expect(value(await session.check()).every((entry) => entry.result === failure)).toBe(true);
});

test("pending_render_cannot_restore_a_session_reset_by_update", async () => {
  let finish: ((result: Result<UiTree>) => void) | undefined;
  const session = createPreview({
    ...packageOptions,
    runner: {
      render: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  });
  value(session.update(draft));
  const pending = session.render({ scenario: "first" });
  value(session.update(draft));
  if (!finish) throw new Error("Missing pending render");
  finish({ ok: false, errors: [{ kind: "render-failed", pointer: "", message: "old draft" }] });
  rejects(await pending, "render-failed");
  rejects(await session.intent({ type: "action", name: "tasks.claim", args: { id: "x" } }), "not-found");
  expect(session.intents()).toEqual([]);
});
