import { expect, test } from "bun:test";
import { type Catalog, classifyCatalogChange } from "@arnilo/liveframe";
import { implement } from "@arnilo/liveframe/react";
import { catalog } from "../catalog.ts";
import * as definitions from "../ui.definitions.gen.ts";
import * as ui from "../ui.gen.ts";

// The spec §5 primitive set, plus `hint`: nothing product-shaped (a queue, a metric card, a widget frame).
const controls = ["radioGroup", "radio", "slider", "progress", "dateField"];
const content = ["richText", "chart", "table", "tableRow", "tableCell"];
const primitives = [
  ...["box", "stack", "inline", "grid", "scroll", "separator"],
  ...["text", "hint", "heading", "icon", "image", "link"],
  ...["button", "textField", "select", "checkbox", "switch"],
  ...["menu", "menuItem", "popover", "dialog", "tooltip"],
  ...["tabs", "tab", "disclosure"],
  // 0.4.0: the controls the browser must draw itself (plan 039 design C.1–C.5).
  ...controls,
  // 0.4.0: the content the browser must lay out itself (plan 039 design T.1–T.6).
  ...content,
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

test("adding_the_controls_is_a_minor_catalog_change", () => {
  const before: Catalog = {
    ...catalog,
    definitions: catalog.definitions.filter((definition) => !controls.includes(definition.kind)),
  };
  const change = classifyCatalogChange(before, catalog);
  expect(change.level).toBe("minor");
  expect(catalog.catalogId).toBe("starter.ui@1");
});

test("adding_the_content_kinds_is_a_minor_catalog_change", () => {
  const before: Catalog = {
    ...catalog,
    definitions: catalog.definitions.filter((definition) => !content.includes(definition.kind)),
  };
  expect(classifyCatalogChange(before, catalog).level).toBe("minor");
});

// Type-level: each control's props and carried value have one type. `bun run typecheck` fails if an error goes missing.
test("wrong_value_types_to_each_control_fail_to_compile", () => {
  const props = [
    // @ts-expect-error A radio group's value is a string.
    ui.RadioGroup({ label: "Priority", value: 1 }),
    // @ts-expect-error A radio needs its value.
    ui.Radio({ label: "Low" }),
    // @ts-expect-error A slider's value is a number.
    ui.Slider({ label: "Level", value: "40" }),
    // @ts-expect-error A progress bar's value is a number.
    ui.Progress({ label: "Upload", value: "30" }),
    // @ts-expect-error A date field's value is an ISO date string.
    ui.DateField({ label: "Due", value: new Date() }),
  ];
  const carried = [
    implement(definitions.RadioGroup, ({ emit }) => {
      // @ts-expect-error `onChange` carries a string.
      emit("onChange", 1);
      return null;
    }),
    implement(definitions.Slider, ({ emit }) => {
      // @ts-expect-error `onChange` carries a number.
      emit("onChange", "41");
      return null;
    }),
    implement(definitions.DateField, ({ emit }) => {
      // @ts-expect-error `onChange` carries a string, the empty string when cleared.
      emit("onChange", null);
      return null;
    }),
    implement(definitions.Progress, ({ emit }) => {
      // @ts-expect-error A progress bar raises no event.
      emit("onChange", 1);
      return null;
    }),
  ];
  expect(props).toHaveLength(5);
  expect(carried).toHaveLength(4);
});
