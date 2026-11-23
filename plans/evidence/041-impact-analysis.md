# Plan 041 impact analysis — 0.4.1 security hardening

Swept on 2026-11-23 after Tasks 1–11, covering the core, the MCP server, the demo host and the three companion packages (`@arnilo/liveframe-starter`, `-runner-quickjs`, `-a2ui`). "Before" is `547a649` (plan 040 complete, the 0.4.0 source). "After" is the plan's HEAD. The before-and-after benches ran one after another on one host, so both sides shared similar load.

## Twelve impact areas

| Area | Impact and evidence |
|---|---|
| 1. Spec | §7.5 states the fixed widget-exception message and the `debug` opt-in. §7.6 states the step charges for emitted elements, `$use` and sized operators, plus the install-time minimum expansion. §7.7 states the host's handling of unrequested `debug`. §10 states the error field. §13 covers the bounded inline drafts and the handle-based directory reads (Tasks 2–4, 6, 8, 10). Task 9's four fixes restore behaviour the spec already required. Task 11's cache bound is not a spec matter: the spec never stated it. No spec sentence describes behaviour that shipped differently. |
| 2. Public API and formats | `register-0.4.1.json` holds 16 entries, all `added` or `widened`. Three are Task 4's `limits.nodes`, eight are Task 5's corpus files and five are Task 6's `debug` fields. No entry is `removed` or `changed`. The QuickJS runner and A2UI packages changed implementation only: `api-stability.test.ts` passes against their 0.4.0 baselines without a register, so plan 042 needs no `register-0.4.1-runner-quickjs.json` or `-a2ui.json`. Formats keep `liveframe/1`; no published schema under `schemas/` changed. |
| 3. Four laws | See the per-task table below. The plan adds no path where widget code reaches the browser or where colour, raw CSS or authority leaks. LF-21 closes thrown text in host results and events, and F3 closes host text in capture results. F4 lists the channels that remain open for plan 042. |
| 4. Validation | New inputs are validated and fail with typed errors: `limits.nodes` (`invalid_install_node_limit_is_rejected`), inline draft size and nesting (`limit-exceeded` at the input pointer), A2UI indices, pointers and formatted output, and `__proto__` section names. A lone surrogate in source data fails only its own source. `pattern` no longer runs after a length failure, and no corpus case expected both errors at one pointer. |
| 5. Styling | None — no task touched themes, recipes, design systems or CSS projection. |
| 6. Interaction tiers | Task 9 item 4 only: a refused intent leaves the recorded action status alone and skips the render (`crafted_refusal_does_not_overwrite_a_recorded_action_status`). Local and `setState` paths are unchanged. |
| 7. Performance | See the bench table below. The new gates hold: worst operator per step 9.76 ns against 25 ns; hostile templates 5.157 ms against 50 ms (Task 5); the A2UI hostile rows under 1 ms and 256 KiB; and 0 bytes of RSS growth for a 9 MiB draft refusal. Wall-clock gates failed under load 8–15 at both checkouts (F6). Task 11 made a cache hit slower (F5). |
| 8. Portability | The core stays host-API-free: Task 10's file handles live in `src/cli/draft-dir.ts` (CLI), and QuickJS changes stay in its Bun companion. `bun run release:gate` passed. |
| 9. Agent authoring | Agents still read why a draft threw: preview, `/authoring`, MCP and scenario checks request `debug` (`preview_returns_thrown_text_in_debug`, `render_scenarios_returns_tree_or_errors`). New limit errors name the pointer and the bound. MCP capture failures now give a fixed message (F3). |
| 10. Docs and examples | Guides changed with their tasks: templates, host, MCP, packages, preview, SDK, conformance, formats, the A2UI README, and a pointer in the security guide (the wording is plan 042's, LF-65). The CHANGELOG lacked lines for five register entries (F1) and three register reasons were misworded (F2). `bun run demo:test` passed 78 tests; `bun run guide:test` passed. |
| 11. Conformance | Four template corpus cases were added (eight files). No existing file under `conformance/corpus/`, `conformance/hash/` or `conformance/patch/` changed: `git diff --name-status 547a649..HEAD -- conformance` shows additions only. No hash vector changed. |
| 12. Reference hosts | Synapta's 0.4.0 evaluation is the source of every fix here. Plan 042 documents and releases them. Plan 043 owns the 0.5.0 half of LF-26: refusing to start without an explicit runner, its Task 10, which also settles Task 8's finding about where the `workerRunner()` default lives. Clay is unaffected: no styling or renderer change. |

## Laws and boundaries per task

| Task | Law or boundary | Test that rejects a violation |
|---|---|---|
| 2 | Law 2, runner contract (§7.5): template evaluation is bounded in the host process | `fan_out_of_use_stops_at_the_node_limit`, `emitted_elements_and_fragments_spend_steps_and_nodes` (`template-render.test.ts`) |
| 3 | Runner contract: one step bounds time | `sized_operators_spend_steps_in_proportion`, `many_slices_of_a_large_string_exhaust_the_default_budget` (`template-expr.test.ts`) |
| 4 | Law 2 at install | `static_fan_out_over_the_node_limit_is_rejected_at_install` (`template-document.test.ts`), `verify_and_load_use_the_install_node_limit_even_with_a_warm_cache` (`template-package.test.ts`) |
| 5 | Runner contract under the default budget | `hostile_template_set_is_bounded` (`corpus.test.ts`), the four corpus cases, the 50 ms bench gate |
| 6 | Law 4 and the event contract: results and events hold no render inputs | `thrown_widget_text_never_reaches_a_host_event`, `render_placement_drops_unrequested_runner_debug` (`host-render.test.ts`), `quickjs_thrown_text_is_not_returned`, `thrown_name_outside_the_closed_list_is_Error` (`internal.test.ts`), `worker_debug_returns_bounded_thrown_text_only_when_asked` |
| 7 | Law 2 for converter input | `sparse_array_index_is_refused`, `deep_pointer_returns_a_typed_error`, `formatted_output_is_bounded`, `unexpected_conversion_errors_are_typed_and_hide_thrown_text` (`packages/a2ui`) |
| 8 | Authoring boundary (§13) | `oversized_inline_draft_is_refused_before_transpile`, `too_many_draft_files_is_limit_exceeded` (`authoring.test.ts`) |
| 9 | Laws 2 and 4 | `pattern_is_not_run_on_a_string_over_its_length` (`schema.test.ts`), `proto_section_names_are_refused` (`sdk-elements.test.ts`), `crafted_refusal_does_not_overwrite_a_recorded_action_status` (`host-intent.test.ts`), `lone_surrogate_in_source_data_fails_that_source_only` (`host-render.test.ts`) |
| 10 | Authoring boundary (§13) | `hard_link_inside_draft_root_is_refused`, `symlink_swapped_after_the_check_is_not_followed` (`draft-dir.test.ts`), `capture_errors_hold_no_host_text` (`preview-capture.test.ts`) |
| 11 | Law 2: a hit never returns checks compiled from other content | `a_changed_document_never_hits`, `mutating_the_compiled_catalog_never_stales_an_equal_catalog`, `sixty_fifth_pair_evicts_the_least_recently_used` (`validator-smoke.test.ts`) |
| 11b | Authoring boundary (§13) | `capture_failures_hold_no_host_text` (`authoring.test.ts`) |

Bench names plan 042 can cite: `bench/template.bench.ts` (worst operator per step, the hostile-template gate, `validateTemplate.agentHome.cpuMs`), `bench/a2ui.bench.ts` (`sparseIndex`, `formattedText`, `deepPointer`), `bench/authoring.bench.ts` (9 MiB refusal), `bench/validator.bench.ts` (the 64-pair row) and [`041-template-cost.md`](041-template-cost.md).

## Benches before and after

Host: AMD Ryzen 9 PRO 7940HS, 16 logical CPUs, Bun 1.4.5. Load is the one-minute average at the start of each stage. Every wall-clock row is load-sensitive. A row is called a regression only when an interleaved A/B in one process reproduces it.

| Stage | Row | Before (`547a649`) | After (HEAD) |
|---|---|---|---|
| template (load 8.6 / 8.1) | `agent-home` renderTemplate, µs/node (gate 3) | 3.251 (failed) | 3.526 (failed) |
| | `agent-home` steps, first selection | 5,403 (Task 2 note) | 6,964 |
| | worst operator per step (gate 25 ns) | — | 9.76 ns |
| | hostile templates, worst render (gate 50 ms) | — | 5.157 ms (Task 5; this run stopped at the 3 µs gate first) |
| validator (load 8.1 / 10.7) | `agent-home` compiled, µs/node (gate 1.5) | 1.861 (failed) | 1.947 (failed) |
| | `core-queue.full`, µs/node | 1.938 | 2.203 |
| | `compileValidator` reused-catalog hit (gate 0.25 ms) | 0.2335 ms | 0.2581 ms (failed) |
| | `compileValidator` first compile | 1.389 ms | 1.282 ms |
| | 64 cached pairs: hit / miss with the cache full | — | 0.327 / 1.071 ms |
| | bindings, 50 `when`, µs/node (gate 1.75) | 2.358 (failed) | 2.075 (failed) |
| | CPU: compile first / catalog / manifest | 0.882 / 0.542 / 0.025 ms | 1.007 / 0.395 / 0.033 ms |
| host (load 7.9 / 9.3) | pipeline overhead (gate 0.2 ms) | 0.0864 ms | 0.0875 ms |
| | intent pipeline | 0.036 ms | 0.007 ms |
| | `renderPlacement` verified hit, `memoryStore` | 8.04 ms | 7.55 ms |
| | `loadPlacement` verified hit, `memoryStore` | 1.82 ms | 3.85 ms; a rerun at load 13–15 gave 5.17 ms before and 4.89 / 3.99 ms after, so this is noise |
| | `checkPackages` per package | 0.912 ms | 0.875 ms |
| a2ui (load 7.9 / 9.1) | 499 components, 44,003 characters | 2.031 ms | 1.802 ms |
| | sparse index / formatted text / deep pointer | — | 0.044 / 0.118 / 0.037 ms; RSS growth 0 / 256 / 0 KiB |
| runner (load 12.2 / 11.9; base rebuilt for QuickJS) | inProcess `agent-home` median | 2.376 ms | 3.208 ms |
| | worker `agent-home` median | 10.147 ms | 8.471 ms |
| | QuickJS none `agent-home` median (gate 110 ms) | 124.3 ms (failed) | 125.8 ms (failed) |
| | QuickJS package `agent-home` median (gate 50 ms) | 101.0 ms | 51.4 ms; 52.0 ms in the first run at load 9 (failed) |
| | templateRunner `agent-home` median | 3.695 ms | 1.989 ms |
| | inProcess warm CPU overhead (gate 0.1 ms) | −0.002 ms | 0.020 ms |
| authoring | 9 MiB inline draft refusal, median RSS growth (gate 1 MiB) | — | 0 bytes |

Interleaved A/B of a catalog-cache hit (`bench`-style loop, 100 calls per sample, both sides in one process, order alternated), load 8–12:

| Comparison | Hit medians, ms (four runs) |
|---|---|
| `547a649` vs HEAD | 0.267 / 0.286, 0.281 / 0.287, 0.277 / 0.287, 0.247 / 0.273 |
| HEAD with Task 11's `compile.ts` reverted vs HEAD | 0.256 / 0.265, 0.297 / 0.345, 0.282 / 0.301, 0.280 / 0.305 |
| HEAD vs HEAD with a nested `Map` (the plan's API note) | within ±4% of each other |

## Code-quality sweep

- Every register entry now has a CHANGELOG line (Task 11a). Before it, `limits.nodes` on `validateTemplate`, `pack` and `VerifyOptions` and `debug` on `RenderOptions` and `RenderModuleOptions` had none.
- No existing corpus file, hash vector or published schema changed. The eight corpus additions are registered as `added`.
- No register entry uses `removed` or `changed`.

## Findings and dispositions

The owner approved every recommended disposition on 2026-11-23: “Approve all (Recommended)”.

| ID | Finding | Disposition |
|---|---|---|
| F1 | The CHANGELOG had no line for five register entries: `limits.nodes` on `validateTemplate`, `pack` and `VerifyOptions` (Task 4), and `debug` on `RenderOptions` and `RenderModuleOptions` (Task 6). | Executed in Task 11a. |
| F2 | Three register reasons read "Adds optional the debug opt-in". Plan 042 copies register text into the adopter notes. | Executed in Task 11a. |
| F3 | `captureFailure` forwarded the message of any non-`CaptureError` failure, and the no-axes `CaptureError` named the preview URL. Both put host text into MCP and authoring results, the class Task 10 fixed. | Executed in Task 11b. |
| F4 | Structured-error channels remain open: sandboxed and custom runners can return typed errors with any text, and node ids and pointers carry author keys (Task 6 section below). | Backlog P3, [Tell runner-authored errors from library errors in host results](../backlog.md#tell-runner-authored-errors-from-library-errors-in-host-results). Plan 042's checklist names the limits. |
| F5 | Task 11 made a catalog-cache hit 3–16% slower (+0.01 to +0.05 ms). The cause is hashing the ~21 KB catalog key text, which the old `===` scan never did; a nested `Map` costs the same. | Backlog P3, [Key the catalog cache on deep-frozen documents](../backlog.md#key-the-catalog-cache-on-deep-frozen-documents). Task 11's note is corrected. |
| F6 | Wall-clock gates (template 3 µs/node, validator per-node and reused hit, bindings, QuickJS) failed at both checkouts under load 8–15. The template `agent-home` row read 8% higher after, at similar load; Tasks 2–3 add charges, and Task 3 recorded 2.65 µs/node at its time. | Backlog: plan 041's rows are added to [Re-run the full benchmark suite on a quiet host](../backlog.md#re-run-the-full-benchmark-suite-on-a-quiet-host). |
| F7 | Aggregate `bun run check` runs failed under load in Tasks 3, 6, 9, 10 and 11: Playwright "Target page, context or browser has been closed", MCP and browser timeouts. Every affected file passed when rerun on its own. | Backlog: the MCP occurrences are added to [Make `proof/tests/mcp-capture.test.ts` independent of host load](../backlog.md#make-prooftestsmcp-capturetestts-independent-of-host-load), and the browser occurrences to [Re-measure the browser renderer's wall times on a quiet host and make the focus gate load-resistant](../backlog.md#re-measure-the-browser-renderers-wall-times-on-a-quiet-host-and-make-the-focus-gate-load-resistant). |

## Verification

- `timeout 1800 bun run check` passed after Tasks 11a and 11b with 2,182 tests passed, 6 skipped and 0 failed. An earlier run at load ~16 failed only `capture_returns_png_snapshot_and_errors_per_cell` (F7), which passed 10 of 10 on its own.
- The plan's focused tests passed 175 of 175; `packages/a2ui` and `packages/runner-quickjs` passed 80 of 80. `bun run demo:test` passed 78 of 78. `bun run guide:test` and `bun run release:gate` passed. `bench/authoring.bench.ts` passed.
- The five bench stages ran at both checkouts (table above). Wall-clock gates that failed at both checkouts are F6.

## Task 6 · Widget exception diagnostics (LF-21)

Ordinary widget exceptions use a fixed diagnostic by default. The host result and
its `render-failed` event both omit thrown text. The tests
`thrown_widget_text_never_reaches_a_host_event`,
`render_placement_drops_unrequested_runner_debug` and
`quickjs_thrown_text_is_not_returned` cover the host and runner boundaries.
`worker_debug_returns_bounded_thrown_text_only_when_asked`,
`preview_returns_thrown_text_in_debug` and
`render_scenarios_returns_tree_or_errors` cover author diagnostics and their bound.

### Remaining error channels for Plan 042 (LF-65)

- Structured worker and QuickJS failures still cross the boundary. The worker
  checks the shape and the QuickJS runner bounds each text field. This does not
  establish the provenance of the message, pointer, expected text or node ID.
- The host preserves typed errors from custom runners and existing
  `LiveframeFailure` passthroughs. Removing `debug` does not sanitize their other
  fields. Node IDs and pointers can also contain author-chosen keys even when
  validation itself generated the diagnostic.
- Authoring and preview deliberately request `debug` for scenario renders. An
  authoring page or tool can receive render values through that field. Host
  diagnostics expose it only when the caller opts in.
- Host-provided capture diagnostics: Task 10 fixed the Playwright backend's messages, and Task 11b fixed every other backend failure and the no-axes message (F3).
- `authoring.capturePreview()` still returns the message of an error thrown by the config's own `preview()` as `not-found` (`src/authoring/index.ts`, the binding catch). That text is the operator's config, not a widget's, and `authoring_capture_retries_binding_and_maps_backend_errors` pins it. Plan 042's checklist should list it as operator text that reaches an MCP client.
