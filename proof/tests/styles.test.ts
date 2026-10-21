import { expect, test } from "bun:test";
import { definitions } from "../catalog/definitions.ts";
import { certifiedDesignSystem } from "../styles/certified/design-system.ts";
import { certifiedTheme } from "../styles/certified/theme.ts";
import { rackDesignSystem, rackSourceRecipes, rackSourceValues } from "../styles/rack/design-system.ts";
import { rackTheme } from "../styles/rack/theme.ts";
import { completeRecipes } from "../styles/recipes.ts";
import { colourRoles, type DesignSystem, propertyTypes, states, type Theme, typographyRoles } from "../styles/types.ts";

const systems = [certifiedDesignSystem, rackDesignSystem];
const themes = [certifiedTheme, rackTheme];
const literalColour =
  /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color|color-mix)\s*\(|^(?:transparent|red|blue|white|black|currentColor)$/i;

function checkStyleData(system: DesignSystem, theme: Theme): void {
  function checkValue(domain: string, value: unknown): void {
    if (domain === "colour") {
      if (typeof value !== "string" || !Object.hasOwn(theme.colours, value))
        throw new Error(`Unknown colour: ${value}`);
    } else if (domain === "typography") {
      if (typeof value !== "string" || !Object.hasOwn(theme.typography, value))
        throw new Error(`Unknown typography: ${value}`);
    } else if (typeof value === "string") {
      const token = system.values[value];
      if (!token || token.type !== domain) throw new Error(`Wrong token: ${value} for ${domain}`);
      checkValue(domain, token.value);
    } else if (domain === "shadow") {
      if (!Array.isArray(value)) throw new Error("Invalid shadow");
      for (const layer of value) {
        checkValue("colour", layer.colorRole);
        for (const key of ["x", "y", "blur", "spread"]) {
          if (!Number.isFinite(layer[key]) || Math.abs(layer[key]) > 256) throw new Error("Invalid shadow geometry");
        }
        checkValue("opacity", layer.opacity);
        if (layer.blur < 0 || (layer.inset !== undefined && typeof layer.inset !== "boolean"))
          throw new Error("Invalid shadow layer");
      }
    } else if (domain === "easing") {
      if (!Array.isArray(value) || value.length !== 4 || value.some((n) => !Number.isFinite(n) || n < 0 || n > 1))
        throw new Error("Invalid easing");
    } else {
      const max = domain === "opacity" ? 1 : domain === "motion-duration" ? 10000 : domain === "radius" ? 10000 : 256;
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max)
        throw new Error(`Invalid ${domain}`);
    }
  }
  for (const token of Object.values(system.values)) checkValue(token.type, token.value);
  for (const [key, recipe] of Object.entries(system.recipes)) {
    expect(key.split(".")).toHaveLength(4);
    expect(states.some((state) => state === key.split(".")[3])).toBe(true);
    for (const [property, value] of Object.entries(recipe)) {
      if (!Object.hasOwn(propertyTypes, property)) throw new Error(`Unknown property: ${property}`);
      const domain = propertyTypes[property as keyof typeof propertyTypes];
      if (domain === "line-style") {
        if (!["solid", "dashed", "none"].includes(String(value))) throw new Error("Invalid line style");
      } else if (domain === "transform") {
        if (!["none", "press-shift-down"].includes(String(value))) throw new Error("Invalid transform");
      } else checkValue(domain, value);
    }
  }
}

test("design_systems_are_complete_for_the_catalog", () => {
  for (const system of systems) {
    const keys: string[] = [];
    for (const definition of definitions)
      for (const variant of definition.variants)
        for (const slot of definition.slots)
          for (const state of states) {
            const key = `${definition.kind}.${variant}.${slot}.${state}`;
            keys.push(key);
            expect(Object.hasOwn(system.recipes, key)).toBe(true);
          }
    expect(Object.keys(system.recipes).sort()).toEqual(keys.sort());
    expect(JSON.parse(JSON.stringify(system))).toEqual(system);
  }
});

test("recipe_completion_requires_each_slot_and_inherits_rest", () => {
  expect(() => completeRecipes({})).toThrow("Missing rest recipe");
  const seeds = Object.fromEntries(
    Object.entries(certifiedDesignSystem.recipes).filter(([key]) => key.endsWith(".rest")),
  );
  delete seeds["button.primary.label.rest"];
  expect(() => completeRecipes(seeds)).toThrow("button.primary.label.rest");
  seeds["button.primary.label.rest"] = {};
  seeds["button.primary.root.hover"] = { backgroundColor: "surface.hover" };
  const recipes = completeRecipes(seeds);
  expect(recipes["button.primary.root.hover"]).toEqual({
    ...seeds["button.primary.root.rest"],
    backgroundColor: "surface.hover",
  });
  expect(recipes["button.primary.root.open"]).toEqual(seeds["button.primary.root.rest"]);
});

