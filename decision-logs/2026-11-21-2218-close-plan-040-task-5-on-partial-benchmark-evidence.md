---
date: 2026-11-21 22:18
status: approved
decision_about: "Close plan 040 Task 5 on partial benchmark evidence"
proposed_by: user
explicitly_approved_by_user: true
---

# Decision: Close plan 040 Task 5 on partial benchmark evidence

## Decision

Close plan 040 Task 5 on the three recorded attempts. Carry the open quiet-host proof into the Task 8 readiness review under the [release scope decision](2026-11-20-2319-release-0-4-0-scope.md). The benchmark budgets and the below-10% whole-host CPU rule still apply.

## Context

Task 5 called for a quiet-host pass across all 15 stages. The approved scope allowed three attempts before bringing the best record to the readiness review.

## Approval

- Proposed by: user
- Approved by user: Yes
- Approval evidence: “It's fine. Close the task”

## Alternatives Considered

1. **Keep Task 5 open until a clean run.** The owner chose to close the task after the three approved attempts.
2. **Close the carried proof as well.** That requires a quiet-host result or a disposition at Task 8. The current record shows that each stage exceeded the quiet-host limit.

## Rationale and Evidence

Two attempts timed out waiting for quiet. The third ran all 15 stages, peaked at 53.6% whole-host CPU and exited 3. Fourteen stages exited 0. The validator exceeded its 1.5 µs/node limit on two rows while its stage averaged 13.1% host CPU. `bun run check` passed with 2,129 tests and six skips.

## References

- [Benchmark attempts](../plans/evidence/040-bench-attempt-best.md)
- [Plan 040](../plans/040-Phase-7-Part-AA-Release-0-4-0.md)
- [Acceptance log](../plans/evidence/040-acceptance.md)

## Consequences

The 28 benchmark acceptance rows, both backlog entries, plan 025 Task 8, plan 036 F12 and plan 037 F5 remain open. Task 8 still requires a release readiness decision, and a quiet-host performance claim requires a clean run.
