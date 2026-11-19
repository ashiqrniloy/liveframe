---
date: 2026-11-17 12:55
status: approved
decision_about: "What a surface draws after a rejected arrival, as an opt-in"
proposed_by: agent
explicitly_approved_by_user: true
---

# Decision: `<Surface invalid="keep-last">` keeps the last accepted tree, stale and silent

## Decision

`<Surface>` gains `invalid?: "fallback" | "keep-last"`, default `"fallback"` (unchanged behaviour). With `"keep-last"` and an accepted tree on record, a rejected arrival keeps the last accepted tree mounted (focus, scroll and uncontrolled input survive), the wrapper carries `data-lf-stale` and `aria-busy="true"`, and the kept tree raises no intents and writes no local state. Without an accepted tree the fallback is drawn. No node of the rejected tree is ever drawn, and nothing is styled.

## Context

Review finding A4 (2026-11-15, plan 033) and plan 035 Task 5. Spec §11 required a renderer to draw "its app's `fallback` for the whole surface when `snapshot().valid` is false, never part of an invalid tree and never nothing". When an agent streams revisions, one malformed frame blanks the whole surface and drops focus, scroll and typed input, even though the core already keeps the last accepted `tree` and `root` across a rejection (`src/surface/core.ts`, `stage` → `rejected`), and `emit` already returns early while the surface is invalid.

## Approval

- Proposed by: agent (plan 035 Task 5 proposal).
- Approved by user: Yes.
- Approval evidence: on 2026-11-17, asked to approve the opt-in with `data-lf-stale` and `aria-busy="true"`, the owner selected "Approve as proposed (Recommended)".

## Alternatives Considered

1. **Make keep-last the default** — changes what every existing host shows; the conformance suite pins the fallback. Not selected.
2. **Keep the last tree interactive** — every intent would be refused by the host as `version-conflict`, because the host's latest frame is the rejected one. Not selected.
3. **Leave it to hosts** — a host can hold back an invalid tree only by validating twice; the surface already has the answer. Not selected.
4. **HTML `inert` on the kept tree** — removes focus, contradicting the goal of keeping it. "Inert" here means it raises nothing.
5. **Mark only `data-lf-stale`, no `aria-busy`** — offered; the owner kept `aria-busy` so assistive technology knows the content is not current.

## Rationale and Evidence

- Law 2 holds: what stays on screen passed validation; the rejected tree never reaches drawing.
- Law 4 and the host's authority hold: while the surface is invalid, `emit` returns before any intent or `setLocal` write (`src/surface/core.ts`, `emit`), so a host never receives an intent from a frame it has replaced.
- No core change: the rejected snapshot already carries the previous `tree` and `root`.
- `aria-busy="true"` (WAI-ARIA 1.2) marks a region whose content is being updated; assistive technology may wait until it is cleared. Risk: if the stream stops after a rejection, the region stays busy until the next accepted arrival; the host can see the rejection through `onEvent` (`arrival-rejected`).

## References

- `docs/spec.md` §11 (`core.accept`, `SurfaceSnapshot`).
- `src/surface/core.ts` (`stage`, `emit`), `src/react/renderer.tsx` (`Surface`).
- `plans/035-Phase-7-Part-V-Browser-Renderer-Cost-And-Resilience.md` Task 5.
- `src/conformance/react/browser.tsx` (`invalid_arrival_shows_only_the_fallback_and_recovers`).

## Consequences

- Spec §11's fallback rule gains one opt-in exception; the default and the conformance case are unchanged.
- `SurfaceProps` widens (registered on `createRenderer` in `register-0.3.1.json`).
- Revisit if hosts need the kept tree visibly dimmed by default, or a timeout after which keep-last falls back.
