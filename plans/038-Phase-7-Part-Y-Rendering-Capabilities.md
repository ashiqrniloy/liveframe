# Phase 7 Part Y: Rendering Capabilities

Depends on: plan [033](033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md) Task 1 (the scope decision places this plan in 0.4.0 and answers whether the "Renderers other than React" non-goal is lifted) and plan [037](037-Phase-7-Part-X-Interaction-Capabilities.md) complete (`register-0.4.0.json`, and the conformance cases Task 6 reuses). Followed by plan [039](039-Phase-7-Part-Z-Agent-Generated-UI.md). Source: findings F5–F8 of the 2026-11-15 review (table in plan 033).

## Objectives

- Approve one design for the rendering additions before any is built.
- Let a host answer one slow source with `pending` so the widget draws the rest.
- Let a design system give nodes enter, exit and reorder motion, with no widget-authored CSS.
- Prove and document a windowing recipe for collections larger than the node limit.
- Ship a DOM adapter on `/surface`, if the owner lifts the non-goal.

## Expected Outcome

- `plans/evidence/038-rendering-design.md` and an approved decision log fix the forms, rules, platform floor and spec text for each item.
- A source declared with a pending outcome can report `pending`; its widget draws a placeholder for that region and the host re-renders when the value arrives.
- A design system that sets a motion recipe property makes rows animate in, out and into new positions across revisions; a system that sets none projects the CSS it does today.
- The starter's `scroll` primitive reports the visible range, and a documented, tested widget pattern keeps a 50,000-row list within the node limit.
- `@arnilo/liveframe/dom` mounts a surface without React and passes `/conformance/dom`, or the decision records that the non-goal stands and Tasks 5–6 are closed without code.

This plan implements the rendering part of the proposed 0.4.0 capability work in roadmap Phase 7. Tasks 2–4 add optional fields and options; Tasks 5–6 add two subpaths and change the host-API rule's list of places that may touch the DOM, which is why they need the non-goal lifted first. The shapes in Tasks 2–6 are the proposal Task 1 puts to the owner; a task is amended before it starts if the decision differs. No version is bumped and nothing is published. Spec sections touched: §6.2 and §6.4 (recipes, projection), §7.1 and §7.7 (sources, host pipeline), §11 (renderer), §13 (packages, conformance), §14 (non-goals).

## Rules for every task

1. **Law 3 decides motion.** A widget never names a duration, an easing or an animation. Motion is a recipe property the design system sets and the projection emits; the tree and the SDK gain nothing for it.
2. **Platform floor first.** A task that relies on a browser feature records, from current documentation fetched with `find-docs` or the vendor reference, which engines support it and what happens where it is absent. Absent support must degrade to today's behaviour, never to a broken layout.
3. **Register and format chores** as in plan 037's rules 2–3.

## Tasks

