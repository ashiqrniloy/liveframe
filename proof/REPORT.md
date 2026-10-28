# Phase 0 report: primitive-set proof

Plan 001 Task 12 wrote this report on 2026-10-22; Plan 002 Tasks 1–8 re-proved it (Task 9 is the impact analysis). Answers spec §12: can a small primitive set, plus recipes and style props, express real product UI with no product-shaped components?

**Verdict: go.** The re-proof closed Plan 001's condition: the model and its parity criterion both hold (§8). Four reference UIs are built from 24 generic candidates and composed TSX alone. No product-shaped primitive, raw CSS or literal colour was needed, all three interaction tiers work, one widget switches design systems with no code change, and the agent-home queue now matches the approved artifact to **0.72% / 0.75% / 0.97%** of pixels at 1440 / 1024 / 390 px against a ≤ 1% bar, with region heights equal to the artifact's. Plan 001's failures closed by adding **generic** capabilities — sectioning semantics, `disclosure`, responsive and sticky layout, decorated box variants, button content, declared indicator fills — never a product component. The one unmet budget is the render bench: the artifact-faithful composition costs 3–4× the nodes, so the 50-row selection rerender measures 5.75 ms against 2 ms (§9, `GAPS.md` "Plan 002 Task 6").

Owner decision (2026-10-22): **go**, with the render budget carried into Phase 1 as a per-node gate. See §8.

## 1. What was built

All proof code is in `proof/`, never imported by `src/`. Sources are pinned in `references/SOURCES.md` (Synapta `fc6df4b3`, Clay `7770d18c`).

| UI | Widget | Primitives used | Tests | Evidence |
| --- | --- | --- | --- | --- |
| 1. Synapta agent-home queue | `widgets/agent-home/` (`queue`, `TaskCard`, `AlertCard`, `DecisionCard`, `QueueRow`) | box, stack, inline, grid, text, heading, button, tabs/tab, textField, menu/menuItem, disclosure, separator | `tests/agent-home.test.ts`, `tests/agent-home-browser.test.ts` | `PARITY.md`, `scripts/parity.ts`, `scripts/inventory.ts` |
| 2. `core.queue` at four sizes | `widgets/core-queue/` (`widget`, `Metric`) reusing UI 1's compositions | as above | `tests/core-queue.test.ts`, `tests/core-queue-browser.test.ts` | — |
| 3a. Clay git status | `widgets/clay/git-status.tsx` | heading, stack, inline, text, icon | `tests/clay.test.ts` (`git_status_matches_builder_output_structure` against the pinned `buildGitStatusTree`) | — |
| 3b. Rack `agent-info` module | `widgets/clay/rack-module.tsx` | box, stack, inline, grid, text, heading, icon, button, tabs/tab, textField, separator | `tests/clay.test.ts`, `tests/clay-browser.test.ts` | — |
| 4. Design-system switch | UI 1 and 3a, unchanged | — | `tests/switch.test.ts`, `tests/renderer-browser.test.tsx` | — |

Supporting proof code: catalog `catalog/definitions.ts`; SDK `runtime/`; styles `styles/{certified,rack}/`; projection `css/project.ts`; renderer `renderer/`; host `host/` (`bun run proof`).

## 2. Final primitive list

**Twenty-four kinds, all generic.** Twenty-two were the proven floor; `disclosure` and the semantic props came from Plan 001's gaps. The definitions below are generated from `catalog/definitions.ts`, which is authoritative; `tests/catalog.test.ts` keeps the inventory exact. Every kind is plain data, closed, with no colour-typed, function, `className` or `style` prop.

`layout` (all kinds, not repeated below) means padding and margin (all sides and axes), width, height, minWidth, maxWidth, grow, shrink, basis, position (`static`/`sticky`), insetTop and insetBottom. `+ label/semantics` means the optional a11y label and the closed `semantics` enum on every kind.

