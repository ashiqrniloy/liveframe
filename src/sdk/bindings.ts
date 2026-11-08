// Authoring helpers for a node's `when` and `bind` (plan 029 B13). They build plain JSON expressions of the
// template language's browser subset: `local` and `self` are the only roots, so an expression can read
// nothing the widget did not put in the tree. A bare JS string, number or boolean is a literal operand.

import { setLocal } from "./intents.ts";
import type { Json } from "./types.ts";

/** A tree expression: JSON the renderer evaluates, never code. */
export type Expr = Json;

const path = (root: string, name: string): Expr => Object.freeze({ $path: `${root}.${name}` });

function freeze<T extends object>(value: T): T {
  return Object.freeze(value);
}

/** `local("q")` reads the surface's local state; `local.set("q")` writes it from an event. */
export const local = Object.assign((key: string): Expr => path("local", key), { set: setLocal });

/** `self("title")` reads one of the node's own props as sent in the tree. */
export const self = (prop: string): Expr => path("self", prop);

const list =
  (name: string) =>
  (...operands: readonly Expr[]) =>
    freeze({ [name]: operands });
const pair = (name: string) => (a: Expr, b: Expr) => freeze({ [name]: [a, b] });
const one = (name: string) => (operand: Expr) => freeze({ [name]: operand });

/** One builder per operator a tree expression may use (spec §9). */
export const ex = Object.freeze({
  lit: one("$lit"),
  omit: () => freeze({ $omit: null }),
  has: one("$has"),
  eq: pair("$eq"),
  ne: pair("$ne"),
  lt: pair("$lt"),
  lte: pair("$lte"),
  gt: pair("$gt"),
  gte: pair("$gte"),
  and: list("$and"),
  or: list("$or"),
  not: one("$not"),
  cond: (test: Expr, then: Expr, otherwise: Expr) => freeze({ $cond: [test, then, otherwise] }),
  coalesce: list("$coalesce"),
  len: one("$len"),
  concat: list("$concat"),
  text: one("$text"),
  contains: pair("$contains"),
  slice: (text: Expr, from: Expr, to?: Expr) => freeze({ $slice: to === undefined ? [text, from] : [text, from, to] }),
  add: list("$add"),
  sub: pair("$sub"),
  mul: list("$mul"),
  div: pair("$div"),
  round: (value: Expr, digits?: Expr) => freeze({ $round: digits === undefined ? [value] : [value, digits] }),
  get: pair("$get"),
  at: pair("$at"),
});
