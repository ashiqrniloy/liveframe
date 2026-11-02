---
date: 2026-11-02 22:08
status: approved
decision_about: "Extension recipe properties ship in 0.3.0 with the proposed design"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Extension recipe properties for 0.3.0

## Decision

Release 0.3.0 adds **extension recipe properties**: an app declares named, typed look values in
`vocabulary.extensions`, a design system sets them in a recipe's nested `extensions` map, and the
projection emits them as `--lf-p-<name>` custom properties for the app's trusted primitive CSS. Only
the `colour` (theme role or `none`) and `value` (a typed design value) types ship. Extensions are
optional overlays with no completeness requirement. No format version bump. The design is
[`plans/evidence/022-extension-properties-design.md`](../plans/evidence/022-extension-properties-design.md).
Nothing ships in 0.2.2.

## Context

Recipe properties are a closed, library-fixed list of 30 names (spec §6.2). A look the list does not
name has two routes today: a library release plus every port (as `placeholderColor` and the scrollbar
pair needed), or hard-coded app CSS that a design-system switch cannot change. The
[0.2.2 scope decision](2026-11-01-1747-release-0-2-2-scope-and-api-stability.md) scheduled this design
during 0.2.2 and its implementation for 0.3.0. Plan 022 Task 12 is the design.

## Approval

- Proposed by: agent.
- Approved by user: Yes.
- Approval evidence: asked to approve "as designed" (types colour and value only, no enum; nested
  `extensions` map; `--lf-p-<name>`; optional overlays; no format bump), the owner chose "Approve and
  log" on 2026-11-02.

## Alternatives Considered

1. **Keep adding names to `recipeProperties`** — stays the route for properties every app wants; it
   cannot scale to app-specific looks.
2. **Flat `x-name` keys beside fixed properties** — needs a pattern-keyed schema form the closed schema
   language lacks, and a future fixed name could collide.
3. **An `enum`/string type** — the app's CSS would need container style queries on custom properties,
   Baseline newly available only from 2026-05-19 per secondary sources, outside the Baseline 2024
   floor. Revisit when it is widely available.
4. **`{ role, alpha }` colours** — would extend the reduced-transparency recovery to a new family;
   additive later.
5. **Required extensions** — adding one would make installed design systems incomplete (a major catalog
   change).
6. **`@property` registration or an inheritance reset rule** — a registered property has an initial value
   that defeats the `var()` fallback and is document-global; a reset declares on every element and adds
   style-recalculation cost to the switch path. Measure before adding.
7. **Per-kind scoping, raw CSS or free strings** — more rules for no benefit, or a law 3 violation.

## Rationale and Evidence

- Law 3 holds: widget code cannot set an extension; every value is a declared theme role or a typed
  design value checked by the existing validators; the property name is a validated token; the variable
  paints nothing until trusted app CSS reads it (spec §6.2).
- Additive: a document without the new fields is accepted byte-for-byte as in 0.2.x, so there is no
  migration. A 0.2.x validator rejects a document that uses them (closed schemas), which is fail-closed.
- Cost is bounded: zero when absent; about 35 bytes per colour declaration. Worst case on Certified
  (616 resolved recipes, 152,019 B) is about +14%.
- Baselines measured 2026-11-02 on a loaded host: Certified design system 152,019 B, Rack 164,152 B
  (`bun bench/css.bench.ts`); time gates are relative to a same-session baseline.

## References

- `plans/evidence/022-extension-properties-design.md` — the full design.
- `decision-logs/2026-10-22-0850-recipes-own-look-style-props-own-structure.md` — look versus structure.
- `decision-logs/2026-10-28-1123-styling-paint-alpha-contrast-native-parts.md` — the last property
  additions.
- `decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md` — schedules this for 0.3.0.
- `src/formats/fixed.ts`, `src/formats/design-system.ts`, `src/resolve.ts`, `src/css/recipe.ts`,
  `src/formats/catalog.ts`.
- [MDN `@property`](https://developer.mozilla.org/en-US/docs/Web/CSS/@property) — Baseline 2024, newly
  available since July 2024. Accessed 2026-11-02.
- [MDN container style queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_size_and_style_queries)
  — custom properties only; the May 2026 Baseline date comes from secondary sources and was not checked
  against `web-features`.

## Consequences

- 0.3.0 implements it with the gates in the proposal: byte-identical existing sheets, size ≤ +16% and
  time ≤ +20% with an extension on every recipe, warm switch ≤ 16.67 ms. Register entries are
  `widened`, `hostAction: none`.
- Ports must parse the two new fields before installing documents that use them.
- `auditContrast` does not audit extension colours; `docs/styling.md` states it.
- Revisit for an `enum` type when style queries are widely available, for alpha colours, or for an
  inheritance reset if an adopter reports a leak.
