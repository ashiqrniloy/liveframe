/** @jsxImportSource @arnilo/liveframe/sdk */
import { describe, expect, test } from "bun:test";
import {
  applyPatch,
  checkOffered,
  compileValidator,
  diffTrees,
  type LiveframeError,
  LiveframeFailure,
  type UiNode,
  type UiTree,
  validateTreePatch,
} from "@arnilo/liveframe";
import { action, ex, local, primitive, render, self, state, type WidgetInputs } from "@arnilo/liveframe/sdk";
import { renderTemplate, type Template, validateTemplate } from "../template/index.ts";
import catalog from "./fixtures/proof/catalog.json" with { type: "json" };
import capabilities from "./fixtures/widgets/capabilities.json" with { type: "json" };
import { proofWidgets } from "./fixtures/widgets/index.ts";

const baseManifest = proofWidgets[0]?.manifest as unknown as Record<string, unknown> & { initialState: unknown };
const localSchema = {
  type: "object",
  properties: { q: { type: "string", maxLength: 64 }, expanded: { type: "boolean" }, count: { type: "integer" } },
  required: ["q", "expanded", "count"],
  additionalProperties: false,
};
const manifest = { ...baseManifest, local: localSchema, initialLocal: { q: "", expanded: false, count: 0 } };
const validator = compileValidator({ catalog, capabilities, manifest });
const inputs = proofWidgets[0]?.scenarios[0] as WidgetInputs;

const wrap = (...children: UiNode[]): UiTree => ({
  format: "liveframe/1",
  catalogId: catalog.catalogId,
  surfaceId: "s",
  revision: 0,
  root: { id: "root", kind: "stack", props: {}, children },
});
const text = (extra: Partial<UiNode> = {}): UiNode => ({ id: "root/a", kind: "text", props: { text: "x" }, ...extra });
const errorsOf = (...children: UiNode[]): readonly LiveframeError[] => {
  const result = validator.validateTree(wrap(...children));
  return result.ok ? [] : result.errors;
};
const rejected = (errors: readonly LiveframeError[], pointer: string, kind?: LiveframeError["kind"]) =>
  expect(errors).toContainEqual(expect.objectContaining({ pointer, ...(kind ? { kind } : {}) }));
const failureOf = (change: Record<string, unknown>): readonly LiveframeError[] => {
  try {
    compileValidator({ catalog, capabilities, manifest: { ...manifest, ...change } });
  } catch (error) {
    if (error instanceof LiveframeFailure) return error.errors;
    throw error;
  }
  return [];
};

describe("manifest local state", () => {
  test("local_and_initial_local_are_optional", () => {
    expect(() => compileValidator({ catalog, capabilities, manifest: baseManifest })).not.toThrow();
    expect(failureOf({})).toEqual([]);
  });

  test("initial_local_must_match_schema", () => {
    rejected(failureOf({ initialLocal: { q: 5, expanded: false, count: 0 } }), "/initialLocal/q");
    rejected(failureOf({ initialLocal: { q: "", expanded: false } }), "/initialLocal/count");
    rejected(failureOf({ initialLocal: { q: "", expanded: false, count: 0, extra: 1 } }), "/initialLocal/extra");
    // With every property required, `local` without `initialLocal` cannot be satisfied.
    const { initialLocal: _, ...without } = manifest;
    expect(() => compileValidator({ catalog, capabilities, manifest: without })).toThrow(LiveframeFailure);
    // `initialLocal` without `local` has nothing to match.
    const { local: _local, ...noLocal } = manifest;
    expect(() =>
      compileValidator({ catalog, capabilities, manifest: { ...noLocal, initialLocal: { q: "" } } }),
    ).toThrow(LiveframeFailure);
  });

  test("local_is_closed_bounded_scalars", () => {
    const withProperty = (name: string, schema: unknown) => ({
      local: {
        ...localSchema,
        properties: { ...localSchema.properties, [name]: schema },
        required: [...localSchema.required, name],
      },
      initialLocal: { q: "", expanded: false, count: 0, [name]: null },
    });
    rejected(
      failureOf(withProperty("rows", { type: "array", items: { type: "boolean" }, maxItems: 2 })),
      "/local/properties/rows",
    );
    rejected(failureOf(withProperty("deep", localSchema)), "/local/properties/deep");
    rejected(failureOf(withProperty("long", { type: "string", maxLength: 257 })), "/local/properties/long/maxLength");
    rejected(
      failureOf(withProperty("pat", { type: "string", maxLength: 8, pattern: "^a$" })),
      "/local/properties/pat/pattern",
    );
    rejected(failureOf(withProperty("Bad-Name", { type: "boolean" })), "/local/properties/Bad-Name");
    expect(failureOf(withProperty("pick", { type: "string", maxLength: 4, enum: ["a", "b"], nullable: true }))).toEqual(
      [],
    );
    // Every property must be required, and there are at most 32.
    rejected(failureOf({ local: { ...localSchema, required: ["q"] } }), "/local/required");
    const many = Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`k${i}`, { type: "boolean" }]));
    rejected(
      failureOf({
        local: { type: "object", properties: many, required: Object.keys(many), additionalProperties: false },
        initialLocal: Object.fromEntries(Object.keys(many).map((key) => [key, false])),
      }),
      "/local/properties",
      "limit-exceeded",
    );
  });
});

