---
date: 2026-10-28 11:23
status: approved
decision_about: "No-paint, role alpha, contrast pairs and native-part recipes"
proposed_by: "both"
explicitly_approved_by_user: true
---

# Decision: Styling paint, alpha, contrast and native parts

## Decision

Adopt the contracts below for plan 016 Tasks 2–5: an explicit no-paint keyword, theme-role alpha modifiers, vocabulary-declared WCAG contrast checks, and standard placeholder/scrollbar colour properties. These are additive `/1` format extensions; this record specifies implementation work, not support already shipped.

## Context

CL-04 needs to clear inherited recipe paint; LF-11 needs translucency without multiplying theme roles; LF-10 needs install-time contrast checks, including Clay's upper bound and ordering constraint. Clay also requests placeholder and scrollbar styling. All four share the closed recipe colour grammar. Spec §6 currently describes the shipped role-only grammar and excludes native-part recipes; Tasks 2–5 must update its normative text alongside implementation. This record supersedes the native-part exclusion in decision 2026-10-23-2314 for those tasks only.

## Approval

- Proposed by: both, through plan 016 and execution of its open choices.
- Approved by user: Yes.
- Approval evidence: “Complete - [ ] Task 1: Record the styling format decisions from plans/016-Phase-7-Part-C-Styling-Paint-Alpha-Contrast-And-Native-Parts.md and update the plan once done”. This explicitly authorizes recording these decisions and resolving the questions enumerated by that task.

## Contracts and Alternatives Considered

### 1. CL-04: no paint

- Accept `"none"` on `backgroundColor`, `borderColor`, `outlineColor` and the three new native-part properties. Emit `transparent`, never a theme variable. Reject it on `textColor`: no adopter supplies a use requiring invisible text. Shadow layers retain a role or role-alpha colour; an empty shadow array already clears shadows.
- Reserve the exact colour-role name `none` in vocabularies; nested names such as `surface.none` remain ordinary theme roles. An omitted property still inherits through the recipe cascade; an explicit `none` clears it.
- **Forced-colours conflict:** retain the inward 1px `CanvasText` outline for an explicitly declared rest background with no positive border width, including `none`. An absent background alone does not trigger that edge. This chooses CL-04's acceptance bullet over its contradictory “treats none as no background” sentence: an unpainted button can still need a boundary. State cues retain spec §6.4 precedence, and `forced-color-adjust` stays `auto`.
- **Rejected:** a zero-alpha theme role burdens every theme and confuses paint clearing with colour; treating an explicit `none` as absence loses the requested boundary; `currentColor` paints rather than clears; invisible text lacks demonstrated demand.
- **Law 3:** `none` supplies no hue. System edge colours remain confined to the forced-colours media block.

**Browser sketch:** `bun plans/evidence/016-task-1-browser-sketch.ts` compares an absent background with an explicit no-paint background under Chromium forced-colours emulation. It models the proposed declarations rather than calling an unimplemented validator. The explicit case must have a 1px outline at −1px offset, the absent case no outline, and both `forcedColorAdjust: auto`. It also checks alpha multiplication. This is not a native Windows/AT audit (G29).

### 2. LF-11: role-alpha grammar and projection

