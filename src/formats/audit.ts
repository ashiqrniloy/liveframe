import type { Result } from "../errors.ts";
import { cascadeRecipes, type ResolvedRecipes } from "../resolve.ts";
import { variantKeys } from "./axes.ts";
import { type Catalog, validateCatalog } from "./catalog.ts";
import { contrastRatio, over, toSrgb } from "./contrast.ts";
import { type DesignSystem, prepareDesignSystem, type RecipeKey, type ResolvedRecipe } from "./design-system.ts";
import { type Colour, type ColourValue, fontWeights } from "./dtcg.ts";
import { type Theme, validateTheme } from "./theme.ts";
import { catalogStates } from "./vocabulary.ts";

/** One pair a catalog's recipes imply and the theme misses: the recipe, the pair, and the miss. */
export type ContrastFinding = {
  readonly kind: "text" | "non-text" | "unresolved-background";
  /** The resolved recipe key, `<kind>.<variant>.<slot>.<state>`. */
  readonly key: string;
  readonly foreground: string;
  readonly background?: string;
  readonly ratio?: number;
  readonly minimum?: number;
};

type Minimums = { readonly text?: number; readonly largeText?: number; readonly nonText?: number };
type Paint = { readonly role: string; readonly alpha: number };
type Trip = ReturnType<typeof toSrgb>;
const defaults = { text: 4.5, largeText: 3, nonText: 3 };
const REM_PX = 16;
const round = (value: number) => Math.round(value * 100) / 100;

/** A resolved colour value as paint; `none` and absence paint nothing. */
function paint(value: ColourValue<number> | undefined): Paint | undefined {
  if (value === undefined || value === "none") return undefined;
  return typeof value === "string" ? { role: value, alpha: 1 } : { role: value.role, alpha: value.alpha };
}

/**
 * WCAG 2.2 §1.4.3 (W3C Recommendation, 2023-10-05, errata 2024-12-12) counts text as large scale at
 * 18 pt (24 px), or 14 pt (18.66 px) at weight 700 or more. A recipe that declares no typography
 * role inherits nothing the audit can read, so it is held to the normal threshold.
 */
function isLarge(theme: Theme, role: string | undefined): boolean {
  const typography = role === undefined ? undefined : theme.typography[role];
  if (!typography) return false;
  const size = typography.fontSize.unit === "rem" ? typography.fontSize.value * REM_PX : typography.fontSize.value;
  if (size >= 24) return true;
  const weight = typeof typography.fontWeight === "number" ? typography.fontWeight : fontWeights[typography.fontWeight];
  return size >= 18.66 && weight >= 700;
}

type Audit = {
  readonly theme: Theme;
  readonly baseRole: string | undefined;
  readonly base: Colour | undefined;
  readonly thresholds: typeof defaults;
  readonly findings: ContrastFinding[];
};

/**
 * The slot's own background, else its kind's root slot for the same state, else the vocabulary's
 * contrast base. A translucent paint composites over the base; without an opaque base the pair is
 * unresolved rather than guessed. `backgroundOpacity` belongs to the element that declares the
 * paint, so an inherited background keeps the root's.
 */
function backdrop(
  { theme, baseRole, base }: Audit,
  recipe: ResolvedRecipe,
  root: ResolvedRecipe | undefined,
): { readonly rgb: Trip; readonly role: string } | undefined {
  const own = paint(recipe.backgroundColor);
  const source = own
    ? { paint: own, opacity: recipe.backgroundOpacity ?? 1 }
    : (() => {
        const inherited = paint(root?.backgroundColor);
        if (inherited) return { paint: inherited, opacity: root?.backgroundOpacity ?? 1 };
        if (baseRole === undefined || base === undefined) return undefined;
        return { paint: { role: baseRole, alpha: 1 }, opacity: 1 };
      })();
  if (!source) return undefined;
  const colour = theme.colours[source.paint.role];
  if (!colour) return undefined;
  const alpha = (colour.alpha ?? 1) * source.paint.alpha * source.opacity;
  const rgb = toSrgb(colour);
  if (alpha >= 1) return { rgb, role: source.paint.role };
  if (!base || (base.alpha ?? 1) !== 1) return undefined;
  return { rgb: over(rgb, alpha, toSrgb(base)), role: source.paint.role };
}

