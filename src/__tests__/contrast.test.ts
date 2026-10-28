import { expect, test } from "bun:test";
import { toSrgb, contrastRatio } from "../formats/contrast.ts";
import { type Theme, type Vocabulary, validateTheme } from "../index.ts";
import vocabulary from "./fixtures/vocabulary.json" with { type: "json" };
import fixture from "./fixtures/certified.theme.json" with { type: "json" };

const rgb = (r: number, g = r, b = r, alpha = 1) => ({ colorSpace: "srgb", components: [r, g, b], alpha }) as const;
const names: Vocabulary = {
  ...vocabulary,
  colourRoles: ["ink", "paper", "base", "quiet"],
  surfaceRoles: ["base"],
  contrast: [{ foreground: "ink", background: "paper", minimum: 4.5 }],
};
const theme = { ...fixture, colours: { ink: rgb(0), paper: rgb(1), base: rgb(1), quiet: rgb(0.5) } } as Theme;
function errors(doc: Theme, v = names) {
  const result = validateTheme(doc, v);
  if (result.ok) throw new Error("Expected contrast failure");
  return result.errors;
}

test("converts_every_dtcg_space_to_luminance", () => {
  // Chromatic reference: CSS Color 4 2025-04-24 sample code, sRGB (.25, .5, .75).
  const references = {
    srgb: [0.25, 0.5, 0.75],
    "srgb-linear": [0.05087608817155679, 0.21404114048223255, 0.5225215539683921],
    hsl: [210, 50, 50],
    hwb: [210, 25, 25],
    lab: [51.43207595004617, -5.2282558375959525, -40.14379397152958],
    lch: [51.43207595004617, 40.48282170911473, 262.5796667226275],
    oklab: [0.5855504329172014, -0.039415128651616005, -0.11150509816121545],
    oklch: [0.5855504329172014, 0.11826639117925995, 250.53237718027046],
    "display-p3": [0.3130049131269911, 0.49410463759125406, 0.7301505039875678],
    "a98-rgb": [0.3467407108034278, 0.49610369844871743, 0.7361425710870978],
    "prophoto-rgb": [0.3749291293108795, 0.41649447298743636, 0.6638026692801895],
    rec2020: [0.3319982279799454, 0.4409758857671542, 0.6964222306090337],
    "xyz-d65": [0.19182369250207168, 0.20161580125891984, 0.523169600334586],
    "xyz-d50": [0.1793851460972289, 0.196438053591218, 0.3946200976253338],
  } as const;
  for (const [colorSpace, components] of Object.entries(references)) {
    const colour = { colorSpace, components } as Theme["colours"][string];
    const actual = toSrgb(colour);
    for (const [i, expected] of [0.25, 0.5, 0.75].entries()) expect(actual[i]).toBeCloseTo(expected, 6);
    expect(contrastRatio(actual, [0, 0, 0])).toBeCloseTo(5.0324907242936705, 6);
  }
});

test("wide_gamut_srgb_clipping_reference_values", () => {
  for (const [space, components, expected] of [
    ["display-p3", [1, 0, 0], [1, 0, 0]],
    ["rec2020", [0, 1, 0], [0, 1, 0]],
  ] as const) {
    const actual = toSrgb({ colorSpace: space, components });
    for (let i = 0; i < 3; i++) expect(actual[i]).toBeCloseTo(expected[i]!, 12);
  }
  expect(toSrgb({ colorSpace: "hwb", components: [60, 80, 80] })).toEqual([0.5, 0.5, 0.5]);
  expect(toSrgb({ colorSpace: "srgb", components: ["none", "none", "none"], hex: "#ffffff" })).toEqual([0, 0, 0]);
});

test("pair_below_minimum_fails_with_ratio", () => {
  const bad = { ...theme, colours: { ...theme.colours, ink: rgb(0.8) } };
  expect(errors(bad)).toContainEqual(
    expect.objectContaining({ kind: "insufficient-contrast", message: expect.stringContaining("1.61") }),
  );
  const message = errors(bad)[0]?.message ?? "";
  for (const name of ["0", "ink", "paper"]) expect(message).toContain(name);
});

