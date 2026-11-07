import { afterAll, expect, test } from "bun:test";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import { validateManifestShape } from "../formats/manifest.ts";
import { validateWidgetPackageShape } from "../formats/package.ts";
import { validatePlacement, validateStyleRecord } from "../formats/records.ts";
import { formats } from "../formats/registry.ts";
import { validateTemplateShape } from "../template/document.ts";
import {
  compileValidator,
  isLanguageSchema,
  type Json,
  validateCapabilities,
  validateCatalog,
  validateDesignSystem,
  validateTheme,
  validateTreePatch,
  validateVocabulary,
} from "../index.ts";
import { compileFormatSchema, type FormatSchema } from "../validate/format-schema.ts";
import * as numeric from "./fixtures/numeric-events.ts";
import * as form from "./fixtures/object-events.ts";
import { validatorFixtures } from "./fixtures/validator.ts";

type Schema = {
  $id?: string;
  $ref?: string;
  type?: string;
  properties?: Record<string, Schema>;
  patternProperties?: Record<string, Schema>;
  $defs?: Record<string, Schema>;
  additionalProperties?: Schema | boolean;
  required?: string[];
  items?: Schema;
  oneOf?: Schema[];
  anyOf?: Schema[];
  minItems?: number;
  maxItems?: number;
  maxLength?: number;
};
type Path = (string | number)[];
type Mutation = { kind: string; path: Path; value?: Json; bound?: number };
type Seed = { name: string; value: Json; check: (doc: unknown) => boolean };
const started = performance.now();
afterAll(() => expect(performance.now() - started).toBeLessThan(20_000));

// Decimal alpha steps need Ajv's documented floating-point tolerance (e.g. 0.28 / 0.0001).
const ajv = new Ajv2020({ strict: true, unicodeRegExp: true, multipleOfPrecision: 8 });
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
const published = new Map<string, Schema>();
for (const name of Object.keys(formats)) {
  const schema = await Bun.file(new URL(`../../schemas/${name}.json`, import.meta.url)).json();
  published.set(name, schema);
  ajv.addSchema(schema);
}

function validator(ref: string): ValidateFunction {
  const validate = ajv.getSchema(ref);
  if (!validate) throw new Error(`Missing published schema: ${ref}`);
  return validate;
}

function record(value: unknown): value is Record<string, Json> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Only checker-rejects/schema-accepts is permitted, for these install rules:
// vocabulary references; catalog kind/variant/slot references; schema bound ordering,
// required-property references and discriminator exclusion; manifest initial state,
// capability/source bindings; theme role completeness and contrast; design-system
// inheritance, vocabulary, recipe completeness and token references; tree catalog,
// intent, id uniqueness and budgets; patch revision ordering; package byte budgets.
// No rule or document exempts checker-accepts/schema-rejects.

