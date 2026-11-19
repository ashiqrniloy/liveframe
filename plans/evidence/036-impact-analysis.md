# Plan 036 — Architectural Impact Analysis (Internal Structure and Rule Parity)

Date: 2026-11-18
Plan: [`plans/036-Phase-7-Part-W-Internal-Structure-And-Parity.md`](../036-Phase-7-Part-W-Internal-Structure-And-Parity.md)

This sweep covers the twelve impact areas in `.claude/skills/create-plan/references/liveframe.md` §5 across Tasks 1–6 (Task 1a is the measurement tooling Task 1 needed). The plan is behaviour-preserving: no register entry, no error kind or pointer change except the two disclosed below, and no bench over budget.

---

## 1. The Twelve Impact Areas

### 1. Spec (`docs/spec.md`)

- §10 gains one sentence (Task 2): three implementations apply the tree rules (the arrival walk, the build pass of `render()`/`renderElements`, the stream build of `streamElements`), the walk is the authority, and `src/__tests__/tree-rule-parity.test.ts` checks the other two against it. This is the only spec edit. No section changes meaning.
- §11 gained nothing: the plan's allowance for one sentence there was not needed, because Task 4 moved code without changing what the core promises.
- Task 6 rewrote source comments to cite spec sections (§7.2–§7.6, §8, §9, §11). Each cited section was read against the rule the comment states.
- `src/__tests__/docs-spec-structure.test.ts` passes.

### 2. Public API and formats

- `scripts/release/api/register-0.3.1.json` is unchanged by this plan: it holds eight entries, from plans 033 (Tasks 4, 6, 7, 10) and 035 (Task 5), and none names plan 036. The file's last write (2026-11-17 13:33) is before plan 035's impact analysis was written (17:09), so no 036 task touched it. `src/__tests__/api-stability.test.ts` passes with it.
- `src/template/expr.ts` keeps its exports and import path; `src/template/expr/` is internal. `absent` moved to `src/template/scope.ts` and is re-exported from `expr.ts`; the recorded `./template` `evaluate` declaration is byte-identical to the 0.3.0 baseline (see F7).
- Two disclosed behaviour changes, neither a format or register change:
  - The "unknown validator" message is now one string everywhere (Task 1): "Expected a validator compiled by this copy of `compileValidator`". Kinds and pointers are unchanged. Listed in `CHANGELOG.md` Fixed on 2026-11-18 (it had no entry).
  - `streamElements` errors point at `/children/N` like `renderElements` (Task 2, a defect fix the owner accepted on 2026-11-17). Already in `CHANGELOG.md` Fixed.

### 3. The four laws

| Path | Why nothing leaks | Test |
|---|---|---|
| Fail-closed validator facts (Task 1; laws 2 and 4) | Facts live in one module-private `WeakMap`; a consumer cannot replace an action's `confirm` flag or the offered-intent schema. An unknown validator is rejected in every caller, including `checkOffered`. | `unknown_validator_is_named_the_same_way_everywhere`, `validator_from_a_second_copy_is_rejected_not_thrown`, `facts_are_not_reachable_from_the_validator_object` (`validator-facts.test.tsx`) |
| Three tree-rule implementations (Task 2; law 2) | A tree the build pass emits and the arrival walk rejects, or the reverse, fails here. | `corpus_trees_get_one_verdict_from_all_three`, `generated_breaks_get_one_verdict_from_all_three`, `limits_agree_at_the_boundary` (`tree-rule-parity.test.ts`) |
| Intent raising moved (Task 4; law 4) | `setLocal` still never reaches `onIntent`; confirmation still gates only the host call. | `surface-core.test.ts`, `local-bindings.test.tsx`, `action-results.test.tsx`, `react-intents.test.tsx`, unmodified |
| Template operator set (Task 5; law 1) | The operator set is closed; the split changed no table entry. The scan for dynamic code and host APIs now covers every `template/expr/*.ts` by glob. | `template_operator_set_is_exactly_the_documented_one`, `the_modules_use_no_dynamic_code_and_no_host_api` |