/** Measure one declared foreground; a miss appends the finding and nothing else happens. */
function miss(
  audit: Audit,
  key: string,
  kind: "text" | "non-text",
  value: ColourValue<number> | undefined,
  recipe: ResolvedRecipe,
  root: ResolvedRecipe | undefined,
): void {
  const foreground = paint(value);
  if (!foreground) return;
  const background = backdrop(audit, recipe, root);
  if (!background) {
    audit.findings.push({ kind: "unresolved-background", key, foreground: foreground.role });
    return;
  }
  const colour = audit.theme.colours[foreground.role];
  if (!colour) return;
  const alpha = (colour.alpha ?? 1) * foreground.alpha;
  const rgb = alpha >= 1 ? toSrgb(colour) : over(toSrgb(colour), alpha, background.rgb);
  const minimum =
    kind === "non-text"
      ? audit.thresholds.nonText
      : isLarge(audit.theme, recipe.typography)
        ? audit.thresholds.largeText
        : audit.thresholds.text;
  const ratio = contrastRatio(rgb, background.rgb);
  if (ratio >= minimum) return;
  audit.findings.push({
    kind,
    key,
    foreground: foreground.role,
    background: background.role,
    ratio: round(ratio),
    minimum,
  });
}

/** One `(kind, variant, slot, state)`: its text pairs, and its control boundary when interactive. */
function auditState(
  audit: Audit,
  kind: string,
  variant: string,
  slot: string,
  interactive: boolean,
  state: string,
  table: ResolvedRecipes,
): void {
  const key = `${kind}.${variant}.${slot}.${state}`;
  const recipe = table[key as RecipeKey];
  if (!recipe) return;
  const root = slot === "root" ? recipe : table[`${kind}.${variant}.root.${state}` as RecipeKey];
  miss(audit, key, "text", recipe.textColor, recipe, root);
  miss(audit, key, "text", recipe.placeholderColor, recipe, root);
  if (!interactive) return;
  // Non-text contrast (WCAG 2.2 §1.4.11): the control's border at rest, its outline at focus.
  if (state === "rest") miss(audit, key, "non-text", recipe.borderColor, recipe, root);
  if (state === "focus") miss(audit, key, "non-text", recipe.outlineColor, recipe, root);
}

function auditCatalog(audit: Audit, catalog: Catalog, table: ResolvedRecipes): void {
  const stateNames = catalogStates(catalog.vocabulary);
  for (const definition of catalog.definitions) {
    const interactive = Object.keys(definition.events).length > 0;
    for (const variant of variantKeys(definition))
      for (const slot of definition.slots)
        for (const state of stateNames) auditState(audit, definition.kind, variant, slot, interactive, state, table);
  }
}

/**
 * Every contrast pair a catalog's recipes imply, measured against the theme (spec §6.5). Recipes
 * pick colours per slot and state, so a pair no vocabulary declaration names can still be
 * unreadable; this finds those. Install-time only, never on the render path: it reads the theme's
 * roles and introduces no colour of its own, and it resolves nothing a host needs authority for.
 */
export function auditContrast({
  theme,
  designSystem,
  catalog,
  registry = {},
  minimums = {},
}: {
  readonly theme: unknown;
  readonly designSystem: unknown;
  readonly catalog: unknown;
  readonly registry?: Readonly<Record<string, DesignSystem>>;
  readonly minimums?: Minimums;
}): Result<readonly ContrastFinding[]> {
  const installed = validateCatalog(catalog);
  if (!installed.ok) return installed;
  const themeResult = validateTheme(theme, installed.value.vocabulary);
  if (!themeResult.ok) return themeResult;
  const systemResult = prepareDesignSystem(designSystem, { catalog: installed.value, registry });
  if (!systemResult.ok) return systemResult;
  const baseRole = installed.value.vocabulary.contrastBase;
  const audit: Audit = {
    theme: themeResult.value,
    baseRole,
    base: baseRole === undefined ? undefined : themeResult.value.colours[baseRole],
    thresholds: { ...defaults, ...minimums },
    findings: [],
  };
  auditCatalog(audit, installed.value, cascadeRecipes(systemResult.value, installed.value));
  return { ok: true, value: audit.findings };
}
