// A2UI v0.9 / v0.9.1 → element JSON (design 039 A.1–A.10). The converter reads one surface snapshot and writes
// element JSON for `renderElements`, which validates it against the app's catalog, capabilities and manifest. The
// converter checks shape only, so it never decides what is allowed: an A2UI document is hostile input (law 2).
import type { Json, LiveframeError, Result } from "@arnilo/liveframe";
import type { RenderLimits } from "@arnilo/liveframe/sdk";

/** How one A2UI component becomes one element. Every name here is the app's; nothing comes from the document. */
export type A2uiComponent = {
  /** The catalog kind the component becomes. */
  readonly kind: string;
  /** A2UI property (or `accessibility.<field>`) → catalog prop. A property not named here is refused. */
  readonly props?: Readonly<Record<string, string>>;
  /** A2UI `variant` value → catalog variant. */
  readonly variants?: Readonly<Record<string, string>>;
  /** Properties holding a `ComponentId`, a list of them, or a `{ componentId, path }` template, in child order. */
  readonly children?: readonly string[];
  /** `ComponentId` property → catalog prop that takes the referenced component's `text`. */
  readonly lift?: Readonly<Record<string, string>>;
  /** Property holding an array of objects (`Tabs.tabs`) → the element each item becomes. */
  readonly items?: Readonly<Record<string, A2uiItem>>;
  /** The catalog event an A2UI `action` attaches to. */
  readonly event?: string;
  /** A two-way bound value: `bind` plus `setLocal` when its data path is in `mapping.local`. */
  readonly input?: { readonly prop: string; readonly event: string };
};

/** One item of an array property: its kind, field renames, the field naming its child, and a position prop. */
export type A2uiItem = {
  readonly kind: string;
  readonly props?: Readonly<Record<string, string>>;
  /** The item field holding a `ComponentId`, drawn as the item's only child. */
  readonly child?: string;
  /** A catalog prop that receives the item's position as a string (a tab's `value`). */
  readonly index?: string;
};

export type A2uiMapping = {
  /** The A2UI catalog `createSurface` must name. */
  readonly catalogId: string;
  readonly components: Readonly<Record<string, A2uiComponent>>;
  /** A2UI event name → manifest action name. */
  readonly actions?: Readonly<Record<string, string>>;
  /** A2UI data path (absolute JSON Pointer) → local key of the manifest's `local` schema. */
  readonly local?: Readonly<Record<string, string>>;
  /** Constructs the app knowingly discards. Anything else the converter cannot carry is an error. */
  readonly drop?: readonly ("theme" | "weight" | "checks")[];
};

export type A2uiOptions = {
  /** The same limits `renderElements` takes; the defaults are the core's. */
  readonly limits?: RenderLimits;
  readonly maxErrors?: number;
};

export type A2uiConversion = {
  /** Element JSON, for `renderElements`. */
  readonly elements: Json;
  /** Values for the mapped local keys, read from the data model: the app's `initialLocal`. */
  readonly initialLocal: Readonly<Record<string, Json>>;
  /** Element JSON pointer → the A2UI pointer that produced it (nodes, props, variants, events, binds). */
  readonly origins: Readonly<Record<string, string>>;
};

// The core's DEFAULT_LIMITS (spec §10), which `renderElements` applies to the converted document.
const DEFAULTS = { nodes: 5000, depth: 64, bytes: 1024 * 1024 } as const;
const INPUT_DEPTH = 128;
const TEMPLATE_ITEMS = 1000;
const DEFAULT_MAX_ERRORS = 20;
const VERSIONS = ["v0.9", "v0.9.1"];
const MESSAGES = ["createSurface", "updateComponents", "updateDataModel", "deleteSurface"];
const DEFAULT_CHILDREN = ["children", "child"];

type Obj = Record<string, unknown>;
type Kind = LiveframeError["kind"];
type Limits = { readonly nodes: number; readonly depth: number; readonly bytes: number };
type Entry = { readonly value: Obj; readonly pointer: string };
type Ref = { readonly id: string; readonly pointer: string };
type Template = { readonly componentId: string; readonly path: string };

/** Thrown when the error bound is reached or a limit makes going on pointless. */
class Stop {}

class Errors {
  readonly list: LiveframeError[] = [];
  constructor(readonly max: number) {}
  add(kind: Kind, pointer: string, expected: string): void {
    this.list.push({ kind, pointer, expected, message: `Expected ${expected}` });
    if (this.list.length >= this.max) throw new Stop();
  }
  fatal(kind: Kind, pointer: string, expected: string): never {
    this.list.push({ kind, pointer, expected, message: `Expected ${expected}` });
    throw new Stop();
  }
}

