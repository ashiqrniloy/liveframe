# Phase 0 report: primitive-set proof

Plan 001 Task 12, 2026-10-22. Answers spec §12: can a small primitive set, plus recipes and style props, express real product UI with no product-shaped components?

**Verdict: conditional go.** The model held: four reference UIs were built from the 23 candidates and composed TSX alone. No product-shaped primitive, raw CSS or literal colour was needed, all three interaction tiers worked, and one widget switched design systems with no code change. The candidate *list* did not hold. Agent-home parity failed at every width (36–50% of pixels differ, 192 DOM paths). Every failure traces to a missing **generic** capability (sectioning semantics, disclosure, responsive and sticky layout, decorated boxes, button content, indicator fills), not to a missing product component. §12's failure condition ("can't be expressed without product-shaped primitives or raw styling") was not met, but its parity criterion was not met either. The condition: those generic capabilities enter spec §5–§6 now, and parity is re-proven before the Phase 1 formats are frozen (§7).

Owner decision (2026-10-22): conditional go, with every §7 spec change approved. See §8.

## 1. What was built

All proof code is in `proof/`, never imported by `src/`. Sources are pinned in `references/SOURCES.md` (Synapta `fc6df4b3`, Clay `7770d18c`).

| UI | Widget | Primitives used | Tests | Evidence |
| --- | --- | --- | --- | --- |
| 1. Synapta agent-home queue | `widgets/agent-home/` (`queue`, `TaskCard`, `AlertCard`, `DecisionCard`, `QueueRow`) | box, stack, inline, grid, text, heading, button, tabs/tab, textField, menu/menuItem, popover, dialog, separator | `tests/agent-home.test.ts`, `tests/agent-home-browser.test.ts` | `PARITY.md`, `scripts/parity.ts` |
| 2. `core.queue` at four sizes | `widgets/core-queue/` (`widget`, `Metric`) reusing UI 1's compositions | as above | `tests/core-queue.test.ts`, `tests/core-queue-browser.test.ts` | — |
| 3a. Clay git status | `widgets/clay/git-status.tsx` | heading, stack, inline, text, icon | `tests/clay.test.ts` (`git_status_matches_builder_output_structure` against the pinned `buildGitStatusTree`) | — |
| 3b. Rack `agent-info` module | `widgets/clay/rack-module.tsx` | box, stack, inline, grid, text, heading, icon, button, tabs/tab, textField, separator | `tests/clay.test.ts`, `tests/clay-browser.test.ts` | — |
| 4. Design-system switch | UI 1 and 3a, unchanged | — | `tests/switch.test.ts`, `tests/renderer-browser.test.tsx` | — |

Supporting proof code: catalog `catalog/definitions.ts`; SDK `runtime/`; styles `styles/{certified,rack}/`; projection `css/project.ts`; renderer `renderer/`; host `host/` (`bun run proof`).

## 2. Final primitive list

**No primitive was added.** The 23 spec §5 candidates are kept unchanged as the proven floor. The definitions below are summarised from `catalog/definitions.ts`, which is authoritative. Every one is plain data, closed, with no colour-typed, function, `className` or `style` prop (`tests/catalog.test.ts`).

`layout` below means padding/margin (all sides and axes), width, height, minWidth, maxWidth, grow, shrink and basis.