describe("when and bind in the validator", () => {
  test("a_well_formed_when_and_bind_are_accepted", () => {
    const node = text({
      when: ex.contains("abcd", local("q")),
      bind: { text: ex.concat(self("text"), "!") },
    });
    expect(errorsOf(node)).toEqual([]);
    expect(errorsOf(text({ when: true }))).toEqual([]);
  });

  test("when_with_data_root_rejected", () => {
    rejected(errorsOf(text({ when: { $path: "data.rows" } })), "/root/children/0/when/$path", "unknown-name");
    rejected(errorsOf(text({ when: { $path: "state.filter" } })), "/root/children/0/when/$path", "unknown-name");
    rejected(errorsOf(text({ when: { $path: "local.missing" } })), "/root/children/0/when/$path", "unknown-name");
    rejected(errorsOf(text({ bind: { text: { $path: "context.locale" } } })), "/root/children/0/bind/text/$path");
  });

  test("when_must_be_boolean", () => {
    rejected(errorsOf(text({ when: local("q") })), "/root/children/0/when");
    rejected(errorsOf(text({ when: "yes" })), "/root/children/0/when");
  });

  test("operators_outside_the_allow_list_are_rejected", () => {
    const loop = { $map: { in: [1], as: "x", value: { $path: "x" } } };
    const errors = errorsOf(text({ when: ex.eq(ex.len(loop), 1) }));
    expect(errors).toContainEqual(
      expect.objectContaining({
        pointer: "/root/children/0/when/$eq/0/$len/$map",
        expected: "an operator allowed in a tree expression",
      }),
    );
    rejected(errorsOf(text({ when: { $unknown: 1 } })), "/root/children/0/when/$unknown");
  });

  test("bind_to_undeclared_prop_rejected", () => {
    rejected(errorsOf(text({ bind: { nope: 1 } })), "/root/children/0/bind/nope");
    // A node field is not a prop: a binding cannot reach variant, style or events.
    rejected(errorsOf(text({ bind: { variant: "x" } })), "/root/children/0/bind/variant");
    rejected(errorsOf(text({ bind: { onPress: 1 } })), "/root/children/0/bind/onPress");
  });

  test("bind_to_a_reference_prop_rejected", () => {
    const field: UiNode = { id: "root/f", kind: "textField", props: { label: "F" }, bind: { describedBy: "root/a" } };
    rejected(errorsOf(field), "/root/children/0/bind/describedBy");
  });

  test("bind_type_mismatch_rejected", () => {
    rejected(errorsOf(text({ bind: { text: local("count") } })), "/root/children/0/bind/text");
    rejected(errorsOf(text({ bind: { text: 3 } })), "/root/children/0/bind/text");
    const level: UiNode = {
      id: "root/h",
      kind: "heading",
      props: { text: "H", level: 2 },
      bind: { level: local("q") },
    };
    rejected(errorsOf(level), "/root/children/0/bind/level");
    // An optional prop accepts an optional value; a required one does not.
    const button = (bind: Record<string, unknown>): UiNode =>
      ({ id: "root/b", kind: "button", props: { label: "B" }, bind }) as UiNode;
    expect(errorsOf(button({ disabled: local("expanded") }))).toEqual([]);
    expect(errorsOf(button({ disabled: ex.omit() }))).toEqual([]);
    rejected(errorsOf(button({ label: ex.omit() })), "/root/children/0/bind/label");
  });

  test("expressions_are_bounded", () => {
    let deep: unknown = true;
    for (let i = 0; i < 15; i++) deep = ex.not(deep as never);
    expect(errorsOf(text({ when: deep as never }))).toEqual([]);
    expect(errorsOf(text({ when: ex.not(deep as never) }))).toContainEqual(
      expect.objectContaining({ kind: "limit-exceeded", expected: "at most 16 levels" }),
    );
    const wide = ex.and(...Array.from({ length: 70 }, () => true));
    expect(errorsOf(text({ when: wide }))).toContainEqual(
      expect.objectContaining({ kind: "limit-exceeded", expected: "at most 64 nodes" }),
    );
    const many = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`p${i}`, 1]));
    rejected(errorsOf(text({ bind: many })), "/root/children/0/bind", "limit-exceeded");
  });

  test("a_tree_has_a_total_expression_budget", () => {
    const expression = ex.and(...Array.from({ length: 20 }, () => ex.eq(1, 1)));
    const rows = Array.from({ length: 170 }, (_, i) => text({ id: `root/r${i}`, when: expression }));
    const errors = errorsOf(...rows);
    expect(errors).toContainEqual(expect.objectContaining({ kind: "limit-exceeded" }));
  });

  test("unknown_fields_on_a_node_still_fail_closed", () => {
    rejected(errorsOf({ ...text(), whenever: true } as UiNode), "/root/children/0/whenever");
  });
});

