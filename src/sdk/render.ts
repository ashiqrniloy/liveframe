import { addBoundMarker, DEFAULT_MAX_ERRORS, type LiveframeError, type Result } from "../errors.ts";
import { at, isRecord } from "../formats/capabilities.ts";
import type { UiNode, UiTree } from "../formats/tree.ts";
import { isThenable } from "../internal.ts";
import { isGated } from "../validate/bindings.ts";
import {
  BIND_MEMBER_BYTES,
  BRACKET_BYTES,
  childrenFramingBytes,
  EVENTS_MEMBER_BYTES,
  nodeOpenBytes,
  PROPS_MEMBER_BYTES,
  STYLE_MEMBER_BYTES,
  stringBytes,
  treeFieldBytes,
  VARIANT_MEMBER_BYTES,
  WHEN_MEMBER_BYTES,
} from "../validate/bytes.ts";
import {
  buildFacts,
  type CompiledBuild,
  type CompiledValidator,
  type KindFacts,
  propTarget,
} from "../validate/compile.ts";
import type { SchemaCheck, SchemaSink } from "../validate/schema.ts";
import { encodeSegment, type JsonWalk, newTally, tallyKind, walkJson } from "../validate/structure.ts";
import { DEFAULT_LIMITS } from "../validate/tree.ts";
import { type Element, isElement } from "./element.ts";
import { Fragment } from "./jsx-runtime.ts";
import type { ActionStatuses, WidgetInputs, WidgetProps } from "./types.ts";

const FORMAT = "liveframe/1" as const;
/** Matches the tree walker: JSON never nests deeper than this (spec §10). */
const INPUT_DEPTH = 128;

const deepFrozen = new WeakSet<object>();
const mutableChildren = new WeakSet<object>();
const inputCopies = new WeakMap<object, { check: SchemaCheck; copy: unknown }>();

export type RenderLimits = {
  readonly nodes?: number;
  readonly depth?: number;
  readonly bytes?: number;
};
export type RenderOptions = {
  readonly validator: CompiledValidator;
  readonly surfaceId: string;
  readonly revision: number;
  readonly limits?: RenderLimits;
  readonly maxErrors?: number;
};

/** Not the shared `errorMessage`: an empty message falls back to `String(thrown)`, and long ones are cut. */
function thrownMessage(thrown: unknown): string {
  const message = thrown instanceof Error && thrown.message ? thrown.message : String(thrown);
  return message.length > 500 ? `${message.slice(0, 500)}…` : message;
}

/**
 * Runs the widget once and builds its tree, checking every node as it is emitted (spec §7.2,
 * §10): ids, props, intents, child rules, and the node, depth and byte budgets.
 */
export function render<P, S, D, C, A = ActionStatuses>(
  widget: (props: WidgetProps<P, S, D, C, A>) => unknown,
  inputs: WidgetInputs<P, S, D, C, A>,
  options: RenderOptions,
): Result<UiTree> {
  return renderValue((owned) => widget(owned as WidgetProps<P, S, D, C, A>), inputs, options, true);
}

/** Internal: builds a tree from an already-built root element, for element JSON (spec §7.2). */
export function renderPrepared(
  root: Element,
  options: RenderOptions,
  sourcePointers: WeakMap<Element, string>,
): Result<UiTree> {
  return renderValue(() => root, {}, options, false, sourcePointers);
}

/**
 * Internal: renders what `expand` builds from the checked, frozen inputs, for template widgets
 * (plan 028). `expand` returns the root element, or the errors that stopped it, which are then the
 * result as they are.
 */
export function renderExpansion(
  expand: (owned: Readonly<Record<string, unknown>>) => Element | readonly LiveframeError[],
  inputs: Readonly<Record<string, unknown>>,
  options: RenderOptions,
  sourcePointers: WeakMap<Element, string>,
): Result<UiTree> {
  let rejected: readonly LiveframeError[] | undefined;
  const result = renderValue(
    (owned) => {
      const built = expand(owned);
      if (!isElement(built)) rejected = built;
      return built;
    },
    inputs,
    options,
    true,
    sourcePointers,
  );
  return rejected ? { ok: false, errors: rejected } : result;
}

/** A node a stream has opened: its own fields are checked, its children are still arriving. */
export type StreamNode = OpenNode;
/** What a stream step added to its parent: the nodes, and whether any still holds an unresolved reference. */
export type Placed = { readonly nodes: readonly UiNode[]; readonly references: boolean };

export type StreamBuild = {
  /** True once a limit or the error bound stopped the build; nothing more can be added. */
  readonly stopped: boolean;
  readonly errors: LiveframeError[];
  /** Opens a node under `parent` (null for the root) without its children; undefined after recording why. */
  open(element: Element, parent: StreamNode | null): StreamNode | undefined;
  /** Emits a complete element, children and all, under `parent`. Undefined (and nothing kept) if it was invalid. */
  whole(element: Element, parent: StreamNode | null): Placed | undefined;
  /** Finishes an opened node once its children are all in. Undefined (and nothing kept) if it was invalid. */
  close(node: StreamNode): Placed | undefined;
  /** The node as it stands with the children `shown` (`counts` is how many of each kind), or undefined when that is not a valid node yet. */
  shell(node: StreamNode, shown: readonly UiNode[], counts: ReadonlyMap<string, number>): UiNode | undefined;
  /** A tree around a root, with the framing `renderElements` would give it. */
  tree(root: UiNode, revision: number): UiTree;
  /** The end of the document: the same closing steps `renderElements` takes. */
  finish(revision: number): Result<UiTree>;
  /** The errors of a stopped build, with the bound marker. */
  failure(): LiveframeError[];
};

