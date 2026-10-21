import { expect, test } from "bun:test";
import { definitions } from "../catalog/definitions.ts";
import { project, slotClasses, styleProps } from "../css/project.ts";
import { certifiedDesignSystem } from "../styles/certified/design-system.ts";
import { certifiedTheme } from "../styles/certified/theme.ts";
import { rackDesignSystem } from "../styles/rack/design-system.ts";
import { rackTheme } from "../styles/rack/theme.ts";
import { states } from "../styles/types.ts";

test("projects_every_recipe_to_stable_classes_and_variables", () => {
  const first = project(certifiedTheme, certifiedDesignSystem);
  const second = project(rackTheme, rackDesignSystem);
  expect(first).not.toBe(second);
  for (const definition of definitions)
    for (const variant of definition.variants)
      for (const slot of definition.slots)
        for (const state of states) {
          const name = slotClasses(definition.kind, variant, slot).split(" ")[states.indexOf(state)];
          expect(first).toContain(`.${name}`);
          expect(second).toContain(`.${name}`);
        }
  expect(first).toContain("@media (forced-colors: active)");
  expect(first).toContain("data-hovered");
  expect(first).toContain("data-pressed");
  expect(first).toContain("color-mix");
  expect(first).toContain("cubic-bezier");
});

test("projects_layout_and_semantic_styles_without_literal_colours", () => {
  expect(
    styleProps({ paddingX: "space.2", columns: ["1fr", "40ch"], surface: "surface.raised", tone: "danger" }),
  ).toEqual({
    paddingInline: "var(--lf-value-space-2)",
    gridTemplateColumns: "1fr 40ch",
    backgroundColor: "var(--lf-colour-surface-raised)",
    color: "var(--lf-colour-diagnostic-error)",
  });
  expect(styleProps({ width: "fill", height: "fit", direction: "horizontal", justify: "between" })).toEqual({
    width: "100%",
    height: "fit-content",
    flexDirection: "row",
    justifyContent: "space-between",
  });
});

test("projection_rejects_injection_missing_recipes_and_unresolved_values", () => {
  expect(() =>
    project(
      { ...certifiedTheme, colours: { ...certifiedTheme.colours, "text.primary": "red;display:none" } },
      certifiedDesignSystem,
    ),
  ).toThrow();
  expect(() => project(certifiedTheme, { ...certifiedDesignSystem, recipes: {} })).toThrow();
  expect(() => project(certifiedTheme, { ...certifiedDesignSystem, values: {} })).toThrow();
});
