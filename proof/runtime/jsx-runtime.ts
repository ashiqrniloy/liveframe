import type { Child, WidgetElement } from "./types.ts";

const elements = new WeakSet<object>();
const primitives = new WeakMap<object, unknown>();

export function primitive(definition: { readonly kind: string }): (props: Record<string, unknown>) => WidgetElement {
  const type = Object.freeze({ kind: definition.kind });
  const component = (props: Record<string, unknown>) => jsx(type, props);
  primitives.set(component, type);
  return component;
}

export function isElement(value: unknown): value is WidgetElement {
  return typeof value === "object" && value !== null && elements.has(value);
}

function element(
  type: unknown,
  props: Record<string, unknown> | null,
  key: unknown,
  staticChildren: boolean,
): WidgetElement {
  const { key: propKey, ...rest } = props ?? {};
  if (Array.isArray(rest.children)) Object.freeze(rest.children);
  const result = Object.freeze({
    type: typeof type === "function" ? (primitives.get(type) ?? type) : type,
    props: Object.freeze(rest),
    key: key ?? propKey,
    staticChildren,
  });
  elements.add(result);
  return result;
}

export function jsx(type: unknown, props: Record<string, unknown> | null, key?: unknown): WidgetElement {
  return element(type, props, key, false);
}

export function jsxs(type: unknown, props: Record<string, unknown> | null, key?: unknown): WidgetElement {
  return element(type, props, key, true);
}

export function Fragment(props: { readonly children?: Child }): WidgetElement {
  return jsx(Fragment, props);
}

export namespace JSX {
  export type Element = WidgetElement;
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  export interface IntrinsicAttributes {
    readonly key?: string | number;
  }
  export type IntrinsicElements = Record<never, never>;
}
