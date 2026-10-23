import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import type { Intent, UiNode } from "../index.ts";
import type { ImplementationProps } from "../react/index.ts";
import { renderer, surfaceProps, withRoot } from "./fixtures/react-surface.tsx";

function mount(node: UiNode) {
  const contexts = new Map<string, ImplementationProps>();
  const intents: Intent[] = [];
  const { Surface } = renderer((kind, props) => contexts.set(kind, props));
  const input = withRoot(node);
  expect(surfaceProps.validator.validateTree(input).ok).toBe(true);
  renderToString(<Surface {...surfaceProps} tree={input} onIntent={(intent) => intents.push(intent)} />);
  const context = contexts.get(node.kind);
  if (!context) throw new Error("Missing node context");
  return { context, intents };
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
