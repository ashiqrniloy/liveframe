---
date: 2026-11-24 01:03
status: approved
decision_about: "Close plan 042 Task 7 on partial benchmark evidence"
proposed_by: assistant
explicitly_approved_by_user: true
---

# Decision: Close plan 042 Task 7 on partial benchmark evidence

## Decision

Close plan 042 Task 7 on the loaded-host benchmark record. Carry the 17 pending bench rows of the [acceptance log](../plans/evidence/042-acceptance.md) into the Task 10 readiness review. The benchmark budgets and the below-10% whole-host CPU rule are unchanged. Their replacement is LF-41's decision in plan 049.

## Context

Task 7 calls for `bun run bench` under the quiet-host rule (whole-host CPU below 10%, benchmark included) and allows a non-quiet run to close the task only through an owner decision log, as plan 040 Task 5 did. On 2026-11-24 the host was held by unrelated work: `cargo test`, a Kubernetes cluster, openfga and temporal.

## Approval

- Proposed by: assistant
- Approved by user: Yes
- Approval evidence: the owner first said, "Look this is pointless. You will not get a quiet host. Accept whatever the load is and do the test and see what happens". Asked how Task 7 should close, the owner chose "Accept partial, close".

## Alternatives Considered

1. **Leave Task 7 open until a quiet run.** Rejected by the owner. The host has not been quiet in any release since 0.2.2.
2. **Change the quiet rule here.** Out of scope. Plan 049 (LF-41) owns it.

## Rationale and Evidence

- Two default attempts timed out after 602 s without a quiet start (final samples 28.3% and 25.9%). The owner stopped the third.
- The loaded run (`--max-cpu 100`, 34–99% CPU, load 15–33) ran all 16 stages. 11 exited 0 and 5 exited 1.
- The two gates this patch adds held. The worst render the default budget allows (LF-18), the hostile `nestedMaps` template, had a median of 5.192 ms against 50 ms. All 64 LF-34 validator-cache pairs hit.
- The template stage, which plan 041 changed, passed every gate. The failures are absolute wall-clock gates that have failed under load since 0.2.2 (validator, render, css starter switch, QuickJS `none`). Two ratio gates, composed-6-layers and pack-libraries, failed and then passed on a single rerun at load 15–19.

## References

- [Loaded-host record](../plans/evidence/042-bench-attempt-loaded.md)
- [Plan 042](../plans/042-Phase-7-Part-AC-Release-0-4-1.md), Task 7 notes
- [Plan 040 precedent](2026-11-21-2218-close-plan-040-task-5-on-partial-benchmark-evidence.md)

## Consequences

The 17 bench rows of the acceptance log stay `pending`, and Task 10's readiness review must dispose of them. Neither 0.4.1 nor 0.4.0 makes a quiet-host performance claim. The backlog entry "Re-run the full benchmark suite on a quiet host" stays open.
