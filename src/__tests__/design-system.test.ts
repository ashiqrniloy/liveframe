import { designSystemSchema } from "../formats/design-system.ts";
import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { schemaDocument } from "../formats/registry.ts";
import { type Catalog, type DesignSystem, obj, validateDesignSystem } from "../index.ts";

export const catalog: Catalog = {
  format: "liveframe-catalog/1",
  catalogId: "test@1",
  description: "Test",
  vocabulary: {
    colourRoles: ["ink", "focus"],
    typographyRoles: ["body"],
    surfaceTypography: "body",
    surfaceRoles: [],
    fillableRoles: [],
    tones: {},
    space: ["space.1"],
    radius: [],
    size: [],
    breakpoints: [],
  },
  definitions: [
    {
      kind: "button",
      description: "Test",
      variants: ["default", "primary"],
      defaultVariant: "default",
      slots: ["root", "label"],
      props: obj({}),
      children: "none",
      events: { onPress: { carries: "none", description: "Press" } },
      styleProps: [],
      a11y: { role: "button" },
    },
  ],
};
export const system: DesignSystem = {
  format: "liveframe-design-system/1",
  id: "test",
  version: "1",
  values: { "space.1": { kind: "spacing", value: { value: 4, unit: "px" } } },
  recipes: {
    "button.*.root.rest": { padding: "space.1" },
    "button.*.label.rest": { textColor: "ink" },
    "button.*.root.focus": { outlineColor: "focus" },
  },
};
export const context = { catalog, registry: {} };
function rejects(doc: unknown, kind: string, pointer?: string) {
  const result = validateDesignSystem(doc, context);
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ kind, ...(pointer === undefined ? {} : { pointer }) }),
    );
}
const recipe = (properties: unknown) => ({
  ...system,
  recipes: { ...system.recipes, "button.*.root.rest": properties },
});

test("alpha_modifier_validates", () => {
  const validate = new Ajv2020({ strict: true, multipleOfPrecision: 8 }).compile(schemaDocument("design-system"));
  for (const alpha of [0, 1, 0.1234, "opacity.subtle"]) {
    const doc = {
      ...recipe({ backgroundColor: { role: "ink", alpha } }),
      values: { ...system.values, "opacity.subtle": { kind: "opacity", value: 0.1234 } },
    };
    expect(validateDesignSystem(doc, context).ok).toBe(true);
    expect(validate(doc)).toBe(true);
  }
  for (const value of [
    { role: "ink", alpha: -0.1 },
    { role: "ink", alpha: 1.1 },
    { role: "ink", alpha: 0.12345 },
    { role: "ink", alpha: Infinity },
    { role: "ink", alpha: "missing" },
    { role: "ink", alpha: "space.1" },
    { role: "none", alpha: 1 },
    { role: "#fff", alpha: 1 },
    { role: "ink", alpha: 1, extra: true },
    { role: "ink" },
  ])
    expect(validateDesignSystem(recipe({ borderColor: value }), context).ok).toBe(false);
  expect(validateDesignSystem(recipe({ padding: { role: "ink", alpha: 1 } }), context).ok).toBe(false);
  const doc = {
    ...recipe({ textColor: { role: "ink", alpha: "opacity.fine" } }),
    values: { ...system.values, "opacity.fine": { kind: "opacity", value: 0.12345 } },
  };
  expect(validateDesignSystem(doc, context).ok).toBe(false);
  expect(validateDesignSystem({ ...doc, recipes: system.recipes }, context).ok).toBe(true);
});

test("alpha_modifiers_cover_every_colour_and_shadow_layer", () => {
  const validate = new Ajv2020({ strict: true, multipleOfPrecision: 8 }).compile(schemaDocument("design-system"));
  const px = { value: 1, unit: "px" };
  const layer = (color: unknown) => ({ color, offsetX: px, offsetY: px, blur: px, spread: px });
  for (const alpha of [0, 0.0001, 0.57, 0.9999, 1, "opacity.subtle"]) {
    const color = { role: "ink", alpha };
    for (const properties of [
      { backgroundColor: color, textColor: color, borderColor: color, outlineColor: color },
      { shadow: layer(color) },
      { shadow: [layer(color)] },
      { shadow: "shadow.soft" },
    ]) {
      const doc = {
        ...recipe(properties),
        values: {
          ...system.values,
          "opacity.subtle": { kind: "opacity", value: 0.57 },
          "shadow.soft": { kind: "shadow", value: [layer(color)] },
        },
      };
      expect(validateDesignSystem(doc, context).ok).toBe(true);
      expect(validate(doc)).toBe(true);
    }
  }
  for (const alpha of ["missing", "space.1", -1, 2, 0.12345]) {
    const color = { role: "ink", alpha };
    expect(validateDesignSystem(recipe({ shadow: [layer(color)] }), context).ok).toBe(false);
    expect(
      validateDesignSystem(
        { ...system, values: { ...system.values, "shadow.soft": { kind: "shadow", value: layer(color) } } },
        context,
      ).ok,
    ).toBe(false);
  }
  rejects(
    recipe({ outlineColor: { role: "ink", alpha: "missing" } }),
    "unknown-name",
    "/recipes/button.*.root.rest/outlineColor/alpha",
  );
});

