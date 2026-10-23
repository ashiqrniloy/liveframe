import { expect, test } from "bun:test";
import { designSystemCss, slotClass } from "../css/index.ts";
import { recipeDeclarations } from "../css/recipe.ts";
import { recipeProperties } from "../formats/fixed.ts";
import type { RecipeKey } from "../formats/design-system.ts";
import { type Catalog, type DesignSystem, type ResolvedRecipe, resolveRecipes } from "../index.ts";

const read = (name: string) => Bun.file(new URL(`./fixtures/proof/${name}.json`, import.meta.url)).json();
const catalog: Catalog = await read("catalog");
const systems: DesignSystem[] = await Promise.all([read("certified.design-system"), read("rack.design-system")]);

function sheet(system: DesignSystem, input = catalog, registry: Record<string, DesignSystem> = {}): string {
  const result = designSystemCss(system, { catalog: input, registry });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

test("every_recipe_property_projects", () => {
  const px = { value: 2, unit: "px" } as const;
  const recipe: Required<ResolvedRecipe> = {
    backgroundColor: "surface.base",
    textColor: "text.primary",
    borderColor: "border.hairline",
    outlineColor: "accent.primary",
    borderWidth: px,
    borderTopWidth: px,
    borderRightWidth: px,
    borderBottomWidth: px,
    borderLeftWidth: px,
    borderRadius: px,
    borderStyle: "dashed",
    padding: px,
    paddingX: px,
    paddingY: px,
    gap: px,
    typography: "body",
    opacity: 0.8,
    backgroundOpacity: 0.5,
    shadow: [{ color: "surface.base", offsetX: px, offsetY: px, blur: px, spread: px, inset: true }],
    backdropBlur: px,
    backdropSaturate: 1.2,
    transitionDuration: { value: 0.2, unit: "s" },
    transitionTiming: [0.1, -0.2, 0.3, 1],
    translateY: { value: -1, unit: "rem" },
    outlineWidth: px,
    outlineOffset: px,
    outlineStyle: "solid",
  };
  expect(Object.keys(recipe).sort()).toEqual([...recipeProperties].sort());
  const declarations = recipeDeclarations(recipe).split(";");
  expect(declarations).toEqual([
    "background-color:color-mix(in srgb, var(--lf-c-surface_base) calc(var(--lf-alpha) * 100%), transparent)",
    "color:var(--lf-c-text_primary)",
    "border-color:var(--lf-c-border_hairline)",
    "outline-color:var(--lf-c-accent_primary)",
    "border-width:2px",
    "border-top-width:2px",
    "border-inline-end-width:2px",
    "border-bottom-width:2px",
    "border-inline-start-width:2px",
    "border-radius:2px",
    "border-style:dashed",
    "padding:2px",
    "padding-inline:2px",
    "padding-block:2px",
    "gap:2px",
    "font-family:var(--lf-t-body__fontFamily)",
    "font-size:var(--lf-t-body__fontSize)",
    "font-weight:var(--lf-t-body__fontWeight)",
    "line-height:var(--lf-t-body__lineHeight)",
    "letter-spacing:var(--lf-t-body__letterSpacing)",
    "text-transform:var(--lf-t-body__textTransform)",
    "font-stretch:var(--lf-t-body__fontStretch)",
    "font-size-adjust:var(--lf-t-body__fontSizeAdjust)",
    "opacity:0.8",
    "--lf-alpha:0.5",
    "box-shadow:inset 2px 2px 2px 2px var(--lf-c-surface_base)",
    "backdrop-filter:blur(2px) saturate(1.2)",
    "transition-duration:0.2s",
    "transition-timing-function:cubic-bezier(0.1,-0.2,0.3,1)",
    "translate:0 -1rem",
    "outline-width:2px",
    "outline-offset:2px",
    "outline-style:solid",
    "transition-property:background-color,color,border-color,outline-color,opacity,translate,box-shadow,backdrop-filter",
  ]);
});

test("side_widths_style_only_their_side", () => {
  expect(recipeDeclarations({ borderLeftWidth: { value: 1, unit: "px" } })).toBe(
    "border-inline-start-width:1px;border-inline-start-style:solid",
  );
  expect(recipeDeclarations({ borderWidth: { value: 1, unit: "px" } })).toBe("border-width:1px;border-style:solid");
  expect(recipeDeclarations({ shadow: [] })).toBe("box-shadow:none");
  expect(recipeDeclarations({ backdropSaturate: 0 })).toBe("backdrop-filter:blur(0px) saturate(0)");
  expect(recipeDeclarations({ backdropBlur: { value: 1, unit: "rem" } })).toBe(
    "backdrop-filter:blur(1rem) saturate(1)",
  );
});

test("declared_value_variables_preserve_units_and_inheritance", () => {
  const base = systems[0];
  if (!base) throw new Error("Missing fixture");
  const name = catalog.vocabulary.space[0];
  if (!name) throw new Error("Missing spacing name");
  const derived: DesignSystem = {
    ...base,
    id: "derived",
    extends: base.id,
    recipes: {},
    values: { [name]: { kind: "spacing", value: { value: 1.5, unit: "rem" } } },
  };
  const css = sheet(derived, catalog, { [base.id]: base });
  expect(css).toContain(`--lf-v-${name.replaceAll(".", "_")}:1.5rem`);
  for (const name of [...catalog.vocabulary.space, ...catalog.vocabulary.radius, ...catalog.vocabulary.size]) {
    expect(css).toContain(`--lf-v-${name.replaceAll(".", "_")}:`);
  }
  for (const name of catalog.vocabulary.breakpoints) expect(css).not.toContain(`--lf-v-${name.replaceAll(".", "_")}:`);
});

test("states_equal_to_rest_emit_no_rule", () => {
  for (const system of systems) {
    const resolved = resolveRecipes(system, { catalog, registry: {} });
    const different = Object.entries(resolved).filter(([key, recipe]) => {
      const rest = resolved[`${key.split(".").slice(0, 3).join(".")}.rest` as RecipeKey];
      return key.endsWith(".rest") || recipeDeclarations(recipe ?? {}) !== recipeDeclarations(rest ?? {});
    });
    // Hover has a separate native-hover media rule and a data-attribute rule.
    const hover = different.filter(([key]) => key.endsWith(".hover")).length;
    const open = different.filter(([key]) => key.endsWith(".open")).length;
    const css = sheet(system);
    expect([...css.matchAll(/\{[^{}]*\}/g)].filter((rule) => !rule[0].includes("--lf-r-")).length).toBe(
      1 + different.length + hover + open,
    );
    for (const [key] of different)
      expect(css).toContain(`.${slotClass(...(key.split(".").slice(0, 3) as [string, string, string]))}`);
  }
});

test("slot_class_is_design_system_independent", () => {
  const expected = catalog.definitions
    .flatMap((d) => d.variants.flatMap((variant) => d.slots.map((slot) => slotClass(d.kind, variant, slot))))
    .sort();
  for (const system of systems) {
    const classes = [...sheet(system).matchAll(/^:where\(\[data-lf-ds="[^"\n]+"\]\) \.(lf_[\w-]+)\{/gm)]
      .map((match) => match[1])
      .filter((name) => !name?.startsWith("lf_r_"))
      .sort();
    expect(classes).toEqual(expected);
  }
});

test("every_selector_has_one_class_specificity", () => {
  for (const system of systems) {
    const css = sheet(system);
    for (const [, raw] of css.matchAll(/(?:^|[{}\n])([^{}]+)\{/g)) {
      if (!raw || raw.trim().startsWith("@")) continue;
      let selector = "";
      for (let i = 0; i < raw.length; i++) {
        if (raw.startsWith(":where(", i)) {
          i += 6;
          let depth = 1;
          while (depth && ++i < raw.length) {
            if (raw[i] === "(") depth++;
            if (raw[i] === ")") depth--;
          }
        } else selector += raw[i];
      }
      for (const part of selector.split(",")) {
        if (!part.trim()) continue; // The variable block has specificity zero.
        expect(part.trim()).toMatch(/^\.lf_[\w-]+$/);
      }
    }
  }
});

test("design_system_projection_is_deterministic_and_fails_closed", () => {
  for (const system of systems) {
    const before = JSON.stringify(system);
    const reverse = <T>(value: Record<string, T>) => Object.fromEntries(Object.entries(value).reverse());
    expect(sheet({ ...system, values: reverse(system.values), recipes: reverse(system.recipes) })).toBe(sheet(system));
    expect(JSON.stringify(system)).toBe(before);
    for (const recipe of [{ padding: "missing" }, { textColor: "missing" }, { backgroundColor: "red" }]) {
      const result = designSystemCss(
        { ...system, recipes: { ...system.recipes, "button.primary.root.rest": recipe } },
        { catalog, registry: {} },
      );
      expect(result.ok).toBe(false);
      expect(result).not.toHaveProperty("value");
    }
    expect(designSystemCss(system, { catalog: { ...catalog, catalogId: "!" }, registry: {} }).ok).toBe(false);
  }
});

test("entry_rules_only_where_open_differs", () => {
  for (const system of systems) {
    const resolved = resolveRecipes(system, { catalog, registry: {} });
    const entries = Object.entries(resolved).filter(
      ([key, recipe]) =>
        key.endsWith(".open") &&
        recipeDeclarations(recipe ?? {}) !==
          recipeDeclarations(resolved[key.replace(/\.open$/, ".rest") as RecipeKey] ?? {}),
    );
    const css = sheet(system);
    expect(css.match(/@starting-style\{/g)?.length ?? 0).toBe(entries.length);
    for (const [key] of entries) {
      const cls = slotClass(...(key.split(".").slice(0, 3) as [string, string, string]));
      const rest = recipeDeclarations(resolved[key.replace(/\.open$/, ".rest") as RecipeKey] ?? {});
      expect(
        css
          .split("\n")
          .some(
            (line) =>
              line.startsWith("@starting-style{") && line.includes(`.${cls}:where(`) && line.endsWith(`{${rest}}}`),
          ),
      ).toBe(true);
    }
  }
});
