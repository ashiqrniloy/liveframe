# Backlog

Follow-ups handed off from plans. One entry per item; update an entry with the same source and title instead of duplicating it.

## Phase 1 performance gate: 3 µs per node

- Section: Phase 1 (spec §10, §12)
- Priority: P1
- Source: plans/002-Phase-0-Parity-Re-Proof.md (G32), plans/004-Phase-1-Part-B-Compiled-Validator.md, plans/005-Phase-2-Part-A-SDK.md Task 8
- Status: reopened 2026-10-24 for the standalone validator gate (plan 005 Task 10, F8). The full SDK render gate remains delivered.
- Current evidence: `plans/evidence/005-impact-analysis.md` records two failing Bun 1.4.4 validator runs under concurrent machine load: large/full queues at 1.602/1.670 µs/node initially, agent-home at 1.513 on the follow-up. Validator code and its benchmark are unchanged; contention and the Bun upgrade are hypotheses, not proved causes. SDK rendering still passes every ≤3 µs/node and required ≤2 ms gate (agent-home 1.802 µs/node). Run a controlled comparison against the prior Bun 1.4.2 baseline, profile any remaining miss, and retain the strict 1.5 gate; do not retry until a passing sample or relax thresholds.
- Measured (2026-10-23): `timeout 300s bun run bench` passes both gates on Bun 1.4.2 / AMD Ryzen 9 PRO 7940HS. SDK agent-home: 679 nodes, **1.2438 ms / 1.832 µs/node**; core-queue medium/large/full: **0.8085 / 0.9305 / 0.9605 ms**. All eight render workloads pass ≤ 3 µs/node; small is closest at **2.948 µs/node**, with hardware/load sensitivity. Agent-home standalone validation is 1.412 µs/node and estimated remaining work is 0.420; this subtraction is a comparison, not an in-render profile. Full machine/load/output and profiling findings are in plan 005 Task 8. The independent validator gate passes every fixture at ≤ 1.264 µs/node.
- Measured (2026-10-22): `timeout 120s bun bench/validator.bench.ts` passed on Bun 1.4.2 / AMD Ryzen 9 PRO 7940HS. Agent-home: 679 nodes, 0.8361 ms, **1.231 µs/node**, compiled props **15.83×** over equal-work `checkValue`; all eight fixtures ≤ **1.399 µs/node**. See `plans/evidence/004-impact-analysis.md` for the full run and machine/load details. Full validation is not claimed faster than props-only interpretation.
- What:
  - Phase 2 Part A holds **≤ 3 µs per node** through `render()`: 2 ms at the 679-node, 50-row agent-home selection tree, and `core.queue` medium…full under 2 ms at the same sizes. Reserve ≤ 1.5 µs/node for validation and ≤ 1.5 µs/node for the remaining render work; the measured agent-home validator leaves 1.769 µs/node below the total, but this is headroom, not a relaxed budget or proof of the SDK path.
  - Run the equivalent `proof/tests/{agent-home,core-queue,runtime}.bench.ts` workloads against the new SDK and record the numbers in the Phase 2 Part A plan. The historical scripts import the proof runtime; running them unchanged cannot measure `src/`.
  - Take the measured route, not a language change. Of the proof's 5.6 ms, the widget function is 0.12 ms, validation ≈ 3.2 ms and the build pass ≈ 2.1 ms. Build and validate in one pass, check input data once per resolution, and count bytes without stringifying the tree (`decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md`).
- Why: the proof's render path costs 8.5 µs per node (5.75 ms at 679 nodes) against a 2 ms bench, and the owner made the per-node conversion Phase 1's exit criterion (`decision-logs/2026-10-22-1519-phase-0-go.md`). The tree shape is fixed by the approved look, so the cost has to come out of validation, freezing and tree construction — the proof re-walks input data per render and re-checks every node with regex and linear `includes`.

## Settled spec §15 format decisions

- Section: spec §8, §9, §15
- Priority: P2
- Source: plans/001-Phase-0-Primitive-Set-Proof.md
- Status: closed by `decision-logs/2026-10-22-1905-phase-1-format-scope.md`, implemented in plan 003 and reconciled by Task 9.
- Resolution: the primitive set stays per app (spec §5), and action intents may bind an event value into one argument (spec §8–§9). The intent type and structural schema are delivered; plan 004 Task 2 checks binding compatibility, and the SDK/renderer phases implement authoring and dispatch. The license remains the only open item in spec §15.

## Composition surface gaps from the parity re-proof