- A colour modifier is a closed object `{ role, alpha }`, both fields required. `role` must name a declared theme role, never `none`; `alpha` is a finite number in [0, 1] at most four decimal places, or the name of an existing design-system value whose type is `opacity`. Named values used here must satisfy the same precision constraint; do not tighten unrelated existing opacity values. Reject extra fields, unknown/wrong-type names and modifiers on non-colour properties.
- Accept the object on `backgroundColor`, `textColor`, `borderColor`, `outlineColor`, `placeholderColor`, `scrollbarThumbColor`, `scrollbarTrackColor`, and each shadow layer's `color`. Extend the DTCG-derived shadow colour reference grammar in `src/formats/dtcg.ts`, not just recipe validation. Resolve opacity names before projection; the resolved object retains its role and numeric multiplier.
- Emit `color-mix(in oklab, var(--lf-c-<encoded-role>) N%, transparent)`. Convert the bounded multiplier to a percentage with at most two decimal places and no trailing zeroes; alpha 0 and 1 use the same grammar. The theme's intrinsic alpha is multiplied, not replaced. Plain role references keep their existing direct `var()` projection.
- For a background with both modifiers, multiply them: `themeAlpha × roleAlpha × backgroundOpacity`. Use the role-alpha mix as the input to the existing `--lf-alpha` background mix; do not overwrite `--lf-alpha` with the role modifier or multiply either twice. No `backgroundOpacity` means a factor of 1. `none` remains transparent regardless of `backgroundOpacity`.
- Reduced transparency removes recipe alpha modifiers (including shadow/native-part modifiers), forces the existing background multiplier to 1 and disables backdrop filtering. Reproject affected declarations with unmodified role references in the preference block so alpha 0 can recover too; multiplying an already transparent colour cannot recover it. Theme-intrinsic alpha remains theme-owned and unchanged, as with the existing background-opacity contract. Explicit `none` remains no paint. This preference remains progressive enhancement where unsupported.
- Forced colours retain OS colour substitution and the existing state/edge table, suppress shadows as the UA normally does, and reset native parts as below. Do not attempt to preserve recipe alpha over OS colours or emit `forced-color-adjust: none`.
- **Rejected:** per-alpha theme roles scale with each recipe step; relative-colour channel arithmetic adds a less uniform compatibility dependency; multiplying an already mixed colour by 1 does not undo alpha under reduced transparency. `color-mix()` is already in the Baseline 2024 contract (MDN BCD: Chrome 111, Firefox 113, Safari 16.2).
- **Law 3:** all hue comes from the referenced theme variable; the only added input is a bounded scalar. Neither raw CSS nor literal colours become valid input.

### 3. LF-10: vocabulary contrast contract

```ts
contrast?: {
  foreground: string;
  background: string;
  minimum: number;
  maximum?: number;
  lessThan?: number; // zero-based index into this contrast array
  description?: string;
}[];
contrastBase?: string; // a declared surface role; needed for translucent backgrounds
```

- Both roles must be declared colour roles. Thresholds must be finite in [1, 21], with `maximum >= minimum`. `lessThan` is an in-range integer index, distinct from the current pair; reject dangling references and cycles. Use indices only, with no new pair-name namespace. Descriptions are explanatory, not identity. Errors identify pair index and both roles.
- An opaque background needs no base. For a translucent background, require `contrastBase` naming a declared `surfaceRoles` member whose installed theme colour is opaque. Composite the background over that base, then the foreground over the resulting opaque background. Reject a missing/nonopaque base as invalid theme data, not as a guessed contrast ratio. Validate a supplied base's role at vocabulary install and opacity at theme install. This adds no required field for existing vocabularies or themes without pairs.
- Convert each role through linear-light CIE XYZ D65 using CSS Color 4 sample algorithms and DTCG component conventions. Treat missing (`"none"`) components as zero for a standalone colour, and omitted alpha as 1; `hex` is fallback metadata, never an independent source of truth.

| Accepted space | Route to XYZ D65 |
| --- | --- |
| `srgb` | Inverse sRGB transfer, linear-sRGB matrix |
| `srgb-linear` | Linear-sRGB matrix directly |
| `hsl`, `hwb` | Convert to encoded sRGB, then the sRGB route (DTCG hue in degrees; saturation/lightness/whiteness/blackness in [0, 100], normalized by 100 before conversion) |
| `lab` | Inverse Lab to XYZ D50, Bradford adaptation to D65 |
| `lch` | Polar to Lab, then the Lab route |
| `oklab` | Inverse Oklab to linear sRGB, then XYZ D65 |
| `oklch` | Polar to Oklab, then the Oklab route |
| `display-p3` | Inverse sRGB transfer, P3-to-XYZ D65 matrix |
| `a98-rgb` | Sign-preserving power 563/256, A98-to-XYZ D65 matrix |
| `prophoto-rgb` | Piecewise inverse transfer (linear toe, power 1.8), XYZ D50, Bradford to D65 |
| `rec2020` | Piecewise inverse Rec.2020 transfer, Rec.2020-to-XYZ D65 matrix |
| `xyz-d65` | Identity |
| `xyz-d50` | Bradford adaptation to D65 |