- [x] Task 1: Design the rendering additions and record the decision
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/038-rendering-design.md` specifies each of F5–F8: forms, validation rules with kinds and pointers, what a 0.3.x consumer does, the spec text, and the measurement each relies on.
      - It answers, with a reason each: (F5) whether `pending` is opt-in per source (proposed: `sourceOutcome(result, { pending: true })`, so existing capability documents and widget types do not change) and whether a pending answer raises an event. (F6) which mechanism carries motion — the View Transition API driven by the adapter, CSS `@starting-style` and discrete transitions only, or both — against the platform floor of `docs/compatibility.md`, and how element names are assigned without widget input. (F7) whether windowing needs any library change beyond a starter event and a documented pattern. (F8) the adapter's public surface, how implementations are written without a framework, and which of `/react`'s duties (error containment, scoped portal, focus continuity, style switching) it takes on.
      - A decision log, written with `create-decision-log` after the owner approves, records the design. For F8 it records the owner's answer on spec §14's non-goal; if the answer is no, Tasks 5–6 are closed with that reference.
    - Performance: the design states a budget for each addition and that a host using none pays nothing.
    - Code Quality: the design names what each item deliberately leaves to the app (transport for pending re-renders, the list widget for windowing, primitive implementations for the DOM adapter).
    - Security: a paragraph per law for each item. For F6 it shows that no author-controlled string reaches a CSS property; for F8 that the adapter draws only core contexts, which exist only for validated trees.
  - Approach:
    - Skills to Use:
      - `create-decision-log`.
      - `liveframe-execution` — `references/styling.md` and `references/renderer.md`.
      - `find-docs` — current browser and React documentation for the mechanisms compared.
    - Library Documentation to Check Before Implementation:
      - React 19.3.1 `<ViewTransition>` (react.dev reference, checked 2026-11-15: React calls `startViewTransition` itself; a `flushSync` in the sequence skips the transition; a plain `setState` does not trigger it outside a Transition) — and whether it is available at the peer floor `react ^19.0.0`.
      - MDN: View Transition API (`document.startViewTransition`, `view-transition-name`, `view-transition-class`), `@starting-style`, `transition-behavior: allow-discrete` — support per engine at the time of design.
    - Documentation Reviewed:
      - Spec §6.2 (recipe properties), §6.4 (state selectors, `@starting-style` on `open`), §7.1 (`sourceOutcome`), §7.7 rule 4, §11, §14; `src/css/design-system.ts:197-200`; `src/css/base.ts` (reduced motion); `docs/renderer.md:623` ("Writing another renderer"); `src/__tests__/fixtures/dom-renderer.ts` (79 lines, test-only).
    - Options Considered:
      - Design each item in its task — rejected: F6 and F8 both change what an adapter must do, and F8's conformance suite must include F6's cases or exclude them on purpose.
    - Chosen Approach:
      - One design file, one decision, then the tasks.
    - API Notes and Examples:
      ```ts
      // Proposals the design starts from:
      sourceOutcome(result, { pending: true });            // F5
      // recipe: { "listItem.default.root.rest": { motion: "move" } }   // F6
      import { mountSurface, implement } from "@arnilo/liveframe/dom"; // F8
      ```
    - Files to Create/Edit:
      - `plans/evidence/038-rendering-design.md`; `decision-logs/<date>-rendering-additions-for-0-4-0.md`.
      - This plan: Tasks 2–6 amended where the decision differs.
  - Test Cases to Write:
    - none; the design lists the tests each task must write.
  - Notes (executed 2026-11-19):
    - Wrote `plans/evidence/038-rendering-design.md` (rules `P.*`, `M.*`, `W.*`, `D.*`), using docs fetched with `find-docs` on 2026-11-19: MDN browser-compat-data, MDN content, react.dev `<ViewTransition>` and the React changelog, and React Aria `Virtualizer`.
    - The owner approved the design, the CSS motion mechanism and the F8 scope trims. Recorded in `decision-logs/2026-11-19-1143-rendering-additions-for-0-4-0.md`. The §14 non-goal for F8 was already lifted on 2026-11-15, so Tasks 5–6 stay active.
    - **F5:** opt-in as proposed. A new `source-pending` event. A pending answer that carries a `value` counts as `failed`, and its `message` is dropped. `renderKey` and `liveframe gen` need no change (P.5, P.6).
    - **F6 (differs from the proposal):** `motion` takes `none | fade | move | fade-move`. It is valid only on a root slot's `rest` recipe and needs a `transitionDuration`.
      - Enter is projected as `@starting-style`, gated by a wrapper attribute `data-lf-motion` set after the first drawn tree.
      - Exit keeps the removed element, `inert` and `aria-hidden`, until its transition ends.
      - Move is a FLIP on inline `translate`.
      - No View Transition API: Firefox 144+ is above the Baseline 2024 floor, it is document-global and unscopable, and React `<ViewTransition>` is stable only from 19.3.0, above the `^19.0.0` peer floor.
      - No element names are assigned. Elements are found by `domId`. Task 3 amended.
    - **F7 (differs from the proposal):** no library change. The widget cannot size spacer nodes, because style props take only design-value names. The starter `scroll` instead takes `itemCount`, `itemStart`, `itemSize` (a `size.*` name), `step` and `onRange`, and reserves the space in trusted CSS. It uses a plain scroll listener; React Aria's `Virtualizer` needs the whole collection. Task 4 amended.
    - **F8:** `createDomRenderer` → `mount(container, options)` → `{ update, set, dispose }`; `implement(definition, draw, hooks?)` with `draw(node, element?)`; `place(parent, nodes)`. Shared DOM rules move to `src/dom/` modules that `/react` also imports. No SSR, no custom element, no starter DOM implementations. Tasks 5–6 amended.
    - Not committed, at the owner's request (plans 033–038 remain uncommitted together). `bun run check` was not affected: only plan, evidence and decision-log Markdown changed.

- [x] Task 2: Let a source answer `pending` (F5)
  - Acceptance Criteria:
    - Functional:
      - `sourceOutcome(result, { pending: true })` adds a `pending` variant (`{ status: "pending" }`, no `value`, no `reason`) to the envelope. Without the option the envelope is what it is today, byte for byte.
      - `SourceResult` accepts `{ ok: false, reason: "pending" }`. `renderPlacement` turns it into the envelope when the source declares the variant; when it does not, the render fails at `/data/<alias>` as any undeclared failure does (spec §7.7 rule 4).
      - A pending answer raises the event the design names (proposed: `source-pending`), not `source-failed`.
      - `renderKey` differs between a pending and a resolved answer, so the later render is not skipped.
      - `docs/host.md` shows the pattern end to end: `resolve` answers `pending` for a slow source, the host renders, and re-renders the placement when the value arrives, using `dependents`. The demo host does it for one source.
      - Generated widget types include the variant only for sources that declare it.
    - Performance: no cost for sources without the option; `bench/host.bench.ts` within its 0.2 ms overhead budget.
    - Code Quality: the reason joins `FAILURES`' handling in `src/host/render.ts:22-45`; no timer, queue or subscription enters the library (§7.7 rule 1).
    - Security: law 4 — the widget is told only a status; nothing of the host's reason for the delay reaches it. A resolver cannot smuggle a value in a pending answer: the variant has no `value`.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/formats.md`, then `references/storage.md`.
      - `typescript-advanced-types` — the envelope's inferred union with and without the option.
    - Library Documentation to Check Before Implementation:
      - none; read `src/schema.ts:111-120`, `src/host/render.ts:22-111`, `src/host/types.ts:17-24`, `:79-86`.
    - Documentation Reviewed:
      - Spec §5 (discriminator form: "Adding a tag is a minor catalog change"), §7.1, §7.7 R4–R5; `docs/host.md` "Coordinate placements"; `src/__tests__/outcome.test.ts`, `host-render.test.ts`.
    - Options Considered:
      - Add `pending` to every `sourceOutcome` — rejected: it changes every existing capability document's schema and every widget's inferred union.
      - Resolve sources one at a time inside the library and stream trees — rejected: it puts a schedule and a transport in a stateless function.
    - Chosen Approach:
      - An opt-in variant, one more reason, and a documented host loop.
    - API Notes and Examples:
      ```ts
      const resolve = async (calls, viewer) =>
        Object.fromEntries(calls.map((c) => [c.alias, cache.has(c) ? { ok: true, value: cache.get(c) } : { ok: false, reason: "pending" }]));
      ```
    - Files to Create/Edit:
      - `src/schema.ts`: the option.
      - `src/host/render.ts`, `src/host/types.ts`: the reason and the event.
      - `src/sdk/gen.ts`: types for the variant.
      - `conformance/corpus/capabilities/`: cases with and without the variant.
      - `examples/demo-host/`: one slow source.
      - `scripts/release/api/register-0.4.0.json`.
      - `docs/spec.md` §7.1, §7.7; `docs/host.md`; `docs/sdk.md`; `docs/formats.md`; `CHANGELOG.md`.
  - Test Cases to Write:
    - `pending_answer_becomes_the_envelope_when_declared` and `…_fails_the_render_when_not_declared`.
    - `pending_then_resolved_is_not_skipped`: two renders, two keys, a patch between them.
    - `pending_answer_with_a_value_is_treated_as_failed`: a malformed resolver answer.
    - `source_outcome_without_the_option_is_unchanged`: the schema equals the 0.3.0 one.
    - Type-level: a widget that reads `data.rows.value` without narrowing fails to compile for a source that may be pending.
  - Notes (executed 2026-11-19):
    - **Library.**
      - `sourceOutcome(result, { pending?: P })` in `src/schema.ts` adds `pending: obj({})` when `P` is true. The return type is conditional on `P`, so `Infer` has the `pending` member only when it is declared.
      - `SourceResult` gains `{ ok: false, reason: "pending" }`, and `HostEvent` gains `source-pending` (`src/host/types.ts`).
      - `sourceResult()` accepts a pending answer only without a `value` property and drops `message`. `fitData` reports it as `source-pending`, and `envelope()` already turns it into `{ status: "pending" }` (`src/host/render.ts`). `renderKey` is unchanged (P.5).
    - **Small prerequisite, not in the plan.** `outcomeScenarios` and `renderScenarios({ outcomes: true })` recognised only the 0.3.0 envelope, so they would have rejected a pending-declared source.
      - `outcomeStatuses(schema)` in `src/pack/outcome.ts` now recognises both forms and adds a `<name>.pending` scenario. `src/authoring/index.ts` uses it.
      - Spec §7.3 and §13, `docs/mcp.md` and the MCP tool description now say so.
    - **`liveframe gen` needed no change (P.6).** Widget data types come from `Infer` of the capability schema, and `formType` walks any discriminator mapping. The type-level test is `unnarrowed_value_read_fails_to_compile` in `src/__tests__/outcome.test.ts`.
    - **Tests.**
      - `src/__tests__/outcome.test.ts`: `source_outcome_without_the_option_is_unchanged` (deep-equal and canonical-JSON-equal to a hand-written 0.3.0 shape), `source_outcome_with_pending_adds_one_closed_variant`, the type-level test, and `outcome_scenarios_add_pending_when_declared`.
      - `src/__tests__/host-render.test.ts`: the five host cases from the design.
      - `src/__tests__/host-guide.test.ts`: `guide_pending_example_answers_pending_then_rerenders_the_readers` executes the new `docs/host.md` block.
      - Corpus: `conformance/corpus/capabilities/outcome-valid.json` and `outcome-pending-valid.json`.
    - **Demo host.**
      - `examples/demo-host` gains a slow `tasks.digest` source (`digestMs`, default 300) and a `digest` template widget that draws "Counting…" while the source is pending.
      - `GET /surfaces/:id` now streams NDJSON like the intents route: one frame, then, through `settle()` and `dependents`, a frame for each reader once the read lands. `tasks.claim` marks the digest stale.
      - `client.tsx` reads both routes with one `receiveAll`. A single-frame answer still parses with `.json()`, so the existing demo tests are unchanged.
      - `tests/pending.test.ts` covers the load and the claim paths.
    - **Docs and spec.** Spec §7.1, §7.3, §7.7 rule 4 and Events, and §13. `docs/host.md` gains "Answer a slow source with `pending`". `docs/sdk.md` gains "Sources that may be pending". Also updated: `docs/formats.md`, `docs/mcp.md`, `CHANGELOG.md`, and `register-0.4.0.json` (`sourceOutcome`, `SourceResult`, and the existing `HostEvent` entry extended).
    - **Verification.** `bun run check` passed except one test, `guide_examples_send_nothing_for_a_skipped_render`, which counted the `ts` blocks in `docs/host.md`. After that fix, typecheck, lint and format were rerun, and the host-guide test passes; the 11-minute full suite was not rerun. Also passed: `bun run demo:test` (78 tests), `bench/host.bench.ts` (`pipelineMs` 0.10 ms against the 0.2 ms budget), and the API stability gate.
    - Not committed, at the owner's request (plans 033–038 stay uncommitted together).

