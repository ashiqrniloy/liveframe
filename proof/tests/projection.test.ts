import { expect, test } from "bun:test";
import { slotClass, styleDeclarations } from "@arnilo/liveframe/css";
import { catalog } from "../css/fixtures.ts";
import { hasResponsiveStyles, hasResponsiveValues, slotClasses, styleProps } from "../css/project.ts";
import { proofSheets } from "../css/sheets.ts";

// Projection internals are covered by src/__tests__/css-{sheets,design-system,style-props,browser}.test.ts.
// This suite covers only the proof adapter and its renderer-facing argument shapes.
test("proof_adapter_uses_library_classes_and_styles", () => {
  const style = { columns: { base: ["1fr"], "bp.md": ["1fr", "size.rail"] }, gap: "space.2" };
  const projected = styleDeclarations(style, catalog);
  expect(styleProps(style)).toEqual(projected.style);
  expect(slotClasses("grid", "default", "root", style)).toBe(
    [slotClass("grid", "default", "root"), ...projected.classes].join(" "),
  );
  expect(slotClasses("button", "primary", "label", style)).toBe(slotClass("button", "primary", "label"));
  expect(proofSheets).toContain(`.${slotClass("grid", "default", "root")}`);
  expect(() => styleProps({ columns: ["fit"] })).toThrow();
});

test("proof_containment_follows_responsive_values", () => {
  const child = { style: { width: { base: "fill", "bp.md": "size.rail" } } };
  expect(hasResponsiveValues(child)).toBe(true);
  expect(hasResponsiveValues({ style: { columns: ["1fr"] } })).toBe(false);
  expect(hasResponsiveStyles({ children: [child] })).toBe(true);
  expect(hasResponsiveStyles({ children: [{ style: { gap: "space.2" } }] })).toBe(false);
});
