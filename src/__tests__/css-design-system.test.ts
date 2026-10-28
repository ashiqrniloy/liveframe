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

test("alpha_projection_byte_stable", () => {
  const declarations = recipeDeclarations({
    backgroundColor: { role: "surface.base", alpha: 0.1234 },
    backgroundOpacity: 0.5,
    textColor: { role: "text.primary", alpha: 0 },
    borderColor: { role: "border.hairline", alpha: 1 },
  });
  expect(declarations).toBe(
    "background-color:color-mix(in srgb, color-mix(in oklab, var(--lf-c-surface_base) 12.34%, transparent) calc(var(--lf-alpha) * 100%), transparent);color:color-mix(in oklab, var(--lf-c-text_primary) 0%, transparent);border-color:color-mix(in oklab, var(--lf-c-border_hairline) 100%, transparent);--lf-alpha:0.5",
  );
  const base = systems[0];
  if (!base) throw new Error("Missing fixture");
  const css = sheet({
    ...base,
    recipes: {
      ...base.recipes,
      "button.default.root.rest": { backgroundColor: { role: "surface.base", alpha: 0 } },
      "button.default.root.open": { backgroundColor: { role: "surface.hover", alpha: 0.5 } },
    },
  });
  const reduced = css
    .split("@media (prefers-reduced-transparency:reduce){")[1]
    ?.split("@media (forced-colors:active){")[0];
  expect(reduced).toContain("@starting-style{");
  expect(reduced).not.toContain("color-mix(in oklab");
});

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
    placeholderColor: "text.muted",
    scrollbarThumbColor: "surface.scrollbar",
    scrollbarTrackColor: "surface.well",
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
    "scrollbar-color:var(--lf-c-surface_scrollbar) var(--lf-c-surface_well)",
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
    const css = sheet(system).split(
      /@media \(prefers-reduced-transparency:reduce\)|@media \(forced-colors:active\)/,
    )[0]!;
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
    const css = sheet(system).split("@media (prefers-reduced-transparency:reduce){")[0] ?? "";
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