| Kind | Props | Children | Events | Variants | Slots | Style props |
| --- | --- | --- | --- | --- | --- | --- |
| `box` | label/semantics | any | — | default, plate, rule, callout | root, rail | surface, fill, radius |
| `stack` | label/semantics | any | — | default | root | gap, direction, align, justify, wrap |
| `inline` | label/semantics | any | — | default | root | gap, direction, align, justify, wrap |
| `grid` | label/semantics | any | — | default | root | gap, align, justify, columns, rows, area |
| `scroll` | label, axis | any | — | default | root, viewport, scrollbar | — |
| `separator` | orientation | none | — | default | root | — |
| `text` | text | none | — | default | root | textStyle, tone, textAlign |
| `heading` | text, level 1–6 | none | — | default | root | textStyle, tone, textAlign |
| `icon` | name, label? | none | — | default | root | — |
| `image` | src, alt | none | — | default | root | — |
| `link` | label, href | none | — | default | root, label | — |
| `button` | label, icon?, disabled?, current?, pressed? | none | onPress | default, primary, danger, ghost | root, label, icon | align |
| `textField` | label, value, placeholder, multiline, disabled, readOnly, maxLength | none | onChange (commit), onSubmit | default | root, label, input | — |
| `select` | label, value, disabled, options ≤ 100 | none | onChange | default | root, label, trigger, list, option | — |
| `checkbox` | label, checked, disabled | none | onChange | default | root, label, indicator | — |
| `switch` | label, checked, disabled | none | onChange | default | root, label, track, thumb | — |
| `menu` | label, disabled | menuItem 1–100 | — | default | root, trigger, content | — |
| `menuItem` | label, icon?, disabled | none | onPress | default, danger | root, label, icon | — |
| `popover` | label | any | — | default | root, trigger, content | — |
| `dialog` | label, open | any | onClose | default | root, backdrop, content, title, close | — |
| `tooltip` | text | any | — | default | root, trigger, content | — |
| `tabs` | label, value | tab 1–100 | onChange | default | root, list, panel | — |
| `disclosure` | label, open | any | onToggle | default | root, summary, panel | — |
| `tab` | label, value, disabled | any | — | default | root, label, panel | — |

Additions that Plan 001 proposed and Plan 002 built, each generic:

| Addition | Kind | Why composition could not do it | Gap |
| --- | --- | --- | --- |
| `disclosure` (label, open, `onToggle`, `details`/`summary` in the renderer) | new primitive | Tier-1 expand/collapse needs browser behaviour no candidate provides. `popover` changed both DOM and behaviour | G7 |
| `semantics` on every kind (closed enum: section, article, aside, header, footer, nav, list, listItem, terms, term, detail) plus `label` | prop | Generic wrappers cannot produce landmarks, sectioning or description lists. A semantic and a11y gap, not a styling one | G6 |
| `current` / `pressed` on `button` | props | `aria-current` / `aria-pressed` have no other source | G6 |
| `box` variants `plate`, `rule`, `callout` (with a `rail` slot) | recipe axis | Decorated boxes: an inset plate, a hairline row, a ruled callout | G8 |

## 3. Style props needed

Implemented and validated (`runtime/validate.ts`, `tests/runtime.test.ts`, `tests/styles.test.ts`):

| Style prop | Proof domain | Used by |
| --- | --- | --- |
| padding, margin (all sides and axes), gap | declared `space.0`–`space.7` only | all four UIs |
| direction, align, justify, wrap, textAlign | closed enums | all four UIs |
| width, height, minWidth, maxWidth | `space.*`, `size.*`, `fill`, `fit`, `0–100ch`, `0–100%` | queue grid, decide note (`56ch`), rack indicators |
| grow, shrink, basis | numbers 0–100 | rows, composer |
| columns, rows, area | ≤ 12 tracks of the dimension domain (`fr` becomes `minmax(0, …)`; QueueRow now uses flex, Plan 007 T10) | queue rows and facts, Rack module |
| position, insetTop, insetBottom | `static` / `sticky`; `space.*` | sticky focus column |
| surface (box) | `surface.*` theme roles | cards, panels |
| fill (box) | a declared subset of non-surface roles (accent, diagnostics, `status.critical`, `identity.1–5`) | rack indicators |
| radius (box) | `radius.*` design values or `full` | rack indicators, queue plates |
| textStyle, tone | typography roles; tones default, muted, meta, accent, success, warning, danger, info, foil | all four UIs |
| Responsive values | any style prop may take `{ base, bp.sm, bp.md }`, keyed by design-system container breakpoints; a value holds at every wider breakpoint | two-column queue, facts, section head, sticky focus |

