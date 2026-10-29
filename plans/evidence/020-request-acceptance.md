# 0.2.0 request acceptance

Every acceptance bullet in [Synapta's 17 requests](https://github.com/ashiqrniloy/liveframe/blob/main/plans/requests/synapta-adoption-requests.md) and [Clay's nine](../plans/requests/clay-adoption-requests.md), plus Clay's two extra acceptance items (LF-10 `maximum`/ordering, LF-03's `docs/styling.md` sweep), against this checkout. Bullets keep their request's numbering; the text is the bullet's condition, shortened. **Evidence** is the named test with its file, a gate step, or a documentation record, and every named test passes in the single run saved as `plans/evidence/020-request-acceptance.log` (local-only, not committed).

Tests run with `bun test --conditions liveframe:source -t '<one alternation of the names below>'`; browser cases launch through `src/__tests__/fixtures/browser.ts` (Chromium by default).

## Synapta

| ID | Acceptance bullet | Evidence |
| --- | --- | --- |
| LF-01.1 | `origin` is correct for nested, collection (`items[i].emit`) and portal nodes | `origin_for_nested_and_collection_nodes` (`react-intents.test.tsx`) |
| LF-01.2 | `checkOffered` rejects a wrong revision, unknown node, undeclared event, changed args, a filled arg other than `bind`, and a differing `setState` key | `check_offered_rejects_each_forgery` (`offered.test.ts`) |
| LF-01.3 | The renderer guide's host example uses `checkOffered` | `docs/renderer.md` § "Handle intents at the host boundary": the host example imports and calls `checkOffered` (`docs/renderer.md:307-315`) |
| LF-01.4 | The conformance renderer suite records `origin` alongside intents | `session_rejects_unoffered_and_stale_intents_without_mutation` (`preview-session.test.ts`)<br>`queued_intent_keeps_its_origin_and_is_rejected_after_a_revision_change` (`proof/tests/host.test.ts`) |
| LF-02.1 | The exports test lists the new subpaths | `exports_list_sdk_gen` (`exports.test.ts`) |
| LF-02.2 | The archive gate imports them from the installed package | archive gate step "every installed exports target exists" (`scripts/release/archive-gate.ts:145`) |
| LF-02.3 | `liveframe gen` and `liveframe preview capture` call the exported functions | `sdk_gen_subpath_matches_cli_output` (`sdk-gen.test.ts`)<br>`flags_narrow_the_cells` (`proof/tests/preview-capture.test.ts`) |
| LF-02.4 | Importing the subpath does not load Playwright | `capture_subpath_imports_without_playwright` (`preview-capture.test.ts`)<br>`gen_runs_without_playwright` (`proof/tests/preview-capture.test.ts`) |
| LF-03.1 | A docs check finds no "planned" next to an exported name | `shipped_docs_never_call_exports_planned` (`docs-wording.test.ts`)<br>`wording_check_matches_export_names_in_the_same_sentence` (`docs-wording.test.ts`) |
| LF-03.2 | Clay's extra: the sweep catches `docs/styling.md`'s "public React renderer remains planned work" | `docs/styling.md` has no "planned" left (`grep -c planned docs/styling.md` → 0), and `shipped_docs_never_call_exports_planned` scans that file with every other shipped doc |
| LF-04.1 | Every new keyword has failing-case validator tests: bounds, `minLength > maxLength` rejected, code-point counting | `min_length_counts_code_points` (`schema.test.ts`)<br>`min_above_max_is_rejected` (`manifest.test.ts`)<br>`minimum_keywords_are_bounded_integers` (`schema.test.ts`)<br>`union_rejects_malformed_mapping` (`union.test.ts`) |
| LF-04.2 | Each failing value produces an agent-readable `expected` | `min_above_max_is_rejected` (`manifest.test.ts`)<br>`union_unknown_tag_fails_at_tag_pointer` (`union.test.ts`) |
| LF-04.3 | The published schemas validate documents that use the new forms | `published_schemas_match_sources` (`schemas.test.ts`)<br>`meta_schema_agrees_with_language_forms` (`schemas.test.ts`)<br>`published_schema_nullable_roundtrip` (`nullable.test.ts`)<br>`published_union_matches_compiled` (`union.test.ts`) |
| LF-04.4 | The compiled checks stay within the ≤ 1.5 µs/node validator bench and the 3 µs/node render bench | bench figures in § Performance below, from this task's `bun run bench` |
| LF-04.5 | A test pins that `pattern` is still rejected in widget schemas while `minLength` is accepted | `widget_schema_accepts_min_length_rejects_pattern` (`manifest.test.ts`) |
| LF-05.1 | The validator rejects a mismatched object/argument schema at render time with `invalid-prop` and a pointer | `bind_all_schema_mismatch_fails_with_pointer` (`object-events.test.tsx`) |
| LF-05.2 | `emit` throws on a value that fails the declared object schema, and the `carries` mismatch tests cover the new form | `emit_rejects_invalid_object_and_completes_fresh_intents` (`object-events.test.tsx`)<br>`wrong_carries_type_throws_and_raises_nothing` (`react-intents.test.tsx`) |
| LF-05.3 | One submit carries every field's current local value with no prior `setState` | `form_submit_carries_all_fields` (`react-browser.test.tsx`) |
| LF-05.4 | The preview session's `intent()` re-checks the filled arguments | `preview_rechecks_bind_all_args` (`preview-session.test.ts`) |
| LF-05.5 | The conformance renderer suite gains a "form submits its fields" fixture | `conformance_form_fixture` (`conformance-renderer-browser.test.tsx`) |
| LF-06.1 | `storeSuite` covers scoped state isolation and deletion across scopes | `store_suite_catches_scope_leaks_and_incomplete_deletion` (`conformance-store.test.ts`) |
| LF-06.2 | `memoryStore` and `fileStore` pass it | `store_suite_wraps_adapter_errors_and_bounds_details` (`conformance-store.test.ts`) |
| LF-06.3 | A 0.1.x `fileStore` fixture directory loads under 0.2.0 | `file_store_reads_0_1_0_directory` (`store-file.test.ts`) |
| LF-06.4 | `loadPlacement` with explicit state resets an invalid state exactly as it resets a stored one | `load_placement_explicit_state_resets_like_stored` (`store-load.test.ts`)<br>`verify_placement_inputs_matches_load_placement` (`store-load.test.ts`) |
| LF-06.5 | The compatibility doc records the interface change as a minor-version break | `docs/compatibility.md` § 0.2.0 **Store**, lines 17-21, plus the scope decision log |
| LF-07.1 | The format, JSON Schema, `pack()` and `verifyPackage()` tests cover both fields, including size bounds | `manifest_description_bounded` (`manifest.test.ts`)<br>`meta_depth_and_bytes_bounded` (`manifest.test.ts`)<br>`capability_meta_bounded` (`manifest.test.ts`)<br>`published_manifest_schema_accepts_meta` (`manifest.test.ts`)<br>`verify_rechecks_manifest_and_scenarios` (`pack.test.ts`) |
| LF-07.2 | The hash changes when `meta` changes | `meta_changes_hash` (`pack-hash.test.ts`) |
| LF-07.3 | The docs say that `meta` grants nothing and is untrusted on load | `docs/formats.md` § manifest `meta`, and `docs/spec.md` § 7.3 |
| LF-08.1 | The metadata reaches implementations for nested and collection nodes | `events_metadata_reaches_nested_and_collection_nodes` (`react-intents.test.tsx`) |
| LF-08.2 | With `confirm` supplied, an unconfirmed action never reaches `onIntent` | `unconfirmed_action_never_reaches_on_intent_and_confirm_throw_raises_nothing` (`react-browser.test.tsx`)<br>`confirmation_is_single_flight_preserves_origin_and_drops_after_unmount` (`react-browser.test.tsx`) |
| LF-08.3 | The capabilities format and schema tests cover `irreversible` | `irreversible_in_capabilities_schema` (`schemas.test.ts`) |
| LF-08.4 | The docs repeat that the host still re-checks on dispatch | `docs/renderer.md` confirmation and host-dispatch sections ("confirmation policy and authorisation on dispatch"); reviewed in `020-release-readiness-review.md` S5 |
| LF-09.1 | Format, schema and generated-type tests cover the new values | `semantics_lists_live_regions` (`vocabulary.test.ts`) |
| LF-09.2 | A `status` node's text change is announced once and is not remounted | `status_region_survives_text_change` (`react-browser.test.tsx`) |
| LF-09.3 | The conformance renderer suite gains semantics fixtures | `conformance_semantics_fixtures_render` (`conformance-renderer.test.tsx`) |
| LF-10.1 | Colour-space conversion tests cover every DTCG colour space Liveframe accepts | `converts_every_dtcg_space_to_luminance` (`contrast.test.ts`)<br>`wide_gamut_srgb_clipping_reference_values` (`contrast.test.ts`) |
| LF-10.2 | Alpha compositing is tested | `composites_alpha_before_ratio` (`contrast.test.ts`)<br>`translucent_background_requires_opaque_declared_base` (`contrast.test.ts`) |
| LF-10.3 | A pair below its minimum fails with the measured ratio | `pair_below_minimum_fails_with_ratio` (`contrast.test.ts`) |
| LF-10.4 | A vocabulary without `contrast` behaves exactly as in 0.1.0 | `vocabulary_without_contrast_unchanged` (`contrast.test.ts`) |
| LF-10.5 | The new error kind is documented as an addition, per the compatibility policy | `docs/compatibility.md:47` lists `insufficient-contrast` as an additive error kind |
| LF-10.6 | Clay's extra: a declared pair may carry `maximum`, so ordering rules like "quieter than `border.subtle`" can be stated | `pair_above_maximum_fails_and_thresholds_compare_unrounded_ratios` (`contrast.test.ts`)<br>`ordering_violation_names_both_pairs` (`contrast.test.ts`) |
| LF-11.1 | Projection tests cover byte-stable output, forced colours and reduced transparency | `alpha_projection_byte_stable` (`css-design-system.test.ts`)<br>`alpha_reduced_transparency_and_forced_colours` (`css-browser.test.ts`) |
| LF-11.2 | The design-system validator rejects an alpha on a non-colour property and an unknown opacity name | `alpha_modifier_validates` (`design-system.test.ts`) |
| LF-11.3 | The proof vocabulary drops its `*.alpha-*` roles, and Certified/Rack parity is unchanged | `proof_vocabulary_has_no_alpha_roles` (`proof-formats.test.ts`) |
| LF-12.1 | The helper's output validates under the schema language | `source_outcome_is_language_schema` (`outcome.test.ts`) |
| LF-12.2 | A preview test renders the generated outcome scenarios | `preview_checks_generated_outcomes` (`preview-session.test.ts`)<br>`outcome_scenarios_one_per_status` (`outcome.test.ts`) |
| LF-12.3 | `docs/formats.md` documents the convention as optional | `docs/formats.md` § source outcomes: the envelope is a convention, a bare `result` still validates |
| LF-13.1 | The bundle runs under a non-Bun isolate in CI, and the test records which | `bundle_renders_under_node_vm` (`runner-bundle.test.ts`) |
| LF-13.2 | `workerRunner` and `inProcessRunner` are rebuilt on the kit, with identical results on the existing runner tests | `render_module_matches_render` (`runner-kit.test.ts`)<br>`link_package_rewrites_only_canonical_header` (`runner-kit.test.ts`)<br>`link_package_rejects_missing_header` (`runner-kit.test.ts`) |
| LF-13.3 | The archive gate checks the bundle is self-contained | `bundle_is_self_contained` (`runner-bundle.test.ts`) |
| LF-13.4 | The security doc repeats that the kit is not an isolation boundary | `docs/security.md:19` |
| LF-14.1 | The equivalence test passes on every proof manifest | `capabilities_for_equivalence_on_proof_manifests` (`sdk-proof-widgets.test.ts`) |
| LF-14.2 | The renderer guide recommends pruning before transfer | `docs/renderer.md:131` |
| LF-15.1 | The existing MCP tests pass unchanged against the adapter | `authoring_operations_match_mcp_tools` (`authoring.test.ts`)<br>`authoring_results_match_mcp_json` (`authoring.test.ts`)<br>`scripted_agent_writes_fixes_and_lays_out_a_widget_through_mcp_tools_only` (`proof/tests/mcp-agent-loop.test.ts`) |
| LF-15.2 | New unit tests call `/authoring` directly | `authoring_serializes_draft_operations_and_binds_lazily` (`authoring.test.ts`)<br>`authoring_expands_outcome_scenarios_without_changing_preview_selection` (`authoring.test.ts`) |
| LF-15.3 | Authoring doesn't load the MCP SDK | `authoring_without_mcp_sdk` (`authoring.test.ts`) |
| LF-16.1 | Trees from `renderElements` are identical to `render()`'s for equivalent TSX | `render_elements_matches_render_for_fixtures` (`sdk-elements.test.ts`) |
| LF-16.2 | Each validation error kind is reported with a pointer into the JSON | `render_elements_error_pointers_into_json` (`sdk-elements.test.ts`) |
| LF-16.3 | The agent-facing JSON Schema is generated deterministically, with a `--check` drift test | `elements_schema_deterministic_and_drift_checked` (`sdk-elements.test.ts`) |
| LF-17.1 | A recorded benchmark and decision; no API change unless the decision approves one | `plans/evidence/019-streaming-bench.md` and `decision-logs/2026-10-29-1552-agent-surfaces-corpus-and-engines.md`: tree patches are not implemented |

