import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { designSystemCss, slotClass } from "../css/index.ts";
import {
  auditContrast,
  type Catalog,
  classifyCatalogChange,
  compileValidator,
  type Definition,
  type DesignSystem,
  resolveRecipes,
  type Theme,
  validateCatalog,
  validateDesignSystem,
} from "../index.ts";
import { createRenderer, implement } from "../react/index.ts";
import manifest from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };
import capabilities from "./fixtures/proof/capabilities.json" with { type: "json" };
import proofCatalog from "./fixtures/proof/catalog.json" with { type: "json" };

const tone = { type: "string", maxLength: 12, enum: ["neutral", "critical"] } as const;
const size = { type: "string", maxLength: 12, enum: ["small", "large"] } as const;
const roles = [
  "ink",
  "focus",
  "paper",
  "accent.fill",
  "accent.on-fill",
  "accent.text",
  "accented.fill",
  "status.neutral.fill",
  "status.neutral.on-fill",
  "status.neutral.text",
  "status.critical.fill",
  "status.critical.on-fill",
  "status.critical.text",
  "shadow.ambient",
  "shadow.critical",
];
const spaces = ["space.1", "space.2", "space.3", "space.4", "space.5", "space.6"];
const extensions = { sheen: { type: "colour" }, notch: { type: "value", kind: "size" } } as const;

type Axes = Record<string, { default: string }>;
function catalogWith(axes: Axes | undefined, props: Record<string, unknown> = { tone, size }): Catalog {
  return {
    format: "liveframe-catalog/1",
    catalogId: "axes@1",
    description: "Variant axes",
    vocabulary: {
      colourRoles: roles,
      typographyRoles: ["body"],
      surfaceTypography: "body",
      surfaceRoles: ["paper"],
      fillableRoles: [],
      tones: {},
      space: spaces,
      radius: [],
      size: ["size.notch"],
      breakpoints: [],
      extensions,
    },
    definitions: [
      {
        kind: "button",
        description: "Test",
        variants: ["primary", "ghost"],
        defaultVariant: "primary",
        slots: ["root", "label"],
        props: {
          type: "object",
          properties: { label: { type: "string", maxLength: 80 }, ...props },
          required: ["label"],
          additionalProperties: false,
        },
        children: "none",
        events: { onPress: { carries: "none", description: "Press" } },
        styleProps: [],
        a11y: { role: "button", name: "label" },
        ...(axes ? { axes } : {}),
      },
    ],
  } as Catalog;
}
const oneAxis = catalogWith({ tone: { default: "neutral" } }, { tone });
const twoAxes = catalogWith({ tone: { default: "neutral" }, size: { default: "small" } });
const values = {
  ...Object.fromEntries(
    spaces.map((name, i) => [name, { kind: "spacing", value: { value: 4 * (i + 1), unit: "px" } }]),
  ),
  "size.notch": { kind: "size", value: { value: 6, unit: "px" } },
  "opacity.half": { kind: "opacity", value: 0.5 },
  "shadow.ring": {
    kind: "shadow",
    value: {
      color: "accent.fill",
      offsetX: { value: 0, unit: "px" },
      offsetY: { value: 1, unit: "px" },
      blur: { value: 2, unit: "px" },
      spread: { value: 0, unit: "px" },
    },
  },
};
const base = {
  "button.*.root.rest": { padding: "space.1" },
  "button.*.label.rest": { textColor: "ink" },
  "button.*.root.focus": { outlineColor: "focus" },
} as const;
const emphasis = {
  "button.primary.root.rest": { backgroundColor: "accent.fill", textColor: "accent.on-fill" },
  "button.ghost.root.rest": { backgroundColor: "none", textColor: "accent.text" },
} as const;
const system = (recipes: Record<string, unknown>, id = "axes", extra: Partial<DesignSystem> = {}): DesignSystem =>
  ({
    format: "liveframe-design-system/1",
    id,
    version: "1",
    values,
    recipes: { ...base, ...recipes },
    ...extra,
  }) as DesignSystem;
const toneAliases = {
  "button.tone:neutral.root.rest": { roles: { accent: "status.neutral" } },
  "button.tone:critical.root.rest": { roles: { accent: "status.critical" } },
};
const options = (catalog: Catalog, registry: Record<string, DesignSystem> = {}) => ({ catalog, registry });
const pointerOf = (key: string, from: string) => `/recipes/${key}/roles/${from}`;

