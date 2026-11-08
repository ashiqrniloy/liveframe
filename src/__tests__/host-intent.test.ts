import { expect, test } from "bun:test";
import {
  type Intent,
  type IntentOrigin,
  type LiveframeError,
  obj,
  type Result,
  str,
  type UiNode,
  type UiTree,
  validateCapabilities,
  validateCatalog,
} from "@arnilo/liveframe";
import { type DispatchResult, handleIntent, renderPlacement } from "@arnilo/liveframe/host";
import { pack, type Scenario } from "@arnilo/liveframe/pack";
import { type Runner, templateRunner } from "@arnilo/liveframe/preview";
import { memoryStore } from "@arnilo/liveframe/store";
import type { HostEvent, Served } from "../host/index.ts";
import catalogDoc from "./fixtures/proof/catalog.json" with { type: "json" };

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
const errorsOf = (result: Result<unknown>): readonly LiveframeError[] => {
  if (result.ok) throw new Error("Expected a failure");
  return result.errors;
};

const catalog = value(validateCatalog(catalogDoc));
const capabilities = value(
  validateCapabilities({
    format: "liveframe-capabilities/1",
    actions: {
      "tasks.claim": {
        description: "Claim a task",
        args: obj({ id: str({ maxLength: 20 }) }),
        result: obj({ owner: str({ maxLength: 20 }) }),
      },
      "tasks.note": { description: "Note a task", args: obj({ id: str({ maxLength: 20 }) }) },
    },
    sources: {},
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
const manifest = {
  format: "liveframe-manifest/1",
  id: "tasks",
  version: "1.0.0",
  catalogId: "proof.ui@1",
  params: schema({}),
  state: schema({ label: { type: "string", maxLength: 10 } }),
  context: schema({}),
  initialState: { label: "first" },
  sources: {},
  actions: ["tasks.claim", "tasks.note"],
};
const press = (name: string) => ({
  key: name,
  kind: "button",
  props: { label: name },
  events: { onPress: { type: "action", name, args: { id: "t1" } } },
});
const template = {
  format: "liveframe-template/1",
  root: {
    kind: "stack",
    children: [
      { key: "title", kind: "text", props: { text: { $path: "state.label" } } },
      press("tasks.claim"),
      press("tasks.note"),
      {
        key: "field",
        kind: "textField",
        props: { label: "Label", value: { $path: "state.label" } },
        events: { onChange: { type: "setState", key: "label" } },
      },
    ],
  },
};

/** The first node of a kind, in tree order. */
function nodeOf(tree: UiTree, kind: string, label?: string): UiNode {
  const walk = (node: UiNode): UiNode | undefined => {
    if (node.kind === kind && (label === undefined || node.props?.label === label)) return node;
    for (const child of node.children ?? []) {
      const found = walk(child);
      if (found) return found;
    }
    return undefined;
  };
  const found = walk(tree.root);
  if (!found) throw new Error(`No ${kind}`);
  return found;
}
const originOf = (served: Served, node: UiNode, event: string): IntentOrigin => ({
  surfaceId: served.tree.surfaceId,
  revision: served.tree.revision,
  nodeId: node.id as string,
  event,
});
const offered = (node: UiNode, event: string) => node.events?.[event] as Intent & { type: string };

type Fixture = Awaited<ReturnType<typeof fixture>>;
/** A store with one placement, a runner recording each render's `actions`, and a log of every effect in order. */
async function fixture() {
  const scenario: Scenario = { name: "default", params: {}, state: { label: "first" }, context: {}, data: {} };
  const pkg = value(pack({ template, manifest, scenarios: [scenario] } as never, install));
  const store = memoryStore();
  await store.putPackage(pkg);
  await store.putPlacement({ id: "p1", slot: "main", widget: { id: "tasks", version: "1.0.0" }, params: {} });
  const log: string[] = [];
  const written: unknown[] = [];
  const guarded = {
    ...store,
    putState: async (...args: Parameters<typeof store.putState>) => {
      log.push("putState");
      written.push(args[2]);
      return store.putState(...args);
    },
  };
  const real = templateRunner();
  const rendered: unknown[] = [];
  const runner: Runner = {
    async render(pkg, inputs, options) {
      rendered.push(inputs.actions);
      return real.render(pkg, inputs, options);
    },
  };
  const events: HostEvent[] = [];
  const host = {
    store: guarded as typeof store,
    runner,
    installs,
    resolve: async () => ({}),
    onEvent: (event: HostEvent) => events.push(event),
  };
  const first = value(
    await renderPlacement({ ...host, placementId: "p1", catalogId: "proof.ui@1", viewer: "alice", context: {} }),
  );
  rendered.length = 0;
  return { host, first, log, written, rendered, events, store };
}

const handle = (
  f: Fixture,
  node: UiNode,
  event: string,
  extra: Partial<Parameters<typeof handleIntent<string>>[0]> = {},
) =>
  handleIntent<string>({
    ...f.host,
    served: f.first,
    origin: originOf(f.first, node, event),
    intent: offered(node, event),
    viewer: "alice",
    context: {},
    authorize: async () => {
      f.log.push("authorize");
      return true;
    },
    dispatch: async () => {
      f.log.push("dispatch");
      return { ok: true, value: { owner: "alice" } };
    },
    ...extra,
  } as never);

test("unoffered_intent_refused_no_effect", async () => {
  const f = await fixture();
  const claim = nodeOf(f.first.tree, "button", "tasks.claim");
  const text = nodeOf(f.first.tree, "text");
  // An event the node never offered, a node that offers nothing, and a node that does not exist.
  const cases: IntentOrigin[] = [
    originOf(f.first, claim, "onHover"),
    originOf(f.first, text, "onPress"),
    { ...originOf(f.first, claim, "onPress"), nodeId: "nope" },
  ];
  for (const origin of cases) {
    const result = await handle(f, claim, "onPress", { origin });
    expect(result.ok).toBe(false);
  }
  expect(f.log).toEqual([]);
  expect(f.rendered).toEqual([]);
  expect(f.events.map((event) => event.type)).toEqual(["intent-refused", "intent-refused", "intent-refused"]);
  expect(f.events.every((event) => event.type === "intent-refused" && event.reason === "not-offered")).toBe(true);
});

test("stale_revision_refused", async () => {
  const f = await fixture();
  const claim = nodeOf(f.first.tree, "button", "tasks.claim");
  const origin = { ...originOf(f.first, claim, "onPress"), revision: f.first.revision - 1 };
  const result = await handle(f, claim, "onPress", { origin });
  expect(errorsOf(result)).toEqual([expect.objectContaining({ kind: "version-conflict" })]);
  expect(f.log).toEqual([]);
  expect(f.events).toEqual([expect.objectContaining({ type: "intent-refused", reason: "stale" })]);
  // A newer revision is no more welcome than an older one: it is never rewritten to the latest.
  const ahead = { ...originOf(f.first, claim, "onPress"), revision: f.first.revision + 1 };
  expect(errorsOf(await handle(f, claim, "onPress", { origin: ahead }))[0]?.kind).toBe("version-conflict");
});

test("authorize_false_refused", async () => {
  const f = await fixture();
  const claim = nodeOf(f.first.tree, "button", "tasks.claim");
  const result = value(
    await handle(f, claim, "onPress", {
      authorize: async () => {
        f.log.push("authorize");
        return false;
      },
    }),
  );
  expect(f.log).toEqual(["authorize"]);
  expect(result.actions["tasks.claim"]).toEqual({ status: "refused", action: "tasks.claim", reason: "Not allowed" });
  expect(result.served.revision).toBe(2);
  expect(f.rendered).toEqual([{ "tasks.claim": { status: "refused", action: "tasks.claim", reason: "Not allowed" } }]);
  expect(f.events).toEqual([expect.objectContaining({ type: "intent-refused", reason: "unauthorized" })]);
});

test("authorize_throw_fails_closed", async () => {
  const f = await fixture();
  const claim = nodeOf(f.first.tree, "button", "tasks.claim");
  for (const authorize of [
    async () => {
      throw new Error("password=hunter2 at policy.internal");
    },
    () => {
      throw new Error("sync secret");
    },
    async () => "yes" as never,
  ]) {
    const result = value(await handle(f, claim, "onPress", { authorize }));
    expect(result.actions["tasks.claim"]?.status).toBe("refused");
    expect(JSON.stringify([result.actions, f.events])).not.toContain("hunter2");
  }
  expect(f.log).toEqual([]);
});

test("invalid_offered_action_recorded_refused_under_offered_key", async () => {
  const f = await fixture();
  const claim = nodeOf(f.first.tree, "button", "tasks.claim");
  const posted = { ...offered(claim, "onPress"), resultKey: "evil", args: { id: "other" } } as Intent;
  const result = value(await handle(f, claim, "onPress", { intent: posted }));
  expect(Object.keys(result.actions)).toEqual(["tasks.claim"]);
  expect(result.actions["tasks.claim"]).toEqual({ status: "refused", action: "tasks.claim", reason: "Not accepted" });
  expect(f.log).toEqual([]);
  expect(f.events).toEqual([expect.objectContaining({ type: "intent-refused", reason: "not-offered" })]);
  // The same bad intent again changes nothing, so the pipeline skips the render.
  const again = value(
    await handle(f, claim, "onPress", {
      intent: posted,
      actions: result.actions,
      served: result.served,
      origin: originOf(result.served, claim, "onPress"),
    }),
  );
  expect(again.served).toBe(result.served);
});

test("pending_then_ok_published_in_order", async () => {
  const f = await fixture();
  const claim = nodeOf(f.first.tree, "button", "tasks.claim");
  const published: Served[] = [];
  const result = value(
    await handle(f, claim, "onPress", {
      publish: (frame: Served) => {
        f.log.push("publish");
        published.push(frame);
      },
    }),
  );
  expect(f.log).toEqual(["authorize", "publish", "dispatch", "publish"]);
  expect(f.rendered).toEqual([
    { "tasks.claim": { status: "pending", action: "tasks.claim" } },
    { "tasks.claim": { status: "ok", action: "tasks.claim", value: { owner: "alice" } } },
  ]);
  expect(published.map((frame) => frame.revision)).toEqual([2, 3]);
  expect(published[1]).toBe(result.served);
  // The result frame is a patch against the pending frame the client already holds.
  expect(result.served.patch?.base).toBe(2);
});

test("no_pending_frame_without_publish", async () => {
  const f = await fixture();
  const claim = nodeOf(f.first.tree, "button", "tasks.claim");
  const result = value(await handle(f, claim, "onPress"));
  expect(f.rendered).toHaveLength(1);
  expect(result.actions["tasks.claim"]?.status).toBe("ok");
  expect(result.served.revision).toBe(2);
});

test("dispatch_throw_becomes_failed_without_leak", async () => {
  const f = await fixture();
  const claim = nodeOf(f.first.tree, "button", "tasks.claim");
  const result = value(
    await handle(f, claim, "onPress", {
      dispatch: async () => {
        throw new TypeError("password=hunter2 at db.internal");
      },
    }),
  );
  expect(result.actions["tasks.claim"]).toEqual({
    status: "failed",
    action: "tasks.claim",
    reason: "The action failed",
  });
  expect(JSON.stringify([result, f.events])).not.toContain("hunter2");
  expect(f.events).toEqual([{ type: "action-failed", placementId: "p1", action: "tasks.claim", error: "TypeError" }]);
  // A reported failure keeps the host's short reason, cut to 500 code points.
  const reported = value(
    await handle(f, claim, "onPress", { dispatch: async () => ({ ok: false, reason: "x".repeat(600) }) }),
  );
  expect((reported.actions["tasks.claim"]?.reason ?? "").length).toBe(500);
  const garbage = value(await handle(f, claim, "onPress", { dispatch: (async () => 42) as never }));
  expect(garbage.actions["tasks.claim"]?.reason).toBe("The action failed");
});

test("result_value_failing_schema_becomes_failed", async () => {
  const f = await fixture();
  const claim = nodeOf(f.first.tree, "button", "tasks.claim");
  for (const answer of [{ ok: true, value: { owner: "x".repeat(21) } }, { ok: true }, { ok: true, value: "alice" }]) {
    const result = value(await handle(f, claim, "onPress", { dispatch: async () => answer as DispatchResult }));
    expect(result.actions["tasks.claim"]).toEqual({
      status: "failed",
      action: "tasks.claim",
      reason: "Invalid result",
    });
  }
  expect(JSON.stringify(f.events)).not.toContain("xxxx");
});

test("value_dropped_without_result_schema", async () => {
  const f = await fixture();
  const note = nodeOf(f.first.tree, "button", "tasks.note");
  const result = value(
    await handle(f, note, "onPress", { dispatch: async () => ({ ok: true, value: { secret: "internal" } }) }),
  );
  expect(result.actions["tasks.note"]).toEqual({ status: "ok", action: "tasks.note" });
  expect(JSON.stringify(f.rendered)).not.toContain("internal");
});

test("actions_over_64_evict_oldest_settled", async () => {
  const f = await fixture();
  const claim = nodeOf(f.first.tree, "button", "tasks.claim");
  const settled = (status: "ok" | "pending") =>
    Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`k${i}`, { status, action: "tasks.note" }]));
  const result = value(await handle(f, claim, "onPress", { actions: settled("ok") }));
  const keys = Object.keys(result.actions);
  expect(keys).toHaveLength(64);
  expect(keys).not.toContain("k0");
  expect(keys).toContain("k1");
  expect(keys.at(-1)).toBe("tasks.claim");
  // Every slot pending: nothing runs, and nothing is dispatched.
  f.log.length = 0;
  const full = await handle(f, claim, "onPress", { actions: settled("pending") });
  expect(errorsOf(full)).toEqual([expect.objectContaining({ kind: "limit-exceeded", pointer: "/actions" })]);
  expect(f.log).toEqual([]);
  expect(f.events.at(-1)).toEqual(expect.objectContaining({ type: "intent-refused", reason: "limit" }));
});

