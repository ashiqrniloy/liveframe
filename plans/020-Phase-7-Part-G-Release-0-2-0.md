# Phase 7 Part G: Release 0.2.0

Depends on: plans [014](014-Phase-7-Part-A-Release-Scope-Packaging-And-Schema-Language.md) to [019](019-Phase-7-Part-F-Agent-Surfaces-Conformance-Corpus-And-Engines.md) complete, including each plan's impact analysis.

## Objectives

- Settle the two items that need the owner: the Clay-derived git-status fixture, and G29, the native Windows forced-colours and assistive-technology audit.
- Write the outsider-facing 0.2.0 material:
  - a migration guide for the breaking changes;
  - adoption notes that map every request (LF-01 to LF-17, CL-01 to CL-09) and every backlog item in scope to the API that closes it;
  - the changelog.
- Prove every request's acceptance criteria against the checkout, then against the installed release candidate. Clay's migration plan starts only once the release is verified.
- Publish `0.2.0-rc.N` under `next`, verify it from the registry, run the agent acceptance on the new authoring paths, review every readiness item with the owner, then publish `0.2.0` as `latest` and verify it.

## Expected Outcome

- `docs/migration-0.2.md` and `docs/adopters-0.2.md` ship in the archive. `CHANGELOG.md` has a 0.2.0 entry.
- `plans/evidence/020-request-acceptance.md` names a passing test or evidence record for every acceptance bullet of every request, against both the checkout and the installed rc.
- `@arnilo/liveframe@0.2.0` is on npm with provenance, under `latest`. The archive gate, peer floors and demo gate pass against the registry package.
- `roadmap.md` §3 records the release, and both request documents carry a status line pointing at the adoption notes.

This plan implements roadmap Phase 7's 0.2.0 release scope (added by plan 014 Task 1), using the release process in `docs/compatibility.md` § "Release process" and plan 013 Tasks 10–13 as precedent. Publishing is outward-facing and cannot be undone: no tag is pushed without the owner's explicit go in Task 8. Under R15, 0.2.0 is the minor version that may carry the breaking changes listed in plan 014 Task 1's log.

## Tasks

