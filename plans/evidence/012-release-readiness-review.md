# Release readiness review for 0.1.0

Reviewed on 2026-10-25 at commit `f253c21`, with the plan 010/011 closing edits uncommitted. The review covered implementation and tests, the public surface, security, cognitive complexity and defects, including the MCP server. Decisions: `decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md` (R1–R20).

**This file is the checklist for the pre-release review** (plan 013, the "Review every readiness item" task). Each item has an id, evidence, and the task that covers it. Before 0.1.0 is published, the review fills the `Pre-release status` column for every row, either:

- `fixed — <test or evidence>`, or
- `deferred — <owner approval quote and backlog entry>`.

No row may stay empty.

## What was run

- `timeout 900 bun run check`: passed. Generation drift, both typechecks, lint (38 warnings, 3 infos), format, and 590 tests across 87 files with 0 failures (261 s, Bun 1.4.4).
- `bun test --coverage src/__tests__` (lines):
  - formats, validate, css, pack, store, preview runners and session: 95–100%;
  - `sdk/render.ts`: 86%;
  - `react/renderer.tsx`: 85% (the rest runs in Chromium);
  - `cli/mcp.ts`, `cli/capture.ts` and `conformance/react/page.tsx` run in subprocesses or the browser, which Bun coverage cannot see.
- `bun run bench`: **failed**.
  - The render workload `core-queue.small` (5 nodes) measured 3.006 µs per node against the ≤ 3 µs gate. Every other workload passed; agent-home measured 1.839 µs per node and 1.2488 ms.
  - The validator gate passed: worst case 1.457 µs per node, against ≤ 1.5.
- `bun audit`: no vulnerabilities in 94 packages. `bun outdated`: only dev patch updates.
- `bun pm pack --dry-run`: 234 files, 142 of them under `src/__tests__/`, 4.11 MB unpacked.
- Probes, a scratch Bun test outside the repo that imports `src/` by absolute path (source in the appendix):
  - P1: a widget's code calls `self.postMessage({ type: "result", result: { ok: true, value: { forged: "<script>" } } })` → `workerRunner().render()` resolved `{"ok":true,"value":{"forged":"<script>"}}`.
  - P2: a widget sets `setInterval(() => self.postMessage(<forged result>), 0)`. 15 of the next 20 renders of *other* packages resolved with the forged value.
  - P3: a manifest state property `{ type: "string", maxLength: 100, pattern: "^(a+)+$" }` with initial state `"a"×n + "!"`. `pack()` took 2/21/79/313 ms at n = 18/22/24/26.
  - P4: `files: { "w.tsx": "await new Promise(() => {});\nexport default () => null;" }`. `pack()` succeeded, and `inProcessRunner().render(pkg, inputs, { timeoutMs: 100 })` was still pending after 1.5 s.
  - P5: `fileStore(dir).putPlacement({ id: "配".repeat(128), … })` threw `ENAMETOOLONG`.
  - P6: a valid placement `good` plus a file `placements/zz.json` containing `{"id":"zz"}`. `loadPlacement(store, "good", …)` returned `invalid-document` at `/slot`.
- Packed-archive consumer: the archive was extracted into a project's `node_modules/@arnilo/liveframe`.
  - `node -e 'import("@arnilo/liveframe")'` (Node 26.11.1) → `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`.
  - `tsc -p .` with `{ strict, module/moduleResolution: NodeNext, skipLibCheck }` → 81 errors, all TS5097 (`.ts` import paths).

## Findings

