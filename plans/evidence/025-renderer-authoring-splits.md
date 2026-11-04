# Plan 025 Task 5 — renderer and authoring closure splits

Executed 2026-11-04 against starting commit `c813db7c80b03542ea18e487d96c8ba7de360634`.

`src/react/renderer.tsx` keeps every hook in the factory's `Surface` component, with the same dependency arrays. Module-level `acceptTree` handles the accepted-tree transition, `settled` and `raiseIntent` handle intent delivery and confirmation, and `context` constructs and caches items using a plain `ItemContext`. The item cache lookup runs before unpacking the context, preserving the cache-hit fast path. Cached items still read the current tree, handler and confirmation through the same refs. The factory suppression stays: creating a component once at startup is the existing public contract.

`src/authoring/index.ts` moves tree bounding/remembering, scenario rendering and outcome expansion, offered setState handling, preview-session binding and capture into module-level functions over `AuthoringState`. The public methods still enter the same serial queue. Catalog, capabilities and runner retain their startup values; preview and capture configuration retain their existing option reads. A failed preview bind still clears the cached promise, and a successful binding still serves the latest packed draft.

No test, fixture, export, dependency, schema or spec meaning changed. The new selection benchmark adapts the existing production proof test without editing it, and asserts that both design systems supplied ten positive, finite timing samples.

## Compatibility and behavior

- Before and after: the five registry, surface, intent, authoring and MCP suites passed unchanged, 121 tests and 907 assertions each.
- Additional browser renderer, server renderer, object-event, renderer browser conformance and preview React tests: 88 pass, 0 fail.
- Building the starting commit in the A/B worktree and comparing `dist/react/renderer.d.ts` and `dist/authoring/index.d.ts` against this checkout with `diff -u` produced no difference. Both declarations are byte-identical.
- First full `bun run check`: build, generated-code check, types, lint, format and API gate passed; 1,048 tests passed, four skipped, one failed. The existing `in_process_warm_overhead_under_point_one_ms` test measured 0.1386 ms against its 0.1 ms limit. Final `timeout 1200s bun run check` passed all stages: 1,049 pass, four skip, zero fail across 119 files (367.37 s). Warm overhead was 0.0087 ms/render, below 0.1 ms.

## Performance

All ratios below are medians of paired checkout/base ratios from `bench/ab.ts`. The same harness runs on both sides. The limit is 1.02. Production builds exclude development-only React costs.

```sh
timeout 1800s bun bench/ab.ts c813db7 bench/streaming.bench.ts --runs 9 --metric reuseMs reactWorkMs validationAndReactMs wallMs -- --production
timeout 1800s bun bench/ab.ts c813db7 bench/streaming.bench.ts --runs 9 --metric reuseMs reactWorkMs validationAndReactMs wallMs applyMs endToEndMs -- --production --patches
timeout 600s bun bench/ab.ts c813db7 bench/selection.bench.ts --runs 9
```

Whole-tree streaming, 9 pairs:

| Metric | Base median ms | Checkout median ms | Paired ratio |
| --- | ---: | ---: | ---: |
| Node reuse | 0.2000 | 0.2000 | 1.000 |
| React work | 0.7000 | 0.7000 | 1.000 |
| Validation + React | 2.000 | 2.000 | 1.000 |
| Wall | 2.000 | 2.000 | 1.000 |

Load averages (1/5/15 minute): before 3.10 / 2.63 / 2.33; after 6.82 / 3.91 / 2.86. This is a loaded-host paired comparison, not a quiet-host absolute budget claim.

Patch streaming, 9 pairs:

| Metric | Base median ms | Checkout median ms | Paired ratio |
| --- | ---: | ---: | ---: |
| Node reuse | 0.2000 | 0.2000 | 1.000 |
| React work | 1.200 | 1.100 | 1.000 |
| Validation + React | 3.100 | 3.600 | 1.000 |
| Wall | 3.100 | 3.600 | 1.000 |
| Patch application | 0.4000 | 0.4000 | 1.000 |
| End to end | 3.700 | 4.800 | 1.000 |

Load averages: before 8.34 / 4.38 / 3.03; after 12.15 / 11.60 / 6.75. Separate side medians can drift with host load; the gate uses the median of the nine per-pair ratios, rather than the ratio of side medians.

Production selection after the cache-first change, 9 complete pairs:

| Metric | Base median ms | Checkout median ms | Paired ratio |
| --- | ---: | ---: | ---: |
| Certified React | 0.8000 | 0.8000 | 0.937 |
| Certified validation | 2.000 | 1.900 | 0.950 |
| Certified wall | 2.850 | 2.700 | 0.949 |
| Rack React | 0.8000 | 0.8000 | 1.000 |
| Rack validation | 1.900 | 1.900 | 1.000 |
| Rack wall | 2.700 | 2.700 | 1.000 |

Load averages: before 3.66 / 9.09 / 9.48; after 4.08 / 8.56 / 9.29. All selection gates pass.

Measurement history: An initial 9-pair run passed React time for both systems (1.000), but Rack validation was 1.026. A 21-pair repeat missed React time (Certified 1.045, Rack 1.154). Moving the item cache lookup before context unpacking restored the reused-node fast path. The next run completed 16 pairs before later browser test failures on both baseline and checkout invalidated the full run as host load rose from 10.55 to 34.72. No failing browser sample is counted as a timing sample.

## Final streaming confirmation

After the cache-first adjustment, repeated each production streaming mode for three complete pairs against the same starting commit.

```sh
timeout 600s bun bench/ab.ts c813db7 bench/streaming.bench.ts --runs 3 --metric reuseMs reactWorkMs validationAndReactMs wallMs -- --production
timeout 600s bun bench/ab.ts c813db7 bench/streaming.bench.ts --runs 3 --metric reuseMs reactWorkMs validationAndReactMs wallMs applyMs endToEndMs -- --production --patches
```

Whole-tree: reuse, React work, validation + React and wall ratios all 1.000. Base/checkout medians were 0.3000/0.3000, 0.7000/0.7000, 2.000/2.000 and 2.000/2.000 ms respectively. Load before 4.70 / 8.12 / 9.11; after 4.25 / 7.29 / 8.74.

Patch: reuse, React work, validation + React, wall, patch application and end-to-end ratios all 1.000. Base/checkout medians were 0.1000/0.1000, 0.8000/0.7000, 2.100/1.800, 2.100/1.800, 0.4000/0.3000 and 2.600/2.200 ms respectively. Load before 4.25 / 7.29 / 8.74; after 5.36 / 6.90 / 8.47. Both final streaming gates pass.
