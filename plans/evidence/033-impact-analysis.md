# Plan 033 — Architectural Impact Analysis (`0.3.1` Review Defects and Release Scope)

Date: 2026-11-16
Plan: [`plans/033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md`](../033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md)
Decision log: [`decision-logs/2026-11-15-1251-review-2026-11-15-scope.md`](../../decision-logs/2026-11-15-1251-review-2026-11-15-scope.md)
Review disposition register: [`plans/evidence/033-review-findings.md`](033-review-findings.md)

This document sweeps the twelve impact areas in `.agents/skills/create-plan/references/liveframe.md` §5 across Tasks 1–9 of Plan 033 and records the owner-approved disposition of every finding (`F1`–`F6`).

---

## 1. The Twelve Impact Areas

### 1. Spec (`docs/spec.md`)

- **§7.5 (Runners and preview, `:961-963`, `:988`):** Updated for Task 7 (D6) and Task 10 (F4). `workerRunner({ timeoutMs?, maxPackages?, startTimeoutMs? })` waits for `{ type: "ready" }` from the worker entry before starting `timeoutMs` (default 100 ms); a worker that is not ready within `startTimeoutMs` (default 5,000 ms) is terminated and fails with `render-failed` ("Worker did not start"), a `ready` from a replaced worker is ignored, and an unsolicited result before a render is posted terminates the worker. `<Preview>` documents its optional `limits` prop forwarded to each cell's `<Surface>` (F4).
- **§7.7 (The host pipeline, `:1137`, `:1141`):**
  - R6 (`:1137`): Explicitly states that when `renderPlacement` skips a render, the returned `previous` still carries the `patch` that produced it, and a host sends nothing for a skipped render (Task 3, D2).
  - R7 (`:1137`): With `previous`, the revision is `max(revision ?? 0, previous.revision + 1)`, and without `previous` it is `revision ?? 1` (Task 2, D1).
  - R9 (`:1137`): Host `validateTree` runs with `runOptions.limits` when supplied (Task 10, F1).
  - H9 (`:1141`): A failed re-render after a recorded action outcome or refusal returns `{ ok: false, errors, actions }`, so the host stores `actions` while its `served` frame stays unchanged; failures before any status is recorded carry no `actions` (Task 4, D3).
- **§11 (Renderer contract, `:1584`, `:1595`, `:1597`):**
  - Arrival (`:1584`, `:1597`): `createSurfaceCore({ ..., limits? })` and `<Surface limits={…}>` pass `ValidateTreeOptions["limits"]` to `validator.validateTree` on each arrival (`limits` read without resetting the core), a stale arrival for the current `surfaceId` after a rejected arrival keeps `snapshot().valid` false and returns the rejection's `errors` (Task 5, D4), and a validator whose compiled facts cannot be read returns `catalog-mismatch` at `/validator` and emits `arrival-rejected` instead of throwing (Task 6, D5/A1).
  - Events (`:1595`): A synchronous throw from `onIntent` on the unconfirmed path is contained like a throw or rejection on the confirmed path, while `carries` and `local` schema mismatches still throw `Invalid event value` (Task 8, D7).
- **Structural gate:** `src/__tests__/docs-spec-structure.test.ts` (`spec_paragraphs_stay_short`, `spec_headings_match_structure`) passes.

### 2. Public API and Formats (`exports`, `.d.ts`, schemas, wire formats)

