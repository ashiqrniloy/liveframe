import {
  Component,
  type CSSProperties,
  createContext,
  Fragment,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { slotClass, styleDeclarations, surfaceAttributes } from "../css/index.ts";
import { type LiveframeError, LiveframeFailure } from "../errors.ts";
import { carriesValue } from "../formats/events.ts";
import { isThenable } from "../internal.ts";
import {
  type CompiledValidator,
  type Intent,
  type IntentOrigin,
  type UiNode,
  type UiTree,
  validateCatalog,
} from "../index.ts";
import { complete } from "../validate/complete.ts";
import { actionFacts } from "../validate/compile.ts";
import { compileSchema } from "../validate/schema.ts";
import { binding, type Implementation, type Item } from "./implement.ts";
import { sameJson } from "../formats/json.ts";
import { shareNodes } from "./share.ts";

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
  node: UiNode;
  children: ReactNode;
  failed: WeakSet<UiNode>;
}> {
  state = { node: this.props.node, failed: false };

  static getDerivedStateFromProps(props: { node: UiNode }, state: { node: UiNode }) {
    return props.node === state.node ? null : { node: props.node, failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.failed.add(this.props.node);
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
 * the commit. Rendered only under `focusContinuity`, so the default surface does no work at all.
 */
class FocusContinuity extends Component<{
  readonly scope: () => readonly (Element | null)[];
  readonly wrapper: () => HTMLElement | null;
  readonly children: ReactNode;
}> {
  getSnapshotBeforeUpdate(): FocusSnapshot | undefined {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement)) return undefined;
    if (!this.props.scope().some((element) => element?.contains(focused))) return undefined;
    const order = tabbables().filter((element) => element !== focused);
    return {
      focused,
      after: order.filter((element) => focused.compareDocumentPosition(element) & FOLLOWING),
      before: order.filter((element) => focused.compareDocumentPosition(element) & PRECEDING),
    };
  }

  componentDidUpdate(_prevProps: unknown, _prevState: unknown, snapshot: FocusSnapshot | undefined) {
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
  const eventChecks = new Map(
    definitions.map((definition) => [
      definition.kind,
      new Map(
        Object.entries(definition.events).map(([event, { carries }]) => [
          event,
          typeof carries === "object" ? compileSchema(carries.object) : undefined,
        ]),
      ),
    ]),
  );
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
    wrapperProps,
    portalProps,
    transparency,
    focusContinuity,
  }: SurfaceProps) {
    const mounted = useRef(false);
    const [failed] = useState(() => new WeakSet<UiNode>());
    const confirming = useRef(false);
    useLayoutEffect(() => {
      mounted.current = true;
      return () => {
        mounted.current = false;
      };
    }, []);
    const arrival = useMemo(() => validator.validateTree(tree), [tree, validator]);
    const [accepted, setAccepted] = useState({ arrival, validator, tree: arrival.ok ? arrival.value : undefined });
    if (arrival !== accepted.arrival || validator !== accepted.validator) {
      const previous = validator === accepted.validator ? accepted.tree : undefined;
      const next = arrival.ok ? arrival.value : undefined;
      setAccepted({
        arrival,
        validator,
        tree:
          next && !(previous && previous.surfaceId === next.surfaceId && previous.revision > next.revision)
            ? shareNodes(previous, next, failed)
            : previous,
      });
    }
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
    const current = useRef({ tree: accepted.tree, onIntent, confirm });
    useLayoutEffect(() => {
      current.current = { tree: arrival.ok ? accepted.tree : undefined, onIntent, confirm };
    }, [accepted.tree, arrival.ok, onIntent, confirm]);
    const diagnosed = diagnostics !== undefined;
    // The set is keyed on its content, so a new array naming the same nodes keeps the context value.
    const flaggedKey = JSON.stringify(diagnostics?.map((error) => error.nodeId).sort() ?? []);
    // biome-ignore lint/correctness/useExhaustiveDependencies: The key stands for the array's content.
    const flagged = useMemo(() => new Set(diagnostics?.flatMap((error) => error.nodeId ?? [])), [flaggedKey]);
    // biome-ignore lint/correctness/useExhaustiveDependencies: Cached contexts capture these generation inputs.
    const contexts = useMemo(() => new WeakMap<UiNode, Item>(), [accepted.validator, portal, diagnosed]);
    const root = useMemo(() => {
      const tree = accepted.tree;
      if (!tree) return null;
      const actions = actionFacts(accepted.validator);
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
      function raiseIntent(
        intent: Intent,
        origin: IntentOrigin,
        meta: { confirm: boolean; irreversible: boolean } | undefined,
      ): Promise<void> | undefined {
        const { onIntent, confirm } = current.current;
        if (!confirm || !meta?.confirm) return settled(onIntent(intent, origin));
        if (confirming.current) return undefined;
        confirming.current = true;
        const confirmationMeta = Object.freeze({ confirm: meta.confirm, irreversible: meta.irreversible });
        return (async () => {
          let approved = false;
          try {
            approved = await confirm(intent, confirmationMeta);
          } catch {
            // A failed confirmation is a cancellation.
          } finally {
            confirming.current = false;
          }
          if (!approved || !mounted.current) return;
          try {
            await onIntent(intent, origin);
          } catch {
            // The host's failure is not the primitive's: `emit`'s promise never rejects.
          }
        })();
      }
      function context(node: UiNode): Item {
        const cached = contexts.get(node);
        if (cached) return cached;
        const implementation = registry.get(node.kind);
        if (!implementation) throw new Error(`Missing implementation: ${node.kind}`);
        const { definition } = implementation[binding];
        const projected = styleDeclarations(node.style ?? {}, validatedCatalog);
        const items = (node.children ?? []).map(context);
        const events = Object.freeze(
          Object.fromEntries(
            Object.entries(node.events ?? {}).map(([event, intent]) => {
              const action = intent.type === "action" ? actions.get(intent.name) : undefined;
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
        const item: Item = {
          id: node.id,
          kind: node.kind,
          variant: node.variant,
          props: node.props,
          events,
          slot(name) {
            if (!definition.slots.includes(name)) throw new Error(`Undeclared slot: ${node.kind}.${name}`);
            const recipe = slotClass(node.kind, node.variant ?? definition.defaultVariant, name);
            return [recipe, ...(name === "root" ? projected.classes : [])].join(" ");
          },
          style: projected.style,
          emit(event, value) {
            const acceptedTree = current.current.tree;
            if (!acceptedTree || !node.events || !Object.hasOwn(node.events, event)) return;
            const intent = node.events[event];
            if (!intent) return;
            const carries = definition.events[event]?.carries;
            const check = eventChecks.get(node.kind)?.get(event);
            if (!(check ? check(value, "", { errors: [], maxErrors: 1 }) : carriesValue(carries, value)))
              throw new Error(`Invalid event value: ${node.kind}.${event}`);
            const completed = complete(intent, value);
            const origin = Object.freeze({
              surfaceId: acceptedTree.surfaceId,
              revision: acceptedTree.revision,
              nodeId: node.id,
              event,
            });
            return raiseIntent(completed, origin, events[event]);
          },
          children: items.map((child) => child.render()),
          items,
          portal: portal ?? undefined,
          render: () => element,
        };
        const element = (
          <Boundary key={node.id} node={node} failed={failed}>
            {diagnosed ? (
              <Diagnosed id={node.id}>
                <Node item={item} implementation={implementation} />
              </Diagnosed>
            ) : (
              <Node item={item} implementation={implementation} />
            )}
          </Boundary>
        );
        contexts.set(node, item);
        return item;
      }
      return context(tree.root).render();
    }, [accepted.tree, accepted.validator, contexts, portal, diagnosed, failed]);
    const scope = surfaceAttributes({ ...appliedScope, tree: accepted.tree ?? emptyTree });
    return (
      <FallbackContext value={fallback}>
        <DiagnosedContext value={flagged}>
          <div {...mergeHostProps(scope, wrapperProps)} ref={wrapper} tabIndex={focusContinuity ? -1 : undefined}>
            {arrival.ok ? (
              <Fragment key={accepted.tree?.surfaceId}>
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
