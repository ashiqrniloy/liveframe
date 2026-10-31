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
- Fix every gap the 2026-10-31 review of the authoring MCP server found (Tasks 14.1 to 14.10):
  - `render_scenarios` advertises `outcomes`;
  - a missing argument is a `LiveframeError`, not the SDK's bare string;
  - `generated_types` returns every `liveframe gen` module;
  - a `set_state` tool fires an offered `setState` event (no action path);
  - `pack_draft` reads a draft directory under an opt-in root;
  - every tool carries behaviour annotations;
  - every tool returns `structuredContent` against an `outputSchema`;
  - an app can raise the 12-cell capture bound up to a documented maximum;
  - `capture_preview` can report each cell's node boxes and overflow, so layout is checked by structure, not pixel height.
- Publish `0.2.1-rc.N` under `next` and verify it from the registry, review readiness with the owner, then publish `0.2.1` as `latest` and verify it so Clay can re-run its release-review scripts.

## Expected Outcome

- `@arnilo/liveframe@0.2.1` is on npm with provenance under `latest`, and `npm view @arnilo/liveframe dist-tags` shows `next` at or above `latest`.
- The archive ships `dist/validator.bundle.js`. A bare Node `vm` context with no globals added validates a corpus tree and runs `checkOffered` with the same results as the root export.
- `conformance/corpus/package/` runs through `verifyPackage` and includes a `hash-mismatch` case and a `forbidden-import` case. `conformance/hash/packages.json` pins package hashes, and both are checked through the public exports.
- `liveframe/tree-patch/1` has a TS type, a published JSON Schema, a spec section, corpus cases and vectors. For matching catalog/surface and increasing revisions, `applyPatch(prev, diffTrees(prev, next))` deep-equals `next` for every supported corpus tree pair; explicit empty children receive the approved `invalid-document` rejection and whole-tree fallback. The LF-17 subject streamed as patches is at or under 1 KiB gzip and 8 ms arrival validation plus commit per update (median).
- A WebKit test asserts the switching budget at 16.67 ms on the measurement the diagnosis shows to be the library's, with no WebKit-only ceiling above it.
- `liveframe mcp` lists eight tools, each with annotations and an `outputSchema`, and its text results are unchanged for 0.2.0 clients. Every argument it accepts appears in `tools/list`, and every argument error is a `LiveframeError[]`. `/authoring` exposes the same eight operations. `capture_preview` takes `layout: true` and honours `maxCaptureCells`, and the proof agent loop checks layout structurally. The six MCP backlog entries the review named are closed.
- `CHANGELOG.md` has a 0.2.1 entry, `docs/adopters-0.2.md` maps CL-10 to CL-16 to what shipped, and `plans/evidence/021-request-acceptance.md` names a passing test or record for every acceptance bullet.

This plan answers Clay's review of the installed 0.2.0 archive. It belongs to roadmap Phase 7 (reference hosts) as its first patch release, and follows plan 020's release process (`docs/compatibility.md` § "Release process"). The owner set the release target to 0.2.1 and, on 2026-10-30, answered the review's two R15 policy questions. First, additive exports, corpus cases and vectors may ship in a patch ("Yes, additive in patch"). Second, tree patches ride 0.2.1 in this one plan ("0.2.1, one plan"). Task 1 records both answers in a decision log. The tree-patch tasks (9 to 12) lift a spec §14 non-goal, so they wait for Task 2's design log and its separate owner approval. Nothing here changes an existing export, format meaning, corpus expectation or hash vector, and whole trees keep working unchanged. On 2026-10-31 the owner added the MCP server review's findings to this release: "I want fix all of the issues and ship with 0.2.1". Tasks 14.1 to 14.10 carry them, numbered so the existing task references stay valid. Tasks 13.1 to 13.6 carry the WebKit switching remedies that Task 13's diagnosis and the follow-up decomposition call for. Task 13.1's decision log must be approved before Tasks 13.2 to 13.6 build anything, and Task 14 asserts the budget after them. Task 14.1's decision log must be approved before Tasks 14.2 to 14.10 build anything. These tasks reverse two earlier decisions on purpose: spec §13's "no intent tool" (for `setState` only, never actions) and D5's inline-only drafts (behind an opt-in root). Each MCP change is additive, and every 0.2.0 tool call keeps its text result. Publishing cannot be undone, so no tag is pushed without the owner's explicit go. Spec sections touched: §7.3 (package hash), §9 (wire format), §10 (validation), §11 (renderer), §12 (switching budget), §13 (packages, runtime matrix, conformance) and §14 (non-goals).

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

