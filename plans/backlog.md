# Backlog

Follow-ups handed off from plans. One entry per item; update an entry with the same source and title instead of duplicating it.

## Phase 1 performance gate: 3 µs per node

- Section: Phase 1 (spec §10, §12)
- Priority: P1
- Source: plans/002-Phase-0-Parity-Re-Proof.md (G32), plans/004-Phase-1-Part-B-Compiled-Validator.md, plans/005-Phase-2-Part-A-SDK.md Task 8
- Status: closed — validator share complete in plan 004; full SDK render gate complete in plan 005 Task 8.
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

- Section: Phases 1, 3 and 4 (spec §6.4, §8, §10, §11)
- Priority: P2
- Source: plans/001-Phase-0-Primitive-Set-Proof.md, plans/002-Phase-0-Parity-Re-Proof.md, plans/003-Phase-1-Part-A-Formats.md, plans/004-Phase-1-Part-B-Compiled-Validator.md, plans/007-Phase-3-CSS-Projection.md (F1, F6)
- What:
  - Closed in plan 003: G19's new-format catalog and tree fixtures use `textField.onCommit`; the historical proof keeps its event names. G28's reusable install validators for untrusted themes and design systems ship as `validateTheme` and `validateDesignSystem`, with bounded errors, role checks, literal checks and inheritance/completeness tests. Replacing the proof projector is Phase 3, not an outstanding install validator.
  - Closed in plan 007 Task 10: G27 per-surface projection and proof-host adoption, visual parity and ≤ 16.67 ms warm switching. G33's cold first flip remains load-sensitive (including a 25 ms concurrent run); the accepted gate is warm attribute/style resolution, not GPU paint. See `proof/GAPS.md:167–180` and plan 007 Task 12's evidence. Revisit cold-start work only against a host requirement and measured regression.
  - G29 remains open: audit native Windows forced colours, native control/scrollbar geometry and assistive technology across both systems, including every state, edges, focus, keyboard interaction and overlays. Chromium automation now covers state distinctness, edges, preferences and scoped portals; it does not establish real platform or assistive-technology behavior. Record machine, OS/browser/AT versions and reproducible audit results before claiming closure.
  - G20's validator half is closed in plan 004: compiled string bounds count Unicode code points, with interpreter parity and surrogate coverage in `src/__tests__/{compiled-schema,validator-tree,validator-rules}.test.ts`. Phase 4 still owns code-point-aware text-field editing/commit enforcement; native HTML maxlength counts UTF-16 units and can reject valid non-BMP text early.
  - Phase 4: complete G20's renderer half, support app-owned icon sets (G26), and audit with assistive technology (G29).
- Why: the proof built these parts proof-grade only. Surface typography (G12) is closed: spec §6.4 now requires it and the proof proves it (`surface_text_never_inherits_host_fonts`). `proof/REPORT.md` §6 assigns each remaining one to the phase that builds the real part.

## Seed conformance suites from the proof tests

