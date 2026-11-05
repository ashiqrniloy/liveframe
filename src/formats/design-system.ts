import type { Result } from "../errors.ts";
import { cascadeRecipes } from "../resolve.ts";
import { bool, type Infer, num, obj, record, str } from "../schema.ts";
import { at, documentChecks, isRecord } from "./capabilities.ts";
import type { Catalog } from "./catalog.ts";
import { checkFormat } from "./check.ts";
import {
  type ColourValue,
  type CubicBezier,
  colourReference,
  cubicBezier,
  designDimension,
  duration,
  roleName,
  type ShadowLayer,
  shadow,
  signedDimension,
} from "./dtcg.ts";
import { noPaint, scrollbarProperties, states } from "./fixed.ts";
import { validateJson } from "./json.ts";

const literalSchemas = {
  radius: designDimension,
  "border-width": designDimension,
  spacing: designDimension,
  size: designDimension,
  breakpoint: designDimension,
  "backdrop-blur": designDimension,
  "motion-duration": duration,
  easing: cubicBezier,
  opacity: num({ minimum: 0, maximum: 1 }),
  saturation: num({ minimum: 0, maximum: 10 }),
  shadow,
} as const;
export type DesignValue = {
  [K in keyof typeof literalSchemas]: {
    readonly kind: K;
    readonly value: K extends "easing"
      ? CubicBezier
      : K extends "shadow"
        ? ShadowLayer | readonly ShadowLayer[]
        : Infer<(typeof literalSchemas)[K]>;
  };
}[keyof typeof literalSchemas];
const propertyKinds = {
  backgroundColor: "colour",
  textColor: "colour",
  borderColor: "colour",
  outlineColor: "colour",
  borderWidth: "border-width",
  borderTopWidth: "border-width",
  borderRightWidth: "border-width",
  borderBottomWidth: "border-width",
  borderLeftWidth: "border-width",
  borderRadius: "radius",
  borderStyle: "style",
  padding: "spacing",
  paddingX: "spacing",
  paddingY: "spacing",
  gap: "spacing",
  typography: "typography",
  opacity: "opacity",
  backgroundOpacity: "opacity",
  shadow: "shadow",
  backdropBlur: "backdrop-blur",
  backdropSaturate: "saturation",
  transitionDuration: "motion-duration",
  transitionTiming: "easing",
  translateY: "spacing",
  outlineWidth: "border-width",
  outlineOffset: "spacing",
  outlineStyle: "style",
  placeholderColor: "colour",
  scrollbarThumbColor: "colour",
  scrollbarTrackColor: "colour",
} as const;
const lineStyle = str({ maxLength: 6, enum: ["solid", "dashed", "none"] });
type Property = keyof typeof propertyKinds;
type PropertyValue<P extends Property, Alpha = number | string> = (typeof propertyKinds)[P] extends "colour"
  ? ColourValue<Alpha>
  : (typeof propertyKinds)[P] extends "typography"
    ? string
    : (typeof propertyKinds)[P] extends "style"
      ? Infer<typeof lineStyle>
      : (typeof propertyKinds)[P] extends "shadow"
        ? ShadowLayer<Alpha> | readonly ShadowLayer<Alpha>[]
        : Extract<DesignValue, { kind: (typeof propertyKinds)[P] }>["value"];
