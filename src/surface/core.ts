// The surface core (spec §11): what a renderer does before it draws, independent of any framework or DOM.
// It validates arrivals, applies the revision rules, builds node contexts, completes and gates intents, keeps
// the surface's local state, and evaluates `when` and `bind` (plan 029). An adapter maps its contexts to
// elements; it adds focus, error boundaries and portals, which are the framework's.
import { slotClass, styleDeclarations } from "../css/index.ts";
import type { LiveframeError, Result } from "../errors.ts";
import { nodeAxisValues } from "../formats/axes.ts";
import type { Catalog, Definition } from "../formats/catalog.ts";
import { carriesValue } from "../formats/events.ts";
import { sameJson } from "../formats/json.ts";
import type { Intent, IntentOrigin, Json, UiNode, UiTree } from "../formats/tree.ts";
import { isThenable } from "../internal.ts";
import { actionFacts, type CompiledValidator, type LocalFacts, localFacts } from "../validate/compile.ts";
import { complete } from "../validate/complete.ts";
import { compileSchema, type SchemaCheck } from "../validate/schema.ts";
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
 * What the core reports to a host's `onEvent` (plan 029 T5). Events hold ids, kinds, event names, revisions and
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
};

export type SurfaceCoreOptions = {
  /** The validated catalog the validator was compiled with. */
  readonly catalog: Catalog;
  readonly validator: CompiledValidator;
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
   * does nothing, and it never notifies subscribers, so it may run while a framework renders.
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

const NONE: readonly string[] = Object.freeze([]);
const NO_ERRORS: readonly LiveframeError[] = Object.freeze([]);
const NO_LOCAL: LocalState = Object.freeze({});

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
            Object.entries(definition.events).map(([event, { carries }]) => [
              event,
              typeof carries === "object" ? compileSchema(carries.object) : undefined,
            ]),
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
};

