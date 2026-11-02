---
date: 2026-11-02 22:08
status: approved
decision_about: "Multiple variant axes ship in 0.3.0 with the proposed design"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Multiple variant axes for 0.3.0

## Decision

Release 0.3.0 adds **variant axes**. A definition's optional `axes` map marks enum string props as
recipe axes, each with a default. Recipes address a value with the key `<kind>.<axis>:<value>.<slot>.<state>`,
an overlay in the cascade (rest layers, then state layers, axes after the variant in declared order).
The resolver expands overlays into the flat table the projection already uses, so kinds without axes
keep identical classes and CSS bytes. A kind with axes gets a positional class suffix,
`lf_<kind>_<variant>__<v1>__<v2>_<slot>`. The tree, patches, SDK and elements schema do not change.
Compound variants are not offered. No format version bump. The design is
[`plans/evidence/022-variant-axes-design.md`](../plans/evidence/022-variant-axes-design.md). Nothing
ships in 0.2.2.

## Context

`variants` is one closed axis. The [format-scope decision](2026-10-22-1905-phase-1-format-scope.md)
rejected multi-axis variants for 1.0 and set the revisit trigger "if a reference host needs a second
variant axis". With one axis, independent look choices (primary/ghost × neutral/critical) become
product variants, repeating the recipe duplication the cascade removed. The
[0.2.2 scope decision](2026-11-01-1747-release-0-2-2-scope-and-api-stability.md) scheduled this design
for 0.2.2 and its implementation for 0.3.0. Plan 022 Task 12 is the design.

## Approval

- Proposed by: agent.
- Approved by user: Yes.
- Approval evidence: asked to approve "as designed" (axes as marked enum props; `kind.axis:value.slot.state`
  overlay keys; resolve-time expansion; no tree or patch change; no compound variants; no format bump),
  the owner chose "Approve and log" on 2026-11-02.

## Alternatives Considered

1. **A new node field** — changes the tree, patch `set`, diff/apply, elements schema, SDK and every
   port's wire code, for no gain over a validated enum prop.
2. **Product variants (status quo)** — duplicates recipes and enumerates look combinations in the catalog.
3. **Compound variants** — another cascade dimension and completeness question per pair; a `variant`
   already covers a combination needing its own look.
4. **Delta CSS layers per axis value** — state rules are full snapshots, so a variant's hover would
   override an axis's rest value; fixing it rewrites state emission and changes every existing sheet.
5. **Require every axis value in every design system** — a new tone would make installed systems
   incomplete.
6. **Axis names in the class suffix, or `data-*` attribute selectors** — longer classes for no
   information; attribute selectors would need the renderer to know the design system's recipes.

## Rationale and Evidence

- Law 3 holds: axis values are closed enums the widget author already chooses like `variant`; no colour,
  CSS or authority is added; the class suffix is built from catalog-validated names and a validated
  prop value.
- Compatibility: documents without axes are accepted as in 0.2.x; a 0.2.x validator rejects documents
  with axes (closed schemas), which is fail-closed. Making an existing prop an axis renames that kind's
  slot classes, which the migration entry lists with a before/after sample and an adopter checklist.
- Cost is linear in combinations, capped at 3 axes, 16 values per axis and 256 combinations per kind.
  Baselines: Certified 152,019 B, Rack 164,152 B (`bun bench/css.bench.ts`, 2026-11-02, loaded host).
- Cascade order extends the 0.2.x rule: layers 1, 2, 4 and 5 are today's, so a kind without axes
  resolves as before.

## References

- `plans/evidence/022-variant-axes-design.md` — the full design.
- `decision-logs/2026-10-22-1905-phase-1-format-scope.md` — one axis and the revisit trigger.
- `decision-logs/2026-10-23-2314-css-projection-model.md` — compound variants excluded.
- `decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md` — schedules this for 0.3.0.
- `src/formats/catalog.ts`, `src/resolve.ts`, `src/formats/design-system.ts`, `src/css/names.ts`,
  `src/css/design-system.ts`, `src/react/renderer.tsx`.
- [MDN cascade](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Cascade) — specificity,
  order of appearance, `:where()`. Accessed 2026-11-02.

## Consequences

- 0.3.0 implements it with the gates in the proposal: byte-identical sheets for kinds without axes,
  the axes fixture within 1.1× of linear extrapolation, no regression beyond 2% on the `agent-home`
  validator and render gates, warm switch ≤ 16.67 ms.
- `auditContrast` resolves every combination. The renderer conformance rule requires each axis value
  at least once, not the full product.
- Register entries are `widened`; `slotClass` gains an optional fourth parameter. Ports implement
  `axes`, the widened key pattern, the two layers and the suffix.
- Revisit compound variants or delta layers if a reference host reports unacceptable CSS size.
