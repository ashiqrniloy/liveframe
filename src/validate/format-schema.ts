import { at } from "../internal.ts";
import { codePointsWithin, isRecord, type LanguageSchema } from "../schema.ts";
import { compileSchema, objectCheck, type SchemaCheck, type SchemaSink } from "./schema.ts";

/** Internal transport vocabulary, not the public widget schema language. */
export type FormatSchema =
  | boolean
  | {
      readonly [keyword: string]: unknown;
      readonly $ref?: string;
      readonly $defs?: Readonly<Record<string, FormatSchema>>;
      readonly type?: string;
      readonly properties?: Readonly<Record<string, FormatSchema>>;
      readonly patternProperties?: Readonly<Record<string, FormatSchema>>;
      readonly propertyNames?: FormatSchema;
      readonly additionalProperties?: FormatSchema;
      readonly required?: readonly string[];
      readonly items?: FormatSchema;
      readonly prefixItems?: readonly FormatSchema[];
      readonly contains?: FormatSchema;
      readonly allOf?: readonly FormatSchema[];
      readonly anyOf?: readonly FormatSchema[];
      readonly oneOf?: readonly FormatSchema[];
      readonly not?: FormatSchema;
      readonly if?: FormatSchema;
      readonly then?: FormatSchema;
      readonly else?: FormatSchema;
    };

function reject(pointer: string, sink: SchemaSink, expected: string): false {
  if (sink.errors.length < sink.maxErrors)
    sink.errors.push({ kind: "invalid-document", pointer, expected, message: `Expected ${expected}` });
  return false;
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((entry, i) => equal(entry, b[i]));
  return (
    isRecord(a) &&
    isRecord(b) &&
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]))
  );
}

const keywords = new Set(
  (
    "$schema $id $ref $defs type properties patternProperties propertyNames additionalProperties " +
    "required items prefixItems contains allOf anyOf oneOf not if " +
    "then else const enum maxLength minLength pattern minimum maximum " +
    "exclusiveMaximum multipleOf format minProperties maxProperties minItems maxItems uniqueItems description " +
    "deprecated nullable"
  ).split(" "),
);

const probe: SchemaSink = { errors: [], maxErrors: 0 };

/** Compiles only trusted format definitions, without code generation or a runtime dependency. */
export function compileFormatSchema(
  root: FormatSchema,
  resolve: (id: string) => FormatSchema,
  refine?: (definition: FormatSchema, check: SchemaCheck) => SchemaCheck,
): SchemaCheck {
  const documents = new Map<FormatSchema, Map<FormatSchema, SchemaCheck>>();
  function compile(schema: FormatSchema, document = root): SchemaCheck {
    let cache = documents.get(document);
    if (!cache) {
      cache = new Map();
      documents.set(document, cache);
    }
    const prior = cache.get(schema);
    if (prior) return prior;
    let check: SchemaCheck;
    const forward: SchemaCheck = (value, pointer, sink) => check(value, pointer, sink);
    cache.set(schema, forward);
    const structure = form(schema, document);
    check = refine ? refine(schema, structure) : structure;
    cache.set(schema, check);
    return check;
  }
  function form(schema: FormatSchema, document: FormatSchema): SchemaCheck {
    if (typeof schema === "boolean") return schema ? () => true : (_, p, s) => reject(p, s, "no value");
    for (const key of Object.keys(schema))
      if (!keywords.has(key)) throw new Error(`Unsupported format keyword: ${key}`);
    const checks: SchemaCheck[] = [];
    if (schema.$ref) checks.push(reference(schema.$ref, document, compile, resolve));
    checks.push(...scalarChecks(schema, compile, document));
    checks.push(...(schema.allOf ?? []).map((child) => compile(child, document)));
    for (const keyword of ["oneOf", "anyOf"] as const) {
      const choices = schema[keyword];
      if (choices) checks.push(alternatives(keyword, choices, compile, document));
    }
    if (schema.not !== undefined) {
      const forbidden = compile(schema.not, document);
      checks.push((v, p, s) => !forbidden(v, p, probe) || reject(p, s, "a value outside the forbidden form"));
    }
    if (schema.if !== undefined) {
      const condition = compile(schema.if, document);
      const yes = compile(schema.then ?? true, document);
      const no = compile(schema.else ?? true, document);
      checks.push((v, p, s) => (condition(v, p, probe) ? yes : no)(v, p, s));
    }
    return combine(checks);
  }

  return compile(root);
}

