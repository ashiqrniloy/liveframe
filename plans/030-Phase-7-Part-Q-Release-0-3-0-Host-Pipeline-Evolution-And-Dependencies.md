# Phase 7 Part Q: Release 0.3.0 — Host Pipeline, Widget Evolution and Package Dependencies

Depends on: plans [026](026-Phase-7-Part-M-Release-0-3-0-Scope-Spec-And-Breaking-Changes.md) (verified-package cache, frozen packages), [028](028-Phase-7-Part-O-Release-0-3-0-Template-Widgets-And-Streaming.md) (template packages, the expression language reused for state migration) and [029](029-Phase-7-Part-P-Release-0-3-0-Interaction-Outcomes-Local-Bindings-And-Surface-Core.md) (action results the pipeline writes; observability event shape). Followed by plan [031](031-Phase-7-Part-R-Release-0-3-0-Isolated-Runner-Conformance-And-Starter.md).

## Objectives

- Close the production orchestration gap (W4) with a **stateless** host pipeline, `@arnilo/liveframe/host`: the library owns the order of the security-critical steps (load, bind, resolve as the viewer, render, validate, diff; then offered-intent check, authorise, persist or dispatch, record the result, re-render), while the host injects its store, runner, resolver, authoriser and dispatcher and keeps every piece of state.
- Let placements coordinate (W6b): compute which placements depend on a changed source, so one widget's action can refresh another's view without a new format.
- Make widgets evolvable (W5): a report of which installed packages break against a new catalog, several catalog majors in one renderer, and declarative state migration on a widget version change.
- Let widgets share runtime component libraries without giving up immutability (W6a): content-addressed package dependencies.
- Make the demo host show all of it, as the example outsiders copy.

## Expected Outcome

- `decision-logs/<date>-stateless-host-pipeline.md` is approved; it records why this does not reopen the stateful controller the 0.2.2 scope decision rejected.
- `/host` exports `renderPlacement`, `handleIntent` and `dependents`, host-API-free, with typed `onEvent` events.
- `/pack` exports `checkPackages`; `createRenderer` accepts several catalogs; manifests may declare `migrateState`; `loadPlacement` reports `migrated` before falling back to `reset`.
- Manifests may declare `exports` and `dependencies`; `pack()` links `liveframe:lib/<id>@<version>` imports against supplied library packages; runners and `loadPlacement` load dependencies by hash; `rebindDependencies` produces a new version against a new library version without re-transpiling.
- `examples/demo-host` uses `/host` end to end and `demo:test` covers sources, re-run skipping, patches with fallback, action results, local filtering, coordinated placements, a template widget, a migrated upgrade and a shared library.

This plan implements roadmap Phase 7's 0.3.0 host-lifecycle work: new spec §7.7 (the host pipeline) and amendments to §7.1, §7.3–§7.5, §8, §11 and §13. The pipeline is optional; every helper it composes stays public. Law 4 is the reason it exists: the library fixes the order of checks but never holds authority — `authorize` and `dispatch` are the host's. Nothing is published here.

## Tasks

- [x] Task 1: Design the stateless host pipeline and record the decision
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/030-host-pipeline-design.md` specifies `renderPlacement`, `handleIntent` and `dependents` as numbered steps, each naming the existing public helper it calls (`loadPlacement`, `bindSources`, `renderKey`, `Runner.render`, `compileValidator`/`validateTree`, `diffTrees`, `checkOffered`, `verifyPlacementInputs`), the injected host functions (`resolve`, `authorize`, `dispatch`, `publish?`), the inputs the host must pass back (`served`: the last accepted tree, its key, revision and validator identity), and every failure's typed error and event.
      - It states what stays the host's: transport, sessions and viewer identity, concurrency and de-duplication of reads, caching beyond `renderKey`, approval, tenancy.
      - It explains the difference from the rejected controller: no long-lived object, no internal maps, no timers; every call is a pure function of its arguments plus the injected effects.
      - Write `decision-logs/<date>-stateless-host-pipeline.md` with `create-decision-log`; owner approval before Task 2.
    - Performance: the design budgets pipeline overhead at ≤ 0.2 ms per `renderPlacement` beyond the runner and the resolver, on the demo catalog.
    - Code Quality: the design names one module per function in `src/host/`.
    - Security: the design shows each law's enforcement point in the sequence (law 2: host validation before `served`; law 4: `checkOffered` then `authorize` before any effect).
  - Approach:
    - Skills to Use: `create-decision-log`; `liveframe-execution` (storage, preview, renderer references).
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md` (alternative 5); `plans/liveframe-evaluation.md` Part II §1; `examples/demo-host/server.ts` (229 lines; `checkOffered` at `:168`); `docs/renderer.md:380-396`; `docs/model.md` Phase C.
    - Options Considered: a stateful controller (rejected in 0.2.2 and again here: state ownership belongs to the host); docs only (rejected: every adopter re-implements the security-critical order).
    - Chosen Approach: stateless functions with injected effects.
    - API Notes and Examples:
      ```ts
      const host = { store, runner, installs, resolve, authorize, dispatch, verified, onEvent }; // built once, spread per call
      const out = await renderPlacement({ ...host, placementId, catalogId, scope, viewer, context, actions, previous: served });
      const next = await handleIntent({ ...host, served, origin, intent, viewer, context, actions, publish });
      ```
    - Files to Create/Edit: `plans/evidence/030-host-pipeline-design.md`; `decision-logs/<date>-stateless-host-pipeline.md`
  - Test Cases to Write: n/a — design.
  - Notes (executed 2026-11-08): Design in `plans/evidence/030-host-pipeline-design.md` (rules R1–R11 `renderPlacement`, H1–H9 `handleIntent`, D1–D3 `dependents`, an event table, the host's responsibilities, the comparison with the rejected controller, a law-by-law enforcement table, the budget, modules and ten amendments); owner approved it as written; decision log `decision-logs/2026-11-08-1115-stateless-host-pipeline.md`. No third-party library is involved, so no docs lookup was needed. Findings that change later tasks (Tasks 2–4 are amended accordingly):
    - `renderPlacement` takes `catalogId` and `viewer`; `resolve(calls, viewer)` gets `SourceCall[]` and returns a record of `SourceResult` (`{ ok: true, value } | { ok: false, reason, message? }`). The manifest's `catalogId` is checked by `loadPlacement`, never used to pick the install.
    - `Served` also holds `placementId`, `scope` and `bound` (the `bindSources` value, which `dependents` reads).
    - The 0.2 ms budget includes `renderKey` and excludes `validateTree`/`diffTrees`, which are reported beside it.
    - `setLocal` at the host is `invalid-prop` at `/type` (what `checkOffered` returns), not `invalid-document`.
    - `handleIntent` writes a `refused` status under the offered tree's key (never the posted intent's) for an offered but invalid action, evicts the oldest settled entries past 64, and drops `value` for an action with no `result` schema.
    - A skip needs the same `surfaceId`, `placementId` and `scope` as well as the same `renderKey`. A host that can lose `previous` passes a `revision` floor.
    - The event set grows to ten names (see the event table). Hosts must serialise calls per placement and scope: a stateless function cannot detect two callers sharing a stale `served`.
    - The demo's `server.ts` lines cited in the design (`:93` served map, `:108` surface, `:183-223` intents) are the code Task 5 deletes.
    - Gate: this task changes only docs. `bun run check` ran three times with a load average near 12 (a `rustc` build and two `qemu` processes on the machine): 1582, 1581 and a third run each passed all but one or two wall-clock overhead tests, a different one each time (`in_process_warm_overhead_under_point_one_ms`, `worker_warm_overhead_report`). Both pass alone (0.03/0.08/-0.07 ms in-process; worker 4.0 ms/render), and lint, format and typecheck are clean. Not a regression; the plan's final `bun run check` should run on a quiet machine.

