import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { schemaDocument } from "../formats/registry.ts";
import { validateTheme, type Theme, type Vocabulary } from "../index.ts";
import vocabulary from "./fixtures/vocabulary.json" with { type: "json" };

const names: Vocabulary = { ...vocabulary, colourRoles: ["surface.base"], typographyRoles: ["body"] };
const colour = { colorSpace: "oklch", components: [0.966, 0.01, 172] } as const;
const typography = {
  fontFamily: ["Inter", "sans-serif"],
  fontSize: { value: 14, unit: "px" },
  fontWeight: 400,
  lineHeight: 1.5,
} as const;
const theme: Theme = {
  format: "liveframe-theme/1",
  id: "example",
  version: "1.0.0",
  colorScheme: "light",
  colours: { "surface.base": colour },
  typography: { body: typography },
};
function rejects(doc: unknown, pointer: string, kind = "invalid-document") {
  const result = validateTheme(doc, names);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ pointer, kind }));
}
const withColour = (value: unknown) => ({ ...theme, colours: { "surface.base": value } });
const withType = (value: unknown) => ({ ...theme, typography: { body: value } });

test("theme_must_cover_the_vocabulary", () => {
  expect(validateTheme(theme, names)).toEqual({ ok: true, value: theme });
  const result = validateTheme(theme, names);
  if (result.ok) expect(result.value).toBe(theme);
  for (const key of ["colours", "typography"] as const) {
    const role = key === "colours" ? "surface.base" : "body";
    rejects({ ...theme, [key]: {} }, `/${key}/${role}`, "unknown-name");
    rejects(
      { ...theme, [key]: { ...theme[key], extra: key === "colours" ? colour : typography } },
      `/${key}/extra`,
      "unknown-name",
    );
  }
});

test("colour_values_follow_dtcg", () => {
  for (const [value, pointer] of [
    [{ ...colour, colorSpace: "unknown" }, "colorSpace"],
    [{ ...colour, components: [0, 0] }, "components"],
    [{ ...colour, components: [1.1, 0, 0] }, "components/0"],
    [{ ...colour, components: [0, -1, 0] }, "components/1"],
    [{ ...colour, components: [0, 0, 360] }, "components/2"],
    [{ ...colour, alpha: 1.5 }, "alpha"],
    [{ ...colour, hex: "#abc" }, "hex"],
    [{ ...colour, extra: true }, "extra"],
  ] as const)
    rejects(withColour(value), `/colours/surface.base/${pointer}`);
  for (const n of [NaN, Infinity, -Infinity])
    rejects(withColour({ ...colour, components: [n, 0, 0] }), "/colours/surface.base/components/0");
  expect(
    validateTheme(withColour({ ...colour, components: ["none", "none", "none"], alpha: 0, hex: "#Ff00aA" }), names).ok,
  ).toBe(true);
});

test("font_family_is_not_css", () => {
  for (const fontFamily of [
    "Inter; color: red",
    "url(x)",
    "URL (x)",
    "x{y}",
    "x\\3b color:red",
    "x\nred",
    "",
    [],
    Array(9).fill("Inter"),
    "x".repeat(129),
    ["Inter", "url(x)"],
  ])
    expect(validateTheme(withType({ ...typography, fontFamily }), names).ok).toBe(false);
});

test("typography_is_closed_and_bounded", () => {
  for (const [key, value] of Object.entries({
    fontSize: { value: 1, unit: "em" },
    fontWeight: "Bold",
    lineHeight: 11,
    letterSpacing: { value: -1025, unit: "em" },
    textTransform: "lowercase",
    fontStretch: 201,
    fontSizeAdjust: -1,
    extra: true,
  }))
    rejects(
      withType({ ...typography, [key]: value }),
      `/typography/body/${key === "fontSize" ? "fontSize/unit" : key === "letterSpacing" ? "letterSpacing/value" : key}`,
    );
  for (const fontWeight of [1, 1000, 450.5, "thin", "ultra-black", "book"])
    expect(
      validateTheme(
        withType({
          ...typography,
          fontWeight,
          letterSpacing: { value: -0.01, unit: "em" },
          textTransform: "uppercase",
          fontStretch: 87.5,
          fontSizeAdjust: 0.52,
        }),
        names,
      ).ok,
    ).toBe(true);
  for (const patch of [
    { fontFamily: "Inter" },
    { fontSize: { value: 4096, unit: "rem" }, lineHeight: 0 },
    { letterSpacing: { value: 1024, unit: "px" }, fontStretch: 50, fontSizeAdjust: 10 },
  ])
    expect(validateTheme(withType({ ...typography, ...patch }), names).ok).toBe(true);
  for (const patch of [
    { fontSize: { value: -1, unit: "px" } },
    { fontSize: { value: 4097, unit: "rem" } },
    { fontWeight: 0 },
    { fontWeight: 1001 },
    { lineHeight: NaN },
    { letterSpacing: { value: 0, unit: "%" } },
    { fontStretch: "87.5%" },
    { fontSizeAdjust: 11 },
  ])
    expect(validateTheme(withType({ ...typography, ...patch }), names).ok).toBe(false);
});

