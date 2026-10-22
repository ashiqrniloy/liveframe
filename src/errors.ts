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
