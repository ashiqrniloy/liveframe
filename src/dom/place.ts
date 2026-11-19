/** The positions of the longest increasing run in `values` (patience sorting), as a set of the values themselves. */
function longestIncreasing(values: readonly number[]): Set<number> {
  const tails: number[] = [];
  const previous: number[] = new Array(values.length);
  for (const [i, value] of values.entries()) {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if ((values[tails[middle] as number] as number) < value) low = middle + 1;
      else high = middle;
    }
    previous[i] = low > 0 ? (tails[low - 1] as number) : -1;
    tails[low] = i;
  }
  const kept = new Set<number>();
  for (let i = tails.length ? (tails[tails.length - 1] as number) : -1; i >= 0; i = previous[i] as number)
    kept.add(values[i] as number);
  return kept;
}

type Movable = Node & { moveBefore?(node: Node, child: Node | null): void };

/** Moves with `moveBefore` where the engine has it, which keeps focus and other state; `insertBefore` otherwise. */
function put(parent: Movable, node: Node, before: Node | null): void {
  if (node.parentNode === parent && typeof parent.moveBefore === "function") {
    try {
      parent.moveBefore(node, before);
      return;
    } catch {
      // A disconnected pair throws `HierarchyRequestError`; `insertBefore` still moves it.
    }
  }
  parent.insertBefore(node, before);
}

/** An element the adapter keeps drawn while its exit motion plays (spec §6.2); it removes it itself. */
const exiting = (node: Node) => "hasAttribute" in node && (node as Element).hasAttribute("data-lf-exiting");

/**
 * Makes `parent`'s child nodes exactly `nodes`, in order. Children not in `nodes` are removed, except an element
 * still playing its exit motion, which stays where it is until the adapter removes it; of those already there,
 * the longest run already in order stays and only the rest move, so an unchanged list touches nothing.
 */
export function place(parent: Node, nodes: readonly Node[]): void {
  const wanted = new Map<Node, number>();
  for (const [i, node] of nodes.entries()) wanted.set(node, i);
  const present: number[] = [];
  for (let child = parent.firstChild; child; ) {
    const next = child.nextSibling;
    const index = wanted.get(child);
    if (index === undefined) {
      if (!exiting(child)) parent.removeChild(child);
    } else present.push(index);
    child = next;
  }
  const stay = longestIncreasing(present);
  if (stay.size === nodes.length) return;
  // From the end, each node that does not stay goes before its successor, which is already in place.
  let before: Node | null = null;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i] as Node;
    if (!stay.has(i)) put(parent, node, before);
    before = node;
  }
}
