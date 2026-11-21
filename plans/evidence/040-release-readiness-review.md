# Release readiness review for 0.4.0

The review uses candidate commit `f71f90d`, green CI run `44929075938` and protected publish run `44933932159`. The [acceptance ledger](040-acceptance.md) links the scope rows to specific tests and commands. The [registry record](040-release-candidate.md) covers the published candidate.

## Owner go

> Task 8 can be closed and I consider this enough for release

The owner gave the release go and approved the outstanding deferrals. [Decision log](../../decision-logs/2026-11-22-0347-go-on-0-4-0.md). The [stable registry verification](040-release.md) completed Task 8.

## Release scope

The [November 15 package review disposition](../../decision-logs/2026-11-15-1251-review-2026-11-15-scope.md) is implemented through plans 033–039. The [0.4.0 scope decision](../../decision-logs/2026-11-20-2319-release-0-4-0-scope.md) folds the unpublished 0.3.1 work into this release. Scope evidence follows the [interaction](../../decision-logs/2026-11-19-0154-interaction-additions-for-0-4-0.md), [rendering](../../decision-logs/2026-11-19-1143-rendering-additions-for-0-4-0.md) and [agent UI](../../decision-logs/2026-11-19-2034-agent-ui-additions-for-0-4-0.md) decisions. Performance exceptions are listed below.

