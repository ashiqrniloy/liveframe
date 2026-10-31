---
date: 2026-10-31 14:38
status: approved
decision_about: "WebKit design-system switching cost: remedies, deferOffscreen style prop and budget statement"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Meet the WebKit switching budget with a realistic fixture, a `deferOffscreen` style prop and measured trims

## Decision

To meet CL-16, plan 021 Tasks 13.2 to 13.6 apply four remedies, in this order:

- **R1.** Both switching fixtures load the trusted primitive CSS that hosts ship.
- **R2.** A new token-constrained style prop, `deferOffscreen`, projects to `content-visibility:auto`, and the agent-home queue rows opt in. It ships in 0.2.1.
- **R3.** Projection trims are kept only on interleaved A/B evidence.
- **R4.** A renderer breakpoint attribute replaces `@container`. R4 runs only if WebKit span A max is still above 14 ms after R1 to R3.

The 16.67 ms budget is unchanged and bounds span A, the frame of the switch. Task 14's selector-doubling mutant is replaced by one that removes `deferOffscreen` from the fixture rows.

## Context

Task 13 showed that span A itself (attribute change through forced layout) misses 16.67 ms on WebKit. Task 14's first attempt asserted span A everywhere and failed WebKit at 25/17 ms (CSS/Surface fixtures). A follow-up interleaved decomposition (`plans/evidence/021-task-13-remedies.md`) found three parts:

1. **The CSS fixture is unrealistic.** `css-scope-browser.test.ts` loads no trusted primitive CSS. As a result, 102 icons render at 760×984 px, the switched section is about 106,000 px tall and no flex layout applies. Neither the proof host nor Clay renders that page. This accounts for about 6 ms in WebKit.
2. **The engine floor is 9/9/10 ms in WebKit** (p50/p90/max) for the same DOM and font switch with no Liveframe CSS. A design-system switch changes font metrics on about 1,000 nodes, so a full restyle and relayout is intrinsic. No projection change can go below it.
3. **Library overhead is about 2 ms median and 4–7 ms max above the floor.** It is spread across container-query deferral (1–4 ms), rule re-matching (about 1 ms) and typography restyle. Removing `var()`, `font-size-adjust` or `@scope` gave no measurable gain.

With primitive CSS and `content-visibility:auto` on the queue rows, WebKit measured 8/10/12 ms, the only variant with real margin. Chromium measured 3.5/4.3/6.7 ms and Firefox 5/6/7 ms.

## Approval

- Proposed by: agent, in plan 021 Task 13.1.
- Approved by user: Yes, on 2026-10-31.
- Approval evidence: in answer to three explicit questions, the owner chose:
  - "Approve as written (Recommended)" for R1–R4 with R4 gated at 14 ms, the budget statement and the mutant swap;
  - "Yes, in 0.2.1 (Recommended)" for shipping the prop in the patch;
  - "deferOffscreen (Recommended)" for the name.

  Before that, the owner asked to add "all of these as new sub tasks for task 13" and to "do each in the suggested order".

## The decisions

### R1: realistic fixture

`css-scope-browser.test.ts` and `react-browser.test.tsx` load the proof's `primitiveCss` (`proof/renderer/primitives/base.ts`) before the projected sheets, as a host does. This corrects the measured subject and does not weaken the budget. A test asserts that icon roots stay within their `1rem` box.

### R2: `deferOffscreen`

- **Values.** It accepts a declared `space.*` or `size.*` name, which sets the placeholder block size. It may take responsive values like every style prop. A raw length, an undeclared name, a non-string, or the prop on a definition that does not declare it fails validation with the existing typed style errors.
- **Projection.** Inline `content-visibility: auto` and `contain-intrinsic-block-size: auto var(--lf-v-…)`. It adds no rule to the design-system sheet.
- **Opt-in.** A catalog opts a primitive in by declaring the prop. The proof catalog declares it on `box`, and the agent-home queue row `Box` sets it.
- **What an author accepts by setting it,** recorded in spec §6.3 and `docs/styling.md`:
  - Paint containment clips overflow: focus rings with an outside offset, recipe shadows, the pressed offset and unportaled overlays. Top-layer elements and Liveframe portals escape.
  - The element becomes the containing block for absolute and fixed descendants, an independent formatting context, and has no baseline.
  - Placeholder and remembered heights are stale after a switch until the element renders, so scroll height can drift.
  - Work is deferred to scroll-in, not removed. WebKit still recalculates style for skipped content; only layout and paint are skipped.
  - Script geometry reads on skipped nodes force rendering.
  - Content stays focusable, selectable, in tab order and findable with find-in-page (MDN, `content-visibility: auto`). A conformance case checks focusability.
  - Engines without support ignore the property and behave as today.

### R3: projection trims

Each candidate is measured with `plans/evidence/021-task-13/interleave.ts`:

- the universal reset and `font:inherit` rules;
- duplicated typography declarations;
- `container-type` with no responsive rule in force.

A candidate is kept only with at least a 0.5 ms WebKit median gain and no regression in any engine.

### R4: container-query replacement (gated)

