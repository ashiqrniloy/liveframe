import { LiveframeFailure } from "../errors.ts";

/** Scope is host data, never authority; omitted or unsupported scopes must not fall back. */
export function assertScope(scope: string): void {
  if (typeof scope === "string" && [...scope].length <= 128) return;
  throw new LiveframeFailure([
    { kind: "invalid-document", pointer: "/scope", message: "Expected a scope string of at most 128 code points" },
  ]);
}