type Compile = (schema: FormatSchema, document: FormatSchema) => SchemaCheck;

function object(schema: Exclude<FormatSchema, boolean>, compile: Compile, document: FormatSchema): SchemaCheck {
  const properties = new Map(Object.entries(schema.properties ?? {}).map(([k, v]) => [k, compile(v, document)]));
  if (
    schema.type === "object" &&
    schema.additionalProperties === false &&
    !schema.patternProperties &&
    !schema.propertyNames &&
    schema.minProperties === undefined &&
    schema.maxProperties === undefined
  )
    return objectCheck({
      properties,
      required: (schema.required ?? []).map((key) => ({
        key,
        expected: `the required property ${JSON.stringify(key)}`,
      })),
      expected: "no value",
      objectExpected: "an object",
    });
  const patterns = Object.entries(schema.patternProperties ?? {}).map(
    ([k, v]) => [new RegExp(k, "u"), compile(v, document)] as const,
  );
  const names = compile(schema.propertyNames ?? true, document);
  const additional = compile(schema.additionalProperties ?? true, document);
  const member = (value: Record<string, unknown>, key: string, path: string, sink: SchemaSink): boolean => {
    let valid = true;
    let matched = properties.has(key);
    if (matched && !properties.get(key)?.(value[key], path, sink)) valid = false;
    for (const [pattern, check] of patterns)
      if (pattern.test(key)) {
        matched = true;
        if (!check(value[key], path, sink)) valid = false;
      }
    if (!matched && !additional(value[key], path, sink)) valid = false;
    return valid;
  };
  return (value, pointer, sink) => {
    if (!isRecord(value)) return schema.type !== "object" || reject(pointer, sink, "an object");
    const keys = Object.keys(value);
    if (keys.length < Number(schema.minProperties ?? 0) || keys.length > Number(schema.maxProperties ?? Infinity))
      return reject(pointer, sink, "an object within the property bounds");
    let valid = true;
    for (const key of schema.required ?? [])
      if (!Object.hasOwn(value, key))
        valid = reject(at(pointer, key), sink, `the required property ${JSON.stringify(key)}`);
    for (const key of keys) {
      if (!valid && sink.errors.length >= sink.maxErrors) break;
      const path = at(pointer, key);
      const named = names(key, path, sink);
      const checked = member(value, key, path, sink);
      valid = named && checked && valid;
    }
    return valid;
  };
}

function array(schema: Exclude<FormatSchema, boolean>, compile: Compile, document: FormatSchema): SchemaCheck {
  const prefix = (schema.prefixItems ?? []).map((child) => compile(child, document));
  const item = compile(schema.items ?? true, document);
  const contains = schema.contains === undefined ? undefined : compile(schema.contains, document);
  return (value, pointer, sink) => {
    if (!Array.isArray(value)) return reject(pointer, sink, "an array");
    let valid = true;
    if (value.length < Number(schema.minItems ?? 0) || value.length > Number(schema.maxItems ?? Infinity))
      valid = reject(pointer, sink, `an array of ${schema.minItems ?? 0}–${schema.maxItems ?? "unbounded"} items`);
    const seen = new Set<unknown>();
    for (let i = 0; i < value.length; i++) {
      if (!valid && sink.errors.length >= sink.maxErrors) break;
      if (!(prefix[i] ?? item)(value[i], at(pointer, i), sink)) valid = false;
      const distinct = !schema.uniqueItems || unique(value[i], seen);
      valid = (distinct || reject(at(pointer, i), sink, "unique items")) && valid;
    }
    const found = contains === undefined || value.some((entry) => contains(entry, pointer, probe));
    return (found || reject(pointer, sink, "the required item")) && valid;
  };
}

