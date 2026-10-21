import { jsx, jsxs } from "./jsx-runtime.ts";

export { Fragment, type JSX } from "./jsx-runtime.ts";

export function jsxDEV(
  type: unknown,
  props: Record<string, unknown> | null,
  key?: unknown,
  staticChildren = false,
  _source?: unknown,
  _self?: unknown,
) {
  return (staticChildren ? jsxs : jsx)(type, props, key);
}
