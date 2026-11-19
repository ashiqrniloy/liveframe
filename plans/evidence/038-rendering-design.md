# 038 Rendering design: pending sources, design-system motion, windowing and the DOM adapter

Design for plan 038 Task 1 (`0.4.0`). Covers findings F5–F8 of the 2026-11-15 review (`plans/evidence/033-review-findings.md`, scope in `decision-logs/2026-11-15-1251-review-2026-11-15-scope.md`, which already lifts the spec §14 non-goal for F8). Extends `docs/spec.md` §6.2, §6.4, §7.1, §7.7, §11, §13 and §14. Rules are numbered per item (`P.*` pending, `M.*` motion, `W.*` windowing, `D.*` DOM adapter) so Tasks 2–6 can cite them.

Documentation checked on 2026-11-19 with `find-docs` (Context7): MDN content and browser-compat-data (`document.startViewTransition`, `view-transition-name`, `view-transition-class`, `Element.moveBefore`, `overflow-anchor`), react.dev `<ViewTransition>` and the React changelog, and React Aria's `Virtualizer`/`ListLayout`.

---

## Summary of open questions (with decisions and reasons)

| Item | Question | Decision | Reason |
| --- | --- | --- | --- |
| **F5** | Is `pending` opt-in per source? | **Yes:** `sourceOutcome(result, { pending: true })` adds a closed, empty `pending` variant. | Without the option the schema, the capability documents, their hashes and every widget's inferred union stay byte for byte as in 0.3.0. A source that cannot be slow never makes its widgets handle a status they will not see. |
| **F5** | Does a pending answer raise an event? | **Yes, a new `source-pending` `HostEvent`** (`placementId`, `alias`, `source`), never `source-failed`. | A pending answer is the host's own decision, not a failure; counting it as `source-failed` would pollute failure dashboards. §7.7 already says the event set may grow in a minor. |
| **F6** | Which mechanism carries motion? | **CSS transitions driven by the projection, with a small adapter helper shared by `/react` and `/dom`.** Enter uses `@starting-style`, exit keeps the removed element for its transition, and move animates `translate` from the old box (FLIP). **No View Transition API.** | Everything used is on the Baseline 2024 floor (spec §6.4) in all three engines. View Transitions need Firefox 144+, so they are above the floor. They snapshot the whole document and block input while they run, allow one transition per document, and their pseudo-elements cannot be scoped to a design system. React's `<ViewTransition>` is stable only from 19.3.0, above the `react ^19.0.0` peer floor, and needs every host update inside `startTransition`. Details in §2.2. |
| **F6** | How are elements named without widget input? | **They are not named.** The adapter finds a node's element by its `domId` inside the surface's wrapper or portal container, as the focus mark does. No `view-transition-name` or other name is assigned. | Without View Transitions nothing needs a name, so no identifier derived from tree data reaches CSS. |
| **F7** | Does windowing need a library change? | **No.** It needs a starter change: `scroll` gains `itemCount`, `itemStart`, `itemSize`, `step` and `onRange`. The primitive reserves the space for rows outside the tree. | The plan's "two sized spacer nodes" cannot be written: style props take only design-value names, never arbitrary lengths (spec §6.3, law 3). The trusted implementation can multiply a declared `size.*` value. Rows keep their ids, so `diffTrees` and node reuse already keep their DOM nodes. |
| **F8** | What is `/dom`'s public surface? | **`createDomRenderer({ catalog, implementations } \| { catalogs })` → `{ mount }`; `mount(container, options)` → `{ update, set, dispose }`; `implement(definition, draw, hooks?)`; `place(parent, nodes)`.** | It mirrors `/react` (one registry check, one surface per mount) and adds nothing the core does not already decide. |
| **F8** | How are implementations written without a framework? | **`draw(node, element?)` creates an element when `element` is undefined and otherwise updates and returns the one it was given.** The adapter calls it only for nodes whose core context changed. | It is the smallest contract that keeps elements across revisions: unchanged contexts keep their elements without a call, and implementations need no virtual DOM. |
| **F8** | Which `/react` duties does it take on? | **All of them:** error containment per node, the scoped portal, focus continuity, the focus mark, style switching, `invalid="keep-last"` and motion. The DOM-touching rules (focus continuity, focus mark, switching sequence, motion) move into `src/dom/` modules that `/react` imports too. **Not SSR or hydration.** | Spec §11 states these duties for every renderer, not only React's. One implementation of each DOM rule keeps the two adapters from drifting. `/dom` is client-only, and a page that needs SSR uses `/react`. |
| **F8** | Custom element wrapper? Starter DOM implementations? | **Neither.** The guide shows a ten-line custom element over `mount`, and `/conformance/dom` runs in CI against a fixture registry in `src/__tests__/fixtures/`. | A custom element would only plumb object-valued options (validator, callbacks) through properties, and registering it is a global side effect. The starter's primitives are React Aria behaviours, and re-implementing them without a framework is product work outside this plan. |