test("forced_colours_only_restore_differing_states_and_background_edges", () => {
  const base = systems[0]!;
  for (const border of [
    undefined,
    "borderWidth",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
  ] as const) {
    for (const width of [0, 1]) {
      const rest = {
        backgroundColor: "surface.base",
        ...(border ? { [border]: { value: width, unit: "px" } } : {}),
      } as const;
      const recipes = Object.fromEntries(
        ["rest", "hover", "active", "focus", "disabled", "selected", "invalid", "open"].map((state) => [
          `button.primary.root.${state}`,
          rest,
        ]),
      );
      const projected = sheet({ ...base, recipes: { ...base.recipes, ...recipes } });
      const forced = projected.split("@media (forced-colors:active){")[1];
      expect(forced).toBeDefined();
      const rules = [...forced!.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((match) =>
        match[1]?.includes(".lf_button_primary_root"),
      );
      expect(rules.length).toBe(!border || width === 0 ? 1 : 0);
      if (rules.length) expect(rules[0]?.[2]).toBe("outline:1px solid CanvasText;outline-offset:-1px");
    }
  }
});

test("none_clears_rest_background_byte_stable", () => {
  const input = {
    ...systems[0]!,
    recipes: {
      ...systems[0]!.recipes,
      "button.*.root.rest": { backgroundColor: "surface.base" },
      "button.default.root.rest": {
        backgroundColor: "none",
        borderColor: "none",
        outlineColor: "none",
        backgroundOpacity: 0.5,
      },
    },
  } satisfies DesignSystem;
  const resolved = resolveRecipes(input, { catalog, registry: {} });
  expect(resolved["button.default.root.rest"]?.backgroundColor).toBe("none");
  expect(recipeDeclarations(resolved["button.default.root.rest"]!)).toBe(
    "background-color:transparent;border-color:transparent;outline-color:transparent;--lf-alpha:0.5",
  );
  const css = sheet(input);
  expect(css).toBe(sheet(input));
  const ordinary = css.split("@media (forced-colors:active){")[0]!;
  expect(ordinary).toContain("background-color:transparent;border-color:transparent;outline-color:transparent");
  expect(ordinary).not.toContain("--lf-c-none");
  expect(ordinary).not.toMatch(/#[0-9a-f]{3,8}\b|(?:oklch|oklab|rgb|hsl)\(/i);
  expect(ordinary.replaceAll("transparent", "")).not.toMatch(/(?:CanvasText|Highlight|currentColor|\bred\b)/);
});

const withRecipes = (recipes: Record<string, unknown>): DesignSystem => ({
  ...systems[0]!,
  recipes: { ...systems[0]!.recipes, ...recipes },
});
const between = (css: string, from: string, to: string) => css.split(from)[1]?.split(to)[0] ?? "";

test("scrollbar_projection_byte_stable", () => {
  expect(
    recipeDeclarations({
      scrollbarThumbColor: "surface.scrollbar",
      scrollbarTrackColor: "none",
    }),
  ).toBe("scrollbar-color:var(--lf-c-surface_scrollbar) transparent");
  expect(
    recipeDeclarations({
      scrollbarThumbColor: { role: "surface.scrollbar", alpha: 0.5 },
      scrollbarTrackColor: { role: "surface.well", alpha: 1 },
    }),
  ).toBe(
    "scrollbar-color:color-mix(in oklab, var(--lf-c-surface_scrollbar) 50%, transparent) color-mix(in oklab, var(--lf-c-surface_well) 100%, transparent)",
  );
  const input = withRecipes({
    "button.default.root.rest": { scrollbarThumbColor: "surface.scrollbar", scrollbarTrackColor: "none" },
    "button.default.root.hover": { placeholderColor: "text.muted" },
  });
  const css = sheet(input);
  expect(css).toBe(sheet(input));
  expect(css).toContain(
    ':where([data-lf-ds="certified@1.0.0"]) .lf_button_default_root{scrollbar-color:var(--lf-c-surface_scrollbar) transparent}',
  );
  // The pair is rest-only, so every state that inherits it repeats the same value.
  expect(new Set(css.match(/scrollbar-color:[^;}]*/g))).toEqual(
    new Set(["scrollbar-color:var(--lf-c-surface_scrollbar) transparent", "scrollbar-color:auto"]),
  );
  expect(css).toContain("::placeholder{color:var(--lf-c-text_muted);opacity:1}");
  expect(css).not.toContain("-webkit-scrollbar");
});

test("placeholder_projects_through_the_state_selector_builder", () => {
  const css = sheet(
    withRecipes({
      "button.default.root.rest": { placeholderColor: "text.muted" },
      "button.default.root.hover": { placeholderColor: { role: "text.primary", alpha: 0.5 } },
      "button.default.root.disabled": { placeholderColor: "none" },
    }),
  );
  const ordinary = css.split("@media (forced-colors:active){")[0]!;
  const root = ".lf_button_default_root";
  expect(ordinary).toContain(`${root}::placeholder{color:var(--lf-c-text_muted);opacity:1}`);
  expect(ordinary).toContain(
    `${root}:where([data-hovered]):where(:not(:disabled,[data-disabled],[aria-disabled=true])):where(:not(${root}:is(:disabled,[data-disabled],[aria-disabled=true]) *))::placeholder{color:color-mix(in oklab, var(--lf-c-text_primary) 50%, transparent);opacity:1}`,
  );
  expect(ordinary).toContain(
    `${root}:where(:disabled,[data-disabled],[aria-disabled=true])::placeholder{color:transparent;opacity:1}`,
  );
  expect(ordinary).toContain("@media (hover:hover)");
  // A state that only repeats the rest placeholder gets no rule.
  expect(ordinary.match(/\[data-selected\][^{]*::placeholder/g)).toBeNull();
});

test("native_parts_resolve_alpha_and_recover_reduced_transparency", () => {
  const css = sheet(
    withRecipes({
      "button.default.root.rest": {
        scrollbarThumbColor: { role: "surface.scrollbar", alpha: 0 },
        scrollbarTrackColor: { role: "surface.well", alpha: "opacity.disabled" },
        placeholderColor: { role: "text.muted", alpha: 0 },
      },
      "button.default.root.hover": { placeholderColor: { role: "text.primary", alpha: 0.5 } },
    }),
  );
  const reduced = between(css, "@media (prefers-reduced-transparency:reduce){", "@media (forced-colors:active){");
  expect(reduced).toContain("scrollbar-color:var(--lf-c-surface_scrollbar) var(--lf-c-surface_well)");
  expect(reduced).toContain("::placeholder{color:var(--lf-c-text_muted);opacity:1}");
  expect(reduced).toContain("::placeholder{color:var(--lf-c-text_primary);opacity:1}");
  expect(reduced).not.toContain("color-mix");
  expect(css).toContain("color-mix(in oklab, var(--lf-c-surface_scrollbar) 0%, transparent)");
});

test("native_parts_no_system_colour_outside_forced_block", () => {
  const css = sheet(
    withRecipes({
      "button.default.root.rest": {
        scrollbarThumbColor: "surface.scrollbar",
        scrollbarTrackColor: "none",
        placeholderColor: "text.muted",
      },
      "button.default.label.hover": { placeholderColor: "text.muted" },
    }),
  );
  const [ordinary, forced] = [
    css.split("@media (forced-colors:active){")[0]!,
    css.split("@media (forced-colors:active){")[1]!,
  ];
  expect(ordinary).not.toMatch(/GrayText|CanvasText|Highlight|\bauto\b/);
  expect(ordinary.replaceAll("transparent", "")).not.toMatch(/#[0-9a-f]{3,8}\b|(?:oklch|rgb|hsl)\(/i);
  expect(forced).toContain(".lf_button_default_root{scrollbar-color:auto}");
  expect(forced).toContain(".lf_button_default_root::placeholder{color:GrayText;opacity:1}");
  // The placeholder restore also covers a slot that sets it only in a state.
  expect(forced).toContain(".lf_button_default_label::placeholder{color:GrayText;opacity:1}");
  expect(forced).not.toContain("scrollbar-color:var");
});
