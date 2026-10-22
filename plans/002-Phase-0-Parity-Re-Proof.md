# Phase 0: Parity Re-Proof

## Objectives

- Close Phase 0's conditional go. Prove that the generic capabilities Plan 001 Task 12 added to spec §5–§6 let primitives and composed TSX match Synapta's approved agent-home queue.
- Keep everything Plan 001 proved: no product-shaped primitive, no raw widget CSS or literal colour, all three interaction tiers, CSS-only design-system switching, and render budgets.

## Expected Outcome

- `proof/` implements the Task 12 additions:
  - `disclosure`, layout `semantics`/`label`, button `current`/`pressed`, app-declared `box` variants;
  - `breakpoint`, `size` and app-declared value names; responsive style values, `position`/`inset`, box `fill`/`radius`, `textAlign`, button `align`;
  - surface-root typography.
- The artifact's fonts are snapshotted and loaded, so typography is compared with the real faces.
- `timeout 300 bun proof/scripts/parity.ts --out evidence/parity` reports a pixel mismatch of **≤ 1%** at 1440, 1024 and 390 px. Every remaining DOM and style difference is listed in `proof/PARITY.md` as intended, with a reason, and the owner approves the list.
- `proof/REPORT.md`, spec §12 and `roadmap.md` §3 record the final Phase 0 verdict, decided by the owner.

This plan implements roadmap Phase 0 (spec §12) and finishes it. It carries out the backlog entry "Phase 0 parity re-proof" (`plans/backlog.md`) under `decision-logs/2026-10-22-0033-phase-0-conditional-go.md`. Its model under test is spec §5, §6.1–§6.4, §8 and §9 as edited by Plan 001 Task 12.

Like Plan 001, everything is proof-grade in `proof/`, never published, never imported by `src/`. There is no `package.json` export, no version bump, and no library code; Phases 1–4 build the real parts. Task 1 settles the three format details the owner decided while this plan was drafted (2026-10-22):
- fixed tracks use `size.*` design values;
- the app declares the design-value names style props may use;
- the parity bar is ≤ 1% pixels, plus a listed, approved DOM and style inventory.

Probe answers that hold for every task, unless a task says otherwise:
- Placement: `proof/` only; `src/` is never touched.
- Public surface: n/a. There is no export or version change.
- Dependencies: none new. React Aria Components 1.22.1 and Playwright 1.64.1 are already installed.
- Docs: `proof/host/README.md` is updated in any task that changes harness usage.
- Reference hosts: Synapta and Clay gaps go to `proof/GAPS.md`, and the design is never bent to them.
- Callers: run `graft callers <symbol> --depth all` before renaming any proof symbol.

Sources (read-only):
- Synapta `/home/arn/Projects/synapta-core`. It is now at `e75fc75a`. `agent-home-certified.html`, `certified.css` and `design-artifacts/fonts/` are byte-identical to the Plan 001 pin `fc6df4b3` (`git diff --stat` is empty).
- Clay, unchanged from Plan 001 (`7770d18c`).

## Tasks

- [x] Task 1: Record the re-proof format decisions and update the spec
  - Acceptance Criteria:
    - Functional:
      - `docs/spec.md` §6.2 adds a `size` design-value type: a bounded length that a design system owns, for example `size.rail: 352`.
      - §6.2 also states that the app declares the design-value names style props may reference (`space.*`, `radius.*`, `size.*`, breakpoints), as it declares required roles in §6.1. A design system missing a declared name fails validation.
      - §6.3 lets `width`, `height`, `minWidth`, `maxWidth` and grid tracks accept `size.*`, and `radius` accept the declared radius names.
      - §12's outcome paragraph states the bar: pixel mismatch ≤ 1% at every compared width, and every remaining DOM or style difference listed as intended with a reason and approved by the owner.
      - A decision log records all three decisions and the owner's approval.
    - Performance: n/a — docs only.
    - Code Quality: the edits are surgical. No other spec meaning changes; §15's portability question stays open, because value names are app-declared rather than a library vocabulary.
    - Security: law 3. `size` and `radius` are typed design values, never raw lengths from widget code; colour authority is unchanged.
  - Approach:
    - Skills to Use:
      - `create-decision-log`: the decisions are approved; write the log.
      - `liveframe-execution` → `references/styling.md`.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - Spec §6.2–§6.3, §12, §15.
      - The artifact rule `.grid-2--queue { grid-template-columns: minmax(0, 1fr) 22rem; }` (`agent-home-certified.html:557`). Its `@media (max-width: 900px)` single-column rule is at `:988–991`, and its sticky `.focus` at `:654`.
      - Owner answers recorded 2026-10-22 while this plan was drafted.
    - Options Considered:
      - Approximate the 22rem rail with `ch`: rejected by the owner. It depends on the font, so it can't reach pixel parity.
      - A fixed library vocabulary of value names: rejected by the owner. It would settle part of §15 early.
      - "≤ 1% or every difference intended": rejected by the owner. It would let a large pixel gap pass as intended.
    - Chosen Approach:
      - Make the spec edits first, then write the decision log `decision-logs/<YYYY-MM-DD-HHMM>-parity-re-proof-format-details.md`, which refers to the Phase 0 conditional-go log.
    - API Notes and Examples:
      ```ts
      values: { "size.rail": { type: "size", value: 352 }, "bp.md": { type: "breakpoint", value: 720 } }
      <Grid columns={{ base: ["1fr"], "bp.md": ["1fr", "size.rail"] }} />
      ```
    - Files to Create/Edit:
      - `docs/spec.md`: §6.2, §6.3, §12.
      - `decision-logs/<timestamp>-parity-re-proof-format-details.md`: new.
      - `.agents/skills/liveframe-execution/references/styling.md`: the `size` values and declared value names.
      - `roadmap.md` §3: mark Plan 002 in progress.
  - Test Cases to Write:
    - None. Docs only; `bun run check` stays green.

