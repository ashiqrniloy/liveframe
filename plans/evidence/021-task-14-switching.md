# Plan 021 Task 14 — switching assertions (incomplete)

Attempted 2026-10-31. **Task 14 remains unchecked.** The stricter assertions
expose the unresolved WebKit cost; they do not establish CL-16 acceptance.
No production CSS change, budget change or measurement-definition decision
has been made. The WebKit backlog deferral remains open.

## Measurement and results

Both switching tests now use `measureSwitching` in
`src/__tests__/fixtures/browser.ts`. It reproduces Task 13's split: A starts
at the first `data-lf-switching` attribute write and ends after a forced root
layout read. B reads computed styles across the fixture. C ends at the second
subsequent rAF timestamp, a rendering-opportunity proxy rather than proof of
physical paint. Call-start-through-layout is logged separately. The helper
throws if an attribute mark is missing or a duration is invalid. It preserves
the fixtures, the alternating identities, one cold sample and ten warm samples.

Only A is asserted, at 16.67 ms in every engine. The old 25.1 ms WebKit
ceiling and unsupported frame-pacing explanation have been removed.

Sequential focused runs on the same machine and installed browsers as
[Task 13](021-webkit-switching.md) produced these warm maxima:

| Engine | CSS A, 956 nodes | Surface A, 686 nodes | Result |
| --- | --- | --- | --- |
| Chromium 156 | 6.9 ms | 6.7 ms | Both pass |
| Firefox 157 | 10 ms | 6 ms | Both pass |
| WebKit 27.2 | 25 ms | 17 ms | Both fail |

The earlier red run measured CSS A at 26 ms and Surface A at 15 ms.
The variation does not change the finding: removing B/C from the assertion
does not fix the library's CSS fixture. No tested projection rewrite has
been retained as a proven optimization. These results are measurements on
this machine, not guarantees for other hosts.

## Regeneration

Run each engine separately, without concurrent browser or benchmark work:

```sh
LIVEFRAME_BROWSER=chromium timeout 60s bun test --conditions liveframe:source src/__tests__/css-scope-browser.test.ts src/__tests__/react-browser.test.tsx -t switch_under_budget
LIVEFRAME_BROWSER=firefox timeout 60s bun test --conditions liveframe:source src/__tests__/css-scope-browser.test.ts src/__tests__/react-browser.test.tsx -t switch_under_budget
LIVEFRAME_BROWSER=webkit timeout 60s bun test --conditions liveframe:source src/__tests__/css-scope-browser.test.ts src/__tests__/react-browser.test.tsx -t switch_under_budget
```

On this unsupported CachyOS host, the runs used the existing Task 13
compatibility libraries and `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`.
Raw logs are local-only in `evidence/021-task-14/{chromium,firefox,webkit}.log`;
the earlier failure is `webkit-red.log`. Redirect the commands above to
regenerate them. Task 13's committed `switch-split.ts` remains the independent
diagnostic for headed/headless controls.

## Remaining acceptance work

Find and verify a CSS/switching optimization that brings the maximum of all
ten warm A samples under 16.67 ms in every engine without changing the
fixtures or weakening styling behavior. Then run the selector-work mutant,
bench/CSS gates and repository check, close the backlog deferral, and answer
the 0.2.0 limitation in the 0.2.1 changelog. Until then, the stricter WebKit
tests are failing work in progress and Task 14 must not be committed as done.

## Validation

The focused Chromium and Firefox runs pass; the focused WebKit run fails as
shown above. `timeout 1200s bun run check` passed with the default Chromium engine: **878 passed, 4 skipped, 0 failed**, 882 tests across 109 files (279.98 s), including build, generated-code checks, typecheck, lint and formatting. The local log is `evidence/021-task-14/check.log`. Focused documentation tests passed (3 tests), as did focused lint/format and `git diff --check`. This default-engine check does not override the failing WebKit acceptance gate. Benchmarks and the selector-work mutant were not run because no production optimization is ready.

## After Task 13.2 (R1: trusted primitive CSS in both fixtures)

Both switching pages now load `proof/renderer/primitives/base.ts`'s
`primitiveCss` before the projected sheets, and
`switching_fixture_loads_primitive_css` asserts that icon roots stay within
16 px. The focused runs used the commands above at 14:46 local, at load 4.4,
with a QEMU VM still running. Warm span A, median / max:

| Engine | CSS A | Surface A | Result |
| --- | --- | --- | --- |
| Chromium 156 | 6.5 / 7.5 ms | 6.6 / 7.4 ms | Both pass |
| Firefox 157 | 8 / 10 ms | 6 / 9 ms | Both pass |
| WebKit 27.2 | 14.5 / 20 ms | 16 / 17 ms | Both fail |

All 33 tests in the two files pass in Chromium and Firefox. In WebKit, 31 pass
and only the two switching assertions fail, as Task 13.1's evidence predicts.
R1 removes the unrealistic-page cost but not the switch's own layout work,
which Tasks 13.3 and 13.4 address. Raw logs are local-only in
`evidence/021-task-14/13.2-{chromium,firefox,webkit}.log`.

## After Task 13.4 (R2: the agent-home queue rows defer offscreen)

The 50 queue rows set `deferOffscreen="space.7"`. Both switching fixtures
use the regenerated agent-home tree and markup. Three consecutive focused
WebKit runs at 15:11 local, at load 2.4, gave these sorted warm span A samples (ms):

| Run | CSS fixture | Surface fixture |
| --- | --- | --- |
| 1 | 8 8 8 8 9 9 9 9 9 10 | 10 10 10 11 11 11 11 13 13 14 |
| 2 | 8 8 9 9 9 9 9 10 10 11 | 10 11 11 11 11 11 11 13 13 14 |
| 3 | 8 8 8 8 8 9 9 9 9 9 | 11 11 11 11 12 12 12 12 13 13 |

Chromium medians/maxima were 3.8/5.8 ms (CSS) and 3.9/5.8 ms (Surface).
Firefox's were 5/6 ms and 4/4 ms. Every engine passes span A ≤ 16.67 ms.
The WebKit maximum stays at or below Task 13.6's 14 ms gate in all three
runs. After R1 alone, WebKit's maxima were 20 ms (CSS) and 17 ms (Surface),
which is what the Task 14 mutant (removing `deferOffscreen` from the rows)
reverts to. Raw logs are local-only in
`evidence/021-task-14/13.4-{webkit-1,webkit-2,webkit-3,chromium,firefox}.log`.
