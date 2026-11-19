import {
  Component,
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { surfaceAttributes } from "../css/index.ts";
import type { LiveframeError } from "../errors.ts";
import type { CompiledValidator, Intent, IntentOrigin, UiTree, ValidateTreeOptions } from "../index.ts";
import {
  createFocusMark,
  type FocusScope,
  type FocusSnapshot,
  focusSnapshot,
  moveFocus,
  restoreFocus,
} from "../dom/focus.ts";
import { createMotion, type MotionPlan } from "../dom/motion.ts";
import { beginSwitch } from "../dom/switching.ts";
import { createStagedCore } from "../surface/core.ts";
import type { NodeContext, SurfaceCore, SurfaceEvent, SurfaceSnapshot } from "../surface/index.ts";
import { type CatalogBinding, checkRegistries, RendererError, refusal, refusedCore } from "../surface/registry.ts";
import { binding, type Implementation, type Item } from "./implement.ts";

type HostProps = { readonly className?: string; readonly style?: CSSProperties };

function mergeHostProps({ class: className, ...scope }: ReturnType<typeof surfaceAttributes>, host?: HostProps) {
  return { ...scope, className: host?.className ? `${className} ${host.className}` : className, style: host?.style };
}

type SurfaceProps = {
  readonly tree: unknown;
  readonly validator: CompiledValidator;
  readonly theme: { readonly id: string; readonly version: string };
  readonly designSystem: { readonly id: string; readonly version: string };
  // `unknown` keeps 0.2.1's tolerance for any return — an arrow that pushes and returns a number, a
  // `() => void`, or a promise the renderer can hand back through `emit`.
  readonly onIntent: (intent: Intent, origin: IntentOrigin) => unknown;
  readonly fallback: ReactNode;
  readonly diagnostics?: readonly LiveframeError[];
  readonly wrapperProps?: HostProps;
  readonly portalProps?: HostProps;
  readonly transparency?: "auto" | "reduced";
  readonly focusContinuity?: boolean;
  /**
   * What a rejected arrival draws: `"fallback"` (default) draws `fallback` for the whole surface; `"keep-last"`
   * keeps the last accepted tree mounted, raising nothing, with `data-lf-stale` and `aria-busy` on the wrapper.
   */
  readonly invalid?: "fallback" | "keep-last";
  readonly confirm?: (intent: Intent, meta: Readonly<{ confirm: boolean; irreversible: boolean }>) => Promise<boolean>;
  /** Frozen observability events from the surface core (rejected arrivals and emits, failed nodes and bindings). */
  readonly onEvent?: (event: SurfaceEvent) => unknown;
  /** Validation bounds forwarded to `validator.validateTree` on each arrival (defaults: 5,000 nodes, 64 depth, 1 MiB). */
  readonly limits?: ValidateTreeOptions["limits"];
};

/**
 * What the surface currently shows for a failed node, and which nodes the host flagged. Cached node
 * elements read them through these contexts instead of capturing the props, so a host that writes
 * `fallback={<p>…</p>}` inline, or rebuilds `diagnostics` per render, does not reset node reuse.
 * React updates a context consumer even beneath a memoised parent.
 */
const FallbackContext = createContext<ReactNode>(null);
const DiagnosedContext = createContext<ReadonlySet<string>>(new Set());

/** Rendered only by a failed node, so only failed nodes subscribe to the fallback. */
function NodeFallback() {
  return <>{useContext(FallbackContext)}</>;
}

/** Marks a node the host flagged; the primitive inside is untouched when the flagged set changes. */
function Diagnosed({ id, children }: { id: string; children: ReactNode }) {
  const flagged = useContext(DiagnosedContext).has(id);
  return (
    <div style={{ display: "contents" }} data-lf-node={id} data-lf-error={flagged ? "" : undefined}>
      {children}
    </div>
  );
}

class Boundary extends Component<{
  context: NodeContext;
  children: ReactNode;
  core: SurfaceCore;
}> {
  state = { context: this.props.context, failed: false };

  // A rebuilt context (new tree node, or a bound value that changed) gets a fresh attempt.
  static getDerivedStateFromProps(props: { context: NodeContext }, state: { context: NodeContext }) {
    return props.context === state.context ? null : { context: props.context, failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.core.fail(this.props.context.node);
  }

  render() {
    return this.state.failed ? <NodeFallback /> : this.props.children;
  }
}

function Node({ item, implementation }: { item: Item; implementation: Implementation }) {
  const { Component } = implementation[binding];
  return <Component {...item} />;
}

/**
 * Keeps focus in the surface when a tree update removes the focused element. The snapshot is taken
 * in `getSnapshotBeforeUpdate`, the last moment the pre-update DOM is readable: one query over the
 * wrapper and the portal container, with no style or layout read, so its cost does not depend on
 * the host page. Focus is restored after the commit. Rendered only under `focusContinuity`, so an
 * opted-out surface does no work at all.
 */
class FocusContinuity extends Component<{
  readonly scope: () => FocusScope;
  readonly wrapper: () => HTMLElement | null;
  readonly children: ReactNode;
}> {
  getSnapshotBeforeUpdate(): FocusSnapshot | null {
    return focusSnapshot(this.props.scope());
  }

  componentDidUpdate(_prevProps: unknown, _prevState: unknown, snapshot: FocusSnapshot | null) {
    restoreFocus(snapshot, this.props.wrapper());
  }

  render() {
    return this.props.children;
  }
}

/**
 * Design-system motion (spec §6.2, §11). The pre-commit reads run in `getSnapshotBeforeUpdate`, the last
 * moment the old DOM is readable, and the rest after the commit. It sits outside `FocusContinuity`, whose
 * `componentDidUpdate` runs first, so focus is restored before a removed element is put back to exit.
 * Keyed with the tree's `surfaceId`: a new surface unmounts it (unmarking the surface) and mounts a fresh
 * one, so the first tree of the new surface never animates in. A commit that precedes a theme or design-system
 * switch plays no motion: the switching sequence suppresses transitions only once this commit is done.
 */
class Motion extends Component<{
  readonly root: NodeContext | undefined;
  readonly identity: string;
  readonly switching: boolean;
  readonly scope: () => readonly (Element | null)[];
  readonly children: ReactNode;
}> {
  motion = createMotion();

  componentDidMount() {
    this.motion.gate(this.props.scope(), this.props.identity);
  }

  getSnapshotBeforeUpdate(previous: Motion["props"]): MotionPlan | null {
    if (this.props.switching) return null;
    return this.motion.before(previous.root, this.props.root, this.props.scope(), previous.identity) ?? null;
  }

  componentDidUpdate(_previous: unknown, _state: unknown, plan: MotionPlan | null) {
    if (this.props.switching) this.motion.halt();
    this.motion.after(plan ?? undefined);
    // A portal container that mounted after the first tree (hydration) is marked once it is styled.
    this.motion.gate(this.props.scope(), this.props.identity);
  }

  componentWillUnmount() {
    this.motion.dispose(this.props.scope());
  }

  render() {
    return this.props.children;
  }
}

/**
 * The focus mark moves focus once, after the commit that draws a later accepted revision of the same surface with
 * a changed mark; the first tree a surface draws never moves it (spec §11). Child commit work, focus continuity
 * included, has run by the time this layout effect does. `drawn` is false until the surface draws its tree.
 */
function useFocusMark(
  drawn: boolean,
  snapshot: SurfaceSnapshot,
  domIdPrefix: string,
  scope: () => readonly (Element | null)[],
  onEvent: () => ((event: SurfaceEvent) => unknown) | undefined,
): void {
  const [mark] = useState(createFocusMark);
  const tree = drawn && snapshot.valid ? snapshot.tree : undefined;
  const focus = tree ? snapshot.focus : undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `scope` and `onEvent` read refs current at commit.
  useLayoutEffect(() => {
    mark(tree, focus, (nodeId) => moveFocus(nodeId, domIdPrefix, scope(), onEvent()));
  }, [tree, focus, domIdPrefix]);
}

/** What an element needs beyond the core's contexts: the framework's own pieces. */
type Elements = {
  core: SurfaceCore;
  registry: ReadonlyMap<string, Implementation>;
  items: WeakMap<NodeContext, Item>;
  portal: HTMLDivElement | null;
  diagnosed: boolean;
};

/** The implementation's props and the cached element for one core context, built once per context. */
function item(state: Elements, context: NodeContext): Item {
  const cached = state.items.get(context);
  if (cached) return cached;
  const { core, registry, items: cache, portal, diagnosed } = state;
  const implementation = registry.get(context.kind);
  if (!implementation) throw new Error(`Missing implementation: ${context.kind}`);
  const items = context.items.map((child) => item(state, child));
  const result: Item = {
    id: context.id,
    kind: context.kind,
    variant: context.variant,
    props: context.props,
    domId: context.domId,
    events: context.events,
    slot: context.slot,
    style: context.style,
    emit: context.emit,
    children: items.map((child) => child.render()),
    items,
    portal: portal ?? undefined,
    render: () => element,
  };
  // A node whose bindings failed draws the node fallback, as an implementation that throws does.
  const body = context.fault ? (
    <NodeFallback />
  ) : diagnosed ? (
    <Diagnosed id={context.id}>
      <Node item={result} implementation={implementation} />
    </Diagnosed>
  ) : (
    <Node item={result} implementation={implementation} />
  );
  const element = (
    <Boundary key={context.id} context={context} core={core}>
      {body}
    </Boundary>
  );
  cache.set(context, result);
  return result;
}

export { RendererError };

const subscribeNever = () => () => {};
const notHydrating = () => false;
const isHydrating = () => true;

const NO_REGISTRY: ReadonlyMap<string, Implementation> = new Map();

/**
 * Binds implementations to one catalog (`{ catalog, implementations }`) or to several (`{ catalogs }`), each
 * checked on its own. A `Surface` uses the catalog its `validator` was compiled with; a tree that names another
 * catalog is refused with `catalog-mismatch` (spec §11).
 */
export function createRenderer(
  options: CatalogBinding<Implementation> | { readonly catalogs: readonly CatalogBinding<Implementation>[] },
) {
  const registries = checkRegistries(options, (implementation) => implementation[binding].definition);

  // Used only to scope the fallback before any tree has been accepted.
  const emptyTree: UiTree = {
    format: "liveframe/1",
    catalogId: registries.catalogIds[0] as string,
    surfaceId: "fallback",
    revision: 0,
    root: { id: "root", kind: "fallback", props: {} },
  };

  // biome-ignore lint/correctness/noComponentHookFactories: The startup factory creates Surface once; renders reuse it.
  function Surface({
    tree,
    validator,
    theme,
    designSystem,
    onIntent,
    fallback,
    diagnostics,
    confirm,
    onEvent,
    limits,
    wrapperProps,
    portalProps,
    transparency,
    focusContinuity = true,
    invalid = "fallback",
  }: SurfaceProps) {
    const domIdPrefix = `lf-${encodeURIComponent(useId())}`;
    // The core reads the host's callbacks when it uses them, so a new `onIntent` needs no new core.
    const host = useRef({ onIntent, confirm, onEvent, limits });
    useLayoutEffect(() => {
      host.current = { onIntent, confirm, onEvent, limits };
    }, [onIntent, confirm, onEvent, limits]);
    const make = (compiled: CompiledValidator) => {
      const found = registries.forValidator(compiled);
      const current = () => host.current.onEvent;
      const core = found
        ? createStagedCore({
            catalog: found.catalog,
            validator: compiled,
            domIdPrefix,
            get limits() {
              return host.current.limits;
            },
            get onIntent() {
              return host.current.onIntent;
            },
            get confirm() {
              return host.current.confirm;
            },
            get onEvent() {
              return host.current.onEvent;
            },
          })
        : refusedCore(refusal(compiled), current);
      return { validator: compiled, core, registry: found?.registry ?? NO_REGISTRY };
    };
    // A new validator starts a new core: node reuse and local state never cross validators.
    const [held, setHeld] = useState(() => make(validator));
    let current = held;
    if (held.validator !== validator) {
      current = make(validator);
      setHeld(current);
    }
    const { core, registry } = current;
    useLayoutEffect(() => core.attach(), [core]);
    // `prepare` reads `limits` synchronously while rendering, before `useLayoutEffect` runs.
    host.current.limits = limits;
    // Rendering prepares the arrival and the commit applies it, so a render React discards (an interrupted
    // transition) never moves the core, and `emit` reports the tree on screen. The commit runs before any layout
    // effect, so an implementation's effects already see it.
    const prepared = core.prepare(tree);
    const snapshot = prepared.snapshot;
    // Hydration draws what the server drew, portal undefined; a client mount commits the wrapper and
    // portal first, and the portal's ref redraws with the tree in the same task, before paint.
    const hydrating = useSyncExternalStore(subscribeNever, notHydrating, isHydrating);
    // The server never commits, so it applies the arrival as it draws; hydration is the first draw, with nothing
    // committed for it to overtake.
    if (hydrating) core.commit(prepared);
    useInsertionEffect(() => void core.commit(prepared), [core, prepared]);
    // A local write changes the committed snapshot; subscribing in the layout phase misses none.
    const [, redraw] = useReducer((count: number) => count + 1, 0);
    useLayoutEffect(() => core.subscribe(redraw), [core]);
    const [portal, setPortal] = useState<HTMLDivElement | null>(null);
    const drawTree = hydrating || portal !== null;
    const wrapper = useRef<HTMLDivElement>(null);
    const requestedScope = useMemo(
      () => ({
        theme: { id: theme.id, version: theme.version },
        designSystem: { id: designSystem.id, version: designSystem.version },
        transparency: transparency === "reduced" ? ("reduced" as const) : ("auto" as const),
      }),
      [theme.id, theme.version, designSystem.id, designSystem.version, transparency],
    );
    const [appliedScope, setAppliedScope] = useState(requestedScope);
    const previousScope = useRef(requestedScope);
    useLayoutEffect(() => {
      if (previousScope.current === requestedScope) return;
      previousScope.current = requestedScope;
      // Suppress transitions before React commits the new scope attributes.
      const end = beginSwitch([wrapper.current, portal]);
      setAppliedScope(requestedScope);
      return end;
    }, [requestedScope, portal]);
    const diagnosed = diagnostics !== undefined;
    // The set is keyed on its content, so a new array naming the same nodes keeps the context value.
    const flaggedKey = JSON.stringify(diagnostics?.map((error) => error.nodeId).sort() ?? []);
    // biome-ignore lint/correctness/useExhaustiveDependencies: The key stands for the array's content.
    const flagged = useMemo(() => new Set(diagnostics?.flatMap((error) => error.nodeId ?? [])), [flaggedKey]);
    // The cached elements capture these generation inputs; a change of any of them draws afresh.
    // biome-ignore lint/correctness/useExhaustiveDependencies: The inputs are keys, not read.
    const items = useMemo(() => new WeakMap<NodeContext, Item>(), [core, portal, diagnosed]);
    const root = useMemo(
      () =>
        drawTree && snapshot.root ? item({ core, registry, items, portal, diagnosed }, snapshot.root).render() : null,
      [drawTree, snapshot.root, core, registry, items, portal, diagnosed],
    );
    useFocusMark(
      drawTree,
      snapshot,
      domIdPrefix,
      () => [wrapper.current, portal],
      () => host.current.onEvent,
    );
    const scope = surfaceAttributes({ ...appliedScope, tree: snapshot.tree ?? emptyTree });
    // Keep-last draws the last accepted tree after a rejection; the core raises nothing while the surface is invalid.
    const stale = !snapshot.valid && invalid === "keep-last" && snapshot.tree !== undefined;
    return (
      <FallbackContext value={fallback}>
        <DiagnosedContext value={flagged}>
          <div
            {...mergeHostProps(scope, wrapperProps)}
            ref={wrapper}
            tabIndex={focusContinuity ? -1 : undefined}
            data-lf-stale={stale ? "" : undefined}
            aria-busy={stale ? true : undefined}
          >
            {!drawTree ? null : snapshot.valid || stale ? (
              <Motion
                key={snapshot.tree?.surfaceId}
                root={snapshot.root}
                identity={`${appliedScope.designSystem.id}@${appliedScope.designSystem.version}`}
                switching={requestedScope !== appliedScope}
                scope={() => [wrapper.current, portal]}
              >
                {focusContinuity ? (
                  <FocusContinuity scope={() => [wrapper.current, portal]} wrapper={() => wrapper.current}>
                    {root}
                  </FocusContinuity>
                ) : (
                  root
                )}
              </Motion>
            ) : (
              fallback
            )}
          </div>
          <div {...mergeHostProps(scope, portalProps)} data-lf-portal="" ref={setPortal} />
        </DiagnosedContext>
      </FallbackContext>
    );
  }

  return { Surface };
}
