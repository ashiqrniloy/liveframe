# Phase 7 Part L: Release 0.2.3 — Simplification, Documentation and Release

Depends on: plans [023](023-Phase-7-Part-J-Release-0-2-3-Security-And-Defects.md) and [024](024-Phase-7-Part-K-Release-0-2-3-Performance.md) complete. It uses 023 Task 1's scope decision, 0.2.2 baseline and empty `register-0.2.3.json`, and 024 Task 1's `bench/ab.ts`. Findings R17–R24 are from 023's disposition table.

## Objectives

- Remove the dead code and the needless internal exports, fix the 138 lint warnings, and make `bun run lint` fail on any warning.
- Replace duplicated helpers with one internal implementation each: JSON Pointer escaping, error messages, promise queues, UTF-8 byte counting, thenable checks and node-by-id lookup.
- Give the tree byte budget one owner, shared by `render()` and the validator.
- Split the longest closures (`renderValue`/`emit`, `compileTree`/`walk`, `gen.generate`, `createRenderer`/`Surface`, `createAuthoring`) wherever an A/B shows the split costs at most 2% on the bench-gated paths. Where it costs more, the suppression keeps its place, now justified by a measured figure.
- Detect drift between each format's checker and its published JSON Schema with a differential test.
- Document 0.2.3, carry every API-changing item into "Deferred to 0.3.0" with a migration entry, then release `0.2.3` through an rc, with the owner's go.

## Expected Outcome

- `bun run lint` runs with `--error-on-warnings` and reports 0 warnings. The backlog entry "Gate the lint warnings, not only complexity" is closed.
- Each helper exists once:
  - `pointer`/`at`, error-message, `queue()`, `utf8Length`, `isThenable` and `findChild` each have exactly one definition under `src/`. A test greps for re-implementations, using the patterns in Task 2.
  - The validator bundle (`scripts/validator-bundle.ts`) and the portability test still pass.
- `render()`'s byte count equals the validator's count for every tree in a 1,000-tree property test, and the literal offsets in `src/sdk/render.ts:538-584` are gone.
- No function under `src/` carries a `noExcessiveCognitiveComplexity` suppression without an A/B figure in its comment. Every split function's bench is within 2%.
- `src/__tests__/format-schema-differential.test.ts` shows two things. Every document a checker accepts, its published JSON Schema accepts too. Every structural mutation (a dropped required field, a wrong type, an unknown field) that the schema rejects, the checker rejects too.
- `@arnilo/liveframe@0.2.3` is on npm with provenance under `latest`, with `next` at or above it, and verified from the registry. The installed archive passes the API gate against the 0.2.2 baseline with an empty register.

This plan completes the 0.2.3 review-fix release in roadmap Phase 7. It follows plan 023's compatibility rules 1–8. Every refactor here is behaviour-preserving, which the existing tests, the corpus, the vectors and the API gate prove. Any task that would need a register entry stops and defers. Publishing cannot be undone, so no tag is pushed without the owner's explicit go (`docs/compatibility.md` § "Release process"). Spec sections touched: none in meaning. §13 (testing and tooling) gains the lint gate, and the docs gain the 0.2.3 notes.

## Tasks

