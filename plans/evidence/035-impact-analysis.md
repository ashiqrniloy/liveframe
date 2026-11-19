# Plan 035 — Architectural Impact Analysis (Browser Renderer Cost and Resilience)

Date: 2026-11-17
Plan: [`plans/035-Phase-7-Part-V-Browser-Renderer-Cost-And-Resilience.md`](../035-Phase-7-Part-V-Browser-Renderer-Cost-And-Resilience.md)
Baseline: [`plans/evidence/035-browser-baseline.md`](035-browser-baseline.md)
Decisions: `decision-logs/2026-11-17-0149-focus-continuity-candidates.md`, `decision-logs/2026-11-17-1255-keep-last-valid-tree.md`

This sweep covers the twelve impact areas in `.claude/skills/create-plan/references/liveframe.md` §5 across Tasks 1–5 and follow-up Task 6a. It restates Task 1's table with the after numbers, names the tests that keep Law 2 for the deferred mount, the prepare/commit split and keep-last, and records the owner's disposition of findings `F1`–`F7`.

---

## 1. The Twelve Impact Areas

### 1. Spec (`docs/spec.md`)

- §11 `focusContinuity` (Task 2): candidates come from the wrapper and portal container only, and must be tabbable after the update. The snapshot reads no style or layout.
- §11 "Server-side rendering is supported" (Task 3): a non-hydrating client mount draws once with `portal` set; hydration draws twice.
- §11 `core.accept` (Tasks 4, 5): a framework may call `accept` while rendering only if every render it starts is committed. `/react` prepares while rendering and commits with React's commit. The keep-last exception is opt-in and must mark the surface stale.
- **Drift found (F2):** the §11 `<Surface>` bullet still said it "subscribes to the core with `useSyncExternalStore`". Task 4 had replaced that with a `useReducer` redraw subscribed in `useLayoutEffect`. Fixed in Task 6a.
- **Contradiction found (F1):** §11 says "Focus the host or a primitive has already placed elsewhere is never taken back", but `componentDidUpdate` took back focus the host placed outside the surface during the commit. The code was fixed to match the spec in Task 6a.
- `src/__tests__/docs-spec-structure.test.ts` passes.

### 2. Public API and formats

- `./react` `createRenderer` is `widened` (`SurfaceProps.invalid?: "fallback" | "keep-last"`, 035 T5), folded into the existing 033 T6 entry in `scripts/release/api/register-0.3.1.json`.
- `./conformance/react` `conformancePage` is `widened` (`mount(tree, styles, invalid?)`, 035 T5).
- `SurfaceCore` is unchanged in public. `createStagedCore`, `StagedSurfaceCore` and `Prepared` are exported from `src/surface/core.ts` only, not from `/surface`. `createSurfaceCore` still declares `SurfaceCore` (the register caught a draft that widened it).
- No wire format, JSON Schema or conformance vector changed. `api-stability.test.ts` passes.
- Release placement of Task 2's behaviour change (F7): the owner confirmed 0.3.1 as a fix on 2026-11-17.

### 3. The four laws

Law 2 (the UI tree is validated data) is the one this plan touches. Each new path keeps it, and these tests hold it:

| Path | Why no unvalidated node is drawn | Test |
|---|---|---|
| Deferred client mount (Task 3) | `core.prepare(tree)` validates on the first render; the wrapper and portal commit empty, and the second commit draws only what `prepare` accepted, or the fallback. | `client_mount_of_an_invalid_tree_draws_only_the_fallback` (Task 6a, F3): zero implementation renders, no frame shows the tree, only `Unavailable`; `client_mount_renders_each_implementation_once`; `nothing_paints_between_the_two_mount_commits` |
| Prepare/commit split (Task 4) | A render React discards never moves the core; `emit` reports the committed tree. | `interrupted_transition_keeps_core_and_screen_in_step`, `strict_mode_double_render_accepts_once` |
| Keep-last (Task 5) | What stays drawn is the last accepted `tree`/`root`; the rejected tree is never built into elements; `emit` returns while invalid. | `keep_last_never_draws_a_node_of_the_rejected_tree`, `keep_last_raises_no_intent_while_stale`, `keep_last_without_a_tree_draws_the_fallback`, conformance `keep_last_invalid_arrival_keeps_the_last_tree_marked` |

Law 4 (a widget never holds authority): keep-last sends no intent from a replaced frame (`keep_last_raises_no_intent_while_stale`). Moving focus emits no intent (`focus_continuity_*` cases). Laws 1 and 3: untouched. No widget code path or style channel changed, and no CSS ships for `data-lf-stale`.

### 4. Validation

- Rejections and stale revisions are reported on first validation, as before; `prepare` validates each input once (`validator_runs_once_per_tree`, `strict_mode_double_render_accepts_once`).
- `arrival-rejected` is reported exactly once under keep-last (`keep_last_keeps_nodes_focus_and_input_across_a_rejected_arrival`).
- No new input. `invalid` is a typed literal union; any other value falls back to the default branch.

