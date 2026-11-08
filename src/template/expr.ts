// The template expression language (plan 028, design T5–T13): one table-driven evaluator.
// Checking and compiling are one walk: it infers a type for every node and builds a closure that
// evaluates it. `checkExpression` keeps the type, `compileExpression` keeps the closure, and
// `evaluate` compiles and runs once. No `eval`, no `Function`, no host API, no recursion in evaluation.
import type { LiveframeError, Result } from "../errors.ts";
import { documentChecks } from "../formats/capabilities.ts";
import type { Json } from "../formats/tree.ts";
import { at, freezeCopy } from "../internal.ts";
import { isRecord, type LanguageSchema } from "../schema.ts";
import {
  arrayType,
  assume,
  bindName,
  constantType,
  DYNAMIC,
  dynamicScope,
  type ExprType,
  joinSchemas,
  joinTypes,
  MAX_ITEMS,
  MAX_STRING,
  nameProblem,
  narrowedBy,
  type ObjectSchema,
  objectType,
  PRESENT,
  type Restriction,
  resolvePath,
  type Scope,
  typeOf,
} from "./scope.ts";

/** Bounds checked at install (design T10) and enforced at render (T11). */
export const EXPR_LIMITS = {
  depth: 32,
  nodes: 20_000,
  bindings: 32,
  steps: 1_000_000,
  stringUnits: MAX_STRING,
  arrayItems: MAX_ITEMS,
} as const;

/** The value of a missing optional: never JSON, never an array member or object property. */
export const absent: unique symbol = Symbol("liveframe.absent");
export type Absent = typeof absent;

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

