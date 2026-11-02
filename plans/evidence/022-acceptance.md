# 0.2.2 Acceptance Proof

Every acceptance bullet in the [0.2.2 plan (`plans/022-Phase-7-Part-I-Release-0-2-2-Performance-And-Accessibility.md`)](../022-Phase-7-Part-I-Release-0-2-2-Performance-And-Accessibility.md) — including all Expected Outcome bullets and every task criterion (Tasks 1 to 13) — proven against this checkout.

## Verification Runs

- **Host & Environment:** Linux 7.3.0-4-cachyos, AMD Ryzen 9 PRO 7940HS w/ Radeon 780M Graphics (16 logical CPUs), Bun 1.4.4.
- **Verification Commands Executed:**

| Command | Result | Duration / Scope |
| --- | --- | --- |
| `bun run check` | **PASS** | 999 pass, 4 skip, 0 fail (124,630 expect() calls; 112 files); build, gen:check, typecheck, lint, format:check clean |
| `bun run bench` | **PASS** | All 4 benchmark suites green (validator, render, CSS, streaming) |
| `bun run release:gate` | **PASS** | All 13 gate steps passed in 3.8s |
| `bun scripts/release/peer-floors.ts` | **PASS** | React 19.0.0 (111 pass), Playwright 1.49.0 (23 pass), MCP Server 2.0.0 (76 pass) |
| `bun run demo:test` | **PASS** | Packed archive installed into demo host; `tsc --noEmit` and 52 tests pass (32.2s) |
| Scratch host from v0.2.1 code | **PASS** | Unmodified v0.2.1 demo host code upgraded to checkout tarball: 52 pass, 0 fail (32.6s) |
| `src/__tests__/api-stability.test.ts` | **PASS** | 7 pass, 0 fail (587ms); baseline, register, deferred rules and adopter notes verified |
| `src/__tests__/portability.test.ts` | **PASS** | 16 pass, 0 fail (2,417 expect() calls); all subpaths host-API-free |

---

## Expected Outcome Bullets

| # | Expected Outcome | Status | Evidence |
|---|---|---|---|
| 1 | `@arnilo/liveframe@0.2.2` is on npm with provenance under `latest`. `next` is at or above it. | **Deferred to Task 15/16** | Registry fact proven at release time. Workflow `.github/workflows/publish.yml` with provenance and `dist-tag add` step verified. |
| 2 | `src/__tests__/api-stability.test.ts` passes. Every 0.2.1 export still exists with an identical declaration, or with a change that `scripts/release/api/register-0.2.2.json` lists as additive with a reason and the host action needed. Every 0.2.1 corpus case, hash vector and patch vector is byte-identical. | **PASS** | `src/__tests__/api-stability.test.ts` passes 7/7: `baseline_matches_the_checkout_before_any_022_change`, `removed_export_fails`, `changed_declaration_without_entry_fails`, `stale_register_entry_fails`, `changed_corpus_file_fails`, `deferred_entry_with_shipped_change_fails`, `register_host_actions_appear_in_adopter_notes`. |
| 3 | Arrival of a whole tree (LF-17 subject, `bench/streaming.bench.ts`) takes at most 5.0 ms median for validation plus React work in the development build, down from 10.7 ms. Patch mode does not regress. `plans/evidence/022-browser-profile.md` records production-build figures before and after. | **PASS** | Whole-tree arrival validation + React work: **2.800 ms** median (dev, ≤ 5.0 ms target; [019-streaming-bench.md](019-streaming-bench.md)) and **2.000 ms** median (prod; [022-streaming-production.md](022-streaming-production.md)). Patch mode: **2.600 ms** median (dev, ≤ 2.97 ms gate; [021-streaming-patches.md](021-streaming-patches.md)) and **1.800 ms** median (prod; [022-streaming-patches-production.md](022-streaming-patches-production.md)). Production figures before/after recorded in [022-browser-profile.md](022-browser-profile.md). |
| 4 | A second `compileValidator` call that reuses the same catalog and capabilities content costs at most 0.25 ms median on the proof catalog, down from 0.73 ms, and still returns a new validator object. | **PASS** | `compileValidator: same catalog and capabilities, different manifest`: **0.1164 ms** median (≤ 0.25 ms target; `bench/validator.bench.ts`). Unit tests `second_compile_reuses_catalog_work_and_returns_a_new_validator`, `mutated_catalog_compiles_fresh`, `invalid_catalog_never_hits_cache` in `src/__tests__/validator-smoke.test.ts`. |
| 5 | A host that upgrades from 0.2.1 and changes nothing sees identical trees, CSS bytes, intents, origins, errors and focus behaviour. The only difference is fewer React renders of unchanged nodes, which is invisible to pure implementations. A host opts into each new capability by using it. | **PASS** | `unused_new_states_leave_css_byte_identical` (`src/__tests__/css-design-system.test.ts`: certified 152,019 B, rack 164,152 B byte-identical to 0.2.1). `default_surface_drops_focus_as_in_0_2_1` (`src/__tests__/react-browser.test.tsx`). Scratch host built against v0.2.1 demo host code passes all 52 tests unmodified. |
| 6 | `CHANGELOG.md`, `docs/compatibility.md` (0.2.2 section and Growth), `docs/adopters-0.2.md` and the outsider guides describe every addition. A "Deferred to 0.3.0" list carries, with a full migration entry, any item that a task found would break a contract. | **PASS** | `docs-links.test.ts`, `docs-wording.test.ts`, and `register_host_actions_appear_in_adopter_notes` in `src/__tests__/api-stability.test.ts` pass. `CHANGELOG.md` § 0.2.2, `docs/compatibility.md` (§ 0.2.2, Growth, § Deferred to 0.3.0), and `docs/adopters-0.2.md` (§ 0.2.2) complete. |

