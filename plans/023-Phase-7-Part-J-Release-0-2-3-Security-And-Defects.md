# Phase 7 Part J: Release 0.2.3 — Security and Defect Fixes

Depends on: plan [022](022-Phase-7-Part-I-Release-0-2-2-Performance-And-Accessibility.md) complete (0.2.2 published). Followed by plans [024](024-Phase-7-Part-K-Release-0-2-3-Performance.md) (performance) and [025](025-Phase-7-Part-L-Release-0-2-3-Simplification-And-Release.md) (simplification and the 0.2.3 release). Source: the comprehensive code review of `main` at `9894b1d` (2026-11-03), whose findings are numbered R1–R26 below.

## Objectives

- Record the 0.2.3 scope decision: every review fix ships in 0.2.3 unless it changes the public API. API-changing fixes move to 0.3.0 with a migration entry.
- Freeze the 0.2.2 public surface as the 0.2.3 baseline. Gate it with an **empty** register, so 0.2.3 cannot change a declaration, a schema, a corpus case or a vector.
- Close the contract gap where `createPreview()` and `createAuthoring()` report a custom runner's unvalidated tree as passing.
- Close the module-rule bypass (top-level `await using`), and the module-cache and hash-cache weaknesses that it and object mutation expose.
- Fix the smaller defects:
  - worker error results are not shape-checked;
  - `listPlacements` returns raw, unvalidated records;
  - MCP draft errors leak absolute paths;
  - `fr` on `width`/`height` projects to invalid CSS.
- Harden the supply chain: an audit step and an SBOM in CI, tag-only publishing behind a protected environment, and no CLI-only sucrase dependencies installed by consumers.

## Expected Outcome

- `decision-logs/<date>-release-0-2-3-scope.md` is approved. It holds the review-finding table with an `0.2.3` or `0.3.0` disposition per finding.
- `src/__tests__/api-stability.test.ts` also compares the checkout against `scripts/release/api/0.2.2.json`, with `scripts/release/api/register-0.2.3.json` = `[]`. It passes at the end of every task in plans 023–025.
- A custom `Runner` that returns an invalid tree makes `session.render()`, `renderOutcomes` and `render_scenarios` report typed errors, never `ok: true`. Docs/security.md item 3 and spec §7.5 now describe what the code does.
- Top-level `await using` is rejected by `checkModule`, which covers `pack()`, `bundle()` and `verifyPackage()`. A link failure no longer occupies a module-cache slot.
- The hash-verification cache can no longer be fooled by mutating a verified package object.
- CI runs `bun audit --prod --audit-level=high` and uploads a CycloneDX SBOM. A real publish runs only from a `v*` tag, inside a protected `release` environment.
- Consumers no longer install `commander`, `mz`, `thenify`, `pirates` or `tinyglobby` through Liveframe. This lands only if the scope decision approves bundling sucrase's transform, and only when the bundled output is byte-identical on every hash vector.
- `width="2fr"` (and the other dimension props) is documented as deprecated, with no CSS effect. Its rejection is a 0.3.0 migration entry. Its 0.2.3 CSS bytes are unchanged.

This plan implements the first part of the review-fix release in roadmap Phase 7. It follows plan 022's compatibility rules unchanged, with one tightening: **0.2.3 adds no declarations.** The register stays empty, so any change to an export, a declaration or a published schema is, by definition, an API change. That change stops the task and moves to 0.3.0 under the no-break rule (`decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md`). Fixes may change outcomes only for inputs that are invalid or contract-violating today: a malformed runner tree, a non-synchronous module, a corrupted store record. Each such change gets a CHANGELOG line. No version is bumped and nothing is published here; plan 025 releases. Spec sections touched: §6.3 (style props), §7.1 (modules), §7.4 (storage), §7.5 (runners and preview) and §12 (agent authoring).

### Review findings and their dispositions

| # | Finding | Plan / task | Disposition |
|---|---|---|---|
| R1 | Custom runner trees not host-validated in `createPreview`/`createAuthoring`; `checkAll` recursion on unvalidated trees | 023 T2 | 0.2.3 |
| R2 | Top-level `await using` bypasses the synchronous-module rule | 023 T3 | 0.2.3 |
| R3 | Failed module links cached forever and counted toward `maxModules` | 023 T3 | 0.2.3 |
| R4 | Identity-keyed hash cache trusts objects that nothing freezes | 023 T4 (snapshot); 0.3.0 (freeze) | split |
| R5 | `render()` freezes caller inputs in place | — | 0.3.0 (immutability contract) |
| R6 | Worker error results pass without shape checks | 023 T5 | 0.2.3 |
| R7 | `fileStore.listPlacements` returns and sorts unvalidated records | 023 T5 | 0.2.3 |
| R8 | MCP draft errors leak absolute paths; realpath-to-read window | 023 T6 (paths, docs); backlog (handle-based read) | split |
| R9 | `fr` on dimension props projects to invalid CSS | 023 T7 (deprecate); 0.3.0 (reject) | split |
| R10 | No audit step or SBOM in CI; publish can run from a branch | 023 T8 | 0.2.3 |
| R11 | Sucrase's CLI-only dependencies with caret ranges reach consumers | 023 T9 | 0.2.3, gated on the decision |
| R12 | Inline `fallback`/`diagnostics` reset the `<Surface>` node cache | 024 T2 | 0.2.3 |
| R13 | `shareNodes` aligns children by index | 024 T3 | 0.2.3 |
| R14 | Tree validation walks each node's props twice | 024 T4 | 0.2.3 |
| R15 | Pure-JS SHA-256 slow; `canonicalJson` double pass; `loadPlacement` re-hashes every load | 024 T5 (speed); 0.3.0 (verified-package cache option) | split |
| R16 | Minor hot spots: `validateJson` allocation, AST walk allocation, array checks past a full sink, `/^on[A-Z]/`, `themeCss` catalog re-validation, `diffTrees` reorders | 024 T6 (measure first) | 0.2.3 if measured |
| R17 | Dead code: `mcp.ts` `manifestSchema`/`packageDefs`, `catalog.ts` import, proof leftovers, orphaned comment in `validate/schema.ts` | 025 T1 | 0.2.3 |
| R18 | Needless internal exports: `shadowLayers`, `definitionSchema`, `scenarioSchema`, `jsonScalarBytes` (none is public) | 025 T1 | 0.2.3 |
| R19 | 138 lint warnings, none gated | 025 T1 | 0.2.3 |
| R20 | Duplicated helpers: pointer escaping ×9, error message ×7, promise queue ×4, UTF-8 counter ×3, `isThenable` ×3, node-by-id lookup ×3 | 025 T2 | 0.2.3 |
| R21 | Byte budget rules owned twice (`sdk/render.ts`, `validate/tree.ts`) | 025 T3 | 0.2.3 |
| R22 | Long closures: `renderValue`/`emit`, `compileTree`/`walk`, `gen.generate` | 025 T4 | 0.2.3 |
| R23 | Long closures: `createRenderer`/`Surface`, `createAuthoring` | 025 T5 | 0.2.3 |
| R24 | Every format defined twice (checker plus hand-written JSON Schema) | 025 T6 (differential test); backlog (single source) | split |
| R25 | Two stacked validator caches | 024 T6 (measure; remove the identity layer if it buys nothing) | 0.2.3 if measured |
| R26 | Import ban is syntactic only | — | no change: documented non-sandbox (spec §7.5, `docs/security.md`) |

