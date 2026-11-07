// `renderTemplate` (plan 028 Task 4, design T17–T19): a template is compiled once to closures, run
// over the checked inputs to SDK elements, and those go through the SDK's one build-and-validate
// pass. Nothing here builds a tree node, assigns an id or checks a prop: `render()` owns those rules.
import { addBoundMarker, DEFAULT_MAX_ERRORS, type LiveframeError, type Result } from "../errors.ts";
import { documentChecks, type ObjectSchema } from "../formats/capabilities.ts";
import type { UiTree } from "../formats/tree.ts";
import { at } from "../internal.ts";
import { isRecord } from "../schema.ts";
import { Element } from "../sdk/element.ts";
import { Fragment } from "../sdk/jsx-runtime.ts";
import { type RenderLimits, type RenderOptions, renderExpansion } from "../sdk/render.ts";
import type { WidgetProps } from "../sdk/types.ts";
import { buildFacts, type CompiledValidator, type InputSchemas } from "../validate/compile.ts";
import { encodeSegment } from "../validate/structure.ts";
import { TEMPLATE_LIMITS, type Template, validateTemplateShape } from "./document.ts";
import {
  absent,
  analyzeExpression,
  analyzeOperand,
  EXPR_LIMITS,
  ExprFailure,
  type Fn,
  type Frame,
  itemsOf,
} from "./expr.ts";
import {
  assume,
  bindName,
  componentScope,
  DYNAMIC,
  type ExprType,
  nameProblem,
  narrowedBy,
  newBudget,
  rootScope,
  type Scope,
  typeOf,
} from "./scope.ts";

export type TemplateLimits = RenderLimits & { readonly steps?: number };
export type TemplateRenderOptions = Omit<RenderOptions, "limits"> & { readonly limits?: TemplateLimits };

type Raw = Record<string, unknown>;

/** What one run collects: errors up to the bound, and the key path of the element being built. */
type Run = {
  readonly pointers: WeakMap<Element, string>;
  readonly errors: LiveframeError[];
  readonly maxErrors: number;
  /** Id segments of the enclosing elements, root first. */
  readonly path: string[];
  stopped: boolean;
  bounded: boolean;
};

/** Appends the elements one template node expands to; `key` replaces the node's own key (`$each`, `$use`). */
type Emitter = (run: Run, frame: Frame, out: Element[], key?: unknown) => void;

type Component = {
  /** Parameter slots, in declaration order: a scope numbers its first names from 0. */
  readonly params: readonly string[];
  size: number;
  emit: Emitter;
};

type Compiled = {
  readonly root: Emitter;
  readonly size: number;
};

const NOTHING: Emitter = () => {};
const NO_ACTIONS = Object.freeze({});
/** `rootScope` numbers its roots from 0 in this order, and `expand` fills the frame the same way. */
const ROOTS = ["params", "state", "data", "context", "actions"] as const;
const NO_ACTIONS_SCHEMA: ObjectSchema = { type: "object", properties: {}, required: [], additionalProperties: false };

function nodeId(path: readonly string[]): string {
  let id = "root";
  for (let i = 1; i < path.length; i++) id += `/${encodeSegment(path[i] as string)}`;
  return id;
}

function report(run: Run, error: LiveframeError): void {
  if (run.stopped) return;
  run.errors.push(run.path.length && !error.nodeId ? { ...error, nodeId: nodeId(run.path) } : error);
  if (error.kind === "limit-exceeded") run.stopped = true;
  if (run.errors.length >= run.maxErrors) run.stopped = run.bounded = true;
}

/** An emitter that records an expression failure at its node and carries on with the siblings. */
function guarded(emit: Emitter): Emitter {
  return (run, frame, out, key) => {
    if (run.stopped) return;
    const depth = run.path.length;
    const emitted = out.length;
    try {
      emit(run, frame, out, key);
    } catch (thrown) {
      if (!(thrown instanceof ExprFailure)) throw thrown;
      run.path.length = depth;
      out.length = emitted;
      report(run, thrown.error);
    }
  };
}

function failure(pointer: string, expected: string, message = `Expected ${expected}`): never {
  throw new ExprFailure({ kind: "invalid-prop", pointer, expected, message });
}

/**
 * Compiles a template against the validator's input schemas, with the scope rules of `validateTemplate`
 * (design T9, T12): the same analysis that passed at install, so a template that does not fit this
 * validator's manifest fails here with the install errors rather than at some later value.
 */
class Compiler {
  readonly c = documentChecks();
  readonly components = new Map<string, Component>();
  /** For each component (and "" for the widget), the components it uses and where. */
  readonly uses = new Map<string, Map<string, string>>();
  owner = "";
  budget = newBudget();

  constructor(
    readonly template: Template,
    readonly schemas: InputSchemas,
  ) {}

