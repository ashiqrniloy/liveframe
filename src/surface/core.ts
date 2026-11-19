// The surface core (spec §11): what a renderer does before it draws, independent of any framework or DOM.
// It validates arrivals, applies the revision rules, builds node contexts, completes and gates intents, keeps
// the surface's local state, and evaluates `when` and `bind` (spec §8). An adapter maps its contexts to
// elements; it adds focus, error boundaries and portals, which are the framework's.
import { slotClass, styleDeclarations } from "../css/index.ts";
import { type LiveframeError, LiveframeFailure, type Result } from "../errors.ts";
import { nodeAxisValues } from "../formats/axes.ts";
import type { Catalog, Definition } from "../formats/catalog.ts";
import { carriesValue } from "../formats/events.ts";
import { sameJson } from "../formats/json.ts";
import type { Intent, IntentOrigin, Json, LocalWrite, UiNode, UiTree } from "../formats/tree.ts";
import { isThenable } from "../internal.ts";
import {
  type ActionFacts,
  type CompiledValidator,
  factsOf,
  type LocalFacts,
  UNKNOWN_VALIDATOR as UNKNOWN_VALIDATOR_MESSAGE,
} from "../validate/compile.ts";
import { complete } from "../validate/complete.ts";
import { carriesCheck } from "../validate/intent.ts";
import type { SchemaCheck } from "../validate/schema.ts";
import type { ValidateTreeOptions } from "../validate/tree.ts";
import { type Bindings, compileBindings, evaluateBindings, type LocalState } from "./bindings.ts";
import { shareNodes } from "./share.ts";

/** What an event's intent does, as an implementation may read it (`confirm` and `irreversible` come from the action). */
export type EventMeta = Readonly<{
  type: "action" | "setLocal" | "setState";
  confirm: boolean;
  irreversible: boolean;
}>;

/** One drawable node: the validated, bound and projected facts a renderer needs, and nothing of the framework. */
export type NodeContext = {
  /** The tree node this context was built from; an adapter reports a failed implementation against it. */
  readonly node: UiNode;
  readonly id: string;
  readonly kind: string;
  readonly variant: string | undefined;
  /** Effective props: `bind` applied and validated; `refProps` hold the target's `domId`. */
  readonly props: Readonly<Record<string, Json>>;
  /** A DOM id for this node's element: stable across re-renders, unique per core. */
  readonly domId: string;
  readonly events: Readonly<Record<string, EventMeta>>;
  /** The one recipe class string for a declared slot; the root slot adds style-prop classes. */
  slot(name: string): string;
  /** The root's inline style-prop declarations. */
  readonly style: Readonly<Record<string, string>>;
  /** Raises an event; a promise settles when the host's does. A `setLocal` event applies here and returns undefined. */
  emit(event: string, value?: Json): Promise<void> | undefined;
  /** Child contexts that render: a node whose `when` is false is absent. */
  readonly items: readonly NodeContext[];
  /** Present when the node's bindings failed: draw the node fallback instead of the implementation. */
  readonly fault: readonly LiveframeError[] | undefined;
};

/**
 * What the core reports to a host's `onEvent` (spec §11). Events hold ids, kinds, event names, revisions and
 * `LiveframeError`s, never prop, state or local values, which may be user data. The set may grow in a minor
 * release, so a handler ignores a `type` it does not know.
 */
export type SurfaceEvent = Readonly<
  | {
      /** An arrival that failed validation. `surfaceId` is the surface on screen, not read from the rejected input. */
      type: "arrival-rejected";
      surfaceId?: string;
      errors: readonly LiveframeError[];
    }
  | { type: "stale-revision"; surfaceId: string; revision: number; current: number }
  | {
      /** `invalid-value`: the value does not fit the event's `carries`; `invalid-local`: it does not fit the local schema. */
      type: "emit-rejected";
      nodeId: string;
      event: string;
      reason: "invalid-value" | "invalid-local";
    }
  | { type: "implementation-failed"; nodeId: string; kind: string }
  | { type: "binding-failed"; nodeId: string; prop?: string; errors: readonly LiveframeError[] }
  | { type: "confirm-dropped"; nodeId: string }
  | {
      /** The tree's focus mark could not move focus: `no-element` when the node drew no element with its `domId` in this surface, `not-focusable` when the element did not take focus. */
      type: "focus-missed";
      nodeId: string;
      reason: "no-element" | "not-focusable";
    }
