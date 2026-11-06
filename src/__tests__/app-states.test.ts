import { expect, test } from "bun:test";
import { designSystemCss } from "../css/index.ts";
import {
  ariaRoles,
  type Catalog,
  classifyCatalogChange,
  type DesignSystem,
  resolveRecipes,
  semantics,
  states,
  validateCatalog,
  validateDesignSystem,
} from "../index.ts";

const vocabulary = {
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
  states: {
    dragging: { attribute: "data-dragging", description: "Being dragged." },
    dragOver: { attribute: "data-drag-over", description: "A drag is over it." },
  },
  semantics: { toolbar: { role: "toolbar", description: "A set of controls." } },
} as const;
const catalog = {
  format: "liveframe-catalog/1",
  catalogId: "app-states@1",
  description: "App-declared states",
  vocabulary,
  definitions: [
    {
      kind: "box",
      description: "Test",
      variants: ["default"],
      defaultVariant: "default",
      slots: ["root"],
      props: {
        type: "object",
        properties: { semantics: { type: "string", maxLength: 16, enum: ["section", "toolbar"] } },
        required: [],
        additionalProperties: false,
      },
      children: "any",
      events: {},
      styleProps: [],
      a11y: { role: "none" },
    },
  ],
} as unknown as Catalog;
/** The vocabulary with `patch` applied; an `undefined` value removes the key (JSON has no undefined). */
const withVocabulary = (patch: Record<string, unknown>): unknown => ({
  ...catalog,
  vocabulary: Object.fromEntries(
    Object.entries({ ...vocabulary, ...patch }).filter(([, value]) => value !== undefined),
  ),
});
/** The same catalog without app declarations, its `semantics` enum back to library values. */
const bare = {
  ...(withVocabulary({ states: undefined, semantics: undefined }) as Catalog),
  definitions: [
    {
      ...catalog.definitions[0],
      props: {
        type: "object",
        properties: { semantics: { type: "string", maxLength: 16, enum: ["section"] } },
        required: [],
        additionalProperties: false,
      },
    },
  ],
} as unknown as Catalog;
const base: DesignSystem = {
  format: "liveframe-design-system/1",
  id: "app",
  version: "1",
  values: { "space.1": { kind: "spacing", value: { value: 4, unit: "px" } } },
  recipes: {
    "box.*.root.rest": { padding: "space.1" },
    "box.*.root.dragging": { backgroundColor: "accent" },
    "box.*.root.dragOver": { outlineColor: "focus" },
  },
};
const context = { catalog, registry: {} };

function catalogError(doc: unknown, kind: string, pointer: string) {
  const result = validateCatalog(doc);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.some((e) => e.kind === kind && e.pointer === pointer)).toBe(true);
}

test("app_state_collides_with_library_state_rejected", () => {
  for (const name of states)
    catalogError(
      withVocabulary({ states: { [name]: { attribute: `data-${name}`, description: "x" } } }),
      "invalid-document",
      `/vocabulary/states/${name}`,
    );
  // A library state's data attribute is taken even under a new name.
  catalogError(
    withVocabulary({ states: { hovered: { attribute: "data-hovered", description: "x" } } }),
    "invalid-document",
    "/vocabulary/states/hovered/attribute",
  );
  catalogError(
    withVocabulary({ states: { dragging: { attribute: "data-drag", description: "x" } } }),
    "invalid-document",
    "/vocabulary/states/dragging/attribute",
  );
});

test("app_state_names_are_closed_and_bounded", () => {
  for (const name of ["Dragging", "drag-over", "drag.over", "9lives", "a/b", "__proto__"])
    expect(validateCatalog(withVocabulary({ states: { [name]: { attribute: "data-x", description: "x" } } })).ok).toBe(
      false,
    );
  const many = Object.fromEntries(
    Array.from({ length: 17 }, (_, i) => [
      `s${String.fromCharCode(97 + i)}`,
      { attribute: `data-s${String.fromCharCode(97 + i)}`, description: "x" },
    ]),
  );
  expect(validateCatalog(withVocabulary({ states: many })).ok).toBe(false);
  expect(validateCatalog(withVocabulary({ states: { ok: { attribute: "data-ok" } } })).ok).toBe(false);
});

test("app_state_recipes_validate_and_undeclared_states_stay_rejected", () => {
  expect(validateDesignSystem(base, context).ok).toBe(true);
  const busy = { ...base, recipes: { ...base.recipes, "box.*.root.busy": { backgroundColor: "ink" } } };
  const result = validateDesignSystem(busy, context);
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ kind: "unknown-name", pointer: "/recipes/box.*.root.busy" }),
    );
  // Without the declaration the same recipe is unknown.
  expect(validateDesignSystem(base, { catalog: bare, registry: {} }).ok).toBe(false);
});

test("app_state_projects_data_attribute_selector", () => {
  const css = designSystemCss(base, context);
  if (!css.ok) throw Error("Expected CSS");
  const rule = css.value.split("\n").find((line) => line.includes("[data-dragging]"));
  expect(rule).toContain(":where([data-dragging])");
  expect(rule).toContain("background-color:var(--lf-c-accent)");
  expect(css.value).toContain(":where([data-drag-over])");
  // Only the attribute selects: no native pseudo-class or ARIA attribute joins it.
  for (const line of css.value.split("\n").filter((l) => l.includes("[data-dragging]")))
    expect(line).not.toMatch(/dragging\][^{]*(:hover|aria-)/);
});