- Section: Phase 2 (spec §5, §6.3)
- Priority: P3
- Source: plans/002-Phase-0-Parity-Re-Proof.md (G30, G31)
- What:
  - Give `icon` a way to take a tone (G30): row markers and the kicker draw in `currentColor` where the artifact tints attention/danger/info/foil.
  - Give `tab` a content slot so a count can carry its own face (G31): `All` and `12` are separate runs, 12 px mono 8 px apart.
  - Decide the two expressiveness limits the look work found: `position` has no `relative` (no visual effect today), and `basis` accepts only px, so a flex ratio needs nested `width` + `grow` + `shrink`.
- Why: all four are inside the ≤ 1% pixel bar today and none blocks Phase 1's freeze, but each is a real look or layout tool that composition code will ask for. They are composition-surface decisions (a style prop or a slot), not proof fixes.

## Later-phase gaps from the Phase 0 reports

- Section: Phases 1, 3, 4, 6 and 7 (spec §6.4, §8, §10, §11)
- Priority: P2
- Source: plans/001-Phase-0-Primitive-Set-Proof.md, plans/002-Phase-0-Parity-Re-Proof.md, plans/003-Phase-1-Part-A-Formats.md, plans/004-Phase-1-Part-B-Compiled-Validator.md, plans/007-Phase-3-CSS-Projection.md (F1, F6)
- What:
  - Closed in plan 003: G19's new-format catalog and tree fixtures use `textField.onCommit`; the historical proof keeps its event names. G28's reusable install validators for untrusted themes and design systems ship as `validateTheme` and `validateDesignSystem`, with bounded errors, role checks, literal checks and inheritance/completeness tests. Replacing the proof projector is Phase 3, not an outstanding install validator.
  - Closed in plan 007 Task 10: G27 per-surface projection and proof-host adoption, visual parity and ≤ 16.67 ms warm switching. G33's cold first flip remains load-sensitive (including a 25 ms concurrent run); the accepted gate is warm attribute/style resolution, not GPU paint. See `proof/GAPS.md:167–180` and plan 007 Task 12's evidence. Revisit cold-start work only against a host requirement and measured regression.
  - G29 remains open: audit native Windows forced colours, native control/scrollbar geometry and assistive technology across both systems, including every state, edges, focus, keyboard interaction and overlays. Chromium automation now covers state distinctness, edges, preferences and scoped portals; it does not establish real platform or assistive-technology behavior. Record machine, OS/browser/AT versions and reproducible audit results before claiming closure.
  - G20 is closed: plan 004 supplies code-point-aware validation, and plan 008 Task 7 supplies code-point-aware editing/commit enforcement in the app-owned proof text field. `proof/tests/renderer-browser.test.tsx` proves emoji at the limit commit and excess input is refused; `docs/renderer.md` explains why native HTML maxlength is unsuitable. The library ships no primitives.
  - Disposition (`decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md`): Phase 4 Part A completes G20's renderer half in the test host's `textField` (code-point limits) with an implementer note in the docs; the library ships no primitives. G26 (app-owned icon sets) moves to Phase 7. G29's audit is a Phase 6 release gate.
- Why: the proof built these parts proof-grade only. Surface typography (G12) is closed: spec §6.4 now requires it and the proof proves it (`surface_text_never_inherits_host_fonts`). `proof/REPORT.md` §6 assigns each remaining one to the phase that builds the real part.

## Seed conformance suites from the proof tests

