import type { LiveframeError, Result } from "../errors.ts";
import { at, isRecord } from "../formats/capabilities.ts";
import type { Catalog } from "../formats/catalog.ts";
import type { UiTree } from "../formats/tree.ts";
import { int, str } from "../schema.ts";
import { stringBytes } from "./bytes.ts";
import { closed, field } from "./checks.ts";
import { compileSchema, type SchemaCheck, type SchemaSink } from "./schema.ts";

export type ValidateTreeOptions = {
  readonly limits?: { readonly nodes?: number; readonly depth?: number; readonly bytes?: number };
  readonly maxErrors?: number;
};
export type TreeValidator = (tree: unknown, options?: ValidateTreeOptions) => Result<UiTree>;

const treeFields = new Set(["format", "catalogId", "surfaceId", "revision", "root"]);
const keyPath = /^(?:[a-zA-Z0-9_.!~*'():-]|%[0-9A-F]{2})+(?:\/(?:[a-zA-Z0-9_.!~*'():-]|%[0-9A-F]{2})+)*$/;
type Mode = "tree" | "node" | "children" | "json";

/** One walk checks node relationships and counts the bytes of all accepted JSON values. */
export function compileTree(catalog: Catalog, checkNode: SchemaCheck): TreeValidator {
  const metadata = new Map([
    ["format", compileSchema(str({ maxLength: 11, enum: ["liveframe/1"] }))],
    ["catalogId", compileSchema(str({ maxLength: 128, enum: [catalog.catalogId] }))],
    ["surfaceId", compileSchema(str({ maxLength: 128, pattern: "^.+$" }))],
    ["revision", compileSchema(int({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }))],
  ]);
  const children = new Map(
    catalog.definitions.map((definition) => [
      definition.kind,
      typeof definition.children === "string"
        ? definition.children
        : new Map(definition.children.map((rule) => [rule.kind, rule])),
    ]),
  );
  return (tree, options = {}) => {
    const errors: LiveframeError[] = [];
    const budget = { nodes: 5000, depth: 64, bytes: 1024 * 1024, ...options.limits };
    const maxErrors = options.maxErrors ?? 20;
    const path: (string | number)[] = [];
    const sink: SchemaSink = { errors, maxErrors };
    const ids = new Set<string>();
    const ancestors = new Set<object>();
    let bytes = 0;
    let nodes = 0;
    let stopped = false;
    let bounded = false;
    let lastNodeId = "root";

    function pointer(): string {
      let result = "";
      for (const key of path) result = at(result, key);
      return result;
    }
    function full(): boolean {
      if (errors.length >= maxErrors) stopped = bounded = true;
      return stopped;
    }
    function fail(
      expected: string,
      nodeId: string,
      kind: LiveframeError["kind"] = "invalid-prop",
      suffix = "",
    ): undefined {
      if (stopped) return;
      errors.push({ kind, nodeId, pointer: pointer() + suffix, expected, message: `Expected ${expected}` });
      lastNodeId = nodeId;
      full();
    }
    function limit(expected: string, nodeId: string): undefined {
      fail(expected, nodeId, "limit-exceeded");
      stopped = true;
    }
    function add(amount: number, nodeId: string): undefined {
      bytes += amount;
      if (bytes > budget.bytes) limit(`a tree of at most ${budget.bytes} UTF-8 JSON bytes`, nodeId);
    }
    function annotate(start: number, nodeId: string): void {
      if (errors.length > start) {
        const prefix = pointer();
        for (let i = start; i < errors.length; i++) {
          const error = errors[i];
          if (error) errors[i] = { ...error, nodeId, pointer: prefix + error.pointer };
        }
        lastNodeId = nodeId;
        full();
      }
    }

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
        fail(`limits.${key} to be a positive safe integer`, "root");
    }
    if (errors.length) return { ok: false, errors };

    function walk(value: unknown, mode: Mode, depth: number, parentId: string, parentKind: string): undefined {
      if (stopped) return;
      let nodeId = parentId;
      let nodeKind = parentKind;
      let valid = true;
      if (mode === "node") {
        if (nodes >= budget.nodes) return limit(`at most ${budget.nodes} nodes`, parentId);
        if (depth > budget.depth) return limit(`at most ${budget.depth} node levels (root is level 1)`, parentId);
        nodes++;
        if (isRecord(value) && typeof value.id === "string") nodeId = value.id;
        const start = errors.length;
        valid = checkNode(value, "", sink);
        annotate(start, nodeId);
        if (stopped) return;
        if (!isRecord(value)) return;
        nodeKind = typeof value.kind === "string" ? value.kind : "";
        if (typeof value.id === "string") {
          const prefix = `${parentId}/`;
          if (
            depth === 1
              ? value.id !== "root"
              : !value.id.startsWith(prefix) || !keyPath.test(value.id.slice(prefix.length))
          )
            fail(
              depth === 1 ? "root as the root id" : `an encoded key path under ${parentId}`,
              nodeId,
              "invalid-prop",
              "/id",
            );
          if (ids.has(value.id)) fail("a unique key-path id", nodeId, "duplicate-key", "/id");
          ids.add(value.id);
        }
        if ((nodeKind === "term" || nodeKind === "detail") && parentKind !== "terms")
          fail("term and detail nodes directly inside terms", nodeId, "invalid-children", "/kind");
        if (parentKind === "terms" && nodeKind !== "term" && nodeKind !== "detail")
          fail("only term or detail children inside terms", nodeId, "invalid-children", "/kind");
        const rule = children.get(parentKind);
        if (depth > 1 && rule instanceof Map && !rule.has(nodeKind))
          fail(
            `a child kind declared by ${parentKind}: ${[...rule.keys()].join(", ") || "none"}`,
            nodeId,
            "invalid-children",
            "/kind",
          );
        if (!Object.hasOwn(value, "children")) {
          const ownRule = children.get(nodeKind);
          if (ownRule instanceof Map)
            for (const [kind, bounds] of ownRule) {
              if (bounds.min > 0)
                fail(`at least ${bounds.min} ${kind} children`, nodeId, "invalid-children", "/children");
              if (stopped) return;
            }
        }
      } else if (mode === "tree") {
        if (!isRecord(value)) return fail("a UI tree object", "root");
        const start = errors.length;
        closed(value, treeFields, sink);
        for (const [key, check] of metadata) {
          if (errors.length >= maxErrors) break;
          field(check, Object.hasOwn(value, key) ? value[key] : undefined, sink, key);
        }
        annotate(start, "root");
        if (!Object.hasOwn(value, "root")) fail("a root UI node", "root", "invalid-prop", "/root");
      }
      if (stopped) return;
      if (value === null) return add(4, nodeId);
      if (typeof value === "string") return add(stringBytes(value, budget.bytes - bytes), nodeId);
      if (typeof value === "boolean") return add(value ? 4 : 5, nodeId);
      if (typeof value === "number" && Number.isFinite(value)) return add(String(value).length, nodeId);
      if (typeof value !== "object") return fail("a JSON value", nodeId);
      if (ancestors.has(value)) return fail("an acyclic JSON tree", nodeId);
      const array = Array.isArray(value);
      const prototype = Object.getPrototypeOf(value);
      if (!array && prototype !== Object.prototype && prototype !== null) return fail("a plain JSON object", nodeId);
      ancestors.add(value);
      add(2, nodeId);
      if (array) {
        const rule = mode === "children" ? children.get(parentKind) : undefined;
        const counts = rule instanceof Map ? new Map<string, number>() : undefined;
        if (rule === "none" && value.length) fail("no children for this kind", nodeId, "invalid-children");
        for (let i = 0; i < value.length && !stopped; i++) {
          path.push(i);
          if (i) add(1, nodeId);
          if (stopped) {
            path.pop();
            break;
          }
          const child: unknown = value[i];
          if (counts && isRecord(child) && typeof child.kind === "string")
            counts.set(child.kind, (counts.get(child.kind) ?? 0) + 1);
          walk(
            child,
            mode === "children" ? "node" : "json",
            mode === "children" ? depth + 1 : depth,
            parentId,
            parentKind,
          );
          path.pop();
        }
        if (rule instanceof Map && counts)
          for (const [kind, bounds] of rule) {
            const count = counts.get(kind) ?? 0;
            if (count < bounds.min || count > bounds.max)
              fail(`between ${bounds.min} and ${bounds.max} ${kind} children`, nodeId, "invalid-children");
            if (stopped) break;
          }
      } else {
        let first = true;
        for (const key in value) {
          if (stopped) break;
          if (!Object.hasOwn(value, key)) continue;
          // Rejected payloads need no byte count; still inspect their child nodes for independent errors.
          if (mode === "node" && !valid && key !== "children") continue;
          if (mode === "tree" && !treeFields.has(key)) continue;
          path.push(key);
          add(stringBytes(key, budget.bytes - bytes) + 1 + (first ? 0 : 1), nodeId);
          if (stopped) {
            path.pop();
            break;
          }
          const entry = (value as Record<string, unknown>)[key];
          if (mode === "node" && key === "children" && !Array.isArray(entry)) {
            path.pop();
            continue;
          }
          first = false;
          walk(
            entry,
            mode === "tree" && key === "root" ? "node" : mode === "node" && key === "children" ? "children" : "json",
            mode === "tree" && key === "root" ? 1 : depth,
            nodeId,
            nodeKind,
          );
          path.pop();
        }
      }
      ancestors.delete(value);
    }
    try {
      walk(tree, "tree", 0, "root", "");
    } catch (error) {
      // Even caller-configured depths beyond the runtime's stack capacity fail closed.
      limit(
        error instanceof RangeError ? "a tree within the runtime's nesting capacity" : "readable JSON data",
        lastNodeId,
      );
    }
    if (bounded)
      errors.push({
        kind: "limit-exceeded",
        nodeId: lastNodeId,
        pointer: errors.at(-1)?.pointer ?? "",
        expected: "fix the errors above and validate again",
        message: "Error collection limit reached",
      });
    return errors.length ? { ok: false, errors } : { ok: true, value: tree as UiTree };
  };
}