test("app_state_source_order", () => {
  // `invalid` precedes the app states in declared order, and `disabled` follows them, so it beats them.
  const css = designSystemCss(
    {
      ...base,
      recipes: {
        ...base.recipes,
        "box.*.root.invalid": { backgroundColor: "ink" },
        "box.*.root.disabled": { backgroundColor: "ink" },
      },
    },
    context,
  );
  if (!css.ok) throw Error("Expected CSS");
  const order = [":user-invalid", "[data-dragging]", "[data-drag-over]", ":disabled"].map((needle) =>
    css.value.indexOf(`:where(${needle}`),
  );
  expect(order.every((index) => index > -1)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

test("app_state_forced_colours_cue", () => {
  const css = designSystemCss(base, context);
  if (!css.ok) throw Error("Expected CSS");
  const forced = css.value.split("@media (forced-colors:active){")[1] ?? "";
  expect(forced).toMatch(/\[data-dragging\][^{]*\{outline:1px solid Highlight\}/);
  expect(forced).toMatch(/\[data-drag-over\][^{]*\{outline:1px solid Highlight\}/);
  // A state that resolves to its rest declarations gets no rule and no cue.
  const same = designSystemCss(
    { ...base, recipes: { ...base.recipes, "box.*.root.dragging": { padding: "space.1" } } },
    context,
  );
  if (!same.ok) throw Error("Expected CSS");
  expect(same.value).not.toContain("[data-dragging]");
});

test("catalog_without_app_states_projects_the_library_table_only", () => {
  const system = { ...base, recipes: { "box.*.root.rest": { padding: "space.1" } } } as DesignSystem;
  const css = designSystemCss(system, { catalog: bare, registry: {} });
  if (!css.ok) throw Error("Expected CSS");
  expect(css.value).not.toContain("data-dragging");
  const table = resolveRecipes(system, { catalog: bare, registry: {} });
  expect(Object.keys(table).filter((key) => key.endsWith("dragging"))).toEqual([]);
});

test("app_states_resolve_through_the_cascade", () => {
  const table = resolveRecipes(base, context);
  expect(table["box.default.root.dragging"]).toEqual({ padding: { value: 4, unit: "px" }, backgroundColor: "accent" });
  expect(table["box.default.root.dragOver"]).toEqual({ padding: { value: 4, unit: "px" }, outlineColor: "focus" });
});

test("app_semantics_value_accepted", () => {
  expect(validateCatalog(catalog).ok).toBe(true);
});

test("unknown_semantics_still_rejected", () => {
  const doc = JSON.parse(JSON.stringify(catalog));
  doc.definitions[0].props.properties.semantics.enum.push("banner");
  catalogError(doc, "unknown-name", "/definitions/0/props/properties/semantics/enum/2");
  // A library value needs no declaration, and a prop with another name is not checked.
  const library = JSON.parse(JSON.stringify(catalog));
  library.definitions[0].props.properties.semantics.enum = [...semantics];
  expect(validateCatalog(library).ok).toBe(true);
  const other = JSON.parse(JSON.stringify(catalog));
  other.definitions[0].props.properties = { tone: { type: "string", maxLength: 8, enum: ["warm"] } };
  expect(validateCatalog(other).ok).toBe(true);
});

test("aria_role_outside_allowlist_rejected", () => {
  for (const role of ["button", "textbox", "heading", "img", "javascript", "Toolbar"])
    catalogError(
      withVocabulary({ semantics: { toolbar: { role, description: "x" } } }),
      "invalid-document",
      "/vocabulary/semantics/toolbar/role",
    );
  for (const role of ariaRoles)
    expect(
      validateCatalog(withVocabulary({ semantics: { ...vocabulary.semantics, custom: { role, description: "x" } } }))
        .ok,
    ).toBe(true);
  catalogError(
    withVocabulary({ semantics: { section: { role: "region", description: "x" } } }),
    "invalid-document",
    "/vocabulary/semantics/section",
  );
});

test("app_states_and_semantics_classify_catalog_changes", () => {
  const prev = validateCatalog(catalog);
  const without = validateCatalog(bare);
  if (!prev.ok || !without.ok) throw Error("Expected catalogs");
  expect(classifyCatalogChange(without.value, prev.value).level).toBe("minor");
  const removed = classifyCatalogChange(prev.value, without.value);
  expect(removed.level).toBe("major");
  expect(removed.reasons).toContain("vocabulary states dragging removed");
  const reroled = validateCatalog(withVocabulary({ semantics: { toolbar: { role: "group", description: "x" } } }));
  if (!reroled.ok) throw Error("Expected catalog");
  expect(classifyCatalogChange(prev.value, reroled.value).reasons).toContain(
    "vocabulary semantics toolbar role changed",
  );
  // A description-only change is not a change.
  const described = validateCatalog(
    withVocabulary({
      states: { ...vocabulary.states, dragging: { ...vocabulary.states.dragging, description: "Moved." } },
    }),
  );
  if (!described.ok) throw Error("Expected catalog");
  expect(classifyCatalogChange(prev.value, described.value).level).toBe("none");
});
