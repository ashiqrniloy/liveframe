import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  arr,
  bool,
  checkValue,
  type Infer,
  int,
  isLanguageSchema,
  type LanguageSchema,
  num,
  obj,
  str,
} from "../index.ts";

const ajv = new Ajv2020({ strict: true, unicodeRegExp: true, ownProperties: true });

test("boolean_schema_annotations_have_public_types", () => {
  const schema: LanguageSchema = { type: "boolean", description: "Enabled", deprecated: false };
  const annotations = (value: LanguageSchema) => [value.description, value.deprecated];
  expect(annotations(schema)).toEqual(["Enabled", false]);
  expect(isLanguageSchema(schema)).toBe(true);
  expect(checkValue(schema, true).ok).toBe(true);
});

test("language_rejects_unbounded_and_open_schemas", () => {
  for (const schema of [
    { type: "string" },
    { type: "array", items: { type: "boolean" } },
    { type: "object", properties: {}, required: [], additionalProperties: true },
    { type: "boolean", $ref: "elsewhere" },
    { type: "string", maxLength: 2, enum: [1] },
    { type: "string", maxLength: 2, pattern: "[" },
    { type: "string", maxLength: 2, pattern: "a".repeat(257) },
    { type: "string", maxLength: -1 },
    { type: "string", maxLength: 1.5 },
    { type: "string", maxLength: 2, enum: [] },
    { type: "string", maxLength: 2, enum: ["a", "a"] },
    { type: "number", minimum: Number.NaN },
    { type: "boolean", default: true },
    { type: "boolean", deprecated: "yes" },
    { type: "object", properties: {}, required: ["missing"], additionalProperties: false },
    { type: "array", maxItems: 2, items: { type: "string" } },
    { const: "internal" },
    { type: "object", patternProperties: {}, maxProperties: 3, additionalProperties: false },
  ]) {
    expect(isLanguageSchema(schema)).toBe(false);
  }
  const cycle: Record<string, unknown> = { type: "array", maxItems: 2 };
  cycle.items = cycle;
  expect(isLanguageSchema(cycle)).toBe(false);
  expect(checkValue({ type: "string" } as ReturnType<typeof str>, "unsafe").ok).toBe(false);
});

test("builders_produce_language_schemas", () => {
  const shared = str({ maxLength: 5, description: "A label", deprecated: false });
  for (const schema of [
    shared,
    num(),
    int({ minimum: 0 }),
    bool(),
    arr(shared, { maxItems: 3 }),
    obj({ a: shared, b: shared }),
  ]) {
    expect(isLanguageSchema(JSON.parse(JSON.stringify(schema)))).toBe(true);
  }
  const document: unknown = JSON.parse('{"type":"boolean"}');
  if (!isLanguageSchema(document)) throw new Error("Expected a language schema");
  expect(checkValue(document, true).ok).toBe(true);
});

test("max_length_counts_code_points", () => {
  expect(checkValue(str({ maxLength: 2 }), "👍👍").ok).toBe(true);
  expect(checkValue(str({ maxLength: 1 }), "👍👍").ok).toBe(false);
  expect(checkValue(str({ maxLength: 0 }), "").ok).toBe(true);
  expect(checkValue(str({ maxLength: 1, pattern: "^.$" }), "👍").ok).toBe(true);
});

test("errors_are_bounded_and_pointed", () => {
  const schema = obj(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`a/~${i}`, bool()])));
  const value = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`a/~${i}`, "bad"]));
  const result = checkValue(schema, value);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected errors");
  expect(result.errors).toHaveLength(20);
  expect(result.errors[0]).toMatchObject({ kind: "invalid-document", pointer: "/a~1~00" });
  const limited = checkValue(schema, value, 3);
  if (limited.ok) throw new Error("Expected errors");
  expect(limited.errors).toHaveLength(3);
  expect(() => checkValue(schema, value, 0)).toThrow(RangeError);
  const missing = checkValue(obj({ id: str({ maxLength: 8 }) }), { extra: true });
  if (missing.ok) throw new Error("Expected errors");
  expect(missing.errors.map((error) => error.pointer)).toEqual(["/id", "/extra"]);
});

