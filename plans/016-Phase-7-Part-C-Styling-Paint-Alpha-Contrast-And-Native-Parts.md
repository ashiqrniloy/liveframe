# Phase 7 Part C: Styling — No-Paint, Alpha, Contrast Pairs and Native Parts

Depends on: [plan 015](015-Phase-7-Part-B-Events-Manifests-Capabilities-And-State.md) complete. The 0.2.0 scope comes from [plan 014](014-Phase-7-Part-A-Release-Scope-Packaging-And-Schema-Language.md) Task 1.

## Objectives

- Let a recipe clear paint without a fake colour role: the `"none"` keyword (CL-04).
- Let a recipe colour carry an alpha (`{ role, alpha }`, LF-11), so translucent borders, text and shadows need no per-alpha theme roles.
- Let a vocabulary declare contrast pairs that `validateTheme` checks when a theme is installed (LF-10). Include Clay's extra item: an upper bound, and an ordering between pairs.
- Add placeholder and scrollbar recipe properties (the backlog item Clay raises with Rack's `scroll` slots).
- Close the proof composition gaps Synapta raised (proof-only, nothing in the published package):
  - G30: an icon tone;
  - G31: a tab count slot;
  - G2: Certified identity and diagnostic fill roles.

## Expected Outcome

- `backgroundColor: "none"` in a state clears the paint a `*` or `rest` recipe set. Forced colours handle it per Task 1. A vocabulary role named `none` is rejected.
- `borderColor: { role: "border.hairline", alpha: "opacity.subtle" }` projects deterministically through `color-mix()`. The proof vocabulary has no `*.alpha-*` roles, and Certified/Rack parity is unchanged.
- A theme that makes a declared pair unreadable fails install with `insufficient-contrast`, naming the pair and the measured ratio.
- `scroll` can style its scrollbar thumb and track, and a text input its placeholder, with theme roles only.
- The proof's `icon` takes a `tone`, `tab` has a count slot, and Certified declares identity and diagnostic fill roles.

This plan implements spec §6.1 (theme), §6.2 (recipes), §6.4 (projection, forced colours, the "Outside this projection" list) and §6.5 (vocabulary). Law 3 is the constraint throughout: no keyword, alpha or native-part property lets a hue in from anywhere but the theme. The placeholder and scrollbar properties remove those two items from spec §6.4's "Outside this projection" list, which is a spec change (Task 5). Everything here is additive to the `/1` formats.

## Tasks

- [x] Task 1: Record the styling format decisions
  - Acceptance Criteria:
    - Functional: an accepted decision log settles each open question.
      - **CL-04:**
        - which properties accept `none` (`backgroundColor`, `borderColor`, `outlineColor`; `textColor` only with a found use);
        - its projection (`transparent`);
        - its forced-colours treatment. CL-04 says the edge rule "treats `none` as no background", but its acceptance asks for "the inward outline on a `none` background with no border". These conflict: the log decides which, with a browser sketch;
        - that the name is reserved in vocabularies.
      - **LF-11:**
        - the value shape `{ role, alpha }`, with `alpha` a design-system `opacity` value name or a number in [0, 1] (bounded precision);
        - which properties accept it, including `shadow` layer colours;
        - the projection: `color-mix(in oklab, var(--lf-c-…) N%, transparent)` or relative colour syntax, checked against the Baseline 2024 floor;
        - how it composes with `backgroundOpacity` and `--lf-alpha`, and how reduced transparency and forced colours override it.
      - **LF-10:**
        - the WCAG 2.x relative-luminance formula;
        - conversion from each DTCG colour space `src/formats/dtcg.ts` accepts, through linear-light CIE XYZ (D65);
        - alpha compositing of the foreground over the background role, and of the background over what, if it is translucent: the log picks the theme's base surface role or opaque black/white bounds;
        - the gamut handling for wide-gamut values;
        - the new kind `insufficient-contrast`;
        - Clay's extra item, an optional `maximum` and a `lessThan: <pair index or name>` ordering constraint;
        - APCA as an informational `expected` hint only, or not at all.
      - **Native parts:**
        - recipe properties `placeholderColor` (on a slot that draws a text input) and `scrollbarThumbColor`/`scrollbarTrackColor` (on a scrolling slot);
        - their projection (`::placeholder`; standard `scrollbar-color`), with the WebKit status recorded. If WebKit lacks `scrollbar-color`, the log decides between a `::-webkit-scrollbar-*` fallback and leaving WebKit native.
        - which states are honoured: Rack declares `scrollbarThumb.{rest,hover,active}`, but `scrollbar-color` has no hover state;
        - how Clay's slot-shaped recipes map onto the properties.
    - Performance: n/a — a decision only.
    - Code Quality: one log, and each choice gives its rejected alternative.
    - Security: law 3 — every choice keeps hue authority in the theme, and the log states it for each one.
  - Approach:
    - Skills to Use:
      - `create-decision-log`.
      - `find-docs`: CSS references for current browser support.
    - Library Documentation to Check Before Implementation:
      - MDN `color-mix()`, relative colour syntax, `scrollbar-color`, `::placeholder` and `::-webkit-scrollbar`, with browser compatibility for WebKit/Safari and WebKitGTK.
      - WCAG 2.2 relative luminance and contrast ratio.
      - CSS Color 4 conversion matrices.
      - DTCG colour module (the spaces Liveframe accepts).
    - Documentation Reviewed:
      - Spec §6.2 and §6.4 (forced-colours table; "Outside this projection").
      - `src/formats/design-system.ts:273-295` (`checkRecipeProperty`; colour at `:286-288`).
      - `src/css/recipe.ts:7,21,46,52` (colour, `backgroundOpacity` and backdrop projection).
      - `src/css/forced-colours.ts:22` (inward outline).
      - `src/css/base.ts:32` (reduced transparency).
      - `src/formats/theme.ts:79-163`; `src/formats/dtcg.ts`; `src/formats/vocabulary.ts`.
      - Backlog "Evaluate placeholder and scrollbar recipe properties on adopter demand" (Clay's demand: `scroll.default.scrollbarTrack.rest`, `scrollbarThumb.{rest,hover,active}`).
    - Options Considered:
      - A zero-alpha theme role for no-paint — rejected by CL-04: it turns clearing paint into a colour, and every theme must define it.
      - Per-alpha theme roles — rejected by LF-11: the vocabulary grows, and every theme must define each step.
    - Chosen Approach:
      - One log for all four, because they share the colour-value grammar in `checkRecipeProperty`.
    - API Notes and Examples:
      ```json
      { "button.default.root.rest": { "backgroundColor": "none" }, "button.default.root.hover": { "backgroundColor": "surface.hover" },
        "row.default.root.selected": { "backgroundColor": { "role": "accent.primary", "alpha": 0.15 } } }
      ```
    - Files to Create/Edit:
      - `decision-logs/<date>-styling-paint-alpha-contrast-native-parts.md` (new)
      - `plans/evidence/016-task-1-browser-sketch.ts` (new): assert-based CSS decision sketch.
      - This plan and `roadmap.md` §3: execution notes and status.
  - Test Cases to Write:
    - No library tests: the decision log is the record. Run the browser sketch for no-paint forced-colours edges and alpha multiplication, then `bun run check`.
  - Notes (executed 2026-10-28):
    - Recorded the [approved styling contracts](../decision-logs/2026-10-28-1123-styling-paint-alpha-contrast-native-parts.md), with alternatives and law 3 treatment for all four decisions. The user's instruction to complete this recording task is the approval evidence.
    - `none` preserves the explicit-background inward edge in forced colours, resolving CL-04's contradictory prose in favour of its acceptance bullet. No invisible-text use was found, so `textColor` excludes `none`.
    - Alpha modifiers use `color-mix(in oklab, …, transparent)`, include shadow layers, have four-decimal precision, multiply background opacity and restore unmodified role references under reduced transparency. Intrinsic theme alpha remains unchanged.
    - Contrast checks use WCAG 2.x, reference conversions for all 14 accepted spaces, deterministic sRGB clipping and encoded-sRGB compositing. Translucent backgrounds require an opaque declared `contrastBase`; ordering uses strict zero-based pair indices, with no APCA field. Task 4 now includes these validation and test obligations; its dangling named-pair example is corrected.
    - Placeholder projection honours existing states. Scrollbar colours are rest-only paired values, with no prefixed fallback; Safari 26.2 / WebKitGTK 2.52.3 support the standard property, older engines retain native scrollbars. Task 5 now records the proof migration and unsupported-state limitation.
    - Browser sketch: `bun plans/evidence/016-task-1-browser-sketch.ts` passed outside the sandbox on Chromium 156.0.8078.4: mixed alpha 0.2 from 0.8 × 0.25; explicit no-paint outline 1px solid at −1px; absent-background outline style `none`; both keep `forced-color-adjust: auto`. This is a declaration sketch, not shipped-format or native Windows/AT proof. No images were generated.
    - Verification passed: `bun run check` outside the sandbox (build, generated-file check, typecheck, lint, format and tests; 720 pass, 4 skip, 0 fail, 96 files). The initial sandbox run could not start browsers/local servers. The sketch also passes `bunx --no-install biome check plans/evidence/016-task-1-browser-sketch.ts`; `git diff --check` is clean.
    - No runtime, schemas or normative shipped-spec changes in this decision-only task. Tasks 2–5 retain their implementation, spec/doc/schema/conformance and browser gates.

- [x] Task 2: Add a no-paint value for recipe colours (CL-04)
  - Acceptance Criteria:
    - Functional:
      - The validator accepts `"none"` on the properties Task 1 lists, and rejects it on non-colour properties with a pointer.
      - A vocabulary that declares a role named `none` is rejected.
      - The projection emits `transparent` byte-stably, and the cascade clears a background set by `kind.*.slot.rest`.
      - Forced colours behave as Task 1 decides, proved in a browser.
      - The Rack proof styles (`proof/styles/rack/`) drop any zero-alpha role they used to clear paint.
      - The design-system JSON Schema accepts the keyword.
    - Performance: CSS bench non-regression.
    - Code Quality: the keyword is one constant in `src/formats/fixed.ts`, used by the validator, the projection and the vocabulary check.
    - Security: law 3 — `none` carries no hue. A test proves no colour literal is emitted outside `transparent`.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (style chore: the completeness and "no colour outside the theme" checks).
    - Library Documentation to Check Before Implementation:
      - none beyond Task 1.
    - Documentation Reviewed:
      - The Task 1 files; `src/__tests__/css-design-system.test.ts`; `src/__tests__/design-system.test.ts`.
    - Options Considered:
      - See Task 1.
    - Chosen Approach:
      - As decided in Task 1.
    - API Notes and Examples:
      ```ts
      checkRecipeProperty("backgroundColor", "none", …) // ok
      ```
    - Files to Create/Edit:
      - `src/formats/fixed.ts`; `src/formats/design-system.ts`; `src/formats/vocabulary.ts`
      - `src/css/recipe.ts`; `src/css/forced-colours.ts` (if decided)
      - `schemas/catalog.json` (regenerated to reserve the colour-role name); `schemas/design-system.json` already accepts the keyword through its role-name string grammar, verified with AJV.
      - `proof/styles/rack/*`; `proof/styles/certified/*`; `proof/styles/types.ts`; `proof/tests/styles.test.ts`; `proof/GAPS.md`: remove the shared zero-alpha role and migrate both systems' clearing recipes.
      - `src/__tests__/fixtures/vocabulary.json`, `catalog.json`, `certified.theme.json`, `rack.theme.json`, and `proof/*` mirrors; format, CSS and browser tests.
      - `docs/spec.md` §6.2/§6.4; `docs/styling.md`; `docs/formats.md`
  - Test Cases to Write:
    - `none_accepted_on_colour_properties_only`.
    - `vocabulary_rejects_role_named_none`.
    - `none_clears_rest_background_byte_stable` (`css-design-system.test.ts`).
    - `forced_colours_none_background` (`css-browser.test.ts`).
    - `no_colour_literal_outside_theme` (existing colour-authority test, extended).


  - Notes (executed 2026-10-28):
    - Implemented the accepted CL-04 contract: the shared `noPaint` constant permits `none` on background, border and outline colours; projection emits `transparent` directly, including with `backgroundOpacity`. Text and shadow colours still require theme roles. Existing line-style `none` keywords remain valid.
    - Reserved the exact colour-role name `none` in vocabulary validation and the generated catalog schema, retaining nested names such as `surface.none`. The design-system schema and TypeScript recipe fields already accept this role-shaped string; AJV acceptance is tested, with no redundant schema/type union added.
    - Migrated Rack and Certified clearing recipes and removed `colour.transparent` from their shared vocabulary, both themes and every fixture mirror. Certified migration is required by the shared complete role vocabulary. Updated the proof source-comparison normalization and transparency finding. Regeneration: `bun proof/scripts/export-formats.ts --out src/__tests__/fixtures/proof`; `bun scripts/schemas.ts`.
    - Updated spec §6.2/§6.4 and outsider format/styling docs. The existing forced-colours presence rule already implements the approved explicit-no-paint inward edge, so no forced-colours implementation change was needed.
    - Wrote four regression tests first and observed all four fail before implementation. Final `bun run check` passed: 724 pass, 4 existing reference-dependent skips, 0 fail across 96 files. Browser tests prove transparent ordinary paint, the inward 1px outline at −1px with `forced-color-adjust: auto`, and no edge for an absent background. Colour-authority, cascade completeness and proof round-trip tests pass.
    - Fixed two older theme fixture mirrors found by the full gate. Earlier verification attempts hit a command timeout, a suspended-browser network error and one 16.8 ms switch sample; the final full run passed unchanged assertions, with the two-surface blur switch at 8.3 ms maximum. Native Windows/AT auditing and pixel parity were not run for this task; the existing native audit gate remains open.
    - CSS non-regression: `bun bench/css.bench.ts`, run after the full gate without concurrent tests, reports Certified 10.559 ms/sheet / 142,761 bytes and Rack 16.085 ms/sheet / 148,733 bytes, versus pre-change 11.476 ms / 143,977 bytes and 17.244 ms / 149,721 bytes. Style declarations improved from 0.434 to 0.390 µs/node. `git diff --check` is clean.

- [x] Task 3: Add an alpha modifier to recipe colours (LF-11)
  - Acceptance Criteria:
    - Functional:
      - Colour-typed properties accept `{ role, alpha }` per Task 1.
      - Include shadow layer colours; numeric and referenced opacity modifiers have at most four decimal places. Reduced transparency restores unmodified role references even from alpha 0; intrinsic theme alpha remains unchanged.
      - The validator rejects:
        - an alpha on a non-colour property;
        - an unknown opacity name, or one naming a non-`opacity` value;
        - a number outside [0, 1];
        - extra keys.
      - The projection is byte-stable. Forced colours and reduced transparency override it, and both are tested.
      - The proof vocabulary drops its `*.alpha-*` roles (`shadow.ambient.alpha-0-14`, `shadow.ambient.alpha-0-45`, `border.hairline.alpha-1`, `surface.scrim.alpha-0-55`, …), and the Certified and Rack recipes use the modifier instead.
      - `proof/scripts/parity.ts` reports parity unchanged (≤ 1% pixels) for both systems.
    - Performance: CSS bench non-regression. The switch stays ≤ 16.67 ms warm (`css-browser.test.ts`).
    - Code Quality: one `colourValue(value)` projection helper replaces the direct `var(${colourVar(value)})` calls in `src/css/recipe.ts`.
    - Security: law 3 — the hue still comes only from the theme, and the alpha is a bounded number or a design value.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - MDN `color-mix()` percentage semantics with `transparent` in oklab (Context7 `/mdn/content`, checked 2026-10-28).
      - AJV decimal `multipleOfPrecision` (`/ajv-validator/ajv`, checked 2026-10-28); schema tests use 8 to tolerate binary floating-point division.
    - Documentation Reviewed:
      - Task 1's log; `src/css/recipe.ts:21` (the existing `color-mix` for `backgroundOpacity`).
      - `src/__tests__/fixtures/proof/vocabulary.json`; `proof/styles/certified/`, `proof/styles/rack/`; `proof/scripts/parity.ts`.
    - Options Considered:
      - See Task 1.
    - Chosen Approach:
      - As decided in Task 1. Reuse the prepared validated design-system data for CSS cascading, avoiding a duplicate install pass.
      - Migrate the proof exporter boundary from generated alpha roles to role-alpha objects; retain the historical proof source DSL (`colorRole` + `opacity`).
      - The existing approved-artifact parity script covers Certified; add before/after comparisons against pre-task commit `71e1c8b` for both systems, across agent-home, Rack module and the design-system specimen at three widths.
    - API Notes and Examples:
      ```css
      border-color: color-mix(in oklab, var(--lf-c-border_hairline) 100%, transparent);
      ```
    - Files to Create/Edit:
      - `src/formats/design-system.ts`; `src/css/recipe.ts`; `src/css/forced-colours.ts`; `src/css/base.ts` (if reduced transparency must reach it); `src/css/design-system.ts` for state-scoped reduced-transparency reprojection
      - `src/formats/dtcg.ts`; `src/resolve.ts`: shadow colour grammar and opacity-name resolution, including shadow layers.
      - `schemas/design-system.json`
      - `src/__tests__/fixtures/proof/vocabulary.json`; proof catalog, theme, design-system and resolved-recipe fixtures; older `src/__tests__/fixtures/rack.design-system{,-vocabulary}.json` mirrors; `proof/scripts/export-formats.ts`; `proof/GAPS.md`
      - `src/__tests__/design-system.test.ts`, `resolve.test.ts`, `css-design-system.test.ts`, `css-browser.test.ts`, `proof-formats.test.ts`
      - `plans/evidence/016-task-3-alpha-parity.ts` (new): reproducible both-system migration parity; images/results under local-only `evidence/`
      - `docs/spec.md` §6.2/§6.4; `docs/styling.md`; `docs/formats.md`
  - Test Cases to Write:
    - `alpha_modifier_validates`: covers the four rejections.
    - `alpha_projection_byte_stable`.
    - `alpha_reduced_transparency_and_forced_colours` (`css-browser.test.ts`).
    - `proof_vocabulary_has_no_alpha_roles`.
    - Parity run, recorded in the task notes with its command.


  - Notes (executed 2026-10-28):
    - Added the accepted closed `{ role, alpha }` grammar to all four recipe colours and inline/named shadow layers. The install validator rejects literal/unknown roles, `none` modifiers, extra/missing fields, non-colour placement, unknown/wrong-kind opacity references, nonfinite/out-of-range numbers and more than four decimal places. Named modifiers alone impose the precision constraint; unrelated opacity values retain their existing contract.
    - Resolved opacity references through merged inherited values, including inherited/named shadow layers, without mutating input. Recipe input types accept names; resolved colour/shadow types accept numeric alpha only. `colourValue` centralizes direct role, no-paint and deterministic oklab-mix projection (including 0% and 100%), nested into the existing background-opacity mix exactly once.
    - Added state-scoped reduced-transparency declarations, including native hover and open starting styles: alpha 0 recovers its original role, plain state overrides retain precedence, intrinsic theme alpha stays unchanged and `none` stays transparent. Existing base preference rules and forced-colours substitution already implement the remaining contract; no edits to `base.ts` or `forced-colours.ts` were required. Browser coverage proves 0.8 × 0.5 × 0.5 = 0.2 background alpha, shadow multiplication/recovery, state precedence, OS text recovery from alpha 0 and shadow suppression with `forced-color-adjust: auto`.
    - Migrated the proof exporter to role-alpha objects and removed every generated alpha role from both exported themes, the shared proof vocabulary/catalog and recipe/resolved fixtures. The historical proof source DSL already carries `colorRole` plus `opacity`, so it remains the independent source for the export round-trip assertion. Also migrated the older Rack design-system/vocabulary test mirrors; no fixture retains `.alpha-` roles. Updated spec §6.2/§6.4, format/styling docs and the proof gap record. Regenerate with `bun proof/scripts/export-formats.ts --out src/__tests__/fixtures/proof` and `bun scripts/schemas.ts`.
    - Wrote the initial validator/projection regressions first and observed both fail; the added old-mirror regression also failed before migration. Tests cover each colour property, single/array/named shadows, numeric boundaries/precision, referenced precision, inherited child overrides, input immutability, JSON Schema agreement, no-paint preservation and theme-only hue authority. The JSON Schema uses `multipleOf: 0.0001`; AJV tests and docs specify its documented `multipleOfPrecision: 8` option for decimal division. Documentation checked through Context7 (`/mdn/content`, `/ajv-validator/ajv`).
    - Both-system migration parity: `bun plans/evidence/016-task-3-alpha-parity.ts /tmp/liveframe-lf11-baseline`, with the baseline from `git worktree add --detach /tmp/liveframe-lf11-baseline 71e1c8b`. All 18 captures (Certified/Rack × agent-home/Rack module/design-system specimen × 1440/1024/390px) have **0% changed pixels**, against a 1% threshold and per-channel tolerance 16. Regenerating script: `plans/evidence/016-task-3-alpha-parity.ts`; local images/diffs/results: `evidence/016-task-3-alpha-parity/` (never committed).
    - Approved-artifact check: `bun proof/scripts/parity.ts --out evidence/016-task-3-approved-parity`. Restored the 25 local-only references from the exact origin commits in `proof/references/SOURCES.md`, then removed only those restored files after capture. Certified pixel ratios are 0.721691%, 0.754942% and 0.966723%; the pre-task checkout produces identical JSON results. The script's aggregate `parity` remains `false` because the existing 281 DOM and 32 computed-style differences are unchanged; this task proves unchanged pixels, not closure of those historical gaps. Both-system screenshots above were also captured with the restored fonts. Native Windows/AT auditing remains the existing open gate.
    - Task 5 now explicitly includes the resolver's new colour fields and reduced-transparency recovery tests for native parts, so its later properties receive the same named-alpha and alpha-0 treatment.
    - Isolated CSS benchmark (`bun bench/css.bench.ts`, after the unrelated Rust builds finished): Certified 8.236 ms/sheet / 146,529 bytes and Rack 11.622 ms/sheet / 155,378 bytes, versus pre-task 10.054 ms / 142,761 bytes and 16.553 ms / 148,733 bytes. Generation is faster after reusing the already validated preparation instead of repeating the install pass; sheet growth supplies the alpha mixes and reduced-transparency recovery rules. Theme sheets shrink from 7,706/9,128 to 6,999/8,242 bytes after removing alpha roles. Style declarations remain 0.378 µs/node versus 0.373 µs/node before.

    - Final verification: `bun run check` passed (build, generated-file check, typecheck, lint, format and tests): **729 pass, 4 existing reference-dependent skips, 0 fail**, 733 tests across 96 files. Warm two-surface blur switches peak at 9.5 ms in `css-browser.test.ts` (956 nodes), and 9.0 ms through `<Surface>` (685 nodes), both below 16.67 ms. `git diff --check` and the evidence script's Biome check pass; graft was refreshed.
    - An earlier full run exposed an outdated assertion that counted ordinary and reduced-transparency starting-style rules together; it now checks ordinary rules separately, with a regression for alpha-free reduced starting styles. Another full attempt overlapped unrelated Rust builds (load 40–59) and suffered broad timing/browser failures; no assertions were weakened. The final full run and benchmark above passed after CPU pressure returned below 1%.


- [x] Task 4: Check declared contrast pairs when a theme is installed (LF-10)
  - Acceptance Criteria:
    - Functional:
      - A vocabulary may declare `contrast: [{ foreground, background, minimum, maximum?, lessThan?, description? }]`, naming declared colour roles. `lessThan` is a zero-based pair index, not a name.
      - Optional `contrastBase` names a declared surface role whose theme colour must be opaque; it is required when a contrast pair's background is translucent. Composite background over base, then foreground over background, in encoded sRGB after the decided gamut conversion.
      - Unknown roles, nonfinite/out-of-range thresholds (outside [1, 21]), `maximum < minimum`, dangling/self/cyclic `lessThan` indices and missing/nonopaque required bases are rejected.
      - `validateTheme` computes WCAG 2.x contrast after compositing per Task 1, and fails with `insufficient-contrast`:
        - naming the pair and the measured ratio (to two decimals);
        - for an ordering violation, naming both pairs.
      - Conversion tests cover every DTCG colour space Liveframe accepts, against reference values, and alpha compositing is tested.
      - A vocabulary without `contrast` behaves exactly as in 0.1.0: the existing theme tests are unchanged.
      - `designSystemSuite` (or a new theme case in the kit) runs the check against every installed theme.
      - `docs/compatibility.md` § Growth lists the new error kind.
    - Performance: O(pairs) per install, with no per-render cost.
    - Code Quality: colour math in one module, `src/formats/contrast.ts`, pure and host-API-free.
    - Security: law 3 is unchanged. Law 2 — a user- or agent-installed theme that is unreadable fails closed at install.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
      - `investigate-first`, if conversion references disagree.
    - Library Documentation to Check Before Implementation:
      - WCAG 2.2 §1.4.3/§1.4.11 definitions; CSS Color 4 sample code for conversions; the DTCG colour module.
    - Documentation Reviewed:
      - `src/formats/theme.ts:79-163`; `src/formats/dtcg.ts`; `src/formats/vocabulary.ts`.
      - `src/conformance/design-system.ts`.
      - Clay's evidence (text ≥ 4.5, UI ≥ 3.0, hairline ≥ 1.2 and strictly quieter than `border.subtle`) and Synapta's (`tokens.json` pairs).
    - Options Considered:
      - APCA as the gate — rejected: WCAG 2.x is the cited contract, and APCA stays a hint at most.
      - Adding a colour library dependency — rejected: the conversion matrices are small, and a dependency in the root export would need a justified plan task.
    - Chosen Approach:
      - A small in-repo module, with reference-value tests.
    - API Notes and Examples:
      ```json
      "contrast": [{ "foreground": "text.muted", "background": "surface.raised", "minimum": 4.5 },
                   { "foreground": "border.hairline", "background": "surface.base", "minimum": 1.2, "lessThan": 2 },
                   { "foreground": "border.subtle", "background": "surface.base", "minimum": 1.2 }],
      "contrastBase": "surface.base"
      ```
    - Files to Create/Edit:
      - `src/formats/contrast.ts` (new); `src/formats/vocabulary.ts`; `src/formats/theme.ts`
      - `src/errors.ts` (kind)
      - `src/conformance/design-system.ts`: existing `every_theme_installs` path already checks all themes; prove contrast failures through its test rather than add a duplicate case.
      - `src/formats/catalog.ts`: keep the catalog change classifier compatible with optional vocabulary fields and classify changed contrast contracts conservatively as major.
      - `schemas/catalog.json`: embeds the vocabulary schema; there is no standalone published `schemas/vocabulary.json`.
      - `proof/scripts/export-formats.ts`: source declarations for the generated proof vocabulary/catalog mirrors.
      - `src/__tests__/fixtures/proof/vocabulary.json` (declare Certified/Rack pairs, so the proof themes are checked)
      - `docs/spec.md` §6.1/§6.5/§10; `docs/styling.md`; `docs/formats.md`; `docs/compatibility.md`
  - Test Cases to Write:
    - `converts_every_dtcg_space_to_luminance` (`theme.test.ts`).
    - `composites_alpha_before_ratio`.
    - `translucent_background_requires_opaque_declared_base`, `rejects_invalid_pair_ordering_graph`.
    - `wide_gamut_srgb_clipping_reference_values`, `thresholds_compare_unrounded_ratios`.
    - `pair_below_minimum_fails_with_ratio`.
    - `pair_above_maximum_fails`, `ordering_violation_names_both_pairs`.
    - `vocabulary_without_contrast_unchanged`.
    - `proof_themes_pass_their_pairs`.
    - `conformance_theme_contrast_case`.
    - Conversion/theme cases live in dedicated `src/__tests__/contrast.test.ts`; declaration/schema cases in `vocabulary.test.ts`, classifier regressions in `catalog.test.ts`, and installed-theme regressions in `conformance-design-system.test.ts`.
    - Existing fixture callers: `css-theme.test.ts` removes proof-only contrast fields when replacing the vocabulary with a one-role serialization fixture; `css-browser.test.ts` switches to another readable colour; `schemas.test.ts` copies the new module into its isolated publisher fixture.
  - Notes (executed 2026-10-28):
    - Added optional bounded contrast declarations and an opaque surface base, closed schema/type validation, role references, finite thresholds, maximum/minimum consistency and linear-time ordering-graph validation. `validateTheme` evaluates only structurally valid themes and returns bounded `insufficient-contrast` errors with pair indices, roles and two-decimal ratios; malformed/missing bases and nonfinite conversions fail as invalid theme data.
    - `src/formats/contrast.ts` contains the host-API-free conversions for all 14 DTCG spaces, XYZ D65/Bradford adaptation, deterministic linear-sRGB clipping, encoded-sRGB source-over and unrounded WCAG comparisons. Role conversion is cached per install. Golden chromatic references, saturated clipping, alpha/base compositing, lower/upper bounds, strict ordering, bounded failures and legacy no-pair behaviour are covered in `contrast.test.ts`; declarations/schema and catalog classification have separate regressions.
    - Reference finding: the current CSS Color 4 sample uses a power-2.4 Rec.2020 transfer, unlike the accepted decision's piecewise inverse. Preserved the explicitly approved piecewise contract and pinned the matching [2025-04-24 sample](https://www.w3.org/TR/2025/CRD-css-color-4-20250424/#color-conversion-code) in implementation, golden tests and spec. No new dependency or alternative contrast model was introduced.
    - Reused `designSystemSuite`'s existing all-theme install case; a regression proves a broken second theme fails. The proof exporter declares six pairs for both Certified and Rack, including text ordering and border bounds; regenerated vocabulary/catalog mirrors validate. Hairline and subtle roles are equal in the existing proof themes, so no false strict ordering is imposed between those roles.
    - Kept the catalog change classifier compatible with optional non-list vocabulary fields. Changed contrast contracts/bases conservatively require a major; descriptions and an explicit default maximum of 21 do not change classification. Spec §6.1/§6.5/§10, format/styling guidance and compatibility Growth document the shipped behaviour and new error kind. Vocabulary schema remains embedded in `schemas/catalog.json`, with no new published schema identity.
    - Initial full verification found fixture integration issues: one-role serialization fixtures retained now-invalid proof role references, a switch fixture made text equal its background, the isolated schema publisher omitted the new module, the spec error table omitted the new kind, and an archive doc link pointed outside shipped files. Corrected those exact callers/docs; their focused run passed **50 tests across 6 files**. No assertions were weakened. The core focused run passed **44 tests across 5 files**.
    - Install timing (1,000 warmed validations of each generated proof theme with six pairs): Certified **0.453 ms/install**, Rack **0.357 ms/install**, below the existing 2 ms theme-install budget. Reproduce with `validateTheme` against `src/__tests__/fixtures/proof/{vocabulary,certified.theme,rack.theme}.json`, 50 warmups and 1,000 measured calls per theme.
    - Final verification: `bun run check` passed build, generated-file freshness, typecheck, lint, formatting and tests: **743 pass, 4 existing reference-dependent skips, 0 fail**, 747 tests across 97 files (281.09 s). `git diff --check` is clean. The intervening full run had one existing browser-fixture timeout under elevated machine load (742 pass, 4 skip, 1 fail); its complete browser file passed on retry (23 tests, including that case at 4.32 s against its unchanged 5 s limit), and the final full run passed the same case at 4.45 s. No test limits were changed. Standalone pixel parity and release gates remain whole-plan checks, not repeated for this install-only task.

- [x] Task 5: Add placeholder and scrollbar recipe properties
  - Acceptance Criteria:
    - Functional:
      - `placeholderColor`, `scrollbarThumbColor` and `scrollbarTrackColor` are recipe properties that accept theme roles, `none` and the alpha modifier.
      - The projection follows Task 1. States are honoured only where Task 1 says, and unsupported states are rejected at install with a message naming the property.
      - Placeholder colour honours all existing states and emits `opacity: 1`; scrollbar colours are rest-only and must resolve as a thumb/track pair. Safari before 26.2 and WebKitGTK before 2.52.3 keep native scrollbars; no prefixed fallback is emitted.
      - Extend Task 3's colour-field handling in `src/resolve.ts` and reduced-transparency reprojection to all three properties. Named alpha resolves before projection, and reduced transparency recovers the role even from alpha 0 while preserving intrinsic theme alpha and `none`.
      - The completeness check (spec §6.2) covers them.
      - Forced colours leave native parts to the OS, with no system colour emitted outside the forced-colours block.
      - Browser tests in Chromium, and in WebKit if plan 019 Task 6's harness exists by then (otherwise recorded for that task), show the computed `scrollbar-color` and `::placeholder` colour.
      - Spec §6.4 removes "design-system-controlled placeholder/scrollbar colours" from "Outside this projection".
      - The backlog entry is closed with a resolution.
    - Performance: CSS bench non-regression.
    - Code Quality: the entries go in `src/formats/fixed.ts:59+` and the property-to-CSS map in `src/css/recipe.ts`. Pseudo-element rules are emitted by the same selector builder.
    - Security: law 3 — roles only.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - MDN `scrollbar-color` and `::placeholder` compatibility; Playwright 1.64 `getComputedStyle` on pseudo-elements.
    - Documentation Reviewed:
      - Task 1's log; `src/css/recipe.ts`; `src/css/design-system.ts`.
      - `proof/GAPS.md:180`, `proof/PARITY.md:83` (Rack's old WebKit thumb styling).
    - Options Considered:
      - Keep native parts on `color-scheme` only — rejected: the owner put the backlog item in scope.
    - Chosen Approach:
      - Closed recipe properties, as the backlog entry requires.
    - API Notes and Examples:
      ```json
      { "scroll.default.root.rest": { "scrollbarThumbColor": "surface.scrollbar", "scrollbarTrackColor": "none" } }
      ```
    - Files to Create/Edit:
      - `src/formats/fixed.ts`; `src/formats/design-system.ts`; `src/resolve.ts`; `src/css/recipe.ts`; `src/css/design-system.ts`; `src/css/forced-colours.ts`
      - `schemas/design-system.json`
      - `proof/styles/rack/*`; proof catalog and fixture mirrors if obsolete native-part slots are removed (map rest thumb/track colours onto the actual scrolling slot; remove unsupported thumb hover/active recipes and document native interaction).
      - `docs/spec.md` §6.2/§6.4; `docs/styling.md`; `plans/backlog.md`
  - Test Cases to Write:
    - `native_part_properties_validate`.
    - `native_parts_resolve_alpha_and_recover_reduced_transparency`.
    - `scrollbar_rejects_nonrest_declarations_and_incomplete_pairs`.
    - `scrollbar_projection_byte_stable`.
    - `placeholder_and_scrollbar_computed` (`css-browser.test.ts`).
    - `native_parts_no_system_colour_outside_forced_block`.
  - Notes (executed 2026-10-28):
    - Added `placeholderColor`, `scrollbarThumbColor` and `scrollbarTrackColor` as colour-typed recipe properties (theme role, `none`, `{ role, alpha }`; named alpha resolves before projection). `colourProperties` and `scrollbarProperties` in `src/formats/fixed.ts` replace the two hard-coded colour lists in `src/resolve.ts` and the one in `src/css/design-system.ts`. The install validator rejects a scrollbar property in any non-rest recipe, naming the property; the cascade rejects a rest recipe whose thumb and track do not resolve together (`incomplete-design-system`). The generated `schemas/design-system.json` gained the three properties.
    - Projection: `scrollbar-color: <thumb> <track>` is a normal recipe declaration, so states inherit the rest pair and repeat the same value. The placeholder is a pseudo-element, so `placeholderDeclarations` (`src/css/recipe.ts`) feeds a separate `placeholderRules`: it goes through the same `selector()` builder, now taking a pseudo suffix, and honours all eight states including the hover media rule and disabled guards. A state repeating the rest placeholder emits no rule, and a state that differs only in placeholder emits no main rule, forced cue or entry style. Reduced transparency reprojects both from unmodified roles (alpha 0 recovers); forced colours emit `scrollbar-color: auto` and `::placeholder{color:GrayText;opacity:1}` inside the forced block only.
    - Proof: Rack's `viewport` slot (the element that scrolls in the proof primitive) carries `scrollbarThumbColor: surface.scrollbar` and `scrollbarTrackColor: none`; its track, thumb hover and thumb active source recipes are gone. `proof/styles/recipes.ts` keeps the pair out of the states it expands from rest, and the exporter's independent comparison cascades it back. Certified is unchanged, so its artifact parity is untouched. The proof catalog keeps its unrendered `scroll.scrollbar` slot and Rack's rest recipe for it; removing the slot would change the 616-recipe catalog and was not needed. A finding for later: that slot is now vestigial in the proof.
    - Tests written first: seven failed before implementation, then passed (`native_part_properties_validate`, `scrollbar_rejects_nonrest_declarations_and_incomplete_pairs`, `native_parts_resolve_named_alpha`, `scrollbar_projection_byte_stable`, `placeholder_projects_through_the_state_selector_builder`, `native_parts_resolve_alpha_and_recover_reduced_transparency`, `native_parts_no_system_colour_outside_forced_block`). The Chromium test `placeholder_and_scrollbar_computed` fails when its expected alpha is changed, so it measures. It shows computed `scrollbar-color` and `::placeholder` colour for alpha, hover, forced colours (`auto`, `GrayText`) and reduced transparency. The AJV agreement test compares structure only: the schema cannot know which role names a vocabulary declares. Older checks widened for the new forms: `colour_authority_holds` accepts a `scrollbar-color` pair or `auto` and rejects a literal or system colour pair; the proof style check skips `none` on the new properties.
    - WebKit: plan 019 Task 6's harness does not exist yet, so the WebKit computed-style proof is recorded for that task. Chromium only here. Thumb hover/press parity and native Windows/AT behaviour remain the platform limitation recorded in the decision log (G29 stays open).
    - Docs: spec §6.2 (native parts), §6.4 (preferences, forced colours, "Outside this projection" now lists scrollbar thumb states and geometry instead of placeholder/scrollbar colours), `docs/styling.md`, `docs/formats.md`. The backlog entry "Evaluate placeholder and scrollbar recipe properties on adopter demand" is closed with a resolution, and the Clay handoff line points at the new properties. `proof/GAPS.md` Rack scrollbar entry updated.
    - Verification: `bun run check` passed (751 pass, 4 existing reference-dependent skips, 0 fail, 755 tests across 97 files; the first run failed two older colour-authority checks, fixed as above). `git diff --check` is clean. CSS bench, run under machine load of 7–9, gives Certified 9.2 ms/sheet at an unchanged 146,529 bytes and Rack 11.8–12.8 ms/sheet at 155,518 bytes (+140 bytes for its scrollbar rules), against 8.2 ms / 146,529 and 11.6 ms / 155,378 after Task 3. Style declarations are 0.378 µs/node. The Certified byte count is unchanged, so the time difference is load; re-measure under quiet conditions in Task 7.

- [ ] Task 6: Close the proof composition gaps G30, G31 and G2 (proof-only)
  - Acceptance Criteria:
    - Functional:
      - **G30:** the proof catalog's `icon` declares the `tone` style prop. The proof widgets' row markers and kicker take their tones, and the artifact parity for those glyphs improves or holds.
      - **G31:** the proof `tab` gains a generic count slot (an optional `count` prop drawn in its own slot). "All 12" renders as two runs, in the face the recipe gives each slot.
      - **G2:** the proof vocabulary declares five identity roles (`identity.1`–`identity.5`, fillable) and diagnostic fill roles (for example `diagnostic.error`, `diagnostic.warning`). Both Certified themes define them with distinct values, so identity no longer aliases under Certified.
      - Proof parity holds for both systems. `proof/GAPS.md` marks G30, G31 and G2 resolved. The backlog entries "Composition surface gaps from the parity re-proof" and the G2 line of "Hand adopter gaps" are updated. `position: relative` and `basis` stay open in that entry, because neither document raised them.
    - Performance: n/a — proof fixtures.
    - Code Quality: changes stay in `proof/` and its fixture mirrors under `src/__tests__/fixtures/proof/`, with nothing in `src/` library code. The count slot is generic, not product-shaped.
    - Security: law 3 — tones and fills are theme roles.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (proof rules: `src/` never imports `proof/`).
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `proof/GAPS.md:164-165` (G30, G31) and `:81` (G2 aliasing).
      - Backlog lines 30–40 and 79.
      - `src/validate/style.ts:117` (`tone` is permitted per kind by the definition's `styleProps`, so G30 needs no library change).
    - Options Considered:
      - A library `iconTone` prop — rejected: `tone` already exists, and kinds opt in.
    - Chosen Approach:
      - Catalog and style data only.
    - API Notes and Examples:
      ```tsx
      <Icon name="flag" tone="attention" /> <Tab label="All" count="12" />
      ```
    - Files to Create/Edit:
      - `src/__tests__/fixtures/proof/catalog.json`, `vocabulary.json` and the theme fixtures; `src/__tests__/fixtures/widgets/ui.gen.ts`
      - `proof/catalog/*`, `proof/styles/*`, `proof/widgets/*` and the proof `tab`/`icon` implementations
      - `proof/GAPS.md`; `plans/backlog.md`
  - Test Cases to Write:
    - `icon_accepts_tone` (`proof-formats.test.ts`).
    - `tab_count_renders_in_own_slot` (proof renderer browser test).
    - `certified_identity_roles_distinct` (`proof/tests/*`).
    - Parity run, recorded with its command.

- [ ] Task 7: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/016-impact-analysis.md` records all 12 areas, with particular care on area 5 (Styling) and area 3 (law 3).
      - Findings are presented to the owner and disposed of.
    - Performance: record the CSS bench and warm-switch numbers.
    - Code Quality: n/a.
    - Security: re-run the colour-authority checks over every new value form.
  - Approach:
    - Skills to Use:
      - `create-plan`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Reference §5.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - The standard sweep.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/016-impact-analysis.md` (new); `plans/backlog.md`; this plan.
  - Test Cases to Write:
    - None.

## Verification (whole plan)
- `bun run check`
- `bun run bench`
- `bun proof/scripts/parity.ts` (both systems; record the output in the task notes)
- `bun run release:gate`

## Compromises Made
- To be filled after tasks are completed and tests pass.

## Further Actions
- To be filled after task completion with improvements, rationale, and priority.
