import { type ReactNode, useState } from "react";
import { slotClasses, styleProps } from "../css/project.ts";
import { WidgetError } from "../runtime/errors.ts";
import type { Intent, Json, RenderOptions, UiNode, UiTree } from "../runtime/types.ts";
import { validate } from "../runtime/validate.ts";
import type { Implementation } from "./implement.ts";

export interface SurfaceProps {
  readonly tree: unknown;
  readonly options: RenderOptions;
  readonly registry: ReadonlyMap<string, Implementation>;
  readonly onIntent: (intent: Intent) => void;
  readonly fallback: ReactNode;
}

function Node({ node, surface }: { node: UiNode; surface: SurfaceProps }) {
  const implementation = surface.registry.get(node.kind);
  if (!implementation) return surface.fallback;
  const { Component, definition } = implementation;
  const draw = (child: UiNode) => <Node key={child.id} node={child} surface={surface} />;
  const emitNode = (source: UiNode, event: string, value?: Json) => {
    const intent = source.events?.[event];
    if (!intent) return;
    const carries = surface.registry.get(source.kind)?.definition.events[event]?.carries;
    if (carries === undefined || (carries !== "none" && typeof value !== carries))
      throw new Error(`Invalid event value: ${event}`);
    if (intent.type === "setState" && !Object.hasOwn(intent, "value")) {
      if (value !== undefined) surface.onIntent({ ...intent, value });
    } else surface.onIntent(intent);
  };
  return (
    <Component
      props={node.props}
      node={node}
      nodes={node.children ?? []}
      render={draw}
      emitNode={emitNode}
      layout={styleProps(node.style ?? {})}
      slot={(slot) => {
        if (!definition.slots.includes(slot)) throw new Error(`Unknown slot ${node.kind}.${slot}`);
        return slotClasses(node.kind, node.variant ?? "default", slot);
      }}
      emit={(event, value) => emitNode(node, event, value)}
    >
      {node.children?.map(draw)}
    </Component>
  );
}

export function Surface(props: SurfaceProps) {
  const checked = validate(props.tree, props.options);
  const [accepted, setAccepted] = useState<UiTree | null>(null);
  if (checked instanceof WidgetError) return props.fallback;
  let current = checked;
  if (accepted && accepted.surfaceId === checked.surfaceId && accepted.revision > checked.revision) current = accepted;
  else if (accepted !== checked) setAccepted(checked);
  return <Node key={current.surfaceId} node={current.root} surface={props} />;
}