const isObj = (value: unknown): value is Obj => typeof value === "object" && value !== null && !Array.isArray(value);
const own = <T>(record: Readonly<Record<string, T>> | undefined, key: string): T | undefined =>
  record !== undefined && Object.hasOwn(record, key) ? record[key] : undefined;
const at = (pointer: string, segment: string | number): string =>
  `${pointer}/${String(segment).replaceAll("~", "~0").replaceAll("/", "~1")}`;

/**
 * Convert an A2UI v0.9 or v0.9.1 surface (JSONL text, or parsed messages) to element JSON through the app's mapping.
 * The result is not validated: pass `elements` to `renderElements` with the app's compiled validator.
 */
export function fromA2ui(
  messages: string | readonly unknown[],
  mapping: A2uiMapping,
  options: A2uiOptions = {},
): Result<A2uiConversion> {
  if (typeof mapping?.catalogId !== "string" || !isObj(mapping.components))
    throw new TypeError("Expected a mapping with a catalogId and components");
  let errors: Errors | undefined;
  try {
    const limits: Limits = { ...DEFAULTS, ...options.limits };
    errors = new Errors(options.maxErrors ?? DEFAULT_MAX_ERRORS);
    const list = readInput(messages, limits, errors);
    const surface = list && readMessages(list, mapping, limits, errors);
    if (!surface || errors.list.length > 0) return { ok: false, errors: errors.list };
    checkGraph(surface.components, mapping, errors);
    if (errors.list.length > 0) return { ok: false, errors: errors.list };
    const value = convert(surface, mapping, limits, errors);
    return errors.list.length > 0 ? { ok: false, errors: errors.list } : { ok: true, value };
  } catch (error) {
    let range = false;
    try {
      if (error instanceof Stop && errors) return { ok: false, errors: errors.list };
      range = error instanceof RangeError;
    } catch {
      // A thrown proxy can also throw when its prototype is inspected.
    }
    return {
      ok: false,
      errors: [
        range
          ? { kind: "limit-exceeded", pointer: "/", message: "A2UI conversion exceeded a runtime limit" }
          : { kind: "invalid-document", pointer: "/", message: "A2UI conversion failed" },
      ],
    };
  }
}

// ---- A.1 Input and bounds ----

function readInput(
  messages: string | readonly unknown[],
  limits: Limits,
  errors: Errors,
): readonly unknown[] | undefined {
  let list: readonly unknown[];
  if (typeof messages === "string") {
    if (messages.length > 4 * limits.bytes)
      errors.fatal("limit-exceeded", "/", `at most ${4 * limits.bytes} characters`);
    const parsed: unknown[] = [];
    for (let start = 0, end = 0; start < messages.length; start = end + 1) {
      end = messages.indexOf("\n", start);
      if (end < 0) end = messages.length;
      const line = messages.slice(start, end);
      if (line.trim() === "") continue;
      if (parsed.length >= limits.nodes * 8)
        errors.fatal("limit-exceeded", "/", `at most ${limits.nodes * 8} JSON values`);
      try {
        parsed.push(JSON.parse(line));
      } catch {
        errors.add("invalid-document", `/${parsed.length}`, "one JSON message per line");
        parsed.push(undefined);
      }
    }
    list = parsed;
  } else if (Array.isArray(messages)) list = messages;
  else return void errors.add("invalid-document", "/", "JSONL text or an array of messages");
  bound(list, limits, errors);
  return list;
}

/** One pass with a stack: at most `nodes × 8` values, `4 × bytes` string characters and depth 128. */
function bound(list: readonly unknown[], limits: Limits, errors: Errors): void {
  const maxValues = limits.nodes * 8;
  const maxChars = 4 * limits.bytes;
  const stack: [unknown, number][] = [[list, 0]];
  let values = 1;
  let chars = 0;
  const push = (value: unknown, depth: number) => {
    if (++values > maxValues) errors.fatal("limit-exceeded", "/", `at most ${maxValues} JSON values`);
    stack.push([value, depth]);
  };
  if (values > maxValues) errors.fatal("limit-exceeded", "/", `at most ${maxValues} JSON values`);
  while (stack.length > 0) {
    const [value, depth] = stack.pop() as [unknown, number];
    if (depth > INPUT_DEPTH) errors.fatal("limit-exceeded", "/", `JSON nested at most ${INPUT_DEPTH} deep`);
    if (typeof value === "string") chars += value.length;
    else if (Array.isArray(value)) {
      if (value.length > maxValues - values) errors.fatal("limit-exceeded", "/", `at most ${maxValues} JSON values`);
      for (const item of value) push(item, depth + 1);
    } else if (isObj(value))
      for (const key in value) {
        if (!Object.hasOwn(value, key)) continue;
        chars += key.length;
        push(value[key], depth + 1);
      }
    if (chars > maxChars) errors.fatal("limit-exceeded", "/", `at most ${maxChars} string characters`);
  }
}