- [x] Task 1: Remove dead code and needless internal exports, fix the lint warnings and gate them (R17, R18, R19)
  - Acceptance Criteria:
    - Functional:
      - Delete the following:
        - `manifestSchema` and `packageDefs` (`src/cli/mcp.ts:169,171`);
        - the unused `LiveframeError` import (`src/formats/catalog.ts:1`);
        - the orphaned doc comment "Compiles an install-validated language schema…" (`src/validate/schema.ts:39`), merged into or moved onto `compileSchema`;
        - the unused import in `proof/host/preview.ts` and the unused variable in `proof/scripts/inventory.ts:99`.
      - Drop the `export` keyword from `shadowLayers` (`src/formats/dtcg.ts:155`), `scenarioSchema` (`src/formats/package.ts:30`), `jsonScalarBytes` (`src/validate/structure.ts:110`) and `definitionSchema` (`src/formats/catalog.ts`). Each is used only in its own file, and none is in the 0.2.1 or 0.2.2 API baseline.
      - Fix every Biome warning. The 130 `noNonNullAssertion` warnings are fixed in `src/` with real narrowing. Under `src/__tests__/`, `bench/` and `proof/tests/`, a `biome.json` override turns the rule off, with a comment giving the reason: test fixtures assert presence by failing. No per-line suppressions are added.
      - `package.json` `lint` becomes `biome lint --error-on-warnings .`.
      - Close the backlog entry "Gate the lint warnings, not only complexity" with a link to this task.
    - Performance: n/a. No runtime path changes behaviour, and any narrowing in hot paths is a comparison the engine already does.
    - Code Quality: `graft callers <symbol> --depth all` is run for every deleted or un-exported symbol, and the output is recorded in the notes.
    - Security: n/a for the four laws.
    - Compatibility: the API gate stays empty. None of these symbols is public.
  - Approach:
    - Skills to Use:
      - `safe-refactor`; `find-docs` (Biome 2.6 `--error-on-warnings`, `overrides[].linter.rules`).
    - Library Documentation to Check Before Implementation:
      - Biome 2.6: the `lint` CLI flag `--error-on-warnings`; `biome.json` `overrides` with `includes`.
    - Documentation Reviewed:
      - `biome.json`; `plans/backlog.md` "Gate the lint warnings, not only complexity" (P3); the review's `bun run lint` (138 warnings, 130 `noNonNullAssertion`).
    - Options Considered:
      - Turn `noNonNullAssertion` off everywhere. Rejected: in `src/` an assertion hides a missing branch.
    - Chosen Approach:
      - Fix the warnings in source, turn the rule off for fixtures by override, and gate on warnings.
    - API Notes and Examples:
      ```json
      { "overrides": [{ "includes": ["src/__tests__/**", "bench/**", "proof/tests/**"],
          "linter": { "rules": { "style": { "noNonNullAssertion": "off" } } } }] }
      ```
    - Files to Create/Edit:
      - `src/cli/mcp.ts`; `src/formats/catalog.ts`; `src/formats/dtcg.ts`; `src/formats/package.ts`; `src/validate/structure.ts`; `src/validate/schema.ts`
      - `proof/host/preview.ts`; `proof/scripts/inventory.ts`; `biome.json`; `package.json`; `plans/backlog.md`
      - every `src/` file with a non-null assertion (the list is generated by `biome lint --reporter=summary` and recorded in the notes)
  - Test Cases to Write:
    - n/a, beyond the gate itself: `bun run lint` fails on any new warning. The existing tests prove no behaviour changed.
  - Notes (executed 2026-11-04):
    - Starting count: 142 warnings and 4 infos (134 `noNonNullAssertion`; the review counted 138). Now 0 warnings and 0 infos, and `bun run lint` is `biome lint --error-on-warnings .`. A temporary warning makes it exit 1.
    - Deleted: `manifestSchema` and `packageDefs` (`src/cli/mcp.ts`), and also `packageSchema`, whose only reader was `packageDefs`. Also deleted the `LiveframeError` import (`src/formats/catalog.ts`), the `Result` import (`proof/host/preview.ts`), and `causeOf` (`proof/scripts/inventory.ts`) with the `causes` table it alone read. The orphaned doc comment in `src/validate/schema.ts` now sits on `compileSchema`.
    - Un-exported: `shadowLayers`, `scenarioSchema`, `jsonScalarBytes`, `definitionSchema`. None appears in `scripts/release/api/0.2.2.json`.
    - Callers, recorded with `graft callers <symbol> --depth all`:
      - `jsonScalarBytes`: one direct caller, `walkJson` (`src/validate/structure.ts`), so un-exporting it is safe. Its transitive callers (`render.ts` `count`/`emit`, `tree.ts` `walk`/`compileTree`) all reach it through `walkJson`.
      - `causeOf`: no callers.
      - The graph does not index module-level constants: `manifestSchema`, `packageDefs`, `shadowLayers`, `scenarioSchema` and `definitionSchema` all gave "no symbol in the graph". `grep -rnw` over `src bench proof scripts conformance examples` stood in. `mcp.ts`'s `manifestSchema`/`packageDefs` had no reader; `src/formats/manifest.ts`'s exported `manifestSchema` is a different symbol and is kept. `shadowLayers`, `scenarioSchema` and `definitionSchema` are read only in their own files.
    - Narrowing in `src/` (the generated file list): `src/authoring/index.ts` (7), `src/formats/contrast.ts` (9) and `src/cli/draft-dir.ts` (3).
      - `src/authoring/index.ts`:
        - `renderOne` and `renderOutcomes` take the narrowed scenario and package as parameters.
        - The preview binding's `package()` returns `packed ?? pkg`. `packed` is never unset, so it always returns the latest packed draft.
        - Capture files go through `capturedFile`, which throws on a gap. The throw lands in the existing `captureFailure` catch.
        - The single outcome source is destructured.
      - `src/formats/contrast.ts`: `checkContrast` pairs each ratio with its pair, so it no longer indexes. It looks the colours up once and narrows them. A missing role, which `validateTheme` already makes impossible, is rejected instead of crashing.
      - `src/cli/draft-dir.ts` destructures `manifest.json`/`scenarios.json` from the read contents. The rest are exactly the sources, in the same order.
    - Deviations:
      - Biome 2.6.2 rejects comments in `biome.json`, so the config is now `biome.jsonc`, which Biome reads natively. That lets the override carry its reason.
      - The override also covers `proof/scripts/**` and `plans/evidence/**`. These are harness scripts, not shipped code, and the committed evidence scripts are records that should not be rewritten.
    - Other warnings were fixed in place rather than suppressed:
      - `useTemplate` ×3 and `useOptionalChain` in tests.
      - `noUselessFragments` in the proof primitives: `Glyph` returns the string itself.
      - `noTemplateCurlyInString` in `portability.test.ts`: the literal is now a template string with `\${`, so it holds the same characters.
      - `useDomNodeTextContent` in `surface_text_never_inherits_host_fonts`: `innerText` became `textContent`. This was Biome's own fix, and the browser suite passing in `bun run check` shows the check still holds. The `outcome.ts` pointer escape is left for Task 2.
    - Verification:
      - First `bun run check` (load average 95): build, `gen:check`, typecheck, lint and format check passed. 37 browser and proof tests failed with "Target page, context or browser has been closed" and timeouts.
      - Re-run `bun run test` at load average 10 → 5: 1041 pass, 0 fail, including `surface_text_never_inherits_host_fonts`. This is the same load sensitivity plan 023 recorded (Task 8 carry-over).

