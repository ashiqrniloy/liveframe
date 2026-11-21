# Phase 7 Part AA: Release 0.4.0

Depends on: plans [033](033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md)–[039](039-Phase-7-Part-Z-Agent-Generated-UI.md) complete (all committed in `36da514`). Carries the open quiet-host proof (backlog "Re-run the full benchmark suite on a quiet host", plan 025 Task 8, 036 F12, 037 F5) unless Task 1's decision closes it another way.

## Objectives

- Record the 0.4.0 release scope: the never-published 0.3.1 work (plans 033–036) folds into 0.4.0, and the owner decides on the minor-window backlog items, the quiet-host proof and the A2UI package's first publish.
- Make the release gates green and trustworthy: CI green on the commit to tag, WebKit, Firefox and the peer floors pass, and a peer range that names another minor fails `release:versions`.
- Document 0.4.0 for outsiders and adopters: the changelog, the compatibility notes and the 0.4.x promise, adopter notes, and docs that no longer cite an unreleased 0.3.1 or say "three packages".
- Prove every acceptance criterion of plans 033–039 against the checkout, run the full benchmark suite on a quiet host, and run the agent acceptance test on the 0.4.0 paths.
- Publish all four packages (`@arnilo/liveframe`, `@arnilo/liveframe-runner-quickjs`, `@arnilo/liveframe-starter`, `@arnilo/liveframe-a2ui`) at `0.4.0-rc.1` under `next`, verify them from the registry, review readiness with the owner, then publish `0.4.0` under `latest` and `next` and verify again.

## Expected Outcome

- `decision-logs/<date>-release-0-4-0-scope.md` records the 0.3.1 fold, the minor-window dispositions, the quiet-host rule and the A2UI first-publish method, all approved by the owner.
- `CHANGELOG.md` § 0.4.0, `docs/compatibility.md` § 0.4.0 (the 0.4.x promise, four lockstep packages, the `~0.4.0` peer), `docs/adopters-0.4.md`, `README.md` and `SECURITY.md` are complete and current. No outsider doc cites 0.3.1 as a release.
- `plans/evidence/040-acceptance.md` lists every acceptance bullet of plans 033–039 with its proving test or command and result.
- `plans/evidence/040-bench.md` holds one clean `bun scripts/bench-quiet.ts` run, or an owner decision log closes it on partial proof.
- `plans/evidence/040-agent-acceptance.md` records an agent run on the 0.4.0 paths using only the published docs.
- `scripts/release/api/` holds the 0.4.0 baselines of all four packages and empty `register-0.4.1*.json` files; `api-stability.test.ts` compares against them.
- All four packages are on npm at `0.4.0` with provenance; `latest` and `next` both point at `0.4.0`; the archives pass the registry checks.

This plan implements the release step of roadmap Phase 7's 0.4.0, under the [2026-11-15 scope decision](../decision-logs/2026-11-15-1251-review-2026-11-15-scope.md) and the three 0.4.0 design decisions ([interaction](../decision-logs/2026-11-19-0154-interaction-additions-for-0-4-0.md), [rendering](../decision-logs/2026-11-19-1143-rendering-additions-for-0-4-0.md), [agent UI](../decision-logs/2026-11-19-2034-agent-ui-additions-for-0-4-0.md)). It changes no format, API or spec meaning. The exceptions are a minor-window item the owner pulls in at Task 1, which then gets its own numbered task above Task 2, and any defect a later task finds, which reopens the owning plan's task or adds a numbered follow-up here before the release candidate. Unusual for this release: the 0.3.1 patch scoped on 2026-11-15 was never published, so 0.4.0 carries its fixes too, and `@arnilo/liveframe-a2ui` is published for the first time. Publishing needs the owner's explicit go: Task 7 for the candidate and Task 8 for the release. Pushing `main` or a tag also needs the owner's go.

## Tasks

