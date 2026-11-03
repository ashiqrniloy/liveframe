# Plan 024 baseline: quiet-host `bun run bench` (not recorded)

- Plan-start commit: `6886e4b3d5f7b51e500df89963377f925f869af9` (plan 023 T10).
- Rule: run `timeout 600 bun run bench` once, only when the 1-minute load average is below 2.

## Attempts

| When (UTC) | `uptime` | Result |
|---|---|---|
| 2026-11-03 12:34 | `load average: 14.40, 13.17, 14.03` | Not run. Load is 7× the limit. |
| 2026-11-03 12:42 | `load average: 13.20, 14.85, 14.70` | Not run. The cause is unchanged (below). |

The load is not from this work. On the 16-CPU host, a `qemu-system-x86` VM that has run for 2 days 21 hours holds about 400% CPU, with a second QEMU thread at about 60%. A browser and `tilt` add smaller amounts. The 15-minute average was already 14.03 when the plan started, so the host was not going to settle within the task. Nothing was stopped, since the VM is not this plan's to stop.

## Consequence

The host did not get quiet, so every later task in plan 024 relies on `bench/ab.ts` paired ratios alone, with load averages recorded in each A/B record (plan 024 Task 1 fallback). `bun run bench` micro-timing gates are not evidence on this host: plan 022 and plan 023 saw them fail at load 6–39 on code that passed the same gates unloaded.

## Harness check (not a baseline)

`bun bench/ab.ts HEAD~1 bench/css.bench.ts --runs 3 -- --runs 30`, run at load 14–16, to prove the driver only: it created and removed its worktree, alternated base and head, and printed medians and paired ratios (`styleDeclarations.usPerNode` 1.098 → 0.7915, ratio 0.781, which is noise: this task changed no `src/`). The ratios from that run carry no meaning.

## To close the backlog entry

On an idle host (`uptime` below 2), run `timeout 600 bun run bench`, append the output and the `uptime` line here, and then close "Re-run the full benchmark suite on a quiet host" in `plans/backlog.md`. Plan 025 Task 8 owns that entry.