// ---- A.2 Messages ----

type Surface = {
  surfaceId?: string;
  created: boolean;
  readonly components: Map<string, Entry>;
  data: Json;
};

function readMessages(
  list: readonly unknown[],
  mapping: A2uiMapping,
  limits: Limits,
  errors: Errors,
): Surface | undefined {
  const surface: Surface = { created: false, components: new Map(), data: {} };
  const maxWrites = limits.nodes * 8;
  let remainingWrites = maxWrites;
  list.forEach((message, i) => {
    const pointer = `/${i}`;
    if (!isObj(message)) {
      errors.add("invalid-document", pointer, "an A2UI message object");
      return;
    }
    if (!VERSIONS.includes(message.version as string)) {
      errors.add("invalid-document", at(pointer, "version"), `version ${VERSIONS.join(" or ")}`);
      return;
    }
    const types = Object.keys(message).filter((key) => key !== "version");
    const type = types[0];
    if (types.length !== 1 || type === undefined || !MESSAGES.includes(type)) {
      errors.add("invalid-document", pointer, `one of ${MESSAGES.slice(0, 3).join(", ")}`);
      return;
    }
    const body = message[type];
    const bodyPointer = at(pointer, type);
    if (type === "deleteSurface") {
      errors.add("invalid-document", bodyPointer, "no deleteSurface: the converter reads one snapshot");
      return;
    }
    if (!isObj(body)) {
      errors.add("invalid-document", bodyPointer, "an object");
      return;
    }
    if (!sameSurface(surface, body, bodyPointer, errors)) return;
    if (type === "createSurface") createSurface(surface, body, bodyPointer, mapping, errors);
    else if (type === "updateComponents") updateComponents(surface, body, bodyPointer, errors);
    else {
      const source = at(bodyPointer, "path");
      updateDataModel(surface, body, source, errors, (count) => {
        remainingWrites -= count;
        if (remainingWrites < 0) errors.fatal("limit-exceeded", source, `at most ${maxWrites} data model value writes`);
      });
    }
  });
  if (!surface.created) errors.add("invalid-document", "/", "one createSurface message");
  return surface;
}

function sameSurface(surface: Surface, body: Obj, pointer: string, errors: Errors): boolean {
  const id = body.surfaceId;
  if (typeof id !== "string" || id === "") {
    errors.add("invalid-document", at(pointer, "surfaceId"), "a surfaceId");
    return false;
  }
  surface.surfaceId ??= id;
  if (id === surface.surfaceId) return true;
  errors.add("invalid-document", at(pointer, "surfaceId"), `one surface (${surface.surfaceId})`);
  return false;
}

function createSurface(surface: Surface, body: Obj, pointer: string, mapping: A2uiMapping, errors: Errors): void {
  if (surface.created) {
    errors.add("invalid-document", pointer, "one createSurface message");
    return;
  }
  surface.created = true;
  if (body.catalogId !== mapping.catalogId)
    errors.add("invalid-document", at(pointer, "catalogId"), `catalogId ${mapping.catalogId}`);
  for (const key of Object.keys(body)) {
    if (key === "surfaceId" || key === "catalogId") continue;
    if (key === "sendDataModel" && body[key] === false) continue;
    if (key === "theme" && mapping.drop?.includes("theme")) continue;
    const expected =
      key === "sendDataModel"
        ? "no sendDataModel: state goes to the host only through declared intents"
        : key === "theme"
          ? "no theme: style comes from the app's design system"
          : "a createSurface field";
    errors.add("invalid-document", at(pointer, key), expected);
  }
}

function updateComponents(surface: Surface, body: Obj, pointer: string, errors: Errors): void {
  const list = body.components;
  const listPointer = at(pointer, "components");
  if (!Array.isArray(list)) {
    errors.add("invalid-document", listPointer, "an array of components");
    return;
  }
  list.forEach((component: unknown, j) => {
    const itemPointer = at(listPointer, j);
    if (!isObj(component) || typeof component.id !== "string" || component.id === "") {
      errors.add("invalid-document", itemPointer, "a component with an id");
      return;
    }
    if (typeof component.component !== "string") {
      errors.add("invalid-document", at(itemPointer, "component"), "a component name");
      return;
    }
    surface.components.set(component.id, { value: component, pointer: itemPointer });
  });
}