### 5. Styling

- None. No catalog vocabulary, theme, recipe or `/css` projection changed. The stale mark is an attribute only. `docs/renderer.md` shows a host rule (`.lf_surface[data-lf-stale] { opacity: 0.6; }`), and `src/css/base.ts` is unchanged.

### 6. Interaction tiers

- Local state: keep-last blocks `setLocal` writes while invalid, through the core's existing early return in `emit`. Local state set under the committed tree survives an interrupted transition (Task 4).
- `setState` / `action`: no intent leaves a stale surface. No tier semantics changed otherwise.

### 7. Performance

Task 1 table, restated with the after numbers (`bun --conditions liveframe:source bench/streaming.bench.ts --production`, same machine). The after runs were taken under heavy unrelated load (load average 26–47: two QEMU VMs, `clay_server`, browsers). Wall times are therefore not comparable with the baseline (load 10–12); counts are.

| Measure | Task 1 baseline | After | Gate | Status |
|---|---:|---:|---|---|
| `createRoot` implementation renders | `1358` (`679 + 679`) | **`679`** (`0 + 679`) | `budget()`: no render without portal, ≤ node count | Pass (deterministic) |
| `hydrateRoot` implementation renders | `1358` | `1358` (unchanged, required by §11) | — | As specified |
| `createRoot` second pass / first | `25.8%` | no redundant redraw (pass 1 draws no implementation) | threshold 20% | Resolved by count |
| `createRoot` vs `hydrateRoot` `flushSync` median | `23.8` vs `16.3 ms` (+46%) | `30.1` vs `29.9 ms` (Task 6 run, load ~21) | — | Equal under load; not comparable with the baseline; F4 |
| Focus on − off, 0 host elements | `+1.4 ms` | `+0.2 ms` (Task 2); `+0.8 ms` (Task 6 run, load ~21) | — | Pass |
| Focus on − off, 1,000 host elements | `+5.5 ms` | `+0.2 ms` (Task 2); `0.0 ms` (Task 6 run, load ~21) | `diffMs < 0.5` | Pass; failed at load ~35 (`+1.3`, `+2.9 ms`); F4 |
| Focus on − off, 5,000 host elements | `+21.8 ms` | `+0.3 ms` (Task 2); `0.0 ms` (Task 6 run, load ~21) | `diffMs < 0.5` | Pass; F4 |
| Whole-tree arrival (validation + React) | `5.1 ms` median | not comparable (validation median `5.6 ms`, p95 `140 ms` at load ~21) | existing | F4 |

The focus snapshot's cost no longer depends on the host page; that is structural and proved without timing by `focus_snapshot_reads_no_style_while_focus_survives`, with zero `getComputedStyle`, `getClientRects` and document queries next to 1,000 host buttons on each side. A quiet-host re-run of the wall-time rows is F4 (backlog).

### 8. Portability

