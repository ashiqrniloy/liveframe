---
date: 2026-11-02 12:19
status: approved
decision_about: "Node references ship in 0.3.0, not 0.2.2"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Defer node references to 0.3.0

## Decision

Node references (`nodeRef()` / `ref()`, a `refProps` catalog list and a per-surface DOM id
resolver) do **not** ship in 0.2.2. They move to 0.3.0 with the design in
[`plans/evidence/022-node-reference-design.md`](../plans/evidence/022-node-reference-design.md)
ratified as the shape to implement. 0.2.2 stays a patch; nothing about node references appears in
its formats or its public surface.

## Context

The [0.2.2 scope decision](2026-11-01-1747-release-0-2-2-scope-and-api-stability.md) gated
`nodeRef()` on its own design and owner approval, and named the revisit trigger: *"`nodeRef()` has
no additive design, which moves it to 0.3.0."* Plan 022 Task 9 is that design.

The problem it would solve is real but narrow. Authors cannot name another node, because node ids are
key paths derived at render time (spec §7.1). Every relationship the proof catalog needs today is
structural and already carried by slots (`tooltip.trigger`/`content`, `tab.panel`,
`disclosure.summary`/`panel`, `menu.trigger`/`content`). The one thing slots cannot express is an
ARIA relationship attribute: `aria-labelledby`, `aria-describedby`, `aria-controls` and
`aria-errormessage` take `IDREF`/`IDREFS` and "must reference elements in the same DOM document".

An additive design does hold — a per-definition `refProps` name list is the same class of change as
0.2.1's `styleProps` widening — so this is not the "no additive design" branch. The decision is a
size and evidence call.

## Approval

- Proposed by: agent (recommendation: defer).
- Approved by user: Yes.
- Approval evidence: after reading the proposal summary, the owner replied "Approved. Defer to
  0.3.0. Document in the @roadmap.md".

## Alternatives Considered

1. **Ship the design in 0.2.2** — rejected. The change reaches six subsystems (catalog format and
   JSON Schema plus a new `unknown-name` rule; the build pass with deferred anchor resolution and
   exact byte correction; tree validation; codegen; the renderer's `Item.domId`; every port's
   validator and the corpus), it argues with spec §7.2's normative "building and validating are one
   pass", and it has no consumer: 0 of 24 proof primitives declare a relation prop, so the corpus
   would test the feature against itself.
2. **No additive design, so defer** — rejected as the stated reason. The design does hold additively;
   saying otherwise would misreport why the item moves.
3. **Do nothing and let hosts hand-wire ids** — rejected as a final state. It works today (a composed
   component passes literal ids through string props), but it is host-maintained bookkeeping, which
   is exactly what a reference automates. It is a reason the item is not urgent, not a reason to drop
   it.
4. **A schema-language keyword (`{ type: "string", ref: true }`)** — rejected inside the design.
   `src/schema.ts` validates schemas against a closed keyword set per type, so a keyword changes the
   schema language itself (`Infer`, every generated type, the elements JSON Schema, every port) while
   the JavaScript value stays a plain `string`.

## Rationale and Evidence

- **No consumer.** `src/__tests__/fixtures/proof/catalog.json` has 24 definitions and no prop named
  `id`, `htmlFor`, `describedBy`, `labelledBy`, `controls`, `errormessage` or `target`; `a11y`
  declares `role` and `name` only, and `name` is a string prop on the same node. A first user should
  be the one that proves the feature, and that means primitives that do not exist yet.
- **Wire and transport stay free.** The settled design carries the resolved key-path id as a plain
  string prop, so `liveframe/1`, `liveframe/tree-patch/1`, `diffTrees`, `applyPatch`, node reuse and
  capture records need no change. That is a property worth keeping when it is implemented; it is not
  a reason to ship it unproven.
- **Costs are bounded but real.** Validation is one `Set.has` per reference after the walk; the build
  pass holds a pending list and corrects bytes per reference. The spec's one-pass sentence has to be
  amended either way, and that is a spec decision that belongs with the implementation.
- **Ports pay first.** A 0.2.1 port rejects a catalog using `refProps` until it is updated, exactly
  as with the new recipe states — but the states shipped because hosts need those cues now, and no
  host needs a reference now.
- **The deferral is cheap and reversible.** A deferred register entry, one compatibility section and
  a roadmap line; 0.3.0 implements the ratified design.

## References

- `plans/evidence/022-node-reference-design.md` — the ratified design: authoring (`ref()` plus
  `$anchor`), the `refProps` catalog list, the plain-string wire form, post-walk validation, the
  renderer's `Item.domId` and `useId` prefix, codegen, ports and corpus cases, cost and security.
- `decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md` — the gate and the revisit
  trigger this decision fires.
- `decision-logs/2026-10-30-1914-release-0-2-1-scope-and-patch-content.md` — the additive-in-patch
  precedent (`styleProps` widening).
- `docs/compatibility.md` — R15 patch rules and § "Deferred to 0.3.0".
- [WAI-ARIA 1.2 §6.6.4 Relationship Attributes](https://www.w3.org/TR/wai-aria-1.2/#attrs_relationships);
  [MDN `aria-describedby`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-describedby)
  — the same-document id-list requirement.
- `src/schema.ts` (closed keyword set), `src/formats/catalog.ts` (prop-name pattern, `a11y.name` rule),
  `src/sdk/render.ts` (single pass, byte counting), `src/validate/tree.ts` (id set),
  `src/react/renderer.tsx` (`Item`, diagnostics-only `data-lf-node`).

## Consequences

- 0.2.2 ships without node references. `scripts/release/api/register-0.2.2.json` carries `deferred`
  entries for `ref`, `NodeRef` and the catalog schema; the API-stability test fails if any of them
  ships.
- Plan 022 Task 10 is `n/a — deferred to 0.3.0 (Task 9)`.
- `roadmap.md` names the deferral in Phase 7 and in §3, so 0.3.0 planning starts from it.
- Revisit if a host needs a cross-node ARIA relation before 0.3.0: the design is ready, and the
  smallest shipping unit is a primitive pair (`textField.describedBy` plus a hint kind) that also
  becomes the proof.
