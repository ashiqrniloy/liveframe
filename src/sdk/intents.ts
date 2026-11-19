import { isThenable } from "../internal.ts";
import type { Intent, Json, LocalIntent, LocalWrite } from "./types.ts";

type SetStateIntent = Extract<Intent, { type: "setState" }>;
type ActionIntent = Extract<Intent, { type: "action" }>;
type LocalMap = Readonly<Record<string, Json>>;

export type TypedLocalWrite<K extends string = string, V extends Json = Json> = {
  readonly key: K;
  readonly value?: V;
  readonly until?: "revision";
};

export type LocalWriteFor<L extends LocalMap = LocalMap> = string extends keyof L
  ? LocalIntent | LocalWrite
  : {
      readonly [K in keyof L & string]:
        | (LocalIntent & { readonly key: K; readonly value?: L[K] })
        | TypedLocalWrite<K, L[K]>;
    }[keyof L & string];

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizeLocalWrites(writes: unknown): readonly LocalWrite[] | undefined {
  if (writes === undefined) return undefined;
  if (!Array.isArray(writes) || writes.length === 0 || writes.length > 4)
    throw new TypeError("Expected 1 to 4 local writes");
  return writes.map((entry, index) => {
    if (!isPlainObject(entry)) throw new TypeError(`Expected a local write object at local[${index}]`);
    for (const field of Object.keys(entry)) {
      if (field === "key" || field === "value" || field === "until") continue;
      if (field === "type" && entry.type === "setLocal") continue;
      throw new TypeError(`Unexpected field "${field}" at local[${index}]`);
    }
    const writeKey = name(entry.key, "local key");
    const hasValue = Object.hasOwn(entry, "value") && entry.value !== undefined;
    if (hasValue) assertJson(entry.value, `local[${index}].value`);
    if (entry.until !== undefined && entry.until !== "revision")
      throw new TypeError(`Expected until: "revision" at local[${index}]`);
    return {
      key: writeKey,
      ...(hasValue ? { value: entry.value as Json } : {}),
      ...(entry.until === "revision" ? { until: "revision" as const } : {}),
    };
  });
}

function normalizeFromLocal(map: unknown): Readonly<Record<string, string>> | undefined {
  if (map === undefined) return undefined;
  if (!isPlainObject(map)) throw new TypeError("Expected fromLocal to map argument names to local keys");
  const entries = Object.entries(map);
  if (entries.length === 0 || entries.length > 16) throw new TypeError("Expected 1 to 16 fromLocal entries");
  return Object.fromEntries(
    entries.map(([arg, key]) => [name(arg, "fromLocal argument name"), name(key, "fromLocal local key")]),
  );
}

type StateOptions<L extends LocalMap = LocalMap> = {
  readonly local?: readonly LocalWriteFor<L>[];
  /** Fills the value from this local key when the event is raised; excludes an explicit value. */
  readonly fromLocal?: keyof L & string;
};
function setState<L extends LocalMap = LocalMap>(
  key: string,
  value: Json,
  options?: StateOptions<L>,
): SetStateIntent & { readonly value: Json };
function setState<L extends LocalMap = LocalMap>(
  key: string,
  value?: undefined,
  options?: StateOptions<L>,
): SetStateIntent & { readonly value?: never };
function setState<L extends LocalMap = LocalMap>(key: string, value?: Json, options?: StateOptions<L>): SetStateIntent;
function setState(key: string, value?: Json, options?: StateOptions): SetStateIntent {
  const stateKey = name(key, "state key");
  if (value !== undefined) assertJson(value, stateKey);
  const local = normalizeLocalWrites(options?.local);
  if (options?.fromLocal !== undefined && value !== undefined)
    throw new TypeError("Expected fromLocal without an explicit value");
  const fromLocal = options?.fromLocal === undefined ? undefined : name(options.fromLocal, "fromLocal local key");
  const intent = {
    type: "setState" as const,
    key: stateKey,
    ...(value === undefined ? {} : { value }),
    ...(local === undefined ? {} : { local }),
    ...(fromLocal === undefined ? {} : { fromLocal }),
  };
  return freeze(intent);
}

/**
 * `local.set(key, value?, options?)` writes the surface's local state in the renderer; it never reaches the
 * host (spec §8). Without a value the event's value fills it, as for `state.set`. With `until: "revision"`,
 * the write returns a `LocalWrite` for `action` / `state.set` `local` options and reverts on the next accepted revision.
 */
