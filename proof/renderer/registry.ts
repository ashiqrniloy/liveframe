import type { Definition } from "../catalog/define.ts";
import type { Implementation } from "./implement.ts";

export function registry(
  catalog: { readonly definitions: readonly Definition[] },
  implementations: readonly Implementation[],
): ReadonlyMap<string, Implementation> {
  const result = new Map<string, Implementation>();
  for (const implementation of implementations) {
    const kind = implementation.definition.kind;
    if (result.has(kind)) throw new Error(`Duplicate implementation: ${kind}`);
    const definition = catalog.definitions.find((entry) => entry.kind === kind);
    if (!definition || JSON.stringify(definition) !== JSON.stringify(implementation.definition))
      throw new Error(`Catalog mismatch: ${kind}`);
    result.set(kind, implementation);
  }
  for (const definition of catalog.definitions)
    if (!result.has(definition.kind)) throw new Error(`Missing implementation: ${definition.kind}`);
  return result;
}
