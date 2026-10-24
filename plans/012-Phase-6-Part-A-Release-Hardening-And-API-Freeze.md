# Phase 6 Part A: Release Hardening and API Freeze

## Objectives

- Close every security, defect and public-surface finding in `plans/evidence/012-release-readiness-review.md` that must land before 0.1.0, as decided in `decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md` (R1, R3–R13, R20).
- Freeze the public surface: every export, format field and contract that 0.1.0 publishes is one we can keep through 0.1.x without a breaking change (R15).
- Leave the tree green, with a test that fails if each fix is reverted, so the pre-release review (plan 013) can check each item by test name.

## Expected Outcome

- The tree validates on the host:
  - `workerRunner()` re-validates every result on the host and accepts it only for the pending request id. A forged or unsolicited result terminates the worker.
  - Both reference runners key their caches by verified hashes, and their caches are bounded.
  - The worker recycles itself after a bounded number of distinct packages.
- Widget schemas cannot stall the host:
  - Manifests may not use `pattern` in `params`, `state` or `context`.
  - Widget modules may not use top-level `await`.
  - The in-process runner bounds module loading by `timeoutMs`.
- `Store` has `getPlacement(id)`:
  - `loadPlacement()` reads one placement, so a malformed sibling is irrelevant.
  - `fileStore` stores every valid id.
  - Store rejections are `LiveframeFailure`s.
- One thrown-error type:
  - `LiveframeFailure` (a root export) is thrown by `compileValidator`, `resolveRecipes`, `styleDeclarations` and `createRenderer` (`RendererError` is a value-exported subclass).
  - `CompiledValidator.build`, `NodeCheck` and `NodeCheckSink` leave the public types.
  - `PreviewSession` is an explicit interface.
  - Spec §10 states that error kinds may be added in minor releases.
- Published JSON Schemas use `urn:liveframe:<format>:1` ids.
- `liveframe mcp`:
  - `list_vocabulary` returns the catalog id;
  - every rejected call returns `LiveframeError[]`;
  - `render_scenarios` refuses oversized trees with a typed error;
  - session and page tools are serialized and the page is bound once;
  - capture errors carry correct kinds;
  - the default runner prints a one-line warning to stderr.
- `render()` rejects nested non-JSON composed props, and every composed-component error path has a test.
- The Playwright-free claim is proved. The render bench gives a stable verdict without relaxing any threshold.
- Biome's cognitive-complexity rule is on for `src/`, with a stated reason for every suppression. Duplicate helpers are merged.
- MIT `LICENSE`, and spec §15 closed. Plans 010 and 002 are closed and plan 011's closing edits committed.

This plan implements roadmap Phase 6's hardening and freeze half, under the decision log above. It touches spec §5, §7.1, §7.3–§7.5, §10, §11, §13 and §15; each task updates the sections it changes. It does not build, version or publish the package, write the outsider guides beyond the sections each change touches, build the demo host, or set up CI: those are plan 013, which depends on this plan. G29 is deferred past 0.1.0 (R20). The plan is unusual in one way: its scope is a findings list, so each task names the readiness ids it closes, and the pre-release review in plan 013 checks those ids.

## Tasks

- [x] Task 1: Close the Phase 5 and Phase 0 carry-over gates
  - Acceptance Criteria:
    - Functional:
      - Plan 011's closing edits are already committed (`8aa813a Plan 011 T9`, 2026-10-25), so readiness P3 is closed. The remaining uncommitted work (`plans/010-Phase-5-Conformance-Kit.md`, `plans/evidence/010-impact-analysis.md`, `.agents/skills/liveframe-execution/references/architecture.md`) is committed with plan 010 Task 10 if its diff belongs there, otherwise on its own with a subject naming its plan.
      - Plan 010 Task 10 runs to completion under its own acceptance criteria (readiness P1):
        - The owner disposes F1–F4. The recommended disposition for F1, the dialog that arrives already open, is `backlog` P1 targeted at plan 013 Task 5. The demo host's primitives must fix it; the proof primitives may.
        - The answers are recorded, and roadmap §3 marks Phase 5 complete only if every Done bullet has a passing test.
      - Plan 002 Task 9 runs under its own criteria and the owner's answer is recorded (readiness P2).
    - Performance: n/a — process only.
    - Code Quality: each plan's commit follows its own `Plan NNN T<k>` subject. No production code changes unless an owner `execute` disposition adds a task to that plan.
    - Security: n/a — no code path changes. Plan 010's law mutants must still fail (its Task 10 criterion).
  - Approach:
    - Skills to Use:
      - `create-plan` (final-task procedure of plans 010 and 002);
      - `liveframe-execution` (commit rules).
    - Library Documentation to Check Before Implementation:
      - none — read `plans/010-Phase-5-Conformance-Kit.md` Task 10 and `plans/002-Phase-0-Parity-Re-Proof.md` Task 9.
    - Documentation Reviewed:
      - `git status` at planning time; `git show --stat 8aa813a`.
      - `plans/evidence/010-impact-analysis.md` (F1–F4 with the reproduction of the dialog that arrives already open).
    - Options Considered:
      - Fold plan 010 F1 into this plan as a library fix — rejected: the defect is in the app-owned proof primitives (`proof/renderer/primitives/index.tsx:367–392`), not in `/react`. The library ships no primitives.
    - Chosen Approach:
      - Finish the open plans first, so this plan starts on a clean tree with Phase 5 closed.
    - API Notes and Examples:
      ```sh
      git add plans/010-Phase-5-Conformance-Kit.md plans/evidence/010-impact-analysis.md
      ```
    - Files to Create/Edit:
      - `plans/010-Phase-5-Conformance-Kit.md`; `plans/evidence/010-impact-analysis.md`; `plans/002-Phase-0-Parity-Re-Proof.md`; `plans/evidence/002-impact-analysis.md` (existing; add closure review); `plans/backlog.md`; `roadmap.md` §3.
      - `decision-logs/2026-10-25-0247-phase-0-and-phase-5-carry-over-dispositions.md`: approved dispositions; `plans/evidence/012-release-readiness-review.md`: P1–P3 closure and deferred-finding pointers.
  - Test Cases to Write:
    - None. `timeout 900s bun run check` passes before and after.
  - Notes (executed 2026-10-25):
    - Confirmed plan 011's closing commit `8aa813a`; readiness P3 is closed. Committed the already-approved release planning files as prerequisite `cee1f91` without implementing later tasks.
    - Closed plan 010 Task 10 in `7f08a49`, including its existing impact report and architecture-table correction. Owner approved all F1–F4 as backlog: P1 initially-open dialog required in plan 013 Task 5 (demo primitives must fix it; proof repair optional), P3 runner/browser verification, P2 installed-demo conformance in plan 013 Task 6, and the existing conditional P4 runner suite. Phase 5's Done registrations and law rejection/mutant controls pass.
    - Closed plan 002 Task 9 in `e9a760f`. Its impact report already existed: preserved the twelve-area historical review and ten findings, added a current closure review and mapped four remaining handoffs to existing backlog entries. The owner approved these together with plan 010's findings (“Approve all eight dispositions”); the decision log records the exact priorities and handoffs. Phase 0's go is unchanged.
    - Filled both plans' Compromises Made/Further Actions, updated backlog dispositions and roadmap §3, and recorded readiness P1–P3 evidence. No production code, dependency, public API, normative spec meaning or performance budget changed. Historical parity/bench evidence was retained; images, native audits, other runners/browsers and installed-demo verification were not rerun or claimed.
    - Before and after checks: `timeout 900s bun run check` passed twice (590 tests across 87 files, zero failures each; 251.08s before and 238.56s after; 38 existing lint warnings and 3 informational findings in each). `timeout 10s git diff --check` passed. Task 1 is complete; Task 2 remains next. No new tests were needed for this process-only task.

