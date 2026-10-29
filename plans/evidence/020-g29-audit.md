# G29: native Windows forced-colours and assistive-technology audit

**Status: checklist written 2026-10-29 (plan 020 Task 2). The Windows run has not happened.** Every `Result` cell below is empty
until the owner, or an auditor the owner names, runs this on Windows and records what they see.

Why this is manual: G29 asks for native Windows forced-colour rendering, native control and scrollbar geometry, and
assistive-technology behaviour. Chromium automation on Linux can prove the projection's rules, but not the OS's own
rendering, the platform scrollbar or a screen reader's announcement. `proof/GAPS.md` records the same gap.

The owner decided on 2026-10-25 to defer G29 past 0.1.0 (R20, `decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md`);
0.1.0 shipped without it on 2026-10-27 with the limitation in its release notes. Both request documents ask for it, and
Synapta's accessibility list requires forced colours, so plan 020 reopens it for 0.2.0.

## What automation already covers

Do not re-derive these; they are the baseline this audit extends. If one of them fails on the auditor's machine it is a
finding for the release, not a checklist row.

| Covered | Test |
| --- | --- |
| Every state whose recipe differs from rest stays distinct from rest under forced colours, in both systems (Chromium, Firefox) | `every_state_differs_from_rest_in_forced_colours`, `src/__tests__/css-browser.test.ts:` |
| Background-only edges and fill indicators gain the inward `CanvasText` outline; `forced-color-adjust` stays `auto` | `background_edges_survive_forced_colours`, `fill_indicators_keep_their_shape`, `forced_colours_none_background` |
| Alpha, reduced transparency and forced colours compose; shadows are suppressed | `alpha_reduced_transparency_and_forced_colours`, `src/__tests__/css-browser.test.ts:` |
| `scrollbar-color` and `::placeholder` resolve, and forced colours hand both to the OS | `placeholder_and_scrollbar_computed` |
| Scoped portals (menu, popover, dialog, tooltip) keep the design-system and surface attributes | `design_system_switch_changes_styles_without_widget_or_dom_rerender_and_honours_forced_colours`, `proof/tests/renderer-browser.test.tsx` |
| The projection emits the forced-colours block only where a state differs from rest, and never `forced-color-adjust: none` | `forced_colours_only_restore_differing_states_and_background_edges`, `src/__tests__/css-design-system.test.ts` |
| The 0.2.0 native parts project and recover reduced transparency | `scrollbar_projection_byte_stable`, `placeholder_projects_through_the_state_selector_builder`, `native_parts_resolve_alpha_and_recover_reduced_transparency`, `attribute_recovers_alpha_modifiers_like_the_media_query` |

## Prepare the machine

Record this before the first row; without it the audit cannot be reproduced or re-run after a fix.

| Item | Value |
| --- | --- |
| Auditor (owner or named) | |
| Date | |
| Windows edition and build (paste `winver`) | |
| Display scale (100% / 125% / 150%) and screen width × height | |
| Browser and version (`edge://version` or `chrome://version`) | |
| Screen reader and version (NVDA: Help → About; Narrator: Settings → Accessibility) | |
| Contrast theme (Settings → Accessibility → Contrast themes) | |
| Transparency effects (Settings → Accessibility → Visual effects) | |
| Zoom levels used (100%, 200%, 400%) | |

Windows 11 or 10, Edge or Chrome, NVDA and/or Narrator. One screen reader is enough if the row names which one was used;
rows marked **(both)** are worth crossing with the second reader if it is installed.

```sh
git clone <repository> && cd liveframe
mise install                 # or install Bun 1.4.2 directly
bun install
bun run proof                # Liveframe proof host: http://127.0.0.1:3000
```

The host binds `127.0.0.1:3000` only. Sessions live until the process exits and intents mutate them, so **restart
`bun run proof` before a pass you intend to record**, and note in the row when you did not.

Font note: the reference font snapshots are local-only, so Windows uses fallback fonts. Different metrics from the Linux
captures are expected and are not a finding; clipped, overlapping or unreachable content is.

The host's own chrome (`<nav>`, `<h1>`, the "Design system" `<select>`, the status line, the action log) is app-owned HTML,
not library output. Audit the surface inside `#app`; the two host-level rows are marked **HOST**.

## Pages

| Page | URL | Default system |
| --- | --- | --- |
| Synapta agent-home queue | `/ui/agent-home` (`?scenario=ready`, `read-only`, `no-escalate`, `no-alerts`, `loading`, `empty`, `failed`) | Certified |
| Core queue, four sizes | `/ui/core-queue?size=small\|medium\|large\|full` | Certified |
| Clay git status | `/ui/git-status` (`?scenario=ready`, `empty`) | Rack |
| Rack agent-info module | `/ui/rack-module` | Rack |
| Design-system switch | `/ui/design-system` | Certified |
| Host smoke fixture (has the scrolling region) | `/ui/harness` | Certified |

