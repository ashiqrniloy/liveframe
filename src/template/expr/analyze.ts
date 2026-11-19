// The entry points: analysis for `validateTemplate`, checking, compiling and one-shot evaluation.
import type { Result } from "../../errors.ts";
import { documentChecks } from "../../formats/capabilities.ts";
import type { Json } from "../../formats/tree.ts";
import { type Absent, dynamicScope, type ExprType, type Restriction, type Scope } from "../scope.ts";
import { analyze, operand } from "./forms.ts";
import { type Checks, EXPR_LIMITS, ExprFailure, type Fn, type Typed } from "./types.ts";

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