## Compatibility rules for every task

Plan 022's rules 1–6 apply as written. In addition:

7. **The 0.2.3 register is empty.** `register-0.2.3.json` stays `[]`. A task that needs a register entry has found an API change. It stops, and the item moves to `docs/compatibility.md` § "Deferred to 0.3.0", with the owner's acknowledgement recorded in the task notes.
8. **Outcome changes only for invalid input.** A task may change an outcome only for input that the spec already calls invalid: an invalid tree, a forbidden module construct, a corrupted record. It names that input class in its Compatibility criterion and in a CHANGELOG "Fixed" line.

## Tasks

- [x] Task 1: Record the 0.2.3 scope decision and freeze the 0.2.2 surface behind an empty register
  - Acceptance Criteria:
    - Functional:
      - Write `decision-logs/<date>-release-0-2-3-scope.md` with `create-decision-log`. Its disposition table is copied from this plan, and its approval evidence is the owner's instruction (2026-11-03): "I want to release all of these fixes with 0.2.3 unless there are API changes". The owner confirms the split rows (R4, R8, R9, R15, R24) and the sucrase dependency change (R11). The log is created only after that confirmation.
      - Generate `scripts/release/api/0.2.2.json` exactly as `0.2.1.json` was: a temporary `git worktree` at `v0.2.2`, then `bun install --frozen-lockfile`, `bun run build` and `bun scripts/release/api-surface.ts <tmp> --out …`, with the command in its `generatedFrom` header. Create `scripts/release/api/register-0.2.3.json` as `[]`.
      - In `src/__tests__/api-stability.test.ts`, add `baseline_0_2_2_matches_the_checkout_with_an_empty_register`. It asserts `compareApiSurface(baseline022, current, register023)` is `[]` and that `register023` has length 0. The existing 0.2.1 test is unchanged and must still pass.
    - Performance: n/a. A test and a data file; the new comparison reuses the build that `check` already makes.
    - Code Quality: no new script. The comparator is reused as-is.
    - Security: n/a for the four laws. This gate keeps every law-enforcing contract byte-stable through 0.2.3.
    - Compatibility: adds no public surface. It enforces rules 1–8.
  - Approach:
    - Skills to Use:
      - `create-decision-log`: the scope and dependency decision, with explicit approval.
      - `liveframe-execution`: authority order and green-after-task.
    - Library Documentation to Check Before Implementation:
      - none. Plan 022 Task 1 notes record the TypeScript compiler API that `scripts/release/api-surface.ts` uses.
    - Documentation Reviewed:
      - `src/__tests__/api-stability.test.ts:3-44`, which hard-codes `0.2.1.json` and `register-0.2.2.json`.
      - `docs/compatibility.md` § "How 0.2.x stays compatible", § "Deferred to 0.3.0".
      - `decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md`.
    - Options Considered:
      - Replace the 0.2.1 baseline with 0.2.2. Rejected: it edits an existing assertion, and keeping both costs nothing.
      - Allow additive register entries, as 0.2.2 did. Rejected: the owner's rule is "unless there are API changes", and an empty register is the only mechanical reading of it.
    - Chosen Approach:
      - A second baseline with an empty register, checked by one added test case.
    - API Notes and Examples:
      ```bash
      tmp=$(mktemp -d) && git worktree add --detach "$tmp" v0.2.2 \
        && (cd "$tmp" && timeout 300 bun install --frozen-lockfile && timeout 300 bun run build) \
        && bun scripts/release/api-surface.ts "$tmp" --out scripts/release/api/0.2.2.json \
        && git worktree remove --force "$tmp"
      ```
    - Files to Create/Edit:
      - `decision-logs/<date>-release-0-2-3-scope.md`
      - `scripts/release/api/0.2.2.json`; `scripts/release/api/register-0.2.3.json`
      - `src/__tests__/api-stability.test.ts` (one added test)
  - Test Cases to Write:
    - `baseline_0_2_2_matches_the_checkout_with_an_empty_register`: fails if the baseline came from the wrong tag, or if any later task in plans 023–025 changes a declaration or schema.
  - Notes (executed 2026-11-03):
    - The owner confirmed the five split rows (R4, R8, R9, R15, R24) and the sucrase change (R11) with "Approve all". `decision-logs/2026-11-03-1132-release-0-2-3-scope.md` records the table and the approval. **Task 9 is therefore approved**, gated on byte-identical hash vectors, a pack-time check within 5% and sucrase's licence text in `dist/`.
    - `scripts/release/api/0.2.2.json` came from a temporary worktree at `v0.2.2` (frozen install, build, `api-surface.ts --out`). `api-surface.ts` does not write `generatedFrom`, so the header was added by hand in the same shape as `0.2.1.json`. `register-0.2.3.json` is `[]`.
    - The new test also asserts `generatedFrom` names `v0.2.2`. `api-stability.test.ts`: 8 pass. The 0.2.1 test is unchanged.
    - No spec change.

