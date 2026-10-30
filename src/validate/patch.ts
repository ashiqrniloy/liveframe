import type { LiveframeError, Result } from "../errors.ts";
import type { UiNode, UiTree } from "../formats/tree.ts";
import { type PatchOp, type TreePatch, validateTreePatch } from "../formats/tree-patch.ts";
import { difference } from "./difference.ts";

type Entry = { node: UiNode; parent: Entry | undefined };
const indexes = new WeakMap<UiTree, Map<string, readonly Entry[]>>();
function indexTree(tree: UiTree): Map<string, readonly Entry[]> {
  const cached = indexes.get(tree);
  if (cached) return cached;
  const index = new Map<string, Entry[]>();
  const pending: Entry[] = [{ node: tree.root, parent: undefined }];
  while (pending.length) {
    const entry = pending.pop();
    if (!entry) break;
    const entries = index.get(entry.node.id) ?? [];
    entries.push(entry);
    index.set(entry.node.id, entries);
    for (const node of entry.node.children ?? []) pending.push({ node, parent: entry });
  }
  indexes.set(tree, index);
  return index;
}
const failure = (kind: LiveframeError["kind"], pointer: string, message: string): Result<never> => ({
  ok: false,
  errors: [{ kind, pointer, message }],
});

/**
 * Apply structural edits atomically, sharing untouched subtrees. The base must be validated.
 * Validate the whole result before accepting/serving it. Caller-owned trees and nested
 * values must remain immutable while in use; this function neither mutates nor freezes them.
 */
export function applyPatch(base: UiTree, patch: unknown): Result<UiTree> {
  const checked = validateTreePatch(patch);
  if (!checked.ok) return checked;
  const doc = checked.value;
  if (doc.surfaceId !== base.surfaceId) return failure("stale-patch", "/surfaceId", "Patch surface differs from base");
  if (doc.base !== base.revision) return failure("stale-patch", "/base", "Patch base revision differs from tree");
  if (doc.catalogId !== base.catalogId)
    return failure("invalid-document", "/catalogId", "Patch catalog differs from base");
  // Each application owns its index map; cached entries always describe the original tree.
  const index = new Map(indexTree(base));
  const replacements = new Map<Entry, UiNode>();
  const current = (entry: Entry) => replacements.get(entry) ?? entry.node;
  let root = base.root;
  function update(entry: Entry, node: UiNode) {
    const previous = current(entry);
    replacements.set(entry, node);
    let child = entry;
    let replacement = node;
    let old = previous;
    while (child.parent) {
      const parent = child.parent;
      const before = current(parent);
      replacement = {
        ...before,
        children: (before.children ?? []).map((value) => (value === old ? replacement : value)),
      };
      old = before;
      replacements.set(parent, replacement);
      child = parent;
    }
    root = replacement;
  }
  function add(node: UiNode, parent: Entry | undefined) {
    const pending: Entry[] = [{ node, parent }];
    while (pending.length) {
      const entry = pending.pop();
      if (!entry) break;
      index.set(entry.node.id, [...(index.get(entry.node.id) ?? []), entry]);
      for (const child of entry.node.children ?? []) pending.push({ node: child, parent: entry });
    }
  }
  function remove(entry: Entry) {
    const pending = [entry];
    while (pending.length) {
      const target = pending.pop();
      if (!target) break;
      const entries = index.get(target.node.id)?.filter((value) => value !== target) ?? [];
      if (entries.length) index.set(target.node.id, entries);
      else index.delete(target.node.id);
      for (const child of current(target).children ?? []) {
        for (const candidate of index.get(child.id) ?? [])
          if (candidate.parent === target && current(candidate) === child) pending.push(candidate);
      }
    }
  }
  function edit(op: PatchOp, entry: Entry, path: string): Result<void> {
    const node = current(entry);
    if (op.op === "set") {
      const { op: _op, ...own } = op;
      update(entry, { ...own, ...(node.children !== undefined ? { children: node.children } : {}) });
      return { ok: true, value: undefined };
    }
    if (op.op === "insert") {
      const children = [...(node.children ?? [])];
      if (op.index > children.length) return failure("invalid-document", `${path}/index`, "Index outside children");
      children.splice(op.index, 0, op.node);
      update(entry, { ...node, children });
      add(op.node, entry);
      return { ok: true, value: undefined };
    }
    {
      if (!entry.parent) return failure("invalid-document", `${path}/id`, "Cannot remove or move root");
      const parent = current(entry.parent);
      const children = [...(parent.children ?? [])];
      const position = children.indexOf(node);
      if (op.op === "move" && op.index >= children.length)
        return failure("invalid-document", `${path}/index`, "Index outside remaining children");
      if (op.op === "move" && op.index === position) return { ok: true, value: undefined };
      children.splice(position, 1);
      if (op.op === "move") children.splice(op.index, 0, node);
      else remove(entry);
      const { children: _children, ...own } = parent;
      update(entry.parent, children.length ? { ...own, children } : own);
    }
    return { ok: true, value: undefined };
  }
  for (const [i, op] of doc.ops.entries()) {
    const field = op.op === "insert" ? "parent" : "id";
    const id = op.op === "insert" ? op.parent : op.id;
    const path = `/ops/${i}`;
    const entries = index.get(id);
    if (!entries?.length) return failure("not-found", `${path}/${field}`, "Unknown target node");
    if (entries.length !== 1) return failure("duplicate-key", `${path}/${field}`, "Ambiguous target node");
    const entry = entries[0];
    if (!entry) continue;
    const edited = edit(op, entry, path);
    if (!edited.ok) return edited;
  }
  return { ok: true, value: { ...base, revision: doc.revision, root } };
}

