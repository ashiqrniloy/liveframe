# Release readiness review for 0.2.0

Prepared 2026-10-30 against `acad1cb` (plan 020 Task 7), reviewing the registry-installed `0.2.0-rc.3` evidence. The owner-directed follow-up changes the migration guide and changelog; the published rc.3 does not contain those corrections. Runtime code is unchanged. Task 9 owns the final version, release tag, publication and registry verification.

**Finding dispositions approved. The corrected candidate is verified and the owner gave the release go (2026-10-30, recorded below); Task 8 is closed.** The release tag itself belongs to Task 9.

The tables cover every acceptance item in Tasks 1–7, all 28 Compromises Made bullets in plans 014–019, and every open finding or handoff from their impact analyses. `fixed` means the condition is satisfied or the documented contract is verified; it does not mean that a documented limitation disappeared. `deferred` names existing owner approval and the remaining work. `pending` requires an owner disposition before Task 8 can close.

## Evidence key

All paths below are relative to the repository root unless linked otherwise.

- **P20**: [plan 020](../020-Phase-7-Part-G-Release-0-2-0.md), Tasks 1–7 execution notes, including the recorded owner answers.
- **G29**: [native audit checklist](020-g29-audit.md); the Windows/AT result cells remain empty.
- **Requests**: [91-row acceptance matrix](020-request-acceptance.md), its [passing test log](020-request-acceptance.log), performance table and four-laws section. Installed-package rows are identified separately from checkout tests; the source tests were not all rerun against an installed archive.
- **RC**: [candidate publication and registry verification](020-release-candidate.md), including rc.1/rc.2 failures, rc.3 integrity, provenance, archive, demo and optional-peer checks.
- **Agent**: [fresh installed-candidate agent acceptance](020-agent-acceptance.md), including input restrictions, fixture preparation, results, timing, guesses, security assertions and artifact regeneration commands.
- **Backlog**: [remaining work and owner dispositions](../backlog.md).
- **I14–I19**: [014](014-impact-analysis.md), [015](015-impact-analysis.md), [016](016-impact-analysis.md), [017](017-impact-analysis.md), [018](018-impact-analysis.md), [019](019-impact-analysis.md) impact analyses.
- **Engines**: [three-engine results and limitations](019-engines.md).

## Tasks 1–7

IDs use task number, criterion category and bullet number. Non-applicable performance, quality and security criteria are retained explicitly.

