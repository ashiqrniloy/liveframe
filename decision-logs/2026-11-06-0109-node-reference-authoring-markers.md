---
date: 2026-11-06 01:09
status: approved
decision_about: "NodeRef markers in generated props and element JSON"
proposed_by: both
explicitly_approved_by_user: true
---

# Decision: Use NodeRef markers for authoring

## Decision

Follow plan 027 Task 2: the root export `NodeRef` is `{ readonly $ref: string }`, returned frozen by `/sdk`'s `ref(anchor)`. Generated reference props require `NodeRef`; element JSON and its generated schema use `{ "$ref": anchor }`. Both emitters resolve markers after the walk and put plain string key-path ids on the wire.

This supersedes §2.5's element-authoring sentence and §2.7 of the design ratified by [the deferral decision](2026-11-02-1219-defer-node-references-to-0-3-0.md). Other reference rules remain in force. Renderer work remains plan 027 Task 3.

## Context

Task 2 requires marker types and an elements-schema change, while the older design describes a string alias and unchanged element schemas. Implementation needs one authoring contract.

## Approval

- Proposed by: both.
- Approved by user: Yes.
- Approval evidence: after the two contracts and recommended amendment were presented, the owner replied “Follow Task 2: Noderef”.

## Alternatives Considered

1. Keep `NodeRef = string` and unchanged element schemas — rejected: generated TSX cannot accept `ref()` markers and agents must author derived key paths.
2. Use markers for authoring, resolve to strings — chosen: matches Task 2, preserves the wire format, and catches accidental literal references in generated types.
3. Carry markers on the wire — rejected: changes consumers, patches and reuse comparisons unnecessarily.

## Rationale and Evidence

- Plan 027 Task 2 explicitly requires generated `NodeRef` props and element JSON markers.
- `plans/evidence/022-node-reference-design.md` §2.1 already specifies the frozen marker; §2.3 requires plain-string wire values.
- `src/sdk/gen.ts` owns component types and element schemas; `src/sdk/elements.ts` uses the shared renderer. One resolution path handles both authoring forms.

## References

- `plans/027-Phase-7-Part-N-Release-0-3-0-Formats-References-Extensions-Axes-And-Urls.md`, Task 2.
- `plans/evidence/022-node-reference-design.md`, §2.1–§2.7.
- `src/sdk/render.ts`, `src/sdk/elements.ts`, `src/sdk/gen.ts`.

## Consequences

- Catalog reference props still declare string wire schemas; generated author types replace those props with markers.
- Reference-bearing catalogs require regenerated types and agent schemas. Catalogs without references keep their prop types.
- Tree membership is validated after the node walk; markers and anchors never enter the wire tree.
