import { describe, expect, test } from "bun:test";
import { compileValidator, type Intent, type UiNode, type UiTree, validateCatalog } from "@arnilo/liveframe";
import {
  createSurfaceCore,
  type NodeContext,
  type SurfaceCoreOptions,
  type SurfaceEvent,
} from "@arnilo/liveframe/surface";
import catalogJson from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "./fixtures/widgets/index.ts";

const checked = validateCatalog(catalogJson);
if (!checked.ok) throw new Error("catalog");
const catalog = checked.value;
const base = proofWidgets[0]?.manifest as unknown as Record<string, unknown>;
const manifest = {
  ...base,
  local: {
    type: "object",
    properties: { q: { type: "string", maxLength: 64 }, expanded: { type: "boolean" }, count: { type: "integer" } },
    required: ["q", "expanded", "count"],
    additionalProperties: false,
  },
  initialLocal: { q: "", expanded: false, count: 0 },
};
const validator = compileValidator({ catalog: catalogJson, capabilities, manifest });
const confirming = compileValidator({
  catalog: catalogJson,
  capabilities: {
    ...capabilities,
    actions: {
      ...capabilities.actions,
      "tasks.escalate": { ...capabilities.actions["tasks.escalate"], confirm: true, irreversible: true },
    },
  },
  manifest,
});

const tree = (children: UiNode[], extra: Partial<UiTree> = {}): UiTree => ({
  format: "liveframe/1",
  catalogId: catalog.catalogId,
  surfaceId: "s",
  revision: 1,
  root: { id: "root", kind: "stack", props: {}, children },
  ...extra,
});
const row = (name: string, extra: Partial<UiNode> = {}): UiNode => ({
  id: `root/${name}`,
  kind: "text",
  props: { text: name },
  ...extra,
});
const field: UiNode = {
  id: "root/field",
  kind: "textField",
  props: { label: "Filter" },
  events: { onChange: { type: "setLocal", key: "q" } },
};

function open(extra: Partial<SurfaceCoreOptions> = {}) {
  const intents: { intent: Intent; origin: unknown }[] = [];
  const core = createSurfaceCore({
    catalog,
    validator,
    onIntent: (intent, origin) => void intents.push({ intent, origin }),
    ...extra,
  });
  return { core, intents };
}
const ids = (context: NodeContext | undefined) => (context?.items ?? []).map((item) => item.id);
const rows = (): UiNode[] => [
  field,
  row("alpha", { when: { $contains: ["alpha", { $path: "local.q" }] } }),
  row("beta", { when: { $contains: ["beta", { $path: "local.q" }] } }),
  row("static"),
];

describe("arrival", () => {
  test("accept_validates_before_reading_and_keeps_the_last_good_tree", () => {
    const { core } = open();
    expect(core.snapshot().valid).toBe(false);
    const first = core.accept(tree(rows()));
    expect(first.ok).toBe(true);
    const bad = core.accept({ ...tree(rows()), format: "other" });
    expect(bad.ok).toBe(false);
    expect(core.snapshot().valid).toBe(false);
    // The tree is kept, so a later revision still compares against it.
    expect(core.snapshot().tree?.revision).toBe(1);
    expect(core.accept(tree(rows(), { revision: 0 })).ok).toBe(true);
    expect(core.snapshot().tree?.revision).toBe(1);
    expect(core.snapshot().valid).toBe(true);
  });

  test("a_wrapped_validator_that_rejects_every_arrival_needs_no_facts", () => {
    const rejecting = { ...validator, validateTree: () => ({ ok: false as const, errors: [] }) };
    const { core } = open({ validator: rejecting });
    expect(core.accept(tree(rows())).ok).toBe(false);
    expect(core.snapshot().valid).toBe(false);
  });

  test("a_lower_revision_of_the_same_surface_is_ignored_and_a_new_surface_replaces_it", () => {
    const { core } = open();
    core.accept(tree(rows(), { revision: 5 }));
    const kept = core.snapshot();
    core.accept(tree([row("old")], { revision: 4 }));
    expect(core.snapshot()).toBe(kept);
    core.accept(tree([row("other")], { revision: 1, surfaceId: "t" }));
    expect(ids(core.snapshot().root)).toEqual(["root/other"]);
  });

  test("accepting_the_same_input_twice_is_a_no_op", () => {
    const { core } = open();
    const input = tree(rows());
    core.accept(input);
    const snapshot = core.snapshot();
    expect(core.accept(input)).toEqual({ ok: true, value: snapshot });
    expect(core.snapshot()).toBe(snapshot);
  });

  test("an_unchanged_revision_keeps_every_node_context", () => {
    const { core } = open();
    core.accept(tree(rows()));
    const before = core.snapshot().root;
    core.accept(tree(rows(), { revision: 2 }));
    expect(core.snapshot().root).toBe(before);
  });
});

