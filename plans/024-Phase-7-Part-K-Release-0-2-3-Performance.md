# Phase 7 Part K: Release 0.2.3 — Performance Fixes

Depends on: plan [023](023-Phase-7-Part-J-Release-0-2-3-Security-And-Defects.md) complete. It uses the scope decision, the 0.2.2 baseline and the empty `register-0.2.3.json` from 023 Task 1. Followed by plan [025](025-Phase-7-Part-L-Release-0-2-3-Simplification-And-Release.md). Findings R12–R16 and R25 are from 023's disposition table.

## Objectives

- Make performance claims reproducible on a loaded host. An interleaved A/B harness compares the checkout with a git ref, using paired runs, and every task below gates on it.
- Restore `<Surface>` node reuse for the documented inline-`fallback` pattern and for `diagnostics`. Make child sharing id-aligned, so an insert at the head of a list keeps reuse for its siblings.
- Cut whole-tree validation cost by walking each node's props once, not twice.
- Speed up the pure-JS SHA-256 and drop `canonicalJson`'s second pass. This benefits `pack()`, `verifyPackage()`, `loadPlacement()`, `renderKey()` and the hash cache.
- Measure the minor hot spots (R16, R25), and keep only the changes that measure.

## Expected Outcome

- `bench/ab.ts <ref> <bench>` reports paired medians and the ratio over N interleaved runs. `plans/evidence/024-baseline.md` records the full `bun run bench` at plan start, on a quiet host (1-minute load below 2), which closes the backlog entry "Re-run the full benchmark suite on a quiet host".
- With `fallback={<p>Unavailable</p>}` written inline and a parent that re-renders per arrival, an unchanged primitive renders **zero** times on a whole-tree arrival, as it does in 0.2.2 with a stable fallback. Replacing the fallback still updates every node that is currently showing it.
- Inserting a row at index 0 of a 50-row list reuses all 50 existing row elements. In 0.2.2 it reuses 0.
- The compiled whole-tree validator's median µs/node on `agent-home` falls by at least 15% against the plan-start commit (A/B, 9 paired runs), with errors identical on every corpus case and test.
- `sha256` is at least 2× faster per MB (A/B), and every hash vector is unchanged.
- Each R16/R25 candidate is either kept with a measured gain of at least 10% on its own micro-bench, or recorded as "no change" with the figure.
- Trees, errors, CSS bytes, hashes, patches and intents are byte-identical to 0.2.2. `register-0.2.3.json` stays `[]`.

This plan implements the performance part of the 0.2.3 review-fix release in roadmap Phase 7. Roadmap §1 requires that an optimisation is added only when a measurement calls for it. So every task starts from an A/B figure, and R16's items are explicitly allowed to end as "no change". Plan 023's compatibility rules 1–8 apply. None of these changes may be observable except through timing and React render counts, and the plan 022 decision (`decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md`) already classifies render counts as invisible to pure implementations. The verified-package cache option for `loadPlacement` (R15) is an API addition, so it moves to 0.3.0 through plan 025 Task 7. No spec section changes meaning. §10 (validation budgets) and §11 (renderer) are implemented faster, not differently.

## Tasks