  reject(pointer: string, expected: string, kind: LiveframeError["kind"] = "invalid-document"): void {
    this.c.reject(pointer, `Expected ${expected}`, kind, expected);
  }

  run(): Result<Compiled> {
    const declared = Object.hasOwn(this.template, "components") ? (this.template.components ?? {}) : {};
    for (const [name, component] of Object.entries(declared))
      this.components.set(name, { params: Object.keys(component.params.properties), size: 0, emit: NOTHING });
    for (const [name, component] of Object.entries(declared)) {
      this.owner = name;
      this.budget = newBudget();
      const scope = componentScope(component.params, this.budget);
      const emit = this.node(component.root as Raw, at(at("/components", name), "root"), scope, 1);
      Object.assign(this.components.get(name) as Component, { emit, size: this.budget.slots });
    }
    this.owner = "";
    this.budget = newBudget();
    const scope = rootScope(
      Object.fromEntries(ROOTS.map((name) => [name, name === "actions" ? NO_ACTIONS_SCHEMA : this.schemas[name]])),
      this.budget,
    );
    const root = this.node(this.template.root as Raw, "/root", scope, 1);
    this.checkGraph();
    if (this.c.errors.length) return { ok: false, errors: this.c.errors };
    return { ok: true, value: { root, size: this.budget.slots } };
  }

  /** The component graph is acyclic and shallow, so expansion cannot recurse without end. */
  checkGraph(): void {
    const heights = new Map<string, number>();
    const height = (owner: string): number => {
      heights.set(owner, -1);
      let tallest = 0;
      for (const [callee, pointer] of this.uses.get(owner) ?? []) {
        const known = heights.get(callee);
        if (known === -1) {
          this.reject(pointer, "an acyclic component graph");
          continue;
        }
        const below = known ?? height(callee);
        if (below + 1 > TEMPLATE_LIMITS.useDepth)
          this.reject(pointer, `components used at most ${TEMPLATE_LIMITS.useDepth} deep`, "limit-exceeded");
        tallest = Math.max(tallest, below + 1);
      }
      heights.set(owner, tallest);
      return tallest;
    };
    for (const owner of ["", ...this.components.keys()]) if (!heights.has(owner)) height(owner);
  }

  expr(value: unknown, scope: Scope, pointer: string): Fn {
    return analyzeExpression(value, scope, pointer, this.c).run;
  }

  operand(value: unknown, kind: "bool" | "arr", scope: Scope, pointer: string): Fn {
    return analyzeOperand(value, kind, scope, pointer, this.c).run;
  }

  /** Binds `name` to a value of `type`; returns the new scope and the name's slot. */
  bind(scope: Scope, name: unknown, type: ExprType, pointer: string): { scope: Scope; slot: number } {
    const problem = nameProblem(name, scope);
    if (problem) this.reject(pointer, problem);
    const next = problem ? scope : bindName(scope, name as string, type);
    return { scope: next, slot: next.names.get(name as string)?.slot ?? 0 };
  }

  /** `$let`, then `$if`, then `$each`, then the body (design T3). */
  node(node: Raw, pointer: string, outer: Scope, depth: number): Emitter {
    if (depth > TEMPLATE_LIMITS.nesting) {
      this.reject(pointer, `nodes nested at most ${TEMPLATE_LIMITS.nesting} deep`, "limit-exceeded");
      return NOTHING;
    }
    let scope = outer;
    const lets: { slot: number; fn: Fn }[] = [];
    if (Array.isArray(node.$let))
      for (const [i, entry] of (node.$let as Raw[]).entries()) {
        const where = at(at(pointer, "$let"), i);
        const value = analyzeExpression(entry.value, scope, at(where, "value"), this.c);
        const bound = this.bind(scope, entry.as, value.type, at(where, "as"));
        scope = bound.scope;
        lets.push({ slot: bound.slot, fn: value.run });
      }
    const test = Object.hasOwn(node, "$if") ? this.operand(node.$if, "bool", scope, at(pointer, "$if")) : undefined;
    if (test) scope = assume(scope, narrowedBy(node.$if));
    let each: { list: Fn; item: number; index: number; key: Fn } | undefined;
    if (isRecord(node.$each)) {
      const spec = node.$each;
      const where = at(pointer, "$each");
      const source = analyzeOperand(spec.in, "arr", scope, at(where, "in"), this.c);
      const items = itemsOf(source.type);
      const item = this.bind(scope, spec.as, items ? typeOf(items) : DYNAMIC, at(where, "as"));
      scope = item.scope;
      let index = -1;
      if (Object.hasOwn(spec, "index")) {
        const bound = this.bind(scope, spec.index, typeOf({ type: "integer", minimum: 0 }), at(where, "index"));
        scope = bound.scope;
        index = bound.slot;
      }
      each = { list: source.run, item: item.slot, index, key: this.expr(spec.key, scope, at(where, "key")) };
    }
    const ownKey = Object.hasOwn(node, "key") ? this.expr(node.key, scope, at(pointer, "key")) : undefined;
    const body = Object.hasOwn(node, "$use")
      ? this.use(node, pointer, scope, ownKey)
      : this.element(node, pointer, scope, depth, ownKey);

    return guarded((run, frame, out, over) => {
      for (const entry of lets) frame.slots[entry.slot] = entry.fn(frame);
      if (test && test(frame) !== true) return;
      if (!each) return body(run, frame, out, over);
      const items = each.list(frame) as readonly unknown[];
      for (let i = 0; i < items.length && !run.stopped; i++) {
        frame.slots[each.item] = items[i];
        if (each.index >= 0) frame.slots[each.index] = i;
        const key = each.key(frame);
        body(run, frame, out, key === absent ? undefined : key);
      }
    });
  }