Switch systems per page with the "Design system" `<select>` above the surface. Every row below is run under **both**
systems unless it says otherwise; the default is only the starting point.

Named controls on `/ui/agent-home` (default scenario): row "Reassign the Hansen delivery milestone" opens the task card
(Claim, Escalate…, Reference); row "Invoice INV-2099-438 was refused by the provider" opens the alert card (Acknowledge,
Snooze, Reference); "Widget options" in the footer opens a menu. `/ui/rack-module` has tabs Files/OM/Context, the
"Message to Coding Agent" field and a disabled Send. `/ui/harness` has Query, Bound reason, "Local menu", "Local views",
"Local reference" and the "Harness rows" scroller.

## 1. Forced colours on

Turn on a Windows contrast theme (Settings → Accessibility → Contrast themes; "Night sky" and "Desert" are good extremes).
Edge/Chrome should report `(forced-colors: active)` — check once in DevTools → Rendering → Emulate CSS media feature.

| ID | Page / control | Steps | Expected | Result |
| --- | --- | --- | --- | --- |
| FC-01 | agent-home, both systems | Load `/ui/agent-home` | Every text run is legible; nothing vanishes into the background; status words read as text (no colour-only meaning) | |
| FC-02 | agent-home, all scenarios | Load each `?scenario=` in turn | Loading, empty, failed and read-only bodies are all legible; the failed body's "Retry the queue" is visible and reachable | |
| FC-03 | core-queue, both systems | Load all four sizes | Nothing clipped or overlapping at any size; edges visible | |
| FC-04 | git-status, both systems | Load `?scenario=ready` and `empty` | All 52 labels legible in both systems; the status icons are decorative and add no colour-only meaning | |
| FC-05 | rack-module, both systems | Load the page | Selected tab is `Highlight`/`HighlightText`; the four round indicators (patch, lamp, jack, three pips) keep their shape; disabled Send is `GrayText`; the field is visible | |
| FC-06 | harness, both systems | Load the page | Body legible; the "Harness rows" scroller keeps a usable OS scrollbar | |
| FC-07 | agent-home, rack-module, harness | Click each tab | The selected tab is visibly different from the other tabs (Highlight/HighlightText), not only by marker | |
| FC-08 | agent-home | Hover "Claim" without clicking | A 1px `Highlight` outline appears on hover; nothing else changes colour | |
| FC-09 | agent-home | Tab to "Widget options" | A 2px `Highlight` focus outline appears and is fully visible, not clipped | |
| FC-10 | agent-home | Press and hold "Claim" | A 1px `Highlight` outline while pressed | |
| FC-11 | agent-home | Open "Widget options", open "Reference" on the task card, open the escalation dialog | Each open control carries a 1px `Highlight` outline while open | |
| FC-12 | rack-module, agent-home dialog | Look at disabled Send; open the dialog with an empty Reason | Disabled text is `GrayText` and still readable against the background | |
| FC-13 | — | — | **n/a**: no proof widget renders an `invalid` state. Covered by `every_state_differs_from_rest_in_forced_colours`; record as n/a rather than pass | |

## 2. Edges and fill indicators

| ID | Page / control | Steps | Expected | Result |
| --- | --- | --- | --- | --- |
| ED-01 | agent-home, both systems | Look at the plate, the callout and the footer rule | Each background-only surface keeps a visible boundary: inward 1px `CanvasText` outline, or its own positive border; nothing is clipped by padding, rounding or the sticky column | |
| ED-02 | rack-module | Look at the patch, lamp, jack and the three pips | Each keeps its shape (circles, 1px-cornered pips) and gains a thin `CanvasText` outline; the fills are OS-coloured, not theme-coloured | |
| ED-03 | agent-home menu, alert Snooze menu | Open each menu | The popover's edge is visible over the page; text inside is legible; the popover is not clipped by the surface | |
| ED-04 | agent-home dialog | Open the escalation dialog | The dialog is legible above the page; the backdrop does not swallow it; the page behind is still recognisable (or plainly hidden — record which) | |
| ED-05 | git-status, both systems | Look at the row markers with no background | No spurious 1px boxes around plain text; only real surfaces and fill indicators are outlined | |

## 3. Overlays

Run these once with forced colours on and once off; note which in the row.

