// Node `when` and `bind` (plan 029 B1–B7): browser-evaluated expressions, checked here before a tree is
// accepted. They are the template language narrowed to an operator allow-list with two roots, `local`
// (the manifest's local state) and `self` (the node's own props), so one checker serves both.
import type { LiveframeError } from "../errors.ts";
import { at, documentChecks, isRecord, type ObjectSchema } from "../formats/capabilities.ts";
import { analyzeExpression } from "../template/expr.ts";
import { binds, newBudget, type Restriction, rootScope, type Scope } from "../template/scope.ts";
import { reject } from "./checks.ts";
import type { SchemaSink } from "./schema.ts";

/** The operators a tree expression may use: references, comparison, logic, text, numbers and lookup (B3). */
export const TREE_OPERATORS: ReadonlySet<string> = new Set([
  ...["$path", "$lit", "$omit", "$has"],
  ...["$eq", "$ne", "$lt", "$lte", "$gt", "$gte"],
  ...["$and", "$or", "$not", "$cond", "$coalesce"],
  ...["$len", "$concat", "$text", "$contains", "$slice"],
  ...["$add", "$sub", "$mul", "$div", "$round"],
  ...["$get", "$at"],
]);

/** Per expression: 16 levels, 64 nodes (B4). The renderer adds a fuel limit of 256 steps when it evaluates. */
export const TREE_EXPRESSION: Restriction = { operators: TREE_OPERATORS, depth: 16, nodes: 64 };
/** `bind` entries per node, and expression nodes per tree (B4). */
export const MAX_BINDINGS = 16;
/** A template's expression may hold `{ "$embed": Expr }`, replaced by a literal at expansion (plan 029 B12). */
export const EMBED = "$embed";
const TEMPLATE_EXPRESSION: Restriction = { ...TREE_EXPRESSION, operators: new Set([...TREE_OPERATORS, EMBED]) };
export const MAX_TREE_EXPRESSION_NODES = 10_000;

/** What a node's `when` and `bind` read from the manifest and the catalog. */
export type BindingFacts = {
  readonly local: ObjectSchema;
  readonly props: ObjectSchema;
  /** Props that name another node; a binding cannot rewrite them (B5.4). */
  readonly refProps: ReadonlySet<string> | undefined;
  /** Accept `$embed` as an operand of unknown type: a template's expression, checked again once expanded. */
  readonly embed?: boolean;
};
export type BindingCheck = (node: Record<string, unknown>, sink: SchemaSink) => boolean;

/** Whether a node with this id, or any ancestor of it, carries a `when`. Ids are key paths, so ancestors are prefixes. */
export function isGated(gated: ReadonlySet<string>, id: string): boolean {
  if (!gated.size) return false;
  for (let end = id.indexOf("/"); end !== -1; end = id.indexOf("/", end + 1))
    if (gated.has(id.slice(0, end))) return true;
  return gated.has(id);
}

/** The error a checker reports, as a tree error: document errors become `invalid-prop` (B5). */
function treeError(error: LiveframeError, prefix: string): LiveframeError {
  return {
    ...error,
    kind: error.kind === "invalid-document" ? "invalid-prop" : error.kind,
    pointer: prefix + error.pointer,
  };
}

// One collector serves every check: the analysis is synchronous and not re-entrant, and its errors are copied out.
const collector = documentChecks();

/**
 * One expression, checked against the node's scope. Pushes its errors under `prefix` and returns its type,
 * or undefined when it is not valid. Counts its nodes against the tree's budget when the sink carries one.
 */
function checkOne(scope: Scope, expr: unknown, prefix: string, sink: SchemaSink, restrict: Restriction) {
  const budget = newBudget();
  const typed = analyzeExpression(expr, { ...scope, budget, restrict }, "", collector);
  const total = sink.expressions;
  if (total) {
    const before = total.nodes;
    total.nodes += budget.nodes;
    if (before <= MAX_TREE_EXPRESSION_NODES && total.nodes > MAX_TREE_EXPRESSION_NODES)
      reject(sink, prefix, `at most ${MAX_TREE_EXPRESSION_NODES} expression nodes in a tree`, "limit-exceeded");
  }
  if (!collector.errors.length) return typed.type;
  for (const error of collector.errors.splice(0))
    if (sink.errors.length < sink.maxErrors) sink.errors.push(treeError(error, prefix));
  return undefined;
}

/** The `when` and `bind` check for one kind. Its scope is built on first use: most trees carry neither. */
export function compileBindings(facts: BindingFacts): BindingCheck {
  let scope: Scope | undefined;
  const restrict = facts.embed ? TEMPLATE_EXPRESSION : TREE_EXPRESSION;
  const bindable = `a bindable prop: ${Object.keys(facts.props.properties)
    .filter((name) => !facts.refProps?.has(name))
    .join(", ")}`;

  function checkWhen(expr: unknown, scope: Scope, sink: SchemaSink): boolean {
    const type = checkOne(scope, expr, "/when", sink, restrict);
    if (!type) return false;
    const problem = binds(type, { type: "boolean" });
    return problem === undefined || reject(sink, "/when", problem);
  }

  function checkBind(map: unknown, scope: Scope, sink: SchemaSink): boolean {
    if (!isRecord(map)) return reject(sink, "/bind", "an object of prop expressions");
    const names = Object.keys(map);
    if (names.length > MAX_BINDINGS)
      return reject(sink, "/bind", `at most ${MAX_BINDINGS} bound props`, "limit-exceeded");
    let valid = true;
    for (const name of names) {
      if (sink.errors.length >= sink.maxErrors) break;
      const pointer = at("/bind", name);
      const target = Object.hasOwn(facts.props.properties, name) ? facts.props.properties[name] : undefined;
      if (!target || facts.refProps?.has(name)) {
        valid = reject(sink, pointer, bindable);
        continue;
      }
      const type = checkOne(scope, map[name], pointer, sink, restrict);
      if (!type) {
        valid = false;
        continue;
      }
      const problem = binds(type, target, facts.props.required.includes(name));
      if (problem !== undefined) valid = reject(sink, pointer, `a value that fits prop ${name}: ${problem}`);
    }
    return valid;
  }

  return (node, sink) => {
    scope ??= rootScope({ local: facts.local, self: facts.props });
    let valid = true;
    if (Object.hasOwn(node, "when") && !checkWhen(node.when, scope, sink)) valid = false;
    if (Object.hasOwn(node, "bind") && !checkBind(node.bind, scope, sink)) valid = false;
    return valid;
  };
}
