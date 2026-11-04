# Plans 023–025 architectural impact analysis

Reviewed 2026-11-05 against `0f8e8c4` (the 0.2.3 release plus its verification records) and the owner-approved Task 11a key fix. This report covers all twelve areas in `.agents/skills/create-plan/references/liveframe.md` §5, including the findings handed forward by plans 023 and 024. Task 11 does not close Task 8's performance proof or Task 10's dist-tag repair. Task 11a is an Unreleased checkout fix; it does not alter the published 0.2.3 archive.

Method: read all of plan 025, the earlier impact reports, scope and release-exception decisions, release readiness and acceptance records; inspect the release diff, normative spec changes and current guides; trace shared helpers, byte accounting and key encoding with graft. The schema/corpus/vector diff against `v0.2.2` is empty and `scripts/release/api/register-0.2.3.json` remains `[]`. Existing uncommitted plan-index and roadmap scope/numbering edits were present before this task and are preserved.

## 1. Spec

The shipped contracts remain described by `docs/spec.md`: §6.3 deprecates dimension fractions without rejecting them; §7.1/§7.3 reject top-level `await using`; §11 describes id-matched reuse and the validator/portal/diagnostics-on-off reset boundary; §13 records warnings-as-errors. Plan 024's stale reuse sentence and plan 025 Task 7's promise-return wording were already corrected. Internal helper/closure extraction changes no normative meaning. Task 11a corrects F1 at the existing key-validation boundary, preserving valid key paths and §10's typed-failure contract; no normative meaning changes.

## 2. Public API and formats

No new declaration, subpath, format field or format version. Both API baselines remain enforced; the stricter 0.2.2 comparison has an empty register. `src/internal.ts` and `findNode` are private to implementation modules; un-exported file-local definitions were absent from the public baseline. Published schemas, corpus and hash/patch vectors have no diff from `v0.2.2`. The 0.2.3 installed archive passed the API gate, as recorded in [release verification](025-release.md). Package freezing, render-input ownership, dimension-fraction rejection and a verified-package cache remain 0.3.0 work (F4).

## 3. The four laws

1. Widget execution remains on the backend. Module checking rejects the extra suspension construct; bundled sucrase is a pack-time transform, not browser widget execution.
2. Runner trees are validated on the host before storage, counting or reporting; malformed worker failures and corrupt placement listings fail closed. Byte accounting remains shared between construction and validation.
3. Theme authority and primitive-only composition are unchanged. Dimension fractions retain their old CSS bytes pending the minor-release rejection.
4. Widgets gain no authority. Offered-event checks, origin stamping and intent completion survive the renderer/authoring splits. The hash cache now detects top-level field replacement; nested package mutation and hostile-code isolation remain documented host responsibilities (F4/F5).

No new route around a law was found. Reference runners and syntactic import checks remain explicitly non-sandbox mechanisms (R26).

## 4. Validation

Plans 023–025 add typed rejection coverage for invalid/cyclic custom-runner trees, asynchronous module evaluation, malformed worker failures and placement records. The 1,000-tree byte-budget test checks exact acceptance at L bytes and rejection at L−1, including lone surrogates in JSON prop values. The schema differential suite covers all eleven published registry schemas plus embedded vocabulary with 200 seeded structural mutations per seed and deliberate-drift self-checks. Transport structure and install-time relationships remain distinct; impossible sentinel-length allocations are explicitly skipped.

F1 was reproduced in this review with `bun --conditions liveframe:source -e`, the proof catalog/capabilities/agent-home manifest and valid fixture inputs: render a stack containing either `jsx(primitive("text"), { text: "child" }, "\ud800")` or a fragment with that key around a text child. Both threw `URIError` rather than returning `Result`. Task 11a now rejects malformed keys in `isValidKey` before either encoding path. Regression tests cover high/low and embedded lone surrogates, composed-component keys, valid astral pairs and exact slash/colon/CJK escaping. Default host validation limits (F5) and single-source formats (F4) remain existing follow-ups.

## 5. Styling