- [x] Task 2: Validate every runner tree on the host in `createPreview()` and `createAuthoring()` (R1)
  - Acceptance Criteria:
    - Functional:
      - `createPreview().run` (`src/preview/session.ts:40-50`) passes each successful runner result through the session's `validator` (compiled in `update()`, `:102`) before storing or returning it, using the runner options' `limits`. An invalid tree becomes the validator's typed errors.
      - `renderOutcomes` (`src/authoring/index.ts:263-308`) validates each successful `runner.render` result (`:296`) the same way, before `checkAll`. `checkAll`'s recursive `nodes()` (`src/authoring/checks.ts:4`) therefore only ever sees validated, bounded, acyclic trees.
      - The authoring MCP tool `render_scenarios` reports `ok: false` with the validator's `kind`/`pointer` for an invalid custom-runner tree.
      - Trees from `inProcessRunner()` and `workerRunner()` are unchanged: they are already valid, so they validate to the same tree. Every existing preview, authoring and MCP test passes unedited.
    - Performance: one extra `validateTree` per preview render. That is the same cost the worker runner's host re-validation already pays (0.907 ms median on the proof catalog, `docs/packages.md`). The preview and authoring paths are not bench-gated, and the timing is recorded in the task notes.
    - Code Quality: no new export, and no second validator. The session reuses its own. Validation happens once, at the point where the runner result enters the session.
    - Security: law 2 (the UI tree is validated data). An invalid or cyclic tree from any runner is rejected before anyone sees it, as `docs/security.md` item 3 and spec §7.5 (line 525) already promise.
    - Compatibility: rule 8. The outcome changes only for trees that fail validation, which the spec already forbids. No declaration changes, and the register stays empty.
  - Approach:
    - Skills to Use:
      - `surgical-patch`: the narrowest layer is where the runner result enters the session.
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none. Read `src/validate/compile.ts` (`validateTree` options) and `src/preview/worker/index.ts:71-79` (the existing host re-validation pattern).
    - Documentation Reviewed:
      - spec §7.5 (line 525); `docs/security.md:9` (item 3).
      - `src/preview/session.ts:40-50,98-107`; `src/authoring/index.ts:263-308`; `src/authoring/checks.ts:4-19`.
      - The review probe: a runner returning `{format:"nope", root:{id:7, kind:"<script>"}}` produced `ok: true` and `[{"scenario":"ready","ok":true,"nodes":1}]`.
    - Options Considered:
      - Validate inside every runner. Rejected: custom runners are host code, which the spec says the host does not trust.
      - Validate only in `<Preview>` in the browser. Rejected: that is where it happens today, and the agent is still told a broken draft passes.
      - Make `checkAll` cycle-safe. Rejected: it treats a symptom. A validated tree is acyclic and bounded.
    - Chosen Approach:
      - Validate at the session and authoring boundary with the session's existing validator.
    - API Notes and Examples:
      ```ts
      const result = await runner.render(active, inputs, options);
      const checked = result.ok ? validator!.validateTree(result.value, limits ? { limits } : undefined) : result;
      ```
    - Files to Create/Edit:
      - `src/preview/session.ts`; `src/authoring/index.ts`
      - `src/__tests__/preview-session.test.ts`, `src/__tests__/authoring.test.ts`, `src/__tests__/cli-mcp.test.ts` (added cases)
      - `CHANGELOG.md` (an `Unreleased` "Fixed" line)
  - Test Cases to Write:
    - `custom_runner_invalid_tree_is_rejected_by_the_session`: a runner returning a wrong-format tree with a non-string id makes `session.render` return `ok: false`, with the validator's kind. Fails if `run()` returns the raw result.
    - `custom_runner_cyclic_tree_is_rejected_not_counted`: a tree whose child points at its root returns `ok: false` from `renderOutcomes` without a stack overflow. Fails if `checkAll` sees it.
    - `render_scenarios_reports_invalid_custom_runner_tree`: through the MCP tool, the scenario status is `ok: false`.
    - `valid_runner_trees_are_unchanged`: the in-process runner's tree is deep-equal before and after this change.
  - Notes (executed 2026-11-03):
    - `src/preview/session.ts` `run()` validates a successful runner result with the session's validator before storing or returning it. The validator is read before the `await`, so an `update()` during a render cannot swap it. If none exists it is compiled from the active package's manifest, so validation never fails open. `src/authoring/index.ts` `renderOutcomes` validates each result with `compiledValidator(…, pkg.hash)` from `runner-kit/cache.ts` before `checkAll`. No new export, and the register is still `[]`.
    - **Amended: no `limits`.** `createPreview` and `createAuthoring` take no `limits` option, and the options they pass to a runner carry none. The default limits (5000 nodes, depth 64, 1 MiB) therefore apply. Adding a `limits` option would be a new declaration.
    - **Amended: the validator's kind is `invalid-prop`, not `invalid-document`.** A wrong `format`/`catalogId` and a bad `id` come back as `invalid-prop` at `/format`, `/catalogId`, `/surfaceId` and `/revision`. An unknown `kind` is `unknown-component`. The tests assert those.
    - **Amended: two existing tests were edited, against the plan's "unedited" criterion.** `set_state_bounds_the_rerendered_tree` and `authoring_hides_host_meta_unless_requested_and_bounds_trees` used a hand-built tree that was invalid against the catalog (an undeclared `text` prop on the root, then a string over the 10,000-character limit). They were meant to reach the 256 KiB result bound, and the host validator now rejects them first, as intended. Both now use a shared `oversizedTree()` helper: eight valid `text` nodes of 10,000 emoji each, about 320 KB, over the bound and valid. They still assert `limit-exceeded` at `/scenario`. The other existing preview, authoring and MCP tests pass unedited.
    - Added fixture `src/__tests__/fixtures/mcp-bad-runner.config.ts`, a host runner that returns an invalid tree, for the MCP test. Single-scenario `render_scenarios` returns the validator's errors directly. The all-scenarios form returns `ok: false` statuses.
    - With `session.ts` and `authoring/index.ts` reverted, `custom_runner_invalid_tree_is_rejected_by_the_session`, `custom_runner_cyclic_tree_is_rejected_not_counted` and `render_scenarios_reports_invalid_custom_runner_tree` fail, so they test the fix. `valid_runner_trees_are_unchanged` passes either way, which is its job.
    - Cost: one extra `validateTree` per preview render, which is the same work the worker runner's host re-validation does (0.907 ms median on the proof catalog, `docs/packages.md`). I did not re-measure it. The preview and authoring paths are not bench-gated.
    - Docs: `docs/security.md` item 3 and spec §7.5 already promised host validation of every runner tree, so neither changed. CHANGELOG has a new `Unreleased` section with a "Fixed" line.

