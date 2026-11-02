# Plan 022 Task 12 — multiple variant axes design

Design only; no code. Status: **proposal, awaiting the owner's approval** (the recommendation is to
approve it as 0.3.0 scope). Companion: [`022-extension-properties-design.md`](022-extension-properties-design.md).

## Recommendation

Let a definition declare **axes**: extra closed look choices (`tone`, `emphasis`, `size`) beside the
existing `variant`. An axis is an **enum prop the catalog marks as a recipe axis**, so the UI tree,
patches, SDK and elements schema do not change. Recipes address an axis value with a new key form,
`<kind>.<axis>:<value>.<slot>.<state>`, which is an overlay in the cascade, not a new combinatorial
dimension to complete. The resolver expands the overlays into the same flat table the projection
already consumes. Compound variants stay out. Every existing document, class name and CSS byte stays
identical, so no format version bump is needed.

## 1. The problem

`variants` is one closed axis (spec §5, §6.2). The 2026-10-22 format-scope decision rejected
multi-axis variants for 1.0 because the proof needed one axis and "a cascade alone removes most of the
536-recipe duplication per system", and set the revisit trigger: *"if a reference host needs a second
variant axis"* (`decision-logs/2026-10-22-1905-phase-1-format-scope.md`, alternative 6).

With one axis, a kind that varies by two independent things (a button that is `primary`/`ghost` and
`neutral`/`critical`, at two sizes) needs the **product** as its variants (`primary-critical`,
`ghost-critical`, …). That is the duplication the cascade was meant to avoid, it makes the catalog
the place where look combinations are enumerated, and a new tone multiplies every existing variant.

## 2. Settled design (proposed for 0.3.0)

### 2.1 Format change

A definition gains an optional `axes` map. Each axis names an existing **string prop with an `enum`**
and a default:

```jsonc
{
  "kind": "button",
  "props": {
    "label": { "type": "string", "maxLength": 80 },
    "tone":  { "type": "string", "maxLength": 12, "enum": ["neutral", "critical", "positive"] }
  },
  "variants": ["default", "primary", "ghost"], "defaultVariant": "default",
  "axes": { "tone": { "default": "neutral" } }
}
```

`validateCatalog` rejects an axis whose name is not an enum string prop of that definition
(`unknown-name`, the rule `a11y.name` and the deferred `refProps` use), or whose `default` is not in
the enum (`invalid-prop`). At most 3 axes per kind, at most 16 values per axis, and at most 256
combinations (`variants` × product of axes) per kind. An axis prop may be required or optional; an
absent value means the default.

**Wire form: no change.** The axis value is an ordinary prop, so `liveframe/1`,
`liveframe/tree-patch/1`, `diffTrees`/`applyPatch`, node reuse, capture records, the SDK (`<Button
tone="critical" />`), generated types and the elements JSON Schema carry it today, and an agent
discovers it as an enum prop with a description. Props are already validated against the catalog
before render, so an axis value is always a member of its enum.

**Format versions.** No bump. `liveframe-catalog/1` gains one optional definition field and
`liveframe-design-system/1` widens the recipe-key pattern; a document that uses neither is accepted
exactly as in 0.2.x. A 0.2.x validator rejects a document that uses them (closed schemas), which is
fail-closed: the installer learns at install time, not at render.

### 2.2 Recipe keys

Today a key is `<kind>.<variant>.<slot>.<state>` and `<variant>` may be `*` (`keyName`,
`src/formats/design-system.ts:94`). The variant position also accepts `<axis>:<value>`:

```jsonc
"button.*.root.rest":            { "backgroundColor": "surface.control", "padding": "space.2" },
"button.primary.root.rest":      { "backgroundColor": "accent.fill" },
"button.tone:critical.root.rest":{ "backgroundColor": "status.critical" },
"button.tone:critical.root.hover":{ "backgroundColor": "status.critical.hover" }
```

`:` is not a legal character in kind, variant, axis or value names (`^[a-z][A-Za-z0-9-]*$`), so a key
is unambiguous and ports can still split on `.`. A key naming an axis or value the kind does not
declare is `unknown-name` at `/recipes/<key>`.

### 2.3 Cascade and completeness

The resolved style of `(kind, variant, axis values, slot, state)` merges, per property, in this
order, a later layer winning:

1. `kind.*.slot.rest`
2. `kind.variant.slot.rest`
3. for each axis, **in the order the definition declares them**: `kind.axis:value.slot.rest`
4. `kind.*.slot.state`
5. `kind.variant.slot.state`
6. for each axis, in the same order: `kind.axis:value.slot.state`

Layers 1, 2, 4 and 5 are the 0.2.x cascade in the same order, so a kind without axes resolves
exactly as before. The structure extends the existing rule "rest layers, then state layers, a
wildcard before a specific": an axis is more specific than the variant at its level, and a state
always beats rest. A state layer from the variant therefore outranks an axis's rest value, which is
the same way a variant's `hover` outranks a wildcard's `rest` today. A later-declared axis beats an
earlier one when both set a property; this is a stated rule, not an accident of source order.

