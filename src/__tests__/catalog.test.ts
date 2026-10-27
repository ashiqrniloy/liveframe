import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import vocabulary from "./fixtures/vocabulary.json" with { type: "json" };
import proofCatalog from "./fixtures/catalog.json" with { type: "json" };
import { schemaDocument } from "../formats/registry.ts";
import {
  arr,
  bool,
  type Catalog,
  classifyCatalogChange,
  defineComponent,
  int,
  num,
  obj,
  str,
  validateCatalog,
} from "../index.ts";

const button = defineComponent({
  kind: "button",
  description: "Runs an intent.",
  props: obj({ label: str({ maxLength: 80 }) }),
  children: "none",
  variants: ["default", "primary"],
  defaultVariant: "default",
  slots: ["root", "label"],
  events: { onPress: { carries: "none", description: "Pressed." } },
  styleProps: ["width"],
  a11y: { role: "button", name: "label" },
});
const catalog = {
  format: "liveframe-catalog/1",
  catalogId: "acme.ui@1",
  description: "Primitives.",
  vocabulary,
  definitions: [button],
} as const satisfies Catalog;
function rejects(doc: unknown, pointer: string, kind = "invalid-document") {
  const result = validateCatalog(doc);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ kind, pointer }));
}

test("catalog_rejects_each_malformed_definition", () => {
  for (const [change, pointer, kind] of [
    [
      {
        props: { type: "object", properties: { label: { type: "string" } }, required: [], additionalProperties: false },
      },
      "props",
    ],
    [{ props: str({ maxLength: 2 }) }, "props"],
    [{ a11y: { role: "button", name: "missing" } }, "a11y/name", "unknown-name"],
    [{ a11y: { role: "<button>" } }, "a11y/role"],
    [{ children: [{ kind: "missing", min: 0, max: 1 }] }, "children/0/kind", "unknown-name"],
    [{ children: [{ kind: "button", min: 2, max: 1 }] }, "children/0/max"],
    [{ defaultVariant: "missing" }, "defaultVariant", "unknown-name"],
    [{ events: { onpress: { carries: "none", description: "Bad." } } }, "events/onpress"],
    [{ events: { onPress: { carries: "number", description: "Bad." } } }, "events/onPress/carries"],
    [{ styleProps: ["color"] }, "styleProps/0"],
    [{ slots: ["label"] }, "slots"],
    [{ variants: ["default", "default"] }, "variants/1"],
    [{ extra: true }, "extra"],
  ] as const)
    rejects({ ...catalog, definitions: [{ ...button, ...change }] }, `/definitions/0/${pointer}`, kind);
  rejects(null, "");
  rejects({ ...catalog, format: "liveframe/1" }, "/format");
  rejects({ ...catalog, catalogId: "acme@0" }, "/catalogId");
  rejects(
    { ...catalog, vocabulary: { ...vocabulary, tones: { bad: "missing" } } },
    "/vocabulary/tones/bad",
    "unknown-name",
  );
  rejects({ ...catalog, definitions: [button, button] }, "/definitions/1/kind");
  rejects(
    { ...catalog, definitions: [{ ...button, props: obj({ label: { type: "boolean" } }) }] },
    "/definitions/0/a11y/name",
    "unknown-name",
  );
});