>;

/** What the surface shows now. A new object whenever anything a renderer reads changes. */
export type SurfaceSnapshot = {
  /** False after an arrival that failed validation: draw the whole-surface fallback. */
  readonly valid: boolean;
  readonly errors: readonly LiveframeError[];
  /** The accepted tree, kept across an invalid arrival so later revisions compare against it. */
  readonly tree: UiTree | undefined;
  /** The root's context; undefined before any tree, or when the root's `when` is false. */
  readonly root: NodeContext | undefined;
  readonly local: LocalState;
  /** The accepted tree's focus mark while the surface is valid (spec §11). */
  readonly focus?: string;
};

export type SurfaceCoreOptions = {
  /** The validated catalog the validator was compiled with. */
  readonly catalog: Catalog;
  readonly validator: CompiledValidator;
  /**
   * Validation bounds passed to `validator.validateTree` on each arrival (defaults: 5,000 nodes, 64 depth,
   * 1 MiB). Read when a tree arrives, so an accessor keeps it current without rebuilding the core.
   */
  readonly limits?: ValidateTreeOptions["limits"];
  /**
   * Both callbacks are read when they are used, so a host may pass accessors to keep them current without
   * rebuilding the core.
   */
  readonly onIntent: (intent: Intent, origin: IntentOrigin) => unknown;
  readonly confirm?:
    | ((intent: Intent, meta: Readonly<{ confirm: boolean; irreversible: boolean }>) => Promise<boolean>)
    | undefined;
  /** Prefix of every node's `domId`; unique per surface instance on a page. Default `lf`. */
  readonly domIdPrefix?: string;
  /**
   * Receives a frozen event for each decision the core makes that a host would want to see. Read when used,
   * like the callbacks; a throw or a rejected promise is contained. Nothing is built while it is absent.
   */
  readonly onEvent?: ((event: SurfaceEvent) => unknown) | undefined;
};

export type SurfaceCore = {
  /**
   * Validates an arrival and applies the revision rules (spec §11): a lower revision of the same surface is
   * ignored, a different `surfaceId` replaces the tree and resets local state. Accepting the same input twice
   * does nothing, and it never notifies subscribers. It changes the core at once, so a framework may call it while
   * rendering only when every render it starts is committed; a render that is discarded leaves the core ahead.
   */
  accept(input: unknown): Result<SurfaceSnapshot>;
  snapshot(): SurfaceSnapshot;
  /** Calls `listener` after local state changes. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Marks the surface mounted so a confirmed intent may still dispatch; the returned function unmounts it. */
  attach(): () => void;
  /** Reports that the implementation of `node` threw, so the next arrival retries it instead of reusing it. */
  fail(node: UiNode): void;
};

/**
 * An arrival checked against the committed surface but not yet applied (internal: `/react` only). `snapshot` is
 * what the surface shows once `commit` applies it; preparing changes nothing a host or `emit` can observe.
 */
export type Prepared = {
  readonly input: unknown;
  /** The committed snapshot this was prepared against. */
  readonly base: SurfaceSnapshot;
  readonly snapshot: SurfaceSnapshot;
  readonly result: Result<SurfaceSnapshot>;
};

/**
 * The core with `accept` split in two, for a framework whose renders can be discarded (React's concurrent
 * rendering): `prepare` runs while rendering and `commit` when the frame that draws it commits, so the core never
 * runs ahead of the screen. `accept(input)` is `commit(prepare(input))`.
 */
export type StagedSurfaceCore = SurfaceCore & {
  prepare(input: unknown): Prepared;
  commit(prepared: Prepared): Result<SurfaceSnapshot>;
};