describe("setLocal", () => {
  const field = (events: unknown): UiNode =>
    ({ id: "root/f", kind: "textField", props: { label: "F" }, events }) as UiNode;

  test("set_local_fills_from_the_event_or_a_literal", () => {
    expect(errorsOf(field({ onChange: local.set("q") }))).toEqual([]);
    expect(errorsOf(field({ onChange: local.set("q", "fixed") }))).toEqual([]);
    const toggle: UiNode = {
      id: "root/t",
      kind: "switch",
      props: { label: "T" },
      events: { onChange: local.set("expanded") },
    };
    expect(errorsOf(toggle)).toEqual([]);
  });

  test("set_local_unknown_key_rejected", () => {
    rejected(errorsOf(field({ onChange: local.set("nope") })), "/root/children/0/events/onChange/key", "unknown-name");
  });

  test("set_local_value_must_match_the_property", () => {
    rejected(errorsOf(field({ onChange: local.set("q", 3) })), "/root/children/0/events/onChange/value");
    rejected(errorsOf(field({ onChange: local.set("q", "x".repeat(65)) })), "/root/children/0/events/onChange/value");
    // A boolean event cannot fill a string property.
    const toggle: UiNode = {
      id: "root/t",
      kind: "switch",
      props: { label: "T" },
      events: { onChange: local.set("q") },
    };
    rejected(errorsOf(toggle), "/root/children/0/events/onChange/value");
  });

  test("set_local_without_declared_local_state_is_rejected", () => {
    const plain = compileValidator({ catalog, capabilities, manifest: baseManifest });
    const result = plain.validateTree(wrap(field({ onChange: local.set("q") })));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.expected).toContain("none");
  });

  test("the_host_never_accepts_set_local", () => {
    const tree = wrap(field({ onChange: local.set("q") }));
    const origin = { surfaceId: "s", revision: 0, nodeId: "root/f", event: "onChange" };
    const result = checkOffered(tree, origin, { type: "setLocal", key: "q", value: "a" } as never, validator);
    expect(result).toMatchObject({ ok: false, errors: [{ kind: "invalid-prop", pointer: "/type" }] });
    // Nor a setState posted against an event offered as setLocal.
    const state = checkOffered(tree, origin, { type: "setState", key: "filter", value: "all" }, validator);
    expect(state).toMatchObject({ ok: false, errors: [{ pointer: "/type" }] });
  });
});