---

## Tasks 1 to 13 Acceptance Proof

### Task 1: Freeze 0.2.1 API surface & gate register

| Criterion | Status | Evidence |
|---|---|---|
| `scripts/release/api-surface.ts` emits deterministic JSON of exported declarations + SHA-256 file hashes | PASS | Implemented and verified via `api-surface.ts` running over all typed subpaths. |
| `scripts/release/api/0.2.1.json` generated from `v0.2.1` tag worktree | PASS | Baseline file committed and verified with command recorded in header. |
| `src/__tests__/api-stability.test.ts` fails on removed export, changed declaration without entry, stale register entry, schema change without entry, corpus/hash/patch edit, deferred entry shipped | PASS | `src/__tests__/api-stability.test.ts` unit tests: `removed_export_fails`, `changed_declaration_without_entry_fails`, `stale_register_entry_fails`, `changed_corpus_file_fails`, `deferred_entry_with_shipped_change_fails`. |
| `scripts/release/api/register-0.2.2.json` tracks additions | PASS | 20 registered entries (4 added, 13 widened, 3 deferred) pass gate. |

### Task 2: Profile browser costs on a production React build

| Criterion | Status | Evidence |
|---|---|---|
| `bench/streaming.bench.ts` and `renderer-browser.test.tsx` gain production mode (`NODE_ENV=production`, `performance.now()` around `flushSync`) | PASS | `bench/streaming.bench.ts --production`, `selection_rerender_cost_is_recorded_in_production` in `proof/tests/renderer-browser.test.tsx`. |
| `plans/evidence/022-browser-profile.md` records dev & prod figures (JSON parse, validation, React, layout + paint) | PASS | [022-browser-profile.md](022-browser-profile.md) records full splits for whole-tree, patches, and 679-node selection update under certified and rack design systems. |
| Dominant cost identified | PASS | React work identified as dominant cost (87% dev, 76% prod whole-tree; 86% prod selection). |
| Backlog P2 entry closed | PASS | Backlog P2 entry closed in `plans/backlog.md` with link to record. |

### Task 3: Reuse unchanged nodes when whole tree arrives

| Criterion | Status | Evidence |
|---|---|---|
| `<Surface>` substitutes accepted tree's node objects for deep-equal subtrees | PASS | `reused_tree_deep_equals_the_arrival` in `src/__tests__/react-surface.test.tsx`. |
| React skips unchanged subtrees by identity bailout | PASS | `whole_tree_arrival_reuses_unchanged_nodes` in `src/__tests__/react-browser.test.tsx` (only changed row and ancestors render). |
| Failed node never reused and retries on next arrival | PASS | `failed_node_retries_on_next_arrival` in `src/__tests__/react-browser.test.tsx`. |
| Origins name accepted revision; focus, scroll, local state survive | PASS | `whole_tree_arrival_reuses_unchanged_nodes` in `src/__tests__/react-browser.test.tsx` (click names revision 2, local state preserved). |
| LF-17 whole-tree median validation + React work ≤ 5.0 ms in dev build | PASS | Measured **2.800 ms** median (dev, [019-streaming-bench.md](019-streaming-bench.md)) and **2.000 ms** median (prod, [022-streaming-production.md](022-streaming-production.md)). |
| Reuse pass timed separately ≤ 1.0 ms median at 679 nodes | PASS | Measured **0.200 ms** median (`bench/streaming.bench.ts`). |
| Patch mode does not regress (≤ 2.7 ms + 10% = ≤ 2.97 ms) | PASS | Measured **2.600 ms** median (dev, [021-streaming-patches.md](021-streaming-patches.md)) and **1.800 ms** median (prod, [022-streaming-patches-production.md](022-streaming-patches-production.md)). |
| Internal function in `src/react/share.ts`, no `React.memo`, no new component layer | PASS | `shareNodes` in `src/react/share.ts`; no component wrappers added. |

