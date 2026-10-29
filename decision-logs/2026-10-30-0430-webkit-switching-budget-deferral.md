---
date: 2026-10-30 04:30
status: approved
decision_about: "Defer the headless WebKit switching budget issue for 0.2.0"
proposed_by: user
explicitly_approved_by_user: true
---

# Decision: Defer the WebKit switching budget issue

## Decision

Defer the headless WebKit switching budget issue for 0.2.0. Keep the normative 16.67 ms budget, disclose the limitation in the changelog and retain investigation in the existing P1 performance backlog. Fix the migration guide's four missing security reminders.

## Context

Plan 020 Task 8 found that the headless Linux WebKit switch measured 18–22 ms and tests allow 25.1 ms. Passing that test does not establish the specification's 16.67 ms limit. The review also found that the migration guide omitted the required reminders about `meta`, confirmation, runner isolation and host-side `checkOffered`, although other shipped guides document them.

## Approval

- Proposed by: user.
- Approved by user: Yes.
- Approval evidence, verbatim: "Fix the migration guide omissions. Defer the webkit switching budget issue".
- This approves the two finding dispositions; it does not state a final release go or authorise a release tag.

## Alternatives Considered

1. **Investigate/fix WebKit before release** — not selected; the owner explicitly deferred it.
2. **Raise the normative budget** — not selected; deferring a miss does not establish a new performance contract.
3. **Defer the missing migration reminders** — rejected by the owner, who instructed that they be fixed.

## Rationale and Evidence

The measured WebKit limitation is recorded in `plans/evidence/019-engines.md`. Plan 020's readiness review separates the 25.1 ms test ceiling from the normative 16.67 ms budget and identifies the migration-documentation gap. The owner chose a release-specific timing deferral while requiring the documentation correction. No new timing run or causal diagnosis supports this decision.

## References

- `docs/spec.md` §12 — normative switching budget.
- `plans/evidence/019-engines.md` — measured WebKit timing and test ceiling.
- `plans/evidence/020-release-readiness-review.md` — R1 and R4 findings.
- `plans/backlog.md` — existing P1 performance investigation.
- `docs/migration-0.2.md` — security reminders.
- `CHANGELOG.md` — release limitation.

## Consequences

- WebKit's switching budget remains unmet and requires investigation and remeasurement.
- The existing tests and normative thresholds are unchanged.
- The guide and changelog change the shipped documentation, so plan 020 T7's rule requires a new verified release candidate before final release.
- Final Task 8 go/no-go and Task 9 publication remain separate.
