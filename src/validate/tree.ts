import { addBoundMarker, DEFAULT_MAX_ERRORS, type LiveframeError, type Result } from "../errors.ts";
import { at, isRecord } from "../formats/capabilities.ts";
import type { Catalog } from "../formats/catalog.ts";
import type { UiTree } from "../formats/tree.ts";
import { int, str } from "../schema.ts";
import { CONTAINER_BYTES, memberBytes, SEPARATOR_BYTES } from "./bytes.ts";
import { closed, field } from "./checks.ts";
import { compileSchema, type SchemaCheck, type SchemaSink } from "./schema.ts";
import {
  type CompiledStructure,
  compileStructure,
  type JsonWalk,
  keyPath,
  type StructureSink,
  walkJson,
} from "./structure.ts";

export type ValidateTreeOptions = {
  readonly limits?: { readonly nodes?: number; readonly depth?: number; readonly bytes?: number };
  readonly maxErrors?: number;
};
export type TreeValidator = (tree: unknown, options?: ValidateTreeOptions) => Result<UiTree>;

/** The tree budget every surface starts from (spec §10). */
export const DEFAULT_LIMITS = { nodes: 5000, depth: 64, bytes: 1024 * 1024 } as const;

const treeFields = new Set(["format", "catalogId", "surfaceId", "revision", "root"]);
type Mode = "tree" | "node" | "children" | "json";

/** One validation's state, passed to every step of the walk. A plain object, so each step is a module-level function. */
type TreeContext = {
  readonly checkNode: SchemaCheck;
  readonly structure: CompiledStructure;
  readonly metadata: ReadonlyMap<string, SchemaCheck>;
  readonly budget: { readonly nodes: number; readonly depth: number; readonly bytes: number };
  readonly maxErrors: number;
  readonly errors: LiveframeError[];
  readonly path: (string | number)[];
  readonly sink: SchemaSink;
  readonly ids: Set<string>;
  readonly ancestors: Set<object>;
  readonly jsonSink: JsonWalk;
  readonly structureSink: StructureSink & { nodeId: string };
  bytes: number;
  nodes: number;
  stopped: boolean;
  bounded: boolean;
  lastNodeId: string;
};

/** One walk checks node relationships and counts the bytes of all accepted JSON values. */
export function compileTree(
  catalog: Catalog,
  checkNode: SchemaCheck,
  structure: CompiledStructure = compileStructure(catalog),
): TreeValidator {
  const metadata = new Map([
    ["format", compileSchema(str({ maxLength: 11, enum: ["liveframe/1"] }))],
    ["catalogId", compileSchema(str({ maxLength: 128, enum: [catalog.catalogId] }))],
    ["surfaceId", compileSchema(str({ maxLength: 128, pattern: "^.+$" }))],
    ["revision", compileSchema(int({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }))],
  ]);
  return (tree, options = {}) => {
    const ctx = createContext(checkNode, structure, metadata, options);
    const { budget, errors, maxErrors } = ctx;
    if (!Number.isSafeInteger(maxErrors) || maxErrors < 1)
      return {
        ok: false,
        errors: [
          {
            kind: "invalid-prop",
            nodeId: "root",
            pointer: "",
            expected: "maxErrors to be a positive safe integer",
            message: "Invalid maxErrors",
          },
        ],
      };
    for (const key of ["nodes", "depth", "bytes"] as const) {
      if (!Number.isSafeInteger(budget[key]) || budget[key] < 1)
        fail(ctx, `limits.${key} to be a positive safe integer`, "root");
    }
    if (errors.length) return { ok: false, errors };
    try {
      walk(ctx, tree, "tree", 0, "root", "");
    } catch (error) {
      // Even caller-configured depths beyond the runtime's stack capacity fail closed.
      limit(
        ctx,
        error instanceof RangeError ? "a tree within the runtime's nesting capacity" : "readable JSON data",
        ctx.lastNodeId,
      );
    }
    if (ctx.bounded) addBoundMarker(errors, ctx.lastNodeId);
    return errors.length ? { ok: false, errors } : { ok: true, value: tree as UiTree };
  };
}

function createContext(
  checkNode: SchemaCheck,
  structure: CompiledStructure,
  metadata: ReadonlyMap<string, SchemaCheck>,
  options: ValidateTreeOptions,
): TreeContext {
  const errors: LiveframeError[] = [];
  const budget = { ...DEFAULT_LIMITS, ...options.limits };
  const maxErrors = options.maxErrors ?? DEFAULT_MAX_ERRORS;
  const path: (string | number)[] = [];
  const ancestors = new Set<object>();
  const ctx: TreeContext = {
    checkNode,
    structure,
    metadata,
    budget,
    maxErrors,
    errors,
    path,
    sink: { errors, maxErrors },
    ids: new Set<string>(),
    ancestors,
    jsonSink: {
      nodeId: "root",
      ancestors,
      path,
      bytes: 0,
      maximum: budget.bytes,
      stopped: false,
      fail(expected) {
        fail(ctx, expected, ctx.jsonSink.nodeId, "invalid-prop");
        ctx.jsonSink.stopped = ctx.stopped;
      },
      limit() {
        limit(ctx, `a tree of at most ${budget.bytes} UTF-8 JSON bytes`, ctx.jsonSink.nodeId);
      },
    },
    structureSink: {
      nodeId: "root",
      reject(expected, pointer = "") {
        fail(ctx, expected, ctx.structureSink.nodeId, "invalid-children", pointer);
      },
    },
    bytes: 0,
    nodes: 0,
    stopped: false,
    bounded: false,
    lastNodeId: "root",
  };
  return ctx;
}

