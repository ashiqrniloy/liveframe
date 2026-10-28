# Plan 016 — architectural impact analysis

Reviewed 2026-10-28 against delivered Tasks 1–8 (`c03090e`, `71e1c8b`, `f61368c`,
`f9e2123`, `c347cb9`, `3e6293e` and the Task 7 and 8 commits), spec §6.1, §6.2, §6.4,
§6.5 and §10, the accepted
[styling decision](../../decision-logs/2026-10-28-1123-styling-paint-alpha-contrast-native-parts.md),
and all twelve impact areas in
`.claude/skills/create-plan/references/liveframe.md` §5.

## Impact areas

1. **Spec.** §6.1 (contrast check on install), §6.2 (`none`, `{ role, alpha }`,
   native parts), §6.4 (projection, reduced transparency, forced colours, "Outside
   this projection"), §6.5 (contrast declarations and calculation) and the §10
   error table describe what shipped (`docs/spec.md:165,197–200,256,270,294–302,607`).
   "Outside this projection" now lists scrollbar thumb states and geometry rather
   than placeholder and scrollbar colours. No further normative change is needed.

2. **Public API and formats.** No subpath and no runtime dependency was added.
   Format additions, all inside the `/1` identifiers:
   - recipe colour values `"none"` and `{ role, alpha }`;
   - recipe properties `placeholderColor`, `scrollbarThumbColor`,
     `scrollbarTrackColor` (so `recipeProperties` grows by three);
   - vocabulary fields `contrast` and `contrastBase`;
   - error kind `insufficient-contrast`.

   Schemas regenerated together with the types (`schemas/design-system.json`,
   `schemas/catalog.json`, which embeds the vocabulary). Two behaviours can reject
   input that 0.1.0 accepted: a vocabulary can no longer declare a colour role named
   exactly `none` (nested names such as `surface.none` stay valid), and a vocabulary
   that opts into `contrast` can fail a theme that would have installed before.
   Both were approved in the decision log; a vocabulary without `contrast` behaves as
   in 0.1.0. The catalog change classifier treats a changed contrast contract as
   major. `ColourValue`, `ShadowLayer` and `noPaint` are used by exported types but
   not exported themselves: backlog F5.

3. **The four laws.**
   - Law 1: nothing executes or loads in the browser; this plan only changes data
     formats and CSS text.
   - Law 2: a theme that is unreadable against a declared pair fails closed at install
     with `insufficient-contrast`, naming pair, roles and ratio.
   - Law 3 — the focus of this plan. Every new value form takes its hue from a theme
     role, and the validator rejects anything else: literal or unknown roles, `none`
     inside a modifier, extra or missing keys, `none` on `textColor` and shadow
     colours, alpha on a non-colour property, non-finite or out-of-range or
     over-precise alpha, and an alpha name that is unknown or not an `opacity` value.
     The projection emits `var(--lf-c-…)`, `transparent` or `color-mix(in oklab,
     var(--lf-c-…) N%, transparent)`. System colours (`GrayText`, `CanvasText`,
     `Highlight`) and `scrollbar-color:auto` appear only inside the forced-colours block.
     Re-run for this task: a scan over the Rack design system with one of every form
     (alpha on background, text, border, shadow and the three native parts; `none`
     on outline and track; a named opacity; `backgroundOpacity` on top) projected 393
     colour-bearing declarations outside the forced block with 0 literals and 0
     system colours, and `scrollbar-color:auto` inside it (scratch probe; the checked-in
     equivalent is `colour_authority_holds`). The scan exposed a gap in that checked-in
     test, F1, executed as Task 7: it could not accept the alpha form on a `*-color`
     property, and no shipped recipe exercised it. It now runs over a system with every
     form and has three negative cases.
   - Law 4: untouched.

4. **Validation.** Every new input is validated at install with a pointer and a typed
   error: the colour grammar and alpha bounds (`design-system.ts`), the non-rest
   scrollbar rejection that names the property, the thumb/track pair requirement in
   the cascade (`incomplete-design-system`), and the vocabulary's role references,
   thresholds, `maximum >= minimum`, ordering graph (dangling, self, cyclic) and
   opaque `contrastBase`. Theme contrast is evaluated only for structurally valid
   themes, and non-finite conversion results fail as `invalid-document`. Covered by
   `alpha_modifier_validates`, `native_part_properties_validate`,
   `scrollbar_rejects_nonrest_declarations_and_incomplete_pairs`,
   `rejects_invalid_pair_ordering_graph`,
   `translucent_background_requires_opaque_declared_base`,
   `pair_below_minimum_fails_with_ratio`, `pair_above_maximum_fails` and
   `ordering_violation_names_both_pairs`. The JSON Schema agreement test compares
   structure only, because a schema cannot know a vocabulary's role names.

5. **Styling.** Theme authority holds, as in area 3. Recipe completeness covers the
   new properties (the cascade and `resolveRecipes` share the colour-field list in
   `fixed.ts`); the proof's resolved-recipe count is 624 (the tab count slot added
   eight). Projection:
   - `colourValue` is the one place that turns a colour into CSS. `none` is
     `transparent`, including with `backgroundOpacity`; an alpha modifier multiplies
     intrinsic theme alpha and, on a background, feeds the existing
     `--lf-alpha` mix exactly once.
   - Reduced transparency is reprojected per design system inside
     `@media (prefers-reduced-transparency:reduce)` for slots that use a modifier,
     restoring the unmodified role even from alpha 0. Forced colours substitute system
     colours for the new properties; a `none` background keeps the inward edge.
   - The placeholder is a pseudo-element rule built by the same `selector()`; the
     scrollbar pair is rest-only because `scrollbar-color` has no hover state. There is
     no `::-webkit-scrollbar-*` fallback, so Safari before 26.2 and WebKitGTK before
     2.52.3 keep native scrollbars.
   - Open: the host-set `data-lf-transparency` attribute in plan 017 would not restore
     modifiers, since the recovery lives only in the media query (F2). Open: the
     computed-style proof of these features exists only in Chromium (F3).
   - Contrast is an install-time check on a theme, so it does not touch projection.