describe("compound local writes on host intents", () => {
  const button = (events: unknown): UiNode =>
    ({ id: "root/b", kind: "button", props: { label: "Go" }, events }) as UiNode;
  const field = (events: unknown): UiNode =>
    ({ id: "root/f", kind: "textField", props: { label: "F" }, events }) as UiNode;
  const Stack = primitive<{ readonly children?: unknown }>("stack");
  const Button = primitive<{ readonly label: string; readonly onPress?: unknown }>("button");
  const options = { validator, surfaceId: "s", revision: 0 };

  test("local_writes_validate_on_arrival_and_render", () => {
    expect(
      errorsOf(
        button({
          onPress: action("tasks.claim", { id: "t1" }, { local: [local.set("expanded", true, { until: "revision" })] }),
        }),
      ),
    ).toEqual([]);
    expect(
      errorsOf(
        field({
          onChange: state.set("reason", undefined, {
            local: [local.set("q"), local.set("expanded", true, { until: "revision" })],
          }),
        }),
      ),
    ).toEqual([]);
    const widget = () => (
      <Stack>
        <Button
          label="Save"
          onPress={action("tasks.claim", { id: "t1" }, { local: [local.set("expanded", true, { until: "revision" })] })}
        />
      </Stack>
    );
    expect(render(widget, inputs, options).ok).toBe(true);
  });

  test("local_write_to_an_undeclared_key_is_unknown_name", () => {
    rejected(
      errorsOf(button({ onPress: action("tasks.claim", { id: "t1" }, { local: [local.set("nope", true)] }) })),
      "/root/children/0/events/onPress/local/0/key",
      "unknown-name",
    );
    const badWidget = () => (
      <Stack>
        <Button label="Save" onPress={action("tasks.claim", { id: "t1" }, { local: [local.set("nope", true)] })} />
      </Stack>
    );
    const rendered = render(badWidget, inputs, options);
    expect(rendered.ok).toBe(false);
    if (!rendered.ok)
      expect(rendered.errors[0]).toMatchObject({
        kind: "unknown-name",
        pointer: "/root/button/events/onPress/local/0/key",
      });
  });

  test("more_than_four_writes_is_rejected", () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ key: "count", value: i }));
    rejected(
      errorsOf(button({ onPress: { type: "action", name: "tasks.claim", args: { id: "t1" }, local: five } })),
      "/root/children/0/events/onPress/local",
      "limit-exceeded",
    );
    expect(() => action("tasks.claim", { id: "t1" }, { local: [] })).toThrow(TypeError);
    expect(() => action("tasks.claim", { id: "t1" }, { local: five as never })).toThrow(TypeError);
  });

  test("bad_local_write_shapes_and_types_are_rejected", () => {
    rejected(
      errorsOf(button({ onPress: { type: "action", name: "tasks.claim", args: { id: "t1" }, local: [] } })),
      "/root/children/0/events/onPress/local",
      "invalid-prop",
    );
    rejected(
      errorsOf(
        button({
          onPress: {
            type: "action",
            name: "tasks.claim",
            args: { id: "t1" },
            local: [{ key: "expanded", value: true, until: "forever" }],
          },
        }),
      ),
      "/root/children/0/events/onPress/local/0/until",
      "invalid-prop",
    );
    rejected(
      errorsOf(button({ onPress: action("tasks.claim", { id: "t1" }, { local: [local.set("expanded", "yes")] }) })),
      "/root/children/0/events/onPress/local/0/value",
      "invalid-prop",
    );
    rejected(
      errorsOf(field({ onChange: state.set("reason", undefined, { local: [local.set("expanded")] }) })),
      "/root/children/0/events/onChange/local/0/value",
      "invalid-prop",
    );
    rejected(
      errorsOf(field({ onChange: { type: "setLocal", key: "q", until: "revision" } })),
      "/root/children/0/events/onChange/until",
      "invalid-prop",
    );
  });
});

