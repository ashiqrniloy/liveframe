export type WidgetErrorKind =
  | "host-element"
  | "unknown-component"
  | "invalid-prop"
  | "invalid-children"
  | "missing-key"
  | "duplicate-key"
  | "undeclared-event"
  | "undeclared-action"
  | "function-prop"
  | "async-render"
  | "render-failed"
  | "limit-exceeded";

export class WidgetError extends Error {
  constructor(
    readonly kind: WidgetErrorKind,
    message: string,
    readonly path = "root",
  ) {
    super(`${path}: ${message}`);
    this.name = "WidgetError";
  }
}

export function failure(error: unknown): WidgetError {
  return error instanceof WidgetError
    ? error
    : new WidgetError("render-failed", error instanceof Error ? error.message : String(error));
}
