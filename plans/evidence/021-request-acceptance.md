# 0.2.1 request acceptance

Every acceptance bullet in [Clay's 0.2.0 review](../requests/clay-0.2.1-requests.md) (CL-10 to CL-16) and every item of [Task 14.1's decision](../../decision-logs/2026-10-31-2057-authoring-mcp-server-0-2-1-surface.md) (M1 to M9), against this checkout. Bullets keep their request's numbering; the text is the bullet's condition, shortened. **Evidence** is the named test with its file, a gate step, or a record. Names are the tests' real titles: a few plan-time names were merged or renamed during the tasks, and the table uses what exists.

Tests run with `bun test --conditions liveframe:source -t '<one alternation of the names below>'`, in one invocation, saved as `plans/evidence/021-request-acceptance.log` (local-only, not committed). Browser cases run in Chromium (the default). The WebKit switching assertions and the release gate are separate saved runs, listed under [Verification runs](#verification-runs).

## Clay

| ID | Acceptance bullet | Evidence |
| --- | --- | --- |
| CL-10.1 | The archive gate parses the validator bundle and finds no imports and no host references | `validator_bundle_is_self_contained`, `validator_bundle_omits_the_render_path`, `validator_bundle_subpath_resolves` (`validator-bundle.test.ts`, `exports.test.ts`)<br>`compiled_output_is_host_api_free` (`portability.test.ts`, scans `dist/validator.bundle.js` too)<br>archive gate step "validator bundle packed and self-contained" |
| CL-10.2 | A bare `vm` test, no globals added, validates a corpus tree and runs `checkOffered` with results identical to the root export | `validator_bundle_validates_under_bare_vm` (`validator-bundle.test.ts`)<br>`complete_returns_a_frozen_copy_without_structured_clone` (`offered.test.ts`) |
| CL-10.3 | The runtime matrix is true for each subpath it lists, and CI checks it | `runtime_matrix_names_every_allowlisted_global` (`portability.test.ts`: spec §13 matrix equals the allowlist)<br>`matrix_global_scan_rejects_unlisted_identifiers`, `src_is_host_api_free`, `compiled_output_is_host_api_free`, `sdk_bundles_for_browser_without_host_apis`, `css_bundles_for_browser_without_host_apis` (`portability.test.ts`)<br>archive gate step "host-API-free subpaths under node" |
| CL-11.1 | The corpus test runs the package cases through `verifyPackage`, and the packed `valid.json` verifies; `hash-mismatch` and `forbidden-import` have failing cases | `corpus_cases_match_validators`, `corpus_covers_every_validator_error_kind` (`corpus.test.ts`)<br>archive gate step "corpus packed" |
| CL-11.2 | The package vectors pass through the public exports | `package_hash_vectors_through_public_exports`, `hash_vectors_match` (`hash-vectors.test.ts`)<br>`subpath_export_surfaces` (`exports.test.ts`: `/pack` lists `canonicalJson` and `packageHash`)<br>archive gate steps "hash vectors packed" and "host-API-free subpaths under node" (installed vectors) |
| CL-12.1 | The `vm` test covers outer-realm inputs and reports a realm-specific message | `bundle_reports_outer_realm_manifest`, `bundle_renders_under_node_vm` (`runner-bundle.test.ts`)<br>`validate_json_names_foreign_realm` (`runner-bundle.test.ts`) |
| CL-13.1 | The exports test resolves one corpus case and one hash file through the package name | `exports_resolve_package_json_and_conformance_data` (`exports.test.ts`)<br>`exports_targets_are_packed` (`archive.test.ts`)<br>archive gate step "host-API-free subpaths under node" (the same paths from the installed archive) |
| CL-14.1 | After 0.2.1 is published, `npm view @arnilo/liveframe dist-tags` shows `next` at or above `latest` | **Not provable on this checkout.** Release checklist in `docs/compatibility.md` § Release process and the `dist-tag add` step in `.github/workflows/publish.yml` are in place (Task 8). The registry check is Task 18's acceptance and is recorded there |
| CL-15.1 | The LF-17 benchmark with patches is at or under 1 KiB gzip and 8 ms arrival validation plus commit per update | [021-streaming-patches.md](021-streaming-patches.md) (Task 12 run): median **228 B gzip** (≤ 1,024), **2.7 ms** arrival validation plus React work (≤ 8); host `diffTrees` and browser `applyPatch` medians within their 1.5 and 0.5 ms budgets. See § Performance |
| CL-15.2 | `applyPatch(prev, diffTrees(prev, next))` deep-equals `next` for every corpus tree pair; a wrong base fails with `stale-patch` | `diff_then_apply_round_trips_every_pair`, `diff_round_trips_mixed_sibling_edits`, `diff_rejects_mismatched_surfaces_revisions_and_empty_children`, `diff_preserves_inputs_and_omitted_versus_present_own_fields` (`tree-patch.test.ts`)<br>`apply_patch_rejects_stale_base_and_is_all_or_nothing` (`tree-patch.test.ts`) |
| CL-15.3 | The corpus has valid and invalid patch cases, run through the public API | `corpus_cases_match_validators` (`corpus.test.ts`: `tree-patch/` cases, one per error kind)<br>`tree_patch_corpus_schema_shape_parity`, `tree_patch_schema_matches_validator` (`tree-patch.test.ts`)<br>`patch_vectors_through_public_exports_and_deterministic_edit_order` (`tree-patch.test.ts`)<br>`tree_patch_types_and_schema_are_public` (`exports.test.ts`)<br>archive gate step "patch vectors packed" |
| CL-15.4 | `checkOffered` accepts an intent from a patched revision and rejects the superseded one | `check_offered_follows_patched_revision` (`offered.test.ts`) |
| CL-15.5 | Also proven (Task 9 and 12): application order and ownership, structural sharing, unchanged subtrees skipped in the React commit with local state, focus and scroll kept | `apply_patch_applies_each_op_and_shares_untouched_subtrees`, `apply_patch_obeys_order_and_ownership`, `apply_patch_updates_indexes_after_descendant_removal_and_reinsertion`, `shared_json_comparison_preserves_mismatch_pointers` (`tree-patch.test.ts`)<br>`patched_render_skips_unchanged_nodes_and_preserves_local_state_focus_scroll`, `reused_nodes_follow_confirmation_fallback_and_diagnostics_changes` (`react-browser.test.tsx`) |
| CL-16.1 | A WebKit test asserts the budget at 16.67 ms on the library's measurement (span A), with no WebKit-only ceiling above it | `switch_under_budget_with_blur` (`css-scope-browser.test.ts`) and `switch_under_budget_with_blur_through_surface` (`react-browser.test.tsx`), both asserting span A ≤ 16.67 ms in every engine through `measureSwitching`. Chromium: in the main run. **WebKit: separate saved run** ([WebKit run](#verification-runs)), max of ten warm samples 11 ms (CSS) and 14 ms (Surface)<br>`switching_fixture_loads_primitive_css` (`css-scope-browser.test.ts`) keeps the fixture realistic |
| CL-16.2 | The evidence file records machine, engine versions, headless or headed, and the split timings | [021-webkit-switching.md](021-webkit-switching.md) (Task 13 diagnosis, spans A/B/C, headless and headed), [021-task-13-remedies.md](021-task-13-remedies.md), [021-task-14-switching.md](021-task-14-switching.md) |
| CL-16.3 | Cause fixes hold (`deferOffscreen`, Task 13.3 and 13.4) | `defer_offscreen_projects_content_visibility` (`css-style-props.test.ts`)<br>`style_table_covers_every_fixed_prop_and_bounds` (`validator-node.test.ts`: raw, undeclared and non-string values rejected)<br>`generated_types_reject_wrong_props` (`sdk-gen-types.test.tsx`: `deferOffscreen="12px"` fails to compile)<br>`agent_home_rows_defer_offscreen`, `defer_offscreen_content_stays_focusable` (`css-scope-browser.test.ts`) |

## Authoring MCP server (Task 14.1)

| ID | Item | Evidence |
| --- | --- | --- |
| M1.1 | `render_scenarios` advertises `outcomes`; MCP and library statuses match; a non-boolean is `invalid-document` at `/outcomes` | `tools_list_advertises_outcomes`, `render_outcomes_over_mcp_matches_library`, `render_outcomes_rejects_non_boolean` (`cli-mcp.test.ts`) |
| M2.1 | A missing `pack_draft` key is a `LiveframeError` at its pointer; several missing keys report each; descriptions still say "Required"; non-object arguments stay a protocol error | `pack_missing_key_is_a_liveframe_error`, `pack_missing_keys_reports_each`, `tools_list_describes_required_keys`, `pack_non_object_arguments_are_protocol_errors`, `argument_errors_are_liveframe_errors` (`cli-mcp.test.ts`) |
| M3.1 | `generated_types({ module })` returns the CLI's bytes for `types`, `implementations` and `elementsSchema`; the default is unchanged; an unknown module is `invalid-document` at `/module` | `generated_modules_match_cli_bytes`, `generated_types_equals_liveframe_gen_output`, `generated_types_rejects_unknown_module` (`cli-mcp.test.ts`)<br>`generated_types_default_unchanged` (`authoring.test.ts`) |
| M4.1 | `set_state` applies an offered `setState` event and returns the bounded tree; unoffered, action, invalid-value and no-render cases fail typed and never reach the session log | `set_state_applies_offered_event_and_refuses_invalid_origins_and_actions`, `set_state_bounds_the_rerendered_tree` (`authoring.test.ts`)<br>`set_state_tool_validates_and_applies_offered_events` (`cli-mcp.test.ts`)<br>`set_state_rerenders_and_invalid_intents_change_nothing` (`preview-session.test.ts`) |
| M4.2 | The bound page and a later capture see the state; preservation is opt-in; the tool list has eight tools | `set_state_then_capture_shows_state` (`proof/tests/mcp-capture.test.ts`)<br>`render_preserve_state_is_opt_in` (`preview-session.test.ts`)<br>`tools_list_has_the_eight_tools` (`cli-mcp.test.ts`)<br>archive gate step "liveframe mcp over stdio" (eight tools from the installed `bin`) |
| M5.1 | `pack_draft({ dir })` under `draftRoot` packs what the demo reader packs (same hash as inline) | `pack_dir_matches_inline_hash` (`cli-mcp.test.ts`) |
| M5.2 | Every rejection is typed at `/dir`: absolute, `..`, symlink escape (directory, file, sibling prefix), missing manifest, scenarios or entry, malformed JSON, non-regular file, source-count and byte bounds, `dir` with inline fields; `dir` without `draftRoot` is `not-found`; a bad `draftRoot` exits 2 | `pack_dir_rejects_*` (one generated test per case, `cli-mcp.test.ts`), `pack_dir_accepts_exact_read_bounds`, `pack_dir_joins_arrival_order_before_render`, `pack_dir_without_root_names_draftRoot`, `config_rejects_missing_draft_root`, `config_rejects_nonstring_draft_root`<br>`/authoring` stays host-API-free: `src_is_host_api_free` (`portability.test.ts`) |
| M6.1 | All eight tools carry the approved title and four hints | `tools_carry_approved_annotations` (`cli-mcp.test.ts`) |
| M7.1 | Every tool returns `structuredContent` equal to its first text block (enveloped as `{ result }` for non-object roots under protocol 2025-11-25); errors carry none; every `outputSchema` resolves with no external `$ref` | `structured_content_matches_text_2025_11_25_and_output_schemas_resolve` (`cli-mcp.test.ts`)<br>`pack_draft_schema_embeds_the_published_schemas` (`cli-mcp.test.ts`) |
| M7.2 | 0.2.0 text blocks are byte-identical; capability and draft `meta` stay hidden in structured output unless exposed | `text_results_unchanged_from_0_2_0` (`cli-mcp.test.ts`, baseline `fixtures/mcp-texts.json`)<br>`list_capabilities_hides_meta_by_default`, `pack_draft_shows_description_and_hides_meta_unless_exposed` (`cli-mcp.test.ts`) |
| M8.1 | `maxCaptureCells` defaults to 12, is raised by config up to 48, an over-bound call is refused before any screenshot naming the field, an invalid value stops the server (exit 2) or throws from `createAuthoring()`, and the tool description states the bound | `capture_bound_defaults_to_twelve_and_raised_by_config`, `capture_bound_rejects_invalid_config` (`authoring.test.ts`)<br>`mcp_capture_bound_rejects_invalid_config`, `mcp_capture_bound_defaults_and_configured_description` (`cli-mcp.test.ts`)<br>`capture_bounds_cells_before_screenshots` (`preview-capture.test.ts`)<br>`capture_over_12_cells_is_an_error_naming_the_narrowing_arguments` (`proof/tests/mcp-capture.test.ts`) |
| M9.1 | Geometry is right: a node's box is the union of its wrapper's children, nested `display: contents` wrappers resolve, boxless nodes are zero-sized, an overflowing row is flagged with the crossing ids | `layout_boxes_union_wrapper_children`, `layout_nested_contents_wrappers`, `layout_reports_boxless_nodes`, `layout_flags_overflowing_row` (`proof/tests/capture-layout.test.ts`, real Chromium) |
| M9.2 | Without `layout` results are byte-identical; a backend without `layout` gives `null`; the size bound is `limit-exceeded` naming the cell; `layout` appears in text and structured output; `--layout` writes files | `layout_off_results_unchanged`, `layout_on_writes_a_file_per_cell`, `custom_backend_without_layout_gives_null`, `layout_over_bound_is_limit_exceeded` (`preview-capture.test.ts`)<br>`capture_layout_is_returned_only_when_requested`, `capture_layout_without_backend_support_is_null_and_oversize_names_the_layout` (`authoring.test.ts`)<br>`mcp_capture_layout_in_text_and_structured_content`, `mcp_capture_layout_over_bound_is_limit_exceeded` (`cli-mcp.test.ts`)<br>`layout_files_hold_node_boxes_from_the_real_host`, `cli_layout_flag_writes_layout_files` (`proof/tests/preview-capture.test.ts`) |
| M9.3 | The proof agent loop checks layout structurally (`Inline` buttons share one `y`, `Stack` buttons' `y` increases, no overflow at 360 px) | `scripted_agent_writes_fixes_and_lays_out_a_widget_through_mcp_tools_only` (`proof/tests/mcp-agent-loop.test.ts`) |

## Documentation bullets

| Item | Evidence |
| --- | --- |
| Outsider docs never call a shipped export "planned"; links resolve | `shipped_docs_never_call_exports_planned` (`docs-wording.test.ts`), `docs_links_resolve` (`docs-links.test.ts`) |
| README patch example and the renderer guide's patch example run | `readme_quickstart_runs` (`readme-guide.test.tsx`), `renderer_guide_example_runs` (`renderer-guide.test.tsx`) |
| The MCP guide's config starts and lists the tools | `mcp_guide_config_starts_and_lists_the_tools` (`mcp-guide.test.ts`) |
| CHANGELOG 0.2.1 entry, `docs/adopters-0.2.md` CL-10 to CL-16 map, request status line | Task 15 (read, not tested): `CHANGELOG.md` § 0.2.1, `docs/adopters-0.2.md` § 0.2.1, `clay-0.2.1-requests.md` delivery status |

## Verification runs

Machine: Bun 1.4.4, linux 7.3.0 (AMD Ryzen 9 PRO 7940HS), 2026-11-01 local, load average 3.6 to 4.4 during the runs.

1. **Named tests, one invocation:**

   ```sh
   bun test --conditions liveframe:source -t '<alternation of the 102 name patterns above>' \
     > plans/evidence/021-request-acceptance.log
   # 120 pass, 0 fail, 889 filtered out; 3132 expect() calls; 119 files; 40.2 s
   ```

   Every one of the 102 name patterns has a `(pass)` line in the log, there are no `(fail)` or `(skip)` lines, and `pack_dir_rejects_` selects the whole generated family. The log counts more tests than patterns because `-t` is a substring match: a pattern also selects its siblings and fixture-templated families.

2. **WebKit switching assertions** (CL-16.1), the full two browser files in WebKit 27.2 on this host:

   ```sh
   LIVEFRAME_BROWSER=webkit PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 timeout 300s bun test \
     --conditions liveframe:source src/__tests__/css-scope-browser.test.ts src/__tests__/react-browser.test.tsx \
     > plans/evidence/021-request-acceptance-webkit.log
   # 35 pass, 0 fail; 19.25 s
   ```

   Warm span A, ten samples, ms: CSS fixture (960 nodes) `8 8 8 9 9 9 9 9 10 11`, max 11; Surface fixture (686 nodes) `11 11 11 12 12 12 12 12 14 14`, max 14. Both are within 16.67 ms. Spans B and C are in the log.

3. **Release gate** (installed-archive rows), `timeout 600s bun run release:gate > plans/evidence/021-request-acceptance-gate.log`: **passed all 13 steps in 6.4 s**, including "corpus packed", "hash vectors packed", "patch vectors packed", "validator bundle packed and self-contained", "liveframe mcp over stdio" and "host-API-free subpaths under node".

The three logs are local-only and are not committed. The commands above regenerate them.

## Performance

| Item | Budget | Result |
| --- | --- | --- |
| Patch gzip (CL-15.1) | ≤ 1,024 B median | 228 B ([021-streaming-patches.md](021-streaming-patches.md), Task 12) |
| Patch arrival validation plus React work (CL-15.1) | ≤ 8 ms median | 2.7 ms; it was 9.1 ms before Task 12. Profiler render work 1.3 ms |
| `diffTrees`, `applyPatch` on the 679-node subject | ≤ 1.5 ms, ≤ 0.5 ms median | 0.5185 ms and 0.1015 ms (Task 10, `bench/validator.bench.ts`) |
| Switch span A in WebKit (CL-16.1) | ≤ 16.67 ms, max of 10 warm samples | 11 and 14 ms in this run's [WebKit log](#verification-runs); three consecutive quiet runs in [021-task-14-switching.md](021-task-14-switching.md): CSS 10, 10, 10 and Surface 13, 12, 11 |
| M7 round-trip cost | ≤ +5 ms median | 5.206 → 7.061 ms, +1.855 ms ([script](021-task-14-8-roundtrip.ts), Task 14.8) |
| M8 48-cell capture | recorded | 9,756.6 ms, 4,854,036 PNG bytes, 6,593,153 JSON bytes ([record](021-task-14-9-capture.md)) |
| M9 `layout` cost | ≤ 100 ms per cell | 37.6 ms median over ten cells, max 52.1 ms ([record](021-task-14-10-layout.md)) |

The patch, switching and MCP figures are from the tasks that produced them and were not re-measured here; this task re-ran the assertions that gate them (WebKit, release gate). `bun run bench` is not part of this task; plan 021 Task 19 re-runs it.

## The four laws, re-checked by name

1. **Widget code never runs in the browser.** `validator_bundle_omits_the_render_path` (a validating isolate has no render path), and `pack_dir_joins_arrival_order_before_render` with the `pack_dir_rejects_*` cases (the directory reader packs and refuses without running draft code, as Task 14.6's notes record).
2. **The UI tree is validated data.** `apply_patch_obeys_order_and_ownership` and the corpus `tree-patch/` cases (a patch is validated as a whole tree afterwards), `patched_render_skips_unchanged_nodes_and_preserves_local_state_focus_scroll` (arrival validation still runs on every tree).
3. **Widget code never sets colours or raw CSS.** `style_table_covers_every_fixed_prop_and_bounds` and `generated_types_reject_wrong_props` (`deferOffscreen` takes design values only).
4. **A widget never holds authority.** `check_offered_follows_patched_revision` (the host's dispatch check follows the patched revision), `set_state_applies_offered_event_and_refuses_invalid_origins_and_actions` (an action is refused and never logged).

No test was weakened or added for this task.

## Findings

- **CL-14.1 is open until Task 18.** Its acceptance is a registry fact after publishing, so this record names the checklist and workflow step and leaves the proof to Task 18. No task is added above Task 17 for it.
- **Plan-time test names differ from the real ones** for several tests (for example `apply_patch_rejects_stale_base` is `apply_patch_rejects_stale_base_and_is_all_or_nothing`, `structured_content_matches_text` is `structured_content_matches_text_2025_11_25_and_output_schemas_resolve`, and the `defer_offscreen_rejects_raw_and_undeclared` and `defer_offscreen_responsive` checks live inside `style_table_covers_every_fixed_prop_and_bounds` and `defer_offscreen_projects_content_visibility`). Coverage is complete. Only the titles moved.
- **WebKit is a separate run.** The shared default run is Chromium, so CL-16.1's WebKit proof is the saved WebKit log. The strict max-of-10 gate was met only with the host's VM stopped (Task 14 notes), and CI's shared runners may flake it. That risk is the one Task 14 recorded and is unchanged.

No other bullet is left without evidence, so nothing is deferred.

## Installed release candidate

The installed-package rows (CL-10.1, CL-10.3, CL-11.2, CL-13.1, CL-15.3, M4.2's eight-tool list) are proven here by the release gate on the packed tarball. They are re-run against `@arnilo/liveframe@0.2.1-rc.1` from the registry in Task 17, which adds its section to this file.
