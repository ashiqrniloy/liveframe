import { expect, test } from "bun:test";
import { styleDeclarations, surfaceAttributes } from "../css/index.ts";
import { styleProps } from "../formats/fixed.ts";
import type { Catalog, UiTree } from "../index.ts";

const catalog: Catalog = await Bun.file(new URL("./fixtures/proof/catalog.json", import.meta.url)).json();
const space = catalog.vocabulary.space[0]!;
const cases = {
  padding: [space, "padding", "var(--lf-v-space_0)"],
  paddingX: [space, "paddingInline", "var(--lf-v-space_0)"],
  paddingY: [space, "paddingBlock", "var(--lf-v-space_0)"],
  paddingTop: [space, "paddingTop", "var(--lf-v-space_0)"],
  paddingRight: [space, "paddingInlineEnd", "var(--lf-v-space_0)"],
  paddingBottom: [space, "paddingBottom", "var(--lf-v-space_0)"],
  paddingLeft: [space, "paddingInlineStart", "var(--lf-v-space_0)"],
  margin: [space, "margin", "var(--lf-v-space_0)"],
  marginX: [space, "marginInline", "var(--lf-v-space_0)"],
  marginY: [space, "marginBlock", "var(--lf-v-space_0)"],
  marginTop: [space, "marginTop", "var(--lf-v-space_0)"],
  marginRight: [space, "marginInlineEnd", "var(--lf-v-space_0)"],
  marginBottom: [space, "marginBottom", "var(--lf-v-space_0)"],
  marginLeft: [space, "marginInlineStart", "var(--lf-v-space_0)"],
  gap: [space, "gap", "var(--lf-v-space_0)"],
  direction: ["horizontal", "flexDirection", "row"],
  align: ["end", "alignItems", "end"],
  justify: ["between", "justifyContent", "space-between"],
  wrap: ["wrap", "flexWrap", "wrap"],
  width: ["fill", "width", "100%"],
  height: ["fit", "height", "fit-content"],
  minWidth: ["12ch", "minWidth", "12ch"],
  maxWidth: ["90%", "maxWidth", "90%"],
  minHeight: ["8ch", "minHeight", "8ch"],
  maxHeight: ["fill", "maxHeight", "100%"],
  grow: [1, "flexGrow", "1"],
  shrink: [0, "flexShrink", "0"],
  basis: [12, "flexBasis", "12px"],
  columns: [["2fr", space], "gridTemplateColumns", "minmax(0, 2fr) var(--lf-v-space_0)"],
  rows: [["1fr"], "gridTemplateRows", "minmax(0, 1fr)"],
  area: [["head head", "main side"], "gridTemplateAreas", '"head head" "main side"'],
  surface: ["surface.base", "backgroundColor", "var(--lf-c-surface_base)"],
  fill: [
    catalog.vocabulary.fillableRoles[0]!,
    "backgroundColor",
    `var(--lf-c-${catalog.vocabulary.fillableRoles[0]!.replaceAll(".", "_")})`,
  ],
  radius: ["full", "borderRadius", "9999px"],
  position: ["sticky", "position", "sticky"],
  insetTop: [space, "top", "var(--lf-v-space_0)"],
  insetBottom: [space, "bottom", "var(--lf-v-space_0)"],
  textAlign: ["start", "textAlign", "start"],
  textStyle: [
    catalog.vocabulary.typographyRoles[0]!,
    "fontSize",
    `var(--lf-t-${catalog.vocabulary.typographyRoles[0]!.replaceAll(".", "_")}__fontSize)`,
  ],
  tone: ["muted", "color", `var(--lf-c-${catalog.vocabulary.tones.muted!.replaceAll(".", "_")})`],
} satisfies Record<(typeof styleProps)[number], readonly [unknown, string, string]>;

test("every_style_prop_maps", () => {
  for (const prop of styleProps) {
    const [value, property, expected] = cases[prop];
    const result = styleDeclarations({ [prop]: value }, catalog);
    expect(result.style[property]).toBe(expected);
    const responsive = styleDeclarations({ [prop]: { base: value } }, catalog);
    expect(responsive.style[`--lf-r-${prop}__base__${property}`]).toBe(expected);
    expect(responsive.classes).toContain(`lf_r_${prop}`);
  }
  expect(styleDeclarations({ fill: cases.fill[0] }, catalog).classes).toEqual(["lf_fill"]);
  expect(
    styleDeclarations(
      { width: "2fr", radius: catalog.vocabulary.radius[0], height: catalog.vocabulary.size[0] },
      catalog,
    ).style,
  ).toMatchObject({ width: "minmax(0, 2fr)" });
});

