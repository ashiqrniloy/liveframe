# Phase 7 Part H: Clay's 0.2.0 Review and Release 0.2.1

Depends on: plan [020](020-Phase-7-Part-G-Release-0-2-0.md) complete (0.2.0 published, impact findings disposed).

## Objectives

- Close every item in [Clay's 0.2.0 review](requests/clay-0.2.1-requests.md) (CL-10 to CL-16):
  - a JSON-only clone in `checkOffered`, a runtime matrix that is true and checked by CI, and a self-contained validator bundle (CL-10);
  - real package hashes in the corpus, failing package cases, package-hash vectors, and `canonicalJson`/`packageHash` exported from `/pack` (CL-11);
  - a realm-specific error for inputs created in another realm (CL-12);
  - `./package.json` and the conformance data resolvable through `exports` (CL-13);
  - `next` kept at or above `latest` (CL-14);
  - an optional, versioned tree-patch format with `diffTrees` and `applyPatch`, measured against LF-17's fixed subject and thresholds (CL-15);
  - a diagnosed WebKit switching cost, with the 16.67 ms budget asserted on the library's measurement in WebKit (CL-16).
- Ship the four post-0.2.0 documentation corrections (backlog "Ship the post-0.2.0 documentation corrections").
- Publish `0.2.1-rc.N` under `next` and verify it from the registry, review readiness with the owner, then publish `0.2.1` as `latest` and verify it so Clay can re-run its release-review scripts.

## Expected Outcome

- `@arnilo/liveframe@0.2.1` is on npm with provenance under `latest`, and `npm view @arnilo/liveframe dist-tags` shows `next` at or above `latest`.
- The archive ships `dist/validator.bundle.js`. A bare Node `vm` context with no globals added validates a corpus tree and runs `checkOffered` with the same results as the root export.
- `conformance/corpus/package/` runs through `verifyPackage` and includes a `hash-mismatch` case and a `forbidden-import` case. `conformance/hash/packages.json` pins package hashes, and both are checked through the public exports.
- `liveframe/tree-patch/1` has a TS type, a published JSON Schema, a spec section, corpus cases and vectors. For matching catalog/surface and increasing revisions, `applyPatch(prev, diffTrees(prev, next))` deep-equals `next` for every supported corpus tree pair; explicit empty children receive the approved `invalid-document` rejection and whole-tree fallback. The LF-17 subject streamed as patches is at or under 1 KiB gzip and 8 ms arrival validation plus commit per update (median).
- A WebKit test asserts the switching budget at 16.67 ms on the measurement the diagnosis shows to be the library's, with no WebKit-only ceiling above it.
- `CHANGELOG.md` has a 0.2.1 entry, `docs/adopters-0.2.md` maps CL-10 to CL-16 to what shipped, and `plans/evidence/021-request-acceptance.md` names a passing test or record for every acceptance bullet.

This plan answers Clay's review of the installed 0.2.0 archive. It belongs to roadmap Phase 7 (reference hosts) as its first patch release, and follows plan 020's release process (`docs/compatibility.md` § "Release process"). The owner set the release target to 0.2.1 and, on 2026-10-30, answered the review's two R15 policy questions. First, additive exports, corpus cases and vectors may ship in a patch ("Yes, additive in patch"). Second, tree patches ride 0.2.1 in this one plan ("0.2.1, one plan"). Task 1 records both answers in a decision log. The tree-patch tasks (9 to 12) lift a spec §14 non-goal, so they wait for Task 2's design log and its separate owner approval. Nothing here changes an existing export, format meaning, corpus expectation or hash vector, and whole trees keep working unchanged. Publishing cannot be undone, so no tag is pushed without the owner's explicit go. Spec sections touched: §7.3 (package hash), §9 (wire format), §10 (validation), §11 (renderer), §12 (switching budget), §13 (packages, runtime matrix, conformance) and §14 (non-goals).

## Tasks

- [x] Task 1: Record the 0.2.1 scope and patch-content decision
  - Acceptance Criteria:
    - Functional:
      - A decision log records the owner's two answers verbatim, with the date 2026-10-30:
        - additive exports, corpus cases and vectors (CL-10, CL-11, CL-13) ship in a patch;
        - CL-15 tree patches ship in 0.2.1 under this plan, gated on Task 2's design approval.
      - The log also settles two corpus-scope questions, each with the owner's answer:
        - package corpus cases run through `verifyPackage` (the integrity check), not only `validateWidgetPackageShape`;
        - `forbidden-import` is in the corpus's scope, so a port that verifies packages must also check the SDK-only import rule.
      - `docs/compatibility.md` § Versions names additive exports, error kinds, corpus cases, hash vectors and new optional format versions as allowed patch content. It keeps "never breaks the public API, the formats or the on-disk layout". It gains a `## 0.2.1` section that lists what the release adds.
    - Performance: n/a — a policy record.
    - Code Quality: the log follows `create-decision-log`. The compatibility text and the log say the same thing.
    - Security: n/a. No law changes. The log notes that the patch format leaves law 2 intact, because a patched tree is validated whole before the renderer reads it (Task 2 makes this binding).
  - Approach:
    - Skills to Use:
      - `create-decision-log`: the owner's answers explicitly approve the two policy questions. On 2026-10-30 the owner also approved both corpus-scope questions: “Yes to both (recommended)”.
    - Library Documentation to Check Before Implementation:
      - none. Local: `docs/compatibility.md` § Versions, § Formats, § Growth.
    - Documentation Reviewed:
      - `plans/requests/clay-0.2.1-requests.md` (Release target, R15 questions).
      - `decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md` (R15).
      - `decision-logs/2026-10-27-2028-release-0-2-0-scope-and-breaking-changes.md` (precedent shape).
      - `src/__tests__/corpus.test.ts:52` (package cases list only `invalid-document` and `limit-exceeded`) and `:63-73` (`hash-mismatch` and `forbidden-import` are listed as non-format kinds).
    - Options Considered:
      - Ship fixes only in 0.2.1 and the additions in 0.3.0. Rejected by the owner.
      - Carry tree patches in a separate 0.3.0 plan. Rejected by the owner.
      - Keep `forbidden-import` out of the corpus. Not recommended: a port that skips the import rule would load a package that imports outside the SDK, and the corpus is how ports prove they hold the rule. The owner decides.
    - Chosen Approach:
      - One log for the release scope and corpus scope, then the compatibility text.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `decision-logs/2026-10-30-HHMM-release-0-2-1-scope-and-patch-content.md` (new)
      - `docs/compatibility.md`
  - Test Cases to Write:
    - `docs-links` and `docs-wording` (existing) cover the edited compatibility page. No new test.
  - Notes (executed 2026-10-30):
    - Recorded the two release-policy answers verbatim and the owner's “Yes to both (recommended)” approval of `verifyPackage` and `forbidden-import` corpus scope in [the scope decision](../decision-logs/2026-10-30-1914-release-0-2-1-scope-and-patch-content.md).
    - Updated `docs/compatibility.md` Versions and added the 0.2.1 scope, preserving the no-break promise and fixed existing format meanings, corpus expectations and hash vectors. Tree patches remain gated on Task 2's separate design approval and whole-tree validation before render; no spec meaning changed in this task.
    - `timeout 900s bun run check` passed: 847 tests passed, 4 skipped, 0 failed. The final compatibility text also passed the focused `docs-links` and `docs-wording` run (3 tests). No new test was needed for this policy record.

- [x] Task 2: Design the tree-patch format (CL-15)
  - Acceptance Criteria:
    - Functional:
      - A decision log, approved by the owner, fixes the following. Tasks 9 to 12 implement exactly what it says.
        - **Shape.** `liveframe/tree-patch/1`: `{ format, catalogId, surfaceId, base, revision, ops }`, where `base` is the revision the patch applies to and `revision > base`.
        - **Operations,** addressed by node `id` and applied in order:
          - `set`: replace a node's own fields (`kind`, `variant`, `props`, `style`, `events`) and keep its children;
          - `insert`: `{ parent, index, node }`;
          - `remove`: `{ id }`;
          - `move`: `{ id, index }` within the current parent.
          - Ids are key paths (spec §9), so a node that changes parent is a `remove` plus an `insert`.
        - **Base identity.** A patch whose `surfaceId` or `base` differs from the given tree fails as `stale-patch`. The log records whether a base content hash is added, and why. The recommendation is no: the revision is already monotonic per surface (spec §9), and hashing a 118 KB tree on every update costs more than the patch saves.
        - **Error kinds.** `stale-patch` (new and additive). `not-found` for an op whose target id is absent. `invalid-document` for a malformed patch or `revision ≤ base`.
        - **Validation.** `applyPatch` is structural only. The patched tree is then validated whole with `validator.validateTree`, which is what `<Surface>` arrival validation and host validation already do, so law 2 is unchanged. Incremental validation is not built. The log may adopt it later only with a measurement and identical results.
        - **Transport.** `<Surface>` keeps taking a whole `tree`. A browser host applies the patch with `applyPatch` and passes the result, because `applyPatch` is host-API-free and in the root export. The log records the rejected alternative, a `patch` prop on `<Surface>`.
        - **`checkOffered`.** No semantic change: an origin names the revision the patch produced.
        - **Diffing.** `diffTrees(prev, next)` is deterministic: the same inputs always produce byte-identical canonical JSON, so the vectors are stable. The owner-approved correction restricts diff inputs to SDK form (empty children omitted), returning `invalid-document` for whole-tree fallback on explicit empty children; supported pairs round-trip exactly.
        - **Measurement.** LF-17's subject and thresholds are reused unchanged (`decision-logs/2026-10-29-1737-streaming-tree-patches.md`).
      - The spec edits are drafted in the log: §9 (patches as an optional transport, whole trees stay valid), §14 (strike "Tree patches", keep "A2UI or other wire interop"), §13 (root-export row, schemas list, corpus and vectors).
    - Performance: the log states the budgets that Tasks 9 to 12 must meet:
      - `applyPatch` ≤ 0.5 ms for a one-row patch on the 679-node subject;
      - `diffTrees` ≤ 1.5 ms per revision on the same subject (host side, recorded, not in Clay's budget);
      - ≤ 1 KiB gzip and ≤ 8 ms arrival validation plus commit, median.
    - Code Quality: the design adds four operations and two functions, and nothing speculative (no JSON Patch pointers, no op batching beyond `ops[]`).
    - Security: laws 1 and 2. A patch is data from the same untrusted transport as a tree. It carries no code, and the result is validated whole before render. A malformed or stale patch fails closed, and the host can then re-send a whole tree.
  - Approach:
    - Skills to Use:
      - `create-decision-log`: a new wire contract that lifts a §14 non-goal needs explicit owner approval.
      - `liveframe-execution`: the four laws and placement.
    - Library Documentation to Check Before Implementation:
      - none (no library). Read RFC 6902 (JSON Patch) only to record why it is rejected.
    - Documentation Reviewed:
      - `docs/spec.md` §9 (`:569-598`), §11 (`:651-681`), §14 (`:792-799`).
      - `decision-logs/2026-10-29-1737-streaming-tree-patches.md`.
      - `plans/evidence/019-streaming-bench.md`.
      - `src/react/renderer.tsx:166` (arrival validation on every `tree`), `:175` (lower revision ignored), `:212-300` (the tree memo rebuilds every node context per tree).
      - `src/validate/offered.ts:50-90` (`checkOffered` keys on `surfaceId`/`revision` and indexes nodes per tree object).
    - Options Considered:
      - RFC 6902 JSON Patch over the tree. Rejected: array-index pointers break when siblings move, it is not addressed by stable node ids, and every port would need a JSON Pointer engine.
      - A `patch` prop on `<Surface>`. Rejected for now: a stale patch could only render the fallback, while a host that applies the patch itself sees `stale-patch` and can re-request a whole tree. It also adds renderer state, when `applyPatch` plus `tree` needs no new renderer API.
      - Incremental validation of touched nodes only. Deferred: 1.4 ms whole-tree validation fits inside 8 ms, and an identical-results proof is costly. Revisit only on a measurement.
      - A base content hash. Recommended against (see Functional). The owner decides.
    - Chosen Approach:
      - Id-addressed ops with structural sharing, whole-tree validation, and host-side application. It is the fewest new surfaces that meet Clay's acceptance list.
    - API Notes and Examples:
      ```ts
      type TreePatch = {
        format: "liveframe/tree-patch/1";
        catalogId: string;
        surfaceId: string;
        base: number;
        revision: number;
        ops: PatchOp[];
      };
      type PatchOp =
        | { op: "set"; id: string; kind: string; variant?: string; props: Record<string, Json>; style?: Record<string, Json>; events?: Record<string, Intent> }
        | { op: "insert"; parent: string; index: number; node: UiNode }
        | { op: "remove"; id: string }
        | { op: "move"; id: string; index: number };
      declare function diffTrees(prev: UiTree, next: UiTree): Result<TreePatch>;
      declare function applyPatch(base: UiTree, patch: unknown): Result<UiTree>;
      ```
    - Files to Create/Edit:
      - `decision-logs/2026-10-30-1928-tree-patch-format.md` (new)
      - This plan (approved Task 9/10 corrections and completion notes); `roadmap.md` §3 (execution status).
  - Test Cases to Write:
    - None. The log fixes what Tasks 9 to 12 test.
  - Notes (executed 2026-10-30):
    - The owner answered “Approve the proposal and plan corrections”. Recorded the [approved format decision](../decision-logs/2026-10-30-1928-tree-patch-format.md): ordered op semantics, deterministic diff order, identity/errors, host-side application, no base hash, whole-tree validation, draft spec edits and unchanged LF-17 budgets. The normative spec changes in Task 9 when the format ships.
    - Corrected Tasks 9 and 10 to match the approved design. Four ops cannot reproduce every omitted-versus-empty children representation, so diffing requires SDK-form inputs and otherwise returns `invalid-document` for whole-tree fallback. Validated trees are not frozen today; application follows the existing readonly ownership contract without freezing caller objects. Schema parity covers standalone shape, with cross-field revision ordering tested separately.
    - `timeout 900s bun run check` passed: 847 tests passed, 4 skipped, 0 failed. The final documentation also passed the focused `docs-links` and `docs-wording` run (3 tests), and `git diff --check` passed. No runtime implementation, new tests or patch performance claims belong to this design task; Tasks 9–12 provide those.

- [x] Task 3: Clone intents without `structuredClone` and make the runtime matrix true (CL-10)
  - Acceptance Criteria:
    - Functional:
      - `complete()` copies and freezes the intent in one JSON-only walk. `checkOffered` and `<Surface>` emissions return results identical to today's: a fresh, deeply frozen, complete intent. An explicit `setState` value and a `bindAll` object are copied, not aliased.
      - `/authoring` counts bytes with the library's own UTF-8 encoder (`src/pack/hash.ts:56`) instead of `TextEncoder`. Where a WHATWG global cannot reasonably be removed (`/preview` `setTimeout`, `/preview/capture` `TextEncoder`/`TextDecoder`/`URL`), the runtime matrix names it.
      - The README and spec §13 runtime matrix list, per host-API-free subpath, the non-ECMAScript globals it needs ("none" for the root export, `/sdk`, `/pack`, `/store`, `/runner-kit`, `/conformance`, unless the scan finds otherwise).
      - The portability scan rejects non-ECMAScript globals (`structuredClone`, `TextEncoder`, `TextDecoder`, `URL`, `URLSearchParams`, `setTimeout`, `setInterval`, `clearTimeout`, `queueMicrotask`, `crypto`, `atob`, `btoa`, `performance`, `AbortController`, `console`) in host-API-free source and compiled output. The only exceptions are a per-subpath allowlist that mirrors the matrix, and every allowlisted global appears in the matrix.
    - Performance: the intent path walks once instead of twice (clone, then freeze). `bun run bench` shows no regression.
    - Code Quality: one helper (for example `frozenJsonCopy`) next to `validateJson` in `src/formats/json.ts`, used by `complete()`. The allowlist lives in `portability.test.ts`'s `subpaths` table, not in scattered regex exceptions.
    - Security: law 4. Intents stay frozen copies, so an implementation cannot mutate an intent after emitting it. The scan fails closed when a new global appears without a matrix entry.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`: host-API-free core.
      - `surgical-patch`: a narrow fix with regression proof.
      - `find-docs`: verify the installed Acorn tokenizer API used by the portability gate.
    - Library Documentation to Check Before Implementation:
      - ECMAScript 2022 global object (§19) to confirm the list is not ECMAScript; WHATWG HTML (timers), Encoding and URL standards. Acorn 8.19.0 tokenizer identifier tokens.
    - Documentation Reviewed:
      - `src/validate/complete.ts:3-29` (`structuredClone` at `:20`, then a separate freeze walk).
      - `src/authoring/index.ts:151,303`; `src/preview/in-process.ts:14-16`; `src/preview/capture/index.ts:121-123`.
      - `src/__tests__/portability.test.ts:4-18` (subpaths table) and `:57-83` (`scanHostApiFree`).
      - `README.md:32`; `docs/spec.md:756`; `docs/sdk.md:46`.
      - [ECMAScript 2022 §19](https://262.ecma-international.org/13.0/#sec-global-object), WHATWG [timers](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers), [Encoding](https://encoding.spec.whatwg.org/#interface-textencoder) and [URL](https://url.spec.whatwg.org/#url) standards.
      - [Acorn tokenizer API](https://github.com/acornjs/acorn/blob/master/_autodocs/api-reference/tokenizer.md), fetched with Context7 for the installed Acorn 8.19.0: identifier tokens exclude comments and string contents.
    - Options Considered:
      - `JSON.parse(JSON.stringify(x))`. Rejected: three walks (stringify, parse, freeze) on every emit.
      - Keep `structuredClone` behind a feature check. Rejected: two code paths, and the fallback is the one that matters.
      - Remove every WHATWG global, including `URL` in capture. Rejected: capture runs beside Playwright and parses page URLs, so naming the global costs nothing and rewriting URL parsing is risk with no reader.
    - Chosen Approach:
      - Copy and freeze in one walk, remove the cheap uses, and name the rest in a matrix that CI enforces. Tokenize transpiled JavaScript with the installed Acorn to avoid matching comments and literal strings; use the same per-subpath allowlist for source, compiled output and browser bundles. Include guarded globals found in bundled dependencies in the matrix rather than adding regex exceptions.
    - API Notes and Examples:
      ```ts
      /** A deep, frozen copy of a JSON value; inputs are already validated JSON. */
      export function frozenJsonCopy<T extends Json>(value: T): T;
      ```
    - Files to Create/Edit:
      - `src/formats/json.ts`; `src/validate/complete.ts`; `src/authoring/index.ts`
      - `src/__tests__/portability.test.ts`; `src/__tests__/offered.test.ts` (or `react-intents.test.tsx`)
      - `README.md`; `docs/spec.md` §13; `docs/sdk.md` (the "any ES2022 runtime" line); `roadmap.md` §3 (task completion)
  - Test Cases to Write:
    - `complete_returns_a_frozen_copy_without_structured_clone`: deletes `globalThis.structuredClone` for the test, then completes a `setState`, a `bind` and a `bindAll` intent and asserts deep-frozen, unaliased results. Fails if `structuredClone` returns, or if the copy aliases the input.
    - `host_api_free_subpaths_use_only_matrix_globals`: scans source and `dist/`, and fails on a non-ECMAScript global outside the subpath's allowlist. Mutant: re-adding `structuredClone` to `complete.ts` fails it.
    - `runtime_matrix_names_every_allowlisted_global`: parses the spec §13 matrix and asserts it equals the allowlist. Fails if docs and scan drift.

  - Notes (executed 2026-10-30):
    - Added internal `frozenJsonCopy` beside `validateJson`; `complete()` now copies and freezes validated JSON in one recursive walk, safely retaining own `__proto__` keys. The regression first failed on the old `structuredClone` call, then passed with that global deleted for explicit/carried state, `bind`, `bindAll` and `checkOffered`. It checks nested arrays/objects, frozen outputs, fresh references and unfrozen inputs; existing renderer emission tests also passed.
    - Reused `utf8` for authoring's tree-byte limit. Kept capture's Encoding/URL APIs and preview's timers, and made README, spec §13 and SDK portability wording agree with the scan. The scan also found guarded `console` references in Acorn and optional `TextDecoder` references in the packer's source-map codec; the matrix and per-subpath allowlist include those transitive references. No public export or format meaning changed; §13's runtime claims are now explicit.
    - The portability gate tokenizes JavaScript, ignoring comments and literal text while checking interpolated expressions. It checks host-API-free source, compiled output and browser bundles against the table, with a docs/table equality test. Temporarily replacing completion with `structuredClone` made the source gate fail; restored the implementation before final checks.
    - `timeout 900s bun run check` passed: 853 tests passed, 4 skipped, 0 failed. `timeout 180s bun run bench` passed. The pre-change bench failed the existing agent-home validator timing gate (1.992 µs/node); the final run measured 1.288 µs/node and 1.944 µs/node total render. An additional nested `bindAll` comparison against HEAD's completion (7 batches of 10,000, after 2,000 warm-ups) measured medians of 4.30 µs before and 2.08 µs after. Benchmark-generated plan 019 evidence was restored, so this task does not rewrite earlier evidence. Task 4 still owns the validator bundle and bare-vm proof.

- [x] Task 4: Publish the validator bundle (CL-10)
  - Acceptance Criteria:
    - Functional:
      - `dist/validator.bundle.js` is one self-contained ES module that re-exports the root export (`compileValidator`, `checkOffered`, `capabilitiesFor`, every `validate*`, the recipe resolver, and, after Task 9, `applyPatch`/`diffTrees`). `exports` has `"./validator.bundle.js"`.
      - The archive gate parses it with `assertSelfContained` and finds no imports, no `import.meta`, no `node:`/`bun:` specifier, and no host reference. The same non-ECMAScript global scan as Task 3 runs on it.
      - A bare Node `vm` context with no globals added loads the bundle, validates a corpus tree (`conformance/corpus/ui-tree/docs/valid.json` with its common catalog, capabilities and manifest), compiles a validator, and runs `checkOffered` on one accepted and one forged intent. Results are identical to the root export's.
      - Spec §13's package table and `docs/packages.md` describe the bundle and why it is separate from the runner kit: a validating host never renders.
    - Performance: record the bundle size (Clay measured 69,734 B for the root export). There is no budget, but a growth of more than 20% from Task 9 is called out in its notes.
    - Code Quality: one entry file, `scripts/validator-bundle.ts` (`export * from "../src/index.ts"`), built by the same `Bun.build` call shape as the runner kit in `scripts/build.ts:21-35`. The two bundles share one build helper, not a copy.
    - Security: law 1. The bundle contains no SDK render path and no `renderModule`, so a validating isolate never runs widget code. A test asserts that `renderModule`, `render` and `linkPackage` are absent from its exports.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`: public surface and `exports` together.
      - `find-docs`: Bun `Bun.build` (`target: "browser"`, `format: "esm"`, `splitting: false`) and Node `vm.SourceTextModule.linkRequests`, for the versions in use.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.x `Bun.build` options.
      - Node ≥ 24 `vm.SourceTextModule` (`linkRequests`, `instantiate`, `evaluate`), as used by `scripts/release/fixtures/vm-bundle.mjs`.
    - Documentation Reviewed:
      - `scripts/runner-kit-bundle.ts`; `scripts/build.ts:21-35`; `scripts/release/bundle-check.ts:10-30`.
      - `scripts/release/archive-gate.ts:142-157` (bundle step).
      - `src/__tests__/runner-bundle.test.ts:40-84` (vm test pattern).
      - Bun 1.4.2 bundler documentation via Context7 (`/oven-sh/bun/bun-v1.4.2`): browser target, ESM output, disabled splitting and minification. Node's v24 API documentation via Context7: `SourceTextModule` context, `linkRequests`, `instantiate` and `evaluate`; exercised locally on Node 26.11.1.
    - Options Considered:
      - Grow `runner-kit.bundle.js` with the validator exports. Rejected: Clay's kernel never renders, and loading the runner kit puts `renderModule` in a trusted isolate (Clay's stated reason).
      - A curated export list. Rejected: it drifts from the root export, and the root export is already host-API-free.
    - Chosen Approach:
      - Bundle the root export as-is, under the same gate as the runner kit.
    - API Notes and Examples:
      ```js
      import * as lf from "@arnilo/liveframe/validator.bundle.js";
      const v = lf.compileValidator({ catalog, capabilities, manifest });
      v.validateTree(tree); lf.checkOffered(tree, origin, intent, v);
      ```
    - Files to Create/Edit:
      - `scripts/validator-bundle.ts` (new); `scripts/build.ts`; `package.json` (`exports`)
      - `scripts/release/archive-gate.ts`; `scripts/release/fixtures/vm-validator.mjs` (new)
      - `src/__tests__/validator-bundle.test.ts` (new); `src/__tests__/exports.test.ts`; `src/__tests__/archive.test.ts` (permit and check both bare-file bundle exports)
      - `docs/spec.md` §13; `docs/packages.md`; `README.md`
  - Test Cases to Write:
    - `validator_bundle_is_self_contained`: `assertSelfContained` passes, and the export names equal the root export's. Fails on any import or a missing export.
    - `validator_bundle_omits_the_render_path`: no `renderModule`, `render` or `linkPackage`. Fails if the entry re-exports the SDK.
    - `validator_bundle_validates_under_bare_vm`: in a `vm.createContext({})` context, validates the corpus tree and runs `checkOffered` (accept plus forged revision), and its JSON results deep-equal the root export's. Fails if any non-ECMAScript global is reached (for example a reintroduced `structuredClone`).
    - The archive gate step "validator bundle packed and self-contained" fails on an unpacked or impure bundle.
  - Notes (executed 2026-10-30):
    - Added `scripts/validator-bundle.ts`, re-exporting the root namespace, and `./validator.bundle.js`. Both bundles use one build helper. The validator bundle is **69,787 B** (baseline for Task 9's 20% growth check), with no SDK render exports or new dependencies.
    - Added self-containment, root-export parity, render-path exclusion, public-subpath resolution and bare-VM parity tests. On Node 26.11.1, `vm.createContext({})` validates the corpus tree and accepts/rejects the same intents as the root module; transported inputs are parsed inside the context. The existing compiled-output portability test scans the new bundle with Task 3's non-ECMAScript global checks and no exceptions.
    - Extended the archive export test and release gate to check the new bundle. `timeout 600s bun run release:gate` passed all 12 steps, including "validator bundle packed and self-contained". Updated README, spec §13 and the package guide with the validator-only namespace and realm-local loading example. No existing format meaning changed.
    - `timeout 900s bun run check` passed: **857 passed, 4 skipped, 0 failed**. The first run exposed the archive test's runner-only allowlist (fixed) and two browser switching timing failures (24.5/26.1 ms); both passed a focused rerun (9.7/9.6 ms maxima) and the final full run with unchanged limits. The focused bundle/export/portability run also passed all 37 tests. No registry publication or tag push belongs to this task.

- [x] Task 5: Report inputs from another realm (CL-12)
  - Acceptance Criteria:
    - Functional:
      - `validateJson` still rejects an object whose prototype is not this realm's `Object.prototype` or `null`, so every caller fails closed as today.
      - When the prototype is another realm's plain `Object.prototype` (its own prototype is `null`, and `Object.prototype.toString` gives `[object Object]`), the message says so. For example: "Expected a JSON value created in this realm; this object was created in another realm (parse it inside the sandbox)". The kind and pointer are unchanged (`invalid-document`, `/manifest` for `renderModule`).
      - `renderModule`'s manifest error reports that message instead of the generic "Manifest must be a JSON value".
      - `docs/packages.md` states the realm requirement next to the bundle example. The message in `docs/security.md` (if any) matches.
    - Performance: the extra prototype check runs only on the rejection path. `bun run bench` shows no regression.
    - Code Quality: the realm test is in `validateJson` (`src/formats/json.ts:35-41`), so every validator reports it the same way.
    - Security: law 2. Accepting foreign-realm objects by shape is rejected. A crafted prototype can carry accessors that run during validation, and the realm-local requirement costs a host one `JSON.parse` inside the isolate.
  - Approach:
    - Skills to Use:
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - Node `vm.createContext` realm semantics (`find-docs`).
    - Documentation Reviewed:
      - `src/formats/json.ts:21-41`; `src/runner-kit/render.ts:24-31,69-84` (`manifestKey` → `canonicalJson` → `validateJson`); `src/pack/hash.ts:30-31`.
      - `scripts/release/fixtures/vm-bundle.mjs:20-29` (parses inside the context today).
      - Node.js 26.0.0 `vm.createContext` and contextification documentation via Context7 (`/nodejs/node/v26.0.0`): a context supplies its own built-ins. Tests run locally on Bun 1.4.4 and Node 26.11.1.
    - Options Considered:
      - Accept any-realm plain objects by checking the prototype's shape. Rejected (see Security).
      - Document only. Rejected: Clay hit a misleading message, and the message is cheap to fix.
    - Chosen Approach:
      - Keep the identity rule, name the realm in the message, and document it.
      - Recover `validateJson`'s message only when manifest hashing fails, leaving the successful render path unchanged.
    - API Notes and Examples:
      - n/a (message only).
    - Files to Create/Edit:
      - `src/formats/json.ts`; `src/runner-kit/render.ts`
      - `scripts/release/fixtures/vm-bundle.mjs` (an `outer` mode that passes outer-realm objects)
      - `src/__tests__/runner-bundle.test.ts`; `docs/packages.md`
  - Test Cases to Write:
    - `bundle_reports_outer_realm_manifest`: the vm harness passes an outer-realm manifest and expects `invalid-document` at `/manifest` with the realm message. Fails if the message reverts, or if the object is accepted.
    - `validate_json_names_foreign_realm`: a Bun `vm` (`node:vm`) object rejected with the realm message, while a class instance keeps the generic message. Fails if the detection is too broad.
  - Notes (executed 2026-10-30):
    - `validateJson` keeps the prototype identity rule and adds the realm-specific message only on rejection. `renderModule` recovers that validation message when manifest hashing fails, preserving `invalid-document` at `/manifest` without adding work to successful renders. No export, format or spec meaning changed.
    - Both regressions failed before implementation and passed afterward. `validate_json_names_foreign_realm` covers direct and nested foreign objects, local and foreign class instances, ordinary invalid values, local/null-prototype objects and JSON reparsed locally. `bundle_reports_outer_realm_manifest` rejects outer-realm input under Node 26.11.1; `bundle_renders_under_node_vm` still proves realm-local rendering matches the SDK. The focused runner-kit/bundle run passed all 10 tests.
    - Documented realm-local `JSON.parse` next to the package guide's bundle example and snapshot guidance. `docs/security.md` has no conflicting input-error message and needed no edit.
    - `timeout 900s bun run check` passed: **859 passed, 4 skipped, 0 failed**. The final `timeout 600s bun run bench` passed; agent-home total render measured 1.910 µs/node. Earlier timing runs failed under load, including the unchanged Task 4 checkout (core-queue.full validator 1.525 µs/node against 1.5); isolated agent-home validation was comparable before/after (1.312/1.301 µs/node). Restored the benchmark-generated `019-streaming-bench.md` to preserve LF-17's earlier evidence. `git diff --check` passed. Task 6 is next.

- [x] Task 6: Check package hashes in the corpus and export the hash (CL-11)
  - Acceptance Criteria:
    - Functional:
      - `conformance/corpus/package/docs/valid.json` carries its real `hash`, and its case still expects `ok: true`.
      - The package cases name `catalog` and `capabilities` support inputs and run through `verifyPackage` (per Task 1's decision). Adding inputs changes no existing expectation.
      - New cases:
        - `package/hash-mismatch.json`: `hash-mismatch` at `/hash`;
        - `package/forbidden-import.json`: `forbidden-import` at its `/code/<line>` pointer (`/code/1`).
      - `FORMAT_KINDS.package` in `corpus.test.ts` lists both kinds and no longer lists them as non-format kinds.
      - `conformance/hash/packages.json` holds `{ package, hash }` vectors, at least the corpus valid package and one with non-ASCII code or scenario text. `hash` is `sha256-` plus the lowercase hex SHA-256 of `canonicalJson({ format, manifest, code, scenarios })`.
      - `/pack` exports `canonicalJson` and `packageHash`. The hash-vector test imports them from `@arnilo/liveframe/pack`.
      - `docs/conformance.md` says which validator the package cases run through, and describes the package vectors. Spec §13's conformance paragraph and §7.3 name the vector file.
    - Performance: n/a — test data and exports.
    - Code Quality: the hash-vector test recognises the `packages.json` entry shape explicitly. An unknown entry shape fails the test rather than being skipped.
    - Security: law 1. The corpus now proves that a tampered package (`hash-mismatch`) and a package that imports outside the SDK (`forbidden-import`) are rejected, which is what a port's verifier must do.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`: the conformance chores and the public surface.
    - Library Documentation to Check Before Implementation:
      - none. Local: `docs/conformance.md` § "Language-neutral corpus" and § "Canonical-hash vectors".
    - Documentation Reviewed:
      - `src/pack/hash.ts:30-53,151-153`; `src/pack/verify.ts` (`verifyPackage`: shape → inputs → `checkModule` → hash); `src/pack/index.ts`.
      - `src/__tests__/corpus.test.ts:33-79,180-200`; `src/__tests__/hash-vectors.test.ts`.
      - `scripts/release/archive-gate.ts:128-141` (counts every JSON file, so the new files are gated automatically).
      - `docs/compatibility.md` § Formats (expectations are fixed, and adding cases and vectors is additive).
    - Options Considered:
      - Keep the shape-only runner and add a separate integrity runner. Rejected: two runners for one format confuse ports. Shape failures come out unchanged through `verifyPackage`, because it checks the shape first.
      - Keep `canonicalJson`/`packageHash` internal. Rejected: a TypeScript host has to import `dist/pack/hash.js` by path, as Clay's review did.
    - Chosen Approach:
      - Run the real verifier, add the two failing cases and the vectors, and export the two functions.
    - API Notes and Examples:
      ```ts
      import { canonicalJson, packageHash } from "@arnilo/liveframe/pack";
      packageHash({ format, manifest, code, scenarios }) === pkg.hash;
      ```
    - Files to Create/Edit:
      - `conformance/corpus/package/*.json` and `docs/*.json`; `conformance/hash/packages.json` (new)
      - `src/pack/index.ts`
      - `src/__tests__/corpus.test.ts`; `src/__tests__/hash-vectors.test.ts`; `src/__tests__/exports.test.ts`
      - `docs/conformance.md`; `docs/spec.md` §7.3, §13
  - Test Cases to Write:
    - Corpus `package/valid.json` through `verifyPackage`: fails if the hash is a placeholder.
    - Corpus `package/hash-mismatch.json` and `package/forbidden-import.json`: fail if `verifyPackage` stops checking either.
    - `every_format_kind_has_a_failing_case` (existing), now covering `hash-mismatch` and `forbidden-import`.
    - `package_hash_vectors_through_public_exports`: imports from the subpath and checks every vector. Fails if the composition (field set, prefix, case) changes.
    - `exports_list_pack_hash`: `/pack`'s export names include both functions.
  - Notes (executed 2026-10-30):
    - `package` corpus cases now run through `verifyPackage` with `catalog` and `capabilities` inputs. `valid.json` carries its real hash (`sha256-7c2a7fb7…ab688`, cross-checked with `sha256sum` over `canonicalJson`). New cases `hash-mismatch` (`/hash`, valid package with changed code) and `forbidden-import` (`/code/1`, an `import "node:fs"` on line 1). `invalid-document` and `limit-exceeded` keep their expectations.
    - Finding: the old `valid.json` had never been through the manifest and scenario checks. Its scenario `params: {}` and `context: {}` did not fit its own manifest, so `verifyPackage` rejected it. The scenario now carries `canAct`/`canEscalate`/`canViewAlerts: true` and `size: "medium"`. The document changed, not its `ok: true` expectation. The scenario change was needed for the hash to mean anything.
    - Finding: `forbidden-import` points at `/code/<line>` (pointer carries the line, as `transpile-failed` does), not bare `/code`. The case pins `/code/1`, and `docs/conformance.md` says so.
    - `/pack` exports `canonicalJson` and `packageHash`. `conformance/hash/packages.json` holds two `{ package, hash }` vectors: the corpus package and one with non-ASCII code and scenario text. `hash-vectors.test.ts` now classifies each entry (`isPackageVector`) and throws on an unknown shape, and `package_hash_vectors_through_public_exports` imports from `@arnilo/liveframe/pack`. `exports.test.ts` lists both names.
    - Docs: `docs/conformance.md` (package cases run through `verifyPackage`; package vectors) and `docs/spec.md` §7.3 and §13. Also updated the storage skill's "Today" line.
    - `timeout 900s bun run check` passed: **860 passed, 4 skipped, 0 failed**. One earlier full run had 1 failure in the test phase; I did not capture which test, and two later runs were clean. Treat it as the known load-sensitive flake pattern until seen again.

- [x] Task 7: Resolve `package.json` and the conformance data through `exports` (CL-13)
  - Acceptance Criteria:
    - Functional:
      - `exports` gains `"./package.json": "./package.json"`, `"./conformance/corpus/*": "./conformance/corpus/*"` and `"./conformance/hash/*": "./conformance/hash/*"`.
      - It uses explicit `corpus` and `hash` patterns, not `./conformance/*`, which would overlap the `./conformance` and `./conformance/react` code subpaths.
      - Under Bun and under Node, `import.meta.resolve` finds `@arnilo/liveframe/package.json`, one corpus case (`conformance/corpus/ui-tree/valid.json`) and one hash file (`conformance/hash/packages.json`).
      - `assertExportsPacked` accepts the new patterns and still fails on a missing target. Spec §13 lists the data paths beside `./schemas/*`, and `docs/conformance.md` shows how a port resolves the corpus.
    - Performance: n/a.
    - Code Quality: no new resolver code. Use only `exports` entries and tests.
    - Security: n/a. These are data files already in the archive, and no new code is exposed.
  - Approach:
    - Skills to Use:
      - `find-docs`: Node package `exports` subpath patterns and precedence (exact key over pattern), and Bun's resolver behaviour for the same.
    - Library Documentation to Check Before Implementation:
      - Node.js "Packages: subpath patterns" (Node ≥ 24).
      - Bun module resolution and `import.meta.resolve`.
    - Documentation Reviewed:
      - `package.json` `exports` (`"./schemas/*"`, `"./conformance"`, `"./conformance/react"`).
      - `scripts/release/archive-gate.ts:83` (`assertExportsPacked`); `scripts/release/fixtures/node-probe.mjs`.
    - Options Considered:
      - `./conformance/*`. Rejected: it overlaps code subpaths, and resolution then depends on precedence rules that differ by tool.
    - Chosen Approach:
      - Three explicit entries.
    - API Notes and Examples:
      ```js
      const corpus = new URL(import.meta.resolve("@arnilo/liveframe/conformance/corpus/ui-tree/valid.json"));
      ```
    - Files to Create/Edit:
      - `package.json`; `scripts/release/archive-gate.ts` (if pattern handling needs it); `scripts/release/fixtures/node-probe.mjs`
      - `src/__tests__/exports.test.ts`; `docs/spec.md` §13; `docs/conformance.md`
  - Test Cases to Write:
    - `exports_resolve_package_json_and_conformance_data`: Bun `import.meta.resolve` on the three paths. Fails if an entry is removed.
    - Node probe step: resolves the same three paths from the installed archive. Fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` if an entry is missing.
  - Notes (executed 2026-10-30):
    - Added `./package.json`, `./conformance/corpus/*` and `./conformance/hash/*`. The conformance entries are explicit per-directory patterns, so nothing overlaps the `./conformance` and `./conformance/react` code subpaths. `import.meta.resolve` finds all three under Bun, and the Node probe finds the same three documents in the installed archive.
    - Finding: the plan's `conformance/corpus/ui-tree/valid.json` does not exist; the real case is `conformance/corpus/ui-tree/docs/valid.json`. The test and the probe pin the real path, and no duplicate case was added.
    - `assertExportsPacked` needed no resolver change: it already expands `*` and checks that some packed file matches. `archive.test.ts` previously allowed a bare-file mapping only for `./schemas/*` and the two bundles; it now allows exactly `./package.json`, `./schemas/*`, `./conformance/corpus/*` and `./conformance/hash/*`, matches each target to the tarball, and asserts that a missing conformance target still fails. Task 10's `./conformance/patch/*` follows the same explicit-pattern rule.
    - Spec §13 names the data exports beside `./schemas/*` and records the no-overlap rule; `docs/conformance.md` shows a resolution snippet. No export, format meaning or archive layout changed.
    - `timeout 900s bun run check` passed: **861 passed, 4 skipped, 0 failed**. Two earlier full runs failed only on pre-existing load-sensitive timing tests (`render_smoke_budget` and `worker_warm_overhead_report`); both passed focused reruns (3.0 s and 2.3 s) and the final full run. `timeout 900s bun run release:gate` passed all 12 steps, including "host-API-free subpaths under node", which now resolves the three paths from the installed archive. No registry publication belongs to this task.

- [x] Task 8: Keep `next` at or above `latest` (CL-14)
  - Acceptance Criteria:
    - Functional:
      - `docs/compatibility.md` § "Release process" gains a release checklist with this step: after a non-prerelease version is published, move `next` to it (`npm dist-tag add @arnilo/liveframe@<version> next`) and verify with `npm view @arnilo/liveframe dist-tags`.
      - If npm trusted publishing (OIDC) permits `dist-tag` from the workflow, `.github/workflows/publish.yml` runs the step after a `latest` publish. Otherwise the checklist names it as an owner step. Plan 020 found that trusted publishing covers only the workflow's publish and that this machine has no npm auth (020 Compromises), so the docs check below settles which.
      - Task 18's acceptance asserts `next` ≥ `latest` from the registry.
    - Performance: n/a.
    - Code Quality: at most one added workflow step, gated on the computed `tag=latest`. No new script.
    - Security: no stored npm token is added to CI. A manual owner step is preferred over a long-lived token.
  - Approach:
    - Skills to Use:
      - `find-docs`: npm trusted publishing scope, and `npm dist-tag` authentication.
    - Library Documentation to Check Before Implementation:
      - npm CLI 11.x `npm dist-tag`; npm trusted publishers (OIDC) docs: which commands the OIDC token authorises.
    - Documentation Reviewed:
      - `.github/workflows/publish.yml:44-50`; plan 020 Task 9 notes and Compromises Made (`next` left at `0.2.0-rc.4`).
    - Options Considered:
      - Delete `next` between cycles. Rejected: `npm i …@next` would then fail instead of installing the newest build.
      - An automation token in CI secrets. Rejected: it undoes the no-stored-token property of trusted publishing.
    - Chosen Approach:
      - Automate if OIDC allows it. Otherwise make it a checklist step that is verified at release.
    - API Notes and Examples:
      ```sh
      npm dist-tag add @arnilo/liveframe@0.2.1 next && npm view @arnilo/liveframe dist-tags
      ```
    - Files to Create/Edit:
      - `docs/compatibility.md`; `.github/workflows/publish.yml` (tentative, only if OIDC permits it)
  - Test Cases to Write:
    - None automated. The registry check in Task 18 is the proof. `docs-links` covers the edited page.
  - Notes (executed 2026-10-30):
    - Docs check (npm trusted-publishers and dist-tag pages via Context7, `/websites/npmjs`): trusted publishing **does** permit `npm dist-tag` — since npm CLI 11.21.0 (12.2.0 on 12.x), gated on the trusted publisher's **Allow npm dist-tag** setting, which is off by default and separate from direct publish. That supersedes plan 020's assumption that trusted publishing covers only the workflow's publish; no stored token is added.
    - Workflow: the existing Publish step now runs `npx --yes npm@12.2.1 dist-tag add "@arnilo/liveframe@$version" next` after a non-dry-run `latest` publish — no new step, gated inline on the computed `tag`. The CLI is pinned because Node 24's bundled npm can predate 11.21.0; the publish path and its own ≥ 11.5.1 gate are unchanged. A prerelease already publishes under `next` and a dry run skips both.
    - Docs: `docs/compatibility.md` § Release process gains the `next` sentence and a five-step release checklist — gates, owner go, tag push, the automated dist-tag step with the one-time npmjs.com toggle and its manual fallback, then registry verification including `npm view @arnilo/liveframe dist-tags` (`next` the release or newer).
    - Self-check: a temporary shell simulation with a fake `npx` confirmed only a non-dry-run release calls the tag command; `0.2.1-rc.1`, `--dry-run` and the publish step alone call nothing. YAML parses (14 steps). No automated test belongs to this task.
    - `timeout 1200s bun run check` passed: **861 passed, 4 skipped, 0 failed**. Earlier runs under external load (load average 16–26 from other projects; one run hit the 900 s cap) failed only the recorded load-sensitive timing tests — `switch_under_budget_with_blur`, `switch_under_budget_with_blur_through_surface`, `in_process_warm_overhead_under_point_one_ms` and worker timeouts; each passed a focused rerun (3 pass, 4.8 s, no browser timing change) and the final full run. Nothing was weakened.
    - Risk for Task 18: the npmjs.com **Allow npm dist-tag** toggle is an owner action outside the repo and cannot be verified here. If it is still off, step 4 fails after a successful publish and the checklist's manual `npm dist-tag add` applies.

- [x] Task 9: Add the tree-patch format and `applyPatch` (CL-15)
  - Acceptance Criteria:
    - Functional:
      - Implements [Task 2's approved design](../decision-logs/2026-10-30-1928-tree-patch-format.md) exactly. `TreePatch`, `PatchOp` and `validateTreePatch` ship in the root export. `schemas/tree-patch.json` (`$id` `urn:liveframe:tree-patch:1`) agrees with `validateTreePatch` on standalone shape checks; the validator additionally checks the cross-field constraint `revision > base`, which standard JSON Schema cannot express as a sibling-number comparison.
      - `applyPatch(base, patch)` returns `Result<UiTree>`. It applies ops in order and preserves the identity of every subtree no op touches (structural sharing). It fails with:
        - `stale-patch`: wrong `surfaceId`, or `base` ≠ the tree's revision;
        - `not-found`: an unknown target or parent id;
        - `invalid-document`: a malformed patch, a catalog mismatch, an out-of-range index, root removal/move, or `revision ≤ base`.
        - `duplicate-key`: an ambiguous duplicate target; otherwise the subsequent whole-tree validator rejects duplicate ids.
        - It never returns a partly applied tree.
      - `"stale-patch"` joins `LiveframeError["kind"]` and § Growth in `docs/compatibility.md`.
      - `checkOffered` accepts an intent whose origin names the patched revision, and rejects one from the superseded revision with `version-conflict`.
      - `conformance/corpus/tree-patch/` has a valid case and one failing case per kind above, plus a `duplicate-key` case. Each runs as `applyPatch` followed by `validator.validateTree` on the result, with support roles `base`, `catalog`, `capabilities` and `manifest`.
      - Spec §9 and §14 carry the log's edits. The §13 root-export row and the schemas list name the new format. `docs/formats.md` documents it for outsiders.
    - Performance: `applyPatch` ≤ 0.5 ms median for a one-row patch on the 679-node subject, recorded by a new case in `bench/streaming.bench.ts` or `bench/validator.bench.ts`. Whole-tree validation is unchanged.
    - Code Quality: `src/formats/tree-patch.ts` holds the type, shape validator and schema export, following `src/formats/tree.ts`. `src/validate/patch.ts` holds `applyPatch`, following the per-tree `WeakMap` index of `src/validate/offered.ts` (built once per base tree). No new dependency.
    - Security: law 2. `applyPatch` output is unvalidated until `validateTree` runs. Docs and the JSDoc say so, and `<Surface>` arrival validation still runs on every tree. Application never mutates or freezes the base or patch. Trees follow the existing readonly ownership contract; hosts must not mutate served trees or nested values while in use. Runtime freezing is not promised.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`: the new-format chores (schema plus type plus test, validator rejections, spec plus docs).
      - `typescript-advanced-types`: the `PatchOp` discriminated union and its schema parity test.
    - Library Documentation to Check Before Implementation:
      - none. Local: `src/formats/tree.ts`, `scripts/schemas.ts`, `src/__tests__/schemas.test.ts` (Ajv parity).
    - Documentation Reviewed:
      - Task 2's log; `docs/spec.md` §9, §10; `src/validate/offered.ts:50-90`; `src/errors.ts:2-20`; `src/__tests__/corpus.test.ts:18-30,180-200`.
    - Options Considered:
      - As settled in Task 2.
    - Chosen Approach:
      - As settled in Task 2.
    - API Notes and Examples:
      ```ts
      const next = applyPatch(current, patch);
      if (!next.ok) requestWholeTree(); // stale-patch, not-found, invalid-document
      else if (validator.validateTree(next.value).ok) current = next.value;
      ```
    - Files to Create/Edit:
      - `src/formats/tree-patch.ts` (new); `src/validate/patch.ts` (new); `src/index.ts`; `src/errors.ts`
      - `src/formats/registry.ts` (the existing `scripts/schemas.ts` publisher reads the registry); `schemas/tree-patch.json` (generated)
      - `conformance/corpus/tree-patch/**` (new); `src/__tests__/corpus.test.ts`
      - `src/__tests__/tree-patch.test.ts` (new); `src/__tests__/schemas.test.ts`; `src/__tests__/offered.test.ts`; `src/__tests__/exports.test.ts`
      - `docs/spec.md` §9, §10, §13, §14; `docs/formats.md`; `docs/compatibility.md`; `docs/conformance.md`
      - `bench/validator.bench.ts` (one-row application median on the LF-17 subject)
  - Test Cases to Write:
    - `apply_patch_applies_each_op`: set, insert, remove and move, each against a small tree. Fails on a wrong position or a dropped field.
    - `apply_patch_shares_untouched_subtrees`: siblings of the changed node are `===` the base's. Fails if the implementation deep-copies.
    - `apply_patch_rejects_stale_base`: wrong `surfaceId` and wrong `base` give `stale-patch`. Fails if base identity is unchecked.
    - `apply_patch_is_all_or_nothing`: a valid op followed by a `not-found` op returns an error and leaves the base unchanged.
    - `tree_patch_schema_matches_validator`: Ajv against `validateTreePatch` for standalone shape checks on the corpus documents. Cross-field revision ordering and base-dependent application errors are separate assertions.
    - `apply_patch_obeys_order_and_ownership`: inserted targets become addressable, removed targets become absent, optional set fields are deleted when omitted, root set works, root remove/move and invalid indexes fail, empty ops advance revision, catalog mismatch fails, and application neither mutates nor freezes its inputs.
    - `check_offered_follows_patched_revision`: accepts the new revision and rejects the superseded one.
    - The corpus cases under `tree-patch/`.
  - Notes (executed 2026-10-31):
    - Implemented the approved four-op format, readonly `TreePatch`/`PatchOp`, `validateTreePatch`, generated `schemas/tree-patch.json`, root exports and additive `stale-patch`. The existing schema publisher reads the added registry entry; no publisher rewrite or dependency was needed.
    - `applyPatch` validates patch shape before identity checks, applies ordered edits atomically with a per-tree WeakMap index, updates inserted/removed descendant targets, rejects ambiguity and preserves untouched references. It neither mutates nor freezes inputs. Whole-result validation remains mandatory; renderer and `checkOffered` semantics are unchanged.
    - Added six application-plus-validation corpus cases, standalone schema/corpus parity with revision ordering tested separately, public type/schema exports, ownership/ordering/sharing/error regressions and patched-revision intent checks. Updated spec §9/§10/§13/§14, format, compatibility and conformance docs. `diffTrees` and vectors remain Task 10; streaming arrival/commit measurements remain Task 11.
    - `timeout 120s bun --conditions liveframe:source bench/validator.bench.ts` passed all existing gates and the new application gate: median **0.0919 ms**, below **0.5 ms**, including index construction on successive accepted 679-node, 50-row trees (200 warm-ups, 1,000 samples; one changed row status per revision). Bun 1.4.4, Linux 7.3.0-4-cachyos, AMD Ryzen 9 PRO 7940HS, 16 logical CPUs. Load averages were 2.77/8.59/12.47 initially and 2.87/8.51/12.42 before the patch case. An earlier loaded run measured 0.2140 ms for application but failed existing validator timing gates; no threshold was changed.
    - `timeout 1200s bun run check` passed: **869 passed, 4 skipped, 0 failed** (873 tests, 109 files). Earlier runs exposed the missing spec error-table row (fixed), existing timing failures and browser timeouts during external build load (peaking above 100). The final unchanged-budget full run passed, including the previously failing switch, package-verification and hydration gates.

- [x] Task 10: Add `diffTrees` and patch vectors (CL-15)
  - Acceptance Criteria:
    - Functional:
      - `diffTrees(prev, next)` returns `Result<TreePatch>`:
        - `invalid-document` when the `catalogId` or `surfaceId` differ, when `next.revision ≤ prev.revision`, or when either input contains an explicit empty `children` array (whole-tree fallback; existing whole-tree validation remains unchanged);
        - otherwise the deterministic ops of Task 2 (same inputs give byte-identical canonical JSON).
      - For every ordered pair of corpus UI trees with matching catalog/surface and increasing revisions, assert exact deep-equality after diff/application for SDK-form inputs (empty children omitted), or explicit `invalid-document` with whole-tree fallback when either input contains empty children. Never silently normalise a document or weaken equality. Where the corpus has too few, add pairs to the vectors: the LF-17 one-row change, a reorder, an insert, a removal, a kind change and a parent change.
      - `conformance/patch/diff.json` holds `{ prev, next, patch }` vectors (or `prev`/`next` as corpus document paths), checked through the public exports. `docs/conformance.md` describes them. The archive gate's conformance step covers the new directory, and `package.json` `exports` gains `./conformance/patch/*`.
    - Performance: `diffTrees` ≤ 1.5 ms median per revision on the 679-node subject, recorded in the bench.
    - Code Quality: `diffTrees` lives beside `applyPatch` in `src/validate/patch.ts`. It compares own fields with the existing deep-equality helper (`src/validate/offered.ts` `difference`, extracted if needed). Follow the approved next-tree preorder: set own fields, remove absent children in reverse sibling order, then insert/move retained children left to right and recurse. No descendant ops beneath inserted/removed subtrees, no generic LCS, and no claim that every sibling reorder is linear.
    - Security: n/a. `diffTrees` runs on the host, on trees the host already validated. It never runs widget code.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
      - `investigate-first` and `surgical-patch`: diagnose failed gates and fix the proof-host error boundary without changing limits.
      - `find-docs`: verify Bun's HTTP error callback.
    - Library Documentation to Check Before Implementation:
      - none for diffing; current Bun HTTP error-handling documentation for the diagnosed proof-host prerequisite, exercised on Bun 1.4.4.
    - Documentation Reviewed:
      - Task 2's log; `src/validate/offered.ts:30-48` (`difference`); `conformance/corpus/ui-tree/docs/*`.
      - Bun's [HTTP error-handling documentation](https://github.com/oven-sh/bun/blob/main/docs/runtime/http/error-handling.mdx), fetched through Context7 before the proof-host fix.
    - Options Considered:
      - A minimal edit script (LCS) over children. Rejected: more code than the subject needs. Id-keyed moves are deterministic and bounded by the number of children.
    - Chosen Approach:
      - Id-keyed traversal with the approved deterministic operation order and explicit whole-tree fallback for unsupported empty-child representation.
    - API Notes and Examples:
      ```ts
      const patch = diffTrees(served, rendered); // host side
      send(patch.ok ? patch.value : rendered);
      ```
    - Files to Create/Edit:
      - `src/validate/patch.ts`; `src/index.ts`; `src/validate/difference.ts` (extract the existing comparator); `src/validate/offered.ts` (use the shared comparator)
      - `conformance/patch/diff.json` (new); `package.json` (`exports`)
      - `scripts/release/archive-gate.ts` (`assertConformance("patch")`); `scripts/release/fixtures/node-probe.mjs` (installed public-export vector checks)
      - `src/__tests__/tree-patch.test.ts`; `src/__tests__/exports.test.ts`; `src/__tests__/archive.test.ts` (patch data allowlists and missing-target checks)
      - `docs/conformance.md`; `docs/formats.md`; `docs/spec.md` §9/§13 (diff semantics and data export); `bench/validator.bench.ts` (LF-17 diff median)
      - `proof/host/server.ts`; `proof/tests/host.test.ts`; `proof/tests/clay-browser.test.ts` (diagnosed proof-host error-boundary prerequisite); `plans/evidence/021-task-10-check-diagnosis.md` (diagnosis record)
  - Test Cases to Write:
    - `diff_then_apply_round_trips_every_pair`: supported corpus pairs round-trip exactly; explicit empty-child inputs reject with `invalid-document` and preserve whole-tree fallback. Fails on any lost field, order or node, or silent normalisation.
    - `diff_vectors_pin_independent_edit_order`: independent sibling changes, object property insertion order, and optional-field deletion produce the canonical vectors in the approved operation order.
    - `diff_is_deterministic`: two runs give the same canonical JSON. Fails if map or object iteration order leaks.
    - `diff_rejects_mismatched_surfaces`.
    - `patch_vectors_through_public_exports`: fails if diff output changes for a fixed vector.
    - `shared_json_comparison_preserves_mismatch_pointers`: preserves the existing comparison's missing/extra-field, array-order and escaped-pointer behavior after extracting it and removing temporary Set allocations.

    - `page_render_failure_returns_500_without_an_unhandled_rejection`: a failing widget returns controlled HTTP 500 without Bun failing an active test through its default request-error handler. Failed before the fix and passed afterward.
  - Notes (executed 2026-10-31):
    - Implemented the approved deterministic next-tree preorder `diffTrees` beside `applyPatch`, with identity/revision checks and explicit empty-children rejection for unchanged whole-tree fallback. Extracted the existing JSON comparison into `src/validate/difference.ts`, preserving mismatch pointer order while avoiding temporary Sets; leaf nodes avoid child bookkeeping. No dependency, schema or wire-contract change.
    - Added nine independently specified vectors, including the real 679-node LF-17 one-row change, reorder, subtree insertion/removal, kind and parent changes, independent edits, optional-field deletion, object property order and array order. Public-export tests pin canonical output, reverse object key insertion order, round-trip valid corpus pairs with additional revisions, cover explicit empty-children fallback and 36 mixed sibling pairs. Updated spec §9/§13, format/conformance docs, root/data exports, archive allowlists and the installed Node probe.
    - Investigated earlier failed checks in [the diagnosis record](evidence/021-task-10-check-diagnosis.md). Both switching failures reproduced on the pre-Task-10 checkout and passed unchanged during a quiet control. Fixed a separate proof-host error boundary as a small prerequisite: rejected page renders now return controlled JSON HTTP 500, and the affected host/Clay browser tests assert HTTP 200 before waiting for hydration. The failing-widget regression failed before the fix and passed afterward. No runner deadline, browser timeout or switching threshold was raised.
    - After the owner terminated competing build and VM workloads, `timeout 180s bun --conditions liveframe:source bench/validator.bench.ts` passed **all existing and new gates**. On the unchanged 679-node, 50-row LF-17 subject: median **diffTrees 0.5185 ms** (≤ 1.5 ms) and **applyPatch 0.1015 ms** (≤ 0.5 ms), with 200 warm-ups and 1,000 samples. Diffing compares fresh next-tree objects, copying outside the timed span, and asserts the exact expected patch; validation is timed separately. Bun 1.4.4, Linux 7.3.0-4-cachyos, AMD Ryzen 9 PRO 7940HS, 16 logical CPUs; load 3.28/12.45/17.45 initially and 2.93/12.08/17.27 before the patch cases.
    - `timeout 1200s bun run check` passed: **876 passed, 4 skipped, 0 failed**, across 880 tests and 109 files (273.11 s). Build, generated-code checks, typecheck, lint and formatting all passed. This includes the new diff/comparison/error-boundary regressions and the previously failing host, preview, render-deadline and switching cases, with their original limits. The four existing skipped reference-fixture tests are unchanged.
    - `timeout 600s bun run release:gate` passed **all 13 steps** in 6.3 s, including patch-vector packing, both bundle checks and all nine vectors through installed Node public exports. Task 10 is complete; no finding invalidates a later task. Streaming gzip/arrival/commit measurements remain Task 11, and the planned cross-engine measurement work in Tasks 13–14 is unchanged.

- [ ] Task 11: Measure patches on the LF-17 subject (CL-15)
  - Acceptance Criteria:
    - Functional:
      - `bench/streaming.bench.ts` gains a patch mode on the same subject and constants (679 nodes, 50 rows, 10 revisions/s, one row's status per revision, `MAX_GZIP_BYTES = 1024`, `MAX_VALIDATION_AND_COMMIT_MS = 8`).
      - Per revision, the host runs `diffTrees` and sends patch JSON. The browser runs `JSON.parse` → `applyPatch` → `<Surface tree>` (arrival validation) → React commit, measured the way LF-17 measured it.
      - Results go to a new `plans/evidence/021-streaming-patches.md`, with machine, Bun, Chromium, React build and load. `019-streaming-bench.md` is not overwritten (plan 020 Compromises: it is LF-17's decision record).
      - The task records the verdict: the gzip median, and the median of arrival validation plus commit, each against its threshold. If commit alone misses 8 ms, Task 12 runs. If both pass, Task 12 is recorded as `n/a — measured` and skipped.
    - Performance: this task is the measurement, and the thresholds are unchanged.
    - Code Quality: one bench file with a mode flag. The whole-tree path is unchanged, so its numbers stay comparable.
    - Security: n/a.
  - Approach:
    - Skills to Use:
      - `investigate-first`: measure before optimising.
      - `find-docs`: React 19 `<Profiler>` `onRender` timing, and Playwright 1.64 `page.evaluate`.
    - Library Documentation to Check Before Implementation:
      - React 19.x Profiler API; Playwright 1.64.
    - Documentation Reviewed:
      - `bench/streaming.bench.ts:1-40`; `bench/streaming-client.tsx`; `plans/evidence/019-streaming-bench.md`.
      - `src/react/renderer.tsx:212-300`: every accepted tree rebuilds every node context and element, so commit is expected to stay near 10 ms without Task 12.
    - Options Considered:
      - Change the renderer first. Rejected: roadmap §1 adds an optimisation only when a measurement calls for it.
    - Chosen Approach:
      - Measure patch transport alone, then decide.
    - API Notes and Examples:
      ```sh
      bun --conditions liveframe:source bench/streaming.bench.ts --patches
      ```
    - Files to Create/Edit:
      - `bench/streaming.bench.ts`; `bench/streaming-client.tsx`; `plans/evidence/021-streaming-patches.md` (new)
  - Test Cases to Write:
    - None. A bench, recorded as evidence. Its assertions use the fixed thresholds only in the task that claims them (Task 12, or this task if it passes).

- [ ] Task 12: Keep unchanged subtrees out of the React commit (CL-15, if Task 11's commit misses)
  - Acceptance Criteria:
    - Functional:
      - `<Surface>` reuses each node's context and rendered element when the node object is `===` the previous tree's node (which `applyPatch` guarantees), so React bails out of unchanged subtrees.
      - `emit` reads `surfaceId`/`revision` for its origin from the currently accepted tree, so an unchanged node's intent names the current revision.
      - Focus, scroll and local state survive patched re-renders (spec §11). Fallback boundaries, `events` metadata and `confirm` behave as today.
      - Spec §11's "builds this metadata inside its existing tree memo" is updated to describe per-node reuse.
      - The Task 11 bench re-run passes both thresholds (median), and `plans/evidence/021-streaming-patches.md` records it.
    - Performance: patch-mode arrival validation plus commit ≤ 8 ms median, and gzip ≤ 1 KiB median. Whole-tree mode shows no regression against `019-streaming-bench.md`. `bun run bench` render gates are unchanged.
    - Code Quality: one `WeakMap<UiNode, Item>` per `(validator, fallback, implementations)` generation in `renderer.tsx`. No new component layer and no `React.memo` wrappers beyond the reuse itself.
    - Security: law 4. An origin can never name a revision other than the accepted one. A reused node in a stale revision is impossible because reuse requires `===`, and the cache resets when the validator changes.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`: the new-renderer-behaviour chores (a test per interaction tier, and state survival).
      - `find-docs`: React 19 element-identity bailout and reconciliation.
    - Library Documentation to Check Before Implementation:
      - React 19.x reconciliation ("Preserving and resetting state") and element-reference bailout.
    - Documentation Reviewed:
      - `src/react/renderer.tsx:140-300`; `docs/spec.md` §11 (`:651-681`); Task 11 evidence.
      - Backlog "Profile production browser selection costs before optimizing the renderer" (P2).
    - Options Considered:
      - `React.memo` per node with a custom comparator. Rejected: it repeats work the identity check already gives.
      - Patch application inside `<Surface>`. Rejected in Task 2.
    - Chosen Approach:
      - Identity-keyed reuse of the existing `Item`s.
    - API Notes and Examples:
      - n/a (internal).
    - Files to Create/Edit:
      - `src/react/renderer.tsx`; `src/__tests__/react-surface.test.tsx`; `src/__tests__/react-browser.test.tsx`; `src/__tests__/react-intents.test.tsx`
      - `docs/spec.md` §11; `docs/renderer.md` (patch streaming example); `plans/evidence/021-streaming-patches.md`
  - Test Cases to Write:
    - `patched_render_skips_unchanged_nodes`: an implementation render counter shows only the changed row's subtree re-renders. Fails if reuse is lost.
    - `origin_names_current_revision_for_reused_node`: an intent from an unchanged node after a patch carries the new revision. Fails if the origin is captured per build.
    - `local_state_and_focus_survive_patch` (browser): a focused text field in an unchanged row keeps focus and value.
    - `validator_change_resets_reuse`: a new validator re-renders everything. Fails if the cache leaks across validators.

- [ ] Task 13: Split and diagnose the WebKit switching measurement (CL-16)
  - Acceptance Criteria:
    - Functional:
      - A committed script (`plans/evidence/021-task-13/switch-split.ts`) measures the two-surface switch from `css-scope-browser.test.ts` and the `<Surface>` switch from `react-browser.test.tsx` with `performance.mark`/`measure`, in three spans:
        - (A) **library**: from the attribute change to style and layout applied, forced once with `root.offsetWidth`, which is what the renderer's switching sequence does (`renderer.tsx:202-205`);
        - (B) **probe**: today's per-element `getComputedStyle` reads over more than 500 nodes, the span the current tests time;
        - (C) **frame**: to the next painted frame (`requestAnimationFrame` then a second rAF timestamp).
      - It runs on Playwright WebKit headless and headed, with Chromium as the control. There are at least 10 warm samples per span, with the median and max reported.
      - `plans/evidence/021-webkit-switching.md` records machine, OS, load, Bun, Playwright, WebKit and Chromium versions, headless or headed, and the split timings, then states which span exceeds 16.67 ms and the evidence for the cause.
      - It notes a code-reading finding to confirm or refute: the current timed window has no rAF inside it, so the test comment's "headless frame pacing" cannot be the cost being measured (`css-scope-browser.test.ts:240-271`).
      - Clay's WebKitGTK real-window measurements (plan 205 tasks 24 and 34) are added if they arrive before Task 17. If they have not arrived, that is recorded.
    - Performance: this task is the measurement. No threshold changes here.
    - Code Quality: the script is local evidence tooling, not shipped, and named in the evidence file so the run can be regenerated.
    - Security: n/a.
  - Approach:
    - Skills to Use:
      - `investigate-first`: evidence-ranked hypotheses before a fix.
      - `find-docs`: Playwright 1.64 WebKit headed launch on Linux, and `performance.mark`/`measure`.
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64 `webkit.launch({ headless: false })` and Linux display requirements.
      - The User Timing Level 3 API.
    - Documentation Reviewed:
      - `src/__tests__/css-scope-browser.test.ts:230-276`; `src/__tests__/react-browser.test.tsx:~640-680`.
      - `src/react/renderer.tsx:190-210`; `docs/spec.md` §6.4 switching sequence (`:256`) and §12 budget (`:725`).
      - `plans/evidence/019-engines.md` (WebKit 27.2 host workarounds); `decision-logs/2026-10-30-0430-webkit-switching-budget-deferral.md`.
    - Options Considered:
      - Raise the WebKit ceiling. Rejected by the deferral log, which keeps the 16.67 ms budget.
    - Chosen Approach:
      - Split the spans, then rank the causes with numbers.
    - API Notes and Examples:
      ```sh
      LIVEFRAME_BROWSER=webkit bun plans/evidence/021-task-13/switch-split.ts --headed
      ```
    - Files to Create/Edit:
      - `plans/evidence/021-task-13/switch-split.ts` (new); `plans/evidence/021-webkit-switching.md` (new)
  - Test Cases to Write:
    - None. A diagnosis. Task 14 turns its verdict into tests.

- [ ] Task 14: Assert the switching budget on the library's measurement in WebKit (CL-16)
  - Acceptance Criteria:
    - Functional:
      - If span (A) exceeds 16.67 ms on WebKit, the CSS projection or the switching sequence is fixed until (A) is ≤ 16.67 ms. Likely areas are selector cost in the projected sheets and the attribute set; the file list is tentative until the diagnosis. Chromium and Firefox show no regression.
      - If only (B) or (C) exceed it, a decision log approved by the owner records the cause with evidence and defines the budgeted measurement as span (A). Spec §12 and §6.4 then name span (A) as what 16.67 ms bounds. This does not raise the budget. It names what it measures, which the deferral log left open.
      - In either case, both switching tests assert span (A) ≤ 16.67 ms in every engine. The `browserName === "webkit" ? 25.1 : 16.67` ceilings are removed. Spans (B) and (C) are logged, not asserted.
      - The backlog's WebKit deferral note, under "Phase 1 performance gate: 3 µs per node", is closed with this evidence, and the changelog's 0.2.0 limitation is answered in the 0.2.1 entry.
    - Performance: ≤ 16.67 ms on span (A) in Chromium, Firefox and WebKit, max of the warm samples. The bench and CSS gates are unchanged.
    - Code Quality: the tests share one measurement helper in `src/__tests__/fixtures/browser.ts` rather than duplicating the span code.
    - Security: law 3 is unchanged. Any CSS change still comes only from the theme and design system, and the "no colour outside the theme" and completeness checks still pass.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`: the style-change chores, if CSS changes.
      - `create-decision-log`: only on the "measurement definition" branch.
    - Library Documentation to Check Before Implementation:
      - As in Task 13, plus WebKit style-invalidation notes if the CSS branch applies (via `find-docs`).
    - Documentation Reviewed:
      - Task 13 evidence; the two test files; `src/css/*` (tentative).
    - Options Considered:
      - Keep a WebKit-only ceiling. Rejected by Clay's acceptance and by the deferral log.
    - Chosen Approach:
      - Fix whichever cost the diagnosis assigns to the library, or define the budget's span with the owner's approval, then assert it everywhere.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `src/__tests__/css-scope-browser.test.ts`; `src/__tests__/react-browser.test.tsx`; `src/__tests__/fixtures/browser.ts`
      - `src/css/*` (tentative, CSS branch only)
      - `docs/spec.md` §6.4, §12 (measurement branch only); `decision-logs/…-switching-budget-measurement.md` (measurement branch only)
      - `plans/backlog.md`
  - Test Cases to Write:
    - `switch_under_budget_with_blur` and `switch_under_budget_with_blur_through_surface`, now asserting span (A) ≤ 16.67 ms in every engine. A CSS mutant that doubles selector work must fail under WebKit.

- [ ] Task 15: Write the 0.2.1 documentation
  - Acceptance Criteria:
    - Functional:
      - The four post-0.2.0 corrections (020 impact F1 to F4) are confirmed present in `docs/spec.md` §13, `docs/compatibility.md`, `docs/adopters-0.2.md` and `README.md`, and the backlog entry is closed once Task 18 ships them.
      - `docs/adopters-0.2.md` gains a 0.2.1 section mapping CL-10 to CL-16 to the shipped API, spec section and limitation. Its LF-17 text says patches shipped.
      - `CHANGELOG.md` has `## 0.2.1`, with Added (validator bundle, `canonicalJson`/`packageHash`, data `exports`, tree patches, `stale-patch`), Fixed (`structuredClone`, runtime matrix, realm message, package corpus hash, WebKit switching), and the R15 note that every addition is additive.
      - `README.md` names 0.2.1 as the current release and shows the patch path in one short example.
      - `plans/requests/clay-0.2.1-requests.md` gains a status line pointing at the adoption notes.
    - Performance: n/a.
    - Code Quality: the outsider docs never say "planned" next to a shipped export (`docs-wording`), and the links resolve (`docs-links`).
    - Security: `docs/security.md` and the renderer guide state that a patched tree is validated whole before render, and that `checkOffered` is still the host's dispatch check.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`: docs for outsiders.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/backlog.md` "Ship the post-0.2.0 documentation corrections"; plan 020 Task 3; `CHANGELOG.md` § 0.2.0.
    - Options Considered:
      - A separate `adopters-0.2.1.md`. Rejected: one adoption page per minor keeps the 0.2 line in one place.
    - Chosen Approach:
      - Extend the existing pages.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `CHANGELOG.md`; `README.md`; `docs/adopters-0.2.md`; `docs/security.md`; `docs/renderer.md`; `plans/requests/clay-0.2.1-requests.md`
  - Test Cases to Write:
    - `docs-links`, `docs-wording`, `readme-guide` and `renderer-guide` (existing), extended if the README or renderer example gains runnable code.

- [ ] Task 16: Prove every acceptance bullet against the checkout
  - Acceptance Criteria:
    - Functional: `plans/evidence/021-request-acceptance.md` lists every acceptance bullet of CL-10 to CL-16, each with a named passing test, gate step or evidence record. Every named test passes in one saved run (`plans/evidence/021-request-acceptance.log`, local-only).
    - Performance: the CL-15 and CL-16 rows cite the numbers from Tasks 12 and 14.
    - Code Quality: the same table shape as `plans/evidence/020-request-acceptance.md`.
    - Security: n/a.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/evidence/020-request-acceptance.md`; `plans/requests/clay-0.2.1-requests.md`.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - Plan 020 Task 4's method.
    - API Notes and Examples:
      ```sh
      bun test --conditions liveframe:source -t '<alternation of the named tests>'
      ```
    - Files to Create/Edit:
      - `plans/evidence/021-request-acceptance.md` (new)
  - Test Cases to Write:
    - None new.

- [ ] Task 17: Publish 0.2.1-rc.1 under `next` and verify it from the registry
  - Acceptance Criteria:
    - Functional:
      - `package.json` `version` is `0.2.1-rc.1`. `bun run check`, `bun run release:gate` (with the new validator-bundle, data-export and patch-vector steps), `bun scripts/release/peer-floors.ts` and `bun run demo:test` pass against the packed tarball.
      - After the owner's explicit go, `v0.2.1-rc.1` is pushed. The workflow publishes under `next` with provenance.
      - From the registry, `bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.1-rc.1` passes. The demo host installed from the registry passes, and the installed-package rows of the acceptance matrix pass: the validator bundle under bare `vm`, corpus resolution through `exports`, and package vectors through `/pack`.
      - A defect produces a fix and `rc.N+1`.
    - Performance: record the gate step times.
    - Code Quality: no source change except the version and what the gates demand. Each fix is recorded.
    - Security: `npm audit signatures --include-attestations` verifies the provenance. The packed file list stays within spec §13's ships list (now with `dist/validator.bundle.js` and `conformance/patch/`).
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - none beyond Task 8.
    - Documentation Reviewed:
      - Plan 020 Tasks 5 and 6 notes (the flag is `--package`, not `--registry`; about two minutes of registry lag).
    - Options Considered:
      - Skip the rc. Rejected: plan 020's rc rounds found defects visible only on the registry path.
    - Chosen Approach:
      - Plan 020's process.
    - API Notes and Examples:
      ```sh
      bun run check && bun run release:gate && bun scripts/release/peer-floors.ts && bun run demo:test
      git tag v0.2.1-rc.1 && git push origin v0.2.1-rc.1   # only after the owner's go
      bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.1-rc.1
      ```
    - Files to Create/Edit:
      - `package.json`; `CHANGELOG.md` (rc note); `plans/evidence/021-release-candidate.md` (new); `plans/evidence/021-request-acceptance.md` (installed section)
  - Test Cases to Write:
    - None new.

- [ ] Task 18: Review readiness with the owner, then publish 0.2.1 and verify it
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/021-release-readiness-review.md` lists each item with its evidence and a go/no-go: CL-10 to CL-16, the doc corrections, the bench and CSS gates, the peer floors and the rc verification. The owner gives the go in words, recorded verbatim. A documentation change after the rc requires a new verified rc (plan 020 T7's rule).
      - `package.json` is `0.2.1`, and `v0.2.1` is pushed after the go. From the registry: `npm view @arnilo/liveframe version` is `0.2.1`, the archive gate with `--package @arnilo/liveframe@0.2.1` passes, and the demo from the registry passes.
      - Task 8's step has run, and `npm view @arnilo/liveframe dist-tags` shows `next` ≥ `latest`, recorded verbatim.
      - `CHANGELOG.md` dates the entry. `roadmap.md` §3 records the release. Both Clay request documents' status lines name `0.2.1`. The backlog entries "Design tree patches for streaming agent surfaces" and "Ship the post-0.2.0 documentation corrections" are closed.
      - Clay is told the archive is ready for its release-review re-run (a handoff note in the evidence file).
    - Performance: n/a.
    - Code Quality: n/a.
    - Security: provenance is verified. The published archive's file hashes match the verified rc's, apart from `package.json` and `CHANGELOG.md`.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Plan 020 Tasks 8 and 9 notes.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - Plan 020's process.
    - API Notes and Examples:
      ```sh
      git tag v0.2.1 && git push origin v0.2.1   # only after the owner's go
      npm view @arnilo/liveframe dist-tags
      ```
    - Files to Create/Edit:
      - `package.json`; `CHANGELOG.md`; `roadmap.md`; `plans/requests/clay-*.md`; `plans/backlog.md`
      - `plans/evidence/021-release-readiness-review.md` (new); `plans/evidence/021-release.md` (new)
  - Test Cases to Write:
    - None new.

- [ ] Task 19: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/021-impact-analysis.md` sweeps all 12 areas against the released 0.2.1. Areas 1, 2, 4, 7, 8 and 11 must address the patch format, the validator bundle and the runtime matrix by name. Area 12 records what Clay can now remove (its own validator bundle, its `structuredClone` shim, path imports of `dist/pack/hash.js`) and any gap left.
      - The findings are presented to the owner in one table, each with a recommended disposition, and the owner's answer is recorded. `execute` items become tasks above this one, and `backlog` items go to `plans/backlog.md` and Further Actions.
      - Compromises Made and Further Actions are filled and handed off to the backlog.
    - Performance: `bun run bench` is re-run and recorded. The patch bench is re-run into `021-streaming-patches.md`, never into `019-streaming-bench.md`.
    - Code Quality: n/a.
    - Security: confirm that the published archive matches the reviewed one (the Task 18 hash comparison).
  - Approach:
    - Skills to Use:
      - `create-plan` (final task); `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Reference §5; `plans/evidence/020-impact-analysis.md` (shape).
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - The standard sweep.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/021-impact-analysis.md` (new); `plans/backlog.md`; this plan; `roadmap.md`
  - Test Cases to Write:
    - None.

## Verification (whole plan)
- `timeout 900s bun run check`
- `timeout 600s bun run bench`
- `timeout 300s bun --conditions liveframe:source bench/streaming.bench.ts --patches`
- `LIVEFRAME_BROWSER=webkit timeout 600s bun test --conditions liveframe:source src/__tests__/css-scope-browser.test.ts src/__tests__/react-browser.test.tsx`
- `timeout 600s bun run release:gate`
- `timeout 900s bun scripts/release/peer-floors.ts`
- `timeout 600s bun run demo:test`
- `timeout 300s bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.1` (after Task 18)
- `npm view @arnilo/liveframe dist-tags` (after Task 18)

## Compromises Made
- To be filled after tasks are completed and tests pass.

## Further Actions
- To be filled after task completion with improvements, rationale, and priority.