export type Recipe = {
  readonly [P in Property]?: PropertyValue<P> | ((typeof propertyKinds)[P] extends "style" ? never : string);
};
export type ResolvedRecipe = { readonly [P in Property]?: PropertyValue<P, number> };
export type RecipeKey = `${string}.${string}.${string}.${(typeof states)[number]}`;
const keyName = str({
  maxLength: 203,
  pattern: `^[a-z][A-Za-z0-9-]*\\.(?:[a-z][A-Za-z0-9-]*|\\*)\\.[a-z][A-Za-z0-9-]*\\.(?:${states.join("|")})$`,
});
const fields = obj(
  {
    format: str({ maxLength: 32, enum: ["liveframe-design-system/1"] }),
    id: str({ maxLength: 128, pattern: "^[a-z][a-zA-Z0-9.-]*$" }),
    version: str({ maxLength: 128, pattern: "^.+$" }),
    values: bool(),
    recipes: bool(),
  },
  { extends: str({ maxLength: 128, pattern: "^[a-z][a-zA-Z0-9.-]*$" }) },
);
export type DesignSystem = Omit<Infer<typeof fields>, "values" | "recipes"> & {
  readonly values: Readonly<Record<string, DesignValue>>;
  readonly recipes: Readonly<Partial<Record<RecipeKey, Recipe>>>;
};
export type DesignSystemContext = {
  readonly catalog: Catalog;
  readonly registry: Readonly<Record<string, DesignSystem>>;
};
function propertySchema(property: Property) {
  const kind = propertyKinds[property];
  if (kind === "colour") return colourReference;
  if (kind === "typography") return roleName;
  if (kind === "style") return lineStyle;
  const schema = property === "translateY" || property === "outlineOffset" ? signedDimension : literalSchemas[kind];
  return { oneOf: [roleName, schema] };
}
export const designSystemSchema = {
  ...fields,
  properties: {
    ...fields.properties,
    values: {
      ...record(
        roleName.pattern,
        {
          oneOf: Object.entries(literalSchemas).map(([kind, value]) => ({
            ...obj({ kind: str({ maxLength: 16, enum: [kind] }), value: bool() }),
            properties: { kind: { const: kind }, value },
          })),
        },
        1024,
      ),
      propertyNames: roleName,
    },
    recipes: {
      ...record(
        keyName.pattern,
        {
          type: "object",
          properties: Object.fromEntries((Object.keys(propertyKinds) as Property[]).map((p) => [p, propertySchema(p)])),
          additionalProperties: false,
        },
        16384,
      ),
      propertyNames: keyName,
    },
  },
};
type Checks = ReturnType<typeof documentChecks>;
/** Theme-role authority remains an install relationship, independent of transport shape. */
function checkColour(value: unknown, pointer: string, c: Checks, colours: ReadonlySet<string>): void {
  const role = isRecord(value) ? value.role : value;
  if (typeof role !== "string" || !colours.has(role))
    c.reject(
      isRecord(value) && Object.hasOwn(value, "role") ? `${pointer}/role` : pointer,
      "Colour must name a theme role",
      "colour-outside-theme",
    );
}

/** Checks one document of the chain and returns it, or undefined when it is invalid. */
function checkDocument(
  input: unknown,
  base: string,
  c: Checks,
  context: DesignSystemContext,
  seen: Set<string>,
): DesignSystem | undefined {
  const json = validateJson(input, true);
  if (!json.ok) {
    c.collect(json, base);
    return undefined;
  }
  if (!isRecord(input)) {
    c.reject(base, "Expected a design system object");
    return undefined;
  }
  const shape = checkFormat(designSystemSchema, input);
  if (!shape.ok) {
    checkMaps(input, base, c, context);
    const authority = c.errors.filter((error) => error.kind === "colour-outside-theme").map((error) => error.pointer);
    c.collect(
      {
        ok: false,
        errors: shape.errors.filter(
          (error) =>
            !authority.some(
              (pointer) => pointer === base + error.pointer || pointer.startsWith(`${base + error.pointer}/`),
            ),
        ),
      },
      base,
    );
    return undefined;
  }
  if (typeof input.id === "string") {
    if (seen.has(input.id)) {
      c.reject(`${base}/extends`, "Cyclic design-system derivation", "cyclic-extends");
      return undefined;
    }
    seen.add(input.id);
  }
  return checkMaps(input, base, c, context) ? (input as DesignSystem) : undefined;
}

