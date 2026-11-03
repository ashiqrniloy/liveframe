# Plan 024 Task 2: `<Surface>` node reuse with inline `fallback` (R12)

Base: `6886e4b` (plan start, 0.2.2 renderer). Head: this checkout with the `FallbackContext` / `DiagnosedContext` change.
Tool: `bun bench/ab.ts 6886e4b bench/streaming.bench.ts --runs 9 --metric … -- <flags>`, development React, agent-home (679 nodes, 50 rows), one row status changes per revision. Medians in ms; ratio is the median of the paired head/base ratios (below 1 is faster).
Host: loaded throughout (QEMU VM, see `024-baseline.md`), load average 12–17 with one spike to 30 during the second run. The pairing is what makes the ratios usable. Absolute figures here are not quiet-host figures.

## Results

| Case | Metric | Base | Head | Ratio |
|---|---|---:|---:|---:|
| Whole tree, stable fallback (9 runs) | validation + React | 9.20 | 9.30 | 1.012 |
| Patch, stable fallback (9 runs) | validation + React | 7.70 | 8.10 | 1.038 |
| Patch, stable fallback (15 runs, repeat) | validation + React | 7.50 | 7.60 | 1.000 |
| Patch, stable fallback (15 runs, repeat) | React work | 4.10 | 4.10 | 1.023 |
| Whole tree, **inline** fallback (9 runs) | validation + React | 121.0 | 8.40 | 0.068 |
| Whole tree, **inline** fallback | React work | 117.1 | 4.30 | 0.036 |
| Whole tree, **inline** fallback | wall around `flushSync` | 229.8 | 12.40 | 0.053 |
| Patch, **inline** fallback (9 runs) | validation + React | 118.0 | 7.70 | 0.065 |

Acceptance, read against these figures:

- Inline fallback is within 10% of the stable-fallback figure: head inline 8.40 ms (whole tree) against head stable 9.30 ms in the earlier run, and 7.70 against 8.10 for patches. The stable runs were taken at a different moment, so this comparison is unpaired; the 0.2.2 renderer, by contrast, took 121 ms with the same inline fallback, so the gap is large against any noise. This is the only comparison in the record that is not paired.
- Patch mode with a stable fallback does not regress: the first 9-run result of 1.038 sat close to the 1.05 limit on a loaded host, so it was repeated with 15 runs, which gave 1.000 (React work 1.023).
- Arrival validation is unchanged by the task, as expected (ratio 1.00–1.02).

## Render counts (the browser fixture's per-kind implementation render counters, which count the same renders a `<Profiler>` would)

- `inline_fallback_keeps_node_reuse`: with a parent that passes a new `fallback={<p>…</p>}` element on every arrival, an arrival whose content is unchanged renders stack 0, text 0, button 0. The same test fails on the 0.2.2 renderer, which re-rendered all nodes.
- `replacing_fallback_updates_failed_nodes`: a node that threw shows "Fallback A", then "Fallback B" after the prop changes, and no primitive re-renders.
- `same_diagnostics_content_new_array_keeps_reuse_and_changed_marks_only_the_named_nodes`: a new array with the same node ids renders 0 primitives, and moving the flag to another node moves `data-lf-error` while still rendering 0 primitives.

## Harness changes this task needed

- `bench/streaming.bench.ts --inline-fallback` (and `?inline-fallback` in `streaming-client.tsx`) passes a new fallback element on every render.
- Under `--json`, a lost Chromium trace mark skips only `layoutPaintMs` instead of aborting every figure. The 0.2.2 renderer's inline-fallback run (about 230 ms per revision) overflowed the trace buffer and lost the `lf-recorded-end` mark, so its first A/B attempt produced no metrics at all. Without `--json` the bench still throws as before.