- **Baseline and register (Task 1, Task 10):** `scripts/release/api/baseline-0.3.0.json` freezes the 18 subpaths of `@arnilo/liveframe@0.3.0` (`v0.3.0` tag) alongside the existing companion baselines. `scripts/release/api/register-0.3.1.json` records the six additive `0.3.1` entries (`HandleResult` `added` and `handleIntent` `widened` on `./host`; `SurfaceCoreOptions` `widened` on `./surface`; `createRenderer` `widened` on `./react`; `workerRunner` `widened` on `./preview/worker`; `PreviewProps` and `Preview` `widened` on `./preview/react` from F4).
- **Gate (`src/__tests__/api-stability.test.ts`):** `register_0_3_1_holds_only_additive_entries` enforces that `0.3.1` contains only `added` and `widened` entries (`breaking: false`), and `baseline_0_3_0_matches_the_checkout_through_the_0_3_1_register` + `baseline_0_3_0_matches_the_companion_packages` pass with zero unregistered diffs.
- **Wire formats and JSON Schemas:** Untouched; all format corpus and hash vector tests in `src/__tests__/api-stability.test.ts` pass.
- **Findings:**
  - **F4 (`execute`):** `<Preview>` in `src/preview/react/preview.tsx` lacked the optional `limits` prop added to `<Surface>` in Task 6. Executed in Task 10: `PreviewProps` and `Preview` now accept optional `limits` and forward it to each cell's `<Surface>`.
  - **F5 (`backlog`, P4):** When `renderPlacement` skips at R6, it returns `previous` by identity (`result.value === previous`), which still carries `previous.patch`, `previous.reset` and `previous.migrated`. Changing the skipped return shape or stripping `patch` breaks identity in `0.3.x` and is backlogged for `0.4.0`.

### 3. The Four Laws (Security Criterion)

Every task's interaction with the four architectural laws and the tests holding each law:

| Law | Tasks Touching It | How It Was Touched | Tests Holding It |
|---|---|---|---|
| **Law 1 — Widget code never runs in the browser** | Task 7 (D6) | `workerRunner` (`src/preview/worker/index.ts`, `src/preview/worker/runner.ts`) added the `{ type: "ready" }` startup handshake and `startTimeoutMs`, and rejects any message arriving before a render request is posted (`!active.posted`) by terminating the worker. Browser subpaths (`/surface`, `/react`, `/preview/react`, `/css`) remain free of runner/host imports. | `slow_worker_boot_does_not_count_against_the_render_timeout`, `worker_that_never_starts_is_render_failed`, `ready_from_a_replaced_worker_is_ignored`, `unsolicited_result_terminates_the_worker` (`src/__tests__/runner-worker.test.ts`); `core_has_no_react_or_dom_imports` (`src/__tests__/surface-core.test.ts`); `src/__tests__/portability.test.ts`. |
| **Law 2 — The UI tree is validated data** | Task 2 (D1), Task 5 (D4), Task 6 (D5, A1), Task 7 (D6), Task 10 (F1, F4) | Task 2 keeps `Served.revision` monotonic (`max(revision ?? 0, previous.revision + 1)`) so a revision floor never causes a surface to drop an update as stale. Task 5 keeps `snapshot().valid` false when a stale revision arrives on an invalid surface. Task 6 forwards `limits` to `validator.validateTree` in `/surface` and `/react` and fails closed (`catalog-mismatch` at `/validator`) when `validatorFacts(validator)` is undefined after `validateTree` succeeds. Task 7 keeps host-side tree re-validation on worker results. Task 10 forwards `runOptions.limits` to host `validateTree` in `renderPlacement` step R9 (F1) and forwards `limits` from `<Preview>` to `<Surface>` (F4). | `revision_floor_below_previous_still_advances`, `revision_floor_above_previous_is_used`, `render_placement_forwards_run_options_limits_to_host_validation` (`src/__tests__/host-render.test.ts`); `stale_arrival_keeps_an_invalid_surface_invalid`, `surface_accepts_a_tree_within_raised_limits`, `surface_reads_limits_when_a_tree_arrives`, `unreadable_validator_draws_the_fallback` (`src/__tests__/surface-core.test.ts`); `surface_limits_prop_reaches_the_core`, `unreadable_validator_draws_the_fallback_in_surface` (`src/__tests__/react-surface.test.tsx`); `surface_reads_updated_limits_without_resetting_the_core`, `stale_revision_is_ignored_and_new_surface_replaces` (`src/__tests__/react-browser.test.tsx`); `preview_forwards_limits_to_surface_cells` (`src/__tests__/preview-react.test.tsx`). |
| **Law 3 — Widget code never sets colours or raw CSS** | Task 9 (G1) | No CSS projection or recipe rule changed. Task 9 moved the six 16.67 ms wall-clock browser style-switch budget assertions from `bun run check` into `bench/css.bench.ts` while keeping every structural and computed-style assertion in `check`. | `switch_changes_computed_styles_not_dom_structure` (`proof/tests/switch.test.ts`), `two_surfaces_switch_independently_with_backdrop_blur` (`src/__tests__/css-scope-browser.test.ts`), `theme_and_design_system_switch_leaves_dom_nodes_in_place` (`src/__tests__/react-browser.test.tsx`), `starter_runs_conformance_and_switches_themes` (`packages/starter/src/__tests__/switch.test.tsx`), and `browserSwitch.*.maxMs` (`bench/css.bench.ts`). |
| **Law 4 — A widget never holds authority** | Task 4 (D3), Task 8 (D7), Task 10 (F2) | Task 4 preserves `checkOffered` → `authorize` → `dispatch` ordering in `handleIntent` (`src/host/intent.ts`) and returns `{ ok: false, errors, actions }` when the follow-up render fails after an action outcome or refusal is recorded, without leaking host error text. Task 8 contains synchronous throws from `onIntent` in `emit` (`src/surface/core.ts`) while keeping synchronous throws for `carries`/`local` schema violations. Task 10 updates `examples/demo-host/server.ts` to store `handled.actions` on failure (F2). | `dispatched_action_outcome_survives_a_failed_render`, `refused_action_status_survives_a_failed_render`, `failure_before_any_status_carries_no_actions`, `no_effect_before_check_offered_and_authorize` (`src/__tests__/host-intent.test.ts`); `sync_throw_from_on_intent_is_contained`, `carries_mismatch_still_throws` (`src/__tests__/surface-core.test.ts`). |