---

## 1. F5 — A source may answer `pending`

### Form

```ts
// src/schema.ts
export function sourceOutcome<const S extends LanguageSchema, const P extends boolean = false>(
  result: S,
  options?: { readonly pending?: P },
): /* union("status", { ok, unauthorized, unavailable, stale, failed } & (P extends true ? { pending } : {})) */
```

- **P.1 Envelope.** With `{ pending: true }` the mapping gains `pending: obj({})`: a closed object whose only field is the discriminator, `{ status: "pending" }`. It has no `value` and no `reason`. Without the option, or with `pending: false`, the returned schema is the 0.3.0 one byte for byte. `canonicalJson`, and so the capability document's hash, are unchanged.
- **P.2 Resolver answer.** `SourceResult` gains `{ ok: false, reason: "pending" }`. `sourceResult()` (`src/host/render.ts:35-50`) accepts it only when the raw object has no `value` property. A pending answer that carries a `value` counts as `{ ok: false, reason: "failed" }`, so a resolver cannot smuggle data past the schema fit. A `message` on a pending answer is dropped and never reaches the widget.
- **P.3 Fit (R5).** `envelope()` turns `pending` into `{ status: "pending" }` when the source's schema maps `pending`. A source that does not declare the variant fails the render at `/data/<alias>` (`render-failed`, "Source failed"), exactly as an undeclared failure does today (§7.7 rule 4).
- **P.4 Event.** Every pending answer raises `{ type: "source-pending", placementId, alias, source }` and never `source-failed`. If the source does not declare the variant, `render-failed` follows.
- **P.5 Skipping (R6).** `renderKey` digests `data`, and `{ status: "pending" }` differs from any resolved value, so the render after the value arrives is never skipped. No change is needed, and Task 2's test pins it.
- **P.6 Types.** `liveframe gen` derives types from the schema (`src/sdk/gen.ts:24-35`, `:392-408`), so the `pending` member appears only for sources that declare it. A widget that reads `data.rows.value` without narrowing on `status` fails to compile, as it already does for the failure variants.

### What a 0.3.x consumer does

A capability document that declares the variant is still a valid 0.3.x document: a union may carry any tag. A 0.3.x `renderPlacement` given `reason: "pending"` treats it as `failed` because it is not in `FAILURES`. The widget sees `{ status: "failed" }`, or the render fails when the source has no envelope. That is fail-closed. The new event is ignored by handlers that do not know it, as §7.7 requires.

### Spec text (§7.1 after the `Capabilities` block; §7.7 rule 4, Events)

> `sourceOutcome(result, { pending: true })` adds a `pending` variant, `{ status: "pending" }`, with no value and no reason: the host answers `{ ok: false, reason: "pending" }` for a source it has not read yet, the widget draws a placeholder, and the host renders the placement again when the value arrives (`dependents`). Without the option the envelope is unchanged.
>
> §7.7 rule 4, appended: "A `pending` answer is shown only to a source that declares the variant, carries no text, and an answer that also carries a `value` counts as `failed`."
>
> Events: add `source-pending` to the list.

### What stays the app's

Timing, fetching, caching the value, and the transport that pushes the second render. The documented loop (Task 2, `docs/host.md`): `resolve` answers `pending` and starts the read. When the read lands, the host stores the value, calls `dependents(placements, { source, params })` and calls `renderPlacement` again for each id. That render has a new key, and the host sends its `patch`. No timer, queue or subscription enters the library (§7.7 rule 1).

### Budget

A source without the option costs nothing: the only new work is one string comparison in `sourceResult`. `bench/host.bench.ts` stays within its 0.2 ms overhead budget.

### Laws

- **Law 1:** nothing runs in the browser; the variant is data.
- **Law 2:** the envelope is fitted to the source's `result` schema like every value.
- **Law 3:** not touched.
- **Law 4:** the widget learns only a status. The host's reason for the delay and any value it attached never reach the widget (P.2), and the widget gains no way to ask for a read.

### Tests Task 2 writes

`pending_answer_becomes_the_envelope_when_declared`, `pending_answer_fails_the_render_when_not_declared`, `pending_then_resolved_is_not_skipped`, `pending_answer_with_a_value_is_treated_as_failed`, `pending_answer_raises_source_pending_not_source_failed`, `source_outcome_without_the_option_is_unchanged` (deep-equal and canonical-JSON-equal to the 0.3.0 shape), and type-level `unnarrowed_value_read_fails_to_compile`.

---

## 2. F6 — Enter, exit and move motion from the design system

### 2.1 The recipe property

```jsonc
"listItem.default.root.rest": { "transitionDuration": "motion.short", "transitionTiming": "standard", "motion": "fade-move" }
```

- **M.1 Values.** `motion` is one of `none`, `fade`, `move` or `fade-move`, a closed enum fixed by the library:
  - `fade`: the node enters from `opacity: 0` and exits to `opacity: 0`.
  - `move`: when the node's box moves because its parent's children changed, it slides from the old box to the new one.
  - `fade-move`: both.
  - `none`: lets a variant switch off a wildcard's motion.
