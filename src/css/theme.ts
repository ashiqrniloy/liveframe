import type { Result } from "../errors.ts";
import { type Catalog, validateCatalog } from "../formats/catalog.ts";
import type { Colour, Typography } from "../formats/dtcg.ts";
import { type Theme, validateTheme } from "../formats/theme.ts";
import { colourVar, cssString, typographyVar } from "./names.ts";

const genericFamilies = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
]);
const fontWeights = {
  thin: 100,
  hairline: 100,
  "extra-light": 200,
  "ultra-light": 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  "semi-bold": 600,
  "demi-bold": 600,
  bold: 700,
  "extra-bold": 800,
  "ultra-bold": 800,
  black: 900,
  heavy: 900,
  "extra-black": 950,
  "ultra-black": 950,
} satisfies Record<Exclude<Typography["fontWeight"], number>, number>;

function colour(value: Colour): string {
  const { colorSpace, components, alpha } = value;
  const body =
    components
      .map((component, index) =>
        component !== "none" && index > 0 && (colorSpace === "hsl" || colorSpace === "hwb")
          ? `${component}%`
          : String(component),
      )
      .join(" ") + (alpha === undefined ? "" : ` / ${alpha}`);
  return ["hsl", "hwb", "lab", "lch", "oklab", "oklch"].includes(colorSpace)
    ? `${colorSpace}(${body})`
    : `color(${colorSpace} ${body})`;
}

function typography(value: Typography): Record<keyof Typography, string> {
  const families = typeof value.fontFamily === "string" ? [value.fontFamily] : value.fontFamily;
  return {
    fontFamily: families
      .map((family) => (genericFamilies.has(family.toLowerCase()) ? family : cssString(family)))
      .join(","),
    fontSize: `${value.fontSize.value}${value.fontSize.unit}`,
    fontWeight: String(typeof value.fontWeight === "number" ? value.fontWeight : fontWeights[value.fontWeight]),
    lineHeight: String(value.lineHeight),
    letterSpacing: value.letterSpacing ? `${value.letterSpacing.value}${value.letterSpacing.unit}` : "0",
    textTransform: value.textTransform ?? "none",
    fontStretch: `${value.fontStretch ?? 100}%`,
    fontSizeAdjust: value.fontSizeAdjust === undefined ? "none" : `ex-height ${value.fontSizeAdjust}`,
  };
}

/** Validates and projects one theme, independently of the design system. */
export function themeCss(theme: Theme, catalog: Catalog): Result<string> {
  const installed = validateCatalog(catalog);
  if (!installed.ok) return installed;
  const checked = validateTheme(theme, installed.value.vocabulary);
  if (!checked.ok) return checked;
  const declarations = [`color-scheme:${theme.colorScheme}`];
  for (const role of Object.keys(theme.colours).sort()) {
    const value = theme.colours[role];
    if (value) declarations.push(`${colourVar(role)}:${colour(value)}`);
  }
  for (const role of Object.keys(theme.typography).sort()) {
    const value = theme.typography[role];
    if (!value) continue;
    const fields = typography(value);
    for (const field of Object.keys(fields).sort() as (keyof Typography)[]) {
      declarations.push(`${typographyVar(role, field)}:${fields[field]}`);
    }
  }
  return {
    ok: true,
    value: `:where([data-lf-theme=${cssString(`${theme.id}@${theme.version}`)}]){${declarations.join(";")}}`,
  };
}
