// The plain DOM adapter (spec §11): maps the surface core's node contexts to elements with no framework. Every rule
// before drawing is the core's; this module only creates, updates, places and disposes elements.
import { surfaceAttributes } from "../css/index.ts";
import type { Result } from "../errors.ts";
import type { CompiledValidator, Intent, IntentOrigin, Json, UiTree, ValidateTreeOptions } from "../index.ts";
import { createSurfaceCore } from "../surface/core.ts";
import type { NodeContext, SurfaceCore, SurfaceEvent, SurfaceSnapshot } from "../surface/index.ts";
import { type CatalogBinding, checkRegistries, refusal, refusedCore } from "../surface/registry.ts";
import { createFocusMark, focusSnapshot, moveFocus, restoreFocus } from "./focus.ts";
import { type DomImplementation, type DomItem, domBinding } from "./implement.ts";
import { createMotion, type Motion } from "./motion.ts";
import { place } from "./place.ts";
import { beginSwitch } from "./switching.ts";

type Identity = { readonly id: string; readonly version: string };

/** What `mount` takes; every field but `validator` may change later through `set`. */
export type MountOptions = {
  readonly validator: CompiledValidator;
  readonly theme: Identity;
  readonly designSystem: Identity;
  readonly transparency?: "auto" | "reduced";
  readonly onIntent: (intent: Intent, origin: IntentOrigin) => unknown;
  readonly confirm?: (intent: Intent, meta: Readonly<{ confirm: boolean; irreversible: boolean }>) => Promise<boolean>;
  /** Frozen observability events from the surface core (rejected arrivals and emits, failed nodes and bindings). */
  readonly onEvent?: (event: SurfaceEvent) => unknown;
  /** Validation bounds forwarded to `validator.validateTree` on each arrival (defaults: 5,000 nodes, 64 depth, 1 MiB). */
  readonly limits?: ValidateTreeOptions["limits"];
  /**
   * A new element each call: drawn for the whole surface after an invalid arrival, and at a node whose bindings
   * failed or whose `draw` threw.
   */
  readonly fallback: () => Element;
  /**
   * What a rejected arrival draws: `"fallback"` (default) draws `fallback` for the whole surface; `"keep-last"`
   * keeps the last accepted tree drawn, raising nothing, with `data-lf-stale` and `aria-busy` on the wrapper.
   */
  readonly invalid?: "fallback" | "keep-last";
  /**
   * Keeps focus in the surface when an update removes the focused element (default `true`): the wrapper takes
   * `tabindex="-1"` as the last resort.
   */
  readonly focusContinuity?: boolean;
  /** Host-only classes added to the wrapper and the portal container. */
  readonly wrapperClass?: string;
  readonly portalClass?: string;
};

export type DomSurface = {
  /** Validates an arrival through the core and draws the result before returning. */
  update(tree: unknown): Result<SurfaceSnapshot>;
  /** Changes options; a new theme, design system or transparency runs the switching sequence (spec §6.4). */
  set(partial: Partial<Omit<MountOptions, "validator">>): void;
  /** Detaches the core, disposes every drawn node and removes the wrapper and the portal container. */
  dispose(): void;
};

/** One drawn node: the context it was drawn from, its element, and the implementation that drew it. */
type Drawn = {
  readonly context: NodeContext;
  readonly element: Element;
  /** Undefined for a node drawn as the fallback. */
  readonly implementation: DomImplementation | undefined;
};

const hyphenated = (name: string) =>
  name.startsWith("--") ? name : name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
const styles = new WeakMap<NodeContext, Readonly<Record<string, string>>>();

/** The context's style declarations keyed by CSS property name, built once per context. */
function cssStyle(context: NodeContext): Readonly<Record<string, string>> {
  let style = styles.get(context);
  if (!style) {
    style = Object.freeze(
      Object.fromEntries(Object.entries(context.style).map(([name, value]) => [hyphenated(name), value])),
    );
    styles.set(context, style);
  }
  return style;
}

let mounted = 0;

/**
 * Binds DOM implementations to one catalog (`{ catalog, implementations }`) or to several (`{ catalogs }`), each
 * checked as `createRenderer` checks them. A mounted surface uses the catalog its `validator` was compiled with.
 */
