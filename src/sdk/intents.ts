import { isThenable } from "../internal.ts";
import type { Intent, Json, LocalIntent } from "./types.ts";

type SetStateIntent = Extract<Intent, { type: "setState" }>;
type ActionIntent = Extract<Intent, { type: "action" }>;

/** Intents carry names and JSON only; the app still authorises every one (spec §8, law 4). */
const MAX_DEPTH = 128;

/**
 * Rejects non-JSON data at once, naming the key: a function prop, a promise, a non-finite
 * number, a class instance, a cycle. The value never reaches a widget's tree this way.
 * Its own walk (not the shared one) because it throws a `TypeError` at the first bad value
 * instead of collecting bounded errors, and it runs before a render, not on one.
 */
function assertJson(value: unknown, path: string, ancestors = new Set<object>(), depth = 0): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value === "function") throw new TypeError(`Expected JSON at ${path}: functions are not data`);
  if (typeof value !== "object") throw new TypeError(`Expected JSON at ${path}: ${typeof value} is not data`);
  if (isThenable(value)) throw new TypeError(`Expected JSON at ${path}: promises are not data`);
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new TypeError(`Expected JSON at ${path}: cyclic data`);
    if (depth >= MAX_DEPTH) throw new TypeError(`Expected JSON at ${path}: nesting is too deep`);
    ancestors.add(value);
    for (let i = 0; i < value.length; i++) assertJson(value[i], `${path}[${i}]`, ancestors, depth + 1);
    ancestors.delete(value);
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new TypeError(`Expected JSON at ${path}: expected a plain object`);
  if (ancestors.has(value)) throw new TypeError(`Expected JSON at ${path}: cyclic data`);
  if (depth >= MAX_DEPTH) throw new TypeError(`Expected JSON at ${path}: nesting is too deep`);
  ancestors.add(value);
  for (const [key, entry] of Object.entries(value)) assertJson(entry, `${path}.${key}`, ancestors, depth + 1);
  ancestors.delete(value);
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) freeze(entry);
    Object.freeze(value);
  }
  return value;
}

function name(value: unknown, what: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 128)
    throw new TypeError(`Expected a nonempty ${what} of at most 128 characters`);
  return value;
}

function setState(key: string, value: Json): SetStateIntent & { readonly value: Json };
function setState(key: string, value?: undefined): SetStateIntent & { readonly value?: never };
function setState(key: string, value?: Json): SetStateIntent;
function setState(key: string, value?: Json): SetStateIntent {
  const stateKey = name(key, "state key");
  if (value !== undefined) assertJson(value, stateKey);
  const intent =
    value === undefined
      ? { type: "setState" as const, key: stateKey }
      : { type: "setState" as const, key: stateKey, value };
  return freeze(intent);
}

/**
 * `local.set(key, value?)` writes the surface's local state in the renderer; it never reaches the host
 * (plan 029 L3). Without a value the event's value fills it, as for `state.set`.
 */
export function setLocal(key: string, value: Json): LocalIntent & { readonly value: Json };
export function setLocal(key: string, value?: undefined): LocalIntent & { readonly value?: never };
export function setLocal(key: string, value?: Json): LocalIntent;
export function setLocal(key: string, value?: Json): LocalIntent {
  const localKey = name(key, "local key");
  if (value !== undefined) assertJson(value, localKey);
  return freeze(
    value === undefined
      ? { type: "setLocal" as const, key: localKey }
      : { type: "setLocal" as const, key: localKey, value },
  );
}

/**
 * `bind` fills one scalar argument; `bindAll: true` merges an object event (spec §8). `resultKey` is the
 * key the host reports this intent's status under in `actions`; it defaults to the action name.
 */
type ActionOptions = { readonly resultKey?: string };
export function action(
  actionName: string,
  args?: Readonly<Record<string, Json>>,
  options?: ActionOptions & { readonly bind?: never; readonly bindAll?: never },
): ActionIntent & { readonly bind?: never; readonly bindAll?: never };
export function action(
  actionName: string,
  args: Readonly<Record<string, Json>>,
  options: ActionOptions & { readonly bind: string; readonly bindAll?: never },
): ActionIntent & { readonly bind: string; readonly bindAll?: never };
export function action(
  actionName: string,
  args: Readonly<Record<string, Json>>,
  options: ActionOptions & { readonly bindAll: true; readonly bind?: never },
): ActionIntent & { readonly bindAll: true; readonly bind?: never };
export function action(
  actionName: string,
  args?: Readonly<Record<string, Json>>,
  options?: ActionOptions & { readonly bind?: string; readonly bindAll?: true },
): ActionIntent;
export function action(
  actionName: string,
  args: Readonly<Record<string, Json>> = {},
  options: ActionOptions & { readonly bind?: string; readonly bindAll?: true } = {},
): ActionIntent {
  const action_ = name(actionName, "action name");
  assertJson(args, "args");
  const resultKey = options.resultKey === undefined ? {} : { resultKey: name(options.resultKey, "result key") };
  if (options.bindAll !== undefined) {
    if (options.bindAll !== true || options.bind !== undefined)
      throw new TypeError("Expected bindAll: true without bind");
    return freeze({ type: "action" as const, name: action_, args, bindAll: true, ...resultKey });
  }
  if (options.bind !== undefined) {
    const bind = name(options.bind, "bind argument name");
    return freeze({ type: "action" as const, name: action_, args, bind, ...resultKey });
  }
  return freeze({ type: "action" as const, name: action_, args, ...resultKey });
}

/** `state.set(key, value?)`; without a value the app fills the event's value (spec §7.2). */
export const state = Object.freeze({ set: setState });
