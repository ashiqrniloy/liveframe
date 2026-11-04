---
date: 2026-11-04 21:16
status: approved
decision_about: "Release 0.2.3 with quiet-host proof open"
proposed_by: both
explicitly_approved_by_user: true
---

# Decision: Release 0.2.3 with quiet-host proof open

## Decision

Publish 0.2.3 after the final-version release checklist passes. Retain plan 025 Task 8 and the quiet-host benchmark backlog as open; no performance threshold is relaxed and no missing proof is claimed. Task 11 remains a separate impact-review task.

## Context

The RC is published and registry-verified. Full checks pass, but Task 8 has no below-2-load full-check proof, absolute benchmark failures under load and cumulative validator/render ratios of 1.064/1.096. The previous instruction to leave quiet-host proof open did not itself authorize the final release exception.

## Approval

- Proposed by: agent and owner.
- Approved by user: Yes.
- Approval evidence: After reviewing these gaps, the owner answered “Go: release with quiet-host proof open” on 2026-11-04.

## Alternatives Considered

1. Hold publication until quiet-host evidence passes — stronger performance assurance, but delays the verified security/defect fixes; owner chose release.
2. Publish after the final release checklist and retain missing proof — chosen, with the performance uncertainty disclosed.

## Rationale and Evidence

The RC passed local/CI checks, archive and peer-floor gates, demo, signatures, provenance and the empty-register API comparison. Task 8 records performance evidence and failures rather than presenting incomplete measurements as passing gates.

## References

- [Readiness review](../plans/evidence/025-release-readiness-review.md) — all R1–R26 dispositions and open proof.
- [RC verification](../plans/evidence/025-release-candidate.md) — registry and protected CI evidence.
- [Acceptance record](../plans/evidence/025-acceptance.md) — criterion-by-criterion evidence.
- [Backlog](../plans/backlog.md) — quiet-host work retained.

## Consequences

The final release may proceed after its remaining release checks. Quiet-host performance and tight cumulative non-regression remain unproved; reproduce on a quiet host before closing Task 8. Plan 025 cannot be marked wholly complete while Tasks 8 and 11 remain open.
