# Plan 027 Task 5 — variant axis cost

Regenerate with:

```sh
timeout 300s bun --conditions liveframe:source plans/evidence/027-axes-cost.ts
```

## Method

The proof Certified and Rack design systems against the proof catalog, with the `button` given two
axes (`src/__tests__/fixtures/axes.ts`): 4 variants × 3 `tone` values × 2 `emphasis` values = 24
combinations. The design system adds one overlay per non-default axis value; the tone overlays are
role aliases (`accent.fill` and `accent.fill.hover` to a status role). Each arm is the full
`designSystemCss` call (install validation, cascade, alias rewrite and projection). After 100
alternating warm-ups, 15 alternating pairs of 30 calls; the time figure is the median of the paired
ratios. Bun 1.4.4, load average 5–14 from unrelated work, so only ratios and byte counts carry weight.

## Result (2026-11-06)

| Design system | No axes | Axes declared, no overlay | With overlays | Button rules (4 → 24 combinations) | Per added combination |
| --- | ---: | ---: | ---: | ---: | ---: |
| Certified | 152,457 B | 291,341 B | 311,845 B (+104.5%) | 46,521 → 205,739 B | 7,961 B |
| Rack | 164,425 B | 315,004 B | 338,393 B (+105.8%) | 51,297 → 225,081 B | 8,689 B |

- **Gate (a), byte identity.** Kinds without axes project the same bytes: both reference sheets are
  152,457 B and 164,425 B (the pinned baselines in `css-design-system.test.ts`), and `bench/css.bench.ts`
  alternating against a `HEAD` worktree on the same host measured Certified 9.9–11.3 → 10.2–11.4 ms
  and Rack 11.5–13.1 → 11.9–12.3 ms (within noise, about +1–4%). Resolved keys and classes of kinds
  without axes are unchanged (`kinds_without_axes_keep_classes_and_resolved_keys`).
- **The price of expansion.** The table is one entry per combination, so the button's entries go
  from 4 variants to 24 combinations (948 → 1,668 resolved entries). Declaring the axes costs the
  expansion alone (+91% of the sheet here, because the button is 30% of the proof sheet and has
  three slots); the overlays add about 20 KB on top. This is the cost the design accepted over
  delta layers (design §2.4). The adopter's lever is the cap: at most 256 combinations per kind.
- **Gate (b), projection time ≤ 1.1× linear extrapolation.** Measured against the per-entry cost of
  the no-axes sheet: Certified 1.04×–1.06×, Rack 0.93×–0.97× (two runs). The extrapolation is
  conservative: the no-axes cost includes fixed per-document install work, so the marginal
  per-entry cost is lower than the figure used.
- **Gate (c), validator and render.** Axes add no per-node validator work: the tree validator
  already checks the prop and does not read `axes`. `<Surface>` computes axis values only for a
  definition that declares them (`definition.axes ? … : undefined`). The 2% `agent-home` bench is
  re-run with the whole-plan `bun run bench` in Task 8.
- **Gate (d), warm switch ≤ 16.67 ms.** `css-scope-browser.test.ts` runs the two-surface switch with
  the 24-combination button installed (960 nodes): library time 3.5–5.7 ms per sample against
  3.6–5.6 ms without it, in Chromium, over three runs. Unused combinations' rules never match, so
  the switch recalculates only the classes in the markup.