### Task 4: Reuse compiled catalogs across validators

| Criterion | Status | Evidence |
|---|---|---|
| `compileValidator` caches catalog-level work keyed by canonical/JSON content; returns new `CompiledValidator` object | PASS | `second_compile_reuses_catalog_work_and_returns_a_new_validator` in `src/__tests__/validator-smoke.test.ts`. |
| Mutating input document compiles fresh | PASS | `mutated_catalog_compiles_fresh` in `src/__tests__/validator-smoke.test.ts`. |
| Invalid catalog never hits cache | PASS | `invalid_catalog_never_hits_cache` in `src/__tests__/validator-smoke.test.ts`. |
| Worker runner caches validator by package hash | PASS | `worker_runner_reuses_validator_per_package_hash` in `src/__tests__/runner-worker.test.ts`. |
| Demo host caches validator by package hash | PASS | `examples/demo-host/server.ts:37-43` (`validatorFor`). |
| Second compile with equal catalog/capabilities ≤ 0.25 ms median | PASS | Measured **0.1164 ms** median (`bench/validator.bench.ts`). |
| Worker runner host revalidation overhead recorded | PASS | Recorded in `docs/packages.md` (0.907 ms median, 2.256 ms p95); backlog P4 closed. |

### Task 5: Add bindSources() and renderKey()

| Criterion | Status | Evidence |
|---|---|---|
| `bindSources(manifest, capabilities, { params, state, context })` evaluates literals and `{ from, path }` bindings | PASS | `binds_literals_params_state_and_context_paths` in `src/__tests__/manifest.test.ts`. |
| Missing optional binding omitted; missing required is `invalid-prop` at pointer | PASS | `missing_optional_binding_is_omitted_and_missing_required_is_invalid_prop` in `src/__tests__/manifest.test.ts`. |
| Resolved parameters checked against source schema | PASS | `bound_params_are_checked_against_the_source_schema` in `src/__tests__/manifest.test.ts`. |
| Non-JSON input fails closed as `invalid-prop`, never throws | PASS | `non_json_input_fails_closed` in `src/__tests__/manifest.test.ts`. |
| `renderKey({ hash, catalogId, params, state, data, context })` produces SHA-256 ignoring key order | PASS | `render_key_ignores_key_order_and_changes_with_any_input` in `src/__tests__/pack-hash.test.ts`. |
| Pure and host-API-free; register entries added | PASS | `src/__tests__/portability.test.ts`; register entries `added` for `bindSources` and `renderKey`. |

### Task 6: Opt-in, recipe-derived contrast audit

| Criterion | Status | Evidence |
|---|---|---|
| `auditContrast` evaluates all (kind, variant, slot, state) pairs for text (4.5:1 / 3:1) and non-text (3:1) | PASS | `audit_reports_text_pair_from_recipe_not_declared_in_vocabulary`, `large_text_uses_three_to_one`, `focus_outline_non_text_contrast` in `src/__tests__/contrast-audit.test.ts`. |
| Alpha composited with spec §6.5 algorithm; unresolved background reported | PASS | `alpha_and_background_opacity_composite_once`, `unresolved_background_is_reported` in `src/__tests__/contrast-audit.test.ts`. |
| `designSystemSuite` gains opt-in `contrast: true \| { minimums }` | PASS | `suite_without_contrast_option_is_unchanged`, `suite_with_contrast_option_fails_on_finding` in `src/__tests__/conformance-design-system.test.ts`. |
| Install-time only, no colour introduced; register entries added/widened | PASS | Register entries `added` for `auditContrast`, `ContrastFinding` and `widened` for `designSystemSuite`. |

### Task 7: Opt-in focus continuity to <Surface>

