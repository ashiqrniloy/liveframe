import { createElement, type Element as ElementType } from "./element.ts";

export function jsx(type: unknown, props: Record<string, unknown> | null, key?: unknown): ElementType {
  return createElement(type, props, key, false);
}

export function jsxs(type: unknown, props: Record<string, unknown> | null, key?: unknown): ElementType {
  return createElement(type, props, key, true);
}

/** A group with no DOM or tree node of its own: it adds no id segment (spec §7.1). */
export function Fragment(props: { readonly children?: unknown }): ElementType {
  return jsx(Fragment, props as Record<string, unknown>, undefined);
}

export namespace JSX {
  export type Element = ElementType;
  export interface ElementChildrenAttribute {
    readonly children: unknown;
  }
  export interface IntrinsicAttributes {
    readonly key?: string | number;
  }
  /** No host elements: `<div>` must fail to compile (spec §7.1). */
  export type IntrinsicElements = Record<never, never>;
}
