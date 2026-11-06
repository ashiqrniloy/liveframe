import { describe, expect, test } from "bun:test";
import { arr, bool, int, num, obj, str, union } from "@arnilo/liveframe";
import {
  absent,
  analyzeExpression,
  checkExpression,
  compileExpression,
  EXPR_LIMITS,
  evaluate,
  OPERATORS,
} from "../template/expr.ts";
import { assume, binds, componentScope, narrowedBy, rootScope, type Scope } from "../template/scope.ts";

type Values = Record<string, unknown>;

/** The evaluated value, or the first error as `kind@pointer`. */
function run(expr: unknown, values: Values = {}, steps?: number): unknown {
  const result = evaluate(expr, values, steps === undefined ? {} : { steps });
  return result.ok ? result.value : `${result.errors[0]?.kind}@${result.errors[0]?.pointer}`;
}

const rows = [
  { id: "a", title: "Alpha", n: 1 },
  { id: "b", title: "Beta", n: 2 },
  { id: "c", title: "Gamma", n: 3 },
];
const values: Values = {
  data: { rows, empty: [], nested: [[1, 2], [3]], name: "Ada" },
  state: { filter: "all" },
  n: -1,
};
const path = (p: string) => ({ $path: p });
const lit = (v: unknown) => ({ $lit: v });

// Every operator has at least one accepted case here and one rejected case in `rejected`.
const accepted: [string, unknown, unknown][] = [
  ["path", path("data.rows.1.id"), "b"],
  ["path_missing", path("data.rows.9.id"), absent],
  ["lit_escapes_operators", lit({ $path: "x" }), { $path: "x" }],
  ["ref", { $ref: "hero" }, { $ref: "hero" }],
  ["omit", { $omit: null }, absent],
  ["has_present", { $has: path("data.name") }, true],
  ["has_absent", { $has: path("data.nope") }, false],
  ["eq", { $eq: [1, 1] }, true],
  ["eq_strings", { $eq: [path("state.filter"), "all"] }, true],
  ["eq_absent_equals_only_absent", { $eq: [path("data.nope"), { $omit: null }] }, true],
  ["eq_absent_vs_null", { $eq: [path("data.nope"), null] }, false],
  ["ne", { $ne: ["a", "b"] }, true],
  ["lt", { $lt: [1, 2] }, true],
  ["lte", { $lte: [2, 2] }, true],
  ["gt", { $gt: [1, 2] }, false],
  ["gte", { $gte: [2, 2] }, true],
  ["and", { $and: [true, true, false] }, false],
  ["and_short_circuits", { $and: [false, { $gt: [{ $div: [1, 0] }, 0] }] }, false],
  ["or", { $or: [false, false, true] }, true],
  ["or_short_circuits", { $or: [true, { $gt: [{ $div: [1, 0] }, 0] }] }, true],
  ["not", { $not: false }, true],
  ["cond", { $cond: [{ $gt: [2, 1] }, "yes", "no"] }, "yes"],
  ["cond_is_lazy", { $cond: [true, 1, { $div: [1, 0] }] }, 1],
  ["coalesce", { $coalesce: [path("data.nope"), path("data.name"), "x"] }, "Ada"],
  ["coalesce_is_lazy", { $coalesce: [1, { $div: [1, 0] }] }, 1],
  ["coalesce_all_absent", { $coalesce: [path("data.nope"), { $omit: null }] }, absent],
  ["len_array", { $len: path("data.rows") }, 3],
  ["len_string_counts_code_points", { $len: "a😀b" }, 3],
  ["concat", { $concat: ["a", "b", "c"] }, "abc"],
  ["join", { $join: [["a", "b", "c"], "-"] }, "a-b-c"],
  ["join_empty", { $join: [{ $filter: { in: ["a"], as: "x", where: false } }, "-"] }, ""],
  ["text_number", { $text: 5 }, "5"],
  ["text_boolean", { $text: true }, "true"],
  ["text_null", { $text: null }, "null"],
  ["text_string", { $text: "x" }, "x"],
  ["contains_string", { $contains: ["abc", "b"] }, true],
  ["contains_array", { $contains: [["a", "b"], "c"] }, false],
  ["contains_array_present", { $contains: [["a", "b", "c"], "c"] }, true],
  ["split", { $split: ["a,b,,c", ","] }, ["a", "b", "", "c"]],
  ["slice_string_by_code_point", { $slice: ["a😀b", 1, 2] }, "😀"],
  ["slice_array", { $slice: [[1, 2, 3, 4], 1, 3] }, [2, 3]],
  ["slice_end_clamps", { $slice: [[1, 2], 0, 99] }, [1, 2]],
  ["slice_end_omitted", { $slice: [[1, 2, 3], 1] }, [2, 3]],
  ["slice_start_after_end_is_empty", { $slice: [[1, 2, 3], 2, 1] }, []],
  ["add", { $add: [1, 2, 3] }, 6],
  ["mul", { $mul: [2, 3, 4] }, 24],
  ["sub", { $sub: [5, 8] }, -3],
  ["div", { $div: [7, 2] }, 3.5],
  ["round", { $round: [2.5] }, 3],
  ["round_digits", { $round: [1.25, 1] }, 1.3],
  ["sum", { $sum: [1, 2, 3] }, 6],
  ["sum_empty", { $sum: { $filter: { in: [1], as: "x", where: false } } }, 0],
  [
    "filter",
    {
      $map: {
        in: { $filter: { in: path("data.rows"), as: "r", where: { $gt: [path("r.n"), 1] } } },
        as: "r",
        value: path("r.id"),
      },
    },
    ["b", "c"],
  ],
  [
    "filter_with_index",
    { $filter: { in: ["a", "b", "c"], as: "x", index: "i", where: { $gt: [path("i"), 0] } } },
    ["b", "c"],
  ],
  [
    "map",
    { $map: { in: path("data.rows"), as: "r", index: "i", value: { $concat: [path("r.id"), { $text: path("i") }] } } },
    ["a0", "b1", "c2"],
  ],
  ["find_index", { $findIndex: { in: path("data.rows"), as: "r", where: { $eq: [path("r.id"), "c"] } } }, 2],
  ["find_index_none", { $findIndex: { in: path("data.rows"), as: "r", where: false } }, -1],
  ["flat", { $flat: path("data.nested") }, [1, 2, 3]],
  ["at", { $at: [path("data.rows"), 0] }, rows[0]],
  ["at_out_of_range", { $at: [path("data.rows"), 3] }, absent],
  ["at_negative_is_absent", { $at: [path("data.rows"), -1] }, absent],
  ["at_absent_array", { $at: [path("data.nope"), 0] }, absent],
  ["get", { $get: [lit({ a: 1, b: 2 }), "b"] }, 2],
  ["get_computed_key", { $get: [lit({ a: 1, b: 2 }), { $concat: ["a", ""] }] }, 1],
  ["get_absent_object", { $get: [path("data.nope"), "a"] }, absent],
  ["merge_right_wins", { $merge: [lit({ a: 1, b: 2 }), lit({ b: 3 })] }, { a: 1, b: 3 }],
  [
    "from_entries_later_wins",
    {
      $fromEntries: [
        ["a", 1],
        ["b", 2],
        ["a", 3],
      ],
    },
    { a: 3, b: 2 },
  ],
  [
    "from_entries_skips_absent_value",
    {
      $fromEntries: [
        ["a", path("data.nope")],
        ["b", 2],
      ],
    },
    { b: 2 },
  ],
  [
    "let",
    {
      $let: {
        bind: [
          { as: "x", value: 2 },
          { as: "y", value: { $add: [path("x"), 1] } },
        ],
        in: { $mul: [path("x"), path("y")] },
      },
    },
    6,
  ],
  ["array_constructor_omits_absent", [1, { $omit: null }, 2], [1, 2]],
  ["object_constructor_omits_absent", { a: 1, b: { $omit: null }, c: [path("data.name")] }, { a: 1, c: ["Ada"] }],
  ["bare_scalars_are_literals", ["a", 1, true, null], ["a", 1, true, null]],
];

