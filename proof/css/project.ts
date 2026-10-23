import type { CSSProperties } from "react";
import { slotClass, styleDeclarations } from "@arnilo/liveframe/css";
import { catalog } from "./fixtures.ts";

export function slotClasses(
  kind: string,
  variant: string,
  slot: string,
  style: Readonly<Record<string, unknown>> = {},
): string {
  return [slotClass(kind, variant, slot), ...(slot === "root" ? styleDeclarations(style, catalog).classes : [])].join(
    " ",
  );
}

export function styleProps(style: Readonly<Record<string, unknown>>): CSSProperties {
  return styleDeclarations(style, catalog).style;
}

export function hasResponsiveValues(node: { readonly style?: Readonly<Record<string, unknown>> }): boolean {
  return Object.values(node.style ?? {}).some(
    (value) => typeof value === "object" && value !== null && !Array.isArray(value),
  );
}

export function hasResponsiveStyles(node: {
  readonly style?: Readonly<Record<string, unknown>>;
  readonly children?: readonly unknown[];
}): boolean {
  return (
    hasResponsiveValues(node) ||
    (node.children ?? []).some((child) => hasResponsiveStyles(child as Parameters<typeof hasResponsiveStyles>[0]))
  );
}