Laws 1 and 3 are otherwise untouched: no widget-code path and no style channel changed.

### 4. Validation

- No new input. Task 1 turns three different failure modes for an unknown validator into one typed `LiveframeFailure`/error at a documented pointer. Task 2 found one validation defect (stream pointers, fixed) and four disagreements that still reject everywhere (F1–F4).
- Task 3's `fail(...)` lost its `message` argument; the two call sites passed the default text, so no message changed.

### 5. Styling

None — no catalog vocabulary, theme, recipe or `/css` projection changed.

### 6. Interaction tiers

None — local, `setState` and action semantics are unchanged. Task 4's re-entrancy rule (a host's `onEvent` may re-enter `emit` or `accept`; `stage` and `writeLocal` read state at each point of use) is preserved and covered by the five named suites.

### 7. Performance

Rule 2 as amended by Task 1a. On this host the A/A control at load 10–25 moves about ±15%, so `bench/ab.ts` left every gated row `inconclusive` or `unusable`, and each task passed on the deterministic count the amended rule allows plus an in-process interleaved A/B.

| Task | Row or measure | Before | After | How judged |
|---|---|---|---|---|
| 1 | validator-facts reads per `render()` / `renderElements()` / surface core | 3 / 2 / 2 | 1 / 1 / 1 | `render_reads_the_validator_facts_once`, `surface_core_reads_the_validator_facts_once_per_core` (both fail on the old code) |
| 1 | `agent-home.renderCpuMs` | base | 0.930 [0.829, 0.979] | pass by interval |
| 2 | `stream.agentHome.renderCpuMs` / `streamCpuMs` | base | 1.050 [0.983, 1.109] / 1.040 [0.962, 1.150], both unusable (control [1.030, 1.206]) | owner accepted on 2026-11-17: one short string per streamed element, for the pointer fix |
| 3 | lookups, `Set`s built, `WeakMap`/`WeakSet` calls per steady-state agent-home render (679 nodes) | base | identical | `build_pass_work_per_render_is_unchanged` |
| 3 | `rack-module`, `synthetic-queue`, `core-queue.full` render CPU | base | head/base averaged 1.013 (range 1.000–1.033) against A/A 1.003 | in-process interleaved A/B, both load orders |
| 3 | µs per node (head) | ≤ 3 | agent-home elements 2.58, git-status 2.14, rack-module 2.01, synthetic-queue 2.24 | 3 µs budget holds |
| 4 | per arrival and event: `WeakMap`/`WeakSet`/`Map`/`Set` calls, `Set`s built, `Object.freeze` calls | base | identical | `surface_core_work_per_arrival_and_event_is_unchanged` |
| 4 | 5 cores × 40 arrivals, 602 nodes | base | head/base 1.005, 1.000, 0.971 against A/A 1.016, 1.007, 0.987 | in-process A/B |
| 5 | template render, compiled evaluation, `compileExpression` | base | head/base 0.964–1.002, 1.008/1.007/0.972, 0.988–1.010; all inside the control's spread | in-process A/B; function bodies identical |
| 5 | `dist/validator.bundle.js`, `dist/runner-kit.bundle.js` | 132,283 / 140,115 B | 132,279 / 140,116 B | within 1% |
| 6 | — | — | — | comments only |

The whole-plan `bun run bench` sweep is in §3.

### 8. Portability

- `src/validate/compile.ts`, `src/sdk/render.ts`, `src/surface/core.ts` and `src/template/expr/*` stay host-API-free; `portability.test.ts` scans source and compiled output and passes.
- Task 6 found that scan reads comments too: a comment under a host-free path must not end a sentence with `document`, `window`, `process`, `self` or another name it lists. Recorded in the Task 6 notes; not a defect.
- No runtime other than Bun is affected; the browser bundle holds the same code apart from minified names and declaration order.

### 9. Agent authoring

- The unknown-validator error now names its cause in one sentence an agent or host can act on. No generated type, catalog-derived prop or other agent-facing message changed.
- F1/F2 (element JSON error kinds) are agent-facing: an agent that emits element JSON with a bad `kind` is told `invalid-prop`, where the TSX path says `unknown-component`. Backlogged for 0.4.0.

