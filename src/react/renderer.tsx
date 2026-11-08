import {
  Component,
  type CSSProperties,
  createContext,
  Fragment,
  type ReactNode,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { surfaceAttributes } from "../css/index.ts";
import { type LiveframeError, LiveframeFailure } from "../errors.ts";
import { sameJson } from "../formats/json.ts";
import { type CompiledValidator, type Intent, type IntentOrigin, type UiTree, validateCatalog } from "../index.ts";
import { createSurfaceCore, type NodeContext, type SurfaceCore, type SurfaceEvent } from "../surface/index.ts";
import { binding, type Implementation, type Item } from "./implement.ts";

/** The registry check's failures, with the diagnostics the other install-time APIs throw. */
export class RendererError extends LiveframeFailure {
  constructor(errors: readonly LiveframeError[]) {
    super(errors);
    this.name = "RendererError";
  }
}

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
  readonly confirm?: (intent: Intent, meta: Readonly<{ confirm: boolean; irreversible: boolean }>) => Promise<boolean>;
  /** Frozen observability events from the surface core (rejected arrivals and emits, failed nodes and bindings). */
  readonly onEvent?: (event: SurfaceEvent) => unknown;
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
 * Sequential focus navigation order (HTML, "tabindex processing"): the elements a Tab key reaches.
 * `tabIndex` already reads -1 for a div or an anchor without `href`, so the filter only drops what
 * is unreachable: disabled, inert, hidden or not rendered. Layout is up to date when the snapshot
 * is taken, so the rect read costs no flush of its own.
 */
const tabbableSelector =
  "a[href], area[href], button, input, select, textarea, iframe, object, embed, summary, [tabindex]";
// `Node.compareDocumentPosition` bitmasks. The local `Node` is a primitive wrapper, and the module
// may not reach the DOM interface through a global, so the two bits are named here.
const FOLLOWING = 4;
const PRECEDING = 2;

function tabbables(): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (const element of document.querySelectorAll<HTMLElement>(tabbableSelector)) {
    if (element.tabIndex < 0 || element.hasAttribute("disabled")) continue;
    if (element.getAttribute("type") === "hidden" || element.closest("[inert]")) continue;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || element.getClientRects().length === 0) continue;
    found.push(element);
  }
  return found;
}

type FocusSnapshot = {
  readonly focused: HTMLElement;
  readonly after: readonly HTMLElement[];
  readonly before: readonly HTMLElement[];
};

/**
 * Keeps focus in the surface when a tree update removes the focused element. The snapshot is taken
 * in `getSnapshotBeforeUpdate`, the last moment the pre-update DOM is readable, and restored after
 * the commit. Rendered only under `focusContinuity`, so an opted-out surface does no work at all.
 */
class FocusContinuity extends Component<{
  readonly scope: () => readonly (Element | null)[];
  readonly wrapper: () => HTMLElement | null;
  readonly children: ReactNode;
}> {
  getSnapshotBeforeUpdate(): FocusSnapshot | null {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement)) return null;
    if (!this.props.scope().some((element) => element?.contains(focused))) return null;
    const order = tabbables().filter((element) => element !== focused);
    return {
      focused,
      after: order.filter((element) => focused.compareDocumentPosition(element) & FOLLOWING),
      before: order.filter((element) => focused.compareDocumentPosition(element) & PRECEDING),
    };
  }

  componentDidUpdate(_prevProps: unknown, _prevState: unknown, snapshot: FocusSnapshot | null) {
    // A connected element keeps its focus; a host or a primitive that took focus during the commit
    // stays where it is. Only the element the browser dropped is ours to replace.
    if (!snapshot || snapshot.focused.isConnected) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) {
      const scope = this.props.scope();
      if (scope.some((element) => element?.contains(active))) return;
    }
    // Nearest in each direction: the first still-connected successor, else the closest predecessor.
    for (const candidate of [...snapshot.after, ...snapshot.before.slice().reverse()]) {
      if (!candidate.isConnected) continue;
      candidate.focus({ preventScroll: true });
      if (document.activeElement === candidate) return;
    }
    this.props.wrapper()?.focus({ preventScroll: true });
  }

  render() {
    return this.props.children;
  }
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