- [x] Task 2: Adopt the MIT license
  - Acceptance Criteria:
    - Functional:
      - `LICENSE` contains the MIT text with `Copyright (c) 2026 Niloy Rahman`.
      - `package.json` `license` is `"MIT"`.
      - Spec §15 no longer lists the license as open and names MIT with the decision log.
      - The README states the license (readiness B3 license part; B4 license field).
      - `private`, `version` and publish metadata are untouched until plan 013.
    - Performance: n/a.
    - Code Quality: the SPDX identifier is exactly `MIT`.
    - Security: n/a.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none — the SPDX license list entry `MIT`.
    - Documentation Reviewed:
      - Decision R1.
      - `proof/references` font licences: they stay unpublished, because `files` never includes `proof/` (plan 013 Task 1 asserts it).
    - Options Considered:
      - Apache-2.0 — not chosen by the owner (R1).
    - Chosen Approach:
      - The standard MIT text, verbatim.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `LICENSE` (new), `package.json`, `docs/spec.md` §15, `README.md`.
  - Test Cases to Write:
    - `package_license_is_mit` in `src/__tests__/exports.test.ts`: reads `package.json` and `LICENSE` and fails if either drifts.

  - Notes (executed 2026-10-25):
    - `LICENSE` is the standard MIT text, verbatim, with `Copyright (c) 2026 Niloy Rahman`; `package.json`'s `license` changed from `UNLICENSED` to `MIT` and nothing else in it moved (`private: true`, `version 0.0.0`, no `repository`/`homepage`/`bugs`, no `publishConfig`), so the packaging metadata stays plan 013's.
    - Spec §15's single open decision is closed in place: "None. 0.1.0 ships under the MIT license (`decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md`, R1)." The settled-decisions paragraph below it is untouched.
    - `README.md` gained a `## License` section pointing at `LICENSE` (readiness B3's license half and B4's field).
    - `package_license_is_mit` reads both files: it fails if the field is anything but `MIT`, if the holder line or MIT heading drifts, or if the warranty clause is missing. `License` is not in `files` yet — plan 013 Task 1 adds it with the rest of the publish metadata and asserts it in the archive.
    - Evidence B4's row still lists `UNLICENSED`; plan 013's review fills the pre-release status, so it was not edited here.
    - Validation: `bun test src/__tests__/exports.test.ts` 10 pass; `bun run check` 591 tests, 0 failures; `git diff --check` clean.

  - Acceptance Criteria:
    - Functional:
      - `workerRunner()` sends each render with a request id, and resolves only a result carrying the pending id.
      - Any `result` message with no pending render, a wrong id, or a second result for one id terminates the worker. The pending render (if any) gets `render-failed` with `expected` naming an unsolicited worker result.
      - Every successful result is re-validated on the host thread with a `CompiledValidator` built from `{ catalog, capabilities, manifest: pkg.manifest }`, using `validateTree(tree, { limits })` with the request's limits. A failing tree returns those errors, and the worker is recycled.
      - The runner caches the compiled validator by verified hash (Task 4).
      - Spec §7.5 says both reference runners return only host-validated trees. It says an app's runner must re-validate results produced outside the host's realm. It also states the residual risk: one worker serves every package, so a hostile widget can still answer another render with a tree valid for that render's manifest. Hostile code needs the app's isolated runner (R3).
      - `docs/packages.md` and `docs/preview.md` say the same (readiness S1, A5 runner part).
    - Performance:
      - Re-validation costs at most the validator budget (≤ 1.5 µs per node). Record agent-home worker render time before and after in the Notes.
      - `bun run bench` gates are unchanged (the worker is not on the bench path).
    - Code Quality:
      - The protocol stays in `src/preview/worker/protocol.ts`, and validation reuses `compileValidator`.
      - `src/preview/worker/index.ts` stays inside the `Worker/self` host-API exception.
    - Security: law 2. A forged tree, an unsolicited message and a tree that fails validation each fail closed, with a test.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (preview reference);
      - `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - Bun `Worker` (`/oven-sh/bun`, v1.4.x): `postMessage` structured clone, `terminate()`, and the `close` event.
    - Documentation Reviewed:
      - `src/preview/worker/index.ts:12-83`, `src/preview/worker/entry.ts:9-17`, `src/preview/in-process.ts:15-57`.
      - Spec §7.5 and §10.
      - Readiness probes P1 and P2.
    - Options Considered:
      - Correlation ids only — rejected: widget code shares the worker's globals and can hook `onmessage` to learn ids.
      - Restart the worker on every package change — not chosen (R3 alternative 3): latency for every placement switch, while re-validation already keeps law 2.
      - A `MessageChannel` port per request — rejected: the widget can still post on the port the entry script holds, and it adds moving parts without closing the realm-sharing issue.
    - Chosen Approach:
      - Host-side re-validation as the trust anchor. Correlation and termination on stray messages limit cross-request answers to the detectable cases.
    - API Notes and Examples:
      ```ts
      type WorkerMessage =
        | { type: "configure"; catalog: Catalog; capabilities: Capabilities }
        | { type: "render"; id: number; pkg: WidgetPackage; inputs: WidgetProps; options: RenderRequestOptions }
        | { type: "result"; id: number; result: Result<UiTree> };
      ```
    - Files to Create/Edit:
      - `src/preview/worker/index.ts`, `src/preview/worker/protocol.ts`, `src/preview/worker/entry.ts`;
      - `src/__tests__/runner-worker.test.ts`;
      - `docs/spec.md` §7.5, `docs/packages.md`, `docs/preview.md`.
  - Test Cases to Write:
    - `forged_worker_result_is_revalidated_on_the_host`: P1's widget gets a non-ok result. Fails if the host trusts the message.
    - `unsolicited_result_terminates_the_worker`: P2's `setInterval` widget. A following render of another package never resolves with the injected value, and the worker restarts (20 renders, zero hijacks).
    - `worker_tree_failing_host_validation_is_rejected`: a widget that mutates its own emitted props through a getter after validation (a value that differs on clone) yields the host validator's errors.
    - `worker_matches_render` (existing) still passes, proving no change for honest widgets.

- [ ] Task 4: Verify runner cache keys and bound the caches
  - Acceptance Criteria:
    - Functional:
      - `inProcessRunner()` and the worker entry use `pkg.hash` as a module or validator cache key only after `packageHash(pkg) === pkg.hash`, computed once per package object (a `WeakSet` of verified objects).
      - A mismatching package renders `hash-mismatch` and loads nothing.
      - The compiled-validator cache keeps at most 64 hashes per `(catalog, capabilities)`, evicting the least recently used.
      - `workerRunner({ maxPackages? })` (default 64) terminates and restarts its worker once that many distinct hashes have been loaded, since loaded modules cannot be unloaded.
      - The in-process runner documents that its module memory grows with the distinct packages it loads and that hosts with unbounded drafts should use the worker runner (readiness S4).
      - Spec §7.5 records the cache rules, and `docs/packages.md` the option.
    - Performance: hashing runs once per package object. Record the cost for the agent-home package (≈ 1 MiB bound) in the Notes. Warm renders do not hash again.
    - Code Quality:
      - The LRU is a `Map` (insertion order); no dependency.
      - `RunnerOptions` is unchanged. `maxPackages` is a `workerRunner` factory option only, so no `Runner` implementer is affected.
    - Security: a forged hash cannot reuse another package's loaded module or validator. Tested.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none — `src/pack/hash.ts:137` `packageHash`.
    - Documentation Reviewed:
      - `src/preview/load.ts:3-24`, `src/preview/in-process.ts:16-39`.
      - Decision R4.
    - Options Considered:
      - Key the module cache by code string — rejected: it keeps 1 MiB strings as keys and still does not bind the validator to the manifest.
      - Verify in `loadModule` on every call — rejected: it hashes 1 MiB per warm render.
    - Chosen Approach:
      - Verify once per object, then trust the key.
    - API Notes and Examples:
      ```ts
      workerRunner({ timeoutMs: 100, maxPackages: 64 });
      ```
    - Files to Create/Edit:
      - `src/preview/in-process.ts`, `src/preview/load.ts`, `src/preview/worker/index.ts`, `src/preview/worker/entry.ts`;
      - `src/__tests__/runner-in-process.test.ts`, `src/__tests__/runner-worker.test.ts`;
      - `docs/spec.md` §7.5, `docs/packages.md`.
  - Test Cases to Write:
    - `forged_hash_cannot_reuse_a_loaded_module`: a package whose hash names a loaded module but whose code differs returns `hash-mismatch`.
    - `validator_cache_is_bounded`: 65 distinct packages leave at most 64 validators (an internal counter exposed to tests only through the module, not the public API).
    - `worker_recycles_after_max_packages`: with `maxPackages: 2`, the third distinct package triggers a restart (observed via a worker-id marker the test widget returns from `context`) and still renders.

- [ ] Task 5: Forbid patterns in widget-authored schemas
  - Acceptance Criteria:
    - Functional:
      - `validateManifest` and `validateManifestShape` reject `pattern` anywhere inside the `params`, `state` and `context` schemas with `invalid-document`. The pointer is the keyword's location (`/state/properties/evil/pattern`), and `expected` says that widget schemas may not use `pattern` and to use `enum` or an app capability.
      - Catalog and capabilities schemas keep `pattern`.
      - `pack()`, `verifyPackage()` and `loadPlacement()` inherit the rejection before any value is matched.
      - The published `manifest.json` schema uses a pattern-free schema-language variant, so external validators agree. The JSON-Schema-vs-validator agreement test covers it.
      - Fixtures with manifest patterns are updated in the same task.
      - Spec §5 (the schema language) and §7.1 (manifest) state the rule and the reason. `docs/formats.md` documents it (readiness S2).
    - Performance: P3's input fails in < 5 ms, because rejection happens before any match. Validation benches unchanged.
    - Code Quality: one recursive check over the language schema. No change to `isLanguageSchema`, which still serves app documents.
    - Security: laws 2 and 4 stay intact, and a widget author can no longer stall the host or the browser's arrival validator. The P3 regression test fails if patterns are allowed again.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (formats reference);
      - `typescript-advanced-types` if the manifest type narrows `ObjectSchema`.
    - Library Documentation to Check Before Implementation:
      - Ajv 8.20 (`/ajv-validator/ajv`) — how the test harness composes `$defs`, for the pattern-free variant.
    - Documentation Reviewed:
      - `src/formats/manifest.ts:84-187`, `src/formats/registry.ts:36-75`, `src/schema.ts:103-177`.
      - `scripts/schemas.ts`, `src/__tests__/schemas.test.ts`.
      - Readiness P3.
    - Options Considered:
      - A safe-regex heuristic — rejected (R5 alternative 4).
      - Cap `maxLength` when a pattern is present — rejected: about 30 characters already takes seconds.
    - Chosen Approach:
      - Remove the capability from untrusted authors only.
    - API Notes and Examples:
      ```json
      { "kind": "invalid-document", "pointer": "/state/properties/evil/pattern", "expected": "no pattern in widget schemas; use enum or a capability" }
      ```
    - Files to Create/Edit:
      - `src/formats/manifest.ts`, `src/formats/registry.ts`, `schemas/manifest.json` (regenerated), `scripts/schemas.ts` (if needed);
      - `src/__tests__/manifest.test.ts`, `src/__tests__/schemas.test.ts`, `src/__tests__/pack.test.ts`;
      - fixtures under `src/__tests__/fixtures/` and `proof/` (tentative: only if any manifest declares a pattern; find with `graft grep "pattern"`);
      - `docs/spec.md` §5 and §7.1, `docs/formats.md`.
  - Test Cases to Write:
    - `manifest_schemas_reject_patterns`: params, state and context, nested in arrays and objects.
    - `catalog_and_capability_patterns_still_install`.
    - `redos_manifest_fails_fast`: P3 with n = 40 rejects in < 50 ms. Fails if matching happens.
    - `published_manifest_schema_rejects_patterns`: Ajv on `schemas/manifest.json` agrees.

- [ ] Task 6: Forbid top-level await and bound module loading
  - Acceptance Criteria:
    - Functional:
      - `pack()` and `verifyPackage()` reject top-level `await` and `for await` outside functions with `invalid-document` at `/files/<file>/<line>` (or `/code/<line>`), and `expected` "a synchronous module: no top-level await".
      - The bundler's async wrapper is removed.
      - `inProcessRunner()` races module loading against `timeoutMs` and returns `limit-exceeded` instead of never settling. It still cannot interrupt a synchronous loop (documented).
      - Spec §7.1 and §7.3 state the rule. `docs/packages.md` lists it (readiness D1).
    - Performance: no measurable pack-time change. Record the agent-home pack before and after.
    - Code Quality: the check lives in `checkModule` (`src/pack/bundle.ts:42`), so source modules and already-linked packages share one rule.
    - Security: a widget can no longer hold a runner forever through module evaluation. Tested for the in-process runner; the worker runner already terminates.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (storage reference).
    - Library Documentation to Check Before Implementation:
      - Acorn 8.19.0 (`/acornjs/acorn`) — `AwaitExpression` and `ForOfStatement.await` at module top level under `sourceType: "module"`.
    - Documentation Reviewed:
      - `src/pack/bundle.ts:42-72,163-166,243`, `src/preview/in-process.ts:18-56`, `src/preview/load.ts`.
      - Readiness P4.
    - Options Considered:
      - Keep top-level await and only time-bound loading — rejected (R6): it contradicts spec §7.1.
    - Chosen Approach:
      - Reject at pack and verify, and bound loading as a second guard against hand-built packages.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `src/pack/bundle.ts`, `src/preview/in-process.ts`;
      - `src/__tests__/pack-bundle.test.ts`, `src/__tests__/pack.test.ts`, `src/__tests__/runner-in-process.test.ts`;
      - `docs/spec.md` §7.1, §7.3, `docs/packages.md`.
  - Test Cases to Write:
    - `top_level_await_is_rejected`: both forms, with file and line.
    - `verify_rejects_linked_top_level_await`: a hand-built package.
    - `in_process_load_is_bounded_by_timeout`: P4's module, hand-hashed, returns `limit-exceeded` within `timeoutMs + 50 ms`.

- [ ] Task 7: Throw one typed failure and remove internals from the public types
  - Acceptance Criteria:
    - Functional:
      - The root exports `class LiveframeFailure extends Error { readonly errors: readonly LiveframeError[] }`. Its message lists `pointer: message` lines, bounded to 20 errors.
      - `compileValidator`, `resolveRecipes` and `styleDeclarations` throw it instead of `Error(JSON.stringify(…))`. `createRenderer` throws `RendererError`, now a value export that `extends LiveframeFailure`.
      - `CompiledValidator` exposes only `checkNode` and `validateTree`. `render()` reaches the build facts through a module-private `WeakMap` (or symbol) from `src/validate/compile.ts`, invisible in the declarations.
      - The root no longer exports `NodeCheck`/`NodeCheckSink`. `checkNode`'s parameter types are expressed inline or as a named `NodeCheckSink`-free signature documented in `docs/formats.md`.
      - `PreviewSession` is an explicit interface in `src/preview/authoring.ts`, and `createPreview()` is annotated to return it.
      - Spec §10 states that `LiveframeError["kind"]` may gain kinds in minor releases and that consumers must handle unknown kinds. Spec §11 and §13 reflect the export changes.
      - `src/__tests__/exports.test.ts` pins every surface again.
      - Readiness A2, A3, A4, A5 (kinds).
    - Performance: the render path is unchanged (one `WeakMap` lookup per render, not per node). `bun run bench` passes as in Task 13.
    - Code Quality: one error class. Every existing `catch`/`JSON.parse(error.message)` caller is updated (`graft callers compileValidator --depth all`, `graft grep "JSON.parse("`).
    - Security: n/a — no trust boundary moves. Failures stay fail-closed.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`;
      - `typescript-advanced-types` (declaration shape).
    - Library Documentation to Check Before Implementation:
      - TypeScript 7.0.2 `stripInternal` — rejected below; read only to confirm.
    - Documentation Reviewed:
      - `src/validate/compile.ts:39-123`, `src/resolve.ts:69-73`, `src/css/style-props.ts:89-120`, `src/react/renderer.tsx:13-18,85-115`, `src/react/index.ts:2`, `src/index.ts:41-43`, `src/preview/authoring.ts:6`, `src/sdk/render.ts:57`.
    - Options Considered:
      - `stripInternal` on `build` — rejected: the runtime field stays enumerable and reachable, and it hides a member TypeScript consumers could still read.
      - Return `Result` from `compileValidator` — rejected: startup misconfiguration is exceptional, and a `Result` would force every host to unwrap a value that is valid in practice.
    - Chosen Approach:
      - One class carrying the same `LiveframeError[]` the `Result` APIs return.
    - API Notes and Examples:
      ```ts
      try { compileValidator(options) } catch (error) { if (error instanceof LiveframeFailure) report(error.errors); }
      ```
    - Files to Create/Edit:
      - `src/errors.ts`, `src/index.ts`, `src/validate/compile.ts`, `src/sdk/render.ts`, `src/resolve.ts`, `src/css/style-props.ts`;
      - `src/react/renderer.tsx`, `src/react/index.ts`, `src/preview/authoring.ts`, `src/preview/session.ts`;
      - `src/conformance/react/page.tsx` (its `value()` helper);
      - affected tests (`exports`, `index`, `compiled-*`, `react-registry`, `css-*`);
      - `docs/spec.md` §10, §11, §13, `docs/formats.md`, `docs/renderer.md`, `docs/sdk.md`.
  - Test Cases to Write:
    - `install_failures_throw_liveframe_failure`: each of the four throwers.
    - `renderer_error_is_a_value_export`: `instanceof` works from the subpath.
    - `compiled_validator_has_no_build_field`: the keys are exactly `checkNode` and `validateTree`.
    - `root_exports_are_pinned`: fails if `NodeCheck` returns or `LiveframeFailure` disappears.

