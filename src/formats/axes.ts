import type { Definition } from "./catalog.ts";

/** Axes per kind, values per axis and combinations per kind (spec §5). */
export const maxAxes = 3;
export const maxAxisValues = 16;
export const maxCombinations = 256;

/** The separator between a variant and its axis values in a resolved key and a slot class. */
const separator = "__";

type Axes = NonNullable<Definition["axes"]>;

/** The axes of a definition in declared order, with the enum each one chooses from. */
export function axisNames(definition: Pick<Definition, "axes">): readonly string[] {
  return definition.axes ? Object.keys(definition.axes) : [];
}

function axisValues(definition: Pick<Definition, "props">, axis: string): readonly string[] {
  const schema = definition.props.properties[axis];
  return schema?.type === "string" && schema.enum ? schema.enum : [];
}

/** `primary__critical`: the variant followed by one value per axis, in declared order. */
export function joinVariant(variant: string, values: readonly string[]): string {
  return values.length ? `${variant}${separator}${values.join(separator)}` : variant;
}

/** Every tuple of axis values in declared axis order; one empty tuple for a kind without axes. */
export function axisCombinations(definition: Pick<Definition, "axes" | "props">): readonly (readonly string[])[] {
  let combinations: string[][] = [[]];
  for (const axis of axisNames(definition))
    combinations = combinations.flatMap((prefix) => axisValues(definition, axis).map((value) => [...prefix, value]));
  return combinations;
}

/**
 * Every variant key of a definition: the variants themselves for a kind without axes, otherwise one
 * key per (variant, axis values) combination. The key is what a resolved recipe and a slot class carry.
 */
export function variantKeys(definition: Pick<Definition, "variants" | "axes" | "props">): readonly string[] {
  if (!definition.axes) return definition.variants;
  const combinations = axisCombinations(definition);
  return definition.variants.flatMap((variant) => combinations.map((values) => joinVariant(variant, values)));
}

/** The axis values a node selects: its prop when present, else the axis default. */
export function nodeAxisValues(
  definition: Pick<Definition, "axes">,
  props: Readonly<Record<string, unknown>>,
): string[] {
  const axes: Axes = definition.axes ?? {};
  return Object.entries(axes).map(([axis, { default: fallback }]) => {
    const value = props[axis];
    return typeof value === "string" ? value : fallback;
  });
}

/** Combinations of a definition's axes: one axis at a time away from the defaults (conformance coverage). */
export function singleAxisKeys(definition: Pick<Definition, "variants" | "axes" | "props">): readonly string[] {
  const axes = definition.axes;
  if (!axes) return definition.variants;
  const defaults = Object.values(axes).map((axis) => axis.default);
  const alternatives = [defaults];
  for (const [index, axis] of Object.keys(axes).entries())
    for (const value of axisValues(definition, axis))
      if (value !== defaults[index]) alternatives.push(defaults.map((v, i) => (i === index ? value : v)));
  return definition.variants.flatMap((variant) => alternatives.map((values) => joinVariant(variant, values)));
}
