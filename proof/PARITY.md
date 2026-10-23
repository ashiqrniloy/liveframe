# Agent-home queue parity evidence

Re-proved by Plan 007 Task 10, 2026-10-24, using the published `/css` projection and scoped proof host. The pixel counts, 281 positional DOM differences and 32 sampled style differences exactly match the approved Plan 002 Task 8 capture (2026-10-22). The original approval and inventory below still apply.

**Result: the ≤ 1% pixel bar is met at all three widths.** Ten DOM causes and 32 style values remain, each with its reason and disposition below. The raw positional counts (281 DOM paths, 32 style values) are in the capture; the cause list is what the owner is asked to approve.

Regenerate from the repository root:

```bash
timeout 300 bun proof/scripts/parity.ts --out evidence/parity     # capture, diff, inventories
timeout 60 bun proof/scripts/inventory.ts --dir evidence/parity    # the same capture, grouped by cause
```

The first script starts two ephemeral localhost servers and headless Chromium, then closes them. It uses the existing Playwright dependency, browser Canvas for PNG decoding and diffing, and Bun for execution and file output. No image dependency or other runtime is added. If Chromium is absent, install it with `timeout 600 bunx playwright install chromium`. The second script reads the capture: no browser, no network.

Inputs: the verbatim `proof/references/synapta-core/design-artifacts/approved/agent-home-certified.html` from Synapta commit `fc6df4b3a68e117c10120276193717e7213b07bf`, queue section lines 1137–1245, and the unmodified `/ui/agent-home` ready/full fixture under Certified. Artifact SHA-256: `2a2a6579867b3ce77030583c3b0b8212a843323b2f1622200609ae168042e266`. Both show the same six initial subjects, default decision focus and totals 12/5/4/3. Data is synthetic; actions only log. The two artifact faces and their licences are snapshotted (`references/SOURCES.md`, Plan 002 Task 2).

Environment for the Plan 007 re-proof: Linux, Bun 1.4.4, Playwright 1.64.1, Chromium 156.0.8078.4. Each width uses a fresh browser context, height 1000 CSS px, device scale 1, light colour scheme, reduced motion, en-US and UTC. External network requests are blocked. Hydration, an explicit load of both artifact faces and `document.fonts.ready` complete before capture. Both faces must report loaded on both pages; any browser exception or HTTP failure fails the run.

At each width `W` the script writes only below gitignored `/evidence/`:

- `W-approved-page.png`, `W-widget-page.png`: unmodified full-page screenshots for context.
- `W-approved-queue.png`, `W-widget-queue.png`: queue-region screenshots at natural layout widths. Only the artifact's outside review bar and agent dock are made transparent during the region screenshot; their layout and the queue's styles stay intact.
- `W-pixel-diff.png`: magenta differing pixels, grey matching pixels, transparent outside both images.
- `W-dom.json`: both complete normalized element trees and every differing positional path.
- `W-styles.json`: both DOM/style snapshots and every above-threshold style difference at 18 corresponding anchors, covering 19 typography/layout/spacing properties.
- `summary.json`: versions, input hash, thresholds, counts and parity flags. No screenshots are committed.

Thresholds: a pixel changes if any RGBA channel differs by **more than 16/255**, or it exists in only one crop. A pixel mismatch ratio above **1%** fails. Numeric single-pixel CSS lengths differ by **more than 0.5px**; other computed values compare exactly. DOM tags, direct text, roles and non-ID-reference ARIA attributes compare exactly. Class names, inline CSS serialization, IDs and generated ARIA ID references are intentionally omitted. The DOM count is positional, not a minimum edit distance: one wrapper shifts every descendant, which is why 281 paths come from ten causes. Style anchors are a sampled correspondence, not every node or pseudo-element.

**Capture alignment (new in Plan 002).** A region drawn at a different fraction of a page pixel differs by 0.4% (0.03 px) to 3.7% (0.5 px) from sub-pixel glyph rasterisation alone, with identical layout and identical computed styles. The script therefore draws the widget region at the artifact's own page offset before capture, and records the origin in the snapshot. Without that alignment the same build measures ~2.2% at 1440 — a number that measures antialiasing, not look. The ink-coverage difference that remains is 0.23%.