test("set_state_persists_then_rerenders", async () => {
  const f = await fixture();
  const field = nodeOf(f.first.tree, "textField");
  const published: Served[] = [];
  const result = value(
    await handle(f, field, "onChange", {
      intent: { type: "setState", key: "label", value: "second" },
      publish: (frame: Served) => published.push(frame),
    }),
  );
  expect(f.written).toEqual([{ label: "second" }]);
  expect(await f.store.getState("p1", "")).toEqual({ label: "second" });
  expect(result.served.state).toEqual({ label: "second" });
  expect(result.served.revision).toBe(2);
  expect(result.served.patch?.base).toBe(1);
  expect(published).toEqual([result.served]);
  expect(f.log).toEqual(["putState"]);
});

test("set_state_invalid_value_no_write", async () => {
  const f = await fixture();
  const field = nodeOf(f.first.tree, "textField");
  // The offered event already carries the manifest's state schema, so an over-long value stops at the offered check.
  const long = await handle(f, field, "onChange", {
    intent: { type: "setState", key: "label", value: "far too long for this" },
  });
  expect(errorsOf(long)).toEqual([expect.objectContaining({ kind: "invalid-prop", pointer: "/value" })]);
  expect(f.events).toEqual([expect.objectContaining({ type: "intent-refused", reason: "not-offered" })]);
  // Spec §8 asks for the second check against the manifest that is installed now: the placement moved to a
  // package that allows three characters after this tree was served.
  const narrow = { ...manifest, version: "1.1.0", state: schema({ label: { type: "string", maxLength: 3 } }) };
  const scenario: Scenario = { name: "default", params: {}, state: { label: "ab" }, context: {}, data: {} };
  await f.store.putPackage(
    value(
      pack(
        { template, manifest: { ...narrow, initialState: { label: "ab" } }, scenarios: [scenario] } as never,
        install,
      ),
    ),
  );
  await f.store.putPlacement({ id: "p1", slot: "main", widget: { id: "tasks", version: "1.1.0" }, params: {} });
  f.events.length = 0;
  const result = await handle(f, field, "onChange", { intent: { type: "setState", key: "label", value: "abcd" } });
  expect(errorsOf(result)).toEqual([expect.objectContaining({ kind: "invalid-prop", pointer: "/value" })]);
  expect(f.written).toEqual([]);
  expect(await f.store.getState("p1", "")).toBeUndefined();
  expect(f.events).toEqual([expect.objectContaining({ type: "intent-refused", reason: "invalid-state" })]);
  expect(JSON.stringify(f.events)).not.toContain("abcd");
});

