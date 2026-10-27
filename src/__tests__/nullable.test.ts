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
} from "../schema.ts";
import { compileSchema } from "../validate/schema.ts";
import { schemaDocument } from "../formats/registry.ts";

const forms = [
  str({ minLength: 1, maxLength: 2, enum: ["ok"] }),
  num({ minimum: 1, maximum: 2 }),
  int({ minimum: 1, maximum: 2 }),
  bool(),
  arr(bool(), { minItems: 1, maxItems: 2 }),
  obj({ flag: bool() }),
];

test("nullable_accepts_null_only_when_declared", () => {
  for (const form of forms) {
    for (const nullable of [undefined, false, true]) {
      const schema = nullable === undefined ? form : { ...form, nullable };
      expect(isLanguageSchema(schema)).toBe(true);
      const check = compileSchema(schema);
      for (const value of [
        null,
        undefined,
        "",
        "ok",
        "no",
        0,
        1,
        1.5,
        true,
        [],
        [true],
        [null],
        {},
        { flag: true },
        { flag: null },
      ]) {
        const expected = (nullable === true && value === null) || checkValue(form, value).ok;
        const sink = { errors: [], maxErrors: 20 };
        expect(checkValue(schema, value).ok).toBe(expected);
        expect(check(value, "/value", sink)).toBe(expected);
      }
    }
  }
  const schema = obj({ "a/~": arr(str({ maxLength: 2, nullable: true }), { maxItems: 2, nullable: true }) });
  expect(checkValue(schema, { "a/~": [null] }).ok).toBe(true);
  expect(checkValue(schema, { "a/~": null }).ok).toBe(true);
  expect(checkValue(schema, {}).ok).toBe(false);
  const sink = { errors: [], maxErrors: 1 };
  expect(compileSchema(schema)({ "a/~": [null, 1] }, "/value", sink)).toBe(false);
  expect(sink.errors).toMatchObject([{ pointer: "/value/a~1~0/1" }]);
});

test("nullable_must_be_boolean", () => {
  for (const form of forms)
    for (const nullable of [null, undefined, 0, 1, "true", {}, []]) {
      const schema = { ...form, nullable };
      expect(isLanguageSchema(schema)).toBe(false);
      expect(checkValue(schema as LanguageSchema, null).ok).toBe(false);
    }
  expect(isLanguageSchema({ type: "string", nullable: true })).toBe(false);
});

test("infer_nullable_is_union", () => {
  const schema = obj(
    {
      text: str({ maxLength: 2, nullable: true }),
      choice: str({ maxLength: 2, enum: ["ok"], nullable: true }),
      number: num({ nullable: true }),
      integer: int({ nullable: true }),
      flag: bool({ nullable: true }),
      list: arr(bool({ nullable: true }), { maxItems: 2, nullable: true }),
      record: obj({ flag: bool() }, {}, { nullable: true }),
    },
    { optional: str({ maxLength: 2, nullable: true }) },
  );
  const value: Infer<typeof schema> = {
    text: null,
    choice: null,
    number: null,
    integer: null,
    flag: null,
    list: [null],
    record: null,
  };
  expect(checkValue(schema, value).ok).toBe(true);
  // @ts-expect-error: nullable enum retains its literals
  const choice: Infer<typeof schema> = { ...value, choice: "no" };
  // @ts-expect-error: non-nullable schemas reject null
  const text: Infer<ReturnType<typeof str>> = null;
  const strict = bool({ nullable: false });
  // @ts-expect-error: false does not widen the value type
  const flag: Infer<typeof strict> = null;
  expect([choice, text, flag]).toHaveLength(3);
});

// JSON Schema's nullable does not widen enum; a separate null branch does.
function jsonSchema(schema: LanguageSchema): object {
  const { nullable, ...form } = schema;
  const base =
    schema.type === "array"
      ? { ...form, items: jsonSchema(schema.items) }
      : schema.type === "object"
        ? {
            ...form,
            properties: Object.fromEntries(
              Object.entries(schema.properties).map(([key, child]) => [key, jsonSchema(child)]),
            ),
          }
        : form;
  return nullable ? { anyOf: [base, { type: "null" }] } : base;
}

test("published_schema_nullable_roundtrip", async () => {
  const ajv = new Ajv2020({ strict: true });
  ajv.addFormat("regex", {
    type: "string",
    validate: (pattern: string) => {
      try {
        new RegExp(pattern, "u");
        return true;
      } catch {
        return false;
      }
    },
  });
  for (const name of ["schema-language", "catalog", "capabilities", "manifest"] as const) {
    const document = await Bun.file(new URL(`../../schemas/${name}.json`, import.meta.url)).json();
    expect(document).toEqual(schemaDocument(name));
    const validate = ajv.compile({ $defs: document.$defs, $ref: "#/$defs/schema" });
    for (const form of forms) {
      for (const nullable of [true, false, "true", null])
        expect(validate({ ...form, nullable })).toBe(typeof nullable === "boolean");
      const schema = { ...form, nullable: true };
      const roundtrip = JSON.parse(JSON.stringify(schema));
      expect(validate(roundtrip)).toBe(true);
      const oracle = ajv.compile(jsonSchema(roundtrip));
      for (const value of [null, "ok", "no", 1, true, [true], [null], { flag: true }, {}])
        expect(oracle(value)).toBe(checkValue(schema, value).ok);
    }
  }
});
