import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { slotClass, styleDeclarations, surfaceAttributes } from "../css/index.ts";
import type { ImplementationProps, Item } from "../react/index.ts";
import { catalog, identity, renderer, surfaceProps, tree, withRoot } from "./fixtures/react-surface.tsx";

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
