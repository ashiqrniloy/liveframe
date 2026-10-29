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

- [ ] Task 2: Run the native forced-colours and assistive-technology audit (G29)
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
  - Notes (2026-10-29, agent half done, task not closed): `plans/evidence/020-g29-audit.md` is written — 61 rows in eight sections (forced colours, edges and fill indicators, overlays, keyboard, native controls and scrollbars, the 0.2.0 surfaces `none`/alpha/scrollbar properties/`transparency`, assistive technology, baseline). Each row names a page URL, a control by its visible label, the steps and the expected result, and leaves a `Result` cell empty; the file also carries the machine/OS/browser/AT record to fill, the exact expectations the projection emits (1px `Highlight` hover/active/open, 2px `Highlight` focus, `Highlight`/`HighlightText` selected, `GrayText` disabled, inward 1px `CanvasText` edges and `lf_fill`, `scrollbar-color:auto`, `::placeholder` `GrayText`), and a table of what Chromium already proves so the run does not re-derive it. Preparation is reproducible: `mise install` (Bun 1.4.2), `bun install`, `bun run proof` → `http://127.0.0.1:3000`, with a note to restart the host between recorded passes because intents mutate sessions. Rows the proof cannot reach are labelled `n/a` with a reason rather than left to guess: `invalid` has no proof widget, `placeholderColor` has no proof recipe, and 0.2.0's explicit `transparency` attribute is DevTools-only because the host has no transparency switch. Findings that shaped the checklist: the host's design-system `<select>` is the only way to see one page under both systems, `/ui/agent-home?scenario=ready` is the only scenario whose task card is selected by default, and the proof host serves the SDK fixture widgets rather than `proof/widgets/`. `plans/backlog.md`'s G29 line is narrowed to point at this record and to the remaining run; `proof/GAPS.md` "G29 partly automated" says the same. Not done, and not doable from this Linux host: the Windows run itself (acceptance 2), and therefore the defect dispositions (acceptance 3). If 0.2.0 ships before the run, the release notes keep G29 as a known limitation.

- [ ] Task 3: Write the migration guide, adoption notes and changelog
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

- [ ] Task 4: Prove every request's acceptance criteria against the checkout
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

- [ ] Task 5: Bump to 0.2.0-rc.1 and prove the archive locally
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

- [ ] Task 6: Publish the release candidate under `next` and verify it from the registry
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

- [ ] Task 7: Run the agent acceptance test on the new authoring paths
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
  - Test Cases to Write:
    - None.

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
