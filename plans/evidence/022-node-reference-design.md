# Plan 022 Task 9 — node reference design

Design only; no code. Status: **proposal, awaiting the owner's approval** (the recommendation is
deferral to 0.3.0 with this design ratified).

## Recommendation

Do not ship `nodeRef()` in 0.2.2. Move it to 0.3.0 with the design below, and record the move as
the scope decision's own revisit trigger: *"`nodeRef()` has no additive design, which moves it to
0.3.0"* ([0.2.2 scope](../decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md)).

The additive design below does hold — a per-definition `refProps` name list is the same class of
change as 0.2.1's `styleProps` widening — so the deferral is not the "no additive design" branch.
It is a size and evidence call, argued in §6: the change reaches six subsystems, contradicts spec
§7.2's one-pass rule unless that rule is relaxed, and has **no consumer in the repo** (0 of the 24
proof primitives declare a relation prop), so nothing in 0.2.2 could prove it works. A patch release
is the wrong place for a format change whose first implementation would also be its first test.

## 1. The problem

A widget author cannot name another node. Node ids are key paths derived at render time
(`root/queue/row:4812/claim`, spec §7.1), so the author of a `textField` cannot say "my description
is that hint two siblings up". Every relationship the catalog needs today is *structural*, and the
slots already carry it: `tooltip` has `trigger` and `content`, `tab` has `panel`, `disclosure` has
`summary` and `panel`, `menu` has `trigger` and `content`.

What structural slots cannot express is an ARIA **relationship attribute**: `aria-labelledby`,
`aria-describedby`, `aria-controls` and `aria-errormessage` take `IDREF`/`IDREFS` — "it must
reference elements in the same DOM document" (MDN, `aria-describedby` note). `aria-errormessage` is
only meaningful while the element has `aria-invalid=true`, and its target must be visible. These
are the only relationships Liveframe cannot express today.

Evidence that 0.2.2 has no consumer:

- `src/__tests__/fixtures/proof/catalog.json`: 24 definitions, and not one prop whose name or role
  is a relation (`id`, `htmlFor`, `describedBy`, `labelledBy`, `controls`, `errormessage`, `target`
  → zero hits). `a11y` declares `role` and `name` only, and `name` must be a *string prop*
  (`catalog.ts:230-234`) — a same-node naming convention, not a reference.
- The renderer's only per-node DOM hook is `data-lf-node`, and it exists **only when `diagnostics`
  is passed** (`src/react/renderer.tsx:394-402`). There is no id scheme to reference yet.
- A host can express a relation today without any library change: a composed component renders both
  elements and passes a literal DOM id through string props, keying uniqueness on the row id it
  already embeds. Props are data, so `id="hint-4812"` / `aria-describedby="hint-4812"` works in
  0.2.1. It is the host's job to keep the two strings in step, which is exactly what a reference
  would automate — but nothing is blocked.

## 2. Settled design (ratified for 0.3.0)

### 2.1 Authoring

```tsx
import { ref } from "@arnilo/liveframe/sdk";

<textField
  label="Claim id"
  value={row.claim}
  describedBy={ref("hint")} // a frozen marker: { "$ref": "hint" }
/>;
<text text="Claims start with C-" $anchor="hint" />; // tree-unique author anchor
```

- `ref(key)` returns a frozen marker object; the author never writes or sees a key path.
- `$anchor` is the target's author name, unique in the tree. `$anchor` is chosen over `anchor`
  because a catalog prop name must match `^[a-z][A-Za-z0-9-]*$` (`catalog.ts:11`), so `$anchor`
  **cannot collide with any catalog prop**, now or later — no new catalog rule, no existing catalog
  can newly fail.
- Rejected: **sibling-relative key path** (authors would have to reproduce kind segments and climb
  ancestors; it breaks whenever a wrapper is inserted, and it is the derived id the spec says
  authors do not know); **reusing `key`** (a list key is scoped to its siblings, so two rows may both
  use `key="hint"`, and it already has list semantics); **an `anchor` prop** (a valid prop name, so
  it would need a new catalog rule rejecting it, which could invalidate an existing host catalog).