### 4. Validation (Install-time, `render()`, Host and Arrival; `LiveframeError` Shapes)

- **Arrival validation (`src/surface/core.ts:276-308`):** `core.accept` passes `options.limits ? { limits: options.limits } : undefined` to `options.validator.validateTree(input, ...)`. When `validatorFacts(options.validator)` is `undefined` after `validateTree` returns `{ ok: true }` (e.g., two copies of `@arnilo/liveframe` in one bundle), `core.accept` fails closed with `[{ kind: "catalog-mismatch", pointer: "/validator", message: "Validator was not compiled by this library" }]`, sets `valid = false`, and emits `arrival-rejected`.
- **Stale arrival on an invalid surface (`src/surface/core.ts:292-302`):** When `state.tree` is present with the same `surfaceId` and a higher revision than `checked.value.revision`, `core.accept` emits `stale-revision` and returns `{ ok: true, value: current }` only when `state.valid` is true; when `state.valid` is false, it returns `{ ok: false, errors: state.errors }` so the surface stays on its fallback.
- **Host validation (`src/host/render.ts:132-140, 266` — Finding F1, `execute`):** `renderPlacement` step R8 passed `args.runOptions` (`{ timeoutMs?, limits? }`) to `runner.render`, but step R9 (`checkTree`) previously called `validator.validateTree(rendered.value)` without `args.runOptions?.limits`. Fixed in Task 10 so step R9 passes `args.runOptions?.limits` to `validator.validateTree`.
- **Preview cell validation (`src/preview/react/preview.tsx:27, 173` — Finding F4, `execute`):** `<Preview>` now accepts optional `limits` and forwards it to `<Surface>`.

### 5. Styling (Catalog Vocabulary, Theme Tokens, Design-System Recipes, Scoped CSS)

- **None —** Tasks 1–8 did not touch `/css`, catalog vocabularies, themes or design-system recipes. Task 9 removed only the `expect(maxMs).toBeLessThanOrEqual(16.67)` wall-clock assertions from the four browser switch tests in `check` and added those six measurements to `bench/css.bench.ts` (`runBrowserSwitchBench`).

### 6. Interaction Tiers (Tier 1 CSS/ARIA, Local State/Bindings, Tier 2 `setState`, Tier 3 `action`)