export function createDomRenderer(
  options: CatalogBinding<DomImplementation> | { readonly catalogs: readonly CatalogBinding<DomImplementation>[] },
) {
  const registries = checkRegistries(options, (implementation) => implementation[domBinding].definition);
  // Used only to scope the surface before any tree has been accepted.
  const emptyTree: UiTree = {
    format: "liveframe/1",
    catalogId: registries.catalogIds[0] as string,
    surfaceId: "fallback",
    revision: 0,
    root: { id: "root", kind: "fallback", props: {} },
  };

  function mount(container: Element, initial: MountOptions): DomSurface {
    let options = initial;
    const { validator } = options;
    const document = container.ownerDocument;
    const found = registries.forValidator(validator);
    const domIdPrefix = `lf-dom${++mounted}`;
    const core: SurfaceCore = found
      ? createSurfaceCore({
          catalog: found.catalog,
          validator,
          domIdPrefix,
          get limits() {
            return options.limits;
          },
          get onIntent() {
            return options.onIntent;
          },
          get confirm() {
            return options.confirm;
          },
          get onEvent() {
            return options.onEvent;
          },
        })
      : refusedCore(refusal(validator), () => options.onEvent);
    const registry: ReadonlyMap<string, DomImplementation> = found?.registry ?? new Map();

    const wrapper = document.createElement("div");
    const portal = document.createElement("div");
    portal.setAttribute("data-lf-portal", "");
    container.append(wrapper, portal);

    let drawnTree: UiTree | undefined;
    let applied = "";
    /** Writes the scope attributes to the wrapper and the portal container, only when they changed. */
    function scope(): void {
      const attributes = surfaceAttributes({
        theme: options.theme,
        designSystem: options.designSystem,
        transparency: options.transparency ?? "auto",
        tree: drawnTree ?? emptyTree,
      });
      const continuity = options.focusContinuity !== false;
      const key = JSON.stringify([attributes, options.wrapperClass, options.portalClass, continuity]);
      if (key === applied) return;
      applied = key;
      if (continuity) wrapper.tabIndex = -1;
      else wrapper.removeAttribute("tabindex");
      for (const [element, host] of [
        [wrapper, options.wrapperClass],
        [portal, options.portalClass],
      ] as const) {
        element.className = host ? `${attributes.class} ${host}` : attributes.class;
        element.setAttribute("data-lf-theme", attributes["data-lf-theme"]);
        element.setAttribute("data-lf-ds", attributes["data-lf-ds"]);
        if (attributes["data-lf-transparency"]) element.setAttribute("data-lf-transparency", "reduced");
        else element.removeAttribute("data-lf-transparency");
      }
    }

    /** Drawn nodes by id; an unchanged context keeps its element and its whole subtree. */
    const drawn = new Map<string, Drawn>();
    const emitters = new Map<string, (event: string, value?: Json) => Promise<void> | undefined>();
    /** The element showing for an invalid surface, kept while the surface stays invalid. */
    let fallbackShown: Element | undefined;
    let shown: SurfaceSnapshot | undefined;

    function emitter(id: string) {
      let emit = emitters.get(id);
      if (!emit) {
        emit = (event, value) => drawn.get(id)?.context.emit(event, value);
        emitters.set(id, emit);
      }
      return emit;
    }

    function release(entry: Drawn): void {
      entry.implementation?.[domBinding].hooks.dispose?.(entry.element);
    }

    /** Calls `draw` with the element the same implementation drew last for this id, if any. */
    function drawWith(implementation: DomImplementation, item: DomItem, previous: Drawn | undefined): Element {
      const current = previous?.implementation === implementation ? previous.element : undefined;
      return implementation[domBinding].draw(item, current);
    }

    /** A node whose bindings failed draws the fallback, kept while it stays failed. */
    function fault(context: NodeContext, previous: Drawn | undefined): Element {
      if (!context.fault) throw new Error(`Missing implementation: ${context.kind}`);
      return previous && !previous.implementation ? previous.element : options.fallback();
    }

    /** Each context's item, built once: `render()` returns the element drawn for that context. */
    const nodes = new WeakMap<NodeContext, DomItem>();

    /** Draws `context`, reusing what an identical context drew; `reused` and `built` record the pass for disposal. */
    function build(context: NodeContext, reused: Set<NodeContext>, built: Set<string>): DomItem {
      const previous = drawn.get(context.id);
      if (previous?.context === context) {
        reused.add(context);
        return nodes.get(context) as DomItem;
      }
      built.add(context.id);
      const items = context.items.map((child) => build(child, reused, built));
      let element: Element | undefined;
      const item: DomItem = {
        id: context.id,
        kind: context.kind,
        variant: context.variant,
        props: context.props,
        domId: context.domId,
        events: context.events,
        slot: context.slot,
        style: cssStyle(context),
        emit: emitter(context.id),
        children: items.map((child) => child.render()),
        items,
        portal,
        render: () => element as Element,
      };
      let implementation = context.fault ? undefined : registry.get(context.kind);
      if (implementation)
        try {
          element = drawWith(implementation, item, previous);
        } catch {
          // A throwing implementation draws the fallback at its node only; the core rebuilds the node on the next
          // arrival, so that arrival retries it (spec §11).
          core.fail(context.node);
          implementation = undefined;
          element = previous && !previous.implementation ? previous.element : options.fallback();
        }
      else element = fault(context, previous);
      if (previous && previous.element !== element) release(previous);
      drawn.set(context.id, { context, element, implementation });
      nodes.set(context, item);
      return item;
    }

    /** Disposes what the previous root drew and the new pass neither reused nor drew again. */
    function sweep(context: NodeContext | undefined, reused: Set<NodeContext>, built: Set<string>): void {
      if (!context || reused.has(context)) return;
      if (!built.has(context.id)) {
        const entry = drawn.get(context.id);
        if (entry?.context === context) {
          drawn.delete(context.id);
          emitters.delete(context.id);
          release(entry);
        }
      }
      for (const item of context.items) sweep(item, reused, built);
    }

    function clear(): void {
      for (const entry of drawn.values()) release(entry);
      drawn.clear();
      emitters.clear();
    }

    const scopes = [wrapper, portal] as const;
    /** Plays design-system motion for one surface id; dropped while the fallback shows (spec §6.2, §11). */
    let motion: { readonly surfaceId: string; readonly motion: Motion } | undefined;
    const focusMark = createFocusMark();
    /** The root context last drawn, for disposal and motion. */
    let drawnRoot: NodeContext | undefined;
    const identity = () => `${options.designSystem.id}@${options.designSystem.version}`;

    function stopMotion(): void {
      motion?.motion.dispose(scopes);
      motion = undefined;
    }

    function draw(): void {
      const snapshot = core.snapshot();
      if (snapshot === shown) return;
      shown = snapshot;
      drawnTree = snapshot.tree;
      scope();
      // Keep-last draws the last accepted tree after a rejection; the core raises nothing while the surface is invalid.
      const stale = !snapshot.valid && options.invalid === "keep-last" && snapshot.tree !== undefined;
      if (stale) {
        wrapper.setAttribute("data-lf-stale", "");
        wrapper.setAttribute("aria-busy", "true");
      } else {
        wrapper.removeAttribute("data-lf-stale");
        wrapper.removeAttribute("aria-busy");
      }
      if (!snapshot.valid && !stale) {
        // An invalid surface draws only the fallback: no part of a tree that failed validation (law 2).
        stopMotion();
        clear();
        drawnRoot = undefined;
        fallbackShown ??= options.fallback();
        place(wrapper, [fallbackShown]);
        return;
      }
      fallbackShown = undefined;
      const surfaceId = snapshot.tree?.surfaceId ?? "";
      // A new surface starts its motion afresh, so its first tree never animates in.
      const fresh = motion?.surfaceId !== surfaceId;
      if (!motion || fresh) {
        stopMotion();
        motion = { surfaceId, motion: createMotion() };
      }
      const focus = options.focusContinuity === false ? null : focusSnapshot(scopes);
      const plan = fresh ? undefined : motion.motion.before(drawnRoot, snapshot.root, scopes, identity());
      const reused = new Set<NodeContext>();
      const built = new Set<string>();
      const root = snapshot.root ? build(snapshot.root, reused, built).render() : undefined;
      sweep(drawnRoot, reused, built);
      drawnRoot = snapshot.root;
      place(wrapper, root ? [root] : []);
      // Focus is restored before a removed element is put back to exit.
      restoreFocus(focus, wrapper);
      motion.motion.after(plan);
      motion.motion.gate(scopes, identity());
      focusMark(snapshot.valid ? snapshot.tree : undefined, snapshot.focus, (nodeId) =>
        moveFocus(nodeId, domIdPrefix, scopes, options.onEvent),
      );
    }

    let endSwitch: (() => void) | undefined;
    /** Spec §6.4: no motion plays across a switch, and transitions are suppressed while the new scope resolves. */
    function switchScope(): void {
      motion?.motion.halt();
      endSwitch?.();
      endSwitch = beginSwitch(scopes);
      scope();
    }

    const unsubscribe = core.subscribe(draw);
    const detach = core.attach();
    scope();
    let disposed = false;

    return {
      update(tree) {
        if (disposed) throw new Error("The surface is disposed");
        const result = core.accept(tree);
        draw();
        return result;
      },
      set(partial) {
        if (disposed) throw new Error("The surface is disposed");
        const before = options;
        options = { ...options, ...partial, validator };
        const same = (a: Identity, b: Identity) => a.id === b.id && a.version === b.version;
        if (
          !same(before.theme, options.theme) ||
          !same(before.designSystem, options.designSystem) ||
          (before.transparency ?? "auto") !== (options.transparency ?? "auto")
        )
          switchScope();
        else scope();
        // A changed `invalid` mode changes what a rejected arrival draws: draw the current snapshot again.
        if ((before.invalid ?? "fallback") !== (options.invalid ?? "fallback")) {
          shown = undefined;
          draw();
        }
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        endSwitch?.();
        stopMotion();
        unsubscribe();
        detach();
        clear();
        wrapper.remove();
        portal.remove();
      },
    };
  }

  return { mount };
}
