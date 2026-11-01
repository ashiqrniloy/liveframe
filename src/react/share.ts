import type { UiNode, UiTree } from "../index.ts";

/** Nodes that threw in the accepted tree, so they must be retried rather than reused. */
type FailedNodes = { has(node: UiNode): boolean };

// Compare JSON structurally: object key order is irrelevant; array order is not.
export function sameDefinition(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        Object.hasOwn(right, key) &&
        sameDefinition((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
    )
  );
}

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
    sameDefinition(previous.props, next.props) &&
    sameDefinition(previous.style, next.style) &&
    sameDefinition(previous.events, next.events) &&
    (previous.children?.length ?? 0) === (next.children?.length ?? 0);
  let blocked = previous !== undefined && failed.has(previous);
  let changed = false;
  const children = next.children?.map((child, index) => {
    const shared = shareNode(previous?.children?.[index], child, failed);
    if (!shared.equal) equal = false;
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