- Section: Phase 5 (spec §13 `/conformance`)
- Priority: P3
- Source: plans/001-Phase-0-Primitive-Set-Proof.md, plans/002-Phase-0-Parity-Re-Proof.md, plans/003-Phase-1-Part-A-Formats.md, plans/004-Phase-1-Part-B-Compiled-Validator.md, plans/005-Phase-2-Part-A-SDK.md (F4), plans/006-Phase-2-Part-B-Packages-Storage-Runners.md (F3), plans/007-Phase-3-CSS-Projection.md Task 11 (Tasks 3–9), plans/008-Phase-4-Part-A-React-Renderer.md Task 10 (Tasks 2–8)
- What: use the proof's suites as prior art — `proof/tests/`:
  - `catalog.test.ts`, `styles.test.ts`, `projection.test.ts`, `renderer.test.tsx`, `renderer-browser.test.tsx` for definitions, completeness, colour authority, the registry check and reconciliation against two real design systems;
  - `runtime.test.ts` for the closed-data checks Plan 002 added: `fill_accepts_only_declared_fillable_roles`, `responsive_style_values_are_closed_data`, `semantics_are_a_closed_enum_with_terms_child_rules`, `position_fill_radius_and_text_alignment_validate`;
  - `agent-home-browser.test.ts` for disclosure, `aria-current`, semantics landmarks and the terms/term/detail rules;
  - `proof/scripts/parity.ts` and `proof/scripts/inventory.ts` for the look bar itself: pixel capture, the capture-alignment rule, and the wrapper-collapsing inventory that turns a positional DOM count into causes.
  - `src/__tests__/{schema,vocabulary,catalog,manifest,theme,design-system,resolve,tree,schemas,proof-formats,portability}.test.ts` for the published formats: closed data, bounded pointed errors, catalog versioning, capability/source bindings, font safety, colour authority, cascade/inheritance, strict schema agreement, reproducible proof recipes and host-API portability. Reuse these cases in the Phase 5 suites; do not import proof implementations into the core.
  - `src/__tests__/{compiled-schema,validator-node,validator-tree,validator-rules,exports}.test.ts` for compiled/interpreted agreement, every spec §10 rule, bind/state/action compatibility, exact UTF-8 bytes, configurable traversal/error limits, pointed repair feedback and the public validator contract. Keep `validator-smoke.test.ts` and `bench/validator.bench.ts` as internal performance gates; transport arrival checks and dispatch-time authorisation are covered by the Plan 008 renderer/host integration cases below.
  - `src/__tests__/sdk-{render,inputs,proof-widgets,gen-types}.test.*` supplies SDK-generated tree/intent cases for catalog and renderer conformance: independent tree acceptance, vocabulary rejection, stable keyed/fragment ids, explicit/carried/bound intent compatibility and all named proof scenarios. Renderer integration must preserve focus, scroll and local state across reordered key paths and validate completed event arguments before dispatch. Keep element branding, input identity caching, generated-source formatting and SDK timing tests internal; do not add a public SDK suite beyond spec §13's catalog/design-system/renderer/store suites.
  - Seed the Phase 5 renderer suite from Plan 008 Tasks 2–8. Run the behavioral cases against any app's catalog, themes, design systems and implementations, using app-supplied fixtures and interaction drivers for the relevant primitives. Replace proof kind names, selectors, actions and package/HTTP wiring; do not import proof implementations into `/conformance`. Exercise each installed design system. Registry, arrival, fallback, intent and scope contracts are generic; local controls, collections, text fields and overlay lifecycle require the app's corresponding implementations. Keep React-specific factory caching, frozen-copy checks and profiling as internal regressions rather than requirements for other renderers.
    - No browser: `src/__tests__/react-registry.test.tsx` — `registry_rejects_missing_duplicate_mismatched_and_extra_kinds`, `registry_validates_catalog_before_binding`, `registry_ignores_definition_key_order`. `react-surface.test.tsx` — `surface_renders_slot_classes_styles_and_scope`, `responsive_tree_gains_container_on_wrapper_only`, `invalid_tree_renders_only_the_fallback`, `undeclared_slot_throws`, `items_expose_child_node_contexts`. Adapt markup assertions to the app's root/slot elements; invalid arrivals must call no implementation.
    - No browser: `src/__tests__/react-intents.test.tsx` — `set_state_without_value_takes_the_event_value`, `explicit_state_values_are_preserved`, `action_bind_fills_the_named_argument`, `undeclared_event_raises_nothing`, `wrong_carries_type_throws_and_raises_nothing`, `item_emit_raises_the_item_intent`, `host_must_recheck_filled_arguments`. Reuse the completion/rejection cases with app-declared events and capabilities; a completed intent remains a request, and the host must reject invalid filled arguments.
    - No browser (server half): `src/__tests__/react-ssr.test.tsx` — `server_renders_fallback_for_invalid_tree`, `ssr_throw_path_is_specified`, `server_portal_is_undefined_and_overlay_waits_for_mount`. These pin the React adapter's SSR contract: server implementation errors escape to the host, and portals wait for mount. They do not prove hydration.
    - Browser required: `src/__tests__/react-browser.test.tsx` — `stale_revision_is_ignored_and_new_surface_replaces` (including keyed reorder and local state/focus survival), `local_interactions_stay_local_and_intents_use_the_current_handler`, `throwing_implementation_falls_back_at_that_node`, `browser_shows_fallbacks_for_invalid_tree_and_throwing_node_under_both_systems`. Prove whole-surface arrival rejection, healthy sibling survival and recovery with app implementations.
    - Browser required: the same file's `portal_overlay_keeps_surface_scope`, `switch_runs_the_switching_sequence_on_root_and_portal`, `switch_rerenders_no_implementation_and_keeps_focus`, `sibling_surfaces_switch_independently`. Assert computed overlay styles, wrapper/portal switching order, stable nodes/classes/focus, no transitions and isolation of the other surface.
    - Browser required (server markup plus client): the same file's `server_markup_hydrates_with_no_recoverable_error`, `overlay_mounts_after_hydration_without_mismatch`, `invalid_server_fallback_hydrates_without_mismatch`, `host_fallback_recovers_on_client_after_ssr_throw`. Run app scenarios through server rendering and hydration; successful and invalid-tree markup must match, while host replacement of a server throw may recover by client rendering.
    - Browser required, Task 8 tiers and survival: `proof/tests/host.test.ts` — `tier_one_stays_local_and_tier_two_preserves_focus_scroll_and_local_state`, `bound_reason_is_completed_logged_once_and_does_not_rerender`; `proof/tests/renderer-browser.test.tsx` — `local_state_focus_scroll_and_ids_survive_new_and_stale_revisions`. Adapt `agent_home_hydrates_selects_filters_pages_and_dispatches_card_controls_${system}` in `agent-home-browser.test.ts` and `clay_panels_hydrate_and_exercise_three_interaction_tiers_${system}` in `clay-browser.test.ts` to app scenarios: local interactions send nothing; state changes send one intent and advance the revision; actions send one completed request without advancing it. Retain focused element identity, scroll offset, uncommitted input, local tab and disclosure across accepted updates and stale arrivals. Pair with no-browser host rejection cases `dispatch_rechecks_state_actions_current_tree_and_revision` (`host.test.ts`) and `bound_action_values_are_checked_against_capability_args` (`packages.test.ts`); host authorization stays app-owned.
    - Browser required, Task 8 lifecycle: `proof/tests/renderer-browser.test.tsx` — `dialog_exit_animates_then_unmounts_and_reduced_motion_skips_exit`, `open_dialog_locks_scroll_and_makes_background_inert`, plus `text_field_counts_code_points` from Task 7. Exercise the app's exit animation, delayed removal, reduced-motion override, scroll lock, background pointer/assistive-technology exclusion and Unicode input bounds. Lifecycle belongs to app implementations; the proof's injected exit animation is harness data. Chromium checks do not close G29's native Windows/assistive-technology audit.
    - Keep `registry_check_runs_once`, `validator_runs_once_per_tree`, `intent_objects_are_fresh_and_frozen`, type-level `react-types.test.tsx`, `agent_home_server_render_time_is_recorded` and Task 8's `selection_rerender_cost_is_recorded` internal. Keep `switch_under_budget_with_blur_through_surface`, `proof/tests/switch.test.ts` and the host's `set_state_http_round_trip_under_50_ms` as realistic-size performance gates, not universal app timing assertions. Task 8's development-mode arrival/render/commit observations are informational, not new budgets.
  - Start the published store suite from `src/__tests__/store-contract.ts`, already run by `store-memory.test.ts` and `store-file.test.ts`: immutable `(id, version)` hashes, same-hash no-op, record copy boundaries, sorted placements, missing records versus JSON null, style tuple keys and deletion of placement state. Both reference stores must pass the public suite; keep filesystem path/atomic-write tests and runner timeout tests as implementation-specific regressions. `store-load.test.ts` and `phase-2-loop.test.ts` provide verification, state-reset and inert-load integration cases.
  - Seed the Phase 5 design-system suite from Plan 007 Tasks 3–9, reusing cases against the app's installed catalog, themes and design systems rather than importing proof implementations:
    - No browser: `src/__tests__/css-theme.test.ts` — `colour_authority_holds` (base, theme and design-system sheets; system colours only inside forced-colours blocks), `names_are_injective`, every DTCG colour space, safe font/string escaping, vocabulary-selected surface typography, deterministic output and invalid-input rejection.
    - No browser: `src/__tests__/css-design-system.test.ts` — `every_recipe_property_projects` (all 27 properties), logical side widths, inherited values/units, equal-to-rest rule omission, design-system-independent slot classes, one-class selector specificity, deterministic/failing-closed projection, `entry_rules_only_where_open_differs` and `forced_colours_only_restore_differing_states_and_background_edges`. `src/__tests__/css-style-props.test.ts` supplies `every_style_prop_maps` (all 38 props in scalar/responsive forms), vocabulary tones, value forms/colour authority, invalid-style rejection and responsive-only containment.
    - Browser required: `src/__tests__/css-browser.test.ts` — `state_precedence_follows_the_fixed_order`, native/ARIA selectors, touch hover, root-to-slot propagation and disabled guards, pressed-offset/transform composition, sparse responsive fallback, design-system breakpoint switching, RTL sides and isolation from ancestor responsive values.
    - Browser required: the same file's `overlay_enters_from_rest`, backdrop blur/translucency and opacity-ancestor contract, reduced motion/transparency and transition-free switching. String checks for entry rules do not prove entry animation or computed preference effects; reduced transparency remains progressive enhancement.
    - Browser required: the same file's `every_state_differs_from_rest_in_forced_colours` for every differing tuple/state under both proof systems (slot-owned and root-propagated), `background_edges_survive_forced_colours`, `fill_indicators_keep_their_shape` and `forced_colour_states_keep_precedence_and_disabled_guards`. Chromium emulation leaves G29's real Windows/assistive-technology audit open.
    - Browser required: `src/__tests__/css-scope-browser.test.ts` — `two_surfaces_keep_their_own_styles`, `host_css_does_not_restyle_surfaces`, `switch_changes_one_surface_only` (computed styles, node/class/markup identity and no transitions), `overlays_keep_scope` and `nested_surfaces_are_a_recorded_limitation` (unsupported nesting, not a conformance promise). Keep `switch_under_budget_with_blur` and `bench/css.bench.ts` as internal performance gates; the switch timer measures attribute changes plus computed-style resolution, not GPU paint/compositing. Regenerate the static scope fixture with `timeout 30s bun proof/scripts/capture-css-scope.ts`.
