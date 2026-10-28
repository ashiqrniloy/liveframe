import {
  Component,
  type CSSProperties,
  Fragment,
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { slotClass, styleDeclarations, surfaceAttributes } from "../css/index.ts";
import { type LiveframeError, LiveframeFailure } from "../errors.ts";
import { carriesValue } from "../formats/events.ts";
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
  readonly onIntent: (intent: Intent, origin: IntentOrigin) => void;
  readonly fallback: ReactNode;
  readonly diagnostics?: readonly LiveframeError[];
  readonly wrapperProps?: HostProps;
  readonly portalProps?: HostProps;
  readonly confirm?: (intent: Intent, meta: Readonly<{ confirm: boolean; irreversible: boolean }>) => Promise<boolean>;
};

class Boundary extends Component<{ node: UiNode; fallback: ReactNode; children: ReactNode }> {
  state = { node: this.props.node, failed: false };

  static getDerivedStateFromProps(props: { node: UiNode }, state: { node: UiNode }) {
    return props.node === state.node ? null : { node: props.node, failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Node({ item, implementation }: { item: Item; implementation: Implementation }) {
  const { Component } = implementation[binding];
  return <Component {...item} />;
}

// Compare JSON structurally: object key order is irrelevant; array order is not.
function sameDefinition(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        Object.hasOwn(right, key) &&
        sameDefinition((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
    )
  );
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
    else if (!sameDefinition(expected, definition))
      reject(pointer, `Definition differs from catalog: ${definition.kind}`);
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
  }: SurfaceProps) {
    const mounted = useRef(false);
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
            ? next
            : previous,
      });
    }
    const [portal, setPortal] = useState<HTMLDivElement | null>(null);
    const wrapper = useRef<HTMLDivElement>(null);
    const requestedScope = useMemo(
      () => ({
        theme: { id: theme.id, version: theme.version },
        designSystem: { id: designSystem.id, version: designSystem.version },
      }),
      [theme.id, theme.version, designSystem.id, designSystem.version],
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
    const root = useMemo(() => {
      const tree = accepted.tree;
      if (!tree) return null;
      const { surfaceId, revision } = tree;
      const actions = actionFacts(accepted.validator);
      function raiseIntent(
        intent: Intent,
        origin: IntentOrigin,
        meta: { confirm: boolean; irreversible: boolean } | undefined,
      ) {
        if (!confirm || !meta?.confirm) {
          onIntent(intent, origin);
          return;
        }
        if (confirming.current) return;
        confirming.current = true;
        const confirmationMeta = Object.freeze({ confirm: meta.confirm, irreversible: meta.irreversible });
        void (async () => {
          let approved = false;
          try {
            approved = await confirm(intent, confirmationMeta);
          } catch {
            // A failed confirmation is a cancellation.
          } finally {
            confirming.current = false;
          }
          if (approved && mounted.current) onIntent(intent, origin);
        })();
      }
      function context(node: UiNode): Item {
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
            if (!node.events || !Object.hasOwn(node.events, event)) return;
            const intent = node.events[event];
            if (!intent) return;
            const carries = definition.events[event]?.carries;
            const check = eventChecks.get(node.kind)?.get(event);
            if (!(check ? check(value, "", { errors: [], maxErrors: 1 }) : carriesValue(carries, value)))
              throw new Error(`Invalid event value: ${node.kind}.${event}`);
            const completed = complete(intent, value);
            const origin = Object.freeze({
              surfaceId,
              revision,
              nodeId: node.id,
              event,
            });
            raiseIntent(completed, origin, events[event]);
          },
          children: items.map((child) => child.render()),
          items,
          portal: portal ?? undefined,
          render: () => (
            <Boundary key={node.id} node={node} fallback={fallback}>
              {diagnostics ? (
                <div
                  style={{ display: "contents" }}
                  data-lf-node={node.id}
                  data-lf-error={diagnostics.some((error) => error.nodeId === node.id) ? "" : undefined}
                >
                  <Node item={item} implementation={implementation} />
                </div>
              ) : (
                <Node item={item} implementation={implementation} />
              )}
            </Boundary>
          ),
        };
        return item;
      }
      return context(tree.root).render();
    }, [accepted.tree, accepted.validator, portal, fallback, onIntent, diagnostics, confirm]);
    const scope = surfaceAttributes({ ...appliedScope, tree: accepted.tree ?? emptyTree });
    return (
      <>
        <div {...mergeHostProps(scope, wrapperProps)} ref={wrapper}>
          {arrival.ok ? <Fragment key={accepted.tree?.surfaceId}>{root}</Fragment> : fallback}
        </div>
        <div {...mergeHostProps(scope, portalProps)} data-lf-portal="" ref={setPortal} />
      </>
    );
  }

  return { Surface };
}