test("colour_only_from_theme_roles", () => {
  for (const colour of ["#fff", "rgb(0 0 0)", "missing", { colorSpace: "srgb", components: [0, 0, 0] }]) {
    rejects(recipe({ backgroundColor: colour }), "colour-outside-theme", "/recipes/button.*.root.rest/backgroundColor");
    const layer = {
      color: colour,
      offsetX: { value: 0, unit: "px" },
      offsetY: { value: 1, unit: "px" },
      blur: { value: 2, unit: "px" },
      spread: { value: 0, unit: "px" },
    };
    rejects(recipe({ shadow: [layer] }), "colour-outside-theme");
    rejects(
      { ...system, values: { ...system.values, shadow: { kind: "shadow", value: layer } } },
      "colour-outside-theme",
    );
  }
});
test("completeness_after_cascade", () => {
  expect(validateDesignSystem(system, context)).toEqual({ ok: true, value: system });
  const { "button.*.label.rest": _, ...rest } = system.recipes;
  rejects({ ...system, recipes: rest }, "incomplete-design-system", "/recipes/button.default.label.rest");
  const { "button.*.root.focus": __, ...focus } = system.recipes;
  rejects({ ...system, recipes: focus }, "incomplete-design-system", "/recipes/button.default.root.focus");
});
test("extends_cycles_rejected", () => {
  const a = { ...system, id: "a", extends: "b" };
  const b = { ...system, id: "b", extends: "a" };
  const result = validateDesignSystem(a, { catalog, registry: { a, b } });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.some((e) => e.kind === "cyclic-extends")).toBe(true);
  rejects({ ...system, extends: "missing" }, "unknown-name", "/extends");
});
test("references_match_value_kinds", () => {
  rejects(recipe({ borderRadius: "space.1" }), "unknown-name");
  rejects(recipe({ padding: "missing" }), "unknown-name");
  rejects(recipe({ typography: "missing" }), "unknown-name");
  rejects({ ...system, values: {} }, "unknown-name", "/values/space.1");
});
test("recipe_keys_and_properties_are_closed", () => {
  for (const key of ["missing.*.root.rest", "button.no.root.rest", "button.*.no.rest", "button.*.root.no"])
    rejects({ ...system, recipes: { ...system.recipes, [key]: {} } }, "unknown-name");
  for (const properties of [
    { display: "flex" },
    { padding: "1px" },
    { borderStyle: "url(x)" },
    { transitionTiming: [2, 1, 0, 1] },
    { translateY: { value: Infinity, unit: "px" } },
  ])
    expect(validateDesignSystem(recipe(properties), context).ok).toBe(false);
});
test("design_system_structure_agrees_with_schema", () => {
  const validate = new Ajv2020({ strict: true, multipleOfPrecision: 8 }).compile(schemaDocument("design-system"));
  for (const doc of [
    system,
    null,
    {},
    { ...system, extra: true },
    { ...system, values: [] },
    recipe({ display: "flex" }),
    recipe({ padding: { value: 4, unit: "em" } }),
    recipe({ opacity: 2 }),
    recipe({ transitionTiming: [0, 2, 1, -2] }),
    recipe({ borderRadius: { value: 9999, unit: "px" } }),
  ])
    expect(validate(doc)).toBe(validateDesignSystem(doc, context).ok);
});
test("design_system_errors_are_bounded_and_escaped", () => {
  rejects({ ...system, values: { "bad/~": {} } }, "invalid-document", "/values/bad~1~0");
  rejects(
    { ...system, recipes: { ...system.recipes, "button.primary.root.rest": { padding: "constructor" } } },
    "unknown-name",
  );
  const result = validateDesignSystem(
    { ...system, recipes: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`unknown${i}.*.root.rest`, {}])) },
    context,
  );
  if (result.ok) throw Error("Expected errors");
  expect(result.errors).toHaveLength(20);
});
// @ts-expect-error Structural properties belong to widgets.
const invalidRecipe: DesignSystem["recipes"][string] = { display: "flex" };
// @ts-expect-error States are fixed.
const invalidKey: keyof DesignSystem["recipes"] = "button.*.root.clicked";
void [invalidRecipe, invalidKey];