- Why: these enforce completeness, colour authority and the parity method on two real design systems. The scripts matter as much as the tests: a future change that moves a pixel must re-capture with the artifact page origin aligned, or the number reports antialiasing rather than look.

## Hand adopter gaps to Synapta and Clay

- Section: Phase 7 (reference hosts)
- Priority: P4
- Source: plans/001-Phase-0-Primitive-Set-Proof.md, plans/002-Phase-0-Parity-Re-Proof.md, plans/005-Phase-2-Part-A-SDK.md (F5), plans/006-Phase-2-Part-B-Packages-Storage-Runners.md (F5), plans/007-Phase-3-CSS-Projection.md (F9), plans/008-Phase-4-Part-A-React-Renderer.md Task 11 (F3)
- What:
  - Both hosts: supply the widget manifest alongside the tree so the browser can compile the same catalog/capabilities/manifest arrival validator. Re-check completed intents and current revisions in the authorized backend; the browser grants no authority. Use `/react`'s scoped portal and implement overlay lifecycle in app primitives. If an adopter cannot send the manifest, record the concrete restriction and reopen the accepted Phase 4 decision; do not bypass arrival validation or introduce a catalog-only validator. The proof host demonstrates the full path, not production adoption.
  - Synapta: Certified has no five-patch identity roles or diagnostic fill roles (G2).
  - Synapta: replace positional widget ids with stable keyed paths and generate catalog components into an app-relative typed source module (`liveframe gen … --out …`), rather than inside the SDK package. Bundle that module through ordinary relative imports. Test list reordering, keyed composed fragments and generator drift; no positional-id compatibility mode or package-time component import rewrite is provided.
  - Synapta: the Certified look the parity work proved lives in `proof/styles/certified/` and must be ported to `synapta-core` — the typography roles (`fine`, `ui`, `caption`, `label.small`, `label.strong`, `mono.strong`, `overline`, `heading.2.compact`), `fontSizeAdjust` on the mono roles, the `foil` tone, `size.glyph`, `bp.sm`, the `plate`/`rule`/`callout` box recipes and the per-side border widths.
  - Clay: Rack's docs claim 273 recipes, but the manifest has 247 (G3); Rack recipes reference undeclared spacing and easing values (G5); Rack typography is user-owned, which spec §6.1 now allows through an assembled theme (G1).
  - Clay: Rack's `box.default.root.rest` pads every box by 12 px, so the lamp, jack and pips clamp to 24 px instead of the declared 8/4 px. A bare box variant (or a padding-free recipe) would let a small indicator keep its size (G10).
  - Clay: plan 007's migrated Rack surface uses the theme's native `color-scheme` scrollbar instead of the old hard-coded `surface.scrollbar`/WebKit thumb styling (`proof/GAPS.md:180`, `proof/PARITY.md:83`). Confirm native scrollbar appearance and geometry during adoption. Placeholder/scrollbar recipe properties are not part of the current projection; do not restore a proof-only projector or hard-code app roles in `/css`.
  - Synapta: provide an isolated backend `Runner` for organisation/agent widgets and use it for preview and production. Reference runners do not restrict host access; import validation and SHA-256 do not grant trust. Tenant scoping, data resolution, approval and action authorisation remain the app's.
  - Clay: `fileStore(dir)` fits a desktop host with one writing process and atomic per-record replacement. Persist packages, placements and state, report load errors and state resets, and decide explicitly whether to save reset state. Multiple writing processes, power-loss durability and transactions across records are not provided; choose a host backend if those become requirements. No production adoption is proved by the library's reopen tests.