Design values the app declares and every design system defines: `space.0`–`space.7`, `radius.control`/`plate`/`pill`, `size.rail` (352), `size.glyph` (15), breakpoints `bp.sm` (384) and `bp.md` (720). Typography roles may carry `letterSpacing`, `textTransform`, `fontStretch` and `fontSizeAdjust`; `gap={3}` in spec §6.3 is the `space.3` token (G21).

## 4. Interaction tiers

| Tier | Exercised | Test |
| --- | --- | --- |
| 1. Local | menus (Snooze, Widget options), popovers (Reference), tabs keyboard, typing in the escalation reason and Rack composer with no request, dialog focus containment, checkbox, switch, select, tooltip | `renderer-browser.test.tsx` (`three_interaction_tiers_overlays_and_keyboard_controls`), `agent-home-browser.test.ts`, `clay-browser.test.ts` (typing sends 0 POSTs) |
| 2. `setState` | category filter, row selection to focus, three-chain Load more, reason/draft commit, Rack Files/OM/Context tabs, core-queue paging per size | `agent-home.test.ts` (`selecting_a_row_moves_its_card_to_focus`, `filter_selects_a_visible_focus_and_load_more_advances_all_three_cursors`), `core-queue.test.ts`, `clay.test.ts`, `host.test.ts` (`set_state_reruns_widget_and_returns_new_tree`) |
| 3. Action | claim, escalate (1–500 code points), acknowledge, snooze, convert, review, retry, close container, send | `agent-home.test.ts` (`escalate_requires_a_reason_of_1_to_500_chars`), `clay.test.ts` (`agent_info_tabs_and_close_map_to_declared_intents`), `host.test.ts` (`action_is_logged_and_never_rerenders_by_itself`, `dispatch_rechecks_state_actions_current_tree_and_revision`) |

Actions are logged and never executed (proof host).

## 5. Comparison with Synapta's grown `Queue`

Baseline: `references/synapta-core/web/app/components/ui/queue.tsx` plus Plan 200.4 T4a–T4d. To unblock the approved home, Synapta grew the catalog four times (`synapta-harness-3` → `-6`). The proof expresses each addition as widget code over unchanged primitives:

| Synapta added to the catalog | The proof expresses it as |
| --- | --- |
| `Queue.layout: "stacked" \| "rail"` (T4b) | a `grid` with two `columns` in `queue.tsx`, and a stack at medium in `core-queue/widget.tsx` |
| `Queue.focus`: a closed schema of 13 fields (kicker, word, hue, mark, when, lead, body, footnote, note, facts ≤ 12, reference, actions ≤ 4, reason) (T4b–T4c) | `TaskCard`, `AlertCard` and `DecisionCard`: plain TSX functions that choose which `text`, `heading`, `popover` and `button` to draw |
| `QueueControl` union (link / button / menu ≤ 4 items) plus nested-intent validation (T4c) | ordinary `button`, `link` and `menu`/`menuItem` nodes, each with one declared intent. The validator already checks every event, so no nested-intent pass is needed |
| `QueueReason` (field, trigger, confirm dialog, `arg`) (T4c) | `textField` + `dialog` + `button`. The reason commits to state, then a static action carries it |
| `row.mark`, `row.flag`, `row.word`, `row.hue` (T4b) | `QueueRow` composes `text` with `tone` (marker glyphs remain a gap: G8) |
| `Tabs.items[].count`, `groups[]`, `WidgetFrame.headingLevel` (T4a) | tab labels built from data; group headings; `heading level` |
| `shown` / `nextHref` pager plus server-side token walk (T4d) | `cursors` state, one Load more `state.set` advancing three chains; "Showing N" text |

