import type { ComponentType, CSSProperties, ReactNode } from "react";
import type { Definition } from "../index.ts";
import type { Emit, Events, Props } from "../surface/implementation.ts";

export type Item = ImplementationProps & {
  readonly id: string;
  readonly kind: string;
  readonly variant: string | undefined;
  render(): ReactNode;
};

export type ImplementationProps<D extends Definition = Definition, P = Props<D>> = {
  /** Reference props (`refProps`) already hold the target's `domId`, not its key-path id. */
  readonly props: P;
  /**
   * A DOM id for this node's element: stable across re-renders and unique per `<Surface>` instance.
   * Put it on the element the implementation renders, so another node's reference can name it.
   */
  readonly domId: string;
  slot(name: D["slots"][number]): string;
  readonly style: CSSProperties;
  readonly emit: Emit<D>;
  readonly events: Events<D>;
  readonly children: ReactNode;
  readonly items: readonly Item[];
  readonly portal: HTMLElement | undefined;
};

// The symbol keeps bindings opaque to hosts while the renderer can read them.
export const binding = Symbol("liveframe.implementation");
export type Implementation = {
  readonly [binding]: {
    readonly definition: Definition;
    readonly Component: ComponentType<ImplementationProps>;
  };
};

export function implement<D extends Definition, P = Props<D>>(
  definition: D,
  Component: ComponentType<ImplementationProps<NoInfer<D>, NoInfer<P>>>,
): Implementation {
  // Arrival validation establishes these types before an implementation is called.
  return { [binding]: { definition, Component: Component as unknown as ComponentType<ImplementationProps> } };
}