describe("values read from local state (fromLocal)", () => {
  const button = (events: unknown): UiNode =>
    ({ id: "root/b", kind: "button", props: { label: "Go" }, events }) as UiNode;
  const field = (events: unknown): UiNode =>
    ({ id: "root/f", kind: "textField", props: { label: "F" }, events }) as UiNode;
  const press = (name: string, args: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    button({ onPress: { type: "action", name, args, ...extra } });
  const at = "/root/children/0/events/onPress/fromLocal";

  test("from_local_fills_arguments_including_required_ones", () => {
    expect(errorsOf(press("tasks.escalate", { id: "t1" }, { fromLocal: { reason: "q" } }))).toEqual([]);
    expect(errorsOf(button({ onPress: action("tasks.claim", {}, { fromLocal: { id: "q" } }) }))).toEqual([]);
    // Without it the argument is still required.
    rejected(errorsOf(press("tasks.escalate", { id: "t1" })), "/root/children/0/events/onPress/args/reason");
  });

  test("from_local_type_mismatch_is_invalid_prop", () => {
    rejected(
      errorsOf(press("tasks.escalate", { id: "t1" }, { fromLocal: { reason: "count" } })),
      `${at}/reason`,
      "invalid-prop",
    );
    rejected(
      errorsOf(press("tasks.escalate", { id: "t1" }, { fromLocal: { reason: "expanded" } })),
      `${at}/reason`,
      "invalid-prop",
    );
  });

  test("from_local_names_a_declared_key_and_argument", () => {
    rejected(
      errorsOf(press("tasks.escalate", { id: "t1" }, { fromLocal: { reason: "nope" } })),
      `${at}/reason`,
      "unknown-name",
    );
    rejected(
      errorsOf(press("tasks.escalate", { id: "t1" }, { fromLocal: { extra: "q" } })),
      `${at}/extra`,
      "invalid-prop",
    );
  });

  test("from_local_is_bounded_and_not_empty", () => {
    rejected(errorsOf(press("tasks.claim", { id: "t1" }, { fromLocal: {} })), at, "invalid-prop");
    const seventeen = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`a${i}`, "q"]));
    rejected(errorsOf(press("tasks.claim", { id: "t1" }, { fromLocal: seventeen })), at, "limit-exceeded");
    rejected(errorsOf(press("tasks.claim", { id: "t1" }, { fromLocal: [] })), at, "invalid-prop");
  });

  test("argument_filled_twice_is_invalid_prop", () => {
    rejected(
      errorsOf(press("tasks.escalate", { id: "t1", reason: "x" }, { fromLocal: { reason: "q" } })),
      `${at}/reason`,
      "invalid-prop",
    );
    rejected(
      errorsOf(
        field({
          onChange: {
            type: "action",
            name: "tasks.escalate",
            args: { id: "t1" },
            bind: "reason",
            fromLocal: { reason: "q" },
          },
        }),
      ),
      "/root/children/0/events/onChange/fromLocal/reason",
      "invalid-prop",
    );
    // A different argument beside bind is fine.
    expect(
      errorsOf(
        field({
          onChange: { type: "action", name: "tasks.escalate", args: {}, bind: "reason", fromLocal: { id: "q" } },
        }),
      ),
    ).toEqual([]);
  });

  test("set_state_may_read_from_local_under_the_same_rules", () => {
    expect(errorsOf(field({ onChange: state.set("selected", undefined, { fromLocal: "q" }) }))).toEqual([]);
    const set = (event: Record<string, unknown>) => errorsOf(field({ onChange: { type: "setState", ...event } }));
    const where = "/root/children/0/events/onChange/fromLocal";
    rejected(set({ key: "selected", fromLocal: "count" }), where, "invalid-prop");
    rejected(set({ key: "selected", fromLocal: "nope" }), where, "unknown-name");
    rejected(set({ key: "selected", value: "x", fromLocal: "q" }), where, "invalid-prop");
    rejected(set({ key: "selected", fromLocal: "" }), where);
  });

  test("render_checks_from_local_and_the_sdk_refuses_malformed_options", () => {
    const Stack = primitive<{ readonly children?: unknown }>("stack");
    const Button = primitive<{ readonly label: string; readonly onPress?: unknown }>("button");
    const options = { validator, surfaceId: "s", revision: 0 };
    const good = () => (
      <Stack>
        <Button label="Go" onPress={action("tasks.escalate", { id: "t1" }, { fromLocal: { reason: "q" } })} />
      </Stack>
    );
    expect(render(good, inputs, options).ok).toBe(true);
    const bad = () => (
      <Stack>
        <Button label="Go" onPress={action("tasks.escalate", { id: "t1" }, { fromLocal: { reason: "count" } })} />
      </Stack>
    );
    const rendered = render(bad, inputs, options);
    expect(rendered.ok).toBe(false);
    if (!rendered.ok)
      expect(rendered.errors[0]).toMatchObject({
        kind: "invalid-prop",
        pointer: "/root/button/events/onPress/fromLocal/reason",
      });
    expect(() => action("tasks.claim", { id: "t1" }, { fromLocal: {} })).toThrow(TypeError);
    expect(() => action("tasks.claim", { id: "t1" }, { fromLocal: { id: "" } })).toThrow(TypeError);
    expect(() => state.set("selected", "x", { fromLocal: "q" })).toThrow(TypeError);
  });
});