/**
 * Internal: `renderElements`'s single pass, resumable, for `streamElements` (plan 028 Task 7). The
 * caller feeds nodes as they complete, in document order; the steps and their order are the ones
 * `emit` takes, so a stream with no errors ends in exactly the tree `renderElements` builds.
 * Returns the option errors instead when the options are unusable.
 */
export function streamBuild(options: RenderOptions): StreamBuild | LiveframeError[] {
  const { catalogId } = buildFacts(options.validator);
  const ctx = createContext(options, undefined);
  if (!checkOptions(ctx, options)) return ctx.errors;
  addFraming(ctx, options, catalogId);
  const roots: UiNode[] = [];
  const rootSiblings = new Set<string>();
  const scratch: LiveframeError[] = [];
  const scratchSink = { errors: scratch, maxErrors: 1 };
  let silent = true;
  const quiet = {
    reject() {
      silent = false;
    },
  };

  return {
    get stopped() {
      return ctx.stopped;
    },
    errors: ctx.errors,
    open(element, parent) {
      if (ctx.stopped) return;
      const parentId = parent ? parent.id : null;
      if (element.key !== undefined && !isValidKey(element.key)) {
        rejectKey(ctx, undefined, parentId);
        return;
      }
      return openNode(
        ctx,
        element,
        element.key,
        undefined,
        parentId,
        parent ? parent.kind : "",
        parent ? parent.depth + 1 : 1,
        false,
        parent ? parent.siblings : rootSiblings,
        parent ? parent.out : roots,
      );
    },
    whole(element, parent) {
      if (ctx.stopped) return;
      const into = parent ? parent.out : roots;
      const before = into.length;
      const errors = ctx.errors.length;
      const references = ctx.references.length;
      emit(
        ctx,
        element,
        parent ? parent.id : null,
        parent ? parent.kind : "",
        parent ? parent.depth + 1 : 1,
        false,
        parent ? parent.siblings : rootSiblings,
        into,
      );
      if (ctx.errors.length > errors) {
        into.length = before;
        return undefined;
      }
      return { nodes: into.slice(before), references: ctx.references.length > references };
    },
    close(node) {
      if (ctx.stopped) return;
      const before = node.into.length;
      const errors = ctx.errors.length;
      closeNode(ctx, node);
      if (ctx.errors.length > errors) {
        node.into.length = before;
        return undefined;
      }
      // References made while the node's children arrived count too.
      return { nodes: node.into.slice(before), references: ctx.references.length > node.referenceStart };
    },
    shell(node, shown, counts) {
      if (node.hasReferences) return undefined;
      if (node.fieldsValid === undefined) {
        scratch.length = 0;
        node.fieldsValid = options.validator.checkNode(node.record, "", scratchSink);
      }
      if (!node.fieldsValid) return undefined;
      const { structure } = ctx;
      const has = shown.length > 0 ? 1 : 0;
      node.placement ??= [undefined, undefined];
      let placed = node.placement[has];
      if (placed === undefined) {
        silent = true;
        structure.node(node.parentKind, node.kind, node.depth, has === 1, quiet);
        placed = node.placement[has] = silent;
      }
      if (!placed) return undefined;
      if (has) {
        const last = (shown[shown.length - 1] as UiNode).kind;
        if (node.countsLength !== shown.length || node.countsKind !== last) {
          silent = true;
          structure.counts(node.kind, counts, quiet);
          node.countsLength = shown.length;
          node.countsKind = last;
          node.countsValid = silent;
        }
        if (!node.countsValid) return undefined;
      }
      return copyNode(node.record, has ? shown : undefined);
    },
    tree(root, revision) {
      return { format: FORMAT, catalogId, surfaceId: options.surfaceId, revision, root } as UiTree;
    },
    finish(revision) {
      return conclude(ctx, roots, { ...options, revision }, catalogId);
    },
    failure() {
      return finish(ctx);
    },
  };
}

/**
 * One render's state, passed to every step below. A plain object, not closures over locals, so
 * each step is a module-level function with explicit inputs.
 */
type RenderContext = {
  readonly validator: CompiledValidator;
  readonly kinds: ReadonlyMap<string, KindFacts>;
  readonly structure: CompiledBuild["structure"];
  readonly budget: { readonly nodes: number; readonly depth: number; readonly bytes: number };
  readonly maxErrors: number;
  readonly errors: LiveframeError[];
  readonly ids: Set<string>;
  /** Ids of nodes carrying a `when`; a node is gated when it or an ancestor is in here (plan 029 B5.6). */
  readonly gated: Set<string>;
  readonly anchors: Map<string, string>;
  readonly references: { props: Record<string, unknown>; name: string; anchor?: string; id: string; pointer: string }[];
  readonly deferred: { node: UiNode; id: string; pointer: string }[];
  readonly idPointers: Map<string, string>;
  readonly path: (string | number)[];
  readonly ancestors: Set<object>;
  readonly sink: SchemaSink;
  readonly jsonSink: JsonWalk;
  readonly structureSink: { nodeId: string; reject(expected: string, suffix?: string): void };
  readonly sourcePointers: WeakMap<Element, string> | undefined;
  bytes: number;
  nodes: number;
  stopped: boolean;
  bounded: boolean;
  lastNodeId: string;
  /** Pointer of the emitted field `count` is walking; the JSON walk's errors are relative to it. */
  fieldPointer: string;
};

