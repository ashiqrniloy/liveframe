# Plan 034 Task 3 (P1): Scenarios in Request-Time Loads — Measured, No Change

**Question:** After Task 2 (`verifiedPackages()` cache hit confirmed by `sameJson` with memoised installation keys), what do the `171,729` bytes of scenarios (`83.9%` of the `204,649`-byte `agent-home` code package) still cost per `renderPlacement` / `loadPlacement` in store reads and the equality walk, and does that cost call for splitting scenarios out of request-time package loads?

**Outcome:** **No change (Option C).** After Task 2, verified `loadPlacement` on the `agent-home` code package costs **`2.635 ms`** on `memoryStore()` and **`1.728 ms`** on `fileStore()`, both well inside Task 1's confirmed **`≤ 5.0 ms`** budget (`bench/host.bench.ts:562-569`). The scenarios themselves account for **`0.994 ms`** on `memoryStore()` (`0.813 ms` JSON clone + `0.182 ms` `sameJson`) and **`0.579 ms`** on `fileStore()` (`0.398 ms` file read/parse + `0.182 ms` `sameJson`). No code, format, or `Store` interface change is made.

---

## 1. Environment and Commands

- **Date:** 2026-11-16
- **Machine:** Linux 7.3.0-4-cachyos x86_64; AMD Ryzen 9 PRO 7940HS w/ Radeon 780M Graphics (16 logical CPUs)
- **Runtime:** Bun 1.4.4 (`38afee6c8`)
- **Host load average (`uptime`, 1 / 5 / 15 min):** `12.16, 9.51, 10.43` → `12.52, 9.67, 10.47`
- **Commands:**
  ```bash
  bun --conditions liveframe:source bench/host.bench.ts
  ```

---

## 2. Pipeline Measurements Against Task 1's Budgets (`bench/host.bench.ts`)

All timings are median CPU time (`process.cpuUsage()` user + system, median of 5 batches of 6 calls after warm-up) on the `agent-home` code package (`204,649` bytes total; `28,199` bytes `code`; `171,729` bytes `scenarios`; `4,721` bytes manifest and envelope):

| Metric (`bench/host.bench.ts`) | Task 1 Baseline (pre-Task 2, load ~16) | Post-Task 2 (Task 2 run, load ~10) | Post-Task 2 (Task 3 run, load ~12.3) | Task 1 Confirmed Budget | Status |
|---|---:|---:|---:|---:|---|
| `memoryStore.loadVerifiedMs` | 15.802 ms | 1.285 ms | **2.635 ms** | **≤ 5.0 ms** | Pass (47%–74% headroom) |
| `fileStore.loadVerifiedMs` | 17.525 ms | 0.810 ms | **1.728 ms** | **≤ 5.0 ms** | Pass (65%–84% headroom) |
| `split.storeReadMs` (`memoryStore`) | 2.913 ms | 0.858 ms | **1.232 ms** | **≤ 3.5 ms** | Pass (65%–75% headroom) |
| `split.fileStoreReadMs` (`fileStore`) | 1.444 ms | 0.423 ms | **0.837 ms** | **≤ 3.0 ms** | Pass (72%–86% headroom) |
| `split.verifyVerifiedMs` | 16.431 ms | 0.255 ms | **0.478 ms** | **≤ 2.0 ms** | Pass (76%–87% headroom) |
| `split.equalityMs` (`sameJson`) | 0.908 ms | 0.172 ms | **0.284 ms** | **≤ 1.5 ms** | Pass (81%–89% headroom) |
| `memoryStore.renderVerifiedMs` | 33.959 ms | 7.909 ms | **10.798 ms** | **≤ 20.0 ms** | Pass |
| `fileStore.renderVerifiedMs` | 32.607 ms | 6.840 ms | **12.787 ms** | **≤ 20.0 ms** | Pass |
| `memoryStore.skippedMs` | 20.091 ms | 2.930 ms | **3.770 ms** | **≤ 8.0 ms** | Pass |
| `fileStore.skippedMs` | 20.069 ms | 2.149 ms | **3.710 ms** | **≤ 8.0 ms** | Pass |

---

## 3. Isolated Scenario Cost vs Runtime-Only Payload