describe("references and child counts under when", () => {
  test("a_referenced_node_may_not_be_gated", () => {
    const field = (target: string): UiNode => ({
      id: "root/f",
      kind: "textField",
      props: { label: "F", describedBy: target },
    });
    const hint = (extra: Partial<UiNode> = {}): UiNode => ({
      id: "root/h",
      kind: "hint",
      props: { text: "H" },
      ...extra,
    });
    expect(errorsOf(field("root/h"), hint())).toEqual([]);
    rejected(errorsOf(field("root/h"), hint({ when: true })), "/root/children/0/props/describedBy", "invalid-prop");
    // An ancestor's `when` hides the node as well.
    const inside: UiNode = {
      id: "root/g",
      kind: "stack",
      props: {},
      when: true,
      children: [{ ...hint(), id: "root/g/h" }],
    };
    rejected(errorsOf(field("root/g/h"), inside), "/root/children/0/props/describedBy", "invalid-prop");
  });

  test("a_when_cannot_push_a_parent_outside_its_child_bounds", () => {
    const item = (id: string, extra: Partial<UiNode> = {}): UiNode => ({
      id: `root/m/${id}`,
      kind: "menuItem",
      props: { label: id },
      ...extra,
    });
    const menu = (...items: UiNode[]): UiNode => ({
      id: "root/m",
      kind: "menu",
      props: { label: "M" },
      children: items,
    });
    expect(errorsOf(menu(item("a"), item("b", { when: true })))).toEqual([]);
    // The only item may be absent, which would leave the menu below its minimum of one.
    rejected(errorsOf(menu(item("a", { when: true }))), "/root/children/0/children", "invalid-children");
  });
});

describe("patches carry when and bind", () => {
  const before = wrap(text());
  const after = wrap(text({ when: ex.gt(local("count"), 1), bind: { text: local("q") } }));
  const next = { ...after, revision: 1 };

  test("diff_detects_bind_change", () => {
    const result = diffTrees(before, next);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ops as unknown).toEqual([
      {
        op: "set",
        id: "root/a",
        kind: "text",
        props: { text: "x" },
        when: ex.gt(local("count"), 1),
        bind: { text: local("q") },
      },
    ]);
    const changed = {
      ...next,
      revision: 2,
      root: { ...next.root, children: [text({ ...next.root.children?.[0], bind: { text: local("expanded") } })] },
    };
    const second = diffTrees(next, changed as UiTree);
    expect(second.ok && second.value.ops.length).toBe(1);
    // Equal expressions in another key order are no change.
    const reordered = { ...next, revision: 2 };
    const same = diffTrees(next, reordered);
    expect(same.ok && same.value.ops).toEqual([]);
  });

  test("patch_set_replaces_when_and_bind", () => {
    const patch = diffTrees(before, next);
    if (!patch.ok) throw new Error("diff failed");
    const applied = applyPatch(before, patch.value);
    expect(applied.ok && applied.value).toEqual(next);
    // A set without them removes them again.
    const back = diffTrees(next, { ...before, revision: 2 });
    if (!back.ok) throw new Error("diff failed");
    const restored = applyPatch(next, back.value);
    expect(restored.ok && restored.value.root.children?.[0]).toEqual(text());
    expect(back.value.ops[0]).not.toHaveProperty("when");
  });

  test("patch_transport_checks_the_new_fields", () => {
    const doc = (op: Record<string, unknown>) => ({
      format: "liveframe/tree-patch/1",
      catalogId: catalog.catalogId,
      surfaceId: "s",
      base: 0,
      revision: 1,
      ops: [op],
    });
    expect(validateTreePatch(doc({ op: "set", id: "root/a", kind: "text", props: {}, when: true, bind: {} })).ok).toBe(
      true,
    );
    expect(validateTreePatch(doc({ op: "set", id: "root/a", kind: "text", props: {}, bind: [] })).ok).toBe(false);
    expect(validateTreePatch(doc({ op: "set", id: "root/a", kind: "text", props: {}, whenever: 1 })).ok).toBe(false);
  });
});