describe("local state", () => {
  test("set_local_never_calls_onIntent", () => {
    const { core, intents } = open();
    core.accept(tree(rows()));
    const input = core.snapshot().root?.items[0];
    let notified = 0;
    core.subscribe(() => void notified++);
    const result = input?.emit("onChange", "alp");
    expect(result).toBeUndefined();
    expect(intents).toEqual([]);
    expect(notified).toBe(1);
    expect(core.snapshot().local).toEqual({ q: "alp", expanded: false, count: 0 });
    expect(input?.events.onChange).toEqual({ type: "setLocal", confirm: false, irreversible: false });
  });

  test("when_hides_and_shows_nodes_and_unrelated_nodes_keep_their_identity", () => {
    const { core } = open();
    core.accept(tree(rows()));
    // The empty string is contained in every title, so nothing is hidden at first.
    expect(ids(core.snapshot().root)).toEqual(["root/field", "root/alpha", "root/beta", "root/static"]);
    const before = core.snapshot().root;
    const field0 = before?.items[0];
    const static0 = before?.items[3];
    core.snapshot().root?.items[0]?.emit("onChange", "alp");
    const after = core.snapshot().root;
    expect(ids(after)).toEqual(["root/field", "root/alpha", "root/static"]);
    expect(after).not.toBe(before);
    expect(after?.items[0]).toBe(field0);
    expect(after?.items.at(-1)).toBe(static0);
    // Returning to the earlier value shows the node again.
    after?.items[0]?.emit("onChange", "");
    expect(ids(core.snapshot().root)).toEqual(["root/field", "root/alpha", "root/beta", "root/static"]);
  });

  test("writing_the_same_value_changes_nothing", () => {
    const { core } = open();
    core.accept(tree(rows()));
    let notified = 0;
    core.subscribe(() => void notified++);
    const snapshot = core.snapshot();
    core.snapshot().root?.items[0]?.emit("onChange", "");
    expect(notified).toBe(0);
    expect(core.snapshot()).toBe(snapshot);
  });

  test("a_value_outside_the_local_schema_is_rejected_and_writes_nothing", () => {
    const { core } = open();
    core.accept(tree(rows()));
    const input = core.snapshot().root?.items[0];
    expect(() => input?.emit("onChange", "x".repeat(65))).toThrow("Invalid event value: textField.onChange");
    expect(() => input?.emit("onChange", 3 as never)).toThrow("Invalid event value");
    expect(core.snapshot().local.q).toBe("");
  });

  test("local_state_resets_on_surface_change", () => {
    const { core } = open();
    core.accept(tree(rows()));
    core.snapshot().root?.items[0]?.emit("onChange", "alp");
    // A new revision of the same surface keeps a half-typed filter.
    core.accept(tree(rows(), { revision: 2 }));
    expect(core.snapshot().local.q).toBe("alp");
    expect(ids(core.snapshot().root)).toEqual(["root/field", "root/alpha", "root/static"]);
    core.accept(tree(rows(), { surfaceId: "t" }));
    expect(core.snapshot().local.q).toBe("");
    expect(ids(core.snapshot().root)).toEqual(["root/field", "root/alpha", "root/beta", "root/static"]);
  });

  test("a_hidden_root_leaves_no_context", () => {
    const { core } = open();
    core.accept({
      ...tree([]),
      root: { id: "root", kind: "stack", props: {}, when: { $eq: [{ $path: "local.count" }, 1] } },
    });
    expect(core.snapshot().valid).toBe(true);
    expect(core.snapshot().root).toBeUndefined();
  });
});

