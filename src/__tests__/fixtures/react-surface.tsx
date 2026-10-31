import { createElement, useState } from "react";
import { createPortal } from "react-dom";
import { type Catalog, compileValidator, type UiNode, type UiTree } from "../../index.ts";
import { createRenderer, type ImplementationProps, implement } from "../../react/index.ts";
import manifest from "./proof/agent-home.manifest.json" with { type: "json" };
import capabilities from "./proof/capabilities.json" with { type: "json" };
import rawCatalog from "./proof/catalog.json" with { type: "json" };

export const catalog = rawCatalog as Catalog;
export const validator = compileValidator({ catalog, capabilities, manifest });
export const identity = { id: "certified", version: "1.0.0" };
export const surfaceProps = {
  validator,
  theme: identity,
  designSystem: identity,
  onIntent: () => {},
  fallback: <p>Unavailable</p>,
};
export function tree(revision = 1, surfaceId = "test"): UiTree {
  return {
    format: "liveframe/1",
    catalogId: catalog.catalogId,
    surfaceId,
    revision,
    root: {
      id: "root",
      kind: "stack",
      props: {},
      children: [
        { id: "root/first", kind: "text", props: { text: `Revision ${revision}` } },
        { id: "root/second", kind: "button", variant: "primary", props: { label: "Counter" } },
      ],
    },
  };
}
export function withRoot(root: UiNode): UiTree {
  return { ...tree(), root };
}

export function renderer(observe: (kind: string, props: ImplementationProps) => void = () => {}) {
  return createRenderer({
    catalog,
    implementations: catalog.definitions.map((definition) =>
      // biome-ignore lint/correctness/noComponentHookFactories: Test bindings are created once, before mounting Surface.
      implement(definition, function Primitive(input) {
        const [count, setCount] = useState(0);
        observe(definition.kind, input);
        if (input.props.text === "throw") throw new Error("Broken primitive");
        const className = input.slot(input.props.text === "bad-slot" ? "undeclared" : "root");
        if (definition.kind === "textField")
          return (
            <input
              aria-label={String(input.props.label)}
              className={className}
              defaultValue={String(input.props.value ?? "")}
            />
          );
        if (definition.kind === "button")
          return (
            <button
              type="button"
              className={className}
              style={input.style}
              onClick={() => {
                setCount(count + 1);
                input.emit("onPress");
              }}
            >
              <span className={input.slot("label")}>
                {String(input.props.label)} {count}
              </span>
            </button>
          );
        if (definition.kind === "dialog")
          return input.portal
            ? createPortal(
                <div className={className} data-open="">
                  <div role="dialog" aria-label={String(input.props.label)} className={input.slot("content")}>
                    {input.children}
                  </div>
                </div>,
                input.portal,
              )
            : null;
        const semantics = input.props.semantics;
        return createElement(
          semantics === "form" || semantics === "figure" ? semantics : "div",
          {
            className,
            style: input.style,
            "data-portal": input.portal ? "mounted" : "absent",
            ...(semantics === "group" || semantics === "status" || semantics === "alert" ? { role: semantics } : {}),
            ...(typeof input.props.label === "string" ? { "aria-label": input.props.label } : {}),
          },
          input.props.text as string | undefined,
          definition.kind === "menu" ? input.items.map((item) => item.render()) : input.children,
        );
      }),
    ),
  });
}

export function hydrationTree(mode: string): UiTree {
  const input = tree();
  return {
    ...input,
    ...(mode === "invalid" ? { catalogId: "bad.ui@1" } : {}),
    root: {
      ...input.root,
      style: { gap: { base: "space.1", "bp.md": "space.2" } },
      children: [
        { id: "root/first", kind: "text", props: { text: mode === "throw" ? "throw" : "Hydrated" } },
        {
          id: "root/second",
          kind: "button",
          props: { label: "Commit" },
          events: {
            onPress: { type: "setState", key: "reason", value: "committed" },
          },
        },
        {
          id: "root/dialog",
          kind: "dialog",
          props: { label: "Hydration overlay", open: true },
          children: [{ id: "root/dialog/text", kind: "text", props: { text: "Overlay content" } }],
        },
      ],
    },
  };
}
