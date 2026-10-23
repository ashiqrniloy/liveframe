# Styling

## Target

Spec §6. Roadmap Phase 1 (formats and resolver) and Phase 3 (CSS projection).

- **Theme:** the only colour source. It defines colour roles and typography roles (family, size, weight, line height, then optional `letterSpacing` in `em`, `textTransform`, `fontStretch` and `fontSizeAdjust`); the app declares which role names are required. Missing roles are app data, not a format change. The theme is the resolved set of roles; an app may assemble it from separate sources, such as a colour package and user typography.
- **Design system:**
  - **Values:** typed design values (`radius`, `border-width`, `spacing`, `size`, `motion-duration`, `easing`, `opacity`, `backdrop-blur`, `shadow`, `breakpoint`). `size` is a bounded length the design system owns, such as `size.rail: 352`, used where no spacing step fits. The app declares the value names style props may reference (`space.*`, `radius.*`, `size.*`, breakpoints); a design system missing a declared name fails validation.
  - **Recipes:** keyed `<kind>.<variant>.<slot>.<state>`, each a typed style object. Colour properties take theme roles only. Borders take a width for all sides or one per side (`borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth`).
  - **The boundary:** recipes own the look (colour, borders, radius, padding, typography, opacity, shadow, blur, motion); style props own the structure (display, flex/grid layout, tracks, alignment, sizing, position); the projection's base sheet owns the generic reset and surface typography; per-kind structural defaults (headings' wrapping, an icon's box, control `min-height`s) belong to trusted app primitive CSS. A recipe never gains a structural field.
  - It can `extends` another design system, and it must be complete for the catalog.
- **States:** `rest`, `hover`, `active`, `focus`, `disabled`, `selected`, `invalid`, `open`. A state whose recipe resolves to its rest declarations gets no rule of its own; the stable slot class stays on the element.
- **Style props:** layout-only and token-constrained, declared per primitive (spec §6.3). Dimensions and grid tracks may use `space.*` or `size.*`; box `radius` takes a declared `radius.*` name or `full`. Any style prop may take a responsive object keyed by design-system container breakpoints (a value set at one breakpoint holds at every wider one). Box `fill` accepts only the roles the app declares fillable. `tone` values include `foil` for foil-ink text.
- **Projection:** Three independent scoped sheets (base, theme, design system), CSS custom properties and one stable class per `(kind, variant, slot)`. State selectors and their precedence are normative in spec §6.4. Surfaces never nest; attribute switches preserve markup and suppress transitions. The projection honours forced colours and reduced motion, with reduced transparency as a progressive enhancement. Every surface root and text slot gets theme typography; nothing inherits host-page fonts.

Prior art: Clay's `decision-logs/2026-08-28-2234-package-defined-ui-design-systems.md` and `packages/design-rack/package.json` (`uiDesignSystem.values` and `.recipes`).

Rules:
- No literal colour anywhere outside a theme. No raw CSS, selectors or scripts in any style input.
- The completeness and colour-authority checks have failing-case tests.

## Today

`src/formats/theme.ts` validates DTCG colours and typography against the vocabulary, including bounded plain font-family names. `src/formats/design-system.ts` validates typed values, theme-only colour references, closed recipe properties, inheritance and completeness. `src/resolve.ts` shares the completeness cascade and produces flat recipes with design references resolved, retaining colour and typography role names. See `docs/formats.md` for bounds and resolver errors. Projection ships separately in `@arnilo/liveframe/css`, never in the root export.

Both proof themes and design systems validate in the new formats, with 616 resolved recipes each for the 24-kind catalog. The exporter proves equality after unit conversion and expansion of shadow-alpha theme roles (`proof/scripts/export-formats.ts`, `src/__tests__/proof-formats.test.ts`).

`src/css/index.ts` only re-exports `baseCss`, `themeCss`, `designSystemCss`, `slotClass`, `styleDeclarations`, `surfaceAttributes`, `colourVar` and `valueVar`. The three sheet functions return `Result<string>` after validation, with deterministic output and no host APIs. The projection covers ordered state selectors, logical sides, responsive container rules, overlay entry, reduced motion/transparency, forced colours and transition suppression during switches. `styleDeclarations` returns camel-case style properties, responsive custom properties and classes, throwing on invalid props/values; `surfaceAttributes` adds containment only for responsive trees. Hosts load/cache sheets and own scope attributes, CSP and theme selection. `docs/styling.md` documents this contract for outsiders.

The proof host uses `/css` through `proof/css/project.ts` and independent sheets in `proof/css/sheets.ts`; primitive structure stays in trusted app CSS. Plan 007 Task 10 re-proved Certified parity at 0.72% / 0.75% / 0.97% and the ≤ 16.67 ms warm-switch budget, with all proof scenarios under both systems. G27 is closed. `proof/GAPS.md` retains G33's load-sensitive cold container-query cost and G29's real Windows/assistive-technology audit; Chromium emulation does not close that manual gate. The historical proof runtime's render cost is distinct from the shipped SDK gate, closed in plan 005 Task 8. See `plans/backlog.md` for the renderer, preview and adopter handoffs and the documented projection limits.
