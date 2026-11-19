---
date: 2026-11-19 01:54
status: approved
decision_about: "The 0.4.0 interaction additions and the restated spec §8 Rule 1"
proposed_by: agent
explicitly_approved_by_user: true
---

# Decision: Six interaction additions for 0.4.0, and "One host intent per event"

## Decision

`0.4.0` adopts the interaction design in `plans/evidence/037-interaction-design.md` as implemented by plan 037 Tasks 2–8. That covers local writes on a host intent with optional `until: "revision"` (F1), `fromLocal` on `action` and `setState` (F2), bounded scalar array carries (F3), a tree-level `focus` mark that is never applied to the first drawn tree (F4), an optional `Store.putStateIf` with four attempts in `handleIntent` (G2), and a read-only `shown` expression root whose readers are never counted (empty state). Spec §8 Rule 1 is restated as: **"One host intent per event.** An event offers either one local write (`setLocal`), or one host intent (`setState` or `action`) with optional renderer-applied `local` writes that never reach the host."

## Context

The 2026-11-15 review (findings F1–F4, G2 and the backlog item "Let a filtered list know it is empty") placed this capability work in `0.4.0` (`decision-logs/2026-11-15-1251-review-2026-11-15-scope.md`). Plan 037 Task 1 asked for one design covering all six items, approved before they were built, because F1, F2 and the empty state all extend what an intent or an expression may read. The design was written and Tasks 2–8 implemented it, but the approval was not logged. Plan 037 Task 9's impact analysis (`plans/evidence/037-impact-analysis.md`, finding F1) surfaced the gap, and the restated Rule 1 was already in `docs/spec.md` §8.

## Approval

- Proposed by: agent (the design file, and the deviations recorded in the Task 7 and Task 8 notes)
- Approved by user: Yes
- Approval evidence: on 2026-11-19 the owner answered "Approve" to: "do you approve the design in plans/evidence/037-interaction-design.md (as implemented in Tasks 2–8, including the shown-readers-are-never-counted deviation) and the restated §8 Rule 1".

## Alternatives Considered

1. **An array of intents per event** — rejected: it ends "one intent per event", and the host would have to order several effects and handle partial failure.
2. **`setLocal` with a `then` intent** — rejected: the offered-intent check would have to read through a renderer-only wrapper to find its own intent.
3. **Expressions in action `args`** (`{ $path: "local.title" }`) — rejected: `args` are literals the host compares exactly, and the host does not have the browser state an expression would read.
4. **Arrays inside object carries** — rejected for now: it reopens the 32-scalar bound and the `bindAll` fit rule together.
5. **A per-kind `autoFocus` prop, or a host-side `surface.focus(nodeId)`** — rejected: a prop applies on every mount and steals focus on re-render, and the host does not know which node the widget means.
6. **A version number from `getState`, or a store-side `updateState(fn)`** — rejected: the first breaks `getState`'s return type, and a remote store cannot run the host's function atomically.
7. **An aggregate `local` key the core writes, or documenting the `setState` workaround** — rejected for the empty state: the first needs a key the widget must never set, one per list, and the second keeps the round trip.
8. **Counting a `shown` reader as invalid-prop when another reader counts it** (the plan's first wording) — replaced by never counting readers (design E.2), which removes the cycle by construction and lets an empty row and a count badge share a parent.

## Rationale and Evidence

- Each addition is an optional field or an optional method on the existing `/1` formats. A 0.3.x validator rejects every one fail-closed, as `docs/compatibility.md` allows for a minor.
- Law 4 holds: `complete()` strips `local` and `fromLocal`, `checkOffered` rejects a posted one, and the host re-checks every value filled from local state against the capability or state schema. Law 1 holds: every addition is data the renderer evaluates under spec §8's bounded expression rules. The per-addition law table and rejection tests are in `plans/evidence/037-impact-analysis.md` §1 area 3.
- The first-tree focus rule follows the WAI-ARIA Authoring Practices guidance against moving focus on page load: persisted state or a page full of widgets must not take focus when the page loads.
- Four CAS attempts are enough to resolve a burst of four concurrent writes, and they bound latency when a store always answers `false`.
- `bun run check` passed on 2026-11-19 (1,972 pass, 9 skip, 0 fail) with every addition in place.

## References

- `plans/evidence/037-interaction-design.md` — the design, with the open questions and the reason for each answer.
- `plans/037-Phase-7-Part-X-Interaction-Capabilities.md` — Tasks 2–8 notes, including the deviations.
- `plans/evidence/037-impact-analysis.md` — the impact sweep that found the missing log.
- `docs/spec.md` §5, §7.2, §7.4, §7.6, §7.7, §8 (Rule 1), §9, §9.1, §10, §11, §13.
- `decision-logs/2026-11-15-1251-review-2026-11-15-scope.md` — places this work in 0.4.0.
- `decision-logs/2026-11-07-1756-action-results-and-local-bindings.md` and `plans/evidence/029-interaction-design.md` — the rules these additions extend.

## Consequences

- An event still raises at most one host intent. Local writes may accompany it, and a widget can show an immediate response without a second event.
- Adopters running `rendererBrowserSuite` must supply four new fixtures (`local`, `compound`, `fromLocal`, `focus`), as `docs/migration-0.4.md` says.
- Revisit if a host needs arrays inside object carries, or needs local writes to survive a refused intent in a way `until: "revision"` does not express.