- [x] Task 1: Add an interleaved A/B bench harness and record the quiet-host baseline
  - Acceptance Criteria:
    - Functional:
      - Each of `bench/validator.bench.ts`, `render.bench.ts`, `css.bench.ts` and `streaming.bench.ts` accepts `--json <file>` and writes `{ "<metric>": number }` for the figures it already prints: µs/node per subject, ms per operation, and so on. Without the flag, its output and gates are unchanged.
      - `bench/ab.ts <ref> <bench-file> [--runs 9] [--metric <name>…]` does the following:
        - creates a temporary `git worktree` at `<ref>` and runs `bun install --frozen-lockfile` in it;
        - alternates base and head runs of the same bench, N times each, starting with base;
        - prints, per metric, the base median, the head median, the median of the paired head/base ratios, and the load average before and after;
        - removes the worktree on exit, including on failure.
        It never fails on a budget. It reports.
      - `plans/evidence/024-baseline.md` records one full `timeout 600 bun run bench` at the plan's starting commit, with the `uptime` output, run only when the 1-minute load is below 2. If the host never gets quiet within the plan, the task records the attempts and every later task relies on A/B ratios alone. The backlog entry "Re-run the full benchmark suite on a quiet host" is closed or updated with a link.
    - Performance: tooling only. The benches' existing gates and budgets are unchanged.
    - Code Quality: one script under `bench/`, Bun-only, using `Bun.spawn` and `node:os` `loadavg`. No new dependency. It generalises `plans/evidence/021-task-13/interleave.ts`, which stays as evidence.
    - Security: n/a. Dev tooling, not published (`package.json` `files` lists `dist`, `schemas`, `conformance`, `docs`, `CHANGELOG.md` and `SECURITY.md` only).
    - Compatibility: n/a. Nothing published changes.
  - Approach:
    - Skills to Use:
      - `investigate-first`: noisy-host measurement discipline.
      - `find-docs`: Bun 1.4.2 `Bun.spawn` (`stdout`, `cwd`, `exited`).
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2: `Bun.spawn`, `Bun.file().json()`.
    - Documentation Reviewed:
      - `bench/*.bench.ts` (gates at `validator.bench.ts:53-59`); `plans/evidence/021-task-13/interleave.ts`; `plans/evidence/022-validator-reuse.md` and `022-release-readiness-review.md`, whose interleaved paired runs were run by hand; `plans/backlog.md` "Re-run the full benchmark suite on a quiet host" (P3).
    - Options Considered:
      - Keep running hand-made interleaved runs per task. Rejected: the method gets rewritten every time, and plan 022's release could not be re-proven under load.
      - Use the `mitata` or `tinybench` libraries. Rejected: a new dependency, and they do not interleave across git revisions.
    - Chosen Approach:
      - JSON output from the existing benches, plus one A/B driver.
    - API Notes and Examples:
      ```bash
      timeout 1800 bun bench/ab.ts HEAD~3 bench/validator.bench.ts --runs 9 --metric agent-home.compiledUsPerNode
      ```
    - Files to Create/Edit:
      - `bench/ab.ts`; `bench/validator.bench.ts`, `bench/render.bench.ts`, `bench/css.bench.ts`, `bench/streaming.bench.ts` (the `--json` flag)
      - `plans/evidence/024-baseline.md`; `plans/backlog.md`
  - Test Cases to Write:
    - `bench_json_flag_writes_the_printed_metrics` (in `src/__tests__/bench-json.test.ts`): runs `css.bench.ts --json`, the fastest bench, and checks that the keys match the printed lines. Fails if a bench ignores the flag.
    - The A/B driver itself is not unit-tested. Its first use in Task 2 is its proof, and the notes record the output.
  - Notes (executed 2026-11-03):
    - Added `bench/ab.ts` and a small shared `bench/metrics.ts` (the `--json` writer, written on process exit so a thrown gate still leaves the file). The plan said one script; the helper replaces four copies of the same ten lines. `validator`, `render`, `css` and `streaming` benches record their printed figures under stable keys (for example `agent-home.compiledUsPerNode`, `applyPatch.medianMs`, `agent-home.renderUsPerNode`, `validationAndReactMs`). Without `--json` the output and gates are unchanged.
    - Under `--json` the two `assert` gates in `validator.bench.ts` (`applyPatch` 0.5 ms, `diffTrees` 1.5 ms) report instead of throwing (`budget()` in `metrics.ts`). Otherwise a loaded host aborts the run before `compileValidator` is measured, and the driver gets no figures.
    - `ab.ts` runs head's `bench/` directory on both sides (copied into the base worktree), so only `src/` differs. A bench that needs a fixture newer than the ref fails on the base side with the run's output. It passes `--out` so the streaming bench cannot overwrite tracked evidence, and takes bench arguments after `--`.
    - `css.bench.ts` gained `--runs <n>` (default 1000). The unit test needs a 5-run smoke; the full run takes about 100 s at load 15.
    - Quiet-host baseline: not recorded. The host sat at load 13–15 from a QEMU VM holding about 400% CPU, so `plans/evidence/024-baseline.md` records the attempts and the cause, and every later task relies on A/B ratios. The backlog entry "Re-run the full benchmark suite on a quiet host" is updated with the link and stays open.
    - Driver proof: `bun bench/ab.ts HEAD~1 bench/css.bench.ts --runs 3 -- --runs 30` created and removed its worktree (`git worktree list` clean afterwards), alternated base first, and printed medians, paired ratios and load before/after. The ratios are noise (no `src/` change).
    - `bun run check` at load 14–17: build, gen:check, typecheck, lint and format pass; 1,024 tests pass, `bench_json_flag_writes_the_printed_metrics` among them, and 3 fail on wall-clock limits: `switch_changes_computed_styles_not_dom_structure: agent-home`, `in_process_warm_overhead_under_point_one_ms` (0.132 ms against 0.1) and `packs_stores_reloads_and_renders` (`Render exceeded 100 ms`). The first two are on plan 023's list of load failures. For the third, `phase-2-loop.test.ts` alternated between this tree and a clean `6886e4b` worktree at load 14 failed on both: clean 2 of 4 runs, this tree 2 of 4. This task changes no `src/` code, so the box is ticked on that evidence. The full green run on an idle host is still owed (backlog, plan 025 Task 8).
    - Finding for later tasks: `validator.bench.ts` sets `failed = true` for the `compileValidator` 0.25 ms gate after `if (failed) process.exitCode = 1` has already run, so that gate never fails the process. Not changed here (it would tighten a gate); worth fixing in plan 025 Task 8 when the quiet-host run is done.

