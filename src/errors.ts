export type LiveframeError = {
  readonly kind:
    | "invalid-document"
    | "unknown-name"
    | "incomplete-design-system"
    | "colour-outside-theme"
    | "catalog-mismatch"
    | "cyclic-extends"
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
  readonly pointer: string;
  readonly message: string;
  readonly expected?: string;
  readonly nodeId?: string;
};

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly LiveframeError[] };

/** The default error bound: enough to fix a draft in one round (spec §10). */
export const DEFAULT_MAX_ERRORS = 20;

/** Ends a bounded error list with the marker every validator uses. */
export function addBoundMarker(errors: LiveframeError[], nodeId: string): void {
  errors.push({
    kind: "limit-exceeded",
    nodeId,
    pointer: errors.at(-1)?.pointer ?? "",
    expected: "fix the errors above and validate again",
    message: "Error collection limit reached",
  });
}
