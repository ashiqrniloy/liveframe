# Phase 3: CSS Projection

## Objectives

- Ship `@arnilo/liveframe/css`: pure, deterministic functions that turn the shared base, an installed theme and an installed design system into three independent stylesheets. The output contains CSS custom properties and one stable class per `(kind, variant, slot)`, with one rule per state.
- Scope every sheet to a surface through two attributes, so different themes and design systems can share a page. The `<Preview>` matrix (Phase 4 Part B) and hosts with themed panels need this (G27).
- Define coverage for the host UI's environment, not only for the formats: interaction states across input methods, the order when several states hold, overlays and their backdrops (blur, translucency, entry motion), reduced motion and reduced transparency, forced colours, right-to-left direction, colour scheme, container breakpoints, and switching without transitions.
- Move the proof host onto the real projection, and re-prove agent-home parity and the design-system switch budget with it.

## Expected Outcome

- `baseCss(catalog)`, `themeCss(theme, catalog)` and `designSystemCss(designSystem, { catalog, registry })` each return `Result<string>`. The same input gives byte-identical output. N themes and M design systems need N + M + 1 sheets, not N × M.
- `slotClass`, `styleDeclarations`, `surfaceAttributes`, `colourVar` and `valueVar` give a renderer everything it needs to draw a validated tree, without importing a DOM API.
- One page shows two surfaces under different theme × design-system pairs, with an open blurred dialog and a popover in one of them. Switching one surface changes computed styles only in that surface. No class or node changes, and no transition runs.
- In emulated forced colours, every state of every proof tuple differs from rest, and every edge that a background drew is still visible. Under reduced motion no transition runs. Under reduced transparency, backdrops become opaque and unblurred.
- With the real projection, agent-home parity holds at ≤ 1% at 1440, 1024 and 390 px, every proof scenario renders under both design systems, and a warm switch takes ≤ 16.67 ms.
- `docs/styling.md` explains, for outsiders, how a host projects, loads, scopes and switches styles, and what a renderer must do.

This plan implements roadmap Phase 3: spec §6.1–§6.5 as the CSS projection, the styling half of §11 (what a renderer receives from `/css`), and the `/css` row of §13. It consumes the Phase 1 formats and `resolveRecipes()` (`src/resolve.ts:69`) unchanged, except for one vocabulary field added in Task 2. The scope comes from the Phase 3 coverage analysis: a review of DTCG 2025.10 and its resolver, Style Dictionary, vanilla-extract, StyleX, Radix Themes, MUI CSS theme variables, Panda CSS, Tailwind v4, React Aria Components and Fluent UI v9, set against the proof projector (`proof/css/project.ts`). The owner delegated every decision in that analysis on 2026-10-23 ("make the decision that fits the purpose the best"). Task 1 records those decisions; it needs no further approval gate.

**Not in this plan:**
- `<Surface>`, `implement()` and the React renderer: Phase 4 Part A. That plan consumes Task 8's contract. Exit motion for overlays (it needs the renderer to delay unmounting), scroll locking and an inert background belong there too.
- `<Preview>`: Phase 4 Part B. It is the first consumer of per-surface scoping.
- The design-system conformance suite: Phase 5. Task 11 hands over the cases.
- An auditing pass on real Windows hardware and with assistive technology (G29). It stays a recorded manual gate.
- Shadow-DOM isolation, cascade layers chosen by the library, print styles, compound variants, pseudo-element decoration (`::before`/`::after`), keyframe animations, and design-system-controlled placeholder or scrollbar colours. Task 1 records why each one is out.

