import { type LiveframeError, LiveframeFailure } from "./errors.ts";
import { axisCombinations, axisNames, joinVariant } from "./formats/axes.ts";
import type { Catalog } from "./formats/catalog.ts";
import {
  type DesignSystem,
  type DesignSystemContext,
  prepareDesignSystem,
  type Recipe,
  type RecipeKey,
  type ResolvedRecipe,
} from "./formats/design-system.ts";
import type { ColourValue, ShadowLayer } from "./formats/dtcg.ts";
import { colourProperties, noPaint } from "./formats/fixed.ts";
import { catalogStates } from "./formats/vocabulary.ts";

export type ResolvedRecipes = Readonly<Partial<Record<RecipeKey, ResolvedRecipe>>>;
/** Alias entries by source, each with the recipe key that supplied it, so a bad rewrite names the winning entry. */
type Aliases = ReadonlyMap<string, { readonly to: string; readonly key: string }>;
const noAliases: Aliases = new Map();
type AliasContext = {
  readonly colours: ReadonlySet<string>;
  readonly declared: NonNullable<Catalog["vocabulary"]["extensions"]>;
  readonly reject: (pointer: string, message: string, kind: LiveframeError["kind"]) => void;
  /** Pointers already reported, so one bad entry is one error however many states it spreads over. */
  readonly reported: Set<string>;
};

/** Rewrites colour roles once through the axis aliases; the theme stays the only source of colours (spec §6.2). */
function rewriteRoles(resolved: Record<string, unknown>, aliases: Aliases, context: AliasContext): void {
  // The longest source that is the role or one of its dot-boundary prefixes wins; the result is not rewritten again.
  const role = (value: string): string => {
    for (let source = value; ; ) {
      const alias = aliases.get(source);
      if (alias) {
        const to = alias.to + value.slice(source.length);
        const pointer = `/recipes/${alias.key}/roles/${source}`;
        if (!context.colours.has(to) && !context.reported.has(pointer)) {
          context.reported.add(pointer);
          context.reject(pointer, `Undeclared rewritten role: ${to}`, "unknown-name");
        }
        return to;
      }
      const dot = source.lastIndexOf(".");
      if (dot < 0) return value;
      source = source.slice(0, dot);
    }
  };
  const paint = (value: ColourValue<number>): ColourValue<number> => {
    if (typeof value !== "string") return { role: role(value.role), alpha: value.alpha };
    return value === noPaint ? value : role(value);
  };
  for (const property of colourProperties)
    if (resolved[property] !== undefined) resolved[property] = paint(resolved[property] as ColourValue<number>);
  if (resolved.shadow !== undefined) {
    const layer = (entry: ShadowLayer<number>): ShadowLayer<number> => ({ ...entry, color: paint(entry.color) });
    resolved.shadow = Array.isArray(resolved.shadow)
      ? resolved.shadow.map(layer)
      : layer(resolved.shadow as ShadowLayer<number>);
  }
  const extensions = resolved.extensions as Record<string, unknown> | undefined;
  for (const [name, value] of Object.entries(extensions ?? {}))
    if (extensions && context.declared[name]?.type === "colour" && typeof value === "string" && value !== noPaint)
      extensions[name] = role(value);
}

/** Layers merged left to right: properties replace, extensions merge by name; `roles` is alias data, not style. */
function overlay(layers: readonly (Recipe | undefined)[]): Recipe | undefined {
  let merged: Recipe | undefined;
  for (const layer of layers) {
    if (!layer) continue;
    const { roles: _roles, ...style } = layer;
    merged = {
      ...merged,
      ...style,
      ...(merged?.extensions || style.extensions ? { extensions: { ...merged?.extensions, ...style.extensions } } : {}),
    };
  }
  return merged;
}

/** Alias entries of the keys in order; a later key wins for the same source. */
function aliasesOf(recipes: Readonly<Partial<Record<RecipeKey, Recipe>>>, keys: readonly RecipeKey[]): Aliases {
  const map = new Map<string, { to: string; key: string }>();
  for (const key of keys)
    for (const [from, to] of Object.entries(recipes[key]?.roles ?? {})) map.set(from, { to, key });
  return map.size ? map : noAliases;
}

/**
 * The layers of one `(variant, axis values, slot)` for each state, as the two merged halves of the
 * six-layer cascade (wildcard, variant, then each axis in declared order; rest layers, then state
 * layers) and the aliases in force: rest aliases first, then the state's, later winning.
 */
function axisLayers(
  recipes: Readonly<Partial<Record<RecipeKey, Recipe>>>,
  kind: string,
  axes: readonly string[],
  values: readonly string[],
  slot: string,
  wildcard: string,
  specific: string,
  stateNames: readonly string[],
): [string, Recipe | undefined, Recipe | undefined, Aliases][] {
  const overlays = axes.map((axis, i) => `${kind}.${axis}:${values[i]}.${slot}`);
  const restKeys = overlays.map((key) => `${key}.rest` as RecipeKey);
  const rest = overlay([
    recipes[`${wildcard}.rest` as RecipeKey],
    recipes[`${specific}.rest` as RecipeKey],
    ...restKeys.map((key) => recipes[key]),
  ]);
  return stateNames.map((state) => {
    if (state === "rest") return [state, rest, undefined, aliasesOf(recipes, restKeys)];
    const stateKeys = overlays.map((key) => `${key}.${state}` as RecipeKey);
    const layers = [
      recipes[`${wildcard}.${state}` as RecipeKey],
      recipes[`${specific}.${state}` as RecipeKey],
      ...stateKeys.map((key) => recipes[key]),
    ];
    return [state, rest, overlay(layers), aliasesOf(recipes, [...restKeys, ...stateKeys])];
  });
}
type LayerResolver = (a?: Recipe, b?: Recipe, c?: Recipe, d?: Recipe, aliases?: Aliases) => ResolvedRecipe;

