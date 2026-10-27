import type { LiveframeError, Result } from "./errors.ts";
import { carriesValue } from "./formats/events.ts";

type Annotations = { readonly description?: string; readonly deprecated?: boolean; readonly nullable?: boolean };
type StringOptions = Annotations & {
  readonly maxLength: number;
  readonly minLength?: number;
  readonly pattern?: string;
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

function isBound(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function codePointsWithin(value: string, maximum: number, minimum = 0): boolean {
  if (value.length < minimum) return false;
  if (minimum === 0 && value.length <= maximum) return true;
  let count = 0;
  for (const _ of value) if (++count > maximum) return false;
  return count >= minimum;
}

const keywords: Record<string, readonly string[]> = {
  string: ["maxLength", "minLength", "pattern", "enum"],
  number: ["minimum", "maximum"],
  integer: ["minimum", "maximum"],
  boolean: [],
  array: ["items", "maxItems", "minItems"],
  object: ["properties", "required", "additionalProperties"],
};

/** Checks untrusted schema data, including nested forms and Unicode regular expressions. */
export function isLanguageSchema(value: unknown): value is LanguageSchema {
  return checkLanguageSchema(value);
}

/** Internal install check with keyword diagnostics, preserving the public predicate signature. */
export function checkLanguageSchema(
  value: unknown,
  onError?: (pointer: string, expected: string) => void,
): value is LanguageSchema {
  const ancestors = new Set<unknown>();
  function visit(schema: unknown, pointer = ""): boolean {
    if (!isRecord(schema) || ancestors.has(schema)) return false;
    if (Object.hasOwn(schema, "discriminator")) {
      ancestors.add(schema);
      const valid = isUnionKeywordsValid(schema, visit, pointer);
      ancestors.delete(schema);
      return valid;
    }
    if (typeof schema.type !== "string" || !Object.hasOwn(keywords, schema.type)) return false;
    const allowed = keywords[schema.type];
    if (!allowed || !hasOnlyAllowedKeys(schema, allowed) || !hasValidAnnotations(schema)) return false;
    const minimum = schema.type === "string" ? "minLength" : schema.type === "array" ? "minItems" : undefined;
    const maximum = schema.type === "string" ? schema.maxLength : schema.maxItems;
    if (
      minimum &&
      Object.hasOwn(schema, minimum) &&
      (!isBound(schema[minimum]) || !isBound(maximum) || schema[minimum] > maximum)
    ) {
      onError?.(pointerAt(pointer, minimum), `a nonnegative integer <= ${maximum}`);
      return false;
    }
    ancestors.add(schema);
    const valid = isWellFormed(schema, schema.type, visit, pointer);
    ancestors.delete(schema);
    return valid;
  }
  return visit(value);
}

function isUnionKeywordsValid(
  schema: Record<string, unknown>,
  visit: (schema: unknown, pointer: string) => boolean,
  pointer: string,
): boolean {
  if (
    Object.hasOwn(schema, "type") ||
    !hasOnlyAllowedKeys(schema, ["discriminator", "mapping"]) ||
    !hasValidAnnotations(schema)
  )
    return false;
  const { discriminator, mapping } = schema;
  if (typeof discriminator !== "string" || !isRecord(mapping)) return false;
  const entries = Object.entries(mapping);
  return (
    entries.length >= 1 &&
    entries.length <= 64 &&
    entries.every(
      ([tag, entry]) =>
        codePointsWithin(tag, 64) &&
        isRecord(entry) &&
        entry.type === "object" &&
        entry.nullable !== true &&
        visit(entry, pointerAt(pointerAt(pointer, "mapping"), tag)) &&
        isRecord(entry.properties) &&
        !Object.hasOwn(entry.properties, discriminator),
    )
  );
}

/** Only the keywords a form declares, plus the shared annotations and nullable keyword. */
function hasOnlyAllowedKeys(schema: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(schema).every(
    (key) =>
      key === "type" || key === "description" || key === "deprecated" || key === "nullable" || allowed.includes(key),
  );
}

function hasValidAnnotations(schema: Record<string, unknown>): boolean {
  return (
    (!Object.hasOwn(schema, "description") || typeof schema.description === "string") &&
    (!Object.hasOwn(schema, "deprecated") || typeof schema.deprecated === "boolean") &&
    (!Object.hasOwn(schema, "nullable") || typeof schema.nullable === "boolean")
  );
}

/** Whether the keywords of one declared `type` are well formed, recursing through `visit`. */
function isWellFormed(
  schema: Record<string, unknown>,
  type: string,
  visit: (schema: unknown, pointer: string) => boolean,
  pointer: string,
): boolean {
  switch (type) {
    case "string":
      return isStringKeywordsValid(schema);
    case "number":
    case "integer":
      return isNumericKeywordsValid(schema);
    case "boolean":
      return true;
    case "array":
      return isBound(schema.maxItems) && visit(schema.items, pointerAt(pointer, "items"));
    default:
      return isObjectKeywordsValid(schema, visit, pointer);
  }
}

function isStringKeywordsValid(schema: Record<string, unknown>): boolean {
  if (!isBound(schema.maxLength)) return false;
  if (Object.hasOwn(schema, "enum") && !isNonEmptyUniqueStrings(schema.enum)) return false;
  return !Object.hasOwn(schema, "pattern") || isUnicodePattern(schema.pattern);
}

function isNonEmptyUniqueStrings(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === "string") &&
    new Set(value).size === value.length
  );
}

function isUnicodePattern(pattern: unknown): boolean {
  if (typeof pattern !== "string" || !codePointsWithin(pattern, 256)) return false;
  try {
    new RegExp(pattern, "u");
    return true;
  } catch {
    return false;
  }
}

function isNumericKeywordsValid(schema: Record<string, unknown>): boolean {
  return ["minimum", "maximum"].every(
    (key) => !Object.hasOwn(schema, key) || (typeof schema[key] === "number" && Number.isFinite(schema[key])),
  );
}

function isObjectKeywordsValid(
  schema: Record<string, unknown>,
  visit: (schema: unknown, pointer: string) => boolean,
  pointer: string,
): boolean {
  if (schema.additionalProperties !== false || !isRecord(schema.properties)) return false;
  const { properties, required } = schema;
  return (
    Array.isArray(required) &&
    required.every((key) => typeof key === "string" && Object.hasOwn(properties, key)) &&
    new Set(required).size === required.length &&
    Object.entries(properties).every(([key, child]) => visit(child, pointerAt(pointerAt(pointer, "properties"), key)))
  );
}

function pointerAt(pointer: string, key: string | number): string {
  return `${pointer}/${String(key).replaceAll("~", "~0").replaceAll("/", "~1")}`;
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
    for (let i = 0; i < input.length && !full(); i++) visit(s.items, input[i], pointerAt(pointer, i));
  }
  function checkObject(s: ObjectSchema, input: unknown, pointer: string, discriminator?: string) {
    if (!isRecord(input)) return reject(pointer, "an object");
    for (const key of s.required) {
      if (full()) return;
      if (!Object.hasOwn(input, key)) reject(pointerAt(pointer, key), "a required property");
    }
    for (const key of Object.keys(input)) {
      if (full()) return;
      if (key === discriminator) continue;
      const property = Object.hasOwn(s.properties, key) ? s.properties[key] : undefined;
      if (!property) reject(pointerAt(pointer, key), "a declared property");
      else visit(property, input[key], pointerAt(pointer, key));
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
        reject(pointerAt(pointer, s.discriminator), `one of: ${Object.keys(s.mapping).join(", ")}`);
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