function updateDataModel(
  surface: Surface,
  body: Obj,
  source: string,
  errors: Errors,
  charge: (count: number) => void,
): void {
  const path = body.path ?? "/";
  if (typeof path !== "string" || !path.startsWith("/")) {
    errors.add("invalid-document", source, "an absolute JSON Pointer");
    return;
  }
  const removing = !Object.hasOwn(body, "value");
  const parts = segments(path, source, errors);
  charge(1);
  surface.data = setIn(surface.data, 0);

  function setIn(container: Json | undefined, offset: number): Json {
    const head = parts[offset];
    if (head === undefined) return removing ? {} : (body.value as Json);
    const leaf = offset + 1 === parts.length;
    if (Array.isArray(container) && /^(0|[1-9]\d*)$/.test(head)) {
      const index = Number(head);
      if (index > container.length) errors.fatal("limit-exceeded", source, "an array index that does not leave gaps");
      if (leaf && removing && index === container.length) return container;
      charge(container.length + Number(index === container.length));
      const copy = [...container];
      if (leaf && removing) copy.splice(index, 1);
      else copy[index] = setIn(copy[index], offset + 1);
      return copy;
    }
    charge(1);
    if (isObj(container)) {
      for (const key in container) {
        if (!Object.hasOwn(container, key) || key === head) continue;
        charge(1);
      }
    }
    const copy = isObj(container) ? { ...(container as Record<string, Json>) } : {};
    if (leaf && removing) delete copy[head];
    else {
      const next = setIn(own(copy, head), offset + 1);
      Object.defineProperty(copy, head, { value: next, enumerable: true, writable: true, configurable: true });
    }
    return copy;
  }
}

// ---- The data model: bounded JSON Pointer paths and own-property reads ----

function segments(path: string, source: string, errors: Errors): string[] {
  const parts: string[] = [];
  if (path === "/") return parts;
  let start = 1;
  while (true) {
    if (parts.length === INPUT_DEPTH)
      errors.fatal("limit-exceeded", source, `a data path with at most ${INPUT_DEPTH} segments`);
    const end = path.indexOf("/", start);
    parts.push(
      path
        .slice(start, end < 0 ? path.length : end)
        .replaceAll("~1", "/")
        .replaceAll("~0", "~"),
    );
    if (end < 0) return parts;
    start = end + 1;
  }
}

function getIn(data: Json, path: readonly string[]): { found: true; value: Json } | { found: false } {
  let value: Json = data;
  for (const segment of path) {
    if (Array.isArray(value)) {
      if (!/^(0|[1-9]\d*)$/.test(segment) || Number(segment) >= value.length) return { found: false };
      value = value[Number(segment)] as Json;
    } else if (isObj(value) && Object.hasOwn(value, segment)) value = (value as Record<string, Json>)[segment] as Json;
    else return { found: false };
  }
  return { found: true, value };
}

/** A path inside a template resolves against its item; at the root scope a relative path is absolute. */
const absolute = (path: string, scope: string): string => (path.startsWith("/") ? path : `${scope}/${path}`);

// ---- A.3 Tree: one reference per component, every component reachable from root ----

/** The child properties, without any the mapping lifts into a prop (a Button's `child`). */
const childProps = (component: A2uiComponent): readonly string[] =>
  (component.children ?? DEFAULT_CHILDREN).filter((prop) => own(component.lift, prop) === undefined);

function isTemplate(value: unknown): value is Template {
  if (!isObj(value) || typeof value.componentId !== "string" || typeof value.path !== "string") return false;
  return Object.keys(value).length === 2;
}

/** Every component a component references, with the pointer of the reference, in child order. */
function references(entry: Entry, mapped: A2uiComponent, errors: Errors): Ref[] {
  const refs: Ref[] = [];
  const { value, pointer } = entry;
  for (const prop of childProps(mapped)) {
    const child = value[prop];
    const childPointer = at(pointer, prop);
    if (child === undefined) continue;
    if (typeof child === "string") refs.push({ id: child, pointer: childPointer });
    else if (isTemplate(child)) refs.push({ id: child.componentId, pointer: at(childPointer, "componentId") });
    else if (Array.isArray(child) && child.every((id) => typeof id === "string"))
      child.forEach((id: string, n) => {
        refs.push({ id, pointer: at(childPointer, n) });
      });
    else errors.add("invalid-document", childPointer, "a ComponentId, a list of them, or { componentId, path }");
  }
  for (const prop of Object.keys(mapped.lift ?? {})) {
    const child = value[prop];
    if (child === undefined) continue;
    if (typeof child === "string") refs.push({ id: child, pointer: at(pointer, prop) });
    else errors.add("invalid-document", at(pointer, prop), "a ComponentId");
  }
  for (const [prop, item] of Object.entries(mapped.items ?? {})) itemReferences(entry, prop, item, refs, errors);
  return refs;
}

function itemReferences(entry: Entry, prop: string, item: A2uiItem, refs: Ref[], errors: Errors): void {
  const list = entry.value[prop];
  const listPointer = at(entry.pointer, prop);
  if (list === undefined) return;
  if (!Array.isArray(list) || !list.every(isObj)) {
    errors.add("invalid-document", listPointer, "an array of objects");
    return;
  }
  if (item.child === undefined) return;
  list.forEach((value: Obj, n) => {
    const child = own(value, item.child as string);
    const childPointer = at(at(listPointer, n), item.child as string);
    if (typeof child === "string") refs.push({ id: child, pointer: childPointer });
    else if (child !== undefined) errors.add("invalid-document", childPointer, "a ComponentId");
  });
}