- [ ] Task 8: Add `Store.getPlacement`, store every valid id, and reject with typed failures
  - Acceptance Criteria:
    - Functional:
      - `Store` gains `getPlacement(id): Promise<Placement | undefined>`, implemented by `memoryStore()` and `fileStore()`.
      - `loadPlacement()` uses it and no longer lists placements, so a malformed sibling record cannot block a load (P6).
      - `fileStore` keeps its percent-encoding for segments whose encoded form is ≤ 200 bytes. A longer segment is stored as `~` + the SHA-256 hex of its UTF-8 bytes (via the internal `sha256`), so every id valid under the record formats is storable (P5). Listing still reads ids from the records.
      - The on-disk layout is documented in `docs/packages.md` as part of the 0.1.x compatibility promise (R15).
      - `putPackage` conflicts reject with `LiveframeFailure` (Task 7).
      - `storeSuite` gains cases for `getPlacement`, a long and a non-ASCII id round trip, and a malformed sibling not blocking a load.
      - Spec §7.4's interface lists the method. Readiness D2, D3, A1.
    - Performance: `loadPlacement` is O(1) store reads. Record the time for 1,000 placements in `fileStore` before and after in the Notes.
    - Code Quality: no new dependency; the hash comes from `src/pack/hash.ts`.
    - Security: the store stays untrusted. Every record read back is validated as before, and tests for tampered records still pass.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (storage reference).
    - Library Documentation to Check Before Implementation:
      - none — `node:fs/promises` behaviour already used.
      - `NAME_MAX` = 255 bytes on ext4, APFS and NTFS (record the figure checked in the Notes).
    - Documentation Reviewed:
      - `src/store/index.ts:13-23`, `src/store/memory.ts`, `src/store/fs/index.ts:14-105`, `src/store/load.ts:10-79`.
      - `src/conformance/store.ts:19-216`.
      - `graft callers loadPlacement`: `phase-2-loop`, `preview-session`, `store-file`, `store-load` tests and `storeSuite`.
      - Hand-built `Store` objects: `src/__tests__/store-load.test.ts:75-118`.
    - Options Considered:
      - Keep the scan but skip invalid siblings — rejected: still O(n), and it silently ignores corruption.
      - Truncate long names — rejected: collisions.
    - Chosen Approach:
      - Add a keyed read to the interface while there are no external implementers.
    - API Notes and Examples:
      ```ts
      interface Store { getPlacement(id: string): Promise<Placement | undefined>; /* … */ }
      ```
    - Files to Create/Edit:
      - `src/store/index.ts`, `src/store/memory.ts`, `src/store/fs/index.ts`, `src/store/load.ts`, `src/conformance/store.ts`;
      - `src/__tests__/store-*.test.ts`, `src/__tests__/conformance-store.test.ts`;
      - `docs/spec.md` §7.4, `docs/packages.md`, `docs/conformance.md`.
  - Test Cases to Write:
    - `malformed_sibling_does_not_block_a_load` (P6).
    - `file_store_keeps_every_valid_id` (P5): 128 CJK code points, emoji, `../`, and case-only differences.
    - `get_placement_round_trips` in `storeSuite`, run against both reference stores.
    - `version_conflict_rejects_with_liveframe_failure`.

