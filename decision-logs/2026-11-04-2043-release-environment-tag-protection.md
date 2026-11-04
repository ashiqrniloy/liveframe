---
date: 2026-11-04 20:43
status: approved
decision_about: "Release environment protection"
proposed_by: both
explicitly_approved_by_user: true
---

# Decision: Protect the release environment with a reviewer and tag rule

## Decision

The GitHub `release` environment requires reviewer `ashiqrniloy` and accepts only tags matching `v*`. Workflow dry runs must also be dispatched on a matching tag.

## Context

Plan 025 Task 9 requires environment protections before publishing `0.2.3-rc.1`. The authenticated administrator's environment API initially returned zero environments. The publish workflow already declares `environment: release`.

## Approval

- Proposed by: agent, using Task 9's alternatives.
- Approved by user: Yes.
- Approval evidence: “Reviewer ashiqrniloy + v* tags”.

## Alternatives Considered

1. **Reviewers only** — permits branch dry runs but does not restrict environment deployments to release tags; not selected.
2. **No environment protection** — does not meet the release requirement; rejected.

## Rationale and Evidence

Required review and a `v*` tag policy enforce the selected release boundary in repository settings. `gh api repos/ashiqrniloy/liveframe/environments/release` confirms the reviewer and policy protections; `gh api repos/ashiqrniloy/liveframe/environments/release/deployment-branch-policies` confirms one rule, type `tag`, name `v*`.

## References

- `plans/025-Phase-7-Part-L-Release-0-2-3-Simplification-And-Release.md`, Task 9.
- `docs/compatibility.md`, Release process.
- `.github/workflows/publish.yml`, protected job and tag trigger.
- `plans/evidence/025-release-candidate.md`, pre-publish checks and owner confirmation of npm's trusted publisher.

## Consequences

- The publish job requires environment approval on release tags.
- Branch-based dry runs cannot enter this environment.
- Self-review remains allowed so the sole owner can approve; administrator bypass retains its default setting.
