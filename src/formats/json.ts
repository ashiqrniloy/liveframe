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

const isContainer = (value: unknown): value is object => value !== null && typeof value === "object";

/** Queue a pair for comparison; answers whether the two values could still be equal. */
function defer(left: unknown, right: unknown, pending: unknown[]): boolean {
  if (left === right) return true;
  if (!isContainer(left) || !isContainer(right)) return false;
  pending.push(left, right);
  return true;
}

/** Compare one level's members, queuing the containers among them. */
function sameLevel(left: object, right: object, pending: unknown[]): boolean {
  if (Array.isArray(left)) {
    if (!Array.isArray(right) || left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) if (!defer(left[i], right[i], pending)) return false;
    return true;
  }
  if (Array.isArray(right)) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  const members = right as Record<string, unknown>;
  for (const key of keys) {
    if (!Object.hasOwn(right, key)) return false;
    if (!defer((left as Record<string, unknown>)[key], members[key], pending)) return false;
  }
  return true;
}

/**
 * Whether two JSON values are equal: object key order is irrelevant, array order is not.
 * Iterative and short-circuiting, and it compares each level's primitives before descending into
 * containers, so a near miss is rejected at the shallowest difference. It is how a cache asks
 * "is this the content the canonical text would spell?" without paying for the canonical text.
 */
export function sameJson(left: unknown, right: unknown): boolean {
  const pending: unknown[] = [left, right];
  while (pending.length) {
    const b = pending.pop();
    const a = pending.pop();
    if (a === b) continue;
    if (!isContainer(a) || !isContainer(b)) return false;
    if (!sameLevel(a, b, pending)) return false;
  }
  return true;
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
      const prototype = typeof value === "object" && value !== null ? Object.getPrototypeOf(value) : null;
      const foreignRealm =
        prototype !== null &&
        prototype !== Object.prototype &&
        Object.getPrototypeOf(prototype) === null &&
        Object.prototype.toString.call(value) === "[object Object]";
      c.reject(
        pointer,
        foreignRealm
          ? "Expected a JSON value created in this realm; this object was created in another realm (parse it inside the sandbox)"
          : "Expected a JSON value without cycles or non-finite numbers",
      );
      continue;
    }
    ancestors.add(value);
    pending.push({ value, pointer, exit: true });
    pushChildren(value, pointer, pending);
  }
  return c.errors.length ? { ok: false, errors: c.errors } : { ok: true, value: doc as Json };
}
