# Streaming patches: LF-17 transport measurement (CL-15)

- Generated: 2026-10-30T21:01:35.247Z
- Machine: linux 7.3.0-4-cachyos; AMD Ryzen 9 PRO 7940HS w/ Radeon 780M Graphics; 16 logical CPUs
- Bun: 1.4.4; Playwright Chromium: 156.0.8078.4
- Command: `bun --conditions liveframe:source bench/streaming.bench.ts --patches`
- Subject: agent-home, 679 nodes, 50 rows; 100 revisions at a 10/s target; one row's status changes per revision, patches sent after a separately mounted revision-0 whole tree.
- Load average at start: 3.04, 3.5, 7.18
- React: 19.3.1, development; Playwright: 1.64.1; Chromium headless.
- Bootstrap is outside the 100 timed updates and byte summaries; updates are revisions 1–100. The original revision generator is unchanged (each row status overrides the ready fixture for that revision).
- Host diff timing excludes rendering, serialization and round-trip assertions. Every patch round-trips exactly; browser final-tree equality and every arrival validation are asserted.
- The historical LF-17 metric calls Profiler actualDuration minus validation ‘commit’; React documents actualDuration as render work, not DOM commit or paint. That metric is retained unchanged; flushSync wall and parse + apply + flushSync end-to-end spans are also reported, excluding network, decompression and pacing.
- Bootstrap mount is excluded in patch mode; LF-17 whole-tree mode still includes mount as its first sample. Both use the development build and the same 100 ms pacing.
- Timings are browser-side, one sample per revision; Chromium runs React's development build, so Profiler overhead is included; bootstrap mount is excluded.
- Changed-value bytes sum changed leaf values only and assume no patch format.
- Patch thresholds fixed before measuring: gzipped patch update above 1024 bytes, or arrival validation plus React commit above 8 ms.

## Summary

| Measure | median | p95 | max |
|---|---:|---:|---:|
| Patch JSON bytes | 310 | 313 | 314 |
| Gzip bytes | 228 | 229 | 229 |
| Changed-value bytes (patch floor, revisions 1–100) | 10 | 11 | 12 |
| Host diffTrees ms | 0.746 | 1.395 | 5.806 |
| Browser applyPatch ms | 0.400 | 0.900 | 1.700 |
| Browser end-to-end ms (parse + apply + flushSync) | 4.200 | 8.200 | 43.600 |
| JSON parse ms | 0.000 | 0.100 | 0.100 |
| Arrival validation ms | 1.400 | 2.900 | 32.600 |
| React commit ms (Profiler, net of validation) | 1.300 | 3.000 | 10.000 |
| Arrival validation + React commit ms | 2.700 | 5.500 | 35.600 |
| Wall time around flushSync ms | 3.700 | 7.700 | 42.900 |

Achieved update rate: 9.90/s over 10000 ms.

Verdict: gzip stays within 1024 bytes; arrival validation plus commit stays within 8 ms.

Task 12: implemented; both medians now pass. Commit-only median: 1.300 ms against 8 ms.

## Per revision

