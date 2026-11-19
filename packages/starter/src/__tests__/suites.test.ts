import { describe, expect, test } from "bun:test";
import { validateDesignSystem } from "@arnilo/liveframe";
import { catalogSuite, designSystemSuite } from "@arnilo/liveframe/conformance";
import { rendererSuite } from "@arnilo/liveframe/conformance/react";
import { catalog } from "../catalog.ts";
import { designSystem } from "../design-system.ts";
import { primitiveCss } from "../styles.ts";
import { themes } from "../themes.ts";
import { capabilities, examples, manifest, pageOptions, serverExamples } from "./host.ts";

function register(name: string, cases: { name: string; run(): Promise<void>; timeout?: number | undefined }[]) {
  describe(name, () => {
    for (const c of cases) test(c.name, c.run, c.timeout);
  });
}

register(
  "starter_passes_catalog_suite",
  catalogSuite({ catalog, capabilities, manifest, examples, published: catalog }),
);
register(
  "starter_passes_design_system_suite_with_contrast",
  designSystemSuite({ catalog, themes, designSystems: [designSystem], sheets: [primitiveCss], contrast: true }),
);
register("starter_passes_renderer_server_suite", rendererSuite({ ...pageOptions, examples: serverExamples }));

// docs/migration-0.4.md "Action needed": a 0.3.x design system for `starter.ui@1` lacks exactly these two.
test("design_system_without_the_0_4_additions_fails_with_the_two_documented_errors", () => {
  const values = { ...designSystem.values };
  delete values["size.row"];
  const recipes: Record<string, unknown> = { ...designSystem.recipes };
  delete recipes["scroll.*.viewport.focus"];
  const result = validateDesignSystem({ ...designSystem, values, recipes }, { catalog, registry: {} });
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.errors.map((e) => [e.kind, e.pointer])).toEqual([
    ["unknown-name", "/values/size.row"],
    ["incomplete-design-system", "/recipes/scroll.default.root.focus"],
  ]);
});

// docs/migration-0.4.md "Action needed": the five 0.4 controls need a rest recipe per slot and a focus overlay each.
test("design_system_without_the_0_4_controls_fails_at_their_recipes", () => {
  const controls = ["radioGroup", "radio", "slider", "progress", "dateField"];
  const recipes = Object.fromEntries(
    Object.entries(designSystem.recipes).filter(([key]) => !controls.includes(key.slice(0, key.indexOf(".")))),
  );
  const result = validateDesignSystem({ ...designSystem, recipes }, { catalog, registry: {} });
  expect(result.ok).toBe(false);
  if (result.ok) return;
  for (const error of result.errors) {
    expect(error.kind).toBe("incomplete-design-system");
    expect(controls).toContain(error.pointer.split("/")[2]?.split(".")[0] ?? "");
  }
  expect(result.errors.map((e) => e.pointer).slice(0, 3)).toEqual([
    "/recipes/radioGroup.default.root.rest",
    "/recipes/radioGroup.default.label.rest",
    "/recipes/radioGroup.default.root.focus",
  ]);
});

// docs/migration-0.4.md "Action needed": the five 0.4 content kinds need a rest recipe per slot; they raise nothing.
test("design_system_without_the_0_4_content_kinds_fails_at_their_rest_recipes", () => {
  const content = ["richText", "chart", "table", "tableRow", "tableCell"];
  const recipes = Object.fromEntries(
    Object.entries(designSystem.recipes).filter(([key]) => !content.includes(key.slice(0, key.indexOf(".")))),
  );
  const result = validateDesignSystem({ ...designSystem, recipes }, { catalog, registry: {} });
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.errors.map((e) => [e.kind, e.pointer.replace(/^\/recipes\/|\.default|\.rest$/g, "")])).toEqual(
    [
      ...["root", "paragraph", "heading", "list", "item", "code", "link"].map((slot) => `richText.${slot}`),
      ...["root", "plot", "axis", "gridline", "series1", "series2", "series3", "series4", "legend"].map(
        (slot) => `chart.${slot}`,
      ),
      "table.root",
      "table.caption",
      "tableRow.root",
      "tableCell.root",
    ].map((key) => ["incomplete-design-system", key]),
  );
});
