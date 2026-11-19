// The special forms, whose operands are not plain expressions, and the walk that checks and compiles
// every expression node: constants, arrays, object constructors and operators.
import type { LiveframeError } from "../../errors.ts";
import type { Json } from "../../formats/tree.ts";
import { at, freezeCopy } from "../../internal.ts";
import { isRecord } from "../../schema.ts";
import {
  absent,
  arrayType,
  assume,
  bindName,
  constantType,
  DYNAMIC,
  type ExprType,
  joinTypes,
  MAX_ITEMS,
  nameProblem,
  narrowedBy,
  objectType,
  resolvePath,
  type Scope,
  typeOf,
} from "../scope.ts";
import { EAGER, type Eager } from "./operators.ts";
import {
  arrayOf,
  BAD,
  BOOL,
  type Checks,
  EXPR_LIMITS,
  type Fn,
  type Frame,
  guard,
  INT,
  itemsOf,
  type Kind,
  kindProblem,
  lang,
  type Plain,
  type Typed,
  tick,
} from "./types.ts";

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
export function operand(expr: unknown, kind: Kind, scope: Scope, pointer: string, depth: number, c: Checks): Typed {
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

export function analyze(expr: unknown, scope: Scope, base: string, depth: number, c: Checks): Typed {
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
  // Only a template's tree expression may hold `$embed`; it is replaced before any expression runs (spec §7.6).
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