const rejected: [string, unknown, string][] = [
  ["path_not_a_string", { $path: 5 }, "invalid-document@/$path"],
  ["path_unknown_root", path("nope.x"), "unknown-name@/$path"],
  ["path_empty_segment", path("data..x"), "invalid-document@/$path"],
  ["lit_not_json", lit(Number.NaN), "invalid-document@/$lit"],
  ["ref_empty", { $ref: "" }, "invalid-document@/$ref"],
  ["omit_not_null", { $omit: 1 }, "invalid-document@/$omit"],
  ["has_unknown_path", { $has: path("nope.x") }, "unknown-name@/$has/$path"],
  ["eq_arity", { $eq: [1] }, "invalid-document@/$eq"],
  ["eq_object_operand", { $eq: [lit({}), 1] }, "invalid-prop@/$eq/0"],
  ["ne_array_operand", { $ne: [lit([1]), 1] }, "invalid-prop@/$ne/0"],
  ["lt_string_operand", { $lt: ["a", 1] }, "invalid-prop@/$lt/0"],
  ["lte_runtime_type", { $lte: [path("state.filter"), 1] }, "invalid-prop@/$lte/0"],
  ["gt_arity", { $gt: [1, 2, 3] }, "invalid-document@/$gt"],
  ["gte_not_a_list", { $gte: 1 }, "invalid-document@/$gte"],
  ["and_arity", { $and: [true] }, "invalid-document@/$and"],
  ["and_not_boolean", { $and: [true, 1] }, "invalid-prop@/$and/1"],
  ["or_not_boolean", { $or: [path("state.filter"), true] }, "invalid-prop@/$or/0"],
  ["not_not_boolean", { $not: 1 }, "invalid-prop@/$not"],
  ["cond_arity", { $cond: [true, 1] }, "invalid-document@/$cond"],
  ["cond_test_not_boolean", { $cond: ["yes", 1, 2] }, "invalid-prop@/$cond/0"],
  ["coalesce_arity", { $coalesce: [1] }, "invalid-document@/$coalesce"],
  ["len_number", { $len: 5 }, "invalid-prop@/$len"],
  ["concat_number", { $concat: ["a", 1] }, "invalid-prop@/$concat/1"],
  ["concat_arity", { $concat: ["a"] }, "invalid-document@/$concat"],
  ["join_not_strings", { $join: [[1, 2], ","] }, "invalid-prop@/$join/0"],
  ["text_object", { $text: lit({}) }, "invalid-prop@/$text"],
  ["contains_number_in_string", { $contains: ["abc", 1] }, "invalid-prop@/$contains"],
  ["contains_array_of_arrays", { $contains: [[[1]], 1] }, "invalid-prop@/$contains/0"],
  ["split_empty_separator", { $split: ["a", ""] }, "invalid-prop@/$split/1"],
  ["split_computed_separator", { $split: ["a", path("state.filter")] }, "invalid-prop@/$split/1"],
  ["slice_negative_literal", { $slice: ["abc", -1] }, "invalid-prop@/$slice/1"],
  ["slice_negative_at_render", { $slice: ["abc", path("n")] }, "invalid-prop@/$slice"],
  ["slice_fraction", { $slice: ["abc", 0.5] }, "invalid-prop@/$slice/1"],
  ["add_string", { $add: [1, "a"] }, "invalid-prop@/$add/1"],
  ["mul_arity", { $mul: [2] }, "invalid-document@/$mul"],
  ["sub_arity", { $sub: [1] }, "invalid-document@/$sub"],
  ["div_by_zero", { $div: [1, 0] }, "invalid-prop@/$div"],
  ["div_zero_by_zero", { $div: [0, 0] }, "invalid-prop@/$div"],
  ["add_overflow", { $add: [1e308, 1e308] }, "invalid-prop@/$add"],
  ["mul_overflow", { $mul: [1e308, 10] }, "invalid-prop@/$mul"],
  ["round_digits_out_of_range", { $round: [1.5, 7] }, "invalid-prop@/$round/1"],
  ["round_digits_at_render", { $round: [1.5, path("n")] }, "invalid-prop@/$round"],
  ["round_overflow", { $round: [1.7e308, 6] }, "invalid-prop@/$round"],
  ["sum_strings", { $sum: ["a"] }, "invalid-prop@/$sum"],
  ["flat_not_nested", { $flat: [1, 2] }, "invalid-prop@/$flat"],
  ["at_fraction", { $at: [[1], 1.5] }, "invalid-prop@/$at/1"],
  ["get_unknown_literal_key", { $get: [lit({ a: 1 }), "b"] }, "invalid-prop@/$get/1"],
  ["merge_non_object", { $merge: [lit({}), 1] }, "invalid-prop@/$merge/1"],
  ["from_entries_bad_key", { $fromEntries: [[1, 2]] }, "invalid-prop@/$fromEntries"],
  ["from_entries_proto_key", { $fromEntries: [["__proto__", 1]] }, "invalid-prop@/$fromEntries"],
  ["filter_missing_where", { $filter: { in: [1], as: "x" } }, "invalid-document@/$filter/where"],
  ["filter_unknown_key", { $filter: { in: [1], as: "x", where: true, when: true } }, "invalid-document@/$filter/when"],
  ["filter_where_not_boolean", { $filter: { in: [1], as: "x", where: 1 } }, "invalid-prop@/$filter/where"],
  ["filter_in_not_array", { $filter: { in: 1, as: "x", where: true } }, "invalid-prop@/$filter/in"],
  ["map_missing_value", { $map: { in: [1], as: "x" } }, "invalid-document@/$map/value"],
  ["map_value_absent", { $map: { in: [1], as: "x", value: { $omit: null } } }, "invalid-prop@/$map/value"],
  ["find_index_bad_name", { $findIndex: { in: [1], as: "X", where: true } }, "invalid-document@/$findIndex/as"],
  ["let_empty", { $let: { bind: [], in: 1 } }, "invalid-document@/$let/bind"],
  ["let_bad_name", { $let: { bind: [{ as: "1x", value: 1 }], in: 1 } }, "invalid-document@/$let/bind/0/as"],
  ["unknown_operator", { $nope: 1 }, "invalid-document@/$nope"],
  ["operator_mixed_with_keys", { $add: [1, 2], extra: 1 }, "invalid-document"],
  ["constructor_proto_key", JSON.parse('{"__proto__": 1}'), "invalid-document@/__proto__"],
  ["non_finite_literal", Number.POSITIVE_INFINITY, "invalid-document"],
];