- **Tier 1 / Local state & bindings / Tier 2 / Tier 3 (`src/surface/core.ts:171-225`):** Task 8 (D7) wrapped the unconfirmed `options.onIntent(built.intent, origin)` call inside `try { Promise.resolve(...).catch(() => undefined); } catch {}` so a synchronous throw from `onIntent` is contained identically to the confirmed path, while `carries` and `local` schema mismatches before `raise` still throw `Invalid event value`.
- **Tier 3 action status across failed renders (`src/host/intent.ts:26-43, 129, 250`, `examples/demo-host/server.ts:339`):** Task 4 (D3) widened `handleIntent`'s failure branch (`HandleResult`) to include `actions?: Actions` whenever `rerender` fails after recording a dispatched action outcome or an offered-action refusal. Finding **F2** (`execute`) updated `examples/demo-host/server.ts:339` to persist `if (handled.actions) results.set(id, handled.actions);` before returning the HTTP error response.
- **Finding F6 (`backlog`, P4):** Neither the confirmed nor the unconfirmed `onIntent` path emits a `SurfaceEvent` when the host's `onIntent` callback throws or rejects, because `SurfaceEvent` is a closed union in `0.3.x` (`docs/spec.md` §11). Backlogged as a P4 `0.4.0` candidate (`intent-failed` event on `SurfaceEvent`).

### 7. Performance (Bench Rows Moved in Tasks 2–9)

Tasks 2–8 added O(1) checks on existing paths (one `Math.max` in `renderPlacement` R7, one optional property carry on `handleIntent` failure, one `state.valid` branch on stale arrival, one optional `limits` pass-through and `WeakMap.get` check in `core.accept`, one `ready` message handshake on worker cold start/recycle, and one `try`/`catch` around `onIntent`). Task 9 (G1) moved every wall-clock assertion out of `bun run check` into `bench/*.bench.ts` and wired the missing benchmark stages into `package.json` `scripts.bench`.

The benchmark rows added or updated in Tasks 2–9 are:

| Bench File | Rows Added / Updated in Plan 033 | Budget |
|---|---|---|
| `bench/validator.bench.ts` | Added `compileValidator.firstCompileCpuMs`, `validateCatalog.cpuMs`, `validateVocabulary.cpuMs`, `validateManifest.cpuMs` | `<= 20 ms`, `<= 5 ms`, `<= 1 ms`, `<= 2 ms` (CPU) |
| `bench/template.bench.ts` | Added `validateTemplate.agentHome.cpuMs` | `<= 5 ms` (CPU) |
| `bench/css.bench.ts` | Added `certifiedThemeValidate.cpuMs`, `rackThemeValidate.cpuMs`, `rackDesignSystemValidateResolve.cpuMs`; added `browserSwitch.certified.maxMs`, `browserSwitch.rack.maxMs`, `browserSwitch.twoSurfaceBlur.maxMs`, `browserSwitch.twoSurfaceTwoAxis.maxMs`, `browserSwitch.surfaceBlur.maxMs`, `browserSwitch.starter.maxMs` (when `--runs` is omitted) | `<= 2 ms`, `<= 2 ms`, `<= 50 ms` (CPU); `<= 16.67 ms` each (wall) |
| `bench/host.bench.ts` | Added `budget(scanned <= 20)` on `host_dependents_1000_ms`; added `host_http_set_state_cpu_ms` | `<= 20 ms` (wall), `<= 50 ms` (CPU) |
| `bench/hash.bench.ts` (wired into `scripts.bench`) | Added `packageHash.1MiB.cpuMs`, `verifyPackage.agentHome.cpuMs`, `bundle.agentHome.cpuMs` | `<= 50 ms`, `<= 20 ms`, `<= 100 ms` (CPU) |
| `bench/selection.bench.ts` (wired into `scripts.bench`) | Added `liveFilter.certified.medianMs` | `<= 4 ms` (wall) |
| `bench/runner.bench.ts` | Added `runner.inProcess.overheadCpuMs` | `<= 0.1 ms` (CPU) |

### 8. Portability (Host-API-Free Core, Runtime Target, Browser Engines)

- **Host-API-free browser/shared subpaths:** `src/__tests__/portability.test.ts` and `core_has_no_react_or_dom_imports` (`src/__tests__/surface-core.test.ts`) pass. `src/surface/core.ts`, `src/react/renderer.tsx`, and `src/preview/react/preview.tsx` import no host APIs.
- **Browser engines (Chromium, WebKit, Firefox):** `src/__tests__/react-browser.test.tsx` (including Task 5's `stale_revision_is_ignored_and_new_surface_replaces` and Task 6's `surface_reads_updated_limits_without_resetting_the_core`) passes in Chromium, WebKit (`LIVEFRAME_BROWSER=webkit`), and Firefox (`LIVEFRAME_BROWSER=firefox`).