- **M.2 Where it may appear.** `motion` is accepted only on a `root` slot's `rest` recipe, because the element the adapter finds by `domId` is the node's root. On any other slot or state it is `invalid-document` at `/recipes/<key>/motion`, the same rule as the rest-only scrollbar colours. A value outside the list is `invalid-document` at the same pointer (`designSystemSuite` case `motion_value_outside_the_list_is_invalid_document`).
- **M.3 Duration.** Motion reuses the recipe's existing `transitionDuration` and `transitionTiming`. A resolved root rest recipe whose `motion` is not `none` but has no `transitionDuration` is `invalid-document` at `/recipes/<key>/motion` ("motion needs a transition duration"). Without that check the motion would silently never play.
- **M.4 Cascade.** `motion` merges through the cascade and `extends` like any scalar recipe property (layers 1–3 only, since it is rest-only), using the same resolver path (`src/formats/fixed.ts:143-170`, `src/resolve.ts`).

### 2.2 Mechanism: why not View Transitions

| | CSS transitions + adapter helper (chosen) | View Transition API (`document.startViewTransition`, adapter-driven) | React `<ViewTransition>` |
| --- | --- | --- | --- |
| Platform floor (Baseline 2024) | `@starting-style`, `@property`, `inert` and CSS transitions are all on the floor in Chromium, Firefox and WebKit | Chrome 111, Safari 18, **Firefox 144**: above the floor. `view-transition-class` is newer still | React ≥ 19.3.0 (stable 2026-09-09). The peer floor is `^19.0.0` |
| Scope | Per element, inside the surface | The whole document is captured; pointer input goes to the transition root while it runs | Same as View Transitions |
| Concurrency | Independent per surface | One transition per document: a host's or another surface's transition aborts ours, and React ≥ 19.3 interrupts non-React ones | React batches; any `flushSync` skips the transition, and a plain prop update (not in `startTransition`) does not animate |
| Design-system scoping | Rules live under `:where([data-lf-ds=…])` like every recipe rule | `::view-transition-group(.x)` lives on the document root and cannot be scoped. Two design systems over one catalog share slot classes, so they would collide | Same as View Transitions |
| `/dom` adapter | Same helper | Its own `startViewTransition` wiring | Not usable |
| Windowed list (F7) | Only the moved rows animate | Every range change captures the page | Same as View Transitions |

"Both" was rejected because it means two code paths with different floors and no case that only View Transitions can serve here.

### 2.3 Projection (`src/css/design-system.ts`, `src/css/recipe.ts`)

For a slot whose resolved root rest recipe sets `motion` other than `none`, with `S` = `:where([data-lf-ds="<id>@<version>"][data-lf-motion])` and `C` = the slot class:

- **M.5 Marker.** The rest rule gains `--lf-m:<value>`. The sheet gains `@property --lf-m{syntax:"*";inherits:false}`, so a child never inherits its parent's marker. The scope rule gains `--lf-motion:1`, so the adapter can ask the wrapper once whether this design system uses motion at all.
- **M.6 Enter (`fade`, `fade-move`).** `@starting-style{S C{opacity:0}}`. The browser runs it when the element is first styled, and only once the wrapper carries `data-lf-motion`.
- **M.7 Exit (`fade`, `fade-move`).** `S C:where([data-lf-exiting]){opacity:0}`.
- **M.8 Move** needs no extra rule. `translate` is already in the projected `transition-property` list (`src/css/recipe.ts:12-13`).
- **M.9 Byte identity.** A design system that sets no `motion` emits none of the above, so its sheet is byte-identical to 0.3.0 (Task 3's `system_without_motion_projects_identical_css`). The base sheet does not change.
- **M.10 Environment.** `prefers-reduced-motion: reduce` already forces `transition-duration:0s` (`src/css/base.ts:33`) and `data-lf-switching` forces `transition:none` (`:36`). With a zero duration, enter shows at once, exit removes at once (M.13) and move does nothing. Forced colours are not affected, because opacity and translate carry no colour.

### 2.4 The adapter helper (`src/dom/motion.ts`, used by `/react` and `/dom`)

- **M.11 Gate.** After the commit that first draws a tree, the adapter sets `data-lf-motion` on the wrapper and the portal container. The first tree a surface draws, including a hydrated one, therefore never animates in, the same rule as the focus mark. A surface whose `surfaceId` changes removes the attribute for that commit and sets it again afterwards.
- **M.12 Does this design system use motion?** The adapter does no motion work until a commit removes children or changes the order of a parent's children. It then reads `getComputedStyle(wrapper).getPropertyValue("--lf-motion")` once and caches the answer per design-system identity. A design system without motion costs one style read per surface per identity and nothing else.
- **M.13 Exit.** Before the commit, the adapter records for each node leaving the drawn tree its element (found by `domId` inside the wrapper or portal), the element's parent and its next sibling, provided `--lf-m` on that element (one computed-style read) includes `fade`. After the commit, it puts the detached element back before the recorded sibling, or appends it to the recorded parent if that sibling is gone. It then sets `data-lf-exiting`, `inert` and `aria-hidden="true"`, so the element takes no input and is hidden from assistive technology. The element is removed on `transitionend`/`transitioncancel` for `opacity`, or after a timer of the computed `transition-duration` + `transition-delay`, whichever comes first, and at once when that duration is zero. An element whose recorded parent was itself removed is not kept. If an arrival adds a node with the same `domId` back, the exiting element is removed at once. The element React or `/dom` removed is the one put back, and nothing is cloned. React tolerates a foreign sibling in a parent it manages, and Task 3's browser test pins this on React 19.0 and 19.3.
- **M.14 Move.** For each parent whose drawn child-id sequence changed (insert, remove or reorder), the adapter reads before the commit the bounding box of each child whose `--lf-m` includes `move`. After the commit it reads the box again. For each child whose box moved, it sets inline `translate: <dx>px <dy>px` and `transition: none`, forces one style flush, then clears both, so the recipe's own transition animates `translate` back to its rest value. Removing an exiting element (M.13) counts as a change of its parent's children, so its siblings close the gap smoothly. In `/react` the pre-commit reads happen in a class boundary's `getSnapshotBeforeUpdate` (the same moment React's own View Transition support measures) and the post-commit work in `componentDidUpdate`. In `/dom` they wrap the adapter's own mutation.
- **M.15 Known interaction.** During a move, the inline `translate` overrides the recipe's pressed offset (`translateY`), which uses the same property. The overlap is a row being pressed at the moment its siblings reorder, and it lasts one transition. It is documented, not engineered around.
- **M.16 No new option.** `<Surface>` and `mount` gain no option for motion. A host that wants none uses a design system without it, and a user who wants none sets reduced motion.