| ID | Page / control | Steps | Expected | Result |
| --- | --- | --- | --- | --- |
| OV-01 | agent-home "Widget options" | Open with mouse, then with keyboard (Tab, Enter) | Menu appears next to the trigger, inside the viewport; items are readable and hoverable; Escape closes; focus returns to the trigger | |
| OV-02 | agent-home alert card "Snooze" | Open the alert card, then the Snooze menu | Two items ("For 1 hour", "For 1 day"); Arrow keys move, Enter activates, Escape closes | |
| OV-03 | agent-home task card "Reference" | Open and close with mouse and keyboard | Native disclosure: summary is focusable, Enter/Space toggles, panel text appears below, state is visible | |
| OV-04 | agent-home escalation dialog | Press "Escalate…" | Dialog appears above the queue, named, focus inside; Tab and Shift+Tab stay inside; Escape closes and returns focus to "Escalate…"; "Cancel" does the same | |
| OV-05 | rack-module, agent-home dialog, both systems | With reduced transparency on, reopen the dialog | The backdrop is opaque, no blur artefact; content stays legible | |
| OV-06 | all overlays | Zoom to 200% and 400%, reopen each overlay | Overlay content stays inside the viewport and scrolls rather than clipping | |

## 4. Keyboard interaction

No screen reader needed for this section.

| ID | Page / control | Steps | Expected | Result |
| --- | --- | --- | --- | --- |
| KB-01 | every page | Tab from the address bar to the end of the page | Order follows reading order; every interactive control is reachable; a visible focus indicator is always present; no keyboard trap except inside the modal dialog | |
| KB-02 | agent-home, rack-module, harness tabs | Focus the tab list, then Left/Right/Home/End | Selection moves with the arrow keys; the panel follows; focus stays on the tab strip | |
| KB-03 | every page | Activate each button with Enter and with Space | The intent fires (appears in "Actions (logged only)") and focus stays sensible | |
| KB-04 | harness "Query", rack-module "Message to Coding Agent" | Type; press Enter | Single-line: Enter commits (logged). Multiline: Enter makes a new line; Ctrl+Enter commits | |
| KB-05 | harness "Harness rows" | Tab to the scroller, then Arrow/PageDown/Home/End | The region takes focus, scrolls with the keyboard, and its scrollbar moves | |
| KB-06 | every overlay | Press Escape | Closes and returns focus to the trigger; nothing else on the page is lost | |
| KB-07 | agent-home | Use the tabs to filter to Alerts, then to All | Selection state and panel content match what is announced and shown | |

## 5. Native controls and scrollbar geometry

| ID | Page / control | Steps | Expected | Result |
| --- | --- | --- | --- | --- |
| NP-01 | rack-module "Message to Coding Agent" | Focus the field | Focus ring is fully visible at the control's edge; the native caret is visible; the OS draws the caret and selection, not the theme | |
| NP-02 | rack-module, harness fields | Type and select text in the light and dark themes | Native selection highlight is the OS one and stays legible over the surface colour; no horizontal scrollbar unless the line overflows | |
| NP-03 | harness "Harness rows", Rack | Scroll the region with the wheel and the scrollbar | Thumb is the theme's `surface.scrollbar` role, track transparent; the scrollbar occupies layout width (classic, not overlay); the thumb is draggable and its size follows the content | |
| NP-04 | harness "Harness rows", Rack, forced colours on | Repeat NP-03 | Thumb and track are the OS's own (`scrollbar-color: auto`); still visible, still draggable, still the OS width | |
| NP-05 | harness "Harness rows", Certified | Repeat NP-03 | No themed scrollbar: the UA default is used, with no library override | |
| NP-06 | agent-home | Select text across rows and the sticky card | Selected text stays legible in forced colours; the sticky column does not cover the selection | |
| NP-07 | rack-module "Ask the agent…" placeholder | Look at the empty field | The placeholder is visible and legible in both themes. No proof design system declares `placeholderColor`, so the UA style is expected; record what you see rather than pass/fail | |
| NP-08 | rack-module, both systems | Measure the four indicators and the tabs at 100% and 150% display scale | Circles stay circular, pips keep their 1px corner; nothing blurs into an ellipse at fractional scaling | |

## 6. The 0.2.0 surfaces

| ID | Surface | Steps | Expected | Result |
| --- | --- | --- | --- | --- |
| NS-01 | `none` paint, forced colours | Rack: look at "Close container" (ghost button) and a borderless row | An explicitly declared *no background* still gets the inward 1px `CanvasText` outline, so the control is visible | |
| NS-02 | `none` paint, normal | Same controls, forced colours off | Genuinely no background and no 1px artefact; only the theme's own edge shows | |
| NS-03 | Alpha, normal | Rack dialog backdrop, translucent surfaces | The declared translucency renders as designed over the page | |
| NS-04 | Alpha, forced colours | Same elements | Alpha does not fight the OS: colours are the OS's, text stays legible, no invisible-on-invisible region | |
| NS-05 | Alpha, reduced transparency | Settings → Accessibility → Visual effects → Transparency effects **off**, reload | `prefers-reduced-transparency: reduce` is active; translucent surfaces become opaque; alpha-0 backgrounds become visible; no blur remains | |
| NS-06 | Scrollbar properties | Rack: see NP-03 and NP-04 | The recipe's thumb/track colours apply normally and hand over to the OS in forced colours | |
| NS-07 | `transparency` prop | Optional, DevTools only: set `data-lf-transparency="reduced"` on the `[data-lf-ds]` element inside `#app` | The same recovery as NS-05 with the OS preference still on; a system with no alpha modifiers changes nothing | |