| Kind | Props | Children | Events | Variants | Slots | Style props | a11y |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `box` | — | any | — | default | root | layout, `surface` | generic |
| `stack` | — | any | — | default | root | layout, gap, direction, align, justify, wrap | generic |
| `inline` | — | any | — | default | root | as `stack` | generic |
| `grid` | — | any | — | default | root | layout, gap, align, justify, columns, rows, area | generic |
| `scroll` | label, axis | any | — | default | root, viewport, scrollbar | layout | region / label |
| `separator` | orientation | none | — | default | root | layout | separator |
| `text` | text | none | — | default | root | layout, textStyle, tone | generic |
| `heading` | text, level 1–6 | none | — | default | root | layout, textStyle, tone | heading / text |
| `icon` | name, label? | none | — | default | root | layout | img / label |
| `image` | src (https or app path), alt | none | — | default | root | layout | img / alt |
| `link` | label, href (https, app path or #) | none | — | default | root, label | layout | link / label |
| `button` | label, icon?, disabled? | none | onPress | default, primary, danger, ghost | root, label, icon | width, grow | button / label |
| `textField` | label, value, placeholder, multiline, disabled, readOnly, maxLength | none | onChange (commit), onSubmit: string | default | root, label, input | layout | textbox / label |
| `select` | label, value, disabled, options ≤ 100 | none | onChange: string | default | root, label, trigger, list, option | layout | combobox / label |
| `checkbox` | label, checked, disabled | none | onChange: boolean | default | root, label, indicator | layout | checkbox / label |
| `switch` | label, checked, disabled | none | onChange: boolean | default | root, label, track, thumb | layout | switch / label |
| `menu` | label, disabled | menuItem 1–100 | — | default | root, trigger, content | layout | menu / label |
| `menuItem` | label, icon?, disabled | none | onPress | default, danger | root, label, icon | layout | menuitem / label |
| `popover` | label | any | — | default | root, trigger, content | layout | dialog / label |
| `dialog` | label, open | any | onClose | default | root, backdrop, content, title, close | layout | dialog / label |
| `tooltip` | text | any | — | default | root, trigger, content | layout | tooltip / text |
| `tabs` | label, value | tab 1–100 | onChange: string | default | root, list, panel | layout | tablist / label |
| `tab` | label, value, disabled | any | — | default | root, label, panel | layout | tab / label |

**Proposed additions** (§7), each a generic capability with the gap that requires it. None is product-shaped:

| Addition | Kind | Why it could not be composed | Gap |
| --- | --- | --- | --- |
| `disclosure` (summary label, open, `onToggle`) | new primitive | Tier-1 expand/collapse needs browser behaviour that no candidate provides. Spec §8 already lists "expand a row" as tier 1. `popover` was used instead, which changes both DOM and behaviour. | G7 |
| `semantics` on layout primitives (closed enum: section, article, aside, header, footer, nav, list, listItem, terms, term, detail) plus an optional `label` | prop | Generic wrappers can't produce landmark, sectioning or description-list elements. That is a semantic and a11y gap, not a styling one. | G6 |
| `current` / `pressed` on `button` | prop | Row selection must be announced (`aria-current`). The proof shows a visible "Selected" word instead. | G6 |
| App-declared `box` variants (for example `plate`, `rule`, `inset`) | catalog data | Plate borders, hairline rules and callout rails are recipe styling, but `box` declares only `default`. Variants are already an app-defined recipe axis, so this needs no format change. | G8 |

## 3. Style props needed

Used and validated (`runtime/validate.ts`, `tests/runtime.test.ts` `catalog_schemas_children_variants_and_styles_fail_closed`):

| Style prop | Proof domain | Used by |
| --- | --- | --- |
| padding / margin (all sides and axes), gap | `space.0`–`space.7` only | all four UIs |
| direction, align, justify, wrap | closed enums | all four UIs |
| width, height, minWidth, maxWidth | `space.*`, `fill`, `fit`, `0–12fr`, `0–100ch`, `0–100%` | queue grid, rack indicators |
| grow, shrink, basis | numbers 0–100 | rows, composer |
| columns, rows, area | ≤ 12 tracks of the dimension domain; named areas | queue two-column grid |
| surface (box) | `surface.*` theme roles | cards, selected row, indicators |
| textStyle, tone (text, heading) | typography roles; 8 tone enums | all four UIs |

Needed but missing (proposed in §7):

| Style prop | Accepts | Gap |
| --- | --- | --- |
| Responsive values: any style prop may take `{ base, <breakpoint>… }` keyed by design-system container breakpoints | the prop's own domain | G9 |
| `position` (`static` / `sticky`) with `inset*` | enum; `space.*` | G9 |
| `fill` (box) | a declared subset of non-surface theme roles (status, identity) | G10 |
| `radius` (box) | `radius.*` design values, `full` | G10 |
| `textAlign`, and `align` on `button` content | enums | G11 |

`gap={3}` in spec §6.3 contradicts the token table; the proof enforces `space.3` (G21).

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
| G2 | Certified lacks five-patch identity roles and diagnostic fills; it aliases them (GAPS T3, T10) | **Adopter**: the app declares required roles (§6.1). Certified must supply real identity roles before a widget that uses them ships. Not a model gap |
| G3 | Rack docs claim 273 recipes; the manifest has 247 (GAPS T3) | **Adopter**: a source-documentation error. The manifest is authoritative |
| G4 | Rack source variants with no catalog counterpart (`ghostDanger`, label/textInput variants, product families `lamp`/`jack`/`pips`) (GAPS T3) | **Accepted**: kept as reference data. Product families are compositions; `ghostDanger` is an app-declared variant if wanted |
| G5 | Undeclared Rack spacing/easing references; proof supplied values (GAPS T3) | **Adopter**: the source omits values. Phase 1 install validation rejects such references |
| G6 | No section/article/aside/header/nav/dl semantics; no `aria-current` (GAPS T7, PARITY "Semantic structure") | **Spec**: `semantics` prop on layout primitives; `current`/`pressed` on `button` |
| G7 | No disclosure: Reference and Widget options use `popover` instead of `details` (GAPS T7, PARITY "Disclosure") | **Spec**: add the `disclosure` primitive |
| G8 | Plate borders, hairline rules, callout rail, status marker SVGs, brand mark (GAPS T7, PARITY "Marker geometry") | **Spec/Accepted**: app-declared `box` variants carry plate and rule recipes. Marker shapes are app icons (the `icon` glyph set is app-owned). No format change beyond §5's existing variants |
| G9 | Fixed two columns: no responsive tracks, no mobile stacking, no sticky focus. Desktop 684/684 vs 952/352 px (GAPS T7, T8; PARITY "Desktop proportions", "Mobile stacking") | **Spec**: responsive style values keyed by design-system container breakpoints; `position: sticky` |
| G10 | Lamp, jack and pips are square `surface.*` boxes. No circle, no identity/status fill (GAPS T9) | **Spec**: `fill` (declared non-surface roles) and `radius` on `box` |
| G11 | Row subject buttons centre their label; button content can't hold title + meta (GAPS T7; harness walk) | **Spec**: `align` on button content and `textAlign`. Structured button content stays out: title and meta are adjacent nodes |
| G12 | Generic wrappers inherit host-page typography (Times New Roman 16px); Rack tab and field labels fall back to serif (PARITY "Typography"; harness walk) | **Phase 3**: the projection sets base typography on the surface root and on every slot that draws text. Recipe completeness covers ink, not font |
| G13 | Typography and spacing values differ (card title 20.16 vs 24.19 px, kicker weight, row weight) (PARITY) | **Phase 3/Accepted**: recipe and heading-level choices, fixable as data; recipe types need tracking/stretch (GAPS T3) |
| G14 | Artifact fonts (Schibsted Grotesk, Martian Mono) were not snapshotted; both 404 (PARITY) | **Limit**: the parity re-run must snapshot the font files |
| G15 | Host gutters differ; queue padding 24 vs 16 px (PARITY "Host placement") | **Limit**: host placement, not widget code |
| G16 | "Showing 6 / Load more" vs the artifact's static "Showing 12 / Next"; Selected word and row copy (PARITY "Paging/copy") | **Accepted**: loaded-count behaviour is correct. The Selected word goes once G6 lands |
| G17 | Review is a logged action, not a link (PARITY "Disclosure and navigation") | **Accepted**: the proof host has no proposal page |
| G18 | Escalate reason and Rack draft must commit (blur/Enter) before the action is offered. No dynamic action argument (GAPS T5, T7, T9) | **Spec**: §8 says a commit may carry its value "as an action argument", but the §9 intent has no way to do so. Proposed: record as an open decision in §15 and keep commit-to-state as the proven path |
| G19 | `textField` commit event is named `onChange` in the proof; spec §8 says `onCommit` (GAPS T5) | **Phase 1**: use the spec's `onCommit` |
| G20 | Native `maxlength` counts UTF-16 units; wire schemas count code points (GAPS T7, T9) | **Phase 4**: the renderer enforces code points itself |
| G21 | `gap={3}` in spec §6.3 contradicts the token table (Task 2) | **Spec**: the example becomes `gap="space.3"` |
| G22 | Per-source Unauthorized/Unavailable/Stale panels can't be distinguished by the normalised fixture (GAPS T8) | **Limit**: a fixture choice. The widget can branch on any status data supplies |
| G23 | Large size honours selection; the source always focuses the first decision (GAPS T8) | **Accepted**: an intentional improvement |
| G24 | Specimen width caps are host placement; no token multiplication (GAPS T8) | **Accepted**: placement belongs to the app (§3) |
| G25 | OM/Context panels have no source content; meter and model/effort pickers are readouts (GAPS T9) | **Limit**: the source has no content. Pickers are `select` / `menu` compositions, not exercised |
| G26 | Icon glyphs are a small host map with Unicode approximations (GAPS T5, T9) | **Phase 4/Adopter**: the app owns its icon set |
| G27 | One global stylesheet; simultaneous independently styled surfaces untested (GAPS T5) | **Phase 3**: scope projection per surface |
| G28 | The reusable untrusted theme/design-system install validator was not built (GAPS T3, T5) | **Phase 1** |
| G29 | Native scrollbar geometry; forced colours only emulated in Chromium (GAPS T5) | **Phase 3/4**: accessibility audit on real platforms |

Pixel inventory (36.85% / 35.75% / 49.64% at 1440/1024/390 px), all 192 DOM paths and all 109/109/110 style values are listed in `PARITY.md`. Every one falls under G6–G16.

## 7. Required changes

Spec changes (made in this task, approved in §8):
- §5: the candidate list is confirmed as the floor. Add `disclosure`; add `semantics` + `label` on layout primitives and `current`/`pressed` on `button`; state that `box` variants are app-declared recipe axes.
- §6.1: the theme may be assembled from separate colour and typography sources (G1).
- §6.3: responsive values, `position`/`inset`, `fill`/`radius` on box, `textAlign` and button content `align`; fix `gap={3}`.
- §6.4: the projection gives every surface root and text slot theme typography (G12).
- §8 / §15: dynamic action arguments become an open decision (G18).
- §12: exact artifact anchors; outcome recorded with a pointer to this report.

Before Phase 1 freezes the formats: a follow-up plan adds the §2–§3 additions to the proof, snapshots the artifact fonts, and re-runs `scripts/parity.ts` to the threshold (pixel mismatch ≤ 1%, or every remaining difference listed as intended).

## 8. Owner decision

2026-10-22: the owner chose **conditional go** and approved **all** the spec changes in §7. Recorded in `decision-logs/2026-10-22-0033-phase-0-conditional-go.md`; spec §5, §6.1–§6.4, §8, §12 and §15 are updated. Phase 0 stays open until the follow-up parity plan passes.

## 9. Performance

Measured on 2026-10-22 (Linux, Bun 1.4.2, Chromium 156). Each render is the mean of 1,000 renders after 200 warm-ups, including validation; budget 2 ms.

| Measure | Budget | Result | Source |
| --- | --- | --- | --- |
| Synthetic full queue, 50 rows, 353 nodes (T4) | 2 ms mean | 1.586 ms | `tests/runtime.bench.ts` |
| Agent-home selection rerender, 50 rows, 193 nodes (T7) | 2 ms mean | 1.526 ms | `tests/agent-home.bench.ts` |
| core.queue small / medium / large / full (T8) | 2 ms mean | 0.175 / 1.214 / 1.357 / 1.702 ms | `tests/core-queue.bench.ts` |
| Git status 52 rows / Rack module 50 files (T9) | 2 ms mean | 0.694 / 1.222 ms | `tests/clay.bench.ts` |
| Host `setState` HTTP round trip, 25 runs (T6) | 50 ms max | 2.33 ms | `tests/host.test.ts` |
| Design-system switch, 10 switches, queue / git (T10) | 16.67 ms max | 4.90 / 1.30 ms | `tests/switch.test.ts` |
| Switch reruns widgets (T5) | 0 | 0 | `tests/renderer-browser.test.tsx` (`design_system_switch_changes_styles_without_widget_or_dom_rerender_and_honours_forced_colours`) |

Full queue at 1.70 ms is close to the 2 ms budget. Phase 2 should re-measure it once proposed props add nodes.

## 10. The four laws

| Law | Held? | Evidence |
| --- | --- | --- |
| 1. Widget code never runs in the browser | Held in all four UIs | Browser bundles contain no widget or git adapter code (`host.test.ts` `host_serves_reference_pages_and_rejects_invalid_requests`, `agent-home-browser.test.ts`, `core-queue-browser.test.ts`, `clay-browser.test.ts`). Widgets run in the Bun host; the switch makes no request (`switch.test.ts`) |
| 2. The UI tree is validated data | Held | `runtime.test.ts` (host elements, function props, async, missing keys, limits, transport), `renderer.test.tsx` (`server_rendering_and_transport_revalidation`: fallback on unknown or invalid nodes) |
| 3. No colours or raw CSS from widgets | Held | `catalog.test.ts` (`definitions_admit_no_colour_or_raw_style_props`), `styles.test.ts` (`no_colour_outside_themes`), `agent-home.test.ts` (`widget_uses_only_catalog_primitives_and_declared_intents`) and the primitive-only checks in `core-queue.test.ts` and `clay.test.ts`. The price was the visual gaps in §6, never an escape |
| 4. No widget authority | Held | Every control maps to a manifest-declared action with a closed schema; the host re-checks offered intents, revision and arguments (`host.test.ts` `dispatch_rechecks_state_actions_current_tree_and_revision`, `paging_preserves_selection_and_row_ids_and_rejects_old_or_forged_intents`) |

## 11. Reproduce

```bash
timeout 300 bun run check                                     # typecheck, lint, format, 63 tests (10 in Chromium)
timeout 120 bun proof/tests/runtime.bench.ts                  # and agent-home / core-queue / clay benches
timeout 300 bun proof/scripts/parity.ts --out evidence/parity # pixel, DOM and style diffs (local only)
bun run proof                                                 # http://127.0.0.1:3000, all reference pages
```

Chromium is installed once with `timeout 600 bunx playwright install chromium`. Evidence images stay under the gitignored `/evidence/`.
