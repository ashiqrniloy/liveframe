# Plan 027 Task 4 — extension property cost

Regenerate with:

```sh
timeout 180s bun --conditions liveframe:source plans/evidence/027-extension-cost.ts
```

## Method

The proof Certified and Rack design systems, installed against the proof catalog.
The extended arm adds one colour extension, `sheen`, to every authored recipe (the worst case:
real use sets it on a few slots). Each arm is the full `designSystemCss` call (install
validation, cascade and projection). After 100 alternating warm-ups, 15 alternating pairs of
30 calls each; the time figure is the median of the paired ratios.

## Result (2026-11-06)

Bun 1.4.4. The host was heavily loaded by unrelated builds (load average 3–43 during the runs),
so absolute times drift between runs and only the paired ratios and the byte counts carry weight.

| Design system | No extensions | Extension on every recipe | Size growth | Paired time growth |
| --- | ---: | ---: | ---: | ---: |
| Certified | 152,457 B | 158,250 B | +3.8% | +14–27% across runs |
| Rack | 164,425 B | 170,309 B | +3.6% | +13–22% across runs |

- **Byte identity.** The no-extension sheets are byte-identical to the Task 3 baselines
  (152,457 and 164,425 B), and declaring an extension in the catalog without setting it changes
  no byte. The script and `extension-properties.test.ts` assert both.
- **Size gate (≤ +16%).** Pass, at +3.8% / +3.6%.
- **Time gate (≤ +20%, worst case).** Marginal under this load: the ratio sat between 13% and 27%
  across seven runs, centred near 21%. The absolute extra was 1.5–2.9 ms on a 10–12 ms projection.
  The extra work is proportional to the extra declaration in every rule, plus one resolve step per
  `(slot, state)`; the validation overhead was removed by building error pointers lazily.
- **No-extension path.** `bench/css.bench.ts`, alternating against a `HEAD` worktree on the same
  host: Certified 9.6–9.8 -> 10.0–10.3 ms and Rack 11.3–11.5 -> 11.7–11.9 ms (about +3%). The
  first implementation measured +20%; the per-state layer arrays, rest destructuring and
  eager pointer strings were the cause and are gone. The remaining cost is the extra property
  checks on every resolved recipe.
