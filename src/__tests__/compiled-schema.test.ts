import { expect, spyOn, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { arr, bool, checkValue, int, type LanguageSchema, num, obj, str } from "../schema.ts";
import { compileSchema, type SchemaSink } from "../validate/schema.ts";

function sink(maxErrors = 20): SchemaSink {
  return { errors: [], maxErrors, nodeId: "root/example" };
}

test("compiled_and_interpreted_agree_on_minimums", () => {
  const ajv = new Ajv2020({ strict: true });
  for (const schema of [
    str({ minLength: 1, maxLength: 2 }),
    str({ minLength: 2, maxLength: 2 }),
    arr(str({ minLength: 1, maxLength: 2 }), { minItems: 1, maxItems: 2 }),
    arr(bool(), { minItems: 0, maxItems: 0 }),
    obj({ "a/~": arr(str({ minLength: 1, maxLength: 2 }), { minItems: 1, maxItems: 2 }) }),
  ]) {
    const check = compileSchema(schema);
    const published = ajv.compile(schema);
    for (const value of [
      null,
      "",
      "😀",
      "😀a",
      "😀ab",
      [],
      [""],
      ["😀"],
      ["a", "b", "c"],
      { "a/~": [] },
      { "a/~": [""] },
    ]) {
      for (const maxErrors of [1, 20]) {
        const errors = sink(maxErrors);
        const baseline = checkValue(schema, value, maxErrors);
        expect(published(value)).toBe(baseline.ok);
        expect(check(value, "/props", errors)).toBe(baseline.ok);
        expect(errors.errors.map((error) => error.pointer)).toEqual(
          baseline.ok ? [] : baseline.errors.map((error) => `/props${error.pointer}`),
        );
      }
    }
  }
});

test("compiled_matches_interpreter", () => {
  let seed = 42;
  const random = (n: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed >>> 8) % n;
  };
  const schemas: LanguageSchema[] = [
    str({ maxLength: 2 }),
    str({ maxLength: 0, pattern: "" }),
    str({ maxLength: 2, enum: ["all", "no"], pattern: "^a" }),
    str({ maxLength: 1, pattern: "^.$" }),
    num({ minimum: -2, maximum: 3 }),
    int({ minimum: 0, maximum: 5 }),
    num({ minimum: 4, maximum: 1 }),
    bool(),
    arr(int(), { maxItems: 2 }),
    obj({ id: str({ maxLength: 2 }) }, { active: bool() }),
    obj({ "a/~": arr(obj({ count: int({ minimum: 0 }) }), { maxItems: 2 }) }),
    obj(JSON.parse('{"__proto__":{"type":"boolean"},"constructor":{"type":"boolean"}}')),
  ];
  const values: unknown[] = [
    null,
    undefined,
    true,
    false,
    0,
    -3,
    3,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "",
    "all",
    "no",
    "abc",
    "👍",
    "👍👍",
    "\ud800",
    "\udc00",
    "a\ud800",
    "a\udc00",
    [],
    [1],
    [1, "bad", 3],
    {},
    { id: "ok" },
    { id: "long", active: 1, extra: true },
    { "a/~": [{ count: -1 }, { count: "bad" }, {}] },
    Object.create({ id: "ok" }),
    Object.assign(Object.create({ extra: true }), { id: "ok" }),
    JSON.parse('{"__proto__":true,"constructor":false}'),
  ];
  const checks = schemas.map(compileSchema);
  for (let i = 0; i < 2_000; i++) {
    const index = random(schemas.length);
    const schema = schemas[index];
    const check = checks[index];
    if (!schema || !check) throw new Error("Missing corpus schema");
    const value = values[random(values.length)];
    const errors = sink(1 + random(20));
    const baseline = checkValue(schema, value, errors.maxErrors);
    expect(check(value, "/root/props", errors)).toBe(baseline.ok);
    expect(errors.errors.map((error) => error.pointer)).toEqual(
      baseline.ok ? [] : baseline.errors.map((error) => `/root/props${error.pointer}`),
    );
    for (const error of errors.errors) {
      expect(error.kind).toBe("invalid-prop");
      expect(error.nodeId).toBe("root/example");
      expect(error.expected?.length).toBeGreaterThan(5);
    }
  }
});