### 9. Agent Authoring (Preview, Capture, MCP Server, `liveframe gen`, Determinism)

- **Preview (`<Preview>` in `src/preview/react/preview.tsx`):** Task 10 (F4) adds optional `limits` on `PreviewProps` so a preview page whose backend session (`createPreview({ limits })` / `createAuthoring({ limits })`) raises validation bounds can forward the same bounds to its `<Surface>` cells.
- **MCP server and `liveframe gen`:** Untouched; `bun run gen:check` passes.

### 10. Docs and Examples (`docs/`, `README.md`, `CHANGELOG.md`, Skill References)

- **Shipped docs updated in Tasks 1–10:** `docs/spec.md` (§7.5, §7.7, §11), `docs/host.md` (R6 identity check, R7 revision floor, H9 `handled.actions` on failure), `docs/renderer.md` (`limits` on `<Surface>` and `createSurfaceCore`, fail-closed `/validator` error, contained synchronous `onIntent` throw), `docs/packages.md` (`workerRunner` `startTimeoutMs` and `ready` handshake), `docs/preview.md` (`<Preview limits>`), `CHANGELOG.md` (`## Unreleased`), `roadmap.md` (§3), and `plans/README.md`.
- **Findings:**
  - **F1 (`execute`):** Updated `docs/spec.md` §7.7 R9 and `CHANGELOG.md` alongside `src/host/render.ts`.
  - **F2 (`execute`):** Updated `examples/demo-host/server.ts:339` to match `docs/host.md:117-119`.
  - **F3 (`execute`):** Updated `.agents/skills/liveframe-execution/references/preview.md:15,29,31` (`workerRunner({ timeoutMs?, maxPackages?, startTimeoutMs? })`, `ready` handshake excluding boot from `timeoutMs`, and `<Preview limits>`) and fixed the flag order on line 517 of `plans/033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md` (`bun test --conditions liveframe:source ...`).
- **Gates:** `src/__tests__/docs-links.test.ts`, `src/__tests__/docs-wording.test.ts`, `src/__tests__/docs-spec-structure.test.ts`, `src/__tests__/host-guide.test.ts`, and `bun run guide:test` all pass.

### 11. Conformance (`/conformance`, `/conformance/react`)

- **None —** No conformance suite contract changed in Plan 033. All conformance tests (`conformance-store.test.ts`, `conformance-catalog.test.ts`, `conformance-design-system.test.ts`, `conformance-react-server.test.ts`, `conformance-react-browser.test.ts`, `conformance-runner.test.ts`) pass. Finding **F6** (optional `intent-failed` `SurfaceEvent` in `0.4.0`) is backlogged under P4.

### 12. Reference Hosts (`proof/`, `examples/demo-host`, `packages/starter`)

- **`examples/demo-host/server.ts`:** Finding **F2** (`execute`) updated `/api/placements/:id/intent` (`:339`) so `if (handled.actions) results.set(id, handled.actions);` is stored before returning an error response when the follow-up render fails after a recorded outcome or refusal. `bun run demo:test` passes (67 pass, 0 fail).
- **`proof/` and `packages/starter`:** Task 9 removed only the wall-clock `<= 16.67 ms` assertions from `proof/tests/switch.test.ts`, `proof/tests/phase-2-loop.test.ts`, and `packages/starter/src/__tests__/switch.test.tsx` (moved to `bench/`). All proof and starter tests pass.

---

## 2. Findings and Dispositions

The table below was presented to the owner in Task 10; the owner selected **"(Recommended) Confirm all: execute F1, F2, F3, F4; backlog F5, F6 (P4)"**.