| Criterion | Status | Evidence |
|---|---|---|
| With `<Surface focusContinuity>`, disconnected focused element continues to next tabbable, then previous, then wrapper (`tabIndex={-1}`) with `preventScroll: true` | PASS | `removed_focused_row_moves_focus_to_next_row`, `last_row_removed_moves_focus_to_previous`, `empty_surface_focuses_wrapper` in `src/__tests__/react-browser.test.tsx`. |
| Focus outside surface left alone | PASS | `focus_outside_surface_is_left_alone` in `src/__tests__/react-browser.test.tsx`. |
| Portal focus continued | PASS | `portal_focus_is_continued` in `src/__tests__/react-browser.test.tsx`. |
| Without prop, behaviour is byte-for-byte 0.2.1 | PASS | `default_surface_drops_focus_as_in_0_2_1` in `src/__tests__/react-browser.test.tsx`. |
| Register entry widened for `createRenderer` (`SurfaceProps`) | PASS | Registered in `scripts/release/api/register-0.2.2.json`. |

### Task 8: Add pending, mixed, current, readonly recipe states

| Criterion | Status | Evidence |
|---|---|---|
| `states` gains `pending`, `mixed`, `current`, `readonly`; correct source order | PASS | `new_states_validate_and_project_in_order` in `src/__tests__/css-design-system.test.ts`. |
| Selectors match table; pending suppresses hover and active when declared | PASS | `new_states_validate_and_project_in_order` in `src/__tests__/css-design-system.test.ts`. |
| Forced-colours table adds rows for each new state | PASS | `forced_colours_rows_for_new_states` in `src/__tests__/css-browser.test.ts`. |
| `emit` returns promise when host's `onIntent` returns one; rejection contained | PASS | `emit_returns_host_promise_and_undefined_otherwise`, `emit_rejection_is_contained` in `src/__tests__/react-intents.test.tsx`. |
| Unused new states leave CSS byte-identical (certified 152,019 B, rack 164,152 B) | PASS | `unused_new_states_leave_css_byte_identical` in `src/__tests__/css-design-system.test.ts`; `bench/css.bench.ts`. |
| Conformance: styled states require fixtures only when styled | PASS | `new_states_require_fixtures_when_a_system_styles_them` in `src/__tests__/conformance-states.test.ts`. |
| Type test: void emit assignment still compiles | PASS | `void_emit_assignment_still_compiles` in `src/__tests__/react-types.test.tsx`. |
| Register entries widened for `states`, `design-system.json`, `createRenderer`, `ImplementationProps` | PASS | Registered in `scripts/release/api/register-0.2.2.json`. |

### Task 9: Design node references (decision log; owner approval)

| Criterion | Status | Evidence |
|---|---|---|
| Proposal settles authoring, wire form, validation, renderer DOM ids, codegen, ports | PASS | Proposal in [022-node-reference-design.md](022-node-reference-design.md). |
| Owner approval recorded | PASS | Owner approved deferral to 0.3.0 on 2026-11-02; recorded in [decision-logs/2026-11-02-1219-defer-node-references-to-0-3-0.md](../../decision-logs/2026-11-02-1219-defer-node-references-to-0-3-0.md). |
| Register entries marked `deferred` | PASS | 3 `deferred` entries in `scripts/release/api/register-0.2.2.json`: `./sdk ref`, `. NodeRef`, `./schemas/* catalog.json`. |

### Task 10: Implement approved node references or record deferral

| Criterion | Status | Evidence |
|---|---|---|
| Closed as `n/a — deferred to 0.3.0` per Task 9 approval | PASS | Task 10 marked `n/a — deferred to 0.3.0`; no code shipped; gate test `deferred_entry_with_shipped_change_fails` prevents accidental leakage. |

### Task 11: Add accessibility capture axes