- Section: Phase 5 (spec §13 `/conformance`)
- Priority: P3
- Source: plans/001-Phase-0-Primitive-Set-Proof.md, plans/002-Phase-0-Parity-Re-Proof.md, plans/003-Phase-1-Part-A-Formats.md, plans/004-Phase-1-Part-B-Compiled-Validator.md, plans/006-Phase-2-Part-B-Packages-Storage-Runners.md (F3), plans/007-Phase-3-CSS-Projection.md Task 11 (Tasks 3–9)
- What: use the proof's suites as prior art — `proof/tests/`:
  - `catalog.test.ts`, `styles.test.ts`, `projection.test.ts`, `renderer.test.tsx`, `renderer-browser.test.tsx` for definitions, completeness, colour authority, the registry check and reconciliation against two real design systems;
  - `runtime.test.ts` for the closed-data checks Plan 002 added: `fill_accepts_only_declared_fillable_roles`, `responsive_style_values_are_closed_data`, `semantics_are_a_closed_enum_with_terms_child_rules`, `position_fill_radius_and_text_alignment_validate`;
  - `agent-home-browser.test.ts` for disclosure, `aria-current`, semantics landmarks and the terms/term/detail rules;
  - `proof/scripts/parity.ts` and `proof/scripts/inventory.ts` for the look bar itself: pixel capture, the capture-alignment rule, and the wrapper-collapsing inventory that turns a positional DOM count into causes.
  - `src/__tests__/{schema,vocabulary,catalog,manifest,theme,design-system,resolve,tree,schemas,proof-formats,portability}.test.ts` for the published formats: closed data, bounded pointed errors, catalog versioning, capability/source bindings, font safety, colour authority, cascade/inheritance, strict schema agreement, reproducible proof recipes and host-API portability. Reuse these cases in the Phase 5 suites; do not import proof implementations into the core.
  - `src/__tests__/{compiled-schema,validator-node,validator-tree,validator-rules,exports}.test.ts` for compiled/interpreted agreement, every spec §10 rule, bind/state/action compatibility, exact UTF-8 bytes, configurable traversal/error limits, pointed repair feedback and the public validator contract. Keep `validator-smoke.test.ts` and `bench/validator.bench.ts` as internal performance gates; transport arrival checks and dispatch-time authorisation still need Phase 4/host integration tests.
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
- Source: plans/001-Phase-0-Primitive-Set-Proof.md, plans/002-Phase-0-Parity-Re-Proof.md, plans/006-Phase-2-Part-B-Packages-Storage-Runners.md (F5), plans/007-Phase-3-CSS-Projection.md (F9)
- What:
  - Synapta: Certified has no five-patch identity roles or diagnostic fill roles (G2).
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
- Source: plans/004-Phase-1-Part-B-Compiled-Validator.md
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
- Source: plans/006-Phase-2-Part-B-Packages-Storage-Runners.md (F2), plans/007-Phase-3-CSS-Projection.md (F3)
- What: implement `createPreview({ catalog, capabilities, runner, styles })` using the shipped `pack()` and `Runner.render(pkg, inputs, options)` contracts. Draft updates remain unstored, `check()` renders every validated scenario, `setState` stays in the session and actions are logged without dispatch. Publishing retains the last previewed package hash. Use the same host-supplied runner for preview and production; the browser receives only trees. Carry these conditions into the Phase 4 plan and Phase 8 MCP integration tests.
- Why: Part B ships runners and required scenarios, not preview sessions or capture. This explicit handoff prevents a second packaging/validation path or a browser draft-execution path.
- CSS integration: reuse `/css` and the Phase 4 Part A renderer, cache N + M + 1 sheets for a fixed catalog and keep each matrix cell's surface and overlays scoped independently. Cells must be siblings, never nested surfaces; container widths, not viewport widths, select responsive values. Include `src/__tests__/css-scope-browser.test.ts` isolation/switch cases in preview acceptance and keep draft code out of captured browser HTML.

## Carry the CSS overlay contract into the production renderer

- Section: Phase 4 Part A (spec §6.4, §11)
- Priority: P2
- Source: plans/007-Phase-3-CSS-Projection.md (F2)
- What: consume `docs/styling.md`'s stable slot classes, state attributes and responsive container above the tree root. Keep overlays in scope through top-layer ancestry or a scoped portal; switch every portal container together. Keep backdrop/content siblings without opacity/filter ancestors that block blur. Implement renderer-owned exit/delayed unmounting, scroll locking and inert background while preserving focus, scroll and local state. Respect reduced motion and test the three interaction tiers; reuse `src/__tests__/css-browser.test.ts`, `css-scope-browser.test.ts` and both-system proof renderer tests.
- Why: `/css` provides entry rules and plain data, not a production renderer or overlay lifecycle. `docs/spec.md:590–605` assigns those responsibilities to `/react`; the proof adapter is evidence, not the published implementation.

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