- [x] Task 3: Give nodes enter, exit and reorder motion from the design system (F6)
  - Acceptance Criteria:
    - Functional:
      - The design's mechanism (`plans/evidence/038-rendering-design.md` §2, M.1–M.16) is implemented. A recipe property `motion` takes `none`, `fade`, `move` or `fade-move`. It is valid only on a root slot's `rest` recipe and requires a `transitionDuration`.
      - The projection emits, only for slots that set it, `--lf-m`, a non-inheriting `@property`, the scope marker `--lf-motion`, a `@starting-style` enter rule and a `[data-lf-exiting]` exit rule, all under `:where([data-lf-ds=…][data-lf-motion])`. Durations and easings come from the recipe's existing `transitionDuration` and `transitionTiming`. No View Transition API is used.
      - A node appearing in a revision plays the enter motion, a node leaving plays the exit motion before it is gone, and a node whose position among its siblings changed moves, each only when its recipe sets the property.
      - The adapter's part lives in `src/dom/motion.ts`, internal until Task 5 and imported by `/react`.
        - It sets `data-lf-motion` on the wrapper and portal after the first drawn tree, so the first tree never animates in.
        - On a commit that removes or reorders children, it reads `--lf-motion` once per design-system identity.
        - It keeps exiting elements (`inert`, `aria-hidden`) until `transitionend` or the computed duration.
        - It FLIPs moved siblings on inline `translate`.
        - In `/react` the pre-commit reads run in a class boundary's `getSnapshotBeforeUpdate`.
        - `<Surface>` gains no option.
      - `prefers-reduced-motion: reduce` and the existing base rule (`src/css/base.ts`) remove every motion this adds. An engine without the feature draws the new revision at once, as today.
      - A design system that sets no motion property projects byte-identical CSS (the 0.3.0 projection hash test).
      - `designSystemSuite()` checks the property's values; a design system naming a value outside the list is `invalid-document`.
    - Performance: with no motion in the system, `<Surface>` update cost is unchanged (`bench/streaming.bench.ts --production`), apart from one cached computed-style read per surface per design-system identity. With motion, a commit that removes 20 rows and moves 50 adds at most 2 ms in Chromium in the production profile (gated). The WebKit and Firefox numbers are recorded.
    - Code Quality: the property goes through the same resolver, cascade and projection as every recipe property (`src/formats/fixed.ts:143-170`, `src/css/recipe.ts`); no parallel styling path.
    - Security: law 3. The tree carries nothing new, so widget code cannot request or shape motion. The adapter assigns no element names, finds elements by `domId` inside the surface only, and writes only measured numbers to inline `translate`. Law 4: an exiting element is `inert`.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/styling.md`, then `references/renderer.md`.
      - `find-docs` — the browser features the design selected.
    - Library Documentation to Check Before Implementation:
      - The engine support recorded in the design §2.2, re-checked at execution: `@starting-style`, `@property` (`syntax: "*"`, `inherits: false`), `inert`, `transitionend`/`transitioncancel`. React `getSnapshotBeforeUpdate` and `componentDidUpdate` ordering, on React 19.0 and 19.3.
    - Documentation Reviewed:
      - Spec §6.2, §6.4 (the selector table, the `open` state's `@starting-style`), §11 (switching sequence: `data-lf-switching` suppresses transitions); `src/css/design-system.ts:143-208`; `src/react/renderer.tsx:432-451`; `plans/evidence/022-extension-properties-design.md` (how a recipe property was added last).
    - Options Considered:
      - A `transition` style prop for authors — rejected: law 3.
      - Animation left to each primitive's implementation — the status quo: it cannot animate a node that the next tree removed, because the implementation is unmounted with it.
    - Chosen Approach:
      - A recipe property, projected; the adapter assists only as the design requires.
    - API Notes and Examples:
      ```ts
      recipes: { "listItem.default.root.rest": { transitionDuration: "motion.short", motion: "move" } }
      ```
    - Files to Create/Edit:
      - `src/formats/fixed.ts`, `src/formats/design-system.ts`, `schemas/design-system.json`: the property.
      - `src/resolve.ts`; `src/css/recipe.ts`, `src/css/design-system.ts`, `src/css/base.ts`.
      - `src/dom/motion.ts` (new, internal); `src/react/renderer.tsx` (the snapshot boundary).
      - `src/conformance/design-system.ts`; `conformance/corpus/design-system/`.
      - `packages/starter/src/design-system.ts`: one use, as the proof.
      - `scripts/release/api/register-0.4.0.json`.
      - `docs/spec.md` §6.2, §6.4, §11; `docs/styling.md`; `docs/renderer.md`; `CHANGELOG.md`.
  - Test Cases to Write:
    - `system_without_motion_projects_identical_css`: equal to the stored 0.3.0 projection.
    - `motion_value_outside_the_list_is_invalid_document`.
    - `motion_outside_root_rest_is_invalid_document` and `motion_without_duration_is_invalid_document`.
    - `first_tree_plays_no_enter`, `removed_row_plays_its_exit_before_it_is_gone`, `exiting_row_is_inert_and_hidden` and `reordered_row_moves` (browser, all three engines).
    - `react_tolerates_the_kept_element` (React 19.0 and 19.3).
    - `reduced_motion_removes_every_added_motion`.
    - `switching_theme_plays_no_motion`: the switching sequence still suppresses it.
  - Notes (executed 2026-11-19):
    - **Format and projection.**
      - `motion` (`none | fade | move | fade-move`) joins `recipeProperties` and the design-system schema.
      - Validation: off a root rest recipe it is rejected by a new `placement()` check in `src/formats/design-system.ts`, and a resolved motion without a `transitionDuration` is rejected by `fillSlot` in `src/resolve.ts`, once per variant. Both are `invalid-document` at `/recipes/<key>/motion`.
      - `src/css/recipe.ts` emits `--lf-m:<value>`. `motionRules()` in `src/css/design-system.ts` adds `@property --lf-m`, `--lf-motion:1`, the enter rule and the exit rule, all after the state rules.
      - The proof systems' 0.3.0 projection hashes are unchanged.
    - **The adapter differs from design M.13–M.14.** The details are recorded in the new design §2.5.
      - Exit and move are Web Animations, timed by the recipe's computed transition and played in the next animation frame, before paint. The first version used CSS transitions and an inline-`translate` FLIP inside the commit, which added 10.9 ms there.
      - React reorders by re-inserting nodes, which replayed `@starting-style`. Kept fading rows are now marked `data-lf-stay` before the commit, and the enter rule skips them.
      - A commit that precedes a theme or design-system switch plays nothing. `<Surface>` passes `switching` to the new `Motion` class boundary. Relying on transition cancellation failed in WebKit.
      - The boundary sits outside `FocusContinuity` and is keyed by `surfaceId`.
    - **Small prerequisite.** `src/dom/` is listed in the portability matrix as an internal DOM host. Task 5 names it in the docs' host-API rule.
    - **Tests.**
      - Format and CSS: `design-system.test.ts` has the three validation tests. `css-design-system.test.ts` has `system_without_motion_projects_identical_css` and `motion_projects_marker_enter_and_exit_rules`.
      - Corpus: four `conformance/corpus/design-system/motion*.json` cases. `conformance-design-system.test.ts` has `design_system_suite_checks_motion_values`.
      - Browser: `react-motion-browser.test.tsx` holds the seven named cases plus `system_without_motion_draws_revisions_at_once`. They pass in Chromium, WebKit and Firefox, three runs each.
      - React 19.0: the suite is added to `scripts/release/peer-floors.ts`. `--floor react` passes on 19.0.0 (162 tests).
    - **Performance.**
      - The gate moved to a new `bench/motion.bench.ts` (added to `bun run bench`), because `streaming.bench.ts` drives Chromium over CDP only.
      - Production, 20 rows removed and 50 moved. Commit added: Chromium +0.4 ms (gated, 2 ms), WebKit +1.0 ms, Firefox +1.0 ms. Work moved to the next frame (recorded, not gated): Chromium 3.3 ms, WebKit 5 ms, Firefox 4 ms.
      - `streaming.bench.ts --production` without motion: React work median 1.1 ms. The focus-continuity gate holds (diff 0.2–0.4 ms).
    - **Starter.** `box.plate` uses `fade-move`.
    - **Docs.** Updated: spec §6.2, §6.4 and §11, `docs/styling.md` ("Motion: enter, exit and reorder"), `docs/renderer.md` ("Enter, exit and reorder motion"), `docs/formats.md`, `docs/migration-0.4.md`, `CHANGELOG.md`, and `register-0.4.0.json` (`design-system.json`, `Recipe`, `ResolvedRecipe`, `recipeProperties`).
    - **For Tasks 5–6.** `/dom` drives `createMotion()` around its own mutation (`before`, `after`, `halt` on switch, `dispose`). `/conformance/dom` reuses the motion browser cases (design §2.5).
    - **Verification.** `bun run check` passes (2006 tests). An earlier run done alongside the peer-floor run failed on load timeouts only.
    - Not committed, at the owner's request (plans 033–038 stay uncommitted together).

- [x] Task 4: Prove and document windowing for long collections (F7)
  - Acceptance Criteria:
    - Functional:
      - The starter's `scroll` primitive gains (design W.2–W.3):
        - props `itemCount`, `itemStart` (integers, 0–1,000,000,000), `itemSize` (an enum of the starter's `size.*` names; the design system gains `size.row`) and `step` (integer 1–200, default 20);
        - event `onRange`, object carry `{ start: integer, end: integer }`, raised when the visible range comes within `step` rows of either edge of the drawn slice.
      - The implementation reserves the leading and trailing space as viewport block padding computed with `calc()` from `var(--lf-v-size_row)`, uses a passive, rAF-throttled scroll listener (not React Aria's `Virtualizer`), and sets `overflow-anchor: none`.
      - A fixture widget lists 50,000 rows with at most 200 row nodes in any tree. It keeps the range in widget state, binds the source to it, renders that slice with stable keys, and passes `itemStart` and `itemCount`. Spacer nodes are not used: style props cannot express an arbitrary length (law 3).
      - Across a range change, rows present in both trees keep their DOM nodes, focus and scroll position; the patch between the two trees contains only the rows that entered and left.
      - `docs/sdk.md` gains "Lists longer than the node limit" with the pattern; `docs/model.md`'s performance section points to it.
      - Task 1 found that no library change is needed (W.1). If the patch test shows `diffTrees` rewriting shifted rows, record that as a finding and fix it here with its own criteria.
    - Performance: a range change of 20 rows produces a patch of at most 42 ops and at most 25% of the full 200-row tree's serialized bytes, and commits within one frame (16.7 ms) on the proof design systems in the production profile. Both are gated in `bench/streaming.bench.ts`.
    - Code Quality: no list component enters the library or a catalog as a product-shaped kind: `scroll` stays a primitive, and the list is widget code.
    - Security: law 2 — every window is a whole validated tree within the node limit; law 4 — the range is state the host checks against the manifest's schema like any `setState` value.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/renderer.md`.
      - `find-docs` — the observer APIs the primitive uses.
    - Library Documentation to Check Before Implementation:
      - MDN scroll events and CSS scroll anchoring (`overflow-anchor`). React Aria's `Virtualizer` was checked in Task 1 and is not used (W.4).
    - Documentation Reviewed:
      - Spec §7.1 (widgets page or window their rows), §9.1 (patches), §10 (node limit 5,000), §6.3 (`deferOffscreen`, `src/css/style-props.ts:86-89`); `roadmap.md` §1 ("Budgets on realistic sizes"); `packages/starter/src/catalog.json` (`scroll`), `implementations.tsx`.
    - Options Considered:
      - Raise the node limit — rejected: cost grows with nodes on the backend, the wire and the browser (`docs/model.md`).
      - A library `list` primitive with built-in virtualisation — rejected: product-shaped, and the catalog is the app's.
    - Chosen Approach:
      - One starter event, one fixture widget, one documented pattern, measured.
    - API Notes and Examples:
      ```tsx
      <Scroll label="Rows" itemCount={total} itemStart={range.start} itemSize="size.row" onRange={state.set("range")}>
        {rows.slice(range.start, range.end).map((r) => <Row key={r.id} row={r} />)}
      </Scroll>
      ```
    - Files to Create/Edit:
      - `packages/starter/src/catalog.json`, `implementations.tsx`, `design-system.ts`, `ui.gen.ts`, `ui.definitions.gen.ts` (generated).
      - `packages/starter/src/__tests__/browser.test.ts`, `browser-fixtures.ts`.
      - `src/__tests__/fixtures/widgets/` (the 50,000-row fixture widget) and `src/__tests__/sdk-proof-widgets.test.ts`.
      - `bench/streaming.bench.ts`, `bench/streaming-client.tsx`.
      - `docs/sdk.md`, `docs/model.md`, `packages/starter/README.md`, `CHANGELOG.md`.
  - Test Cases to Write:
    - `windowed_list_never_exceeds_the_row_budget`: every tree across a scripted scroll has at most 200 row nodes and passes validation.
    - `windowed_list_reserves_space_through_the_primitive` (browser): the viewport's scroll height equals `itemCount × size.row`.
    - `rows_in_both_windows_keep_their_dom_nodes_and_focus` (browser).
    - `range_change_patch_holds_only_entering_and_leaving_rows`.
    - `scroll_position_is_stable_across_a_range_change` (browser): the first visible row's offset moves by less than one pixel.
    - `starter_catalog_still_passes_every_suite`.
  - Notes (executed 2026-11-19):
    - **No library change (W.1 confirmed).** Two 200-row windows 20 rows apart diff to 41 ops: one `set` of the scroll, 20 `remove` and 20 `insert`, with no `move`. The patch is 13.3% of the tree's bytes.
    - **Starter catalog.** `scroll` gains `itemCount`, `itemStart`, `itemSize` (`size.glyph | size.panel | size.row`) and `step`, and the event `onRange` (`{ object: { start, end } }`). The vocabulary and the design system gain `size.row` (36 px). `ui.gen.ts` and `ui.definitions.gen.ts` are regenerated. The catalog id stays `starter.ui@1`.
    - **Implementation (`packages/starter/src/implementations.tsx`, `ScrollView`).** It uses a passive scroll listener, at most one check per animation frame, and `overflow-anchor: none`. `onRange` is raised once per distinct visible range, and only when the visible rows come within `step` of the drawn slice's edge. The design differs in two places, recorded in design §3.1:
      - The block padding is on an inner `div`, not on the viewport. Base `border-box` sizing let a viewport padding of 1.8M px override `max-height: 100%`.
      - The row size is read from computed style on every check, so a design-system switch needs no separate path.
    - **Small prerequisite.** An event makes `scroll` an interactive kind, and resolution then requires a focus overlay. The starter design system adds one on `scroll.*.viewport`, the tab stop, inset by 2 px. The browser fixtures gain the `scroll.default.focus` state.
    - **The fixture lives with the starter, not in `src/__tests__/fixtures/widgets/`.** Those widgets compile against the proof catalog, whose `scroll` does not window. The fixture is `packages/starter/src/__tests__/windowed.tsx`: capabilities, a manifest whose `rows` source binds `range.start` and `range.end` from state, the app's `readWindow` and the `WindowedList` widget.
      - Bindings carry values, not expressions, so the source applies the overscan (60 rows, capped at 200 rows), not the widget (design §3.1).
      - `sdk-proof-widgets.test.ts` is unchanged.
    - **Tests.**
      - `windowed.test.ts`: `windowed_list_never_exceeds_the_row_budget` (251 scripted ranges, each tree validated) and `range_change_patch_holds_only_entering_and_leaving_rows`.
      - `windowed-browser.test.ts`: `windowed_list_reserves_space_through_the_primitive` (`scrollHeight` = 50,000 × 36 px), `rows_in_both_windows_keep_their_dom_nodes_and_focus` and `scroll_position_is_stable_across_a_range_change`. All pass in Chromium, WebKit and Firefox, three runs each.
      - `starter_catalog_still_passes_every_suite` is covered by the existing `suites.test.ts` and `browser.test.ts`. Both pass with the new state fixture.
    - **Performance (`bench/streaming.bench.ts`, new "Windowed list" section, starter design system).**
      - The patch is gated always: 41 ops against 42, and 13.3% against 25%.
      - The commit is gated in production at p95 < 16.7 ms: median 3.8 ms, p95 5.4 ms, measured under host load of about 17.
      - The gate runs on the starter design system rather than the proof systems, because the proof catalog cannot draw this list.
      - In the same run, the existing focus-continuity gate missed (0.6–1.4 ms against 0.5 ms). Two QEMU VMs were using the CPU (load 17.8). That measure draws the proof agent-home and does not run the windowed code. Rerun it on a quiet machine in Task 7.
    - **Docs.**
      - `docs/sdk.md` gains "Lists longer than the node limit".
      - The spec §7.1 "Long lists are paged or windowed" bullet points to it, and so does `docs/model.md`'s performance lever 2, with the measured numbers.
      - Also updated: `packages/starter/README.md`, `CHANGELOG.md`, and design §3.1.
      - `register-0.4.0-starter.json` gains `./definitions Scroll` (widened). The existing `./ui Scroll` entry's reason now also names the windowing props.
    - **Verification.**
      - `bun run check`: build, `gen:check`, typecheck, lint and format passed. Tests: 2001 passed and 1 failed. The failure was `baseline_0_3_0_matches_the_companion_packages`, because the starter register had no `./definitions Scroll` entry.
      - After the register entry, `api-stability.test.ts` passes (17 tests). The 11-minute full suite was not rerun, because the fix touches only the register JSON, which only that test reads.
      - `bench/streaming.bench.ts --runs 2` (development smoke) also runs the new section.
    - Not committed, at the owner's request (plans 033–038 stay uncommitted together).