| Id | Area | Finding and evidence | Covered by | Pre-release status |
| --- | --- | --- | --- | --- |
| B1 | Packaging | The exports point at raw `.ts` with `.ts` relative imports. Node cannot load the package, and default-strictness TypeScript consumers get 81 TS5097 errors. Bundlers would compile the library's `.tsx` with consumer JSX settings. | 013 T1, T2 | fixed — all 14 runtime export paths resolve to compiled `.js`/`.d.ts`; archive/registry gates include strict NodeNext (`skipLibCheck: false`) and six Node imports. Fresh T12 results are below. |
| B2 | Packaging | The archive ships `src/__tests__` (142 of 234 files), including proof-derived catalogs and styles. Backlog: "Exclude test fixtures from the release package". | 013 T1, T2 | fixed — rc.3 registry tarball contains 190 allowlisted files, with no `src/`, `__tests__/`, `proof/` or examples; `archive_contains_only_the_release_files` and `every_export_has_types_and_default` enforce the layout. |
| B3 | Process | No CI (no `.github/`). No `LICENSE`, and spec §15 leaves the license open. | 012 T2 (license); 013 T8 (CI) | fixed — MIT `LICENSE`, spec §15, pinned Bun CI and the rc.3 trusted-publishing run: [40464259877](https://github.com/ashiqrniloy/liveframe/actions/runs/40464259877), including 635 passing tests, archive gate, peer floors and demo gate. |
| B4 | Packaging | `package.json`: `private: true`, `UNLICENSED`, `0.0.0`, no `repository`/`homepage`/`bugs`, no `publishConfig.access: "public"` (scoped packages default to restricted). | 012 T2 (license); 013 T1, T13 | fixed — `package_metadata_is_publishable`, MIT license, public access and repository/homepage/bugs metadata; published rc.3 has provenance and 190 files. The final `0.1.0` version/tag belongs to Task 13, after the recorded go. |
| B5 | Packaging | The peer ranges are narrower than needed: `react`/`react-dom` `^19.3.1`, `playwright` `^1.64.1`, `@modelcontextprotocol/server` exactly `2.4.0`. | 013 T3 | fixed — React/React DOM `^19.0.0`, Playwright `^1.49.0`, MCP server `^2.0.0`; `scripts/release/peer-floors.ts` passed in the rc.3 publishing workflow (T11 evidence). |
| S1 | Security (law 2) | `workerRunner()` accepts any `result` message while a render is pending (`src/preview/worker/index.ts:47-55`) and never re-validates on the host. Requests are not correlated (P1, P2). | 012 T3 | fixed — Result ids correlate with the pending render, stray/wrong/second answers terminate the worker, and every tree is re-validated on the host: `forged_worker_result_is_revalidated_on_the_host`, `unsolicited_result_terminates_the_worker`, `worker_tree_failing_host_validation_is_rejected` (`src/__tests__/runner-worker.test.ts`). Residual (a valid tree for the same manifest) stated in spec §7.5, routed to §14. |
| S2 | Security | Widget-authored `pattern`s run on the host (pack, verify, load, render inputs, intents) and in the browser (arrival `setState` checks). Catastrophic backtracking (P3). `src/schema.ts:209`, `src/validate/schema.ts:52`, `src/formats/manifest.ts:97`, `src/pack/verify.ts:37-43`. | 012 T5 | fixed — Widget `params`/`state`/`context` reject `pattern` at every validator and in the published schema: `manifest_schemas_reject_patterns`; the app's own documents still accept it: `catalog_and_capability_patterns_still_install` (`src/__tests__/manifest.test.ts`). |
| S3 | Security | `liveframe mcp` runs agent-written drafts on the default `workerRunner()` with the user's privileges (`Bun.spawn`, file system, network). The import ban is syntactic only. `docs/mcp.md` does not say so plainly. | 012 T11 (startup warning); 013 T4 (security guide) | fixed — `default_runner_warns_on_stderr`; `docs/security.md` “What is not protected” and `docs/mcp.md` state process permissions, the syntactic import ban and the isolated `config.runner` obligation. The changelog names the sandbox limitation. |
| S4 | Security, robustness | The runner caches are keyed by an unverified `pkg.hash` (`src/preview/load.ts:11`, `src/preview/in-process.ts:35-39`). The module and validator caches are unbounded, and every `pack_draft` adds an unloadable module. | 012 T4 | fixed — A package's hash keys a cache only after `packageHash` matched it, validators are LRU-bounded at 64, and the worker restarts after `maxPackages`: `forged_hash_cannot_reuse_a_loaded_module`, `validator_cache_is_bounded`, `worker_refuses_forged_hash_before_loading`, `worker_recycles_after_max_packages`. |
| S5 | Security (docs) | URL-valued props in app catalogs (`link.href`, `image.src`) need catalog patterns or implementation sanitising. Nothing tells catalog authors. | 013 T4 | fixed — `docs/security.md` “URL-valued props are the catalog's problem” and `docs/formats.md` require catalog patterns or implementation sanitising. |
| D1 | Defect | Top-level `await` is accepted by `pack()` (`src/pack/bundle.ts:163-166,243`) and hangs `inProcessRunner` regardless of `timeoutMs` (P4). | 012 T6 | fixed — Top-level `await`/`for await` is rejected by `pack()` and `verifyPackage()`; module loading is bounded: `top_level_await_is_rejected`, `verify_rejects_linked_top_level_await`, `in_process_load_is_bounded_by_timeout`. |
| D2 | Defect | The `fileStore` file name for a valid 128-code-point id exceeds `NAME_MAX` (`src/store/fs/index.ts:14-22,56`; P5). | 012 T8 | fixed — A 128-code-point id becomes `~<sha256>.json` (65 bytes) and short ids stay readable: `long_ids_are_hashed_into_a_file_name_that_fits` (`src/__tests__/store-file.test.ts`), `keeps_every_valid_id` (suite). |
| D3 | Defect | `loadPlacement` scans and validates every placement. One malformed sibling blocks all loads, and each load is O(n) (`src/store/load.ts:17-21`; P6). | 012 T8 | fixed — `loadPlacement` reads one keyed record and validates its `/id`; a malformed sibling does not block it: `a_malformed_sibling_does_not_block_a_load` (suite), `load_placement_rejections` (`src/__tests__/store-load.test.ts`); 20.86 → 0.77 ms at 1,000 placements. |
| D4 | Defect (MCP) | Concurrent tool calls can bind `config.preview()` twice (`src/cli/mcp.ts:209`), share one capture directory, and repack during a capture. | 012 T11 | fixed — One queue for the stateful tools, one memoized binding, one fresh directory per capture: `concurrent_captures_bind_the_page_once`, `capture_after_pack_sees_that_pack`, `each_capture_uses_a_fresh_directory_and_the_binding_is_freed` (`proof/tests/mcp-capture.test.ts`). |
| D5 | Defect (MCP) | Every capture failure is `limit-exceeded`, including an unknown axis value and a missing Chromium (`src/cli/mcp.ts:341-346`, `src/cli/capture.ts:42-47`). | 012 T11 | fixed — `CaptureError` carries `unknown-name` / `not-found` / `limit-exceeded` and `capture_preview` maps it through: `capture_errors_carry_their_kind`, `unknown_axis_is_unknown_name`, `capture_without_playwright_reports_install_hint`. |
| D6 | Defect (test) | `no-playwright.ts`'s preload never blocks Playwright, so `gen_runs_without_playwright` proves nothing (backlog P4). | 012 T13 | fixed — The preloads use `mock.module` and the proofs fail without them: `gen_runs_without_playwright`, `capture_without_playwright_reports_install_hint`, `gen_runs_without_the_mcp_sdk`. |
| D7 | Defect (test) | The render bench fails on the 5-node `core-queue.small` (3.006 against 3 µs per node), a noise-dominated tiny tree. | 012 T13 | fixed — median of five batches of at least 50 ms in `bench/render.bench.ts`; the old single-sample verdict is gone. Fresh three-run performance results and the idle-host limitation are recorded separately below; this status does not waive a failed release gate. |
| D8 | Defect | (a) Nested non-JSON composed-component props are not rejected (backlog P2, "Reject nested non-JSON composed props"). (b) A dialog that arrives already open in the proof primitives stays under an inert ancestor (plan 010 F1); the demo host reuses those primitives. | (a) 012 T12; (b) 012 T1 disposition, 013 T5 | fixed — (a) `nested_callback_in_composed_props_is_function_prop` and `composed_component_error_paths`; (b) demo `initially_open_dialog_is_dismissable`, covering arrival under the scoped portal, no inert ancestor, Escape and stored closed state (013 T5/T6). |
| A1 | Public surface | `Store` lacks `getPlacement(id)`. Adding it later breaks every implementer. | 012 T8 | fixed — `Store.getPlacement` landed before any external implementer and is required by `storeSuite`: `gets_a_placement_by_id`. |
| A2 | Public surface | Thrown errors are inconsistent: `compileValidator`, `resolveRecipes` and `styleDeclarations` throw `Error(JSON.stringify(errors))`, and stores throw plain objects. | 012 T7 | fixed — Install failures throw one typed error: `install_failures_throw_liveframe_failure` (four throwers), `liveframe_failure_message_is_bounded`, `renderer_error_is_a_value_export`; stores throw `LiveframeFailure` too (`rejects_a_second_hash_with_a_typed_failure`). |
| A3 | Public surface | Internals leak: `CompiledValidator.build` (`@internal`) is in the public type; the root exports `NodeCheck`/`NodeCheckSink`; `RendererError` is a type-only export. | 012 T7 | fixed — `CompiledValidator` exposes only its two members and the aliases are gone: `compiled_validator_has_only_the_two_members`, `root_export_surface`. |
| A4 | Public surface | `PreviewSession = ReturnType<typeof createPreview>` (`src/preview/authoring.ts:6`) makes every implementation detail public. | 012 T7 | fixed — `PreviewSession` is an explicit interface; `createPreview()` is annotated with it: `preview_export_surface` / `subpath_export_surfaces` (`src/__tests__/exports.test.ts`). |
| A5 | Public surface | The runner result-trust contract is unstated (S1). There is no policy for growing `LiveframeError["kind"]`. | 012 T3 (runner); 012 T7 (kinds) | fixed — spec §7.5/§10 and `docs/security.md`/`docs/compatibility.md` state host result validation, residual cross-package risk and open error kinds; S1's regression tests enforce the trust boundary. |
| A6 | Formats | Schema `$id`s and the package `$ref` use `https://liveframe.dev/…`, a domain whose ownership is unconfirmed, and are not format-versioned. | 012 T9 | fixed — Every `$id` is `urn:liveframe:<format>:1`, every cross-document `$ref` uses one, and they resolve offline: `schema_ids_are_format_urns`, `package_schema_resolves_manifest_by_urn_offline` (`src/__tests__/schemas.test.ts`); no `liveframe.dev` remains in `src/`, `schemas/` or `docs/`. |
| A7 | Formats | Naming freeze: British spellings next to DTCG `color*` fields; `liveframe/1` next to `liveframe-*/1`. | Decision R12 (kept); spec unchanged | fixed — accepted R12 keeps British spellings, DTCG field spellings and `liveframe/1`; owner approval: “MIT The rest as you recommended” (release decision log, Approval). No renaming is required. |
| A8 | Agent contract | MCP results: no catalog id; two error shapes (backlog "Give the MCP tools one error shape"); unbounded `render_scenarios` trees (backlog "Bound the tree size"). | 012 T10 | fixed — `list_vocabulary` names the catalog, in-handler argument errors are `LiveframeError[]` with document-root pointers, and the tree is bounded: `list_vocabulary_names_the_catalog`, `argument_errors_are_liveframe_errors`, `all_scenarios_errors_are_deduplicated`, `oversized_tree_is_refused_with_a_typed_error`. |
| T1 | Tests | The composed-component error paths in `render()` are untested (`src/sdk/render.ts:270-361`): a component that throws, returns a promise, returns a non-element, or exceeds the expansion depth; a fragment with extra props; an invalid key; nested child-array depth. | 012 T12 | fixed — Every composed-component and fragment branch is covered with kind, pointer and `nodeId`: `composed_component_error_paths`. |
| T2 | Tests | Nothing tests S1–S4, D1–D5 or an installed archive. | Each covering task; 013 T2 | fixed — S1–S4/D1–D5 regression tests are listed in their rows; `scripts/release/archive-gate.ts` proves the installed runners, timeout recovery, CLI, MCP, browser bundle, strict consumer and Node imports. Fresh results below. |
| T3 | Tests | Suite registration under Vitest/Jest and non-Chromium browsers is untested (plan 010 F2). | Plan 010 T10 disposition (backlog P3) | deferred — owner: “Approve all eight dispositions” (2026-10-25, `010-impact-analysis.md` F2); backlog “Verify conformance registrations in other runners and browsers”. Evidence remains Bun/Chromium. |
| C1 | Complexity | Biome cognitive complexity (rule not enabled). Hot paths: the tree walk 212 (`src/validate/tree.ts:136`), the render `emit` 190 (`src/sdk/render.ts:252`). | 012 T14 | fixed — The rule is enabled at 25 for `src/**` except tests/fixtures; two hot paths carry an ignore citing the bench gate; verified live (a complexity-51 probe fails). |
| C2 | Complexity | Off the hot path: `prepareDesignSystem` 137, `validateTheme` 93, bundle `visit` 84, `validateCatalog` 76, `classifyCatalogChange` 75, intent check 79, `checkValue` 74, manifest source binding 70. | 012 T14 | fixed — All eight named functions and eleven more are below 25 (highest remaining off the hot path: 24). |
| C3 | Duplication | `isRecord`, the JSON-pointer helper and `codePointsWithin` are each written 2–4 times. There are five JSON walkers (`formats/json.ts`, `validate/structure.ts`, `sdk/render.ts` `isJson`, `sdk/intents.ts` `assertJson`, `pack/hash.ts`). | 012 T14 | fixed — `isRecord`, `at` and `codePointsWithin` exist once; the five JSON walkers keep their distinct semantics, each said in one line. |
| P1 | Carry-over | Plan 010 Task 10 is awaiting the owner's disposition of F1–F4. Roadmap Phase 5 is not closed. | 012 T1 | fixed — plan 010 Task 10 closed with the owner's dispositions; `plans/evidence/010-impact-analysis.md` and `plans/backlog.md` record the handoffs; roadmap marks Phase 5 complete. |
| P2 | Carry-over | Plan 002 Task 9 (impact analysis) is open. | 012 T1 | fixed — plan 002 Task 9 closed; `plans/evidence/002-impact-analysis.md` preserves the historical review and owner-approved handoffs; roadmap marks Phase 0 complete. |
| P3 | Carry-over | The plan 011 closing edits (roadmap, backlog, docs/mcp.md, evidence) were uncommitted at review time. | Committed by the owner as `8aa813a` during planning; 012 T1 confirms | fixed — the plan 011 closing files were committed before plan 012, as verified in 012 T1; the original `8aa813a` SHA was subsequently rewritten by the audited T7 history cleanup. |
| P4 | Release gate | G29 needs a Windows machine with a screen reader. | Deferred past 0.1.0 by R20 (owner: "Defer G29 past 0.1.0") | deferred — owner: “Defer G29 past 0.1.0” (accepted R20, release decision log Approval); backlog “Later-phase gaps from the Phase 0 reports” retains the native Windows/assistive-technology audit; `CHANGELOG.md` names the limitation. |
| P5 | Release gate | Phase 6 Done: the demo host persists through `fileStore` and has a preview page; an agent using only the published docs authors, iterates (capture CLI and MCP), publishes and places a widget. | 013 T5, T6, T10, T11 | fixed — persistence and installed conformance in 013 T5/T6; `013-agent-acceptance.md` proves fresh rc.3 docs-only CLI/MCP authoring, eight clean cells per path, matching preview/install hashes, 201/200/200 install/place/surface responses and no action dispatch. The documented timeout adjustment qualifies the loaded-host result. |
| P6 | Release gate (found while planning) | Making the repository public (R16) publishes `proof/references/` (948 KB: Synapta and Clay source and design snapshots; OFL fonts with their licence texts) and the whole git history. No secret scan has been run. | 013 T7 | fixed — `013-repository-audit.md`: owner removed both snapshot directories from all history; gitleaks history and working-tree scans found no credentials; source hashes retained, fonts removed with their licences, ignored evidence/local/graft directories preserved. The audit explicitly retains its Clay-label ownership caveat. |
| N1 | Public types (P2) | `src/schema.ts:25` dropped `Annotations` from the boolean arm of `LanguageSchema` during T14. A consumer's `{ type: "boolean", description: "…", deprecated: false }` fails TS2353; reading `schema.description` on `LanguageSchema` fails TS2339. Runtime validation and spec §5 still permit both annotations. | 013 T12 fresh source sweep | fixed — shipped in rc.4;  `BooleanSchema` restores the annotations; `boolean_schema_annotations_have_public_types`, the focused suite and `tsc --noEmit` pass. rc.3 reproduction: `boolean-annotations.ts`/`.log` under `evidence/013-task-12/`. Exact rc.4 CI, registry and demo verification pass (below). |
| N2 | Installed documentation (P3) | The actual rc.3 README and guides have 14 relative links to excluded examples, roadmap, plans, AGENTS, source tests/fixtures and decision logs (including `docs/compatibility.md:3,7`). The checkout-only `docs_links_resolve` test cannot detect them. | 013 T12 archive review | fixed — shipped in rc.4;  all 14 unshipped targets now link to the public repository; `docs_links_resolve` checks relative targets against both the checkout and packed file list and passes. `installed-links.log` preserves the actual rc.3 failures. Both the packed and registry archives have zero broken relative links (below). |
| N3 | Runner configuration (P3) | The constructor's `workerRunner({ timeoutMs })` default was used for the outer timer but not forwarded to the worker's module evaluation/render. A 5 s constructor setting still returned `Module evaluation exceeded 100 ms`; this was already observed in 013 T5 but had no approved disposition. | 013 T12 targeted probe and caller sweep | fixed — shipped in rc.4;  send the effective constructor/per-render timeout with the request. `worker_constructor_timeout_reaches_render` passes for a 150 ms widget under the constructor's longer limit and still rejects a shorter per-render override; the full worker suite passes in `fixes-focused.log`. Exact rc.4 CI, registry and demo verification pass (below). |
| N4 | Benchmark harness (P2) | After packaging, `bench/render.bench.ts` imports a fixture that obtains the SDK through `dist` while compiling validators from `src`. The two module-private WeakMaps differ, so it throws `LiveframeFailure: Unknown validator` before timing. The first three whole-bench attempts never reached this stage because the validator budget failed first. | 013 T12 standalone render-benchmark probe | fixed — shipped in rc.4;  all three `bench` commands now use the existing `liveframe:source` condition. `render-diagnostic.log` preserves the rc.3 crash; `render-fixed.log` reaches all eight workloads without that crash (performance gates still fail under load). Bun 1.4.2 custom-condition docs were checked through Context7; all three final quiet whole-bench runs pass (below). |

## Not findings (checked)

- The CSS projection escapes installed strings. `cssString` escapes `"`, `\`, control characters and `<` (`src/css/names.ts:8-14`), so sheets are safe inside `<style>`.
- `fileStore` path segments percent-encode everything except `[a-z0-9_-]`, so ids cannot traverse directories.
- The bench's "compiled vs generic 0.6×" compares full validation against a props-only baseline. The equal-work gate is the separate line and passes.
- Dependencies: no known vulnerabilities.

## Pre-release review — 2026-10-27 (plan 013 Task 12)

**Technical review passed. Recommendation: go; owner answered go on 2026-10-27
and Task 12 is closed.** All 42 rows have a disposition: 40 fixed and two
previously approved deferrals (T3 and P4/G29). No new deferral or performance
exception is requested.

### Candidate, scope and fixes

- Verified candidate: `@arnilo/liveframe@0.1.0-rc.4`, tag `v0.1.0-rc.4`, commit
  `fc213f835da928c7f3c1182ea04c40de5779b3b2`. The registry's `next` tag names rc.4;
  `latest` remains rc.1 until Task 13. The archive contains 190 allowlisted files
  and has a `https://slsa.dev/provenance/v1` attestation.
- The review began at local `8735b8d`, whose source, schemas, shipped docs and
  root metadata matched rc.3 (`a62c70a`). The approved history rewrite maps the
  original `f253c21bbfc9edf2a5dc063c9e09bf55dce6ccce` to
  `a48797361473a15cac68a63fee5a898f1b1644b5` (`.git/filter-repo/commit-map`).
  The initial sweep used `git diff a487973 v0.1.0-rc.3 -- src`: all 73 changed
  source/test/fixture paths, including 46 implementation files. The rc.4 delta
  and the callers of `LanguageSchema` and `workerRunner` were reviewed separately.
- **N1:** restore boolean annotations in the public schema union, matching spec
  §5 and the existing runtime validators. The rc.3 consumer reproduced TS2353
  and TS2339; the corrected source and the installed rc.4 declarations accept
  the same consumer.
- **N2:** replace 14 relative links to unshipped repository files with GitHub
  links. Extend `docs_links_resolve` to check the packed file list as well as the
  checkout. Both the local archive and actual registry tarball have zero broken
  relative targets across all 14 shipped Markdown files.
- **N3:** forward the effective constructor/per-render timeout into the worker.
  A 150 ms widget now succeeds with a longer constructor default; a shorter
  per-render override still rejects it. The default remains 100 ms.
- **N4:** run all benchmark commands with the existing `liveframe:source`
  condition. The original command mixed source validators with the compiled
  SDK and threw `Unknown validator` before rendering. The corrected command
  reaches every workload and passes all three quiet runs below.

These fixes restore existing contracts. They add no dependency, export path,
format field, primitive, host authority or change to the spec's meaning.
Install, hash/cache, runner correlation/host validation, preview state,
render/intent/style validation, packaging/portability, MCP queue/capture/lifecycle,
renderer/CSS and conformance paths were included in the sweep. The intended host
model remains a Bun backend with trusted code or an app-supplied isolated runner,
and one writing process for `fileStore`.

### Final verification

Local scripts, metadata, tarballs and full logs are ignored under
`evidence/013-task-12/` (E). No screenshots were generated. Commands below use
explicit timeouts; `run-final.ts`, `quiet-bench.ts`, `surface.ts`, `consumer.ts`
and `installed-links.ts` retain the regeneration steps. Registry consumer
checks run outside this checkout and use the installed package's default exports.

| Check | Result and evidence |
| --- | --- |
| `bun run check` against the exact candidate | Passed in [CI](https://github.com/ashiqrniloy/liveframe/actions/runs/40475279374) and the successful [publishing retry](https://github.com/ashiqrniloy/liveframe/actions/runs/40475472877): build, codegen drift, both typechecks, lint, format and **637 pass, four intentional snapshot skips, zero fail**, 641 tests in 90 files. Publishing retry test time 344.52 s; `ci-rc4.log`, `publish-rc4.log`. |
| Three `timeout 600s bun run bench` runs | **All passed** in a quiet window; validator/render/CSS stages all ran. Hardware, load, durations and every workload are in `bench-quiet-1.log`…`-3.log` and `quiet-bench-results.json`; numbers below. |
| `timeout 900s bun test --conditions liveframe:source --coverage --timeout 60000 src/__tests__` | **511 pass, zero fail**, 95,378 assertions in 102.93 s. Coverage: 95.48% functions, 96.12% lines; schema 100% lines, SDK render 96.59%, worker host 98%, in-process runner 100%, tree validator 94.86%, React renderer 84.71%. Browser/worker/CLI subprocess execution is not fully visible to Bun coverage. `coverage-fixed.log`, compact `coverage-summary.json`. Only the collection harness timeout changed; library deadlines, assertions and performance budgets did not. |
| `timeout 120s bun audit` | No vulnerabilities in 94 packages; `audit.log`. Dependencies did not change in rc.4. |
| Appendix probes P1–P6 | Bounded replay: **six pass, zero fail**, nine assertions, 0.703 s; `probes-retry.log`. P1 rejects the forged result with the pending-id diagnostic; P2 has **zero hijacks / 20**; P3 rejects all four pattern drafts; P4 rejects top-level await; P5 stores/reads the 128-code-point id; P6 loads despite a malformed sibling. `probes.test.ts` is the appendix with assertions added and a 60 s test-harness limit for the replay. |
| Current local archive gate | The quiet CI candidate gate passed all seven steps in **3.8 s** on main and **4.7 s** before publishing. The earlier loaded local attempt failed step 1; it is retained as a failure, not counted as a pass. `ci-rc4.log`, `publish-rc4.log`, `archive-fixed.log`. |
| `timeout 900s bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.1.0-rc.4` | **All seven steps passed in 5.9 s**: both runners and store reload, worker timeout/recovery, gen/check, MCP stdio, browser bundle, strict consumer and Node. `registry-rc4.log`. |
| Installed consumer and Node checks | Separate registry install also passed strict NodeNext with `skipLibCheck: false`, including the formerly failing annotated boolean consumer; browser bundle reached 47 installed modules (712 KB) and no draft marker; Node v26.11.1 called all six host-free entry points. `timeout 300s bun E/consumer.ts @arnilo/liveframe@0.1.0-rc.4`; `consumer-rc4.log`. |
| Frozen exports and declarations | Before the fixes, all 81 declarations matched frozen plan 012 completion `700fe68` after the packaging extension rewrite. After the fixes, **80 remain byte-identical**; the sole `schema.d.ts` delta restores boolean annotations and was reviewed in `schema-public-surface.diff`. All **15 export paths** (14 runtime plus schemas) and pinned runtime-export tests pass. `surface-fixed.log`; no other public API or format change. |
| Fresh-finding regressions | Schema/docs/worker focused run: **24 pass, zero fail**, 741 assertions, 6.76 s; `fixes-focused.log`. Source typecheck and the formerly failing declaration consumer pass (`fixes-typecheck.log`, `boolean-annotations-fixed.log`); the registry consumer independently checks N1. |
| Peer floors | Exact candidate's publishing workflow passed React/React DOM 19.0.0 (**69 tests**), Playwright 1.49.0 (**17 tests**) and MCP server 2.0.0 (**29 tests**); `publish-rc4.log`. |
| Registry contents, documentation and provenance | Actual npm rc.4 tarball has **190 files**, all matching the release allowlist; no source, tests, fixtures, proof or examples. The actual registry tarball has **zero missing relative doc targets**. `rc4-registry-metadata.json`, `rc4-registry-file-list.txt`, `installed-links-rc4.log`, `rc4-dist-tags.json`. |
| Demo from the registry | Installed exact rc.4 in `examples/demo-host`, ran `bun run typecheck` and `bun run test`: **48 pass, zero fail**, 117 assertions in 37.29 s. Persistence/restart, intent rechecks, initially-open dialog, preview CLI/MCP, no draft in browser, no dispatch and installed conformance all pass. `demo-install-rc4.log`, `demo-typecheck-rc4.log`, `demo-tests-rc4.log`. The committed demo dependency now names rc.4. |

Quiet runs used Bun 1.4.4 on Linux 7.3.0-4-cachyos, AMD Ryzen 9 PRO 7940HS,
16 logical CPUs. Each full `bun run bench` ran sequentially with no other
verification workload from this task. The 1-minute load was 2.06–3.85, comparable
to the original plan 012 quiet-host proof. No threshold was changed.

| Quiet run | Worst standalone validator (µs/node; ≤ 1.5) | Worst render (µs/node; ≤ 3) | Agent-home (ms; ≤ 2) | Whole bench (s) | Load before → after |
| --- | --- | --- | --- | --- | --- |
| 1 | 1.397 | 2.253 | 1.2372 | 53.335 | 2.06 → 2.60 |
| 2 | 1.443 | 2.316 | 1.3130 | 55.172 | 2.60 → 3.85 |
| 3 | 1.419 | 2.255 | 1.2895 | 52.123 | 3.85 → 3.68 |

### Earlier failures retained

- At load 45–100 on 16 CPUs, the initial full check passed its static gates but
  reached its 900 s deadline with 78 passes and 18 failures in the partial log.
  TERM did not finish shutdown; the owned process group was force-stopped
  (exit 137). The initial coverage run was force-stopped at 910.481 s with no
  final report. Both are failed/unavailable results (`check.log`, `coverage.log`),
  superseded by the complete green candidate checks and quiet coverage above.
- Initial whole benches failed at the validator gate (worst 80.722 / 20.023 /
  4.849 µs/node), before render/CSS ran. The standalone render probe then exposed
  N4's deterministic module-graph failure. Early corrected-command runs under
  residual load also failed performance; all logs and `results.json` /
  `final-results.json` remain. The three final quiet runs pass every gate.
- The local full-check rerun against the fixes reproduced timing/browser
  failures and was stopped after about eight minutes to use the exact-commit CI
  result; it is not presented as a green local run (`fixes-check.log`).
- Publishing attempt 1 had 636 passes, four skips and one existing browser
  fixture test exceeding its 5 s harness deadline. The independent CI run on the
  same commit passed, and publishing attempt 2 passed without a code/test change
  or bypass (`publish-failure.log`, `ci-rc4.log`, `publish-rc4.log`).
- The initial worker-default diagnostic expected the render-stage wording but
  observed the module-stage **100 ms** error despite a 5 s constructor setting;
  its message assertion failed before its control call. The production regression
  now tests the intended constructor limit and per-render override directly.

The matching rc.3 docs-only agent evidence in `013-agent-acceptance.md` remains
P5's authoring proof. rc.4 changes annotation typing, timeout propagation,
repository links and the benchmark command; it changes no authoring tool,
transport, widget tree, pack hash, intent or install/place contract. The rc.4
registry and demo checks independently re-prove the installed runtime paths.
The known CI demo-helper/dependency mismatch from T10/T11 remains assigned to
Task 13; this review used an explicit rc.4 registry install and all 48 demo tests,
so it does not rely on that older-dependency CI result.

### Owner release decision

**Proposed decision: go on the verified rc.4 baseline, retaining only the two
existing owner-approved deferrals (T3 and P4/G29). Task 13 remains separate.**
The alternative is no-go with named additional work; the completed review found
no remaining new finding requiring that disposition.

**Owner's verbatim answer: go.** On 2026-10-27, asked to verify the WIP Task 12
review, the owner answered: “As far as I can tell, all gates pass and its a go.
Verify it and close Task 12 if my understanding is correct”. The technical review
above passed and the independent re-verification below confirms it. Task 12 is
closed; no final 0.1.0 release has been performed by this task.

### Independent re-verification — 2026-10-27

Re-run by the reviewer on the exact candidate baseline (`fc213f8`), outside the
original evidence logs:

- Registry: `next` = `0.1.0-rc.4`, `latest` = `0.1.0-rc.1`, `gitHead`
  `fc213f835da928c7f3c1182ea04c40de5779b3b2`, `dist.fileCount` 190,
  `dist.attestations.provenance.predicateType` `https://slsa.dev/provenance/v1`.
- CI run [40475279374](https://github.com/ashiqrniloy/liveframe/actions/runs/40475279374)
  and Publish run [40475472877](https://github.com/ashiqrniloy/liveframe/actions/runs/40475472877):
  both `success` on `fc213f8`.
- `timeout 900s bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.1.0-rc.4`:
  all seven steps passed in 4.3 s.
- `examples/demo-host` reinstalled from the registry at rc.4: `bun run typecheck`
  clean; `bun run test` 48 pass, 0 fail, 117 assertions in 33.69 s.
- `bun audit`: no vulnerabilities in 94 packages.
- Status column: all 42 rows filled — 40 `fixed`, two `deferred` (T3, P4/G29).
- `timeout 900s bun run check` on this loaded host (load 9–13): build, codegen,
  both typechecks, lint and format passed; 636 pass, 4 intentional skips, and one
  failure, `set_state_http_round_trip_under_50_ms` (1002.58 ms in the parallel
  run). Re-run alone it passed at 7.16 ms max over 25 local round trips against
  the 50 ms budget, matching the quiet record; this is the same loaded-host
  timing class recorded above, and the exact-commit CI run passed 637/0. No code
  or threshold changed.


## Appendix: probe source

Copy this block to a scratch file outside the repository, set `R` to the checkout's `src` directory, and run `timeout 120 bun test <file>`. After the fixes in plan 012 the probes must report the rejected behaviour (P3 and P4 fail fast; P1, P2, P5 and P6 no longer reproduce).

```ts
import { expect, test } from "bun:test";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const R = "/home/arn/Projects/liveframe/src";
const { validateCatalog, validateCapabilities } = await import(`${R}/index.ts`);
const { packageHash } = await import(`${R}/pack/hash.ts`);
const { pack } = await import(`${R}/pack/index.ts`);
const { workerRunner } = await import(`${R}/preview/worker/index.ts`);
const { inProcessRunner } = await import(`${R}/preview/index.ts`);
const { fileStore } = await import(`${R}/store/fs/index.ts`);
const { memoryStore, loadPlacement } = await import(`${R}/store/index.ts`);
const catalogDoc = await Bun.file(`${R}/__tests__/fixtures/proof/catalog.json`).json();
const capabilitiesDoc = await Bun.file(`${R}/__tests__/fixtures/widgets/capabilities.json`).json();
const { drafts } = await import(`${R}/__tests__/fixtures/widgets/drafts.ts`);
const { proofWidgets } = await import(`${R}/__tests__/fixtures/widgets/index.ts`);

const v = (r: any) => {
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
};
const catalog = v(validateCatalog(catalogDoc));
const capabilities = v(validateCapabilities(capabilitiesDoc));
const options = { catalog, capabilities, surfaceId: "probe", revision: 1 };
const base = v(pack(drafts[0], options));
const inputs = proofWidgets[0].scenarios[0];
const withCode = (code: string) => {
  const pkg = { ...base, code };
  return { ...pkg, hash: packageHash(pkg) };
};
const ok = (text: string) => `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
export default () => __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: ${JSON.stringify(text)} });`;

test("P1 worker: widget forges its own validated result", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  try {
    const forged = `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
export default () => { self.postMessage({ type: "result", result: { ok: true, value: { forged: "<script>" } } });
  return __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: "ok" }); };`;
    const result = await runner.render(withCode(forged), inputs, options);
    console.log("P1", JSON.stringify(result).slice(0, 200));
  } finally {
    runner.close();
  }
});

test("P2 worker: one widget answers later renders of other packages", async () => {
  const runner = workerRunner({ timeoutMs: 2000 });
  try {
    const spy = `import * as __lf_sdk0 from "@arnilo/liveframe/sdk";
