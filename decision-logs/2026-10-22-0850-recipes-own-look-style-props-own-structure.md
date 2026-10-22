---
date: 2026-10-22 08:50
status: approved
decision_about: "Where styling expressiveness lives: recipe vocabulary versus style props, and the re-scope of Plan 002 Task 6"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Recipes own the look, style props own the structure; the recipe vocabulary grows only on the look side

## Decision

1. **The boundary.** A recipe (spec §6.2) styles how a slot *looks*: colour roles, borders, radius, padding, typography, opacity, shadow, blur, motion. Style props (spec §6.3) set *structure*: display mode, flex and grid layout, tracks, alignment of content, sizing and position. A recipe never gains a structural field (`display`, `gridTemplateColumns`, `justifyContent`, `textAlign`, `width`, `minHeight`…).
2. **The look vocabulary grows where the proof found it short.**
   - Recipes gain per-side border widths: `borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth`, typed like `borderWidth`. A hairline above and below a row is a look.
   - Typography roles (spec §6.1, theme-owned) gain optional `letterSpacing` (a bounded `em` number) and `textTransform` (`none` or `uppercase`). Tracked uppercase labels are a typography role, not a recipe trick.
3. **The app's declared vocabulary is data.** Missing typography and colour roles (for example a stronger label weight, an overline, a foil ink) are added as app-declared roles with values in each theme. That needs no format change.
4. **Plan 002 Task 6 is re-scoped.** Widget recomposition with existing primitives, variants and style props is allowed, so that structure (row grids, heading sizes, state/facts/decide geometry) is expressed by the widget. No primitive is added.

## Context

Plan 002 Task 6 stalled at 14.4% / 17.9% / 24.6% pixel mismatch against the ≤ 1% bar (`proof/GAPS.md`, "Plan 002 Task 6"). The seven remaining causes were analysed by *who controls each one*:

- the recipe vocabulary (the library's format, `proof/styles/types.ts:124`, projected by `proof/css/project.ts:98`);
- the recipe addresses, meaning the catalog's variants and slots (the app, `proof/catalog/definitions.ts`);
- the values in themes and design systems (`proof/styles/certified/*`);
- the widget's composition.

Task 6 as written allowed only the values to change. Most causes need either the vocabulary or the composition:

| Gap | Resolved by |
|---|---|
| 1. Rows drawn as cards, not `.line` rows | Composition (a `grid` row with `columns`, `box.rule` instead of an inline `surface`) plus per-side borders |
| 2. One `heading.2` for two artifact sizes | Composition: `heading` already takes `textStyle` |
| 3. Row title alignment and weight | Composition (`button` already takes `align`) plus an app-declared typography role |
| 4. Uppercase tracked group labels | Typography `letterSpacing` / `textTransform` plus an app-declared role |
| 5. State, facts and decide geometry | Composition |
| 6. Kicker foil ink and glyph size | An app-declared colour role; composition for the glyph |
| 7. Section-head hairline, tab counts | Per-side borders plus composition |

`proof/GAPS.md` offered four options: extend `Recipe` with layout fields, a Certified glue sheet, recomposition, or accepting the mismatch. This decision takes a narrower form of the first and the third.

## Approval

- Proposed by: agent, in a conversation on 2026-10-22 explaining the render pipeline and where styling expressiveness is controlled.
- Approved by user: Yes
- Approval evidence: after the agent proposed "recipes own look, style props own structure" and the plan amendment, the owner replied "Do the plan amendment. … Create the decision log."

## Alternatives Considered

1. **Add layout fields to `Recipe`** (`display`, `gridTemplateColumns`, `justifyContent`, `textAlign`, `minHeight`; GAPS option 1). Rejected: a design system would then decide structure, so a theme or design-system switch could re-layout a widget. That breaks what Plan 001 T10 proved, and recipes drift towards CSS.
2. **A Certified glue sheet targeting `lf-*` classes.** Rejected: it makes recipes no longer the only style data (spec §6.2) and couples a design system to generated class names.
3. **Accept the measured mismatch and lower the Phase 0 bar.** Rejected: the owner set ≤ 1% (`decision-logs/2026-10-22-0113-parity-re-proof-format-details.md`), and most of the gap is fixable inside the model.
4. **Add Certified-specific props or product-shaped primitives** (a `queueRow`). Rejected: law 3 and the primitives-only rule.
5. **Keep Task 6 values-only.** Rejected: measured as blocked.

## Rationale and Evidence

- The split follows what each layer must stay stable under. Structure must survive a design-system switch, so it belongs to the widget. Look must change with the design system, so it belongs to recipes and the theme.
- Every structural gap already has a style prop or prop: `columns`, `align` on `button`, `textStyle` on `heading`, `direction`, `gap` (`proof/catalog/definitions.ts`, spec §6.3). They were unused because Task 6 froze widget code.
- The look-side additions are small, closed and typed, so validation and the colour rule stay as they are. Per-side widths are numbers or `border.*` values. `letterSpacing` and `textTransform` are bounded scalars on theme-owned roles.
- The projection already emits every key of a typography role as a custom property (`proof/css/project.ts`, `typography()`), so the typography additions need no new projection path.

## References

- `proof/GAPS.md` — "Plan 002 Task 6 — the 1% pixel bar is blocked by the style surface".
- `plans/002-Phase-0-Parity-Re-Proof.md` — Task 6 notes, and Task 5a added by this decision.
- `proof/styles/types.ts:124` (`Recipe`), `proof/styles/types.ts:52–59` (`typographyRoles`, `Typography`).
- `proof/css/project.ts:98` (`declarations`).
- `docs/spec.md` §6.1, §6.2, §6.3, updated with this decision.
- `docs/model.md` — the render pipeline and who owns each step.

## Consequences

- Spec §6.1 and §6.2 change in this change: typography roles gain two optional fields, recipes gain per-side border widths, and §6.2 states the boundary.
- Plan 002 gains Task 5a (the format additions and declared roles in the proof). Task 6 now allows widget recomposition.
- Rack must stay complete. The new fields are optional, so its 247 source recipes are unaffected.
- **Revisit** if a real UI needs a look that only a structural recipe field could express, or if a design system legitimately needs to change structure (for example a compact versus a spacious density). That would be a separate density decision, not a reason to put layout in recipes.
