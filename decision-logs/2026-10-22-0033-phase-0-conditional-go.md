---
date: 2026-10-22 00:33
status: approved
decision_about: "Phase 0 verdict and the spec §5–§6 changes it requires"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Phase 0 is a conditional go, and spec §5–§6 gain the generic capabilities the proof found missing

## Decision

The model is accepted: real product UI was built from primitives and composed TSX, with no product-shaped component. Spec §5–§6 now add `disclosure`, `semantics` and `label` on layout primitives, `current`/`pressed` on `button`, app-declared `box` variants, a theme assembled from separate colour and typography sources, responsive style values keyed by design-system breakpoints, `position`/`inset`, `fill`/`radius` on `box`, `textAlign`/button `align`, and surface-root typography. Phase 0 stays open until a follow-up plan adds these to the proof and the agent-home comparison meets its threshold. Phase 1 starts only after that.

## Context

Plan 001 built the four §12 reference UIs on the 23 candidates. All four rendered with no new primitive, no raw CSS and no literal colour. All three interaction tiers worked, and the Certified↔Rack switch needed no widget change and no widget rerun. But §12's parity criterion failed: compared with the approved artifact, the agent-home queue differed by 36.85% / 35.75% / 49.64% of pixels at 1440/1024/390 px, plus 192 DOM paths. Every difference traces to a missing generic capability, such as sectioning semantics, disclosure, responsive or sticky layout, decorated boxes, indicator fills or button alignment. None traces to a missing product component. Dynamic action-argument binding (spec §8) also turned out to be unexpressible in the §9 intent format.

## Approval

- Proposed by: agent (Plan 001 Task 12, `proof/REPORT.md` §7)
- Approved by user: Yes
- Approval evidence: the owner picked "Conditional go (Recommended)" for the Phase 0 verdict and "All proposed (Recommended)" for the spec edits, in a structured question that listed each change.

## Alternatives Considered

1. **Go**: close Phase 0 now and move the parity re-proof into Phase 4's acceptance. Not chosen: Phase 1 would freeze formats before the new props and responsive values had been proven against the real artifact.
2. **No-go**: treat the parity failure as §12 failing and redesign §5–§6. Not chosen: §12 defines failure as needing product-shaped primitives or raw styling, which never happened. The failures point to specific generic additions, not to a flaw in the model.
3. **Clarifications only**: correct the anchors and the typo, and defer §5–§6 until the re-proof. Not chosen: the spec is normative, and the follow-up plan needs a target to build against.

## Rationale and Evidence

- Synapta's grown `Queue` needed about 40 product-specific catalog fields across four catalog bumps (`synapta-harness-3` → `-6`). The proof expressed the same behaviour as widget code over unchanged primitives (`proof/REPORT.md` §5).
- Every parity finding falls under report gaps G6–G16, each with a generic resolution (`proof/REPORT.md` §6, `proof/PARITY.md`).
- The four laws held across all four UIs (`proof/REPORT.md` §10). Render budgets held: worst case 1.702 ms against 2 ms (`proof/REPORT.md` §9).
- The proposed additions are evidence-led but **not yet proven**. That is why the go is conditional.

## References

- `proof/REPORT.md`: the full report, gap table and owner decision.
- `proof/PARITY.md`, `proof/scripts/parity.ts`: the pixel, DOM and style evidence.
- `proof/GAPS.md`: per-task gap log.
- `docs/spec.md` §5, §6.1–§6.4, §8, §12, §15: the edited sections.
- `decision-logs/2026-10-21-2017-liveframe-founding-model.md`: the founding model, which this decision refines but does not supersede.

## Consequences

- Spec §5–§6 describe capabilities the proof code does not yet have. The follow-up plan (next free number in `roadmap.md` §3) must implement them in `proof/`, snapshot the artifact's fonts, and re-run `proof/scripts/parity.ts` to ≤ 1% pixel mismatch, or list every remaining difference as intended.
- The full-queue render is at 1.70 ms of its 2 ms budget, so the new props must be re-measured.
- Revisit if the re-proof needs a product-shaped primitive or raw styling to close a gap, or if responsive values can't be validated as closed data. Either result reopens §12's no-go path.