export function createRenderer({
  catalog,
  implementations,
}: {
  catalog: unknown;
  implementations: readonly Implementation[];
}) {
  const checked = validateCatalog(catalog);
  if (!checked.ok) throw new RendererError([...checked.errors]);
  const validatedCatalog = checked.value;
  const definitions = validatedCatalog.definitions;
  const registry = new Map<string, Implementation>();
  const errors: LiveframeError[] = [];
  function reject(pointer: string, message: string) {
    errors.push({ kind: "catalog-mismatch", pointer, message });
  }
  for (const [i, implementation] of implementations.entries()) {
    const { definition } = implementation[binding];
    const pointer = `/implementations/${i}`;
    if (registry.has(definition.kind)) reject(pointer, `Duplicate implementation: ${definition.kind}`);
    registry.set(definition.kind, implementation);
    const expected = definitions.find((entry) => entry.kind === definition.kind);
    if (!expected) reject(pointer, `Kind outside catalog: ${definition.kind}`);
    else if (!sameJson(expected, definition)) reject(pointer, `Definition differs from catalog: ${definition.kind}`);
  }
  for (const [i, definition] of definitions.entries()) {
    if (!registry.has(definition.kind))
      reject(`/catalog/definitions/${i}/kind`, `Missing implementation: ${definition.kind}`);
  }
  if (errors.length) throw new RendererError(errors);

  // Used only to scope the fallback before any tree has been accepted.
  const emptyTree: UiTree = {
    format: "liveframe/1",
    catalogId: validatedCatalog.catalogId,
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
    wrapperProps,
    portalProps,
    transparency,
    focusContinuity = true,
  }: SurfaceProps) {
    const domIdPrefix = `lf-${encodeURIComponent(useId())}`;
    // The core reads the host's callbacks when it uses them, so a new `onIntent` needs no new core.
    const host = useRef({ onIntent, confirm, onEvent });
    useLayoutEffect(() => {
      host.current = { onIntent, confirm, onEvent };
    }, [onIntent, confirm, onEvent]);
    const make = (compiled: CompiledValidator) =>
      createSurfaceCore({
        catalog: validatedCatalog,
        validator: compiled,
        domIdPrefix,
        get onIntent() {
          return host.current.onIntent;
        },
        get confirm() {
          return host.current.confirm;
        },
        get onEvent() {
          return host.current.onEvent;
        },
      });
    // A new validator starts a new core: node reuse and local state never cross validators.
    const [held, setHeld] = useState(() => ({ validator, core: make(validator) }));
    let core = held.core;
    if (held.validator !== validator) {
      core = make(validator);
      setHeld({ validator, core });
    }
    useLayoutEffect(() => core.attach(), [core]);
    core.accept(tree);
    const snapshot = useSyncExternalStore(core.subscribe, core.snapshot, core.snapshot);
    const [portal, setPortal] = useState<HTMLDivElement | null>(null);
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
      const scopes = [wrapper.current, portal];
      for (const scope of scopes) scope?.setAttribute("data-lf-switching", "");
      // Suppress transitions before React commits the new scope attributes.
      setAppliedScope(requestedScope);
      const clear = () => {
        for (const scope of scopes) scope?.removeAttribute("data-lf-switching");
      };
      const frame = requestAnimationFrame(() => {
        // Resolve the new styles while transitions are still suppressed, even before the first paint.
        for (const scope of scopes) if (scope) void scope.offsetWidth;
        clear();
      });
      return () => {
        cancelAnimationFrame(frame);
        clear();
      };
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
      () => (snapshot.root ? item({ core, registry, items, portal, diagnosed }, snapshot.root).render() : null),
      [snapshot.root, core, items, portal, diagnosed],
    );
    const scope = surfaceAttributes({ ...appliedScope, tree: snapshot.tree ?? emptyTree });
    return (
      <FallbackContext value={fallback}>
        <DiagnosedContext value={flagged}>
          <div {...mergeHostProps(scope, wrapperProps)} ref={wrapper} tabIndex={focusContinuity ? -1 : undefined}>
            {snapshot.valid ? (
              <Fragment key={snapshot.tree?.surfaceId}>
                {focusContinuity ? (
                  <FocusContinuity scope={() => [wrapper.current, portal]} wrapper={() => wrapper.current}>
                    {root}
                  </FocusContinuity>
                ) : (
                  root
                )}
              </Fragment>
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
