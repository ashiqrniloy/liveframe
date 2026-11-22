// Shared parts of the template expression language: bounds, frames and failures, operand kinds
// with their static and runtime tests, and the common result types.
import type { LiveframeError } from "../../errors.ts";
import type { documentChecks } from "../../formats/capabilities.ts";
import type { LanguageSchema } from "../../schema.ts";
import { absent, DYNAMIC, type ExprType, MAX_ITEMS, MAX_STRING, PRESENT, typeOf } from "../scope.ts";

/** Bounds checked at install by `validateTemplate`; `steps` is the evaluation fuel enforced at render (spec §7.6). */
export const EXPR_LIMITS = {
  depth: 32,
  nodes: 20_000,
  bindings: 32,
  steps: 1_000_000,
  stringUnits: MAX_STRING,
  arrayItems: MAX_ITEMS,
} as const;

/** Steps per unit of work, calibrated by bench/template.bench.ts. */
export const RATE = {
  length: 1 / 12,
  lengthSurrogates: 1 / 6,
  stringCopy: 1 / 32,
  stringSearch: 1 / 16,
  stringSlice: 1 / 6,
  split: 1 / 8,
  splitPart: 1,
  joinPart: 1,
  arraySearch: 1 / 4,
  arrayCopy: 1 / 4,
  arrayGuard: 1 / 4,
  sum: 1 / 4,
  flatPart: 1,
  flatItem: 1 / 2,
  mergeEntry: 24,
  fromEntry: 16,
  objectKey: 1 / 16,
  collectionItem: 1,
} as const;

/** What a compiled expression reads and spends: one value per slot, and the steps left. */
export type Frame = { slots: unknown[]; steps: number };
export type Fn = (frame: Frame) => unknown;

/** Thrown by a compiled expression; `evaluate` and `renderTemplate` turn it into a `LiveframeError`. */
export class ExprFailure extends Error {
  readonly error: LiveframeError;
  constructor(error: LiveframeError) {
    super(error.message);
    this.name = "ExprFailure";
    this.error = error;
  }
}

export function fail(
  pointer: string,
  message: string,
  kind: LiveframeError["kind"] = "invalid-prop",
  expected?: string,
): never {
  throw new ExprFailure({ kind, pointer, message, ...(expected === undefined ? {} : { expected }) });
}

function outOfFuel(pointer: string): never {
  return fail(pointer, "Evaluation exceeded the step limit", "limit-exceeded", "a template that fits limits.steps");
}

export const tick = (f: Frame, p: string) => {
  if (--f.steps < 0) outOfFuel(p);
};

/** Pay for sized work from the same budget as expression nodes. */
export const charge = (f: Frame, p: string, units: number, rate: number) => {
  f.steps -= Math.ceil(units * rate);
  if (f.steps < 0) outOfFuel(p);
};

export type Checks = ReturnType<typeof documentChecks>;
export type Typed = { readonly type: ExprType; readonly run: Fn };

export const BAD: Typed = {
  type: DYNAMIC,
  run: () => {
    throw new Error("An expression with errors was run");
  },
};

// Operand kinds. A trailing "?" accepts an absent operand.
type Base =
  | "num"
  | "int"
  | "str"
  | "bool"
  | "arr"
  | "obj"
  | "scalar"
  | "strOrArr"
  | "strArr"
  | "numArr"
  | "arrArr"
  | "any";
export type Kind = Base | `${Base}?`;
export type Plain = Exclude<LanguageSchema, { readonly discriminator: string }>;

const EXPECT: Record<Base, string> = {
  num: "a number",
  int: "an integer",
  str: "a string",
  bool: "a boolean",
  arr: "an array",
  obj: "an object",
  scalar: "a string, number, boolean or null",
  strOrArr: "a string or an array",
  strArr: "an array of strings",
  numArr: "an array of numbers",
  arrArr: "an array of arrays",
  any: "a present value",
};

export const plain = (s: LanguageSchema, test: (p: Plain) => boolean) => !("discriminator" in s) && test(s);
export const isNum = (s: LanguageSchema) =>
  plain(s, (p) => (p.type === "number" || p.type === "integer") && p.nullable !== true);
export const isStr = (s: LanguageSchema) => plain(s, (p) => p.type === "string" && p.nullable !== true);
const isArr = (s: LanguageSchema) => plain(s, (p) => p.type === "array" && p.nullable !== true);