function createContext(options: RenderOptions, sourcePointers: WeakMap<Element, string> | undefined): RenderContext {
  const { kinds, structure } = buildFacts(options.validator);
  const budget = options.limits ? { ...DEFAULT_LIMITS, ...options.limits } : DEFAULT_LIMITS;
  const maxErrors = options.maxErrors ?? DEFAULT_MAX_ERRORS;
  const errors: LiveframeError[] = [];
  const path: (string | number)[] = [];
  const ancestors = new Set<object>();
  const ctx: RenderContext = {
    validator: options.validator,
    kinds,
    structure,
    budget,
    maxErrors,
    errors,
    ids: new Set<string>(),
    gated: new Set<string>(),
    anchors: new Map(),
    references: [],
    deferred: [],
    idPointers: new Map<string, string>(),
    path,
    ancestors,
    sink: { errors, maxErrors, expressions: { nodes: 0 } },
    jsonSink: {
      nodeId: "root",
      ancestors,
      path,
      bytes: 0,
      maximum: budget.bytes,
      stopped: false,
      fail(expected) {
        fail(ctx, "invalid-prop", ctx.fieldPointer + jsonPointer(path), expected, ctx.jsonSink.nodeId);
      },
      limit() {
        limit(
          ctx,
          `a tree of at most ${budget.bytes} UTF-8 JSON bytes`,
          ctx.jsonSink.nodeId,
          ctx.fieldPointer + jsonPointer(path),
        );
      },
    },
    structureSink: {
      nodeId: "root",
      reject(expected: string, suffix = "") {
        const nodeId = ctx.structureSink.nodeId;
        const base = ctx.idPointers.get(nodeId) ?? `/${nodeId}`;
        fail(ctx, "invalid-children", `${base}${suffix}`, expected, nodeId);
      },
    },
    sourcePointers,
    bytes: 0,
    nodes: 0,
    stopped: false,
    bounded: false,
    lastNodeId: "root",
    fieldPointer: "",
  };
  return ctx;
}

/** Checks the options; false after reporting what is wrong with them. */
function checkOptions(ctx: RenderContext, options: RenderOptions): boolean {
  const { surfaceId, revision } = options;
  for (const key of ["nodes", "depth", "bytes"] as const) {
    if (!Number.isSafeInteger(ctx.budget[key]) || ctx.budget[key] < 1)
      fail(ctx, "invalid-prop", "", `limits.${key} to be a positive safe integer`, "root");
  }
  if (!Number.isSafeInteger(ctx.maxErrors) || ctx.maxErrors < 1)
    fail(ctx, "invalid-prop", "", "maxErrors to be a positive safe integer", "root");
  if (typeof surfaceId !== "string" || surfaceId.length === 0 || surfaceId.length > 128)
    fail(ctx, "invalid-prop", "", "a nonempty surfaceId of at most 128 characters", "root");
  if (!Number.isSafeInteger(revision) || revision < 0)
    fail(ctx, "invalid-prop", "", "a revision that is a non-negative safe integer", "root");
  return ctx.errors.length === 0;
}

/** Counts the tree's own framing against the byte budget; false once a limit stopped the build. */
function addFraming(ctx: RenderContext, options: RenderOptions, catalogId: string): boolean {
  addBytes(ctx, BRACKET_BYTES, "/root", "root");
  addBytes(ctx, treeFieldBytes("format", true, stringBytes(FORMAT)), "/root", "root");
  addBytes(ctx, treeFieldBytes("catalogId", false, stringBytes(catalogId)), "/root", "root");
  addBytes(ctx, treeFieldBytes("surfaceId", false, stringBytes(options.surfaceId)), "/root", "root");
  addBytes(ctx, treeFieldBytes("revision", false, String(options.revision).length), "/root", "root");
  addBytes(ctx, treeFieldBytes("root", false, 0), "/root", "root");
  return !ctx.stopped;
}

/** The end of a build: the root count, the closing bracket, forward references, then the tree or the errors. */
function conclude(
  ctx: RenderContext,
  roots: readonly UiNode[],
  options: RenderOptions,
  catalogId: string,
): Result<UiTree> {
  if (roots.length !== 1 && !ctx.stopped) fail(ctx, "invalid-children", "", "exactly one root element", "root");
  addBytes(ctx, BRACKET_BYTES, "", "root");
  resolveReferences(ctx);

  if (ctx.errors.length) return { ok: false, errors: finish(ctx) };
  const { surfaceId, revision } = options;
  const root = roots[0];
  return { ok: true, value: { format: FORMAT, catalogId, surfaceId, revision, root } as UiTree };
}

function renderValue(
  getResult: (inputs: Readonly<Record<string, unknown>>) => unknown,
  inputs: Readonly<Record<string, unknown>>,
  options: RenderOptions,
  validateInputs: boolean,
  sourcePointers?: WeakMap<Element, string>,
): Result<UiTree> {
  const { catalogId } = buildFacts(options.validator);
  const ctx = createContext(options, sourcePointers);
  const { errors } = ctx;

  if (!checkOptions(ctx, options)) return { ok: false, errors };
  const owned = validateInputs ? checkInputs(ctx, inputs) : inputs;
  if (errors.length) return { ok: false, errors: finish(ctx) };
  if (!addFraming(ctx, options, catalogId)) return { ok: false, errors: finish(ctx) };

  let result: unknown;
  try {
    result = getResult(owned);
  } catch (thrown) {
    fail(ctx, "render-failed", "", "the widget to run without throwing", "root", thrownMessage(thrown));
    return { ok: false, errors: finish(ctx) };
  }
  if (isThenable(result)) {
    fail(ctx, "async-render", "", "a synchronous element", "root", "Expected a synchronous element");
    return { ok: false, errors: finish(ctx) };
  }
  if (!isElement(result)) {
    fail(ctx, "invalid-children", "", "one SDK element from the widget", "root");
    return { ok: false, errors: finish(ctx) };
  }
  const roots: UiNode[] = [];
  emit(ctx, result, null, "", 1, false, new Set<string>(), roots);
  return conclude(ctx, roots, options, catalogId);
}