## Clay

| ID | Acceptance bullet | Evidence |
| --- | --- | --- |
| CL-01.1 | Two previews with different `urlKey`s and selections, neither changing the other | `two_previews_with_url_keys_are_independent` (`preview-react.test.tsx`) |
| CL-01.2 | A controlled preview leaves `location.href` unchanged across selections | `controlled_preview_leaves_location_unchanged` (`preview-react.test.tsx`) |
| CL-01.3 | A first `result` for scenario A, with the URL naming B, is never shown or retained as B's | `first_result_never_relabelled` (`preview-react.test.tsx`) |
| CL-01.4 | `liveframe preview capture` and MCP `capture_preview` still pass against the uncontrolled default | `flags_narrow_the_cells` (`proof/tests/preview-capture.test.ts`)<br>`capture_with_url_key` (`preview-react.test.tsx`)<br>`mcp_capture_with_injected_backend` (`cli-mcp.test.ts`) |
| CL-02.1 | The host class is on both containers, and the scope attributes and `lf_surface`/`lf_container` survive a host `className` | `host_class_appended_scope_survives` (`react-surface.test.tsx`) |
| CL-02.2 | In a CSS grid the portal takes no track, and an open overlay still resolves the surface's theme and design-system variables | `portal_takes_no_grid_track_and_overlay_responsive_value_tracks_viewport` (`react-browser.test.tsx`)<br>`portal_overlay_keeps_surface_scope` (`react-browser.test.tsx`) |
| CL-02.3 | The switching test covers both containers carrying host classes | `switch_runs_the_switching_sequence_on_root_and_portal` (`react-browser.test.tsx`)<br>`switching_suppresses_transitions` (`css-browser.test.ts`) |
| CL-03.1 | The archive gate fails on an `exports` target missing from the packed list, and the archive has none | `published_manifest_has_no_source_condition` (`archive.test.ts`)<br>`archive_gate_rejects_a_packed_missing_condition` (`archive.test.ts`) |
| CL-04.1 | `none` is accepted on the listed properties, rejected on non-colour properties, and a role named `none` is rejected | `none_accepted_on_colour_properties_only` (`design-system.test.ts`)<br>`vocabulary_rejects_role_named_none` (`vocabulary.test.ts`) |
| CL-04.2 | Projection is byte-stable and the cascade clears a background set by `kind.*.slot.rest` | `none_clears_rest_background_byte_stable` (`css-design-system.test.ts`) |
| CL-04.3 | A forced-colours browser test shows the inward outline on a `none` background with no border | `forced_colours_only_restore_differing_states_and_background_edges` (`css-design-system.test.ts`) |
| CL-04.4 | The Rack proof styles drop any zero-alpha role they used for this | `proof_vocabulary_has_no_alpha_roles` (`proof-formats.test.ts`)<br>`no_colour_literals_outside_themes` (`proof-formats.test.ts`) |
| CL-05.1 | A fake-page backend passes the capture tests: axis narrowing, cell bound, `data-lf-ready`, sanitised names, `index.json` | `capture_with_fake_backend_covers_contract` (`preview-capture.test.ts`)<br>`capture_records_null_snapshot` (`preview-capture.test.ts`) |
| CL-05.2 | The MCP tests run with an injected backend | `mcp_capture_with_injected_backend` (`cli-mcp.test.ts`) |
| CL-05.3 | Importing the capture subpath without Playwright succeeds when a backend is injected | `capture_subpath_imports_without_playwright` (`preview-capture.test.ts`) |
| CL-05.4 | The docs state the snapshot format, and that screenshots are only as faithful as the backend's engine | `docs/preview.md` § capture: `CaptureBackend`, nullable snapshots, engine fidelity |
| CL-06.1 | CI runs every corpus case through the TypeScript validators and fails on any mismatch | `corpus_cases_match_validators` (`corpus.test.ts`) |
| CL-06.2 | The archive gate checks the corpus is packed | archive gate step "corpus packed" (`scripts/release/archive-gate.ts:154`) |
| CL-06.3 | Every error kind a format validator can produce has at least one failing case | `corpus_covers_every_validator_error_kind` (`corpus.test.ts`) |
| CL-06.4 | The hash set includes RFC 8785 Appendix B's number examples | `hash_vectors_include_rfc8785_appendix_b` (`hash-vectors.test.ts`)<br>`hash_vectors_match` (`hash-vectors.test.ts`)<br>`rejected_inputs_rejected` (`hash-vectors.test.ts`) |
| CL-06.5 | The compatibility doc says a case's expectation changes only with a format version | `docs/compatibility.md:42` |
| CL-07.1 | Format, validator, `styleDeclarations` and generated-type tests cover both props, including responsive values and undeclared names | `min_max_height_validate_and_project` (`validator-rules.test.ts`)<br>`max_height_rejects_undeclared` (`validator-rules.test.ts`) |
| CL-07.2 | `liveframe gen --check` output updates | `bun run gen:check` in `bun run check`, which regenerates `ui.definitions.gen.ts` with `--check` |
| CL-07.3 | A browser test shows `maxHeight` plus a `scroll` primitive scrolling inside a fixed-height container | `scroll_max_height_scrolls` (`css-browser.test.ts`) |
| CL-08.1 | `emit` throws on `NaN`, `Infinity` and a non-integer for `integer` | `emit_rejects_nan_infinity_and_fraction_for_integer` (`react-intents.test.tsx`) |
| CL-08.2 | A `bind` mismatch (`number` into a `string` argument) fails with `invalid-prop` and a pointer | `bind_number_into_string_fails` (`validator-rules.test.ts`) |
| CL-08.3 | A preview session's `intent()` rejects an out-of-range filled value | `preview_intent_rejects_out_of_range_number` (`preview-session.test.ts`) |
| CL-08.4 | The conformance renderer suite gains a numeric fixture | `conformance_numeric_fixture` (`conformance-renderer.test.tsx`) |
| CL-09.1 | Projection shows the attribute rule emitted once, in the base sheet, byte-stable | `base_sheet_has_transparency_attribute_rule_once` (`css-theme.test.ts`) |
| CL-09.2 | `backdrop-filter: none` and alpha 1 on a recipe with `backdropBlur`/`backgroundOpacity` when `reduced`, including inside an open portal overlay | `attribute_recovers_alpha_modifiers_like_the_media_query` (`css-design-system.test.ts`)<br>`reduced_transparency_prop_in_portal` (`react-browser.test.tsx`) |
| CL-09.3 | The switch suppresses transitions | `transparency_switch_suppresses_transitions` (`react-browser.test.tsx`) |