- [ ] Task 2: Share the small internal helpers (R20)
  - Acceptance Criteria:
    - Functional:
      - One internal module, `src/internal.ts` (host-API-free, not exported from any subpath), holds:
        - `pointerSegment(key)`: JSON Pointer escaping, with `src/schema.ts:313`'s no-escape fast path. It replaces the escapes at `src/schema.ts:313`, `src/validate/style.ts:30`, `src/pack/outcome.ts:43`, `src/pack/bundle.ts:28`, `src/validate/schema.ts:25`, `src/formats/vocabulary.ts:148`, `src/formats/capabilities.ts:172`, `src/sdk/elements.ts:89` and `src/authoring/index.ts:93`.
        - `errorMessage(error)`: replaces `src/authoring/index.ts:198`, `src/preview/in-process.ts:93`, `src/preview/worker/index.ts:15`, `src/runner-kit/render.ts:57` and `src/cli/draft-dir.ts:73`. `src/sdk/render.ts:42` keeps its own `thrownMessage`, because it also treats an empty message specially; say so in a comment.
        - `queue()`: a serial promise queue whose failed task does not break the chain. It replaces `src/cli/mcp.ts:512-515`, `src/authoring/index.ts:156-160`, `src/store/fs/index.ts:14,84-100` and `src/preview/worker/index.ts:40,154`. The `fileStore` queue stays module-global, which is its documented cross-instance semantics (`:13`).
        - `isThenable(value)`: replaces `src/sdk/render.ts:34-39`, `src/react/renderer.tsx:302` and `src/sdk/intents.ts:20`.
        - `utf8Length(text, maximum?)`: `src/validate/bytes.ts`'s `stringBytes` becomes this helper, or re-exports it. `src/pack/hash.ts`'s `utf8` keeps encoding but uses it for sizing. `src/formats/package.ts:65` `checkCodeSize` calls it.
      - A node-by-id child lookup is shared by `src/validate/offered.ts`, `src/validate/patch.ts` and authoring `setState` (`src/authoring/index.ts`). `setState` stops mapping every child when it has already found the one it needs.
      - Each call site's output is identical: pointers, messages and queue ordering are proven by the existing tests.
      - `src/__tests__/no-duplicate-helpers.test.ts` scans `src/` (excluding `__tests__` and `internal.ts`) and fails on any match of these patterns:
        - `replaceAll("~", "~0")` or `replace(/~/g`
        - `instanceof Error ? `
        - `.catch(() => {})` assigned to a queue tail
        - `typeof … .then === "function"`
    - Performance: `pointerSegment` keeps the fast path, and the validator bench is unchanged (A/B ratio ≤ 1.02 on `agent-home`). The other helpers are off the hot path.
    - Code Quality: one module of small functions. No class, and no options object. `graft callers` is run for every replaced local helper.
    - Security: n/a for the four laws. Error messages keep `kind`/`pointer`, and the queue keeps its failure isolation.
    - Compatibility: no public surface. The portability test covers `src/internal.ts`, and the validator bundle check confirms the bundle still contains no imports.
  - Approach:
    - Skills to Use:
      - `safe-refactor`: one helper at a time, with tests green between each.
    - Library Documentation to Check Before Implementation:
      - none. RFC 6901 §3 (escaping `~` before `/`).
    - Documentation Reviewed:
      - every site above, located while planning with `graft grep` and `grep -rn '~0' src`; `scripts/validator-bundle.ts`; `src/__tests__/portability.test.ts`.
    - Options Considered:
      - Put the helpers in `formats/json.ts`. Rejected: they are not format code, and the pack, CLI and React layers would import a formats module just for a queue.
      - Leave the duplicates. Rejected: the pointer escape has already drifted into three spellings (`replaceAll`, regex `replace`, and a fast path).
    - Chosen Approach:
      - One internal module, plus a guard test.
    - API Notes and Examples:
      ```ts
      export function queue(): <T>(work: () => Promise<T>) => Promise<T> {
        let tail: Promise<unknown> = Promise.resolve();
        return (work) => { const run = tail.then(work); tail = run.catch(() => {}); return run; };
      }
      ```
    - Files to Create/Edit:
      - `src/internal.ts`; every file listed in Functional
      - `src/__tests__/no-duplicate-helpers.test.ts`; `src/__tests__/internal.test.ts` (pointer escape order, queue isolation, `utf8Length` on astral characters and lone surrogates)
  - Test Cases to Write:
    - `pointer_segment_escapes_tilde_before_slash`: `"a/~b"` gives `"a~1~0b"`. Fails if the order is swapped.
    - `queue_runs_serially_and_survives_a_rejection`.
    - `utf8_length_matches_text_encoder`: random strings, including lone surrogates, counted against `TextEncoder` with U+FFFD replacement, as `stringBytes` does today.
    - `no_duplicate_helpers`: the guard.

