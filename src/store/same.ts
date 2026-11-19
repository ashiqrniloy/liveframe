import type { Json } from "../formats/tree.ts";
import { canonicalJson } from "../pack/hash.ts";

/** `putStateIf`'s comparison (spec §7.4): `undefined` matches only no stored state; otherwise canonical JSON equality. */
export function sameState(stored: Json | undefined, expected: Json | undefined): boolean {
  if (stored === undefined || expected === undefined) return stored === expected;
  return canonicalJson(stored) === canonicalJson(expected);
}
