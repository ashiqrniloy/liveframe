# Plan 004 — architectural impact analysis

Reviewed 2026-10-22 against delivered Tasks 1–6, `docs/spec.md` §6.3, §7.2, §8–§10 and §13, the approved Phase 1 scope and render-budget decisions, and all twelve areas in `.agents/skills/create-plan/references/liveframe.md` §5. The equal-work benchmark follows `decision-logs/2026-10-22-2226-validator-equal-work-benchmark.md`.

## Impact areas

1. **Spec.** `src/validate/compile.ts:19–29` validates install documents before compiling closures; `src/validate/tree.ts:21–266` implements §10's whole-tree boundary. `validator-rules.test.ts` covers all seven §10 bullets through a 50-row matrix and fails when a bullet lacks coverage. Intent compatibility follows §8–§9, including omitted bound arguments. The existing compile-time throw convention is documented separately from `validateTree`'s `Result`. None — this task requires no new spec meaning or architecture decision. The proof-only track discrepancy is recorded under **F5**, without widening §6.3.

2. **Public API and formats.** The root exports `compileValidator`, `CompileValidatorOptions`, `CompiledValidator`, `NodeCheck`, `NodeCheckSink` and `ValidateTreeOptions` alongside existing formats and errors. `root_export_surface` fixes the runtime export list; `public_validator_types_support_error_guided_repairs` imports the types through the package root and validates an error-guided repair. `package.json` still exposes only `.` and `./schemas/*`; `liveframe/1`, the seven published schemas and runtime dependencies are unchanged. None — no export, schema or version correction is needed. The existing Phase 6 package-fixture exclusion remains necessary; it is already backlogged and is not duplicated here.

3. **The four laws.** The new path validates data and never dispatches an operation:
   - Law 1: compilation builds closures, never evaluates widget code. `src_is_host_api_free` scans the new core files, forbids dynamic evaluation/imports and bundles the root for browsers. No loader or widget execution path was added.
   - Law 2: `node_rejects_undeclared_parts`, `metadata_is_closed_and_validated`, `identity_rules`, `children_and_terms_rules`, `limits_fail_closed` and `non_json_and_cycles_are_rejected_without_throwing` reject malformed trees, undeclared data, bad key paths, forbidden children, exhausted budgets and non-JSON/cyclic payloads. `errors_are_collected_and_bounded` proves termination at the configured error bound.
   - Law 3: `style_values_follow_vocabulary`, `style_table_covers_every_fixed_prop_and_bounds` and the rule matrix reject raw CSS-like values, undeclared design values, invalid responsive maps and colour outside declared roles. `src/validate/style.ts:14–119` checks names against the installed vocabulary; it does not project CSS or introduce theme values.
   - Law 4: `src/validate/intent.ts:11–81` restricts actions to the manifest and validates their args against capability schemas. A `bind` must name a declared argument of the event's carried type, must be absent from literal `args`, and exempts only that argument from the render-time required set. Other required fields and all supplied values still pass compiled checks. `action_args_match_capability`, `bind_rules`, `boolean_and_optional_bound_values` and `set_state_value_matches_schema` cover these boundaries. `docs/formats.md` explicitly requires the host to fill the bound value, re-check completed arguments and authorise on dispatch. A carried type alone does not prove an event value meets enum, length or pattern bounds.

   The same `validateTree` is available for backend output and arrival re-checks; `docs/formats.md` requires both. Production transport wiring remains Phase 4 and is not proved by the historical proof renderer. None — no new law violation found in the delivered validator; validation grants no authority.

4. **Validation.** Catalog, capabilities and manifest enter as unknown values and are install-validated before compilation; invalid installs preserve the existing errors in the thrown message (`install_documents_are_validated_before_compilation`, `install_failures_preserve_part_a_errors`). Whole-tree validation returns bounded `LiveframeError`s with kinds, node ids, escaped JSON Pointers and repair instructions. `invalid_options_fail_closed`, `byte_count_equals_stringify`, `string_bytes_respects_remaining_budget` and `validation_does_not_serialise` cover limits and exact UTF-8 accounting, including every UTF-16 code unit and lone surrogates. `checkNode` is deliberately a builder check: whole-tree identity, children counts, metadata and budgets remain the builder's responsibility or require `validateTree`. Successful validation returns the original unfrozen tree; callers must validate the value they actually send/use. None — these limits are documented and tested; adding a freeze or an SDK here would duplicate later work.