function mutations(value: Json, ref: string, path: Path = [], output: Mutation[] = []): Mutation[] {
  const hash = ref.indexOf("#");
  const id = hash < 0 ? ref : ref.slice(0, hash);
  let schema: unknown = [...published.values()].find((doc) => doc.$id === id);
  for (const key of ref.slice(hash < 0 ? ref.length : hash + 2).split("/")) {
    if (!key) continue;
    schema = (schema as Record<string, unknown>)[key.replaceAll("~1", "/").replaceAll("~0", "~")];
  }
  const shape = schema as Schema;
  if (shape.$ref) {
    return mutations(value, shape.$ref.startsWith("#") ? `${id}${shape.$ref}` : shape.$ref, path, output);
  }
  for (const keyword of ["oneOf", "anyOf"] as const) {
    for (const [i] of (shape[keyword] ?? []).entries()) {
      const branch = `${ref}${hash < 0 ? "#" : ""}/${keyword}/${i}`;
      if (validator(branch)(value)) mutations(value, branch, path, output);
    }
  }
  const childRef = (suffix: string) => `${ref}${hash < 0 ? "#" : ""}/${suffix}`;
  if (shape.type) output.push({ kind: "retype", path, value: shape.type === "null" ? false : null });
  if (record(value) && shape.type === "object") {
    for (const key of shape.required ?? []) output.push({ kind: "drop", path: [...path, key] });
    if (shape.additionalProperties === false)
      output.push({ kind: "unknown", path: [...path, "__drift_unknown__"], value: true });
    for (const [key, child] of Object.entries(value)) {
      const escaped = key.replaceAll("~", "~0").replaceAll("/", "~1");
      if (shape.properties?.[key]) mutations(child, childRef(`properties/${escaped}`), [...path, key], output);
      else if (shape.patternProperties) {
        for (const pattern of Object.keys(shape.patternProperties))
          if (new RegExp(pattern, "u").test(key))
            mutations(
              child,
              childRef(`patternProperties/${pattern.replaceAll("~", "~0").replaceAll("/", "~1")}`),
              [...path, key],
              output,
            );
      } else if (typeof shape.additionalProperties === "object")
        mutations(child, childRef("additionalProperties"), [...path, key], output);
    }
  }
  if (Array.isArray(value)) {
    if (shape.minItems) output.push({ kind: "empty", path, value: [] });
    if (shape.maxItems !== undefined)
      output.push({ kind: "maxItems", path, value: value[0] ?? null, bound: shape.maxItems });
    if (shape.items)
      for (const [i, child] of value.entries()) mutations(child, childRef("items"), [...path, i], output);
  }
  // shortcut: MAX_SAFE_INTEGER sentinel bounds cannot be allocated; test finite bounds up to 1 MiB.
  if (typeof value === "string" && shape.maxLength !== undefined && shape.maxLength <= 1_048_576)
    output.push({ kind: "maxLength", path, bound: shape.maxLength });
  return output;
}

function mutate(value: Json, mutation: Mutation, depth = 0): Json {
  if (depth === mutation.path.length) {
    if (mutation.kind === "maxItems")
      return Array.from({ length: (mutation.bound ?? 0) + 1 }, () => mutation.value ?? null);
    if (mutation.kind === "maxLength") return "x".repeat((mutation.bound ?? 0) + 1);
    return mutation.value ?? null;
  }
  const key = mutation.path[depth];
  const copy = (Array.isArray(value) ? [...value] : { ...(value as Record<string, Json>) }) as Record<string, Json>;
  if (mutation.kind === "drop" && depth === mutation.path.length - 1) delete copy[String(key)];
  else copy[String(key)] = mutate(copy[String(key)] ?? null, mutation, depth + 1);
  return copy;
}

function assertAgreement(seed: Seed, validate: ValidateFunction, doc: Json, label: string) {
  const accepted = seed.check(doc);
  const schemaAccepted = validate(doc);
  if (accepted && !schemaAccepted)
    throw new Error(`${seed.name}: ${label}: checker accepts, schema rejects: ${JSON.stringify(validate.errors)}`);
}

function assertBoundaryRejected(validate: ValidateFunction, doc: Json, label: string) {
  if (validate(doc)) throw new Error(`${label}: schema accepts an overflowing or empty boundary`);
}

const documents: { name: string; value: Json }[] = [];
function collect(name: string, value: Json) {
  if (record(value)) {
    documents.push({ name, value });
    for (const [key, child] of Object.entries(value)) collect(`${name}/${key}`, child);
  } else if (Array.isArray(value)) {
    for (const [i, child] of value.entries()) collect(`${name}/${i}`, child);
  }
}
for (const directory of ["src/__tests__/fixtures", "conformance"]) {
  for (const path of [...new Bun.Glob("**/*.json").scanSync(directory)].sort())
    collect(`${directory}/${path}`, await Bun.file(`${directory}/${path}`).json());
}
for (const [name, fixture] of Object.entries({ numeric, form })) {
  for (const key of ["catalog", "capabilities", "manifest"] as const)
    collect(`${name}/${key}`, JSON.parse(JSON.stringify(fixture[key])));
}
collect("form/tree", form.formTree() as Json);