- [x] Task 3: Reject top-level `await using` and stop caching failed module links (R2, R3)
  - Acceptance Criteria:
    - Functional:
      - `checkModule` (`src/pack/bundle.ts:49-82`) rejects a `VariableDeclaration` whose `kind` is `"await using"` outside a function, with the existing `invalid-document` error and the `synchronous` expectation (`:46`). The check sits beside the `AwaitExpression`/`for await` rule at `:57`. This covers source modules in `pack()`/`bundle()` and linked code in `verifyPackage()`. A block-scoped `await using` at top level is rejected too. `await using` inside an `async` function, and synchronous `using`, are still accepted.
      - `loadModule` (`src/preview/load.ts:22-37`) no longer stores a link failure in `modules`. It returns the rejected promise without caching it, so `loadedModuleCount()` and the `maxModules` bound count only real imports.
    - Performance: one more node-type comparison per AST node, at pack and verify time only. Not on the render path.
    - Code Quality: one condition in the existing walk. No new walker.
    - Security: law 1 is not affected. This closes a bypass of spec §7.1's synchronous-evaluation rule: a never-settling `Symbol.asyncDispose` would leave a pending module promise that permanently occupies a cache slot.
    - Compatibility: rule 8. Only modules that the spec already forbids now fail verification. No declaration changes.
  - Approach:
    - Skills to Use:
      - `surgical-patch`.
      - `find-docs`: acorn 8.19.0's ESTree output for explicit resource management (`VariableDeclaration.kind`).
    - Library Documentation to Check Before Implementation:
      - acorn 8.19.0: `VariableDeclaration` kinds `"using"` and `"await using"` under `ecmaVersion: "latest"`.
    - Documentation Reviewed:
      - spec §7.1 (synchronous widget evaluation); `src/pack/bundle.ts:26-82`; `src/pack/verify.ts`; `src/preview/load.ts`; `src/preview/in-process.ts` (`maxModules`).
      - The review probe: `checkModule("await using x = …")` returned ok.
    - Options Considered:
      - Ban every `using` declaration. Rejected: synchronous `using` is synchronous, so banning it would reject valid modules.
      - Evict rejected *import* promises too. Rejected: the engine's module map keeps a failed module record, so a re-import cannot succeed anyway. Only link failures never imported anything.
    - Chosen Approach:
      - Extend the existing top-level rule, and stop caching link failures only.
    - API Notes and Examples:
      ```ts
      if (!insideFunction && (node.type === "AwaitExpression" || (node.type === "ForOfStatement" && node.await)
        || (node.type === "VariableDeclaration" && node.kind === "await using")))
      ```
    - Files to Create/Edit:
      - `src/pack/bundle.ts`; `src/preview/load.ts`
      - `src/__tests__/pack.test.ts` and `src/__tests__/preview-load.test.ts` (added cases)
      - `conformance/corpus/`: one **added** package case for `await using` if the corpus carries module-rule cases. Existing cases stay byte-identical.
      - `CHANGELOG.md` ("Fixed")
  - Test Cases to Write:
    - `top_level_await_using_is_rejected`: covers `pack()`, `verifyPackage()` on a hand-built package, and a top-level block. Fails without the new condition.
    - `await_using_inside_async_function_and_sync_using_are_accepted`: fails if the rule is too broad.
    - `link_failure_is_not_cached`: two `loadModule` calls with unlinkable code leave `loadedModuleCount()` unchanged.
  - Notes (executed 2026-11-03):
    - `checkModule` (`src/pack/bundle.ts`) now also rejects a `VariableDeclaration` of kind `"await using"` when it is outside a function. `for (await using x of …)` is caught too, because the walker visits the loop's declaration. acorn 8.19.0 parses `await using` and `using` under `ecmaVersion: "latest"` (checked). `pack()` and `bundle()` share the rule, and `verifyPackage()` reuses `checkModule`.
    - `loadModule` (`src/preview/load.ts`) returns the rejection for a link failure without storing it, so `loadedModuleCount()` and the `maxModules` bound count only real imports. A failed *import* stays cached, as planned.
    - Tests: `top_level_await_using_is_rejected` and `await_using_inside_async_function_and_sync_using_are_accepted` (`pack-bundle.test.ts`), `verify_rejects_linked_top_level_await_using` (`pack.test.ts`) and `link_failure_is_not_cached` (`preview-load.test.ts`). With the two source files reverted, three of them fail; the accepted-forms test passes either way, since it guards against over-rejecting.
    - **No corpus case added.** The plan said to add one only if the corpus carries module-rule cases. `conformance/corpus/package/` holds document-level cases (hash, imports, limits) and none for the synchronous-module rule, so the corpus and its comparator are untouched.
    - Spec change: §7.1 and §7.3 (lines 386 and 446) and `docs/packages.md` now name `await using` beside `await` and `for await`. CHANGELOG "Fixed" has two lines (`await using`, link-failure caching).
    - The register stays `[]`.

