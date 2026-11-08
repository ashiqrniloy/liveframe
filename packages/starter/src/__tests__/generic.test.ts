import { expect, test } from "bun:test";
import { catalog } from "../catalog.ts";

// The spec §5 primitive set, plus `hint`: nothing product-shaped (a queue, a metric card, a widget frame).
const primitives = [
  ...["box", "stack", "inline", "grid", "scroll", "separator"],
  ...["text", "hint", "heading", "icon", "image", "link"],
  ...["button", "textField", "select", "checkbox", "switch"],
  ...["menu", "menuItem", "popover", "dialog", "tooltip"],
  ...["tabs", "tab", "disclosure"],
];

test("starter_has_only_generic_primitives", () => {
  expect(catalog.definitions.map((definition) => definition.kind).sort()).toEqual([...primitives].sort());
});

test("starter_uses_the_0_3_features", () => {
  const kinds = new Map(catalog.definitions.map((definition) => [definition.kind, definition]));
  expect(kinds.get("textField")?.refProps).toEqual(["describedBy"]);
  expect(Object.keys(kinds.get("button")?.axes ?? {})).toEqual(["tone"]);
  for (const [kind, prop] of [
    ["link", "href"],
    ["image", "src"],
  ] as const)
    expect(kinds.get(kind)?.props.properties[prop]).toMatchObject({ url: { schemes: ["https"], relative: true } });
  expect(Object.keys(catalog.vocabulary.extensions ?? {})).toEqual(["sheen"]);
});
