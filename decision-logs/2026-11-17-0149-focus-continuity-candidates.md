---
date: 2026-11-17 01:49
status: approved
decision_about: "Which elements focus continuity may move focus to"
proposed_by: agent
explicitly_approved_by_user: true
---

# Decision: Focus continuity takes candidates from the surface only

## Decision

When an update disconnects the element focused inside a `<Surface>`, focus continuity moves focus only to tabbable elements inside the surface's wrapper and portal container (next in document order, else the closest previous one, else the wrapper). The host page is never a candidate, and the pre-update snapshot reads no style or layout; a candidate must be tabbable after the update.

## Context

Review finding P4 (2026-11-15, plan 033) and plan 035 Task 2. Spec §11 said both that `focusContinuity` "keeps keyboard focus inside the surface" and that focus "moves to the next element in document order", and `tabbables()` (`src/react/renderer.tsx`) took candidates from the whole document with `getComputedStyle` and `getClientRects` per element on every update while focus was inside the surface. Plan 035 Task 1 measured the production cost at `+1.4 ms` (0 host elements), `+5.5 ms` (1,000) and `+21.8 ms` (5,000) per commit (`plans/evidence/035-browser-baseline.md`), over the owner-confirmed 0.5 ms threshold.

## Approval

- Proposed by: agent (plan 035 Task 2 recommendation).
- Approved by user: Yes.
- Approval evidence: on 2026-11-17, asked to choose the candidate scope, the owner selected "Surface only (Recommended)".

## Alternatives Considered

1. **Whole document, deferred style reads or a bounded `TreeWalker`** — keeps the "document order" reading but still reads the host page, and can move focus out of the surface. Not selected.
2. **Whole document, cached between updates** — rejected in the plan: the host page changes without telling the surface, so the cache is wrong exactly when it matters.

## Rationale and Evidence

- The spec's first statement of the contract is that focus stays inside the surface; moving it to a host element contradicts that, so the surface-only scope resolves the spec's internal contradiction in favour of its stated purpose.
- The snapshot becomes one `querySelectorAll` over the wrapper and portal container, so its cost scales with the surface, not the host page.
- Checking tabbability after the update is more correct than before it: an element hidden by the same update is skipped.

## References

- `plans/evidence/035-browser-baseline.md` — Task 1 measurements and thresholds.
- `plans/035-Phase-7-Part-V-Browser-Renderer-Cost-And-Resilience.md` Task 2.
- `decision-logs/2026-11-15-1251-review-2026-11-15-scope.md` — P4 placement.
- `docs/spec.md` §11 (`focusContinuity`).

## Consequences

- Observable change: a surface whose last tabbable element is removed now focuses the previous one (or the wrapper) instead of a host element after the surface. The 2026-11-15 scope decision puts P4 in 0.3.1 unless the decision changes behaviour; this change is treated as fixing the contradiction against §11's "keeps keyboard focus inside the surface" and is listed in `CHANGELOG.md` under Fixed. The owner confirmed 0.3.1 as a fix on 2026-11-17 (plan 035 Task 6, F7).
- Spec §11 and `docs/renderer.md` state the scope and the after-update tabbability rule.
