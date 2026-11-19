# Plan 034 — Architectural Impact Analysis (Request-Time Performance)

Date: 2026-11-17
Plan: [`plans/034-Phase-7-Part-U-Request-Time-Performance.md`](../034-Phase-7-Part-U-Request-Time-Performance.md)
Baseline: [`plans/evidence/034-baseline.md`](034-baseline.md)
Scenario cost record: [`plans/evidence/034-scenarios-at-request-time.md`](034-scenarios-at-request-time.md)
QuickJS validator record: [`plans/evidence/034-quickjs-validator.md`](034-quickjs-validator.md)

This document sweeps the twelve impact areas in `.agents/skills/create-plan/references/liveframe.md` §5 across Tasks 1–6 and follow-up Task 6a of Plan 034, restates Task 1's pipeline table with after measurements on the same machine and command, states why each optimisation keeps Law 2, and records the owner-approved disposition of Findings `F1`–`F6`.

---

## 1. The Twelve Impact Areas

### 1. Spec (`docs/spec.md`)

- **§7.4 (Storage, `:905`):** Updated in Task 2 so cached `loadPlacement` states the actual contract: `verifiedPackages()` looks up by `(id, version)` and canonical JSON of `catalog` and `capabilities` (memoised once per pair when both installation documents are deeply frozen; canonicalised per call otherwise), confirms `sameJson` equality against the stored record at every depth, and returns the cached deeply frozen object without hashing or shape-checking on a hit; any mismatch misses and runs full `verifyPackage`.
- **§7.1 / §7.2 (SDK inputs and composed props), §7.3 (packages), §7.5 (QuickJS runner), §8 (`renderKey`):** Still match what shipped. `render()` still rejects non-JSON props on composed components at every depth (`ownedCopies` only short-circuits containers the SDK itself created and deep-froze); `packageHash` and `renderKey` emit byte-identical SHA-256 digests; `quickjsRunner({ reuse: "package" })` still keeps one runtime per package hash with only strings crossing the sandbox boundary.
- **Structural gate:** `src/__tests__/docs-spec-structure.test.ts` passes.

### 2. Public API and Formats (`exports`, `.d.ts`, schemas, wire formats)

- **Zero public declaration changes:** `scripts/release/api/register-0.3.1.json` adds no Plan 034 entries (`api-stability.test.ts` passes against `scripts/release/api/0.3.0.json` + `register-0.3.1.json` and both companion baselines).
- **Wire formats, JSON Schemas, conformance vectors:** Untouched. Task 3 confirmed Option C ("no change") so `liveframe-package/1`, `Store`, and `conformance/hash/` / `conformance/corpus/` / `conformance/patch/` are unchanged. Task 4 keeps `canonicalJson()` returning identical text and proves `digest()`, `renderKey()`, and `packageHash()` match `conformance/hash/*.json` and `sha256(utf8(canonicalJson(v)))` identically. Task 6 adds `config` only to the internal parent–child IPC `RenderRequest` (`packages/runner-quickjs/src/protocol.ts`), which is not exported from `@arnilo/liveframe-runner-quickjs`.

### 3. The Four Laws (Security Criterion)

Every optimisation added in Plan 034 preserves Laws 1–4; specifically, Law 2 ("The UI tree is validated data") holds across all three new fast paths:

- **Why a `verifiedPackages()` cache hit keeps Law 2 (`src/store/verified.ts`):**
  - Stored records remain untrusted until proved identical to verified content (`loadPlacement` / `verifyStoredPackage`).
  - The cache lookup key is `(manifest.id, manifest.version, installKey(install))`, avoiding trusting a claimed `pkg.hash` field or store object identity (`memoryStore` / `fileStore` return fresh copies).
  - `installKey` memoises `JSON.stringify([canonicalJson(catalog), canonicalJson(capabilities)])` in a `WeakMap<object, WeakMap<object, string>>` **only** when `deepFrozen(catalog) && deepFrozen(capabilities)` passes (recursively checking `Object.isFrozen` and that every own property descriptor is a value property, never a getter); mutable or getter-bearing installation documents are canonicalised on every call.
  - On lookup, `sameJson(cached, doc)` (`src/formats/json.ts:53-63`) checks structural and value equality iteratively at every depth (`Object.is` primitives, exact own-key sets, array lengths, and realm prototype match via `realmError`). Any single nested change, added key, or tampered code byte misses and takes full `verifyPackage` (`hash-mismatch` on tampered content). Returning `cached` (which was frozen and verified by `verifyPackage`) lets `verifyPackageHash` (`src/preview/cache.ts`) skip re-hashing by object identity safely.
  - Tests holding it: `verified_hit_returns_the_cached_object_without_hashing`, `record_differing_in_one_nested_value_misses`, `tampered_code_with_the_original_hash_is_hash_mismatch`, `same_package_under_another_install_misses`, `runner_does_not_rehash_a_cached_package` (`src/__tests__/store-load.test.ts`).