  /** A `$use` node: its `with` evaluates in this frame and fills the component's own. */
  use(node: Raw, pointer: string, scope: Scope, ownKey: Fn | undefined): Emitter {
    const name = node.$use as string;
    const component = this.components.get(name);
    if (!component) {
      this.reject(
        at(pointer, "$use"),
        `a declared component: ${[...this.components.keys()].join(", ") || "none"}`,
        "unknown-name",
      );
      return NOTHING;
    }
    const edges = this.uses.get(this.owner) ?? new Map<string, string>();
    this.uses.set(this.owner, edges);
    if (!edges.has(name)) edges.set(name, at(pointer, "$use"));
    const given = isRecord(node.with) ? node.with : {};
    const values: Fn[] = [];
    for (const key of Object.keys(given))
      if (!component.params.includes(key))
        this.reject(
          at(at(pointer, "with"), key),
          `a param of ${name}: ${component.params.join(", ") || "none"}`,
          "unknown-name",
        );
    for (const param of component.params) {
      const where = at(at(pointer, "with"), param);
      values.push(Object.hasOwn(given, param) ? this.expr(given[param], scope, where) : () => absent);
    }
    return (run, frame, out, over) => {
      const inner: Frame = { slots: new Array<unknown>(component.size), steps: frame.steps };
      try {
        for (let i = 0; i < values.length; i++) inner.slots[i] = (values[i] as Fn)(frame);
        inner.steps = frame.steps;
        const key = over ?? (ownKey ? ownKey(frame) : undefined);
        component.emit(run, inner, out, key === absent ? undefined : key);
      } finally {
        frame.steps = inner.steps;
      }
    };
  }

  element(node: Raw, pointer: string, scope: Scope, depth: number, ownKey: Fn | undefined): Emitter {
    const kind = node.kind as string;
    const kids = this.children(node, pointer, scope, depth);
    const keyOf = (frame: Frame, over: unknown): unknown => {
      if (over !== undefined) return over;
      const key = ownKey?.(frame);
      return key === absent ? undefined : key;
    };
    if (kind === "fragment")
      return (run, frame, out, over) => {
        const key = keyOf(frame, over);
        if (key !== undefined) run.path.push(String(key));
        const children: Element[] = [];
        for (const child of kids) child(run, frame, children);
        const element = new Element(Fragment, { children }, key, true);
        run.pointers.set(element, pointer);
        if (key !== undefined) run.path.pop();
        out.push(element);
      };

    const tag = Object.freeze({ kind });
    const props: (readonly [string, Fn])[] = [];
    const fixed: (readonly [string, unknown])[] = [];
    if (typeof node.variant === "string") fixed.push(["variant", node.variant]);
    if (typeof node.$anchor === "string") fixed.push(["$anchor", node.$anchor]);
    for (const section of ["props", "style"] as const) {
      const members = isRecord(node[section]) ? node[section] : {};
      for (const [name, value] of Object.entries(members))
        props.push([name, this.expr(value, scope, at(at(pointer, section), name))]);
    }
    const events = isRecord(node.events) ? node.events : {};
    for (const [name, intent] of Object.entries(events))
      props.push([name, this.intent(intent as Raw, scope, at(at(pointer, "events"), name))]);

    return (run, frame, out, over) => {
      const key = keyOf(frame, over);
      const record: Record<string, unknown> = {};
      for (const [name, value] of fixed) record[name] = value;
      for (const [name, fn] of props) {
        const value = fn(frame);
        if (value !== absent) record[name] = value;
      }
      run.path.push(key === undefined ? kind : String(key));
      const children: Element[] = [];
      for (const child of kids) child(run, frame, children);
      if (children.length) record.children = children;
      const element = new Element(tag, record, key, true);
      run.pointers.set(element, pointer);
      run.path.pop();
      out.push(element);
    };
  }

