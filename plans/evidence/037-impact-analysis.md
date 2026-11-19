# Plan 037 — Architectural Impact Analysis (Interaction Capabilities)

Date: 2026-11-19
Plan: [`plans/037-Phase-7-Part-X-Interaction-Capabilities.md`](../037-Phase-7-Part-X-Interaction-Capabilities.md)
Design: [`plans/evidence/037-interaction-design.md`](037-interaction-design.md)

This sweep covers the twelve impact areas in `.claude/skills/create-plan/references/liveframe.md` §5 across Tasks 2–8, which deliver six additions: local writes on a host intent (F1), intent values read from local state (F2), array event carries (F3), a tree focus mark (F4), `Store.putStateIf` (G2), and the `shown` expression root (empty state). It also covers the conformance cases (Task 8). Task 1's design file and register existed, but its approval had not been logged. That was F1, executed in this task.

---

## 1. The Twelve Impact Areas

### 1. Spec (`docs/spec.md`)

- Every row of the design's §7 table ("Spec sections to update") is in the spec: §5 (array carries), §7.2/§7.6 (`local.set(…, { until })`, `fromLocal`, `focus`, `shown()`), §7.4 (`putStateIf`), §7.7 (`applyState` with four attempts, `conflict`), §8 (restated Rule 1, compound local writes, `fromLocal`, array fit, `shown`), §9/§9.1 (`focus` on tree and patch), §10 (one bullet per addition, matched in `validator-rules.test.ts`), §11 (`SurfaceSnapshot.focus`, `focus-missed`, the first-tree rule, `shown` evaluation), §13 (the new conformance cases).
- `docs-spec-structure.test.ts` passes. Task 4 split one §8 paragraph that exceeded the 160-word limit.
- §8 Rule 1 now reads "One host intent per event" (`docs/spec.md:1159`). The plan asks for that text to be approved by the owner and recorded in a decision log, and no log existed (F1). It is now recorded in `decision-logs/2026-11-19-0154-interaction-additions-for-0-4-0.md`.
- Two deviations from the plan's criteria follow the design and are in the spec: `shown` readers are never counted (Task 7, design E.2), and the server conformance suite has only the failed-binding case (Task 8).

### 2. Public API and formats

- `scripts/release/api/register-0.4.0.json` has 26 entries, all tagged `037 T2`–`T8`: three `./schemas/*` widenings (`ui-tree.json`, `tree-patch.json`, `template.json`) plus `catalog.json`; `LocalWrite` and `shown` added; `Intent`, `UiTree`, `TreePatch`, `Definition`, `./sdk` `action`/`state`/`local`/`Elements`, `./sdk/gen` `generate`, `./store` `Store`, `./host` `HostEvent`, `./surface` `SurfaceEvent`/`SurfaceSnapshot`, `./react` `ImplementationProps`, `./template` `TemplateIntent`/`TemplateLocalWrite`/`TemplateNode` and `./conformance/react` `BrowserFixtures` widened. `register-0.4.0-starter.json` has 25 `./ui` widenings, one per generated starter primitive, for `focus?: boolean`. `api-stability.test.ts` passes against both.
- Every addition is an optional field or an optional method. A 0.3.x validator rejects each new wire field fail-closed (`/local`, `/fromLocal`, `/focus`, an array `carries`, `{ "$path": "shown" }`), as `docs/compatibility.md:29` sets for minors. No version was bumped.
- **Register vs. changelog and migration.** Every entry has a line in `CHANGELOG.md` "Unreleased", either by name or through its feature line. The `./template` entries are covered by the F1/F2/F4 lines ("in TSX, element JSON or a template"), and the starter's 25 entries by the F4 line ("`liveframe gen` … gives generated primitives `focus?: boolean`"). `docs/migration-0.4.md` has a section per addition plus the conformance section, which says what CI must add.
- **0.3.x corpus expectations unchanged.** `git status conformance/` lists no modified file, only 61 new ones (`array-*`, `compound-local-*`, `from-local-*`, `focus-*`, `shown-*`, their `docs/` twins, and `conformance/patch/focus.json`). Task 5 added a new patch vector file so existing patch hashes stay unchanged.

### 3. The four laws