### 2.5 Amended at execution (plan 038 Task 3, 2026-11-19)

Browser tests in all three engines and the motion bench changed how M.11–M.16 are carried out. The rules, the forms and the laws above still hold.

- **Exit and move are Web Animations, played in the next animation frame (M.13, M.14).** In the first version, exits were CSS transitions and moves were a FLIP on inline `translate`. That forced three style recalculations inside the commit: +10.9 ms in Chromium on the budget case. Now the commit only reads the style and boxes the last frame computed. The next frame's callback runs before that frame's style, layout and paint. It puts each kept element back, fades it with `element.animate` from its read opacity to 0, and slides moved siblings with `element.animate({ translate }, { composite: "add" })`. Both use the recipe's computed `transition-duration`, `transition-delay` and `transition-timing-function`. Nothing is written to inline style. A second commit in the same frame plays the pending plan first. The projected `[data-lf-exiting]{opacity:0}` rule remains the exit's end state.
- **A reorder must not replay the enter.** React reorders by re-inserting an element, which restarts its style, so `@starting-style` faded rows in again when they had only moved. Before the commit, the adapter marks each staying sibling whose `--lf-m` includes `fade` with `data-lf-stay`. The enter rule is `@starting-style{S C:where(:not([data-lf-stay],[data-lf-stay] *)){opacity:0}}`. The mark is never removed, because the element's only later re-insertion is another reorder.
- **Switching plays no motion explicitly.** `data-lf-switching` is set one layout effect after the commit that changes the theme. WebKit then let an exit started in that commit run to its end, because the transition was not cancelled. `<Surface>` now passes `switching` (requested scope differs from applied scope) to the motion boundary. That commit plays nothing, and every running exit and slide ends at once.
- **Exit durations are read before the commit** from the same computed style as `--lf-m`. A zero duration (reduced motion, or switching) keeps nothing.
- **The bench is `bench/motion.bench.ts`.** `bench/streaming.bench.ts` drives Chromium over CDP only, and the budget also asks for WebKit and Firefox numbers. The gate is the commit: Chromium production +0.4 ms against 2 ms. The work moved to the next frame is recorded beside it, not gated (Chromium about 3 ms for 20 exits and 50 slides).
- **For Tasks 5–6:** `/dom` calls `createMotion().before` before its own mutation and `after` after it. It passes `halt` on a theme switch and `dispose` on unmount. `/conformance/dom` reuses `src/__tests__/react-motion-browser.test.tsx`'s cases.

### What a 0.3.x consumer does

A 0.3.x validator rejects a design system that sets `motion` with `invalid-document` at `/recipes/<key>/motion` (closed recipe properties): fail-closed, as `docs/compatibility.md` allows for a minor. A 0.3.x adapter given a 0.4.0 sheet with motion never sets `data-lf-motion`, so no motion rule matches and it draws as today.

### Spec text

