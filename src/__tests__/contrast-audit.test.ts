import { expect, test } from "bun:test";
import {
  auditContrast,
  type Catalog,
  type ContrastFinding,
  defineComponent,
  obj,
  states,
  str,
  type Theme,
  validateTheme,
} from "../index.ts";
import { contrastRatio, toSrgb } from "../formats/contrast.ts";

// A palette whose ratios the test can state: black ink on white paper is 21:1, mid grey (quiet) is
// 3.98:1, and light grey (line) is 2.11:1 — under non-text contrast and over it for large text only.
const rgb = (value: number, alpha = 1) => ({ colorSpace: "srgb", components: [value, value, value], alpha }) as const;
const vocabulary = {
  colourRoles: ["paper", "ink", "quiet", "line", "fill", "ring"],
  surfaceRoles: ["paper"],
  fillableRoles: ["fill"],
  tones: { default: "ink" },
  typographyRoles: ["body", "large", "bold"],
  surfaceTypography: "body",
  space: ["space.1"],
  radius: ["radius.control"],
  size: ["size.glyph"],
  breakpoints: ["bp.sm"],
  contrastBase: "paper",
} as const;
const catalog = {
  format: "liveframe-catalog/1",
  catalogId: "acme.ui@1",
  description: "One interactive kind, for contrast pairs.",
  vocabulary,
  definitions: [
    defineComponent({
      kind: "button",
      description: "Runs an intent.",
      props: obj({ label: str({ maxLength: 80 }) }),
      children: "none",
      variants: ["default"],
      defaultVariant: "default",
      slots: ["root", "label"],
      events: { onPress: { carries: "none", description: "Pressed." } },
      styleProps: ["width"],
      a11y: { role: "button", name: "label" },
    }),
  ],
} as const satisfies Catalog;
const typography = (size: number, weight: number) => ({
  fontFamily: "Inter",
  fontSize: { value: size, unit: "px" },
  fontWeight: weight,
  lineHeight: 1.5,
});
const theme = {
  format: "liveframe-theme/1",
  id: "acme",
  version: "1.0.0",
  colorScheme: "light",
  colours: { paper: rgb(1), ink: rgb(0), quiet: rgb(0.5), line: rgb(0.7), fill: rgb(0), ring: rgb(0) },
  typography: { body: typography(16, 400), large: typography(24, 400), bold: typography(18.66, 700) },
} as Theme;
const values = {
  "space.1": { kind: "spacing", value: { value: 4, unit: "px" } },
  "radius.control": { kind: "radius", value: { value: 4, unit: "px" } },
  "size.glyph": { kind: "size", value: { value: 16, unit: "px" } },
  "bp.sm": { kind: "breakpoint", value: { value: 480, unit: "px" } },
} as const;
const designSystem = (recipes: Record<string, Record<string, unknown>> = {}) => ({
  format: "liveframe-design-system/1" as const,
  id: "acme",
  version: "1.0.0",
  values,
  recipes: {
    "button.*.root.rest": { backgroundColor: "paper" },
    "button.*.label.rest": { typography: "body", textColor: "ink" },
    "button.*.root.focus": { outlineColor: "ring", outlineStyle: "solid" },
    ...recipes,
  },
});
const audit = (recipes: Record<string, Record<string, unknown>> = {}, options: Record<string, unknown> = {}) => {
  const result = auditContrast({ theme, designSystem: designSystem(recipes), catalog, ...options });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
};
const ratio = (foreground: number, background: number) =>
  contrastRatio(toSrgb(rgb(foreground)), toSrgb(rgb(background)));
/** Every state inherits a rest declaration, so an unreadable rest pair fails in every state. */
const keys = (findings: readonly ContrastFinding[]) => findings.map((finding) => finding.key);
const labelKeys = (slot = "label") => states.map((state) => `button.default.${slot}.${state}`);

test("audit_reports_text_pair_from_recipe_not_declared_in_vocabulary", () => {
  // No vocabulary contrast pair names quiet on paper; only the recipe pairs them.
  expect(vocabulary).not.toHaveProperty("contrast");
  expect(audit()).toEqual([]);
  const findings = audit({ "button.*.label.rest": { typography: "body", textColor: "quiet" } });
  expect(keys(findings)).toEqual(labelKeys());
  expect(findings[0]).toEqual({
    kind: "text",
    key: "button.default.label.rest",
    foreground: "quiet",
    background: "paper",
    ratio: Math.round(ratio(0.5, 1) * 100) / 100,
    minimum: 4.5,
  });
});