To isolate how much of `storeReadMs`, `fileStoreReadMs` and `equalityMs` comes from `pkg.scenarios` (`171,729` bytes, `83.9%` of the package) versus the runtime-only fields (`{ format, manifest, code, hash }`, `32,907` bytes, `16.1%`), both payloads were timed side by side (median of 9 batches × 20 calls after 10 warm-up calls):

| Operation | Full Package (`204,649` B) | Runtime-Only (`32,907` B) | Scenarios Share (`171,729` B) | Share of Operation |
|---|---:|---:|---:|---:|
| `memoryStore.getPackage` (`JSON.parse(JSON.stringify(pkg))`) | 0.951 ms | 0.139 ms | **0.813 ms** | 85.4% |
| `fileStore.getPackage` (`node:fs/promises` `readFile` + `JSON.parse`) | 0.538 ms | 0.141 ms | **0.398 ms** | 73.9% |
| `Bun.file(path).json()` (reference comparison on the `fileStore` path) | 0.376 ms | 0.100 ms | **0.276 ms** | 73.4% |
| `sameJson(cached, storedCopy)` deep equality walk | 0.187 ms | 0.005 ms | **0.182 ms** | 97.1% |
| **Total per-request `memoryStore` package read + equality** | **1.138 ms** | **0.144 ms** | **0.994 ms** | **87.3%** |
| **Total per-request `fileStore` package read + equality** | **0.725 ms** | **0.146 ms** | **0.579 ms** | **79.9%** |

Notes on `fileStore` (`src/store/fs/index.ts:47-60`):
- `fileStore` reads JSON records with `readFile(file, "utf8")` + `JSON.parse(source)`, which takes `0.538 ms` for the full 200 KiB package (`0.398 ms` attributable to scenarios).
- `Bun.file(file).json()` takes `0.376 ms` (`0.276 ms` attributable to scenarios), a `0.162 ms` difference. Because `fileStoreReadMs` (`0.837 ms` across placement, package and state) and `fileStore.loadVerifiedMs` (`1.728 ms`) are already well below their `≤ 3.0 ms` and `≤ 5.0 ms` budgets, `src/store/fs/index.ts` needs no change.

---

## 4. Options Considered and Rationale for Outcome

1. **Option A — Optional `Store.getPackageRuntime(id, version)` with an additive `runtime` digest:**
   - Adds an optional `Store` method returning `{ format, manifest, code/template, runtime }` and an optional `runtime` hash field on `WidgetPackage` so request-time loads can skip reading `scenarios`.
   - Not needed: saves at most `0.58 ms` (`fileStore`) to `0.99 ms` (`memoryStore`) per request while adding a second digest to `WidgetPackage`, a second store read method to `Store` and `storeSuite()`, and a split verification contract.
2. **Option B — `liveframe-package/2` with a Merkle / part-hash envelope (0.4.0):**
   - Replaces `packageHash` with a hash over part hashes (`manifest`, `body`, `scenarios`) so the runtime part verifies against the top-level package `hash` alone.
   - Not needed: changes every package hash vector (`docs/compatibility.md:139-140`), requires a `/2` format version bump in `0.4.0`, and solves a bottleneck that Task 2 already eliminated.
3. **Option C — No change (Chosen):**
   - Finding P1's `14.07 ms` cached `loadPlacement` in the 2026-11-15 review (`plans/evidence/033-review-findings.md:26`) was dominated by `verifyStoredPackage` re-running `validateWidgetPackageShape` (`2.72 ms`) and `packageHash` (`5.48–12.6 ms`) on every cache hit — not by reading or comparing `scenarios`.
   - With Task 2 in place, `verifyVerifiedMs` is `0.255–0.478 ms`, `equalityMs` is `0.172–0.284 ms`, `storeReadMs` is `0.858–1.232 ms`, `fileStoreReadMs` is `0.423–0.837 ms`, and `loadVerifiedMs` is `1.285–2.635 ms` (`memoryStore`) and `0.810–1.728 ms` (`fileStore`), all comfortably within Task 1's confirmed budgets.
   - Keeping the single self-contained `liveframe-package/1` record preserves Law 2 (every request-time load verifies or compares the complete package value-for-value against a verified package) and Roadmap §1 ("Simplest thing that holds" and "Budgets on realistic sizes": no format or interface split when the measurement is within budget).
