// Frozen copy of diffTrees as of 0.2.2 (commit 8dac0fa), the reference for the plan 024 Task 6
// differential test. It moved children with indexOf and splice; do not edit it.
import type { LiveframeError, Result } from "../../errors.ts";
import type { UiNode, UiTree } from "../../formats/tree.ts";
import type { PatchOp, TreePatch } from "../../formats/tree-patch.ts";
import { difference } from "../../validate/difference.ts";

const failure = (kind: LiveframeError["kind"], pointer: string, message: string): Result<never> => ({
  ok: false,
  errors: [{ kind, pointer, message }],
});

export function diffTrees022(prev: UiTree, next: UiTree): Result<TreePatch> {
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