describe("operators", () => {
  for (const [name, expr, expected] of accepted)
    test(`accepts_${name}`, () => {
      expect(run(expr, values)).toEqual(expected as never);
    });

  for (const [name, expr, expected] of rejected)
    test(`rejects_${name}`, () => {
      const outcome = run(expr, values);
      expect(typeof outcome === "string" && outcome.startsWith(expected)).toBe(true);
    });

  test("every_operator_accepts_and_rejects", () => {
    const names = (tree: unknown, into = new Set<string>()): Set<string> => {
      if (Array.isArray(tree)) for (const member of tree) names(member, into);
      else if (tree && typeof tree === "object")
        for (const [key, member] of Object.entries(tree)) {
          if (key.startsWith("$")) into.add(key);
          if (key !== "$lit") names(member, into);
        }
      return into;
    };
    const accepting = names(accepted.map(([, expr]) => expr));
    const rejecting = names(rejected.map(([, expr]) => expr));
    expect(OPERATORS.filter((op) => !accepting.has(op))).toEqual([]);
    expect(OPERATORS.filter((op) => !rejecting.has(op) && op !== "$let")).toEqual([]);
    expect(rejecting.has("$let")).toBe(true);
    expect(OPERATORS.length).toBe(new Set(OPERATORS).size);
    expect(OPERATORS.length).toBe(38); // the design's T7 table
  });
});

