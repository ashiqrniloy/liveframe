// The eager operators: each evaluates all its operands, then applies one function to their values.
import type { LanguageSchema } from "../../schema.ts";
import {
  absent,
  DYNAMIC,
  type ExprType,
  joinSchemas,
  MAX_ITEMS,
  MAX_STRING,
  type ObjectSchema,
  typeOf,
} from "../scope.ts";
import {
  arrayOf,
  BOOL,
  charge,
  type Frame,
  fail,
  INT,
  isInteger,
  isNum,
  isStr,
  itemsOf,
  type Kind,
  lang,
  NUM,
  type Plain,
  plain,
  RATE,
  STR,
} from "./types.ts";

function pointWidth(text: string, i: number): number {
  return (text.charCodeAt(i) & 0xfc00) === 0xd800 && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00 ? 2 : 1;
}

function codePoints(text: string, f: Frame, p: string): number {
  charge(f, p, text.length, RATE.length);
  const start = text.search(/[\ud800-\udbff]/);
  if (start < 0) return text.length;
  charge(f, p, text.length - start, RATE.lengthSurrogates);
  let count = start;
  for (let i = start; i < text.length; i++, count++) {
    if ((text.charCodeAt(i) & 0xfc00) === 0xd800 && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) i++;
  }
  return count;
}

function equal(a: unknown, b: unknown, f: Frame, p: string): boolean {
  if (typeof a === "string" && typeof b === "string" && a.length === b.length)
    charge(f, p, a.length + b.length, RATE.stringSearch);
  return a === b;
}

function finite(x: number, p: string): number {
  if (!Number.isFinite(x)) fail(p, "Arithmetic result is not a finite number");
  return x === 0 ? 0 : x;
}

const POW10 = [1, 10, 100, 1e3, 1e4, 1e5, 1e6] as const;
const cap = (length: number, limit: number, p: string, what: string) => {
  if (length > limit) fail(p, `${what} exceeds ${limit}`, "limit-exceeded", `at most ${limit}`);
};

export type Eager = {
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

export const EAGER: Readonly<Record<string, Eager>> = {
  $eq: { args: ["scalar?", "scalar?"], type: () => BOOL, run: ([a, b], f, p) => equal(a, b, f, p) },
  $ne: { args: ["scalar?", "scalar?"], type: () => BOOL, run: ([a, b], f, p) => !equal(a, b, f, p) },
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
      return codePoints(a, f, p);
    },
  },
  $concat: {
    rest: "str",
    min: 2,
    type: () => STR,
    run: (v, f, p) => {
      charge(f, p, v.length, RATE.joinPart);
      let total = 0;
      for (const part of v) total += (part as string).length;
      cap(total, MAX_STRING, p, "A string");
      charge(f, p, total * 2, RATE.stringCopy);
      return (v as readonly string[]).join("");
    },
  },
  $join: {
    args: ["strArr", "str"],
    type: () => STR,
    run: ([list, separator], f, p) => {
      const parts = list as readonly string[];
      charge(f, p, parts.length, RATE.joinPart);
      let total = (separator as string).length * Math.max(parts.length - 1, 0);
      for (const part of parts) total += part.length;
      cap(total, MAX_STRING, p, "A string");
      charge(f, p, total * 2, RATE.stringCopy);
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
        charge(f, p, a.length + b.length, RATE.stringSearch);
        return a.includes(b);
      }
      const items = a as readonly unknown[];
      charge(f, p, items.length, RATE.arraySearch);
      if (typeof b !== "string") return items.includes(b);
      for (const item of items) {
        if (equal(item, b, f, p)) return true;
      }
      return false;
    },
  },
  $split: {
    args: ["str", "str"],
    check: ([, separator], bad) => {
      if (typeof separator?.literal !== "string" || separator.literal === "") bad(1, "a non-empty literal string");
    },
    type: () => arrayOf({ type: "string", maxLength: MAX_STRING }, MAX_ITEMS),
    run: ([source, separator], f, p) => {
      const text = source as string;
      const delimiter = separator as string;
      charge(f, p, text.length * 2 + delimiter.length, RATE.split);
      // Reserve the largest result the native split can allocate.
      charge(f, p, Math.min(MAX_ITEMS + 1, Math.floor(text.length / delimiter.length) + 1), RATE.splitPart);
      const parts = text.split(delimiter, MAX_ITEMS + 1);
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
      const from = start as number;
      const to = end === undefined || end === absent ? Infinity : (end as number);
      if (from < 0 || to < 0) fail(p, "Expected non-negative slice indexes");
      if (typeof source !== "string") {
        const items = source as readonly unknown[];
        const taken = Math.max(0, Math.min(items.length, to) - from);
        charge(f, p, taken * 2, RATE.arrayCopy);
        return items.slice(from, to);
      }
      if (from >= to || from >= source.length) return "";
      const scanned = Math.min(source.length, to * 2);
      const taken = Math.min(source.length - from, (to - from) * 2);
      charge(f, p, scanned + taken, RATE.stringSlice);
      let i = 0;
      let last = 0;
      for (; i < from && last < source.length; i++) last += pointWidth(source, last);
      const first = last;
      for (; i < to && last < source.length; i++) last += pointWidth(source, last);
      return source.slice(first, last);
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
      charge(f, p, (list as unknown[]).length, RATE.sum);
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
      const parts = list as readonly unknown[][];
      charge(f, p, parts.length, RATE.flatPart);
      let total = 0;
      for (const part of parts) total += part.length;
      cap(total, MAX_ITEMS, p, "An array");
      charge(f, p, total * 2, RATE.flatItem);
      const out: unknown[] = [];
      for (const part of parts) for (const item of part) out.push(item);
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
      charge(f, p, v.length, RATE.joinPart);
      const entries: [string, unknown][] = [];
      for (const value of v) {
        const object = value as Record<string, unknown>;
        const keys = Object.keys(object);
        charge(f, p, keys.length, RATE.mergeEntry);
        for (const key of keys) {
          charge(f, p, key.length, RATE.objectKey);
          entries.push([key, object[key]]);
        }
      }
      return Object.fromEntries(entries);
    },
  },
  $fromEntries: {
    single: true,
    args: ["arr"],
    type: () => DYNAMIC,
    run: ([list], f, p) => {
      const items = list as readonly unknown[];
      charge(f, p, items.length, RATE.fromEntry);
      const entries: [string, unknown][] = [];
      for (const entry of items) {
        const [key, value] = Array.isArray(entry) && entry.length >= 1 && entry.length <= 2 ? entry : [];
        if (typeof key !== "string" || key === "__proto__")
          fail(
            p,
            "Expected each entry to be [key] or [key, value] with a string key",
            "invalid-prop",
            "[string, value] entries",
          );
        if ((entry as unknown[]).length === 2) {
          charge(f, p, key.length, RATE.objectKey);
          entries.push([key, value]);
        }
      }
      return Object.fromEntries(entries);
    },
  },
};