- §6.2 Recipe properties, appended: "…and motion (`none`, `fade`, `move`, `fade-move`: rest-only, root slot only, and requiring a transition duration)."
- §6.2 Entry motion becomes "Entry and exit motion": the `open` sentence stays, and this is added: "A root slot whose recipe sets `motion` enters from `opacity: 0` when a later revision inserts it, exits to `opacity: 0` before it is removed, and slides from its previous box when its siblings change, each with its own transition. The renderer keeps an exiting element, inert and hidden from assistive technology, until its transition ends (§11)."
- §6.4 Preferences: "Reduced motion and switching remove every motion, because each one is a transition."
- §11 renderer duties, appended: "**Motion.** After the first drawn tree, the adapter sets `data-lf-motion` on the wrapper and portal container. It keeps an exiting element and animates moved siblings as §6.2 describes, finding elements by `domId` inside the surface only."

### Budget

- **Without motion:** the CSS bytes are unchanged. Commit cost is unchanged apart from M.12's one cached read, and `bench/streaming.bench.ts --production` stays inside its existing gate.
- **With motion:** for a commit that removes 20 rows and moves 50 under one parent, the added commit time is at most **2 ms** in Chromium in the production profile (100 box reads + 70 style reads + one forced flush). It is measured and gated in `bench/streaming.bench.ts` (Task 3). The WebKit and Firefox numbers are recorded, not gated.

### Laws

- **Law 1:** no widget code runs. The adapter helper is library code.
- **Law 2:** the tree gains nothing. Motion follows nodes a validated arrival added, removed or reordered.
- **Law 3:** widget code cannot request, shape or time motion. The value is a closed keyword the design system sets, and durations and easings are design values. No author-controlled string reaches a CSS property: `--lf-m` takes one of four library keywords, and the inline `translate` takes two numbers the adapter measured. The adapter assigns no names, so no prop, id or `domId` reaches CSS.
- **Law 4:** an exiting element is `inert`, so a removed node can raise no intent, and its old contexts would be refused by the host's `checkOffered` anyway.

### Tests Task 3 writes

`system_without_motion_projects_identical_css`, `motion_value_outside_the_list_is_invalid_document`, `motion_outside_root_rest_is_invalid_document`, `motion_without_duration_is_invalid_document`, `first_tree_plays_no_enter`, `removed_row_plays_its_exit_before_it_is_gone`, `exiting_row_is_inert_and_hidden`, `reordered_row_moves` (browser, all three engines), `reduced_motion_removes_every_added_motion`, `switching_theme_plays_no_motion`, `react_tolerates_the_kept_element` (React 19.0 and 19.3).

---

## 3. F7 — Windowing long collections

- **W.1 No library change.** Ids are key paths (`root/list/row:4812`), so a row present in two windows keeps its id. `diffTrees` emits `insert`/`remove` for rows that enter and leave, and the core's node reuse keeps the others' contexts and elements. Task 4's test confirms the patch shape. If it finds `diffTrees` rewriting shifted rows, that becomes a library finding in Task 4.
- **W.2 Starter `scroll` changes** (the catalog stays `starter.ui@1` because every addition is optional):
  - `itemCount`: integer, 0 to 1,000,000,000.
  - `itemStart`: integer, 0 to 1,000,000,000.
  - `itemSize`: a string enum of the starter's declared `size.*` names. The design system gains `size.row`.
  - `step`: integer, 1 to 200, default 20.
  - `onRange`: event, carries `{ object: { start: integer, end: integer } }`.

  These props are only meaningful together: `itemCount` without `itemSize` draws as today.
- **W.3 The implementation** (trusted app code, `packages/starter/src/implementations.tsx`):
  - It reserves `itemStart × size` before the first child and `(itemCount − itemStart − children) × size` after the last, as block padding on the viewport. The size comes from `var(--lf-v-size_row)` inside a `calc()`, so no pixel value enters the tree.
  - It listens to `scroll` (passive, one `requestAnimationFrame` per frame) and computes the visible range from `scrollTop` and the size, which it reads once from computed style and again after a design-system switch.
  - It emits `onRange` when the visible range comes within `step` rows of either edge of the drawn slice.
  - It sets `overflow-anchor: none` on the viewport. The padding compensates exactly for removed rows, and an engine's own anchoring would correct twice.
- **W.4 Why not React Aria's `Virtualizer`.** `Virtualizer` with `ListLayout` virtualizes a collection it holds in full, so it would need all 50,000 rows in the tree. Here the host sends only the slice. A plain scroll listener is the smallest mechanism that fits.
- **W.5 The widget pattern** (`docs/sdk.md` "Lists longer than the node limit"):
  - The range lives in widget `state` (`state.set("range")`).
  - The source is bound to `{ from: "state", path: "range" }`, so the host reads only the window.
  - The widget computes `window = [start − overscan, end + overscan]`, clamped and at most 200 rows, renders that slice with stable keys, and passes `itemStart = window.start` and `itemCount = total`.
  - Fixed-size rows only: variable heights are out of scope and documented as the app's.
- **W.6 What stays the app's:** the list widget, the source's paging, and the round-trip latency of a range change (transport).

