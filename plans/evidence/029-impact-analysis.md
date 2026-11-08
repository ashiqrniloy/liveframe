# Plan 029 architectural impact analysis

Reviewed 2026-11-08 against the working tree at `a6d9673` plus Tasks 2–6 (uncommitted at review time) and Task 7's own changes. Covers all twelve areas in `.claude/skills/create-plan/references/liveframe.md` §5. This closes the interaction batch of 0.3.0 (action results, local state and bindings, the surface core, observability, the localisation contract); it is not the 0.3.0 release or plans 030–032. Many unrelated files were already modified in the working tree before this task; they are left as they were.

Method: read the plan, its notes and the design (`plans/evidence/029-interaction-design.md`, rules A1–A9, L1–L7, B1–B13, W1–W4, P1–P4); read the core (`src/surface/core.ts`, `src/surface/bindings.ts`) and the binding validator (`src/validate/bindings.ts`); probe hostile and worst-case inputs with throwaway tests (removed afterwards); run the whole-plan verification; try a paired A/B of the render and validator benches against the commit before the plan (`6041e0b`).

**The host was not quiet.** Load average was 14–19 for most of the session and reached 40–70 during the A/B (other users' benchmarks and builds on the shared machine). Every timing figure below taken in this task is therefore recorded as noise-bound, not as proof. The performance numbers that this plan relies on were taken in Tasks 3 and 4 (load noted there); plan 032 Task 3 owns the quiet-host proof.

Whole-plan verification:

| Command | Result |
| --- | --- |
| `timeout 900 bun run check` (1st attempt, load 27) | killed when the session ended; four timing tests had failed (`all_proof_scenarios_render…` 100 ms render cap, two CSS-switch frame budgets, a three-width capture) |
| `timeout 900 bun run check` (2nd attempt, load 17–19) | typecheck, lint, format pass; 1575 pass, 8 fail, every failure a timing gate or a 5 s test timeout (list below) |
| the 8 failures re-run alone (load 17) | 6 pass (`layout_files_hold_node_boxes_from_the_real_host`, `pack_errors_keep_the_previous_package`, `render_scenarios_returns_tree_or_errors`, `render_all_matches_session_check`, `mcp_capture_bound_defaults_and_configured_description`, `mcp_pack_draft_template_inline`); 2 fail on a pure timing gate: `in_process_warm_overhead_under_point_one_ms` (0.187 ms vs 0.1) and `validator_smoke_under_5us_per_node` (5.2 and then 9 µs/node vs 5) |
| `timeout 900 bun run check` (3rd attempt, load 11 falling to 5) | **exit 0: 1583 pass, 0 fail** (typecheck, lint, format, tests) |
| `LIVEFRAME_BROWSER=firefox` `surface-dom-parity`, `react-browser`, `renderer-browser` | 57 pass, 0 fail (includes `live_filter_50_rows_no_round_trip`, `dom_renderer_matches_react_structure`) |
| `LIVEFRAME_BROWSER=webkit`, same files | 56 pass, 1 fail: `switch_under_budget_with_blur_through_surface` (156 ms vs a 16.67 ms frame budget at load 19–40; a theme-switch CSS gate this plan does not touch) |
| `bun run demo:test` | first run failed to **typecheck** (F1 below); after the fix 57 pass, 0 fail |
| `bun run bench`, each stage alone, at load 14–19 | css, streaming and stream-elements exit 0. validator, render and template exit 1 on absolute µs/node gates that read 1.6–2× their quiet figures for **unchanged** code (agent-home validation 2.5–2.8 µs/node vs 1.3 quiet; render 4.5 vs 2.1); not interpretable |
| the same stages again at load 5.7–8 | validator exits 1 on `core-queue.large`/`core-queue.full` (1.57 µs/node; the known gate that also fails at `eedf1c1` and `6041e0b`); agent-home 1.41 µs/node; **bindings: 50 distinct `when` 1.687 µs/node against 1.428 without, gate 1.75, pass**; `compileValidator` reuse 0.200 ms (≤ 0.25). Render: agent-home 2.37 µs/node, other fixtures fail the 3 µs/node render budget by noise. Template 3.09 µs/node vs a 3 budget (see the paired ratio next) |
| `bench/ab.ts 6041e0b bench/template.bench.ts --runs 7` (load 8–9) | `renderTemplate` agent-home 1.636 → 1.648 ms, **ratio 1.013**; expression evaluation 1.008 |
| `bench/ab.ts 6041e0b bench/render.bench.ts --runs 7` (load 8, rising to 25 at the end) | render ratios 0.95–1.07 by fixture (agent-home 1.043, core-queue.large 1.071, synthetic-queue 0.951), median about 1.02; validation 0.92–1.00 (head faster); `renderElements` 0.976, `renderKey` 0.995 |
| `bench/ab.ts 6041e0b bench/render.bench.ts --runs 9` (load 14–18) | paired head/base ratios 0.89–1.20 by metric, the unchanged `validationMs` rows 0.91–1.02: the spread is the noise, so no render change is shown or excluded |

The third `check` run is the plan's whole-suite pass. The quiet-host benchmark proof is left to plan 032 Task 3, as for plans 026–028. The bench stage restores `plans/evidence/019-streaming-bench.md` after each run (backlog: plan 028 F8).

## 1. Spec

`docs/spec.md` describes what shipped: §4 (local), §7.1 (`actions`, locale), §7.6 (templates pass `when`/`bind` through, `$embed`), §8 (action results, local state and bindings), §9/§9.1 (`when`, `bind`, `setLocal`, `resultKey`), §10 (expression rule), §11 (the surface core, the React adapter, observability), §13 (`/surface`). §14 keeps "renderers other than React" a non-goal, and §11 says the library ships none besides React's, which matches the code. **None — no spec change needed.**

## 2. Public API and formats

- Added: subpath `/surface` (`createSurfaceCore`, `NodeContext`, `SurfaceSnapshot`, `SurfaceEvent`, `SurfaceCore`, `SurfaceCoreOptions`, `EventMeta`; `package.json` exports, the portability and runtime-matrix tables), `local`, `self`, `ex`, `Expr`, `LocalIntent`, `TreeIntent`, `ActionStatus`, `WidgetInputs`.
- Widened or changed (wire, all optional and fail-closed): `manifest.json` (`local`, `initialLocal`), `capabilities.json` (action `result`), `ui-tree.json` (`when`, `bind`, `setLocal`, `resultKey`), `tree-patch.json`, `template.json`, `Scenario.actions`; `WidgetProps` (required `actions`, fifth generic: `changed`), `renderKey` (hashes `actions`: `changed`, vectors in `conformance/hash/render-keys.json`).
- **F1 — a compile break the register did not predict.** `UiNode.events` is now `Record<string, TreeIntent>`. The demo host's test helper `offeredIntent` returned a node's event as `Intent` and stopped compiling (`examples/demo-host/tests/host.ts:47`, `TS2322`). `bun run check` does not typecheck `examples/`; `demo:test` does. The register already lists `UiNode` as widened and `docs/migration-0.3.md:323` tells hosts to narrow with `TreeIntent`; the break is the documented one, found by the plan's own verification list. **Executed:** the helper narrows out `setLocal` (it never leaves the browser), `demo:test` passes. No other `src/`, `proof/` or `examples/` code reads `node.events` as an `Intent`.
- A 0.2.x verifier or renderer rejects every new field fail-closed (unknown node, intent and manifest fields), the same precedent as plans 026–028.

## 3. The four laws

The explicit reviews the plan asks for.

**Law 1 and the browser-side expressions.** `when` and `bind` are data. The evaluator is the template language's table of library closures (`src/template/expr.ts`), cut by an allow-list (`TREE_OPERATORS`, `src/validate/bindings.ts:12`) to 27 operators with no iteration, no binding, no collection builders and no component use. No code from a tree is compiled to a function. The test scan of `expr.ts`/`scope.ts` for `eval`, `Function` and `globalThis` from plan 028 still covers the shared evaluator, and `core_has_no_react_or_dom_imports` covers the core.

**Security review: can an expression evaluated in the browser reach data the widget did not put in the tree?** No. The frame an expression runs in holds exactly two values (`src/surface/bindings.ts:84`): `local`, the surface's local state (the manifest's `initialLocal`, then values written by `setLocal` after the local schema checked them), and `self`, the node's own `props`. The validator rejects any other root before arrival (`data`, `state`, `params`, `context`, `actions`, `row`, a global). There is no operator that takes a name or a path from data and walks outside those two objects: `$path` is a static string checked against the schema, `$get` and `$at` index only their first operand and use `Object.hasOwn` at evaluation (`src/template/expr.ts:477,557,689`), and `__proto__`/`constructor` segments are refused at validation. A bound value then has to pass the validator's own `checkNode` before an implementation reads it (`src/surface/bindings.ts:134`), so even a value computed from allowed inputs cannot be a shape the prop schema rejects. The inputs that are not the author's are the user's typed values in `local`, which are bounded (strings ≤ 256 characters, closed scalar schema) and checked on every write (`writeLocal`, `src/surface/core.ts:294`).