test("set_local_at_host_rejected", async () => {
  const f = await fixture();
  const field = nodeOf(f.first.tree, "textField");
  const result = await handle(f, field, "onChange", {
    intent: { type: "setLocal", key: "label", value: "x" } as never,
  });
  expect(errorsOf(result)).toEqual([expect.objectContaining({ kind: "invalid-prop", pointer: "/type" })]);
  expect(f.log).toEqual([]);
});

test("no_effect_before_check_offered_and_authorize", async () => {
  const f = await fixture();
  const claim = nodeOf(f.first.tree, "button", "tasks.claim");
  const field = nodeOf(f.first.tree, "textField");
  // Everything a bad intent can reach is refused before authorize, dispatch or any store write.
  await handle(f, claim, "onPress", { intent: { type: "action", name: "tasks.note", args: { id: "t1" } } });
  await handle(f, claim, "onPress", { intent: { type: "setState", key: "label", value: "x" } });
  await handle(f, field, "onChange", { intent: { type: "action", name: "tasks.claim", args: { id: "t1" } } });
  await handle(f, claim, "onPress", { origin: { ...originOf(f.first, claim, "onPress"), revision: 99 } });
  expect(f.log).toEqual([]);
  // A good one runs in exactly this order.
  await handle(f, claim, "onPress");
  expect(f.log).toEqual(["authorize", "dispatch"]);
  await handle(f, field, "onChange", { intent: { type: "setState", key: "label", value: "ok" } });
  expect(f.log).toEqual(["authorize", "dispatch", "putState"]);
});

test("served_catalog_without_install_is_load_failed", async () => {
  const f = await fixture();
  const claim = nodeOf(f.first.tree, "button", "tasks.claim");
  const result = await handle(f, claim, "onPress", { installs: {} });
  expect(errorsOf(result)).toEqual([expect.objectContaining({ kind: "catalog-mismatch", pointer: "/catalogId" })]);
  expect(f.log).toEqual([]);
});

test("publish_failure_contained", async () => {
  const f = await fixture();
  const claim = nodeOf(f.first.tree, "button", "tasks.claim");
  const result = value(
    await handle(f, claim, "onPress", {
      publish: async () => {
        throw new RangeError("socket closed");
      },
    }),
  );
  expect(result.actions["tasks.claim"]?.status).toBe("ok");
  expect(f.events.filter((event) => event.type === "publish-failed")).toEqual([
    { type: "publish-failed", placementId: "p1", error: "RangeError" },
    { type: "publish-failed", placementId: "p1", error: "RangeError" },
  ]);
  expect(JSON.stringify(f.events)).not.toContain("socket closed");
});