- **Wide gamut:** convert XYZ D65 to linear sRGB, clip its channels to [0, 1], then encode sRGB. This is a deterministic sRGB evaluation policy, not a claim that WCAG prescribes a unique wide-gamut mapping or that browser perceptual gamut mapping matches clipping. Do not clip XYZ or source-space channels prematurely. Test saturated out-of-sRGB colours as well as neutral reference values.
- **Compositing:** source-over in encoded sRGB after that conversion: `C = a × source + (1 − a) × destination`, per channel, first background/base then foreground/background. Linearize the final opaque RGBs for WCAG luminance; do not directly interpolate luminance or mix it with encoded-channel compositing.
- **WCAG 2.x:** for encoded channel `c`, linear `c' = c / 12.92` when `c <= 0.04045`, otherwise `((c + 0.055) / 1.055)^2.4`. `L = 0.2126R' + 0.7152G' + 0.0722B'`; ratio is `(max(Lfg, Lbg) + 0.05) / (min(Lfg, Lbg) + 0.05)`. Compare unrounded ratios to inclusive minimum/maximum and strictly enforce `ratio[i] < ratio[lessThan]`; round only diagnostic output to two decimals.
- Below-minimum, above-maximum and ordering failures use the new `insufficient-contrast` kind. An ordering message names both pair indices/roles and both ratios. Bad declarations retain ordinary format errors. Conversion results are cached per role; pair evaluation/order checks are O(pairs) after conversion, run once on theme install, and repeated for every installed theme in `designSystemSuite`.
- Do not add an APCA `expected` field: APCA is outside the requested WCAG gate, and an unchecked informational field would add an unnecessary contract.
- **Rejected:** a hardcoded `surface.base` assumes app naming; black/white backdrop bounds can reject intentional translucent surfaces and require reasoning about intermediate backdrops; a DOM/background lookup makes installation host-dependent; direct wide-gamut XYZ Y without an sRGB policy is not the chosen WCAG computation; APCA and a new colour dependency add unneeded scope.
- **Law 3:** only theme colours are measured; declarations name roles and thresholds, never hue. This gate measures declared role pairs, not every recipe alpha, layout or actual backdrop; app conformance still checks rendered readability and Clay's own gate remains authoritative.

### 4. Native-part recipes

- `placeholderColor` targets a slot whose element draws an input/textarea, emitting the ordinary slot/state selector followed by `::placeholder { color: <colour>; opacity: 1 }`. Honour all eight existing recipe states, with existing disabled/hover guards. The explicit opacity prevents UA placeholder dimming from applying a second multiplier. Hosts must attach the slot class to the actual input; no new kind or slot metadata is introduced.
- `scrollbarThumbColor` and `scrollbarTrackColor` target the actual scrolling slot and emit standard `scrollbar-color: <thumb> <track>`. Accept roles, `none` and role-alpha objects on all three properties. Both scrollbar values must be present together after rest resolution/cascade; reject incomplete pairs rather than inventing a thumb/track colour. Ordinary completeness and colour-authority checks apply.
- Scrollbar properties are **rest-only**. Reject an explicit declaration in any non-rest recipe at install, naming the offending property. Inheriting rest values into resolved states is valid. Container hover/active is not thumb hover/active, so no translation to a container state is allowed.
- **Browser policy:** standard `scrollbar-color` is supported by Safari 26.2 and WebKitGTK 2.52.3; do not infer one port's support from another. Earlier engines keep native scrollbars. Emit no `::-webkit-scrollbar-*` fallback and do not raise the Baseline 2024 floor; scrollbar colouring is progressive enhancement. `::placeholder` uses the standard pseudo-element. Installed versions remain a host verification responsibility.
- Forced colours emit `scrollbar-color: auto` and restore placeholder `color: GrayText; opacity: 1` within the forced-colours block, with OS substitution left enabled. No system colour appears in ordinary sheets. Native scrollbar geometry and thumb interaction remain OS-owned.
- **Clay mapping:** move `scroll.default.scrollbarTrack.rest` colour to `scroll.default.root.rest.scrollbarTrackColor` and the thumb rest colour to `scrollbarThumbColor` on that same real scrolling slot. Drop the old decorative part-slot recipes if those slots only represented native scrollbars. Do not map `scrollbarThumb.hover` / `.active` to container states: those unsupported declarations must be removed with the native-interaction limitation documented. A placeholder part-slot similarly becomes `placeholderColor` on the actual input slot. Trusted host implementations choose their actual slot names; the library gains no Clay-specific names.
- **Rejected:** prefixed fallback styling creates a second state model that standard implementations can override; accepting thumb hover silently promises an unsupported interaction; arbitrary raw pseudo-selectors break the closed format; retaining only `color-scheme` on every engine fails adopter demand where the standard API exists.
- **Law 3:** all native-part paint comes from theme roles or no-paint, with bounded alpha; OS system colours occur only in forced-colours overrides.