- [x] Task 1: Record the 0.4.0 release scope decision
  - Acceptance Criteria:
    - Functional:
      - A decision log, approved by the owner, records:
        1. **The 0.3.1 fold.** Plans 033–036, scoped as a `0.3.1` patch, ship in `0.4.0`; no `0.3.1` is published. `register-0.3.1.json` stays as the record of those additive changes, layered under `register-0.4.0.json` as `api-stability.test.ts` already does.
        2. **The minor-window items.** These change existing behaviour, so after 0.4.0 they wait for 0.5.0. Each is `include` (it becomes a numbered task above Task 2 with full criteria, run before the candidate) or `defer to 0.5.0`:
           - element JSON error kinds (`plans/backlog.md` "Align element JSON's error kinds with `render()` and the arrival walk", 036 F1/F2, tagged "0.4.0");
           - a thrown or rejected `onIntent` reported through `SurfaceEvent` (033 F6);
           - no prior `patch`/`reset`/`migrated` on a skipped `renderPlacement` (033 F5).
        3. **The quiet-host rule** for Task 5: the 2026-11-09 definition (whole-host CPU below 10%, benchmark included) stands, and the fallback if no quiet window is found.
        4. **The A2UI first publish.** The owner claims `@arnilo/liveframe-a2ui` with a `0.0.0-stage` token publish, then configures its trusted publisher (repository `ashiqrniloy/liveframe`, workflow `publish.yml`, environment `release`, allowing `npm publish` and `npm dist-tag`) no more than 2 days before the rc tag is pushed, so CI publishes `0.4.0-rc.1` with provenance. This avoids 0.3.0-rc.1's companions, which shipped with no provenance.
      - `roadmap.md` Phase 7's line "No release plan exists yet for either version" names this plan and the fold. Roadmap §3's notes that call plans 036–039 "uncommitted" now say they were committed in `36da514`. `plans/README.md` rows 037–039 drop "Proposed for 0.4.0".
    - Performance: n/a — decision and bookkeeping.
    - Code Quality: one decision log; the roadmap and index say what happened, nothing more.
    - Security: n/a — no code. The A2UI publish method keeps provenance for every published version, the rc included.
  - Approach:
    - Skills to Use:
      - `create-decision-log` — the fold and the dispositions are project decisions that need explicit approval.
      - `liveframe-execution` — authority order and the roadmap's state rules.
    - Library Documentation to Check Before Implementation:
      - npm trusted publishing (`/websites/npmjs`, docs.npmjs.com/trusted-publishers, checked 2026-11-20): you add a publisher under an existing package's settings. A new configuration must complete its first successful publish within 2 days or it expires. `npm publish` and `npm dist-tag` are separate allowed actions.
    - Documentation Reviewed:
      - `decision-logs/2026-11-15-1251-review-2026-11-15-scope.md` (0.3.1 / 0.4.0 split); `decision-logs/2026-11-10-0927-manual-first-publish-of-the-companion-packages.md` (claim with `0.0.0-stage`, configure the publisher, CI publishes); `decision-logs/2026-11-09-2106-close-plan-032-task-3-on-partial-quiet-host-proof.md`.
      - `plans/backlog.md` (the three entries above); `plans/evidence/033-impact-analysis.md`, `036-impact-analysis.md`.
      - Registry, 2026-11-20: `@arnilo/liveframe-a2ui` returns "Not found"; the three published packages read `latest` = `next` = `0.3.0`.
    - Options Considered:
      - Publish `0.3.1` first, then `0.4.0` — rejected unless the owner prefers it: the 0.3.1 work is already committed together with the 0.4.0 work in `36da514`, so a 0.3.1 would need a branch that removes 037–039, plus a second full release run.
      - Hand-publish the A2UI rc by token, as 0.3.0-rc.1 did for its companions — rejected as the default: it ships an rc with no provenance, which configuring the publisher up front avoids.
    - Chosen Approach:
      - One scope decision before any release work, mirroring plan 026 Task 1 and plan 033 Task 1.
    - API Notes and Examples: n/a.
    - Files to Create/Edit:
      - `decision-logs/<date>-release-0-4-0-scope.md`: new.
      - `roadmap.md`: Phase 7 0.4.0 line; §3 plan 036–039 notes.
      - `plans/README.md`: rows 037–039.
      - `plans/backlog.md`: a status line on each minor-window entry with its disposition.
      - This plan: a numbered task above Task 2 per `include`d item (tentative — only if the owner includes one).
  - Test Cases to Write:
    - n/a — decision task. `docs-links` must still pass on the roadmap and index edits.
  - Notes (executed 2026-11-20):
    - [Decision log](../decision-logs/2026-11-20-2319-release-0-4-0-scope.md), approved by the owner: the 0.3.1 work folds into 0.4.0 and no 0.3.1 is published; element JSON error kinds are **included** (Task 1a); `onIntent` failure as a `SurfaceEvent` and the skipped-`renderPlacement` shape are **deferred to 0.5.0**; the quiet-host rule stands (whole-host CPU below 10%) with three attempts and then the best attempt goes to Task 8's readiness review; `@arnilo/liveframe-a2ui` is claimed with `0.0.0-stage` and its trusted publisher is configured no more than 2 days before the rc tag.
    - `roadmap.md` Phase 7's line names this plan and the fold; §3 notes for 036–039 say they were committed in `36da514`. `plans/README.md` rows 037–039 drop "Proposed for 0.4.0". Each minor-window backlog entry carries its disposition.
    - The owner's A2UI claim and publisher setup is a prerequisite of Task 7, not done here.
    - Task 1a is added below, above Task 2. Task 4's map and Task 8's readiness review must cover it.

