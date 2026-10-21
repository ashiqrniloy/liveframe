# Agent-home queue parity evidence

Captured 2026-10-21 for Plan 001 Task 11. **The evidence capture is complete; visual and DOM parity fails at all three widths.** This measures the Task 7 composition as delivered, without changing its widget, recipes or renderer. Task 12 must carry these unresolved gaps into the report and go/no-go assessment; this is not Phase 0 acceptance.

Regenerate from the repository root:

```bash
timeout 300s bun proof/scripts/parity.ts --out evidence/parity
```

The script starts two ephemeral localhost servers and headless Chromium, then closes them. It uses the existing Playwright dependency, browser Canvas for PNG decoding/diffing, and Bun for execution and file output. No image dependency or other runtime is added. If Chromium is absent, install it with `timeout 600s bunx playwright install chromium`.

Inputs: the verbatim `proof/references/synapta-core/design-artifacts/approved/agent-home-certified.html` from Synapta commit `fc6df4b3a68e117c10120276193717e7213b07bf` (identical to the original `91de29ed` pin), queue section lines 1137–1245, and the unmodified `/ui/agent-home` ready/full fixture under Certified. Artifact SHA-256: `2a2a6579867b3ce77030583c3b0b8212a843323b2f1622200609ae168042e266`. Both show the same six initial subjects, default decision focus and totals 12/5/4/3. Data is synthetic; actions only log.

Environment: Linux, Bun 1.4.2, Playwright 1.64.1, Chromium 156.0.8078.4. Each width uses a fresh browser context, height 1000 CSS px, device scale 1, light colour scheme, reduced motion, en-US and UTC. External network requests are blocked. Hydration and `document.fonts.ready` complete before capture. Browser exceptions or HTTP failures other than the two known absent font files fail the run.

At each width `W`, the script writes only below gitignored `/evidence/`:

- `W-approved-page.png`, `W-widget-page.png`: unmodified full-page screenshots for context.
- `W-approved-queue.png`, `W-widget-queue.png`: queue-region screenshots at natural layout widths. Only the artifact's outside review bar and agent dock are made transparent during the region screenshot to prevent overlays from covering queue content; their layout and the queue's styles stay intact.
- `W-pixel-diff.png`: magenta differing pixels, grey matching pixels, transparent outside both images. Crops align at their top-left corners without scaling, masking queue content or forcing matching dimensions. Differences in extent count as changed pixels.
- `W-dom.json`: both complete normalized element trees and every differing positional path, including added/missing nodes.
- `W-styles.json`: both DOM/style snapshots and every above-threshold style difference at 18 corresponding anchors, covering 19 typography/layout/spacing properties. Anchor sizes, region overflow and font checks are also retained for diagnosis.
- `summary.json`: versions, input hash, thresholds, counts and parity flags. `differences.md`: the exhaustive textual inventory copied below. No screenshots are committed.

Thresholds: a pixel changes if any RGBA channel differs by **more than 16/255**, or it exists in only one crop. A pixel mismatch ratio above **1%** fails. Numeric single-pixel CSS lengths differ by **more than 0.5px**; other computed values compare exactly. DOM tags, direct text (whitespace collapsed), roles and non-ID-reference ARIA attributes compare exactly. Class names, inline CSS serialization, IDs and generated ARIA ID references are intentionally omitted to avoid reporting implementation identifiers as product differences. The DOM count is positional, not a minimum edit distance: replacing one wrapper can shift many descendants. Style anchors are a sampled correspondence, not every node or pseudo-element. Pixel differences include borders, colour, markers and geometry outside those anchors.