## Rationale and Evidence

The current implementation validates recipe colour strings in `src/formats/design-system.ts:273–295`, carries shadow role strings in `src/formats/dtcg.ts`, and projects `backgroundOpacity` using `color-mix()` in `src/css/recipe.ts`. `src/css/forced-colours.ts:13–25` already distinguishes declared backgrounds by presence; `src/css/base.ts:32` currently only overrides the background multiplier. These are the shared extension points, rather than widget props or host-specific patches.

Documentation checked on 2026-10-28: Context7 `/mdn/content` (one library resolution and two documentation queries), current MDN browser-compat data, WCAG 2.2, CSS Color 4 sample conversions, DTCG 2025.10, and the relevant WebKit release announcements. Browser sketch execution and whole-repo check results are recorded in plan 016 Task 1 notes. No screenshot is required for the computed-style sketch.

## References

- [Plan 016](../plans/016-Phase-7-Part-C-Styling-Paint-Alpha-Contrast-And-Native-Parts.md), Task 1 — decision scope and subsequent implementation gates.
- [Spec §6](../docs/spec.md#6-styling-clays-model) — current authority and forced-colours/platform contract.
- [Original CSS projection decision](2026-10-23-2314-css-projection-model.md) — environment overrides and the native-part exclusion superseded here.
- [Clay requests](../plans/requests/clay-adoption-requests.md), CL-04 and extra LF-10/LF-11/native-part acceptance.
- [Synapta requests](../plans/requests/synapta-adoption-requests.md), LF-10 and LF-11.
- [MDN color-mix](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix) and [relative colours](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Colors/Using_relative_colors) — alpha semantics.
- [MDN colour browser data](https://github.com/mdn/browser-compat-data/blob/main/css/types/color.json) — support floor.
- [WCAG 2.2 luminance](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance) and [contrast](https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio) — computation and thresholds.
- [CSS Color 4 conversion sample code](https://www.w3.org/TR/css-color-4/#color-conversion-code) — transfer functions, matrices and chromatic adaptation; use the 2026-10-27 published draft for reproducible reference values.
- [DTCG Color Module 2025.10](https://www.designtokens.org/tr/2025.10/color/) — supported spaces, missing components and alpha.
- [MDN placeholder](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::placeholder), [scrollbar-color](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-color) and [prefixed scrollbars](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::-webkit-scrollbar) — standard projection and limitations.
- [Safari 26.2](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/) and [WebKitGTK 2.52.3](https://webkitgtk.org/2026/04/16/webkitgtk2.52.3-released.html) — independent support evidence.
- [Browser sketch](../plans/evidence/016-task-1-browser-sketch.ts) — regenerate with `bun plans/evidence/016-task-1-browser-sketch.ts`.

## Consequences

- Tasks 2–5 update validators, TS types, schemas, resolver, CSS, conformance and spec together; no library changes occur in Task 1.
- Task 3 must extend shadow schemas and resolution as well as ordinary recipe properties, and prove reduced-transparency recovery from alpha 0. Its proof migration must preserve original colours rather than merely rename roles.
- Task 4 adds `contrastBase`, index-only ordering, malformed/cyclic-reference rejection, reference conversions for all 14 spaces and explicit sRGB gamut/compositing tests. No render-path work is introduced.
- Task 5 must reject unsupported scrollbar states, incomplete pairs and migrate obsolete proof slots; older engines keep native scrollbars. Thumb hover/active parity is an explicit platform limitation.
- Revisit this record if new adopter evidence requires invisible text, a standardized thumb-state API, a different wide-gamut contrast policy or broader accessibility measurement. Runtime/browser parity and the native Windows audit remain later gates.
