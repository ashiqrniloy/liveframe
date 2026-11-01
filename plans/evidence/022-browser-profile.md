# Browser cost profile: development and production React builds

Plan 022 Task 2. Measurement only: no budget changed and no runtime code changed.

## Method

- **Machine.** linux 7.3.0-4-cachyos; AMD Ryzen 9 PRO 7940HS w/ Radeon 780M Graphics; 16 logical CPUs.
  Load average during the runs was 4.8–9.3 (an unrelated Talos development cluster shares the
  host), so p95 and max values carry tail noise from GC and scheduling; medians are used for every
  conclusion below.
- **Browser.** Playwright 1.64.1, headless Chromium 156.0.8078.4. Bun 1.4.4.
- **Builds.** React 19.3.1. The development bundle is built with
  `process.env.NODE_ENV=development` and keeps `<Profiler>` instrumentation; the production bundle
  is built with `process.env.NODE_ENV=production` and contains no Profiler element. The streaming
  client (`bench/streaming-client.tsx`) reads its build from `process.env.NODE_ENV`; the renderer
  harness (`proof/tests/fixtures/renderer-client.tsx`) is served as both bundles by
  `proof/tests/renderer-browser.test.tsx`.
- **Warm and repeated.** The streaming runs do one untimed 20-revision pass, then record 100
  revisions paced at 10/s. The selection runs do two setup renders, then record 10 repeated
  whole-tree arrivals. A longer traced warm-up captured no render events, so the streaming warm
  pass stays short.
- **Split.** The streaming client times JSON parse, `validator.validateTree` (wrapped for timing),
  and the `flushSync` span around each update; React work is the `flushSync` span net of
  validation (production) or `Profiler onRender actualDuration` net of validation (development).
  Layout plus paint is summed from Chromium's `devtools.timeline` `Layout` and `Paint` trace events
  that fall between `performance.mark("lf-recorded-start")` and
  `performance.mark("lf-recorded-end")` marks placed around the recorded updates (the trailing
  frame is included). The trace clock cannot be joined to `performance.now()`, so layout plus paint
  is a window total divided by the number of recorded updates, not a per-sample split.
- **Subject.** The LF-17 subject, `agent-home`: 679 nodes, 50 rows, one row's status changes per
  revision, whole trees of 119 825 JSON bytes / 5 098 gzip bytes, patches of 310 bytes / 228 gzip
  bytes. The selection measurement dispatches the same `setState` intent used by the existing
  development test and re-arrives a fresh copy of the selected tree.
- **CSS.** The streaming page now gets the proof stylesheets (base, primitive and both design
  systems), which the previous streaming evidence page lacked. Without CSS the status change never
  changes pixels and Chromium produces no layout or paint at all.

## Streaming: whole tree and patches

Commands:

```bash
bun --conditions liveframe:source bench/streaming.bench.ts [--patches] [--production] --out <file>
```

Raw per-revision tables: `plans/evidence/022-streaming-development.md`,
`022-streaming-production.md`, `022-streaming-patches-development.md`,
`022-streaming-patches-production.md`.

Medians, milliseconds:

| Build | Mode | JSON parse | Arrival validation | React work | Layout + paint | Parse + validation + React |
|---|---|---:|---:|---:|---:|---:|
| development | whole tree | 0.4 | 1.4 | 8.5 | 0.056 | 9.8 |
| production | whole tree | 0.4 | 1.4 | 4.4 | 0.059 | 5.8 |
| development | patch | 0.0 | 1.2 | 1.1 | 0.060 | 2.3 |
| production | patch | 0.0 | 1.2 | 0.4 | 0.068 | 1.6 |

The development whole-tree figure is close to the 0.2.1 baseline (10.7 ms, plan 021 Task 12); the
patch figure reproduces the 2.7 ms baseline. Production removes 4.1 ms of React work from whole-tree arrival and
0.7 ms from patching; validation is unchanged by the build (it is the same library code).

Layout plus paint is 0.06 ms per update on average because only the first ~7 of 50 rows are in the
viewport and the widget defers offscreen rows (`deferOffscreen`). Updates that touch a deferred row
produce no layout or paint at all; the visible-row updates carry the whole 5.6–6.8 ms window total.
The stream therefore pays for React and validation, not for the compositor.

## Selection: 679 nodes, both proof design systems

Command: `bun test --conditions liveframe:source proof/tests/renderer-browser.test.tsx -t selection_rerender_cost`.