function checkGraph(components: ReadonlyMap<string, Entry>, mapping: A2uiMapping, errors: Errors): void {
  if (!components.has("root")) {
    errors.add("not-found", "/", "a component with id root");
    return;
  }
  const reached = new Set(["root"]);
  const queue = ["root"];
  let unmapped = false;
  for (let i = 0; i < queue.length; i++) {
    const entry = components.get(queue[i] as string) as Entry;
    const mapped = own(mapping.components, entry.value.component as string);
    if (mapped === undefined) {
      unmapped = true;
      errors.add("unknown-component", at(entry.pointer, "component"), "a component the mapping names");
      continue;
    }
    for (const ref of references(entry, mapped, errors)) {
      if (!components.has(ref.id)) errors.add("not-found", ref.pointer, `a component with id ${ref.id}`);
      else if (reached.has(ref.id)) errors.add("invalid-document", ref.pointer, "a component referenced once");
      else {
        reached.add(ref.id);
        queue.push(ref.id);
      }
    }
  }
  // Below an unmapped component nothing was followed, so "unreachable" would only repeat that error.
  if (unmapped) return;
  for (const [id, entry] of components)
    if (!reached.has(id)) errors.add("invalid-document", entry.pointer, "a component reachable from root");
}

// ---- A.4–A.8 Conversion ----

type Context = {
  readonly components: ReadonlyMap<string, Entry>;
  readonly mapping: A2uiMapping;
  readonly data: Json;
  readonly limits: Limits;
  readonly errors: Errors;
  readonly local: ReadonlyMap<string, string>;
  readonly initialLocal: Record<string, Json>;
  readonly origins: Record<string, string>;
  nodes: number;
  formattedChars: number;
};

type Element = {
  kind: string;
  key?: string;
  variant?: string;
  props: Record<string, Json>;
  events: Record<string, Json>;
  bind: Record<string, Json>;
  children: Json[];
};

/** The sentinel for a value that failed to resolve; its error is already recorded. */
const FAILED = Symbol("failed");
type Resolved = Json | typeof FAILED;

function convert(surface: Surface, mapping: A2uiMapping, limits: Limits, errors: Errors): A2uiConversion {
  const ctx: Context = {
    components: surface.components,
    mapping,
    data: surface.data,
    limits,
    errors,
    local: new Map(Object.entries(mapping.local ?? {})),
    initialLocal: {},
    origins: {},
    nodes: 0,
    formattedChars: 0,
  };
  const elements = element(ctx, "root", "", "", 1, "root") as Json;
  return { elements, initialLocal: ctx.initialLocal, origins: ctx.origins };
}

function node(ctx: Context, kind: string, key: string, pointer: string, origin: string, depth: number): Element {
  if (++ctx.nodes > ctx.limits.nodes)
    ctx.errors.fatal("limit-exceeded", origin, `at most ${ctx.limits.nodes} elements`);
  if (depth > ctx.limits.depth)
    ctx.errors.fatal("limit-exceeded", origin, `elements nested at most ${ctx.limits.depth} deep`);
  ctx.origins[pointer] = origin;
  return { kind, key, props: {}, events: {}, bind: {}, children: [] };
}

/** Drop empty sections so the output is the element JSON an author would write. */
function finish(el: Element): Json {
  const out: Record<string, Json> = { kind: el.kind };
  if (el.key !== undefined) out.key = el.key;
  if (el.variant !== undefined) out.variant = el.variant;
  for (const name of ["props", "events", "bind"] as const) if (Object.keys(el[name]).length > 0) out[name] = el[name];
  if (el.children.length > 0) out.children = el.children;
  return out;
}

function element(ctx: Context, id: string, scope: string, pointer: string, depth: number, key: string): Json {
  const entry = ctx.components.get(id) as Entry;
  const mapped = own(ctx.mapping.components, entry.value.component as string) as A2uiComponent;
  const el = node(ctx, mapped.kind, key, pointer, entry.pointer, depth);
  const handled = new Set(["id", "component", "action", ...childProps(mapped), ...Object.keys(mapped.lift ?? {})]);
  for (const prop of Object.keys(mapped.items ?? {})) handled.add(prop);
  for (const name of Object.keys(entry.value)) {
    if (handled.has(name)) continue;
    property(ctx, el, mapped, entry, name, scope, pointer);
  }
  for (const [prop, target] of Object.entries(mapped.lift ?? {})) lift(ctx, el, entry, prop, target, scope, pointer);
  if (entry.value.action !== undefined) action(ctx, el, mapped, entry, scope, pointer);
  for (const prop of childProps(mapped)) children(ctx, el, entry, prop, scope, pointer, depth);
  for (const [prop, item] of Object.entries(mapped.items ?? {}))
    items(ctx, el, entry, prop, item, scope, pointer, depth);
  return finish(el);
}

