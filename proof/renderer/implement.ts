import type { ComponentType, CSSProperties, ReactNode } from "react";
import type { Definition } from "../catalog/define.ts";
import type { Json, PrimitiveDefinition, PrimitiveProps, UiNode } from "../runtime/types.ts";

export interface ImplementationProps<P = UiNode["props"]> {
  readonly props: P;
  readonly slot: (name: string) => string;
  readonly emit: (event: string, value?: Json) => void;
  readonly children: ReactNode;
  readonly nodes: readonly UiNode[];
  readonly render: (node: UiNode) => ReactNode;
  readonly emitNode: (node: UiNode, event: string, value?: Json) => void;
  readonly node: UiNode;
  readonly layout: CSSProperties;
  readonly portalContainer?: Element | undefined;
}
export interface Implementation {
  readonly definition: Definition;
  readonly Component: ComponentType<ImplementationProps>;
}

export function implement<D extends PrimitiveDefinition>(
  definition: D,
  Component: ComponentType<ImplementationProps<PrimitiveProps<D>>>,
): Implementation {
  // Transport validation establishes the catalog-specific prop type before this binding is used.
  return { definition, Component: Component as unknown as ComponentType<ImplementationProps> };
}
