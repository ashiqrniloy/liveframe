import { expect, test } from "bun:test";
import { definitions } from "../catalog/definitions.ts";
import { WidgetError } from "../runtime/errors.ts";
import { Button, Stack, Text, TextField } from "../runtime/index.ts";
import { action, state } from "../runtime/intents.ts";
import { jsxDEV } from "../runtime/jsx-dev-runtime.ts";
import { Fragment, jsx, jsxs } from "../runtime/jsx-runtime.ts";
import { render } from "../runtime/render.ts";
import type { RenderOptions, UiTree } from "../runtime/types.ts";
import { validate } from "../runtime/validate.ts";

export const options: RenderOptions = {
  catalog: { catalogId: "proof@1", definitions },
  actions: ["tasks.open"],
  state: {
    type: "object",
    properties: { selected: { type: "string", maxLength: 128 }, count: { type: "integer", minimum: 0, maximum: 10 } },
    required: ["selected"],
    additionalProperties: false,
  },
};
export const inputs = { params: {}, state: { selected: "a" }, data: {}, context: { size: "full" } };

function tree(element: unknown, config = options): UiTree {
  const result = render(() => element, inputs, config);
  if (result instanceof WidgetError) throw result;
  return result;
}

function error(element: unknown, kind: WidgetError["kind"], config = options): void {
  const result = render(() => element, inputs, config);
  expect(result).toBeInstanceOf(WidgetError);
  expect((result as WidgetError).kind).toBe(kind);
  expect((result as WidgetError).path).toBeTruthy();
}

const Card = ({ label }: { label: string }) =>
  jsxs(Stack, { children: [jsx(Text, { text: label }), jsx(Button, { label: "Open" })] });
const Recursive = (): unknown => jsx(Recursive, {});

test("ids_are_key_paths_and_stable_across_an_insert", () => {
  const rows = (ids: string[]) => jsx(Stack, { children: ids.map((id) => jsx(Button, { label: id }, id)) });
  const before = tree(rows(["a", "b"]));
  const after = tree(rows(["new", "a", "b"]));
  expect(before.root.children?.map((node) => node.id)).toEqual(["root/a", "root/b"]);
  expect(after.root.children?.slice(1)).toEqual([...(before.root.children ?? [])]);
  const escaped = tree(rows(["a/b", "a%2Fb"]));
  expect(escaped.root.children?.map((node) => node.id)).toEqual(["root/a%2Fb", "root/a%252Fb"]);
});

test("rejects_host_elements_function_props_async_and_missing_keys", () => {
  error(jsx("div", {}), "host-element");
  error(jsx({}, {}), "unknown-component");
  error(jsx(Button, { label: "x", onPress: () => {} }), "function-prop");
  error(jsx(Text, { text: Promise.resolve("x") }), "async-render");
  error(jsx(Stack, { children: [jsx(Button, { label: "x" })] }), "missing-key");
  error(
    jsx(Stack, { children: [jsx(Button, { label: "a" }, "same"), jsx(Button, { label: "b" }, "same")] }),
    "duplicate-key",
  );
  expect((render(async () => jsx(Stack, {}), inputs, options) as WidgetError).kind).toBe("async-render");
  expect(
    (
      render(
        async () => {
          throw new Error("async boom");
        },
        inputs,
        options,
      ) as WidgetError
    ).kind,
  ).toBe("async-render");
  expect(
    (
      render(
        () => {
          throw new Error("boom");
        },
        inputs,
        options,
      ) as WidgetError
    ).kind,
  ).toBe("render-failed");
});

test("compositions_fragments_and_static_children_keep_key_scopes", () => {
  const result = tree(jsx(Stack, { children: [jsx(Card, { label: "A" }, "a"), jsx(Card, { label: "B" }, "b")] }));
  expect(result.root.children?.[0]?.children?.[1]?.id).toBe("root/a/button");
  expect(result.root.children?.[1]?.children?.[1]?.id).toBe("root/b/button");
  const group = (key: string) => jsx(Fragment, { children: jsx(Text, { text: key }) }, key);
  expect(tree(jsx(Stack, { children: [group("a"), group("b")] })).root.children?.map((n) => n.id)).toEqual([
    "root/a/text",
    "root/b/text",
  ]);
  expect(tree(jsx(Fragment, { children: jsx(Stack, {}) })).root.kind).toBe("stack");
  error(jsxs(Fragment, { children: [jsx(Text, { text: "a" }), jsx(Button, { label: "b" })] }), "invalid-children");
  error(jsxs(Stack, { children: [jsx(Text, { text: "a" }), jsx(Text, { text: "b" })] }), "missing-key");
  error(jsx(Stack, { children: "raw text" }), "invalid-children");
  error(
    jsx(async () => jsx(Stack, {}), {}),
    "async-render",
  );
  error(jsx(Recursive, {}), "limit-exceeded");
});