const NONE: readonly string[] = Object.freeze([]);
const NO_READERS: ReadonlySet<UiNode> = new Set();
const NO_ERRORS: readonly LiveframeError[] = Object.freeze([]);
const NO_LOCAL: LocalState = Object.freeze({});
const UNKNOWN_VALIDATOR: readonly LiveframeError[] = Object.freeze([
  Object.freeze({
    kind: "catalog-mismatch",
    pointer: "/validator",
    message: UNKNOWN_VALIDATOR_MESSAGE,
  }),
]);

type KindSpec = { readonly definition: Definition; readonly eventChecks: ReadonlyMap<string, SchemaCheck | undefined> };

const kindSpecs = new WeakMap<Catalog, ReadonlyMap<string, KindSpec>>();

function specsFor(catalog: Catalog): ReadonlyMap<string, KindSpec> {
  let specs = kindSpecs.get(catalog);
  if (!specs) {
    specs = new Map(
      catalog.definitions.map((definition) => [
        definition.kind,
        {
          definition,
          eventChecks: new Map(
            Object.entries(definition.events).map(([event, { carries }]) => [event, carriesCheck(carries)]),
          ),
        },
      ]),
    );
    kindSpecs.set(catalog, specs);
  }
  return specs;
}

/** Rewrites reference props from key-path ids to the targets' DOM ids; other props are untouched. */
function referencedProps(
  props: UiNode["props"],
  refProps: readonly string[] | undefined,
  prefix: string,
): UiNode["props"] {
  if (!refProps?.length) return props;
  const out: Record<string, unknown> = { ...props };
  for (const name of refProps) if (typeof out[name] === "string") out[name] = `${prefix}:${out[name]}`;
  return out as UiNode["props"];
}

/**
 * The host's promise, when it returns one, with rejection contained: a failed intent must not
 * surface as an unhandled rejection from a primitive's `emit`.
 */
function settled(result: unknown): Promise<void> | undefined {
  if (!isThenable(result)) return undefined;
  return Promise.resolve(result).then(
    () => undefined,
    () => undefined,
  );
}

/** What a node's last build read, so a rebuild skips it until one of those local values changes. */
type Entry = {
  readonly reads: readonly string[];
  readonly seen: readonly unknown[];
  readonly context: NodeContext | undefined;
  /** The bound props of that build; undefined when the node binds nothing. */
  readonly props: Readonly<Record<string, Json>> | undefined;
  /** The `shown` count that build read; undefined when the node does not read `shown`. */
  readonly shown: number | undefined;
  /** The node's children that read `shown`. */
  readonly readers: ReadonlySet<UiNode>;
};

/** What a node and its subtree read, found once per tree node. */
type Subtree = {
  /** The local keys the node or anything beneath it reads. */
  readonly reads: readonly string[];
  /** Whether the node's own `when` or `bind` reads `shown`. */
  readonly readsShown: boolean;
  /** The node's children that read `shown`. */
  readonly readers: ReadonlySet<UiNode>;
};

/** The facts the core reads from its validator, looked up once on first use. */
type CoreFacts = { readonly actions: ActionFacts; readonly local: LocalFacts; readonly keys: readonly string[] };

/**
 * Everything one surface core holds. The fields after the tables are every mutable binding of the core; the
 * module functions below read only the state they are passed, and the closure in `createStagedCore` writes it.
 */
type CoreState = {
  readonly options: SurfaceCoreOptions;
  readonly specs: ReadonlyMap<string, KindSpec>;
  /** Prefix of every `domId`. */
  readonly prefix: string;
  /** Applies `setLocal` or compound `local` writes (validated first; `defer` returns the commit callback). */
  readonly writeLocal: (
    node: UiNode,
    event: string,
    writes: readonly LocalWrite[],
    eventValue: unknown,
    defer?: boolean,
  ) => (() => void) | undefined;
  /** Pre-write local values keyed by name for `until: "revision"` writes, restored on next accepted revision. */
  readonly pendingRevert: Map<string, Json | undefined>;
  /** The validator's facts: read when first needed, so a core over a validator that never accepts a tree does no lookup. */
  known: CoreFacts | undefined;
  /** True while the surface is mounted: a confirmed intent dispatches only then. */
  mounted: boolean;
  /** True while a confirmation is pending: a second confirmed intent is dropped. */
  confirming: boolean;
  local: LocalState;
  tree: UiTree | undefined;
  valid: boolean;
  errors: readonly LiveframeError[];
  root: NodeContext | undefined;
  snap: SurfaceSnapshot;
  /** The input last committed. */
  committed: { readonly input: unknown } | undefined;
  /** The input last validated, with its outcome. */
  checked: { readonly input: unknown; readonly arrival: Result<UiTree> } | undefined;
  /** The arrival last prepared. */
  staged: Prepared | undefined;
};