Net: Synapta's `Queue` carries roughly 40 product-specific catalog fields, and each new card shape needs a catalog bump and redeploy. The proof needs none. What the proof lacks is the DOM fidelity the grown component reached (article/aside/dl/details/nav, `aria-current`, marker SVGs, sticky rail). §2 and §3 propose generic primitives for exactly those.

## 6. Gaps and resolutions

Resolutions: **Spec** = proposed spec change (§7). **Phase N** = handled when that phase builds the real part. **Accepted** = intentional proof behaviour. **Limit** = an evidence boundary, not a model finding. **Adopter** = the source app's own gap, recorded and not designed for (problem class first).

| # | Gap (source) | Resolution |
| --- | --- | --- |
| G1 | Rack typography is user-owned; spec §6.1 puts typography in the theme (GAPS T3) | **Spec**: the theme is the resolved union of colour and typography roles; an app may assemble it from separate sources. Still the only source |
| G2 | Certified lacks five-patch identity roles and diagnostic fills; it aliases them (GAPS T3, T10) | **Done** (plan 016 T6): the roles are `identity.1–5`, and Certified defines each identity role and the soft diagnostic fills with a distinct value. An app still declares its own required roles (§6.1) |
| G3 | Rack docs claim 273 recipes; the manifest has 247 (GAPS T3) | **Adopter**: a source-documentation error. The manifest is authoritative |
| G4 | Rack source variants with no catalog counterpart (`ghostDanger`, label/textInput variants, product families `lamp`/`jack`/`pips`) (GAPS T3) | **Accepted**: kept as reference data. Product families are compositions; `ghostDanger` is an app-declared variant if wanted |
| G5 | Undeclared Rack spacing/easing references; proof supplied values (GAPS T3) | **Adopter**: the source omits values. Phase 1 install validation rejects such references |
| G6 | No section/article/aside/header/nav/dl semantics; no `aria-current` (GAPS T7, PARITY "Semantic structure") | **Done** (Plan 002 T4): `semantics` on every kind, `label`, and `current`/`pressed` on `button`. The queue renders section/header/article/aside/nav/terms/term/detail; `tests/runtime.test.ts` `terms_holds_only_terms_and_details` |
| G7 | No disclosure: Reference and Widget options use `popover` instead of `details` (GAPS T7, PARITY "Disclosure") | **Done** (Plan 002 T4): `disclosure` renders native `details`/`summary` with local open state. Widget options stay a `menu`, which is React Aria markup (see the inventory) |
| G8 | Plate borders, hairline rules, callout rail, status marker SVGs, brand mark (GAPS T7, PARITY "Marker geometry") | **Done** (Plan 002 T4/T6): `box` variants `plate`, `rule` (per-side top border) and `callout` with a `rail` slot; the five artifact glyphs are host icons. Marker hues remain G30 |
| G9 | Fixed two columns: no responsive tracks, no mobile stacking, no sticky focus. Desktop 684/684 vs 952/352 px (GAPS T7, T8; PARITY "Desktop proportions", "Mobile stacking") | **Done** (Plan 002 T3/T5): responsive values per breakpoint, `position: sticky` above `bp.md`. Two columns now render 952/352 and 536/352, stacking at 390. A container-query container costs one ~17 ms cold flip per page (`GAPS.md`) |
| G10 | Lamp, jack and pips are square `surface.*` boxes. No circle, no identity/status fill (GAPS T9) | **Done** (Plan 002 T7): `fill` and `radius` on `box`. The lamp and both patches draw 8 px circles from `accent.primary` and `identity.1`; pips keep a corner. Certified's identity roles are distinct (G2, plan 016 T6) |
| G11 | Row subject buttons centre their label; button content can't hold title + meta (GAPS T7; harness walk) | **Done** (Plan 002 T3/T6): `align` on `button`, `textAlign` on text. `button.ghost` is a bare left-aligned title; meta is an adjacent node |
| G12 | Generic wrappers inherit host-page typography (Times New Roman 16px); Rack tab and field labels fall back to serif (PARITY "Typography"; harness walk) | **Phase 3**: the projection sets base typography on the surface root and on every slot that draws text. Recipe completeness covers ink, not font |
| G13 | Typography and spacing values differ (card title 20.16 vs 24.19 px, kicker weight, row weight) (PARITY) | **Done** (Plan 002 T5a/T6): typography roles gained `letterSpacing`, `textTransform`, `fontStretch` and `fontSizeAdjust`; the roles are data. Card title, kicker, row and group-label weights now match |
| G14 | Artifact fonts (Schibsted Grotesk, Martian Mono) were not snapshotted; both 404 (PARITY) | **Done** (Plan 002 T2): both faces and their licences are snapshotted with SHA-256 rows in `references/SOURCES.md`; the host serves them and asserts both load |
| G15 | Host gutters differ; queue padding 24 vs 16 px (PARITY "Host placement") | **Done** (Plan 002 T6): host placement applies the artifact's 32/16 px gutters, and the widget root carries the 24 px pad. Region widths are 1376/960/358 px, as the artifact |
| G16 | "Showing 6 / Load more" vs the artifact's static "Showing 12 / Next"; Selected word and row copy (PARITY "Paging/copy") | **Accepted**: loaded-count behaviour is correct, and the artifact's copy now matches. A `current` row reads `aria-current` and draws the well (Plan 002 T4/T6) |
| G17 | Review is a logged action, not a link (PARITY "Disclosure and navigation") | **Accepted**: the proof host has no proposal page |
| G18 | Escalate reason and Rack draft must commit (blur/Enter) before the action is offered. No dynamic action argument (GAPS T5, T7, T9) | **Spec**: §8 says a commit may carry its value "as an action argument", but the §9 intent has no way to do so. Proposed: record as an open decision in §15 and keep commit-to-state as the proven path |
| G19 | `textField` commit event is named `onChange` in the proof; spec §8 says `onCommit` (GAPS T5) | **Phase 1**: use the spec's `onCommit` |
| G20 | Native `maxlength` counts UTF-16 units; wire schemas count code points (GAPS T7, T9) | **Phase 4**: the renderer enforces code points itself |
| G21 | `gap={3}` in spec §6.3 contradicts the token table (Task 2) | **Done**: spec §6.3 uses `gap="space.3"`, and every dimension validates against declared names |
| G22 | Per-source Unauthorized/Unavailable/Stale panels can't be distinguished by the normalised fixture (GAPS T8) | **Limit**: a fixture choice. The widget can branch on any status data supplies |
| G23 | Large size honours selection; the source always focuses the first decision (GAPS T8) | **Accepted**: an intentional improvement |
| G24 | Specimen width caps are host placement; no token multiplication (GAPS T8) | **Accepted**: placement belongs to the app (§3) |
| G25 | OM/Context panels have no source content; meter and model/effort pickers are readouts (GAPS T9) | **Limit**: the source has no content. Pickers are `select` / `menu` compositions, not exercised |
| G26 | Icon glyphs are a small host map with Unicode approximations (GAPS T5, T9) | **Phase 4/Adopter**: the app owns its icon set |
| G27 | Global stylesheet in the original proof (GAPS T5) | **Closed, Plan 007 T10**: scoped `/css` host and two-surface isolation/overlay tests (`GAPS.md`) |
| G28 | The reusable untrusted theme/design-system install validator was not built (GAPS T3, T5) | **Phase 1** |
| G29 | Native scrollbar geometry; forced colours only emulated in Chromium (GAPS T5) | **Phase 3/4**: accessibility audit on real platforms |

