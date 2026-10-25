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

- [x] Task 3: Re-validate and correlate worker runner results on the host
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

  - Notes (executed 2026-10-25):
    - `protocol.ts` carries `id` on `render` and `result`; `entry.ts` echoes the request's id. `workerRunner()` keeps one `Pending` record with `{ id, validate, resolve }`, so a result is accepted only for the request it answers.
    - `stop()` is the single failure path: it terminates the worker, drops the configuration and settles the pending render. A result with no pending render or a wrong id (which includes a second answer, since ids are unique) goes through it with `render-failed` and `expected: "one result for the pending render id"`; so do a timeout, a worker error and `close()`.
    - Host re-validation compiles the validator from the request's `{ catalog, capabilities, manifest: pkg.manifest }` and calls `validateTree` with the request's `limits`. A tree the host rejects settles with those errors — not `render-failed` — and the worker is terminated so it is not reused. The same recycle happens when the worker itself returns `render-failed`. Compilation is wrapped so a bad manifest cannot leave a render unsettled.
    - `worker_reuses_cloned_configuration_until_identity_changes` no longer counts getter reads: host re-validation reads the catalog on the host, so the old counter measured validation, not cloning. It now spies on `Worker.prototype.postMessage` and counts `configure` messages (one, then still one after a revision-only change and a new hash, then two on a new capabilities identity, three on a new catalog identity), which is what the criterion says.
    - The three new tests carry the fixtures that make each path deterministic: the forged and stray widgets wrap `self.onmessage` while their own module loads, so the *following* render is the one they answer — which is also the realistic attack, since widget code shares the worker's realm. `worker_tree_failing_host_validation_is_rejected` mutates a shared `options` array in a microtask, after the worker's own validator ran and before the clone, so only the host can catch it (`invalid-prop` at `/root/props/options/0/value`).
    - Evidence from the readiness appendix, unchanged: P1 now reports `{"ok":false,"errors":[{"kind":"render-failed","message":"Worker answered a render it was not asked for","expected":"one result for the pending render id"}]}`, and P2 reports `0 / 20` hijacked renders (previously 15 of 20).
    - Performance: warm agent-home render through the worker, 100 iterations after 20 warm-ups — before this task 3.75 ms/render (direct 1.81, overhead 1.94), after 5.98–6.09 ms (direct 1.80–1.89, overhead 4.2). The extra ~2.2 ms is the per-render `compileValidator` plus the re-validation walk; Task 4's verified-hash validator cache is what brings it down. `bun run bench` is not on the worker path and was not touched.
    - Docs: spec §7.5 now says both reference runners return only trees their own validator accepted, names the id rule and the host re-validation, and states the residual risk (one worker serves every package, so hostile code needs the app's isolated runner); `docs/packages.md` and `docs/preview.md` say the same, and the execution skill's preview reference records the rule.
    - Validation: `bun test src/__tests__/runner-worker.test.ts` 11 pass; `bun run check` 594 tests, 0 failures (one earlier run failed a single browser test while an unrelated Rust build held the machine at load 19–53). Two other checks in this session show the same load sensitivity, which is Task 13's bench-verdict problem, not this change.

- [x] Task 4: Verify runner cache keys and bound the caches
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

  - Notes (executed 2026-10-25):
    - New `src/preview/cache.ts` holds the one shared rule set: `verifyPackageHash(pkg)` hashes a package once and remembers it in a `WeakSet` (a throw while hashing counts as a mismatch, so unserialisable content fails closed), and `compiledValidator(options, hash)` keeps the 64 most recently used validators per `(catalog, capabilities)` in a `Map` whose insertion order is the LRU order. `cachedValidatorCount` is exported for the bound test only and is not re-exported by `/preview`, so the pinned public surface is unchanged.
    - `inProcessRunner()` checks the hash before `loadModule`, so a mismatch is `hash-mismatch` at `/hash` — the same error `verifyPackage` returns — with nothing loaded. Its validator now comes from the shared LRU instead of a per-runner `WeakMap`/`Map` chain; identity keys are unchanged, so "replace configuration objects when their contracts change" still holds.
    - `workerRunner({ timeoutMs?, maxPackages? })` verifies on the host before it posts anything, so a forged hash never reaches the worker. It tracks the hashes loaded into the current worker and calls the new `recycle()` (terminate, drop configuration, clear the set) when a new hash would exceed `maxPackages` (default 64); `stop()` and the validation-failure path call the same helper, so every restart starts the set over.
    - **Deviation, deliberate: the worker entry does not hash again.** Its packages arrive by structured clone, so each render is a new object and "once per object" becomes "once per render" — measured at 2.41 ms median per 97 KiB agent-home package, which is why warm worker renders fell to 6.3–7.5 ms (from 4.2 ms in Task 3) while the entry hashed. The render body moved into an internal `renderPackage()` that `inProcessRunner()` wraps with the check; the entry calls it directly and trusts the host, which is the side that verified the package and the only side that can post into the worker's queue (a widget cannot forge a host message). Warm worker renders returned to 2.95 ms, below both earlier numbers. `inProcessRunner()` used directly still verifies once per object, which is the criterion as written for it.
    - The replaced test is the record of the old contract: `in_process_leaves_package_verification_to_host` asserted a bogus hash rendered fine; `forged_hash_cannot_reuse_a_loaded_module` now asserts the opposite, using a package whose code would throw if it were ever loaded under the loaded package's hash. `worker_refuses_forged_hash_before_loading` proves the same on the worker path, where the refusal happens on the host and the worker is never started. `validator_cache_is_bounded` renders 65 packages through a private `(catalog, capabilities)` pair and asserts the count never passes 64 and rests at 64. `worker_recycles_after_max_packages` uses a module-level counter so a fresh worker starts at 1: `1, 2, 1(second package), 3(same worker), 1(third hash restarts), 1(first package again)`.
    - Performance: `packageHash` on the packed agent-home package (99,152 bytes of manifest, code and scenarios) measured 2.41 ms median over 50 runs after 20 warm-ups, p95 3.56 ms, and it runs once per package object. Warm in-process render with an already-verified hash: 0.012 ms/render, unchanged. Worker warm overhead over 100 iterations: 3.75 ms/render before Task 3, 4.2 after Task 3, 2.95 now (direct render 1.86–1.90), so the LRU paid back the re-validation walk and then some.
    - Docs: spec §7.5 gains a "Reference-runner caches" bullet (verified hash, LRU 64, in-process memory growth, `maxPackages` restart); `docs/packages.md` states the hash check and distinguishes it from `verifyPackage`'s document validation, documents `maxPackages`, and warns about in-process module memory; the execution skill's preview reference records the rule.
    - `RunnerOptions` and the `Runner` interface are untouched — `maxPackages` is a `workerRunner` factory option — and no dependency was added.
    - Validation: `bun test src/__tests__/runner-in-process.test.ts src/__tests__/runner-worker.test.ts` 22 pass; `bun run check` 597 tests, 0 failures; `git diff --check` clean.

- [x] Task 5: Forbid patterns in widget-authored schemas
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

  - Notes (executed 2026-10-25):
    - The rule is one recursive walk, `rejectPatterns` in `src/formats/manifest.ts`, over a schema the validator has already accepted: `string` reports `pattern`, `array` descends into `items`, `object` into `properties`. Both `validateManifest` and `validateManifestShape` call it for `params`, `state` and `context` straight after `c.schema(...)`, so the pointer is the keyword's own location (`/state/properties/evil/pattern`) and every install path inherits it before a single value is matched: `pack()` (via `validateManifestShape` in the package format), `verifyPackage()`, `loadPlacement()`, `compileValidator()` and the browser's arrival checks, which all share these two functions. `isLanguageSchema` and `checkValue` are untouched, so app documents keep the full language.
    - `documentChecks().schema()` now returns the schema it accepted (its other callers ignore the value), so the walk only ever sees validated data and no second `isLanguageSchema` pass is needed. `reject()` gained an optional fourth `expected` argument, used here so the error reads `message: "Expected no pattern in widget schemas"` with `expected: "no pattern in widget schemas; use enum or a capability"` — the same shape as the plan's API note.
    - Published schemas: `src/formats/registry.ts` builds its language `$defs` through `languageForms(pattern: boolean)`. Only `manifest.json` takes the pattern-free variant (`word`-for-word the same `oneOf` minus the `pattern` member of the string form); `schema-language.json`, `catalog.json`, `capabilities.json` and `widget-package.json` keep it, and the package schema reaches the manifest by `$ref` to its `$id`, so it inherits the ban. Regeneration touched exactly five lines of `schemas/manifest.json`; `bun scripts/schemas.ts --check` (schema drift) and `Ajv2020` agreement both pass, and `meta_schema_agrees_with_language_forms` still covers the pattern forms for app documents.
    - Fixtures: the proof's own state schemas were the only manifests with patterns (`cursors` used a shared `id` = `{ maxLength: 128, pattern: "^.+$" }`). `proof/widgets/agent-home/manifest.ts` now has a pattern-free `cursor` for the three state `cursors` fields while the action-args schemas keep `id` and the `reason` pattern, because args are declared by capabilities. `proof/scripts/export-formats.ts --out src/__tests__/fixtures/proof` regenerated `agent-home.manifest.json` (three lines removed, everything else byte-identical); `core-queue.manifest.json` is a hand-kept copy of the same manifest, so the same three lines were removed there. `src/__tests__/manifest.test.ts`'s mirrored agent-home contract (the 2 ms budget case) got the same `cursor` split. The widget-package, tree and scenario fixtures are unchanged.
    - Tests: `manifest_schemas_reject_patterns` walks all three keys twice — a direct `evil` property and a nested `deep[].evil` — asserts the exact pointer and `expected` text through `validateManifestShape`, and asserts `validateManifest` rejects the same document; `catalog_and_capability_patterns_still_install` validates a catalog whose `box` prop carries `pattern` and a capabilities action whose args carry one, then installs a manifest against them; `redos_manifest_fails_fast` uses S2's `^(a+)+$` with `"a"×40 + "!"` and asserts rejection in under 50 ms; `published_manifest_schema_rejects_patterns` Ajv-compiles `schemas/manifest.json`, accepts the fixture manifest, rejects the same document with a patterned `params`/`state`/`context`, and accepts a capabilities document that keeps `pattern`. `pack_rejections` gained a ReDoS manifest case asserting `/manifest/state/properties/evil/pattern`, which is the pack-side proof that nothing is matched. (The plan's test list calls this "P3"; the readiness review's id for the finding is S2, and P3 is the uncommitted-closing-edits row.)
    - Performance, medians of 200 runs after 20 warm-ups: `validateManifest` on the proof agent-home manifest 24.3 µs (p95 57.7 µs), the same document with a pattern in `state` rejected in 24.3 µs (p95 154.3 µs) — the 5 ms criterion is met by three orders of magnitude, and the 2 ms budget test still passes; `pack()` of the ReDoS draft rejects in 37.3 µs (p95 84.1 µs). The added walk is linear in the three schemas' size and runs once per validation. `bun run bench` was not rerun: nothing on the bench path changed and the machine was at load 22, which would only report noise (the plan defers bench work to Task 13).
    - Docs: spec §5 gains a "Widget schemas carry no `pattern`" paragraph (why: those schemas match values the app does not author, on both threads; what to use instead) and §7.1's manifest bullet notes the ban; `docs/formats.md` documents it in the Manifest section, next to the three-schema sentence, naming the pointer, the two validators, the pattern-free published schema and the capabilities exception; the execution skill's formats reference records it.
    - No dependency, public export or `Runner`/`RunnerOptions` change; `validateManifestShape` is still internal, imported by the test and by the package format only.
    - Validation: `bun test src/__tests__/manifest.test.ts src/__tests__/pack.test.ts src/__tests__/schemas.test.ts` 21 pass; `bun run check` 601 tests, 0 failures (was 597; the four new tests); `git diff --check` clean.

- [x] Task 6: Forbid top-level await and bound module loading
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

  - Notes (executed 2026-10-26):
    - The rule lives in `checkModule` (`src/pack/bundle.ts`), which already walked the AST with an `insideFunction` flag for the import rule: a top-level `AwaitExpression`, or a `ForOfStatement` with `await`, is now `invalid-document` with `expected: "a synchronous module: no top-level await"` at `/files/<file>/<line>`. Because `pack()` calls it on each module's post-Sucrase source and `verifyPackage()` calls it on `pkg.code` at `/code`, one rule covers source modules, already-linked packages and every hand-built path; no second walk was added. `insideFunction` already treats arrow, function and method bodies as inside, so `async` code there is untouched.
    - The bundler's async wrapper is gone: the `asynchronous` flag, the `await (async` prefix and its `walk` pass were deleted, so every linked module is `(() => { … })()`. No existing fixture or draft used top-level await, so linked bytes, package hashes and stored fixtures are unchanged — `pack_is_reproducible` and every fixture test pass without regeneration.
    - `inProcessRunner()` now bounds module evaluation as well as the render: `loadWithin(code, hash, timeoutMs)` races `loadModule` against a timer that is cleared in `finally`, and expiry returns `limit-exceeded` with `message: "Module evaluation exceeded <n> ms"` instead of a promise that never settles. The elapsed-time check after the render stays (a synchronous loop still cannot be interrupted, and `in_process_reports_slow_render` still covers it). `src/preview/load.ts` exports its `LoadedModule` type for that signature; the module is internal and `/preview` does not re-export it. `workerRunner()` needed nothing: it already terminates on timeout.
    - Tests: `top_level_await_is_rejected` replaces the old `preserves_top_level_await_and_module_hashbangs` (which asserted the opposite) and covers both forms with the exact pointer per line — `await` on line 1, `for await` on line 2 — plus the control that `async` code inside a function still links and runs; `preserves_module_hashbangs` keeps the hashbang half of the replaced test. `verify_rejects_linked_top_level_await` builds a package whose linked code starts with a pending `await`, recomputes the hash so only the code rule can reject it, and asserts `/code/1`. `in_process_load_is_bounded_by_timeout` uses P4's `await new Promise(() => {}); export default () => null;`, hand-hashed through the same `withCode` helper, and asserts `limit-exceeded` inside `timeoutMs + 50 ms` (measured 105.5 ms for a 100 ms deadline).
    - Docs: spec §7.1's synchronous-bullet now says a module may not suspend while it evaluates, §7.3's `pack()` list gains the rejection and `verifyPackage()`'s rule sentence covers it, `docs/packages.md` states it in the import-rules section (pointer shape, both check points, and that `async` inside functions is ordinary code) and notes the load race in the runner section. The execution skill's preview reference gained the load bound and had a Task-4 leftover corrected: it still claimed the reference runners do not verify packages.
    - Performance: `pack()` of the agent-home fixture measured a 9.08 ms median and 11.08 ms p95 over 25 runs at load 3, and `bundle()` 5.44 ms before the rule against 5.27 ms with it (same round, medians of 25) — no measurable change, as expected from one extra boolean test per node in a walk that already visited every node. An interleaved CPU-time comparison taken earlier, while an unrelated Rust/C++ build held the machine at load 40–60, also agreed within noise (13.36 before, 12.88 ms CPU per bundle), which is why wall-clock numbers from that window were discarded.
    - That load also produced one red `bun run check` (an MCP capture test hit the client's request timeout after 99 s; 900 s exhausted) with no code change in between; the rerun at load 3 was green. Nothing in this task touches capture.
    - No dependency added (Acorn was already a dependency and is already parsed here) and no public export changed.
    - Validation: `bun test src/__tests__/pack.test.ts src/__tests__/pack-bundle.test.ts src/__tests__/runner-in-process.test.ts src/__tests__/runner-worker.test.ts src/__tests__/preview-load.test.ts src/__tests__/phase-2-loop.test.ts` 62 pass; `bun run check` 604 tests, 0 failures (was 601; `top_level_await_is_rejected` replaced a test and two net new ones, plus `preserves_module_hashbangs` was split out); `git diff --check` clean.

- [x] Task 7: Throw one typed failure and remove internals from the public types
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

  - Notes (executed 2026-10-26):
    - One class: `LiveframeFailure` in `src/errors.ts` extends `Error`, keeps `errors` (sliced to `DEFAULT_MAX_ERRORS`) and builds `message` as one `pointer: message` line per kept error, so it cannot grow past 20 lines. It is exported from the root; `src/index.ts` only needed one changed line for it.
    - Throwers: `compileValidator`'s three install paths (catalog, capabilities, manifest) and `resolveRecipes` now throw it with the `Result` errors they already computed. `styleDeclarations` needed a small `reportedStyle()` helper: it collects the per-value check errors (it previously discarded them), prefixes them with `/style/<prop>`, and emits `Undeclared style prop: <prop>` when the prop has no compiled check at all — so the failure names the property, not just the value. `RendererError` now extends `LiveframeFailure` and is a runtime export of `/react`; `createRenderer` is unchanged apart from the message its parent builds.
    - `CompiledValidator` has exactly `checkNode` and `validateTree`. The facts moved behind a module-private `WeakMap` in `src/validate/compile.ts` with `buildFacts(validator)` for `render()`; `src/sdk/render.ts` calls it twice per render (tree build and the inputs check), never per node. `CompiledBuild` and `KindFacts` stay exported from that module for `render()`'s types, but the root does not re-export them, so no new public name appeared. The old `build` field's only readers were those two call sites plus one test, which now asserts the two-member shape instead.
    - Root surface: `NodeCheck`/`NodeCheckSink` are gone. `checkNode`'s signature stays usable without them — `exported.test.ts` spells the sink as `Parameters<CompiledValidator["checkNode"]>[2]` and `docs/formats.md` documents the sink shape inline. That is the "no `NodeCheckSink` signature" clause: the type is still structurally public through the method, but the root no longer names it.
    - `PreviewSession` is a written-out interface in `src/preview/authoring.ts` (`update`, `render`, `intent`, `intents`, `check`), and `createPreview()` is annotated `: PreviewSession`. `authoring.ts` no longer imports `createPreview`, so the type no longer exposes implementation internals and the import now runs one way (`session.ts` → `authoring.ts`); `src/cli/mcp.ts` was already written against the names and needed nothing.
    - Docs: spec §10 now states that install-time APIs throw `LiveframeFailure` and that `kind` is open (minor releases may add kinds; a consumer must handle an unknown kind; removing or redefining one is a major change), §11 documents `RendererError` as a `LiveframeFailure` subclass, §13 lists `LiveframeFailure` in the root row. `docs/formats.md` replaces the `NodeCheck`/`NodeCheckSink` sentence with the two-member validator, the `WeakMap`, and a `try`/`instanceof LiveframeFailure` guide; `docs/renderer.md` corrects the claim that `RendererError` is type-only; the execution skill's formats reference matches.
    - Internal callers that wrapped errors: the conformance `value()` helpers (`src/conformance/fixture.ts`, `src/conformance/react/page.tsx`) and the `docs/sdk.md` example now throw `LiveframeFailure`; the example is mirrored verbatim by `src/__tests__/fixtures/sdk-guide.tsx`, so both changed together and `sdk-guide.test.ts` still proves the snippet. No `catch` site parsed a thrown message: `grep -rn "JSON.parse("` shows only document/attribute parsing and `JSON.parse(JSON.stringify(...))` deep copies. `graft grep "JSON.parse("` rejects a literal `(` as a bad regex, so the exhaustive check was raw grep.
    - Tests: `exports.test.ts` gains `renderer_error_is_a_value_export` (registry failure is a `RendererError`, a `LiveframeFailure`, an `Error`, with 20 bounded `catalog-mismatch` errors), `install_failures_throw_liveframe_failure` (compiler, resolver and style thrower, including the exact `/style/bogus` error) and `liveframe_failure_message_is_bounded` (30 errors → 20 lines); `build_facts_are_internal` became `compiled_validator_has_only_the_two_members`, and the root list pins `LiveframeFailure` and asserts `NodeCheck`/`NodeCheckSink` are absent. `validator-node.test.ts` replaced its two `toThrow(JSON.stringify(errors))`/`toThrow("catalog-mismatch")` assertions with `.errors` equality, since the kind is no longer in the message.
    - Readiness: A2 (four throwers, one typed failure), A3 (no `build` in the public type, no root aliases, `RendererError` a value), A4 (`PreviewSession` explicit), A5 (kinds policy in §10). Store failures (A2's "stores throw plain objects") belong to Task 8.
    - Performance: the render path is unchanged, one `WeakMap.get` per render. A/B on the agent-home workload, two runs each: HEAD 1.835 and 1.836 µs/node, with the change 1.852 and 1.822 µs/node. `bun run bench` was green on 2 of 3 attempts; the third failed only the pre-existing flaky `core-queue.small` 5-node gate (3.116 µs/node against 3.0), and HEAD itself measured 3.094–3.407 µs/node there in the same session — Task 13 should decide what to do with that gate rather than treat it as a Task 7 regression.
    - Validation: `bun run check` 607 tests, 0 failures across 87 files in 235.9 s at load 2.3 (was 604; three new tests and two rewrites); `git diff --check` clean.

- [x] Task 8: Add `Store.getPlacement`, store every valid id, and reject with typed failures
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

  - Notes (executed 2026-10-26):
    - `Store` gained `getPlacement(id): Promise<Placement | undefined>` — `memoryStore()` returns a JSON copy, `fileStore()` one file read — so the interface change landed while there are no external implementers (A1). Every other `Store` consumer in the repo is a spread of a reference store plus one overridden method, so only the two overrides in `store-load.test.ts` needed rewriting (they now override `getPlacement`).
    - `loadPlacement()` no longer lists: it reads that one placement, validates it, and rejects a record whose `id` disagrees with the key it was stored under (`invalid-document`, `/id`) — a store is untrusted, so a keyed read still needs that check. This fixes D3/P6: one malformed sibling can no longer block a load, and the read is O(1) rather than O(n) plus n validations. Loading the malformed record itself still reports `invalid-document` (asserted in the suite).
    - `fileStore` naming (D2/P5): `fileName()` keeps the readable, reversible percent-encoded name while it fits in 200 UTF-8 bytes, and otherwise uses `~` + the lowercase SHA-256 hex of the key's UTF-8 bytes (65 bytes). `path()` maps every key through it, so placements, states, packages and styles all get it. No collision is possible between the two forms: percent-encoding escapes `~` as `%7E`, so an escaped name never starts with `~`. Listing still reads ids from the records, so nothing is ever decoded, and existing short-name stores open unchanged — the layout is now documented as part of the 0.1.x promise (R15). `NAME_MAX` is 255 bytes on ext4, APFS and NTFS; the worst case here is 65 + 5 (`.json`) = 70.
    - Typed failures: both stores throw `LiveframeFailure` for a second hash under an existing `(id, version)` (`version-conflict`) and for an unparsable record (`invalid-document`, message naming the file). `loadPlacement()` returns `error.errors` when it catches one, and keeps its old duck-typed conversion below that for app-provided stores that still throw their own plain object.
    - `storeSuite` gained four cases — `gets_a_placement_by_id`, `rejects_a_second_hash_with_a_typed_failure`, `keeps_every_valid_id` (128 CJK code points, emoji, `../escape`, and a case-only pair, each round-tripping placement and state, listable, deletable), and `a_malformed_sibling_does_not_block_a_load` — so it runs 13 cases, 14 with `reopen`. The conflict case now requires a `LiveframeFailure`; the old duck-typed `error.kind` read is gone, which is what makes the typed rejection a contract for app stores too.
    - New fs-level test `long_ids_are_hashed_into_a_file_name_that_fits` pins the exact `~<sha256>.json` name for `"任"×128`, the ≤ 255-byte bound, and that a short escaped id (`é😀`) keeps its `%C3%A9%F0%9F%98%80.json`. Existing assertions that read a thrown record error's `kind` (`store-file`, `phase-2-loop`'s version conflict) now assert the class and `errors`; suite-length counts moved 9 → 13 and 10 → 14.
    - Performance, `fileStore` with 1,000 placements and one package, same script on both trees, two runs each: `loadPlacement` median 20.86 and 20.88 ms before, 0.77 and 0.93 ms after (p95 29.29/23.02 → 2.01/1.81). Writing the 1,000 placements was unchanged at 86–91 ms, as expected: only the read path changed.
    - Docs: spec §7.4 gains `getPlacement` in the interface, the file-name rule and the 0.1.x promise in the `fileStore` bullet, the typed `putPackage` rejection, and that `loadPlacement` reads one placement and never lists. `docs/packages.md` gains the table row, the long-id naming rule with the `NAME_MAX` figure, the 0.1.x promise, and the one-read load behaviour; `docs/conformance.md`'s store-suite row and the execution skill's storage reference match.
    - Readiness: D2 (128-code-point id fits), D3 (no scan, no sibling blocking), A1 (`getPlacement` before any external implementer), and the A2 remainder from Task 7 (stores no longer throw plain objects).
    - Validation: `bun run check` 620 tests, 0 failures across 87 files in 256.0 s at load 3.2 (was 607; four suite cases, one fs test, and one conformance count is the same test with a new length); `git diff --check` clean.

- [x] Task 9: Give the published schemas format-versioned URN ids
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

  - Notes (executed 2026-10-26):
    - `src/formats/registry.ts` now holds the one id builder, `schemaId(format) => \`urn:liveframe:${format}:1\``, used by `schemaDocument()` for every published `$id`. Format and version are in the id, so a new format version is a new id rather than a moved one, and no reader depends on a domain, a CDN or a package version.
    - The package schema's manifest reference moved with it. `src/formats/package.ts` cannot import `schemaId` (registry already imports package, so the reverse import is a cycle in which `schemaId` is still in its temporal dead zone when `widgetPackageSchema` is evaluated), so `widgetPackageSchema` keeps a `bool()` placeholder and registry.ts composes the published document with `manifest: { $ref: schemaId("manifest") }` — the same place it already composes `$defs` and the pattern-free language forms, and the only consumer of that document. A one-line comment in package.ts points there.
    - `bun scripts/schemas.ts` regenerated all ten documents: nine `$id` changes plus `widget-package.json`'s `$id` and its `$ref`, now `urn:liveframe:manifest:1`. No other file changed, and nothing under `proof/` or `src/__tests__/fixtures/` embeds a schema id, so no fixtures needed regenerating.
    - Two new tests in `src/__tests__/schemas.test.ts`: `schema_ids_are_format_urns` pins each `$id` to `urn:liveframe:<format>:1` and requires every cross-document `$ref` in the published bytes to start with `urn:liveframe:`; `package_schema_resolves_manifest_by_urn_offline` builds a fresh strict `Ajv2020` with no `loadSchema` hook, adds every published document, compiles by `urn:liveframe:widget-package:1`, validates a real package (`fixtures/proof/agent-home.manifest.json`) and checks that a bad manifest id fails at `/manifest/id` — so the urn `$ref` resolves with no network and the reference is live rather than decorative. The existing drift test covers the regenerated bytes unchanged; its file-copy list needed no new entry because no module was added.
    - `src/__tests__/cli-mcp.test.ts` needed no change: its schema-embedding pin compares `pack_draft`'s manifest properties and `$defs` against `schemas/manifest.json`, and `strip()` already drops `$id`, so it stays green and still proves the published shapes reach agents.
    - Docs: spec §13 states the urn scheme, that cross-document refs use those ids, that they resolve without a fetch and that the files ship inside the package. `docs/formats.md` gains a paragraph in *Published JSON Schemas* (ids, offline resolution, no domain or CDN owner, new version = new id) and its widget-package paragraph now names `urn:liveframe:manifest:1`.
    - Readiness A6 and R11: `graft grep "liveframe.dev"` returns no hits over the indexed tree. The only surviving mentions are history that must not be rewritten — this plan's rejected-option line, the readiness review row and decision log 2026-10-25-0231, which records *why* the domain ids were rejected. Neither docs nor code nor `schemas/` names a domain.
    - Validation: `bun run check` 622 tests, 0 failures across 87 files in 235.8 s at load 2.8 (620 before; two new schema tests); `bun scripts/schemas.ts --check` clean; `git diff --check` clean.

- [x] Task 10: Settle the MCP result shapes before the freeze
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

  - Notes (executed 2026-10-26):
    - `list_vocabulary` now answers `{ catalogId, vocabulary }`; the tool description says the id is what a manifest must name. `proof/tests/mcp-agent-loop.test.ts` reads it (`expect(catalogId).toBe("proof.ui@1")`) and builds every manifest from it, so the literal `"proof.ui@1"` is gone from the loop's `manifest()` helper — the agent now learns the id from the server exactly as a real one would.
    - Argument handling: `pack_draft` and `render_scenarios` read `input: unknown` and validate it in the handler. `packArguments()` checks the envelope (`/files` non-empty object of strings, `/entry` a key of `files`, `/scenarios` one to 64 entries), then `validateManifestShape` rooted at `/manifest` and `validateScenario` rooted at `/scenarios/<index>`; `renderArguments()` checks `/scenario` and runs `validateJson` over `state`/`context`, rooted at `/state` and `/context`. Two small helpers keep it uniform: `at(pointer, message, expected?)` for envelope errors and `rooted(base, errors)` to re-root a document validator's pointers. All of it returns `{ ok: false, errors }`, so the handler answers `failure(...)` in the same shape as a pack or render failure.
    - The argument schemas are now permissive on purpose: `type: "object"` with the four required keys, a `description` per property and no nested types, and the published schemas still embedded in `$defs` (manifest `$defs` merged with the package's, whose `json` is byte-identical). An agent reading `tools/list` still sees every shape it must author against, and the drift pin test now asserts the required keys, that each property is exactly one `description` (proving the handler owns validation), and that `$defs.scenario` and `$defs.schema` still equal the published bytes.
    - `render_scenarios({ scenario })` caps the returned tree at `MAX_TREE_BYTES = 262144`: one `JSON.stringify` serves both the byte count and the returned block (no double serialisation), and a bigger tree is `limit-exceeded` at `/scenario` with the actual size in the message and the limit in `expected`. The test's widget renders 1,200 rows of 200-character text, packs fine, and is refused only by the tool — a typed refusal, not a render failure.
    - The all-scenarios form keeps the flat status array: `{ scenario, ok: true, nodes }` per renderable scenario plus one entry per distinct error, `{ ok: false, kind, pointer, message, expected?, scenarios }`, keyed by `kind`/`pointer`/`message` and placed where its first scenario reported it, so ordering still follows the draft's scenario order. The test packs a throwing widget across all eight agent-home scenarios, expects exactly one shared error naming all eight, and counts the marker in the answer to prove the message appears once.
    - `schema_rejection_names_the_pointer` (which pinned the MCP layer's `data/manifest` string) is replaced by `argument_errors_are_liveframe_errors`: a bad manifest id gives `invalid-document` at `/manifest/id`, an empty envelope gives `/files`, and both assert the text never contains `Input validation error`. `list_vocabulary_matches_the_catalog_vocabulary` became `list_vocabulary_names_the_catalog`; `render_all_matches_session_check` and `render_scenarios_returns_tree_or_errors` needed no change because their scenarios all render.
    - Performance: the handler-side validation run over the agent-home draft (19 files, 8 scenarios) is 0.317 ms median and 0.718 ms p95 over 300 runs after 200 warmup runs — far inside the 5 ms budget, and it is now on every `pack_draft` call rather than only on failures.
    - Docs: spec §13 gives `list_vocabulary`'s shape, `render_scenarios`'s two forms, the dedup shape and the 256 KiB rule, and adds the permissive-argument contract with its one remaining pre-handler failure (a missing required key or a non-object argument). `docs/mcp.md` gets the catalog-id example, the dedup example, the 256 KiB paragraph, and its "one of two shapes" error section becomes one shape with the trade-off spelled out. The execution skill's preview reference matches. Backlog: "Give agents the catalog id and one error set", "Give the MCP tools one error shape" and "Bound the tree size render_scenarios returns" are closed with pointers here (A8, R13).
    - Law 4 unchanged: still seven tools (`tools_list_is_exactly_the_authoring_set` green), no new intent path and no store in `src/cli/mcp.ts`.
    - Validation: `bun run check` 624 tests, 0 failures across 87 files in 254.5 s at load 1.8 (622 before; two new tests, two rewritten); `bun test proof/tests/` 125 tests, 0 failures in 150.9 s, including the three agent loops; `git diff --check` clean.

- [x] Task 11: Serialize MCP session work, bind the page once, and fix capture error kinds
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

  - Notes (executed 2026-10-26):
    - Serialization: one `serialize()` queue, created once in `mcp()` and passed to the draft and capture registrars, wraps `pack_draft`, `render_scenarios` and `capture_preview`. Each call chains on the previous one (`tail.then(work, work)` so a rejection does not skip the next call) and the tail is always settled (`tail = run.catch(() => {})`), so a failed pack cannot wedge the server. The four catalog tools are untouched and still answer concurrently.
    - Binding: `config.preview()`'s promise is what is memoized, not its result — `bound ??= config.preview(...)` then `await bound.catch(...)`, which clears `bound` so a rejected binding is retried by the next capture (a resolved one is never called again). `close()` awaits the same promise, swallowing a rejection it already reported, so shutdown cannot hang on a binding that failed.
    - Capture directories: the shared `authoring.dir()` and its shutdown cleanup are gone; each `capture_preview` call does `mkdtemp(join(tmpdir(), "liveframe-mcp-"))` and `rm(..., { recursive: true, force: true })` in a `finally`, after the snapshot and PNG bytes are read. Cell names repeat across calls, so a shared directory could serve a stale snapshot; the test now asserts no `liveframe-mcp-*` directory survives a capture, twice in a row.
    - Typed capture errors (D5): `src/cli/capture.ts` gains `CaptureError` (a `kind` and a message) with three thrown kinds — `unknown-name` from `narrow()` (whose message now lists the declared values too), `not-found` for an unreachable page and for one that never became ready, and `limit-exceeded` for the cell bound. `PlaywrightMissing` is now a `CaptureError` with `kind: "not-found"`, so the install hint survives the map. A missing *browser executable* is Playwright's plain `Error` with no class (`browserType.launch: Executable doesn't exist …`), so the single launch site tags it `not-found` with the install hint and leaves every other launch failure (e.g. a sandbox error) as it was — one message check at one place, and no caller parses messages. `capture_preview` maps `error.kind` straight through and only untagged failures become `render-failed`; `liveframe preview capture` now catches `CaptureError` instead of matching the `PlaywrightMissing` name, so a missing Chromium prints the install hint and exits 1 like a missing Playwright.
    - Startup warning (S3): with no `config.runner`, the server writes one stderr line before connecting — drafts run in `workerRunner()` with this process's permissions, and an untrusted agent should get an isolated runner. A configured runner prints nothing.
    - Tests: `proof/tests/mcp-capture.test.ts` gains `capture_after_pack_sees_that_pack` (pack A, then capture and pack B issued together, asserted from the aria snapshot text), `concurrent_captures_bind_the_page_once` (two parallel captures through the logging `mcp-preview-close.config.ts` fixture, then exactly one `open` and one `close` line) and `unknown_axis_is_unknown_name`; `capture_temp_directory_and_binding_are_freed_on_shutdown` became `each_capture_uses_a_fresh_directory_and_the_binding_closes_once`, which now asserts no temporaries after each of two captures instead of one surviving until shutdown. `proof/tests/preview-capture.test.ts` gains `capture_errors_carry_their_kind`: `PlaywrightMissing` and a stubbed `Executable doesn't exist` launch are both `not-found` with the hint, a real capture against a closed port is `not-found`, and a sandbox-shaped launch error stays untagged. `src/__tests__/cli-mcp.test.ts` gains `default_runner_warns_on_stderr`, which also asserts a configured runner stays quiet. All browser tests stayed within their timeouts.
    - Performance, no single-call regression: end-to-end stdio round trips against the agent-home draft, medians of seven after warmup, two runs per tree — `pack_draft` 21.43/20.68 ms with the queue versus 20.66/18.24 ms before, `render_scenarios({ scenario })` 9.74/8.65 ms versus 10.75/8.49 ms. The differences are inside the run-to-run spread; the queue costs one microtask hop per call.
    - Law 1: unchanged — the page still receives trees only, and serialization is what guarantees a capture shows the draft packed before it. The existing page/bundle marker scan still passes.
    - Docs: spec §13 gains the startup line, the once-only memoized binding, the queue, the per-capture temporary directory and the typed capture failures; `docs/mcp.md` gets the kinds table, the binding/queue paragraph and the plain `workerRunner()` warning (readiness S3 start-up part); `docs/preview.md` states that a capture that could not run explains itself and exits 1, and that the library surfaces it as a `CaptureError` with a `kind`. The execution skill's preview reference matches.
    - Validation: `bun run check` 629 tests, 0 failures across 87 files in 260.8 s at load 2.1 (624 before; one new test in `cli-mcp`); `bun test proof/tests/` 129 tests, 0 failures in 174.5 s (125 before; four new, one rewritten); `tsc --noEmit -p proof` clean; `git diff --check` clean.

- [x] Task 12: Reject nested non-JSON composed props and test every composed-component error path
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

  - Notes (executed 2026-10-26):
    - Reuse (C3): no sixth walker. `isJson` — the input walker `render()` already uses for `params`/`state`/`context`/`data` — gained one optional `composed` argument carrying the composed component's node id. When it is set, a function is reported as `function-prop` and a thenable as `async-render` (spec §7.1's dedicated kinds); every other non-JSON value (class instance, NaN, cycle, nesting past `INPUT_DEPTH` 128) stays `invalid-prop`, exactly as for inputs. One function, one recursion, one depth rule.
    - Call site: the pre-expansion loop that used to check only `dataKind(element.props[name])` now pushes the prop name onto the shared `path` and walks the whole value with `parentPointer(parentId)` as the base, so the pointer comes from `at()` — an escaped pointer, e.g. `/pay~1load/callback`. `children` stay exempt (they are elements, expanded next), and the walk still runs only for composed components, once per expansion, so a value a component passes on is checked again on the next element.
    - Primitive props are untouched: their own props keep `dataKind`'s top-level classification at `/root/props|style|events/<name>`, and a nested function in a primitive's JSON prop is still `invalid-prop` because its schema rejects the value first. That is now stated in `docs/sdk.md` instead of the old limitation note.
    - Behaviour change worth knowing: a composed component whose props nest a class instance, `NaN` or a cycle now fails `invalid-prop` before it runs, where it used to run and only fail later if the value reached a primitive.
    - Tests: `src/__tests__/sdk-render.test.tsx` gains `nested_callback_in_composed_props_is_function_prop` (the backlog's discarded `{ payload: { callback } }` → `/payload/callback`, nested promise → `async-render` at `/payload/ready`, a 129-level value → `invalid-prop` at the depth bound, and an escaped prop name) and `composed_component_error_paths`, a ten-row table covering the expansion-depth limit, a top-level function prop, a component that throws (message `x`×500 + `…`), a promise return, a non-element return, the three invalid keys (empty, 129 characters, `NaN`), a fragment with props, and the nested child-array depth limit — each asserting kind, pointer and `nodeId`. The table asserts the branch's own error first: a failure before the root exists also adds the pre-existing "exactly one root element" error, which this task does not change. The case components moved to module scope for `noComponentHookFactories`.
    - Performance, before → after (`bun run bench`, agent-home, 679 nodes, mean of ~1000 runs per implementation; machine AMD Ryzen 9 PRO 7940HS, Bun 1.4.4; two paired runs at load 2.7–3.2): render 2.136 → 1.878 µs/node and 2.108 → 1.943 µs/node. Agent-home's widget is built from six composed components, so the walk runs throughout these trees; the differences are inside run-to-run drift and show no added cost. Every workload stayed ≤ 3 µs/node and agent-home ≤ 2 ms in the passing runs. One run failed `core-queue.full` on its *validation* reservation (1.758 vs 1.5 µs/node) at load 4.3 with no code on that path — the pre-existing bench verdict flakiness that Task 13 addresses.
    - Docs: `docs/sdk.md` drops the limitation paragraph and says composed props are walked at every depth before the component runs, and that primitive props keep `invalid-prop` for nested non-JSON values; spec §7.1's non-JSON prop list gains one sentence that props are JSON at every depth. `plans/backlog.md` closes the P2 entry with a Done line.
    - Validation: `bun test src/__tests__/sdk-render.test.tsx` 10/10; `tsc --noEmit` clean; `bun run lint` 0 errors; `bun run bench` passes every gate in the run recorded above.

- [x] Task 13: Prove the Playwright-free claim and stabilise the render bench verdict
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

  - Notes (executed 2026-10-26):
    - Preload (D6): `src/__tests__/fixtures/no-playwright.ts` now mirrors `no-mcp-sdk.ts` — `mock.module("playwright")` and `mock.module("playwright-core")` throw at import time. The old `plugin()`/`onResolve` version never fired for Bun's dynamic `import("playwright")`, so the block was decorative.
    - Proof the block is real (the criterion "it fails if the preload is removed"): `capture_without_playwright_reports_install_hint` spawns `bun --preload …/no-playwright.ts src/cli/liveframe.ts preview capture http://127.0.0.1:1/ --out <tmp>` and expects exit 1 with the install hint and no page error. Removing `--preload` was checked by hand: the run then loads the installed peer and prints `Cannot open http://127.0.0.1:1/: … net::ERR_UNSAFE_PORT`, so the test fails without the block. `gen_runs_without_playwright` is unchanged and now proves what it claims.
    - Bench (D7): only `bench/render.bench.ts` changed. `measure()` used one batch of 1,000 runs after 200 warm-ups; for `core-queue.small` (5 nodes, ~0.010 ms per render) that was ~10 ms of samples, which timer and loop overhead dominate. It now takes the **median of 5 independent batches**, each grown from 16 iterations in doubling steps until it covers **≥ 50 ms** of samples, so every batch is real work, and reports that median. Workload code, node-count assertions, thresholds and gates are untouched; the header line states the new sampling.
    - Why not a threshold change: the backlog P1 entry forbids relaxing the 3 µs/node or 2 ms gates without the owner. This is variance reduction only, and nothing on the measured path moved.
    - Three full `bun run bench` runs (validator + render + css, exit 0), Bun 1.4.4, `linux 7.3.0-4-cachyos`, AMD Ryzen 9 PRO 7940HS / 16 logical CPUs, load 2.0–2.9 (1 min) and 2.78–2.85 (15 min), with a 3.15 (1 min) spike at the start of run 2. Render, agent-home 679 nodes: 1.2735 / 1.2592 / 1.2376 ms = 1.875 / 1.854 / 1.823 µs/node. `core-queue.small`: **2.075 / 2.180 / 2.023 µs/node** — the workload that measured 3.006–3.209 µs/node with the single 1,000-run batch is now stable and 0.8–1.0 µs/node under the gate. medium/large/full per run: 0.8465/0.9185/1.0787, 0.7958/0.8558/0.9853, 0.8187/0.8872/0.9945 ms (1.92–2.28 µs/node). git-status 1.77/1.71/1.71, rack-module 1.69/1.68/1.66, synthetic-queue 1.71/1.70/1.68 µs/node. Every workload ≤ 3 µs/node and every required tree ≤ 2 ms in all three runs.
    - Standalone validator, same three runs: agent-home 1.245 / 1.309 / 1.277 µs/node, props check 11.4–16.0× over equal-work `checkValue`; validator exit 0 each time, so the P1 entry's 1.5 µs/node reservation also held while the machine was calm.
    - Backlog: P4 "Make the no-playwright test preload effective" closed with a Done line; the P1 "Phase 1 performance gate" entry gained a Measured (2026-10-26) line with machine, Bun, load and all three runs, and its Status line now records that the stabilised sampling — not a threshold change — is what closed the `core-queue.small` wobble.
    - Spec/docs sync: none required — no contract, API or documented number changed. `bun run lint` 0 errors, `tsc --noEmit` clean.

- [x] Task 14: Gate cognitive complexity and merge duplicate helpers
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

  - Notes (executed 2026-10-26):
    - Gate (C1): `biome.json` gains one `overrides` entry, `includes: ["src/**", "!src/__tests__/**"]`, enabling `complexity/noExcessiveCognitiveComplexity` at `maxAllowedComplexity: 25`. The plan proposed 25 and the measured distribution supports it: 25 leaves the eight functions C2 named (70–137) plus eleven more (26–56) to deal with, and after that work the highest remaining off-hot-path function is 24 (`objectCheck`), so 25 is the tightest round number that does not force an arbitrary split of a coherent check.
    - Hot paths keep their shape, each with one `biome-ignore` line: the tree walk (`src/validate/tree.ts:136`, 212) and render `emit` (`src/sdk/render.ts`, 183). Both reasons cite the bench gate and the per-node cost of an extra call. No other ignore was needed for a hot path; the third- and fourth-highest functions were refactored instead.
    - C2 refactors (no behaviour change, no test edited): `prepareDesignSystem` 137→13, `validateTheme` 93→8, bundle `visit` 84→22, `validateCatalog` 76→15, `classifyCatalogChange` 75→17, intent check 79→12, `checkValue` 74→22, manifest source binding 70→22. The eleven other functions above 25 went the same way, by extraction into named helpers with one caller-meaningful job each: `formats/vocabulary.ts` 56→14, `formats/package.ts` 50→13, `cli/mcp.ts` `render_scenarios` 50→20 (`renderOne`/`checkAll`), `css/design-system.ts` 48→10 (`stateRules`/`slotRules`/`tokenVariables`/`breakpoints`), `conformance/react/states.ts` 46→20 (`requiredStates`/`recordState`), `sdk/render.ts` `isJson` 43→22 (`shapeOf`/`isJsonContainer`), `validate/structure.ts` 40→13 and 26→10 (`walkArray`/`walkObject`, `checkTerms`/`checkPlacement`), `validate/schema.ts` 36→24 (`objectCheck`/`missing`/`checkProperty`), `preview/session.ts` 35→12 (`setState`/`action`), `pack/hash.ts` 32→21 (`pushMembers`), `validate/style.ts` 29→14 (`checkBreakpointMap`), `validate/compile.ts` 28→23/26→23 (`nodeCheck`/`rebaseErrors`), `preview/worker/index.ts` 27→14 (`refusal`/`validateResult`/`attach`/`send`), `formats/json.ts` 26→17 (`pushChildren`).
    - C3 dedup: `isRecord` and `codePointsWithin` now exist only in `src/schema.ts` (`formats/capabilities.ts` re-exports `isRecord` rather than defining it), `at` only in `formats/capabilities.ts`; the local copies in `formats/catalog.ts` and `validate/schema.ts` are deleted and imported instead. `catalog.ts` also swapped its private reject/collect for the shared `documentChecks()`.
    - The five JSON walkers keep separate implementations because their semantics differ, and each now says so in its doc line: `formats/json.ts` (bounded pointed errors, iterative), `sdk/render.ts` `isJson` (allocation-free yes/no predicate on the render path), `sdk/intents.ts` `assertJson` (throws at the first bad value), `validate/structure.ts` `walkJson` (the one shared walk: value rules *and* UTF-8 byte counting), `pack/hash.ts` `canonicalJson` (byte-exact RFC 8785 text).
    - Library warnings: the three `useImportType` warnings (`cli/mcp.ts`, `formats/design-system.ts`, `proof/runtime/types.ts`) are fixed with `biome --write`; there is no `useOptionalChain` warning left in the tree (the plan's second one had already gone). The remaining `bun run lint` output is 40 pre-existing warnings (`noNonNullAssertion` 31, `noUnusedVariables` 4, `noUnusedImports` 3, `noTemplateCurlyInString` 1, `useDomNodeTextContent` 1) plus 3 infos, unchanged by this task; they are not `complexity` rules and are not warnings this task introduced.
    - Performance, before → after. Before (Task 13's three stabilised runs, same machine, Bun 1.4.4, load 2.0–2.9): agent-home render 1.875 / 1.854 / 1.823 µs/node (1.2735 / 1.2592 / 1.2376 ms) and its standalone validation 1.423 µs/node; `core-queue.small` 2.075 / 2.180 / 2.023. After (two full `bun run bench` runs, load 3.1–3.2 rising to 3.8): agent-home render 1.774 / 1.799 µs/node (1.2047 / 1.2214 ms), validation 1.407 / 1.427 µs/node, `core-queue.small` 2.100 / 2.194; medium/large/full 1.935/1.965/2.212 and 1.899/1.949/2.203 µs/node. Every gate passes in both runs (≤ 3 µs/node, agent-home and medium…full ≤ 2 ms), and the validator bench's compiled-vs-generic ratio moved 0.65–0.70 → 0.70–0.71, i.e. inside noise. No regression from the extra helper calls on the measured paths.
    - Validation: `bun run check` = 632 pass, 0 fail, 113068 expect() across 87 files (263 s) — the same count as before this task, so no test was added, removed or edited. `tsc --noEmit` and `tsc -p proof --noEmit` clean, `bun run lint` 0 errors (the new rule included), `biome format --check` clean.

- [x] Task 14.1: Key the all-scenario dedup on `expected` (impact finding F3)
  - Acceptance Criteria:
    - Functional:
      - `render_scenarios` reports two errors that share `kind`, `pointer` and `message` but differ in `expected` as two entries, each naming the scenarios that share it.
      - Spec §13 and `docs/mcp.md` state the dedup key.
      - Disposition of plan 012 impact finding F3, approved `execute` by the owner on 2026-10-25.
    - Performance: no measurable change — the key gains one short string per error.
    - Code Quality: the key is built in one place, `checkAll()`; no other dedup exists.
    - Security: n/a — presentation only, no new data reaches an agent.
  - Approach:
    - Skills to Use:
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/evidence/012-impact-analysis.md` (F3); `docs/spec.md:727`; `docs/mcp.md` *render_scenarios* example.
    - Options Considered:
      - Deduplicate on the full error object — rejected: `expected` is the only other field, so naming it is the same result with a key that survives a future field.
    - Chosen Approach:
      - Add `expected` (or `""`) to the existing key.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `src/cli/mcp.ts`, `src/__tests__/cli-mcp.test.ts`, `docs/spec.md`, `docs/mcp.md`.
  - Test Cases to Write:
    - `errors_differing_only_in_expected_are_kept` — three synthetic results, two distinct `expected` texts, asserting two entries with scenarios `["a","c"]` and `["b"]`. Verified to fail with the key component removed.
  - Notes (executed 2026-10-25):
    - The key is now `kind` + `pointer` + `message` + `expected` (`src/cli/mcp.ts`, `checkAll`), so two errors that differed only in the repair hint are both reported. `checkAll` is exported for the unit test; `src/cli/` is not a package subpath, so nothing public changed (`exports.test.ts` untouched).
    - `docs/spec.md` §13 now says "distinct by `kind`, `pointer`, `message` and `expected`", and `docs/mcp.md`'s all-scenarios example says the same; the guide fixture embeds only the config example, so `mcp-guide.test.ts` needed no change.
    - The new test fails without the extra key component (checked by removing it: 1 fail) and passes with it. `bun test src/__tests__/cli-mcp.test.ts` 27 pass; the whole-plan `bun run check` is 633 pass, 0 fail.

- [x] Task 15: Analyze architectural impact and dispose of every finding
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

  - Notes (executed 2026-10-25):
    - Sweep: `plans/evidence/012-impact-analysis.md` reviews all twelve areas against what shipped (Tasks 1–14, commits `cee1f91`…`1a78403`) and records eleven of them as shipped with their tests; area 5 (styling) and area 12 (reference hosts) are `None — <reason>`.
    - Readiness: the evidence file carries a status line with the holding test for every id this plan owns — S1–S4, D1–D8, A1–A6, A8, T1, T2 (partly: the installed archive is 013 T2), C1–C3, P1–P3. S5, A7, T3, P4, P5, P6 are explicitly not this plan's, each with the id or plan that holds it, so plan 013 can copy the table into the pre-release review without re-deriving anything.
    - Findings: seven, presented as one table with recommended dispositions; the owner answered "Approve as recommended" on 2026-10-25 and the dispositions are recorded in the evidence file. One `execute` (F3) became Task 14.1 above and shipped in the same commit; five `backlog` items went to `plans/backlog.md` — two as new entries (P3 lint warnings, P4 in-process memory), one as a new entry after Task 14.1 (P4 preview URL), one as a new entry for the worker overhead (P4), and F1 as a residual Status line on the existing "Give the MCP tools one error shape" entry, F4 as a note on "Verify conformance registrations in other runners and browsers". No finding was dropped or deferred silently.
    - Readiness probes re-run from the review's appendix, copied outside the repo (`timeout 300s bun test /tmp/probe-012.test.ts`): 6 pass, 0.36 s. P1's forged result is `render-failed` with `expected: "one result for the pending render id"`; P2 hijacked 0/20; P3's ReDoS manifest is `pack ok=false` in 1/0/0/0 ms; P4's top-level await is `pack ok: false`; P5 stored a 128-code-point id; P6 loaded `good` with a malformed sibling present. P1, P2, P5 and P6 no longer reproduce; P3 and P4 fail fast.
    - Whole-plan verification: `bun run check` 632 pass, 0 fail, 113068 expect() across 87 files in 258.8 s at load 3.9 (before Task 14.1's one new test); targeted runner/store/manifest/pack/MCP/render/schema/export files 132 pass in 10.7 s; `proof/tests/mcp-*` and `preview-*` 28 pass, 1813 expect in 96.2 s; three full `bun run bench` runs pass every gate (agent-home render 1.774 / 1.799 / 1.877 µs/node, `core-queue.small` 2.100 / 2.194 / 2.213 against 3); `graft build` and `git diff --check` clean. After Task 14.1: `bun run check` 633 pass, 0 fail.
    - Honest exception: Task 3's worker host re-validation costs 4.19 ms/render of overhead against a 1 ms target (recorded in the evidence file's performance table and handed to the backlog as F7), and S1's residual (a hostile widget can answer another render with a tree that is valid for that render's manifest) remains, as spec §7.5 states, for an app's isolated runner (§14). Neither is papered over.
    - No dependency, public subpath or normative spec meaning changed by this task; Task 14.1 changed one tool result's dedup key and two doc sentences.

## Verification (whole plan)

- `timeout 900s bun run check`
- `timeout 600s bun run bench` (three runs; record all)
- `timeout 300s bun test src/__tests__/runner-worker.test.ts src/__tests__/runner-in-process.test.ts src/__tests__/store- src/__tests__/manifest.test.ts src/__tests__/pack src/__tests__/cli-mcp.test.ts src/__tests__/sdk-render.test.tsx src/__tests__/schemas.test.ts src/__tests__/exports.test.ts`
- `timeout 300s bun test proof/tests/mcp- proof/tests/preview-`
- `timeout 120s bun test <scratch copy of the readiness probes>` (appendix of `plans/evidence/012-release-readiness-review.md`)
- `timeout 120s graft build` and `git diff --check`

## Compromises Made

- **The worker path's host re-validation costs more than the plan budgeted.** Re-validating every worker result is what makes law 2 hold for code outside the host's realm, and it costs 4.19 ms/render of overhead against the task's 1 ms target (T3). Kept, because the alternative — trusting a message a widget can post — is the defect S1 named. Handed to the backlog (F7) rather than optimised inside a hardening plan.
- **A hostile widget still shares a worker with other packages.** S1's result correlation stops forged ids, stray answers and trees that fail the host validator, but a widget can answer another render with a tree that *is* valid for that render's manifest. Stated in spec §7.5 and routed to the app's isolated runner (§14): a worker bounds time and crashes, not what code can reach.
- **One MCP error path stays outside the typed shape.** A missing required key or a non-object argument is rejected by the SDK before any handler, so that call returns a bare string. Loosening the two top-level schemas costs the required-key hints in `tools/list`; the owner approved leaving it documented and backlogged (F1).
- **The in-process runner's memory is documented, not bounded.** Modules cannot be unloaded, so `inProcessRunner()` grows with the distinct packages it renders (T4 documents this in spec §7.5 and `docs/packages.md`); a cap needs a different design, so it went to the backlog (F6).
- **The lint gate covers one rule.** `biome.json` makes complexity an error but leaves 40 pre-existing warnings passing, so the rest of the rule set can still drift (F2, backlog P3).
- **A pixel threshold still proves layout, not geometry.** The agent loop's layout fix is asserted by a captured height at one width (011 F5); this plan did not change it.
- **No installed-archive, other-runner or other-browser proof.** T2's remaining half (installed archive) is 013 T2; runner/browser registrations stay in the backlog (P3). The two peer-blocking preloads are Bun-only, noted there (F4).

## Further Actions

1. **P3 — gate the lint warnings, not only complexity.** Raise the unused-symbol pair first, then decide on the 31 non-null assertions; add `--error-on-warnings` once the count is zero (F2).
2. **P4 — return the bound preview URL.** No tool carries `authoring.url()`, so a reviewer cannot open the page an agent iterated on (F5).
3. **P4 — cap or report the in-process runner's module memory.** It is the only unbounded cache in the reference runners (F6).
4. **P4 — record the worker re-validation cost in a budget** and consider caching the validator per `(catalog, capabilities, manifest)` so repeat renders stop recompiling it (F7).
5. **P4 — finish the one-error-shape contract** by validating the MCP envelope in the handler, or keep the documented exception (F1).
6. **P3 — a suite-runner change must re-prove both blocked-peer tests** (`no-playwright.ts`, `no-mcp-sdk.ts` are Bun's `mock.module`) (F4).
7. **Carried into plan 013:** installed-archive conformance (T2), the demo host's initially-open dialog (D8b), the Phase 6 Done gate (P5), the repository-publication secret and reference scan (P6), and the pre-release review that copies the readiness table from this plan's evidence file.