6. **Interaction tiers.** None — no tier changed. The placeholder honours all eight
   states through the existing state selectors; the scrollbar pair is rest-only and
   states repeat the rest value. Container hover or press is not thumb hover or press,
   so native thumb interaction stays with the OS (limit recorded in spec §6.4 and
   G29).

7. **Performance.** Contrast is O(pairs) per install with conversions cached per role:
   0.453 ms (Certified) and 0.357 ms (Rack) per install for six pairs, below the 2 ms
   theme-install budget. `designSystemCss` now reuses the already validated preparation
   instead of validating twice. Measurements below. The CSS sheets grew by the
   alpha, reduced-transparency and count-slot rules and shrank by the removed alpha
   roles in themes.

8. **Portability.** `src/formats/contrast.ts` and the other additions are plain
   TypeScript with no host API. `src_is_host_api_free` and
   `compiled_output_is_host_api_free` pass, and the archive gate's "host-API-free
   subpaths under node" and browser-bundle steps pass. No dependency was added; the
   conversion matrices are in-repo. The contrast result is a deterministic sRGB-clipped
   approximation of WCAG 2.x and does not claim to reproduce a browser's perceptual
   gamut mapping (spec §6.5).

9. **Agent authoring.** The MCP vocabulary tool returns the whole vocabulary
   (`src/cli/mcp.ts:135`), so declared contrast pairs and `contrastBase` reach an agent
   with no tool change. Errors carry a JSON pointer and an expected form, for example
   "Expected alpha in [0, 1] with at most four decimal places", "Expected an opacity
   value reference", and the pair message with the measured ratio. Generated types now
   include `icon.tone` and the `tab` count in the proof catalog (`ui.gen.ts`,
   regenerated). No tool schema changed.

10. **Docs and examples.** `docs/styling.md`, `docs/formats.md`, `docs/compatibility.md`
    (Growth lists `insufficient-contrast`) and the spec describe the shipped forms,
    including the WebKit limitation and the rest-only scrollbar. The demo host still
    uses the retired zero-alpha and `*.alpha-*` roles; they remain valid, but it is the
    example outsiders copy (F4). Plan 020 Task 3 owns the consolidated 0.2.0 migration
    guide.

11. **Conformance.** `designSystemSuite`'s existing `every_theme_installs` case runs the
    contrast check on every installed theme; `conformance-design-system.test.ts` proves
    a broken second theme fails it, so no duplicate case was added. App-sheet colour
    scanning already treats `scrollbar-*` as colour-bearing and rejects system
    colours. Styled-state reachability compared only main-rule declarations, so a
    state differing from rest only by `placeholderColor` needed no app fixture (F6,
    executed as Task 8: it now does). Plan 019
    Task 4 builds the language-neutral corpus; it should carry `none`, the alpha
    modifier, native-part and contrast success and failure cases from these tests.

