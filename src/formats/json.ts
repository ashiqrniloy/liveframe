import type { Result } from "../errors.ts";
import { at, documentChecks } from "./capabilities.ts";
import type { Json } from "./tree.ts";

type Entry = { value: unknown; pointer: string; exit?: boolean };

/** A deep, frozen copy; callers supply already validated JSON. */
export function frozenJsonCopy<T extends Json>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  return Object.freeze(
    Array.isArray(value)
      ? value.map((child) => frozenJsonCopy(child))
      : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, frozenJsonCopy(child)])),
  ) as T;
}

/** Children pushed last-first, so popping walks them in document order. */
function pushChildren(value: object, pointer: string, pending: Entry[]): void {
  if (Array.isArray(value)) {
    for (let i = value.length - 1; i >= 0; i--) pending.push({ value: value[i], pointer: at(pointer, i) });
    return;
  }
  for (const [key, child] of Object.entries(value).reverse()) pending.push({ value: child, pointer: at(pointer, key) });
}

/**
 * Checks JSON values without recursion, including cycles and values JSON.stringify would discard.
 * Its own stack-based walk (not the shared recursive one) because it collects bounded pointed
 * errors, while render's predicate answers yes/no and the hash walk counts bytes.
 */
export function validateJson(doc: unknown): Result<Json> {
  const c = documentChecks();
  const ancestors = new Set<object>();
  const pending: Entry[] = [{ value: doc, pointer: "" }];
  while (pending.length && c.errors.length < 20) {
    const entry = pending.pop();
    if (!entry) break;
    const { value, pointer } = entry;
    if (entry.exit) {
      ancestors.delete(value as object);
      continue;
    }
    if (value === null || typeof value === "string" || typeof value === "boolean") continue;
    if (typeof value === "number" && Number.isFinite(value)) continue;
    if (
      typeof value !== "object" ||
      value === null ||
      ancestors.has(value) ||
      (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    ) {
      c.reject(pointer, "Expected a JSON value without cycles or non-finite numbers");
      continue;
    }
    ancestors.add(value);
    pending.push({ value, pointer, exit: true });
    pushChildren(value, pointer, pending);
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as Json };
}