- [ ] Task 9: Give the published schemas format-versioned URN ids
  - Acceptance Criteria:
    - Functional:
      - Every published schema's `$id` is `urn:liveframe:<format>:1` (`ui-tree`, `catalog`, `manifest`, …).
      - `widget-package.json` references `urn:liveframe:manifest:1`.
      - The schemas are regenerated, and the drift test covers them.
      - Ajv, with all schemas added, compiles and validates the fixtures without network access.
      - Spec §13 and `docs/formats.md` state the ids and that schemas load from the package. No domain is referenced anywhere (`graft grep "liveframe.dev"` → none) (readiness A6, R11).
    - Performance: n/a.
    - Code Quality: one constant builds ids in `src/formats/registry.ts`.
    - Security: no external fetch can be redirected by a domain owner. Tested by running Ajv with no loader.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (formats).
    - Library Documentation to Check Before Implementation:
      - Ajv 8.20 (`/ajv-validator/ajv`): `addSchema` with URN `$id`s and `$ref` resolution across schemas.
    - Documentation Reviewed:
      - `src/formats/registry.ts:77-83`, `src/formats/package.ts:44`, `scripts/schemas.ts`, `src/__tests__/schemas.test.ts`, `src/cli/mcp.ts:144-173` (it strips `$id` from the manifest schema).
    - Options Considered:
      - A versioned `liveframe.dev` path — rejected: ownership is unconfirmed.
      - An npm CDN URL — rejected: it ties identity to a CDN and a package version, not the format.
    - Chosen Approach:
      - A URN that names the format and its version.
    - API Notes and Examples:
      ```json
      { "$schema": "https://json-schema.org/draft/2020-12/schema", "$id": "urn:liveframe:manifest:1" }
      ```
    - Files to Create/Edit:
      - `src/formats/registry.ts`, `src/formats/package.ts`, `schemas/*.json` (regenerated);
      - `src/__tests__/schemas.test.ts`, `src/__tests__/cli-mcp.test.ts` (schema-embedding pin);
      - `docs/spec.md` §13, `docs/formats.md`.
  - Test Cases to Write:
    - `schema_ids_are_format_urns`.
    - `package_schema_resolves_manifest_by_urn_offline`.
    - The existing drift test regenerates and compares.

