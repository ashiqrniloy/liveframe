import { expect, test } from "bun:test";
import type { Definition } from "../catalog/define.ts";
import { definitions } from "../catalog/definitions.ts";

const catalog: readonly Definition[] = definitions;

const candidates = [
  "box",
  "stack",
  "inline",
  "grid",
  "scroll",
  "separator",
  "text",
  "heading",
  "icon",
  "image",
  "link",
  "button",
  "textField",
  "select",
  "checkbox",
  "switch",
  "menu",
  "menuItem",
  "popover",
  "dialog",
  "tooltip",
  "disclosure",
  "tabs",
  "tab",
];

test("catalog_has_no_product_shaped_kind", () => {
  expect(catalog.map((definition) => definition.kind).sort()).toEqual([...candidates].sort());
});

test("definitions_are_plain_data_with_complete_contracts", () => {
  expect(JSON.parse(JSON.stringify(definitions))).toEqual(definitions);
  for (const definition of catalog) {
    expect(Object.keys(definition).sort()).toEqual(
      ["kind", "props", "children", "events", "variants", "slots", "styleProps", "a11y"].sort(),
    );
    expect(definition.slots).toContain("root");
    expect(definition.variants).toContain("default");
    expect(new Set(definition.slots).size).toBe(definition.slots.length);
    if (definition.a11y.name !== undefined) expect(definition.props.properties).toHaveProperty(definition.a11y.name);
    expect(definition.props.type).toBe("object");
    expect(definition.props.additionalProperties).toBe(false);
    if (typeof definition.children !== "string") {
      for (const child of definition.children) expect(candidates).toContain(child.kind);
    }
  }
});

test("definitions_admit_no_colour_or_raw_style_props", () => {
  const styleProps = new Set([
    "padding",
    "paddingX",
    "paddingY",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "margin",
    "marginX",
    "marginY",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "gap",
    "direction",
    "align",
    "justify",
    "wrap",
    "width",
    "height",
    "minWidth",
    "maxWidth",
    "grow",
    "shrink",
    "basis",
    "columns",
    "rows",
    "area",
    "surface",
    "fill",
    "radius",
    "position",
    "insetTop",
    "insetBottom",
    "textAlign",
    "textStyle",
    "tone",
  ]);
  function inspect(value: unknown): void {
    expect(typeof value).not.toBe("function");
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      expect(key).not.toMatch(/^(className|style|.*colou?r.*)$/i);
      if (key === "type") expect(["object", "array", "string", "number", "integer", "boolean"]).toContain(child);
      if (key === "type" && child === "object") {
        expect(value).toHaveProperty("additionalProperties", false);
      }
      inspect(child);
    }
  }
  inspect(definitions);
  for (const definition of catalog) {
    for (const prop of definition.styleProps) expect(styleProps.has(prop)).toBe(true);
    for (const prop of ["surface", "fill", "radius"] as const)
      if (definition.styleProps.includes(prop)) expect(definition.kind).toBe("box");
    for (const prop of ["textAlign"] as const)
      if (definition.styleProps.includes(prop)) expect(["text", "heading"]).toContain(definition.kind);
  }
});

test("references_are_all_attributed", async () => {
  const root = new URL("../references/", import.meta.url);
  const sources = await Bun.file(new URL("SOURCES.md", root)).text();
  const rows = [...sources.matchAll(/\| `([^`]+)` \| `([^`]+)` \| `([a-f0-9]{40})` \| (\d+)–(\d+) \|/g)];
  const binaries = [
    ...sources.matchAll(/\| `([^`]+)` \| `([^`]+)` \| `([a-f0-9]{40})` \| (\d+) \| `([a-f0-9]{64})` \|/g),
  ];
  const files = [...new Bun.Glob("**/*").scanSync({ cwd: root.pathname, onlyFiles: true })]
    .filter((path) => path !== "SOURCES.md")
    .sort();
  expect([...rows.map((row) => row[1]), ...binaries.map((row) => row[1])].sort()).toEqual(files);
  for (const [, path, repo, , first, last] of rows) {
    expect(path?.startsWith(`${repo}/`)).toBe(true);
    expect(first).toBe("1");
    const source = await Bun.file(new URL(path ?? "", root)).text();
    expect(Number(last)).toBe(source.split("\n").length - Number(source.endsWith("\n")));
  }
  for (const [, path, repo, , bytes, sha256] of binaries) {
    expect(path?.startsWith(`${repo}/`)).toBe(true);
    const source = new Uint8Array(await Bun.file(new URL(path ?? "", root)).arrayBuffer());
    expect(source.byteLength).toBe(Number(bytes));
    expect(Bun.CryptoHasher.hash("sha256", source, "hex")).toBe(String(sha256));
  }
});
