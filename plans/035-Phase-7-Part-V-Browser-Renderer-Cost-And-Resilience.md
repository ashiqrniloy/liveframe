# Phase 7 Part V: Browser Renderer Cost and Resilience

Depends on: plan [033](033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md) complete (the scope decision, `register-0.3.1.json`, and Tasks 5–6, which change `src/surface/core.ts` and `<Surface>`'s props). Independent of plan [034](034-Phase-7-Part-U-Request-Time-Performance.md); run after it by number. Followed by plan [036](036-Phase-7-Part-W-Internal-Structure-And-Parity.md). Source: findings P4, P5, A3 and A4 of the 2026-11-15 review (table in plan 033).

## Objectives

- Measure, in a production build and a real browser, what focus continuity and the mount sequence cost.
- Bound the focus snapshot by the surface, not by the host page.
- Draw each implementation once when a surface mounts on the client.
- Prove what `core.accept()` during render does under an interrupted concurrent update, and fix or document it.
- Offer an opt-in mode that keeps the last valid tree on screen when an arrival is rejected.

## Expected Outcome

- `plans/evidence/035-browser-baseline.md` holds mount and update costs at three host-page sizes, with the thresholds that decide Tasks 2 and 3.
- A surface update with focus inside it reads the style of at most the candidates it tries, and never walks the host page's tabbable elements.
- A client-side mount (`createRoot`) calls each implementation once; hydration is unchanged.
- A browser test covers an interrupted transition, and either the core cannot run ahead of the screen or the guide says how a host must pass `tree`.
- `<Surface invalid="keep-last">` exists if the decision approves it, with the default unchanged.

This plan implements the browser part of the review-fix work in roadmap Phase 7. Its changes are additive or internal, except two that change observable behaviour and so start with a decision: where focus may land (Task 2) and what a rejected arrival draws under the new opt-in (Task 5). No version is bumped and nothing is published. Spec section touched: §11.

The two costs are stated from the code, not yet measured: `tabbables()` (`src/react/renderer.tsx:131-141`) runs `querySelectorAll` over the document and `getComputedStyle` plus `getClientRects` per element in `getSnapshotBeforeUpdate` (`:159-169`) on every surface update while focus is inside; and `portal` is state set by a ref (`:420`, `:483`) that is part of the element cache key (`:459`) and of every `Item` (`:223`), so the first commit rebuilds every element. Task 1 turns both into numbers before anything changes (roadmap §1, "Budgets on realistic sizes").

## Tasks

- [x] Task 1: Measure mount and focus-continuity cost in a production build
  - Acceptance Criteria:
    - Functional:
      - The browser harness (`bench/streaming.bench.ts --production`, client `bench/streaming-client.tsx`) gains two scenarios on the proof's agent-home tree: (a) mount — implementation render count and `flushSync` wall time for `createRoot` and for `hydrateRoot`; (b) update with focus inside the surface — commit time when the host page around the surface holds 0, 1,000 and 5,000 tabbable elements, with `focusContinuity` on and off.
      - `plans/evidence/035-browser-baseline.md` records the numbers, the machine, React and Chromium versions, and the command, and states two thresholds for the owner to confirm: Task 2 changes code if the on/off difference at 1,000 elements exceeds 0.5 ms; Task 3 changes code if the second mount pass exceeds 20% of the first.
      - The scenarios do not rewrite a tracked evidence file on every run (backlog: "Stop `bench/streaming.bench.ts` rewriting a tracked evidence file").
    - Performance: this task sets thresholds; it adds no failing gate.
    - Code Quality: scenarios live in the existing harness; no second browser harness.
    - Security: n/a — bench code only.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/renderer.md`.
      - `investigate-first`.
      - `find-docs` — Playwright and React profiling APIs.
    - Library Documentation to Check Before Implementation:
      - React 19.3.1 (locked): `flushSync`, `<Profiler>` (absent in production builds; the harness already times `flushSync`, `bench/streaming-client.tsx:28-30`).
      - Playwright 1.64 (locked): `page.evaluate`, `chromium.launch`.
    - Documentation Reviewed:
      - `roadmap.md` §1; `bench/streaming.bench.ts:18`, `:103-104`, `:186-221`; `plans/backlog.md` "Profile production browser selection costs before optimizing the renderer"; `docs/renderer.md:232-266`.
    - Options Considered:
      - Reason from the code only — rejected: roadmap §1 requires a measurement before an optimisation.
    - Chosen Approach:
      - Two scenarios in the production profile, thresholds agreed before Tasks 2 and 3.
    - API Notes and Examples:
      ```bash
      bun --conditions liveframe:source bench/streaming.bench.ts --production
      ```
    - Files to Create/Edit:
      - `bench/streaming.bench.ts`, `bench/streaming-client.tsx`: the mount and focus scenarios.
      - `plans/evidence/035-browser-baseline.md`: numbers and thresholds.
  - Test Cases to Write:
    - `bench_json_reports_mount_and_focus_rows` (in `src/__tests__/bench-json.test.ts`): the harness output names both scenarios.
  - Notes (executed 2026-11-17):
    - Added Scenario (a) (`measureMount` for `createRoot` and `hydrateRoot`, SSR markup generated via `renderToString` on the server with zero `onRecoverableError`s) and Scenario (b) (`measureFocus` with `0`, `1,000`, and `5,000` host `<button type="button">` elements around the surface and `focusContinuity` `true`/`false`) on the proof's 679-node `agent-home` tree in `bench/streaming.bench.ts` and `bench/streaming-client.tsx`.
    - Added `--runs <n>` for fast smoke runs in tests, and changed `bench/streaming.bench.ts` to write its markdown report to `tmpdir()` unless `--out <path>` is passed so running the bench no longer dirties tracked files under `plans/evidence/`.
    - Added `bench_json_reports_mount_and_focus_rows` in `src/__tests__/bench-json.test.ts` verifying stdout scenario lines and all `mount.*` / `focus.*` `--json` metrics.
    - Recorded the production baseline in `plans/evidence/035-browser-baseline.md` (Linux 7.3.0-4-cachyos, AMD Ryzen 9 PRO 7940HS, 16 CPUs, Bun 1.4.4, React 19.3.1 production, Playwright 1.64.1, headless Chromium 156.0.8078.4, end load `12.04, 10.32, 10.45`):
      - Mount (`createRoot`): `1358` renders (`679 + 679`), `flushSync` median `23.800 ms` (`19.000 ms` pass 1, `4.900 ms` pass 2, second pass / first = **`25.8%`**).
      - Mount (`hydrateRoot`): `1358` renders (`679 + 679`), `flushSync` median `16.300 ms` (`11.500 ms` pass 1, `5.700 ms` pass 2, second pass / first = `49.6%`).
      - Focus continuity (`on` vs `off` `flushSync` commit median net of validation): `0` host elements `2.800 ms` vs `1.400 ms` (`+1.400 ms`), `1,000` host elements `7.000 ms` vs `1.500 ms` (**`+5.500 ms`**), `5,000` host elements `23.100 ms` vs `1.300 ms` (`+21.800 ms`).
    - Findings for later tasks: both thresholds were confirmed by the owner on 2026-11-17 (`"Confirmed"`) and both are exceeded (`+5.500 ms > 0.5 ms` at 1,000 host elements; `25.8% > 20%` second mount pass share on `createRoot`), so Tasks 2 and 3 both proceed to change code. No spec change.

- [x] Task 2: Bound the focus snapshot by the surface (P4)
  - Acceptance Criteria:
    - Functional:
      - If Task 1's threshold is not met, record "no change" and stop.
      - Otherwise first settle one question with `create-decision-log`: spec §11 says focus continuity "keeps keyboard focus inside the surface" and also "focus moves to the next element in document order", and the code takes candidates from the whole document (`renderer.tsx:133`). The decision picks one: candidates are the tabbable elements inside the wrapper and the portal container only (recommended), or the whole document.
      - The snapshot then collects candidates with one `querySelectorAll` over the chosen scope and no style or layout read. `getComputedStyle` and `getClientRects` run in `componentDidUpdate`, only when the focused element was disconnected, and only on candidates in order until one takes focus.
      - Spec §11 and `docs/renderer.md` "Keep focus in the surface when a row disappears" state the chosen scope and that a candidate must be tabbable after the update.
      - Every existing focus test stays green, or changes only where the decision changes the outcome, each named in the task notes.
    - Performance: with focus inside the surface, the on/off difference at 1,000 and 5,000 host-page elements is under Task 1's threshold; gated in the harness.
    - Code Quality: the change stays in `FocusContinuity` and `tabbables` (`src/react/renderer.tsx:119-192`); no new prop.
    - Security: n/a — moving focus emits no intent (spec §11) and that stays tested.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/renderer.md`.
      - `create-decision-log` — the scope of candidates is a contract choice.
      - `find-docs` — React class lifecycle timing.
    - Library Documentation to Check Before Implementation:
      - React 19.3.1: `getSnapshotBeforeUpdate` and `componentDidUpdate` ordering relative to DOM mutation; HTML "sequential focus navigation" for the selector at `:124-125`.
    - Documentation Reviewed:
      - Spec §11 (`focusContinuity`); `docs/renderer.md:232-266`; `src/__tests__/react-browser.test.tsx:844` (`patched_render_skips_unchanged_nodes_and_preserves_local_state_focus_scroll`); `src/conformance/react/browser.tsx:111` (`focus_scroll_and_local_state_survive_revisions`); the 0.2.2 focus-continuity design in plan 022.
    - Options Considered:
      - Keep the whole-document scan but cache it between updates — rejected: the host page changes without telling the surface, so the cache is wrong exactly when it matters.
      - Walk forward and back from the focused element with a `TreeWalker`, bounded to N steps — a fallback if the decision keeps the whole document: bounded, but still reads the host page.
    - Chosen Approach:
      - Scope candidates to the surface and defer every style read to the rare path where focus was actually lost.
    - API Notes and Examples:
      ```ts
      // snapshot: scope().flatMap((root) => [...(root?.querySelectorAll(tabbableSelector) ?? [])])
      // restore:  first candidate where isConnected && tabbableNow(candidate) && focus() took
      ```
    - Files to Create/Edit:
      - `decision-logs/<date>-focus-continuity-candidates.md`.
      - `src/react/renderer.tsx`: `tabbables`, `FocusContinuity`.
      - `src/__tests__/react-browser.test.tsx`: the tests below.
      - `src/conformance/react/browser.tsx` (tentative — only if the suite's focus case pins the old scope).
      - `docs/spec.md` §11; `docs/renderer.md`; `CHANGELOG.md`.
      - `scripts/release/api/register-0.3.1.json`: n/a — no declaration changes.
  - Test Cases to Write:
    - `focus_snapshot_reads_no_style_while_focus_survives`: `getComputedStyle` is wrapped in the page; an update that keeps the focused element calls it zero times. Fails today.
    - `removed_focused_row_moves_focus_to_the_next_row_in_the_surface`.
    - `removed_last_tabbable_falls_back_to_previous_then_wrapper`: with a tabbable element after the surface in the document, focus stays inside the surface (if the decision scopes to the surface; otherwise the test asserts the document order).
    - `candidate_hidden_by_the_same_update_is_skipped`.
    - `focus_placed_by_the_host_during_the_commit_is_kept` (existing behaviour, `renderer.tsx:171-179`).
  - Notes (executed 2026-11-17):
    - Decision: candidates come from the wrapper and portal container only (owner chose "Surface only (Recommended)" on 2026-11-17); recorded in `decision-logs/2026-11-17-0149-focus-continuity-candidates.md`.
    - `src/react/renderer.tsx`: `tabbables()` is gone. `getSnapshotBeforeUpdate` runs one `querySelectorAll(tabbableSelector)` per scope root (wrapper, then portal container, which is document order) and splits the matches by `compareDocumentPosition`; it reads no style or layout. `componentDidUpdate` tries candidates in order and calls the new `tabbableNow()` (attributes, `inert`, `getComputedStyle`, `getClientRects`) only on those it tries, only when the focused element was disconnected.
    - Behaviour change from the decision: when the surface's last tabbable element is removed, focus now goes to the previous surface element (or the wrapper) instead of a host element after the surface; a candidate must be tabbable after the update (it was "before"). No existing focus test changed outcome; their trees had no host tabbables after the surface.
    - Tests added in `src/__tests__/react-browser.test.tsx`: `focus_snapshot_reads_no_style_while_focus_survives` (1,000 host buttons each side; zero `getComputedStyle`, `getClientRects` and `document.querySelectorAll` calls), `removed_focused_row_moves_focus_to_the_next_row_in_the_surface`, `removed_last_tabbable_falls_back_to_previous_then_wrapper`, `candidate_hidden_by_the_same_update_is_skipped` and `focus_placed_by_the_host_during_the_commit_is_kept` (focus placed inside the surface during the mutation phase). `focus_continuity_false_adds_nothing` now also counts `Element.prototype.querySelectorAll`, since the snapshot no longer queries the document. `src/conformance/react/browser.tsx` was unchanged: its focus case does not pin the scope.
    - Performance (`bun --conditions liveframe:source bench/streaming.bench.ts --production`, same machine, run alone): on − off at 0 / 1,000 / 5,000 host elements is now `+0.2` / `+0.2` / `+0.3 ms` (Task 1: `+1.4` / `+5.5` / `+21.8 ms`). `bench/streaming.bench.ts` gates `diffMs < 0.5` at ≥ 1,000 host elements in production runs that are not `--runs` smoke runs. A run while the full test suite ran alongside measured `+1.4 ms` and failed the gate, so the gate is load-sensitive; keep it to quiet machines.
    - Spec §11, `docs/renderer.md` "Keep focus in the surface when a row disappears" and `CHANGELOG.md` (Fixed) state the scope and the after-update tabbability rule. No API declaration changed.
    - Finding (not acted on): `componentDidUpdate` keeps focus that is placed *inside* the surface during the commit, but takes back focus placed *outside* it during the commit (an element other than `body`), which reads against §11's "Focus the host or a primitive has already placed elsewhere is never taken back". Pre-existing; candidate for Task 6's sweep.
    - Release placement: the 2026-11-15 scope decision puts P4 in 0.3.1 unless the decision changes behaviour. The decision log treats the change as fixing §11's internal contradiction; the owner should confirm 0.3.1 versus 0.4.0.

- [x] Task 3: Draw each implementation once on a client mount (P5)
  - Acceptance Criteria:
    - Functional:
      - If Task 1's threshold is not met, record "no change" and stop.
      - Otherwise: on a client mount that is not hydrating, `<Surface>` first commits the wrapper and the portal container without the tree, then draws the tree in the same task before paint, with `portal` already set. Each implementation's component function runs once.
      - While hydrating, the first client render still draws the tree with `portal` undefined, exactly as the server did; the second pass after mount stays (spec §11: "undefined during SSR and the first client render").
      - Nothing is painted twice: both commits happen before the browser's next frame.
      - Spec §11 says which case draws once and which draws twice.
    - Performance: the mount scenario's implementation render count is one per node for `createRoot`; mount wall time drops by the measured second-pass share. Hydration time does not regress.
    - Code Quality: the hydration test is one `useSyncExternalStore` with a server snapshot; no `typeof window` check, no effect-driven flag that would paint the fallback.
    - Security: law 2 is unchanged: `core.accept(tree)` still runs before anything is drawn.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/renderer.md`.
      - `find-docs` — React hydration and external-store semantics.
    - Library Documentation to Check Before Implementation:
      - React 19.3.1 `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`: `getServerSnapshot` is used during hydration, `getSnapshot` on a client render (react.dev reference, checked 2026-11-15); callback refs and `setState` in the layout phase commit before paint.
    - Documentation Reviewed:
      - Spec §11 (portal, SSR); `src/react/renderer.tsx:420`, `:459-463`, `:465-486`; `src/__tests__/react-browser.test.tsx:693-750` (hydration cases), `:715` (`overlay_mounts_after_hydration_without_mismatch`); `src/__tests__/react-ssr.test.tsx`.
    - Options Considered:
      - A `usePortal()` hook that replaces the `portal` prop — rejected for 0.3.x: it removes a prop every overlay implementation reads; a 0.4.0 candidate if hydration cost matters after this task.
      - Read the portal through a context inside `Node` — rejected: every `Node` consumes the context, so every implementation still re-renders when it is set.
      - Create the portal element imperatively before the first render — rejected: React must own the element for hydration to match.
    - Chosen Approach:
      - Defer the tree by one synchronous commit on client mounts only.
    - API Notes and Examples:
      ```tsx
      const hydrating = useSyncExternalStore(noop, () => false, () => true);
      const drawTree = hydrating || portal !== null; // client mount: wrapper and portal first
      ```
    - Files to Create/Edit:
      - `src/react/renderer.tsx`: the mount sequence in `Surface`.
      - `src/__tests__/react-browser.test.tsx`: the tests below.
      - `bench/streaming.bench.ts`: a `budget()` on the mount render count.
      - `docs/spec.md` §11; `docs/renderer.md` "Server rendering and hydration"; `CHANGELOG.md`.
  - Test Cases to Write:
    - `client_mount_renders_each_implementation_once`: a counting implementation reads 1 after `createRoot().render`. Fails today (2).
    - `client_mount_passes_the_portal_on_the_first_draw`: an overlay implementation never sees `portal === undefined` on a client mount.
    - `hydration_still_matches_and_supplies_the_portal_after_mount`: the existing hydration cases stay green with no recoverable error.
    - `nothing_paints_between_the_two_mount_commits`: one `requestAnimationFrame` tick observes the tree already drawn.
  - Notes (executed 2026-11-17):
    - `src/react/renderer.tsx` (`Surface`): `hydrating = useSyncExternalStore(subscribeNever, () => false, () => true)`; `drawTree = hydrating || portal !== null`. While `drawTree` is false the wrapper and portal container commit empty (no tree, no fallback) and `root` is not built. On a client mount, the portal's callback ref sets state in the layout phase, so React draws the tree synchronously in the same task with `portal` set. `core.accept(tree)` still runs on the first render, before anything is drawn (law 2). During hydration the server snapshot is used, so the first client render draws the tree with `portal` undefined as before. After hydration React re-reads `false`, but `portal` is already set and `root`'s memo inputs do not change, so no implementation renders again.
    - Tests added in `src/__tests__/react-browser.test.tsx` through a new `window.surfaceTest.clientMount()` fixture (`src/__tests__/fixtures/react-client.tsx`). It does a fresh non-hydrating `createRoot` mount of `hydrationTree("valid")` (stack, button, dialog and two texts) and records each `requestAnimationFrame` state until the tree is drawn. The tests are `client_mount_renders_each_implementation_once` (`{ stack: 1, text: 2, button: 1, dialog: 1 }`), `client_mount_passes_the_portal_on_the_first_draw`, `hydration_still_matches_and_supplies_the_portal_after_mount` and `nothing_paints_between_the_two_mount_commits` (no frame sees the wrapper without the tree). The existing hydration cases (`server_markup_hydrates_with_no_recoverable_error`, `overlay_mounts_after_hydration_without_mismatch`, `invalid_server_fallback_hydrates_without_mismatch`, `host_fallback_recovers_on_client_after_ssr_throw`) are unchanged and green.
    - `bench/streaming.bench.ts`: a `budget()` requires the `createRoot` mount to render no implementation without the portal, and no more than `hydrateRoot`'s first-pass count (one per node). Counts are deterministic, so the gate runs in smoke runs too.
    - Measured (`plans/evidence/035-browser-baseline.md` §6): `createRoot` renders `679` implementations (`0 + 679`), down from `1358`. The machine was under unrelated load (load average 33–37), so wall times are not comparable with Task 1. Under that same load `createRoot` and `hydrateRoot` took the same time (`69.5` vs `69.7 ms`), where the baseline had `createRoot` 46% slower. A quiet-machine re-run of the wall times is left for Task 6's sweep. In the same loaded run, Task 2's focus gate failed (`+1.3 ms` at 1,000 host elements). Task 3 does not touch the update path; the failure is the load sensitivity Task 2 recorded.
    - Spec §11 ("Server-side rendering is supported" bullet), `docs/renderer.md` "Server rendering and hydration" and `CHANGELOG.md` (Performance) now say that a non-hydrating client mount draws once with `portal` set and hydration draws twice. No API declaration changed.
    - `bun run check` passes (1816 pass, 0 fail). An earlier run under a load average of about 100 timed out and set off a cascade of "browser has been closed" failures. Those suites passed when run one at a time, and the full run then passed.

- [x] Task 4: Prove what `accept()` during render does under an interrupted update (A3)
  - Acceptance Criteria:
    - Functional:
      - A browser test passes `tree` B inside `startTransition`, interrupts it with an urgent update that keeps tree A, and inspects the surface: which tree is drawn, which revision an `emit` from a drawn node reports, and whether local state was reset when B names another `surfaceId`.
      - If the drawn tree and the core agree in every case, record "no change", keep the test, and add one sentence to spec §11 saying why calling `accept` in render is safe.
      - If they can disagree: `<Surface>` validates and builds a candidate during render without changing the core, and commits it in a layout effect. The split is internal to `src/react/` and `src/surface/core.ts`; `SurfaceCore.accept` keeps its contract for other adapters.
      - Either way `docs/renderer.md` says whether a host may update `tree` inside a transition.
    - Performance: an urgent update costs no extra render; `bench/streaming.bench.ts` patched-update rows do not regress.
    - Code Quality: no new public method unless the split needs one; if it does, it is registered `added` and documented in spec §11.
    - Security: law 2. A tree is validated before it is drawn in both designs; the test asserts no node of an uncommitted tree is ever on screen.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/renderer.md`.
      - `investigate-first` — the failing case comes before the design.
      - `find-docs` — React concurrent rendering rules.
    - Library Documentation to Check Before Implementation:
      - React 19.3.1 `useSyncExternalStore` caveat: "If the store is mutated during a non-blocking Transition update, React will fall back to performing that update as blocking" (react.dev reference, checked 2026-11-15); `startTransition`; StrictMode double render.
    - Documentation Reviewed:
      - Spec §11 ("`accept` never notifies subscribers, so a framework may call it while rendering"); `src/react/renderer.tsx:410-419`; `src/surface/core.ts:486-510`; `src/__tests__/react-browser.test.tsx:201` (`validator_runs_once_per_tree`).
    - Options Considered:
      - Move `accept` into an effect — rejected: the first paint would show the previous tree or the fallback, and SSR would draw nothing.
      - Forbid transitions in the docs without a test — rejected: the claim needs the reproduction either way.
    - Chosen Approach:
      - Reproduce first; split into prepare and commit only if the reproduction shows a disagreement.
    - API Notes and Examples:
      ```tsx
      startTransition(() => setTree(treeB)); // interrupted
      flushSync(() => setLabel("urgent"));   // tree A must still be what emit reports
      ```
    - Files to Create/Edit:
      - `src/__tests__/react-browser.test.tsx`: the test below.
      - `src/react/renderer.tsx`, `src/surface/core.ts`: only if the reproduction fails.
      - `docs/spec.md` §11; `docs/renderer.md`.
  - Test Cases to Write:
    - `interrupted_transition_keeps_core_and_screen_in_step`: after the interruption, the drawn text is A's, an `emit` reports A's revision, and local state set under A survives. Fails if the core ran ahead.
    - `strict_mode_double_render_accepts_once`: one validation per tree under `<StrictMode>`.
  - Notes (executed 2026-11-17):
    - Reproduction first: a new `window.surfaceTest.mountTransition()` fixture (`src/__tests__/fixtures/react-client.tsx`) holds `tree` in host state next to a `Gate` that suspends forever on the transition's tree, so the transition render runs (and validates B) but never commits; `interrupt()` is an urgent `flushSync` update that keeps tree A. Against the old code, with B a later revision of the same surface, the urgent render drew `Revision 2` — a tree the host never committed — because `core.accept(B)` in the discarded render had moved the core, and `accept(A)` was then ignored as stale. With B naming another `surfaceId`, `accept(A)` replaced the tree again and reset the core's local state. The core could run ahead of the screen, so the split was made.
    - `src/surface/core.ts`: `accept` is now `commit(prepare(input))`. `prepare` validates (once per input; rejections and stale revisions are reported on first validation, as before) and builds the candidate snapshot against the committed one without changing anything `emit` or a host can observe; `commit` installs it, re-preparing if a local write moved the committed snapshot in between. `build`/`branch` take the local values as a parameter. The internal `createStagedCore` returns `StagedSurfaceCore` (`SurfaceCore` plus `prepare`/`commit`); it and the `Prepared` type are exported from `core.ts` only, not from `/surface`. `createSurfaceCore` still declares `SurfaceCore` (the API register caught a first draft that widened its return type), so no public declaration changed and `SurfaceCore.accept` keeps its contract.
    - `src/react/renderer.tsx`: `Surface` draws `core.prepare(tree).snapshot` and commits it in `useInsertionEffect`; while the hydration snapshot reads true (on the server, and in the hydration render) it also commits during render, because the server never commits and `rendererSuite`, `object-events` and `react-intents` tests call `emit` on contexts captured from `renderToString` (hydration is the core's first draw, so there is no committed tree to overtake). It (before any layout effect, so implementations' effects already see the committed tree; no state update). `useSyncExternalStore` on the core is replaced by a `useReducer` redraw subscribed in `useLayoutEffect`: the committed snapshot changes on every commit, which would have made `useSyncExternalStore` force an extra render per arrival. `refusedCore` implements `prepare`/`commit`.
    - Tests: `interrupted_transition_keeps_core_and_screen_in_step` (both cases: same surface revision 2, and another `surfaceId`; drawn text is A's, the button's React state survives, the press's origin is `{ surfaceId: "a", revision: 1 }`) — failed before the change, passes after. `strict_mode_double_render_accepts_once` (one validation for the mount and none for an urgent re-render under `<StrictMode>`).
    - `bun run check`: the first full run, at a load average of about 45, also failed four `cli-mcp`/`runner-worker` timeout tests. They don't touch the renderer, and they passed when run alone (106/106). The final run passed (1818 pass, 0 fail).
    - Performance: an urgent re-render with the committed `tree` is a no-op in `prepare` (same input as committed), and the strict-mode test proves no extra validation. The machine was loaded (load average 10–45), so `bench/streaming.bench.ts --production` patched-update rows were not re-measured. That re-run is left for Task 6's quiet-machine sweep, together with Task 3's wall times.
    - Spec §11 (`core.accept`) now says a framework may call `accept` while rendering only if every render it starts is committed, and that `/react` prepares while rendering and commits with React's commit, so a host may pass `tree` inside a transition. `docs/renderer.md` says the same for hosts (after "Replacing the validator…") and for adapter authors ("Writing another renderer"). `CHANGELOG.md` (Fixed).
    - Finding for Task 6: other adapters have no public `prepare`/`commit`; a concurrent non-React adapter would need them. Candidate for backlog (register as `added` on `SurfaceCore` if made public).

- [x] Task 5: Offer an opt-in mode that keeps the last valid tree (A4)
  - Acceptance Criteria:
    - Functional:
      - Take the decision first with `create-decision-log`: spec §11 says a renderer "draws its app's `fallback` for the whole surface when `snapshot().valid` is false, never part of an invalid tree and never nothing". The proposal keeps that as the default and adds `<Surface invalid="keep-last">`: after a rejected arrival, the last accepted tree stays drawn, inert, and marked.
      - If approved: with `invalid="keep-last"` and an accepted tree on record, a rejected arrival keeps the drawn nodes mounted (focus, scroll and uncontrolled input survive), the wrapper carries `data-lf-stale` and `aria-busy="true"`, and `emit` raises nothing (`src/surface/core.ts:345` already returns when the surface is invalid). With no accepted tree, the fallback is drawn.
      - `arrival-rejected` is reported exactly as today. The next accepted arrival clears the mark.
      - No node of the rejected tree is ever drawn.
      - If declined: record it in the log and close the task with no code.
    - Performance: no cost when the prop is absent; the default path's element tree is unchanged.
    - Code Quality: one prop and one branch at `src/react/renderer.tsx:469-481`; the core needs no change (it already keeps `tree` and `root` across a rejection).
    - Security: law 2. What stays on screen passed validation; it can raise no intent while the surface is invalid, so a host never receives an intent from a frame it has replaced.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/renderer.md`.
      - `create-decision-log` — it changes what §11 permits.
    - Library Documentation to Check Before Implementation:
      - WAI-ARIA 1.2 `aria-busy` on a region whose content is stale; React 19.3.1 keyed `Fragment` remount rules (`renderer.tsx:470`).
    - Documentation Reviewed:
      - Spec §11 (`core.accept`, `SurfaceSnapshot`: "`tree` stays the last accepted tree across an invalid arrival"); `src/conformance/react/browser.tsx:57` (`invalid_arrival_shows_only_the_fallback_and_recovers`); `docs/renderer.md` "Watch what the surface rejects"; `docs/security.md:58` (streamed agent output is hostile).
    - Options Considered:
      - Make keep-last the default — rejected: it changes what every existing host shows, and the conformance suite pins the fallback.
      - Keep the last tree interactive — rejected: every intent would be refused as `version-conflict`, because the host's latest frame is the rejected one.
      - Leave it to hosts (hold back an invalid tree before passing it) — possible today only by validating twice; the surface already has the answer.
    - Chosen Approach:
      - An opt-in prop over state the core already keeps.
    - API Notes and Examples:
      ```tsx
      <Surface tree={tree} validator={validator} invalid="keep-last" fallback={<Unavailable />} /* … */ />
      ```
    - Files to Create/Edit:
      - `decision-logs/<date>-keep-last-valid-tree.md`.
      - `src/react/renderer.tsx`: `SurfaceProps.invalid`, the draw branch, the wrapper attributes.
      - `src/css/base.ts` (tentative — only if the base sheet should dim nothing by default and expose the attribute for host CSS; no visual style ships).
      - `scripts/release/api/register-0.3.1.json`: `widened` for `SurfaceProps`.
      - `src/__tests__/react-browser.test.tsx`, `src/__tests__/react-ssr.test.tsx`: the tests below.
      - `src/conformance/react/browser.tsx`: an opt-in case (the default case stays).
      - `docs/spec.md` §11; `docs/renderer.md`; `docs/conformance.md`; `CHANGELOG.md`.
  - Test Cases to Write:
    - `keep_last_keeps_nodes_focus_and_input_across_a_rejected_arrival`: the same DOM node is focused before and after; the wrapper carries `data-lf-stale`.
    - `keep_last_raises_no_intent_while_stale`: a press on a kept button calls `onIntent` zero times.
    - `keep_last_without_a_tree_draws_the_fallback`.
    - `keep_last_never_draws_a_node_of_the_rejected_tree`: a rejected tree with one valid new node shows none of it.
    - `default_still_shows_only_the_fallback` (existing conformance case) stays green.
  - Notes (executed 2026-11-17):
    - Decision: approved as proposed (owner chose "Approve as proposed (Recommended)" on 2026-11-17); recorded in `decision-logs/2026-11-17-1255-keep-last-valid-tree.md`. "Inert" means the kept tree raises nothing. It is not the HTML `inert` attribute, which would take focus away.
    - `src/react/renderer.tsx` (`Surface`): new `invalid?: "fallback" | "keep-last"` (default `"fallback"`). `stale = !snapshot.valid && invalid === "keep-last" && snapshot.tree !== undefined`. The draw branch is `snapshot.valid || stale`, so the kept tree uses the same element structure (same `Fragment` key, same `FocusContinuity`) and stays mounted. The wrapper gets `data-lf-stale=""` and `aria-busy="true"` only while stale; the default path renders no new attribute. The core is unchanged: a rejected `prepare` already carries the committed `tree` and `root`, and `emit` returns early while invalid (`src/surface/core.ts:396`). That covers intents and `setLocal` writes. No CSS ships (`src/css/base.ts` unchanged); `docs/renderer.md` shows a host rule.
    - Tests: `keep_last_keeps_nodes_focus_and_input_across_a_rejected_arrival` (every node stays connected, focus and the draft survive, `arrival-rejected` is reported once, and the next accepted arrival clears both attributes), `keep_last_raises_no_intent_while_stale`, `keep_last_never_draws_a_node_of_the_rejected_tree` (a rejected tree with a valid new "Intruder" node beside an unknown kind renders no implementation and shows none of it) and `default_invalid_mode_shows_only_the_fallback_and_no_stale_mark` in `src/__tests__/react-browser.test.tsx`, through a new `window.surfaceTest.setInvalidMode()` fixture. `keep_last_without_a_tree_draws_the_fallback` is in `src/__tests__/react-ssr.test.tsx`. The existing `invalid_arrival_shows_only_the_fallback_and_recovers` and `stale_revision_is_ignored_and_new_surface_replaces` are unchanged.
    - Conformance: `conformancePage().mount(tree, styles, invalid?)` takes the mode. `rendererBrowserSuite` gains `keep_last_invalid_arrival_keeps_the_last_tree_marked`: the nodes are kept, the wrapper is marked, no implementation is called and the next arrival clears the mark. The default case stays.
    - Spec §11 (`core.accept`, plus the `<Surface>` bullet), `docs/renderer.md` "Keep the last tree on screen when an arrival is rejected", `docs/conformance.md`, `CHANGELOG.md` (Added), and `scripts/release/api/register-0.3.1.json` (`./react` `createRenderer` `widened`, 035 T5).
    - Finding for Task 6: spec §11's `<Surface>` bullet still says it "subscribes to the core with `useSyncExternalStore`", but Task 4 replaced that with a `useReducer` redraw. Pre-existing doc drift.
    - The API register keeps one entry per export, so the `invalid` widening is folded into the existing `./react` `createRenderer` entry (task `033 T6, 035 T5`). A new `./conformance/react` `conformancePage` `widened` entry covers `mount`'s optional third parameter. Spec §11 cites the decision log as a code path, not a link, because `docs_links_resolve` checks the packed archive, which has no `decision-logs/`.
    - `bun run check`: build, gen, typecheck, lint and format pass. The full test run (load average 37–45) had 1810 pass and 14 fail. Two came from this task (the spec link and the register entry); both are fixed and pass. The other 12 are `cli-mcp`/`runner-worker` tests that hit bun's 5 s default timeout or the worker runner's 100 ms render limit (`limit-exceeded`) under load. Re-run alone, 10 of 12 pass; `render_scenarios_returns_tree_or_errors` and `render_all_matches_session_check` still hit the worker's 100 ms render limit at load ~35. They don't touch the renderer, and Task 4 recorded the same class of failure. A quiet-machine full run is left for Task 6's sweep.
    - Finding for Task 6: with keep-last, a stream that stops after a rejection leaves the region `aria-busy` indefinitely (recorded as a risk in the decision log). The host sees it through `arrival-rejected`.

- [x] Task 6a: Keep host-placed focus, correct the §11 subscription wording, and prove the deferred mount on an invalid tree (Task 6 F1–F3)
  - Acceptance Criteria:
    - Functional:
      - F1: when the focused element is disconnected and focus is already on any element other than `body` after the commit (inside the surface or not), `FocusContinuity` leaves it there, as spec §11 says ("never taken back").
      - F2: the spec §11 `<Surface>` bullet describes the prepare-in-render, commit-with-React and `useReducer` redraw that Task 4 shipped, not a `useSyncExternalStore` subscription.
      - F3: a non-hydrating `createRoot` mount of an invalid tree renders no implementation, shows no frame with the tree, and ends on the fallback.
    - Performance: n/a. It adds one comparison on the rare focus-lost path.
    - Code Quality: the F1 change stays in `FocusContinuity.componentDidUpdate`, and the test reuses the existing `clientMount` fixture with an optional mode.
    - Security: F3 is the Law 2 proof for Task 3's deferred mount.
  - Approach:
    - Skills to Use: `liveframe-execution` (`references/renderer.md`).
    - Files to Create/Edit: `src/react/renderer.tsx`; `src/__tests__/react-browser.test.tsx`; `src/__tests__/fixtures/react-client.tsx` (`clientMount(mode?)`, `fallback` frames, `text`); `docs/spec.md` §11; `CHANGELOG.md` (Fixed).
  - Test Cases to Write:
    - `focus_placed_outside_the_surface_during_the_commit_is_kept`: fails before the change, passes after.
    - `client_mount_of_an_invalid_tree_draws_only_the_fallback`.
  - Notes (executed 2026-11-17):
    - `componentDidUpdate` now returns when `document.activeElement` is anything but `body` (or null), and no longer checks whether that element is inside the scope. With the old check restored, `focus_placed_outside_the_surface_during_the_commit_is_kept` fails. With the fix it passes. `focus_placed_by_the_host_during_the_commit_is_kept` and every other focus case stay green.
    - `client_mount_of_an_invalid_tree_draws_only_the_fallback` passes. Every implementation render count is zero, no `requestAnimationFrame` frame sees the tree, and the surface ends with `Unavailable`. `clientMount(mode = "valid")` gains a `"fallback"` frame state and returns the surface text, and the existing callers are unchanged.
    - Spec §11 `<Surface>` bullet: "It draws what the core prepared while rendering, commits it with React's commit and redraws when the core notifies a local write". `CHANGELOG.md` Fixed: the focus entry says host-placed focus outside the surface is no longer taken back. No API declaration changed.

- [x] Task 6: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: `plans/evidence/035-impact-analysis.md` records each of the twelve impact areas, or `None — <reason>`. Findings go to the owner in one table with a recommended disposition; `execute` findings become tasks above this one, `backlog` findings go to `plans/backlog.md` and Further Actions.
    - Performance: the sweep restates Task 1's table with the after numbers.
    - Code Quality: no code changes unless a finding is disposed `execute`.
    - Security: the sweep states which test proves that neither the deferred mount nor keep-last draws an unvalidated node.
  - Approach:
    - Skills to Use:
      - `create-plan` — "Final task: impact analysis".
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `references/liveframe.md` §5; `plans/evidence/035-browser-baseline.md`.
    - Options Considered:
      - Run the browser suites in Chromium only — rejected: focus and view timing differ; CI runs WebKit and Firefox (`.github/workflows/ci.yml:47-49`).
    - Chosen Approach:
      - One sweep after Task 5, in all three engines.
    - API Notes and Examples:
      ```bash
      bun run check && LIVEFRAME_BROWSER=webkit bun run test && LIVEFRAME_BROWSER=firefox bun run test
      ```
    - Files to Create/Edit:
      - `plans/evidence/035-impact-analysis.md`; `plans/backlog.md` (close "Profile production browser selection costs before optimizing the renderer" if Task 1 answers it); `roadmap.md` §3; this plan's Compromises Made and Further Actions.
  - Test Cases to Write:
    - none new.
  - Notes (executed 2026-11-17):
    - `plans/evidence/035-impact-analysis.md` records all twelve areas, the after-numbers table for Task 1, the Law 2 tests for the deferred mount, the prepare/commit split and keep-last, and the verification runs.
    - Findings were presented to the owner in one table, and every recommendation was accepted. F1 (focus placed outside the surface during the commit was taken back), F2 (§11 still said `useSyncExternalStore`) and F3 (no invalid-tree client-mount test) were executed as Task 6a. F4 (quiet-host wall-time re-run and a load-resistant focus gate, P3), F5 (public `prepare`/`commit` for non-React concurrent adapters, P3) and F6 (keep-last `aria-busy` left set when a stream stops, P4) went to `plans/backlog.md`. F7: the owner confirmed Task 2's focus-scope change for 0.3.1 as a fix, recorded in the decision log and `roadmap.md`.
    - Backlog "Profile production browser selection costs before optimizing the renderer" was already closed by plan 022. Its preview-matrix follow-up is outside this plan and stays open.
    - F8, found during verification: in WebKit, `candidate_hidden_by_the_same_update_is_skipped` failed. Inside `componentDidUpdate`, WebKit's `getComputedStyle` still showed row c as visible after the commit, even though the test's `:nth-child(2):last-child` rule now matched it. The test now hides the row by changing its variant (`ghost`) in the same update, and it passes in all three engines. The renderer is unchanged (details in `plans/evidence/035-impact-analysis.md` §3).
    - Verification: WebKit 1818/1 before the F8 fix. Firefox passes every renderer file when run alone; the failures in the full Firefox run were load timeouts in MCP, capture and worker tests. The bench at load ~21 passes (679 `createRoot` renders, focus difference 0.0 ms). `demo:test` 68/0. The final `bun run check` (load 20–27): build, gen, typecheck, lint and format pass, and tests are 1819 pass, 7 fail. The 7 are in worker, MCP, capture and preview-library files this plan did not touch, and those files pass alone (128/0).
    - The machine stayed under unrelated load (average 18–82) throughout, so the quiet-machine re-runs that Tasks 3 and 4 deferred to this sweep could not be made. They are F4.

## Verification (whole plan)

- `bun run check`
- `bun --conditions liveframe:source test src/__tests__/react-browser.test.tsx src/__tests__/react-ssr.test.tsx src/__tests__/conformance-renderer-browser.test.tsx`
- `LIVEFRAME_BROWSER=webkit bun run test`
- `LIVEFRAME_BROWSER=firefox bun run test`
- `bun --conditions liveframe:source bench/streaming.bench.ts --production`
- `bun run demo:test`

## Compromises Made

- Wall times after Tasks 3 and 4 were measured only under heavy unrelated load (average 26–47), so they cannot be compared with Task 1's baseline. Render counts and the structural focus proof (zero style, layout and document reads) do not depend on load and are gated. Implication: the mount and patched-update time savings are inferred from counts, not timed.
- The focus gate (`diffMs < 0.5` at ≥ 1,000 host elements) is absolute and fails under load. It runs only in non-smoke production bench runs, which keeps it out of `bun run check`.
- `prepare`/`commit` stay internal to `src/surface/core.ts`. A non-React adapter that can abandon a render must still commit every render it starts.
- Hydration still draws every implementation twice, as spec §11 requires. A `usePortal()` hook that would remove the second pass is a 0.4.0 candidate (Task 3, Options Considered).

## Further Actions

- P3: re-measure the browser renderer's wall times on a quiet host and make the focus gate resistant to load (F4; `plans/backlog.md`).
- P3: expose `prepare` / `commit` on `SurfaceCore` for concurrent adapters other than React, with the 0.4.0 DOM adapter (F5; `plans/backlog.md`).
- P4: say how a host clears a stale keep-last surface when the stream stops (F6; `plans/backlog.md`).
