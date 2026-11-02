# Plan 022 Task 4 — compiled catalog reuse and the worker's host budget

## Machine and method

- AMD Ryzen 9 PRO 7940HS, 16 logical CPUs, Bun 1.4.4, Linux 7.3.0-4-cachyos; load average
  5.4/8.7/7.4 at the start and end of the run. The machine was shared, so single-digit-percent
  differences are below its noise floor; paired runs are reported for that reason.
- `bun --conditions liveframe:source bench/validator.bench.ts` (200 warm-ups, 1,000 samples per
  figure) for the compiled-schema cases and for the two new `compileValidator` cases.
- The reuse case compiles the proof catalog and capabilities once, then times 1,000 calls with the
  same two documents and a second manifest (`version` changed, so only manifest-level work is new).
- The cold case times 20 first compiles of catalogs the cache has never seen, after 5 more to warm
  the compile path itself.
- Baseline: the same bench cases re-run against `4489d72` (0.2.1) by stashing this task's changes,
  and `/tmp/cold5.ts`, which drives `compileValidator` with the same warm-up and sample shape.
  The script is a throwaway; its shape is the two new bench cases above.

## Results

| Measure | 0.2.1 | 0.2.2 (this task) |
|---|---:|---:|
| Second call, same catalog and capabilities, different manifest (median) | 0.73–1.00 (no reuse) | **0.118** |
| First compile of an unseen catalog (median, paired runs) | 0.755 / 0.951 | 0.980 / 1.025 |
| Proof-catalog compile, 24 kinds | 0.67–0.95 | 0.87–1.03 |

The reuse figure is the gate: 0.118 ms median against the 0.25 ms target, down from the 0.73 ms
per-call figure in `plans/requests/clay-adoption-requests.md:207`. The cold figure carries the two
key strings (~0.04 ms) plus the machine's drift: paired runs overlap (0.755 vs 0.980, then 0.951 vs
1.025), which is above the 5% target the plan set and inside the spread the shared machine shows
between consecutive runs of unchanged code (the 0.2.1 baseline alone spans 0.67–0.95 ms).

## Worker host budget (closes backlog P4)

`workerRunner` re-validates every tree on the host with `compiledValidator(…, pkg.hash)`, so a
repeated package re-validates without recompiling. Measured on the 679-node agent-home tree with
the cached validator:

| Measure | Value |
|---|---:|
| Host re-validation, median | 0.907 ms |
| Host re-validation, p95 | 2.256 ms |
| Worker render round trip (same machine, after the first) | 5.9 ms |

So host re-validation is about 15% of a worker render and stays inside the 100 ms default deadline;
`docs/packages.md` now states it as the runner's per-render budget. The 0.2.1 note in
`plans/backlog.md` (about 2 ms against 1.8 ms of render) no longer applies: the compile is out of
the per-render path and the remaining cost is the tree walk itself.

## Cache shape

- Catalog-level work (install validation, styles, structure, per-kind props/style checks, kinds'
  facts, offered-event schemas) is keyed by the text of the catalog and capabilities documents, in a
  least-recently-used list of 8. Eight is a plan deviation from the 64 the plan inherited from
  `src/runner-kit/cache.ts`: that cache is keyed by object identity in a `Map`, while this one
  compares content, so the bound is also the miss cost. Measured with a full cache of 64 distinct
  catalogs, a miss cost 0.99–1.01 ms against 0.81–0.82 ms with 8.
- The stored key is the document text, so a later mutation of the caller's object cannot make a
  stored key lie, and the value is parsed back only when a lookup's text matches, then compared with
  `sameJson` — that second check is what stops a document whose `undefined`- or `NaN`-valued keys
  `JSON.stringify` drops from hitting a validator compiled for different content.
- Every call returns a new `CompiledValidator`; manifest validation, intents, per-kind event checks,
  the dispatcher, the tree validator and the input schemas are rebuilt per call, and the validator
  keeps the same thrown `LiveframeFailure` for invalid documents.

## Follow-up (2026-11-03, release readiness review, Task 16)

The owner asked for the first-compile figure to be brought back within 5% of 0.2.1 before 0.2.2 ships.

- **Method.** One process loads the 0.2.1 `compileValidator` (a `v0.2.1` worktree) and the checkout's, and alternates them on
  every sample (3,000 each, 300 warm-ups, a fresh catalog id per call), so load drift hits both equally. Unpaired runs
  on this shared host (load 6–10) swung 0.94–1.46 ms for the same code and could not resolve 5%.
- **Where the time went.** Before: checkout/0.2.1 = 1.057–1.083. Cache-less, the restructuring itself cost +0.6%; the key
  (two `JSON.stringify` calls plus the entry lookup) cost the rest. A CPU profile of the cold path put `pointerAt` in
  `src/schema.ts` first (11.7%): the install check builds a JSON-pointer string per schema node even when no one asks for it.
- **Change.** `pointerAt` skips its two `replaceAll` calls when the key has no `~` or `/`, and `isObjectKeywordsValid`
  computes the `properties` pointer once per object instead of once per property. Output is identical. The per-kind event
  check is built straight from `definition.events` again instead of through an intermediate map.
- **Result.** Checkout/0.2.1 = 0.961–0.985 over nine interleaved runs: the first compile is 1.5–4% faster than 0.2.1. The
  5% criterion is met.
- **A defect found on the way, and fixed.** `validateCatalog` returns the caller's own object, so a cache entry read the
  documents of the call that created it. After that caller mutated its catalog, a later, equal catalog hit the entry and was
  rejected ("Catalog does not match"), which broke Task 4's "never stale" criterion. A hit now confirms the entry's documents
  still equal the key (`sameJson`) and otherwise evicts the entry and compiles fresh. Test:
  `mutating_the_compiled_catalog_never_stales_an_equal_catalog`. The hit path costs about 0.03 ms more: 0.15–0.19 ms median
  under load, against the 0.25 ms target (0.118 ms unloaded before the guard).
- `bun run check`: 1000 pass, 4 skip, 0 fail.
