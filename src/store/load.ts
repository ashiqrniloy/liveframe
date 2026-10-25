import { DEFAULT_MAX_ERRORS, LiveframeFailure, type LiveframeError, type Result } from "../errors.ts";
import type { WidgetPackage } from "../formats/package.ts";
import { type Placement, validatePlacement, validateState } from "../formats/records.ts";
import type { Json } from "../formats/tree.ts";
import { verifyPackage } from "../pack/verify.ts";
import { compileSchema } from "../validate/schema.ts";
import type { Store } from "./index.ts";

/** Verify stored data without executing code or writing a reset back to the host's store. */
export async function loadPlacement(
  store: Store,
  id: string,
  options: Parameters<typeof verifyPackage>[1],
): Promise<Result<{ package: WidgetPackage; params: Json; state: Json; reset?: readonly LiveframeError[] }>> {
  try {
    const stored = await store.getPlacement(id);
    if (stored === undefined)
      return { ok: false, errors: [{ kind: "not-found", pointer: "", message: `Placement ${id} not found` }] };
    const checked = validatePlacement(stored);
    if (!checked.ok) return checked;
    const placement = checked.value;
    if (placement.id !== id)
      return {
        ok: false,
        errors: [{ kind: "invalid-document", pointer: "/id", message: "Stored placement id does not match its key" }],
      };
    const doc = await store.getPackage(placement.widget.id, placement.widget.version);
    if (doc === undefined)
      return {
        ok: false,
        errors: [
          {
            kind: "not-found",
            pointer: "/widget",
            message: `Package ${placement.widget.id}@${placement.widget.version} not found`,
          },
        ],
      };
    const verified = verifyPackage(doc, options);
    if (!verified.ok) return verified;
    const pkg = verified.value;
    const manifest = pkg.manifest;
    if (manifest.id !== placement.widget.id || manifest.version !== placement.widget.version)
      return {
        ok: false,
        errors: [
          {
            kind: "invalid-document",
            pointer: "/widget",
            message: "Package identity does not match the placement's widget",
          },
        ],
      };
    const errors: LiveframeError[] = [];
    compileSchema(manifest.params)(placement.params, "/params", { errors, maxErrors: DEFAULT_MAX_ERRORS });
    if (errors.length) return { ok: false, errors };
    const state = await store.getState(id);
    const loaded = { package: pkg, params: placement.params, state: manifest.initialState };
    if (state === undefined) return { ok: true, value: loaded };
    const json = validateState(state);
    if (!json.ok)
      return {
        ok: true,
        value: { ...loaded, reset: json.errors.map((error) => ({ ...error, pointer: `/state${error.pointer}` })) },
      };
    compileSchema(manifest.state)(state, "/state", { errors, maxErrors: DEFAULT_MAX_ERRORS });
    return { ok: true, value: errors.length ? { ...loaded, reset: errors } : { ...loaded, state } };
  } catch (error) {
    if (error instanceof LiveframeFailure) return { ok: false, errors: error.errors };
    if (
      typeof error === "object" &&
      error !== null &&
      "kind" in error &&
      error.kind === "invalid-document" &&
      "pointer" in error &&
      typeof error.pointer === "string" &&
      "message" in error &&
      typeof error.message === "string"
    )
      return { ok: false, errors: [error as LiveframeError] };
    throw error;
  }
}
