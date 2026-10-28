import type { ColourValue } from "../formats/dtcg.ts";
import type { ResolvedRecipe } from "../formats/design-system.ts";
import { noPaint, recipeProperties } from "../formats/fixed.ts";
import { colourVar, typographyVar } from "./names.ts";

function colourValue(value: ColourValue<number>): string {
  if (value === noPaint) return "transparent";
  if (typeof value === "string") return `var(${colourVar(value)})`;
  return `color-mix(in oklab, var(${colourVar(value.role)}) ${Number((value.alpha * 100).toFixed(2))}%, transparent)`;
}
const dimension = (value: { readonly value: number; readonly unit: string }): string => `${value.value}${value.unit}`;
const transitionProperties =
  "background-color,color,border-color,outline-color,opacity,translate,box-shadow,backdrop-filter";
const typeFields = {
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "font-weight": "fontWeight",
  "line-height": "lineHeight",
  "letter-spacing": "letterSpacing",
  "text-transform": "textTransform",
  "font-stretch": "fontStretch",
  "font-size-adjust": "fontSizeAdjust",
};
type Property = (typeof recipeProperties)[number];
const properties: { [P in Property]: (value: NonNullable<ResolvedRecipe[P]>, recipe: ResolvedRecipe) => string } = {
  backgroundColor: (value, recipe) =>
    `background-color:${value === noPaint || recipe.backgroundOpacity === undefined ? colourValue(value) : `color-mix(in srgb, ${colourValue(value)} calc(var(--lf-alpha) * 100%), transparent)`}`,
  textColor: (value) => `color:${colourValue(value)}`,
  borderColor: (value) => `border-color:${colourValue(value)}`,
  outlineColor: (value) => `outline-color:${colourValue(value)}`,
  borderWidth: (value, recipe) =>
    `border-width:${dimension(value)}${recipe.borderStyle === undefined ? ";border-style:solid" : ""}`,
  borderTopWidth: (value, recipe) =>
    `border-top-width:${dimension(value)}${recipe.borderStyle === undefined ? ";border-top-style:solid" : ""}`,
  borderRightWidth: (value, recipe) =>
    `border-inline-end-width:${dimension(value)}${recipe.borderStyle === undefined ? ";border-inline-end-style:solid" : ""}`,
  borderBottomWidth: (value, recipe) =>
    `border-bottom-width:${dimension(value)}${recipe.borderStyle === undefined ? ";border-bottom-style:solid" : ""}`,
  borderLeftWidth: (value, recipe) =>
    `border-inline-start-width:${dimension(value)}${recipe.borderStyle === undefined ? ";border-inline-start-style:solid" : ""}`,
  borderRadius: (value) => `border-radius:${dimension(value)}`,
  borderStyle: (value) => `border-style:${value}`,
  padding: (value) => `padding:${dimension(value)}`,
  paddingX: (value) => `padding-inline:${dimension(value)}`,
  paddingY: (value) => `padding-block:${dimension(value)}`,
  gap: (value) => `gap:${dimension(value)}`,
  typography: (value) =>
    Object.entries(typeFields)
      .map(([property, field]) => `${property}:var(${typographyVar(value, field)})`)
      .join(";"),
  opacity: (value) => `opacity:${value}`,
  backgroundOpacity: (value) => `--lf-alpha:${value}`,
  shadow: (value) => {
    const layers = Array.isArray(value) ? value : [value];
    return `box-shadow:${layers.length ? layers.map((layer) => `${layer.inset ? "inset " : ""}${[layer.offsetX, layer.offsetY, layer.blur, layer.spread].map(dimension).join(" ")} ${colourValue(layer.color)}`).join(",") : "none"}`;
  },
  backdropBlur: (value, recipe) =>
    `backdrop-filter:blur(${dimension(value)}) saturate(${recipe.backdropSaturate ?? 1})`,
  backdropSaturate: (value, recipe) =>
    recipe.backdropBlur === undefined ? `backdrop-filter:blur(0px) saturate(${value})` : "",
  transitionDuration: (value) => `transition-duration:${dimension(value)}`,
  transitionTiming: (value) => `transition-timing-function:cubic-bezier(${value.join(",")})`,
  translateY: (value) => `translate:0 ${dimension(value)}`,
  outlineWidth: (value) => `outline-width:${dimension(value)}`,
  outlineOffset: (value) => `outline-offset:${dimension(value)}`,
  outlineStyle: (value) => `outline-style:${value}`,
};

/** Input is the validated, flattened resolver output; fixed order makes comparison deterministic. */
export function recipeDeclarations(recipe: ResolvedRecipe): string {
  function declaration<P extends Property>(property: P): string {
    const value = recipe[property];
    return value === undefined ? "" : properties[property](value, recipe);
  }
  const declarations = recipeProperties.map(declaration).filter(Boolean);
  if (recipe.transitionDuration !== undefined || recipe.transitionTiming !== undefined)
    declarations.push(`transition-property:${transitionProperties}`);
  return declarations.join(";");
}
