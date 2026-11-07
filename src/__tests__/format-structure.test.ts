import { expect, test } from "bun:test";
import { checkFormat } from "../formats/check.ts";
import { validatePlacement } from "../formats/records.ts";
import { formats } from "../formats/registry.ts";
import { type LiveframeError, validateTreePatch } from "../index.ts";
import { compileFormatSchema, type FormatSchema } from "../validate/format-schema.ts";

function accepts(schema: FormatSchema, value: unknown): boolean {
  const errors: LiveframeError[] = [];
  return compileFormatSchema(schema, () => {
    throw new Error("Unexpected external ref");
  })(value, "", { errors, maxErrors: 20 });
}

test("tag_dispatch_preserves_overlapping_and_untagged_branches", () => {
  const branch = (tag: unknown): FormatSchema => ({
    type: "object",
    properties: { type: { const: tag } },
    required: ["type"],
    additionalProperties: false,
  });
  expect(accepts({ oneOf: [branch("a"), branch("b")] }, { type: "b" })).toBe(true);
  expect(accepts({ oneOf: [branch("a"), branch("a")] }, { type: "a" })).toBe(false);
  expect(accepts({ oneOf: [branch("a"), { type: "object" }] }, { type: "a" })).toBe(false);
  const tag = { value: 1 };
  expect(accepts({ oneOf: [branch(tag), branch({ value: 1 })] }, { type: tag })).toBe(false);
  const untagged = { type: "object", properties: { fallback: { type: "boolean" } }, additionalProperties: false };
  expect(accepts({ oneOf: [branch("a"), untagged] }, { fallback: true })).toBe(true);
  expect(accepts({ oneOf: [branch("a"), untagged] }, { type: "missing" })).toBe(false);
});

test("format_applicators_preserve_json_schema_semantics", () => {
  expect(accepts({ oneOf: [{ type: "number" }, { type: "integer" }] }, 1)).toBe(false);
  expect(accepts({ anyOf: [{ type: "number" }, { type: "integer" }] }, 1)).toBe(true);
  expect(accepts({ allOf: [{ type: "number" }, { not: { const: 1 } }] }, 1)).toBe(false);
  // biome-ignore lint/suspicious/noThenProperty: JSON Schema conditional keyword.
  expect(accepts({ if: { type: "string" }, then: { const: "yes" }, else: { const: 2 } }, 2)).toBe(true);
  // biome-ignore lint/suspicious/noThenProperty: JSON Schema conditional keyword.
  expect(accepts({ if: { type: "string" }, then: { const: "yes" }, else: { const: 2 } }, "no")).toBe(false);
  // biome-ignore lint/suspicious/noThenProperty: JSON Schema conditional keyword.
  expect(accepts({ then: false }, 1)).toBe(true);
  expect(accepts({ type: "array", prefixItems: [{ type: "number" }], items: false }, [1, 2])).toBe(false);
  expect(
    accepts(
      {
        type: "object",
        properties: { a: { type: "number" } },
        patternProperties: { "^a": { const: 2 } },
        additionalProperties: false,
      },
      { a: 1 },
    ),
  ).toBe(false);
  expect(accepts({ type: "object", propertyNames: { maxLength: 1 } }, { long: 1 })).toBe(false);
  expect(
    accepts({ type: "array", uniqueItems: true }, [
      { a: 1, b: 2 },
      { b: 2, a: 1 },
    ]),
  ).toBe(false);
});

test("format_references_are_recursive_and_offline", () => {
  const schema = {
    $ref: "#/$defs/node",
    $defs: { node: { anyOf: [{ type: "null" }, { type: "array", items: { $ref: "#/$defs/node" } }] } },
  };
  expect(accepts(schema, [[null]])).toBe(true);
  expect(accepts(schema, [[true]])).toBe(false);
  expect(() => accepts({ $ref: "#/$defs/missing" }, null)).toThrow("Unknown format reference");
  const shared = { $ref: "#/$defs/value" };
  const documents: Record<string, FormatSchema> = {
    first: { properties: { a: shared }, $defs: { value: { const: 1 } } },
    second: { properties: { b: shared }, $defs: { value: { const: 2 } } },
  };
  const check = compileFormatSchema(
    { allOf: [{ $ref: "first" }, { $ref: "second" }] },
    (id) => documents[id] as FormatSchema,
  );
  expect(check({ a: 1, b: 2 }, "", { errors: [], maxErrors: 1 })).toBe(true);
  expect(check({ a: 1, b: 1 }, "", { errors: [], maxErrors: 1 })).toBe(false);
});

test("registered_structure_rejects_before_relationship_checks", () => {
  const placement = { id: "x", slot: "x", widget: { id: "x", version: "1" }, params: {} };
  expect(checkFormat(formats.placement, placement).ok).toBe(true);
  expect(checkFormat(formats.placement, { ...placement, extra: true }).ok).toBe(false);
  expect(validatePlacement({ ...placement, extra: true }).ok).toBe(false);
  const patch = {
    format: "liveframe/tree-patch/1",
    catalogId: "test@1",
    surfaceId: "x",
    base: 1,
    revision: 1,
    ops: [],
  };
  expect(checkFormat(formats["tree-patch"], patch).ok).toBe(true);
  expect(validateTreePatch(patch).ok).toBe(false);
  expect(Object.keys(formats)).toHaveLength(12);
});
