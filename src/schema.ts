import type { LiveframeError, Result } from "./errors.ts";
import { carriesValue } from "./formats/events.ts";
import { schemaLanguage } from "./formats/language.ts";
import { at } from "./internal.ts";
import { checkUrl, type UrlRule, urlExpected } from "./url.ts";
import { compileFormatSchema } from "./validate/format-schema.ts";
import type { SchemaCheck } from "./validate/schema.ts";

type Annotations = { readonly description?: string; readonly deprecated?: boolean; readonly nullable?: boolean };
type StringOptions = Annotations & {
  readonly maxLength: number;
  readonly minLength?: number;
  readonly pattern?: string;
  readonly url?: UrlRule;
  readonly enum?: readonly string[];
};
type NumberOptions = Annotations & { readonly minimum?: number; readonly maximum?: number };

type StringSchema = Annotations & { readonly type: "string" } & StringOptions;
type NumericSchema = Annotations & { readonly type: "number" | "integer" } & NumberOptions;
type BooleanSchema = Annotations & { readonly type: "boolean" };
type ArraySchema = Annotations & {
  readonly type: "array";
  readonly items: LanguageSchema;
  readonly maxItems: number;
  readonly minItems?: number;
};
type ObjectSchema = Annotations & {
  readonly type: "object";
  readonly properties: Readonly<Record<string, LanguageSchema>>;
  readonly required: readonly string[];
  readonly additionalProperties: false;
};

type UnionSchema = Annotations & {
  readonly type?: never;
  readonly discriminator: string;
  readonly mapping: Readonly<Record<string, ObjectSchema>>;
};

export type LanguageSchema = StringSchema | NumericSchema | BooleanSchema | ArraySchema | ObjectSchema | UnionSchema;

export type Infer<S> = S extends { readonly nullable: true } ? InferForm<S> | null : InferForm<S>;

type InferForm<S> = S extends { readonly type: "string"; readonly enum: readonly (infer E)[] }
  ? E
  : S extends { readonly type: "string" }
    ? string
    : S extends { readonly type: "number" | "integer" }
      ? number
      : S extends { readonly type: "boolean" }
        ? boolean
        : S extends { readonly type: "array"; readonly items: infer I }
          ? readonly Infer<I>[]
          : S extends { readonly type: "object"; readonly properties: infer P; readonly required: readonly (infer R)[] }
            ? { readonly [K in keyof P as K extends R ? K : never]: Infer<P[K]> } & {
                readonly [K in keyof P as K extends R ? never : K]?: Infer<P[K]>;
              }
            : S extends { readonly discriminator: infer D extends string; readonly mapping: infer M }
              ? {
                  [K in keyof M]: { readonly [P in D]: K extends string | number ? `${K}` : never } & InferForm<M[K]>;
                }[keyof M]
              : never;

export function str<const O extends StringOptions>(options: O) {
  return { ...options, type: "string" } as const;
}

export function num<const O extends NumberOptions = Record<never, never>>(options: O = {} as O) {
  return { ...options, type: "number" } as const;
}

export function int<const O extends NumberOptions = Record<never, never>>(options: O = {} as O) {
  return { ...options, type: "integer" } as const;
}

export function bool<const O extends Annotations = Record<never, never>>(options: O = {} as O) {
  return { ...options, type: "boolean" } as const;
}

export function arr<
  const S extends LanguageSchema,
  const O extends Annotations & { readonly maxItems: number; readonly minItems?: number },
>(items: S, options: O) {
  return { ...options, type: "array", items } as const;
}

export function obj<
  const R extends Readonly<Record<string, LanguageSchema>>,
  const O extends Readonly<Record<string, LanguageSchema>> = Record<never, never>,
  const A extends Annotations = Record<never, never>,
>(required: R, optional?: O, annotations: A = {} as A) {
  return {
    ...(annotations as Pick<A, keyof A & keyof Annotations>),
    type: "object",
    properties: { ...optional, ...required } as R & Omit<O, keyof R>,
    required: Object.keys(required) as (keyof R & string)[],
    additionalProperties: false,
  } as const;
}

export function union<
  const D extends string,
  const M extends Readonly<Record<string, ObjectSchema>>,
  const A extends Annotations = Record<never, never>,
>(discriminator: D, mapping: M, annotations: A = {} as A) {
  return { ...(annotations as Pick<A, keyof A & keyof Annotations>), discriminator, mapping } as const;
}