describe("evaluation", () => {
  test("path_into_unknown_root_rejected", () => {
    expect(run(path("nope.x"), { data: {} })).toBe("unknown-name@/$path");
    const checked = checkExpression(path("nope.x"), rootScope({ data: obj({}) }));
    expect(checked.ok ? "" : checked.errors[0]?.expected).toBe("one of: data");
  });

  test("prototype_segments_rejected", () => {
    for (const bad of ["data.__proto__", "data.constructor", "data.prototype", "data.$x", "__proto__"])
      expect(run(path(bad), { data: {}, __proto__: null })).toMatch(/^(invalid-document|unknown-name)@\/\$path$/);
    expect(run(path("data.constructor"), { data: {} })).toBe("invalid-document@/$path");
  });

  test("path_reads_own_properties_only", () => {
    expect(run(path("data.toString"), { data: {} })).toBe(absent);
    expect(run(path("data.length"), { data: [1, 2] })).toBe(absent);
    expect(run(path("data.x"), { data: JSON.parse('{"__proto__": {"x": 1}}') })).toBe(absent);
    expect(run(path("data.0"), { data: { 0: "zero" } })).toBe("zero");
    expect(run(path("data.1"), { data: ["a"] })).toBe(absent);
    expect(run(path("data.a.b"), { data: { a: null } })).toBe(absent);
    expect(run(path("data.a.b"), { data: { a: "text" } })).toBe(absent);
  });

  test("name_shadowing_rejected", () => {
    const shadow = (name: string, inner: unknown) =>
      run({ $let: { bind: [{ as: name, value: 1 }], in: inner } }, { data: 1 });
    expect(shadow("data", 1)).toBe("invalid-document@/$let/bind/0/as");
    const nested = (as: string, index?: string) => ({
      $map: { in: [1], as: "row", value: { $map: { in: [1], as, ...(index ? { index } : {}), value: 1 } } },
    });
    expect(run(nested("row"), {})).toBe("invalid-document@/$map/value/$map/as");
    expect(run({ $map: { in: [1], as: "x", index: "x", value: 1 } }, {})).toBe("invalid-document@/$map/index");
    expect(
      run(
        {
          $let: {
            bind: [
              { as: "a", value: 1 },
              { as: "a", value: 2 },
            ],
            in: 1,
          },
        },
        {},
      ),
    ).toBe("invalid-document@/$let/bind/1/as");
    // A sibling scope may reuse a name once the first has ended.
    expect(run([{ $map: { in: [1], as: "x", value: 1 } }, { $map: { in: [2], as: "x", value: 2 } }], {})).toEqual([
      [1],
      [2],
    ]);
  });

  test("components_see_only_their_params", () => {
    const scope = componentScope(obj({ task: obj({ id: str({ maxLength: 8 }) }) }, { note: str({ maxLength: 8 }) }));
    expect(checkExpression(path("task.id"), scope).ok).toBe(true);
    expect(checkExpression(path("data.rows"), scope).ok).toBe(false);
    const optional = checkExpression(path("note"), scope);
    expect(optional.ok && optional.value.optional).toBe(true);
    // A component param may be named like a widget root.
    const named = componentScope(obj({ state: obj({}) }));
    expect(checkExpression(path("state"), named).ok).toBe(true);
  });

  test("round_half_away_from_zero_table", () => {
    const table: [number, number | undefined, number][] = [
      [0.5, undefined, 1],
      [1.5, undefined, 2],
      [2.5, undefined, 3],
      [-0.5, undefined, -1],
      [-1.5, undefined, -2],
      [-2.5, undefined, -3],
      [0.4, 0, 0],
      [-0.4, 0, 0],
      [1.25, 1, 1.3],
      [-1.25, 1, -1.3],
      [1234.5678, 2, 1234.57],
      [1234.5678, 0, 1235],
      [7, 6, 7],
    ];
    for (const [x, digits, expected] of table) {
      const result = run({ $round: digits === undefined ? [x] : [x, digits] });
      expect(Object.is(result, expected)).toBe(true);
    }
  });

  test("division_by_zero_is_evaluation_error", () => {
    const result = evaluate({ $div: [1, { $path: "zero" }] }, { zero: 0 });
    expect(result).toEqual({
      ok: false,
      errors: [{ kind: "invalid-prop", pointer: "/$div", message: "Division by zero" }],
    });
  });

  test("arithmetic_never_yields_negative_zero", () => {
    for (const expr of [{ $mul: [-1, 0] }, { $sub: [0, 0] }, { $add: [-0, -0] }, { $div: [-0, 5] }])
      expect(Object.is(run(expr), 0)).toBe(true);
  });

  test("deterministic_text_of_numbers", () => {
    expect(run({ $text: { $add: [0.1, 0.2] } })).toBe("0.30000000000000004");
    expect(run({ $text: { $mul: [-1, 0] } })).toBe("0");
    expect(run({ $text: 1e21 })).toBe("1e+21");
    expect(run({ $text: 1e-7 })).toBe("1e-7");
    expect(run({ $text: 123456789012345680000 })).toBe("123456789012345680000");
    expect(run({ $text: -0 })).toBe("0");
    expect(run({ $concat: ["n=", { $text: 1.5 }] })).toBe("n=1.5");
  });

  test("dynamic_operands_are_checked_when_evaluated", () => {
    const outcome = evaluate({ $add: [{ $path: "x" }, 1] }, { x: "text" });
    expect(outcome).toEqual({
      ok: false,
      errors: [{ kind: "invalid-prop", pointer: "/$add/0", message: "Expected a number", expected: "a number" }],
    });
    expect(run({ $len: path("x") }, { x: null })).toBe("invalid-prop@/$len");
    expect(run({ $not: path("x") }, {})).toMatch(/^unknown-name/);
    // An absent value is not a value.
    expect(run({ $add: [path("x.y"), 1] }, { x: {} })).toBe("invalid-prop@/$add/0");
    expect(run({ $join: [path("x"), ","] }, { x: ["a", 1] })).toBe("invalid-prop@/$join/0");
  });

  test("evaluation_does_not_mutate_inputs", () => {
    const input = { data: { rows: [{ n: 2 }, { n: 1 }] } };
    const before = JSON.stringify(input);
    run({ $merge: [path("data"), lit({ extra: 1 })] }, input);
    run({ $filter: { in: path("data.rows"), as: "r", where: { $gt: [path("r.n"), 1] } } }, input);
    run({ $slice: [path("data.rows"), 0, 1] }, input);
    expect(JSON.stringify(input)).toBe(before);
  });

  test("lit_values_are_frozen", () => {
    const result = evaluate(lit({ a: [1] }), {});
    expect(result.ok && Object.isFrozen(result.value)).toBe(true);
  });
});