test("themes_share_one_complete_role_vocabulary", () => {
  for (const theme of themes) {
    expect(Object.keys(theme.colours).sort()).toEqual([...colourRoles].sort());
    expect(Object.keys(theme.typography).sort()).toEqual([...typographyRoles].sort());
    for (const colour of Object.values(theme.colours)) expect(colour).toMatch(literalColour);
    for (const typography of Object.values(theme.typography)) {
      expect(typography.fontFamily.length).toBeGreaterThan(0);
      expect(typography.fontSize).toBeGreaterThan(0);
      expect(typography.lineHeight).toBeGreaterThanOrEqual(1);
    }
  }
});

test("no_colour_outside_themes", async () => {
  for (const system of systems) {
    function inspect(value: unknown): void {
      if (typeof value === "string") expect(value).not.toMatch(literalColour);
      else if (value && typeof value === "object") for (const child of Object.values(value)) inspect(child);
    }
    inspect(system);
  }
  const root = new URL("../styles/", import.meta.url);
  for (const path of new Bun.Glob("**/*.ts").scanSync({ cwd: root.pathname })) {
    if (path.endsWith("/theme.ts")) continue;
    expect(await Bun.file(new URL(path, root)).text()).not.toMatch(
      /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|color-mix)\s*\(/i,
    );
  }
});

test("recipes_reference_only_declared_roles_and_values", () => {
  for (const system of systems) for (const theme of themes) checkStyleData(system, theme);
});

test("style_checks_reject_unknown_roles_literals_and_wrong_value_domains", () => {
  for (const recipe of [
    { textColor: "missing.role" },
    { textColor: "red" },
    { textColor: "#fff" },
    { padding: "space.missing" },
    { padding: "radius.control" },
    { padding: "12px" },
    { opacity: 2 },
    { borderRadius: -1 },
    { transitionTiming: "ease" },
    { style: "display:none" },
    { shadow: [{ x: 0, y: 0, blur: 1, spread: 0, colorRole: "missing.role", opacity: 1 }] },
  ]) {
    const malformed = {
      ...certifiedDesignSystem,
      recipes: { "box.default.root.rest": recipe },
    } as unknown as DesignSystem;
    expect(() => checkStyleData(malformed, certifiedTheme)).toThrow();
  }
});

test("rack_preserves_all_247_source_recipes_and_values", async () => {
  const source = (
    await Bun.file(new URL("../references/clay/packages/design-rack/package.json", import.meta.url)).json()
  ).clay.contributions.uiDesignSystem;
  expect(Object.keys(rackSourceRecipes)).toHaveLength(247);
  for (const recipe of Object.values(source.recipes) as Record<string, unknown>[]) {
    if (recipe.backgroundColor === "transparent") recipe.backgroundColor = "colour.transparent";
  }
  expect(rackSourceRecipes).toEqual(source.recipes);
  expect(rackSourceValues).toEqual(source.values);
  expect(rackDesignSystem.recipes["textField.default.input.focus"]).toMatchObject(
    source.recipes["textInput.default.input.focus"],
  );
  expect(rackDesignSystem.recipes["button.ghost.root.rest"]).toMatchObject(source.recipes["button.muted.root.rest"]);
  expect(rackDesignSystem.recipes["tab.default.root.selected"]).toMatchObject(
    source.recipes["seg.default.item.selected"],
  );
});

test("translated_rack_source_also_resolves_against_both_themes", () => {
  for (const theme of themes) checkStyleData({ ...rackDesignSystem, recipes: rackSourceRecipes }, theme);
});

test("themes_keep_reference_colour_authority", async () => {
  const source = (
    await Bun.file(new URL("../references/clay/packages/theme-modus-operandi/package.json", import.meta.url)).json()
  ).clay.contributions;
  for (const token of source.designTokens)
    expect((rackTheme.colours as Record<string, string>)[token.token]).toBe(token.value);
  const text = source.textStyles.find((token: { token: string }) => token.token === "text");
  const scrollbar = source.textStyles.find((token: { token: string }) => token.token === "scrollbar");
  expect(rackTheme.colours["text.primary"]).toBe(text.color);
  expect(rackTheme.colours["surface.scrollbar"]).toBe(scrollbar.color);
  const artifact = await Bun.file(
    new URL("../references/synapta-core/design-artifacts/approved/agent-home-certified.html", import.meta.url),
  ).text();
  const roles = {
    "surface.base": "bg",
    "surface.module": "surface",
    "text.primary": "fg",
    "text.muted": "muted",
    "accent.fill": "primary",
    "text.on-accent": "on-primary",
    "focus.ring": "focus",
  } as const;
  for (const [role, token] of Object.entries(roles))
    expect(artifact.match(new RegExp(`--${token}: ([^;]+);`))?.[1]).toBe(
      certifiedTheme.colours[role as keyof typeof roles],
    );
});