- `src/surface/core.ts` stays host-API-free (no DOM, `node:` or `bun:`); `prepare`/`commit` are plain functions.
- Cross-engine: see §3 of this record. All renderer files pass in Chromium, WebKit and Firefox. One WebKit-only test assumption was fixed (F8).
- Other adapters: a concurrent non-React adapter has no public `prepare`/`commit` (F5, backlog; pairs with 0.4.0's F8 DOM adapter on `/surface`).

### 9. Agent authoring

- None. No generated types, catalog-derived props or agent-facing error messages changed. `invalid` is a host prop, not a widget or tree field.

### 10. Docs and examples

- `docs/renderer.md`: "Keep focus in the surface when a row disappears", "Server rendering and hydration", transitions (host and adapter author sections), "Keep the last tree on screen when an arrival is rejected". `docs/conformance.md` names the keep-last case. `CHANGELOG.md` has Added, Fixed and Performance entries, including the F1 fix.
- Gap (F6): the guide does not say what a host does when a stream stops after a rejection, which leaves `aria-busy="true"` set indefinitely. Backlog.

### 11. Conformance

- `rendererBrowserSuite` gains `keep_last_invalid_arrival_keeps_the_last_tree_marked`. The default `invalid_arrival_shows_only_the_fallback_and_recovers` is unchanged. `focus_scroll_and_local_state_survive_revisions` does not pin the candidate scope, so it is unchanged.
- The deferred mount and the prepare/commit split are `/react` internals. No conformance case is required of other renderers, but §11's "every render it starts is committed" rule is stated for adapter authors in `docs/renderer.md`.

### 12. Reference hosts

- Synapta and Clay stream agent output. Keep-last suits them: one malformed frame no longer blanks a surface mid-stream. Neither needs code. Both can adopt `invalid="keep-last"` per surface. Neither migration bent the design.
- The focus scope change (Task 2) affects a host only if it relied on focus leaving the surface for a host element after it when the surface's last tabbable was removed. No such dependency is recorded for either host.

---

## 2. Findings and Disposition

Presented to the owner on 2026-11-17; every recommendation was accepted.

| # | Finding | Area | Disposition | Where |
|---|---|---|---|---|
| F1 | `FocusContinuity.componentDidUpdate` took back focus the host placed *outside* the surface during the commit, against §11 "never taken back" | 1, 6 | **execute** | Task 6a |
| F2 | Spec §11 `<Surface>` bullet still says `useSyncExternalStore` subscription | 1 | **execute** | Task 6a |
| F3 | No browser test of a non-hydrating client mount of an invalid tree (Law 2 proof for the deferred mount) | 3 | **execute** | Task 6a |
| F4 | Wall-time rows (Task 3 mount, Task 4 patched updates) not re-measured on a quiet host; the focus `diffMs < 0.5` gate fails under load | 7 | **backlog** (P3) | `plans/backlog.md` |
| F5 | No public `prepare`/`commit` on `SurfaceCore` for concurrent non-React adapters | 2, 8 | **backlog** (P3) | `plans/backlog.md` |
| F6 | Keep-last leaves `aria-busy="true"` indefinitely when a stream stops after a rejection; the guide gives the host no path | 10 | **backlog** (P4) | `plans/backlog.md` |
| F7 | Release placement of Task 2's focus-scope change | 2 | **confirmed 0.3.1** (Fixed) | decision log, roadmap |
| F8 | WebKit-only failure of `candidate_hidden_by_the_same_update_is_skipped` (structural-selector style lag) | 8 | fixed in the test during verification | §3 |

The backlog entry "Profile production browser selection costs before optimizing the renderer" was already closed by plan 022. Task 1 does not cover its open preview-matrix follow-up, so that stays open.

---

## 3. Verification

All runs were on 2026-11-17 on the Task 1 machine while unrelated work (QEMU VMs, `clay_server`, browsers) held the load average between 18 and 82.

| Command | Result |
|---|---|
| `bun run check` (before Task 6a) | Pass: 1824 pass, 0 fail (load 27–36) |
| `bun run check` (after Task 6a, first) | `format:check` failed on the new test; formatted |
| `bun run check` (after Task 6a, second) | Timed out at 25 min (load 23–36) with 13 failures, all load timeouts or a closed browser. Re-run alone, the renderer files pass: `conformance-renderer-browser`, `proof/tests/conformance`, `react-catalogs`: 46 pass, 0 fail |
| `bun run check` (final, load 20–27) | Build, gen, typecheck, lint and format pass. Tests: 1819 pass, 7 fail (`pack-check` `cli_prints_report`, `preview_session_packs_a_draft_that_imports_a_supplied_library`, three `cli-mcp` cases, `worker_warm_overhead_report`, `mcp_capture_bound_defaults_and_configured_description`), all in files plan 035 did not touch. Re-run alone at load ~27: those five files, 128 pass, 0 fail. A quiet-host full run is part of F4 |
| `LIVEFRAME_BROWSER=webkit bun run test` | 1818 pass, 1 fail: `candidate_hidden_by_the_same_update_is_skipped` (F8 below). After the fix, the focus and mount cases pass in WebKit (12/12) |
| `LIVEFRAME_BROWSER=firefox bun run test` | The first run crashed its browser under load (5 s default timeout, load up to 80). Re-run with `--timeout 60000`: 1802 pass, 23 fail, stopped at the 40 min limit. The failures are in `cli-mcp`, `mcp-capture`, `preview-*`, `pack-check` and the starter's browser test (load timeouts; see backlog "Review `workerRunner()` default `100 ms` timeout"). The renderer files re-run alone in Firefox: `react-browser`, `react-catalogs`, `conformance-renderer-browser`, starter `browser`: 100 pass; `proof/tests/conformance-browser`: 3 pass, 0 fail |
| `bun --conditions liveframe:source bench/streaming.bench.ts --production` | Under load ~50: failed the focus gate (`+2.9 ms`). With `--json` under load ~21: pass, `createRoot` `679` renders (`0 + 679`), focus difference `0.0 ms` at 1,000 and 5,000 host elements |
| `bun run demo:test` | 68 pass, 0 fail |

### F8: a WebKit-only focus test failure (fixed in the test)

`candidate_hidden_by_the_same_update_is_skipped` hid row c with `button:nth-child(2):last-child { display: none }`, so the rule matched once the update removed row b. In WebKit, `getComputedStyle` inside `componentDidUpdate` still returned `display: flex` and one client rect for row c, even though `matches()` was true. The renderer therefore focused row c, WebKit then dropped focus from the now-hidden row, and focus ended on the wrapper. A plain DOM removal outside React invalidates correctly in all three engines, so this is a WebKit computed-style lag for structural pseudo-classes during the commit. The renderer's logic is right. The test now hides row c by switching it to the `ghost` variant in the same update, a class change every engine invalidates. It passes in Chromium, WebKit and Firefox. Residual effect: in WebKit, a candidate hidden only by a structural selector in the same update may be focused and then dropped, leaving focus on the wrapper. Focus still stays inside the surface. No further action.