| Addition | Law | What fails closed | Rejection test |
|---|---|---|---|
| F1 `local` on a host intent | 4 | `complete()` strips `local`; the host rejects a posted one | `host_rejects_a_posted_local_field` (`offered.test.ts`), `completed_intent_carries_no_local_field`, `unconfirmed_intent_writes_nothing` (`surface-core.test.ts`); conformance `local_writes_apply_with_one_complete_host_intent` with the `post-local` mutant |
| F2 `fromLocal` | 4 | The host rebuilds the candidate from the posted values and re-checks them against the capability or state schema; a posted `fromLocal` is `invalid-prop` | `host_checks_filled_values_against_the_capability_schema`, `host_rejects_a_changed_literal_beside_from_local` (`host-intent.test.ts`, `offered.test.ts`); conformance `from_local_intent_arrives_complete` with the `unfilled` mutant |
| F3 array carries | 2, 4 | Items are scalar and bounded, at most 256; `emit` checks the compiled carry; the host re-checks the carry and the target schema | `array_carry_definition_is_validated`, `emit_rejects_an_array_outside_its_carry`, `…_with_unfitting_items_is_invalid_prop` (`array-events.test.tsx`) |
| F4 focus mark | 3, 4 | The id resolves only inside the surface's wrapper and portal; the mark moves no style and raises no intent | `focus_mark_cannot_reach_another_surface`, `focus_mark_to_a_missing_or_gated_node_is_rejected`; conformance `focus_mark_moves_focus_once` with the `no-dom-id` mutant |
| G2 `putStateIf` | 4 | Runs after `checkOffered` and `authorize`; compares only within one `(placementId, scope)` | `store_put_state_if_is_scoped`, `store_suite_checks_compare_and_set_when_present`, `contended_write_gives_up_with_version_conflict` |
| `shown` | 1, 3 | One read-only integer root, no operator; readable only in `when`/`bind`, never in a style prop or `variant` | `sibling_count_is_not_readable_outside_when_and_bind`, `shown-no-properties` / `shown-not-boolean` / `shown-bind-type-mismatch` corpus cases |
| Conformance (Task 8) | 4 | First suite case for law 4: a renderer that sends `setLocal` to the host fails | `renderer_that_forwards_set_local_fails_its_rule` |

Law 1: no addition runs widget code in the browser. Each one is data the renderer evaluates with the bounded expression rules of spec §8, or a host-side store method.

### 4. Validation

- Every new input is validated at arrival, in `render()` and at template install, and each failure has a typed kind and pointer. The kinds: `unknown-name` (undeclared local key, `shown.n`), `limit-exceeded` (more than four `local` writes, more than 16 `fromLocal` entries), `invalid-prop` (fit, double fill, gated focus, `bindAll` with an array), `not-found` (focus target), `duplicate-key` (second focus mark), `invalid-document` (bad array carry), `version-conflict` (CAS exhausted).
- The three tree-rule implementations agree: `tree-rule-parity.test.ts` carries the tree's `focus` into element form. `focus-missing` and `focus-malformed` are walk-only, because element JSON cannot mark a node that does not exist.
- Gap (F7): element JSON still reads a `focus` (and `when`) inside `props` as the field. `validateCatalog` does not reserve `when`, `bind` or `focus` as prop names; only `liveframe gen` refuses them (`src/sdk/gen.ts:184`).

### 5. Styling

None. No vocabulary, theme, recipe or `/css` projection changed. `focus({ preventScroll: false })` moves focus and changes no style. `shown` cannot reach a style prop.

### 6. Interaction tiers

- **Local:** `setLocal` alone is unchanged. A host intent may carry one to four local writes. `until: "revision"` writes revert on the next accepted revision of the same `surfaceId`, including the refusal re-render `handleIntent` produces. `shown` lets a local filter show its empty state.
- **`setState`:** may read `fromLocal` (design decision F2), can fill an array state key from an array event, and is a compare-and-set when the store has `putStateIf`.
- **Action:** may read `fromLocal` and fill an array argument with `bind`. An event still offers exactly one host intent (restated Rule 1).
- Gap (F2): the authoring MCP `set_state` tool cannot drive a `setState` that reads `fromLocal`. `src/authoring/index.ts:387` calls `complete(offered, input.value)` without local values, and `complete()` ignores the event value for a `fromLocal` intent (`src/validate/complete.ts:9-13`). The completed intent has no `value`, so the preview session refuses it (`src/preview/session.ts:117-123`), even though the tool description says "`value` completes the event". Fixed in Task 8a.

