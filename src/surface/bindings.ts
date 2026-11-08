// Browser-time evaluation of a node's `when` and `bind` (plan 029 B6–B8). The validator already checked
// each expression against the manifest; this compiles it once per tree node and runs it over the surface's
// local state and the node's own props, with a fixed fuel budget per expression.
import type { LiveframeError } from "../errors.ts";
import type { Definition } from "../formats/catalog.ts";
import { frozenJsonCopy } from "../formats/json.ts";
import type { Json, UiNode } from "../formats/tree.ts";
import { absent, compileExpression, ExprFailure, type Fn } from "../template/expr.ts";
import { newBudget, rootScope } from "../template/scope.ts";
import { TREE_EXPRESSION } from "../validate/bindings.ts";
import type { CompiledValidator, LocalFacts } from "../validate/compile.ts";

/** Evaluation fuel per expression (B4). */
const FUEL = 256;

export type LocalState = Readonly<Record<string, Json>>;

/** What a node's `when` and `bind` came to: hidden, bound props (or the static ones), or a failure. */
export type Evaluation =
  | { readonly hidden: true }
  | { readonly props: Readonly<Record<string, Json>>; readonly bound: boolean }
  | { readonly fault: readonly LiveframeError[] };

/** A node's compiled expressions, and the local keys they read. */
export type Bindings = {
  readonly when: Fn | undefined;
  readonly bind: readonly (readonly [string, Fn])[];
  readonly reads: readonly string[];
  /** Slot of `local` and `self` in the expression frame. */
  readonly slots: readonly [number, number];
  readonly faults: readonly LiveframeError[];
};

const NO_READS: readonly string[] = Object.freeze([]);

/** Adds the local keys an expression names to `keys`; false when it reads the whole `local` object. */
function collectReads(value: unknown, keys: Set<string>): boolean {
  if (value === null || typeof value !== "object") return true;
  if (Array.isArray(value)) return value.every((child) => collectReads(child, keys));
  for (const [name, child] of Object.entries(value)) {
    if (name === "$path" && typeof child === "string") {
      if (child === "local") return false;
      if (child.startsWith("local.")) keys.add(/^[A-Za-z0-9]*/.exec(child.slice(6))?.[0] ?? "");
    } else if (!collectReads(child, keys)) return false;
  }
  return true;
}

/**
 * Compiles a node's `when` and `bind`, or returns undefined for the common node that carries neither.
 * A validated tree always compiles; a failure here is reported as a node fault, never thrown.
 */
export function compileBindings(
  node: UiNode,
  definition: Definition,
  local: LocalFacts,
  allKeys: readonly string[],
): Bindings | undefined {
  if (node.when === undefined && node.bind === undefined) return undefined;
  const faults: LiveframeError[] = [];
  const keys = new Set<string>();
  let everything = false;
  const compile = (expr: unknown, pointer: string): Fn | undefined => {
    if (!collectReads(expr, keys)) everything = true;
    // A scope per expression: its node budget (B4) counts that expression alone.
    const scope = rootScope({ local: local.schema, self: definition.props }, newBudget());
    const compiled = compileExpression(expr, scope, pointer, TREE_EXPRESSION);
    if (compiled.ok) return compiled.value;
    faults.push(...compiled.errors);
    return undefined;
  };
  const when = node.when === undefined ? undefined : compile(node.when, "/when");
  const bind: (readonly [string, Fn])[] = [];
  for (const [name, expr] of Object.entries(node.bind ?? {})) {
    const fn = compile(expr, `/bind/${name}`);
    if (fn) bind.push([name, fn]);
  }
  const scope = rootScope({ local: local.schema, self: definition.props }, newBudget());
  const slots: readonly [number, number] = [scope.names.get("local")?.slot ?? 0, scope.names.get("self")?.slot ?? 1];
  const reads = everything ? allKeys : keys.size ? [...keys] : NO_READS;
  return { when, bind, reads, slots, faults };
}

function run(fn: Fn, bindings: Bindings, local: LocalState, props: unknown): unknown {
  const slots: unknown[] = [];
  slots[bindings.slots[0]] = local;
  slots[bindings.slots[1]] = props;
  return fn({ slots, steps: FUEL });
}

/**
 * Evaluates one node. `when` first: a hidden node never evaluates its `bind`. Each bound value replaces its
 * prop, and the effective props are re-validated with the validator's own node check, so a value that
 * passes the static shape rule but fails a bound still never reaches an implementation (B7).
 */
export function evaluateBindings(
  node: UiNode,
  bindings: Bindings,
  local: LocalState,
  validator: CompiledValidator,
): Evaluation {
  if (bindings.faults.length) return { fault: bindings.faults };
  try {
    if (bindings.when) {
      const shown = run(bindings.when, bindings, local, node.props);
      if (shown === false) return { hidden: true };
      if (shown !== true)
        return {
          fault: [
            {
              kind: "invalid-prop",
              pointer: "/when",
              message: "Expected a condition that is true or false",
              nodeId: node.id,
            },
          ],
        };
    }
    if (!bindings.bind.length) return { props: node.props, bound: false };
    const bound: Record<string, unknown> = { ...node.props };
    for (const [name, fn] of bindings.bind) {
      const value = run(fn, bindings, local, node.props);
      if (value === absent) delete bound[name];
      else bound[name] = value;
    }
    const props = frozenJsonCopy(bound as Record<string, Json>);
    const sink = { errors: [] as LiveframeError[], maxErrors: 1, nodeId: node.id };
    const probe = {
      id: node.id,
      kind: node.kind,
      ...(node.variant === undefined ? {} : { variant: node.variant }),
      props,
    };
    if (!validator.checkNode(probe, "", sink)) return { fault: sink.errors };
    return { props, bound: true };
  } catch (error) {
    if (error instanceof ExprFailure) return { fault: [{ ...error.error, nodeId: node.id }] };
    throw error;
  }
}