- [ ] Task 10: Settle the MCP result shapes before the freeze
  - Acceptance Criteria:
    - Functional:
      - `list_vocabulary` returns `{ catalogId, vocabulary }`.
      - `pack_draft` and `render_scenarios` declare a permissive top-level input schema (object with required keys and documented nested shapes in `description`/`$defs`). They validate inside the handler with `validateManifestShape`, `validateScenario` and `validateJson`, so argument errors return `isError` with `LiveframeError[]` and document-root pointers (`/manifest/id`), never a bare SDK string.
      - The published-schema embedding stays visible in `tools/list` as documentation (`$defs`), and the drift test still pins it.
      - `render_scenarios({ scenario })` refuses a tree whose `JSON.stringify` exceeds 256 KiB with `limit-exceeded`, a pointer `/scenario` and an `expected` naming the size and the limit. The all-scenarios form deduplicates identical errors by `kind`/`pointer`/`message` across scenarios, listing the scenario names that share each.
      - Spec §13 and `docs/mcp.md` describe the shapes. The backlog entries "Give agents the catalog id and one error set", "Give the MCP tools one error shape" and "Bound the tree size render_scenarios returns" are closed with pointers here (readiness A8, R13).
    - Performance: handler-side validation is under 5 ms for the agent-home draft. Record it.
    - Code Quality: the seven tool names are unchanged, and `tools_list_is_exactly_the_authoring_set` still pins them.
    - Security: law 4 is unchanged: no new tool, intent path or store.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (preview);
      - `find-docs`.
    - Library Documentation to Check Before Implementation:
      - `@modelcontextprotocol/server` 2.4.0: `fromJsonSchema` with a permissive schema, and whether `$defs` are preserved in `tools/list`.
    - Documentation Reviewed:
      - `src/cli/mcp.ts:87-276`, `plans/evidence/011-impact-analysis.md` F2, F4, F8, `docs/mcp.md`.
    - Options Considered:
      - Keep both error shapes and document them — rejected (R13): agents special-case one path.
      - Return a node handle instead of large trees — rejected for 0.1.0: it adds a tool or state. A typed refusal is enough.
    - Chosen Approach:
      - One error shape, one id field, one byte budget.
    - API Notes and Examples:
      ```json
      { "isError": true, "content": [{ "type": "text", "text": "[{\"kind\":\"invalid-document\",\"pointer\":\"/manifest/id\",\"expected\":\"a string matching ^[a-z][a-zA-Z0-9.-]*$\",\"message\":\"…\"}]" }] }
      ```
    - Files to Create/Edit:
      - `src/cli/mcp.ts`;
      - `src/__tests__/cli-mcp.test.ts`, `src/__tests__/mcp-guide.test.ts`;
      - `proof/tests/mcp-agent-loop.test.ts` (it reads the catalog id from `list_vocabulary` instead of the literal);
      - `docs/spec.md` §13, `docs/mcp.md`, `plans/backlog.md`.
  - Test Cases to Write:
    - `list_vocabulary_names_the_catalog`.
    - `argument_errors_are_liveframe_errors`: a bad manifest id gives `/manifest/id`. Fails on the bare SDK string.
    - `oversized_tree_is_refused_with_a_typed_error`: a widget emitting more than 256 KiB.
    - `all_scenarios_errors_are_deduplicated`.
    - The agent loop uses the returned `catalogId`.

