---
date: 2026-10-23 23:14
status: accepted
decision_about: "CSS projection, surface scoping and renderer styling contract"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Three independent scoped sheets and stable slot classes

## Decision

Adopt the fourteen projection decisions in Plan 007 Task 1, with the normative rules written into spec §6.2–§6.4, §11 and §13 in this change:

1. **Three sheets, two scope attributes.** Pure `baseCss(catalog)`, `themeCss(theme, catalog)` and `designSystemCss(designSystem, { catalog, registry })` return `Result<string>`. The base holds reset, typography, containment and environment overrides. Theme roles and `color-scheme` live under `:where([data-lf-theme="<id>@<version>"])`; design values, recipes and container rules live under `:where([data-lf-ds="<id>@<version>"])`. Design systems refer to theme roles through variables. A fixed catalog needs N + M + 1 sheets. Surfaces never nest, including host-composed surfaces.
2. **Generic base only.** Box-sizing, zero margin/border, inherited control fonts and surface typography belong to the base. Per-kind structure belongs to trusted app primitive CSS, outside law 3's widget/installed-data boundary. The library has no catalog of its own.
3. **One class per slot tuple.** `lf_<kind>_<variant>_<slot>` stays unchanged across states and design-system switches. States are selectors, not extra classes.
4. **Equal specificity, explicit precedence.** Recipe rules have (0,1,0) specificity, with scope, state and root qualifiers inside `:where()`. Source order is rest, hover, focus, active, open, selected, invalid, disabled. Disabled roots/slots suppress hover and active. Root state reaches slots; native hover is gated by hover capability, synthetic hover is not.
5. **Normative state selectors.** Spec §6.4 records the exact native, data and ARIA selectors. Renderers target that table rather than inventing a second state vocabulary.
6. **Overlay effects and entry.** Blur and saturation compose in one `backdrop-filter`; background alpha is multiplied through `--lf-alpha`. An open slot whose resolved look differs from rest enters from rest through `@starting-style`, using its recipe transition. Exit needs renderer-managed unmounting in Phase 4. Overlays retain scope, through top-layer ancestry or a scoped portal. Backdrop and content are siblings, with no opacity/filter ancestor isolating the backdrop from the page.
7. **Preferences and switches.** Reduced motion removes transitions and pressed offset. Reduced transparency forces alpha to 1 and disables backdrop filtering as a progressive enhancement. Theme selection remains the host's. A preloaded switch sets `data-lf-switching`, changes scope attributes, then removes the marker on the next animation frame; transitions are suppressed for the switch.
8. **Forced colours preserve cues.** Keep `forced-color-adjust: auto`. The generic table in spec §6.4 uses Highlight/HighlightText for selection, GrayText for disabled, Highlight outlines for focus/hover/active/open, and a dashed CanvasText outline for invalid. Emit state cues only where the state differs from rest; restore background-only edges and fill indicator shapes with inward CanvasText outlines. Never opt out of OS colours.
9. **Logical sides, existing names.** Left/Right border widths, padding and margins project to inline start/end and mirror under RTL. Top/bottom stay physical; vertical writing modes are out of scope. No format rename.
10. **Injective names.** Dots encode as `_`, with `__` for fixed suffixes; vocabulary, catalog and id names cannot contain `_`. Classes and the colour, typography, value and responsive variable families are fixed in spec §6.4. Input strings are validated/escaped, never raw CSS.
11. **Host coexistence.** Emit unlayered CSS; hosts may choose a layer when importing it. Scope the reset to surface descendants, never a substring class selector. This establishes a cascade contract, not isolation from arbitrary host CSS.
12. **Baseline 2024 floor.** Use the CSS features listed in spec §6.4, including `@starting-style`, unprefixed `backdrop-filter` and `font-size-adjust`. Reduced transparency is an enhancement beyond that floor. `@scope` is deferred rather than raising the floor for unsupported nesting.
13. **Host-API-free `/css`.** Return strings and plain objects only. Hosts own stylesheet insertion, loading, caching and CSP authorization. Remove `/css` from host-API exceptions.
14. **Excluded surfaces.** No shadow-DOM isolation, print styles, compound variants, pseudo-element decoration, keyframes or `:nth-child`. No placeholder/scrollbar colour recipes, automatic `prefers-contrast` theme selection or atomic-class CSP route. Native controls use `color-scheme`; strict inline-style CSP and additional native-part styling remain follow-ups.

## Context

Phase 3 turns the proof's projector into a catalog-independent library. The proof combines theme and system variables at `:root`, emits state-specific classes, owns kind-specific structural CSS and special-cases scrollbars. Those choices cannot support independently themed panels or the preview matrix without coupling the library to the proof catalog.

Plan 007 records the owner's delegated coverage analysis and enumerates the decisions to adopt. This task records the target contract; it does not claim the projector or browser proofs have shipped.

## Approval