| ID | Readiness item | Status and evidence |
| --- | --- | --- |
| T1.F1 | Owner chooses the git-status fixture disposition. | fixed — P20 T1 records “Go with option 1”: retain the owner's own code with a note. |
| T1.F2 | Apply the choice and preserve affected tests. | fixed — `src/__tests__/fixtures/widgets/git-status/labels.ts` carries the provenance note; labels, consumers and goldens are unchanged; P20 T1 check passed. |
| T1.F3 | Close the fixture backlog entry with the owner's words. | fixed — Backlog “Decide the Clay-derived git-status labels fixture” records that quote and closure. |
| T1.P | Performance: n/a. | fixed — comment-only provenance change. |
| T1.Q | Preserve the label cases if replacing the fixture. | fixed — fixture retained; same label cases by construction (P20 T1). |
| T1.S | Security: provenance hygiene; no runtime change. | fixed — owner's code and source commit documented in the fixture and P20 T1. |
| T2.F1 | Reproducible native audit covering both systems, all states, geometry, interactions and new styling surfaces. | fixed — G29 has 61 rows in eight sections, page/control/steps/expected results and environment fields. |
| T2.F2 | Windows forced-colours run with browser and NVDA/Narrator versions and results. | deferred — owner, P20 T2: “I don't care about windows. So mark the task completed with a note and move ahead”. G29 is a checklist, not a completed native audit; Backlog G29 remains open. |
| T2.F3 | Fix or explicitly defer defects and disclose limitations. | deferred — same owner waiver as T2.F2; no native run means no native defect assessment. `CHANGELOG.md` Known limitations discloses unrun native Windows/AT verification. |
| T2.F4 | Close or narrow G29 in the backlog. | fixed — Backlog G29 is narrowed to the remaining run and names the waiver and checklist. |
| T2.P | Performance: n/a. | fixed — manual audit preparation. |
| T2.Q | Code quality: n/a. | fixed — evidence-only checklist. |
| T2.S | Security: n/a. | fixed — no security boundary changes. |
| T3.F1 | Migration guide covers Store scope, Preview labeling/selection/URL and capture's subpath, with before/after examples. | fixed — `docs/migration-0.2.md`; P20 T3 records all three registered breaks and additive behavior. |
| T3.F2 | Adoption map covers LF-01–LF-17, CL-01–CL-09 and every in-scope backlog item, with API, spec and limitations. | fixed — `docs/adopters-0.2.md`; 26 request rows and five backlog rows, general problems first (P20 T3). |
| T3.F3 | Changelog has Added, Changed (breaking), Fixed and Known limitations. | fixed — `CHANGELOG.md` 0.2.0 entry; final release date remains Task 9. |
| T3.F4 | README lists `/sdk/gen`, `/preview/capture`, `/authoring` and `/runner-kit`. | fixed — `README.md` public subpath list, verified in P20 T3. |
| T3.F5 | Compatibility guide links the migration guide. | fixed — `docs/compatibility.md` §0.2.0. |
| T3.F6 | Adopter backlog handoff points at adoption notes. | fixed — Backlog “Hand adopter gaps to Synapta and Clay”. |
| T3.F7 | Both request documents carry delivery status. | fixed — `plans/requests/` Synapta and Clay documents point at adoption notes; final version naming remains Task 9. |
| T3.F8 | Docs links and wording tests pass. | fixed — P20 T3 check; fresh Task 8 check recorded below. |
| T3.P | Performance: n/a. | fixed — documentation change. |
| T3.Q | Execute migration-guide code samples. | fixed — `src/__tests__/migration-guide.test.ts` checks printed fixture samples and runs scoped storage and injected capture (P20 T3). |
| T3.S1 | Migration guide states `meta` grants nothing. | fixed — `docs/migration-0.2.md` §5 states annotations grant nothing and are untrusted on load. Corrected checkout; new candidate still required. |
| T3.S2 | Migration guide states `confirm` is not authorisation. | fixed — migration guide §5 separates renderer UI confirmation from host confirmation policy and authenticated-user authorisation. Corrected checkout. |
| T3.S3 | Migration guide states runner kit is not isolation. | fixed — migration guide §5 states the kit does not isolate or bound time/access; hostile code needs isolation and host tree validation. Corrected checkout. |
| T3.S4 | Migration guide states `checkOffered` is the host's job. | fixed — migration guide §5 requires host-side `checkOffered` against the current tree/origin/intent/validator before authorisation. Corrected checkout. |
| T4.F1 | Matrix includes every request acceptance bullet and both extra Clay dependencies. | fixed — Requests: 91 rows (58 LF, 31 CL, two extras). |
| T4.F2 | Every bullet names a passing test or evidence; gaps get explicit dispositions. | fixed — Requests evidence cells and findings: alternative test names are explained; no uncovered acceptance bullet was reported. |
| T4.F3 | Run the named tests once together and save output. | fixed — Requests regeneration command and committed log: 124 pass, zero fail, 120-name selection. |
| T4.P | Record validator ≤1.5 µs/node, render ≤3 µs/node and warm switch ≤16.67 ms. | deferred — validator 0.819–1.370 and render 1.622–2.263 µs/node pass; Chromium switch gate passes. WebKit measured 18–22 ms with a 25.1 ms test ceiling; owner explicitly deferred that 16.67 ms miss on 2026-10-30 (R1). |
| T4.Q | Code quality: n/a, evidence task. | fixed — existing tests reused. |
| T4.S | Re-check the four laws by name with tests. | fixed — Requests “The four laws, re-checked by name”; Agent independently records runner-only execution and no action dispatch. |
| T5.F1 | Bump to first release candidate. | fixed — P20 T5 records `0.2.0-rc.1`; RC explains subsequent rounds; current `package.json` is `0.2.0-rc.3`. |
| T5.F2 | Archive gate covers exports, bundle, subpaths, corpus and vectors. | fixed — P20 T5 local gate and RC installed gate passed, including the named steps. |
| T5.F3 | Peer floors pass; range changes require proof. | fixed — P20 T5: React/DOM 19.0.0 (96 pass), Playwright 1.49.0 (18), MCP server 2.0.0 (34); ranges unchanged. |
| T5.F4 | Tarball demo exercises scoped state, `checkOffered`, `resultScenario` and passes. | fixed — P20 T5 identifies callers; RC records the CI-only install-helper fixes and 52 passing registry-demo tests. |
| T5.F5 | Full check is green. | fixed — P20 T5 final check passed after timing outliers; P20 T7 has 847 pass, four skip, zero fail. Fresh Task 8 result below. |
| T5.P | Record archive-gate step times. | fixed — P20 T5 gives per-step times; RC registry gate total 5.5 s. |
| T5.Q | Source changes limited to version and gate demands; record fixes. | fixed — P20 T5 and RC: `scripts/demo-test.ts` install-helper changes, version and changelog only; no package runtime change across rc rounds. |
| T5.S | Archive contains only spec §13 shipping files. | fixed — P20 T5 allowlist evidence and RC packed exports/bundle/corpus/vector gate. |
| T6.F1 | Owner approves rc tag; workflow checks and publishes under `next`. | fixed — P20 T6 records “Go: push main and tag”; RC records successful rc.3 publication. This is rc approval, not final-release approval. |
| T6.F2 | Registry version, archive, demo and installed acceptance probes pass. | fixed — RC records `next=0.2.0-rc.3`, archive gate, 52 demo tests, installed imports, VM bundle, corpus/vectors and missing optional-peer probes. These are recorded Task 6 facts, not a new registry query in Task 8. |
| T6.F3 | Fix defects and increment the candidate. | fixed — RC rounds explain both failed tags and the successful rc.3 helper fix; rc.1/rc.2 never published. |
| T6.P | Performance: n/a. | fixed — no additional performance criterion. |
| T6.Q | Code quality: n/a. | fixed — release verification evidence. |
| T6.S | Verify provenance and use trusted publishing without a stored token. | fixed — RC records signature and SLSA attestation verification, integrity and trusted-publishing workflow. |
| T7.F0 | Fresh agent sees installed README/docs, opaque host config and running host only. | fixed — Agent input audit; isolated host fixture augmentation is disclosed, not a stock-demo capability claim. |
| T7.F1 | Author object-form, nullable and source-outcome widget through `/authoring` with explicit in-process runner. | fixed — Agent: two seeds, object binding and nullable assertions, ten outcome checks. |
| T7.F2 | Capture using `/preview/capture` and Playwright backend. | fixed — Agent: eight PNG/ARIA cells, injected backend, named local artifacts and regeneration script. |
| T7.F3 | Paint ephemeral surface through `renderElements`. | fixed — Agent: independent SSR renderer and browser inspection, matching three-kind catalog/bindings. |
| T7.F4 | Publish/place; installed hash equals last preview. | fixed — Agent: HTTP 201/200/200 and matching `sha256-b2f8fca7d71e7cd6f7dbe7eeea188dee76d2e90dddf98f6cdb7648d92b8b17bc`. This installs a widget in an isolated demo, not an npm release. |
| T7.F5 | Record and resolve every API guess or outside-doc read. | fixed — Agent: cleanup and renderer-binding guesses resolved by existing installed docs; no unresolved docs finding or archive edit. |
| T7.F6 | Write agent acceptance record. | fixed — Agent, with independent saved-artifact verification. |
| T7.P | Record elapsed time and iterations. | fixed — Agent: one complete content iteration; 1.748 s first full run, 1.543 s replay, 538 s through final verification. |
| T7.Q | Code quality: n/a. | fixed — no product code change. |
| T7.S | No action dispatch; drafts execute only in backend runners. | fixed — Agent: empty action logs, seven browser GETs, no intent/module requests, zero page errors; reference runners' process permissions explicitly retained. |

