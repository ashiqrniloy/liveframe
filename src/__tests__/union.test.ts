import { expect, test } from "bun:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  arr,
  bool,
  checkValue,
  classifyCatalogChange,
  type Infer,
  isLanguageSchema,
  type LanguageSchema,
  obj,
  str,
  union,
  validateCapabilities,
  validateCatalog,
  validateManifest,
} from "../index.ts";
import { compileSchema, type SchemaSink } from "../validate/schema.ts";
import { compileIntents } from "../validate/intent.ts";
import { schemaDocument } from "../formats/registry.ts";
import { generate } from "../sdk/gen.ts";
import { validateManifestShape } from "../formats/manifest.ts";
import proof from "./fixtures/proof/catalog.json" with { type: "json" };
import manifest from "./fixtures/proof/agent-home.manifest.json" with { type: "json" };

const task = obj({ title: str({ maxLength: 20 }) });
const alert = obj({ level: str({ maxLength: 8, enum: ["info", "error"] }) });
const feed = union("kind", { task, alert });
const structurallyMalformed = [
  { discriminator: "kind", mapping: {} },
  { discriminator: 1, mapping: { task } },
  { ...feed, type: "object" },
  { ...feed, mapping: { task: bool() } },
  { ...feed, mapping: { task: obj({}, {}, { nullable: true }) } },
  { ...feed, mapping: { ["😀".repeat(65)]: task } },
  { ...feed, mapping: Object.fromEntries(Array.from({ length: 65 }, (_, i) => [String(i), task])) },
];
const malformed = [
  ...structurallyMalformed,
  { ...feed, mapping: { task: obj({ kind: bool() }) } },
  { ...feed, mapping: { task: obj({}, { kind: bool() }) } },
];

test("union_rejects_malformed_mapping", () => {
  expect(isLanguageSchema(feed)).toBe(true);
  for (const schema of malformed) {
    expect(isLanguageSchema(schema)).toBe(false);
    expect(checkValue(schema as LanguageSchema, {}).ok).toBe(false);
    expect(
      validateCapabilities({
        format: "liveframe-capabilities/1",
        actions: {},
        sources: { feed: { description: "Feed", params: obj({}), result: schema } },
      }).ok,
    ).toBe(false);
  }
  expect(isLanguageSchema(union("", { ["😀".repeat(64)]: obj({}) }))).toBe(true);
  expect(
    isLanguageSchema(union("kind", Object.fromEntries(Array.from({ length: 64 }, (_, i) => [String(i), task])))),
  ).toBe(true);
  const cycle: Record<string, unknown> = { discriminator: "kind" };
  cycle.mapping = { task: obj({ cycle: cycle as LanguageSchema }) };
  expect(isLanguageSchema(cycle)).toBe(false);
});

test("union_unknown_tag_fails_at_tag_pointer", () => {
  const schema = obj({ "a/~": union("k/~", { task }) });
  for (const value of [{}, { "k/~": "unknown" }, { "k/~": 1 }, Object.create({ "k/~": "task" })]) {
    const input = { "a/~": value };
    const result = checkValue(schema, input);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toMatchObject([{ pointer: "/a~1~0/k~1~0", expected: expect.stringContaining("task") }]);
    const sink: SchemaSink = { errors: [], maxErrors: 1, nodeId: "node" };
    expect(compileSchema(schema)(input, "/value", sink)).toBe(false);
    expect(sink.errors).toMatchObject([
      { pointer: "/value/a~1~0/k~1~0", expected: expect.stringContaining("task"), nodeId: "node" },
    ]);
  }
});

const values = [
  [{ kind: "task", title: "hello" }, true],
  [{ kind: "alert", level: "error" }, true],
  [{ kind: "task", level: "info" }, false],
  [{ kind: "alert", title: "hello" }, false],
  [{ kind: "alert", level: "bad" }, false],
  [{ kind: "task", title: "hello", extra: true }, false],
  [{ kind: "task" }, false],
  [{ kind: "toString" }, false],
  [{}, false],
  [null, false],
  [[], false],
  [true, false],
] as const;