test("tones_come_from_the_vocabulary", () => {
  const custom = { ...catalog, vocabulary: { ...catalog.vocabulary, tones: { custom: "text.foil" } } };
  expect(styleDeclarations({ tone: "custom" }, custom).style).toEqual({ color: "var(--lf-c-text_foil)" });
});

test("invalid_styles_fail_without_emitting_css", () => {
  for (const input of [
    { color: "red" },
    { padding: "13px" },
    { columns: ["fit"] },
    { tone: "unknown" },
    { width: "101%" },
    { minHeight: "13px" },
    { maxHeight: "101%" },
    { grow: -1 },
    { gap: { base: space, unknown: space } },
    { gap: { "bp.sm": space } },
    { fill: "surface.base" },
    { area: ["</style>"] },
    { constructor: "red" },
  ]) {
    expect(() => styleDeclarations(input, catalog)).toThrow();
  }
});

test("container_only_for_responsive_trees", () => {
  const root = { id: "root", kind: "box", props: {} };
  const args = {
    theme: { id: "theme", version: "1" },
    designSystem: { id: "system", version: "2" },
    tree: { root } as UiTree,
  };
  expect(surfaceAttributes(args)).toEqual({
    class: "lf_surface",
    "data-lf-theme": "theme@1",
    "data-lf-ds": "system@2",
  });
  expect(
    surfaceAttributes({
      ...args,
      tree: { ...args.tree, root: { ...root, children: [{ ...root, id: "child", style: { gap: { base: space } } }] } },
    }).class,
  ).toBe("lf_surface lf_container");
  expect(
    surfaceAttributes({ ...args, tree: { ...args.tree, root: { ...root, style: { columns: ["1fr"] } } } }).class,
  ).toBe("lf_surface");
});

test("value_forms_and_colour_authority", () => {
  for (const [value, expected] of [
    ["space.2", "var(--lf-v-space_2)"],
    ["size.rail", "var(--lf-v-size_rail)"],
    ["0fr", "minmax(0, 0fr)"],
    ["100%", "100%"],
    ["0ch", "0ch"],
    ["fit", "fit-content"],
    ["fill", "100%"],
  ]) {
    expect(styleDeclarations({ width: value }, catalog).style.width).toBe(expected);
  }
  for (const [prop, names] of [
    ["surface", catalog.vocabulary.surfaceRoles],
    ["fill", catalog.vocabulary.fillableRoles],
    ["tone", Object.keys(catalog.vocabulary.tones)],
  ] as const) {
    for (const name of names) {
      const role = prop === "tone" ? catalog.vocabulary.tones[name]! : name;
      const expected = `var(--lf-c-${role.replaceAll(".", "_")})`;
      expect(Object.values(styleDeclarations({ [prop]: name }, catalog).style)).toEqual([expected]);
      expect(Object.values(styleDeclarations({ [prop]: { base: name, "bp.sm": name } }, catalog).style)).toEqual([
        expected,
        expected,
      ]);
    }
  }
  expect(styleDeclarations({ radius: catalog.vocabulary.radius[0] }, catalog).style.borderRadius).toBe(
    `var(--lf-v-${catalog.vocabulary.radius[0]!.replaceAll(".", "_")})`,
  );
  expect(
    Object.keys(styleDeclarations({ textStyle: catalog.vocabulary.typographyRoles[0] }, catalog).style),
  ).toHaveLength(8);
  for (const [value, expected] of [
    ["around", "space-around"],
    ["evenly", "space-evenly"],
    ["start", "start"],
    ["end", "end"],
    ["center", "center"],
  ])
    expect(styleDeclarations({ justify: value }, catalog).style.justifyContent).toBe(expected);
  expect(styleDeclarations({ direction: "vertical" }, catalog).style.flexDirection).toBe("column");
});