/** Resolves every state of one `(variant, slot)`, once per axis combination for a kind with axes. */
function fillSlot(
  table: Partial<Record<RecipeKey, ResolvedRecipe>>,
  recipes: Readonly<Partial<Record<RecipeKey, Recipe>>>,
  definition: Catalog["definitions"][number],
  variant: string,
  slot: string,
  stateNames: readonly string[],
  resolveLayers: LayerResolver,
  reject: (pointer: string, message: string, kind: LiveframeError["kind"]) => void,
): void {
  const { kind } = definition;
  const axes = axisNames(definition);
  const wildcard = `${kind}.*.${slot}`;
  const specific = `${kind}.${variant}.${slot}`;
  for (const values of axisCombinations(definition)) {
    const resolvedKey = `${kind}.${joinVariant(variant, values)}.${slot}`;
    if (axes.length) {
      for (const [state, first, second, aliases] of axisLayers(
        recipes,
        kind,
        axes,
        values,
        slot,
        wildcard,
        specific,
        stateNames,
      ))
        table[`${resolvedKey}.${state}` as RecipeKey] = resolveLayers(first, second, undefined, undefined, aliases);
    } else {
      for (const state of stateNames)
        table[`${resolvedKey}.${state}` as RecipeKey] = resolveLayers(
          recipes[`${wildcard}.rest` as RecipeKey],
          recipes[`${specific}.rest` as RecipeKey],
          recipes[`${wildcard}.${state}` as RecipeKey],
          recipes[`${specific}.${state}` as RecipeKey],
        );
    }
    const rest = table[`${resolvedKey}.rest` as RecipeKey];
    if ((rest?.scrollbarThumbColor === undefined) !== (rest?.scrollbarTrackColor === undefined))
      reject(
        `/recipes/${specific}.rest`,
        "scrollbarThumbColor and scrollbarTrackColor must be declared together",
        "incomplete-design-system",
      );
  }
}

/** One cascade serves completeness checks and projection output. */
export function cascadeRecipes(
  ds: Pick<DesignSystem, "values" | "recipes">,
  catalog: Catalog,
  reject: (pointer: string, message: string, kind: LiveframeError["kind"]) => void = () => {},
): ResolvedRecipes {
  function colour(value: ColourValue): ColourValue {
    return !value || typeof value !== "object" || typeof value.alpha !== "string"
      ? value
      : { role: value.role, alpha: ds.values[value.alpha]?.value as number };
  }
  function shadow(value: ShadowLayer | readonly ShadowLayer[]) {
    const layer = (entry: ShadowLayer): ShadowLayer =>
      entry && typeof entry === "object" ? { ...entry, color: colour(entry.color) } : entry;
    return Array.isArray(value) ? value.map(layer) : layer(value as ShadowLayer);
  }
  const declared = catalog.vocabulary.extensions ?? {};
  /** Colour extensions keep their role; a value extension that names a design value takes its literal. */
  function extensionValues(input: Readonly<Record<string, unknown>>) {
    const names = Object.keys(input);
    if (names.length > 1) names.sort();
    const resolved: Record<string, unknown> = {};
    for (const name of names) {
      const value = input[name];
      resolved[name] = typeof value === "string" && declared[name]?.type === "value" ? ds.values[value]?.value : value;
    }
    return resolved;
  }
  const alias = { colours: new Set(catalog.vocabulary.colourRoles), declared, reject, reported: new Set<string>() };
  /** Later layers win per property; extensions merge by name, so a variant keeps a wildcard's other names. */
  function resolveLayers(a?: Recipe, b?: Recipe, c?: Recipe, d?: Recipe, aliases: Aliases = noAliases): ResolvedRecipe {
    const merged: Recipe = { ...a, ...b, ...c, ...d };
    const resolved: Record<string, unknown> = Object.fromEntries(
      Object.entries(merged).map(([property, input]) => {
        const value =
          typeof input === "string" &&
          Object.hasOwn(ds.values, input) &&
          !colourProperties.includes(property) &&
          !["typography", "borderStyle", "outlineStyle"].includes(property)
            ? ds.values[input]?.value
            : input;
        return [
          property,
          property === "shadow"
            ? shadow(value as ShadowLayer | readonly ShadowLayer[])
            : colourProperties.includes(property)
              ? colour(value as ColourValue)
              : value,
        ];
      }),
    );
    if (merged.extensions)
      resolved.extensions = extensionValues(
        Object.assign({}, a?.extensions, b?.extensions, c?.extensions, d?.extensions),
      );
    if (aliases.size) rewriteRoles(resolved, aliases, alias);
    return resolved as ResolvedRecipe;
  }
  const stateNames = catalogStates(catalog.vocabulary);
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
        fillSlot(table, ds.recipes, definition, variant, slot, stateNames, resolveLayers, reject);
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
  if (!result.ok) throw new LiveframeFailure(result.errors);
  return cascadeRecipes(result.value, context.catalog);
}
