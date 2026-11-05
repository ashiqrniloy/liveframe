import type { NodeRef } from "../formats/tree.ts";

/** Names a tree-unique `$anchor`, resolved after primitive emission. */
export function ref(anchor: string): NodeRef {
  return Object.freeze({ $ref: anchor });
}
