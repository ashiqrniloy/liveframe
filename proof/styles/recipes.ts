import { definitions } from "../catalog/definitions.ts";
import { type Recipe, type RecipeKey, states } from "./types.ts";

// Each slot must be intentional; unspecified states keep that slot's rest style.
export function completeRecipes(seeds: Readonly<Record<string, Recipe>>): Record<RecipeKey, Recipe> {
  const recipes: Record<RecipeKey, Recipe> = {};
  for (const definition of definitions) {
    for (const variant of definition.variants) {
      for (const slot of definition.slots) {
        const prefix = `${definition.kind}.${variant}.${slot}` as const;
        const rest = seeds[`${prefix}.rest`];
        if (!rest) throw new Error(`Missing rest recipe: ${prefix}.rest`);
        for (const state of states) recipes[`${prefix}.${state}`] = { ...rest, ...seeds[`${prefix}.${state}`] };
      }
    }
  }
  return recipes;
}