### 7. Performance

Per-task measures, from the task notes:

| Task | Path | Measure | Result |
|---|---|---|---|
| 2 | emit / arrival | `surface_core_work_per_arrival_and_event_is_unchanged` | zero extra work when `local` and the revert list are unused |
| 3 | host | `bench/host.bench.ts` `intentPipelineMs` | 0.037 ms (budget 0.2) |
| 4 | validator | `bench/validator.bench.ts` | not measured in the task ("re-run on a quiet machine") |
| 5 | arrival | — | one `hasOwn` in `enterTree`, one property read in `snapshotOf`; no bench |
| 6 | host | `intentPipelineMs` / `httpSetStateCpuMs` | 0.026 ms / 0.63 ms (budgets 0.2 / 50) |
| 7 | arrival / emit | `surface_core_work_per_arrival_and_event_is_unchanged` | counts dropped (`mapGet` 927→827, `sets` 256→206): frame slots fixed per module |
| 7 | browser | `liveFilter.emptyRow.medianMs` | 2.00 ms beside 2.15 ms without the empty row (budget 4) |
| 8 | browser suite | five new cases | 1.3–1.9 s each, about 8 s across four theme × design-system pairs; no fixed delays |

**Before and after (emit and arrival rows).** "Before" is plan 036's last recorded run (`036-impact-analysis.md` §3, load 5.6–6.0). Plan 029 recorded the live-filter row. "After" is this sweep, 2026-11-19, Bun 1.4.4, 16 cores, each script run alone at load 4.0–9.3.

| Row | Budget | Before | After | Verdict |
|---|---:|---:|---:|---|
| validator `core-queue.large` / `full` compiled | 1.5 µs/node | 1.628 / 1.669 | 1.502 / 1.507 | fails narrowly, as before |
| validator bindings, 50 `when` | 1.75 µs/node | 1.751 | 1.612 | pass |
| validator `applyPatch` / `diffTrees` | 0.5 / 1.5 ms | — | 0.105 / 0.524 | pass |
| render `agent-home` / `core-queue.full` | 3 µs/node | 2.58 (T3) / 4.719 | 2.348 / 2.780 | pass |
| render `agent-home elements` | 3 µs/node | 3.108 | 2.783 | pass |
| template `renderTemplate` | 3 µs/node | 2.177 | 2.400–2.867 | pass |
| template `templateRunner` overhead | 5% | 5.03% | −8.58% to 1.27% | pass |
| template `validateTemplate` agent-home CPU | 5 ms | not recorded | 5.657, 5.034, 4.348 (three runs) | fails in two of three runs |
| host `intentPipelineMs` | 0.2 ms | 0.026 (T6) | 0.0014 | pass |
| host `httpSetStateCpuMs` | 50 ms | 0.63 (T6) | 0.61 | pass |
| selection `liveFilter.medianMs` | 4 ms | 1.7 (plan 029) | 1.75 | pass |
| selection `liveFilter.emptyRow.medianMs` | 4 ms | 2.00 (T7) | 1.50 | pass |
| selection `focusContinuity.false` / `true` wall | — | — | 2.8 / 2.9 ms | recorded |
| runner QuickJS recovery | 300 ms | 362.8 | 304.4 | fails narrowly, as before |

`css`, `streaming`, `stream-elements`, `pack-libraries` and `hash` passed.

What this shows: every failing row is a wall-clock budget close to its limit at load 4–9, and the same rows failed before this plan at higher load. The `validateTemplate` row has no earlier value (it was added in plan 033), and it moves 1.3 ms between consecutive runs. A strict before/after A/B for plan 037 alone is not possible: plans 033–037 are uncommitted in one working tree (F6), so no base ref holds the tree as it was at the end of plan 036. No budget was relaxed (F5).

### 8. Portability

