---
date: 2026-10-25 02:47
status: approved
decision_about: "Plan 002 and plan 010 final impact dispositions for plan 012 Task 1"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Phase 0 and Phase 5 carry-over dispositions

## Decision

Backlog all eight findings in the plan 002 and plan 010 impact reviews.
Close their final tasks after the required checks pass and the handoffs are
recorded. Preserve the approved Phase 0 go and every existing performance bar.

## Context

Plan 012 Task 1 requires closing plan 010 Task 10 and plan 002 Task 9.
The conformance review already had four findings; the historical parity review
identified four existing handoffs rather than new implementation work.

## Approval

- Proposed by: agent.
- Approved by user: Yes.
- Approval evidence: “Approve all eight dispositions”, 2026-10-25, in response
  to the table of plan 010 F1–F4 and plan 002 F1–F4, including the P1 dialog
  fix in plan 013 Task 5.

## Alternatives Considered

1. **Execute the findings in the carry-over plans** — not selected. The
   library ships no primitives; demo implementation and installed-package
   verification already belong to plan 013. Other work has existing scoped
   backlog entries and does not change the completed phases' Done tests.
2. **Close the gates without recorded dispositions** — rejected: both final
   tasks require the owner's answer and explicit handoffs.

## Rationale and Evidence

| Review | Finding | Approved disposition |
| --- | --- | --- |
| 010 F1 | Initially-open proof dialog is inert and cannot receive Escape | Backlog P1; demo primitives must fix it in plan 013 Task 5 before release. Proof primitive repair is optional. |
| 010 F2 | Vitest/Jest and non-Chromium execution unverified | Backlog P3; retain current Bun/Chromium evidence limits. |
| 010 F3 | Installed-demo conformance unverified | Backlog P2; plan 013 Task 6. |
| 010 F4 | No shared suite for a custom isolated runner | Retain conditional backlog P4; revisit on adopter demand. |
| 002 F1 | Composition surface gaps G30/G31 and position/basis limits | Retain existing backlog P3. |
| 002 F2 | Proof render budget and production performance stability | Retain existing backlog P1; plan 012 Task 13 measures unchanged thresholds. |
| 002 F3 | Native Windows/AT audit G29 | Retain existing P2 and R20's approved post-0.1.0 deferral. |
| 002 F4 | Synapta/Clay adoption and app-owned styling/icon gaps | Retain existing Phase 7 backlog P4. |

## References

- `plans/evidence/010-impact-analysis.md` — twelve-area review, law rejection
  evidence, passing Phase 5 Done tests and dialog reproduction.
- `plans/evidence/002-impact-analysis.md` — historical proof review and existing
  later-phase resolutions.
- `plans/012-Phase-6-Part-A-Release-Hardening-And-API-Freeze.md` Task 1.
- `plans/013-Phase-6-Part-B-Packaging-Demo-And-Release.md` Tasks 5–6.
- `decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md`
  R20 — existing G29 deferral.

## Consequences

- Both historical plan gates can close once checks pass; this approval does
  not claim the deferred work is implemented.
- The demo's initially-open dialog regression and installed-kit conformance
  remain required before release.
- Other runner/browser compatibility, native AT and production adoption remain
  unproved. Revisit the conditional work when an adopter requires it.