Probes (throwaway tests, 2026-11-08, Bun 1.4.4, removed afterwards):

| Probe | Result |
| --- | --- |
| `when` on `data.x`, on `globalThis` | `unknown-name` at the `$path` |
| `local.__proto__`, `self.constructor` | `invalid-prop`, "unusable segment" |
| `$get` of `__proto__`, `constructor` (literal key) | `invalid-prop`, "Expected one of: q, n" / "text" |
| 17 nested `$not` | `limit-exceeded`, "at most 16 levels" |
| `$concat` of 70 operands | `limit-exceeded`, "at most 64 expression nodes" |
| `$map` in a `bind` | `invalid-prop`, "Operator $map is not allowed here" |
| `bind` of an undeclared prop, of `id` | `invalid-prop`, "Expected a bindable prop: text" |
| `setLocal` with key `__proto__`, `constructor`, or a wrong-type value | `unknown-name` / `invalid-prop` at the intent pointer |
| `$get(self, local.q)` evaluated with `q` = `text`, `__proto__`, `constructor`, `toString`, `zzz` (a user typing at run time) | `text` reads the prop; the four others take the `$coalesce` default; nothing from the prototype chain |
| a `$get` with an unguarded dynamic key | rejected at validation, "a value that is always present; guard it with `$has` or give it a default" |
| Largest accepted tree (about 1,200 rows, each with a `when` and a `bind`, near the 10,000 expression-node cap) | arrival 90–130 ms, a keystroke 2–15 ms in the core (load 17); 2,000 such rows are `limit-exceeded` at the tree total |