## Results

| Viewport width | Approved region | Widget region | Changed / union pixels | Pixel mismatch | DOM paths | Style values | Pixel bar (≤ 1%) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1440px | 1376 × 978 | 1376 × 978 | 9712 / 1345728 | **0.72%** | 281 | 32 | Pass |
| 1024px | 960 × 977 | 960 × 978 | 7088 / 938880 | **0.75%** | 281 | 32 | Pass |
| 390px | 358 × 1610 | 358 × 1610 | 5572 / 576380 | **0.97%** | 281 | 32 | Pass |

Diagnostics (unsupported APIs, failed fonts, console errors): empty at every width. Region heights match the artifact's to 1 px or exactly.

## DOM differences, by cause

`bun proof/scripts/inventory.ts` collapses wrapper elements (a `div`/`span` with no attributes and no direct text) and compares the remaining semantic elements in order; it reports 24 divergent groups per width, which reduce to these ten causes. Nothing here is a missing primitive: each is either a markup choice of an existing primitive or a data shape the catalog does not carry.

| # | Cause | Approved | Widget | Disposition |
| --- | --- | --- | --- | --- |
| 1 | **Tabs are React Aria markup.** The tablist gains `aria-orientation="horizontal"`, a tab is a `div[role=tab]` rather than a `button[role=tab]`, the panel is always rendered, and the tab's count is part of its single label string | `div[role=tablist] > button[role=tab] > span(label) + span(count)` | `div[role=tablist] > div[role=tab] > span("All 12")` + `div[role=tabpanel]` | Accepted: the `tabs` primitive is React Aria, and its roles/keys are what the tier-1 keyboard test asserts. Tab widths differ by 4–6 px (G31), measured as ≤ 0.1% of the region |
| 2 | **Icons are inline glyphs.** An icon is `span[aria-hidden][role=img] > svg > path` or `circle` | `span[aria-hidden] > svg > use` | Accepted: glyphs are compiled host assets, inlined so the page needs no sprite. The wrapper's `role=img` + `aria-hidden` is the icon primitive's a11y contract |
| 3 | **A rule is a `separator` element.** The header's bottom rule and the rule above each row group and the decide block are `<hr role="separator">` | borders on `.section-head`, `.line` and `.decide` | Accepted: a real separator is accessible and comes from a primitive. The artifact's rule is a border and therefore no element |
| 4 | **Facts put text in a `span` and use one `dl` per column pair** | `dl > div > dt + dd` | `dl > dt > span` + `dd > span`, twice | Accepted: `text` is its own primitive, and the two column pairs are separate `terms` containers so each can be sized independently |
| 5 | **Prose is a text span.** A paragraph and the disclosure body's `a` + `code` are one text run | `p`, `a`, `code` | `span` | Accepted: the catalog has no paragraph, and a link inside a sentence would need rich text. G17 already records that the proof host has no proposal page |
| 6 | **An action is a button with an intent** | `a "Review and decide"` | `button > span "Review and decide"` | Accepted: law 4. Every control maps to a manifest action; the proof host has no navigation |
| 7 | **A group label renders a `span`** | `div "Decisions"` | `span "Decisions"` | Accepted: it is a `text` node; the group's margins live on its wrapper |
| 8 | **A button's label sits in its own slot** | `button "Next"` | `button > span "Next"` | Accepted: the `label` slot carries the button's typography role |
| 9 | **Widget options are a menu popup** | `details > summary + a` | `button[aria-expanded][aria-haspopup="true"]` | Accepted: the `menu` primitive is React Aria, so tier-1 open/arrow-key behaviour is exercised. The `disclosure` primitive covers the card's Reference row |
| 10 | **Marker spans carry `role="img"`** (rows and kickers) | `span[aria-hidden]` | `span[aria-hidden][role=img]` | Accepted: the icon primitive's contract, as cause 2 |

Row markers and the kicker glyph also draw in `currentColor` where the artifact tints them (G30); that is a colour difference, not a DOM one, and it is inside the pixel budget.

## Style values, by anchor

The capture compares 19 properties at 18 anchors. 32 values differ, identically at each width except the grid track sizes. Anchors are a sampled correspondence: after recomposition the same property often lives on a neighbouring node, and the pixel ratio is the authority on the look.