### 3.1 Amended at execution (plan 038 Task 4, 2026-11-19)

Browser tests in all three engines changed how W.3 and W.5 are carried out. The forms, the budgets and the laws above still hold.

- **W.1 holds.** `diffTrees` between two 200-row windows 20 rows apart gives 41 ops: one `set` of the scroll (its `itemStart`), 20 `remove` and 20 `insert`, and no `move`. That is 13.3% of the tree's bytes. No library change.
- **The padding is on an inner block, not the viewport (W.3).** Base CSS sizes every element `border-box`, and the starter's viewport has `max-height: 100%`. Padding on the viewport itself is 1.8 million pixels for a 50,000-row list, which overrode the height cap: the viewport grew to the whole list and never scrolled. When `itemSize` is set, the viewport holds one `div` with the block padding, and the rows are its children. Without `itemSize` the markup is unchanged.
- **The row size is read on every check, not cached (W.3).** One `getPropertyValue` per animation frame during a scroll is cheap. Reading it every time also picks up a design-system switch without a separate path.
- **The source applies the overscan (W.5).** A source binding carries a value from state, not an expression, so the widget cannot widen the range it binds. `onRange` stores the visible range. The app's source reads that range plus its overscan (60 rows in the fixture), clamped to the collection and to 200 rows, and returns `{ total, offset, rows }`. The widget passes `offset` as `itemStart` and caps the slice at 200.
- **`onRange` makes `scroll` interactive.** Resolution requires a focus overlay for a kind with events, so the starter design system adds one on `scroll.*.viewport`, the region's tab stop, inset by 2 px. The starter browser suite gains its `scroll.default.focus` state fixture.
- **The fixture lives with the starter.** The fixture is `packages/starter/src/__tests__/windowed.tsx`, with `windowed.test.ts` and `windowed-browser.test.ts`. It is not in `src/__tests__/fixtures/widgets/`, because that directory's widgets compile against the proof catalog, whose `scroll` does not window.
- **The commit gate runs on the starter design system.** `bench/streaming.bench.ts` mounts the starter renderer for the windowed list beside its proof agent-home measures. The proof catalog's `scroll` has no windowing props, so the proof design systems cannot draw this list.

### What a 0.3.x consumer does

The starter is released in lockstep, so a 0.3.x starter never sees the new props. A tree that uses them fails a 0.3.x validator with `invalid-prop`.

### Spec text

None in §7.1 beyond a pointer: the existing rule "Long lists are paged or windowed" gains "(pattern: `docs/sdk.md`, 'Lists longer than the node limit')".

### Budget

- A range change of 20 rows produces a patch of at most **2 × 20 + 2 ops** and at most **25 % of the full 200-row tree's serialized bytes**.
- The patch commits within **one frame (16.7 ms)** on both proof design systems in the production profile.
- Both are gated in `bench/streaming.bench.ts`.
- A scroll without `itemCount` costs nothing new.

### Laws

- **Law 2:** every window is a whole tree validated within the 5,000-node limit.
- **Law 3:** spacing is computed by trusted primitive CSS from a declared `size.*` name, and the widget names no length.
- **Law 4:** the range is `state`, checked by the host against the manifest's schema like every `setState` value. The source params it binds are re-checked by `bindSources` against the capability.
- **Law 1** is not touched.

### Tests Task 4 writes

As listed in the plan, with the spacer-node wording replaced by `windowed_list_reserves_space_through_the_primitive`.

---

## 4. F8 — The DOM adapter (`@arnilo/liveframe/dom`)

### Public surface

```ts
import { createDomRenderer, implement, place } from "@arnilo/liveframe/dom";

const Row = implement(rowDefinition, (node, element) => {
  const el = element ?? Object.assign(document.createElement("li"), { id: node.domId });
  el.className = node.slot("root");
  el.textContent = node.props.label;
  if (!element) el.addEventListener("click", () => node.emit("onPress")); // `node.emit` always reads the current context
  return el;
});
const List = implement(listDefinition, (node, element) => {
  const el = element ?? document.createElement("ul");
  place(el, node.children); // keeps existing children, moves only what changed (`moveBefore` where supported)
  return el;
});

const { mount } = createDomRenderer({ catalog, implementations: [Row, List /* … */] });
const surface = mount(container, { validator, theme, designSystem, onIntent, fallback: () => unavailable() });
surface.update(tree);                    // Result<SurfaceSnapshot>
surface.set({ theme: dark });            // runs the §6.4 switching sequence
surface.dispose();
```