function facts(core: CoreState): CoreFacts {
  if (!core.known) {
    const found = factsOf(core.options.validator);
    if (!found) throw new LiveframeFailure(UNKNOWN_VALIDATOR);
    core.known = { actions: found.actions, local: found.local, keys: Object.keys(found.local.schema.properties) };
  }
  return core.known;
}

function spec(core: CoreState, kind: string): KindSpec {
  const found = core.specs.get(kind);
  if (!found) throw new Error(`Unknown kind: ${kind}`);
  return found;
}

function notify(options: SurfaceCoreOptions, event: SurfaceEvent): void {
  const frozen = Object.freeze(event);
  try {
    settled(options.onEvent?.(frozen));
  } catch {
    // A host's logger must never break rendering.
  }
}

/** An implementation bug: report it, then throw as `emit` always has. */
function rejected(core: CoreState, node: UiNode, event: string, reason: "invalid-value" | "invalid-local"): never {
  if (core.options.onEvent) notify(core.options, { type: "emit-rejected", nodeId: node.id, event, reason });
  throw new Error(`Invalid event value: ${node.kind}.${event}`);
}

/**
 * Hands a completed intent to the host. Confirmation gates only this call: with `confirm` set and the action
 * asking for it, the host's `confirm` decides first, one confirmation at a time, and a surface unmounted
 * meanwhile drops the intent. The returned promise never rejects.
 */
function raise(
  core: CoreState,
  intent: Intent,
  origin: IntentOrigin,
  meta: { confirm: boolean; irreversible: boolean } | undefined,
  onApprove?: () => Intent | undefined,
): Promise<void> | undefined {
  const { options } = core;
  const { onIntent, confirm } = options;
  if (!confirm || !meta?.confirm) {
    const final = onApprove?.() ?? intent;
    try {
      return settled(onIntent(final, origin));
    } catch {
      // The host's failure is not the primitive's: `emit` never throws for a host failure.
      return undefined;
    }
  }
  if (core.confirming) {
    if (options.onEvent) notify(options, { type: "confirm-dropped", nodeId: origin.nodeId });
    return undefined;
  }
  core.confirming = true;
  const confirmationMeta = Object.freeze({ confirm: meta.confirm, irreversible: meta.irreversible });
  return (async () => {
    let approved = false;
    try {
      approved = await confirm(intent, confirmationMeta);
    } catch {
      // A failed confirmation is a cancellation.
    } finally {
      core.confirming = false;
    }
    if (!approved) return;
    if (!core.mounted) {
      if (options.onEvent) notify(options, { type: "confirm-dropped", nodeId: origin.nodeId });
      return;
    }
    const final = (core.tree?.surfaceId === origin.surfaceId ? onApprove?.() : undefined) ?? intent;
    try {
      await onIntent(final, origin);
    } catch {
      // The host's failure is not the primitive's: `emit`'s promise never rejects.
    }
  })();
}

