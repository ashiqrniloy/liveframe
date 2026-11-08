import { DEFAULT_MAX_ERRORS, type LiveframeError, LiveframeFailure, type Result } from "../errors.ts";
import { bindSources } from "../formats/manifest.ts";
import type { WidgetPackage } from "../formats/package.ts";
import type { Json, UiTree } from "../formats/tree.ts";
import { renderKey } from "../pack/hash.ts";
import type { RunnerOptions } from "../preview/runner.ts";
import type { LanguageSchema } from "../schema.ts";
import type { WidgetInputs } from "../sdk/types.ts";
import { loadPlacement } from "../store/load.ts";
import { type CompiledValidator, compileValidator } from "../validate/compile.ts";
import { diffTrees } from "../validate/patch.ts";
import { compileSchema } from "../validate/schema.ts";
import { notifier } from "./events.ts";
import type { Actions, HostWiring, Installs, Served, SourceCall, SourceResult } from "./types.ts";

/** What each validator was compiled for, so a stale `previous` is never reused against a new install. */
const compiledFor = new WeakMap<CompiledValidator, Installs[string]>();

const MAX_MESSAGE = 500;
const FAILURES = ["unauthorized", "unavailable", "stale", "failed"] as const;

const refuse = (kind: LiveframeError["kind"], pointer: string, message: string): LiveframeError[] => [
  { kind, pointer, message },
];

/** A resolver's answer for one call; anything that is not a well-formed `SourceResult` counts as failed. */
function sourceResult(results: unknown, alias: string): SourceResult {
  const raw =
    results !== null && typeof results === "object" && Object.hasOwn(results, alias)
      ? (results as Record<string, unknown>)[alias]
      : undefined;
  if (raw !== null && typeof raw === "object") {
    const { ok, value, reason, message } = raw as Record<string, unknown>;
    if (ok === true && value !== undefined) return { ok: true, value: value as Json };
    if (ok === false && FAILURES.includes(reason as (typeof FAILURES)[number]))
      return {
        ok: false,
        reason: reason as (typeof FAILURES)[number],
        ...(typeof message === "string" ? { message: [...message].slice(0, MAX_MESSAGE).join("") } : {}),
      };
  }
  return { ok: false, reason: "failed" };
}

export type RenderArgs<V> = HostWiring<V> & {
  readonly placementId: string;
  /** The catalog this surface is for. The manifest's own `catalogId` is checked against it, never used to select it. */
  readonly catalogId: string;
  readonly scope?: string;
  /** Opaque to the library: handed to `resolve` as given. */
  readonly viewer: V;
  readonly context: Json;
  readonly actions?: Actions;
  /** The last accepted surface for this placement and scope, as the host stored it. */
  readonly previous?: Served;
  /** A revision floor for a host that can lose `previous` while a client stays connected. */
  readonly revision?: number;
  readonly surfaceId?: string;
  /** State to render instead of the stored state, for a host that has just written it. */
  readonly state?: Json;
};

type Reason = "unauthorized" | "unavailable" | "stale" | "failed" | "invalid-result";

/** What a widget sees of a reported failure, or `undefined` when its source declares no `sourceOutcome` envelope. */
function envelope(schema: LanguageSchema, failure: { reason: string; message?: string | undefined }): Json | undefined {
  if (
    !("discriminator" in schema) ||
    schema.discriminator !== "status" ||
    !Object.hasOwn(schema.mapping, failure.reason)
  )
    return undefined;
  return { status: failure.reason, ...(failure.message === undefined ? {} : { reason: failure.message }) };
}

/** R4. One read as the viewer. A rejection's text may carry host internals, so it is never copied. */
async function readSources<V>(args: RenderArgs<V>, calls: readonly SourceCall[]): Promise<unknown> {
  if (!calls.length) return undefined;
  try {
    return await args.resolve(calls, args.viewer);
  } catch {
    return undefined;
  }
}

