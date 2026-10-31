# Plan 021 Task 13.1 — WebKit switching decomposition and remedies

Measured 2026-10-31, after [Task 13](021-webkit-switching.md) and the
[Task 14 attempt](021-task-14-switching.md). This is diagnosis for the
remedies decision; no production code, threshold or spec meaning changed.

## Verdict

The WebKit miss has three parts, each with its own remedy:

1. **The CSS fixture measures an unrealistic page (about 6 ms).**
   `css-scope-browser.test.ts` loads no trusted primitive CSS. The proof
   host and Clay both ship that CSS, and it sizes icons
   (`proof/renderer/primitives/base.ts:22`). Without it, 102 icons render at
   760×984 px, the switched section is about 106,000 px tall, and no flex layout applies.
2. **The engine floor (about 9–10 ms).** The same DOM, with the same font
   switch and no Liveframe CSS, costs 9/9/10 ms in WebKit. A design-system
   switch changes font metrics on about 1,000 nodes, so a full restyle and
   relayout is unavoidable. No projection change can go below this floor.
   Only reducing the synchronous work can, for example by skipping
   offscreen layout with `content-visibility:auto`.
3. **Library overhead above the floor (about 2 ms median, 4–7 ms max).**
   This overhead is spread across several sources, none of which dominates:
   - container-query deferral costs 1–4 ms;
   - re-matching every rule costs about 1 ms over the floor;
   - restyling for the typography change makes up the rest.

## Method

`plans/evidence/021-task-13/interleave.ts` builds the CSS fixture from
`css-scope-browser.test.ts` in one page per variant. It then runs the
variants round-robin in one browser, so machine-load drift affects every
variant equally. Each round records five warm switches per variant. Span A
starts at the switching attribute write and ends after a forced
`root.offsetWidth`. It is split at a `getComputedStyle(root).color` read
into style and layout parts. The probe asserts more than 500 nodes, the
sample count, and finite, nonnegative timings.

| Variant | What it loads |
| --- | --- |
| `test` | The projected sheets only, as the test does today |
| `prim` | The trusted `primitiveCss`, then the projected sheets |
| `prim-nocq` | `prim` without `container-type` |
| `prim-cv` | `prim`, plus `content-visibility:auto` on `.lf_box_rule_root` (the queue rows) |
| `prim-floor` | `primitiveCss` plus a 3-rule font switch, with no Liveframe CSS |
| `floor` | The 3-rule font switch alone |

Same machine as Task 13: AMD Ryzen 9 PRO 7940HS, 16 logical CPUs, CachyOS
Linux 7.3.0-4-cachyos, Bun 1.4.4, Playwright 1.64.1, WebKit 27.2, Chromium
156, Firefox 157. A QEMU VM was running throughout, so treat absolute values
as this machine under load, not as a portability guarantee. WebKit reports
whole milliseconds.

## Results: span A, p50 / p90 / max ms over 40 warm samples

**Quieter run** (load 4.5; 13:56 local; the scratchpad predecessor of the
committed probe, identical except that `prim-cv` used
`contain-intrinsic-size:auto 90px`):

| Variant | WebKit | Chromium | Firefox |
| --- | --- | --- | --- |
| `test` | 17 / 19 / 20 | 5.6 / 6.0 / 6.7 | 6 / 8 / 10 |
| `prim` | 11 / 14 / 17 | 5.7 / 6.1 / 9.0 | 7 / 8 / 10 |
| `prim-cv` | **8 / 10 / 12** | 3.5 / 4.3 / 6.7 | 5 / 6 / 7 |
| `prim-floor` | 9 / 9 / 10 | 3.7 / 3.7 / 3.8 | 5 / 5 / 8 |

An earlier run in the same series, at load 5.5, measured WebKit `prim-nocq` at
13/17/19 against `prim` at 14/19/20, and `floor` at 10/15/21.

**Loaded run** (load 5.1 rising to 8.3; 14:23 local; the committed probe;
raw logs are local-only in `evidence/021-task-13/interleave-{webkit,chromium,firefox}.log`):

| Variant | WebKit | Chromium | Firefox |
| --- | --- | --- | --- |
| `test` | 29 / 68 / 92 | 8.9 / 30.5 / 41.9 | 11 / 19 / 31 |
| `prim` | 19 / 44 / 62 | 10.9 / 32.8 / 44.1 | 11 / 20 / 27 |
| `prim-nocq` | 20 / 43 / 65 | 10.0 / 14.9 / 19.4 | 12 / 20 / 28 |
| `prim-cv` | 14 / 28 / 38 | 6.2 / 10.2 / 12.5 | 8 / 9 / 18 |
| `prim-floor` | 13 / 26 / 34 | 5.8 / 7.8 / 10.5 | 7 / 12 / 46 |
| `floor` | 14 / 54 / 118 | 5.1 / 8.3 / 18.9 | 6 / 11 / 29 |

Under load, every engine's tails grew, but the ordering held:
`test` > `prim` > `prim-cv` ≈ `prim-floor`. This shows the remedies' relative
effect. It is not a basis for absolute claims. Task 14's acceptance
measurements must be taken without concurrent VM or benchmark load.

## Decomposition (earlier scratchpad probe, `test` fixture, WebKit, quieter run)

These are median/max, with a style/layout split at the computed-colour read:

| Switch | Style | Layout | Total |
| --- | --- | --- | --- |
| Both attributes, certified ↔ rack | 10 / 16 | 7 / 9 | 18 / 25 |
| To an identical renamed copy (re-match only) | 5 / 9 | 0 / 0 | 5 / 9 |
| Colours only | 6 / 9 | 0 / 1 | 6 / 9 |
| Typography only | 11 / 15 | 8 / 8 | 18 / 23 |
| Typography sizes only, same families | 11 / 18 | 8 / 26 | 19 / 44 |
| No `font-size-adjust` | — | — | 20 / 28 (no gain) |
| Floor with fonts through `var()` | 4 / 6 | 8 / 10 | 12 / 16 (no `var()` cost) |

## Remedies (for the decision log)

- **R1** Load the trusted primitive CSS in both switching fixtures.
- **R2** Add a token-constrained `deferOffscreen` style prop
  (`content-visibility:auto` with a design-value placeholder), and opt the
  queue rows in.
- **R3** Projection trims, each kept only on interleaved A/B evidence.
- **R4** Replace container queries with a renderer breakpoint attribute,
  but only if R1 to R3 leave WebKit span A above 14 ms max.

The selector-doubling mutant in Task 14 cannot fail reliably, because selector
work is about 1 ms. The replacement mutant removes `deferOffscreen` from the
fixture rows.

## Regeneration

```sh
LIVEFRAME_BROWSER=webkit PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 \
  timeout 300s bun --conditions liveframe:source plans/evidence/021-task-13/interleave.ts
LIVEFRAME_BROWSER=chromium timeout 300s bun --conditions liveframe:source plans/evidence/021-task-13/interleave.ts
LIVEFRAME_BROWSER=firefox timeout 300s bun --conditions liveframe:source plans/evidence/021-task-13/interleave.ts
```

Pass variant names to run a subset, and set `ROUNDS` to change the sample
count (5 samples per round). The host caveats are as in Task 13.