function failure(result: ReturnType<typeof validateDesignSystem | typeof validateCatalog>, kind: string, at: string) {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.some((e) => e.kind === kind && e.pointer === at)).toBe(true);
}
function resolved(recipes: Record<string, unknown>, catalog = oneAxis) {
  return resolveRecipes(system(recipes), options(catalog));
}

test("axis_must_name_enum_prop", () => {
  failure(validateCatalog(catalogWith({ label: { default: "x" } })), "unknown-name", "/definitions/0/axes/label");
  failure(validateCatalog(catalogWith({ missing: { default: "x" } })), "unknown-name", "/definitions/0/axes/missing");
  expect(validateCatalog(oneAxis).ok).toBe(true);
});

test("axis_default_in_enum", () => {
  failure(
    validateCatalog(catalogWith({ tone: { default: "loud" } })),
    "invalid-document",
    "/definitions/0/axes/tone/default",
  );
});

test("axis_value_must_be_a_name", () => {
  const bad = catalogWith({ tone: { default: "Dark mode" } }, { tone: { ...tone, enum: ["Dark mode"] } });
  failure(validateCatalog(bad), "invalid-document", "/definitions/0/props/properties/tone/enum");
});

test("axis_combination_limit", () => {
  const many = (count: number) => ({
    type: "string",
    maxLength: 12,
    enum: Array.from({ length: count }, (_, i) => `v${i}`),
  });
  // 17 values on one axis.
  failure(
    validateCatalog(catalogWith({ tone: { default: "v0" } }, { tone: many(17) })),
    "invalid-document",
    "/definitions/0/axes/tone",
  );
  // 2 variants × 12 × 11 = 264 combinations.
  failure(
    validateCatalog(
      catalogWith({ tone: { default: "v0" }, size: { default: "v0" } }, { tone: many(12), size: many(11) }),
    ),
    "invalid-document",
    "/definitions/0/axes",
  );
  // 2 × 16 × 8 = 256 is the limit and holds.
  expect(
    validateCatalog(
      catalogWith({ tone: { default: "v0" }, size: { default: "v0" } }, { tone: many(16), size: many(8) }),
    ).ok,
  ).toBe(true);
  // At most three axes.
  const four = Object.fromEntries(["a", "b", "c", "d"].map((name) => [name, { default: "v0" }]));
  const props = Object.fromEntries(["a", "b", "c", "d"].map((name) => [name, many(2)]));
  expect(validateCatalog(catalogWith(four, props)).ok).toBe(false);
});

test("axis_combinations_are_bounded_across_the_catalog", () => {
  const many = (count: number) => ({
    type: "string",
    maxLength: 12,
    enum: Array.from({ length: count }, (_, i) => `v${i}`),
  });
  const axes = { tone: { default: "v0" }, size: { default: "v0" } };
  const base = catalogWith(axes, { tone: many(16), size: many(8) });
  const [first] = base.definitions;
  if (!first) throw new Error("fixture has a definition");
  const kinds = (count: number): Catalog => ({
    ...base,
    definitions: Array.from({ length: count }, (_, i) => ({ ...first, kind: `kind${i}` })),
  });
  // Two kinds at the per-kind limit (2 x 256 = 512) hold; a third passes the total.
  expect(validateCatalog(kinds(2)).ok).toBe(true);
  failure(validateCatalog(kinds(3)), "invalid-document", "/definitions");
  // A kind without axes adds nothing, however many variants it has.
  const { axes: _axes, ...rest } = first;
  const plain: Definition = { ...rest, kind: "plain" };
  expect(validateCatalog({ ...base, definitions: [...kinds(2).definitions, plain] }).ok).toBe(true);
});

test("recipe_keys_name_declared_axes_and_values", () => {
  const options_ = options(oneAxis);
  for (const key of ["button.tone:loud.root.rest", "button.mood:critical.root.rest", "button.tone.root.rest"])
    expect(validateDesignSystem(system({ [key]: { padding: "space.1" } }), options_).ok).toBe(false);
  failure(
    validateDesignSystem(system({ "button.tone:loud.root.rest": { padding: "space.1" } }), options_),
    "unknown-name",
    "/recipes/button.tone:loud.root.rest",
  );
  // A kind without axes has none to name.
  failure(
    validateDesignSystem(
      system({ "button.tone:critical.root.rest": { padding: "space.1" } }),
      options(catalogWith(undefined, { tone })),
    ),
    "unknown-name",
    "/recipes/button.tone:critical.root.rest",
  );
});

