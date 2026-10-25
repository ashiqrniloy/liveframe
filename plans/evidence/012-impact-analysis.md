# Plan 012 — architectural impact analysis

Reviewed 2026-10-25 against the delivered Tasks 1–14 (commits `cee1f91`…`1a78403`),
the plan's 15 acceptance-criteria blocks, the readiness review
(`plans/evidence/012-release-readiness-review.md`), decision log
`2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md` (R1–R20), and all
twelve impact areas in `.agents/skills/create-plan/references/liveframe.md` §5.

## Impact areas

1. **Spec.** Every contract this plan changed is written in `docs/spec.md`, and
   each clause has a test. §5 gains "Widget schemas carry no `pattern`"
   (`rejectPatterns`, `src/formats/manifest.ts:89`), §7.1 the synchronous-module
   rule and its manifest bullet (`src/pack/bundle.ts:49-60`), §7.3 the `pack()`/
   `verifyPackage()` rejection, §7.4 `Store.getPlacement`, the `fileStore`
   file-name rule and the single-read `loadPlacement`
   (`src/store/index.ts:17`, `src/store/fs/index.ts:35`), §7.5 the
   reference-runner caches and the worker result-trust contract
   (`src/preview/worker/index.ts:28`), §10 `LiveframeFailure` plus the open-kinds
   policy, §11 the `RendererError` throw, §13 the `urn:liveframe:<format>:1` ids,
   `list_vocabulary`'s `{ catalogId, vocabulary }`, `render_scenarios`' two forms
   and its 256 KiB bound, the permissive-argument contract, the MCP startup
   line, the once-only binding, the queue, the per-capture directory and the
   typed capture failures, §15 the license decision. One clause is deliberately
   narrower than the fix it describes: §13 says "only a missing required key or a
   non-object argument still fails before the handler" (finding F1). None further.

2. **Public API and formats.** Root exports `LiveframeFailure` and drops
   `NodeCheck`/`NodeCheckSink` (`src/index.ts:4`); `/react` exports
   `RendererError` as a value extending it (`src/react/index.ts:2`);
   `CompiledValidator` is exactly `{ checkNode, validateTree }` with the build
   facts in a module-private `WeakMap`; `PreviewSession` is an explicit interface
   (`src/preview/authoring.ts:8`); `Store` gained `getPlacement` while no
   external implementer exists; `package.json`'s `license` is `MIT` and nothing
   else in the manifest moved. Formats: the nine `$id`s and the package's
   manifest `$ref` are URNs built by one function (`src/formats/registry.ts:63`),
   the published `manifest.json` is pattern-free while `schema-language.json`,
   `catalog.json`, `capabilities.json` and `widget-package.json` keep the
   keyword, and every published document still matches its source
   (`published_schemas_match_sources`). No new subpath, no new dependency
   (`git diff 8aa813a..HEAD -- package.json` is the license line only).
   `src/__tests__/exports.test.ts` pins both surfaces (13 tests).