function selector(schema: FormatSchema): (value: unknown) => boolean {
  if (typeof schema === "boolean") return () => schema;
  const tags = Object.entries(schema.properties ?? {})
    .filter(
      ([key, field]) =>
        schema.required?.includes(key) &&
        typeof field === "object" &&
        (Object.hasOwn(field, "const") || (Array.isArray(field.enum) && field.enum.length === 1)),
    )
    .map(([key, field]) => {
      const tag = field as Exclude<FormatSchema, boolean>;
      return [key, Object.hasOwn(tag, "const") ? tag.const : (tag.enum as unknown[])[0]] as const;
    });
  return (value) => {
    if (schema.type && !hasType(schema.type, value)) return false;
    return !isRecord(value) || tags.every(([key, tag]) => Object.hasOwn(value, key) && equal(value[key], tag));
  };
}

function hasType(type: string, value: unknown): boolean {
  if (type === "object") return isRecord(value);
  if (type === "array") return Array.isArray(value);
  if (type === "null") return value === null;
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

function alternatives(
  keyword: "oneOf" | "anyOf",
  choices: readonly FormatSchema[],
  compile: Compile,
  document: FormatSchema,
): SchemaCheck {
  const branches = choices.map((child) => ({ check: compile(child, document), fits: selector(child) }));
  const dispatch = tagSelector(
    choices,
    branches.map((branch) => branch.check),
  );
  return (value, pointer, sink) => {
    const selected = dispatch?.(value);
    if (selected) return selected(value, pointer, sink);
    let matches = 0;
    for (const branch of branches) {
      if (branch.fits(value) && branch.check(value, pointer, probe)) matches++;
      if (keyword === "anyOf" && matches) return true;
    }
    if (matches === 1) return true;
    if (!matches) {
      const candidates = branches.filter((branch) => branch.fits(value));
      return branchErrors(
        (candidates.length ? candidates : branches).map((branch) => branch.check),
        value,
        pointer,
        sink,
      );
    }
    return reject(pointer, sink, "exactly one matching form");
  };
}

function branchErrors(branches: readonly SchemaCheck[], value: unknown, pointer: string, sink: SchemaSink): false {
  if (!sink.maxErrors) return false;
  const failures =
    branches
      .map((check) => {
        const trial: SchemaSink = { errors: [], maxErrors: sink.maxErrors };
        check(value, pointer, trial);
        return trial.errors;
      })
      .sort((a, b) => a.length - b.length)[0] ?? [];
  for (const error of failures) if (sink.errors.length < sink.maxErrors) sink.errors.push(error);
  return failures.length ? false : reject(pointer, sink, "a matching form");
}

function scalarChecks(schema: Exclude<FormatSchema, boolean>, compile: Compile, document: FormatSchema): SchemaCheck[] {
  const checks: SchemaCheck[] = [];
  if (schema.type === "object" || schema.properties || schema.required || schema.patternProperties)
    checks.push(object(schema, compile, document));
  else if (schema.type === "array") checks.push(array(schema, compile, document));
  else if (schema.type === "null") checks.push((v, p, s) => v === null || reject(p, s, "null"));
  else if (schema.type) {
    const primitive = compileSchema({ ...schema, maxLength: schema.maxLength ?? Infinity } as LanguageSchema);
    checks.push(primitive);
  }
  checks.push(...constraints(schema));
  return checks;
}

function constraints(schema: Exclude<FormatSchema, boolean>): SchemaCheck[] {
  const checks: SchemaCheck[] = [];
  if (Object.hasOwn(schema, "const"))
    checks.push((v, p, s) => equal(v, schema.const) || reject(p, s, JSON.stringify(schema.const)));
  if (schema.enum && !schema.type) {
    const choices = schema.enum as readonly unknown[];
    checks.push((v, p, s) => choices.some((entry) => equal(v, entry)) || reject(p, s, `one of: ${choices.join(", ")}`));
  }
  if (schema.maxLength !== undefined && !schema.type)
    checks.push(
      (v, p, s) =>
        typeof v !== "string" || codePointsWithin(v, Number(schema.maxLength)) || reject(p, s, "a bounded string"),
    );
  if (schema.exclusiveMaximum !== undefined)
    checks.push(
      (v, p, s) =>
        typeof v !== "number" ||
        v < Number(schema.exclusiveMaximum) ||
        reject(p, s, `a number < ${schema.exclusiveMaximum}`),
    );
  if (schema.multipleOf !== undefined) {
    const divisor = Number(schema.multipleOf);
    checks.push(
      (v, p, s) =>
        typeof v !== "number" ||
        Math.abs(v / divisor - Math.round(v / divisor)) < 1e-8 ||
        reject(p, s, `a multiple of ${divisor}`),
    );
  }
  if (schema.format === "regex")
    checks.push((v, p, s) => {
      if (typeof v !== "string") return true;
      if (!codePointsWithin(v, Number(schema.maxLength ?? Infinity))) return reject(p, s, "a bounded pattern");
      try {
        new RegExp(v, "u");
        return true;
      } catch {
        return reject(p, s, "a Unicode regular expression");
      }
    });

  return checks;
}

function unique(value: unknown, seen: Set<unknown>): boolean {
  const duplicate = seen.has(value) || (typeof value === "object" && [...seen].some((entry) => equal(entry, value)));
  seen.add(value);
  return !duplicate;
}

function reference(
  ref: string,
  document: FormatSchema,
  compile: Compile,
  resolve: (id: string) => FormatSchema,
): SchemaCheck {
  const [id, fragment = ""] = ref.split("#");
  const targetDocument = id ? resolve(id) : document;
  let target: unknown = targetDocument;
  for (const key of fragment.split("/").slice(1))
    target = (target as Record<string, unknown> | undefined)?.[key.replaceAll("~1", "/").replaceAll("~0", "~")];
  if (target === undefined) throw new Error(`Unknown format reference: ${ref}`);
  return compile(target as FormatSchema, targetDocument);
}

function combine(checks: readonly SchemaCheck[]): SchemaCheck {
  if (checks.length === 1) return checks[0] as SchemaCheck;
  return (v, p, s) => {
    let valid = true;
    for (const check of checks) {
      if (!check(v, p, s)) valid = false;
      if (!valid && s.errors.length >= s.maxErrors) break;
    }
    return valid;
  };
}

/** A required unique tag selects one branch; closed untagged branches cannot accept that key. */
function tagSelector(
  choices: readonly FormatSchema[],
  checks: readonly SchemaCheck[],
): ((value: unknown) => SchemaCheck | undefined) | undefined {
  const first = choices[0];
  if (!first || typeof first === "boolean") return;
  const key = first.required?.find((name) => tag(first.properties?.[name]) !== undefined);
  if (!key) return;
  const tagged = new Map<unknown, SchemaCheck>();
  for (const [i, choice] of choices.entries()) {
    if (typeof choice === "boolean" || choice.type !== "object") return;
    const value = tag(choice.properties?.[key]);
    if (value !== undefined && choice.required?.includes(key)) {
      if (tagged.has(value)) return;
      tagged.set(value, checks[i] as SchemaCheck);
    } else if (
      choice.additionalProperties !== false ||
      choice.patternProperties ||
      Object.hasOwn(choice.properties ?? {}, key)
    )
      return;
  }
  return (value) => (isRecord(value) && Object.hasOwn(value, key) ? tagged.get(value[key]) : undefined);
}

function tag(schema: FormatSchema | undefined): unknown {
  if (!schema || typeof schema === "boolean") return;
  if (Object.hasOwn(schema, "const") && (schema.const === null || typeof schema.const !== "object"))
    return schema.const;
  if (
    Array.isArray(schema.enum) &&
    schema.enum.length === 1 &&
    (schema.enum[0] === null || typeof schema.enum[0] !== "object")
  )
    return schema.enum[0];
}