test("tone_by_emphasis_four_pairs", () => {
  const table = resolved({ ...emphasis, ...toneAliases });
  const pair = (key: string) => [
    table[`button.${key}.root.rest` as never]?.backgroundColor,
    table[`button.${key}.root.rest` as never]?.textColor,
  ];
  expect(pair("primary__neutral")).toEqual(["status.neutral.fill", "status.neutral.on-fill"]);
  expect(pair("primary__critical")).toEqual(["status.critical.fill", "status.critical.on-fill"]);
  expect(pair("ghost__neutral")).toEqual(["none", "status.neutral.text"]);
  expect(pair("ghost__critical")).toEqual(["none", "status.critical.text"]);
  // The projection has one rule set per combination.
  const css = designSystemCss(system({ ...emphasis, ...toneAliases }), options(oneAxis));
  expect(css.ok).toBe(true);
  if (css.ok)
    for (const variant of ["primary", "ghost"])
      for (const value of ["neutral", "critical"])
        expect(css.value).toContain(`.${slotClass("button", variant, "root", [value])}{`);
});

test("axis_overlay_cascade_order", () => {
  const padding = (recipes: Record<string, unknown>, key: string) =>
    (
      resolveRecipes(system(recipes), options(twoAxes))[`button.${key}.root.rest` as never]?.padding as {
        value: number;
      }
    )?.value;
  const recipes = {
    "button.primary.root.rest": { padding: "space.2" },
    "button.tone:critical.root.rest": { padding: "space.3" },
    "button.size:large.root.rest": { padding: "space.4" },
  };
  // A variant beats the wildcard, an axis beats the variant, and a later-declared axis beats an earlier one.
  expect(padding(recipes, "ghost__neutral__small")).toBe(4);
  expect(padding(recipes, "primary__neutral__small")).toBe(8);
  expect(padding(recipes, "primary__critical__small")).toBe(12);
  expect(padding(recipes, "primary__critical__large")).toBe(16);
  // State layers: the variant's state beats an axis's rest; an axis's state beats the variant's state.
  const states = {
    ...recipes,
    "button.primary.root.hover": { padding: "space.5" },
    "button.size:large.root.hover": { padding: "space.6" },
  };
  const table = resolveRecipes(system(states), options(twoAxes));
  const hover = (key: string) => table[`button.${key}.root.hover` as never]?.padding as { value: number } | undefined;
  expect(hover("primary__critical__small")?.value).toBe(20);
  expect(hover("primary__critical__large")?.value).toBe(24);
  expect(hover("ghost__critical__small")?.value).toBe(12);
});

test("role_alias_to_undeclared_role_rejected", () => {
  const at = (roles_: Record<string, string>, key = "button.tone:critical.root.rest") =>
    validateDesignSystem(system({ [key]: { roles: roles_ } }), options(oneAxis));
  failure(at({ accent: "status.missing" }), "unknown-name", pointerOf("button.tone:critical.root.rest", "accent"));
  failure(at({ nope: "status.critical" }), "unknown-name", pointerOf("button.tone:critical.root.rest", "nope"));
  // `none` and a family nobody declared are not role names.
  failure(at({ accent: "none" }), "unknown-name", pointerOf("button.tone:critical.root.rest", "accent"));
  // Even an alias no recipe uses must name declared roles.
  failure(
    at({ ghostly: "status.critical" }, "button.tone:critical.label.hover"),
    "unknown-name",
    pointerOf("button.tone:critical.label.hover", "ghostly"),
  );
  expect(at({ accent: "status.critical", "status.critical": "status.neutral" }).ok).toBe(true);
});

test("role_alias_rejects_literal_colours", () => {
  for (const roles_ of [{ accent: "#ff0000" }, { "#fff": "accent" }, { accent: "red" }, { accent: "rgb(0,0,0)" }])
    expect(
      validateDesignSystem(system({ "button.tone:critical.root.rest": { roles: roles_ } }), options(oneAxis)).ok,
    ).toBe(false);
});

