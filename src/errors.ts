export type LiveframeError = {
  readonly kind:
    | "invalid-document"
    | "unknown-name"
    | "incomplete-design-system"
    | "colour-outside-theme"
    | "catalog-mismatch"
    | "cyclic-extends"
    | "forbidden-import"
    | "transpile-failed"
    | "hash-mismatch"
    | "version-conflict"
    | "not-found"
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

/**
 * Startup failures the object under construction would otherwise have to hide
 * (spec §10). It carries the same bounded `LiveframeError[]` the `Result` APIs
 * return, one `pointer: message` line each.
 */
export class LiveframeFailure extends Error {
  readonly errors: readonly LiveframeError[];

  constructor(errors: readonly LiveframeError[]) {
    const shown = errors.slice(0, DEFAULT_MAX_ERRORS);
    super(shown.map((error) => `${error.pointer}: ${error.message}`).join("\n"));
    this.name = "LiveframeFailure";
    this.errors = shown;
  }
}

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