/** R5. Fit each result to its source's schema. A host's bad value stays loud; a failure becomes an envelope if it can. */
function fitData(
  capabilities: Installs[string]["capabilities"],
  calls: readonly SourceCall[],
  results: unknown,
  report: (alias: string, source: string, reason: Reason) => void,
): Result<Record<string, Json>> {
  const data: Record<string, Json> = {};
  for (const { alias, source } of calls) {
    const schema = capabilities.sources[source]?.result;
    if (!schema) return { ok: false, errors: refuse("unknown-name", "/data", "Undeclared source") };
    const answer = sourceResult(results, alias);
    if (!answer.ok) report(alias, source, answer.reason);
    const value = answer.ok ? answer.value : envelope(schema, answer);
    if (value === undefined) return { ok: false, errors: refuse("render-failed", `/data/${alias}`, "Source failed") };
    const errors: LiveframeError[] = [];
    if (!compileSchema(schema)(value, `/data/${alias}`, { errors, maxErrors: DEFAULT_MAX_ERRORS })) {
      if (answer.ok) report(alias, source, "invalid-result");
      return { ok: false, errors };
    }
    data[alias] = value;
  }
  return { ok: true, value: data };
}

/** R8. A runner that throws or answers with a non-`Result` is a failed render with a fixed message. */
async function runWidget<V>(
  args: RenderArgs<V>,
  pkg: WidgetPackage,
  inputs: WidgetInputs,
  options: RunnerOptions,
): Promise<Result<UiTree>> {
  let rendered: unknown;
  try {
    rendered = await args.runner.render(pkg, inputs, { ...options, ...args.runOptions });
  } catch {
    rendered = undefined;
  }
  if (rendered === null || typeof rendered !== "object" || typeof (rendered as Result<unknown>).ok !== "boolean")
    return { ok: false, errors: refuse("render-failed", "", "Runner failed") };
  return rendered as Result<UiTree>;
}

/** R9. Validate on the host (law 2), then check the two fields `checkOffered` will later trust. */
function checkTree(validator: CompiledValidator, tree: unknown, surfaceId: string, revision: number): Result<UiTree> {
  const checked = validator.validateTree(tree);
  if (!checked.ok) return checked;
  if (checked.value.surfaceId !== surfaceId)
    return { ok: false, errors: refuse("invalid-document", "/surfaceId", "Unexpected surface") };
  if (checked.value.revision !== revision)
    return { ok: false, errors: refuse("invalid-document", "/revision", "Unexpected revision") };
  return checked;
}

/** R9. The validator is reused only for the same install and package; anything else is compiled afresh. */
function validatorFor(previous: Served | undefined, pkg: WidgetPackage, install: Installs[string]): CompiledValidator {
  if (previous && previous.package.hash === pkg.hash && compiledFor.get(previous.validator) === install)
    return previous.validator;
  const validator = compileValidator({ ...install, manifest: pkg.manifest });
  compiledFor.set(validator, install);
  return validator;
}

/** R10. A patch is only meaningful between trees of one surface and catalog. */
const comparable = (previous: Served, tree: UiTree): boolean =>
  previous.tree.surfaceId === tree.surfaceId && previous.tree.catalogId === tree.catalogId;

/** R6. Nothing the tree depends on changed: same inputs, same surface, and no demand for a newer revision. */
function unchanged(
  previous: Served,
  next: { key: string; surfaceId: string; placementId: string; scope: string; floor: number | undefined },
): boolean {
  return (
    previous.key === next.key &&
    previous.tree.surfaceId === next.surfaceId &&
    previous.placementId === next.placementId &&
    previous.scope === next.scope &&
    (next.floor === undefined || next.floor <= previous.revision)
  );
}

/**
 * Load a placement, resolve its sources as the viewer, render, validate the tree on the host and diff it
 * against `previous` (spec §7.7, steps R1–R11). Stateless: every call is a function of its arguments and
 * the injected effects.
 */