## Verification run

One invocation, 2026-10-29, Bun 1.4.4 on linux 7.3.0 (AMD Ryzen 9 PRO 7940HS):

```sh
bun test --conditions liveframe:source -t '<alternation of the 120 names above>' \
  > plans/evidence/020-request-acceptance.log
# 124 pass, 0 fail, 786 filtered out; 16945 expect() calls; 116 files; 31.7 s
```

The log counts more tests than names because `-t` matches a substring, so a name also selects a `describe` block's cases and a fixture-templated family (`capabilities_for_equivalence_on_proof_manifests: <fixture>`). It is committed beside this record (12 KB); the command above regenerates it. Tests inside a `describe` print as `describe > name`, which is why `min and max height > min_max_height_validate_and_project` appears with a prefix.

## Performance

`bun run bench` (same machine, same run), against the plan's budgets. The gate fails a workload, so a passing exit code is the assertion:

| Bench | Budget | Result |
| --- | --- | --- |
| Validator, compiled (shipped path) | ≤ 1.5 µs/node | 0.819–1.370 µs/node over 8 workloads (agent-home 679 nodes: 1.314) |
| Validator, generic interpreter | reported for comparison, not gated | 1.071–2.092 µs/node; agent-home's equal-work props check is 1.25× the generic `checkValue` |
| Render (validation + tree to elements) | ≤ 3 µs/node, wall ≤ 2 ms on agent-home and core-queue medium…full | 1.622–2.263 µs/node, wall 0.26–1.07 ms; validation share 0.893–1.566 µs/node |
| Warm style switch | ≤ 16.67 ms per sample | `switch_under_budget_with_blur_through_surface` passes (Chromium 16.67, WebKit 25.1), and `switch_under_budget_with_blur` likewise |
| CSS `styleDeclarations` | no budget, tracked | 0.394 µs/node (0.267 ms for 679 nodes) |

