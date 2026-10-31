# Plan 021 Task 13 — WebKit switching diagnosis

Executed 2026-10-31. Regenerate with [switch-split.ts](021-task-13/switch-split.ts).
This is diagnosis, not a change to the 16.67 ms budget or either existing test.

## Verdict

**Span A itself misses 16.67 ms on WebKit.** The CSS-only two-surface fixture
measures **17 / 21 ms median / max headless** and **18.5 / 20 ms headed**.
The subsequent per-element probe takes only **1 / 2 ms** in both modes.
Chromium's corresponding A maxima are 6.6 and 7.1 ms. Task 14 must take its
CSS/switching optimization branch; merely excluding probe or frame time does
not establish the budget. No threshold was changed here.

The evidence localizes the dominant synchronous cost to attribute-triggered
style/layout resolution, before the per-element reads. It does not identify
an individual selector or distinguish style recalculation, font metrics and
layout inside that flush. Those are the next optimization targets, not proven
individual causes. The CSS fixture also costs more than the smaller React
fixture in both engines; this is consistent with work scaling with the styled
subtree, but the fixtures differ in structure as well as size.

## Method and environment

- CachyOS x86_64, Linux `7.3.0-4-cachyos`; AMD Ryzen 9 PRO 7940HS with Radeon
  780M Graphics, 16 logical CPUs. Bun 1.4.4, Playwright 1.64.1, Chromium
  156.0.8078.4, WebKit 27.2 (Playwright bundle `webkit-2370`).
- Sequential browser runs at 06:56–06:57 UTC; no concurrent benchmark/check
  run. One/five/fifteen-minute load averages at launch: Chromium headless
  3.13/10.77/14.89; WebKit headless 3.13/10.77/14.89; WebKit headed
  6.19/10.19/14.43; Chromium headed 6.19/10.19/14.43. These are measurements
  on this machine, not a portability guarantee. WebKit reports whole-ms timing
  precision here; do not read sub-ms certainty into its results.
- Both fixtures use the tests' 1700×1000 viewport and preloaded projected CSS.
  CSS-only reproduces `css-scope-browser.test.ts`'s mount: two captured
  agent-home surfaces, responsive probe, dialog and popover, **956 nodes** in
  the switched scope. React uses the actual `react-client.tsx` bundle and
  `mountSwitching`/`switchStyles`, including the unused modifiers sheet loaded
  by `react-browser.test.tsx`: **686 nodes** in `#b *`, root and portal scopes.
- Each fixture/mode runs one cold sample then **10 warm samples**, alternating
  Certified/Rack. Each mode resets to Rack and settles before its cold switch.
  `legacy` repeats the original switch-plus-probe timed window without an
  explicit layout flush. `split` moves the layout flush before the probe.
- **A / library:** a local wrapper on the switched root's `setAttribute` marks
  the first `data-lf-switching` mutation; the endpoint follows one
  `root.offsetWidth` read. For React this includes its synchronous scope commit
  after that mutation. The script also records call-start-through-layout so
  earlier React work is visible. This deliberately forces the renderer's
  scheduled layout work synchronously; it excludes waiting for its rAF.
- **B / probe:** from that layout endpoint through every element's
  `getComputedStyle` reads of `fontSize`, `backgroundColor`, `backdropFilter`
  and `display`. B alone is not what the old tests time: their window also
  pays the first style/layout flush. The separate legacy control preserves it.
- **C / frame:** call start through the second subsequent rAF **timestamp**;
  the gap between the two rAF timestamps is recorded separately. The CSS
  harness removes suppression on the first rAF; the actual renderer handles
  its own root/portal cleanup there. Double rAF is a rendering-opportunity
  proxy, not proof that pixels reached a display, particularly headless/Xvfb.
- Uses `performance.mark` / `performance.measure`; assertions require >500
  nodes, 10 warm samples and finite nonnegative timings. Missing attribute
  marks fail measurement rather than silently substituting another boundary.
  Cold samples, all warm samples, call/layout and frame gaps are printed as JSON.
  This execution's raw outputs are saved locally under `evidence/021-task-13/`
  as `021-switch-{chromium-headless,webkit-headless,webkit-headed,chromium-headed-xvfb}.log`;
  regenerate them with the commands below and shell output redirection.

## Warm results

Every cell is **median / max in ms**, computed from the ten warm samples.
The legacy total is a separate trial; split total includes call overhead + A + B.

| Engine / mode | Fixture | A: library | B: probe | C: double rAF | Legacy switch + probe | Split total |
| --- | --- | --- | --- | --- | --- | --- |
| Chromium headless | CSS | 5.55 / 6.60 | 1.60 / 1.80 | 41.35 / 49.80 | 7.90 / 9.20 | 7.20 / 8.40 |
| Chromium headless | Surface | 5.30 / 8.80 | 0.80 / 1.60 | 41.35 / 66.50 | 6.60 / 7.70 | 6.80 / 11.50 |
| WebKit headless (WPE) | CSS | 17.00 / 21.00 | 1.00 / 2.00 | 64.00 / 80.00 | 20.00 / 30.00 | 18.00 / 22.00 |
| WebKit headless (WPE) | Surface | 13.00 / 17.00 | 0.50 / 1.00 | 52.00 / 81.00 | 15.00 / 21.00 | 15.00 / 18.00 |
| WebKit headed (GTK/Xvfb) | CSS | 18.50 / 20.00 | 1.00 / 2.00 | 48.00 / 50.00 | 18.00 / 20.00 | 19.50 / 22.00 |
| WebKit headed (GTK/Xvfb) | Surface | 12.00 / 12.00 | 1.00 / 1.00 | 33.00 / 34.00 | 14.50 / 17.00 | 13.00 / 14.00 |
| Chromium headed (Xvfb) | CSS | 6.40 / 7.10 | 1.70 / 2.00 | 33.00 / 33.10 | 8.30 / 15.60 | 8.25 / 8.90 |
| Chromium headed (Xvfb) | Surface | 5.55 / 6.20 | 0.90 / 1.10 | 33.00 / 33.10 | 6.60 / 9.20 | 7.00 / 7.70 |