test("theme_errors_are_bounded_and_escaped", () => {
  for (const doc of [
    null,
    [],
    {},
    { ...theme, extra: true },
    { ...theme, colorScheme: "sepia" },
    { ...theme, colours: [] },
    { ...theme, id: "" },
    { ...theme, version: "" },
  ])
    expect(validateTheme(doc, names).ok).toBe(false);
  rejects({ ...theme, colours: { "bad/~name": colour } }, "/colours/bad~1~0name");
  rejects({ ...theme, colours: Object.fromEntries([["toString", colour]]) }, "/colours/toString", "unknown-name");
  const result = validateTheme(
    { ...theme, colours: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`unknown${i}`, colour])) },
    names,
  );
  if (result.ok) throw new Error("Expected errors");
  expect(result.errors).toHaveLength(20);
  rejects(
    { ...theme, colours: Object.fromEntries(Array.from({ length: 257 }, (_, i) => [`role${i}`, colour])) },
    "/colours",
  );
});

test("theme_schema_agrees_with_install_structure_and_ranges", () => {
  const validate = new Ajv2020({ strict: true }).compile(schemaDocument("theme"));
  const spaces = [
    "srgb",
    "srgb-linear",
    "hsl",
    "hwb",
    "lab",
    "lch",
    "oklab",
    "oklch",
    "display-p3",
    "a98-rgb",
    "prophoto-rgb",
    "rec2020",
    "xyz-d65",
    "xyz-d50",
  ];
  for (const colorSpace of spaces)
    for (const components of [
      [0, 0, 0],
      [1, 1, 1],
      ["none", 0, 0],
      [-1, 0, 0],
      [0, -1000, 0],
      [0, 1000, 0],
      [0, 0, 359.99],
      [0, 0, 360],
      [0, 0],
      [0, 0, 0, 0],
    ]) {
      const doc = withColour({ colorSpace, components });
      expect(validate(doc)).toBe(validateTheme(doc, names).ok);
    }
  for (const doc of [
    theme,
    withType({ ...typography, fontFamily: "Inter" }),
    withType({ ...typography, fontWeight: "semi-bold" }),
    withType({ ...typography, fontFamily: "URL(x)" }),
    withColour({ ...colour, alpha: 1.5 }),
    withType({ ...typography, lineHeight: Infinity }),
  ])
    expect(validate(doc)).toBe(validateTheme(doc, names).ok);
  // DTCG's typical Lab/OKLab/chroma values are not normative upper bounds.
  for (const [colorSpace, components] of [
    ["lab", [50, -1000, 1000]],
    ["oklab", [0.5, -10, 10]],
    ["lch", [50, 1000, 0]],
    ["oklch", [0.5, 10, 0]],
  ] as const)
    expect(validateTheme(withColour({ colorSpace, components }), names).ok).toBe(true);
});

test("proof_themes_validate_under_2ms", async () => {
  const structural = new Ajv2020({ strict: true }).compile(schemaDocument("theme"));
  for (const name of ["certified", "rack"]) {
    const doc = await Bun.file(new URL(`./fixtures/${name}.theme.json`, import.meta.url)).json();
    expect(validateTheme(doc, vocabulary).ok).toBe(true);
    expect(structural(doc)).toBe(true);
    for (let i = 0; i < 10; i++) validateTheme(doc, vocabulary);
    const start = performance.now();
    for (let i = 0; i < 100; i++) validateTheme(doc, vocabulary);
    expect((performance.now() - start) / 100).toBeLessThan(2);
  }
});

// @ts-expect-error Only light and dark schemes belong in the format.
const invalidScheme: Theme["colorScheme"] = "sepia";
// @ts-expect-error A colour has exactly three components.
const invalidComponents: Theme["colours"][string]["components"] = [0, 1];
void [invalidScheme, invalidComponents];