/** Resolves forward references without walking nodes again; empty placeholders counted two bytes. */
function resolveReferences(ctx: RenderContext): void {
  for (const reference of ctx.references) {
    if (ctx.stopped) break;
    const { props, name, anchor, id, pointer } = reference;
    const target = anchor === undefined ? (props[name] as string) : ctx.anchors.get(anchor);
    if (target === undefined || !ctx.ids.has(target))
      fail(ctx, "not-found", pointer, `a node in this tree for reference ${anchor ?? target}`, id);
    else if (isGated(ctx.gated, target))
      fail(
        ctx,
        "invalid-prop",
        pointer,
        `a node that is always rendered, without a when on it or an ancestor: ${target}`,
        id,
      );
    else if (anchor !== undefined) {
      props[name] = target;
      addBytes(ctx, stringBytes(target) - 2, pointer, id);
    }
  }
  if (ctx.errors.length) return;
  for (const { node, id, pointer } of ctx.deferred) {
    if (ctx.stopped) break;
    checkNode(ctx, node, id, pointer);
  }
}

function finish(ctx: RenderContext): LiveframeError[] {
  if (ctx.bounded) addBoundMarker(ctx.errors, ctx.lastNodeId);
  return ctx.errors;
}

function jsonPointer(path: readonly (string | number)[]): string {
  let pointer = "";
  for (const key of path) pointer = at(pointer, key);
  return pointer;
}

function full(ctx: RenderContext): void {
  if (ctx.errors.length >= ctx.maxErrors) ctx.stopped = ctx.bounded = true;
}
function fail(
  ctx: RenderContext,
  kind: LiveframeError["kind"],
  pointer: string,
  expected: string,
  nodeId?: string,
  message = `Expected ${expected}`,
): void {
  if (ctx.stopped) return;
  ctx.errors.push({ kind, pointer, ...(nodeId ? { nodeId } : {}), expected, message });
  if (nodeId) ctx.lastNodeId = nodeId;
  full(ctx);
}
function limit(ctx: RenderContext, expected: string, nodeId: string, pointer: string): void {
  fail(ctx, "limit-exceeded", pointer, expected, nodeId);
  ctx.stopped = true;
}
function addBytes(ctx: RenderContext, amount: number, pointer: string, nodeId: string): void {
  ctx.bytes += amount;
  if (ctx.bytes > ctx.budget.bytes)
    limit(ctx, `a tree of at most ${ctx.budget.bytes} UTF-8 JSON bytes`, nodeId, pointer);
}

/** Byte-counts one emitted JSON value, the same way the tree walker does (spec §10). */
function count(ctx: RenderContext, value: unknown, pointer: string, nodeId: string): void {
  const { jsonSink } = ctx;
  ctx.fieldPointer = pointer;
  jsonSink.nodeId = nodeId;
  jsonSink.bytes = ctx.bytes;
  ctx.path.length = 0;
  walkJson(value, jsonSink);
  ctx.bytes = jsonSink.bytes;
}

/** Where an element that failed before it got an id sits: its parent's input pointer. */
function parentPointer(ctx: RenderContext, parentId: string | null): string {
  return parentId === null ? "" : (ctx.idPointers.get(parentId) ?? `/${parentId}`);
}

/**
 * Rejects a non-JSON value (function, promise, class instance, NaN, cycle) at its pointer, within
 * the depth bound every input walk uses. `composed` is a composed component's node id: its props
 * are data too, so a nested function or promise keeps its own kind (spec §7.1).
 * Optionally builds a frozen copy during this same walk.
 */
function isJson(
  ctx: RenderContext,
  value: unknown,
  pointer: string,
  ancestors: Set<object>,
  composed?: string,
  depth = 0,
  copy?: unknown,
): boolean {
  const reject = (kind: LiveframeError["kind"], expected: string): false => {
    fail(ctx, kind, pointer + jsonPointer(ctx.path), expected, composed);
    return false;
  };
  const shape = shapeOf(value);
  if (shape === "json") return true;
  if (shape === "function") return reject(composed ? "function-prop" : "invalid-prop", "JSON data, not a function");
  if (shape === "promise") return reject(composed ? "async-render" : "invalid-prop", "JSON data, not a promise");
  if (shape === "number") return reject("invalid-prop", "a finite number");
  if (shape === "other") return reject("invalid-prop", "plain JSON data");
  return isJsonContainer(ctx, value as object, pointer, ancestors, composed, depth, reject, copy);
}

/** The recursion half of `isJson`: depth bound, cycle guard, then every child. */
function isJsonContainer(
  ctx: RenderContext,
  value: object,
  pointer: string,
  ancestors: Set<object>,
  composed: string | undefined,
  depth: number,
  reject: (kind: LiveframeError["kind"], expected: string) => false,
  copy?: unknown,
): boolean {
  if (depth >= INPUT_DEPTH) return reject("invalid-prop", `data nested at most ${INPUT_DEPTH} deep`);
  if (ancestors.has(value)) return reject("invalid-prop", "acyclic data");
  ancestors.add(value);
  const { path } = ctx;
  const immutable = copy !== undefined && Object.isFrozen(value);
  let valid = true;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length && valid; i++) {
      path.push(i);
      valid = checkChild(ctx, value[i], pointer, ancestors, composed, depth, copy, i, value, immutable);
      path.pop();
    }
  } else {
    for (const key in value) {
      if (!Object.hasOwn(value, key)) continue;
      path.push(key);
      valid = checkChild(
        ctx,
        (value as Record<string, unknown>)[key],
        pointer,
        ancestors,
        composed,
        depth,
        copy,
        key,
        value,
        immutable,
      );
      path.pop();
      if (!valid) break;
    }
  }
  ancestors.delete(value);
  if (copy !== undefined) {
    Object.freeze(copy);
    if (immutable && !mutableChildren.has(value)) deepFrozen.add(value);
  }
  return valid;
}