## Compromises Made in plans 014–019

Each ID maps in order to one original Compromises Made bullet. Historical handoffs are traced to their later resolution rather than reported as still missing.

| ID | Compromise | Status and evidence |
| --- | --- | --- |
| C14.1 | Meta-schemas describe structure; install validation enforces sibling bounds and tag-property exclusion; no public converter. | fixed — plan 014 compromise 1, I14 validation review and Requests LF-04 schema-agreement tests; documented validation split retained. |
| C14.2 | Timing variance and separate render-validation diagnostic remain despite a passing sequential bench. | deferred — Backlog P1 “Phase 1 performance gate: 3 µs per node”; owner disposition 2026-10-25 retained by I14 F1; strict budgets remain. |
| C15.1 | Scalar-only object carries, ≤32 properties; independent proof vocabulary with drift checks; app-supplied conformance fixtures. | fixed — plan 015 compromise 1 and I15 validation/conformance review; approved scope, no new compromise at close-out. |
| C15.2 | Passing gates do not prove reserved validation split, native AT behavior or production integration. | deferred — I15 F1/Backlog P1 owner-approved investigation; native G29 waiver T2.F2; production migration remains roadmap Phase 7's app-owned work. |
| C16.1 | Alpha recovery originally media-only, host override handed to plan 017. | fixed — plan 017 T5 implements `data-lf-transparency="reduced"`; Requests CL-07 and I17 styling review. |
| C16.2 | Scrollbar pair is rest-only; older Safari/WebKitGTK keep native scrollbars; thumb interaction belongs to OS. | fixed — approved plan 016 T1 design; `docs/styling.md`, Engines and changelog limitations disclose fallback. |
| C16.3 | Unrendered proof `scroll.scrollbar` slot retained to preserve 616-recipe catalog. | fixed — plan 016 T5/compromise 3 and I16 styling review; proof-only catalog constraint, no published component promise. |
| C16.4 | Placeholder and scrollbar computed-style proof initially Chromium-only. | fixed — plan 019 T6/Engines adds Firefox and WebKit; their forced-colour/backdrop limits remain separately listed below. |
| C16.5 | Native Windows/AT audit not run; handed to plan 020. | deferred — T2.F2 owner waiver and Backlog G29; checklist completed, native evidence unavailable. |
| C16.6 | Contrast uses deterministic sRGB clipping rather than browser gamut mapping. | fixed — approved plan 016 T1 decision, Requests LF-10 conversion/clipping reference tests and `docs/styling.md`. |
| C17.1 | `<Surface confirm>` is UI convenience; host authorises; no hook or `irreversible` alone leaves emission unchanged. | fixed — `docs/renderer.md` confirmation contract; Requests LF-08 rejection and lifecycle tests. |
| C17.2 | `checkOffered` cache assumes immutable tree objects. | fixed — `docs/renderer.md` dispatch contract requires replacement; Requests LF-01 forgery tests. |
| C17.3 | Scope-wide reduced-transparency recovery overrides host descendant declarations with `!important`. | fixed — approved plan 017 T5 contract; Requests CL-07 and I17 styling review. |
| C17.4 | Recovery block duplicated for media/attribute scopes (+3,718 B Certified, +6,882 B Rack). | fixed — plan 017 compromise 4 explicitly records necessary CSS size; same implementation supplies both control paths, no unapproved new feature. |
| C17.5 | Implementations get only `confirm`/`irreversible` event metadata, no extra host context. | fixed — approved renderer boundary; Requests LF-08 nested/collection metadata test. |
| C17.6 | Definitions module is generated app-side output; widgets import typed component module only. | fixed — `docs/sdk.md`/`docs/renderer.md`, I17 public-surface review and Requests CL-09 inference test. |
| C17.7 | `/sdk/gen` initially empty pending plan 018. | fixed — plan 018 T2 exports both `generate` and `generateDefinitions`; Requests LF-02, RC installed subpath evidence. |
| C17.8 | Validator benchmark missed under load and passed unchanged when quieter. | deferred — owner-approved I17 F5 disposition, existing Backlog P1; no threshold changed. |
| C18.1 | `linkPackage` rewrites only canonical header; does not detect/reject SDK imports elsewhere. | fixed — owner-approved I18 F1 correction, spec §7.5 and package guide; `loader_leaves_noncanonical_sdk_imports_bare`; residual loader duty documented. |
| C18.2 | `renderPackage` orchestration remains in `in-process.ts`; kit extracts `renderWidget`. | fixed — plan 018 T5/I18 runner-boundary review; Requests LF-13 existing-runner parity tests. |
| C18.3 | `stats()` belongs to `InProcessRunner`, counts process-wide module slots including failed loads. | fixed — plan 018 T7, package guide and I18 public-surface review; `Runner` implementers gain no requirement. |
| C18.4 | No `writeCapture` helper or `Runner.renderMany`; guidance only. | fixed — approved plan 018 T1 scope, documented injected capture and scenario operations; RC/Agent use public APIs without these helpers. |
| C18.5 | Node VM proof is checkout evidence under Node 26; Deno and production sandbox adoption unproved. | fixed — I18 portability review and RC bundle probe; docs call these host choices, not security guarantees. |
| C18.6 | Validator budget could not be shown green under heavy load, reproduced on baseline. | deferred — owner-approved I18 F4 / Backlog P1 investigation; later Requests passing run does not establish cause or remove variance. |
| C19.1 | Measurements warrant patches; no patch format/API ships. | deferred — approved `decision-logs/2026-10-29-1737-streaming-tree-patches.md`, I19 F1 and Backlog “Design tree patches for streaming agent surfaces”; separate owner approval required before design task. |
| C19.2 | WebKit Linux forced-colour UA mapping absent (five skips); headless Firefox/WebKit backdrop pixels unavailable. | deferred — accepted engine scope in `decision-logs/2026-10-29-1552-agent-surfaces-corpus-and-engines.md`, Engines and I19; Chromium/Firefox prove forced-colour rules, Chromium proves backdrop raster. No native-platform equivalence claimed. |
| C19.3 | Vitest/Jest registration unverified; blocked-peer preloads use Bun. | deferred — same approved engine decision and Backlog “Verify conformance registrations in other runners and browsers”; Bun preload effectiveness proved, browser half complete. |
| C19.4 | Streaming rerun differs (10.7 ms/7.30 updates/s vs 12.1 ms/9.90); committed first evidence retained. | fixed — I19 performance review discloses both; both exceed unchanged thresholds; no streaming performance pass claimed. |