### 10. Docs and examples

- `docs/sdk.md` and `docs/renderer.md` state that a validator works only with the copy that compiled it, and name the error (Task 1). `docs/spec.md` §10 has the parity sentence.
- `CHANGELOG.md`: Fixed gains the unknown-validator message line (added in this task, F9) beside the stream-pointer line from Task 2.
- `.agents/skills/liveframe-execution/references/formats.md` named `buildFacts` as the reader of the facts table; it now names `factsOf` (F10). `references/architecture.md` "Today" names none of the moved files, so it is unchanged.
- No outsider guide describes `template/expr.ts`'s layout, so none changed for Task 5.

### 11. Conformance

- No suite changed and none needs to: the plan adds no behaviour a second implementation must match. The parity test is internal to this repository's three implementations, not a conformance case.
- `corpus.test.ts` still runs every `ui-tree` case through `validateTree`; the parity test runs the same cases through the other two.

### 12. Reference hosts

- Synapta and Clay: no gap found, and neither needs code. A host that compiled a validator in one copy of the package and rendered with another now gets one named error instead of three different ones (Task 1), which helps a host that bundles two copies. No migration bent the design.

---

## 2. Findings and Disposition

Presented to the owner on 2026-11-18; every recommendation was accepted ("approved").

| # | Finding | Area | Disposition | Where |
|---|---|---|---|---|
| F1 | Element JSON with a missing or non-string `kind` is `invalid-prop`; `render()` and the walk say `unknown-component` | 2, 9 | **backlog** (P3, 0.4.0) | `plans/backlog.md` "Align element JSON's error kinds…" |
| F2 | Element JSON with non-array `children` is `invalid-prop`; the walk says `invalid-children` | 2, 9 | **backlog** (P3, 0.4.0) | same entry |
| F3 | Too many children of a kind: the build passes point at the node, the walk at `children` | 4 | **backlog** (P3) | `plans/backlog.md` "Align the SDK build pass's child-count pointer…" |
| F4 | The byte-limit pointer names a different field in the walk and the build; spec §10 does not say so | 1, 4 | **backlog** (P3) | same entry |
| F5 | `proof/tests/mcp-capture.test.ts` hits the 100 ms wall-clock render limit under load, inside `bun run check` | 7 | **backlog** (P3) | `plans/backlog.md` "Make `proof/tests/mcp-capture.test.ts` independent of host load" |
| F6 | `bench/ab.ts` cannot decide 2% at current load; an in-process interleaved A/B can | 7 | **backlog** (P3) | `plans/backlog.md` "Let `bench/ab.ts` decide 2%…" |
| F7 | The API-surface reader inlines a helper type only from a declaration file that declares a subpath export, so a file split can change a recorded entry | 2 | **backlog** (P4) | `plans/backlog.md` "Make the API-surface reader independent…" |
| F8 | `source_comments_cite_no_plan_or_decision_ids` does not gate bare design ids such as `(B4)` | 10 | **backlog** (P4) | `plans/backlog.md` "Gate bare design ids in source comments" |
| F9 | The unknown-validator message change (Task 1) had no `CHANGELOG.md` entry | 10 | **execute**, done in this task | `CHANGELOG.md` Fixed |
| F10 | `references/formats.md` named `buildFacts` as the facts reader | 10 | **execute**, done in this task | `.agents/skills/liveframe-execution/references/formats.md` |
| F11 | Tasks 1–6 are uncommitted: the working tree holds the uncommitted changes of plans 033–035 in the same files, so no commit can stage one task by path | — | recorded; the owner chooses the commit strategy | Compromises Made |
| F12 | `bun run bench` fails four scripts' wall-clock budgets at load 5–54 on a shared host; no quiet-host pass for the whole plan | 7 | **backlog**: a "Measured" line on the existing P1 entry | `plans/backlog.md` "Phase 1 performance gate: 3 µs per node" |