| ID | Area(s) | Finding | Recommended | Owner Decision | Resolution |
|---|---|---|---|---|---|
| **F1** | 3 (Law 2), 4 (Validation), 10 (Docs) | `renderPlacement` step R8 (`src/host/render.ts:122`) forwards `args.runOptions` (`{ timeoutMs?, limits? }`) to `runner.render`, but step R9 (`checkTree`, `src/host/render.ts:132-134, 260`) called `validator.validateTree(rendered.value)` with no options, rejecting trees above 5,000 nodes even when `runOptions.limits` raised the bound. | `execute` | `execute` | Fixed in `src/host/render.ts:132-140, 266`; tested in `render_placement_forwards_run_options_limits_to_host_validation` (`src/__tests__/host-render.test.ts`); documented in `docs/spec.md` §7.7 R9 and `CHANGELOG.md`. |
| **F2** | 6 (Interaction), 10 (Examples), 12 (Reference hosts) | `examples/demo-host/server.ts:339` returned on `!handled.ok` without storing `if (handled.actions) results.set(id, handled.actions);`, dropping action outcomes/refusals when the follow-up render fails (D3). | `execute` | `execute` | Fixed in `examples/demo-host/server.ts:339-342`; verified by `bun run demo:test`. |
| **F3** | 10 (Docs & skill references) | `.agents/skills/liveframe-execution/references/preview.md:29,31` still said `workerRunner({ timeoutMs? })` and `"the deadline includes startup"` after Task 7 (D6); `plans/033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md:517` had `--conditions` before `test`. | `execute` | `execute` | Fixed in `.agents/skills/liveframe-execution/references/preview.md:15,29,31` and `plans/033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md:517`. |
| **F4** | 2 (Public API), 4 (Validation), 9 (Authoring) | `<Preview>` in `src/preview/react/preview.tsx:12-30, 166-175` lacked an optional `limits` prop to forward to its `<Surface>` cells when a preview session raises validation bounds. | `execute` | `execute` | Added optional `limits` to `PreviewProps` and forwarded to `<Surface>` in `src/preview/react/preview.tsx`; registered in `scripts/release/api/register-0.3.1.json`; tested in `preview_forwards_limits_to_surface_cells` (`src/__tests__/preview-react.test.tsx`); documented in `docs/spec.md` §7.5, `docs/preview.md` and `CHANGELOG.md`. |
| **F5** | 2 (Public API), 12 (Reference hosts) | When `renderPlacement` skips a render at step R6 (`result.value === previous`), the returned `previous` object still carries its prior render's `patch`, `reset` and `migrated` fields. Changing the skipped return shape breaks `result.value === previous` in `0.3.x`. | `backlog` (P4) | `backlog` (P4) | Added to `plans/backlog.md` (P4, `0.4.0`) and `plans/033` `## Further Actions`. |
| **F6** | 6 (Interaction), 11 (Conformance / observability) | Both confirmed and unconfirmed `onIntent` paths contain throws/rejections silently without emitting a `SurfaceEvent`, because `SurfaceEvent` only grows in a minor release (`docs/spec.md` §11). | `backlog` (P4) | `backlog` (P4) | Added to `plans/backlog.md` (P4, `0.4.0`) and `plans/033` `## Further Actions`. |

---

## 3. Whole-Plan Verification

| Gate | Result |
|---|---|
| `bun test --conditions liveframe:source src/__tests__/host-render.test.ts src/__tests__/host-intent.test.ts src/__tests__/host-guide.test.ts src/__tests__/surface-core.test.ts src/__tests__/runner-worker.test.ts src/__tests__/api-stability.test.ts src/__tests__/no-wall-clock-gate.test.ts` | **116 pass, 0 fail** |
| `LIVEFRAME_BROWSER=webkit bun test --conditions liveframe:source src/__tests__/react-browser.test.tsx` | **41 pass, 0 fail** (33.8s) |
| `LIVEFRAME_BROWSER=firefox bun test --conditions liveframe:source src/__tests__/react-browser.test.tsx` | **41 pass, 0 fail** (42.5s) |
| `bun run demo:test` | **67 pass, 0 fail** |
| `bun run guide:test` | **pass** (end-to-end getting-started guide against packed archives) |
| `bun run check` | **1792 pass, 4 skip, 0 fail** (`typecheck`, `lint`, `format:check`, `gen:check`, `build`, workspace tests) |