So the browser's work is bounded by the tree's own bounds: 16 levels, 64 nodes and 256 steps per expression, 16 `bind` entries per node, 10,000 expression nodes per tree.

**Law 2.** Expressions, their roots, the local paths, the bind targets and `setLocal` keys and values are validated at install and on every arrival; a bound value is validated again before use; `refProps` targets cannot be gated or bound (a `domId` rewrite cannot be redirected). An arrival that fails produces `arrival-rejected`, a failing binding a node fault and `binding-failed`.

**Law 3.** None — bindings can override a prop but not a style value: `bind` targets must be a declared prop, and style props are not props.

**Law 4.** `setLocal` carries no authority: it is applied inside the core, never calls `onIntent` or `confirm`, is rejected by `checkOffered` (`src/validate/offered.ts:54`) so no host dispatches it, and its state is never sent. Action results (`actions`) are host facts the widget reads; `refused` is a report, not a grant, and `value` must match the capability's `result` schema, so a host bug cannot inject an arbitrary shape into widget code. `resultKey` is a literal or a template value in the tree and is reproduced by `checkOffered`, so a page cannot post an intent under another key. Observability events carry ids, kinds, event names, revisions and `LiveframeError`s only (`events_carry_no_prop_values` sends a secret through four paths and finds it in none).

This is a targeted review of the plan's inputs, not a fresh whole-repository audit.

## 4. Validation

Every new input has a typed error at a pointer: `unknown-name` (local path or key), `invalid-prop` (expression, bind target and type, `setLocal` value, `/type` for an offered `setLocal`, `actions` entries), `invalid-document` at the manifest (`local`, `initialLocal`), `limit-exceeded` (depth, nodes, bindings per node, expressions per tree, `actions` entries). Corpus cases cover each rejection (10 ui-tree and 4 manifest cases), patch vectors cover `when`/`bind` (`conformance/patch/bindings.json`), and `local-bindings.test.tsx` has the plan's seven names. **None — no unvalidated input found.** One gap in coverage is the `$embed` template path against `limit-exceeded` at the 10,000 tree total; it shares the running count with the tree walk, which `local-bindings.test.tsx` covers for TSX.

## 5. Styling

None — no recipe, theme, design-system or CSS-projection code changed. The core calls `slotClass` and `styleDeclarations` as `/react` did; `dom_renderer_matches_react_structure` compares slot classes and style declarations for every proof scenario, and a mutation of the DOM renderer fails it.