function property(
  ctx: Context,
  el: Element,
  mapped: A2uiComponent,
  entry: Entry,
  name: string,
  scope: string,
  pointer: string,
): void {
  const source = at(entry.pointer, name);
  const raw = entry.value[name];
  const target = own(mapped.props, name);
  if (target !== undefined) setProp(ctx, el, mapped, raw, target, source, scope, pointer);
  else if (name === "variant" && mapped.variants !== undefined) variant(ctx, el, mapped, raw, source, scope, pointer);
  else if (name === "accessibility" && isObj(raw)) {
    for (const field of Object.keys(raw)) {
      const renamed = own(mapped.props, `accessibility.${field}`);
      const fieldSource = at(source, field);
      if (renamed === undefined) ctx.errors.add("unknown-name", fieldSource, "a mapped property");
      else setProp(ctx, el, mapped, raw[field], renamed, fieldSource, scope, pointer);
    }
  } else if (!((name === "weight" || name === "checks") && ctx.mapping.drop?.includes(name)))
    ctx.errors.add("unknown-name", source, "a mapped property");
}

function setProp(
  ctx: Context,
  el: Element,
  mapped: A2uiComponent,
  raw: unknown,
  target: string,
  source: string,
  scope: string,
  pointer: string,
): void {
  const value = resolve(ctx, raw, scope, source);
  if (value === FAILED) return;
  const propPointer = at(at(pointer, "props"), target);
  el.props[target] = value;
  ctx.origins[propPointer] = source;
  // A.7: a bound input whose data path the app mapped to a local key reads and writes that key in the browser.
  const input = mapped.input;
  if (input === undefined || input.prop !== target || !isPath(raw)) return;
  const key = ctx.local.get(absolute(raw.path, scope));
  if (key === undefined) return;
  el.bind[target] = { $path: `local.${key}` };
  ctx.origins[at(at(pointer, "bind"), target)] = source;
  setEvent(ctx, el, input.event, { type: "setLocal", key }, source, pointer);
  if (!Object.hasOwn(ctx.initialLocal, key)) ctx.initialLocal[key] = value;
}

function setEvent(ctx: Context, el: Element, event: string, intent: Json, source: string, pointer: string): void {
  if (Object.hasOwn(el.events, event)) {
    ctx.errors.add("invalid-document", source, `one intent on ${event}`);
    return;
  }
  el.events[event] = intent;
  ctx.origins[at(at(pointer, "events"), event)] = source;
}

function variant(
  ctx: Context,
  el: Element,
  mapped: A2uiComponent,
  raw: unknown,
  source: string,
  scope: string,
  pointer: string,
): void {
  const value = resolve(ctx, raw, scope, source);
  if (value === FAILED) return;
  const target = typeof value === "string" ? own(mapped.variants, value) : undefined;
  if (target === undefined) {
    ctx.errors.add("unknown-name", source, "a variant the mapping names");
    return;
  }
  el.variant = target;
  ctx.origins[at(pointer, "variant")] = source;
}

function lift(ctx: Context, el: Element, entry: Entry, prop: string, target: string, scope: string, pointer: string) {
  const id = entry.value[prop];
  if (typeof id !== "string") return;
  const lifted = ctx.components.get(id) as Entry;
  for (const name of Object.keys(lifted.value))
    if (name !== "id" && name !== "component" && name !== "text")
      ctx.errors.add("unknown-name", at(lifted.pointer, name), "only text on a component lifted into a prop");
  if (!Object.hasOwn(lifted.value, "text")) {
    ctx.errors.add("invalid-document", lifted.pointer, "a component with text to lift");
    return;
  }
  const source = at(lifted.pointer, "text");
  const value = resolve(ctx, lifted.value.text, scope, source);
  if (value === FAILED) return;
  el.props[target] = value;
  ctx.origins[at(at(pointer, "props"), target)] = source;
}