Plan 002 added three gaps to this table, each recorded in `GAPS.md` rather than designed away:

| # | Gap | Resolution |
| --- | --- | --- |
| G30 | Row markers and the card kicker draw in `currentColor`; the artifact tints them attention/danger/info/foil (`GAPS.md` "Plan 002 Task 6") | **Done** (plan 016 T6): the catalog's `icon` lists the existing `tone` style prop and the proof widgets pass it; no library change |
| G31 | A tab carries one label string, so its count cannot take its own mono face; tab widths differ by 4–6 px (`GAPS.md`) | **Done** (plan 016 T6): `tab` takes an optional `count` prop drawn in its own `count` slot |
| G32 | The render bench is over budget: the artifact-faithful composition renders 679 nodes in 5.75 ms against 2 ms (`GAPS.md` "Plan 002 Task 6", §9) | **Owner decision** (§8). Either the render/validate path gets cheaper, or the budget becomes per-node (`≤ 3 µs/node`, i.e. 2 ms at 680 nodes). The proof does not raise its own budget |

Pixel inventory: **0.72% / 0.75% / 0.97%** at 1440/1024/390 px, within the ≤ 1% bar. `PARITY.md` lists every remaining difference as nine causes plus 32 style values per width, each with its reason; `scripts/inventory.ts` re-derives that list from the capture, collapsing the wrapper elements that make the raw count 281.