## 7. Assistive technology

Run with a screen reader running (NVDA and/or Narrator) at least once with forced colours off and once on. Name the
reader in each row's Result.

| ID | Check | Steps | Expected | Result |
| --- | --- | --- | --- | --- |
| AT-01 | Reading order | Browse mode, read `/ui/agent-home` top to bottom | Heading, checked line, tabs, card, rows, pager; nothing repeated, nothing read twice, no phantom "clickable" on plain text | |
| AT-02 | Landmarks and regions | Browse mode, list landmarks/regions | The surface's section/article/aside/nav/footer semantics are announced; the named ones ("Queue rows", "Pagination", "Harness rows") carry their labels | |
| AT-03 | Headings | Heading list (NVDA+F7; Narrator item navigation) | Page `h1`, then `h2` "Queue", then card headings; order matches the visual order | |
| AT-04 | Buttons and disabled state (both) | Tab to "Claim", to rack-module's Send, and to the dialog's Escalate before typing | Role button, name equals the label, disabled announced as unavailable/dimmed; the irreversible marker on "Escalate (irreversible)" is part of the name | |
| AT-05 | Tabs (both) | Enter the tab strip | Role tab, name, selected state announced; the panel is associated; arrow keys announce the new selection | |
| AT-06 | Menus | Open "Widget options" and "Snooze" | Trigger announced as a menu button with collapsed/expanded; items are menu items with names; opening and closing are announced | |
| AT-07 | Disclosure | Open "Reference" | Announced as expandable/collapsed, state changes on toggle, panel content read after the summary | |
| AT-08 | Dialog (both) | Open the escalation dialog | Announced as a dialog named "Escalate this task?"; focus moves inside; the virtual cursor cannot leave; Escape closes and focus returns; contents read in order | |
| AT-09 | Fields | Tab to Reason, Query, and the Rack message field | The visible label is announced with the control; the multiline field is announced as multi-line; the placeholder is read as a hint, not as a label | |
| AT-10 | Text without colour meaning | Read the status stamps ("overdue", "unread", "waiting on you") | Announced as text; no meaning conveyed only by colour | |
| AT-11 | Icons | Read a card with markers and a labelled icon | Decorative glyphs are silent; a labelled icon is announced with its label; nothing is announced as "graphic" noise | |
| AT-12 | Focus following | Forms mode: Tab through the page and open an overlay | The reader follows focus, announces the new context, and returns to the trigger on close | |
| AT-13 | HOST action log | Activate "About this widget" | The logged action is announced through the host's polite live region (this is host chrome, not the library) | |
| AT-14 | Combination (both) | Repeat AT-01/AT-04/AT-08 with the contrast theme on | Same announcements; nothing is lost or duplicated because of forced colours | |

## 8. Baseline pass, forced colours off

| ID | Page | Steps | Expected | Result |
| --- | --- | --- | --- | --- |
| BA-01 | all pages, both systems, no contrast theme | Load each page at 100% and 200% zoom | Content matches the Linux captures apart from font metrics: same structure, same visible state cues, nothing clipped | |

## Recording the result

- Fill `Result` with `pass`, `fail`, or `n/a — <reason>`. A fail needs the page, the control, the browser and the AT in the
  same cell; vague rows cannot be fixed.
- Optional screenshots stay local-only under `/evidence/020-g29/` and are deliberately not named here: a manual Windows
  capture has no regeneration script.
- Every fail gets an ID reference (`FC-09`, `AT-08`, …) and is then either fixed in a new task above plan 020 Task 8, or
  deferred with the owner's approval and listed in the 0.2.0 release notes as a known limitation. The plan's task list
  records the decision; this file records the observation.
- Close or narrow the backlog entry "Later-phase gaps from the Phase 0 reports" (the G29 line) with this record and the
  owner's words.

## Summary

| Section | Rows | Pass | Fail | n/a |
| --- | --- | --- | --- | --- |
| 1. Forced colours | 13 | | | |
| 2. Edges and fill indicators | 5 | | | |
| 3. Overlays | 6 | | | |
| 4. Keyboard | 7 | | | |
| 5. Native controls and scrollbars | 8 | | | |
| 6. 0.2.0 surfaces | 7 | | | |
| 7. Assistive technology | 14 | | | |
| 8. Baseline | 1 | | | |
| **Total** | **61** | | | |

Owner's verdict, verbatim:
