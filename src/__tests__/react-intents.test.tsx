import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { checkOffered, type IntentOrigin, type Intent, type UiNode } from "../index.ts";
import type { ImplementationProps } from "../react/index.ts";
import { createRenderer, implement } from "../react/index.ts";
import * as numeric from "./fixtures/numeric-events.ts";
import { renderer, surfaceProps, withRoot } from "./fixtures/react-surface.tsx";
import { confirmationValidator } from "./fixtures/confirmation.tsx";

test("events_metadata_reaches_nested_and_collection_nodes", () => {
  const contexts = new Map<string, ImplementationProps>();
  const { Surface } = renderer((kind, props) => contexts.set(kind, props));
  renderToString(
    <Surface
      {...surfaceProps}
      validator={confirmationValidator}
      tree={withRoot({
        id: "root",
        kind: "stack",
        props: {},
        children: [
          {
            id: "root/menu",
            kind: "menu",
            props: { label: "Menu" },
            children: [
              {
                id: "root/menu/item",
                kind: "menuItem",
                props: { label: "Escalate" },
                events: { onPress: { type: "action", name: "tasks.escalate", args: { id: "t1", reason: "review" } } },
              },
            ],
          },
          {
            id: "root/button",
            kind: "button",
            props: { label: "Claim" },
            events: { onPress: { type: "action", name: "tasks.claim", args: { id: "t1" } } },
          },
          {
            id: "root/field",
            kind: "textField",
            props: { label: "Reason" },
            events: { onCommit: { type: "setState", key: "reason" } },
          },
        ],
      })}
    />,
  );
  const root = contexts.get("stack");
  expect(root?.events).toEqual({});
  const item = root?.items[0]?.items[0];
  expect(item?.events).toEqual({ onPress: { type: "action", confirm: true, irreversible: true } });
  expect(contexts.get("menuItem")?.events).toBe(item?.events);
  expect(contexts.get("button")?.events).toEqual({ onPress: { type: "action", confirm: false, irreversible: true } });
  expect(contexts.get("textField")?.events).toEqual({
    onCommit: { type: "setState", confirm: false, irreversible: false },
  });
  expect(Object.isFrozen(item?.events)).toBe(true);
  expect(Object.isFrozen(item?.events.onPress)).toBe(true);
});

test("emit_rejects_nan_infinity_and_fraction_for_integer", () => {
  for (const event of ["onNumber", "onInteger"]) {
    let context: ImplementationProps | undefined;
    const intents: Intent[] = [];
    const { Surface } = createRenderer({
      catalog: numeric.catalog,
      implementations: numeric.catalog.definitions.map((definition) =>
        implement(definition, (input) => {
          context = input;
          return null;
        }),
      ),
    });
    const tree = numeric.numericTree(event, { type: "action", name: "numbers.commit", args: {}, bind: "value" });
    renderToString(
      <Surface
        {...surfaceProps}
        validator={numeric.validator}
        tree={tree}
        onIntent={(intent) => intents.push(intent)}
      />,
    );
    if (!context) throw new Error("Missing numeric context");
    for (const invalid of [undefined, "2", true, NaN, Infinity, -Infinity, ...(event === "onInteger" ? [1.5] : [])]) {
      expect(() => context?.emit(event, invalid)).toThrow("Invalid event value");
      expect(intents).toEqual([]);
    }
    for (const value of [0, -2, 3, ...(event === "onNumber" ? [1.5] : [])]) {
      context.emit(event, value);
      expect(intents.at(-1)).toEqual({ type: "action", name: "numbers.commit", args: { value } });
    }
  }
});

test("numeric_set_state_takes_the_event_value", () => {
  let context: ImplementationProps | undefined;
  const intents: Intent[] = [];
  const { Surface } = createRenderer({
    catalog: numeric.catalog,
    implementations: numeric.catalog.definitions.map((definition) =>
      implement(definition, (input) => {
        context = input;
        return null;
      }),
    ),
  });
  const tree = numeric.numericTree("onInteger", { type: "setState", key: "number" });
  renderToString(
    <Surface {...surfaceProps} validator={numeric.validator} tree={tree} onIntent={(intent) => intents.push(intent)} />,
  );
  if (!context) throw new Error("Missing numeric context");
  context.emit("onInteger", 0);
  expect(intents).toEqual([{ type: "setState", key: "number", value: 0 }]);
});

function mount(node: UiNode) {
  const contexts = new Map<string, ImplementationProps>();
  const intents: Intent[] = [];
  const origins: IntentOrigin[] = [];
  const { Surface } = renderer((kind, props) => contexts.set(kind, props));
  const input = withRoot(node);
  expect(surfaceProps.validator.validateTree(input).ok).toBe(true);
  renderToString(
    <Surface
      {...surfaceProps}
      tree={input}
      onIntent={(intent, origin) => {
        intents.push(intent);
        origins.push(origin);
        if (!(intent.type === "action" && intent.args.reason === ""))
          expect(checkOffered(input, origin, intent, surfaceProps.validator).ok).toBe(true);
      }}
    />,
  );
  const context = contexts.get(node.kind);
  if (!context) throw new Error("Missing node context");
  return { context, intents, origins, input };
}

function field(intent: Intent): UiNode {
  return { id: "root", kind: "textField", props: { label: "Reason" }, events: { onCommit: intent } };
}