3. **The four laws.** Law 1: unchanged and still proven — `preview-agent-loop`'s
   marker scan asserts a draft-only marker never reaches the page or
   `preview-client.js`, and the authoring loop does the same after every capture.
   Law 2: strengthened, not weakened. A worker result is no longer trusted: it
   carries the request id, a stray/wrong/second answer terminates the worker, and
   every tree is re-validated on the host against the request's manifest
   (`forged_worker_result_is_revalidated_on_the_host`,
   `worker_tree_failing_host_validation_is_rejected`). The residual (a hostile
   widget can answer another render with a tree valid for that render's manifest)
   is stated in §7.5 and routed to §14. Law 3: no projection change — the
   pattern ban is validation, and the T14 CSS refactor is behaviour-preserving
   under the design-system conformance suite. Law 4: no store, dispatcher or
   resolver entered the CLI (`mcp_server_imports_no_store`,
   `tools_list_is_exactly_the_authoring_set`), and attached sessions still answer
   405 to draft/publish. Every law-touching task has a regression test that fails
   if its control is removed: T3/T4 (host re-validation, hash-before-load), T5
   (`manifest_schemas_reject_patterns`), T10/T11 (law 4 set, queue, binding), T12
   (`composed_component_error_paths`).

4. **Validation.** `catalog` and `capabilities` are validated on start with exit
   2; a manifest's `params`/`state`/`context` are pattern-free at `validateManifest`,
   `validateManifestShape` and in the published schema; a module cannot suspend
   while it evaluates; runner caches load only a hash that was computed and
   matched; MCP arguments are validated in the handler with the library's own
   validators, so errors carry `kind` and document-root pointers; captured trees
   are bounded at 256 KiB; a store read of a placement is keyed and rejects a
   record whose `/id` disagrees with its key. Gap: the MCP envelope itself (a
   missing required key, a non-object argument) is still rejected with a bare
   string before the handler (F1).

5. **Styling.** None — this plan changed no recipe, token, CSS output or theme
   authority. The T14 work in `src/css/design-system.ts` and
   `src/css/style-props.ts` is a pure refactor (48→10 cognitive complexity, no
   edit to any generated declaration), and the design-system conformance suite
   plus `css_exports_are_pinned` pass unchanged.

6. **Interaction tiers.** Local: unchanged (browser). `setState`: still reachable
   only as `render_scenarios({ state })` and `session.intent()`; no agent intent
   tool was added (backlog P4 from plan 011). Action: bindings are validated
   against the manifest and the capability's args schema and shown/logged by the
   page; nothing dispatches (law 4). Unchanged by this plan — none.

7. **Performance.** Every task recorded its own numbers, and no budget regressed:

   | Task | Measurement | Result |
   | --- | --- | --- |
   | T3 | worker warm render, host re-validation | 5.98 ms/render vs 1.80 direct (4.19 overhead; exceeds the plan's 1 ms target) |
   | T4 | `packageHash` per object; warm render; worker overhead | 2.41 ms median / 3.56 p95 once per ~99 KiB package; 0.012 ms/render in-process; 2.95 ms worker overhead |
   | T5 | `validateManifest` on the plan's ReDoS draft | 24.3 µs median, rejection in 37.3 µs (budget 5 ms) |
   | T6 | `pack()` agent-home | 9.08 ms median / 11.08 p95; `bundle()` 5.44 → 5.27 ms |
   | T7 | render bench | 1.835 → 1.852/1.822 µs/node (no change from the WeakMap) |
   | T8 | `loadPlacement`, 1,000 placements | 20.86 → 0.77 ms median (p95 29.29 → 2.01) |
   | T10 | handler-side argument validation | 0.317 ms median / 0.718 p95 (budget 5 ms) |
   | T11 | stdio round trips | pack 21.4/20.7 vs 20.7/18.2 ms; render 9.7/8.7 vs 10.8/8.5 ms — inside noise |
   | T13/T14 | `bun run bench`, three runs each | render 1.875/1.854/1.823 → 1.774/1.799/1.877 µs/node; `core-queue.small` 2.075/2.180/2.023 → 2.100/2.194/2.213 (gate 3) |

   T3's 4.19 ms worker overhead is the one honest miss: re-validating every
   worker result on the host costs ~2 ms/render against 1.8 ms of render, above
   the plan's 1 ms target for the change. It is the price of law 2 for code that
   runs outside the host's realm, it stays inside the 100 ms default timeout, and
   T4's recycling brought the total to 2.95 ms. No task needed a budget change,
   and `bun run bench` passes every gate in all three whole-plan runs (see
   Verification).

8. **Portability.** `src_is_host_api_free` passes with the new
   `src/formats/registry.ts`, `src/errors.ts` and `src/preview/authoring.ts`
   inside the scan; the only dynamic `import(` named as an exception is still the
   package loader, and the CLI keeps its lazy peers. The peer-blocking proofs are
   now real, not decorative: `gen_runs_without_the_mcp_sdk` and
   `capture_without_playwright_reports_install_hint` both fail if their preload
   is removed (D6). Runtime beyond Bun is still untested, as before.

9. **Agent authoring.** The three plan-011 gaps the plan set out to close are
   closed: `list_vocabulary` returns `catalogId`, so a manifest's id is
   discoverable (`list_vocabulary_names_the_catalog`, and the loop builds every
   manifest from it); in-handler validation gives one `LiveframeError[]` shape
   with document-root pointers (`argument_errors_are_liveframe_errors`); an
   all-scenarios render returns one status per scenario plus each distinct error
   once (`all_scenarios_errors_are_deduplicated`); a tree over 256 KiB is refused
   with its size (`oversized_tree_is_refused_with_a_typed_error`); and captures
   now carry their kind (`capture_errors_carry_their_kind`). Residuals: the
   envelope-level bare string (F1), a dedup key that omits `expected` (F3), and
   no tool returning the bound preview URL, so neither an agent nor its reviewer
   can open what was captured (F5).

10. **Docs and examples.** `docs/mcp.md` (seven tools, both error shapes now one,
    the catalog id, the dedup shape, the 256 KiB rule, the kinds table, the queue,
    the binding, the startup warning, the exit codes) is started verbatim by
    `mcp-guide.test.ts`; `docs/preview.md` states the `CaptureError` contract;
    `docs/packages.md` covers the synchronous rule, hash-before-load, the
    in-process memory limit, `maxPackages` and the long-id naming rule;
    `docs/formats.md` covers the pattern ban, the URNs and the pattern-free
    published schema; `docs/conformance.md`'s store row lists keyed reads, long
    ids and the malformed-sibling case; `docs/renderer.md` and `docs/sdk.md`
    describe `LiveframeFailure`/`RendererError`. The execution skill's references
    were updated in the same commits, and the SDK guide fixture that the docs
    quote is kept in sync by a test (`bun run check` includes it).

11. **Conformance.** `storeSuite` grew from 9 to 13 cases (14 with `reopen`):
    `gets_a_placement_by_id`, `rejects_a_second_hash_with_a_typed_failure` (now
    requiring `LiveframeFailure`), `keeps_every_valid_id` (128 CJK code points,
    emoji, `../escape`, a case-only pair) and
    `a_malformed_sibling_does_not_block_a_load`
    (`src/conformance/store.ts:58,85,250`). That is a contract an adopter's store
    must now satisfy, documented in `docs/conformance.md`. No other suite gained
    a requirement; the code points all three existing suites check still pass
    against the reference stores.

12. **Reference hosts.** Neither prototype is in this repo, and this plan added
    no `AuthoringConfig` field, tool, or host obligation — the changes are inside
    the library and the CLI. The one adopter-facing behaviour is store conformance
    (area 11), which is opt-in through `storeSuite`. None beyond that.

## Readiness status

Every readiness id this plan owns, with the regression test that holds it. The
ids' wording lives in `plans/evidence/012-release-readiness-review.md`; plan 013
copies this table into it.

| ID | Status | Evidence |
| --- | --- | --- |
| S1 | Fixed | Result ids correlate with the pending render, stray/wrong/second answers terminate the worker, and every tree is re-validated on the host: `forged_worker_result_is_revalidated_on_the_host`, `unsolicited_result_terminates_the_worker`, `worker_tree_failing_host_validation_is_rejected` (`src/__tests__/runner-worker.test.ts`). Residual (a valid tree for the same manifest) stated in spec §7.5, routed to §14. |
| S2 | Fixed | Widget `params`/`state`/`context` reject `pattern` at every validator and in the published schema: `manifest_schemas_reject_patterns`; the app's own documents still accept it: `catalog_and_capability_patterns_still_install` (`src/__tests__/manifest.test.ts`). |
| S3 | Fixed (start-up part) | With no `config.runner` the server writes one stderr line naming `workerRunner()` and the process's permissions: `default_runner_warns_on_stderr` (`src/__tests__/cli-mcp.test.ts`); the security guide half is 013 T4. |
| S4 | Fixed | A package's hash keys a cache only after `packageHash` matched it, validators are LRU-bounded at 64, and the worker restarts after `maxPackages`: `forged_hash_cannot_reuse_a_loaded_module`, `validator_cache_is_bounded`, `worker_refuses_forged_hash_before_loading`, `worker_recycles_after_max_packages`. |
| D1 | Fixed | Top-level `await`/`for await` is rejected by `pack()` and `verifyPackage()`; module loading is bounded: `top_level_await_is_rejected`, `verify_rejects_linked_top_level_await`, `in_process_load_is_bounded_by_timeout`. |
| D2 | Fixed | A 128-code-point id becomes `~<sha256>.json` (65 bytes) and short ids stay readable: `long_ids_are_hashed_into_a_file_name_that_fits` (`src/__tests__/store-file.test.ts`), `keeps_every_valid_id` (suite). |
| D3 | Fixed | `loadPlacement` reads one keyed record and validates its `/id`; a malformed sibling does not block it: `a_malformed_sibling_does_not_block_a_load` (suite), `load_placement_rejections` (`src/__tests__/store-load.test.ts`); 20.86 → 0.77 ms at 1,000 placements. |
| D4 | Fixed | One queue for the stateful tools, one memoized binding, one fresh directory per capture: `concurrent_captures_bind_the_page_once`, `capture_after_pack_sees_that_pack`, `each_capture_uses_a_fresh_directory_and_the_binding_is_freed` (`proof/tests/mcp-capture.test.ts`). |
| D5 | Fixed | `CaptureError` carries `unknown-name` / `not-found` / `limit-exceeded` and `capture_preview` maps it through: `capture_errors_carry_their_kind`, `unknown_axis_is_unknown_name`, `capture_without_playwright_reports_install_hint`. |
| D6 | Fixed | The preloads use `mock.module` and the proofs fail without them: `gen_runs_without_playwright`, `capture_without_playwright_reports_install_hint`, `gen_runs_without_the_mcp_sdk`. |
| D7 | Fixed | The render bench takes the median of 5 batches of ≥ 50 ms; three whole-plan runs pass every gate (`core-queue.small` 2.100/2.194/2.213 µs/node against 3). No threshold changed. |
| D8 (a) | Fixed | Nested function/thenable in composed props keeps its kind at the escaped pointer: `nested_callback_in_composed_props_is_function_prop`, `composed_component_error_paths` (`src/__tests__/sdk-render.test.tsx`). |
| A1 | Fixed | `Store.getPlacement` landed before any external implementer and is required by `storeSuite`: `gets_a_placement_by_id`. |
| A2 | Fixed | Install failures throw one typed error: `install_failures_throw_liveframe_failure` (four throwers), `liveframe_failure_message_is_bounded`, `renderer_error_is_a_value_export`; stores throw `LiveframeFailure` too (`rejects_a_second_hash_with_a_typed_failure`). |
| A3 | Fixed | `CompiledValidator` exposes only its two members and the aliases are gone: `compiled_validator_has_only_the_two_members`, `root_export_surface`. |
| A4 | Fixed | `PreviewSession` is an explicit interface; `createPreview()` is annotated with it: `preview_export_surface` / `subpath_export_surfaces` (`src/__tests__/exports.test.ts`). |
| A5 | Fixed | The runner trust contract and the open-kinds policy are in spec §7.5/§10; the controls above encode them. |
| A6 | Fixed | Every `$id` is `urn:liveframe:<format>:1`, every cross-document `$ref` uses one, and they resolve offline: `schema_ids_are_format_urns`, `package_schema_resolves_manifest_by_urn_offline` (`src/__tests__/schemas.test.ts`); no `liveframe.dev` remains in `src/`, `schemas/` or `docs/`. |
| A8 | Fixed | `list_vocabulary` names the catalog, in-handler argument errors are `LiveframeError[]` with document-root pointers, and the tree is bounded: `list_vocabulary_names_the_catalog`, `argument_errors_are_liveframe_errors`, `all_scenarios_errors_are_deduplicated`, `oversized_tree_is_refused_with_a_typed_error`. |
| T1 | Fixed | Every composed-component and fragment branch is covered with kind, pointer and `nodeId`: `composed_component_error_paths`. |
| T2 | Partly fixed | S1–S4 and D1–D5 have tests (above); an installed archive is still 013 T2. |
| C1 | Fixed | The rule is enabled at 25 for `src/**` except tests/fixtures; two hot paths carry an ignore citing the bench gate; verified live (a complexity-51 probe fails). |
| C2 | Fixed | All eight named functions and eleven more are below 25 (highest remaining off the hot path: 24). |
| C3 | Fixed | `isRecord`, `at` and `codePointsWithin` exist once; the five JSON walkers keep their distinct semantics, each said in one line. |
| P1 | Closed | Plan 010 Task 10 (`7f08a49`); Phase 5 Done registrations and law controls pass. |
| P2 | Closed | Plan 002 Task 9 (`e9a760f`); impact report preserved with a current closure review. |
| P3 | Closed | Committed as `8aa813a`; verified in T1. |

Not this plan's: S5 and A7 (decision kept; 013 T4), T3 (deferred by the owner),
P4 (deferred by R20), P5 and P6 (013 T5–T11, T7).

## Findings and candidate sweep

| ID | Finding and evidence | Recommended | Recorded disposition and result |
| --- | --- | --- | --- |
| F1 | The MCP envelope is still rejected by the SDK before any handler when a required key is missing or the argument is not an object, so that one path returns a bare string, not `LiveframeError[]` (`docs/spec.md:729` says so; `argument_errors_are_liveframe_errors` covers only in-handler errors). | backlog | Approved `backlog` 2026-10-25 ("Approve as recommended"). The existing "Give the MCP tools one error shape" entry gained a residual Status line in `plans/backlog.md`; nothing changed in code. |
| F2 | `bun run lint` exits 0 with 40 warnings (`noNonNullAssertion` 31, `noUnusedVariables` 4, `noUnusedImports` 3, `noTemplateCurlyInString` 1, `useDomNodeTextContent` 1) plus 3 infos; only `complexity` is an error, so nothing stops the count growing. | backlog | Approved `backlog` P3 2026-10-25. New entry "Gate the lint warnings, not only complexity" in `plans/backlog.md`; `biome.json` unchanged (complexity stays the only error). |
| F3 | The all-scenarios dedup key is `kind` + `pointer` + `message`, so two errors that differ only in `expected` merge and one expected text is lost (`src/cli/mcp.ts`, `checkAll`). | execute | Approved `execute` 2026-10-25; delivered as Task 14.1 (commit `0461faa`: `checkAll()` keys on `kind`/`pointer`/`message`/`expected`, spec §13 and `docs/mcp.md` say so, and `errors_differing_only_in_expected_are_kept` fails without the extra key and passes with it. |
| F4 | Both peer-blocking preloads use Bun's `mock.module`, so a suite runner change would silently make them decorative again — the exact D6 failure. `src/__tests__/fixtures/no-playwright.ts`, `no-mcp-sdk.ts`. | backlog | Approved `backlog` P3 2026-10-25. A note on "Verify conformance registrations in other runners and browsers" records that a runner change must re-prove both blocked-peer tests. |
| F5 | No tool returns the bound preview URL: `authoring.url()` is internal, so neither the agent nor the human reviewing a capture can open the page (`src/cli/mcp.ts:296-320`). | backlog | Approved `backlog` P4 2026-10-25. New entry "Return the bound preview URL from the authoring MCP server". |
| F6 | `inProcessRunner()`'s module memory grows with every distinct package and has no cap or metric; spec §7.5 and `docs/packages.md` document it, but a long-lived server rendering many drafts grows unbounded. | backlog | Approved `backlog` P4 2026-10-25. New entry "Cap or report the in-process runner's module memory". |
| F7 | The worker path re-validates every result on the host, costing ~2 ms/render against 1.8 ms of render (T3: 4.19 ms overhead), above the plan's 1 ms target for that change; it is the price of law 2 and it is measured, but no budget records it. | backlog | Approved `backlog` P4 2026-10-25. New entry "Record the worker host re-validation cost in a budget" — no code change; the cost is the measured price of law 2. |

## Verification

Whole-plan commands, run 2026-10-25 on `1a78403`, Bun 1.4.4,
`linux 7.3.0-4-cachyos`, AMD Ryzen 9 PRO 7940HS / 16 logical CPUs.

- `timeout 1500s bun run check` — 632 pass, 0 fail, 113068 expect() calls across
  87 files in 258.8 s at load 3.9. Typecheck (both projects), lint, format check
  and the codegen drift check are inside it.
- `timeout 1200s bun run bench`, three runs (exit 0 each):
  - render, agent-home 679 nodes: 1.774 / 1.799 / 1.877 µs/node
    (1.2047 / 1.2214 / 1.2745 ms); `core-queue.small` 2.100 / 2.194 / 2.213 µs/node
    against the 3 µs gate; medium/large/full 1.935/1.965/2.212,
    1.899/1.949/2.203 and 2.212 µs/node.
  - standalone validator: agent-home 1.222 µs/node, compiled 0.79–0.71× of the
    generic props-only baseline.
  - load: 3.1–3.2 (1 min) rising to 5.0 at the end of run 3, 15 min 3.4–3.8.
- `timeout 600s bun test` over the plan's targeted files (runner, store, manifest,
  pack, pack-bundle, cli-mcp, sdk-render, schemas, exports) — 132 pass, 0 fail,
  1133 expect() across 11 files in 10.7 s.
- `timeout 600s bun test proof/tests/mcp- proof/tests/preview-` — 28 pass, 0 fail,
  1813 expect() across 6 files in 96.2 s.
- Readiness probes (the review's appendix, copied outside the repository,
  `timeout 300s bun test /tmp/probe-012.test.ts`) — 6 pass, 0 fail, 0.36 s:
  - probe P1 (S1) forged result → `{"ok":false,"errors":[{"kind":"render-failed",…,"message":"Worker answered a render it was not asked for","expected":"one result for the pending render id"}]}`;
  - probe P2 (S1) hijacked renders of other packages: **0 / 20**;
  - probe P3 (S2) ReDoS manifest: `pack ok=false` in 1 / 0 / 0 / 0 ms for n=18/22/24/26;
  - probe P4 (D1) top-level await: `pack ok: false` (no pending render);
  - probe P5 (D2) 128-code-point id: `stored`;
  - probe P6 (D3) malformed sibling: `load good -> {"ok":true,…}`.
- `timeout 300s graft build` clean; `git diff --check` clean.
