# Plan 038 — Architectural Impact Analysis (Rendering Capabilities)

Date: 2026-11-19
Plan: [`plans/038-Phase-7-Part-Y-Rendering-Capabilities.md`](../038-Phase-7-Part-Y-Rendering-Capabilities.md)
Design: [`plans/evidence/038-rendering-design.md`](038-rendering-design.md); decision: [`decision-logs/2026-11-19-1143-rendering-additions-for-0-4-0.md`](../../decision-logs/2026-11-19-1143-rendering-additions-for-0-4-0.md)

This sweep covers the twelve impact areas in `.claude/skills/create-plan/references/liveframe.md` §5 across Tasks 2–6. Those tasks deliver four additions: a `pending` source outcome (F5), design-system motion (F6), starter windowing (F7), and the `/dom` adapter with `/conformance/dom` (F8). Findings F1–F3 were executed as Task 6a, F4 is backlogged and F5 is recorded (§2).

---

## 1. The Twelve Impact Areas

### 1. Spec (`docs/spec.md`)

- Every row of the design's "Spec text" sections is in the spec:
  - §6.2 (`motion` in the recipe-property list) and §6.4 (projection, the `data-lf-motion` gate, reduced motion);
  - §7.1 (the `sourceOutcome` option, the windowing bullet pointing to `docs/sdk.md`), §7.3 (`pending` scenarios), §7.7 rule 4 and Events (`source-pending`);
  - §11 (motion in the switching sequence, "The DOM adapter" subsection);
  - §13 (the `/dom` and `/conformance/dom` rows, browser subpaths, the host-API rule, shared cases);
  - §14 (the non-goal now reads "other than React and the plain DOM adapter", `docs/spec.md:1851`).
- `docs-spec-structure.test.ts` passes.
- Gap (F1, executed): §5's versioning rule (`docs/spec.md:237`) keeps the catalog id when an event or a vocabulary name is added, and says nothing about design systems. Task 4's starter change is exactly such an addition, and it invalidates every design system written for the 0.3.x starter catalog. §5 now says that the id protects widgets and trees, not design systems, and lists what each kind of addition requires a design system to add.

### 2. Public API and formats

- `scripts/release/api/register-0.4.0.json` has 52 entries, 27 of them tagged `038 T2`–`T6`:
  - T2: `sourceOutcome`, `SourceResult`, and `HostEvent` (now tagged `037 T6, 038 T2`);
  - T3: `design-system.json`, `Recipe`, `ResolvedRecipe`, `recipeProperties`;
  - T5: eleven `./dom` entries, plus `./react` `implement` widened with no type change;
  - T6: six `./conformance/dom` entries, plus `./conformance/react` `PageOptions` and `rendererSuite` widened with no type change.
- `register-0.4.0-starter.json` gains `./definitions Scroll`, and `./ui Scroll` now also names the windowing props. `api-stability.test.ts` passes against both registers.
- Two subpaths are added: `./dom` and `./conformance/dom`. Both are in `package.json` `exports`, `exports.test.ts`, the archive gate, and `bun run release:gate`, which passes.
- Every format addition is optional. A 0.3.x validator rejects `motion` (`invalid-document`) and the new `scroll` props fail-closed. A 0.3.x `renderPlacement` treats `reason: "pending"` as `failed`. `sourceOutcome(result)` without the option is byte-identical to 0.3.0, and the design-system projection hashes of the proof systems are unchanged.
- **Catalog compatibility (F1):** the starter catalog keeps `starter.ui@1`. It gains `size.row` and an event on `scroll`, so a design system written for 0.3.x fails `validateDesignSystem`. This was confirmed by validating `git show HEAD:packages/starter/src/design-system.ts` against the new catalog. It gives `unknown-name` at `/values/size.row` and `incomplete-design-system` at `/recipes/scroll.default.root.focus`. The owner chose to keep the id and document the change.
- **Register vs. changelog and migration (F2, executed):** every entry has a `CHANGELOG.md` "Unreleased" line. Before this sweep, `docs/migration-0.4.md` covered only motion. It now has an "Action needed" section for starter design systems (F1), and sections for `pending`, starter windowing, and `/dom` with `/conformance/dom`.

### 3. The four laws