| # | JSON bytes | gzip bytes | changed bytes | parse ms | arrival validation ms | React commit ms | validation + commit ms | diff ms | apply ms | end-to-end ms |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 307 | 223 | 7 | 0.000 | 2.200 | 1.700 | 3.900 | 4.182 | 1.000 | 6.700 |
| 2 | 310 | 223 | 10 | 0.000 | 1.800 | 1.200 | 3.000 | 1.369 | 0.300 | 4.500 |
| 3 | 307 | 224 | 7 | 0.000 | 1.900 | 1.300 | 3.200 | 1.232 | 0.400 | 5.100 |
| 4 | 310 | 224 | 10 | 0.000 | 1.300 | 1.300 | 2.600 | 1.240 | 0.400 | 3.900 |
| 5 | 307 | 225 | 7 | 0.000 | 1.400 | 1.300 | 2.700 | 0.992 | 0.300 | 3.900 |
| 6 | 310 | 225 | 10 | 0.000 | 1.800 | 2.100 | 3.900 | 0.966 | 0.800 | 6.200 |
| 7 | 307 | 225 | 7 | 0.000 | 1.400 | 1.300 | 2.700 | 1.071 | 0.400 | 4.200 |
| 8 | 310 | 225 | 10 | 0.000 | 1.400 | 1.400 | 2.800 | 0.952 | 0.500 | 4.100 |
| 9 | 307 | 224 | 7 | 0.000 | 1.500 | 1.300 | 2.800 | 5.806 | 0.400 | 4.300 |
| 10 | 311 | 225 | 11 | 0.000 | 1.800 | 1.500 | 3.300 | 1.048 | 0.700 | 5.000 |
| 11 | 310 | 226 | 8 | 0.100 | 1.500 | 1.400 | 2.900 | 0.976 | 0.400 | 4.300 |
| 12 | 313 | 225 | 11 | 0.000 | 1.400 | 1.300 | 2.700 | 0.810 | 0.400 | 3.900 |
| 13 | 310 | 226 | 8 | 0.000 | 1.500 | 1.600 | 3.100 | 0.730 | 0.400 | 4.200 |
| 14 | 313 | 227 | 11 | 0.000 | 1.400 | 1.300 | 2.700 | 0.869 | 0.300 | 4.000 |
| 15 | 310 | 227 | 8 | 0.000 | 1.100 | 1.300 | 2.400 | 0.796 | 0.400 | 3.600 |
| 16 | 313 | 228 | 11 | 0.000 | 1.700 | 1.900 | 3.600 | 0.760 | 0.700 | 6.000 |
| 17 | 310 | 228 | 8 | 0.100 | 1.100 | 1.200 | 2.300 | 0.619 | 0.200 | 3.400 |
| 18 | 313 | 227 | 11 | 0.100 | 1.200 | 1.100 | 2.300 | 0.641 | 0.300 | 3.500 |
| 19 | 310 | 227 | 8 | 0.000 | 1.100 | 1.200 | 2.300 | 0.643 | 0.300 | 3.400 |
| 20 | 313 | 227 | 11 | 0.000 | 1.200 | 0.900 | 2.100 | 0.764 | 0.300 | 3.200 |
| 21 | 310 | 226 | 8 | 0.000 | 1.100 | 1.100 | 2.200 | 0.706 | 0.300 | 3.400 |
| 22 | 313 | 225 | 11 | 0.000 | 1.500 | 1.200 | 2.700 | 1.503 | 0.300 | 4.000 |
| 23 | 310 | 226 | 8 | 0.100 | 1.200 | 1.300 | 2.500 | 0.850 | 0.800 | 4.300 |
| 24 | 313 | 227 | 11 | 0.000 | 1.300 | 1.200 | 2.500 | 0.642 | 0.600 | 4.000 |
| 25 | 310 | 227 | 8 | 0.000 | 1.200 | 1.400 | 2.600 | 0.789 | 0.400 | 3.800 |
| 26 | 313 | 228 | 11 | 0.000 | 1.200 | 1.300 | 2.500 | 0.878 | 0.400 | 3.800 |
| 27 | 310 | 228 | 8 | 0.000 | 1.200 | 1.300 | 2.500 | 0.823 | 0.300 | 3.700 |
| 28 | 313 | 227 | 11 | 0.000 | 1.200 | 1.200 | 2.400 | 0.781 | 0.400 | 3.700 |
| 29 | 310 | 227 | 8 | 0.000 | 1.200 | 1.200 | 2.400 | 0.908 | 0.400 | 3.600 |
| 30 | 313 | 227 | 11 | 0.100 | 1.300 | 2.000 | 3.300 | 0.814 | 0.600 | 5.200 |
| 31 | 310 | 227 | 8 | 0.100 | 1.100 | 1.200 | 2.300 | 0.801 | 0.300 | 3.500 |
| 32 | 313 | 226 | 11 | 0.000 | 1.000 | 1.200 | 2.200 | 0.769 | 0.300 | 3.300 |
| 33 | 310 | 226 | 8 | 0.000 | 1.100 | 1.800 | 2.900 | 0.932 | 0.400 | 4.900 |
| 34 | 313 | 227 | 11 | 0.000 | 1.300 | 1.400 | 2.700 | 1.029 | 1.700 | 5.500 |
| 35 | 310 | 228 | 8 | 0.000 | 1.300 | 1.200 | 2.500 | 1.180 | 0.400 | 3.600 |
| 36 | 313 | 228 | 11 | 0.000 | 1.200 | 1.100 | 2.300 | 1.395 | 0.300 | 3.500 |
| 37 | 310 | 229 | 8 | 0.000 | 1.200 | 1.300 | 2.500 | 0.798 | 0.300 | 3.600 |
| 38 | 313 | 228 | 11 | 0.000 | 1.100 | 1.000 | 2.100 | 1.240 | 0.400 | 3.200 |
| 39 | 310 | 228 | 8 | 0.000 | 1.400 | 1.300 | 2.700 | 0.696 | 0.400 | 3.900 |
| 40 | 313 | 228 | 11 | 0.000 | 1.000 | 1.100 | 2.100 | 0.655 | 0.300 | 3.300 |
| 41 | 310 | 227 | 8 | 0.100 | 1.100 | 1.300 | 2.400 | 0.650 | 0.300 | 3.600 |
| 42 | 313 | 227 | 11 | 0.000 | 1.200 | 1.500 | 2.700 | 0.669 | 0.300 | 4.400 |
| 43 | 310 | 227 | 8 | 0.000 | 1.500 | 2.000 | 3.500 | 0.618 | 0.800 | 5.700 |
| 44 | 313 | 227 | 11 | 0.000 | 1.900 | 1.300 | 3.200 | 0.647 | 0.400 | 4.600 |
| 45 | 310 | 227 | 8 | 0.000 | 1.500 | 1.300 | 2.800 | 1.928 | 0.400 | 4.000 |
| 46 | 313 | 228 | 11 | 0.100 | 1.300 | 1.500 | 2.800 | 0.780 | 0.400 | 5.100 |
| 47 | 310 | 229 | 8 | 0.000 | 1.300 | 1.200 | 2.500 | 0.764 | 0.300 | 3.400 |
| 48 | 313 | 228 | 11 | 0.000 | 1.900 | 2.000 | 3.900 | 0.718 | 0.600 | 5.600 |
| 49 | 310 | 228 | 8 | 0.000 | 1.400 | 1.300 | 2.700 | 0.735 | 0.300 | 3.700 |
| 50 | 313 | 228 | 11 | 0.000 | 1.200 | 1.200 | 2.400 | 0.635 | 0.400 | 3.500 |
| 51 | 309 | 227 | 8 | 0.000 | 10.700 | 10.000 | 20.700 | 0.778 | 0.700 | 43.600 |
| 52 | 312 | 226 | 11 | 0.100 | 32.600 | 3.000 | 35.600 | 1.162 | 0.700 | 38.300 |
| 53 | 309 | 227 | 8 | 0.000 | 2.400 | 1.700 | 4.100 | 0.626 | 0.400 | 5.900 |
| 54 | 312 | 227 | 11 | 0.000 | 2.500 | 1.900 | 4.400 | 0.759 | 0.600 | 6.400 |
| 55 | 309 | 226 | 8 | 0.000 | 4.000 | 3.000 | 7.000 | 0.661 | 0.600 | 9.700 |
| 56 | 312 | 227 | 11 | 0.000 | 2.400 | 2.000 | 4.400 | 0.671 | 0.500 | 6.200 |
| 57 | 309 | 228 | 8 | 0.100 | 2.000 | 1.800 | 3.800 | 0.610 | 0.600 | 5.800 |
| 58 | 312 | 227 | 11 | 0.000 | 1.400 | 1.500 | 2.900 | 0.644 | 0.900 | 4.800 |
| 59 | 309 | 228 | 8 | 0.000 | 2.800 | 2.700 | 5.500 | 0.789 | 0.800 | 8.000 |
| 60 | 312 | 228 | 11 | 0.000 | 1.300 | 1.200 | 2.500 | 0.881 | 0.400 | 3.800 |
| 61 | 310 | 227 | 8 | 0.000 | 10.100 | 3.700 | 13.800 | 1.209 | 0.800 | 16.800 |
| 62 | 313 | 227 | 11 | 0.000 | 2.600 | 2.200 | 4.800 | 0.761 | 0.500 | 8.200 |
| 63 | 310 | 228 | 8 | 0.000 | 3.800 | 3.100 | 6.900 | 0.712 | 0.500 | 8.900 |
| 64 | 313 | 228 | 11 | 0.000 | 2.400 | 2.200 | 4.600 | 0.630 | 0.600 | 7.100 |
| 65 | 310 | 228 | 8 | 0.000 | 1.800 | 1.600 | 3.400 | 0.606 | 0.400 | 4.900 |
| 66 | 313 | 228 | 11 | 0.000 | 1.900 | 1.700 | 3.600 | 0.666 | 0.400 | 5.000 |
| 67 | 310 | 228 | 8 | 0.000 | 2.000 | 1.700 | 3.700 | 0.694 | 0.600 | 5.400 |
| 68 | 313 | 228 | 11 | 0.000 | 1.700 | 1.600 | 3.300 | 0.807 | 0.500 | 4.700 |
| 69 | 310 | 228 | 8 | 0.000 | 1.400 | 1.200 | 2.600 | 0.778 | 0.400 | 3.900 |
| 70 | 313 | 228 | 11 | 0.000 | 1.400 | 1.800 | 3.200 | 0.698 | 0.800 | 5.600 |
| 71 | 310 | 228 | 8 | 0.000 | 1.300 | 2.100 | 3.400 | 0.692 | 0.400 | 5.100 |
| 72 | 313 | 227 | 11 | 0.000 | 1.100 | 1.200 | 2.300 | 0.634 | 0.400 | 4.900 |
| 73 | 310 | 228 | 8 | 0.000 | 1.100 | 1.100 | 2.200 | 0.769 | 0.500 | 3.400 |
| 74 | 313 | 228 | 11 | 0.000 | 1.000 | 1.300 | 2.300 | 0.734 | 0.400 | 3.200 |
| 75 | 310 | 229 | 8 | 0.000 | 1.100 | 1.100 | 2.200 | 0.652 | 0.200 | 3.400 |
| 76 | 313 | 228 | 11 | 0.000 | 1.600 | 1.600 | 3.200 | 0.637 | 1.000 | 5.200 |
| 77 | 310 | 228 | 8 | 0.000 | 1.200 | 1.100 | 2.300 | 0.639 | 0.300 | 3.500 |
| 78 | 313 | 227 | 11 | 0.000 | 1.100 | 1.300 | 2.400 | 0.601 | 0.500 | 3.700 |
| 79 | 310 | 228 | 8 | 0.100 | 1.200 | 1.300 | 2.500 | 0.648 | 0.500 | 4.300 |
| 80 | 313 | 228 | 11 | 0.100 | 1.400 | 2.000 | 3.400 | 0.594 | 0.800 | 5.700 |
| 81 | 310 | 228 | 8 | 0.000 | 1.500 | 1.900 | 3.400 | 0.629 | 1.000 | 5.800 |
| 82 | 313 | 228 | 11 | 0.000 | 1.100 | 1.200 | 2.300 | 0.604 | 0.300 | 3.300 |
| 83 | 310 | 228 | 8 | 0.000 | 1.100 | 1.100 | 2.200 | 0.654 | 0.400 | 3.400 |
| 84 | 313 | 228 | 11 | 0.000 | 1.100 | 0.800 | 1.900 | 0.668 | 0.300 | 3.000 |
| 85 | 310 | 229 | 8 | 0.000 | 1.100 | 1.100 | 2.200 | 0.633 | 0.400 | 3.600 |
| 86 | 313 | 229 | 11 | 0.000 | 1.200 | 1.100 | 2.300 | 0.727 | 0.400 | 3.500 |
| 87 | 310 | 229 | 8 | 0.000 | 1.100 | 1.100 | 2.200 | 0.651 | 0.400 | 3.300 |
| 88 | 313 | 228 | 11 | 0.000 | 1.200 | 1.100 | 2.300 | 0.666 | 0.300 | 3.300 |
| 89 | 310 | 228 | 8 | 0.000 | 1.500 | 2.100 | 3.600 | 0.595 | 0.900 | 5.900 |
| 90 | 313 | 228 | 11 | 0.100 | 1.500 | 1.700 | 3.200 | 0.618 | 0.800 | 5.600 |
| 91 | 310 | 228 | 8 | 0.000 | 1.300 | 1.500 | 2.800 | 1.131 | 0.800 | 4.900 |
| 92 | 313 | 228 | 11 | 0.000 | 1.300 | 1.300 | 2.600 | 0.717 | 0.400 | 3.700 |
| 93 | 310 | 228 | 8 | 0.000 | 1.400 | 1.200 | 2.600 | 0.702 | 0.400 | 4.000 |
| 94 | 313 | 228 | 11 | 0.000 | 1.900 | 1.900 | 3.800 | 0.608 | 0.500 | 5.700 |
| 95 | 310 | 228 | 8 | 0.000 | 1.400 | 1.200 | 2.600 | 0.700 | 0.500 | 4.000 |
| 96 | 313 | 229 | 11 | 0.100 | 1.300 | 1.300 | 2.600 | 0.695 | 0.400 | 4.300 |
| 97 | 310 | 229 | 8 | 0.000 | 2.900 | 1.800 | 4.700 | 0.746 | 1.100 | 7.200 |
| 98 | 313 | 229 | 11 | 0.100 | 1.900 | 2.500 | 4.400 | 2.848 | 0.500 | 6.300 |
| 99 | 310 | 228 | 8 | 0.000 | 1.500 | 1.300 | 2.800 | 0.877 | 0.500 | 4.100 |
| 100 | 314 | 229 | 12 | 0.100 | 1.700 | 3.100 | 4.800 | 0.936 | 0.500 | 6.600 |