- Why: these are the source apps' own gaps, plus the look data this repo tuned in a copy. Record them for the adopters; never bend the library to them (problem class first).

## Reconcile proof grid tracks before SDK and CSS integration

- Status: closed 2026-10-24 (plan 007 Task 10). Proof and SDK QueueRows now share spec-valid flex composition, including the trailing empty-track gap. The exporter no longer substitutes `0fr`, tree comparisons have no layout exception, and benchmark node counts remain unchanged. The scoped host renders every scenario under both systems; Certified parity remains 0.72% / 0.75% / 0.97% at 1440 / 1024 / 390 px (`proof/PARITY.md`; regenerate with `timeout 600s bun proof/scripts/parity.ts --out evidence/parity`).

- Section: Phase 2 Part A and Phase 3 (spec §6.3, §10, §12)
- Priority: P2
- Source: plans/004-Phase-1-Part-B-Compiled-Validator.md, plans/005-Phase-2-Part-A-SDK.md (F6; closure confirmed by plan 007)
- What: when migrating the proof widgets to the SDK and CSS projector, replace their proof-only `"fit"` grid tracks with spec-valid composition and verify the same scenarios and visual parity. `proof/scripts/export-formats.ts` previously substituted `"0fr"` in agent-home and medium/large/full core-queue benchmark trees; preserve the benchmark node counts. If valid composition cannot preserve the look, bring the concrete gap to the owner before changing §6.3.
- Why: the compiled validator correctly rejects `"fit"` as a grid track; the exporter conversion proves transport validity and throughput, not visual equivalence. Phase 2 must not feed the unconverted proof trees to `render()` or claim parity from the converted benchmark fixtures alone. The approved proof UI and the spec remain unchanged in plan 004.