- **D.1 `createDomRenderer`** runs the same registry check as `createRenderer`: missing, duplicate and differing implementations, with the same `catalog-mismatch` errors and pointers, thrown as `RendererError`. The check moves into a shared, framework-free function that both adapters call, so the two cannot drift. It also accepts `{ catalogs: [...] }` with the same rules.
- **D.2 `mount(container, options)`** takes `validator`, `theme`, `designSystem`, `transparency?`, `onIntent`, `confirm?`, `onEvent?`, `limits?`, `fallback: () => Node`, `invalid?: "fallback" | "keep-last"`, `focusContinuity?` (default `true`) and host-only `wrapperClass?`/`portalClass?`. It appends one wrapper and one sibling portal container, both carrying `surfaceAttributes(...)`. It returns:
  - `update(tree)`, which calls `core.accept` and draws synchronously, so no render is ever discarded;
  - `set(partial)` for theme, design system, transparency, callbacks and limits;
  - `dispose()`, which calls `detach()`, unsubscribes, runs `dispose` hooks and removes both containers.
- **D.3 Implementations.** `implement(definition, draw, hooks?: { dispose?(element) })` is typed from the definition the way `src/react/implement.ts` is.
  - `draw(node, element?)` receives:
    - `props`, `domId`, `kind`, `variant`, `events`, `slot(name)` and `style`;
    - `emit`, stable per node id and reading the current context;
    - `children`, the drawn child nodes;
    - `items`, child contexts, each with `render(): Node`;
    - `portal`, the scoped container.
  - The adapter calls `draw` only for nodes whose core context identity changed, and caches the returned element by context. If `draw` returns a different element, that element replaces the old one.
  - `place(parent, nodes)` reorders a parent's children to match `nodes`. It touches only nodes out of place, uses `moveBefore` when the engine has it (Chromium 133+, Firefox 144+; feature-detected, and WebKit unverified on 2026-11-19), and otherwise uses `insertBefore`, with focus continuity restoring focus.
- **D.4 Duties (Task 6).**
  - **Error containment:** a throwing `draw` draws `fallback()` at that node and calls `core.fail(node)`, so the next arrival retries.
  - **Scoped portal** with the wrapper's scope attributes.
  - **Focus continuity, focus mark, switching sequence and motion:** the shared `src/dom/focus.ts`, `src/dom/switching.ts` and `src/dom/motion.ts`, which `/react` also imports. Its own copies are removed in the same task, so each rule exists once.
  - **`keep-last`:** `data-lf-stale` and `aria-busy` on the wrapper.
- **D.5 Not offered:** server rendering and hydration (`/dom` is client-only), JSX or templates, and any HTML-string API.
- **D.6 Conformance.** `@arnilo/liveframe/conformance/dom` exports `domRendererBrowserSuite()` and `domConformancePage()`. The case definitions move to one shared module (`src/conformance/renderer-cases.ts`), and the React and DOM suites differ only in how they mount. The React suites keep their case names and outcomes. Because `/dom` has no server half, the DOM suite runs the server suite's structural cases in the browser page.
- **D.7 Host-API rule.** `/dom` and `/conformance/dom` join the places that may use DOM globals. That changes spec §13, `AGENTS.md`, `roadmap.md` §1, the execution skill's `SKILL.md` and `references/architecture.md`, and `src/__tests__/portability.test.ts`, all in Task 5.

### 4.1 Amended at execution (plan 038 Task 5, 2026-11-19)

- **`style` is keyed by CSS property name.** The core's `style` uses React's camelCase keys plus `--` custom properties. `/dom` hands `draw` the same declarations with hyphenated names, ready for `element.style.setProperty`, built once per context.
- **The shared registry check lives in `src/surface/registry.ts`** with `RendererError` and the refused core. It is framework-free and internal; `/react` and `/dom` both export the one `RendererError` class. The implementation prop types (`Props`, `Emit`, `Events`) moved to `src/surface/implementation.ts` for both adapters.
- **`place(parent, nodes)` sets the parent's children exactly.** It removes the children not listed, keeps the longest run already in order, and moves only the rest. `moveBefore` is used only for a node already in that parent, with `insertBefore` on a throw (MDN: `HierarchyRequestError` when connectedness differs).
- **The portal container and the switching sequence are in Task 5**, because D.2's `mount` appends both. Task 6 moves the switching code into `src/dom/switching.ts` when `/react` shares it.
- **Budget.** `bench/dom.bench.ts` draws the agent-home tree (679 nodes) with both adapters, using implementations that draw the same elements. Validation and the core are about 1.3 ms of a 1.6 ms patch on both sides, so the medians sit within noise. The gate takes the paired `/dom ÷ /react` ratio per run and fails only when its 95% bootstrap interval lies wholly above 1.

### 4.2 Amended at execution (plan 038 Task 6, 2026-11-19)