test("set_state_without_value_takes_the_event_value", () => {
  const { context, intents } = mount(field({ type: "setState", key: "reason" }));
  context.emit("onCommit", "blocked on review");
  expect(intents).toEqual([{ type: "setState", key: "reason", value: "blocked on review" }]);
});

test("explicit_state_values_are_preserved", () => {
  for (const value of ["", "fixed"]) {
    const intent: Intent = { type: "setState", key: "reason", value };
    const { context, intents } = mount(field(intent));
    context.emit("onCommit", "ignored");
    expect(intents).toEqual([intent]);
  }
});

test("action_bind_fills_the_named_argument", () => {
  const intent: Intent = { type: "action", name: "tasks.escalate", args: { id: "t-1" }, bind: "reason" };
  const { context, intents } = mount(field(intent));
  context.emit("onCommit", "blocked on review");
  expect(intents).toEqual([
    { type: "action", name: "tasks.escalate", args: { id: "t-1", reason: "blocked on review" } },
  ]);
  expect(intent).toEqual({ type: "action", name: "tasks.escalate", args: { id: "t-1" }, bind: "reason" });
});

test("undeclared_event_raises_nothing", () => {
  const { context, intents } = mount(field({ type: "setState", key: "reason" }));
  context.emit("onChange", "local typing");
  context.emit("unknown", true);
  expect(intents).toEqual([]);
});

test("wrong_carries_type_throws_and_raises_nothing", () => {
  for (const [kind, event, value] of [
    ["button", "onPress", "unexpected"],
    ["textField", "onCommit", true],
    ["checkbox", "onChange", "unexpected"],
  ] as const) {
    const { context, intents } = mount({
      id: "root",
      kind,
      props: { label: "Control" },
      events: { [event]: { type: "setState", key: "reason", value: "fixed" } },
    });
    expect(() => context.emit(event, value)).toThrow("Invalid event value");
    if (kind !== "button") expect(() => context.emit(event)).toThrow("Invalid event value");
    expect(intents).toEqual([]);
    context.emit(event, kind === "button" ? undefined : kind === "checkbox" ? false : "valid");
    expect(intents).toEqual([{ type: "setState", key: "reason", value: "fixed" }]);
  }
});

test("item_emit_raises_the_item_intent", () => {
  const intent: Intent = { type: "action", name: "tasks.claim", args: { id: "t-1" } };
  const { context, intents } = mount({
    id: "root",
    kind: "menu",
    props: { label: "Menu" },
    children: [{ id: "root/item", kind: "menuItem", props: { label: "Claim" }, events: { onPress: intent } }],
  });
  context.items[0]?.emit("onPress");
  expect(intents).toEqual([intent]);
});

test("intent_objects_are_fresh_and_frozen", () => {
  const intent: Intent = {
    type: "setState",
    key: "cursors",
    value: { decisions: "start", tasks: "start", alerts: "start" },
  };
  const { context, intents } = mount(field(intent));
  context.emit("onCommit", "ignored");
  context.emit("onCommit", "ignored");
  expect(intents).toEqual([intent, intent]);
  expect(intents[0]).not.toBe(intent);
  expect(intents[0]).not.toBe(intents[1]);
  expect(Object.isFrozen(intents[0])).toBe(true);
  const delivered = intents[0];
  if (delivered?.type !== "setState") throw new Error("Missing state intent");
  expect(delivered.value).not.toBe(intent.value);
  expect(Object.isFrozen(delivered.value)).toBe(true);
  expect(Reflect.set(delivered.value as object, "tasks", "changed")).toBe(false);
  expect(Object.isFrozen(intent.value)).toBe(false);
  expect(intent.value).toEqual({ decisions: "start", tasks: "start", alerts: "start" });

  const action = mount(field({ type: "action", name: "tasks.escalate", args: { id: "t-1" }, bind: "reason" }));
  action.context.emit("onCommit", "reason");
  const raised = action.intents[0];
  if (raised?.type !== "action") throw new Error("Missing action intent");
  expect(Object.isFrozen(raised.args)).toBe(true);
});

test("host_must_recheck_filled_arguments", () => {
  const { context, intents } = mount(
    field({
      type: "action",
      name: "tasks.escalate",
      args: { id: "t-1" },
      bind: "reason",
    }),
  );
  // Carries checks the type; the host must reject the empty reason against its capability schema.
  context.emit("onCommit", "");
  expect(intents).toEqual([{ type: "action", name: "tasks.escalate", args: { id: "t-1", reason: "" } }]);
  expect(surfaceProps.validator.validateTree(withRoot(field(intents[0] as Intent))).ok).toBe(false);
});

test("origin_for_nested_and_collection_nodes", () => {
  const { context, origins, input, intents } = mount({
    id: "root",
    kind: "stack",
    props: {},
    children: [
      {
        id: "root/menu",
        kind: "menu",
        props: { label: "Menu" },
        children: [
          {
            id: "root/menu/item",
            kind: "menuItem",
            props: { label: "Claim" },
            events: { onPress: { type: "action", name: "tasks.claim", args: { id: "t1" } } },
          },
        ],
      },
    ],
  });
  context.items[0]?.items[0]?.emit("onPress");
  expect(origins).toEqual([
    { surfaceId: input.surfaceId, revision: input.revision, nodeId: "root/menu/item", event: "onPress" },
  ]);
  expect(intents).toHaveLength(1);
});