Development uses the existing `measureSelection` Profiler instrumentation
(`selection_rerender_cost_is_recorded`); production uses the new `measureSelectionWall` measurement,
which has no Profiler, times `flushSync` with `performance.now()` and repeats the arrival 10 times
(`selection_rerender_cost_is_recorded_in_production`). Figures are medians over the recorded
updates; development React work is `Profiler actualDuration` and production React work is flushSync
wall net of validation, so the two React columns are different instruments, not a like-for-like
speed-up.

| Build | System | Arrival validation | React work | Layout + paint | Update total |
|---|---|---:|---:|---:|---:|
| development | certified | 2.5 | 55.9 (Profiler render) | 4.73 | 94.0 (synchronous flushSync) |
| development | rack | 2.5 | 52.7 (Profiler render) | 3.71 | 86.8 (synchronous flushSync) |
| production | certified | 1.9 | 12.5 (flushSync wall, net) | 0.29 | 14.5 |
| production | rack | 1.9 | 12.1 (flushSync wall, net) | 0.28 | 14.0 |

The production update is dominated by React: 86% of the 14.5 ms is React work, 13% validation and 2%
layout plus paint. In development, React work (Profiler render, which excludes DOM commit) is 59–62%
of the synchronous update; the synchronous span also carries Profiler bookkeeping and commit.

## Dominant cost and its consequence

React work is the dominant cost wherever the whole tree is (re)drawn: 87% of development whole-tree
arrival, 76% of production whole-tree arrival, 86% of the production selection update and 59–62% of
the development selection update. JSON parse is 4% at most and layout plus paint is 5% or less
everywhere.

Patch mode is the exception and is validation-bound in production: validation is 1.2 ms of the 1.6 ms
update, and React work falls to 0.4 ms because a patch re-renders one row. This is why the plan's
whole-tree target (Task 3) is the lever that matters and patch mode is only held to "no regression".

Tasks 3 and 4 therefore stay in their planned order and their targets stand: reusing unchanged nodes
in `<Surface>` (Task 3) attacks the dominant term directly, and compiled-catalog reuse (Task 4) keeps
the second term from growing. No task is re-ordered or amended on this evidence.

The whole-tree production baseline for Task 3 is 5.8 ms median (validation plus React work) and the
patch production baseline is 1.6 ms; the development targets in the plan are unchanged.

## After: node reuse (Task 3)

Same machine, builds, commands and subjects; re-measured after `<Surface>` substitutes the accepted
tree's node objects for unchanged subtrees. Per-revision tables in the same four
`022-streaming-*` files, which now also report the reuse pass separately (`shareNodes` called on the
same previous/arrival pair outside the measured render span; the renderer runs the same pass inside
`flushSync`).

| Build | Mode | Arrival validation | Reuse pass | React work | Layout + paint | Validation + React |
|---|---|---:|---:|---:|---:|---:|
| development | whole tree | 1.9 | 0.3 | 1.8 | 0.057 | 3.4 (was 9.8) |
| production | whole tree | 1.4 | 0.2 | 0.7 | 0.057 | 2.1 (was 5.8) |
| development | patch | 1.3 | 0.1 | 1.6 | 0.060 | 2.8 (was 2.3) |
| production | patch | 1.2 | 0.1 | 0.7 | 0.064 | 1.9 (was 1.6) |

Whole-tree arrival falls by 65% in development and 64% in production, and the reuse pass itself is
0.3 ms median at 679 nodes (0.2–1.2 ms across runs; the plan allows 1.0 ms). Patch mode rises by
0.3–0.5 ms because the compare also runs on patched arrivals, which already shared their nodes
through `applyPatch`; it stays inside the plan's 2.7 ms + 10% gate at 2.8 ms and remains dominated by
validation. Layout plus paint is unchanged, as expected: reuse removes React work, not the rendering
of the changed row.

Selection, 679 nodes, medians over the recorded updates (same harnesses as above):

| Build | System | Arrival validation | React work | Layout + paint | Update total |
|---|---|---:|---:|---:|---:|
| development | certified | 2.6 | 10.3 (Profiler render) | 4.39 | 14.8 (was 94.0) |
| development | rack | 2.8 | 13.6 (Profiler render) | 4.04 | 16.1 (was 86.8) |
| production | certified | 2.3 | 0.9 (flushSync wall, net) | 0.33 | 2.9 (was 14.5) |
| production | rack | 2.1 | 0.9 (flushSync wall, net) | 0.29 | 3.0 (was 14.0) |

The selection update is now dominated by arrival validation plus layout and paint: React work is
0.9 ms of the 2.9 ms production update. Task 4 (compiled-catalog reuse) targets exactly that
remaining term, so its place in the order is unchanged; Task 3's targets are met.