export async function renderPlacement<V>(args: RenderArgs<V>): Promise<Result<Served>> {
  const { placementId, catalogId, context, previous, installs } = args;
  const notify = notifier(args.onEvent);
  const scope = args.scope ?? "";
  const failed = (type: "load-failed" | "render-failed" | "tree-rejected", errors: readonly LiveframeError[]) => {
    notify?.({ type, placementId, errors });
    return { ok: false, errors } as const;
  };

  // R1. The install.
  if (!Object.hasOwn(installs, catalogId))
    return failed("load-failed", refuse("catalog-mismatch", "/catalogId", "Unknown catalog"));
  const install = installs[catalogId] as Installs[string];

  // R2. Load and verify the stored records.
  const loaded = await loadPlacement(args.store, placementId, install, {
    scope,
    ...(args.verified ? { verified: args.verified } : {}),
    ...(args.state === undefined ? {} : { state: args.state }),
  });
  if (!loaded.ok) return failed("load-failed", loaded.errors);
  const { package: pkg, params, state, reset } = loaded.value;
  if (reset) notify?.({ type: "state-reset", placementId, errors: reset });

  try {
    // R3. Bind the manifest's sources to this render's inputs.
    const actions = args.actions ?? {};
    const bound = bindSources(pkg.manifest, install.capabilities, { params, state, context });
    if (!bound.ok) return failed("render-failed", bound.errors);

    // R4–R5. Read as the viewer, then fit.
    const calls = Object.entries(bound.value).map(([alias, { source, params }]) => ({ alias, source, params }));
    const fitted = fitData(install.capabilities, calls, await readSources(args, calls), (alias, source, reason) =>
      notify?.({ type: "source-failed", placementId, alias, source, reason }),
    );
    if (!fitted.ok) return failed("render-failed", fitted.errors);
    const data = fitted.value;

    // R6. Skip when nothing the tree depends on has changed.
    const surfaceId = args.surfaceId ?? placementId;
    const key = renderKey({ hash: pkg.hash, catalogId, params, state, data, context, actions });
    if (previous && unchanged(previous, { key, surfaceId, placementId, scope, floor: args.revision })) {
      notify?.({ type: "render-skipped", placementId, revision: previous.revision });
      return { ok: true, value: previous };
    }

    // R7. The revision: the caller's floor, else one past the last accepted tree.
    const revision = args.revision ?? (previous ? previous.revision + 1 : 1);

    // R8. Run the widget.
    const rendered = await runWidget(
      args,
      pkg,
      { params, state, context, data, actions },
      { catalog: install.catalog, capabilities: install.capabilities, surfaceId, revision },
    );
    if (!rendered.ok) return failed("render-failed", rendered.errors);

    // R9. Validate on the host. The validator is reused only for the same install and package.
    const validator = validatorFor(previous, pkg, install);
    const checked = checkTree(validator, rendered.value, surfaceId, revision);
    if (!checked.ok) return failed("tree-rejected", checked.errors);
    const tree = checked.value;

    // R10. A patch when the last tree is comparable; a failure to diff simply means "send the whole tree".
    const patch = previous && comparable(previous, tree) ? diffTrees(previous.tree, tree) : undefined;

    // R11. The host stores this as `previous` and as `served`.
    return {
      ok: true,
      value: {
        placementId,
        scope,
        tree,
        key,
        revision,
        validator,
        package: { id: pkg.manifest.id, version: pkg.manifest.version, hash: pkg.hash },
        state,
        bound: bound.value,
        ...(patch?.ok ? { patch: patch.value } : {}),
        ...(reset ? { reset } : {}),
      },
    };
  } catch (error) {
    // A malformed installed document or a non-JSON input; the host still gets a typed answer.
    if (error instanceof LiveframeFailure) return failed("render-failed", error.errors);
    if (error instanceof TypeError) return failed("render-failed", refuse("invalid-document", "", error.message));
    throw error;
  }
}