Load average at end: 2.95, 3.46, 7.13

## Task 12: unchanged subtree reuse

Task 11's original run (commit `647a9ca`) measured **228 B gzip**,
**1.2 ms arrival validation**, **7.7 ms React work**, and **9.1 ms validation
plus React work** (medians). It therefore required Task 12. The summary and
per-revision samples above are the Task 12 rerun on the same subject, constants,
pacing and React development build, regenerated by
`bun --conditions liveframe:source bench/streaming.bench.ts --patches`.

The renderer now caches each node's `Item` and rendered element in a per-surface
WeakMap keyed by the validated node object. The cache resets when validator,
fallback, portal or diagnostics changes; implementations belong to the renderer
factory. Unchanged nodes retain both identities, allowing React to skip their
render work. A layout effect publishes the accepted tree and current callbacks to
reused event handlers. Pending confirmations retain their original origin and
callback. Every arriving tree is still validated whole.

The browser regression failed before the implementation: both unchanged buttons
and the local text field rendered again. After the implementation it reports one
root and one changed text render, zero unchanged button/text-field renders, and
strict equality of retained `Item`s and their elements. It also checks focused
draft text, scroll, local button state, current setState/action origins, handler
replacement, empty patches, stale arrivals and validator replacement. The second
regression checks updated fallback/diagnostics and enabling confirmation on a
reused node. Existing confirmation tests now advance with shared node objects.