describe("bindings", () => {
  const bound = (extra: Partial<UiNode>): UiNode => ({
    id: "root/bound",
    kind: "textField",
    props: { label: "F" },
    ...extra,
  });

  test("bind_overrides_a_prop_with_the_evaluated_value", () => {
    const { core } = open();
    const input = bound({ bind: { placeholder: { $concat: ["Find ", { $path: "local.q" }] } } });
    core.accept(tree([field, input]));
    expect(core.snapshot().root?.items[1]?.props).toEqual({ label: "F", placeholder: "Find " });
    core.snapshot().root?.items[0]?.emit("onChange", "a");
    expect(core.snapshot().root?.items[1]?.props).toEqual({ label: "F", placeholder: "Find a" });
  });

  test("bound_value_failing_schema_renders_node_fallback", () => {
    const { core } = open();
    // The type fits (integer), the value does not: maxLength has a minimum of 1.
    core.accept(tree([bound({ bind: { maxLength: { $path: "local.count" } } })]));
    const fault = core.snapshot().root?.items[0];
    expect(fault?.fault?.[0]).toMatchObject({ kind: "invalid-prop", nodeId: "root/bound" });
    expect(fault?.items).toEqual([]);
    expect(core.snapshot().valid).toBe(true);
  });

  test("an_evaluation_error_is_a_node_fault_not_a_surface_failure", () => {
    const { core } = open();
    core.accept(tree([row("a", { when: { $eq: [{ $div: [1, { $path: "local.count" }] }, 1] } }), row("b")]));
    const items = core.snapshot().root?.items ?? [];
    expect(items.map((item) => [item.id, item.fault !== undefined])).toEqual([
      ["root/a", true],
      ["root/b", false],
    ]);
  });

  test("a_binding_failure_clears_when_the_local_value_changes", () => {
    const { core } = open();
    core.accept(tree([field, bound({ bind: { maxLength: { $len: { $path: "local.q" } } } })]));
    expect(core.snapshot().root?.items[1]?.fault).toBeDefined();
    core.snapshot().root?.items[0]?.emit("onChange", "abc");
    expect(core.snapshot().root?.items[1]?.fault).toBeUndefined();
    expect(core.snapshot().root?.items[1]?.props).toEqual({ label: "F", maxLength: 3 });
  });
});

describe("intents", () => {
  const button = (events: NonNullable<UiNode["events"]>): UiNode => ({
    id: "root/b",
    kind: "button",
    props: { label: "Go" },
    events,
  });

  test("setState_and_action_intents_are_completed_and_carry_their_origin", () => {
    const { core, intents } = open();
    core.accept(
      tree([
        {
          id: "root/f",
          kind: "textField",
          props: { label: "F" },
          events: { onChange: { type: "setState", key: "selected" } },
        },
      ]),
    );
    core.snapshot().root?.items[0]?.emit("onChange", "hi");
    expect(intents).toHaveLength(1);
    expect(intents[0]?.intent).toEqual({ type: "setState", key: "selected", value: "hi" });
    expect(intents[0]?.origin).toEqual({ surfaceId: "s", revision: 1, nodeId: "root/f", event: "onChange" });
    expect(Object.isFrozen(intents[0]?.intent)).toBe(true);
  });

  test("emit_checks_the_carried_value_and_raises_nothing_on_mismatch", () => {
    const { core, intents } = open();
    core.accept(tree([button({ onPress: { type: "action", name: "tasks.claim", args: { id: "t1" } } })]));
    expect(() => core.snapshot().root?.items[0]?.emit("onPress", "x")).toThrow("Invalid event value");
    expect(intents).toEqual([]);
  });

  test("emit_is_inert_while_the_arrival_is_invalid", () => {
    const { core, intents } = open();
    core.accept(tree([button({ onPress: { type: "action", name: "tasks.claim", args: { id: "t1" } } })]));
    const item = core.snapshot().root?.items[0];
    core.accept({ nope: true });
    expect(item?.emit("onPress")).toBeUndefined();
    expect(intents).toEqual([]);
  });

  test("confirmation_is_single_flight_and_drops_after_unmount", async () => {
    const asked: Intent[] = [];
    let release: (approved: boolean) => void = () => undefined;
    const { core, intents } = open({
      validator: confirming,
      confirm: (intent) => {
        asked.push(intent);
        return new Promise<boolean>((resolve) => {
          release = resolve;
        });
      },
    });
    const detach = core.attach();
    core.accept(
      tree([button({ onPress: { type: "action", name: "tasks.escalate", args: { id: "t1", reason: "r" } } })]),
    );
    const item = core.snapshot().root?.items[0];
    const first = item?.emit("onPress");
    expect(item?.emit("onPress")).toBeUndefined();
    expect(asked).toHaveLength(1);
    detach();
    release(true);
    await first;
    expect(intents).toEqual([]);
  });
});