/** The context of one node; `emit` reads the surface as it is when the event is raised, not when it was built. */
function context(
  core: CoreState,
  node: UiNode,
  props: UiNode["props"],
  items: readonly NodeContext[],
  fault?: readonly LiveframeError[],
): NodeContext {
  const { prefix } = core;
  const { catalog } = core.options;
  const { definition, eventChecks } = spec(core, node.kind);
  const projected = styleDeclarations(node.style ?? {}, catalog);
  // Validated props are enum members, so the axis values are catalog names, never free strings.
  const axes = definition.axes ? nodeAxisValues(definition, props) : undefined;
  const events = Object.freeze(
    Object.fromEntries(
      Object.entries(node.events ?? {}).map(([event, intent]) => {
        const action = intent.type === "action" ? facts(core).actions.get(intent.name) : undefined;
        return [
          event,
          Object.freeze({
            type: intent.type,
            confirm: action?.confirm ?? false,
            irreversible: action?.irreversible ?? false,
          }),
        ];
      }),
    ),
  );
  const item: NodeContext = {
    node,
    id: node.id,
    kind: node.kind,
    variant: node.variant,
    props: referencedProps(props, definition.refProps, prefix),
    domId: `${prefix}:${node.id}`,
    events,
    slot(name) {
      if (!definition.slots.includes(name as never)) throw new Error(`Undeclared slot: ${node.kind}.${name}`);
      const recipe = slotClass(node.kind, node.variant ?? definition.defaultVariant, name, axes);
      return [recipe, ...(name === "root" ? projected.classes : [])].join(" ");
    },
    style: projected.style,
    emit(event, value) {
      const { tree } = core;
      if (!core.valid || !tree || !node.events || !Object.hasOwn(node.events, event)) return;
      const intent = node.events[event];
      if (!intent) return;
      const carries = definition.events[event]?.carries;
      const check = eventChecks.get(event);
      if (!(check ? check(value, "", { errors: [], maxErrors: 1 }) : carriesValue(carries, value)))
        rejected(core, node, event, "invalid-value");
      if (intent.type === "setLocal") {
        core.writeLocal(node, event, [intent], value);
        return;
      }
      const meta = events[event];
      const written = intent.local?.length
        ? core.writeLocal(node, event, intent.local, value, Boolean(core.options.confirm && meta?.confirm))
        : undefined;
      // A confirmed event applies its writes after approval, so a `fromLocal` read is completed again then (spec §8).
      const apply = written
        ? () => {
            written();
            return intent.fromLocal === undefined ? undefined : complete(intent, value, core.local);
          }
        : undefined;
      const origin = Object.freeze({
        surfaceId: tree.surfaceId,
        revision: tree.revision,
        nodeId: node.id,
        event,
      });
      return raise(core, complete(intent, value, core.local), origin, meta, apply);
    },
    items,
    fault,
  };
  return item;
}

export function createSurfaceCore(options: SurfaceCoreOptions): SurfaceCore {
  return createStagedCore(options);
}