- [x] Task 5: Ship a DOM adapter on the surface core (F8, part 1)
  - Acceptance Criteria:
    - Functional:
      - The non-goal is lifted (decision 2026-11-15; design approved 2026-11-19). `@arnilo/liveframe/dom` exports the surface in design D.1–D.3:
        - `createDomRenderer({ catalog, implementations } | { catalogs })`, whose registry check is shared with `/react` through one framework-free function and returns `{ mount }`;
        - `mount(container, options)` → `{ update(tree): Result<SurfaceSnapshot>, set(partial), dispose() }`;
        - `implement(definition, draw, hooks?)`, where `draw(node, element?)` creates the element when `element` is undefined and otherwise updates and returns it. It is called only for nodes whose core context changed, and `node.emit` is stable per node id;
        - `place(parent, nodes)`, using `moveBefore` where the engine has it and `insertBefore` otherwise.
      - `mount` validates each arrival through `createSurfaceCore`, draws the core's contexts keyed by id so unchanged nodes keep their elements, applies `setLocal` and bindings through the core, and draws the app's fallback for an invalid arrival.
      - It applies `surfaceAttributes` and the switching sequence of spec §6.4 to its wrapper.
      - It imports no framework. The portability test lists `/dom` as a place that may use DOM globals; spec §13, `AGENTS.md`, `roadmap.md` §1 and the execution skill's architecture reference name it in the host-API rule in the same task.
    - Performance: mounting and patching the agent-home tree are measured in the browser harness and budgeted against `/react`'s numbers in the design.
    - Code Quality: the adapter holds no rule the core holds; it starts from `src/__tests__/fixtures/dom-renderer.ts`, which then imports the shipped adapter or is removed.
    - Security: law 1 — implementations are the app's compiled code; the adapter runs no string as code and sets no `innerHTML`. Law 2 — it draws only contexts the core built from a validated tree. Each has a test.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/renderer.md` and `references/architecture.md` (a new subpath).
      - `typescript-advanced-types` — `implement()` typed from the definition, as `src/react/implement.ts` is.
    - Library Documentation to Check Before Implementation:
      - DOM Standard: `Node.insertBefore` and `moveBefore` (support per engine, for keeping state across reorders); Bun 1.4.2+ bundler output for a browser subpath.
    - Documentation Reviewed:
      - Spec §11 ("The surface core is framework-independent"), §13, §14; `docs/renderer.md:623` onward; `src/surface/core.ts` (`NodeContext`, `SurfaceCore`); `src/__tests__/surface-dom-parity.test.ts`; `src/__tests__/portability.test.ts:6-50`; `src/__tests__/exports.test.ts`; `scripts/release/archive-gate.ts`.
    - Options Considered:
      - A separate package — rejected unless the design finds a dependency: the adapter has none, and the spec's model is one package with subpaths.
      - A custom element only — rejected as the base: a custom element is a thin wrapper over `mount`, added in Task 6 if the design keeps it.
    - Chosen Approach:
      - A subpath over the core, promoted from the test renderer.
    - API Notes and Examples:
      ```ts
      const { mount } = createDomRenderer({ catalog, implementations });
      const surface = mount(container, { validator, theme, designSystem, onIntent, fallback });
      surface.update(tree);
      ```
    - Files to Create/Edit:
      - `src/dom/index.ts`, `src/dom/renderer.ts`, `src/dom/implement.ts`, `src/dom/place.ts`; the registry check shared with `src/react/renderer.tsx`.
      - `package.json` `exports` (`./dom`); `scripts/build.ts`; `scripts/release/archive-gate.ts`; `src/__tests__/exports.test.ts`; `src/__tests__/portability.test.ts`.
      - `src/__tests__/fixtures/dom-renderer.ts`, `surface-dom-parity.test.ts`.
      - `scripts/release/api/register-0.4.0.json`.
      - `docs/spec.md` §11, §13, §14; `AGENTS.md`; `roadmap.md` §1; `.claude/skills/liveframe-execution/SKILL.md` and `references/architecture.md`; `docs/renderer.md`; `README.md`; `CHANGELOG.md`.
  - Test Cases to Write:
    - `dom_registry_check_matches_reacts`: missing, duplicate and differing implementations give the same `catalog-mismatch` errors.
    - `dom_draws_the_same_structure_as_react` (the existing parity test, now against the shipped adapter).
    - `dom_keeps_elements_for_unchanged_nodes_across_revisions_and_reorders` (browser).
    - `dom_invalid_arrival_draws_only_the_fallback`.
    - `dom_adapter_sets_no_inner_html_and_evaluates_nothing`: a source scan, as the portability test scans for host APIs.
  - Notes (executed 2026-11-19):
    - **The subpath.** `@arnilo/liveframe/dom` (`src/dom/index.ts`) exports `createDomRenderer`, `implement`, `place` and `RendererError`, and the types `DomImplementation`, `DomNode`, `DomItem`, `Draw`, `DrawHooks`, `MountOptions` and `DomSurface`.
      - `createDomRenderer` returns `{ mount }`. `mount(container, options)` returns `{ update, set, dispose }`.
      - `update` calls `core.accept` and draws before it returns. An invalid arrival draws only `fallback()`. A local write redraws through `core.subscribe`.
      - `draw(node, element?)` runs only for a node whose core context changed. A shared context keeps its element and its whole subtree. `node.emit` is stable per node id and reads the current context. A node that leaves the tree, or whose element `draw` replaced, gets its `dispose` hook.
      - `place(parent, nodes)` sets the children exactly, keeping the longest run already in order. It uses `moveBefore` where the engine has it, and `insertBefore` otherwise.
      - `mount` appends a wrapper and a sibling portal container, both with `surfaceAttributes(...)`. It writes them only when they change. `set` runs the §6.4 switching sequence on both for a new theme, design system or transparency.
    - **Differs from the design (recorded in design §4.1).**
      - `node.style` is keyed by CSS property name, for `element.style.setProperty`. The core's keys are React's camelCase.
      - The portal and the switching sequence landed here, because D.2's `mount` needs them. Task 6 moves the switching code into `src/dom/switching.ts`.
    - **Shared with `/react`.**
      - The registry check, `RendererError` and the refused core moved from `src/react/renderer.tsx` to `src/surface/registry.ts` (`checkRegistries`, `refusal`, `refusedCore`). Both adapters call them, and `/dom` re-exports the same `RendererError` class.
      - The implementation prop types (`Props`, `Emit`, `Events`) moved to `src/surface/implementation.ts`.
      - `/react`'s behaviour and exports are unchanged. Its `implement` declaration no longer inlines `Props`, so `register-0.4.0.json` records it as `widened` with no type change.
    - **The test renderer.** `src/__tests__/fixtures/dom-renderer.ts` is now `domImplementations(catalog)`, generic DOM implementations on the shipped adapter. The parity client mounts `/dom` instead of the old test-only renderer.
    - **Host-API rule.** `/dom` joins the places that may use DOM globals in spec §13, `roadmap.md` §1, the execution skill's `SKILL.md` and `references/architecture.md`. `AGENTS.md` names no subpath list (it says only "a host-API-free core"), so it is unchanged. `portability.test.ts` now also forbids any framework import under `src/dom/`.
    - **Tests.**
      - `src/__tests__/dom.test.ts`: `dom_registry_check_matches_reacts` (missing, duplicate, differing, outside-catalog, several catalogs and an invalid catalog all give equal errors) and `dom_adapter_sets_no_inner_html_and_evaluates_nothing`.
      - `exports.test.ts`: `dom_export_surface`.
      - `surface-dom-parity.test.ts`: `dom_draws_the_same_structure_as_react` (renamed), now against the shipped adapter, plus the existing local-state parity test.
      - `src/__tests__/dom-browser.test.ts`:
        - `dom_keeps_elements_for_unchanged_nodes_across_revisions_and_reorders`: elements are kept, only `root`, the changed row and the new row are drawn, focus stays on a row that keeps its place, and an identical revision draws nothing.
        - `dom_invalid_arrival_draws_only_the_fallback`.
        - `dom_wrapper_and_portal_carry_scope_and_switch_together`.
      - The browser tests and the parity tests pass in Chromium, WebKit and Firefox.
    - **Performance.** The new `bench/dom.bench.ts` is added to `bun run bench`. It draws agent-home (679 nodes) with both adapters, whose implementations draw the same elements, and gates in Chromium production on the paired `/dom ÷ /react` ratio (design §4.1).
      - Two production runs under host load of about 7:
        - Chromium: mount 9.4 → 7.5 ms (×0.79–0.81), patch 1.60 → 1.52 ms (×0.95–0.97). Gated, passes.
        - Firefox: mount ×0.50–0.56, patch ×0.86–0.89.
        - WebKit: mount ×0.66, patch ×1.02–1.04 (1.40 → 1.48 ms). Recorded, not gated.
      - Validation and the core are about 1.3 ms of the 1.6 ms Chromium patch, for both adapters.
    - **Docs.**
      - Spec §11: rule 4, the core paragraph, and a new "The DOM adapter" subsection.
      - Spec §13: the `/dom` table row, the browser-subpaths line and the host-API rule. Spec §14: the non-goal now reads "other than React and the plain DOM adapter", citing the 2026-11-15 scope decision.
      - Also updated: `docs/renderer.md` "Writing another renderer" (which points to `/dom`), `README.md`, `roadmap.md` §1, the execution skill (`SKILL.md`, `references/architecture.md`, `references/renderer.md`), `CHANGELOG.md` and `register-0.4.0.json` (eleven `./dom` entries).
    - **For Task 6.**
      - Not yet in `/dom`: error containment (a throwing `draw` currently throws out of `update`), focus continuity (no `tabindex` on the wrapper yet), the focus mark, `invalid="keep-last"` and motion.
      - The portal container already exists and carries the scope attributes. Task 6 tests it as an overlay host.
    - **Verification.**
      - `bun run check`: build, `gen:check`, typecheck, lint and format passed. Tests: 2005 passed and 3 failed.
        - `core_has_no_react_or_dom_imports` and `src_is_host_api_free` failed because a doc comment in `src/surface/implementation.ts` read "thrown at the window.", which the DOM-global scans match. The comment was reworded.
        - `acceptance_map_covers_every_bullet_of_plans_026_to_031` failed because `plans/evidence/032-acceptance-map.json` named the renamed parity test. It now names `dom_draws_the_same_structure_as_react`.
      - After the fixes, those three test files pass (66 tests), and typecheck, lint and format pass again. The 11-minute full suite was not rerun, because the fixes touch only a comment and the acceptance map.
      - Also passed: `api-stability.test.ts` (17 tests), and `dom-browser.test.ts` with `surface-dom-parity.test.ts` in all three engines.
    - Not committed, at the owner's request (plans 033–038 stay uncommitted together).