function pointer(ctx: TreeContext): string {
  let result = "";
  for (const key of ctx.path) result = at(result, key);
  return result;
}
function full(ctx: TreeContext): boolean {
  if (ctx.errors.length >= ctx.maxErrors) ctx.stopped = ctx.bounded = true;
  return ctx.stopped;
}
function fail(
  ctx: TreeContext,
  expected: string,
  nodeId: string,
  kind: LiveframeError["kind"] = "invalid-prop",
  suffix = "",
): undefined {
  if (ctx.stopped) return;
  ctx.errors.push({ kind, nodeId, pointer: pointer(ctx) + suffix, expected, message: `Expected ${expected}` });
  ctx.lastNodeId = nodeId;
  full(ctx);
}
function limit(ctx: TreeContext, expected: string, nodeId: string): undefined {
  fail(ctx, expected, nodeId, "limit-exceeded");
  ctx.stopped = true;
}
function add(ctx: TreeContext, amount: number, nodeId: string): undefined {
  ctx.bytes += amount;
  if (ctx.bytes > ctx.budget.bytes) limit(ctx, `a tree of at most ${ctx.budget.bytes} UTF-8 JSON bytes`, nodeId);
}
/** Rebases errors a nested check reported relative to the current pointer, and attributes them to `nodeId`. */
function annotate(ctx: TreeContext, start: number, nodeId: string): void {
  const { errors } = ctx;
  if (errors.length > start) {
    const prefix = pointer(ctx);
    for (let i = start; i < errors.length; i++) {
      const error = errors[i];
      if (error) errors[i] = { ...error, nodeId, pointer: prefix + error.pointer };
    }
    ctx.lastNodeId = nodeId;
    full(ctx);
  }
}

/**
 * Walks one value in its mode: the tree object, a node, a node's children array, or a JSON value.
 * Node and tree modes check the value first, then every mode but `json` walks the container itself.
 */
function walk(
  ctx: TreeContext,
  value: unknown,
  mode: Mode,
  depth: number,
  parentId: string,
  parentKind: string,
): undefined {
  if (ctx.stopped) return;
  // A JSON value is checked and byte-counted by the shared piece; it contains no nodes.
  if (mode === "json") {
    const { jsonSink } = ctx;
    jsonSink.bytes = ctx.bytes;
    walkJson(value, jsonSink);
    ctx.bytes = jsonSink.bytes;
    return;
  }
  let nodeId = parentId;
  let nodeKind = parentKind;
  let valid = true;
  if (mode === "node") {
    const checked = enterNode(ctx, value, depth, parentId, parentKind);
    if (checked === undefined) return;
    valid = checked;
    const node = value as Record<string, unknown>;
    if (typeof node.id === "string") nodeId = node.id;
    nodeKind = typeof node.kind === "string" ? node.kind : "";
  } else if (mode === "tree" && !enterTree(ctx, value)) return;
  if (ctx.stopped) return;
  // Node and children modes returned early for anything but an object or array.
  if (typeof value !== "object" || value === null) return;
  const { ancestors } = ctx;
  if (ancestors.has(value)) return fail(ctx, "an acyclic JSON tree", nodeId);
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (!array && prototype !== Object.prototype && prototype !== null) return fail(ctx, "a plain JSON object", nodeId);
  ancestors.add(value);
  add(ctx, CONTAINER_BYTES, nodeId);
  if (array) walkItems(ctx, value, mode, depth, parentId, parentKind, nodeId);
  else walkMembers(ctx, value, mode, depth, nodeId, nodeKind, valid);
  ancestors.delete(value);
}

/**
 * Checks one node against the node and depth budgets, its schema, its id and its place under its
 * parent. Returns whether its payload is valid, or undefined when the walk must not enter it.
 */
