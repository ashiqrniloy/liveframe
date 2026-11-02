# Plan 022 Task 12 — extension recipe properties design

Design only; no code. Status: **proposal, awaiting the owner's approval** (the recommendation is to
approve it as 0.3.0 scope). Companion: [`022-variant-axes-design.md`](022-variant-axes-design.md).

## Recommendation

Let an app declare **extension recipe properties**: named, typed look values that a design system
sets per `(kind, variant, slot, state)` like any recipe property, and that the projection emits as
CSS custom properties (`--lf-p-<name>`) for the app's trusted primitive CSS to read. Two value types
ship in 0.3.0, `colour` and `value`. Every existing document, hash, corpus case and CSS byte stays
identical, so no format version bump is needed.

## 1. The problem

Recipe properties are a closed list fixed by the library (`recipeProperties`, `src/formats/fixed.ts:87`,
spec §6.2): 30 names. A design system cannot vary a look the list does not name, however legitimate
(an ornament colour, a corner-notch size, an inset-highlight opacity). Today the only ways out are:

- add the name to the library's list, which makes every app's vocabulary the library's vocabulary and
  needs a library release plus every port for each new name (it is how `placeholderColor` and the
  scrollbar pair arrived, on Clay's demand: `decision-logs/2026-10-28-1123-styling-paint-alpha-contrast-native-parts.md`);
- or hard-code the look in the app's primitive CSS, which a design-system switch cannot change. This
  breaks "look must change with the design system" (`decision-logs/2026-10-22-0850-recipes-own-look-style-props-own-structure.md`).

The 2026-10-22 decision settled who owns what: recipes own the look, the app owns structure. An
extension keeps both halves: the **app** declares the name and type; the **design system** supplies
the value; **trusted app CSS** decides what the value paints.

## 2. Settled design (proposed for 0.3.0)

### 2.1 Format change

Catalog vocabulary gains an optional map (§6.5):

```jsonc
"vocabulary": {
  /* … */
  "extensions": {
    "sheen":  { "type": "colour",                    "description": "Highlight along the top edge." },
    "notch":  { "type": "value", "kind": "size",      "description": "Corner notch size." },
    "glow":   { "type": "value", "kind": "opacity" }
  }
}
```

- Names match `^[a-z][A-Za-z0-9-]*$` (≤ 64 characters), at most 64 per catalog. No `_` and no `.`, so
  the projected variable name is injective like the other families.
- `type` is `colour` or `value`. `kind` (for `value`) is one of the existing design-value kinds
  `spacing`, `radius`, `border-width`, `size`, `opacity`, `motion-duration`, `saturation`,
  `backdrop-blur`. `easing`, `shadow`, `breakpoint` and typography roles are excluded in 0.3.0 (§5).

A recipe gains one optional nested map. Extension values never sit beside the fixed properties, so a
future library property can never collide with an app's extension name:

```jsonc
"button.primary.root.rest": {
  "backgroundColor": "accent.fill",
  "extensions": { "sheen": "accent.highlight", "notch": "size.notch" }
}
```

- `colour`: a theme role or `none` (projects `transparent`). Same check as `backgroundColor`
  (`colour-outside-theme`), but the `{ role, alpha }` object is not offered (§5).
- `value`: a design-value name of that `kind`, or a bounded literal of it, the same `oneOf` every
  numeric recipe property already uses (`propertySchema`, `src/formats/design-system.ts:116`).
- An unknown extension name, or a value of the wrong type, is `unknown-name` or `invalid-prop` at
  `/recipes/<key>/extensions/<name>`.

**Format versions.** No bump. `liveframe-catalog/1` and `liveframe-design-system/1` gain optional
fields; a document without them is byte-for-byte what 0.2.x accepts. A 0.2.x validator rejects a
document that uses them, because both schemas are closed (`additionalProperties: false`). That is
the fail-closed behaviour 0.2.2's recipe states and the deferred `refProps` already rely on: a port
cannot silently drop a value that carries meaning. A `/2` id would not improve that and would force
every unchanged document through a migration.

### 2.2 Law 3

Law 3 constrains widget code and installed style data, not trusted app primitive CSS (spec §6.2).
It holds because:

1. **Widget code cannot set an extension.** The values live in the design system, next to recipes.
   Style props and the tree format do not change. A widget cannot name `--lf-p-*`.
2. **No installed string reaches CSS unchecked.** A colour is a declared theme role (the same
   `colours` set check as every colour property); a value is a typed design value or a bounded
   literal checked by `checkValue`; the property name is a validated token. There is no string,
   enum or free-form type.
3. **No literal colour.** `colour` accepts roles only, so colour authority stays in the theme.
4. **The variable is inert.** `--lf-p-<name>` paints nothing until the app's own CSS reads it.
   Anything the app does with it is trusted app code, as for its other primitive CSS.

Tests 0.3.0 must carry: a literal colour, a role that is not in the theme, a string in a `value`
slot, an unknown extension name, and a name containing `;`, `}` or `/` are each rejected at install
with the typed error and pointer above.

### 2.3 Projection

Each extension in a resolved recipe adds one declaration to that recipe's body, after the fixed
declarations and sorted by name (so output is deterministic and key-order independent):

```css
.lf_button_primary_root{background-color:var(--lf-c-accent-fill);--lf-p-notch:6px;--lf-p-sheen:var(--lf-c-accent-highlight)}
```

- `colour` projects `var(--lf-c-<role>)` or `transparent`; `value` projects the resolved literal
  (`6px`, `0.35`, `140ms`), as `recipeDeclarations` does for the fixed numeric properties.
- States follow the existing rule: a state whose body equals rest emits nothing, so an extension that
  only changes on hover costs one rule.
- The app's CSS reads it as `var(--lf-p-sheen, <app default>)`. An unset extension is the
  guaranteed-invalid value, so the `var()` fallback applies. That is the whole "completeness" story
  (§2.4).
- **Inheritance.** Custom properties inherit, so a root slot's value reaches descendant slots that
  do not set their own. The app's CSS reads the property on the slot that declares it. The proposal
  does not add a reset rule: a `* { --lf-p-…: initial }` reset would put a declaration on every
  element and add style-recalculation cost to the switch path that
  `decision-logs/2026-10-31-1438-webkit-switching-cost-remedies.md` is guarding. If an adopter hits
  a leak, 0.3.0 measures the reset before adding it.
- Not registered with `@property`. Registration is Baseline 2024, newly available since July 2024
  (MDN, accessed 2026-11-02), so it is inside the platform floor, but it is document-global rather
  than scoped to `[data-lf-ds]`, and a registered property always has an initial value, which defeats
  the `var()` fallback that expresses "unset".
- Forced colours and reduced transparency: unchanged. The projection never writes
  `forced-color-adjust`; the OS overrides whatever the app's CSS paints from a custom property.
  `colour` carries no alpha modifier, so reduced transparency has nothing to recover.

### 2.4 Cascade and completeness

- **Cascade.** Extensions merge per name through the four existing layers
  (`kind.*.slot.rest`, `kind.variant.slot.rest`, `kind.*.slot.state`, `kind.variant.slot.state`),
  later wins. The `extensions` maps merge by key, not as one replaced block, so a variant can set
  `notch` without erasing a wildcard's `sheen`. `extends` inherits them like every other recipe key.
  With variant axes (companion design) they take part in the axis layers the same way.
- **Completeness.** Extensions are optional overlays. A design system is complete without them, and
  declaring a new extension never makes an installed design system incomplete. The `rest`-style and
  `focus`-overlay rules (§6.2 Completeness) are unchanged. A `required` flag was considered and
  rejected (§5).
- **`auditContrast`.** An extension colour is not audited, because the library cannot know which
  background the app paints it against. The audit's output is unchanged for existing inputs. The
  limit is documented in `docs/styling.md`.

### 2.5 Compatibility

- **`classifyCatalogChange`** (`src/formats/catalog.ts:416`). Adding an extension is **minor**.
  Removing one, changing its `type` or `kind` is **major**, because an installed design system that
  sets it would stop validating. A description-only change is ignored.
  `compareVocabulary` (`catalog.ts:397`) treats every key as a name list, so it needs an explicit
  branch for `extensions`; the map must not fall into `compareNames`.
- **CSS bytes.** With no extensions declared, no `extensions` key can validate, so every existing
  sheet is byte-identical. The reference bytes are Certified's design system 152,019 B and Rack's
  164,152 B (`bun bench/css.bench.ts`, 2026-11-02); the 0.3.0 tests pin them.
- **Corpus.** Existing cases unchanged. New cases: a catalog with extensions, a design system that
  uses them, and one invalid case per rule in §2.2. The JSON Schemas (`schemas/catalog.json`,
  `schemas/design-system.json`) widen; their `$id`s stay.
- **Ports.** A port must parse `vocabulary.extensions`, parse a recipe's `extensions`, merge them
  per name through the cascade, and emit the declaration. A port that does not will reject such a
  document at install; it never renders it wrongly.
- **Conformance.** `designSystemSuite` gains the extension rules. The renderer's "every styled state
  differing from rest has a reachable fixture" rule already covers a state that differs only in an
  extension.
- **Register entries (0.3.0).** `. Vocabulary`, `. Recipe` and `. ResolvedRecipe` as `widened`;
  `./schemas/* catalog.json` and `design-system.json` as `widened`; all `hostAction: none`.

### 2.6 Migration

No existing contract breaks, so there is no before/after to migrate. Adopting is opt-in:

1. Declare the extension in the catalog vocabulary (minor change, same `catalogId`).
2. Set it in each design system's recipes. Systems that do not set it keep working.
3. Read `var(--lf-p-<name>, <fallback>)` in the app's primitive CSS.
4. Update any non-TypeScript port before installing documents that use extensions.

## 3. Cost and the benchmark 0.3.0 must meet

- **Validation:** one check per declared extension entry, after the existing property checks. Zero
  work when absent. Install-time only, never on the render path.
- **Projection size:** about 35 bytes per `--lf-p-name:var(--lf-c-role)` declaration (about 12 for a
  short value literal). Worst case, one colour extension set on every one of Certified's 616
  resolved recipes is about +22 KB on 152,019 B (+14%); realistic use sets it on a few slots.
- **Gates for 0.3.0:** (a) with no extensions, both reference sheets are byte-identical and
  `bun bench/css.bench.ts` is within noise of the pre-change run on the same machine and load;
  (b) with one colour extension on every recipe, size ≤ +16% and `designSystemCss` time ≤ +20%;
  (c) the warm switch stays ≤ 16.67 ms (`src/__tests__/css-scope-browser.test.ts`) with the
  extension fixture installed. The 2026-11-02 bench ran on a loaded host (design-system sheets
  32.0 ms and 41.1 ms), so the time gates are relative to a same-session baseline, not absolute.

## 4. Security (laws)

Law 3 analysis is §2.2. Law 2: nothing changes in the UI tree. Law 4: an extension is data, not
authority. Law 1: no code. The design adds one injection surface, a property name and a value, and
closes both with the existing validators; the rejection tests in §2.2 are the proof obligation.

## 5. Alternatives rejected

| Alternative | Why not |
|---|---|
| Keep adding names to `recipeProperties` | Every app's look becomes a library release plus a port change; the closed list was meant to stop exactly this. Stays the route for properties every app wants. |
| Flat extension keys beside fixed ones (`"x-sheen"`) | Needs a pattern-keyed schema form, the closed schema language has none, and a future fixed name could collide. A nested map is a plain closed object. |
| An `enum` / string type | The app's CSS would have to branch on an ident with container style queries. Style queries on custom properties are Baseline newly available since 2026-05-19 per secondary sources (Chrome 111, Safari 18, Firefox 151; not checked against the primary `web-features` data), which is outside the project's Baseline 2024 floor. Revisit when that is widely available. |
| `{ role, alpha }` colours | Would need the reduced-transparency recovery path (`unmodifiedColours`, `src/css/design-system.ts:83`) extended to a new family. Additive later. |
| `required` extensions (like declared values) | Adding one would make every installed design system incomplete, turning a minor catalog change into a major one. Optional with an app fallback is the smaller contract. |
| A reset rule so values never inherit | Declares on every element; costs style recalculation on the switch path. Measure first. |
| Register with `@property` | Document-global, and an initial value defeats the `var()` fallback (§2.3). |
| Per-kind scoping of an extension (`kinds: [...]`) | A mistake would be harmless (an unread variable), and it adds a rule to the catalog, the cascade and the classifier. Additive later. |
| Raw CSS or free-form strings | Breaks law 3. |

## 6. References

- Spec §6.2 (recipes, closed property list), §6.4 (projection, variable families, cascade), §6.5
  (vocabulary); `src/formats/fixed.ts`, `src/formats/design-system.ts:46-154`, `src/resolve.ts:16-86`,
  `src/css/recipe.ts`, `src/css/design-system.ts`, `src/formats/catalog.ts:397-440`.
- `decision-logs/2026-10-22-0850-recipes-own-look-style-props-own-structure.md`,
  `decision-logs/2026-10-22-1905-phase-1-format-scope.md`,
  `decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md`.
- [MDN `@property`](https://developer.mozilla.org/en-US/docs/Web/CSS/@property): Baseline 2024,
  newly available since July 2024; `inherits` is required. Accessed 2026-11-02.
- [MDN container style queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_size_and_style_queries):
  only custom properties work in `style()`. Browser dates from a web search, secondary sources.
- [MDN cascade](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Cascade): origin,
  specificity, order of appearance; `:where()` adds no specificity.