describe("authoring with the SDK", () => {
  const Text = primitive<{
    readonly text: string;
    readonly when?: unknown;
    readonly bind?: Readonly<Record<string, unknown>>;
  }>("text");
  const Stack = primitive<{ readonly children?: unknown }>("stack");
  const options = { validator, surfaceId: "s", revision: 0 };

  test("when_and_bind_are_lifted_into_node_fields", () => {
    const widget = () => (
      <Stack>
        <Text text="x" when={ex.eq(local("q"), "a")} bind={{ text: local("q") }} />
      </Stack>
    );
    const result = render(widget, inputs, options);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const node = result.value.root.children?.[0] as UiNode;
    expect(node.when).toEqual({ $eq: [{ $path: "local.q" }, "a"] });
    expect(node.bind).toEqual({ text: { $path: "local.q" } });
    expect(node.props).toEqual({ text: "x" });
    expect(validator.validateTree(result.value).ok).toBe(true);
  });

  test("render_checks_the_expressions_like_the_validator", () => {
    const widget = () => (
      <Stack>
        <Text text="x" when={{ $path: "data.rows" }} />
      </Stack>
    );
    const result = render(widget, inputs, options);
    expect(result.ok).toBe(false);
    if (!result.ok) rejected(result.errors, "/root/text/when/$path");
    const loose = () => (
      <Stack>
        <Text text="x" when={(() => true) as never} />
      </Stack>
    );
    const functional = render(loose, inputs, options);
    expect(functional.ok).toBe(false);
  });

  test("the_byte_budget_counts_when_and_bind_exactly", () => {
    const widget = () => (
      <Stack>
        <Text text="x" when={ex.gt(local("count"), 0)} bind={{ text: local("q") }} />
      </Stack>
    );
    const result = render(widget, inputs, options);
    if (!result.ok) throw new Error("render failed");
    const bytes = new TextEncoder().encode(JSON.stringify(result.value)).length;
    expect(render(widget, inputs, { ...options, limits: { bytes } }).ok).toBe(true);
    expect(render(widget, inputs, { ...options, limits: { bytes: bytes - 1 } }).ok).toBe(false);
  });

  test("render_checks_child_counts_and_references_under_when", () => {
    const Menu = primitive<{ readonly label: string; readonly children?: unknown }>("menu");
    const Item = primitive<{ readonly label: string; readonly when?: unknown }>("menuItem");
    const gated = () => (
      <Stack>
        <Menu label="M">
          <Item label="a" when={true} />
        </Menu>
      </Stack>
    );
    const result = render(gated, inputs, options);
    expect(result.ok).toBe(false);
    if (!result.ok) rejected(result.errors, "/root/menu", "invalid-children");
    const Field = primitive<{ readonly label: string; readonly describedBy?: unknown }>("textField");
    const Hint = primitive<{ readonly text: string; readonly when?: unknown }>("hint");
    const dangling = () => (
      <Stack>
        <Field label="F" describedBy="root/h" />
        <Hint key="h" text="H" when={true} />
      </Stack>
    );
    const second = render(dangling, inputs, options);
    expect(second.ok).toBe(false);
  });

  test("ex_builds_the_documented_operators", () => {
    expect(ex.cond(ex.has(local("q")), ex.len(local("q")), 0)).toEqual({
      $cond: [{ $has: { $path: "local.q" } }, { $len: { $path: "local.q" } }, 0],
    });
    expect(ex.slice("abc", 1)).toEqual({ $slice: ["abc", 1] });
    expect(ex.round(1.234, 1)).toEqual({ $round: [1.234, 1] });
    expect(ex.lit({ a: 1 })).toEqual({ $lit: { a: 1 } });
    expect(Object.isFrozen(ex.eq(1, 2))).toBe(true);
    expect(local.set("q", "a")).toEqual({ type: "setLocal", key: "q", value: "a" });
    expect(() => local.set("")).toThrow(TypeError);
    expect(() => local.set("q", (() => 1) as never)).toThrow(TypeError);
  });
});

