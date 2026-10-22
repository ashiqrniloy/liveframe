import type { LiveframeError, Result } from "./errors.ts";

type Annotations = { readonly description?: string; readonly deprecated?: boolean };
type StringOptions = Annotations & {
  readonly maxLength: number;
  readonly pattern?: string;
  readonly enum?: readonly string[];
};
type NumberOptions = Annotations & { readonly minimum?: number; readonly maximum?: number };

export type LanguageSchema = Annotations &
  (
    | ({ readonly type: "string" } & StringOptions)
    | ({ readonly type: "number" | "integer" } & NumberOptions)
    | { readonly type: "boolean" }
    | { readonly type: "array"; readonly items: LanguageSchema; readonly maxItems: number }
    | {
        readonly type: "object";
        readonly properties: Readonly<Record<string, LanguageSchema>>;
        readonly required: readonly string[];
        readonly additionalProperties: false;
      }
  );

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBound(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function codePointsWithin(value: string, maximum: number): boolean {
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
    if (
      !isRecord(schema) ||
      ancestors.has(schema) ||
      typeof schema.type !== "string" ||
      !Object.hasOwn(keywords, schema.type)
    )
      return false;
    const allowed = keywords[schema.type];
    if (!allowed) return false;
    for (const key of Object.keys(schema)) {
      if (key !== "type" && key !== "description" && key !== "deprecated" && !allowed.includes(key)) return false;
    }
    if (Object.hasOwn(schema, "description") && typeof schema.description !== "string") return false;
    if (Object.hasOwn(schema, "deprecated") && typeof schema.deprecated !== "boolean") return false;
    ancestors.add(schema);
    let valid: boolean;
    switch (schema.type) {
      case "string":
        valid = isBound(schema.maxLength);
        if (Object.hasOwn(schema, "enum"))
          valid &&=
            Array.isArray(schema.enum) &&
            schema.enum.length > 0 &&
            schema.enum.every((entry) => typeof entry === "string") &&
            new Set(schema.enum).size === schema.enum.length;
        if (Object.hasOwn(schema, "pattern")) {
          valid &&= typeof schema.pattern === "string" && codePointsWithin(schema.pattern, 256);
          if (valid) {
            try {
              new RegExp(schema.pattern as string, "u");
            } catch {
              valid = false;
            }
          }
        }
        break;
      case "number":
      case "integer":
        valid = ["minimum", "maximum"].every(
          (key) => !Object.hasOwn(schema, key) || (typeof schema[key] === "number" && Number.isFinite(schema[key])),
        );
        break;
      case "boolean":
        valid = true;
        break;
      case "array":
        valid = isBound(schema.maxItems) && visit(schema.items);
        break;
      default:
        valid =
          schema.additionalProperties === false &&
          isRecord(schema.properties) &&
          Array.isArray(schema.required) &&
          schema.required.every((key) => typeof key === "string" && Object.hasOwn(schema.properties as object, key)) &&
          new Set(schema.required).size === schema.required.length &&
          Object.values(schema.properties).every(visit);
    }
    ancestors.delete(schema);
    return valid;
  }
  return visit(value);
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
  function visit(s: LanguageSchema, input: unknown, pointer: string): void {
    if (errors.length >= maxErrors) return;
    switch (s.type) {
      case "string":
        if (typeof input !== "string") {
          reject(pointer, "a string");
          return;
        }
        if (!codePointsWithin(input, s.maxLength)) reject(pointer, `at most ${s.maxLength} code points`);
        if (s.enum && !s.enum.includes(input)) reject(pointer, `one of ${s.enum.join(", ")}`);
        if (s.pattern && !new RegExp(s.pattern, "u").test(input)) reject(pointer, `a string matching ${s.pattern}`);
        return;
      case "number":
      case "integer":
        if (
          typeof input !== "number" ||
          !Number.isFinite(input) ||
          (s.type === "integer" && !Number.isInteger(input))
        ) {
          reject(pointer, `a finite ${s.type}`);
          return;
        }
        if (s.minimum !== undefined && input < s.minimum) reject(pointer, `a number >= ${s.minimum}`);
        if (s.maximum !== undefined && input > s.maximum) reject(pointer, `a number <= ${s.maximum}`);
        return;
      case "boolean":
        if (typeof input !== "boolean") reject(pointer, "a boolean");
        return;
      case "array":
        if (!Array.isArray(input)) {
          reject(pointer, "an array");
          return;
        }
        if (input.length > s.maxItems) reject(pointer, `at most ${s.maxItems} items`);
        for (let i = 0; i < input.length && errors.length < maxErrors; i++)
          visit(s.items, input[i], pointerAt(pointer, i));
        return;
      case "object":
        if (!isRecord(input)) {
          reject(pointer, "an object");
          return;
        }
        for (const key of s.required) {
          if (errors.length >= maxErrors) return;
          if (!Object.hasOwn(input, key)) reject(pointerAt(pointer, key), "a required property");
        }
        for (const key of Object.keys(input)) {
          if (errors.length >= maxErrors) return;
          const property = Object.hasOwn(s.properties, key) ? s.properties[key] : undefined;
          if (!property) reject(pointerAt(pointer, key), "a declared property");
          else visit(property, input[key], pointerAt(pointer, key));
        }
    }
  }
  visit(schema, value, "");
  return errors.length ? { ok: false, errors } : { ok: true, value: value as Infer<S> };
}