- [x] Task 2: Keep `<Surface>` node reuse when `fallback` or `diagnostics` change identity (R12)
  - Acceptance Criteria:
    - Functional:
      - The node cache `contexts` (`src/react/renderer.tsx:291-292`) is keyed only on `accepted.validator`, `portal` and whether diagnostics are on (`diagnostics !== undefined`). It no longer keys on `fallback` or on the `diagnostics` array identity. The `root` memo's dependencies (`:412`) drop them too.
      - `Boundary` (`:51-81`) no longer takes a `fallback` prop. When it fails, it renders a small `<NodeFallback/>` function component that reads the current fallback from a `FallbackContext`, which `<Surface>` provides with the `fallback` prop as its value. Only failed nodes subscribe, so a new inline fallback re-renders only those, and React re-renders a context consumer even past memoised parents (React docs, `useContext` caveats).
      - The `data-lf-error` wrapper (`:395-399`) reads a `DiagnosedContext` whose value is a `Set` of erroring `nodeId`s. `<Surface>` memoises the set on its content (the sorted id list joined), so a new array with the same ids keeps the same context value, and no wrapper re-renders. A changed id set re-renders only the wrappers, not the primitives inside them.
      - The surface-level `fallback` (`:428`, shown when arrival fails) is unchanged.
      - `docs/renderer.md:142` changes from "Replacing the validator, fallback, portal container or diagnostics resets the node cache" to "Replacing the validator or portal container, or turning diagnostics on or off, resets the node cache". The guide example at `:109` stays inline, because it is now the fast path. Spec §11 does not state the reset rule, so it is unchanged.
    - Performance: on the LF-17 subject with an inline fallback and a parent re-render per arrival, whole-tree arrival validation plus React work is within 10% of the stable-fallback figure (A/B), and unchanged primitives render 0 times (`<Profiler>` count). Patch mode does not regress (A/B ratio ≤ 1.05).
    - Code Quality: two private contexts and one small component in `renderer.tsx`. No new export. The `biome-ignore` at `:291` is removed if the dependency list is now exhaustive; otherwise its reason is rewritten.
    - Security: law 2 is unchanged. Arrival validation still precedes every render. This changes only which React elements are reused.
    - Compatibility: rule 3 holds. No prop, default or output changes. Render counts fall, which plan 022's decision classifies as invisible to pure implementations. The `<Surface>` declaration is byte-identical, so the API gate stays empty.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (renderer reference); `find-docs` (React 19.3 context propagation).
    - Library Documentation to Check Before Implementation:
      - React 19.3 (fetched while planning, Context7 `/reactjs/react.dev`): `useContext` caveats ("Skipping re-renders with `memo` does not prevent the children receiving fresh context values") and `memo` ("Updating a memoized component using a context"). Class `static contextType` is not needed, because `Boundary` stops reading fallback.
    - Documentation Reviewed:
      - `src/react/renderer.tsx:51-81,217-312,394-412,420-432`; `docs/renderer.md:95-145`; plan 022 Task 3 notes (node reuse); `src/__tests__/react-surface.test.tsx` (reuse and fallback-retry tests).
    - Options Considered:
      - Read `fallback` through a ref. Rejected: a failed node would keep the old fallback until something else re-rendered it.
      - Tell hosts to memoise `fallback`. Rejected: it pushes a library detail onto every host, and the documented example would stay slow.
      - Make every `Boundary` a context consumer. Rejected: N class renders per arrival, when only failed nodes need the value.
    - Chosen Approach:
      - Context values read by leaf components that render only when needed.
    - API Notes and Examples:
      ```tsx
      const FallbackContext = createContext<ReactNode>(null);
      function NodeFallback() { return <>{useContext(FallbackContext)}</>; }
      // Boundary: return this.state.failed ? <NodeFallback /> : this.props.children;
      ```
    - Files to Create/Edit:
      - `src/react/renderer.tsx`; `docs/renderer.md`
      - `src/__tests__/react-surface.test.tsx` (added cases); `bench/streaming.bench.ts` (an `--inline-fallback` variant, if the A/B needs it)
  - Test Cases to Write:
    - `inline_fallback_keeps_node_reuse`: a parent that re-renders with `fallback={<p>x</p>}` per arrival, with an identical tree, shows 0 `<Profiler>` renders for unchanged primitives. It fails on 0.2.2's code.
    - `replacing_fallback_updates_failed_nodes`: a node that threw shows fallback A, then shows B after the prop changes, with no new tree.
    - `same_diagnostics_content_new_array_keeps_reuse` and `changed_diagnostics_marks_only_the_named_nodes`.
    - The existing fallback-retry test ("a node whose implementation threw still retries on the next arrival") passes unedited.
  - Notes (executed 2026-11-03):
    - `src/react/renderer.tsx`: `Boundary` lost its `fallback` prop and renders `<NodeFallback/>` (a `FallbackContext` consumer) when it fails. The error wrapper is a `Diagnosed` component reading a `DiagnosedContext` set of flagged node ids, memoised on the sorted ids (`JSON.stringify` of the list, so ids containing separators cannot collide). Both providers wrap the whole `<Surface>` output. The node cache keys on the validator, `portal` and `diagnostics !== undefined`; the `root` memo drops `fallback` and `diagnostics`. Both `biome-ignore` comments stay, with reasons rewritten (the dependency lists are still deliberately wider than what the callbacks read). The `<Surface>` declaration and the API gate are unchanged. `docs/renderer.md` states the new reset rule; the example at `:109` stays inline.
    - Tests are browser tests in `react-browser.test.tsx` and count implementation renders per kind, which matches what a `<Profiler>` counts. The three new cases fail on 0.2.2's renderer and pass now; `failed_node_retries_on_next_arrival` and `reused_nodes_follow_confirmation_fallback_and_diagnostics_changes` pass unedited. Fixture hooks added: `setInlineFallback`, and `presentation()` now resets the render counters.
    - A/B (`plans/evidence/024-surface-reuse.md`, base `6886e4b`, load 12–17 with a spike to 30): inline fallback, whole tree, arrival validation plus React 121.0 → 8.4 ms (ratio 0.068); inline fallback, patches 118.0 → 7.7 ms (0.065). Stable fallback does not regress: whole tree 1.012, patches 1.038 on 9 runs and 1.000 on a 15-run repeat. Inline against stable on head is 8.4 against 9.3 ms (whole tree), which is within the 10% target, though that one comparison is unpaired.
    - The bench needed two changes. `streaming.bench.ts --inline-fallback` is the new variant. Under `--json` a lost Chromium trace mark now skips only `layoutPaintMs`: the 0.2.2 renderer's slow inline run overflowed the trace buffer and made every metric disappear on the first A/B attempt.
    - Mistake worth knowing: a `biome check --write` on `src/__tests__` rewrote 48 unrelated files with lint fixes. I reverted all of them, reapplied only this task's edits and formatted with `biome format` on those files. Run `biome format`, not `check --write`, on shared directories.
    - `bun run check` at load 14–24: typecheck, lint and format pass, 1,028 tests pass and 2 fail on wall-clock limits: `validator_smoke_under_5us_per_node` (on plan 023's list of load failures) and `switch_under_budget_with_blur_through_surface`. The second mounts `<Surface>`, so it was compared with a clean `HEAD` worktree, alternating, three pairs at load 18–24: the clean tree also fails every time (21.1, 25.6, 24.4 ms against the 16.67 ms limit) and this tree reads 32, 23.9 and 29.5 ms. The two are the same order and both over budget, so no conclusion about a 5–10 ms difference can be drawn at this load. The quiet-host run (plan 025 Task 8) should include this test.

- [x] Task 3: Match previous children by id in `shareNodes` (R13)
  - Acceptance Criteria:
    - Functional:
      - `shareNode` (`src/react/share.ts:12-34`) finds a child's previous node by `id` among the previous parent's children, using a `Map` built once per parent that has at least 2 children. It no longer finds it by index (`:25`). The parent's own equality still requires the same child ids in the same order. A reorder or insert makes the parent unequal, but it still reuses each unchanged child.
      - Ids are unique within a validated tree (spec §10), so the lookup is unambiguous. `shareNodes` still runs only after arrival validation.
      - The failed-node blocking rule (`:9-11`, `:22`, `:27`) is unchanged.
    - Performance: the reuse pass on the 679-node LF-17 subject stays at or below 1.0 ms median, the plan 022 Task 3 target (A/B ratio ≤ 1.10 against plan start). Head insert into 50 rows reuses 50 row elements.
    - Code Quality: the change stays inside `share.ts`. No allocation for leaf nodes or single-child parents.
    - Security: law 2 is unchanged. Only validated nodes that deep-equal their previous value are reused.
    - Compatibility: invisible, apart from render counts. No declaration change.
  - Approach:
    - Skills to Use:
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - none. The React key reconciliation that `<Surface>` relies on is already id-keyed (`Boundary key={node.id}`, `renderer.tsx:394`).
    - Documentation Reviewed:
      - `src/react/share.ts`; `src/validate/patch.ts` (`diffTrees`, which matches by id); plan 022 Task 3 notes.
    - Options Considered:
      - A global id→node map for the previous tree. Rejected: it would reuse a node moved to another parent, and `Boundary` keys are per parent, so React would remount it anyway.
    - Chosen Approach:
      - A per-parent id map, consistent with `diffTrees` and React keys.
    - API Notes and Examples:
      ```ts
      const byId = previous?.children && previous.children.length > 1 ? new Map(previous.children.map((c) => [c.id, c])) : undefined;
      const prior = byId ? byId.get(child.id) : previous?.children?.[0]?.id === child.id ? previous.children[0] : undefined;
      ```
    - Files to Create/Edit:
      - `src/react/share.ts`; `src/__tests__/react-surface.test.tsx` (added cases)
  - Test Cases to Write:
    - `head_insert_reuses_every_existing_row`: 50 rows, then a new row at index 0. The 50 old row node objects are `===` in the shared tree. Fails with index alignment.
    - `reorder_reuses_children_but_not_the_parent`.
    - `failed_child_still_blocks_its_ancestors_after_a_move`.
  - Notes (executed 2026-11-03):
    - `src/react/share.ts` only. A child's previous node is the one at the same index when the ids match, and otherwise the one with its id in a `Map` of the previous parent's children, built lazily on the first mismatch. The plan's eager map (built for every parent with 2 or more children) measured a paired reuse-pass ratio of 1.5 on the LF-17 subject (7 runs, load 18–31), so the same-position fast path was added. After it, 9 runs gave base 0.9 ms, head 0.9 ms, ratio 1.10 (`bench/ab.ts HEAD bench/streaming.bench.ts --metric reuseMs`, load 19–32). That meets the ≤ 1.10 limit exactly, and the bench resolves only 0.1 ms, so treat it as "no measurable change". The 1.0 ms absolute target holds.
    - Finding that changes the plan's design: matching by id alone is not enough. The parent's equality used each child's own `equal` flag, so a reorder of unchanged children made the parent look equal and it was reused with the old order. The parent now also requires each child's previous node to sit at the same index (`prior !== before?.[index]`). `reorder_reuses_children_but_not_the_parent` caught this on the first run.
    - Tests added to `react-surface.test.tsx`: `head_insert_reuses_every_existing_row` (all 50 old row objects `===` in the shared tree), `reorder_reuses_children_but_not_the_parent`, `failed_child_still_blocks_its_ancestors_after_a_move`. The head-insert and reorder tests fail on the index-aligned code; they were run against the stashed original. The existing `reused_tree_deep_equals_the_arrival` passes unedited.
    - Gates at load 20–40: typecheck, lint (142 existing warnings) and format pass. Non-browser react tests pass (30). `react-browser.test.tsx` passes 37 of 38 with `--timeout 60000`; the one failure is `switch_under_budget_with_blur_through_surface`, the wall-clock test already recorded in Task 2. At the default 5 s timeout, `confirmation_is_single_flight…` times out under this load and every later browser test then fails on the broken page, so the full `bun run check` did not finish green (it was killed at its 900 s timeout). The full green run on an idle host is still owed (backlog, plan 025 Task 8).

- [ ] Task 4: Count node bytes in the prop-check pass (R14)
  - Acceptance Criteria:
    - Functional:
      - In `compileTree`'s `walk` (`src/validate/tree.ts:136-245`), each node's `props`, `style` and `events` values are traversed once. Today they are traversed twice, by the compiled prop checks and then by `walkJson` (`:142`) for JSON validity and byte counting. The budget check stays per node.
      - Choose between two designs in the task, after a 1-day spike, and record the choice and its A/B figures in the notes:
        - (a) the compiled schema checks receive the byte sink and count as they go;
        - (b) one JSON walk that checks JSON validity, counts bytes and calls the compiled leaf checks.
      - Errors are identical, as a list: the same `kind`, `pointer`, `nodeId`, `expected`, `message` and order, for every corpus case, every `tree.test.ts`, `compiled-schema.test.ts` and validator test, and the `validateTree` fuzz cases. A differential test runs the old and new walk side by side on 1,000 generated trees: valid ones, ones with byte overruns at random points, and ones with non-JSON values. It compares outputs exactly.
    - Performance: the compiled whole-tree µs/node on `agent-home` improves by at least 15% (median paired ratio ≤ 0.85, 9 runs, `bench/ab.ts`). Every subject in `validator.bench.ts` stays within its gate on the quiet-host run, and props-only checks do not regress (ratio ≤ 1.05). If (a) and (b) both miss 15%, keep the faster one only if it is at least 5% faster with identical errors. Otherwise revert, and record the figures as R14 "measured, no change".
    - Code Quality: the walk's complexity suppression (`:136`) is justified by the A/B figure in its comment, or removed if the walk now fits under 25. The old walk is kept only inside the differential test, as a frozen copy under `src/__tests__/fixtures/`.
    - Security: law 2. Every byte, depth and width bound still fails closed. The differential test covers overruns at every position class: id, kind, props key, props value, children.
    - Compatibility: rule 4. Errors and accepted trees are byte-identical. No declaration change.
  - Approach:
    - Skills to Use:
      - `investigate-first` (profile before choosing a design); `safe-refactor` (differential proof around a hot-path rewrite).
    - Library Documentation to Check Before Implementation:
      - none. Read `src/validate/bytes.ts` (`stringBytes`), `src/validate/structure.ts` (`walkJson`, `jsonScalarBytes`) and `src/validate/schema.ts` (`compileSchema` check signature).
    - Documentation Reviewed:
      - `src/validate/tree.ts:31-245`; the review's bench: compiled whole-tree 0.82–0.97× generic, while compiled props-only is 12–32× faster, so the walk dominates. Spec §10 (bounds and error rules).
    - Options Considered:
      - Incremental validation. Rejected: excluded by `decision-logs/2026-10-30-1928-tree-patch-format.md` until there is measured need.
      - Skip byte counting when the tree is "small". Rejected: the budget is a law-2 bound and must be exact.
    - Chosen Approach:
      - A single traversal, picked by measurement, with a differential proof.
    - API Notes and Examples:
      - n/a. Internal.
    - Files to Create/Edit:
      - `src/validate/tree.ts`; `src/validate/structure.ts`; `src/validate/schema.ts` (only in design a)
      - `src/__tests__/tree-walk-differential.test.ts`; `src/__tests__/fixtures/tree-walk-0.2.2.ts` (the frozen copy)
      - `plans/evidence/024-validator-walk.md`
  - Test Cases to Write:
    - `single_pass_walk_matches_0_2_2_on_generated_trees`: the differential test. It fails on any error-list difference.
    - Every existing validator test, corpus test and `validator-node.test.ts`, unedited.

- [ ] Task 5: Speed up SHA-256 and canonicalise in one pass (R15, patch-safe part)
  - Acceptance Criteria:
    - Functional:
      - `sha256` (`src/pack/hash.ts:94`) keeps its signature and output. Optimise the compression loop: a preallocated 64-word schedule, the eight working variables in locals, no per-block allocation, `>>> 0` only where needed, and `utf8()` (`:56`) writing into a preallocated buffer with an ASCII fast path.
      - `canonicalJson` (`:30`) validates JSON and serialises in one traversal. Today `validateJson` runs first and serialisation second. It throws the same `LiveframeFailure` errors, with the same pointers, for non-JSON input.
      - Every `conformance/hash/` vector, the corpus package hashes and `pack-hash.test.ts` pass unedited. A differential test compares `sha256` against `node:crypto` `createHash("sha256")` on 10,000 random byte arrays of length 0–4,096, plus 1 MB and 16 MB inputs. It is test-only: `node:crypto` never enters `src/pack`, and the portability test enforces that.
    - Performance: `sha256` throughput per MB improves by at least 2× (A/B). `packageHash` on a 512 KB package goes from about 9.9 ms to 5 ms or less. `renderKey` on the render bench's 33,899 B input does not regress.
    - Code Quality: the code stays in `hash.ts`. No WebCrypto: `crypto.subtle.digest` is async, so it cannot serve the synchronous `packageHash`/`renderKey` API.
    - Security: hashes key the module and validator caches (law 1). Correctness is proven against `node:crypto` and the vectors.
    - Compatibility: hashes are byte-identical (rule 5). No declaration change.
  - Approach:
    - Skills to Use:
      - `safe-refactor`.
    - Library Documentation to Check Before Implementation:
      - FIPS 180-4 §6.2 (SHA-256 computation); RFC 8785 (JCS), for the single-pass serialiser.
    - Documentation Reviewed:
      - `src/pack/hash.ts:1-180`; `src/formats/json.ts` (`validateJson`); the review measurement (9.9 ms per 512 KB pure-JS against 1.2 ms native); `src/store/load.ts:66` (`verifyPackage` on every load).
    - Options Considered:
      - `Bun.CryptoHasher` or `node:crypto`. Rejected: not host-API-free (`/pack` runs in browsers and in the validator bundle).
      - Add a verified-package cache to `loadPlacement`. Rejected for 0.2.3: it needs an option or a content-keyed cache. The option is an API addition, so it is deferred to 0.3.0 (plan 025 Task 7), and a content-keyed cache would itself have to hash.
    - Chosen Approach:
      - Make the pure-JS path fast, which helps every caller at once.
    - API Notes and Examples:
      - n/a. Same signatures.
    - Files to Create/Edit:
      - `src/pack/hash.ts`; `src/__tests__/pack-hash.test.ts` (added differential cases); `plans/evidence/024-sha256.md`
  - Test Cases to Write:
    - `sha256_matches_node_crypto_on_random_inputs`: fails on any compression-loop error.
    - `canonical_json_errors_unchanged_for_non_json`: `NaN`, `undefined`, a cycle, a lone surrogate and a non-plain object give the same errors as 0.2.2.
    - `hash_vectors_unchanged` (existing, unedited).

- [ ] Task 6: Measure the minor hot spots and keep only what measures (R16, R25)
  - Acceptance Criteria:
    - Functional:
      - Measure each candidate with a micro-bench in `plans/evidence/024-hot-spots.md`, using `bench/ab.ts` or an in-file paired loop. Keep it only if its own micro-bench improves by at least 10% and outputs are byte-identical. Otherwise revert it, and record the figure as "no change". The candidates:
        1. `validateJson` (`src/formats/json.ts:95`): replace `[Object.prototype, null].includes(Object.getPrototypeOf(value))` with two comparisons.
        2. `pack`'s AST `walk` (`src/pack/bundle.ts:26-44`): iterate child keys without building an array per node, and walk once per module instead of twice.
        3. Array schema checks (`src/validate/schema.ts:149-160`): stop iterating items once the result is already invalid **and** the sink is full. Errors are unchanged by construction.
        4. `sdk/render.ts:470` `/^on[A-Z]/`: use a char-code test.
        5. `themeCss` (`src/css/theme.ts:54-57`): reuse `validateCatalog`'s result for a catalog object it has already validated, through the content-checked cache plan 022 Task 4 built for `compileValidator`, if that applies. Never through bare identity, because plan 022 F2 showed that mutation breaks identity caches.
        6. `diffTrees` reorders (`src/validate/patch.ts:160-190`): replace `indexOf` and `splice` with a position map, only if the emitted ops are byte-identical on every `conformance/patch/` vector and on 1,000 generated reorders, checked differentially against the current implementation.
        7. R25: remove the identity layer in `src/runner-kit/cache.ts`, only if the worker host re-validation cost (`docs/packages.md`: 0.907 ms median) stays within 5% with the content-keyed LRU alone (`src/validate/compile.ts`). `cachedValidatorCount` keeps its meaning or is re-pointed. It is internal, not in the 0.2.1 or 0.2.2 baseline.
      - Every kept change has a test proving identical output, or is covered by the existing tests named in the evidence record.
    - Performance: this task is measurement. No bench gate may regress.
    - Code Quality: each kept change is minimal and local. An empty result ("all seven measured, none kept") is acceptable and is recorded.
    - Security: items 3 and 7 touch validation and cache paths. They keep fail-closed behaviour and the plan 022 mutation guard.
    - Compatibility: byte-identical outputs. No declaration change.
  - Approach:
    - Skills to Use:
      - `investigate-first`; `surgical-patch` for each kept item.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - The files and lines above; `plans/evidence/022-validator-reuse.md` (plan 022 F2, the mutation guard); `decision-logs/2026-10-30-1928-tree-patch-format.md`.
    - Options Considered:
      - Apply all seven without measuring. Rejected: roadmap §1 says measurement comes first, and items 5–7 carry correctness risk for uncertain gain.
    - Chosen Approach:
      - Measure, then keep or record.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - Tentative, per kept item: `src/formats/json.ts`, `src/pack/bundle.ts`, `src/validate/schema.ts`, `src/sdk/render.ts`, `src/css/theme.ts`, `src/validate/patch.ts`, `src/runner-kit/cache.ts`
      - `plans/evidence/024-hot-spots.md`; `src/__tests__/patch-differential.test.ts` (only if item 6 is kept)
  - Test Cases to Write:
    - Per kept item: an output-identity test (item 6: `diff_trees_ops_identical_on_generated_reorders`; item 7: `worker_revalidation_reuses_compiled_catalog_without_identity_cache`).

- [ ] Task 7: Analyze architectural impact and dispose of every finding
  - Sweep the impact areas in `.agents/skills/create-plan/references/liveframe.md` §5 against the work delivered. Record each area, or `None — <reason>`, in `plans/evidence/024-impact-analysis.md`. Present the findings with a recommended `execute`/`backlog` disposition, record the owner's answer, and execute or backlog each item. Confirm that `register-0.2.3.json` is still `[]`, and that `plans/evidence/024-baseline.md` and every task's A/B record carry load averages.

## Verification (whole plan)

- `timeout 900 bun run check`
- `timeout 600 bun run bench` (on a quiet host; otherwise record the load and rely on the A/B records)
- `timeout 1800 bun bench/ab.ts <plan-start-commit> bench/validator.bench.ts --runs 9`
- `timeout 1800 bun bench/ab.ts <plan-start-commit> bench/streaming.bench.ts --runs 9`
- `timeout 300 bun run release:gate`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