/** Cheapest-first classification of one value; `container` means a non-empty recursion is due. */
function shapeOf(value: unknown): "json" | "container" | "function" | "promise" | "number" | "other" {
  if (value === null || typeof value === "string" || typeof value === "boolean") return "json";
  if (typeof value === "number") return Number.isFinite(value) ? "json" : "number";
  if (typeof value === "function") return "function";
  if (isThenable(value)) return "promise";
  return Array.isArray(value) || isRecord(value) ? "container" : "other";
}

const NO_ACTIONS = Object.freeze({});

function checkInputs(ctx: RenderContext, inputs: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const checks = buildFacts(ctx.validator).inputs;
  const owned: Record<string, unknown> = {};
  for (const name of ["params", "state", "context", "data", "actions"] as const) {
    const value = inputs[name];
    if (name === "actions" && value === undefined) {
      owned.actions = NO_ACTIONS; // Absent means no action has reported yet, so existing hosts keep working.
      continue;
    }
    const cached = value !== null && typeof value === "object" ? inputCopies.get(value) : undefined;
    if (cached?.check === checks[name]) {
      owned[name] = cached.copy;
      continue;
    }
    const copy = inputCopy(value);
    const before = ctx.errors.length;
    if (isJson(ctx, value, `/${name}`, ctx.ancestors, undefined, 0, copy)) checks[name](copy, `/${name}`, ctx.sink);
    if (ctx.errors.length === before) {
      owned[name] = copy;
      if (value !== null && typeof value === "object" && deepFrozen.has(value))
        inputCopies.set(value, { check: checks[name], copy });
    }
  }
  return Object.freeze(owned);
}

function dataKind(value: unknown): LiveframeError["kind"] | undefined {
  if (typeof value === "function") return "function-prop";
  if (isThenable(value)) return "async-render";
  return undefined;
}

function children(
  ctx: RenderContext,
  child: unknown,
  parentId: string | null,
  parentKind: string,
  depth: number,
  list: boolean,
  siblings: Set<string>,
  out: UiNode[],
  staticChildren: boolean,
  nesting = 0,
): void {
  if (ctx.stopped || child === null || child === undefined || typeof child === "boolean") return;
  if (Array.isArray(child)) {
    if (nesting > ctx.budget.depth) {
      limit(ctx, `at most ${ctx.budget.depth} nested child arrays`, parentId ?? "root", parentPointer(ctx, parentId));
      return;
    }
    for (const entry of child) {
      if (ctx.stopped) return;
      children(ctx, entry, parentId, parentKind, depth, !staticChildren, siblings, out, false, nesting + 1);
    }
    return;
  }
  emit(ctx, child as Element, parentId, parentKind, depth, list, siblings, out);
}

/**
 * Emits one element: expands composed components, then emits a fragment's children or one checked,
 * byte-counted node. One pass builds, validates and counts each node, so the budget is checked once
 * per node.
 */
function emit(
  ctx: RenderContext,
  start: Element,
  parentId: string | null,
  parentKind: string,
  depth: number,
  requireKey: boolean,
  siblings: Set<string>,
  out: UiNode[],
): void {
  if (ctx.stopped) return;
  const sourcePointer = ctx.sourcePointers?.get(start);
  if (parentId === null && out.length) {
    fail(ctx, "invalid-children", "", "exactly one root element", "root");
    return;
  }
  let element = start;
  let key = start.key;
  if (typeof element.type === "function" && element.type !== Fragment) {
    const expanded = expand(ctx, start, parentId);
    if (!expanded) return;
    [element, key] = expanded;
  }
  if (key !== undefined && !isValidKey(key)) {
    rejectKey(ctx, sourcePointer, parentId);
    return;
  }
  if (element.type === Fragment) {
    emitFragment(ctx, element, key, parentId, parentKind, depth, requireKey, siblings, out);
    return;
  }
  const open = openNode(ctx, element, key, sourcePointer, parentId, parentKind, depth, requireKey, siblings, out);
  if (!open) return;
  if (Object.hasOwn(element.props, "children")) {
    children(
      ctx,
      element.props.children,
      open.id,
      open.kind,
      depth + 1,
      false,
      open.siblings,
      open.out,
      element.staticChildren,
    );
  }
  closeNode(ctx, open);
}

function rejectKey(ctx: RenderContext, sourcePointer: string | undefined, parentId: string | null): void {
  fail(
    ctx,
    "invalid-prop",
    sourcePointer ?? parentPointer(ctx, parentId),
    "a nonempty bounded string without lone surrogates or finite number key",
    parentId ?? "root",
  );
}

/** The node's record with `children`, as a new object: the record itself becomes the final node. */
function copyNode(record: Readonly<Record<string, unknown>>, children: readonly UiNode[] | undefined): UiNode {
  const copy: Record<string, unknown> = { id: record.id, kind: record.kind };
  if (record.variant !== undefined) copy.variant = record.variant;
  copy.props = record.props;
  if (record.style !== undefined) copy.style = record.style;
  if (record.events !== undefined) copy.events = record.events;
  if (record.when !== undefined) copy.when = record.when;
  if (record.bind !== undefined) copy.bind = record.bind;
  if (children) copy.children = children;
  return copy as unknown as UiNode;
}

