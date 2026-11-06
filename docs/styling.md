# Projecting and loading styles

`@arnilo/liveframe/css` turns a catalog, theme and design system into CSS strings
and gives renderers plain attributes, classes and style declarations. It has no
DOM dependency and inserts nothing into the page. The host loads the sheets and
draws validated trees with its own primitive implementations.

The package is pre-1.0. The CSS projection is implemented, and the public
React renderer ships in `@arnilo/liveframe/react`. See the [format guide](formats.md#theme) for theme,
design-system and vocabulary formats, and [spec §6.4](spec.md#64-how-styling-reaches-the-screen)
for the normative projection contract.

Run the [conformance kit](conformance.md) against your installed styles and app
CSS, then prove styled-state reachability with your primitive implementations.

## Generate three independent sheets

Use the same installed catalog for every theme and design system on a page.
The host supplies `catalog`, `theme` and `designSystem`; `registry` is a plain record of
installed design systems keyed by `id@version`, used to resolve inheritance.
It can be empty when the system has no parent.

```ts
import type { Result } from "@arnilo/liveframe";
import { baseCss, designSystemCss, themeCss } from "@arnilo/liveframe/css";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const sheets = {
  base: value(baseCss(catalog)),
  theme: value(themeCss(theme, catalog)),
  designSystem: value(designSystemCss(designSystem, { catalog, registry })),
};
```

All three functions return `Result<string>`, validating inputs before emitting
anything. Invalid inputs return typed errors with no partial sheet. Identical
inputs, including inputs with reordered object keys, produce identical bytes.

Declare required contrast pairs in the catalog vocabulary (see the
[theme format](formats.md#theme)). `validateTheme`, `themeCss` and the conformance
kit's `every_theme_installs` case check every supplied theme, including alpha
compositing and optional upper bounds/orderings. A failure returns
`insufficient-contrast`; a translucent background without an opaque declared
`contrastBase` is invalid theme data. These checks run when installing/generating
styles; cache installed inputs and sheets to avoid repeating them per render.

Vocabulary pairs are declared by hand, so they miss pairs only the recipes create:
`textColor` on a `backgroundColor`, a `placeholderColor`, a border or a focus
outline. `auditContrast({ theme, designSystem, catalog, registry?, minimums? })`
from `@arnilo/liveframe` closes that gap. It resolves every `(kind, variant,
slot, state)` through the same cascade and reports each pair below its
threshold: text and placeholder colours against the effective background
(the slot's, else its kind's root slot's, else the vocabulary's `contrastBase`)
at 4.5:1, or 3:1 for large text from the resolved typography role (18 pt, or
14 pt at weight 700 or more, WCAG 2.2 §1.4.3); and, for kinds that declare
events, `borderColor` at rest and `outlineColor` at focus at 3:1 (WCAG 2.2
§1.4.11). Alpha composites the way §6.5 defines it — theme alpha, role alpha
and `backgroundOpacity` once each — and a pair whose background cannot be
resolved is reported as `unresolved-background` rather than measured against a
guess. Each finding names the recipe key, both roles, the ratio to two decimals
and the threshold. It is an install-time audit, never part of a render, and it
grants nothing: it reads the theme's roles and introduces no colour.

```ts
const audit = auditContrast({ theme, designSystem, catalog, registry });
if (!audit.ok) report(audit.errors); // the same typed errors the install validators give
else for (const finding of audit.value) report(finding); // key, foreground, background, ratio, minimum
```

Opt in to failing on findings with the conformance kit:
`designSystemSuite({ catalog, themes, designSystems, contrast: true })`, or
`contrast: { minimums: { text, largeText, nonText } }` to override thresholds.

| Sheet | Contents | Regenerate when |
| --- | --- | --- |
| Base | Generic reset, surface typography, optional containment, preference and switching overrides | The catalog changes |
| Theme | Colour and typography variables, `color-scheme` | The theme or catalog changes |
| Design system | Design-value variables, recipes, ordered states, container breakpoints, forced-colour cues | The system, an inherited system or catalog changes |

For a fixed catalog, N themes and M design systems need N + M + 1 sheets.
Generate and cache them by input, including inherited systems, rather than per
widget render. Treat installed inputs as immutable. A theme change does not
require regenerating a design-system sheet.

The host can serve each string as a CSS file with a `<link rel="stylesheet">`,
or set a `<style>` element's `textContent` to the string. Load base, theme and
design-system sheets before displaying a surface; preload alternate sheets
before a switch. Sheets use surface scopes and can coexist on one page.
They are emitted outside cascade layers; the host chooses any layer policy.
The reset affects surface descendants, so unrelated host markup stays outside
its scope. Host CSS can still override rules through the normal cascade.

The host authorizes sheet loading through its CSP: allow the stylesheet URL or
use the appropriate nonce for a `<style>` element. Rendered layout uses inline
style attributes, which require `style-src-attr 'unsafe-inline'`. A sheet nonce
does not authorize those attributes; an atomic-class alternative is not provided.

## Scope a surface and project a node

```ts
import { slotClass, styleDeclarations, surfaceAttributes } from "@arnilo/liveframe/css";

const attributes = surfaceAttributes({ theme, designSystem, tree });
// { class: "lf_surface lf_container", "data-lf-theme": "acme@1", "data-lf-ds": "rack@1" }

const root = slotClass("button", "primary", "root");
const label = slotClass("button", "primary", "label");
const layout = styleDeclarations(tree.root.style ?? {}, catalog);
// layout: { style: Record<string, string>, classes: readonly string[] }
```

Apply `attributes` to the surface root. Its `class` always includes `lf_surface`;
`lf_container` appears only if the tree contains responsive style values.
`data-lf-theme` and `data-lf-ds` select `id@version` sheets independently. Surfaces
must never nest, including surfaces composed by the host. Put this scope
container above the rendered tree root: a size query styles descendants, so a
responsive tree root cannot use itself as its query container.

Apply each node's `layout.classes` alongside its root slot class and set every
entry of `layout.style` through the renderer's style object. Ordinary property
names use camel case, such as `paddingInlineStart`; responsive custom properties
keep their `--lf-r-*` names. A DOM host assigns ordinary properties on
`element.style` and uses `element.style.setProperty(name, value)` for custom
properties. React accepts this shape as its `style` prop.
`styleDeclarations` expects a validated node's style and an installed catalog;
it throws for unknown props or invalid values. It does not replace tree
validation or per-kind style-prop permission checks.

Responsive values use the surface's named inline-size container `lf`, rather
than the viewport, with breakpoint widths from the selected design system.
A value holds at wider breakpoints until another value replaces it. Left/right
padding, margin and border widths project to logical inline start/end and mirror
under `dir="rtl"`; top and bottom remain physical.
`minHeight` and `maxHeight` take the same values as `minWidth` and `maxWidth` and
project to `min-height` and `max-height`, as `height` projects to `height`. A
percentage height resolves only against a parent with a definite height; with an
auto-height parent it behaves as `auto`, so prefer a `size.*` value there.
A fraction (`2fr`) on `width`, `height`, `minWidth`, `maxWidth`, `minHeight` or `maxHeight`
is rejected as `invalid-prop`, including inside responsive values. Use `grow={2}`
with `basis={0}`, or put the fraction in the parent's `columns` or `rows`. Fractions in `columns` and `rows` tracks are unchanged.
`deferOffscreen` marks long repeated content, such as list rows, that the
engine may skip while it is offscreen. It takes a `space.*` or `size.*` value
and projects to `content-visibility: auto` plus
`contain-intrinsic-block-size: auto var(--lf-v-…)`; the value is the
placeholder height until the element first renders, after which the engine
remembers the rendered size. A design-system switch then restyles and lays
out only what is on screen, which keeps a long surface's switch inside
16.67 ms. Each marked element clips its overflow, becomes the containing
block for absolutely positioned descendants, becomes a stacking context that
paints above earlier `z-index: auto` positioned siblings, and loses its
baseline, so mark
self-contained blocks only. Keep focus rings inset, and render overlays
through the portal. Its content stays focusable, in tab order and findable;
reading geometry from a skipped node forces it to render. Engines without
`content-visibility` ignore it.
When a system mixes `px` and `rem` breakpoint units, ordering currently assumes
a 16px root font size; use one unit for consistent ordering at other root sizes.

## Renderer contract

For React bindings, arrival validation, intents, overlays and server rendering,
see [Render validated trees with React](renderer.md). The app's implementations
deliver the interaction and overlay lifecycle described here.

Every rendered slot carries exactly one recipe class from
`slotClass(kind, variant, slot)`, such as `lf_button_primary_label`. It stays the
same under every state, theme and design system. Keep the root class on the
primitive root so its state reaches descendant slots. Every text slot needs a
typography role in its recipes; the surface root uses `vocabulary.surfaceTypography`.

Expose state through native semantics or the following attributes. Presence
attributes such as `data-disabled` must be removed when false, rather than set
to the string `"false"`. ARIA attributes retain their accessibility semantics.

| State | Matching selectors |
| --- | --- |
| hover | `:hover` on hover-capable devices; `[data-hovered]` on any device |
| active | `:active`, `[data-pressed]` |
| focus | `:focus-visible`, `[data-focus-visible]`, `:has(:focus-visible)` |
| open | `[open]`, `[data-open]`, `[data-expanded]`, `[aria-expanded=true]`, `:popover-open` |
| selected | `[data-selected]`, `[aria-selected=true]`, `[aria-checked=true]` |
| current | `[aria-current]:not([aria-current=false])`, `[data-current]` |
| mixed | `[aria-checked=mixed]`, `[aria-pressed=mixed]`, `:indeterminate`, `[data-mixed]` |
| pending | `[aria-busy=true]`, `[data-pending]` |
| readonly | `[aria-readonly=true]`, `[readonly]`, `[data-readonly]` |
| invalid | `:user-invalid`, `[data-invalid]`, `[aria-invalid=true]` |
| disabled | `:disabled`, `[data-disabled]`, `[aria-disabled=true]` |

Precedence is
`rest < hover < focus < active < open < selected < current < mixed < pending < readonly < invalid < disabled`,
with [app states](#app-states) between `invalid` and `disabled`. Recipe selectors have one class of specificity; source order decides between
states. Equal-to-rest states emit no extra rule. Disabled roots suppress hover
and active on themselves and their slots; once a system styles `pending`, a
pending root suppresses them the same way. A system with no `pending` recipe
projects exactly the CSS it did in 0.2.1. A behaviour library can provide the
state attributes; the projection supplies no interaction or accessibility logic.

Keep overlays inside the surface's scope. A top-layer dialog or popover can
retain its DOM ancestry; a portal needs a container with the same scope
attributes and surface classes, including `lf_container` when required. Include
all such containers in switches. The backdrop and overlay content must be
siblings, with no backdrop ancestor setting opacity below 1 or a filter that
forms a backdrop root and prevents sampling the page behind it.

An open recipe that differs from rest receives `@starting-style` entry rules,
using its declared transition. Exit motion, delayed unmounting, scroll locking
and making the background inert remain renderer responsibilities.

## Switch without re-rendering

After the next theme and design-system sheets have loaded, update all scope
containers for that surface together:

1. Set `data-lf-switching` on each scope container.
2. Change `data-lf-theme` and/or `data-lf-ds` synchronously to the selected `id@version`.
3. Ensure the browser computes the new styles while the switching marker is
   present, then remove it on the next animation frame.

For a single DOM scope, the host can use:

```ts
scope.setAttribute("data-lf-switching", "");
scope.setAttribute("data-lf-theme", `${nextTheme.id}@${nextTheme.version}`);
scope.setAttribute("data-lf-ds", `${nextSystem.id}@${nextSystem.version}`);
void scope.offsetWidth; // Commit the switch while transitions are suppressed.
requestAnimationFrame(() => scope.removeAttribute("data-lf-switching"));
```

The host owns these DOM operations. Slot classes, node identities and widget
output stay the same, and no widget code runs. Keep alternate sheets loaded;
removing a sheet still used by another surface would unstyle that surface.

Recipe `backgroundColor`, `borderColor` and `outlineColor` accept `"none"` to
clear paint inherited through the recipe cascade. They emit `transparent`,
including when `backgroundOpacity` is set. Omitting a property inherits it.
`textColor` and shadow colours exclude `none`; an empty shadow array
clears shadows. The exact colour-role name `none` is reserved in vocabularies.
In forced colours, an explicit rest background of `none` with no positive border
width retains the inward 1px OS-colour outline; an absent background adds no edge.

Recipe colours and shadow layer colours also accept `{ role, alpha }`, for
example `{ "role": "border.hairline", "alpha": "opacity.subtle" }`. Alpha is
a number in [0, 1] with at most four decimal places, or an `opacity` design
value name with the same precision. The projection emits
`color-mix(in oklab, var(--lf-c-border_hairline) N%, transparent)`; intrinsic
theme alpha is multiplied. On backgrounds this composes with `backgroundOpacity`,
so neither modifier replaces or doubles the other. Plain roles keep their direct
variable references.

## Preferences and platform

The projection handles reduced motion by setting transition durations to zero
and removing the pressed offset. Reduced transparency forces the background-opacity
multiplier to 1, removes backdrop filters and restores unmodified theme-role references
for colour and shadow modifiers, even alpha 0. Theme-intrinsic alpha and explicit
no-paint stay unchanged. It applies either when the OS asks for it
(`prefers-reduced-transparency: reduce`, a progressive enhancement) or when the host
renders `<Surface transparency="reduced">`; the latter sets `data-lf-transparency="reduced"`
on the scope containers and the sheets emit the same forcing and recovery rules under
that attribute, so a modifier resolves identically with or without OS support.
Forced-colours mode keeps `forced-color-adjust: auto` and adds OS
system-colour state cues and outlines for background-only edges and fill shapes.
Real Windows and assistive-technology auditing remains an open manual gate.

The browser suite runs in Chromium, Firefox and Playwright WebKit. Two
headless-engine limitations are recorded rather than treated as library
defects: Playwright WebKit 27.2 on Linux reports `(forced-colors: active)` but
does not apply the UA forced-colour mapping, so its forced-colour-only checks
are skipped; Chromium and Firefox prove those rules. Headless WebKit and Firefox accept `backdrop-filter` and
report its computed value, but do not paint it in screenshots, so the pixel
comparison runs in Chromium and the computed-style check runs in all three.
`scrollbar-color`, `::placeholder`, `color-mix()`, reduced-transparency recovery,
container queries, `:user-invalid`, `:popover-open`, `@starting-style`,
`font-size-adjust` and `text-wrap: balance` are checked in all three.

The host chooses light, dark and high-contrast themes, including any response
to `prefers-color-scheme` or `prefers-contrast`. Each theme sheet sets its own
`color-scheme`, which also styles native controls and scrollbars.

Recipes style two native parts with theme roles, `"none"` or `{ role, alpha }`.
`placeholderColor` goes on the slot you attach to the input or textarea and
projects `::placeholder { color; opacity: 1 }`; it honours every state.
`scrollbarThumbColor` and `scrollbarTrackColor` go on the scrolling slot and
project to `scrollbar-color: <thumb> <track>`. Declare both, and only in rest
recipes: a state that declares either is rejected at install, and states inherit
the rest pair. Thumb hover and press are the OS's. Safari before 26.2 and
WebKitGTK before 2.52.3 keep their native scrollbars, and no `::-webkit-scrollbar`
fallback is emitted. In forced colours the sheet sets `scrollbar-color: auto` and
a `GrayText` placeholder, leaving both to the OS.

The platform floor is Baseline 2024: custom properties, `:is`/`:where`/`:has`,
`color-mix()`, `oklch()` and `color()`, container queries, `:user-invalid`,
`:popover-open`, `@starting-style`, unprefixed `backdrop-filter`, `font-size-adjust`
and `text-wrap: balance`. Shadow-DOM isolation, nested surfaces and vertical
writing modes are outside this contract.

## Variant axes

A kind that varies by two independent things, such as a button that is `primary` or
`ghost` and `neutral` or `critical`, does not need a variant per pair. Declare the
second choice as an **axis**, an enum prop the catalog marks:

```jsonc
// catalog.json, the button definition
"props": { "properties": { "label": { "type": "string", "maxLength": 80 },
  "tone": { "type": "string", "maxLength": 12, "enum": ["neutral", "critical"] } } },
"variants": ["primary", "ghost"],
"axes": { "tone": { "default": "neutral" } }
```

A widget writes `<Button variant="ghost" tone="critical" label="Delete" />`. The
design system gives each axis value an overlay recipe, and an overlay can **alias
colour roles** so one entry recolours every variant:

```jsonc
// design-system.json
"button.primary.root.rest": { "backgroundColor": "accent.fill", "textColor": "accent.on-fill" },
"button.ghost.root.rest":   { "backgroundColor": "none", "textColor": "accent.text" },
"button.tone:neutral.root.rest":  { "roles": { "accent": "status.neutral" } },
"button.tone:critical.root.rest": { "roles": { "accent": "status.critical" } }
```

Two alias entries give the four colour pairs: `primary` + `critical` fills with
`status.critical.fill` and `status.critical.on-fill`, `ghost` + `critical` keeps no
fill and reads `status.critical.text`, and so on. `accent` matches `accent.fill`
and `accent.text` on dot boundaries, never `accented.fill`; the rewrite happens
once, when the recipes resolve, so the CSS is one rule set per combination and
nothing remaps variables at runtime. Every role an alias produces must be declared
in the vocabulary, so a target family must cover each suffix the variants use.

- **Classes.** A kind with axes adds its axis values after the variant, defaults
  filled in: `lf_button_primary__critical_root`. Call `slotClass(kind, variant,
  slot, axes)` with the values in declared axis order, or use the `slot()` you
  receive from `<Surface>`, which reads them from the node's props. Kinds without
  axes keep their classes and CSS bytes.
- **Cascade.** For each state: wildcard, variant, then each axis in declared order
  (rest overlays, then state overlays). A state always beats rest; a later-declared
  axis beats an earlier one. Overlays are optional, so a new axis value never makes
  an installed design system incomplete.
- **Cost.** The table holds one entry per combination, so a kind with 2 variants and
  a 3-value axis has three times the entries of one without the axis. At most three
  axes, 16 values each and 256 combinations per kind.
- **Audit and conformance.** `auditContrast` checks every combination and names it
  by its resolved key (`button.ghost__critical.root.rest`). `catalogSuite` needs an
  example per axis value; the styled-state fixtures need each non-default value one
  axis at a time, keyed by the class position (`button.primary__critical.hover`).
- **Adopting.** Making an existing prop an axis changes that kind's class names
  (`lf_button_primary_root` becomes `lf_button_primary__neutral_root`), so search
  host CSS and tests for `.lf_<kind>_` selectors. Adding an axis or a value is a
  minor catalog change; removing an axis or changing its default is major.

## App states

The twelve library states are fixed, but an app can add its own to
`vocabulary.states` without a library release:

```jsonc
"states": { "dragOver": { "attribute": "data-drag-over", "description": "A drag is over it." } }
```

A recipe then keys the state like any other (`"box.default.root.dragOver"`, and
axis overlays such as `"box.tone:critical.root.dragOver"`), and states stay optional
overlays on `rest`, so a design system that ignores it stays complete. The
projection matches **only** the attribute's presence, `[data-drag-over]`, so your
primitive sets and removes it; nothing else (no ARIA attribute, no pseudo-class)
selects it, and `attribute` must be `data-` plus the name in kebab case. An app
state sits after `invalid` and before `disabled` in the precedence list above, in
the order you declared them, so a later one beats an earlier one and `disabled`
beats all of them. It does not suppress hover or press. Inside forced colours an
app state that differs from rest gets the cue `hover`, `active` and `open` share, a
1px `Highlight` outline. A catalog without app states projects exactly the CSS it
did before.

`rendererBrowserSuite` needs a state fixture for each app state a design system
styles, keyed `<kind>.<variant>.<state>` like the library states; its target must
carry the slot class and match the attribute selector. `auditContrast` checks app
states like library states.

## App semantics

`vocabulary.semantics` adds `semantics` values to the library's sixteen:

```jsonc
"semantics": { "toolbar": { "role": "toolbar", "description": "A set of controls." } }
```

The `role` is one of the root export's `ariaRoles`. Your catalog's `semantics` enum
may then contain `toolbar`; an enum value that is neither a library value nor
declared is rejected on install. The library renders no element: your layout
primitive maps the value to its element and applies the declared role.

## Extension properties

The recipe property list is fixed by the library. An app that needs a look it does
not name, such as an ornament colour or a corner-notch size, declares an
**extension** in its catalog vocabulary and lets each design system supply the
value:

```jsonc
// catalog.json, vocabulary
"extensions": {
  "sheen": { "type": "colour", "description": "Highlight along the top edge." },
  "notch": { "type": "value", "kind": "size" }
}
// design-system.json
"button.primary.root.rest": {
  "backgroundColor": "accent.fill",
  "extensions": { "sheen": "accent.highlight", "notch": "size.notch" }
}
```

The projection adds one declaration per extension to the slot's rule, after the
fixed declarations and sorted by name:

```css
.lf_button_primary_root{background-color:var(--lf-c-accent-fill);--lf-p-notch:6px;--lf-p-sheen:var(--lf-c-accent-highlight)}
```

Trusted app primitive CSS reads it with a fallback, so a design system that does
not set the extension still renders:

```ts
import { extensionVar } from "@arnilo/liveframe/css";

const primitiveCss = `
  .app-button { box-shadow: inset 0 1px 0 var(${extensionVar("sheen")}, transparent); }
`;
```

- A `colour` extension is a theme role or `none` (`transparent`); a `value` is a
  design-value name or bounded literal of its declared kind. Widgets cannot set an
  extension: the values live in the design system, so law 3 holds.
- Extensions merge **by name** through `extends` and the cascade, so a variant can
  set `notch` without erasing a wildcard's `sheen`. They are optional overlays; a
  new extension never makes an installed design system incomplete.
- Custom properties inherit: a root slot's extension reaches descendant slots that
  do not set their own, so read the variable on the slot that declares it. The
  projection adds no reset rule.
- A colour extension has no alpha modifier, so reduced transparency has nothing to
  recover; the variable is declared once. Forced colours are unchanged: the OS
  overrides whatever your CSS paints from it.
- `auditContrast` ignores extensions. The library cannot know which background
  your CSS paints one against, so audit those pairs yourself.
- A design system that sets no extension projects byte-identical CSS.
- Adding an extension to the catalog is a minor change; removing one or changing
  its type or kind is major.

## App primitive CSS

The library knows no app kinds and supplies no visual components or design
system. Trusted app primitives supply structural defaults such as headings'
wrapping, control minimum heights, icon dimensions and overlay positioning.
They can refer to installed roles and values with the exported name helpers:

```ts
import { colourVar, valueVar } from "@arnilo/liveframe/css";

const primitiveCss = `
  .app-icon { width: var(${valueVar("size.glyph")}); color: var(${colourVar("text.primary")}); }
`;
```

These example names must exist in the app's vocabulary. `colourVar`, `valueVar`
and `slotClass` encode installed identifiers; they do not validate arbitrary
input. Dots encode as `_`, so `space.2` becomes `--lf-v-space_2`.

Law 3 constrains widget code and installed style data. App primitive CSS is
trusted host code; it must never interpolate widget strings as CSS. Installed
themes, recipes and style props pass validation and escaping through the
projection, so no installed data is accepted as raw CSS text.

The proof host demonstrates this split: `proof/renderer/primitives/base.ts` supplies
trusted app structure, while `proof/css/project.ts` adapts the public helpers and
`proof/css/sheets.ts` builds the independent sheets from the installed fixtures.
Colour-authority tests scan widget and design-system inputs; trusted app primitive
CSS is outside that boundary and uses `colourVar` for any theme colour reference.