const catalogs = documents
  .filter(({ value }) => record(value) && value.format === "liveframe-catalog/1")
  .flatMap(({ value }) => {
    const checked = validateCatalog(value);
    return checked.ok ? [checked.value] : [];
  });
const treeFixtures = await validatorFixtures();
for (const { name, tree } of treeFixtures) collect(`validatorFixtures/${name}`, tree as Json);
const treeCheckers = treeFixtures.map(({ validateTree }) => validateTree);
const common = (name: string) => documents.find((doc) => doc.name === `conformance/corpus/common/${name}.json`)?.value;
treeCheckers.push(
  compileValidator({
    catalog: common("proof-catalog"),
    capabilities: common("capabilities"),
    manifest: common("manifest"),
  }).validateTree,
);
treeCheckers.push(form.validator.validateTree, numeric.validator.validateTree);

const checks: Record<string, { matches: (doc: Record<string, Json>) => boolean; check: (doc: unknown) => boolean }> = {
  vocabulary: { matches: (doc) => "colourRoles" in doc, check: (doc) => validateVocabulary(doc).ok },
  "schema-language": { matches: (doc) => "type" in doc || "discriminator" in doc, check: isLanguageSchema },
  catalog: { matches: (doc) => doc.format === "liveframe-catalog/1", check: (doc) => validateCatalog(doc).ok },
  capabilities: {
    matches: (doc) => doc.format === "liveframe-capabilities/1",
    check: (doc) => validateCapabilities(doc).ok,
  },
  manifest: { matches: (doc) => doc.format === "liveframe-manifest/1", check: (doc) => validateManifestShape(doc).ok },
  theme: {
    matches: (doc) => doc.format === "liveframe-theme/1",
    check: (doc) => catalogs.some((catalog) => validateTheme(doc, catalog.vocabulary).ok),
  },
  "design-system": {
    matches: (doc) => doc.format === "liveframe-design-system/1",
    check: (doc) => catalogs.some((catalog) => validateDesignSystem(doc, { catalog, registry: {} }).ok),
  },
  "ui-tree": {
    matches: (doc) => doc.format === "liveframe/1",
    check: (doc) => treeCheckers.some((check) => check(doc).ok),
  },
  "tree-patch": {
    matches: (doc) => doc.format === "liveframe/tree-patch/1",
    check: (doc) => validateTreePatch(doc).ok,
  },
  "widget-package": {
    matches: (doc) => doc.format === "liveframe-package/1",
    check: (doc) => validateWidgetPackageShape(doc).ok,
  },
  template: { matches: (doc) => doc.format === "liveframe-template/1", check: (doc) => validateTemplateShape(doc).ok },
  placement: { matches: (doc) => "slot" in doc && "widget" in doc, check: (doc) => validatePlacement(doc).ok },
  "style-record": {
    matches: (doc) => "kind" in doc && "body" in doc && "version" in doc,
    check: (doc) => validateStyleRecord(doc).ok,
  },
};

test("every_published_format_has_a_differential_checker", () => {
  expect(Object.keys(checks).sort()).toEqual([...Object.keys(formats), "vocabulary"].sort());
});