test("errors_are_bounded_without_changing_the_boolean_result", () => {
  const check = compileSchema(obj({ items: arr(obj({ "a/~": bool() }), { maxItems: 2 }) }));
  const errors = sink(2);
  expect(check({ items: [{ "a/~": 1 }, {}, {}] }, "/root/props", errors)).toBe(false);
  expect(errors.errors.map((error) => error.pointer)).toEqual(["/root/props/items", "/root/props/items/0/a~1~0"]);
  expect(check({ items: [] }, "/root/props", errors)).toBe(true);
  expect(check({ items: [{}] }, "/root/props", errors)).toBe(false);
  expect(errors.errors).toHaveLength(2);
});

test("expected_names_the_failed_rule", () => {
  for (const [schema, value, expected] of [
    [str({ maxLength: 2 }), "abc", "string of at most 2 characters"],
    [str({ minLength: 1, maxLength: 500 }), "", "a string of 1–500 characters"],
    [arr(bool(), { minItems: 1, maxItems: 5 }), [], "an array of 1–5 items"],
    [str({ maxLength: 8, enum: ["all", "mine"] }), "other", "one of: all, mine"],
    [str({ maxLength: 8, pattern: "^[a-z]+$" }), "1", "a string matching ^[a-z]+$"],
    [int({ minimum: 0 }), -1, "a number >= 0"],
    [num({ maximum: 1 }), 2, "a number <= 1"],
  ] as const) {
    const errors = sink();
    expect(compileSchema(schema)(value, "", errors)).toBe(false);
    expect(errors.errors[0]?.expected).toBe(expected);
  }
});

test("patterns_compile_once", () => {
  const construction = spyOn(globalThis, "RegExp");
  try {
    const check = compileSchema(str({ maxLength: 8, pattern: "^[a-z]+$" }));
    expect(construction).toHaveBeenCalledTimes(1);
    construction.mockClear();
    const errors = sink();
    for (let i = 0; i < 1_000; i++) expect(check("label", "", errors)).toBe(true);
    expect(construction).not.toHaveBeenCalled();
  } finally {
    construction.mockRestore();
  }
});

test("compiled_is_faster_than_interpreter", () => {
  const schema = obj({
    label: str({ maxLength: 80, pattern: "^[a-z]+$" }),
    view: str({ maxLength: 8, enum: ["all", "mine"] }),
    count: int({ minimum: 0, maximum: 1000 }),
    active: bool(),
  });
  const values = Array.from({ length: 1_000 }, (_, count) => ({ label: "claim", view: "all", count, active: true }));
  const check = compileSchema(schema);
  const errors = sink();
  const compiled = () => {
    let passed = 0;
    for (const value of values) passed += Number(check(value, "", errors));
    return passed;
  };
  const interpreted = () => {
    let passed = 0;
    for (const value of values) passed += Number(checkValue(schema, value).ok);
    return passed;
  };
  for (let i = 0; i < 20; i++) {
    expect(compiled()).toBe(1_000);
    expect(interpreted()).toBe(1_000);
  }
  const measure = (run: () => number) => {
    const samples: number[] = [];
    for (let i = 0; i < 7; i++) {
      const start = performance.now();
      let passed = 0;
      for (let j = 0; j < 10; j++) passed += run();
      samples.push(performance.now() - start);
      expect(passed).toBe(10_000);
    }
    return samples.sort((a, b) => a - b)[3] as number;
  };
  const compiledMs = measure(compiled);
  const interpretedMs = measure(interpreted);
  console.info(
    `compiled schema: ${(interpretedMs / compiledMs).toFixed(1)}x faster (${compiledMs.toFixed(2)} / ${interpretedMs.toFixed(2)} ms per 10,000 values)`,
  );
  expect(interpretedMs / compiledMs).toBeGreaterThanOrEqual(3);
});