No new recipe, visual style or primitive implementation. `themeCss` caches only validated catalogs, guards against mutation, and retains deterministic CSS and failure behavior. Contrast checking now narrows lookups rather than asserting them; it adds no new theme authority. The existing proof contrast-audit backlog is unchanged. Dimension fractions remain deprecated and byte-compatible until 0.3.0 (F4).

## 6. Interaction tiers

No new interaction contract. Local behavior, `setState`, actions and confirmation stay in their existing layers. Renderer helpers receive explicit private context; hooks and memo dependencies remain in `Surface`. Reused handlers read the current tree/callbacks, failed nodes retry, and authoring operations retain serial ordering and offered-intent checks. Shared queue failure isolation prevents a rejected operation from poisoning later work. Existing renderer, preview, authoring and MCP suites cover these paths.

## 7. Performance

Retained improvements: inline-fallback reuse, id-matched children, SHA/canonical JSON, bundling, shuffled diffs and theme-catalog hits. The closure splits met their individual A/B gates and preserve the cached-item fast path. The UTF-8 hash encoder deliberately keeps its strict surrogate handling and one-pass allocation strategy; JSON-string byte accounting is a different operation from UTF-8 source sizing.

No clean cumulative absolute-budget proof is claimed. Task 8 records loaded-host absolute failures and cumulative validator/render ratios up to 1.064/1.096. The owner explicitly approved publication with this proof open; Tasks 8 and the quiet-host backlog remain open (F2). Missed SHA 2×, packageHash ≤5 ms and R14 15% targets remain recorded. Removing the identity cache still regresses performance; the JSON prototype and event-regex substitutions remain measured, no change (F6). Task 11a adds one surrogate check after the existing 128-code-unit key bound; it adds no traversal or normalization. No new performance claim is made.

## 8. Portability

Shared helpers import no host APIs. Core, SDK, hashing, CSS and the self-contained validator/runner bundles retain their portability boundaries. Sucrase is bundled into `/pack`, licensed, scanned for forbidden imports, audited as shipped code and included in the SBOM alongside acorn. The installed archive's Node probe and all three peer floors passed in release verification. Bun-only development tooling stays outside the shipped host-API-free core; no dependency was added by this review.

## 9. Agent authoring

Generated declarations and implementation definitions remain compatible. Extracted generator helpers preserve output bytes. Agents receive actionable validator kinds/pointers for invalid runner trees and relative draft filenames rather than host paths. UTF-8 response sizing, capture binding, latest-package lookup and queue serialization retain their behavior. F1 is relevant to author-generated keys; open-handle draft reads and configurable limits remain F5.

## 10. Docs and examples

The changelog, compatibility/migration notes, adopter guide, renderer guide and security/MCP docs describe 0.2.3 and its limitations. The unchanged 0.2.2 demo host passed against the upgraded archive (53 tests), establishing a concrete upgrade example. The release candidate and final archive/provenance checks are recorded separately.

F7 corrects bookkeeping that still described completed release setup/publication/impact work as pending: the prior plans' Further Actions, the acceptance ledger, readiness status and roadmap. Historical measurements and decision logs remain historical records. Existing `plans/README.md` edits are not part of this task's commit.

## 11. Conformance

The store suite gained `store_lists_only_placement_records`; its case count and malformed-record tests were updated together. Renderer, law, portability, corpus, differential-byte/schema/patch and hash-vector checks cover the delivered changes without weakening existing law assertions. No format/port vector changed. The existing optional runner-conformance-suite backlog remains applicable; no new public runner suite is necessary to finish this release. The top-level `await using` rule remains in the normative pack contract and unit tests; the existing package corpus describes documents, not source-module execution.

## 12. Reference hosts

No Synapta or Clay request was reinterpreted and no product primitive was added. Hosts gain correct invalid-runner rejection, prepended-row reuse and stable reuse across inline fallback/diagnostic values. Hosts using larger runner limits still need the existing limits follow-up; shared writable draft roots still need handle-based reads. Hosts must declare sucrase themselves if they previously relied on the transitive dependency. Clay's CL-14 next-tag issue recurred and remains tracked by F3; no adopter is told it is repaired.

## Findings and dispositions