/** Checks the `values` and `recipes` entries of one document; returns whether none failed. */
function checkMaps(input: Record<string, unknown>, base: string, c: Checks, context: DesignSystemContext): boolean {
  const colours = new Set(context.catalog.vocabulary.colourRoles);
  for (const [name, entry] of Object.entries(isRecord(input.values) ? input.values : {}))
    if (isRecord(entry) && entry.kind === "shadow")
      checkShadowRoles(entry.value, `${at(`${base}/values`, name)}/value`, c, colours);
  for (const [name, entry] of Object.entries(isRecord(input.recipes) ? input.recipes : {})) {
    if (c.errors.length >= 20) break;
    if (isRecord(entry)) checkRecipe(name, entry, at(`${base}/recipes`, name), c, context, colours);
  }
  return c.errors.length === 0;
}

function checkRecipe(
  name: string,
  entry: Record<string, unknown>,
  path: string,
  c: Checks,
  context: DesignSystemContext,
  colours: ReadonlySet<string>,
): void {
  const [kind, variant, slot, state] = name.split(".");
  const definition = context.catalog.definitions.find((d) => d.kind === kind);
  if (
    !definition ||
    (variant !== "*" && !definition.variants.includes(variant ?? "")) ||
    !definition.slots.includes(slot ?? "") ||
    !states.includes(state as (typeof states)[number])
  )
    c.reject(path, "Unknown recipe kind, variant, slot or state", "unknown-name");
  for (const [property, value] of Object.entries(entry)) {
    // Container hover/active is not thumb hover/active, so native scrollbar colours are rest-only.
    if (state !== "rest" && scrollbarProperties.includes(property))
      c.reject(at(path, property), `${property} is declared only in rest recipes`);
    else checkRecipeProperty(property, value, at(path, property), c, context, colours);
  }
}

function checkRecipeProperty(
  property: string,
  value: unknown,
  pointer: string,
  c: Checks,
  context: DesignSystemContext,
  colours: ReadonlySet<string>,
): void {
  const kind = propertyKinds[property as Property];
  if (kind === "colour") {
    if (!(value === noPaint && property !== "textColor")) checkColour(value, pointer, c, colours);
  } else if (kind === "shadow" && typeof value !== "string") {
    checkShadowRoles(value, pointer, c, colours);
  } else if (kind === "typography" && !context.catalog.vocabulary.typographyRoles.includes(value as string))
    c.reject(pointer, "Unknown typography role", "unknown-name");
}

/** Values and recipes of every document in the chain, nearest document last. */
function mergeChain(chain: readonly DesignSystem[]) {
  const values: Record<string, DesignValue> = Object.create(null);
  const recipes: Partial<Record<RecipeKey, Recipe>> = Object.create(null);
  for (const ds of chain) {
    Object.assign(values, ds.values);
    for (const [key, recipe] of Object.entries(ds.recipes))
      recipes[key as RecipeKey] = { ...recipes[key as RecipeKey], ...recipe };
  }
  return { values, recipes };
}

function checkDeclaredVocabulary(
  values: Readonly<Record<string, DesignValue>>,
  vocabulary: DesignSystemContext["catalog"]["vocabulary"],
  c: Checks,
): void {
  for (const [names, kind] of [
    [vocabulary.space, "spacing"],
    [vocabulary.radius, "radius"],
    [vocabulary.size, "size"],
    [vocabulary.breakpoints, "breakpoint"],
  ] as const)
    for (const name of names)
      if (values[name]?.kind !== kind) c.reject(at("/values", name), `Expected declared ${kind} value`, "unknown-name");
}