- [x] Task 11: Measure patches on the LF-17 subject (CL-15)
  - Acceptance Criteria:
    - Functional:
      - `bench/streaming.bench.ts` gains a patch mode on the same subject and constants (679 nodes, 50 rows, 10 revisions/s, one row's status per revision, `MAX_GZIP_BYTES = 1024`, `MAX_VALIDATION_AND_COMMIT_MS = 8`).
      - Per revision, the host runs `diffTrees` and sends patch JSON. The browser runs `JSON.parse` → `applyPatch` → `<Surface tree>` (arrival validation) → React commit, measured the way LF-17 measured it.
      - Results go to a new `plans/evidence/021-streaming-patches.md`, with machine, Bun, Chromium, React build and load. `019-streaming-bench.md` is not overwritten (plan 020 Compromises: it is LF-17's decision record).
      - The task records the verdict: the gzip median, and the median of arrival validation plus commit, each against its threshold. If arrival validation plus commit misses 8 ms, Task 12 runs (including when commit alone fits but leaves insufficient validation headroom). If both pass, Task 12 is recorded as `n/a — measured` and skipped.
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
      - Context7 verified the official [React Profiler](https://react.dev/reference/react/Profiler) `actualDuration` (render work, distinct from DOM commit/paint) and [Playwright evaluation](https://playwright.dev/docs/evaluating) serialization/Promise handling; installed React 19.3.1 / Playwright 1.64.1.
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
      - `bench/streaming.bench.ts`; `bench/streaming-client.tsx`; `plans/evidence/021-streaming-patches.md` (new); this plan (measurement and Task 12 trigger); `roadmap.md` §3 (execution status)
  - Test Cases to Write:
    - None. A bench, recorded as evidence. Its assertions use the fixed thresholds only in the task that claims them (Task 12, or this task if it passes).

  - Notes (executed 2026-10-31):
    - Added `--patches` to the existing streaming driver and browser client. The unchanged 679-node, 50-row generator produces 100 updates at the same 10/s target; patch mode mounts revision 0 outside measurement, then diffs and streams revisions 1–100. Every host diff/apply round-trip is asserted, as are browser arrival validation, development Profiler samples and final-tree equality. Whole-tree mode retains its original revisions, mount sample and measurement method. No renderer, public API, dependency or spec change.
    - Recorded the run in [021-streaming-patches.md](evidence/021-streaming-patches.md): median **310 JSON bytes**, **228 gzip bytes** (≤ 1,024), **0.549 ms host diffTrees** (≤ 1.5), **0.400 ms browser applyPatch** (≤ 0.5), **1.200 ms arrival validation**, **7.700 ms net Profiler render work**, and **9.100 ms arrival validation plus Profiler work** (> 8). Browser parse median was 0.000 ms at the clock resolution; flushSync wall was 21.900 ms and parse/apply/flushSync end-to-end was 22.300 ms. Achieved 9.90 updates/s using LF-17's unchanged rate calculation. Machine/build/load metadata and all 100 samples are in the record.
    - **Task 12 is required**, because the combined 9.1 ms median exceeds the fixed 8 ms budget. Clarified its trigger here and in its title: commit-only 7.7 ms fits, but the budget includes validation. Neither threshold nor the renderer changed. Context7 confirms that React's actualDuration measures render work rather than DOM commit or paint; the evidence preserves LF-17's historical metric and separately reports browser wall/end-to-end time instead of silently redefining the budget.
    - A whole-tree control using the same driver, temporarily redirecting only its evidence destination to local `evidence/021-task-11-whole-control.md`, reproduced the historical JSON/gzip medians exactly (**117,985 / 5,099 bytes**) and measured **10.300 ms** validation plus Profiler work (historical 12.100 ms). The temporary driver was removed. `019-streaming-bench.md` is byte-for-byte unchanged. Regenerate the control with the standard whole-tree command in a disposable checkout to preserve that historical record.
    - `timeout 1200s bun run check` passed: **876 passed, 4 skipped, 0 failed**, 880 tests across 109 files (282.09 s); build, generated-code checks, typecheck, lint and formatting passed. Full output is local-only at `evidence/021-task-11-check.log`. The browser client separately passed a strict TypeScript check. An exploratory strict check including the host benchmark (excluded by the existing project tsconfig) still reports its pre-existing fixture/assert typing issues; that unrelated typing cleanup was not added to this measurement task.

- [x] Task 12: Keep unchanged subtrees out of the React commit (CL-15, if Task 11's arrival validation plus commit misses)
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
      - `src/react/renderer.tsx:140-323`; `docs/spec.md` §11; Task 11 evidence.
      - React 19.3.1 in the checkout; official React [useMemo: memoizing individual JSX nodes](https://react.dev/reference/react/useMemo#memoizing-individual-jsx-nodes) and [preserving and resetting state](https://react.dev/learn/preserving-and-resetting-state), fetched through Context7 (`/reactjs/react.dev`).
      - Backlog "Profile production browser selection costs before optimizing the renderer" (P2).
    - Options Considered:
      - `React.memo` per node with a custom comparator. Rejected: it repeats work the identity check already gives.
      - Patch application inside `<Surface>`. Rejected in Task 2.
    - Chosen Approach:
      - Identity-keyed reuse of the existing `Item`s and rendered elements. Reset on validator, fallback, portal or diagnostics changes; implementations belong to the renderer factory. Publish the accepted tree and latest callbacks to reused handlers in a layout effect, so an abandoned render cannot change origins. Keep the original origin and callback for an already pending confirmation.
    - API Notes and Examples:
      - n/a (internal).
    - Files to Create/Edit:
      - `src/react/renderer.tsx`; `src/__tests__/react-browser.test.tsx`
      - `src/__tests__/fixtures/react-client.tsx`; `src/__tests__/fixtures/react-surface.tsx`; `src/__tests__/fixtures/confirmation.tsx` (browser reuse counters, local input and shared confirmation nodes). Existing surface and intent tests are run unchanged.
      - `docs/spec.md` §11; `docs/renderer.md` (patch streaming example); `plans/evidence/021-streaming-patches.md`
  - Test Cases to Write:
    - `patched_render_skips_unchanged_nodes_and_preserves_local_state_focus_scroll`: render counters and strict item/element identity prove unchanged siblings bail out, a focused text field retains its draft, scroll and button state survive, reused setState/action origins follow the accepted revision even after an empty patch and stale arrival, replacement callbacks are used, and a new validator re-renders every node.
    - `reused_nodes_follow_confirmation_fallback_and_diagnostics_changes`: retained node identities respect replacement fallback/diagnostics and a newly enabled confirmation hook.
    - Existing confirmation tests now advance revisions with shared nodes, covering single-flight, original pending origins, failed confirmation and unmount behavior. Existing surface/intent suites cover metadata, collection contexts, completion and invalid-event rejection.


  - Notes (executed 2026-10-31):
    - Added one identity-keyed `WeakMap<UiNode, Item>` per surface generation, reusing both contexts and rendered elements. Validator, fallback, portal and diagnostics changes reset the cache; implementations remain factory-owned. No new component layer, memo wrapper, dependency or public API. A layout effect publishes the accepted tree and latest callbacks to reused handlers; pending confirmations keep their original origin and callback.
    - The browser reuse regression failed before the fix (both unchanged buttons and the local text field rendered again). It now proves strict item/element reuse, changed-node-only rendering, focused draft/scroll/local-state survival, current setState/action origins after patches and stale arrivals, current callbacks and validator invalidation. A second regression covers fallback, diagnostics and enabling confirmation on retained nodes. Confirmation fixtures now share nodes across revisions; existing intent/surface tests pass unchanged. Updated spec §11 and the renderer guide with host-side patch application, whole-tree validation and dispatch checks.
    - The unchanged patch benchmark passes both medians: **228 B gzip** and **2.7 ms arrival validation plus React work** (previously 9.1 ms); commit-only/Profiler render-work median **1.3 ms**, flushSync wall **3.7 ms**, parse/apply/flushSync **4.2 ms**. Whole-tree control improves from **12.1 ms** to **10.7 ms** validation plus React work, with the same **5099 B gzip**. [The evidence](evidence/021-streaming-patches.md) records samples, machine/build/load, the original Task 11 medians, whole-tree comparison and the distinction between Profiler render work and DOM commit/paint. The original `019-streaming-bench.md` is unchanged.
    - `timeout 1200s bun run check` passed build, generated-code checks, typecheck, lint and formatting; its test run reported **867 passed, 4 skipped, 11 failed, one between-test error** (882 tests/109 files, 616.78 s) while system load reached 61.56 on 16 logical CPUs. All eleven failed tests passed unchanged in focused reruns (nine tests together, the capture-readiness case and the theme-projection case); the browser hydration timeout caused the shared-browser error and downstream failures. The two new regressions passed both the full run and focused runs. No timeout or assertion was relaxed.
    - The owner explicitly instructed: “Keep working with the current load. Document failures that are caused by system load but do not block tasks because of it”. Task completion uses that task-specific exception to the usual green full-check requirement. The evidence documents each failure and rerun rather than claiming the full check passed.
    - `bun run bench` stopped twice at unchanged validator timing gates, which do not import the changed renderer. Its patch application/diff medians still passed (**0.1372/0.6047 ms** in the second run). Running the remaining scripts separately passed the unchanged SDK render gates (**1.3296 ms**, **1.958 µs/node** for agent-home; element path **2.423 µs/node**), CSS gates and whole-tree streaming control. The final documentation checks also passed (four tests: renderer guide, links and wording), and `git diff --check` passed. No load-sensitive failure blocks completion under the owner's instruction; Tasks 13–14 remain unchanged.

- [x] Task 13: Split and diagnose the WebKit switching measurement (CL-16)
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
      - Context7 `/microsoft/playwright`: headed Linux launch/display requirements, exercised on Playwright 1.64.1; [User Timing Level 3](https://www.w3.org/TR/user-timing/): marks, measures and explicit mark timestamps.
    - Options Considered:
      - Raise the WebKit ceiling. Rejected by the deferral log, which keeps the 16.67 ms budget.
    - Chosen Approach:
      - Split the spans, then rank the causes with numbers.
      - Reproduce both test fixtures, reusing the actual React browser client; record a separate legacy switch-plus-probe control. A starts at the first switching attribute mutation and ends after the forced root layout; also record call-start-through-layout. C uses the second rAF timestamp as a rendering-opportunity proxy, not proof of physical paint. Use headed GTK under Xvfb when the live tiling display rejects the fixed viewport.
    - API Notes and Examples:
      ```sh
      LIVEFRAME_BROWSER=webkit timeout 180s bun --conditions liveframe:source plans/evidence/021-task-13/switch-split.ts --headed
      ```
    - Files to Create/Edit:
      - `plans/evidence/021-task-13/switch-split.ts` (new); `plans/evidence/021-webkit-switching.md` (new)
      - This plan (diagnosis and execution notes); `roadmap.md` §3 (execution status).
  - Test Cases to Write:
    - None. A diagnosis. Task 14 turns its verdict into tests.
    - The evidence script asserts >500 nodes, ten warm samples per mode and finite nonnegative timings; a missing attribute mark fails measurement.
  - Notes (executed 2026-10-31):
    - Added [the committed split-measurement script](evidence/021-task-13/switch-split.ts) and [the diagnosis record](evidence/021-webkit-switching.md). Reproduced the CSS fixture (956 nodes) and reused the real React browser client (686 nodes), with one cold and ten warm samples for each legacy/split mode in Chromium and WebKit, headless and headed. The record includes machine, load, versions, span boundaries, median/max results, regeneration commands and the local raw-output location. The script asserts sample counts and finite timings; it is evidence tooling and is not shipped.
    - **Task 14 must take the CSS/switching optimization branch.** WebKit CSS-only A (attribute change through forced layout) is **17/21 ms median/max headless** and **18.5/20 ms headed**, already above 16.67 ms; B adds only **1/2 ms**. React A is **13/17 ms headless** and **12/12 ms headed**. Chromium A maxima are **6.6/8.8 ms headless** and **7.1/6.2 ms headed** (CSS/React). The evidence localizes the dominant cost to style/layout resolution; no individual selector is yet established as the cause. No threshold or spec meaning changed, and redefining the measurement alone would not meet the budget.
    - Confirmed that neither existing timed test window awaits rAF: both start after the first awaited frame and end before the next. Their "headless frame pacing" comments are unsupported causal claims. The renderer schedules its layout read in rAF; the diagnostic forces that work synchronously and records double-rAF timing separately as a rendering-opportunity proxy, not proof of physical paint.
    - Headed GTK needed the same ICU/XML/flite compatibility libraries already used by headless WPE on unsupported CachyOS. Its fixed viewport failed under the live tiling desktop, so both recorded headed runs used isolated Xvfb; the record documents setup and limitations. Clay's plan 205 Tasks 24/34 real-window measurements have not arrived; recheck before Task 17. No production code, exports or browser test assertion changed.
    - `timeout 1200s bun run check` passed: **878 passed, 4 skipped, 0 failed**, 882 tests across 109 files (284.48 s). Build, generated-code checks, typecheck, lint and formatting passed. All four diagnostic browser/mode runs passed their fixture/sample assertions; final script lint/format and `git diff --check` passed. No load exception was needed. Task 14 remains unchecked.

- [x] Task 13.1: Record the WebKit switching-cost remedies (decision log)
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/021-task-13-remedies.md` records the 2026-10-31 interleaved decomposition that follows Task 13, with machine, load, versions and regeneration commands. WebKit span A, as p50/p90/max over 40 interleaved warm samples:
        - the CSS fixture as tested: 17/19/20 ms;
        - with the trusted primitive CSS: 11/14/17 ms;
        - with primitive CSS and `content-visibility:auto` on the queue rows: 8/10/12 ms;
        - the same DOM and font switch with no Liveframe CSS (the engine floor): 9/9/10 ms.
      - The record also states:
        - a no-change re-match of every rule costs about 1 ms over the floor, so selector work is not the cost;
        - a colour-only switch has no layout cost, and any typography change forces a full restyle and relayout;
        - removing `var()`, `font-size-adjust` or `@scope` changes nothing measurable;
        - container queries cost 1–4 ms.
      - The record names the fixture defect. `css-scope-browser.test.ts` loads no trusted primitive CSS, so 102 icons render at 760×984 px, the switched section is about 106,000 px tall and no flex layout applies. The proof host and Clay both ship that CSS (`proof/renderer/primitives/base.ts:22`).
      - The probe is committed as `plans/evidence/021-task-13/interleave.ts`. It uses relative imports and runs variants round-robin in one browser.
      - A decision log records the remedies with their rejected alternatives. The owner approves it before Tasks 13.2 to 13.6 start:
        - **R1 realistic fixture.** Both switching fixtures load the same trusted primitive CSS a host ships. This corrects the measured subject and does not weaken the budget.
        - **R2 deferred offscreen rendering.** A new style prop, recommended name `deferOffscreen`, takes a `space.*` or `size.*` placeholder block size. It projects to `content-visibility:auto` and `contain-intrinsic-block-size:auto <value>`, and it may be responsive like every style prop. A catalog opts a primitive in by declaring it, which the proof catalog does for `box`. The log records every consequence the author accepts by setting it:
          - paint containment clips overflow (focus rings, shadows, the pressed offset, unportaled overlays); top-layer elements and Liveframe portals escape;
          - the element becomes the containing block for absolute and fixed descendants, an independent formatting context, and has no baseline;
          - placeholder and remembered heights are stale after a switch until a row renders;
          - the work is deferred to scroll-in, not removed, and WebKit still restyles skipped rows;
          - script geometry reads on skipped nodes force rendering;
          - engines without support ignore the property and behave as today.
        - **R3 projection trims.** Each trim is kept only on interleaved A/B evidence, under Task 13.5's rule.
        - **R4 container-query replacement.** Task 13.6 is gated: it runs only if Task 13.5 leaves less margin than its threshold. The log records the cost if it runs. CSS-only and server-rendered output lose responsive values until script runs, and each resize costs an extra style and layout pass.
        - **Patch reading.** `deferOffscreen` is additive. Existing trees are unchanged, and a tree that uses it is rejected by 0.2.0 validators. The log states whether the owner accepts that in 0.2.1 (`docs/compatibility.md`: "Optional fields may be added").
        - **Budget statement.** Spec §12 and §6.4 say the 16.67 ms bounds span A, the frame of the switch. For a surface whose long repeated content is not marked `deferOffscreen`, no engine-independent bound is promised. CL-16's answer to Clay says the same.
        - **Mutant.** Task 14's "a CSS mutant that doubles selector work must fail under WebKit" is replaced. Selector work is about 1 ms, so doubling it is within noise. The replacement is a mutant that removes `deferOffscreen` from the fixture rows, which must fail Task 14's WebKit assertion.
        - **Bench subject.** `bench/css.bench.ts` and the render benches keep their budgets on the opted-in tree. Task 13.4 records before/after numbers.
    - Performance: n/a — a decision record. Its evidence is the measurement above.
    - Code Quality: the log follows `create-decision-log`. The probe is evidence tooling and is not shipped.
    - Security: law 3. `deferOffscreen` takes a design value only, never a raw length or CSS.
  - Approach:
    - Skills to Use:
      - `create-decision-log`: it adds a style prop and changes the meaning of spec §12, so it needs owner approval.
      - `find-docs`: MDN `content-visibility` and `contain-intrinsic-size`, read 2026-10-31 (Context7 `/mdn/content`).
    - Library Documentation to Check Before Implementation:
      - MDN "Using CSS containment" § `content-visibility`, and `contain-intrinsic-size` § auto.
    - Documentation Reviewed:
      - `plans/evidence/021-webkit-switching.md`; `plans/evidence/021-task-14-switching.md`; `decision-logs/2026-10-30-0430-webkit-switching-budget-deferral.md`.
      - `docs/spec.md` §6.3 (`:205-224`), §6.4 (`:256`), §12 (`:766`); `docs/compatibility.md:7,60`.
      - `src/css/style-props.ts:36-86`; `src/css/base.ts:26-37`; `src/css/design-system.ts:220-240`; `proof/renderer/primitives/base.ts`.
    - Options Considered:
      - Selector or projection rewrites alone. Rejected: their total measured headroom is about 2 ms.
      - A blanket `content-visibility` rule on a variant in app CSS. Rejected: it applies to every instance, including ones where clipping harms, and puts the library's proof outside its own validation.
      - Time-sliced switching, or a prerendered second copy. Rejected: spec §6.4 requires an atomic switch that changes no node.
      - A floor-relative or median assertion. Kept as the fallback if Task 14 still misses after Task 13.6; it would need its own owner decision.
    - Chosen Approach:
      - Fix the subject (R1), then reduce the synchronous work (R2), then trim what remains (R3, R4).
    - API Notes and Examples:
      ```tsx
      <Box variant="rule" deferOffscreen="size.row">…</Box>
      // content-visibility:auto; contain-intrinsic-block-size:auto var(--lf-v-size_row)
      ```
    - Files to Create/Edit:
      - `decision-logs/2026-10-31-…-webkit-switching-cost-remedies.md` (new)
      - `plans/evidence/021-task-13-remedies.md` (new); `plans/evidence/021-task-13/interleave.ts` (new)
      - This plan: Tasks 13.2–13.6 and Task 14 adjusted to the approved log.
  - Test Cases to Write:
    - None. A decision record. The probe asserts at least 500 nodes, 40 samples per variant and finite timings.
  - Notes (executed 2026-10-31):
    - Added [the decomposition record](evidence/021-task-13-remedies.md) and [the interleaved probe](evidence/021-task-13/interleave.ts), and ran it in WebKit, Chromium and Firefox.
    - The quieter run (load 4.5) gave WebKit span A p50/p90/max of:
      - `test` 17/19/20 ms;
      - `prim` 11/14/17 ms;
      - `prim-cv` 8/10/12 ms;
      - the no-Liveframe floor 9/9/10 ms.
    - A run under VM load (5.1 to 8.3) roughly doubled every engine's values but kept the ordering. Both runs are recorded and labelled. Raw logs are local-only in `evidence/021-task-13/`.
    - The owner approved R1–R4 as written, with R4 gated at 14 ms; `deferOffscreen` as the name; and shipping it in 0.2.1. Recorded in [the decision log](../decision-logs/2026-10-31-1438-webkit-switching-cost-remedies.md). Task 14's mutant criterion was updated in the same change.
    - The probe passed Biome after formatting. No production code, threshold or spec meaning changed.
    - `timeout 900s bun run check` passed: **878 passed, 4 skipped, 0 failed**, 882 tests across 109 files (366.77 s, under VM load).

- [x] Task 13.2: Load the trusted primitive CSS in both switching fixtures (R1)
  - Acceptance Criteria:
    - Functional:
      - `css-scope-browser.test.ts` and `react-browser.test.tsx` load the proof's `primitiveCss` before the projected sheets, as a host does. The CSS fixture's switched section measures a realistic height: icons are sized and flex layout applies. A test asserts that icon roots are no larger than their `1rem` box.
      - The shared `measureSwitching` helper from the Task 14 work in progress is kept, and both switching tests use it. Spans B and C are logged.
      - The scope, overlay, transparency and switching tests in both files still pass in Chromium, Firefox and WebKit, except the WebKit switching assertion, which Task 14 closes. The evidence records the WebKit numbers after this task.
    - Performance: Chromium and Firefox span A show no regression against `plans/evidence/021-task-14-switching.md`.
    - Code Quality: a single import of `primitiveCss`, with no copied CSS text.
    - Security: law 3 unchanged. Primitive CSS is trusted app CSS and was already shipped by the proof host.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`: test placement and the style chores.
    - Library Documentation to Check Before Implementation:
      - none — local code: `proof/renderer/primitives/base.ts`, both test files' page setup (`css-scope-browser.test.ts:35`, `react-browser.test.tsx:151`).
    - Documentation Reviewed:
      - Task 13.1's evidence.
    - Options Considered:
      - Size icons alone. Rejected: it fixes one symptom and still measures a page without primitive layout.
    - Chosen Approach:
      - Load the CSS hosts actually load.
    - API Notes and Examples:
      ```ts
      import { primitiveCss } from "../../proof/renderer/primitives/base.ts";
      ```
    - Files to Create/Edit:
      - `src/__tests__/css-scope-browser.test.ts`; `src/__tests__/react-browser.test.tsx`; `src/__tests__/fixtures/browser.ts`
      - `plans/evidence/021-task-14-switching.md` (numbers after R1)
  - Test Cases to Write:
    - `switching_fixture_loads_primitive_css`: icon roots are at most 16 px. It fails if the fixture drops `primitiveCss`.
  - Notes (executed 2026-10-31):
    - Both switching pages now load `primitiveCss` before the projected sheets: `css-scope-browser.test.ts` through its shared `sheets`, and `react-browser.test.tsx` in the served page head.
    - Added `switching_fixture_loads_primitive_css`. Kept the Task 14 work-in-progress `measureSwitching` helper, which both tests use, asserting span A at 16.67 ms in every engine with B and C logged. It is committed here.
    - Warm span A, median/max (load 4.4, VM running):
      - Chromium: CSS 6.5/7.5 ms, Surface 6.6/7.4 ms;
      - Firefox: CSS 8/10 ms, Surface 6/9 ms;
      - WebKit: CSS 14.5/20 ms (from 25 ms before R1), Surface 16/17 ms.
    - All 33 tests in both files pass in Chromium and Firefox. In WebKit only the two switching assertions fail; Tasks 13.3 and 13.4 close them. See [the Task 14 record](evidence/021-task-14-switching.md).
    - `timeout 900s bun run check` passed: **879 passed, 4 skipped, 0 failed**, 883 tests across 109 files (339.44 s). The default-engine check does not cover the WebKit gate, which stays red until Task 13.4.

- [x] Task 13.3: Add the `deferOffscreen` style prop (R2)
  - Acceptance Criteria:
    - Functional:
      - `deferOffscreen` joins the fixed style-prop set (`src/formats/fixed.ts:25`). It accepts the `space.*` or `size.*` names the app declares, and it may take responsive values.
      - The validator rejects a raw length, an undeclared name, a non-string, and the prop on a definition that does not declare it, each with the existing typed style errors and pointers.
      - `styleDeclarations` projects it to `contentVisibility: "auto"` and `containIntrinsicBlockSize: "auto var(--lf-v-…)"`, including through the responsive layer.
      - The JSON Schema (`schemas/style-record.json`, where it lists props), the TS types, the generated SDK types (`gen:check`), the elements schema and MCP `list_primitives` all carry it.
      - The proof catalog declares it on `box`.
      - Spec §6.3 gains the row and the consequences paragraph from Task 13.1's log. `docs/styling.md` documents when to use it and what it changes.
      - A browser test in every engine shows that a deferred offscreen box projects `content-visibility: auto`, and that its content stays focusable and in tab order. This replaces the planned conformance case, because the conformance suites test app primitive implementations and `deferOffscreen` is projected by the library.
    - Performance: validation and render benches stay within budget. Projection adds no rule to the design-system sheet, because the prop is inline style.
    - Code Quality: one mapping entry in `src/css/style-props.ts`, plus the value rule in `src/validate/style.ts`. No new abstraction.
    - Security: law 3. It takes design values only; a raw length or any CSS text fails closed.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`: the "new or changed format" and "new SDK surface" chores.
      - `typescript-advanced-types`: the catalog-derived prop type.
    - Library Documentation to Check Before Implementation:
      - MDN `content-visibility`, `contain-intrinsic-block-size` (Context7 `/mdn/content`).
      - React 19 inline-style support for `contentVisibility` and `containIntrinsicBlockSize` (via `find-docs`).
    - Documentation Reviewed:
      - `src/css/style-props.ts:20-86,102-164`; `src/formats/fixed.ts`; `src/validate/style.ts`; `src/__tests__/css-style-props.test.ts`; `src/__tests__/validator-node.test.ts`.
    - Options Considered:
      - A boolean prop with a library-fixed placeholder. Rejected: placeholder height belongs to the design system.
      - A new primitive (`DeferredBox`). Rejected: the problem is a layout behaviour, not a new kind, and new primitives need a gap record.
    - Chosen Approach:
      - One token-constrained style prop, following the existing dimension props.
    - API Notes and Examples:
      ```ts
      styleDeclarations({ deferOffscreen: "size.row" }, catalog).style
      // { contentVisibility: "auto", containIntrinsicBlockSize: "auto var(--lf-v-size_row)" }
      ```
    - Files to Create/Edit:
      - `src/formats/fixed.ts`; `src/validate/style.ts`; `src/css/style-props.ts`; `src/sdk/gen.ts`; `schemas/catalog.json` (regenerated with `bun scripts/schemas.ts`)
      - `src/__tests__/fixtures/proof/catalog.json`; generated `src/__tests__/fixtures/widgets/ui.gen.ts`, `ui.definitions.gen.ts`, `elements.schema.json`
      - `docs/spec.md` §6.3; `docs/styling.md`; `CHANGELOG.md` (0.2.1, unreleased)
      - Tests: `css-style-props.test.ts`, `validator-node.test.ts`, `sdk-gen-types.test.tsx`, `css-scope-browser.test.ts`
  - Test Cases to Write:
    - `defer_offscreen_projects_content_visibility`: fails if the mapping or the token variable is wrong.
    - `defer_offscreen_rejects_raw_and_undeclared`: covers a raw `px`, an undeclared name and an undeclaring definition.
    - `defer_offscreen_responsive`: a breakpoint value projects through the responsive layer.
    - A type test: `deferOffscreen="12px"` fails to compile.
    - `defer_offscreen_content_stays_focusable` (browser, every engine): computed `content-visibility` is `auto`, focusing the offscreen button works and scrolls it into view, and `tabIndex` is 0.
  - Notes (executed 2026-10-31):
    - `deferOffscreen` now appears everywhere a style prop must:
      - the fixed style-prop list, after `insetBottom`;
      - the validator: a declared `space.*` or `size.*`, responsive allowed;
      - the projection: inline `contentVisibility: "auto"` and `containIntrinsicBlockSize: "auto var(--lf-v-…)"`, plus the responsive layer through the shared chain;
      - the SDK generator (`_Length`) and the published catalog schema, where `styleProps` `maxItems` goes from 40 to 41;
      - the proof catalog's `box`.
    - Regenerated `ui.gen.ts`, `ui.definitions.gen.ts` and `elements.schema.json`.
    - Spec §6.3 gains the row and the consequences paragraph. `docs/styling.md` and a new `CHANGELOG.md` 0.2.1 (unreleased) entry document it, including that 0.2.0 validators reject trees that use it.
    - The conformance case became a browser test (see the Functional criteria). It passes in Chromium, Firefox and WebKit. The type test rejects a raw length and the prop on `Stack`. Validator tests reject `90px`, an undeclared name, `true` and `fill`.
    - The first check run caught a hand edit to `schemas/catalog.json`. The schema is regenerated by `scripts/schemas.ts`, so the hand edit was replaced. After that, `timeout 900s bun run check` passed: **881 passed, 4 skipped, 0 failed**, 885 tests across 109 files (278.60 s).
    - The benches were not run here: the change adds one entry to the style table and no tree uses the prop yet. Task 13.4 runs them on the opted-in tree.

- [x] Task 13.4: Defer the agent-home queue rows and re-prove parity (R2)
  - Acceptance Criteria:
    - Functional:
      - The agent-home queue row `Box` sets `deferOffscreen` in both widget copies (`proof/widgets/agent-home/queue-row.tsx`, `src/__tests__/fixtures/widgets/agent-home/queue-row.tsx`). The placeholder is a design value close to a row's measured height.
      - `agent-home.tree.json` and `css/agent-home.html` are regenerated (`proof/scripts/capture-css-scope.ts`), and the validator tests that read them still pass.
      - Parity holds: pixel mismatch stays at or below 1% at 1440, 1024 and 390 px, with the evidence updated. Focus rings and shadows inside rows are checked for clipping, and any clipped cue is fixed in the recipe or row padding.
      - WebKit span A for both fixtures is recorded in `plans/evidence/021-task-14-switching.md`.
    - Performance: render and CSS benches stay within budget, with before/after numbers recorded. The target is WebKit span A max ≤ 14 ms over three consecutive focused runs.
    - Code Quality: widget changes only; no library code.
    - Security: law 3. The value is a token.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`: widget and proof chores.
    - Library Documentation to Check Before Implementation:
      - none beyond Task 13.3.
    - Documentation Reviewed:
      - `proof/scripts/capture-css-scope.ts`; `proof/PARITY.md`; both `queue-row.tsx` files.
    - Options Considered:
      - Defer the whole aside. Rejected: it is mostly on screen, and the rows are the repeated offscreen content.
    - Chosen Approach:
      - Defer the repeated unit.
    - API Notes and Examples:
      - As Task 13.1.
    - Files to Create/Edit:
      - Both `queue-row.tsx` files; `src/__tests__/fixtures/proof/agent-home.tree.json` (how it is regenerated is confirmed during execution); `src/__tests__/fixtures/css/agent-home.html`
      - `proof/PARITY.md` and its evidence; `plans/evidence/021-task-14-switching.md`
  - Test Cases to Write:
    - The existing parity and validator tests on the regenerated fixtures.
    - `agent_home_rows_defer_offscreen`: the captured markup carries `content-visibility:auto` on every row. It fails if the prop is dropped.
  - Notes (executed 2026-10-31):
    - Both `queue-row.tsx` copies set `deferOffscreen="space.7"`. Rows measure 69–93 px and no closer design value exists. `space.7` (48 px) only sizes rows that have never rendered, because `auto` remembers each rendered size. Adding a `size.row` token would have touched the vocabulary, both design systems and the corpus catalog.
    - The tree fixtures are generated from the Phase-0 proof widgets, so more files changed than first listed:
      - the proof runtime and catalog: `proof/catalog/define.ts`, `proof/catalog/definitions.ts` (`box`), `proof/runtime/types.ts`, `proof/runtime/validate.ts`, and the `proof/tests/catalog.test.ts` allow-list;
      - fixtures regenerated by `proof/scripts/export-formats.ts`. Only `agent-home.tree.json` and the `core-queue` medium, large and full trees changed, since they share the row; the catalog export matched Task 13.3's JSON exactly;
      - `css/agent-home.html`, from `capture-css-scope.ts`, with 50 deferred rows;
      - `elements.json`, from `scripts/fixtures/elements.ts`.
    - **Finding: a deferred row is a stacking context.** `overlay_content_receives_pointer_events` pinned a host button at y = 900 px with `z-index: auto`, and a later deferred row then painted over it in every engine. The test now pins the button at y = 10 px, above the rows. The portal still spans the viewport, so the test still proves that an empty portal passes clicks through. Spec §6.3 and `docs/styling.md` now list this consequence.
    - **Parity.** Run with the snapshots restored from `synapta-core@fc6df4b3`, then removed; they are never committed. Before/after was 0.70/0.72/0.91% → 0.78/0.84/1.007% at 1440/1024/390 px. Crops show identical glyphs with no clipping: anti-aliasing changes because each contained row is a separate layer. The owner chose "Accept, record as cause 11", and `proof/PARITY.md` records it with both runs. The 281 → 285 DOM-path drift predates this task.
    - **Switching.** In three consecutive WebKit runs (load 2.4), span A maxima were 10/11/9 ms (CSS) and 14/14/13 ms (Surface). Chromium and Firefox maxima were at most 6 ms. See [the Task 14 record](evidence/021-task-14-switching.md). Task 13.6's gate (WebKit max above 14 ms) did not trip.
    - **Benches** (`timeout 600s bun run bench`, load 5.6, exit 0):
      - agent-home render 1.29 ms (1.90 µs/node), validation 1.01 ms;
      - `core-queue` medium, large and full renders 0.86, 1.01 and 1.09 ms, all within the 2 ms and 3 µs/node budgets;
      - style declarations 0.43 µs/node;
      - unchanged sheet sizes.

      No pre-change bench was run. The budgets are the gate. The bench rewrote `plans/evidence/019-streaming-bench.md`, which was restored.
    - `timeout 900s bun run check` passed: **882 passed, 4 skipped, 0 failed**, 886 tests across 109 files (276.02 s).

- [x] Task 13.5: Trim measured projection overhead (R3)
  - Acceptance Criteria:
    - Functional:
      - Each candidate is measured with the interleaved probe, against the tree as of Task 13.4, in WebKit, Chromium and Firefox:
        - the `:where([data-lf-ds]) *` reset and `font:inherit` rules;
        - duplicated typography declarations where a slot repeats its surface's role;
        - `container-type` on surfaces with no responsive rule in force.
      - A candidate is kept only if it improves WebKit span A by at least 0.5 ms median and regresses no engine. Rejected candidates are recorded with their numbers.
      - Every kept change passes the completeness and "no colour outside the theme" checks, and leaves the conformance projections unchanged.
    - Performance: CSS bench within budget.
    - Code Quality: changes stay in `src/css/*`. No speculative options.
    - Security: law 3 unchanged.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`: style-change chores.
    - Library Documentation to Check Before Implementation:
      - none — measured, not documented, behaviour.
    - Documentation Reviewed:
      - `src/css/base.ts`; `src/css/recipe.ts`; `src/css/design-system.ts`; Task 13.1 evidence.
    - Options Considered:
      - Applying trims without A/B evidence. Rejected: earlier trials changed nothing measurable.
    - Chosen Approach:
      - Measure each candidate; keep only proven wins.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `src/css/*` (tentative, kept wins only); `src/__tests__/css-*.test.ts` (tentative); `plans/evidence/021-task-13-remedies.md`
  - Test Cases to Write:
    - For each kept change, a projection test that fails if the change is reverted.
  - Notes (executed 2026-10-31):
    - Added upper-bound variants to [the interleaved probe](evidence/021-task-13/interleave.ts): each candidate removed outright. Ran 50 interleaved samples per variant in WebKit, Chromium and Firefox, on the tree with deferred rows.
    - WebKit span A medians: as shipped 12 ms; no `container-type` 11; no reset 13; no slot typography 11; floor 7. Chromium gains at most 0.3 ms, Firefox none. See [the remedies record](evidence/021-task-13-remedies.md#task-135-trim-candidates-upper-bounds).
    - No styling-preserving form of any candidate can reach the 0.5 ms keep rule:
      - the reset gains nothing and is required styling;
      - typography deduplication needs parent roles a per-slot projection cannot know, and is bounded at timer resolution;
      - `lf_container` is already conditional on responsive values.
    - **No trim is kept. `src/css/*` is unchanged**, so no projection test was added. The probe passed Biome.
    - Two check runs under external load (load average 13–17: a QEMU VM, podman and Java) failed only on load-sensitive tests: the React browser file timed out in one run, and the timing gates failed in the other, with the Chromium switch at 18.6 ms. Alone, the React browser file passed 26/26. At load 1.9, `timeout 900s bun run check` passed: **882 passed, 4 skipped, 0 failed**, 886 tests across 109 files (309.15 s).

- [x] Task 13.6: Replace container queries with a renderer breakpoint attribute (R4, only if Task 13.5 misses its margin)
  - Acceptance Criteria:
    - Functional:
      - This task runs only if, after Task 13.5, WebKit span A max exceeds 14 ms in any of three consecutive focused runs. Otherwise its note records "not needed" with those numbers, and it is ticked.
      - If it runs, `<Surface>` measures its width with a ResizeObserver and sets `data-lf-bp` on the scope element. The responsive layer selects on that attribute instead of `@container`. Responsive values still hold at every wider breakpoint (spec §6.3).
      - CSS-only hosts get a documented helper or attribute contract. Spec §6.3 and §6.4 and `docs/styling.md` record the change and the loss of script-free responsiveness.
    - Performance: span A improves by the measured container cost. A resize costs at most one extra style and layout pass.
    - Code Quality: the observer lives in `/react` only; `/css` stays host-API-free.
    - Security: n/a — no new input.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`; `create-decision-log` (if it runs, its spec change is confirmed against Task 13.1's log).
    - Library Documentation to Check Before Implementation:
      - ResizeObserver timing relative to rendering (MDN, via `find-docs`).
    - Documentation Reviewed:
      - `src/css/style-props.ts:137-164`; `src/css/base.ts:29`; `src/react/renderer.tsx`.
    - Options Considered:
      - Viewport media queries. Rejected: they break the container-width semantics in spec §6.3.
    - Chosen Approach:
      - Keep container-width semantics and move evaluation into the renderer.
    - API Notes and Examples:
      - n/a until run.
    - Files to Create/Edit:
      - `src/css/style-props.ts`; `src/css/base.ts`; `src/react/renderer.tsx`; `docs/spec.md`; `docs/styling.md` (all tentative, run only if the gate trips)
  - Test Cases to Write:
    - If it runs: `responsive_values_follow_surface_width`, at three widths in all engines, and `responsive_values_hold_after_switch`.
  - Notes (executed 2026-10-31):
    - **Not needed. The gate did not trip.** After Task 13.4, three consecutive focused WebKit runs measured span A maxima of 10/11/9 ms (CSS) and 14/14/13 ms (Surface). None exceeds 14 ms ([Task 14 record](evidence/021-task-14-switching.md)). Task 13.5 changed nothing that could raise them.
    - Container queries and their script-free responsiveness stay as they are. No code, spec or docs changed. If a later WebKit regression trips the gate, this task's approach still applies.
    - Covered by Task 13.5's green check (882 passed, 4 skipped, 0 failed); this task changed only plan text.

- [x] Task 14: Assert the switching budget on the library's measurement in WebKit (CL-16)
  - Depends on: Tasks 13.1 to 13.6.
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
    - `switch_under_budget_with_blur` and `switch_under_budget_with_blur_through_surface`, now asserting span (A) ≤ 16.67 ms in every engine. The mutant is the one Task 13.1's log fixes: removing `deferOffscreen` from the fixture rows must fail under WebKit. Selector work is about 1 ms, so a selector-doubling mutant cannot fail reliably.

  - Notes (attempted 2026-10-31; incomplete):
    - Added a shared measurement helper and changed both switching tests to assert span A at 16.67 ms in every engine, with no WebKit-only ceiling. The helper records one cold and ten warm samples, logs B/C and call-start-through-layout separately, and rejects missing attribute marks or invalid timings.
    - The stricter tests reproduce the unresolved library cost: CSS/Surface warm maxima are 6.9/6.7 ms in Chromium, 10/6 ms in Firefox and **25/17 ms in WebKit**. See [the Task 14 attempt record](evidence/021-task-14-switching.md) for commands and local logs. No production CSS optimization has been retained.
    - `timeout 1200s bun run check` passed with default Chromium: **878 passed, 4 skipped, 0 failed**, 882 tests across 109 files (279.98 s). Build, generated-code checks, typecheck, lint and formatting passed. The focused documentation tests passed (3 tests), as did focused lint/format and `git diff --check`. This does not override the separate failing WebKit gate.
    - Continued 2026-10-31, after Tasks 13.1–13.6. The owner chose the strict max-of-10 gate with quiet-machine WebKit evidence. Since then:
      - the replacement mutant (rows without `deferOffscreen`) fails WebKit;
      - Chromium and Firefox pass 35/35;
      - spec §6.4 and §12 name span A;
      - the 0.2.1 changelog answers the 0.2.0 limitation (uncommitted, with this task).
    - Seven WebKit runs with the host VM active (load 2.6–6.8) failed the Surface assertion at 20–25 ms max. Task 13.4's runs at load 2.4 had passed at 13–14 ms.
    - **Closed 2026-10-31 20:35.** With the VM stopped (load 1.4–2.0), three consecutive WebKit runs passed 35/35: CSS max 10, 10, 10 ms and Surface max 13, 12, 11 ms. Chromium and Firefox pass. The mutant still fails WebKit. The backlog deferral is closed with this evidence, and the 0.2.1 changelog answers the 0.2.0 limitation. See [the Task 14 record](evidence/021-task-14-switching.md).
    - CI runs WebKit on shared runners, so this strict gate may flake there under load. Fallbacks, each needing an owner decision: a median assertion, or cutting more work.

- [x] Task 14.1: Record the authoring MCP server's 0.2.1 surface (decision log)
  - Acceptance Criteria:
    - Functional:
      - A decision log records the owner's scope instruction verbatim, with the date 2026-10-31: "I want fix all of the issues and ship with 0.2.1". It also records the review that found the issues: the server works and its suites pass, but it has the gaps below. It fixes M1 to M9, each with its rejected alternatives, and the owner approves it before Tasks 14.2 to 14.10 start:
        - **M1 `outcomes`.** `render_scenarios` advertises the `outcomes` boolean that `/authoring` already accepts and the tool already passes through (verified 2026-10-31: `outcomes: "yes"` over stdio returns the handler's `invalid-document` at `/outcomes`). Spec §13's tool line gains it, so the library and the tool match again.
        - **M2 envelope errors.** `pack_draft` drops its top-level `required` (`src/cli/mcp.ts:153`). Each property's `description` says it is required, and the handler's existing `packArguments` checks report a missing key as `invalid-document` at `/files`, `/entry`, `/manifest` or `/scenarios`. Before building, the log records what the SDK does with a non-object `arguments`. `CallToolRequest` types `arguments` as an object, so that case is a protocol error the server cannot reach. If the SDK does reject it before the tool, spec §13 names that one protocol-level exception and nothing else.
        - **M3 `generated_types({ module? })`.** `module` is one of `"types"` (the default, byte-identical to today), `"implementations"` and `"elementsSchema"`. These match the CLI's `--implementations` and `--elements-schema` output byte for byte (`src/cli/liveframe.ts:65-96`, `generateDefinitions` at `src/sdk/gen.ts:216` and `generateElementsSchema` at `:338`). `/authoring`'s `generatedTypes()` takes the same argument. The log records whether `elementsSchema` is included: the recommendation is yes, because it costs one enum value and stops the tool falling behind the CLI again.
        - **M4 `set_state`.** One new tool, `set_state({ origin: { nodeId, event }, value? })`, and a matching `/authoring` `setState()` operation. They take the `setState` intent that the current render's node `nodeId` offers on `event`, apply `value` where the event carries one, and send it through `session.intent(intent, origin)` (`src/preview/session.ts:123`). The server fills `surfaceId` and `revision` from the current render, so `checkOffered` verifies the event is offered. The tool returns the re-rendered tree under the 256 KiB bound. An `action` event is refused with a typed error and never dispatched or logged (law 4). Calling it with no current single-scenario render is `not-found`, with "Call render_scenarios with a scenario first". The log also settles:
          - whether the bound preview page and a later `capture_preview` see the new state (recommended: yes, because they share the session, so an agent can capture the state it set);
          - whether a raw `{ key, value }` with no origin is accepted (recommended: no; `render_scenarios`' `state` override already covers arbitrary state, and an origin is what tests the widget's own wiring);
          - spec §13's new law-4 sentence: "its only intent path, `set_state`, applies an offered `setState`; no tool runs, logs or dispatches an action".
        - **M5 draft directories.** `AuthoringConfig` gains an optional `draftRoot`. When it is set, `pack_draft` also accepts `{ dir, entry? }` instead of `files`, `entry`, `manifest` and `scenarios`. The CLI reads `<draftRoot>/<dir>`'s top-level `.ts` and `.tsx` files, `manifest.json` and `scenarios.json`, which is the layout `examples/demo-host/widgets/draft.ts` already reads, and `entry` defaults to `entry.tsx`. Any other shape is refused with a typed error at `/dir`: an absolute `dir`, any `..` segment, a path whose real path (symlinks resolved) leaves the root's real path, a missing file, more than the directory reader's 128-source-file or 1048576 aggregate-byte bound (the packer independently bounds emitted code), or `dir` together with `files`. Without `draftRoot`, `dir` is `not-found`, naming the config field. The reader lives in the CLI (host APIs allowed), and `/authoring` stays inline-only and host-API-free. This reverses D5 (`decision-logs/2026-10-24-2330-authoring-mcp-server-contract.md`) for opted-in hosts only, and the log says so.
        - **M6 annotations.** Every tool gets a `title`, plus `readOnlyHint`, `destructiveHint`, `idempotentHint` and `openWorldHint` (all `openWorldHint: false`: no tool reaches outside the app). The recommended values are listed in this table; the owner confirms each row:

          | Tool | readOnly | destructive | idempotent |
          |---|---|---|---|
          | `list_primitives`, `list_vocabulary`, `list_capabilities`, `generated_types` | true | false | true |
          | `pack_draft` | false (replaces the session draft) | false (in memory, and a failed pack keeps the previous one) | true |
          | `render_scenarios` | false (sets the session's current render, which `set_state` and the page read) | false | true |
          | `capture_preview` | true | false | true |
          | `set_state` | false | false | false |
        - **M7 structured output.** Every tool declares an `outputSchema` and returns the same value as `structuredContent`. The text block stays byte-identical to 0.2.0, so a client that reads text sees no change.
          - Schemas come from the published documents, inlined under `$defs` because SDK 2.4.0 does not dereference absolute `$ref`s: `catalog.json` definitions, `capabilities.json`, `ui-tree.json`, and a status-array schema for the all-scenario result. Capture's structured value is the per-cell metadata array its first text block already holds, and the PNGs stay image content.
          - Non-object roots (arrays, and `render_scenarios`' tree-or-statuses) rely on SDK 2.4.0's per-era codec, which wraps them in `{ result }` for 2025-era clients. The log records that envelope.
          - `isError` results carry no `structuredContent`, and the SDK skips output validation on them.
          - The log records the validation cost on the 679-node tree (Task 14.8's budget), and the fallback if it is too slow: a lighter tree `outputSchema` (`format`, `catalogId`, `surfaceId`, `revision`, `root` as an object), because the tree was already validated by the runner.
        - **M8 capture cell bound.** `AuthoringConfig` and `createAuthoring()` gain an optional `maxCaptureCells`. The default stays 12, so 0.2.0 behaviour is unchanged, and there is a documented maximum. The recommended maximum is 48: four widths × three themes × four design systems, about 48 PNGs per tool result. The log records how large a 48-cell result is on the proof host before fixing the number.
          - A value that is not an integer from 1 to the maximum stops the server at start (exit 2) and is a typed error from `createAuthoring()`.
          - The `capture_preview` description states the configured bound, and the over-bound `limit-exceeded` message names `maxCaptureCells`.
          - This replaces the literal `maxCells: 12` (`src/authoring/index.ts`, `capturePreview`) and spec §13's "at most 12 per call".
        - **M9 structural layout.** `capture_preview({ layout: true })` returns, per cell, a `layout` record instead of leaving layout to pixel heights:
          - `{ width, height, overflowX, nodes: [{ id, x, y, width, height }] }`, with CSS-pixel boxes relative to the cell, rounded to integers;
          - `overflowX` is true when the cell's content is wider than the cell, and the record lists the ids of nodes whose box crosses the cell's right edge;
          - a node's box is the union of its `data-lf-node` wrapper's child element boxes. The wrapper is `display: contents` and has no box of its own (`src/react/renderer.tsx:310`, `docs/renderer.md` § diagnostics), so `<Preview>`'s diagnostics wrappers are what make node ids measurable. No renderer change is needed.
          - `/preview/capture` gains an optional `CaptureSession.layout?(cell)` and `CaptureOptions.layout?: boolean`. `CapturedCell` gains an optional `layout` file (`<cell>.layout.json`). A custom backend without `layout` returns `layout: null`, so existing backends keep working. `playwrightBackend` implements it with one `evaluate` per cell.
          - The log settles whether `liveframe preview capture` gains a matching `--layout` flag (recommended: yes, because `capture()` already writes the file) and the size bound: the recommendation is the existing 256 KiB result bound, with `limit-exceeded` naming the cell.
          - `layout` defaults to false, so 0.2.0 results are unchanged. Capture's structured output (M7) includes `layout` when it is requested.
          - The proof agent loop (`proof/tests/mcp-agent-loop.test.ts:174-190`) replaces the 133 px threshold with a structural assertion: the `Inline` row's buttons share one `y`, the `Stack`'s buttons have increasing `y`, and neither overflows at 360 px.
      - The log states the patch-release reading: one new tool, new optional arguments, a new optional config field, annotations and output schemas are all additive. No 0.2.0 call changes its text result or its error kinds, except a missing `pack_draft` key, which changes from the SDK string to a typed error. That is the documented fix, and the log names it as the one visible behaviour change.
      - `docs/compatibility.md` § 0.2.1 lists the MCP additions and that behaviour change.
    - Performance: n/a — a decision record. Budgets are fixed here and asserted in Tasks 14.8 to 14.10.
    - Code Quality: the log follows `create-decision-log`. No speculative tools: nothing beyond M1 to M9, and M9 adds an argument, not a tool.
    - Security: laws 1 and 4. M4 adds the first agent-to-session intent path, so the log shows it is tier 2 only and checked by `checkOffered`. M5 adds the first agent-named file path, so the log lists every rejected path shape. Both fail closed with typed errors. M9 reads geometry from the host's own page and returns numbers and node ids only, never DOM text or attributes beyond `data-lf-node`.
  - Approach:
    - Skills to Use:
      - `create-decision-log`: reverses D5 and a spec §13 sentence, so it needs explicit owner approval.
      - `liveframe-execution`: the four laws and the placement rules for the CLI and `/authoring`.
    - Library Documentation to Check Before Implementation:
      - `@modelcontextprotocol/server` 2.4.0 (Context7 `/modelcontextprotocol/typescript-sdk/v2.4.0`), read on 2026-10-31:
        - `docs/servers/tools.md`: `registerTool` `title`, `annotations` and `outputSchema`, and "the SDK validates `structuredContent` against `outputSchema`";
        - `docs/servers/errors.md`: "skips `outputSchema` validation on any `isError` result";
        - `docs/migration/upgrade-to-v2.md` (SEP-1613/2106): non-object `outputSchema` roots, the `{result}` envelope for 2025-era clients, and that external `$ref` is not dereferenced.
    - Documentation Reviewed:
      - `src/cli/mcp.ts` (schemas `:78-205`, registrations `:91-245`); `src/authoring/index.ts:131-318`; `src/preview/authoring.ts:9-45`; `src/preview/session.ts:123-134`.
      - `docs/spec.md` §13 (`:819-836`) and §7.5; `docs/mcp.md` § The tools; `decision-logs/2026-10-24-2330-authoring-mcp-server-contract.md` (D4, D5); `decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md` (R13).
      - `plans/backlog.md`: "Offer generated implementation definitions to MCP clients", "Add a setState intent tool to the authoring MCP server", "Accept draft files from disk paths in pack_draft", the residual on "Give the MCP tools one error shape", "Let an app raise the capture cell bound" and "Prove layout mistakes structurally, not by pixel height".
      - `src/preview/capture/index.ts:20-51,89-150` (session interface and cell loop); `src/preview/capture/playwright.ts:46-56`; `src/preview/react/preview.tsx:155-174` (cells and diagnostics); `proof/tests/mcp-agent-loop.test.ts:174-190`.
    - Options Considered:
      - Defer M2 to M9 to 0.3.0. Rejected by the owner.
      - M4 as a general `send_intent` that also logs actions. Rejected: law 4, and the backlog entry says to keep actions out.
      - M5 in `/authoring`. Rejected: it needs `node:fs`, and `/authoring` is host-API-free.
      - M7 by changing the text block to the structured value. Rejected: it would change every 0.2.0 client's parsed result in a patch.
      - M8 with no maximum. Rejected: the cap exists to bound one tool result's PNG payload.
      - M9 as a separate `measure_layout` tool. Rejected: it would open the page a second time for the same cells, and the layout belongs with the capture it describes.
      - M9 as an overflow flag only. Rejected: it cannot tell a row from a stack, which is the layout mistake the proof loop catches.
    - Chosen Approach:
      - One log for the whole MCP surface, so spec §13 is rewritten once and Tasks 14.2 to 14.10 only implement.
    - API Notes and Examples:
      ```ts
      // set_state, after render_scenarios({ scenario: "ready" })
      { origin: { nodeId: "root/filters/open", event: "press" } }
      // pack_draft with config.draftRoot = "./widgets"
      { dir: "agent-home", entry: "entry.tsx" }
      ```
    - Files to Create/Edit:
      - `decision-logs/2026-10-31-HHMM-authoring-mcp-server-0-2-1-surface.md` (new)
      - `docs/compatibility.md` (§ 0.2.1)
      - `decision-logs/2026-10-24-2330-authoring-mcp-server-contract.md` (a "D5 amended" note pointing at the new log, as D3's note does)
      - `plans/evidence/021-task-14-1-mcp-surface.ts` (new: assert protocol behavior, measure full-tree output validation and a real 48-cell proof-host capture)
      - This plan (execution notes and evidence-based Task 14.5/14.6/14.9 corrections); `roadmap.md` §3 (execution status)
  - Test Cases to Write:
    - None. The log fixes what Tasks 14.2 to 14.10 test. `docs-links` and `docs-wording` cover the compatibility edit.
  - Notes (executed 2026-10-31):
    - Recorded [the approved M1–M9 surface](../decision-logs/2026-10-31-2057-authoring-mcp-server-0-2-1-surface.md), including the owner's verbatim scope instruction and this task's explicit completion instruction as approval evidence. Fixed generated module choices, offered-only state changes, directory error/path rules, all eight annotation rows, structured schemas and legacy envelopes, the 12-default/48-maximum capture bound, and optional structural layout plus `--layout`. Updated compatibility §0.2.1 and added D5's amendment pointer. Tasks 14.2–14.10 remain unimplemented and unchecked; their spec edits ship with implementation.
    - Rechecked SDK 2.4.0 through Context7. [The regeneration probe](evidence/021-task-14-1-mcp-surface.ts) asserts that non-object protocol arguments are rejected and a schema without `required` accepts `{}`. Full published-schema validation of the 679-node tree measured 0.831 ms median over ten warm validations. Task 14.8 still must prove its separate ≤5 ms added tool-round-trip budget and the 2025-11-25 envelope.
    - Captured 48 real proof-host cells with the existing capture core: four scenarios × three widths × two themes × two design systems, all without render errors. Measured 9.34 s, 4845517 PNG bytes and 6581786 MCP-shaped JSON bytes with structured metadata. No images are committed. The ceiling bounds cells, not payload bytes; Task 14.9 must measure the implemented tool and document client limits.
    - Corrected Task 14.5: host snapshot readers call `session.render()` and currently reset state, so the approved opt-in `preserveState` flag and proof/demo callers are necessary for set-state-then-capture. Corrected Task 14.6: the packer bounds emitted code, not source-file count; the CLI reader gets explicit 128-source-file/1 MiB aggregate read bounds and per-file symlink containment. Task 14.9 uses the existing startup `LiveframeFailure` convention instead of changing `createAuthoring()`'s return type. Made the approved capture-state assertion and `--layout` work unconditional in their implementation tasks.
    - `timeout 900s bun run check` passed build, generation, typecheck, lint, formatting and all tests: **882 passed, 4 skipped, 0 failed** (886 tests, 109 files; test phase 291.11 s). The focused documentation checks passed (3 tests), the probe passed Biome, all eight decision-record local links resolved, and `git diff --check` passed. No production code or new runtime tests were needed for this decision task.

- [x] Task 14.2: Advertise `outcomes` on `render_scenarios` (M1)
  - Acceptance Criteria:
    - Functional:
      - `renderSchema` (`src/cli/mcp.ts:158`) gains `outcomes`, with a description that names the five `sourceOutcome` statuses, the one-outcome-source rule and the always-statuses result. The tool description mentions it.
      - `outcomes: true` over MCP returns the same statuses as `createAuthoring().renderScenarios({ outcomes: true })` on the same draft. `outcomes: "yes"` returns `invalid-document` at `/outcomes`.
      - Spec §13's `render_scenarios` line, and the `docs/mcp.md` tool table and its § on all-scenario results, name `outcomes`. The library and tool argument lists match.
    - Performance: n/a — no render-path change.
    - Code Quality: a schema and description change only. No new handler code, because `renderArguments` already checks it.
    - Security: n/a — no new authority; outcome expansion renders through the same runner.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none beyond Task 14.1.
    - Documentation Reviewed:
      - `src/authoring/index.ts:96-110` (`renderArguments`), `:162-206` (`renderOutcomes`); `docs/mcp.md:43`; `docs/spec.md:820,834`.
    - Options Considered:
      - n/a — Task 14.1 settles it.
    - Chosen Approach:
      - Advertise what already works.
    - API Notes and Examples:
      ```json
      { "name": "render_scenarios", "arguments": { "scenario": "ready", "outcomes": true } }
      ```
    - Files to Create/Edit:
      - `src/cli/mcp.ts`; `src/__tests__/cli-mcp.test.ts`; `docs/spec.md` §13; `docs/mcp.md`
      - `src/__tests__/fixtures/mcp-outcomes.config.ts`: outcome-source capabilities shared by the MCP and library parity test.
  - Test Cases to Write:
    - `tools_list_advertises_outcomes`: `render_scenarios`' input schema contains `outcomes`. Fails if the property is dropped.
    - `render_outcomes_over_mcp_matches_library`: an outcome-source draft gives deep-equal statuses over MCP and through `createAuthoring`. Fails if the MCP layer strips the argument.
    - `render_outcomes_rejects_non_boolean`: `invalid-document` at `/outcomes`.
  - Notes (executed 2026-10-31):
    - Added the optional boolean's description to the permissive `renderSchema` and mentioned expansion in the tool description. It names all five statuses, the single-outcome-source rule and the always-statuses result. Handler validation and rendering are unchanged. Updated spec §13 and the MCP guide's tool table and all-scenario results section.
    - Added an outcome-source config fixture and the three named regression tests. Discovery failed before the schema edit; parity and typed rejection already passed. MCP and library results match for all seeds and an explicitly selected seed.
    - Verification: the focused CLI MCP, authoring and guide suites passed (43 tests). `timeout 900s bun run check` passed: build, generated-file checks, typechecks, lint, formatting and 885 tests; 4 existing skips, 0 failures. No spec meaning changed beyond advertising the already-supported argument; no findings affect later tasks.

- [x] Task 14.3: Report a missing `pack_draft` argument as a `LiveframeError` (M2)
  - Acceptance Criteria:
    - Functional:
      - `pack_draft` with any of `files`, `entry`, `manifest` or `scenarios` missing returns `isError: true` and a `LiveframeError[]` with `invalid-document` at that key's pointer, never the SDK's `Input validation error` string. A call missing several keys reports each one.
      - `tools/list` still says which keys are required, through each property's `description`.
      - The non-object `arguments` case behaves as Task 14.1 recorded, and a test pins that behaviour.
      - Spec §13 drops "only a missing required key or a non-object argument still fails before the handler", or keeps only the protocol-level case Task 14.1 names. `docs/mcp.md` § Errors and exit codes agrees. The backlog residual on "Give the MCP tools one error shape" is closed.
    - Performance: n/a.
    - Code Quality: removes `required` and edits descriptions. `packArguments` already checks each key.
    - Security: n/a — validation is unchanged, only where it reports.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`; `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - SDK 2.4.0 `fromJsonSchema` behaviour with no `required` (Context7, as in Task 14.1).
    - Documentation Reviewed:
      - `src/cli/mcp.ts:131-156`; `src/authoring/index.ts:73-94`; `docs/spec.md:836`; `plans/backlog.md` "Give the MCP tools one error shape" (residual).
    - Options Considered:
      - Keep the documented exception. Rejected by the owner ("fix all").
    - Chosen Approach:
      - The backlog's first option, as plan 012 R13 chose for every other argument error.
    - API Notes and Examples:
      ```json
      [{ "kind": "invalid-document", "pointer": "/entry", "message": "Expected the entry file path", "expected": "one of the keys of files" }]
      ```
    - Files to Create/Edit:
      - `src/cli/mcp.ts`; `src/__tests__/cli-mcp.test.ts`; `docs/spec.md` §13; `docs/mcp.md`; `plans/backlog.md`
  - Test Cases to Write:
    - `pack_missing_key_is_a_liveframe_error`: each key omitted in turn gives a typed error at its pointer. Fails if `required` returns.
    - `pack_missing_keys_reports_each`: `{}` reports all four pointers.
    - `tools_list_describes_required_keys`: each property description contains "Required".
  - Notes (executed 2026-10-31):
    - Removed `pack_draft`'s top-level `required` and marked each property description "Required". Existing handler validation now reports missing arguments as `invalid-document` at their document-root pointers, including every missing key for empty or omitted arguments. Published reference schemas and pack validation are unchanged.
    - Added the three named regression tests and `pack_non_object_arguments_are_protocol_errors`, which pins stdio rejection of null, arrays, strings and numbers as protocol error -32602. Updated the published-schema test, spec §13 and the MCP guide, and closed the backlog residual. No new decision or finding affects later tasks.
    - Rechecked SDK 2.4.0 `fromJsonSchema` and protocol validation through Context7. Before implementation, the missing-key, multiple-key, required-description and schema assertions failed; the protocol test already passed. `timeout 900s bun run check` passed build, generated-file checks, typechecks, lint, formatting and **889 tests**, with 4 existing skips and 0 failures (893 tests across 109 files; test phase 306.12 s).

- [x] Task 14.4: Return every `liveframe gen` module from `generated_types` (M3)
  - Acceptance Criteria:
    - Functional:
      - `generated_types({ module })` returns, byte for byte, the module that `liveframe gen <catalog> --out f` writes (for `"types"` and when `module` is omitted), that `--implementations` writes, and that `--elements-schema` writes. Its result shape `{ note, types }` keeps the key `types` for every module, and `note` names the file to save it as.
      - An unknown `module` is `invalid-document` at `/module`, with `expected` listing the three values.
      - `/authoring` `generatedTypes({ module? })` matches, and calling it with no argument returns exactly what 0.2.0 returned.
      - Spec §13 (the tool and library lines), `docs/mcp.md` and `docs/sdk.md` (the codegen section, if it names the MCP route) agree. The backlog entry "Offer generated implementation definitions to MCP clients" is closed.
    - Performance: n/a — generation runs on demand, as the CLI does.
    - Code Quality: one argument mapped to the three existing generators. No new generator.
    - Security: n/a — read-only output derived from the catalog.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `src/sdk/gen.ts:76,216,338`; `src/cli/liveframe.ts:65-100`; `src/authoring/index.ts:239-244`.
    - Options Considered:
      - A second tool per module. Rejected: two more tools for one choice of output.
    - Chosen Approach:
      - One enum argument that mirrors the CLI flags.
    - API Notes and Examples:
      ```json
      { "name": "generated_types", "arguments": { "module": "implementations" } }
      ```
    - Files to Create/Edit:
      - `src/authoring/index.ts`; `src/cli/mcp.ts`; `src/__tests__/authoring.test.ts`; `src/__tests__/cli-mcp.test.ts`; `docs/spec.md` §13; `docs/mcp.md`; `plans/backlog.md`
  - Test Cases to Write:
    - `generated_modules_match_cli_bytes`: each of the three modules equals the CLI's output for the fixture catalog. Fails if a mode is mis-mapped.
    - `generated_types_default_unchanged`: no argument returns the 0.2.0 value.
    - `generated_types_rejects_unknown_module`.
  - Notes (executed 2026-10-31):
    - Added optional `module` selection to `/authoring` and the MCP tool, reusing `generate`, `generateDefinitions` and `generateElementsSchema`. Every mode returns `{ note, types }` with its suggested filename; the omitted/default selector preserves the original response. The permissive MCP argument description advertises all three choices while handler validation returns `invalid-document` at `/module` with the accepted values for unknown or non-string selectors.
    - Added byte-for-byte tests against actual CLI output for all three modes, library generator/default-response assertions and typed rejection coverage over both APIs. The new tests failed before implementation. Updated spec §13 and the MCP guide and closed the implementation-definitions backlog entry. `docs/sdk.md` does not name the MCP codegen route, so it needed no edit. This implements the approved M3 decision; no new decision or finding affects later tasks.
    - Verification: focused authoring, CLI MCP and guide suites passed all 50 tests. `timeout 900s bun run check` passed build, generated-file checks, typechecks, lint, formatting and **892 tests**, with 4 existing skips and 0 failures (896 tests across 109 files; test phase 287.47 s). `git diff --check` passed.

- [x] Task 14.5: Add the `set_state` tool (M4)
  - Acceptance Criteria:
    - Functional:
      - `set_state({ origin: { nodeId, event }, value? })` and `/authoring` `setState()` behave as Task 14.1 M4 fixes:
        - an offered `setState` event re-renders and returns the tree under 256 KiB;
        - an event that is not offered on that node fails as `checkOffered` does;
        - an `action` event is refused with a typed error, and `session.intents()` does not grow;
        - no current single-scenario render is `not-found`;
        - an invalid `value` is the intent's own validation error.
      - `set_state` joins the arrival-order queue with the other draft tools. After it, `capture_preview` of the selected scenario shows the new state, as Task 14.1's approved M4 requires.
      - The bound page and capture of the selected scenario preserve the state set by the tool. Add optional `PreviewSession.render({ preserveState?: boolean })`, default false; true retains state/context for the same selected scenario unless explicitly overridden. A different scenario starts from its normal initial selection. Proof/demo snapshot readers opt in; existing callers retain reset-on-render behavior. Sharing the session alone is insufficient because today's snapshot readers call `render()` and reset it.
      - `tools/list` holds eight tools. Every place that names the tool count says eight: spec §13 (`:786,819,827`), `docs/mcp.md:39,119`, `README.md:156,181,193`, `docs/adopters-0.2.md:25` (left as the 0.2.0 record, with a 0.2.1 note), `scripts/release/fixtures/step4-mcp.ts` (expected list and message), and the renamed test `tools_list_has_the_eight_tools`, which now asserts the exact list.
      - Spec §13's law-4 sentence is rewritten as Task 14.1 drafts it. `docs/security.md` names the tool. The backlog entry "Add a setState intent tool to the authoring MCP server" is closed.
    - Performance: one render per call, the same path as `render_scenarios({ scenario })`.
    - Code Quality: the tool maps one-to-one onto `session.intent`, with no intent logic in the CLI. The origin lookup reads the node's own `events` from the current tree.
    - Security: law 4. The action refusal and the no-origin refusal each have a test. Law 1: the page still receives only trees.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (laws, interaction tiers); `typescript-advanced-types` only if the intent narrowing needs it.
    - Library Documentation to Check Before Implementation:
      - none beyond Task 14.1.
    - Documentation Reviewed:
      - `src/preview/session.ts:123-134`; `src/validate/offered.ts` (`checkOffered`); `src/formats/tree.ts:8-26` (`setState` intent, `IntentOrigin`); `proof/tests/preview-agent-loop.test.ts` (intent flow).
    - Options Considered:
      - As in Task 14.1 (M4).
    - Chosen Approach:
      - Task 14.1's M4.
    - API Notes and Examples:
      ```ts
      authoring.setState({ origin: { nodeId: "root/filters/open", event: "press" } }); // Promise<Result<UiTree>>
      ```
    - Files to Create/Edit:
      - `src/authoring/index.ts`; `src/cli/mcp.ts`; `src/__tests__/authoring.test.ts`; `src/__tests__/cli-mcp.test.ts`; `src/__tests__/mcp-guide.test.ts` (the guide's exact tool list); `scripts/release/fixtures/step4-mcp.ts`; `proof/tests/mcp-agent-loop.test.ts` (its exact tool list, `:192-200`)
      - `docs/spec.md` §13; `docs/mcp.md`; `docs/security.md`; `README.md`; `docs/adopters-0.2.md`; `plans/backlog.md`
      - A fixture draft with a `setState` event: reuse one in `src/__tests__/fixtures/widgets/drafts.ts` if it has one (tentative).
      - `src/preview/authoring.ts`; `src/preview/session.ts`; `src/__tests__/preview-session.test.ts`; `proof/host/preview.ts`; `examples/demo-host/preview.ts` (opt-in state preservation and its host callers); `examples/demo-host/tests/preview.test.ts` (the demo's exact tool list); `proof/tests/mcp-capture.test.ts`; `docs/spec.md` §7.5; `docs/preview.md`
  - Test Cases to Write:
    - `set_state_applies_offered_event`: the tree changes as the widget's state wiring says.
    - `set_state_refuses_unoffered_event`; `set_state_refuses_action_event` (`intents()` unchanged); `set_state_before_render_says_to_render`.
    - `set_state_then_capture_shows_state`: required by Task 14.1's approved M4; exercise the real host snapshot path.
    - `render_preserve_state_is_opt_in`: same-scenario snapshots retain changed state/context only when opted in; scenario changes reset and explicit overrides win. Existing reset-on-render tests stay unchanged.
    - `tools_list_has_the_eight_tools`: the exact list. Fails if a tool is added or dropped.
  - Notes (executed 2026-10-31):
    - Added queued `/authoring` `setState()` and MCP `set_state`. The operation reads the current tree's own offered event, refuses actions before the session can log them, completes literal/event-carried values with the shared helper, and calls `session.intent` with the current surface/revision. Unknown origins and invalid values retain typed errors; output reuses the 262144-byte tree bound. Successful repacking clears the selection; failed packing, scenario checks and outcome expansion preserve it. Reused the harness draft, with no new dependency or format.
    - Added opt-in `preserveState` to preview rendering and enabled it in proof/demo snapshot readers. Bound snapshots refresh the tool's origin revision, so another state call works after capture. Ordinary `render_scenarios` explicitly retains reset behavior even if a caller supplies an extra `preserveState` argument. Session tests cover retained context/state, overrides and scenario changes; the real proof capture test applies and captures state twice.
    - Updated the spec (§7.5 and §13), security and outsider guides, README, adopter note, backlog closure and all eight-tool lists, including the guide/demo test expectations found during execution. No further spec decision was needed beyond approved M4.
    - `timeout 900s bun run check` passed: 897 tests passed, 4 skipped, 0 failed. The focused MCP/capture run passed 52 tests. `timeout 900s bun run demo:test tests/preview.test.ts` passed the packed archive's demo typecheck and all 4 preview tests. One earlier full run hit the existing runner warm-overhead timing gate at 0.112 ms against 0.1 ms; the unchanged final rerun passed without relaxing the assertion. The full release/archive gate and publishing remain later plan tasks.

- [x] Task 14.6: Read `pack_draft` drafts from a directory under an opt-in root (M5)
  - Acceptance Criteria:
    - Functional:
      - With `draftRoot` configured, `pack_draft({ dir, entry? })` packs exactly what `readDraft(<root>/<dir>)` in the demo host packs, so the result's hash equals an inline `pack_draft` of the same files.
      - Each rejection Task 14.1 M5 lists has its own typed error at `/dir`: absolute path, `..`, a symlink escaping the root, a missing `manifest.json` or `scenarios.json`, over the bounds, and `dir` together with `files`. `dir` without `draftRoot` is `not-found`, naming `draftRoot`.
      - `AuthoringConfig.draftRoot` is documented in its type (`src/preview/authoring.ts`), spec §13 and `docs/mcp.md` § Write the config module. `loadConfig` validates that it is a string naming an existing directory, and the server refuses to start otherwise (exit 2). The backlog entry "Accept draft files from disk paths in pack_draft" is closed, and D5's amendment note is in place (Task 14.1).
    - Performance: directory reads are bounded before packing: at most 128 top-level source files and 1048576 aggregate bytes across sources, `manifest.json` and `scenarios.json`. The packer's independent emitted-code bound remains 1 MiB; it has no existing source-file-count bound.
    - Code Quality: one small CLI module (`src/cli/draft-dir.ts`) that turns a directory into `PackInput`, then the existing inline path. `/authoring` is unchanged, and the host-API-free scan still passes.
    - Security: law 1 — no draft code runs during reading. Every path rejection has a test, and the real-path containment check runs after symlinks are resolved.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (placement: host APIs only in the CLI); `find-docs` for Bun `node:fs/promises` `realpath`/`lstat` behaviour on 1.4.4.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.4 `node:fs/promises` (`realpath`, `readdir` with `withFileTypes`).
    - Documentation Reviewed:
      - `examples/demo-host/widgets/draft.ts`; `src/cli/mcp.ts:58-73` (`loadConfig`); `src/pack/bundle.ts:198-244` (no source-file-count bound); `src/formats/package.ts:65-76` (emitted-code byte bound); Task 14.1's M5 (new CLI read bounds and per-file real-path checks).
    - Options Considered:
      - Per-file `paths: string[]`. Rejected: the agent would still send the manifest and scenarios inline, and a directory matches the layout the demo host and `liveframe gen` users already have.
    - Chosen Approach:
      - Task 14.1's M5. Keep the filesystem read in the CLI's arrival-order queue before forwarding the resulting inline input to `/authoring`.
    - API Notes and Examples:
      ```ts
      export default { catalog, capabilities, draftRoot: "./widgets" } satisfies AuthoringConfig;
      ```
    - Files to Create/Edit:
      - `src/cli/draft-dir.ts` (new); `src/cli/mcp.ts`; `src/preview/authoring.ts`; `src/__tests__/cli-mcp.test.ts`; `src/__tests__/fixtures/mcp-draft-root.config.ts` (new)
      - `docs/spec.md` §13; `docs/mcp.md`; `plans/backlog.md`; `roadmap.md` §3 (execution status)
  - Test Cases to Write:
    - `pack_dir_matches_inline_hash`.
    - `pack_dir_rejects_absolute`, `_dotdot`, `_symlink_escape`, `_missing_manifest`, `_with_files`. Each fails if its check is removed.
    - `pack_dir_without_root_names_draftRoot`; `config_rejects_missing_draft_root` (exit 2).
    - `pack_dir_rejects_file_symlink_escape`, `_missing_scenarios`, `_missing_entry`, `_malformed_json`, `_nonregular_file`, `_source_count_bound`, `_aggregate_byte_bound`, `_conflicting_inline_fields`: each reader error is typed at `/dir`; bounds reject before unbounded content reads. A sibling path sharing the root's prefix is not contained.

  - Notes (executed 2026-10-31):
    - Added CLI-only `draftRoot` configuration, canonicalized from the server working directory and validated as an existing directory at startup. Invalid roots report `invalid-document` at `/draftRoot` and exit 2. Added the bounded top-level directory reader; it checks canonical directory and per-file containment, regular files, 128-source and 1048576-byte aggregate limits before content allocation, and bounds actual reads too. Reader errors stay at `/dir`; ordinary pack/document validation is unchanged. `/authoring` remains inline-only and host-API-free.
    - Included reads in the CLI arrival-order queue with packing, rendering, state and capture; shutdown drains it before closing authoring. Tests cover demo-reader hash parity, relative-root resolution, ignored unrelated/nested files, in-root directory symlinks, every named rejection, exact read-bound acceptance, no execution while packing, and pack-before-render ordering. Updated discovery expectations, the public config type, spec §13 and the MCP guide; closed the disk-path backlog entry and confirmed D5's existing amendment. No new decision was needed beyond approved M5.
    - Checked Bun filesystem documentation through Context7 (the available versioned docs were 1.4.2; execution used Bun 1.4.4). The 21 initial regression tests failed before implementation. Focused authoring/MCP/guide suites passed 76 tests; the final directory-focused run passed 22 tests, including queue ordering. `timeout 900s bun run check` passed build, generation, typechecks, lint, formatting and **921 tests**, with 4 existing skips and 0 failures (925 tests across 109 files; test phase 296.77 s). An initial check caught the reader's complexity lint limit; a small path-validation predicate resolved it without suppressing the rule. The release/archive gate and publishing remain later tasks. Directories remain host-controlled as approved; protection against concurrent local file replacement is outside this reader's contract.

- [x] Task 14.7: Annotate every tool (M6)
  - Acceptance Criteria:
    - Functional:
      - All eight tools in `tools/list` carry a `title` and the four hints from Task 14.1's table.
      - The handlers that ignore their arguments drop the unused `input` parameter (`src/cli/mcp.ts:106,114,122`).
      - `docs/mcp.md` § The tools shows the hints per tool, and spec §13 states that the tools are annotated and that annotations never change execution.
    - Performance: n/a.
    - Code Quality: the annotations sit in each `registerTool` config, and the test is one table compared against `tools/list`.
    - Security: n/a. The annotations are hints, and the decision log notes that clients must not treat them as a security boundary.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - SDK 2.4.0 `registerTool` `title` and `annotations` (Task 14.1's read).
    - Documentation Reviewed:
      - `src/cli/mcp.ts:91-245`.
    - Options Considered:
      - As in Task 14.1 (M6).
    - Chosen Approach:
      - Task 14.1's table.
    - API Notes and Examples:
      ```ts
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
      ```
    - Files to Create/Edit:
      - `src/cli/mcp.ts`; `src/__tests__/cli-mcp.test.ts`; `docs/spec.md` §13; `docs/mcp.md`
  - Test Cases to Write:
    - `tools_carry_approved_annotations`: `tools/list` equals the approved table. Fails if a hint changes.
  - Notes (executed 2026-10-31):
    - Added the approved M6 titles and all four explicit hints directly to all eight `registerTool` configs. Removed the unused parameters from `list_vocabulary` and `list_capabilities`; `list_primitives` still needs its input for `kinds` filtering.
    - Added the exact eight-row `tools/list` regression table, observed it fail before implementation and pass afterward. Rechecked SDK 2.4.0 `registerTool` title/annotations through Context7's versioned `docs/servers/tools.md`.
    - Documented the per-tool titles/hints and their idempotence meaning in `docs/mcp.md`; spec §13 states that annotations never change execution or enforce permissions/isolation. This implements the approved M6 decision without changing handlers' behavior or text results.
    - `timeout 900s bun run check` passed: 922 tests passed, 4 skipped, 0 failed, including existing MCP calls, agent loop and capture coverage. `git diff --check` passed.

- [ ] Task 14.8: Return `structuredContent` against an `outputSchema` from every tool (M7)
  - Acceptance Criteria:
    - Functional:
      - Every tool declares the `outputSchema` from Task 14.1, and every successful call returns `structuredContent` that deep-equals `JSON.parse` of its first text block. For capture, that is the cell-metadata array.
      - Every 0.2.0 text block is byte-identical: a regression test records today's texts before the change and compares them after.
      - A 2025-era client receives `{ result }` for non-object roots, as Task 14.1 records. The test pins the protocol version the SDK negotiates with the test client, and names it.
      - An `isError` result has no `structuredContent`.
      - Each `outputSchema` resolves with no external `$ref`, and `tools/list` does not throw `MissingRefError` for any tool.
      - Spec §13 and `docs/mcp.md` state the structured result per tool, and the text-compatibility rule.
    - Performance:
      - The median `render_scenarios({ scenario })` round trip on the 679-node agent-home tree grows by at most 5 ms over the pre-change median (10 warm calls each, recorded in this task's notes).
      - If it grows more, take Task 14.1's lighter tree schema and re-measure.
    - Code Quality: one `structured(value)` result helper beside `text()`/`failure()` (`src/cli/mcp.ts:75-76`). The schemas are built from the published `schemas/*.json` documents, as `packSchema` already is, never hand-copied.
    - Security: n/a — output only; no new data leaves (capability `meta` is still omitted unless `exposeMeta` is set, and a test checks `structuredContent` too).
  - Approach:
    - Skills to Use:
      - `liveframe-execution`; `find-docs` (re-check the SDK 2.4.0 per-era codec page if the envelope test surprises).
    - Library Documentation to Check Before Implementation:
      - SDK 2.4.0 `docs/migration/support-2026-07-28.md` § Per-era wire codecs; `docs/servers/tools.md` § Return structured output.
    - Documentation Reviewed:
      - `src/cli/mcp.ts:75-245`; `schemas/catalog.json`, `capabilities.json`, `ui-tree.json`.
    - Options Considered:
      - As in Task 14.1 (M7).
    - Chosen Approach:
      - Task 14.1's M7.
    - API Notes and Examples:
      ```ts
      const structured = (value: unknown) => ({ ...text(value), structuredContent: value });
      ```
    - Files to Create/Edit:
      - `src/cli/mcp.ts`; `src/__tests__/cli-mcp.test.ts`; `src/__tests__/fixtures/mcp-texts.json` (new, the 0.2.0 text baseline); `docs/spec.md` §13; `docs/mcp.md`
  - Test Cases to Write:
    - `structured_content_matches_text`: for every tool. Fails if they diverge.
    - `text_results_unchanged_from_0_2_0`: compares against the recorded baseline.
    - `structured_meta_hidden_without_expose`; `error_results_have_no_structured_content`; `tools_list_output_schemas_resolve`.

- [ ] Task 14.9: Let an app raise the capture cell bound (M8)
  - Acceptance Criteria:
    - Functional:
      - `maxCaptureCells` in `AuthoringConfig` and `createAuthoring()` sets the per-call cell bound. Omitted, it is 12 and every 0.2.0 call behaves as before.
      - A call over the bound is refused before any cell is captured, as today (`src/preview/capture/index.ts:113`). The `limit-exceeded` message names the bound and `maxCaptureCells`.
      - An invalid value fails as Task 14.1 M8 fixes: exit 2 from `liveframe mcp`, with `invalid-document` at `/maxCaptureCells`; `createAuthoring()` throws `LiveframeFailure` carrying that error, preserving its synchronous object-returning API. The maximum is 48.
      - The `capture_preview` description states the configured bound.
      - Spec §13 (the library line `:819` and the tool line), `docs/mcp.md` (§ Write the config module and the tool table) and the `AuthoringConfig` doc comment agree. The backlog entry "Let an app raise the capture cell bound" is closed.
    - Performance: record the byte size and wall time of an actual 48-cell tool call on the proof host. Compare with Task 14.1's core-capture baseline (9.34 s, 6581786 JSON bytes including structured metadata); timings and PNG sizes may vary. The ceiling bounds cell count, not bytes, so document that a client may require narrower axes.
    - Code Quality: one option replaces the literal. No per-axis bounds.
    - Security: n/a — a transport bound with a hard ceiling, which fails closed.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `src/authoring/index.ts` (`capturePreview`, `maxCells: 12`); `src/cli/mcp.ts` (`loadConfig`, the capture description); `src/preview/authoring.ts:29-45`.
    - Options Considered:
      - As in Task 14.1 (M8).
    - Chosen Approach:
      - Task 14.1's M8.
    - API Notes and Examples:
      ```ts
      export default { catalog, capabilities, preview, maxCaptureCells: 36 } satisfies AuthoringConfig;
      ```
    - Files to Create/Edit:
      - `src/authoring/index.ts`; `src/cli/mcp.ts`; `src/preview/authoring.ts`; `src/__tests__/authoring.test.ts`; `src/__tests__/cli-mcp.test.ts`; `src/__tests__/fixtures/mcp-capture.config.ts` (or a new fixture with a raised bound)
      - `docs/spec.md` §13; `docs/mcp.md`; `plans/backlog.md`
  - Test Cases to Write:
    - `capture_bound_defaults_to_twelve`: 13 cells are refused with no config. Fails if the default changes.
    - `capture_bound_raised_by_config`: 13 cells pass with `maxCaptureCells: 16`, and 17 are refused naming the field.
    - `capture_bound_rejects_invalid_config`: 0, 1.5 and over the maximum each refuse to start (exit 2), and `createAuthoring()` throws `LiveframeFailure` with the typed error.

- [ ] Task 14.10: Report each captured cell's layout structurally (M9)
  - Acceptance Criteria:
    - Functional:
      - `capture_preview({ layout: true })` and `/authoring` `capturePreview({ layout: true })` return each cell's layout record as Task 14.1 M9 fixes. Without `layout`, results are byte-identical to before this task.
      - `capture(url, { layout: true })` writes `<cell>.layout.json` and sets `CapturedCell.layout`. A backend without `CaptureSession.layout` gives `layout: null`, and a test proves an existing custom backend still type-checks and runs.
      - Layout is correct on known fixtures:
        - a node's box is the union of its wrapper's children;
        - nested `display: contents` wrappers resolve to their nearest boxed descendants;
        - a node with no box (hidden, or no children) is reported with zero width and height, never omitted;
        - `overflowX` and the crossing node ids are right for a deliberately too-wide row.
      - The size bound from Task 14.1 is enforced with `limit-exceeded`, naming the cell.
      - The proof agent loop's layout step asserts structure, not pixel height, and the 133 px threshold and its comment are removed. The pixel-height helper `pngSize` goes too, if nothing else uses it.
      - Capture's `outputSchema` (Task 14.8) gains the optional `layout` field, and `structured_content_matches_text` covers it.
      - Spec §13 (capture tool and `/preview/capture` row), §7.5 if it describes capture output, `docs/mcp.md` and `docs/preview.md` (capture section and the approved `--layout` flag) agree. The backlog entry "Prove layout mistakes structurally, not by pixel height" is closed.
    - Performance: `layout: true` adds at most 100 ms per cell on the 679-node agent-home scenario at width 360, as a median over 10 cells, recorded in this task's notes.
    - Code Quality:
      - The geometry code is one function evaluated in the page, in `playwright.ts`. `capture()` only orchestrates it, as it does for screenshots.
      - `/preview/capture` stays host-API-free: geometry comes from the injected backend.
      - No renderer or `<Preview>` change.
    - Security: law 1 — the page receives only trees, as before. The layout record holds numbers and node ids only. Host page content beyond `data-lf-node` never reaches the agent through it.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`; `find-docs` for Playwright 1.64 `Locator.evaluate` and `Element.getClientRects` on `display: contents`.
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64 `Locator.evaluate`/`evaluateAll` (Context7 `/microsoft/playwright`).
      - CSSOM View `getBoundingClientRect` for `display: contents` elements (empty rect), which is why the union of the children's boxes is used.
    - Documentation Reviewed:
      - `src/preview/capture/index.ts:20-150`; `src/preview/capture/playwright.ts:46-56`; `src/react/renderer.tsx:305-316`; `src/preview/react/preview.tsx:150-175`; `proof/tests/mcp-agent-loop.test.ts:14-20,174-190`; `docs/renderer.md` § diagnostics.
    - Options Considered:
      - As in Task 14.1 (M9).
    - Chosen Approach:
      - Task 14.1's M9.
    - API Notes and Examples:
      ```ts
      type CellLayout = {
        width: number;
        height: number;
        overflowX: boolean;
        overflowing: string[];
        nodes: { id: string; x: number; y: number; width: number; height: number }[];
      };
      ```
    - Files to Create/Edit:
      - `src/preview/capture/index.ts`; `src/preview/capture/playwright.ts`; `src/authoring/index.ts`; `src/cli/mcp.ts`
      - `src/cli/capture.ts` and `src/cli/liveframe.ts` (the approved valueless `--layout` flag and returned layout files)
      - `src/__tests__/capture*.test.ts` (tentative: the existing capture suites; confirm with `graft grep "ariaSnapshot"`); `src/__tests__/cli-mcp.test.ts`; `proof/tests/mcp-agent-loop.test.ts`; `proof/tests/mcp-capture.test.ts`
      - `docs/spec.md` §13 (and §7.5 if needed); `docs/mcp.md`; `docs/preview.md`; `plans/backlog.md`
  - Test Cases to Write:
    - `layout_boxes_union_wrapper_children`; `layout_nested_contents_wrappers`; `layout_reports_boxless_nodes`; `layout_flags_overflowing_row`. Each fails if the union, recursion, zero-box or overflow rule breaks.
    - `layout_off_results_unchanged`; `custom_backend_without_layout_gives_null`.
    - `layout_over_bound_is_limit_exceeded`.
    - Proof loop: `Inline` buttons share one `y` and `Stack` buttons' `y` increases. Fails if the agent's layout fix is not visible structurally.

- [ ] Task 15: Write the 0.2.1 documentation
  - Acceptance Criteria:
    - Functional:
      - The four post-0.2.0 corrections (020 impact F1 to F4) are confirmed present in `docs/spec.md` §13, `docs/compatibility.md`, `docs/adopters-0.2.md` and `README.md`, and the backlog entry is closed once Task 18 ships them.
      - `docs/adopters-0.2.md` gains a 0.2.1 section mapping CL-10 to CL-16 to the shipped API, spec section and limitation. Its LF-17 text says patches shipped.
      - `CHANGELOG.md` has `## 0.2.1`, with:
        - Added: validator bundle, `canonicalJson`/`packageHash`, data `exports`, tree patches, `stale-patch`, and the MCP server's `set_state` tool, `generated_types` modules, `draftRoot` directories, annotations, structured output, `maxCaptureCells` and capture `layout`;
        - Fixed: `structuredClone`, runtime matrix, realm message, package corpus hash, WebKit switching, the unadvertised `outcomes` argument, and the missing-key error shape;
        - the R15 note that every addition is additive, and Task 14.1's one visible MCP behaviour change (a missing `pack_draft` key is now a `LiveframeError`).
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
    - Functional: `plans/evidence/021-request-acceptance.md` lists every acceptance bullet of CL-10 to CL-16 and of Task 14.1's M1 to M9, each with a named passing test, gate step or evidence record. Every named test passes in one saved run (`plans/evidence/021-request-acceptance.log`, local-only).
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
      - `package.json` `version` is `0.2.1-rc.1`. `bun run check`, `bun run release:gate` (with the new validator-bundle, data-export and patch-vector steps, and the MCP step listing eight tools from the installed `bin`), `bun scripts/release/peer-floors.ts` and `bun run demo:test` pass against the packed tarball.
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
      - `plans/evidence/021-impact-analysis.md` sweeps all 12 areas against the released 0.2.1. Areas 1, 2, 4, 7, 8 and 11 must address the patch format, the validator bundle and the runtime matrix by name. Areas 3, 4 and 9 must address `set_state` (law 4), `draftRoot` path checks, the MCP structured output and capture `layout` by name. Area 12 records what Clay can now remove (its own validator bundle, its `structuredClone` shim, path imports of `dist/pack/hash.js`) and any gap left.
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
- `timeout 600s bun test --conditions liveframe:source src/__tests__/cli-mcp.test.ts src/__tests__/authoring.test.ts src/__tests__/mcp-guide.test.ts proof/tests/mcp-capture.test.ts`
- `timeout 600s bun run release:gate`
- `timeout 900s bun scripts/release/peer-floors.ts`
- `timeout 600s bun run demo:test`
- `timeout 300s bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.1` (after Task 18)
- `npm view @arnilo/liveframe dist-tags` (after Task 18)

## Compromises Made
- To be filled after tasks are completed and tests pass.

## Further Actions
- To be filled after task completion with improvements, rationale, and priority.