R4 runs only if WebKit span A max exceeds 14 ms in any of three consecutive focused runs after Task 13.5. If it runs, `<Surface>` sets `data-lf-bp` from a ResizeObserver, and the responsive layer selects on that attribute. That keeps spec §6.3's container-width semantics, at two costs:

- CSS-only and server-rendered output lose responsive values until script runs;
- each resize costs one extra style and layout pass.

### Patch reading

`deferOffscreen` is additive. Existing trees, results and exports are unchanged. A tree that uses it is rejected by 0.2.0 validators. That fits `docs/compatibility.md` ("Optional fields may be added"), and the 0.2.1 changelog states it.

### Budget statement

The budget is not raised. Spec §12 and §6.4 will say that 16.67 ms bounds span A: from the switching attribute change through style and layout of the switch frame. For a surface whose long repeated content is not marked `deferOffscreen`, no engine-independent bound is promised, because the engine's own restyle and relayout of about 1,000 font-changed nodes reaches 9–10 ms in WebKit with no library CSS. CL-16's answer to Clay states this and recommends `deferOffscreen` on long repeated content.

### Mutant

Task 14's "a CSS mutant that doubles selector work must fail under WebKit" is replaced. Selector work is about 1 ms, so doubling it is within noise. The replacement mutant removes `deferOffscreen` from the fixture rows, and it must fail Task 14's WebKit assertion.

### Bench subject

The render and CSS benches keep their budgets on the opted-in agent-home tree. Task 13.4 records before/after numbers.

## Alternatives Considered

1. **Selector or projection rewrites alone.** Rejected: measured headroom is about 2 ms, and earlier rewrite trials (`@scope`, `var()` removal, grouping, `font-size-adjust` removal) changed nothing measurable.
2. **A blanket `content-visibility` rule on a variant in app CSS.** Rejected: it applies to every instance, including ones where clipping harms, and it puts the library's proof outside its own validation.
3. **`contentVisibility` or `lazyLayout` as the prop name.** Rejected: the first leaks CSS vocabulary into the format, and the second is imprecise, because WebKit still recalculates style.
4. **Time-sliced switching, or a prerendered second copy.** Rejected: spec §6.4 requires an atomic switch that changes no node.
5. **A WebKit-only ceiling.** Rejected by Clay's acceptance and by `decision-logs/2026-10-30-0430-webkit-switching-budget-deferral.md`.
6. **A floor-relative or median assertion.** Not chosen now. It remains the fallback if Task 14 still misses after Task 13.6, and it would need a separate owner decision.
7. **Holding the prop to 0.3.0.** Rejected by the owner: Task 14 could not then close in 0.2.1 through R2.
8. **Running R4 unconditionally, or dropping it.** Rejected by the owner in favour of the measured gate.

## Rationale and Evidence

- Fixture realism removes a cost no host pays. In WebKit, `test` 17/19/20 ms became `prim` 11/14/17 ms in the quieter interleaved run.
- Only reducing synchronous work gets below the floor plus overhead with margin: `prim-cv` measured 8/10/12 ms in WebKit.
- In a loaded run (load 5.1 to 8.3), absolute values roughly doubled in every engine, but the ordering `test` > `prim` > `prim-cv` ≈ `prim-floor` held in WebKit, Chromium and Firefox.
- WebKit reports whole milliseconds, and its tails are load-sensitive. Acceptance runs must avoid concurrent VM or benchmark load.

## References

- `plans/evidence/021-task-13-remedies.md` — decomposition, both runs, regeneration.
- `plans/evidence/021-task-13/interleave.ts` — the committed interleaved probe.
- `plans/evidence/021-webkit-switching.md` — Task 13 diagnosis.
- `plans/evidence/021-task-14-switching.md` — Task 14's first attempt.
- `proof/renderer/primitives/base.ts:22` — trusted primitive CSS that sizes icons.
- `src/css/style-props.ts:36-86` — the style-prop mappings `deferOffscreen` joins.
- `docs/spec.md` §6.3 (`:205-224`), §6.4 (`:256`), §12 (`:766`); `docs/compatibility.md:7,60`.
- MDN (Context7 `/mdn/content`, read 2026-10-31): "Using CSS containment" § `content-visibility`; `contain-intrinsic-size` § auto.
- `decision-logs/2026-10-30-0430-webkit-switching-budget-deferral.md`; `decision-logs/2026-10-30-1914-release-0-2-1-scope-and-patch-content.md`.

## Consequences

- The positive outcome is a WebKit span A with real margin on realistic fixtures, and a documented, validated tool hosts can use on long surfaces.
- Spec §6.3 gains a row and a consequences paragraph. Spec §6.4 and §12 name span A. The style-prop set, schemas, SDK types, `list_primitives` and conformance all change.
- Parity must be re-proved after the rows opt in, including clipping checks on focus rings and shadows.
- Clay benefits only where it opts in. The CL-16 response says so.
- Revisit this decision if:
  - Task 14 still misses after Task 13.6 (then go to alternative 6);
  - parity cannot hold with deferred rows;
  - an engine drops accessibility exposure of skipped content.