### 2.2 Catalog declaration

Each definition may declare ref props: `refProps?: readonly string[]`, a subset of its **string**
prop names. `validateCatalog` rejects a name that is not a declared string prop (`unknown-name`, the
same rule `a11y.name` already uses). Absent `refProps` means "no references", exactly as 0.2.1.

Rejected: a schema-language keyword (`{ type: "string", ref: true }`). `src/schema.ts` validates
schemas against a **closed** keyword set per type (`keywords`, `hasOnlyAllowedKeys`, `schema.ts:147-156`),
so a keyword is a change to the schema language itself — `Infer`, every generated type, the elements
JSON Schema and every port's schema-language implementation — while the JavaScript value stays a
plain `string`. A per-definition name list gets the same guarantee for a fraction of the surface.

### 2.3 Wire form

The wire carries the **resolved key-path id as an ordinary string prop**:
`{ "kind": "textField", "props": { "describedBy": "root/stack/hint", "value": "C-4812" } }`.

Consequences, all free:

- `UiNode`, `liveframe/1` trees and `liveframe/tree-patch/1` are unchanged; `diffTrees`, `applyPatch`,
  `sameJson`, node reuse and the whole-tree/patch transport need no change.
- A patched tree is validated whole before the renderer reads it (law 2), so a patch that removes or
  renames the target surfaces as a dangling reference at the next arrival, not as a broken DOM id.
- Implementations render the id they were given: `aria-describedby={domId(props.describedBy)}`.

Rejected: a marker object on the wire (`{ "$ref": "root/stack/hint" }`). It would make every
consumer — patcher, port, capture, reuse comparison — learn a new value shape to express something a
string already says.

### 2.4 Resolution during the build

`render()` resolves anchors in the emit pass, with one deferred step because a reference may point
**forward** (an error message usually sits after its field):

1. `emit` records `$anchor` → the node's derived id as it creates the target.
2. A ref prop whose value is a marker is held in a small pending list instead of being written, and
   its byte count is corrected at resolution (count the resolved id, subtract the marker) so the
   `bytes` budget stays exact rather than approximate.
3. After the walk: for each pending reference, look up the anchor, write the id into the prop, then
   check the id is in the id set (validation, §2.5). Unresolved anchor → `not-found` at the prop's
   pointer; a second node with the same `$anchor` → `duplicate-key` at its `$anchor`, expected
   `a tree-unique anchor`.

This is O(number of references), not O(nodes): the pending list is populated only for kinds that
declare `refProps` and only for marker values.

Cost of the deferred step, to be measured in 0.3.0: one extra `Set` lookup and one byte-count
correction per reference; a tree with 50 references and 679 nodes is ~5% of one node's budget.

### 2.5 Validation

The check is *same-tree membership*, and it belongs to the tree validator because that is what runs
on every arrival:

- `compileTree`/`validateTree` build the `ids` set it already maintains, then, for every node whose
  kind declares `refProps`, assert each declared prop's string value is in that set. Missing →
  `not-found` with `nodeId` = the referring node and pointer `/…/props/<name>`. This is one
  `Set.has` per reference **after the walk**, because the whole id set must exist first.
- `render()` uses the same check on the ids it built (§2.4), so a dangling reference never reaches a
  host as a tree.
- `renderElements()` inherits it: element JSON references are strings too, and the agent emits ids it
  built with `render()`'s key-path rules. Error pointers are rewritten into the JSON as they are now,
  `nodeId` staying the key-path id.
- `checkOffered` needs no change: it checks origins and intents, and a reference grants no intent.
- New error kinds: `not-found` (additive; `checkOffered` already uses it for an unknown node).

### 2.6 Renderer

