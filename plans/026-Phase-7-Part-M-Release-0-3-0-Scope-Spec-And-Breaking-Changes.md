# Phase 7 Part M: Release 0.3.0 — Scope, Spec Restructure and the Breaking-Change Batch

Depends on: plan [025](025-Phase-7-Part-L-Release-0-2-3-Simplification-And-Release.md) Tasks 1–11a complete (0.2.3 published). Plan 025 Task 8 (quiet-host proof) and Task 10 (`next` dist-tag repair) are carried into plan [032](032-Phase-7-Part-S-Release-0-3-0.md) Tasks 3 and 5 unless they close first; Task 1 below records which. Followed by plans [027](027-Phase-7-Part-N-Release-0-3-0-Formats-References-Extensions-Axes-And-Urls.md) (formats), [028](028-Phase-7-Part-O-Release-0-3-0-Template-Widgets-And-Streaming.md) (template widgets), [029](029-Phase-7-Part-P-Release-0-3-0-Interaction-Outcomes-Local-Bindings-And-Surface-Core.md) (interaction and renderer core), [030](030-Phase-7-Part-Q-Release-0-3-0-Host-Pipeline-Evolution-And-Dependencies.md) (host lifecycle), [031](031-Phase-7-Part-R-Release-0-3-0-Isolated-Runner-Conformance-And-Starter.md) (isolated runner, runner conformance, starter) and [032](032-Phase-7-Part-S-Release-0-3-0.md) (the release). Source: the 2026-11-05 evaluation of Liveframe against the goal of being the canonical runtime-UI system (weaknesses W1–W9 and lesser gaps), plus every item already queued for 0.3.0 in `roadmap.md` Phase 7, `docs/compatibility.md` § "Deferred to 0.3.0" and `plans/backlog.md`.

## Objectives

- Record the 0.3.0 scope decision. The owner's instruction (2026-11-05): "make 0.3.0 include everything that has been already planned and everything that you have identified. Let it be a big release." Plus three owner decisions: no Node runtime support, the isolated runner ships as a separate optional package, and the release is a minor that may break with migration entries.
- Freeze the 0.2.3 public surface as the 0.3.0 baseline. Extend the API register so a breaking change is allowed only when it names its migration entry.
- Restructure `docs/spec.md` into a normative core plus feature sections, with release history moved out, before plans 027–031 edit it (W9).
- Land the queued breaking changes together: package freezing and render-input ownership (R4/R5), rejection of dimension fractions (R9), one realm rule for validators, validation limits for preview and authoring sessions, the verified-package cache option (R15), and `focusContinuity` on by default.
- Derive format checkers and published JSON Schemas from one source (R24).

## Expected Outcome

- `decision-logs/<date>-release-0-3-0-scope.md` is approved. Its item table (copied below) maps every item to a plan and task.
- `scripts/release/api/0.2.3.json` and `scripts/release/api/register-0.3.0.json` exist. `api-stability.test.ts` compares the checkout against 0.2.3 with that register, which now accepts `removed` and `changed` entries only when each names a heading in `docs/migration-0.3.md`.
- `docs/spec.md` reads as a normative document: no "as in 0.2.1" sentences, one rule per paragraph, and a mapping table in `plans/evidence/026-spec-restructure.md` proving no normative sentence was lost.
- `pack()`/`verifyPackage()` return deeply frozen packages. `render()` no longer freezes caller objects. `width="2fr"` is `invalid-prop`. Every public validator rejects a foreign-realm document with the realm message. `createPreview`/`createAuthoring` take `limits`. `loadPlacement` takes an opt-in verified-package cache. `<Surface>` keeps focus by default.
- Structural checkers and `schemas/*.json` come from one definition per format; schema drift becomes impossible rather than tested.
- `docs/migration-0.3.md` exists with a before/after, a code sample and an adopter checklist for every break in this plan.

This plan opens the 0.3.0 minor release in roadmap Phase 7. 0.3.0 is the break window that 0.2.x deferred to: breaks are allowed, but every one gets a migration entry, a register entry and a CHANGELOG line. Spec sections touched: all (restructure, Task 2), then §6.3, §7.2–§7.5, §10, §11 and §13. No version is bumped and nothing is published here; plan 032 releases.

### 0.3.0 scope items

| # | Item | Source | Plan / task |
|---|---|---|---|
| Q1 | Node references (`ref()`, `$anchor`, `refProps`) | `decision-logs/2026-11-02-1219-defer-node-references-to-0-3-0.md` | 027 T2–T3 |
| Q2 | Extension recipe properties | `decision-logs/2026-11-02-2208-extension-recipe-properties-for-0-3-0.md` | 027 T4 |
| Q3 | Multiple variant axes, revised to alias colour roles | `decision-logs/2026-11-02-2208-multiple-variant-axes-for-0-3-0.md` + evaluation | 027 T1, T5 |
| Q4 | Frozen packages; render keeps caller ownership (R4/R5) | `docs/compatibility.md` § Deferred | 026 T3 |
| Q5 | Reject `fr` on dimension props (R9) | same | 026 T4 |
| Q6 | Verified-package cache option for `loadPlacement` (R15) | same | 026 T7 |
| Q7 | `limits` on `createPreview`/`createAuthoring` | backlog | 026 T6 |
| Q8 | One realm rule across validators | backlog | 026 T5 |
| Q9 | One source for checkers and JSON Schemas (R24) | backlog | 026 T9 |
| Q10 | `focusContinuity` on by default | 0.2.2 opt-in rule | 026 T8 |
| W1 | Isolated runner as a separate optional package; runner conformance suite | evaluation; owner decision | 031 T1–T5 |
| W2a | Template widgets: declarative, data-bound, no sandbox needed | evaluation | 028 T1–T6 |
| W2b | Progressive rendering of streamed agent documents | evaluation | 028 T7 |
| W3a | Action-outcome contract | evaluation | 029 T1–T2 |
| W3b | Local bindings evaluated in the browser | evaluation | 029 T1, T3–T4 |
| W4 | Stateless host pipeline (`/host`); demo host shows full orchestration | evaluation; backlog | 030 T1–T3, T5 |
| W5a | Catalog impact report for installed packages | evaluation | 030 T6 |
| W5b | Several catalog majors in one renderer | evaluation | 030 T7 |
| W5c | Declarative state migration | evaluation | 030 T8 |
| W6a | Content-addressed package dependencies | evaluation | 030 T9–T10 |
| W6b | Cross-placement coordination through source dependents | evaluation | 030 T4 |
| W7a | Framework-independent surface core (`/surface`) | evaluation | 029 T4 |
| W7b | Starter package and getting-started guide | evaluation | 031 T6–T7 |
| W7c | Bun-only runtime, recorded | owner decision | 026 T1, 031 T1 |
| W8a | App-declared states and semantics | evaluation | 027 T6 |
| W8b | `url` string form with a scheme allowlist | evaluation | 027 T7 |
| W9 | Spec restructure | evaluation | 026 T2 |
| L1 | Localisation guidance and determinism rule | evaluation | 029 T6 |
| L2 | Observability hooks | evaluation | 029 T5, 030 T2–T3 |
| O1 | Quiet-host benchmark proof (carried from 025 T8) | plan 025 | 032 T3 |
| O2 | `next` dist-tag (carried from 025 T10) | plan 025 | 032 T5 |