function fail(
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

const tick = (f: Frame, p: string) => {
  if (--f.steps < 0) outOfFuel(p);
};

/** Linear-time operations pay one step per 64 units of input, so loops over big values stay bounded. */
const charge = (f: Frame, p: string, units: number) => {
  if (units < 64) return;
  f.steps -= units >> 6;
  if (f.steps < 0) outOfFuel(p);
};

type Checks = ReturnType<typeof documentChecks>;
export type Typed = { readonly type: ExprType; readonly run: Fn };

const BAD: Typed = {
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
type Kind = Base | `${Base}?`;
type Plain = Exclude<LanguageSchema, { readonly discriminator: string }>;

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

const plain = (s: LanguageSchema, test: (p: Plain) => boolean) => !("discriminator" in s) && test(s);
const isNum = (s: LanguageSchema) =>
  plain(s, (p) => (p.type === "number" || p.type === "integer") && p.nullable !== true);
const isStr = (s: LanguageSchema) => plain(s, (p) => p.type === "string" && p.nullable !== true);
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
function kindProblem(t: ExprType, kind: Kind): string | undefined {
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
function guard(fn: Fn, kind: Kind, p: string): Fn {
  const base = baseOf(kind);
  const optional = kind.endsWith("?");
  const test = VALUE_KIND[base];
  return (f) => {
    const v = fn(f);
    if (v === absent ? !optional : !test(v)) fail(p, `Expected ${EXPECT[base]}`, "invalid-prop", EXPECT[base]);
    return v;
  };
}

const lang = (t: ExprType): LanguageSchema | undefined => (typeof t.schema === "string" ? undefined : t.schema);
const BOOL = typeOf({ type: "boolean" });
const NUM = typeOf({ type: "number" });
const INT = typeOf({ type: "integer" });
const STR = typeOf({ type: "string", maxLength: MAX_STRING });
const isInteger = (t: ExprType) =>
  lang(t) !== undefined && plain(lang(t) as LanguageSchema, (p) => p.type === "integer");
const arrayOf = (items: LanguageSchema, maxItems: number) => typeOf({ type: "array", items, maxItems });
export const itemsOf = (t: ExprType): LanguageSchema | undefined => {
  const s = lang(t);
  return s && plain(s, (p) => p.type === "array") ? (s as Extract<Plain, { type: "array" }>).items : undefined;
};

function codePoints(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++, count++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) i++;
  }
  return count;
}

function finite(x: number, p: string): number {
  if (!Number.isFinite(x)) fail(p, "Arithmetic result is not a finite number");
  return x === 0 ? 0 : x;
}

const POW10 = [1, 10, 100, 1e3, 1e4, 1e5, 1e6] as const;
const cap = (length: number, limit: number, p: string, what: string) => {
  if (length > limit) fail(p, `${what} exceeds ${limit}`, "limit-exceeded", `at most ${limit}`);
};

type Eager = {
  readonly args?: readonly Kind[];
  readonly rest?: Kind;
  /** Fewest operands; defaults to all of `args`. */
  readonly min?: number;
  /** The operand is one expression, not a list. */
  readonly single?: boolean;
  /** Checks that depend on more than one operand type or on constants. */
  readonly check?: (types: readonly ExprType[], bad: (index: number, expected: string) => void) => void;
  readonly type: (types: readonly ExprType[]) => ExprType;
  readonly run: (v: readonly unknown[], f: Frame, p: string) => unknown;
};

const compare = (test: (a: number, b: number) => boolean): Eager => ({
  args: ["num", "num"],
  type: () => BOOL,
  run: ([a, b]) => test(a as number, b as number),
});

const nonNegative = (t: ExprType) => typeof t.literal !== "number" || (Number.isInteger(t.literal) && t.literal >= 0);

const EAGER: Readonly<Record<string, Eager>> = {
  $eq: { args: ["scalar?", "scalar?"], type: () => BOOL, run: ([a, b]) => a === b },
  $ne: { args: ["scalar?", "scalar?"], type: () => BOOL, run: ([a, b]) => a !== b },
  $lt: compare((a, b) => a < b),
  $lte: compare((a, b) => a <= b),
  $gt: compare((a, b) => a > b),
  $gte: compare((a, b) => a >= b),
  $not: { single: true, args: ["bool"], type: () => BOOL, run: ([a]) => !a },

  $len: {
    single: true,
    args: ["strOrArr"],
    type: () => INT,
    run: ([a], f, p) => {
      if (typeof a !== "string") return (a as unknown[]).length;
      charge(f, p, a.length);
      return codePoints(a);
    },
  },
  $concat: {
    rest: "str",
    min: 2,
    type: () => STR,
    run: (v, f, p) => {
      let total = 0;
      for (const part of v) total += (part as string).length;
      cap(total, MAX_STRING, p, "A string");
      charge(f, p, total);
      return (v as readonly string[]).join("");
    },
  },
  $join: {
    args: ["strArr", "str"],
    type: () => STR,
    run: ([list, separator], f, p) => {
      const parts = list as readonly string[];
      let total = (separator as string).length * Math.max(parts.length - 1, 0);
      for (const part of parts) total += part.length;
      cap(total, MAX_STRING, p, "A string");
      charge(f, p, total);
      return parts.join(separator as string);
    },
  },
  $text: { single: true, args: ["scalar"], type: () => STR, run: ([a]) => String(a) },
  $contains: {
    args: ["strOrArr", "scalar"],
    check: ([first], bad) => {
      const items = first && itemsOf(first);
      if (items && !isStr(items) && !isNum(items) && !plain(items, (p) => p.type === "boolean"))
        bad(0, "an array of strings, numbers or booleans");
    },
    type: () => BOOL,
    run: ([a, b], f, p) => {
      if (typeof a === "string") {
        if (typeof b !== "string") fail(p, "Expected a string to search for", "invalid-prop", "a string");
        charge(f, p, a.length);
        return a.includes(b);
      }
      charge(f, p, (a as unknown[]).length);
      return (a as unknown[]).includes(b);
    },
  },
  $split: {
    args: ["str", "str"],
    check: ([, separator], bad) => {
      if (typeof separator?.literal !== "string" || separator.literal === "") bad(1, "a non-empty literal string");
    },
    type: () => arrayOf({ type: "string", maxLength: MAX_STRING }, MAX_ITEMS),
    run: ([text, separator], f, p) => {
      charge(f, p, (text as string).length);
      const parts = (text as string).split(separator as string);
      cap(parts.length, MAX_ITEMS, p, "An array");
      return parts;
    },
  },
  $slice: {
    args: ["strOrArr", "int", "int"],
    min: 2,
    check: (types, bad) => {
      for (const i of [1, 2]) {
        const t = types[i];
        if (t && !nonNegative(t)) bad(i, "a non-negative integer");
      }
    },
    type: ([first]) => {
      const s = lang(first as ExprType);
      if (!s) return DYNAMIC;
      return plain(s, (p) => p.type === "string") ? STR : typeOf(s);
    },
    run: ([source, start, end], f, p) => {
      const to = end === undefined || end === absent ? undefined : (end as number);
      if ((start as number) < 0 || (to !== undefined && to < 0)) fail(p, "Expected non-negative slice indexes");
      if (typeof source !== "string") {
        charge(f, p, (source as unknown[]).length);
        return (source as unknown[]).slice(start as number, to);
      }
      charge(f, p, source.length);
      return Array.from(source)
        .slice(start as number, to)
        .join("");
    },
  },

  $add: {
    rest: "num",
    min: 2,
    type: (types) => (types.every(isInteger) ? INT : NUM),
    run: (v, _f, p) =>
      finite(
        (v as readonly number[]).reduce((sum, x) => sum + x),
        p,
      ),
  },
  $mul: {
    rest: "num",
    min: 2,
    type: (types) => (types.every(isInteger) ? INT : NUM),
    run: (v, _f, p) =>
      finite(
        (v as readonly number[]).reduce((product, x) => product * x),
        p,
      ),
  },
  $sub: {
    args: ["num", "num"],
    type: (types) => (types.every(isInteger) ? INT : NUM),
    run: ([a, b], _f, p) => finite((a as number) - (b as number), p),
  },
  $div: {
    args: ["num", "num"],
    type: () => NUM,
    run: ([a, b], _f, p) => {
      if (b === 0) fail(p, "Division by zero");
      return finite((a as number) / (b as number), p);
    },
  },
  $round: {
    args: ["num", "int"],
    min: 1,
    check: ([, digits], bad) => {
      if (digits && typeof digits.literal === "number" && !(digits.literal >= 0 && digits.literal <= 6))
        bad(1, "an integer from 0 to 6");
    },
    type: ([, digits]) => (digits === undefined || digits.literal === 0 ? INT : NUM),
    run: ([x, digits], _f, p) => {
      const d = digits === undefined ? 0 : (digits as number);
      if (!(d >= 0 && d <= 6)) fail(p, "Expected digits from 0 to 6", "invalid-prop", "an integer from 0 to 6");
      const scale = POW10[d] as number;
      const n = x as number;
      return finite((Math.sign(n) * Math.floor(Math.abs(n) * scale + 0.5)) / scale, p);
    },
  },
  $sum: {
    single: true,
    args: ["numArr"],
    type: ([list]) => {
      const items = itemsOf(list as ExprType);
      return items && plain(items, (p) => p.type === "integer") ? INT : NUM;
    },
    run: ([list], f, p) => {
      charge(f, p, (list as unknown[]).length);
      return finite(
        (list as readonly number[]).reduce((sum, x) => sum + x, 0),
        p,
      );
    },
  },

  $flat: {
    single: true,
    args: ["arrArr"],
    type: ([list]) => {
      const inner = itemsOf(list as ExprType);
      const items =
        inner && plain(inner, (p) => p.type === "array")
          ? (inner as Extract<Plain, { type: "array" }>).items
          : undefined;
      return items ? arrayOf(items, MAX_ITEMS) : DYNAMIC;
    },
    run: ([list], f, p) => {
      let total = 0;
      for (const part of list as readonly unknown[][]) total += part.length;
      cap(total, MAX_ITEMS, p, "An array");
      charge(f, p, total);
      const out: unknown[] = [];
      for (const part of list as readonly unknown[][]) for (const item of part) out.push(item);
      return out;
    },
  },
  $at: {
    args: ["arr?", "int"],
    type: ([list]) => {
      if ((list as ExprType).schema === "absent") return typeOf("absent", true);
      const items = itemsOf(list as ExprType);
      return items ? typeOf(items, true) : DYNAMIC;
    },
    run: ([list, i]) => {
      if (list === absent) return absent;
      const items = list as readonly unknown[];
      const at = i as number;
      return at >= 0 && at < items.length ? items[at] : absent;
    },
  },
  $get: {
    args: ["obj?", "str"],
    check: ([object, key], bad) => {
      const s = object && lang(object);
      if (s && plain(s, (p) => p.type === "object") && typeof key?.literal === "string") {
        const properties = (s as ObjectSchema).properties;
        if (!Object.hasOwn(properties, key.literal)) bad(1, `one of: ${Object.keys(properties).join(", ")}`);
      }
    },
    type: ([object, key]) => {
      if ((object as ExprType).schema === "absent") return typeOf("absent", true);
      const s = lang(object as ExprType);
      if (!s || !plain(s, (p) => p.type === "object")) return DYNAMIC;
      const properties = (s as ObjectSchema).properties;
      const literal = (key as ExprType).literal;
      if (typeof literal === "string")
        return typeOf(Object.hasOwn(properties, literal) ? (properties[literal] as LanguageSchema) : "absent", true);
      const all = Object.values(properties);
      let joined: ReturnType<typeof joinSchemas> = "absent";
      for (const schema of all) joined = joinSchemas(joined, schema);
      return typeOf(joined, true);
    },
    run: ([object, key]) =>
      object === absent || !Object.hasOwn(object as object, key as string)
        ? absent
        : (object as Record<string, unknown>)[key as string],
  },
  $merge: {
    rest: "obj",
    min: 2,
    type: (types) => {
      const objects = types.map(lang);
      const properties = new Map<string, LanguageSchema>();
      const required = new Set<string>();
      for (const o of objects) {
        if (!o || !plain(o, (p) => p.type === "object")) return DYNAMIC;
        for (const [key, schema] of Object.entries((o as ObjectSchema).properties)) {
          const before = properties.get(key);
          const joined = before ? joinSchemas(before, schema) : schema;
          if (typeof joined === "string") return DYNAMIC;
          properties.set(key, joined);
        }
        for (const key of (o as ObjectSchema).required) required.add(key);
      }
      return typeOf({
        type: "object",
        properties: Object.fromEntries(properties),
        required: [...required],
        additionalProperties: false,
      });
    },
    run: (v, f, p) => {
      const entries = (v as readonly object[]).flatMap((o) => Object.entries(o));
      charge(f, p, entries.length);
      return Object.fromEntries(entries);
    },
  },
  $fromEntries: {
    single: true,
    args: ["arr"],
    type: () => DYNAMIC,
    run: ([list], f, p) => {
      charge(f, p, (list as unknown[]).length);
      const entries: [string, unknown][] = [];
      for (const entry of list as readonly unknown[]) {
        const [key, value] = Array.isArray(entry) && entry.length >= 1 && entry.length <= 2 ? entry : [];
        if (typeof key !== "string" || key === "__proto__")
          fail(
            p,
            "Expected each entry to be [key] or [key, value] with a string key",
            "invalid-prop",
            "[string, value] entries",
          );
        if ((entry as unknown[]).length === 2) entries.push([key, value]);
      }
      return Object.fromEntries(entries);
    },
  },
};

type Special = (operand: unknown, scope: Scope, base: string, depth: number, c: Checks) => Typed;

const sub = (expr: unknown, scope: Scope, pointer: string, depth: number, c: Checks) =>
  analyze(expr, scope, pointer, depth + 1, c);

/** Rejects a missing or unknown key of an operator's object operand. */
function exactKeys(operand: unknown, p: string, required: readonly string[], optional: readonly string[], c: Checks) {
  if (!isRecord(operand)) {
    c.reject(p, "Expected an object operand", "invalid-document", `an object with ${required.join(", ")}`);
    return false;
  }
  let ok = true;
  for (const key of Object.keys(operand))
    if (!required.includes(key) && !optional.includes(key)) {
      c.reject(
        at(p, key),
        `Unknown key "${key}"`,
        "invalid-document",
        `one of: ${[...required, ...optional].join(", ")}`,
      );
      ok = false;
    }
  for (const key of required)
    if (!Object.hasOwn(operand, key)) {
      c.reject(at(p, key), `Missing "${key}"`, "invalid-document", `an object with ${required.join(", ")}`);
      ok = false;
    }
  return ok;
}

/** An operand list of the right length, or undefined after reporting. */
function listOf(operand: unknown, p: string, min: number, max: number, c: Checks): readonly unknown[] | undefined {
  if (!Array.isArray(operand) || operand.length < min || operand.length > max) {
    const expected =
      min === max
        ? `a list of ${min} operands`
        : `a list of ${min}${max === Infinity ? " or more" : `–${max}`} operands`;
    c.reject(p, `Expected ${expected}`, "invalid-document", expected);
    return undefined;
  }
  return operand;
}

/** Analyses an operand and reports when it cannot be of `kind`. */
function operand(expr: unknown, kind: Kind, scope: Scope, pointer: string, depth: number, c: Checks): Typed {
  const typed = sub(expr, scope, pointer, depth, c);
  const problem = kindProblem(typed.type, kind);
  if (problem) {
    c.reject(pointer, `Expected ${problem}`, "invalid-prop", problem);
    return BAD;
  }
  return typed.type.schema === "dynamic" ? { type: typed.type, run: guard(typed.run, kind, pointer) } : typed;
}

function eagerNode(
  name: string,
  def: Eager,
  raw: unknown,
  scope: Scope,
  base: string,
  depth: number,
  c: Checks,
): Typed {
  const p = at(base, name);
  let exprs: readonly unknown[];
  let pointers: string[];
  if (def.single) {
    exprs = [raw];
    pointers = [p];
  } else {
    const fixed = def.args?.length ?? 0;
    const list = listOf(raw, p, def.min ?? fixed, def.rest ? Infinity : fixed, c);
    if (!list) return BAD;
    exprs = list;
    pointers = list.map((_, i) => at(p, i));
  }
  const kindAt = (i: number) => (def.args?.[i] ?? def.rest) as Kind;
  const errors = c.errors.length;
  const typed = exprs.map((e, i) => sub(e, scope, pointers[i] as string, depth, c));
  let ok = true;
  typed.forEach((t, i) => {
    const problem = kindProblem(t.type, kindAt(i));
    if (problem) {
      c.reject(pointers[i] as string, `Expected ${problem}`, "invalid-prop", problem);
      ok = false;
    }
  });
  if (!ok || c.errors.length > errors) return BAD;
  const types = typed.map((t) => t.type);
  def.check?.(types, (i, expected) => {
    c.reject(pointers[i] as string, `Expected ${expected}`, "invalid-prop", expected);
    ok = false;
  });
  if (!ok) return BAD;
  const fns = typed.map((t, i) =>
    t.type.schema === "dynamic" ? guard(t.run, kindAt(i), pointers[i] as string) : t.run,
  );
  const run = def.run;
  const type = def.type(types);
  const [a, b] = fns;
  if (a && fns.length === 1)
    return {
      type,
      run: (f) => {
        tick(f, p);
        return run([a(f)], f, p);
      },
    };
  if (a && b && fns.length === 2)
    return {
      type,
      run: (f) => {
        tick(f, p);
        return run([a(f), b(f)], f, p);
      },
    };
  return {
    type,
    run: (f) => {
      tick(f, p);
      const values = new Array<unknown>(fns.length);
      for (let i = 0; i < fns.length; i++) values[i] = (fns[i] as Fn)(f);
      return run(values, f, p);
    },
  };
}

const SPECIAL: Readonly<Record<string, Special>> = {
  $path(raw, scope, base, _depth, c) {
    const p = at(base, "$path");
    if (typeof raw !== "string") {
      c.reject(p, "Expected a path string", "invalid-document", 'a dotted path like "data.queue.rows"');
      return BAD;
    }
    const found = resolvePath(scope, raw);
    if (!found.ok) {
      c.reject(p, found.message, found.kind, found.expected);
      return BAD;
    }
    const { slot, segments } = found;
    const keys = segments.map(String);
    const indexes = segments.map((s) => (typeof s === "number" ? s : -1));
    const n = segments.length;
    return {
      type: found.type,
      run: (f) => {
        tick(f, p);
        let v = f.slots[slot];
        for (let i = 0; i < n; i++) {
          if (v === null || typeof v !== "object") return absent;
          if (Array.isArray(v)) {
            const j = indexes[i] as number;
            if (j < 0 || j >= v.length) return absent;
            v = v[j];
          } else {
            if (!Object.hasOwn(v, keys[i] as string)) return absent;
            v = (v as Record<string, unknown>)[keys[i] as string];
          }
        }
        return v;
      },
    };
  },

  $lit(raw, scope, base, depth, c) {
    const p = at(base, "$lit");
    const problem = literalProblem(raw, depth, scope);
    if (problem) {
      c.reject(p, problem[1], problem[0], problem[0] === "limit-exceeded" ? "a smaller literal" : "a JSON value");
      return BAD;
    }
    const value = freezeCopy(raw as Json);
    return {
      type: constantType(raw as Json),
      run: (f) => {
        tick(f, p);
        return value;
      },
    };
  },

  $ref(raw, scope, base, _depth, c) {
    const p = at(base, "$ref");
    if (typeof raw !== "string" || raw === "" || raw.length > 128) {
      c.reject(p, "Expected an anchor name", "invalid-document", "a non-empty anchor name");
      return BAD;
    }
    scope.budget.refs.push({ anchor: raw, pointer: p });
    const value = Object.freeze({ $ref: raw });
    const type = typeOf({
      type: "object",
      properties: { $ref: { type: "string", maxLength: 128, enum: [raw] } },
      required: ["$ref"],
      additionalProperties: false,
    });
    return {
      type,
      run: (f) => {
        tick(f, p);
        return value;
      },
    };
  },

  $omit(raw, _scope, base, _depth, c) {
    const p = at(base, "$omit");
    if (raw !== null) {
      c.reject(p, "Expected null", "invalid-document", "null");
      return BAD;
    }
    return {
      type: typeOf("absent", true),
      run: (f) => {
        tick(f, p);
        return absent;
      },
    };
  },

  $has(raw, scope, base, depth, c) {
    const p = at(base, "$has");
    const inner = sub(raw, scope, p, depth, c);
    return {
      type: BOOL,
      run: (f) => {
        tick(f, p);
        return inner.run(f) !== absent;
      },
    };
  },

  $cond(raw, scope, base, depth, c) {
    const p = at(base, "$cond");
    const list = listOf(raw, p, 3, 3, c);
    if (!list) return BAD;
    const test = operand(list[0], "bool", scope, at(p, 0), depth, c);
    const then = sub(list[1], assume(scope, narrowedBy(list[0])), at(p, 1), depth, c);
    const otherwise = sub(list[2], scope, at(p, 2), depth, c);
    const [t, y, n] = [test.run, then.run, otherwise.run];
    return {
      type: joinTypes(then.type, otherwise.type),
      run: (f) => {
        tick(f, p);
        return t(f) === true ? y(f) : n(f);
      },
    };
  },

  $coalesce(raw, scope, base, depth, c) {
    const p = at(base, "$coalesce");
    const list = listOf(raw, p, 2, Infinity, c);
    if (!list) return BAD;
    const typed = list.map((e, i) => sub(e, scope, at(p, i), depth, c));
    const fns = typed.map((t) => t.run);
    let type = typed[0]?.type as ExprType;
    for (const t of typed.slice(1)) type = joinTypes(type, t.type);
    // The result is absent only when every operand is.
    type = typeOf(
      type.schema,
      typed.every((t) => t.type.optional || t.type.schema === "absent"),
    );
    return {
      type,
      run: (f) => {
        tick(f, p);
        for (const fn of fns) {
          const v = fn(f);
          if (v !== absent) return v;
        }
        return absent;
      },
    };
  },

  $and: (raw, scope, base, depth, c) => logic("$and", raw, scope, base, depth, c),
  $or: (raw, scope, base, depth, c) => logic("$or", raw, scope, base, depth, c),

  $let(raw, scope, base, depth, c) {
    const p = at(base, "$let");
    if (!exactKeys(raw, p, ["bind", "in"], [], c)) return BAD;
    const spec = raw as Record<string, unknown>;
    const list = listOf(spec.bind, at(p, "bind"), 1, EXPR_LIMITS.bindings, c);
    if (!list) return BAD;
    let inner = scope;
    const slots: number[] = [];
    const values: Fn[] = [];
    for (const [i, entry] of list.entries()) {
      const ep = at(at(p, "bind"), i);
      if (!exactKeys(entry, ep, ["as", "value"], [], c)) return BAD;
      const item = entry as Record<string, unknown>;
      const value = sub(item.value, inner, at(ep, "value"), depth, c);
      const problem = nameProblem(item.as, inner);
      if (problem) {
        c.reject(at(ep, "as"), `Cannot bind "${String(item.as)}"`, "invalid-document", problem);
        return BAD;
      }
      inner = bindName(inner, item.as as string, value.type);
      slots.push(inner.names.get(item.as as string)?.slot as number);
      values.push(value.run);
    }
    const body = sub(spec.in, inner, at(p, "in"), depth, c);
    return {
      type: body.type,
      run: (f) => {
        tick(f, p);
        for (let i = 0; i < slots.length; i++) f.slots[slots[i] as number] = (values[i] as Fn)(f);
        return body.run(f);
      },
    };
  },

  $filter: (raw, scope, base, depth, c) => iterate("$filter", raw, scope, base, depth, c),
  $map: (raw, scope, base, depth, c) => iterate("$map", raw, scope, base, depth, c),
  $findIndex: (raw, scope, base, depth, c) => iterate("$findIndex", raw, scope, base, depth, c),
};

/** Every operator the language defines. */
export const OPERATORS: readonly string[] = [...Object.keys(SPECIAL), ...Object.keys(EAGER)];

/** `$and` / `$or`: boolean operands, evaluated left to right until the answer is known. */
function logic(name: "$and" | "$or", raw: unknown, scope: Scope, base: string, depth: number, c: Checks): Typed {
  const p = at(base, name);
  const list = listOf(raw, p, 2, Infinity, c);
  if (!list) return BAD;
  const fns: Fn[] = [];
  let seen = scope;
  list.forEach((e, i) => {
    fns.push(operand(e, "bool", seen, at(p, i), depth, c).run);
    // Later operands of `$and` run only when the earlier ones were true.
    if (name === "$and") seen = assume(seen, narrowedBy(e));
  });
  const stop = name === "$or";
  return {
    type: BOOL,
    run: (f) => {
      tick(f, p);
      for (const fn of fns) if ((fn(f) === true) === stop) return stop;
      return !stop;
    },
  };
}

/** `$filter`, `$map` and `$findIndex` over an input array, binding the item (and optionally its index). */
function iterate(
  name: "$filter" | "$map" | "$findIndex",
  raw: unknown,
  scope: Scope,
  base: string,
  depth: number,
  c: Checks,
): Typed {
  const p = at(base, name);
  const body = name === "$map" ? "value" : "where";
  if (!exactKeys(raw, p, ["in", "as", body], ["index"], c)) return BAD;
  const spec = raw as Record<string, unknown>;
  const source = operand(spec.in, "arr", scope, at(p, "in"), depth, c);
  const itemSchema = itemsOf(source.type);
  let inner = scope;
  let itemSlot = -1;
  let indexSlot = -1;
  for (const [key, type] of [
    ["as", itemSchema ? typeOf(itemSchema) : DYNAMIC],
    ["index", typeOf({ type: "integer", minimum: 0 })],
  ] as const) {
    if (key === "index" && !Object.hasOwn(spec, "index")) continue;
    const problem = nameProblem(spec[key], inner);
    if (problem) {
      c.reject(at(p, key), `Cannot bind "${String(spec[key])}"`, "invalid-document", problem);
      return BAD;
    }
    inner = bindName(inner, spec[key] as string, type);
    const slot = inner.names.get(spec[key] as string)?.slot as number;
    if (key === "as") itemSlot = slot;
    else indexSlot = slot;
  }
  const result = operand(spec[body], name === "$map" ? "any" : "bool", inner, at(p, body), depth, c);
  if (source === BAD || result === BAD) return BAD;
  const [list, test] = [source.run, result.run];
  const bind = (f: Frame, item: unknown, i: number) => {
    f.slots[itemSlot] = item;
    if (indexSlot >= 0) f.slots[indexSlot] = i;
  };
  if (name === "$findIndex")
    return {
      type: INT,
      run: (f) => {
        tick(f, p);
        const items = list(f) as readonly unknown[];
        for (let i = 0; i < items.length; i++) {
          bind(f, items[i], i);
          if (test(f) === true) return i;
        }
        return -1;
      },
    };
  if (name === "$filter")
    return {
      type: typeOf(lang(source.type) ?? "dynamic"),
      run: (f) => {
        tick(f, p);
        const items = list(f) as readonly unknown[];
        const out: unknown[] = [];
        for (let i = 0; i < items.length; i++) {
          bind(f, items[i], i);
          if (test(f) === true) out.push(items[i]);
        }
        return out;
      },
    };
  const outSchema = lang(result.type);
  const bound = (lang(source.type) as Extract<Plain, { type: "array" }> | undefined)?.maxItems ?? MAX_ITEMS;
  return {
    type: outSchema ? arrayOf(outSchema, bound) : DYNAMIC,
    run: (f) => {
      tick(f, p);
      const items = list(f) as readonly unknown[];
      const out = new Array<unknown>(items.length);
      for (let i = 0; i < items.length; i++) {
        bind(f, items[i], i);
        out[i] = test(f);
      }
      return out;
    },
  };
}

const limitsOf = (scope: Scope) => scope.restrict ?? EXPR_LIMITS;

/** Why a `$lit` payload is not a JSON value within bounds, counting its values as expression nodes. */
function literalProblem(value: unknown, depth: number, scope: Scope): [LiveframeError["kind"], string] | undefined {
  const { depth: maxDepth, nodes: maxNodes } = limitsOf(scope);
  if (++scope.budget.nodes > maxNodes) return ["limit-exceeded", `Expected at most ${maxNodes} expression nodes`];
  if (depth > maxDepth) return ["limit-exceeded", `Expected at most ${maxDepth} levels of nesting`];
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number")
    return Number.isFinite(value) ? undefined : ["invalid-document", "Expected a finite number"];
  if (Array.isArray(value)) {
    for (const member of value) {
      const problem = literalProblem(member, depth + 1, scope);
      if (problem) return problem;
    }
    return;
  }
  if (!isRecord(value)) return ["invalid-document", "Expected a JSON value"];
  for (const member of Object.values(value)) {
    const problem = literalProblem(member, depth + 1, scope);
    if (problem) return problem;
  }
}

function constant(value: Json, p: string): Typed {
  return {
    type: constantType(value),
    run: (f) => {
      tick(f, p);
      return value;
    },
  };
}

/**
 * Analyses the expression of an element field, such as a `$if` test or an `$each` source, as an
 * operand of `kind`: the same checks an operator applies to its operands.
 */
export function analyzeOperand(expr: unknown, kind: "bool" | "arr", scope: Scope, pointer: string, c: Checks): Typed {
  return operand(expr, kind, scope, pointer, 1, c);
}

/** Checks and compiles one expression in `scope`, reporting into `c` (shared by `validateTemplate`). */
export function analyzeExpression(expr: unknown, scope: Scope, pointer: string, c: Checks, depth = 1): Typed {
  return analyze(expr, scope, pointer, depth, c);
}

function analyze(expr: unknown, scope: Scope, base: string, depth: number, c: Checks): Typed {
  const limits = limitsOf(scope);
  if (depth > limits.depth) {
    c.reject(
      base,
      `Expected at most ${limits.depth} levels of nesting`,
      "limit-exceeded",
      `at most ${limits.depth} levels`,
    );
    return BAD;
  }
  if (++scope.budget.nodes > limits.nodes) {
    // Reported where the bound is crossed; the nodes after it only repeat the news.
    if (scope.budget.nodes === limits.nodes + 1)
      c.reject(
        base,
        `Expected at most ${limits.nodes} expression nodes`,
        "limit-exceeded",
        `at most ${limits.nodes} nodes`,
      );
    return BAD;
  }
  if (expr === null || typeof expr === "string" || typeof expr === "boolean") return constant(expr, base);
  if (typeof expr === "number") {
    if (Number.isFinite(expr)) return constant(expr, base);
    c.reject(base, "Expected a finite number", "invalid-document", "a finite number");
    return BAD;
  }
  if (Array.isArray(expr)) {
    const typed = expr.map((member, i) => sub(member, scope, at(base, i), depth, c));
    const fns = typed.map((t) => t.run);
    return {
      type: arrayType(typed.map((t) => t.type)),
      run: (f) => {
        tick(f, base);
        const out: unknown[] = [];
        for (const fn of fns) {
          const v = fn(f);
          if (v !== absent) out.push(v);
        }
        return out;
      },
    };
  }
  if (!isRecord(expr)) {
    c.reject(base, "Expected a JSON value", "invalid-document", "a JSON value");
    return BAD;
  }
  const keys = Object.keys(expr);
  const operators = keys.filter((key) => key.startsWith("$"));
  if (!operators.length) return objectConstructor(expr, keys, scope, base, depth, c);
  const name = keys[0] as string;
  if (keys.length !== 1) {
    c.reject(
      base,
      "An operator object has exactly one $-key and nothing else",
      "invalid-document",
      "exactly one $-key",
    );
    return BAD;
  }
  // Only a template's tree expression may hold `$embed`; it is replaced before any expression runs (plan 029 B12).
  if (name === "$embed" && scope.restrict?.operators.has(name))
    return {
      type: DYNAMIC,
      run: () => {
        throw new Error("A $embed was evaluated before its template expanded");
      },
    };
  const known = Object.hasOwn(SPECIAL, name) || Object.hasOwn(EAGER, name);
  if (known && scope.restrict && !scope.restrict.operators.has(name)) {
    c.reject(
      at(base, name),
      `Operator ${name} is not allowed here`,
      "invalid-prop",
      "an operator allowed in a tree expression",
    );
    return BAD;
  }
  if (Object.hasOwn(SPECIAL, name)) return (SPECIAL[name] as Special)(expr[name], scope, base, depth, c);
  if (Object.hasOwn(EAGER, name)) return eagerNode(name, EAGER[name] as Eager, expr[name], scope, base, depth, c);
  c.reject(at(base, name), `Unknown operator ${name}`, "invalid-document", `one of: ${OPERATORS.join(", ")}`);
  return BAD;
}

function objectConstructor(
  expr: Record<string, unknown>,
  keys: readonly string[],
  scope: Scope,
  base: string,
  depth: number,
  c: Checks,
): Typed {
  const typed: (readonly [string, Typed])[] = [];
  for (const key of keys) {
    const pointer = at(base, key);
    if (key === "__proto__") c.reject(pointer, 'The key "__proto__" is not allowed', "invalid-document", "another key");
    else typed.push([key, sub(expr[key], scope, pointer, depth, c)]);
  }
  return {
    type: objectType(typed.map(([key, t]) => [key, t.type])),
    run: (f) => {
      tick(f, base);
      const out: Record<string, unknown> = {};
      for (const [key, t] of typed) {
        const v = t.run(f);
        if (v !== absent) out[key] = v;
      }
      return out;
    },
  };
}

/**
 * Checks an expression against a scope: its inferred type, or the errors at their pointers. `restrict`
 * narrows the language to an operator allow-list and smaller bounds, for expressions a renderer evaluates.
 */
export function checkExpression(expr: unknown, scope: Scope, pointer = "", restrict?: Restriction): Result<ExprType> {
  const c = documentChecks();
  const typed = analyze(expr, restrict ? { ...scope, restrict } : scope, pointer, 1, c);
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: typed.type };
}

/** Checks an expression and returns its closure; run it with a `Frame` whose slots follow the scope. */
export function compileExpression(expr: unknown, scope: Scope, pointer = "", restrict?: Restriction): Result<Fn> {
  const c = documentChecks();
  const typed = analyze(expr, restrict ? { ...scope, restrict } : scope, pointer, 1, c);
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: typed.run };
}

/** Compiles and runs once over named values, all checked when evaluated. */
export function evaluate(
  expr: unknown,
  values: Readonly<Record<string, unknown>>,
  options: { readonly steps?: number } = {},
): Result<Json | Absent> {
  const names = Object.keys(values);
  const scope = dynamicScope(names);
  const compiled = compileExpression(expr, scope);
  if (!compiled.ok) return compiled;
  const slots = new Array<unknown>(scope.budget.slots);
  for (const name of names) slots[scope.names.get(name)?.slot as number] = values[name];
  try {
    return { ok: true, value: compiled.value({ slots, steps: options.steps ?? EXPR_LIMITS.steps }) as Json | Absent };
  } catch (error) {
    if (error instanceof ExprFailure) return { ok: false, errors: [error.error] };
    throw error;
  }
}