React's documented element-reference bailout and state preservation were checked
through Context7 (`/reactjs/react.dev`):
[useMemo](https://react.dev/reference/react/useMemo#memoizing-individual-jsx-nodes),
[preserving state](https://react.dev/learn/preserving-and-resetting-state).
The historical LF-17 Profiler metric remains unchanged: it measures React render
work, not DOM commit or paint. The separate flushSync/end-to-end spans above
retain that distinction.

### Verification under competing system load

The complete `timeout 1200s bun run check` ran build, generated-code checks,
typecheck, lint and formatting successfully. Its test run reported **867 passed,
4 skipped, 11 failed and one between-test error** (882 tests, 109 files, 616.78 s).
The local log is `/tmp/liveframe-task12-check-loaded.log`. System load reached
**61.56 / 43.56 / 23.15** on 16 logical CPUs while Rust/container builds and two
QEMU VMs were active; `/proc/pressure/cpu` later showed avg60 20.10%.

| Loaded-run failure | Evidence from the unchanged focused rerun |
| --- | --- |
| `capture_shows_the_draft_last_packed` (preview readiness) | Passed alone, 15.50 s; `/tmp/liveframe-task12-capture-recheck.log`. |
| `check_value_handles_1000_mixed_properties_under_5ms`, `validator_smoke_under_5us_per_node` | Passed in the nine-test focused run; neither implementation imports the changed renderer. |
| `switch_under_budget_with_blur_through_surface` | Passed with warm samples 7.7–11.5 ms, unchanged 16.67 ms ceiling; the loaded run had a 129.8 ms sample. |
| `hydration_can_be_followed_by_updates_without_remounting` | Passed, 403.20 ms, after the loaded run exceeded its 5 s timeout. |
| `production_without_profiling_fails_instead_of_hiding_renders`, `overlay_and_text_cases_pass_on_reference_implementations`, `overlay_and_text_cases_name_missing_declared_kinds`, `overlay_cases_catch_backdrop_ancestors_and_reduced_motion`, `text_case_accepts_intents_emitted_while_typing` | All passed in the focused run. The full run's hydration timeout closed the shared browser and produced the between-test error and downstream closed-browser failures. |
| `every_theme_and_design_system_projects` | Passed alone, 94.38 ms, after the loaded run exceeded its 5 s timeout; `/tmp/liveframe-task12-projection-recheck.log`. |

The nine-test rerun passed in 34.37 s with 64 assertions and no failures; see
`/tmp/liveframe-task12-failed-recheck.log`. All eleven failed test names therefore
passed without a source change. Together with the observed resource pressure,
this supports contention and the closed-browser cascade as the causes of this
run's failures; it does not substitute a claim that the full check passed.

The owner explicitly instructed: “Keep working with the current load. Document
failures that are caused by system load but do not block tasks because of it”.
Task 12 follows that instruction as an execution exception to the usual green
full-check rule. No timeout, threshold, runner deadline or assertion was raised or
removed. The two new renderer regressions passed in the full run as well as their
focused runs; the existing surface and intent suites also passed.

`bun run bench` was attempted twice and stopped at the existing validator
1.5 µs/node gates. That benchmark does not import the React renderer. In the
second attempt, patch application and diff medians still passed their existing
limits (**0.1372 ms** and **0.6047 ms**). Its local log is
`/tmp/liveframe-task12-bench-final.log`. The remaining render, CSS and whole-tree
streaming benchmarks were then run separately so the validator exit did not skip
them. The original LF-17 record `019-streaming-bench.md` is preserved unchanged.

### Whole-tree control and remaining benchmarks

`timeout 180s bun --conditions liveframe:source bench/render.bench.ts`,
`timeout 180s bun --conditions liveframe:source bench/css.bench.ts` and
`timeout 180s bun --conditions liveframe:source bench/streaming.bench.ts` all
passed. Local logs: `/tmp/liveframe-task12-render-bench.log`,
`/tmp/liveframe-task12-css-bench.log`, `/tmp/liveframe-task12-streaming-whole.log`.
The whole-tree output was copied to `/tmp/liveframe-task12-whole-tree.md` before
restoring the original `019-streaming-bench.md`; it has no diff.

The whole-tree run used the same 679-node, 50-row subject, 100 revisions at 10/s,
React development build, Bun 1.4.4 and Chromium 156.0.8078.4 on the machine above.
It was generated at 2026-10-31T06:50:58.970Z; ending load was 6.89/26.84/20.09.

| Whole-tree measure | LF-17 original median | Task 12 median | Task 12 p95 | Task 12 max |
| --- | ---: | ---: | ---: | ---: |
| Gzip bytes | 5099 | 5099 | 5101 | 5102 |
| JSON parse ms | 0.400 | 0.300 | 0.500 | 1.100 |
| Arrival validation ms | 1.400 | 1.300 | 2.000 | 3.800 |
| React work ms | 10.300 | 9.300 | 44.600 | 49.100 |
| Arrival validation + React work ms | 12.100 | 10.700 | 45.900 | 50.400 |
| Wall time around flushSync ms | 31.900 | 26.000 | 69.600 | 159.400 |

This control shows no measured whole-tree regression against LF-17. Whole-tree
transport still exceeds the patch thresholds, as expected. Patch transport meets
both fixed medians above: **228 B gzip** and **2.7 ms validation plus React work**.

The SDK render benchmark passed its unchanged 3 µs/node and 2 ms wall gates:
agent-home **1.3296 ms / 1.958 µs per node**, and the element path
**1.6454 ms / 2.423 µs per node**. CSS projection also passed unchanged:
style declarations **0.404 µs/node**, certified/rack design-system sheets
**8.363/11.554 ms**. These passes do not erase the loaded full-check and validator
benchmark failures documented above. No production-browser or cross-engine
performance claim is added; Tasks 13–14 retain their scope.