function checkAlphaReferences(
  chain: readonly DesignSystem[],
  values: Readonly<Record<string, DesignValue>>,
  c: Checks,
): void {
  function colourReference(value: unknown, pointer: string): void {
    if (!isRecord(value)) return;
    if (typeof value.alpha === "number") {
      if (Number(value.alpha.toFixed(4)) !== value.alpha)
        c.reject(`${pointer}/alpha`, "Expected alpha in [0, 1] with at most four decimal places");
      return;
    }
    if (typeof value.alpha !== "string") return;
    const token = values[value.alpha];
    if (token?.kind !== "opacity") c.reject(`${pointer}/alpha`, "Expected an opacity value reference", "unknown-name");
    else if (Number(token.value.toFixed(4)) !== token.value)
      c.reject(`${pointer}/alpha`, "Expected alpha in [0, 1] with at most four decimal places");
  }
  function shadowReferences(value: unknown, pointer: string): void {
    for (const [i, layer] of (Array.isArray(value) ? value : [value]).entries())
      if (isRecord(layer)) colourReference(layer.color, `${Array.isArray(value) ? at(pointer, i) : pointer}/color`);
  }
  for (const ds of chain) {
    for (const [name, entry] of Object.entries(ds.values))
      if (entry.kind === "shadow") shadowReferences(entry.value, `${at("/values", name)}/value`);
    for (const [key, recipe] of Object.entries(ds.recipes))
      for (const [property, value] of Object.entries(recipe ?? {})) {
        const pointer = at(at("/recipes", key), property);
        if (propertyKinds[property as Property] === "colour") colourReference(value, pointer);
        if (property === "shadow" && typeof value !== "string") shadowReferences(value, pointer);
      }
  }
}

/** Validates every reference, including inherited recipes hidden by a variant/state overlay. */
function checkReferences(
  chain: readonly DesignSystem[],
  values: Readonly<Record<string, DesignValue>>,
  c: Checks,
): void {
  checkAlphaReferences(chain, values, c);
  for (const ds of chain)
    for (const [key, recipe] of Object.entries(ds.recipes))
      for (const [property, value] of Object.entries(recipe ?? {})) {
        const kind = propertyKinds[property as Property];
        if (
          typeof value === "string" &&
          kind !== "colour" &&
          kind !== "typography" &&
          kind !== "style" &&
          values[value]?.kind !== kind
        )
          c.reject(at(at("/recipes", key), property), `Expected a ${kind} value reference`, "unknown-name");
      }
}

/** Internal shared install pass: validate the chain, merge it, then check references. */
export function prepareDesignSystem(
  doc: unknown,
  context: DesignSystemContext,
): Result<{ values: Readonly<Record<string, DesignValue>>; recipes: Readonly<Partial<Record<RecipeKey, Recipe>>> }> {
  const c = documentChecks();
  const chain: DesignSystem[] = [];
  const seen = new Set<string>();
  let input = doc;
  let base = "";
  while (true) {
    const current = checkDocument(input, base, c, context, seen);
    if (!current) break;
    chain.push(current);
    if (current.extends === undefined) break;
    const parent = current.extends;
    if (typeof parent !== "string" || !Object.hasOwn(context.registry, parent)) {
      c.reject(`${base}/extends`, "Unknown parent design system", "unknown-name");
      break;
    }
    input = context.registry[parent];
    base = at("/registry", parent);
    if (isRecord(input) && input.id !== parent) {
      c.reject(base, "Registry key must equal design-system id");
      break;
    }
  }
  if (c.errors.length) return { ok: false, errors: c.errors };
  const ordered = chain.reverse();
  const merged = mergeChain(ordered);
  checkDeclaredVocabulary(merged.values, context.catalog.vocabulary, c);
  checkReferences(ordered, merged.values, c);
  cascadeRecipes(merged, context.catalog, c.reject);
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: merged };
}

/** Validate before installing; returns the original document and at most 20 errors. */
export function validateDesignSystem(doc: unknown, context: DesignSystemContext): Result<DesignSystem> {
  const result = prepareDesignSystem(doc, context);
  return result.ok ? { ok: true, value: doc as DesignSystem } : result;
}

/** Every shadow layer still derives its colour from an installed theme role. */
function checkShadowRoles(value: unknown, pointer: string, c: Checks, colours: ReadonlySet<string>): void {
  for (const [i, layer] of (Array.isArray(value) ? value : [value]).entries())
    if (isRecord(layer))
      checkColour(layer.color, `${Array.isArray(value) ? at(pointer, i) : pointer}/color`, c, colours);
}