**Completeness.** Unchanged and not multiplied. The `rest`-per-`(kind, variant, slot)` and
`focus`-for-event-kinds rules (§6.2) apply to the base layers only; axis overlays are optional, so a
new axis or value never makes an installed design system incomplete. A design system that does not
mention an axis renders every value of it as the base. **Compound variants** (a rule that applies
only to `tone=critical` *and* `emphasis=outline`) are not offered. A combination that really needs
its own look is a `variant`; that is the existing tool, and the rejection recorded in the format-scope
decision stands for compounds. Extension properties (companion design) take part in layers 3 and 6
by name like any property.

### 2.4 Projection

The flat table and the projection are kept, which is what keeps existing CSS byte-identical.

- `cascadeRecipes` (`src/resolve.ts:16`) enumerates, for a kind with axes, every
  `(variant, axis values…)` combination and merges layers 1–6 for each. A kind without axes takes
  today's path unchanged.
- A slot's class gains a positional suffix only when the kind declares axes:
  `lf_<kind>_<variant>__<v1>__<v2>_<slot>`, the axis values in declared order, defaults filled in.
  `__` already separates fixed suffixes and names contain no `_` (§6.4), so the encoding stays
  injective without carrying axis names. Kinds without axes keep `lf_<kind>_<variant>_<slot>`.
  `slotClass(kind, variant, slot, axes?)` gains one optional parameter.
- `<Surface>` computes the class in `slot(name)` (`src/react/renderer.tsx:366`) from the validated
  node's props and the definition's defaults. Implementations still call `item.slot("root")`, so no
  host code changes.
- State rules, `:where()` structure, forced-colour cues, reduced-transparency recovery and entry
  motion all reuse the existing per-table-entry code. The state selectors table, `@starting-style`
  and `suppressed` need no change.

**Why not delta layers in CSS** (one rule per axis value, composed by specificity). The projection
emits each state as a full snapshot of the merged recipe and suppresses a state equal to rest
(`stateDeclarations`, `src/css/design-system.ts:41`). A variant's `hover` snapshot restates the
variant's rest properties, so under delta layers it would override an axis's rest value on hover.
Fixing that means moving every state to deltas, which changes the bytes of every existing sheet.
Expansion keeps the bytes and costs size (§3).

### 2.5 Law 3

Axis values are closed enums chosen by widget authors, exactly as `variant` is, and select among
recipes the design system already owns. Widget code gains no colour, no CSS and no new authority.
The class suffix is built from catalog-validated names and the validated prop value, never from a
free string. `validateTree` and `<Surface>` re-validation guarantee enum membership before `slot()`
runs. Tests 0.3.0 must carry: an off-enum axis value is `invalid-prop` and renders nothing; a recipe
key that names an undeclared axis or value is rejected at install; an axis prop cannot reach a class
name when validation fails.

### 2.6 Compatibility

- **`classifyCatalogChange`.** Adding an axis to an existing enum prop, or an axis value, is
  **minor**. Removing an axis, changing its default, or removing a value is **major** (the last is
  already major as an enum change). `compareDefinition` (`catalog.ts:377`) gains an `axes` branch.
- **CSS and classes.** Kinds without axes: classes, rules and bytes identical (Certified 152,019 B,
  Rack 164,152 B, `bun bench/css.bench.ts`, 2026-11-02; pinned by 0.3.0 tests). Making an *existing*
  prop an axis changes that kind's class names (the suffix appears). It is an opt-in catalog edit, but
  it is observable to a host whose CSS or tests select `.lf_button_primary_root`; the migration
  entry lists it.
- **Conformance and audit.** `auditContrast` must resolve every combination, or an axis combination
  could ship unaudited. The `/conformance/react` state-fixture rule is extended per kind with axes:
  each axis value at least once (one-axis-at-a-time), not the full product. The full product is
  bounded by the 256-per-kind cap but is too many fixtures to require.
- **Corpus and ports.** Existing cases unchanged. New cases: a catalog with axes, a design system
  with axis keys, and invalid cases for each rule above (undeclared axis, undeclared value, default
  not in enum, axis on a non-enum prop, over the cap). A port must parse `axes`, accept the widened
  key pattern, implement layers 3 and 6 and the class suffix. Until it does, it rejects such a
  document at install.
- **Register entries (0.3.0).** `. Definition`, `. Catalog`/`Vocabulary` consumers as `widened`,
  `./css slotClass` as `widened` (optional fourth parameter), `./schemas/* catalog.json` and
  `design-system.json` as `widened`; `hostAction: none` except where the next section names one.

### 2.7 Migration

Nothing breaks for a document that does not use axes. Adopting is opt-in and has one observable step:

