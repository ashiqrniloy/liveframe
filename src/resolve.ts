import type { Catalog } from "./formats/catalog.ts";
import {
  type DesignSystem,
  type DesignSystemContext,
  prepareDesignSystem,
  type Recipe,
  type RecipeKey,
  type ResolvedRecipe,
} from "./formats/design-system.ts";
import { states } from "./formats/fixed.ts";
import type { LiveframeError } from "./errors.ts";

export type ResolvedRecipes = Readonly<Partial<Record<RecipeKey, ResolvedRecipe>>>;
/** One cascade serves completeness checks and projection output. */
export function cascadeRecipes(
  ds: Pick<DesignSystem, "values" | "recipes">,
  catalog: Catalog,
  reject: (pointer: string, message: string, kind: LiveframeError["kind"]) => void = () => {},
): ResolvedRecipes {
  const table: Partial<Record<RecipeKey, ResolvedRecipe>> = Object.create(null);
  for (const definition of catalog.definitions) {
    const { kind } = definition;
    for (const variant of definition.variants) {
      let focus = false;
      for (const slot of definition.slots) {
        const wildcard = `${kind}.*.${slot}`;
        const specific = `${kind}.${variant}.${slot}`;
        if (!Object.hasOwn(ds.recipes, `${wildcard}.rest`) && !Object.hasOwn(ds.recipes, `${specific}.rest`))
          reject(`/recipes/${specific}.rest`, "Missing rest recipe", "incomplete-design-system");
        focus ||= Object.hasOwn(ds.recipes, `${wildcard}.focus`) || Object.hasOwn(ds.recipes, `${specific}.focus`);
        for (const state of states) {
          const merged: Recipe = {
            ...ds.recipes[`${wildcard}.rest` as RecipeKey],
            ...ds.recipes[`${specific}.rest` as RecipeKey],
            ...ds.recipes[`${wildcard}.${state}` as RecipeKey],
            ...ds.recipes[`${specific}.${state}` as RecipeKey],
          };
          table[`${specific}.${state}` as RecipeKey] = Object.fromEntries(
            Object.entries(merged).map(([property, value]) => [
              property,
              typeof value === "string" &&
              Object.hasOwn(ds.values, value) &&
              ![
                "backgroundColor",
                "textColor",
                "borderColor",
                "outlineColor",
                "typography",
                "borderStyle",
                "outlineStyle",
              ].includes(property)
                ? ds.values[value]?.value
                : value,
            ]),
          );
        }
      }
      if (Object.keys(definition.events).length && !focus)
        reject(
          `/recipes/${kind}.${variant}.root.focus`,
          "Missing focus overlay for interactive kind",
          "incomplete-design-system",
        );
    }
  }
  return table;
}
/** Resolve installed data into a flat table. Validate first; invalid input throws with install errors. */
export function resolveRecipes(ds: DesignSystem, context: DesignSystemContext): ResolvedRecipes {
  const result = prepareDesignSystem(ds, context);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return cascadeRecipes(result.value, context.catalog);
}