describe("bounds", () => {
  const nest = (levels: number): unknown => {
    let expr: unknown = true;
    for (let i = 0; i < levels; i++) expr = { $not: expr };
    return expr;
  };

  test("expression_depth_limit", () => {
    expect(EXPR_LIMITS.depth).toBe(32);
    expect(run(nest(31))).toBe(false); // 32 levels with the innermost literal; an odd number of nots
    expect(run(nest(32))).toMatch(/^limit-exceeded@(\/\$not){32}$/);
    const deep = checkExpression(nest(5000), rootScope({}));
    expect(deep.ok).toBe(false);
  });

  test("expression_node_limit", () => {
    const list = (n: number) => Array.from({ length: n }, () => 1);
    expect(checkExpression(list(EXPR_LIMITS.nodes - 1), rootScope({})).ok).toBe(true);
    const over = checkExpression(list(EXPR_LIMITS.nodes), rootScope({}));
    expect(over.ok).toBe(false);
    expect(!over.ok && over.errors[0]?.kind).toBe("limit-exceeded");
    // The count is shared by every expression checked in one scope tree.
    const scope = rootScope({});
    expect(checkExpression(list(15_000), scope).ok).toBe(true);
    expect(checkExpression(list(15_000), scope).ok).toBe(false);
    // `$lit` payloads count as nodes too.
    expect(checkExpression(lit(list(EXPR_LIMITS.nodes)), rootScope({})).ok).toBe(false);
  });

  test("let_binding_limit", () => {
    const bind = (n: number) => Array.from({ length: n }, (_, i) => ({ as: `v${i}`, value: i }));
    expect(run({ $let: { bind: bind(32), in: path("v31") } })).toBe(31);
    expect(run({ $let: { bind: bind(33), in: 1 } })).toBe("invalid-document@/$let/bind");
  });

  test("fuel_exhaustion_is_limit_exceeded", () => {
    // `{ $add: [1, 2] }` costs three steps: the operator and its two operands.
    expect(run({ $add: [1, 2] }, {}, 3)).toBe(3);
    expect(run({ $add: [1, 2] }, {}, 2)).toBe("limit-exceeded@/$add/1");
    const xs = Array.from({ length: 1000 }, (_, i) => i);
    const map = { $map: { in: path("xs"), as: "x", value: { $add: [path("x"), 1] } } };
    expect(run(map, { xs }, 100)).toMatch(/^limit-exceeded@/);
    expect(Array.isArray(run(map, { xs }, 10_000))).toBe(true);
    expect(EXPR_LIMITS.steps).toBe(1_000_000);
  });

  test("nested_loops_hit_fuel_not_the_clock", () => {
    const xs = Array.from({ length: 2000 }, (_, i) => i);
    const cube = {
      $map: {
        in: path("xs"),
        as: "a",
        value: { $map: { in: path("xs"), as: "b", value: { $map: { in: path("xs"), as: "c", value: path("c") } } } },
      },
    };
    const started = performance.now();
    expect(run(cube, { xs })).toMatch(/^limit-exceeded@/);
    expect(performance.now() - started).toBeLessThan(2000);
  });

  test("long_inputs_cost_fuel_in_proportion", () => {
    const text = "x".repeat(MAX);
    // Each `$len` of a 1 MiB string is 16,384 extra steps; 100 of them cannot fit in 1,000,000.
    const hundred = { $sum: { $map: { in: path("xs"), as: "x", value: { $len: path("text") } } } };
    expect(run(hundred, { xs: Array.from({ length: 100 }, () => 0), text })).toMatch(/^limit-exceeded@/);
    expect(run(hundred, { xs: Array.from({ length: 10 }, () => 0), text })).toBe(10 * MAX);
  });

  const MAX = 1_048_576;

  test("let_doubling_hits_value_cap", () => {
    const doubling = (bindings: number) => ({
      $let: {
        bind: Array.from({ length: bindings }, (_, i) => ({
          as: `s${i}`,
          value: i === 0 ? "a" : { $concat: [path(`s${i - 1}`), path(`s${i - 1}`)] },
        })),
        in: { $len: path(`s${bindings - 1}`) },
      },
    });
    expect(run(doubling(21))).toBe(MAX); // 2^20 units: exactly the cap
    expect(run(doubling(22))).toMatch(/^limit-exceeded@\/\$let\/bind\/21\/value\/\$concat$/);
    expect(run(doubling(32))).toMatch(/^limit-exceeded@/);
  });

  test("array_value_cap", () => {
    const parts = (n: number) => ({ $len: { $split: [lit("a,".repeat(n - 1)), ","] } });
    expect(run(parts(65_536))).toBe(65_536);
    expect(run(parts(65_537))).toMatch(/^limit-exceeded@\/\$len\/\$split/);
    const big = { $flat: { $map: { in: path("xs"), as: "x", value: path("xs") } } };
    const xs = Array.from({ length: 257 }, () => 0);
    expect(run(big, { xs }, 10_000_000)).toMatch(/^limit-exceeded@\/\$flat/);
  });
});

