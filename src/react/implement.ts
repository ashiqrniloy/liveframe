import type { ComponentType, CSSProperties, ReactNode } from "react";
import type { Definition, Infer, Json, LanguageSchema } from "../index.ts";

type Props<D extends Definition> = string extends keyof D["props"]["properties"]
  ? Record<string, Json>
  : Infer<D["props"]>;

/**
 * Raising an event returns a promise that settles when the host's does, when `onIntent` returns one,
 * so a primitive can mark itself busy until the host finishes; otherwise it returns `undefined`, as
 * in 0.2.1. The host's value is dropped, and a rejection is contained, never thrown at the window.
 */
type Emit<D extends Definition> = string extends keyof D["events"]
  ? (event: string, value?: Json) => Promise<void> | undefined
  : (
      ...args: {
        [E in keyof D["events"] & string]: D["events"][E]["carries"] extends "string"
          ? [event: E, value: string]
          : D["events"][E]["carries"] extends "boolean"
            ? [event: E, value: boolean]
            : D["events"][E]["carries"] extends "number" | "integer"
              ? [event: E, value: number]
              : D["events"][E]["carries"] extends { readonly object: infer S extends LanguageSchema }
                ? [event: E, value: Infer<S>]
                : [event: E];
      }[keyof D["events"] & string]
    ) => Promise<void> | undefined;

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
  readonly events: {
    readonly [E in keyof D["events"]]?: Readonly<{
      type: "action" | "setState";
      confirm: boolean;
      irreversible: boolean;
    }>;
  };
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
