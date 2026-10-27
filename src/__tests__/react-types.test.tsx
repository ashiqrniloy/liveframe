import { expect, test } from "bun:test";
import { Component } from "react";
import { type Definition, defineComponent, type Json, obj, str } from "../index.ts";
import { type Implementation, type ImplementationProps, implement } from "../react/index.ts";

const field = defineComponent({
  kind: "field",
  description: "A field.",
  props: obj({ label: str({ maxLength: 80 }) }, { hint: str({ maxLength: 80 }) }),
  children: "none",
  variants: ["default"],
  defaultVariant: "default",
  slots: ["root", "label"],
  events: {
    onPress: { carries: "none", description: "Pressed." },
    onChange: { carries: "string", description: "Changed." },
    onToggle: { carries: "boolean", description: "Toggled." },
    onNumber: { carries: "number", description: "Number." },
    onInteger: { carries: "integer", description: "Integer." },
  },
  styleProps: [],
  a11y: { role: "textbox", name: "label" },
});

class Field extends Component<ImplementationProps<typeof field>> {
  render() {
    return <span>{this.props.props.label}</span>;
  }
}

test("implement_types_follow_const_definitions", () => {
  const binding: Implementation = implement(field, ({ props, slot, emit, style, children, items, portal }) => {
    const label: string = props.label;
    const hint: string | undefined = props.hint;
    slot("root");
    slot("label");
    emit("onPress");
    emit("onChange", "value");
    emit("onToggle", true);
    emit("onNumber", 1.5);
    emit("onInteger", 2);
    // @ts-expect-error numeric event requires a number
    emit("onNumber", "2");
    // @ts-expect-error numeric event requires its value
    emit("onNumber");
    // @ts-expect-error integer event requires a number
    emit("onInteger", true);
    // @ts-expect-error integer event requires its value
    emit("onInteger");
    // @ts-expect-error label is a string
    const wrong: boolean = props.label;
    // @ts-expect-error no undeclared props
    props.missing;
    // @ts-expect-error no undeclared slots
    slot("missing");
    // @ts-expect-error no undeclared events
    emit("onMissing");
    // @ts-expect-error string event rejects boolean
    emit("onChange", true);
    // @ts-expect-error string event requires its value
    emit("onChange");
    // @ts-expect-error boolean event rejects string
    emit("onToggle", "true");
    // @ts-expect-error carries none accepts no value
    emit("onPress", "value");
    void [hint, wrong, items, portal];
    return (
      <div className={slot("root")} style={style}>
        {label}
        {children}
      </div>
    );
  });
  expect(binding).toBeDefined();
  // @ts-expect-error a component cannot override the schema's prop type through inference
  implement(field, ({ props }: { props: { label: number } }) => <div>{props.label}</div>);
  // @ts-expect-error bindings cannot be constructed by hosts
  const forged: Implementation = {};
  void forged;
});

test("json_definitions_use_json_props_and_allow_explicit_narrowing", () => {
  const loaded: Definition = field;
  const binding = implement(loaded, ({ props, slot, emit }) => {
    const json: Record<string, Json> = props;
    slot("anySlot");
    emit("onAnyEvent", "value");
    emit("onAnyEvent", true);
    emit("onAnyEvent", 2);
    emit("onAnyEvent");
    // @ts-expect-error loaded props do not guarantee a string
    const label: string = props.label;
    void [json, label];
    return null;
  });
  expect(implement(field, Field)).toBeDefined();
  expect(implement<Definition, { label: string }>(loaded, ({ props }) => <span>{props.label}</span>)).toBeDefined();
  expect(binding).toBeDefined();
});