| Addition | Law | What fails closed | Test that holds it |
|---|---|---|---|
| F5 `pending` | 4 | The widget is told a status only. A `message` is dropped. A pending answer with a `value` is `failed`. An undeclared variant fails the render at `/data/<alias>` | `pending_answer_with_a_value_is_treated_as_failed`, `pending_answer_fails_the_render_when_not_declared` (`host-render.test.ts`) |
| F6 `motion` | 3 | The tree carries nothing new. `motion` is a closed enum, valid only on a root rest recipe with a duration. The adapter writes no author string to CSS: it plays Web Animations from measured boxes and the recipe's computed transition | `motion_value_outside_the_list_is_invalid_document`, `motion_outside_root_rest_is_invalid_document`, `motion_without_duration_is_invalid_document`, `design_system_suite_checks_motion_values` |
| F6 exit | 4 | A kept exiting element is `inert` and `aria-hidden`, so it raises no intent | `exiting_row_is_inert_and_hidden` (React and `/dom`, three engines) |
| F7 windowing | 2, 4 | Every window is a whole validated tree within the node limit. The range is `setState` checked against the manifest's schema. `itemSize` is an enum of `size.*` names, never a length | `windowed_list_never_exceeds_the_row_budget` (251 trees validated) |
| F8 `/dom` | 1, 2 | Implementations are compiled app code: the adapter sets no `innerHTML` and evaluates no string. It draws only core contexts, which exist only for validated trees, and an invalid arrival draws only the fallback | `dom_adapter_sets_no_inner_html_and_evaluates_nothing`, `dom_invalid_arrival_draws_only_the_fallback` |
| F8 conformance | 4 | Law 4's case runs against `/dom` too | `dom_law_4_a_renderer_that_forwards_set_local_fails_only_its_rule` |

### 4. Validation

- `motion` is checked at two points, each `invalid-document` at `/recipes/<key>/motion`:
  - off a root rest recipe, by `placement()` in `src/formats/design-system.ts`;
  - without a `transitionDuration`, by `fillSlot` in `src/resolve.ts`.
- `sourceResult()` accepts a pending answer only without a `value`. The starter's `scroll` props are bounded integers and a closed enum, and `onRange` carries an object with two integers.
- `/dom` validates every arrival through `createSurfaceCore`, the same path as `/react`. `checkRegistries` is one shared function, so its `catalog-mismatch` errors are equal (`dom_registry_check_matches_reacts`).

### 5. Styling

- Theme authority is unchanged: `motion` sets no colour. Recipe completeness is still enforced by `cascadeRecipes`, and motion goes through the same resolver, cascade and projection as every other recipe property.
- A design system without `motion` projects byte-identical CSS (`system_without_motion_projects_identical_css`).
- Reduced motion and the switching sequence remove every added motion (`reduced_motion_removes_every_added_motion`, `switching_theme_plays_no_motion`).
- F1 is also a styling impact: the starter vocabulary gains `size.row`, and `scroll` now needs a focus overlay (§2).
- Gap (F3, executed): the styling skill reference listed motion among the recipe's concerns but not its rules. It now states the placement rule, the duration requirement and the `domId` requirement.

### 6. Interaction tiers

- **Local:** unchanged.
- **`setState`:** windowing keeps its range in widget state (`onRange` → `state.set("range")`), and the source binds to it. Nothing new enters the tier.
- **Action:** unchanged.
- An exiting element is inert, so a row that is leaving raises no intent of any tier. A pending source re-renders through the host's own transport (`dependents`). No timer, queue or subscription enters the library.

### 7. Performance

Per-task measures, from the task notes ("before") and this sweep ("after", 2026-11-19, Bun 1.4.4, 16 cores, each bench run alone at load 3.5–6.1). Task 4 recorded its numbers under load 17.8.