Not in scope: nested surfaces (the analysis named the gap but proposed composition through dependencies and coordination instead; lifting §6.4's no-nesting rule changes every sheet), a second renderer (W7a ships the core a second renderer needs), Node runtime support (owner decision).

## Compatibility rules for every task

1. **A break needs four things in the same task:** a `register-0.3.0.json` entry with `change: "removed" | "changed"` and a `migration` heading, the heading in `docs/migration-0.3.md` (before, after, code sample, adopter checklist), a CHANGELOG "Changed" or "Removed" line, and a spec update.
2. **Additions are `added` or `widened`,** as in 0.2.2.
3. **A format change that an older validator must reject keeps the format id** when the change is an optional field (the 0.2.1/0.2.2 precedent). A change of meaning for an existing field takes a new format id.
4. **Corpus, hash and patch vectors change only with a format version,** or with a register entry that names the vector file and the migration heading.
5. **Every task leaves `bun run check` green,** including the API gate.

## Tasks

- [x] Task 1: Record the 0.3.0 scope decision and gate the 0.2.3 surface with a breaking-aware register
  - Acceptance Criteria:
    - Functional:
      - Write `decision-logs/<date>-release-0-3-0-scope.md` with `create-decision-log`. It holds the scope table above, the three owner decisions (big release; no Node runtime support, so backend subpaths stay Bun ≥ 1.4.2 and the archive gate's Node probe stays a portability probe only; the isolated runner is a separate optional package), the "not in scope" list with reasons, and the disposition of plan 025 Tasks 8 and 10. Approval evidence is the owner's 2026-11-05 instruction quoted in Objectives.
      - Generate `scripts/release/api/0.2.3.json` from a temporary worktree at `v0.2.3`, exactly as `0.2.2.json` was made (plan 023 Task 1). Create `register-0.3.0.json` as `[]`.
      - Extend `scripts/release/api-surface.ts` (`change` union at `:36`) with `removed` and `changed`. Each needs a non-empty `migration` string. The comparator fails when a `removed`/`changed` entry's migration heading is not a heading of `docs/migration-0.3.md`, when a removed export still exists, or when a `changed` entry's declaration did not change.
      - Create `docs/migration-0.3.md` with its introduction and an empty "Breaking changes" section. `migration-guide.test.ts` covers it as it covers `migration-0.2.md`.
      - Add `baseline_0_2_3_matches_the_checkout_through_the_0_3_0_register` to `api-stability.test.ts`. The 0.2.1 and 0.2.2 comparisons are retired in the same change, with the reason in the test file header: 0.3.0 may break them by design.
    - Performance: n/a — a data file and a test.
    - Code Quality: one comparator, extended; no second script.
    - Security: n/a for the laws. The gate makes every contract change visible and documented.
    - Compatibility: adds no public surface.
  - Approach:
    - Skills to Use:
      - `create-decision-log` — scope and owner decisions, approval recorded.
      - `liveframe-execution` — authority order, green-after-task.
    - Library Documentation to Check Before Implementation:
      - none; `scripts/release/api-surface.ts` and plan 022 Task 1 notes record the TypeScript compiler API in use.
    - Documentation Reviewed:
      - `scripts/release/api-surface.ts:36,191-269` (register classes and failure messages).
      - `src/__tests__/api-stability.test.ts`; `docs/compatibility.md` § "Deferred to 0.3.0"; `docs/migration-0.2.md`.
      - `decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md` (opt-in and no-break rules this release lifts).
    - Options Considered:
      - Allow breaks without a register entry. Rejected: an undocumented break is exactly what R15 prevents.
      - Keep the 0.2.1/0.2.2 comparisons. Rejected: they would fail on every intended break and say nothing the 0.2.3 comparison does not.
    - Chosen Approach:
      - One baseline (0.2.3) and one register whose break entries are tied to migration headings by the comparator.
    - API Notes and Examples:
      ```json
      { "subpath": "./sdk", "name": "render", "change": "changed", "task": "026 T3",
        "reason": "No longer freezes caller-owned inputs in place", "migration": "Render inputs keep caller ownership" }
      ```
    - Files to Create/Edit:
      - `decision-logs/<date>-release-0-3-0-scope.md`
      - `scripts/release/api/0.2.3.json`; `scripts/release/api/register-0.3.0.json`
      - `scripts/release/api-surface.ts`; `src/__tests__/api-stability.test.ts`
      - `docs/migration-0.3.md`; `src/__tests__/migration-guide.test.ts`
      - `docs/compatibility.md`: describe the current minor-release gate and retain patch-gate history.
  - Test Cases to Write:
    - `baseline_0_2_3_matches_the_checkout_through_the_0_3_0_register`: fails on any unregistered declaration or schema change.
    - `register_break_without_migration_heading_fails`: a fixture register with `change: "removed"` and an unknown heading fails the comparator.
    - `register_removed_entry_for_existing_export_fails`: catches a stale removal entry.
    - Changed declarations require a real migration heading and reject stale `changed` entries; complete subpath removal requires entries for its exports; schema and corpus/hash/patch changes require matching classifications and migration headings.
  - Notes (executed 2026-11-05):
    - Recorded the owner's approved scope and complete item table in `decision-logs/2026-11-05-0238-release-0-3-0-scope.md` using `create-decision-log`. Plan 025 Tasks 8 and 10 remain open and carry into plan 032 Tasks 3 and 5.
    - Generated `scripts/release/api/0.2.3.json` from a detached worktree at `v0.2.3` (`f9458d8`), with a frozen install and build. `generatedFrom` records the commands; the temporary worktree was removed. `register-0.3.0.json` starts as `[]`.
    - Extended the existing comparator for documented `removed`/`changed` entries, exact migration headings outside code examples, stale-change rejection and whole-subpath removal. Existing corpus/hash/patch changes now require a matching break entry naming the full file path, as required by this plan's compatibility rule 4. Task identifiers also accept plan-qualified strings such as `026 T3`.
    - Retired the 0.2.1/0.2.2 checkout comparisons with the reason in the test header; retained their data files. Added the empty 0.3 migration guide, guide-structure coverage and current-gate documentation in `docs/compatibility.md`. No public API or normative spec meaning changed.
    - Tests were written first and reproduced missing migration validation and removal/change handling. The focused API and migration suites pass (14 tests). `timeout 900s bun run check` passed: build, generated-file checks, typecheck, lint, formatting and 1,070 passing tests, 4 existing skips, 0 failures.
    - First full check: 1,069 pass, 4 existing skips, one unchanged CSS timing test failed (`switch_under_budget_with_blur`, one 22.4 ms sample against 16.67 ms). Its isolated rerun passed with a 6.6 ms maximum; no runtime code or threshold was changed. The full-check retry also passed that test and the complete suite. Dedicated benchmarks were not run: this task changes release tooling and documentation only.
    - Finding for Tasks 3 and 8: behaviour-only changes can leave emitted declarations identical, so their proposed `changed` entries would correctly fail the stale-entry gate. Their approaches now require reconciling behaviour evidence with register representation in those tasks without fake declaration edits or weakening the stale-declaration check.

- [x] Task 2: Restructure the spec into a normative core and feature sections (W9)
  - Acceptance Criteria:
    - Functional:
      - `docs/spec.md` keeps its section numbers §1–§15 (every link and the `docs-links` test keep working) but each section opens with its normative rules as short numbered statements, followed by rationale. Paragraphs over 120 words are split. Release history ("as in 0.2.1", "projects exactly the CSS it did in 0.2.1", plan and request ids) moves to `CHANGELOG.md` or `docs/compatibility.md`; decision-log citations stay.
      - `plans/evidence/026-spec-restructure.md` maps every normative sentence of the 0.2.3 spec to its new location. Nothing normative is dropped or changed in meaning; any sentence found ambiguous is listed as a finding for the owner, not silently reworded.
      - A new `docs-spec-structure.test.ts` fails when a spec paragraph exceeds 160 words or a sentence matches `/\b0\.[12]\.\d\b/` outside quoted decision references.
    - Performance: n/a — documentation.
    - Code Quality: no code change; tests that quote spec text (`*-guide.test.ts`) are updated to the new wording in the same task.
    - Security: the four laws (§2) stay verbatim.
    - Compatibility: no meaning change, so no register entry.
  - Approach:
    - Skills to Use:
      - `karpathy-guidelines` — surgical, no meaning drift.
      - `liveframe-execution` — the spec is the authority; a meaning change needs a decision.
    - Library Documentation to Check Before Implementation:
      - none; read `docs/spec.md` in full and `src/__tests__/docs-links.test.ts`, `docs-wording.test.ts`.
    - Documentation Reviewed:
      - `docs/spec.md` (901 lines; §7.5 and §13 have single paragraphs over 500 words).
    - Options Considered:
      - Split the spec into several files. Rejected: breaks every `spec.md#…` link in docs, decision logs and the published package.
      - Defer to after the feature plans. Rejected: plans 027–031 would each edit the old structure and the restructure would then touch their fresh text.
    - Chosen Approach:
      - Same file and section numbers, rules-first layout, history moved out, a sentence map as proof.
    - API Notes and Examples:
      ```md
      ### 7.3 Packages
      **Rules**
      1. `pack()` never runs widget code.
      2. An `(id, version)` names exactly one hash.
      …
      **Rationale** …
      ```
    - Files to Create/Edit:
      - `docs/spec.md`; `CHANGELOG.md`; `docs/compatibility.md`
      - `plans/evidence/026-spec-restructure.md`
      - `src/__tests__/docs-spec-structure.test.ts`; guide tests that quote moved text (tentative: found by running `bun run test` after the edit)
      - `roadmap.md` §3: update this plan's execution status.
  - Test Cases to Write:
    - `spec_paragraphs_stay_short`: fails on a paragraph over 160 words.
    - `spec_carries_no_release_history`: fails on a bare `0.2.x` reference outside a decision citation.
    - Existing `docs-links` passes unchanged: proves file/archive paths resolve; the heading test below proves anchors survived.
    - `spec_sections_open_with_numbered_rules`: every numbered section/subsection starts with rules and includes rationale.
    - `spec_preserves_section_anchors_and_the_four_laws`: pin all heading text and the four verbatim laws. The existing `docs-links` test checks file/archive paths, not fragment targets.
    - `spec_structure_checks_detect_long_prose_and_release_history`: regression fixtures prove overlong paragraphs and bare release references fail, while fenced examples and quoted decision references remain allowed.
  - Notes (executed 2026-11-05):
    - Reorganized the same spec file into a normative core (§1–§5), feature contracts (§6–§11) and supporting proof/distribution/boundary sections (§12–§15). All 26 section/subsection headings, all 16 fenced examples/diagrams and the four laws remain verbatim. Each section opens with numbered rules and separates contract details from rationale.
    - Split long prose into paragraphs of at most 120 words. Moved release comparisons, request/plan identifiers, provenance and the detailed Phase 0 proof history into `docs/compatibility.md`; retained the normative performance budgets and decision citations in the spec. Added the documentation change to the changelog. No runtime, public API, format or normative meaning changed; no register entry is needed.
    - `plans/evidence/026-spec-restructure.md` maps all 1,268 baseline prose/table/code units from the byte-identical `v0.2.3` spec, including 964 prose sentences/lead-ins. It records 1,252 exact normalized matches and annotates all 16 editorial replacements; complete heading and fenced-block arrays were also compared. Existing ambiguities about package immutability and the runner prose/interface's `maxErrors` mismatch are listed for the owner without reinterpretation. Task 3 already owns the freezing change; the later runner work can resolve the interface mismatch.
    - Wrote the structure checks first: the original spec reproduced paragraph-length, release-history and rules-first failures. Added regression fixtures plus explicit heading/law preservation tests. The existing docs-links test checks file/archive paths, so it alone did not prove fragment preservation; its implementation is unchanged. No guide test quotes the moved spec text, so no guide-test edits were needed.
    - Focused structure, link and wording checks passed (8 tests). `timeout 900s bun run check` passed: build, generated-file checks, typecheck, lint, formatting, 1,075 passing tests, 4 existing skips and 0 failures (433.73 s for the test suite). `git diff --check` passed. Dedicated benchmarks were not run: this task changes documentation and its regression tests only.

- [x] Task 3: Freeze packages and keep caller ownership of render inputs (Q4: R4, R5)
  - Acceptance Criteria:
    - Functional:
      - `pack()` (`src/pack/pack.ts:8-38`) and `verifyPackage()` (`src/pack/verify.ts:50`) return packages frozen at every depth, including `manifest`, `scenarios` and nested JSON. `outcomeScenarios()` returns frozen scenarios. Writing to any field throws in strict mode.
      - `render()` (`src/sdk/render.ts:55-61`) no longer calls `freezeDeep` (`:341-346`) on caller objects. It gives the widget frozen inputs by freezing a structural copy made during the existing input check (`checkInputs`, `:348`), so the walk stays single-pass. Caller objects are untouched afterwards. `renderElements` and `renderModule` follow.
      - The reference runners' hash cache (`src/preview/cache.ts:16`) keys on frozen packages; the top-level field snapshot added in 0.2.3 is removed because a frozen package cannot change.
      - Register entries (`changed`) for `pack`, `verifyPackage` and `render`, each pointing at a migration heading; the two migration entries from `docs/compatibility.md` § "Deferred to 0.3.0" move into `docs/migration-0.3.md`.
    - Performance: `bun run bench` render benches stay within 3 µs/node; the copy is measured in the task notes against the 0.2.3 interleaved A/B harness (plan 024 Task 1), and must cost ≤ 5% of render on the agent-home tree.
    - Code Quality: one `freezeCopy` helper in `src/internal.ts` (or the existing JSON walk), no second traversal.
    - Security: law 2 and the package-integrity contract — a verified package can no longer be mutated into an unverified one; nested mutation is impossible rather than undetected.
    - Compatibility: breaking for hosts that write to package fields or rely on `render()` freezing their objects; migration entries cover both.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`; `safe-refactor` — removing the snapshot cache path.
    - Library Documentation to Check Before Implementation:
      - none; read `src/sdk/render.ts:157-214,341-373`, `src/preview/cache.ts`.
    - Documentation Reviewed:
      - `docs/compatibility.md` § "Deferred to 0.3.0" (R4, R5 entries); `docs/security.md` item 3; spec §7.2, §7.3, §7.5.
    - Options Considered:
      - Freeze only the top level. Rejected: R4 is about nested mutation.
      - Copy inputs in a separate pass. Rejected: the input check already walks every value.
    - Chosen Approach:
      - Freeze owned package copies at the end of `pack`/`verifyPackage`; build frozen input copies inside the existing input walk. Reuse checked copies only for inputs proven deeply frozen in that walk, under the same schema. Mutable inputs are always rechecked.
      - Behaviour-only `changed` entries name an existing regression test in `behavior: { file, test }` plus the migration heading. Ordinary unchanged declarations, schemas and vectors still reject stale entries. Full checks execute the evidence tests.
    - API Notes and Examples:
      ```ts
      const pkg = value(pack(draft, install));
      Object.isFrozen(pkg.manifest.params); // true
      const inputs = { params, state, data, context };
      render(Widget, inputs, options);
      Object.isFrozen(inputs.state); // false
      ```
    - Files to Create/Edit:
      - `src/pack/pack.ts`; `src/pack/verify.ts`; `src/pack/outcome.ts`
      - `src/sdk/render.ts`; `src/sdk/elements.ts`; `src/runner-kit/render.ts`
      - `src/preview/cache.ts`; `src/internal.ts`
      - `docs/spec.md` §7.2/§7.3/§7.5; `docs/packages.md`; `docs/sdk.md`; `docs/security.md`; `docs/compatibility.md`; `docs/migration-0.3.md`; `CHANGELOG.md`
      - `scripts/release/api/register-0.3.0.json`
  - Test Cases to Write:
    - `packed_package_is_deeply_frozen`: fails if any nested manifest or scenario value is writable.
    - `verified_package_is_deeply_frozen`.
    - `render_leaves_caller_inputs_unfrozen`: fails if `render` freezes the host's objects.
    - `widget_still_receives_frozen_inputs`: a widget that writes to `state` throws `render-failed`.
    - `nested_package_mutation_cannot_reach_a_runner`: replaces the 0.2.3 snapshot test.
  - Notes (executed 2026-11-05):
    - `pack`, `verifyPackage` and `outcomeScenarios` return owned deeply frozen copies without freezing their input documents. SDK rendering copies and freezes the four input fields during its existing JSON check, then freezes the widget envelope. `renderModule` delegates to this path; `renderElements` has no caller widget inputs and keeps its prepared-element path.
    - Removed the runner cache's shallow snapshots. Only packages proven deeply frozen may reuse a hash check; mutable transport packages are rehashed. Tests cover package ownership, nested freezing, strict-mode mutation, mutable input rechecking, shallow-frozen input ownership, schema changes and cached frozen-package integrity. Frozen accessors are excluded from both caches because their returned values can change.
    - Registered all four behaviour-only breaks with migration headings and regression test evidence. The comparator still rejects stale declaration changes without evidence, missing evidence tests and unchanged schema/vector entries. Updated spec, SDK/package/security/compatibility guides and changelog.
    - Performance finding: copying mutable data every render is observable (the initial agent-home paired ratio was 1.171); a five-node view can still carry a large resolved data set. Deeply frozen host inputs can safely reuse checked copies; mutable data cannot. Benchmark fixtures now explicitly freeze owned source inputs before timing, matching the documented state-only rerender usage without freezing caller data inside rendering. The first measured copy still occurs before reuse.
    - Regenerate the interleaved 0.2.3 A/B comparison with `timeout 120s bun --conditions liveframe:source plans/evidence/026-render-ownership.ts`. It materializes and cleans up the baseline module, asserts identical trees, alternates order for 21 rounds and reports paired medians. Final run: baseline 1.6426 ms, current 1.6616 ms, paired ratio 1.0134 (1.3%, within 5%). The separate render bench passed every workload below 3 µs/node: agent-home 2.154, core-queue.small 1.976; agent-home element rendering 2.537.
    - `bun run bench` was run twice and stopped at the standalone validator timing gate (final agent-home 1.968 µs/node against 1.5; large/full also over). No validator implementation or threshold changed. The render benchmark was therefore run directly with `timeout 180s bun --conditions liveframe:source bench/render.bench.ts`; it passed. These figures do not promise the same cost for mutable data or a quiet-host whole-benchmark pass.


    - Final verification: `timeout 900s bun run check` passed build, generated-file checks, typecheck, lint, formatting and 1,081 tests (4 existing skips, 0 failures). The fresh full run includes the accessor regressions; an earlier overlapping process was stopped because it had loaded the pre-fix module. Focused runtime, API/migration and spec-structure checks also passed. No format, schema, corpus, hash vector or public declaration changed.

- [x] Task 4: Reject fractions on dimension style props (Q5: R9)
  - Acceptance Criteria:
    - Functional:
      - `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight` reject `fr` values as `invalid-prop` at `/style/<prop>` (responsive values at `/style/<prop>/<breakpoint>`), in the compiled validator and `render()` (with the tree prefix `/root`), `renderElements`, and the published `ui-tree.json` style-value schema, `liveframe gen` types and the CSS projection. Grid `columns`/`rows` fractions are unchanged.
      - A corpus case `ui-tree/dimension-fraction-rejected.json` is added with a register entry naming it.
      - Migration entry "Fractions on dimension props are rejected" with the `grow`/`basis` rewrite.
    - Performance: no measurable change (one branch removed).
    - Code Quality: the fraction branch is removed from the dimension domain, not special-cased.
    - Security: law 3 unaffected; validation tightened.
    - Compatibility: breaking for trees using dimension fractions (which had no effect).
  - Approach:
    - Skills to Use: `surgical-patch`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none; `src/validate/style.ts`, `src/css/` style-prop projection.
    - Documentation Reviewed: spec §6.3 (fractions deprecated); `docs/compatibility.md` § Deferred (R9); plan 023 Task 7 notes.
    - Options Considered: keep accepting and ignore. Rejected: deprecated in 0.2.3 for removal here.
    - Chosen Approach: remove `fr` from the dimension value domain everywhere it is defined.
    - API Notes and Examples:
      ```tsx
      <Box width="2fr" />          // invalid-prop at /style/width
      <Box grow={2} basis={0} />   // replacement
      ```
    - Files to Create/Edit:
      - `src/validate/style.ts`; `src/formats/tree.ts`; `src/formats/tree-patch.ts` (preserve structural patch transport); `src/sdk/gen.ts` (types); `src/css/style-props.ts`
      - `src/__tests__/dimension-fraction.test.ts`; `src/__tests__/sdk-gen-types.test.tsx`; `src/__tests__/css-style-props.test.ts`; `src/__tests__/tree.test.ts`; `src/__tests__/validator-node.test.ts`; `src/__tests__/validator-rules.test.ts`; `src/__tests__/cli-mcp.test.ts`; validator/MCP text snapshots; regenerated SDK fixture and demo-host modules
      - `schemas/ui-tree.json` (regenerated); `conformance/corpus/ui-tree/dimension-fraction-rejected.json` and its document. `catalog.json` only lists style-prop names, so has no dimension value domain to edit.
      - `scripts/release/api-surface.ts`; `src/__tests__/api-stability.test.ts`: recognize explicit `added` corpus entries, a prerequisite for registering the new case; preserve the existing policy for unregistered additions.
      - `docs/spec.md` §6.3; `docs/styling.md`; `docs/migration-0.3.md`; `CHANGELOG.md`; `register-0.3.0.json`
  - Test Cases to Write:
    - `dimension_fraction_is_invalid_prop` (each of the six props, plain and responsive).
    - `grid_track_fractions_still_valid`.
    - `generated_types_reject_fraction_dimensions` (type-level).
  - Notes (executed 2026-11-05):
    - Removed fractions from the compiled dimension domain and generated `_Dimension` union. CSS fraction projection now belongs only to grid tracks. All six dimension props reject plain and responsive fractions; compiled validation and `render()` retain their existing `/root/style/…` tree pointers, while `renderElements` reports `/style/…` source pointers.
    - Tightened the published UI-tree transport schema for numeric fraction strings, including responsive maps, without rejecting token names such as `size.fr`. Preserved the existing JSON-only guard for all style values, including known dimension properties; a regression test covers functions and undefined values in both scalar and responsive positions. `catalog.json` only declares style-prop names and has no dimension-value schema, so it remains byte-identical. Kept patch transport shape-only (and its published schema byte-identical); `applyPatch` still validates the resulting tree against the installation.
    - Added the rejected-fraction corpus case and document, migration with flex/grid rewrites, changelog and spec/styling/compatibility updates. Registered the schema and behavior breaks; the existing render entry records both Tasks 3 and 4. The comparator now recognizes explicit `added` entries for new corpus/vector files, while preserving its existing policy for unregistered additions; its regression test reproduced the stale-entry failure first.
    - Added regression coverage for all six props, zero/integer/decimal fractions, base and breakpoint failures across compiled validation, rendering, element rendering, CSS projection and the published schema. A targeted regression also preserves CSS projection of tokens ending in `fr` by resolving token references before formatting numeric tracks. Positive coverage preserves grid fractions, declared lengths, fill/fit and bounded ch/percent values. Type-level failures cover all six generated dimensions. Updated the accepted-value fixture, validator expected-text snapshot and MCP generated-types snapshot; regenerated SDK fixture and demo-host types.
    - Tests were written first: dimension fractions were accepted and all six type-level rejection assertions were unused. After implementation, the focused runtime/corpus/migration/API suites passed, and all seven failures from the first full test run passed in a focused rerun (9 tests including the two new runtime tests). That full run exposed three stale contract expectations, now updated, plus four transient proof-host failures during a load-average spike around 39, including 100 ms render-limit failures. No timing limit or test assertion was weakened.
    - Before the final full check, 54 focused tests across the validator, tree/patch schemas, format differentials, corpus, API gate and CSS projection passed. The second complete run had only the known CSS switch timing failure (20.6 ms against 16.67); its first isolated rerun hit 27.4 ms, then both the pre-task commit and corrected checkout passed (6.5 ms and 7.7 ms maxima). Temporary baseline worktree removed. Intermediate runs were stopped to include the token and JSON-guard regressions in a fresh final run; no timing thresholds changed.
    - Final verification: `timeout 900s bun run check` passed build, generated-file checks, typecheck, lint, formatting and 1,086 tests (4 existing skips, 0 failures). The final fresh run includes both preservation regressions. Dedicated benchmarks were not run; no performance budget claim is added.


- [x] Task 5: One realm rule for every public validator entry point (Q8)
  - Acceptance Criteria:
    - Functional:
      - Every public function that takes a document (`validateCatalog`, `validateManifest`, `validateCapabilities`, `validateTheme`, `validateDesignSystem`, `compileValidator`, a compiled validator's `validateTree`, `validateTreePatch`, `applyPatch`, `diffTrees`, `verifyPackage`, `renderModule`) rejects an object created in another realm with the realm message already used by `validateJson` (`src/formats/json.ts:106`), kind `invalid-document` at the offending pointer.
      - `validateTree` no longer reports `invalid-prop` "Expected a plain JSON object" for a foreign-realm tree (`src/validate/tree.ts:196`).
      - A Bun `node:vm` test passes an outer-realm document to each root entry point in `validator.bundle.js` and asserts the realm message; pack, store and runner APIs are tested separately without widening the validator bundle. Include the exported vocabulary, package-shape, scenario and record validators found during the public-entry-point inventory.
      - Migration entry "Foreign-realm documents are rejected everywhere".
    - Performance: realm diagnostic classification runs only after a prototype mismatch in existing walks; no extra accepted-tree pass. Install paths that previously lacked prototype guards scan document values before structural checks. Record install/cache costs and paired tree-validation non-regression (≤ 2%).
    - Code Quality: one shared `realmError` helper used by every entry point.
    - Security: law 2 — accessor-bearing foreign objects can no longer slip into compile-time paths.
    - Compatibility: breaking for hosts passing outer-realm objects to `validateCatalog`/`compileValidator`, which 0.2.3 accepted.
  - Approach:
    - Skills to Use: `liveframe-execution`; `surgical-patch`.
    - Library Documentation to Check Before Implementation: Bun `node:vm` support (test only) via `find-docs`.
    - Documentation Reviewed: backlog "Name the realm mismatch in a compiled validator's `validateTree`"; `src/formats/json.ts:77-110`; `src/__tests__/validator-bundle.test.ts`; Context7 `/oven-sh/bun/bun-v1.4.2` `docs/runtime/nodejs-compat.mdx` (`node:vm` core APIs and ES modules).
    - Options Considered: document which entry points accept foreign objects. Rejected: two rules for one boundary; agents and ports need one.
    - Chosen Approach: reject everywhere with the existing message, preserving existing non-realm diagnostics. Root guards run before reading foreign fields; cache equality rejects foreign nested objects, and tree walks reuse their existing prototype checks. Install scans reuse the JSON walker in realm-only mode. The original zero-cost claim cannot apply to install paths that previously had no prototype guard; measure these and isolate the accepted-tree hot path.
    - API Notes and Examples:
      ```ts
      vmValidator.compileValidator({ catalog: outerRealmCatalog, … });
      // throws LiveframeFailure: "/catalog: Expected a JSON value created in this realm; …"
      ```
    - Files to Create/Edit:
      - `src/internal.ts`; `src/formats/json.ts`; install checkers in `src/formats/{capabilities,catalog,design-system,manifest,package,records,theme,vocabulary}.ts`; `src/validate/{tree,structure,compile,patch}.ts`; `src/runner-kit/render.ts`. `verifyPackage` delegates through the package-shape checker, so its implementation needs no duplicate guard.
      - `src/__tests__/validator-bundle.test.ts`; `plans/evidence/026-validator-realm.{ts,md}`; `docs/spec.md` §10; `docs/migration-0.3.md`; `CHANGELOG.md`; `scripts/release/api/register-0.3.0.json`; `roadmap.md` §3
  - Test Cases to Write:
    - `every_entry_point_names_a_foreign_realm` (table-driven over the list above).
    - `same_realm_documents_unchanged` (corpus passes byte-identically).
  - Notes (executed 2026-11-05):
    - Extracted the existing foreign-plain-object diagnostic into one internal `realmError` helper. Install validators reject before reading foreign document fields; their realm-only scan preserves existing cycle, metadata-budget and other non-realm diagnostics. Compiler root guards label catalog/capabilities/manifest inputs, and structural cache equality prevents a warm hit from accepting nested foreign schema objects.
    - Tree validation reuses the existing prototype guard and reports `invalid-document` at the offending pointer. Its JSON walk uses the same diagnostic; a cold scan of a rejected node prevents an ordinary schema error from hiding the foreign object. Patch/diff guards retain the existing precondition that base/diff inputs are validated immutable trees. Package verification delegates to the package-shape checker, and module rendering preserves typed compile failures.
    - The public-entry-point inventory also found `validateVocabulary`, package-shape/scenario and stored-record validators. They are covered by the same regression matrix; `validateState` and `validateTreePatch` already used the shared JSON check and need no contract/register change. The actual validator bundle is evaluated in Bun's VM; pack/store/runner checks run separately, so no extra exports or dependencies were added.
    - Added the spec rule, migration heading, changelog line and behaviour register entries. Existing entries for `compileValidator` and `verifyPackage` retain their earlier migrations and name this additional break in their reason/task fields, following Task 4's combined-entry precedent. No published schema or corpus bytes changed.
    - Tests were written first and reproduced accepted foreign catalogs and generic nested-object diagnostics. The final focused API/bundle/spec/differential run passed all 39 tests. `timeout 900s bun run check` passed: build, generated-file checks, typecheck, lint, formatting, 1,089 passing tests, 4 existing skips and 0 failures. Refreshed the local graft graph.
    - Performance evidence and regeneration script: `plans/evidence/026-validator-realm.md` and `plans/evidence/026-validator-realm.ts`. The accepted-tree paired ratio is 1.0158 against Task 4 (within 2%). A loaded-host absolute validator run exceeded tree budgets; patch/diff/warm-compile budgets passed. Quiet-host absolute performance is not established. Corrected this task's original zero-cost claim: realm classification remains cold in existing walks, but install paths previously had no uniform prototype guard and now require a scan. No extra accepted-tree pass was added.

- [x] Task 6: Validation limits for preview and authoring sessions (Q7)
  - Acceptance Criteria:
    - Functional:
      - `createPreview({ …, limits? })` and `createAuthoring({ …, limits? })` forward `limits` to the runner and to host validation (`src/preview/session.ts:40-53`, `src/authoring/index.ts:377`). `AuthoringConfig.limits?` reaches `liveframe mcp`. Invalid limits are `invalid-document` at `/limits`.
      - A tree over the default node limit but within a raised limit passes; the same tree without the option fails `limit-exceeded`.
    - Performance: n/a — option plumbing.
    - Code Quality: reuse `RenderLimits`; no new type.
    - Security: law 2 — limits apply on both sides; never looser on the host than requested.
    - Compatibility: `widened` entries for `createPreview`, `AuthoringOptions` and `AuthoringConfig`. `createAuthoring` already takes the named `AuthoringOptions`; its emitted declaration is unchanged, so the widened options type records that addition without a stale function entry.
  - Approach:
    - Skills to Use: `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: backlog "Let `createPreview()` and `createAuthoring()` take validation limits"; spec §7.5, §13.
    - Options Considered: read limits from the runner. Rejected: the runner is untrusted for validation.
    - Chosen Approach: one optional option, validated and snapshotted by the preview constructor, then forwarded to the runner and host validation. Authoring also applies the same limits to its separate outcome-expansion runner path. The MCP adapter already spreads config into `createAuthoring` and handles `LiveframeFailure` with exit 2, so no duplicate CLI validation is needed.
    - API Notes and Examples:
      ```ts
      createPreview({ catalog, capabilities, runner, limits: { nodes: 20_000 } });
      ```
    - Files to Create/Edit: `src/preview/session.ts`; `src/authoring/index.ts`; `src/preview/authoring.ts`; `src/__tests__/session-limits.test.ts`; `src/__tests__/cli-mcp.test.ts`; `src/__tests__/fixtures/mcp-limits.config.ts`; `docs/preview.md`; `docs/mcp.md`; `docs/spec.md` §7.5/§13; `CHANGELOG.md`; `scripts/release/api/register-0.3.0.json`; `roadmap.md` §3. The existing `src/cli/mcp.ts` config forwarding/error handling is exercised unchanged.
  - Test Cases to Write:
    - `session_limits_raise_host_validation`; `session_limits_invalid_document`; `mcp_config_limits_forwarded`; `mcp_config_limits_invalid_document`; `session_limits_bound_untrusted_runner_nodes_depth_and_bytes`; `session_limits_are_owned_frozen_snapshots`.
  - Notes (executed 2026-11-05):
    - Added optional `RenderLimits` to preview sessions, `AuthoringOptions` and `AuthoringConfig`. The preview constructor rejects malformed limits, unknown fields and non-positive/non-safe-integer values with `LiveframeFailure`, kind `invalid-document` at `/limits`. Limits are owned frozen snapshots; caller changes and runner writes cannot loosen subsequent host checks.
    - Forwarded limits to every runner call and host `validateTree`, including scenario checks, intent re-renders, the bound preview and authoring's separate outcome-expansion path. The existing MCP config spread and typed-construction-error handler already provide forwarding and exit 2; no duplicate CLI validation or new public type was added.
    - A 5,001-node real widget proves a raised limit passes host validation while the default fails. Independent custom-runner tests cover node, depth and byte refusals; runner-option assertions and snapshot tests cover forwarding and ownership. MCP tests exercise strict configured limits and invalid config through stdio/CLI.
    - Updated spec §7.5/§13, preview/MCP guides, compatible adopter notes and changelog. Registered `createPreview`, `AuthoringOptions` and `AuthoringConfig` as widened. The API gate rejected the originally proposed `createAuthoring` entry because its declaration still takes the same named options type; registering `AuthoringOptions` covers that widening without a fake declaration edit or weakening the gate. No format, schema or corpus bytes changed.
    - Tests were written first and reproduced missing runner forwarding, absent host bounds and accepted invalid limits. The focused limits/API/migration run passed 20 tests; the focused MCP config run passed both tests. The first full check was stopped after an existing preview-capture test exceeded its unchanged 100 ms render deadline; no timing threshold or assertion was changed. Dedicated benchmarks were not run: this task only plumbs validation options. Authoring's 256 KiB single-tree response bound and capture limits are unchanged.
    - Final verification: `timeout 900s bun run check` passed build, generated-file checks, typecheck, lint, formatting and all 1,095 tests (4 existing skips, 0 failures), including all six new limits tests and the API gate.

- [x] Task 7: Opt-in verified-package cache for `loadPlacement` (Q6: R15)
  - Acceptance Criteria:
    - Functional:
      - `/store` exports `verifiedPackages({ max? })` returning a host-owned cache object. `loadPlacement(store, id, install, { scope?, state?, verified? })` (`src/store/load.ts:34-99`) uses it to skip re-verifying a package whose canonical content hash and installation documents (catalog and capabilities canonical JSON) match an entry. The key is `(packageHash(stored record), catalogKey, capabilitiesKey)`, never `(id, version)`.
      - Placement, params and state checks still run on every load. A changed record, a hash mismatch, a corrupt record or changed install documents miss the cache. LRU bound, default 256.
      - The spec and `docs/packages.md` state ownership: the cache holds frozen packages (Task 3) and is safe to share across stores of one installation.
    - Performance: a bench `loadPlacement` × 100 placements over one package shows ≥ 5× fewer full package verifications with the cache; record hash computations separately. Fresh hashing on every load is mandatory below, so fewer hashes is not a valid target (100 uncached versus 101 cached, including the initial verification).
    - Code Quality: the cache is a plain object with `get`/`set`; no global state.
    - Security: law 2 and the store-is-untrusted rule (§7.4) hold — the stored record is always re-hashed; only verification of the manifest/scenarios/code against the install documents is reused.
    - Compatibility: `added` for `verifiedPackages`, `widened` for `loadPlacement`.
  - Approach:
    - Skills to Use: `liveframe-execution`; `lean-build`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `docs/compatibility.md` § Deferred (R15); backlog entry; `src/store/load.ts`; `src/pack/hash.ts`.
    - Options Considered: trust `(id, version)`. Rejected by the deferral text. A global cache. Rejected: host-owned lifetimes.
    - Chosen Approach: content- and install-keyed opt-in cache. A private store helper owns shape checks, fresh hashing and cache lookup; `loadPlacement` retains identity, params and state checks.
    - API Notes and Examples:
      ```ts
      const verified = verifiedPackages();
      await loadPlacement(store, id, install, { scope, verified });
      ```
    - Files to Create/Edit: `src/store/load.ts`; `src/store/verified.ts`; `src/store/index.ts`; `src/__tests__/store-load.test.ts`; `src/__tests__/exports.test.ts`; `bench/store-load.bench.ts`; `docs/packages.md`; `docs/spec.md` §7.4; `docs/compatibility.md`; `docs/migration-0.3.md` (the deferred entry is resolved); `CHANGELOG.md`; `scripts/release/api/register-0.3.0.json`; `roadmap.md` §3
  - Test Cases to Write:
    - `cache_hit_skips_reverification_but_checks_state`; `changed_record_misses_cache_and_corrupt_record_still_fails`; `changed_install_documents_miss_cache`; `invalid_state_still_resets_with_cache`; `verified_packages_lru_bound_and_invalid_max`.
  - Notes (executed 2026-11-05):
    - Added `/store`'s `verifiedPackages({ max? })`, a host-owned plain `get`/`set` LRU with a 256-entry default and typed `/max` construction errors for non-positive/non-safe-integer bounds. `loadPlacement` accepts optional `{ verified }`; existing calls retain full verification. No global cache or dependency was added.
    - Cache lookups first validate the stored package shape and freshly compute its content hash, comparing it with the declared hash. Keys include the computed hash and canonical catalog/capabilities JSON. Hits reuse the verified frozen package across stores; installation mutations, changed content, corrupt records and bad declared hashes cannot reuse old verification. Placement identity, params and scoped/explicit state checks remain on every load; resets remain reported and unwritten.
    - Tests were written first and failed on the absent export. Five added tests cover cache identity reuse (including reordered installation object keys and another store), unchanged default behaviour, invalid params/placement identity, changed and rehashed content, rehashed forbidden imports, corrupt shapes, changed capabilities/catalog content, state resets, LRU recency/eviction/default bound and invalid bounds. The final focused store/export/API/spec/migration run passed 52 tests; final test additions also passed typecheck.
    - Updated spec §7.4, package guide, compatible adopter notes, compatibility deferral, changelog, runtime export pin and API register (`verifiedPackages`: added; `loadPlacement`: widened). Direct cache writes are trusted host operations and accept only verified frozen packages. No format, schema or corpus bytes changed.
    - Corrected the contradictory performance criterion before completing implementation: always re-hashing 100 untrusted reads cannot yield five times fewer hash computations. The standalone `timeout 60s bun --conditions liveframe:source bench/store-load.bench.ts` asserts one verification for 100 placements (100× fewer full verifications), and reports path-derived hash counts separately: 100 uncached, 101 cached (100 fresh reads plus the initial full verification). Its cache-write count and package-identity assertions prove reuse; hash counts follow the implementation path rather than an instrumented hash hook. Small-package timings can be slower with caching because structural checks and canonical installation keys still run; no elapsed-time speedup is claimed.
    - First full check passed build, generated checks, typecheck, lint and formatting, then finished with 1,099 passing tests, 4 existing skips and one unchanged timing failure: `render_all_matches_session_check` exceeded its existing 100 ms runner deadline on the ready scenario. Its isolated rerun passed (one test, 406 ms total). No deadline, assertion or unrelated implementation was changed. The full-check retry passed, including that test (328 ms total).
    - Final verification: `timeout 900s bun run check` passed build, generated-file checks, typecheck, lint, formatting and all 1,100 tests (4 existing skips, 0 failures). The final standalone benchmark ran after the full check, at load averages 7.68 / 5.99 / 5.27: 100 uncached verifications and hashes in 32.69 ms; one cached verification and 101 hashes in 51.36 ms. This is a small-fixture, single-run observation, not a calibrated speedup claim. Full `bun run bench` was not run; Task 10 owns the whole-plan performance sweep.

- [ ] Task 8: Keep focus by default in `<Surface>` (Q10)
  - Acceptance Criteria:
    - Functional:
      - `focusContinuity` defaults to `true` (`src/react/renderer.tsx:60,414,497`). `focusContinuity={false}` restores 0.2.3 behaviour exactly: no snapshot, no attribute, no listener, no `tabIndex`.
      - Every renderer browser and conformance test passes in both modes.
      - Migration entry "Surfaces keep focus by default".
    - Performance: the 0.2.2 focus-continuity measurement is repeated on the selection bench and recorded; non-regression of span A and arrival budgets.
    - Code Quality: one default changed; no new prop.
    - Security: n/a for the laws; moving focus emits no intent (existing test).
    - Compatibility: `changed` for `SurfaceProps` default behaviour (observable).
  - Approach:
    - Skills to Use: `liveframe-execution`.
    - Library Documentation to Check Before Implementation: React 19 `getSnapshotBeforeUpdate` via `find-docs` (unchanged usage).
    - Documentation Reviewed: decision 2026-11-01-1747 (opt-in rule); spec §11; `docs/renderer.md`.
    - Options Considered: keep opt-in. Rejected: focus falling to `<body>` is an accessibility failure by default.
    - Chosen Approach: default on with opt-out. Task 1 finding: changing a default alone may leave `SurfaceProps` declarations identical. Reconcile the behaviour-only register representation with the default-on/opt-out tests in this task before adding its entry; retain the comparator's stale-declaration rejection.
    - API Notes and Examples:
      ```tsx
      <Surface … />                         // keeps focus
      <Surface focusContinuity={false} … /> // 0.2.3 behaviour
      ```
    - Files to Create/Edit: `src/react/renderer.tsx`; `src/conformance/react/` cases; `docs/renderer.md`; `docs/spec.md` §11; `docs/migration-0.3.md`; `CHANGELOG.md`; `register-0.3.0.json`
  - Test Cases to Write:
    - `focus_continuity_on_by_default`; `focus_continuity_false_adds_nothing` (no attribute, no tabIndex).
  - Notes (executed <date>):

- [ ] Task 9: Derive structural checkers and published JSON Schemas from one source (Q9: R24)
  - Acceptance Criteria:
    - Functional:
      - Each format in `src/formats/registry.ts` is defined once, as a schema-language value plus named install-time relationship checks. The structural checker is compiled from it (the compiled schema machinery in `src/validate/schema.ts`), and `scripts/schemas.ts` emits `schemas/*.json` from the same value.
      - Published schemas are byte-identical to 0.2.3 unless a register entry says otherwise; `format-schema-differential.test.ts` keeps running as a regression guard.
      - Install-time relationships (catalog references, recipe completeness, contrast) remain separate code, named as such.
    - Performance: validator and install benches non-regression (≤ 2% via the A/B harness).
    - Code Quality: removes the hand-written duplicate per format; net deletion recorded in notes.
    - Security: law 2 — one source means a checker cannot be looser than its schema.
    - Compatibility: no declaration change expected; any schema byte change gets a register entry.
  - Approach:
    - Skills to Use: `safe-refactor`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation: JSON Schema 2020-12 (the published dialect) via `find-docs` if any keyword mapping is unclear.
    - Documentation Reviewed: backlog "Derive format checkers and published JSON Schemas from one source"; `src/formats/registry.ts`; `scripts/schemas.ts`; plan 025 Task 6 notes.
    - Options Considered: generate checkers from JSON Schema with a library (ajv). Rejected: new runtime dependency and `Function` constructor use (spec §10 forbids).
    - Chosen Approach: the schema language is already the single source for widget data; use it for formats too.
    - API Notes and Examples:
      ```ts
      export const placementFormat = defineFormat("placement", obj({ id: str({ maxLength: 128 }), … }), [relationshipChecks…]);
      ```
    - Files to Create/Edit: `src/formats/*.ts` (each format); `src/formats/registry.ts`; `scripts/schemas.ts`; `src/__tests__/format-schema-differential.test.ts`
  - Test Cases to Write:
    - `published_schemas_byte_identical_to_0_2_3` (unless registered).
    - Existing corpus and differential suites pass unchanged.
  - Notes (executed <date>):

- [ ] Task 10: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: sweep the twelve impact areas (`.agents/skills/create-plan/references/liveframe.md` §5) against Tasks 1–9 in `plans/evidence/026-impact-analysis.md`; present findings with recommended dispositions; execute or backlog each, recording the owner's answer.
    - Performance: `bun run bench` once, sequentially, with machine load recorded; no new budget claims.
    - Code Quality: findings are specific and cite `file:line`.
    - Security: the four laws reviewed explicitly.
  - Approach:
    - Skills to Use: `create-plan` (impact areas); `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: this plan's notes; `plans/evidence/025-impact-analysis.md`.
    - Options Considered: n/a.
    - Chosen Approach: the standard final task.
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `plans/evidence/026-impact-analysis.md`; `plans/backlog.md`; this plan's Further Actions.
  - Test Cases to Write: n/a — review task; `bun run check` green.
  - Notes (executed <date>):

## Verification (whole plan)

- `timeout 900 bun run check`
- `timeout 900 bun run bench` (sequential, load recorded)
- `bun scripts/release/api-surface.ts --compare scripts/release/api/0.2.3.json --register scripts/release/api/register-0.3.0.json` (or the test that wraps it)
- `git diff --stat v0.2.3 -- schemas conformance` — every change has a register entry

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