test("union_checks_only_selected_entry", () => {
  const check = compileSchema(feed);
  for (const [value, valid] of values) {
    expect(checkValue(feed, value).ok).toBe(valid);
    expect(check(value, "", { errors: [], maxErrors: 20 })).toBe(valid);
  }
  const result = checkValue(feed, { kind: "alert", level: "bad" });
  if (!result.ok) expect(result.errors.map((e) => e.pointer)).toEqual(["/level"]);
  const special = union(
    "__proto__",
    JSON.parse('{"__proto__":{"type":"object","properties":{},"required":[],"additionalProperties":false}}'),
  );
  expect(checkValue(special, JSON.parse('{"__proto__":"__proto__"}')).ok).toBe(true);
  expect(compileSchema(special)(JSON.parse('{"__proto__":"__proto__"}'), "", { errors: [], maxErrors: 20 })).toBe(true);
  const nullable = union("kind", { task }, { nullable: true });
  expect(checkValue(nullable, null).ok).toBe(true);
  expect(compileSchema(nullable)(null, "", { errors: [], maxErrors: 20 })).toBe(true);
});

test("infer_union_is_tagged", () => {
  const numeric = union("kind", { 1: obj({}) });
  const numericValue: Infer<typeof numeric> = { kind: "1" };
  expect(checkValue(numeric, numericValue).ok).toBe(true);
  const value: Infer<typeof feed> = { kind: "alert", level: "info" };
  function level(item: Infer<typeof feed>) {
    // @ts-expect-error: requires narrowing
    void item.level;
    if (item.kind === "alert") return item.level;
    return item.title;
  }
  // @ts-expect-error: tag and payload must agree
  const wrong: Infer<typeof feed> = { kind: "task", level: "info" };
  // @ts-expect-error: inferred tag is readonly
  value.kind = "alert";
  expect(level(value)).toBe("info");
  void wrong;
});

// The published documents validate schemas; this equivalent value schema is the independent oracle.
function jsonSchema(schema: LanguageSchema): object {
  const { nullable, ...form } = schema;
  let base: object = form;
  if ("discriminator" in schema)
    base = {
      oneOf: Object.entries(schema.mapping).map(([tag, entry]) => ({
        type: "object",
        additionalProperties: false,
        properties: {
          ...Object.fromEntries(Object.entries(entry.properties).map(([key, child]) => [key, jsonSchema(child)])),
          [schema.discriminator]: { const: tag },
        },
        required: [schema.discriminator, ...entry.required],
      })),
    };
  else if (schema.type === "array") base = { ...form, items: jsonSchema(schema.items) };
  else if (schema.type === "object")
    base = {
      ...form,
      properties: Object.fromEntries(Object.entries(schema.properties).map(([key, child]) => [key, jsonSchema(child)])),
    };
  return nullable ? { anyOf: [base, { type: "null" }] } : base;
}

test("published_union_matches_compiled", async () => {
  const ajv = new Ajv2020({ strict: true, validateFormats: false });
  for (const name of ["schema-language", "catalog", "capabilities", "manifest"] as const) {
    const document = await Bun.file(new URL(`../../schemas/${name}.json`, import.meta.url)).json();
    expect(document).toEqual(schemaDocument(name));
    const meta = ajv.compile({ $defs: document.$defs, $ref: "#/$defs/schema" });
    expect(meta(JSON.parse(JSON.stringify(feed)))).toBe(true);
    for (const schema of structurallyMalformed) expect(meta(schema)).toBe(false);
  }
  for (const schema of [
    feed,
    union("kind", { task, alert }, { nullable: true }),
    arr(feed, { maxItems: 2 }),
    obj({ nested: feed }),
  ]) {
    const oracle = ajv.compile(jsonSchema(schema));
    const check = compileSchema(schema);
    for (const [value] of values)
      for (const input of [value, [value], { nested: value }]) {
        expect(checkValue(schema, input).ok).toBe(oracle(input));
        expect(check(input, "", { errors: [], maxErrors: 20 })).toBe(oracle(input));
      }
  }
});

test("adding_tag_is_minor_removing_or_narrowing_is_major", () => {
  const catalog = validateCatalog(proof);
  if (!catalog.ok) throw new Error("Invalid fixture");
  const definition = catalog.value.definitions[0];
  if (!definition) throw new Error("Missing definition");
  const withSchema = (schema: LanguageSchema) => ({
    ...catalog.value,
    definitions: [{ ...definition, props: obj({ item: schema }) }],
  });
  const single = union("kind", { task });
  expect(classifyCatalogChange(withSchema(single), withSchema(feed)).level).toBe("minor");
  expect(classifyCatalogChange(withSchema(feed), withSchema(single)).level).toBe("major");
  expect(
    classifyCatalogChange(
      withSchema(feed),
      withSchema(union("kind", { task: obj({ title: str({ maxLength: 2 }) }), alert })),
    ).level,
  ).toBe("major");
  expect(classifyCatalogChange(withSchema(feed), withSchema(union("tag", { task, alert }))).level).toBe("major");
  expect(classifyCatalogChange(withSchema(feed), withSchema(bool())).level).toBe("major");
  const generated = generate(withSchema(feed));
  expect(generated).toContain('readonly kind: "task";');
  expect(generated).toContain('readonly kind: "alert";');
  expect(generated).toContain('readonly level: "info" | "error";');
  expect(() => new Bun.Transpiler({ loader: "ts" }).transformSync(generated)).not.toThrow();
});