| Row | Scope | Status and evidence |
| --- | --- | --- |
| D1 | A revision floor below `previous.revision` moves the revision backwards (`src/host/render.ts:241`) | Fixed in [plan 033](../033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md) (033 T2). See [acceptance results](040-acceptance.md). |
| D2 | A skipped render returns `previous` with its old `patch`; the guide's examples resend it (`docs/host.md:40`, `:157`) | Fixed in [plan 033](../033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md) (033 T3). See [acceptance results](040-acceptance.md). |
| D3 | An action's outcome is lost when the follow-up render fails (`src/host/intent.ts:132-137`) | Fixed in [plan 033](../033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md) (033 T4). See [acceptance results](040-acceptance.md). |
| D4 | A stale arrival sets an invalid surface valid again (`src/surface/core.ts:506`) | Fixed in [plan 033](../033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md) (033 T5). See [acceptance results](040-acceptance.md). |
| D5 | Surface-side validation limits cannot be raised; a wrapped validator makes `accept()` throw | Fixed in [plan 033](../033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md) (033 T6). See [acceptance results](040-acceptance.md). |
| D6 | `workerRunner()` counts worker boot against the render timeout (`src/preview/worker/index.ts:190`) | Fixed in [plan 033](../033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md) (033 T7). See [acceptance results](040-acceptance.md). |
| D7 | A synchronous throw from `onIntent` escapes `emit` on the path without confirmation (`src/surface/core.ts:264`) | Fixed in [plan 033](../033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md) (033 T8). See [acceptance results](040-acceptance.md). |
| G1 | Wall-clock assertions gate `bun run check` | Fixed in [plan 033](../033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md) (033 T9). See [acceptance results](040-acceptance.md). |
| G2 | `Store` has no compare-and-set, so `applyState` can lose a write across processes | Fixed in [plan 037](../037-Phase-7-Part-X-Interaction-Capabilities.md) (037 T6). See [acceptance results](040-acceptance.md). |
| G3 | Backlog items the review met: no `when`/`bind` in element JSON; no empty state for a filtered list; no conformance cases for local bindings | Fixed in [plan 039](../039-Phase-7-Part-Z-Agent-Generated-UI.md), [plan 037](../037-Phase-7-Part-X-Interaction-Capabilities.md) (039 T2; 037 T7; 037 T8). See [acceptance results](040-acceptance.md). |
| P1 | Package load and verification dominate a request-time render | Fixed in [plan 034](../034-Phase-7-Part-U-Request-Time-Performance.md) (034 T1–T3). See [acceptance results](040-acceptance.md). |
| P2 | `renderKey` costs more than the render it may skip on data-heavy widgets | Fixed in [plan 034](../034-Phase-7-Part-U-Request-Time-Performance.md) (034 T4). See [acceptance results](040-acceptance.md). |
| P3 | Composed components re-walk their props at every layer (`src/sdk/render.ts:845-851`) | Fixed in [plan 034](../034-Phase-7-Part-U-Request-Time-Performance.md) (034 T5). See [acceptance results](040-acceptance.md). |
| P4 | Focus continuity scans the whole document on every surface update (`src/react/renderer.tsx:131-169`) | Fixed in [plan 035](../035-Phase-7-Part-V-Browser-Renderer-Cost-And-Resilience.md) (035 T2). See [acceptance results](040-acceptance.md). |
| P5 | Every implementation renders twice at mount (`src/react/renderer.tsx:420`, `:459`) | Fixed in [plan 035](../035-Phase-7-Part-V-Browser-Renderer-Cost-And-Resilience.md) (035 T3). See [acceptance results](040-acceptance.md). |
| P6 | The QuickJS runner recompiles the validator on every render | Fixed in [plan 034](../034-Phase-7-Part-U-Request-Time-Performance.md) (034 T6). See [acceptance results](040-acceptance.md). |
| A1 | Validator facts live in six module-level `WeakMap`s | Fixed in [plan 033](../033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md), [plan 036](../036-Phase-7-Part-W-Internal-Structure-And-Parity.md) (033 T6 (fail closed); 036 T1 (one table)). See [acceptance results](040-acceptance.md). |
| A2 | Three implementations of the tree rules must agree | Fixed in [plan 036](../036-Phase-7-Part-W-Internal-Structure-And-Parity.md) (036 T2). See [acceptance results](040-acceptance.md). |
| A3 | `core.accept()` mutates the core during React render | Fixed in [plan 035](../035-Phase-7-Part-V-Browser-Renderer-Cost-And-Resilience.md) (035 T4). See [acceptance results](040-acceptance.md). |
| A4 | Any invalid arrival unmounts the whole surface | Fixed in [plan 035](../035-Phase-7-Part-V-Browser-Renderer-Cost-And-Resilience.md) (035 T5). See [acceptance results](040-acceptance.md). |
| A5 | `sdk/render.ts`, `template/expr.ts` and `createSurfaceCore` are hard to change safely | Fixed in [plan 036](../036-Phase-7-Part-W-Internal-Structure-And-Parity.md) (036 T3–T5). See [acceptance results](040-acceptance.md). |
| A6 | Source comments cite plan task ids | Fixed in [plan 036](../036-Phase-7-Part-W-Internal-Structure-And-Parity.md) (036 T6). See [acceptance results](040-acceptance.md). |
| F1 | Compound intents: a local write with a host intent | Fixed in [plan 037](../037-Phase-7-Part-X-Interaction-Capabilities.md) (037 T2). See [acceptance results](040-acceptance.md). |
| F2 | Intent values read from `local` | Fixed in [plan 037](../037-Phase-7-Part-X-Interaction-Capabilities.md) (037 T3). See [acceptance results](040-acceptance.md). |
| F3 | Bounded array carries | Fixed in [plan 037](../037-Phase-7-Part-X-Interaction-Capabilities.md) (037 T4). See [acceptance results](040-acceptance.md). |
| F4 | Focus and scroll directives as data | Fixed in [plan 037](../037-Phase-7-Part-X-Interaction-Capabilities.md) (037 T5). See [acceptance results](040-acceptance.md). |
| F5 | A `pending` source outcome | Fixed in [plan 038](../038-Phase-7-Part-Y-Rendering-Capabilities.md) (038 T2). See [acceptance results](040-acceptance.md). |
| F6 | Enter, exit and reorder motion | Fixed in [plan 038](../038-Phase-7-Part-Y-Rendering-Capabilities.md) (038 T3). See [acceptance results](040-acceptance.md). |
| F7 | A windowing recipe for long collections | Fixed in [plan 038](../038-Phase-7-Part-Y-Rendering-Capabilities.md) (038 T4). See [acceptance results](040-acceptance.md). |
| F8 | A DOM adapter on `/surface` (a v1 non-goal today) | Fixed in [plan 038](../038-Phase-7-Part-Y-Rendering-Capabilities.md) (038 T5–T6). See [acceptance results](040-acceptance.md). |
| F9 | `when`/`bind` in element JSON | Fixed in [plan 039](../039-Phase-7-Part-Z-Agent-Generated-UI.md) (039 T2). See [acceptance results](040-acceptance.md). |
| F10 | A catalog digest for agents | Fixed in [plan 039](../039-Phase-7-Part-Z-Agent-Generated-UI.md) (039 T3). See [acceptance results](040-acceptance.md). |
| F11 | An A2UI converter package (a v1 non-goal today) | Fixed in [plan 039](../039-Phase-7-Part-Z-Agent-Generated-UI.md) (039 T4). See [acceptance results](040-acceptance.md). |
| F12 | More starter primitives | Fixed in [plan 039](../039-Phase-7-Part-Z-Agent-Generated-UI.md) (039 T5–T6). See [acceptance results](040-acceptance.md). |
| Interaction | One host intent per event, revision-scoped local writes, `fromLocal`, bounded array carries, focus after the first draw, four CAS attempts and a read-only `shown` root | Fixed. See [interaction acceptance and law cases](037-impact-analysis.md) and the [agent run](040-agent-acceptance.md). |
| Rendering | Opt-in pending source outcomes, root rest-recipe motion, starter windowing and the DOM adapter with renderer conformance | Fixed. See [rendering acceptance and law cases](038-impact-analysis.md). |
| Agent UI | Caller-owned local state in element JSON, digest, A2UI v0.9.1 snapshot conversion and eight starter kinds | Fixed. See [agent UI acceptance and law cases](039-impact-analysis.md) and the [agent run](040-agent-acceptance.md). |