test("design_values_and_literals_are_typed_and_bounded", () => {
  const px = { value: 1, unit: "px" };
  for (const [kind, good, bad] of [
    ["radius", { value: 9999, unit: "px" }, { value: -1, unit: "px" }],
    ["border-width", px, { ...px, unit: "em" }],
    ["spacing", px, { ...px, value: 16385 }],
    ["size", px, { ...px, extra: 1 }],
    ["breakpoint", px, "100px"],
    ["backdrop-blur", px, { ...px, value: NaN }],
    ["motion-duration", { value: 0.14, unit: "s" }, { value: -1, unit: "ms" }],
    ["easing", [0.16, 1, 0.3, 1], [0.16, 1, 0.3]],
    ["opacity", 0.5, 1.1],
    ["saturation", 1.2, 11],
    [
      "shadow",
      { color: "ink", offsetX: px, offsetY: px, blur: px, spread: { value: -1, unit: "px" } },
      { color: "ink", offsetX: px },
    ],
  ] as const) {
    const change = (value: unknown) => ({ ...system, values: { ...system.values, token: { kind, value } } });
    expect(validateDesignSystem(change(good), context).ok).toBe(true);
    expect(validateDesignSystem(change(bad), context).ok).toBe(false);
  }
  expect(
    validateDesignSystem(
      recipe({ translateY: { value: -1, unit: "px" }, outlineOffset: { value: -1, unit: "rem" } }),
      context,
    ).ok,
  ).toBe(true);
  for (const doc of [
    undefined,
    {
      ...system,
      values: Object.fromEntries(
        Array.from({ length: 1025 }, (_, i) => [`token${i}`, { kind: "opacity", value: 0.5 }]),
      ),
    },
    { ...system, values: { ...system.values, token: { kind: "colour", value: "ink" } } },
  ])
    expect(validateDesignSystem(doc, context).ok).toBe(false);
});

test("rack_validates_and_resolves_under_50ms", async () => {
  const { resolveRecipes } = await import("../index.ts");
  const doc = await Bun.file(new URL("./fixtures/rack.design-system.json", import.meta.url)).json();
  const proofCatalog = await Bun.file(new URL("./fixtures/catalog.json", import.meta.url)).json();
  proofCatalog.vocabulary = await Bun.file(
    new URL("./fixtures/rack.design-system-vocabulary.json", import.meta.url),
  ).json();
  const options = { catalog: proofCatalog, registry: {} };
  expect(proofCatalog.vocabulary.colourRoles.some((role: string) => role.includes(".alpha-"))).toBe(false);
  expect(JSON.stringify(doc)).not.toContain(".alpha-");
  expect(Object.keys(doc.recipes)).toHaveLength(616);
  expect(validateDesignSystem(doc, options).ok).toBe(true);
  expect(new Ajv2020({ strict: true, multipleOfPrecision: 8 }).compile(schemaDocument("design-system"))(doc)).toBe(
    true,
  );
  const table = resolveRecipes(doc, options);
  expect(Object.keys(table)).toHaveLength(616);
  expect(table["button.default.root.rest"]?.transitionTiming).toEqual([0.16, 1, 0.3, 1]);
  expect(table["button.default.root.rest"]?.gap).toEqual({ value: 8, unit: "px" });
  for (let i = 0; i < 5; i++) {
    validateDesignSystem(doc, options);
    resolveRecipes(doc, options);
  }
  const start = performance.now();
  for (let i = 0; i < 20; i++) {
    validateDesignSystem(doc, options);
    resolveRecipes(doc, options);
  }
  expect((performance.now() - start) / 20).toBeLessThan(50);
});

test("recipe_schema_uses_the_fixed_property_vocabulary", async () => {
  const { recipeProperties } = await import("../index.ts");
  const entry = Object.values(designSystemSchema.properties.recipes.patternProperties)[0];
  expect(Object.keys(entry!.properties).sort()).toEqual([...recipeProperties].sort());
});

test("inheritance_and_completeness_fail_closed", () => {
  const child = { ...system, id: "child", extends: "test", values: {}, recipes: {} };
  expect(validateDesignSystem(child, { catalog, registry: { test: system } }).ok).toBe(true);
  for (const parent of [{ ...system, id: "wrong" }, { ...system, format: "wrong" }, null]) {
    const result = validateDesignSystem(child, { catalog, registry: { test: parent } } as unknown as Parameters<
      typeof validateDesignSystem
    >[1]);
    expect(result.ok).toBe(false);
  }
  rejects({ ...system, extends: "constructor" }, "unknown-name", "/extends");
  const result = validateDesignSystem(
    { ...system, recipes: {} },
    {
      catalog: {
        ...catalog,
        definitions: [{ ...catalog.definitions[0]!, variants: Array.from({ length: 12 }, (_, i) => `variant${i}`) }],
      },
      registry: {},
    },
  );
  if (result.ok) throw Error("Expected gaps");
  expect(result.errors).toHaveLength(20);
  expect(result.errors.every((error) => error.kind === "incomplete-design-system")).toBe(true);
});