test("catalog_change_classification", () => {
  const changes: readonly [Partial<typeof button> | Record<string, unknown>, "major" | "minor" | "none"][] = [
    [{ props: obj({}) }, "major"],
    [{ props: obj({ label: str({ maxLength: 40 }) }) }, "major"],
    [{ props: obj({ label: str({ maxLength: 80 }), extra: str({ maxLength: 2 }) }) }, "major"],
    [{ variants: ["default"] }, "major"],
    [{ slots: ["root"] }, "major"],
    [{ events: {} }, "major"],
    [{ events: { onPress: { carries: "string", description: "Changed." } } }, "major"],
    [{ props: obj({ label: str({ maxLength: 80 }) }, { extra: str({ maxLength: 2 }) }) }, "minor"],
    [{ props: obj({ label: str({ maxLength: 100 }) }) }, "minor"],
    [{ variants: ["default", "primary", "danger"] }, "minor"],
    [{ slots: ["root", "label", "icon"] }, "minor"],
    [{ events: { ...button.events, onFocus: { carries: "none", description: "Focused." } } }, "minor"],
    [{ description: "Updated docs.", deprecated: "Use the replacement." }, "none"],
  ];
  for (const [change, level] of changes) {
    const result = classifyCatalogChange(catalog, { ...catalog, definitions: [{ ...button, ...change }] } as Catalog);
    expect(result.level).toBe(level);
    expect(result.reasons.length > 0).toBe(level !== "none");
  }
  expect(classifyCatalogChange(catalog, catalog)).toEqual({ level: "none", reasons: [] });
  expect(classifyCatalogChange(catalog, { ...catalog, definitions: [] })).toEqual({
    level: "major",
    reasons: ["kind button removed"],
  });
  expect(
    classifyCatalogChange(catalog, { ...catalog, definitions: [button, { ...button, kind: "other" }] }).level,
  ).toBe("minor");
  expect(classifyCatalogChange(catalog, { ...catalog, vocabulary: { ...vocabulary, space: [] } }).level).toBe("major");
  expect(
    classifyCatalogChange(catalog, {
      ...catalog,
      vocabulary: { ...vocabulary, space: [...vocabulary.space, "space.new"] },
    }).level,
  ).toBe("minor");
});

test("surface_typography_changes_are_classified", () => {
  expect(
    classifyCatalogChange(catalog, {
      ...catalog,
      vocabulary: { ...vocabulary, surfaceTypography: "label" },
    }),
  ).toEqual({ level: "major", reasons: ["vocabulary surfaceTypography mapping changed"] });
});

test("catalog_literal_types_survive", () => {
  const kind: "button" = button.kind;
  const variant: "default" | "primary" = button.variants[0];
  const event: "none" = button.events.onPress.carries;
  // @ts-expect-error literal kinds must survive
  const wrong: "text" = button.kind;
  const readonlyTypeCheck = () => {
    // @ts-expect-error variants are readonly
    button.variants.push("danger");
  };
  expect(typeof readonlyTypeCheck).toBe("function");
  expect([kind, variant, event, wrong]).toHaveLength(4);
});

test("catalog_schema_matches_structure", () => {
  const ajv = new Ajv2020({ strict: true });
  ajv.addFormat("regex", {
    type: "string",
    validate: (s: string) => {
      try {
        new RegExp(s, "u");
        return true;
      } catch {
        return false;
      }
    },
  });
  const validate = ajv.compile(schemaDocument("catalog"));
  expect(validate(catalog)).toBe(true);
  expect(validate(proofCatalog)).toBe(true);
  for (const doc of [
    { ...catalog, extra: 1 },
    { ...catalog, definitions: [{ ...button, styleProps: ["color"] }] },
    { ...catalog, definitions: [{ ...button, props: { type: "string" } }] },
  ])
    expect(validate(doc)).toBe(false);
  const result = validateCatalog(catalog);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.value).toBe(catalog);
});

