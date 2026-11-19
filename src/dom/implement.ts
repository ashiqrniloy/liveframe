import type { Definition } from "../index.ts";
import type { Emit, Events, Props } from "../surface/implementation.ts";

/** What `draw` receives for one node: the core's context, with drawn children and the scoped portal. */
export type DomNode<D extends Definition = Definition, P = Props<D>> = {
  readonly id: string;
  readonly kind: string;
  readonly variant: string | undefined;
  /** Reference props (`refProps`) already hold the target's `domId`, not its key-path id. */
  readonly props: P;
  /**
   * A DOM id for this node's element: stable across revisions and unique per mounted surface. Put it on the
   * element `draw` returns, so another node's reference can name it.
   */
  readonly domId: string;
  readonly events: Events<D>;
  /** The one recipe class string for a declared slot; the root slot adds style-prop classes. */
  slot(name: D["slots"][number]): string;
  /** The root's inline style-prop declarations, keyed by CSS property name for `element.style.setProperty`. */
  readonly style: Readonly<Record<string, string>>;
  /** Stable for the node's id and always raising through its current context, so a listener added once stays right. */
  readonly emit: Emit<D>;
  /** The children's drawn elements, in order; `place(element, node.children)` puts them in. */
  readonly children: readonly Element[];
  /** The children as nodes, for a collection that wraps or arranges each one itself. */
  readonly items: readonly DomItem[];
  /** The surface's portal container, a sibling of its wrapper carrying the same scope attributes. */
  readonly portal: HTMLElement;
};

/** A child node: its fields, and `render()` for the element the adapter drew for it. */
export type DomItem = DomNode & { render(): Element };

/**
 * Draws one node. With `element` undefined, it creates the node's element; otherwise it updates that element (the
 * one it returned last time for this node id) and returns it. Returning another element replaces the old one.
 */
export type Draw<D extends Definition = Definition, P = Props<D>> = (
  node: DomNode<D, P>,
  element: Element | undefined,
) => Element;

export type DrawHooks = {
  /** Called once with the element of a node that left the drawn tree, or that `draw` replaced. */
  readonly dispose?: (element: Element) => void;
};

// The symbol keeps bindings opaque to hosts while the adapter can read them.
export const domBinding = Symbol("liveframe.dom.implementation");
export type DomImplementation = {
  readonly [domBinding]: {
    readonly definition: Definition;
    readonly draw: Draw;
    readonly hooks: DrawHooks;
  };
};

/** Binds a primitive's definition to the function that draws it, typed from the definition. */
export function implement<D extends Definition, P = Props<D>>(
  definition: D,
  draw: Draw<NoInfer<D>, NoInfer<P>>,
  hooks: DrawHooks = {},
): DomImplementation {
  // Arrival validation establishes these types before `draw` is called.
  return { [domBinding]: { definition, draw: draw as unknown as Draw, hooks } };
}