  children(node: Raw, pointer: string, scope: Scope, depth: number): Emitter[] {
    if (!Array.isArray(node.children)) return [];
    return node.children.map((child, i) => this.node(child as Raw, at(at(pointer, "children"), i), scope, depth + 1));
  }

  /** An intent whose `value` and `args` members are expressions (design T14). */
  intent(intent: Raw, scope: Scope, pointer: string): Fn {
    if (intent.type === "setState") {
      const key = intent.key as string;
      if (!Object.hasOwn(intent, "value")) return () => ({ type: "setState", key });
      const value = this.expr(intent.value, scope, at(pointer, "value"));
      const where = at(pointer, "value");
      return (frame) => {
        const v = value(frame);
        if (v === absent) failure(where, "a value", "A setState value is absent");
        return { type: "setState", key, value: v };
      };
    }
    const args = isRecord(intent.args) ? intent.args : {};
    const members = Object.entries(args).map(
      ([name, value]) => [name, this.expr(value, scope, at(at(pointer, "args"), name))] as const,
    );
    const base: Record<string, unknown> = { type: "action", name: intent.name };
    return (frame) => {
      const record: Record<string, unknown> = {};
      for (const [name, fn] of members) {
        const v = fn(frame);
        if (v !== absent) record[name] = v;
      }
      const built: Record<string, unknown> = { ...base, args: record };
      if (Object.hasOwn(intent, "bind")) built.bind = intent.bind;
      if (intent.bindAll === true) built.bindAll = true;
      return built;
    };
  }
}

// A frozen template compiles once per validator (design T18); an unfrozen one could change under the cache.
const cache = new WeakMap<object, WeakMap<CompiledValidator, Result<Compiled>>>();

function compile(template: Template, validator: CompiledValidator): Result<Compiled> {
  const frozen = typeof template === "object" && template !== null && Object.isFrozen(template);
  const cached = frozen ? cache.get(template)?.get(validator) : undefined;
  if (cached) return cached;
  const shape = validateTemplateShape(template);
  const compiled = shape.ok ? new Compiler(shape.value, buildFacts(validator).schemas).run() : shape;
  if (frozen) {
    const byValidator = cache.get(template) ?? new WeakMap<CompiledValidator, Result<Compiled>>();
    cache.set(template, byValidator);
    byValidator.set(validator, compiled);
  }
  return compiled;
}

function expand(
  compiled: Compiled,
  owned: Readonly<Record<string, unknown>>,
  steps: number,
  pointers: WeakMap<Element, string>,
  maxErrors: number,
): Element | readonly LiveframeError[] {
  const run: Run = { pointers, errors: [], maxErrors, path: [], stopped: false, bounded: false };
  const frame: Frame = { slots: new Array<unknown>(compiled.size), steps };
  ROOTS.forEach((name, slot) => {
    frame.slots[slot] = name === "actions" ? NO_ACTIONS : owned[name];
  });
  const out: Element[] = [];
  compiled.root(run, frame, out);
  if (!run.errors.length && out.length !== 1)
    report(run, {
      kind: "invalid-children",
      pointer: "/root",
      expected: "exactly one root element",
      message: "Expected exactly one root element",
    });
  if (run.errors.length) {
    if (run.bounded) addBoundMarker(run.errors, run.errors.at(-1)?.nodeId ?? "root");
    return run.errors;
  }
  return out[0] as Element;
}

/**
 * Runs a template over its inputs and returns the validated tree: the same ids, limits and error
 * kinds as `render()`. Errors point into the template document (design T16).
 */
export function renderTemplate(
  template: Template,
  inputs: WidgetProps,
  options: TemplateRenderOptions,
): Result<UiTree> {
  const { steps = EXPR_LIMITS.steps, ...limits } = options.limits ?? {};
  if (!Number.isSafeInteger(steps) || steps < 1)
    return {
      ok: false,
      errors: [
        {
          kind: "invalid-prop",
          pointer: "",
          nodeId: "root",
          expected: "limits.steps to be a positive safe integer",
          message: "Expected limits.steps to be a positive safe integer",
        },
      ],
    };
  const compiled = compile(template, options.validator);
  if (!compiled.ok) return compiled;
  const pointers = new WeakMap<Element, string>();
  const maxErrors = options.maxErrors ?? DEFAULT_MAX_ERRORS;
  const { limits: given, ...rest } = options;
  const render: RenderOptions = given ? { ...rest, limits } : rest;
  return renderExpansion(
    (owned) => expand(compiled.value, owned, steps, pointers, maxErrors),
    inputs as Readonly<Record<string, unknown>>,
    render,
    pointers,
  );
}
