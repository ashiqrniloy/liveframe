# Migrating to 0.4.0

0.4.0 is an additive minor release under the [compatibility policy](compatibility.md). Existing `0.3.x` manifests, catalogs, capabilities, trees and host integrations remain valid without changes. The one exception is a design system you wrote yourself for the starter catalog (below).

## Action needed: your own design system for `starter.ui@1`

The starter catalog keeps its id, `starter.ui@1`: every 0.3.x tree and widget written against it stays valid (spec §5 versioning). But it gains the size name `size.row`, an `onRange` event on `scroll` and ten kinds, and a design system must declare every vocabulary name, give every kind and slot a rest recipe, and give every kind with an event a focus overlay. A design system you wrote for the 0.3.x starter catalog therefore fails `validateDesignSystem`. For `scroll` it reports two errors:

- `unknown-name` at `/values/size.row`: declare it, e.g. `"size.row": { kind: "size", value: { value: 36, unit: "px" } }` (the starter's own value). It is the row height a windowed `scroll` multiplies, so match your list rows.
- `incomplete-design-system` at `/recipes/scroll.default.root.focus`: add a `focus` recipe to a `scroll` slot. The starter puts it on the viewport, the region's tab stop: `"scroll.*.viewport.focus": { outlineColor: "focus.ring", outlineWidth: "border.focus", outlineStyle: "solid", outlineOffset: { value: -2, unit: "px" } }` (a negative offset keeps the ring inside the clipped viewport), using your own value names.

For the five new controls it reports `incomplete-design-system` at each missing recipe:

- A `rest` recipe for every slot: `radioGroup` (`root`, `label`), `radio` (`root`, `indicator`, `label`), `slider` (`root`, `label`, `track`, `fill`, `thumb`, `output`), `progress` (`root`, `label`, `track`, `fill`) and `dateField` (`root`, `label`, `input`, `segment`). A `<kind>.*.<slot>.rest` recipe covers the one `default` variant.
- A `focus` overlay for `radioGroup`, `slider` and `dateField`, which raise `onChange`. The starter puts the slider's on its `thumb` and the date field's on its `input` and `segment`.

For the five new content kinds it reports `incomplete-design-system` at a `rest` recipe for every slot: `richText` (`root`, `paragraph`, `heading`, `list`, `item`, `code`, `link`), `chart` (`root`, `plot`, `axis`, `gridline`, `series1`–`series4`, `legend`), `table` (`root`, `caption`), `tableRow` (`root`) and `tableCell` (`root`). They raise no events, so they need no focus overlay; the starter still gives a `richText` link `hover` and `focus` recipes. A chart's marks paint `currentColor`, so give each `series<n>` slot a `textColor`, or every series draws in the inherited text colour.

Copy the starter's recipes for the ten kinds from `packages/starter/src/design-system.ts` and change the value names to yours. The states the implementations expose are `hover`, `active`, `focus`, `disabled` and `selected` on a radio, `focus` and `disabled` on a group, `hover`, `active` (while dragging), `focus` and `disabled` on a slider thumb, `mixed` on an indeterminate progress bar, and `hover`, `focus`, `readonly`, `invalid` and `disabled` on a date field. If you have your own implementations for `starter.ui@1`, add one per new kind too, or `createRenderer` fails its registry check.

The starter's own `designSystem` already has all of these. `designSystemSuite()` names every error, so run it in CI before you upgrade.

## Element JSON error kinds

Update handlers that match `invalid-prop` for these inputs to `renderElements` or `streamElements`. A missing, empty or non-string `kind` now reports `unknown-component` at the element pointer. A non-array `children` now reports `invalid-children` at the `children` pointer.

## Compatible additions

### A slow source can answer `pending` (`sourceOutcome(result, { pending: true })`)

A source declared with `{ pending: true }` may be answered before its read lands. The widget draws a placeholder for that region and the host renders the placement again when the value arrives ([host guide](host.md#answer-a-slow-source-with-pending), [SDK guide](sdk.md#sources-that-may-be-pending)):

```ts
const resolve = async (calls) =>
  Object.fromEntries(calls.map((c) => [c.alias, cache.has(c) ? { ok: true, value: cache.get(c) } : { ok: false, reason: "pending" }]));
```

- **Nothing changes without the option:** `sourceOutcome(result)` returns the 0.3.0 schema byte for byte, so existing capability documents, their hashes and widget types are unchanged.
- **Resolvers:** answer `{ ok: false, reason: "pending" }` only for a source that declares the variant; for one that does not, the render fails at `/data/<alias>`. A pending answer that also carries a `value` counts as `failed`, and its `message` is dropped.
- **Code that handles `HostEvent`:** an exhaustive switch gains `source-pending`. It is raised instead of `source-failed`.
- **Widgets:** a widget reading a pending-declared source must narrow on `status` before reading `value`; the generated types enforce it.
- **On 0.3.x:** a 0.3.x `renderPlacement` treats `reason: "pending"` as `failed`, which fails closed.

### The starter's `scroll` windows long collections

`scroll` gains the optional props `itemCount`, `itemStart`, `itemSize` and `step`, and the event `onRange`, so a widget can draw a 50,000-row list within the node limit ([SDK guide](sdk.md#lists-longer-than-the-node-limit)). Existing `scroll` nodes are unchanged.

- **Your own design system:** see [Action needed](#action-needed-your-own-design-system-for-starteruil1) above.
- **Fail-closed on 0.3.x:** a 0.3.x validator rejects a tree that uses the new props.

### A plain DOM adapter (`@arnilo/liveframe/dom`) and its suite (`/conformance/dom`)

A new subpath draws a surface with no framework, over the same surface core as `/react` ([renderer guide](renderer.md#render-without-a-framework)). Nothing changes for an app that uses `/react`: its exports, behaviour and conformance case names are unchanged.

- **Adopting it:** write one `implement(definition, draw)` per primitive and run `domRendererBrowserSuite()` against them ([conformance guide](conformance.md#prove-a-dom-registry)). There is no server rendering and no custom element; the guide shows one written over `mount`.
- **Bundling:** `/dom` and `/conformance/dom` are browser subpaths, like `/react`.

### Design-system motion (`motion`)

A design system may give a kind enter, exit and reorder motion on its root slot's rest recipe, timed by the recipe's own transition:

```ts
"box.plate.root.rest": { /* … */ transitionDuration: "motion.fast", transitionTiming: "ease-out", motion: "fade-move" }
```

- **Fail-closed on 0.3.x:** a `0.3.x` validator rejects `motion` as `invalid-document`; install such a design system only where every validator is 0.4.0. A 0.3.x `<Surface>` given a 0.4.0 sheet never sets `data-lf-motion`, so it draws as before.
- **Primitives:** motion finds a node's element by `domId`, so put `domId` on the element that carries `slot("root")`.
- **Nothing else changes:** a design system without `motion` projects the same CSS, and `<Surface>` gains no option ([styling guide](styling.md#motion-enter-exit-and-reorder)).

### Renderer conformance cases for local state and the interaction additions

`rendererSuite` gains `failed_binding_draws_the_node_fallback`, which needs nothing new: it gives one node of each example a condition that fails when evaluated and expects the node fallback in its place with a `binding-failed` event. `rendererBrowserSuite` gains `when_false_node_is_not_drawn`, `set_local_redraws_and_never_reaches_the_host`, `local_writes_apply_with_one_complete_host_intent`, `from_local_intent_arrives_complete` and `focus_mark_moves_focus_once`.

- **Action needed in CI:** add the `local`, `compound`, `fromLocal` and `focus` fields to your `BrowserFixtures` ([fixture table](conformance.md#describe-your-apps-interactions-and-lifecycle)), and declare the `local` keys they use in the test manifest. Until you do, each case fails and names the missing fixture.
- **Primitives:** the focus case needs your focusable primitives to put `domId` on the element that takes focus.
- **Custom pages:** a page that does not call `conformancePage()` must also expose `events()`, the surface's `onEvent` reports.

### A filtered list knows how many rows it draws (`shown`)

`when` and `bind` may read a third root, `shown`: how many of the node's siblings that carry a `when` are drawn. An empty state no longer needs a `setState` round trip:

```tsx
{rows.map((r) => <Row key={r.id} when={ex.contains(r.title, local("q"))} title={r.title} />)}
<Text when={ex.eq(shown(), 0)} text="No matches" />
```

- **Fail-closed on 0.3.x:** a `0.3.x` validator rejects `{ "$path": "shown" }` with `unknown-name`; upgrade every validator and renderer before emitting it.
- **What is counted:** direct siblings only, that carry a `when`, whose `when` is true without a fault, and that do not read `shown` themselves. A node with no `when` is not counted. The root reads 0.
- **Where:** only in `when` and `bind`, never in template props, `$if`, `$let` or `$embed`.

### A tree marks the node that takes focus (`focus`)

A tree may now carry `focus`, the id of one always-rendered node. A widget sets it with a boolean `focus` attribute on one element (TSX, element JSON) or a boolean template value; `<Surface>` moves focus there after the commit that draws a later revision with a changed mark:

```tsx
<TextField focus={state.adding} label="New task" onCommit={action("tasks.add", {}, { bind: "title" })} />
```

- **Fail-closed on 0.3.x:** `0.3.x` validators and `ui-tree.json`/`tree-patch.json` reject `/focus` (`invalid-prop`); upgrade every validator and renderer before emitting a mark.
- **First tree:** the first tree a surface draws, or the first after its `surfaceId` changes, never moves focus; nor does a repeated or removed mark.
- **Primitives:** focus resolves through the node's `domId`. A primitive that should take focus must put `domId` on its focusable element; otherwise `onEvent` receives `focus-missed`.
- **Reserved name:** `focus` is no longer usable as a catalog prop name with `liveframe gen`; the generated primitives (and the starter's `./ui`) gain an optional `focus?: boolean`.
- **Code that handles `SurfaceEvent`:** an exhaustive switch gains the `focus-missed` case.

### `Store` compare-and-set for state (`putStateIf`)

`Store` gains an optional `putStateIf(placementId, scope, expected, next): Promise<boolean>`. `handleIntent` uses it for `setState` when your store has it, so two processes writing different keys of one placement's state keep both.

- **Custom stores:** nothing to change; a store without the method still implements `Store`, and `handleIntent` writes with `putState` as before. To make a multi-process host safe, implement it as one conditional update that compares the stored state by canonical JSON (`undefined` means none stored), and run `storeSuite()` to check it.
- **Code that handles `HostEvent`:** an exhaustive switch over `intent-refused` reasons gains `conflict`, raised with `version-conflict` at `/state` after four lost compares.

### Compound local writes on host intents (`local` on `setState` and `action`)

A `setState` or `action` intent may now carry `local` (1 to 4 `{ key, value?, until?: "revision" }` `LocalWrite` entries) to update surface local state alongside raising the host intent:

```tsx
<Button
  label="Save"
  onPress={action("tasks.save", { id }, { local: [local.set("saving", true, { until: "revision" })] })}
/>
```

- **Fail-closed on 0.3.x:** `0.3.x` tree validators and `ui-tree.json` reject `/local` on intents (`invalid-prop`); upgrade the validator and renderer before emitting compound intents.
- **Host checks:** `local` is stripped on `emit` before `onIntent` runs and never reaches the host; `checkOffered` rejects any posted `local` field with `invalid-prop` at `/local`.
- **Revert semantics:** writes with `{ until: "revision" }` revert to their pre-write value when the surface next accepts a revision of the same `surfaceId` (unless a later permanent write superseded them). Rejected or stale arrivals do not revert them.

### Array event carries (`carries: { array: { items, maxItems } }`)

A definition's event may now carry a bounded array of one scalar type, so a multi-select reports its selection as typed values instead of a comma-joined string:

```ts
events: { onChange: { carries: { array: { items: str({ maxLength: 64 }), maxItems: 50 } }, description: "The selected ids." } }
```

- **Fail-closed on 0.3.x:** `0.3.x` `validateCatalog` and `catalog.json` reject an array carry (`invalid-document` at `carries`); upgrade every consumer of the catalog before adding one.
- **Fit:** `bind` fills an array action argument and implicit `setState` an array state key when the items fit; `bindAll` and `local` writes cannot take an array.
- **Code that reads `carries`:** an object-typed `carries` is now either `{ object }` or `{ array }`; check which before reading `.object`.

### Intent values read from local state (`fromLocal` on `action` and `setState`)

An `action` intent may now carry `fromLocal` (1 to 16 `{ [arg]: localKey }` entries), and a `setState` intent without `value` may carry `fromLocal: "<localKey>"`, so multi-field forms can collect inputs in `local` state and submit them together on one event:

```tsx
<TextField label="Reason" onChange={local.set("reason")} />
<Button label="Escalate" onPress={action("tasks.escalate", { id }, { fromLocal: { reason: "reason" } })} />
```

- **Fail-closed on 0.3.x:** `0.3.x` tree validators and `ui-tree.json` reject `/fromLocal` on intents (`invalid-prop`); upgrade the validator and renderer before emitting `fromLocal`.
- **Host checks:** `complete()` fills the named arguments (or `setState.value`) from local state on `emit` (after any compound `local` writes on the same event) and strips `fromLocal`; `checkOffered` rejects any posted `fromLocal` field (`invalid-prop` at `/fromLocal`) and re-checks the filled values against the capability `args` or manifest `state` schema.
