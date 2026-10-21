import { assertJson, freeze, isRecord, synchronous } from "./data.ts";
import { failure, WidgetError } from "./errors.ts";
import { Fragment, isElement } from "./jsx-runtime.ts";
import type { Json, RenderOptions, UiNode, UiTree, WidgetElement, WidgetProps } from "./types.ts";
import { checkSchema, limits, validate } from "./validate.ts";

export function render<P, S, D, C>(
  widget: (props: WidgetProps<P, S, D, C>) => unknown,
  inputs: WidgetProps<P, S, D, C>,
  options: RenderOptions,
): UiTree | WidgetError {
  try {
    const budget = limits(options);
    assertJson(inputs, "inputs");
    checkSchema(options.state, inputs.state, "inputs/state");
    if (options.params) checkSchema(options.params, inputs.params, "inputs/params");
    if (options.context) checkSchema(options.context, inputs.context, "inputs/context");
    const catalog = new Map(options.catalog.definitions.map((definition) => [definition.kind, definition]));
    let count = 0;
    function build(
      value: unknown,
      parent: string | null,
      requireKey: boolean,
      used: Set<string>,
      depth: number,
      expansion = 0,
    ): UiNode[] {
      synchronous(value, parent ?? "root");
      if (!isElement(value)) throw new WidgetError("invalid-children", "Expected one SDK element", parent ?? "root");
      if (depth > budget.depth || expansion > budget.depth)
        throw new WidgetError("limit-exceeded", "Element nesting exceeded the depth limit", parent ?? "root");
      let element: WidgetElement = value;
      let key = element.key;
      if (requireKey && key === undefined)
        throw new WidgetError("missing-key", "Every element in a list needs a key", parent ?? "root");
      while (typeof element.type === "function" && element.type !== Fragment) {
        for (const [name, entry] of Object.entries(element.props))
          if (name !== "children") assertJson(entry, `${parent ?? "root"}/${name}`);
        const expanded: unknown = element.type(element.props);
        synchronous(expanded, parent ?? "root");
        if (!isElement(expanded))
          throw new WidgetError("unknown-component", "A component must return one SDK element", parent ?? "root");
        element =
          expanded.props.children === element.props.children && element.staticChildren
            ? { ...expanded, staticChildren: true }
            : expanded;
        key ??= element.key;
        if (++expansion > budget.depth)
          throw new WidgetError("limit-exceeded", "Component expansion exceeded the depth limit", parent ?? "root");
      }
      if (
        key !== undefined &&
        ((typeof key !== "string" && typeof key !== "number") ||
          String(key).length === 0 ||
          String(key).length > 128 ||
          (typeof key === "number" && !Number.isFinite(key)))
      )
        throw new WidgetError(
          "invalid-prop",
          "Key must be a nonempty bounded string or finite number",
          parent ?? "root",
        );
      if (typeof element.type === "string")
        throw new WidgetError("host-element", `Host element <${element.type}> is forbidden`, parent ?? "root");
      const fragment = element.type === Fragment;
      const kind = isRecord(element.type) && typeof element.type.kind === "string" ? element.type.kind : undefined;
      const definition = kind ? catalog.get(kind) : undefined;
      if (!fragment && !definition)
        throw new WidgetError("unknown-component", "Unknown catalog component", parent ?? "root");
      const segment = key === undefined ? kind : String(key);
      if (segment !== undefined) {
        if (used.has(segment))
          throw new WidgetError(
            key === undefined ? "missing-key" : "duplicate-key",
            "Siblings need distinct keys",
            parent ?? "root",
          );
        used.add(segment);
      }
      const id = parent === null ? "root" : segment === undefined ? parent : `${parent}/${encodeURIComponent(segment)}`;
      const childNodes: UiNode[] = [];
      const childKeys = fragment && key === undefined ? used : new Set<string>();
      function children(child: unknown, list: boolean, nesting = 0): void {
        if (child === null || child === undefined || typeof child === "boolean") return;
        if (nesting > budget.depth) throw new WidgetError("limit-exceeded", "Child arrays exceed the depth limit", id);
        if (Array.isArray(child)) {
          for (const entry of child) children(entry, true, nesting + 1);
        } else
          childNodes.push(
            ...build(
              child,
              fragment && parent === null ? null : id,
              list,
              childKeys,
              fragment ? depth : depth + 1,
              fragment ? expansion + 1 : 0,
            ),
          );
      }
      const child = element.props.children;
      if (element.staticChildren && Array.isArray(child)) for (const entry of child) children(entry, false);
      else children(child, false);
      if (fragment) {
        for (const [name, entry] of Object.entries(element.props)) {
          if (name === "children") continue;
          assertJson(entry, `${id}/${name}`);
          throw new WidgetError("invalid-prop", "Fragments accept only children and a key", id);
        }
        return childNodes;
      }
      if (++count > budget.nodes) throw new WidgetError("limit-exceeded", "Node limit exceeded", id);
      const props: Record<string, Json> = Object.create(null);
      const style: Record<string, Json> = Object.create(null);
      const events: Record<string, Json> = Object.create(null);
      let variant: string | undefined;
      for (const [name, entry] of Object.entries(element.props)) {
        if (name === "children") continue;
        assertJson(entry, `${id}/${name}`);
        if (name === "variant") {
          if (typeof entry !== "string") throw new WidgetError("invalid-prop", "Expected variant string", id);
          variant = entry;
        } else if (Object.hasOwn(definition?.events ?? {}, name) || /^on[A-Z]/.test(name)) events[name] = entry as Json;
        else if (definition?.styleProps.includes(name as never)) style[name] = entry as Json;
        else props[name] = entry as Json;
      }
      return [
        {
          id,
          kind: kind as string,
          props,
          ...(variant === undefined ? {} : { variant }),
          ...(Object.keys(style).length ? { style } : {}),
          ...(Object.keys(events).length ? { events: events as NonNullable<UiNode["events"]> } : {}),
          ...(childNodes.length ? { children: childNodes } : {}),
        },
      ];
    }
    const roots = build(widget(freeze(inputs)), null, false, new Set(), 1);
    if (roots.length !== 1) throw new WidgetError("invalid-children", "Widget must return one root element");
    return validate(
      {
        format: "liveframe/1",
        catalogId: options.catalog.catalogId,
        surfaceId: options.surfaceId ?? "proof",
        revision: options.revision ?? 0,
        root: roots[0],
      },
      options,
    );
  } catch (error) {
    return failure(error);
  }
}
