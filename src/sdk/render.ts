import { addBoundMarker, DEFAULT_MAX_ERRORS, type LiveframeError, type Result } from "../errors.ts";
import { at, isRecord } from "../formats/capabilities.ts";
import type { UiNode, UiTree } from "../formats/tree.ts";
import { stringBytes } from "../validate/bytes.ts";
import type { CompiledValidator, KindFacts } from "../validate/compile.ts";
import type { SchemaSink } from "../validate/schema.ts";
import { encodeSegment, type JsonWalk, walkJson } from "../validate/structure.ts";
import { DEFAULT_LIMITS } from "../validate/tree.ts";
import { type Element, isElement } from "./element.ts";
import { Fragment } from "./jsx-runtime.ts";
import type { WidgetProps } from "./types.ts";

const FORMAT = "liveframe/1" as const;

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

function isThenable(value: unknown): boolean {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function thrownMessage(thrown: unknown): string {
  const message = thrown instanceof Error && thrown.message ? thrown.message : String(thrown);
  return message.length > 500 ? `${message.slice(0, 500)}…` : message;
}

/**
 * Runs the widget once and builds its tree, checking every node as it is emitted (spec §7.2,
 * §10): ids, props, intents, child rules, and the node, depth and byte budgets.
 */
export function render<P, S, D, C>(
  widget: (props: WidgetProps<P, S, D, C>) => unknown,
  inputs: WidgetProps<P, S, D, C>,
  options: RenderOptions,
): Result<UiTree> {
  const { validator, surfaceId, revision } = options;
  const { catalogId, kinds, structure } = validator.build;
  const budget = { ...DEFAULT_LIMITS, ...options.limits };
  const maxErrors = options.maxErrors ?? DEFAULT_MAX_ERRORS;
  const errors: LiveframeError[] = [];
  const ids = new Set<string>();
  const path: (string | number)[] = [];
  const ancestors = new Set<object>();
  const sink: SchemaSink = { errors, maxErrors };
  let bytes = 0;
  let nodes = 0;
  let stopped = false;
  let bounded = false;
  let lastNodeId = "root";
  let fieldPointer = "";

  function jsonPointer(): string {
    let pointer = "";
    for (const key of path) pointer = at(pointer, key);
    return pointer;
  }

  const jsonSink: JsonWalk = {
    nodeId: "root",
    ancestors,
    path,
    bytes: 0,
    maximum: budget.bytes,
    stopped: false,
    fail(expected) {
      fail("invalid-prop", fieldPointer + jsonPointer(), expected, jsonSink.nodeId);
    },
    limit() {
      limit(`a tree of at most ${budget.bytes} UTF-8 JSON bytes`, jsonSink.nodeId, fieldPointer + jsonPointer());
    },
  };
  const structureSink = {
    nodeId: "root",
    reject(expected: string, suffix = "") {
      fail("invalid-children", `/${structureSink.nodeId}${suffix}`, expected, structureSink.nodeId);
    },
  };

  function full(): void {
    if (errors.length >= maxErrors) stopped = bounded = true;
  }
  function fail(
    kind: LiveframeError["kind"],
    pointer: string,
    expected: string,
    nodeId?: string,
    message = `Expected ${expected}`,
  ): void {
    if (stopped) return;
    errors.push({ kind, pointer, ...(nodeId ? { nodeId } : {}), expected, message });
    if (nodeId) lastNodeId = nodeId;
    full();
  }
  function limit(expected: string, nodeId: string, pointer: string): void {
    fail("limit-exceeded", pointer, expected, nodeId);
    stopped = true;
  }
  function addBytes(amount: number, pointer: string, nodeId: string): void {
    bytes += amount;
    if (bytes > budget.bytes) limit(`a tree of at most ${budget.bytes} UTF-8 JSON bytes`, nodeId, pointer);
  }

  /** Byte-counts one emitted JSON value, the same way the tree walker does (spec §10). */
  function count(value: unknown, pointer: string, nodeId: string): void {
    fieldPointer = pointer;
    jsonSink.nodeId = nodeId;
    jsonSink.bytes = bytes;
    path.length = 0;
    walkJson(value, jsonSink);
    bytes = jsonSink.bytes;
  }

  /** Where an element that failed before it got an id sits: its parent's node id path. */
  function parentPointer(parentId: string | null): string {
    return parentId === null ? "" : `/${parentId}`;
  }

  function dataKind(value: unknown): LiveframeError["kind"] | undefined {
    if (typeof value === "function") return "function-prop";
    if (isThenable(value)) return "async-render";
    return undefined;
  }

  function children(
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
    if (stopped || child === null || child === undefined || typeof child === "boolean") return;
    if (Array.isArray(child)) {
      if (nesting > budget.depth) {
        limit(`at most ${budget.depth} nested child arrays`, parentId ?? "root", parentPointer(parentId));
        return;
      }
      for (const entry of child) {
        if (stopped) return;
        children(entry, parentId, parentKind, depth, !staticChildren, siblings, out, false, nesting + 1);
      }
      return;
    }
    emit(child as Element, parentId, parentKind, depth, list, siblings, out);
  }

  function emit(
    start: Element,
    parentId: string | null,
    parentKind: string,
    depth: number,
    requireKey: boolean,
    siblings: Set<string>,
    out: UiNode[],
  ): void {
    if (stopped) return;
    if (parentId === null && out.length) {
      fail("invalid-children", "", "exactly one root element", "root");
      return;
    }
    let element = start;
    let key = element.key;
    let expansion = 0;
    // Composed components are ordinary functions: expand them here, never inside `jsx` (spec §7.1).
    while (typeof element.type === "function" && element.type !== Fragment) {
      if (++expansion > budget.depth) {
        limit(`at most ${budget.depth} component expansions`, parentId ?? "root", parentPointer(parentId));
        return;
      }
      for (const name in element.props) {
        if (name === "children" || !Object.hasOwn(element.props, name)) continue;
        const kind = dataKind(element.props[name]);
        if (!kind) continue;
        const data = kind === "function-prop" ? "JSON data, not a function" : "JSON data, not a promise";
        fail(kind, `${parentPointer(parentId)}/${name}`, data, parentId ?? "root");
        if (stopped) return;
      }
      let expanded: unknown;
      try {
        expanded = (element.type as (props: Record<string, unknown>) => unknown)(element.props);
      } catch (thrown) {
        fail(
          "render-failed",
          parentPointer(parentId),
          "the widget to run without throwing",
          parentId ?? "root",
          thrownMessage(thrown),
        );
        return;
      }
      if (isThenable(expanded)) {
        fail(
          "async-render",
          parentPointer(parentId),
          "a synchronous element",
          parentId ?? "root",
          "Expected a synchronous element",
        );
        return;
      }
      if (!isElement(expanded)) {
        fail("unknown-component", parentPointer(parentId), "one SDK element from a component", parentId ?? "root");
        return;
      }
      element = expanded;
      key ??= element.key;
    }
    if (key !== undefined) {
      const text = typeof key === "number" && Number.isFinite(key) ? String(key) : typeof key === "string" ? key : "";
      if (text.length === 0 || text.length > 128) {
        fail(
          "invalid-prop",
          parentPointer(parentId),
          "a nonempty bounded string or finite number key",
          parentId ?? "root",
        );
        return;
      }
    }
    if (element.type === Fragment) {
      for (const name in element.props) {
        if (name === "children" || !Object.hasOwn(element.props, name)) continue;
        fail(
          "invalid-prop",
          `${parentPointer(parentId)}/${name}`,
          "only children and a key on a fragment",
          parentId ?? "root",
        );
        return;
      }
      children(
        element.props.children,
        parentId,
        parentKind,
        depth,
        false,
        key === undefined ? siblings : new Set<string>(),
        out,
        element.staticChildren,
      );
      return;
    }

    const kind = typeof element.type === "string" ? undefined : isRecord(element.type) ? element.type.kind : undefined;
    if (typeof element.type === "string") {
      fail("host-element", parentPointer(parentId), `no host element <${element.type}>`, parentId ?? "root");
      return;
    }
    const definition: KindFacts | undefined = typeof kind === "string" ? kinds.get(kind) : undefined;
    if (typeof kind !== "string" || !definition) {
      fail(
        "unknown-component",
        parentPointer(parentId),
        `a catalog kind: ${[...kinds.keys()].join(", ")}`,
        parentId ?? "root",
      );
      return;
    }

    if (requireKey && key === undefined) {
      fail("missing-key", parentPointer(parentId), "a key on every element in a list", parentId ?? "root");
      return;
    }
    const segment = key === undefined ? kind : String(key);
    if (siblings.has(segment)) {
      fail(
        key === undefined ? "missing-key" : "duplicate-key",
        parentPointer(parentId),
        "siblings with distinct keys",
        parentId ?? "root",
      );
      return;
    }
    siblings.add(segment);
    const id = parentId === null ? "root" : `${parentId}/${encodeSegment(segment)}`;
    const pointer = `/${id}`;
    if (ids.has(id)) {
      fail("duplicate-key", `${pointer}/id`, "a unique key-path id", id);
      return;
    }
    ids.add(id);
    if (nodes >= budget.nodes) {
      limit(`at most ${budget.nodes} nodes`, id, pointer);
      return;
    }
    if (depth > budget.depth) {
      limit(`at most ${budget.depth} node levels (root is level 1)`, id, pointer);
      return;
    }
    nodes++;

    const props: Record<string, unknown> = {};
    const style: Record<string, unknown> = {};
    const events: Record<string, unknown> = {};
    let variant: unknown;
    let hasVariant = false;
    for (const name in element.props) {
      if (name === "children" || !Object.hasOwn(element.props, name)) continue;
      const entry = element.props[name];
      const target =
        name === "variant"
          ? "variant"
          : definition.events.has(name) || /^on[A-Z]/.test(name)
            ? "events"
            : definition.styleProps.has(name)
              ? "style"
              : "props";
      const kindOf = dataKind(entry);
      if (kindOf) {
        const data = kindOf === "function-prop" ? "JSON data, not a function" : "JSON data, not a promise";
        fail(kindOf, `${pointer}/${target}/${name}`, data, id);
        if (stopped) return;
        continue;
      }
      if (target === "variant") {
        variant = entry;
        hasVariant = true;
      } else if (target === "events") events[name] = entry;
      else if (target === "style") style[name] = entry;
      else props[name] = entry;
    }

    const childrenOut: UiNode[] = [];
    if (Object.hasOwn(element.props, "children")) {
      children(
        element.props.children,
        id,
        kind,
        depth + 1,
        false,
        new Set<string>(),
        childrenOut,
        element.staticChildren,
      );
      if (structure.forbidsChildren(kind) && childrenOut.length)
        fail("invalid-children", `${pointer}/children`, "no children for this kind", id);
    }
    structureSink.nodeId = id;
    structure.node(parentKind, kind, depth, childrenOut.length > 0, structureSink);
    if (childrenOut.length) {
      const counts = new Map<string, number>();
      for (const child of childrenOut) counts.set(child.kind, (counts.get(child.kind) ?? 0) + 1);
      structure.counts(kind, counts, structureSink);
    }
    if (stopped) return;

    const node = {
      id,
      kind,
      ...(hasVariant ? { variant } : {}),
      props,
      ...(Object.keys(style).length ? { style } : {}),
      ...(Object.keys(events).length ? { events } : {}),
      ...(childrenOut.length ? { children: childrenOut } : {}),
    } as unknown as UiNode;

    const before = errors.length;
    validator.checkNode(node, "", sink);
    if (errors.length > before) {
      for (let i = before; i < errors.length; i++) {
        const error = errors[i];
        if (error) errors[i] = { ...error, pointer: `${pointer}${error.pointer}` };
      }
      lastNodeId = id;
      full();
    }

    const skeleton: Record<string, unknown> = { id, kind };
    if (hasVariant) skeleton.variant = variant;
    skeleton.props = props;
    if (Object.keys(style).length) skeleton.style = style;
    if (Object.keys(events).length) skeleton.events = events;
    count(skeleton, pointer, id);
    if (childrenOut.length) {
      addBytes(1 + stringBytes("children") + 1 + 1, `${pointer}/children`, id);
      for (let i = 1; i < childrenOut.length; i++) addBytes(1, `${pointer}/children`, id);
      addBytes(1, `${pointer}/children`, id);
    }
    out.push(node);
  }

  for (const key of ["nodes", "depth", "bytes"] as const) {
    if (!Number.isSafeInteger(budget[key]) || budget[key] < 1)
      fail("invalid-prop", "", `limits.${key} to be a positive safe integer`, "root");
  }
  if (!Number.isSafeInteger(maxErrors) || maxErrors < 1)
    fail("invalid-prop", "", "maxErrors to be a positive safe integer", "root");
  if (typeof surfaceId !== "string" || surfaceId.length === 0 || surfaceId.length > 128)
    fail("invalid-prop", "", "a nonempty surfaceId of at most 128 characters", "root");
  if (!Number.isSafeInteger(revision) || revision < 0)
    fail("invalid-prop", "", "a revision that is a non-negative safe integer", "root");
  if (errors.length) return { ok: false, errors };

  let firstField = true;
  function treeField(name: string, valueBytes: number): void {
    addBytes((firstField ? 0 : 1) + stringBytes(name) + 1 + valueBytes, "/root", "root");
    firstField = false;
  }
  addBytes(1, "/root", "root");
  treeField("format", stringBytes(FORMAT));
  treeField("catalogId", stringBytes(catalogId));
  treeField("surfaceId", stringBytes(surfaceId));
  treeField("revision", String(revision).length);
  treeField("root", 0);
  if (stopped) return { ok: false, errors: finish() };

  let result: unknown;
  try {
    result = widget(inputs);
  } catch (thrown) {
    fail("render-failed", "", "the widget to run without throwing", "root", thrownMessage(thrown));
    return { ok: false, errors: finish() };
  }
  if (isThenable(result)) {
    fail("async-render", "", "a synchronous element", "root", "Expected a synchronous element");
    return { ok: false, errors: finish() };
  }
  if (!isElement(result)) {
    fail("invalid-children", "", "one SDK element from the widget", "root");
    return { ok: false, errors: finish() };
  }
  const roots: UiNode[] = [];
  emit(result, null, "", 1, false, new Set<string>(), roots);
  if (roots.length !== 1 && !stopped) fail("invalid-children", "", "exactly one root element", "root");
  addBytes(1, "", "root");

  function finish(): LiveframeError[] {
    if (bounded) addBoundMarker(errors, lastNodeId);
    return errors;
  }
  if (errors.length) return { ok: false, errors: finish() };
  const root = roots[0];
  return { ok: true, value: { format: FORMAT, catalogId, surfaceId, revision, root } as UiTree };
}
