import { WidgetError } from "./errors.ts";

export function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function synchronous(value: unknown, path: string): void {
  if (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    "then" in value &&
    typeof value.then === "function"
  ) {
    if (value instanceof Promise) void value.catch(() => {});
    throw new WidgetError("async-render", "Promises are not supported", path);
  }
}

export function assertJson(value: unknown, path: string, ancestors = new Set<unknown>(), maxDepth = 128): void {
  if (typeof value === "function") throw new WidgetError("function-prop", "Expected data, received a function", path);
  synchronous(value, path);
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (!Array.isArray(value) && !isRecord(value))
    throw new WidgetError("invalid-prop", "Expected plain JSON data", path);
  if (ancestors.has(value)) throw new WidgetError("invalid-prop", "Cyclic data", path);
  if (ancestors.size >= maxDepth) throw new WidgetError("limit-exceeded", "Data nesting limit exceeded", path);
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (const [i, entry] of value.entries()) assertJson(entry, `${path}/${i}`, ancestors, maxDepth);
  } else {
    for (const [key, entry] of Object.entries(value)) assertJson(entry, `${path}/${key}`, ancestors, maxDepth);
  }
  ancestors.delete(value);
}

export function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) freeze(entry);
    Object.freeze(value);
  }
  return value;
}
