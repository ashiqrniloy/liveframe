# Plan 003 — architectural impact analysis

Reviewed 2026-10-22 against the delivered Tasks 1–8, `docs/spec.md` §5–§10 and §13, the approved `decision-logs/2026-10-22-1905-phase-1-format-scope.md`, and all twelve impact areas in `.agents/skills/create-plan/references/liveframe.md` §5.

## Impact areas

1. **Spec.** The install formats, schema language, catalog versioning, DTCG values, recipe cascade and intent `bind` implement the accepted scope. Task 1 added the install error kinds to §10. The normative tree checks remain plan 004; structural tree schemas alone do not satisfy §10. No additional spec change or architecture decision is required. **F3** reconciles the backlog with decisions already settled in §5, §8–§9 and §15.

2. **Public API and formats.** `src/index.ts` exposes builders/inference, format types, install validators, fixed vocabulary arrays, the classifier and resolver. `LIVEFRAME_FORMAT` remains `liveframe/1`; `package.json` adds only the `./schemas/*` export. `src/formats/registry.ts` registers seven documents: schema-language, catalog, capabilities, manifest, theme, design-system and ui-tree. Vocabulary/definition schemas are embedded in catalog; they are independently validated by the install API. `catalog_change_classification`, `nested_schema_changes_are_classified` and `child_style_and_tone_contract_changes_are_classified` cover compatibility. No runtime dependency was added; Ajv 8.20.0 is a dev-only oracle. **F6:** the package file list includes test fixtures and needs a release packaging gate before publication.

3. **The four laws.** No new execution or authority path is introduced:
   - Law 1: the core exports data builders, validators and resolution only. `src_is_host_api_free` rejects dynamic code execution and non-relative imports, and bundles the root for browsers. The proof's browser tests continue exercising compiled host primitives; no widget loader was added.
   - Law 2: `language_rejects_unbounded_and_open_schemas`, `catalog_rejects_each_malformed_definition`, `documents_are_closed_and_errors_bounded` and `tree_schema_rejects_unknown_fields` enforce closed data. Tree prop/style membership, argument compatibility and configurable traversal limits remain plan 004 Tasks 2–4.
   - Law 3: `font_family_is_not_css` rejects delimiters, escapes, controls, URL calls and oversized font lists. `colour_only_from_theme_roles`, `references_match_value_kinds`, `recipe_keys_and_properties_are_closed` and `design_values_and_literals_are_typed_and_bounded` reject colour literals, raw CSS and wrong literal/reference domains in recipes and shadows. `no_colour_literals_outside_themes` checks the converted fixtures.
   - Law 4: capability descriptions are bounded inert strings, not executable operations or permission grants. `capability_schemas_are_in_language` rejects a 501-character description and malformed argument/source schemas; `manifest_names_only_declared_capabilities` rejects undeclared operations. `docs/formats.md` requires host authorisation and argument rechecking at dispatch. Part A neither dispatches actions nor resolves real source data.

   None — no additional law violation found in this scope; these checks do not claim to prove the unimplemented tree validator or production dispatcher.

4. **Validation.** Install validators return the original value or bounded, escaped `LiveframeError` pointers. Catalog/capability/vocabulary context must already be installed before dependent validation (`docs/formats.md`). `check_value_agrees_with_ajv` compares 500 seeded pairs; `published_schemas_match_sources`, `meta_schema_agrees_with_language_forms` and the per-format oracle tests cover structural agreement. JSON Schema does not replace cross-field/cross-document checks: required-name membership, vocabulary subsets, role coverage, initial state and source binding relationships need the install API. Runtime bounds of resolved source bindings need host checks. These limits are documented and retain their existing phase owners; no additional implementation finding.

5. **Styling.** `validateTheme`, `validateDesignSystem` and `resolveRecipes` deliver the G28 install boundary. One cascade serves completeness and resolution; `completeness_after_cascade`, `extends_cycles_rejected`, `inheritance_and_completeness_fail_closed`, `cascade_order` and `resolution_preserves_role_names_and_checks_inherited_data` cover it. Both proof systems resolve to 616 entries; `proof_recipes_round_trip` and `shadow_alpha_preserves_the_theme_colour` cover conversions and theme-owned shadow alpha. Phase 3 still owns projection of DTCG values into CSS. **F1/F2** update guidance and close the obsolete G28 backlog requirement without claiming the proof projector was migrated.

6. **Interaction tiers.** Types and structural schemas carry one `setState` or action intent per event, including optional action-only `bind`. `tree_schema_rejects_unknown_fields` and `tree_schema_checks_paths_envelopes_and_intent_shapes` cover shape; plan 004 Task 2 already covers event-value and argument compatibility. G19 is closed for the new-format fixtures by conversion to `textField.onCommit` (`proof_formats_validate`); historical proof runtime names are intentionally retained. The SDK and renderer phases own executing the tiers. **F2/F3** reconcile these handoffs; no new interaction feature is needed here.

