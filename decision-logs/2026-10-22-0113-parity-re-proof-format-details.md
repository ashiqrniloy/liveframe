---
date: 2026-10-22 01:13
status: approved
decision_about: "Format details and parity bar for the Phase 0 re-proof"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: The re-proof uses `size` design values, app-declared value names, and a ≤ 1% pixel bar plus an approved difference inventory

## Decision

Three details are settled for the Phase 0 parity re-proof (Plan 002) and written into spec §6.2, §6.3 and §12:

1. A fixed track uses a `size.*` design value: a `size` is a bounded length the design system owns (`size.rail: 352`), and it may appear in `width`, `height`, `minWidth`, `maxWidth` and grid tracks.
2. The app declares the design-value names style props may reference (`space.*`, `radius.*`, `size.*`, breakpoints), as §6.1 declares required roles. A design system missing a declared name fails validation, and `radius` accepts the declared radius names.
3. The parity bar is a pixel mismatch of **≤ 1% at every compared width**, and every remaining DOM or style difference listed as intended with a reason, approved by the owner.

## Context

Plan 001 proved the model but failed §12's parity criterion: the agent-home queue differed by 36.85% / 35.75% / 49.64% of pixels at 1440 / 1024 / 390 px, plus 192 DOM paths (`decision-logs/2026-10-22-0033-phase-0-conditional-go.md`). The follow-up plan needed a target for three things the spec left open:

- the artifact's rail is `grid-template-columns: minmax(0, 1fr) 22rem` (`agent-home-certified.html:557`), and `rem` is not a design value;
- responsive values and `size` values need a closed vocabulary, or the validator cannot reject undeclared names;
- "every difference intended" could swallow a large pixel gap if it were the only criterion.

## Approval

- Proposed by: agent, while drafting `plans/002-Phase-0-Parity-Re-Proof.md`
- Approved by user: Yes
- Approval evidence: the owner answered each of the three questions in the draft session on 2026-10-22, and Plan 002 Task 1 records the answers as owner decisions. The user then asked for Task 1 to be completed as written.

## Alternatives Considered

1. **Approximate the 22rem rail with `ch`** — rejected by the owner. `ch` depends on the loaded font, so it cannot reach pixel parity with the artifact.
2. **A fixed library vocabulary of value names** — rejected by the owner. It would settle part of spec §15 (whether `space.*` is a fixed library vocabulary or app-defined) before Phase 1, on no evidence.
3. **"≤ 1% pixels or every difference intended"** — rejected by the owner. It would let a large pixel gap pass as intended.

## Rationale and Evidence

- The artifact's rail is a fixed length the design system owns; `size` types it without making it a spacing step or a raw length (`docs/spec.md` §6.2).
- Declaring value names keeps every style-prop input closed data, so law 3 still holds: the validator rejects an undeclared `space.*`, `radius.*` or `size.*` name at install time, not at render time.
- The two-part bar separates a measurable threshold from the judgement call. A gap under 1% is not automatically acceptable, and a gap over 1% cannot be excused as intended.

## References

- `docs/spec.md` §6.2, §6.3, §12: the edited sections.
- `plans/002-Phase-0-Parity-Re-Proof.md` Task 1: the task and its acceptance criteria.
- `decision-logs/2026-10-22-0033-phase-0-conditional-go.md`: the conditional go this refines.
- Synapta `design-artifacts/approved/agent-home-certified.html:557` (the `minmax(0, 1fr) 22rem` rule), `:988–991` (its `max-width: 900px` fallback), `:654` (the sticky focus card).

## Consequences

- Both design systems must define every declared name, including `size.rail` or its equivalent; completeness checking now covers values as well as recipes.
- Spec §15's portability question (fixed vocabulary versus app-defined) stays open; declared names do not settle it.
- The re-proof must produce a DOM and style difference inventory for owner approval, not only a pixel number.
- Revisit if a compared width cannot reach ≤ 1% without a raw length, or if declaring value names proves unable to express a needed layout.
