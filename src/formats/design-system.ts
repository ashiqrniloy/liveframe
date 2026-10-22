import type { Result } from "../errors.ts";
import { cascadeRecipes } from "../resolve.ts";
import { bool, checkValue, type Infer, type LanguageSchema, num, obj, record, str } from "../schema.ts";
import { at, documentChecks, isRecord, shell } from "./capabilities.ts";
import type { Catalog } from "./catalog.ts";
import {
  bezierCoordinate,
  cubicBezier,
  designDimension,
  duration,
  roleName,
  shadow,
  shadowLayer,
  shadowLayers,
  signedDimension,
  type CubicBezier,
} from "./dtcg.ts";
import { states } from "./fixed.ts";

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
        ? Infer<typeof shadowLayer> | Infer<typeof shadowLayers>
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
} as const;
const lineStyle = str({ maxLength: 6, enum: ["solid", "dashed", "none"] });
type Property = keyof typeof propertyKinds;
type PropertyValue<P extends Property> = (typeof propertyKinds)[P] extends "colour" | "typography"
  ? string
  : (typeof propertyKinds)[P] extends "style"
    ? Infer<typeof lineStyle>
    : Extract<DesignValue, { kind: (typeof propertyKinds)[P] }>["value"];
export type Recipe = {
  readonly [P in Property]?: PropertyValue<P> | ((typeof propertyKinds)[P] extends "style" ? never : string);
};
export type ResolvedRecipe = { readonly [P in Property]?: PropertyValue<P> };
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
  if (kind === "colour" || kind === "typography") return roleName;
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
function literalCheck(
  kind: DesignValue["kind"],
  value: unknown,
  pointer: string,
  c: Checks,
  colours: ReadonlySet<string>,
  signed = false,
) {
  if (kind === "shadow") {
    const layers = Array.isArray(value) ? value : [value];
    if (Array.isArray(value) && value.length > 16) {
      c.reject(pointer, "Expected at most 16 shadow layers");
      return;
    }
    for (const [i, layer] of layers.entries()) {
      const path = Array.isArray(value) ? at(pointer, i) : pointer;
      if (!isRecord(layer)) {
        c.reject(path, "Expected a shadow layer");
        continue;
      }
      c.collect(
        checkValue(shadowLayer, { ...layer, ...(Object.hasOwn(layer, "color") ? { color: "role" } : {}) }),
        path,
      );
      // Check colour authority separately to report the specific trust-boundary error.
      if (typeof layer.color !== "string" || !colours.has(layer.color))
        c.reject(`${path}/color`, "Shadow colour must name a theme role", "colour-outside-theme");
    }
  } else if (kind === "easing") {
    c.collect(checkValue({ type: "array", items: bezierCoordinate, maxItems: 4 }, value), pointer);
    if (!Array.isArray(value) || value.length !== 4) c.reject(pointer, "Expected four cubic Bezier coordinates");
    else for (const i of [0, 2]) c.collect(checkValue(num({ minimum: 0, maximum: 1 }), value[i]), at(pointer, i));
  } else c.collect(checkValue(signed ? signedDimension : (literalSchemas[kind] as LanguageSchema), value), pointer);
}
/** Internal shared install pass: validate the chain, merge it, then check references. */
export function prepareDesignSystem(
  doc: unknown,
  context: DesignSystemContext,
): Result<{ values: Readonly<Record<string, DesignValue>>; recipes: Readonly<Partial<Record<RecipeKey, Recipe>>> }> {
  const c = documentChecks();
  const chain: DesignSystem[] = [];
  const seen = new Set<string>();
  const colours = new Set(context.catalog.vocabulary.colourRoles);
  let input = doc;
  let base = "";
  while (true) {
    if (!isRecord(input)) {
      c.reject(base, "Expected a design system object");
      break;
    }
    c.collect(checkValue(fields, shell(input, ["values", "recipes"])), base);
    if (typeof input.id === "string") {
      if (seen.has(input.id)) {
        c.reject(`${base}/extends`, "Cyclic design-system derivation", "cyclic-extends");
        break;
      }
      seen.add(input.id);
    }
    for (const field of ["values", "recipes"] as const) {
      const map = input[field];
      const pointer = `${base}/${field}`;
      if (!isRecord(map)) {
        c.reject(pointer, "Expected a name map");
        continue;
      }
      if (Object.keys(map).length > (field === "values" ? 1024 : 16384)) {
        c.reject(pointer, "Too many entries");
        continue;
      }
      for (const [name, entry] of Object.entries(map)) {
        if (c.errors.length >= 20) break;
        const path = at(pointer, name);
        c.collect(checkValue(field === "values" ? roleName : keyName, name), path);
        if (!isRecord(entry)) {
          c.reject(path, "Expected an object");
          continue;
        }
        if (field === "values") {
          c.collect(
            checkValue(
              obj({ kind: str({ maxLength: 16, enum: Object.keys(literalSchemas) }), value: bool() }),
              shell(entry, ["value"]),
            ),
            path,
          );
          if (typeof entry.kind === "string" && Object.hasOwn(literalSchemas, entry.kind))
            literalCheck(entry.kind as DesignValue["kind"], entry.value, `${path}/value`, c, colours);
        } else {
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
            const propPath = at(path, property);
            if (!Object.hasOwn(propertyKinds, property)) {
              c.reject(propPath, "Unknown recipe property");
              continue;
            }
            const k = propertyKinds[property as Property];
            if (k === "colour") {
              if (typeof value !== "string" || !colours.has(value))
                c.reject(propPath, "Colour must name a theme role", "colour-outside-theme");
            } else if (k === "typography") {
              if (typeof value !== "string" || !context.catalog.vocabulary.typographyRoles.includes(value))
                c.reject(propPath, "Unknown typography role", "unknown-name");
            } else if (k === "style") c.collect(checkValue(lineStyle, value), propPath);
            else if (typeof value === "string") c.collect(checkValue(roleName, value), propPath);
            else
              literalCheck(k, value, propPath, c, colours, property === "translateY" || property === "outlineOffset");
          }
        }
      }
    }
    if (c.errors.length) break;
    chain.push(input as DesignSystem);
    if (input.extends === undefined) break;
    const parent = input.extends;
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
  const values: Record<string, DesignValue> = Object.create(null);
  const recipes: Partial<Record<RecipeKey, Recipe>> = Object.create(null);
  for (const ds of chain.reverse()) {
    Object.assign(values, ds.values);
    for (const [key, recipe] of Object.entries(ds.recipes))
      recipes[key as RecipeKey] = { ...recipes[key as RecipeKey], ...recipe };
  }
  const vocabulary = context.catalog.vocabulary;
  for (const [names, kind] of [
    [vocabulary.space, "spacing"],
    [vocabulary.radius, "radius"],
    [vocabulary.size, "size"],
    [vocabulary.breakpoints, "breakpoint"],
  ] as const)
    for (const name of names)
      if (values[name]?.kind !== kind) c.reject(at("/values", name), `Expected declared ${kind} value`, "unknown-name");
  // Validate every reference, including inherited recipes hidden by a variant/state overlay.
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
  const merged = { values, recipes };
  cascadeRecipes(merged, context.catalog, c.reject);
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: merged };
}
/** Validate before installing; returns the original document and at most 20 errors. */
export function validateDesignSystem(doc: unknown, context: DesignSystemContext): Result<DesignSystem> {
  const result = prepareDesignSystem(doc, context);
  return result.ok ? { ok: true, value: doc as DesignSystem } : result;
}