test("union_state_and_action_arguments_require_explicit_valid_values", () => {
  const document = validateManifestShape({
    ...manifest,
    state: obj({ item: feed }),
    initialState: { item: { kind: "task", title: "hello" } },
    sources: {},
    actions: ["act"],
  });
  if (!document.ok) throw new Error(JSON.stringify(document.errors));
  const intent = compileIntents(
    {
      format: "liveframe-capabilities/1",
      actions: { act: { description: "Act", args: obj({ item: feed }) } },
      sources: {},
    },
    document.value,
  )("string");
  for (const [value, valid] of [
    [{ type: "setState", key: "item", value: { kind: "task", title: "hello" } }, true],
    [{ type: "setState", key: "item", value: { kind: "unknown" } }, false],
    [{ type: "setState", key: "item" }, false],
    [{ type: "action", name: "act", args: { item: { kind: "alert", level: "info" } } }, true],
    [{ type: "action", name: "act", args: {}, bind: "item" }, false],
  ] as const) {
    const sink: SchemaSink = { errors: [], maxErrors: 20 };
    expect(intent(value, "", sink)).toBe(valid);
    expect(JSON.stringify(sink.errors)).not.toContain("undefined");
  }
});

test("source_bindings_treat_union_values_as_objects", () => {
  const catalog = validateCatalog(proof);
  if (!catalog.ok) throw new Error("Invalid fixture");
  const object = obj({ kind: str({ maxLength: 4, enum: ["task"] }), title: str({ maxLength: 20 }) });
  for (const [from, target] of [
    [feed, object],
    [object, feed],
  ] as const) {
    const capabilities = {
      format: "liveframe-capabilities/1",
      actions: {},
      sources: { feed: { description: "Feed", params: obj({ item: target }), result: bool() } },
    } as const;
    expect(
      validateManifest(
        {
          ...manifest,
          params: obj({ item: from }),
          state: obj({}),
          initialState: {},
          sources: { feed: { source: "feed", params: { item: { from: "params", path: "item" } } } },
          actions: [],
        },
        { catalog: catalog.value, capabilities },
      ).ok,
    ).toBe(true);
  }
});

test("manifest_rejects_patterns_in_union_branches", () => {
  const schema = obj({ feed: union("kind", { task: obj({ title: str({ maxLength: 20, pattern: "." }) }) }) });
  const result = validateManifestShape({
    ...manifest,
    state: schema,
    initialState: { feed: { kind: "task", title: "hi" } },
  });
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ pointer: "/state/properties/feed/mapping/task/properties/title/pattern" }),
    );
  const oracle = new Ajv2020({ strict: true }).compile(schemaDocument("manifest"));
  expect(oracle({ ...manifest, state: schema })).toBe(false);
  expect(oracle({ ...manifest, state: obj({ feed }) })).toBe(true);
});

test("gen_prints_formatted_tagged_unions", async () => {
  const catalog = validateCatalog(proof);
  if (!catalog.ok) throw new Error("Invalid fixture");
  const definition = catalog.value.definitions[0];
  if (!definition) throw new Error("Missing definition");
  const output = generate({
    ...catalog.value,
    definitions: [
      {
        ...definition,
        props: obj({
          item: feed,
          list: arr(feed, { maxItems: 2 }),
          nullable: union("kind", { task, alert }, { nullable: true }),
          nested: obj({ item: feed }),
          single: union("kind", { empty: obj({}) }),
        }),
      },
    ],
  });
  const formatter = Bun.spawn(
    [process.execPath, "x", "--no-install", "biome", "format", "--stdin-file-path=src/generated.ts"],
    { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
  );
  const timer = setTimeout(() => formatter.kill(), 10_000);
  try {
    formatter.stdin.write(output);
    formatter.stdin.end();
    const [code, formatted, stderr] = await Promise.all([
      formatter.exited,
      new Response(formatter.stdout).text(),
      new Response(formatter.stderr).text(),
    ]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(formatted).toBe(output);
  } finally {
    clearTimeout(timer);
  }
});
