# Plan 034 Task 1: Request-Time Pipeline Baseline and Proposed Budgets (`agent-home` Code Package)

## 1. Environment and Command

- **Date:** 2026-11-16
- **Machine:** Linux 7.3.0-4-cachyos x86_64; AMD Ryzen 9 PRO 7940HS w/ Radeon 780M Graphics (16 logical CPUs)
- **Runtime:** Bun 1.4.4 (`38afee6c8`)
- **Host load average (`uptime`, 1 / 5 / 15 min):**
  - Before run: `16.27, 24.90, 22.05`
  - After run: `15.83, 23.66, 21.76`
  - Note: Other workloads on the 16-thread host kept load between 15.8 and 16.3 during the run. Because all 8 physical cores / 16 SMT threads are active, SMT execution-unit and cache contention inflates per-call `process.cpuUsage()` figures by ~1.5–1.8× compared with the 2026-11-15 review run at load ~12 (`plans/evidence/033-review-findings.md`). Both runs are recorded below; relative shares and ratios match across both loads.
- **Command:**
  ```bash
  bun --conditions liveframe:source bench/host.bench.ts
  ```
- **Verification test:**
  ```bash
  bun test --conditions liveframe:source src/__tests__/bench-json.test.ts
  ```

---

## 2. Raw Output (`bench/host.bench.ts`)

```json
{"dependentsMs":0.14017666666666664,"intentMs":1.2726766666666667,"intentBaselineMs":1.1997533333333332,"intentPipelineMs":0.07292333333333345,"inputBytes":3612,"renderMs":1.3742383333333335,"skippedMs":0.8414633333333333,"rerenderMs":1.121615,"validateTreeMs":0.019683333333333334,"diffTreesMs":0.004018333333333333,"pipelineMs":0.05500499999999997,"split":{"loadMs":0.7864583333333334,"bindMs":0.05961666666666667,"renderKeyMs":0.08225333333333333}}
{"httpSetStateCpuMs":2.1662000000000003}
{"checkPackagesMsPerPackage":1.407853,"packages":1000}
{"subject":"agent-home","packageBytes":204649,"codeBytes":28199,"scenarioBytes":171729,"memoryStore":{"renderUncachedMs":66.38416666666667,"renderVerifiedMs":33.95916666666667,"skippedMs":20.091,"loadUncachedMs":27.14316666666667,"loadVerifiedMs":15.802333333333332},"fileStore":{"renderUncachedMs":47.243,"renderVerifiedMs":32.60666666666666,"skippedMs":20.069,"loadUncachedMs":29.084999999999997,"loadVerifiedMs":17.525000000000002},"split":{"storeReadMs":2.9133333333333336,"fileStoreReadMs":1.4438333333333333,"verifyUncachedMs":26.598333333333333,"verifyVerifiedMs":16.430833333333332,"equalityMs":0.9081666666666667,"bindAndFitMs":0.5755,"renderKeyMs":1.4515,"runnerMs":5.9285,"validateTreeMs":4.674666666666666,"diffTreesMs":1.76}}
```

---

## 3. Subject Size Breakdown (`agent-home` Code Package)

Packed from `src/__tests__/fixtures/widgets/drafts.ts` (`drafts[0]`, `packageOptions`):

| Part | Bytes | KiB | Share of package |
|---|---:|---:|---:|
| Whole package (`JSON.stringify(pkg)`) | 204,649 | 199.9 KiB | 100.0% |
| Bundled widget code (`pkg.code`) | 28,199 | 27.5 KiB | 13.8% |
| Scenarios (`JSON.stringify(pkg.scenarios)`) | 171,729 | 167.7 KiB | 83.9% |
| Manifest and envelope | 4,721 | 4.6 KiB | 2.3% |

---

## 4. Pipeline Measurements and Confirmed Budgets (`agent-home` Code Package)

Every figure in `bench/host.bench.ts` is median CPU time (`process.cpuUsage()` user + system, median of 5 batches of 6 calls after warm-up). No new `budget()` assertion is added in Task 1 so today's code stays green; the owner confirmed the budgets below on 2026-11-16 (`"Confirmed"`), and Tasks 2–6 enforce them.

### 4.1 End-to-End `renderPlacement` and `loadPlacement`