- [x] Task 1: Settle the git-status labels fixture (backlog)
  - Acceptance Criteria:
    - Functional:
      - The owner chooses one of three options for `src/__tests__/fixtures/widgets/git-status/labels.ts`: keep it as the owner's own code with a note, replace it with a neutral fixture, or attribute the source in the repository.
      - The choice is applied, and any affected test still passes.
      - The backlog entry "Decide the Clay-derived git-status labels fixture" is closed with the owner's words.
    - Performance: n/a.
    - Code Quality: if the fixture is replaced, its tests keep the same coverage (the same label cases).
    - Security: n/a — provenance hygiene for the public repository.
  - Approach:
    - Skills to Use:
      - `create-decision-log`, only if the owner wants a log. Otherwise record the answer in the backlog and the task notes.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/evidence/013-repository-audit.md:75`; the backlog entry.
    - Options Considered:
      - The owner's three options, as listed.
    - Chosen Approach:
      - Ask the owner with AskUserQuestion.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `src/__tests__/fixtures/widgets/git-status/*` (depends on the choice); `plans/backlog.md`
  - Test Cases to Write:
    - The existing tests that use the fixture.
  - Notes (executed 2026-10-29): the owner answered, verbatim, "Go with option 1" — keep it as the owner's own code, with a note in the repository. `src/__tests__/fixtures/widgets/git-status/labels.ts` now opens with that note: the owner's own code, adapted from the owner's own Clay project (`packages/git/src/status.ts`, commit `7770d18c`), no third-party licence applies; the `@clay/git` package header is gone and the composition paragraph stays. No label, consumer, test or golden changed, so coverage is identical by construction — the alternative (a neutral fixture) would have cost `src/__tests__/fixtures/elements.json`, the 52 text nodes in `proof-formats.test.ts:169` and the skipped `git_status_matches_builder_output_structure` parity check. Provenance evidence checked before asking: every commit on Clay's `packages/git/src/status.ts` is by Niloy Rahman, the same copyright holder as this MIT repository, and Clay has no `LICENSE` of its own, so the source imposes no licence condition. `plans/backlog.md`'s entry is closed with the owner's words. `bun run check`: 846 pass, 4 skip, 0 fail.

- [x] Task 2: Run the native forced-colours and assistive-technology audit (G29)
  - Acceptance Criteria:
    - Functional:
      - The agent writes `plans/evidence/020-g29-audit.md`: a reproducible checklist covering both proof design systems, every state, edges, focus, keyboard interaction, overlays and native control/scrollbar geometry, with the new 0.2.0 surfaces (`none`, alpha, scrollbar properties, `transparency`).
      - The owner, or an auditor the owner names, runs it on Windows with forced colours, in Edge or Chrome, with NVDA and/or Narrator. They record the machine, OS, browser and AT versions and the results.
      - Each defect is fixed in a new task above Task 8, or deferred with the owner's approval and listed in the release notes as a known limitation.
      - The G29 backlog line is closed, or narrowed.
    - Performance: n/a.
    - Code Quality: n/a — an audit.
    - Security: n/a.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - Windows contrast themes and `forced-colors` (MDN); NVDA user guide (live regions and dialogs).
    - Documentation Reviewed:
      - Backlog "Later-phase gaps from the Phase 0 reports" (the G29 line); `proof/GAPS.md:178`; R20 (deferred past 0.1.0).
    - Options Considered:
      - Defer again — allowed only with the owner's explicit approval. Both request documents ask for it, and Synapta's accessibility list requires forced colours.
    - Chosen Approach:
      - An owner-run manual audit from an agent-written checklist. The agent cannot run Windows or assistive technology from this Linux host.
    - API Notes and Examples:
      ```sh
      bun run proof   # serve the proof host for the auditor
      ```
    - Files to Create/Edit:
      - `plans/evidence/020-g29-audit.md` (new); `plans/backlog.md`; `proof/GAPS.md`
  - Test Cases to Write:
    - None. The audit record is the evidence.
  - Notes (executed 2026-10-29, with the run waived by the owner): `plans/evidence/020-g29-audit.md` is written — 61 rows in eight sections (forced colours, edges and fill indicators, overlays, keyboard, native controls and scrollbars, the 0.2.0 surfaces `none`/alpha/scrollbar properties/`transparency`, assistive technology, baseline). Each row names a page URL, a control by its visible label, the steps and the expected result, and leaves a `Result` cell empty; the file also carries the machine/OS/browser/AT record to fill, the exact expectations the projection emits (1px `Highlight` hover/active/open, 2px `Highlight` focus, `Highlight`/`HighlightText` selected, `GrayText` disabled, inward 1px `CanvasText` edges and `lf_fill`, `scrollbar-color:auto`, `::placeholder` `GrayText`), and a table of what Chromium already proves so the run does not re-derive it. Preparation is reproducible: `mise install` (Bun 1.4.2), `bun install`, `bun run proof` → `http://127.0.0.1:3000`, with a note to restart the host between recorded passes because intents mutate sessions. Rows the proof cannot reach are labelled `n/a` with a reason rather than left to guess: `invalid` has no proof widget, `placeholderColor` has no proof recipe, and 0.2.0's explicit `transparency` attribute is DevTools-only because the host has no transparency switch. Findings that shaped the checklist: the host's design-system `<select>` is the only way to see one page under both systems, `/ui/agent-home?scenario=ready` is the only scenario whose task card is selected by default, and the proof host serves the SDK fixture widgets rather than `proof/widgets/`. `plans/backlog.md`'s G29 line is narrowed to point at this record and to the remaining run; `proof/GAPS.md` "G29 partly automated" says the same. The Windows run itself (acceptance 2) and therefore the defect dispositions (acceptance 3) are not done: the agent cannot run Windows or assistive technology from this Linux host, and the owner declined to run it, verbatim "I don't care about windows. So mark the task completed with a note and move ahead". The owner's decision therefore converts acceptance 2 into a waived item rather than a met one: the checklist is the deliverable and stands as the audit's definition for whoever runs it later, its rows are not evidence of native rendering, and `CHANGELOG.md` 0.2.0's Known limitations (Task 3) keeps native Windows forced-colours and assistive-technology verification unrun, as 0.1.0 did. No defect exists to dispose of, so acceptance 3 is discharged vacuously. Acceptance 4 is met: the G29 backlog line is narrowed to this record and states the waiver, and the item stays open for a later release because the gap itself is real.

- [x] Task 3: Write the migration guide, adoption notes and changelog
  - Acceptance Criteria:
    - Functional:
      - `docs/migration-0.2.md` covers each breaking change with before and after code: the `Store` scope, `<Preview>` `resultScenario`/`selection`/`urlKey`, and capture's subpath, plus any break later plans added.
      - `docs/adopters-0.2.md` has one row per request (LF-01 to LF-17, CL-01 to CL-09) and per backlog item in scope. Each row gives the shipped API or doc, the spec section, and any limitation. "Problem class first": rows describe the general problem, not either app.
      - `CHANGELOG.md` 0.2.0 lists Added, Changed (breaking), Fixed and Known limitations.
      - `README.md` lists the new subpaths (`/sdk/gen`, `/preview/capture`, `/authoring`, `/runner-kit`).
      - `docs/compatibility.md` § 0.2.0 links the migration guide.
      - The backlog entry "Hand adopter gaps to Synapta and Clay" is updated to point at the adoption notes.
      - Both request documents get a status line.
      - The docs tests (`docs-links`, `docs-wording`) pass.
    - Performance: n/a.
    - Code Quality: every code sample in the guide is executed by a docs guide test, following the pattern of `src/__tests__/readme-guide.test.tsx`.
    - Security: the guide repeats the boundaries:
      - `meta` grants nothing;
      - `confirm` is not authorisation;
      - the runner kit is not isolation;
      - `checkOffered` is the host's job.
  - Approach:
    - Skills to Use:
      - `karpathy-guidelines`: plain outsider prose.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Plans 014–019 (delivered APIs and Compromises Made); `CHANGELOG.md`; `README.md`; `docs/*`.
    - Options Considered:
      - Fold the adoption notes into `CHANGELOG.md` — rejected: adopters need a per-request map, and a changelog is per change.
    - Chosen Approach:
      - Two new shipped docs.
    - API Notes and Examples:
      ```ts
      // 0.1.0                               // 0.2.0
      store.putState(id, state);             store.putState(id, "", state);
      ```
    - Files to Create/Edit:
      - `docs/migration-0.2.md` (new); `docs/adopters-0.2.md` (new)
      - `CHANGELOG.md`; `README.md`; `docs/compatibility.md`
      - `src/__tests__/migration-guide.test.ts` (new)
      - `plans/backlog.md`; `plans/requests/*.md` (status line)
  - Test Cases to Write:
    - `migration_guide_examples_run`.
    - `docs_links_resolve` (existing).

  - Notes (executed 2026-10-29): `docs/migration-0.2.md` covers the three breaks the compatibility register names — `Store` state keyed by `(placementId, scope)` with `""` shared, `<Preview>`'s required `resultScenario` plus controlled `selection`/`onSelect` and `urlKey`, and capture as `/preview/capture` with an injected backend — each as a 0.1.0/0.2.0 table, the fix, and the check that catches a missed migration (the store conformance suite). A fourth section lists what is additive and the two non-breaking behaviours to look at (contrast now failing a theme install, the portal container still taking a layout box). `docs/adopters-0.2.md` has one row per LF-01–LF-17, per CL-01–CL-09 and per each of the five backlog items those documents raised; every row states the general problem first, then the shipped API, its spec section and its limitation, and a closing section names what was not delivered (G29's waived run, tree patches, an authorisation model). `CHANGELOG.md`'s Unreleased (0.2.0) now lists Changed (breaking), Added and Fixed in full — the areas the earlier draft omitted (schema language LF-04, events LF-05/CL-08, semantics LF-09, manifests and capabilities LF-07/LF-08, renderer LF-01/CL-02/CL-09, styling CL-04/LF-10/LF-11/CL-07, validation and sources LF-12/LF-14, agent surfaces LF-16, the 45-case corpus and 45 hash vectors CL-06) plus nine Known limitations, the unrun Windows audit among them with its waiver. `README.md` already listed `/sdk/gen`, `/preview/capture`, `/authoring` and `/runner-kit`, so no edit was needed there. `docs/compatibility.md` §0.2.0 links the guide and the adoption notes; `plans/backlog.md`'s "Hand adopter gaps to Synapta and Clay" points at the adoption notes; both request documents gained a delivery-status line, with G29 named as the one item that did not close. Evidence checked while writing rather than assumed: the corpus is 45 cases and the hash set 45 vectors (plan 019 notes), `generateElementsSchema` has a CLI equivalent (`gen --elements-schema`), the `implement()` context really exposes `events` with `{type, confirm, irreversible}` (`src/react/renderer.tsx:247`), the portal container has no `display: contents` default (so the guide says how to get one instead of claiming it), and the engines verified are Chromium, Firefox and WebKit through `LIVEFRAME_BROWSER`. Code Quality: `src/__tests__/migration-guide.test.ts` mirrors `readme-guide.test.tsx` — it asserts the guide prints both samples verbatim from `src/__tests__/fixtures/migration-0.2.ts`, then runs them against `memoryStore()` and a fake `CaptureBackend`, so a guide edit that would not compile or run fails the suite. `bun run check`: 847 pass, 4 skip, 0 fail.

- [x] Task 4: Prove every request's acceptance criteria against the checkout
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/020-request-acceptance.md` lists every acceptance bullet of LF-01 to LF-17 and CL-01 to CL-09, plus the two extra items in Clay's dependency table: LF-10 `maximum`/ordering, and LF-03's `docs/styling.md` sweep.
      - Each bullet gets a test name with its file and a passing run, or an evidence record. Any bullet without one is a finding: it becomes a new task above Task 8, or is deferred with the owner's approval.
      - The table is produced by running the named tests in one `bun test` invocation, whose output is saved with the evidence.
    - Performance: record `bun run bench` against every budget (validator ≤ 1.5 µs/node, render ≤ 3 µs/node, warm switch ≤ 16.67 ms).
    - Code Quality: n/a — evidence.
    - Security: the four laws are re-checked by name in the evidence, each pointing at its tests.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Both request documents; the plan 014–019 test lists.
    - Options Considered:
      - Trusting the per-plan impact analyses — rejected: Clay's plan needs one verifiable record.
    - Chosen Approach:
      - One matrix.
    - API Notes and Examples:
      ```sh
      bun test --conditions liveframe:source -t '<names from the matrix>' > plans/evidence/020-request-acceptance.log
      ```
    - Files to Create/Edit:
      - `plans/evidence/020-request-acceptance.md` (new); `.log` (local-only if large; say so in the record)
  - Test Cases to Write:
    - None new. This task runs the existing ones.

  - Notes (executed 2026-10-29): `plans/evidence/020-request-acceptance.md` holds 91 rows: 58 for LF-01–LF-17, 31 for CL-01–CL-09, and 2 for Clay's extra items (a contrast pair's `maximum` and the stricter ordering constraint, `docs/styling.md`'s planned-work sentence). Each row keeps the request's own bullet number and shortens the condition; the evidence cell names a test plus its file, an archive-gate step, or a documentation citation. One `bun test --conditions liveframe:source -t '<120-name alternation>'` run proves it: 124 pass, 0 fail, 786 filtered out, 116 files, 31.7 s, saved as `plans/evidence/020-request-acceptance.log` (12 KB, committed; the record carries the command that regenerates it). The pass count exceeds the names because `-t` matches substrings, so a `describe` block or a fixture-templated family (`capabilities_for_equivalence_on_proof_manifests: <fixture>`) selects more than its head name. Two findings, both naming rather than coverage: plan 017's `overlay_resolves_scope_variables_with_host_classes` and `switching_with_host_classes` do not exist — the shared browser fixture passes `wrapperProps`/`portalProps` (`src/__tests__/fixtures/react-client.tsx:129-130`), so the grid, overlay-scope and switching tests all run with host classes, and `host_class_appended_scope_survives` is the dedicated renderer test; and LF-07.1's `pack()`/`verifyPackage()` coverage of `description`/`meta` is `verify_rechecks_manifest_and_scenarios` rather than a dedicated round-trip. No bullet lacked evidence, so nothing was added above Task 8 or deferred. Performance, `bun run bench` on the same machine: validator compiled 0.819–1.370 µs/node against ≤ 1.5 (agent-home 1.314); render 1.622–2.263 µs/node against ≤ 3 with wall 0.26–1.07 ms against ≤ 2; the warm switch is `switch_under_budget_with_blur_through_surface` at the 16.67 ms sample gate (25.1 WebKit); `styleDeclarations` 0.394 µs/node. The generic interpreter (1.071–2.092 µs/node) is reported for comparison and is not the shipped path, which is what the bench gates. `bun run bench` also rewrites `plans/evidence/019-streaming-bench.md`; that file was restored so LF-17's evidence stays the run its decision used, and the record says so. The four laws are re-checked by name with tests listed for each. `bun run check`: passes.

- [x] Task 5: Bump to 0.2.0-rc.1 and prove the archive locally
  - Acceptance Criteria:
    - Functional:
      - `package.json` `version` is `0.2.0-rc.1`.
      - The archive gate passes against the packed tarball, including plan 014's exports check, plan 018's bundle and new subpaths, and plan 019's corpus and vectors.
      - `scripts/release/peer-floors.ts` passes. Any peer range change follows its proof rule.
      - The demo host runs on the new APIs (scoped state, `checkOffered`, `resultScenario`), and `bun run demo:test` passes against the tarball.
      - `bun run check` is green.
    - Performance: record the archive gate step times.
    - Code Quality: no source changes except the version and what the gates demand. Any fix is recorded.
    - Security: the packed file list contains nothing outside spec §13's ships list (as amended by plans 018 and 019).
  - Approach:
    - Skills to Use:
      - `verify-and-stop`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Plan 013 Tasks 2, 3 and 10; `scripts/release/*`; `scripts/demo-test.ts`.
    - Options Considered:
      - Skipping the rc — rejected: plan 013's rc rounds found docs defects that only the registry path exposed.
    - Chosen Approach:
      - The 0.1.0 process.
    - API Notes and Examples:
      ```sh
      bun run check && bun run release:gate && bun scripts/release/peer-floors.ts && bun run demo:test
      ```
    - Files to Create/Edit:
      - `package.json`; `examples/demo-host/*` (dependency and API use); `CHANGELOG.md` (rc note)
  - Test Cases to Write:
    - None new.

  - Notes (executed 2026-10-29): `package.json` is `0.2.0-rc.1`; the only other edits are the CHANGELOG's rc line and this plan. `bun run release:gate` passed all 11 steps in 5.9 s against the packed tarball installed at `0.2.0-rc.1`: every exports target packed (0.0 s), install (3.0 s), every installed exports target exists (0.0 s), corpus packed (0.0 s), hash vectors packed (0.0 s), runner bundle packed and self-contained (0.0 s), pack/store/reload/render through both runners (0.1 s), worker timeout then recovery (1.6 s), `liveframe gen` and `--check` (0.1 s), `liveframe mcp` over stdio (0.3 s), browser bundle from the installed package (0.1 s), consumer types under strict NodeNext (0.6 s), host-API-free subpaths under node (0.1 s). Plans 014/018/019 are covered by the exports, bundle, corpus and vector steps by name. `bun scripts/release/peer-floors.ts` passed all three floors in one run — React 19.0.0/19.0.0 96 pass, Playwright 1.49.0 18 pass, `@modelcontextprotocol/server` 2.0.0 34 pass — so no peer range changed. The playwright floor needed its own browser build first: `bunx playwright@1.49.0 install` downloaded Chromium 1148 but stalled after the download and left a partial tree, so the same Chromium/headless-shell 1148 archives were fetched and unpacked by hand into `~/.cache/ms-playwright`; that is an environment fix, not a repo change, and the floor then passed. `bun run demo:test` passed against the tarball (build, stage, pack, `bun add --no-save`, demo typecheck, 52 tests across 7 files) and the demo host already exercises the new APIs: `putState`/`getState` with `""` scope (`examples/demo-host/server.ts:144-175`), `checkOffered` on dispatch (`:159`) and `resultScenario` on `<Preview>` (`preview-client.tsx:71`). One flake, twice: the warm-switch budget test (`switch_under_budget_with_blur`, 16.67 ms per sample) reported a 17.9 ms outlier in one `bun run check` and a 92 ms outlier once inside a peer-floor run; it is load-sensitive, passed on every immediate rerun (the file alone: 6 pass), and passed in the final full `bun run check` (851 tests, 4 skip, 0 fail). No test was weakened and nothing in the budget changed; a repeat should rerun before treating it as a regression. The packed file list gained nothing in this task, so spec §13's ships list as amended by plans 018 and 019 still bounds it, and the gate's exports/corpus/vector/bundle checks all passed.

- [x] Task 6: Publish the release candidate under `next` and verify it from the registry
  - Acceptance Criteria:
    - Functional:
      - With the owner's go for the rc tag, push `v0.2.0-rc.1`. The publish workflow repeats CI, publishes under `next` with provenance, and passes.
      - From the registry: `npm view @arnilo/liveframe@next version` shows the rc. The archive gate in registry mode, the demo host installed from the registry, and the request-acceptance installed-package rows (subpath imports, the bundle under Node `vm`, the corpus present, `/authoring` without the MCP SDK, capture without Playwright) all pass.
      - Any defect produces a fix and `rc.N+1`.
    - Performance: n/a.
    - Code Quality: n/a.
    - Security: provenance is verified (`npm audit signatures` or the registry attestation), and no token is stored (trusted publishing).
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - npm trusted publishing and provenance verification (npm ≥ 11.5.1).
    - Documentation Reviewed:
      - `.github/workflows/publish.yml:5,27,47-49`; plan 013 Task 10 notes.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - The 0.1.0 rc process.
    - API Notes and Examples:
      ```sh
      git tag v0.2.0-rc.1 && git push origin v0.2.0-rc.1   # only after the owner's go
      bun run release:gate -- --registry @arnilo/liveframe@0.2.0-rc.1
      ```
    - Files to Create/Edit:
      - `plans/evidence/020-release-candidate.md` (new); `plans/evidence/020-request-acceptance.md` (installed column)
  - Test Cases to Write:
    - None new.

  - Notes (executed 2026-10-29, owner's go: "Go: push main and tag"): `@arnilo/liveframe@0.2.0-rc.3` is on npm under `next` with SLSA provenance; `latest` is still `0.1.0`. The first push was refused (the `gh` token lacked the `workflow` scope; the owner refreshed it). Two defects came up, both in `scripts/demo-test.ts`, both only visible on CI: on a clean checkout under Bun 1.4.2, `bun add --no-save file:…` kept the registry `0.1.0` over the packed archive, so `demo:test` failed to typecheck. `v0.2.0-rc.1` and `v0.2.0-rc.2` (the second fix was incomplete) were tagged on `origin` and never published; rc.3 points the demo's dependency at the tarball for the run and was verified locally under `mise exec bun@1.4.2`. No package change between the rounds. Registry checks: archive gate with `--package` passed 11 steps in 5.5 s (the task's `--registry` flag does not exist), the demo copied outside the repo and installed from the registry passed typecheck and 52 tests, `npm audit signatures --include-attestations` verified the signature and the provenance attestation, and the installed-package rows passed with no MCP SDK or Playwright present. The version took about two minutes to appear after the workflow succeeded. Details, hashes and the table are in `plans/evidence/020-release-candidate.md`; `020-request-acceptance.md` gained an installed-candidate section rather than a column. Local `bun run check`: 847 pass, 4 skip, 0 fail.

- [x] Task 7: Run the agent acceptance test on the new authoring paths
  - Acceptance Criteria:
    - Functional: a fresh agent session gets only the installed rc's `README.md` and `docs/`, plus the running demo host. Without reading anything else, it:
      1. authors a widget that uses an object-carrying form event, a nullable field and a source-outcome envelope, through `/authoring` in-process, with an explicit runner;
      2. captures through `/preview/capture` with the Playwright backend;
      3. paints an ephemeral surface through `renderElements`;
      4. publishes and places the widget. The published hash equals the last previewed one.
    - Every guess, or read outside the published docs, is a docs finding. Each is fixed (with a new rc if the archive's docs change) or approved for the backlog.
    - The record goes to `plans/evidence/020-agent-acceptance.md`.
    - Performance: record the elapsed time and iterations.
    - Code Quality: n/a.
    - Security: law 4 — no action is dispatched. Law 1 — drafts reach only the runner.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`. If the owner wants the session run as a subagent, brief it with an explicit "use only these files" restriction.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Plan 013 Task 11 (precedent and findings).
    - Options Considered:
      - Re-running only the 0.1.0 MCP loop — rejected: the new paths are what changed.
    - Chosen Approach:
      - A real agent with only the docs.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/020-agent-acceptance.md` (new); docs, as findings require.
  - Test Cases to Write:
    - None. The evidence file is the record.

  - Notes (executed 2026-10-30): `plans/evidence/020-agent-acceptance.md` records a fresh session restricted to the registry-installed `0.2.0-rc.3` README/docs, the opaque documented config and public runtime results. The stock demo lacked an object-carrying event and source capability, so the operator augmented only an isolated host copy with a native form, nullable note and host-resolved source-outcome capability; the agent discovered these through refreshed introspection. The complete widget passed on its first content iteration: explicit `inProcessRunner()` through `/authoring`, two nullable/non-null scenarios, ten outcome checks (five statuses per seed), eight clean Playwright capture cells, an ephemeral `renderElements` surface painted through SSR and inspected in a browser, and HTTP install/place/surface 201/200/200. Authoring, last preview and installed hashes all equal `sha256-b2f8fca7d71e7cd6f7dbe7eeea188dee76d2e90dddf98f6cdb7648d92b8b17bc`. Actions stayed empty; browser inspection recorded seven GETs and zero page errors, with no intent or draft-module requests. Two API guesses (in-process runner cleanup and incomplete renderer bindings) were recorded and resolved by existing shipped docs, so no documentation change or new candidate was needed. The first full run took 1.748 s; the security-assertion replay took 1.543 s, ending 531.558 s after the fresh session began, including reading, fixture preparation and reporting. Local scripts, images and regeneration commands are named in the evidence; an independent artifact verifier passed. `bun run check`: 847 pass, 4 skip, 0 fail. No spec, API or repository demo change; Task 8's owner review remains pending.

- [ ] Task 8: Review every readiness item with the owner before release
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/020-release-readiness-review.md` lists every row from Tasks 1–7, every Compromise Made in plans 014–019, and every open finding they deferred.
      - Each row is marked fixed (with evidence) or deferred (with the owner's approval).
      - The owner answers go or no-go, and the answer is recorded verbatim. No-go returns to the named rows.
    - Performance: n/a.
    - Code Quality: n/a.
    - Security: the review includes `SECURITY.md` and `docs/security.md` against the new surfaces (`meta`, `/runner-kit`, `/authoring`, `checkOffered`).
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/evidence/012-release-readiness-review.md` (format); plan 013 Task 12.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - The 0.1.0 review format.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/020-release-readiness-review.md` (new)
      - `plans/evidence/020-request-acceptance.md` (correct a documentation evidence citation); this plan (review status and owner answer)
      - `docs/migration-0.2.md` (four missing security reminders); `CHANGELOG.md` (WebKit timing limitation); `plans/backlog.md` and `decision-logs/2026-10-30-0430-webkit-switching-budget-deferral.md` (owner-approved deferral)
  - Test Cases to Write:
    - None.

  - Notes (review prepared 2026-10-30; owner decision pending): `plans/evidence/020-release-readiness-review.md` reviews every acceptance item in Tasks 1–7, all 28 Compromises Made bullets in plans 014–019, their deferred findings and handoffs, and `SECURITY.md`/`docs/security.md` against `meta`, `/runner-kit`, `/authoring` and `checkOffered`. Existing owner dispositions are traced to their evidence and backlog entries. Two items require an explicit owner disposition: R1, WebKit headless switch timing (18–22 ms, tests permit 25.1 ms, which does not establish the normative 16.67 ms budget); R4, Task 3's four required migration-guide security reminders are absent, although the boundaries are documented in the shipped security/renderer/package guides and adoption notes. LF-08.4's request-acceptance evidence cited a nonexistent confirmation section in `docs/security.md`; its citation now names the actual renderer sections without changing shipped docs. Streaming patches remain an approved design deferral, and G29 retains the owner's explicit Windows/AT waiver. Fresh `timeout 900s bun run check`: passed, 847 pass, 4 skip, 0 fail; review self-check: 109 unique rows, all 28 compromises, links resolve; `git diff --check` passed. The owner's verbatim go/no-go is still required before checking Task 8; Task 9 remains separate.

  - Follow-up (2026-10-30): the owner answered, verbatim, "Fix the migration guide omissions. Defer the webkit switching budget issue". R4 is corrected in `docs/migration-0.2.md` §5: `meta` grants nothing, `confirm` is not authorisation, the runner kit is not isolation, and `checkOffered` is the host's job. R1 is explicitly deferred in the decision log, existing P1 backlog and changelog, retaining the 16.67 ms normative budget and unchanged tests. Because the guide and changelog ship in the archive, Task 7's rule requires a new verified release candidate; the current published rc.3 does not contain this follow-up. Follow-up checks passed: `timeout 900s bun run check` (847 pass, 4 skip, 0 fail), local `timeout 300s bun run release:gate` (all 11 steps, 6.6 s), reminder/link self-check and `git diff --check`. Final owner release go/no-go remains pending; the finding-disposition answer is recorded without interpreting it as permission to push a release tag.

- [ ] Task 9: Publish 0.2.0 and verify it from the registry
  - Acceptance Criteria:
    - Functional:
      - `package.json` `version` is `0.2.0`. `bun run check` and the archive gate pass.
      - After the owner's go in Task 8, push the `v0.2.0` tag. The workflow publishes under `latest` with provenance.
      - From the registry: `npm view @arnilo/liveframe version` is `0.2.0`, the archive gate in registry mode passes, and the demo host from the registry passes `demo:test`.
      - `CHANGELOG.md` dates the entry.
      - `roadmap.md` §3 records the release in one line.
      - Both request documents' status lines name `0.2.0`.
    - Performance: n/a.
    - Code Quality: n/a.
    - Security: provenance is verified, as in Task 6.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - none beyond Task 6.
    - Documentation Reviewed:
      - Plan 013 Task 13 notes.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - The 0.1.0 publish process.
    - API Notes and Examples:
      ```sh
      git tag v0.2.0 && git push origin v0.2.0   # only after Task 8's go
      ```
    - Files to Create/Edit:
      - `package.json`; `CHANGELOG.md`; `roadmap.md`; `plans/requests/*.md`; `plans/evidence/020-release.md` (new)
  - Test Cases to Write:
    - None new.

- [ ] Task 10: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/020-impact-analysis.md` sweeps all 12 areas against the released 0.2.0, with area 12 (Reference hosts) recording what Synapta and Clay can now adopt and any remaining gaps.
      - Findings are presented to the owner and disposed of, then Compromises Made and Further Actions are handed off to `plans/backlog.md`.
    - Performance: n/a.
    - Code Quality: n/a.
    - Security: confirm that the published archive matches the reviewed one: compare its hash with the rc's verified contents.
  - Approach:
    - Skills to Use:
      - `create-plan`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Reference §5.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - The standard sweep.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/020-impact-analysis.md` (new); `plans/backlog.md`; this plan; `roadmap.md`.
  - Test Cases to Write:
    - None.

## Verification (whole plan)
- `bun run check`
- `bun run bench`
- `bun run release:gate`
- `bun scripts/release/peer-floors.ts`
- `bun run demo:test`
- `npm view @arnilo/liveframe version` (after Task 9)

## Compromises Made
- To be filled after tasks are completed and tests pass.

## Further Actions
- To be filled after task completion with improvements, rationale, and priority.
