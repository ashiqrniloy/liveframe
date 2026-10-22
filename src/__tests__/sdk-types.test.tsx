/** @jsxImportSource @arnilo/liveframe/sdk */
import { describe, expect, test } from "bun:test";
import { primitive, type WidgetProps } from "@arnilo/liveframe/sdk";

const Button = primitive<{ readonly label: string; readonly variant?: "primary" | "ghost" }>("button");

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
    };

    // @ts-expect-error: params are readonly
    props.params.id = "other";
    const first = props.data.rows[0];
    if (!first) throw new Error("fixture");
    // @ts-expect-error: nested data is readonly
    first.id = "other";
    expect(props.context.size).toBe("md");
  });
});
