# Phase 7 Part W: Internal Structure and Rule Parity

Depends on: plans [033](033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md), [034](034-Phase-7-Part-U-Request-Time-Performance.md) and [035](035-Phase-7-Part-V-Browser-Renderer-Cost-And-Resilience.md) complete: they change `src/surface/core.ts`, `src/sdk/render.ts` and `src/react/renderer.tsx`, and this plan restructures the first two. Followed by plan [037](037-Phase-7-Part-X-Interaction-Capabilities.md), which adds features to the same files. Source: findings A1, A2, A5 and A6 of the 2026-11-15 review (table in plan 033).

## Objectives

- Keep every fact a compiled validator carries in one table with one lookup that fails closed.
- Prove that the three implementations of the tree rules agree, case by case.
- Make `sdk/render.ts`, `createSurfaceCore` and `template/expr.ts` easier to change without changing what they do or what they cost.
- Remove plan task ids from source comments.

## Expected Outcome

- `src/validate/compile.ts` holds one `WeakMap` from a validator to its facts; a validator this copy did not compile is reported by one typed error everywhere it is used.
- `src/__tests__/tree-rule-parity.test.ts` runs every corpus tree and a generated set through `validateTree`, the SDK build pass and the stream build, and fails on any disagreement.
- `emit` and its helpers in `src/sdk/render.ts` take the open parent node instead of five positional arguments; the ownership invariants of the three `WeakSet`s are stated once and each has a test.
- `createSurfaceCore`'s intent raising and context construction are module-level functions over an explicit state object.
- `src/template/expr.ts` is split into files by concern with the same exports.
- No comment under `src/` or `packages/*/src/` names a plan, a task id or a decision by date; a test keeps it so.

This plan implements the structural part of the review-fix work in roadmap Phase 7. It is behaviour-preserving throughout: `register-0.3.1.json` gains no entry, no error kind or pointer changes (one message is reworded, in Task 1), and every bench stays within its budget. A task that cannot meet those three conditions stops and records why. No version is bumped and nothing is published. No spec section changes meaning; §10 and §11 gain one sentence each where a task says so.

## Rules for every task

