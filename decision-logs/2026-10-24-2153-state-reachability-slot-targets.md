---
date: 2026-10-24 21:53
status: approved
decision_about: "State reachability on roots and affected slots"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: State reachability includes affected slots

## Decision

Plan 010 Task 7 may target a primitive root or a slot whose recipe changes for the state. Correct proof recipe mappings for states the proof controls cannot expose, preserving missing-fixture coverage and normative selector checks.

## Context

The task originally required root targets, but spec §6.4 projects slot-local states as well as root-to-slot propagation. Certified styles select-option selection; Rack and Certified also copy recipes for states that their proof controls cannot expose, such as disabled dialog close buttons. Root-only fixtures cannot prove these actual contracts.

## Approval

- Proposed by: agent
- Approved by user: Yes
- Approval evidence: "Correct mappings and allow slot targets" in response to the explicit proposal to correct unreachable proof mappings while preserving coverage and selector checks.

## Alternatives Considered

1. **Root-only targets** — rejected: excludes valid slot-local state projection already specified in §6.4.
2. **Inject state attributes from fixtures** — rejected: bypasses the app implementation rather than proving reachability.
3. **Root or affected slot, with recipe corrections** — approved: checks actual app-controlled states without weakening coverage.

## Rationale and Evidence

`src/css/design-system.ts` projects both a slot's own state and an ancestor root's state. `proof/renderer/primitives/index.tsx` uses React Aria controls whose selectable options and trigger buttons carry their own states. The proof catalog exposes no invalid-input prop, and its dialog close/popover trigger have no disabled prop. Unused copied states must not masquerade as reachable behavior.

## References

- `docs/spec.md` §6.4 and §13 — state selectors, propagation and coverage.
- `src/css/design-system.ts` — authoritative selectors and declaration comparison.
- `proof/styles/{certified,rack}/design-system.ts` — copied state recipes.
- [React Aria interactions](https://react-aria.adobe.com/quality) — hover, press and focus attributes, retrieved through Context7.

## Consequences

- Fixtures must target a matching kind/variant root class or an affected slot class and reach the actual selector.
- No format, public export or spec meaning changes. Future controls that expose these removed states can add their recipes and fixtures together.
- Browser evidence remains bounded to the browsers actually tested.
