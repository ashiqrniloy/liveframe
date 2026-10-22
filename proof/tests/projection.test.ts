import { expect, test } from "bun:test";
import { definitions } from "../catalog/definitions.ts";
import { project, responsiveClasses, slotClasses, styleProps } from "../css/project.ts";
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
      for (const slot of definition.slots) {
        // Every slot keeps its rest class; a state class carries a rule only when it differs from rest.
        const classes = slotClasses(definition.kind, variant, slot).split(" ");
        expect(first).toContain(`.${classes[0]}`);
        expect(second).toContain(`.${classes[0]}`);
        const rest = `${definition.kind}.${variant}.${slot}.rest` as const;
        for (const state of states)
          for (const [recipes, css] of [
            [certifiedDesignSystem.recipes, first],
            [rackDesignSystem.recipes, second],
          ] as const) {
            const differs =
              state !== "rest" &&
              JSON.stringify(recipes[`${definition.kind}.${variant}.${slot}.${state}`]) !==
                JSON.stringify(recipes[rest]);
            if (differs) expect(css).toContain(`.${classes[states.indexOf(state)]}`);
          }
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
    gridTemplateColumns: "minmax(0, 1fr) 40ch",
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

test("responsive_values_project_to_fixed_rules_and_custom_properties", () => {
  const columns = { base: ["1fr"], "bp.md": ["1fr", "size.rail"] };
  expect(styleProps({ columns }) as Record<string, string>).toEqual({
    "--lf-r-columns-base-gridTemplateColumns": "minmax(0, 1fr)",
    "--lf-r-columns-bp-md-gridTemplateColumns": "minmax(0, 1fr) var(--lf-value-size-rail)",
  });
  expect(responsiveClasses({ columns, gap: "space.2" })).toBe("lf-r-columns");
  expect(slotClasses("grid", "default", "root", { columns })).toContain("lf-r-columns");
  expect(slotClasses("grid", "default", "root", { gap: "space.2" })).not.toContain("lf-r-");
  expect(styleProps({ width: "size.rail" })).toEqual({ width: "var(--lf-value-size-rail)" });
  expect(styleProps({ columns: ["space.4", "1fr", "fit"] })).toEqual({
    gridTemplateColumns: "var(--lf-value-space-4) minmax(0, 1fr) auto",
  });
  expect(styleProps({ radius: "full" })).toEqual({ borderRadius: "9999px" });
  expect(styleProps({ position: "sticky", insetTop: "space.4" })).toEqual({
    position: "sticky",
    top: "var(--lf-value-space-4)",
  });
  const css = project(certifiedTheme, certifiedDesignSystem);
  expect(css).toContain(".lf-r-columns{grid-template-columns:var(--lf-r-columns-base-gridTemplateColumns)}");
  expect(css).toContain("@container (min-width:720px)");
  expect(css).toContain(
    "var(--lf-r-columns-bp-md-gridTemplateColumns,var(--lf-r-columns-bp-sm-gridTemplateColumns,var(--lf-r-columns-base-gridTemplateColumns)))",
  );
  expect(css).toContain(".lf-container{container-type:inline-size}");
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

test("per_side_border_widths_project_to_their_css_sides", () => {
  const system = {
    ...certifiedDesignSystem,
    recipes: {
      ...certifiedDesignSystem.recipes,
      "separator.default.root.rest": {
        borderColor: "border.hairline",
        borderTopWidth: "border.hairline",
        borderRightWidth: 0,
        borderBottomWidth: "border.hairline",
        borderLeftWidth: 2,
      },
    },
  } as const;
  const css = project(certifiedTheme, system);
  const rule = css.match(/\.lf-separator-default-root-rest\{[^}]*\}/)?.[0] ?? "";
  expect(rule).toContain("border-top-width:var(--lf-value-border-hairline)");
  expect(rule).toContain("border-right-width:0px");
  expect(rule).toContain("border-bottom-width:var(--lf-value-border-hairline)");
  expect(rule).toContain("border-left-width:2px");
  expect(rule).toContain("border-top-style:solid");
  expect(rule).toContain("border-left-style:solid");
  expect(rule).not.toContain("border-width:");
  expect(rule).not.toMatch(/[^-]border-style:/);
});

test("typography_tracking_and_case_project_with_defaults", () => {
  const css = project(certifiedTheme, certifiedDesignSystem);
  expect(css).toContain("--lf-type-overline-letterSpacing:0.06em");
  expect(css).toContain("--lf-type-overline-textTransform:uppercase");
  expect(css).toContain("--lf-type-body-letterSpacing:0em");
  expect(css).toContain("--lf-type-body-textTransform:none");
  expect(css).toContain(".lf-surface{font-family:");
  expect(css).toMatch(/\.lf-surface\{[^}]*letter-spacing:var\(--lf-type-body-letterSpacing\)/);
  expect(css).toMatch(/\.lf-surface\{[^}]*text-transform:var\(--lf-type-body-textTransform\)/);
  expect(styleProps({ textStyle: "overline" })).toMatchObject({
    letterSpacing: "var(--lf-type-overline-letterSpacing)",
    textTransform: "var(--lf-type-overline-textTransform)",
  });
  expect(() =>
    project(
      {
        ...certifiedTheme,
        typography: { ...certifiedTheme.typography, body: { ...certifiedTheme.typography.body, letterSpacing: 0.4 } },
      },
      certifiedDesignSystem,
    ),
  ).toThrow("Invalid letterSpacing");
  expect(() =>
    project(
      {
        ...certifiedTheme,
        typography: {
          ...certifiedTheme.typography,
          body: { ...certifiedTheme.typography.body, textTransform: "capitalize" as "uppercase" },
        },
      },
      certifiedDesignSystem,
    ),
  ).toThrow("Invalid textTransform");
});