1. **Before** (one axis, product variants):
   ```ts
   variants: ["primary", "primary-critical", "ghost", "ghost-critical"]
   // recipes: button.primary-critical.root.rest, button.ghost-critical.root.rest, …
   // widget:  <Button variant="primary-critical" />
   ```
2. **After** (an axis):
   ```ts
   props: { tone: str({ maxLength: 12, enum: ["neutral", "critical"] }) },
   variants: ["primary", "ghost"], axes: { tone: { default: "neutral" } }
   // recipes: button.tone:critical.root.rest (once)
   // widget:  <Button variant="primary" tone="critical" />
   ```
3. Adopter checklist: (a) bump the catalog minor, not the major; (b) replace each product variant in
   widgets and corpus trees; (c) host CSS and tests that select an axis kind's class must use the
   new positional suffix (`lf_button_primary__neutral_root`), so search for `.lf_<kind>_` selectors;
   (d) design systems move product recipes into axis keys; (e) update ports before installing; (f)
   removing the old product variants is a **major** catalog change, so keep them until widgets have
   moved.

## 3. Cost and the benchmark 0.3.0 must meet

- **Validation:** catalog check is linear in axes × values, once per `compileValidator` (and cached
  by plan 022 Task 4). The tree validator already checks the prop; **zero** extra per-node work.
- **Resolved table and CSS size:** linear in combinations. A kind goes from V entries to
  V × Πaxis-sizes. Illustration on Certified (616 recipes → 152,019 B, about 247 B per resolved
  recipe on average): a button with 3 variants × 3 tones × 2 emphasis is 18 combinations, six times
  the entries of that kind. The cap of 256 combinations per kind and the existing 16,384-entry
  recipe limit bound it. This is the price of expansion; delta layers would avoid it at the cost of
  rewriting state emission (§2.4).
- **Gates for 0.3.0:** (a) kinds without axes: both reference sheets byte-identical and
  `bun bench/css.bench.ts` within noise of a same-session baseline; (b) an axes fixture (a button
  with 4 variants × 3 × 2) projects in ≤ 1.1× the time linear extrapolation from the per-recipe cost
  predicts, and its added size is reported per combination; (c) the validator and render gates of
  `bun run bench` do not regress beyond 2% on `agent-home` (679 nodes) when the catalog declares
  axes but the tree uses the defaults; (d) the warm switch stays ≤ 16.67 ms with the axes fixture
  installed, since more class rules is exactly what the switch budget is sensitive to.

## 4. Security (laws)

Law 3 is §2.5. Law 2: the axis value is validated prop data and no tree or patch field is added.
Law 4: no authority. Law 1: no code. The only new string-to-selector path is the class suffix, built
from catalog-validated enum values.

## 5. Alternatives rejected

| Alternative | Why not |
|---|---|
| A new node field (`axes: { tone: "critical" }`) | Changes the tree, the patch `set` op, `diffTrees`/`applyPatch`, the elements schema, the SDK attribute split and every port's wire code, for no benefit over a validated enum prop. A fail-closed rejection by 0.2.x trees means a `liveframe/1` consumer cannot read a tree that merely uses a look choice. |
| Product variants (status quo) | Duplicates recipes and enumerates look combinations in the catalog; the multiplicative cost this design pays in CSS it also pays in catalog and widgets there. |
| Compound variants (Panda `compoundVariants`) | Another cascade dimension, completeness questions for every pair, and no reference host has asked. A `variant` covers a combination that really needs its own look. The spec already lists compound variants as outside the projection (§6.4). |
| Delta CSS layers per axis value | Breaks the snapshot-per-state emission and would change every existing sheet (§2.4). |
| Axis order by recipe-key position or source order | Not deterministic across `extends`; declared order is a catalog fact. |
| Require every axis value in every design system | A new tone would make every installed design system incomplete, turning a minor change into a major one. |
| Class suffix carrying axis names | Longer classes for no information; the catalog fixes the positions. |
| Axis values as `data-*` attributes read by selectors | The renderer would have to know the active design system's recipes, and a CSS-only change would not be reflected in `slot()` classes that implementations already use. |

## 6. References

- Spec §5 (definitions), §6.2 (recipes, cascade, completeness), §6.4 (classes, states), §9 and §9.1
  (the tree and patch formats); `src/formats/catalog.ts:377-395`, `src/resolve.ts:16-86`,
  `src/formats/design-system.ts:94`, `src/css/names.ts:5`, `src/css/design-system.ts:41,127-191`,
  `src/react/renderer.tsx:366`.
- `decision-logs/2026-10-22-1905-phase-1-format-scope.md` (one axis, revisit trigger),
  `decision-logs/2026-10-23-2314-css-projection-model.md`,
  `decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md`.
- [MDN cascade](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Cascade): origin,
  specificity, order of appearance; layers; `:where()` carries no specificity. Accessed 2026-11-02.
  CSS Custom Properties and `@property` Baseline status is recorded in the companion design.
