# Phase 7 Part T: Review Defects and the Release Scope

Depends on: plan [032](032-Phase-7-Part-S-Release-0-3-0.md) complete (0.3.0 published). Followed by plans [034](034-Phase-7-Part-U-Request-Time-Performance.md) (request-time performance), [035](035-Phase-7-Part-V-Browser-Renderer-Cost-And-Resilience.md) (browser renderer), [036](036-Phase-7-Part-W-Internal-Structure-And-Parity.md) (internal structure), [037](037-Phase-7-Part-X-Interaction-Capabilities.md) (interaction), [038](038-Phase-7-Part-Y-Rendering-Capabilities.md) (rendering) and [039](039-Phase-7-Part-Z-Agent-Generated-UI.md) (agent-generated UI). Source: the package review of `main` at `b4e2359` (2026-11-15), whose findings are numbered below and whose reproductions and measurements are in [`evidence/033-review-findings.md`](evidence/033-review-findings.md).

## Objectives

- Record the scope decision for the review: which findings ship in a 0.3.x patch and which wait for 0.4.0.
- Generate the core 0.3.0 API baseline and gate 0.3.x changes with `register-0.3.1.json`.
- Fix the six reproduced defects in the host pipeline, the surface core and the worker runner, and the one inconsistency in `emit`.
- Stop wall-clock assertions deciding whether `bun run check` passes.

## Expected Outcome

- `decision-logs/<date>-review-2026-11-15-scope.md` is approved. It holds the findings table below with the owner's release for each row.
- `src/__tests__/api-stability.test.ts` compares the checkout against `scripts/release/api/0.3.0.json` through `register-0.3.1.json`.
- `renderPlacement` never issues a revision at or below `previous.revision`.
- The host guide's examples never send a patch the client has already applied, and a test executes them.
- `handleIntent` returns the recorded `actions` when the render after a dispatch fails.
- A stale arrival leaves an invalid surface invalid.
- `<Surface>` and `createSurfaceCore` take `limits`; a validator this library copy did not compile draws the fallback instead of throwing.
- `workerRunner()` starts a render's timeout when the worker is ready.
- A host `onIntent` that throws synchronously never reaches a primitive's event handler.
- No test under `bun run check` fails on elapsed wall time alone.

This plan implements the first part of the review-fix work in roadmap Phase 7. Every fix here is additive or changes an outcome only for a case that is wrong today, so it fits the 0.3.x promise in `docs/compatibility.md` ("The 0.3.x promise"). No version is bumped and nothing is published here: the scope decision in Task 1 names the release, and a release plan is written when the owner cuts one. Spec sections touched: §7.5 (runners), §7.7 (host pipeline), §8 and §11 (renderer).

### Review findings and their dispositions

The release column is the proposal Task 1 puts to the owner.

| # | Finding | Plan / task | Proposed release |
|---|---|---|---|
| D1 | A revision floor below `previous.revision` moves the revision backwards (`src/host/render.ts:241`) | 033 T2 | 0.3.1 |
| D2 | A skipped render returns `previous` with its old `patch`; the guide's examples resend it (`docs/host.md:40`, `:157`) | 033 T3 | 0.3.1 |
| D3 | An action's outcome is lost when the follow-up render fails (`src/host/intent.ts:132-137`) | 033 T4 | 0.3.1 |
| D4 | A stale arrival sets an invalid surface valid again (`src/surface/core.ts:506`) | 033 T5 | 0.3.1 |
| D5 | Surface-side validation limits cannot be raised; a wrapped validator makes `accept()` throw | 033 T6 | 0.3.1 |
| D6 | `workerRunner()` counts worker boot against the render timeout (`src/preview/worker/index.ts:190`) | 033 T7 | 0.3.1 |
| D7 | A synchronous throw from `onIntent` escapes `emit` on the path without confirmation (`src/surface/core.ts:264`) | 033 T8 | 0.3.1 |
| G1 | Wall-clock assertions gate `bun run check` | 033 T9 | 0.3.1 |
| G2 | `Store` has no compare-and-set, so `applyState` can lose a write across processes | 037 T6 | 0.4.0 |
| G3 | Backlog items the review met: no `when`/`bind` in element JSON; no empty state for a filtered list; no conformance cases for local bindings | 039 T2; 037 T7; 037 T8 | 0.4.0 |
| P1 | Package load and verification dominate a request-time render | 034 T1–T3 | 0.3.1 |
| P2 | `renderKey` costs more than the render it may skip on data-heavy widgets | 034 T4 | 0.3.1 |
| P3 | Composed components re-walk their props at every layer (`src/sdk/render.ts:845-851`) | 034 T5 | 0.3.1 |
| P4 | Focus continuity scans the whole document on every surface update (`src/react/renderer.tsx:131-169`) | 035 T2 | 0.3.1, or 0.4.0 if the decision changes behaviour |
| P5 | Every implementation renders twice at mount (`src/react/renderer.tsx:420`, `:459`) | 035 T3 | 0.3.1 |
| P6 | The QuickJS runner recompiles the validator on every render | 034 T6 | 0.3.1 |
| A1 | Validator facts live in six module-level `WeakMap`s | 033 T6 (fail closed); 036 T1 (one table) | 0.3.1 |
| A2 | Three implementations of the tree rules must agree | 036 T2 | 0.3.1 |
| A3 | `core.accept()` mutates the core during React render | 035 T4 | 0.3.1 |
| A4 | Any invalid arrival unmounts the whole surface | 035 T5 | 0.3.1 (opt-in) |
| A5 | `sdk/render.ts`, `template/expr.ts` and `createSurfaceCore` are hard to change safely | 036 T3–T5 | 0.3.1 |
| A6 | Source comments cite plan task ids | 036 T6 | 0.3.1 |
| F1 | Compound intents: a local write with a host intent | 037 T2 | 0.4.0 |
| F2 | Intent values read from `local` | 037 T3 | 0.4.0 |
| F3 | Bounded array carries | 037 T4 | 0.4.0 |
| F4 | Focus and scroll directives as data | 037 T5 | 0.4.0 |
| F5 | A `pending` source outcome | 038 T2 | 0.4.0 |
| F6 | Enter, exit and reorder motion | 038 T3 | 0.4.0 |
| F7 | A windowing recipe for long collections | 038 T4 | 0.4.0 |
| F8 | A DOM adapter on `/surface` (a v1 non-goal today) | 038 T5–T6 | 0.4.0, if the non-goal is lifted |
| F9 | `when`/`bind` in element JSON | 039 T2 | 0.4.0 |
| F10 | A catalog digest for agents | 039 T3 | 0.4.0 |
| F11 | An A2UI converter package (a v1 non-goal today) | 039 T4 | 0.4.0, if the non-goal is lifted |
| F12 | More starter primitives | 039 T5–T6 | 0.4.0 |

## Compatibility rules for every task

1. **Patch-safe only.** A task may add an optional field, option or export, each with an `added` or `widened` entry in `register-0.3.1.json`. A task that needs `removed` or `changed` stops; the item moves to 0.4.0 with the owner's acknowledgement in the task notes.
2. **Outcome changes only for wrong cases.** A task changes an outcome only where today's outcome is a defect named in the table. It names that case in its Functional criterion and in a CHANGELOG "Fixed" line.
3. **No corpus expectation, hash vector or published schema meaning changes.**

## Tasks