12. **Reference hosts.**
    - Clay: CL-04 (`none`), LF-10 (declared contrast pairs, with the upper bound and
      the ordering), LF-11 (alpha) and the placeholder and scrollbar backlog item have
      checkout evidence. Clay's slot-shaped `scrollbarTrack`/`scrollbarThumb` recipes
      map to the pair on the scrolling slot; thumb hover and press stay native
      (recorded in the backlog hand-off).
    - Synapta: G2, G30 and G31 are closed in the proof. Synapta must define its own
      identity colours when it adopts `identity.1–5`.
    - This is checkout and proof evidence, not production adoption. Native
      Windows/assistive-technology behaviour remains G29, owned by plan 020. No
      product component or authority was added to satisfy an adopter.

## Findings and disposition

| ID | Finding and evidence | Recommended disposition | Recorded outcome (owner, 2026-10-28) |
| --- | --- | --- | --- |
| F1 | `colour_authority_holds` could not accept `color-mix(in oklab, …)` on `color` or a `*-color` property, and no shipped recipe exercised that form, so the guard had a blind spot for the new alpha form. | execute | Executed as Task 7: the check is widened, runs over a system with every form and has three negative cases. |
| F2 | Plan 017 Task 5 (`data-lf-transparency="reduced"`) says "no extra rule per design system" and assumes the modifier routes through `--lf-alpha`. It does not: recovery of modifiers and alpha 0 exists only inside the media query. | execute (amend plan 017) | Plan 017 Task 5 amended: the attribute must give the same result as the media query for modifiers and native parts, with a test; its performance line now allows rules only for slots that use a modifier. |
| F3 | Plan 019 Task 6 does not prove `scrollbar-color`, `::placeholder` or `color-mix(in oklab)` in WebKit or Firefox, though Task 5 deferred the WebKit proof to it. | execute (amend plan 019) | Plan 019 Task 6 amended, including the expected Safari 26.2 / WebKitGTK 2.52.3 limitation; the backlog entry points at it. |
| F4 | `examples/demo-host/{catalog,theme,design-system}.json` still declare `colour.transparent` and twelve `*.alpha-*` roles. | backlog P3 | Added: "Move the demo host onto the no-paint and alpha forms". |
| F5 | `ColourValue`, `ShadowLayer` and `noPaint` are not exported from the root. | backlog P4 | Added: "Export the recipe colour types". |
| F6 | `every_styled_state_is_reachable` (`src/conformance/react/states.ts`) did not require a fixture for a state that differs from rest only by `placeholderColor`, because `recipeDeclarations` emits nothing for it, although the projection emits a `::placeholder` rule for that state. Found during the conformance sweep. | backlog P4 | Owner chose to execute: Task 8 compares placeholder declarations too, with `placeholder_only_state_requires_a_fixture`. |

The existing P1 validator investigation is unchanged (see measurements). The
plan 017 and 019 amendments, the WebKit proof and G29 are scheduled work, not claimed
delivered here. This analysis is not a waiver of a timing budget.

## Verification and measurements

Bun 1.4.4, Linux 7.3.0-4-cachyos, AMD Ryzen 9 PRO 7940HS (16 logical CPUs). A QEMU
virtual machine on the host held about 170% CPU and `kswapd` was active through the
first sequence, so that run's load was 7.7–9.5 (1 minute). It finished before the
second sequence. Logs are text evidence in
[`016-task-7/`](016-task-7/); no images were produced.