test("roles_allowed_only_on_axis_overlays", () => {
  for (const key of ["button.*.root.rest", "button.primary.root.rest", "button.ghost.label.hover"])
    failure(
      validateDesignSystem(system({ [key]: { roles: { accent: "status.critical" } } }), options(oneAxis)),
      "invalid-document",
      `/recipes/${key}/roles`,
    );
});

test("rewritten_role_must_exist_not_just_the_family", () => {
  // `status.critical` is declared as a family, but `status.critical.on-fill` is not a declared role here.
  const partial = {
    ...oneAxis,
    vocabulary: {
      ...oneAxis.vocabulary,
      colourRoles: roles.filter((role) => role !== "status.critical.on-fill"),
    },
  } as Catalog;
  const result = validateDesignSystem(system({ ...emphasis, ...toneAliases }), options(partial));
  failure(result, "unknown-name", pointerOf("button.tone:critical.root.rest", "accent"));
  // Without a recipe that reads the missing role the same alias is fine.
  const fine = system({
    "button.primary.root.rest": { backgroundColor: "accent.fill" },
    ...toneAliases,
  });
  expect(validateDesignSystem(fine, options(partial)).ok).toBe(true);
});

test("aliases_match_on_dot_boundaries_and_longest_source", () => {
  const table = resolved({
    "button.primary.root.rest": {
      backgroundColor: "accent.fill",
      textColor: "accent.text",
      borderColor: "accented.fill",
    },
    "button.tone:critical.root.rest": { roles: { accent: "status.critical", "accent.text": "status.neutral.text" } },
  });
  const rest = table["button.primary__critical.root.rest"];
  expect(rest?.backgroundColor).toBe("status.critical.fill");
  // The exact role beats its family, and `accented` is not a child of `accent`.
  expect(rest?.textColor).toBe("status.neutral.text");
  expect(rest?.borderColor).toBe("accented.fill");
  // The neutral combination has no alias and keeps the original roles.
  expect(table["button.primary__neutral.root.rest"]?.backgroundColor).toBe("accent.fill");
});

test("aliases_rewrite_once_and_identity_ends", () => {
  const table = resolved({
    "button.primary.root.rest": { backgroundColor: "accent.fill", textColor: "accent.text" },
    "button.tone:critical.root.rest": {
      roles: { accent: "status.critical", "status.critical": "status.neutral", "accent.text": "accent.text" },
    },
  });
  const rest = table["button.primary__critical.root.rest"];
  // accent.fill → status.critical.fill, and status.critical → status.neutral does not apply to the result.
  expect(rest?.backgroundColor).toBe("status.critical.fill");
  expect(rest?.textColor).toBe("accent.text");
});

test("aliases_follow_axis_state_and_inheritance_precedence", () => {
  const recipes = {
    "button.primary.root.rest": { backgroundColor: "accent.fill" },
    "button.tone:critical.root.rest": { roles: { accent: "status.critical" } },
    "button.size:large.root.rest": { roles: { accent: "status.neutral" } },
    "button.tone:critical.root.hover": { roles: { accent: "status.neutral" } },
  };
  const table = resolveRecipes(system(recipes), options(twoAxes));
  const bg = (key: string, state = "rest") => table[`button.${key}.root.${state}` as never]?.backgroundColor;
  // Both axes alias the same source: the later-declared axis (`size`) wins.
  expect(bg("primary__critical__large")).toBe("status.neutral.fill");
  expect(bg("primary__critical__small")).toBe("status.critical.fill");
  // A state alias beats the rest alias for that state only; rest aliases also rewrite the hover snapshot.
  expect(bg("primary__critical__small", "hover")).toBe("status.neutral.fill");
  expect(bg("primary__neutral__small", "hover")).toBe("accent.fill");
  // A child's entry replaces the parent's for the same source and keeps the parent's other sources.
  const parent = system(
    {
      "button.primary.root.rest": { backgroundColor: "accent.fill", textColor: "accent.text" },
      "button.tone:critical.root.rest": { roles: { accent: "status.critical", "accent.text": "status.neutral.text" } },
    },
    "parent",
  );
  const child = system({ "button.tone:critical.root.rest": { roles: { accent: "status.neutral" } } }, "child", {
    extends: "parent",
  });
  const inherited = resolveRecipes(child, options(oneAxis, { parent }))["button.primary__critical.root.rest"];
  expect(inherited?.backgroundColor).toBe("status.neutral.fill");
  expect(inherited?.textColor).toBe("status.neutral.text");
});