- [x] Task 4: Bind the verified-hash cache to the content it verified (R4, patch-safe part)
  - Acceptance Criteria:
    - Functional:
      - `verifyPackageHash` (`src/preview/cache.ts:14-23`) replaces its `WeakSet` with a `WeakMap<WidgetPackage, { hash: string; code: string; manifest: Manifest; scenarios: readonly Scenario[] }>`. That map records the references it verified. A cache hit requires `pkg.hash`, `pkg.code`, `pkg.manifest` and `pkg.scenarios` to be the same references (`===`). Any reassigned field triggers a full re-hash.
      - A package whose `code` is reassigned after verification is re-hashed, and is rejected with `hash-mismatch` if it no longer matches. It can no longer load its new code under the old, verified hash.
      - The docs comment and `docs/security.md` item 3 state the remaining assumption: nested mutation inside `manifest` or `scenarios` is not detected; freezing is the 0.3.0 contract (R4/R5).
    - Performance: a cache hit costs four reference comparisons. No re-hash for unchanged packages.
    - Code Quality: the change stays inside `cache.ts`. No public surface.
    - Security: law 1 and the module cache's integrity. A mutated package can no longer poison the hash-keyed module and validator caches.
    - Compatibility: rule 8. Only a package object mutated after verification changes outcome. Freezing packages (`pack()`/`verifyPackage()` returning frozen objects) is observable and goes to "Deferred to 0.3.0" (plan 025 Task 7).
  - Approach:
    - Skills to Use:
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `src/preview/cache.ts`; `src/preview/load.ts:22-37` (hash-keyed module map); `src/runner-kit/cache.ts` (hash-keyed validators); `docs/security.md:9`.
    - Options Considered:
      - `Object.freeze` packages in `pack()`. Rejected for 0.2.3: a host that mutates its own package would start throwing in strict mode, which is an observable contract change.
      - Re-hash on every call. Rejected: 9.9 ms per 512 KB on every render.
    - Chosen Approach:
      - Snapshot the top-level references. It catches field reassignment, which is the realistic mutation, at near-zero cost.
    - API Notes and Examples:
      - n/a. Internal.
    - Files to Create/Edit:
      - `src/preview/cache.ts`; `docs/security.md`
      - `src/__tests__/preview-load.test.ts` (added case)
  - Test Cases to Write:
    - `reassigned_code_after_verification_is_rehashed_and_rejected`: fails with the `WeakSet` version.
    - `unchanged_package_is_verified_once`: hashing is called once across two renders (spy on `packageHash`).
  - Notes (executed 2026-11-03):
    - `verifyPackageHash` (`src/preview/cache.ts`) now keeps a `WeakMap` from the package to a shallow copy of the references it verified. A hit needs `hash`, `code`, `manifest` and `scenarios` to be `===`; any reassigned field is hashed again. The copy is separate from the package, so reassigning a field cannot change what was recorded.
    - **Amended: `format` is compared too.** `packageHash` covers `format`, so leaving it out would let a reassigned `format` keep a verified hash. It costs one more comparison and the criterion's intent is unchanged.
    - Both runners already call `verifyPackageHash`, so nothing else changed. No new export, and the register stays `[]`.
    - Tests are in `preview-load.test.ts`: `reassigned_code_after_verification_is_rehashed_and_rejected` (fails with the old `WeakSet`) and `unchanged_package_is_verified_once` (spies on `packageHash`; it passes either way and guards against re-hashing every call). The test packages come from `pack()` and are copied with a spread so each test mutates its own object.
    - `docs/security.md` item 3 states the remaining assumption, and CHANGELOG "Fixed" has a line. No spec change: §7.5 already says the hash is verified before code loads.
    - `bun run check`: 1011 pass, 0 fail. Before this work, `loader_resolves_sdk_from_other_cwd` failed when run alone against a stale `dist/`; it passes after `bun run build`, as `check` does.