test("none_accepted_on_colour_properties_only", () => {
  const schema = new Ajv2020({ strict: true, multipleOfPrecision: 8 }).compile(schemaDocument("design-system"));
  for (const property of ["backgroundColor", "borderColor", "outlineColor"]) {
    const doc = recipe({ [property]: "none" });
    expect(validateDesignSystem(doc, context).ok).toBe(true);
    expect(schema(doc)).toBe(true);
  }
  for (const property of ["textColor", "typography", "padding", "opacity", "shadow"]) {
    const result = validateDesignSystem(recipe({ [property]: "none" }), context);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ pointer: `/recipes/button.*.root.rest/${property}` }),
      );
  }
  // Existing line-style keywords remain valid.
  expect(validateDesignSystem(recipe({ borderStyle: "none", outlineStyle: "none" }), context).ok).toBe(true);
});

const nativeParts = ["placeholderColor", "scrollbarThumbColor", "scrollbarTrackColor"] as const;

test("native_part_properties_validate", () => {
  const validate = new Ajv2020({ strict: true, multipleOfPrecision: 8 }).compile(schemaDocument("design-system"));
  const values = { ...system.values, "opacity.subtle": { kind: "opacity", value: 0.25 } };
  for (const property of nativeParts)
    for (const value of ["ink", "none", { role: "ink", alpha: 0.5 }, { role: "ink", alpha: "opacity.subtle" }]) {
      const doc = {
        ...recipe(
          property === "placeholderColor"
            ? { [property]: value }
            : { scrollbarThumbColor: "ink", [property]: value, scrollbarTrackColor: "none" },
        ),
        values,
      };
      expect(validateDesignSystem(doc, context).ok).toBe(true);
      expect(validate(doc)).toBe(true);
    }
  for (const property of nativeParts)
    for (const [value, structural] of [
      ["#fff", true],
      ["red", false],
      [{ role: "none", alpha: 1 }, false],
      [{ role: "ink", alpha: 2 }, true],
      [7, true],
    ] as const) {
      const doc = recipe({ [property]: value });
      expect(validateDesignSystem(doc, context).ok).toBe(false);
      // The JSON Schema sees structure only; the vocabulary decides which role names exist.
      if (structural) expect(validate(doc)).toBe(false);
    }
  rejects(recipe({ placeholderColor: "red" }), "colour-outside-theme", "/recipes/button.*.root.rest/placeholderColor");
});

test("scrollbar_rejects_nonrest_declarations_and_incomplete_pairs", () => {
  const pair = { scrollbarThumbColor: "ink", scrollbarTrackColor: "none" };
  expect(validateDesignSystem(recipe(pair), context).ok).toBe(true);
  // Inheriting the rest pair into every state is valid; declaring it in a state is not.
  for (const state of ["hover", "active", "focus", "disabled", "selected", "invalid", "open"] as const)
    for (const property of ["scrollbarThumbColor", "scrollbarTrackColor"] as const) {
      const doc = {
        ...recipe(pair),
        recipes: { ...recipe(pair).recipes, [`button.*.root.${state}`]: { [property]: "ink" } },
      };
      const result = validateDesignSystem(doc, context);
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            pointer: `/recipes/button.*.root.${state}/${property}`,
            message: expect.stringContaining(property),
          }),
        );
    }
  // Placeholder colour honours every state.
  const placeholder = {
    ...system,
    recipes: { ...system.recipes, "button.*.root.hover": { placeholderColor: "ink" } },
  };
  expect(validateDesignSystem(placeholder, context).ok).toBe(true);
  for (const lone of [{ scrollbarThumbColor: "ink" }, { scrollbarTrackColor: "ink" }])
    rejects(recipe(lone), "incomplete-design-system", "/recipes/button.default.root.rest");
  // A pair is checked after the rest layers of the cascade merge.
  expect(
    validateDesignSystem(
      {
        ...system,
        recipes: {
          ...system.recipes,
          "button.*.root.rest": { scrollbarThumbColor: "ink" },
          "button.primary.root.rest": { scrollbarTrackColor: "none" },
        },
      },
      context,
    ).ok,
  ).toBe(false);
  expect(
    validateDesignSystem(
      {
        ...system,
        recipes: {
          ...system.recipes,
          "button.*.root.rest": { scrollbarThumbColor: "ink", scrollbarTrackColor: "none" },
          "button.primary.root.rest": { scrollbarTrackColor: "ink" },
        },
      },
      context,
    ).ok,
  ).toBe(true);
});
