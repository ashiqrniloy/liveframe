import { expect, test } from "bun:test";
import { designSystemCss } from "../css/index.ts";
import {
  type Catalog,
  classifyCatalogChange,
  type DesignSystem,
  resolveRecipes,
  validateCatalog,
  validateDesignSystem,
} from "../index.ts";

const catalog: Catalog = {
  format: "liveframe-catalog/1",
  catalogId: "extensions@1",
  description: "Extension properties",
  vocabulary: {
    colourRoles: ["ink", "focus", "accent"],
    typographyRoles: ["body"],
    surfaceTypography: "body",
    surfaceRoles: [],
    fillableRoles: [],
    tones: {},
    space: ["space.1"],
    radius: [],
    size: [],
    breakpoints: [],
    extensions: {
      sheen: { type: "colour", description: "Highlight along the top edge." },
      notch: { type: "value", kind: "size" },
      glow: { type: "value", kind: "opacity" },
      flash: { type: "value", kind: "motion-duration" },
    },
  },
  definitions: [
    {
      kind: "button",
      description: "Test",
      variants: ["default", "primary"],
      defaultVariant: "default",
      slots: ["root", "label"],
      props: { type: "object", properties: {}, required: [], additionalProperties: false },
      children: "none",
      events: { onPress: { carries: "none", description: "Press" } },
      styleProps: [],
      a11y: { role: "button" },
    },
  ],
};
const base: DesignSystem = {
  format: "liveframe-design-system/1",
  id: "ext",
  version: "1",
  values: {
    "space.1": { kind: "spacing", value: { value: 4, unit: "px" } },
    "size.notch": { kind: "size", value: { value: 6, unit: "px" } },
    "opacity.glow": { kind: "opacity", value: 0.35 },
  },
  recipes: {
    "button.*.root.rest": { padding: "space.1" },
    "button.*.label.rest": { textColor: "ink" },
    "button.*.root.focus": { outlineColor: "focus" },
  },
};
const context = { catalog, registry: {} };
const withRecipes = (recipes: Record<string, unknown>, id = "ext"): DesignSystem =>
  ({ ...base, id, recipes: { ...base.recipes, ...recipes } }) as DesignSystem;
const rest = (extensions: unknown, key = "button.*.root.rest") =>
  withRecipes({ [key]: { padding: "space.1", extensions } });
const pointer = (name: string, key = "button.*.root.rest") => `/recipes/${key}/extensions/${name}`;