test("inherited_alias_error_points_into_the_registry", () => {
  const partial = {
    ...oneAxis,
    vocabulary: { ...oneAxis.vocabulary, colourRoles: roles.filter((role) => role !== "status.critical.on-fill") },
  } as Catalog;
  const parent = system({ ...emphasis, ...toneAliases }, "parent");
  const child = system({}, "child", { extends: "parent" });
  failure(
    validateDesignSystem(child, options(partial, { parent })),
    "unknown-name",
    `/registry/parent${pointerOf("button.tone:critical.root.rest", "accent")}`,
  );
});

test("aliases_preserve_alpha_and_rewrite_shadows_without_mutating_shared_values", () => {
  const table = resolved({
    "button.primary.root.rest": {
      backgroundColor: { role: "accent.fill", alpha: "opacity.half" },
      borderColor: { role: "accent.text", alpha: 0.25 },
      shadow: "shadow.ring",
    },
    "button.ghost.root.rest": {
      shadow: [
        {
          color: { role: "accent.fill", alpha: 0.3 },
          offsetX: { value: 0, unit: "px" },
          offsetY: { value: 0, unit: "px" },
          blur: { value: 1, unit: "px" },
          spread: { value: 0, unit: "px" },
        },
        {
          color: "shadow.ambient",
          offsetX: { value: 0, unit: "px" },
          offsetY: { value: 0, unit: "px" },
          blur: { value: 1, unit: "px" },
          spread: { value: 0, unit: "px" },
        },
      ],
    },
    ...toneAliases,
  });
  const critical = table["button.primary__critical.root.rest"];
  expect(critical?.backgroundColor).toEqual({ role: "status.critical.fill", alpha: 0.5 });
  expect(critical?.borderColor).toEqual({ role: "status.critical.text", alpha: 0.25 });
  expect(critical?.shadow).toMatchObject({ color: "status.critical.fill" });
  // The named shadow is shared by every combination; a combination without an alias keeps the original role.
  expect(
    resolveRecipes(system({ "button.primary.root.rest": { shadow: "shadow.ring" } }), options(oneAxis))[
      "button.primary__neutral.root.rest"
    ]?.shadow,
  ).toMatchObject({ color: "accent.fill" });
  expect(values["shadow.ring"].value.color).toBe("accent.fill");
  const ghost = table["button.ghost__critical.root.rest"]?.shadow as unknown as { color: unknown }[];
  expect(ghost.map((layer) => layer.color)).toEqual([{ role: "status.critical.fill", alpha: 0.3 }, "shadow.ambient"]);
});

test("aliases_rewrite_colour_extensions_only", () => {
  const table = resolved({
    "button.primary.root.rest": {
      padding: "space.2",
      typography: "body",
      extensions: { sheen: "accent.fill", notch: "size.notch" },
    },
    ...toneAliases,
  });
  const critical = table["button.primary__critical.root.rest"];
  expect(critical?.extensions).toEqual({ notch: { value: 6, unit: "px" }, sheen: "status.critical.fill" });
  // Values, typography and spacing are not colours.
  expect(critical?.typography).toBe("body");
  expect(critical?.padding).toEqual({ value: 8, unit: "px" });
  expect(critical).not.toHaveProperty("roles");
});

test("aliased_combinations_are_audited", () => {
  const colour = (value: number) => ({ colorSpace: "srgb", components: [value, value, value], alpha: 1 }) as const;
  const base = catalogWith({ tone: { default: "neutral" } }, { tone });
  const catalog = { ...base, vocabulary: { ...base.vocabulary, contrastBase: "paper" } } as Catalog;
  // Paper is white; every role is black except the critical text, which is a near-white grey.
  const colours = Object.fromEntries(roles.map((role) => [role, colour(0)]));
  colours.paper = colour(1);
  colours["status.critical.text"] = colour(0.9);
  const theme = {
    format: "liveframe-theme/1",
    id: "audit",
    version: "1",
    colorScheme: "light",
    colours,
    typography: {
      body: { fontFamily: "Inter", fontSize: { value: 16, unit: "px" }, fontWeight: 400, lineHeight: 1.5 },
    },
  } as unknown as Theme;
  const recipes = {
    ...emphasis,
    ...toneAliases,
    "button.*.root.rest": { padding: "space.1", backgroundColor: "paper" },
  };
  const findings = auditContrast({ theme, designSystem: system(recipes), catalog });
  if (!findings.ok) throw new Error(JSON.stringify(findings.errors));
  const keys = findings.value.map((finding) => finding.key);
  // Only the aliased combination reads the unreadable role, and the audit names it by its resolved key.
  expect(keys).toContain("button.ghost__critical.root.rest");
  expect(keys).not.toContain("button.ghost__neutral.root.rest");
});

