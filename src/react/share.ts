import { sameJson } from "../formats/json.ts";
import type { UiNode, UiTree } from "../index.ts";

/** Nodes that threw in the accepted tree, so they must be retried rather than reused. */
type FailedNodes = { has(node: UiNode): boolean };

type Shared = { node: UiNode; equal: boolean; blocked: boolean };

// Bottom-up so a subtree is compared and substituted once. A node is reused only when its
// whole subtree is unchanged and nothing in it failed; a failed node's ancestors must not be
// reused either, or their cached element would keep the failed child's boundary on fallback.
function shareNode(previous: UiNode | undefined, next: UiNode, failed: FailedNodes): Shared {
  let equal =
    previous !== undefined &&
    previous.id === next.id &&
    previous.kind === next.kind &&
    previous.variant === next.variant &&
    sameJson(previous.props, next.props) &&
    sameJson(previous.style, next.style) &&
    sameJson(previous.events, next.events) &&
    (previous.children?.length ?? 0) === (next.children?.length ?? 0);
  let blocked = previous !== undefined && failed.has(previous);
  let changed = false;
  // Ids are unique in a validated tree, so a child's previous node is the one with its id among
  // the previous parent's children, wherever it moved. The same position is tried first, so the
  // map is built only once a child has moved.
  const before = previous?.children;
  let byId: Map<string, UiNode> | undefined;
  const children = next.children?.map((child, index) => {
    let prior = before?.[index];
    if (prior?.id !== child.id) {
      byId ??= new Map(before?.map((node) => [node.id, node]));
      prior = byId.get(child.id);
    }
    const shared = shareNode(prior, child, failed);
    // The parent is unchanged only if each child is unchanged and still in the same position.
    if (!shared.equal || prior !== before?.[index]) equal = false;
    if (shared.blocked) blocked = true;
    if (shared.node !== child) changed = true;
    return shared.node;
  });
  if (equal && !blocked && previous) return { node: previous, equal: true, blocked };
  const node = changed ? { ...next, ...(children === undefined ? {} : { children }) } : next;
  return { node, equal, blocked };
}

/**
 * Substitutes the accepted tree's node objects for every subtree whose value is unchanged since
 * that tree, so React skips it by element identity. Runs after arrival validation, so a shared
 * node draws exactly the validated value.
 */
export function shareNodes(previous: UiTree | undefined, next: UiTree, failed: FailedNodes): UiTree {
  if (!previous || previous.surfaceId !== next.surfaceId) return next;
  const root = shareNode(previous.root, next.root, failed);
  return root.node === next.root ? next : { ...next, root: root.node };
}
