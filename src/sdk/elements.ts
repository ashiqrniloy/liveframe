import { addBoundMarker, DEFAULT_MAX_ERRORS, type Result } from "../errors.ts";
import type { ObjectSchema } from "../formats/capabilities.ts";
import type { Catalog } from "../formats/catalog.ts";
import type { Manifest } from "../formats/manifest.ts";
import type { Intent, Json, NodeRef, UiTree } from "../formats/tree.ts";
import { at } from "../internal.ts";
import { arr, bool, type Infer, int, isRecord, type LanguageSchema, num, obj, str } from "../schema.ts";
import { Element } from "./element.ts";
import { ELEMENT_KEYS, mergeSections, Reject, rejectFragmentFields, rejectUnknownFields } from "./element-node.ts";
import { Fragment } from "./jsx-runtime.ts";
import { type RenderOptions, renderPrepared } from "./render.ts";

/** JSON input for an ephemeral surface: an element tree with no ids, drawn from one catalog (spec §7.2). */
type ElementFor<C extends Catalog, D> = D extends Catalog["definitions"][number]
  ? {
      readonly kind: D["kind"];
      readonly key?: string | number;
      readonly variant?: D["variants"][number];
      readonly $anchor?: string;
      readonly props?: {
        readonly [K in keyof Infer<D["props"]>]: D extends { readonly refProps: readonly string[] }
          ? K extends D["refProps"][number]
            ? NodeRef
            : Infer<D["props"]>[K]
          : Infer<D["props"]>[K];
      };
      readonly style?: Readonly<Record<string, Json>>;
      readonly events?: { readonly [E in keyof D["events"]]?: Intent };
      readonly children?: readonly Elements<C>[];
    }
  : never;

export type Elements<C extends Catalog> =
  | ElementFor<C, C["definitions"][number]>
  | { readonly kind: "fragment"; readonly key?: string | number; readonly children: readonly Elements<C>[] };

const INPUT_DEPTH = 128;
const STATE_MAX_LENGTH = 4096;
const STATE_MAX_ITEMS = 256;
const STATE_MAX_PROPERTIES = 64;
const STATE_MAX_DEPTH = 16;
/** Bounded share of frozen `{ kind }` tags across calls; a hostile catalog cannot grow it without bound. */
const kindTags = new Map<string, Readonly<{ kind: string }>>();

function kindTag(kind: string): Readonly<{ kind: string }> {
  let tag = kindTags.get(kind);
  if (!tag) {
    tag = Object.freeze({ kind });
    if (kindTags.size < 256) kindTags.set(kind, tag);
  }
  return tag;
}

function elementProps(
  value: Record<string, unknown>,
  pointer: string,
  reject: Reject,
): Record<string, unknown> | undefined {
  const merged = mergeSections(value, pointer, reject);
  if (!merged) return undefined;
  if (Object.hasOwn(value, "$anchor")) merged.$anchor = value.$anchor;
  if (value.variant !== undefined) merged.variant = value.variant;
  return merged;
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
  rejectFragmentFields(value, pointer, reject);
  const children = elementChildren(value.children, at(pointer, "children"), depth, ancestors, reject, pointers);
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
  const head = elementHead(value, pointer, reject);
  if (!head) return undefined;
  const { kind, key } = head;
  if (kind === "fragment") return convertFragment(value, pointer, depth, ancestors, reject, pointers);

  const merged = elementProps(value, pointer, reject);
  if (!merged) return undefined;
  const children =
    value.children === undefined
      ? []
      : elementChildren(value.children, at(pointer, "children"), depth, ancestors, reject, pointers);
  if (!children) return undefined;
  if (children.length) merged.children = children;
  // The element is internal to this call and never escapes; freezing it would only add work.
  const element = new Element(kindTag(kind), merged, key, true);
  pointers.set(element, pointer);
  return element;
}

/** What every element object carries: no unknown fields, a catalog-shaped kind and a usable key. */
function elementHead(
  value: Record<string, unknown>,
  pointer: string,
  reject: Reject,
): { readonly kind: string; readonly key: unknown } | undefined {
  rejectUnknownFields(value, pointer, ELEMENT_KEYS, reject);
  const kind = value.kind;
  if (typeof kind !== "string" || kind.length === 0) {
    reject.at(at(pointer, "kind"), "a nonempty catalog kind");
    return undefined;
  }
  const key = value.key;
  if (key !== undefined && !(typeof key === "string" || (typeof key === "number" && Number.isFinite(key))))
    reject.at(at(pointer, "key"), "a string or finite number key");
  return { kind, key };
}

/**
 * Internal: converts one element object's own fields, leaving `children` to the caller, for a stream
 * that has seen everything but the children (`streamElements`, plan 028 Task 7). Not for fragments.
 */
export function convertShell(
  value: Record<string, unknown>,
  pointer: string,
  reject: Reject,
  pointers: WeakMap<Element, string>,
): Element | undefined {
  const head = elementHead(value, pointer, reject);
  if (!head) return undefined;
  const merged = elementProps(value, pointer, reject);
  if (!merged) return undefined;
  const element = new Element(kindTag(head.kind), merged, head.key, true);
  pointers.set(element, pointer);
  return element;
}

/** Internal: converts a whole element subtree that sits `depth` levels down, as `renderElements` does. */
export function convertElement(
  value: unknown,
  pointer: string,
  depth: number,
  reject: Reject,
  pointers: WeakMap<Element, string>,
): Element | undefined {
  return convert(value, pointer, depth, new Set<object>(), reject, pointers);
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
    const items = stateSchema(first, at(pointer, 0), depth + 1);
    for (let i = 1; i < value.length; i++)
      if (JSON.stringify(stateSchema(value[i], at(pointer, i), depth + 1)) !== JSON.stringify(items))
        throw new TypeError(`Expected homogeneous state items at ${pointer}`);
    return arr(items, { maxItems: Math.max(STATE_MAX_ITEMS, value.length) });
  }
  if (!isRecord(value)) throw new TypeError(`Expected JSON state at ${pointer}`);
  const entries = Object.entries(value);
  if (entries.length > STATE_MAX_PROPERTIES)
    throw new TypeError(`Expected at most ${STATE_MAX_PROPERTIES} state properties at ${pointer}`);
  const properties: Record<string, LanguageSchema> = {};
  for (const [name, child] of entries) properties[name] = stateSchema(child, at(pointer, name), depth + 1);
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
