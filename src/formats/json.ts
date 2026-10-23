import type { Result } from "../errors.ts";
import { at, documentChecks } from "./capabilities.ts";
import type { Json } from "./tree.ts";

/** Checks JSON values without recursion, including cycles and values JSON.stringify would discard. */
export function validateJson(doc: unknown): Result<Json> {
  const c = documentChecks();
  const ancestors = new Set<object>();
  const pending: { value: unknown; pointer: string; exit?: boolean }[] = [{ value: doc, pointer: "" }];
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
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i--) pending.push({ value: value[i], pointer: at(pointer, i) });
    } else {
      for (const [key, child] of Object.entries(value).reverse()) {
        pending.push({ value: child, pointer: at(pointer, key) });
      }
    }
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as Json };
}
