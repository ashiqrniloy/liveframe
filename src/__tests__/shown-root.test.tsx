/** @jsxImportSource @arnilo/liveframe/sdk */
import { describe, expect, test } from "bun:test";
import { compileValidator, type LiveframeError, type UiNode, type UiTree, validateCatalog } from "@arnilo/liveframe";
import { ex, local, primitive, render, shown, type WidgetInputs } from "@arnilo/liveframe/sdk";
import { createSurfaceCore, type NodeContext } from "@arnilo/liveframe/surface";
import { renderTemplate, type Template, validateTemplate } from "../template/index.ts";
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
    properties: { q: { type: "string", maxLength: 64 }, count: { type: "integer" } },
    required: ["q", "count"],
    additionalProperties: false,
  },
  initialLocal: { q: "", count: 0 },
};
const validator = compileValidator({ catalog: catalogJson, capabilities, manifest });
const inputs = proofWidgets[0]?.scenarios[0] as WidgetInputs;

const tree = (children: UiNode[], revision = 1): UiTree => ({
  format: "liveframe/1",
  catalogId: catalog.catalogId,
  surfaceId: "s",
  revision,
  root: { id: "root", kind: "stack", props: {}, children },
});
const text = (name: string, extra: Partial<UiNode> = {}): UiNode => ({
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
const matches = (title: string) => ({ when: { $contains: [title, { $path: "local.q" }] } });
const SHOWN = { $path: "shown" };
const empty = text("empty", { when: { $eq: [SHOWN, 0] } });
const badge = text("badge", { bind: { text: { $concat: [{ $text: SHOWN }, " matches"] } } });
const filtered = (): UiNode[] => [field, text("alpha", matches("alpha")), text("beta", matches("beta")), empty, badge];

const ids = (context: NodeContext | undefined) => (context?.items ?? []).map((item) => item.id);
const props = (context: NodeContext | undefined, id: string) =>
  context?.items.find((item) => item.id === id)?.props as Record<string, unknown> | undefined;
const errorsOf = (...children: UiNode[]): readonly LiveframeError[] => {
  const result = validator.validateTree(tree(children));
  return result.ok ? [] : result.errors;
};
const rejected = (errors: readonly LiveframeError[], pointer: string, kind?: LiveframeError["kind"]) =>
  expect(errors).toContainEqual(expect.objectContaining({ pointer, ...(kind ? { kind } : {}) }));

function open() {
  const core = createSurfaceCore({ catalog, validator, onIntent: () => undefined });
  core.accept(tree(filtered()));
  const type = (value: string) => core.snapshot().root?.items[0]?.emit("onChange", value);
  return { core, type };
}

describe("shown in the surface core", () => {
  test("empty_row_appears_when_every_filtered_sibling_is_hidden", () => {
    const { core, type } = open();
    expect(ids(core.snapshot().root)).toEqual(["root/field", "root/alpha", "root/beta", "root/badge"]);
    expect(props(core.snapshot().root, "root/badge")?.text).toBe("2 matches");
    type("zzz");
    expect(ids(core.snapshot().root)).toEqual(["root/field", "root/empty", "root/badge"]);
    expect(props(core.snapshot().root, "root/badge")?.text).toBe("0 matches");
  });

  test("empty_row_disappears_when_one_shows", () => {
    const { core, type } = open();
    type("zzz");
    const badge0 = core.snapshot().root?.items.at(-1);
    type("alp");
    expect(ids(core.snapshot().root)).toEqual(["root/field", "root/alpha", "root/badge"]);
    expect(props(core.snapshot().root, "root/badge")?.text).toBe("1 matches");
    // A reader of `shown` reads no local key, yet it is rebuilt when the count changes.
    expect(core.snapshot().root?.items.at(-1)).not.toBe(badge0);
  });

  test("an_unchanged_count_keeps_the_reader_context", () => {
    const { core, type } = open();
    const before = core.snapshot().root;
    // "a" still matches both titles: the count is unchanged, so the reader keeps its context.
    type("a");
    expect(core.snapshot().root?.items.at(-1)).toBe(before?.items.at(-1));
  });

  test("two_readers_do_not_count_each_other", () => {
    // Readers are never counted, so two of them under one parent read the same count and cannot cycle.
    const first = text("first", { when: { $eq: [SHOWN, 0] } });
    const second = text("second", { when: { $eq: [SHOWN, 0] } });
    const core = createSurfaceCore({ catalog, validator, onIntent: () => undefined });
    expect(core.accept(tree([first, second])).ok).toBe(true);
    expect(ids(core.snapshot().root)).toEqual(["root/first", "root/second"]);
  });

  test("ungated_and_faulted_siblings_are_not_counted_and_the_root_reads_zero", () => {
    const faulted = text("faulted", { when: { $eq: [{ $div: [1, { $path: "local.count" }] }, 1] } });
    const core = createSurfaceCore({ catalog, validator, onIntent: () => undefined });
    core.accept(tree([text("plain"), faulted, badge]));
    expect(props(core.snapshot().root, "root/badge")?.text).toBe("0 matches");
    const root = { ...tree([]), root: { id: "root", kind: "stack", props: {}, when: { $eq: [SHOWN, 0] } } };
    expect(core.accept({ ...root, revision: 2 } as UiTree).ok).toBe(true);
    expect(core.snapshot().root?.id).toBe("root");
  });

  test("shown_counts_only_direct_children", () => {
    const nested: UiNode = {
      id: "root/group",
      kind: "stack",
      props: {},
      children: [
        { ...text("x", matches("x")), id: "root/group/x" },
        { ...empty, id: "root/group/empty" },
      ],
    };
    const core = createSurfaceCore({ catalog, validator, onIntent: () => undefined });
    core.accept(tree([text("alpha", matches("alpha")), nested, badge]));
    expect(props(core.snapshot().root, "root/badge")?.text).toBe("1 matches");
    const group = core.snapshot().root?.items[1];
    expect(ids(group)).toEqual(["root/group/x"]);
  });
});

describe("shown in the validator", () => {
  test("shown_is_an_integer_root_with_no_properties", () => {
    expect(errorsOf(...filtered())).toEqual([]);
    rejected(
      errorsOf(text("a", { when: { $eq: [{ $path: "shown.n" }, 0] } })),
      "/root/children/0/when/$eq/0/$path",
      "unknown-name",
    );
    // An integer is not a condition, and does not fit a string prop.
    rejected(errorsOf(text("a", { when: SHOWN })), "/root/children/0/when", "invalid-prop");
    rejected(errorsOf(text("a", { bind: { text: SHOWN } })), "/root/children/0/bind/text", "invalid-prop");
  });
});

describe("authoring shown", () => {
  const Text = primitive<{ readonly text: string; readonly when?: unknown }>("text");
  const Stack = primitive<{ readonly children?: unknown }>("stack");
  const TextField = primitive<{ readonly label: string; readonly onChange?: unknown }>("textField");
  const options = { validator, surfaceId: "s", revision: 0 };

  test("shown_builds_the_root_and_render_checks_it", () => {
    expect(shown()).toEqual(SHOWN);
    const widget = () => (
      <Stack>
        <TextField label="Filter" onChange={local.set("q")} />
        <Text key="alpha" when={ex.contains("alpha", local("q"))} text="alpha" />
        <Text key="empty" when={ex.eq(shown(), 0)} text="No matches" />
      </Stack>
    );
    const built = render(widget, inputs, options);
    if (!built.ok) throw new Error(JSON.stringify(built.errors));
    expect(built.value.root.children?.at(-1)?.when).toEqual({ $eq: [SHOWN, 0] });
    expect(validator.validateTree(built.value).ok).toBe(true);
    const bad = () => (
      <Stack>
        <Text key="a" when={shown()} text="a" />
      </Stack>
    );
    expect(render(bad, inputs, options).ok).toBe(false);
  });

  test("sibling_count_is_not_readable_outside_when_and_bind", () => {
    const context = { catalog: catalogJson, capabilities, manifest } as never;
    const installed = (child: Record<string, unknown>) =>
      validateTemplate(
        { format: "liveframe-template/1", root: { kind: "stack", children: [child] } } as never,
        context,
      );
    const ok = installed({ kind: "text", props: { text: "x" }, when: { $eq: [SHOWN, 0] } });
    expect(ok.ok).toBe(true);
    const inProps = installed({ kind: "text", props: { text: { $text: SHOWN } } });
    expect(inProps.ok).toBe(false);
    if (!inProps.ok) expect(inProps.errors[0]?.kind).toBe("unknown-name");
    const inIf = installed({ $if: { $eq: [SHOWN, 0] }, kind: "text", props: { text: "x" } });
    expect(inIf.ok).toBe(false);
    if (!inIf.ok) expect(inIf.errors[0]?.kind).toBe("unknown-name");
    // `$embed` evaluates at expansion, where `shown` is not in scope either.
    const embedded = installed({ kind: "text", props: { text: "x" }, when: { $eq: [{ $embed: SHOWN }, 0] } });
    expect(embedded.ok).toBe(false);
  });

  test("a_template_copies_shown_into_the_tree", () => {
    const template = {
      format: "liveframe-template/1",
      root: {
        kind: "stack",
        children: [
          { kind: "text", key: "a", props: { text: "a" }, when: { $contains: ["a", { $path: "local.q" }] } },
          { kind: "text", key: "empty", props: { text: "none" }, when: { $eq: [SHOWN, 0] } },
        ],
      },
    } as unknown as Template;
    const result = renderTemplate(template, inputs, { validator, surfaceId: "s", revision: 0 });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.value.root.children?.[1]?.when).toEqual({ $eq: [SHOWN, 0] });
    expect(validator.validateTree(result.value).ok).toBe(true);
  });
});