## Exclude test fixtures from the release package

- Section: Phase 6 (spec §13, release packaging)
- Priority: P2
- Source: plans/003-Phase-1-Part-A-Formats.md, plans/006-Phase-2-Part-B-Packages-Storage-Runners.md (F4)
- What: before publishing, narrow the package file list or exclude `src/__tests__/`, and inspect a Bun-generated package archive. Assert it contains the public source/subpaths and published schemas while excluding tests, proof-derived catalogs, themes, design systems and benchmark trees.
- Why: `package.json` currently includes all of `src`, including the committed proof fixtures. The package is private and unpublished, but the release must not ship an app's primitive catalog or visual style as library content. Preserve the local fixtures and their reproducibility tests.

## Build preview sessions on the shipped package and runner contracts

- Section: Phase 4 Part B and Phase 8 (spec §7.5, §13)
- Priority: P2
- Status: closed 2026-10-24 by plan 009 Tasks 2–7; the Phase 8 note below remains.
- Source: plans/006-Phase-2-Part-B-Packages-Storage-Runners.md (F2), plans/007-Phase-3-CSS-Projection.md (F3)
- What: implement `createPreview({ catalog, capabilities, runner })` using the shipped `pack()` and `Runner.render(pkg, inputs, options)` contracts, as settled by `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md` and plan 009. Draft updates remain unstored, `check()` renders every validated scenario, `setState` stays in the session and actions are logged without dispatch. Publishing retains the last previewed package hash. Use the same host-supplied runner for preview and production; the browser receives only trees. Carry these conditions into the Phase 4 plan and Phase 8 MCP integration tests.
- Why: Part B ships runners and required scenarios, not preview sessions or capture. This explicit handoff prevents a second packaging/validation path or a browser draft-execution path.
- CSS integration: reuse `/css` and the Phase 4 Part A renderer, cache N + M + 1 sheets for a fixed catalog and keep each matrix cell's surface and overlays scoped independently. Cells must be siblings, never nested surfaces; container widths, not viewport widths, select responsive values. Include `src/__tests__/css-scope-browser.test.ts` isolation/switch cases in preview acceptance and keep draft code out of captured browser HTML.
- Resolution: `createPreview()`, `<Preview>` and `liveframe preview capture` ship with tests for the session contract, the 12-cell matrix, no dispatch, no draft code in the bundle or HTML, and a scripted agent loop whose published hash equals the previewed one. The outsider guide is `docs/preview.md`.
- Phase 8 note: `liveframe mcp` should call `createPreview()` and `capture()` from `src/cli/capture.ts` directly instead of spawning `liveframe`, keep the optional MCP SDK lazily imported like Playwright, and never install, place, approve or dispatch. Its tests should reuse the agent-loop shape in `src/__tests__/preview-agent-loop.test.ts`.