| Row | Budget | Before (task) | After (sweep) | Verdict |
|---|---:|---:|---:|---|
| host `pipelineMs` / `intentPipelineMs` | 0.2 ms | 0.10 (T2) | 0.075 | pass |
| host `httpSetStateCpuMs` | 50 ms | 0.61 (037) | 0.53 | pass |
| motion, Chromium production, commit added (20 removed, 50 moved) | 2 ms | +0.4 (T3) | +0.2 | pass |
| motion, next frame added (Chromium / WebKit / Firefox) | recorded | 3.3 / 5 / 4 (T3) | 2.7 / 4.0 / 3.0 | recorded |
| windowed list patch ops / bytes share | 42 / 25% | 41 / 13.3% (T4) | 41 / 13.3% | pass |
| windowed list commit, production, median / p95 | p95 < 16.7 ms | 3.8 / 5.4 (T4, load 17) | 1.0 / 1.3 | pass |
| focus continuity on − off, 0 / 1,000 / 5,000 host elements | < 0.5 ms | 0.6–1.4, **missed** (T4, load 17.8) | 0.2 / 0.2 / 0.1 | pass: Task 4's rerun request is met |
| `/react` `createRoot` mount, renders / wall | ≤ node count | 679 (035) | 679 / 10.0 ms | pass |
| `/react` streaming arrival validation median / p95 | existing | — | 1.4 / 1.9 ms | pass |
| `/dom` ÷ `/react`, Chromium production, mount / patch | gated ratio | ×0.93 / ×0.87 (T6) | ×1.02 (0.95–1.08) / ×0.97 (0.88–1.00) | pass |
| `/dom` ÷ `/react`, WebKit, mount / patch | recorded | ×0.99 / ×0.94 (T6) | ×1.06 / ×1.01 | recorded |
| `/dom` ÷ `/react`, Firefox, mount / patch | recorded | ×0.86 / ×0.90 (T6) | ×0.80 / ×0.96 | recorded |
| `/dom` agent-home, Chromium production, mount / patch | first numbers | 7.5 / 1.52 ms (T5) | 10.0 / 1.72 ms | recorded |
| validator `core-queue.large` / `full` compiled | 1.5 µs/node | 1.502 / 1.507 (037, failed) | 1.485 / 1.492 | pass |
| template `validateTemplate` agent-home CPU | 5 ms | 4.3–5.7 (037) | 4.725 | pass |
| runner QuickJS recovery | 300 ms | 304.4 (037, failed) | 245.1 | pass |

All thirteen `bun run bench` scripts and the three `--production` runs (`streaming`, `motion`, `dom`) exited 0. The three wall-clock rows that 037 F5 backlogged pass at this load. Plan 038 changed none of those paths, so this reflects the quieter host, and the 037 backlog entry stands.

A host that uses none of the additions pays nothing measurable:

- `sourceOutcome` without the option is the 0.3.0 schema.
- No motion means one cached computed-style read per surface per design-system identity.
- A `scroll` without `itemSize` adds no listener work.
- `/dom` is a separate import.

A strict per-plan A/B is not possible, because plans 033–038 share one uncommitted working tree (F5).

### 8. Portability

- The host-API rule reads the same in all five places. Each lists `/react`, `/dom`, `/store/fs`, `/preview/worker`, `/preview/react`, `/conformance/react`, `/conformance/dom` and the CLI:
  - spec §13 (`docs/spec.md:1815`);
  - `roadmap.md` §1 (`roadmap.md:28`);
  - the skill's `SKILL.md:27`, whose subpath table in `references/architecture.md:35,38` gives "DOM; no framework";
  - `src/__tests__/portability.test.ts:30,31,53`, where `dom`, `conformance/dom` and the internal `conformance/renderer` are DOM hosts, and the `frameworkFree` set (`:57`) forbids any framework import there.
- `AGENTS.md` states the rule without a subpath list ("a host-API-free core"), so it cannot drift.
- `src/dom/` is also imported by `/react`. It imports no framework, and `/surface` stays host-API free.
- Browsers: the full suite passes in Chromium, WebKit and Firefox (§3). WebKit has no `moveBefore`. Task 6 found that `place()`'s `insertBefore` blurred a moved text field there, and fixed it in the shared `restoreFocus`.

### 9. Agent authoring

- `liveframe gen` needed no change: `pending` appears in widget data types only for sources that declare it, and an unnarrowed `value` read fails to compile (`unnarrowed_value_read_fails_to_compile`).
- The starter's `ui.gen.ts` and `ui.definitions.gen.ts` are regenerated for the `scroll` props, and `gen:check` passes.
- `renderScenarios({ outcomes: true })` and the MCP tool description name the sixth `pending` outcome (`docs/mcp.md:47,333`).
- Errors an agent can act on: `invalid-document` with a pointer for each `motion` misuse, and `render-failed` at `/data/<alias>` for an undeclared pending answer.
- Gap (F3, executed): the styling skill reference, as in area 5.

### 10. Docs and examples

- Outsider docs are current:
  - `docs/host.md` "Answer a slow source with `pending`" and `docs/sdk.md` "Sources that may be pending" and "Lists longer than the node limit";
  - `docs/styling.md` "Motion: enter, exit and reorder" and `docs/renderer.md` "Enter, exit and reorder motion" and "Render without a framework" (executed by `dom_guide_examples_run`);
  - `docs/conformance.md` "Prove a `/dom` registry", plus `docs/model.md`, `docs/formats.md`, `docs/mcp.md`, `README.md`, `packages/starter/README.md` and `CHANGELOG.md`.