5. **Styling.** Compiled style checks cover every library-fixed style prop using a compile-time exhaustive table and app-declared vocabulary names. Theme install validation, recipe completeness and CSS projection remain separate existing boundaries. None — no recipe or theme change is required. **F5** records the already-known proof grid-track extension so later integration cannot mistake benchmark conversion for visual parity.

6. **Interaction tiers.** Per-node validation now enforces one declared intent per event, state-key/value compatibility, manifest action membership, args and `bind` compatibility. Local primitive behaviour, state persistence, value filling, stale-revision handling and actual dispatch are still owned by the SDK, renderer and host. The §8 rules and worked guide describe those responsibilities. **F3** updates G20's split: validator strings count code points now; editing/commit enforcement in the production text field remains Phase 4. None — no dispatcher, primitive or state store belongs in this task.

7. **Performance.** The whole-plan benchmark passed all eight absolute gates and the approved equal-work relative gate; see the measured table below. Agent-home full validation costs 1.231 µs/node, and compiled props checking is 15.83× faster than `checkValue` on the identical props-only walk. Full validation does more work and is not claimed faster than props-only interpretation. **F2** updates the existing P1 performance handoff: Phase 2 Part A retains ≤3 µs/node total, allocating ≤1.5 µs/node each to validation and remaining render work. The measured agent-home result leaves 1.769 µs/node of observed headroom; it does not prove integrated SDK throughput. Build-time check reuse, incremental byte counting and proof-sized end-to-end workloads still require Phase 2 evidence.

8. **Portability.** `src_is_host_api_free` covers all non-test `src/` files, checks relative-only imports and absence of proof imports/host globals/dynamic evaluation, and builds the public root for a browser target. Bun 1.4.2 runs the tests and benchmark; no runtime dependency was added. None — no host API entered the core. Browser bundling is not a separate browser-runtime validator benchmark, and other server runtimes were not executed.

9. **Agent authoring.** `expected_text_is_actionable` checks every matrix failure for a concrete repair hint, and `each_row_fails_as_specified` fixes its kind/id/pointer. `compiled_matches_interpreter` exercises 2,000 seeded cases; `patterns_compile_once` catches per-call regex construction. The public repair test demonstrates a rejected numeric label becoming an accepted string. None — generated JSX types, authoring helpers and builder-only `WidgetError`s remain Phase 2, with no new code generation surface here.

10. **Docs and examples.** Task 6's Validation guide documents compile/recompile lifecycle, install throws versus tree results, defaults, bounded errors, per-node limitations, backend/arrival re-checks and dispatch authorisation. The README describes the shipped API. **F1** corrects the execution router and architecture reference, which still called the compiled validator future work. Skill validation also exposed an existing unquoted colon in the router's YAML description; a folded scalar preserves its wording and makes the metadata parseable. The formats reference already describes the delivered API and needs no further edit.

11. **Conformance.** `/conformance` remains Phase 5. The new schema, node, tree, rule-matrix and export/repair tests provide reusable cases for the future shared suites, while the benchmark remains an internal measurement gate. **F4** extends the existing P3 conformance backlog entry with these cases and the remaining arrival/dispatch integration checks; no new kit or test abstraction is introduced.

12. **Reference hosts.** All four proof UIs are represented by valid transport/performance fixtures; the eight benchmark workloads retain their expected node counts. No adopter-specific primitive or library behaviour was added. **F5** makes the explicit `fit` → `0fr` benchmark conversion a P2 integration handoff: the approved proof UI was not changed and no visual equivalence is claimed. Existing Synapta/Clay adoption gaps remain in their own backlog entry. G20's renderer half remains open under **F3**; no production host migration is claimed.

## Findings and dispositions

The owner requested: “Complete … Task 7: Analyze architectural impact and dispose of every finding … and update the plan once done.” This authorises the named documentation/backlog maintenance and handoff to existing phase owners. The following table was presented during execution; the owner did not separately review each row. These are maintenance dispositions under that request, not newly approved architecture decisions. No decision log was created.

