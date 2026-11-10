# Phase 7 Part S: Release 0.3.0

Depends on: plans [026](026-Phase-7-Part-M-Release-0-3-0-Scope-Spec-And-Breaking-Changes.md)–[031](031-Phase-7-Part-R-Release-0-3-0-Isolated-Runner-Conformance-And-Starter.md) complete. Carries plan [025](025-Phase-7-Part-L-Release-0-2-3-Simplification-And-Release.md) Task 8 (quiet-host proof) and Task 10 (`next` dist-tag) unless the 0.3.0 scope decision (plan 026 Task 1) recorded them closed.

## Objectives

- Document 0.3.0 for outsiders and adopters: a complete migration guide, adopter notes for Synapta and Clay, the changelog and compatibility notes.
- Prove every acceptance criterion of plans 026–031 against the checkout, and run the full benchmark suite on a quiet host.
- Run the agent acceptance test on the new paths: template widgets, the isolated runner and the host pipeline.
- Publish `@arnilo/liveframe`, `@arnilo/liveframe-runner-quickjs` and `@arnilo/liveframe-starter` at `0.3.0-rc.1` under `next`, verify them from the registry, review readiness with the owner, then publish `0.3.0` under `latest` and `next` and verify again.

## Expected Outcome

- `docs/migration-0.3.md` has one entry per `removed`/`changed` register entry; `docs/adopters-0.3.md` maps W1–W9, L1–L2 and Q1–Q10 to shipped APIs and limitations; `CHANGELOG.md` 0.3.0 and `docs/compatibility.md` § 0.3.0 are complete.
- `plans/evidence/032-acceptance.md` lists every acceptance bullet of plans 026–031 with its proving test or command and result.
- `plans/evidence/032-bench.md` holds one clean sequential `bun run bench` on a quiet host (load average < 1.0 throughout), closing plan 025 Task 8's requirement.
- `plans/evidence/032-agent-acceptance.md` records an agent run using only the published docs.
- All three packages are on npm at `0.3.0` with provenance; `latest` and `next` both point at `0.3.0`; the archives pass the registry checks.

This plan implements the release step of roadmap Phase 7's 0.3.0. It changes no format or API, with one owner-approved exception (Task 4a: a host-supplied `libraries` option for preview sessions and `liveframe mcp`, found by Task 4); any defect found reopens the owning plan's task or adds a numbered follow-up task here before the release candidate. Publishing requires the owner's explicit go (Task 6).

## Tasks