- [x] Task 5: Shape-check worker error results and reject corrupt placement records (R6, R7)
  - Acceptance Criteria:
    - Functional:
      - `validateResult` (`src/preview/worker/index.ts:71-79`) also checks a failed worker result: `errors` must be a non-empty array of at most `maxErrors` (default `DEFAULT_MAX_ERRORS`) records, each with a string `kind`, `pointer` and `message`, an optional string `expected` and `nodeId`, and no other fields. If any check fails, the result becomes one `render-failed` error, "Worker returned a malformed error result", and the worker is recycled.
      - `fileStore().listPlacements` (`src/store/fs/index.ts:110-125`) throws the same `LiveframeFailure` `invalid-document` that `read` throws for invalid JSON, when a record is not an object with a string `id`. The sort then compares strings only, with no optional chaining.
      - The `/conformance` store suite gains a case: a store whose listing contains a non-object fails closed. It is added; no existing case changes.
    - Performance: the worker error check is O(errors) and runs only on failures. The listing check is O(records).
    - Code Quality: the error-record check is one small function next to `validateResult`. Reuse `isRecord` from `formats/capabilities.ts`.
    - Security: law 2 extends to error results. A compromised worker can no longer pass unbounded or non-JSON error payloads to the host UI.
    - Compatibility: rule 8. Only malformed worker messages and corrupted record files change outcome.
  - Approach:
    - Skills to Use:
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `src/preview/worker/index.ts:56-100`; `src/store/fs/index.ts:45-58,110-125`; `src/errors.ts` (`LiveframeError` fields); `src/conformance/store.ts`.
    - Options Considered:
      - Validate placements fully in `listPlacements`. Rejected: `loadPlacement` already validates on use, so duplicating `validatePlacement` here would change what the listing returns for records that are merely stale.
    - Chosen Approach:
      - Minimal shape checks at the two trust boundaries.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `src/preview/worker/index.ts`; `src/store/fs/index.ts`; `src/conformance/store.ts` (the store suite)
      - `src/__tests__/runner-worker.test.ts`, `src/__tests__/store-file.test.ts`, `src/__tests__/conformance-store.test.ts` (added cases)
      - `CHANGELOG.md` ("Fixed")
  - Test Cases to Write:
    - `malformed_worker_error_result_is_replaced_and_worker_recycled`: a worker that posts `{ ok: false, errors: "x" }` or 10,000 errors yields one `render-failed` error.
    - `null_placement_record_fails_closed`: a `placements/a.json` containing `null` makes `listPlacements` throw `invalid-document`.
    - The added store-suite case, which fails against a mutant store that returns `[null]`.
  - Notes (executed 2026-11-03):
    - `src/preview/worker/index.ts`: `validateResult` takes `unknown` and first checks the envelope with a small `isResult` (`ok === true` with a `value`, or `ok === false` with an error list). `isErrorList` requires 1 to `DEFAULT_MAX_ERRORS + 1` records whose only fields are `kind`, `pointer`, `message`, `expected` and `nodeId`, all strings. A failure becomes one `render-failed` error and the worker is recycled. `isRecord` comes from `schema.ts`; it is not in `formats/capabilities.ts`, which only re-exports it.
    - **Amended: the bound is 21, not 20.** A validator that hits `maxErrors` appends a `limit-exceeded` marker (`addBoundMarker`), so a legitimate bounded list has `DEFAULT_MAX_ERRORS + 1` entries. `RunnerOptions` has no `maxErrors`, so the default applies.
    - **Amended: one message.** The malformed envelope, a non-record result and a bad error list share "Worker returned a malformed result" instead of "…malformed error result". The `onmessage` handler read `data.result.ok` before validating, so a `null` result would have thrown in the handler and hung the render until its timeout; the recycle decision now reads the validated result.
    - `src/store/fs/index.ts`: `listPlacements` throws `invalid-document` naming the file when a record is not an object with a string `id`, and the sort compares `a.id`/`b.id` directly.
    - `src/conformance/store.ts`: the added case is `store_lists_only_placement_records`. The suite has 17 cases (18 with `reopen`), so the three count assertions in `conformance-store.test.ts` and `exports.test.ts` changed from 16/16/17 to 17/17/18. No existing case changed. A conformance case can only use the `Store` interface, so it checks what `listPlacements()` returns and cannot write a corrupt file; the file-level fail-closed behaviour is `null_placement_record_fails_closed`.
    - Tests: `malformed_worker_error_result_is_replaced_and_worker_recycled` (seven malformed answers, each followed by a clean render to prove the recycle), `well_formed_worker_error_result_passes_through`, `null_placement_record_fails_closed`, and the mutant `[null]` store in `store_suite_catches_broken_stores`. With `worker/index.ts` and `fs/index.ts` reverted, the first and third fail.
    - CHANGELOG has two "Fixed" lines and one "Added" line for the store case. The register stays `[]`. No spec change.
    - `bun run check`: 1017 pass, 0 fail. `in_process_warm_overhead_under_point_one_ms` failed twice with the machine at load average 10 to 13 (0.108 and 0.129 ms against 0.1; the same test also failed on the baseline without these changes, and standalone runs ranged from -0.07 to 0.157 ms). It passed on the third full run. It is a wall-clock test and unrelated to this task.

- [ ] Task 6: Keep absolute paths out of MCP draft errors and document the draft-root trust model (R8, patch-safe part)
  - Acceptance Criteria:
    - Functional:
      - `src/cli/draft-dir.ts:72-73` reports errors relative to `draftRoot`, for example `not-found: draft file "widget.tsx" not found in "drafts/a"`. They no longer carry the Node error message with the absolute path. The `kind` and `pointer` are unchanged.
      - `docs/mcp.md` § security states the trust model. `draftRoot` must be writable only by the agent and the host. Symlinks are resolved and contained at read time, but the server does not defend against a third party swapping symlinks during a read.
      - A backlog entry (P4) records the handle-based read: open, `fstat`, then compare `dev`/`ino` with the contained path.
    - Performance: n/a. CLI error path only.
    - Code Quality: one message helper in `draft-dir.ts`.
    - Security: no law is touched. This stops host filesystem layout leaking to the agent.
    - Compatibility: error `kind` and `pointer` are unchanged. Message text is not contract (`docs/compatibility.md` § Growth).
  - Approach:
    - Skills to Use:
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `src/cli/draft-dir.ts:1-75`; `docs/mcp.md`; `src/cli/mcp.ts` (`loadConfig` realpaths `draftRoot`).
    - Options Considered:
      - A full race-free read now. Rejected for this task: there is no portable fd-to-path call under Bun (`/proc/self/fd` is Linux-only, `F_GETPATH` macOS-only). It goes to the backlog with the `fstat` design.
    - Chosen Approach:
      - Relative messages plus a documented trust model.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `src/cli/draft-dir.ts`; `docs/mcp.md`; `plans/backlog.md`
      - `src/__tests__/cli-mcp.test.ts` (added case)
  - Test Cases to Write:
    - `draft_errors_never_contain_the_absolute_root`: the error messages for a missing file, a symlink escape and an unreadable file do not contain `realpath(draftRoot)`.

