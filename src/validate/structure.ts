import type { Catalog } from "../formats/catalog.ts";
import { stringBytes } from "./bytes.ts";

/**
 * A key path is `root` plus one encoded segment per element below it (spec §7.1, §9).
 * `encodeSegment` writes it; this grammar accepts it.
 */
export const keyPath = /^(?:[a-zA-Z0-9_.!~*'():-]|%[0-9A-F]{2})+(?:\/(?:[a-zA-Z0-9_.!~*'():-]|%[0-9A-F]{2})+)*$/;

/**
 * Encodes one key-path segment. Keys and kinds may contain `/`, spaces or CJK; the
 * grammar's own characters stay readable, so a key `row:4812` keeps its colon (spec §7.1).
 */
export function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replaceAll("%3A", ":");
}

export type ChildBounds = { readonly min: number; readonly max: number };
export type ChildRules = "any" | "none" | ReadonlyMap<string, ChildBounds>;

/** Reports a violated structural rule; `pointer` is relative to the node. */
export type StructureSink = { readonly reject: (expected: string, pointer?: string) => void };

/**
 * The structural rules a catalog declares, compiled once. The validator walk and
 * `render()`'s builder share this, so a rule has one owner and owes one message.
 */
export type CompiledStructure = {
  readonly children: ReadonlyMap<string, ChildRules>;
  /**
   * Rejects a node's placement under its parent, the `terms` rule, and the children
   * its kind requires but does not have. `depth` 1 is the root, which has no parent.
   */
  node(parentKind: string, childKind: string, depth: number, hasChildren: boolean, sink: StructureSink): void;
  /** Rejects a parent's children that break their min or max counts. */
  counts(parentKind: string, counts: ReadonlyMap<string, number>, sink: StructureSink): void;
  /** True when the kind forbids children. */
  forbidsChildren(kind: string): boolean;
};

export function compileStructure(catalog: Catalog): CompiledStructure {
  const children = new Map<string, ChildRules>(
    catalog.definitions.map((definition) => [
      definition.kind,
      typeof definition.children === "string"
        ? definition.children
        : new Map(definition.children.map((rule) => [rule.kind, rule])),
    ]),
  );
  // Failure text is compiled once: the walk only builds it when a rule is broken.
  const placementExpected = new Map<string, string>();
  const missingExpected = new Map<string, readonly string[]>();
  for (const [kind, rule] of children) {
    if (typeof rule === "string") continue;
    placementExpected.set(kind, `a child kind declared by ${kind}: ${[...rule.keys()].join(", ") || "none"}`);
    const required = [...rule]
      .filter(([, bounds]) => bounds.min > 0)
      .map(([childKind, bounds]) => `at least ${bounds.min} ${childKind} children`);
    if (required.length) missingExpected.set(kind, required);
  }
  return {
    children,
    node(parentKind, childKind, depth, hasChildren, sink) {
      const term = childKind === "term" || childKind === "detail";
      if (term && parentKind !== "terms") sink.reject("term and detail nodes directly inside terms", "/kind");
      else if (!term && parentKind === "terms") sink.reject("only term or detail children inside terms", "/kind");
      if (depth > 1) {
        const rule = children.get(parentKind);
        if (rule !== undefined && typeof rule !== "string" && !rule.has(childKind)) {
          const expected = placementExpected.get(parentKind);
          if (expected) sink.reject(expected, "/kind");
        }
      }
      if (!hasChildren) {
        const required = missingExpected.get(childKind);
        if (required) for (const expected of required) sink.reject(expected, "/children");
      }
    },
    counts(parentKind, counts, sink) {
      const rule = children.get(parentKind);
      if (rule === undefined || typeof rule === "string") return;
      for (const [kind, bounds] of rule) {
        const count = counts.get(kind) ?? 0;
        if (count < bounds.min || count > bounds.max)
          sink.reject(`between ${bounds.min} and ${bounds.max} ${kind} children`);
      }
    },
    forbidsChildren(kind) {
      return children.get(kind) === "none";
    },
  };
}

/** Bytes of a JSON scalar (`JSON.stringify` length), or undefined when it is not one. */
export function jsonScalarBytes(value: unknown, maximum: number): number | undefined {
  if (value === null) return 4;
  if (typeof value === "string") return stringBytes(value, maximum);
  if (typeof value === "boolean") return value ? 4 : 5;
  if (typeof value === "number" && Number.isFinite(value)) return String(value).length;
  return undefined;
}

/**
 * A JSON walk's shared state. The validator and `render()`'s builder each supply
 * one, so value rules and byte counting have one owner and no per-value setup.
 * Fields are read and written directly: this walk is on the render hot path.
 */
export type JsonWalk = {
  readonly ancestors: Set<object>;
  readonly path: (string | number)[];
  /** Node id any error is attributed to; the caller keeps it current. */
  nodeId: string;
  /** Bytes counted so far in the whole tree, and the limit they may not pass. */
  bytes: number;
  readonly maximum: number;
  /** Set once the byte limit or an error bound ends the walk. */
  stopped: boolean;
  /** Cold: reports a broken value rule. */
  fail(expected: string): void;
  /** Cold: reports the byte limit. */
  limit(): void;
};

/**
 * Checks one JSON value and counts its UTF-8 `JSON.stringify` bytes without
 * serialising: plain objects only, acyclic, finite numbers, `stringBytes` strings.
 */
export function walkJson(value: unknown, ctx: JsonWalk): void {
  const scalar = jsonScalarBytes(value, ctx.maximum - ctx.bytes);
  if (scalar !== undefined) {
    ctx.bytes += scalar;
    if (ctx.bytes > ctx.maximum) {
      ctx.limit();
      ctx.stopped = true;
    }
    return;
  }
  if (value === null || typeof value !== "object") {
    ctx.fail("a JSON value");
    return;
  }
  if (ctx.ancestors.has(value)) {
    ctx.fail("an acyclic JSON tree");
    return;
  }
  const array = Array.isArray(value);
  if (!array) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      ctx.fail("a plain JSON object");
      return;
    }
  }
  ctx.ancestors.add(value);
  ctx.bytes += 2;
  if (ctx.bytes > ctx.maximum) {
    ctx.limit();
    ctx.stopped = true;
    return;
  }
  if (array) {
    for (let i = 0; i < value.length && !ctx.stopped; i++) {
      ctx.path.push(i);
      if (i) {
        ctx.bytes += 1;
        if (ctx.bytes > ctx.maximum) {
          ctx.limit();
          ctx.stopped = true;
        }
      }
      if (ctx.stopped) {
        ctx.path.pop();
        break;
      }
      walkJson(value[i], ctx);
      ctx.path.pop();
    }
  } else {
    let first = true;
    for (const key in value) {
      if (ctx.stopped) break;
      if (!Object.hasOwn(value, key)) continue;
      ctx.path.push(key);
      ctx.bytes += stringBytes(key, ctx.maximum - ctx.bytes) + 1 + (first ? 0 : 1);
      first = false;
      if (ctx.bytes > ctx.maximum) {
        ctx.limit();
        ctx.stopped = true;
        ctx.path.pop();
        break;
      }
      walkJson((value as Record<string, unknown>)[key], ctx);
      ctx.path.pop();
    }
  }
  ctx.ancestors.delete(value);
}