| Criterion | Status | Evidence |
|---|---|---|
| `capture()` takes optional `media?: { textScale?, forcedColors?, reducedMotion? }`; multiplies cells within `maxCells` | PASS | `media_axes_multiply_cells_and_respect_max_cells` in `src/__tests__/preview-capture.test.ts`. |
| `CaptureSession.emulate?(media)` implemented by `playwrightBackend` | PASS | `text_scale_two_doubles_root_font`, `forced_colors_cell_differs_and_reports_media` in `src/__tests__/preview-capture.test.ts`. |
| Backend without `emulate` refuses media with typed `CaptureError` | PASS | `backend_without_emulate_refuses_media_with_typed_error` in `src/__tests__/preview-capture.test.ts`. |
| Media coordinates recorded only when media requested | PASS | `capture_media_is_returned_only_when_requested` in `src/__tests__/authoring.test.ts`. |
| CLI, `/authoring`, MCP `capture_preview` support media flags & schemas | PASS | `cli_media_flags_multiply_the_cells` in `proof/tests/preview-capture.test.ts`; `calls_without_media_are_byte_identical_and_media_is_reported` in `src/__tests__/cli-mcp.test.ts`. |
| Calls without media are byte-identical to 0.2.1 | PASS | `calls_without_media_are_byte_identical_and_media_is_reported` in `src/__tests__/cli-mcp.test.ts`. |
| Register entries added/widened with `hostAction: none` | PASS | 8 registered entries in `scripts/release/api/register-0.2.2.json`. |

### Task 12: Design extension recipe properties and multiple variant axes for 0.3.0

| Criterion | Status | Evidence |
|---|---|---|
| Proposals in `plans/evidence/` settling format change, Law 3, projection, cascade, compatibility, migration | PASS | Proposals in [022-extension-properties-design.md](022-extension-properties-design.md) and [022-variant-axes-design.md](022-variant-axes-design.md). |
| Owner approval recorded with `create-decision-log` | PASS | Owner approved both on 2026-11-02: [decision-logs/2026-11-02-2208-extension-recipe-properties-for-0-3-0.md](../../decision-logs/2026-11-02-2208-extension-recipe-properties-for-0-3-0.md) and [decision-logs/2026-11-02-2208-multiple-variant-axes-for-0-3-0.md](../../decision-logs/2026-11-02-2208-multiple-variant-axes-for-0-3-0.md). |
| Approved designs added to `roadmap.md` as 0.3.0 scope; no code ships in 0.2.2 | PASS | `roadmap.md` updated; register unchanged; no declaration changes. |

### Task 13: Write 0.2.2 documentation and compatibility notes

| Criterion | Status | Evidence |
|---|---|---|
| `CHANGELOG.md` 0.2.2 entry listing Added, Widened, Deferred | PASS | `CHANGELOG.md` § 0.2.2 lists all 20 register entries grouped by category. |
| `docs/compatibility.md` gains 0.2.2 section, Growth lines, Deferred section | PASS | `docs/compatibility.md` § 0.2.2, Growth lines, and § Deferred to 0.3.0 with code migration examples. |
| `docs/adopters-0.2.md` gains 0.2.2 section with code examples, "nothing to do" line, and verbatim register table | PASS | `docs/adopters-0.2.md` § 0.2.2 complete; `register_host_actions_appear_in_adopter_notes` asserts verbatim match. |
| Outsider docs updated; links and wording tests pass; `docs/security.md` audited | PASS | `docs-links.test.ts`, `docs-wording.test.ts` pass; `docs/security.md` § 0.2.2 audit added. |

---

## Performance Targets Re-measurement

Re-measured on this checkout:

| Performance Target | Budget / Gate | Re-measured Result | Verdict |
| --- | --- | --- | --- |
| LF-17 whole-tree validation + React work (dev) | ≤ 5.0 ms median (down from 10.7 ms) | **2.800 ms** median ([019-streaming-bench.md](019-streaming-bench.md)) | **PASS** |
| LF-17 whole-tree validation + React work (prod) | Recorded | **2.000 ms** median ([022-streaming-production.md](022-streaming-production.md)) | **PASS** |
| Whole-tree node reuse pass alone (679 nodes) | ≤ 1.0 ms median | **0.200 ms** median (`bench/streaming.bench.ts`) | **PASS** |
| LF-17 patch mode validation + React work (dev) | ≤ 2.97 ms median (2.7 ms + 10%) | **2.600 ms** median ([021-streaming-patches.md](021-streaming-patches.md)) | **PASS** (No regression) |
| LF-17 patch mode validation + React work (prod) | Recorded | **1.800 ms** median ([022-streaming-patches-production.md](022-streaming-patches-production.md)) | **PASS** |
| `compileValidator` catalog reuse (Task 4) | ≤ 0.25 ms median (down from 0.73 ms) | **0.1164 ms** median (`bench/validator.bench.ts`) | **PASS** |
| `compileValidator` cold first compile | Recorded | **0.9222 ms** median (`bench/validator.bench.ts`) | **PASS** |
| `diffTrees` on 679-node subject | ≤ 1.5 ms median | **0.5597 ms** median (`bench/validator.bench.ts`) | **PASS** |
| `applyPatch` on 679-node subject | ≤ 0.5 ms median | **0.1285 ms** median (`bench/validator.bench.ts`) | **PASS** |
| `agent-home` standalone validation | ≤ 1.5 µs/node | **1.314 µs/node** (`bench/validator.bench.ts`) | **PASS** |
| `agent-home` SDK render | ≤ 3.0 µs/node, ≤ 2.0 ms | **1.942 µs/node, 1.3184 ms** (`bench/render.bench.ts`) | **PASS** |
| CSS projection bytes (Certified / Rack) | Byte-identical to 0.2.1 | **152,019 B / 164,152 B** (`bench/css.bench.ts`) | **PASS** |