`<Surface>` gives implementations a resolver, `item.domId(nodeId)`, returning a DOM id unique across
sibling surfaces:

```txt
lf-<encodeURIComponent(useId())>:<key-path id>     →  lf-_r_3_:root/stack/hint
```

- The prefix comes from React's `useId` (React peer `^19.0.0`), so two surfaces of the same tree on
  one page never collide; ids stay deterministic per surface, and a node's ID survives re-renders
  because it is derived from the key path.
- **The renderer does not add a wrapper element.** The `data-lf-node` wrapper is `display: contents`
  and exists only under `diagnostics`; making it unconditional would insert a `<div>` per node and
  break host CSS selectors and §11's "switching changes computed styles, not DOM structure" proof.
  Instead the *implementation* places the id on the element it already renders
  (`<p id={domId(item.id)}>` for a hint, `<input id={domId(item.id)}>` for the field), which keeps
  the DOM of every existing implementation identical.
- Validation is on the tree, not the DOM: an implementation that does not render a target slot still
  passes validation, and the relation is then inert in the browser exactly as a bad `aria-describedby`
  is today. This is stated in the docs rather than guessed at in the renderer.

### 2.7 Codegen

- `liveframe gen` keeps emitting the prop as `string`. `refProps` are documented on the component and
  exported as a `NodeRef = string` alias for readability; no type changes, so
  `liveframe gen --check` still passes on 0.2.1 output.
- `generateElementsSchema` is unchanged: element JSON references are ids, and a JSON Schema cannot
  express "an id in the same tree". The catalog schema gains the optional `refProps` array.

### 2.8 Ports and corpus

- Ports must (a) accept a catalog with `refProps`, (b) validate the target against the tree's id set,
  and (c) expose DOM ids per §2.6. Clay's Rust validator takes (a) and (b); (c) is the web port's.
- Corpus cases (all additive): a catalog declaring `refProps`; a valid reference; a dangling
  reference (`not-found`); a non-string value (`invalid-prop`); a duplicate anchor
  (`duplicate-key`); a patched tree whose patch removes the target, so the next arrival fails closed.
  No existing case changes.

## 3. What every 0.2.1 input keeps

- A catalog without `refProps` means exactly what it means today; no prop is a reference.
- Trees, patches, hash vectors, capture layout records and reuse comparisons are unchanged: the wire
  is a plain string either way, and a tree that carries no reference validates exactly as before.
- An implementation that ignores `domId()` renders byte-identical DOM. An implementation that never
  uses `ref()` behaves identically.
- The only new failure modes need `refProps` in the catalog *and* a reference value that is not an id
  in the tree — impossible in 0.2.1 documents.

## 4. Register entries

**If deferred (the recommendation):**

| Subpath | Name | Change | Reason | Host action |
| --- | --- | --- | --- | --- |
| `/sdk` | `ref` | `deferred` | author-side node reference marker | none until 0.3.0 |
| `./schemas/*` | `catalog.json` | `deferred` | optional `refProps` name list per definition | none until 0.3.0 |
| `.` | `NodeRef` | `deferred` | documentation alias for a reference prop value | none until 0.3.0 |

Plus `docs/compatibility.md` § "Deferred to 0.3.0" with the before/after, a code sample and an
adopter checklist, and the owner's acknowledgement in the plan's Task 9 notes.

**If it ships in 0.2.2:** the same three as `added`/`widened`, plus `./react` `ImplementationProps`
(`domId` on `Item`), plus `.` `CompiledValidator`-adjacent helper declarations the check reports
(`KindsFacts` is internal; the printed helper carrying the tree validator would be the entry), and a
`widened` entry for `./schemas/* catalog.json`.

## 5. Cost and the performance obligation

- Validation: one `Set.has` per reference after the walk — no per-node cost for trees without refs,
  since the `for` loop is over nodes whose kind declares `refProps`.
