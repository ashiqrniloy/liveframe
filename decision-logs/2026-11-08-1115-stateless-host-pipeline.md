---
date: 2026-11-08 11:15
status: approved
decision_about: "A stateless host pipeline at @arnilo/liveframe/host"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: `/host` ships three stateless functions that fix the order of the security-critical steps

## Decision

Add the subpath `@arnilo/liveframe/host` exporting `renderPlacement`, `handleIntent` and `dependents`. They fix the order of the security-critical steps (load, bind, resolve as the viewer, render, validate on the host, diff; then offered-intent check, authorise, persist or dispatch, record the result, re-render) while the host injects its store, runner, resolver, authoriser and dispatcher and keeps every piece of state. There is no controller object, no internal map and no timer; every call is a pure function of its arguments plus the injected effects. The design is `plans/evidence/030-host-pipeline-design.md`, with the ten amendments it lists to plan 030.

## Context

The 0.3.0 evaluation names the missing production orchestration as gap W4. `examples/demo-host/server.ts` (253 lines) is the only complete host and hand-rolls the order of `loadPlacement`, `runner.render`, `checkOffered` and the operation, with its own revision, served-tree and validator maps and no authorisation step; it calls neither `bindSources`, `renderKey` nor `diffTrees` (`plans/backlog.md:533`). Every helper exists, but nothing fixes the order they run in, so an adopter can swap two steps and break law 2 or law 4 with no failing test. The 0.2.2 scope decision rejected adopting the evaluation's roadmap as written (alternative 5), and the backlog records that as "a library controller was rejected". This decision must therefore answer that rejection, not reopen it.

## Approval

- Proposed by: agent, from plan 030 Task 1 and the evaluation's Part II §1.
- Approved by user: Yes.
- Approval evidence, 2026-11-08: asked to approve the exact decision text above (stateless `/host` with `renderPlacement`, `handleIntent`, `dependents`; `checkOffered` then `authorize` before any effect; the host keeps all state; the stateful controller stays rejected), the owner answered "Approve and log (Recommended)".

## Alternatives Considered

1. **A stateful `createSurfaceController`** (evaluation Part II §1). Not selected, as in 0.2.2. It would hold revision counters, accepted trees, input hashes and source-dependency tracking: four pieces of mutable state with lifetimes and eviction, each a place two hosts would disagree about semantics. State ownership belongs to the host (spec §8).
2. **Documentation only** (a "how to order the steps" guide). Not selected. Every adopter would re-implement the security-critical order, and the demo host already shows how: copies drift, and nothing tests the order.
3. **Resolve sources inside the runner.** Not selected. Data is resolved by the app as the viewer (law 4), outside widget code and outside the sandbox.
4. **A `createHost(wiring)` factory returning bound functions.** Not selected. It adds a long-lived object for no gain; the host builds its own `{ store, runner, … }` object once and spreads it into each call.
5. **Include `validateTree` and `diffTrees` in the 0.2 ms overhead budget.** Not selected. Both are required by the laws and have their own budgets; folding them in would make the budget a function of tree size. The bench reports them next to the budgeted part.

## Rationale and Evidence

- **The order is the product.** The pipeline's value is that `validateTree` on the host (R9) precedes `served`, and `checkOffered` then `authorize` precede `putState` and `dispatch` (H2, H4). The design shows each law's enforcement point and the single list of effects.
- **Statelessness is achievable.** The retained data a controller would keep is small and already has a home: `Served` (tree, key, revision, validator, bound sources, state) is returned to the host, which stores it where it likes. `renderKey`, `bindSources`, `checkOffered` and `loadPlacement({ verified })` already have the semantics needed; `diffTrees` needs `previous`, which the host passes back.
- **Coordination needs no registry.** `dependents(placements, change)` is a pure scan of the `bound` calls each `Served` already carries (W6b), so one widget's action can refresh another without a new format.
- **Failure behaviour is fixed, not improvised.** A thrown `dispatch` or `authorize` becomes a fixed generic status and never reaches the widget or transport; a superseded revision is refused, never rewritten (spec §11); a misbehaving resolver yields a `sourceOutcome` envelope or a typed `render-failed`.
- **Bounded cost.** Budget ≤ 0.2 ms per `renderPlacement` beyond the runner and resolver, including `renderKey`, with `validateTree` and `diffTrees` reported separately; Task 2 measures it and records the split instead of relaxing it silently.
- Not researched: no third-party library is involved; the evidence is the repository's own code and prior decisions.

## References

- `plans/evidence/030-host-pipeline-design.md` — the numbered steps, contract, event table and amendments.
- `plans/liveframe-evaluation.md` Part II §1 — the controller this decision does not adopt.
- `decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md` (alternative 5) and `plans/backlog.md:533` — the rejection this answers.
- `decision-logs/2026-11-05-0238-release-0-3-0-scope.md` — W4, W6b and L2 in the 0.3.0 scope.
- `decision-logs/2026-11-07-1756-action-results-and-local-bindings.md` — the `ActionStatus` shape and `SurfaceEvent` conventions the pipeline writes and mirrors.
- `examples/demo-host/server.ts:93-223` — the hand-rolled order being replaced.
- `src/store/load.ts`, `src/formats/manifest.ts:335` (`bindSources`), `src/pack/hash.ts:225` (`renderKey`), `src/validate/patch.ts:177` (`diffTrees`), `src/validate/offered.ts:29` (`checkOffered`) — the helpers it composes.

## Consequences

- Positive: an adopter gets the correct order from three calls; the demo host shrinks to transport plus its own resolver, authoriser and dispatcher; the order is covered by tests in the library.
- Risks: a stateless function cannot stop two callers passing the same stale `served`, so hosts must serialise calls per placement and scope (documented in `docs/host.md` and shown in the demo). A host that loses `Served` across a restart must pass a revision floor. A new public surface (`/host`) must be kept in step with `register-0.3.0.json`.
- Follow-up: Tasks 2–5 implement it; Tasks 7, 8 and 10 plug in catalogs, `migrated` and libraries without redesign; Task 11 reviews law 4 step by step through `handleIntent`.
- Revisit if a measured need appears for library-held per-viewer state (for example, a second host-side pipeline needing the same dependency graph across processes), which would be a new decision.