- `src/surface/`, `src/validate/`, `src/store/memory.ts` and `src/host/` stay host-API free. `portability.test.ts` passes. The focus move uses `getElementById`/`focus()` only in `/react` (`src/react/renderer.tsx`, `useFocusMark`). `fileStore`'s `putStateIf` runs under `/store/fs`, which may use `node:`.
- Browsers: see §3, Verification (`LIVEFRAME_BROWSER=webkit` and `firefox`).

### 9. Agent authoring

- `liveframe gen` types `local` writes and `fromLocal` against `manifest.local` when the manifest is passed (`generate(catalog, { manifest })`). It also gives every primitive `focus?: boolean` and reserves the name. The elements and template structured-output schemas gain the forms, and `src/__tests__/fixtures/mcp-texts.json` was regenerated. Errors name the key, argument or carry (`describeCarries()`).
- Element JSON can write `shown` in `when`/`bind`, because it shares the validator.
- Gap (F2, fixed in Task 8a): the MCP `set_state` tool could not exercise a `fromLocal` state event (area 6).
- Gap (F8): generated author types do not narrow `bind` to array arguments. The validator alone checks that fit, as it does for object carries (Task 4 note).
- Gap (F3): the skill references an agent reads first, `.agents/skills/liveframe-execution/references/formats.md:10` and `renderer.md:20`, still describe an intent as `{type:"setState", key, value?}` / `{type:"action", name, args}` and completion as "fill `setState.value` or `args[bind]`". They did not mention `local`, `fromLocal`, array carries, the focus mark or `shown`. Both references are now updated. `references/storage.md` names `putStateIf`.

### 10. Docs and examples

- Outsider docs are current: `docs/spec.md`, `docs/sdk.md`, `docs/templates.md`, `docs/formats.md`, `docs/renderer.md` (new "Move focus to a node the widget names"), `docs/host.md` (multi-process guidance), `docs/packages.md`, `docs/conformance.md`, `docs/compatibility.md` (both registers), `docs/migration-0.4.md` and `CHANGELOG.md`.
- `docs/mcp.md:215,258` describe `set_state` as "`value` completes the event", which was wrong for a `fromLocal` event (F2). Both places now say that `value` stands for the local read.
- The demo host (`examples/demo-host/widgets/queue`) uses local bindings but none of the six additions, so no example in the repository shows them working end to end (F9). Its `rendererBrowserSuite` run did not supply the new fixtures, so `demo:test` failed (F10). Task 8b added them.
- The backlog entries "Let a filtered list know it is empty" and "Cover the surface core and local bindings in the renderer conformance suites" are closed.

### 11. Conformance

- `rendererSuite` gains `failed_binding_draws_the_node_fallback`. `rendererBrowserSuite` gains five cases (§13), each with a mutant that fails only its own case. `storeSuite` gains two `putStateIf` cases, which pass a store without the method.
- The starter (`browser.test.ts`, `suites.test.ts`) and the proof host (`conformance-browser.test.ts`, `conformance.test.ts`) pass the new cases inside `bun run check`.
- The corpus gains valid and invalid cases for every addition (§2). A `/surface` adapter suite stays with plan 038 Task 6.

### 12. Reference hosts

- Synapta and Clay: the main gain is G2. A multi-process host can now keep both writes when two `setState` calls on different keys of one placement race, as long as its store implements `putStateIf`. `docs/host.md` says what a store without the method means: last write wins across processes. CAS does not serialise `served`/`actions`, and the spec says so (§7.7). F1 and F2 remove the multi-field-form primitive and the optimistic "saving" round trip that both hosts' agent widgets would otherwise need. No migration bent the design, and neither host needs code to stay on 0.3 behaviour.

---

## 2. Findings and Disposition

Presented to the owner on 2026-11-19. Every recommendation was accepted ("Accept all"), and the owner approved the design for F1 ("Approve").

