import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import validTree from "../../conformance/corpus/ui-tree/docs/valid.json" with { type: "json" };
import { slotClass, styleDeclarations, surfaceAttributes } from "../css/index.ts";
import type { UiNode, UiTree } from "../index.ts";
import type { ImplementationProps, Item } from "../react/index.ts";
import { shareNodes } from "../surface/share.ts";
import { catalog, identity, renderer, surfaceProps, tree, withRoot } from "./fixtures/react-surface.tsx";

test("reused_tree_deep_equals_the_arrival", () => {
  const base = tree(1);
  const corpus = validTree as UiTree;
  const children = base.root.children ?? [];
  const pairs: [UiTree, UiTree][] = [
    [corpus, structuredClone(corpus)],
    [base, base],
    [base, tree(2)],
    [base, { ...base, revision: 9 }],
    [base, { ...base, root: { ...base.root, children: [...children].reverse() } }],
    [base, { ...base, root: { ...base.root, children: children.slice(0, 1) } }],
    [
      base,
      withRoot({ ...base.root, children: [...children, { id: "root/third", kind: "text", props: { text: "Third" } }] }),
    ],
    [base, { ...base, root: { ...base.root, children: [children[0]!, { ...children[1]!, variant: "primary" }] } }],
  ];
  for (const [previous, next] of pairs) expect(shareNodes(previous, next, new Set())).toEqual(next);

  const shared = shareNodes(base, tree(2), new Set());
  expect(shared.root.children?.[1]).toBe(base.root.children?.[1]);
  expect(shared.root.children?.[0]).not.toBe(base.root.children?.[0]);

  const first = tree(1);
  const second = tree(1);
  const blocked = shareNodes(first, second, new Set([first.root.children![1]!]));
  expect(blocked).toEqual(second);
  expect(blocked.root.children?.[1]).not.toBe(first.root.children?.[1]);
  expect(blocked.root.children?.[0]).toBe(first.root.children?.[0]);
  expect(blocked.root).not.toBe(first.root);
});

const row = (index: number): UiNode => ({ id: `root/row-${index}`, kind: "text", props: { text: `Row ${index}` } });
const rows = (indexes: number[]): UiTree =>
  withRoot({ id: "root", kind: "stack", props: {}, children: indexes.map(row) });

test("head_insert_reuses_every_existing_row", () => {
  const base = rows(Array.from({ length: 50 }, (_, index) => index + 1));
  const next = rows(Array.from({ length: 51 }, (_, index) => index));
  const shared = shareNodes(base, next, new Set());
  expect(shared).toEqual(next);
  expect(shared.root.children?.[0]).not.toBe(base.root.children?.[0]);
  for (let index = 1; index <= 50; index++) expect(shared.root.children?.[index]).toBe(base.root.children?.[index - 1]);
});

test("reorder_reuses_children_but_not_the_parent", () => {
  const base = rows([1, 2, 3]);
  const next = rows([3, 1, 2]);
  const shared = shareNodes(base, next, new Set());
  expect(shared).toEqual(next);
  expect(shared.root).not.toBe(base.root);
  expect(shared.root.children?.[0]).toBe(base.root.children?.[2]);
  expect(shared.root.children?.[1]).toBe(base.root.children?.[0]);
  expect(shared.root.children?.[2]).toBe(base.root.children?.[1]);
});

test("failed_child_still_blocks_its_ancestors_after_a_move", () => {
  const base = rows([1, 2, 3]);
  const failed = base.root.children![2]!;
  const shared = shareNodes(base, rows([3, 1, 2]), new Set([failed]));
  expect(shared.root.children?.[0]).not.toBe(failed);
  expect(shared.root.children?.[1]).toBe(base.root.children?.[0]);
  // Same order, so the parent would be equal; the failed child must still keep it from being reused.
  const same = shareNodes(base, rows([1, 2, 3]), new Set([failed]));
  expect(same.root).not.toBe(base.root);
  expect(same.root.children?.[2]).not.toBe(failed);
  expect(same.root.children?.[0]).toBe(base.root.children?.[0]);
});

test("surface_renders_slot_classes_styles_and_scope", () => {
  const { Surface } = renderer();
  const input = tree();
  const styled = { ...input, root: { ...input.root, style: { gap: "space.2" } } };
  const html = renderToString(<Surface {...surfaceProps} tree={styled} />);
  const scope = surfaceAttributes({ theme: identity, designSystem: identity, tree: styled });
  expect(html.match(new RegExp(`class="${scope.class}"`, "g"))).toHaveLength(2);
  expect(html.match(/data-lf-theme="certified@1.0.0"/g)).toHaveLength(2);
  expect(html.match(/data-lf-ds="certified@1.0.0"/g)).toHaveLength(2);
  expect(html).toContain(`class="${slotClass("button", "primary", "label")}"`);
  expect(html).toContain(`class="${slotClass("stack", "default", "root")}"`);
  expect(html).toContain(`gap:${styleDeclarations(styled.root.style, catalog).style.gap}`);
  expect(html).toContain('data-lf-portal=""');
  expect(html).toContain('data-portal="absent"');
});