for (const [name, { matches, check }] of Object.entries(checks)) {
  test(`format_schema_differential: ${name}`, () => {
    const ref = name === "vocabulary" ? "urn:liveframe:catalog:1#/properties/vocabulary" : `urn:liveframe:${name}:1`;
    const validate = validator(ref);
    const structure = compileFormatSchema(
      published.get(name === "vocabulary" ? "catalog" : name) as FormatSchema,
      (id) => {
        const schema = [...published.values()].find((entry) => entry.$id === id);
        if (!schema) throw new Error(`Missing schema: ${id}`);
        return schema as FormatSchema;
      },
    );
    const structural =
      name === "vocabulary"
        ? compileFormatSchema(formats.catalog.$defs.vocabulary, () => {
            throw new Error("Unexpected ref");
          })
        : structure;
    const agrees = (doc: Json) =>
      expect(structural(doc, "", { errors: [], maxErrors: 1 })).toBe(Boolean(validate(doc)));
    const seeds = documents.filter(({ value }) => record(value) && matches(value) && check(value));
    expect(seeds.length).toBeGreaterThan(0);
    let random = 0x25_06;
    for (const { name: seedName, value } of seeds) {
      let scoped = check;
      if (name === "theme") {
        const catalog = catalogs.find((catalog) => validateTheme(value, catalog.vocabulary).ok);
        if (!catalog) throw new Error(`Missing theme vocabulary: ${seedName}`);
        scoped = (doc) => validateTheme(doc, catalog.vocabulary).ok;
      } else if (name === "design-system") {
        const catalog = catalogs.find((catalog) => validateDesignSystem(value, { catalog, registry: {} }).ok);
        if (!catalog) throw new Error(`Missing design-system catalog: ${seedName}`);
        scoped = (doc) => validateDesignSystem(doc, { catalog, registry: {} }).ok;
      } else if (name === "ui-tree") {
        const treeCheck = treeCheckers.find((check) => check(value).ok);
        if (!treeCheck) throw new Error(`Missing tree installation: ${seedName}`);
        scoped = (doc) => treeCheck(doc).ok;
      }
      const seed = { name: seedName, value, check: scoped };
      assertAgreement(seed, validate, value, "seed");
      agrees(value);
      const candidates = mutations(value, ref);
      const groups = [...new Set(candidates.map((mutation) => mutation.kind))].map((kind) =>
        candidates.filter((mutation) => mutation.kind === kind),
      );
      for (let i = 0; i < 200; i++) {
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
        const group = groups[i % groups.length] ?? [];
        const mutation = group[random % group.length];
        if (!mutation) throw new Error(`No mutations for ${seedName}`);
        const doc = mutate(value, mutation);
        const label = `${mutation.kind} /${mutation.path.join("/")}`;
        if (["maxItems", "maxLength", "empty"].includes(mutation.kind)) assertBoundaryRejected(validate, doc, label);
        assertAgreement(seed, validate, doc, label);
        if (i < 20) agrees(doc);
      }
    }
  }, 20_000);
}

test("differential_detects_a_test_only_maxItems_override", () => {
  const ref = "urn:liveframe:catalog:1#/properties/vocabulary";
  const vocabulary = catalogs[0]?.vocabulary;
  if (!vocabulary) throw new Error("Missing vocabulary seed");
  const schema = structuredClone(published.get("catalog")) as Schema;
  const list = schema.$defs?.vocabulary?.properties?.colourRoles;
  if (!list) throw new Error("Missing vocabulary list schema");
  list.maxItems = 257;
  const mutant = new Ajv2020({ strict: true });
  mutant.addFormat("regex", true);
  mutant.addSchema(schema);
  const boundary = { ...vocabulary, colourRoles: Array.from({ length: 257 }, (_, i) => `role${i}`) };
  expect(validator(ref)(boundary)).toBe(false);
  expect(validateVocabulary(boundary).ok).toBe(false);
  // The boundary assertion must fail when a test-only override loosens maxItems.
  const loosened = mutant.getSchema(ref);
  if (!loosened) throw new Error("Missing mutant schema");
  assertBoundaryRejected(validator(ref), boundary, "published maxItems");
  expect(() => assertBoundaryRejected(loosened, boundary, "mutant maxItems")).toThrow("schema accepts");
  const seed = { name: "vocabulary", value: vocabulary as Json, check: (doc: unknown) => validateVocabulary(doc).ok };
  expect(() => assertAgreement(seed, ajv.compile({ type: "array", maxItems: 0 }), seed.value, "override")).toThrow(
    "checker accepts, schema rejects",
  );
});
