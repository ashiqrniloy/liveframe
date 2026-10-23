import { type LiveframeError, validateCatalog } from "../index.ts";
import { binding, type Implementation } from "./implement.ts";

export class RendererError extends Error {
  constructor(readonly errors: LiveframeError[]) {
    super(errors.map((error) => `${error.pointer}: ${error.message}`).join("\n"));
    this.name = "RendererError";
  }
}

// Tree rendering is added in plan 008 Task 3.
function Surface() {
  return null;
}

// Compare JSON structurally: object key order is irrelevant; array order is not.
function sameDefinition(left: unknown, right: unknown): boolean {
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

export function createRenderer({
  catalog,
  implementations,
}: {
  catalog: unknown;
  implementations: readonly Implementation[];
}) {
  const checked = validateCatalog(catalog);
  if (!checked.ok) throw new RendererError([...checked.errors]);
  const definitions = checked.value.definitions;
  const registry = new Map<string, Implementation>();
  const errors: LiveframeError[] = [];
  function reject(pointer: string, message: string) {
    errors.push({ kind: "catalog-mismatch", pointer, message });
  }
  for (const [i, implementation] of implementations.entries()) {
    const { definition } = implementation[binding];
    const pointer = `/implementations/${i}`;
    if (registry.has(definition.kind)) reject(pointer, `Duplicate implementation: ${definition.kind}`);
    registry.set(definition.kind, implementation);
    const expected = definitions.find((entry) => entry.kind === definition.kind);
    if (!expected) reject(pointer, `Kind outside catalog: ${definition.kind}`);
    else if (!sameDefinition(expected, definition))
      reject(pointer, `Definition differs from catalog: ${definition.kind}`);
  }
  for (const [i, definition] of definitions.entries()) {
    if (!registry.has(definition.kind))
      reject(`/catalog/definitions/${i}/kind`, `Missing implementation: ${definition.kind}`);
  }
  if (errors.length) throw new RendererError(errors);

  return { Surface };
}