## Open P1 backlog and Task 1 dispositions

| Item | Status and evidence |
| --- | --- |
| Phase 1 performance gate, 3 µs per node | Deferred with owner approval. End-to-end render passed the observed timing limits, while the standalone validator failed on large/full queues and the reserved validation split exceeded 1.5 µs/node for agent-home and medium/full queues. The quiet-host proof remains open. [Backlog](../backlog.md#phase-1-performance-gate-3-µs-per-node), [Task 5 attempt](040-bench-attempt-best.md). |
| Initially-open demo dialogs | Deferred with owner approval at the existing P1. The candidate's installed demo suite passed all 78 tests, including the initially-open regression. The retained backlog report describes an inert dialog after an initially-open arrival. [Backlog](../backlog.md#fix-initially-open-dialogs-in-the-demo-host), [candidate checks](040-release-candidate.md). |
| Element JSON error kinds | Fixed in 040 Task 1a. Strict SDK and arrival parity covers missing or malformed `kind` and non-array `children`. [Acceptance](040-acceptance.md). |
| Report thrown or rejected `onIntent` via `SurfaceEvent` | Deferred to 0.5.0 with owner approval in the 0.4.0 scope decision. The original synchronous throw escaping `emit` was fixed in 033 T8. |
| Remove prior `patch`, `reset` and `migrated` from skipped `renderPlacement` results | Deferred to 0.5.0 with owner approval in the 0.4.0 scope decision. The 033 T3 guide guards the replay path. |

## Impact findings for plans 033–039

Each row links to its original disposition and evidence. The approved deferrals retain the existing backlog priorities.

| Finding | Finding reviewed | Status |
| --- | --- | --- |
| [033 F1](033-impact-analysis.md) | `renderPlacement` step R8 (`src/host/render.ts:122`) forwards `args.runOptions` (`{ timeoutMs?, limits? }`) to `runner.render`, but step R9 (`checkTree`, `src/host/render.ts:132-134, 260`) called `validator.validateTree(rendered.value)` with no options, rejecting trees above 5,000 nodes even when `runOptions.limits` raised the bound. | Fixed in 033 T10 follow-ups |
| [033 F2](033-impact-analysis.md) | `examples/demo-host/server.ts:339` returned on `!handled.ok` without storing `if (handled.actions) results.set(id, handled.actions);`, dropping action outcomes/refusals when the follow-up render fails (D3). | Fixed in 033 T10 follow-ups |
| [033 F3](033-impact-analysis.md) | `.agents/skills/liveframe-execution/references/preview.md:29,31` still said `workerRunner({ timeoutMs? })` and `"the deadline includes startup"` after Task 7 (D6); `plans/033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md:517` had `--conditions` before `test`. | Fixed in 033 T10 follow-ups |
| [033 F4](033-impact-analysis.md) | `<Preview>` in `src/preview/react/preview.tsx:12-30, 166-175` lacked an optional `limits` prop to forward to its `<Surface>` cells when a preview session raises validation bounds. | Fixed in 033 T10 follow-ups |
| [033 F5](033-impact-analysis.md) | When `renderPlacement` skips a render at step R6 (`result.value === previous`), the returned `previous` object still carries its prior render's `patch`, `reset` and `migrated` fields. Changing the skipped return shape breaks `result.value === previous` in `0.3.x`. | Deferred to 0.5.0 by the scope decision |
| [033 F6](033-impact-analysis.md) | Both confirmed and unconfirmed `onIntent` paths contain throws/rejections silently without emitting a `SurfaceEvent`, because `SurfaceEvent` only grows in a minor release (`docs/spec.md` §11). | Deferred to 0.5.0 by the scope decision |
| [034 F1](034-impact-analysis.md) | `docs/compatibility.md:147`, `docs/adopters-0.3.md:58`, and `docs/migration-0.3.md:159` still say `verifiedPackages()` freshly hashes stored content on every load (`0.3.0` wording) instead of `sameJson` equality on `0.3.1+` hits. | Fixed in 034 T6a |
| [034 F2](034-impact-analysis.md) | `docs/packages.md:450` still lists `4 ms` for a one-node widget under `quickjsRunner({ reuse: "package" })` (cut to `1.311 ms` in Task 6); `CHANGELOG.md` `## Unreleased` → `Performance:` omitted Tasks 4–6. | Fixed in 034 T6a |
| [034 F3](034-impact-analysis.md) | `.agents/skills/liveframe-execution/references/sdk.md:26` still described the pre-0.3.0 single-`WeakSet` input cache instead of `inputCopies` + `ownedCopies`; `plans/034:330` had `bun --conditions liveframe:source test`. | Fixed in 034 T6a |
| [034 F4](034-impact-analysis.md) | `packages/runner-quickjs/src/__tests__/engine.test.ts:87` (`quickjs_disposes_every_handle`) had no explicit timeout and exceeded Bun's 5,000 ms default under load ~16 (`7547 ms` in `check`, `6951 ms` standalone). | Fixed in 034 T6a |
| [034 F5](034-impact-analysis.md) | `bench/host.bench.ts:561-574` enforces `budget()` on 5 rows (`template load`, `homeLoadVerified`, `homeFileLoadVerified`, `homeVerifyVerified`, `homeEquality`), while the remaining Task 1 confirmed budgets are metrics only. | Deferred with owner approval, P3 |
| [034 F6](034-impact-analysis.md) | Under load ~16 during `bun run check`, three `cli-mcp.test.ts` tests tripped `workerRunner()`'s default `100 ms` render timeout on the first `agent-home` render inside a fresh worker (all passed standalone in `620–730 ms`). | Deferred with owner approval, P4 |
| [035 F1](035-impact-analysis.md) | `FocusContinuity.componentDidUpdate` took back focus the host placed *outside* the surface during the commit, against §11 "never taken back" | Fixed in 035 T6a |
| [035 F2](035-impact-analysis.md) | Spec §11 `<Surface>` bullet still says `useSyncExternalStore` subscription | Fixed in 035 T6a |
| [035 F3](035-impact-analysis.md) | No browser test of a non-hydrating client mount of an invalid tree (Law 2 proof for the deferred mount) | Fixed in 035 T6a |
| [035 F4](035-impact-analysis.md) | Wall-time rows (Task 3 mount, Task 4 patched updates) not re-measured on a quiet host; the focus `diffMs < 0.5` gate fails under load | Deferred with owner approval, P3 |
| [035 F5](035-impact-analysis.md) | No public `prepare`/`commit` on `SurfaceCore` for concurrent non-React adapters | Deferred with owner approval, P3 |
| [035 F6](035-impact-analysis.md) | Keep-last leaves `aria-busy="true"` indefinitely when a stream stops after a rejection; the guide gives the host no path | Deferred with owner approval, P4 |
| [035 F7](035-impact-analysis.md) | Release placement of Task 2's focus-scope change | Fixed, ships in the 0.4.0 fold |
| [035 F8](035-impact-analysis.md) | WebKit-only failure of `candidate_hidden_by_the_same_update_is_skipped` (structural-selector style lag) | Fixed in 035 verification |
| [036 F1](036-impact-analysis.md) | Element JSON with a missing or non-string `kind` is `invalid-prop`; `render()` and the walk say `unknown-component` | Fixed in 040 T1a |
| [036 F2](036-impact-analysis.md) | Element JSON with non-array `children` is `invalid-prop`; the walk says `invalid-children` | Fixed in 040 T1a |
| [036 F3](036-impact-analysis.md) | Too many children of a kind: the build passes point at the node, the walk at `children` | Deferred with owner approval, P3 |
| [036 F4](036-impact-analysis.md) | The byte-limit pointer names a different field in the walk and the build; spec §10 does not say so | Deferred with owner approval, P3 |
| [036 F5](036-impact-analysis.md) | `proof/tests/mcp-capture.test.ts` hits the 100 ms wall-clock render limit under load, inside `bun run check` | Deferred with owner approval, P3 |
| [036 F6](036-impact-analysis.md) | `bench/ab.ts` cannot decide 2% at current load; an in-process interleaved A/B can | Deferred with owner approval, P3 |
| [036 F7](036-impact-analysis.md) | The API-surface reader inlines a helper type only from a declaration file that declares a subpath export, so a file split can change a recorded entry | Deferred with owner approval, P4 |
| [036 F8](036-impact-analysis.md) | `source_comments_cite_no_plan_or_decision_ids` does not gate bare design ids such as `(B4)` | Deferred with owner approval, P4 |
| [036 F9](036-impact-analysis.md) | The unknown-validator message change (Task 1) had no `CHANGELOG.md` entry | Fixed in 036 impact follow-up |
| [036 F10](036-impact-analysis.md) | `references/formats.md` named `buildFacts` as the facts reader | Fixed in 036 impact follow-up |
| [036 F11](036-impact-analysis.md) | Tasks 1–6 are uncommitted: the working tree holds the uncommitted changes of plans 033–035 in the same files, so no commit can stage one task by path | Fixed by shared commit `36da514`. Isolated benchmark proof deferred with owner approval |
| [036 F12](036-impact-analysis.md) | `bun run bench` fails four scripts' wall-clock budgets at load 5–54 on a shared host; no quiet-host pass for the whole plan | Deferred with owner approval, quiet-host proof |
| [037 F1](037-impact-analysis.md) | Task 1 is open: no decision log records the owner's approval of the design and of the restated §8 Rule 1, already in `docs/spec.md:1159` | Fixed by interaction decision |
| [037 F2](037-impact-analysis.md) | MCP `set_state` cannot apply an offered `setState` that reads `fromLocal`: `value` is ignored and the intent is refused; `docs/mcp.md` says otherwise | Fixed in 037 T8a |
| [037 F3](037-impact-analysis.md) | Skill references `formats.md` and `renderer.md` describe the 0.3 intent and completion only | Fixed in 037 impact follow-up |
| [037 F4](037-impact-analysis.md) | The plan's Verification line `bun --conditions liveframe:source test <files>` runs the whole suite (Task 6 finding) | Fixed in 037 verification instructions |
| [037 F5](037-impact-analysis.md) | `validator` (1.502/1.507 vs 1.5), `template` `validateTemplate` (4.3–5.7 vs 5 ms) and `runner` recovery (304 vs 300 ms) fail at load 4–9; no quiet-host whole-bench pass | Deferred with owner approval, quiet-host proof |
| [037 F6](037-impact-analysis.md) | Tasks 2–8 (and plans 033–036) are uncommitted in one working tree, so no task can be committed alone by path and no per-plan bench base exists | Fixed by shared commit `36da514`. Isolated benchmark proof deferred with owner approval |
| [037 F7](037-impact-analysis.md) | `validateCatalog` does not reserve `when`, `bind`, `focus` as prop names; element JSON reads a `focus`/`when` inside `props` as the field | Deferred with owner approval, P3 |
| [037 F8](037-impact-analysis.md) | Generated author types do not narrow `bind` to array (or object) arguments | Deferred with owner approval, P4 |
| [037 F9](037-impact-analysis.md) | No example in the repository shows the six additions end to end | Deferred with owner approval, P4 |
| [037 F10](037-impact-analysis.md) | `bun run demo:test` fails: the demo host's `rendererBrowserSuite` run (`examples/demo-host/tests/conformance-browser.test.ts`) lacks the four new `BrowserFixtures` fields, so the five new cases fail with "Missing local fixture" (71 pass, 5 fail). Task 8 updated the starter and the proof host but not the demo host. Any adopter's CI hits the same failure on upgrade, as `docs/migration-0.4.md` says | Fixed in 037 T8b |
| [038 F1](038-impact-analysis.md) | The starter catalog keeps `starter.ui@1` but gains `size.row` and an event on `scroll`, so a design system written for the 0.3.x starter catalog fails `validateDesignSystem` (`unknown-name` at `/values/size.row`, `incomplete-design-system` at `/recipes/scroll.default.root.focus`; confirmed against the HEAD starter design system). Spec §5 does not say that catalog additions can invalidate design systems | Fixed in 038 T6a |
| [038 F2](038-impact-analysis.md) | `docs/migration-0.4.md` covered only motion, with no `pending`, windowing or `/dom` sections | Fixed in 038 T6a |
| [038 F3](038-impact-analysis.md) | The styling skill reference did not state `motion`'s rules (root rest only, duration required, `domId` on the root element) | Fixed in 038 T6a |
| [038 F4](038-impact-analysis.md) | No renderer conformance case covers motion. An app primitive without a root `domId` never animates, unnoticed | Deferred with owner approval, P3 |
| [038 F5](038-impact-analysis.md) | Plans 033–038 are uncommitted in one working tree, so no task commits alone by path and no per-plan bench base exists | Fixed by shared commit `36da514`. Isolated benchmark proof deferred with owner approval |
| [039 F1](039-impact-analysis.md) | `docs/security.md` had no section for the agent additions, and did not say that the A2UI mapping decides which actions an agent may offer | Fixed in 039 impact follow-up |
| [039 F2](039-impact-analysis.md) | No guide in `docs/` or the root README linked to `packages/a2ui/README.md`, the only explanation of the converter | Fixed in 039 impact follow-up |
| [039 F3](039-impact-analysis.md) | The starter digest with the demo capabilities and `local` is 23,269 characters, 97% of its 24,000 budget, and `gen:check` gates only the starter's own digest (20,210). One more kind or a few more actions passes the budget unnoticed until a host builds it | Deferred with owner approval, P3 |
| [039 F4](039-impact-analysis.md) | `validator` bench fails at load 4.7–9.3 (1.50–1.60 µs/node), and Task 2's "within 2%" A/B for `renderElements` was not decided (the control was unusable). No base isolates plan 039 | Deferred with owner approval, quiet-host and A/B proof |
| [039 F5](039-impact-analysis.md) | The starter's `radio` uses React Aria's `Radio`, which 1.22.1 marks deprecated in favour of `RadioField` and `RadioButton`; the `^1.22.0` floor may not have the replacement | Deferred with owner approval, P3 |
| [039 F6](039-impact-analysis.md) | `dateField` raises `""`, not `null`, when cleared, because scalar `carries` take no bound and no null. A nullable scalar or an object carry would fix it, and is a format change | Deferred with owner approval, P4 |
| [039 F7](039-impact-analysis.md) | `$contains` is case-sensitive; agents ask for case-insensitive filters in both acceptance runs and the operator list has no folding form | Deferred with owner approval, P3 |
| [039 F8](039-impact-analysis.md) | Task 1's handoff list is open: incremental A2UI conversion, A2UI v1.0, a `meter` kind, an interactive table, and parent rules for definitions | Deferred with owner approval, P3/P4 |
| [039 F9](039-impact-analysis.md) | Plans 033–039 are uncommitted in one working tree, so no task commits alone by path and no per-plan bench base exists (as plan 038 F5) | Fixed by shared commit `36da514`. Isolated benchmark proof deferred with owner approval |

## Task 5 budget evidence

The 2026-11-22 [Task 8 rerun](040-bench-task-8-rerun.md) qualified to start and ran all 15 stages. All stage commands exited 0, but every stage crossed 10% host CPU and the suite peaked at 29.3%, so the harness exited 3. Standalone validation measured 1.441 and 1.415 µs/node for the large and full queues, respectively, within the 1.5 µs/node limit. The separate render validation diagnostic still exceeded its 1.5 µs/node reservation for agent-home and medium through full queues. The 28 benchmark acceptance rows remain pending.

The [Task 5 decision](../../decision-logs/2026-11-21-2218-close-plan-040-task-5-on-partial-benchmark-evidence.md) closed the task on partial evidence and carried the full proof to this review. Deferring the full quiet-host proof keeps the existing thresholds, both performance backlog entries and plan 025 Task 8 open. The first two attempts found no qualifying start. Attempt 3 ran every stage, peaked at 53.6% host CPU and left all 28 benchmark acceptance rows pending. The table reproduces the stage results from the [full attempt record](040-bench-attempt-best.md), which also records per-metric budgets and output. The validator exited 1. The selection stage recorded no output.

| Stage | Result | Seconds | Host CPU avg % | Host CPU peak % | Other processes (cores) | Peak load |
|---|---|---:|---:|---:|---:|---:|
| `bench/validator.bench.ts` | not quiet (exit 1) | 16 | 13.1 | 17.9 | 0.97 | 8.02 |
| `bench/render.bench.ts` | not quiet | 15 | 10.6 | 11.2 | 0.56 | 7.19 |
| `bench/css.bench.ts` | not quiet | 52 | 26.2 | 53.6 | 3.28 | 9.24 |
| `bench/streaming.bench.ts` | not quiet | 20 | 7.2 | 13.0 | 0.95 | 8.34 |
| `bench/motion.bench.ts` | not quiet | 28 | 14.3 | 23.5 | 2.03 | 6.62 |
| `bench/dom.bench.ts` | not quiet | 39 | 16.8 | 25.1 | 2.41 | 5.76 |
| `bench/template.bench.ts` | not quiet | 3 | 12.9 | 14.2 | 0.72 | 4.86 |
| `bench/stream-elements.bench.ts` | not quiet | 8 | 24.7 | 24.7 | 2.78 | 4.63 |
| `bench/host.bench.ts` | not quiet | 7 | 20.3 | 34.2 | 1.88 | 5.23 |
| `bench/pack-libraries.bench.ts` | not quiet | 10 | 13.8 | 17.3 | 0.78 | 5.05 |
| `bench/hash.bench.ts` | not quiet | 3 | 12.4 | 12.4 | 0.52 | 0.00 |
| `bench/selection.bench.ts` | not quiet | 7 | 9.5 | 13.2 | 1.15 | 4.99 |
| `bench/runner.bench.ts` | not quiet | 12 | 12.9 | 12.9 | 0.59 | 4.67 |
| `bench/a2ui.bench.ts` | not quiet | 0 | 11.5 | 11.5 | 0.35 | 0.00 |
| `bench/starter-content.bench.ts` | not quiet | 0 | 14.8 | 14.8 | 0.40 | 0.00 |

## Task 7 candidate registry verification

| Check | Status |
| --- | --- |
| Protected candidate publish and dist-tags | Fixed. All four exact candidate versions were published with `next=0.4.0-rc.1`. A2UI also used the candidate for its first `latest`. |
| Archive gates and installed API | Fixed. Four archive gates passed and all installed API comparisons returned zero differences. |
| Consumer checks | Fixed. The registry getting-started guide passed and the registry demo passed 78 tests. |
| Signatures and provenance | Fixed. All four exact versions had valid attestations with the expected repository, workflow and candidate ref. |

The [candidate registry record](040-release-candidate.md) contains the exact commands and results. Repeat these checks on the stable version after publishing.

## Four laws

| Law | Status and evidence |
| --- | --- |
| 1. Widget code never runs in the browser | Fixed. The archive browser probe excludes draft code. The DOM adapter draws validated contexts without evaluating strings and element expressions use the bounded evaluator. [Rendering](038-impact-analysis.md), [agent UI](039-impact-analysis.md), [candidate archives](040-release-candidate.md). |
| 2. The UI tree is validated data | Fixed. Unknown validators fail closed. Invalid arrivals use the renderer fallback, parity covers the Task 1a shape errors and the converter emits element JSON that passes through SDK validation before drawing. [Validator and parity](036-impact-analysis.md), [rendering](038-impact-analysis.md), [agent acceptance](040-agent-acceptance.md). Known pointer differences are included in the approved deferrals. |
| 3. Widgets never set colours or raw CSS | Fixed. Focus only resolves within the surface, motion uses closed recipe values and measured offsets, and starter chart paint follows recipe classes. [Interaction](037-impact-analysis.md), [rendering](038-impact-analysis.md), [agent UI](039-impact-analysis.md). |
| 4. Widgets never hold authority | Fixed. Completion strips local writes, the host rechecks filled values, pending sources carry status only and exiting nodes are inert. A2UI offers only mapped actions and host schema/authorization checks still apply. The recorded MCP session dispatched zero actions. [Interaction](037-impact-analysis.md), [rendering](038-impact-analysis.md), [agent acceptance](040-agent-acceptance.md). |

## Agent acceptance documentation follow-up

Fixed in the [demo agent guide](../../docs/demo-agent.md). The [Task 6 transcript](040-agent-acceptance.md) showed that the surface GET streams NDJSON and frame `actions` is a dispatch log. All four end-to-end paths passed.
