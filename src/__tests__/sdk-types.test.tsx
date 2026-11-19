/** @jsxImportSource @arnilo/liveframe/sdk */
import { describe, expect, test } from "bun:test";
import { action, local, primitive, state, type WidgetProps } from "@arnilo/liveframe/sdk";

const Button = primitive<{
  readonly label: string;
  readonly variant?: "primary" | "ghost";
  readonly onPress?: import("@arnilo/liveframe/sdk").TreeIntent;
}>("button");

type Params = { readonly id: string };
type State = { readonly filter: string };
type Data = { readonly rows: readonly { readonly id: string }[] };
type Context = { readonly size: "sm" | "md" };

function QueueWidget({ state: s, data, context }: WidgetProps<Params, State, Data, Context>) {
  return <Button key={context.size} variant="ghost" label={`${s.filter}: ${data.rows.length}`} />;
}

describe("sdk types", () => {
  test("primitive_tags_type_their_props_and_reject_host_elements", () => {
    const element = QueueWidget({
      params: { id: "q" },
      state: { filter: "all" },
      data: { rows: [] },
      context: { size: "md" },
      actions: {},
    });
    expect(element.type).toEqual({ kind: "button" });

    // @ts-expect-error: host elements are not in the JSX namespace (spec §7.1)
    const host = <div />;
    expect(host.type).toBe("div");

    // @ts-expect-error: props are typed by primitive<Props>
    const wrongProp = <Button label={1} />;
    expect(wrongProp).toBeDefined();

    // @ts-expect-error: the variant is a closed union from the generated module
    const wrongVariant = <Button label="A" variant="huge" />;
    expect(wrongVariant).toBeDefined();
  });

  test("widget_inputs_are_readonly", () => {
    const props: WidgetProps<Params, State, Data, Context> = {
      params: { id: "q" },
      state: { filter: "all" },
      data: { rows: [{ id: "t1" }] },
      context: { size: "md" },
      actions: {},
    };

    // @ts-expect-error: params are readonly
    props.params.id = "other";
    const first = props.data.rows[0];
    if (!first) throw new Error("fixture");
    // @ts-expect-error: nested data is readonly
    first.id = "other";
    expect(props.context.size).toBe("md");
  });

  test("manifest_typed_action_and_state_reject_undeclared_local_keys", () => {
    type Local = { readonly saving: boolean; readonly q: string };
    const valid = (
      <Button
        label="Save"
        onPress={action<Local>(
          "tasks.save",
          { id: "t1" },
          { local: [local.set("saving", true, { until: "revision" })] },
        )}
      />
    );
    const validState = state.set<Local>("filter", "all", { local: [local.set("q", "abc")] });
    expect([valid, validState]).toHaveLength(2);

    // @ts-expect-error: undeclared local key fails when manifest local state is typed
    const badActionKey = action<Local>("tasks.save", {}, { local: [local.set("missing", true)] });
    // @ts-expect-error: wrong local value type fails when manifest local state is typed
    const badActionType = action<Local>("tasks.save", {}, { local: [local.set("saving", "yes")] });
    // @ts-expect-error: undeclared local key fails on state.set as well
    const badStateKey = state.set<Local>("filter", "all", { local: [local.set("missing", true)] });
    // @ts-expect-error: until: "revision" local.set returns a LocalWrite, not a standalone TreeIntent
    const untilOnEvent = <Button label="Bad" onPress={local.set("saving", true, { until: "revision" })} />;
    expect([badActionKey, badActionType, badStateKey, untilOnEvent]).toHaveLength(4);
  });
  test("from_local_keys_are_typed_from_the_manifest_local_state", () => {
    type Local = { readonly saving: boolean; readonly q: string };
    const valid = action<Local>("tasks.escalate", { id: "t1" }, { fromLocal: { reason: "q" } });
    const validState = state.set<Local>("selected", undefined, { fromLocal: "q" });
    expect([valid, validState]).toHaveLength(2);

    // @ts-expect-error: undeclared local key fails when manifest local state is typed
    const badActionKey = action<Local>("tasks.escalate", { id: "t1" }, { fromLocal: { reason: "missing" } });
    // @ts-expect-error: undeclared local key fails on state.set as well
    const badStateKey = state.set<Local>("selected", undefined, { fromLocal: "missing" });
    expect([badActionKey, badStateKey]).toHaveLength(2);
  });
});