## Carry the CSS overlay contract into the production renderer

- Section: Phase 4 Part A (spec §6.4, §11)
- Priority: P2
- Source: plans/007-Phase-3-CSS-Projection.md (F2), plans/008-Phase-4-Part-A-React-Renderer.md Task 11 (F1)
- Status: closed 2026-10-24 by plan 008 Tasks 3, 5, 7 and 8; impact follow-up Task 11a reconciles this handoff.
- Resolution: `/react` supplies stable slot/style output, surface-only responsive containment, sibling scoped portals and synchronized transition-free switching. App implementations deliver exit/delayed unmounting, scroll locking and inert background, as settled by the approved Phase 4 decision and spec §11. Both-system Chromium tests prove the three tiers, focus/scroll/local-state survival, overlay scope, exit completion and reduced motion. The exit test supplies animation CSS because the proof recipes have none; no lifecycle helper or primitive is shipped by the library. Phase 5 conformance and G29's native-platform audit remain in their existing backlog entries.

## Evaluate an atomic-class route for strict style CSP

- Section: Optional projection extension (spec §6.4)
- Priority: P3
- Source: plans/007-Phase-3-CSS-Projection.md (F4)
- What: if an adopter requires a policy forbidding inline style attributes, design a validated class/sheet route for scalar and responsive layouts, including bounded dynamic values. Compare output size, determinism, caching and runtime cost before proposing a public API/spec change; retain colour-authority and injection tests.
- Why: `docs/styling.md` explicitly requires `style-src-attr 'unsafe-inline'` for current layout output. A nonce authorizes a sheet, not node style attributes. No alternate API is promised or implemented.

## Evaluate placeholder and scrollbar recipe properties on adopter demand

- Section: Optional styling extension (spec §6.2, §6.4)
- Priority: P4
- Source: plans/007-Phase-3-CSS-Projection.md (F5)
- What: collect concrete native-part styling needs before adding closed recipe properties. Any proposal must keep colours as theme roles, update formats/schema/validator/projection/docs together, and prove forced-colour and native-platform behavior. Until then use theme `color-scheme` for native controls and scrollbars.
- Why: these parts are explicitly excluded by the accepted projection decision; they are not missing mappings among the 27 supported properties. Rack's scrollbar deviation is handed to Clay separately.

## Revisit scoping only if nested surfaces become required

- Section: Conditional projection extension (spec §6.4, §11)
- Priority: P4
- Source: plans/007-Phase-3-CSS-Projection.md (F7)
- What: if host composition needs nested surfaces, evaluate `@scope` boundaries and the platform floor, including resets, custom-property inheritance, state propagation, containers and portals. Replace the documented negative nesting test with positive isolation tests only after approving and specifying a new contract.
- Why: current attribute selectors support sibling surfaces; nesting leaks unset properties by design. `src/__tests__/css-scope-browser.test.ts` pins this unsupported case. `@scope` is a candidate, not an existing capability.

## Revisit mixed-unit breakpoint ordering for non-16px roots

- Section: Conditional projection extension (spec §6.3, §6.4)
- Priority: P3
- Source: plans/007-Phase-3-CSS-Projection.md (F8)
- What: when an adopter needs mixed px/rem breakpoints at another root font size, compare a single-unit install restriction with an explicit host-context ordering contract. Add a crossed-order browser regression at a non-16px root before changing validation or projection.
- Why: `src/css/design-system.ts:84–99` sorts rem using a 16px assumption, while preserving authored units in query conditions. The shortcut and `docs/styling.md` disclose this; single-unit breakpoints avoid the ambiguity. Do not add DOM access to `/css` to infer the root size.

## Verify installed-package loader and worker entry before release

- Section: Phase 6 (spec §7.5, §13)
- Priority: P1
- Source: plans/006-Phase-2-Part-B-Packages-Storage-Runners.md (F4)
- What: install a Bun-generated release archive in an independent host outside this checkout, run it from another working directory, and pack, store, reload and render with both reference runners. Prove that the published `/preview` loader resolves all three SDK entry points through the installed package's own exports, shares the runner's SDK instance, and imports dot-escaped `data:` modules. Prove that `/preview/worker` includes and resolves its `./entry.ts` and protocol dependencies, times out a looping widget, then recovers. Coordinate archive inspection with “Exclude test fixtures from the release package”; preserve required worker/runtime files when removing tests. Re-run the approved loader gate on supported Bun upgrades.