function action(ctx: Context, el: Element, mapped: A2uiComponent, entry: Entry, scope: string, pointer: string): void {
  const raw = entry.value.action;
  const source = at(entry.pointer, "action");
  if (isObj(raw) && Object.hasOwn(raw, "functionCall")) {
    ctx.errors.add("invalid-document", at(source, "functionCall"), "an event action: client functions never run");
    return;
  }
  const event = isObj(raw) ? raw.event : undefined;
  if (!isObj(raw) || Object.keys(raw).length !== 1 || !isObj(event) || typeof event.name !== "string") {
    ctx.errors.add("invalid-document", source, "{ event: { name, context? } }");
    return;
  }
  const name = own(ctx.mapping.actions, event.name);
  if (name === undefined) {
    ctx.errors.add("unknown-name", at(at(source, "event"), "name"), "an event the mapping names");
    return;
  }
  if (mapped.event === undefined) {
    ctx.errors.add("invalid-document", source, "a component mapping with an event");
    return;
  }
  const args: Record<string, Json> = {};
  const fromLocal: Record<string, string> = {};
  const context = event.context ?? {};
  const contextPointer = at(at(source, "event"), "context");
  if (!isObj(context)) {
    ctx.errors.add("invalid-document", contextPointer, "an object");
    return;
  }
  for (const [arg, value] of Object.entries(context))
    contextValue(ctx, arg, value, at(contextPointer, arg), scope, args, fromLocal);
  const intent: Record<string, Json> = { type: "action", name, args };
  if (Object.keys(fromLocal).length > 0) intent.fromLocal = fromLocal;
  setEvent(ctx, el, mapped.event, intent, source, pointer);
}

/** A.8: a literal is an argument; a path is read from local state when the intent fires, never at conversion. */
function contextValue(
  ctx: Context,
  arg: string,
  value: unknown,
  source: string,
  scope: string,
  args: Record<string, Json>,
  fromLocal: Record<string, string>,
): void {
  if (isPath(value)) {
    const key = ctx.local.get(absolute(value.path, scope));
    if (key === undefined) {
      ctx.errors.add("unknown-name", source, "a path mapped to a local key");
      return;
    }
    fromLocal[arg] = key;
  } else if (isObj(value) && Object.hasOwn(value, "call"))
    ctx.errors.add("unknown-name", at(source, "call"), "a literal or a path mapped to a local key");
  else if (value === null || typeof value !== "object") args[arg] = value as Json;
  else ctx.errors.add("invalid-document", source, "a literal or a path mapped to a local key");
}

function children(
  ctx: Context,
  el: Element,
  entry: Entry,
  prop: string,
  scope: string,
  pointer: string,
  depth: number,
): void {
  const value = entry.value[prop];
  const next = (id: string, itemScope: string, key: string) => {
    el.children.push(element(ctx, id, itemScope, at(at(pointer, "children"), el.children.length), depth + 1, key));
  };
  if (typeof value === "string") next(value, scope, value);
  else if (Array.isArray(value)) for (const id of value as string[]) next(id, scope, id);
  else if (isTemplate(value)) {
    // A.4: one instance per item of the data array, keyed by template and index, relative paths against the item.
    const source = at(at(entry.pointer, prop), "path");
    const path = absolute(value.path, scope);
    const list = getIn(ctx.data, segments(path, source, ctx.errors));
    if (!list.found) {
      ctx.errors.add("not-found", source, `a value in the data model at ${path}`);
      return;
    }
    if (!Array.isArray(list.value)) {
      ctx.errors.add("invalid-document", source, `an array at ${path}`);
      return;
    }
    if (list.value.length > TEMPLATE_ITEMS) {
      ctx.errors.add("limit-exceeded", source, `at most ${TEMPLATE_ITEMS} template items`);
      return;
    }
    for (let i = 0; i < list.value.length; i++) next(value.componentId, `${path}/${i}`, `${value.componentId}-${i}`);
  }
}

function items(
  ctx: Context,
  el: Element,
  entry: Entry,
  prop: string,
  item: A2uiItem,
  scope: string,
  pointer: string,
  depth: number,
): void {
  const list = (entry.value[prop] ?? []) as Obj[];
  list.forEach((value, n) => {
    const source = at(at(entry.pointer, prop), n);
    const itemPointer = at(at(pointer, "children"), el.children.length);
    const child = node(ctx, item.kind, `${entry.value.id as string}-${prop}-${n}`, itemPointer, source, depth + 1);
    for (const field of Object.keys(value)) {
      if (field === item.child) continue;
      const target = own(item.props, field);
      if (target === undefined) {
        ctx.errors.add("unknown-name", at(source, field), "a mapped item field");
        continue;
      }
      const resolved = resolve(ctx, value[field], scope, at(source, field));
      if (resolved === FAILED) continue;
      child.props[target] = resolved;
      ctx.origins[at(at(itemPointer, "props"), target)] = at(source, field);
    }
    if (item.index !== undefined) child.props[item.index] = String(n);
    const id = item.child === undefined ? undefined : own(value, item.child);
    if (typeof id === "string")
      child.children.push(element(ctx, id, scope, at(at(itemPointer, "children"), 0), depth + 2, id));
    el.children.push(finish(child));
  });
}

// ---- A.6 Dynamic values ----

