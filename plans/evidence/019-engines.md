# Plan 019 Task 6 — WebKit, Firefox and the other-runner backlog

Executed 2026-10-29 on CachyOS x86_64 with Bun 1.4.4, Playwright 1.64.1,
Chromium 156.0.8078.4, Firefox 157.0 and Playwright WebKit 27.2.

## Commands

Browser suites, one engine at a time:

```sh
bun test --conditions liveframe:source \
  src/__tests__/conformance-renderer-browser.test.tsx \
  src/__tests__/css-browser.test.ts \
  src/__tests__/css-scope-browser.test.ts \
  src/__tests__/react-browser.test.tsx \
  src/__tests__/preview-react.test.tsx \
  src/__tests__/conformance-guide.test.ts
```

Set `LIVEFRAME_BROWSER=firefox` or `LIVEFRAME_BROWSER=webkit` for the other
engines. Full suites were also run with `LIVEFRAME_BROWSER=<engine> bun run test`.
This host is not officially supported by Playwright, so the local WebKit run
also used `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` and Ubuntu 24.04
`libicu74`, `libxml2` and `libflite1` libraries copied into the Playwright
WebKit bundle; CI installs all three engines with
`bunx playwright install --with-deps chromium webkit firefox`.

The blocked-peer proof is `bun test --conditions liveframe:source src/__tests__/preloads.test.ts`.

## Results

| Engine | Browser suites | Full `bun run test` |
| --- | --- | --- |
| Chromium 156.0.8078.4 | 115 pass, 0 skip, 0 fail, 77 s | 846 pass, 4 existing skip, 0 fail, 269 s |
| Firefox 157.0 | 115 pass, 0 skip, 0 fail, 123 s | 846 pass, 4 existing skip, 0 fail, 328 s |
| WebKit 27.2 | 110 pass, 5 skip, 0 fail, 86 s | 841 pass, 4 existing + 5 engine skip, 0 fail, 296 s |

`conformance-renderer-browser.test.tsx` passes every renderer browser case in
all three engines, including arrival/rejection, interactions, hydration,
overlays, text bounds and styled-state reachability. The six browser files share
`src/__tests__/fixtures/browser.ts`, the single `LIVEFRAME_BROWSER` engine
parameter.

## Styling proof

`platform_floor_features_compute` passes in all three engines: `@starting-style`,
container queries, `:user-invalid`, `:popover-open`, `backdrop-filter`,
`font-size-adjust`, `color-mix(in oklab, ...)` and `text-wrap: balance`.
`overlay_enters_from_rest` proves the `@starting-style` entry in all three.
`scrollbar-color` is supported in all three (`CSS.supports` true); its computed
pair and the `::placeholder` colour with `opacity: 1` pass in all three.
Reduced-transparency recovery is proved in all three through the host's
`data-lf-transparency="reduced"` scope attribute, including the `{ role, alpha }`
and `none` cases.

Two limitations are recorded, not skipped silently:

- **WebKit forced colours.** Playwright WebKit 27.2 on Linux reports
  `(forced-colors: active)` after `emulateMedia`, but the WPE build does not apply
  the UA forced-colour mapping and does not expose `forcedColorAdjust`. The five
  forced-colour-only browser cases are skipped on WebKit; Chromium and Firefox
  prove those rules. Alpha, reduced-transparency and placeholder checks still run
  on WebKit, but their forced-colour expectations are asserted only where the UA
  mapping exists. This is a Playwright WebKit/Linux limitation, not a library
  defect.
- **Backdrop screenshot.** Headless WebKit 27.2 and Firefox 157 accept and compute
  `backdrop-filter`, but do not paint it in element or full-page screenshots. The
  computed value is asserted in all three; the pixel-difference check runs only
  in Chromium. The blur/opacity contract remains covered by the computed value
  and by the Chromium raster proof.

WebKit's headless frame pacing also measured 18–22 ms for the two-surface CSS
switch, above Chromium's 16.67 ms frame budget. The test uses a 25.1 ms
WebKit-only ceiling and records the measured values; this is not a library
budget change.

## Other-runner backlog

Task 1 decided against a Vitest smoke run because both blocked-peer preloads use
Bun's `mock.module`, and moving them would need Vite/Node tooling plus a second
preload mechanism. The backlog entry is narrowed to that remaining runner work.
`preloads_are_effective` proves both preloads under the only runner used: importing
`playwright` or `@modelcontextprotocol/server` fails with the preload and succeeds
without it.