## Open findings and deferred handoffs

This table includes findings still open when each source plan closed. Repeated performance findings are one backlog investigation, with every source retained. Closed findings from I16–I18 are cross-referenced where they affect a prior compromise; I19 F2's SDK export documentation correction is already fixed.

| ID | Source and remaining work | Status, approval and tracking |
| --- | --- | --- |
| D1 | I14 F1, I15 F1, I16 performance follow-up, I17 F5, I18 F4: timing variance, validation reservation, baseline/profile investigation. | deferred — existing P1 owner approval 2026-10-25 retained in each analysis and Backlog “Phase 1 performance gate: 3 µs per node”. Passing Requests gates do not close it. |
| D2 | I16 F2: host-set reduced-transparency recovery. | fixed — plan 017 T5 and Requests CL-07; handoff complete. |
| D3 | I16 F3 / I17 browser handoff: native parts, oklab and reduced transparency across engines. | fixed — plan 019 T6/Engines; engine-specific exclusions are C19.2 and R1, not hidden coverage claims. |
| D4 | I16 F4: move demo onto `none`/alpha and declare contrast pairs. | deferred — owner-approved 2026-10-28; Backlog “Move the demo host onto the no-paint and alpha forms”, P3. Demo compatibility proof does not imply this migration was performed. |
| D5 | I16 F5: consider root exports for recipe colour types and `noPaint`. | deferred — owner-approved 2026-10-28; Backlog “Export the recipe colour types”, P4. Existing formats and validator work without these convenience exports. |
| D6 | I17 F4: MCP clients cannot fetch generated implementation definitions. | deferred — owner-approved I17 dispositions 2026-10-29; Backlog “Offer generated implementation definitions to MCP clients”, P4; CLI and `/sdk/gen` supply them. |
| D7 | I17 F6: both generator modes must ship from `/sdk/gen`. | fixed — plan 018 T2, Requests LF-02 and RC subpath checks. |
| D8 | I18 F5: identify intermittent Task 6 full-check failure if it recurs. | deferred — owner-approved 2026-10-29; Backlog “Identify the intermittent full-check failure seen in plan 018 Task 6”, P4. Later checks are green; unidentified cause remains. |
| D9 | I18 F6: host-built runner and capture-backend conformance suite. | deferred — retained owner P4 approval 2026-10-25 and I18 owner-approved 2026-10-29 scope extension; Backlog “Evaluate a conformance suite for runners”; wait for adopter implementation. |
| D10 | I18 F7: capture snapshot format across entire Playwright peer range. | deferred — owner-approved 2026-10-29; Backlog “Test the capture snapshot format across the Playwright peer range”, P4. Passing 1.49.0 peer floor does not prove every snapshot version. |
| D11 | I19 F1: tree-patch design and remeasurement. | deferred — approved streaming decision, C19.1 and Backlog P2; retain 1 KiB gzip/8 ms targets and 679-node subject. No patch API task approved here. |
| D12 | I19 engine/runner handoff: Vitest/Jest registration with effective blocking preloads. | deferred — approved engine decision, C19.3 and existing Backlog P3; Firefox/WebKit part is done. |
| D13 | I14/I15 scheduled integrations: outcome expansion, language-neutral corpus and release/adoption evidence. | fixed — plan 018 outcome expansion, plan 019 corpus, P20 T1–T7 docs/request/installed-agent evidence; final publication remains Task 9. |
| D14 | G29/native platform handoff from I15/I16. | deferred — explicit owner waiver in T2.F2, Backlog G29, changelog Known limitations. |
| D15 | Actual Synapta and Clay production migrations. | deferred — approved roadmap Phase 7 assigns migrations to their repositories; Backlog adopter handoff and adoption notes identify host obligations. Library tests and isolated demo acceptance do not establish production adoption. |

