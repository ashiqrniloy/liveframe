import type { Catalog } from "../formats/catalog.ts";
import type { Manifest } from "../formats/manifest.ts";
import type { ObjectSchema } from "../formats/capabilities.ts";
import { addBoundMarker, DEFAULT_MAX_ERRORS, type LiveframeError, type Result } from "../errors.ts";
import { arr, bool, int, isRecord, num, obj, str, type Infer, type LanguageSchema } from "../schema.ts";
import type { Intent, Json, UiTree } from "../formats/tree.ts";
import { Element } from "./element.ts";
import { Fragment } from "./jsx-runtime.ts";
import { renderPrepared, type RenderOptions } from "./render.ts";

/** JSON input for an ephemeral surface: an element tree with no ids, drawn from one catalog (spec §7.2). */
type ElementFor<C extends Catalog, D> = D extends Catalog["definitions"][number]
  ? {
      readonly kind: D["kind"];
      readonly key?: string | number;
      readonly variant?: D["variants"][number];
      readonly props?: Infer<D["props"]>;
      readonly style?: Readonly<Record<string, Json>>;
      readonly events?: { readonly [E in keyof D["events"]]?: Intent };
      readonly children?: readonly Elements<C>[];
    }
  : never;

export type Elements<C extends Catalog> =
  | ElementFor<C, C["definitions"][number]>
  | { readonly kind: "fragment"; readonly key?: string | number; readonly children: readonly Elements<C>[] };

const INPUT_DEPTH = 128;
const ELEMENT_KEYS = new Set(["kind", "key", "variant", "props", "style", "events", "children"]);
const STATE_MAX_LENGTH = 4096;
const STATE_MAX_ITEMS = 256;
const STATE_MAX_PROPERTIES = 64;
const STATE_MAX_DEPTH = 16;
/** Bounded share of frozen `{ kind }` tags across calls; a hostile catalog cannot grow it without bound. */
const kindTags = new Map<string, Readonly<{ kind: string }>>();

class Reject {
  readonly errors: LiveframeError[] = [];
  readonly maxErrors: number;
  stopped = false;

  constructor(maxErrors: number) {
    this.maxErrors = maxErrors;
  }

  at(pointer: string, expected: string): void {
    if (this.stopped) return;
    this.errors.push({ kind: "invalid-prop", pointer, expected, message: `Expected ${expected}` });
    if (this.errors.length >= this.maxErrors) this.stopped = true;
  }
}

function section(value: unknown, pointer: string, reject: Reject): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    reject.at(pointer, "an object");
    return undefined;
  }
  return value;
}

function merge(
  target: Record<string, unknown>,
  source: Record<string, unknown> | undefined,
  pointer: string,
  sectionName: string,
  reject: Reject,
): void {
  if (!source) return;
  for (const name in source) {
    if (!Object.hasOwn(source, name)) continue;
    if (name === "key" || name === "children" || name === "variant")
      reject.at(pointerAt(pointer, name), `no ${name} in ${sectionName}`);
    else if (Object.hasOwn(target, name)) reject.at(pointerAt(pointer, name), "one property section per name");
    else target[name] = source[name];
  }
}

function kindTag(kind: string): Readonly<{ kind: string }> {
  let tag = kindTags.get(kind);
  if (!tag) {
    tag = Object.freeze({ kind });
    if (kindTags.size < 256) kindTags.set(kind, tag);
  }
  return tag;
}

function pointerAt(pointer: string, key: string | number): string {
  return `${pointer}/${String(key).replaceAll("~", "~0").replaceAll("/", "~1")}`;
}

function elementProps(
  value: Record<string, unknown>,
  pointer: string,
  reject: Reject,
): Record<string, unknown> | undefined {
  const props = section(value.props, pointerAt(pointer, "props"), reject);
  const style = section(value.style, pointerAt(pointer, "style"), reject);
  const events = section(value.events, pointerAt(pointer, "events"), reject);
  if (reject.stopped) return undefined;
  const merged: Record<string, unknown> = { ...props };
  for (const reserved of ["key", "children", "variant"] as const)
    if (Object.hasOwn(merged, reserved))
      reject.at(pointerAt(pointerAt(pointer, "props"), reserved), `no ${reserved} in props`);
  merge(merged, style, pointerAt(pointer, "style"), "style", reject);
  merge(merged, events, pointerAt(pointer, "events"), "events", reject);
  if (value.variant !== undefined) merged.variant = value.variant;
  return reject.stopped ? undefined : merged;
}

function elementChildren(
  value: unknown,
  pointer: string,
  depth: number,
  ancestors: Set<object>,
  reject: Reject,
  pointers: WeakMap<Element, string>,
): Element[] | undefined {
  if (!Array.isArray(value)) {
    reject.at(pointer, "an array of elements");
    return undefined;
  }
  ancestors.add(value);
  const children: Element[] = [];
  for (const [index, child] of value.entries()) {
    const converted = convert(child, `${pointer}/${index}`, depth + 1, ancestors, reject, pointers);
    if (!converted) break;
    children.push(converted);
  }
  ancestors.delete(value);
  return reject.stopped ? undefined : children;
}

function convertFragment(
  value: Record<string, unknown>,
  pointer: string,
  depth: number,
  ancestors: Set<object>,
  reject: Reject,
  pointers: WeakMap<Element, string>,
): Element | undefined {
  for (const name of ["variant", "props", "style", "events"] as const)
    if (Object.hasOwn(value, name)) reject.at(pointerAt(pointer, name), `no ${name} on a fragment`);
  const children = elementChildren(value.children, pointerAt(pointer, "children"), depth, ancestors, reject, pointers);
  if (!children) return undefined;
  const element = new Element(Fragment, { children }, value.key, true);
  pointers.set(element, pointer);
  return element;
}