| Run | Load (1 min) | Result |
| --- | --- | --- |
| `bun run check`, first (before Task 7's test change) | 9.5 → 7.7 | **failed**, 755 pass, 4 skip, 1 fail: `proof/tests/switch.test.ts` agent-home warm switch max 20.20 ms against 16.67 ms (`check.log`). Its siblings in the same file passed (git-status 4.30 ms). |
| `bun run bench`, first | 7.7 | **failed** the validator gate: `core-queue.large` 1.557 µs/node against 1.5 (`bench.log`). |
| `bun run release:gate` | 7.9 | passed, all 8 steps in 5.1 s |
| `bun run demo:test` | 7.9 | passed, 51 tests, 0 fail |
| `bun run check`, after Task 7 | 7.7 → 2.9 | **passed**: 756 pass, 4 existing reference-dependent skips, 0 fail, 760 tests across 97 files (268.85 s); `check2.log` |
| `bun run check`, final (after Task 8's change) | 5.7 → 9.1 | **passed**: 757 pass, 4 existing reference-dependent skips, 0 fail, 761 tests across 97 files (332.09 s); `check3.log`. The VM was busy again, and the warm switch maxima were agent-home 8.90 ms and two-surface blur up to 10.6 ms, still below 16.67 ms. |
| `bun run bench`, second | 2.9 | passed (`bench2.log`) |
| `bun run bench`, third | 2.5 | passed (`bench3.log`) |

The two failures happened only under the VM's load and passed unchanged on the same
code once it was gone, with no threshold, test or code change in between except the
colour-authority test. They are the already recorded load-sensitive variance in the
existing P1 entry, not a pass-by-retry waiver: both misses are reported above, and the
backlog entry gets these numbers.

Final-tree numbers (second and third `bun run bench`):

| Workload | Validation (µs/node) | Render (µs/node) | Render (ms/tree) |
| --- | --- | --- | --- |
| agent-home | 1.288 / 1.363 | 1.874 / 1.967 | 1.2725 / 1.3353 |
| core-queue.small | 1.147 / 1.151 | 2.179 / 2.188 | 0.0109 / 0.0109 |
| core-queue.medium | 1.225 / 1.259 | 1.966 / 1.970 | 0.8140 / 0.8155 |
| core-queue.large | 1.346 / 1.410 | 2.019 / 2.400 | 0.9006 / 1.0703 |
| core-queue.full | 1.387 / 1.415 | 2.183 / 2.280 | 1.0325 / 1.0783 |
| git-status | 0.904 / 0.921 | 1.761 / 1.756 | 0.2554 / 0.2545 |
| rack-module | 0.888 / 0.924 | 1.499 / 1.707 | 0.3538 / 0.4030 |
| synthetic-queue | 1.168 / 1.256 | 1.687 / 1.794 | 0.5954 / 0.6331 |

Every standalone validator fixture is ≤ 1.5 µs/node, every render fixture ≤ 3 µs/node,
and the required trees ≤ 2 ms. Render's separate validation diagnostic exceeds the
reserved 1.5 µs/node on medium, large and full (1.519–1.787); it is the same
non-in-render subtraction recorded under plan 015 F1, not a gate.

CSS (second / third run): declarations 0.397 / 0.430 µs/node (0.269 / 0.292 ms per
679-node tree); base 0.470 / 0.553 ms, 1,072 bytes; Certified theme 0.961 / 1.058 ms,
7,010 bytes; Certified system 8.792 / 8.939 ms, 146,938 bytes; Rack theme 1.020 /
0.960 ms, 8,257 bytes; Rack system 12.406 / 12.309 ms, 155,922 bytes.

Against the pre-plan baseline (Task 2's pre-change run): Certified 11.476 ms / 143,977
bytes → 8.8–8.9 ms / 146,938 bytes; Rack 17.244 ms / 149,721 bytes → 12.3–12.4 ms /
155,922 bytes. Generation is faster, from reusing the validated preparation; sheets
grew 2,961 and 6,201 bytes from the alpha mixes, reduced-transparency rules, native
parts and the tab count slot (eight more recipes per system), offset in themes by the
removed alpha roles (Rack theme 9,128 → 8,257 bytes).

Warm switching, from the first passing `check` run: two-surface blur switch maximum 8.0 ms
(956 nodes), agent-home CSS switch 6.5 ms, git-status 3.0 ms, all below 16.67 ms. The
failing first run measured 20.20 ms for agent-home under load 7.7+.

Install timing (Task 4): Certified 0.453 ms and Rack 0.357 ms per `validateTheme` with
six pairs.

Parity: `bun proof/scripts/parity.ts` was last run in Task 6, the final task to change
library or proof output (this task changed one test). Certified pixel ratios against
the approved artifact are 0.695014% / 0.716705% / 0.913460% at 1440 / 1024 / 390 px,
down from 0.721691% / 0.754942% / 0.966723%; the aggregate flag stays `false` for the
historical DOM and style gaps. Rack has no approved artifact. Task 3's both-system
migration comparison showed 0% changed pixels across 18 captures. Native
Windows/assistive-technology auditing was not run and remains G29.