/** A node whose own fields are classified and whose id is claimed, but whose children are not yet emitted. */
type OpenNode = {
  readonly id: string;
  readonly kind: string;
  readonly pointer: string;
  readonly record: Record<string, unknown>;
  readonly hasReferences: boolean;
  readonly referenceStart: number;
  readonly depth: number;
  readonly parentKind: string;
  /** Where the finished node goes. */
  readonly into: UiNode[];
  /** The node's children as they are emitted, and the ids already taken among them. */
  readonly out: UiNode[];
  readonly siblings: Set<string>;
  /** What a stream learned about the node's own fields and placement, so a shell is checked once. */
  fieldsValid?: boolean;
  placement?: [boolean | undefined, boolean | undefined];
  /** The last children-count check: children only ever arrive, so a length and a last kind identify the counts. */
  countsLength?: number;
  countsKind?: string;
  countsValid?: boolean;
};

/** The first half of a node: kind, id, budgets and its own fields. Undefined after reporting why. */
function openNode(
  ctx: RenderContext,
  element: Element,
  key: Element["key"],
  sourcePointer: string | undefined,
  parentId: string | null,
  parentKind: string,
  depth: number,
  requireKey: boolean,
  siblings: Set<string>,
  into: UiNode[],
): OpenNode | undefined {
  const kind = kindOf(ctx, element, sourcePointer, parentId);
  if (kind === undefined) return;
  const definition = ctx.kinds.get(kind) as KindFacts;
  const segment = siblingSegment(
    ctx,
    key,
    kind,
    requireKey,
    siblings,
    sourcePointer ?? parentPointer(ctx, parentId),
    parentId,
  );
  if (segment === undefined) return;
  const id = parentId === null ? "root" : `${parentId}/${encodeSegment(segment)}`;
  const pointer = sourcePointer ?? `/${id}`;
  if (!admitNode(ctx, id, pointer, depth)) return;

  const referenceStart = ctx.references.length;
  const record = classifyProps(ctx, element, definition, id, kind, pointer);
  if (!record) return;
  return {
    id,
    kind,
    pointer,
    record,
    hasReferences: ctx.references.length !== referenceStart,
    referenceStart,
    depth,
    parentKind,
    into,
    out: [],
    siblings: new Set<string>(),
  };
}

/** The second half: the children rules, the node check and the byte count. Pushes the node into its parent. */
function closeNode(ctx: RenderContext, open: OpenNode): UiNode | undefined {
  const { id, kind, pointer, record, out: childrenOut } = open;
  if (ctx.structure.forbidsChildren(kind) && childrenOut.length)
    fail(ctx, "invalid-children", `${pointer}/children`, "no children for this kind", id);
  checkStructure(ctx, id, kind, open.parentKind, open.depth, childrenOut);
  if (ctx.stopped) return;
  if (childrenOut.length) record.children = childrenOut;
  const node = record as unknown as UiNode;
  checkNode(ctx, node, id, pointer, open.hasReferences);
  countNode(ctx, record, id, kind, pointer, childrenOut.length);
  open.into.push(node);
  return node;
}

/**
 * Expands composed components until a primitive or fragment remains, returning it with the first key
 * along the chain. Composed components are ordinary functions: expand them here, never inside `jsx`
 * (spec §7.1).
 */
function expand(
  ctx: RenderContext,
  start: Element,
  parentId: string | null,
): readonly [Element, Element["key"]] | undefined {
  const at = parentPointer(ctx, parentId);
  const nodeId = parentId ?? "root";
  let element = start;
  let key = start.key;
  let expansion = 0;
  while (typeof element.type === "function" && element.type !== Fragment) {
    if (++expansion > ctx.budget.depth) {
      limit(ctx, `at most ${ctx.budget.depth} component expansions`, nodeId, at);
      return;
    }
    // A composed component sees its props as data, so the whole value is checked: a callback
    // nested in one it would discard is still not JSON (spec §7.1).
    for (const name in element.props) {
      if (name === "children" || !Object.hasOwn(element.props, name)) continue;
      ctx.path.push(name);
      const valid = isJson(ctx, element.props[name], at, ctx.ancestors, nodeId);
      ctx.path.pop();
      if (!valid && ctx.stopped) return;
    }
    let expanded: unknown;
    try {
      expanded = (element.type as (props: Record<string, unknown>) => unknown)(element.props);
    } catch (thrown) {
      fail(ctx, "render-failed", at, "the widget to run without throwing", nodeId, thrownMessage(thrown));
      return;
    }
    if (isThenable(expanded)) {
      fail(ctx, "async-render", at, "a synchronous element", nodeId, "Expected a synchronous element");
      return;
    }
    if (!isElement(expanded)) {
      fail(ctx, "unknown-component", at, "one SDK element from a component", nodeId);
      return;
    }
    element = expanded;
    key ??= element.key;
  }
  return [element, key];
}

function isValidKey(key: unknown): boolean {
  const text = typeof key === "number" && Number.isFinite(key) ? String(key) : typeof key === "string" ? key : "";
  return text.length > 0 && text.length <= 128 && !/[\ud800-\udfff]/u.test(text);
}