1. **Tests bracket the edit.** The named tests pass before the change and, unmodified, after it. A test is edited only to move an import.
2. **Measured, not assumed.** A task that touches a render, validation or binding path compares before and after with `bench/ab.ts`, which runs base and head interleaved with an A/A control (amended by Task 1a; the host this runs on is never idle, and no production host is either). The verdict is read from the named bench's CPU-time rows (`*CpuMs`), never from wall-clock rows, which are recorded as context only:
   - `pass`: the 95% bootstrap interval of the paired head/base ratio lies at or below 1.02.
   - `fail`: the whole interval lies above 1.02. The change is reverted and the task records the number (plan 025 Tasks 4–5 set this precedent for closure splits).
   - `inconclusive` (the interval straddles 1.02 after `--max-runs`) or `unusable` (the A/A control's interval lies wholly outside 1 ± 2%): the task records the interval. It passes rule 2 only if a deterministic test proves the change adds no work on the path, such as a count of lookups, allocations or calls per render. Without that test, the task stops.
   - A bench with no CPU-time rows (`bench/selection.bench.ts` measures a browser process) is judged on its wall rows by the same rule.
3. **No public change.** `src/__tests__/api-stability.test.ts` passes with the register untouched.

## Tasks

- [x] Task 1: Keep a validator's facts in one table that fails closed (A1)
  - Acceptance Criteria:
    - Functional:
      - `src/validate/compile.ts` replaces `builds`, `actions` and `locals` (`:95-116`) with one `WeakMap<CompiledValidator, ValidatorFacts>` and one accessor that returns the facts or `undefined`. `offeredChecks` (`src/validate/offered.ts:14-20`) moves into the same record. `buildFacts`, `actionFacts` and `localFacts` stay as thin readers for their callers.
      - The validator-to-install table in `src/host/render.ts:17` and the tree-to-validators table in `src/validate/offered.ts:20` stay where they are: they record something other than what a validator was compiled from. A comment on each says so.
      - Every caller (`src/sdk/render.ts:139`, `:289`, `:400`, `:601`; `src/template/render.ts:429`; `src/react/renderer.tsx:351`; `src/surface/core.ts:195-196`; `src/validate/offered.ts:39`) keeps the outcome it has after plan 033 for an unknown validator: `render()` and `renderTemplate()` throw `LiveframeFailure` (`invalid-document`), `checkOffered` returns `invalid-prop` at `/validator`, the surface core and `<Surface>` report `catalog-mismatch` at `/validator`. Kinds and pointers do not change; the message in each names the cause in the same words: "Expected a validator compiled by this copy of `compileValidator`".
      - `docs/renderer.md` and `docs/sdk.md` state that a validator works only with the library copy that compiled it, and name the error.
    - Performance: one `WeakMap` read per render instead of up to three; `bench/render.bench.ts`, `bench/validator.bench.ts` and `bench/selection.bench.ts` within rule 2.
    - Code Quality: the facts stay off `CompiledValidator`'s public type (the reason given at `compile.ts:125-129` holds); no symbol-keyed property on the validator object.
    - Security: law 2 and law 4. Facts a consumer could replace would let it forge an action's `confirm` flag or the offered-intent schema; the `WeakMap` keeps them unreachable. An unknown validator fails closed in every caller, including `checkOffered` ("Unknown validators fail closed", spec §8).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/formats.md`.
      - `safe-refactor`.
    - Library Documentation to Check Before Implementation:
      - none; run `graft callers buildFacts --depth all`, `graft callers actionFacts --depth all`, `graft callers localFacts --depth all` before the edit.
    - Documentation Reviewed:
      - Spec §8 (`checkOffered`), §10 (compiled per catalog), §11; `src/validate/compile.ts:95-134`, `:392-435`; plan 033 Task 6 (the surface core already contains the lookup failure).
    - Options Considered:
      - Put the facts on the validator under `Symbol.for("liveframe.validator")` so two copies of the library interoperate — rejected: a registered symbol is reachable by any code, which is what the `WeakMap` exists to prevent.
      - Leave six tables — rejected: three of them answer the same question with three different failure modes.
    - Chosen Approach:
      - One record per validator, one nullable accessor, one error.
    - API Notes and Examples:
      ```ts
      /** @internal */
      export function factsOf(validator: CompiledValidator): ValidatorFacts | undefined;
      ```
    - Files to Create/Edit:
      - `src/validate/compile.ts`, `src/validate/offered.ts`: the table and accessor.
      - `src/sdk/render.ts`, `src/template/render.ts`, `src/react/renderer.tsx`, `src/surface/core.ts`: the shared error.
      - `src/__tests__/validator-smoke.test.ts` (or a new `validator-facts.test.ts`): the tests below.
      - `docs/renderer.md`, `docs/sdk.md`: one sentence each.
  - Test Cases to Write:
    - `unknown_validator_is_named_the_same_way_everywhere`: `render()`, `renderTemplate()`, `renderElements()`, `checkOffered()`, `createSurfaceCore().accept()` and `<Surface>` given a wrapper each give their documented kind with the shared message; none throws anything but `LiveframeFailure`.
    - `validator_from_a_second_copy_is_rejected_not_thrown`: a validator compiled by `dist/index.js` handed to the source build's `render()` (skipped with a note if `dist` is absent).
    - `facts_are_not_reachable_from_the_validator_object`: `Reflect.ownKeys(validator)` is `["checkNode", "validateTree"]`.
  - Notes (executed 2026-11-17):
    - Status: all criteria met. The performance criterion was decided under rule 2 as amended by Task 1a (see the rule-2 notes below).
    - `src/validate/compile.ts`: `builds`, `actions`, `locals` and `offeredChecks` became one `WeakMap<CompiledValidator, ValidatorFacts>` (`{ build, actions, local, offered }`) behind `factsOf(validator): ValidatorFacts | undefined`. `buildFacts`, `actionFacts` and `localFacts` are one-line readers that throw `LiveframeFailure` (`invalid-document`, pointer `""`) through one private `known()`. The shared message is the internal constant `UNKNOWN_VALIDATOR` ("Expected a validator compiled by this copy of `compileValidator`"). `compile.ts` now imports only the `OfferedEvent` type from `offered.ts`, so there is no runtime import cycle.
    - `src/validate/offered.ts`: `checkOffered` reads `factsOf(validator)?.offered` and returns `invalid-prop` at `/validator` with the shared message. The `validated` table and `src/host/render.ts`'s `compiledFor` stay in place, each with a comment saying what it records and that it is not the facts table.
    - `src/sdk/render.ts`: `RenderContext` carries `build`, read once in `createContext`. `renderValue`, `streamBuild` and `checkInputs` read `ctx.build`, so a render does one `WeakMap` read instead of three. The unknown-validator throw still happens before any other work.
    - `src/surface/core.ts`: `facts()` reads `factsOf` once. `UNKNOWN_VALIDATOR` (the error list) keeps `catalog-mismatch` at `/validator`, with the message reworded to the shared one.
    - `src/react/renderer.tsx`: `registeredFor` uses `factsOf` instead of try/catch around `buildFacts`. `refusedCore` takes its message: a validator this copy compiled, for a catalog that is not registered, keeps "The validator's catalog is not registered with this renderer"; an unknown validator gets the shared message. Kind and pointer are unchanged in both cases.
    - `src/template/render.ts` is unchanged: it calls `buildFacts`, which now throws the shared message.
    - Docs: `docs/renderer.md` (after the `compileValidator` paragraph) and `docs/sdk.md` (after the first example) gain one sentence each, naming the error. No spec change.
    - Tests: new file `src/__tests__/validator-facts.test.tsx` with the three named tests, plus the two count tests from Task 1a. The test of a second library copy ran against the existing `dist/index.js`; it was not skipped. No existing test asserted the old messages, and none was edited.
    - `bun run check`: typecheck, lint and format pass. The test step outran `check`'s 900 s run under machine load, so `bun run test` was re-run alone: 1,829 pass, 4 skip, 0 fail (1,018 s).
    - Rule 2, first attempt, wall time only (before Task 1a): `bench/ab.ts`, 7 interleaved runs each. The base was a snapshot of the working tree with only this task's edits reversed (plans 033–035 are uncommitted, so `HEAD` was not a fair base). The machine stayed at load 14–22 on 16 cores from unrelated VMs throughout, and the results are noise. Rows whose code is identical on both sides moved as much as the rows under test: `validator` `core-queue.small.genericMs` 1.41 and `core-queue.full.genericMs` 0.88. Paired ratios for the named rows: `render` `agent-home.renderMs` 0.90, `core-queue.large.renderMs` 1.21, `agent-home-elements.renderMs` 1.16; `validator` `agent-home.compiledMs` 0.93, `compileValidator.firstCompileMedianMs` 1.23; `selection` `certified.wallMs` 0.88, `rack.wallMs` 1.16. These neither show nor rule out a 2% change, which led to Task 1a.
    - Rule 2 as amended (Task 1a harness, CPU rows, A/A control, 21 rounds each, load 10–25; same base snapshot `c6be1f3`):
      - `render`: no row fails; 9 pass, 8 inconclusive, 1 unusable. Examples: `agent-home.renderCpuMs` 0.930 [0.829, 0.979] pass; `core-queue.full.renderCpuMs` 0.948 [0.879, 1.034] inconclusive; `agent-home-elements.renderCpuMs` 0.929 [0.820, 1.085] inconclusive.
      - `validator`: no row fails; 11 inconclusive, 1 unusable (`agent-home.compiledCpuMs` 0.973 [0.899, 1.084]). The `validateTree` path is not touched by this task: in `compile.ts` only the facts registration after compilation moved.
      - `selection`: wall rows only (a browser process); not re-run, as the wall comparison above was already inconclusive.
      - Deterministic proof, as amended rule 2 requires for the inconclusive rows:
        - `render_reads_the_validator_facts_once`: 1 read per `render()` and per `renderElements()`. The pre-task code reads 3 and 2, and the test fails on it.
        - `surface_core_reads_the_validator_facts_once_per_core`: 1 read per core across three arrivals. The pre-task code reads 2, and the test fails on it.
        - The only other change on these paths is one more field on `RenderContext`, created once per render, not per node.
    - Not committed: the working tree still holds uncommitted plan 033–035 changes in the same files (`src/surface/core.ts`, `src/react/renderer.tsx`, `src/sdk/render.ts`, `src/host/render.ts`), so a commit staging only this task is not possible by path.

- [x] Task 1a: Judge performance on a host that is never idle
  - Acceptance Criteria:
    - Functional:
      - `bench/metrics.ts` exports `timed(run, iterations)`, returning the wall and process-CPU milliseconds per iteration (`process.cpuUsage()`). `bench/render.bench.ts`, `validator.bench.ts`, `template.bench.ts` and `stream-elements.bench.ts` record a `*CpuMs` row beside each timed wall row that rules 2 names. Existing row names and printed lines do not change.
      - `bench/stats.ts` holds the pure statistics: paired ratios, a seeded bootstrap 95% interval of their median, and `verdict(interval, threshold)` returning `pass`, `fail` or `inconclusive`.
      - `bench/ab.ts` runs three sides per round (base, head and a control, which is base again), alternating `base, head, control` and `control, head, base` so that neither copy of base always runs first. It prints each row's median ratio, interval and verdict, and the control's interval. It gates on the `*CpuMs` rows, or on `--gate <metric…>`. While a gated row is inconclusive it adds rounds up to `--max-runs` (default 3 × `--runs`). A control interval wholly outside 1 ± threshold marks the run `unusable`. Exit code: 0 pass, 1 fail, 3 inconclusive or unusable, 2 usage.
      - Task 1's performance criterion is decided under the amended rule 2. The deterministic proof is a test that counts reads of the facts table per `render()`.
    - Performance: n/a (tooling). The harness adds one run per round (the control).
    - Code Quality: the statistics are pure functions with their own tests; `ab.ts` stays a driver.
    - Security: n/a.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - Bun `process.cpuUsage` (process user + system microseconds; `process.threadCpuUsage` did not subtract its argument in Bun 1.4.4 when checked, so it is not used).
    - Documentation Reviewed:
      - Task 1's notes (7 interleaved wall runs at load 14–22: rows of identical code moved 0.82–1.41×, while `compileValidator.firstCompileCpuMs` moved 0.994× against 1.23× on wall); plan 033 Task 9 (wall-clock assertions out of `bun run check`).
    - Options Considered:
      - Hardware instruction counts (`perf stat -e instructions:u`): nearly independent of load, but `perf` is not installed and the counts miss cache and allocation regressions. Left as a further action.
      - Pinning to one core (`taskset`): reduces noise but does not remove contention from other processes. Not required; it can be passed through on the command line.
      - Wait for an idle host: rejected, because there may never be one.
    - Chosen Approach:
      - CPU time as the measured quantity, an interval rather than a point estimate, an A/A control that detects a biased run, and a deterministic count where a task claims a structural saving.
    - Files to Create/Edit:
      - `bench/metrics.ts`, `bench/stats.ts` (new), `bench/ab.ts`.
      - `bench/render.bench.ts`, `bench/validator.bench.ts`, `bench/template.bench.ts`, `bench/stream-elements.bench.ts`: the CPU rows.
      - `src/__tests__/bench-stats.test.ts` (new); `src/__tests__/validator-facts.test.tsx`: the read count.
  - Test Cases to Write:
    - `bootstrap_interval_is_deterministic_and_brackets_the_median`.
    - `verdict_passes_fails_and_withholds_by_the_interval`.
    - `render_reads_the_validator_facts_once`.
  - Notes (executed 2026-11-17):
    - `bench/metrics.ts`: `timed(run, iterations)` returns `{ wallMs, cpuMs }` per iteration (`process.cpuUsage()`, user + system). `process.threadCpuUsage(previous)` in Bun 1.4.4 returned the cumulative figure without subtracting `previous`, so it is not used.
    - CPU rows added, existing rows and printed lines unchanged:
      - `render.bench.ts`: `<workload>.renderCpuMs` and `.validationCpuMs` per workload, `agent-home-elements.renderCpuMs`, `agent-home-renderKey.cpuMs`. The `composed-6-layers` rows were already CPU time.
      - `validator.bench.ts`: `<fixture>.compiledCpuMs`.
      - `template.bench.ts`: `template.agentHome.renderCpuMs`.
      - `stream-elements.bench.ts`: `stream.agentHome.renderCpuMs` and `.streamCpuMs`.
    - `bench/stats.ts` (new): `median`, `pairedRatios`, `bootstrap` (seeded mulberry32, 4,000 resamples, percentile 95% interval of the median), `verdict`, `controlUsable`.
    - `bench/ab.ts`: each round runs base, head and control, alternating the order. It prints the median ratio and interval for head/base and control/base, and a verdict for each gated row. Gated rows are the `--gate` list, or every `*CpuMs`/`cpuMs` row. Extra rounds are added only for rows named by `--gate` (default `--max-runs` is 2 × `--runs` with `--gate`, else `--runs`), stop as soon as one gated row fails, and print a progress line each. Exit codes: 0 pass, 1 fail, 3 inconclusive or unusable, 2 usage.
    - Changed after the first run: that run gated all 18 CPU rows of the render bench and extended to 21 rounds. With that many rows, one is nearly always undecided, so every bench ran to the cap (about 3 × 21 bench processes, 30–40 minutes per bench) with no progress output. Extension is now limited to the rows a task names.
    - Finding (affects every later task's rule-2 check): at load 10–25 on 16 cores, CPU time per operation still moves about ±15% between runs of identical code (A/A control intervals such as `agent-home.renderCpuMs` control/base 1.044 [0.832, 1.178]). Process CPU time is inflated by cache and SMT contention from neighbours, so it is less noisy than wall time but cannot confirm a 2% bound on this host in a practical number of runs. In practice, the deterministic test that rule 2 allows is what passes a structural task here; `pass` and `fail` from the interval remain the gate for any task that changes the work done.
    - Tests: `src/__tests__/bench-stats.test.ts` (3 tests); `render_reads_the_validator_facts_once` and `surface_core_reads_the_validator_facts_once_per_core` in `src/__tests__/validator-facts.test.tsx`. Checked against the pre-Task-1 `src/sdk/render.ts`: there it counts 3 reads per `render()` and 2 per `renderElements()` and fails; with Task 1 it counts 1 and 1.
    - `bun run check` (2026-11-17, load about 15): build, gen check, typecheck, lint and format pass. Tests: 1,833 pass, 4 skip, 1 fail. The failure was `proof/tests/mcp-capture.test.ts` `capture_returns_png_snapshot_and_errors_per_cell`, where every cell reported `limit-exceeded` "Render exceeded 100 ms". That is the preview runner's wall-clock render limit hit under host load; the file passes alone (10/10) and passed in the earlier full run. Finding for Task 7: a wall-clock limit inside `bun run check` is the same exposure plan 033 Task 9 removed for bench budgets. Recommended disposition: backlog; give the test a larger render limit or measure its budget in CPU time.
    - Bench files are outside the project typecheck (`tsconfig.json` includes `src`, `scripts`, `packages/*/src`). `bench/stats.ts` is covered through its test; `bench/ab.ts` passed an ad hoc `tsc` run. The other bench files carry type errors that were already there before this task and do not affect running them under Bun.

- [x] Task 2: Prove the three implementations of the tree rules agree (A2)
  - Acceptance Criteria:
    - Functional:
      - `src/__tests__/tree-rule-parity.test.ts` takes every `conformance/corpus/ui-tree/` case and a generated set (each node field removed, retyped and duplicated in turn; each structural rule broken once: unknown kind, undeclared event, wrong child kind, child counts under and over, duplicate id, a gated reference target, a missing reference) and runs each through `validateTree`, `renderElements` (the build pass) and `streamElements` fed whole.
      - For each case the three agree on accept or reject, and on the set of `(kind, last pointer segment)` pairs of the first error. Where the element JSON form cannot express a case (an explicit `id`, a `revision`), the case is listed in the test as "tree-only" with the reason.
      - At the three limits (nodes, depth, bytes) the three agree at the boundary value and one past it. `src/__tests__/byte-budget-agreement.test.ts` stays as the byte rule's detailed proof.
      - Any disagreement found is a defect: it is fixed in this task if the fix is local, or recorded as a finding with a failing-then-skipped test and the owner's disposition.
      - Spec §10 adds one sentence: the build pass, the stream build and the arrival walk are checked against each other by a named test.
    - Performance: n/a — a test.
    - Code Quality: the generator is in the test file; no production code is added for testing.
    - Security: law 2. The arrival walk is the authority; a tree the build pass emits and the walk rejects fails a render in production, and the reverse would let the SDK refuse what the spec allows. The test catches both.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/formats.md`.
    - Library Documentation to Check Before Implementation:
      - none; read `src/validate/tree.ts:244-454`, `src/sdk/render.ts:659-821`, `:138-253` (stream build), `src/sdk/elements.ts:168-242`.
    - Documentation Reviewed:
      - Spec §9, §10; `decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md` (why the build pass checks as it emits); plan 025 Task 3 (one owner for the byte budget); `src/__tests__/corpus.test.ts`, `sdk-stream.test.ts`.
    - Options Considered:
      - Merge the three walks into one — rejected: the build pass exists to meet 3 µs per node without a second walk (decision above); a merge is a performance project, not a parity fix.
      - Rely on the corpus alone — rejected: the corpus runs through `validateTree`; nothing runs the same cases through the other two.
    - Chosen Approach:
      - A differential test over the corpus plus generated breaks.
    - API Notes and Examples:
      ```ts
      for (const c of cases) expect(verdicts(c)).toEqual({ walk: c.expected, build: c.expected, stream: c.expected });
      ```
    - Files to Create/Edit:
      - `src/__tests__/tree-rule-parity.test.ts`: the test.
      - `docs/spec.md` §10: one sentence.
      - `src/validate/tree.ts`, `src/sdk/render.ts`, `src/sdk/stream.ts` (tentative — only to fix a disagreement the test finds).
  - Test Cases to Write:
    - `corpus_trees_get_one_verdict_from_all_three`: fails when any one implementation accepts what another rejects.
    - `generated_breaks_get_one_verdict_from_all_three`: one sub-test per rule, named after the rule.
    - `limits_agree_at_the_boundary`: nodes, depth and bytes at the limit and one past.
  - Notes (executed 2026-11-17):
    - Status: all criteria met. One defect fixed; four disagreements recorded as findings for the owner (F1–F4) and passed to Task 7.
    - `src/__tests__/tree-rule-parity.test.ts` (new). Each case is a `UiTree` plus the element JSON that builds it: the last id segment becomes the key, and `when`/`bind` travel as props. Each case runs through `validateTree`, `renderElements` and `streamElements` (fed whole). A verdict is accept, or the first error's kind and node field. Pointers are compared whole after mapping `/root/…` to the element path and dropping a trailing `/id` or `/kind`, which is stricter than the last segment. An accepted tree must also be rebuilt node for node by both builds.
      - `corpus_trees_get_one_verdict_from_all_three`: all 25 `ui-tree` corpus cases.
      - `generated_breaks_get_one_verdict_from_all_three`: for each node field (`kind`, `variant`, `props`, `style`, `events`, `children`, `when`, `bind`) it is removed, retyped, and its node written twice among its siblings (read "duplicated" as a duplicated node, since JSON has no duplicate members). Each structural rule is broken once: unknown kind, undeclared event, undeclared action, wrong child kind, children on a leaf, child counts under and over, duplicate id, invalid prop, a missing reference, a gated reference target and a target under a gated ancestor.
      - `tree_only_cases_are_rejected_by_the_walk`: id removed, retyped or not key-derived; props removed (the element form defaults them to `{}`); a revision that is not a positive integer (the build takes it as an option). Each has its reason in `treeOnly()`.
      - `limits_agree_at_the_boundary`: nodes and depth at the limit and one past; bytes at the exact `JSON.stringify` length and one less, on three trees.
      - 43 pass, 5 skipped (the strict checks of the findings below; each fails when enabled).
    - Defect fixed (`src/sdk/stream.ts`, `src/sdk/render.ts` `streamBuild`): the stream build had no source pointers. When it stopped at a node, depth or byte limit, or found a broken reference at the end, `streamElements` reported a key-path id (`/root/button`, `/root/text/props/describedBy`). `renderElements` reports `/children/0`, and the stream's documentation says `end()` returns what `renderElements` returns. Each stream frame now carries its JSON pointer: the reader passes the element's index in its parent's `children` array. The stream converts with that pointer and hands its pointer map to `streamBuild`. Kinds and messages are unchanged. CHANGELOG "Fixed" has an entry. No existing test pinned the old pointers; the SDK, template, corpus and byte-budget suites pass unmodified (493 tests).
    - Findings (strict test skipped in `known_differences_strict`; all three still reject, and the two builds agree with each other):
      | # | Finding | Recommended disposition |
      |---|---------|-------------------------|
      | F1 | Element JSON whose `kind` is missing or not a nonempty string is `invalid-prop` at `/…/kind` from the element conversion; the walk says `unknown-component`. `render()` (TSX) says `unknown-component` too, and spec §7.2 says `renderElements` uses `render()`'s error kinds. | execute (owner): change the conversion's kind to `unknown-component`. This is a public error-kind change, so it is outside plan 036. |
      | F2 | Element JSON whose `children` is not an array is `invalid-prop` at `/…/children`; the walk says `invalid-children`. `sdk-elements.test.ts:82` pins `invalid-prop`. | as F1, with that test updated. |
      | F3 | Too many children of a kind: all three say `invalid-children`, but the builds point at the node (`/root/menu` in `render()`) and the walk at its `children`. Fixing it in the build pass is local (a structure sink that appends `/children`), but `local-bindings.test.tsx:428` pins the node pointer and rule 1 forbids editing it, so the fix was reverted. | backlog: align the build's pointer with the walk and update that test, in a plan that may change pointers. |
      | F4 | Byte limit: same budget, same kind, different field. The walk counts in document order; the build counts a node's own fields when the node closes, after its children. | backlog: no change recommended; spec §10 could say the byte-limit pointer names where the count crossed. |
    - Rule 2 (stream fix only; the test and the reverted F3 change add no work): `bench/ab.ts` against a base commit `8a08a93` (the working tree with only this task's two source edits reversed; not on any branch). 12 rounds, load 17–32. `stream.agentHome.renderCpuMs` 1.050 [0.983, 1.109] and `streamCpuMs` 1.040 [0.962, 1.150], both **unusable**: the control/base intervals were [1.030, 1.206] and [1.028, 1.180]. The fix adds one string join per streamed element (its pointer). No deterministic test can show zero added work, so rule 2 sent it to the owner, who accepted the fix on 2026-11-17 (a contract fix whose cost is one short string per element, against the 3 µs-per-node budget).
    - Spec §10 gains the sentence naming the three implementations and the parity test.
    - `bun run check`: build, gen check, typecheck, lint and format pass. Tests: 1,867 pass, 8 skip, 10 fail at load 30–44 on 16 cores. One failure was F3's pinned pointer, which led to the revert. The others were 5 s / 10 s test timeouts (QuickJS, MCP capture, worker, `no-wall-clock-gate`) and the preview runner's 100 ms wall-clock render limit (`Render exceeded 100 ms`), which is the exposure Task 1a recorded. After the revert, the named suites plus `local-bindings.test.tsx` pass (470) apart from three template-runner tests that hit that same 100 ms limit. A second run at load 11–13: build, gen check, typecheck, lint and format pass; tests 1,876 pass, 9 skip, 1 fail. The failure was `proof/tests/mcp-capture.test.ts` `capture_returns_png_snapshot_and_errors_per_cell`, the wall-clock flake Task 1a recorded; the file passes alone (10/10).
    - Not committed: `src/sdk/render.ts`, `src/sdk/stream.ts`, `docs/spec.md`, `CHANGELOG.md` and this plan still hold uncommitted plan 033–035 changes, as for Task 1.

- [x] Task 3: Pass the open parent through the SDK build pass (A5)
  - Acceptance Criteria:
    - Functional:
      - `emit`, `children`, `emitFragment`, `openNode`, `kindOf` and `siblingSegment` in `src/sdk/render.ts` take the parent as one value (the `OpenNode` at `:737-758`, or a root value) instead of `parentId`, `parentKind`, `depth`, `siblings` and `out` separately. A keyed fragment gets its own small parent value, as its id scope and sibling set already differ (`:909-921`).
      - `checkChild`'s ten positional parameters (`:1192-1203`) become one context value plus the child and its key.
      - One comment block above `deepFrozen`, `mutableChildren` and `inputCopies` (`:37-39`) states what membership of each means and who may add to it; each statement has a test.
      - Every tree, error kind, pointer and message produced by `src/__tests__/sdk-*.test.*`, `template-*.test.ts`, `byte-budget-agreement.test.ts` and Task 2's parity test is unchanged.
    - Performance: `bench/render.bench.ts`, `bench/template.bench.ts` and `bench/stream-elements.bench.ts` within rule 2; the 3 µs-per-node budget holds. No allocation is added per node: the parent value is the `OpenNode` the pass already creates.
    - Code Quality: no function in the file takes more than five parameters; no behaviour moves between functions.
    - Security: law 2 — the checks are the same checks in the same order; Task 2's test is the guard.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/sdk.md`.
      - `safe-refactor`.
    - Library Documentation to Check Before Implementation:
      - none; run `graft callers emit --in src/sdk/`, `graft callers openNode`, `graft callers children --in src/sdk/` first.
    - Documentation Reviewed:
      - `src/sdk/render.ts:632-711`, `:761-821`, `:879-982`, `:1187-1215`; plan 025 Task 4 notes (the measured closure splits of `renderValue` and `emit`, and why the context is a plain object).
    - Options Considered:
      - A new `Frame` object allocated per `emit` call — rejected: an allocation per node on the hot path; plan 025 measured that class of change as a regression.
      - Split the file into several — rejected for this task: a move obscures the diff of the signature change; it can follow once the signatures are small.
    - Chosen Approach:
      - Reuse `OpenNode` as the parent value; add one root value.
    - API Notes and Examples:
      ```ts
      type Parent = Pick<OpenNode, "id" | "kind" | "depth" | "siblings" | "out"> | RootParent;
      function emit(ctx: RenderContext, element: Element, parent: Parent, requireKey: boolean): void;
      ```
    - Files to Create/Edit:
      - `src/sdk/render.ts`: the signatures and the comment block.
      - `src/__tests__/sdk-inputs.test.tsx`: a test per ownership statement where one is missing.
  - Test Cases to Write:
    - `caller_frozen_input_is_cached_by_identity_and_mutable_input_is_copied_each_render`: the two statements about `deepFrozen` and `inputCopies`.
    - `input_with_an_accessor_property_is_never_cached`: the statement about `mutableChildren` (`:1208-1212`).
    - The existing SDK suites, unmodified, are the behaviour proof.
  - Notes (executed 2026-11-17/18):
    - Status: all criteria met. Rule 2 passed through the deterministic test below. `bench/ab.ts` itself left every gated row inconclusive (details below).
    - `src/sdk/render.ts`, the parent value: a `Parent` type (`id`, `kind`, `depth`, `siblings`, `out`), which `OpenNode` satisfies. Its `depth` is the parent's own level, so children sit at `depth + 1` and the root value (`rootParent`, one per render or stream) has 0. `emit(ctx, element, parent, requireKey)`, `emitFragment(ctx, element, key, parent, requireKey)`, `openNode(ctx, element, key, parent, requireKey)`, `children(ctx, child, parent, staticChildren, nesting)`, `expand(ctx, start, parent)` and `siblingSegment(ctx, key, kind, parent, at)` take it. A keyed fragment builds its own parent value next to the `Set` it already made. The stream build's `open`/`whole` pass `parent ?? root`.
    - The parameter limit (at most five) applied to the whole file and needed these further changes, all with the same checks in the same order:
      - `children` drops `list`: it passes `staticChildren` down unchanged and works out `requireKey` from it and the nesting, using the same rule as before. A direct child needs no key. An entry of the element's own static list needs none either. Every other list entry does.
      - `openNode` looks up its source pointer itself, from the element it opens, and works out `at` once for `kindOf` and `siblingSegment`. Only element JSON and templates have source pointers, and neither contains composed components, so this is the same pointer as before. `emit` now looks up the started element's pointer only on the invalid-key error path. The lookups per node are unchanged; the count test below shows it.
      - The missing-key check moves from the top of `siblingSegment` into `openNode`, just before the `siblingSegment` call, matching `emitFragment`'s own check. It still runs at the same point in the sequence.
      - The node-local steps take the `OpenNode`: `classifyProps(ctx, element, definition, open)`, `authorReference(ctx, open, props, name, entry)` (the `$anchor`/reference-prop test is now `isAuthorReference`, called before it), `attachExpressions(ctx, open, props)`, `checkStructure(ctx, open)` and `countNode(ctx, open)`. `openNode` creates the `OpenNode` (and its record `{ id, kind }`) before classifying, so the record's key order and the allocations per valid node are unchanged. The only extra allocation is on the error path: a node that fails classification has already allocated its open value.
      - The data walk: `isJson(ctx, value, depth, copy)` and `isJsonContainer(ctx, value, depth, copy)`. The walk's start pointer and its composed owner become `ctx.dataPointer`/`ctx.dataOwner`, set by `checkInputs` and `expand`, and its ancestors are `ctx.ancestors`, which every caller already passed. The `reject` closure that was allocated on every `isJson` call is now the module function `rejectData`. `checkChild(level, child, key)` takes a `CopyLevel` (`ctx`, container, copy, depth, `immutable`), allocated once per container and only in copy mode. A walk that is not copying calls `isJson` directly. The entry loop is `walkEntries` (lint complexity).
      - `fail(ctx, kind, pointer, expected, nodeId?)` loses its `message` argument: the two `async-render` calls passed the default text, and `render-failed` goes through `failThrown`. That function still builds the thrown message before the stopped check, as the default argument did.
    - One comment block above the four ownership tables (`deepFrozen`, `mutableChildren`, `inputCopies`, `ownedCopies`) states what membership means and which function adds to each table.
    - Tests: `src/__tests__/sdk-inputs.test.tsx` gains `caller_frozen_input_is_cached_by_identity_and_mutable_input_is_copied_each_render` and `input_with_an_accessor_property_is_never_cached`, which covers an accessor at the top level and one nested under frozen containers. Both passed before the refactor and pass after it. New `src/__tests__/sdk-build-work.test.ts` `build_pass_work_per_render_is_unchanged` counts, for one steady-state agent-home render (679 nodes) through `render()` and through `renderElements`, the `WeakMap` gets and sets, the `WeakSet` has and add calls, the `Map` gets, the `Set` has calls and the `Set`s constructed. The base gives the same numbers; they were checked in a worktree of it. (`spyOn` on built-in prototypes records nothing in Bun 1.4.4, so the test wraps the methods itself.) No existing test was edited. Before the change the full suite gave 1,877 pass, 9 skip, 0 fail. After it, the named suites plus `local-bindings` and `corpus` gave 476 pass, 0 fail.
    - Rule 2. `bench/ab.ts` against base `2319bed` (the working tree with only `render.ts` reversed; a dangling commit not on any branch), 9 rounds per bench:
      - `render`, load 10–15: 1 pass, 16 inconclusive, 1 fail. The fail was `agent-home-elements.renderCpuMs` 1.239 [1.076, 1.342], but its control/base was 1.232 [0.882, 1.461].
      - `template`: `template.agentHome.renderCpuMs` 0.966 [0.889, 1.097] and `validateTemplate.agentHome.cpuMs` 1.043 [0.931, 1.298], both inconclusive.
      - `stream-elements`: `stream.agentHome.renderCpuMs` 0.894 [0.859, 1.052] and `streamCpuMs` 1.043 [0.853, 1.061], both inconclusive.
      - A rerun of `render` gated on `agent-home-elements.renderCpuMs` and `agent-home.renderCpuMs` (up to 27 rounds) ran while the load fell to about 5. `agent-home-elements.renderCpuMs` came out 0.999 [0.940, 1.069], inconclusive. Two rows it did not gate lay wholly above 1.02 with clean controls: `rack-module.renderCpuMs` 1.055 [1.035, 1.107] and `synthetic-queue.renderCpuMs` 1.024 [1.013, 1.087].
    - Those two rows were checked with an in-process A/B (scratch harness, not committed). It loads the base and head copies of `render-workloads.ts` in one process and alternates them, 31 paired CPU-time samples per workload, and runs both load orders to cancel a load-order bias of about 2% that its A/A run showed. Across three repeats on `rack-module`, `synthetic-queue` and `core-queue.full`, head/base averaged 1.013 (range 1.000–1.033), against 1.003 for A/A (range 0.984–1.023). That is about 1%, under the 2% bound.
    - The deterministic count test shows the lookups and `Set` constructions per render are unchanged; that is rule 2's pass for the inconclusive rows. What remains is property reads on the parent value in place of positional arguments. The parent comes in two shapes, the `OpenNode` and the root/fragment value. Giving them one shape (padding the root value to `OpenNode`'s fields) measured no clearer gain and needed an unchecked cast, so it was not kept. The 3 µs-per-node budget holds on the rows recorded from the gated rerun (head medians): agent-home elements 2.58, git-status 2.14, rack-module 2.01, synthetic-queue 2.24 µs/node. The rest of that run's table was not kept, and Task 7's `bun run bench` sweep records them all.
    - Finding for later rule-2 checks: an in-process interleaved A/B, run in both load orders, resolves about 1% at load around 5, where `bench/ab.ts` (separate processes) could not decide 2%. Recommended disposition: backlog; consider it for `bench/ab.ts` in Task 7's sweep.
    - No error kind, pointer or message changed. `api-stability.test.ts` passes, and the register is untouched.
    - `bun run check` (2026-11-18, load about 5): build, gen check, typecheck, lint and format pass. Tests: 1,880 pass, 9 skip, 0 fail.
    - Not committed: `src/sdk/render.ts` and `src/__tests__/sdk-inputs.test.tsx` still hold uncommitted plan 033–035 changes, as for Tasks 1 and 2.

- [x] Task 4: Move intent raising and context construction out of the surface core's closure (A5)
  - Acceptance Criteria:
    - Functional:
      - `raise` (`src/surface/core.ts:258-291`) and `context` (`:305-368`) become module-level functions over an explicit state object, the pattern `src/validate/tree.ts:35-58` and `src/sdk/render.ts:255-286` already use. `createSurfaceCore` keeps `accept`, `build`, `branch`, `writeLocal` and the snapshot.
      - Every snapshot, context identity, event and thrown error in `src/__tests__/surface-core.test.ts`, `local-bindings.test.tsx`, `action-results.test.tsx`, `react-intents.test.tsx` and `surface-dom-parity.test.ts` is unchanged.
    - Performance: `bench/selection.bench.ts` and the patched-update rows of `bench/streaming.bench.ts` within rule 2. Context construction allocates what it allocates today.
    - Code Quality: the state object lists every mutable binding the core holds (today twelve `let`s at `:206-214`); no function reads a binding it is not passed.
    - Security: law 4 — `setLocal` still never reaches `onIntent` (`:352-355`), and confirmation still gates only the host call; the named suites assert both.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/renderer.md`.
      - `safe-refactor`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Spec §11 (the surface core); `src/surface/core.ts:187-527`; plans 033 Tasks 5, 6 and 8 and 035 Task 4 (their edits land first).
    - Options Considered:
      - A class — rejected: the repository uses plain state objects and module functions for its walks; a class adds `this` to every callback an adapter holds.
      - Leave the closure — rejected: plan 037 adds compound intents and local reads to `emit`, inside a 340-line closure with twelve shared bindings.
    - Chosen Approach:
      - Extract the two largest self-contained parts; leave the reuse logic in place.
    - API Notes and Examples:
      ```ts
      function raise(core: CoreState, intent: Intent, origin: IntentOrigin, meta: EventMeta | undefined): Promise<void> | undefined;
      ```
    - Files to Create/Edit:
      - `src/surface/core.ts`: the extraction.
      - `src/surface/intents.ts` (tentative — only if the file reads better split; otherwise the functions stay in `core.ts`).
  - Test Cases to Write:
    - none new; the five named suites pass unmodified. If one must change, the task stops and records why.
  - Notes (executed 2026-11-18):
    - Status: all criteria met. Rule 2 passed through the deterministic count test below; `bench/ab.ts` left the gated rows inconclusive (details below).
    - `src/surface/core.ts`: a `CoreState` type holds the core's options, its per-catalog kind specs, the `domId` prefix, a `writeLocal` callback and every mutable binding the closure had: the twelve `let`s (`known`, `mounted`, `confirming`, `local`, `tree`, `valid`, `errors`, `root`, `snap`, `committed`, `checked`, `staged`), each documented. `createStagedCore` creates one per core.
      - Module-level functions over it: `facts(core)`, `spec(core, kind)`, `notify(options, event)`, `rejected(core, node, event, reason)`, `raise(core, intent, origin, meta)` and `context(core, node, props, items, fault?)`. Each reads only what it is passed.
      - `createStagedCore` keeps `bindingsOf`, `readsOf`, `writeLocal`, `branch`, `named`, the three `report*` functions, `build`, `snapshotOf`, `check`, `stage`, `prepare`, `commit` and the returned object. It also keeps the per-node tables (`failed`, `entries`, `compiled`, `subtreeReads`) and `listeners`, which only those functions use. They read and write the state as `core.*`.
      - `context`'s `emit` reaches `writeLocal` through `core.writeLocal`, because `writeLocal` rebuilds the tree and so stays with `build`. That is the one closure the state holds; it is created once per core, as before.
      - Re-entrancy is preserved. A host's `onEvent`, called from `check` or `build`, may re-enter `emit` or `accept`. So `stage` and `writeLocal` read `tree`, `root` and `local` from the state at each point of use, as the closure did, and `writeLocal` writes `local` before it rebuilds.
      - `src/surface/intents.ts` was not created: the functions read well in `core.ts`.
    - Tests: the five named suites (97 tests), plus `validator-facts` and `react-catalogs`, pass unmodified. New `src/__tests__/surface-core-work.test.ts` `surface_core_work_per_arrival_and_event_is_unchanged` counts, on a 102-node surface with a filter field, a confirmed action and 50 `when`-gated rows, the `WeakMap` gets and sets, `WeakSet` has, `Map` gets, `Set` has, `Set`s constructed and `Object.freeze` calls. It counts a first arrival, a new revision, the same input again, a `setLocal` event and a confirmed action. The frozen objects are each context's events, the snapshots, `local` and the intent origin, so the freeze count is the allocation check for context construction. It warms the module-level caches with a throwaway core first: unwarmed, the first arrival's counts depended on which test files ran before it. The base `core.ts` gives the same counts; the check swapped it in.
    - Rule 2, `bench/ab.ts` against base `17cd83f` (the working tree with only `core.ts` reversed; a dangling commit not on any branch):
      - `selection` (wall rows; 7 rounds, load 9–13): `certified.reactMs` 1.136 [1.040, 1.233] `fail`, but its A/A control/base was 1.174 [0.893, 1.455]. Head's median (1.30 ms) lay between base (1.15) and control. The row resolves in 0.05 ms steps, and several ungated rows had controls wholly above 1.02. A rerun gated on `certified.reactMs` and `rack.reactMs` (21 rounds, load 17→9) gave 1.000 [0.852, 1.077] and 1.000 [0.960, 1.174], both inconclusive. The other rows were within their controls.
      - `streaming --patches` (7 rounds, load 13–23): `reuseMs` 1.000 [0.500, 1.000] pass; `validationAndReactMs` 1.036 [0.844, 1.254] and `endToEndMs` 1.033 [0.828, 1.351] inconclusive, with controls 1.034 [0.700, 1.068] and 1.009 [0.672, 1.051].
      - In-process interleaved A/B (scratch harness, not committed, as Task 3 recommended): the base and head `core.ts` loaded side by side, each with its own validator. One sample is 5 cores × 40 arrivals of a 602-node tree with a `setLocal` and a `setState` event each. The harness took 31 paired CPU-time samples in alternating order, with an A/A control. Over three repeats at load 18–27, head/base medians were 1.005, 1.000 and 0.971; the A/A medians were 1.016, 1.007 and 0.987. No difference is measurable on the core's own path.
    - No error kind, pointer or message changed. `api-stability.test.ts` passes, and the register is untouched.
    - `bun run check` (2026-11-18, load 3–8): build, gen check, typecheck, lint and format pass. Tests: 1,881 pass, 9 skip, 0 fail. An earlier run failed only the new count test, on the cache-warming dependence described above.
    - Not committed: `src/surface/core.ts` still holds uncommitted plan 033–035 changes, as for Tasks 1–3.

- [x] Task 5: Split the template expression module by concern (A5)
  - Acceptance Criteria:
    - Functional:
      - `src/template/expr.ts` (1,155 lines) becomes a directory with the same exports re-exported from `src/template/expr.ts`: types, kinds and guards (`:45-249`); the eager operator table `EAGER` (`:251-532`); the special forms table `SPECIAL` and its helpers (`:534-958`); analysis, compilation and `evaluate` (`:960-1155`).
      - No function body changes. Every importer (`src/surface/bindings.ts:8`, `src/store/load.ts:7`, `src/template/render.ts`, `src/template/document.ts`, `src/validate/bindings.ts`) keeps its import path.
      - `src/__tests__/template-expr.test.ts`, `template-render.test.ts`, `template-document.test.ts`, `local-bindings.test.tsx` and `state-migration.test.ts` pass unmodified.
    - Performance: `bench/template.bench.ts` (2.1 µs per node) and `bench/selection.bench.ts` within rule 2. The validator bundle and the runner-kit bundle do not grow by more than 1% (`scripts/release/bundle-check.ts`).
    - Code Quality: each new file has one concern and no import cycle; `src/__tests__/portability.test.ts` covers the new files.
    - Security: law 1 depends on templates running no author code: the operator set is closed. The split changes no table entry; a test pins the operator names.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/sdk.md`.
      - `safe-refactor`.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2+ bundler: whether a directory split changes the emitted `dist/validator.bundle.js` or `runner-kit.bundle.js` (`scripts/validator-bundle.ts`, `scripts/runner-kit-bundle.ts`).
    - Documentation Reviewed:
      - Spec §7.6, §8 (the tree-expression allow-list); `docs/templates.md`; `src/validate/bindings.ts` (`TREE_EXPRESSION`); plan 028's design evidence.
    - Options Considered:
      - One file per operator — rejected: 38 files for functions of a few lines each.
      - Leave it — rejected only if the bundle or bench condition fails; then record it.
    - Chosen Approach:
      - Four files by concern behind the existing module path.
    - API Notes and Examples:
      ```ts
      // src/template/expr.ts
      export * from "./expr/analyze.ts";
      export { absent, ExprFailure, type Fn, type Frame } from "./expr/types.ts";
      ```
    - Files to Create/Edit:
      - `src/template/expr.ts`: re-exports.
      - `src/template/expr/types.ts`, `operators.ts`, `forms.ts`, `analyze.ts`: the moved code.
      - `scripts/build.ts` (tentative — only if the build lists files explicitly).
  - Test Cases to Write:
    - `template_operator_set_is_exactly_the_documented_one`: the keys of `EAGER` and `SPECIAL` equal the list in `docs/templates.md`. Fails if the move drops or duplicates an entry.
    - The named suites, unmodified.
  - Notes (executed 2026-11-18):
    - Status: all criteria met, with two layout deviations (where `analyze` and `absent` live, below) and two test edits that change only file paths. Rule 2 passed through an in-process A/B; `bench/ab.ts` left the gated row inconclusive.
    - `src/template/expr.ts` is now a header plus explicit re-exports of exactly the exports it had (`EXPR_LIMITS`, `absent`, `Absent`, `Frame`, `Fn`, `ExprFailure`, `Typed`, `itemsOf`, `OPERATORS`, `analyzeOperand`, `analyzeExpression`, `checkExpression`, `compileExpression`, `evaluate`). No importer changed its import path.
      - `expr/types.ts` (about 175 lines): bounds, `Frame`/`Fn`, `ExprFailure`, `fail`/`tick`/`charge`, `BAD`, operand kinds with their static (`kindProblem`) and runtime (`guard`) tests, and the shared types (`BOOL`, `NUM`, `INT`, `STR`, `lang`, `arrayOf`, `itemsOf`).
      - `expr/operators.ts`: `EAGER` with its `Eager` type and the helpers only it uses (`codePoints`, `finite`, `POW10`, `cap`, `compare`, `nonNegative`). The plan's range put those helpers in the types file; they moved with the one table that uses them.
      - `expr/forms.ts`: `SPECIAL` and its helpers, `OPERATORS`, and the walk itself: `analyze`, `objectConstructor`, `constant`, `literalProblem`, `limitsOf`.
      - `expr/analyze.ts`: the entry points: `analyzeOperand`, `analyzeExpression`, `checkExpression`, `compileExpression`, `evaluate`.
      - `absent` and `Absent` moved to `src/template/scope.ts`, next to the `"absent"` expression schema; `expr.ts` re-exports them. The first full `bun run check` failed `api-stability.test.ts`: "Declaration changed without a register entry: ./template evaluate". `scripts/release/api-surface.ts` inlines a non-exported helper type (here `absent`) only from a declaration file that also declares one of the subpath's exports. In `expr/types.d.ts` it dropped out of `evaluate`'s recorded declaration, although the type was unchanged. `scope.d.ts` is such a file (it declares `ExprType`), so the recorded entry is again byte-identical to the 0.3.0 baseline. Following helpers into every package declaration file instead was tried and rejected: it changed a dozen unrelated recorded entries. The reader and the register are untouched.
    - Deviation: `analyze` (the dispatcher) is in `forms.ts`, not `analyze.ts`. `analyze` calls `SPECIAL`, and every special form recurses through `sub` → `analyze`. Putting them in two files is an import cycle, which the code-quality criterion forbids, and breaking it by injection would change function bodies. The import graph is `types` ← `operators` ← `forms` ← `analyze` ← `expr.ts`, with no cycle.
    - No function body changed. A check (not committed) took the original file, removed imports, line comments and `export`, split it at top-level declarations and normalized whitespace. The four new files gave exactly the same set of declarations. Only items another file imports are exported from the new files. The header's "(plan 028, design T5–T13)" was dropped from `expr.ts`; the other plan-id comments moved unchanged, for Task 6.
    - Test edits (file paths only, the path counterpart of rule 1's moved import):
      - `template-expr.test.ts` `the_modules_use_no_dynamic_code_and_no_host_api` (law 1): it scanned `expr.ts` and `scope.ts` by name. Left as it was, it would have scanned only the re-export file, a silent weakening. It now also scans every `template/expr/*.ts` (by glob, so a later file is covered) and checks each import resolved to its `src/` path against the same allow-list, extended by `template/expr/*`.
      - `schemas.test.ts` `schema_publisher_detects_drift`: its list of files copied into a scratch tree gains the four new files.
    - New test `template_operator_set_is_exactly_the_documented_one` (in `template-expr.test.ts`): `OPERATORS` has no duplicate and, sorted, equals the operator names in the `docs/templates.md` operator table. `template-authoring.test.ts` already ties `OPERATORS` to the generated template schema.
    - `portability.test.ts` covers the new files through the subpath bundles; it passes unmodified. No change to `scripts/build.ts`: the build lists entry points, not files.
    - Bundles (`bun run build`): `dist/validator.bundle.js` 132,283 → 132,279 bytes, `dist/runner-kit.bundle.js` 140,115 → 140,116. The output differs only in minified names and declaration order.
    - Rule 2:
      - `bench/ab.ts` against base `41fc2e3` (the working tree with only `src/template/expr.ts` restored; a dangling commit not on any branch), `template` bench, 18 rounds, load 16 → 53: `template.agentHome.renderCpuMs` 1.093 [0.970, 1.150], control/base 1.069 [0.916, 1.137], inconclusive. `validateTemplate.agentHome.cpuMs` was missing on one side, because bench processes exited on their wall-clock budgets under that load.
      - In-process interleaved A/B (scratch harness, not committed, as in Tasks 3–4): head, base and a control (a second checkout of base) loaded in one process. 31 paired CPU-time samples per workload in alternating order, three repeats at load 22–32. Head/base: `renderTemplate` agent-home 0.964, 0.996, 1.002; compiled-expression evaluation (the bench's `template.expr` workload) 1.008, 1.007, 0.972; `compileExpression` 0.988, 0.997, 1.010. Each lies within the control's spread (0.888–1.008). The function bodies are identical and only module boundaries moved, so no work was added.
      - `selection` was not run. The browser loads bundled code, and the bundle holds the same code apart from minified names and declaration order.
      - The A/B ran before `absent` moved to `scope.ts`. That move relocates one constant declaration, and the bundle sizes did not change with it.
    - No error kind, pointer or message changed. `api-stability.test.ts` passes, and the register is untouched.
    - `bun run check` (2026-11-18):
      - First run, load about 28: typecheck failed on the new test (`m[1]` typed `string | undefined`), which was fixed.
      - Second run: build, gen check, typecheck, lint and format passed. Tests: 1,876 pass, 9 skip, 6 fail. One failure was the API-surface entry described above. The other five were load failures: 5 s timeouts in `portability` and `cli-mcp`, and wall-clock render limits in `cli-mcp` and `preview-libraries`. Those files pass alone (portability as part of the named suites, 355 pass; `cli-mcp` with `preview-libraries`, 92 pass).
      - Third run, after the `absent` move, load 19 → 34: build, gen check, typecheck, lint and format pass. Tests: 1,881 pass, 9 skip, 1 fail. The failure was `proof/tests/mcp-capture.test.ts` `capture_returns_png_snapshot_and_errors_per_cell` ("Render exceeded 100 ms"), the wall-clock flake Task 1a recorded; the file passes alone (10/10).
    - Not committed, as for Tasks 1–4: this plan file is untracked and holds the uncommitted notes of Tasks 1–4. The task's own source and test edits (`src/template/expr.ts`, `src/template/expr/`, `src/template/scope.ts`, `src/__tests__/template-expr.test.ts`, `src/__tests__/schemas.test.ts`) carry no plan 033–035 changes, so they can be committed by path whenever the earlier tasks are.

- [x] Task 6: State rules in source comments, not plan task ids (A6)
  - Acceptance Criteria:
    - Functional:
      - Every comment under `src/` and `packages/*/src/` (tests excluded) that cites a plan, a task or design id, or a decision by date (66 lines on 2026-11-15, by `grep -rnE "\b[Pp]lan [0-9]{3}\b|decision [0-9]{4}-[0-9]{2}-[0-9]{2}"`) states the rule itself and, where one exists, the spec section. Ids such as `B5.6`, `L3` and `A5` that only a plan's design file defines are replaced the same way.
      - A comment that says nothing once its id is removed is deleted.
      - No code changes.
    - Performance: n/a — comments.
    - Code Quality: a reader of a file needs only the file and the spec.
    - Security: n/a.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none; for each id, read the plan's design file it points to (`plans/evidence/029-interaction-design.md`, `028-template-design.md`, `030-host-pipeline-design.md`) to state the rule correctly.
    - Documentation Reviewed:
      - `src/__tests__/docs-wording.test.ts` (the existing wording gate); `AGENTS.md` ("Authority order": the spec is normative, plans are execution state).
    - Options Considered:
      - Keep the ids and add a lookup table — rejected: it adds a document a reader must open to understand a comment.
    - Chosen Approach:
      - Rewrite each comment; gate with a scan.
    - API Notes and Examples:
      ```ts
      // before: `setLocal` is the renderer's own (plan 029 L3): fill, check against the local schema, write, re-evaluate.
      // after:  `setLocal` is applied by the renderer and never sent to the host (spec §8): fill, check, write, re-evaluate.
      ```
    - Files to Create/Edit:
      - The files the grep lists (most in `src/formats/manifest.ts`, `src/template/document.ts`, `src/sdk/render.ts`, `src/template/schema.ts`, `src/surface/core.ts`, `src/sdk/gen.ts`, `src/formats/tree.ts`, `packages/runner-quickjs/src/`).
      - `src/__tests__/source-comments.test.ts` (new): the scan.
  - Test Cases to Write:
    - `source_comments_cite_no_plan_or_decision_ids`: fails on the two patterns above and on a bare design id (`\b[A-Z][0-9]+(\.[0-9]+)?\b` directly after "plan" or "design").
  - Notes (executed 2026-11-18):
    - Status: all criteria met. Comments only; no code changed.
    - Scope found: 94 comment lines in 41 files, more than the 66 the grep found on 2026-11-15. Plans 033–035 added some, and a wider scan also caught bare design ids with no "plan"/"design" before them (`(B4)`, `(B5.4)`, `(B7)`, `(T11)`), "(Task 4)", "(plan 022 F2)", "(spike finding F7)" and the two `decision 2026-11-08-2310` citations in `packages/runner-quickjs/src/`.
    - Rewrites, using the design files to state each rule:
      - Where the spec states the rule, the id became the spec section: plan 029 `B*`/`L*`/`A*` ids → §8 (the surface core's `onEvent`, "plan 029 T5", → §11); plan 028 template ids and `$embed` → §7.6; plan 030 Task 9 (libraries, linking) → §7.3, Task 10 (runner dependencies) and `liveframe:lib` header lines → §7.5, Task 8 (state migration) → §7.4; plan 028 Task 7 (streaming) → §7.2; plan 027 (`$ref`) → §9.
      - Where the id carried a rule the spec does not state, the comment now says it: the gated `refProps` target ("a hidden node has no DOM id"), the child-count rule for `when` children ("never pushes a parent outside its bounds"), the directive order ("`$let` cannot see `$each` names"), a component body's scope, intents' static fields, the `$embed` replacement, compatibility as "shape, not constraints", and `EXPR_LIMITS` (install bounds, `steps` as render fuel).
      - Where the comment said nothing once the id went, only the id was removed (for example "(design T18)", "(design T16)", "(plan 022 F2)", the directive and intent section headers in `document.ts`, and both QuickJS decision citations, whose rules were already written out).
      - `src/host/render.ts`'s step labels `R1`–`R11` were kept: they are defined in spec §7.7, not in a plan.
    - New `src/__tests__/source-comments.test.ts`:
      - `citation_check_finds_ids_in_comments_only` pins the matcher on samples.
      - `source_comments_cite_no_plan_or_decision_ids` scans every `.ts`/`.tsx` comment under `src/` and `packages/*/src/`, tests excluded. It fails on `plan NNN`, `decision YYYY-MM-DD`, a design id after "plan" or "design", and `Task N`. Bare ids in parentheses are not gated: `R1`–`R11` are spec ids, and the pattern would also match those.
    - One rewrite tripped `portability.test.ts` (`src_is_host_api_free`, `compiled_output_is_host_api_free`). That scan reads comments too, and "Errors point into the template document." matched `document.` as a DOM access. The comment now reads "Errors point at their place in the template." Finding for later comment edits: a comment under a host-free path must not end a sentence with `document`, `window`, `process`, `self` or the other names that scan lists.
    - `bun run check` (2026-11-18): the first run (load about 30) failed only those two portability tests (1,882 pass, 9 skip, 2 fail). After the fix, at load 3–11: build, gen check, typecheck, lint and format pass; tests 1,884 pass, 9 skip, 0 fail.
    - Not committed: as for Tasks 1–5, several edited files (`src/sdk/render.ts`, `src/surface/core.ts`, `src/sdk/stream.ts`, `packages/runner-quickjs/src/`) still hold uncommitted plan 033–035 changes.

- [x] Task 7: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: `plans/evidence/036-impact-analysis.md` records each of the twelve impact areas, or `None — <reason>`. Findings go to the owner in one table with a recommended disposition; `execute` findings become tasks above this one, `backlog` findings go to `plans/backlog.md` and Further Actions.
    - Performance: the sweep lists each task's before and after bench row.
    - Code Quality: the sweep confirms `register-0.3.1.json` is unchanged by this plan.
    - Security: the sweep confirms Task 2's parity test and Task 1's fail-closed test are in `bun run check`.
  - Approach:
    - Skills to Use:
      - `create-plan` — "Final task: impact analysis".
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `references/liveframe.md` §5.
    - Options Considered:
      - none beyond the standard sweep.
    - Chosen Approach:
      - One sweep after Task 6, then `graft build` so the graph matches the moved code.
    - API Notes and Examples:
      ```bash
      bun run check && bun run bench && graft build
      ```
    - Files to Create/Edit:
      - `plans/evidence/036-impact-analysis.md`; `.claude/skills/liveframe-execution/references/architecture.md` (the "Today" section, if file locations it names moved); `plans/backlog.md`; `roadmap.md` §3; this plan's Compromises Made and Further Actions.
  - Test Cases to Write:
    - none new.
  - Notes (executed 2026-11-18):
    - Status: the sweep is recorded in [`plans/evidence/036-impact-analysis.md`](evidence/036-impact-analysis.md): the twelve areas, twelve findings (F1–F12) with the owner's disposition ("approved", 2026-11-18, for the table as presented), and the verification runs. Every area is a `None — <reason>` or a recorded change; none is open.
    - Dispositions: F9 (a `CHANGELOG.md` Fixed line for the unified unknown-validator message) and F10 (`references/formats.md` named `buildFacts`, now `factsOf`) were executed in this task. F1–F8 went to `plans/backlog.md` as six entries (F1+F2, F3+F4, F5, F6, F7, F8). F12 is a "Measured" line on the existing P1 entry "Phase 1 performance gate: 3 µs per node". F11 is under Compromises Made. No finding became a task above this one.
    - Confirmed: `register-0.3.1.json` has no entry from this plan and its last write predates plan 035's impact analysis; `api-stability.test.ts` passes. The parity test, the three fail-closed tests and the comment scan run inside `bun run check` (they are under `src`; run alone: 66 pass, 5 skip, 0 fail).
    - `bun run check` (load 24–33): build, gen check, typecheck, lint, format pass; tests 1,884 pass, 9 skip, 0 fail. `bun run release:gate` passes. `graft build` done.
    - `bun run bench` did **not** pass. It stops at `validator.bench.ts` (load 31). Run script by script, at load 5.6–6.0 four fail narrowly on wall-clock rows (`validator`, `render`, `template`, `runner`); seven pass. Details and the reasons they are not attributed to this plan are in the evidence file §3. The Verification command `bun run bench` is therefore not met on this host; it needs a run at load under 3 (F12). No threshold was changed.
    - Not committed, as for Tasks 1–6: the working tree holds about 170 files of uncommitted plan 033–035 changes, and `roadmap.md`, `plans/backlog.md`, `CHANGELOG.md` and this plan carry those plans' edits too, so no commit can stage Task 7 alone by path. The owner chooses the commit strategy.
    - A stale editor diagnostic on `src/__tests__/validator-facts.test.tsx` (kind typed as `string`) appeared during the sweep; `tsc --noEmit` inside `bun run check` passed.

## Verification (whole plan)

- `bun run check`
- `bun run bench`
- `bun --conditions liveframe:source test src/__tests__/tree-rule-parity.test.ts src/__tests__/api-stability.test.ts src/__tests__/source-comments.test.ts`
- `bun run release:gate`
- `graft build`

## Compromises Made

- **Rule 2 was met by deterministic counts, not by `bench/ab.ts`.** On a host with load 10–50 the A/A control moved about ±15%, so every gated row stayed `inconclusive` or `unusable`. Tasks 1, 3, 4 and 5 passed on a count test that proves no added work plus a scratch in-process interleaved A/B (not committed). Task 2's stream pointer fix adds one short string per streamed element and is `unusable` by interval; the owner accepted it on 2026-11-17.
- **Four disagreements between the three tree-rule implementations remain** (F1–F4, Task 2). All three still reject every such case. Fixing F1/F2 changes public error kinds and F3 changes a pinned pointer, so rule 1 and "no public change" kept them out of this plan; their strict checks are skipped in `known_differences_strict`.
- **`bun run bench` was not green on this host** (Task 7, F12): four scripts failed wall-clock budgets at load 5–54. No threshold changed.
- **Task 5 moved `absent` to `src/template/scope.ts`** to keep the recorded `./template` API declarations identical (F7), and kept `analyze` in `forms.ts` to avoid an import cycle.
- **Tasks 1–6 and 7 are uncommitted** (F11): plans 033–035 are also uncommitted in the same files, so no commit can stage one task by path.

## Further Actions

- P3: align element JSON's error kinds with `render()` and the walk (F1, F2; 0.4.0, a public change). `plans/backlog.md`.
- P3: align the build pass's child-count pointer with the walk and document the byte-limit pointer (F3, F4). `plans/backlog.md`.
- P3: make `proof/tests/mcp-capture.test.ts` independent of host load (F5). `plans/backlog.md`.
- P3: let `bench/ab.ts` decide 2% with an in-process interleaved mode (F6). `plans/backlog.md`.
- P4: make the API-surface reader independent of which declaration file holds a helper type (F7). `plans/backlog.md`.
- P4: gate bare design ids in source comments (F8). `plans/backlog.md`.
- P1 (existing): run the whole `bun run bench` at load under 3 (F12). `plans/backlog.md`, "Phase 1 performance gate: 3 µs per node".
- Owner: choose how to commit plans 033–036 (F11).
