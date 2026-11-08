# 030 Host pipeline design: `renderPlacement`, `handleIntent`, `dependents`

Design for plan 030 Task 1. It adds spec §7.7 (the host pipeline) and amends §7.4, §8, §11 and §13. Rules are numbered so Tasks 2–4 and 5 can cite them (`R4` = `renderPlacement` step 4, `H3` = `handleIntent` step 3). Where a rule differs from the plan's task text, it is listed under "Amendments to the plan" at the end.

## The gap, from the code

`examples/demo-host/server.ts` (253 lines) is the only complete host in the repo, and every outsider copies it. It hand-rolls the security-critical order:

- load and render: `surface()` at `:108` calls `loadPlacement`, `runner.render` with `data: {}` (`:116`) and keeps its own revision counter (`:112`). It never calls `bindSources`, `renderKey` or `diffTrees`, and it never validates the runner's tree on the host (the runner does, inside the worker).
- intents: `:183-223` calls `checkOffered` (`:192`), then re-implements the `setState` schema check (`:204-208`) and the action allow-list check (`:211-216`), runs the operation inline (`:217`), and has no authorisation step, no result, and no pending state.
- state it keeps itself: a `served` map (`:93`), a `revisions` map (`:92`), a validator cache (`:36`) and a mutation queue (`:95`).

The helpers exist (`loadPlacement`, `bindSources`, `renderKey`, `diffTrees`, `checkOffered`), but nothing fixes the order they run in. An adopter who swaps two steps (dispatch before `checkOffered`, or serve a runner tree before host validation) breaks law 2 or law 4 without any test failing.

## Prior art (recorded, not copied)

- **`plans/liveframe-evaluation.md` Part II §1** proposes `createSurfaceController({ catalog, capabilities, runner, resolveSource, dispatchAction, store? })`: a long-lived object holding per-viewer `(surfaceId, scope)` revision counters, the accepted tree, canonical input hashes and (Tier A §3) dependency tracking with `invalidateSource` push. Kept: its goal (collapse the ~150 lines of order-sensitive boilerplate into injected capabilities) and its inventory of steps. Rejected: every piece of retained state (see "Why this is not the rejected controller").
- **`decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md`**, alternative 5, rejected adopting the evaluation's roadmap as written. `plans/backlog.md:533` records the consequence ("a library controller was rejected") and keeps concurrent-read de-duplication and isolation as host responsibilities. This design honours both: it ships no controller, and de-duplication and isolation stay the host's.

## Contract

```ts
type Installs = Readonly<Record<string, { catalog: Catalog; capabilities: Capabilities }>>; // key: catalogId

/** One source read the manifest asks for, bound to this render's inputs. */
type SourceCall = { alias: string; source: string; params: Json };
type SourceResult =
  | { ok: true; value: Json }
  | { ok: false; reason: "unauthorized" | "unavailable" | "stale" | "failed"; message?: string };

/** What a host injects once and spreads into every call. The library keeps none of it. */
type HostWiring<V> = {
  store: Store; runner: Runner; installs: Installs;
  /** Resolve as the viewer. Rejection, or a missing alias, counts as `failed`. */
  resolve(calls: readonly SourceCall[], viewer: V): Promise<Readonly<Record<string, SourceResult>>>;
  verified?: ReturnType<typeof verifiedPackages>;
  runOptions?: { timeoutMs?: number; limits?: Limits };
  onEvent?(event: HostEvent): unknown;
};

/** The last tree the host accepted for one surface, handed back by the host on the next call. */
type Served = {
  placementId: string; scope: string;
  tree: UiTree; key: string; revision: number;       // revision === tree.revision
  validator: CompiledValidator;                       // compiled for exactly this package and catalog
  package: { id: string; version: string; hash: string };
  state: Json;                                        // the state the tree was rendered from
  bound: Readonly<Record<string, { source: string; params: Json }>>; // what `dependents` reads
  patch?: TreePatch;                                  // previous → tree, when computable
  reset?: readonly LiveframeError[]; migrated?: readonly LiveframeError[]; // Task 8 fills `migrated`
};

renderPlacement<V>(args: HostWiring<V> & {
  placementId: string; catalogId: string; scope?: string; viewer: V;
  context: Json; actions?: Record<string, ActionStatus>;
  previous?: Served; revision?: number; surfaceId?: string; state?: Json;
}): Promise<Result<Served>>;

handleIntent<V>(args: HostWiring<V> & {
  served: Served; origin: IntentOrigin; intent: Intent; viewer: V;
  context: Json; actions?: Record<string, ActionStatus>;
  authorize(intent: Intent, viewer: V): boolean | Promise<boolean>;
  dispatch(intent: Intent, viewer: V): Promise<{ ok: true; value?: Json } | { ok: false; reason?: string }>;
  publish?(served: Served): unknown;
}): Promise<Result<{ served: Served; actions: Record<string, ActionStatus> }>>;

dependents(
  placements: readonly { placementId: string; bound: Served["bound"] }[],
  change: { source: string; params?: Json },
): string[];
```