- [ ] Task 11: Serialize MCP session work, bind the page once, and fix capture error kinds
  - Acceptance Criteria:
    - Functional:
      - `pack_draft`, `render_scenarios` and `capture_preview` run one at a time through a promise queue. The read-only tools stay concurrent.
      - `config.preview()` is called once even under concurrent first captures (a memoized promise). A rejected binding is not cached.
      - Each capture writes to its own fresh subdirectory, removed after its content is read.
      - Capture errors map as follows:
        - an unknown axis value → `unknown-name`;
        - the page never ready or unreachable → `not-found`;
        - Playwright or Chromium missing → `not-found` with the install hint;
        - more than 12 cells → `limit-exceeded`.
      - When no `runner` is configured, the server writes one stderr line at start: drafts run in `workerRunner()` with this process's permissions, and an isolated runner is recommended for untrusted agents.
      - `docs/mcp.md` documents the queue, the warning and the kinds. Readiness D4, D5, S3 (startup part).
    - Performance: no change to single-call latency. Record it.
    - Code Quality: `capture()` throws a small tagged error (`CaptureError` with a `kind`) rather than string matching.
    - Security: law 1 is unchanged. Serialization guarantees a capture shows the draft packed before it.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64.1 (`/microsoft/playwright`): the error class or message for a missing browser executable.
      - MCP SDK 2.4.0: whether handlers may run concurrently over stdio.
    - Documentation Reviewed:
      - `src/cli/mcp.ts:178-351`, `src/cli/capture.ts:32-121`.
    - Options Considered:
      - Serialize every tool — rejected: catalog reads need no ordering.
    - Chosen Approach:
      - One queue for the tools that share state.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `src/cli/mcp.ts`, `src/cli/capture.ts`;
      - `src/__tests__/cli-mcp.test.ts`, `proof/tests/preview-capture.test.ts` (tentative: if capture kinds are asserted there);
      - `docs/mcp.md`, `docs/preview.md`.
  - Test Cases to Write:
    - `concurrent_captures_bind_the_page_once`: a spy `preview()` counts calls under two parallel captures.
    - `capture_after_pack_sees_that_pack`: pack A, then concurrent capture and pack B. The capture shows A.
    - `unknown_axis_is_unknown_name`, `missing_browser_is_not_found` (stubbed loader).
    - `default_runner_warns_on_stderr`; with a configured runner, no warning.

