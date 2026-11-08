import type { LiveframeError } from "../errors.ts";
import type { Capabilities } from "../formats/capabilities.ts";
import type { Catalog } from "../formats/catalog.ts";
import type { ActionStatus, Json, UiTree } from "../formats/tree.ts";
import type { TreePatch } from "../formats/tree-patch.ts";
import type { Runner } from "../preview/runner.ts";
import type { Store, verifiedPackages } from "../store/index.ts";
import type { TemplateLimits } from "../template/render.ts";
import type { CompiledValidator } from "../validate/compile.ts";

/** The installed documents a host renders against, keyed by `catalogId` (spec §7.7). */
export type Installs = Readonly<Record<string, { readonly catalog: Catalog; readonly capabilities: Capabilities }>>;

/** One source read a manifest asks for, bound to this render's inputs. */
export type SourceCall = { readonly alias: string; readonly source: string; readonly params: Json };

/** What the host's resolver reports for one call. A failure becomes the widget's `sourceOutcome` envelope. */
export type SourceResult =
  | { readonly ok: true; readonly value: Json }
  | {
      readonly ok: false;
      readonly reason: "unauthorized" | "unavailable" | "stale" | "failed";
      readonly message?: string;
    };

/**
 * What a host injects once and spreads into every call. The library keeps none of it: no call reads
 * anything but its arguments and these effects.
 */
export type HostWiring<V> = {
  readonly store: Store;
  readonly runner: Runner;
  readonly installs: Installs;
  /** Resolve as the viewer. A rejection, or a missing alias, counts as `failed`. */
  readonly resolve: (calls: readonly SourceCall[], viewer: V) => Promise<Readonly<Record<string, SourceResult>>>;
  readonly verified?: ReturnType<typeof verifiedPackages>;
  readonly runOptions?: { readonly timeoutMs?: number; readonly limits?: TemplateLimits };
  /** Receives a frozen event per decision; ids, kinds, reasons and errors, never values. A throw is contained. */
  readonly onEvent?: (event: HostEvent) => unknown;
};

/**
 * The last tree the host accepted for one surface. The host stores it, hands it back as `previous`
 * and `served`, and may keep its data fields wherever it likes; `validator` is process-local.
 */
export type Served = {
  readonly placementId: string;
  readonly scope: string;
  readonly tree: UiTree;
  /** `renderKey` of the inputs the tree was rendered from. */
  readonly key: string;
  /** Equals `tree.revision`. */
  readonly revision: number;
  /** Compiled for exactly this package and catalog; `checkOffered` trusts it. */
  readonly validator: CompiledValidator;
  readonly package: { readonly id: string; readonly version: string; readonly hash: string };
  /** The state the tree was rendered from. */
  readonly state: Json;
  /** What `dependents` reads: the manifest's source bindings, resolved for this render. */
  readonly bound: Readonly<Record<string, { readonly source: string; readonly params: Json }>>;
  /** `previous` → `tree`, when computable. The transport decides whether the client can take it. */
  readonly patch?: TreePatch;
  /** The stored state failed its schema and the initial state was used. */
  readonly reset?: readonly LiveframeError[];
};

/** Statuses of the host's actions by result key (spec §8). */
export type Actions = Readonly<Record<string, ActionStatus>>;

/**
 * What `renderPlacement` and `handleIntent` report. Events hold ids, kinds, reasons and `LiveframeError`s, never
 * state, params, source data, intent arguments or action values. The set may grow in a minor release, so a
 * handler ignores a `type` it does not know.
 */
export type HostEvent = Readonly<
  | { type: "render-skipped"; placementId: string; revision: number }
  | { type: "state-reset"; placementId: string; errors: readonly LiveframeError[] }
  | {
      type: "source-failed";
      placementId: string;
      alias: string;
      source: string;
      reason: "unauthorized" | "unavailable" | "stale" | "failed" | "invalid-result";
    }
  | { type: "tree-rejected"; placementId: string; errors: readonly LiveframeError[] }
  | { type: "load-failed"; placementId: string; errors: readonly LiveframeError[] }
  | { type: "render-failed"; placementId: string; errors: readonly LiveframeError[] }
  | {
      type: "intent-refused";
      placementId: string;
      reason: "stale" | "not-offered" | "unauthorized" | "invalid-state" | "limit";
      errors?: readonly LiveframeError[];
    }
  | { type: "action-failed"; placementId: string; action: string; error?: string }
  | { type: "publish-failed"; placementId: string; error?: string }
>;