test("slot_class_adds_axis_values_only_when_given", () => {
  expect(slotClass("button", "primary", "root")).toBe("lf_button_primary_root");
  expect(slotClass("button", "primary", "root", [])).toBe("lf_button_primary_root");
  expect(slotClass("button", "primary", "label", ["critical", "small"])).toBe(
    "lf_button_primary__critical__small_label",
  );
});

test("kinds_without_axes_keep_classes_and_resolved_keys", () => {
  const plain = catalogWith(undefined);
  const css = designSystemCss(system({ ...emphasis }), options(plain));
  expect(css.ok).toBe(true);
  if (css.ok) {
    expect(css.value).toContain(".lf_button_primary_root{");
    expect(css.value).not.toMatch(/lf_button_[a-z]+__/);
  }
  expect(Object.keys(resolveRecipes(system({ ...emphasis }), options(plain))).every((key) => !key.includes("__"))).toBe(
    true,
  );
});

test("catalog_change_classifies_axes", () => {
  const plain = validateCatalog(catalogWith(undefined, { tone }));
  const withAxis = validateCatalog(oneAxis);
  const dropped = validateCatalog(catalogWith({ tone: { default: "critical" } }, { tone }));
  if (!plain.ok || !withAxis.ok || !dropped.ok) throw new Error("catalogs must validate");
  expect(classifyCatalogChange(plain.value, withAxis.value).level).toBe("minor");
  expect(classifyCatalogChange(withAxis.value, plain.value).level).toBe("major");
  expect(classifyCatalogChange(withAxis.value, dropped.value).level).toBe("major");
  expect(classifyCatalogChange(withAxis.value, withAxis.value).level).toBe("none");
});

// The renderer computes the class from the validated node's props and the definition's default.
const proof = proofCatalog as Catalog;
const axisProof: Catalog = {
  ...proof,
  definitions: proof.definitions.map((definition) =>
    definition.kind === "button"
      ? {
          ...definition,
          props: { ...definition.props, properties: { ...definition.props.properties, tone } },
          axes: { tone: { default: "neutral" } },
        }
      : definition,
  ),
};
const axisValidator = compileValidator({ catalog: axisProof, capabilities, manifest } as never);
function surface(tonal: Record<string, unknown>) {
  const { Surface } = createRenderer({
    catalog: axisProof,
    implementations: axisProof.definitions.map((definition) =>
      implement(definition, (input) => <div className={input.slot("root")} />),
    ),
  });
  const tree = {
    format: "liveframe/1",
    catalogId: axisProof.catalogId,
    surfaceId: "axes",
    revision: 1,
    root: { id: "root", kind: "button", variant: "ghost", props: { label: "Go", ...tonal } },
  };
  return renderToString(
    <Surface
      tree={tree as never}
      validator={axisValidator}
      theme={{ id: "certified", version: "1.0.0" }}
      designSystem={{ id: "certified", version: "1.0.0" }}
      onIntent={() => {}}
      fallback={<p>Unavailable</p>}
    />,
  );
}

test("surface_class_carries_axis_values_and_defaults", () => {
  expect(surface({ tone: "critical" })).toContain(`class="${slotClass("button", "ghost", "root", ["critical"])}"`);
  // An absent axis prop takes the declared default.
  expect(surface({})).toContain(`class="${slotClass("button", "ghost", "root", ["neutral"])}"`);
});

test("off_enum_axis_value_renders_only_the_fallback", () => {
  const html = surface({ tone: "loud" });
  expect(html).toContain("Unavailable");
  expect(html).not.toContain("lf_button");
});