test("objects_validate_own_properties_without_prototype_collisions", () => {
  const schema = obj({ id: bool() });
  expect(checkValue(schema, Object.create({ id: true })).ok).toBe(false);
  expect(checkValue(obj({}), JSON.parse('{"__proto__":true}')).ok).toBe(false);
  expect(checkValue(obj(JSON.parse('{"__proto__":{"type":"boolean"}}')), JSON.parse('{"__proto__":true}')).ok).toBe(
    true,
  );
});

test("check_value_agrees_with_ajv", () => {
  let seed = 42;
  const random = (n: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed >>> 8) % n;
  };
  const schemas = [
    str({ maxLength: 2 }),
    str({ maxLength: 5, enum: ["yes", "no"] }),
    str({ maxLength: 8, pattern: "^[a-z]+$" }),
    num({ minimum: -2, maximum: 3 }),
    int({ minimum: 0, maximum: 5 }),
    bool(),
    arr(int(), { maxItems: 2 }),
    obj({ id: str({ maxLength: 2 }) }, { active: bool() }),
    arr(obj({ n: num({ maximum: 1 }) }), { maxItems: 3 }),
    obj({ rows: arr(bool(), { maxItems: 2 }) }),
  ];
  const values: unknown[] = [
    null,
    "",
    "yes",
    "no",
    "👍👍",
    "abc",
    "abcdefghi",
    -3,
    0,
    1,
    1.5,
    4,
    6,
    true,
    false,
    [],
    [1],
    [1, 2, 3],
    [true, false],
    ["bad"],
    {},
    { id: "ok" },
    { id: "ok", active: true },
    { id: "ok", extra: 1 },
    [{ n: 0 }],
    [{ n: 2 }],
    { rows: [true] },
    { rows: [false, "bad"] },
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ];
  const validators = schemas.map((schema) => ajv.compile(schema));
  for (let i = 0; i < 500; i++) {
    const index = i % schemas.length;
    const schema = schemas[index];
    const validate = validators[index];
    if (!schema || !validate) throw new Error("Missing corpus schema");
    const value = values[random(values.length)];
    expect(checkValue(schema, value).ok).toBe(validate(value));
  }
});

test("check_value_handles_1000_mixed_properties_under_5ms", () => {
  const forms = [str({ maxLength: 8 }), num(), int(), bool(), arr(bool(), { maxItems: 2 }), obj({ n: int() })];
  const values = ["text", 0.5, 2, true, [true], { n: 1 }];
  const schema = obj(
    Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => {
        const form = forms[i % forms.length];
        if (!form) throw new Error("Missing performance fixture schema");
        return [`p${i}`, form];
      }),
    ),
  );
  const value = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`p${i}`, values[i % values.length]]));
  for (let i = 0; i < 5; i++) expect(checkValue(schema, value).ok).toBe(true);
  const start = performance.now();
  const result = checkValue(schema, value);
  const elapsed = performance.now() - start;
  expect(result.ok).toBe(true);
  expect(elapsed).toBeLessThan(5);
});

test("infer_types_match_schemas", () => {
  const schema = obj(
    {
      id: str({ maxLength: 8 }),
      mode: str({ maxLength: 4, enum: ["on", "off"] }),
      rows: arr(obj({ count: int(), active: bool() }), { maxItems: 3 }),
    },
    { reason: str({ maxLength: 10 }) },
  );
  const valid: Infer<typeof schema> = { id: "x", mode: "on", rows: [{ count: 1, active: true }] };
  expect(checkValue(schema, valid).ok).toBe(true);
  // @ts-expect-error Literal enum rejects undeclared strings.
  const wrongEnum: Infer<typeof schema> = { ...valid, mode: "bad" };
  // @ts-expect-error Required fields stay required.
  const missing: Infer<typeof schema> = { mode: "on", rows: [] };
  // @ts-expect-error Nested value types are inferred.
  const wrongNested: Infer<typeof schema> = { ...valid, rows: [{ count: "1", active: true }] };
  // @ts-expect-error Optional props retain their type.
  const wrongOptional: Infer<typeof schema> = { ...valid, reason: false };
  // @ts-expect-error Values are readonly.
  valid.id = "other";
  // @ts-expect-error Arrays are readonly.
  valid.rows.push({ count: 2, active: true });
  void [wrongEnum, missing, wrongNested, wrongOptional];
  const overlap = obj({ id: str({ maxLength: 8 }) }, { id: bool() });
  const requiredWins: Infer<typeof overlap> = { id: "x" };
  expect(checkValue(overlap, requiredWins).ok).toBe(true);
});