- [x] Task 2: `renderPlacement`
  - Acceptance Criteria:
    - Functional:
      - `renderPlacement(args): Promise<Result<Served>>` with the contract, steps R1–R11 and `Served` of `plans/evidence/030-host-pipeline-design.md` (`Served` = `{ placementId, scope, tree, key, revision, validator, package: { id, version, hash }, state, bound, patch?, reset?, migrated? }`). In order: `installs[catalogId]` → `loadPlacement` (with `verified` when given) → `bindSources` → one `resolve(calls, viewer)` → each result fitted to its source's `result` schema (a reported or thrown failure yields a `sourceOutcome` envelope when the source declares one, else `render-failed` at `/data/<alias>`; a value that misses the schema is always `render-failed`) → `renderKey`; equal to `previous.key` with the same surface, placement and scope returns `previous` unchanged with `render-skipped` → `runner.render` → host `validateTree` plus a surface and revision check (`tree-rejected`) → `diffTrees(previous.tree, tree)` when `previous` matches surface and catalog; an `invalid-document` from diffing yields a whole tree only.
      - `installs` maps `catalogId` → `{ catalog, capabilities }` (supports Task 7); the caller names `catalogId`, and an unknown one is `catalog-mismatch` at `/catalogId`.
      - `onEvent` receives the frozen `HostEvent`s of the design's table (ids, kinds, reasons and errors, never values): `render-skipped`, `state-reset`, `state-migrated` (emitted from Task 8, when `loadPlacement` can report `migrated`), `source-failed`, `tree-rejected`, `load-failed`, `render-failed`, and, from `handleIntent`, `intent-refused`, `action-failed`, `publish-failed`. A throwing handler is contained; with none, nothing is allocated.
    - Performance: ≤ 0.2 ms beyond the runner and the resolver, including `renderKey` and excluding `validateTree`/`diffTrees` (reported beside it), measured in `bench/host.bench.ts` with an in-memory store, a stub runner and a stub resolver on the demo's inputs (about 4 KB); a skipped render is measured separately. A miss records the split instead of relaxing the figure.
    - Code Quality: composes public helpers only; no copies of their logic.
    - Security: law 2 — runner output is validated on the host before it can become `served`; sources are resolved only through the injected `resolve`.
    - Compatibility: `added` for `/host` and its exports.
  - Approach:
    - Skills to Use: `liveframe-execution`; `lean-build`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `src/store/load.ts:34-99`; `src/formats/manifest.ts:304`; `src/pack/hash.ts:225`; `src/validate/patch.ts:174`; `src/schema.ts:106` (`sourceOutcome`).
    - Options Considered: resolve sources inside the runner. Rejected: data is resolved by the app as the viewer (law 4), outside widget code.
    - Chosen Approach: the designed sequence.
    - API Notes and Examples: see Task 1.
    - Files to Create/Edit: `src/host/render.ts`; `src/host/types.ts`; `src/host/index.ts`; `package.json` (`./host`); `scripts/build.ts`; `bench/host.bench.ts`; `src/__tests__/host-render.test.ts`; `src/__tests__/portability.test.ts`; `docs/spec.md` §7.7, §13; `docs/host.md`; `register-0.3.0.json`
  - Test Cases to Write:
    - `skips_render_when_key_unchanged`; `no_skip_for_other_surface_or_scope`; `patch_when_previous_matches_whole_tree_otherwise`; `resolver_failure_becomes_outcome_envelope`; `resolver_throw_without_envelope_render_failed_no_leak`; `resolver_result_failing_schema_rejected`; `runner_tree_validated_on_host`; `runner_tree_wrong_revision_rejected`; `unknown_catalog_id_catalog_mismatch`; `revision_floor_used_without_previous`; `events_carry_no_values`; `throwing_on_event_contained`.
  - Notes (executed 2026-11-08): `src/host/` holds `render.ts` (`renderPlacement` plus small helpers per rule: `readSources` R4, `fitData` R5, `unchanged` R6, `runWidget` R8, `validatorFor`/`checkTree` R9, `comparable` R10), `types.ts` (`Served`, `HostWiring`, `Installs`, `SourceCall`, `SourceResult`, `Actions` and all ten `HostEvent` variants, so Task 3 adds no types), `events.ts` (`notifier`, shared with Task 3; reuses `isThenable`) and `index.ts`. `/host` is registered in `package.json`, the portability matrix (`host` row, `console` only: the bundle reaches acorn through the store), `exports.test.ts`, README and spec §13 tables, the API register (nine `added` entries), the changelog, `docs/migration-0.3.md`, `docs/host.md`, spec §7.7 and the skill's architecture reference. 13 tests in `host-render.test.ts` (the 12 planned plus `validator_reused_only_for_the_same_install`). Findings:
    - **The 0.2 ms budget cannot include `loadPlacement`.** `bench/host.bench.ts` (demo catalog, 3.6 KB of inputs, in-memory store, stub runner and resolver, CPU time because the machine ran at load 10–45): a skipped render 0.55–0.65 ms, of which `loadPlacement` on a verified-cache hit is 0.42–0.50 ms (the install catalog is re-canonicalised at 0.21 ms and the package re-hashed at 0.15 ms on every hit), `bindSources` 0.03 ms and `renderKey` 0.05–0.08 ms. The pipeline's own part is **0.13–0.16 ms** (`skipped − load`), inside the 0.2 ms figure, which now reads "beyond `loadPlacement`, the runner, the resolver, `validateTree` and `diffTrees`" and is the gate in the bench. `loadPlacement` is reported beside it; making a cache hit cheap is in the backlog ("Make a verified-package cache hit cheap"). `validateTree` 0.007–0.012 ms and `diffTrees` 0.003 ms on the demo tree. A full render with `previous` is 0.60–0.66 ms in total.
    - `Served.migrated` and the `state-migrated` event are not in Task 2: `loadPlacement` cannot return `migrated` until Task 8, which adds the `Served` field and the event (the `HostEvent` union already lacks `state-migrated` for that reason).
    - A validator is reused from `previous` only when the same `installs[catalogId]` object and package hash are in play (a module-private `WeakMap` records what each validator was compiled for); a host that rebuilds `installs` per call still gets correct results and loses only the reuse. Documented in spec §7.7.
    - A skip also requires that a supplied `revision` floor is not above `previous.revision`, so a host demanding a newer revision always gets a render.
    - Sources resolve before the skip decision (R4–R6), so a failing source is re-reported on a skipped render.
    - `bun run check`: build, gen:check, typecheck, lint, format and 1594 tests pass; three wall-clock browser tests (`switch_under_budget_with_blur`, `switch_under_budget_with_a_two_axis_kind_installed`, `state_case_lists_missing_fixtures`) failed in the full run at load ~17 and pass alone (73 pass), as in Task 1. The plan's final run belongs on a quiet machine.

