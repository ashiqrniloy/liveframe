# Phase 7 Part U: Request-Time Performance

Depends on: plan [033](033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md) complete (the scope decision, the 0.3.0 baseline and `register-0.3.1.json`). Followed by plan [035](035-Phase-7-Part-V-Browser-Renderer-Cost-And-Resilience.md). Source: findings P1, P2, P3 and P6 of the 2026-11-15 review (table in plan 033).

## Objectives

- Measure a request-time render on a package of realistic size, and gate it.
- Make a verified-package cache hit cost a comparison, not a hash.
- Decide, from a measurement, whether scenarios may stay in request-time loads.
- Make canonical hashing cheap enough that `renderKey` costs less than the render it can skip.
- Stop composed components re-checking data the SDK already owns.
- Let the QuickJS runner's validator cache hit when a runtime is reused.

## Expected Outcome

- `bench/host.bench.ts` reports and budgets `renderPlacement` on the proof's agent-home code package (199 KB, of which 167 KB is scenarios), not only on the 8 KB template package.
- With `verified` supplied, `loadPlacement` on that package costs under the budget Task 1 sets; the runners re-hash nothing for a package the cache returned.
- `plans/evidence/034-scenarios-at-request-time.md` holds the measurement and either "no change" or an approved decision log.
- `renderKey` and `packageHash` produce the same values (every vector in `conformance/hash/` unchanged) in one pass.
- A composed component that receives the widget's own inputs adds no per-layer walk of them.
- `bench/runner.bench.ts` shows `reuse: "package"` rendering without a validator compile per render, or records that the compile was not the cost.

This plan implements the performance part of the review-fix work in roadmap Phase 7 under roadmap §1's rule "Budgets on realistic sizes": each optimisation follows a measurement, and a task whose measurement does not call for a change records "no change". Nothing here changes a format, a hash value or a public declaration except where a task says so and registers it. No version is bumped and nothing is published. Spec sections touched: §7.3 (packages), §7.4 (storage), §7.5 (runners), §7.7 (host pipeline), §8 (`renderKey`).

Baseline measured on 2026-11-15 at load average 12 on 16 cores (upper bounds; the ratios are the finding):

| Step, proof agent-home package | ms |
|---|---|
| The widget's own render (`docs/model.md` budget) | ~2 |
| `renderPlacement`, no `verified` cache | 39 |
| `renderPlacement`, `verified` cache | 18 |
| `renderPlacement`, skipped (same key) | 12.6 |
| `loadPlacement` alone, without / with cache | 15.0 / 14.1 |
| `verifyPackage` | 13 |
| `packageHash` (199 KB) | 5.5 |
| `renderKey` over 109 KB of data (synthetic 1,000-row widget; its 51-node page renders in 1.6 ms) | 3.7 |
| Each composed layer handed those 1,000 rows | +0.6 to 1.1 |

## Tasks