| Row (`JSON` path) | `--json` metric key | 2026-11-15 review (load ~12) | 2026-11-16 baseline (load 15.8–16.3) | Proposed CPU budget (for Tasks 2–6) | Rationale |
|---|---|---:|---:|---:|---|
| `memoryStore.renderUncachedMs` | `code_render_uncached_ms` | 39.16 ms | 66.384 ms | **≤ 60.0 ms** | Uncached path verifies the 200 KiB package from scratch (`verifyPackage` + runner `verifyPackageHash`); Task 4 halves `packageHash` and `renderKey`, Task 5 trims runner input walks. |
| `memoryStore.renderVerifiedMs` | `code_render_verified_ms` | 18.31 ms | 33.959 ms | **≤ 20.0 ms** | With Task 2 (`loadVerifiedMs` ~3.8 ms instead of 15.8 ms), Task 4 (`renderKey` halved) and Task 5 (composed props), total CPU drops from ~34 ms to ~14–16 ms even under heavy load (~8 ms at moderate load). |
| `memoryStore.skippedMs` | `code_skipped_ms` | 12.62 ms | 20.091 ms | **≤ 8.0 ms** | A skipped render runs `loadPlacement` + `bindSources`/fit + `renderKey`. After Task 2 (`loadVerifiedMs` ≤ 5 ms) and Task 4 (`renderKey` ≤ 1 ms), a skipped call costs ~5 ms under load (~2.5 ms at moderate load). |
| `memoryStore.loadUncachedMs` | `code_load_uncached_ms` | 15.00 ms | 27.143 ms | **≤ 30.0 ms** | Full `verifyPackage` + store reads; Task 4 reduces the `packageHash` share. |
| `memoryStore.loadVerifiedMs` | `code_load_verified_ms` | 14.07 ms | 15.802 ms | **≤ 5.0 ms** | **Task 2 gate.** Today a `verifiedPackages()` hit still costs 15.8 ms because `verifyStoredPackage` runs `validateWidgetPackageShape`, `packageHash` and `canonicalJson(catalog/capabilities)`. Replacing that with `(id, version, installKey)` lookup + `sameJson` (`0.908 ms`) + `storeReadMs` (`2.913 ms`) brings a hit to ~3.8 ms under load (~2.5 ms at moderate load). |
| `fileStore.renderUncachedMs` | `code_file_render_uncached_ms` | — | 47.243 ms | **≤ 60.0 ms** | Same uncached pipeline over `fileStore()`. |
| `fileStore.renderVerifiedMs` | `code_file_render_verified_ms` | — | 32.607 ms | **≤ 20.0 ms** | Same verified pipeline over `fileStore()`. |
| `fileStore.skippedMs` | `code_file_skipped_ms` | — | 20.069 ms | **≤ 8.0 ms** | Same skipped pipeline over `fileStore()`. |
| `fileStore.loadUncachedMs` | `code_file_load_uncached_ms` | — | 29.085 ms | **≤ 30.0 ms** | Full `verifyPackage` + `fileStore` reads. |
| `fileStore.loadVerifiedMs` | `code_file_load_verified_ms` | — | 17.525 ms | **≤ 5.0 ms** | **Task 2 gate.** `fileStoreReadMs` (`1.444 ms`) + `equalityMs` (`0.908 ms`) + `verifyPlacementInputs` brings a `fileStore` cache hit to ~2.5 ms under load. |

### 4.2 Split of One `renderPlacement` (`agent-home` Code Package)