The script exits successfully when evidence and its self-checks are produced, even if parity is false. Inline assertions check CSS threshold boundaries, identical PNGs, a known changed pixel, and a known image-extent difference; missing regions/anchors and unexpected browser failures fail closed. Current API references: Playwright [launch](https://playwright.dev/docs/api/class-browsertype#browser-type-launch), [screenshots](https://playwright.dev/docs/api/class-page#page-screenshot), and [evaluation](https://playwright.dev/docs/evaluating). Context7 lookup was attempted but its monthly quota was exhausted; the official docs and actual Bun run were used.

| Viewport width | Approved crop | Widget crop | Changed / union pixels | Pixel mismatch | DOM paths | Style values | Parity |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1440px | 1376 × 978 | 1424 × 746 | 509057 / 1381536 | 36.85% | 192 | 109 | Fail |
| 1024px | 960 × 977 | 1008 × 786 | 348809 / 975648 | 35.75% | 192 | 109 | Fail |
| 390px | 358 × 1656 | 374 × 1170 | 303591 / 611568 | 49.64% | 192 | 110 | Fail |

Findings and dispositions (all pixel failures remain gaps):

| Finding | Disposition | Evidence / implication |
| --- | --- | --- |
| Desktop proportions and sticky focus | Gap | Artifact grid is 952/352px at 1440 and 536/352px at 1024; widget is 684/684px and 476/476px. Artifact focus is sticky; widget is static. |
| Mobile stacking and density | Gap | At 390 the artifact uses one 310px track; widget retains two 159px tracks, making its card title seven lines and content cramped. Tabs, header sizing and spacing also differ. No responsive parity. |
| Host placement / queue extent | Gap in this natural-layout comparison | Artifact deck and proof host have different gutters. Queue padding is 24px versus 16px, and widget outer grouping/gaps differ. No attempt was made to disguise these by resizing crops. |
| Typography and spacing | Gap | Card title h2 at 20.16px becomes h3 at 24.192px; kicker 13px/500 becomes 12px/400; row title 13px/600 becomes 13px/500. Generic wrappers inherit Times New Roman/16px while visible text primitives set theme typography. Complete font-family, line-height, gap, padding and margin differences appear below. |
| Semantic structure and selection | Gap | Artifact has a labelled section, header, article, facts dl/dt/dd, aside, pagination nav, details/summary and selected-row aria-current. Generic wrappers, separate metadata and Selected text replace these; React Aria supplies its own tab/trigger markup. Trees contain 124 versus 72 elements. |
| Marker geometry, plate rules and surface treatments | Gap | Source status SVGs, brand mark, folded-alert marker, rules, stale callout rail and card/row treatments are absent or differ. Pixel diff includes every changed pixel; missing SVG nodes appear in the DOM inventory. See also `GAPS.md` Task 7 findings. |
| Disclosure and navigation behavior | Intended proof behavior; still a structural/look gap | Reference and Widget options use popover triggers instead of details/summary. Review is a declared logged action button instead of an artifact placeholder link. Existing browser tests prove interactions, not equivalent DOM. |
| Paging/copy | Intended loaded-count behavior; still a text/look gap | Six loaded rows correctly yield Showing 6 and Load more rather than the artifact's Showing 12 and Next. Row status/metadata, folded-alert text and Selected prefix also differ. The raw inventory conservatively labels every text mismatch a gap. |
| Missing font assets | Evidence limitation / gap | Both declared artifact font files return 404 because Task 1 did not snapshot them: Schibsted Grotesk and Martian Mono. Artifact font checks are false; browser fallback is used. The proof theme declares a family without loading its font. Font-family checks alone cannot prove a font is installed. Exact typography/pixel parity with the fully provisioned original is therefore not established. No external or sibling-repo asset was substituted. |
| Page chrome and crop normalization | Intended evidence boundary | Full pages retain both different hosts. Region comparison excludes their outside chrome, hides only source overlays and ignores unstable implementation identifiers. It does not claim whole-page parity. |

The ready/default decision state is the scope of this visual capture. Task/alert selections, dialogs, menus, unavailable states, keyboard behavior and design-system switching remain covered by their existing tests, with no new screenshot claim. No primitive, style capability or specification meaning is added here. No deviation is newly approved by this evidence task.

The following inventory lists **every** normalized DOM and sampled computed-style difference above the stated thresholds. Repeated findings across widths share a row. Regenerate its exact content with the same capture command (`evidence/parity/differences.md`). The pixel inventory is the three diff images and changed/union counts above; every magenta pixel is classified as a gap, with causes grouped in the findings table.

<!-- Generated inventory from evidence/parity/differences.md follows. -->

Every row below is a **gap**. Equal findings across widths share one row. DOM paths use element-child indexes; changed wrappers shift descendants. IDs/classes/style serialization and generated ARIA ID references are omitted; semantic tags, direct text and other ARIA attributes are compared exactly.

| Widths (px) | DOM path | Approved | Widget |
| --- | --- | --- | --- |
| 1440, 1024, 390 | queue | {"tag":"section","attributes":{},"text":""} | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0 | {"tag":"header","attributes":{},"text":""} | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/0 | {"tag":"h2","attributes":{},"text":"Queue"} | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1 | {"tag":"span","attributes":{},"text":"Checked 2026-09-28 14:02 UTC"} | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/1 | {"tag":"div","attributes":{"aria-label":"Queue category","role":"tablist"},"text":""} | null |
| 1440, 1024, 390 | queue/1/0 | {"tag":"button","attributes":{"aria-selected":"true","role":"tab"},"text":"All"} | null |
| 1440, 1024, 390 | queue/1/0/0 | {"tag":"span","attributes":{},"text":"12"} | null |
| 1440, 1024, 390 | queue/1/1 | {"tag":"button","attributes":{"aria-selected":"false","role":"tab"},"text":"Decisions"} | null |
| 1440, 1024, 390 | queue/1/1/0 | {"tag":"span","attributes":{},"text":"5"} | null |
| 1440, 1024, 390 | queue/1/2 | {"tag":"button","attributes":{"aria-selected":"false","role":"tab"},"text":"Tasks"} | null |
| 1440, 1024, 390 | queue/1/2/0 | {"tag":"span","attributes":{},"text":"4"} | null |
| 1440, 1024, 390 | queue/1/3 | {"tag":"button","attributes":{"aria-selected":"false","role":"tab"},"text":"Alerts"} | null |
| 1440, 1024, 390 | queue/1/3/0 | {"tag":"span","attributes":{},"text":"3"} | null |
| 1440, 1024, 390 | queue/2 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/0 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0 | {"tag":"article","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0/0 | {"tag":"div","attributes":{},"text":"Decision · Synapta prepared this for you"} | null |
| 1440, 1024, 390 | queue/2/0/0/0/0 | {"tag":"svg","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0/0/0/0 | {"tag":"use","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0/1 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0/1/0 | {"tag":"h2","attributes":{},"text":"Apply the vendor's revised delivery week to PO-1188"} | null |
| 1440, 1024, 390 | queue/2/0/0/1/1 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0/1/1/0 | {"tag":"span","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0/1/1/0/0 | {"tag":"span","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0/1/1/0/0/0 | {"tag":"svg","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0/1/1/0/0/0/0 | {"tag":"use","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0/1/1/0/1 | {"tag":"span","attributes":{},"text":"awaiting your decision"} | null |
| 1440, 1024, 390 | queue/2/0/0/1/1/1 | {"tag":"span","attributes":{},"text":"Prepared 2026-09-28 13:58 UTC · third version"} | null |
| 1440, 1024, 390 | queue/2/0/0/2 | {"tag":"dl","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0/2/0 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0/2/0/0 | {"tag":"dt","attributes":{},"text":"Purchase order"} | null |
| 1440, 1024, 390 | queue/2/0/0/2/0/1 | {"tag":"dd","attributes":{},"text":"PO-1188 · Ardent Supplies"} | null |
| 1440, 1024, 390 | queue/2/0/0/2/1 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0/2/1/0 | {"tag":"dt","attributes":{},"text":"Asked for by"} | null |
| 1440, 1024, 390 | queue/2/0/0/2/1/1 | {"tag":"dd","attributes":{},"text":"Dana Reyes"} | null |
| 1440, 1024, 390 | queue/2/0/0/3 | {"tag":"details","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0/3/0 | {"tag":"summary","attributes":{},"text":"Reference"} | null |
| 1440, 1024, 390 | queue/2/0/0/3/1 | {"tag":"p","attributes":{},"text":"Proposal 8812 · version 3 ·"} | null |
| 1440, 1024, 390 | queue/2/0/0/3/1/0 | {"tag":"a","attributes":{},"text":"digest"} | null |
| 1440, 1024, 390 | queue/2/0/0/3/1/1 | {"tag":"code","attributes":{},"text":"sha256:9f2c…41ab"} | null |
| 1440, 1024, 390 | queue/2/0/0/4 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0/4/0 | {"tag":"div","attributes":{},"text":"You decide on the proposal page, which lists every change it makes. Synapta checks the records again before anything is saved."} | null |
| 1440, 1024, 390 | queue/2/0/0/4/1 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/0/0/4/1/0 | {"tag":"a","attributes":{},"text":"Review and decide"} | null |
| 1440, 1024, 390 | queue/2/1 | {"tag":"aside","attributes":{"aria-label":"Queue rows"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/0 | {"tag":"div","attributes":{},"text":"Decisions"} | null |
| 1440, 1024, 390 | queue/2/1/1 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/0 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/0/0 | {"tag":"span","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/0/0/0 | {"tag":"svg","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/0/0/0/0 | {"tag":"use","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/0/1 | {"tag":"button","attributes":{"aria-current":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/0/1/0 | {"tag":"span","attributes":{},"text":"Apply the vendor's revised delivery week to PO-1188"} | null |
| 1440, 1024, 390 | queue/2/1/1/0/1/1 | {"tag":"span","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/0/1/1/0 | {"tag":"span","attributes":{},"text":"waiting on you"} | null |
| 1440, 1024, 390 | queue/2/1/1/0/1/1/1 | {"tag":"span","attributes":{},"text":"Ardent Supplies"} | null |
| 1440, 1024, 390 | queue/2/1/1/1 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/1/0 | {"tag":"span","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/1/0/0 | {"tag":"svg","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/1/0/0/0 | {"tag":"use","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/1/1 | {"tag":"button","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/1/1/0 | {"tag":"span","attributes":{},"text":"Approve the September cost allocation"} | null |
| 1440, 1024, 390 | queue/2/1/1/1/1/1 | {"tag":"span","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/1/1/1/0 | {"tag":"span","attributes":{},"text":"snoozed"} | null |
| 1440, 1024, 390 | queue/2/1/1/1/1/1/1 | {"tag":"span","attributes":{},"text":"until 2026-09-29 08:00"} | null |
| 1440, 1024, 390 | queue/2/1/1/2 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/2/0 | {"tag":"span","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/2/0/0 | {"tag":"svg","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/2/0/0/0 | {"tag":"use","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/2/1 | {"tag":"button","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/2/1/0 | {"tag":"span","attributes":{},"text":"File the quarterly policy digest"} | null |
| 1440, 1024, 390 | queue/2/1/1/2/1/1 | {"tag":"span","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/1/2/1/1/0 | {"tag":"span","attributes":{},"text":"running"} | null |
| 1440, 1024, 390 | queue/2/1/1/2/1/1/1 | {"tag":"span","attributes":{},"text":"preparing a proposal"} | null |
| 1440, 1024, 390 | queue/2/1/2 | {"tag":"div","attributes":{},"text":"Tasks"} | null |
| 1440, 1024, 390 | queue/2/1/3 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/3/0 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/3/0/0 | {"tag":"span","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/3/0/0/0 | {"tag":"svg","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/3/0/0/0/0 | {"tag":"use","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/3/0/1 | {"tag":"button","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/3/0/1/0 | {"tag":"span","attributes":{},"text":"Reassign the Hansen delivery milestone"} | null |
| 1440, 1024, 390 | queue/2/1/3/0/1/1 | {"tag":"span","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/3/0/1/1/0 | {"tag":"span","attributes":{},"text":"overdue"} | null |
| 1440, 1024, 390 | queue/2/1/3/0/1/1/1 | {"tag":"span","attributes":{},"text":"due 2026-09-30"} | null |
| 1440, 1024, 390 | queue/2/1/3/0/1/1/2 | {"tag":"span","attributes":{},"text":"Milestone watch"} | null |
| 1440, 1024, 390 | queue/2/1/3/0/2 | {"tag":"span","attributes":{},"text":"1 alert folded here"} | null |
| 1440, 1024, 390 | queue/2/1/3/0/2/0 | {"tag":"span","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/3/0/2/0/0 | {"tag":"svg","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/3/0/2/0/0/0 | {"tag":"use","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/4 | {"tag":"div","attributes":{},"text":"Alerts"} | null |
| 1440, 1024, 390 | queue/2/1/5 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/5/0 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/5/0/0 | {"tag":"span","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/5/0/0/0 | {"tag":"svg","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/5/0/0/0/0 | {"tag":"use","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/5/0/1 | {"tag":"button","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/5/0/1/0 | {"tag":"span","attributes":{},"text":"Invoice INV-2099-438 was refused by the provider"} | null |
| 1440, 1024, 390 | queue/2/1/5/0/1/1 | {"tag":"span","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/5/0/1/1/0 | {"tag":"span","attributes":{},"text":"unread"} | null |
| 1440, 1024, 390 | queue/2/1/5/0/1/1/1 | {"tag":"span","attributes":{},"text":"Send approved invoices"} | null |
| 1440, 1024, 390 | queue/2/1/5/1 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/5/1/0 | {"tag":"span","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/5/1/0/0 | {"tag":"svg","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/5/1/0/0/0 | {"tag":"use","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/5/1/1 | {"tag":"button","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/5/1/1/0 | {"tag":"span","attributes":{},"text":"Email has not synced since 2026-09-27"} | null |
| 1440, 1024, 390 | queue/2/1/5/1/1/1 | {"tag":"span","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/5/1/1/1/0 | {"tag":"span","attributes":{},"text":"read"} | null |
| 1440, 1024, 390 | queue/2/1/5/1/1/1/1 | {"tag":"span","attributes":{},"text":"Microsoft 365"} | null |
| 1440, 1024, 390 | queue/2/1/6 | {"tag":"nav","attributes":{"aria-label":"Pagination"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/6/0 | {"tag":"span","attributes":{},"text":"Showing 12"} | null |
| 1440, 1024, 390 | queue/2/1/6/1 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/6/1/0 | {"tag":"button","attributes":{},"text":"Next"} | null |
| 1440, 1024, 390 | queue/2/1/7 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/7/0 | {"tag":"span","attributes":{"aria-hidden":"true"},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/7/1 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/2/1/7/1/0 | {"tag":"span","attributes":{},"text":"stale"} | null |
| 1440, 1024, 390 | queue/2/1/7/1/1 | {"tag":"p","attributes":{},"text":"An item changed while this page was open. Reload to see it before deciding."} | null |
| 1440, 1024, 390 | queue/3 | {"tag":"footer","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/3/0 | {"tag":"details","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/3/0/0 | {"tag":"summary","attributes":{},"text":"Widget options"} | null |
| 1440, 1024, 390 | queue/3/0/1 | {"tag":"div","attributes":{},"text":""} | null |
| 1440, 1024, 390 | queue/3/0/1/0 | {"tag":"a","attributes":{},"text":"About this widget"} | null |
| 1440, 1024, 390 | queue/0/0/0 | null | {"tag":"h2","attributes":{},"text":"Queue"} |
| 1440, 1024, 390 | queue/0/0/1 | null | {"tag":"span","attributes":{},"text":"Checked 2026-09-28 14:02 UTC"} |
| 1440, 1024, 390 | queue/0/1/0 | null | {"tag":"template","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/1 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/1/0 | null | {"tag":"div","attributes":{"aria-label":"Queue category","aria-orientation":"horizontal","role":"tablist"},"text":""} |
| 1440, 1024, 390 | queue/0/1/1/0/0 | null | {"tag":"div","attributes":{"aria-selected":"true","role":"tab"},"text":""} |
| 1440, 1024, 390 | queue/0/1/1/0/0/0 | null | {"tag":"span","attributes":{},"text":"All 12"} |
| 1440, 1024, 390 | queue/0/1/1/0/1 | null | {"tag":"div","attributes":{"aria-selected":"false","role":"tab"},"text":""} |
| 1440, 1024, 390 | queue/0/1/1/0/1/0 | null | {"tag":"span","attributes":{},"text":"Decisions 5"} |
| 1440, 1024, 390 | queue/0/1/1/0/2 | null | {"tag":"div","attributes":{"aria-selected":"false","role":"tab"},"text":""} |
| 1440, 1024, 390 | queue/0/1/1/0/2/0 | null | {"tag":"span","attributes":{},"text":"Tasks 4"} |
| 1440, 1024, 390 | queue/0/1/1/0/3 | null | {"tag":"div","attributes":{"aria-selected":"false","role":"tab"},"text":""} |
| 1440, 1024, 390 | queue/0/1/1/0/3/0 | null | {"tag":"span","attributes":{},"text":"Alerts 3"} |
| 1440, 1024, 390 | queue/0/1/1/1 | null | {"tag":"div","attributes":{"role":"tabpanel"},"text":""} |
| 1440, 1024, 390 | queue/0/1/2 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/0 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/0/0 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/0/0/0 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/0/0/0/0 | null | {"tag":"span","attributes":{},"text":"Decision · Synapta prepared this for you"} |
| 1440, 1024, 390 | queue/0/1/2/0/0/0/1 | null | {"tag":"h3","attributes":{},"text":"Apply the vendor's revised delivery week to PO-1188"} |
| 1440, 1024, 390 | queue/0/1/2/0/0/0/2 | null | {"tag":"span","attributes":{},"text":"awaiting your decision"} |
| 1440, 1024, 390 | queue/0/1/2/0/0/0/3 | null | {"tag":"span","attributes":{},"text":"Prepared 2026-09-28 13:58 UTC · third version"} |
| 1440, 1024, 390 | queue/0/1/2/0/0/0/4 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/0/0/0/4/0 | null | {"tag":"span","attributes":{},"text":"Purchase order: PO-1188 · Ardent Supplies"} |
| 1440, 1024, 390 | queue/0/1/2/0/0/0/4/1 | null | {"tag":"span","attributes":{},"text":"Asked for by: Dana Reyes"} |
| 1440, 1024, 390 | queue/0/1/2/0/0/0/5 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/0/0/0/5/0 | null | {"tag":"button","attributes":{"aria-expanded":"false"},"text":"Reference"} |
| 1440, 1024, 390 | queue/0/1/2/0/0/0/6 | null | {"tag":"span","attributes":{},"text":"You decide on the proposal page, which lists every change it makes. Synapta checks the records again before anything is saved."} |
| 1440, 1024, 390 | queue/0/1/2/0/0/0/7 | null | {"tag":"button","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/0/0/0/7/0 | null | {"tag":"span","attributes":{},"text":"Review and decide"} |
| 1440, 1024, 390 | queue/0/1/2/1 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/0 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/0/0 | null | {"tag":"h4","attributes":{},"text":"Decisions"} |
| 1440, 1024, 390 | queue/0/1/2/1/0/1 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/0/1/0 | null | {"tag":"button","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/0/1/0/0 | null | {"tag":"span","attributes":{},"text":"Apply the vendor's revised delivery week to PO-1188"} |
| 1440, 1024, 390 | queue/0/1/2/1/0/1/1 | null | {"tag":"span","attributes":{},"text":"Selected · awaiting your decision · Prepared 2026-09-28 13:58 UTC · third version"} |
| 1440, 1024, 390 | queue/0/1/2/1/0/2 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/0/2/0 | null | {"tag":"button","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/0/2/0/0 | null | {"tag":"span","attributes":{},"text":"Approve the September cost allocation"} |
| 1440, 1024, 390 | queue/0/1/2/1/0/2/1 | null | {"tag":"span","attributes":{},"text":"snoozed · until 2026-09-29 08:00"} |
| 1440, 1024, 390 | queue/0/1/2/1/0/3 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/0/3/0 | null | {"tag":"button","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/0/3/0/0 | null | {"tag":"span","attributes":{},"text":"File the quarterly policy digest"} |
| 1440, 1024, 390 | queue/0/1/2/1/0/3/1 | null | {"tag":"span","attributes":{},"text":"running · preparing a proposal"} |
| 1440, 1024, 390 | queue/0/1/2/1/1 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/1/0 | null | {"tag":"h4","attributes":{},"text":"Tasks"} |
| 1440, 1024, 390 | queue/0/1/2/1/1/1 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/1/1/0 | null | {"tag":"button","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/1/1/0/0 | null | {"tag":"span","attributes":{},"text":"Reassign the Hansen delivery milestone"} |
| 1440, 1024, 390 | queue/0/1/2/1/1/1/1 | null | {"tag":"span","attributes":{},"text":"overdue · due 2026-09-30 · Raised by the mandate Milestone watch · 1 alert folded here"} |
| 1440, 1024, 390 | queue/0/1/2/1/2 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/2/0 | null | {"tag":"h4","attributes":{},"text":"Alerts"} |
| 1440, 1024, 390 | queue/0/1/2/1/2/1 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/2/1/0 | null | {"tag":"button","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/2/1/0/0 | null | {"tag":"span","attributes":{},"text":"Invoice INV-2099-438 was refused by the provider"} |
| 1440, 1024, 390 | queue/0/1/2/1/2/1/1 | null | {"tag":"span","attributes":{},"text":"unread · needs attention · Raised by Send approved invoices"} |
| 1440, 1024, 390 | queue/0/1/2/1/2/2 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/2/2/0 | null | {"tag":"button","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/2/2/0/0 | null | {"tag":"span","attributes":{},"text":"Email has not synced since 2026-09-27"} |
| 1440, 1024, 390 | queue/0/1/2/1/2/2/1 | null | {"tag":"span","attributes":{},"text":"read · Microsoft 365"} |
| 1440, 1024, 390 | queue/0/1/2/1/3 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/3/0 | null | {"tag":"span","attributes":{},"text":"Showing 6"} |
| 1440, 1024, 390 | queue/0/1/2/1/3/1 | null | {"tag":"button","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/2/1/3/1/0 | null | {"tag":"span","attributes":{},"text":"Load more"} |
| 1440, 1024, 390 | queue/0/1/2/1/4 | null | {"tag":"span","attributes":{},"text":"Stale · An item changed while this page was open. Reload to see it before deciding."} |
| 1440, 1024, 390 | queue/0/1/3 | null | {"tag":"div","attributes":{},"text":""} |
| 1440, 1024, 390 | queue/0/1/3/0 | null | {"tag":"button","attributes":{"aria-expanded":"false"},"text":"Widget options"} |

| Widths (px) | Style anchor | Property | Approved | Widget |
| --- | --- | --- | --- | --- |
| 1440, 1024, 390 | queue | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Times New Roman\"" |
| 1440, 1024, 390 | queue | font-size | "14px" | "16px" |
| 1440, 1024, 390 | queue | line-height | "21.7px" | "normal" |
| 1440, 1024, 390 | queue | display | "grid" | "block" |
| 1440, 1024, 390 | queue | position | "relative" | "static" |
| 1440 | queue | grid-template-columns | "1328px" | "none" |
| 1440, 1024, 390 | queue | row-gap | "12px" | "normal" |
| 1440, 1024, 390 | queue | column-gap | "12px" | "normal" |
| 1440, 1024, 390 | queue | padding-top | "24px" | "16px" |
| 1440, 1024, 390 | queue | padding-right | "24px" | "16px" |
| 1440, 1024, 390 | queue | padding-bottom | "24px" | "16px" |
| 1440, 1024, 390 | queue | padding-left | "24px" | "16px" |
| 1440, 1024, 390 | header | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Times New Roman\"" |
| 1440, 1024, 390 | header | font-size | "14px" | "16px" |
| 1440, 1024, 390 | header | line-height | "21.7px" | "normal" |
| 1440, 1024, 390 | header | position | "relative" | "static" |
| 1440, 1024, 390 | header | column-gap | "16px" | "8px" |
| 1440, 1024, 390 | header | padding-bottom | "8px" | "0px" |
| 1440, 1024, 390 | header | margin-bottom | "12px" | "0px" |
| 1440, 1024, 390 | title | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Schibsted Grotesk\", system-ui, sans-serif" |
| 1440, 1024, 390 | title | font-weight | "700" | "600" |
| 1440, 1024 | title | letter-spacing | "-0.24192px" | "normal" |
| 1440, 1024, 390 | checked | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Schibsted Grotesk\", system-ui, sans-serif" |
| 1440, 1024, 390 | checked | font-size | "13px" | "12px" |
| 1440, 1024, 390 | checked | line-height | "19.5px" | "16.8px" |
| 1440, 1024, 390 | tabs | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Times New Roman\"" |
| 1440, 1024, 390 | tabs | font-size | "14px" | "16px" |
| 1440, 1024, 390 | tabs | line-height | "21.7px" | "normal" |
| 1440, 1024, 390 | tab | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Schibsted Grotesk\", system-ui, sans-serif" |
| 1440, 1024, 390 | tab | line-height | "20.15px" | "14.3px" |
| 1440, 1024, 390 | tab | display | "flex" | "block" |
| 1440, 1024, 390 | tab | padding-top | "0px" | "8px" |
| 1440, 1024, 390 | tab | padding-bottom | "0px" | "8px" |
| 1440, 1024, 390 | grid | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Times New Roman\"" |
| 1440, 1024, 390 | grid | font-size | "14px" | "16px" |
| 1440, 1024, 390 | grid | line-height | "21.7px" | "normal" |
| 1440 | grid | grid-template-columns | "952px 352px" | "684px 684px" |
| 1440, 1024, 390 | focus | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Times New Roman\"" |
| 1440, 1024, 390 | focus | font-size | "14px" | "16px" |
| 1440, 1024, 390 | focus | line-height | "21.7px" | "normal" |
| 1440, 1024, 390 | focus | display | "block" | "flex" |
| 1440, 1024 | focus | position | "sticky" | "static" |
| 1440, 1024, 390 | focus | row-gap | "normal" | "12px" |
| 1440, 1024, 390 | focus | column-gap | "normal" | "12px" |
| 1440, 1024, 390 | card | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Times New Roman\"" |
| 1440, 1024, 390 | card | font-size | "14px" | "16px" |
| 1440, 1024, 390 | card | line-height | "21.7px" | "normal" |
| 1440, 1024, 390 | card | display | "grid" | "block" |
| 1440, 1024, 390 | card | position | "relative" | "static" |
| 1440 | card | grid-template-columns | "904px" | "none" |
| 1440, 1024, 390 | card | row-gap | "12px" | "normal" |
| 1440, 1024, 390 | card | column-gap | "12px" | "normal" |
| 1440, 1024, 390 | cardTitle | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Schibsted Grotesk\", system-ui, sans-serif" |
| 1440, 1024, 390 | cardTitle | font-size | "20.16px" | "24.192px" |
| 1440, 1024, 390 | cardTitle | line-height | "26.208px" | "30.24px" |
| 1440, 1024, 390 | kicker | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Schibsted Grotesk\", system-ui, sans-serif" |
| 1440, 1024, 390 | kicker | font-size | "13px" | "12px" |
| 1440, 1024, 390 | kicker | font-weight | "500" | "400" |
| 1440, 1024, 390 | kicker | line-height | "20.15px" | "16.8px" |
| 1440, 1024, 390 | kicker | display | "flex" | "block" |
| 1440, 1024, 390 | kicker | row-gap | "8px" | "normal" |
| 1440, 1024, 390 | kicker | column-gap | "8px" | "normal" |
| 1440, 1024, 390 | review | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Schibsted Grotesk\", system-ui, sans-serif" |
| 1440, 1024, 390 | review | padding-top | "0px" | "8px" |
| 1440, 1024, 390 | review | padding-bottom | "0px" | "8px" |
| 1440, 1024, 390 | rows | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Times New Roman\"" |
| 1440, 1024, 390 | rows | font-size | "14px" | "16px" |
| 1440, 1024, 390 | rows | line-height | "21.7px" | "normal" |
| 1440, 1024, 390 | rows | display | "block" | "flex" |
| 1440, 1024, 390 | rows | row-gap | "normal" | "12px" |
| 1440, 1024, 390 | rows | column-gap | "normal" | "12px" |
| 1440, 1024, 390 | row | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Schibsted Grotesk\", system-ui, sans-serif" |
| 1440, 1024, 390 | row | font-size | "14px" | "13px" |
| 1440, 1024, 390 | row | font-weight | "400" | "500" |
| 1440, 1024, 390 | row | line-height | "21.7px" | "14.3px" |
| 1440, 1024, 390 | row | display | "grid" | "inline-flex" |
| 1440, 1024 | row | grid-template-columns | "296px" | "none" |
| 1440, 1024, 390 | row | row-gap | "4px" | "8px" |
| 1440, 1024, 390 | row | column-gap | "4px" | "8px" |
| 1440, 1024, 390 | row | padding-top | "0px" | "8px" |
| 1440, 1024, 390 | row | padding-right | "0px" | "12px" |
| 1440, 1024, 390 | row | padding-bottom | "0px" | "8px" |
| 1440, 1024, 390 | row | padding-left | "0px" | "12px" |
| 1440, 1024, 390 | rowTitle | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Schibsted Grotesk\", system-ui, sans-serif" |
| 1440, 1024, 390 | rowTitle | font-weight | "600" | "500" |
| 1440, 1024, 390 | rowTitle | line-height | "20.15px" | "14.3px" |
| 1440, 1024, 390 | category | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Schibsted Grotesk\", system-ui, sans-serif" |
| 1440, 1024, 390 | category | font-size | "12px" | "13px" |
| 1440, 1024, 390 | category | font-weight | "600" | "500" |
| 1440, 1024, 390 | category | line-height | "18.6px" | "14.3px" |
| 1440, 1024, 390 | category | letter-spacing | "0.72px" | "normal" |
| 1440, 1024, 390 | category | text-transform | "uppercase" | "none" |
| 1440, 1024, 390 | category | display | "flex" | "block" |
| 1440, 1024, 390 | category | row-gap | "8px" | "normal" |
| 1440, 1024, 390 | category | column-gap | "8px" | "normal" |
| 1440, 1024, 390 | category | margin-bottom | "8px" | "0px" |
| 1440, 1024, 390 | pager | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Times New Roman\"" |
| 1440, 1024, 390 | pager | font-size | "14px" | "16px" |
| 1440, 1024, 390 | pager | line-height | "21.7px" | "normal" |
| 1440, 1024, 390 | pager | row-gap | "12px" | "8px" |
| 1440, 1024, 390 | pager | column-gap | "12px" | "8px" |
| 1440, 1024, 390 | pager | padding-top | "12px" | "0px" |
| 1440, 1024, 390 | next | font-family | "\"Schibsted Grotesk\", system-ui, -apple-system, \"Segoe UI\", sans-serif" | "\"Schibsted Grotesk\", system-ui, sans-serif" |
| 1440, 1024, 390 | next | font-size | "12px" | "13px" |
| 1440, 1024, 390 | next | line-height | "13.2px" | "14.3px" |
| 1440, 1024, 390 | next | padding-top | "0px" | "8px" |
| 1440, 1024, 390 | next | padding-right | "12px" | "16px" |
| 1440, 1024, 390 | next | padding-bottom | "0px" | "8px" |
| 1440, 1024, 390 | next | padding-left | "12px" | "16px" |
| 1024 | queue | grid-template-columns | "912px" | "none" |
| 1024 | grid | grid-template-columns | "536px 352px" | "476px 476px" |
| 1024 | card | grid-template-columns | "488px" | "none" |
| 390 | queue | grid-template-columns | "310px" | "none" |
| 390 | title | font-size | "20.16px" | "24.192px" |
| 390 | title | line-height | "25.2px" | "30.24px" |
| 390 | title | letter-spacing | "-0.2016px" | "normal" |
| 390 | grid | grid-template-columns | "310px" | "159px 159px" |
| 390 | card | grid-template-columns | "262px" | "none" |
| 390 | row | grid-template-columns | "254px" | "none" |