- Why: checkout tests and browser bundle scans do not prove installed archive resolution. The approved `2026-10-23-2016-data-url-loader-encoding-and-sdk-resolution.md` decision requires this gate. If its revisit conditions occur, reopen plan 006 Task 8.5 and obtain approval for the factory-module fallback before changing the package format or loading scheme.

## Scope SDK data validation caching to the source-schema contract

- Section: SDK validation hardening, before cross-widget or cross-contract data reuse
- Priority: P1
- Source: plans/005-Phase-2-Part-A-SDK.md Task 10 (F2), plans/evidence/005-impact-analysis.md
- What: make check-once validation account for the compiled source-schema contract as well as data identity, while retaining weak retention and no repeat data walk within the same contract. Add a regression that reuses data accepted by one manifest under a manifest with incompatible sources: the second render must return pointed `invalid-prop` errors before widget execution, just as a fresh data clone does. Check both reference runners and rerun the SDK budget.
- Why: `src/sdk/render.ts` currently uses one module-private `WeakSet` across validators. A successful validation under one contract can suppress validation under another; freezing alone cannot establish schema compatibility. Until corrected, obey `docs/sdk.md`: reuse data only under the same source-schema contract, allocate a new object for each resolution, and supply JSON value properties rather than accessors. No cache redesign is approved by this handoff.

## Reject nested non-JSON composed props and improve SDK diagnostics

- Section: SDK diagnostics
- Priority: P2
- Source: plans/005-Phase-2-Part-A-SDK.md Task 10 (F3), plans/evidence/005-impact-analysis.md
- What: add nested function/promise cases for primitive JSON props and composed-component props, including values discarded during expansion. Reject non-JSON composed props before invoking the component; preserve `function-prop` / `async-render` classifications and exact escaped pointers at the responsible check. Preserve bounded failures and all byte/depth checks, rerun the SDK budget, and update the guide's limitation when corrected.
- Why: top-level function/promise props have dedicated kinds, while nested primitive values can report `invalid-prop` (or be rejected by schema first). Composed props check only top-level values before expansion: a component that discards `{ payload: { callback: () => 0 } }` currently renders successfully. The emitted tree is valid, but this misses §7.1's non-JSON prop restriction. These are distinct rejection and diagnostic gaps; this handoff changes no implementation or current error contract.

## Profile production browser selection costs before optimizing the renderer

- Section: Renderer performance investigation (spec §7.1, §11)
- Priority: P2
- Source: plans/008-Phase-4-Part-A-React-Renderer.md Task 11 (F2), plans/evidence/008-impact-analysis.md
- What: profile the same 679-node agent-home selection update under both design systems in a production browser build. Record machine/browser/build/load, warm repeated samples and separate arrival validation, React rendering, layout and paint. Compare against the development instrumentation in `proof/tests/renderer-browser.test.tsx` (`selection_rerender_cost_is_recorded`); avoid treating Profiler callback intervals as isolated DOM commit or paint. Propose optimization only from measured costs, preserving full arrival checks, stable ids, fallbacks and all existing budgets. This handoff approves investigation, not a cache, tree patches or a new browser budget.
- Why: Task 8 Certified/Rack validation was 2.5/3.0 ms, Profiler render 58.8/59.5 ms and synchronous update 81.8/84.6 ms, above its 2 ms reporting threshold. These are development/profiling observations, not a measured production regression. HTTP state and warm switching pass their existing gates; neither measures full browser update latency. Keep the independent standalone-validator gate in its own P1 entry.

## Evaluate generated implementation types for JSON-loaded catalogs

- Section: Conditional implementation authoring improvement (spec §7.2, §11)
- Priority: P4
- Source: plans/008-Phase-4-Part-A-React-Renderer.md Task 11 (F4), plans/evidence/008-impact-analysis.md
- What: if an adopter needs inferred implementation props/slot/event names from a JSON-loaded catalog, compare extending `liveframe gen` with continuing to use literal definitions or explicit prop narrowing. Any approved generator work must retain drift checks and type-level rejection tests, without importing the SDK into `/react` or generating runtime primitive implementations.
- Why: `implement()` already infers literal definitions, while JSON-loaded definitions use JSON records and string names by design. Explicit prop narrowing works today; no adopter requirement justifies adding a generator mode during renderer closeout.