export function setLocal<K extends string, V extends Json>(
  key: K,
  value: V,
  options?: { readonly until?: undefined },
): LocalIntent & { readonly key: K; readonly value: V };
export function setLocal<K extends string>(
  key: K,
  value?: undefined,
  options?: { readonly until?: undefined },
): LocalIntent & { readonly key: K; readonly value?: never };
export function setLocal<K extends string, V extends Json>(
  key: K,
  value: V,
  options: { readonly until: "revision" },
): TypedLocalWrite<K, V> & { readonly until: "revision" };
export function setLocal<K extends string>(
  key: K,
  value: undefined,
  options: { readonly until: "revision" },
): TypedLocalWrite<K, never> & { readonly until: "revision" };
export function setLocal(
  key: string,
  value?: Json,
  options?: { readonly until?: "revision" | undefined },
): LocalIntent | LocalWrite;
export function setLocal(
  key: string,
  value?: Json,
  options?: { readonly until?: "revision" | undefined },
): LocalIntent | LocalWrite {
  const localKey = name(key, "local key");
  if (value !== undefined) assertJson(value, localKey);
  if (options !== undefined) {
    if (!isPlainObject(options)) throw new TypeError('Expected options with until?: "revision"');
    for (const field of Object.keys(options))
      if (field !== "until") throw new TypeError(`Unexpected option "${field}" in local.set`);
    if (options.until !== undefined && options.until !== "revision") throw new TypeError('Expected until: "revision"');
  }
  if (options?.until === "revision") {
    return freeze(
      value === undefined
        ? { key: localKey, until: "revision" as const }
        : { key: localKey, value, until: "revision" as const },
    );
  }
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
type ActionOptions<L extends LocalMap = LocalMap> = {
  readonly resultKey?: string;
  readonly local?: readonly LocalWriteFor<L>[];
  /** Argument name to local key: each argument is filled from local state when the event is raised. */
  readonly fromLocal?: Readonly<Record<string, keyof L & string>>;
};
export function action<L extends LocalMap = LocalMap>(
  actionName: string,
  args?: Readonly<Record<string, Json>>,
  options?: ActionOptions<L> & { readonly bind?: never; readonly bindAll?: never },
): ActionIntent & { readonly bind?: never; readonly bindAll?: never };
export function action<L extends LocalMap = LocalMap>(
  actionName: string,
  args: Readonly<Record<string, Json>>,
  options: ActionOptions<L> & { readonly bind: string; readonly bindAll?: never },
): ActionIntent & { readonly bind: string; readonly bindAll?: never };
export function action<L extends LocalMap = LocalMap>(
  actionName: string,
  args: Readonly<Record<string, Json>>,
  options: ActionOptions<L> & { readonly bindAll: true; readonly bind?: never },
): ActionIntent & { readonly bindAll: true; readonly bind?: never };
export function action<L extends LocalMap = LocalMap>(
  actionName: string,
  args?: Readonly<Record<string, Json>>,
  options?: ActionOptions<L> & { readonly bind?: string; readonly bindAll?: true },
): ActionIntent;
export function action(
  actionName: string,
  args: Readonly<Record<string, Json>> = {},
  options: ActionOptions & { readonly bind?: string; readonly bindAll?: true } = {},
): ActionIntent {
  const action_ = name(actionName, "action name");
  assertJson(args, "args");
  const resultKey = options.resultKey === undefined ? {} : { resultKey: name(options.resultKey, "result key") };
  const localWrites = normalizeLocalWrites(options.local);
  const local = localWrites === undefined ? {} : { local: localWrites };
  const fromLocalMap = normalizeFromLocal(options.fromLocal);
  const fromLocal = fromLocalMap === undefined ? {} : { fromLocal: fromLocalMap };
  if (options.bindAll !== undefined) {
    if (options.bindAll !== true || options.bind !== undefined)
      throw new TypeError("Expected bindAll: true without bind");
    return freeze({
      type: "action" as const,
      name: action_,
      args,
      bindAll: true,
      ...resultKey,
      ...local,
      ...fromLocal,
    });
  }
  if (options.bind !== undefined) {
    const bind = name(options.bind, "bind argument name");
    return freeze({ type: "action" as const, name: action_, args, bind, ...resultKey, ...local, ...fromLocal });
  }
  return freeze({ type: "action" as const, name: action_, args, ...resultKey, ...local, ...fromLocal });
}

/** `state.set(key, value?)`; without a value the app fills the event's value (spec §7.2). */
export const state = Object.freeze({ set: setState });