- [x] Task 1: Record the scope decision and gate 0.3.x against a 0.3.0 baseline
  - Acceptance Criteria:
    - Functional:
      - Write `decision-logs/<date>-review-2026-11-15-scope.md` with `create-decision-log`. Its table is the one above. The owner confirms each row's release, and separately the two rows that need a spec non-goal lifted (F8, F11). The log is created only after that confirmation.
      - Generate `scripts/release/api/0.3.0.json` from the `v0.3.0` tag as `0.2.3.json` was generated (a temporary `git worktree`, `bun install --frozen-lockfile`, `bun run build`, `bun scripts/release/api-surface.ts <tmp> --out …`), with the command in its `generatedFrom` header. Create `register-0.3.1.json` as `[]`.
      - `api-stability.test.ts` compares the checkout against `0.3.0.json` through `register-0.3.1.json`. `register-0.3.0.json` stays as history.
      - `roadmap.md` §2 Phase 7 replaces the "proposed" bullet with the approved scope and a link to the log.
    - Performance: n/a — documents and a test baseline.
    - Code Quality: the baseline test keeps one checkout baseline, as `docs/compatibility.md:13` describes; the companion-package baselines are unchanged.
    - Security: n/a — no runtime path changes. The gate itself protects every law's public contract from an unreviewed change.
  - Approach:
    - Skills to Use:
      - `create-decision-log` — the scope is a release decision and needs the owner's explicit approval.
      - `liveframe-execution` — routes to `references/formats.md` for the API gate.
    - Library Documentation to Check Before Implementation:
      - none; read `scripts/release/api-surface.ts` and `src/__tests__/api-stability.test.ts:1-60`.
    - Documentation Reviewed:
      - `docs/compatibility.md:13-33` (register rules, the 0.3.x promise); `plans/backlog.md` "Generate the core 0.3.0 API baseline before 0.3.1"; plan 023 Task 1 (the same step for 0.2.3).
    - Options Considered:
      - Keep `0.2.3.json` plus the 0.3.0 register as the baseline — rejected: an `added` entry only has to be absent from the baseline, so a later change to a 0.3.0 declaration passes unreviewed (backlog entry, "Why").
      - An empty register that forbids additions, as 0.2.3 used — rejected: D3 and D5 need additive declarations, which the 0.3.x promise allows.
    - Chosen Approach:
      - Baseline from the tag, a register that starts empty and accepts only `added` and `widened`.
    - API Notes and Examples:
      ```bash
      git worktree add /tmp/lf-0.3.0 v0.3.0
      (cd /tmp/lf-0.3.0 && bun install --frozen-lockfile && bun run build)
      bun scripts/release/api-surface.ts /tmp/lf-0.3.0 --out scripts/release/api/0.3.0.json
      ```
    - Files to Create/Edit:
      - `decision-logs/<date>-review-2026-11-15-scope.md`: the decision.
      - `scripts/release/api/0.3.0.json`, `scripts/release/api/register-0.3.1.json`: baseline and register.
      - `src/__tests__/api-stability.test.ts`: new baseline and register; a test that `register-0.3.1.json` holds no `removed` or `changed` entry.
      - `docs/compatibility.md`: name the 0.3.0 baseline and the 0.3.1 register.
      - `roadmap.md`: §2 Phase 7 bullet.
      - `plans/backlog.md`: close "Generate the core 0.3.0 API baseline before 0.3.1".
  - Test Cases to Write:
    - `baseline_0_3_0_matches_the_checkout_through_the_0_3_1_register`: fails when any export, declaration or published schema differs from 0.3.0 without a register entry.
    - `register_0_3_1_holds_only_additive_entries`: fails when an entry is `removed` or `changed`.
  - Notes (executed 2026-11-15; **checkbox left open because full `bun run check` failed on pre-existing D6/G1 load-sensitive tests**):
    - Owner explicitly approved the scope table (`0.3.1` for D1–D7, G1, P1–P6 [with P4 moving to `0.4.0` if behaviour changes], A1–A6; `0.4.0` for G2–G3, F1–F12) and separately approved lifting both spec §14 v1 non-goals (`F8` DOM adapter on `/surface`; `F11` A2UI converter package) for `0.4.0`. Recorded in `decision-logs/2026-11-15-1251-review-2026-11-15-scope.md`.
    - Generated `scripts/release/api/0.3.0.json` from a detached `git worktree` at `v0.3.0` (`18f2fe1`) and created `scripts/release/api/register-0.3.1.json` as `[]`. Switched `src/__tests__/api-stability.test.ts` to compare against `0.3.0.json` through `register-0.3.1.json` (keeping `register-0.3.0.json` checked against `docs/migration-0.3.md` as history), added `register_0_3_1_holds_only_additive_entries`, and updated `docs/compatibility.md`, `roadmap.md` (§2 Phase 7 approved scope + §3 plan ledger), and `plans/backlog.md` (closed "Generate the core 0.3.0 API baseline before 0.3.1").
    - **Findings affecting later tasks:**
      - `plans/evidence/032-acceptance-map.json` listed `baseline_0_2_3_matches_the_checkout_through_the_0_3_0_register` in 31 rows and is verified by `src/__tests__/acceptance-script.test.ts` on every `bun run check`; updated those entries to `baseline_0_3_0_matches_the_checkout_through_the_0_3_1_register`.
      - **Task 9 (G1):** `packages/starter/src/__tests__/switch.test.tsx:102` uses `toBeLessThanOrEqual(16.67)` (not `toBeLessThan(`), so Task 9's grep missed it; it failed under host load (`89.70 ms` / `150.40 ms` vs `16.67`). Include it in Task 9 alongside `proof/tests/switch.test.ts:166`.
    - Full `bun run check` could not complete green on this host under load average 14.8–25.9: run 1 failed `acceptance_map_covers_every_bullet_of_plans_026_to_031` (fixed in `032-acceptance-map.json`), `quickjs_matches_render_for_every_proof_scenario` (5000 ms timeout under load; passed at 4123.56 ms alone), and `starter_switch_within_budget` (`89.70 ms` vs `16.67`); run 2 failed `scripted_agent_writes_fixes_and_lays_out_a_widget_through_mcp_tools_only` (D6) and hit the 900 s command timeout. Re-check after Tasks 7 and 9 or on a quiet host before ticking.