/** Diff validated, immutable SDK-form trees; send the whole tree if diffing fails. */
export function diffTrees(prev: UiTree, next: UiTree): Result<TreePatch> {
  if (prev.catalogId !== next.catalogId) return failure("invalid-document", "/catalogId", "Diff catalogs differ");
  if (prev.surfaceId !== next.surfaceId) return failure("invalid-document", "/surfaceId", "Diff surfaces differ");
  if (next.revision <= prev.revision)
    return failure("invalid-document", "/revision", "Expected revision greater than previous tree");
  for (const tree of [prev, next]) {
    const pending = [tree.root];
    while (pending.length) {
      const node = pending.pop();
      if (!node) break;
      if (node.children?.length === 0)
        return failure("invalid-document", "/root", "Diff requires omitted empty children; send the whole tree");
      pending.push(...(node.children ?? []));
    }
  }
  const ops: PatchOp[] = [];
  function visit(before: UiNode, after: UiNode) {
    if (
      before.kind !== after.kind ||
      before.variant !== after.variant ||
      difference(before.props, after.props) !== undefined ||
      difference(before.style, after.style) !== undefined ||
      difference(before.events, after.events) !== undefined
    ) {
      const { children: _children, ...own } = after;
      ops.push({ op: "set", ...own });
    }
    if (!before.children && !after.children) return;
    const children = [...(before.children ?? [])];
    const wanted = new Set((after.children ?? []).map((child) => child.id));
    const retained = new Map(children.map((child) => [child.id, child]));
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (child && !wanted.has(child.id)) {
        ops.push({ op: "remove", id: child.id });
        children.splice(i, 1);
      }
    }
    for (const [i, child] of (after.children ?? []).entries()) {
      const old = retained.get(child.id);
      if (!old) {
        ops.push({ op: "insert", parent: after.id, index: i, node: child });
        children.splice(i, 0, child);
      } else {
        if (children[i]?.id !== child.id) {
          const position = children.indexOf(old);
          ops.push({ op: "move", id: child.id, index: i });
          children.splice(position, 1);
          children.splice(i, 0, old);
        }
        visit(old, child);
      }
    }
  }
  visit(prev.root, next.root);
  return {
    ok: true,
    value: {
      format: "liveframe/tree-patch/1",
      catalogId: prev.catalogId,
      surfaceId: prev.surfaceId,
      base: prev.revision,
      revision: next.revision,
      ops,
    },
  };
}