test("pair_above_maximum_fails_and_thresholds_compare_unrounded_ratios", () => {
  expect(validateTheme(theme, names).ok).toBe(true);
  expect(errors(theme, { ...names, contrast: [{ ...names.contrast![0]!, maximum: 20 }] })[0]?.kind).toBe(
    "insufficient-contrast",
  );
  const ratio = contrastRatio([0.5, 0.5, 0.5], [1, 1, 1]);
  const doc = { ...theme, colours: { ...theme.colours, ink: rgb(0.5) } };
  for (const minimum of [ratio, ratio - 1e-8])
    expect(validateTheme(doc, { ...names, contrast: [{ foreground: "ink", background: "paper", minimum }] }).ok).toBe(
      true,
    );
  expect(
    validateTheme(doc, { ...names, contrast: [{ foreground: "ink", background: "paper", minimum: ratio + 1e-8 }] }).ok,
  ).toBe(false);
});

test("ordering_violation_names_both_pairs", () => {
  const v = {
    ...names,
    contrast: [
      { foreground: "ink", background: "paper", minimum: 1, lessThan: 1 },
      { foreground: "quiet", background: "paper", minimum: 1 },
    ],
  };
  const message = errors(theme, v)[0]?.message ?? "";
  for (const name of ["0", "1", "ink", "quiet", "paper", "21.00", "3.98"]) expect(message).toContain(name);
  expect(
    validateTheme(theme, {
      ...v,
      contrast: [
        { foreground: "quiet", background: "paper", minimum: 1, lessThan: 1 },
        { foreground: "ink", background: "paper", minimum: 1 },
      ],
    }).ok,
  ).toBe(true);
});

test("composites_alpha_before_ratio", () => {
  const doc = { ...theme, colours: { ...theme.colours, ink: rgb(0, 0, 0, 0.5), paper: rgb(0, 0, 0, 0.5) } };
  const ratio = contrastRatio([0.25, 0.25, 0.25], [0.5, 0.5, 0.5]);
  expect(
    validateTheme(doc, {
      ...names,
      contrastBase: "base",
      contrast: [{ foreground: "ink", background: "paper", minimum: ratio - 1e-8, maximum: ratio + 1e-8 }],
    }).ok,
  ).toBe(true);
});

test("translucent_background_requires_opaque_declared_base", () => {
  const doc = { ...theme, colours: { ...theme.colours, paper: rgb(1, 1, 1, 0.5) } };
  expect(errors(doc)[0]?.kind).toBe("invalid-document");
  expect(validateTheme(doc, { ...names, contrastBase: "base" }).ok).toBe(true);
  expect(
    errors({ ...doc, colours: { ...doc.colours, base: rgb(1, 1, 1, 0.5) } }, { ...names, contrastBase: "base" })[0]
      ?.kind,
  ).toBe("invalid-document");
  expect(
    errors(
      { ...theme, colours: { ...theme.colours, base: rgb(1, 1, 1, 0.5) } },
      { ...names, contrastBase: "base", contrast: [] },
    )[0]?.kind,
  ).toBe("invalid-document");
});

test("vocabulary_without_contrast_unchanged", () => {
  const { contrast: _, ...v } = names;
  expect(validateTheme({ ...theme, colours: { ...theme.colours, ink: rgb(1), paper: rgb(1, 1, 1, 0.5) } }, v).ok).toBe(
    true,
  );
});

test("contrast_errors_are_bounded_and_bad_structure_short_circuits_math", () => {
  expect(errors({ ...theme, colours: {} })).toContainEqual(expect.objectContaining({ kind: "unknown-name" }));
  const contrast = Array.from({ length: 256 }, () => ({
    foreground: "ink",
    background: "paper",
    minimum: 1,
    maximum: 2,
  }));
  expect(errors(theme, { ...names, contrast })).toHaveLength(20);
  const extreme = {
    ...theme,
    colours: { ...theme.colours, ink: { colorSpace: "lab", components: [50, 1e308, 1e308] } },
  } as Theme;
  expect(errors(extreme)[0]?.kind).toBe("invalid-document");
});

test("proof_themes_pass_their_pairs", async () => {
  const v: Vocabulary = await Bun.file(new URL("./fixtures/proof/vocabulary.json", import.meta.url)).json();
  expect(v.contrast?.length).toBeGreaterThan(0);
  for (const name of ["certified", "rack"]) {
    const doc = await Bun.file(new URL(`./fixtures/proof/${name}.theme.json`, import.meta.url)).json();
    expect(validateTheme(doc, v).ok).toBe(true);
  }
});
