# Plan 021 Task 10: full-check failure diagnosis

Task 10 is complete. After the owner terminated competing build and VM workloads, the full check, validator benchmark and archive gate all passed. This record preserves the earlier diagnosis and the proof-host error-boundary fix; runtime deadlines, switching budgets and the tree-patch contract remain unchanged.

## Findings

| Failure | What is established | Action |
| --- | --- | --- |
| `bound_reason_is_completed_logged_once_and_does_not_rerender` | The original log contains `Render exceeded 100 ms` from `proof/host/pages.ts` → `src/preview/in-process.ts`. The runner measures elapsed wall time across module loading/evaluation and rendering. The proof host supplies no timeout override, so the documented 100 ms default applies. | Keep the default. Rerun on an uncongested worker; if cold renders still exceed it there, profile loading and rendering separately. |
| `tier_one_stays_local_and_tier_two_preserves_focus_scroll_and_local_state` and the certified Clay browser case | The original failures occur at page readiness/navigation, before interaction assertions. Both host tests and both Clay cases pass in focused runs, including the pre-Task-10 checkout. The original log lacks request status/timing traces, so the exact stalled request for each timeout cannot be established retrospectively. | The affected tests now assert document HTTP 200 before waiting for hydration. A rejected render therefore fails immediately as HTTP 500 rather than looking like a hydration timeout. Capture network timings/page errors if an HTTP-200 readiness timeout recurs on a quiet worker. |
| Extra `goto: Target page, context or browser has been closed` error | A rejected GET handler was handed to Bun's default error path. A minimal reproduction and a real failing-widget regression both show that Bun 1.4.4 fails the active test while its asynchronous request is still pending; cleanup then causes a secondary error. Before the fix the regression also produced an error between tests. | Fixed: the proof host's `Bun.serve` now has an `error` callback, logs the cause and returns controlled JSON HTTP 500. The regression passes without an unhandled rejection. |
| `switch_under_budget_with_blur_through_surface` | Original full-run maximum: 23.3 ms, against 16.67 ms. Focused current checkout: 34.7 ms. Pre-Task-10 checkout: 45.2 ms. | This is an existing performance-gate failure, not a newly introduced patch-only failure. Keep the budget and diagnose on an uncongested worker. |
| `switch_under_budget_with_blur` | Original full-run maximum: 70.7 ms, against 16.67 ms. Focused current checkout: 28.0 ms. Pre-Task-10 checkout: 38.6 ms. | Same action. Tasks 13–14 already specify the required style/layout versus probe measurement split; those tasks remain incomplete. |

The switching tests currently time both the style switch and four computed-style property reads for every node: 686 nodes through `<Surface>`, 956 in the CSS harness. They assert the **maximum** of ten warm samples. The `requestAnimationFrame` waits are outside the timed span, so their comments about headless frame pacing do not establish the cause of the measured cost. A browser trace or the planned split is needed to distinguish actual style/layout work, probe overhead and scheduling delays. The baseline comparison proves these failures exist before Task 10; it does not prove that all of their cost is external load.

## Quiet-window control

With `/proc/pressure/cpu` showing `some avg10=0.00` and load average 2.17, a temporary diagnostic reused the CSS test's exact fixture and mount routine. The unchanged combined switch/probe loop measured **7.2–9.2 ms** across ten warm samples. A second loop forced `root.offsetWidth` immediately after the attribute changes, then timed the existing computed-style probe separately: **5.8–7.3 ms** for style/layout and **1.6–1.8 ms** for the probe. Both waits for animation frames remained outside the timed work. This was a Chromium-only diagnostic, not Task 13's cross-engine measurement or a change to the budget definition.

The actual, unchanged switching tests then **both passed**: maximum **10.2 ms** through `<Surface>` and **10.8 ms** in the CSS harness, against the original **16.67 ms** threshold. Command:

```sh
timeout 120s bun test --conditions liveframe:source src/__tests__/react-browser.test.tsx src/__tests__/css-scope-browser.test.ts -t switch_under_budget_with_blur
```

The subsequent validator benchmark encountered another load burst (load rose from approximately 2 to 51.68) and exited nonzero on existing validator timing gates. Its patch-specific medians still passed: `diffTrees` **0.5984 ms**, `applyPatch` **0.1328 ms**. No switching, validator or runner deadline code changed between the failing and passing measurements. Together with the baseline and pressure readings, this strongly supports environmental contention as the source of the observed timing spikes. It does not replace full-suite or cross-engine verification. A brief lull is insufficient for the complete check; a worker must remain uncongested for the entire run.

## Resource evidence and limits

