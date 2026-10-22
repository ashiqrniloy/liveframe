/** @jsxImportSource @arnilo/liveframe/sdk */
import { describe, expect, test } from "bun:test";
import { action, primitive, state } from "@arnilo/liveframe/sdk";
import { isElement } from "../sdk/element.ts";
import { jsxDEV } from "../sdk/jsx-dev-runtime.ts";
import { Fragment } from "../sdk/jsx-runtime.ts";

const Button = primitive<{ readonly label: string; readonly children?: unknown }>("button");
const calls = { composed: 0 };

function TaskCard({ label }: { readonly label: string }) {
  calls.composed++;
  return <Button label={label} />;
}

describe("sdk jsx runtime", () => {
  test("elements_and_intents_are_frozen", () => {
    const element = (
      <Button key="claim" label="Claim">
        {["one", "two"]}
      </Button>
    );
    const children = element.props.children;

    expect(isElement(element)).toBe(true);
    expect(Object.isFrozen(element)).toBe(true);
    expect(Object.isFrozen(element.props)).toBe(true);
    expect(Array.isArray(children) && Object.isFrozen(children)).toBe(true);
    expect(element.key).toBe("claim");
    expect("key" in element.props).toBe(false);
    expect(element.type).toEqual({ kind: "button" });
    expect(Object.isFrozen(element.type)).toBe(true);

    const set = state.set("filter", "mine");
    const act = action("tasks.claim", { id: "t1", nested: [{ reason: "me" }] }, { bind: "id" });
    expect(Object.isFrozen(set)).toBe(true);
    expect(Object.isFrozen(act)).toBe(true);
    expect(Object.isFrozen(act.args)).toBe(true);
    expect(Object.isFrozen(act.args.nested)).toBe(true);
    expect(Object.isFrozen((act.args.nested as readonly unknown[])[0])).toBe(true);
    expect(act.bind).toBe("id");

    expect(() => {
      (element as unknown as { key: unknown }).key = "other";
    }).toThrow();
    expect(() => {
      (set as unknown as { key: string }).key = "other";
    }).toThrow();
  });

  test("intent_helpers_reject_non_json", () => {
    expect(() => state.set("k", (() => 1) as never)).toThrow(/k/);
    expect(() => state.set("k", { nested: Number.POSITIVE_INFINITY } as never)).toThrow(/k/);
    expect(() => action("a", { x: new Date() as never })).toThrow(/x/);
    expect(() => action("a", { x: Number.NaN })).toThrow(/x/);
    expect(() => action("a", { x: Promise.resolve(1) as never })).toThrow(/x/);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => action("a", { x: cyclic as never })).toThrow(/x/);
    expect(() => action("")).toThrow(TypeError);
  });

  test("jsx_does_not_call_components", () => {
    const element = <TaskCard label="Claim" />;

    expect(calls.composed).toBe(0);
    expect(element.type).toBe(TaskCard);
    expect(isElement(element)).toBe(true);
  });

  test("primitive_tags_record_kind_and_call_through", () => {
    expect(Object.isFrozen(Button)).toBe(true);
    expect(Object.isFrozen(state)).toBe(true);
    expect(isElement(<Button label="A" />)).toBe(true);
    expect(isElement(Button({ label: "A" }))).toBe(true);
    expect(Button({ label: "A" }).type).toEqual({ kind: "button" });

    const fragment = (
      <>
        <Button label="A" />
        <Button label="B" />
      </>
    );
    expect(fragment.type).toBe(Fragment);
    expect(Array.isArray(fragment.props.children)).toBe(true);
  });

  test("jsx_dev_runtime_matches_jsx", () => {
    const element = jsxDEV(Button, { label: "A", children: "B" }, "k", true);
    expect(isElement(element)).toBe(true);
    expect(element.key).toBe("k");
    expect(element.staticChildren).toBe(true);
    expect(element.type).toEqual({ kind: "button" });
  });
});
