// The template expression language: one table-driven evaluator.
// Checking and compiling are one walk: it infers a type for every node and builds a closure that
// evaluates it. `checkExpression` keeps the type, `compileExpression` keeps the closure, and
// `evaluate` compiles and runs once. No `eval`, no `Function`, no host API, no recursion in evaluation.
//
// expr/types.ts     bounds, frames, failures and operand kinds (`absent` is in scope.ts)
// expr/operators.ts the eager operators
// expr/forms.ts     the special forms and the walk that dispatches every node
// expr/analyze.ts   analysis, checking, compiling and `evaluate`
export { analyzeExpression, analyzeOperand, checkExpression, compileExpression, evaluate } from "./expr/analyze.ts";
export { OPERATORS } from "./expr/forms.ts";
export {
  EXPR_LIMITS,
  ExprFailure,
  type Fn,
  type Frame,
  itemsOf,
  type Typed,
} from "./expr/types.ts";
export { type Absent, absent } from "./scope.ts";
