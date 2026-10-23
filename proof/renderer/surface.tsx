import { type ReactNode, useState } from "react";
import { hasResponsiveValues, slotClasses, styleProps } from "../css/project.ts";
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
  readonly portalContainer?: Element | undefined;
}

function Node({ node, surface }: { node: UiNode; surface: SurfaceProps }) {
  // The nearest ancestor is the container; a responsive node queries its parent, not itself.
  const container =
    (node.children ?? []).some(hasResponsiveValues) || (node.id === "root" && hasResponsiveValues(node))
      ? " lf_container"
      : "";
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
      portalContainer={surface.portalContainer}
      props={node.props}
      node={node}
      nodes={node.children ?? []}
      render={draw}
      emitNode={emitNode}
      layout={styleProps(node.style ?? {})}
      slot={(slot) => {
        if (!definition.slots.includes(slot)) throw new Error(`Unknown slot ${node.kind}.${slot}`);
        const classes = slotClasses(node.kind, node.variant ?? "default", slot, node.style ?? {});
        // The surface root carries the theme; the nearest ancestor of a responsive value is the query container.
        if (slot !== "root") return classes;
        return `${classes}${node.id === "root" ? " lf_surface" : ""}${container}`;
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