A host builds `const host = { store, runner, installs, resolve, authorize, dispatch, verified, onEvent }` once and writes `renderPlacement({ ...host, placementId, … })`. That spread is the whole "wiring"; no factory is needed, and no object is long-lived.

## `renderPlacement` steps

**R1. Pick the install.** `installs[catalogId]`. Absent → `catalog-mismatch` at `/catalogId`. The caller names the catalog because it knows which client is asking (two surfaces of two majors on one page, plan 030 Task 7); the manifest's own `catalogId` is then *checked* against it by step R2, never trusted to select it.

**R2. Load.** `loadPlacement(store, placementId, install, { scope, verified, state? })`. `state`, when the caller supplies it, is passed as an own property (the `Object.hasOwn` contract of `loadPlacement`) so `handleIntent` can render a state it just persisted without a second read. A failure returns its errors (`not-found`, `catalog-mismatch`, `hash-mismatch`, `invalid-document`, `invalid-prop`). `reset` and `migrated` are copied into `Served` and reported as `state-reset` / `state-migrated`.

**R3. Bind.** `bindSources(manifest, capabilities, { params, state, context })` → `bound`. A failure returns its errors (`invalid-prop`, `unknown-name`); a thrown `LiveframeFailure` from a malformed installed document is caught and returned the same way.