`bun run bench` also regenerates `plans/evidence/019-streaming-bench.md` (the LF-17 measurement) with fresh timings; its committed copy was left unchanged, so LF-17's evidence stays the recorded run it decided on.

## The four laws, re-checked by name

1. **Widget code never runs in the browser.** `compiled_output_is_host_api_free` (the emitted validator's output imports nothing host-level), `package_boundaries_and_transport_semantics`, and the archive gate's `pack, store, reload and render through both runners` plus `browser bundle from the installed package` steps: packages execute in a runner, and the browser receives a tree (`browser_hydrates_posts_intents_logs_actions_and_switches_styles`).
2. **The UI tree is validated data.** `invalid_tree_renders_only_the_fallback`, `oversized_tree_is_refused_with_a_typed_error`, `host_rechecks_intents_against_manifest_and_capabilities`, and the arrival validator in `session_rejects_unoffered_and_stale_intents_without_mutation`.
3. **Widget code never sets colours or raw CSS.** `definitions_admit_no_colour_or_raw_style_props`, `no_colour_literals_outside_themes`, `colour_authority_holds`, and the forced-colours tests (`forced_colours_only_restore_differing_states_and_background_edges`, `native_parts_no_system_colour_outside_forced_block`).
4. **A widget never holds authority.** `dispatch_rechecks_state_actions_current_tree_and_revision`, `check_offered_rejects_each_forgery`, `unconfirmed_action_never_reaches_on_intent_and_confirm_throw_raises_nothing`, and `authoring_hides_host_meta_unless_requested_and_bounds_trees`; `docs/security.md` states the boundary each of these enforces.

No test was weakened or added for this task.

## Findings

Two bullets are proven, but not by the test name their plan predicted. Both are naming, not coverage:

- CL-02.2 and CL-02.3: plan 017 named `overlay_resolves_scope_variables_with_host_classes` and `switching_with_host_classes`; neither exists. The browser fixture `src/__tests__/fixtures/react-client.tsx:129-130` passes `wrapperProps`/`portalProps` to the surface every browser test mounts, so `portal_takes_no_grid_track_and_overlay_responsive_value_tracks_viewport`, `portal_overlay_keeps_surface_scope` and `switch_runs_the_switching_sequence_on_root_and_portal` exercise host classes on both containers. `host_class_appended_scope_survives` is the dedicated renderer test.
- LF-07.1: `pack()` and `verifyPackage()`'s coverage of `description`/`meta` is `verify_rechecks_manifest_and_scenarios` (verification re-runs the manifest validator, which is what enforces the bounds), not a dedicated round-trip test.

No bullet is left without evidence, so no task is added above Task 8 and nothing is deferred. G29's unrun Windows audit is not a request bullet; it stays the known limitation Task 3 recorded.

## Installed release candidate

The installed-package rows (LF-02.2, LF-02.4, LF-16 bundle, CL-06 corpus and vectors) were re-run against `@arnilo/liveframe@0.2.0-rc.3` from the registry; see [020-release-candidate.md](020-release-candidate.md). The remaining rows are tests on the source tree and have no installed form.