describe("templates with when and bind", () => {
  const installedContext = { catalog, capabilities, manifest } as never;
  const template: Template = {
    format: "liveframe-template/1",
    root: {
      kind: "stack",
      children: [
        {
          $each: { in: ["decisions", "tasks"], as: "row", key: { $path: "row" } },
          kind: "text",
          props: { text: "fixed" },
          when: { $contains: [{ $embed: { $path: "row" } }, { $path: "local.q" }] },
          bind: { text: { $concat: [{ $path: "self.text" }, { $path: "local.q" }] } },
        },
      ],
    },
  } as unknown as Template;

  test("install_checks_when_and_bind_against_the_manifest", () => {
    const installed = (root: unknown) =>
      validateTemplate({ format: "liveframe-template/1", root } as never, installedContext);
    const text = (extra: Record<string, unknown>) => ({
      kind: "stack",
      children: [{ kind: "text", props: { text: "x" }, ...extra }],
    });
    expect(installed(text({ when: { $path: "local.expanded" } })).ok).toBe(true);
    const bad = installed(text({ when: { $path: "data.rows" } }));
    expect(bad.ok).toBe(false);
    expect(installed(text({ bind: { nope: 1 } })).ok).toBe(false);
    expect(installed(text({ bind: { text: { $path: "local.count" } } })).ok).toBe(false);
    // `$embed` operands are template expressions; they must exist, and `$embed` is not a template operator.
    expect(installed(text({ when: { $contains: [{ $embed: { $path: "state.filter" } }, "a"] } })).ok).toBe(true);
    expect(installed(text({ when: { $contains: [{ $embed: { $path: "state.nope" } }, "a"] } })).ok).toBe(false);
    expect(installed(text({ props: { text: { $embed: "x" } } })).ok).toBe(false);
  });

  test("expansion_copies_the_expressions_and_embeds_values_as_literals", () => {
    const result = renderTemplate(template, inputs, { validator, surfaceId: "s", revision: 0 });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const node = result.value.root.children?.[0] as UiNode;
    expect(node.when).toEqual({ $contains: [{ $lit: "decisions" }, { $path: "local.q" }] });
    expect(node.bind).toEqual({ text: { $concat: [{ $path: "self.text" }, { $path: "local.q" }] } });
    expect(validator.validateTree(result.value).ok).toBe(true);
  });

  test("a_template_can_write_local_state", () => {
    const writer: Template = {
      format: "liveframe-template/1",
      root: { kind: "textField", props: { label: "F" }, events: { onChange: { type: "setLocal", key: "q" } } },
    } as unknown as Template;
    expect(validateTemplate(writer, installedContext).ok).toBe(true);
    const bad = { ...writer, root: { ...writer.root, events: { onChange: { type: "setLocal", key: "nope" } } } };
    expect(validateTemplate(bad as never, installedContext).ok).toBe(false);
    const result = renderTemplate(writer, inputs, { validator, surfaceId: "s", revision: 0 });
    expect(result.ok && result.value.root.events).toEqual({ onChange: { type: "setLocal", key: "q" } });

    const compound: Template = {
      format: "liveframe-template/1",
      root: {
        kind: "button",
        props: { label: "Save" },
        events: {
          onPress: {
            type: "action",
            name: "tasks.claim",
            args: { id: { $path: "state.selected" } },
            local: [{ key: "expanded", value: { $eq: [{ $path: "state.filter" }, "all"] }, until: "revision" }],
          },
        },
      },
    } as unknown as Template;
    expect(validateTemplate(compound, installedContext).ok).toBe(true);
    const expanded = renderTemplate(compound, inputs, { validator, surfaceId: "s", revision: 0 });
    expect(expanded.ok && expanded.value.root.events).toEqual({
      onPress: {
        type: "action",
        name: "tasks.claim",
        args: { id: "task-0" },
        local: [{ key: "expanded", value: true, until: "revision" }],
      },
    });
  });
  test("a_template_intent_can_read_local_state", () => {
    const press = (intent: Record<string, unknown>): Template =>
      ({
        format: "liveframe-template/1",
        root: { kind: "button", props: { label: "Go" }, events: { onPress: intent } },
      }) as unknown as Template;
    const escalate = { type: "action", name: "tasks.escalate", args: { id: { $path: "state.selected" } } };
    const good = press({ ...escalate, fromLocal: { reason: "q" } });
    expect(validateTemplate(good, installedContext).ok).toBe(true);
    const expanded = renderTemplate(good, inputs, { validator, surfaceId: "s", revision: 0 });
    expect(expanded.ok && expanded.value.root.events).toEqual({
      onPress: { type: "action", name: "tasks.escalate", args: { id: "task-0" }, fromLocal: { reason: "q" } },
    });
    expect(expanded.ok && validator.validateTree(expanded.value).ok).toBe(true);
    for (const [bad, kind] of [
      [press({ ...escalate, fromLocal: { reason: "count" } }), "invalid-prop"],
      [press({ ...escalate, fromLocal: { reason: "nope" } }), "unknown-name"],
      [press({ ...escalate, fromLocal: { extra: "q" } }), "invalid-prop"],
      [press({ ...escalate, args: { id: "a", reason: "b" }, fromLocal: { reason: "q" } }), "invalid-prop"],
    ] as const) {
      const result = validateTemplate(bad, installedContext);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors[0]).toMatchObject({ kind });
    }
    const set = press({ type: "setState", key: "selected", fromLocal: "q" });
    expect(validateTemplate(set, installedContext).ok).toBe(true);
    const rendered = renderTemplate(set, inputs, { validator, surfaceId: "s", revision: 0 });
    expect(rendered.ok && rendered.value.root.events).toEqual({
      onPress: { type: "setState", key: "selected", fromLocal: "q" },
    });
    const both = press({ type: "setState", key: "selected", value: "x", fromLocal: "q" });
    expect(validateTemplate(both, installedContext).ok).toBe(false);
  });
});