- The demo host shows `pending` end to end (a slow `tasks.digest` source and NDJSON frames). `bun run demo:test` passes (78 tests).
- No example uses motion, windowing or `/dom` outside the test fixtures and the starter. Those are library and starter features, proved by the browser tests and the executed guides, so this is not recorded as a finding.
- Gap (F2, executed): `docs/migration-0.4.md` lacked the `pending`, windowing and `/dom` sections, and the starter design-system action (F1).

### 11. Conformance

- `/conformance/dom` runs `registry_check_passes`, the five structural cases on the page and the fifteen browser cases, under the React names. Shared cases live once in `src/conformance/renderer/`.
- `react_suite_is_unchanged_by_the_shared_cases` pins the React case list.
- 17 broken subjects plus the registry case each fail their named rule.
- `designSystemSuite()` checks `motion` values, and the corpus gains four `motion*.json` design-system cases and the two outcome capability cases.
- Gap (F4, backlog P3): neither renderer suite has a motion case. The eight motion tests are library tests over the library's own fixtures (Task 6 note). Design D.6 planned motion cases for `/conformance/dom`. An app primitive without `domId` on its root slot silently never animates, and no suite an app runs catches it.

### 12. Reference hosts

- **Synapta and Clay:**
  - F5 removes the need to block a whole placement on its slowest source. A host can answer `pending` and push the second frame through its own transport.
  - F6 needs no host code. A host's own design system opts in per kind.
  - A host that wrote its own design system for `starter.ui@1` must add `size.row` and a `scroll` focus recipe on upgrade (F1, documented).
  - `/dom` is not needed by either host, since both draw with React.
- No migration bent the design.

---

## 2. Findings and Disposition

Presented to the owner on 2026-11-19. F1: "Document it (Recommended)". F2–F5: "Accept all (Recommended)".

| # | Finding | Area | Recommended | Owner's disposition |
|---|---|---|---|---|
| F1 | The starter catalog keeps `starter.ui@1` but gains `size.row` and an event on `scroll`, so a design system written for the 0.3.x starter catalog fails `validateDesignSystem` (`unknown-name` at `/values/size.row`, `incomplete-design-system` at `/recipes/scroll.default.root.focus`; confirmed against the HEAD starter design system). Spec §5 does not say that catalog additions can invalidate design systems | 1, 2, 5, 12 | **execute**: document it in `docs/migration-0.4.md`, the starter README, `CHANGELOG.md` and spec §5, and pin it with a test | **execute**, done in Task 6a |
| F2 | `docs/migration-0.4.md` covered only motion, with no `pending`, windowing or `/dom` sections | 2, 10 | **execute** | **execute**, done in Task 6a |
| F3 | The styling skill reference did not state `motion`'s rules (root rest only, duration required, `domId` on the root element) | 5, 9 | **execute**: one sentence | **execute**, done in Task 6a |
| F4 | No renderer conformance case covers motion. An app primitive without a root `domId` never animates, unnoticed | 11 | **backlog** P3 | **backlog** P3: "Add a motion case to the renderer conformance suites" |
| F5 | Plans 033–038 are uncommitted in one working tree, so no task commits alone by path and no per-plan bench base exists | 7 | recorded; the owner chooses the commit strategy | recorded; stays uncommitted at the owner's request |

---

## 3. Verification

All runs on 2026-11-19, Bun 1.4.4, 16 cores.

| Command | Result |
|---|---|
| `bun run check` (before Task 6a) | Pass: 2,044 pass, 9 skip, 0 fail (179 files, 722 s). The "Controlled page render failure" line is an expected-failure fixture's log. |
| `LIVEFRAME_BROWSER=webkit bun run test` | 2,037 pass, 16 skip, 0 fail (786 s). |
| `LIVEFRAME_BROWSER=firefox bun run test` | 2,043 pass, 10 skip, 0 fail (898 s). |
| each `bun run bench` script, run alone | All 13 exit 0 at load 3.5–5.7 (rows in §1 area 7). |
| `bun --conditions liveframe:source bench/streaming.bench.ts --production` (also `motion`, `dom`) | All three exit 0 at load 5.7–6.1. |
| `bun run demo:test` | 78 pass, 0 fail. |
| `bun run guide:test` | Pass (3.8 s). |
| `bun run release:gate` | Pass: archive rules and installed smoke test. |
| After Task 6a: `bun run typecheck`, `lint`, `format:check`; `suites.test.ts` (starter), `docs-spec-structure`, `docs-links`, `docs-wording`, `migration-guide`, `api-stability` | Pass (starter suites 18 pass, docs and API 31 pass). Task 6a changes only Markdown and adds one test, so the full suite was not rerun. |