- [x] Task 6: Give the DOM adapter the remaining renderer duties and a conformance suite (F8, part 2)
  - Acceptance Criteria:
    - Functional:
      - The adapter contains a throwing implementation at its node (the fallback there, `core.fail(node)`, a retry on the next arrival). It supplies the scoped portal container with the wrapper's scope attributes, and keeps focus continuity, the focus mark, the switching sequence, `invalid="keep-last"` and motion as spec §11 defines them.
      - Amended after Task 5: the portal container and the switching sequence already exist in `src/dom/renderer.ts`. This task proves the portal as an overlay host and moves the switching code into the shared module.
      - Focus continuity, the focus mark and the switching sequence move from `/react` into `src/dom/focus.ts` and `src/dom/switching.ts`, which both adapters import (design D.4), so each rule exists once.
      - `@arnilo/liveframe/conformance/dom` exports the suite an app runs against its DOM implementations. It reuses the case definitions of `/conformance/react` where a case is about observable DOM and intents, including the cases plan 037 Task 8 added.
      - No custom element ships (decision 2026-11-19); the guide shows a short one written over `mount`.
      - The starter gains no DOM implementations. The suite runs against a fixture registry in `src/__tests__/fixtures/`, and its server-structure cases run in the browser page because `/dom` has no SSR.
      - `docs/renderer.md` "Writing another renderer" becomes a guide to `/dom`, executed by a guide test.
    - Performance: the browser suite's added time is recorded; no case waits on a fixed delay.
    - Code Quality: shared cases live once; `/conformance/react` and `/conformance/dom` differ only in how they mount.
    - Security: the conformance suite carries the law 4 case (a renderer that forwards `setLocal` fails) for the DOM adapter too.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/renderer.md`.
      - `find-docs` — Playwright.
    - Library Documentation to Check Before Implementation:
      - Playwright 1.49–1.64.
    - Documentation Reviewed:
      - Spec §11 (error containment, portal, focus continuity), §13 (conformance); `src/conformance/react/browser.tsx`, `server.tsx`, `page.tsx`, `overlays.ts`, `states.ts`; `docs/conformance.md`.
    - Options Considered:
      - No suite for `/dom` — rejected: every shipped surface an app implements has one (spec §13).
    - Chosen Approach:
      - Finish the duties, then share the cases.
    - API Notes and Examples:
      ```ts
      import { domRendererBrowserSuite } from "@arnilo/liveframe/conformance/dom";
      ```
    - Files to Create/Edit:
      - `src/dom/renderer.ts`, `src/dom/focus.ts`, `src/dom/switching.ts`; `src/react/renderer.tsx` (imports the shared modules).
      - `src/conformance/dom/index.ts`; shared cases moved to `src/conformance/renderer-cases.ts` (tentative name).
      - `package.json` `exports` (`./conformance/dom`); `src/__tests__/exports.test.ts`, `portability.test.ts`.
      - `src/__tests__/conformance-dom.test.ts`, `conformance-dom-browser.test.ts`; fixtures.
      - `docs/spec.md` §13; `docs/conformance.md`; `docs/renderer.md`; `CHANGELOG.md`.
  - Test Cases to Write:
    - `dom_throwing_implementation_falls_back_at_that_node_and_retries`.
    - `dom_overlay_keeps_surface_scope` and `dom_focus_continuity_matches_the_spec`.
    - `dom_suite_fails_a_broken_subject_on_its_named_rule`: one broken subject per shared case.
    - `react_suite_is_unchanged_by_the_shared_cases`: the React suites report the same case names and outcomes as before the move.
    - `dom_guide_examples_run`.
  - Notes (executed 2026-11-19):
    - **Shared renderer rules (design D.4, §4.2).**
      - `src/dom/focus.ts` holds focus continuity (`focusSnapshot`, `restoreFocus`), the focus mark (`createFocusMark`, `moveFocus`) and `notifyHost`. `src/dom/switching.ts` holds the §6.4 sequence (`beginSwitch`).
      - `/react`'s `FocusContinuity`, `useFocusMark` and switching effect now call them, and their own copies are gone. Behaviour is unchanged: the React browser, motion and parity suites pass as before.
    - **`/dom` duties (`src/dom/renderer.ts`).**
      - A `draw` that throws draws `fallback()` at that node, calls `core.fail(node)` and is retried on the next arrival.
      - `invalid: "keep-last"` keeps the last tree with `data-lf-stale` and `aria-busy`. `focusContinuity` (default `true`) puts `tabindex="-1"` on the wrapper.
      - Each draw runs, in `<Surface>`'s order: focus snapshot, motion `before`, the mutation, `restoreFocus`, motion `after` and `gate`, then the focus mark.
      - Motion is keyed by `surfaceId` and dropped under the fallback. `set()` with a new scope halts motion, then runs `beginSwitch`.
    - **Differs from the design (recorded in design §4.2).**
      - `place()` now leaves a `[data-lf-exiting]` child in place. Before, a parent's next draw removed an element still playing its exit, which React never does.
      - The shared cases live in a directory, `src/conformance/renderer/` (`page.ts`, `browser.ts`, `structure.ts`, and `overlays.ts` and `states.ts` moved from `src/conformance/react/`), not in one `renderer-cases.ts`. The `window.liveframeConformance` type is declared once there.
      - Structural cases on the page: `domConformancePage()` adds `structure`, `fallbackSurface` and `fallbackMarkup`, and writes canonical markup (attributes sorted, `name:value` styles) so the same parsers read both adapters' output. `every_example_renders_on_the_server_under_every_design_system` also fails an example that raised `implementation-failed`, because `/dom` contains a throwing `draw` where React's server rendering throws.
      - The motion browser tests are library tests, not conformance cases, so they were not added to the suites (that would change the React suites' case list). They moved into `src/__tests__/fixtures/motion-browser.ts`, run by `react-motion-browser.test.tsx` and the new `dom-motion-browser.test.ts`.
    - **Finding, fixed (WebKit).** WebKit has no `moveBefore`, so `place()`'s `insertBefore` blurred a focused text field that a reorder moved, and `focus_scroll_and_local_state_survive_revisions` failed there. React DOM refocuses the element it saw focused, with its selection, after each commit. The shared `restoreFocus` now does the same for a still-connected element when focus fell to the body; for `/react` it is a no-op. The `replace` broken subject now recreates the text field itself, since a recreated container no longer loses focus.
    - **Finding, fixed.** `failed_binding_draws_the_node_fallback` checked `called.has("lf:<id>")`, but React's `domId` prefix is `lf-<useId>`, so that half of the check never matched. It now matches any `domId` ending `:<id>`.
    - **`/conformance/dom`.** It exports `domRendererBrowserSuite`, `domConformancePage` and the types `DomSuiteOptions`, `DomPageOptions`, `BrowserFixtures` and `Styles`.
      - The suite runs `registry_check_passes`, the five structural cases on the page, then the fifteen browser cases without hydration, all under the React names.
      - The page counts `draw` calls as renders, so it needs no development build.
      - It is in `package.json` `exports`, `exports.test.ts` and `portability.test.ts`. There, `conformance/dom` and the internal `conformance/renderer` are DOM hosts that may import no framework, joining `dom`.
    - **Fixture registry.** `src/__tests__/fixtures/conformance-dom.ts` writes app-style DOM implementations of the conformance catalog: a native form, a text field bounded in code points, a button, and a modal dialog in `node.portal` with scroll lock, an inert background and an exit that plays out. `conformance-dom-client.ts` is the page.
    - **Tests.**
      - `conformance-dom-browser.test.ts`:
        - `dom_suite_runs_the_shared_cases` (the case list) and `dom_fixture_registry_passes_every_shared_case`.
        - `dom_overlay_keeps_surface_scope`, with the `scope` subject.
        - `dom_suite_fails_a_broken_subject_on_its_named_rule`: 17 broken subjects plus the registry case, covering every shared case but two. `invalid_arrival_renders_only_the_fallback` and `invalid_arrival_shows_only_the_fallback_and_recovers` test the adapter itself, which an app subject cannot break.
        - `dom_law_4_a_renderer_that_forwards_set_local_fails_only_its_rule` and `dom_state_case_reaches_selected_and_catches_an_unreachable_state`.
      - `dom-browser.test.ts`: `dom_throwing_implementation_falls_back_at_that_node_and_retries` and `dom_focus_continuity_matches_the_spec` (successor, predecessor, wrapper, focus outside left alone, opt-out).
      - `conformance-renderer-browser.test.tsx`: `react_suite_is_unchanged_by_the_shared_cases` pins the 16 browser case names and their order. The server case names were already pinned, and every React suite and mutant test passes unchanged.
      - `dom-motion-browser.test.ts`: the eight motion cases against `/dom`.
      - `dom-guide.test.ts`: `dom_guide_examples_run` executes `src/__tests__/fixtures/dom-guide.ts` in the browser and checks that `docs/renderer.md` contains its three blocks verbatim. `conformance-guide.test.ts` gains `conformance_guide_dom_example_runs`.
    - **Docs.**
      - `docs/renderer.md` "Writing another renderer" became "Render without a framework": implement, place, mount, a custom element over `mount`, and "Writing another renderer" as its last subsection.
      - `docs/conformance.md` gains "Prove a `/dom` registry". Spec §11 ("The DOM adapter": `invalid`, `focusContinuity`, `place` and exits, shared duties) and §13 (the `/conformance/dom` row, browser subpaths, host-API rule, shared cases) are updated.
      - The host-API rule now names `/conformance/dom` in spec §13, `roadmap.md` §1, the skill's `SKILL.md` and `references/architecture.md`, and `portability.test.ts`. `AGENTS.md` names no subpath list.
      - Also updated: `README.md`, `references/renderer.md`, `CHANGELOG.md`, and `register-0.4.0.json` (six `./conformance/dom` entries added; `./conformance/react` `PageOptions` and `rendererSuite` widened with no type change).
    - **Performance.**
      - The full DOM suite against the fixture registry, with the styled-state case excluded, takes about 23 s in Chromium. The whole `conformance-dom-browser.test.ts` file, with its broken subjects, takes about 70 s. No new case or fixture waits on a fixed delay; the shared overlay-lock case keeps its existing 150 ms wait.
      - `bench/dom.bench.ts --production` still passes with the new duties, under host load of about 9:
        - Chromium: mount ×0.93, patch ×0.87 against `/react` (gated).
        - WebKit: mount ×0.99, patch ×0.94. Firefox: mount ×0.86, patch ×0.90.
    - **Verification.**
      - `bun run check` passes (2044 pass, 9 skip). The first run failed only `dom_adapter_sets_no_inner_html_and_evaluates_nothing`, whose pinned file list lacked `focus.ts` and `switching.ts`.
      - After the WebKit fix, the new and changed browser files pass in Chromium, WebKit and Firefox: `conformance-dom-browser`, `dom-browser`, `dom-motion-browser`, `react-motion-browser`, `dom-guide`, `conformance-renderer-browser`, `surface-dom-parity` and `dom`. The `replace` subject was then reworked and rerun in all three engines.
      - `api-stability.test.ts` passes.
    - Not committed, at the owner's request (plans 033–038 stay uncommitted together).

- [x] Task 6a: Document what 0.4.0 asks of starter design systems and finish the migration guide (impact findings F1–F3)
  - Acceptance Criteria:
    - Functional:
      - `docs/migration-0.4.md` gains an "Action needed" section for a design system written for `starter.ui@1`: declare `size.row` and add a `scroll` focus recipe, each with its error kind and pointer.
      - It also gains sections for `pending`, starter windowing, and `/dom` with `/conformance/dom`.
      - The starter README and the `CHANGELOG.md` windowing line point to the action.
      - Spec §5 says that catalog additions keep the id but can make a design system incomplete, and what each kind of addition requires.
      - The styling skill reference states `motion`'s rules.
    - Performance: n/a — documentation and one test.
    - Code Quality: no library or catalog change; the catalog id stays `starter.ui@1` (owner, 2026-11-19).
    - Security: n/a — no law touched; the change names the existing fail-closed `validateDesignSystem` errors.
  - Approach:
    - Chosen Approach: document the change and pin it with a test. A `starter.ui@2` bump was rejected by the owner: widgets and trees are unaffected, and the spec's id rule protects those.
    - Files to Create/Edit: `docs/migration-0.4.md`, `docs/spec.md` §5, `packages/starter/README.md`, `CHANGELOG.md`, `.agents/skills/liveframe-execution/references/styling.md`, `packages/starter/src/__tests__/suites.test.ts`.
  - Test Cases to Write:
    - `design_system_without_the_0_4_additions_fails_with_the_two_documented_errors`: the starter design system without `size.row` and `scroll.*.viewport.focus` gives exactly `unknown-name` at `/values/size.row` and `incomplete-design-system` at `/recipes/scroll.default.root.focus`. It fails if the starter catalog's requirements change without the migration note changing.
  - Notes (executed 2026-11-19):
    - Done as listed. The migration examples use the starter's own recipe (`focus.ring`, `border.focus`, a −2 px offset) and value (36 px).
    - Verification: `bun run typecheck`, `lint` and `format:check` pass, and so do the starter `suites.test.ts` (18 pass) and the `docs-spec-structure`, `docs-links`, `docs-wording`, `migration-guide` and `api-stability` tests (31 pass). Spec §5's edited paragraph is 153 words, within the 160-word limit. The full suite was not rerun: the change is Markdown plus one test.
    - Not committed, at the owner's request (plans 033–038 stay uncommitted together).

- [x] Task 7: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: `plans/evidence/038-impact-analysis.md` records each of the twelve impact areas, or `None — <reason>`. Findings go to the owner in one table with a recommended disposition; `execute` findings become tasks above this one, `backlog` findings go to `plans/backlog.md` and Further Actions.
    - Performance: the sweep lists the browser harness rows before and after for `/react`, and the first numbers for `/dom` if it shipped.
    - Code Quality: the sweep confirms the host-API rule reads the same in the spec, `AGENTS.md`, the roadmap, the skill reference and the portability test.
    - Security: the sweep states, per addition, the law it touches and the test that holds it.
  - Approach:
    - Skills to Use:
      - `create-plan` — "Final task: impact analysis".
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `references/liveframe.md` §5; Task 1's design and decision.
    - Options Considered:
      - none beyond the standard sweep.
    - Chosen Approach:
      - One sweep after Task 6, in all three engines.
    - API Notes and Examples:
      ```bash
      bun run check && LIVEFRAME_BROWSER=webkit bun run test && LIVEFRAME_BROWSER=firefox bun run test && bun run release:gate
      ```
    - Files to Create/Edit:
      - `plans/evidence/038-impact-analysis.md`; `plans/backlog.md`; `roadmap.md` §3; this plan's Compromises Made and Further Actions.
  - Test Cases to Write:
    - none new.
  - Notes (executed 2026-11-19):
    - Wrote `plans/evidence/038-impact-analysis.md`, which records all twelve areas.
    - Five findings went to the owner in one table. F1: "Document it (Recommended)". F2–F5: "Accept all (Recommended)".
      - F1–F3 executed as Task 6a:
        - F1: starter design systems written for 0.3.x fail on `size.row` and the `scroll` focus overlay.
        - F2: the migration guide covered only motion.
        - F3: the skill's styling reference lacked `motion`'s rules.
      - F4 backlogged at P3: no renderer conformance case covers motion.
      - F5 recorded: the plans are uncommitted together.
    - **Host-API rule:** it reads the same in spec §13, `roadmap.md` §1, the skill's `SKILL.md` and `references/architecture.md`, and `portability.test.ts`. `AGENTS.md` states it without a subpath list.
    - **Performance:**
      - All 13 bench scripts and the `streaming`, `motion` and `dom` production runs passed at load 3.5–6.1.
      - Task 4's missed focus-continuity gate passes on the rerun (0.1–0.2 ms against 0.5).
      - First and current `/dom` numbers: Chromium mount ×1.02, patch ×0.97 against `/react`.
      - The plan-037 rows that had failed pass at this load. That is recorded on the P1 backlog entry, which stays open.
    - **Verification:** `bun run check` (2,044 pass), WebKit (2,037 pass) and Firefox (2,043 pass) full suites, `demo:test` (78 pass), `guide:test` and `release:gate` all pass.
    - Not committed, at the owner's request.

## Verification (whole plan)

- `bun run check`
- `bun run bench`
- `bun --conditions liveframe:source bench/streaming.bench.ts --production`
- `LIVEFRAME_BROWSER=webkit bun run test` and `LIVEFRAME_BROWSER=firefox bun run test`
- `bun run demo:test` and `bun run guide:test`
- `bun run release:gate`

## Compromises Made

- **The starter catalog keeps `starter.ui@1` although its design systems must change** (Task 4, impact F1). Widgets and trees stay valid, but a design system written for 0.3.x must add `size.row` and a `scroll` focus recipe. This is documented in the migration guide and spec §5 and pinned by a test, rather than handled with a catalog major.
- **The motion cases are library tests, not conformance cases** (Task 6). Each adapter is proved in three engines, but an app's primitives are not checked for the root `domId` motion needs. Backlogged (F4).
- **Windowing assumes one fixed row size** (Task 4, design W). Variable row heights stay with the app. `itemSize` takes only a `size.*` name (law 3).
- **`/dom` has no SSR and no custom element** (decision 2026-11-19). A page that needs server rendering uses `/react`, and the guide shows a custom element written over `mount`.
- **No per-task commits and no per-plan bench base** (impact F5). Plans 033–038 share one uncommitted working tree at the owner's request.

## Further Actions

- **Add a motion case to the renderer conformance suites** (P3, `plans/backlog.md`). Motion finds elements by `domId`, and no suite an app runs catches a primitive that lacks it.
- **Phase 1 performance gate: 3 µs per node** (existing P1, `plans/backlog.md`). The rows plan 037 saw failing passed in this sweep at load 3.5–5.7. The entry stays open until a whole `bun run bench` passes on a quiet machine.