- [x] Task 1a: Align element JSON's error kinds with `render()` and the arrival walk (included by Task 1)
  - Acceptance Criteria:
    - Functional:
      - `renderElements` and `streamElements` report a missing or non-nonempty-string `kind` as `unknown-component` at the node's own pointer, and a `children` that is not an array as `invalid-children`, the kinds `render()` and `validateTree` give. The pointers match the walk's.
      - `src/__tests__/sdk-elements.test.ts` (the `children: {}` case near line 82) expects the new kind; the three element-shape cases in `tree-rule-parity.test.ts` (`kind_removed`, `kind_retyped`, `children_retyped`) run in the strict generated suite and `agree` across all three implementations. Remove `ELEMENT_SHAPE` and retain `knownDifference` for the F3/F4 pointer cases.
      - Spec §7.2 says `renderElements` uses `render()`'s error kinds with no exception. `docs/migration-0.4.md` has an "error kinds" entry for adopters who match on `invalid-prop` for these two inputs. `register-0.4.0.json` records the change (the kind is a documented behaviour, not a declaration), and `CHANGELOG.md` lists it under `Changed` for Task 3 to carry into the 0.4.0 section.
      - The F3/F4 pointer differences (build-pass child-count pointer, byte-limit pointer) stay out of scope and stay in the backlog.
    - Performance: none; the error path only.
    - Code Quality: the element conversion reuses the walk's kind constants; no second copy of the rule.
    - Security: an input that was rejected is still rejected (law 2); only the error kind changes.
  - Approach:
    - Skills to Use: `surgical-patch`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `plans/evidence/036-impact-analysis.md` F1, F2; `src/__tests__/tree-rule-parity.test.ts` (`known_differences_strict`); `src/sdk/elements.ts` (the `kind` check near line 169, `elementChildren`).
    - Options Considered: keep `invalid-prop` and document it — rejected: spec §7.2 promises `render()`'s kinds.
    - Chosen Approach: change the two kinds in the element conversion, then enable the parity cases.
    - Files to Create/Edit: `src/errors.ts`; `src/sdk/{elements,element-node,render}.ts`; `src/validate/{compile,tree}.ts`; `src/__tests__/{api-stability,sdk-elements,tree-rule-parity}.test.ts`; `docs/spec.md` §7.2; `docs/migration-0.4.md`; `scripts/release/api/register-0.4.0.json`; `CHANGELOG.md`.
  - Test Cases to Write:
    - `render_elements_error_pointers_into_json` covers missing and empty kinds and non-array children, including the exact element JSON pointers.
    - Strict generated parity for the three element-shape cases and strict corpus parity for `invalid-children.json`.

  - Notes (executed 2026-11-21):
    - Element conversion reports `unknown-component` at the element and `invalid-children` at its `children` field. Both builds share the arrival walk's error constants.
    - All three element-shape parity cases and the invalid-children corpus case run strict. F3/F4 remain in the backlog.
    - Spec §7.2, migration guidance, changelog and both SDK register entries document the change. The layered API gate reads the 0.3 and 0.4 migration guides.
    - Focused SDK, parity and API tests passed. `bun run check` passed with 2,124 tests and six skips.