test("large_text_uses_three_to_one", () => {
  const finding = (role: string) => audit({ "button.*.label.rest": { typography: role, textColor: "quiet" } });
  // 24 px passes at 3:1 (quiet on paper is 3.43:1); 18.66 px at weight 700 also counts as large.
  expect(finding("large")).toEqual([]);
  expect(finding("bold")).toEqual([]);
  expect(finding("body")).toHaveLength(states.length);
  expect(finding("body")[0]).toMatchObject({ kind: "text", minimum: 4.5 });
  const underweight = { ...theme, typography: { ...theme.typography, bold: typography(18.66, 600) } } as Theme;
  const result = auditContrast({
    theme: underweight,
    designSystem: designSystem({ "button.*.label.rest": { typography: "bold", textColor: "quiet" } }),
    catalog,
  });
  expect(result.ok && result.value[0]).toMatchObject({ kind: "text", minimum: 4.5 });
});

test("alpha_and_background_opacity_composite_once", () => {
  // 0.5 role alpha × 0.5 backgroundOpacity over the white base leaves #bfbfbf, not twice or once
  // over the wrong colour.
  const findings = audit({
    "button.*.root.rest": { backgroundColor: { role: "fill", alpha: 0.5 }, backgroundOpacity: 0.5 },
    "button.*.label.rest": { typography: "body", textColor: "quiet" },
  });
  const expected = Math.round(contrastRatio(toSrgb(rgb(0.5)), [0.75, 0.75, 0.75]) * 100) / 100;
  expect(keys(findings)).toEqual(labelKeys());
  for (const finding of findings) expect(finding).toMatchObject({ kind: "text", background: "fill", ratio: expected });
});

test("focus_outline_non_text_contrast", () => {
  expect(audit()).toEqual([]);
  expect(audit({ "button.*.root.focus": { outlineColor: "line", outlineStyle: "solid" } })).toEqual([
    {
      kind: "non-text",
      key: "button.default.root.focus",
      foreground: "line",
      background: "paper",
      ratio: Math.round(ratio(0.7, 1) * 100) / 100,
      minimum: 3,
    },
  ]);
  expect(audit({ "button.*.root.rest": { backgroundColor: "paper", borderColor: "line" } })).toEqual([
    expect.objectContaining({ kind: "non-text", key: "button.default.root.rest", foreground: "line", minimum: 3 }),
  ]);
});

test("unresolved_background_is_reported", () => {
  const { contrastBase: _omitted, ...noBase } = vocabulary;
  const translucent = { "button.*.root.rest": { backgroundColor: { role: "fill", alpha: 0.5 } } };
  const paired = { "button.*.label.rest": { typography: "body", textColor: "ink" } };
  const result = auditContrast({
    theme,
    designSystem: designSystem({ ...translucent, ...paired }),
    catalog: { ...catalog, vocabulary: noBase },
  });
  const found = result.ok ? result.value : [];
  // The focus outline is measured against the same unknown background, so it reports too.
  expect(keys(found)).toEqual(["button.default.root.focus", ...labelKeys()]);
  expect(found[0]).toEqual({ kind: "unresolved-background", key: "button.default.root.focus", foreground: "ring" });
  expect(found[1]).toEqual({ kind: "unresolved-background", key: "button.default.label.rest", foreground: "ink" });
});

test("invalid_inputs_return_validator_errors", () => {
  const options = { theme, designSystem: designSystem(), catalog };
  expect(auditContrast({ ...options, catalog: null })).toMatchObject({ ok: false });
  expect(auditContrast({ ...options, theme: { ...theme, colours: {} } })).toMatchObject({ ok: false });
  expect(auditContrast({ ...options, designSystem: { ...designSystem(), recipes: {} } })).toMatchObject({ ok: false });
  // A design system that installs still installs: the audit never widens installation.
  expect(validateTheme(theme, vocabulary).ok).toBe(true);
});