- [ ] Task 3: Give the tree byte budget one owner (R21)
  - Acceptance Criteria:
    - Functional:
      - `src/validate/bytes.ts` exports the per-field byte rules as named functions: node opening, `id`, `kind`, `variant`, the `props`/`style`/`events` member, the children array and the tree fields. Both `compileTree` (`src/validate/tree.ts:238` and its neighbours) and `render()`'s `emit` (`src/sdk/render.ts:538-584`) use them. No byte literal such as `6 +`, `8 +`, `9`, `10` or `11` remains in either file.
      - A property test renders 1,000 generated widget outputs through `render()`. For each, `render()`'s accounted byte total equals the compiled validator's total for the same tree, and both equal `utf8Length(JSON.stringify(tree))` exactly. Spec §10 (`docs/spec.md:675`) defines tree size as the UTF-8 length of the tree's `JSON.stringify` output.
    - Performance: render bench ≤ 3 µs/node and validator ≤ 1.5 µs/node on the quiet-host run, with each A/B ratio ≤ 1.02. The helpers are small enough to inline; record the A/B figure.
    - Code Quality: the byte rules sit in one file, with one comment explaining the framing.
    - Security: law 2. The byte budget is a bound, and the property test proves both owners agree, so neither can admit a tree the other rejects.
    - Compatibility: identical errors and acceptance (rule 4). The corpus byte-limit cases pass unedited.
  - Approach:
    - Skills to Use:
      - `safe-refactor`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `src/sdk/render.ts:225-240,530-590`; `src/validate/tree.ts:97-110,230-245`; `src/validate/structure.ts` (`walkJson`, "one owner" comment); spec §10 (byte budget).
    - Options Considered:
      - Have `render()` call the validator's walk. Rejected: plan 005 made `render()` one pass for its ≤ 3 µs/node budget.
    - Chosen Approach:
      - Shared rule functions with a property test that both sides agree.
    - API Notes and Examples:
      ```ts
      export const nodeOpenBytes = (id: string, kind: string) => 6 + utf8Length(id) + 8 + utf8Length(kind); // {"id":…,"kind":…
      ```
    - Files to Create/Edit:
      - `src/validate/bytes.ts`; `src/validate/tree.ts`; `src/sdk/render.ts`
      - `src/__tests__/byte-budget-agreement.test.ts`
  - Test Cases to Write:
    - `render_and_validator_count_the_same_bytes`: fails if either side changes a rule alone.
    - The existing byte-limit tests in `sdk-render.test.tsx` and `tree.test.ts`, unedited.

