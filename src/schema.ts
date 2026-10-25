import type { LiveframeError, Result } from "./errors.ts";

type Annotations = { readonly description?: string; readonly deprecated?: boolean };
type StringOptions = Annotations & {
  readonly maxLength: number;
  readonly pattern?: string;
  readonly enum?: readonly string[];
};
type NumberOptions = Annotations & { readonly minimum?: number; readonly maximum?: number };

type StringSchema = Annotations & { readonly type: "string" } & StringOptions;
type NumericSchema = Annotations & { readonly type: "number" | "integer" } & NumberOptions;
type ArraySchema = Annotations & {
  readonly type: "array";
  readonly items: LanguageSchema;
  readonly maxItems: number;
};
type ObjectSchema = Annotations & {
  readonly type: "object";
  readonly properties: Readonly<Record<string, LanguageSchema>>;
  readonly required: readonly string[];
  readonly additionalProperties: false;
};

export type LanguageSchema = StringSchema | NumericSchema | { readonly type: "boolean" } | ArraySchema | ObjectSchema;

export type Infer<S> = S extends { readonly type: "string"; readonly enum: readonly (infer E)[] }
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
            : never;

export function str<const O extends StringOptions>(options: O) {
  return { ...options, type: "string" } as const;
}

export function num(options: NumberOptions = {}) {
  return { ...options, type: "number" } as const;
}

export function int(options: NumberOptions = {}) {
  return { ...options, type: "integer" } as const;
}

export function bool(options: Annotations = {}) {
  return { ...options, type: "boolean" } as const;
}

export function arr<const S extends LanguageSchema>(items: S, options: Annotations & { readonly maxItems: number }) {
  return { ...options, type: "array", items } as const;
}

export function obj<
  const R extends Readonly<Record<string, LanguageSchema>>,
  const O extends Readonly<Record<string, LanguageSchema>> = Record<never, never>,
>(required: R, optional?: O, annotations: Annotations = {}) {
  return {
    ...annotations,
    type: "object",
    properties: { ...optional, ...required } as R & Omit<O, keyof R>,
    required: Object.keys(required) as (keyof R & string)[],
    additionalProperties: false,
  } as const;
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

export function codePointsWithin(value: string, maximum: number): boolean {
  if (value.length <= maximum) return true;
  let count = 0;
  for (const _ of value) if (++count > maximum) return false;
  return true;
}

const keywords: Record<string, readonly string[]> = {
  string: ["maxLength", "pattern", "enum"],
  number: ["minimum", "maximum"],
  integer: ["minimum", "maximum"],
  boolean: [],
  array: ["items", "maxItems"],
  object: ["properties", "required", "additionalProperties"],
};

/** Checks untrusted schema data, including nested forms and Unicode regular expressions. */
export function isLanguageSchema(value: unknown): value is LanguageSchema {
  const ancestors = new Set<unknown>();
  function visit(schema: unknown): boolean {
    if (!isRecord(schema) || ancestors.has(schema)) return false;
    if (typeof schema.type !== "string" || !Object.hasOwn(keywords, schema.type)) return false;
    const allowed = keywords[schema.type];
    if (!allowed || !hasOnlyAllowedKeys(schema, allowed) || !hasValidAnnotations(schema)) return false;
    ancestors.add(schema);
    const valid = isWellFormed(schema, schema.type, visit);
    ancestors.delete(schema);
    return valid;
  }
  return visit(value);
}

/** Only the keywords a form declares, plus the two annotations every form shares. */
function hasOnlyAllowedKeys(schema: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(schema).every(
    (key) => key === "type" || key === "description" || key === "deprecated" || allowed.includes(key),
  );
}

function hasValidAnnotations(schema: Record<string, unknown>): boolean {
  return (
    (!Object.hasOwn(schema, "description") || typeof schema.description === "string") &&
    (!Object.hasOwn(schema, "deprecated") || typeof schema.deprecated === "boolean")
  );
}

/** Whether the keywords of one declared `type` are well formed, recursing through `visit`. */
function isWellFormed(schema: Record<string, unknown>, type: string, visit: (schema: unknown) => boolean): boolean {
  switch (type) {
    case "string":
      return isStringKeywordsValid(schema);
    case "number":
    case "integer":
      return isNumericKeywordsValid(schema);
    case "boolean":
      return true;
    case "array":
      return isBound(schema.maxItems) && visit(schema.items);
    default:
      return isObjectKeywordsValid(schema, visit);
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

function isObjectKeywordsValid(schema: Record<string, unknown>, visit: (schema: unknown) => boolean): boolean {
  if (schema.additionalProperties !== false || !isRecord(schema.properties)) return false;
  const { properties, required } = schema;
  return (
    Array.isArray(required) &&
    required.every((key) => typeof key === "string" && Object.hasOwn(properties, key)) &&
    new Set(required).size === required.length &&
    Object.values(properties).every(visit)
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
  if (!isLanguageSchema(schema)) {
    reject("", "a bounded, closed schema in the Liveframe language");
    return { ok: false, errors };
  }
  const full = () => errors.length >= maxErrors;
  function checkString(s: StringSchema, input: unknown, pointer: string) {
    if (typeof input !== "string") return reject(pointer, "a string");
    if (!codePointsWithin(input, s.maxLength)) reject(pointer, `at most ${s.maxLength} code points`);
    if (s.enum && !s.enum.includes(input)) reject(pointer, `one of ${s.enum.join(", ")}`);
    if (s.pattern && !new RegExp(s.pattern, "u").test(input)) reject(pointer, `a string matching ${s.pattern}`);
  }
  function checkNumeric(s: NumericSchema, input: unknown, pointer: string) {
    if (typeof input !== "number" || !Number.isFinite(input) || (s.type === "integer" && !Number.isInteger(input)))
      return reject(pointer, `a finite ${s.type}`);
    if (s.minimum !== undefined && input < s.minimum) reject(pointer, `a number >= ${s.minimum}`);
    if (s.maximum !== undefined && input > s.maximum) reject(pointer, `a number <= ${s.maximum}`);
  }
  function checkArray(s: ArraySchema, input: unknown, pointer: string) {
    if (!Array.isArray(input)) return reject(pointer, "an array");
    if (input.length > s.maxItems) reject(pointer, `at most ${s.maxItems} items`);
    for (let i = 0; i < input.length && !full(); i++) visit(s.items, input[i], pointerAt(pointer, i));
  }
  function checkObject(s: ObjectSchema, input: unknown, pointer: string) {
    if (!isRecord(input)) return reject(pointer, "an object");
    for (const key of s.required) {
      if (full()) return;
      if (!Object.hasOwn(input, key)) reject(pointerAt(pointer, key), "a required property");
    }
    for (const key of Object.keys(input)) {
      if (full()) return;
      const property = Object.hasOwn(s.properties, key) ? s.properties[key] : undefined;
      if (!property) reject(pointerAt(pointer, key), "a declared property");
      else visit(property, input[key], pointerAt(pointer, key));
    }
  }
  function visit(s: LanguageSchema, input: unknown, pointer: string): void {
    if (full()) return;
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