function isPath(value: unknown): value is { path: string } {
  return isObj(value) && typeof value.path === "string" && Object.keys(value).length === 1;
}

/** A literal as itself, a `{ path }` read now, `formatString` over data paths substituted now; nothing else runs. */
function resolve(ctx: Context, value: unknown, scope: string, source: string): Resolved {
  if (value === null || typeof value !== "object") return value as Json;
  if (Array.isArray(value)) {
    const out: Json[] = [];
    for (let i = 0; i < value.length; i++) {
      const item = resolve(ctx, value[i], scope, at(source, i));
      if (item === FAILED) return FAILED;
      out.push(item);
    }
    return out;
  }
  const record = value as Obj;
  if (Object.hasOwn(record, "svgPath")) {
    ctx.errors.add("invalid-document", at(source, "svgPath"), "no SVG path: icons are the app's");
    return FAILED;
  }
  if (Object.hasOwn(record, "call")) return call(ctx, record, scope, source);
  if (isPath(record)) return read(ctx, record.path, scope, at(source, "path"));
  const out: Record<string, Json> = {};
  for (const key of Object.keys(record)) {
    const item = resolve(ctx, record[key], scope, at(source, key));
    if (item === FAILED) return FAILED;
    Object.defineProperty(out, key, { value: item, enumerable: true, writable: true, configurable: true });
  }
  return out;
}

function read(ctx: Context, path: string, scope: string, source: string): Resolved {
  const target = absolute(path, scope);
  const found = getIn(ctx.data, segments(target, source, ctx.errors));
  if (found.found) return found.value;
  ctx.errors.add("not-found", source, `a value in the data model at ${target}`);
  return FAILED;
}

function call(ctx: Context, record: Obj, scope: string, source: string): Resolved {
  const args = record.args;
  const only = Object.keys(record).every((key) => key === "call" || key === "args" || key === "returnType");
  if (record.call !== "formatString" || !only || !isObj(args) || typeof args.value !== "string") {
    ctx.errors.add(
      "unknown-name",
      at(source, "call"),
      "a function the converter evaluates: formatString over data paths",
    );
    return FAILED;
  }
  return format(ctx, args.value, scope, at(at(source, "args"), "value"));
}

/** `${path}` → the value as text (null → "", objects as JSON); `\${` is a literal `${`. One pass over the text. */
function format(ctx: Context, text: string, scope: string, source: string): Resolved {
  const parts: string[] = [];
  const maxChars = 4 * ctx.limits.bytes;
  const charge = (count: number) => {
    ctx.formattedChars += count;
    if (ctx.formattedChars > maxChars)
      ctx.errors.fatal("limit-exceeded", source, `at most ${maxChars} formatted characters per conversion`);
  };
  const append = (part: string) => {
    charge(part.length);
    if (part !== "") parts.push(part);
  };
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("${", i);
    if (open < 0) {
      append(text.slice(i));
      break;
    }
    if (open > 0 && text[open - 1] === "\\") {
      append(text.slice(i, open - 1));
      append("${");
      i = open + 2;
      continue;
    }
    const close = text.indexOf("}", open + 2);
    const inner = close < 0 ? "" : text.slice(open + 2, close).trim();
    if (close < 0 || inner === "" || /[(${'"]/.test(inner)) {
      // biome-ignore lint/suspicious/noTemplateCurlyInString: names A2UI's interpolation syntax
      ctx.errors.add("unknown-name", source, "a data path in each ${…}: the converter evaluates no function");
      return FAILED;
    }
    const value = read(ctx, inner, scope, source);
    if (value === FAILED) return FAILED;
    append(text.slice(i, open));
    if (typeof value === "string") append(value);
    else if (value !== null) {
      chargeJson(value, charge);
      parts.push(JSON.stringify(value));
    }
    i = close + 1;
  }
  return parts.join("");
}

/** Account for JSON escaping before stringify can allocate the interpolation. */
function chargeJson(value: Json, charge: (count: number) => void): void {
  if (typeof value === "string") {
    charge(value.length + 2);
    // biome-ignore lint/suspicious/noControlCharactersInRegex: JSON escapes control characters and unpaired surrogates.
    for (const match of value.matchAll(/["\\\u0000-\u001f\ud800-\udfff]/gu)) {
      charge(/["\\\b\t\n\f\r]/.test(match[0]) ? 1 : 5);
    }
  } else if (Array.isArray(value)) {
    charge(2 + Math.max(0, value.length - 1));
    for (const item of value) chargeJson(item, charge);
  } else if (isObj(value)) {
    const keys = Object.keys(value);
    charge(2 + keys.length + Math.max(0, keys.length - 1));
    for (const key of keys) {
      chargeJson(key, charge);
      chargeJson(value[key] as Json, charge);
    }
  } else charge(JSON.stringify(value).length);
}