- [x] Task 2: Never issue a revision at or below the previous one (D1)
  - Acceptance Criteria:
    - Functional:
      - With `previous` given, the revision is `max(revision ?? 0, previous.revision + 1)`. Without `previous` it is `revision ?? 1`, as today.
      - The changed case: `previous` at 8, `revision: 5`, changed inputs. Today the tree gets revision 5 and no patch; it now gets 9 and a patch.
      - Spec §7.7 R7 states the rule in those words.
    - Performance: no added work; `bench/host.bench.ts` overhead stays within its 0.2 ms budget.
    - Code Quality: one expression at `src/host/render.ts:241`; `unchanged()` at `:156-167` already reads the argument as a floor and is not changed.
    - Security: law 2. A revision the renderer would drop as stale is never served, so `checkOffered` never compares against a frame no client drew.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/storage.md` covers the host pipeline.
      - `surgical-patch` — one line, with the regression test first.
    - Library Documentation to Check Before Implementation:
      - none; read `src/host/render.ts:155-167`, `:232-241`.
    - Documentation Reviewed:
      - Spec §7.7 R6–R7; §9 rule 2; `docs/host.md:78-80` ("A revision floor"); `src/__tests__/host-render.test.ts:222-229` (`revision_floor_used_without_previous`).
    - Options Considered:
      - Reject a floor at or below `previous.revision` with an error — rejected: the guide tells a host to pass a persisted counter on every call, and that counter is legitimately behind after a few renders.
      - Document that the floor must exceed `previous.revision` — rejected: the code already treats it as a floor at `:165`, so the two readings in one function are the defect.
    - Chosen Approach:
      - Take the larger of the floor and the successor.
    - API Notes and Examples:
      ```ts
      const revision = previous ? Math.max(args.revision ?? 0, previous.revision + 1) : (args.revision ?? 1);
      ```
    - Files to Create/Edit:
      - `src/host/render.ts`: R7.
      - `src/__tests__/host-render.test.ts`: the tests below.
      - `docs/spec.md`: §7.7 R7.
      - `docs/host.md`: the floor bullet says a floor may be passed on every call.
      - `CHANGELOG.md`: a "Fixed" line naming the case.
  - Test Cases to Write:
    - `revision_floor_below_previous_still_advances`: `previous` at 8 and `revision: 5` with a changed state gives revision 9 and a patch whose `base` is 8. Fails on today's line 241.
    - `revision_floor_above_previous_is_used`: `previous` at 8 and `revision: 41` gives 41.
    - `revision_floor_used_without_previous` (existing) stays green.
  - Notes (executed 2026-11-15; **checkbox left open because full `bun run check` failed on pre-existing D6/G1 load-sensitive tests**):
    - Changed `src/host/render.ts:241` R7 to `previous ? Math.max(args.revision ?? 0, previous.revision + 1) : (args.revision ?? 1)`, updated `docs/spec.md` §7.7 R7 and `docs/host.md` ("A revision floor" bullet), added `## Unreleased` -> `Fixed:` in `CHANGELOG.md`, and added `revision_floor_below_previous_still_advances` (verified failing at `5` before the fix) and `revision_floor_above_previous_is_used` in `src/__tests__/host-render.test.ts`.
    - `bun run build`, `bun run gen:check`, `bun run typecheck`, `bun run lint`, `bun run format:check`, `src/__tests__/host-render.test.ts` (16/16), `src/__tests__/host-intent.test.ts` (19/19), `src/__tests__/api-stability.test.ts` (16/16), `src/__tests__/docs-wording.test.ts` (2/2), and `src/__tests__/acceptance-script.test.ts` (2/2) all passed. `bench/host.bench.ts` passed (`pipelineMs: 0.063 ms` within `0.2 ms` budget) at load `10.7`; earlier runs during peak load (`23.8`) exceeded `0.2 ms` (`0.274–0.353 ms`).
    - **Findings affecting later tasks (Task 9 / G1):** `src/__tests__/validator-smoke.test.ts:18` uses `toBeLessThanOrEqual(5)` on a `performance.now()` measurement (missed by Task 9's `toBeLessThan(` grep); added it to Task 9's file list.
    - Full `bun run check` run 1 passed 1770/1776 (4 skipped) with 2 pre-existing D6/G1 failures (`all_runners_agree_on_template_trees` at `Render exceeded 100 ms`; `validator_smoke_under_5us_per_node` at `5.08` vs `<= 5`, both passing alone at load `6.58`); run 2 hit another host CPU burst (55 timing/timeout failures). Re-check after Tasks 7 and 9 or on a quiet host before ticking.

- [x] Task 3: Never resend an applied patch after a skipped render (D2)
  - Acceptance Criteria:
    - Functional:
      - A skipped render still returns the `previous` object itself; `src/__tests__/host-render.test.ts:111` (`expect(second).toBe(first)`) stays as written.
      - `docs/host.md` states that a skipped render returns the same object and that nothing is sent for it. Its three examples (`:40`, `:104`, `:157`) send only when the result is a new frame.
      - The guide's examples are executed by a test, including a skipped render after a patched one.
      - Spec §7.7 R6 adds: "the returned `previous` still carries the `patch` that produced it; a host sends nothing for a skipped render".
    - Performance: n/a — documentation and a test.
    - Code Quality: no new field or helper; identity is the signal, as R6 already says.
    - Security: n/a — a resent patch fails closed as `stale-patch` today; this removes a wasted whole-tree request, not an exposure.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/storage.md`.
    - Library Documentation to Check Before Implementation:
      - none; read `src/host/render.ts:232-238` and `src/__tests__/host-render.test.ts:103-122`.
    - Documentation Reviewed:
      - Spec §7.7 R6, R10–R11; §9.1 (`stale-patch`); `docs/host.md:28-80`, `:137-160`.
    - Options Considered:
      - Return a copy of `previous` without `patch`, `reset` and `migrated` — rejected for 0.3.x: it changes R6's "return `previous` unchanged" and breaks the identity test; proposed for 0.4.0 in Further Actions if the owner wants the footgun removed at the type level.
      - Add `skipped: true` to the result — rejected: identity already says it, and a second signal can disagree with the first.
    - Chosen Approach:
      - Fix the guide and prove it with an executed example.
    - API Notes and Examples:
      ```ts
      const result = await renderPlacement({ ...host, placementId, catalogId, viewer, context, previous });
      if (result.ok && result.value !== previous) {
        servedByPlacement.set(placementId, result.value);
        send(client, result.value.patch ?? result.value.tree);
      }
      ```
    - Files to Create/Edit:
      - `docs/host.md`: the three examples and the "Unchanged inputs are skipped" bullet.
      - `docs/spec.md`: §7.7 R6 sentence.
      - `src/__tests__/host-guide.test.ts` (new): runs the guide's render and coordinate examples against `memoryStore()` and `templateRunner()`.
      - `examples/demo-host/` (tentative — only if its transport sends `patch ?? tree` without the identity check; `grep -rn "patch ??" examples/demo-host` found none on 2026-11-15).
      - `CHANGELOG.md`: a "Fixed (docs)" line.
  - Test Cases to Write:
    - `guide_examples_send_nothing_for_a_skipped_render`: render, change state and render (a patch is sent), render again unchanged (nothing is sent). Fails if an example sends `patch ?? tree` unconditionally.
    - `skipped_render_returns_previous_with_its_patch`: documents the contract R6 now states; fails if a later change strips or rewrites the object.
  - Notes (executed 2026-11-15; **checkbox left open because full `bun run check` failed on pre-existing D6/G1 load-sensitive tests**):
    - Updated `docs/host.md` ("Wire it once", "Unchanged inputs are skipped" bullet, "Handle an intent" `publish`, and "Coordinate placements") so every example checks frame identity against the previously served frame and sends nothing for a skipped render.
    - Updated `docs/spec.md` §7.7 R6 to state that the returned `previous` still carries the `patch` that produced it and a host sends nothing for a skipped render; added a `Fixed (docs)` entry under `## Unreleased` in `CHANGELOG.md`.
    - Verified `examples/demo-host/server.ts:226-235` already gates `patch` delivery on `accepted.get(next.placementId) === next.patch.base`, so no change to `examples/demo-host/` was needed.
    - Created `src/__tests__/host-guide.test.ts`, which compiles and executes the four `ts` blocks directly from `docs/host.md` against `memoryStore()` and `templateRunner()`, covering `guide_examples_send_nothing_for_a_skipped_render` and `skipped_render_returns_previous_with_its_patch`.
    - `bun run build`, `bun run gen:check`, `bun run typecheck`, `bun run lint`, `bun run format:check`, `src/__tests__/host-guide.test.ts` (2/2), `src/__tests__/host-render.test.ts` (16/16), `src/__tests__/host-intent.test.ts` (19/19), `src/__tests__/host-dependents.test.ts` (3/3), `src/__tests__/docs-links.test.ts` (2/2), `src/__tests__/api-stability.test.ts` (16/16), and `src/__tests__/acceptance-script.test.ts` (2/2) all passed.
    - Full `bun run check` hit the 600 s timeout under host load average 24.81 with pre-existing D6 (`Render exceeded 100 ms`) and G1 (wall-clock / timeout) failures; `src/__tests__/host-guide.test.ts` passed (2/2) inside that run. Re-check after Tasks 7 and 9 or on a quiet host before ticking.

- [x] Task 4: Return the recorded actions when the render after a dispatch fails (D3)
  - Acceptance Criteria:
    - Functional:
      - When `dispatch` ran and the following render fails, `handleIntent` returns `{ ok: false, errors, actions }`, where `actions` holds the outcome under `resultKey ?? name`. The host stores `actions`; its `served` frame is unchanged.
      - The same holds when the render after a recorded refusal fails.
      - A failure before any status was recorded (`limit-exceeded`, a stale origin, a failed load in the `setState` path) carries no `actions`.
      - Spec §7.7 H9 replaces "A failed re-render returns its errors, though the effect has happened" with the new contract.
    - Performance: no added work on the success path.
    - Code Quality: the failure type gains one optional field; `finish` in `src/host/intent.ts:132-137` is the only place that adds it.
    - Security: law 4. The widget is still told only the status the host recorded; no host error text is added.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/storage.md`.
      - `typescript-advanced-types` — widening the result type without breaking `Result<Handled>` consumers.
    - Library Documentation to Check Before Implementation:
      - none; read `src/host/intent.ts:95-153`, `:251-275`.
    - Documentation Reviewed:
      - Spec §7.7 H5–H9 and "Repeats"; `docs/host.md:85-135`; `src/__tests__/host-intent.test.ts`.
    - Options Considered:
      - Return `ok: true` with the old `served` and the new `actions` — rejected: the caller could not tell a drawn result from an undrawn one without reading events.
      - Retry the render inside `handleIntent` — rejected: the pipeline is stateless and holds no retry policy (§7.7 rule 1).
    - Chosen Approach:
      - Widen the failure with optional `actions`. A caller that ignores it behaves as today.
    - API Notes and Examples:
      ```ts
      export type HandleResult =
        | { readonly ok: true; readonly value: Handled }
        | { readonly ok: false; readonly errors: readonly LiveframeError[]; readonly actions?: Actions };
      ```
    - Files to Create/Edit:
      - `src/host/intent.ts`: `finish` and the return type.
      - `src/host/index.ts`: export `HandleResult` (tentative — only if the type is named).
      - `scripts/release/api/register-0.3.1.json`: `widened` for `handleIntent`, `added` for the type.
      - `src/__tests__/host-intent.test.ts`: the tests below.
      - `docs/spec.md` §7.7 H9; `docs/host.md` "Handle an intent"; `CHANGELOG.md`.
  - Test Cases to Write:
    - `dispatched_action_outcome_survives_a_failed_render`: a runner that fails after `dispatch` ran; the result has `ok: false`, the render's errors and `actions[name].status === "ok"`. Fails on today's `finish`.
    - `refused_action_status_survives_a_failed_render`: the same for an unauthorised action.
    - `failure_before_any_status_carries_no_actions`: a stale origin and a full pending map return no `actions`.
  - Notes (executed 2026-11-15; **checkbox left open because full `bun run check` failed on pre-existing D6/G1 load-sensitive tests**):
    - Added and exported `HandleResult` in `src/host/intent.ts` and `src/host/index.ts`, widened `handleIntent` (plus `Run.finish`, `Run.finishRefusal`, `refuseOffered`, `applyState`, `runAction`) to return `Promise<HandleResult>`, and updated `finish` in `src/host/intent.ts` to return `{ ok: false, errors: next.errors, actions }` when the follow-up render fails. Failures before any status is recorded (`limit-exceeded`, stale/unoffered origin, `setState` load/validation/render failure) continue to return `{ ok: false, errors }` with no `actions` property.
    - Registered `HandleResult` (`added`) and `handleIntent` (`widened`) under `./host` in `scripts/release/api/register-0.3.1.json`.
    - Updated `docs/spec.md` §7.7 H9, `docs/host.md` ("Handle an intent" example and failure bullet), and `CHANGELOG.md` (`## Unreleased` -> `Fixed:`).
    - Added `dispatched_action_outcome_survives_a_failed_render` (covering both default `name` and `resultKey`), `refused_action_status_survives_a_failed_render` (covering unauthorized and not-offered refusals), and `failure_before_any_status_carries_no_actions` (covering stale origin, full pending map, and `setState` load failure) in `src/__tests__/host-intent.test.ts`; verified the first two failed before the fix and all three pass after it.
    - `bun run build`, `bun run gen:check`, `bun run typecheck`, `bun run lint`, `bun run format:check`, and the focused test suite across `src/__tests__/host-intent.test.ts` (22/22), `src/__tests__/host-guide.test.ts` (2/2), `src/__tests__/host-render.test.ts` (16/16), `src/__tests__/host-dependents.test.ts` (3/3), `src/__tests__/api-stability.test.ts` (16/16), `src/__tests__/exports.test.ts` (22/22), and `src/__tests__/docs-links.test.ts` (2/2) all passed (83/83). In `bench/host.bench.ts`, `intentPipelineMs` stayed negative (`-0.097 ms`, within 0.2 ms budget), while `renderPlacement` `pipelineMs` (`0.289 ms`) exceeded `0.2 ms` under host load (`22.45`).
    - Full `bun run check` passed `build`, `gen:check`, `typecheck`, `lint`, `format:check`, and 1,746/1,782 tests (4 skipped), with 32 pre-existing D6/G1 load/timeout failures under host load average `22+` (`proof/tests/switch.test.ts:166`, `validator_smoke_under_5us_per_node`, `every_proof_scenario_passes_check` at `Render exceeded 100 ms`, `quickjs_disposes_every_handle` 5000 ms timeout, browser/worker/other-cwd timeouts); `runner-in-process.test.ts`, `template-package.test.ts`, `docs-wording.test.ts`, and `acceptance-script.test.ts` passed 33/33 when re-run outside the full suite. Re-check full `bun run check` after Tasks 7 and 9 or on a quiet host before ticking.

- [x] Task 5: Leave an invalid surface invalid when a stale revision arrives (D4)
  - Acceptance Criteria:
    - Functional:
      - After revision 5 is accepted and revision 6 is rejected, an arriving revision 3 reports `stale-revision` and changes nothing: `snapshot().valid` stays false and `accept` returns the rejection's errors.
      - A stale arrival on a valid surface still returns the current snapshot, as today.
      - Spec §11 `core.accept` adds: "an ignored arrival changes neither `valid` nor `errors`".
    - Performance: none; one branch in `accept`.
    - Code Quality: the stale path in `src/surface/core.ts:497-509` returns before `valid` and `errors` are written.
    - Security: law 2. A surface whose latest arrival failed validation stays on the fallback until a tree that passes arrives.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/renderer.md`.
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - none; read `src/surface/core.ts:486-510`.
    - Documentation Reviewed:
      - Spec §9 rule 2; §11 (`core.accept`, `SurfaceSnapshot`); `src/__tests__/surface-core.test.ts`; `src/__tests__/react-browser.test.tsx:168` (`stale_revision_is_ignored_and_new_surface_replaces`).
    - Options Considered:
      - Keep reviving the last tree — rejected: every intent from it is refused as `version-conflict`, because the host's latest frame is the rejected one.
    - Chosen Approach:
      - Return early on the stale path with whatever the surface already reports.
    - API Notes and Examples:
      ```ts
      if (previous && previous.surfaceId === next.surfaceId && previous.revision > next.revision) {
        reportStale(next, previous);
        return valid ? { ok: true, value: snap } : { ok: false, errors };
      }
      ```
    - Files to Create/Edit:
      - `src/surface/core.ts`: the stale path.
      - `src/__tests__/surface-core.test.ts`: the tests below.
      - `docs/spec.md` §11; `CHANGELOG.md`.
  - Test Cases to Write:
    - `stale_arrival_keeps_an_invalid_surface_invalid`: 5 accepted, 6 rejected, 3 arrives; `valid` is false and one `stale-revision` event fired. Fails on today's line 506.
    - `stale_arrival_on_a_valid_surface_changes_nothing`: the snapshot object is the same one.
  - Notes (executed 2026-11-15; **checkbox left open because full `bun run check` failed on pre-existing D6/G1 load-sensitive tests**):
    - Updated `src/surface/core.ts` (`accept`) so the stale-revision branch returns `valid ? { ok: true, value: snap } : { ok: false, errors }` immediately after `reportStale(next, previous)` without resetting `valid = true` or `errors = NO_ERRORS`.
    - Updated `docs/spec.md` §11 (`core.accept`) to state that an ignored arrival changes neither `valid` nor `errors`, and added a `Fixed:` entry under `## Unreleased` in `CHANGELOG.md`.
    - Added `stale_arrival_keeps_an_invalid_surface_invalid` and `stale_arrival_on_a_valid_surface_changes_nothing` in `src/__tests__/surface-core.test.ts`; updated `accept_validates_before_reading_and_keeps_the_last_good_tree` (`src/__tests__/surface-core.test.ts`) and `stale_revision_is_ignored_and_new_surface_replaces` (`src/__tests__/react-browser.test.tsx:191-194`), both of which previously asserted the buggy revival of an invalid surface when a stale revision arrived (verified the new/updated tests failed before the fix and pass after it).
    - **Findings affecting later tasks (Task 9 / G1):** full `bun run check` failed three additional pre-existing wall-clock assertions not yet in Task 9's list: `src/__tests__/css-scope-browser.test.ts:295`, `:314` (`toBeLessThanOrEqual(16.67)`) and `src/__tests__/template-document.test.ts:49` (`toBeLessThan(5)`). Added them to Task 9's file list.
    - `bun run build`, `bun run gen:check`, `bun run typecheck`, `bun run lint`, `bun run format:check`, `src/__tests__/surface-core.test.ts` (32/32), `src/__tests__/react-surface.test.tsx` (11/11), `src/__tests__/react-browser.test.tsx` (40/40), `src/__tests__/surface-dom-parity.test.ts` (2/2), `src/__tests__/api-stability.test.ts` (16/16), `src/__tests__/docs-links.test.ts` (2/2), `src/__tests__/docs-wording.test.ts` (2/2), and `src/__tests__/acceptance-script.test.ts` (2/2) all passed.
    - Full `bun run check` passed `build`, `gen:check`, `typecheck`, `lint`, `format:check`, and 1,765/1,784 tests (4 skipped), with 15 pre-existing D6/G1 load/timeout failures under host load average `26.83` (`proof/tests/switch.test.ts:166`, `phase-2-loop.test.ts`, `css-scope-browser.test.ts:295`, `:314`, `pack.test.ts:271`, `template-document.test.ts:49`, `template-package.test.ts`, `format-schema-differential.test.ts:44`, `preview-session.test.ts:359`, `validator-smoke.test.ts:18`, `quickjs_disposes_every_handle` 5000 ms timeout, `packages/starter/src/__tests__/switch.test.tsx:102`). Re-check full `bun run check` after Tasks 7 and 9 or on a quiet host before ticking.

- [x] Task 6: Let a surface take validation limits, and fail closed on a validator it cannot read (D5, A1)
  - Acceptance Criteria:
    - Functional:
      - `createSurfaceCore({ limits })` and `<Surface limits>` pass `limits` to `validator.validateTree`. A tree of 6,000 nodes is accepted under `limits: { nodes: 10000 }` and rejected without it.
      - `limits` is read when a tree arrives. A changed `limits` applies to the next arrival and does not reset the core.
      - A malformed `limits` is rejected by `validateTree` as today (`invalid-prop`), so the surface draws the fallback.
      - A validator whose facts this library copy does not hold (a wrapper, or a validator compiled by another copy) makes `accept` return `catalog-mismatch` at `/validator` with an `arrival-rejected` event. It never throws.
      - Spec §11 documents both; `docs/renderer.md` shows `limits` beside the backend's.
    - Performance: no added work when `limits` is absent; `bench/render.bench.ts` and `bench/selection.bench.ts` unchanged.
    - Code Quality: `limits` reuses `ValidateTreeOptions["limits"]`; no second limit type. The unknown-validator error is the one `refusedCore` already reports (`src/react/renderer.tsx:282-289`).
    - Security: law 2. Limits can only be raised by the app's own code, never by a tree; an unreadable validator fails closed.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/renderer.md`.
      - `find-docs` — React 19.3 prop and ref semantics, if `limits` is read through the host ref.
    - Library Documentation to Check Before Implementation:
      - React 19.3.1 (locked): `useLayoutEffect` ordering for the `host` ref (`src/react/renderer.tsx:384-387`).
    - Documentation Reviewed:
      - Spec §10 (limits "all configurable"), §11; `src/surface/core.ts:190-199`, `:489`; `src/validate/compile.ts:101-134`; `src/validate/tree.ts:23-30`; `src/preview/session.ts:24-53` (the same option on sessions).
    - Options Considered:
      - Compile limits into the validator (`compileValidator({ limits })`) — rejected: one validator serves the backend and the browser, which may hold different limits.
      - Tell hosts to wrap `validateTree` — rejected: the wrapper is exactly what throws today, and node reuse is keyed on the validator object.
    - Chosen Approach:
      - An option on the core, read like the callbacks, and a caught lookup failure on the first accepted arrival.
    - API Notes and Examples:
      ```tsx
      <Surface tree={tree} validator={validator} limits={{ nodes: 10_000 }} /* … */ />
      const core = createSurfaceCore({ catalog, validator, onIntent, limits: { nodes: 10_000 } });
      ```
    - Files to Create/Edit:
      - `src/surface/core.ts`: `SurfaceCoreOptions.limits`; `accept` passes it; the first `facts()` call is contained.
      - `src/react/renderer.tsx`: `SurfaceProps.limits`, handed to the core through the `host` ref.
      - `scripts/release/api/register-0.3.1.json`: `widened` for both option types.
      - `src/__tests__/surface-core.test.ts`, `src/__tests__/react-surface.test.tsx`: the tests below.
      - `docs/spec.md` §11; `docs/renderer.md` "Build a renderer and mount a surface"; `CHANGELOG.md`.
      - `src/preview/react/preview.tsx` (tentative — only if `<Preview>` must forward a session's `limits` to its `<Surface>`).
  - Test Cases to Write:
    - `surface_accepts_a_tree_within_raised_limits`: 6,000 nodes pass with `limits.nodes: 10000` and fail without. Fails today.
    - `surface_reads_limits_when_a_tree_arrives`: raising `limits` between two arrivals accepts the second without a new core (local state survives).
    - `unreadable_validator_draws_the_fallback`: a wrapper `{ checkNode, validateTree }` gives `catalog-mismatch` at `/validator` and never throws. Fails today with `Unknown validator`.
    - `surface_limits_prop_reaches_the_core` (server render): the same tree draws with the prop and draws the fallback without it.
  - Notes (executed 2026-11-15; **checkbox left open because full `bun run check` timed out / failed on pre-existing D6/G1 load-sensitive tests**):
    - Added optional `limits?: ValidateTreeOptions["limits"]` to `SurfaceCoreOptions` (`src/surface/core.ts`), read on every arrival in `accept` and forwarded to `validator.validateTree(input, limits !== undefined ? { limits } : undefined)` (zero extra allocation when `limits` is omitted), and contained the first `facts()` lookup inside `accept` so an unreadable validator returns `{ ok: false, errors: UNKNOWN_VALIDATOR }` (`catalog-mismatch` at `/validator`) and emits `arrival-rejected` instead of throwing.
    - Added optional `limits?: ValidateTreeOptions["limits"]` to `SurfaceProps` (`src/react/renderer.tsx`), wired through the `host` ref (`host.current.limits = limits` synced before `core.accept(tree)` as well as in `useLayoutEffect`, because `core.accept` runs during render before `useLayoutEffect`). Left `src/preview/react/preview.tsx` unchanged (`<Preview>` receives no session or `limits`).
    - Registered `SurfaceCoreOptions` (`./surface`, `widened`) and `createRenderer` (`./react`, `widened`) in `scripts/release/api/register-0.3.1.json`.
    - Updated `docs/spec.md` §11 (`createSurfaceCore`, `core.accept`, `<Surface>`), `docs/renderer.md` ("Build a renderer and mount a surface"), and `CHANGELOG.md` (`## Unreleased` -> `Fixed:`).
    - Added `surface_accepts_a_tree_within_raised_limits`, `surface_reads_limits_when_a_tree_arrives`, and `unreadable_validator_draws_the_fallback` in `src/__tests__/surface-core.test.ts`; `surface_limits_prop_reaches_the_core` and `unreadable_validator_draws_the_fallback_in_surface` in `src/__tests__/react-surface.test.tsx`; and `surface_reads_updated_limits_without_resetting_the_core` in `src/__tests__/react-browser.test.tsx` + `src/__tests__/fixtures/react-client.tsx` (verified the first 5 failed before the fix).
    - **Findings affecting later tasks (Task 9 / G1):** `src/__tests__/react-browser.test.tsx:689` (`switch_under_budget_with_blur_through_surface`) uses `toBeLessThanOrEqual(16.67)` on a wall-clock measurement (`44.10 ms` vs `16.67` under host load 24–30); added it to Task 9's file list.
    - `bun run build`, `bun run gen:check`, `bun run typecheck`, `bun run lint`, `bun run format:check`, `src/__tests__/surface-core.test.ts` (35/35), `src/__tests__/react-surface.test.tsx` (13/13), `src/__tests__/react-catalogs.test.tsx` (8/8), `src/__tests__/renderer-guide.test.tsx` (1/1), `src/__tests__/api-stability.test.ts` (16/16), `src/__tests__/exports.test.ts` (22/22), `src/__tests__/docs-links.test.ts` (2/2), and `src/__tests__/acceptance-script.test.ts` (2/2 with `--timeout 15000`) all passed. In `src/__tests__/react-browser.test.tsx` (`--timeout 15000`), 40/41 passed (including `surface_reads_updated_limits_without_resetting_the_core`), failing only pre-existing G1 `switch_under_budget_with_blur_through_surface` (`44.10 ms` vs `<= 16.67`). In `src/__tests__/docs-wording.test.ts`, `wording_check_matches_export_names_in_the_same_sentence` passed and `shipped_docs_never_call_exports_planned` passed `expect(stale).toEqual([])`, failing only its G1 wall-clock check (`637.64 ms` vs `< 200`). Under host load average `24.3–30.1`, `bench/render.bench.ts` failed its timing budgets and `bench/selection.bench.ts` passed `focus_continuity_selection_cost_is_recorded_in_production` while failing `selection_rerender_cost_is_recorded_in_production` on pre-existing D6 (`Render exceeded 100 ms`).
    - Full `timeout 600 bun run check` passed `build`, `gen:check`, `typecheck`, `lint`, and `format:check`, then hit pre-existing G1/D6 failures in `proof/tests/` (`switch.test.ts:166`, `conformance.test.ts` 5000 ms timeout, `mcp-capture.test.ts` `Render exceeded 100 ms`) and was terminated at the 600 s timeout. Re-check after Tasks 7 and 9 or on a quiet host before ticking.

- [x] Task 7: Start the worker runner's render timeout when the worker is ready (D6)
  - Acceptance Criteria:
    - Functional:
      - The worker entry posts `{ type: "ready" }` once it has loaded. A render's timer starts when its request is posted to a ready worker.
      - A worker that is not ready within `startTimeoutMs` (default 5,000) is terminated and the render is `render-failed` with "Worker did not start". It is not `limit-exceeded`: no widget ran.
      - After a `limit-exceeded` recycle, the next render's timeout again excludes boot.
      - Spec §7.5 and `docs/preview.md` state what the timeout measures.
    - Performance: a warm render posts exactly the messages it posts today; `bench/runner.bench.ts` worker rows do not regress.
    - Code Quality: the handshake stays inside `src/preview/worker/`; `WorkerMessage` gains one variant. The test seam is not part of `workerRunner`'s public declaration.
    - Security: law 1 is untouched. A result is still accepted only for the pending id and only after host validation (`src/preview/worker/index.ts:117-133`); a `ready` from a worker that is not current is ignored.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/preview.md`.
      - `find-docs` — Bun's `Worker` lifecycle events.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2+ (`engines`): `Worker` `message`, `error` and `close` events, and whether a module worker's top-level code can post before the parent attaches `onmessage`.
    - Documentation Reviewed:
      - Spec §7.5; `src/preview/worker/index.ts:144-213`; `src/preview/worker/entry.ts`; `src/preview/worker/protocol.ts`; `packages/runner-quickjs/src/index.ts:80-117` (the QuickJS runner's `ready`); the 2026-11-15 measurement (cold start 36 ms median, 52 ms max of a 100 ms default; `package_guide_example_runs` failed with `Render exceeded 100 ms` under load).
    - Options Considered:
      - Raise the default timeout — rejected: it hides the boot cost inside every render's budget and still fails on a slower machine.
      - Keep one warm spare worker — rejected: a second process's memory to hide a cost a handshake removes.
    - Chosen Approach:
      - A `ready` handshake, as the QuickJS runner already uses, and a separate start bound so a worker that never loads cannot hang a render.
    - API Notes and Examples:
      ```ts
      workerRunner({ timeoutMs: 100, startTimeoutMs: 5000 });
      // protocol: { type: "ready" } | { type: "configure", … } | { type: "render", … } | { type: "result", … }
      ```
    - Files to Create/Edit:
      - `src/preview/worker/protocol.ts`: the `ready` message.
      - `src/preview/worker/entry.ts`: post `ready` after its imports.
      - `src/preview/worker/index.ts`: wait for `ready`; start the render timer on post; `startTimeoutMs`.
      - `scripts/release/api/register-0.3.1.json`: `widened` for the options type.
      - `src/__tests__/runner-worker.test.ts`: the tests below, through an internal spawn seam (tentative — if the seam cannot stay off the public declaration, drive the same cases with a worker script that delays its `ready`).
      - `docs/spec.md` §7.5; `docs/preview.md`; `docs/mcp.md` (the default runner); `CHANGELOG.md`.
  - Test Cases to Write:
    - `slow_worker_boot_does_not_count_against_the_render_timeout`: a worker whose `ready` arrives after 3× `timeoutMs` still renders. Fails today.
    - `worker_that_never_starts_is_render_failed`: no `ready` within `startTimeoutMs` gives `render-failed`, and the next render starts a new worker.
    - `render_after_a_timeout_recycle_gets_a_full_budget`: a hung widget, then a trivial one on the recycled worker.
    - `ready_from_a_replaced_worker_is_ignored`.
  - Notes (executed 2026-11-15; **checkbox left open because full `bun run check` timed out / failed on pre-existing G1 and load-sensitive tests**):
    - Added `{ type: "ready" }` to `WorkerMessage` (`src/preview/worker/protocol.ts`) and posted `{ type: "ready" }` at the end of `src/preview/worker/entry.ts` after `self.onmessage` is installed.
    - Moved the worker runner state machine into internal `src/preview/worker/runner.ts` (`createWorkerRunner(defaults, spawn)`), leaving `src/preview/worker/index.ts` exporting only `workerRunner(defaults?: { timeoutMs?: number; maxPackages?: number; startTimeoutMs?: number })` with no test seam in its public declaration.
    - `createWorkerRunner` waits for `{ type: "ready" }` from a newly spawned or recycled worker (bounded separately by `startTimeoutMs`, default 5,000 ms; failing with `render-failed` `"Worker did not start"` and terminating the worker), starts `timeoutMs` only when posting `render` to a ready worker, ignores `ready` from non-current workers or after the current worker is ready, rejects unsolicited `result` messages received before `render` is posted, wraps async `postRender` in `try/catch` (for `DataCloneError` on cold starts), and clears active timers in `settle`/`recycle`. Warm renders post only `configure` (when changed) and `render`.
    - Registered `./preview/worker` `workerRunner` (`widened`) in `scripts/release/api/register-0.3.1.json`.
    - Updated `docs/spec.md` §7.5, `docs/preview.md`, `docs/packages.md`, `docs/mcp.md`, and `CHANGELOG.md` (`## Unreleased` -> `Fixed:`).
    - Added `slow_worker_boot_does_not_count_against_the_render_timeout`, `worker_that_never_starts_is_render_failed`, `render_after_a_timeout_recycle_gets_a_full_budget`, and `ready_from_a_replaced_worker_is_ignored` in `src/__tests__/runner-worker.test.ts` using `createWorkerRunner`'s internal `spawn` seam.
    - `bun run build`, `bun run gen:check`, `bun run typecheck`, `bun run lint`, `bun run format:check`, `src/__tests__/runner-worker.test.ts` (21/21 with `--timeout 15000`), `src/__tests__/api-stability.test.ts` (16/16), `src/__tests__/exports.test.ts` (22/22), `src/__tests__/portability.test.ts` (19/19), `src/__tests__/archive.test.ts` (6/6), `src/__tests__/conformance-runner.test.ts` (4/4), `src/__tests__/docs-links.test.ts` (2/2), `src/__tests__/acceptance-script.test.ts` (2/2), and `src/__tests__/preview-libraries.test.ts` (7/7) all passed. In `src/__tests__/docs-wording.test.ts`, `wording_check_matches_export_names_in_the_same_sentence` passed and `shipped_docs_never_call_exports_planned` passed `expect(stale).toEqual([])`, failing only its G1 wall-clock check (`4449.46 ms` vs `< 200`). In `bench/runner.bench.ts` (under host load average `29.47`), `workerRunner` warm medians were `54.106 ms` (`agent-home`) and `1.114 ms` (`smallest`), while `quickjs` rows exceeded their budgets under load.
    - Full `timeout 600 bun run check` passed `build`, `gen:check`, `typecheck`, `lint`, and `format:check`, then hit pre-existing G1/load-sensitive failures (`proof/tests/switch.test.ts:166`, `proof/tests/agent-home.test.ts` / `preview-browser.test.ts` / `mcp-capture.test.ts` `Render exceeded 100 ms` under host load `26.88–34.95`, `proof/tests/conformance.test.ts` 5000 ms timeout) and was terminated at the 600 s timeout. Re-check full `bun run check` after Task 9 or on a quiet host before ticking.

- [x] Task 8: Contain a host `onIntent` that throws synchronously (D7)
  - Acceptance Criteria:
    - Functional:
      - On the path without confirmation, a synchronous throw from `onIntent` is contained: `emit` returns `undefined` and nothing reaches the primitive's handler. The confirmed path already does this (`src/surface/core.ts:285-289`).
      - A `carries` mismatch still throws from `emit`: that is the implementation's bug, not the host's.
      - Spec §11 `emit` reads "a rejection or a throw is contained".
    - Performance: one `try` on the emit path; no allocation.
    - Code Quality: the change is inside `raise`; `settled` is unchanged.
    - Security: n/a — no authority or validation path changes.
  - Approach:
    - Skills to Use:
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - none; read `src/surface/core.ts:166-176`, `:258-291`.
    - Documentation Reviewed:
      - Spec §11 (`emit`: "The promise carries neither the host's value nor its rejection"); `src/__tests__/react-intents.test.tsx`.
    - Options Considered:
      - Leave the throw and document it — rejected: the two paths of one function disagree, and the confirmed path is the one the spec describes.
      - Add an `intent-failed` surface event — rejected for 0.3.x: `SurfaceEvent`'s set grows in a minor release (spec §11); listed for the owner in Task 1's table notes if wanted for 0.4.0.
    - Chosen Approach:
      - Contain it, matching the confirmed path.
    - API Notes and Examples:
      ```ts
      try { return settled(onIntent(intent, origin)); } catch { return undefined; }
      ```
    - Files to Create/Edit:
      - `src/surface/core.ts`: `raise`.
      - `src/__tests__/surface-core.test.ts`: the tests below.
      - `docs/spec.md` §11; `CHANGELOG.md`.
  - Test Cases to Write:
    - `sync_throw_from_on_intent_is_contained`: `emit` returns `undefined`. Fails today.
    - `carries_mismatch_still_throws`: an invalid event value still throws `Invalid event value`.
  - Notes (executed 2026-11-15; **checkbox left open because full `bun run check` timed out / failed on pre-existing G1 and load-sensitive tests**):
    - Wrapped `settled(onIntent(intent, origin))` on the unconfirmed path of `raise` in `src/surface/core.ts` in `try { ... } catch { return undefined; }`, leaving `settled` and `carries` / `local` schema rejection throws unchanged.
    - Updated `docs/spec.md` §11 (`emit`: "a rejection or a throw is contained") and added a `Fixed:` entry under `## Unreleased` in `CHANGELOG.md`.
    - Added `sync_throw_from_on_intent_is_contained` (verified failing with `host boom` before the fix and passing after) and `carries_mismatch_still_throws` in `src/__tests__/surface-core.test.ts`.
    - `bun run build`, `bun run gen:check`, `bun run typecheck`, `bun run lint`, `bun run format:check`, `src/__tests__/surface-core.test.ts` (37/37), `src/__tests__/react-intents.test.tsx` (14/14), `src/__tests__/react-surface.test.tsx` (13/13), `src/__tests__/surface-dom-parity.test.ts` (2/2), `src/__tests__/api-stability.test.ts` (16/16), `src/__tests__/docs-links.test.ts` (2/2), and `src/__tests__/acceptance-script.test.ts` (2/2 with `--timeout 15000`) all passed. In `src/__tests__/docs-wording.test.ts`, `wording_check_matches_export_names_in_the_same_sentence` passed and `shipped_docs_never_call_exports_planned` passed `expect(stale).toEqual([])`, failing only its pre-existing G1 wall-clock check (`215.48 ms` / `353.44 ms` vs `< 200`).
    - Full `timeout 600 bun run check` passed `build`, `gen:check`, `typecheck`, `lint`, and `format:check`, then hit pre-existing G1 / load-sensitive failures under host load average `12.08–21.34` (`proof/tests/switch.test.ts`, `proof/tests/conformance.test.ts`, `proof/tests/mcp-capture.test.ts` `Render exceeded 100 ms`) and was terminated at the 600 s timeout. Re-check full `bun run check` after Task 9 or on a quiet host before ticking.

- [x] Task 9: Take wall-clock assertions out of `bun run check` (G1)
  - Acceptance Criteria:
    - Functional:
      - No test run by `bun run check` fails only because elapsed wall time crossed a number. Twenty-three such assertions were found on 2026-11-15: thirteen that compare a named duration (`grep -rn "toBeLessThan(" src/__tests__ proof/tests packages/*/src/__tests__`, the lines whose argument is a duration) and ten written inline (`grep -rnE "expect\(.*performance\.now\(\).*\)\.toBeLess"`). Each is either moved to the bench that owns the budget or rewritten as a structural assertion. One of them, `src/__tests__/docs-wording.test.ts:48`, failed at 202.80 ms against 200 while this plan was being written.
      - A complexity guard that compares two measurements from the same run (`src/__tests__/sdk-stream.test.ts:335`) may stay, with a comment that says what the ratio protects.
      - Every moved budget is enforced by `bun run bench` (CI runs it: `.github/workflows/ci.yml:59`) through `bench/metrics.ts`'s `budget()`, measured in CPU time where the bench already does (`bench/host.bench.ts:86`).
    - Performance: every budget that existed still exists, in a bench.
    - Code Quality: no new timing helper; reuse `bench/metrics.ts` and `bench/ab.ts`.
    - Security: the linear-time guards that protect against hostile input (`catalog.test.ts:272`, `schema.test.ts:205`, `vocabulary.test.ts:134`, `manifest.test.ts:423`) keep a test: each becomes an operation-count or size-ratio assertion, so a regression to superlinear work still fails `bun run check`.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — the testing rules in `AGENTS.md`.
      - `safe-refactor` — each moved assertion keeps its proof.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2+: `bun:test` timeouts and `process.cpuUsage()` as used in `bench/host.bench.ts`.
    - Documentation Reviewed:
      - `roadmap.md` §1 ("Budgets on realistic sizes"); `plans/backlog.md` "Identify the intermittent full-check failure seen in plan 018 Task 6" and "Re-run the full benchmark suite on a quiet host"; the 2026-11-15 baseline (three timing tests failed at load average 12; alone, `verify_agent_home_under_20_ms` still failed one run in three).
    - Options Considered:
      - Retry timing tests — rejected: a retry hides the same nondeterminism and lengthens the gate.
      - Widen each bound — rejected: a bound wide enough for a loaded CI runner no longer catches a regression.
    - Chosen Approach:
      - Budgets live in benches; the unit gate asserts structure.
    - API Notes and Examples:
      ```ts
      // bench: budget(cpuMs <= 20, `agent-home verifyPackage ${cpuMs.toFixed(2)} ms exceeds 20 ms`);
      // test:  expect(walked).toBeLessThanOrEqual(nodes * 2); // linear, counted, not timed
      ```
    - Files to Create/Edit:
      - `src/__tests__/pack.test.ts`, `pack-hash.test.ts`, `runner-in-process.test.ts`, `validator-node.test.ts`, `validator-smoke.test.ts:18` (found during Task 2: uses `toBeLessThanOrEqual(5)`), `template-document.test.ts:49` (found during Task 5: uses `toBeLessThan(5)`), `css-scope-browser.test.ts:295`, `:314` (found during Task 5: use `toBeLessThanOrEqual(16.67)`), `react-browser.test.tsx:689` (found during Task 6: uses `toBeLessThanOrEqual(16.67)`), `catalog.test.ts`, `schema.test.ts`, `vocabulary.test.ts`, `manifest.test.ts`: remove or rewrite the timed assertions.
      - `proof/tests/host.test.ts:240`, `proof/tests/switch.test.ts:166`, `packages/starter/src/__tests__/switch.test.tsx:102` (found during Task 1: uses `toBeLessThanOrEqual(16.67)`), `packages/runner-quickjs/src/__tests__/runner.test.ts:89`: the same.
      - `src/__tests__/design-system.test.ts:315`, `phase-2-loop.test.ts:219`, `pack-bundle.test.ts:44`, `docs-wording.test.ts:48`, `url.test.ts:190`, `format-schema-differential.test.ts:44`, `manifest.test.ts:328`, `template-expr.test.ts:452`, `runner-worker.test.ts:79`, `theme.test.ts:218`: the inline ones. Where the bound guards against a hang (`runner-worker.test.ts:79`, `phase-2-loop.test.ts:219`), use the test's own timeout instead of an assertion.
      - `bench/host.bench.ts`, `bench/hash.bench.ts`, `bench/runner.bench.ts`, `bench/css.bench.ts`, `bench/validator.bench.ts`: receive the budgets.
      - `plans/backlog.md`: close or update "Identify the intermittent full-check failure seen in plan 018 Task 6".
  - Test Cases to Write:
    - `no_wall_clock_assertions_in_the_gate`: scans the test directories for a `performance.now()` difference passed to `toBeLessThan` and allows only the listed same-run ratio guards. Fails when a new timed assertion is added.
    - One structural test per rewritten guard, named after the property (`catalog_change_classification_is_linear`, …): fails when the counted work grows faster than the input.
  - Notes (executed 2026-11-15):
    - Removed every elapsed wall-clock assertion from `bun run check` across `src/__tests__/`, `proof/tests/`, and `packages/*/src/__tests__/`, leaving only the two same-run ratio complexity guards (`src/__tests__/compiled-schema.test.ts:200`, `src/__tests__/sdk-stream.test.ts:335`, both commented):
      - Rewrote linear-time security guards as Proxy read-count / structural checks: `src/__tests__/catalog.test.ts` (`catalog_validation_is_linear`), `vocabulary.test.ts` (`vocabulary_validation_is_linear`), `schema.test.ts` (`check_value_walks_1000_mixed_properties_linearly`), `manifest.test.ts` (`agent_home_manifest_validates_linearly`, `redos_manifest_rejects_before_matching`), `url.test.ts` (`url_pattern_is_linear`), `template-expr.test.ts` (`nested_loops_hit_fuel_not_the_clock`), `template-document.test.ts` (`install_validation_of_agent_home_within_budget`), and `host-dependents.test.ts` (`dependents_linear_scale`).
      - Replaced hang/timeout wall-clock assertions with `bun:test` per-test timeouts: `src/__tests__/runner-in-process.test.ts`, `runner-worker.test.ts`, `phase-2-loop.test.ts`, and `packages/runner-quickjs/src/__tests__/runner.test.ts` (`2000`/`5000` ms test timeouts), and replaced remaining `timeoutMs: 100` defaults and `5000`/`20000` ms test timeouts on non-timeout correctness tests under heavy CPU load in `src/__tests__/template-package.test.ts`, `runner-in-process.test.ts`, `preview-session.test.ts`, `session-limits.test.ts`, `template-authoring.test.ts`, `format-schema-differential.test.ts`, `runner-worker.test.ts`, `acceptance-script.test.ts`, `packages/runner-quickjs/src/__tests__/runner.test.ts`, `proof/host/pages.ts`, `proof/tests/mcp-capture.test.ts`, `proof/tests/host.test.ts`, `proof/tests/styles.test.ts`, `proof/tests/fixtures/mcp-loop.config.ts`, and `proof/tests/fixtures/mcp-preview-close.config.ts`. Split two >160-word paragraphs added earlier in `docs/spec.md` so `docs-spec-structure.test.ts` (`spec_paragraphs_stay_short`) passes.
      - Converted or pruned redundant timed unit tests (`pack.test.ts`, `pack-hash.test.ts`, `pack-bundle.test.ts`, `validator-smoke.test.ts`, `validator-node.test.ts`, `sdk-smoke.test.ts`, `design-system.test.ts`, `theme.test.ts`, `docs-wording.test.ts`, `format-schema-differential.test.ts`, `css-scope-browser.test.ts`, `react-browser.test.tsx`, `proof/tests/host.test.ts`, `proof/tests/switch.test.ts`, `proof/tests/renderer-browser.test.tsx`, `packages/starter/src/__tests__/switch.test.tsx`). Updated `plans/evidence/032-acceptance-map.json` (`031.T6.P1` doc target -> `bench/css.bench.ts :: 16.67`).
      - Added `src/__tests__/no-wall-clock-gate.test.ts` (`no_wall_clock_assertions_in_the_gate`) using `Bun.Transpiler` + `acorn` AST checks to fail if any new timed assertion enters `src/__tests__`, `proof/tests`, or `packages/*/src/__tests__` outside the ratio-guard allowlist.
      - Moved every performance budget into `bench/` using `budget()` (and `process.cpuUsage()` for CPU-time checks) and wired `bench/hash.bench.ts` + `bench/selection.bench.ts` into `package.json` `scripts.bench`: `bench/host.bench.ts` (`dependents <= 20 ms`, HTTP `setState` round-trip `<= 50 ms`), `bench/hash.bench.ts` (`packageHash` 1 MiB `<= 50 ms`, `verifyPackage` agent-home `<= 20 ms`, `bundle` agent-home `<= 100 ms`), `bench/runner.bench.ts` (`inProcessRunner` CPU overhead `<= 0.1 ms`), `bench/validator.bench.ts` (first compile `<= 20 ms`, catalog `<= 5 ms`, vocabulary `<= 1 ms`, manifest `<= 2 ms`), `bench/template.bench.ts` (`validateTemplate <= 5 ms`), `bench/css.bench.ts` (`validateTheme <= 2 ms`, `rack` validate+resolve `<= 50 ms`, browser switch `<= 16.67 ms` when `--runs` is omitted), and `bench/selection.bench.ts` (`liveFilter <= 4 ms`).
      - Closed `"Identify the intermittent full-check failure seen in plan 018 Task 6"` in `plans/backlog.md`.
      - Verified: full `bun run check` passed (`build`, `gen:check`, `typecheck`, `lint`, `format:check`, `1790 pass, 4 skip, 0 fail` across 162 test files). Under `--json` on this throttled dev host (boost disabled, 48% CPU scaling, load avg 17–52), individual moved CPU budgets reported `bench/validator.bench.ts` (`compile first 1.979 ms`, `catalog 1.021 ms`, `vocabulary 0.049 ms`, `manifest 0.042 ms`), `bench/hash.bench.ts` (`packageHash 1MiB 30.142 ms`, `bundle 49.295 ms`, `verifyPackage 50.405 ms` vs `20 ms`), `bench/runner.bench.ts` (`inProcess overhead 0.0604 ms`), `bench/host.bench.ts` (`dependents 0.161 ms`, `httpSetState 6.899 ms`), `bench/template.bench.ts` (`validateTemplate 7.952 ms` vs `5 ms`), and `bench/css.bench.ts` (`certifiedTheme 0.181 ms`, `rackTheme 0.200 ms`, `rack 24.571 ms`, switches `12.2–21.5 ms`). Full `bun run bench` exited on `bench/validator.bench.ts` (`diffTrees 1.7652 ms > 1.5 ms`) due to that machine throttling.

- [x] Task 10: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: `plans/evidence/033-impact-analysis.md` records each of the twelve impact areas in `references/liveframe.md` §5, or `None — <reason>`. Every finding is listed, shown to the owner in one table with a recommended disposition, and its answer recorded. `execute` findings become tasks above this one; `backlog` findings go to `plans/backlog.md` and Further Actions.
    - Performance: the sweep names the bench rows that moved in Tasks 2–9.
    - Code Quality: no code changes in this task unless a finding is disposed `execute`.
    - Security: the sweep states, for each of the four laws, which task touched it and which test holds it.
  - Approach:
    - Skills to Use:
      - `create-plan` — "Final task: impact analysis".
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `references/liveframe.md` §5; `plans/evidence/032-impact-analysis.md` (the format).
    - Options Considered:
      - Fold the sweep into each task — rejected: cross-task effects (the register, the docs set) only show at the end.
    - Chosen Approach:
      - One sweep after Task 9.
    - API Notes and Examples:
      ```bash
      bun run check && bun run bench
      ```
    - Files to Create/Edit:
      - `plans/evidence/033-impact-analysis.md`; `plans/backlog.md`; `roadmap.md` §3; this plan's Compromises Made and Further Actions.
  - Test Cases to Write:
    - none new; the sweep cites the tests of Tasks 1–9.
  - Notes (executed 2026-11-16):
    - Wrote `plans/evidence/033-impact-analysis.md` sweeping all twelve impact areas in `.agents/skills/create-plan/references/liveframe.md` §5, recording the per-law task and test matrix, naming every benchmark row added or updated in Tasks 2–9, and presenting findings `F1`–`F6` to the owner. The owner confirmed: **execute F1, F2, F3, F4; backlog F5, F6 (P4)**.
    - **Executed findings:**
      - **F1:** Forwarded `args.runOptions?.limits` to `validator.validateTree` in `renderPlacement` step R9 (`src/host/render.ts:132-140, 266`); added `render_placement_forwards_run_options_limits_to_host_validation` in `src/__tests__/host-render.test.ts` (verified failing before the fix and passing after); updated `docs/spec.md` §7.7 R9 and `CHANGELOG.md`.
      - **F2:** Updated `examples/demo-host/server.ts:339-342` so `/api/placements/:id/intent` stores `if (handled.actions) results.set(id, handled.actions);` when `handleIntent` returns `{ ok: false, errors, actions }`.
      - **F3:** Updated `.agents/skills/liveframe-execution/references/preview.md:15,29,31` (`workerRunner({ timeoutMs?, maxPackages?, startTimeoutMs? })`, `ready` handshake excluding boot from `timeoutMs`, and `<Preview limits>`) and fixed the flag order in this plan's Verification section (`bun test --conditions liveframe:source ...`).
      - **F4:** Added optional `limits?: ComponentProps<ReturnType<typeof createRenderer>["Surface"]>["limits"]` to `PreviewProps` and forwarded `limits={limits}` to each cell's `<Surface>` in `src/preview/react/preview.tsx`; registered `PreviewProps` and `Preview` (`widened` under `./preview/react`) in `scripts/release/api/register-0.3.1.json`; added `preview_forwards_limits_to_surface_cells` in `src/__tests__/preview-react.test.tsx`; updated `docs/spec.md` §7.5, `docs/preview.md` and `CHANGELOG.md`.
    - **Backlogged findings:** Added **F5** ("Do not carry a prior render's `patch`, `reset` or `migrated` on a skipped `renderPlacement`", P4) and **F6** ("Report a thrown or rejected `onIntent` through `SurfaceEvent`", P4) to `plans/backlog.md` and `## Further Actions`.
    - **Verification:** `bun run check` passed (`build`, `gen:check`, `typecheck`, `lint`, `format:check`, `1792 pass, 4 skip, 0 fail`); `LIVEFRAME_BROWSER=webkit` and `LIVEFRAME_BROWSER=firefox` on `src/__tests__/react-browser.test.tsx` passed (41/41 each); `bun run demo:test` passed (67/67); `bun run guide:test` passed.

## Verification (whole plan)

- `bun run check`
- `bun test --conditions liveframe:source src/__tests__/host-render.test.ts src/__tests__/host-intent.test.ts src/__tests__/host-guide.test.ts src/__tests__/surface-core.test.ts src/__tests__/runner-worker.test.ts src/__tests__/api-stability.test.ts`
- `bun run bench`
- `bun run guide:test`
- `LIVEFRAME_BROWSER=webkit bun run test` and `LIVEFRAME_BROWSER=firefox bun run test`

## Compromises Made

- **Skipped `renderPlacement` still returns `previous` by identity with its old `patch`, `reset` and `migrated` (Task 3, F5).** Keeping `result.value === previous` preserves the `0.3.x` patch contract (`src/__tests__/host-render.test.ts:111`), and `docs/host.md` + `docs/spec.md` §7.7 R6 now require the `result.value !== previous` check before sending a frame; removing stale per-render fields from a skipped return value is deferred to `0.4.0` (P4).
- **Contained `onIntent` throws and rejections emit no `SurfaceEvent` (Task 8, F6).** Both the confirmed and unconfirmed (`emit`) paths contain a synchronous throw or async rejection from `onIntent` without raising an observability event because `SurfaceEvent` is a closed discriminated union in `0.3.x` (`docs/spec.md` §11); adding an `intent-failed` variant is deferred to `0.4.0` (P4).
- **Validator facts remain in six module-level `WeakMap`s until Plan 036 Task 1 (Task 6, A1).** Task 6 makes `core.accept` fail closed (`catalog-mismatch` at `/validator` with `arrival-rejected`) when `validatorFacts(validator)` is unreadable; consolidating the six `WeakMap`s into one table is Plan 036 Task 1.
- **Full `bun run bench` was not proved on an unthrottled quiet host (Task 9).** All wall-clock assertions were moved out of `bun run check` into `bench/*.bench.ts` with `budget()`, making `bun run check` deterministic under load (`1792 pass, 4 skip, 0 fail`), while on this throttled dev machine (CPU boost disabled, 48% scaling, load average 10–52) `bun run bench` still requires the quiet-host run tracked in the backlog.

## Further Actions

All are in `plans/backlog.md` with this plan as their source:

- **P4 — Do not carry a prior render's `patch`, `reset` or `migrated` on a skipped `renderPlacement` (`0.4.0`, F5).** Strip per-render fields or return a distinct skipped shape in `0.4.0` so a host that forgets `result.value !== previous` cannot resend an already-applied patch.
- **P4 — Report a thrown or rejected `onIntent` through `SurfaceEvent` (`0.4.0`, F6).** Consider adding `{ type: "intent-failed"; nodeId: string; event: string }` to `SurfaceEvent` in `0.4.0` so `onEvent` can observe `onIntent` failures alongside `emit-rejected` and `confirm-dropped`.