F1–F4 are the four disagreements Task 2 recorded for the owner. All three implementations still reject every case in them, so no invalid tree is accepted. Their strict checks stay skipped in `known_differences_strict` until each is fixed.

---

## 3. Verification

All runs on 2026-11-18, Bun 1.4.4, 16 cores. The host was shared with another project's test runs: load average 24–33 during `check`, 15–54 for the first bench pass, about 5–6 for the last.

| Command | Result |
|---|---|
| `bun run check` | Pass. Build, gen check, typecheck, lint (infos only, in `src/conformance/runner-fixtures.ts`, not touched by this plan), format and tests: 1,884 pass, 9 skip, 0 fail. |
| `bun test --conditions liveframe:source src/__tests__/tree-rule-parity.test.ts src/__tests__/api-stability.test.ts src/__tests__/source-comments.test.ts src/__tests__/validator-facts.test.tsx` | 66 pass, 5 skip, 0 fail (the 5 skips are `known_differences_strict`, F1–F4). These four files sit under the `src` path `bun run test` runs, so the parity test (Task 2), the fail-closed tests (Task 1) and the comment scan (Task 6) are in `bun run check`. |
| `bun run release:gate` | Pass: every package's archive rules and installed smoke test. |
| `graft build` | Pass; the graph holds `src/template/expr/{types,operators,forms,analyze}` and the new tests. |
| `bun run bench` | **Fail at its first script** (`validator.bench.ts`), at load 31, so the `&&` chain never reached the rest. |
| each `bench/*.bench.ts` on its own (11 scripts) | Load 20–54: `css`, `streaming`, `stream-elements`, `host`, `pack-libraries`, `hash` and `selection` pass; `validator`, `render`, `template` and `runner` fail wall-clock budgets. |
| the four failing scripts again, load 15–17 | Same four fail. |
| the four failing scripts again, load 5.6–6.0 | Same four fail, narrowly (below). |

### The bench sweep did not pass on this host

At load 5.6–6.0, the quietest the host reached:

| Script | Failing row | Value | Budget | Last recorded quiet-host value |
|---|---|---:|---:|---|
| `validator` | `core-queue.large` / `core-queue.full` compiled | 1.628 / 1.669 µs/node | 1.5 | failed at 1.540–1.670 at load 4.6–9, passed at load under 3 (backlog "Phase 1 performance gate") |
| `validator` | bindings, 50 `when` expressions | 1.751 µs/node | 1.75 | not recorded |
| `render` | `core-queue.full` | 4.719 µs/node | 3 | not recorded (the other seven rows were 2.20–2.82 µs/node in this same run) |
| `render` | `agent-home elements` | 3.108 µs/node | 3 | 2.58 (Task 3, load ~5) |
| `template` | `templateRunner` overhead | 5.03% over `renderTemplate` | 5% | not recorded; `renderTemplate` itself was 2.177 µs/node (budget 3) |
| `runner` | quickjs recovery | 362.8 ms | 300 | not recorded |

What this does and does not show:

- Every failing value is a wall-clock budget exceeded at load 5–54 on a 16-core host. The backlog already records the validator gate failing at load 4.5–9 on commits that predate this plan (base `05d6b7c` at load 6.33). A pass at load below 3 is the standard that entry asks for.
- Plan 036 touched the validator only by moving its facts into one table after compilation (Task 1). It touched `render()`, the surface core and the expression module without changing the work they do. Each task's before and after is in §1, area 7: deterministic counts equal to the base, and in-process interleaved A/B ratios within the A/A control's spread. The sweep does not contradict those. It cannot separate them from load.
- No budget was relaxed and no row was re-run until it passed.
- The `render` row `core-queue.full` (4.719 µs/node, with `core-queue.large` validation 2.388 µs/node in the same run) is an outlier: the same row was 2.992 µs/node at load 15 and the other rows moved little.
- F12: a whole-plan `bun run bench` pass on a quiet host (load under 3) is still owed. Recorded as a "Measured" line on the existing backlog entry "Phase 1 performance gate: 3 µs per node", not a new entry.