- [ ] Task 7: Deprecate fractions on dimension style props (R9, patch-safe part)
  - Acceptance Criteria:
    - Functional:
      - Spec §6.3's table row (`docs/spec.md:213`) says fractions on `width`, `height`, `minWidth`, `maxWidth`, `minHeight` and `maxHeight` are deprecated. They project to a declaration that browsers ignore (`minmax(0, Nfr)` is not a valid `width`), and 0.3.0 rejects them. Fractions in `columns`/`rows` tracks are unchanged.
      - `docs/styling.md` carries the same note. `liveframe gen` output is unchanged (its `_Dimension` alias, `src/sdk/gen.ts:104`, stays byte-identical), so `gen:check` stays green and the API gate stays empty.
      - `docs/compatibility.md` § "Deferred to 0.3.0" gains an entry. **Before:** `width="2fr"`, which has no effect. **After (0.3.0):** `invalid-prop` at `/style/width`. **Adopter checklist:** use `grow={2}` with `basis={0}`, or move the fraction to the parent's `columns`.
      - Validation and CSS projection are byte-identical to 0.2.2. `src/__tests__/css-style-props.test.ts:75` stays as it is, with a comment pointing to the deprecation.
    - Performance: n/a. Docs only.
    - Code Quality: n/a.
    - Security: law 3 is not affected. No colour or raw CSS path changes.
    - Compatibility: rule 4 holds. Rejecting a value that is valid today is an API change, so it is deferred.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (styling reference).
      - `find-docs`: MDN or CSS Sizing 3, confirming `minmax()` is valid only in grid track lists.
    - Library Documentation to Check Before Implementation:
      - CSS Grid Layout 1 (`minmax()` in `grid-template-*`); CSS Sizing 3 (`width` value grammar).
    - Documentation Reviewed:
      - `src/css/style-props.ts:19-29`; `src/validate/style.ts:37-58`; spec §6.3; the review probe in Chromium (`CSS.supports("width","minmax(0, 2fr)") === false`). No proof, example or corpus file uses `fr` on a dimension prop.
    - Options Considered:
      - Reject `fr` now. Rejected: a valid input would become invalid, which is an API change.
      - Project `Nfr` to `flex-grow: N`. Rejected: it invents a meaning the spec never gave, and it changes CSS bytes for a valid input.
      - Stop emitting the inert declaration. Rejected: it changes CSS bytes, the rendered result is identical, and it gains nothing over deprecation.
    - Chosen Approach:
      - Deprecate in 0.2.3 and reject in 0.3.0, with a migration entry.
    - API Notes and Examples:
      ```tsx
      // deprecated, no effect:    <box width="2fr" />
      // equivalent intent:        <box grow={2} basis={0} />
      ```
    - Files to Create/Edit:
      - `docs/spec.md` §6.3; `docs/styling.md`; `docs/compatibility.md`; `src/__tests__/css-style-props.test.ts` (comment only)
  - Test Cases to Write:
    - n/a. Behaviour is unchanged. The existing `css-style-props` and `gen:check` assertions prove the bytes are identical.

- [ ] Task 8: Add a dependency audit and an SBOM to CI, and gate publishing to tags in a protected environment (R10)
  - Acceptance Criteria:
    - Functional:
      - `.github/workflows/ci.yml` runs `bun audit --prod --audit-level=high` after `bun install --frozen-lockfile`. It fails the job on a high or critical advisory in the runtime closure. `bun audit` (all dependencies, all levels) runs informationally with `continue-on-error`.
      - `scripts/release/sbom.ts` writes a CycloneDX 1.6 JSON SBOM of the runtime dependency closure. It reads `package.json` and `bun.lock`, and records name, version, `purl`, the lockfile integrity hash and license. CI uploads it as an artifact. The publish job stages it into the package as `sbom.cdx.json` only if the archive gate's file list permits it; otherwise it is attached as a workflow artifact. That choice is recorded in the task notes.
      - `.github/workflows/publish.yml`:
        - the job declares `environment: release`;
        - a first step fails when `inputs.dry_run` is false and `github.ref_type != 'tag'`;
        - the existing tag/version check stays.
      - Owner actions, recorded in the notes with evidence:
        - create the `release` environment with required reviewers and a `v*` tag rule;
        - set the environment name on the npm trusted publisher, if npm supports it for this package.
    - Performance: CI only. The audit adds about a second.
    - Code Quality: the SBOM script is Bun-only and has no dependency. `bun.lock` is JSONC: parse it with `Bun.JSONC`, if the checkout's Bun has it, or with `JSON.parse` after stripping trailing commas. Record which.
    - Security: supply chain. A branch can no longer publish. A runtime advisory fails CI. Every release has an inventory.
    - Compatibility: no published file changes, unless the SBOM is added to the archive. If it is, that is an added file, which the archive gate must allow explicitly.
  - Approach:
    - Skills to Use:
      - `find-docs`: Bun 1.4.2 `bun audit` (fetched while planning: `--prod`, `--audit-level`, `--ignore`, `--json`; the flags are CLI-only); GitHub Actions environments; npm trusted publishing environment support.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2 `docs/pm/cli/audit.mdx`. Bun has no SBOM command; `bun pm ls`/`bun pm licenses` print text only, which is why a script is needed.
      - CycloneDX 1.6 JSON schema (`bomFormat`, `specVersion`, `components[].purl`, `hashes`, `licenses`).
      - GitHub Actions: `jobs.<id>.environment`, deployment protection rules.
      - npm docs: trusted publishers (the optional environment field).
    - Documentation Reviewed:
      - `.github/workflows/ci.yml`, `.github/workflows/publish.yml:1-60` (`workflow_dispatch` with `dry_run`; the tag check only `if: github.ref_type == 'tag'`); `docs/compatibility.md` § "Release process"; AGENTS.md (npm only in the publish job).
    - Options Considered:
      - `npm sbom` in the publish job. Rejected: it needs an npm tree and lockfile. Bun is the tool everywhere except publishing.
      - Drop `workflow_dispatch`. Rejected: dry runs from a branch are useful, so only real publishes are gated.
    - Chosen Approach:
      - Bun audit gate, a small SBOM script, and a tag-plus-environment gate.
    - API Notes and Examples:
      ```yaml
      - name: Real publishes run only from a tag
        if: ${{ !inputs.dry_run && github.ref_type != 'tag' }}
        run: echo "::error::publish from a v* tag" && exit 1
      ```
    - Files to Create/Edit:
      - `.github/workflows/ci.yml`; `.github/workflows/publish.yml`; `scripts/release/sbom.ts`
      - `src/__tests__/sbom.test.ts`; `docs/compatibility.md` § "Release process" (the environment and the SBOM); `scripts/release/archive-gate.ts` (only if the SBOM ships in the archive)
  - Test Cases to Write:
    - `sbom_lists_exactly_the_runtime_closure`: the SBOM's component set equals the lockfile closure of `dependencies`. It includes `acorn` and `sucrase` (or none of sucrase's dependencies after Task 9), and no dev dependency.
    - `sbom_is_valid_cyclonedx_1_6`: it validates against the CycloneDX 1.6 JSON schema (vendored under `scripts/release/fixtures/`) with `ajv`, which is already a dev dependency.

