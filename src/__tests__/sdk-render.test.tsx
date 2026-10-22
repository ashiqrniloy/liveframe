/** @jsxImportSource @arnilo/liveframe/sdk */
import { describe, expect, test } from "bun:test";
import { action, primitive, render, state, type WidgetProps } from "@arnilo/liveframe/sdk";
import { compileValidator, type LiveframeError, type UiNode } from "../index.ts";
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import catalogDocument from "./fixtures/proof/catalog.json" with { type: "json" };
import manifest from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };

const validator = compileValidator({ catalog: catalogDocument, capabilities, manifest });

const Stack = primitive<{ readonly children?: unknown; readonly padding?: string; readonly gap?: string }>("stack");
const Text = primitive<{ readonly text: string }>("text");
const Button = primitive<{
  readonly label: string;
  readonly variant?: string;
  readonly onPress?: unknown;
  readonly children?: unknown;
}>("button");
const Nope = primitive("nope");

const inputs: WidgetProps = { params: {}, state: {}, data: {}, context: {} };
const options = { validator, surfaceId: "home", revision: 1 };
type Options = typeof options & { readonly limits?: { readonly nodes?: number; readonly bytes?: number } };

function rendered(element: unknown): UiNode {
  const result = render(() => element, inputs, options);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  const validation = validator.validateTree(result.value);
  if (!validation.ok) throw new Error(JSON.stringify(validation.errors));
  return result.value.root;
}

function failures(
  widget: (props: WidgetProps) => unknown,
  renderOptions: Options = options,
): readonly LiveframeError[] {
  const result = render(widget, inputs, renderOptions);
  return result.ok ? [] : result.errors;
}

function ids(node: UiNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(ids)];
}