- Proposed by: agent, under the owner's delegated Phase 3 analysis.
- Approved by user: Yes.
- Approval evidence: Plan 007 records the owner's 2026-10-23 instruction, “make the decision that fits the purpose the best”, and explicitly states Task 1 needs no further approval gate. The current instruction explicitly requests completing “Task 1: Record the projection decisions and write them into the spec” and updating the plan. The delegation is cited from the plan; no separate transcript was available for reinspection.

## Alternatives Considered

1. **Global combined sheets (status quo).** Rejected: styles leak across surfaces and theme/system combinations multiply sheets (G27).
2. **Design-system-qualified classes.** Rejected: a switch rewrites node classes. Per-tuple/state/property component variables avoid that but introduce thousands of variables, while container conditions still require literal widths.
3. **`@scope` donut scoping now.** Rejected: nesting is unsupported and it raises the Baseline floor. Revisit when nested surfaces become a requirement.
4. **Keep per-kind structure or eight state classes.** Rejected: structure assumes a library-owned catalog and state classes add markup without additional expressive power.
5. **Selector-specific precedence or forced-colour opt-out.** Rejected: selector shape should not decide state priority, and disabling OS colours violates spec §6.1.
6. **Rename side fields.** Rejected: touching formats, schemas, generated types and fixtures buys no new behavior; specify the logical interpretation instead.
7. **New entering/exiting states or animation vocabulary.** Rejected: existing rest/open data supports entry; exit needs renderer lifecycle work. Decoration and structural selectors exceed the established recipe boundary.
8. **Library-selected cascade layers or shadow isolation.** Rejected: the host owns the page's cascade; shadow isolation adds SSR, portal and font complexity. Attribute scoping is sufficient for sibling surfaces, with no claim of arbitrary host-style isolation.

## Rationale and Evidence

- Local source confirms the proof limitations: `proof/css/project.ts:5–13` encodes dots as hyphens and includes state in classes; `:161–265` combines variables in `:root` and emits recipe/container rules; `:267–290` includes the substring reset, hard-coded body role, kind structure, scrollbar role and switch-thumb transform. The tone map at `:322` also fixes app vocabulary in code.
- The prior accepted look/structure decision keeps structure in widget composition and app primitives. This decision makes the published projector generic while retaining that boundary. `translateY` uses `translate` so it composes with a primitive's transform.
- `proof/GAPS.md` records G33: about 17 ms on the first container-query flip versus 3.5–3.8 ms steady state. Conditional containment remains; Task 9 measures a scoped switch with blur present, and Task 10 repeats parity. Those numbers are existing proof evidence, not measurements of the new projection.
- Plan 007's inherited framework review supplies the comparison evidence: MUI transition suppression; Radix/StyleX subtree themes; vanilla-extract scoped theme contracts; Panda equal-shape condition selectors and layer ordering; Tailwind hover gating and preference variants; React Aria input/state attributes; Fluent state cues in forced colours; DTCG resolved modes; Style Dictionary selector-based variable output. These are precedents, not runtime dependencies or claims that those libraries satisfy this contract. Their APIs were not independently re-fetched in this documentation task.
- MDN rechecked on 2026-10-23: `@starting-style` is Baseline August 2024; unprefixed `backdrop-filter` September 2024; `font-size-adjust` July 2024. Reduced transparency remains limited availability. MDN dates `@scope` to March 2026, correcting the plan's December 2025 Baseline claim without changing the no-nesting decision.
- Filter Effects Level 2 defines backdrop roots: opacity below 1 and filters on ancestors constrain backdrop sampling. Scoping alone cannot make blur work through such an ancestor; renderer markup must satisfy the contract.

## References

- `plans/007-Phase-3-CSS-Projection.md` — owner delegation, fourteen decisions, inherited framework review and later verification tasks.
- `docs/spec.md` §6.1–§6.5, §11, §13 — normative target and updated rules.
- `decision-logs/2026-10-22-0850-recipes-own-look-style-props-own-structure.md` — look/structure boundary.
- `proof/css/project.ts`, `proof/GAPS.md` — local implementation and measured constraints.
- [MDN: @starting-style](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@starting-style) — entry support and semantics.
- [MDN: backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter) — unprefixed support.
- [MDN: font-size-adjust](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-size-adjust) — platform floor.
- [MDN: reduced transparency](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-transparency) — progressive enhancement.
- [MDN: @scope](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@scope) — corrected Baseline date and deferred scope boundary.
- [Filter Effects Level 2: backdrop roots](https://drafts.csswg.org/filter-effects-2/#BackdropRoot) — backdrop sampling constraints.

## Consequences

- Tasks 2–10 implement and prove this contract; Task 1 changes documentation only. `surfaceTypography` remains Task 2's format/schema change, and package exports remain Task 8's work.
- The proof will move per-kind structural CSS into app-owned primitive CSS and lose Rack's hard-coded scrollbar colour. Record that adopter gap rather than add a library special case.
- Nested surfaces, strict CSP without inline styles, native-part colouring and Windows/assistive-technology auditing remain limitations or later work. Task 12 disposes of the follow-ups; G29 is not closed by this record.
- Revisit scoping if nesting is required, the platform floor if unsupported browsers must be served, and entry/exit if renderer lifecycle needs exceed rest/open transitions.