- [x] Task 1: Write the migration guide, adopter notes, changelog and compatibility notes
  - Acceptance Criteria:
    - Functional:
      - `docs/migration-0.3.md`: every register entry with `change: "removed" | "changed"` has its heading, before/after, an executable sample and an adopter checklist; `migration-guide.test.ts` compiles every sample against the checkout and fails on a register entry without a heading (and vice versa).
      - `docs/adopters-0.3.md`: per item (the plan 026 scope table), the problem in general terms, the shipped API, the spec section and the limitation; a section for each of Synapta and Clay naming which of their open requests 0.3.0 closes.
      - `CHANGELOG.md` § 0.3.0 (Added / Changed / Removed / Fixed / Security), `docs/compatibility.md` § 0.3.0 (the 0.3.x promise, the new packages' versioning, the Bun-only runtime), `README.md` and `SECURITY.md` current.
      - `docs-wording` and `docs-links` pass; no doc calls a shipped API "planned".
    - Performance: n/a — documentation.
    - Code Quality: docs only; samples are tested.
    - Security: `docs/security.md` reviewed against the shipped trust model (templates, `quickjsRunner`, `setLocal`, the host pipeline).
  - Approach:
    - Skills to Use: `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `scripts/release/api/register-0.3.0.json`; every plan 026–031 Notes section; `docs/migration-0.2.md`, `docs/adopters-0.2.md` (patterns); `plans/requests/*`.
    - Options Considered: n/a.
    - Chosen Approach: the 0.2.0 release-documentation pattern (plan 020 Task 3).
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `docs/migration-0.3.md`; `docs/adopters-0.3.md`; `CHANGELOG.md`; `docs/compatibility.md`; `README.md`; `SECURITY.md`; `docs/security.md`; `src/__tests__/migration-guide.test.ts`
  - Test Cases to Write:
    - `every_break_has_a_migration_entry`; `every_migration_sample_compiles`.
  - Notes (executed 2026-11-09):
    - `docs/migration-0.3.md` already held an entry per break, added by plans 026–031; this task completed and tested it. The two-way check found one gap: "A tree for another catalog is refused as `catalog-mismatch`" had a heading but no register entry. The register keys on `(subpath, name)`, and `createRenderer` already carries the focus entry, so a second entry is "stale". The heading is now a `####` subsection of "Surfaces keep focus by default" (the entry that already names it in its `reason`), with its own before, after and checklist. Samples that did not parse (adjacent JSX, a redeclared `const`, a code fragment, JSX in a `ts` block) were repaired, and five breaking samples gained the `@arnilo/liveframe` imports they use. The introduction no longer says the guide "grows as tasks land".
    - `migration-guide.test.ts`: `every_break_has_a_migration_entry` (register to guide: heading, Before, After, a sample, Adopter checklist; guide to register: every heading under Breaking changes is named by a `removed`/`changed` entry) and `every_migration_sample_compiles`. The plan asked to "compile every sample against the checkout"; TypeScript 7 (the installed `typescript`) has no classic compiler API, so the test parses every `ts`/`tsx` sample with `Bun.Transpiler` and resolves every name imported from `@arnilo/liveframe[/subpath]` against `readApiSurface` of the checkout. Free names stand for the reader's variables and are not type-checked. The old `migration_0_3_guide_covers_registered_breaks` is replaced by the first test.
    - New `docs/adopters-0.3.md`: Synapta and Clay sections (what moves for Synapta; Clay's CL-17 closed, CL-14 carried to the release), then W1–W9, Q1–Q10, L1–L2 and O1–O2 as rows with problem, shipped API, spec section and limitation, and a "Not delivered" table. Limitations come from the plan 028–031 notes, not new claims. O1 and O2 are described as release steps: this task does not claim them done.
    - `CHANGELOG.md`: "Unreleased" became "0.3.0 — unreleased" (Task 7 dates it), with an introduction and Added / Changed / Removed / Fixed / Security. Plan 031's work (QuickJS runner, `runnerSuite`, starter, the executed guide, the workspace tooling) had no entry and now does; Bun-only, `catalog-mismatch`, `actions` in `WidgetProps`/`renderKey` and the semantics check are listed under Changed. Removed says nothing is removed from the API.
    - `docs/compatibility.md` § 0.3.0: what breaks (eight entries), what is additive, three packages one version with the `~0.3.0` peer, the 0.3.x promise (patches compare against a baseline generated from `v0.3.0`), Bun-only, limits. "Deferred to 0.3.0" is now "Deferred in 0.2.3, delivered in 0.3.0" (two inbound anchors updated). `README.md` (status, the two companion packages, guide links, runner list), `SECURITY.md` (isolated runners, `runnerSuite`, one version for three packages) and `docs/adopters-0.2.md` (the `deferred` register rows shipped) are current. `docs/security.md` gained "The host pipeline validates on the host", "Packages are frozen and libraries are pinned" and a "0.3.0 audit" against the four laws; the template, QuickJS, local-binding and streaming sections written by plans 028–031 were reviewed and kept.
    - Verification: `docs-links`, `docs-wording`, `docs-spec-structure`, `migration-guide` and `api-stability` pass. `timeout 900 bun run check` (build, gen, typecheck, lint, format all pass): 1745 pass, 4 skip, 11 fail, every failure a wall-clock gate (`verify_agent_home_under_20_ms`, `in_process_warm_overhead_under_point_one_ms`, `stream_trees_are_valid_and_grow`, the browser switch and attach tests, and others) while the load average was 19. Re-run at load 5, the nine files holding them pass but one (153 of 154 tests), and `in_process_warm_overhead_under_point_one_ms` passes when its file runs alone (12 of 12), the same pattern plans 030 and 031 recorded. Task 3's quiet-host run is where timing is proved.
    - Finding for Task 5 (amended below): plan 031 left "create the 0.3.0 API baseline per package" for this plan; `api-surface.ts` takes any package root, but no task here produced the two companion baselines.

- [x] Task 2: Prove every acceptance criterion of plans 026–031 against the checkout
  - Acceptance Criteria:
    - Functional: `plans/evidence/032-acceptance.md` has one row per acceptance bullet (plan, task, bullet, proving test or command, result). Every row is `pass` or names a follow-up task added above Task 5 and executed before the release candidate.
    - Performance: rows for every gated budget cite the bench output of Task 3.
    - Code Quality: the log is generated by `scripts/release/acceptance.ts` from plan files plus a mapping file, so it can be re-run.
    - Security: law-enforcement rows cite tests that fail when the law is broken.
  - Approach:
    - Skills to Use: `verify-and-stop`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: plan 020 Task 4 and `plans/evidence/020-request-acceptance.md` (pattern).
    - Options Considered: a manual checklist. Rejected: plan 025 Task 8 shows manual proof stalls; a script re-runs.
    - Chosen Approach: generated acceptance log.
    - API Notes and Examples:
      ```sh
      bun scripts/release/acceptance.ts --plans 026-031 --out plans/evidence/032-acceptance.md
      ```
    - Files to Create/Edit: `scripts/release/acceptance.ts`; `plans/evidence/032-acceptance-map.json`; `plans/evidence/032-acceptance.md`
  - Test Cases to Write:
    - `acceptance_script_lists_every_bullet` (unit test over a fixture plan).
  - Notes (executed 2026-11-09):
    - `scripts/release/acceptance.ts` lists every acceptance bullet of the plan files it is given (the Expected Outcome bullets and each task's Acceptance Criteria; a label with children contributes one row per child, a label with text one row) under the stable id `<plan>.<task>.<F|P|Q|S|C><n>`, and joins each to a proof in `plans/evidence/032-acceptance-map.json`. A proof is any mix of named tests (all run in one `bun test`, read from the JUnit report), named commands (`gen:check`, `build && release:gate`, `demo:test`, the getting-started guide, the starter and QuickJS package suites), document needles (`path :: text` must still occur) and bench needles (read from `plans/evidence/032-bench.md`). Exit code 1 for an unmapped row, a stale mapping key, a missing test or needle, or a failed proof.
    - Result: 426 rows over plans 026–031, **378 pass, 36 pending, 12 n/a, 0 fail, 0 unmapped**; the 374 named tests were all found and passed, and every command passed (`plans/evidence/032-acceptance.md`, regenerated by the command in the plan's Verification section). The 12 `n/a` rows are the bullets whose plan text begins "n/a" (no mapping needed). The 36 `pending` rows are performance bullets whose proof is a gated budget: each names `bench/<name>.bench.ts — pass` in the record Task 3 writes, so they turn `pass` when this script is re-run after Task 3 and are the "follow-up task above Task 5" the criterion allows.
    - **Requirement for Task 3:** `plans/evidence/032-bench.md` must contain one section per bench file whose heading reads `### bench/<name>.bench.ts — pass` (the sampler's wrapper writes `fail` and the exit status otherwise). The map names validator, render, css, streaming, template, stream-elements, host, pack-libraries and runner; `selection`, `store-load` and `hash` benches are not in `bun run bench`, so their rows cite the plan notes and evidence files instead.
    - Judgment calls: the unit tests are bullet-level proofs where a test exists; a bullet about a document, a register entry, a decision log or an impact review cites the file plus a needle that fails if the text goes away. Rows citing a wall-clock gate (for example `live_filter_50_rows_no_round_trip`, `switch_under_budget_with_blur`, `install_validation_of_agent_home_within_budget`) are proved here only as far as the host allows; their budget proof is Task 3.
    - Finding (host noise): the first full run took place while other projects held the host at load average 22–77 (a cargo test server, `tsc` in another repo, two QEMU VMs). 26 rows failed: three wall-clock gates (4.35 ms against 4 ms, 245 ms against 16.67 ms, 6.2 ms against 5 ms), QuickJS and starter suite timeouts, the demo run, and `mcp_pack_draft_template_inline` and `cli_prints_report`, which pass on their own. Each passed alone minutes later (QuickJS 35, starter 29, demo 67, the two named tests). The script now re-runs a test or command that missed once on its own and prints every re-run in the log ("second run"), so a wall-clock miss under load is visible but a defect that fails twice is still a failure. The two final runs needed no re-run (load average ≈ 4). Task 3 needs the host quiet (load < 1.0), which these other jobs prevent today; the owner will have to pause them.
    - Tests: `acceptance_script_lists_every_bullet` (fixture plan) and `acceptance_map_covers_every_bullet_of_plans_026_to_031` (real plans against the real map, no proof run), which fails on an unmapped bullet or a stale key. `timeout 900 bun run check` passes (build, gen, typecheck, lint, format, 1758 pass, 4 skip, 0 fail; load average ≈ 4).
    - Compromises: bullets were mapped by judgment, not extracted from the plans' own test lists, so a reviewer should treat the Evidence column as the claim and spot-check it; the generated log shortens bullet text to 150 characters (the id leads to the full text).

- [x] Task 3: Run the full benchmark suite on a quiet host (carries plan 025 Task 8)
  - Acceptance Criteria:
    - Functional: one sequential `bun run bench` across the workspace (validator, render, CSS, streaming, template, host, runner benches) on a host whose 1-minute load average stays below 1.0 for the whole run (sampled every 5 s and recorded). Every gated budget passes: ≤ 3 µs/node render, ≤ 1.5 µs/node validation share, span A ≤ 16.67 ms, the template, host and runner budgets set in plans 028, 030 and 031.
      - If a budget fails on a quiet host, the task stops: the owning plan's task is reopened; no threshold changes without an owner decision log.
      - Plan 025 Task 8 and the backlog entry "Re-run the full benchmark suite on a quiet host" are closed with a pointer to the record.
    - Performance: this task is the proof.
    - Code Quality: the load sampler is a small script reused from plan 024's harness.
    - Security: n/a.
  - Approach:
    - Skills to Use: `verify-and-stop`; `investigate-first` if a budget fails.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: plan 024 Task 1 (A/B harness); plan 025 Task 8 notes; `decision-logs/2026-11-04-2116-release-0-2-3-with-quiet-host-proof-open.md`.
    - Options Considered: release with the proof open again. Rejected unless the owner decides so explicitly in a decision log.
    - Chosen Approach: a quiet-host run with recorded load.
    - API Notes and Examples:
      ```sh
      bun scripts/bench-quiet.ts -- bun run bench > plans/evidence/032-bench.md
      ```
    - Files to Create/Edit: `scripts/bench-quiet.ts` (if not already present); `plans/evidence/032-bench.md`; `plans/025-…md` (Task 8 closure note); `plans/backlog.md`
  - Test Cases to Write: n/a — measurement task.
  - Notes (executed 2026-11-09; **closed by owner decision on partial proof**, [decision log](../decision-logs/2026-11-09-2106-close-plan-032-task-3-on-partial-quiet-host-proof.md)):
    - Wrote `scripts/bench-quiet.ts`. It runs each stage of the `bench` script in its own process (so an early failure no longer hides the host, pack-libraries and runner stages the `&&` chain never reached), samples the 1-minute load every 5 s, spins the CPU for 5 s before the first stage, and writes `plans/evidence/032-bench.md` with one `### bench/<name>.bench.ts — <result>` section per stage and, per stage, the CPU used by other processes. A stage reads `pass` only when it exited 0 and the load stayed below `--max-load` (default 1.0); otherwise `fail (exit N)` or `not quiet`, so the acceptance script's `— pass` needles cannot be satisfied by a loaded run. Command: `bun scripts/bench-quiet.ts --out plans/evidence/032-bench.md`.
    - First attempt (before the owner stopped the VM workload): the script waited and gave up; the host never read below 1.0 (clay builds, a memory bench, a podman build, two QEMU VMs).
    - Second attempt (VMs stopped): `plans/evidence/032-bench-attempt-not-quiet.md` is the record of the last run, kept apart from `032-bench.md` because the acceptance script reads that path and fails the repo check on a record that has no `— pass` headings; the canonical file is written only by a clean run. Every stage exited 0 except `pack-libraries` (below). No budget was changed. Other processes used 0.4–0.5 cores per stage (browsers, the agent sessions), 1.0 during `streaming`; `/proc/pressure/cpu` read 0.00 at 10, 60 and 300 s, i.e. no CPU contention.
    - **Finding 1, the load criterion cannot be met as written.** The benchmark is itself a runnable thread, and Bun adds helper threads, so the 1-minute load average reads 1.0–1.3 within a minute of any stage starting and 2.27 by the end of the run, on a host with zero CPU pressure. "Load average < 1.0 throughout" can therefore never hold, and every stage reads `not quiet`. A usable definition is CPU pressure (`/proc/pressure/cpu` some avg10 = 0) plus the other-process cores column; this is the owner's call, since it changes the criterion.
    - **Finding 2, a cold CPU clock fails the first validator measurement.** The host runs the `powersave` governor (`amd-pstate-epp`, `balance_power`). The first run after an idle gap measured `agent-home` at 2.18–2.23 µs/node against the 1.5 gate (compiled slower than the generic baseline, 0.62×); runs started back to back, or after a 3 s CPU spin, measured 1.25–1.37 (1 failure in 12 back-to-back batches' first run, then 11 passes; 2 of 2 after 45 s idle failed; 1 of 1 after idle plus a spin passed). The harness spin is the fix and is not a threshold change; in the last record the validator stage exited 0.
    - **Finding 3, a budget fails on the quiet host: `pack-libraries` "render with libraries within 5% of bundled".** Plan 030's gate (fastest of eleven 200-render batches per side) failed 4 of 13 runs at CPU pressure 0 (0.127 against 0.119 ms and others). The method was then changed (owner approved a method fix, no budget change; `bench/pack-libraries.bench.ts`): the comparison runs in seven fresh child processes, each timing 40 batches of 100 renders per package in A-B-B-A blocks and taking the median of each side, and the gate is the median of the seven linked/bundled ratios (limit unchanged at 1.05). Each step was chosen from measurement, not from its pass rate: the minimum hides garbage-collection cost and was noisy at 11 batches; alternating packages every batch inflated the linked side (24 of 30 runs failed, 1.03–1.19); one process scatters 0.87–1.09 from per-process JIT state, which no in-process statistic averages out (7 of 30 failed at a centre of 1.006).
    - **Result: the real overhead sat at the budget, and is now removed in code (a plan 030 runtime fix, 5% budget unchanged).** With the process-level gate the ratio centred on 1.04–1.05 (13 runs, 1.020–1.065, 5 failed). `inProcessRunner.render` collected and verified the library set (`src/preview/in-process.ts`), then `renderPackage` collected it again (`trusted`), each time building a `Map`, closures and string keys. `inProcessRunner.render` now passes the verified set to a new internal `renderModule`; `renderPackage` (the worker entry's call, with libraries the host already collected) still collects once, so the worker and the public surface are unchanged. After it: 30 of 30 runs pass, ratio 0.994–1.048, centre about 1.025. Headroom is thin (worst 1.048), so a rare noise failure is possible. Two earlier runs ended with a child render over the runner's default 100 ms limit (a host stall, not speed); the bench's measured renders now take `timeoutMs: 5000`, as `runner.bench.ts` does.
    - Verification of the runtime change: lint and typecheck clean; the preview, runner, dependency, host-dependent, conformance and API-stability test files pass 94 of 94 on three consecutive runs (one earlier run had one uncaptured failure that did not reproduce). The first full `bun run check` failed only `acceptance_map_covers_every_bullet_of_plans_026_to_031`, because of the not-clean record at the canonical path (see above); 1757 other tests passed.
    - **Quiet definition (owner, 2026-11-09): whole-host CPU below 10%, the benchmark included**, read from `/proc/stat` per stage and per 5 s (`--max-cpu 10`); the load average is recorded for information only (finding 1). A stage is `pass` only when it exited 0 and was quiet; a stage that failed while not quiet reads `not quiet`; exit codes 0 clean, 1 failed on a quiet host, 2 never quiet, 3 not quiet. The harness has one retry wrapper in the scratchpad only (not committed).
    - **Outcome: no clean full run.** The first run under the rule had other processes at 2.4–5.7 cores (cargo builds and a memory benchmark restarted mid-run); retry attempts 1 and 2 peaked at 23% and 57%. Best attempt: `plans/evidence/032-bench-attempt-best.md` (peak 23.0%) — `validator` (9.7%) and `streaming` (8.1%) quiet and passing every gate; the other seven stages not quiet (10.9–20.4%), `template` exit 1 at 14.4% (`templateRunner` 5.44% over `renderTemplate` against a 5% budget; same thin-margin ratio gate as `pack-libraries`, **unconfirmed on a quiet host**). Also kept: `plans/evidence/032-bench-attempt-not-quiet.md`. `plans/evidence/032-bench.md` is not written (the acceptance script reads that path), so the 36 bench-backed acceptance rows stay `pending`.
    - **Closed on partial proof by owner decision**, no budget changed. Plan 025 Task 8 and the backlog entry stay open with this pointer; Task 6's readiness review lists the pending rows and the `template` gate as deferred under the decision. To get the full proof later: `bun scripts/bench-quiet.ts --out plans/evidence/032-bench.md` on an idle host, then `bun scripts/release/acceptance.ts --plans 026-031 --out plans/evidence/032-acceptance.md`.
    - Files: `scripts/bench-quiet.ts`; `bench/pack-libraries.bench.ts`; `src/preview/in-process.ts` (plan 030 runtime fix); the two attempt records.

- [x] Task 4: Run the agent acceptance test on the 0.3.0 paths
  - Acceptance Criteria:
    - Functional: an agent with only the published docs and the `liveframe mcp` tools (configured with the starter catalog and `quickjsRunner`):
      1. writes a **template** widget with scenarios that reads a source and paginates, validates, renders and captures it;
      2. fixes a deliberately broken template from the static errors (an unknown data path and a type-mismatched binding);
      3. writes a **TSX** widget using a shared library package and local filtering, and runs it on `quickjsRunner`;
      4. fixes a layout mistake from a captured preview with `layout: true`;
      5. installs both through `/host` in the demo host, places them, and confirms an action shows pending then ok.
      The transcript, tool calls and outcome are recorded in `plans/evidence/032-agent-acceptance.md`.
    - Performance: n/a.
    - Code Quality: the scripted parts live in `scripts/agent-acceptance/`.
    - Security: law 4 — the transcript shows no MCP tool dispatched an action.
  - Approach:
    - Skills to Use: `liveframe-execution`; `run` (demo host).
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: plan 020 Task 7 and `plans/evidence/020-agent-acceptance.md`.
    - Options Considered: n/a.
    - Chosen Approach: the established agent acceptance pattern on the new paths.
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `plans/evidence/032-agent-acceptance.md`; `scripts/agent-acceptance/*`
  - Test Cases to Write: n/a — acceptance run.
  - Notes (executed 2026-11-09; record `plans/evidence/032-agent-acceptance.md`; **step 3's library-in-preview half is carried by Task 4a**):
    - A fresh subagent (no inherited conversation; the owner chose a subagent when asked) got only the installed README and docs of the three packages, a running host and the `liveframe mcp` tools, with a "use only these files" brief. `scripts/agent-acceptance/prepare.ts` builds that host outside the repository from the three packed archives: the demo host's pipeline with the starter catalog, themes, design system and implementations, `quickjsRunner()` for rendering and for the MCP config, and the getting-started guide's template widget as the preview draft. `scripts/agent-acceptance/mcp-session.ts` lets an agent that cannot register an MCP server run ordered tool calls in one `liveframe mcp` session and logs every call to `transcript.jsonl`. The deliberately broken template yields exactly the two intended static errors (verified before the run).
    - Results: step 1 (template `task-list` with a source, pagination, three scenarios) passed in two iterations; step 2 (the broken template fixed from the `invalid-prop` and `unknown-name` errors alone) in one; step 4 (`layout: true` flagged an overflowing filter field, fixed, recaptured clean at 360 and 768) passed, but the widget had no mistake of its own, so the agent introduced one and said so; step 5 passed (`POST /widgets` 201 for the library and both widgets, placements 200, surfaces 200, a `tasks.claim` intent answered as an ndjson stream with two frames 637 ms apart and a dependent placement's frame, then "claimed by ada" on a re-read). Law 4: the 42 recorded calls are the seven authoring tools only; no tool installs, places or dispatches.
    - **Step 3 found a capability gap (F1).** `createPreview`, `createAuthoring` and `liveframe mcp` accept no library packages, so a TSX widget that imports `liveframe:lib/…` cannot be packed or previewed through the tools (`not-found: No library package was supplied`); four attempts to supply one failed. The host path works: the installed widget rendered on the host's QuickJS runner with the library resolved. The agent previewed a variant with the library bundled in. The owner answered "Fix in 0.3.0", so Task 4a is added and must finish before Task 5.
    - Fixed here: `docs/sdk.md` "Public exports" omitted `ex`, `local`, `self` and five types (F6). Findings carried to 4a: the library-install route and the intent frame stream are undocumented outside the demo host README (F2, F4). Backlogged for the readiness review to approve: `missing-key` diagnostic, the `"./ui.gen"` wording, the demo-agent intent-route line, the `actions` naming, an empty pager's stack gap (F3, F4 naming, F7, F9, F10). The agent saw nothing forbidden; five minutes ten seconds from start to report.
    - Compromises: the agent was a subagent of this session and shares the author's model family; the archives are installed from `file:` tarballs at the checkout version (Task 5 repeats this against the registry); the local filter was proved by tree shape, with the browser proof in the demo host's `orchestration.test.ts`.

- [x] Task 4a: Let a preview session and `liveframe mcp` take library packages (follow-up from Task 4 finding F1; owner approved on 2026-11-09)
  - Acceptance Criteria:
    - Functional:
      - `createPreview`, `createAuthoring` and `AuthoringConfig` take an optional `libraries: readonly WidgetPackage[]`, supplied by the host and nothing else: no tool installs, uploads or names a library (law 4; the agent still cannot add one). A draft importing `liveframe:lib/<id>@<version>` packs and renders through `pack_draft`, `render_scenarios` and `capture_preview` when the host supplied that library, on both reference runners and `quickjsRunner`.
      - A missing library is still `not-found` and a library whose hash differs from the pin is still `hash-mismatch`, with the pointers `pack()` and `renderPlacement` already give; the agent-facing message names the host's side ("the host did not supply this library"), so the agent does not hunt for a tool argument.
      - `list_capabilities` or a new read-only `list_libraries` tool shows the agent which libraries the host supplied (id, version, exports), so it need not guess; the decision between the two is recorded in the task notes.
      - `docs/mcp.md`, `docs/preview.md`, `docs/packages.md` and `docs/demo-agent.md` say how a host supplies libraries to a session and how the demo host installs one (`POST /widgets` with a library draft; widgets installed after it resolve it), and describe the demo host's intent answer (ndjson frames, how `pending` and the result appear). Spec §13 and the migration register (`scripts/release/api/register-0.3.0.json`, an `added` entry) are updated in the same task.
      - Fresh agent re-run: step 3 of Task 4 (a TSX widget importing a shared library, local filter, on `quickjsRunner`) passes through the MCP tools with the library supplied by the operator's config; the new transcript is appended to `plans/evidence/032-agent-acceptance.md`.
    - Performance: n/a; a session with no libraries is unchanged (`collectLibraries` returns at once for a package with no dependencies).
    - Code Quality: one dependency loader (`collectLibraries`) stays the only place libraries are collected; no copy of its logic in the authoring layer.
    - Security: the libraries reach only the runner (law 1); the agent can read their ids, versions and exports but cannot add, change or remove one; an agent-supplied `libraries` argument to `pack_draft` is refused like any unknown field.
  - Approach:
    - Skills to Use: `liveframe-execution` (reference `preview.md`, `storage.md`); `create-plan`.
    - Documentation Reviewed: `src/preview/dependencies.ts` (`collectLibraries`), `src/preview/in-process.ts`, `src/pack/libraries.ts`, `docs/packages.md` (libraries), `plans/evidence/032-agent-acceptance.md` F1, F2, F4.
    - Chosen Approach: pass the host's library set through `createPreview` to the runner call it already makes, the way `renderPlacement` passes the placement's libraries; no new package surface for the agent.
    - Files to Create/Edit: `src/preview/*`, `src/authoring/*`, `src/cli/*` (config), the four docs above, `docs/spec.md` §13, `scripts/release/api/register-0.3.0.json`, `scripts/agent-acceptance/prepare.ts` (supply the demo library from the operator's config), the API baseline, tests under `src/__tests__/`.
  - Test Cases to Write:
    - `preview_session_packs_a_draft_that_imports_a_supplied_library`; `preview_session_refuses_an_unsupplied_library_as_not_found`; `preview_session_refuses_a_library_with_the_wrong_hash`; `authoring_pack_draft_rejects_a_libraries_argument`; `mcp_tools_render_a_library_widget_on_quickjs`; `mcp_lists_the_libraries_the_host_supplied`.
  - Notes (executed 2026-11-09; fresh-agent record appended to `plans/evidence/032-agent-acceptance.md`):
    - `createPreview({ libraries })` validates the list on creation (`indexLibraries`: shape, code packages only, one package per `id@version`; invalid entries throw `LiveframeFailure` at `/libraries/<i>`), freezes a copy, packs drafts with it (`pack()`'s `libraries`) and hands the same list to `runner.render` as `RunnerOptions.libraries`. No library logic was copied: `pack()` and `collectLibraries` stay the only places libraries are resolved. `update()` appends "the host did not supply this library to this session" to the packer's `not-found` errors (every `not-found` from `pack()` is a missing library); `hash-mismatch` comes unchanged from the packer, and from the runner at render. `createAuthoring({ libraries })` forwards it to the session and to the `outcomes: true` render, which calls the runner directly. `AuthoringConfig.libraries` reaches it through `liveframe mcp` unchanged (invalid list: the CLI prints the errors and exits 2).
    - Decision: a **new read-only tool `list_libraries`** (and `createAuthoring().listLibraries()`, type `LibrarySummary`: `id`, `version`, `hash`, `exports`, `specifier`, `description?`), not an extension of `list_capabilities`: that tool's output is the capabilities document and its `outputSchema` is the published schema, so mixing libraries into it would break its format. The cost is a ninth tool: spec §13, `docs/mcp.md`, README, the pinned `tools/list` tests (`cli-mcp`, `mcp-guide`, `proof/tests/mcp-agent-loop`), the archive gate's expected list and the skill references say nine. It is always registered (empty list when the host supplied none) so `tools/list` does not depend on config.
    - Law 4: `pack_draft` refuses an agent-supplied `libraries` field by name (`invalid-document` at `/libraries`; a `{ dir, libraries }` call is routed to that check too) instead of ignoring it. The agent can read ids, versions and exports and nothing else.
    - Register: `LibrarySummary` `added`; `createPreview`, `AuthoringConfig`, `AuthoringOptions` and `createAuthoring` keep their `widened` entries with the reason extended (one entry per `(subpath, name)`); the new host action is in `docs/migration-0.3.md` ("Libraries in preview sessions and `liveframe mcp`"), which `register_host_actions_appear_in_adopter_notes` checks. Docs: `mcp.md` (new "Libraries" section, tables), `preview.md`, `packages.md`, `demo-agent.md` (the library install route and the intent answer: ndjson frames, `pending` then the result, dependents; F2, F4), spec §13, CHANGELOG, `adopters-0.3.md` W6a. The demo host's `mcp.config.ts` supplies its `acme.cards` library.
    - Tests: `preview-libraries.test.ts` (`preview_session_packs_a_draft_that_imports_a_supplied_library` on `inProcessRunner` and `workerRunner`, `…refuses_an_unsupplied_library_as_not_found`, `…refuses_a_library_with_the_wrong_hash`, `…rejects_malformed_libraries_on_creation`, `…copies_its_library_list`, `authoring_pack_draft_rejects_a_libraries_argument`, `authoring_renders_and_lists_the_libraries_the_host_supplied`); `cli-mcp.test.ts` (`mcp_lists_the_libraries_the_host_supplied`, `mcp_tools_pack_and_render_a_supplied_library` over stdio); `packages/runner-quickjs/src/__tests__/authoring-libraries.test.ts` (`mcp_tools_render_a_library_widget_on_quickjs`, through `createAuthoring`, since the root package tests do not load the QuickJS package); the demo host's MCP test lists and packs against its library. Fixtures: `src/__tests__/fixtures/libraries.ts`, `mcp-libraries.config.ts`. Run tests with `bun test --conditions liveframe:source` (as `bun run test` does): without the condition a widget loads the SDK from `dist` and every widget test reports "Expected one SDK element".
    - Fresh agent re-run: `prepare.ts` now supplies and installs an operator library (`scripts/agent-acceptance/library/rows`). The agent found it through `list_libraries`, packed, rendered and captured on `quickjsRunner` with no library error, and installed and placed the widget through the host (hashes equal); 17 calls, none dispatching. Findings G1–G4 (a library's prop contract is not discoverable; `when`/`bind` are dropped on composed components) are backlogged for the readiness review.
    - Verification: `timeout 900 bun run check`: build, gen, typecheck, lint and format pass; 1766 tests pass, and the two that failed (the pinned tool lists in `mcp-guide` and `mcp-agent-loop`) pass after the fix, run alone; `bun run demo:test` 67 pass. Not re-run whole after that last fix.

- [x] Task 5: Publish `0.3.0-rc.1` of all three packages under `next` and verify from the registry (carries plan 025 Task 10)
  - Acceptance Criteria:
    - Functional:
      - Bump all three packages to `0.3.0-rc.1` in one commit, widening the two packages' peer range on `@arnilo/liveframe` from `~0.3.0` to `~0.3.0-0` first (`~0.3.0` does not match a prerelease, so npm would refuse to install the rc packages together; plan 031 Task 2 finding); tag `v0.3.0-rc.1`; the protected publish workflow publishes all three under `next` with provenance.
      - From a fresh directory: install each package from the registry, run the archive checks (exports, no sources/tests/proof, no WebAssembly in the root package), the API surface comparison against the checkout, `getting-started-test.ts` against the registry archives, and `demo:test` against them.
      - `npm view` shows `next` = `0.3.0-rc.1` for all three; if dist-tag automation fails (the 0.2.3 failure), the owner repairs it on npmjs.com and the repair is recorded; plan 025 Task 10 closes.
      - `plans/evidence/032-release-candidate.md` records commands and outputs.
      - Before the rc, generate a 0.3.0 API baseline for each companion package with `api-surface.ts` (plan 031 hand-off), so 0.3.x patches have a gate for all three; record the files in the same commit as the version bump.
    - Performance: n/a.
    - Code Quality: no manual publish; CI only.
    - Security: provenance verified for each package (`npm audit signatures` or the registry attestation API).
  - Approach:
    - Skills to Use: `liveframe-execution`; `verify-and-stop`.
    - Library Documentation to Check Before Implementation: npm trusted publishing and dist-tags (current npm major) via `find-docs`.
    - Documentation Reviewed: plan 025 Task 9 notes; `plans/evidence/025-release.md`; `.github/workflows/publish.yml`.
    - Options Considered: n/a.
    - Chosen Approach: the established release-candidate pattern, extended to three packages.
    - API Notes and Examples:
      ```sh
      git tag v0.3.0-rc.1 && git push origin v0.3.0-rc.1   # owner runs, or authorises the push
      ```
    - Files to Create/Edit: `package.json` (×3 versions); `plans/evidence/032-release-candidate.md`; `plans/025-…md` (Task 10 closure note)
  - Test Cases to Write: n/a — release verification.
  - Notes (prepared 2026-11-10, publication pending):
    - Preparation is complete on commit `af97604`: all three packages at `0.3.0-rc.1`, both companions peering on `~0.3.0-0` (a `~0.3.0` range does not match a prerelease), and the 0.3.0 API baseline per companion (plan 031 hand-off) with a test that fails on any later declaration change. `readApiSurface` now hashes an absent `schemas/`/`conformance/` directory as empty, so it accepts a package that ships none; the core comparison is unchanged because its baseline holds the keys. Companion READMEs and `docs/compatibility.md` say `~0.3.0-0`.
    - Also committed before the tag: plan 032 Task 3's code was never committed (the quiet-host sampler, the process-level `pack-libraries` method and the plan 030 runtime fix it found) — `536867c`. A release tag must not go out without it.
    - Local gates on `af97604` all pass: `bun run check` (1769 pass, 4 skip, 0 fail, 478.85 s), `release:gate` (15/2/2 steps), peer floors (React 119, Playwright 23, MCP 87), `demo:test` 67, production and bundled audits clean, `versions.ts --tag v0.3.0-rc.1`. Record: `plans/evidence/032-release-candidate.md`.
    - **Blocker:** neither `@arnilo/liveframe-runner-quickjs` nor `@arnilo/liveframe-starter` exists on the registry (both E404), so the CI job cannot be their first publisher; each needs a trusted publisher on npmjs.com allowing `npm publish`, and the maintainer token in `~/.npmrc` is invalid (401), so a manual first publish is not possible here. The tag is not pushed until the owner confirms both. The `release` environment is verified (reviewer `ashiqrniloy`, tag policy `v*`).
    - Owner answered "Go" on 2026-11-10; the tag was pushed on `af97604` and approved in the `release` environment. Two attempts, both recorded in `plans/evidence/032-release-candidate.md`:
      - Attempt 1 ([run 42776596232](https://github.com/ashiqrniloy/liveframe/actions/runs/42776596232)) failed before any publish: `bun run demo:test` needed `chromium_headless_shell-1254`. The demo host is not a workspace and installs without a lockfile, so `playwright: ^1.64.1` floated to 1.65.0 in CI while the workflow installs browsers for the root's 1.64.1. Pinned the demo host to `1.64.1` (`f7a86f6`), retested locally (67 pass), deleted and re-pushed the tag.
      - Attempt 2 ([run 42778663441](https://github.com/ashiqrniloy/liveframe/actions/runs/42778663441)): check, audits, archive gate, peer floors and demo pass; **`@arnilo/liveframe@0.3.0-rc.1` is published under `next` with provenance** (08:14:33Z, transparency log 3781858285, 612 files, shasum `781c23cf…`). `@arnilo/liveframe-runner-quickjs@0.3.0-rc.1` then failed `ENEEDAUTH`: a package that has never been published has no trusted publisher to authenticate against. Neither companion was published.
    - The publish step is now re-runnable: it skips a package version the registry already holds, so completing the release publishes only the two companions and never republishes the core. `docs/compatibility.md` § Release process records it.
    - **Remaining blocker, resolved by the owner:** neither companion name existed, and a package with no trusted publisher cannot be published from CI (`npm/cli#8544`). The owner published both once by hand from the same `release:stage` staging CI uses — `0.3.0-rc.1`, 15 and 20 files, matching the CI staging — after claiming each name with a `0.0.0-stage` version as the core did before 0.1.0. This departs from the "no manual publish; CI only" criterion for the rc only; a token publish cannot carry provenance, so the companions' rc has none (`…/attestations/…` returns 404 for both) and `0.3.0` restores it from CI.
    - Registry verification on the published versions, all in `plans/evidence/032-release-candidate.md`: archive gates 15 / 2 / 2 steps; installed API against the baselines (core `0.2.3` + `register-0.3.0`, companions against their `0.3.0` baselines) with no failures, and installed identical to the checkout; `getting-started-test.ts --registry` passes in 3.0 s installing all three from the registry; `demo-test.ts --registry` 67 pass; `npm audit signatures` has `invalid: []` and `missing: []` with the core's 2 attestation bundles. `next` is `0.3.0-rc.1` for all three, and `latest` is `0.3.0-rc.1` on the two new packages until 0.3.0 moves it. Plan 025 Task 10's `next` repair is closed by this.

- [ ] Task 6: Review readiness with the owner
  - Acceptance Criteria:
    - Functional: `plans/evidence/032-release-readiness-review.md` lists every item (scope rows Q1–Q10, W1–W9, L1–L2, O1–O2; every open backlog P1; every impact finding of plans 026–031) as `fixed` with evidence or `deferred` with the owner's approval; the owner answers go or no-go, recorded verbatim.
    - Performance: cites Task 3.
    - Code Quality: n/a.
    - Security: the four laws reviewed against the readiness rows.
  - Approach:
    - Skills to Use: `liveframe-execution`; `create-decision-log` if any item is deferred past 0.3.0.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `plans/evidence/021-release-readiness-review.md` (pattern).
    - Options Considered: n/a.
    - Chosen Approach: the established readiness review.
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `plans/evidence/032-release-readiness-review.md`
  - Test Cases to Write: n/a.
  - Notes (executed <date>):

- [ ] Task 7: Publish `0.3.0` and verify it from the registry
  - Acceptance Criteria:
    - Functional: after the owner's go, bump all three to `0.3.0`, tag `v0.3.0`, publish from CI under `latest`, move `next` to `0.3.0`; repeat Task 5's registry verification; `plans/evidence/032-release.md` records it; `roadmap.md` §3 records Phase 7's 0.3.0 as published.
    - Performance: n/a.
    - Code Quality: CI only.
    - Security: provenance verified for each package.
  - Approach:
    - Skills to Use: `verify-and-stop`.
    - Library Documentation to Check Before Implementation: none beyond Task 5.
    - Documentation Reviewed: Task 5 record.
    - Options Considered: n/a.
    - Chosen Approach: the established final-release pattern.
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `package.json` (×3); `plans/evidence/032-release.md`; `roadmap.md`; `CHANGELOG.md` (date)
  - Test Cases to Write: n/a — release verification.
  - Notes (executed <date>):

- [ ] Task 8: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: the twelve impact areas swept against the whole 0.3.0 release in `plans/evidence/032-impact-analysis.md`; findings presented, dispositions recorded, executed (as 0.3.1 work) or backlogged.
    - Performance: references Task 3.
    - Code Quality: findings cite `file:line`.
    - Security: the four laws reviewed across all new surfaces.
  - Approach:
    - Skills to Use: `create-plan`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: plans 026–031 impact analyses.
    - Options Considered: n/a.
    - Chosen Approach: the standard final task.
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `plans/evidence/032-impact-analysis.md`; `plans/backlog.md`.
  - Test Cases to Write: n/a.
  - Notes (executed <date>):

## Verification (whole plan)

- `timeout 900 bun run check`
- `bun scripts/release/acceptance.ts --plans 026-031`
- `bun scripts/bench-quiet.ts -- bun run bench`
- `bun run release:gate` (each package)
- `bun scripts/getting-started-test.ts` against the registry archives
- `npm view @arnilo/liveframe dist-tags`, and the same for both new packages

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