- [ ] Task 12: Reject nested non-JSON composed props and test every composed-component error path
  - Acceptance Criteria:
    - Functional:
      - Before invoking a composed component, `render()` rejects any nested function or thenable in its props (excluding `children`) with `function-prop` or `async-render` at the exact escaped pointer.
      - Primitive props keep their current classifications.
      - Tests cover every composed-component and fragment error branch in `src/sdk/render.ts:270-361`, each asserting kind, pointer and `nodeId`:
        - the expansion-depth limit;
        - a top-level function prop;
        - a component that throws (message truncated at 500 characters);
        - a promise return;
        - a non-element return;
        - an invalid key (empty, more than 128 characters, NaN);
        - a fragment with props;
        - the nested child-array depth limit.
      - `docs/sdk.md` drops the limitation note.
      - The backlog entry "Reject nested non-JSON composed props and improve SDK diagnostics" is closed.
      - Readiness D8a, T1.
    - Performance: the composed-prop walk runs only for composed components, with the depth bound of the input walker. `bun run bench` agent-home ≤ 2 ms, every workload ≤ 3 µs per node. Record before and after.
    - Code Quality: reuse the existing JSON walk (`isJson` or `walkJson`) rather than a sixth walker (C3).
    - Security: spec §7.1's non-JSON prop rule is enforced at every depth.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (SDK).
    - Library Documentation to Check Before Implementation:
      - none — `src/sdk/render.ts`.
    - Documentation Reviewed:
      - `src/sdk/render.ts:100-149,252-361`, `src/__tests__/sdk-render.test.tsx:60-135`, the backlog entry text.
    - Options Considered:
      - Check only after expansion — rejected: discarded values are never seen.
    - Chosen Approach:
      - Walk props once before the call.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `src/sdk/render.ts`, `src/__tests__/sdk-render.test.tsx`, `docs/sdk.md`, `plans/backlog.md`.
  - Test Cases to Write:
    - `nested_callback_in_composed_props_is_function_prop`: the backlog's discarded `{ payload: { callback } }` case.
    - `composed_component_error_paths`: a table of the branches above. Each fails if its branch is removed.