/** The failure sits at `at` or below it (a literal's own field). */
function rejects(doc: unknown, kind: string, at: string) {
  const result = validateDesignSystem(doc, context);
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(
      result.errors.some(
        (error) => error.kind === kind && (error.pointer === at || error.pointer.startsWith(`${at}/`)),
      ),
    ).toBe(true);
}
function sheet(system: DesignSystem, input = catalog, registry: Record<string, DesignSystem> = {}): string {
  const result = designSystemCss(system, { catalog: input, registry });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

test("extension_unknown_name_rejected", () => {
  rejects(rest({ sparkle: "ink" }), "unknown-name", pointer("sparkle"));
  rejects(rest({ constructor: "ink" }), "unknown-name", pointer("constructor"));
});

test("extension_name_cannot_inject_css", () => {
  for (const name of ["a;b", "a}b", "a/b", "a b", "A", "a_b", "a.b", "1a"]) {
    const result = validateDesignSystem(rest({ [name]: "ink" }), context);
    expect(result.ok).toBe(false);
  }
});

test("extension_colour_literal_rejected", () => {
  rejects(rest({ sheen: "ghost" }), "colour-outside-theme", pointer("sheen"));
  rejects(rest({ sheen: "#ffffff" }), "colour-outside-theme", pointer("sheen"));
  rejects(rest({ sheen: "red; background: url(x)" }), "colour-outside-theme", pointer("sheen"));
  // The alpha modifier is not offered for extensions.
  rejects(rest({ sheen: { role: "ink", alpha: 0.5 } }), "invalid-document", pointer("sheen"));
  rejects(rest({ sheen: { value: 4, unit: "px" } }), "invalid-document", pointer("sheen"));
  expect(validateDesignSystem(rest({ sheen: "none" }), context).ok).toBe(true);
});

test("extension_value_wrong_type_rejected", () => {
  rejects(rest({ notch: "opacity.glow" }), "unknown-name", pointer("notch"));
  rejects(rest({ notch: "missing" }), "unknown-name", pointer("notch"));
  rejects(rest({ notch: "ink" }), "unknown-name", pointer("notch"));
  rejects(rest({ glow: 5 }), "invalid-document", pointer("glow"));
  rejects(rest({ notch: { value: 4, unit: "em" } }), "invalid-document", pointer("notch"));
  rejects(rest({ notch: 4 }), "invalid-document", pointer("notch"));
  expect(
    validateDesignSystem(rest({ notch: "size.notch", glow: 0.5, flash: { value: 140, unit: "ms" } }), context).ok,
  ).toBe(true);
});

test("extension_checked_in_inherited_recipes", () => {
  const parent = {
    ...withRecipes({ "button.*.root.rest": { padding: "space.1", extensions: { notch: "size.notch" } } }),
  };
  const child: DesignSystem = { ...base, id: "child", extends: "ext", values: {}, recipes: {} };
  expect(validateDesignSystem(child, { catalog, registry: { ext: parent } }).ok).toBe(true);
  const broken = withRecipes({ "button.*.root.rest": { padding: "space.1", extensions: { notch: "opacity.glow" } } });
  const result = validateDesignSystem(child, { catalog, registry: { ext: broken } });
  expect(result.ok).toBe(false);
});

test("extension_projects_lf_p_variable", () => {
  const css = sheet(
    withRecipes({
      "button.*.root.rest": {
        padding: "space.1",
        extensions: { sheen: "accent", notch: "size.notch", glow: 0.35, flash: { value: 140, unit: "ms" } },
      },
    }),
  );
  // After the fixed declarations, sorted by name.
  expect(css).toContain(
    "{padding:4px;--lf-p-flash:140ms;--lf-p-glow:0.35;--lf-p-notch:6px;--lf-p-sheen:var(--lf-c-accent)}",
  );
  expect(sheet(rest({ sheen: "none" }))).toContain("--lf-p-sheen:transparent");
});

test("extension_cascades_by_name", () => {
  const system = withRecipes({
    "button.*.root.rest": { padding: "space.1", extensions: { sheen: "ink", glow: 0.1 } },
    "button.primary.root.rest": { extensions: { notch: "size.notch", glow: 0.9 } },
    "button.*.root.hover": { extensions: { sheen: "focus" } },
  });
  const resolved = resolveRecipes(system, context);
  // A variant adds a name without erasing the wildcard's others, and wins on a shared name.
  expect(resolved["button.default.root.rest"]?.extensions).toEqual({ glow: 0.1, sheen: "ink" });
  expect(resolved["button.primary.root.rest"]?.extensions).toEqual({
    glow: 0.9,
    notch: { value: 6, unit: "px" },
    sheen: "ink",
  });
  // A state layer overrides one name and keeps the rest layer's others.
  expect(resolved["button.primary.root.hover"]?.extensions).toEqual({
    glow: 0.9,
    notch: { value: 6, unit: "px" },
    sheen: "focus",
  });
  const css = sheet(system);
  expect(css).toContain("[data-hovered]");
  expect(css).toMatch(/\[data-hovered\][^{]*\{[^}]*--lf-p-sheen:var\(--lf-c-focus\)/);
});

test("extension_extends_merges_by_name", () => {
  const parent = withRecipes(
    { "button.*.root.rest": { padding: "space.1", extensions: { sheen: "ink", glow: 0.2 } } },
    "parent",
  );
  const child: DesignSystem = {
    ...base,
    id: "child",
    extends: "parent",
    values: {},
    recipes: { "button.*.root.rest": { extensions: { glow: 0.4, notch: "size.notch" } } },
  };
  const registry = { parent };
  const resolved = resolveRecipes(child, { catalog, registry });
  expect(resolved["button.default.root.rest"]?.extensions).toEqual({
    glow: 0.4,
    notch: { value: 6, unit: "px" },
    sheen: "ink",
  });
});

test("no_extensions_byte_identical_css", () => {
  const { extensions: _, ...vocabulary } = catalog.vocabulary;
  const plain: Catalog = { ...catalog, vocabulary };
  // Declaring extensions changes nothing until a recipe sets one.
  expect(sheet(base, catalog)).toBe(sheet(base, plain));
  expect(sheet(base)).not.toContain("--lf-p-");
  const resolved = resolveRecipes(base, context);
  for (const recipe of Object.values(resolved)) expect(recipe).not.toHaveProperty("extensions");
});

test("extension_recovers_under_reduced_transparency", () => {
  const css = sheet(
    withRecipes({
      "button.*.root.rest": {
        padding: "space.1",
        backgroundColor: { role: "ink", alpha: 0.5 },
        extensions: { sheen: "accent" },
      },
    }),
  );
  const [normal, tail] = css.split("@media (prefers-reduced-transparency:reduce){");
  const reduced = tail?.split("@media (forced-colors:active){")[0] ?? "";
  // The reduced sheet recolours the alpha paint only; the variable is declared once, by the normal rule,
  // so it holds the same value under reduced transparency.
  expect(reduced).toContain("background-color:var(--lf-c-ink)");
  expect(reduced).not.toContain("--lf-p-");
  expect(normal).toContain("--lf-p-sheen:var(--lf-c-accent)");
});

test("catalog_change_classifies_extensions", () => {
  const checked = validateCatalog(catalog);
  if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
  const without = (name: string): Catalog => {
    const { [name]: _, ...extensions } = catalog.vocabulary.extensions ?? {};
    return { ...catalog, vocabulary: { ...catalog.vocabulary, extensions } };
  };
  const changed = (name: string, extension: { type: "colour" | "value"; kind?: "size" }): Catalog => ({
    ...catalog,
    vocabulary: { ...catalog.vocabulary, extensions: { ...catalog.vocabulary.extensions, [name]: extension } },
  });
  expect(classifyCatalogChange(without("glow"), catalog).level).toBe("minor");
  expect(classifyCatalogChange(catalog, without("glow")).level).toBe("major");
  expect(classifyCatalogChange(catalog, changed("notch", { type: "value", kind: "size" })).level).toBe("none");
  expect(classifyCatalogChange(catalog, changed("notch", { type: "colour" })).level).toBe("major");
  expect(classifyCatalogChange(catalog, changed("sheen", { type: "colour" })).level).toBe("none");
  const { extensions: _, ...vocabulary } = catalog.vocabulary;
  expect(classifyCatalogChange({ ...catalog, vocabulary }, catalog).level).toBe("minor");
});

test("vocabulary_extensions_are_closed", () => {
  const withExtensions = (extensions: unknown) =>
    validateCatalog({ ...catalog, vocabulary: { ...catalog.vocabulary, extensions } });
  expect(withExtensions({ a: { type: "colour" } }).ok).toBe(true);
  for (const bad of [
    { a: { type: "value" } },
    { a: { type: "colour", kind: "size" } },
    { a: { type: "value", kind: "easing" } },
    { a: { type: "value", kind: "shadow" } },
    { a: { type: "string" } },
    { "a;b": { type: "colour" } },
    { a_b: { type: "colour" } },
    { A: { type: "colour" }, "0": { type: "colour" } },
    Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`e${i}`, { type: "colour" }])),
  ])
    expect(withExtensions(bad).ok).toBe(false);
  expect(
    withExtensions(Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`e${i}`, { type: "colour" }]))).ok,
  ).toBe(true);
});