/** Static kind tests on a present, non-null schema. */
const SCHEMA_KIND: Record<Base, (s: Plain) => boolean> = {
  num: (s) => s.type === "number" || s.type === "integer",
  int: (s) => s.type === "integer",
  str: (s) => s.type === "string",
  bool: (s) => s.type === "boolean",
  arr: (s) => s.type === "array",
  obj: (s) => s.type === "object",
  scalar: (s) => s.type === "string" || s.type === "number" || s.type === "integer" || s.type === "boolean",
  strOrArr: (s) => s.type === "string" || s.type === "array",
  strArr: (s) => s.type === "array" && isStr(s.items),
  numArr: (s) => s.type === "array" && isNum(s.items),
  arrArr: (s) => s.type === "array" && isArr(s.items),
  any: () => true,
};

const isScalar = (v: unknown) => v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
const isObject = (v: unknown) => v !== null && typeof v === "object" && !Array.isArray(v);
const everyOf = (v: unknown, test: (x: unknown) => boolean) => Array.isArray(v) && v.every(test);

/** Runtime kind tests, for operands whose static type is dynamic. */
const VALUE_KIND: Record<Base, (v: unknown) => boolean> = {
  num: (v) => typeof v === "number",
  int: (v) => Number.isInteger(v),
  str: (v) => typeof v === "string",
  bool: (v) => typeof v === "boolean",
  arr: (v) => Array.isArray(v),
  obj: isObject,
  scalar: isScalar,
  strOrArr: (v) => typeof v === "string" || Array.isArray(v),
  strArr: (v) => everyOf(v, (x) => typeof x === "string"),
  numArr: (v) => everyOf(v, (x) => typeof x === "number"),
  arrArr: (v) => everyOf(v, Array.isArray),
  any: (v) => v !== absent,
};

const baseOf = (kind: Kind): Base => (kind.endsWith("?") ? (kind.slice(0, -1) as Base) : (kind as Base));

/** Why an operand of type `t` cannot be of `kind`, or undefined when it can. */
export function kindProblem(t: ExprType, kind: Kind): string | undefined {
  const optional = kind.endsWith("?");
  const base = baseOf(kind);
  const s = t.schema;
  if (s === "dynamic") return;
  if (s === "absent") return optional ? undefined : PRESENT;
  if (t.optional && !optional) return PRESENT;
  const wide = base === "scalar" || base === "any";
  if (s === "null") return wide ? undefined : EXPECT[base];
  if (s.nullable === true && !wide) return EXPECT[base];
  if ("discriminator" in s) return base === "obj" || base === "any" ? undefined : EXPECT[base];
  return SCHEMA_KIND[base](s) ? undefined : EXPECT[base];
}

/** Wraps an operand whose type is only known at render with a check of the value it produces. */
export function guard(fn: Fn, kind: Kind, p: string): Fn {
  const base = baseOf(kind);
  const optional = kind.endsWith("?");
  const test = VALUE_KIND[base];
  return (f) => {
    const v = fn(f);
    if ((base === "strArr" || base === "numArr" || base === "arrArr") && Array.isArray(v))
      charge(f, p, v.length, RATE.arrayGuard);
    if (v === absent ? !optional : !test(v)) fail(p, `Expected ${EXPECT[base]}`, "invalid-prop", EXPECT[base]);
    return v;
  };
}

export const lang = (t: ExprType): LanguageSchema | undefined => (typeof t.schema === "string" ? undefined : t.schema);
export const BOOL = typeOf({ type: "boolean" });
export const NUM = typeOf({ type: "number" });
export const INT = typeOf({ type: "integer" });
export const STR = typeOf({ type: "string", maxLength: MAX_STRING });
export const isInteger = (t: ExprType) =>
  lang(t) !== undefined && plain(lang(t) as LanguageSchema, (p) => p.type === "integer");
export const arrayOf = (items: LanguageSchema, maxItems: number) => typeOf({ type: "array", items, maxItems });
export const itemsOf = (t: ExprType): LanguageSchema | undefined => {
  const s = lang(t);
  return s && plain(s, (p) => p.type === "array") ? (s as Extract<Plain, { type: "array" }>).items : undefined;
};