Probe answers that hold for every task, unless a task says otherwise:
- **Placement:** `src/css/`. It is host-API-free by construction: it builds strings and plain objects only. The existing `src_is_host_api_free` scan (`src/__tests__/portability.test.ts:31`) covers it with no exception entry. Task 1 removes `/css` from the host-API exception list in spec §13 and the roadmap rules.
- **Four laws:** Law 3 is the one this phase enforces. Every colour in the output is a theme-role variable, `transparent`, `currentColor`, or a CSS system colour inside `@media (forced-colors: active)` (spec §6.1: "In forced-colours mode, OS system colours override everything"). No input reaches the output as raw text: identifiers come from validated patterns, and strings are escaped. Laws 1, 2 and 4 are untouched: `/css` runs no widget code, reads no tree beyond style values the validator has already accepted, and holds no authority.
- **Primitives only:** the library ships a generic reset only. Per-kind structure (a button's `min-height`, the icon's box, the dialog backdrop's fixed position) belongs to the app's primitive implementations (Task 1, decision 2). `proof/` plays the app.
- **Dependencies:** none. No new runtime or dev dependency. Browser tests use the existing `playwright` 1.64.1 dev dependency and its Chromium.
- **Reference hosts:** Synapta and Clay both get per-surface scoping and generic preference handling. Clay's Rack loses its custom scrollbar look: the proof hard-coded a `surface.scrollbar` role, which a library can't do. The look falls back to the native scrollbar of the theme's `color-scheme`, and this is recorded as an adopter gap, not accommodated.
- **Callers:** `proof/renderer/surface.tsx:2` and `proof/renderer/primitives/index.tsx:4` import `slotClasses`, `styleProps`, `hasResponsiveStyles` and `hasResponsiveValues` from `proof/css/project.ts`. Task 10 rewires them; no `src/` code imports the proof projector.

## Tasks

- [x] Task 1: Record the projection decisions and write them into the spec
  - Acceptance Criteria:
    - Functional:
      - `decision-logs/<execution timestamp>-css-projection-model.md`, written with `create-decision-log`, records the decisions below. Its status is accepted, and it cites the owner's delegation of 2026-10-23.
        1. **Three sheets, two scope attributes.** `baseCss` holds the reset, surface typography, the container and the preference overrides. `themeCss` writes role variables and `color-scheme` under `:where([data-lf-theme="<id>@<version>"])`. `designSystemCss` writes value variables, recipe rules and container rules under `:where([data-lf-ds="<id>@<version>"])`. Design-system values only refer to theme roles through `var()`, so the two sheets are independent once the catalog's vocabulary is fixed. **Surfaces do not nest.** A widget tree can't contain a surface, so this holds by construction.
        2. **The base block is a generic reset.** The library emits box-sizing, a zeroed margin and border, `font: inherit` on controls, and the surface typography. Per-kind structural defaults belong to the app's primitive implementation. That is trusted app code, so law 3 doesn't apply to it. This replaces the boundary sentence in spec §6.2 that gives "the projection's base block" headings, the icon's box and control `min-height`s: the library can't know an app's kinds.
        3. **One class per `(kind, variant, slot)`; one rule per state.** The element carries `lf_<kind>_<variant>_<slot>`. Each state is a selector on that class, so the markup is the same under every design system, and it is eight times smaller than the proof's eight classes per slot. Spec §6.4's "one stable class per `(kind, variant, slot, state)`" and §11's `slot(name)` are reworded to match.
        4. **Every rule has the specificity of one class, and source order sets precedence.** The scope, the state and the root qualifier sit in `:where()`. Rest comes first, then `hover < focus < active < open < selected < invalid < disabled`. Hover and active never apply to a disabled element. A root state reaches the root's slots. Native `:hover` applies only inside `@media (hover: hover)`, and `[data-hovered]` applies everywhere.
        5. **The state selector table is normative.** It is written into spec §6.4, so a renderer knows which attributes to set:

           | State | Matches |
           | --- | --- |
           | hover | `:hover` (hover-capable devices), `[data-hovered]` |
           | active | `:active`, `[data-pressed]` |
           | focus | `:focus-visible`, `[data-focus-visible]`, `:has(:focus-visible)` |
           | open | `[open]`, `[data-open]`, `[data-expanded]`, `[aria-expanded=true]`, `:popover-open` |
           | selected | `[data-selected]`, `[aria-selected=true]`, `[aria-checked=true]` |
           | invalid | `:user-invalid`, `[data-invalid]`, `[aria-invalid=true]` |
           | disabled | `:disabled`, `[data-disabled]`, `[aria-disabled=true]` |
        6. **Overlay effects.** `backdropBlur` and `backdropSaturate` compose into one `backdrop-filter`. `backgroundOpacity` multiplies through a `--lf-alpha` variable, so preferences can override it. A slot whose `open` look differs from its rest look **enters** from rest through `@starting-style`, using its own transition. An overlay mounts already open, so without this every transition a design system declares on overlay content never runs (Rack's `motion.enter` value has no effect today). Exit motion belongs to Phase 4. The renderer contract (spec §11) says that overlays stay inside their surface's scope (top layer, or a portal container that carries the scope attributes). It also says that a backdrop slot and the content it covers are siblings, with no ancestor setting `opacity` below 1 or a `filter`, because those form a backdrop root that stops the blur.
        7. **Preferences.** `prefers-reduced-motion: reduce` sets transition durations to zero and drops the pressed offset. `prefers-reduced-transparency: reduce` sets `--lf-alpha` to 1 and turns `backdrop-filter` off. Browser support is limited, so it is a progressive enhancement. `[data-lf-switching]` on a scope element turns transitions off for the frame of a switch (the MUI `disableTransitionOnChange` lesson). Light, dark and high-contrast **selection** stays the host's: they are separate themes (spec §6.1). The theme sheet sets `color-scheme` from `theme.colorScheme`.
        8. **Forced colours.** The OS colours apply (`forced-color-adjust` stays `auto`). Because the eight states are fixed by the library, one generic table restores the cues that forced colours erases:
           - selected becomes a `Highlight` background with `HighlightText`;
           - disabled becomes `GrayText`;
           - focus becomes a 2px solid `Highlight` outline;
           - invalid becomes a 2px dashed `CanvasText` outline;
           - hover, active and open become a 1px `Highlight` outline;
           - a slot whose rest look draws an edge with a background but no border gets a 1px `CanvasText` outline, offset inward;
           - a `fill` indicator keeps its shape through a `CanvasText` outline.

           Each rule is emitted only where the state's recipe differs from rest. No `forced-color-adjust: none` anywhere.
        9. **Logical sides.** `borderLeftWidth`/`borderRightWidth`, `paddingLeft`/`paddingRight` and `marginLeft`/`marginRight` project to `inline-start` and `inline-end`, so they mirror under `dir="rtl"`. Top and bottom stay physical (vertical writing modes are out of scope). The field names don't change. Spec §6.2 and §6.3 define Left as the inline start in left-to-right text.
        10. **Names.** `_` replaces `.` in role and value names, and `__` separates fixed suffixes. No vocabulary, catalog or id name may contain `_`, so the encoding is injective. Classes are `lf_<kind>_<variant>_<slot>`. Variables are `--lf-c-<role>`, `--lf-t-<role>__<field>`, `--lf-v-<name>` and `--lf-r-<prop>__<breakpoint>__<cssProperty>`.
        11. **Coexisting with the host page.** The output is outside any cascade layer: layered CSS loses to all unlayered host CSS, and Liveframe doesn't own the page. A host that wants a layer imports the sheet into one itself. The reset applies only to surface descendants (`:where([data-lf-ds]) *`), never to `[class*=lf-]`, which matches host classes such as `self-start`.
        12. **Platform baseline: Baseline 2024.** The output uses custom properties, `:is`/`:where`/`:has`, `color-mix()`, `oklch()` and `color()`, container queries, `:user-invalid`, `:popover-open`, `@starting-style`, unprefixed `backdrop-filter`, `font-size-adjust` and `text-wrap: balance`.
        13. **`/css` is host-API-free.** It returns strings and plain objects. Inserting a sheet (`<style>`, `<link>`, a CSP nonce) is the host's job.
        14. **Recorded as out:** shadow-DOM isolation (it costs SSR, portals and fonts); print styles; compound variants (kinds have one variant axis); `::before`/`::after`, keyframes and `:nth-child` (they would let installed data add decoration or structure, against `decision-logs/2026-10-22-0850-recipes-own-look-style-props-own-structure.md`); design-system placeholder and scrollbar colours (`color-scheme` gives native ones; backlog); `prefers-contrast` (the host picks a high-contrast theme); an atomic-class route for strict CSP (inline style attributes need `style-src-attr 'unsafe-inline'`, which the docs state; backlog).
      - `docs/spec.md` is updated in this task:
        - §6.2: decisions 2, 4, 6 and 9;
        - §6.3: decision 9;
        - §6.4: decisions 1, 3, 5, 7, 8, 11 and 12;
        - §11: the renderer contract from decisions 1, 3 and 6;
        - §13: decision 13, with `/css` removed from the host-API exception sentence.
      - `roadmap.md` §1's host-API-free rule and `.claude/skills/liveframe-execution/SKILL.md`'s "Host-API-free core" line drop `/css` in the same change. The skill's copy under `.agents/skills/` is identical (`diff -r` shows no difference), so it changes too.
    - Performance: n/a — decisions and documentation.
    - Code Quality: each decision appears once in the spec. The decision log carries its alternatives and the framework evidence; the spec carries only the rule.
    - Security: decisions 8, 10 and 11 are where law 3 and safe output are decided. The colour authority test in Task 3 enforces them.
  - Approach:
    - Skills to Use:
      - `create-decision-log` — evidence, alternatives and the record.
      - `karpathy-guidelines` — every spec sentence states a rule, not a rationale.
    - Library Documentation to Check Before Implementation:
      - none beyond the evidence below. Re-check any Baseline status the decision log cites against MDN when it is written.
    - Documentation Reviewed:
      - Spec §6.1–§6.5, §11, §13.
      - `decision-logs/2026-10-22-0850-recipes-own-look-style-props-own-structure.md`.
      - `proof/css/project.ts`: the hard-coded names (`colour.transparent`, `surface.scrollbar`, the tone map at `:322`), `[class*=lf-]` at `:268`, the `.`→`-` naming at `:5`, and the `transform` used both for the pressed offset and in the switch thumb's base rule.
      - `proof/GAPS.md`: G27, G29, G33 and the Plan 002 Task 5 container-cost findings.
      - Panda CSS (`/chakra-ui/panda`, v2 docs): condition selectors `&:is(:hover, [data-hover])`, `_disabled` with `[aria-disabled=true]`, `_motionReduce`, `_highContrast`, and the layer order `reset < base < tokens < recipes < utilities`.
      - Tailwind CSS v4 docs: the `forced-colors`, `motion-reduce`, `contrast-more`, `print` and `rtl` variants; `hover:` limited to `@media (hover: hover)`.
      - MUI (`/websites/mui_material-ui`): `cssVariables.colorSchemeSelector`, `disableTransitionOnChange`.
      - Radix Themes (`/radix-ui/themes`): `<Theme>` scoping a subtree with data attributes and `.light`/`.dark`, nested overrides.
      - StyleX (`/facebook/stylex`): `createTheme` applies to a subtree; since v0.9.3, nested themes are exclusive.
      - vanilla-extract (`/vanilla-extract-css/vanilla-extract`): `createThemeContract`, a scoped `createTheme` class, recipes with `compoundVariants`.
      - React Aria (`/websites/react-aria_adobe`): `data-hovered` (never set on touch), `data-pressed`, `data-focus-visible`, `data-selected`, and per-component `@media (forced-colors: active)` rules.
      - Fluent UI v9 (`/microsoft/fluentui`): forced-colours mappings (primary → `Highlight`/`HighlightText`, hover inverted, disabled → `GrayText`, focus outline in the system colour).
      - DTCG 2025.10 resolver (`/design-tokens/community-group`): modes are modifier contexts, resolved before use.
      - Style Dictionary (`/style-dictionary/style-dictionary`): `css/variables` with a `selector` option and sorting.
      - Filter Effects Level 2 (backdrop root): an ancestor with a filter, `opacity` or `backdrop-filter` limits what a descendant's `backdrop-filter` sees.
      - MDN, rechecked 2026-10-23: `@starting-style` Baseline August 2024, unprefixed `backdrop-filter` September 2024, `font-size-adjust` July 2024; `prefers-reduced-transparency` limited availability; `@scope` Baseline March 2026 (correcting the original December 2025 claim), kept as the way to lift the no-nesting rule later. Links are in the Task 1 decision log.
    - Options Considered:
      - One global `:root` sheet per theme × design system (the proof's model) — rejected: it can't draw the `<Preview>` matrix or two styled surfaces on one page (G27), and the sheets multiply.
      - Design-system-qualified class names — rejected: a switch would change every node's class, which breaks "no re-render" and markup stability.
      - Component tokens: recipe rules read per-tuple variables, so a switch only changes variables — rejected: it needs a variable per tuple, state and property (thousands per design system). Breakpoints still can't be variables, because `@container` conditions don't take `var()`. It also buys only nesting, which surfaces don't need.
      - `@scope` donut scoping now — rejected: it only matters for nested surfaces, which can't happen. It stays the upgrade path.
      - Keeping the per-kind base block in `/css` — rejected: the library has no catalog of its own.
      - Eight classes per slot — rejected: the markup costs eight times more, with no more expressiveness.
      - `forced-color-adjust: none` on `fill` indicators — rejected: it goes against spec §6.1. An outline keeps the shape and the OS keeps the colours.
      - Renaming the side fields to `…InlineStart…` — rejected: it touches the Phase 1 formats, schemas, generated types and fixtures for no change in meaning.
    - Chosen Approach:
      - The decisions above, recorded once, written into the spec in the same change.
    - API Notes and Examples:
      ```html
      <section class="lf_surface lf_container" data-lf-theme="certified@1" data-lf-ds="certified@1">
        <button class="lf_button_primary_root" data-hovered>…</button>
      </section>
      ```
    - Files to Create/Edit:
      - `decision-logs/<execution timestamp>-css-projection-model.md`: new.
      - `docs/spec.md`: §6.2, §6.3, §6.4, §11, §13.
      - `roadmap.md`: §1 host-API-free rule.
      - `.claude/skills/liveframe-execution/SKILL.md`, `.agents/skills/liveframe-execution/SKILL.md`: the host-API-free line.
      - `.claude/skills/liveframe-execution/references/architecture.md` and its `.agents` copy: the `/css` row changes from "DOM optional" to "No".
      - `.agents/skills/liveframe-execution/references/styling.md` and its `.claude` copy: align the target boundary and stable slot class with the spec; keep "Today" unchanged until implementation ships.
      - `.agents/skills/create-plan/references/liveframe.md` and its `.claude` copy: align the host-API placement probe with spec §13.
  - Test Cases to Write:
    - n/a — documentation only. `bun run check` stays green. Tasks 3–9 test every rule written here.
  - Notes (executed 2026-10-23):
    - Accepted `decision-logs/2026-10-23-2314-css-projection-model.md` records all fourteen decisions, the owner's delegation, alternatives, local evidence and support references. No further approval gate was needed: this task was explicitly authorized.
    - Updated spec §6.2–§6.4, §11 and §13, the roadmap's Phase 3 goal and host-API rule, and the execution skill's architecture/styling targets. Synced the create-plan placement probe because it also treated `/css` as a host-API exception. The `.agents` and `.claude` skill copies are identical (shared hard links; `diff -r` passes).
    - MDN recheck corrected `@scope` to Baseline March 2026; it remains outside the Baseline 2024 floor. Reduced transparency is documented as limited-support progressive enhancement. No projection API or schema shipped here; `surfaceTypography` stays in Task 2, and runtime/browser proofs stay in Tasks 3–10.
    - Validation: `timeout 600s bun run check` passed (322 tests, 0 failures; generation check, typecheck, lint and format check passed). `git diff --check` passed. Browser parity and hardware auditing were not rerun for this documentation-only task.

- [x] Task 2: Declare the surface's base typography in the vocabulary
  - Acceptance Criteria:
    - Functional:
      - The vocabulary gains a required `surfaceTypography`: one name from `typographyRoles`. It is the role every surface root sets (spec §6.4), so the projection names no role itself. The proof hard-coded `body`.
      - `validateVocabulary` rejects a missing field, a name that isn't in `typographyRoles`, and a malformed name. Each failure is a bounded error with a JSON Pointer.
      - The published JSON Schema and the TS type change together.
      - `proof/scripts/export-formats.ts` writes `surfaceTypography: "body"`, and every committed vocabulary and catalog fixture is regenerated to match. `proof-formats.test.ts` still proves reproducibility.
      - Spec §6.5's `Vocabulary` block and `docs/formats.md`'s vocabulary section document the field.
    - Performance: n/a — install-time check over one field.
    - Code Quality: one new entry in `src/formats/vocabulary.ts`, checked by the existing cross-reference pass. No new module.
    - Security: law 3 — the projection never invents a typography role, and an unknown one fails install.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (formats reference) — the format chores.
    - Library Documentation to Check Before Implementation:
      - none — local schema language (`src/schema.ts`) and `docs/formats.md`.
    - Documentation Reviewed:
      - `src/formats/vocabulary.ts:4-35`: the `lists`, `vocabularySchema` and `validateVocabulary`.
      - Spec §6.4 ("Every surface root sets the theme's base typography") and §6.5.
      - `proof/css/project.ts:270`: `.lf-surface` reads `--lf-type-body-*`.
    - Options Considered:
      - A `/css` option such as `{ surfaceTypography: "body" }` — rejected: a non-CSS platform that implements the resolver output (spec §6.4) would need the same declaration, so it belongs in the catalog's vocabulary.
      - Use the first declared typography role — rejected: an implicit ordering rule nobody would guess.
      - A theme field — rejected: every theme for a catalog would have to repeat the same choice.
    - Chosen Approach:
      - A required vocabulary name, next to `tones`, which is the other app declaration about meaning.
    - API Notes and Examples:
      ```json
      { "typographyRoles": ["body", "label", "heading.2", "mono"], "surfaceTypography": "body" }
      ```
    - Files to Create/Edit:
      - `src/formats/vocabulary.ts`: the field and its cross-reference check.
      - `src/formats/catalog.ts`, `src/__tests__/catalog.test.ts`: handle the new scalar field in catalog change classification, following the existing mapping-change rule.
      - `src/__tests__/vocabulary.test.ts`: new cases.
      - `src/__tests__/design-system.test.ts`, `src/__tests__/fixtures/vocabulary.json`, `src/__tests__/fixtures/rack.design-system-vocabulary.json`: update the remaining vocabulary inputs.
      - `proof/scripts/export-formats.ts`: emit the field.
      - `src/__tests__/fixtures/proof/vocabulary.json`, `src/__tests__/fixtures/proof/catalog.json`, `src/__tests__/fixtures/catalog.json`: regenerated or edited.
      - `schemas/catalog.json`: regenerated (the vocabulary schema is embedded in the catalog schema; `src/formats/vocabulary.ts:35` and `src/__tests__/vocabulary.test.ts:78` are its other users).
      - `docs/spec.md` §6.5, `docs/formats.md`.
  - Test Cases to Write:
    - `vocabulary_requires_surface_typography`: a missing field fails at `/surfaceTypography`. Fails if the field is optional.
    - `surface_typography_must_be_a_declared_role`: `"display"`, when it isn't in `typographyRoles`, fails. Fails if the cross-reference is skipped.
    - Malformed surface typography names fail structural validation and JSON Schema at `/surfaceTypography`; a renamed declared role succeeds.
    - `surface_typography_changes_are_classified`: changing the selected role is a major mapping change; unchanged catalogs remain `none`.
    - The existing `schemas.test.ts` agreement and `proof-formats.test.ts` reproducibility cases cover the schema and the fixtures.
  - Notes (executed 2026-10-23):
    - Added required `surfaceTypography` to the vocabulary type, structural schema and install-time cross-reference checks. Missing, malformed and undeclared roles fail with bounded errors at `/surfaceTypography`; selecting a renamed declared role succeeds. Spec §6.5 and the formats guide document the contract.
    - The proof exporter emits `body`; regenerated the catalog schema and all proof fixtures, and updated the base and Rack vocabulary fixtures and inline test catalogs. Existing valid name-boundary tests now select the role they declare.
    - Required caller fix: the catalog change classifier assumed all non-tone vocabulary fields were lists. It now handles the scalar selection as a major mapping change, following the existing tone-mapping rule, with a regression test and guide update.
    - Validation: new tests failed before implementation; `timeout 600s bun run check` passed (325 tests, 0 failures, generation check, typecheck, lint and format check). The existing lint warnings remain. A temporary-directory export reproduced all 17 committed proof fixtures byte-for-byte. CSS projection and new projection browser proofs remain in Tasks 3–10.

- [x] Task 3: Project the base and the theme
  - Acceptance Criteria:
    - Functional:
      - `src/css/names.ts` implements decision 10. `colourVar(role)` and `valueVar(name)` are exported for app primitives that need to refer to a role or a value.
      - `themeCss(theme, catalog)` validates with `validateTheme` and returns `Result<string>`. It emits under `:where([data-lf-theme="<id>@<version>"])`:
        - one `--lf-c-*` per colour role, converted from every DTCG 2025.10 colour space to its CSS form: `color(srgb …)`, `color(srgb-linear …)`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, and `color(<space> …)` for display-p3, a98-rgb, prophoto-rgb, rec2020, xyz-d65 and xyz-d50. The `none` keyword is kept, and alpha becomes `/ <alpha>`;
        - one `--lf-t-<role>__<field>` per typography field. Units stay as authored (`rem` stays `rem`) and `lineHeight` stays unitless. Font families are quoted and escaped, except for CSS generic family keywords. `fontSizeAdjust` becomes `ex-height <n>` or `none`;
        - `color-scheme: light` or `dark` from `theme.colorScheme`.
      - `baseCss(catalog)` emits:
        - the reset under `:where([data-lf-ds]) *`, with `font: inherit` on controls;
        - `.lf_surface` with the vocabulary's `surfaceTypography`;
        - `.lf_container` as a named inline-size container (`container-name: lf`);
        - the preference and switching rules that Tasks 6 and 7 add.
      - Neither sheet contains a vocabulary name the input didn't declare. `colour.transparent`, `surface.scrollbar` and `body` from the proof are gone.
      - Same input, same bytes: roles and fields are emitted in sorted order.
    - Performance: generation time and sheet bytes are recorded for both proof themes in `bench/css.bench.ts`. There is no budget: hosts cache sheets by input.
    - Code Quality: plain functions over the validated types (`Theme`, `Catalog`). No class and no builder abstraction. Serialization helpers live with their only callers.
    - Security: law 3 — the colour authority test passes. Invalid input fails closed with the validator's typed errors, and the projection never emits a partial sheet.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (styling reference) — the projection rules.
      - `karpathy-guidelines` — the smallest serializer that holds.
    - Library Documentation to Check Before Implementation:
      - DTCG 2025.10 Color module, §4.2 (supported colour spaces and component order): https://www.designtokens.org/tr/2025.10/color/
      - CSS Color 4: `color()` predefined spaces and the `none` keyword (MDN `color()`).
      - CSS Fonts 4: generic family keywords (MDN `font-family`).
    - Documentation Reviewed:
      - `src/formats/theme.ts:17-60`: the colour spaces and ranges, and the `id`/`version` patterns.
      - `src/formats/dtcg.ts:1-60`: `Colour` with `"none"` components; `fontName` forbids `;{}\`, control characters and `url(`, but allows quotes, so quoting must escape them.
      - `proof/css/project.ts:161-200`: the proof's typography variables and defaults.
      - Rechecked 2026-10-23: [DTCG 2025.10 colour spaces](https://www.designtokens.org/tr/2025.10/color/#supported-color-spaces), [font-weight aliases](https://www.designtokens.org/tr/2025.10/format/#font-weight), and MDN's `color()`, `font-family`, `hsl()`, `hwb()` and `font-size-adjust` references (Context7 `/mdn/content`). HSL/HWB percentage components keep `%`; weight aliases map to their DTCG numeric values.
    - Options Considered:
      - Convert every colour to sRGB hex — rejected: it loses wide-gamut colours and the DTCG source space for no gain under Baseline 2024.
      - Emit the `hex` fallback alongside the colour — rejected: every target browser parses the colour functions.
      - Keep `:root` and offer a `selector` option, as Style Dictionary does — rejected: decision 1 makes the scope attribute the contract, and an option would be a second way to scope.
    - Chosen Approach:
      - Two pure functions over validated documents, with shared escaping in `names.ts`. Both validate the catalog before building CSS; `themeCss` also calls `validateTheme`. Optional typography fields emit neutral defaults so switching to a theme without them resets the previous theme's values. Scope versions and font-family strings are escaped, including `<` for embedding sheets in a style element.
    - API Notes and Examples:
      ```ts
      import { baseCss, themeCss } from "@arnilo/liveframe/css";
      const theme = themeCss(certifiedTheme, catalog);
      // :where([data-lf-theme="certified@1"]){color-scheme:light;--lf-c-surface_base:oklch(0.966 0.01 172);…}
      ```
    - Files to Create/Edit:
      - `src/css/names.ts`, `src/css/theme.ts`, `src/css/base.ts`, `src/css/index.ts`: new.
      - `src/__tests__/css-theme.test.ts`: new.
      - `bench/css.bench.ts`: new. `package.json`'s `bench` script runs it.
  - Test Cases to Write:
    - `names_are_injective`: every pair of distinct names from a generated set with dots and hyphens (`a.b-c` versus `a-b.c`) encodes to distinct variables and classes. Fails under the proof's `.`→`-` scheme.
    - `every_dtcg_colour_space_serializes`: one fixture per space, with alpha and `none`, gives the expected CSS text. Fails if a space is missing or reordered.
    - `font_families_are_quoted_and_escaped`: `Inter "Display"` is quoted and escaped, and `system-ui` stays bare. Fails if a quote could close the string.
    - `theme_sheet_sets_color_scheme`: `dark` themes emit `color-scheme: dark`.
    - `colour_authority_holds`: across the base and theme sheets for both proof themes, every colour-valued declaration is a role variable, `transparent`, `currentColor`, or a system colour inside the forced-colours block. Fails on any literal colour outside the theme variables.
    - `surface_typography_comes_from_the_vocabulary`: renaming the role in a test vocabulary renames the variables `.lf_surface` reads. Fails if `body` is hard-coded.
    - `projection_is_deterministic`: two runs give identical bytes, and shuffling the input's key order doesn't change them.
    - `invalid_theme_fails_closed`: a theme missing a declared role returns the validator's error and no CSS.
  - Notes (executed 2026-10-23):
    - Added `src/css/` with the generic scoped reset, vocabulary-selected surface typography, named optional container, theme colour/typography variables, and injective variable/class names. Both sheet functions return validator errors without a partial sheet. Theme roles and fields are sorted; all fourteen DTCG colour spaces preserve components, authored units and alpha. Font-family quoting, DTCG weight aliases and neutral typography defaults are covered.
    - Ten tests cover naming, every colour space (including `none` and zero alpha), family quoting/generics, typography defaults and units, colour scheme, vocabulary selection, colour authority with negative controls, shuffled-key determinism, unchanged inputs, invalid documents and string escaping. Tests were written first and failed before the projection modules existed.
    - `timeout 600s bun run check` passed: 335 tests, 0 failures, generation check, typecheck, lint and format check. Existing lint warnings remain; the six new files pass lint without warnings. `git diff --check` passed.
    - Added `bench/css.bench.ts` to `bun run bench`. `timeout 60s bun bench/css.bench.ts` (200 warm-ups, 1,000 measured projections including validation): base 0.388 ms / 601 bytes; Certified theme 0.789 ms / 7,754 bytes; Rack theme 0.729 ms / 9,176 bytes. Generation has no budget; hosts cache sheets by input.
    - No spec change or dependency. Package export/docs remain Task 8; preference/switching rules and forced-colour overrides remain Tasks 6–7. No new browser proof or parity capture was run for these serializers; the existing browser suite passed through `bun run check`.

- [x] Task 4: Project design-system values and recipes into ordered state rules
  - Acceptance Criteria:
    - Functional:
      - `designSystemCss(designSystem, { catalog, registry })` resolves through `resolveRecipes` (`src/resolve.ts:69`) and returns `Result<string>` under `:where([data-lf-ds="<id>@<version>"])`.
      - A `--lf-v-*` variable is emitted for every declared `space.*`, `radius.*` and `size.*` name, in its authored unit. Breakpoints are not variables (Task 5).
      - Every one of the 27 recipe properties in `recipeProperties` (`src/formats/fixed.ts`) has one mapping:
        - colours become role variables;
        - side border widths are logical (decision 9), and a width without `borderStyle` implies `solid` on that side only;
        - `backgroundOpacity` becomes `color-mix(in srgb, var(--lf-c-…) calc(var(--lf-alpha) * 100%), transparent)` with `--lf-alpha` set in the same rule;
        - `backdropBlur` and `backdropSaturate` become one unprefixed `backdrop-filter`;
        - `translateY` uses the `translate` property, so it never fights a primitive's own `transform`;
        - a shadow layer's colour is its theme-role variable, preserving that role's alpha (the installed shadow format has no layer alpha field);
        - `transitionDuration` and `transitionTiming` come with `transition-property` covering `background-color, color, border-color, outline-color, opacity, translate, box-shadow, backdrop-filter`.
      - `slotClass(kind, variant, slot)` returns `lf_<kind>_<variant>_<slot>`. A rest rule is emitted for every catalog tuple. A state rule is emitted only where its resolved declarations differ from rest, in the order and with the selectors of decisions 4 and 5. A root state reaches every slot of the same kind and variant.
      - Every selector has specificity (0,1,0).
    - Performance: generation time and bytes for both proof design systems (616 resolved recipes each) are recorded in `bench/css.bench.ts`. No budget; hosts cache by input.
    - Code Quality: the property mapping is one table keyed by `recipeProperties`, so a property without a mapping is a type error. No per-kind branch: the proof's `scroll`/`scrollbar` special case at `proof/css/project.ts:229` does not carry over.
    - Security: law 3 — the colour authority test (Task 3) also covers both design-system sheets. A recipe that references an undeclared value or role fails through `prepareDesignSystem` before any CSS is built.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (styling reference).
      - `typescript-advanced-types` — a mapping table typed so it must be exhaustive over `recipeProperties`.
    - Library Documentation to Check Before Implementation:
      - MDN: `:where()`/`:is()` specificity, `color-mix()`, `translate`, `backdrop-filter`, `transition-property`.
      - React Aria Components 1.22.1 styling guide: the data attributes in decision 5.
    - Documentation Reviewed:
      - `src/resolve.ts:15-67`: `cascadeRecipes` resolves value references to literals but keeps colour and typography role names.
      - `src/formats/design-system.ts:43-72`: `propertyKinds`.
      - React Aria's current interaction/styling docs, retrieved through Context7 (`/websites/react-aria_adobe`): `data-hovered`, `data-pressed`, `data-focus-visible` and touch-hover behaviour. MDN: `:where()`, `color-mix()`, `translate`, `backdrop-filter` and `transition-property`.
      - `proof/css/project.ts:47-159`: the proof's mapping, kept where it is right (per-side border style) and replaced where it isn't (`transform`, eight classes, `[data-focused]`).
      - The Rack fixture: `dialog.default.backdrop.rest` sets `backgroundOpacity: 0.74`, `backdropBlur: 2px` and a 140 ms transition; `button.primary.root.active` sets `translateY: 1px`.
    - Options Considered:
      - Emit values as variables and have recipes refer to them — rejected: the resolver already inlines literals, and only style props need value variables.
      - Let states raise specificity, as the proof does — rejected: the order of selected + hover would depend on selector shape, not on decision 4.
      - Emit every state rule even when it equals rest — rejected: spec §6.2 already says it gets no rule.
    - Chosen Approach:
      - One pass over the resolved table per tuple: rest, then the ordered states, each wrapped in the scope.
    - API Notes and Examples:
      ```css
      :where([data-lf-ds="rack@1"]) .lf_button_primary_root{background-color:var(--lf-c-accent_primary);…}
      @media (hover:hover){:where([data-lf-ds="rack@1"]) .lf_button_primary_root:where(:hover:not(:disabled,[data-disabled],[aria-disabled=true])){--lf-alpha:0.86;…}}
      :where([data-lf-ds="rack@1"]) :where(.lf_button_primary_root:is(:hover,[data-hovered])) .lf_button_primary_label{…}
      ```
    - Files to Create/Edit:
      - `src/css/design-system.ts`, `src/css/recipe.ts` (the property table): new.
      - `src/css/index.ts`: exports.
      - `src/__tests__/css-design-system.test.ts`: new.
      - `src/__tests__/css-browser.test.ts`: new. A Playwright page built with `page.setContent` from hand-written markup and the projected sheets.
      - `bench/css.bench.ts`: extended.
  - Test Cases to Write:
    - `every_recipe_property_projects`: a fixture recipe that sets all 27 properties gives the expected declarations. Fails if a property is dropped or mapped twice.
    - `side_widths_style_only_their_side`: `borderLeftWidth` alone sets `border-inline-start-width` and `border-inline-start-style: solid`, and nothing else.
    - `states_equal_to_rest_emit_no_rule`: the count of state rules equals the count of tuples whose state differs from rest.
    - `every_selector_has_one_class_specificity`: a small specificity counter over every emitted selector returns (0,1,0).
    - `slot_class_is_design_system_independent`: `slotClass` takes no design system, and both proof sheets target the same class set.
    - Browser `state_precedence_follows_the_fixed_order`: an element with `data-selected` and `data-hovered` computes the selected look, and one with `data-disabled` and `data-hovered` computes the disabled look. Fails if specificity or order changes.
    - Browser `touch_has_no_sticky_hover`: emulating a device without hover (`hasTouch`, `isMobile`), a tapped element doesn't compute the hover look unless `data-hovered` is set.
    - Browser `root_state_reaches_slots`: hovering a button root changes its label slot's computed colour.
    - Browser `pressed_offset_composes_with_transform`: an element with a primitive's own `transform` and the active `translate` keeps both.
  - Notes (executed 2026-10-23):
    - Added `designSystemCss()` and an exhaustive typed mapping over all 27 `recipeProperties`; exported the existing stable `slotClass()` helper. Catalog and design-system validation return typed errors before any CSS is emitted. The projector uses `resolveRecipes()` and inherited values, preserves authored units, emits only vocabulary-declared spacing/radius/size variables, and sorts inputs for deterministic output without mutation.
    - State rules follow `rest < hover < focus < active < open < selected < invalid < disabled`, with all qualifiers inside `:where()`. Native hover is restricted to hover-capable devices; root states reach slots, and disabled roots suppress both a slot's own and inherited hover/press. Equal-to-rest states emit nothing. No per-kind branch or new dependency.
    - Corrected the shadow criterion to match the installed format: shadow layers have no alpha field. Their theme-role variable already carries alpha, including the proof exporter's expanded shadow roles; no literal colour or redundant colour mixing is needed. No spec or format change.
    - Tests were written first and failed before the modules existed. Seven new unit tests cover all property mappings, logical side borders, filter composition, empty shadows, inherited values/units, rule omission, stable classes, selector specificity, deterministic output and validation failures. Five new Chromium tests cover the complete precedence order, native and ARIA selectors, focus within a root, popover-open, touch hover, root-to-slot propagation, disabled-root suppression and pressed-offset composition with primitive transforms. The existing colour-authority test now scans both proof design-system sheets.
    - `timeout 600s bun run check` passed: 347 tests, 0 failures, generation check, typecheck, lint and format check. Existing lint warnings remain; task files introduce none. The 22 focused CSS tests and `git diff --check` passed. Refreshed the local graft graph.
    - Extended `bench/css.bench.ts`. `timeout 90s bun bench/css.bench.ts` (200 warm-ups, 1,000 measured projections, including validation/resolution): Certified design system 9.434 ms / 98,180 bytes; Rack 13.295 ms / 103,228 bytes. Each input resolves 616 recipes. No generation-time budget; hosts cache sheets by input.
    - Responsive/container projection remains Task 5; preference/entry and forced-colour rules remain Tasks 6–7; package export/docs remain Task 8; proof-host integration and parity remain Task 10. No new parity capture was run.

- [x] Task 5: Map style props and responsive values
  - Acceptance Criteria:
    - Functional:
      - `styleDeclarations(style, catalog)` returns `{ style: Record<string, string>, classes: readonly string[] }` for a validated node's style. Every style prop in `styleProps` (`src/formats/fixed.ts`) maps as in spec §6.3:
        - `paddingLeft`/`paddingRight`/`marginLeft`/`marginRight` become inline-start and inline-end (decision 9);
        - tones resolve through `vocabulary.tones`, not a hard-coded map;
        - `fill` adds `lf_fill` to `classes` (Task 7 uses it);
        - `fit` sizes a box with `fit-content`, and `Nfr` tracks become `minmax(0, Nfr)`;
        - the proof-only `fit` grid track is not supported.
      - A responsive value writes `--lf-r-<prop>__<breakpoint>__<cssProperty>` variables and adds `lf_r_<prop>` to `classes`. `designSystemCss` emits, per design system, the `lf_r_*` rules that chain each value through every narrower breakpoint (spec §6.3, "holds at every wider one") inside `@container lf (min-width: <breakpoint>)`, using the design system's breakpoint values.
      - `surfaceAttributes({ theme, designSystem, tree })` returns the root's `class` (`lf_surface`, plus `lf_container` only when the tree has a responsive value, spec §6.4), `data-lf-theme` and `data-lf-ds`.
    - Performance: `styleDeclarations` over the 679-node agent-home tree (`src/__tests__/fixtures/proof/agent-home.tree.json`) costs ≤ 1 µs per node in `bench/css.bench.ts` (≈ 0.7 ms per tree). It runs in the browser on every render, so it must stay a small share of a 16.67 ms frame next to React's reconciliation. A slower result is recorded, not hidden.
    - Code Quality: one table keyed by `styleProps`, exhaustive by type. Breakpoint chaining is written once and shared by every prop.
    - Security: law 3 — `surface` and `fill` read only declared roles (the validator already enforces this), and every value goes through the same name encoding. A style object with an unknown prop or value returns an error instead of emitting it.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (styling reference).
      - `typescript-advanced-types` — exhaustive tables over `styleProps`.
    - Library Documentation to Check Before Implementation:
      - MDN: `@container` with a container name, `container-name`, logical properties (`padding-inline-start`, `margin-inline-end`).
    - Documentation Reviewed:
      - Spec §6.3 (style prop table, responsive values), §6.4 (container only for responsive surfaces).
      - `proof/css/project.ts:298-418`: the `aliases`, `assign` and responsive chaining the real mapping replaces.
      - `src/sdk/gen.ts:69-72`: `align`, `justify` and `textAlign` are already logical (`start`/`end`).
      - `plans/backlog.md`, "Reconcile proof grid tracks before SDK and CSS integration": the SDK port already removed `fit` tracks.
    - Options Considered:
      - Return a React `CSSProperties` object, as the proof does — rejected: `/css` must not depend on React types, and Phase 4 adapts a plain record.
      - Emit atomic classes for token-valued props — rejected for now: it needs a catalog-wide class sheet and only matters for strict CSP (decision 14). It goes to the backlog.
      - An unnamed container — rejected: an unnamed `@container` query can match a host container placed inside the surface's ancestry when a non-responsive surface has none. Naming makes the surface the only target.
    - Chosen Approach:
      - One pure mapping for inline values and classes, plus per-design-system container rules, because conditions can't read `var()`.
    - API Notes and Examples:
      ```ts
      const { style, classes } = styleDeclarations({ gap: "space.3", columns: { base: ["1fr"], "bp.md": ["2fr", "1fr"] } }, catalog);
      // style: { gap: "var(--lf-v-space_3)", "--lf-r-columns__base__gridTemplateColumns": "minmax(0, 1fr)", … }
      // classes: ["lf_r_columns"]
      ```
    - Files to Create/Edit:
      - `src/css/style-props.ts`, `src/css/surface.ts`: new.
      - `src/css/design-system.ts`: container rules.
      - `src/css/index.ts`: exports.
      - `src/__tests__/css-style-props.test.ts`: new.
      - `src/__tests__/css-browser.test.ts`: extended.
      - `bench/css.bench.ts`: extended.
  - Test Cases to Write:
    - `every_style_prop_maps`: each prop and each value form (token, enum, fraction, bounded `ch`/`%`, `fit`, `fill`, `full` radius) gives the expected declaration. Fails if a prop is missing.
    - `tones_come_from_the_vocabulary`: a custom vocabulary tone maps to its role.
    - `container_only_for_responsive_trees`: `surfaceAttributes` adds `lf_container` only when a node has a responsive value.
    - Browser `responsive_value_holds_at_wider_breakpoints`: a value set at `bp.sm` still applies at a container wider than `bp.md` when `bp.md` is unset. Fails if chaining resets.
    - Browser `breakpoints_follow_the_design_system`: the same markup switches columns at Certified's breakpoint under Certified, and at Rack's under Rack.
    - Browser `sides_mirror_in_rtl`: under `dir="rtl"`, `paddingLeft` and `borderLeftWidth` compute on the right edge.
    - Bench `style_declarations_per_node`: records µs per node on agent-home.
  - Notes (executed 2026-10-24):
    - Added `src/css/style-props.ts`: one type-exhaustive mapping for all 38 fixed style props, logical sides, vocabulary tones, typography, token dimensions, grid tracks, fill classes and responsive custom properties. Reuses `compileStyles`, cached by installed catalog identity; invalid props/values throw before returning a declaration object. Catalogs are installed, immutable inputs.
    - Added `surfaceAttributes` and the two internal `/css` exports. Responsive detection walks the whole tree, including the root; grid track arrays do not trigger containment. Package subpath publication and outsider documentation remain Task 8.
    - `designSystemCss` now emits named container rules using inherited design-system breakpoint values, ordered by width (rem normalised at 16px; mixed-unit ordering assumes a 16px root), with one shared fallback chain per property. Each responsive class resets its own custom properties to prevent nested nodes inheriting an ancestor's overrides.
    - Tests were written first (the mapper test initially failed on the missing export). All 38 props are checked in scalar and responsive forms, with additional value-form, vocabulary/colour-authority, rejection, surface-containment and browser cases. Existing recipe-count/slot-class assertions now distinguish responsive rules; the colour-authority guard admits only the responsive colour chains, with mapped values separately checked against declared roles.
    - Browser evidence: sparse breakpoint values hold above wider unset keys; switching Certified/Rack scope attributes changes the threshold without changing markup; padding and recipe borders mirror in RTL; responsive descendants keep their own values. Named size queries style descendants, so the renderer must put the surface container above the responsive tree root (Task 8 contract / Phase 4).
    - `timeout 600s bun run check` passed: generated-code check, both typechecks, lint, formatting and 356 tests / 109,147 assertions. No spec change or dependency added.
    - `timeout 90s bun bench/css.bench.ts` (200 warm-ups, 1,000 measured runs): 679-node agent-home mapping 0.737 µs/node, 0.500 ms/tree (budget ≤ 1 µs/node). Certified design-system sheet 10.701 ms / 122,803 bytes; Rack 13.545 ms / 127,281 bytes. Generation includes validation/resolution and has no time budget. Full proof-host integration/parity remains Task 10.

- [x] Task 6: Overlay effects and motion: blur, translucency, entry, reduced motion and transparency, and switching
  - Acceptance Criteria:
    - Functional:
      - Blur and translucency: a backdrop slot (`dialog.default.backdrop` in the proof) whose recipe sets `backdropBlur`, `backdropSaturate` and `backgroundOpacity` blurs and tints what lies behind it. The same holds for a popover or menu content slot with a frosted look.
      - Entry motion (decision 6): for every tuple whose `open` declarations differ from its rest declarations, `designSystemCss` emits an `@starting-style` block that gives the open element its rest declarations. An overlay inserted already open then transitions from rest to open with its recipe's duration and easing. A tuple whose open look equals rest emits nothing.
      - `baseCss` adds:
        - `@media (prefers-reduced-motion: reduce)`: `transition-duration: 0s !important` and `translate: none !important` on surface descendants, so an entry has no motion;
        - `@media (prefers-reduced-transparency: reduce)`: `--lf-alpha: 1 !important` and `backdrop-filter: none !important`;
        - `[data-lf-switching] *`, and the scope element itself: `transition: none !important`.
      - `docs/styling.md` (Task 8) carries the renderer contract for overlays: in scope, backdrop and content as siblings, no `opacity` below 1 or `filter` on the backdrop's ancestors. It also carries the host's switch sequence: set `data-lf-switching`, change the scope attributes, remove `data-lf-switching` on the next animation frame.
    - Performance: the Task 9 switch measurement runs with the blurred dialog open, so the cost of the blur is inside the 16.67 ms budget, not beside it.
    - Code Quality: entry motion is derived from data the format already carries. No new recipe property, state or value type.
    - Security: law 3 — no new colour path. Preference overrides only zero or neutralise values.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (styling reference).
    - Library Documentation to Check Before Implementation:
      - MDN `@starting-style` and `transition-behavior` (Baseline 2024); web.dev "Now in Baseline: animating entry effects".
      - Filter Effects Level 2, "backdrop root" (https://drafts.csswg.org/filter-effects-2/).
      - MDN `prefers-reduced-motion`, `prefers-reduced-transparency`.
      - Playwright 1.64 `page.emulateMedia({ reducedMotion })`. Playwright has no reduced-transparency option, so use a CDP session (`Emulation.setEmulatedMedia` with `features: [{ name: "prefers-reduced-transparency", value: "reduce" }]`). Confirm against the Chromium the dev dependency installs.
    - Documentation Reviewed:
      - The Rack fixture: `dialog.default.backdrop.*` (blur 2px, opacity 0.74, 140 ms), and the unused `motion.enter`, `opacity.veil` and `blur.veil` values. The Certified fixture: `dialog.default.backdrop.*` (opacity 0.78, no blur).
      - `proof/css/project.ts:141-144`: blur and saturate as two variables feeding one `backdrop-filter`.
      - MUI `disableTransitionOnChange`; Tailwind `motion-reduce`; Panda `_motionReduce`.
    - Options Considered:
      - Add `entering`/`exiting` states, as React Aria's `data-entering`/`data-exiting` do — rejected: it is a format change, and `@starting-style` gives entry from the data that exists. Exit needs the renderer and is Phase 4's.
      - Leave blur entirely to the format and skip a browser proof — rejected: the backdrop-root rule fails silently, and the switch budget has never been measured with a blur on screen.
      - Drop backdrop blur from the projection — rejected: it is in the closed recipe list (spec §6.2), Rack uses it, and it is a common native-looking veil.
    - Chosen Approach:
      - Derive entry from rest→open, compose blur in one declaration, and neutralise motion and transparency with three generic preference rules.
    - API Notes and Examples:
      ```css
      @starting-style{:where([data-lf-ds="rack@1"]) .lf_popover_default_content:where(:is([open],[data-open],:popover-open)){opacity:0;translate:0 4px}}
      ```
    - Files to Create/Edit:
      - `src/css/design-system.ts`, `src/css/base.ts`: the rules above.
      - `src/__tests__/css-design-system.test.ts`, `src/__tests__/css-browser.test.ts`: extended.
  - Test Cases to Write:
    - `entry_rules_only_where_open_differs`: Rack and Certified emit `@starting-style` exactly for tuples whose open look differs from rest.
    - Browser `backdrop_blurs_the_page_behind_it`: a backdrop over a striped background computes `backdrop-filter: blur(2px)` and a translucent background. A screenshot of the region differs from the unblurred one. Fails if the filter composition breaks.
    - Browser `opacity_ancestor_breaks_blur_is_documented_contract`: the same backdrop inside an `opacity: 0.99` ancestor blurs nothing. This pins the contract the docs state. It is not a projection failure.
    - Browser `overlay_enters_from_rest`: a content element inserted with `data-open` computes its rest opacity in the first frame and its open opacity after the transition.
    - Browser `reduced_motion_removes_transitions`: under `reducedMotion: "reduce"`, `transition-duration` computes `0s` and `translate` computes `none`.
    - Browser `reduced_transparency_makes_backdrops_opaque`: under the emulated feature, the backdrop's background alpha is 1 and `backdrop-filter` is `none`.
    - Browser `switching_suppresses_transitions`: with `data-lf-switching` set, flipping `data-lf-theme` gives the final colour in the same frame.
  - Notes (executed 2026-10-24):
    - Added scoped `@starting-style` blocks only where resolved open declarations differ from rest, reusing the existing selector so both a slot's own open state and its root's state receive entry styles. Existing recipe projection already composes blur/saturation and supplies the alpha variable; no property, format, export or dependency changed.
    - Added generic base rules for reduced motion (zero duration, no translate), reduced transparency (opaque alpha multiplier, no backdrop filter), and switching (no transition on the marked scope or its descendants). Implements the accepted spec §6.2/§6.4 rules without changing their meaning.
    - Tests were written first: the entry unit test failed on missing starting blocks; browser cases failed on absent entry/preference/switch rules. Seven added cases cover exact entry-rule omission and rest bodies across both fixtures, first-frame rest opacity/translation and completed entry with recipe duration/easing, reduced-motion entry and pressed offsets, CDP-emulated reduced transparency, and transition-free theme switching isolated from a second surface.
    - Chromium screenshot-buffer comparisons prove Rack's 2px blur and 0.74 alpha on a backdrop and a frosted popover slot, and prove an opacity-0.99 ancestor prevents sampling the striped page. Images remain in memory; regenerate with `timeout 90s bun test src/__tests__/css-browser.test.ts`. No evidence images are committed.
    - Documentation checked: [MDN starting-style](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@starting-style), [transition-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/transition-behavior), [web.dev entry effects](https://web.dev/blog/baseline-entry-animations), [Filter Effects Level 2 backdrop roots](https://drafts.csswg.org/filter-effects-2/#BackdropRoot), and MDN's reduced-motion/reduced-transparency references. Context7 `/microsoft/playwright` confirmed `page.emulateMedia({ reducedMotion })` and `newCDPSession(page)`; the installed Chromium accepted `Emulation.setEmulatedMedia` for reduced transparency, verified by `matchMedia` and computed styles. No discrete display transition is needed for newly mounted overlays.
    - `timeout 600s bun run check` passed: generated-code check, both typechecks, lint, formatting, 363 tests / 109,194 assertions. Existing lint warnings remain; no new warning introduced. The 38 focused CSS tests and `git diff --check` passed.
    - Task 8 retains the outsider guide and renderer/switch contract (already normative in spec §11/§6.4); Task 9 retains the blurred-dialog switch budget. Task 10 retains proof-host integration/parity. Exit motion remains Phase 4. Reduced transparency remains progressive enhancement.

- [x] Task 7: Keep states and edges visible in forced colours
  - Acceptance Criteria:
    - Functional:
      - `designSystemCss` emits one `@media (forced-colors: active)` block with decision 8's table. Every rule is emitted only where the state's recipe differs from rest, or, for edges, where the rest recipe sets a `backgroundColor` and no border width above zero.
      - `baseCss` gives `.lf_fill` a 1px `CanvasText` outline, offset inward, under forced colours.
      - Shadows are left to the browser, which already removes them in forced colours. The proof's `box-shadow: none !important` is not carried over.
    - Performance: n/a — one media block, measured in the sheet bytes.
    - Code Quality: the mapping is one table keyed by state, applied to resolved data. No per-kind rule.
    - Security: law 3 — system colours appear only inside the forced-colours block. The colour authority test (Task 3) accepts them only there.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (styling reference).
    - Library Documentation to Check Before Implementation:
      - MDN `forced-colors`, `forced-color-adjust`, `<system-color>`.
      - Playwright 1.64 `page.emulateMedia({ forcedColors: "active" })`.
    - Documentation Reviewed:
      - Fluent UI v9 Button and Radio accessibility specs (the forced-colours mappings).
      - React Aria TagGroup example (per-component forced-colours rules).
      - CSSWG resolution on forced colours (background alpha is kept; system colours pass through).
      - `proof/css/project.ts:262`: the proof's blanket rule.
      - Rechecked 2026-10-24: MDN [forced-colors](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/forced-colors), [forced-color-adjust](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/forced-color-adjust) and [system colours](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/system-color); Playwright [emulation](https://github.com/microsoft/playwright/blob/main/docs/src/emulation.md) through Context7 (`/microsoft/playwright`): `page.emulateMedia({ forcedColors: "active" })` (installed 1.64.1).
    - Options Considered:
      - `forced-color-adjust: auto` alone, as the proof does — rejected: a selected tab, a primary button or a focus ring drawn with a shadow becomes the same as rest.
      - Per-kind mappings, as Fluent and React Aria write them — rejected: the library has no kinds of its own, but it does own the eight states.
      - `forced-color-adjust: none` for `fill` — rejected (decision 8).
    - Chosen Approach:
      - One state table plus an edge rule derived from the resolved recipes.
    - API Notes and Examples:
      ```css
      @media (forced-colors:active){:where([data-lf-ds="rack@1"]) .lf_tab_default_root:where([data-selected],[aria-selected=true]){background-color:Highlight;color:HighlightText}}
      ```
    - Files to Create/Edit:
      - `src/css/forced-colours.ts`: new. One table.
      - `src/css/design-system.ts`, `src/css/base.ts`: emit it.
      - `src/__tests__/css-design-system.test.ts`, `src/__tests__/css-browser.test.ts`: extended.
      - `src/__tests__/css-theme.test.ts`: extend the existing colour-authority check to allow system colours only within balanced forced-colours media blocks.
  - Test Cases to Write:
    - Browser `every_state_differs_from_rest_in_forced_colours`: for every proof tuple whose state recipe differs from rest, under both design systems, the state's computed `background-color`, `color`, `outline-*` or `border-*` differs from rest under `forcedColors: "active"`. Fails if any state collapses into rest.
    - Browser `background_edges_survive_forced_colours`: a `box.plate` root and a popover content slot retain a visible edge under forced colours: an inward outline for background-only edges, or their existing positive border (Rack popover).
    - Browser `fill_indicators_keep_their_shape`: an 8px `fill` circle computes a `CanvasText` outline.
    - `colour_authority_holds`: the existing string check now proves every emitted system-colour keyword sits inside the forced-colours block, including outline shorthands; rejects leaks after the block closes.
    - `forced_colours_only_restore_differing_states_and_background_edges`: equal state recipes emit no cue; absent/zero borders get an edge outline and each positive border-width field suppresses it.
    - Browser `forced_colour_states_keep_precedence_and_disabled_guards`: native hover, focus, active and invalid retain source-order precedence; a disabled root suppresses native hover and its slots' own hover/active cues.
  - Notes (executed 2026-10-24):
    - Added the generic state table and resolved-recipe edge check in `src/css/forced-colours.ts`. `designSystemCss` emits one forced-colours block after its ordinary rules, reusing the same selectors, precedence, root-to-slot propagation, disabled guards and hover-capability media query. `baseCss` restores `.lf_fill` shapes with an inward 1px CanvasText outline. No colour-adjust opt-out or blanket shadow override was added. Spec §6.4 is unchanged.
    - Browser coverage proves all 64 differing Certified state recipes and all 68 Rack recipes remain distinct from rest, for both slot-owned and root-propagated states. Both systems preserve box/popover edges. Rack's popover already has a positive border, so the edge test checks that visible border rather than requiring an additional outline, matching the acceptance rule. An 8px circular fill indicator retains its geometry and CanvasText outline with `forced-color-adjust: auto`.
    - Sheet size: Certified 148,165 bytes (25,361-byte forced-colours block); Rack 158,141 bytes (30,075-byte block); shared base 1,072 bytes. Measure again with `designSystemCss`/`baseCss` on `src/__tests__/fixtures/proof/{catalog,certified.design-system,rack.design-system}.json`, counting `new TextEncoder().encode(sheet).length`; the forced block is the suffix starting at `@media (forced-colors:active){`.
    - Tests were written first: browser checks reproduced collapsed states and missing background/fill outlines before implementation. `timeout 600s bun run check` passed: generated-code check, both typechecks, lint, formatting, 368 tests / 110,049 assertions. Focused CSS coverage totals 43 tests; `git diff --check` passed. Existing lint warnings remain.
    - G29's real Windows/assistive-technology audit remains a manual gate; Chromium emulation does not close it. Task 8 retains publication/docs, and Task 10 retains proof-host adoption and parity.

- [x] Task 8: Publish `/css` with outsider documentation
  - Acceptance Criteria:
    - Functional:
      - `package.json` `exports` gains `"./css": "./src/css/index.ts"`. `src/__tests__/exports.test.ts` pins the public names: `baseCss`, `themeCss`, `designSystemCss`, `slotClass`, `styleDeclarations`, `surfaceAttributes`, `colourVar`, `valueVar`, and the types they return.
      - `src_is_host_api_free` passes with no new exception. A browser bundle of `/css` contains no host API, using the SDK's bundle check pattern (`portability.test.ts:13`).
      - `docs/styling.md` explains, for outsiders:
        - the three sheets and when to regenerate them;
        - loading them (`<style>` or `<link>`, cached by input; the CSP note for inline style attributes);
        - the scope attributes;
        - the switch sequence;
        - the renderer contract (one class per slot, the state attribute table, overlays in scope, backdrop siblings);
        - what preferences the projection handles and which belong to the host;
        - the Baseline 2024 floor;
        - how app primitives carry their own structural CSS and refer to `colourVar`/`valueVar`.
      - `docs/model.md`'s pipeline and "Who owns what" sections, the `liveframe-execution` styling reference's "Today" section, and the architecture reference's "Today" section describe what shipped.
    - Performance: n/a.
    - Code Quality: `src/css/index.ts` only re-exports; there is no default export.
    - Security: the docs state law 3's boundary: app primitive CSS is trusted, and installed data never reaches CSS as text.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — public surface chores.
    - Library Documentation to Check Before Implementation:
      - none — local `docs/sdk.md` and `docs/packages.md` set the outsider-doc style.
    - Documentation Reviewed:
      - `package.json` `exports`; `src/__tests__/exports.test.ts`; `src/__tests__/portability.test.ts:13-60`.
    - Options Considered:
      - Fold the docs into `docs/formats.md` — rejected: that page documents formats, and this one documents a runtime surface, like `docs/sdk.md`.
    - Chosen Approach:
      - One export entry and one guide page, mirroring Phase 2's surfaces.
    - API Notes and Examples:
      ```ts
      import { baseCss, designSystemCss, themeCss, surfaceAttributes } from "@arnilo/liveframe/css";
      ```
    - Files to Create/Edit:
      - `package.json`, `src/__tests__/exports.test.ts`, `src/__tests__/portability.test.ts`.
      - `docs/styling.md`: new.
      - `docs/model.md`.
      - `README.md`: link the styling guide and name the available projection.
      - `.claude/skills/liveframe-execution/references/styling.md` and `architecture.md`, plus their `.agents` copies.
      - This plan and `roadmap.md` §3: execution status.
  - Test Cases to Write:
    - `css_exports_are_pinned`: the public names and nothing else.
    - `css_public_return_types`: compile and use each public return shape through the package subpath, using installed inputs.
    - `css_bundles_for_browser_without_host_apis`: `Bun.build({ target: "browser" })` of `src/css/index.ts` succeeds and the output matches no host-API pattern.
  - Notes (executed 2026-10-24):
    - Added the `./css` package export over the existing re-export-only barrel, with no default export, new dependency or runtime implementation change. The package remains pre-release; npm publication remains Phase 6.
    - Tests were written first: importing `@arnilo/liveframe/css` failed before the export was added. `css_exports_are_pinned` checks exactly the eight public functions; `css_public_return_types` compiles and uses their return shapes through the package subpath with installed inputs. `css_bundles_for_browser_without_host_apis` checks the browser bundle without host-API allowances; the existing source scan passes unchanged.
    - Added `docs/styling.md` covering independent sheets and cache invalidation, loading/CSP, scope and responsive containment above the tree root, stable slot classes and state attributes, overlay/backdrop placement, switching, preferences, Baseline 2024 and trusted primitive CSS. Documents camel-case style properties, immutable installed inputs, helper validation boundaries and the existing mixed-unit breakpoint ordering assumption.
    - Updated `docs/model.md`, the README guide link and both execution-reference paths (`.agents` and `.claude` share the same files) to describe the shipped projection and remaining renderer/proof integration. Updated `roadmap.md` §3 to reflect Tasks 1–8 complete; Task 7 was already checked in this plan. No normative spec change or new project decision.
    - `timeout 600s bun run check` passed: generation check, both typechecks, lint, formatting, 371 tests / 110,057 assertions. The focused public-export/portability run passed 14 tests; `git diff --check` passed. Existing lint warnings remain.
    - No new parity capture or performance measurement: Task 9 retains the two-surface integration/switch budget, Task 10 retains proof-host adoption and parity, and the real Windows/assistive-technology audit remains a manual gate.

- [x] Task 9: Prove scoping, overlays and switching with two surfaces on one page
  - Acceptance Criteria:
    - Functional:
      - A browser fixture page loads the base sheet, both proof themes and both proof design systems. It shows two surfaces: one Certified × Certified, and one Rack × Rack holding an open dialog with its blurred backdrop and an open popover that stays in scope.
      - Each surface computes its own pair's typography, colours and breakpoints. Neither leaks into the other or into an unscoped host element beside them. A host rule `button { background: red }` doesn't change a Liveframe button's background.
      - Switching the first surface to Rack × Rack with the decision 7 sequence changes only that surface's computed styles. The second surface, every node identity, every class list and the markup stay unchanged. No transition runs.
      - The no-nesting rule is pinned: a test documents that a surface nested inside another with a different design system takes the outer design system's rules wherever the inner one leaves a property unset. It is a recorded limitation, not supported behaviour.
    - Performance: on the agent-home markup (from the proof host's server render, used as static HTML), with the dialog open, a warm switch of one surface takes ≤ 16.67 ms for the attribute change plus computed-style resolution, over 10 samples after one warm-up. The cold first switch is recorded next to G33.
    - Code Quality: the fixture is static markup plus the projected sheets, with no renderer. Tests drive it through Playwright alone.
    - Security: law 3 — the page contains no colour but the projected sheets', and the host rule test proves Liveframe's look doesn't come from host CSS.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (styling reference).
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64: `page.setContent`, `page.evaluate` timing, `MutationObserver` use as in `proof/tests/switch.test.ts`.
    - Documentation Reviewed:
      - `proof/tests/switch.test.ts:1-111`: the existing switch measurement and its immediacy check.
      - `proof/GAPS.md` G27 and G33.
    - Options Considered:
      - Prove scoping only through the proof host — rejected: the host has one surface per page, and a library behaviour needs a library test.
      - Build a test renderer — rejected: static markup proves CSS behaviour, and Phase 4 owns rendering.
    - Chosen Approach:
      - A `setContent` page with two scoped roots and captured agent-home markup for the proof bench's 50-row workload. The capture script translates legacy classes and inline layouts through `/css`; tests add static sibling backdrop/dialog slots and native top-layer popovers. No renderer or widget code runs in the browser.
    - API Notes and Examples:
      ```ts
      await page.setContent(`<style>${base}${themes}${systems}</style><section ${attrs(a)}>…</section><section ${attrs(b)}>…</section>`);
      ```
    - Files to Create/Edit:
      - `src/__tests__/css-scope-browser.test.ts`: new.
      - `src/__tests__/fixtures/css/agent-home.html`: new, captured through the proof host's `ProofSurface` server render; contains no client code or sheets.
      - `proof/scripts/capture-css-scope.ts`: new, regenerates the capture and checks for projected markup without legacy CSS names. The test header names the command. Until Task 10, the capture maps legacy `fit` grid tracks to `1fr` without changing proof widgets; this is a scope/switch fixture, not parity evidence.
      - `proof/GAPS.md`: record this projection's cold/warm two-surface measurement beside G33.
      - This plan and `roadmap.md` §3: execution status.
  - Test Cases to Write:
    - Browser `two_surfaces_keep_their_own_styles`.
    - Browser `host_css_does_not_restyle_surfaces`.
    - Browser `switch_changes_one_surface_only`.
    - Browser `overlays_keep_scope`: the open popover and dialog compute their design system's look.
    - Browser `nested_surfaces_are_a_recorded_limitation`.
    - Browser `switch_under_budget_with_blur`: warm ≤ 16.67 ms; cold recorded.
  - Notes (executed 2026-10-24):
    - Added six Chromium tests in `src/__tests__/css-scope-browser.test.ts` using the published `/css` helpers, five independently projected sheets, static markup and Playwright only. Both scopes retain their own theme typography, button colours and 720px container threshold; removing the other surface leaves computed styles unchanged. Unscoped host elements receive no Liveframe variables, and a later `button { background: red }` rule affects only the host button.
    - Switching Certified × Certified to Rack × Rack changes only the first scope. A MutationObserver permits only its scope/switch attributes; all node identities, classes and descendant markup remain identical. Computed transition durations are zero during the switch, no animation or `transitionrun` starts, and the second surface remains byte/style-identical. Native top-layer popovers retain ancestry and pair-specific styles. Rack's sibling dialog backdrop computes `blur(2px) saturate(1)` with no backdrop-root ancestor. The negative nesting test demonstrates Rack's unset-property leakage into a nested Certified backdrop, pinning the documented unsupported case.
    - `proof/scripts/capture-css-scope.ts` uses the proof host's existing `ProofSurface` server render with the same 50-row workload as `proof/tests/agent-home.bench.ts`, then converts legacy classes/layouts for the static fixture. It asserts projected markup without legacy CSS names, and regeneration is byte-identical. Captured HTML contains no renderer or widget scripts. Generated-file Biome directives preserve server markup and leave its existing ARIA attributes intact. No screenshot artifact is needed for these computed-style/identity tests.
    - Temporary capture-only limit: legacy `fit` tracks become `1fr`, so the fixture is not parity evidence. Task 10 now explicitly removes this translation and regenerates the capture after the proof host adopts `/css` and flex rows. The browser fixture supplies open sibling dialog/backdrop slots and native popovers because React Aria does not include those open overlays in the server render. Production proof widgets and renderer are unchanged.
    - Full-check measurement: 954 DOM elements in the switched surface, with two 50-row surfaces and overlays mounted; first flip 7.7 ms, ten warm flips 8.4, 8.2, 8.0, 7.8, 7.7, 7.5, 7.4, 8.3, 7.9 and 10.0 ms (maximum 10.0 ms ≤ 16.67 ms). The timer covers switch attributes and computed-style resolution across every node, including overlay/backdrop styles; it does not claim GPU paint/compositing time. Recorded beside G33 in `proof/GAPS.md`; proof-host integration/parity remains Task 10.
    - Tests were added before capture implementation and initially failed on the absent fixture. `timeout 600s bun run check` passed: generation check, both typechecks, lint, formatting, 377 tests / 110,087 assertions. All six focused cases pass, the generator's self-check passes, and `git diff --check` passes. Existing lint warnings remain; the new TypeScript files add none. No public API, dependency or normative spec change. Context7 `/microsoft/playwright` confirmed `setContent`, evaluation and screenshot APIs for the installed browser-test tooling.

- [x] Task 10: Drive the proof host with `/css` and re-prove parity
  - Acceptance Criteria:
    - Functional:
      - `proof/css/project.ts` becomes a thin adapter over `@arnilo/liveframe/css`, using the new-format fixtures in `src/__tests__/fixtures/proof/`. Its exports (`slotClasses`, `styleProps`, `hasResponsiveStyles`, `hasResponsiveValues`) keep their call sites in `proof/renderer/surface.tsx` and `proof/renderer/primitives/index.tsx`.
      - The proof's per-kind structural rules move from the old `base` string into proof-owned primitive CSS served by `proof/host/server.ts`. It refers to roles only through `colourVar`, which is decision 2 working in practice.
      - The proof host sets the scope attributes on the surface root and preloads all four sheets. Its design-system selector switches with the decision 7 sequence.
      - The proof's `QueueRow` adopts the same flex composition as the SDK port (`src/__tests__/fixtures/widgets/agent-home/queue-row.tsx`), because `/css` doesn't support `fit` tracks. `proof/scripts/export-formats.ts` stops substituting `0fr`. `flexRows` in `src/__tests__/sdk-proof-widgets.test.ts:22` is deleted, because exported and ported trees are now equal.
      - `bun proof/scripts/parity.ts --out evidence/parity` reports ≤ 1% at 1440, 1024 and 390 px. The proof's renderer and browser tests pass under both design systems. `proof/tests/switch.test.ts` passes ≤ 16.67 ms warm.
      - `proof/PARITY.md` and `proof/GAPS.md` record:
        - the new numbers;
        - any approved deviation (Rack's scrollbar colour is the expected one);
        - G27 closed;
        - G33's cold cost with the scoped switch;
        - G29's forced-colours automation, with the Windows audit still open.
    - Performance: as above: ≤ 1% parity, ≤ 16.67 ms warm switch, node counts unchanged (`proof_node_counts_hold`).
    - Code Quality: the adapter has no logic beyond argument shape. The proof keeps no second projector.
    - Security: law 3 — the proof's primitive CSS is app code. The colour authority test doesn't scan it, and the docs say why.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (proof and styling references).
      - `investigate-first` — if parity regresses, find the cause (selector precedence, logical sides, `translate`) before changing data.
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64.1 screenshot preparation and font readiness (Context7 `/microsoft/playwright`; installed API verified).
      - React Aria Components 1.22.1 portal containers (Context7 `/websites/react-aria_adobe`; installed `UNSTABLE_portalContainer` props verified).
    - Documentation Reviewed:
      - `proof/renderer/surface.tsx:2`, `proof/renderer/primitives/index.tsx:4`: the callers.
      - `proof/scripts/export-formats.ts:262-267`: the `0fr` substitution.
      - `src/__tests__/sdk-proof-widgets.test.ts:22-37`: `flexRows`.
      - `plans/backlog.md`, "Reconcile proof grid tracks before SDK and CSS integration".
      - `proof/PARITY.md`, `proof/scripts/parity.ts`: the capture-alignment rule.
    - Options Considered:
      - Leave the proof on its own projector and prove parity only in `src` — rejected: parity is measured on the proof host, and two projectors would drift.
      - Keep `fit` tracks in the proof — rejected: it isn't spec-valid, and the backlog item requires removing it.
    - Chosen Approach:
      - Swap the projector behind the proof's existing imports, recompose `QueueRow`, re-capture.
      - Keep QueueRow's empty trailing-track gap as conditional padding in both proof and SDK ports; without it the flex migration changes mobile line wrapping.
      - Keep React Aria overlays inside the host scope through the installed portal-container prop; no new dependency or library renderer API.
    - API Notes and Examples:
      ```bash
      timeout 600s bun proof/scripts/parity.ts --out evidence/parity
      timeout 120s bun test proof/tests/switch.test.ts
      ```
    - Files to Create/Edit:
      - `proof/css/project.ts`: replaced by the adapter.
      - `proof/renderer/primitives/base.ts`: proof-owned structural CSS using the exported value-name helper.
      - `proof/css/fixtures.ts`, `proof/css/sheets.ts`: validated new-format fixtures and independent library sheets.
      - `proof/host/server.ts`, `proof/host/client.tsx`: sheets, library scope attributes, switch.
      - `proof/host/view.tsx`, `proof/renderer/implement.ts`, `proof/renderer/surface.tsx`, `proof/renderer/primitives/index.tsx`, `proof/tests/fixtures/renderer-client.tsx`: retain overlay portals in the selected DOM scope.
      - `proof/widgets/agent-home/queue-row.tsx`, `src/__tests__/fixtures/widgets/agent-home/queue-row.tsx`: equal flex composition and conditional trailing padding.
      - `proof/scripts/export-formats.ts`, `src/__tests__/fixtures/proof/*.tree.json` (regenerated), `src/__tests__/sdk-proof-widgets.test.ts`.
      - `proof/scripts/capture-css-scope.ts`, `src/__tests__/fixtures/css/agent-home.html`: remove the Task 9 capture's legacy class/style translation and temporary `fit` substitution once the proof projects through `/css`; regenerate from the migrated server render and retain the 50-row scope/switch regression.
      - `proof/tests/*.test.ts`: class names and selectors where they assert them.
      - `proof/PARITY.md`, `proof/GAPS.md`, `proof/REPORT.md`, `docs/styling.md`: integration evidence, gap closure and trusted app CSS boundary.
      - `plans/backlog.md`: close the grid-track item.
  - Test Cases to Write:
    - Existing `proof/tests/switch.test.ts`, `proof/tests/renderer-browser.test.tsx` and `proof/tests/projection.test.ts` (updated for the new class names) are the regression tests. `proof/tests/projection.test.ts` cases that test the old projector's internals are deleted, with their coverage pointed at the Task 3–7 tests.
    - `proof_trees_match_exports` passes with no layout exception.
    - `all_proof_scenarios_render_with_both_scoped_design_systems`: all 39 host route/scenario/size variants render under both systems with all four sheets loaded. Renderer interaction regressions run under both systems; overlay scope and non-transparent styling are asserted.
    - The parity run is evidence (`evidence/parity`, regenerated by `proof/scripts/parity.ts`), not a test.
  - Notes (executed 2026-10-24):
    - Removed the second projector; the adapter delegates slot/style output to `/css`. The host serves base + trusted app primitive CSS + two independent theme/system pairs, uses `surfaceAttributes`, and switches with the transition-suppression sequence. Portaled overlays stay in that scope. No public API, format, dependency or normative spec change.
    - The first mobile capture regressed to 1.22% because flex removed the empty grid track's trailing gap. Conditional `paddingRight` in both QueueRows restored exactly the approved pixel counts: **9712 / 1345728 (0.72%)**, **7088 / 938880 (0.75%)**, **5572 / 576380 (0.97%)** at 1440 / 1024 / 390 px. All 281 DOM / 32 style differences remain the approved inventory; diagnostics are empty. Capture `parity: false` still denotes exact DOM/style equality, not failure of the accepted pixel bar. Local evidence: `evidence/parity`, regenerated by `timeout 600s bun proof/scripts/parity.ts --out evidence/parity`.
    - Removed exporter `0fr` substitution, test `flexRows` normalization and the scope capture's class/style/track translation. Exported and SDK trees now match directly; `proof_node_counts_hold` still proves 679 nodes. Regenerate with `timeout 30s bun proof/scripts/export-formats.ts` and `timeout 30s bun proof/scripts/capture-css-scope.ts`.
    - `timeout 600s bun run check` passed: typecheck, lint, formatting and **374 tests / 109,961 assertions**. Renderer interactions pass under both systems; all 39 host variants switch under both. Final full-check host measurements: cold **10.9 / 3.4 ms**, warm maxima **3.1 / 1.6 ms** for agent-home / git-status. Warm switches preserve markup, nodes, focus and tree, produce no transitions and make no requests. A concurrent earlier run measured 25 ms cold: G33 remains load-sensitive.
    - The regenerated 50-row two-surface blur proof measured **8.4 ms cold / 9.0 ms warm max**, 954 DOM elements. Reproduce with `timeout 120s bun test src/__tests__/css-scope-browser.test.ts proof/tests/switch.test.ts`. G27 and the grid-track backlog item are closed; G29 has forced-colour automation but retains the real Windows/assistive-technology audit. Rack's native scrollbar colour is the accepted adopter deviation.
    - `graft build` refreshed the local graph. Tasks 11–12 remain separate work.

- [x] Task 11: Hand the design-system cases to the conformance backlog
  - Acceptance Criteria:
    - Functional: the "Seed conformance suites from the proof tests" entry in `plans/backlog.md` names the Task 3–9 cases a Phase 5 design-system suite reuses: colour authority, injective names, every property and prop projected, state precedence, forced-colour distinctness, entry rules and scoping. It also says which of them need a browser.
    - Performance: n/a.
    - Code Quality: one updated entry, not a new one.
    - Security: n/a — documentation.
  - Approach:
    - Skills to Use:
      - `create-plan` — the backlog handoff format.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/backlog.md:50-63`.
    - Options Considered:
      - Ship a conformance helper now — rejected: Phase 5 owns `/conformance`.
    - Chosen Approach:
      - Update the existing entry.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/backlog.md`.
      - This plan and `roadmap.md` §3: execution status.
  - Test Cases to Write:
    - n/a — documentation.
  - Notes (executed 2026-10-24):
    - Updated the existing "Seed conformance suites from the proof tests" entry in `plans/backlog.md`, adding this plan as a source and handing off the Task 3–9 cases to Phase 5. Names the source files and cases for colour authority, injective names, every recipe property/style prop, state precedence, forced-colour distinctness, entry rules and per-surface scoping.
    - Separates pure-output checks from browser checks for computed state, responsive/RTL behaviour, overlays, preferences and switching. Keeps the unsupported-nesting limit, progressive reduced-transparency support, internal performance gates and G29's real Windows/assistive-technology audit explicit. No conformance helper, runtime code, dependency or spec change.
    - `timeout 600s bun run check` passed: generation check, both typechecks, lint, formatting and **374 tests / 109,961 assertions**, zero failures. Existing lint warnings remain. `git diff --check` passed. No new tests or parity capture were needed for this documentation-only handoff; Task 12's impact analysis remains separate work.

- [x] Task 11a: Reconcile projection execution references after proof adoption
  - Acceptance Criteria:
    - Functional: the execution skill's architecture/styling references describe Task 10's delivered proof adoption, G27 closure, warm-switch gate and remaining G29/G33 limits.
    - Performance: preserve the measured budgets; claim neither cold-frame nor GPU-paint guarantees.
    - Code Quality: update existing references; keep `.agents`/`.claude` copies identical.
    - Security: no runtime or trust-boundary change; retain the manual Windows/assistive-technology gate.
  - Approach:
    - Skills to Use: `liveframe-execution`, `create-plan`, `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation: none — execution metadata only.
    - Documentation Reviewed: Task 10 notes, `proof/GAPS.md:167–180`, `proof/PARITY.md:79–83` and plan 005 Task 8.
    - Options Considered: leave historical "Today" claims — rejected because they direct subsequent work to repeat an already completed migration.
    - Chosen Approach: correct current-state references without changing normative design or historical measurement records.
    - API Notes and Examples: n/a — documentation only.
    - Files to Create/Edit: `.agents/skills/liveframe-execution/references/{architecture,styling}.md` and their shared `.claude` copies; this plan.
  - Test Cases to Write: n/a — documentation; run `bun run check`, copy comparison and `git diff --check`.
  - Notes (executed 2026-10-24):
    - Corrected both current-state references to reflect proof adoption, G27 closure, parity, warm switching and the distinct SDK render gate. Shared `.agents`/`.claude` copies compare equal. No normative spec or runtime change.
    - `timeout 600s bun run check` passed: 374 tests / 109,961 assertions, zero failures, generation drift, typechecks, lint and format checks. Existing non-fatal lint warnings remain; `git diff --check` passed. Task 12 retains backlog reconciliation and final ledger closure.

- [x] Task 12: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/007-impact-analysis.md` sweeps all twelve impact areas of the create-plan reference against what shipped. It records each one, or `None — <reason>`.
      - Every finding is presented to the owner in one table with a recommended disposition (`execute` or `backlog`), and the answer is recorded.
      - Every `execute` finding becomes a task above this one and is executed. Every `backlog` finding goes to `plans/backlog.md` and Further Actions.
      - Known candidates to sweep:
        - exit motion and the overlay contract for Phase 4 Part A;
        - `<Preview>` consuming per-surface scoping for Phase 4 Part B;
        - the CSP atomic-class route;
        - placeholder and scrollbar recipe properties;
        - the Windows forced-colours audit (G29);
        - `@scope` if nesting ever becomes possible;
        - Synapta and Clay gaps (Rack's scrollbar).
    - Performance: confirm that every budget in Tasks 5, 9 and 10 was measured and recorded.
    - Code Quality: findings name files and spans.
    - Security: confirm law 3's tests cover every new output path.
  - Approach:
    - Skills to Use:
      - `create-plan` (final task rules), `graft` — check the delivered surface.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/evidence/006-impact-analysis.md`: the format.
    - Options Considered:
      - n/a — required by the create-plan skill.
    - Chosen Approach:
      - Sweep, present, dispose.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/007-impact-analysis.md`: new.
      - `plans/backlog.md`, this plan's Compromises Made and Further Actions, `roadmap.md` §3.
  - Test Cases to Write:
    - n/a — analysis.
  - Notes (executed 2026-10-24):
    - `plans/evidence/007-impact-analysis.md` sweeps all twelve impact areas and records the nine-row table presented to the owner. Dispositions use the owner's request to complete this task; no separate per-row response or new architecture approval is claimed. F1 is executed through Task 11a and this task's backlog/ledger correction. F2–F9 are handed off to existing or new backlog entries and linked below; Task 11's conformance handoff remains intact.
    - Confirmed law 3 coverage for every sheet, recipe/state/forced-colour path and scalar/responsive layout output, including escaping, closed values and negative controls. No runtime, public API, dependency or normative spec change was needed.
    - Re-ran the CSS benchmark: 679-node mapping **0.389 µs/node / 0.264 ms/tree** (≤ 1 µs/node). Full-check switches: two-surface blur **8.1 ms cold / 9.9 ms warm max**, hydrated agent-home **7.0 / 2.8 ms**, git-status **3.4 / 1.4 ms**; every warm gate is ≤ 16.67 ms. Cold remains load-sensitive; style-resolution timers do not measure GPU paint. Sheet generation/bytes are in the impact record.
    - Regenerated local parity evidence with `timeout 600s bun proof/scripts/parity.ts --out evidence/parity`: **0.72% / 0.75% / 0.97%**, exactly 281 DOM / 32 style differences and no diagnostics. The JSON `parity: false` denotes exact DOM/style equality, not failure of the approved pixel bar. Images remain local; `proof/scripts/parity.ts` regenerates them.
    - Whole-plan focused commands passed: **49 CSS tests / 8,379 assertions** and **4 host switch tests / 403 assertions**, zero failures. Those independent runs measured 13.9 ms warm max for scoped blur and 3.7 / 1.2 ms for agent-home / git-status. The current Chromium was already installed; no reinstall was needed. Documentation assertions verified all twelve areas, nine rows, backlog links and identical skill copies.
    - Final `timeout 600s bun run check` passed generation drift, both typechecks, lint, formatting and **374 tests / 109,961 assertions**, zero failures; existing non-fatal lint warnings remain. Final scoped blur measurement: **8.2 ms cold / 8.8 ms warm max**. `git diff --check` passed. Plan 007 and roadmap Phase 3 are complete; plans 002/005 and pre-existing owner edits remain untouched by this task's closure.

## Verification (whole plan)

- `timeout 600s bunx playwright install chromium` (once per machine)
- `timeout 600s bun run check`
- `timeout 300s bun test src/__tests__/css-`
- `timeout 300s bun bench/css.bench.ts`
- `timeout 600s bun proof/scripts/parity.ts --out evidence/parity`
- `timeout 120s bun test proof/tests/switch.test.ts`

## Compromises Made

- Inline layout requires CSP `style-src-attr 'unsafe-inline'`; nonces authorize sheets only. No atomic-class alternative ships (F4).
- Surfaces must be siblings, never nested. Host CSS retains normal cascade authority; attribute scoping is not arbitrary style isolation. `@scope` remains a conditional upgrade (F7).
- Mixed px/rem breakpoint sorting assumes a 16px root; use one unit for other root sizes pending a concrete requirement (F8).
- Warm attribute/style resolution meets the frame budget. G33's cold cost remains load-sensitive and GPU paint/compositing is not measured. G29's real Windows/assistive-technology audit stays open; reduced transparency remains progressive enhancement (F6).
- Placeholder/scrollbar recipe properties remain outside the projection. Rack uses theme-native scrollbar appearance (F5/F9). Per-kind structure stays in trusted app primitive CSS, never in the generic library.
- Entry motion ships; exit lifecycle, scroll locking and inertness remain production renderer work (F2). The public renderer, preview and conformance suites are later phases, not implied by the proof host.

## Further Actions

- P2, Phase 4 Part A: [carry the CSS overlay contract into the production renderer](backlog.md#carry-the-css-overlay-contract-into-the-production-renderer) (F2), including scoped portals, lifecycle, state semantics and focus/scroll preservation.
- P2, Phase 4 Part B: [build preview sessions on shipped contracts](backlog.md#build-preview-sessions-on-the-shipped-package-and-runner-contracts), now including independent sheets and sibling per-cell scopes/containers (F3).
- P2: [complete the remaining platform audits](backlog.md#later-phase-gaps-from-the-phase-0-reports) (F6); retain the recorded cold-cost limit and revisit only against a measured host requirement.
- P3: [evaluate strict-CSP atomic classes](backlog.md#evaluate-an-atomic-class-route-for-strict-style-csp) (F4) and [mixed-unit breakpoint ordering](backlog.md#revisit-mixed-unit-breakpoint-ordering-for-non-16px-roots) (F8) on adopter demand; neither changes the current contract.
- P4: [evaluate native-part recipe properties](backlog.md#evaluate-placeholder-and-scrollbar-recipe-properties-on-adopter-demand) (F5), [revisit nesting only if required](backlog.md#revisit-scoping-only-if-nested-surfaces-become-required) (F7), and [hand Rack's scrollbar deviation to Clay](backlog.md#hand-adopter-gaps-to-synapta-and-clay) (F9).
- P3, Phase 5: [seed conformance suites from the proof tests](backlog.md#seed-conformance-suites-from-the-proof-tests), retaining Task 11's pure/browser distinction and internal budget tests.
