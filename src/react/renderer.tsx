import { Component, Fragment, type ReactNode, useMemo, useState } from "react";
import { slotClass, styleDeclarations, surfaceAttributes } from "../css/index.ts";
import {
  type CompiledValidator,
  type Intent,
  type LiveframeError,
  type UiNode,
  type UiTree,
  validateCatalog,
} from "../index.ts";
import { binding, type Implementation, type Item } from "./implement.ts";

export class RendererError extends Error {
  constructor(readonly errors: LiveframeError[]) {
    super(errors.map((error) => `${error.pointer}: ${error.message}`).join("\n"));
    this.name = "RendererError";
  }
}

type SurfaceProps = {
  readonly tree: unknown;
  readonly validator: CompiledValidator;
  readonly theme: { readonly id: string; readonly version: string };
  readonly designSystem: { readonly id: string; readonly version: string };
  readonly onIntent: (intent: Intent) => void;
  readonly fallback: ReactNode;
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
  function Surface({ tree, validator, theme, designSystem, fallback }: SurfaceProps) {
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
    const root = useMemo(() => {
      if (!accepted.tree) return null;
      function context(node: UiNode): Item {
        const implementation = registry.get(node.kind);
        if (!implementation) throw new Error(`Missing implementation: ${node.kind}`);
        const { definition } = implementation[binding];
        const projected = styleDeclarations(node.style ?? {}, validatedCatalog);
        const items = (node.children ?? []).map(context);
        const item: Item = {
          id: node.id,
          kind: node.kind,
          variant: node.variant,
          props: node.props,
          slot(name) {
            if (!definition.slots.includes(name)) throw new Error(`Undeclared slot: ${node.kind}.${name}`);
            const recipe = slotClass(node.kind, node.variant ?? definition.defaultVariant, name);
            return [recipe, ...(name === "root" ? projected.classes : [])].join(" ");
          },
          style: projected.style,
          // Intent completion is implemented in plan 008 Task 4.
          emit: () => {},
          children: items.map((child) => child.render()),
          items,
          portal: portal ?? undefined,
          render: () => (
            <Boundary key={node.id} node={node} fallback={fallback}>
              <Node item={item} implementation={implementation} />
            </Boundary>
          ),
        };
        return item;
      }
      return context(accepted.tree.root).render();
    }, [accepted.tree, portal, fallback]);
    const { class: className, ...scope } = surfaceAttributes({ theme, designSystem, tree: accepted.tree ?? emptyTree });
    return (
      <>
        <div {...scope} className={className}>
          {arrival.ok ? <Fragment key={accepted.tree?.surfaceId}>{root}</Fragment> : fallback}
        </div>
        <div {...scope} className={className} data-lf-portal="" ref={setPortal} />
      </>
    );
  }

  return { Surface };
}