/** Optional convention for outcomes resolved by the host, without granting authority. */
export function sourceOutcome<const S extends LanguageSchema>(result: S) {
  const failure = obj({}, { reason: str({ maxLength: 500 }), value: result });
  return union("status", {
    ok: obj({ value: result }, { checkedAt: str({ maxLength: 128 }) }),
    unauthorized: failure,
    unavailable: failure,
    stale: failure,
    failed: failure,
  });
}

// Publishing-only forms; these are deliberately outside the author schema language.
export function literal<const T extends string | number | boolean | null>(value: T) {
  return { const: value } as const;
}

export function record<S>(pattern: string, values: S, maxProperties: number) {
  return {
    type: "object",
    patternProperties: { [pattern]: values },
    maxProperties,
    additionalProperties: false,
  } as const;
}

/** The one record test in the package: object, not null, not an array. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function codePointsWithin(value: string, maximum: number, minimum = 0): boolean {
  if (value.length < minimum) return false;
  if (minimum === 0 && value.length <= maximum) return true;
  let count = 0;
  for (const _ of value) if (++count > maximum) return false;
  return count >= minimum;
}

let languageCheck: ReturnType<typeof compileFormatSchema> | undefined;
const schemaProbe = { errors: [] as LiveframeError[], maxErrors: 0 };

/** Checks untrusted schema data, including nested forms and Unicode regular expressions. */
export function isLanguageSchema(value: unknown): value is LanguageSchema {
  return checkLanguageSchema(value);
}