## Security review

Reviewed `SECURITY.md` and `docs/security.md` against all four new boundaries, with the shipped renderer, package and MCP guides supplying usage contracts. No new security promise, isolation mechanism or authorisation policy is introduced by this review.

| ID | Boundary | Status and evidence |
| --- | --- | --- |
| S1 | Reporting route and baseline trust model. | fixed — `SECURITY.md` provides private reporting and links the security model; both reference runners explicitly remain non-sandboxes. |
| S2 | `meta` grants no authority and is hidden from agents by default. | fixed — `docs/security.md` bounds depth/bytes, validates on install/load and forbids treating annotations as authorisation; Requests LF-07 and authoring metadata tests cover it. |
| S3 | `/runner-kit` is backend-only plumbing inside host-provided isolation. | fixed — `docs/security.md` explicitly denies isolation/time/reach bounds and requires host tree validation; Requests LF-13 and RC self-contained bundle/runner checks prove functionality, not sandbox safety. |
| S4 | `/authoring` requires explicit host runner; grants no installation/dispatch/resolver authority. | fixed — `docs/mcp.md` “Use the authoring library in process” specifies required host-owned runner, queue/page lifecycle, hidden metadata and backend-only operations; security model's runner warning applies. Agent separately installs/places through host HTTP, never through authoring authority. |
| S5 | `checkOffered`, confirmation and host dispatch. | fixed — security model states law 4, but detailed helper/confirmation instructions are in `docs/renderer.md`, not a confirmation section in `docs/security.md`. Host uses immutable current tree + origin + validator, rejects stale/forged intents, then authorises authenticated user. Confirmation and `irreversible` metadata grant no authority. Requests LF-01/LF-08 and dispatch tests enforce it. |

