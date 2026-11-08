import { DEFAULT_MAX_ERRORS, type LiveframeError, LiveframeFailure, type Result } from "../errors.ts";
import type { WidgetPackage } from "../formats/package.ts";
import { validatePlacement, validateState } from "../formats/records.ts";
import type { Json } from "../formats/tree.ts";
import type { verifyPackage } from "../pack/verify.ts";
import { absent, evaluate } from "../template/expr.ts";
import { compileSchema } from "../validate/schema.ts";
import type { Store } from "./index.ts";
import { assertScope } from "./scope.ts";
import { type verifiedPackages, verifyStoredPackage } from "./verified.ts";

type Inputs = { params: Json; state: Json; reset?: readonly LiveframeError[]; migrated?: readonly LiveframeError[] };

/**
 * The manifest's `migrateState` applied to a stored state that no longer fits (spec §7.4): the initial state
 * overlaid with each evaluated key. Reads only `previous`; undefined when any expression fails or the
 * result still does not fit the schema, so the caller resets instead.
 */
function migrate(pkg: WidgetPackage, previous: Json): Json | undefined {
  const { migrateState, state, initialState } = pkg.manifest;
  if (!migrateState) return undefined;
  const next: Record<string, Json> = { ...(initialState as Record<string, Json>) };
  for (const [key, expr] of Object.entries(migrateState)) {
    const result = evaluate(expr, { previous });
    if (!result.ok) return undefined;
    if (result.value !== absent) next[key] = result.value;
  }
  const errors: LiveframeError[] = [];
  compileSchema(state)(next, "/state", { errors, maxErrors: 1 });
  return errors.length ? undefined : next;
}

/** Check host inputs against a verified package without reading or writing a store. */
export function verifyPlacementInputs(
  pkg: WidgetPackage,
  { params, state }: { params: unknown; state?: unknown },
): Result<Inputs> {
  const jsonParams = validateState(params);
  if (!jsonParams.ok)
    return { ok: false, errors: jsonParams.errors.map((error) => ({ ...error, pointer: `/params${error.pointer}` })) };
  const errors: LiveframeError[] = [];
  compileSchema(pkg.manifest.params)(params, "/params", { errors, maxErrors: DEFAULT_MAX_ERRORS });
  if (errors.length) return { ok: false, errors };
  const loaded = { params: jsonParams.value, state: pkg.manifest.initialState };
  if (state === undefined) return { ok: true, value: loaded };
  const json = validateState(state);
  if (!json.ok)
    return {
      ok: true,
      value: { ...loaded, reset: json.errors.map((error) => ({ ...error, pointer: `/state${error.pointer}` })) },
    };
  compileSchema(pkg.manifest.state)(state, "/state", { errors, maxErrors: DEFAULT_MAX_ERRORS });
  if (!errors.length) return { ok: true, value: { ...loaded, state: json.value } };
  const migrated = migrate(pkg, json.value);
  return {
    ok: true,
    value: migrated === undefined ? { ...loaded, reset: errors } : { ...loaded, state: migrated, migrated: errors },
  };
}

/** Verify stored data without executing code or writing a reset back to the host's store. */
export async function loadPlacement(
  store: Store,
  id: string,
  options: Parameters<typeof verifyPackage>[1],
  inputs: { scope?: string; state?: unknown; verified?: ReturnType<typeof verifiedPackages> } = {},
): Promise<Result<Inputs & { package: WidgetPackage }>> {
  try {
    const scope = inputs.scope === undefined ? "" : inputs.scope;
    assertScope(scope);
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
    const verified = verifyStoredPackage(doc, options, inputs.verified);
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
    const state = Object.hasOwn(inputs, "state") ? inputs.state : await store.getState(id, scope);
    const loaded = verifyPlacementInputs(pkg, { params: placement.params, state });
    return loaded.ok ? { ok: true, value: { package: pkg, ...loaded.value } } : loaded;
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