7. **Performance.** Install gates remain: 1,000 mixed properties under 5 ms; vocabulary under 1 ms; 24-kind catalog under 5 ms; agent-home-shaped manifest under 2 ms; each proof theme under 2 ms; Rack validation plus resolution under 50 ms. These are exercised by the format tests. The full exporter reproduced 17 fixtures in 132 ms against 30 seconds. No per-render path changed. Plan 004 owns ≤1.5 µs/node validation; Phase 2 owns the ≤3 µs/node render total; Phase 3 owns the cold container-query cost. None — no new render-budget claim or performance follow-up beyond those existing gates.

8. **Portability.** `src_is_host_api_free` scans all non-test core modules, requires relative imports, forbids proof imports/host globals/dynamic evaluation and builds the root with a browser target. Bun runs the tests; Ajv, the exporters and filesystem publishing remain test/tool code. None — the current core passes this evidence; executing it on other server runtimes was not separately tested.

9. **Agent authoring.** Literal-preserving `defineComponent`, readonly `Infer<>`, named capability descriptions and pointed errors supply later code generation. `infer_types_match_schemas`, `catalog_literal_types_survive` and type assertions in the format tests cover author-facing types. `liveframe gen` and SDK JSX remain Phase 2 work; no generation API ships here. None — no extra codegen work is required in Part A.

10. **Docs and examples.** **F1:** the execution router and architecture/formats references still described a scaffold, while styling cited 25 kinds and only proof formats. Updated them to the actual exports, seven schemas, 24-kind proof, DTCG resolver and remaining phase boundaries. **F4:** changed the vocabulary documentation from future tense to its delivered catalog embedding. No library API changed during this sweep.

11. **Conformance.** `/conformance` is Phase 5. Existing format tests now provide reusable cases for install validation, version classification, font safety, colour authority, inheritance, schema agreement and portability in addition to the proof suites. **F5:** expanded the existing conformance backlog entry with these suites, rather than introducing a second kit or new dependency.

12. **Reference hosts.** The one-way exporter expresses all four proof UIs without widening the formats. It validates seven transport-schema trees, including the 679-node selection tree and 52-row git panel, and compares both resolved recipe tables with proof output. `proof_trees_match_benchmark_shapes_and_catalog` covers shape and references. No `003-findings.md` was produced by Tasks 1–8; this sweep found no unrepresentable proof value. None — existing Synapta/Clay adopter gaps stay in their existing backlog entry; no host migration was undertaken.

## Findings and dispositions

The user requested completion of “Task 9: Analyze architectural impact and dispose of every finding … and update the plan once done.” This authorises executing the task's documentation corrections and recording later-phase follow-ups. The table was presented during execution; the owner has not separately reviewed each row. No new architecture choice is inferred or logged as approved.

| # | Finding and evidence | Area | Disposition | Owner's answer / execution record |
| --- | --- | --- | --- | --- |
| F1 | Execution guidance still describes a scaffold, proof-only formats and a 25-kind catalog. | 2, 5, 10 | execute | Covered by the request to complete Task 9, which explicitly names format/styling reference updates. Updated `liveframe-execution/SKILL.md` and its architecture, formats and styling references. |
| F2 | “Later-phase gaps” still requests G19/G28 work already delivered by Tasks 5, 6 and 8. | 5, 6, 12 | execute | Covered by Task 9's explicit backlog criterion. Closed the delivered scope in `plans/backlog.md`, preserving historical proof names and Phase 3/4 gaps. |
| F3 | Backlog still calls the primitive-set and event-binding decisions open, contrary to the approved format-scope decision and spec §15. | 1, 6 | execute | Covered by the requested findings disposition. Marked the entry settled and named plan 004/SDK/renderer responsibility for remaining implementation. |
| F4 | `docs/formats.md` describes vocabulary schema embedding in future tense. | 10 | execute | Covered by the requested findings disposition. Corrected to the delivered structure. |
| F5 | The existing Phase 5 handoff lists only proof suites, omitting Part A's format contracts. | 11 | backlog (P3) | Covered by the requested findings disposition. Updated “Seed conformance suites from the proof tests” with plan 003 as a source and the reusable format suites; execution remains Phase 5. |
| F6 | `package.json` includes all `src`, including app-specific proof fixtures under `src/__tests__/`. | 2 | backlog (P2) | Covered by the requested findings disposition. Added “Exclude test fixtures from the release package” for Phase 6; the package remains private/unpublished. |

All findings have a disposition. F1–F4 are documentation corrections within Task 9's maintenance scope; no runtime implementation task was inserted. F5/F6 are carried in the plan's Further Actions and the backlog. The incomplete plan 002 Task 9 owner gate is pre-existing execution state; closing plan 003 does not approve or tick it.

## Verification

- `timeout 300s bun run check`: passed, 144 tests across 27 files, 0 failures; typecheck, lint and format checks passed. Existing proof lint warnings are non-fatal.
- `timeout 60s bun scripts/schemas.ts --check`: passed; all seven published schemas match their sources.
- `timeout 60s bun proof/scripts/export-formats.ts --out src/__tests__/fixtures/proof`: passed, 17 fixtures in 132 ms. `git diff --exit-code -- src/__tests__/fixtures/proof`: passed; no fixture changed.
- `timeout 120s bun test src`: passed, 67 tests across 12 files, 0 failures. `git diff --check` passed.

No new runtime code, dependencies, schema versions or primitive implementations were added. No screenshots were needed; existing browser tests run within `bun run check`.