- [x] Task 1: Measure and budget the pipeline on a realistic package
  - Acceptance Criteria:
    - Functional:
      - `bench/host.bench.ts` gains a second subject: the agent-home code package from `src/__tests__/fixtures/widgets/drafts.ts`, stored in `memoryStore()` and in `fileStore()`, rendered through `inProcessRunner()`.
      - It reports, in CPU time, the split of one `renderPlacement`: store reads, verification, `bindSources` and fit, `renderKey`, the runner, host validation, the diff. It reports the same call with `verified`, and a skipped call.
      - `plans/evidence/034-baseline.md` records the numbers, the machine, the load and the command, and proposes one budget per row. The owner confirms the budgets; Tasks 2–6 use them.
    - Performance: this task sets the budgets; it adds no `budget()` call that fails on today's code.
    - Code Quality: reuse `bench/metrics.ts` and `bench/ab.ts`; no new harness.
    - Security: n/a — bench code only; nothing under `src/`.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/storage.md`.
      - `investigate-first` — the split comes before any change.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2+: `process.cpuUsage()` and `Bun.nanoseconds()` as `bench/host.bench.ts:86` uses them.
    - Documentation Reviewed:
      - `roadmap.md` §1 ("Budgets on realistic sizes"); `bench/host.bench.ts:1-13`, `:86-110`, `:193-197`; `plans/backlog.md` "Make a verified-package cache hit cheap" (measured on an 8 KB template package) and "Re-run the full benchmark suite on a quiet host"; `plans/evidence/032-bench-attempt-best.md`.
    - Options Considered:
      - Keep the template-only subject and scale its numbers — rejected: 167 of the code package's 199 KB are scenarios, which the template subject does not have in proportion.
    - Chosen Approach:
      - Add the subject, report the split, agree the budgets before changing code.
    - API Notes and Examples:
      ```bash
      bun --conditions liveframe:source bench/host.bench.ts
      ```
    - Files to Create/Edit:
      - `bench/host.bench.ts`: the code-package subject and the split.
      - `plans/evidence/034-baseline.md`: numbers and proposed budgets.
  - Test Cases to Write:
    - `bench_json_reports_the_code_package_split` (in `src/__tests__/bench-json.test.ts`): the bench's JSON line names every split row. Fails if a row is dropped.
  - Notes (executed 2026-11-16):
    - Added the `agent-home` code package subject (`drafts[0]`, `packageOptions`: 204,649 bytes total, 28,199 bytes code, 171,729 bytes scenarios) to `bench/host.bench.ts`, stored in both `memoryStore()` and `fileStore()` and rendered through `inProcessRunner()` (`runOptions: { timeoutMs: 5000 }` so host wall-clock load cannot trip the 100 ms default). Also added `--runs <n>` for fast smoke runs in `src/__tests__/bench-json.test.ts` and switched the timing loop to the median of 5 CPU-time batches so single-batch GC pauses do not skew `skipped - load`.
    - `bench/host.bench.ts` now emits a `{"subject":"agent-home",...}` JSON line and `--json` `metric(...)` keys covering `memoryStore` and `fileStore` (`renderUncachedMs`, `renderVerifiedMs`, `skippedMs`, `loadUncachedMs`, `loadVerifiedMs`) and the 10-row `split` (`storeReadMs`, `fileStoreReadMs`, `verifyUncachedMs`, `verifyVerifiedMs`, `equalityMs`, `bindAndFitMs`, `renderKeyMs`, `runnerMs`, `validateTreeMs`, `diffTreesMs`).
    - Added `bench_json_reports_the_code_package_split` in `src/__tests__/bench-json.test.ts` asserting every `memoryStore`, `fileStore`, and `split` row is present, positive, and matches the `--json` file.
    - Recorded the baseline and per-row budgets in `plans/evidence/034-baseline.md` (Linux 7.3.0-4-cachyos, AMD Ryzen 9 PRO 7940HS, 16 CPUs, Bun 1.4.4, load average 16.27 → 15.83), confirmed by the owner on 2026-11-16 (`"Confirmed"`): `memoryStore` `renderUncachedMs` 66.384 ms (budget ≤ 60 ms), `renderVerifiedMs` 33.959 ms (budget ≤ 20 ms), `skippedMs` 20.091 ms (budget ≤ 8 ms), `loadUncachedMs` 27.143 ms (budget ≤ 30 ms), `loadVerifiedMs` 15.802 ms (budget ≤ 5 ms); `fileStore` `renderUncachedMs` 47.243 ms (budget ≤ 60 ms), `renderVerifiedMs` 32.607 ms (budget ≤ 20 ms), `skippedMs` 20.069 ms (budget ≤ 8 ms), `loadUncachedMs` 29.085 ms (budget ≤ 30 ms), `loadVerifiedMs` 17.525 ms (budget ≤ 5 ms); `split`: `storeReadMs` 2.913 ms (≤ 3.5 ms), `fileStoreReadMs` 1.444 ms (≤ 3.0 ms), `verifyUncachedMs` 26.598 ms (≤ 25 ms), `verifyVerifiedMs` 16.431 ms (≤ 2.0 ms), `equalityMs` (`sameJson`) 0.908 ms (≤ 1.5 ms), `bindAndFitMs` 0.576 ms (≤ 1.5 ms), `renderKeyMs` 1.452 ms (≤ 1.0 ms), `runnerMs` 5.929 ms (≤ 5.0 ms), `validateTreeMs` 4.675 ms (≤ 5.0 ms), `diffTreesMs` 1.760 ms (≤ 2.5 ms).
    - Findings for later tasks: (1) `equalityMs` (`sameJson` over the 204.6 KB package) is 0.908 ms vs 16.431 ms for today's `verifyVerifiedMs` (18.1× cheaper), confirming Task 2's approach; (2) after Task 2, `storeReadMs` (2.913 ms memory / 1.444 ms file) + `equalityMs` (0.908 ms) totals ~3.8 ms / ~2.4 ms, inside the proposed ≤ 5.0 ms `loadVerifiedMs` budget for Task 3's evaluation. No spec change.

- [x] Task 2: Make a verified-package cache hit a comparison (P1)
  - Acceptance Criteria:
    - Functional:
      - With a `verifiedPackages()` cache, a stored record equal to the cached verified package for the same `(id, version)` and install returns the cached frozen object without hashing or shape-checking the record.
      - A record that differs in any value, at any depth, misses and takes the full `verifyPackage` path; a tampered package is still `hash-mismatch`.
      - The install part of the key costs a canonicalisation only the first time each `(catalog, capabilities)` pair of deeply frozen documents is seen; documents that are not deeply frozen are canonicalised on every call, as today.
      - Because a hit returns the same frozen object, `verifyPackageHash` (`src/preview/cache.ts:15-24`) does not re-hash it in the runners.
      - `docs/host.md` "Wire it once" says to supply `verified` in production and states the measured difference.
    - Performance: `loadPlacement` with a hit meets Task 1's budget for it on the code package; the template subject's hit is no slower than today.
    - Code Quality: the change is inside `src/store/verified.ts`; `verifiedPackages()`'s declaration does not change. Equality uses `sameJson` (`src/formats/json.ts:49-58`), which exists.
    - Security: law 2 and spec §7.4 ("reads remain untrusted until validated"). A hit proves the record equals content that was verified, value for value; a hash collision cannot produce a hit. The cache key still includes the install documents, so a package verified for one catalog is never served for another.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/storage.md`.
    - Library Documentation to Check Before Implementation:
      - none; read `src/store/verified.ts:7-53`, `src/store/load.ts:125-181`, `src/preview/cache.ts`.
    - Documentation Reviewed:
      - Spec §7.3 (immutable, hash-identified packages), §7.4; `docs/security.md:9` ("Only deeply frozen packages can reuse hash verification"); `plans/backlog.md` "Make a verified-package cache hit cheap"; plan 026 (the opt-in cache's design).
    - Options Considered:
      - Hash only the code and manifest — rejected here: it changes what `hash` covers, a format question; Task 3 decides it from a measurement.
      - Trust a store's object identity — rejected: `memoryStore()` and `fileStore()` return fresh copies, and a custom store's identity proves nothing about content.
      - Key the cache by `hash` as the record claims it, then compare — equivalent; keying by `(id, version)` avoids trusting a field of the record before the comparison.
    - Chosen Approach:
      - Look up by `(id, version, install)`, confirm by deep equality, fall back to full verification.
    - API Notes and Examples:
      ```ts
      const cached = cache.get(keyOf(doc.manifest?.id, doc.manifest?.version, installKey(install)));
      if (cached && sameJson(cached, doc)) return { ok: true, value: cached };
      ```
    - Files to Create/Edit:
      - `src/store/verified.ts`: lookup, equality, memoised install key.
      - `src/__tests__/store-load.test.ts`: the tests below.
      - `bench/host.bench.ts`: `budget()` for the hit.
      - `docs/host.md`, `docs/packages.md` (the cache section), `docs/security.md:9`.
      - `plans/backlog.md`: close "Make a verified-package cache hit cheap".
      - `CHANGELOG.md`.
  - Test Cases to Write:
    - `verified_hit_returns_the_cached_object_without_hashing`: a spy on `packageHash` records no call on the second load. Fails on today's `verifyStoredPackage` (`src/store/verified.ts:41-43`).
    - `record_differing_in_one_nested_value_misses`: a changed scenario value, a changed code character and an added key each take the full path and report what `verifyPackage` reports.
    - `tampered_code_with_the_original_hash_is_hash_mismatch`: the cache never turns a tampered record into a hit.
    - `same_package_under_another_install_misses`.
    - `runner_does_not_rehash_a_cached_package`: `inProcessRunner()` given the cached object calls `packageHash` zero times.
  - Notes (executed 2026-11-16):
    - Updated `verifyStoredPackage` (`src/store/verified.ts`) to key `verifiedPackages()` by `(manifest.id, manifest.version, installKey(install))`, memoising `installKey(install)` in a `WeakMap<object, WeakMap<object, string>>` once per deeply frozen `(catalog, capabilities)` pair while still canonicalising non-frozen installation documents on every call, and confirming cache hits with `sameJson(cached, doc)` instead of running `validateWidgetPackageShape` and `packageHash`. Any record that differs in any value or depth misses and takes the full `verifyPackage` path; a hit returns the cached deeply frozen `WidgetPackage` so `verifyPackageHash` (`src/preview/cache.ts`) reuses its hash verification by object identity.
    - Added all five test cases (`verified_hit_returns_the_cached_object_without_hashing`, `record_differing_in_one_nested_value_misses`, `tampered_code_with_the_original_hash_is_hash_mismatch`, `same_package_under_another_install_misses`, `runner_does_not_rehash_a_cached_package`) in `src/__tests__/store-load.test.ts`.
    - Added `budget()` gates in `bench/host.bench.ts` (`load <= 0.8`, `homeLoadVerified <= 5`, `homeFileLoadVerified <= 5`, `homeVerifyVerified <= 2`, `homeEquality <= 1.5`) with deeply frozen `install` and `homeInstall` documents. Measured (`bun --conditions liveframe:source bench/host.bench.ts`): on the 8 KB template package `loadMs` drops from 0.786 ms to 0.033 ms (`skippedMs` 0.841 ms → 0.130 ms); on the 204.6 KB `agent-home` code package `memoryStore.loadVerifiedMs` drops from 15.802 ms to 1.285 ms (vs 12.148 ms uncached, budget ≤ 5.0 ms), `fileStore.loadVerifiedMs` from 17.525 ms to 0.810 ms (vs 11.132 ms uncached, budget ≤ 5.0 ms), `split.verifyVerifiedMs` from 16.431 ms to 0.255 ms (budget ≤ 2.0 ms), `split.equalityMs` 0.172 ms (budget ≤ 1.5 ms), `memoryStore.renderVerifiedMs` 7.909 ms (vs 29.689 ms uncached), and `memoryStore.skippedMs` 2.930 ms (`fileStore`: 2.149 ms).
    - Updated `docs/host.md` ("Wire it once" and "What stays yours"), `docs/packages.md` ("Loading and state resets"), `docs/security.md` (§2–§3), `docs/spec.md` (§7.4 cached load description), `CHANGELOG.md` ("Unreleased"), and closed "Make a verified-package cache hit cheap" in `plans/backlog.md`.
    - Findings for later tasks: with `memoryStore.loadVerifiedMs` at 1.285 ms (`storeReadMs` 0.858 ms + `equalityMs` 0.172 ms = 1.030 ms) and `fileStore.loadVerifiedMs` at 0.810 ms (`fileStoreReadMs` 0.423 ms + `equalityMs` 0.172 ms = 0.595 ms), the remaining request-time cost of the 171.7 KB scenarios on a cache hit is well inside Task 1's ≤ 5.0 ms `loadVerifiedMs` budget, directly informing Task 3's evaluation.

- [x] Task 3: Decide whether scenarios may stay in request-time loads (P1)
  - Acceptance Criteria:
    - Functional:
      - After Task 2, measure what scenarios still cost per `renderPlacement` on the code package: the store's read and copy, and the equality walk. Record it in `plans/evidence/034-scenarios-at-request-time.md` against Task 1's budget.
      - If the cost is within budget: record "no change" and why; no code changes.
      - If it is not: write the options below into the evidence file with a measured prototype of the recommended one, and take a decision with `create-decision-log`. The decision names the release (a format or `Store` change is a 0.4.0 item unless it is an optional addition). Implementation is then a new task in this plan (optional addition) or in plan 037 (format change), added before continuing.
    - Performance: the outcome is a number against Task 1's budget, either way.
    - Code Quality: no speculative split of the package format; a change ships only with the decision.
    - Security: law 2. Whatever is loaded at request time is verified or equal to verified content; an option that loads a part of a package must bind that part to the package's identity.
  - Approach:
    - Skills to Use:
      - `investigate-first` — measure before proposing.
      - `create-decision-log` — only if the measurement calls for a change.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2+: `Bun.file().json()` cost on the `fileStore` path (`src/store/fs/index.ts`).
    - Documentation Reviewed:
      - Spec §7.3 (a package carries at least one scenario; the hash covers the package), §7.4 (`Store`); `src/formats/package.ts`; `src/pack/hash.ts:247-251`; `docs/compatibility.md:139-140` (a hash vector changes only with a format version).
    - Options Considered:
      - A. An optional `Store.getPackageRuntime(id, version)` that returns the manifest and code with a `runtime` digest the package records — additive if the digest is an optional package field.
      - B. A `liveframe-package/2` whose hash is a hash of part hashes, so a runtime part verifies alone — a format version; 0.4.0.
      - C. No change — if Task 2 brings the load within budget.
    - Chosen Approach:
      - Decide by the measurement; recommend C if within budget, else A.
    - API Notes and Examples:
      ```bash
      bun --conditions liveframe:source bench/host.bench.ts   # the "store read" and "equality" rows
      ```
    - Files to Create/Edit:
      - `plans/evidence/034-scenarios-at-request-time.md`: measurement, options, outcome.
      - `decision-logs/<date>-scenarios-at-request-time.md` (only if a change is decided).
  - Test Cases to Write:
    - none if "no change". If option A is decided, its task lists its own tests before it starts.
  - Notes (executed 2026-11-16):
    - Measured post-Task-2 `renderPlacement` and `loadPlacement` on the `agent-home` code package (`204,649` bytes total, `171,729` bytes scenarios = `83.9%`) in `bench/host.bench.ts` and isolated the scenario-only vs runtime-only (`32,907` bytes: `format`, `manifest`, `code`, `hash`) share in `plans/evidence/034-scenarios-at-request-time.md`.
    - Against Task 1's confirmed budgets (`plans/evidence/034-baseline.md`), `memoryStore.loadVerifiedMs` is `2.635 ms` (`1.285 ms` in Task 2's run; budget `≤ 5.0 ms`), `fileStore.loadVerifiedMs` is `1.728 ms` (`0.810 ms` in Task 2's run; budget `≤ 5.0 ms`), `split.storeReadMs` is `1.232 ms` (budget `≤ 3.5 ms`), `split.fileStoreReadMs` is `0.837 ms` (budget `≤ 3.0 ms`), `split.verifyVerifiedMs` is `0.478 ms` (budget `≤ 2.0 ms`), and `split.equalityMs` (`sameJson`) is `0.284 ms` (budget `≤ 1.5 ms`).
    - Isolating the 171.7 KB scenarios from the 32.9 KB runtime fields shows scenarios account for `0.813 ms` of `memoryStore.getPackage` (`0.951 ms` full vs `0.139 ms` runtime-only), `0.398 ms` of `fileStore.getPackage` (`0.538 ms` full vs `0.141 ms` runtime-only via `readFile` + `JSON.parse`; `Bun.file().json()` is `0.376 ms` full vs `0.100 ms` runtime-only), and `0.182 ms` of `sameJson` (`0.187 ms` full vs `0.005 ms` runtime-only) — a total per-request scenario cost of `0.994 ms` on `memoryStore()` and `0.579 ms` on `fileStore()`.
    - Outcome: **No change (Option C)** recorded in `plans/evidence/034-scenarios-at-request-time.md`. Every load metric sits well within Task 1's budgets (47%–89% headroom), so no `Store.getPackageRuntime` addition, `liveframe-package/2` format split, or decision log is needed. No code or spec change.

- [x] Task 4: Hash canonical JSON in one pass (P2)
  - Acceptance Criteria:
    - Functional:
      - `renderKey`, `packageHash` and the internal digest path write canonical JSON bytes straight into the SHA-256 block buffer, without building the canonical string and its UTF-8 copy first.
      - Every vector in `conformance/hash/` and every assertion in `src/__tests__/hash-vectors.test.ts` and `pack-hash.test.ts` is unchanged. `canonicalJson()` itself still returns the same text.
      - A value JSON cannot represent still throws the `TypeError` callers catch (`src/store/verified.ts:44-46`, `src/pack/pack.ts:30-33`).
    - Performance: at least 2× on `renderKey` over the 109 KB input and on `packageHash` of the code package, measured with `bench/ab.ts` (interleaved) and gated in `bench/hash.bench.ts`. If 2× is not reached, keep the fastest correct version, record the number, and leave the backlog entry open with it.
    - Code Quality: one streaming writer shared by `renderKey` and `packageHash`; no second canonicaliser with its own rules. No `crypto` import: the root stays host-API-free.
    - Security: law 2 depends on `hash` meaning the same bytes everywhere. The differential test below is the guard.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/storage.md`.
    - Library Documentation to Check Before Implementation:
      - none (no third-party code); read `src/pack/hash.ts:55-251` and FIPS 180-4 §6.2 for the block function.
    - Documentation Reviewed:
      - Spec §7.3 (the hash), §8 (`renderKey`); `plans/backlog.md` "Reach 2× on the pure-JS SHA-256 only if hashing shows up in a profile" (this review is that profile) and "Cut the validity cost inside `walkJson`"; plan 024 Task 5 notes (what was tried).
    - Options Considered:
      - `crypto.subtle.digest` — rejected: asynchronous, and a host API in a host-API-free module.
      - A non-cryptographic key for `renderKey` — rejected: `renderKey` is published with vectors; changing its value is a format-version change (`docs/compatibility.md:140`).
      - An opt-out argument that skips the key — rejected unless this task misses: it adds surface for a cost the hash work may remove.
    - Chosen Approach:
      - Stream canonical bytes into the block function; keep the string-returning `canonicalJson` for its callers.
    - API Notes and Examples:
      ```ts
      // internal: digest(value) === sha256(utf8(canonicalJson(value))) for every JSON value
      ```
    - Files to Create/Edit:
      - `src/pack/hash.ts`: the streaming digest; `renderKey` and `packageHash` use it.
      - `src/__tests__/pack-hash.test.ts`: the differential test.
      - `bench/hash.bench.ts`: the 2× gate and the absolute numbers.
      - `plans/backlog.md`: close or update the SHA-256 entry with the result.
  - Test Cases to Write:
    - `streamed_digest_equals_the_canonical_text_digest`: over every hash vector, the corpus documents and generated values (deep nesting, astral characters, lone surrogates, `-0`, large integers, empty containers), both paths give the same digest. Fails on any canonicalisation difference.
    - `non_json_value_still_throws_type_error`: a function, a `BigInt`, a cycle and `NaN` at depth.
    - `hash_vectors_unchanged` (existing) stays green.
  - Notes (executed 2026-11-16):
    - Implemented single-pass streaming `digest(value)` in `src/pack/hash.ts` and wired both `renderKey` and `packageHash` through it while keeping `canonicalJson(value)` returning the canonical string for its callers. `digest(value)` walks the value iteratively in forward order using an index stack (with linear ancestor checks for depth < 32 and a lazy `Set<object>` at depth ≥ 32) and writes RFC 8785 canonical JSON UTF-8 bytes directly into a shared 8 KiB block buffer (`buf`) that flushes 64-byte blocks into `compress(buf, offset)`, avoiding allocating the canonical string, per-string `JSON.stringify` copies, per-string `loneSurrogate` regex scans, and the `utf8()` buffer copy.
    - Added `streamed_digest_equals_the_canonical_text_digest` (checking `digest`, `renderKey`, `packageHash`, and `canonicalJson` against `sha256(utf8(canonicalJson(...)))` and an independent `JSON.stringify` reference across all `conformance/hash/*.json` vectors, all `conformance/corpus/**/*.json` documents, edge cases including 80-deep nesting, astral characters across 600-unit chunk boundaries, lone surrogates, `-0`, large integers, empty containers, and 200 seeded random JSON trees) and `non_json_value_still_throws_type_error` in `src/__tests__/pack-hash.test.ts`.
    - Added `packageHash.agentHome` (`199 KiB`) and `renderKey.109KiB` (`1,000` rows, `110,984 B`) benchmarks, paired 1-pass vs 2-pass speedup measurements, and `budget()` gates (`>= 2×` speedup and `<= 5 ms` / `<= 3 ms` CPU) to `bench/hash.bench.ts`.
    - Measured across 9 interleaved runs (`bun bench/ab.ts HEAD bench/hash.bench.ts --runs 9`, load 9.43 → 11.07): `packageHash.agentHome.cpuMs` drops from `5.505 ms` to `2.369 ms` (paired ratio `0.373` = **2.68× speedup**; wall `4.748 ms` → `2.492 ms`; in-process paired speedup **2.56×** vs 2-pass), `renderKey.109KiB.cpuMs` drops from `3.435 ms` to `1.121 ms` (paired ratio `0.318` = **3.14× speedup**; wall `2.990 ms` → `0.997 ms`, ratio `0.351` = **2.85×**; in-process paired speedup **2.61×** vs 2-pass), `packageHash.512KiB.ms` drops from `8.514 ms` to `5.051 ms` (ratio `0.612`), and `verifyPackage.agentHome.cpuMs` drops from `17.67 ms` to `14.46 ms` (ratio `0.825`). On `bench/host.bench.ts`, `agent-home` `split.renderKeyMs` is `0.297 ms` (well inside Task 1's `≤ 1.0 ms` budget) and `memoryStore.skippedMs` is `2.834 ms` (`fileStore`: `2.424 ms`, inside Task 1's `≤ 8.0 ms` budget).
    - Closed "Reach 2× on the pure-JS SHA-256 only if hashing shows up in a profile" in `plans/backlog.md`. No spec or public API surface change.

- [x] Task 5: Skip re-checking data the SDK already owns in composed props (P3)
  - Acceptance Criteria:
    - Functional:
      - A value the render pass copied and froze in `checkInputs` (and every container inside it) is known JSON. `isJson` returns at once for it, wherever a composed component receives it.
      - A new object a widget builds around owned values is still walked at its own levels, and the walk stops at each owned child. A function, promise or non-finite number in a widget-built value is still rejected with its own kind (`function-prop`, `async-render`, `invalid-prop`) at the same pointer.
      - Inputs reused through `inputCopies` (`src/sdk/render.ts:609-613`) are known on later renders too.
    - Performance: on the review's subject (a 51-node page fed 1,000 rows through six composed layers) `render()` is within 10% of the direct render; `bench/render.bench.ts` gains that row with a `budget()`. The 3 µs-per-node budget on the proof trees holds.
    - Code Quality: one `WeakSet` filled where the copy is frozen (`src/sdk/render.ts:582-585`); no new parameter on `isJson`.
    - Security: law 2. Only values the SDK itself created and deep-froze are trusted; a caller's frozen object is not (it may hold a getter or a non-JSON value the copy step would have rejected).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/sdk.md`.
    - Library Documentation to Check Before Implementation:
      - none; read `src/sdk/render.ts:37-39`, `:516-624`, `:828-871`, `:1187-1215`.
    - Documentation Reviewed:
      - Spec §7.1 (a composed component's props are data), §7.2; `plans/backlog.md` "Reject nested non-JSON composed props and improve SDK diagnostics" (the rule this must keep); `src/__tests__/sdk-inputs.test.tsx`.
    - Options Considered:
      - Check composed props only one level deep — rejected: it reopens the gap the backlog item closed (a callback nested in a prop a component discards).
      - Reuse `deepFrozen` — rejected: it marks the caller's originals, and its meaning (safe to cache the copy) is not "created by the SDK".
    - Chosen Approach:
      - Remember the SDK's own copies; short-circuit on them.
    - API Notes and Examples:
      ```ts
      const owned = new WeakSet<object>(); // filled as each input copy is frozen
      // isJson: if (typeof value === "object" && value !== null && owned.has(value)) return true;
      ```
    - Files to Create/Edit:
      - `src/sdk/render.ts`: the set, the fill, the short-circuit.
      - `src/__tests__/sdk-inputs.test.tsx`: the tests below.
      - `bench/render.bench.ts`: the composed-layers row and budget.
  - Test Cases to Write:
    - `composed_props_holding_owned_inputs_are_not_rewalked`: a counting proxy cannot be used on frozen copies, so assert through the bench row's budget and through a test that a six-layer pass-through renders the same tree as the direct widget.
    - `function_nested_in_a_widget_built_prop_is_still_function_prop`: `{ rows: data.rows, onPick: () => {} }` passed to a composed component fails at `/…/onPick`.
    - `callers_frozen_object_is_not_trusted`: a caller-frozen input holding a function is rejected by `checkInputs` as today.
  - Notes (executed 2026-11-16):
    - Added a module-private `ownedCopies = new WeakSet<object>()` in `src/sdk/render.ts` (`NO_ACTIONS` registered at init; every valid copied container added inside `isJsonContainer` right as `Object.freeze(copy)` runs, guarded by `if (valid && copy !== null)`). `isJson` returns `true` immediately when `copy === undefined && typeof value === "object" && value !== null && ownedCopies.has(value)`, so composed components skip re-walking SDK-owned inputs (both freshly copied and reused via `inputCopies`) without changing `isJson`'s signature or trusting caller-frozen objects, while widget-built wrapper objects continue to be walked at their own levels and stop at each owned child.
    - Added `composed_props_holding_owned_inputs_are_not_rewalked`, `function_nested_in_a_widget_built_prop_is_still_function_prop`, and `callers_frozen_object_is_not_trusted` in `src/__tests__/sdk-inputs.test.tsx`.
    - Added the `composed-6-layers` row (51-node page fed 1,000 rows directly vs through six composed layers) with paired CPU-time measurement and a `budget(composedRatio <= 1.1)` gate to `bench/render.bench.ts`.
    - Measured (`bun bench/ab.ts HEAD bench/render.bench.ts --runs 3`, load 23.67 → 14.41): `composed-6-layers.composedMs` drops from `2.479 ms` to `0.07636 ms` (paired ratio `0.054` = **18.5× faster**), `composed-6-layers.ratio` drops from `18.14×` to `1.015×` (paired ratio `0.056`, vs `directMs` `0.07458 ms`), and `agent-home.renderUsPerNode` drops from `4.752` to `4.686` (paired ratio `0.835`). Standalone `bench/render.bench.ts` (load 12.03 → 11.79) passed the `composed-6-layers` gate (`0.0768 ms` direct vs `0.0827 ms` 6 layers, `1.077× <= 1.100×`), while five pre-existing wall-clock `<= 3 µs/node` checks (`agent-home`, `core-queue.{small,medium,full}`, `agent-home-elements`) exceeded 3 µs/node under host load as they did on `HEAD`.
    - Ran `build`, `gen:check`, `typecheck`, `lint`, `format:check`, and full `bun run test` (1,803 pass, 4 pre-existing skips, 0 fail across 162 files). No spec or public API surface change.

- [x] Task 6: Keep the QuickJS runner's configuration stable so its validator cache hits (P6)
  - Acceptance Criteria:
    - Functional:
      - First measure inside QuickJS: the share of a `reuse: "package"` render spent in `compileValidator`, recorded in `plans/evidence/034-quickjs-validator.md`. If it is under 20% of the render on both bench subjects, record "no change" and stop.
      - Otherwise: the host sends the catalog and capabilities as their own string; the sandbox entry parses that string only when it differs from the last one it saw, so the kit's identity-keyed cache (`src/runner-kit/cache.ts:8-41`) hits on every later render in a kept runtime.
      - `reuse: "none"` behaves exactly as today: a new runtime has no memory of a previous configuration.
      - The tree returned is byte-identical to today's for every `conformance/runner/` fixture.
    - Performance: `bench/runner.bench.ts` `quickjsPackage` medians drop by the measured compile share; its budgets (`:125-140`) are tightened to the new medians plus the bench's usual headroom.
    - Code Quality: the change is inside `packages/runner-quickjs/src/` (`index.ts`, `protocol.ts`, `runtime.ts`); `runner-kit` is not changed and gains no content-keyed cache.
    - Security: law 1 and the runner's isolation rules (decision `2026-11-08-2310`). The sandbox still receives only strings; nothing of the host is exposed. A kept runtime already holds module state between renders, so keeping a parsed configuration adds no channel between packages: `kept` is keyed by package hash (`runtime.ts:127-146`).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/preview.md`.
      - `find-docs` — `quickjs-emscripten-core` handle and string APIs.
    - Library Documentation to Check Before Implementation:
      - `quickjs-emscripten-core` at the version in `bun.lock`: `context.newString`, `callFunction` with two arguments, handle disposal rules.
    - Documentation Reviewed:
      - Spec §7.5; `decision-logs/2026-11-08-2310-isolated-runner-starter-and-workspace.md`; `packages/runner-quickjs/src/index.ts:158-201`, `runtime.ts:33-38`, `:111-125`; `src/preview/worker/entry.ts:8-11` (the worker runner keeps its configuration stable for the same reason); the 2026-11-15 measurement (0.47 ms per compile under JSC's JIT for the 21 KB proof catalog).
    - Options Considered:
      - Key the kit's cache by content — rejected: it puts a canonicalisation on every render of every runner to fix one runner's transport.
      - Send a configuration id and let the child keep a table — rejected: the child would hold state across packages; the last-text comparison holds one value per runtime.
    - Chosen Approach:
      - Measure; then a separate configuration string compared by text in the entry.
    - API Notes and Examples:
      ```js
      // entry: let lastConfig, parsed;
      globalThis.__render = (config, text) => {
        if (config !== lastConfig) { parsed = JSON.parse(config); lastConfig = config; }
        const request = JSON.parse(text);
        return JSON.stringify(renderModule(widget, request.inputs, { ...parsed, ...request.options }));
      };
      ```
    - Files to Create/Edit:
      - `plans/evidence/034-quickjs-validator.md`: the measurement and outcome.
      - `packages/runner-quickjs/src/index.ts`, `protocol.ts`, `runtime.ts`: the configuration string (only if measured).
      - `packages/runner-quickjs/src/__tests__/engine.test.ts`, `runner.test.ts`: the tests below.
      - `bench/runner.bench.ts`: tightened budgets.
      - `packages/runner-quickjs/README.md`: what `reuse: "package"` keeps.
  - Test Cases to Write:
    - `kept_runtime_compiles_the_validator_once`: two renders of one package under `reuse: "package"`; the kit's `cachedValidatorCount` probe (or a compile counter exposed to the test entry) reads one. Fails today.
    - `changed_capabilities_recompile_in_a_kept_runtime`: a second render with a different capabilities document validates against the new one.
    - `reuse_none_is_unchanged`: the runner suite's fixtures give the same trees.
  - Notes (executed 2026-11-16):
    - Measured `compileValidator` inside a kept `QuickJSRuntime` / `QuickJSContext` (`plans/evidence/034-quickjs-validator.md`, CPU time via `process.cpuUsage()`, median of 5 batches): on `smallest` (1 text node), `compileValidator` accounted for `11.385 ms` of `13.018 ms` (**87.5%**, and **95.7%** / `12.454 ms` including `JSON.parse(config)`, dropping the in-VM render to `0.565 ms`); on `agent-home` (679 nodes), `compileValidator` accounted for `24.514 ms` of `163.822 ms` (**15.0%**, and **17.5%** / `28.670 ms` including `JSON.parse(config)`, dropping the in-VM render to `135.153 ms`). Because `smallest` exceeds the 20% threshold, implemented the separate configuration string.
    - Updated `packages/runner-quickjs/src/protocol.ts` (`RenderRequest.config`), `packages/runner-quickjs/src/runtime.ts` (`Job.config`, two-argument `__render(config, text)` parsing `config` only when `config !== lastConfig` and disposing the `config` handle), and `packages/runner-quickjs/src/index.ts` (sending `{ catalog, capabilities }` in `config` separately from `request`), leaving `runner-kit` unchanged. Updated `packages/runner-quickjs/README.md` to document what `reuse: "package"` keeps.
    - Added `kept_runtime_compiles_the_validator_once` in `packages/runner-quickjs/src/__tests__/engine.test.ts` and `changed_capabilities_recompile_in_a_kept_runtime` and `reuse_none_is_unchanged` in `packages/runner-quickjs/src/__tests__/runner.test.ts`.
    - Tightened `bench/runner.bench.ts` `quickjsPackage` budgets (`agent-home` `<= 60 ms` → `<= 50 ms`; `smallest` `<= 8 ms` → `<= 4 ms`); `bun --conditions liveframe:source bench/runner.bench.ts` (load average `9.99, 13.16, 16.01`) passed every budget (`quickjs package agent-home` `48.366 ms`, `quickjs package smallest` `1.311 ms`, `quickjs none` `93.441 ms` / `39.153 ms`, `cold start` `20.4 ms`, `recovery` `271.2 ms`, `inProcessOverhead` `0.0386 ms`).
    - Ran `timeout 1200 bun run check` (`build`, `gen:check`, `typecheck`, `lint`, `format:check`, and full `bun run test`: `1,806 pass`, `4` pre-existing skips, `0 fail` across `162` files). No spec or public API surface change.

- [x] Task 6a: Execute owner-approved impact findings F1–F4
  - Acceptance Criteria:
    - Functional: `docs/compatibility.md:147`, `docs/adopters-0.3.md:58`, and `docs/migration-0.3.md:159` accurately note `0.3.1` `sameJson` verification reuse on `verifiedPackages()` hits (F1); `docs/packages.md:450` and `CHANGELOG.md` `## Unreleased` cover Tasks 4–6 (F2); `.agents/skills/liveframe-execution/references/sdk.md:26` and Verification line 330 below are updated (F3); `quickjs_disposes_every_handle` (`packages/runner-quickjs/src/__tests__/engine.test.ts:110`) carries a `20000 ms` test timeout (F4).
    - Performance: no regression; test timeout only bounds test execution under load.
    - Code Quality: documentation, plan/skill text, and one test timeout; no production code changes.
    - Security: unchanged.
  - Notes (executed 2026-11-17):
    - Executed F1 (`docs/compatibility.md:147`, `docs/adopters-0.3.md:58`, `docs/migration-0.3.md:157-163`), F2 (`docs/packages.md:450`, `CHANGELOG.md`), F3 (`.agents/skills/liveframe-execution/references/sdk.md:26`, Verification command flag order), and F4 (`packages/runner-quickjs/src/__tests__/engine.test.ts:110`).

- [x] Task 7: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: `plans/evidence/034-impact-analysis.md` records each of the twelve impact areas, or `None — <reason>`. Findings go to the owner in one table with a recommended disposition; `execute` findings become tasks above this one, `backlog` findings go to `plans/backlog.md` and Further Actions.
    - Performance: the sweep restates Task 1's table with the after numbers, on the same machine and command.
    - Code Quality: no code changes unless a finding is disposed `execute`.
    - Security: the sweep states why a cache hit, a streamed digest and a kept configuration each keep law 2.
  - Approach:
    - Skills to Use:
      - `create-plan` — "Final task: impact analysis".
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `references/liveframe.md` §5; `plans/evidence/034-baseline.md`.
    - Options Considered:
      - Skip the after-table — rejected: the plan's claim is the difference.
    - Chosen Approach:
      - One sweep, with the before and after table.
    - API Notes and Examples:
      ```bash
      bun run check && bun run bench
      ```
    - Files to Create/Edit:
      - `plans/evidence/034-impact-analysis.md`; `docs/model.md` ("Performance: where the time goes" gains the request-time rows); `plans/backlog.md`; `roadmap.md` §3; this plan's Compromises Made and Further Actions.
  - Test Cases to Write:
    - none new.
  - Notes (executed 2026-11-17):
    - Wrote `plans/evidence/034-impact-analysis.md` sweeping all twelve impact areas in `.agents/skills/create-plan/references/liveframe.md` §5, restating Task 1's 20-row `bench/host.bench.ts` table with post-Task-6 CPU measurements (`memoryStore.loadVerifiedMs` `15.802 ms → 4.507 ms`, `fileStore.loadVerifiedMs` `17.525 ms → 2.392 ms`, `memoryStore.renderVerifiedMs` `33.959 ms → 14.013 ms`, `memoryStore.skippedMs` `20.091 ms → 4.607 ms`, `split.renderKeyMs` `1.452 ms → 0.509 ms`, `split.runnerMs` `5.929 ms → 4.453 ms`, every row within Task 1's confirmed budgets), explaining how `verifiedPackages()` cache hits (`sameJson`), single-pass streaming `digest()`, `ownedCopies`, and QuickJS kept configuration each preserve Law 2, and presenting Findings `F1`–`F6` to the owner.
    - Owner selected `"(Recommended) Confirm all: execute F1, F2, F3, F4; backlog F5 (P3), F6 (P4)"`. Executed F1–F4 in Task 6a above this task; added F5 (`P3`) and F6 (`P4`) to `plans/backlog.md` and `## Further Actions`; updated `docs/model.md` ("Performance: where the time goes" request-time table) and `roadmap.md` §3.
    - Verification: `bun run check` passed (`build`, `gen:check`, `typecheck`, `lint`, `format:check`, and `1,806 pass, 4 skip, 0 fail` across `162` files); `bun test --conditions liveframe:source` on the Plan 034 targeted + docs suites passed (`94 pass, 0 fail` across `11` files); `bun --conditions liveframe:source bench/host.bench.ts` and `bench/hash.bench.ts` passed every gate; `bench/render.bench.ts` passed `composed-6-layers` (`0.987× <= 1.100×`); `bun run release:gate` passed (`15/15`, `2/2`, `2/2`).

## Verification (whole plan)

- `bun run check`
- `bun --conditions liveframe:source bench/host.bench.ts`
- `bun --conditions liveframe:source bench/hash.bench.ts`
- `bun --conditions liveframe:source bench/render.bench.ts`
- `bun --conditions liveframe:source bench/runner.bench.ts`
- `bun test --conditions liveframe:source src/__tests__/hash-vectors.test.ts src/__tests__/pack-hash.test.ts src/__tests__/store-load.test.ts src/__tests__/sdk-inputs.test.tsx packages/runner-quickjs`
- `bun run release:gate`

## Compromises Made

- **Scenarios stay inside `liveframe-package/1` request-time loads (Task 3, Option C).** Measuring post-Task-2 `loadPlacement` on `agent-home` (`2.635 ms` `memoryStore`, `1.728 ms` `fileStore`, of which scenarios are `0.994 ms` / `0.579 ms`) puts loads well within Task 1's `≤ 5.0 ms` budget, so no `Store.getPackageRuntime` method or `liveframe-package/2` split was added.
- **Only 5 of Task 1's 20 confirmed `host.bench.ts` budgets have `budget()` gates today (Task 7, F5).** `bench/host.bench.ts` enforces `budget()` on `template load`, `homeLoadVerified`, `homeFileLoadVerified`, `homeVerifyVerified`, and `homeEquality`; the remaining rows pass and are emitted as metrics, while `hash.bench.ts`, `render.bench.ts`, and `runner.bench.ts` gate their component metrics directly.
- **Pre-existing wall-clock gates in `render.bench.ts` and `runner.bench.ts` remain load-sensitive on a contended dev host (Tasks 5–7).** Under concurrent host load (`17.0–18.3`), CPU-time gates in `host.bench.ts`, `hash.bench.ts`, and `render.bench.ts` (`composed-6-layers`: `0.987× <= 1.100×`) passed, while wall-clock `<= 3 µs/node` checks (`render.bench.ts`) and `quickjs none agent-home <= 110 ms` (`runner.bench.ts`) exceeded their quiet-host wall thresholds; the quiet-host benchmark run stays in `plans/backlog.md`.

## Further Actions

All are in `plans/backlog.md` with this plan as their source:

- **P3 — Gate the remaining request-time pipeline budgets in `bench/host.bench.ts` (F5).** Add `budget()` gates for the remaining `memoryStore`, `fileStore`, and `split` CPU metrics confirmed in `plans/evidence/034-baseline.md` alongside the quiet-host benchmark verification.
- **P4 — Review `workerRunner()` default `100 ms` timeout for cold-JIT MCP renders under load (F6).** Three `src/__tests__/cli-mcp.test.ts` tests tripped `workerRunner()`'s default `100 ms` render timeout on the first `agent-home` render inside a fresh worker under host load `~16`, while passing in `620–730 ms` standalone; evaluate raising the default MCP worker timeout or test fixture configuration.