| Split row (`JSON` path) | `--json` metric key | Pipeline step (spec §7.7) | 2026-11-15 review (load ~12) | 2026-11-16 baseline (load 15.8–16.3) | Proposed CPU budget (for Tasks 2–6) | Rationale |
|---|---|---|---:|---:|---:|---|
| `split.storeReadMs` | `code_split_store_read_ms` | R2 store reads (`memoryStore`: `getPlacement`, `getPackage`, `getState`) | 1.58 ms (pkg copy) | 2.913 ms | **≤ 3.5 ms** | **Task 3 evaluation row.** 83.9% of the 200 KiB JSON copy in `memoryStore` is scenarios. Together with `equalityMs`, fits inside the ≤ 5.0 ms `loadVerifiedMs` budget. |
| `split.fileStoreReadMs` | `code_split_file_store_read_ms` | R2 store reads (`fileStore`: `readFile` + `JSON.parse` for placement, package, state) | — | 1.444 ms | **≤ 3.0 ms** | **Task 3 evaluation row.** `Bun`/Node `readFile` + native `JSON.parse` is half the CPU cost of `memoryStore`'s `JSON.parse(JSON.stringify(...))`. |
| `split.verifyUncachedMs` | `code_split_verify_uncached_ms` | R2 verification without cache (`verifyStoredPackage` + `verifyPlacementInputs`) | 12.96 ms | 26.598 ms | **≤ 25.0 ms** | Full shape, Acorn parse, scenario validation and `packageHash`; Task 4 speeds up `packageHash` by ≥ 2×. |
| `split.verifyVerifiedMs` | `code_split_verify_verified_ms` | R2 verification with `verifiedPackages()` (`verifyStoredPackage` + `verifyPlacementInputs`) | ~12.5 ms | 16.431 ms | **≤ 2.0 ms** | **Task 2 target.** Today `verifyStoredPackage` re-runs shape validation (`~2.7 ms`), `packageHash` (`~5.5–12.6 ms`) and install canonicalisation (`~0.4–0.8 ms`) on every hit. Task 2 replaces all three with memoised install key + `sameJson` (`0.908 ms`). |
| `split.equalityMs` | `code_split_equality_ms` | R2 `sameJson(cachedPkg, storedCopy)` over 204,649 bytes | — | 0.908 ms | **≤ 1.5 ms** | **Task 2 & Task 3 row.** Iterative deep equality over the 200 KiB package is **18.1× cheaper** than today's `verifyVerifiedMs` (`16.431 ms`). |
| `split.bindAndFitMs` | `code_split_bind_and_fit_ms` | R3–R5 `bindSources` + `resolve` + `fitData` (`compileSchema` over 4 sources, 33 KB data) | — | 0.576 ms | **≤ 1.5 ms** | Already small (1.7% of `renderVerifiedMs`). |
| `split.renderKeyMs` | `code_split_render_key_ms` | R6 `renderKey` over `agent-home` inputs (33,899 canonical bytes) | 0.68 ms (quiet) | 1.452 ms | **≤ 1.0 ms** | **Task 4 target.** Streaming canonical JSON bytes directly into SHA-256 targets ≥ 2× speedup (`~0.7 ms` under load, `~0.35 ms` quiet). |
| `split.runnerMs` | `code_split_runner_ms` | R8 `inProcessRunner().render` on `agent-home` (679 nodes, 50 `QueueRow`s, `TaskCard`, `Facts`) | ~2.0 ms (wall, quiet) | 5.929 ms | **≤ 5.0 ms** | **Task 5 target.** Short-circuiting `isJson` on SDK-owned input containers removes repeated walks in composed components (`QueueRow`, `TaskCard`, `Facts`). |
| `split.validateTreeMs` | `code_split_validate_tree_ms` | R9 host `validator.validateTree` on the 679-node emitted tree | 0.89 ms (quiet) | 4.675 ms | **≤ 5.0 ms** | Unchanged in Plan 034; standalone per-node budget (`≤ 1.5 µs/node` = `1.02 ms` on a quiet host) remains gated in `bench/validator.bench.ts`. |
| `split.diffTreesMs` | `code_split_diff_trees_ms` | R10 `diffTrees(previous.tree, next.tree)` across two 679-node trees | 0.47 ms (quiet) | 1.760 ms | **≤ 2.5 ms** | Unchanged in Plan 034; standalone diff budget (`≤ 1.5 ms` on a quiet host) remains gated in `bench/validator.bench.ts`. |

---

## 5. Key Findings for Tasks 2–6

1. **Where the verified-cache time goes today (Task 2):**
   - On `memoryStore()`, `loadVerifiedMs` is `15.802 ms` out of `33.959 ms` for `renderVerifiedMs` (**46.5%** of a full cached render and **78.7%** of a skipped render at `20.091 ms`).
   - Inside `loadVerifiedMs`, `verifyVerifiedMs` is `16.431 ms` while `storeReadMs` is `2.913 ms` (`1.444 ms` on `fileStore`).
   - `sameJson(cachedPkg, storedCopy)` (`equalityMs`) is **`0.908 ms`** — **18.1× faster** than today's `verifyVerifiedMs` (`16.431 ms`).
   - Switching `verifyStoredPackage` to key by `(id, version, memoisedInstallKey)` and verify hits via `sameJson` will save ~15.5 ms per `renderPlacement` under load (~10.5 ms at moderate load).
2. **What scenarios cost after Task 2 (Task 3 preview):**
   - Once Task 2 lands, the remaining per-request cost attributable to the package's 171.7 KB of scenarios is a portion of `storeReadMs` (`2.913 ms` in `memoryStore`, `1.444 ms` in `fileStore`) plus a portion of `equalityMs` (`0.908 ms`), totaling ~3.8 ms in `memoryStore` and ~2.4 ms in `fileStore` — both inside the proposed **≤ 5.0 ms** `loadVerifiedMs` budget. Task 3 will re-measure after Task 2 and record the decision against this budget.
3. **Cold `inProcessRunner` timeout under host load:**
   - Under load 15–16, a cold first `renderPlacement` can exceed `inProcessRunner`'s default 100 ms wall-clock `timeoutMs`. Passing `runOptions: { timeoutMs: 5000 }` in `bench/host.bench.ts` (matching `bench/runner.bench.ts:33`) prevents wall-clock timeout flakes while measuring CPU time.
