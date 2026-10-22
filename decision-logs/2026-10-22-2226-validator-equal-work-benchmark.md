---
date: 2026-10-22 22:26
status: approved
decision_about: "The compiled-validator benchmark's relative performance gate"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Compare compiled and interpreted props checks on equal work

## Decision

Plan 004 Task 5 retains full tree validation's ≤ 1.5 µs per node gate on every fixture. Its ≥ 2× speed-up gate on agent-home compares identical props-only tree walks using compiled schemas and Part A's `checkValue`. The benchmark reports all three timings and the original full-validation/props-only ratio.

## Context

The original relative gate compared all of spec §10 (metadata, identity, children, styles, intents, JSON safety and byte limits) with props-only schema interpretation. The first run measured 0.8832 ms for full validation and 0.5459 ms for the narrower interpreter baseline on the 679-node agent-home fixture. That ratio does not isolate schema compilation's benefit.

## Approval

- Proposed by: agent.
- Approved by user: Yes.
- Approval evidence: “Approve equal-work comparison”, in response to the explicit proposal to retain the absolute gate, compare compiled versus interpreted props checks, and report all three timings.

## Alternatives Considered

1. **Keep the original ratio gate.** Rejected by the owner in favour of measuring identical work; it conflates schema interpretation with the rest of whole-tree validation.
2. **Build another complete interpreter for §10.** Rejected: duplicates production validation logic just to measure schema compilation, and introduces semantic drift risk.
3. **Remove the relative gate.** Rejected: keep a hard test that compilation improves schema checking on a realistic tree.

## Rationale and Evidence

The same recursive walk dispatches either `checkValue` or `compileSchema` against the same catalog schemas and node props. Maps, compiled closures, loading and validator construction are outside timing. `checkValue` includes its existing schema-language validation. Both paths assert valid-fixture acceptance and malformed-prop/unknown-kind rejection before timing. Each measurement uses 200 warm-ups and 1,000 runs.

A pre-approval diagnostic run measured agent-home compiled props at 0.0362 ms versus interpreted props at 0.4817 ms (13.31×). Full validation separately measured 0.7648 ms (1.126 µs/node). These are local measurements, not cross-runtime guarantees; Task 5's execution notes record the final run and machine.

## References

- `plans/004-Phase-1-Part-B-Compiled-Validator.md`, Task 5 — corrected acceptance and verification criteria.
- `bench/validator.bench.ts` — reproducible measurements and hard gates.
- `src/schema.ts`, `src/validate/schema.ts`, `src/validate/tree.ts` — interpreted schemas, compiled schemas, and full validation.
- `docs/spec.md` §10 — the full validation contract, unchanged.
- `decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md` — the existing runtime and render-budget decision, unchanged.

## Consequences

- The comparison proves compiled props checking beats generic props checking, rather than claiming full validation beats a props-only walk.
- The unchanged absolute gate still measures full validation on every fixture. Phase 2 must still prove the full 3 µs-per-node render budget.
- No public API, runtime dependency or validation semantics change.
