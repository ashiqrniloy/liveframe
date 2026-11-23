# Phase 7 Part AC: Release 0.4.1

Depends on: plan [041](041-Phase-7-Part-AB-Request-Scope-And-0-4-1-Security-Hardening.md) complete (its Task 1 scope decision places LF-18, LF-21, LF-25, LF-26's draft bounds, LF-27, LF-34, LF-36's guide change and LF-65 in 0.4.1, and its fixes are what this plan documents and releases). Followed by plan [043](043-Phase-7-Part-AD-Release-0-5-0-Scope-Stored-Documents-And-Content-Integrity.md), which generates the `0.4.1*.json` API baselines from the `v0.4.1` tag, and plan [046](046-Phase-7-Part-AG-Incremental-Validation-Streaming-And-Hydration.md), which holds the 0.5.0 half of LF-36. Source: [`requests/synapta-0.4.0-requests.md`](requests/synapta-0.4.0-requests.md), LF-65 and the 0.4.1 half of LF-36.

## Objectives

- Correct the three statements in `docs/security.md` that the 0.4.0 evaluation found wrong, and make every corrected statement cite a test that fails when the statement stops being true (LF-65).
- Publish one checklist page that says, row by row, what the library checks and what the app must do (LF-65).
- Replace the documented streaming loop, whose cost grows with the square of the document, with one that sends at most one update per frame, and execute the documented loop in a test (LF-36, 0.4.1 half).
- Record the cost of the old and the new loop as the baseline that plan 046 must beat.
- Document 0.4.1, prove every acceptance criterion of plans 041 and 042, and publish all four packages at `0.4.1` with provenance.

## Expected Outcome

- `docs/security.md` no longer says a template's cost is bounded by `limits.steps` alone, that `hash-mismatch` catches substituted content, or that the A2UI converter's work is bounded, unless a named test proves it. A `## 0.4.1 audit` section lists each fix of plan 041 with its law and its test.
- `docs/security-checklist.md` exists, is shipped in the archive, and is linked from `README.md` and `docs/host.md`. Every row links to a test in this repository or to the request that tracks the gap.
- `docs/sdk.md` "Draw agent JSON while it streams" shows a coalescing loop. `src/__tests__/sdk-guide.test.ts` runs that loop as written and checks how many updates it sends.
- `plans/evidence/042-stream-loop-baseline.md` holds the measured cost of the 0.4.0 loop and the coalescing loop at 1,003 and 4,003 nodes.
- `CHANGELOG.md` § 0.4.1, `docs/compatibility.md` § 0.4.1 and `docs/adopters-0.4.md` § 0.4.1 are complete.
- `plans/evidence/042-acceptance.md` lists every acceptance bullet of plans 041 and 042 with its proof.
- `@arnilo/liveframe`, `@arnilo/liveframe-runner-quickjs`, `@arnilo/liveframe-starter` and `@arnilo/liveframe-a2ui` are on npm at `0.4.1` with provenance, and `latest` and `next` both point at `0.4.1`.

This plan implements the release step of the 0.4.1 patch in roadmap Phase 7, under the scope decision plan 041 Task 1 records. It changes documentation, one test, one bench file and the version fields. It changes no export, no format and no spec meaning, so it needs no register entry of its own. A defect that a later task here finds reopens the owning task in plan 041, or becomes a numbered follow-up task above the release candidate. What does not ship: content pinning (LF-19), URL host rules (LF-20), server-side confirmation and intent identity (LF-22, LF-23) and the pull form of `streamElements` (LF-36, 0.5.0 half). The checklist page names each as a duty the app holds today. Publishing, and pushing `main` or a tag, needs the owner's explicit go in Tasks 1, 9 and 10.

## Rules for every task

1. **Patch-safe only.** Per `docs/compatibility.md` ("The 0.4.x promise"), a patch preserves the public API, the formats, the `fileStore` layout, existing corpus expectations, hash vectors and published schema meanings. A task here that would need a `removed` or `changed` register entry stops and goes to the owner.
2. **Docs link by absolute URL outside the archive.** `docs_links_resolve` (`src/__tests__/docs-links.test.ts:19-44`) fails a relative link from `docs/` or `README.md` to a file the npm archive does not hold. Tests, plans, requests and decision logs are not in the archive (`package.json:166-173`), so docs link to them as `https://github.com/ashiqrniloy/liveframe/blob/main/…`, as `docs/compatibility.md` already does.
3. **Docs describe what ships.** `shipped_docs_never_call_exports_planned` (`src/__tests__/docs-wording.test.ts:26`) stays green. A row about work that has not shipped says what the library does not check today and links the request. It does not name a future API.
4. **No wall-clock assertion in `bun run check`.** Timings are measured in `bench/` and recorded in `plans/evidence/` (plan 033, G1).

## Handoffs from sibling plans

The sixteen plans of this family were drafted in parallel from one request document. These are the points the other plans' surveys raised that bear on this one. Settle each before the task it names starts. Where a sibling plan has changed since, its file wins and this list is amended.