/** `createSurfaceCore` with `prepare` and `commit` exposed (internal: `/react` only). */
export function createStagedCore(options: SurfaceCoreOptions): StagedSurfaceCore {
  const { catalog, validator } = options;
  const failed = new WeakSet<UiNode>();
  const entries = new WeakMap<UiNode, Entry>();
  const compiled = new WeakMap<UiNode, Bindings | null>();
  const subtrees = new WeakMap<UiNode, Subtree>();
  const listeners = new Set<() => void>();
  const core: CoreState = {
    options,
    specs: specsFor(catalog),
    prefix: options.domIdPrefix ?? "lf",
    writeLocal,
    pendingRevert: new Map(),
    known: undefined,
    mounted: false,
    confirming: false,
    local: NO_LOCAL,
    tree: undefined,
    valid: false,
    errors: NO_ERRORS,
    root: undefined,
    snap: Object.freeze({ valid: false, errors: NO_ERRORS, tree: undefined, root: undefined, local: NO_LOCAL }),
    committed: undefined,
    checked: undefined,
    staged: undefined,
  };

  function bindingsOf(node: UiNode): Bindings | undefined {
    let found = compiled.get(node);
    if (found === undefined) {
      const { local, keys } = facts(core);
      found = compileBindings(node, spec(core, node.kind).definition, local, keys) ?? null;
      compiled.set(node, found);
    }
    return found ?? undefined;
  }
  /** The local keys read by a node or anything beneath it, and its children that read `shown`. */
  function subtreeOf(node: UiNode): Subtree {
    const known = subtrees.get(node);
    if (known) return known;
    const bindings = bindingsOf(node);
    const keys = new Set(bindings?.reads);
    const readers: UiNode[] = [];
    for (const child of node.children ?? []) {
      const below = subtreeOf(child);
      for (const key of below.reads) keys.add(key);
      if (below.readsShown) readers.push(child);
    }
    const subtree = {
      reads: keys.size ? Object.freeze([...keys]) : NONE,
      readsShown: bindings?.readsShown === true,
      readers: readers.length ? new Set(readers) : NO_READERS,
    };
    subtrees.set(node, subtree);
    return subtree;
  }

  type ResolvedWrite = { readonly key: string; readonly value: Json; readonly until?: "revision" };

  /** Validates every write against the local schema before mutating `core.local`. */
  function resolveLocalWrites(
    node: UiNode,
    event: string,
    writes: readonly LocalWrite[],
    eventValue: unknown,
  ): ResolvedWrite[] {
    const checks = facts(core).local.checks;
    const resolved: ResolvedWrite[] = [];
    for (let i = 0; i < writes.length; i++) {
      const write = writes[i] as LocalWrite;
      const filled = Object.hasOwn(write, "value") ? write.value : eventValue;
      const check = checks.get(write.key);
      if (!check || filled === undefined || !check(filled, "", { errors: [], maxErrors: 1 }))
        rejected(core, node, event, "invalid-local");
      resolved.push({ key: write.key, value: filled as Json, ...(write.until ? { until: write.until } : {}) });
    }
    return resolved;
  }

  function commitLocalWrites(writes: readonly ResolvedWrite[]): void {
    const next: Record<string, Json> = { ...core.local };
    let changed = false;
    for (let i = 0; i < writes.length; i++) {
      const write = writes[i] as ResolvedWrite;
      if (write.until === "revision") {
        if (!core.pendingRevert.has(write.key)) core.pendingRevert.set(write.key, next[write.key]);
      } else if (core.pendingRevert.size) {
        core.pendingRevert.delete(write.key);
      }
      if (next[write.key] !== write.value) {
        next[write.key] = write.value;
        changed = true;
      }
    }
    if (!changed) return;
    core.local = Object.freeze(next);
    core.root = core.tree ? build(core.tree.root, core.local) : undefined;
    const { valid, errors, tree, root, local } = core;
    core.snap = snapshotOf({ valid, errors, tree, root, local });
    for (const listener of [...listeners]) listener();
  }

  /** Local writes are applied by the renderer and never sent to the host (spec §8). */
  function writeLocal(
    node: UiNode,
    event: string,
    writes: readonly LocalWrite[],
    eventValue: unknown,
    defer = false,
  ): (() => void) | undefined {
    const resolved = resolveLocalWrites(node, event, writes, eventValue);
    if (defer) return () => commitLocalWrites(resolved);
    commitLocalWrites(resolved);
    return undefined;
  }

  /**
   * The drawn children, in order, when some read `shown` (spec §8): `shown` counts the drawn `when`-gated
   * children that do not read it, so its readers are built in a second pass and never change the count they read.
   */
  function countedItems(children: readonly UiNode[], readers: ReadonlySet<UiNode>, local: LocalState) {
    const others: (NodeContext | undefined)[] = [];
    let shown = 0;
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as UiNode;
      if (readers.has(child)) continue;
      const built = build(child, local);
      others[i] = built;
      if (built && !built.fault && child.when !== undefined) shown++;
    }
    const items: NodeContext[] = [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as UiNode;
      const built = readers.has(child) ? build(child, local, shown) : others[i];
      if (built) items.push(built);
    }
    return items;
  }

  /** A node with children: its context is reused when its props and every child context are the same objects. */
  function branch(
    node: UiNode,
    before: Entry | undefined,
    bound: Readonly<Record<string, Json>> | undefined,
    local: LocalState,
    readers: ReadonlySet<UiNode>,
  ) {
    const children = node.children ?? [];
    let items: NodeContext[] = [];
    if (readers.size) items = countedItems(children, readers, local);
    else
      for (const child of children) {
        const built = build(child, local);
        if (built) items.push(built);
      }
    const prior = before?.context;
    const same =
      prior !== undefined &&
      !prior.fault &&
      prior.items.length === items.length &&
      prior.items.every((item, i) => item === items[i]) &&
      sameJson(before?.props, bound);
    return same ? prior : context(core, node, bound ?? node.props, items);
  }

  /**
   * The validator decides first (spec §11: validate before reading any tree field). Only a tree it rejected at
   * `/catalogId`, or accepted although it names another catalog, is then reported by name as `catalog-mismatch`.
   */
  function named(input: unknown, arrival: Result<UiTree>): Result<UiTree> {
    let other = false;
    if (arrival.ok) other = arrival.value.catalogId !== catalog.catalogId;
    else if (arrival.errors.some((error) => error.pointer === "/catalogId")) {
      try {
        const claimed = (input as { catalogId?: unknown }).catalogId;
        other = typeof claimed === "string" && claimed !== catalog.catalogId;
      } catch {
        // A hostile getter is just an invalid tree.
      }
    }
    return other
      ? {
          ok: false,
          errors: [
            {
              kind: "catalog-mismatch",
              pointer: "/catalogId",
              message: "Tree names another catalog than this surface renders",
            },
          ],
        }
      : arrival;
  }

  function reportRejected(rejection: readonly LiveframeError[]): void {
    if (options.onEvent)
      notify(options, {
        type: "arrival-rejected",
        ...(core.tree ? { surfaceId: core.tree.surfaceId } : {}),
        errors: Object.freeze([...rejection]),
      });
  }

  function reportStale(arrived: UiTree, current: UiTree): void {
    if (options.onEvent)
      notify(options, {
        type: "stale-revision",
        surfaceId: arrived.surfaceId,
        revision: arrived.revision,
        current: current.revision,
      });
  }

  function reportBinding(node: UiNode, faults: readonly LiveframeError[]): void {
    const prop = /^\/(?:bind|props)\/([^/]+)/.exec(faults[0]?.pointer ?? "")?.[1];
    notify(options, {
      type: "binding-failed",
      nodeId: node.id,
      ...(prop === undefined ? {} : { prop }),
      errors: Object.freeze([...faults]),
    });
  }

  /**
   * The context of a node and its subtree, or undefined when a `when` hides it. A node is rebuilt only when
   * a local key it, or anything beneath it, reads has changed; an unchanged result keeps its identity so an
   * adapter's cache and a framework's reconciliation skip it.
   */
  function build(node: UiNode, local: LocalState, shown = 0): NodeContext | undefined {
    const before = entries.get(node);
    if (
      before &&
      (before.shown === undefined || before.shown === shown) &&
      before.seen.every((value, i) => value === local[before.reads[i] as string])
    )
      return before.context;
    const { reads, readers } = before ?? subtreeOf(node);
    const bindings = bindingsOf(node);
    const evaluated = bindings ? evaluateBindings(node, bindings, local, validator, shown) : undefined;
    let result: NodeContext | undefined;
    let props: Readonly<Record<string, Json>> | undefined;
    if (evaluated && "fault" in evaluated) {
      const prior = before?.context;
      if (prior?.fault && sameJson(prior.fault, evaluated.fault)) result = prior;
      else {
        result = context(core, node, node.props, [], evaluated.fault);
        if (options.onEvent) reportBinding(node, evaluated.fault);
      }
    } else if (!(evaluated && "hidden" in evaluated)) {
      props = evaluated?.bound ? evaluated.props : undefined;
      result = branch(node, before, props, local, readers);
    }
    const read = bindings?.readsShown ? shown : undefined;
    entries.set(node, { reads, seen: reads.map((key) => local[key]), context: result, props, shown: read, readers });
    return result;
  }

  /** The snapshot of these fields: the committed one when nothing a renderer reads would change. */
  function snapshotOf(next: SurfaceSnapshot): SurfaceSnapshot {
    const { snap } = core;
    const same =
      snap.valid === next.valid &&
      snap.tree === next.tree &&
      snap.root === next.root &&
      snap.local === next.local &&
      snap.errors === next.errors;
    if (same) return snap;
    const focus = next.valid ? next.tree?.focus : undefined;
    return Object.freeze(focus === undefined ? next : { ...next, focus });
  }

  /** Validates an input once, reporting a rejection when it is first seen, as `accept` always has. */
  function check(input: unknown): { readonly arrival: Result<UiTree>; readonly fresh: boolean } {
    const { checked } = core;
    if (checked && checked.input === input) return { arrival: checked.arrival, fresh: false };
    const { limits } = options;
    const arrival = named(input, validator.validateTree(input, limits !== undefined ? { limits } : undefined));
    core.checked = { input, arrival };
    if (!arrival.ok) reportRejected(arrival.errors);
    return { arrival, fresh: true };
  }

  type StagedPrepared = Prepared & { readonly accepted?: boolean };

  function revertedLocal(local: LocalState, pending: ReadonlyMap<string, Json | undefined>): LocalState {
    const next: Record<string, Json> = { ...local };
    for (const [key, previous] of pending) {
      if (previous === undefined) delete next[key];
      else next[key] = previous;
    }
    return Object.freeze(next);
  }

  /** What `input` makes of the committed surface, without changing it. */
  function stage(input: unknown): StagedPrepared {
    const base = core.snap;
    const kept = (): StagedPrepared => ({
      input,
      base,
      snapshot: base,
      result: base.valid ? { ok: true, value: base } : { ok: false, errors: base.errors },
    });
    const rejected = (rejection: readonly LiveframeError[]): StagedPrepared => {
      const { tree, root, local } = core;
      const snapshot = snapshotOf({ valid: false, errors: rejection, tree, root, local });
      return { input, base, snapshot, result: { ok: false, errors: rejection } };
    };
    if (core.committed?.input === input) return kept();
    const { arrival, fresh } = check(input);
    if (!arrival.ok) return rejected(arrival.errors);
    const next = arrival.value;
    const { tree } = core;
    if (tree && tree.surfaceId === next.surfaceId && tree.revision > next.revision) {
      if (fresh) reportStale(next, tree);
      return kept();
    }
    let values = core.local;
    if (!tree || tree.surfaceId !== next.surfaceId) {
      try {
        values = facts(core).local.initial;
      } catch {
        if (fresh) reportRejected(UNKNOWN_VALIDATOR);
        return rejected(UNKNOWN_VALIDATOR);
      }
    } else if (core.pendingRevert.size > 0) {
      values = revertedLocal(core.local, core.pendingRevert);
    }
    const shared = shareNodes(tree, next, failed);
    const snapshot = snapshotOf({
      valid: true,
      errors: NO_ERRORS,
      tree: shared,
      root: build(shared.root, values),
      local: values,
    });
    return { input, base, snapshot, result: { ok: true, value: snapshot }, accepted: true };
  }

  function prepare(input: unknown): Prepared {
    const { staged } = core;
    if (staged && staged.input === input && staged.base === core.snap) return staged;
    core.staged = stage(input);
    return core.staged;
  }

  function commit(prepared: Prepared): Result<SurfaceSnapshot> {
    // Local state changed after it was prepared: apply the same input to the surface as it is now.
    const applied = (prepared.base === core.snap ? prepared : stage(prepared.input)) as StagedPrepared;
    if (applied.accepted && core.pendingRevert.size > 0) core.pendingRevert.clear();
    core.committed = { input: applied.input };
    core.staged = undefined;
    ({
      valid: core.valid,
      errors: core.errors,
      tree: core.tree,
      root: core.root,
      local: core.local,
    } = applied.snapshot);
    core.snap = applied.snapshot;
    return applied.result;
  }

  return {
    accept: (input) => commit(prepare(input)),
    prepare,
    commit,
    snapshot: () => core.snap,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    attach() {
      core.mounted = true;
      return () => {
        core.mounted = false;
      };
    },
    fail(node) {
      failed.add(node);
      if (options.onEvent) notify(options, { type: "implementation-failed", nodeId: node.id, kind: node.kind });
    },
  };
}