| # | Finding | Area | Recommended | Owner's disposition |
|---|---|---|---|---|
| F1 | Task 1 is open: no decision log records the owner's approval of the design and of the restated §8 Rule 1, already in `docs/spec.md:1159` | 1 | **execute**: owner approves; write the log with `create-decision-log`; tick Task 1 | **execute** — done: `decision-logs/2026-11-19-0154-interaction-additions-for-0-4-0.md`; Task 1 ticked |
| F2 | MCP `set_state` cannot apply an offered `setState` that reads `fromLocal`: `value` is ignored and the intent is refused; `docs/mcp.md` says otherwise | 6, 9, 10 | **execute**: pass `value` as the read local value for a `fromLocal` intent, test it, fix the tool text and `docs/mcp.md` | **execute** — done: Task 8a |
| F3 | Skill references `formats.md` and `renderer.md` describe the 0.3 intent and completion only | 9 | **execute**: one sentence each | **execute** — done: both references updated |
| F4 | The plan's Verification line `bun --conditions liveframe:source test <files>` runs the whole suite (Task 6 finding) | — | **execute**: change it to `bun test --conditions liveframe:source ./<files>` | **execute** — done: plan Verification line |
| F5 | `validator` (1.502/1.507 vs 1.5), `template` `validateTemplate` (4.3–5.7 vs 5 ms) and `runner` recovery (304 vs 300 ms) fail at load 4–9; no quiet-host whole-bench pass | 7 | **backlog**: a "Measured" line on the P1 entry "Phase 1 performance gate: 3 µs per node" | **backlog** — "Measured" line on the P1 entry |
| F6 | Tasks 2–8 (and plans 033–036) are uncommitted in one working tree, so no task can be committed alone by path and no per-plan bench base exists | 7 | recorded; the owner chooses the commit strategy | recorded; the owner chose not to commit |
| F7 | `validateCatalog` does not reserve `when`, `bind`, `focus` as prop names; element JSON reads a `focus`/`when` inside `props` as the field | 4 | **backlog** P3 | **backlog** P3: "Reserve `when`, `bind` and `focus` as prop names in catalogs" |
| F8 | Generated author types do not narrow `bind` to array (or object) arguments | 9 | **backlog** P4 | **backlog** P4: "Narrow generated `bind` types to the argument a carry fits" |
| F9 | No example in the repository shows the six additions end to end | 10 | **backlog** P4: add them to the demo host's queue widget | **backlog** P4: "Show the 0.4.0 interaction additions in the demo host" |
| F10 | `bun run demo:test` fails: the demo host's `rendererBrowserSuite` run (`examples/demo-host/tests/conformance-browser.test.ts`) lacks the four new `BrowserFixtures` fields, so the five new cases fail with "Missing local fixture" (71 pass, 5 fail). Task 8 updated the starter and the proof host but not the demo host. Any adopter's CI hits the same failure on upgrade, as `docs/migration-0.4.md` says | 10, 11 | **execute**: add `local`, `compound`, `fromLocal` and `focus` fixtures (and the manifest `local` keys and text-field `domId` they need) to the demo host | **execute** — done: Task 8b |

---

## 3. Verification

All runs on 2026-11-19, Bun 1.4.4, 16 cores, load average 4–12 (shared host).

| Command | Result |
|---|---|
| `bun run check` (before the executed findings) | Pass: 1,972 pass, 9 skip, 0 fail (171 files). |
| `bun run check` (after Tasks 8a, 8b and F3/F4) | Pass: 1,973 pass, 9 skip, 0 fail. The "Controlled page render failure" line in the output is an expected-failure fixture's log. |
| `bun run bench` | Each script run alone (the `&&` chain stops at the first failure): `validator`, `template` and `runner` fail narrow wall-clock budgets (F5); the other eight pass. Rows in §1 area 7. |
| `bun test --conditions liveframe:source ./src/__tests__/corpus.test.ts … ./src/__tests__/conformance-renderer.test.tsx` (the six files) | 97 pass, 0 fail. |
| `LIVEFRAME_BROWSER=webkit bun run test` | 1,965 pass, 16 skip, 0 fail. |
| `LIVEFRAME_BROWSER=firefox bun run test` | 1,972 pass, 10 skip, 0 fail. |
| `bun run demo:test` | Before Task 8b: 71 pass, 5 fail (F10). After: 76 pass, 0 fail. |
| `bun run guide:test` | Pass (3.8 s). |
| `bun run release:gate` | Pass: archive rules and installed smoke test. |
| `bun test --conditions liveframe:source ./src/__tests__/authoring.test.ts ./src/__tests__/cli-mcp.test.ts` | 17 and 85 pass (Task 8a). |
