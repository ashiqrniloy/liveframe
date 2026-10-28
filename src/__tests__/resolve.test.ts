import { expect, test } from "bun:test";
import { resolveRecipes } from "../index.ts";
import { catalog, context, system } from "./design-system.test.ts";

test("alpha_references_resolve_in_inherited_recipes_and_shadow_values", () => {
  const px = { value: 1, unit: "px" } as const;
  const parent = {
    ...system,
    values: {
      ...system.values,
      "opacity.subtle": { kind: "opacity", value: 0.25 },
      "shadow.soft": {
        kind: "shadow",
        value: [{ color: { role: "ink", alpha: "opacity.subtle" }, offsetX: px, offsetY: px, blur: px, spread: px }],
      },
    },
    recipes: {
      ...system.recipes,
      "button.*.root.rest": { textColor: { role: "ink", alpha: "opacity.subtle" }, shadow: "shadow.soft" },
    },
  } as const;
  const child = {
    ...system,
    id: "child",
    extends: "test",
    values: { "opacity.subtle": { kind: "opacity", value: 0.5 } },
    recipes: {},
  } as const;
  const before = JSON.stringify([parent, child]);
  const recipe = resolveRecipes(child, { catalog, registry: { test: parent } })["button.default.root.rest"];
  expect(recipe?.textColor).toEqual({ role: "ink", alpha: 0.5 });
  expect(recipe?.shadow).toEqual([
    { color: { role: "ink", alpha: 0.5 }, offsetX: px, offsetY: px, blur: px, spread: px },
  ]);
  expect(JSON.stringify([parent, child])).toBe(before);
  const broken = { ...child, values: { "opacity.subtle": { kind: "spacing", value: px } } } as const;
  expect(() => resolveRecipes(broken, { catalog, registry: { test: parent } })).toThrow();
});

test("cascade_order", () => {
  const ds = {
    ...system,
    recipes: {
      ...system.recipes,
      "button.*.root.rest": { opacity: 0.1, padding: "space.1" },
      "button.primary.root.rest": { opacity: 0.2 },
      "button.*.root.hover": { opacity: 0.3 },
      "button.primary.root.hover": { opacity: 0.4 },
    },
  };
  const table = resolveRecipes(ds, context);
  expect(table["button.primary.root.rest"]).toEqual({ opacity: 0.2, padding: { value: 4, unit: "px" } });
  expect(table["button.primary.root.hover"]?.opacity).toBe(0.4);
  expect(table["button.default.root.hover"]?.opacity).toBe(0.3);
  expect(table["button.primary.root.open"]?.opacity).toBe(0.2);
  expect(table["button.primary.root.focus"]?.outlineColor).toBe("focus");
  expect(Object.keys(table)).toHaveLength(32);
});
test("extends_merges_properties_and_resolves_child_values", () => {
  const child = {
    ...system,
    id: "child",
    extends: system.id,
    values: { "space.1": { kind: "spacing", value: { value: 8, unit: "rem" } } },
    recipes: { "button.*.root.rest": { opacity: 0.5 } },
  } as const;
  const before = JSON.stringify([system, child]);
  const table = resolveRecipes(child, { catalog, registry: { test: system } });
  expect(table["button.primary.root.rest"]).toEqual({ padding: { value: 8, unit: "rem" }, opacity: 0.5 });
  expect(JSON.stringify([system, child])).toBe(before);
});

test("resolution_preserves_role_names_and_checks_inherited_data", () => {
  const ds = {
    ...system,
    values: { ...system.values, ink: { kind: "opacity", value: 0.5 } },
    recipes: {
      ...system.recipes,
      "button.primary.root.rest": { textColor: "ink", typography: "body", borderStyle: "solid" },
    },
  } as const;
  expect(resolveRecipes(ds, context)["button.primary.root.rest"]).toEqual({
    padding: { value: 4, unit: "px" },
    textColor: "ink",
    typography: "body",
    borderStyle: "solid",
  });
  const broken = { ...system, recipes: { ...system.recipes, "button.*.root.rest": { padding: "missing" } } };
  expect(() =>
    resolveRecipes({ ...system, id: "child", extends: "test", recipes: {} }, { catalog, registry: { test: broken } }),
  ).toThrow();
});