During the failed full check, observed system load reached 128.88 on 16 logical CPUs. During this investigation, `/proc/pressure/cpu` reported `some avg10=78.42`; CPU, memory and I/O pressure varied substantially. Linux defines `some` as the percentage of time at least some tasks are stalled on that resource, not a per-test CPU measurement. See [the kernel PSI documentation](https://docs.kernel.org/accounting/psi.html). These observations support resource contention as a cause of intermittent deadline failures; they do not identify the exact scheduling delay in the old browser run.

A separate diagnostic process rendered the harness, git-status and rack-module fixtures 15 times each with the default runner: all 45 renders passed; maximum whole-call wall time was 23.87 ms. That observation supports load sensitivity, rather than proving a specific historical request's cause.

Do not blindly rerun the complete suite under this contention or raise thresholds to manufacture a pass. Use a dedicated/quiet test worker, pause competing VM/build jobs where appropriate, then run `timeout 1200s bun run check`. For remaining switching failures on that worker, execute Tasks 13–14's measurement split and fix the measured library cost if it exceeds the unchanged budget. The agent did not stop competing jobs during the diagnosis. The owner subsequently terminated build and VM workloads before the final successful verification below.

## Reproduction and validation

The baseline was detached HEAD `36e5626e8f668a2673cae997077f35d632312b3c` (Plan 021 Task 9), with the same installed dependencies, Bun 1.4.4 and Chromium. It excludes all uncommitted Task 10 changes. Both checkouts ran this exact focused command:

```sh
timeout 180s bun test --conditions liveframe:source proof/tests/host.test.ts proof/tests/clay-browser.test.ts src/__tests__/react-browser.test.tsx src/__tests__/css-scope-browser.test.ts -t 'tier_one_stays_local|bound_reason_is_completed|clay_panels_hydrate|switch_under_budget_with_blur'
```

Each produced 4 passes and the same 2 switching failures. Baseline took 38.25 s, current checkout 16.15 s; environment conditions varied between runs, so these are diagnostic comparisons, not a throughput regression benchmark.

The new `page_render_failure_returns_500_without_an_unhandled_rejection` test failed before the handler fix (1 failure plus 1 error between tests), then passed after it. Final focused validation:

```sh
timeout 180s bun test --conditions liveframe:source proof/tests/host.test.ts proof/tests/clay-browser.test.ts
timeout 120s bun run typecheck
timeout 60s bunx --no-install biome lint proof/host/server.ts proof/tests/host.test.ts proof/tests/clay-browser.test.ts
timeout 60s bunx --no-install biome format proof/host/server.ts proof/tests/host.test.ts proof/tests/clay-browser.test.ts
```

Host/Clay tests: **13 passed, 0 failed**, including the negative regression and HTTP-status checks (9.92 s). Typecheck, focused lint and formatting checks passed. At this stage of the investigation, only focused checks had passed. The switching blockers reproduced on the pre-Task-10 checkout and subsequently passed unchanged in the quiet-window control; the final successful full-suite verification follows.

Bun's [documented server error callback](https://github.com/oven-sh/bun/blob/main/docs/runtime/http/error-handling.mdx) was checked through Context7 before implementation. The reference runners' default elapsed-time limit remains unchanged.

## Final verification after the owner stopped competing workloads

```sh
timeout 180s bun --conditions liveframe:source bench/validator.bench.ts
timeout 1200s bun run check
timeout 600s bun run release:gate
```

- Validator benchmark: **all gates passed**, including median `diffTrees` **0.5185 ms** (≤ 1.5 ms) and `applyPatch` **0.1015 ms** (≤ 0.5 ms), on the 679-node, 50-row LF-17 subject. Each uses 200 warm-ups and 1,000 measured samples. Next trees are fresh objects; their copying is outside the diff timing.
- Full check: **876 passed, 4 skipped, 0 failed** (880 tests, 109 files, 273.11 s; exit 0). Build, generation checks, typecheck, lint and formatting passed. The failing-widget regression and the originally failing host, Clay, preview and switching cases all passed with their original limits. The four pre-existing reference-fixture skips are unchanged.
- Archive gate: **13 of 13 steps passed** in 6.3 s, including installed public-export patch vectors and bundle checks.
- Machine: Bun 1.4.4; Linux 7.3.0-4-cachyos; AMD Ryzen 9 PRO 7940HS; 16 logical CPUs. Benchmark load started at 3.28/12.45/17.45 and ended at 2.93/12.08/17.27. CPU pressure was 0% at the start of verification; load stayed low through the full check (about 1–2).

This closes Task 10's verification blocker. Task 11's streaming measurements and Tasks 13–14's cross-engine work remain separate, unexecuted tasks.