Existing dispositions below come from the [approved release scope](../../decision-logs/2026-11-03-1132-release-0-2-3-scope.md), [023 impact review](023-impact-analysis.md), [024 impact review](024-impact-analysis.md), and [release exception](../../decision-logs/2026-11-04-2116-release-0-2-3-with-quiet-host-proof-open.md). They are retained, not new deferrals. The owner's request to complete Task 11 authorizes the bookkeeping corrections in F7. After presentation of the findings table and recommendation to backlog F1, the owner instead answered **“Execute the key error fix now”** on 2026-11-05. Task 11a implements that disposition; no decision log is needed for this bounded defect correction.

| Finding | Recommended disposition | Evidence / destination / approval |
| --- | --- | --- |
| F1 — Lone-surrogate keys throw an untyped `URIError` | Executed, owner selected over recommended backlog | Task 11a, commit `91de429`, corrects `isValidKey` (`src/sdk/render.ts:544`) before primitive/fragment encoding. Red-before/green-after regression tests and unchanged valid Unicode ids; Unreleased changelog entry. Owner: “Execute the key error fix now”. |
| F2 — Quiet-host absolute and cumulative performance proof is missing | Backlog P3; retain Task 8 open | Existing “Re-run the full benchmark suite on a quiet host” entry. Owner: “Leave the quiet-host requirement open” and “Go: release with quiet-host proof open”. No thresholds change. |
| F3 — `next` promotion failed after successful final publication | Backlog P3; retain Task 10 open | Existing “Enable trusted-publisher dist-tag management on npmjs.com or update next tag” entry and [release verification](025-release.md). The recorded registry state is `latest=0.2.3`, `next=0.2.3-rc.1`; owner repair confirmation remains pending. No republish. |
| F4 — Deferred ownership, dimension, caching and schema work | Retain existing backlog P3 and 0.3.0 migration entries | “Freeze packages and preserve caller ownership of render inputs in 0.3.0”; “Reject fractions on dimension props in 0.3.0”; “Add an opt-in verified-package cache to loadPlacement in 0.3.0”; “Derive format checkers and published JSON Schemas from one source”. Approved scope, R4/R5/R9/R15/R24. |
| F5 — Handle-based draft reads and configurable session validation limits | Retain existing backlog P4 | “Read draft directories through an open handle” (approved R8 split); “Let `createPreview()` and `createAuthoring()` take validation limits” (023 impact F5). Current trust/limit restrictions remain documented. |
| F6 — Unmet optimization targets and measured no-change paths | Retain existing backlog P4; array exit remains closed | “Cut the validity cost inside `walkJson`”; “Reach 2× on the pure-JS SHA-256 only if hashing shows up in a profile”; JSON prototype, event-name regex and runner-kit identity-cache entries. Array full-sink exit already exists. Approved 024 impact dispositions and 025 Task 7 handoff; packageHash absolute proof also belongs to F2. |
| F7 — Stale execution handoffs and acceptance status | Executed in Task 11 | Reconciled plans 023/024 Further Actions, plan 025 Compromises/Further Actions, acceptance/readiness status, existing backlog cross-references and roadmap §3. No new architecture or release approval. |

## Verification

- Before Task 11a, `timeout 900s bun run check` passes: build, generated files, types, lint and format, then 1,063 pass, four skip, zero fail, 143,287 assertions across 120 files (372.30 s of tests). Load before 5.70, after 4.68: not quiet-host proof.
- New focused regression test fails before the fix with the original `URIError`; the valid Unicode/escaping case passes before and after.
- After the fix, SDK render/elements, byte agreement, portability and both API baselines pass: 43 tests, 6,727 assertions, zero fail. The first full check caught a test-local component factory; the fixture moved to module scope, without suppression.
- Final post-fix `timeout 900s bun run check` passes build, generated files, types, warnings-as-errors lint, format and tests: 1,065 pass, four skip, zero fail, 143,313 assertions across 120 files (357.61 s of tests). Host observations remained above 2; this does not close Task 8. Rechecked `git diff --exit-code v0.2.2 -- schemas conformance` and the empty API register.
- Release archive, peer-floor, demo, audit/SBOM and provenance evidence is retained from Tasks 9/10. This task does not republish or repeat the loaded-host benchmark loop.