---

## Git Diff Analysis against v0.2.1

`git diff v0.2.1 -- src/__tests__ proof/tests conformance`:
- **Files changed:** 33 files (16,884 insertions, 5,385 deletions).
- **Nature of changes:**
  - **New test files:** `src/__tests__/api-stability.test.ts`, `src/__tests__/contrast-audit.test.ts`, `src/__tests__/conformance-design-system.test.ts`, `src/__tests__/conformance-states.test.ts`, `src/__tests__/css-browser.test.ts`, `src/__tests__/react-intents.test.tsx`, `src/__tests__/react-surface.test.tsx`, `src/__tests__/react-types.test.tsx`.
  - **New corpus cases:** `conformance/corpus/design-system/new-states.json`, `conformance/corpus/design-system/unknown-state.json`, and their doc counterparts.
  - **Register-named edits:**
    - `states` widened with 4 new states (`pending`, `mixed`, `current`, `readonly`): updated resolved-recipes fixtures (`certified.resolved-recipes.json`, `rack.resolved-recipes.json`: 312 added recipes per system for new states, 0 removed/modified); updated tests asserting recipe counts from 624 to 936 (`design-system.test.ts`, `proof-formats.test.ts`, `resolve.test.ts`).
    - `CaptureOptions.media` added: `preview-capture.test.ts`, `proof/tests/preview-capture.test.ts`, `cli-mcp.test.ts`, `authoring.test.ts`, and test fixture `capture-backend.ts` (`emulate`).
    - `bindSources` & `renderKey` added: `manifest.test.ts`, `pack-hash.test.ts`, `exports.test.ts`.
    - `focusContinuity` & whole-tree node reuse added: `react-browser.test.tsx`, `fixtures/react-client.tsx`, `fixtures/react-surface.tsx`.
    - Production browser profiling added: `proof/tests/renderer-browser.test.tsx`, `proof/tests/fixtures/renderer-client.tsx`.
    - Validator reuse caching added: `validator-smoke.test.ts`, `runner-worker.test.ts`.
  - **Zero test assertions deleted or weakened.**

---

## The Four Laws Re-checked by Name

1. **Widget code never runs in the browser:**
   - `validator_bundle_omits_the_render_path` (`src/__tests__/validator-bundle.test.ts`).
   - `no_draft_code_reaches_the_page` (`examples/demo-host/tests/intents.test.ts`).
   - `preview_bundle_has_no_draft_code` (`examples/demo-host/tests/preview.test.ts`).
2. **The UI tree is validated data:**
   - `whole_tree_arrival_reuses_unchanged_nodes` (`src/__tests__/react-browser.test.tsx`: arrival validation runs before any structural reuse).
   - `apply_patch_obeys_order_and_ownership` and corpus `tree-patch/` cases (`src/__tests__/tree-patch.test.ts`).
   - `invalid_arrival_renders_only_the_fallback` (`examples/demo-host/tests/conformance.test.ts`).
3. **Widget code never sets colours or raw CSS:**
   - `app_sheets_set_no_colour` (`examples/demo-host/tests/conformance.test.ts`).
   - `style_table_covers_every_fixed_prop_and_bounds` (`src/__tests__/validator-node.test.ts`).
   - `unused_new_states_leave_css_byte_identical` (`src/__tests__/css-design-system.test.ts`).
4. **A widget never holds authority:**
   - `preview_logs_an_action_and_never_dispatches_it` (`examples/demo-host/tests/preview.test.ts`).
   - `check_offered_follows_patched_revision` (`src/__tests__/offered.test.ts`).
   - `intents_are_rechecked_before_dispatch` (`examples/demo-host/tests/intents.test.ts`).
   - `bindSources` resolves no data and runs no action (`src/__tests__/manifest.test.ts`).