## 7. Required changes

Spec changes (made in Plan 001 Task 12, approved in §8; Plan 002 implemented all of them in `proof/`):
- §5: the candidate list is confirmed as the floor. Add `disclosure`; add `semantics` + `label` on layout primitives and `current`/`pressed` on `button`; state that `box` variants are app-declared recipe axes.
- §6.1: the theme may be assembled from separate colour and typography sources (G1).
- §6.3: responsive values, `position`/`inset`, `fill`/`radius` on box, `textAlign` and button content `align`; fix `gap={3}`.
- §6.4: the projection gives every surface root and text slot theme typography (G12).
- §8 / §15: dynamic action arguments become an open decision (G18).
- §12: exact artifact anchors; outcome recorded with a pointer to this report.

Plan 002 added those capabilities to the proof, snapshotted the artifact fonts and re-ran `scripts/parity.ts` to the threshold: 0.72% / 0.75% / 0.97% of pixels, with every remaining difference listed in `PARITY.md` and approved. Nothing is carried into Phase 1 from this section.

## 8. Owner decision

2026-10-22: the owner chose **conditional go** on Plan 001's report and approved **all** of the spec changes in §7 (`decision-logs/2026-10-22-0033-phase-0-conditional-go.md`), with Phase 0 staying open until the parity re-proof passed.

2026-10-22, after the re-proof: the owner chose **go** (`decision-logs/2026-10-22-1519-phase-0-go.md`).
- **The parity criterion is met**: 0.72% / 0.75% / 0.97% of pixels at 1440 / 1024 / 390 px against a ≤ 1% bar, region sizes equal to the artifact's, no diagnostics. The ten DOM causes and the 32 style values are approved as intended (`PARITY.md`).
- **The model question is answered**: four real UIs from 24 generic primitives and composed TSX, no product-shaped component, no raw CSS or literal colour, all three interaction tiers, and one CSS-only design-system switch.
- **One budget does not hold, and it now gates Phase 1**: the artifact-faithful tree has 13.6 nodes per row (679 at 50 rows), and the proof's render path spends 8.5 µs per node, so the 50-row selection rerenders in 5.75 ms against 2 ms (`core.queue` 3.02–4.18 ms from medium up). The owner accepted this as a rendering-path cost, not a model finding, and set the gate: **Phase 1's renderer must stay within 3 µs per node (2 ms at 680 nodes)**, measured on the same benches. `GAPS.md` G32 carries it; the roadmap's Phase 1 entry names it as an exit criterion.
- Phase 0 is done. Phase 1 may freeze the formats.

## 9. Performance

Re-measured 2026-10-22 (Linux, Bun 1.4.2, Chromium 156), after Plan 002's composition. Each render is the mean of 1,000 renders after 200 warm-ups, including validation; budget 2 ms.

