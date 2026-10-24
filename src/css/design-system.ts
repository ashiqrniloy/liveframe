import type { Result } from "../errors.ts";
import { validateCatalog } from "../formats/catalog.ts";
import {
  type DesignSystem,
  type DesignSystemContext,
  prepareDesignSystem,
  type RecipeKey,
} from "../formats/design-system.ts";
import { resolveRecipes } from "../resolve.ts";
import { forcedEdgeDeclarations, forcedStateDeclarations } from "./forced-colours.ts";
import { cssString, slotClass, valueVar } from "./names.ts";
import { recipeDeclarations } from "./recipe.ts";
import { responsiveRules } from "./style-props.ts";

export const stateSelectors = {
  rest: "",
  hover: "[data-hovered]",
  focus: ":focus-visible,[data-focus-visible],:has(:focus-visible)",
  active: ":active,[data-pressed]",
  open: "[open],[data-open],[data-expanded],[aria-expanded=true],:popover-open",
  selected: "[data-selected],[aria-selected=true],[aria-checked=true]",
  invalid: ":user-invalid,[data-invalid],[aria-invalid=true]",
  disabled: ":disabled,[data-disabled],[aria-disabled=true]",
} as const;

/** The projection and conformance compare emitted declarations, including resolved defaults. */
export function stateDeclarations(recipe: Parameters<typeof recipeDeclarations>[0], rest: string) {
  const body = recipeDeclarations(recipe);
  return body === rest ? undefined : body;
}

function selector(scope: string, cls: string, root: string, condition: string, guarded: boolean): string {
  const disabled = stateSelectors.disabled;
  // A slot's own hover/press must also be suppressed when its root is disabled.
  const guard = guarded ? `:where(:not(${disabled})):where(:not(${root}:is(${disabled}) *))` : "";
  const own = `${scope} ${cls}:where(${condition})${guard}`;
  return cls === root ? own : `${own},${scope} :where(${root}:is(${condition})) ${cls}${guard}`;
}

/** Projects installed values and resolved recipes without depending on a theme or host API. */
export function designSystemCss(system: DesignSystem, context: DesignSystemContext): Result<string> {
  const catalog = validateCatalog(context.catalog);
  if (!catalog.ok) return catalog;
  const prepared = prepareDesignSystem(system, context);
  if (!prepared.ok) return prepared;
  const resolved = resolveRecipes(system, context);
  const scope = `:where([data-lf-ds=${cssString(`${system.id}@${system.version}`)}])`;
  const names = [
    ...context.catalog.vocabulary.space,
    ...context.catalog.vocabulary.radius,
    ...context.catalog.vocabulary.size,
  ].sort();
  const variables = names.map((name) => {
    const token = prepared.value.values[name];
    if (token && (token.kind === "spacing" || token.kind === "radius" || token.kind === "size"))
      return `${valueVar(name)}:${token.value.value}${token.value.unit}`;
    return "";
  });
  const rules = [`${scope}{${variables.join(";")}}`];
  const forced = [];
  for (const [state, condition] of Object.entries(stateSelectors)) {
    for (const definition of [...context.catalog.definitions].sort((a, b) =>
      a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0,
    )) {
      for (const variant of [...definition.variants].sort()) {
        const root = `.${slotClass(definition.kind, variant, "root")}`;
        for (const slot of [...definition.slots].sort()) {
          const key = `${definition.kind}.${variant}.${slot}` as const;
          const restRecipe = resolved[`${key}.rest`] ?? {};
          const rest = recipeDeclarations(restRecipe);
          const body =
            state === "rest" ? rest : stateDeclarations(resolved[`${key}.${state}` as RecipeKey] ?? {}, rest);
          const cls = `.${slotClass(definition.kind, variant, slot)}`;
          if (state === "rest") {
            rules.push(`${scope} ${cls}{${body}}`);
            const edge = forcedEdgeDeclarations(restRecipe);
            if (edge) forced.push(`${scope} ${cls}{${edge}}`);
          } else if (body !== undefined) {
            const guarded = state === "hover" || state === "active";
            const target = selector(scope, cls, root, condition, guarded);
            rules.push(`${target}{${body}}`);
            const cue = forcedStateDeclarations[state as keyof typeof forcedStateDeclarations];
            forced.push(`${target}{${cue}}`);
            if (state === "open")
              rules.push(`@starting-style{${selector(scope, cls, root, condition, false)}{${rest}}}`);
            if (state === "hover") {
              rules.push(`@media (hover:hover){${selector(scope, cls, root, ":hover", true)}{${body}}}`);
              forced.push(`@media (hover:hover){${selector(scope, cls, root, ":hover", true)}{${cue}}}`);
            }
          }
        }
      }
    }
  }
  const breakpoints = context.catalog.vocabulary.breakpoints
    .map((name) => {
      const token = prepared.value.values[name];
      if (token?.kind !== "breakpoint") throw new Error(`Missing installed breakpoint: ${name}`);
      return {
        name,
        value: `${token.value.value}${token.value.unit}`,
        // shortcut: mixed px/rem ordering assumes a 16px root; revisit for hosts with other root sizes.
        width: token.value.value * (token.value.unit === "rem" ? 16 : 1),
      };
    })
    .sort((a, b) => a.width - b.width || a.name.localeCompare(b.name));
  rules.push(responsiveRules(scope, breakpoints));
  rules.push(`@media (forced-colors:active){${forced.join("")}}`);
  return { ok: true, value: rules.join("\n") };
}