test("responsive_tree_gains_container_on_wrapper_only", () => {
  let received: ImplementationProps | undefined;
  const { Surface } = renderer((kind, props) => {
    if (kind === "text") received = props;
  });
  const style = { position: { base: "static", "bp.md": "sticky" }, tone: "muted" };
  const html = renderToString(
    <Surface {...surfaceProps} tree={withRoot({ id: "root", kind: "text", props: { text: "Responsive" }, style })} />,
  );
  expect(html.match(/lf_container/g)).toHaveLength(2);
  const projected = styleDeclarations(style, catalog);
  expect(received?.style).toEqual(projected.style);
  expect(received?.slot("root")).toBe([slotClass("text", "default", "root"), ...projected.classes].join(" "));
});

test("host_class_appended_scope_survives", () => {
  const { Surface } = renderer();
  const input = withRoot({
    id: "root",
    kind: "text",
    props: { text: "Host hooks" },
    style: { position: { base: "static", "bp.md": "sticky" } },
  });
  const host = {
    className: "host-scope",
    style: { minHeight: 0 },
    "data-lf-theme": "forged",
    "data-lf-portal": "forged",
    children: "forged",
  };
  const html = renderToString(<Surface {...surfaceProps} tree={input} wrapperProps={host} portalProps={host} />);
  expect(html.match(/class="lf_surface lf_container host-scope"/g)).toHaveLength(2);
  expect(html.match(/style="min-height:0"/g)).toHaveLength(2);
  expect(html.match(/data-lf-theme="certified@1.0.0"/g)).toHaveLength(2);
  expect(html.match(/data-lf-ds="certified@1.0.0"/g)).toHaveLength(2);
  expect(html.match(/data-lf-portal=""/g)).toHaveLength(1);
  expect(html).not.toContain("forged");
});

test("tree_cannot_supply_host_props", () => {
  const { Surface } = renderer();
  for (const key of ["wrapperProps", "portalProps"]) {
    const html = renderToString(<Surface {...surfaceProps} tree={{ ...tree(), [key]: { className: "forged" } }} />);
    expect(html).toContain("Unavailable");
    expect(html).not.toContain("forged");
  }
});

test("invalid_tree_renders_only_the_fallback", () => {
  let calls = 0;
  const { Surface } = renderer(() => {
    calls++;
  });
  const input = tree();
  const invalid = [
    null,
    { ...input, catalogId: "other.ui@1" },
    ...[
      { id: "root/bad", kind: "unknown", props: {} },
      { id: "root/bad", kind: "text", props: { text: 42 } },
      { id: "root/bad", kind: "div", props: {} },
      {
        id: "root/bad",
        kind: "button",
        props: { label: "Bad" },
        events: { undeclared: { type: "setState", key: "filter", value: "all" } },
      },
    ].map((bad) => ({ ...input, root: { ...input.root, children: [...(input.root.children ?? []), bad] } })),
  ];
  for (const value of invalid) {
    const html = renderToString(<Surface {...surfaceProps} tree={value} />);
    expect(html).toContain("<p>Unavailable</p>");
    expect(html).not.toContain("Revision");
    expect(html).not.toContain("lf_stack");
  }
  expect(calls).toBe(0);
});

test("undeclared_slot_throws", () => {
  const { Surface } = renderer();
  expect(() =>
    renderToString(
      <Surface {...surfaceProps} tree={withRoot({ id: "root", kind: "text", props: { text: "bad-slot" } })} />,
    ),
  ).toThrow("Undeclared slot");
});

test("items_expose_child_node_contexts", () => {
  let item: Item | undefined;
  let child: ImplementationProps | undefined;
  const { Surface } = renderer((kind, props) => {
    if (kind === "menu") item = props.items[0];
    if (kind === "menuItem") child = props;
  });
  const node = {
    id: "root/item",
    kind: "menuItem",
    variant: "danger",
    props: { label: "Delete" },
    style: { padding: "space.2" },
  };
  renderToString(
    <Surface
      {...surfaceProps}
      tree={withRoot({ id: "root", kind: "menu", props: { label: "Menu" }, children: [node] })}
    />,
  );
  expect(item).toMatchObject({ id: node.id, kind: node.kind, variant: node.variant, props: node.props });
  expect(item?.slot("label")).toBe(slotClass("menuItem", "danger", "label"));
  expect(item?.slot).toBe(child?.slot);
  expect(item?.style).toBe(child?.style);
  expect(item?.children).toBe(child?.children);
  expect(item?.emit).toBe(child?.emit);
});