export function createSurfaceCore(options: SurfaceCoreOptions): SurfaceCore {
  const { catalog, validator } = options;
  const specs = specsFor(catalog);
  // Read from the validator when first needed, so a core over a validator that never accepts a tree
  // (a host's wrapper that rejects every arrival) does no lookup and cannot fail on one.
  let known: { actions: ReturnType<typeof actionFacts>; local: LocalFacts; keys: readonly string[] } | undefined;
  const facts = () => {
    if (!known) {
      const local = localFacts(validator);
      known = { actions: actionFacts(validator), local, keys: Object.keys(local.schema.properties) };
    }
    return known;
  };
  const prefix = options.domIdPrefix ?? "lf";
  const failed = new WeakSet<UiNode>();
  const entries = new WeakMap<UiNode, Entry>();
  const compiled = new WeakMap<UiNode, Bindings | null>();
  const subtreeReads = new WeakMap<UiNode, readonly string[]>();
  const listeners = new Set<() => void>();
  let mounted = false;
  let confirming = false;
  let local: LocalState = NO_LOCAL;
  let tree: UiTree | undefined;
  let valid = false;
  let errors = NO_ERRORS;
  let root: NodeContext | undefined;
  let snap: SurfaceSnapshot = Object.freeze({ valid, errors, tree, root, local });
  let last: { readonly input: unknown } | undefined;

  function spec(kind: string): KindSpec {
    const found = specs.get(kind);
    if (!found) throw new Error(`Unknown kind: ${kind}`);
    return found;
  }

  function bindingsOf(node: UiNode): Bindings | undefined {
    let found = compiled.get(node);
    if (found === undefined) {
      const { local, keys } = facts();
      found = compileBindings(node, spec(node.kind).definition, local, keys) ?? null;
      compiled.set(node, found);
    }
    return found ?? undefined;
  }

  /** The local keys read by a node or anything beneath it, found once per tree node. */
  function readsOf(node: UiNode): readonly string[] {
    const known = subtreeReads.get(node);
    if (known) return known;
    const keys = new Set(bindingsOf(node)?.reads);
    for (const child of node.children ?? []) for (const key of readsOf(child)) keys.add(key);
    const reads = keys.size ? Object.freeze([...keys]) : NONE;
    subtreeReads.set(node, reads);
    return reads;
  }

  function notify(event: SurfaceEvent): void {
    const frozen = Object.freeze(event);
    try {
      settled(options.onEvent?.(frozen));
    } catch {
      // A host's logger must never break rendering.
    }
  }

  /** An implementation bug: report it, then throw as `emit` always has. */
  function rejected(node: UiNode, event: string, reason: "invalid-value" | "invalid-local"): never {
    if (options.onEvent) notify({ type: "emit-rejected", nodeId: node.id, event, reason });
    throw new Error(`Invalid event value: ${node.kind}.${event}`);
  }

  function raise(
    intent: Intent,
    origin: IntentOrigin,
    meta: { confirm: boolean; irreversible: boolean } | undefined,
  ): Promise<void> | undefined {
    const { onIntent, confirm } = options;
    if (!confirm || !meta?.confirm) return settled(onIntent(intent, origin));
    if (confirming) {
      if (options.onEvent) notify({ type: "confirm-dropped", nodeId: origin.nodeId });
      return undefined;
    }
    confirming = true;
    const confirmationMeta = Object.freeze({ confirm: meta.confirm, irreversible: meta.irreversible });
    return (async () => {
      let approved = false;
      try {
        approved = await confirm(intent, confirmationMeta);
      } catch {
        // A failed confirmation is a cancellation.
      } finally {
        confirming = false;
      }
      if (!approved) return;
      if (!mounted) {
        if (options.onEvent) notify({ type: "confirm-dropped", nodeId: origin.nodeId });
        return;
      }
      try {
        await onIntent(intent, origin);
      } catch {
        // The host's failure is not the primitive's: `emit`'s promise never rejects.
      }
    })();
  }

  /** `setLocal` is the renderer's own (plan 029 L3): fill, check against the local schema, write, re-evaluate. */
  function writeLocal(node: UiNode, event: string, key: string, filled: unknown): void {
    const check = facts().local.checks.get(key);
    if (!check || filled === undefined || !check(filled, "", { errors: [], maxErrors: 1 }))
      rejected(node, event, "invalid-local");
    if (local[key] === filled) return;
    local = Object.freeze({ ...local, [key]: filled as Json });
    root = tree ? build(tree.root) : undefined;
    publish();
    for (const listener of [...listeners]) listener();
  }

  function context(
    node: UiNode,
    props: UiNode["props"],
    items: readonly NodeContext[],
    fault?: readonly LiveframeError[],
  ) {
    const { definition, eventChecks } = spec(node.kind);
    const projected = styleDeclarations(node.style ?? {}, catalog);
    // Validated props are enum members, so the axis values are catalog names, never free strings.
    const axes = definition.axes ? nodeAxisValues(definition, props) : undefined;
    const events = Object.freeze(
      Object.fromEntries(
        Object.entries(node.events ?? {}).map(([event, intent]) => {
          const action = intent.type === "action" ? facts().actions.get(intent.name) : undefined;
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
        if (!valid || !tree || !node.events || !Object.hasOwn(node.events, event)) return;
        const intent = node.events[event];
        if (!intent) return;
        const carries = definition.events[event]?.carries;
        const check = eventChecks.get(event);
        if (!(check ? check(value, "", { errors: [], maxErrors: 1 }) : carriesValue(carries, value)))
          rejected(node, event, "invalid-value");
        if (intent.type === "setLocal") {
          writeLocal(node, event, intent.key, Object.hasOwn(intent, "value") ? intent.value : value);
          return;
        }
        const origin = Object.freeze({
          surfaceId: tree.surfaceId,
          revision: tree.revision,
          nodeId: node.id,
          event,
        });
        return raise(complete(intent, value), origin, events[event]);
      },
      items,
      fault,
    };
    return item;
  }

  /** A node with children: its context is reused when its props and every child context are the same objects. */
  function branch(node: UiNode, before: Entry | undefined, bound: Readonly<Record<string, Json>> | undefined) {
    const items: NodeContext[] = [];
    for (const child of node.children ?? []) {
      const built = build(child);
      if (built) items.push(built);
    }
    const prior = before?.context;
    const same =
      prior !== undefined &&
      !prior.fault &&
      prior.items.length === items.length &&
      prior.items.every((item, i) => item === items[i]) &&
      sameJson(before?.props, bound);
    return same ? prior : context(node, bound ?? node.props, items);
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
      notify({
        type: "arrival-rejected",
        ...(tree ? { surfaceId: tree.surfaceId } : {}),
        errors: Object.freeze([...rejection]),
      });
  }

  function reportStale(arrived: UiTree, current: UiTree): void {
    if (options.onEvent)
      notify({
        type: "stale-revision",
        surfaceId: arrived.surfaceId,
        revision: arrived.revision,
        current: current.revision,
      });
  }

  function reportBinding(node: UiNode, faults: readonly LiveframeError[]): void {
    const prop = /^\/(?:bind|props)\/([^/]+)/.exec(faults[0]?.pointer ?? "")?.[1];
    notify({
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
  function build(node: UiNode): NodeContext | undefined {
    const before = entries.get(node);
    if (before?.seen.every((value, i) => value === local[before.reads[i] as string])) return before.context;
    const reads = before?.reads ?? readsOf(node);
    const bindings = bindingsOf(node);
    const evaluated = bindings ? evaluateBindings(node, bindings, local, validator) : undefined;
    let result: NodeContext | undefined;
    let props: Readonly<Record<string, Json>> | undefined;
    if (evaluated && "fault" in evaluated) {
      const prior = before?.context;
      if (prior?.fault && sameJson(prior.fault, evaluated.fault)) result = prior;
      else {
        result = context(node, node.props, [], evaluated.fault);
        if (options.onEvent) reportBinding(node, evaluated.fault);
      }
    } else if (!(evaluated && "hidden" in evaluated)) {
      props = evaluated?.bound ? evaluated.props : undefined;
      result = branch(node, before, props);
    }
    entries.set(node, { reads, seen: reads.map((key) => local[key]), context: result, props });
    return result;
  }

  function publish(): void {
    if (
      snap.valid === valid &&
      snap.tree === tree &&
      snap.root === root &&
      snap.local === local &&
      snap.errors === errors
    )
      return;
    snap = Object.freeze({ valid, errors, tree, root, local });
  }

  return {
    accept(input) {
      if (last && last.input === input) return valid ? { ok: true, value: snap } : { ok: false, errors };
      last = { input };
      const arrival = named(input, validator.validateTree(input));
      if (!arrival.ok) {
        valid = false;
        errors = arrival.errors;
        publish();
        reportRejected(arrival.errors);
        return arrival;
      }
      const next = arrival.value;
      const previous = tree;
      if (previous && previous.surfaceId === next.surfaceId && previous.revision > next.revision) {
        reportStale(next, previous);
      } else {
        if (!previous || previous.surfaceId !== next.surfaceId) local = facts().local.initial;
        tree = shareNodes(previous, next, failed);
        root = build(tree.root);
      }
      valid = true;
      errors = NO_ERRORS;
      publish();
      return { ok: true, value: snap };
    },
    snapshot: () => snap,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    attach() {
      mounted = true;
      return () => {
        mounted = false;
      };
    },
    fail(node) {
      failed.add(node);
      if (options.onEvent) notify({ type: "implementation-failed", nodeId: node.id, kind: node.kind });
    },
  };
}