## 6. Interaction tiers

Tier 1 now has a declarative middle (local state, `when`, `bind`) that makes no round trip and never reaches the host; tier 2 is unchanged; tier 3 gains the feedback contract (`actions`, `resultKey`). The host sequence (pending → re-render → ok/failed/refused → re-render) is in `docs/renderer.md`. **F2 — docs lag.** `docs/model.md` still described tier 1 as "the host's primitive handles it" and tier 3 without the outcome, and `docs/security.md` said nothing about expressions evaluated in the browser. **Executed:** `docs/model.md` Phase E gains the local-state paragraph and a step 3 reporting the outcome; `docs/security.md` gains "Local bindings run in the browser" with the bounds. Limits found while reviewing (not defects; see §12): local state is scalars only, an expression cannot aggregate across nodes, and a widget cannot hand a local value to the host except through a `setState` event.

## 7. Performance

Figures taken in this plan (load noted in the task notes): P1 live filter, a keystroke flipping 9 of 50 gated rows, median 1.60–1.65 ms against the 4 ms budget, zero `onIntent` calls (all 50 flip 4.25–4.35 ms, recorded); P2 no tax without bindings, paired A/B against the pre-extraction tree: React work 1.000 and 0.968, wall 1.029 and 0.986, indistinguishable from the 0.05 ms timer step; the validator with 50 distinct `when`: 1.47–1.57 µs/node, gated at 1.75 (Task 3 compromise); the `actions` input check (Task 2's 1% budget) was gated by the unit suites but its cost is not stated in the Task 2 notes, so it joins F3.

The first attempt to refresh them failed for load, not for code (see the table at the top): the stage-by-stage bench and the 9-run paired A/B at load 14–18 produced uniformly slow absolute figures for unchanged code and ratios scattered 0.89–1.20, then load reached 40–70 and the validator A/B was stopped. A second attempt at load 6–9 gave the figures in the table. **F3 — performance claims still lack a quiet-host proof.** The lower-load re-runs (table above) show the 50-`when` validator gate passing (1.687 against 1.75), `renderTemplate` unchanged (1.013) and the plan's render ratios in the same 0–7% band plan 028 F4 left unresolved (median about 1.02, with validation not slower), so nothing new is proved against the plan; they are not quiet-host figures. Still open: the validator-with-bindings gate (1.75), the live-filter figures and the selection bench's 4–8% against 0.2.3 with focus continuity off on both sides (Task 4 notes: predates Task 4; head vs `a63fb65` 1.00–1.02, so it came in with Tasks 2–3's validation or earlier plans). Disposition: **backlog**, extending the quiet-host entry, with plan 032 Task 3 carrying a paired selection-bench and validator-bench run against `v0.2.3` and `6041e0b` as its acceptance.

**F4 — timing-gated tests fail the whole `check` under load.** Eight tests failed at load 17–27 (listed above) and six of them passed alone at load 17; they are the same family as plan 018's unexplained intermittent failure and `install_validation_of_agent_home_within_budget` (Task 6 finding 2). Disposition: **backlog**, extending the intermittent-failure entry (the tests that gate on absolute milliseconds could read the load average and skip, or be moved to the bench stage).

## 8. Portability

`src/surface/*` imports no framework, DOM, `node:` or `bun:` module; `core_has_no_react_or_dom_imports` and the host-API-free scan cover `/surface`, and the test-only DOM renderer (about 80 lines, plain DOM on the core) renders every proof scenario in Chromium, Firefox and WebKit with the `/react` structure. The core reads no clock, `Intl` or random source; the shared evaluator keeps its fixed rounding table. No dependency was added. The adapter relies on `useSyncExternalStore` (React 19). Bun remains the only tool.

## 9. Agent authoring

An agent gets `unknown-name` with the valid names for a wrong local path, `invalid-prop` with "Expected a bindable prop: text" for a wrong `bind` target, "a value that is always present; guard it with `$has` or give it a default with `$coalesce`" for an unguarded optional read, and "Operator $map is not allowed here" for a forbidden operator (probe table above). `liveframe gen` types `when?: _Expr`, a per-prop `bind`, `_LocalIntent` on event props, and the template schema lists `when`, `bind` and `setLocal`. `render_scenarios` takes `actions` so an agent can preview pending and failed states. **F5 — element JSON cannot gate.** `renderElements` and `streamElements` take no `when`/`bind` (an ephemeral manifest declares no `local`), so an agent writing element JSON cannot ask for a live filter; it needs a TSX or template widget. **Backlog** (P4, carried from Task 3 finding 4).

## 10. Docs and examples

Added or updated: spec §4–§11, §13; `docs/renderer.md` (host sequence for action results, "Watch what the surface rejects", "Writing another renderer"); `docs/sdk.md` (`actions`, `local`, `ex`, `when`/`bind`); `docs/formats.md`; `docs/templates.md`; `docs/localisation.md` (new, linked from README and `docs/sdk.md`); `docs/migration-0.3.md` (action results, render keys and widget props, the surface core, observability); CHANGELOG; the skill references. This task adds `docs/model.md` and `docs/security.md` (F2). `docs_links_resolve` covers the new guide. The worked example in the plan (`ex.eq(local("matches"), 0)` for a "No matches" row) is not in any doc because it is not expressible (§12).

## 11. Conformance

Covered: `catalogSuite`, `designSystemSuite` and `storeSuite` are unaffected; `rendererSuite` and `rendererBrowserSuite` still pass for the proof host through the adapter; the format corpus, patch vectors and `render-keys.json` cover the new wire; `surface-core.test.ts` (20 tests plus 10 for events) and the DOM parity test pin the core. **F6 — no conformance case for the new renderer behaviour.** `rendererSuite`/`rendererBrowserSuite` have no case that a renderer hides a `when`-false node, applies a `setLocal` without raising an intent, or reports `binding-failed`; an adopter's `interactions` fixture can express a local interaction (`intents: []`) but the suite does not require one. And a renderer written on `/surface` for another framework has no suite for the contract it must keep (the adapter duties in spec §11 "Writing another renderer"). Plan 031 builds `runnerSuite()` and the starter and does not include this. **Backlog** (P3).

## 12. Reference hosts

- **Gap (recorded, not bent to): no aggregate across nodes.** A live filter can hide rows but a "No matches" row cannot know that every row is hidden, because an expression reads only `local` and its own props and `local` holds scalars. The plan's own API sketch used a `matches` count that nothing computes. A host works around it by keeping the empty-state in a node gated by a `setState` re-run, or by putting a count in `data` and re-running on commit. **Backlog** (P3): decide between a derived `count` over a node's `when`-visible siblings, or documenting the workaround.
- **Gap: local state is scalars only.** A multi-select filter or a set of expanded rows needs one boolean per row (declared up front) or a `setState`. Left by design (L1: closed scalar object, ≤ 32 properties).
- **Gap: committing a local value to the host takes a second event.** Only `setState` or an action reaches the host, as L3 requires (`setLocal` has no authority). A "type to filter, press Enter to save" widget wires two events on the field.
- Synapta and Clay panels that need action feedback (claim, escalate) get the contract of Task 2; the host pipeline that writes the results is plan 030 Task 3.
- Clay's `/react` use is unchanged (the adapter keeps its API). A host that wrapped `acceptTree`-level behaviour has none to wrap: that logic is in the core now.

## Findings and dispositions

| # | Finding | Area | Disposition |
| --- | --- | --- | --- |
| F1 | `UiNode.events` is `TreeIntent`; the demo host's `offeredIntent` returned it as `Intent` and `demo:test` failed to typecheck; `bun run check` does not cover `examples/` | Public API | **Executed**: helper narrows `setLocal`; `demo:test` 57 pass |
| F2 | `docs/model.md` tiers and `docs/security.md` omitted local bindings and action results | Docs, laws | **Executed** |
| F3 | No quiet-host proof for the validator-with-bindings gate, the live-filter figures or the selection bench against 0.2.3 | Performance | **Backlog** (extends the quiet-host entry; plan 032 Task 3) |
| F4 | Absolute-millisecond tests fail the full `check` at load 17–27 (8 failed, 6 pass alone) | Performance, release automation | **Backlog** (extends the intermittent-failure entry) |
| F5 | Element JSON has no `when`/`bind` | Agent authoring | **Backlog** (P4) |
| F6 | No conformance case for `when`/`setLocal`/`binding-failed`, and none for a renderer built on `/surface` | Conformance | **Backlog** (P3) |
| F7 | No way to express an empty state over filtered rows; local state is scalars only | Reference hosts | **Backlog** (P3) |
