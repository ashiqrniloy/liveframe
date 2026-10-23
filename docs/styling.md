# Projecting and loading styles

`@arnilo/liveframe/css` turns a catalog, theme and design system into CSS strings
and gives renderers plain attributes, classes and style declarations. It has no
DOM dependency and inserts nothing into the page. The host loads the sheets and
draws validated trees with its own primitive implementations.

The package is pre-release. The CSS projection is implemented; the public React
renderer remains planned work. See the [format guide](formats.md#theme) for theme,
design-system and vocabulary formats, and [spec §6.4](spec.md#64-how-styling-reaches-the-screen)
for the normative projection contract.

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
When a system mixes `px` and `rem` breakpoint units, ordering currently assumes
a 16px root font size; use one unit for consistent ordering at other root sizes.

## Renderer contract

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
| invalid | `:user-invalid`, `[data-invalid]`, `[aria-invalid=true]` |
| disabled | `:disabled`, `[data-disabled]`, `[aria-disabled=true]` |

Precedence is `rest < hover < focus < active < open < selected < invalid < disabled`.
Recipe selectors have one class of specificity; source order decides between
states. Equal-to-rest states emit no extra rule. Disabled roots suppress hover
and active on themselves and their slots. A behaviour library can provide the
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

## Preferences and platform

The projection handles reduced motion by setting transition durations to zero
and removing the pressed offset. Reduced transparency forces background alpha
to 1 and removes backdrop filters; support for that query is a progressive
enhancement. Forced-colours mode keeps `forced-color-adjust: auto` and adds OS
system-colour state cues and outlines for background-only edges and fill shapes.
Real Windows and assistive-technology auditing remains an open manual gate.

The host chooses light, dark and high-contrast themes, including any response
to `prefers-color-scheme` or `prefers-contrast`. Each theme sheet sets its own
`color-scheme`, which also styles native controls and scrollbars. Placeholder
and scrollbar colours have no design-system recipe properties.

The platform floor is Baseline 2024: custom properties, `:is`/`:where`/`:has`,
`color-mix()`, `oklch()` and `color()`, container queries, `:user-invalid`,
`:popover-open`, `@starting-style`, unprefixed `backdrop-filter`, `font-size-adjust`
and `text-wrap: balance`. Shadow-DOM isolation, nested surfaces and vertical
writing modes are outside this contract.

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