- [ ] Task 13: Prove the Playwright-free claim and stabilise the render bench verdict
  - Acceptance Criteria:
    - Functional:
      - `src/__tests__/fixtures/no-playwright.ts` blocks `playwright` with `mock.module`, like `no-mcp-sdk.ts`.
      - `gen_runs_without_playwright` passes, and a new `capture_without_playwright_reports_install_hint` proves the block works: it fails if the preload is removed.
      - The render bench's per-workload verdict uses the median of at least 5 independent measurement batches, each long enough (≥ 50 ms of samples) that a 5-node workload is not dominated by timer and loop overhead.
      - The thresholds stay ≤ 3 µs per node and ≤ 2 ms. If `core-queue.small` still fails across 3 runs on an idle machine, stop and present the measurements to the owner (the backlog P1 entry forbids relaxing thresholds).
      - The backlog P4 "Make the no-playwright test preload effective" is closed. The P1 "Phase 1 performance gate" entry records the new runs with machine, Bun version and load.
      - Readiness D6, D7.
    - Performance: this is the measurement itself. Record 3 full `bun run bench` runs.
    - Code Quality: the bench harness change is confined to `bench/render.bench.ts` (and a shared helper if one exists).
    - Security: n/a.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`;
      - `investigate-first` if the small workload still fails.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4 `bun:test` `mock.module` (`/oven-sh/bun`).
    - Documentation Reviewed:
      - `src/__tests__/fixtures/no-mcp-sdk.ts`, `src/__tests__/fixtures/no-playwright.ts`, `bench/render.bench.ts`.
      - The backlog entries cited.
    - Options Considered:
      - Exclude tiny trees from the gate — rejected without owner approval: a budget change.
    - Chosen Approach:
      - Better sampling, same budget.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `src/__tests__/fixtures/no-playwright.ts`, `src/__tests__/sdk-gen.test.ts` (or wherever `gen_runs_without_playwright` lives), `bench/render.bench.ts`, `plans/backlog.md`.
  - Test Cases to Write:
    - `capture_without_playwright_reports_install_hint`.
    - The bench is not a unit test. Its Notes record three runs.

- [ ] Task 14: Gate cognitive complexity and merge duplicate helpers
  - Acceptance Criteria:
    - Functional:
      - `biome.json` enables `complexity/noExcessiveCognitiveComplexity` for `src/**` (not tests or fixtures) at a threshold chosen from the current distribution and recorded in the Notes (proposal: 25).
      - Every function above it is either refactored below it or carries `// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <reason>`. Hot-path reasons cite the bench gate: the tree walk (`src/validate/tree.ts:136`) and render `emit` (`src/sdk/render.ts:252`).
      - Refactored below the threshold, with no behaviour change: `prepareDesignSystem`, `validateTheme`, the bundler's `visit`, `validateCatalog`, `classifyCatalogChange`, the intent check, `checkValue`, and manifest source binding.
      - `isRecord`, the JSON-pointer `at` helper and `codePointsWithin` exist once each, and every copy is replaced (`graft grep` shows one definition).
      - JSON walkers with identical semantics are merged. Any that differ in semantics (bounded errors vs throw; byte counting) keep a one-line comment saying why.
      - The 2 fixable library lint warnings (`useImportType`, `useOptionalChain`) are fixed.
      - Readiness C1, C2, C3.
    - Performance: `bun run bench` stays within every gate. Record before and after for agent-home render and validation.
    - Code Quality: refactors are structural only, with no new abstraction layer. Each extracted function has one caller-meaningful name.
    - Security: every validator test, including the law mutants, passes unchanged. No test is edited to make a refactor pass.
  - Approach:
    - Skills to Use:
      - `safe-refactor` (bracket each refactor with the existing tests);
      - `karpathy-guidelines`;
      - `graft` (`callers --depth all` before every move).
    - Library Documentation to Check Before Implementation:
      - Biome 2.6.2 (`/biomejs/biome`): `noExcessiveCognitiveComplexity` options (`maxAllowedComplexity`) and per-path overrides.
    - Documentation Reviewed:
      - The readiness complexity ranking (C1–C2).
      - `src/schema.ts:88-101,179-181`, `src/formats/catalog.ts:87-92`, `src/formats/capabilities.ts:84-89`, `src/validate/schema.ts:32-44`.
    - Options Considered:
      - Refactor the hot paths too — rejected unless the benches prove no regression; the documented exception is the default.
      - No gate, just refactor — rejected: complexity would creep back.
    - Chosen Approach:
      - A gate with explicit, reasoned exceptions.
    - API Notes and Examples:
      ```json
      { "linter": { "rules": { "complexity": { "noExcessiveCognitiveComplexity": { "level": "error", "options": { "maxAllowedComplexity": 25 } } } } } }
      ```
    - Files to Create/Edit:
      - `biome.json`;
      - the functions named above in `src/formats/*.ts`, `src/schema.ts`, `src/resolve.ts`, `src/pack/bundle.ts`, `src/validate/*.ts`, `src/sdk/*.ts`, `src/css/*.ts`, `src/cli/*.ts`, `src/conformance/**`, `src/react/renderer.tsx`, `src/store/load.ts`, `src/preview/*.ts` (tentative: the final list is the rule's output at the chosen threshold).
  - Test Cases to Write:
    - No new behaviour tests. The existing suite is the regression net, and `bun run lint` failing on a new complex function is the gate.

- [ ] Task 15: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/012-impact-analysis.md` sweeps all twelve impact areas against what shipped, recording each one or `None — <reason>`.
      - Every readiness id assigned to this plan has a status line (fixed and the test name) in that file. Plan 013's pre-release review copies these into `plans/evidence/012-release-readiness-review.md`.
      - Every finding is presented to the owner in one table with a recommended disposition, and the answer is recorded. Each `execute` becomes a task above this one. Each `backlog` goes to `plans/backlog.md` and Further Actions.
      - Re-run the readiness probes (appendix of the readiness review). P1, P2, P5 and P6 no longer reproduce, and P3 and P4 fail fast. Record the output.
    - Performance: confirm each task recorded its numbers. `bun run bench` passes.
    - Code Quality: findings name files and spans.
    - Security: confirm each law-touching task has a failing mutant or regression test.
  - Approach:
    - Skills to Use:
      - `create-plan` (final task), `graft`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/evidence/011-impact-analysis.md` (format).
    - Options Considered:
      - n/a — required.
    - Chosen Approach:
      - Sweep, table, dispose.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/012-impact-analysis.md` (new), `plans/backlog.md`, `roadmap.md` §3.
  - Test Cases to Write:
    - None.

## Verification (whole plan)

- `timeout 900s bun run check`
- `timeout 600s bun run bench` (three runs; record all)
- `timeout 300s bun test src/__tests__/runner-worker.test.ts src/__tests__/runner-in-process.test.ts src/__tests__/store- src/__tests__/manifest.test.ts src/__tests__/pack src/__tests__/cli-mcp.test.ts src/__tests__/sdk-render.test.tsx src/__tests__/schemas.test.ts src/__tests__/exports.test.ts`
- `timeout 300s bun test proof/tests/mcp- proof/tests/preview-`
- `timeout 120s bun test <scratch copy of the readiness probes>` (appendix of `plans/evidence/012-release-readiness-review.md`)
- `timeout 120s graft build` and `git diff --check`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
