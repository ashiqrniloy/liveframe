---
date: 2026-10-29 17:37
status: approved
decision_about: "Whether LF-17 streaming measurement justifies designing tree patches"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Tree patches are warranted for streaming agent surfaces

## Decision

The pre-agreed LF-17 thresholds are exceeded: the medians are 5,099 gzipped bytes per whole-tree update and 12.1 ms for arrival validation plus React commit, against limits of 1 KiB and 8 ms. Whole-tree compression therefore does not meet the streaming budget, and tree patches are to be designed. No patch format or API lands in plan 019; the design is a new task above Task 7, added only with the owner's explicit approval.

## Context

Spec §9 defers patches until a realistic measurement calls for them, and roadmap §1 applies the same rule. Plan 019 Task 1 fixed the subject and thresholds before Task 3 measured anything: a 679-node, 50-row agent-home surface at 10 revisions/s, changing one row's status per revision, with patches triggered by more than 1 KiB gzip or more than 8 ms of arrival validation plus React commit. Task 3 streamed 100 revisions through `renderElements` → whole-tree JSON → `<Surface>` arrival validation → React commit using Chromium and React's Profiler.

## Approval

- Proposed by: agent, from the Task 1 thresholds and the Task 3 measurement.
- Approved by user: Yes.
- Approval evidence: on 2026-10-29 the user wrote, "Complete - [ ] Task 3: Measure tree patches on a streaming agent surface (LF-17) and update the plan once done". The Task 1 decision log, approved with the same instruction pattern, had already fixed the exact thresholds and the consequence that patches are designed when either is exceeded. This log accepts that measured consequence; it does not approve a patch API or the new plan task, which need a separate owner approval.

## Alternatives Considered

1. **Keep whole trees and compression** — rejected: the median gzipped update is 5,099 bytes, about five times the 1 KiB budget, and validation plus commit is 12.1 ms, above 8 ms.
2. **Design patches inside Task 3** — rejected: Task 1 fixed thresholds first, and plan 019 requires a new task above Task 7 with the owner's approval before any patch API changes.
3. **Optimise React commit only** — rejected as the complete answer: better rendering would not bring the gzipped whole tree under 1 KiB.
4. **Client-side diffing of whole trees** — not selected: it leaves the transport and JSON parse cost whole-tree; the measured patch floor shows the changed data is only 8–11 bytes once a patch carries it.

## Rationale and Evidence

The measurement is in `plans/evidence/019-streaming-bench.md`:

- 117,985-byte whole-tree JSON (median), 5,099 bytes gzipped.
- 8–11 changed leaf bytes per revision, versus 5,099 gzipped bytes sent.
- 1.4 ms median arrival validation, 10.3 ms median React commit net of validation, 12.1 ms combined.
- 9.90 updates/s achieved against the 10/s target over 100 revisions.

Both independent triggers pass with margin, so the verdict does not depend on one noisy metric. The changed-value floor is recorded only as a lower bound; it does not claim that a patch reaches it. Chromium runs React's development build because the Profiler callback is only available there, so the commit figures include Profiler overhead; the gzip result alone already exceeds the budget.

## References

- `plans/evidence/019-streaming-bench.md` — machine, Bun and Chromium versions, per-revision measurements, command.
- `decision-logs/2026-10-29-1552-agent-surfaces-corpus-and-engines.md` — LF-17 subject, thresholds and approval rule fixed before measuring.
- `bench/streaming.bench.ts`, `bench/streaming-client.tsx` — the measurement and browser harness.
- `docs/spec.md` §9 — whole trees, compression before patches, patches deferred until measured.
- `docs/model.md` "Performance" — patches or compression only when a measurement calls for them.
- `roadmap.md` §1 — optimisation added only when a measurement calls for it.

## Consequences

- Plan 019 Task 3 records the measurement and this verdict; no public API changes in plan 019.
- The next action is a separate plan task above Task 7 for the patch format and API, requiring owner approval before it is written.
- Re-measure after a patch design against the same subject and thresholds; revisit a threshold only with a new measurement, never by preference.