- [ ] Task 2: Make the release gates green and trustworthy
  - Acceptance Criteria:
    - Functional:
      - `src/__tests__/conformance-renderer-browser.test.tsx:158` (`missing_local_fixtures_fail_with_the_named_rule`) gets the 240 000 ms timeout its sibling tests use. On 2026-11-20 it was the one WebKit failure (60 s timeout) and passed alone.
      - Every failure from the 2026-11-20 Firefox run is re-run twice on its own, and so is the React peer-floor cascade (a 5 s timeout and then a browser crash):
        - the starter renderer browser suite;
        - `windowed-browser.test.ts`;
        - the `switch.test.tsx` hook;
        - `cli-mcp` `oversized_tree_is_refused_with_a_typed_error`, which gave pointer `""` instead of `/scenario`.

        A failure that comes back is a defect: it is fixed in the owning code, or it becomes a follow-up task here. A failure that passes both times is recorded as load-only, with the load it was seen at. For `oversized_tree_is_refused_with_a_typed_error`, find out which limit produced the `""` pointer, so the test either asserts that limit or is made independent of time.
      - `scripts/release/versions.ts` also fails when a companion's peer range on `@arnilo/liveframe` is not `~X.Y.0` for version `X.Y.Z`, or `~X.Y.0-0` while the version has a prerelease part. Today it only checks the `~` prefix, so a missed peer range passes the gate.
      - With the owner's go to push `main`, CI (`ci.yml`) is green on the pushed commit: Chromium, WebKit, Firefox, the archive gate, peer floors, demo and guide. The run id is recorded in this task's notes. `main` has been red since `b4e2359`.
    - Performance: no budget changes; a raised test timeout is not a performance claim.
    - Code Quality: a timeout matches its siblings, with no new retry wrapper. The peer-range rule is one function in `versions.ts`, next to the existing lockstep check.
    - Security: n/a — test and gate changes only; no law-enforcing assertion is weakened.
  - Approach:
    - Skills to Use:
      - `investigate-first` — separate load flakes from defects before editing.
      - `surgical-patch` — the timeout and the peer-range check.
      - `liveframe-execution` — never weaken a law test.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2 confirms the third argument to `test` sets the timeout in milliseconds ([Bun documentation](https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/test/runtime-behavior.mdx), checked via Context7).
      - Playwright 1.64.1 confirms that closing a page created by `browser.newPage` closes its context ([Playwright documentation](https://github.com/microsoft/playwright/blob/v1.64.1/docs/src/api/class-browser.md), checked via Context7).
    - Documentation Reviewed:
      - The 2026-11-20 readiness check: WebKit 2114 pass / 1 fail; Firefox 2112 / 10; peer floors 101 / 62, then all three floors pass on re-run.
      - CI run 42996104401: red on the removed `in_process_warm_overhead_under_point_one_ms`.
      - `scripts/release/versions.ts:10-27`; `src/__tests__/workspace.test.ts:49,56`.
    - Options Considered:
      - Mark the flaky tests `skip` under Firefox — rejected: it hides real coverage of the 0.4.0 additions, `windowed-browser` among them.
      - Re-run CI until green — rejected: the release checklist needs gates that mean something.
    - Chosen Approach:
      - Reproduce, then fix or record each failure. Add the peer-range rule where the lockstep rule lives.
    - API Notes and Examples:
      ```ts
      // versions.ts: the range a companion must use
      const expected = `~${major}.${minor}.0${prerelease ? "-0" : ""}`;
      ```
    - Files to Create/Edit:
      - `src/__tests__/conformance-renderer-browser.test.tsx`: timeout.
      - `scripts/release/versions.ts`: peer-range rule.
      - `src/__tests__/workspace.test.ts`: the existing `versionProblems` tests gain the peer-range cases.
      - `packages/starter/src/__tests__/switch.test.tsx`: give browser launch the same 60 s setup budget as the starter renderer browser suite.
      - `src/__tests__/{css-browser,css-scope-browser,preview-react}.test.tsx`: give browser setup a 30 s budget.
      - `src/__tests__/react-browser.test.tsx`: give the four-outcome confirmation test a 30 s timeout after its default 5 s timeout killed the shared Firefox process.
      - `src/__tests__/cli-mcp.test.ts` and `src/__tests__/fixtures/mcp-slow-render.config.ts`: isolate the tree byte-cap assertion from the default render deadline.
  - Test Cases to Write:
    - `version_problems_reject_a_peer_range_for_another_minor`: `0.4.0` with `~0.3.0` fails; breaks if the rule is removed.
    - `version_problems_require_the_prerelease_floor_on_an_rc`: `0.4.0-rc.1` with `~0.4.0` fails and `~0.4.0-0` passes; breaks if prereleases are not handled.
    - Existing `missing_local_fixtures_fail_with_the_named_rule` passes three times under `LIVEFRAME_BROWSER=webkit`.
  - Notes (local verification 2026-11-21):
    - On a 16-CPU host, isolated Firefox reruns used one-minute load averages of 5.74 and 4.23 for starter conformance (16 passed each), 4.25 and 5.57 for the windowed suite (3 passed each), and 4.23 and 5.52 for switch setup (no failure, with its existing Chromium-only timing test skipped). Starter conformance and the windowed failures did not recur. The 2026-11-20 report does not record the original numeric load.
    - The MCP byte-cap test passed twice at one-minute loads of 4.23 and 5.52. Its default in-process runner can return `limit-exceeded` with pointer `""` when its 100 ms module evaluation or render deadline wins. The original error message is unavailable, so the pointer alone cannot distinguish the two stages. The test-only render deadline is 10 s and the assertion still requires the 262,144-byte cap at `/scenario`.
    - The version gate checks the exact companion peer range for the lockstep version. The workspace tests cover stable, patch and prerelease versions. In a temporary CLI check, `0.4.0` with peer `~0.3.0` exited 1 and `~0.4.0` exited 0.
    - The named WebKit fixture test passed three times in 25.18 s, 24.17 s and 25.07 s. The Chromium `bun run check` passed with 2,124 tests and six skips before the confirmation test timeout change below. The archive gate passed for all four packages, the demo passed 78 tests, and the getting-started guide passed.
    - A concurrent full Firefox run hit two independent failures. The worker-recycle test reported `Worker did not start` and passed both isolated reruns at a one-minute load of 17.85. The four-outcome confirmation test hit Bun's 5 s default, Bun logged `killed 1 dangling process`, and subsequent cases reported the shared browser was closed. The confirmation test now has a 30 s timeout.
    - The React browser file passed twice on Firefox after the timeout change (63 tests each, one-minute loads 8.09 and 5.99). The independent React 19.0.0 peer-floor runs each passed 163 tests at one-minute loads 3.83 and 12.77. The Playwright 1.49.0 floor passed 23 tests and the MCP SDK 2.0.0 floor passed 89.
    - On the final test changes, `LIVEFRAME_BROWSER=firefox bun run check` passed with 2,123 tests and seven skips. The full WebKit suite passed with 2,117 tests and 13 skips. Both runs passed the worker recovery and React confirmation cases that failed in the earlier Firefox run.
    - With the owner's approval, pushed `main`. [CI run 44817568825](https://github.com/ashiqrniloy/liveframe/actions/runs/44817568825) exposed an order-dependent tree-patch test. The test now uses the named `valid.json` fixture for its empty-children case and still checks all eligible corpus pairs. The CI job limit is 60 minutes to allow for three sequential browser suites and the release gates. The first Chromium check alone took over 11 minutes.
    - [CI run 44819635854](https://github.com/ashiqrniloy/liveframe/actions/runs/44819635854) passed Chromium. In WebKit, the offscreen control had focus but the scroll position was still zero on the immediate read. The test now waits up to five seconds for the same positive scroll position and still checks focus, tab order and CSS visibility.
    - [CI run 44824240370](https://github.com/ashiqrniloy/liveframe/actions/runs/44824240370) passed Chromium, WebKit, Firefox and the archive gate. The Playwright 1.49 browser installer stalled during extraction under Node 26 until the job timed out. A fresh-cache install reproduced the stall locally and succeeded when forced to use Bun. CI now installs only the pinned headless shell with Bun, which matches the peer-floor tests, and allows 75 minutes for the sequential gates.

- [ ] Task 3: Write the release documentation
  - Acceptance Criteria:
    - Functional:
      - `CHANGELOG.md`:
        - `## Unreleased` becomes `## 0.4.0 — unreleased` (Task 8 dates it), with an introduction saying it carries the unpublished 0.3.1 fixes.
        - A `Changed` (action needed) entry for the `starter.ui@1` design-system requirement (`size.row`, the `scroll` focus recipe, the ten new kinds' recipes), linking `docs/migration-0.4.md#action-needed-your-own-design-system-for-starterui1`.
        - Every 033–039 register entry has a line.
      - `docs/compatibility.md` gains `## 0.4.0`: what is additive, the one action needed, four packages and one version, companions peering on `~0.4.0` (`~0.4.0-0` for the rc), and the 0.4.x promise (patches compare against the `0.4.0` baselines through `register-0.4.1*.json`, additive only).
      - The 0.3.x promise paragraph names 0.3.1 as folded into 0.4.0. The release checklist says "every `package.json`", not "all three". `docs/compatibility.md:147` and `docs/migration-0.3.md:161` no longer say "from 0.3.1"; they say 0.4.0.
      - `docs/adopters-0.4.md`:
        - one row per scope item of the three 0.4.0 design decisions and the 2026-11-15 review findings that 033–036 fixed: the problem in general terms, the shipped API, the spec section and the limitation;
        - a Synapta section and a Clay section naming which open requests (`plans/requests/*`) 0.4.0 closes;
        - a "Not delivered" table that includes Task 1's deferrals.
      - `SECURITY.md` names four packages. `README.md`'s status line and package list are current.
      - `docs/security.md` is reviewed against the shipped 0.4.0 trust model: local writes on host intents, `fromLocal`, `putStateIf`, `pending`, `motion`, `/dom`, element-JSON `when`/`bind`/`setLocal`, the digest and `fromA2ui`. 039 already added "0.4.0 audit: agent-written UI"; extend it to 037–038.
      - `docs-wording`, `docs-links` and `docs-spec-structure` pass. No doc calls a shipped API "planned".
    - Performance: n/a — documentation.
    - Code Quality: docs only; every migration sample is tested.
    - Security: the `docs/security.md` review above, against the four laws.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — docs are for outsiders; spec wins on conflict.
    - Library Documentation to Check Before Implementation:
      - none. Local: `docs/migration-0.4.md`, `register-0.3.1.json`, `register-0.4.0.json`, `register-0.4.0-starter.json`.
    - Documentation Reviewed:
      - Plan 032 Task 1 (pattern); `docs/adopters-0.3.md` (row format); the Notes sections of plans 033–039; `plans/requests/*`.
      - The readiness check's doc gaps: `SECURITY.md:13`, `docs/compatibility.md:31,33,147,195`, `docs/migration-0.3.md:161`.
    - Options Considered:
      - Fold the adopter notes into the migration guide — rejected: 0.2 and 0.3 keep them separate, and the migration guide is for actions, not capabilities.
    - Chosen Approach:
      - The 0.3.0 release-documentation pattern (plan 032 Task 1).
    - API Notes and Examples: n/a.
    - Files to Create/Edit:
      - `CHANGELOG.md`; `docs/compatibility.md`; `docs/migration-0.3.md`; `docs/adopters-0.4.md` (new); `README.md`; `SECURITY.md`; `docs/security.md`.
      - `src/__tests__/migration-guide.test.ts`; `src/__tests__/docs-wording.test.ts`.
  - Test Cases to Write:
    - `every_0_4_migration_sample_compiles`: `migration-guide.test.ts`'s sample check also covers `docs/migration-0.4.md`. Breaks on a sample that imports a name the checkout does not export.
    - `no_doc_cites_the_unreleased_0_3_1`: fails when an outsider doc (README, SECURITY, CHANGELOG, `docs/`, package READMEs) says "from 0.3.1" or "in 0.3.1" outside the 0.3.x-promise paragraph.
    - `security_policy_and_release_checklist_name_every_package`: `SECURITY.md` and the compatibility release section name every workspace package from `packageDirs()`. Breaks when a package is added and these docs are not updated.

- [ ] Task 4: Prove every acceptance criterion of plans 033–039 against the checkout
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/040-acceptance.md` is generated with one row per acceptance bullet of plans 033–039, joined through `plans/evidence/040-acceptance-map.json`.
      - Every row is `pass`, `n/a`, `pending` (a bench row waiting on Task 5), or names a follow-up task added above Task 7 and executed before the candidate.
      - The script's header names the map it was given; today it hard-codes `032-acceptance-map.json` at `scripts/release/acceptance.ts:373`.
    - Performance: bench rows cite `plans/evidence/040-bench.md` (Task 5).
    - Code Quality: the same generator and map format as plan 032; no second generator.
    - Security: rows that enforce a law cite tests that fail when the law is broken (for example local writes never reach the host as authority, `fromA2ui` offers only mapped actions, `focus` cannot reach another surface).
  - Approach:
    - Skills to Use:
      - `verify-and-stop` — proof only, no scope growth.
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed:
      - Plan 032 Task 2 notes (the map rules, re-run-on-miss, `n/a` bullets).
      - `scripts/release/acceptance.ts:440-450` (the `--map`, `--bench` and `--plans` options).
    - Options Considered:
      - A manual checklist — rejected for the reason plan 032 gives: a script can be re-run.
    - Chosen Approach:
      - The generated acceptance log.
    - API Notes and Examples:
      ```sh
      bun scripts/release/acceptance.ts --plans 033-039 --map plans/evidence/040-acceptance-map.json \
        --bench plans/evidence/040-bench.md --out plans/evidence/040-acceptance.md
      ```
    - Files to Create/Edit:
      - `plans/evidence/040-acceptance-map.json` (new); `plans/evidence/040-acceptance.md` (generated).
      - `scripts/release/acceptance.ts`: header uses `options.map`.
      - `src/__tests__/acceptance-script.test.ts`.
  - Test Cases to Write:
    - `acceptance_map_covers_every_bullet_of_plans_033_to_039`: the real plans against the real map, without running the proofs. Fails on an unmapped bullet or a stale key.
    - `acceptance_log_header_names_the_given_map`: breaks if the path is hard-coded again.

- [ ] Task 5: Run the full benchmark suite on a quiet host (carries the open quiet-host proof)
  - Acceptance Criteria:
    - Functional:
      - `bun scripts/bench-quiet.ts --out plans/evidence/040-bench.md` runs every stage of `bun run bench`. That includes the stages added since 0.3.0: `dom`, `motion`, `hash`, `selection`, `a2ui` and `starter-content`. The run must be quiet under Task 1's rule, and every gated budget must pass.
      - A budget that fails on a quiet host stops the task: the owning plan's task is reopened. No threshold changes without an owner decision log.
      - These close with a pointer to the record, or stay open under an owner decision log, as for 0.3.0:
        - the backlog entries "Re-run the full benchmark suite on a quiet host" and "Re-measure the browser renderer's wall times on a quiet host…";
        - plan 025 Task 8;
        - 036 F12 and 037 F5.
      - After the run, Task 4's log is regenerated so its `pending` rows turn `pass`.
    - Performance: this task is the proof.
    - Code Quality: the existing sampler, `scripts/bench-quiet.ts`; no new harness.
    - Security: n/a.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
      - `investigate-first` — if a budget fails.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed:
      - Plan 032 Task 3 notes: load average is not usable; whole-host CPU below 10%; spin the governor up before the first stage; `pack-libraries` and `template` are thin-margin ratio gates.
      - `decision-logs/2026-11-09-2106-close-plan-032-task-3-on-partial-quiet-host-proof.md`.
    - Options Considered:
      - Release with the proof open again — only by an explicit owner decision log, which Task 1 may already pre-authorise.
    - Chosen Approach:
      - A quiet-host run with recorded CPU per stage.
    - API Notes and Examples:
      ```sh
      bun scripts/bench-quiet.ts --out plans/evidence/040-bench.md
      ```
    - Files to Create/Edit:
      - `plans/evidence/040-bench.md`, or a `040-bench-attempt-*.md` file if it is not clean.
      - `plans/backlog.md`: closure or status lines.
      - `plans/025-…md`: Task 8 note.
      - `scripts/bench-quiet.ts` (tentative — only if it reads stages in a way that misses a new bench file).
  - Test Cases to Write:
    - n/a — measurement task.

- [ ] Task 6: Run the agent acceptance test on the 0.4.0 paths
  - Acceptance Criteria:
    - Functional:
      - A fresh agent works from only the packed archives' READMEs and docs, the `liveframe mcp` tools (starter catalog, `quickjsRunner`) and a running demo-shaped host built by `scripts/agent-acceptance/prepare.ts`. It:
        1. writes a TSX widget that uses a local write with `until: "revision"`, a `fromLocal` action value, an array-carrying multi-select event, a `focus` mark and a `shown` empty state, then validates, renders and captures it;
        2. without MCP, writes element JSON with `when`, `bind` and `setLocal` from the catalog digest alone (`liveframe gen --digest`), and it renders through `renderElements` with a caller-owned `local`;
        3. converts a supplied A2UI v0.9.1 surface with `fromA2ui` and an app mapping, fixes a deliberately unmapped component from the typed error and its `origins` pointer, and renders the result;
        4. installs the step-1 widget through `/host`, places it, and sees a `pending` source answer then the value, and an action go pending then ok.
      - The transcript, tool calls and outcome are recorded in `plans/evidence/040-agent-acceptance.md`.
    - Performance: n/a.
    - Code Quality: scripted parts reuse `scripts/agent-acceptance/` (`prepare.ts`, `mcp-session.ts`, `digest-run.ts`), extended rather than copied.
    - Security: law 4 — the transcript shows that no MCP tool dispatched an action, and that the converter's output offers only actions named in the mapping.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
      - `run` — the demo-shaped host.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed:
      - Plan 032 Task 4 and 4a notes; `plans/evidence/032-agent-acceptance.md`; `plans/evidence/039-agent-acceptance.md` (digest run).
    - Options Considered:
      - Rely on 039's partial run — rejected: it covered the agent-UI paths only, not 037/038 or the host.
    - Chosen Approach:
      - The established fresh-agent pattern on the 0.4.0 paths.
    - API Notes and Examples: n/a.
    - Files to Create/Edit:
      - `plans/evidence/040-agent-acceptance.md`.
      - `scripts/agent-acceptance/prepare.ts`: pack all four archives and supply an A2UI fixture.
      - `scripts/agent-acceptance/*`: as needed.
  - Test Cases to Write:
    - n/a — acceptance run. Any capability gap becomes a finding, and the owner decides whether it is fixed before the candidate (as plan 032 Task 4a).

- [ ] Task 7: Bump to `0.4.0-rc.1`, set the 0.4.0 API baselines, publish under `next` and verify from the registry
  - Acceptance Criteria:
    - Functional:
      - Prerequisites, before the tag: Task 1's A2UI step is done (`@arnilo/liveframe-a2ui` has `0.0.0-stage` and a trusted publisher no more than 2 days old), and the other three packages' trusted publishers still allow `npm publish` and `npm dist-tag`.
      - One commit:
        - all four packages at `0.4.0-rc.1`, companions peering on `~0.4.0-0`;
        - `src/__tests__/workspace.test.ts` and the companion READMEs updated, and `bun.lock` refreshed;
        - API baselines generated with `scripts/release/api-surface.ts` from the checkout: `0.4.0.json`, `0.4.0-runner-quickjs.json`, `0.4.0-starter.json` and `0.4.0-a2ui.json`;
        - empty `register-0.4.1.json` and `register-0.4.1-starter.json`;
        - `api-stability.test.ts` switched to the 0.4.0 baselines, with the 0.3.0 baselines and registers kept as history, and the `a2ui_package_exports_only_the_converter_until_its_baseline` placeholder replaced by a real comparison.
      - `release:versions --tag v0.4.0-rc.1` passes. With the owner's go, the tag is pushed and the protected workflow publishes all four packages under `next` with provenance.
      - From a fresh directory:
        - each package's archive gate (`archive-gate.ts --dir <dir> --package <name>@0.4.0-rc.1`);
        - the installed API against the baselines;
        - `getting-started-test.ts --registry` and `demo-test.ts --registry`;
        - `npm audit signatures --include-attestations` (with an empty `--cache`, as plan 032 Task 7 needed);
        - `npm view <pkg> dist-tags` for all four: `next` = `0.4.0-rc.1`.
      - `plans/evidence/040-release-candidate.md` records commands and outputs.
    - Performance: n/a.
    - Code Quality: no manual publish beyond Task 1's name claim; CI only.
    - Security: every package has provenance attestations at `0.4.0-rc.1`.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - npm trusted publishing and `npm dist-tag` with npm 12.2.1 (`find-docs`, `/npm/cli/v12.2.1`).
    - Documentation Reviewed:
      - Plan 032 Task 5 and 7 notes; `plans/evidence/032-release-candidate.md`; `.github/workflows/publish.yml:60-90`; `docs/compatibility.md` § Release process.
    - Options Considered:
      - Generate the baselines after the final tag, as for 0.3.0 — rejected: that left the core without a baseline until plan 033 (032 F4). Generating at the rc pins the API before anything can drift. Task 8 regenerates them if anything changes.
    - Chosen Approach:
      - The established release-candidate pattern, extended to four packages, with the baselines in the bump commit.
    - API Notes and Examples:
      ```sh
      bun run build && bun scripts/release/api-surface.ts packages/a2ui --out scripts/release/api/0.4.0-a2ui.json --from "v0.4.0-rc.1 checkout"
      git tag v0.4.0-rc.1 && git push origin main v0.4.0-rc.1   # owner's go
      ```
    - Files to Create/Edit:
      - `package.json` and `packages/*/package.json` (×4); `packages/*/README.md`; `bun.lock`; `src/__tests__/workspace.test.ts`.
      - `scripts/release/api/0.4.0*.json` (×4); `scripts/release/api/register-0.4.1*.json` (×2).
      - `src/__tests__/api-stability.test.ts`; `docs/compatibility.md` (the `~0.4.0-0` rc range); `plans/evidence/040-release-candidate.md`.
  - Test Cases to Write:
    - `baseline_0_4_0_matches_the_checkout_through_the_0_4_1_register`.
    - `a2ui_baseline_0_4_0_matches_the_checkout` (replaces the placeholder).
    - `register_0_4_1_holds_only_additive_entries`.

    Each breaks on an unregistered declaration change.

- [ ] Task 8: Review readiness with the owner, then publish `0.4.0` and verify it from the registry
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/040-release-readiness-review.md` lists every item as `fixed` with evidence, or `deferred` with the owner's approval:
        - the scope rows of the three 0.4.0 design decisions and the 2026-11-15 review findings;
        - every open backlog P1;
        - every impact finding of plans 033–039;
        - Task 1's minor-window dispositions;
        - Task 5's budget table;
        - Task 7's registry verification;
        - the four laws reviewed against those rows.

        The owner answers go or no-go, recorded verbatim. A deferral past 0.4.0 gets a decision log.
      - After the go:
        - all four packages at `0.4.0`, peers `~0.4.0`, `CHANGELOG.md` dated;
        - the API baselines regenerated if any declaration changed since the rc (otherwise unchanged);
        - `release:versions --tag v0.4.0`, `bun run check`, `release:gate`, peer floors and `demo:test` pass on the commit;
        - the tag is pushed, CI publishes under `latest`, and `next` moves to `0.4.0`.
      - Task 7's registry verification is repeated, and `plans/evidence/040-release.md` records it. `roadmap.md` §3 records Phase 7's 0.4.0 as published.
    - Performance: cites Task 5.
    - Code Quality: CI only.
    - Security: provenance verified for each package; the four laws reviewed in the readiness document.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
      - `verify-and-stop`.
      - `create-decision-log` — for deferrals.
    - Library Documentation to Check Before Implementation: none beyond Task 7.
    - Documentation Reviewed:
      - `plans/evidence/032-release-readiness-review.md` and `plans/evidence/032-release.md` (pattern); `decision-logs/2026-11-10-1219-go-on-0-3-0-with-deferrals.md`.
    - Options Considered:
      - Separate review and publish tasks, as plan 032 had — merged here because the publish is mechanical once the go is given. The go stays a hard stop inside the task.
    - Chosen Approach:
      - The established readiness review and final-release pattern.
    - API Notes and Examples: n/a.
    - Files to Create/Edit:
      - `plans/evidence/040-release-readiness-review.md`; `plans/evidence/040-release.md`.
      - `package.json` (×4); `packages/*/README.md`; `bun.lock`; `src/__tests__/workspace.test.ts`; `CHANGELOG.md`; `docs/compatibility.md`.
      - `scripts/release/api/0.4.0*.json` (only if changed); `roadmap.md`; `decision-logs/<date>-go-on-0-4-0*.md`.
  - Test Cases to Write:
    - n/a — release verification. Task 7's API tests re-run on the final commit.

- [ ] Task 9: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - The twelve impact areas are swept against the whole 0.4.0 release (plans 033–040, the four published packages, the registry archives and the outsider docs) and recorded in `plans/evidence/040-impact-analysis.md`.
      - Findings are presented to the owner in one table, each with a recommended disposition. Dispositions are recorded; each finding is executed (as a task above this one) or backlogged.
      - `plans/README.md` and `roadmap.md` §3 record plan 040 complete.
    - Performance: references Task 5.
    - Code Quality: findings cite `file:line`.
    - Security: the four laws reviewed across every 0.4.0 surface (local writes, `fromLocal`, array carries, `focus`, `putStateIf`, `pending`, `motion`, `/dom`, element-JSON bindings, the digest, `fromA2ui`).
  - Approach:
    - Skills to Use:
      - `create-plan` — final task and backlog handoff.
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed:
      - Plans 033–039 impact analyses; `plans/evidence/032-impact-analysis.md` (release-level pattern).
    - Options Considered: n/a.
    - Chosen Approach:
      - The standard final task.
    - API Notes and Examples: n/a.
    - Files to Create/Edit:
      - `plans/evidence/040-impact-analysis.md`; `plans/backlog.md`; `roadmap.md`; `plans/README.md`.
      - This plan: Compromises Made and Further Actions.
  - Test Cases to Write:
    - n/a.

## Verification (whole plan)

- `timeout 1500 bun run check`
- `LIVEFRAME_BROWSER=webkit timeout 1500 bun run test` and `LIVEFRAME_BROWSER=firefox timeout 1500 bun run test`
- `timeout 2400 bun scripts/release/peer-floors.ts`
- `timeout 900 bun run release:gate`, `timeout 900 bun run demo:test`, `timeout 900 bun run guide:test`
- `timeout 120 bun scripts/release/versions.ts --tag v0.4.0`
- `bun scripts/release/acceptance.ts --plans 033-039 --map plans/evidence/040-acceptance-map.json --bench plans/evidence/040-bench.md --out plans/evidence/040-acceptance.md`
- `bun scripts/bench-quiet.ts --out plans/evidence/040-bench.md`
- `timeout 900 bun scripts/getting-started-test.ts --registry` and `timeout 900 bun scripts/demo-test.ts --registry`
- `npm view @arnilo/liveframe dist-tags`, and the same for `-runner-quickjs`, `-starter` and `-a2ui`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
