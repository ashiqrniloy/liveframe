import { definitions } from "../catalog/definitions.ts";
import { type Recipe, type RecipeKey, states } from "./types.ts";

// Native scrollbar colours are rest-only: states inherit them through the cascade.
const restOnly = new Set(["scrollbarThumbColor", "scrollbarTrackColor"]);

// Each slot must be intentional; unspecified states keep that slot's rest style.
export function completeRecipes(seeds: Readonly<Record<string, Recipe>>): Record<RecipeKey, Recipe> {
  const recipes: Record<RecipeKey, Recipe> = {};
  for (const definition of definitions) {
    for (const variant of definition.variants) {
      for (const slot of definition.slots) {
        const prefix = `${definition.kind}.${variant}.${slot}` as const;
        const rest = seeds[`${prefix}.rest`];
        if (!rest) throw new Error(`Missing rest recipe: ${prefix}.rest`);
        const inherited = Object.fromEntries(Object.entries(rest).filter(([property]) => !restOnly.has(property)));
        for (const state of states)
          recipes[`${prefix}.${state}`] = { ...(state === "rest" ? rest : inherited), ...seeds[`${prefix}.${state}`] };
      }
    }
  }
  return recipes;
}