test("intents_are_frozen_wire_data_and_declared", () => {
  expect(state.set("selected")).toEqual({ type: "setState", key: "selected" });
  expect(state.set("selected", null)).toEqual({ type: "setState", key: "selected", value: null });
  const intent = action("tasks.open", { nested: { id: "a" } });
  expect(Object.isFrozen(intent)).toBe(true);
  expect(Object.isFrozen(intent.args.nested)).toBe(true);
  expect(tree(jsx(Button, { label: "Open", onPress: intent })).root.events?.onPress).toEqual(intent);
  expect(tree(jsx(TextField, { label: "Selection", onChange: state.set("selected") })).root.events?.onChange).toEqual(
    state.set("selected"),
  );
  error(jsx(Button, { label: "Open", onPress: action("not.declared") }), "undeclared-action");
  error(jsx(Button, { label: "Open", onClick: intent }), "undeclared-event");
  error(jsx(Button, { label: "Open", onPress: state.set("unknown", 1) }), "invalid-prop");
  error(jsx(Button, { label: "Open", onPress: state.set("count", 11) }), "invalid-prop");
  error(jsx(Button, { label: "Open", onPress: state.set("selected") }), "invalid-prop");
  error(jsx(TextField, { label: "Count", onChange: state.set("count") }), "invalid-prop");
  error(jsx(Button, { label: "Open", onPress: [intent, intent] }), "invalid-prop");
});

test("catalog_schemas_children_variants_and_styles_fail_closed", () => {
  for (const props of [
    {},
    { label: 3 },
    { label: "x".repeat(81) },
    { label: "x", disabled: "false" },
    { label: "x", className: "x" },
    { label: "x", style: "color:red" },
    { label: "x", variant: "missing" },
    { label: "x", grow: 101 },
    { label: "x", width: "999%" },
  ])
    error(jsx(Button, props), "invalid-prop");
  error(jsx(Text, { text: "x", children: jsx(Button, { label: "x" }) }), "invalid-children");
  const Menu = { kind: "menu" };
  error(jsx(Menu, { label: "Menu" }), "invalid-children");
  error(jsx(Menu, { label: "Menu", children: jsx(Text, { text: "x" }) }), "invalid-children");
  error(jsx({ kind: "heading" }, { text: "x", level: 1.5 }), "invalid-prop");
  error(jsx({ kind: "link" }, { label: "x", href: "javascript:alert(1)" }), "invalid-prop");
  error(jsx({ kind: "select" }, { label: "x", options: [{ value: "a", label: "a", extra: true }] }), "invalid-prop");
  error(
    jsx({ kind: "select" }, { label: "x", options: Array.from({ length: 101 }, () => ({ value: "a", label: "a" })) }),
    "invalid-prop",
  );
  for (const style of [
    { gap: "13px" },
    { gap: 3 },
    { gap: "space.99" },
    { padding: "red" },
    { columns: ["url(evil)"] },
    { direction: "diagonal" },
  ])
    error(jsx(Stack, style), "invalid-prop");
  expect(tree(jsx(Stack, { gap: "space.3", direction: "horizontal", children: null })).root.style).toEqual({
    gap: "space.3",
    direction: "horizontal",
  });
  expect(tree(jsx({ kind: "grid" }, { columns: ["1fr", "32ch"] })).root.style?.columns).toEqual(["1fr", "32ch"]);
});

test("inputs_and_output_are_deeply_frozen_and_metadata_is_preserved", () => {
  const element = jsx(Stack, {});
  expect(Object.isFrozen(element)).toBe(true);
  expect(Object.isFrozen(element.props)).toBe(true);
  expect(Object.isFrozen(element.type)).toBe(true);
  expect(element.type).toEqual({ kind: "stack" });
  const result = render(
    (props) => {
      expect(Object.isFrozen(props)).toBe(true);
      for (const value of Object.values(props)) expect(Object.isFrozen(value)).toBe(true);
      return jsx(Stack, {});
    },
    inputs,
    { ...options, surfaceId: "queue", revision: 4 },
  );
  expect(result).toMatchObject({ format: "liveframe/1", catalogId: "proof@1", surfaceId: "queue", revision: 4 });
  expect(Object.isFrozen((result as UiTree).root.props)).toBe(true);
  const badInputs = { ...inputs, state: { selected: 42 } };
  expect(render(() => jsx(Stack, {}), badInputs, options)).toBeInstanceOf(WidgetError);
  expect(
    render(() => jsx(Stack, {}), inputs, {
      ...options,
      context: {
        type: "object",
        properties: { size: { type: "string", enum: ["small"] } },
        required: ["size"],
        additionalProperties: false,
      },
    }),
  ).toBeInstanceOf(WidgetError);
});

