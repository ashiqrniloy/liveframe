import type { Result } from "../errors.ts";
import type { Definition } from "../formats/catalog.ts";
import { validateCatalog } from "../formats/catalog.ts";
import {
  type DesignSystem,
  type DesignSystemContext,
  type DesignValue,
  prepareDesignSystem,
  type RecipeKey,
  type ResolvedRecipe,
} from "../formats/design-system.ts";
import type { ColourValue, ShadowLayer } from "../formats/dtcg.ts";
import { cascadeRecipes } from "../resolve.ts";
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

/** Installed spacing, radius and size values as CSS custom properties. */
function tokenVariables(
  prepared: { readonly values: Readonly<Record<string, DesignValue>> },
  vocabulary: DesignSystemContext["catalog"]["vocabulary"],
): string[] {
  const names = [...vocabulary.space, ...vocabulary.radius, ...vocabulary.size].sort();
  return names.map((name) => {
    const token = prepared.values[name];
    if (token && (token.kind === "spacing" || token.kind === "radius" || token.kind === "size"))
      return `${valueVar(name)}:${token.value.value}${token.value.unit}`;
    return "";
  });
}

function unmodifiedColours(recipe: ResolvedRecipe): ResolvedRecipe {
  const colour = (value: ColourValue<number>) => (typeof value === "string" ? value : value.role);
  const layer = (value: ShadowLayer<number>): ShadowLayer<number> => ({ ...value, color: colour(value.color) });
  return Object.fromEntries(
    Object.entries(recipe).flatMap<[string, unknown]>(([property, value]) => {
      if (["backgroundColor", "textColor", "borderColor", "outlineColor"].includes(property))
        return [[property, colour(value as ColourValue<number>)]];
      if (property === "shadow")
        return [[property, Array.isArray(value) ? value.map(layer) : layer(value as ShadowLayer<number>)]];
      return [];
    }),
  );
}

/** The rules for one slot in one state, pushed into `rules` and `forced`. */
function slotRules(
  scope: string,
  definition: Definition,
  variant: string,
  slot: string,
  state: string,
  condition: string,
  resolved: Readonly<Partial<Record<RecipeKey, ResolvedRecipe>>>,
  rules: string[],
  forced: string[],
  reduced: string[],
  alphaSlots: ReadonlySet<string>,
): void {
  const key = `${definition.kind}.${variant}.${slot}` as const;
  const root = `.${slotClass(definition.kind, variant, "root")}`;
  const restRecipe = resolved[`${key}.rest`] ?? {};
  const rest = recipeDeclarations(restRecipe);
  const body = state === "rest" ? rest : stateDeclarations(resolved[`${key}.${state}` as RecipeKey] ?? {}, rest);
  const cls = `.${slotClass(definition.kind, variant, slot)}`;
  if (body === undefined) return;
  const reducedBody = alphaSlots.has(key)
    ? recipeDeclarations(unmodifiedColours(resolved[`${key}.${state}` as RecipeKey] ?? {}))
    : "";
  if (state === "rest") {
    rules.push(`${scope} ${cls}{${body}}`);
    if (reducedBody) reduced.push(`${scope} ${cls}{${reducedBody}}`);
    const edge = forcedEdgeDeclarations(restRecipe);
    if (edge) forced.push(`${scope} ${cls}{${edge}}`);
    return;
  }
  const guarded = state === "hover" || state === "active";
  const target = selector(scope, cls, root, condition, guarded);
  rules.push(`${target}{${body}}`);
  if (reducedBody) reduced.push(`${target}{${reducedBody}}`);
  const cue = forcedStateDeclarations[state as keyof typeof forcedStateDeclarations];
  forced.push(`${target}{${cue}}`);
  if (state === "open") {
    const target = selector(scope, cls, root, condition, false);
    rules.push(`@starting-style{${target}{${rest}}}`);
    if (reducedBody) reduced.push(`@starting-style{${target}{${recipeDeclarations(unmodifiedColours(restRecipe))}}}`);
  }
  if (state === "hover") {
    rules.push(`@media (hover:hover){${selector(scope, cls, root, ":hover", true)}{${body}}}`);
    if (reducedBody)
      reduced.push(`@media (hover:hover){${selector(scope, cls, root, ":hover", true)}{${reducedBody}}}`);
    forced.push(`@media (hover:hover){${selector(scope, cls, root, ":hover", true)}{${cue}}}`);
  }
}

/** Every state × definition × variant × slot rule, in sorted order. */
function stateRules(
  scope: string,
  context: DesignSystemContext,
  resolved: Readonly<Partial<Record<RecipeKey, ResolvedRecipe>>>,
  rules: string[],
  forced: string[],
  reduced: string[],
): void {
  const alphaSlots = new Set(
    Object.entries(resolved)
      .filter(([, recipe]) =>
        Object.values(recipe ?? {}).some((value) => {
          if (!value || typeof value !== "object") return false;
          if (Array.isArray(value)) return value.some((layer) => typeof layer?.color === "object");
          return "alpha" in value || ("color" in value && typeof value.color === "object");
        }),
      )
      .map(([key]) => key.slice(0, key.lastIndexOf("."))),
  );
  const definitions = [...context.catalog.definitions].sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
  for (const [state, condition] of Object.entries(stateSelectors))
    for (const definition of definitions)
      for (const variant of [...definition.variants].sort())
        for (const slot of [...definition.slots].sort())
          slotRules(scope, definition, variant, slot, state, condition, resolved, rules, forced, reduced, alphaSlots);
}

/** Sorted breakpoint widths for the responsive layer. */
function breakpoints(
  prepared: { readonly values: Readonly<Record<string, DesignValue>> },
  vocabulary: DesignSystemContext["catalog"]["vocabulary"],
): { name: string; value: string; width: number }[] {
  return vocabulary.breakpoints
    .map((name) => {
      const token = prepared.values[name];
      if (token?.kind !== "breakpoint") throw new Error(`Missing installed breakpoint: ${name}`);
      return {
        name,
        value: `${token.value.value}${token.value.unit}`,
        // shortcut: mixed px/rem ordering assumes a 16px root; revisit for hosts with other root sizes.
        width: token.value.value * (token.value.unit === "rem" ? 16 : 1),
      };
    })
    .sort((a, b) => a.width - b.width || a.name.localeCompare(b.name));
}

/** Projects installed values and resolved recipes without depending on a theme or host API. */
export function designSystemCss(system: DesignSystem, context: DesignSystemContext): Result<string> {
  const catalog = validateCatalog(context.catalog);
  if (!catalog.ok) return catalog;
  const prepared = prepareDesignSystem(system, context);
  if (!prepared.ok) return prepared;
  const resolved = cascadeRecipes(prepared.value, context.catalog);
  const scope = `:where([data-lf-ds=${cssString(`${system.id}@${system.version}`)}])`;
  const vocabulary = context.catalog.vocabulary;
  const rules = [`${scope}{${tokenVariables(prepared.value, vocabulary).join(";")}}`];
  const forced: string[] = [];
  const reduced: string[] = [];
  stateRules(scope, context, resolved, rules, forced, reduced);
  if (reduced.length) rules.push(`@media (prefers-reduced-transparency:reduce){${reduced.join("")}}`);
  rules.push(responsiveRules(scope, breakpoints(prepared.value, vocabulary)));
  rules.push(`@media (forced-colors:active){${forced.join("")}}`);
  return { ok: true, value: rules.join("\n") };
}