**R4. Resolve as the viewer.** With no bound sources, no call is made. Otherwise one `resolve(calls, viewer)` per render; a rejection counts as `failed` for every call, with the fixed message `"Source failed"` (the rejection's own text is never copied: it may carry host internals). This is the only place a source is read, so law 4's "data is resolved by the app as the viewer" cannot be bypassed from inside the runner.

**R5. Fit each result.**

1. `{ ok: true, value }` is checked with `checkValue(capabilities.sources[source].result, value)`. A mismatch is `render-failed` at `/data/<alias>` and a `source-failed` event with `reason: "invalid-result"`. It is a host bug and stays loud: it is never converted into an envelope.
2. `{ ok: false, reason, message? }` becomes `{ status: reason, reason: message }` (message cut to 500 code points) when the source's `result` schema follows the `sourceOutcome` convention (a `status` union whose mapping contains `reason`); the envelope is then itself checked as in step 1. If the schema does not declare the outcome, it is `render-failed` at `/data/<alias>`. Either way a `source-failed` event is raised.
3. A missing alias counts as `{ ok: false, reason: "failed" }`.

**R6. Skip.** `key = renderKey({ hash, catalogId, params, state, data, context, actions })`. When `previous` has the same `key`, the same `tree.surfaceId` and the same `placementId`/`scope`, return `previous` unchanged (same object) and raise `render-skipped`. No revision is consumed. The runner, the validator and the diff do not run.

**R7. Revision.** `revision ?? (previous ? previous.revision + 1 : 1)`; `surfaceId ?? placementId`. The library holds no counter. A host that can lose `previous` while a client stays connected (restart, failover) passes a monotonic floor (`revision: Date.now()` or a persisted counter) so the client's revision rule (spec §11: a lower revision of the same surface is ignored) cannot swallow the first tree after the restart. A new page load needs nothing: a new `<Surface>` starts empty.

**R8. Render.** `runner.render(pkg, { params, state, context, data, actions }, { ...install, surfaceId, revision, ...runOptions })`. A failed `Result` returns its errors (`render-failed`, `limit-exceeded`, `hash-mismatch`) with a `render-failed` event. A runner that throws or returns a non-`Result` is `render-failed` at the root with a fixed message.

**R9. Validate on the host (law 2).** `validator = previous` when `previous.package.hash === pkg.hash` and the catalog is the same (the common re-render, no compile); else `compileValidator({ ...install, manifest })`. `validator.validateTree(tree)` must pass, and the host then also checks that `tree.surfaceId` and `tree.revision` equal the values it asked for, because `checkOffered` will trust them later (`invalid-document` at `/surfaceId` or `/revision`). A failure is `tree-rejected` with the errors; the tree is never returned, never `served`. The runner's own validation (inside its sandbox) is not the boundary: the sandbox is untrusted.

**R10. Diff.** When `previous` exists and has the same `surfaceId` and `catalogId`, `diffTrees(previous.tree, tree)`. Success → `patch`. Any failure (`invalid-document`: different catalog or surface, non-increasing revision, empty `children`) leaves `patch` absent and the whole tree is the answer; no event, because nothing was wrong. The patch's `base` is `previous.revision`; the **transport** sends it only when the client's last accepted revision equals `base`, else the whole tree (the client's `stale-patch` is the backstop).

**R11. Return** `Served`. The host stores it as the next `previous` and as the `served` for `handleIntent`.

## `handleIntent` steps

**H1. Install.** `installs[served.tree.catalogId]`, else `catalog-mismatch`.

**H2. Offered check (law 4, first).** `checkOffered(served.tree, origin, intent, served.validator)`. This covers: surface and revision equal to the served tree (`version-conflict` otherwise: **a superseded revision is refused, never rewritten to the latest**, spec §11), a known node and offered event, the intent reproducing the offered one (type, key or name, literals, `resultKey`), filled values fitting the event, manifest and capability schemas, and `setLocal` rejection (`invalid-prop` at `/type`, plan 029 L4). Nothing below runs before this passes. On failure:

- `version-conflict` → return the errors, event `intent-refused` with `reason: "stale"`. The client must refetch. No state is written.
- Any other failure where `origin` names a node whose offered event is an *action* in `served.tree` → the action is recorded `refused` under the **offered** key (`served.tree`'s `resultKey ?? name`, trusted tree data; never the posted intent's), with the fixed reason `"Not accepted"`, and the surface is re-rendered (step H8) so the widget can draw it. The result is `ok`, carrying `actions` with the `refused` entry. Repeats of the same bad intent change nothing, so `renderKey` skips them (R6): a crafted-intent flood costs one render, not one per request.
- Everything else (unknown node, undeclared event, `setState`, `setLocal`) → return the errors; event `intent-refused` with `reason: "not-offered"`.

**H3. By type.** The accepted `intent` is, by `checkOffered`'s exact-reproduction rule, the completed intent.

**`setState`:**

- H3a. `loadPlacement` (scope, `verified`) for the manifest and the *stored* state. The stored state, not `served.state`, is the base: another tab's committed write is not lost.
- H3b. `next = { ...state, [key]: value }`; `checkValue(manifest.state, next)`. A mismatch returns `invalid-prop` at `/value` (event `intent-refused`, `reason: "invalid-state"`); spec §8 requires this re-check even though `checkOffered` already checked the event's value.
- H3c. `store.putState(placementId, scope, next)`, then `renderPlacement` with `state: next` and `previous: served`. The write happens only after H2 and H3b.

**`action`:** `key = intent.resultKey ?? intent.name`, `name = intent.name`.

- H4. **Authorise.** `authorize(intent, viewer)`. `false`, a throw or a rejection → `refused` (fixed reason `"Not allowed"`, never the thrower's text), event `intent-refused` with `reason: "unauthorized"`, then H8. Fail closed.
- H5. **Pending.** `actions' = { ...actions, [key]: { status: "pending", action: name } }`. Only when `publish` is supplied: `renderPlacement({ actions: actions', previous: served })`, then `await publish(servedPending)`. Without a `publish` nobody could see the pending frame, so none is rendered. A failed pending render is reported (`render-failed`) but does not stop dispatch: the effect was authorised.
- H6. **Dispatch.** `await dispatch(intent, viewer)`. A throw or rejection → `failed` with the fixed reason `"The action failed"` (the host's error text and stack never reach the widget or the transport) and an `action-failed` event with the error's `name` only. `{ ok: false, reason }` → `failed` with `reason` cut to 500 code points. `{ ok: true, value }` → if the action's capability declares `result`, `checkValue` on `value` (mismatch → `failed`, reason `"Invalid result"`); with no `result` schema `value` is dropped. Timeouts are the host's: wrap `dispatch`.
- H7. **Record.** `actions'' = { ...actions', [key]: final }`. The map is bounded to 64 entries (plan 029 A2): when a new key would exceed it, the oldest *settled* (non-`pending`) entries are evicted in insertion order first; if all 64 are `pending` the call fails with `limit-exceeded` at `/actions` **before** authorise/dispatch, so nothing ran.
- H8. **Re-render.** `renderPlacement({ actions: actions'', previous: latestServed })`. If `publish` was supplied it is called with this result too. The same `Served` is returned, so a request/response host uses the return value and ignores `publish`, and a push host does the opposite; neither receives a double delivery unless it uses both.
- H9. **Return** `{ served, actions: actions'' }`. The host persists `actions` and decides when an entry expires by omitting it (plan 029 A6); the library has no timers.

`publish` rejections and throws are contained (event `publish-failed`); the call still resolves.

## `dependents` steps

**D1.** Pure and linear: for each placement, scan its `bound` entries once.
**D2.** A placement matches when any entry has `source === change.source` and, when `change.params` is given, `canonicalJson(entry.params) === canonicalJson(change.params)`. Without `params`, every use of the source matches.
**D3.** Return the matching `placementId`s in input order, each at most once. No registry, no subscription, no clock: the host decides *when* to call it (after an action settles, on a push from its own bus), and what to do with the ids.

## Failures and events

`HostEvent` is a frozen, open union like `SurfaceEvent` (plan 029): events carry ids, kinds, reasons and `LiveframeError`s, **never state, params, data, intent args or action values**. A handler's throw or rejection is contained. With no `onEvent`, nothing is allocated. The library never logs.

| Step | Failure | Returned error | Event |
|---|---|---|---|
| R1/H1 | unknown `catalogId` | `catalog-mismatch` `/catalogId` | `load-failed` |
| R2 | missing placement or package, identity or integrity mismatch | `not-found`, `invalid-document`, `hash-mismatch`, `catalog-mismatch` | `load-failed` |
| R2 | stored state reset / migrated | none (success) | `state-reset`, `state-migrated` |
| R3 | unbindable inputs | `invalid-prop`, `unknown-name` | `render-failed` |
| R4/R5 | resolver rejected, reported failure, bad value | envelope in `data`, or `render-failed` `/data/<alias>` | `source-failed` (`reason`: `unauthorized`/`unavailable`/`stale`/`failed`/`invalid-result`) |
| R6 | key unchanged | none (returns `previous`) | `render-skipped` |
| R8 | runner failure or throw | the runner's errors, or `render-failed` | `render-failed` |
| R9 | runner tree fails host validation, or wrong surface/revision | validator errors | `tree-rejected` |
| H2 | stale revision | `version-conflict` | `intent-refused` (`stale`) |
| H2 | not offered | the `checkOffered` errors | `intent-refused` (`not-offered`) |
| H2/H4 | offered action refused / unauthorised | none: `refused` entry in `actions` | `intent-refused` |
| H3b | state value misses the schema | `invalid-prop` `/value` | `intent-refused` (`invalid-state`) |
| H6 | dispatch threw or failed | none: `failed` entry | `action-failed` |
| H7 | 64 pending entries | `limit-exceeded` `/actions` | `intent-refused` (`limit`) |
| any | `publish` threw | none | `publish-failed` |

## What stays the host's

Transport and sessions; viewer identity and tenancy (the library takes an opaque `viewer` and hands it to `resolve`, `authorize` and `dispatch` without reading it); **concurrency**: serialise calls per placement and scope, because a stateless function cannot stop two callers passing the same stale `served`; de-duplication and batching of reads across placements (wrap `resolve` with a per-request memo; `docs/host.md` shows one); any cache beyond `renderKey`; the store (including `verified`); approval and confirmation policy; `dispatch` timeouts and retries; expiry of `actions` entries; the choice of patch versus whole tree per client; persistence of `Served` across restarts (it holds a compiled validator, so it is process-local; after a restart the host renders afresh with a revision floor, R7); the pace of `dependents` calls.

## Why this is not the rejected controller

The controller of the evaluation holds revision counters per `(surfaceId, scope)`, retains each accepted tree, tracks which placement read which source, and pushes invalidations. These are four pieces of mutable state with lifetimes, eviction and memory growth, and every one is a place two hosts would disagree about semantics. This design has none:

- No long-lived object: three plain functions. The "wiring" object is the host's own.
- No internal maps, caches or timers. The only memoisation is the host-owned `verified` cache `loadPlacement` already accepts, and reuse of `previous.validator`, which the caller passes.
- Every call is a pure function of its arguments plus the injected effects. Two calls with equal arguments and equal effect results give equal results.
- Revisions, the accepted tree and the dependency graph live in `Served`, which the **host** stores wherever it likes (a `Map`, Redis for the data fields).
- Push invalidation (evaluation Tier A §3) is `dependents` plus the host's own bus: the library computes who depends on a change; it never observes anything.

It also leaves every authority decision where law 4 puts it: `authorize` and `dispatch` are the host's callbacks, and nothing here can reach a store write, a source read or an operation except through them.

## Where each law is enforced in the sequence

| Law | Enforcement point |
|---|---|
| 1. Widget code never runs in the browser | R8 runs only in the injected `runner`, on the backend. The browser receives `Served.tree` or `patch`, never `package`'s code. |
| 2. The UI tree is validated data | R9: `validateTree` on the host before a tree can become `served`; `served.validator` is what H2 trusts. R5 validates every source value before widget code reads it, and plan 029's `actions` check does the same for statuses. |
| 3. Widget code never sets colours or CSS | Unchanged: the validator in R9 rejects colour and raw-CSS props. |
| 4. A widget never holds authority | H2 (`checkOffered`) then H4 (`authorize`) precede every effect (`putState` at H3c, `dispatch` at H6). Sources are read only by the injected `resolve` as the viewer (R4). Statuses written by H5–H7 are inputs that grant nothing (029 A7). |

Order of effects in `handleIntent`: `checkOffered` → (`setState`: schema check → `putState`) or (`action`: `authorize` → `dispatch`). The only things that can happen before `checkOffered` are the install lookup (H1), which reads a map, and nothing else. Task 11 reviews this step by step.

## Performance budget

The plan budgets **≤ 0.2 ms of pipeline overhead per `renderPlacement` beyond the runner and the resolver, on the demo catalog**. Measured in `bench/host.bench.ts` with an in-memory store, a stub runner returning a fixed validated tree and a stub resolver.

- **Included in the 0.2 ms:** `loadPlacement` with a `verified` cache hit, `bindSources`, result fitting, `renderKey` (SHA-256 over the canonical inputs: O(bytes), measured on the demo's inputs of about 4 KB), the revision, the `Served` object.
- **Reported separately, not in the 0.2 ms:** `validateTree` and `diffTrees`. They are the host-side checks the laws require and have their own budgets (the validator's 1.5 µs/node share; plan 022's diff figures). Folding them in would make the budget a function of tree size. The bench reports the total for the demo's widgets next to the budgeted part.
- **Skipped renders** (R6) are measured on their own and must be dominated by `renderKey`.
- If the first measurement misses 0.2 ms, Task 2 records the split (load, bind, key) and proposes a figure; it does not relax the budget silently.

## Modules (`src/host/`, one per function)

- `render.ts`: `renderPlacement`, and the internal `renderLoaded` that `handleIntent`'s `setState` path shares (so it loads once).
- `intent.ts`: `handleIntent`.
- `dependents.ts`: `dependents`.
- `types.ts`: `Served`, `HostWiring`, `SourceCall`, `SourceResult`, `Installs`, `HostEvent` (type-only).
- `index.ts`: the `/host` entry; host-API-free (no `node:`, `bun:` or DOM globals), covered by `portability.test.ts`.

Later tasks plug in without a design change: Task 7 widens `installs` use in `<Surface>`; Task 8 fills `Served.migrated` from `loadPlacement`; Task 10 passes `loaded.libraries` to `runner.render` in R8.

## Amendments to the plan

1. **`catalogId` is an argument** of `renderPlacement` (R1). The plan's example omitted it, but `installs` is keyed by it and nothing else can select an install before the package has been verified.
2. **`viewer: V` is an argument** of both functions, handed opaquely to `resolve`, `authorize` and `dispatch`. The plan names a "viewerContext"; `context` is the widget's input (locale, timezone), a different thing.
3. **`resolve` takes `SourceCall[]` and returns a record of `SourceResult`**, so a host can batch and report per-source failure; the plan's "failing or throwing resolver" is the `ok: false` and rejection cases.
4. **`Served` also holds `placementId`, `scope` and `bound`.** `handleIntent` needs the first two (no mismatch possible between the served tree and the call), and `dependents` needs `bound` so the host does not re-bind.
5. **The budget excludes `validateTree` and `diffTrees`** and states `renderKey` is included (see above).
6. **`setLocal` at the host is `invalid-prop` at `/type`**, not `invalid-document`: that is what `checkOffered` returns (plan 029 L4, spec §8), and handleIntent returns it unchanged. Task 3's test `set_local_at_host_rejected` asserts that.
7. **`dependents` takes the unwrapped `bindSources` value** (`Served.bound`), not the `Result`.
8. **`handleIntent`'s refusal rules** (H2), the **64-entry eviction** (H7) and the **drop of `value` for an action without `result`** (H6) are not in the plan; each exists so one bad intent or one long session cannot break every later render.
9. **The event set is larger** than the plan's five names: `load-failed`, `render-failed`, `intent-refused`, `action-failed`, `publish-failed` join `render-skipped`, `state-reset`, `state-migrated`, `source-failed`, `tree-rejected`. The plan asks for "every failure's typed error and event".
10. **A skip needs the same surface.** R6 compares `surfaceId` and `placementId`/`scope` as well as `key`, because `renderKey` does not cover them.

## Amendment (Task 11, 2026-11-08)

The impact analysis (`plans/evidence/030-impact-analysis.md` F1, F2) changed two rules after approval, with the owner's agreement:

- **H3 gains an authorise step.** `setState` calls `authorize(intent, viewer)` before H3a, with the H4 rule (only `true` passes; a throw or rejection refuses). A refusal loads, writes and renders nothing, raises `intent-refused` (`unauthorized`) and returns `{ served, actions }` as given. The law table's claim that H4 precedes every effect, `putState` included, is now true.
- **A repeated refusal is free.** When a refusal (an offered action that fails the check, or `authorize` returning false) leaves the recorded statuses as they were, H8 returns `served` without a store read, source read or render. The earlier claim that a crafted-intent flood "costs one render" held for the widget run only: R4–R5 ran before the skip.