/** A fragment adds no node: it checks its own props and key, then emits its children in place. */
function emitFragment(
  ctx: RenderContext,
  element: Element,
  key: Element["key"],
  parentId: string | null,
  parentKind: string,
  depth: number,
  requireKey: boolean,
  siblings: Set<string>,
  out: UiNode[],
): void {
  const at = parentPointer(ctx, parentId);
  const nodeId = parentId ?? "root";
  for (const name in element.props) {
    if (name === "children" || !Object.hasOwn(element.props, name)) continue;
    fail(ctx, "invalid-prop", `${at}/${name}`, "only children and a key on a fragment", nodeId);
    return;
  }
  if (requireKey && key === undefined) {
    fail(ctx, "missing-key", at, "a key on every element in a list", nodeId);
    return;
  }
  if (key !== undefined) {
    const segment = String(key);
    if (siblings.has(segment)) {
      fail(ctx, "duplicate-key", at, "siblings with distinct keys", nodeId);
      return;
    }
    siblings.add(segment);
  }
  // A keyed fragment scopes ids without adding a primitive to the tree.
  const fragmentId = key === undefined || parentId === null ? parentId : `${parentId}/${encodeSegment(String(key))}`;
  children(
    ctx,
    element.props.children,
    fragmentId,
    parentKind,
    depth,
    false,
    key === undefined ? siblings : new Set<string>(),
    out,
    element.staticChildren,
  );
}

/** The element's catalog kind, or undefined after reporting a host element or an unknown kind. */
function kindOf(
  ctx: RenderContext,
  element: Element,
  sourcePointer: string | undefined,
  parentId: string | null,
): string | undefined {
  if (typeof element.type === "string") {
    fail(
      ctx,
      "host-element",
      sourcePointer ?? parentPointer(ctx, parentId),
      `no host element <${element.type}>`,
      parentId ?? "root",
    );
    return;
  }
  const kind = isRecord(element.type) ? element.type.kind : undefined;
  if (typeof kind !== "string" || !ctx.kinds.has(kind)) {
    fail(
      ctx,
      "unknown-component",
      sourcePointer ?? parentPointer(ctx, parentId),
      `a catalog kind: ${[...ctx.kinds.keys()].join(", ")}`,
      parentId ?? "root",
    );
    return;
  }
  return kind;
}

/** The node's id segment among its siblings (its key, else its kind), or undefined after a key error. */
function siblingSegment(
  ctx: RenderContext,
  key: Element["key"],
  kind: string,
  requireKey: boolean,
  siblings: Set<string>,
  at: string,
  parentId: string | null,
): string | undefined {
  if (requireKey && key === undefined) {
    fail(ctx, "missing-key", at, "a key on every element in a list", parentId ?? "root");
    return;
  }
  const segment = key === undefined ? kind : String(key);
  if (siblings.has(segment)) {
    fail(
      ctx,
      key === undefined ? "missing-key" : "duplicate-key",
      at,
      "siblings with distinct keys",
      parentId ?? "root",
    );
    return;
  }
  siblings.add(segment);
  return segment;
}

/** Claims the id and counts the node against the node and depth budgets. */
function admitNode(ctx: RenderContext, id: string, pointer: string, depth: number): boolean {
  if (ctx.ids.has(id)) {
    fail(ctx, "duplicate-key", ctx.sourcePointers ? pointer : `${pointer}/id`, "a unique key-path id", id);
    return false;
  }
  ctx.ids.add(id);
  ctx.idPointers.set(id, pointer);
  const { budget } = ctx;
  if (ctx.nodes >= budget.nodes) {
    limit(ctx, `at most ${budget.nodes} nodes`, id, pointer);
    return false;
  }
  if (depth > budget.depth) {
    limit(ctx, `at most ${budget.depth} node levels (root is level 1)`, id, pointer);
    return false;
  }
  ctx.nodes++;
  return true;
}

/** Consumes author-only anchors and reference markers before normal prop classification. */
function authorReference(
  ctx: RenderContext,
  props: Record<string, unknown>,
  definition: KindFacts,
  name: string,
  entry: unknown,
  id: string,
  pointer: string,
): boolean {
  if (name !== "$anchor" && !definition.refProps?.has(name)) return false;
  if (name === "$anchor") {
    if (typeof entry !== "string") fail(ctx, "invalid-prop", `${pointer}/$anchor`, "a string anchor", id);
    else if (ctx.anchors.has(entry)) fail(ctx, "duplicate-key", `${pointer}/$anchor`, "a tree-unique anchor", id);
    else ctx.anchors.set(entry, id);
    return true;
  }
  const marker =
    isRecord(entry) &&
    (Object.getPrototypeOf(entry) === Object.prototype || Object.getPrototypeOf(entry) === null) &&
    Object.keys(entry).length === 1 &&
    Object.hasOwn(entry, "$ref") &&
    typeof entry.$ref === "string";
  if (!marker && typeof entry !== "string") return false;
  props[name] = marker ? "" : entry;
  ctx.references.push({
    props,
    name,
    ...(marker ? { anchor: entry.$ref as string } : {}),
    id,
    pointer: at(`${pointer}/props`, name),
  });
  return true;
}

/** Adds a node's `when` and `bind`, which must be JSON data like any prop; undefined after reporting why not. */
function attachExpressions(
  ctx: RenderContext,
  record: Record<string, unknown>,
  props: Readonly<Record<string, unknown>>,
  id: string,
  pointer: string,
): Record<string, unknown> | undefined {
  for (const name of ["when", "bind"] as const) {
    const entry = Object.hasOwn(props, name) ? props[name] : undefined;
    if (entry === undefined) continue;
    const rejected = dataKind(entry);
    if (rejected) {
      fail(ctx, rejected, `${pointer}/${name}`, "JSON data, not a function or a promise", id);
      if (ctx.stopped) return;
      continue;
    }
    record[name] = entry;
    if (name === "when") ctx.gated.add(id);
  }
  return record;
}

/** Element attributes that are never props: children, and the node's browser-evaluated expressions (plan 029 B1). */
const NOT_PROPS: ReadonlySet<string> = new Set(["children", "when", "bind"]);