test("nested_schema_changes_are_classified", () => {
  function compare(before: Catalog["definitions"][number]["props"], after: Catalog["definitions"][number]["props"]) {
    return classifyCatalogChange(
      { ...catalog, definitions: [{ ...button, props: before }] },
      { ...catalog, definitions: [{ ...button, props: after }] },
    ).level;
  }
  for (const [before, after, expected] of [
    [num(), int(), "major"],
    [int(), num(), "minor"],
    [num({ minimum: 0 }), num({ minimum: 1 }), "major"],
    [num({ maximum: 5 }), num({ maximum: 4 }), "major"],
    [num({ minimum: 0 }), num(), "minor"],
    [num(), num({ maximum: 1 }), "major"],
    [str({ maxLength: 5 }), str({ maxLength: 5, enum: ["a"] }), "major"],
    [str({ maxLength: 5 }), str({ minLength: 1, maxLength: 5 }), "major"],
    [str({ minLength: 2, maxLength: 5 }), str({ minLength: 1, maxLength: 5 }), "minor"],
    [str({ minLength: 1, maxLength: 5 }), str({ maxLength: 5 }), "minor"],
    [str({ minLength: 0, maxLength: 5 }), str({ maxLength: 5 }), "none"],
    [arr(bool(), { maxItems: 4 }), arr(bool(), { minItems: 1, maxItems: 4 }), "major"],
    [arr(bool(), { minItems: 2, maxItems: 4 }), arr(bool(), { minItems: 1, maxItems: 4 }), "minor"],
    [arr(bool(), { minItems: 1, maxItems: 4 }), arr(bool(), { maxItems: 4 }), "minor"],
    [arr(bool(), { minItems: 0, maxItems: 4 }), arr(bool(), { maxItems: 4 }), "none"],
    [str({ maxLength: 5, enum: ["a"] }), str({ maxLength: 5, enum: ["a", "b"] }), "minor"],
    [str({ maxLength: 5, enum: ["a", "b"] }), str({ maxLength: 5, enum: ["b"] }), "major"],
    [str({ maxLength: 5 }), str({ maxLength: 5, pattern: "^a" }), "major"],
    [str({ maxLength: 5, pattern: "^a" }), str({ maxLength: 5 }), "minor"],
    [arr(bool(), { maxItems: 4 }), arr(bool(), { maxItems: 3 }), "major"],
    [arr(num(), { maxItems: 4 }), arr(int(), { maxItems: 4 }), "major"],
    [obj({}, { flag: bool() }), obj({ flag: bool() }), "major"],
    [obj({ flag: bool() }), obj({}, { flag: bool() }), "minor"],
  ] as const)
    expect(compare(obj({ nested: before }), obj({ nested: after }))).toBe(expected);
  expect(
    compare(
      obj({ label: str({ maxLength: 80 }) }),
      obj({ label: str({ maxLength: 80, deprecated: true, description: "Docs." }) }),
    ),
  ).toBe("none");
});

test("child_style_and_tone_contract_changes_are_classified", () => {
  for (const [before, after, level] of [
    ["any", "none", "major"],
    ["none", "any", "minor"],
    ["none", [{ kind: "button", min: 1, max: 2 }], "major"],
    [[{ kind: "button", min: 0, max: 2 }], [{ kind: "button", min: 1, max: 2 }], "major"],
    [[{ kind: "button", min: 1, max: 2 }], [{ kind: "button", min: 0, max: 3 }], "minor"],
  ] as const)
    expect(
      classifyCatalogChange(
        { ...catalog, definitions: [{ ...button, children: before }] },
        { ...catalog, definitions: [{ ...button, children: after }] },
      ).level,
    ).toBe(level);
  expect(classifyCatalogChange(catalog, { ...catalog, definitions: [{ ...button, styleProps: [] }] }).level).toBe(
    "major",
  );
  const tone = Object.keys(vocabulary.tones)[0] as keyof typeof vocabulary.tones;
  expect(
    classifyCatalogChange(catalog, {
      ...catalog,
      vocabulary: { ...vocabulary, tones: { ...vocabulary.tones, [tone]: "other" } },
    }).level,
  ).toBe("major");
});

test("catalog_errors_are_bounded_and_escape_pointers", () => {
  rejects({ ...catalog, definitions: [{ ...button, events: { "bad/~": {} } }] }, "/definitions/0/events/bad~1~0");
  const result = validateCatalog({
    ...catalog,
    definitions: Array.from({ length: 30 }, () => ({ ...button, slots: [] })),
  });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors).toHaveLength(20);
  const { props: _, ...missing } = button;
  rejects({ ...catalog, definitions: [missing] }, "/definitions/0/props");
  rejects(
    {
      ...catalog,
      definitions: [{ ...button, props: obj({}, { constructor: bool() }), a11y: { role: "button", name: "toString" } }],
    },
    "/definitions/0/a11y/name",
    "unknown-name",
  );
});

test("proof_catalog_validates_under_five_milliseconds", () => {
  // Regenerate with: timeout 20s bun proof/scripts/export-catalog.ts
  for (let i = 0; i < 20; i++) validateCatalog(proofCatalog);
  const start = performance.now();
  const result = validateCatalog(proofCatalog);
  const elapsed = performance.now() - start;
  expect(result.ok).toBe(true);
  expect(proofCatalog.definitions).toHaveLength(24);
  expect(elapsed).toBeLessThan(5);
});