- Build: one deferred list append per marker plus one lookup and byte correction per reference.
- The obligation for 0.3.0 (Task 10's criterion, carried over): `bun run bench` validator and render
  gates must not regress by more than 2%, measured on the 679-node `agent-home` tree with and without
  references, and `bun run bench` css gates must be unchanged.

## 6. Why not in 0.2.2

1. **No consumer and no proof.** 0 of 24 primitives declare a relation prop, so 0.2.2 would ship a
   format path that no catalog, proof scenario or corpus case exercises in anger — the corpus would
   test the feature against itself. The first real user should be the one that proves it, and that
   means a primitive (`textField.describedBy`, a `hint` slot/kind) that does not exist yet.
2. **The change reaches six subsystems**: catalog format (`formats/catalog.ts` + JSON Schema + a new
   `unknown-name` rule), the build pass (`sdk/render.ts` pending refs and byte correction), tree
   validation (`validate/tree.ts`, `validate/compile.ts` facts), codegen (`sdk/gen`), the renderer
   (`Item.domId`), and every port's validator plus the published corpus.
3. **It argues with spec §7.2.** "Building and validating are one pass" is a normative sentence that
   the deferred reference step bends. Either the spec gains a documented second step for references
   or the design is reworked; that is a spec decision, not a patch patch-up.
4. **Ports pay for it first.** A port built against 0.2.1 rejects a catalog using `refProps` until it
   is updated, exactly like the new recipe states — but the states shipped because hosts needed
   busy/mixed/current/read-only cues *now*, and nothing needs a reference now.
5. **The workaround is honest.** A host can wire `aria-describedby` today with literal ids through
   string props. It is less automatic, not impossible; the release does not leave anyone blocked.

If the owner prefers to ship in 0.2.2 anyway, this design is the smallest additive shape that holds:
it needs no new node field, no patch-format change, no wire marker and no new DOM wrapper, and its
per-node cost is zero for trees that use no references.

## 7. Security (laws 2 and 4)

- A reference is **data**, validated against the very tree being drawn. It cannot select a validator,
  run code, or reach outside its tree: ids are per-tree key paths, and the id set is the tree's own.
- It **carries no authority**: it grants no intent, changes no offered event, and cannot widen what
  `checkOffered` accepts. A dangling reference fails closed at validation.
- It **cannot address another surface**: the tree's id set contains only its own nodes, DOM ids are
  prefixed per surface, and surfaces never nest (spec §11).

## 8. Approval

- Proposed by: agent.
- Status: **awaiting the owner.** The approval line and its verbatim evidence go in the decision log
  once given; the plan's Task 9 notes record the acknowledgement, and Task 10 becomes
  `n/a — deferred to 0.3.0 (Task 9)`.

## References

- [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/) §6.6.4 Relationship Attributes — the `IDREF`
  and `IDREFS` attributes this design exists for.
- [MDN `aria-describedby`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-describedby)
  — "it must reference elements in the same DOM document"; the same id-list rule applies to
  `aria-labelledby` and `aria-controls`, and [`aria-errormessage`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-errormessage)
  applies only while `aria-invalid=true`.
- `docs/spec.md` §5 (schema language), §7.1 (key paths), §7.2 (one pass), §9.1 (patches), §10,
  §11 (renderer, switching).
- `src/schema.ts:147-156` — the closed keyword set per type.
- `src/formats/catalog.ts:11,24,220-237` — the prop-name pattern, `a11y.name`'s string-prop rule.
- `src/sdk/render.ts:80-100,150-190,463-560` — the id set, the single emit pass, byte counting.
- `src/validate/tree.ts:180-205` — the id set and key-path checks arrival validation already does.
- `src/react/renderer.tsx:360-402` — `Item` fields, `data-lf-node` under `diagnostics` only.
- `decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md` — the gate on `nodeRef()`
  and the revisit trigger this proposal fires.
- [React `useId`](https://react.dev/reference/react/useId) — per-surface id prefix; React peer
  `^19.0.0`.