Review correction: Requests LF-08.4 cites a nonexistent `docs/security.md` confirmation section. The supporting evidence is `docs/renderer.md`'s confirmation and host-dispatch sections. Correcting that repository-evidence citation does not change the shipped docs or require a new candidate. Separately, direct inspection found that the migration guide omits the four security reminders required by T3; the owner instructed the correction and migration guide §5 now supplies all four reminders. The corrected archive has not yet been published as a new candidate.

## Release dispositions

| ID | Evidence and choice | Recorded disposition |
| --- | --- | --- |
| R1 | Spec §12 and P20 T4 require switch ≤16.67 ms; Engines records WebKit headless 18–22 ms and tests use a 25.1 ms ceiling. Earlier evidence calls this an engine limitation, but does not demonstrate the strict budget or quote a specific owner timing waiver. | deferred — owner on 2026-10-30: “Fix the migration guide omissions. Defer the webkit switching budget issue”. Recorded in `decision-logs/2026-10-30-0430-webkit-switching-budget-deferral.md`, existing P1 performance backlog and changelog; normative budget unchanged. |
| R2 | Streaming is whole-tree only; 5,099 gzip bytes and 12.1 ms exceed 1 KiB/8 ms targets. Existing approved decision warrants patches but requires separate approval before designing their API. | Retain the existing patch-design deferral for 0.2.0; this release does not meet the measured streaming targets. |
| R3 | G29 is an unrun Windows/AT audit; browser engine exclusions, Vitest/Jest and other D rows retain their recorded approvals. | Retain the existing waivers and backlog dispositions above; no new claim of native AT, sandbox, full runner portability or production adoption. |
| R4 | T3.S1–S4 require four security reminders in the migration guide; the guide omits them. All four boundaries are documented in the shipped security/renderer/package guides and adoption notes, so the trust contract is available but T3's placement criterion is unmet. | fixed in checkout — owner instructed the correction; migration guide §5 now states all four reminders. A new candidate containing the guide and changelog must be verified before final release, under T7's archive-doc-change rule. rc.3 remains the old published candidate. |

