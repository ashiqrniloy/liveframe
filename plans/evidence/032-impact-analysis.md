# Plan 032 architectural impact analysis — the 0.3.0 release

Reviewed 2026-11-10 against `7ab931e` (the release record) plus this task's own changes. Covers the twelve areas in `.agents/skills/create-plan/references/liveframe.md` §5 for the whole 0.3.0 release: plans 026–032, the three published packages, the registry archives and the outsider docs. It is the final task of plan 032; plans 026–031 each swept the batch they delivered, and this sweep looks at what only the release as a whole can show — packaging, versioning, the registry, the outsider docs, the release gates, and the cross-batch seams.

Method: read all six earlier impact analyses and the readiness review; re-read the release-candidate and release records; re-read the registry with `npm view`; checked the three manifests against spec §13 and packed all three archives; walked the two code paths plan 032 itself added (Task 3's `renderModule` seam and Task 4a's host-supplied libraries) against the four laws; grepped the outsider docs for release status and performance claims; ran `bun run check` after this task's changes. The host was at load average 9 during the review, so no new wall-clock number is claimed and Task 3's record stays the performance proof.

## Release-level verification

| Check | Result |
| --- | --- |
| Registry state, re-read 2026-11-10 | `npm view <package> dist-tags` gives `{ latest: "0.3.0", next: "0.3.0" }` for `@arnilo/liveframe`, `@arnilo/liveframe-runner-quickjs` and `@arnilo/liveframe-starter` |
| Manifests | all three at `0.3.0`; both companions peer on `@arnilo/liveframe` `~0.3.0` and declare `engines.bun >= 1.4.2` (`packages/*/package.json`), asserted by `workspace_packages_share_one_version` |
| Archives | `stagePackage` copies the root `LICENSE` into every package's staging dir (`scripts/release/publish-manifest.ts:38`); `each_package_archive_matches_exports` (`src/__tests__/workspace.test.ts:94`) asserts `package.json`, `README.md` and `LICENSE` in each archive and applies the per-package require/forbid rules |
| API gate | core against `scripts/release/api/0.2.3.json` + `register-0.3.0.json`; both companions against `0.3.0-<package>.json`; `api-stability.test.ts` passes |
| Outsider docs | `docs-links`, `docs-wording`, `docs-spec-structure` and `migration-guide` pass |
| `timeout 1500 bun run check` (load 12.4 → 7.2) | build, gen:check, typecheck, lint, format pass; 1,769 pass, 4 skip, 0 fail (see Verification) |

## 1. Spec

`docs/spec.md` still describes what shipped. Checked the release-level claims against the code and the archives: §13's package rules (`docs/spec.md:1605-1606`) match the three manifests (lockstep version, `~<minor>` peer, `engines.bun`, pinned QuickJS dependencies, `dist/child.js`, the starter's peers and catalog); §13's archive inventory (`docs/spec.md:1614`) matches the packed core, `LICENSE` included; §13's nine-tool statement (`docs/spec.md:1657`) matches `docs/mcp.md:194` and the pinned `tools/list` tests; §7.5's isolated-runner contract matches `packages/runner-quickjs/src/index.ts`; §14's non-goals still name the isolation sandbox as the separate optional package. No normative meaning changed in plan 032, and no spec edit is needed.

The 0.3.0 release itself does not appear in the spec, by design: §15 is release status in `docs/compatibility.md`, and the spec carries contracts only.

## 2. Public API and formats