| # | Finding and evidence | Area | Disposition | Owner's answer / execution record |
| --- | --- | --- | --- | --- |
| F1 | Execution router and architecture “Today” still call the shipped compiled validator future work; the router description also has invalid YAML. | 2, 10 | execute | Covered by the completion request. Corrected `.agents/skills/liveframe-execution/SKILL.md` and `references/architecture.md` within Task 7's documentation maintenance scope, including YAML scalar formatting without changing the description's meaning. |
| F2 | “Phase 1 performance gate” lacks the measured validator result and remaining Phase 2 share; its unchanged proof scripts cannot measure the new SDK. | 7 | execute | Task 7 explicitly requires this update. Recorded all-fixture success, agent-home timing, equal-work speed-up and the ≤1.5 + ≤1.5 µs/node allocation in `plans/backlog.md`; end-to-end proof remains Phase 2 Part A. |
| F3 | “Later-phase gaps” does not record the completed validator half of G20. | 6, 12 | execute | Task 7 explicitly requires this update. Recorded code-point validation and its tests, retaining text-field editing/commit enforcement for Phase 4. |
| F4 | Existing Phase 5 conformance handoff omits compiled-validator cases and the public repair contract. | 11 | backlog (P3) | Covered by the completion request. Expanded “Seed conformance suites from the proof tests” with plan 004 as a source and the new cases; no duplicate entry or suite. |
| F5 | Task 3's exporter substitutes `0fr` for proof-only `fit` grid tracks; throughput fixtures do not prove visual equivalence. | 1, 5, 12 | backlog (P2) | Covered by the completion request. Added “Reconcile proof grid tracks before SDK and CSS integration” for Phase 2 Part A/Phase 3. Preserve §6.3; a new format decision would require separate owner approval. |

All five findings are disposed. F1–F3 are documentation corrections inside this task; no runtime implementation task was needed above it. F4/F5 appear in Further Actions and `plans/backlog.md`. Plan 002 Task 9's pre-existing owner gate remains open; completing plan 004 does not approve it.

## Verification

- `timeout 300s bun run check`: passed; typecheck, lint, format and **178 tests across 33 files**, 0 failures. Existing non-fatal proof lint warnings remain.
- `timeout 60s bun scripts/schemas.ts --check`: passed; the seven published schemas match their sources.
- A Bun assertion check parses the execution skill's frontmatter with `Bun.YAML.parse`, verifies its name/description and size, and confirms the existing agent metadata still describes the same execution workflow. No Python runner was introduced for this factual skill update.
- `timeout 120s bun bench/validator.bench.ts`: passed; **all eight fixtures ≤1.5 µs/node**, agent-home equal-work props speed-up **15.83×**, exceeding 2×. Machine: AMD Ryzen 9 PRO 7940HS, 16 logical CPUs, Linux 7.2.7-1-cachyos, Bun 1.4.2. Load average (1/5/15 min): **2.33/5.23/3.73** at start, **2.22/5.16/3.72** at end. 200 warm-ups and 1,000 runs per implementation; install/compilation excluded. The full check ran concurrently with this benchmark; all gates still passed.

| Fixture | Nodes | Full validation (ms) | µs/node | Interpreted props (ms) | Compiled props (ms) | Equal-work speed-up |
| --- | --- | --- | --- | --- | --- | --- |
| agent-home | 679 | 0.8361 | 1.231 | 0.6137 | 0.0388 | 15.83× |
| core-queue.small | 5 | 0.0067 | 1.348 | 0.0041 | 0.0004 | 9.20× |
| core-queue.medium | 414 | 0.5017 | 1.212 | 0.3780 | 0.0209 | 18.07× |
| core-queue.large | 446 | 0.5983 | 1.341 | 0.3909 | 0.0240 | 16.31× |
| core-queue.full | 473 | 0.6618 | 1.399 | 0.4224 | 0.0259 | 16.32× |
| git-status | 145 | 0.1310 | 0.904 | 0.1141 | 0.0084 | 13.59× |
| rack-module | 236 | 0.2106 | 0.893 | 0.1741 | 0.0131 | 13.25× |
| synthetic-queue | 353 | 0.3873 | 1.097 | 0.2773 | 0.0199 | 13.96× |

Timings are rounded local measurements. Reproduce with the commands above; no image evidence or new test fixture was needed for this documentation-only task.