setInterval(() => self.postMessage({ type: "result", result: { ok: true, value: { hijacked: true } } }), 0);
export default () => __lf_sdk0.jsx(__lf_sdk0.primitive("text"), { text: "spy" });`;
    await runner.render(withCode(spy), inputs, options);
    let hijacked = 0;
    for (let i = 0; i < 20; i++) {
      const r = await runner.render(withCode(ok(`victim ${i}`)), inputs, options);
      if (r.ok && (r.value as any).hijacked) hijacked++;
    }
    console.log("P2 hijacked renders of other packages:", hijacked, "/ 20");
  } finally {
    runner.close();
  }
});

test("P3 pack: widget manifest pattern is a ReDoS on the host", () => {
  for (const n of [18, 22, 24, 26]) {
    const manifest = structuredClone(drafts[0].manifest);
    manifest.state.properties.evil = { type: "string", maxLength: 100, pattern: "^(a+)+$" };
    manifest.initialState = { ...manifest.initialState, evil: `${"a".repeat(n)}!` };
    const start = performance.now();
    const r = pack({ ...drafts[0], manifest }, options);
    console.log(`P3 n=${n} pack ok=${r.ok} ${(performance.now() - start).toFixed(0)} ms`);
  }
});

test("P4 pack accepts top-level await; inProcessRunner never settles", async () => {
  const files = { "w.tsx": `await new Promise(() => {});\nexport default () => null;` };
  const r = pack({ ...drafts[0], files, entry: "w.tsx" }, options);
  console.log("P4 pack ok:", r.ok);
  if (!r.ok) return;
  const runner = inProcessRunner();
  const outcome = await Promise.race([
    runner.render(r.value, inputs, { ...options, timeoutMs: 100 }).then(() => "settled"),
    Bun.sleep(1500).then(() => "still pending after 1.5 s (timeoutMs 100)"),
  ]);
  console.log("P4", outcome);
});

test("P5 fileStore: a valid 128-code-point placement id", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lf-probe-"));
  const store = fileStore(dir);
  const id = "配".repeat(128);
  try {
    await store.putPlacement({ id, slot: "s", widget: { id: "a", version: "1" }, params: {} });
    console.log("P5 stored");
  } catch (e) {
    console.log("P5", (e as Error).message ?? e);
  }
});

test("P6 one malformed placement blocks loading every placement", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lf-probe-"));
  const store = fileStore(dir);
  await store.putPackage(base);
  await store.putPlacement({ id: "good", slot: "s", widget: { id: base.manifest.id, version: base.manifest.version }, params: inputs.params });
  await mkdir(join(dir, "placements"), { recursive: true });
  await writeFile(join(dir, "placements", "zz.json"), JSON.stringify({ id: "zz" }));
  const r = await loadPlacement(store, "good", { catalog, capabilities });
  console.log("P6 load good ->", JSON.stringify(r).slice(0, 160));
});
```