- Three packages share `0.3.0` and `bun run release:versions --tag v0.3.0` reads `3 packages at 0.3.0`; both companions' peer ranges were narrowed back to `~0.3.0` in the tagged commit.
- The register (`scripts/release/api/register-0.3.0.json`) holds every added, widened, changed and broken declaration; `LibrarySummary` (plan 032 Task 4a) is the only declaration plan 032 added, and the four widened entries already named `createPreview`, `AuthoringConfig`, `AuthoringOptions` and `createAuthoring`.
- Formats: nothing changed in plan 032. Corpus, hash and patch vectors are identical to the release candidate's, which the archive gates and the differential suite prove.
- Subpath exports resolve in every archive (`assertExportsPacked` in the archive test and the release gate's 15/2/2 steps), and the core archive holds no WebAssembly, starter or QuickJS file (`archiveRules["@arnilo/liveframe"]`, `src/__tests__/workspace.test.ts:88`).
- **Finding F4 — the 0.3.x API gate has no core baseline.** `docs/compatibility.md:33` promises that patches compare against a baseline generated from the `v0.3.0` tag, as 0.2.x did against `v0.2.1`. `scripts/release/api/` holds `0.2.1.json`, `0.2.2.json`, `0.2.3.json`, `register-0.3.0.json` and the two companion `0.3.0` baselines, but no core `0.3.0.json`; plan 032 Task 5 created baselines for the companions only, as its criterion said. An 0.3.1 task must generate the core baseline from `v0.3.0` and switch `api-stability.test.ts` to it with an empty register. Backlogged (P3).

Registry verification (re-read today) is in the table above. The two things the release record could not prove at the time were resolved before publication: the companions carry provenance for the first time (`0.3.0` published from CI), and `next` moved without a manual command because both trusted publishers allow dist-tags.

## 3. The four laws

The release adds two code paths; both were walked end to end.

**Law 1 — widget code never runs in the browser.** Plan 032 Task 4a passes host-supplied libraries to the runner; they are widget code and still run only where the runner runs. `quickjsRunner` keeps its child-process boundary and starts the child with an empty environment (`packages/runner-quickjs/src/index.ts:87-88`), matching `docs/security.md:38` and the runner README. Template widgets remain data; `templateRunner()` evaluates on the host. No browser path gained an evaluator.

**Law 2 — the tree is validated data.** Task 3's change only removes a duplicate library collection: `inProcessRunner.render` collects once and passes the verified set to `renderModule` (`src/preview/in-process.ts:62,78`), and `renderPackage` still collects once for the worker entry (`:96,102`). The set is the same one the runner would have built, and every tree is still re-validated on the host. Task 4a's libraries are hash-pinned: `pack()` refuses a missing library, the runner refuses a wrong hash, and `preview_session_refuses_a_library_with_the_wrong_hash` covers the session path.

**Law 3 — widget code never sets colours or raw CSS.** Nothing in plan 032 touches styles. The starter's release state is the plan 031 state: colours only in `themes.ts`, `designSystemSuite({ contrast: true })` for all three themes, the `tone` axis as role aliases, `sheen` an extension read by primitive CSS and ignored by the contrast audit by design (031 Task 6 deviation b, documented).

**Law 4 — a widget never holds authority.** Task 4a widens what a draft may import but not who supplies it: `pack_draft` refuses an agent-supplied `libraries` field by name (`src/authoring/index.ts:176`), `list_libraries` is read-only and always registered, and the agent can read ids, versions, hashes, exports and specifiers only. Both agent-acceptance transcripts (`plans/evidence/032-agent-acceptance.md`) record only authoring calls — no install, placement or dispatch — and the demo host's install route is the operator's, documented as the app's policy in `docs/getting-started.md` § 6.

Residual exposure is unchanged and documented: a defect in QuickJS, CPU side channels, head-of-line blocking on one child, `reuse: "package"` module state, an orphaned child after a host `SIGKILL` (031 F1, backlog), host memory pressure, and Linux-only measurement (031 F6, backlog). Reference runners are still not isolation boundaries.

## 4. Validation

Every new 0.3.0 input has a typed error at a pointer; this sweep found no unvalidated path in plan 032's additions. `createPreview({ libraries })` and `createAuthoring({ libraries })` reject shape, template packages and duplicate `id@version` at `/libraries/<i>` (`LiveframeFailure` at construction; the CLI prints the errors and exits 2). A draft's `libraries` argument is `invalid-document` at `/libraries`. A missing library is `not-found` with the host-supplied message (`src/preview/session.ts:165`); a different hash is `hash-mismatch`. `list_libraries` validates nothing because it reads the list the host already validated. Two late checks recorded by earlier plans remain: `loadPlacement` checks a dependent's library names at link time, not load (030 F6, backlog), and `migrateState` results are validated at load (030 F7, backlog). Neither is a new input introduced by the release.

## 5. Styling

None — no recipe, theme, design-system or CSS-projection code changed in plans 031–032 beyond the starter that shipped in 031. Its three themes pass the opt-in contrast audit, the completeness check and the browser suites in CI; axis combinations are capped at 512 catalog-wide (027); extension properties reach CSS only as `--lf-p-<name>`. The existing "Proof styles fail the opt-in contrast audit" backlog entry describes the proof systems, which this release did not touch.

## 6. Interaction tiers

No tier contract changed in plan 032. Tier 1 (`setLocal`) never leaves the browser and `checkOffered` rejects it; tier 2 (`setState`) runs the host's `authorize` before any write (030 F1, executed); tier 3 (action) reports `pending`/`ok`/`failed`/`refused` through `actions` and the demo host's ndjson stream. The only conformance gap is the one plan 029 recorded: no `rendererSuite` case for `when`, `setLocal` or `binding-failed`, and no suite for a renderer built on `/surface` (029 F6, backlog P3). The release does not widen it.

## 7. Performance

Task 3's record and the [owner decision](../../decision-logs/2026-11-09-2106-close-plan-032-task-3-on-partial-quiet-host-proof.md) are the proof, and no budget was changed. Standing state:

- `validator` (9.7% host CPU) and `streaming` (8.1%) were quiet and passed every gate; the other seven stages exited 0 but were not quiet (10.9–20.4%).
- `pack-libraries` failed at CPU pressure 0 and exposed a real defect, not a threshold problem: `inProcessRunner.render` collected and verified the library set and then `renderPackage` collected it again. The duplicate collection is gone (`src/preview/in-process.ts:62,78,96`), the gate's method changed with owner approval, and 30 of 30 runs pass afterwards (ratio 0.994–1.048 against 1.05).
- `template` ran at 5.44% over `renderTemplate` against the 5% gate (`bench/template.bench.ts:149`) once, never confirmed on a quiet host. It is the same thin-margin ratio family as `pack-libraries`, so it is the first thing to re-measure.
- The 1-minute load average could never stay below 1.0 with the benchmark running (finding 1); the owner redefined quiet as whole-host CPU below 10%, benchmark included, read from `/proc/stat` per stage (`scripts/bench-quiet.ts:6-19`). The `powersave` governor made the first validator measurement 1.7× slow; a 5 s spin before the first stage fixed the measurement, not a gate.
- `bun run bench` still chains its stages with `&&`, so one failing gate hides the rest. `scripts/bench-quiet.ts:67-74` derives the stages from the `bench` script itself and runs each in its own process, which is the workaround; 031 F9 stays an update line on the existing backlog entry.
- CI's `bench (informational)` step still rewrites the tracked `plans/evidence/019-streaming-bench.md` (028 F8, backlog P4).
- The acceptance log's 36 `pending` rows are exactly the budget bullets that need a quiet record; re-running `bun scripts/bench-quiet.ts --out plans/evidence/032-bench.md` on an idle host and then the acceptance script turns them `pass`.

## 8. Portability

The core stays host-API-free; the portability scan and the README's globals table cover every subpath, and the archive gate's Node probe still passes on the core. Both companions declare `engines.bun >= 1.4.2` and need Bun (`quickjsRunner` spawns a child; the starter needs a DOM only through React). The runner and starter were measured on Linux only (031 F6, backlog P3), and the starter's peer floors — `react` 19.0.0 and `react-aria-components` 1.22.0 — are untested (031 F5, backlog P3); the release's peer-floor job covers the core's peers only (React 119, Playwright 23, MCP 87).

**Finding F3 — the demo and guide gates install floating dependency ranges with no lockfile.** `scripts/demo-test.ts:44` deletes the demo's lockfile and `:51` runs a plain `bun install`, while `examples/demo-host/package.json:13-22` declares `react`, `react-dom`, `react-aria-components`, the MCP client/server and the type packages with carets; `docs/getting-started.md:21` installs React and React Aria Components the same way when the guide runs. This is not hypothetical: publish attempt 1 ([run 42776596232](https://github.com/ashiqrniloy/liveframe/actions/runs/42776596232)) failed before publishing because `playwright: ^1.64.1` floated to 1.65.0 in the demo host while CI installed browsers for 1.64.1. Task 5 pinned that one dependency, which fixes today's gate, but every other range still floats: a React or React Aria minor release can break the release job the same way. Backlogged (P3): pin the demo host's dependencies exactly (the smallest fix), or commit a lockfile and install it frozen; do the same for the guide's install line.

## 9. Agent authoring

`liveframe mcp` serves nine tools; `docs/mcp.md:194` and spec §13 say nine, and every pinned list (CLI, guide, proof, demo, archive fixture) agrees. The new tool is read-only and always registered, so `tools/list` does not depend on config. The agent gets a library's `id`, `version`, `hash`, `exports`, `specifier` and optional `description`; a library the host did not supply is `not-found` with the host-side message, so an agent does not hunt for a tool argument. `liveframe mcp` still recommends the isolated runner with the exact config line when the package resolves, and changes no default.

Two authoring gaps remain, both already recorded: a library's component contract (props) is not discoverable, and `when`/`bind` on a composed component are dropped (032 Task 4a findings G1, G2, backlog P2). **Finding F5 — the codegen half of the library entry is still open and the entry says otherwise.** The backlog entry "Let authoring, preview and codegen use package libraries" (`plans/backlog.md:735`) still says the authoring session, the MCP tools and preview cannot pack or preview a library widget; plan 032 Task 4a delivered exactly that on 2026-11-09, before the readiness review was written, which still counts 030 F5 as `deferred` (`plans/evidence/032-release-readiness-review.md:114`). What remains is `liveframe gen`: it emits no module declaration for a library's exports, so the demo still hand-writes `examples/demo-host/widgets/libraries.d.ts`. Bookkeeping correction here; the remaining codegen work is backlogged under the same entry.

## 10. Docs and examples

Complete except for two release-status statements:

- `docs/migration-0.3.md` has one entry per `removed`/`changed` register entry, both directions checked by `migration-guide.test.ts`, and every sample parses and resolves against the checkout.
- `docs/adopters-0.3.md` maps Synapta's three standing items, Clay's CL-17 and CL-14, W1–W9, Q1–Q10, L1–L2 and O1–O2 to the shipped API, spec section and limitation.
- `CHANGELOG.md` § 0.3.0 is dated and has Added / Changed / Removed / Fixed / Security; `docs/compatibility.md` § 0.3.0 states the breaks, the additive set, the three-package rule, the 0.3.x promise (F4) and Bun-only; `SECURITY.md` covers the isolated runner and the three-package version; `docs/security.md` carries the template, local-binding, streaming, QuickJS and host-pipeline trust rules; `docs/getting-started.md` is executed in CI (`bun run guide:test`).
- **Finding F1 — `README.md:235` still says 0.3.0 is "the release in preparation" and 0.2.3 "the latest published"**, after Task 7 published all three under `latest`. Corrected in this task.
- **Finding F2 — the adopter notes claim a benchmark proof the release did not achieve.** `docs/adopters-0.3.md:73` (row O1) says "the release runs one sequential `bun run bench` on a quiet host with the load recorded"; `plans/evidence/032-bench.md` does not exist, the owner closed Task 3 on partial proof, and the readiness review and decision log say so. The page's own rule is that a named limitation is part of the release, so the row must state the limitation instead of a proof. Corrected in this task.

## 11. Conformance

`runnerSuite()` has 17 cases with isolation on; `inProcessRunner`, `workerRunner` and `templateRunner` pass the contract cases, `quickjsRunner` passes all 17 in the package's tests and in its installed-archive smoke, and `isolation_cases_fail_for_in_process_runner` proves the cases bite. The starter passes `catalogSuite`, `designSystemSuite({ contrast: true })`, `rendererSuite` and `rendererBrowserSuite`; CI runs the WebKit and Firefox passes for the whole test suite and the browser install for three engines. Corpus, hash, patch and runner fixtures are unchanged in plan 032 and the format-schema differential suite still passes. Carried gaps, none widened by the release: no renderer case for `when`/`setLocal`/`binding-failed` and no suite for a non-React `/surface` renderer (029 F6); the QuickJS runner's copy of the library-graph walk has no drift test (031 F7); a runner behind a different answer channel is covered only by the loose forged-answer probe (031 area 11); the template schema is not strict-mode compatible (028 F6).

## 12. Reference hosts

The adopter notes close Synapta's isolated-runner hand-off (`runnerSuite({ isolation: true })` plus `quickjsRunner`), its hand-rolled orchestration (`/host`) and its render-key/immutability convention, and Clay's CL-17 (one foreign-realm rule) and CL-14 (`next` no longer trails; verified again today as `next == latest == 0.3.0` on all three packages). Limits are stated, not bent to: Synapta still owns runner choice, tenant scoping, data resolution, approval and the OS sandbox; Clay still owns Vitest/Jest registration and its WebKitGTK measurement. No product primitive or host-shaped exception was added for either.

What the repository cannot prove is adoption: roadmap Phase 7's **Done** criterion ("both apps render at least one production surface through Liveframe") is an adopter-side event, and both hosts' 0.3.0 upgrades are their own plans. The release makes the upgrade possible and documented; it does not claim the migration happened.

## Findings and dispositions

New findings from this sweep. Dispositions are executed in this task unless a 0.3.1-shaped action is recorded; the two deferrals are backlog entries with their priority.

| # | Finding | Area | Disposition |
| --- | --- | --- | --- |
| F1 | `README.md:235` calls 0.3.0 "the release in preparation" and 0.2.3 the latest published after all three 0.3.0 packages shipped | Docs | **Executed** in this task: the status line states 0.3.0 is published and dated |
| F2 | `docs/adopters-0.3.md:73` (O1) claims a quiet-host `bun run bench` record that does not exist; the owner closed Task 3 on partial proof | Docs, performance | **Executed** in this task: the row states what shipped (`bench-quiet.ts`, whole-host CPU) and that the full proof was deferred, with the validator/streaming stages named as the quiet ones |
| F3 | The demo and guide gates install `react`, `react-dom`, `react-aria-components`, the MCP packages and types from floating ranges with no lockfile; a floated Playwright already broke publish attempt 1 | Release automation, portability | **Backlog P3** "Pin the demo and guide gates' dependencies": exact pins (smallest) or a committed lockfile with `--frozen-lockfile`, in `examples/demo-host/package.json` and the guide's install line |
| F4 | The 0.3.x promise names a core API baseline generated from `v0.3.0`; `scripts/release/api/` has none, only the two companion baselines | Release process, public API | **Backlog P3** "Generate the core 0.3.0 API baseline before 0.3.1": generate it from the tag and switch `api-stability.test.ts` to it with an empty register, so a patch cannot change a declaration unnoticed |
| F5 | The backlog entry "Let authoring, preview and codegen use package libraries" is stale: plan 032 Task 4a delivered the session/MCP/preview half, and the readiness review still counts 030 F5 as deferred; `liveframe gen` still emits no declaration for a library's exports | Agent authoring, plan bookkeeping | **Executed** in this task: the entry gains a status line, keeps only the `liveframe gen` half open, and the correction is recorded here (the readiness review and release record remain the 2026-11-10 decision record) |

Carried, no new finding and no new disposition needed:

| Item | Why it still stands |
| --- | --- |
| Quiet-host proof, the `template` ratio gate and the 36 `pending` acceptance rows | Owner deferral of 2026-11-09/10; existing backlog entry "Re-run the full benchmark suite on a quiet host" (`plans/backlog.md:510`) |
| The 48 impact findings of plans 026–031 (24 fixed, 24 deferred) | Disposed in their own reports and approved on 2026-11-10; 030 F5 is the one status corrected by F5 above |
| 032 Task 4's findings (F2/F4 docs fixed; F3, F6, F7, F9, F10 backlogged) and Task 4a's G1, G2, G4 | Backlogged on 2026-11-09 in `plans/backlog.md` (two P2 entries) and approved in the readiness review |
| 031 F1/F2/F5/F6/F7/F10/F11, 029 F6/F7, 028 F6/F8, 030 F6–F11, 027 F5 | Each has its backlog entry; nothing in this release changed their status |

## Verification

- `timeout 1500 bun run check` after this task's changes: build, gen:check, typecheck, lint and format pass; 1,769 pass, 4 skip, 0 fail (160 files, 471.81 s of tests). Host load 12.4 before and 7.2 after.
- Focused: `workspace`, `api-stability`, `docs-links`, `docs-wording`, `docs-spec-structure`, `migration-guide` and `acceptance_map_covers_every_bullet_of_plans_026_to_031` pass.
- Registry: `npm view` on all three packages today returns `latest: 0.3.0`, `next: 0.3.0`.
- Archives: `bun pm pack` of the runner and starter from their package directories carries `package.json` and `README.md`; the release path (`stagePackage`) adds `LICENSE` to all three, which `each_package_archive_matches_exports` asserts.
- No code, budget, format or release was changed by this task; the three edits are docs and backlog bookkeeping.