| Anchor(s) | Values | Reason |
| --- | --- | --- |
| `queue` (5: display, position, grid-template-columns, row-gap, column-gap) | `grid`/`block`, `1328px`/`none`, `12px`/`normal` | Anchor correspondence: the artifact's `section.plate` is the deck grid; the widget's section is the root box and its inner `stack` carries the same 12 px gaps. `position: relative` is not in the closed `position` enum (`static`/`sticky`) and has no visual effect, because nothing inside is absolutely positioned |
| `header` (4: position, row-gap, column-gap, padding-bottom) | `relative`/`static`, `8px`/`0`, `16px`/`0`, `8px`/`0` | Anchor correspondence: the widget's header is a block; the same 8/16 px gaps and 8 px bottom pad sit on its inner `inline`, and the rule is a separate `separator` |
| `tabs` (2: padding-left, padding-right) | `0`/`4px` | Intentional: 4 px side padding makes the four tabs wrap at 390 px exactly as the artifact's do (Plan 002 Task 6) |
| `grid` (2: display, grid-template-columns) | `grid`/`flex`, `952px 352px`/`none` | Intentional: a wrapping `inline` replaces the container-query grid because a query container made the design-system switch cost 26–44 ms under load (`GAPS.md`). The rendered columns still measure 952/352 and 536/352 |
| `focus` (3: display, row-gap, column-gap) | `block`/`flex`, `normal`/`12px` | Anchor correspondence: the widget's plate is a grid with a 12 px gap; the artifact's `.focus` is a block whose children carry margins |
| `card` (1: position) | `relative`/`static` | Not expressible, no visual effect: as the `queue` row above. Recorded for Phase 3 if surfaces need positioned children |
| `kicker` (3: display, row-gap, column-gap) | `flex`/`block`, `8px`/`normal` | Anchor correspondence: the anchor samples the kicker's `text`, whose gaps live on the wrapping `inline` |
| `row` (7: font-size, font-weight, line-height, display, grid-template-columns, row-gap, column-gap) | `14`/`13`, `400`/`600`, `21.7`/`20.15`, `grid`/`block`, `296px`/`none`, `4px`/`8px` | Anchor correspondence: the artifact's `.line` is the row grid; the widget's `box variant="rule"` holds a flex `inline` whose title carries `label.strong` (13/600), exactly as `.line__title` does. The flex marker/body composition retains `.line`'s 16/296 columns, including the trailing gap when no flag is present |
| `rowTitle` (1: display) | `block`/`inline` | Anchor correspondence: the label span inside the ghost title button |
| `category` (4: display, row-gap, column-gap, margin-bottom) | `flex`/`block`, `8px`/`normal`, `8px`/`0` | Anchor correspondence: the 8 px bottom margin and the gaps sit on the label's wrapper, not on the `text` node the anchor samples |

## Projection integration (Plan 007 Task 10)

The host loads base and app-owned primitive CSS plus both theme sheets and both design-system sheets. Scope attributes select the pair; switching suppresses transitions and preserves tree, classes, nodes and focus. React Aria portals stay inside the same scope. `proof/css/project.ts` only adapts `/css` helpers. QueueRow uses the SDK port's flex composition, with conditional trailing padding preserving the empty third grid track's gap. Exported and SDK trees now compare directly; the 679-node benchmark is unchanged.

The capture's `parity: false` field means exact DOM/style equality; its pixel ratios all pass. Its remaining DOM/style differences are the approved inventory above. No new agent-home deviation was introduced. Rack has no pixel target; its scrollbar now follows the theme's native `color-scheme` instead of the proof projector's hard-coded `surface.scrollbar` styling, as accepted in Plan 007.

## Approval

**Approved 2026-10-22 by the owner.** The ten DOM causes and the 32 style values above are intended differences, not failures, and each names why it exists and which phase owns it. The pixel bar (≤ 1%) was met at all three widths, which is the look's authority; this list is what "every intentional deviation is listed" (§12) means for the agent-home queue.

Recorded in `decision-logs/2026-10-22-1519-phase-0-go.md` and `proof/REPORT.md` §8.
