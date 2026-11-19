# Evidence: the 2026-11-15 package review

Source for plans 033–039. The review read `main` at `b4e2359` and reproduced or measured each claim below with throwaway scripts run as `bun --conditions liveframe:source <script>`; the scripts were not kept. Every reproduction is restated as a named test in the plan task that fixes it, so the task's first step regenerates it.

Machine: 16 cores, load average about 12 throughout (other work on the host). Timings are upper bounds; the ratios are the finding. Bun 1.4.4.

## Reproduced defects

| # | Steps | Observed |
|---|---|---|
| D1 | `renderPlacement` with `revision: 7`; again with a changed state and `previous`; again with a changed state, `previous` at 8 and `revision: 5` | `previous.revision=8 floor=5 -> new revision=5 patch=false` |
| D2 | Render with the same inputs and `previous` at revision 8 | The same object as `previous`; `patch.base=7`, `patch.revision=8`, though the client already holds 8 |
| D3 | `handleIntent` for an offered action whose `dispatch` succeeds; the runner fails on the following render | `dispatched=1`, result keys `ok,errors`: no `actions` |
| D4 | Surface core: accept revision 5, reject an invalid revision 6, then accept revision 3 | After 6: `valid=false`. After 3: `valid=true`, showing revision 5; events `arrival-rejected,stale-revision` |
| D5 | A 6,000-node tree: `validateTree` with `limits.nodes: 10000`; the same validator in a surface core; a wrapper `{ checkNode, validateTree }` that passes the limits | Backend: accepted. Core: `limit-exceeded: Expected at most 5000 nodes`. Wrapper: `accept()` threw `LiveframeFailure: Unknown validator` |
| D6 | A new `workerRunner({ timeoutMs: 5000 })`, first and second render of a one-node widget, nine runners, from `dist/` | Cold first render 36.2 ms median, 51.7 ms max; warm 0.55 ms. In the full `bun run check`, `package_guide_example_runs` failed with `limit-exceeded: Render exceeded 100 ms`; alone it passed three times |
| D7 | Surface core with an `onIntent` that throws synchronously, on an action without `confirm` | `emit` threw the host's error |

## Measurements

| What | Result |
|---|---|
| `renderPlacement`, proof agent-home code package, no `verified` cache, forced re-render | 39.16 ms |
| The same with `verifiedPackages()` | 18.31 ms |
| The same, skipped (same key) | 12.62 ms |
| `loadPlacement` alone, no cache / cache / cache with the store returning one frozen object | 15.00 / 14.07 / 10.53 ms |
| The package | 199 KB: code 27 KB, scenarios 167 KB |
| `memoryStore` copy (JSON round trip) | 1.58 ms |
| `validateWidgetPackageShape` including the parse | 2.72 ms |
| `packageHash` | 5.48 ms |
| `canonicalJson` of the catalog and capabilities | 0.37 ms |
| `verifyPackage` | 12.96 ms |
| `compileValidator`, same documents | 0.38 ms |
| `compileValidator`, catalog and capabilities parsed fresh from JSON each call (21 KB catalog) | 0.47 ms under JSC's JIT |
| `renderKey` over 109 KB of data (1,000 rows) | 3.67 ms |
| `render()` of a 51-node page fed those rows: direct / through 1, 3, 6 pass-through composed components | 1.60 / 2.77 / 3.75 / 5.48 ms |
| `surfaceAttributes` on a 3,001-node tree with no responsive value | 0.17 ms |

## Baseline `bun run check`

Build, `gen:check`, typecheck, lint (10 infos, no warnings) and format passed. The test stage was cut off by the reviewer's own 580 s limit, so the run is not a pass or a fail of the suite. Before the cut-off three tests had failed, all on elapsed time: `package_guide_example_runs` (D6), `verify_agent_home_under_20_ms` (21.37 ms) and `in_process_warm_overhead_under_point_one_ms` (0.133 ms). Rerun alone three times each: the first passed three times, the second failed once (27.49 ms), the third passed three times. While the plans were being written, `shipped_docs_never_call_exports_planned` failed once at 202.80 ms against 200 and passed alone.

## Stated from the code, not measured

- Focus continuity's document-wide scan (`src/react/renderer.tsx:131-169`). Plan 035 Task 1 measures it.
- The second render of every implementation at mount (`src/react/renderer.tsx:420`, `:459`). Plan 035 Task 1 measures it.
- The validator recompile per render inside QuickJS with `reuse: "package"`. Plan 034 Task 6 measures it.
- `core.accept()` under a discarded concurrent render. Plan 035 Task 4 reproduces it or records that it cannot occur.