- [x] Task 3: `handleIntent`
  - Acceptance Criteria:
    - Functional:
      - `handleIntent(args): Promise<Result<{ served: Served; actions: Record<string, ActionStatus> }>>` with steps H1–H9 of the design. `checkOffered(served.tree, origin, intent, served.validator)` first; a stale revision is a typed `version-conflict` error; an offered action that fails the check is recorded `refused` under the offered tree's key (never the posted intent's) and re-rendered; anything not offered is a typed error; each raises `intent-refused`. Then `setState`: load, check `{ ...storedState, [key]: value }` against the manifest state schema (`invalid-prop` at `/value`), `store.putState`, render with that state. Or an action: `authorize(intent, viewer)` (false, throw or rejection → `refused` with the fixed reason `"Not allowed"`), then `pending` (rendered and published only when `publish` is supplied), `await dispatch(intent, viewer)` returning `{ ok: true, value? } | { ok: false, reason? }`, `value` checked against the action's `result` schema (dropped when there is none), `ok`/`failed` recorded, re-render with the updated `actions`, published when `publish` is supplied and returned. The `actions` map keeps at most 64 entries by evicting the oldest settled ones; if all are `pending`, `limit-exceeded` before authorise or dispatch.
      - Concurrency rule from spec §11 holds: an intent from a superseded revision is refused, never rewritten to the latest revision. Hosts serialise calls per placement and scope (`docs/host.md`).
      - `setLocal` intents reaching the host are rejected by `checkOffered` as `invalid-prop` at `/type` (plan 029 L4: they belong to the renderer); `handleIntent` returns that error unchanged.
    - Performance: overhead ≤ 0.2 ms beyond the injected calls.
    - Code Quality: one function; effects only through injected callbacks.
    - Security: law 4 — nothing runs before `checkOffered` and `authorize`; a `dispatch` throw becomes `failed` with a generic reason, never the host's stack.
    - Compatibility: `added`.
  - Approach:
    - Skills to Use: `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `src/validate/offered.ts:29`; spec §8 rules; plan 029 Task 2 (`ActionStatus`).
    - Options Considered: dispatch before re-checking the schema. Rejected: spec §8 requires the re-check.
    - Chosen Approach: the designed sequence.
    - API Notes and Examples: see Task 1.
    - Files to Create/Edit: `src/host/intent.ts`; `src/host/index.ts`; `src/__tests__/host-intent.test.ts`; `docs/host.md`; `docs/spec.md` §7.7, §8; `register-0.3.0.json`
  - Test Cases to Write:
    - `unoffered_intent_refused_no_effect`; `stale_revision_refused`; `authorize_false_refused`; `authorize_throw_fails_closed`; `invalid_offered_action_recorded_refused_under_offered_key`; `pending_then_ok_published_in_order`; `dispatch_throw_becomes_failed_without_leak`; `result_value_failing_schema_becomes_failed`; `value_dropped_without_result_schema`; `actions_over_64_evict_oldest_settled`; `set_state_persists_then_rerenders`; `set_state_invalid_value_no_write`; `set_local_at_host_rejected` (`invalid-prop` at `/type`); `no_effect_before_check_offered_and_authorize` (call-order spy).
  - Notes (executed 2026-11-08): `src/host/intent.ts` holds `handleIntent` (H1–H9) as one exported function over small per-path helpers (`begin` builds the per-call context, `refuseOffered` H2, `applyState` H3, `authorized` H4, `dispatched` H6, `runAction` H4–H9) because Biome caps a function's cognitive complexity at 25 and the single function scored 37. `renderPlacement` is split at the design's seam: `renderLoaded(args, install, loaded)` is R2's reports onwards, exported from `render.ts` only (not from `/host`), so the `setState` path loads once and renders the state it just wrote. `cut` (the 500-code-point cut) is shared. 17 tests in `host-intent.test.ts` (the 14 planned plus `no_pending_frame_without_publish`, `served_catalog_without_install_is_load_failed`, `publish_failure_contained`); `/host` exports `handleIntent`, `IntentArgs`, `DispatchResult` and `Handled`; spec §7.7 (rule 5, the `handleIntent` steps, the event list) and §8, `docs/host.md` § "Handle an intent", the changelog, `docs/migration-0.3.md`, README, the architecture reference and four register entries are updated. Findings:
    - **`set_state_invalid_value_no_write` cannot reach H3b through the offered check.** `checkOffered` already checks a filled value against the manifest's state schema (the catalog event's check is derived from it), so an over-long value is `invalid-prop` at `/value` with event reason `not-offered`, and H3b never runs. H3b is the re-check against the manifest installed *now*: the test upgrades the placement to a package whose `label` allows three characters after the tree was served, and expects `invalid-prop` at `/value`, reason `invalid-state`, no write. A served tree from an older package version is therefore applied to the newer package's state schema, not refused; a host that wants the stricter rule can compare `served.package.hash` itself. Backlog candidate for the Task 11 sweep.
    - **A failed final re-render loses the action's outcome.** The effect has happened, but `Result<Handled>` carries only errors. The design accepts this (H9); `docs/host.md` tells the host to record the outcome in its own `dispatch`.
    - **The pending render goes through `renderPlacement`**, so with `publish` supplied it resolves sources and runs the widget one more time per action. Reported, not optimised.
    - **An `actions` entry that is updated moves last**, so "oldest settled" means least recently settled.
    - **Bench (`bench/host.bench.ts`, load average 22–31).** `handleIntent` minus an equivalent `renderPlacement` (same runner, `loadPlacement`, resolver and actions): −0.13 to +0.09 ms over eight runs, inside the 0.2 ms budget; `checkOffered` caches per tree and validator, so it costs almost nothing after the first call. The existing `renderPlacement` gate (`skipped − load`, two separately timed segments) failed once at 0.575 ms in four runs at this load and passed the others: it is noise-bound on a busy machine, as Task 2 recorded. A quiet-machine run belongs to the plan's final verification.
    - `bunx biome check --write` on `src docs bench scripts` also reformatted seven unrelated generated and fixture files; they were reverted, not committed.

- [x] Task 4: Cross-placement coordination through source dependents (W6b)
  - Acceptance Criteria:
    - Functional:
      - `dependents(placements, change)` where `placements` are `{ placementId, bound }` (`bound` is the unwrapped `bindSources` value, which `Served.bound` carries) and `change` is `{ source, params? }`; returns the placement ids whose bound calls name the source and, when `params` is given, equal params by canonical JSON. Linear in total bound calls.
      - `docs/host.md` shows the coordination pattern: a "selection" capability (a source plus an action), two placements, `handleIntent` on one, `dependents` to re-render the other.
    - Performance: linear; benchmarked with 1,000 placements.
    - Code Quality: a pure function; no subscription registry.
    - Security: law 4 — coordination goes through declared capabilities only; no widget-to-widget channel.
    - Compatibility: `added`.
  - Approach:
    - Skills to Use: `liveframe-execution`; `lean-build`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `src/formats/manifest.ts:304`; `src/pack/hash.ts` (`canonicalJson`).
    - Options Considered: a new channel format and intent. Rejected: sources and actions already express shared host data; a new format adds a second path to the same thing.
    - Chosen Approach: compute dependents from existing bindings.
    - API Notes and Examples:
      ```ts
      for (const id of dependents(placements, { source: "selection.current" })) publish(await renderPlacement({ …, placementId: id }));
      ```
    - Files to Create/Edit: `src/host/dependents.ts`; `src/host/index.ts`; `src/__tests__/host-dependents.test.ts`; `docs/host.md`; `register-0.3.0.json`
  - Test Cases to Write:
    - `dependents_match_source_name`; `dependents_match_params_canonically`; `dependents_linear_scale`.
  - Notes (executed 2026-11-08): `src/host/dependents.ts` holds `dependents(placements, { source, params? })` (D1–D3: one pass over each placement's `bound`, canonical JSON of `change.params` computed once and compared only for entries whose source matches, ids in input order and once each) and the `Dependent` type (`{ placementId, bound }`, which a `Served` satisfies as it is). `/host` now exports `dependents` and `Dependent`; `exports.test.ts` pins it. 3 tests in `host-dependents.test.ts`. `bench/host.bench.ts` adds 1,000 placements with two bound calls each: **0.057 ms per scan** (`host_dependents_1000_ms`; linear by construction, the test only guards a coarse 20 ms ceiling). Docs: `docs/host.md` § "Coordinate placements" (the selection capability, two placements, `handleIntent` on one and `dependents` for the other), spec §7.7 (a `dependents` bullet; the §13 table row), the changelog, `docs/migration-0.3.md` (the `hostAction` text must appear verbatim there: `api-stability.test.ts` enforces it), README, the architecture reference, two register entries (`added`). Findings:
    - **`param` matching is exact.** `change.params` must equal a bound call's params in full (canonical JSON); there is no subset match. A source whose params vary per placement (a page cursor) is matched by name alone, leaving `params` out.
    - **`dependents` is not told about `actions`.** A change in `actions` (a result a widget reads) is not a source, so it never appears here; `handleIntent` already re-renders the acting placement with its updated `actions`.
    - The Task 5 demo will carry the working selection example; `docs/host.md` shows the pattern without a runnable test of its own.
    - Gate: `bun run check` passed (1618 tests) with the load average near 5.

- [x] Task 5: The demo host shows the full orchestration
  - Acceptance Criteria:
    - Functional:
      - `examples/demo-host/server.ts` uses `renderPlacement`/`handleIntent`/`dependents` and keeps only transport and its own resolver/dispatcher/authoriser.
      - New demo capabilities and widgets: a task source with paging (`bindSources` from `state.cursor`), a `tasks.claim` action with a `result` schema, a "selection" source/action shared by a list and a detail placement, a TSX widget with local filtering (`when`), a template widget, and an upgraded widget version exercising `migrateState` (Task 8) and a shared library (Tasks 9–10) once those land — this task adds the first five; Tasks 8–10 extend the demo in their own steps.
      - `demo:test` asserts: a re-render with unchanged inputs is skipped; a state change ships a patch and a stale base falls back to a whole tree; a claim shows pending then ok; selecting in the list re-renders the detail; typing in the filter sends no request.
      - Resolves backlog "Show request-time orchestration in the demo host" and "Fix initially-open dialogs in the demo host" if the latter blocks these flows (else left in the backlog with a note).
    - Performance: n/a — example; `demo:test` time recorded.
    - Code Quality: the demo server shrinks; the README walks through it.
    - Security: the demo's authoriser is explicit and documented as a placeholder for the app's policy.
    - Compatibility: n/a — example code.
  - Approach:
    - Skills to Use: `liveframe-execution`; `run` (drive the demo host to confirm).
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `examples/demo-host/*`; backlog entries named above.
    - Options Considered: a separate second example. Rejected: hosts copy the demo; one complete example beats two partial ones.
    - Chosen Approach: upgrade the demo in place.
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `examples/demo-host/server.ts`; `capabilities.json`; `widgets/*`; `catalog.json` (if a primitive like `textField` with `onInput` is needed); `primitives/*`; `tests/*`; `README.md`; `scripts/demo-test.ts`; `plans/backlog.md`
  - Test Cases to Write:
    - `demo_skips_unchanged_render`; `demo_patch_and_stale_fallback`; `demo_claim_pending_then_ok`; `demo_selection_coordinates_placements`; `demo_filter_sends_no_request`.
  - Notes (executed 2026-11-08): `examples/demo-host/server.ts` now calls `renderPlacement`, `handleIntent` and `dependents` and keeps what is the app's: the viewer and `authorize` (a documented placeholder policy), `reads` (the data behind `demo.tasks`, `tasks.page` and `selection.current`), `dispatcher` (`demo.notify`, `tasks.claim`, `selection.select`), the last `Served` and `Actions` per placement, and a `floors` map for revision continuity when a placement is replaced. New capabilities: `tasks.page` (cursor and limit), `selection.current`, `tasks.claim` (with a `result` schema) and `selection.select`. New widgets: `widgets/queue/` (TSX; `cursor` bound from `state.cursor` through `bindSources`, a `Claim` button reading `actions["claim:<id>"]`, a local `q` filter with `when`) and `widgets/detail/` (a template widget reading `selection.current`); the existing `tasks` template widget stays. `tests/orchestration.test.ts` adds `demo_skips_unchanged_render`, `demo_patch_and_stale_fallback`, `demo_claim_pending_then_ok`, `demo_selection_coordinates_placements`, `demo_filter_sends_no_request` (Chromium) and `demo_page_follows_a_selection` (Chromium, two placements on one page). README, `docs`-style walkthrough and the backlog entry "Show request-time orchestration in the demo host" (marked Done) are updated. Findings:
    - **A request/response host cannot show `pending`, so the intent answer is a stream.** `POST /placements/:id/intents` answers with JSON lines (`application/x-ndjson`); `publish` writes each frame as `handleIntent` renders it. A failure before the first frame is still a plain JSON error with its status (`streamed` in `server.ts`), so `409` and `400` are unchanged. The final frame is both published and returned by `handleIntent`; the demo uses `publish` only and takes the returned `served` and `actions` for storage, as `docs/host.md` says ("use one or the other").
    - **`Served` carries no manifest**, and a browser needs one to compile its validator. The host keeps a `hash → manifest` map filled from `store.getPackage`. A candidate for `Served` or the docs if adopters ask.
    - **Patch or whole tree is the transport's call.** The client sends `accepted` (placement → revision it holds); the host sends `frame.patch` only when `accepted[placement] === patch.base` and updates `accepted` as it sends, so the second frame of a claim is a patch against the first. `GET /surfaces/:id?base=N` follows the same rule. The browser applies a patch only to the tree it was made from and refetches otherwise. Tests that want whole trees resolve a stream with `settled()`.
    - **`dependents` refreshes more than the acting pair.** A claim changes `tasks.page` and `selection.current`, so every served placement that reads either is re-rendered (every `queue` placement as well as `detail`); the acting placement is excluded because `handleIntent` already re-rendered it. `affects` (action → sources) is the host's own table: the library cannot know what a `dispatch` changed.
    - **A replaced placement needs a revision floor.** `PUT /placements/:id` drops the stored frame and remembers its revision, and the next render passes `revision: floor + 1` (only when there is no `previous`), so a connected client does not discard the new widget's tree as stale.
    - **Status mapping.** `checkOffered` reports an unknown origin node as `not-found` at `/origin/nodeId`, the same kind a missing placement or package uses. `failure()` in `server.ts` therefore treats `not-found` as the host's fault (500) only outside `/origin`. Worth a distinct kind or documented pointer rule if more hosts map errors to statuses.
    - **The text field commits on Enter or blur**, not per keystroke, so the local filter applies then. `demo_filter_sends_no_request` types, presses Enter and asserts no POST left the page and the other rows are gone.
    - **`server.ts` grew, from 253 to 416 lines**, against the criterion "the demo server shrinks". The hand-rolled orchestration it replaced (the validator cache, `surface()` and the intent handler's checks, state write and dispatch) is gone, but the file is longer overall; the growth is the three resolvers, the dispatcher, the NDJSON stream, the frame builder and the coordination table that the demo did not have. Not trimmed further; it is the example outsiders copy.
    - **`demo:test`** (build, pack, install, typecheck, 63 tests across nine files including the two Chromium flows): about 35 s wall time on a machine at load 5. The dialog backlog entry ("Fix initially-open dialogs in the demo host") did not block any flow and `initially_open_dialog_is_dismissable` passes, so it is left with a note.
    - Gate: `bun run check` passed (1618 tests, load average 5–8, 7 min 42 s); `bun run demo:test` passed (63 tests). Tasks 8–10 add the migrated upgrade and the shared library to this demo.

- [x] Task 6: Report which installed packages break against a new catalog (W5a)
  - Acceptance Criteria:
    - Functional:
      - `/pack` exports `checkPackages(packages, { catalog, capabilities }): readonly PackageCheck[]` with `{ id, version, hash, ok, errors }` per package, running `verifyPackage` plus a render of every scenario through an optional `runner` argument (`templateRunner` needs no sandbox; code packages need the host's runner). It never mutates or stores.
      - `liveframe check-packages <store-dir> --catalog <file> --capabilities <file>` prints the report as JSON (Bun CLI; reads a `fileStore`).
      - `docs/packages.md` § "Upgrading the catalog": classify with `classifyCatalogChange`, run `checkPackages`, decide per package.
    - Performance: linear in packages; 1,000 template packages checked in a bench, recorded.
    - Code Quality: composes `verifyPackage` and runners.
    - Security: law 1 — code packages render only through the supplied runner; none is defaulted.
    - Compatibility: `added` for `checkPackages` and the CLI command.
  - Approach:
    - Skills to Use: `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `src/formats/catalog.ts:416` (`classifyCatalogChange`); `src/pack/verify.ts:50`; `src/cli/*`.
    - Options Considered: automatic migration of packages. Rejected: changing code is an author's act; the report feeds that work.
    - Chosen Approach: a pure report plus a CLI wrapper.
    - API Notes and Examples:
      ```ts
      // The Store interface has no package listing; the host passes the packages it keeps
      // (the CLI enumerates a fileStore's documented packages/ layout).
      const report = await checkPackages(installedPackages, { catalog: next, capabilities, runner: templateRunner() });
      ```
    - Files to Create/Edit: `src/pack/check.ts`; `src/pack/index.ts`; `src/cli/liveframe.ts`; `src/__tests__/pack-check.test.ts`; `docs/packages.md`; `docs/spec.md` §7.3, §13; `register-0.3.0.json`
  - Test Cases to Write:
    - `removed_kind_breaks_dependent_package`; `minor_catalog_change_keeps_packages_ok`; `scenario_render_failure_reported`; `cli_prints_report`.
  - Notes (executed 2026-11-08): `src/pack/check.ts` holds `checkPackages(packages, { catalog, capabilities, runner? })` and `PackageCheck`, split into a `renderScenarios` helper because Biome caps cognitive complexity at 25 (the single function scored 35). `/pack` exports both. `liveframe check-packages <store-dir> --catalog <file> --capabilities <file>` is in `src/cli/liveframe.ts`: it scans `packages/*/*.json` (the documented `fileStore` layout), renders template packages with `templateRunner`, only verifies code packages, prints the JSON report and exits 0 (all ok), 1 (any failed) or 2 (invalid catalog or capabilities). 5 tests in `pack-check.test.ts` (the 4 planned plus `untrusted_documents_are_reported_not_thrown`). Docs: `docs/packages.md` § "Upgrading the catalog", spec §7.3 and the §13 table, the changelog, `docs/migration-0.3.md`, README, the skill references and two register entries (`added`: `checkPackages`, `PackageCheck`). Findings:
    - **The function is async.** The plan's signature returned `readonly PackageCheck[]`; rendering through a `Runner` is async, so it returns `Promise<readonly PackageCheck[]>`.
    - **`packages` is `readonly unknown[]`**, because documents read from a store are untrusted. A non-record or malformed document yields an entry with blank `id`/`version`/`hash` and `ok: false`, never a throw; a throwing runner is `render-failed` at `/scenarios/<n>`.
    - **A runner is paired per package by the caller.** `templateRunner` refuses a code package (`invalid-document` at `/code`), which would read as a break, so `checkPackages` does not guess: without a `runner` packages are verified only. A removed kind that only a code package's code uses is therefore invisible until the host passes its own runner. The CLI cannot do that (law 1), so its code-package entries mean "verifies", not "renders"; `docs/packages.md` says so.
    - **A catalog major always breaks every manifest** that names the old `catalogId` (`catalog-mismatch`); the report shows it, and the doc points that case at repacking. Tests use a same-id catalog with a kind removed, which is what a mislabelled release would ship.
    - **Bench (`bench/host.bench.ts`, load average ~32).** 1,000 distinct template packages (3.6 KB of state each) verify and render in about **0.66 ms per package** (CPU time), dominated by the re-hash that `verifyPackage` does; recorded as `check_packages_ms_per_package`, not gated. Plan 028's note about warming template compilation needs nothing extra: `templateRunner` already caches the compiled template under the package hash.
    - Gate: `bun run check` passed (1623 pass, 4 skip, 0 fail). Tests must import `/pack` from `../pack/index.ts`: `@arnilo/liveframe/pack` resolves to `dist` unless run with `--conditions liveframe:source` (which `bun run test` does).

- [x] Task 7: Several catalog majors in one renderer (W5b)
  - Acceptance Criteria:
    - Functional:
      - `createRenderer({ catalogs: [{ catalog, implementations }, …] })` runs the registry check per catalog (an implementation may serve several catalogs only if its definition equals each catalog's); `createRenderer({ catalog, implementations })` keeps working.
      - `<Surface>` selects the catalog by the arriving tree's `catalogId`, which must equal the validator's; a mismatch renders the fallback with `catalog-mismatch` (and an `arrival-rejected` event).
      - Spec §6.4 adds: a design system is compiled for one catalog; surfaces of two catalog majors on one page use distinct design-system identities. `designSystemCss` already takes the catalog; docs show two sheets side by side.
      - `/host` `installs` (Task 2) routes by `catalogId`. A browser test renders an `acme.ui@1` and an `acme.ui@2` surface on one page with different `button` definitions.
    - Performance: selection by id is O(1); arrival budget unchanged.
    - Code Quality: the surface core (plan 029) takes a catalog lookup instead of one catalog.
    - Security: law 2 — a tree validated against the wrong catalog cannot render.
    - Compatibility: `widened` for `createRenderer` and `createSurfaceCore`.
  - Approach:
    - Skills to Use: `liveframe-execution` (renderer reference).
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `src/react/renderer.tsx:350-400` (registry check); spec §5 (versioning), §6.4, §11.
    - Options Considered: one renderer per catalog. Works today but forces hosts to route surfaces themselves; the multi-catalog form keeps one registry.
    - Chosen Approach: an additive `catalogs` form.
    - API Notes and Examples:
      ```ts
      const { Surface } = createRenderer({ catalogs: [{ catalog: v1, implementations: implsV1 }, { catalog: v2, implementations: implsV2 }] });
      ```
    - Files to Create/Edit: `src/react/renderer.tsx`; `src/surface/*`; `src/host/render.ts`; `src/__tests__/react-registry.test.tsx`; `src/__tests__/react-browser.test.tsx`; `docs/renderer.md`; `docs/styling.md`; `docs/spec.md` §6.4, §11; `register-0.3.0.json`
  - Test Cases to Write:
    - `registry_check_per_catalog`; `shared_implementation_requires_equal_definitions`; `two_catalog_majors_on_one_page` (browser); `catalog_id_mismatch_falls_back`.
  - Notes (executed 2026-11-08): `createRenderer` takes `{ catalog, implementations }` or `{ catalogs: [{ catalog, implementations }, …] }`. A module-level `register` helper does one catalog's registry check (pointers prefixed `/catalogs/<n>` in the new form, unchanged in the old); an empty `catalogs` is `invalid-document` at `/catalogs`, a repeated `catalogId` is `catalog-mismatch` at `/catalogs/<n>/catalog/catalogId`. 8 tests in `react-catalogs.test.tsx` (the 4 planned plus `single_catalog_form_still_works`, `each_surface_uses_its_validators_catalog`, `core_refuses_a_tree_its_validator_accepted_for_another_catalog`, `validator_of_no_registered_catalog_falls_back_and_reports`), with fixtures `fixtures/react-catalogs.tsx` and `react-catalogs-client.tsx` (the proof catalog twice, `proof.ui@1`/`@2`, `button` differing, every other kind sharing one implementation). Spec §6.4 rule 4, §11, `docs/renderer.md` § "Draw two catalog majors on one page", `docs/styling.md` § "Two catalog majors on one page", the changelog, `docs/migration-0.3.md` and the skill's renderer reference are updated. Findings, where the task as written changed:
    - **The core keeps one catalog; the renderer holds the lookup.** A core is built per validator and a validator is compiled for one catalog, so "the core takes a catalog lookup" would only move the same choice inside it. `createSurfaceCore` is unchanged in shape (so `widened` does not apply to it: it is new in 0.3.0 anyway).
    - **A `Surface` picks its catalog by the validator, not by the arriving tree.** The core is created before any tree arrives (and for `tree={null}`), so only the validator can choose. With one catalog it serves every validator as before (the existing registry tests pass a validator of another catalog). With several, `buildFacts(validator).catalogId` selects; a validator the library did not compile, or compiled for no registered catalog, gets a small `refusedCore` that draws the fallback and raises `arrival-rejected` with `catalog-mismatch` at `/validator`.
    - **The tree's catalog is checked after the validator, not before.** A first version compared `tree.catalogId` before validating; `invalid_server_fallback_hydrates_without_mismatch` counts validator calls and failed, and spec §11 says to validate before reading any tree field. `named()` in `src/surface/core.ts` now lets the validator decide, then reports `catalog-mismatch` at `/catalogId` for a tree it rejected at `/catalogId` that names another catalog, or accepted although it names another catalog (a lenient wrapper validator). The error kind changed from `invalid-prop` at `/catalogId`: a behaviour change to `<Surface>` relative to 0.2.3, documented under "Breaking changes" in `docs/migration-0.3.md`.
    - **Register.** `findIndex` matches the first entry per (subpath, name), so a second `createRenderer` entry and a `createSurfaceCore` entry were "stale". The change is folded into the existing `createRenderer` entry's `reason` (its `changed` status and behaviour test stand); no `createSurfaceCore` entry because that export is `added` in 029.
    - **`/host` `installs`** already routes by `catalogId` (Task 2: `catalog-mismatch` at `/catalogId` for an unknown one), so nothing changed there.
    - **The browser test proves the page, not the CSS.** `two_catalog_majors_on_one_page` draws `@1`, `@2` and a crossed surface (a `@1` tree with the `@2` validator) in one Chromium page: each button comes from its own major's implementation and the crossed one draws the fallback. It loads no design-system sheets; the distinct-identity rule is spec §6.4 rule 4 and the styling guide, not a computed-style assertion.
    - `bunx biome check --write` again reformatted seven unrelated generated and fixture files; reverted. Gate: `bun run check` build, gen:check, typecheck, lint and format pass; 1629 tests pass and two wall-clock browser tests (`switch_changes_computed_styles_not_dom_structure`, `switch_under_budget_with_blur_through_surface`) failed at load average 30–40 and pass alone, as in Tasks 1–3. The plan's final run belongs on a quiet machine.

- [x] Task 8: Declarative state migration (W5c)
  - Acceptance Criteria:
    - Functional:
      - A manifest may declare `migrateState: Record<stateKey, Expr>` using the template expression language with one root, `previous` (the stored state, type `unknown`). Install checks expression shape, bounds and that each key exists in the state schema.
      - `loadPlacement` and `verifyPlacementInputs`: when stored state fails the schema and the manifest declares `migrateState`, build `initialState` overlaid with each evaluated key; if that validates, return it with `migrated: LiveframeError[]` (the original failures) and no `reset`; otherwise reset as today. A host persists the migrated state if it wants.
      - Templates and TSX widgets both use it; the demo's upgraded widget migrates `filter: "mine"` to `scope: { owner: "me" }`.
      - Spec §14's "beyond resetting" non-goal is replaced by this rule.
    - Performance: runs only on the failure path.
    - Code Quality: evaluation via `/template`'s `evaluate`; no new interpreter.
    - Security: law 4 — migration reads only the stored state; no data, no host access.
    - Compatibility: `widened` for `manifest.json`, `loadPlacement`, `verifyPlacementInputs` result types.
      - `/host`: `Served` gains `migrated?: readonly LiveframeError[]` and `HostEvent` gains `state-migrated` (`{ placementId, errors }`), both moved here from Task 2 because `loadPlacement` cannot report `migrated` before this task; `renderPlacement` copies `loaded.migrated` and raises the event.
  - Approach:
    - Skills to Use: `liveframe-execution` (storage reference).
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `src/store/load.ts:11-99`; spec §7.4, §14.
    - Options Considered: a `migrate` function in package code. Rejected: needs the runner (a sandbox) at load time and the stored state has no version tag; a declarative mapping needs neither.
    - Chosen Approach: declarative per-key mapping from `previous`.
    - API Notes and Examples:
      ```jsonc
      "migrateState": { "scope": { "$cond": [{ "$eq": [{ "$path": "previous.filter" }, { "$lit": "mine" }] }, { "$lit": { "owner": "me" } }, { "$lit": { "owner": null } }] } }
      ```
    - Files to Create/Edit: `src/formats/manifest.ts`; `src/store/load.ts`; `src/store/index.ts`; schemas; corpus; `examples/demo-host/widgets/*`; `docs/packages.md`; `docs/spec.md` §7.4, §14; `register-0.3.0.json`
  - Test Cases to Write:
    - `migration_applies_when_state_fails`; `failed_migration_falls_back_to_reset`; `migrate_key_not_in_state_schema_rejected`; `migration_cannot_read_data_root`.
  - Notes (executed 2026-11-08): `Manifest` gains `migrateState?: Record<string, Json>` (at most 64 entries; schema `additionalProperties: json`, so `schemas/manifest.json` changed). `validateManifest` runs `checkMigrateState`: a key outside the state schema is `unknown-name` at `/migrateState/<key>`, and each expression goes through `checkExpression` over `rootScope({ previous: "dynamic" })`, so shape, depth and node bounds are `/template`'s own and any other root (`data`, `params`, `state`, `context`, `actions`) is `unknown-name` at the expression's `$path`. `pack()` and `verifyPackage` reach it through `validateManifest`; `validateManifestShape` (the transport check) does not evaluate expressions, as it does not for sources. The map is part of the manifest, so it is in the package hash. `src/store/load.ts` gains a private `migrate()` called from `verifyPlacementInputs` (and so from `loadPlacement`) only on the schema-failure path of a stored state that is valid JSON: `initialState` overlaid with each key evaluated by `evaluate(expr, { previous })`, accepted only if the result fits the state schema; a failed or non-fitting migration, or a non-JSON stored value, resets as before. Both functions return `migrated` (the original failures, pointers under `/state`) instead of `reset`, never both. `Served.migrated` and the `state-migrated` event moved here from Task 2 as planned; `renderPlacement` copies `loaded.migrated` and raises the event with ids and errors only. Tests: 9 in `state-migration.test.ts` (the 4 planned plus `valid_stored_state_is_not_migrated`, `verify_placement_inputs_migrates_like_load_placement`, `no_migrate_state_resets_as_before`, `migrate_state_expression_shape_and_bounds_checked`, `migrate_state_is_in_the_package_hash`), `migrated_state_is_served_and_reported_without_values` in `host-render.test.ts`, three manifest corpus cases (`migrate-state-valid`, `-unknown-key`, `-other-root`) and the demo test `demo_upgrade_migrates_state_instead_of_resetting` (`tests/migration.test.ts`: the `tasks` template upgraded to `1.1.0`, renaming `page` to `pageIndex` with `migrateState: { pageIndex: { $path: "previous.page" } }`; the list stays on its second page and the host persists the migrated state). Spec §7.1 (the `migrateState` bullet), §7.4 (the load rules, split into short bullets), §7.7 (`Served`, the event list) and §14 (the non-goal now excludes only code-based migration) are updated, as are `docs/packages.md` § "Migrating state across versions", `docs/formats.md`, `docs/migration-0.3.md`, `docs/host.md`, the demo README, the changelog, the storage reference and the register (`verifyPlacementInputs` `widened`; reasons extended on the existing `Manifest`, `loadPlacement` and `schemas/manifest.json` entries because the register keeps one entry per name; six `added` corpus entries). Findings:
    - **An absent result leaves the key at its initial value.** `$path` to a missing field yields absent (`$omit` semantics), so a typo in a `previous.*` path migrates quietly to the initial value rather than failing; only a runtime error (divide by zero, a bound) or a result that misses the schema resets. The spec says so; a stricter rule would need a `$has` guard in the manifest.
    - **No type check against the state property at install.** `previous` is `dynamic`, so an expression's inferred type is not compared with the property's schema; the whole migrated state is validated at load instead. A bad mapping therefore shows as a reset at run time, not a failed install. A cheap install-time check (infer, then `compileSchema` on a constant result) is a backlog candidate for Task 11.
    - **Importing `/template` into `formats/manifest.ts` pulls the expression language into the root export and the schema publisher.** `schemas.test.ts` lists the files it copies for `scripts/schemas.ts` by hand; `src/template/expr.ts` and `scope.ts` were added. Bundle-size budgets still pass.
    - **The demo resolves the library from a packed tarball**, so `bun test` inside `examples/demo-host` uses stale code until `bun run demo:test` repacks; the new test passed under `demo:test` (64 tests).
    - **The first spec paragraph was one 1,300-byte bullet** and `spec_paragraphs_stay_short` failed; split into four.
    - Gate: the first `bun run check` (load average 6–13) failed four tests: the two above plus `all_runners_agree_on_template_trees` and `worker_runs_template_packages_beyond_its_package_limit`, which hit the 100 ms render limit and pass alone. The rerun after the fixes passed: `bun run check` 1641 pass, 4 skip, 0 fail; `bun run demo:test` 64 pass.

- [ ] Task 9: Content-addressed package dependencies — format and packing (W6a, part 1)
  - Acceptance Criteria:
    - Functional:
      - A **library package** is an ordinary code package whose manifest declares `exports: string[]` (named composed components, ≤ 64) besides its default export, which renders its scenarios as a gallery; all existing package rules apply.
      - A widget imports `liveframe:lib/<id>@<version>` named exports. `pack(input, { …, libraries })` resolves each such import against a supplied, verified library package, checks the names are in its `exports`, records `manifest.dependencies: [{ id, version, hash }]` (≤ 16 direct; the transitive graph ≤ 32 packages, depth ≤ 4, acyclic) and emits canonical linker header lines `import * as __lf_lib<N> from "liveframe:lib/<id>@<version>";` after the SDK lines. Library code is **not** copied into the dependent.
      - The package hash covers `manifest.dependencies` (so a dependency hash change is a new dependent hash). `verifyPackage(pkg, { …, libraries })` re-checks pins and names.
      - `rebindDependencies(pkg, { libraries, version })` returns a new frozen package with a new `version`, the same `code`, and dependency pins moved to the supplied library versions, provided every used name is still exported; otherwise `unknown-name`. Template packages may not declare dependencies in 0.3.0 (`invalid-document`).
      - Spec §7.3 replaces "a package never depends on another" with these rules; `forbidden-import` keeps rejecting every other bare specifier.
    - Performance: pack time for a widget with two libraries ≤ pack time of the same widget with the components bundled.
    - Code Quality: header lines follow the existing linker contract's shape (`src/runner-kit/link.ts:27`).
    - Security: integrity by hash pins; a library is inert data until a runner links it; law 1 unchanged.
    - Compatibility: `widened` for `manifest.json`, `pack`, `verifyPackage`; `added` for `rebindDependencies`; a hash vector for a dependent package (register entry).
  - Approach:
    - Skills to Use: `liveframe-execution` (storage reference); `find-docs` (acorn 8.19.0 import-declaration AST for named imports).
    - Library Documentation to Check Before Implementation: acorn 8.19.0 `ImportDeclaration`/`ImportSpecifier`; sucrase 3.35.1 import preservation.
    - Documentation Reviewed: `src/pack/bundle.ts:59` (`checkModule`); `src/runner-kit/link.ts`; spec §7.3, §7.5 (linker contract).
    - Options Considered: semver ranges. Rejected: a package's tree must be determined by its hash. Copy libraries in (status quo). Rejected: updating a shared component means repacking every widget from source the host may not keep.
    - Chosen Approach: exact hash pins plus `rebindDependencies`.
    - API Notes and Examples:
      ```tsx
      import { TaskCard } from "liveframe:lib/acme.cards@3.1.0";
      ```
    - Files to Create/Edit: `src/formats/manifest.ts`; `src/pack/pack.ts`; `src/pack/bundle.ts`; `src/pack/verify.ts`; `src/pack/rebind.ts`; `src/pack/index.ts`; schemas; `conformance/hash/packages.json`; corpus; `docs/packages.md`; `docs/spec.md` §7.3; `register-0.3.0.json`
  - Test Cases to Write:
    - `import_of_unexported_name_rejected`; `dependency_cycle_rejected`; `library_code_not_copied`; `dependency_pin_in_hash`; `rebind_moves_pins_and_version`; `rebind_missing_name_unknown_name`; `template_with_dependencies_rejected`.
  - Notes (executed <date>):

- [ ] Task 10: Content-addressed package dependencies — linking, runners and stores (W6a, part 2)
  - Acceptance Criteria:
    - Functional:
      - `linkPackage(code, resolve)` accepts `__lf_lib<N>` header lines and resolves them through the same callback (`resolve(specifier)` receives `liveframe:lib/<id>@<version>`). The runner kit's `renderModule` is unchanged.
      - `Runner.render(pkg, inputs, { …, libraries? })`: the reference runners load each library by hash before the dependent, verify each hash once, and count libraries toward `maxModules`/`maxPackages`. The QuickJS runner (plan 031) implements the same.
      - `loadPlacement` loads `manifest.dependencies` from the store by `(id, version)`, verifies hashes against the pins (`hash-mismatch` on difference, `not-found` when missing) and returns them as `libraries`. The verified-package cache covers libraries.
      - `renderPlacement` passes libraries through. The demo installs a shared `acme.cards` library used by two widgets, then upgrades it and rebinds both without repacking source.
      - `storeSuite` gains dependency cases.
    - Performance: rendering a dependent with warm libraries is within 5% of the bundled equivalent on the in-process runner.
    - Code Quality: one dependency loader shared by both reference runners.
    - Security: a pin mismatch never loads; law 2 unchanged (trees validated on the host).
    - Compatibility: `widened` for `linkPackage`, `Runner` options, `loadPlacement` result.
  - Approach:
    - Skills to Use: `liveframe-execution` (preview, storage references).
    - Library Documentation to Check Before Implementation: Bun dynamic `import()` of `data:` URLs (current loader behaviour) via `find-docs`.
    - Documentation Reviewed: `src/preview/load.ts`; `src/preview/in-process.ts:44`; `src/preview/worker/index.ts:59`; `src/store/load.ts`.
    - Options Considered: inline libraries at load time into one module. Rejected: loses per-library module caching and identity.
    - Chosen Approach: link by specifier, load by hash.
    - API Notes and Examples:
      ```ts
      const loaded = value(await loadPlacement(store, id, install));
      await runner.render(loaded.package, inputs, { …, libraries: loaded.libraries });
      ```
    - Files to Create/Edit: `src/runner-kit/link.ts`; `src/preview/load.ts`; `src/preview/in-process.ts`; `src/preview/worker/*`; `src/preview/runner.ts`; `src/store/load.ts`; `src/conformance/store.ts`; `src/host/render.ts`; `scripts/runner-kit-bundle.ts`; `examples/demo-host/*`; `docs/packages.md`; `docs/spec.md` §7.4–§7.5; `register-0.3.0.json`
  - Test Cases to Write:
    - `link_rewrites_library_header_lines`; `runner_loads_library_before_dependent`; `pin_mismatch_hash_mismatch`; `missing_library_not_found`; `both_runners_agree_with_libraries`; `demo_rebinds_shared_library`.
  - Notes (executed <date>):

- [ ] Task 11: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: the twelve impact areas swept in `plans/evidence/030-impact-analysis.md`, with law 4 reviewed step by step through `handleIntent` and integrity reviewed for dependencies; findings presented, dispositions recorded and executed or backlogged.
    - Performance: `bun run bench` including `host.bench.ts`.
    - Code Quality: findings cite `file:line`.
    - Security: an explicit review that no pipeline path performs an effect before `checkOffered` and `authorize`.
  - Approach:
    - Skills to Use: `create-plan`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: this plan's notes.
    - Options Considered: n/a.
    - Chosen Approach: the standard final task.
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `plans/evidence/030-impact-analysis.md`; `plans/backlog.md`.
  - Test Cases to Write: n/a.
  - Notes (executed <date>):

## Verification (whole plan)

- `timeout 900 bun run check`
- `timeout 900 bun run bench`
- `bun run demo:test`
- `bun src/cli/liveframe.ts check-packages examples/demo-host/.data --catalog examples/demo-host/catalog.json --capabilities examples/demo-host/capabilities.json`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