function enterNode(
  ctx: TreeContext,
  value: unknown,
  depth: number,
  parentId: string,
  parentKind: string,
): boolean | undefined {
  const { budget } = ctx;
  if (ctx.nodes >= budget.nodes) return limit(ctx, `at most ${budget.nodes} nodes`, parentId);
  if (depth > budget.depth) return limit(ctx, `at most ${budget.depth} node levels (root is level 1)`, parentId);
  ctx.nodes++;
  const nodeId = isRecord(value) && typeof value.id === "string" ? value.id : parentId;
  const start = ctx.errors.length;
  const valid = ctx.checkNode(value, "", ctx.sink);
  annotate(ctx, start, nodeId);
  if (ctx.stopped || !isRecord(value)) return;
  if (typeof value.id === "string") checkId(ctx, value.id, depth, parentId, nodeId);
  ctx.structureSink.nodeId = nodeId;
  ctx.jsonSink.nodeId = nodeId;
  ctx.structure.node(
    parentKind,
    typeof value.kind === "string" ? value.kind : "",
    depth,
    Object.hasOwn(value, "children"),
    ctx.structureSink,
  );
  return valid;
}

/** A node id is `root` at the root, otherwise an encoded key path under its parent, and unique. */
function checkId(ctx: TreeContext, id: string, depth: number, parentId: string, nodeId: string): void {
  const prefix = `${parentId}/`;
  if (depth === 1 ? id !== "root" : !id.startsWith(prefix) || !keyPath.test(id.slice(prefix.length)))
    fail(
      ctx,
      depth === 1 ? "root as the root id" : `an encoded key path under ${parentId}`,
      nodeId,
      "invalid-prop",
      "/id",
    );
  if (ctx.ids.has(id)) fail(ctx, "a unique key-path id", nodeId, "duplicate-key", "/id");
  ctx.ids.add(id);
}

/** The tree object's closed field set and metadata checks. False when it is not an object. */
function enterTree(ctx: TreeContext, value: unknown): boolean {
  if (!isRecord(value)) {
    fail(ctx, "a UI tree object", "root");
    return false;
  }
  const start = ctx.errors.length;
  closed(value, treeFields, ctx.sink);
  for (const [key, check] of ctx.metadata) {
    if (ctx.errors.length >= ctx.maxErrors) break;
    field(check, Object.hasOwn(value, key) ? value[key] : undefined, ctx.sink, key);
  }
  annotate(ctx, start, "root");
  if (!Object.hasOwn(value, "root")) fail(ctx, "a root UI node", "root", "invalid-prop", "/root");
  return true;
}

/** Array items, with a comma between them; in children mode each item is a node, and the kinds are counted. */
function walkItems(
  ctx: TreeContext,
  value: readonly unknown[],
  mode: Mode,
  depth: number,
  parentId: string,
  parentKind: string,
  nodeId: string,
): void {
  const { path, structure, structureSink } = ctx;
  const counts =
    mode === "children" && structure.children.get(parentKind) instanceof Map ? new Map<string, number>() : undefined;
  if (mode === "children" && structure.forbidsChildren(parentKind) && value.length)
    fail(ctx, "no children for this kind", nodeId, "invalid-children");
  for (let i = 0; i < value.length && !ctx.stopped; i++) {
    path.push(i);
    if (i) add(ctx, SEPARATOR_BYTES, nodeId);
    if (ctx.stopped) {
      path.pop();
      break;
    }
    const child: unknown = value[i];
    if (counts && isRecord(child) && typeof child.kind === "string")
      counts.set(child.kind, (counts.get(child.kind) ?? 0) + 1);
    walk(
      ctx,
      child,
      mode === "children" ? "node" : "json",
      mode === "children" ? depth + 1 : depth,
      parentId,
      parentKind,
    );
    path.pop();
  }
  if (mode === "children" && counts) {
    structureSink.nodeId = nodeId;
    structure.counts(parentKind, counts, structureSink);
  }
}

/** The mode a member's value is walked in: the tree's `root` is a node, a node's `children` its children. */
function memberMode(mode: Mode, key: string): Mode {
  if (mode === "tree" && key === "root") return "node";
  return mode === "node" && key === "children" ? "children" : "json";
}

/** Object members, each with its key framing; a node's `children` and the tree's `root` hold nodes. */
function walkMembers(
  ctx: TreeContext,
  value: object,
  mode: Mode,
  depth: number,
  nodeId: string,
  nodeKind: string,
  valid: boolean,
): void {
  const { path } = ctx;
  let first = true;
  for (const key in value) {
    if (ctx.stopped) break;
    if (!Object.hasOwn(value, key)) continue;
    // Rejected payloads need no byte count; still inspect their child nodes for independent errors.
    if (mode === "node" && !valid && key !== "children") continue;
    if (mode === "tree" && !treeFields.has(key)) continue;
    path.push(key);
    add(ctx, memberBytes(key, first, ctx.budget.bytes - ctx.bytes), nodeId);
    if (ctx.stopped) {
      path.pop();
      break;
    }
    const entry = (value as Record<string, unknown>)[key];
    if (mode === "node" && key === "children" && !Array.isArray(entry)) {
      path.pop();
      continue;
    }
    first = false;
    const next = memberMode(mode, key);
    // The only member that holds a node is the tree's `root`, which is level 1.
    walk(ctx, entry, next, next === "node" ? 1 : depth, nodeId, nodeKind);
    path.pop();
  }
}