- **Shared modules.** `src/dom/focus.ts` (`focusSnapshot`, `restoreFocus`, `moveFocus`, `createFocusMark`, `notifyHost`) and `src/dom/switching.ts` (`beginSwitch`) hold the rules `/react` held. `/react`'s `FocusContinuity`, `useFocusMark` and switching effect now call them; `/dom` calls the same functions around its own mutation, in `<Surface>`'s order: focus snapshot and motion `before`, then the mutation, then `restoreFocus`, motion `after` and `gate`, then the focus mark.
- **A move must not blur.** WebKit has no `moveBefore` (checked 2026-11-19), and `insertBefore` blurs the moved focused element. React DOM refocuses the element it saw focused, with its selection, after every commit. `restoreFocus` now does the same for a still-connected element when focus fell to the body, so `/dom` keeps focus across reorders in WebKit. For `/react` it is a no-op, because React DOM has already refocused the element.
- **Motion is keyed by `surfaceId` in `/dom` too.** A new surface, or a fallback, disposes the motion helper, so the first tree after either never animates in, as the keyed `Motion` boundary does in `/react`. `set()` with a new scope calls `halt()` before the switching sequence.
- **`place` leaves `[data-lf-exiting]` children in place.** React never removes a node it does not own, so a kept exiting element survives its parent's next commit. `place` removes every unlisted child, so it now skips an element still playing its exit; the motion helper removes it when the exit ends.
- **The shared cases live in `src/conformance/renderer/`** (not one `renderer-cases.ts`): `page.ts` (the suite options and the `window.liveframeConformance` API type, declared once), `browser.ts` (the browser cases and their runner), `structure.ts` (the server suite's structural cases over a `StructureRenderer`), and `overlays.ts` and `states.ts`, moved from `src/conformance/react/`. React's suites prepend hydration and supply `renderToString`; `/conformance/dom` supplies the page.
- **Structural cases on the page.** `domConformancePage()` adds `structure(tree, styles)`, `fallbackSurface(tree, styles)` and `fallbackMarkup(canonical?)`. The page writes markup with attributes sorted and style declarations as `name:value`, so the same parsers read React's server markup and the browser's. `every_example_renders_on_the_server_under_every_design_system` also fails an example that raised `implementation-failed`, because `/dom` contains a throwing `draw` where React's server rendering throws.
- **Motion cases.** The motion browser tests moved into `src/__tests__/fixtures/motion-browser.ts`; `react-motion-browser.test.tsx` and the new `dom-motion-browser.test.ts` run them against their own client page. They are library tests, not app conformance cases, so the React suites' case names and order stay unchanged.

### What a 0.3.x consumer does

Nothing: the subpaths are new. `/react`'s public API is unchanged. Its internal focus, switching and motion code moves into `src/dom/` modules with the same behaviour, pinned by the existing React suites.

### Spec text

- §11 rule 4: "…`@arnilo/liveframe/react` and `@arnilo/liveframe/dom` only map the core's node contexts to elements."
- §11 core paragraph: "…the library ships two adapters, React's and the plain DOM one (`/dom`)."
- §11 gains a "**The DOM adapter**" subsection with D.1–D.5.
- §13 table: add rows for `/dom` and `/conformance/dom`, and add both to the browser-subpaths line.
- §14: "Renderers other than React" becomes "Renderers other than React and the plain DOM adapter (`/dom`); adapters for other frameworks are written on `/surface` by the app." Cite the scope decision.

### Budget

Mounting and patching the agent-home tree in the browser harness must be at most `/react`'s median for the same structure in the production profile. The fixture registry's DOM implementations draw the same elements as its React ones. `/dom`'s added archive size is recorded by `release:gate`. A host that does not import `/dom` pays nothing, because it is a separate subpath with no side effects on import.

### Laws

- **Law 1:** implementations are the app's compiled code. The adapter evaluates no string, sets no `innerHTML`/`outerHTML`/`insertAdjacentHTML`, and creates no `<script>`. A source scan enforces this (`dom_adapter_sets_no_inner_html_and_evaluates_nothing`).
- **Law 2:** it draws only contexts the core built from a tree that passed `validator.validateTree`. An invalid arrival draws only `fallback()`.
- **Law 3:** it sets only classes from `slot()`, style-prop declarations from `style`, scope attributes and the motion helper's measured `translate`.
- **Law 4:** `setLocal` is applied in the core and never forwarded. The shared conformance case "a renderer that forwards `setLocal` fails" runs against `/dom` too.

### Tests Tasks 5–6 write

As listed in the plan. Task 6 drops the custom-element tests.

---

## 5. Cross-cutting

- **Order of the tasks.** The F6 helper lives in `src/dom/motion.ts` from Task 3, before `/dom` exists. It is internal until Task 5 and is not exported, so Task 3 does not depend on the non-goal. `/conformance/dom` includes F6's cases (D.6), so the two adapters are held to the same motion rules.
- **Performance rule.** Every addition is opt-in:
  - F5 per source;
  - F6 per recipe, at the cost of one cached style read when no recipe uses motion;
  - F7 per `scroll` node;
  - F8 per import.

  A host using none of them pays nothing measurable, and the existing gates (`bench/host.bench.ts`, `bench/streaming.bench.ts --production`) hold unchanged.
- **What each item leaves to the app:**
  - F5: the fetch, the cache and the transport for the second render.
  - F6: the choice of which kinds move, made in its design system.
  - F7: the list widget, paging and variable row sizes.
  - F8: every primitive implementation.