describe("static checking", () => {
  const rowSchema = obj({ id: str({ maxLength: 64 }), n: int() }, { note: str({ maxLength: 40 }) });
  const queue = obj({ rows: arr(rowSchema, { maxItems: 100 }), total: int() }, { nextCursor: str({ maxLength: 64 }) });
  const outcome = union("status", {
    ok: obj({ value: queue }),
    failed: obj({}, { value: queue, reason: str({ maxLength: 100 }) }),
  });
  const scope = (): Scope =>
    rootScope({
      params: obj({ canView: bool() }, { limit: int() }),
      state: obj(
        {},
        { filter: str({ maxLength: 8, enum: ["all", "mine"] }), cursors: arr(str({ maxLength: 8 }), { maxItems: 4 }) },
      ),
      data: obj({ queue, outcome, label: str({ maxLength: 20, nullable: true }) }),
      context: obj({}),
      actions: obj({}),
    });
  const typeOfPath = (p: string, s = scope()) => {
    const checked = checkExpression(path(p), s);
    if (!checked.ok) throw new Error(checked.errors[0]?.message);
    return checked.value;
  };

  test("integer_length_of_a_typed_path", () => {
    const checked = checkExpression({ $len: path("data.queue.rows") }, scope());
    expect(checked).toEqual({ ok: true, value: { schema: { type: "integer" }, optional: false } });
  });

  test("path_types_follow_the_schemas", () => {
    expect(typeOfPath("data.queue.total")).toEqual({ schema: { type: "integer" }, optional: false });
    expect(typeOfPath("data.queue.rows.0.id").optional).toBe(true); // an index may be out of range
    expect(typeOfPath("data.queue.nextCursor").optional).toBe(true);
    expect(typeOfPath("data.queue.rows.0.note").schema).toEqual(str({ maxLength: 40 }));
    expect(typeOfPath("params.limit").optional).toBe(true);
    expect(typeOfPath("params.canView").optional).toBe(false);
    expect(typeOfPath("state").schema).toMatchObject({ type: "object" });
    expect(typeOfPath("data.outcome.status").schema).toMatchObject({ enum: ["ok", "failed"] });
    expect(typeOfPath("data.outcome.value").optional).toBe(true); // absent in one variant, optional in another
    expect(typeOfPath("data.outcome.value.total").optional).toBe(true);
    expect(typeOfPath("data.outcome.reason").optional).toBe(true);
  });

  test("unknown_property_is_unknown_name_with_the_valid_names", () => {
    const checked = checkExpression(path("data.queue.rowz"), scope());
    expect(checked).toMatchObject({
      ok: false,
      errors: [{ kind: "unknown-name", pointer: "/$path", expected: "one of: nextCursor, rows, total" }],
    });
    expect(checkExpression(path("data.queue.total.x"), scope()).ok).toBe(false);
    expect(checkExpression(path("data.queue.rows.first"), scope()).ok).toBe(false);
    expect(checkExpression(path("data.outcome.nope"), scope()).ok).toBe(false);
  });

  test("has_narrows_optional_path", () => {
    const next = path("data.queue.nextCursor");
    const len = { $len: next };
    const bare = checkExpression(len, scope());
    expect(bare).toMatchObject({ ok: false, errors: [{ kind: "invalid-prop", pointer: "/$len" }] });
    expect(!bare.ok && bare.errors[0]?.message).toContain("$has");
    expect(checkExpression({ $cond: [{ $has: next }, len, 0] }, scope()).ok).toBe(true);
    expect(checkExpression({ $cond: [{ $has: next }, 0, len] }, scope()).ok).toBe(false); // wrong branch
    expect(checkExpression({ $and: [{ $has: next }, { $gt: [len, 0] }] }, scope()).ok).toBe(true);
    expect(checkExpression({ $and: [{ $gt: [len, 0] }, { $has: next }] }, scope()).ok).toBe(false); // order matters
    expect(checkExpression({ $coalesce: [next, "none"] }, scope())).toMatchObject({
      ok: true,
      value: { optional: false },
    });
    // A scope can be narrowed by the caller for a subtree (`$if`); a has on a child proves its parents.
    const narrowed = assume(scope(), narrowedBy({ $has: path("data.outcome.value.total") }));
    expect(typeOfPath("data.outcome.value.total", narrowed).optional).toBe(false);
    expect(narrowedBy({ $and: [{ $has: next }, { $has: path("state.filter") }] })).toEqual([
      "data",
      "data.queue",
      "data.queue.nextCursor",
      "state",
      "state.filter",
    ]);
    expect(narrowedBy({ $not: { $has: next } })).toEqual([]);
  });

  test("has_narrows_a_bound_name", () => {
    const expr = {
      $let: {
        bind: [{ as: "next", value: path("data.queue.nextCursor") }],
        in: { $cond: [{ $has: path("next") }, { $len: path("next") }, 0] },
      },
    };
    expect(checkExpression(expr, scope())).toMatchObject({ ok: true, value: { schema: { type: "integer" } } });
  });

  test("operand_types_are_inferred", () => {
    const bad = (expr: unknown) => {
      const checked = checkExpression(expr, scope());
      return checked.ok ? "ok" : `${checked.errors[0]?.kind}@${checked.errors[0]?.pointer}`;
    };
    expect(bad({ $add: [path("data.queue.total"), 1] })).toBe("ok");
    expect(bad({ $add: [path("data.queue.rows"), 1] })).toBe("invalid-prop@/$add/0");
    expect(bad({ $concat: [path("data.label"), "x"] })).toBe("invalid-prop@/$concat/0"); // nullable
    expect(bad({ $text: path("data.label") })).toBe("ok"); // null is a scalar
    expect(bad({ $map: { in: path("data.queue.rows"), as: "r", value: { $add: [path("r.n"), 1] } } })).toBe("ok");
    expect(bad({ $map: { in: path("data.queue.rows"), as: "r", value: { $add: [path("r.id"), 1] } } })).toBe(
      "invalid-prop@/$map/value/$add/0",
    );
    expect(bad({ $filter: { in: path("data.queue.rows"), as: "r", where: path("r.n") } })).toBe(
      "invalid-prop@/$filter/where",
    );
    expect(bad({ $len: path("data.outcome") })).toBe("invalid-prop@/$len");
    expect(bad({ $at: [path("data.queue.rows"), 0] })).toBe("ok");
    expect(bad({ $get: [path("data.queue"), "rows"] })).toBe("ok");
    expect(bad({ $get: [path("data.queue"), "nope"] })).toBe("invalid-prop@/$get/1");
  });

  test("inferred_types_of_composites", () => {
    const type = (expr: unknown) => {
      const checked = checkExpression(expr, scope());
      if (!checked.ok) throw new Error(checked.errors[0]?.message);
      return checked.value;
    };
    expect(type("x").schema).toEqual({ type: "string", maxLength: 1, enum: ["x"] });
    expect(type({ $cond: [true, "a", "b"] }).schema).toEqual({ type: "string", maxLength: 1, enum: ["a", "b"] });
    expect(type({ $coalesce: [path("state.filter"), "all"] }).schema).toMatchObject({ enum: ["all", "mine"] });
    expect(type({ $cond: [true, "a", { $omit: null }] })).toMatchObject({ optional: true, schema: { enum: ["a"] } });
    expect(type({ $cond: [true, 1, 2.5] }).schema).toEqual({ type: "number" });
    expect(type({ $add: [1, 2] }).schema).toEqual({ type: "integer" });
    expect(type({ $div: [4, 2] }).schema).toEqual({ type: "number" });
    expect(type({ $round: [2.5] }).schema).toEqual({ type: "integer" });
    expect(type({ $round: [2.5, 1] }).schema).toEqual({ type: "number" });
    expect(type({ id: path("data.queue.total"), tag: "x" }).schema).toMatchObject({
      type: "object",
      required: ["id", "tag"],
    });
    expect(type({ id: path("data.queue.nextCursor") }).schema).toMatchObject({ type: "object", required: [] });
    expect(type([1, 2]).schema).toEqual({ type: "array", items: { type: "integer" }, maxItems: 2 });
    expect(type([1, "a"]).schema).toBe("dynamic");
    expect(type({ $fromEntries: [["a", 1]] }).schema).toBe("dynamic");
    expect(type({ $slice: [path("data.queue.rows"), 0, 2] }).schema).toMatchObject({ type: "array" });
    expect(type({ $merge: [lit({ a: 1 }), lit({ b: "x" })] }).schema).toMatchObject({ required: ["a", "b"] });
    expect(type({ $flat: [[1], [2]] }).schema).toMatchObject({ type: "array", items: { type: "integer" } });
    expect(type({ $filter: { in: path("data.queue.rows"), as: "r", where: true } }).schema).toMatchObject({
      type: "array",
    });
    expect(type({ $ref: "hero" }).schema).toMatchObject({ type: "object", required: ["$ref"] });
    expect(type({ $omit: null })).toEqual({ schema: "absent", optional: true });
  });

  test("binds_checks_shape_and_leaves_constraints_to_render", () => {
    const type = (expr: unknown) => {
      const checked = checkExpression(expr, scope());
      if (!checked.ok) throw new Error(checked.errors[0]?.message);
      return checked.value;
    };
    const text = str({ maxLength: 5 });
    expect(binds(type(path("data.queue.rows.0.id")), text)).toContain("always present");
    expect(binds(type(path("data.queue.rows.0.id")), text, false)).toBeUndefined();
    expect(binds(type({ $text: path("data.queue.total") }), text)).toBeUndefined(); // longer than 5 is a render check
    expect(binds(type(path("data.queue.total")), num())).toBeUndefined(); // integer binds to number
    expect(binds(type(path("data.queue.total")), text)).toBe("a string");
    expect(binds(type({ $div: [1, 2] }), int())).toBe("an integer"); // number does not bind to integer
    expect(binds(type(path("data.label")), str({ maxLength: 20 }))).toContain("cannot be null");
    expect(binds(type(path("data.label")), str({ maxLength: 20, nullable: true }))).toBeUndefined();
    expect(binds(type(null), str({ maxLength: 20, nullable: true }))).toBeUndefined();
    expect(binds(type(null), str({ maxLength: 20 }))).toBe("a string");
    expect(binds(type({ $cond: [true, null, null] }), str({ maxLength: 20 }))).toContain("cannot be null");
    expect(binds(type({ $cond: [true, null, null] }), str({ maxLength: 20, nullable: true }))).toBeUndefined();
    expect(binds(type({ $omit: null }), text)).toContain("always present");
    expect(binds(type({ $omit: null }), text, false)).toBeUndefined();
    expect(binds({ schema: "dynamic", optional: false }, text)).toBeUndefined();
    // Enums: a subset binds, a plain string does not.
    const filter = str({ maxLength: 8, enum: ["all", "mine", "done"] });
    expect(binds(type(path("state.filter")), filter)).toContain("always present");
    expect(binds(type({ $coalesce: [path("state.filter"), "all"] }), filter)).toBeUndefined();
    expect(binds(type({ $cond: [true, "all", "mine"] }), str({ maxLength: 8, enum: ["all"] }))).toContain(
      "one of: all",
    );
    expect(binds(type({ $text: 5 }), filter)).toContain("one of");
    expect(binds(type(path("state.filter")), text, false)).toBeUndefined();
    // Constants take the real check, constraints included.
    expect(binds(type("abc"), text)).toBeUndefined();
    expect(binds(type("abcdef"), text)).toBe("at most 5 code points");
    expect(binds(type("zzz"), filter)).toContain("one of");
    expect(binds(type([1, 2, 3]), arr(int(), { maxItems: 2 }))).toBe("at most 2 items");
    // Arrays and objects: items and members.
    expect(binds(type(path("data.queue.rows")), arr(rowSchema, { maxItems: 5 }))).toBeUndefined();
    expect(binds(type(path("data.queue.rows")), arr(str({ maxLength: 5 }), { maxItems: 5 }))).toContain("a string");
    const target = obj({ id: str({ maxLength: 8 }) }, { note: str({ maxLength: 8 }) });
    expect(binds(type({ id: path("data.queue.rows.0.id") }), target)).toContain("id");
    expect(binds(type({ id: { $coalesce: [path("data.queue.rows.0.id"), "?"] } }), target)).toBeUndefined();
    expect(binds(type({ id: { $coalesce: [path("data.queue.rows.0.id"), "?"] }, extra: 1 }), target)).toContain(
      "extra",
    );
    expect(binds(type({ note: { $coalesce: [path("data.queue.nextCursor"), "?"] } }), target)).toContain("id");
    // Unions: an object with a tag binds when every tag it can take is a variant.
    const event = union("type", {
      setState: obj({ key: str({ maxLength: 8 }) }),
      action: obj({ name: str({ maxLength: 8 }) }),
    });
    const key = { $coalesce: [path("state.filter"), "all"] };
    expect(binds(type({ type: "setState", key }), event)).toBeUndefined();
    expect(binds(type({ type: "setState", name: key }), event)).toBe("property key is required");
    expect(binds(type({ type: "setState", key, name: key }), event)).toBe("property name is not declared");
    expect(binds(type({ type: "other", key }), event)).toContain("object");
    expect(binds(type({ type: "setState", key: "filter" }), event)).toBeUndefined(); // a constant takes the real check
    expect(binds(type({ type: "other", key: "x" }), event)).toBe("one of: setState, action");
    expect(binds(type(path("data.outcome")), event)).toContain("object");
    expect(binds(type(path("data.outcome")), outcome)).toBeUndefined();
  });

  test("dynamic_values_bind_anywhere", () => {
    const fromEntries = checkExpression({ $fromEntries: [["a", path("state.filter")]] }, scope());
    expect(fromEntries.ok && binds(fromEntries.value, arr(int(), { maxItems: 1 }))).toBeUndefined();
  });

  test("compile_gives_the_slot_layout_of_the_scope", () => {
    const s = rootScope({ params: obj({ k: int() }), data: obj({ rows: arr(int(), { maxItems: 3 }) }) });
    const compiled = compileExpression(
      { $sum: { $map: { in: path("data.rows"), as: "x", value: { $mul: [path("x"), path("params.k")] } } } },
      s,
    );
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const slots = new Array(s.budget.slots);
    slots[s.names.get("params")?.slot as number] = { k: 10 };
    slots[s.names.get("data")?.slot as number] = { rows: [1, 2, 3] };
    expect(compiled.value({ slots, steps: 1000 })).toBe(60);
    // Slots are reused by siblings, so the frame stays as small as the deepest scope.
    expect(s.budget.slots).toBe(3);
  });

  test("analyze_shares_one_error_sink", () => {
    const { documentChecks } = require("../formats/capabilities.ts") as typeof import("../formats/capabilities.ts");
    const sink = documentChecks();
    analyzeExpression(path("nope.a"), scope(), "/root/props/a", sink);
    analyzeExpression({ $add: [1, "x"] }, scope(), "/root/props/b", sink);
    expect(sink.errors.map((e) => e.pointer)).toEqual(["/root/props/a/$path", "/root/props/b/$add/1"]);
  });
});