| Measure | Budget | Result | Source |
| --- | --- | --- | --- |
| Synthetic full queue, 50 rows, 353 nodes | 2 ms mean | 1.753 ms | `tests/runtime.bench.ts` |
| Agent-home selection rerender, 50 rows, **679 nodes** | 2 ms mean | **5.746 ms — over** | `tests/agent-home.bench.ts` |
| core.queue small / medium / large / full, 50 rows | 2 ms mean | **0.226 / 3.019 / 3.895 / 4.177 ms — over** from medium | `tests/core-queue.bench.ts` |
| Git status 52 rows / Rack module 50 files | 2 ms mean | 0.794 / 1.301 ms | `tests/clay.bench.ts` |
| Host `setState` HTTP round trip, 25 runs | 50 ms max | 7.67 ms | `tests/host.test.ts` (`set_state_http_round_trip_under_50_ms`) |
| Design-system switch, 10 switches, queue / git | 16.67 ms max | 3.80 / 0.80 ms | `tests/switch.test.ts` |
| Switch reruns widgets | 0 | 0 | `tests/renderer-browser.test.tsx` |

The render benches pay for the composition: the artifact's row is a grid row with a marker, a title button, a mono word and meta spans, so the 50-row selection tree grew from 193 to 679 nodes and the per-node cost is ~8.5 µs. Two costs in that path are mechanical, not inherent: `assertJson` re-walks the whole input data per render (16% of samples), and `validate` re-checks every node with regex, linear `Array.includes` and per-node `Object.entries` (25%). The switch's cold flip costs ~17 ms once per page when a container-query container exists, then 3.8 ms steady; `switch.test.ts` warms up once and says why. `GAPS.md` "Plan 002 Task 6" records both.

## 10. The four laws

| Law | Held? | Evidence |
| --- | --- | --- |
| 1. Widget code never runs in the browser | Held in all four UIs | Browser bundles contain no widget or git adapter code (`host.test.ts` `host_serves_reference_pages_and_rejects_invalid_requests`, `agent-home-browser.test.ts`, `core-queue-browser.test.ts`, `clay-browser.test.ts`). Widgets run in the Bun host; the switch makes no request (`switch.test.ts`) |
| 2. The UI tree is validated data | Held, including the Plan 002 surfaces | `runtime.test.ts` (host elements, function props, async, missing keys, limits, transport; `semantics_are_a_closed_enum_with_terms_child_rules`, `position_fill_radius_and_text_alignment_validate`, `responsive_style_values_are_closed_data`, `fill_accepts_only_declared_fillable_roles`), `renderer.test.tsx` (`server_rendering_and_transport_revalidation`: fallback on unknown or invalid nodes) |
| 3. No colours or raw CSS from widgets | Held, including `fill`, `radius` and responsive values | `catalog.test.ts` (`definitions_admit_no_colour_or_raw_style_props`), `styles.test.ts` (`no_colour_outside_themes`, `style_values_reference_declared_value_names`), `projection.test.ts` (`projection_rejects_injection_missing_recipes_and_unresolved_values`), `agent-home.test.ts` (`widget_uses_only_catalog_primitives_and_declared_intents`) and the primitive-only checks in `core-queue.test.ts` and `clay.test.ts`. The price was the visual gaps in §6, never an escape |
| 4. No widget authority | Held | Every control maps to a manifest-declared action with a closed schema; the host re-checks offered intents, revision and arguments (`host.test.ts` `dispatch_rechecks_state_actions_current_tree_and_revision`, `paging_preserves_selection_and_row_ids_and_rejects_old_or_forged_intents`) |

## 11. Reproduce

```bash
timeout 300 bun run check                                     # typecheck, lint, format, 78 tests (11 in Chromium)
timeout 120 bun proof/tests/runtime.bench.ts                  # and agent-home / core-queue / clay benches (two are over budget)
timeout 300 bun proof/scripts/parity.ts --out evidence/parity # pixel, DOM and style diffs (local only)
timeout 60 bun proof/scripts/inventory.ts --dir evidence/parity # the same capture as causes
bun run proof                                                 # http://127.0.0.1:3000, all reference pages
```

Chromium is installed once with `timeout 600 bunx playwright install chromium`. Evidence images stay under the gitignored `/evidence/`.