- **Cite plan [041](041-Phase-7-Part-AB-Request-Scope-And-0-4-1-Security-Hardening.md)'s tests by the names it delivered**, read from its impact analysis. Plan 041 leaves the `docs/security.md` wording for LF-18, LF-21 and LF-25 to this plan.
- **Two limits belong in the checklist** (plan 041's survey): a runner that crosses a boundary can still return typed errors with any message text, and node ids carry author-chosen keys. Both can reach logs.
- **Task 2's characterisation test for `hash-mismatch` is temporary by design.** Plan [043](043-Phase-7-Part-AD-Release-0-5-0-Scope-Stored-Documents-And-Content-Integrity.md) (LF-19) inverts its second half for a pinned placement.
- **Task 4's bench file and baseline are extended, not replaced.** Plan [046](046-Phase-7-Part-AG-Incremental-Validation-Streaming-And-Hydration.md) (LF-36) adds its gate to `bench/stream-loop.bench.ts` and rewrites the guide's loop; plan [054](054-Phase-7-Part-AO-Template-Language-Data-Bound-Surfaces-And-Stream-Repair.md) adds rows to the same file.
- **The quiet-host rule in Task 7 is today's rule.** Plan [049](049-Phase-7-Part-AJ-Release-0-5-0.md) decides its replacement.
- **Plans [049](049-Phase-7-Part-AJ-Release-0-5-0.md) and [056](056-Phase-7-Part-AQ-Release-0-6-0.md) assume this plan's evidence names**: `plans/evidence/042-acceptance.md` and `042-acceptance-map.json`.

## Tasks

- [ ] Task 1: Check the patch gate and get CI green before any release work
  - Acceptance Criteria:
    - Functional:
      - Plan 041 is complete: every task ticked, its impact findings disposed, and `bun run check` green on `main`.
      - Every entry in `scripts/release/api/register-0.4.1.json` and `register-0.4.1-starter.json` is `added` or `widened`, names its plan 041 task, and has a `hostAction` that Task 5 can carry into the adopter notes (`register_host_actions_appear_in_adopter_notes`, `src/__tests__/api-stability.test.ts:244`).
      - `@arnilo/liveframe-runner-quickjs` and `@arnilo/liveframe-a2ui` are compared against their 0.4.0 baselines with no register (`src/__tests__/api-stability.test.ts:83-98`). If plan 041 changed a declaration in either (LF-21 touches the runner's result handling, LF-25 the converter), this task adds `register-0.4.1-runner-quickjs.json` or `register-0.4.1-a2ui.json`, reads it in those two tests, and adds it to `register_0_4_1_holds_only_additive_entries`. If neither changed, the task records that and adds nothing.
      - No existing file under `conformance/corpus/`, `conformance/hash/` or `conformance/patch/` differs from `v0.4.0` (`git diff --stat v0.4.0 -- conformance` shows additions only). New hostile-template and other cases from plan 041 are additions.
      - `.github/workflows/publish.yml` installs browsers the way `ci.yml` does (plan 040 Task 2's notes left the publish workflow on the older install step; `publish.yml:38`, `:55`). The step is aligned or the difference is recorded as deliberate.
      - With the owner's go to push `main`, `ci.yml` is green on the pushed commit: Chromium, WebKit, Firefox, the archive gate for four packages, the three peer floors, the demo and the guide. The run id is recorded in the task notes.
    - Performance: n/a — gate checks. A raised test timeout is not a performance claim.
    - Code Quality: any new register file uses the existing entry shape (`subpath`, `name`, `change`, `reason`, `hostAction`, `task`); no second gate.
    - Security: no law-enforcing assertion is weakened to make a gate pass. The API gate protects every law's public contract from an unreviewed change.
  - Approach:
    - Skills to Use:
      - `verify-and-stop` — this task proves a state; it does not grow scope.
      - `investigate-first` — for a CI failure, to separate a load flake from a defect before editing.
      - `liveframe-execution` — routes to the release and API-gate references.
    - Library Documentation to Check Before Implementation:
      - none new. Bun's `test(name, fn, timeoutMs)` and Playwright's browser install were checked for plan 040 Task 2 (Bun 1.4.2, Playwright 1.64.1).
    - Documentation Reviewed:
      - `docs/compatibility.md:17-31` (patch rule, the 0.4.x promise); `src/__tests__/api-stability.test.ts:66-98`; plan 040 Task 2 notes (CI run 44876354038 was the last green `main`; the load-only failures and their timeouts).
    - Options Considered:
      - Skip the gate check and rely on Task 9's publish workflow — rejected: a red gate found at the tag costs a second candidate.
      - Give the two register-less companions empty register files now — rejected unless needed: an empty file that nothing requires is one more thing to keep in step.
    - Chosen Approach:
      - Read the registers and the diff against `v0.4.0`, fix or record what is found, then push with the owner's go and record the green run.
    - API Notes and Examples:
      ```sh
      timeout 60 git diff --stat v0.4.0 -- conformance schemas
      timeout 120 bun test --conditions liveframe:source ./src/__tests__/api-stability.test.ts
      ```
    - Files to Create/Edit:
      - `scripts/release/api/register-0.4.1-runner-quickjs.json`, `register-0.4.1-a2ui.json` (tentative — only if plan 041 changed a declaration in that package).
      - `src/__tests__/api-stability.test.ts` (tentative — only with a new register file).
      - `.github/workflows/publish.yml` (tentative — only if the install step differs from `ci.yml` without a reason).
  - Test Cases to Write:
    - `register_0_4_1_holds_only_additive_entries` (existing): extended to any new companion register. Breaks when an entry is `removed` or `changed`.
    - `baseline_0_4_0_matches_the_companion_packages` and `a2ui_baseline_0_4_0_matches_the_checkout` (existing): read the new register if one is added. Break on an unregistered declaration change.
  - Notes (executed 2026-11-23, open until the push):
    - Plan 041 is complete: Tasks 1–12 with 11a and 11b ticked, and the owner approved all seven impact findings (F1–F3 executed, F4–F7 in the backlog). `bun run check` on `main` at `3bf9918` passed with 2,182 tests passed, 6 skipped and 0 failed (893 s, load about 8–10). A stack trace for "Widget threw Error" from `proof/host/pages.ts` while building a session was logged during `proof/tests/host.test.ts`. That file did not fail.
    - `register-0.4.1.json` holds 16 entries, all `added` or `widened`, each naming its plan 041 task (T4, T5 or T6) and carrying a `hostAction`. `register-0.4.1-starter.json` is empty.
    - Plan 041 changed implementation only in `packages/runner-quickjs` and `packages/a2ui`. `api-stability.test.ts` passed 18 of 18, comparing both against their 0.4.0 baselines with no register. No companion register was added.
    - `git diff --diff-filter=MDR v0.4.0 -- conformance schemas` is empty. `git diff --stat` shows 8 added corpus files (1,463 insertions) only.
    - `publish.yml:55` now installs the Playwright 1.49 floor with `bunx --bun playwright@1.49.0 install --with-deps --only-shell chromium`, as `ci.yml:53` has since `7893b28`, when Node 26's installer stalled. The difference at `publish.yml:38` is deliberate. The publish job runs only the Chromium `bun run check`, so it installs only Chromium, where `ci.yml:32` also runs the WebKit and Firefox suites.
    - Open: pushing `main` (17 commits ahead of `origin/main`) needs the owner's go, then a green `ci.yml` run to record here. The last `main` run, 44954949057, failed on the known WebKit flake `overlay_content_receives_pointer_events` (backlog).

- [x] Task 2: Correct the security guide and add the 0.4.1 audit (LF-65)
  - Acceptance Criteria:
    - Functional:
      - **Template bounds (LF-18).** `docs/security.md:18`, `:20`, `:22` and `:46` say what bounds a template after plan 041: which work is charged to `limits.steps` (expression operators, emitted elements, `$use`, and string and array operators by output size), that `limits.nodes` stops emission at the first element over the limit, and the measured worst render the default budget allows, taken from the bench gate plan 041 adds. The "about 2.5 ms" figure and the recommendation of `templateRunner()` for authors the host does not trust stay only with the new measured number and its test beside them. The sentence that `templateRunner()` has no wall-clock timeout stays.
      - **What `hash-mismatch` covers (LF-19).** `docs/security.md:8` and `:70` say that `hash-mismatch` detects a record whose content no longer matches its own `hash` field, which is corruption or a careless edit. They say that a store which returns different content under the same `id@version` with the hash recomputed is accepted, that a placement cannot pin content in 0.4.x, and that the app must control who can write its store. The "What is not protected" list gains this as its own bullet next to "A hash is integrity, not authorship".
      - **The A2UI bound (LF-25).** `docs/security.md:119` says what plan 041 bounds in `fromA2ui` (array indices and formatted output by `limits`, every thrown error returned as a typed failure) and cites its test.
      - A `## 0.4.1 audit` section follows the `## 0.4.0 audit` sections' form: one bullet per plan 041 fix (LF-18, LF-21, LF-25, LF-26's draft bounds, the six LF-27 defects, LF-34), each with the law it touches and its test. The LF-21 bullet restates the event promise ("`HostEvent`s carry ids, kinds and reasons, never values", `docs/security.md:66`) and cites the test plan 041 adds for `src/host/types.ts:75-77`.
      - Every corrected statement and every audit bullet ends with a citation: an absolute link to the test file and the test's name in backticks. LF-65's acceptance "each corrected statement cites a test" is checked by the test below, not by reading.
      - If plan 041 already corrected one of these sentences with its fix (LF-18's proposal includes the wording), this task checks it against the criteria above and adds the citation. It does not rewrite it.
    - Performance: n/a — documentation. The numbers quoted come from plan 041's bench gate, not from a new measurement.
    - Code Quality: one citation form for the whole page; the doc test parses that form and nothing else.
    - Security: laws 2 and 4 are described as they are enforced, no stronger. A statement with no test is removed or reworded as a duty of the app.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — docs are written for outsiders, and the spec wins on conflict.
      - `surgical-patch` — the characterisation test first, then the sentences.
    - Library Documentation to Check Before Implementation:
      - none; read `docs/security.md` whole (127 lines) and the tests plan 041 delivered for LF-18, LF-21, LF-25, LF-26 and LF-27.
    - Documentation Reviewed:
      - `docs/security.md:8` ("`hash-mismatch` on tampered content"), `:18` ("its work is counted against `limits.steps`"), `:20` (recommends `templateRunner()`), `:22` ("cap the cost of one render at about 2.5 ms"), `:46`, `:66`, `:70`, `:119` ("A hostile A2UI document is bounded (size, depth, node count) and yields errors, not a tree"). All three statements the request names are present as quoted.
      - Request LF-18, LF-19, LF-25 and LF-65; spec §7.4 (load), §7.6 (templates); `src/store/load.ts`, `src/pack/verify.ts` (the load path the LF-19 sentence describes).
    - Options Considered:
      - Delete the three statements — rejected: an adopter needs to know the bound, and after plan 041 two of the three are true with new numbers.
      - Cite tests by relative path — rejected: `docs_links_resolve` fails a relative link to a file outside the archive (rule 2).
      - Wait for LF-19 (plan 043) before touching the `hash-mismatch` sentence — rejected: the sentence is wrong in 0.4.x, and the request targets the wording for 0.4.1.
    - Chosen Approach:
      - Reword to what is enforced, cite the enforcing test, and add one doc test that checks every citation resolves to a real test. For LF-19, where 0.4.1 ships no fix, write a characterisation test that pins today's behaviour, so the sentence about the limit is also proved.
    - API Notes and Examples:
      ```md
      … stops with `limit-exceeded` at the first element over `limits.nodes`
      ([`template-limits.test.ts`](https://github.com/ashiqrniloy/liveframe/blob/main/src/__tests__/template-limits.test.ts), `fan_out_template_stops_at_the_node_limit`).
      ```
      The file and test names above are placeholders: use the names plan 041 delivered.
    - Files to Create/Edit:
      - `docs/security.md`: the three corrections, the new "not protected" bullet, the `## 0.4.1 audit` section.
      - `src/__tests__/security-guide.test.ts` (new): the citation check and the LF-19 characterisation.
      - `src/__tests__/docs-wording.test.ts` (tentative — only if the citation check fits better beside the other doc checks).
  - Test Cases to Write:
    - `security_guide_citations_name_existing_tests`: every `(…/blob/main/<path>), \`<name>\`` citation in `docs/security.md` and `docs/security-checklist.md` names a file that exists and contains `test("<name>"`. Fails when a cited test is renamed or deleted.
    - `security_guide_corrections_each_cite_a_test`: the paragraphs holding `limits.steps`, `hash-mismatch` and "A2UI document" each contain at least one citation. Fails when a correction loses its proof.
    - `hash_mismatch_detects_a_stale_hash_and_not_a_recomputed_one`: through `loadPlacement` with `verifiedPackages()` warm, a package whose content changed under an unchanged `hash` fails with `hash-mismatch`; the same `id@version` with different content and a recomputed hash loads. The second half documents the 0.4.x limit and carries a comment that plan 043 (LF-19) inverts it for a pinned placement. Fails today if either half is wrong, which is what makes the doc sentence true.
  - Notes (executed 2026-11-23):
    - `docs/security.md` changes:
      - Load step 2 and a new "What is not protected" bullet, "`hash-mismatch` is not a content pin", say what LF-19 asks.
      - The template section names both budgets and what each one charges. It drops "about 2.5 ms" (not re-measured after plan 041) and the claim that `limits.steps` is the only bound. It now cites `hostile_template_set_is_bounded` and the measured 5.2 ms worst render against the 50 ms gate, linked to `plans/evidence/041-template-cost.md`.
      - The `templateRunner()` recommendation now points to that bound. The "no wall-clock timeout" sentence stays.
      - The QuickJS section says "step and node limits".
      - The pipeline's `HostEvent` promise gains the LF-21 fixed-message clause.
      - The library-pin `hash-mismatch` sentence cites `pin_mismatch_hash_mismatch`.
      - The 0.4.0 A2UI sentence lists the LF-25 bounds.
      - A `## 0.4.1 audit` section has 11 bullets (LF-18, LF-21, LF-25, LF-26, the six LF-27 items, LF-34), each with its law and tests. It also names the two channels that stay open, runner-returned error text and author keys in ids. Plan 041 had not reworded any of these sentences.
    - The citation form is `[`file`](https://github.com/ashiqrniloy/liveframe/blob/main/<path>), `<test_name>``. The check also accepts `test.each(...)("name (%i …)")`, which `fan_out_of_use_stops_at_the_node_limit` and `static_fan_out_over_the_node_limit_is_rejected_at_install` use. Renaming a cited test to `…X` made `security_guide_citations_name_existing_tests` fail with the file and the name.
    - `hash_mismatch_detects_a_stale_hash_and_not_a_recomputed_one` uses a re-packed package under the same `id@version` as the substitution. It passes, so the 0.4.x limit the guide states is real.
    - For Task 3: the citation test already reads `docs/security-checklist.md` once it exists. Spec: no change. §7.4 and §7.6 already state the load check and both budgets.
    - `security-guide`, `docs-links` and `docs-wording` passed 9 of 9. Two full checks ran at load 17–30, from unrelated processes on the host. The first failed 58 tests: a `react-browser.test.tsx` case hit the 5 s timeout, the browser closed, and the rest of that file failed, along with two `authoring.test.ts` MCP-parity cases. This is the plan 041 F7 pattern. Those files plus the new test passed 89 of 89 on their own. The second `timeout 1800 bun run check` passed with 2,185 tests passed, 6 skipped and 0 failed.

- [ ] Task 3: Publish the adopter responsibility checklist (LF-65)
  - Acceptance Criteria:
    - Functional:
      - `docs/security-checklist.md` is one page with one table: the concern, what the library checks, what the app must do, and the proof (a test citation in Task 2's form) or the request that tracks the gap (an absolute link to the LF heading in the request document).
      - It has a row for each duty the request lists as unstated:
        - server-side confirmation of a `confirm` or `irreversible` action (LF-22);
        - idempotency and double submits (LF-23);
        - cross-site request forgery on the intent endpoint;
        - keying `Served` and action statuses per viewer session;
        - validating a widget author's literal action arguments against the viewer;
        - an image and link host policy, with `img-src` and `connect-src` (LF-20);
        - personal data in trees, patches and events (LF-21).
      - It also has a row for each boundary `docs/security.md` already states, so the page is complete on its own: runner isolation, template budgets (LF-18), package authorship and content pinning (LF-19), store tenancy and durability, `authorize` as the app's policy, serialising calls per placement and scope, agent drafts under `liveframe mcp` (LF-26), and the inline-style CSP that layout needs (`docs/styling.md:99`).
      - `README.md` links the page in its documentation list beside the security model (`README.md:233`), and `docs/host.md` links it from "What stays yours" (`docs/host.md:250`). `docs/security.md` links it from "What is not protected".
      - The page is in the archive: `bun pm pack --dry-run` lists `docs/security-checklist.md`.
    - Performance: n/a — documentation.
    - Code Quality: the page states duties and links proofs; it does not repeat the explanations in `docs/security.md` or `docs/host.md`.
    - Security: law 4 is the page's subject. No row claims a check the library does not make: a row whose proof is a request says "not checked by the library" in the library column.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — outsider docs; no adopter named as the reason for a row.
    - Library Documentation to Check Before Implementation:
      - none; read `docs/host.md:250-272` and `docs/security.md:72-86`.
    - Documentation Reviewed:
      - Request LF-65 (the six unstated duties) and LF-20, LF-21, LF-22, LF-23; `docs/host.md:261` (double submits are left to the host); `docs/security.md:66` (what the pipeline does not do).
      - `src/__tests__/docs-links.test.ts:19-44` (the archive rule for links).
    - Options Considered:
      - A new section inside `docs/security.md` — rejected: the request asks for one page an adopter can work through, and the security guide is prose about the model.
      - A machine-readable checklist with a generator — rejected: one table needs no tool, and Task 2's citation test already checks its proofs.
    - Chosen Approach:
      - One Markdown table, with Task 2's citation test extended to it.
    - API Notes and Examples:
      ```md
      | Concern | The library checks | Your app must | Proof or request |
      | --- | --- | --- | --- |
      | Double submits | A stale revision is refused (`checkOffered`). | Make `dispatch` idempotent or de-duplicate. | [LF-23](https://github.com/ashiqrniloy/liveframe/blob/main/plans/requests/synapta-0.4.0-requests.md) |
      ```
    - Files to Create/Edit:
      - `docs/security-checklist.md` (new).
      - `README.md`, `docs/host.md`, `docs/security.md`: one link each.
      - `src/__tests__/security-guide.test.ts`: the row and link checks.
  - Test Cases to Write:
    - `checklist_rows_each_link_a_test_or_a_request`: every table row's last cell holds a test citation or a link to the request document. Fails on a row with no proof.
    - `checklist_names_every_duty_the_request_lists`: the page contains the seven duty rows above, matched by a fixed list of phrases in the test. Fails when a row is dropped.
    - `checklist_is_linked_from_the_readme_and_the_host_guide`: both files link `security-checklist.md`. With `docs_links_resolve`, this also proves the page is shipped.

- [ ] Task 4: Coalesce the documented streaming loop and execute it in a test (LF-36, 0.4.1 half)
  - Acceptance Criteria:
    - Functional:
      - The loop in `docs/sdk.md` "Draw agent JSON while it streams" (`docs/sdk.md:288-306`) pushes every chunk and keeps only the latest tree. It diffs and sends at most once per frame interval, and once more after `end()`. The interval is a named constant and the clock is a function the host passes, so the loop starts no timer and does no background work.
      - The "Cost" bullet (`docs/sdk.md:333-335`) keeps the linear claim for `streamElements` alone and adds what the whole loop costs: one `diffTrees` on the host and one `applyPatch` plus arrival validation in the client per update sent, which is why the loop sends per frame and not per closed node.
      - `src/__tests__/sdk-guide.test.ts` extracts that fenced block from the guide and runs it as written, the way `src/__tests__/host-guide.test.ts:151-156` compiles the host guide's blocks. It injects a chunk source, a clock and a `send` spy.
      - With 4-character chunks and a clock that advances one frame every N pushes, the loop sends no more than one update per elapsed frame plus the final one. Applying every sent update in order with `applyPatch` gives the tree `renderElements` gives for the whole text.
      - A stream that fails (`next.ok === false`) sends nothing after the failure, as the 0.4.0 loop did.
      - `bench/stream-loop.bench.ts` measures both loops end to end (host `streamElements` and `diffTrees`, client `applyPatch` and `validateTree`) on generated documents of 1,003 and 4,003 nodes in 4-character chunks, and reports time and summed patch bytes with `metric()`. It sets no budget: plan 046 adds the gate (under 500 ms in total at 4,003 nodes, patch bytes under 1.5 times the document).
      - `plans/evidence/042-stream-loop-baseline.md` records the request's reproduced figures (0.86 s at 1,003 nodes; 16.0 s at 4,003 nodes, of which 3.4 s host `diffTrees` and 12.4 s client apply and accept; patch bytes three times the document), this host's re-measurement of the 0.4.0 loop, and the coalescing loop's figures, with the command that regenerates them.
    - Performance: no library code changes, so no existing budget moves. `bench/stream-elements.bench.ts` keeps its 3× gate. The new bench stage is informational in 0.4.1.
    - Code Quality: the guide block is the single source of the loop: the test runs the guide's text and the bench imports nothing from the guide but mirrors it in under 30 lines, with a comment naming the guide section. No new export.
    - Security: law 2 is unchanged and restated in the guide: every tree `push` returns has passed the compiled validator, and the client still validates every arrival. Coalescing drops intermediate trees; it never sends an unvalidated one.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — routes to the SDK and streaming references.
      - `surgical-patch` — a guide block, one test, one bench file.
    - Library Documentation to Check Before Implementation:
      - none. Read `src/sdk/stream.ts` (`push`, `end`), `src/validate/patch.ts` (`diffTrees`, `applyPatch`) and `bench/metrics.ts:14-32` (`metric`, `timed`, `budget`).
    - Documentation Reviewed:
      - Request LF-36: the reproduction table, and the proposal "in 0.4.1, the guide coalesces: push every chunk, and take a snapshot at most once per frame".
      - `docs/sdk.md:281-335`: the loop sends one patch per tree `push` returns, and `push` returns a tree whenever the completed nodes changed, so about one per closed node. Confirmed as the request describes.
      - `bench/stream-elements.bench.ts:13-16`: it gates only `streamElements` against `renderElements` (679 nodes, 64-byte chunks, 3×). Confirmed.
      - `src/__tests__/sdk-guide.test.ts:5-26`: today it checks that the widget example in the guide equals a fixture; it does not run the streaming loop.
      - `scripts/bench-quiet.ts:67-70`: bench stages are read from the `bench` script, so a stage added to `package.json` joins the quiet-host run with no other change.
    - Options Considered:
      - Change `streamElements` so `push` returns nothing until asked — rejected for 0.4.1: that is the pull form, an API change that plan 046 designs for 0.5.0.
      - Coalesce with `setInterval` or `requestAnimationFrame` in the example — rejected: the loop runs on the host, a timer adds background work the host must cancel, and a clock argument is testable.
      - Coalesce on chunk count — rejected: the client's budget is per frame, and chunk sizes vary by model.
      - Gate the new bench now — rejected: the loop still diffs whole trees, so its cost stays a function of document size until plan 046; a gate here would be set by today's defect.
    - Chosen Approach:
      - A time-sliced send inside the existing `for await` loop, with the final tree sent whole after `end()` as today.
    - API Notes and Examples:
      ```ts
      const FRAME_MS = 16;
      const stream = streamElements({ validator, surfaceId: "chat-42" });
      let latest: UiTree | undefined; // the newest tree; most are never sent
      let shown: UiTree | undefined; // the tree the client holds
      let sentAt = 0;
      const flush = () => {
        if (!latest || latest === shown) return;
        if (shown) {
          const patch = diffTrees(shown, latest);
          if (patch.ok) send({ patch: patch.value });
        } else send({ tree: latest });
        shown = latest;
      };
      for await (const chunk of llm) {
        const next = stream.push(chunk);
        if (!next) continue; // nothing new has completed
        if (!next.ok) break; // malformed JSON or a limit: `next.errors` says where
        latest = next.value;
        if (now() - sentAt >= FRAME_MS) {
          flush();
          sentAt = now();
        }
      }
      const final = stream.end(); // the same result `renderElements` gives the whole text
      if (final.ok) send({ tree: final.value });
      ```
      This is the proposal. The executor confirms against `src/sdk/stream.ts` that a failed `diffTrees` cannot leave `shown` ahead of the client, and sends the whole tree in that case.
    - Files to Create/Edit:
      - `docs/sdk.md`: the loop, the paragraph after it and the "Cost" bullet.
      - `src/__tests__/sdk-guide.test.ts`: extract and run the block.
      - `bench/stream-loop.bench.ts` (new); `package.json`: the stage appended to `bench`.
      - `plans/evidence/042-stream-loop-baseline.md` (new).
      - `docs/spec.md`: none — §7.2 (`docs/spec.md:784`) describes `streamElements`, not the host's loop, and its meaning does not change. Confirm while editing.
  - Test Cases to Write:
    - `stream_guide_loop_sends_at_most_one_update_per_frame`: runs the guide's block over a 1,003-node document in 4-character chunks with a stepped clock, and asserts the number of `send` calls is at most the frames elapsed plus two. Fails if the guide goes back to sending per tree.
    - `stream_guide_loop_reaches_the_tree_render_elements_gives`: applies the sent frames in order and compares the result to `renderElements` of the whole text. Fails if coalescing drops the last nodes or sends a patch against the wrong base.
    - `stream_guide_loop_sends_nothing_after_a_failure`: a stream with malformed JSON part-way sends no frame after the failing `push`. Fails if `flush` runs on the error path.

- [ ] Task 5: Write the 0.4.1 release documentation
  - Acceptance Criteria:
    - Functional:
      - `CHANGELOG.md` gains `## 0.4.1 — unreleased` above `## 0.4.0` (`CHANGELOG.md:5`); Task 10 dates it. It has a `Fixed` line for each plan 041 fix that changes an outcome, naming the case that changed (rule 2 of plan 033 is the model: an outcome changes only where it was wrong), an `Added` line for every `register-0.4.1*.json` entry, and a `Documentation` line for the security corrections, the checklist page and the streaming loop.
      - `docs/compatibility.md` gains `## 0.4.1` above `## 0.4.0` (`docs/compatibility.md:23`), written like `## 0.2.3` (`:49-61`): what a host upgrading from 0.4.0 changes (nothing), then the inputs that already broke the contract and now give a different outcome. At least:
        - a template whose expansion exceeds `limits.nodes` or whose element and `$use` work exceeds `limits.steps` now stops with `limit-exceeded` (LF-18), with a note for a host that lowered `limits.steps` close to a real widget's need;
        - a thrown non-`LiveframeFailure` in a widget reaches host errors and `HostEvent`s as a fixed message (LF-21);
        - an A2UI document that asks for a large index or output returns errors (LF-25);
        - an oversized draft is refused before transpiling (LF-26);
        - the six LF-27 cases.
      - `docs/adopters-0.4.md` gains `## 0.4.1 — security hardening` with one row per item (LF-18, LF-21, LF-25, LF-26's bounds, LF-27, LF-34, LF-36's guide change, LF-65): the problem in general terms, what shipped, the spec section and the limit that remains. Every register `hostAction` appears there. Its "Not delivered" table (`docs/adopters-0.4.md:70`) names the items that wait for 0.5.0 and 0.6.0 by LF id and links the request document.
      - `README.md:240` names `0.4.1` as the latest release once Task 10 publishes; until then the line is unchanged.
      - `SECURITY.md` is reviewed: supported versions name 0.4.x.
      - `docs-wording`, `docs-links`, `docs-spec-structure` and `migration-guide` tests pass. No doc says a 0.5.0 item shipped.
    - Performance: n/a — documentation.
    - Code Quality: no `docs/migration-0.4.1.md`: a patch has no break, so the compatibility section carries the outcome changes, as 0.2.3 did.
    - Security: the compatibility section states each changed outcome as fail-closed: every case listed was accepted or leaked before and is refused or redacted now.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — docs for outsiders; spec wins on conflict.
    - Library Documentation to Check Before Implementation:
      - none. Local: `scripts/release/api/register-0.4.1*.json`, plan 041's task notes.
    - Documentation Reviewed:
      - Plan 040 Task 3 (the pattern); `docs/compatibility.md:49-61` (the 0.2.3 patch section); `docs/adopters-0.2.md:73` (a patch section in adopter notes); `src/__tests__/api-stability.test.ts:244` (host actions must appear in adopter notes).
    - Options Considered:
      - A separate `docs/adopters-0.4.1.md` — rejected: 0.2.x kept patch sections inside the minor's adopter notes.
      - Leave outcome changes to the changelog — rejected: the compatibility page is where a host checks what a version bump may change.
    - Chosen Approach:
      - The 0.2.3 patch-documentation pattern inside the 0.4 documents.
    - API Notes and Examples: n/a.
    - Files to Create/Edit:
      - `CHANGELOG.md`; `docs/compatibility.md`; `docs/adopters-0.4.md`; `SECURITY.md` (only if the review finds a stale line).
      - `src/__tests__/docs-wording.test.ts`: the new check below.
  - Test Cases to Write:
    - `changelog_0_4_1_has_a_line_for_every_register_entry`: each `name` in `register-0.4.1*.json` appears in the 0.4.1 changelog section. Fails when an addition ships undocumented.
    - `register_host_actions_appear_in_adopter_notes` (existing): fails when a 0.4.1 entry's `hostAction` is missing from `docs/adopters-0.4.md`.
    - `no_doc_presents_a_later_release_item_as_shipped`: outsider docs do not contain the phrases "from 0.5.0" or "in 0.5.0" outside the "Not delivered" table and the checklist's request column. Fails when a deferred item is described as available.

- [ ] Task 6: Prove every acceptance criterion of plans 041 and 042 against the checkout
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/042-acceptance.md` is generated with one row per acceptance bullet of plans 041 and 042, joined through `plans/evidence/042-acceptance-map.json`.
      - Every row is `pass`, `n/a`, `pending` (a bench row waiting on Task 7), or names a follow-up task added above Task 9 and executed before the candidate.
      - The rows for the request's own acceptance bullets are present and pass: LF-18 (the reproduction returns `limit-exceeded` in under 5 ms with under 1 MiB of growth at 10 and 16 components; the hostile corpus cases; the worst-render bench gate; unchanged fixtures), LF-21, LF-25, LF-26's bounds, LF-27's six regression tests, LF-34's 64-pair bench, LF-36's guide loop and LF-65's citations and links.
    - Performance: bench rows cite `plans/evidence/042-bench.md` (Task 7).
    - Code Quality: the same generator and map format as plans 032 and 040 (`scripts/release/acceptance.ts`); no second generator.
    - Security: a row that enforces a law cites a test that fails when the law is broken (a template cannot spend unbounded host time; widget-thrown text never reaches a `HostEvent`).
  - Approach:
    - Skills to Use:
      - `verify-and-stop` — proof only.
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed:
      - Plan 040 Task 4 and its notes; `scripts/release/acceptance.ts:440-450` (`--plans`, `--map`, `--bench`, `--out`, `--skip-runs`); `src/__tests__/acceptance-script.test.ts:68-81`.
    - Options Considered:
      - A hand-written checklist for a small patch — rejected: the script re-runs, and the map test catches a bullet added later.
    - Chosen Approach:
      - The generated acceptance log.
    - API Notes and Examples:
      ```sh
      bun scripts/release/acceptance.ts --plans 041-042 --map plans/evidence/042-acceptance-map.json \
        --bench plans/evidence/042-bench.md --out plans/evidence/042-acceptance.md
      ```
    - Files to Create/Edit:
      - `plans/evidence/042-acceptance-map.json` (new); `plans/evidence/042-acceptance.md` (generated).
      - `src/__tests__/acceptance-script.test.ts`: the map coverage test.
  - Test Cases to Write:
    - `acceptance_map_covers_every_bullet_of_plans_041_to_042`: the real plans against the real map, without running the proofs. Fails on an unmapped bullet or a stale key.

- [ ] Task 7: Run the benchmark suite under the quiet-host rule
  - Acceptance Criteria:
    - Functional:
      - `bun scripts/bench-quiet.ts --out plans/evidence/042-bench.md` runs every stage of `bun run bench`, including the stages plans 041 and 042 added (the LF-18 worst-render gate, the LF-34 64-pair validator-cache gate and the informational stream-loop stage).
      - The quiet rule is the one in force (whole-host CPU below 10%, benchmark included; `decision-logs/2026-11-20-2319-release-0-4-0-scope.md`): three attempts, then the best attempt goes to Task 10's readiness review.
      - A budget that fails on a quiet host stops the task and reopens the owning task in plan 041. No threshold changes without an owner decision log.
      - A run that is not quiet does not close this task by itself. It closes with a clean record, or with an owner decision log that accepts the partial evidence, as plan 040 Task 5 did.
      - The open backlog entry "Re-run the full benchmark suite on a quiet host" gets a status line with this run. Making the rule passable is plan [049](049-Phase-7-Part-AJ-Release-0-5-0.md) (LF-41), not this task.
      - Task 6's log is regenerated afterwards so its `pending` rows resolve.
    - Performance: this task is the proof for the patch: the two new gates pass, and no 0.4.0 gate regresses.
    - Code Quality: the existing sampler; no new harness.
    - Security: the LF-18 gate is a security bound measured as time. Its record states the worst render the default budget allows.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
      - `investigate-first` — if a budget fails.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed:
      - Plan 040 Task 5 notes and `plans/evidence/040-bench-attempt-best.md` (three attempts, none quiet; the validator stage exited 1 at 13.1% host CPU); `decision-logs/2026-11-21-2218-close-plan-040-task-5-on-partial-benchmark-evidence.md`; `scripts/bench-quiet.ts:67-70`.
    - Options Considered:
      - Skip the bench for a patch — rejected: plan 041 adds two gated budgets and changes the template hot path, where "every existing template fixture renders the same tree" also needs the template bench to hold.
      - Change the quiet rule here — rejected: that is LF-41's decision in plan 049.
    - Chosen Approach:
      - The established quiet-host run, with the established fallback.
    - API Notes and Examples:
      ```sh
      bun scripts/bench-quiet.ts --out plans/evidence/042-bench.md
      ```
    - Files to Create/Edit:
      - `plans/evidence/042-bench.md`, or `042-bench-attempt-*.md` if no attempt is clean.
      - `plans/backlog.md`: a status line.
      - `decision-logs/<date>-close-plan-042-task-7-on-partial-benchmark-evidence.md` (tentative — only if the owner accepts partial evidence).
  - Test Cases to Write:
    - n/a — measurement task.

- [ ] Task 8: Run the agent acceptance test on the 0.4.1 paths
  - Acceptance Criteria:
    - Functional:
      - A fresh agent works only from the packed archives' READMEs and docs, the `liveframe mcp` tools and the host that `scripts/agent-acceptance/prepare.ts` builds. It:
        1. writes a host loop from the streaming guide alone and streams a supplied element JSON document of about 1,000 nodes through it; the recorded number of updates sent is bounded by frames, and the final tree equals `renderElements` of the text;
        2. submits a draft over the new draft bound through `pack_draft`, reads the typed error, and submits a draft that fits;
        3. writes a template that trips the new `limit-exceeded` (a fan-out through `$use`), reads the error and its pointer, and repairs it;
        4. answers, from `docs/security-checklist.md` alone, which of the seven listed duties a host must implement itself in 0.4.1.
      - The transcript, tool calls and outcome are recorded in `plans/evidence/042-agent-acceptance.md`.
      - A gap the run finds is a finding. The owner decides whether it is fixed before the candidate.
    - Performance: n/a.
    - Code Quality: scripted parts extend `scripts/agent-acceptance/` (`prepare.ts`, `mcp-session.ts`); nothing is copied.
    - Security: law 4 — the transcript shows no MCP tool dispatched an action. The repaired template and draft are accepted only after they pass the same checks as any other.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
      - `run` — the acceptance host.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed:
      - Plan 040 Task 6 and `plans/evidence/040-agent-acceptance.md` (the fresh-agent pattern and its two recorded host-guide discrepancies); `scripts/agent-acceptance/`.
    - Options Considered:
      - Mark the run `n/a` for a patch — rejected: three of the changes are things an agent meets directly (the guide loop, the draft bound, the template bound), and their error messages are only proved usable by an agent using them.
      - Repeat the full 0.4.0 run — rejected: those paths did not change.
    - Chosen Approach:
      - The fresh-agent pattern, limited to the four paths this patch changes.
    - API Notes and Examples: n/a.
    - Files to Create/Edit:
      - `plans/evidence/042-agent-acceptance.md`.
      - `scripts/agent-acceptance/prepare.ts`: the supplied 1,000-node document and the oversized draft fixture.
      - `scripts/agent-acceptance/fixtures/` (new fixture files).
  - Test Cases to Write:
    - n/a — acceptance run.

- [ ] Task 9: Bump to `0.4.1-rc.1`, publish under `next` and verify from the registry
  - Acceptance Criteria:
    - Functional:
      - Prerequisites, before the tag: Tasks 1–8 complete; the four packages' trusted publishers still allow `npm publish` and `npm dist-tag`; CI is green on the candidate commit.
      - One commit: all four packages at `0.4.1-rc.1`; companions peer on `~0.4.0-0` (the range `scripts/release/versions.ts` requires for a prerelease of `0.4.x`); `src/__tests__/workspace.test.ts` and the companion READMEs updated; `bun.lock` refreshed.
      - The API gate still compares against the `0.4.0*.json` baselines through the 0.4.1 registers. No `0.4.1*.json` baseline is generated here: plan 043 generates them from the `v0.4.1` tag.
      - `release:versions --tag v0.4.1-rc.1` passes. With the owner's go, the tag is pushed and the protected workflow publishes all four packages under `next` with provenance.
      - From a fresh directory:
        - each package's archive gate (`archive-gate.ts --dir <dir> --package <name>@0.4.1-rc.1`);
        - the installed API against the 0.4.0 baselines through the registers;
        - `getting-started-test.ts --registry` and `demo-test.ts --registry`;
        - `npm audit signatures --include-attestations` with an empty `--cache`;
        - `npm view <pkg> dist-tags` for all four: `next` is `0.4.1-rc.1`, `latest` is still `0.4.0`.
      - The installed archive holds `docs/security-checklist.md`.
      - `plans/evidence/042-release-candidate.md` records commands and outputs.
    - Performance: n/a.
    - Code Quality: no manual publish; CI only.
    - Security: every package has provenance attestations at `0.4.1-rc.1`.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - npm CLI 12.2.1, checked through Context7 (`/npm/cli/v12.2.1`, 2026-11-22): a trusted publisher is granted permissions per operation, so publish and dist-tag are enabled separately on each package. `publish.yml:88-92` pins `npm@12.2.1` for `npm dist-tag add`, which trusted publishing permits only on npm ≥ 11.21.0 (≥ 12.2.0 on 12.x). Re-check only if the workflow's pinned npm changes.
    - Documentation Reviewed:
      - Plan 040 Task 7 and `plans/evidence/040-release-candidate.md`; `docs/compatibility.md:197-209` (release process and checklist); plan 025 Task 9 (the last patch candidate, `0.2.3-rc.1`).
    - Options Considered:
      - Publish `0.4.1` with no candidate — rejected: the checklist page and the changed outcomes are only proved from the registry by installing them, and 0.2.3 set the precedent of a candidate for a patch.
      - Generate the 0.4.1 baselines in this commit — rejected: the family assigns that to plan 043, from the final tag, so the baseline cannot differ from what was published.
    - Chosen Approach:
      - The established release-candidate pattern for four packages.
    - API Notes and Examples:
      ```sh
      timeout 120 bun scripts/release/versions.ts --tag v0.4.1-rc.1
      git tag v0.4.1-rc.1 && git push origin main v0.4.1-rc.1   # owner's go
      ```
    - Files to Create/Edit:
      - `package.json` and `packages/*/package.json` (four files); `packages/*/README.md`; `bun.lock`; `src/__tests__/workspace.test.ts`.
      - `docs/compatibility.md`: the `~0.4.0-0` candidate range in `## 0.4.1`.
      - `plans/evidence/042-release-candidate.md` (new).
  - Test Cases to Write:
    - `workspace_packages_share_one_version` and `version_problems_require_the_prerelease_floor_on_an_rc` (existing, `src/__tests__/workspace.test.ts:44`, `:96`): updated to the new version. Break when one package is missed or a peer range is wrong.

- [ ] Task 10: Review readiness with the owner, then publish `0.4.1` and verify it from the registry
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/042-release-readiness-review.md` lists every item as `fixed` with evidence, or `deferred` with the owner's approval:
        - each 0.4.1 row of plan 041 Task 1's scope decision;
        - every open backlog P1;
        - every impact finding of plan 041;
        - Task 7's budget table;
        - Task 8's findings;
        - Task 9's registry verification;
        - the four laws reviewed against those rows.

        The owner answers go or no-go, recorded verbatim. A deferral past 0.4.1 gets a decision log.
      - After the go:
        - all four packages at `0.4.1`, peers `~0.4.0`, `CHANGELOG.md` dated, `README.md:240` naming `0.4.1`;
        - `release:versions --tag v0.4.1`, `bun run check`, `release:gate`, peer floors and `demo:test` pass on the commit;
        - the tag is pushed, CI publishes under `latest`, and `next` moves to `0.4.1`.
      - Task 9's registry verification is repeated for `0.4.1`, and `plans/evidence/042-release.md` records it.
      - `roadmap.md` §3 records Phase 7's 0.4.1 as published.
    - Performance: cites Task 7.
    - Code Quality: CI only.
    - Security: provenance verified for each package; the four laws reviewed in the readiness document.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
      - `verify-and-stop`.
      - `create-decision-log` — for the go and for any deferral.
    - Library Documentation to Check Before Implementation: none beyond Task 9.
    - Documentation Reviewed:
      - Plan 040 Task 8; `plans/evidence/040-release-readiness-review.md` and `040-release.md`; `decision-logs/2026-11-22-0347-go-on-0-4-0.md`.
    - Options Considered:
      - Separate review and publish tasks — merged, as in plan 040: the publish is mechanical once the go is given, and the go stays a hard stop inside the task.
    - Chosen Approach:
      - The established readiness review and final-release pattern.
    - API Notes and Examples: n/a.
    - Files to Create/Edit:
      - `plans/evidence/042-release-readiness-review.md`; `plans/evidence/042-release.md`.
      - `package.json` (four files); `packages/*/README.md`; `bun.lock`; `src/__tests__/workspace.test.ts`; `CHANGELOG.md`; `README.md`; `docs/compatibility.md`.
      - `roadmap.md`; `decision-logs/<date>-go-on-0-4-1.md`.
  - Test Cases to Write:
    - n/a — release verification. The API and workspace tests re-run on the final commit.

- [ ] Task 11: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - The twelve impact areas are swept against the whole 0.4.1 release (plans 041 and 042, the four published packages, the registry archives and the outsider docs) and recorded in `plans/evidence/042-impact-analysis.md`, each with a result or `None — <specific reason>`.
      - Findings go to the owner in one table with a recommended disposition. `execute` findings become tasks above this one; `backlog` findings go to `plans/backlog.md` and Further Actions.
      - `plans/README.md` and `roadmap.md` §3 record plan 042 complete.
    - Performance: references Task 7 and the stream-loop baseline.
    - Code Quality: findings cite `file:line`. The sweep checks that every register entry has a changelog line and that no existing corpus, hash or patch file changed.
    - Security: the four laws reviewed across every 0.4.1 change, and the checklist page re-read against what shipped: no row claims a check the release does not make.
  - Approach:
    - Skills to Use:
      - `create-plan` — "Final task: impact analysis" and the backlog handoff.
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed:
      - `references/liveframe.md` §5; plan 041's impact analysis; `plans/evidence/040-impact-analysis.md` (the release-level pattern).
    - Options Considered:
      - none beyond the standard sweep.
    - Chosen Approach:
      - One sweep after Task 10.
    - API Notes and Examples: n/a.
    - Files to Create/Edit:
      - `plans/evidence/042-impact-analysis.md`; `plans/backlog.md`; `roadmap.md`; `plans/README.md`; this plan's Compromises Made and Further Actions.
  - Test Cases to Write:
    - none new.

## Verification (whole plan)

- `timeout 1500 bun run check`
- `timeout 300 bun test --conditions liveframe:source ./src/__tests__/security-guide.test.ts ./src/__tests__/sdk-guide.test.ts ./src/__tests__/docs-links.test.ts ./src/__tests__/docs-wording.test.ts ./src/__tests__/api-stability.test.ts ./src/__tests__/acceptance-script.test.ts`
- `LIVEFRAME_BROWSER=webkit timeout 1500 bun run test` and `LIVEFRAME_BROWSER=firefox timeout 1500 bun run test`
- `timeout 2400 bun scripts/release/peer-floors.ts`
- `timeout 900 bun run release:gate`, `timeout 900 bun run demo:test`, `timeout 900 bun run guide:test`
- `timeout 600 bun --conditions liveframe:source bench/stream-loop.bench.ts`
- `bun scripts/bench-quiet.ts --out plans/evidence/042-bench.md`
- `bun scripts/release/acceptance.ts --plans 041-042 --map plans/evidence/042-acceptance-map.json --bench plans/evidence/042-bench.md --out plans/evidence/042-acceptance.md`
- `timeout 120 bun scripts/release/versions.ts --tag v0.4.1`
- `timeout 900 bun scripts/getting-started-test.ts --registry` and `timeout 900 bun scripts/demo-test.ts --registry`
- `npm view @arnilo/liveframe dist-tags`, and the same for `-runner-quickjs`, `-starter` and `-a2ui`

## Compromises Made

- Known while drafting: the coalescing loop lowers the number of updates but each update still diffs two whole trees and is validated whole by the client. The cost per update stays linear in the document until plan 046 delivers the stream's own append patch and incremental validation (LF-35, LF-36's 0.5.0 half).
- Known while drafting: the `hash-mismatch` correction documents a limit that 0.4.1 does not remove. Plan 043 (LF-19) removes it with a placement pin.
- The rest is to be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