/** Structural meta-schema first, then relationships between schema keywords. */
export function checkLanguageSchema(
  value: unknown,
  onError?: (pointer: string, expected: string) => void,
): value is LanguageSchema {
  languageCheck ??= compileFormatSchema(
    schemaLanguage,
    () => {
      throw new Error("Unexpected schema reference");
    },
    languageRefinement,
  );
  try {
    if (languageCheck(value, "", schemaProbe)) return true;
    const errors: LiveframeError[] = [];
    if (!languageCheck(value, "", { errors, maxErrors: 1 })) {
      const error = errors[0];
      if (error) onError?.(error.pointer, error.expected ?? "a language schema");
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

/** Keyword relationships after the generated structural meta-schema has passed. */
export function checkSchemaRelationships(
  schema: LanguageSchema,
  onError?: (pointer: string, expected: string) => void,
  pointer = "",
): boolean {
  if (!checkSchemaKeywords(schema, onError, pointer)) return false;
  if (schema.type === "array") return checkSchemaRelationships(schema.items, onError, at(pointer, "items"));
  if (schema.type === "object")
    return Object.entries(schema.properties).every(([key, child]) =>
      checkSchemaRelationships(child, onError, at(at(pointer, "properties"), key)),
    );
  if ("discriminator" in schema)
    return Object.entries(schema.mapping).every(([tag, entry]) =>
      checkSchemaRelationships(entry, onError, at(at(pointer, "mapping"), tag)),
    );
  return true;
}

function checkSchemaKeywords(
  schema: LanguageSchema,
  onError?: (pointer: string, expected: string) => void,
  pointer = "",
): boolean {
  if ("discriminator" in schema)
    return Object.entries(schema.mapping).every(
      ([tag, entry]) =>
        !Object.hasOwn(entry.properties, schema.discriminator) &&
        checkSchemaKeywords(entry, onError, at(at(pointer, "mapping"), tag)),
    );
  const minimum = schema.type === "string" ? schema.minLength : schema.type === "array" ? schema.minItems : undefined;
  const maximum = schema.type === "string" ? schema.maxLength : schema.type === "array" ? schema.maxItems : undefined;
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    onError?.(at(pointer, schema.type === "string" ? "minLength" : "minItems"), `a nonnegative integer <= ${maximum}`);
    return false;
  }
  if (schema.type === "string" && schema.url && schema.pattern !== undefined) {
    onError?.(at(pointer, "url"), "no pattern beside url");
    return false;
  }

  return schema.type !== "object" || schema.required.every((key) => Object.hasOwn(schema.properties, key));
}

/** Relationships remain named code but run as each recursive schema form finishes. */
function languageRefinement(definition: unknown, check: SchemaCheck): SchemaCheck {
  if (definition !== schemaLanguage.$defs.schema) return check;
  return (value, pointer, sink) =>
    check(value, pointer, sink) &&
    checkSchemaKeywords(
      value as LanguageSchema,
      sink.maxErrors === 0
        ? undefined
        : (path, expected) => {
            if (sink.errors.length < sink.maxErrors)
              sink.errors.push({ kind: "invalid-document", pointer: path, expected, message: `Expected ${expected}` });
          },
      pointer,
    );
}

/** Interprets a language schema and returns at most maxErrors failures (default 20). */
export function checkValue<const S extends LanguageSchema>(
  schema: S,
  value: unknown,
  maxErrors = 20,
): Result<Infer<S>> {
  if (!Number.isInteger(maxErrors) || maxErrors < 1) throw new RangeError("maxErrors must be a positive integer");
  const errors: LiveframeError[] = [];
  function reject(pointer: string, expected: string) {
    if (errors.length < maxErrors)
      errors.push({ kind: "invalid-document", pointer, message: `Expected ${expected}`, expected });
  }
  if (!checkLanguageSchema(schema, reject)) {
    if (!errors.length) reject("", "a bounded, closed schema in the Liveframe language");
    return { ok: false, errors };
  }
  const full = () => errors.length >= maxErrors;
  function checkString(s: StringSchema, input: unknown, pointer: string) {
    if (typeof input !== "string") return reject(pointer, "a string");
    if (!codePointsWithin(input, s.maxLength, s.minLength))
      reject(
        pointer,
        s.minLength === undefined
          ? `at most ${s.maxLength} code points`
          : `a string of ${s.minLength}–${s.maxLength} characters`,
      );
    if (s.enum && !s.enum.includes(input)) reject(pointer, `one of ${s.enum.join(", ")}`);
    if (s.pattern && !new RegExp(s.pattern, "u").test(input)) reject(pointer, `a string matching ${s.pattern}`);
    if (s.url && !checkUrl(input, s.url)) reject(pointer, urlExpected(s.url));
  }
  function checkNumeric(s: NumericSchema, input: unknown, pointer: string) {
    if (!carriesValue(s.type, input)) return reject(pointer, `a finite ${s.type}`);
    if (s.minimum !== undefined && input < s.minimum) reject(pointer, `a number >= ${s.minimum}`);
    if (s.maximum !== undefined && input > s.maximum) reject(pointer, `a number <= ${s.maximum}`);
  }
  function checkArray(s: ArraySchema, input: unknown, pointer: string) {
    if (!Array.isArray(input)) return reject(pointer, "an array");
    if (input.length > s.maxItems) reject(pointer, `at most ${s.maxItems} items`);
    if (input.length < (s.minItems ?? 0)) reject(pointer, `an array of ${s.minItems}–${s.maxItems} items`);
    for (let i = 0; i < input.length && !full(); i++) visit(s.items, input[i], at(pointer, i));
  }
  function checkObject(s: ObjectSchema, input: unknown, pointer: string, discriminator?: string) {
    if (!isRecord(input)) return reject(pointer, "an object");
    for (const key of s.required) {
      if (full()) return;
      if (!Object.hasOwn(input, key)) reject(at(pointer, key), "a required property");
    }
    for (const key of Object.keys(input)) {
      if (full()) return;
      if (key === discriminator) continue;
      const property = Object.hasOwn(s.properties, key) ? s.properties[key] : undefined;
      if (!property) reject(at(pointer, key), "a declared property");
      else visit(property, input[key], at(pointer, key));
    }
  }
  function visit(s: LanguageSchema, input: unknown, pointer: string): void {
    if (full() || (s.nullable === true && input === null)) return;
    if ("discriminator" in s) {
      if (!isRecord(input)) {
        reject(pointer, "an object");
        return;
      }
      const tag = Object.hasOwn(input, s.discriminator) ? input[s.discriminator] : undefined;
      if (typeof tag !== "string" || !Object.hasOwn(s.mapping, tag)) {
        reject(at(pointer, s.discriminator), `one of: ${Object.keys(s.mapping).join(", ")}`);
        return;
      }
      checkObject(s.mapping[tag] as ObjectSchema, input, pointer, s.discriminator);
      return;
    }
    switch (s.type) {
      case "string":
        checkString(s, input, pointer);
        return;
      case "number":
      case "integer":
        checkNumeric(s, input, pointer);
        return;
      case "boolean":
        if (typeof input !== "boolean") reject(pointer, "a boolean");
        return;
      case "array":
        checkArray(s, input, pointer);
        return;
      case "object":
        checkObject(s, input, pointer);
        return;
    }
  }
  visit(schema, value, "");
  return errors.length ? { ok: false, errors } : { ok: true, value: value as Infer<S> };
}