test("transport_validation_rejects_unknown_fields_ids_and_non_json", () => {
  const good = tree(jsx(Stack, { children: jsx(Text, { text: "hello" }) }));
  expect(validate(JSON.parse(JSON.stringify(good)), options)).toEqual(good);
  for (const mutate of [
    (t: UiTree) => ({ ...t, catalogId: "other@1" }),
    (t: UiTree) => ({ ...t, revision: -1 }),
    (t: UiTree) => ({ ...t, extra: true }),
    (t: UiTree) => ({ ...t, root: { ...t.root, extra: true } }),
    (t: UiTree) => ({ ...t, root: { ...t.root, id: "positional.0" } }),
    (t: UiTree) => ({ ...t, root: { ...t.root, children: [{ ...t.root.children?.[0], id: "root" }] } }),
    (t: UiTree) => ({ ...t, root: { ...t.root, kind: "unknown" } }),
    (t: UiTree) => ({ ...t, root: { ...t.root, props: { hidden: undefined } } }),
    (t: UiTree) => ({ ...t, root: { ...t.root, props: new Date() } }),
    (t: UiTree) => ({ ...t, root: { ...t.root, style: { grow: Number.NaN } } }),
  ])
    expect(validate(mutate(good), options)).toBeInstanceOf(WidgetError);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  error(jsx(Text, { text: cyclic }), "invalid-prop");
  error(jsx(Text, { text: { fn: () => {} } }), "function-prop");
});

test("limits_enforce_node_count_depth_and_utf8_bytes", () => {
  const element = jsx(Stack, { children: [jsx(Text, { text: "hello" }, "a"), jsx(Text, { text: "world" }, "b")] });
  error(element, "limit-exceeded", { ...options, limits: { nodes: 2 } });
  error(element, "limit-exceeded", { ...options, limits: { depth: 1 } });
  const unicode = jsx(Text, { text: "😀".repeat(30) });
  const bytes = new TextEncoder().encode(JSON.stringify(tree(unicode))).length;
  expect(tree(unicode, { ...options, limits: { bytes } }).root.kind).toBe("text");
  error(unicode, "limit-exceeded", { ...options, limits: { bytes: bytes - 1 } });
});

test("default_depth_and_node_limits_have_inclusive_boundaries", () => {
  const nested = (depth: number) => {
    let element = jsx(Text, { text: "leaf" });
    for (let i = 1; i < depth; i++) element = jsx(Stack, { children: element });
    return element;
  };
  expect(tree(nested(64)).root.kind).toBe("stack");
  error(nested(65), "limit-exceeded");
  expect(tree(nested(65), { ...options, limits: { depth: 65 } }).root.kind).toBe("stack");
  error(
    jsx(Stack, { children: Array.from({ length: 5000 }, (_, i) => jsx(Text, { text: "row" }, i)) }),
    "limit-exceeded",
  );
  error(jsx(Stack, {}), "invalid-prop", { ...options, limits: { nodes: 0 } });
});

test("dev_runtime_preserves_static_children_and_rejects_fragment_props", () => {
  expect(
    tree(jsxDEV(Stack, { children: [jsx(Text, { text: "x" }), jsx(Button, { label: "Open" })] }, undefined, true)).root
      .children?.length,
  ).toBe(2);
  error(jsx(Fragment, { onPress: () => {} }), "function-prop");
  error(jsx(Fragment, { style: "raw css" }), "invalid-prop");
  error(
    jsx(() => jsx(Text, { text: "x" }, { invalid: true }), {}),
    "invalid-prop",
  );
});

test("transport_events_styles_and_children_are_closed", () => {
  const good = tree(jsx(Button, { label: "Open", onPress: action("tasks.open") }));
  for (const patch of [
    { children: null },
    { style: { color: "red" } },
    { style: { padding: "space.1" } },
    { events: { onClick: action("tasks.open") } },
    { events: { onPress: { type: "action", name: "tasks.open", args: {}, extra: true } } },
    { events: { onPress: { type: "action", name: "tasks.open", args: [] } } },
    { events: { onPress: { type: "setState", key: "selected", value: "a", extra: true } } },
    { events: { onPress: { type: "other" } } },
    { props: JSON.parse('{"label":"Open","__proto__":null}') },
  ])
    expect(validate({ ...good, root: { ...good.root, ...patch } }, options)).toBeInstanceOf(WidgetError);
  error(jsx(Button, JSON.parse('{"label":"Open","__proto__":null}')), "invalid-prop");
  const sparse = Array(1);
  error(jsx(Text, { text: sparse }), "invalid-prop");
});

test("runtime_sources_use_no_host_api", async () => {
  const files = [...new Bun.Glob("*.ts").scanSync("proof/runtime")];
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const source = await Bun.file(`proof/runtime/${file}`).text();
    expect(source).not.toMatch(
      /\b(?:["'](?:node|bun):|require\s*\(|window\b|document\b|HTMLElement\b|Bun\b|process\b)/,
    );
  }
  const bundle = await Bun.build({ entrypoints: ["proof/runtime/index.ts"], target: "browser" });
  expect(bundle.success).toBe(true);
  expect(await bundle.outputs[0]?.text()).not.toMatch(
    /\b(?:["'](?:node|bun):|require\s*\(|window\b|document\b|HTMLElement\b|Bun\b|process\b)/,
  );
});