describe("sdk render", () => {
  test("render_error_kinds", () => {
    const cases: readonly {
      readonly kind: LiveframeError["kind"];
      readonly widget: (props: WidgetProps) => unknown;
      readonly options?: Options;
    }[] = [
      {
        kind: "host-element",
        // @ts-expect-error: host elements are not in the JSX namespace (spec §7.1)
        widget: () => <div />,
      },
      { kind: "unknown-component", widget: () => <Nope /> },
      {
        kind: "invalid-prop",
        // @ts-expect-error: text is required, so the validator reports it
        widget: () => <Text />,
      },
      {
        kind: "invalid-children",
        widget: () => (
          // @ts-expect-error: text takes no children; the structure rule reports it
          <Text text="a">
            <Text text="b" />
          </Text>
        ),
      },
      {
        kind: "missing-key",
        widget: () => {
          // biome-ignore lint/correctness/useJsxKeyInIterable: the missing keys are the case under test
          const rows = [<Text text="a" />, <Text text="b" />];
          return <Stack>{rows}</Stack>;
        },
      },
      {
        kind: "duplicate-key",
        widget: () => (
          <Stack>
            <Text key="a" text="a" />
            <Text key="a" text="b" />
          </Stack>
        ),
      },
      {
        kind: "undeclared-event",
        widget: () => <Button label="a" {...{ onHover: action("tasks.claim", { id: "t" }) }} />,
      },
      { kind: "undeclared-action", widget: () => <Button label="a" onPress={action("nope", {})} /> },
      {
        kind: "function-prop",
        // @ts-expect-error: a function is not JSON, and the renderer reports it
        widget: () => <Text {...{ text: () => "a" }} />,
      },
      { kind: "async-render", widget: async () => <Text text="a" /> },
      {
        kind: "render-failed",
        widget: () => {
          throw new Error("boom");
        },
      },
      {
        kind: "limit-exceeded",
        widget: () => (
          <Stack>
            <Text text="a" />
          </Stack>
        ),
        options: { ...options, limits: { nodes: 1 } },
      },
    ];

    for (const entry of cases) {
      const errors = failures(entry.widget, entry.options ?? options);
      const error = errors.find((candidate) => candidate.kind === entry.kind);
      expect({ kind: entry.kind, found: error?.kind }).toEqual({ kind: entry.kind, found: entry.kind });
      expect(error?.nodeId).toBeString();
      expect(error?.pointer).toBeString();
    }
    expect(failures(cases[10]?.widget ?? (() => null))[0]?.message).toBe("boom");
  });

  test("ids_are_key_paths", () => {
    const row = (id: string) => <Button key={id} label={`Claim ${id}`} />;

    const root = rendered(<Stack>{[row("row:4812"), row("row:4813")]}</Stack>);
    expect(ids(root)).toEqual(["root", "root/row:4812", "root/row:4813"]);

    const reordered = rendered(<Stack>{[row("row:4813"), row("row:4812")]}</Stack>);
    expect(ids(reordered).sort()).toEqual(ids(root).sort());

    const fragment = rendered(
      <Stack>
        {/* biome-ignore lint/complexity/noUselessFragments: the fragment adds no id segment, which is the case under test */}
        <>
          <Button key="claim" label="Claim" />
        </>
      </Stack>,
    );
    expect(ids(fragment)).toEqual(["root", "root/claim"]);
  });

  test("props_split_into_variant_style_events_and_props", () => {
    const root = rendered(
      <Stack padding="space.3">
        <Button key="claim" variant="ghost" label="Claim" onPress={state.set("selected", "t1")} />
      </Stack>,
    );

    expect(root.style).toEqual({ padding: "space.3" });
    const button = root.children?.[0];
    expect(button?.variant).toBe("ghost");
    expect(button?.props).toEqual({ label: "Claim" });
    expect(button?.events).toEqual({ onPress: { type: "setState", key: "selected", value: "t1" } });
  });

  test("widget_runs_once_and_two_root_nodes_fail", () => {
    let calls = 0;
    const single = render(
      () => {
        calls++;
        return <Text text="one" />;
      },
      inputs,
      options,
    );
    expect(single.ok).toBe(true);
    expect(calls).toBe(1);

    const roots = failures(() => (
      <>
        <Text key="a" text="a" />
        <Text key="b" text="b" />
      </>
    ));
    expect(roots.map((error) => error.kind)).toEqual(["invalid-children"]);
  });

  test("class_name_and_style_strings_rejected", () => {
    for (const props of [{ className: "bad" }, { style: "color: red" }, { colour: "red" }]) {
      const errors = failures(() => <Text text="a" {...props} />);
      expect(errors.map((error) => error.kind)).toEqual(["invalid-prop"]);
      expect(errors[0]?.pointer).toStartWith("/root/props/");
    }
  });

  test("errors_are_bounded", () => {
    const rows = Array.from({ length: 30 }, (_, i) => `item-${i}`);
    const errors = failures(() => (
      <Stack>
        {rows.map((row) => (
          // @ts-expect-error: text is required, so every node fails
          <Text key={row} />
        ))}
      </Stack>
    ));
    expect(errors).toHaveLength(21);
    expect(errors.at(-1)?.kind).toBe("limit-exceeded");
    expect(errors.at(-1)?.message).toBe("Error collection limit reached");
  });

  test("rendered_trees_pass_validate_tree", () => {
    const widgets = [
      () => <Text text="plain" />,
      () => (
        <Stack gap="space.2">
          <Text key="a" text="a" />
          <Button key="b" label="b" onPress={action("tasks.claim", { id: "t1" })} />
        </Stack>
      ),
      () => (
        <Stack padding="space.3">
          <Text key="héllo 世界" text="unicode ✓" />
        </Stack>
      ),
    ];
    for (const widget of widgets) {
      const result = render(widget, inputs, options);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(validator.validateTree(result.value).ok).toBe(true);

      const bytes = Buffer.byteLength(JSON.stringify(result.value));
      expect(render(widget, inputs, { ...options, limits: { bytes } }).ok).toBe(true);
      expect(render(widget, inputs, { ...options, limits: { bytes: bytes - 1 } }).ok).toBe(false);
      expect(validator.validateTree(result.value, { limits: { bytes } }).ok).toBe(true);
      expect(validator.validateTree(result.value, { limits: { bytes: bytes - 1 } }).ok).toBe(false);
    }
  });
});