- [ ] Task 4: Split the long render, validation and generator closures (R22)
  - Acceptance Criteria:
    - Functional:
      - `renderValue`/`emit` (`src/sdk/render.ts:68-617`, `emit` `:283-560`) are split along their natural seams: component expansion, key and sibling resolution, prop classification, and byte accounting (now Task 3's helpers). They become module-level functions that take an explicit render context object. Do the same for `compileTree`'s `walk` (`src/validate/tree.ts:136-245`, unless Task 4 of plan 024 already restructured it) and `gen.generate` (`src/sdk/gen.ts:296`).
      - Each `noExcessiveCognitiveComplexity` suppression is removed, or kept with its comment rewritten to cite the A/B figure that justifies it. For example: "splitting measured +4.1% µs/node, `plans/evidence/025-closure-splits.md`".
      - All existing tests pass unedited, and `gen:check` is byte-identical.
    - Performance: `bench/ab.ts` against the task's starting commit, 9 runs. `render.bench.ts` per-node and `validator.bench.ts` per-node ratios are ≤ 1.02 each, and `liveframe gen` on the proof catalog is ≤ 1.05. A split that misses its gate is reverted for that function only.
    - Code Quality: no function over 120 lines remains in these files without a cited figure. The render context is one plain object type, with no class.
    - Security: law 2 is unchanged. Validation and budget checks keep their order, and the existing law tests prove it.
    - Compatibility: identical outputs. No declaration change.
  - Approach:
    - Skills to Use:
      - `safe-refactor`; `karpathy-guidelines` (no speculative abstraction).
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - The review's function-size scan (`renderValue` 549 lines, `emit` 277, `compileTree` 243, `walk` 124, `gen.generate` 105); the suppressions at `src/sdk/render.ts:283`, `src/validate/tree.ts:136` and `src/sdk/gen.ts:296`, which cite per-node call cost without a measurement.
    - Options Considered:
      - Leave the closures. Rejected: their justification was never measured, and they are the hardest code in the repo to change safely.
    - Chosen Approach:
      - Split by seam, gate by A/B, and revert per function on a miss.
    - API Notes and Examples:
      - n/a. Internal.
    - Files to Create/Edit:
      - `src/sdk/render.ts`; `src/validate/tree.ts`; `src/sdk/gen.ts`; `plans/evidence/025-closure-splits.md`
  - Test Cases to Write:
    - n/a. Behaviour-preserving, proven by the existing SDK, validator, gen and corpus tests unedited, and by Task 3's agreement test.

- [ ] Task 5: Split `createRenderer`/`Surface` and `createAuthoring` (R23)
  - Acceptance Criteria:
    - Functional:
      - From `Surface` (`src/react/renderer.tsx:218-435`), extract into module-level functions or components with explicit inputs:
        - intent raising and confirmation (`raiseIntent`/`settled`, `:300-332`);
        - item construction (`context`, `:334-410`);
        - the arrival and accepted-tree reducer.
      - From `createAuthoring` (`src/authoring/index.ts:202-451`), extract render outcomes, `setState` and capture binding into module-level functions over a small session state.
      - All renderer, conformance-renderer (server and browser), preview-react, authoring and MCP tests pass unedited.
    - Performance: the streaming bench, whole-tree and patch, A/B ratio ≤ 1.02. The selection-update production measurement in `proof/tests/renderer-browser.test.tsx` is within 2%.
    - Code Quality: no React hook moves out of a component body. The `biome-ignore` at `:217` (`noComponentHookFactories`) stays or goes based on the final shape, with the reason written down.
    - Security: law 4. `checkOffered` and intent origin stamping are unchanged, and the existing intent and origin tests prove it.
    - Compatibility: `createRenderer`, `Surface` and `createAuthoring` declarations are byte-identical, so the API gate stays empty.
  - Approach:
    - Skills to Use:
      - `safe-refactor`; `liveframe-execution` (renderer reference); `find-docs` (React 19.3 rules of hooks, if a hook boundary moves).
    - Library Documentation to Check Before Implementation:
      - React 19.3: rules of hooks; `useMemo` dependency semantics.
    - Documentation Reviewed:
      - `src/react/renderer.tsx:166-440`; `src/authoring/index.ts:150-451`; plan 024 Task 2, which already moves fallback and diagnostics into contexts.
    - Options Considered:
      - Split into several files. Rejected: the pieces share private types. One file with module-level functions is enough.
    - Chosen Approach:
      - Extract by responsibility, inside the same file.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `src/react/renderer.tsx`; `src/authoring/index.ts`
  - Test Cases to Write:
    - n/a. Behaviour-preserving, proven by the existing suites unedited.

- [ ] Task 6: Detect drift between format checkers and published JSON Schemas (R24, patch-safe part)
  - Acceptance Criteria:
    - Functional:
      - `src/__tests__/format-schema-differential.test.ts` covers every format that has both an install checker and a published schema: vocabulary, catalog, capabilities, manifest, theme, design system, UI tree, tree patch, package, and the records. For each format:
        - seed with every valid corpus and fixture document;
        - generate 200 structural mutations per seed: drop a required field, retype a field, add an unknown field, empty a `minItems` array, overflow `maxItems`/`maxLength`;
        - assert that every document the checker accepts, `ajv` (2020-12, strict) accepts against the published schema;
        - assert that every structural mutation `ajv` rejects, the checker also rejects.
        Disagreements the schema cannot express (cross-field rules) are allowed in one direction only: checker-rejects/schema-accepts. They are listed by rule name in the test, never by document.
      - Fix any drift found by changing the checker or the schema, whichever disagrees with the spec. If the fix changes a published schema's bytes, or changes a checker outcome for a valid document, it is an API change: stop and defer it.
    - Performance: test-only. The test runs in under 20 s, with a fixed seed.
    - Code Quality: one test file and a small mutation generator. `ajv` is already a dev dependency (`package.json`).
    - Security: law 2. The published schemas are what ports such as Clay's validator implement, so drift would let a port accept what Liveframe rejects.
    - Compatibility: test-only, unless drift is found. A finding is handled as described in Functional.
  - Approach:
    - Skills to Use:
      - `find-docs`: ajv 8.20 (`Ajv2020`, `strict`, `addSchema` with `$id` URNs).
    - Library Documentation to Check Before Implementation:
      - ajv 8.20: `ajv/dist/2020`, `strict: true`, resolving `urn:liveframe:…` `$id`s.
    - Documentation Reviewed:
      - `src/__tests__/schemas.test.ts` (existing schema checks); `src/formats/catalog.ts:70-135` (the hand-written `definitionSchema`/`catalogSchema` beside the `obj`/`str` checker); `scripts/schemas.ts`.
    - Options Considered:
      - Generate the JSON Schemas from the checkers (one source). Rejected for 0.2.3: the published schema bytes must stay identical (rule 5), and that generator is a design project. It goes to the backlog as a 0.3.0 candidate.
    - Chosen Approach:
      - A differential test now; a single source later.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `src/__tests__/format-schema-differential.test.ts`; `plans/backlog.md` (single-source formats, P3)
  - Test Cases to Write:
    - The differential test itself. A mutant check confirms it catches drift: temporarily loosening one `maxItems` in a schema, under a test-only override, must fail it.

- [ ] Task 7: Write the 0.2.3 documentation, compatibility notes and 0.3.0 deferrals
  - Acceptance Criteria:
    - Functional:
      - `CHANGELOG.md` `## 0.2.3` collects the `Unreleased` lines from plans 023–025:
        - **Fixed**, naming the input classes that now fail: invalid custom-runner trees, top-level `await using`, malformed worker errors, corrupt placement records;
        - **Changed**: no sucrase dependency (if 023 Task 9 shipped), and MCP draft messages;
        - **Performance**: the 024 figures;
        - **Deprecated**: `fr` on dimension props.
      - `docs/compatibility.md` gains a `## 0.2.3` section stating that the register is empty and that a host upgrading from 0.2.2 changes nothing. It lists the outcome changes for invalid input. "Deferred to 0.3.0" gains entries with before/after, a code sample and an adopter checklist for:
        1. the immutability contract: `pack()`/`verifyPackage()` return frozen packages, and `render()` stops freezing caller inputs in place (R4, R5);
        2. rejecting `fr` on dimension props (R9; written by 023 Task 7 and checked here);
        3. a verified-package cache option for `loadPlacement` (R15).
      - `docs/adopters-0.2.md` gains a 0.2.3 note. `docs/renderer.md` and `docs/security.md` match the code, after 023 Tasks 2 and 4 and 024 Task 2.
      - `plans/backlog.md` gains or updates entries for:
        - every 0.3.0 deferral;
        - the handle-based draft read (023 Task 6);
        - single-source formats (Task 6);
        - each R16 item recorded as "no change".
    - Performance: n/a.
    - Code Quality: docs are written for outsiders. The `register_host_actions_appear_in_adopter_notes` test passes trivially, because the register is empty.
    - Security: `docs/security.md` items 3 and 4 match the host-validation and hash-cache behaviour.
    - Compatibility: this is the compatibility record.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - plan 022 Task 13 and Task 17 (model and corrections); `docs/compatibility.md`; `docs/adopters-0.2.md`; `CHANGELOG.md`.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - Follow plan 022 Task 13's structure.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `CHANGELOG.md`; `docs/compatibility.md`; `docs/adopters-0.2.md`; `docs/renderer.md`; `docs/security.md`; `plans/backlog.md`
  - Test Cases to Write:
    - n/a. The existing doc tests (`renderer-guide.test.tsx`, `preview-guide.test.ts`, `mcp-guide.test.ts`) run the guide code.

- [ ] Task 8: Prove every acceptance bullet of plans 023–025 against the checkout
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/025-acceptance.md` names a passing test or evidence record for every Expected Outcome bullet and every task criterion of plans 023, 024 and 025.
      - `git diff v0.2.2 -- src/__tests__ proof/tests conformance` shows only additions, plus the edits this plan set names: lint narrowing, comments, `api-stability.test.ts`'s added case.
      - `bun run check`, `bun run bench` (quiet host, or A/B records if the host is loaded), `bun run release:gate`, `bun scripts/release/peer-floors.ts` and `bun run demo:test` pass.
      - Plan 023 carry-over (its Task 10, F4): `bun run check` passes in full on a quiet host (1-minute load average below 2, recorded with `uptime`); plan 023 Tasks 5, 6, 8 and 9 each saw wall-clock tests fail at load 16–27. Repeat the `pack()` time comparison of 023 Task 9 (median of 20 packs of the five proof widgets, `dist/pack` against the 0.2.2 archive, within 5%) and append both results to the backlog entry "Re-run the full benchmark suite on a quiet host".
    - Performance: every bench gate passes, including `validator.bench.ts`'s `compileValidator` 0.25 ms gate, which fails the run since plan 024 Task 7 (before, it was set after the exit code and never failed). The 024 targets are re-measured. Three were missed and backlogged in plan 024 (its Compromises): `sha256` 2× per MB (achieved 1.3–1.5×), `packageHash` ≤ 5 ms on 512 KB (not reproducible on the loaded host) and the R14 15% walk gain (measured, no change). For those, the acceptance table cites the 024 evidence record as "missed, backlogged" and re-measures against the achieved figure, not the original target.
    - Code Quality: n/a. Verification.
    - Security: the host-API-free scan, the law tests, `bun audit --prod --audit-level=high` and the SBOM test pass.
    - Compatibility: `api-stability.test.ts` passes against both baselines. A scratch host built from the unmodified 0.2.2 demo host code, upgraded to the checkout's packed archive, passes `demo:test`.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - plan 022 Task 14 (model).
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - One acceptance table.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/025-acceptance.md`
  - Test Cases to Write:
    - n/a.

- [ ] Task 9: Publish 0.2.3-rc.1 under `next` and verify it from the registry
  - Acceptance Criteria:
    - Functional:
      - `package.json` is `0.2.3-rc.1`, and `CHANGELOG.md` has a dated rc entry. The owner's go is recorded before the tag is pushed.
      - Pre-release blockers from plan 023 Task 8 (its Task 10, F2), checked before the tag is pushed and recorded with evidence: the `release` environment exists with required reviewers and a `v*` tag rule, and the npm trusted publisher names it if npm supports that. A tag-only rule also blocks a `workflow_dispatch` dry run from a branch (the job declares the environment), so the owner chooses between a tag-only rule, with dry runs dispatched on a tag, and reviewers only.
      - The publish runs from the tag, inside the `release` environment (023 Task 8). After it, record the following from the registry in `plans/evidence/025-release-candidate.md`:
        - `npm view @arnilo/liveframe dist-tags`;
        - `npm audit signatures --include-attestations`;
        - `bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.3-rc.1`;
        - the API comparison of the installed archive against `0.2.2.json` with an empty register;
        - the SBOM artifact.
    - Performance: n/a.
    - Code Quality: follows `docs/compatibility.md` § "Release process".
    - Security: provenance is verified, and the environment approval is recorded.
    - Compatibility: the installed rc passes the API comparison.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - plan 022 Task 15 (model).
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - The documented release process.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `package.json`; `CHANGELOG.md`; `plans/evidence/025-release-candidate.md`
  - Test Cases to Write:
    - n/a.

- [ ] Task 10: Review readiness with the owner, then publish 0.2.3 and verify it
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/025-release-readiness-review.md` lists every row R1–R26 as one of:
        - `fixed`, with evidence;
        - `measured, no change`;
        - `deferred to 0.3.0`, with its entry;
        - `backlog`, with the owner's approval.
      - The owner answers go, in words. `0.2.3` is published under `latest`, and `next` is at or above it.
      - If the dist-tag step fails again (backlog "Enable trusted-publisher dist-tag management…", P3), record the owner's manual `npm dist-tag add`. The registry verification goes in `plans/evidence/025-release.md`.
      - `roadmap.md` §3 records plans 023–025 as complete.
    - Performance: n/a.
    - Code Quality: as Task 9.
    - Security: provenance is verified.
    - Compatibility: as Task 9, against the final archive.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - plan 022 Task 16 (model).
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - The documented release process.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `package.json`; `CHANGELOG.md`; `plans/evidence/025-release-readiness-review.md`; `plans/evidence/025-release.md`; `roadmap.md` §3
  - Test Cases to Write:
    - n/a.

- [ ] Task 11: Analyze architectural impact and dispose of every finding
  - Sweep the impact areas in `.agents/skills/create-plan/references/liveframe.md` §5 against everything plans 023–025 delivered. Record each area, or `None — <reason>`, in `plans/evidence/025-impact-analysis.md`. Present the findings with a recommended `execute`/`backlog` disposition, record the owner's answer, and execute or backlog each item. Then run the backlog handoff for all three plans (`create-plan` § Execution updates).

## Verification (whole plan)

- `timeout 900 bun run check`
- `timeout 120 bun run lint`
- `timeout 600 bun run bench`
- `timeout 300 bun run release:gate`
- `timeout 900 bun scripts/release/peer-floors.ts`
- `timeout 600 bun run demo:test`
- `timeout 60 bun audit --prod --audit-level=high`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
