import type { Result } from "../errors.ts";
import { type Catalog, validateCatalog } from "../formats/catalog.ts";
import { type Colour, fontWeights, type Typography } from "../formats/dtcg.ts";
import { sameJson } from "../formats/json.ts";
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

/** Catalogs `validateCatalog` accepted, least recently used first. A host installs a handful. */
const MAX_CATALOGS = 8;
const acceptedCatalogs = new Map<string, unknown>();

/**
 * `validateCatalog`, skipped for content that already passed. The key is the catalog's JSON text and
 * the entry is the cache's own parse of it, so a later change to the caller's object cannot alter
 * an entry (plan 022 F2). A hit also needs the object to equal that parse, so values the text hides
 * (`NaN`, `undefined`, a `Date`) never match. Failures are not kept: their errors go to the caller.
 */
function installedCatalog(catalog: Catalog): Result<Catalog> {
  let key: string | undefined;
  try {
    key = JSON.stringify(catalog);
  } catch {
    return validateCatalog(catalog); // A cycle or a BigInt: leave caching out of the failure path.
  }
  if (key === undefined) return validateCatalog(catalog);
  const accepted = acceptedCatalogs.get(key);
  if (accepted !== undefined && sameJson(accepted, catalog)) {
    acceptedCatalogs.delete(key);
    acceptedCatalogs.set(key, accepted);
    return { ok: true, value: catalog };
  }
  const result = validateCatalog(catalog);
  if (!result.ok) return result;
  const parsed: unknown = JSON.parse(key);
  if (sameJson(parsed, catalog)) {
    acceptedCatalogs.set(key, parsed);
    if (acceptedCatalogs.size > MAX_CATALOGS) acceptedCatalogs.delete(acceptedCatalogs.keys().next().value as string);
  }
  return result;
}

/** Validates and projects one theme, independently of the design system. */
export function themeCss(theme: Theme, catalog: Catalog): Result<string> {
  const installed = installedCatalog(catalog);
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