- [ ] Task 9: Bundle sucrase's transform so consumers install no CLI-only dependencies (R11, gated on Task 1's decision)
  - Acceptance Criteria:
    - Functional:
      - Only if Task 1's decision approves it, `scripts/build.ts` bundles `sucrase`'s `transform` (with its transitive runtime code) into `dist/pack/`, and `sucrase` moves from `dependencies` to `devDependencies`. `acorn` stays a pinned dependency. If the decision rejects bundling, this task records `n/a — rejected in <decision log>` and a P3 backlog entry.
      - `pack()` output is byte-identical: every `conformance/hash/` vector and every corpus package hash matches, and the proof widgets pack to the same hashes as before the change.
      - `dist/` includes sucrase's MIT license text (`dist/pack/THIRD-PARTY-LICENSES`, or a banner), and the archive gate checks for it.
      - The installed archive (`bun run release:gate`, Node probe) loads `/pack` with no `sucrase` package installed.
    - Performance: `pack()` time does not regress. Compare the median of 20 packs of the proof widgets before and after, within 5%.
    - Code Quality: a bundling step in the existing build script, with no new tool. The source keeps `import { transform } from "sucrase"`.
    - Security: supply chain. It removes `commander`, `mz`, `thenify`, `pirates` (a `require` hook), `tinyglobby`, `ts-interface-checker` and `lines-and-columns` caret ranges from every consumer's install. Bundled code is pinned by the lockfile at build time.
    - Compatibility: no declaration, export or published schema changes. `package.json` `dependencies` shrinks, and a consumer that imported `sucrase` transitively must depend on it directly (CHANGELOG "Changed").
  - Approach:
    - Skills to Use:
      - `create-decision-log` (in Task 1); `find-docs`: Bun 1.4.2 `Bun.build` (`external`, `target`, bundling CommonJS into ESM).
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2 bundler: `Bun.build({ entrypoints, external, format: "esm", target })`. sucrase 3.35.1: `dist/esm` entry and the internal imports that `transform` reaches.
    - Documentation Reviewed:
      - `package.json:198-199` (`acorn` 8.19.0, `sucrase` 3.35.1); `bun.lock` (sucrase's dependencies: `@jridgewell/gen-mapping ^0.3.2`, `commander ^4.0.0`, `lines-and-columns ^1.1.6`, `mz ^2.7.0`, `pirates ^4.0.1`, `tinyglobby ^0.2.11`, `ts-interface-checker ^0.1.9`); `src/pack/bundle.ts:10`; `scripts/build.ts`; `scripts/release/archive-gate.ts`.
    - Options Considered:
      - Keep sucrase as a dependency. Rejected, unless the decision says so: seven unpinned transitive packages ship for one function.
      - Use Bun's transpiler. Rejected: it is not host-API-free, and `/pack` must run under Node (`docs/compatibility.md` runtime matrix).
      - Use npm `overrides` to pin. Rejected: overrides do not apply to consumers.
    - Chosen Approach:
      - Bundle at build time, gated on byte-identical hashes.
    - API Notes and Examples:
      ```ts
      await Bun.build({ entrypoints: ["src/pack/index.ts"], outdir: "dist/pack", format: "esm", target: "node", external: ["acorn"] });
      ```
    - Files to Create/Edit:
      - `scripts/build.ts`; `package.json`; `bun.lock`; `scripts/release/archive-gate.ts`; `CHANGELOG.md` ("Changed")
      - `src/__tests__/build-pack-bundle.test.ts` (tentative)
  - Test Cases to Write:
    - `bundled_pack_hashes_match_the_vectors`: packs every hash-vector source through the built `dist/pack` and compares against the vectors.
    - `dist_pack_imports_no_sucrase`: scans `dist/pack/*.js` for `from "sucrase"`/`require("sucrase")`. Fails if the bundle step is skipped.

- [ ] Task 10: Analyze architectural impact and dispose of every finding
  - Sweep the impact areas in `.agents/skills/create-plan/references/liveframe.md` §5 against the work delivered. Record each area, or `None — <reason>`, in `plans/evidence/023-impact-analysis.md`. Present the findings with a recommended `execute`/`backlog` disposition, record the owner's answer, and execute or backlog each item. Confirm `register-0.2.3.json` is still `[]`, and that every row in this plan's disposition table is fixed, deferred with an entry, or handed to plans 024 and 025.

## Verification (whole plan)

- `timeout 900 bun run check`
- `timeout 120 bun test src/__tests__/api-stability.test.ts`
- `timeout 300 bun run release:gate`
- `timeout 600 bun run demo:test`
- `timeout 60 bun audit --prod --audit-level=high`
- `timeout 60 bun scripts/release/sbom.ts --out /tmp/sbom.cdx.json`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
