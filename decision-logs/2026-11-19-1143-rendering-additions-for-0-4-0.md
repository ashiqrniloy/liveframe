---
date: 2026-11-19 11:43
status: approved
decision_about: "The 0.4.0 rendering additions: pending sources, design-system motion, windowing and the DOM adapter"
proposed_by: agent
explicitly_approved_by_user: true
---

# Decision: Four rendering additions for 0.4.0, with CSS-driven motion and a `/dom` adapter

## Decision

`0.4.0` adopts the rendering design in `plans/evidence/038-rendering-design.md`:

- **F5:** an opt-in `pending` source outcome (`sourceOutcome(result, { pending: true })`) and a new `source-pending` host event.
- **F6:** a rest-only, root-only recipe property `motion` (`none | fade | move | fade-move`), projected as CSS transitions (`@starting-style` enter, a kept inert element for exit, FLIP on `translate` for move) and assisted by one adapter helper shared by `/react` and `/dom`. The View Transition API is not used.
- **F7:** windowing with no library change. The starter `scroll` gains `itemCount`, `itemStart`, `itemSize`, `step` and `onRange`, and reserves the off-tree space itself.
- **F8:** `@arnilo/liveframe/dom` (`createDomRenderer` → `mount`, `implement(definition, draw)`, `place`) with `/conformance/dom`. It ships no custom element and the starter gets no DOM implementations. The spec §14 non-goal it lifts was lifted on 2026-11-15 (`decision-logs/2026-11-15-1251-review-2026-11-15-scope.md`).

## Context

The 2026-11-15 review placed findings F5–F8 in `0.4.0`. Plan 038 Task 1 required one design, approved before any of them is built, because F6 and F8 both change what a renderer adapter must do, and F8's conformance suite must carry F6's cases. The design states for each item its forms, validation rules, 0.3.x behaviour, spec text, budget and a paragraph per law.

## Approval

- Proposed by: agent (`plans/evidence/038-rendering-design.md`)
- Approved by user: Yes
- Approval evidence: on 2026-11-19 the owner answered three questions.
  - On the design (F5–F8 as summarised): "Approve (Recommended)".
  - On the F6 mechanism: "CSS + adapter helper (Recommended)", rather than the View Transition API or enter-only.
  - On the F8 scope trims (no custom element, no starter DOM implementations): "Agree (Recommended)".

## Alternatives Considered

1. **`pending` on every `sourceOutcome`.** Rejected: it changes every existing capability document's schema and hash, and every widget's inferred union.
2. **Reporting a pending answer as `source-failed`.** Rejected: a pending answer is the host's own choice, not a failure.
3. **The View Transition API driven by the adapter, or React `<ViewTransition>`, for motion.**
   - Rejected for the floor: same-document View Transitions need Firefox 144+, above the Baseline 2024 floor (spec §6.4), and React's component is stable only from 19.3.0, above the `react ^19.0.0` peer floor.
   - Rejected for behaviour: a View Transition captures the whole document, blocks input while it runs, and only one can run per document. Its pseudo-elements cannot be scoped to a design system. React's component also needs every host update inside `startTransition`.
4. **Both mechanisms.** Rejected: two code paths with different floors, and no case that only View Transitions serve.
5. **Enter motion only for 0.4.0.** Rejected by the owner in favour of full enter, exit and move.
6. **Spacer nodes sized by the widget, a library `list` primitive, a higher node limit, or React Aria's `Virtualizer`.**
   - Spacer nodes: style props take only design-value names, never arbitrary lengths (law 3).
   - A `list` primitive: product-shaped.
   - A higher node limit: cost grows with nodes on the backend, the wire and the browser.
   - `Virtualizer`: it needs the whole collection in memory.
7. **A custom-element wrapper and starter DOM implementations for `/dom`.** Rejected: the wrapper only plumbs object options and registering it is a global side effect, and re-implementing React Aria behaviours by hand is product work outside this plan.

## Rationale and Evidence

- **Opt-in, at no cost when unused.** Every addition is opt-in (per source, per recipe, per `scroll` node, per import). A host using none pays nothing measurable: F6 costs one cached computed-style read per surface per design-system identity. A design system without `motion` projects byte-identical CSS.
- **0.3.x fails closed.** A 0.3.x consumer treats a `pending` answer as `failed`, rejects a design system with `motion` (closed recipe properties), and never sees the new subpaths.
- **Law 3 holds for motion.** The tree and the SDK gain nothing for it. `--lf-m` takes only library keywords, the inline `translate` takes only measured numbers, and no element name is assigned.
- **Law 4 holds for motion and pending.** An exiting element is `inert`, and a pending envelope carries no text or value.
- **Laws 1 and 2 hold for `/dom`.** `/dom` sets no `innerHTML`, evaluates nothing, and draws only the contexts the core built from validated trees. The shared conformance case for `setLocal` forwarding runs against it.
- **Each DOM rule exists once.** The DOM-touching renderer rules (focus continuity, focus mark, switching, motion, the registry check) move into shared framework-free modules both adapters import.

## References

- `plans/evidence/038-rendering-design.md`: the full design (rules `P.*`, `M.*`, `W.*`, `D.*`).
- `plans/038-Phase-7-Part-Y-Rendering-Capabilities.md`: Tasks 2–6, amended to this design.
- `decision-logs/2026-11-15-1251-review-2026-11-15-scope.md`: scope, and the lifted §14 non-goal for F8.
- MDN browser-compat-data `api/Document.json` (`startViewTransition`: Chrome 111, Firefox 144, Safari 18); MDN `view-transition-class`, `view-transition-name`, `Element.moveBefore()` and scroll anchoring (fetched with Context7 on 2026-11-19).
- [react.dev `<ViewTransition>`](https://react.dev/reference/react/ViewTransition) and the React changelog (19.3.0, 2026-09-09, adds `<ViewTransition />`); the installed React is 19.3.1.
- [React Aria `Virtualizer`](https://react-aria.adobe.com/Virtualizer): `ListLayout` with `rowSize` or `estimatedRowSize` over a full collection.
- `docs/spec.md` §6.2, §6.4 (Baseline 2024 floor), §7.1, §7.7, §11, §13, §14; `src/host/render.ts:22-111`; `src/css/design-system.ts:143-208`; `src/css/recipe.ts:12-13`; `src/css/base.ts:33-36`.

## Consequences

- **Tasks 2–6 build to the design.** Task 3 adds `src/dom/motion.ts` (internal until Task 5). Task 4 replaces spacer nodes with primitive-reserved space. Task 6 drops the custom element and runs `/conformance/dom` against a fixture registry.
- **Risk: the kept exit element.** Re-inserting the element React removed relies on React tolerating a foreign sibling. It is pinned by a browser test on React 19.0 and 19.3, and a failure there reopens the exit mechanism.
- **Risk: the pressed offset.** During a move, the inline `translate` overrides the pressed offset. This is documented.
- **When to revisit.** Revisit F6 when the platform floor rises to include View Transitions and element-scoped transitions become available in all three engines.
