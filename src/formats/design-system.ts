import type { Result } from "../errors.ts";
import { cascadeRecipes } from "../resolve.ts";
import { bool, type Infer, num, obj, record, str } from "../schema.ts";
import { at, documentChecks, isRecord } from "./capabilities.ts";
import type { Catalog, Definition } from "./catalog.ts";
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
import { type extensionKinds, noPaint, scrollbarProperties, states } from "./fixed.ts";
import { validateJson } from "./json.ts";
import { extensionName } from "./vocabulary.ts";

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
/** An extension's literal: one of the design-value kinds an app may declare (`extensionKinds`). */
export type ExtensionLiteral = Extract<DesignValue, { kind: (typeof extensionKinds)[number] }>["value"];
export type Recipe = {
  readonly [P in Property]?: PropertyValue<P> | ((typeof propertyKinds)[P] extends "style" ? never : string);
} & {
  /** Role aliases of an axis overlay (`kind.axis:value.slot.state`): a role or family → another, once, at resolve time. */
  readonly roles?: Readonly<Record<string, string>>;
  /** App-declared properties (`vocabulary.extensions`): a theme role or `none`, a design-value name, or a literal. */
  readonly extensions?: Readonly<Record<string, string | ExtensionLiteral>>;
};
export type ResolvedRecipe = { readonly [P in Property]?: PropertyValue<P, number> } & {
  /** Colour extensions keep their role (or `none`); value extensions are resolved to literals. */
  readonly extensions?: Readonly<Record<string, string | ExtensionLiteral>>;
};
export type RecipeKey = `${string}.${string}.${string}.${(typeof states)[number]}`;
const keyToken = "[a-z][A-Za-z0-9-]*";
/** `<kind>.<variant | * | axis:value>.<slot>.<state>`; `:` is not a name character, so a key is unambiguous. */
const keyName = str({
  maxLength: 270,
  pattern: `^${keyToken}\\.(?:${keyToken}(?::${keyToken})?|\\*)\\.${keyToken}\\.(?:${states.join("|")})$`,
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
// Kind-specific literal checks need the catalog, so the schema only fixes the shapes an extension can take.
const extensionValue = { anyOf: [roleName, designDimension, duration, num({ minimum: 0, maximum: 10 })] };
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
          properties: {
            ...Object.fromEntries((Object.keys(propertyKinds) as Property[]).map((p) => [p, propertySchema(p)])),
            extensions: { ...record(extensionName.pattern, extensionValue, 64), propertyNames: extensionName },
            roles: { ...record(roleName.pattern, roleName, 64), propertyNames: roleName },
          },
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
            ) &&
            // The extension literal check reports the same failure against its declared kind.
            !c.errors.some((known) => known.pointer === base + error.pointer && known.message === error.message),
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
  const families = roleFamilies(colours);
  for (const [name, entry] of Object.entries(isRecord(input.recipes) ? input.recipes : {})) {
    if (c.errors.length >= 20) break;
    if (isRecord(entry)) checkRecipe(name, entry, at(`${base}/recipes`, name), c, context, colours, families);
  }
  return c.errors.length === 0;
}

/** Every declared colour role and each of its dot-separated prefixes: the names an alias may use. */
function roleFamilies(colours: ReadonlySet<string>): ReadonlySet<string> {
  const families = new Set<string>();
  for (const role of colours)
    for (let end = role.indexOf("."); ; end = role.indexOf(".", end + 1)) {
      families.add(end < 0 ? role : role.slice(0, end));
      if (end < 0) break;
    }
  return families;
}

/** Whether the definition declares the axis overlay named by a key's `axis:value` variant position. */
function declaresAxisValue(definition: Definition, overlay: string): boolean {
  const [axis = "", value = ""] = overlay.split(":");
  const schema =
    definition.axes && Object.hasOwn(definition.axes, axis) ? definition.props.properties[axis] : undefined;
  return schema?.type === "string" && (schema.enum?.includes(value) ?? false);
}

