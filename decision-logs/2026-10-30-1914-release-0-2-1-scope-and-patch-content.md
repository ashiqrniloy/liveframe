---
date: 2026-10-30 19:14
status: approved
decision_about: "0.2.1 release scope, allowed patch content and package corpus verification"
proposed_by: "both"
explicitly_approved_by_user: true
---

# Decision: Release 0.2.1 scope and patch content

## Decision

Release 0.2.1 covers CL-10 to CL-16 and the four post-0.2.0 documentation corrections in plan 021, including additive exports, error kinds, corpus cases, hash vectors and new optional format versions as allowed patch content. CL-15 tree patches belong in this same release and plan, gated on Task 2's separate owner-approved design. Package corpus cases run through `verifyPackage`, including integrity verification and the SDK-only import rule; `forbidden-import` is in scope.

## Context

Clay reviewed the installed 0.2.0 archive and reported runtime, packaging, conformance and performance gaps. R15 prohibits patch releases from breaking the public API, formats or on-disk layout. The compatibility guide already calls added exports, cases and vectors additive, but did not explicitly name them as patch content. The owner settled that policy and the release target on 2026-10-30; Task 1 settles the two remaining corpus questions.

The scope includes the validator bundle and runtime corrections (CL-10), real package hashes, integrity cases, package-hash vectors and `/pack` hash exports (CL-11), realm-specific error reporting (CL-12), package metadata and conformance data exports (CL-13), release-tag maintenance (CL-14), optional tree patches (CL-15), and WebKit switching-budget proof (CL-16). This records scope, not implementation, performance results or permission to publish.

## Approval

- Proposed by: both (the owner's release choices and the agent's corpus recommendations).
- Approved by user: Yes.
- On 2026-10-30, the owner's two policy answers, recorded verbatim in plan 021, were **“Yes, additive in patch”** and **“0.2.1, one plan”**.
- The user instructed: “Complete - [ ] Task 1: Record the 0.2.1 scope and patch-content decision from plans/021-Phase-7-Part-H-Release-0-2-1.md and update the plan once done”.
- On 2026-10-30, asked whether package corpus cases should run through `verifyPackage` including integrity checks, and whether `forbidden-import` should be included so package-verifying ports enforce SDK-only imports, the owner answered **“Yes to both (recommended)”**. This approves each corpus choice explicitly.

## Alternatives Considered

1. **Fixes only in 0.2.1; additions in 0.3.0** — rejected by the owner's additive-in-patch answer. Additions can preserve every existing contract without requiring a minor release.
2. **Tree patches in a separate 0.3.0 plan** — rejected by “0.2.1, one plan”. A separate design approval within plan 021 still protects the new wire contract.
3. **Shape-only package corpus checks** — rejected by the owner. They cannot prove that a port rejects tampered packages; `verifyPackage` includes shape checks and integrity verification.
4. **Integrity checks without `forbidden-import` cases** — rejected by the owner. A package verifier must also enforce the SDK-only import rule, and the corpus must prove that obligation.

## Rationale and Evidence

The existing Formats policy fixes each corpus case's expected `(kind, pointer)` set and each hash vector's canonical text and digest within its format version. Adding cases and vectors does not change those expectations. Replacing the valid package fixture's placeholder hash with its real hash preserves its `ok: true` expectation; Task 6 must verify that existing cases keep their expectations when run through `verifyPackage`.

The current `FORMAT_KINDS.package` in `src/__tests__/corpus.test.ts` lists only `invalid-document` and `limit-exceeded`, while `hash-mismatch` and `forbidden-import` are classified as non-format kinds. Clay's CL-11 report identifies the matching shape-only coverage gap. Task 6 changes the runner, support inputs, fixture hashes and kind coverage together, and documents the verifier for ports.

Tree patches are an optional transport: existing whole trees retain their meaning and remain valid. Law 2 remains intact because a patched tree is validated whole before the renderer reads it. Task 2 must make that requirement binding in its design decision; this scope record does not lift spec §14's tree-patch non-goal or approve a particular operation shape, export signature or renderer API. The format and spec changes follow only after that separate approval.

## References

- [Plan 021](../plans/021-Phase-7-Part-H-Release-0-2-1.md) — approved release answers, Task 1 criteria, Task 2 design gate and Task 6 corpus work.
- [Clay's 0.2.0 review](../plans/requests/clay-0.2.1-requests.md) — CL-10 to CL-16 and acceptance requirements.
- [R15](2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md) — compatibility policy being clarified.
- [0.2.0 scope decision](2026-10-27-2028-release-0-2-0-scope-and-breaking-changes.md) — release-scope record precedent.
- [Compatibility](../docs/compatibility.md) — Versions, Formats, Growth and the 0.2.1 scope.
- [Spec](../docs/spec.md) §2 and §14 — validated UI data and the current tree-patch non-goal.
- `src/__tests__/corpus.test.ts:33-79` — current package and non-format error-kind coverage.

## Consequences

- Patch releases may add the named surfaces while never breaking the public API, formats or on-disk layout. Existing exports, format meanings, corpus expectations and hash vectors remain stable.
- Ports verifying packages must prove both integrity checks and the SDK-only import rule through the package corpus. Task 6 supplies the cases and verification path; this decision does not claim they already exist.
- Tree-patch implementation remains gated on Task 2's owner-approved design, including whole-tree validation before render. Acceptance and release checks remain required, and publishing needs the owner's later explicit go.
- Revisit the release target if implementation requires an existing contract to break; an additive-patch approval does not authorize such a break.