/** Converts element JSON to SDK elements, recording each element's input pointer for error reporting. */
function convert(
  value: unknown,
  pointer: string,
  depth: number,
  ancestors: Set<object>,
  reject: Reject,
  pointers: WeakMap<Element, string>,
): Element | undefined {
  if (reject.stopped) return undefined;
  if (!isRecord(value)) {
    reject.at(pointer, "an element object");
    return undefined;
  }
  if (depth >= INPUT_DEPTH) {
    reject.at(pointer, `element JSON nested at most ${INPUT_DEPTH} deep`);
    return undefined;
  }
  if (ancestors.has(value)) {
    reject.at(pointer, "acyclic element JSON");
    return undefined;
  }
  for (const name in value)
    if (Object.hasOwn(value, name) && !ELEMENT_KEYS.has(name))
      reject.at(pointerAt(pointer, name), "no such element field");
  const kind = value.kind;
  if (typeof kind !== "string" || kind.length === 0) {
    reject.at(pointerAt(pointer, "kind"), "a nonempty catalog kind");
    return undefined;
  }
  const key = value.key;
  if (key !== undefined && !(typeof key === "string" || (typeof key === "number" && Number.isFinite(key))))
    reject.at(pointerAt(pointer, "key"), "a string or finite number key");
  if (kind === "fragment") return convertFragment(value, pointer, depth, ancestors, reject, pointers);

  const merged = elementProps(value, pointer, reject);
  if (!merged) return undefined;
  const children =
    value.children === undefined
      ? []
      : elementChildren(value.children, pointerAt(pointer, "children"), depth, ancestors, reject, pointers);
  if (!children) return undefined;
  if (children.length) merged.children = children;
  // The element is internal to this call and never escapes; freezing it would only add work.
  const element = new Element(kindTag(kind), merged, key, true);
  pointers.set(element, pointer);
  return element;
}

/**
 * Builds a `UiTree` from agent element JSON, with `render()`'s ids, validation, limits and error
 * kinds. Errors carry a JSON pointer into the input; `nodeId` is the derived key-path id.
 */
function prepareElements(input: unknown, maxErrors = DEFAULT_MAX_ERRORS) {
  const reject = new Reject(maxErrors);
  const pointers = new WeakMap<Element, string>();
  const root = convert(input, "", 1, new Set<object>(), reject, pointers);
  if (reject.stopped) addBoundMarker(reject.errors, "root");
  return { root, pointers, errors: reject.errors };
}

export function renderElements(input: unknown, options: RenderOptions): Result<UiTree> {
  const { root, pointers, errors } = prepareElements(input, options.maxErrors);
  if (errors.length || !root) return { ok: false, errors };
  return renderPrepared(root, options, pointers);
}

function stateSchema(value: unknown, pointer: string, depth: number): LanguageSchema {
  if (value === null) throw new TypeError(`Expected JSON state at ${pointer}, not null`);
  if (typeof value === "string") return str({ maxLength: Math.max(STATE_MAX_LENGTH, value.length) });
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`Expected a finite number at ${pointer}`);
    return Number.isInteger(value) ? int() : num();
  }
  if (typeof value === "boolean") return bool();
  if (depth >= STATE_MAX_DEPTH) throw new TypeError(`State at ${pointer} nests deeper than ${STATE_MAX_DEPTH}`);
  if (Array.isArray(value)) {
    if (value.length > STATE_MAX_ITEMS)
      throw new TypeError(`Expected at most ${STATE_MAX_ITEMS} state items at ${pointer}`);
    const first = value[0];
    if (value.length === 0) return arr(str({ maxLength: 0 }), { maxItems: 0 });
    const items = stateSchema(first, pointerAt(pointer, 0), depth + 1);
    for (let i = 1; i < value.length; i++)
      if (JSON.stringify(stateSchema(value[i], pointerAt(pointer, i), depth + 1)) !== JSON.stringify(items))
        throw new TypeError(`Expected homogeneous state items at ${pointer}`);
    return arr(items, { maxItems: Math.max(STATE_MAX_ITEMS, value.length) });
  }
  if (!isRecord(value)) throw new TypeError(`Expected JSON state at ${pointer}`);
  const entries = Object.entries(value);
  if (entries.length > STATE_MAX_PROPERTIES)
    throw new TypeError(`Expected at most ${STATE_MAX_PROPERTIES} state properties at ${pointer}`);
  const properties: Record<string, LanguageSchema> = {};
  for (const [name, child] of entries) properties[name] = stateSchema(child, pointerAt(pointer, name), depth + 1);
  return obj(properties);
}

/** A manifest an ephemeral surface validates against; `state` is its initial value (spec §7.2). */
export function ephemeralManifest({
  catalogId,
  actions,
  state = {},
}: {
  readonly catalogId: string;
  readonly actions: readonly string[];
  readonly state?: Json;
}): Manifest {
  const initialState = state === undefined ? {} : state;
  if (!isRecord(initialState)) throw new TypeError("Expected a state object");
  return {
    format: "liveframe-manifest/1",
    id: "ephemeral",
    version: "0",
    catalogId,
    params: obj({}),
    state: stateSchema(initialState, "/state", 0) as ObjectSchema,
    context: obj({}),
    initialState,
    sources: {},
    actions: [...actions],
  };
}
