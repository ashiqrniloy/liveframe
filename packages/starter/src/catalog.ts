import { type Catalog, type Result, validateCatalog } from "@arnilo/liveframe";
import document from "./catalog.json" with { type: "json" };

export function valid<T>(what: string, result: Result<T>): T {
  if (!result.ok) throw new Error(`Invalid starter ${what}: ${JSON.stringify(result.errors)}`);
  return result.value;
}

/** The starter catalog: the generic primitive set, validated once. `catalog.json` is its source of truth. */
export const catalog: Catalog = valid("catalog", validateCatalog(document));