The React call-start-through-layout medians/maxima are 5.85/9.90 ms
(Chromium headless), 14/18 ms (WebKit headless), 12/13 ms (WebKit headed)
and 6.15/6.80 ms (Chromium headed). The CSS values equal A to timer precision.
The split frame-gap medians/maxima are respectively 16.7/16.7, 16.65/16.7,
9.5/15, 10.5/21, 8/12, 9/11, 16.7/16.7 and 16.7/16.7 ms in table order.

## Cause assessment and code reading

1. **Style/layout flush: supported.** WebKit CSS A alone exceeds budget in
   both headless WPE and headed GTK. The ~1 ms isolated probe cannot account
   for the 18–22 ms historical switch window. The explicit flush transfers
   that work to A, where it remains expensive. Chromium controls are faster.
2. **Probe overhead as the sole cause: refuted.** B has a 2 ms max for CSS
   and 1 ms max for Surface on WebKit. The original window mixes invalidation,
   style/layout resolution and probe overhead; calling all of it probe cost
   would also be incorrect.
3. **Headless frame pacing as the timed cost: refuted.** In
   `css-scope-browser.test.ts` and `react-browser.test.tsx`, `start` is taken
   after the pre-switch rAF and `elapsed` before the next awaited rAF. No
   awaited frame lies inside either timed window. C exceeds 16.67 ms even in
   Chromium, and includes two frame opportunities by construction; it cannot
   explain a synchronous duration. Scheduling contention can still affect
   wall time, but no evidence here assigns the miss to frame pacing. The
   comments in those tests and historical `019-engines.md` are unsupported
   causal claims; this record corrects them without rewriting old evidence.

The renderer really schedules its `offsetWidth` reads in rAF, immediately
before clearing `data-lf-switching` on wrapper and portal. It does not force
layout inside `switchStyles` itself. A isolates that work from the wait, while
the old probe forces it early. The diagnostic's explicit read is the requested
measurement model, not a production sequence change.

## Regeneration and host caveats

```sh
timeout 180s bun --conditions liveframe:source plans/evidence/021-task-13/switch-split.ts
LIVEFRAME_BROWSER=webkit PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 \
  timeout 180s bun --conditions liveframe:source plans/evidence/021-task-13/switch-split.ts
DISPLAY=:93 GDK_BACKEND=x11 LIVEFRAME_BROWSER=webkit PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 \
  timeout 180s bun --conditions liveframe:source plans/evidence/021-task-13/switch-split.ts --headed
DISPLAY=:93 timeout 180s bun --conditions liveframe:source plans/evidence/021-task-13/switch-split.ts --headed
```

On a supported Linux CI host, use Playwright's installed browser dependencies
and `xvfb-run` for headed runs. This CachyOS host is unsupported by Playwright.
Headless already had Ubuntu ICU 74, libxml2 and flite compatibility libraries
in `minibrowser-wpe/sys/lib` (the plan 019 workaround). Headed GTK initially
failed on `libicudata.so.74`; copying the same `libicu*`, `libxml2*` and
`libflite*` files and symlinks into `minibrowser-gtk/sys/lib` enabled launch.
No system library or repository dependency was changed.

The live tiling desktop (`DISPLAY=:0`) then rejected Playwright's 1700×1000
GTK resize. The recorded comparable headed runs use an isolated Xvfb display:
Arch `xorg-server-xvfb` 21.1.25-2 extracted under `/tmp/021-xvfb`, launched with
`timeout 180s /tmp/021-xvfb/usr/bin/Xvfb :93 -screen 0 1920x1200x24 -nolisten tcp`.
The display was stopped afterward. An additional live-desktop Chromium run
agreed (CSS A 6.35/6.6 ms; Surface A 5.4/5.7 ms), but is not mixed into the
table. Xvfb provides a real headed GTK process, not Clay's production compositor.

Clay's WebKitGTK real-window measurements from plan 205 Tasks 24 and 34
**have not arrived** in the request/evidence documents as of this execution.
Recheck before Task 17 and append them if supplied; Playwright GTK/Xvfb does
not replace that adopter evidence.

## Documentation checked

- Context7 resolved `/microsoft/playwright`, then fetched headed Linux launch
  and display requirements (installed version 1.64.1; no 1.64 version-specific
  index was offered). [Playwright CI documentation](https://playwright.dev/docs/ci#running-headed)
  describes Xvfb; the library launch option is `headless: false`.
- [W3C User Timing Level 3](https://www.w3.org/TR/user-timing/) defines marks,
  named-boundary measures and explicit `startTime`, used for the second rAF timestamp.

## Validation

All four recorded browser/mode runs completed both fixtures and the script's
sample/finite-timing assertions. `timeout 1200s bun run check` passed: **878
passed, 4 skipped, 0 failed**, 882 tests across 109 files (284.48 s), with
build, generated-code checks, typecheck, lint and formatting green. The log is
local-only at `evidence/021-task-13/check.log`. Final documentation checks
passed (3 tests), as did script lint/format and `git diff --check`. No
production code, exports, spec meaning, browser test assertion or performance
threshold changed.
