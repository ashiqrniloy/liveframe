---
date: 2026-11-09 21:06
status: approved
decision_about: "Close plan 032 Task 3 (quiet-host benchmark) on partial proof"
proposed_by: both
explicitly_approved_by_user: true
---

# Decision: Close plan 032 Task 3 on partial proof

## Decision

Plan 032 Task 3 is closed without one clean full `bun run bench` on a quiet host. No budget is changed or relaxed. Plan 025 Task 8 and the backlog entry "Re-run the full benchmark suite on a quiet host" stay open; the `template` 5% gate is recorded as unconfirmed on a quiet host.

## Context

Plan 032 Task 3 required one sequential run of every bench stage on a quiet host, to prove the published budgets and to close plan 025 Task 8, which 0.2.3 shipped without (see `decision-logs/2026-11-04-2116-release-0-2-3-with-quiet-host-proof-open.md`). The host is a shared workstation: Rust builds, a memory benchmark and two QEMU VMs from other projects ran throughout. The owner stopped the VM workload; the builds and the memory benchmark came back, including mid-run.

The owner defined quiet as whole-host CPU below 10%. On this 16-CPU host one bench stage already uses about 1.2 cores (about 7.5%) and the idle desktop about 0.4–0.5 cores (about 3%), so the margin under that rule is thin even with no other work.

## Approval

- Proposed by: both (the agent proposed closing on partial proof; the owner asked to close the task).
- Approved by user: Yes
- Approval evidence: "Let's close this task and move on", then the owner chose "Close on partial proof (Recommended)" from the options listed in the exact wording above.

## Alternatives Considered

1. **Keep retrying until a clean run** — attempts 1 and 2 of the retry loop ended not quiet (peaks 23% and 57%); the outcome depends on when other projects stop work, which the agent does not control.
2. **Close and also close plan 025 Task 8** — rejected: it would record a proof that was not obtained.
3. **Close, with a post-release quiet-host re-run in 0.3.1** — not chosen by the owner.
4. **Define quiet as host CPU excluding the benchmark** — offered, not chosen; the owner's definition (below 10%, benchmark included) stands.

## Rationale and Evidence

What was proved:
- The harness works and is reusable: `scripts/bench-quiet.ts` runs every stage independently (the `&&` chain stopped at the first failure and never reached the host, pack-libraries and runner benches), measures whole-host CPU from `/proc/stat` per stage and per 5 s, and records a stage as `pass` only when it exited 0 and the host stayed under 10%. It also spins the CPU for 5 s first: the host's `powersave` governor made the first measurement after a pause read about 1.7× slow (`agent-home` 2.2 against 1.3 µs/node), a harness effect and not a code one.
- Best attempt (`plans/evidence/032-bench-attempt-best.md`, peak host CPU 23.0%): `validator` (9.7% CPU) and `streaming` (8.1%) were quiet and passed every gate, including `agent-home` ≤ 1.5 µs/node, 50 distinct `when` ≤ 1.75, `applyPatch` ≤ 0.5 ms and `compileValidator` ≤ 0.25 ms. The other seven stages were not quiet (10.9–20.4%).
- A plan 030 budget failed on a quiet host and was fixed in code: "render with libraries within 5% of bundled" failed 4 of 13 runs. The measurement was moved to seven fresh processes with A-B-B-A blocks and the median ratio (limit still 5%). That showed a real 4–5% overhead, from `collectLibraries` running twice per render; `inProcessRunner.render` now passes the verified set to a new internal `renderModule` (`src/preview/in-process.ts`). After the fix 30 of 30 runs passed, ratio 0.994–1.048. Full `bun run check`: 1,758 pass, 4 skip, 0 fail.

What was not proved:
- No single run had every stage quiet, so "every budget met on a quiet host" is not established. Runs in the first attempt (before the retry loop) and the best attempt had the other stages (`render`, `css`, `template`, `stream-elements`, `host`, `pack-libraries`, `runner`) exit 0 or fail only while not quiet; their budgets are therefore evidenced on a loaded host only.
- `template`: `templateRunner` read 5.44% over `renderTemplate` against a 5% budget at 14.4% host CPU (attempt 1; the same stage exited 0 in an earlier not-quiet record). It is the same thin-margin ratio gate as `pack-libraries` and was not re-checked on a quiet host.
- Plan 025 Task 8's `check` and pack-time comparison requirements are unchanged by this decision.

## References

- `scripts/bench-quiet.ts` — the harness (exit 0 clean, 1 failed on a quiet host, 2 never quiet, 3 not quiet).
- `plans/evidence/032-bench-attempt-best.md`, `plans/evidence/032-bench-attempt-not-quiet.md` — the two attempt records kept.
- `plans/032-Phase-7-Part-S-Release-0-3-0.md` Task 3 notes; `plans/backlog.md` "Re-run the full benchmark suite on a quiet host".
- `decision-logs/2026-11-04-2116-release-0-2-3-with-quiet-host-proof-open.md` — the earlier exception.
- `src/preview/in-process.ts`, `bench/pack-libraries.bench.ts` — the fix and the reworked gate.

## Consequences

- `plans/evidence/032-bench.md` does not exist, so the 36 bench-backed rows of `plans/evidence/032-acceptance.md` stay `pending`; the release-readiness review (Task 6) must list them as deferred with this decision, not as `pass`.
- The release notes must not claim a quiet-host performance proof.
- Revisit when the host is genuinely idle: run `bun scripts/bench-quiet.ts --out plans/evidence/032-bench.md`, then regenerate the acceptance log. A stage failing on a quiet host reopens the owning plan's task. Check the `template` 5% gate first.