describe("security", () => {
  test("expressions_reach_no_globals", () => {
    const probes = [
      "globalThis",
      "process",
      "Bun",
      "constructor",
      "__proto__",
      "prototype",
      "toString",
      "hasOwnProperty",
    ];
    for (const name of probes) {
      expect(String(run(path(name), { data: {} }))).toMatch(/unknown-name|invalid-document/);
      expect(run(path(`data.${name}`), { data: {} })).toSatisfy(
        (v) => v === absent || String(v).startsWith("invalid-document"),
      );
    }
    expect(run({ $get: [lit({}), "constructor"] })).toMatch(/^invalid-prop/); // not a known key of the literal
    expect(run({ $get: [path("data"), "constructor"] }, { data: {} })).toBe(absent);
    expect(run({ $get: [path("data"), "__proto__"] }, { data: {} })).toBe(absent);
  });

  test("the_modules_use_no_dynamic_code_and_no_host_api", async () => {
    for (const file of ["expr.ts", "scope.ts"]) {
      const source = await Bun.file(new URL(`../template/${file}`, import.meta.url)).text();
      expect(source).not.toMatch(
        /\beval\s*\(|new Function\b|\bFunction\s*\(|\bglobalThis\b|\bimport\s*\(|\brequire\s*\(/,
      );
      expect(source).not.toMatch(/from "(node|bun):/);
      const imports = [...source.matchAll(/from "(\.[^"]+)"/g)].map((m) => m[1]);
      for (const spec of imports)
        expect(spec).toMatch(/^\.\.?\/(errors|internal|schema|formats\/(capabilities|json|tree)|scope|expr)\.ts$/);
    }
  });

  test("fromEntries_never_sets_a_prototype", () => {
    const result = evaluate({ $fromEntries: [["constructor", 1]] }, {});
    expect(result.ok && Object.getPrototypeOf(result.value)).toBe(Object.prototype);
    const merged = evaluate({ $merge: [{ $path: "a" }, { $path: "b" }] }, { a: JSON.parse('{"__proto__": 1}'), b: {} });
    expect(merged.ok && Object.getPrototypeOf(merged.value)).toBe(Object.prototype);
    expect(merged.ok && Object.hasOwn(merged.value as object, "__proto__")).toBe(true);
  });
});