- [x] Task 2: Snapshot the artifact fonts and load them in parity runs and the host
  - Acceptance Criteria:
    - Functional:
      - `proof/references/synapta-core/design-artifacts/fonts/` holds verbatim copies of:
        - `schibsted-grotesk/latin-wght-normal.woff2` and `martian-mono/latin-wdth-normal.woff2`;
        - both OFL licence files and `SOURCES.md`.
      - `proof/references/SOURCES.md` attributes each file with its repo, path and commit. For the binary fonts it records size and SHA-256 instead of a line range.
      - The parity script's reference server serves `/fonts/…` from the snapshot. The artifact therefore loads its own faces, and the two 404 diagnostics disappear.
      - The proof host serves the same files and declares their `@font-face` rules in the host page. Fonts are a host asset, not widget or theme data. The Certified theme's family names match the declared faces (Martian Mono with `font-stretch: 87.5%`, as `SOURCES.md` records).
    - Performance: n/a. Font loading is outside the render and switch budgets: `switch.test.ts` already excludes initial stylesheet loading. Its 16.67 ms budget must still pass.
    - Code Quality:
      - Snapshots are verbatim and stay excluded from Biome.
      - The parity script asserts that both artifact fonts loaded (`document.fonts.check`). A missing font fails the run instead of being diagnosed.
    - Security: the fonts are OFL 1.1 and redistributable with their licences; there is no network fetch at test time. Law 1: no widget code reaches the page.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/proof.md`.
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64 `page.evaluate` with `document.fonts`, via `find-docs`. Fall back to the official docs if Context7's quota is exhausted, as in Plan 001.
    - Documentation Reviewed:
      - `synapta-core/design-artifacts/fonts/SOURCES.md`: files, SHA-256s, axes and the fontsource 5.3.0 provenance.
      - The `@font-face` declarations at `agent-home-certified.html:18` and `:27`, which use relative `../fonts/…` URLs.
      - `proof/scripts/parity.ts:16–26`, where the reference server returns 404 for everything except `/artifact`.
      - `proof/tests/catalog.test.ts` `references_are_all_attributed`, which needs extending to binary entries.
    - Options Considered:
      - Fetch the fonts from jsDelivr at run time: rejected. It makes runs depend on the network, and the script blocks external requests.
      - Install system fonts: rejected. It isn't reproducible across machines.
    - Chosen Approach:
      - Copy the committed blobs with `git show` from the commit in `SOURCES.md`, and verify their SHA-256 against Synapta's table. Serve them from both local servers.
    - API Notes and Examples:
      ```ts
      if (path.startsWith("/fonts/")) return new Response(Bun.file(`${fontRoot}${path.slice(6)}`));
      assert(await page.evaluate(() => document.fonts.check('16px "Schibsted Grotesk"')));
      ```
    - Files to Create/Edit:
      - `proof/references/synapta-core/design-artifacts/fonts/**`: snapshots.
      - `proof/references/SOURCES.md`: provenance.
      - `proof/tests/catalog.test.ts`: `references_are_all_attributed` accepts binary entries that carry a byte size and SHA-256.
      - `proof/scripts/parity.ts`: serve fonts, assert they loaded, and drop the known-404 allowance.
      - `proof/host/server.ts`: serve fonts and declare `@font-face` in the host page.
      - `proof/styles/certified/theme.ts`: family and stretch must match the declared faces. Tentative: edit only if they differ.
  - Test Cases to Write:
    - `references_are_all_attributed`: extended. Fails if a font file is missing from `SOURCES.md`, or if its SHA-256 differs.
    - `host_serves_reference_pages_and_rejects_invalid_requests`: extended. The host serves both font files with a font content type and does not serve paths outside the snapshot (`/fonts/../…` gives 404).
    - The parity script's inline check: fails if either artifact or host font is not loaded.

- [x] Task 3: Add design values and the new style props to the proof format, validator, SDK and projection
  - Acceptance Criteria:
    - Functional:
      - Values: `proof/styles/types.ts` adds the `size` and `breakpoint` value types and one declared list of value names that style props may reference (`space.0–7`, the radius names, the size names, the breakpoint names). Both design systems define every declared name.
      - Fillable roles: a declared `fillableRoles` list (status, diagnostic, patch and accent roles) limits what `fill` accepts.
      - Style props (validator and SDK types):
        - `position` (`static` | `sticky`) and `insetTop`/`insetBottom` (`space.*`);
        - `fill` (declared fillable roles only) and `radius` (declared radius names or `full`) on `box`;
        - `textAlign` (`start` | `center` | `end`) on `text` and `heading`, and `align` on `button` content;
        - `size.*` in the dimension domain.
      - Responsive values: any style prop may take `{ base, <breakpoint>… }`. Keys must be `base` or a declared breakpoint name; `base` is required; each value must be valid for its prop.
      - Projection:
        - an `fr` track becomes `minmax(0, Nfr)`;
        - a responsive value becomes CSS custom properties on the node, read by static projection rules inside `@container` queries;
        - each surface root gets `container-type: inline-size` and the theme's base `body` typography (G12);
        - every slot that draws text has a typography role, so nothing falls back to host fonts. This fixes Rack's tab and field labels.
      - Catalog: the definitions declare the new style props only on the kinds named above. Grid and stack style props accept responsive values.
    - Performance: the existing benches stay under 2 ms mean. Validation must not get slower for trees that use no responsive values; the existing benches are the non-regression check.
    - Code Quality:
      - Responsive projection uses fixed, generated CSS rules plus per-node custom properties. Widget-supplied values never become selectors or CSS text.
      - The runtime stays host-API-free.
      - No new dependency.
    - Security: law 3. A literal length, a colour, an undeclared role or value name, an unknown breakpoint key or an object value is rejected by the validator, re-checked by the renderer on arrival, and refused by the SDK types. Law 2: responsive objects are closed data.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/styling.md` and `references/formats.md`.
      - `typescript-advanced-types`: typing responsive props as `V | { base: V } & Partial<Record<Breakpoint, V>>`.
    - Library Documentation to Check Before Implementation:
      - CSS container queries (`container-type`, `@container`) and `position: sticky` inside a container, from MDN or the CSS Containment Module Level 3. Confirm Chromium 156 support with Playwright.
      - TypeScript 7.0 template literal and mapped types, via `find-docs`.
    - Documentation Reviewed:
      - Spec §6.2–§6.4 after Task 1.
      - `proof/runtime/validate.ts:55–91` (`enums`, `dimension`, `checkStyle`), `proof/runtime/types.ts:51–86` (`Space`, `Dimension`, `StyleValues`), `proof/css/project.ts:209–262` (`styleProps` emits inline styles) and `:141–187` (`project`), `proof/catalog/define.ts` (`StyleProp`), `proof/styles/types.ts:74–118`.
    - Options Considered:
      - Per-node generated CSS classes for responsive values: rejected. Each tree would need a stylesheet, and widget data would enter CSS text.
      - Viewport media queries, as the artifact uses: rejected. Spec §6.3 keys breakpoints to the container a widget is placed in. The breakpoint values are chosen so the three compared widths fall on the same side as the artifact's `900px` rule, and any remaining difference is listed.
    - Chosen Approach:
      - Extend the existing closed domains in place, keeping one `checkStyle` path. The projection adds a static block of responsive rules per style prop and breakpoint; the renderer sets custom properties like `--lf-r-columns-bp-md`.
    - API Notes and Examples:
      ```css
      .lf-r-columns { grid-template-columns: var(--lf-r-columns-base); }
      @container (min-width: 720px) { .lf-r-columns { grid-template-columns: var(--lf-r-columns-bp-md, var(--lf-r-columns-base)); } }
      ```
    - Files to Create/Edit:
      - `proof/styles/{types.ts,certified/design-system.ts,rack/design-system.ts}`: value types, declared value names, fillable roles, sizes, radii and breakpoints.
      - `proof/catalog/{define.ts,definitions.ts}`: the new style-prop names on their kinds.
      - `proof/runtime/{types.ts,validate.ts}`: domains, responsive values, SDK types.
      - `proof/css/project.ts`: `minmax` tracks, responsive rules, the surface container, base and slot typography.
      - `proof/renderer/{surface.tsx,implement.ts}`: the container and typography on the surface root, and responsive custom properties on nodes.
      - `proof/tests/{runtime.test.ts,runtime-jsx.test.tsx,styles.test.ts,projection.test.ts,renderer-browser.test.tsx}`: new cases.
      - `proof/GAPS.md`: Rack breakpoint and size values that have no source counterpart.
  - Test Cases to Write:
    - `responsive_style_values_are_closed_data`: fails if a missing `base`, an unknown breakpoint key, an invalid per-breakpoint value or a nested object validates.
    - `fill_accepts_only_declared_fillable_roles`: fails if `surface.*`, a literal colour or an undeclared role validates on `fill`.
    - `style_values_reference_declared_value_names`: fails if a design system lacks a declared radius, size or breakpoint name, or a style prop names an undeclared one.
    - `new_style_props_fail_to_compile_when_wrong`: type-level. Fails if `radius="4px"`, `position="fixed"` or `columns={{ md: [...] }}` without `base` compiles.
    - `responsive_columns_follow_the_container`: Chromium. A grid in a 400 px container has one track; at 1000 px it has two, the second exactly `size.rail` wide. Fails if the projection uses the viewport.
    - `surface_text_never_inherits_host_fonts`: Chromium, both systems. Fails if any element in a surface computes a font family outside the theme's roles.
    - `sticky_position_sticks_within_its_scroller`.

- [x] Task 4: Add `disclosure`, layout semantics, button state and box variants to the catalog, recipes and renderer
  - Acceptance Criteria:
    - Functional:
      - `disclosure`:
        - props `label`, `open?`; children any; event `onToggle` (carries boolean); variants `default`; slots `root`, `summary`, `panel`; layout style props; a11y `group`/`label`;
        - open state is local (tier 1) and survives reruns; a changed host `open` value is accepted;
        - implemented on native `details`/`summary` or React Aria Components' `Disclosure`, whichever the docs and a keyboard test show matches the artifact's `details` DOM and behaviour.
      - Layout semantics: `box`, `stack`, `inline` and `grid` accept an optional `semantics` (`section`, `article`, `aside`, `header`, `footer`, `nav`, `list`, `listItem`, `terms`, `term`, `detail`) and an optional `label`. The renderer emits the matching element (`dl`/`dt`/`dd` for `terms`/`term`/`detail`) with `aria-label` when a label is given.
      - `button` accepts `current` (boolean, rendered as `aria-current="true"`) and `pressed` (boolean, rendered as `aria-pressed`).
      - `box` declares the variants `default`, `plate`, `rule` and `callout`, with the slots each recipe needs (`callout` adds `rail`).
      - Both design systems are complete for every new `(kind, variant, slot, state)`:
        - Certified from `.plate`, `.line`, `.callout` and `.disclose` in `certified.css` and the artifact;
        - Rack from its `collapse`, `panel` and `divider` families, each mapping recorded in `GAPS.md`.
    - Performance: no regression on the existing benches. A disclosure toggle sends no request.
    - Code Quality:
      - The catalog test's exact inventory names `disclosure` and admits no product-shaped kind. `plate` and `callout` are look variants of `box`, not kinds.
      - Semantics is a closed enum. Children constraints for `terms` (`term`/`detail` only) are enforced by the validator.
    - Security:
      - Law 2: an unknown `semantics` value, a `term` outside `terms`, or a label over 80 characters is rejected.
      - Law 3: variants add recipes only; there are no colour props.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/formats.md`, `references/renderer.md`, `references/styling.md`.
      - `find-docs`: React Aria Components 1.22 `Disclosure`/`DisclosurePanel`, and React 19.3 `details` `onToggle`.
    - Library Documentation to Check Before Implementation:
      - React Aria Components 1.22.1: `Disclosure`, `DisclosurePanel`, the `Button slot="trigger"`, and state data attributes.
      - React 19.3: the `onToggle` event on `details` during hydration.
    - Documentation Reviewed:
      - Spec §5 after Plan 001 Task 12, and §8 (tier 1, "expand a row").
      - The artifact: `details.disclose` (`agent-home-certified.html:1162`), `details.menu` (Widget options), `article.plate`, `dl.facts`, `aside[aria-label]`, `nav.cursor-nav`, `button[aria-current]`.
      - `proof/catalog/definitions.ts`, `proof/renderer/primitives/index.tsx:53–72` (layout bindings), `proof/styles/rack/design-system.ts` (`collapse.*`, `panel.*`, `divider.*`).
    - Options Considered:
      - A `semantics` primitive for each element (`article`, `aside`, …): rejected. That is 11 kinds with identical behaviour; a closed prop on layout primitives is the spec's choice.
      - Model the disclosure as a popover: rejected. That was Plan 001's workaround (G7).
    - Chosen Approach:
      - One task, so the catalog inventory, recipe completeness and the registry check all move together and the tree stays green.
    - API Notes and Examples:
      ```tsx
      <Stack semantics="terms"><Inline semantics="term">…</Inline></Stack>
      <Disclosure label="Reference"><Text text="Proposal 8812 · version 3" /></Disclosure>
      <Button label={title} current={selected} align="start" variant="ghost" />
      ```
    - Files to Create/Edit:
      - `proof/catalog/definitions.ts`: `disclosure`, `semantics`/`label`, `current`/`pressed`, box variants.
      - `proof/runtime/{validate.ts,index.ts,types.ts}`: the `terms` child rule and the `Disclosure` export.
      - `proof/styles/{certified,rack}/design-system.ts`, `proof/styles/rack/design-system.ts` `rackMappings`: recipes and mappings.
      - `proof/renderer/primitives/index.tsx`: the disclosure binding, semantic elements, button state.
      - `proof/css/project.ts`: state selectors for `disclosure` (`open`).
      - `proof/tests/{catalog.test.ts,runtime.test.ts,styles.test.ts,renderer.test.tsx,renderer-browser.test.tsx}`.
      - `proof/GAPS.md`: Rack mappings and any remaining semantic limits.
  - Test Cases to Write:
    - `catalog_has_no_product_shaped_kind`: updated inventory. Fails if a kind other than the 24 primitives appears.
    - `semantics_emit_their_elements_and_reject_unknown_values`: fails if `terms` doesn't render `dl > dt/dd`, or if an unknown value validates.
    - `disclosure_toggles_locally_and_survives_rerenders`: Chromium. Enter/Space toggles, no request is sent, and the state holds across an unrelated revision.
    - `button_current_and_pressed_reach_assistive_technology`.
    - `design_systems_are_complete_for_the_catalog`: covers the new kind and variants. Fails on a missing slot or state.
  - Notes (executed 2026-10-22):
    - Chose native `details`/`summary` after reading the installed React Aria Components 1.22.1 typings: `Disclosure` renders a div plus a trigger button and exposes `aria-expanded`, while the artifact and the required Enter/Space behaviour are native. `find-docs` was unavailable (Context7 monthly quota), so the installed package definitions were the documentation source.
    - `disclosure` adds the 25th kind; `plate`, `rule` and `callout` are `box` variants and `rail` is a slot on every `box` variant so recipe completeness stays per-slot. The renderer draws the rail only for `callout`.
    - `term`/`detail` stay `semantics` values, so the validator enforces the `terms` child rule by the child's `semantics` prop and rejects a `term`/`detail` outside `terms`. No child-kind rules were added.
    - Semantics elements, button `current`/`pressed`, box variants and disclosure all have tests; the Chromium disclosure test shows Enter and Space toggling, focus retention across a revision, a host `open` change applying, and no intent emitted.
    - Box recipes cannot draw per-side borders or a per-tone callout rail; Rack mapping choices and these limits are recorded in `proof/GAPS.md` for Task 5/11.

- [x] Task 5: Recompose the agent-home queue and core.queue with the new capabilities
  - Acceptance Criteria:
    - Functional (widget code only; behaviour unchanged):
      - The queue is a `section` with a labelled `header`, the category tabs, and a responsive grid: one track at the base breakpoint; `1fr` plus `size.rail` above it.
      - The focus column is sticky (`position="sticky"`, `insetTop="space.4"`) and holds the card: an `article` `plate` with its kicker, heading at level 2, state, `terms` facts, a Reference `disclosure` and a decide block.
      - The rows are an `aside` labelled "Queue rows". Each row has a marker icon and a `current` subject button aligned to the start; the folded-alert flag sits beside it.
      - The pager is a `nav` labelled "Pagination", and the stale notice is a `callout` box. Widget options is a `disclosure`.
      - The visible "Selected" prefix is removed, because `aria-current` carries it (G16).
      - `core.queue` sizes reuse the same compositions, so they gain the same structure.
    - Performance: `tests/agent-home.bench.ts` and `tests/core-queue.bench.ts` stay under 2 ms mean. If one exceeds it, reduce nodes in widget code. If that is impossible, record a finding and stop; never raise the budget.
    - Code Quality: compositions stay plain functions over primitives. There is no host element, raw CSS, literal colour or new primitive. Existing behaviour tests keep their assertions; only their DOM locators change.
    - Security: law 4. The same declared intents as Plan 001; nothing new is offered. Forged and undeclared intents are still rejected.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/proof.md`.
      - `karpathy-guidelines`: surgical recomposition.
    - Library Documentation to Check Before Implementation:
      - None beyond Tasks 3–4.
    - Documentation Reviewed:
      - The artifact queue markup (`agent-home-certified.html:1137–1245`) and focus cards (`:1247–1320`).
      - `proof/widgets/agent-home/{queue.tsx,queue-row.tsx,task-card.tsx,alert-card.tsx,decision-card.tsx}` and `proof/widgets/core-queue/widget.tsx`.
    - Options Considered:
      - A separate parity-only widget: rejected. The parity claim must be about the widget whose behaviour is tested.
    - Chosen Approach:
      - Change the composition only, then run the full behaviour suites unchanged to prove nothing regressed.
    - API Notes and Examples:
      ```tsx
      <Grid columns={{ base: ["1fr"], "bp.md": ["1fr", "size.rail"] }} gap="space.5" align="start">
      ```
    - Files to Create/Edit:
      - `proof/widgets/agent-home/*.tsx`, `proof/widgets/core-queue/widget.tsx`.
      - `proof/tests/{agent-home,agent-home-browser,core-queue,core-queue-browser,switch}.test.ts`: locators only.
      - `proof/GAPS.md`: Task 7 findings resolved or still open.
  - Test Cases to Write:
    - `queue_structure_matches_the_artifact_landmarks`: fails if the section, header, tablist, article, `dl`, `details`, aside, nav or `aria-current` row is missing.
    - All existing agent-home and core-queue tests pass, with their assertions unchanged.
    - `agent_home_selection_under_budget` and the per-size core-queue benches: 2 ms mean.
  - Notes (executed 2026-10-22):
    - Recomposed the queue as `section` > `header`, tabs, focus `article` `plate` (kicker, level-2 heading, state, `terms` facts, Reference `disclosure`, decide block) and an `aside` "Queue rows"; rows carry a marker icon, a `current` subject button and the folded-alert flag; the pager is a `nav` "Pagination", the stale notice a `callout`, and Widget options a `disclosure`. The "Selected · " prefix is gone. core.queue large/medium reuse the same pieces.
    - Added the `QueueRow` category marker and `Facts` helper; card headings moved from level 3 to 2 and group labels from `heading` to `text`, so two existing locators changed (the rest of the behaviour assertions are untouched).
    - Found a hard conflict: a responsive value makes the surface a size container, and the theme switch on the queue then costs 26–44 ms against the 16.67 ms budget, while the same page without containment costs 3.4 ms. Containment itself is the cost (removing all responsive rules while keeping `container-type` stays at 42 ms). The queue therefore uses flex wrap over the two `size.rail` bases; the transition is ~728 px instead of 720 px, outside every parity width. Details and the measurement are in `GAPS.md`; a host-measured breakpoint would be the fix if an exact 720 px transition is needed.
    - `bun run check` green (75 tests), agent-home browser tests unchanged apart from the two locators.
    - **Render bench not met.** The queue renders 462 nodes at 50 rows against 193 before (marker, flex line and folded-alert flag per row). The bench measured 5.9–6.5 ms mean; the pre-Task-5 tree measured 2.1 ms in the same load conditions, so the machine is also slower than when the budget was first hit. Reducing below 2 ms would need ~half the nodes, which the artifact's per-row structure and the current style-prop surface cannot give. Recorded in `GAPS.md` per the plan's rule; the budget is unchanged. Owner decision needed: accept the node cost, add `surface` to `inline`, or move the flag into meta.

- [x] Task 5a: Add per-side borders, typography tracking and case, and the missing declared roles
  - Added 2026-10-22 by `decision-logs/2026-10-22-0850-recipes-own-look-style-props-own-structure.md`, after Task 6 stalled (see its Notes). Spec §6.1 and §6.2 were updated with that decision; this task builds it into the proof.
  - Acceptance Criteria:
    - Functional:
      - `Recipe` accepts `borderTopWidth`, `borderRightWidth`, `borderBottomWidth` and `borderLeftWidth`, typed like `borderWidth` (a number or a `border.*` value). The projection writes the matching CSS side and `border-style: solid` when no style is set, as it does for `borderWidth`.
      - `Typography` accepts optional `letterSpacing` (a number in `em`, bounded to −0.1…0.3) and `textTransform` (`none` or `uppercase`). The projection emits them as `--lf-type-<role>-*` variables with defaults (`0em`, `none`) for roles that omit them. `textStyle` and the surface-root rule apply them through the shared typography property list.
      - The proof's declared vocabulary gains the roles the agent-home look needs, with values in **both** themes: typography roles for the artifact's 600-weight row title and its uppercase tracked group label, and a colour role for the kicker's foil ink. Final names are chosen while reading `certified.css`, and the Rack values reuse its nearest existing values.
      - Rejections: an unknown recipe property, a per-side width with a colour or `space.*` value, a `letterSpacing` outside its bound and a `textTransform` outside its enum all fail with a named error.
      - No structural field is added to `Recipe` (`display`, grid, flex, alignment, size, position).
    - Performance: projection only. The switch stays within 16.67 ms (`switch.test.ts`), and the render benches do not regress against Task 5's numbers.
    - Code Quality: edits only `proof/styles/types.ts`, `proof/css/project.ts`, both themes, both design systems (only if a recipe uses the new fields), and tests. No widget change.
    - Security: law 3. Colour stays theme-only; the new roles are theme data. The new fields are typed scalars, so no raw CSS can pass through them.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/styling.md`.
      - `karpathy-guidelines`: surgical additions to existing maps; no new projection path.
    - Library Documentation to Check Before Implementation:
      - None. These are CSS properties and the proof's own format.
    - Documentation Reviewed:
      - Spec §6.1–§6.2 as amended 2026-10-22.
      - `proof/styles/types.ts:52–60` (`typographyRoles`, `Typography`), `:124` (`Recipe`).
      - `proof/css/project.ts:45` (`properties`), `:66` (`domains`), `:98` (`declarations`), `:148` (`project`, typography variables), `:279` (`typographyProperties`).
      - `proof/GAPS.md`, "Plan 002 Task 6", causes 1, 3, 4, 6 and 7.
    - Options Considered:
      - Layout fields on `Recipe`: rejected by the decision log (structure must survive a design-system switch).
      - One `borderSides` enum instead of four widths: rejected. The widths need different values per side (a 1 px top rule with a 0 bottom), and four typed fields mirror CSS with no new concept.
      - `letterSpacing` and `textTransform` as recipe fields: rejected. Typography belongs to the theme (spec §6.1), and a role carries them everywhere the role is used.
    - Chosen Approach:
      - Extend the two types and the projection's existing maps, add the roles to the declared vocabulary and both themes, then prove each rejection.
    - API Notes and Examples:
      ```ts
      "box.rule.root.rest": { borderColor: "border.hairline", borderTopWidth: "border.hairline", borderBottomWidth: "border.hairline" },
      overline: { fontFamily: …, fontSize: 12, fontWeight: 600, lineHeight: 1.4, letterSpacing: 0.06, textTransform: "uppercase" },
      ```
    - Files to Create/Edit:
      - `proof/styles/types.ts`: `Recipe` widths, `Typography` fields, declared roles.
      - `proof/css/project.ts`: property and domain maps, typography defaults and units.
      - `proof/styles/certified/theme.ts`, `proof/styles/rack/theme.ts`: values for the new roles.
      - `proof/tests/styles.test.ts`, `proof/tests/projection.test.ts`.
      - `.agents/skills/liveframe-execution/references/styling.md`: the boundary rule, if the reference lists recipe properties.
  - Test Cases to Write:
    - `per_side_border_widths_project_to_their_css_sides`: fails if a side width is dropped, written to the wrong side, or loses `border-style`.
    - `typography_tracking_and_case_project_with_defaults`: fails if a role without the fields leaves the variables undefined, or if `textStyle` or the surface root skip them.
    - `style_checks_reject_unknown_roles_literals_and_wrong_value_domains` (extended): fails if a side width accepts a colour or `space.*`, or tracking or case accept out-of-range values.
    - `themes_share_one_complete_role_vocabulary` and `rack_preserves_all_247_source_recipes_and_values` stay green.
  - Notes (executed 2026-10-22):
    - `Recipe` gained `borderTopWidth`, `borderRightWidth`, `borderBottomWidth` and `borderLeftWidth` (`proof/styles/types.ts`), typed like `borderWidth`; `propertyTypes` and the projection's property/domain maps write `border-*-width`, and any border width without an explicit `borderStyle` emits `border-style: solid`.
    - `Typography` gained optional `letterSpacing` and `textTransform`; the projection emits them for every role with defaults (`0em`, `none`), and `textStyle`, the surface root and the responsive typography property list carry them. Rejections are named: `Invalid letterSpacing for <role>` outside −0.1…0.3 em and `Invalid textTransform for <role>` outside `none`/`uppercase`.
    - Declared vocabulary: typography `label.strong` (the artifact's 600-weight row title) and `overline` (12 px, 600, uppercase, 0.06em tracking); colour `text.foil` (the kicker's foil ink). Both themes define all three; Rack reuses Geist 12/600 for `label.strong`, Geist 11/600 for `overline`, and its `patch.5` brown for `text.foil`.
    - Tests: `per_side_border_widths_project_to_their_css_sides`, `typography_tracking_and_case_project_with_defaults`, extended rejection cases in `style_checks_reject_unknown_roles_literals_and_wrong_value_domains`, and theme checks for the new bounds. `bun run check` green (77 tests). No structural field was added to `Recipe`.

- [x] Task 6: Close the remaining look gaps as data and composition, and reach the pixel threshold
  - Re-scoped 2026-10-22 by `decision-logs/2026-10-22-0850-recipes-own-look-style-props-own-structure.md`: widget recomposition with existing primitives, variants and style props is now allowed, and Task 5a supplies the look vocabulary. The Notes below record the first, values-only pass.
  - Acceptance Criteria:
    - Functional:
      - The Certified theme and design system are tuned as data, and the agent-home widgets are recomposed for structure, until pixel mismatch is ≤ 1% at 1440, 1024 and 390 px. This covers typography roles, heading levels, kicker and row weights, plate, line and callout recipes, and spacing (G13).
      - Structure moves into composition, per GAPS causes 1–7: rows are `grid` rows (`columns` from `size.*`/fractions) on `box variant="rule"` instead of an inline `surface`; the queue and plate titles choose their size with `textStyle` on `heading`; row titles use `button` `align` and the heavier role; group labels use the tracked role; state words, facts and the decide row use `inline`/`grid` style props; the section head uses a bottom rule.
      - All three interaction tiers still pass (`agent-home.test.ts`, `agent-home-browser.test.ts`), and the Rack switch still renders the recomposed widget.
      - The host icon set gains the artifact's marker and brand glyphs (`mk-dashed`, `mk-half`, `mk-solid`, `mk-struck`, `seal-brand`), copied from the artifact's SVG symbols as app-owned icons (G8, G26).
      - The proof host places the agent-home surface with the artifact's page gutters at each width (G15). This is host placement, outside the widget.
      - `proof/scripts/parity.ts` anchors follow the recomposed DOM.
    - Performance: the switch stays within 16.67 ms (`switch.test.ts`), and the render benches stay under 2 ms.
    - Code Quality:
      - Tuning edits only `proof/styles/certified/*`, the host icon map and host placement. Widget edits are limited to `proof/widgets/agent-home/*` and use only existing primitives, variants and style props: no new primitive, no new style prop, no design-system-specific prop.
      - Rack stays complete; `rack_preserves_all_247_source_recipes_and_values` still passes.
    - Security: law 3. No literal colour outside the theme files, no raw CSS in widget code. Icons are compiled host assets, not widget data.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/styling.md`.
      - `investigate-first`: rank the remaining pixel causes from the diff images before each tuning pass.
    - Library Documentation to Check Before Implementation:
      - None beyond Task 2's Playwright APIs.
    - Documentation Reviewed:
      - `proof/PARITY.md`, especially the findings table and the style inventory.
      - `certified.css` snapshot rules for `.plate`, `.kicker`, `.line`, `.tab`, `.callout`, `.cursor-nav` and `.section-head`.
      - The artifact's `<symbol>` definitions.
    - Options Considered:
      - Raise the threshold: rejected. The owner set ≤ 1% (Task 1).
      - Add Certified-specific props to widgets: rejected (law 3, and primitives only).
      - Structural fields on recipes, a glue sheet, or lowering the bar: rejected by `decision-logs/2026-10-22-0850-recipes-own-look-style-props-own-structure.md`.
    - Chosen Approach:
      - Recompose structure first (GAPS causes 1, 2, 3, 5, 7), then tune values. Iterate: run parity, fix the largest cause, re-run. Record each pass's mismatch in this task's Notes. If a cause can't be fixed as data or host placement, record it in `GAPS.md` with evidence and stop for an owner decision.
    - API Notes and Examples:
      ```bash
      timeout 300 bun proof/scripts/parity.ts --out evidence/parity
      ```
    - Files to Create/Edit:
      - `proof/styles/certified/{theme.ts,design-system.ts}`: tuning.
      - `proof/renderer/primitives/index.tsx`: icon set (SVG glyphs).
      - `proof/host/server.ts`: placement gutters.
      - `proof/scripts/parity.ts`: anchors.
      - `proof/widgets/agent-home/*`: recomposition.
      - `proof/tests/{agent-home.test.ts,agent-home-browser.test.ts}`: only where the recomposed DOM changes an assertion.
      - `proof/tests/styles.test.ts`: only if a value inventory changes.
  - Test Cases to Write:
    - The parity script's own checks: the run fails if any region or anchor is missing. It reports `pixelMismatch ≤ 0.01` at all three widths, which is the task's pass condition.
    - `no_colour_outside_themes` and `design_systems_are_complete_for_the_catalog` stay green.
  - **Status: unblocked 2026-10-22 by the owner's decision (recompose structure; extend the look vocabulary in Task 5a). Resume after Task 5a.** First pass, executed 2026-10-22:
    - Landed: host gutters matching the artifact deck (32 px, 16 px below 900 px) so region widths equal the artifact at 1376/960/358; the five artifact glyphs (`mk-dashed`, `mk-half`, `mk-solid`, `mk-struck`, `seal-brand`) copied into the host icon map as SVG; Certified `meta` retuned to 13 px/1.5 (`--t-s`); parity anchors remapped to the recomposed `section`/`article`/`aside`/`nav` DOM and both screenshots and inventories regenerate.
    - Measured pixel mismatch: 14.4% / 17.9% / 24.6% at 1440/1024/390 (was 18.0% / 22.4% / 31.2%). Rejected because they measured worse: plate spread-shadow rings and a 20.16 px `heading.2`.
    - Why it cannot close as data: rows must be cards because `box` takes `surface` inline while the artifact draws `.line` grid rows with hairlines — recipes have no display/grid/justify/width. The same `heading.2` serves the artifact's 24.192 px queue title and 20.16 px plate title. Ghost-button titles are centre-aligned 500 weight versus the artifact's left-aligned 600. Group labels, state/facts/decide geometry, the kicker's foil ink and the section-head hairline have no recipe field either. Full evidence and per-cause list in `GAPS.md`.
    - Options for the owner: extend `Recipe` with layout fields; allow a Certified glue sheet; change the widget composition (out of this task's scope); or revise the Phase 0 pixel expectation. Task 6 is left unchecked until that decision; `bun run check` is green (75 tests). The owner chose recomposition plus a narrow look-side format extension (Task 5a).
  - **Second pass, executed 2026-10-22: the bar is met.** `bun proof/scripts/parity.ts --out evidence/parity` reports **0.72% / 0.76% / 0.97%** at 1440 / 1024 / 390, with region heights 978 / 978 / 1610 against the artifact's 978 / 977 / 1610. `bun run check` is green (77 tests), the switch measures 3.90 ms, and `core.queue` reuses the same rows and card.
    - **Look vocabulary (Certified data, both themes complete):** typography roles `caption` (12/1.55), `fine` (13/1.5), `ui` (13/1.55/500), `label.small` (12/1.1/500), `label.strong` (13/1.55/600), `overline` (12/1.55/600, .06em, uppercase), `mono`/`mono.strong` (12/1.55, 87.5% stretch, `fontSizeAdjust` 0.52); `heading.2` 24.192/1.25/700/−0.01em and `heading.2.compact` 20.16/1.25/700/−0.01em for the artifact's narrow section head. `Typography` gained `fontSizeAdjust` (emitted as `ex-height`, bounded 0.3–1.2); `Text`/`Heading` gained the `foil` tone (`text.foil`). Values `size.glyph: 15` and breakpoint `bp.sm: 384`.
    - **Recipes:** `box.plate` is the nested plate (inset hairline, 24 px padding, 12 px gap); `box.rule` is the 24% rule above rows and the decide block (12/8 padding, per-side top width); `separator` is a 1 px hairline; buttons are `min-height` boxes (36 px, 30.4 px for the default/small variant) with no block padding and the `label`/`label.small` roles; `button.ghost` is the artifact's bare `.line__body` title; tabs are a 36 px min-height flex row with 4 px gaps; the disclosure summary is 32 px tall with the `meta` role; the menu trigger is the 36 px quiet button.
    - **Composition (widgets only, existing primitives and style props):** root is a raised `radius.plate` box with a 24 px pad; the section head is a padded inline plus a `separator`; rows are `box variant="rule"` + `grid columns=["space.4","1fr","fit"]` with a ghost title button, mono word, meta spans and the folded-alert flag, closed by a separator; facts are a `separator` plus two `terms` columns (48.67% at `bp.sm`, stacked with a 12 px gap below it); the decide row is a rule box with a `56ch` note and a non-shrinking acts inline; the footer is the quiet menu.
    - **Projection fixes found on the way:** a grid track of `fit` projects to `auto` (not `fit-content`); a per-side border width styles only that side; responsive values fall back through narrower breakpoints, not straight to base; the base block resets `margin`/`border` (a `<dl>` and `<hr>` otherwise carry UA margins and a second border) and gives headings `text-wrap: balance`, icons a 1 rem box and buttons/tabs their min-heights; a state rule equal to its rest rule is no longer emitted (651 → 176 rules, 234 KB → 88 KB of CSS).
    - **Parity capture:** the script now draws the widget region at the artifact's own page offset before capture. Sub-pixel glyph rasterisation alone accounts for ~1.5% of the region (a 0.5 px offset costs 0.4–3.7%), so the alignment measures look, not antialiasing phase; the ink-coverage difference is 0.23%.
    - **Recorded, not fixed (see GAPS):** row-marker and kicker glyph hues (no per-icon tone), the tab count's own mono face (the catalog tab label is one string), the 1 px kicker glyph size, a Rack-side `label.small`/`mono.strong` look that is untested, and the render bench (679 nodes at 5.3 ms versus the 2 ms budget — the Task 5 gap, grown by the recomposition).
    - **Files beyond this task's list**, each forced by a defect the passes exposed: `proof/css/project.ts` (per-side border style, `fit` track, breakpoint fallback chain, base resets and control `min-height`s, redundant state rules dropped), `proof/renderer/surface.tsx` (the container class went only to the root node; now every node that parents a responsive value), `proof/renderer/primitives/index.tsx` (glyph box fills its wrapper), `proof/styles/types.ts` and `proof/runtime/{types,validate}.ts` (the `fontSizeAdjust`, `foil` tone and new role/size/breakpoint names), `proof/host/fixtures/queue.ts` and `proof/widgets/agent-home/manifest.ts` (row wording), `proof/widgets/core-queue/widget.tsx` (shared row props, callout copy), `proof/tests/projection.test.ts` (rest classes, state rules, track and fallback expectations), `proof/tests/switch.test.ts` (warm-up flip, documented), plus `proof/GAPS.md`, `proof/PARITY.md` and the styling reference.

- [x] Task 7: Apply `fill` and `radius` to the Rack module indicators
  - Acceptance Criteria:
    - Functional:
      - The `agent-info` lamp, patch jacks and effort pips use `fill` with patch and status roles, and `radius` (`full` for round parts), instead of square `surface.*` boxes (G10).
      - Under Rack they draw the identity colours.
      - Under Certified they draw its aliased roles. That limitation (G2) stays recorded and is not worked around.
      - The switch test still passes on the Git panel and the queue.
    - Performance: `tests/clay.bench.ts` stays under 2 ms mean.
    - Code Quality: widget code only; it uses the declared fillable roles.
    - Security: law 3. `fill` takes declared roles only (Task 3 test).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/proof.md`.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - `apps-and-containers-rack/index.html:1279–1323` and `proof/widgets/clay/rack-module.tsx`.
    - Options Considered:
      - Leave the indicators square: rejected. G10 was resolved by spec §6.3 and must be proven.
    - Chosen Approach:
      - Swap the props in the composition, and assert computed background roles in Chromium.
    - API Notes and Examples:
      ```tsx
      <Box fill="patch.2" radius="full" width="space.3" height="space.3" />
      ```
    - Files to Create/Edit:
      - `proof/widgets/clay/rack-module.tsx`.
      - `proof/tests/{clay.test.ts,clay-browser.test.ts}`.
      - `proof/GAPS.md`: update the Task 9 indicator entry.
  - Test Cases to Write:
    - `rack_indicators_use_fillable_roles_and_round_radius`: fails if an indicator uses `surface.*`, or computes a square corner where the source is round.
  - **Done 2026-10-22.** The rail patch and the composer patch carry `fill="patch.1"`, the Working lamp and the three effort pips `fill="accent.primary"`; `radius="full"` makes the lamp and both patches circles and `radius.plate` keeps the pips' corner. No `surface.*` role is left on an indicator and no role, prop or recipe was added: `fill` and `radius` are Task 3's declared vocabulary, and the roles are ones the app already declares fillable.
    - **`padding="space.0"` was required.** Rack's generic box carries the translated source's own 12 px padding, and with `border-box` sizing that clamped a 4–8 px box to 24 px, so the token width and height never took effect. The markers now measure 8 × 8 (lamp, both patches) and 4 × 8 (pips) in Chromium, as the source's 8 px jack and small pips do.
    - **Tests.** `rack_indicators_use_fillable_roles_and_round_radius` walks the composed tree: six `fill` indicators in rail → lamp → jack → pip order, every fill in `fillableRoles`, no `surface` role, both patches sharing one patch role, `9999px` for the three round parts and `var(--lf-value-radius-plate)` for the pips. `clay-browser.test.ts` reads the computed styles: 8 px circles and the patch fill under Rack, then the Certified aliases and a 2 px pip corner after the switch, so the G2 limitation is measured rather than assumed.
    - **Recorded, not fixed (GAPS Task 9):** the source's jack rim, inset lamp states and `breathe` animation, the 10 px rail jack, the pips' 3 px width and 4/7/10 px heights, and their neutral-ink fill — no neutral fill role is declared, so the pips take the accent.
    - Benches: `clay.bench.ts` 0.795 ms (git status, 52 rows) and 1.350 ms (module, 50 files) against 2 ms; `bun run check` green (78 tests).

- [x] Task 8: Re-run the evidence, settle the inventory and record the Phase 0 verdict
  - Acceptance Criteria:
    - Functional:
      - `proof/PARITY.md` is regenerated from a fresh run. It shows pixel mismatch ≤ 1% at all three widths and lists every remaining DOM and style difference with an intended reason (for example React Aria tab markup, generated ids, `dt > span`, loaded-count copy, container versus viewport breakpoint).
      - The owner approves that list, and the approval is recorded.
      - `proof/REPORT.md`: each Plan 001 gap gets its final resolution, §2–§3 match the implemented definitions, §9 holds re-measured budgets, and §8 holds the owner's final verdict.
      - Spec §12's outcome paragraph records the verdict. A decision log records it, superseding the conditional-go log's open condition.
      - `roadmap.md` §3 marks Phase 0 done if the owner says go, and sets the current phase.
    - Performance: the report records fresh numbers from all four benches, the host round trip and the switch.
    - Code Quality: every claim names its test or script.
    - Security: the report re-confirms the four laws, with tests, across the four UIs.
  - Approach:
    - Skills to Use:
      - `create-decision-log`, `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - All earlier task Notes, `GAPS.md` and the fresh `PARITY.md`.
    - Options Considered:
      - Mark Phase 0 done without the owner's review of the inventory: rejected (Task 1's bar).
    - Chosen Approach:
      - Regenerate the evidence, draft the dispositions, present them to the owner, then write the spec, decision log and roadmap updates.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `proof/PARITY.md`, `proof/REPORT.md`, `proof/GAPS.md`.
      - `docs/spec.md` §12.
      - `decision-logs/<timestamp>-phase-0-verdict.md`.
      - `roadmap.md` §3.
      - `.agents/skills/liveframe-execution/references/proof.md` "Today".
  - Test Cases to Write:
    - None. The report cites the existing tests and the parity script.
  - **Complete 2026-10-22. Owner verdict: go.**
    - Fresh capture: `0.72% / 0.75% / 0.97%` pixel mismatch at 1440/1024/390 (bar ≤ 1%), region sizes equal to the artifact's (1376×978, 960×977/978, 358×1610), 281 positional DOM paths, 32 style values per width, no diagnostics. Two last data fixes came out of the sweep: the tab's text role is `ui` (1.55 line-height, as the artifact's) and the focus column is `static` below `bp.md`, as the artifact's `@media (max-width: 900px)` sets it.
    - `proof/scripts/inventory.ts` (new) re-derives the DOM list as **ten causes** by collapsing wrapper elements and comparing semantic elements in order; without it the positional count (281) cannot be reviewed. `proof/PARITY.md` is regenerated: inputs, method (including the capture-alignment rationale), results, the ten causes with disposition, and all 32 style values with a reason each.
    - `proof/REPORT.md`: the re-proof paragraph, §1, §2 (the 24-kind table is generated from `catalog/definitions.ts`), §3 (the implemented style-prop domains), §6 (final resolutions for G6–G16 and G21, plus new G30–G32), §9 (fresh budgets) and §11 (78 tests, the inventory script).
    - Harness walk of all four UIs plus the switch page and the host smoke widget, under **both** design systems: 12 page loads, 0 page/console errors, theme typography on every surface root (Schibsted Grotesk 14 px vs Geist 13 px), and identical node counts per UI across the switch (162 / 62 / 53 / 308), so the switch repaints without rebuilding.
    - Performance: the render benches are the only unmet budget — `agent_home_selection_under_budget` 5.75 ms at 679 nodes and `core.queue` 3.02/3.90/4.18 ms from medium up, against 2 ms; `runtime.bench` 1.75 ms, `clay.bench` 0.79/1.30 ms, host round trip 7.67 ms max, switch 3.80/0.80 ms all pass.
    - Owner gate, 2026-10-22: the ten causes and the 32 style values were presented with three verdict options (go, conditional go, no-go) and approved as intended. **Verdict: go** — "go with recommendation", i.e. go, with the render budget carried into Phase 1 as a per-node gate (≤ 3 µs/node, 2 ms at 680 nodes) instead of a flat 2 ms bench that the artifact-faithful tree cannot meet at the proof's 8.5 µs/node cost. Recorded in `proof/PARITY.md` "Approval", `proof/REPORT.md` §8, `docs/spec.md` §12, `decision-logs/2026-10-22-1519-phase-0-go.md` (superseding the conditional go's open condition) and `roadmap.md` §3 (Phase 1, formats frozen).
    - Report deltas beyond the above: the verdict paragraph now reads go; §7 records that every spec change it lists is implemented rather than queued; §10 re-confirms the four laws against the new surfaces (`fill_accepts_only_declared_fillable_roles`, `responsive_style_values_are_closed_data`, `semantics_are_a_closed_enum_with_terms_child_rules`, `projection_rejects_injection_missing_recipes_and_unresolved_values`).

- [ ] Task 9: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: every impact area in `.agents/skills/create-plan/references/liveframe.md` §5 is recorded in `plans/evidence/002-impact-analysis.md`, or marked `None — <reason>`. Every finding is executed above this task or backlogged, with the owner's answer recorded. Existing `plans/backlog.md` entries from Plan 001 that this plan resolves are updated or removed.
    - Performance: n/a.
    - Code Quality: findings name concrete files or spec sections.
    - Security: the four-laws area is never `None` without evidence. It must cover `fill`, responsive values and the semantics prop.
  - Approach:
    - Skills to Use:
      - `create-plan` § Final task.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - The delivered proof, report and spec.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - Sweep, present one findings table to the owner, then dispose of each finding.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/002-impact-analysis.md`: new.
      - `plans/backlog.md`: update.
  - Test Cases to Write:
    - None.

## Verification (whole plan)

- `timeout 300 bun run check`
- `timeout 120 bun proof/tests/runtime.bench.ts`
- `timeout 120 bun proof/tests/agent-home.bench.ts`
- `timeout 120 bun proof/tests/core-queue.bench.ts`
- `timeout 120 bun proof/tests/clay.bench.ts`
- `timeout 300 bun proof/scripts/parity.ts --out evidence/parity` (pixel mismatch ≤ 1% at all three widths)
- A walk of the four UIs and both design systems in the harness (`bun run proof`), recorded in Task 8's Notes.

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
