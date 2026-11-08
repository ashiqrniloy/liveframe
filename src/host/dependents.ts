import type { Json } from "../formats/tree.ts";
import { canonicalJson } from "../pack/hash.ts";
import type { Served } from "./types.ts";

/** What `dependents` reads from a served placement: its id and its resolved source bindings. */
export type Dependent = { readonly placementId: string; readonly bound: Served["bound"] };

/**
 * The ids of the placements whose bound sources a change touches, in input order, each once. A pure scan: no
 * registry, no subscription. With `params`, only a call whose params equal them (canonical JSON) matches.
 */
export function dependents(
  placements: readonly Dependent[],
  change: { readonly source: string; readonly params?: Json },
): string[] {
  const wanted = change.params === undefined ? undefined : canonicalJson(change.params);
  const ids: string[] = [];
  for (const { placementId, bound } of placements) {
    for (const alias in bound) {
      const call = bound[alias];
      if (call?.source === change.source && (wanted === undefined || canonicalJson(call.params) === wanted)) {
        ids.push(placementId);
        break;
      }
    }
  }
  return ids;
}