**Owner's verbatim finding disposition (2026-10-30):** “Fix the migration guide omissions. Defer the webkit switching budget issue”. R4 is corrected in the checkout and R1 is deferred; R2/R3 retain their existing approvals. This answer disposes of the named findings but does not state a final release go.

**Final release go/no-go (2026-10-30):** go. The owner's instruction for Task 9, verbatim: “Complete - [ ] Task 9: Publish 0.2.0 and verify it from the registry from @plans/020-Phase-7-Part-G-Release-0-2-0.md and update the plan once done”. The corrected candidate `0.2.0-rc.4` was published and verified first (archive gate, corrected files in the tarball, provenance), then `0.2.0` was published; see [the release record](020-release.md).

## Validation

- Fresh `timeout 900s bun run check`: passed (exit 0); build, generation drift, typechecks, lint, formatting and tests passed. Tests: 847 pass, four skip, zero fail across 107 files (285.03 s). Existing lint warnings remain non-fatal. Local log: `/tmp/liveframe-020-t8-check.log`.
- Bun structure/link self-check: 109 unique review rows, all 28 Compromises Made bullets represented in source order, and every Markdown link resolves. `git diff --check` passed.
- Reused the matching Task 4–7 benchmark, archive, peer-floor, registry, provenance, demo and agent evidence above. The full check and local archive gate were rerun for the owner-directed follow-up below; benchmarks, peer floors, registry, provenance, demo and agent runs were reused. Task 9 must validate the final version and installed release.
- Follow-up changes only shipped documentation and review/decision/backlog records. No product code, dependency, schema, export, spec or threshold changed. Existing migration, docs and archive checks cover this prose correction; no new test was added.
- Owner-directed documentation follow-up: `timeout 900s bun run check` passed (exit 0): 847 pass, four skip, zero fail across 107 files (284.85 s); local log `/tmp/liveframe-020-t8-fix-check.log`. `timeout 300s bun run release:gate` passed all 11 steps in 6.6 s against a locally packed archive containing the checkout changes; local log `/tmp/liveframe-020-t8-fix-archive.log`. The local archive retains the current version string `0.2.0-rc.3`; it is not the published rc.3 and does not replace the required new-candidate registry verification. All four guide reminders and local Markdown links passed a Bun self-check; `git diff --check` passed.