- **Why a streamed digest keeps Law 2 (`src/pack/hash.ts`):**
  - Package integrity (`packageHash`) and re-run cache equivalence (`renderKey`) depend on producing the exact SHA-256 of RFC 8785 UTF-8 canonical JSON and failing closed on non-JSON values or lone surrogates.
  - `digest(value)` implements the exact RFC 8785 rules (UTF-16 sorted keys, ECMAScript `JSON.stringify` number formatting including `-0` → `0`, escaped control characters/`"`/`\`, UTF-8 encoding, lone-surrogate detection, cycle detection via `stackItems` / lazy `ancestorSet`, and prototype check) streaming directly into the 8 KiB SHA-256 block buffer (`buf` + `compress`), throwing `TypeError` for functions, `BigInt`, `undefined`, symbols, `NaN`/`Infinity`, cycles, non-plain prototypes, and lone surrogates.
  - Tests holding it: `streamed_digest_equals_the_canonical_text_digest`, `non_json_value_still_throws_type_error` (`src/__tests__/pack-hash.test.ts`), and `hash_vectors_match` / `package_hash_vectors_through_public_exports` / `render_key_vectors_through_public_exports` (`src/__tests__/hash-vectors.test.ts`).

- **Why SDK-owned composed-prop short-circuiting keeps Law 2 (`src/sdk/render.ts`):**
  - Only containers created and `Object.freeze`d by `isJsonContainer(..., copy)` in `checkInputs` (plus `NO_ACTIONS`) are added to the module-private `ownedCopies` `WeakSet` (`src/sdk/render.ts:40, 586, 602`), and `isJson` short-circuits only when `copy === undefined` (`:526`).
  - Caller-frozen objects are **never** added to `ownedCopies` (they may contain getters or non-JSON values that `checkInputs` must copy/reject). Any widget-built wrapper object around owned values is still walked at its own levels and rejected at the exact pointer for `function-prop`, `async-render`, or `invalid-prop`.
  - Tests holding it: `composed_props_holding_owned_inputs_are_not_rewalked`, `function_nested_in_a_widget_built_prop_is_still_function_prop`, `callers_frozen_object_is_not_trusted` (`src/__tests__/sdk-inputs.test.tsx`).

- **Why a kept configuration in QuickJS keeps Law 1 and Law 2 (`packages/runner-quickjs/src/`):**
  - **Law 1:** Only JSON strings (`config` and `request`) cross into QuickJS (`protocol.ts`, `runtime.ts:123-127`, disposed immediately after `callFunction`); no host object or capability enters the sandbox.
  - **Law 2:** Each kept runtime in `createEngine` (`kept` map) is already keyed by `pkg.hash`, and any render error or host exception drops the sandbox (`runtime.ts:159-170`). Holding `lastConfig` and `parsed` inside that `pkg.hash`-keyed sandbox creates no cross-package channel. Whenever `catalog` or `capabilities` changes, `config !== lastConfig` triggers `JSON.parse(config)`, giving new object identities so `runner-kit`'s `WeakMap<Catalog, WeakMap<Capabilities, ...>>` validator cache misses and recompiles. `reuse: "none"` destroys the runtime after every render, and the host still verifies `pkg.hash`, library pins, and every returned tree via `accept()` (`validateTree`).
  - Tests holding it: `kept_runtime_compiles_the_validator_once` (`packages/runner-quickjs/src/__tests__/engine.test.ts`), `changed_capabilities_recompile_in_a_kept_runtime`, `reuse_none_is_unchanged` (`packages/runner-quickjs/src/__tests__/runner.test.ts`).

- **Laws 3 and 4:** Untouched; no style channel or host-authority path changed.

### 4. Validation (Install-time, `render()`, Host and Arrival; `LiveframeError` Shapes)

- All validation boundaries and typed error shapes remain identical: `verifyStoredPackage` cache misses take `verifyPackage`; `digest` throws `TypeError` caught by `pack()` / `verifyPackage()`; `isJson` in `expand()` preserves `function-prop` / `async-render` / `invalid-prop` pointers for widget-built objects; `quickjsRunner` host `accept()` validates every returned tree against the current `{ catalog, capabilities, manifest }` and `limits`.

### 5. Styling (Catalog Vocabulary, Theme Tokens, Design-System Recipes, Scoped CSS)

- **None —** Plan 034 touched no catalog vocabulary, theme, design-system recipe, or `/css` projection code.

### 6. Interaction Tiers (Tier 1 CSS/ARIA, Local State/Bindings, Tier 2 `setState`, Tier 3 `action`)

- **None —** Plan 034 touched no interaction tier semantics (`local`/`setLocal`, `setState`, `action`, `handleIntent`).

### 7. Performance (Before and After Pipeline Table + Budgets)

Environment and command for Task 1's table: Linux `7.3.0-4-cachyos` x86_64, AMD Ryzen 9 PRO 7940HS (16 logical CPUs), Bun `1.4.4`, `bun --conditions liveframe:source bench/host.bench.ts`. Median CPU time (`process.cpuUsage()` user + system, median of 5 batches × 6 calls after warm-up) on the `agent-home` code package (`204,649` bytes total; `28,199` bytes `code`; `171,729` bytes `scenarios`).

#### 7.1 `bench/host.bench.ts` Before and After (`agent-home` Code Package)

| Row (`JSON` path) | Task 1 Baseline (load 16.3 → 15.8) | After Tasks 2–6 (load 12.7 → 17.0) | Speedup (Before / After) | Confirmed Budget | Status |
|---|---:|---:|---:|---:|---|
| `memoryStore.renderUncachedMs` | 66.384 ms | **39.608 ms** | 1.68× | ≤ 60.0 ms | Pass |
| `memoryStore.renderVerifiedMs` | 33.959 ms | **14.013 ms** | 2.42× | ≤ 20.0 ms | Pass |
| `memoryStore.skippedMs` | 20.091 ms | **4.607 ms** | 4.36× | ≤ 8.0 ms | Pass |
| `memoryStore.loadUncachedMs` | 27.143 ms | **16.019 ms** | 1.69× | ≤ 30.0 ms | Pass |
| `memoryStore.loadVerifiedMs` | 15.802 ms | **4.507 ms** | 3.51× | ≤ 5.0 ms | Pass (`budget()` gated) |
| `fileStore.renderUncachedMs` | 47.243 ms | **29.573 ms** | 1.60× | ≤ 60.0 ms | Pass |
| `fileStore.renderVerifiedMs` | 32.607 ms | **15.372 ms** | 2.12× | ≤ 20.0 ms | Pass |
| `fileStore.skippedMs` | 20.069 ms | **3.886 ms** | 5.16× | ≤ 8.0 ms | Pass |
| `fileStore.loadUncachedMs` | 29.085 ms | **18.120 ms** | 1.61× | ≤ 30.0 ms | Pass |
| `fileStore.loadVerifiedMs` | 17.525 ms | **2.392 ms** | 7.33× | ≤ 5.0 ms | Pass (`budget()` gated) |
| `split.storeReadMs` (`memoryStore`) | 2.913 ms | **1.405 ms** | 2.07× | ≤ 3.5 ms | Pass |
| `split.fileStoreReadMs` (`fileStore`) | 1.444 ms | **0.777 ms** | 1.86× | ≤ 3.0 ms | Pass |
| `split.verifyUncachedMs` | 26.598 ms | **12.855 ms** | 2.07× | ≤ 25.0 ms | Pass |
| `split.verifyVerifiedMs` | 16.431 ms | **0.470 ms** | 34.96× | ≤ 2.0 ms | Pass (`budget()` gated) |
| `split.equalityMs` (`sameJson`) | 0.908 ms | **0.255 ms** | 3.56× | ≤ 1.5 ms | Pass (`budget()` gated) |
| `split.bindAndFitMs` | 0.576 ms | **0.432 ms** | 1.33× | ≤ 1.5 ms | Pass |
| `split.renderKeyMs` | 1.452 ms | **0.509 ms** | 2.85× | ≤ 1.0 ms | Pass |
| `split.runnerMs` | 5.929 ms | **4.453 ms** | 1.33× | ≤ 5.0 ms | Pass |
| `split.validateTreeMs` | 4.675 ms | **2.640 ms** | 1.77× | ≤ 5.0 ms | Pass |
| `split.diffTreesMs` | 1.760 ms | **1.316 ms** | 1.34× | ≤ 2.5 ms | Pass |

On the 8 KB template subject in `bench/host.bench.ts`, `split.loadMs` dropped from `0.786 ms` (baseline) to `0.044 ms` (`<= 0.8 ms` `budget()` gated), `renderMs` from `1.374 ms` to `0.704 ms`, and `skippedMs` from `0.841 ms` to `0.141 ms`.

#### 7.2 Component Benchmarks (Tasks 4–6)

- **`bench/hash.bench.ts` (Task 4):**
  - Interleaved `bun bench/ab.ts HEAD bench/hash.bench.ts --runs 9` (Task 4): `packageHash.agentHome` `5.505 ms → 2.369 ms` CPU (**2.68×** paired speedup); `renderKey.109KiB` `3.435 ms → 1.121 ms` CPU (**3.14×** paired speedup).
  - Post-Task-6 standalone run (`bun --conditions liveframe:source bench/hash.bench.ts`): `packageHash (agent-home, 199 KiB)` `3.403 ms` CPU (`<= 5 ms`), `2.33×` vs 2-pass (`>= 2×`); `renderKey (1,000 rows, 110984 B)` `1.903 ms` CPU (`<= 3 ms`), `2.45×` vs 2-pass (`>= 2×`); `verifyPackage (agent-home)` `18.803 ms` CPU (`<= 20 ms`).
- **`bench/render.bench.ts` (Task 5):**
  - Interleaved `bun bench/ab.ts HEAD bench/render.bench.ts --runs 3` (Task 5): `composed-6-layers` (51 nodes, 1,000 rows) dropped from `2.479 ms` (`18.14×` direct) to `0.0764 ms` (`1.015×` direct, **18.5× faster**).
  - Post-Task-6 standalone run: `composed-6-layers` passed (`0.1388 ms` direct vs `0.1298 ms` 6 layers, `0.987× <= 1.100×`), while the pre-existing wall-clock `<= 3 µs/node` checks failed under concurrent host load `17.5–18.3` (`agent-home` `4.210 µs/node`), matching the existing quiet-host backlog item.
- **`bench/runner.bench.ts` (Task 6):**
  - Task 6 run (load `9.99`): `quickjsPackage.agent-home` `48.366 ms` (budget tightened `<= 60 ms → <= 50 ms`), `quickjsPackage.smallest` `1.311 ms` (budget tightened `<= 8 ms → <= 4 ms`); all budgets passed.
  - Post-Task-6 loaded run (load `17.03`): `quickjsPackage.smallest` `1.868 ms` (`<= 4 ms`), `quickjsPackage.agent-home` `54.873 ms` (`quickjs none agent-home` tripped `110 ms` at `129.7 ms` under load `17`).
- **Findings:**
  - **F4 (`execute`):** `packages/runner-quickjs/src/__tests__/engine.test.ts:87` (`quickjs_disposes_every_handle`) had no explicit timeout and timed out at `5000 ms` under load `~16` (`7547 ms`); fixed in Task 6a with `, 20000`.
  - **F5 (`backlog`, P3):** `bench/host.bench.ts:561-574` calls `budget()` on 5 rows while the remaining Task 1 confirmed budgets are logged as metrics only; backlogged P3 alongside the quiet-host benchmark run.
  - **F6 (`backlog`, P4):** Under load `~16`, three `src/__tests__/cli-mcp.test.ts` tests tripped `workerRunner()`'s default `100 ms` render timeout on the first `agent-home` render inside a fresh worker (all passed in `620–730 ms` standalone); backlogged P4.

### 8. Portability (Host-API-Free Core, Runtime Target, Browser Engines)

- `src/store/verified.ts`, `src/pack/hash.ts` (`SAFE` `Uint8Array(65536)`, `buf` `Uint8Array(8192)`, synchronous non-reentrant scratch), and `src/sdk/render.ts` (`ownedCopies` `WeakSet`) use pure ES2022 only with no `node:`, `bun:`, DOM, or `crypto` imports. `src/__tests__/portability.test.ts` and `bun run release:gate` (including plain-Node execution of host-API-free subpaths and self-contained bundles) pass. `packages/runner-quickjs` remains Bun-only (`engines.bun >= 1.4.2`).

### 9. Agent Authoring (Preview, Capture, MCP Server, `liveframe gen`, Determinism)

- `createPreview()`, `createAuthoring()`, `liveframe mcp`, and `liveframe gen` inherit faster `packageHash`, `render()`, and `quickjsRunner({ reuse: "package" })` with no change to authoring schemas, generated code, or tool signatures (`bun run gen:check` passes). See **F6** for `cli-mcp.test.ts` cold-JIT worker timeouts under heavy host load.

### 10. Docs and Examples (`docs/`, `README.md`, `CHANGELOG.md`, Skill References)

- Updated in Task 7: `docs/model.md` ("Performance: where the time goes" gains the Plan 034 request-time `agent-home` pipeline rows).
- **Findings executed in Task 6a:**
  - **F1 (`execute`):** `docs/compatibility.md:147`, `docs/adopters-0.3.md:58`, and `docs/migration-0.3.md:159` updated so they accurately note `0.3.1` `sameJson` verification reuse on cache hits instead of claiming stored content is freshly hashed on every load.
  - **F2 (`execute`):** `docs/packages.md:450` updated (`4 ms` → `1.3 ms` for a one-node widget under `quickjsRunner({ reuse: "package" })`); `CHANGELOG.md` `## Unreleased` → `Performance:` updated to include Tasks 4, 5, and 6 alongside Task 2.
  - **F3 (`execute`):** `.agents/skills/liveframe-execution/references/sdk.md:26` updated from the pre-0.3.0 single-`WeakSet` description to `inputCopies` (`WeakMap`) + `ownedCopies` (`WeakSet`); `plans/034-Phase-7-Part-U-Request-Time-Performance.md:330` fixed to `bun test --conditions liveframe:source ...`.
- **Gates:** `src/__tests__/docs-links.test.ts`, `src/__tests__/docs-wording.test.ts`, `src/__tests__/docs-spec-structure.test.ts`, and `src/__tests__/host-guide.test.ts` pass.

### 11. Conformance (`/conformance`, `/conformance/react`)

- **None —** No conformance suite case or expectation changed in Plan 034. Every `conformance/hash/`, `conformance/corpus/`, `conformance/patch/`, and `conformance/runner/` fixture produces identical output; all conformance suites pass.

### 12. Reference Hosts (`proof/`, `examples/demo-host`, `packages/starter`)

- **None —** No reference host contract or primitive changed in Plan 034. `proof/`, `examples/demo-host`, and `packages/starter` tests and `bun run release:gate` (`15 / 2 / 2` archive checks) pass.

---

## 2. Findings and Dispositions

The table below was presented to the owner in Task 7; the owner selected **"(Recommended) Confirm all: execute F1, F2, F3, F4; backlog F5 (P3), F6 (P4)"**.

| ID | Area(s) | Finding | Recommended | Owner Decision | Resolution |
|---|---|---|---|---|---|
| **F1** | 10 (Docs), 2 (Cache) | `docs/compatibility.md:147`, `docs/adopters-0.3.md:58`, and `docs/migration-0.3.md:159` still say `verifiedPackages()` freshly hashes stored content on every load (`0.3.0` wording) instead of `sameJson` equality on `0.3.1+` hits. | `execute` | `execute` | Updated in Task 6a across `docs/compatibility.md:147`, `docs/adopters-0.3.md:58`, and `docs/migration-0.3.md:157-163`. |
| **F2** | 10 (Docs) | `docs/packages.md:450` still lists `4 ms` for a one-node widget under `quickjsRunner({ reuse: "package" })` (cut to `1.311 ms` in Task 6); `CHANGELOG.md` `## Unreleased` → `Performance:` omitted Tasks 4–6. | `execute` | `execute` | Updated `docs/packages.md:450` (`1.3 ms`) and added Tasks 4–6 entries to `CHANGELOG.md` `## Unreleased` in Task 6a. |
| **F3** | 10 (Docs & Skill Refs) | `.agents/skills/liveframe-execution/references/sdk.md:26` still described the pre-0.3.0 single-`WeakSet` input cache instead of `inputCopies` + `ownedCopies`; `plans/034:330` had `bun --conditions liveframe:source test`. | `execute` | `execute` | Updated `.agents/skills/liveframe-execution/references/sdk.md:26` and fixed `plans/034:330` (`bun test --conditions liveframe:source ...`) in Task 6a. |
| **F4** | 7 (Test Stability) | `packages/runner-quickjs/src/__tests__/engine.test.ts:87` (`quickjs_disposes_every_handle`) had no explicit timeout and exceeded Bun's 5,000 ms default under load ~16 (`7547 ms` in `check`, `6951 ms` standalone). | `execute` | `execute` | Added `, 20000` timeout to `quickjs_disposes_every_handle` in `packages/runner-quickjs/src/__tests__/engine.test.ts:110` in Task 6a. |
| **F5** | 7 (Performance) | `bench/host.bench.ts:561-574` enforces `budget()` on 5 rows (`template load`, `homeLoadVerified`, `homeFileLoadVerified`, `homeVerifyVerified`, `homeEquality`), while the remaining Task 1 confirmed budgets are metrics only. | `backlog` (P3) | `backlog` (P3) | Added to `plans/backlog.md` (P3) and `plans/034` `## Further Actions`. |
| **F6** | 7 (Test Stability), 9 (Authoring) | Under load ~16 during `bun run check`, three `cli-mcp.test.ts` tests tripped `workerRunner()`'s default `100 ms` render timeout on the first `agent-home` render inside a fresh worker (all passed standalone in `620–730 ms`). | `backlog` (P4) | `backlog` (P4) | Added to `plans/backlog.md` (P4) and `plans/034` `## Further Actions`. |

---

## 3. Whole-Plan Verification

Recorded after Task 6a and Task 7 edits:

| Gate | Result |
|---|---|
| `bun run check` | **Pass** — `build`, `gen:check`, `typecheck`, `lint`, `format:check`, and full `bun run test`: `1,806 pass`, `4` pre-existing skips, `0 fail` across `162` files (`634.03 s`, load `10.18 → 13.79`) |
| `bun test --conditions liveframe:source src/__tests__/hash-vectors.test.ts src/__tests__/pack-hash.test.ts src/__tests__/store-load.test.ts src/__tests__/sdk-inputs.test.tsx packages/runner-quickjs src/__tests__/docs-links.test.ts src/__tests__/docs-wording.test.ts src/__tests__/docs-spec-structure.test.ts` | **Pass** — `94 pass, 0 fail` across `11` files (`18.33 s`) |
| `bun --conditions liveframe:source bench/host.bench.ts` | **Pass** — all 20 `agent-home` rows + template `load` (`0.044 ms <= 0.8 ms`) within Task 1 budgets |
| `bun --conditions liveframe:source bench/hash.bench.ts` | **Pass** — `packageHash (agent-home)` `3.403 ms` CPU (`2.33×`), `renderKey (1,000 rows)` `1.903 ms` CPU (`2.45×`) |
| `bun --conditions liveframe:source bench/render.bench.ts` | `composed-6-layers` **Pass** (`0.987× <= 1.100×`); pre-existing wall-clock `<= 3 µs/node` checks fail under concurrent host load `17.5–18.3` |
| `bun --conditions liveframe:source bench/runner.bench.ts` | `quickjsPackage.smallest` `1.868 ms <= 4 ms`; `quickjsPackage.agent-home` `48.366 ms <= 50 ms` in Task 6 (`54.873 ms` under load `17.03`, `quickjs none agent-home` `129.7 ms > 110 ms` under load `17.03`) |
| `bun run release:gate` | **Pass** — core `15/15`, `runner-quickjs` `2/2`, `starter` `2/2` |