function checkRecipe(
  name: string,
  entry: Record<string, unknown>,
  path: string,
  c: Checks,
  context: DesignSystemContext,
  colours: ReadonlySet<string>,
  families: ReadonlySet<string>,
): void {
  const [kind, variant, slot, state] = name.split(".");
  const definition = context.catalog.definitions.find((d) => d.kind === kind);
  const overlay = variant?.includes(":") ?? false;
  if (
    !definition ||
    (overlay
      ? !declaresAxisValue(definition, variant ?? "")
      : variant !== "*" && !definition.variants.includes(variant ?? "")) ||
    !definition.slots.includes(slot ?? "") ||
    !states.includes(state as (typeof states)[number])
  )
    c.reject(path, "Unknown recipe kind, variant, slot or state", "unknown-name");
  for (const [property, value] of Object.entries(entry)) {
    // Container hover/active is not thumb hover/active, so native scrollbar colours are rest-only.
    if (property === "extensions" || property === "roles") continue;
    if (state !== "rest" && scrollbarProperties.includes(property))
      c.reject(at(path, property), `${property} is declared only in rest recipes`);
    else checkRecipeProperty(property, value, at(path, property), c, context, colours);
  }
  if (isRecord(entry.extensions))
    for (const [extension, value] of Object.entries(entry.extensions))
      checkExtension(extension, value, () => at(at(path, "extensions"), extension), c, context, colours);
  if (isRecord(entry.roles)) checkRoles(entry.roles, at(path, "roles"), overlay, c, families);
}

/** Aliases belong to axis overlays and name declared colour roles or families, so no literal colour can enter. */
function checkRoles(
  roles: Record<string, unknown>,
  path: string,
  overlay: boolean,
  c: Checks,
  families: ReadonlySet<string>,
): void {
  if (!overlay) {
    c.reject(path, "Role aliases are allowed only on axis recipes");
    return;
  }
  for (const [from, to] of Object.entries(roles))
    if (!families.has(from) || typeof to !== "string" || !families.has(to))
      c.reject(at(path, from), "Alias must name declared colour roles or families", "unknown-name");
}

/** An extension names a declared property and carries that property's type: colours only from the theme. */
function checkExtension(
  name: string,
  value: unknown,
  pointer: () => string,
  c: Checks,
  context: DesignSystemContext,
  colours: ReadonlySet<string>,
): void {
  const extensions = context.catalog.vocabulary.extensions;
  const declared = extensions && Object.hasOwn(extensions, name) ? extensions[name] : undefined;
  if (!declared) c.reject(pointer(), `Undeclared extension: ${name}`, "unknown-name");
  else if (declared.type === "colour") {
    if (typeof value !== "string") c.reject(pointer(), "Extension colour must name a theme role");
    else if (value !== noPaint && !colours.has(value))
      c.reject(pointer(), "Colour must name a theme role", "colour-outside-theme");
  } else if (typeof value !== "string" && declared.kind)
    c.collect(checkFormat(literalSchemas[declared.kind], value), pointer());
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
    for (const [key, recipe] of Object.entries(ds.recipes)) {
      const before = recipes[key as RecipeKey];
      recipes[key as RecipeKey] = {
        ...before,
        ...recipe,
        ...(before?.extensions || recipe?.extensions
          ? { extensions: { ...before?.extensions, ...recipe?.extensions } }
          : {}),
        ...(before?.roles || recipe?.roles ? { roles: { ...before?.roles, ...recipe?.roles } } : {}),
      };
    }
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

/** A `value` extension that names a design value must name one of its declared kind. */
function checkExtensionReferences(
  chain: readonly DesignSystem[],
  values: Readonly<Record<string, DesignValue>>,
  vocabulary: DesignSystemContext["catalog"]["vocabulary"],
  c: Checks,
): void {
  const declared = vocabulary.extensions ?? {};
  for (const ds of chain)
    for (const [key, recipe] of Object.entries(ds.recipes))
      for (const [name, value] of recipe?.extensions ? Object.entries(recipe.extensions) : []) {
        const kind = Object.hasOwn(declared, name) ? declared[name]?.kind : undefined;
        if (typeof value === "string" && kind !== undefined && values[value]?.kind !== kind)
          c.reject(
            at(at(at("/recipes", key), "extensions"), name),
            `Expected a ${kind} value reference`,
            "unknown-name",
          );
      }
}

/**
 * An alias error names the winning entry. When the nearest document defining it is a registry
 * parent, the pointer carries that parent's `/registry/<id>` prefix, as every other chain error does.
 */
function inheritedPointer(pointer: string, ordered: readonly DesignSystem[]): string {
  const entry = /^\/recipes\/([^/]+)\/roles\/([^/]+)$/.exec(pointer);
  if (!entry) return pointer;
  const [, key = "", from = ""] = entry;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const roles = ordered[i]?.recipes[key as RecipeKey]?.roles;
    if (roles && Object.hasOwn(roles, from))
      return i === ordered.length - 1 ? pointer : at("/registry", ordered[i]?.id ?? "") + pointer;
  }
  return pointer;
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
  checkExtensionReferences(ordered, merged.values, context.catalog.vocabulary, c);
  cascadeRecipes(merged, context.catalog, (pointer, message, kind) =>
    c.reject(inheritedPointer(pointer, ordered), message, kind),
  );
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