describe("observability events", () => {
  const button = (events: NonNullable<UiNode["events"]>): UiNode => ({
    id: "root/b",
    kind: "button",
    props: { label: "Go" },
    events,
  });
  const claim = { onPress: { type: "action", name: "tasks.claim", args: { id: "t1" } } } as const;
  function watch(extra: Partial<SurfaceCoreOptions> = {}) {
    const seen: SurfaceEvent[] = [];
    const opened = open({ onEvent: (event) => void seen.push(event), ...extra });
    return { ...opened, seen };
  }

  test("arrival_rejected_event_carries_errors", () => {
    const { core, seen } = watch();
    core.accept({ nope: true });
    expect(seen).toHaveLength(1);
    const [event] = seen;
    expect(event?.type).toBe("arrival-rejected");
    expect(event && "surfaceId" in event).toBe(false);
    expect(event?.type === "arrival-rejected" && event.errors.length).toBeGreaterThan(0);
    // The surface on screen is named once there is one, and the same input reports once.
    core.accept(tree(rows()));
    const bad = { ...tree(rows()), format: "other" };
    core.accept(bad);
    core.accept(bad);
    expect(seen).toHaveLength(2);
    expect(seen[1]).toMatchObject({ type: "arrival-rejected", surfaceId: "s" });
  });

  test("stale_revision_event_names_both_revisions", () => {
    const { core, seen } = watch();
    core.accept(tree(rows(), { revision: 5 }));
    core.accept(tree(rows(), { revision: 4 }));
    expect(seen).toEqual([{ type: "stale-revision", surfaceId: "s", revision: 4, current: 5 }]);
  });

  test("emit_rejected_event_names_node_event_and_reason", () => {
    const { core, seen } = watch();
    core.accept(tree([button(claim), field]));
    expect(() => core.snapshot().root?.items[0]?.emit("onPress", "x")).toThrow("Invalid event value");
    expect(() => core.snapshot().root?.items[1]?.emit("onChange", "x".repeat(200))).toThrow("Invalid event value");
    expect(seen).toEqual([
      { type: "emit-rejected", nodeId: "root/b", event: "onPress", reason: "invalid-value" },
      { type: "emit-rejected", nodeId: "root/field", event: "onChange", reason: "invalid-local" },
    ]);
  });

  test("implementation_failed_event_names_node", () => {
    const { core, seen } = watch();
    core.accept(tree(rows()));
    const node = core.snapshot().root?.items[0]?.node;
    if (!node) throw new Error("no node");
    core.fail(node);
    expect(seen).toEqual([{ type: "implementation-failed", nodeId: "root/field", kind: "textField" }]);
  });

  test("binding_failed_event_names_node_and_prop_once_per_change", () => {
    const { core, seen } = watch();
    const bad: UiNode = {
      id: "root/bound",
      kind: "textField",
      props: { label: "F" },
      bind: { maxLength: { $len: { $path: "local.q" } } },
    };
    core.accept(tree([field, bad]));
    core.accept(tree([field, bad], { revision: 2 }));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ type: "binding-failed", nodeId: "root/bound", prop: "maxLength" });
    core.snapshot().root?.items[0]?.emit("onChange", "abc");
    expect(seen).toHaveLength(1);
    core.snapshot().root?.items[0]?.emit("onChange", "");
    expect(seen).toHaveLength(2);
    const failing: UiNode = { ...row("a"), when: { $eq: [{ $div: [1, { $path: "local.count" }] }, 1] } };
    core.accept(tree([failing], { revision: 3 }));
    const last = seen.at(-1);
    expect(last).toMatchObject({ type: "binding-failed", nodeId: "root/a" });
    expect(last && "prop" in last).toBe(false);
  });

  test("confirm_dropped_event_for_single_flight_and_unmount", async () => {
    let release: (approved: boolean) => void = () => undefined;
    const { core, seen } = watch({
      validator: confirming,
      confirm: () =>
        new Promise<boolean>((resolve) => {
          release = resolve;
        }),
    });
    const detach = core.attach();
    core.accept(
      tree([button({ onPress: { type: "action", name: "tasks.escalate", args: { id: "t1", reason: "r" } } })]),
    );
    const item = core.snapshot().root?.items[0];
    const first = item?.emit("onPress");
    item?.emit("onPress");
    expect(seen).toEqual([{ type: "confirm-dropped", nodeId: "root/b" }]);
    detach();
    release(true);
    await first;
    expect(seen).toEqual([
      { type: "confirm-dropped", nodeId: "root/b" },
      { type: "confirm-dropped", nodeId: "root/b" },
    ]);
  });

  test("events_are_frozen_and_the_union_is_what_the_core_reports", () => {
    const { core, seen } = watch();
    core.accept({ nope: true });
    expect(Object.isFrozen(seen[0])).toBe(true);
    expect(Object.isFrozen((seen[0] as { errors: unknown }).errors)).toBe(true);
  });

  test("throwing_onEvent_contained", async () => {
    const { core, intents } = open({
      onEvent: () => {
        throw new Error("logger down");
      },
    });
    expect(() => core.accept({ nope: true })).not.toThrow();
    core.accept(tree([button(claim)]));
    expect(core.snapshot().valid).toBe(true);
    expect(() => core.snapshot().root?.items[0]?.emit("onPress", "x")).toThrow("Invalid event value");
    core.snapshot().root?.items[0]?.emit("onPress");
    expect(intents).toHaveLength(1);
    const rejecting = open({ onEvent: () => Promise.reject(new Error("async logger down")) });
    rejecting.core.accept({ nope: true });
    await Promise.resolve();
  });

  test("events_carry_no_prop_values", () => {
    const secret = "s3cret-user-data";
    const { core, seen } = watch();
    // An invalid arrival, a failing binding, a rejected emit and a stale revision, each with a secret in play.
    core.accept(tree([{ ...row("x"), props: { text: secret, extra: secret } }], { revision: 9 }));
    core.accept(
      tree(
        [
          {
            id: "root/f",
            kind: "textField",
            props: { label: secret },
            bind: { maxLength: { $len: { $path: "local.q" } } },
          },
        ],
        {
          revision: 10,
        },
      ),
    );
    core.accept(tree([button(claim)], { revision: 11 }));
    try {
      core.snapshot().root?.items[0]?.emit("onPress", secret);
    } catch {
      // Expected: a carries mismatch.
    }
    core.accept(tree([row(secret)], { revision: 1 }));
    expect(seen.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(seen)).not.toContain(secret);
  });

  test("no_allocation_without_onEvent", async () => {
    const types = new Set([
      "arrival-rejected",
      "stale-revision",
      "emit-rejected",
      "implementation-failed",
      "binding-failed",
      "confirm-dropped",
    ]);
    const frozen: unknown[] = [];
    const freeze = Object.freeze;
    Object.freeze = ((value: unknown) => {
      frozen.push(value);
      return freeze(value as object);
    }) as typeof Object.freeze;
    try {
      let release: (approved: boolean) => void = () => undefined;
      const { core } = open({
        validator: confirming,
        confirm: () =>
          new Promise<boolean>((resolve) => {
            release = resolve;
          }),
      });
      const detach = core.attach();
      core.accept({ nope: true });
      core.accept(tree([button(claim), field], { revision: 5 }));
      core.accept(tree([button(claim)], { revision: 4 }));
      core.accept(
        tree(
          [
            button(claim),
            {
              id: "root/f",
              kind: "textField",
              props: { label: "F" },
              bind: { maxLength: { $len: { $path: "local.q" } } },
            },
            {
              ...button({ onPress: { type: "action", name: "tasks.escalate", args: { id: "t1", reason: "r" } } }),
              id: "root/e",
            },
          ],
          { revision: 6 },
        ),
      );
      const items = core.snapshot().root?.items ?? [];
      expect(() => items[0]?.emit("onPress", "x")).toThrow();
      const node = items[1]?.node;
      if (node) core.fail(node);
      const pending = items[2]?.emit("onPress");
      items[2]?.emit("onPress");
      detach();
      release(true);
      await pending;
    } finally {
      Object.freeze = freeze;
    }
    expect(frozen.filter((value) => types.has((value as { type?: string } | null)?.type ?? ""))).toEqual([]);
  });
});

describe("portability", () => {
  test("core_has_no_react_or_dom_imports", async () => {
    const forbidden = /from\s+["'](?:react|react-dom)(?:\/[^"']*)?["']|\b(?:document|window|navigator)\s*[.[]/;
    for await (const path of new Bun.Glob("*.ts").scan(new URL("../surface/", import.meta.url).pathname)) {
      const source = await Bun.file(new URL(`../surface/${path}`, import.meta.url)).text();
      expect(source, path).not.toMatch(forbidden);
      expect(source, path).not.toMatch(/from\s+["'][^"']*\/react\//);
    }
  });
});