/** Sorts props into wire sections, rejecting function and promise values. */
function classifyProps(
  ctx: RenderContext,
  element: Element,
  definition: KindFacts,
  id: string,
  kind: string,
  pointer: string,
): Record<string, unknown> | undefined {
  const props: Record<string, unknown> = {};
  const style: Record<string, unknown> = {};
  const events: Record<string, unknown> = {};
  let variant: unknown;
  let hasVariant = false;
  let hasStyle = false;
  let hasEvents = false;
  for (const name in element.props) {
    if (NOT_PROPS.has(name) || !Object.hasOwn(element.props, name)) continue;
    const entry = element.props[name];
    if (authorReference(ctx, props, definition, name, entry, id, pointer)) continue;
    const target = propTarget(definition, name);
    const rejected = dataKind(entry);
    if (rejected) {
      const data = rejected === "function-prop" ? "JSON data, not a function" : "JSON data, not a promise";
      fail(ctx, rejected, `${pointer}/${target}/${name}`, data, id);
      if (ctx.stopped) return;
      continue;
    }
    if (target === "variant") {
      variant = entry;
      hasVariant = true;
    } else if (target === "events") {
      events[name] = entry;
      hasEvents = true;
    } else if (target === "style") {
      style[name] = entry;
      hasStyle = true;
    } else props[name] = entry;
  }
  const record: Record<string, unknown> = { id, kind };
  if (hasVariant) record.variant = variant;
  record.props = props;
  if (hasStyle) record.style = style;
  if (hasEvents) record.events = events;
  return attachExpressions(ctx, record, element.props, id, pointer);
}

/** The node's place under its parent, and its children's counts (spec §5). */
function checkStructure(
  ctx: RenderContext,
  id: string,
  kind: string,
  parentKind: string,
  depth: number,
  childrenOut: readonly UiNode[],
): void {
  const { structure, structureSink } = ctx;
  structureSink.nodeId = id;
  structure.node(parentKind, kind, depth, childrenOut.length > 0, structureSink);
  if (childrenOut.length) {
    const tally = newTally();
    for (const child of childrenOut) tallyKind(tally, child.kind, child.when !== undefined);
    structure.counts(kind, tally.all, structureSink, tally.gated);
  }
}

/** The compiled node check, its errors rebased onto the node's pointer. */
function checkNode(ctx: RenderContext, node: UiNode, id: string, pointer: string, defer = false): void {
  if (defer) {
    ctx.deferred.push({ node, id, pointer });
    return;
  }
  const { errors } = ctx;
  const before = errors.length;
  ctx.validator.checkNode(node, "", ctx.sink);
  if (errors.length > before) {
    for (let i = before; i < errors.length; i++) {
      const error = errors[i];
      if (error) errors[i] = { ...error, pointer: `${pointer}${error.pointer}` };
    }
    ctx.lastNodeId = id;
    full(ctx);
  }
}

/** The node's bytes: its shell from the framing rules, and its values through the shared JSON walk. */
function countNode(
  ctx: RenderContext,
  record: Readonly<Record<string, unknown>>,
  id: string,
  kind: string,
  pointer: string,
  childCount: number,
): void {
  addBytes(ctx, nodeOpenBytes(id, kind), pointer, id);
  if (Object.hasOwn(record, "variant")) {
    addBytes(ctx, VARIANT_MEMBER_BYTES, `${pointer}/variant`, id);
    count(ctx, record.variant, `${pointer}/variant`, id);
  }
  addBytes(ctx, PROPS_MEMBER_BYTES, `${pointer}/props`, id);
  count(ctx, record.props, `${pointer}/props`, id);
  if (Object.hasOwn(record, "style")) {
    addBytes(ctx, STYLE_MEMBER_BYTES, `${pointer}/style`, id);
    count(ctx, record.style, `${pointer}/style`, id);
  }
  if (Object.hasOwn(record, "events")) {
    addBytes(ctx, EVENTS_MEMBER_BYTES, `${pointer}/events`, id);
    count(ctx, record.events, `${pointer}/events`, id);
  }
  if (Object.hasOwn(record, "when")) {
    addBytes(ctx, WHEN_MEMBER_BYTES, `${pointer}/when`, id);
    count(ctx, record.when, `${pointer}/when`, id);
  }
  if (Object.hasOwn(record, "bind")) {
    addBytes(ctx, BIND_MEMBER_BYTES, `${pointer}/bind`, id);
    count(ctx, record.bind, `${pointer}/bind`, id);
  }
  addBytes(ctx, BRACKET_BYTES, pointer, id);
  if (childCount) addBytes(ctx, childrenFramingBytes(childCount), `${pointer}/children`, id);
}

function inputCopy(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  return Array.isArray(value) ? [] : Object.create(null);
}

function checkChild(
  ctx: RenderContext,
  child: unknown,
  pointer: string,
  ancestors: Set<object>,
  composed: string | undefined,
  depth: number,
  copy: unknown,
  key: string | number,
  parent: object,
  immutable: boolean,
): boolean {
  const owned = copy === undefined ? undefined : inputCopy(child);
  const valid = isJson(ctx, child, pointer, ancestors, composed, depth + 1, owned);
  if (copy !== undefined) {
    (copy as Record<string | number, unknown>)[key] = owned;
    if (
      (child !== null && typeof child === "object" && !deepFrozen.has(child)) ||
      (immutable && !Object.hasOwn(Object.getOwnPropertyDescriptor(parent, key) ?? {}, "value"))
    )
      mutableChildren.add(parent);
  }
  return valid;
}
