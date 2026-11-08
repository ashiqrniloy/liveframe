# Liveframe — Specification

Published on npm as `@arnilo/liveframe`: one package, with subpath exports for each part (§13).

The normative core is §1–§5: purpose, the four laws, responsibilities, terms and definitions. Feature contracts are §6–§11. §12 records the primitive proof requirements and performance budgets; §13 defines distribution and conformance; §14–§15 record boundaries and settled decisions.

Each section starts with numbered rules. Contract details, tables and examples retain the same authority; rationale explains the rules. Release history lives in `CHANGELOG.md` and `docs/compatibility.md`.

---

## 1. Purpose

**Rules**

1. The app ships a small set of trusted **primitive components** and a **design system**.
2. A new primitive is the only thing that needs a deployment.

**Contract and examples**

Everything above that is ordinary TSX code, written by people or agents and installed at runtime:

- panels, widgets, cards, queues and whole screens
- the reusable components inside them

That happens only when the browser must *do* something new (a code editor, a chart engine, drag-and-drop).

**Rationale**

A library for apps whose UI must change **at runtime** — by users, organisations or AI agents — **without a deployment**, while staying safe and looking exactly like the rest of the app.

## 2. The model

**Rules**

1. Widget code never runs in the browser. Only the app's compiled primitives run there.
2. The UI tree is data, and it is validated before the renderer reads it.
3. Widget code never sets colours or raw CSS. Look comes from the design system; layout comes from token-constrained style props.
4. A widget never holds authority. Data is resolved and actions are run by the app, as the viewer.

**Contract and examples**

```
 widget code (TSX, written by a human or an agent)
        │  runs on the app's server / backend, in the app's sandbox
        ▼
 element tree  ──validate against the component definitions──►  UI tree (JSON)
                                                                   │
 browser / webview                                                 ▼
   renderer draws the tree with the app's primitive React components,
   styled by the active design system (recipes → CSS custom properties)
        │
        └── interactions: local (no round trip) · setState (re-run widget) · action (app operation)
```

**Rationale**

There are four rules, and none of them is optional.

The validated tree separates backend widget execution from trusted browser primitives and interaction handling.

## 3. What the library ships, and what the app provides

**Rules**

1. The library ships **no components, no visual style, no isolation sandbox, no storage backend, no authorisation and no layout shell**.

**Contract and examples**

| The library ships | The app provides |
|---|---|
| The format for component definitions (props, children, events, variants, slots, style props) | Its primitive set: definitions plus React implementations |
| The format for themes and design systems (values, recipes), with a resolver and a CSS projection | Its themes and design systems |
| The TSX SDK: JSX runtime, intent helpers, a codegen CLI for typed components | Where widget code runs: its sandbox, plugged in as a runner (§7.5) |
| Template widgets: element JSON plus a bounded expression language, evaluated by the library (§7.6) | Nothing for isolation: a template runs no author code, so it needs no sandbox |
| The validator for widget output | Its capabilities (§7.1): data sources, resolved as the viewer, and actions, each declared with schemas |
| The React renderer and the interaction plumbing | Actions, authorised and executed by the app |
| `pack()`, the record formats, the `Store` interface and two reference stores (§7.3–§7.4) | Its storage backend (database, tenancy, encryption), or a reference store |
| The preview: runners, preview sessions, `<Preview>` and `liveframe preview capture` (§7.5), plus the authoring MCP server `liveframe mcp` (§13) | A preview page that mounts `<Preview>` |
| A conformance test kit | Approval and placement of widgets |

**Rationale**

The division of responsibilities keeps app authority and trusted implementations with the host.

## 4. Concepts

**Rules**

1. The terms in the table define the contracts used throughout this specification.

**Contract and examples**

| Term | Meaning |
|---|---|
| **Primitive** | A component implemented in the app's renderer, compiled in. Small and composable (box, text, button, menu…) |
| **Definition** | The data contract of a primitive: props, children, events, variants, slots, style props |
| **Catalog** | The app's versioned set of definitions and its vocabulary (`catalogId`, for example `acme.ui@1`) |
| **Vocabulary** | The names the app declares for colour roles, typography roles, tones and design values (§6.5) |
| **Capabilities** | The app's declared actions and data sources, with descriptions and schemas (§7.1) |
| **Widget** | A manifest plus either a TSX module, a pure function `(params, state, data, context) → element tree`, or a **template**: element JSON with expressions that the library evaluates (§7.6) |
| **Composed component** | A plain TSX function built from primitives and imported by widgets. Not a catalog entry |
| **UI tree** | The validated JSON tree the renderer draws |
| **Intent** | What an interaction asks for: `setState` or `action`; `setLocal` is the renderer's own write to local state (§8) |
| **Theme** | The only source of colour roles and typography roles |
| **Design system** | Geometry, material and motion values, plus **recipes** that map each primitive's variant, slot and state to styles |
| **Package** | An installed widget version: its manifest and either compiled code or a template, immutable and identified by a SHA-256 hash (§7.3) |
| **Placement** | One package version placed in one host slot, with its params. Each placement has its own state |
| **Store** | Where a host keeps packages, placements, state and installed styles across launches (§7.4) |
| **Scenario** | A named set of fixture inputs a package carries, such as `default`, `empty` or `failed`. Every package has at least one (§7.3) |
| **Runner** | Where widget code executes. The app's sandbox is one; preview and production use the same runner (§7.5) |

**Rationale**

Shared terms connect authoring, installation and rendering without prescribing app-specific primitives.

## 5. Component definitions

**Rules**

1. A definition is pure data.
2. The **primitive set is per app**: a catalog is the app's contract, and portability comes from the formats, not from one mandated set (`decision-logs/2026-10-22-1905-phase-1-format-scope.md`).
3. **No product-shaped components in the catalog.**

**Contract and examples**

```ts
export const Button = defineComponent({
  kind: "button",
  description: "Runs one intent when pressed.",           // read by agents and generated docs
  props: {
    label: str({ maxLength: 80 }),
    icon: optional(iconName()),
  },
  variants: ["default", "primary", "danger", "ghost"], // recipe axis
  defaultVariant: "default",
  slots: ["root", "label", "icon"],                     // recipe targets
  events: { onPress: { carries: "none", description: "Pressed by pointer, Enter or Space." } },
  styleProps: ["width", "grow"],                         // author-settable layout props
  children: "none",
  a11y: { role: "button", name: "label" },
});
```

A definition declares:

- **`description`**: what the primitive is for, in one or two sentences. Agents and generated docs read it.
- **`props`**: a closed schema per prop, in the schema language below. Data only: no functions, no React nodes.
- **`children`**: `none`, `any`, or a list of allowed kinds with min/max counts.
- **`events`**: the events the primitive can raise, what value each carries (`none`, `string`, `boolean`, `number`, `integer` or `{ object: ObjectSchema }`) and a description. Each event takes exactly one intent. An object carry is closed, not top-level nullable, and has at most 32 scalar properties (`string`, `boolean`, `number` or `integer`, each optionally nullable); strings require `maxLength`. Nested objects and arrays are rejected.
- **`variants`** and **`defaultVariant`**: the closed variant axis that recipes key on, and the variant a node without one gets. The app chooses each kind's variants; a `box` may declare look variants such as `plate` or `rule` so that borders and rules stay recipe data.
- **`axes`** (optional): at most three extra look choices beside `variant`, each naming an enum string prop of the definition and the value an absent prop takes: `axes: { tone: { default: "neutral" } }`. An axis name that is not an enum string prop is `unknown-name` at `/definitions/<i>/axes/<name>`; a default outside the enum, an axis value that is not a name (`^[a-z][A-Za-z0-9-]*$`), more than 16 values on an axis, or more than 256 `variants` × axis-value combinations is `invalid-document`. The combinations of all kinds with axes together are at most 512 (`invalid-document` at `/definitions`), because the resolver expands each into table entries and the projection into one rule set per slot and state (about 8 KB of CSS each in the proof design systems). The axis value is an ordinary prop: the tree, patches, the SDK and generated types carry it unchanged, and validation guarantees it is a member of its enum. Recipes address it with `axis:value` overlays (§6.2).
- **`slots`**: the named parts of the primitive that recipes style.
- **`styleProps`**: which token-constrained layout props an author may set (see §6.3).
- **`refProps`** (optional): at most eight unique string prop names that reference nodes in the same tree. A missing or non-string prop name is `unknown-name` at `/definitions/<i>/refProps/<j>`.
- **`a11y`**: the role, and which prop provides the accessible name.
- **`deprecated`** (optional): why the primitive or a prop is deprecated and what replaces it.

**The schema language.** Props, params, state, context, action arguments and data-source shapes all use one closed schema language based on JSON Schema 2020-12, with the discriminator form from JSON Type Definition (RFC 8927).

Its forms are `string` (with `maxLength` in code points, and optional `minLength`, `pattern`, `url` and string `enum`), `number` and `integer` (with optional `minimum` and `maximum`), `boolean`, `array` (with `maxItems` and optional `minItems`) and `object` (closed: `additionalProperties: false`, with `required`).

Every string and array is bounded: `maxLength` and `maxItems` are required.

Length and item bounds are nonnegative integers; an omitted minimum is zero.

Install validation rejects a minimum above its maximum as `invalid-document` at the minimum keyword's pointer.

String bounds count Unicode code points in one pass.

Any schema may carry `description`, `deprecated` and a boolean `nullable`.

With `nullable: true`, `null` passes without checking the form; every other value must satisfy the form, including its enum and bounds.

Omitting `nullable` or setting it to `false` rejects `null`.

Nullability does not make a required property optional.

The discriminator form is `{ discriminator: "<prop>", mapping: { "<tag>": ObjectSchema } }`, without `type`.

It has 1–64 mapping entries, with string tags of at most 64 code points.

Each entry is a closed object schema that neither declares the discriminator property nor sets `nullable: true` (RFC 8927 §2.2.8); nullability belongs on the union.

Values require an own string tag property.

A missing, non-string or unknown tag fails at that property's JSON Pointer with `expected` listing the allowed tags.

A known tag selects only its entry through a precompiled Map; payload errors are rooted at the value.

`Infer` and `liveframe gen` produce readonly tagged unions.

Adding a tag is a minor catalog change; removing or narrowing one or changing the discriminator is major.

Published meta-schemas describe the structure; install validation enforces the tag-property exclusion.

Equivalent JSON Schema value validators use `oneOf` with a required `const` tag per closed object branch.

A schema outside the language is rejected at install.

**URL strings.** A `string` may carry `url: { schemes, relative? }`: one to sixteen lowercase schemes (RFC 3986 `scheme`, at most 32 characters, unique) and an optional `relative` flag.

The check is closed and linear, and uses no `URL` global.
It rejects any C0 control character or space anywhere in the value, which removes every input a browser strips or trims before it reads the scheme (`java\tscript:`).

It then reads a scheme (letters, digits, `+`, `-`, `.` before the first `:`, starting with a letter) and compares it to the allowlist ignoring ASCII case.
A value with a scheme passes only if the scheme is listed.

A value without one is a relative reference and passes only with `relative: true`; a value that starts `//`, `/\` or `\` is never accepted, since a browser reads each as a host.
Failure is `invalid-prop` with `expected` naming the schemes.

`url` is a closed keyword, not a regular expression, so widget schemas keep it.
It may not appear beside `pattern` (`invalid-document` at `url`).
Published JSON Schemas and element schemas carry an equivalent anchored linear `pattern`.

**Widget schemas carry no `pattern`.** The three schemas a widget manifest declares — `params`, `state` and `context` — are matched against values the app does not author: what a user types, what an intent carries, and what storage holds.

A pattern there is widget code running on the host thread and in the browser, where one catastrophic backtrack on a short value costs seconds.

So a `pattern` anywhere inside them is `invalid-document` at the keyword (`/state/properties/evil/pattern`), rejected before any value is matched, by `validateManifest`, `validateManifestShape` and the published manifest schema alike.

Authors use `enum`, or ask the app for an action or source that checks the value where it is trusted.

Catalog definitions and capabilities are the app's own documents and keep `pattern`. Widget schemas may use `url`, which is a closed check and not a regular expression.

**The catalog.** A catalog is one document:

```ts
type Catalog = {
  format: "liveframe-catalog/1";
  catalogId: string;            // "acme.ui@1": a name and a major version
  description: string;
  vocabulary: Vocabulary;       // §6.5
  definitions: Definition[];
};
```

**Versioning.** A change that can break an existing widget or tree takes a new major `catalogId`: removing or renaming a kind, prop, variant, slot or event; narrowing a prop's type or bounds; making a prop required; changing an event's `carries`; or removing a vocabulary name. Adding a kind, an optional prop, a variant, a slot, an event or a vocabulary name keeps the id. The library classifies a change between two catalogs by these rules.

**Primitive set.** The proof primitive set (§12, `proof/REPORT.md`) is:

- Layout: `box`, `stack`, `inline`, `grid`, `scroll`, `separator`
- Content: `text`, `heading`, `icon`, `image`, `link`
- Controls: `button`, `textField`, `select`, `checkbox`, `switch`
- Overlays: `menu` / `menuItem`, `popover`, `dialog`, `tooltip`
- Navigation: `tabs` / `tab`, `disclosure` (a summary label that expands its children locally, with `onToggle`)

The proof primitives also provide:

- **Semantics on layout primitives.** `box`, `stack`, `inline` and `grid` take an optional closed `semantics` prop (`section`, `article`, `aside`, `header`, `footer`, `nav`, `list`, `listItem`, `terms`, `term`, `detail`, `form`, `group`, `figure`, `status`, `alert`) and an optional accessible `label`. Landmarks, description lists, forms, groups, figures and live regions (`status`, `alert`) are structure, not styling. A live region must stay mounted for its text changes to be announced. An app adds values through `vocabulary.semantics` (§5), which maps each to an ARIA role.
- **Selection state on `button`.** `current` and `pressed` expose a selected row or toggle to assistive technology.

The icon glyph set is the app's: status marks and brand marks are icons, not primitives.

A queue, a metric card or a widget frame is a composed component written in TSX. If something can be built from primitives, it must be.

**Rationale**

The SDK types, the validator, the renderer and the agent-facing docs are all generated from the definition.

## 6. Styling (Clay's model)

**Rules**

1. Styling has three layers.
2. Each one is inert data, validated, and installable at runtime.

**Rationale**

The theme, design system and style props separate colour authority, look and structure.

### 6.1 Theme: the only colour source

**Rules**

1. Nothing outside the theme may introduce a colour.
2. The app declares the required role names (§6.5); a theme that misses one fails validation.
3. In forced-colours mode, OS system colours override everything.

**Contract and examples**

A theme defines **colour roles** (`surface.base`, `surface.hover`, `text.primary`, `text.muted`, `border.hairline`, `accent.fill`, `status.critical`…) and **typography roles** (`body`, `label`, `heading.2`, `mono`…). A typography role sets family, size, weight and line height, and optionally `letterSpacing` (a bounded `em` value), `textTransform` (`none` or `uppercase`), `fontStretch` (a bounded percentage, for a face with width variants such as a mono at 87.5%) and `fontSizeAdjust` (an `ex-height` factor that normalises a face whose x-height differs from the design's, as `font-size-adjust` does).

- A colour value is a DTCG 2025.10 colour object: `{ colorSpace, components, alpha?, hex? }`, in any colour space DTCG lists. The projection converts it to CSS. A typography role follows the DTCG `typography` composite (`fontFamily`, `fontSize`, `fontWeight`, `letterSpacing`, `lineHeight` as a multiplier), with dimensions in `px` or `rem` and `letterSpacing` also in `em`; the four fields above extend it.

- The vocabulary may declare contrast pairs (§6.5). Theme installation checks their WCAG 2.x ratios; violations return `insufficient-contrast` with the pair index, roles and measured ratio to two decimals. This is an install check with no per-render work.
- Light, dark and high-contrast are separate themes, or modes of one theme.

- The theme is the resolved set of roles. An app may assemble it from separate sources, such as a colour package and the user's own typography preferences. Whatever the sources, nothing outside the resolved theme introduces a colour or a typeface.

**Rationale**

Matching an approved design is often a matter of these four fields, not of new primitives.

### 6.2 Design system: values and recipes

**Rules**

1. **Not allowed:** raw CSS, selectors, scripts, or literal colours.
2. **Recipes own the look; style props own the structure.**
3. **Completeness:** a design system is valid only if, after `extends` and the cascade, every `(kind, variant, slot)` the catalog declares has a `rest` style, and every kind that declares an event has a `focus` overlay.

4. **Axes are overlays, never a product.** A kind's `axes` (§5) select among recipes the design system already owns; they add no colour, CSS or authority, and a design system that mentions no axis renders every axis value as the base look.

**Contract and examples**

A design system contributes:

- **Values**: typed, named design values, written as DTCG 2025.10 values: `dimension` (`px` or `rem`) for radius, border width, spacing, size, breakpoint and backdrop blur; `duration` (`ms` or `s`); `cubicBezier` for easing; `number` for opacity and saturation; and `shadow`, whose colour references a theme role with an optional alpha modifier, never a literal. `radius.control: 7`, `border.hairline: 1`, `motion.fast: 140`, `opacity.disabled: 0.5`, `blur.veil: 2`, `size.rail: 352`, plus a spacing scale `space.1…space.n`. Types include `radius`, `border-width`, `spacing`, `size`, `motion-duration`, `easing`, `opacity`, `backdrop-blur`, `shadow`, and `breakpoint` (container widths that responsive style values key on, §6.3). A `size` is a bounded length the design system owns, for a dimension no spacing step fits.
- **Declared names.** The app declares the design-value names style props may reference: the `space.*` scale, the `radius.*` names, the `size.*` names and the breakpoint names. This mirrors how §6.1 declares required colour and typography roles. A design system that misses a declared name fails validation.
- **Recipes**: keyed `<kind>.<variant>.<slot>.<state>`, each mapping to a typed style object. `<variant>` may be `*`, meaning every variant of the kind, or `<axis>:<value>`, an overlay for one value of an axis the kind declares (below). `:` is not a name character, so a key is unambiguous. A key naming an axis or value the kind does not declare is `unknown-name` at `/recipes/<key>`.
- **Cascade.** The resolved style of `(kind, variant, axis values, slot, state)` merges, per property and in this order, a later entry winning: (1) `kind.*.slot.rest`; (2) `kind.variant.slot.rest`; (3) for each axis in the order the definition declares them, `kind.axis:value.slot.rest`; (4) `kind.*.slot.state`; (5) `kind.variant.slot.state`; (6) for each axis in the same order, `kind.axis:value.slot.state`. A state always beats rest, an axis is more specific than the variant at its level, and a later-declared axis beats an earlier one. A kind without axes resolves through layers 1, 2, 4 and 5 exactly as before. Extensions take part by name.
- **Variant axes.** Axis overlays are optional, so a new axis or value never makes an installed design system incomplete: the `rest` and `focus` completeness rules (above) apply to layers 1, 2, 4 and 5 only. A look that needs its own recipe for a combination of values is a `variant`; compound rules (`tone=critical` *and* `emphasis=outline`) are not offered. The resolver expands the overlays into the flat table, one entry per `(variant, axis values, slot, state)`, keyed `<kind>.<variant>__<value>…<slot>.<state>` with the axis values in declared order and defaults filled in (`button.primary__critical.root.rest`); a kind without axes keeps `<kind>.<variant>.<slot>.<state>`. `auditContrast` checks every combination and names it by that key.
- **Role aliases.** An axis overlay (and only an axis overlay, at any state) may carry `roles: { "<role-or-family>": "<role-or-family>" }`, which changes which theme roles the combination reads, so tone × emphasis needs no compound rule. The rules:
  1. Keys and values are non-empty dot-separated colour-role names or prefixes (families) in the vocabulary's role grammar. `none`, literals, CSS and typography roles are not names. `roles` on a wildcard or variant recipe is `invalid-document` at `/recipes/<key>/roles`. A source or target that is not a declared role or a prefix of one is `unknown-name` at `/recipes/<key>/roles/<from>`, even when no recipe uses the entry.
  2. Maps merge by source: `extends` parent first, child last, then the six layers' alias maps in order (axis rest maps in declared axis order, then axis state maps in declared order), a later entry winning. A state alias beats a rest alias for that state; rest aliases also rewrite a variant's `hover` snapshot. An identity entry restores a source to itself.
  3. A source `s` matches a role `r` only when `r` is `s` or starts with `s.`; the longest matching source wins and the suffix is kept: `accent` → `status.critical` maps `accent.fill` to `status.critical.fill`, never `accented.fill`.
  4. Rewriting is one step against the original role: `accent` → `status.critical` with `status.critical` → `status.neutral` maps `accent.fill` to `status.critical.fill`. There is no chaining.
  5. After the cascade and design-value references resolve, the rewrite applies to every colour property, the `role` of a `{ role, alpha }` object, each shadow layer's colour (a named shadow value is copied, never changed for another combination) and each `colour` extension, keeping alpha and `none`. Typography, values and non-colour extensions are not rewritten.
  6. Every rewritten role must be a declared role: merely declaring `status.critical.fill` does not allow a rewrite to `status.critical.text`. A rewrite to an undeclared role is `unknown-name` at the winning entry's `/recipes/<key>/roles/<from>` (prefixed `/registry/<id>` for an entry inherited from a parent). No literal colour can enter through an alias (law 3).
  7. The output is flat: `roles` is stripped, and `resolveRecipes`, the contrast audit and the projection use the same aliased table, one rule set per combination, with no runtime variable remapping.

  ```jsonc
  "button.primary.root.rest": { "backgroundColor": "accent.fill", "textColor": "accent.on-fill" },
  "button.ghost.root.rest":   { "backgroundColor": "none", "textColor": "accent.text" },
  "button.tone:neutral.root.rest":  { "roles": { "accent": "status.neutral" } },
  "button.tone:critical.root.rest": { "roles": { "accent": "status.critical" } }
  ```

  Two alias entries give `primary`/`ghost` × `neutral`/`critical` its four colour pairs (`status.critical.fill` with `status.critical.on-fill`; `none` with `status.critical.text`, and so on) with no product variants.

```json
"button.primary.root.hover": {
  "backgroundColor": "accent.fill.hover",
  "textColor": "text.on-accent",
  "borderColor": "border.hairline",
  "borderWidth": "border.hairline",
  "borderRadius": "radius.control",
  "padding": "space.2",
  "gap": "space.1",
  "transitionDuration": "motion.fast",
  "transitionTiming": "expo-out"
}
```

- **States**: `rest`, `hover`, `active`, `focus`, `disabled`, `selected`, `current`, `mixed`, `pending`, `readonly`, `invalid`, `open`. The library fixes these twelve; an app adds its own through `vocabulary.states` (§5), each selected by one data attribute, and a recipe may style any of them. States, library or app, are optional overlays on `rest`, so a new state never makes an installed design system incomplete. An app state takes part in the cascade like a library state (all of the layers above, with the axis overlays, at its own key `kind.variant.slot.<name>`), and a recipe key whose state the catalog does not declare is `unknown-name`.
- **Recipe properties** are a closed, typed list fixed by the library: colours, borders (width per side or all sides, style), outline, radius, padding, gap, typography role, opacity, shadow, backdrop blur and saturation, transition (a duration and an easing value), and a pressed offset (a `translateY` dimension). Every property's value type is fixed. Product-specific names, such as an easing called `expo-out` or a transform preset, are design values, not recipe vocabulary.
- **Extension properties.** An app may declare recipe properties of its own in `vocabulary.extensions` (§6.5) and a design system sets them in a recipe's nested `extensions` map: `"button.primary.root.rest": { "backgroundColor": "accent.fill", "extensions": { "sheen": "accent.highlight", "notch": "size.notch" } }`. They sit in their own map so a later library property can never collide with an app's name.

  A `colour` extension takes a declared theme role or `none`; the `{ role, alpha }` object is not offered. A `value` extension takes a design-value name of its declared kind, or a bounded literal of that kind, as the numeric properties do. A name the catalog does not declare is `unknown-name`, a colour that is not a theme role is `colour-outside-theme`, and a value of the wrong shape or kind is `invalid-document` or `unknown-name`, all at `/recipes/<key>/extensions/<name>`.

  Extensions merge **by name** through the cascade below and through `extends`, so a variant can set one name without erasing a wildcard's others. They are optional overlays: declaring one never makes an installed design system incomplete. The projection emits each as `--lf-p-<name>` for the app's trusted primitive CSS to read (§6.4); nothing in the tree or in a style prop can name one, so law 3 holds.
- A recipe never sets display mode, flex or grid layout, tracks, content alignment, size or position: those are style props (§6.3) chosen by the widget.
- **Structural defaults belong to app primitives.** Headings' wrapping, an icon's box, controls' minimum heights and overlay positioning are trusted app implementation CSS. The library's base sheet supplies only a generic reset, surface typography, containment and environment overrides; it knows no app kinds. Law 3 constrains widget code and installed style data, not trusted app primitive CSS.
- **Projection semantics.** `borderLeftWidth` and `borderRightWidth` mean inline start and inline end in left-to-right text and project to logical sides, mirroring under `dir="rtl"`; top and bottom remain physical.

  Vertical writing modes are out of scope.

  `translateY` uses CSS `translate`, preserving a primitive's own `transform`.

  `backdropBlur` and `backdropSaturate` compose into one `backdrop-filter`.

  `backgroundOpacity` multiplies the background colour's alpha through `--lf-alpha`, which environment overrides may force to 1.

  A role-alpha object projects as `color-mix(in oklab, var(--lf-c-…) N%, transparent)`, with at most two percentage decimal places and no trailing zeroes, including 0% and 100%.

  Plain roles keep direct `var()` references.

  The mix multiplies intrinsic theme alpha.

  With `backgroundOpacity`, its output feeds the existing background mix, so theme alpha × role alpha × background opacity applies exactly once.
- **Entry motion.** A slot whose resolved `open` declarations differ from `rest` enters from its rest declarations through `@starting-style`, using its recipe transition. Equal states emit no entry rule. Exit motion requires renderer-managed delayed unmounting (§11).
- **Colour-typed properties accept theme roles.** `backgroundColor`, `borderColor` and `outlineColor` also accept `"none"`, which supplies no hue and projects to `transparent`.

  Omission inherits through the cascade; explicit `none` clears inherited paint, even with `backgroundOpacity`.

  `backgroundColor`, `textColor`, `borderColor`, `outlineColor` and shadow layer `color` also accept a closed `{ role, alpha }` object.

  `role` must name a declared theme role (never `none`); `alpha` is a finite number in [0, 1] with at most four decimal places, or a design-system `opacity` value name whose resolved number meets the same bound and precision.

  Other existing opacity values are not precision-restricted.

  Opacity names resolve through the inherited design values before projection.

  `textColor` and shadow colours exclude `none`.

  The exact colour-role name `none` is reserved in vocabularies; nested names such as `surface.none` remain valid.

  Other properties accept design values or bounded literals of the right type.
- **Native parts.** `placeholderColor`, `scrollbarThumbColor` and `scrollbarTrackColor` are colour-typed: a theme role, `none` or a `{ role, alpha }` object.

  `placeholderColor` styles the `::placeholder` of the element that carries the slot class and honours every state; the projection emits `opacity: 1` beside it, so the UA's own placeholder dimming does not multiply the alpha.

  The scrollbar colours target the scrolling slot, project to the standard `scrollbar-color: <thumb> <track>`, and are **rest-only**: a non-rest recipe that declares either is rejected at install, naming the property, and the thumb and track must resolve together at rest.

  States inherit the rest pair; container hover or press is not thumb hover or press, so native thumb interaction stays with the OS.

  Safari before 26.2 and WebKitGTK before 2.52.3 lack `scrollbar-color` and keep native scrollbars; the projection emits no `::-webkit-scrollbar-*` fallback.

- **Derivation:** a design system may `extends` another and override individual recipes or values.
- Other states are optional overlays on `rest`.

**Rationale**

Structure must survive a design-system switch; look must change with it (`decision-logs/2026-10-22-0850-recipes-own-look-style-props-own-structure.md`).

### 6.3 Style props: what authors may set

**Rules**

1. Widget authors never touch colour or recipes.
2. They choose a primitive's **variant** and set its declared **style props**.

**Contract and examples**

Style props are layout-only and token-constrained:

| Style prop | Accepts |
|---|---|
| `padding`, `gap`, `margin` (per side or axis) | `space.*` |
| `direction`, `align`, `justify`, `wrap`, `textAlign` | Enums (`align` on `button` places its content) |
| `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | `space.*`, `size.*`, `fill`, `fit`, or bounded `ch` / `%`. Fractions (`fr`) are rejected as `invalid-prop`; they belong only in grid `columns` / `rows` |
| `grow`, `shrink`, `basis` | Bounded numbers |
| `columns`, `rows`, `area` (grid) | Bounded track lists, or area names; each track a fraction, `space.*` or `size.*` |
| `position`, `inset*` | `static` or `sticky`; `space.*` |
| `deferOffscreen` | `space.*` or `size.*`: the placeholder block size while the element is offscreen |
| `surface` (box) | A theme surface role, such as `surface.raised` |
| `fill` (box) | A non-surface role the app declares fillable, such as a status or identity role, for small indicators |
| `radius` (box) | A declared `radius.*` name, or `full` |
| `textStyle`, `tone` (text) | A declared typography role; a declared tone, which the vocabulary maps to a colour role (§6.5) |

**Responsive values.** Any style prop may take an object keyed by the breakpoint names the app declares, `base` first, such as `columns={{ base: ["1fr"], "bp.md": ["2fr", "1fr"] }}`. Each value must be valid for that prop, and an unknown key is an error. A value set at one breakpoint **holds at every wider one**, so a prop needs only the breakpoints where it changes; the projection chains each value through all narrower breakpoints rather than letting a wider key's absence reset it. Breakpoints are design-system container widths, so the layout follows the container the widget is placed in, not the viewport.

**Deferred offscreen content.** `deferOffscreen` projects to `content-visibility: auto` and `contain-intrinsic-block-size: auto <value>`. The engine may skip layout and paint of the element's contents while it is offscreen, and it uses the value as the element's block size until the element first renders. Setting it is an author's choice for long repeated content, and it accepts these consequences:

- Paint containment clips overflow: focus rings with an outside offset, shadows, the pressed offset and unportaled overlays. Top-layer elements and Liveframe portals escape.
- The element is the containing block for absolute and fixed descendants, an independent formatting context and a stacking context, and it has no baseline. As a stacking context it paints above earlier positioned siblings that have `z-index: auto`.
- Placeholder and remembered sizes stay stale after a switch until the element renders.
- The work is deferred to scroll-in, not removed. WebKit still recalculates style for skipped content.
- Script geometry reads on skipped nodes force rendering.
- Content stays focusable, selectable, in tab order and findable.
- Engines without support ignore the property.

It is what keeps a long surface's switch inside the budget (§6.4, `decision-logs/2026-10-31-1438-webkit-switching-cost-remedies.md`).

`paddingLeft`/`paddingRight` and `marginLeft`/`marginRight` mean inline start/end in left-to-right text and project to logical properties, mirroring under `dir="rtl"`. Top and bottom remain physical. Field names stay unchanged.

The validator enforces them again on the output tree.

**Rationale**

The SDK types enforce these values, so `gap="space.3"` compiles and `gap="13px"` doesn't.

### 6.4 How styling reaches the screen

**Rules**

1. Inputs are validated before output; invalid input produces typed errors and no partial sheet.
2. The same input, independent of object key order, produces identical bytes.
3. **Surfaces do not nest**, including surfaces composed by the host.
4. **A design system is compiled for one catalog** (`designSystemCss` takes it). Surfaces of two catalog majors on one page use distinct design-system identities (`id@version`), each with its own sheet, so a recipe for one major's `button` never styles the other's.

**Contract and examples**

`@arnilo/liveframe/css` provides pure, deterministic functions returning `Result<string>`: `baseCss(catalog)`, `themeCss(theme, catalog)` and `designSystemCss(designSystem, { catalog, registry })`. The output has three independent sheets:

| Sheet | Contents and scope |
|---|---|
| Base | Generic box-sizing, zero margin/border reset and inherited control fonts under `:where([data-lf-ds]) *`; surface typography, optional containment, preference and switching overrides |
| Theme | Colour and typography role variables and `color-scheme` under `:where([data-lf-theme="<id>@<version>"])` |
| Design system | Design-value variables, recipe rules and container rules under `:where([data-lf-ds="<id>@<version>"])` |

Surface roots carry both scope attributes and `lf_surface`. Overlays follow §11's scope contract.

Every surface root sets the theme's base typography from the app's vocabulary, and every slot that draws text has a typography role. Nothing inherits the host page's fonts. Only a surface whose tree uses responsive values gains `lf_container`, a named inline-size container `lf`. Responsive rules use `@container lf` with literal design-system breakpoint widths; values chain through narrower breakpoints (§6.3). A responsive surface supplies its own container rather than relying on a host container or viewport fallback.

**Classes and names.** Each slot carries one stable class, `lf_<kind>_<variant>_<slot>`, independent of theme, design system and state. A kind that declares axes adds its axis values in declared order after the variant, defaults filled in: `lf_<kind>_<variant>__<v1>__<v2>_<slot>`; the catalog fixes the positions, so no axis name is carried, and kinds without axes keep their classes and CSS bytes. `<Surface>` computes the class from the validated node's props and the definition's defaults, so implementations still call `slot("root")`. Dots in role/value names encode as `_`; `__` separates fixed suffixes. Vocabulary, catalog and id names contain no `_`, making the encoding injective. Variables are `--lf-c-<role>`, `--lf-t-<role>__<field>`, `--lf-v-<name>`, `--lf-p-<extension>` and `--lf-r-<prop>__<breakpoint>__<cssProperty>`. `slotClass(kind, variant, slot, axes?)`, `styleDeclarations`, `surfaceAttributes`, `colourVar`, `valueVar` and `extensionVar` provide classes, plain style objects, scope attributes and variable names without a DOM dependency. Installed strings are escaped and validated, never inserted as raw CSS.

**Extensions.** Each extension a resolved recipe sets adds one declaration to that recipe's rule, after the fixed declarations and sorted by name: a `colour` projects `var(--lf-c-<role>)` or `transparent`, a `value` its resolved literal (`6px`, `0.35`, `140ms`). An unset extension projects nothing, so the app's `var(--lf-p-sheen, <fallback>)` falls back, and a state whose declarations equal rest still emits no rule.

Custom properties inherit, so a root slot's value reaches descendant slots that do not set their own; the app's CSS reads the variable on the slot that declares it, and the projection adds no reset rule. Extensions are not registered with `@property`.

A `colour` extension carries no alpha modifier and no forced-colours rule: reduced transparency has nothing to recover (the variable is declared once, by the ordinary rule), and `forced-color-adjust` stays `auto`, so the OS overrides whatever the app's CSS paints from the variable. `auditContrast` ignores extensions, because the library cannot know which background the app paints one against. A design system that sets none projects byte-identical CSS.

**States and cascade.** Each recipe selector has specificity (0,1,0): the slot class contributes specificity, while scope, state and root qualifiers are inside `:where()`. Source order is `rest < hover < focus < active < open < selected < current < mixed < pending < readonly < invalid < <app states, in declared order> < disabled`. A state whose resolved declarations equal rest emits no extra rule. A root's state also reaches its slots. Hover and active never apply to a disabled element, including a slot of a disabled root, and never to a pending one once the design system styles `pending`: a control that is waiting for the host takes no hover or press feedback. A system that declares no `pending` recipe gains no pending-state rules.

**App states in the projection.** An app state beats every library state except `disabled`, and a later declared one beats an earlier. An app state matches only its data attribute (`[data-dragging]`, wrapped in `:where()` like the library selectors) and is not part of the hover and press suppression; a catalog without app states projects the table unchanged.

| State | Matches |
|---|---|
| hover | `:hover` only in `@media (hover: hover)`; `[data-hovered]` on every device |
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

**Preferences and switching.** Reduced motion sets transition durations to zero and removes the pressed offset.

Reduced transparency forces `--lf-alpha: 1`, disables `backdrop-filter` and reprojects recipe colour/shadow/native-part modifiers as their unmodified role references, including alpha 0.

The host may also ask for it explicitly with the surface's `transparency` prop: `<Surface transparency="reduced">` sets `data-lf-transparency="reduced"` on the scope element and its portal container, and the base sheet applies the same forcing under `:where([data-lf-transparency=reduced])`.

The design-system sheet emits, next to the media query block, an attribute block that carries exactly the same recovery rules scoped to `:where([data-lf-ds=…][data-lf-transparency=reduced])`, so a modifier recovers identically either way; a system with no alpha modifiers gains no attribute rules.

Intrinsic theme alpha and explicit `none` remain unchanged in both.

The media query is a progressive enhancement on supporting browsers; the attribute works everywhere.

Light, dark and high-contrast theme selection belongs to the host (§6.1); the theme sheet sets `color-scheme` from `theme.colorScheme`.

To switch, the host preloads sheets, sets `data-lf-switching` on the scope element, changes the theme/design-system/transparency attributes atomically, then removes `data-lf-switching` on the next animation frame.

While set, transitions are disabled on that element and its descendants.

Switching changes no node, slot class or widget output and runs no widget code.

The switch budget, 16.67 ms (§12), bounds **span A**: from the first switching attribute change through style and layout of the switch frame, forced once.

It excludes later per-element style reads and frame scheduling, which are logged but not budgeted.

A surface whose long repeated content is not marked `deferOffscreen` (§6.3) has no engine-independent bound: WebKit alone restyles and relays out about 1,000 font-changed nodes in 9–10 ms with no library CSS (`decision-logs/2026-10-31-1438-webkit-switching-cost-remedies.md`).

**Forced colours.** `forced-color-adjust` remains `auto`; the OS owns colours. Inside `@media (forced-colors: active)`, a generic state table restores cues only where a state's resolved recipe differs from rest, using the same precedence:

| State or cue | Override |
|---|---|
| selected | `Highlight` background, `HighlightText` text |
| mixed | `Highlight` background, `HighlightText` text |
| current | 2px solid `Highlight` outline |
| pending | 1px dashed `CanvasText` outline |
| readonly | `GrayText` border |
| disabled | `GrayText` text |
| focus | 2px solid `Highlight` outline |
| invalid | 2px dashed `CanvasText` outline |
| hover, active, open, and every app state | 1px `Highlight` outline |
| Explicit rest background (including `none`) with no positive border width | 1px `CanvasText` outline, offset inward |
| `fill` indicator (`lf_fill`) | 1px `CanvasText` outline, offset inward |

A slot with a scrollbar pair gets `scrollbar-color: auto` there, and a slot with any `placeholderColor` gets `::placeholder { color: GrayText; opacity: 1 }`, so the OS owns both. System colours occur only in that media block. The projection never emits `forced-color-adjust: none`.

**Host coexistence and platform.** Sheets are emitted outside cascade layers; a host may import them into its own layer. The reset targets surface descendants, never a class substring such as `[class*=lf-]`. The platform floor is Baseline 2024: custom properties, `:is`/`:where`/`:has`, `color-mix()`, `oklch()` and `color()`, container queries, `:user-invalid`, `:popover-open`, `@starting-style`, unprefixed `backdrop-filter`, `font-size-adjust` and `text-wrap: balance`. A non-CSS platform may implement the resolver output itself.

**Outside this projection:** shadow-DOM isolation, print styles, compound variants, `::before`/`::after` decoration, keyframes, `:nth-child`, scrollbar thumb states and geometry, `prefers-contrast` selection and an atomic-class CSP route. Native controls use the theme's `color-scheme`; placeholder and scrollbar colours come from the native-part recipe properties (§6.2). Inline style attributes require a CSP allowing `style-src-attr 'unsafe-inline'`; hosts insert and authorize sheets themselves (§13).

**Rationale**

Design-system colours refer to theme roles through `var()`, so a fixed catalog needs N + M + 1 sheets for N themes and M design systems.

### 6.5 The declared vocabulary

**Rules**

1. The app declares the **names** its widgets, themes and design systems share.
2. The library fixes the **kinds** of name and their value types.

**Contract and examples**

```ts
type Vocabulary = {
  colourRoles: string[];                  // "surface.base", "text.muted", "accent.fill"…
  surfaceRoles: string[];                 // a subset: what `surface` accepts
  fillableRoles: string[];                // a subset: what `fill` accepts
  tones: Record<string, string>;          // tone name → colour role, for `tone`
  typographyRoles: string[];              // "body", "label", "heading.2", "mono"…
  surfaceTypography: string;              // one declared typography role for every surface root
  space: string[];                        // "space.0"…"space.7"
  radius: string[];
  size: string[];
  breakpoints: string[];
  contrast?: { foreground: string; background: string; minimum: number;
               maximum?: number; lessThan?: number; description?: string }[];
  contrastBase?: string;                  // declared surface role, opaque in the installed theme
  extensions?: Record<string, { type: "colour"; description?: string }
                          | { type: "value"; kind: ExtensionKind; description?: string }>;
};                                        // app recipe properties (§6.2); at most 64, names [a-z][A-Za-z0-9-]*
type ExtensionKind = "spacing" | "radius" | "border-width" | "size" | "opacity"
                   | "motion-duration" | "saturation" | "backdrop-blur";
```

`vocabulary.states` and `vocabulary.semantics` (both optional, at most 16 entries each, names `^[a-z][a-zA-Z0-9]*$`) extend two lists the library otherwise fixes:

```ts
type VocabularyApp = {
  states?: Record<string, { attribute: string; description: string }>;
  // an app recipe state (§6.2); `attribute` is exactly `data-` plus the name in kebab case
  // (`dragOver` → `data-drag-over`), and is never one of the library states' attributes
  semantics?: Record<string, { role: AriaRole; description: string }>;
  // an app `semantics` value (§5); `role` is one of the published `ariaRoles`
};
type AriaRole = "alert" | "article" | "banner" | "complementary" | "contentinfo" | "definition" | "directory"
              | "document" | "feed" | "figure" | "form" | "group" | "list" | "listitem" | "log" | "main"
              | "marquee" | "math" | "navigation" | "none" | "note" | "presentation" | "region" | "search"
              | "separator" | "status" | "term" | "timer" | "toolbar";
```

A name that is a library state or a library `semantics` value is `invalid-document` at `/vocabulary/states/<name>` or `/vocabulary/semantics/<name>`; so is an `attribute` that is not the derived one (`/vocabulary/states/<name>/attribute`) or that a library state already selects on, and a `role` outside the allowlist. A `semantics` enum on a definition's props may hold the library values and the declared names only; any other value is `unknown-name` at that enum item. The allowlist holds the ARIA 1.2 landmark, document-structure and live-region roles that need no required state or accessible-name rule of their own; the library never renders an element, so an implementation decides which element and attributes carry a declared role.

Fixed by the library: the kinds above, the states (§6.2), the recipe properties (§6.2), the style props and their value rules (§6.3), and the `semantics` values (§5), each extended only by the app declarations above. A theme must define every declared role, a design system every declared value name, and a catalog carries its vocabulary.

**Contrast declarations.** At most 256 pairs may name declared colour roles, with finite inclusive thresholds in [1, 21] and `maximum >= minimum`. Descriptions are at most 500 code points. `lessThan` is a zero-based integer pair index: dangling, self and cyclic references are invalid. It requires the measured ratio to be strictly less than the referenced pair's ratio. A supplied `contrastBase` must name a declared surface role and its theme colour must be opaque, even when no background needs it. Translucent pair backgrounds require that base; missing/nonopaque bases are `invalid-document`. Vocabularies without contrast declarations retain their existing behaviour.

**Contrast calculation.** Follow the accepted conversion contract (`decision-logs/2026-10-28-1123-styling-paint-alpha-contrast-native-parts.md` §3): convert all 14 DTCG spaces through XYZ D65 (Bradford-adapting D50), then to linear sRGB, clip channels to [0, 1], and encode sRGB.

Rec.2020 uses the approved piecewise inverse transfer, as in the [2025-04-24 CSS Color 4 sample](https://www.w3.org/TR/2025/CRD-css-color-4-20250424/#color-conversion-code).

Missing components (`"none"`) are zero, omitted alpha is 1, and `hex` is fallback metadata only.

Composite the background over the opaque base if needed, then foreground over background, using encoded-sRGB source-over (`a * source + (1-a) * destination`).

Linearize the resulting opaque channels using `c / 12.92` for `c <= 0.04045`, otherwise `((c + 0.055) / 1.055)^2.4`.

Luminance is `0.2126R + 0.7152G + 0.0722B`; ratio is `(max(Lfg,Lbg)+0.05)/(min(Lfg,Lbg)+0.05)`.

Compare unrounded values; round only diagnostics.

Nonfinite conversion results fail as invalid theme data.

Cache conversions per role and evaluate pairs/orderings in O(pairs).

This deterministic sRGB clipping policy does not claim to reproduce browser perceptual gamut mapping.

**Recipe-derived audit.** Declared pairs cover the theme in isolation; they cannot cover the pairs recipes create as they pair a `textColor`, `placeholderColor`, `borderColor` or `outlineColor` with a background per slot and state.

The root export's `auditContrast({ theme, designSystem, catalog, registry?, minimums? })` resolves every `(kind, variant, slot, state)` through the same cascade and returns the pairs below threshold: text and placeholder colours at 4.5:1, or 3:1 for large text from the resolved typography role (WCAG 2.2 §1.4.3), and, for kinds that declare events, `borderColor` at rest and `outlineColor` at focus at 3:1 (WCAG 2.2 §1.4.11).

The effective background is the slot's, else the kind's root slot's for the same state, else the vocabulary's `contrastBase`; a pair whose background cannot be resolved is reported as `unresolved-background`, never measured against a guess.

Each finding names the recipe key, both roles, the ratio to two decimals and the threshold.

The audit is opt-in, runs at install time and never on the render path, and it changes no installation: a design system that installs today still installs.

Changing the contrast contract or its base is conservatively classified as a major catalog change because it can invalidate installed themes. Adding an extension is a minor change; removing one, or changing its `type` or `kind`, is major because an installed design system that sets it would stop validating. A description-only change is ignored. Description-only changes are ignored; an omitted maximum is equivalent to 21.

**Rationale**

This settles portability without imposing one naming scheme (`decision-logs/2026-10-22-1905-phase-1-format-scope.md`).

## 7. Authoring and installing (Synapta's model)

**Rules**

1. Widgets, their SDK, packages, storage, preview and template widgets follow §7.1–§7.6.

**Rationale**

These feature contracts connect widget authoring to installation and host execution.

### 7.1 Widgets

**Rules**

1. A capability carries no authority.
2. The app still authorises every read and every action as the viewer.
3. The widget function is **pure and synchronous**.
4. The widget function returns **one root element**.

**Contract and examples**

```tsx
/** @jsxImportSource @arnilo/liveframe/sdk */
import { state, action, type WidgetProps } from "@arnilo/liveframe/sdk";
import { Stack, Inline, Text, Button, Tabs, Tab } from "./ui.gen"; // written by `liveframe gen` (7.2)
import { TaskCard } from "./task-card";            // a composed component: plain TSX

export default function QueueWidget({ state: s, data, context }: WidgetProps<Params, State, Data, Ctx>) {
  const rows = data.queue.rows.filter((r) => s.filter === "all" || r.owner === "me");
  return (
    <Stack gap="space.3">
      <Tabs value={s.filter} onChange={state.set("filter")}>
        <Tab key="all" value="all" label="All" />
        <Tab key="mine" value="mine" label="Mine" />
      </Tabs>
      {rows.map((r) => (
        <TaskCard key={r.id} task={r}
          onClaim={action("tasks.claim", { id: r.id })}
          onEscalate={action("tasks.escalate", { id: r.id })} />
      ))}
      {data.queue.nextCursor && (
        <Button variant="ghost" label="Load more"
          onPress={state.set("cursor", data.queue.nextCursor)} />
      )}
    </Stack>
  );
}
```

The app publishes its **capabilities**: what a widget may read and ask for.

```ts
type Capabilities = {
  format: "liveframe-capabilities/1";
  actions: Record<string, { description: string; args: ObjectSchema; result?: Schema; confirm?: boolean; irreversible?: boolean }>;
  sources: Record<string, { description: string; params: ObjectSchema; result: Schema }>;
};
```

`result` is the optional shape of an `ok` action's reported `value` (§8). `confirm` and `irreversible` are independent optional booleans, defaulting to false. `irreversible` marks an action for the control's presentation; it does not force the renderer's confirmation hook. The host still owns confirmation and authorisation on dispatch.

A widget **manifest** declares:

- `id` and `version`
- the `catalogId` it targets
- schemas for `params` (set where the widget is placed), `state` (changed by `setState`) and `context` (host-provided, for example `size`), none of which may use `pattern` (§5)
- the **data sources** it reads: `sources: Record<dataKey, { source, params }>`. Each `source` names a declared capability, and each of its params is bound to a literal or to `{ from: "params" | "state" | "context", path }`, checked against the source's params schema. `data[dataKey]` holds the source's result. The root export's `bindSources(manifest, capabilities, { params, state, context })` performs that request-time evaluation: it returns each key's `{ source, params }`, omits an absent optional binding, reports an absent required one as `invalid-prop` at `/sources/<key>/params/<name>`, and resolves no data and runs no action
- the **actions** it may invoke, each a declared capability
- the **initial `state`**, valid against its schema, used for a new placement and when a stored state no longer fits and cannot be migrated (§7.4)
- optional **state migration**: `migrateState`, at most 64 entries mapping a key of the `state` schema to a template expression (§7.6) whose only root is `previous`, the stored state. It runs only when a stored state fails the `state` schema (§7.4). Install checks each expression's shape and bounds like a template's, that `previous` is the only name it reads (so it cannot reach `params`, `data`, `context`, `actions`, a source or the host), and that each key exists in the `state` schema (`unknown-name` otherwise). The map is part of the manifest, so it is covered by the package hash
- optional **local state**: `local`, a closed object schema of at most 32 scalar properties (`boolean`, `integer`, `number` or `string`, each also nullable, strings of at most 256 characters or an `enum`; no `pattern`, `url`, arrays or objects), every property required and named like a template name (`q`, `expanded`), and `initialLocal`, which must satisfy it. Absent `local` means none (§8)

The widget function's rules:

- All inputs (`params`, `state`, `data`, `context` and `actions`) are frozen. Time and randomness come only through `context`. A module may not suspend while it evaluates: top-level `await`, `for await` and `await using` are rejected (§7.3), because a module that never settles would hold the runner. Inside functions they are ordinary async code, which the renderer never waits for.

- `actions` is the host's report on each action (§8). It is an input like `context`: the library stores none of it, and an absent `actions` is `{}`.
- **Locale, direction and time zone** reach a widget only through `context`, like time and randomness. The conventional keys are `locale` (a BCP 47 tag), `direction` (`"ltr"` or `"rtl"`) and `timeZone` (an IANA name); they are conventions the manifest's `context` schema declares if it wants them, not reserved names. A widget that calls `Intl` or `toLocale*` formats with the data of the runtime it runs on, which ECMA-402 leaves implementation-defined, so its output is deterministic only within one runtime build and a `renderKey` cache (§8) shared across runtimes is unsafe for it. The portable pattern is for the host to format and hand the text over as data (a source bound to `context.locale`), which keeps the tree a function of the inputs. A template (§7.6) has no locale-dependent operator, so its output is runtime-independent. Text direction is the host's: it sets `dir` on the surface, and logical-side projection (§6.2–§6.3) mirrors the layout.
- It uses only catalog primitives and composed components. **Host elements are errors** (`<div>`, `<span>`), and so are function props, promises, async functions, and string `className` or `style`. Props are JSON at every depth: a composed component's props are walked before it runs, so a nested function or promise is rejected even if the component would discard it.
- Every element in a list needs a **`key`**. Node ids are key paths (`root/queue/row:4812/claim`), never positions, so the renderer keeps focus, scroll and local state across re-renders.
- **Long lists are paged or windowed.** A widget renders what a surface shows, and loads more through `setState`. Render cost grows with node count, and performance budgets are measured on these realistic sizes.
- **Composed components are ordinary functions** in the same bundle or in shared modules. They are expanded when the widget runs, and the UI tree contains only primitives.

**Rationale**

Capabilities are how an author, person or agent, learns what exists, and what lets the validator check action arguments before they reach the dispatcher.

### 7.2 The SDK

**Rules**

1. `render()` copies inputs during its JSON check and gives widgets a deeply frozen envelope and nested values. Caller objects are never frozen or mutated; mutable inputs are checked on every render. Checked copies of deeply frozen inputs may be reused under the same schema.

2. The SDK runtime uses no host APIs (no `node:`, `bun:`, DOM or `require`), so it runs unchanged in any JS runtime and any sandbox the app chooses.
3. **Components come from a generated module.**

**Contract and examples**

- `jsx`, `jsxs` and `Fragment` under `jsxImportSource: "@arnilo/liveframe/sdk"`. Elements are frozen records keyed by primitive kind.
- `liveframe gen <catalog> --out <file>` writes a typed TypeScript module into the app, binding one component per definition with `primitive("<kind>")` from the SDK:

  ```ts
  export const Button = primitive<ButtonProps>("button");
  ```

  A widget imports it by relative path (`./ui.gen`, §7.1). Props are readonly, each declared event becomes a typed event prop, docs come from the definition, and `liveframe gen --check` fails CI on drift.
- **The emitters are also a host-side function.** `generate(catalog)`, `generateDefinitions(catalog)`, `generateElementsSchema(catalog)` and `generateTemplateSchema(catalog, { manifest?, capabilities?, structuredSubset? })` ship from `@arnilo/liveframe/sdk/gen`, byte-identical to the CLI's modes, so a host build service can generate any module without the CLI. The subpath is host-API-free and takes a validated `Catalog`.
- **Implementation definitions can be generated too.** `liveframe gen <catalog> --implementations --out <file>` writes a separate module of `as const satisfies Definition` exports, one per definition, so the app, when it implements a primitive itself, calls `implement()` (§11) on a JSON-loaded catalog and still infers props, slots, event names and carry value types as it does for a hand-written definition. Drift is checked the same way, and the generator neither imports the SDK nor generates a runtime implementation.
- `state.set(key, value?)` and `action(name, args, { bind?, bindAll? }?)` return frozen intent data. Without a value, `state.set(key)` sends the value the event produced. `bind` fills a scalar argument; `bindAll: true` fills several arguments from one object event (§8).
- **Agent element JSON.** `renderElements(json, { validator, surfaceId, revision, limits?, maxErrors? })` from `/sdk` builds a tree from an unpackaged surface an agent emitted as JSON: `{ kind, key?, $anchor?, variant?, props?, style?, events?, children? }`, with intents in the `Intent` shape.

  It uses `render()`'s key-path ids, limits, validation and error kinds, uses one node walk plus deferred reference checks, and rewrites each error `pointer` to point into the JSON (`nodeId` stays the derived key-path id).

  A `fragment` element groups keyed children without adding a node.

  The `Elements<Catalog>` type is its typed form.

  `ephemeralManifest({ catalogId, actions, state? })` builds a manifest the browser's arrival check accepts; `state` is the initial value, and its schema is derived from it.

  Neither API stores anything: a persistent surface is a real package.
- **Streamed element JSON.** `streamElements({ validator, surfaceId, revision?, limits?, maxErrors? })` from `/sdk` returns `{ push(chunk), end() }` and draws an agent's element JSON while it is still arriving.

  It reads the JSON text incrementally (host-API-free, linear in the input, at most four times `limits.bytes` characters held). After each chunk it returns a new `Result<UiTree>` when the set of **completed** nodes changed, else `undefined`.

  A tree holds every node whose object has closed and passed the checks `renderElements` makes, plus the shell of each node still open once its own fields are in (the members before its `children`), around the children completed so far. A half-written node and the siblings after it are left out. A shell the catalog's child rules do not yet accept (a kind that requires children, before its first child closes) is left out until it is valid.

  Every tree is a valid tree (law 2), numbered `revision + 1`, `revision + 2`, … so a host can send `diffTrees(previous, next)` patches (§9.1).

  A node that fails its checks is left out of the trees and is not fatal; `end()` reports it. A node that carries a `$ref` is drawn when the text ends, once references resolve. A member written after `children` stops further trees, and `end()` is still exact.

  `end()` returns what `renderElements` returns for the whole text, with a revision one past the last tree returned.

  Malformed JSON is `invalid-document` at `/$stream/<offset>` (the character offset), reported as soon as the value containing it closes. A tree over the byte budget, too many errors, or too long a text is `limit-exceeded`. After either, `push` and `end` return that failure.
- **`render(widget, inputs, { validator, surfaceId, revision, limits?, maxErrors? })`** runs the function, builds the tree with key-path ids, and validates during emission, deferring reference-bearing node checks until targets resolve (§10). `validator` is a `CompiledValidator` from `compileValidator`; `limits` bounds nodes, depth and bytes (§10); `maxErrors` is the error bound below.
  - It returns `Result<UiTree>`: `{ ok: true, value }` or `{ ok: false, errors }`, where `errors` is every error found, up to `maxErrors` (default 20, the bound §10 uses). Each is a `LiveframeError` (§10) whose `kind` is one of `host-element`, `unknown-component`, `invalid-prop`, `invalid-children`, `missing-key`, `duplicate-key`, `undeclared-event`, `undeclared-action`, `function-prop`, `async-render`, `render-failed`, `limit-exceeded`, `not-found`.
- **Node references.** `/sdk` exports `ref(anchor)`, returning a frozen `{ "$ref": anchor }` marker of root-export type `NodeRef`. Generated `refProps` accept `NodeRef`; element JSON uses the same marker. `$anchor` is a tree-unique string attribute on a primitive, excluded from its emitted props. A duplicate is `duplicate-key` at the second `$anchor`, expected `a tree-unique anchor`. After emission, pending references resolve to key-path ids; missing anchors are `not-found` at the referencing prop, with the anchor name in `expected`. The resulting string must satisfy the catalog prop schema. Byte limits count resolved strings exactly. Nodes are walked once; only pending references and their node checks are deferred.
  An input that fails its manifest schema is `invalid-prop`, with a pointer into the inputs (`/state/filter`) and no `nodeId`.

**Rationale**

The generated component module is source, not a `.d.ts`, so an unpacked widget still runs, and `pack()` bundles it like a composed component (§7.3).

### 7.3 Packages

**Rules**

1. `pack()` and `verifyPackage()` return owned, deeply frozen packages, including manifests and scenarios. `outcomeScenarios()` returns deeply frozen scenario copies. Runners cache hash verification only for deeply frozen packages; mutable transport packages are rehashed.

2. **`pack()` never runs widget code.**
2. **A package is immutable.**
3. An `(id, version)` names exactly one hash, and storing different content under an existing pair is an error.

**Contract and examples**

A widget is installed as a **package**: the unit the app stores, approves, places and loads into its sandbox. An author writes TSX, but a sandbox runs JavaScript, so installing starts with `pack()` (`@arnilo/liveframe/pack`):

```ts
pack({ files, entry, manifest, scenarios }, { catalog, capabilities }) → Result<WidgetPackage>
pack({ template, manifest, scenarios }, { catalog, capabilities }) → Result<WidgetPackage>   // a template widget (§7.6)

type WidgetPackage = {
  format: "liveframe-package/1";
  manifest: Manifest;           // id, version, catalogId, schemas, initial state, optional description and meta (§7.1)
  code?: string;                // a TSX widget: one ES module; its default export is the widget function
  template?: Template;          // a template widget (§7.6); exactly one of `code` and `template` is present
  scenarios: Scenario[];        // 1…64, with unique names
  hash: string;                 // "sha256-" + 64 lowercase hex digits; see canonical form below
};

type Scenario = {
  name: string;                 // "default", "empty", "failed"…
  params: Json;
  context: Json;
  state?: Json;                 // absent ⇒ the manifest's initial state
  data: Record<string, Json>;   // keyed by the manifest's data source names
};
```

A package holds **exactly one of `code` and `template`**; both or neither is `invalid-document` at `/code`. The format keeps its id: `template` is an optional field, so a 0.2.x verifier rejects a template package fail-closed (an unknown field). A template is bounded to 1 MiB of UTF-8 JSON (`limit-exceeded` at `/template`), and its structure is the `urn:liveframe:template:1` schema.

Packages carry 1…64 scenarios with unique, non-empty names of at most 128 Unicode code points. Code is bounded to 1 MiB (1,048,576 UTF-8 bytes). The published JSON Schema also caps code at 1,048,576 code points; the structural validator enforces the byte bound and unique scenario names, which standard JSON Schema cannot express.

Optionally, the root `sourceOutcome(result)` helper declares the generic `ok` (required `value`, optional `checkedAt` bounded to 128 code points) and `unauthorized|unavailable|stale|failed` (optional `reason` bounded to 500 code points and optional `value`) union on `status`; `/pack`'s `outcomeScenarios(scenario, { source, manifest, capabilities })` returns `Result<readonly Scenario[]>`, expanding a declared source alias into `<name>.<status>` fixtures using the seed envelope's valid `value` for `ok` and status-only failure envelopes, with typed errors for unknown sources, schemas outside this convention, invalid seeds or generated names, while `pack()` retains all scenario checks.

`pack()`:

- checks the manifest: its `catalogId` is the catalog's, its schemas are well formed, and its initial state matches its state schema;
- checks the scenarios: at least one, unique names, params, state and context valid against the manifest's schemas, and data keyed by declared source names and valid against each named source's `result` schema;
- for a template draft, validates the template against the install documents and the manifest (§7.6) and stops there: it never transpiles, bundles or loads anything, and every template error keeps its own kind (`unknown-name`, `invalid-prop`, …) at a pointer under `/template`;
- for a code draft, transpiles the TSX and bundles the entry's relative imports into one module. A composed component is bundled into every package that imports it, so a package never depends on another;
- rejects every other import except the SDK (`@arnilo/liveframe/sdk` and its JSX runtime), which the app's sandbox provides;
- rejects top-level `await`, `for await` and `await using`: widget modules evaluate synchronously, so a suspension at that level would be a way to hold a runner forever;
- hashes the result.

**Canonical form and hash.** Hash exactly `{ format, manifest, code, scenarios }` for a code package and `{ format, manifest, template, scenarios }` for a template package, excluding `hash`; the field that is absent is not part of the object, so a code package's hash is the same as before templates existed. Canonical JSON follows [RFC 8785 §3.2](https://www.rfc-editor.org/rfc/rfc8785.html#section-3.2): sort object keys recursively by their unescaped UTF-16 code units, preserve array order, emit no whitespace, and use ECMAScript serialisation for strings, numbers and literals. Preserve Unicode without normalisation; reject non-JSON values, non-finite numbers and lone surrogates. Encode the canonical string as UTF-8, compute SHA-256 ([FIPS 180-4 §6.2](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf)), and prefix its lowercase hexadecimal digest with `sha256-`. An internal pure-JavaScript SHA-256 implementation keeps `pack()` synchronous and host-API-free, without Web Crypto. `/pack` exports `canonicalJson` and `packageHash` so a TypeScript host computes the same value, and `conformance/hash/packages.json` and `conformance/hash/template-packages.json` pin `{ package, hash }` vectors for ports (§13).

**Manifest `description` and `meta`.** A manifest may carry an optional `description` (at most 500 code points) and an optional `meta`, a JSON value of at most 8 levels of nesting and 4096 bytes of compact UTF-8 JSON, counted while walking. Capability actions and sources take the same optional `meta`. The library never reads `meta` (law 4): it is the host's annotation, untrusted on load, and it grants nothing. An over-bound value is `limit-exceeded` at the pointer; a non-JSON value is `invalid-document`. The package hash covers the manifest's `description` and `meta`, because the canonical form covers every manifest field; capabilities are the host's own document and are not packaged, so capability `meta` is outside the hash.

`pack()` and `verifyPackage()` return `Result<WidgetPackage>` with bounded `LiveframeError[]` on failure (§10). A malformed manifest or scenario uses `invalid-document`; no scenarios points at `/scenarios`. Import and syntax failures use the distinct kinds in §10, with a file and line in `pointer` (a JSON Pointer such as `/files/queue.tsx/12`).

- Rendering a draft is the preview's job (§7.5), through the app's runner and under the app's policy.
- A change is a new version, and rolling back means placing an older one.
- **`verifyPackage(pkg, { catalog, capabilities })`** re-checks the format, the manifest, the scenarios and the hash without executing anything. For a code package it re-parses the code and re-applies the module rules: only SDK imports may remain in a linked package, and no top-level `await` may remain in it. For a template package it re-validates the template against the install documents and the manifest (§7.6). The app runs it on every package it loads.
- **`checkPackages(packages, { catalog, capabilities, runner? })`** reports, for each stored package document, `{ id, version, hash, ok, errors }`: the package goes through `verifyPackage`, and with a `runner` every scenario is then rendered and its tree validated on the host, with errors pointed at `/scenarios/<n>…` (a thrown runner is `render-failed`). It is how an app learns which installed packages break against a new catalog version before shipping it (`classifyCatalogChange` says what changed; this says what that breaks). It mutates and stores nothing and never defaults a runner: without one, packages are verified but not rendered, and a code package runs only in the runner the caller supplies (law 1). `liveframe check-packages <store-dir> --catalog <file> --capabilities <file>` prints the report for a `fileStore` as JSON and exits 1 when any package fails; it renders template packages with `templateRunner` and only verifies code packages.
- The package hash is the widget part of the re-run cache key (§8).
- `/pack` is host-API-free, so the app can pack wherever it installs widgets.

**Rationale**

The hash checks integrity, not origin or approval.

### 7.4 Storage

**Rules**

1. **A store is not trusted.**
2. **The app owns tenant isolation.**
3. **Approval is the app's.**

**Contract and examples**

Everything that changes is a record, and keeping changes across launches means storing these records and reading them back:

| Record | Holds | Key |
|---|---|---|
| Package | §7.3 | `(id, version)` |
| Placement | `{ id, slot, widget: { id, version }, params }`; `slot` is the app's own name for where the surface goes | `id` |
| State | The placement's widget state in a host-selected scope | `(placementId, scope)` |
| Style | An installed theme or design system: `{ kind: "theme" \| "designSystem", id, version, body }` | `(kind, id, version)` |

`@arnilo/liveframe/store` defines the records and the interface every store implements:

```ts
interface Store {
  putPackage(pkg: WidgetPackage): Promise<void>;          // rejects a second hash for an existing (id, version)
  getPackage(id: string, version: string): Promise<WidgetPackage | undefined>;
  putPlacement(placement: Placement): Promise<void>;
  getPlacement(id: string): Promise<Placement | undefined>; // one read, whatever else is stored
  deletePlacement(id: string): Promise<void>;             // removes state in every scope too
  listPlacements(): Promise<Placement[]>;
  putState(placementId: string, scope: string, state: Json): Promise<void>;
  getState(placementId: string, scope: string): Promise<Json | undefined>;
  putStyle(style: StyleRecord): Promise<void>;
  getStyle(kind: StyleRecord["kind"], id: string, version: string): Promise<StyleRecord | undefined>;
}
```

It also ships:

- **`memoryStore()`**, for tests and ephemeral hosts.
- **`fileStore(dir)`** (`@arnilo/liveframe/store/fs`), for a desktop or single-node app. It keeps one JSON file per record and writes each atomically: a temporary file, then a rename. It assumes one writing process. A key becomes a file name by percent-encoding every byte outside `a-z`, `0-9`, `_` and `-`; a key whose encoded form exceeds 200 bytes is named `~` plus the SHA-256 of its UTF-8 bytes instead, so every id the record formats allow is storable inside a 255-byte file-name limit. The layout follows the compatibility promise in `docs/compatibility.md`.
- **`loadPlacement(store, id, { catalog, capabilities }, { scope?, state?, verified? })`**, which reads a placement, its package and its state, verifies all three, and returns `Result<{ package, params, state, reset?, migrated? }>`. The fourth argument is optional; scope defaults to `""`. An own `state` property bypasses `getState`, including when its value is `undefined`. Explicit state follows the same check, migrate and reset rules as stored state. Failures carry bounded `LiveframeError[]` (§10); `reset`, when present, holds the validation errors that caused a state reset, and `migrated`, when present, holds the validation errors of the stored state that `migrateState` replaced (never both).
- **`verifyPlacementInputs(pkg, { params, state? })`**, for hosts that already verified the package and keep state outside a store. Returns `Result<{ params, state, reset?, migrated? }>` using the same checks as `loadPlacement`: invalid params reject, missing state uses initial state, and invalid state migrates (when the manifest declares `migrateState`) or resets, with reported errors. Neither helper executes code or persists a reset or a migrated state.

- **`verifiedPackages({ max? })`** returns a host-owned `get`/`set` LRU cache, bounded to 256 entries by default. `max` must be a positive safe integer; otherwise construction throws `LiveframeFailure` with `invalid-document` at `/max`. Pass it as `{ verified }` to `loadPlacement`. Only verified, deeply frozen packages belong in the cache; direct `set` calls are trusted host operations. The cache can be shared across stores of one installation.

- A cached load still validates the stored package structure and recomputes its canonical content hash, checking the declared hash. Cache keys combine that computed hash with the canonical JSON of the catalog and capabilities. Hits reuse manifest, scenario and code verification; changed installation documents miss. Placement identity, params and state checks run every time. Omitting the cache retains full verification on every load.

- Like a tree arriving at the renderer (§10), every record read back is checked: the package by `verifyPackage` or the content- and installation-keyed cache, the params against the package's params schema, and the state against its state schema. A state that no longer fits, typically after a placement moves to a new widget version, is first migrated, when the manifest declares `migrateState`, and otherwise reset to the manifest's initial state; `loadPlacement` reports either. Any other failure is an error, never a silent fallback.
- **State migration** is declarative and runs only on that failure path. It starts from `initialState`, overlays each `migrateState` key with its expression evaluated over `previous` (an expression that yields nothing, `$omit`, leaves the key at its initial value), and accepts the result only if it satisfies the `state` schema. Keys not named in `migrateState` take their initial values; nothing is copied implicitly.
- A stored value that is not JSON, an expression that fails at run time (including its step budget) and a result that does not fit all fall back to the reset, so migration never turns a loadable placement into a failed one.
- Migration reads only the stored state: no data, no host access and no widget code, so it needs no runner and nothing at load time but the manifest (law 4). Neither the migrated nor the reset state is written back; the host persists it if it wants.
- Missing placements or packages, conflicting package versions, malformed records and package integrity failures use the distinct typed errors in §10. `putPackage()` keeps its `Promise<void>` contract and rejects with a `LiveframeFailure` (§10) carrying the version-conflict error when an existing `(id, version)` has a different hash; a store rejects rather than returning a result, so the app catches it at the write boundary. `loadPlacement()` reads one placement by id and never lists, so a malformed sibling record cannot block a load.
- A multi-tenant app opens one store per tenant, or implements the interface over its own database and scopes it itself.
- **State scopes are host data.** Within that store, state is keyed by placement and a scope string of at most 128 Unicode code points, with no pattern; `""` is shared state. Invalid scopes reject with `LiveframeFailure` carrying `invalid-document` at `/scope`. Unsupported scopes must reject, never fall back to shared state. This grants no authority and does not replace tenant isolation or authorization. Deleting a placement removes all its state scopes, even if the placement record is absent.
- **Existing state files keep their meaning.** `fileStore` reads and writes shared state at `states/<encoded-id>.json`. Named scopes use `states/<encoded-id>/<encoded-scope>.json`, applying the existing filename encoding and long-key hashing to both segments. No data rewrite is needed.
- A stored package is inert until the app puts a placement for it. Which theme and design system are active, per user or organisation, is also an app setting.
- **The conformance kit has a store suite** (§13), so an app's own store, for example over Postgres, proves it keeps these rules.

**Rationale**

A runtime change never edits the app's code.

### 7.5 Runners and preview

**Rules**

1. **Preview and production use the same runner**, so a preview shows what will run.
2. A runner enforces a time limit per render (`timeoutMs`, default 100 ms) and returns `limit-exceeded` when it trips.
3. Neither reference runner is an isolation boundary; both return only trees their own validator accepted.

**Contract and examples**

**Runners.** A runner is where widget code executes:

```ts
interface Runner {
  render(
    pkg: WidgetPackage,
    inputs: WidgetProps,
    options: { catalog: Catalog; capabilities: Capabilities; surfaceId: string; revision: number; limits?: Limits; timeoutMs?: number },
  ): Promise<Result<UiTree>>;
}
```

- The app's sandbox is a runner.
- A runner compiles the validator from `{ catalog, capabilities, pkg.manifest }` and calls `render()` (§7.2) with `surfaceId`, `revision` and `limits`. Reference runners use the SDK's default error bound; `maxErrors` is not a `RunnerOptions` field.

  `/runner-kit` ships that step: `renderModule(widgetDefault, inputs, { catalog, capabilities, manifest, surfaceId, revision, limits?, maxErrors? })` is synchronous, caches the compiled validator (the 64 most recent manifests per `(catalog, capabilities)`, keyed by the manifest's canonical JSON), and returns `render()`'s `Result<UiTree>`, with a thrown widget or a non-function default as `render-failed`.

  Both reference runners are built on it.

  A sandbox loads the module itself; the kit neither loads, times nor isolates it, and the host still validates every tree it receives (law 2).

  A host renders several scenarios of one package by packing once and calling the runner per scenario; there is no batch call, because the host would validate each result anyway.

- **Template packages need no isolation runner** (§7.6). Their `template` is data that the library evaluates in bounded steps, so a runner that renders only templates loads and runs no author code. `/runner-kit` ships that step as `renderTemplatePackage(template, inputs, { catalog, capabilities, manifest, surfaceId, revision, limits?, maxErrors? })`, synchronous like `renderModule` and sharing its validator cache; `limits` also accept `steps` (§7.6). Every runner below renders a template package and gives the same tree for the same package and inputs; only `templateRunner` is restricted to them.

- Liveframe ships three reference runners:

  - `templateRunner()` (`/preview`) renders template packages only and loads nothing. A code package is refused with `invalid-document` at `/code` ("templateRunner renders template packages only"). It is the recommended production runner for authors you do not trust when templates are enough. A render that returns after `timeoutMs` is reported as `limit-exceeded`, though the step limit already bounds the work. It verifies the package hash as the others do, so use `verifyPackage` or `loadPlacement` first.
  - `inProcessRunner({ maxModules? })` (`/preview`), for tests and trusted code. It cannot interrupt a loop; a render that returns after `timeoutMs` is reported as `limit-exceeded`.
  - `workerRunner()` (`/preview/worker`) runs packages in a worker and terminates it on a timeout or crash. It bounds time and crashes, not what the code can reach. Each render carries an id and only that id's result is accepted: a result with no pending render, the wrong id, or a second answer for one id terminates the worker, and the pending render fails with `render-failed`. A tree the host's validator rejects returns that validator's errors, and the worker is not reused.
- **Reference-runner caches.** A package's hash keys a module or validator cache only after `packageHash(pkg)` matched it. Deeply frozen packages may reuse that check; mutable transport packages are rehashed. A mismatch is `hash-mismatch` and nothing loads. Validators are kept per `(catalog, capabilities)` and hash, the 64 most recently used. Loaded modules cannot be unloaded, so `inProcessRunner({ maxModules })` reports the loader's process-wide count through `stats().modules` and, at `maxModules` (default 256), refuses a package whose hash is not loaded yet with `limit-exceeded` (loaded hashes still render), while `workerRunner({ maxPackages })` (default 64) restarts its worker once that many distinct hashes have been loaded. Template packages load no module, so neither limit counts them.
- **A runner re-validates results produced outside the host's realm.** Widget code shares the worker's realm and can post its own messages, so `workerRunner()` keeps the trust anchor on the host, where the tree is validated again against the request's manifest. One worker still serves every package: a hostile widget can answer another render with a tree that is valid for that render's manifest. Hostile code needs the app's own isolated runner (§14).
- **The linker contract.** `pack()` begins a package's code with one line per SDK specifier it uses, in order of first use: exactly `import * as __lf_sdk<N> from "<specifier>";`, `N` counting from 0, the specifier one of `@arnilo/liveframe/sdk`, `@arnilo/liveframe/sdk/jsx-runtime` or `@arnilo/liveframe/sdk/jsx-dev-runtime`, each at most once. `linkPackage(code, resolve)` (`/runner-kit`, pure) rewrites those lines, replacing each specifier with `resolve(specifier)` and leaving every later byte unchanged. Code with no such line is returned unchanged; a line that starts `import * as __lf_sdk` but is not canonical, is out of sequence or repeats a specifier is an `invalid-document` at `/code`. Only the header is read, so SDK-looking text later in the code is neither rewritten nor detected.
- **How a reference runner loads a package.** Before importing, the loader links the canonical linker header lines (`import * as __lf_sdkN from "<sdk specifier>";`) with `linkPackage`, resolving `@arnilo/liveframe/sdk`, `@arnilo/liveframe/sdk/jsx-runtime` and `@arnilo/liveframe/sdk/jsx-dev-runtime` with `import.meta.resolve` from the loader's own location. These imports resolve from the library's own installation, independently of the host's working directory. It imports the rewritten code with `import("data:text/javascript," + encodeURIComponent(code).replaceAll(".", "%2E"))`, escaping dots so Bun treats the URL as JavaScript. Stored package code retains its bare SDK specifiers. The dynamic-import restriction and CLI exception are defined in §13. A host whose sandbox cannot do this supplies its own `Runner`.

**Scenarios** are required (§7.3). They are an author's test cases and a reviewer's view of the empty, failed and full states. The app may preview with live data resolved as the viewer instead of a scenario's data.

**Preview sessions** (`/preview`, host-API-free). `createPreview({ catalog, capabilities, runner, limits? })` returns a session on the app's backend. Trees do not depend on themes or design systems, so the session takes none:

`limits?: RenderLimits` sets optional `nodes`, `depth` and `bytes` bounds (§10), each a positive safe integer. Omitted fields retain the defaults. The session snapshots the limits and applies them to every runner call and host tree validation, including scenario checks and intent re-renders. Invalid limits throw `LiveframeFailure` with `invalid-document` at `/limits` during construction.

- `update({ files, entry, manifest, scenarios })` or `update({ template, manifest, scenarios })` (a template widget, §7.6) packs a draft, which is never stored, and returns `Result<WidgetPackage>`: the packed package, which carries its hash, or the pack errors. Success resets the current scenario, state and intent log. Failure keeps the previous package and session state;
- `render({ scenario, context?, state?, preserveState? })` selects a scenario by name as the current scenario and renders it through the runner, returning `Promise<Result<UiTree>>`. State comes from the explicit argument, else the scenario, else the manifest's `initialState`; context comes from the argument or scenario. With `preserveState: true` and the same selected scenario, existing state/context are retained unless explicitly overridden; the default is false, and a different scenario starts from its normal initial selection. Host snapshot readers opt in so page reloads and capture retain tool-applied state. The session keeps a fixed `surfaceId` and increases its revision on every render. Failures use `LiveframeError`s (§10), with `nodeId` when an error identifies a node;
- `intent(intent, origin?)` returns `Promise<Result<UiTree>>`. It re-checks a `setState` key and value against the manifest state schema, then updates the session state and re-renders with the current scenario and context. It re-checks an action against the manifest and the capability argument schema with `checkValue`, then appends it to the log and returns the current tree unchanged. When `origin` is supplied, it first applies `checkOffered(currentTree, origin, intent, validator)`; a failed current render or an unoffered/stale intent changes nothing. Omitting origin preserves schema-only checking for existing callers. Invalid intents change nothing. Actions are **never dispatched**;
- `intents()` returns the session's log as `readonly Intent[]`;
- `check()` renders every scenario from its own initial state and returns each `{ scenario, result }`, without changing the current scenario or state, so an app can require all of them to render before approval.

Publishing a previewed draft stores exactly the package `update()` returned, with the same hash. A draft is not a record. An app that keeps drafts across launches stores the draft's files itself.

**`<Preview>`** (`/preview/react`) is mounted by the app inside its own page, so the draft draws with the app's primitives, CSS and shell. The host passes the selected scenario's result and the session's intent log through its own transport. Draft code never reaches the browser (law 1). `<Preview>` draws that tree in every cell of `widths × themes × designSystems`, through a renderer from `createRenderer` (§11) with the app's validator. Cells are sibling surfaces, never nested, each in a container sized to its width. Width and style changes reuse the tree; selecting another scenario needs a host render.

`resultScenario` is required: it names the scenario `result` was rendered for, and the component never infers a label. A result labelled `A` is drawn only while `A` is selected, so a first result for `A` never appears as `B`, and the "last good render" map is keyed by `resultScenario` alone. The selected cell is highlighted and reported through `onSelect(cell)`.

Selections have two modes.

**Uncontrolled** (default), the cell is mirrored in the URL: `scenario` is the scenario name, `width` is in CSS px, and `theme` and `designSystem` are `id@version`.

A `urlKey` prefixes every key as `<urlKey>.<name>`, so two previews on one page never read or overwrite each other's keys; without it the bare keys keep `liveframe preview capture` and the MCP capture working unchanged.

`<Preview>` reads the selection on mount and writes changes with `history.replaceState`.

**Controlled**, when `selection` is supplied: `<Preview>` neither reads nor writes `location`, so an in-memory router keeps its URL; it draws `selection`, and user selections still call `onSelect(cell)` for the host to feed back.

Invalid or absent values, in the URL or in a controlled `selection`, default to the first entry of each axis.

It reports cell intents through `onIntent(intent, origin)` for the host to hand both arguments to the session.

It lists the intent log and each render error's `nodeId` (when present) and `pointer`. After a failed render, an earlier successful tree for the same scenario is drawn dimmed and labelled "last good render"; matching node elements receive `data-lf-error`. Without such a tree it shows the host's fallback. The retained tree still passes through `<Surface>`'s arrival check; this does not change §11's invalid-tree fallback rule.

For capture, `data-lf-preview` holds JSON axes `{ scenarios, widths, themes, designSystems }`, with scenario names, numeric widths and style `id@version` strings, plus `urlKey` for a keyed uncontrolled preview or `controlled: true`. Each cell's `data-lf-cell` holds its JSON coordinates `{ scenario, width, theme, designSystem }`. `data-lf-ready` is set once every cell for the current scenario has mounted with its result and errors.

**Capture** is for agents:

```sh
liveframe preview capture <url> [--scenario <a,b>] [--width <n,m>] [--theme <id@v,…>] [--design-system <id@v,…>] [--layout] [--text-scale <n,m>] [--forced-colors <none,active>] [--reduced-motion <no-preference,reduce>] --out <dir>
```

It opens the app's preview page in headless Chromium and captures all declared cells unless flags narrow the axes. It navigates once per scenario, setting `<urlKey>.scenario` for a keyed preview, waits for `data-lf-ready`, and captures each requested cell element as `<dir>/<cell>.png` and `<dir>/<cell>.aria.yml` (the YAML accessibility snapshot from `locator.ariaSnapshot()`). A controlled preview ignores the URL, so capture sets nothing, captures only the scenario the page shows, and reports `CaptureError("not-found")` when a flag asks for another. Cell filenames are derived from their coordinates, sanitised to stay under `--out` and made unique with a numeric suffix if two cells sanitise alike. `<dir>/index.json` contains paths relative to that directory and the cell's `LiveframeError`s:

```json
{ "url": "…", "cells": [{ "scenario": "…", "width": 360, "theme": "…", "designSystem": "…", "png": "…", "snapshot": "…", "errors": [] }] }
```

The host-API-free `/preview/capture` exports `capture(url, { backend, scenarios?, widths?, themes?, designSystems?, maxCells?, layout?, media? })`, `playwrightBackend(playwright)`, `CaptureError` and the capture types.

Capture returns `{ index, files: Map<string, Uint8Array> }`, including `index.json`, takes no `out` and writes nothing.

`CaptureBackend<Handle>.open(url)` returns a session with `waitReady(selector)`, `axes()`, `cells()`, `screenshot(handle)` (PNG bytes), `ariaSnapshot(handle)` (YAML or null), an optional `layout(handle)`, an optional `emulate(media)` and `close()`.

Axes include `shown` for controlled previews; cells include handles, coordinates and errors.

Every session and the optional backend `close()` are closed on completion or failure.

The adapter takes an explicitly imported Playwright module and reuses one Chromium instance per call; importing the subpath never loads Playwright.

Snapshots are opaque default `locator.ariaSnapshot()` YAML on the `^1.49.0` peer range.

A backend without snapshots records `snapshot: null` and emits no snapshot file.

Screenshot fidelity depends on the backend's engine.

With `layout: true` (CLI: `--layout`) each cell also gets `<cell>.layout.json` and a `layout` entry in its index record: `{ width, height, overflowX, overflowing, nodes: [{ id, x, y, width, height }] }`, integer CSS pixels relative to the cell's border box, holding numbers and node ids only.

A node's box is the union of its `data-lf-node` wrapper's child boxes, looking through nested `display: contents` wrappers (the wrapper itself has no box); a node with no box is reported with zero size, never omitted.

`overflowing` lists the nodes whose box crosses the cell's right edge, and `overflowX` is true when any does or the cell scrolls horizontally.

A backend without `layout(handle)` records `layout: null` and writes no file; a record over 262144 bytes is `limit-exceeded` naming the cell, never truncated.

Without the option, results are unchanged.

The CLI writes the returned map to `--out`.

With `media: { textScale?: number[], forcedColors?: ("none"|"active")[], reducedMotion?: ("no-preference"|"reduce")[] }` (CLI: `--text-scale`, `--forced-colors`, `--reduced-motion`) every requested value multiplies the cells, so `maxCells` bounds the product and an over-large call is `limit-exceeded` before any cell is captured.

Each cell is captured at one media point: `emulate(media)` runs after the page is open and before `waitReady`, `playwrightBackend` implements `forcedColors` and `reducedMotion` with `page.emulateMedia` and `textScale` by setting the root `font-size` percentage, and the cell and its index record carry that point in a `media` field, which also appears in its filename.

A backend without `emulate` refuses a call that requests media with `not-found` at `/media` naming the axes; a call without media never calls `emulate` and writes no `media` field, so its output is unchanged.

`textScale` and the enums are validated before capture.

The `contrast` axis is excluded because it needs Playwright 1.51 and the peer floor is `^1.49.0`.

Playwright is an optional peer dependency, lazily loaded only by CLI capture paths. The authoring MCP server (§13) exposes the same capture as its `capture_preview` tool, against a page its config bound to the server's own session.

**Rationale**

Nobody publishes a widget blind. A person or an agent writes it, looks at it, changes it and looks again. Liveframe ships that loop; the app keeps the isolation.

### 7.6 Template widgets

**Rules**

1. A template widget is **element JSON plus a bounded expression language**, a registered format `liveframe-template/1`. It is evaluated by the library on the backend, so it needs no isolation runner.
2. A template is **validated at install against the manifest**: structure, bounds, the component graph and every expression. Errors point into the template document.
3. Expressions are **JSON, never parsed strings**: a scalar is a literal, an array or an object without a `$`-key is a constructor, and an object with exactly one `$`-key is an operator. `{ "$lit": json }` escapes.
4. The operators are a **closed table** with no globals, no recursion, no function values and counted work, so a template cannot reach the host or fail to terminate.
5. A template **names actions statically**. It can bind their arguments, never compute which action runs, and the app re-checks every intent as for any widget.
6. Template bounds: 1 MiB of JSON, 10,000 template nodes, 20,000 expression nodes, expression depth 32, 64 components, component use 16 deep, 32 `$let` bindings and node nesting 128.

**Contract and examples**

- Document: `{ format, components?, root }`. A component is `{ params, root }`, and `params` is an object schema. A node is element JSON (`kind`, `key`, `variant`, `$anchor`, `props`, `style`, `events`, `children`) whose values may be expressions, plus the directives below. `kind` is a catalog kind or `fragment`.
- Directives run in this order on one node: `$let` (an array of `{ as, value }`), `$if` (a boolean expression), `$each` (`{ in, as, index?, key }`), then the body, which is an element or `$use` with `with`. `$each` emits one body per item with `$each.key` as its key, so the node carries no `key` or `$anchor` of its own. A `$use` expands to its component's root and leaves no node.
- Names: the roots are `params`, `state`, `data`, `context` and `actions`, plus names bound by `$let`, `$each`, `$filter`, `$map` and `$findIndex`. A name never shadows another. **A component is hermetic**: its body sees its own `params` as bare names and nothing else.
- Paths such as `data.queue.rows.0.id` are checked against the manifest's schemas, the data schema built from its sources, or a bound name. A path into a missing property is `unknown-name`; a segment such as `__proto__` or a `$`-prefixed one is `invalid-document`.
- Each binding is checked for shape against the target: a prop, a `setState` value, an action argument or a component param. A constant is checked with the real schema check, so its length, range and `url` rules apply at install. A value whose type is known only at render (`dynamic`) is checked then. `$has` guards narrow an optional path inside a `$if`, a conditional and the later operands of `$and`.
- Kinds, variants, props, events and style props are checked as for element JSON. A child kind is checked against its parent's rules where both are known, and a `$use` is placed by its component's root. Unknown kinds are `unknown-component`, undeclared events `undeclared-event`, undeclared actions `undeclared-action`, a repeated `$anchor` `duplicate-key`, an `$each` without `key` `missing-key`, and a `$ref` that names no anchor in the template `unknown-name`.
- A node may carry `when` and `bind`, which are **tree expressions** (§8), not template expressions: they are copied into the tree as written and checked at install against the manifest's `local` schema and the kind's props. `{ "$embed": Expr }` inside them is the one connection to template scope; expansion replaces it with the evaluated value as a `$lit`, so `{ "$contains": [{ "$embed": { "$path": "row.title" } }, { "$path": "local.q" }] }` filters on a row's title. `$embed` is valid only there, never reaches a tree, and its operand must be present. A `$use` node and a fragment take neither field; a `setLocal` intent is written like `setState`.
- The widget root renders exactly one element: it takes no `$if` or `$each`, and is not a fragment. A component root takes no `$each` and may be a fragment; use `$if` for an optional component.
- A cyclic component graph is `invalid-document`; deeper than 16 or past any bound above is `limit-exceeded`.

```jsonc
{ "format": "liveframe-template/1",
  "root": { "kind": "stack", "children": [
    { "$each": { "in": { "$path": "data.queue.rows" }, "as": "row", "key": { "$path": "row.id" } },
      "kind": "button", "props": { "label": { "$path": "row.title" } },
      "events": { "onPress": { "type": "action", "name": "tasks.claim", "args": { "id": { "$path": "row.id" } } } } } ] } }
```

```ts
import { renderTemplate, validateTemplate } from "@arnilo/liveframe/template";
validateTemplate(doc, { catalog, capabilities, manifest }); // Result<Template>, once, at install
renderTemplate(template, { params, state, data, context }, { validator, surfaceId, revision }); // Result<UiTree>
```

- **Rendering.** `renderTemplate` takes the same options as `render()`, and its `limits` also accept `steps` (default 1,000,000), the evaluation fuel: one step per expression node, plus one per 64 units of input for operators that walk a long string or array. Exhausting it is `limit-exceeded`. The inputs are checked against the manifest and left unmodified, exactly as `render()` does, then the template expands to elements that go through the same single build-and-validate pass: ids are key paths, a `$use` leaves no node, and an `$each` body's key is its `$each.key`. A prop that evaluates to nothing (`$omit`, or an absent optional path) is left out, and a required one is reported by the build.
- **Errors.** An evaluation error (division by zero, a value of the wrong kind that was known only at render) is `invalid-prop` at the operator's pointer in the template, with the `nodeId` of the nearest enclosing element, and is collected up to `maxErrors`; the siblings still render so one run reports several. Errors from the build (a prop that fails its schema, a wrong child kind, a duplicate key) point at the template node, as `renderElements` points into its input.
- **Compiling.** A frozen template compiles to closures once per validator and is cached; an unfrozen one compiles on each call. Compiling re-runs the install analysis against the validator's own input schemas, so a template that does not fit that validator's manifest fails with the install errors.
- **Packages.** A template is packaged like a TSX widget: `pack({ template, manifest, scenarios }, install)` validates it (§7.3) and returns a `liveframe-package/1` package whose `template` field replaces `code`. Stores, placements, `loadPlacement`, `renderKey` and the hash treat it unchanged, and every runner renders it (§7.5). The step limit is `RunnerOptions.limits.steps`.
- **Parity.** A template and a TSX widget that mean the same thing produce equal trees, proved for the proof widgets over every proof scenario. One thing a template cannot do is sanitise text with a regular expression or throw: a source supplies clean labels, or the widget is TSX.

**Rationale**

TSX widgets are a full language and need a sandbox. Element JSON needs none but is static, unbound and ephemeral. A template fills the gap: data-bound, installable and type-checked, but only data, so an app can install what an agent or a user writes without an isolation runner.

### 7.7 The host pipeline

**Rules**

1. The library fixes the **order** of the security-critical steps of a request-time render and holds no authority and no state: `renderPlacement` is a function of its arguments plus the effects the host injects (`store`, `runner`, `resolve`), and keeps no object, map, cache or timer between calls. State (the last accepted tree, its revision, the validator) is a value the host stores and hands back (`Served`).
2. Sources are read only through the injected `resolve`, once per render, as the viewer. The library hands `viewer` to the host's callbacks without reading it.
3. A runner's tree is untrusted. It becomes `Served` only after the host's own `validateTree`, and only if its `surfaceId` and `revision` are the ones the host asked for (law 2).
4. A reported or thrown source failure never reaches a widget as the host's text. A source that declares the `sourceOutcome` envelope shows its widget `{ status, reason? }`; any other source makes the render fail at `/data/<alias>`. A value that misses the source's `result` schema always fails the render.
5. `handleIntent` runs `checkOffered` first and `authorize` second; only then does it write state or `dispatch`. The library fixes this order and holds no authority: `authorize` and `dispatch` are the host's (law 4).
6. The pipeline is optional. Every helper it composes (`loadPlacement`, `bindSources`, `renderKey`, `diffTrees`, `checkOffered`) stays public.

**Contract and examples**

```ts
import { dependents, handleIntent, renderPlacement } from "@arnilo/liveframe/host";
const host = { store, runner, installs, resolve, verified, onEvent }; // built once by the host
const served = await renderPlacement({ ...host, placementId, catalogId, scope, viewer, context, actions, previous });
// served.value.tree for a new client; served.value.patch (base = previous.revision) for one that holds `previous`
const next = await handleIntent({ ...host, served: served.value, origin, intent, viewer, context, actions, authorize, dispatch, publish });
// next.value = { served, actions }: store both, send `served`
```

- **Steps (`renderPlacement`).** R1 pick `installs[catalogId]` (`catalog-mismatch` at `/catalogId`); R2 `loadPlacement` (the manifest's own `catalogId` is checked against the caller's, never used to select it); R3 `bindSources`; R4 one `resolve(calls, viewer)`, a rejection counting as `failed` for every call with a fixed message; R5 fit each result to its source's `result` schema; R6 compute `renderKey`, and when `previous` has the same key, surface, placement and scope return `previous` unchanged; R7 the revision is `revision ?? previous.revision + 1 ?? 1` (a host that can lose `previous` while a client stays connected passes a monotonic floor); R8 `runner.render`; R9 host `validateTree`, then the surface and revision check; R10 `diffTrees(previous.tree, tree)` when `previous` is comparable, a failure meaning "send the whole tree"; R11 return `Served`.
- **`Served`.** `{ placementId, scope, tree, key, revision, validator, package, state, bound, patch?, reset?, migrated? }`. `validator` is process-local and compiled for exactly the package and install it was built from, so a `Served` is rebuilt, not persisted, across a restart. The validator is reused from `previous` only when the same install object and package hash are in play.
- **Steps (`handleIntent`), the offered check.** H1 `installs[served.tree.catalogId]`; H2 `checkOffered(served.tree, origin, intent, served.validator)`. A stale or future revision is `version-conflict`, refused and never rewritten to the latest. An offered *action* that fails the check is recorded `refused` (reason `"Not accepted"`) under the key the **tree** offered, never the posted intent's, and re-rendered. Anything else not offered returns the errors. `setLocal` never reaches the host: `checkOffered` rejects it (`invalid-prop` at `/type`).
- **Steps (`handleIntent`), `setState`.** H3 load the stored state, check `{ ...stored, [key]: value }` against the manifest's state schema (`invalid-prop` at `/value`), `putState`, then render that state.
- **Steps (`handleIntent`), `action`.** H4 `authorize(intent, viewer)`: only `true` passes, and a throw or rejection is `refused` (reason `"Not allowed"`). H5 `pending`, rendered and published only when `publish` is supplied. H6 `await dispatch(intent, viewer)` returning `{ ok: true, value? } | { ok: false, reason? }`: a throw becomes `failed` with the fixed reason `"The action failed"`, and `value` is kept only when the action declares a `result` schema it fits (else `failed`, `"Invalid result"`). H7 record under `resultKey ?? name`, keeping at most 64 entries by evicting the oldest settled ones; with all 64 pending the call is `limit-exceeded` at `/actions` before `authorize`. H8 re-render against the latest frame. H9 return `{ served, actions }`. A failed re-render returns its errors, though the effect has happened.
- **Events.** `onEvent` receives frozen `HostEvent`s: `render-skipped`, `state-reset`, `state-migrated`, `source-failed`, `tree-rejected`, `load-failed` and `render-failed`, and from `handleIntent` `intent-refused` (reason `stale`, `not-offered`, `unauthorized`, `invalid-state` or `limit`), `action-failed` and `publish-failed`, carrying ids, kinds, reasons and `LiveframeError`s, never state, params, source data or viewer. A handler's throw or rejection is contained, and nothing is built without one. The set may grow in a minor release.
- **`dependents`.** `dependents(placements, { source, params? })` takes `{ placementId, bound }` entries (`Served.bound`) and returns the ids, in input order and once each, of the placements with a bound call to `source` (and, when `params` is given, with params equal by canonical JSON). It is a pure, linear scan: the host calls it when a source changes (after an action settles, on its own bus) and re-renders the ids it returns. Widgets coordinate only through capabilities the host resolves and dispatches; there is no widget-to-widget channel and no subscription registry.
- **What stays the host's.** Transport, sessions and viewer identity; serialising calls per placement and scope, because a stateless function cannot tell two callers holding the same stale `Served` apart; de-duplicating reads across placements; caching beyond `renderKey`; approval and tenancy.

**Rationale**

Every adopter of the old helpers re-implemented the same sequence, and swapping two of its steps breaks a law without failing a test. Fixing the order in one function removes that, while keeping the state with the host is what keeps the library free of lifetimes, eviction and memory growth.

## 8. Interaction (Synapta's three tiers)

**Rules**

1. **One intent per event.**
2. **The app re-checks every intent.**
3. **State is owned by the app.**

**Contract and examples**

| Tier | Example | Where it runs | Round trip | Author writes |
|---|---|---|---|---|
| **1. Local** | Open a menu, hover, type in a field, switch a tab that needs no new data, expand a row | Inside the primitive's React implementation | None | Nothing |
| **2. Declared state** | Change a filter, load the next page, select a row that changes what is shown | The app re-runs the widget with new `state`; the renderer reconciles the new tree by id | One, to where widgets run | `state.set(key, value?)` |
| **3. Action** | Claim a task, run a command, save a record | The app's dispatcher: authorises as the viewer, confirms per its policy, executes | One, to the app | `action(name, args)` |

**Action results (tier 3 feedback).** The host reports the status of recent actions to the widget as the input `actions: Record<string, ActionStatus>`, so "Saving…" and "Failed: name taken" are drawn by the widget instead of improvised by each host:

```ts
type ActionStatus = {
  status: "pending" | "ok" | "failed" | "refused"; // refused: the offered-intent check or authorisation rejected the intent
  action?: string;  // the manifest action; required when the key is not an action name
  reason?: string;  // display text, at most 500 characters
  value?: Json;     // only with "ok"; matches the action's capability `result`
  at?: string;      // opaque host text, at most 64 characters
};
```

`handleIntent` (§7.7) writes these entries in the order below. The key is the action name, or the `resultKey` an intent carries (`action("tasks.claim", { id }, { resultKey: "claim:" + id })`, a literal in the tree) when one action runs for many rows. At most 64 entries, keys of at most 128 characters. The host writes `pending`, dispatches as the viewer, writes the outcome, and re-renders each time; it decides when an entry expires by omitting it. The library has no timers or history. `actions` is validated before the widget runs (`invalid-prop` at `/actions/<key>`), so a host bug cannot hand widget code an arbitrary shape. A result grants nothing and is not an intent: it only changes what the widget draws.

**Local state and bindings (between tiers 1 and 2).** Interactions that span nodes but need no data (a live filter over rows already in the tree, a disclosure that opens a sibling) cost no round trip, and no widget code runs in the browser. The manifest declares `local` and `initialLocal` (§7.1); the tree carries data the renderer evaluates:

```ts
type LocalIntent = { type: "setLocal"; key: string; value?: Json };  // value absent ⇒ the event's value
// on UiNode:  when?: Expr;  bind?: Record<string, Expr>;
```

- **`setLocal`** is offered in `events` like `setState` and follows its fill rules (`key` names a `local` property, `unknown-name` otherwise; a scalar event fills a scalar property; a literal `value` must satisfy the property). The renderer applies it and it never reaches `onIntent`, never asks for confirmation, and is never sent anywhere. `checkOffered` rejects it (`invalid-prop` at `/type`): no host dispatches it (law 4). Local state belongs to one mounted surface, starts at `initialLocal`, and resets when the surface or the validator changes. A widget that wants the host to know a value commits it with a `setState` event.
- **`when`** renders the node only when the expression is true; a hidden node is not mounted and its parent omits it. **`bind`** names props whose value the expression supplies at render; `props` stays the static, complete fallback, so a consumer that does not evaluate bindings sees a valid tree. Nothing else is bindable: not `variant`, a style prop, an event, or a `refProps` prop.
- **Expressions** are the template language's (§7.6) restricted to an operator allow-list (`$path`, `$lit`, `$omit`, `$has`, comparison, `$and`, `$or`, `$not`, `$cond`, `$coalesce`, `$len`, `$concat`, `$text`, `$contains`, `$slice`, arithmetic, `$round`, `$get`, `$at`: no iteration, binding or collection builders) with two roots, `local` and `self` (the node's own `props`). An expression can therefore read only what the widget put in the tree and the surface's local state. Per expression at most 16 levels and 64 nodes, per node at most 16 `bind` entries, per tree at most 10,000 expression nodes.
- **Checked on arrival and in `render()`:** every expression is well formed and inside those bounds; `local.<key>` and `self.<prop>` exist; `when` is a boolean; each `bind` target is a bindable prop the inferred type fits (the template type-fit rule, §7.6). A node referenced by a `refProps` prop may not carry a `when` or sit under one, and a parent's child-count bounds hold with every `when` child present (maximum) and absent (minimum). The renderer re-validates each bound value against the prop schema before an implementation sees it; a failure draws the node's fallback and is reported, never a stale value.
- **TSX:** `local("q")`, `self("title")`, `local.set("q")`, the `when` and `bind` attributes and `ex` (one builder per allowed operator): `<Row when={ex.contains(r.title, local("q"))} />`.
- **Templates (§7.6)** copy `when` and `bind` verbatim and check them against the manifest at install; `{ "$embed": Expr }` inside them is replaced by the template value as a literal during expansion, so a row's title can sit in a browser-time test.

- If a primitive needs two behaviours, it gets two events.
- **Several values can commit together.** `action("escalate", { id }, { bindAll: true })` merges an object event into the literal args and removes `bindAll`.

  `bind` and `bindAll` are mutually exclusive; `bind` requires a scalar event, `bindAll` an object event.

  Literal/event key overlap is `invalid-prop` at the literal arg.

  The event schema must structurally fit the action's argument schema minus literal args: every event property exists in the target, every remaining required target property is required by the event, and scalar types match (except `integer` fits `number`).

  Nullable event properties require nullable targets.

  Bounds and enums are checked on the filled value by Preview and the host, not compared at build time.

  Implicit object `setState` replaces the entire object key under the same fit rule.
- **Inputs are local until they commit.** A `textField` keeps its value locally (tier 1). Its `onCommit` (Enter, blur, or a debounce the definition declares) carries the value as `setState`. To act on a typed value directly, an action intent names the argument the event's value fills: `action("tasks.escalate", { id }, { bind: "reason" })`. The validator checks that the event's `carries` type matches that argument's schema, and the app re-checks the filled arguments on dispatch. Numeric `bind` and implicit `setState` values use the same compatibility rule: `number` fills only `number`, while `integer` fills `integer` or `number`. The host checks `minimum` and `maximum` on the filled value.
- **Origin and offered intent check.** The root export provides `IntentOrigin = { surfaceId, revision, nodeId, event }` and `checkOffered(tree, origin, intent, validator): Result<void>`.

  Use the host's served tree and compiled validator.

  Wrong surface/revision is `version-conflict` at `/origin/surfaceId` or `/origin/revision`; an unknown node is `not-found` at `/origin/nodeId`; an absent event is `undeclared-event` at `/origin/event`.

  Completion must reproduce the candidate exactly, preserving type, state key, action name and literal arguments; only the `bind` argument, declared `bindAll` keys or implicit state value can be filled.

  Mismatches and schema failures are `invalid-prop` at the offending field.

  Filled values satisfy both the event schema and manifest/capability schemas.

  The helper shares completion with the renderer.

  It validates and builds an id map once per immutable tree/validator pair; subsequent checks use the map without walking the tree.

  Replace tree objects instead of mutating them.

  Unknown validators fail closed.

  The explicit fourth argument is approved in `decision-logs/2026-10-28-1935-check-offered-explicit-validator.md`.
- **Confirmation is UI, authorisation is the host's.** `confirm` gates the renderer's optional confirmation hook; `irreversible` is presentation and never gates emission. Neither grants authority: the host still applies its own confirmation policy and authorisation on dispatch (§11).
- The intent must be declared by the widget's manifest, and its args must match the action's schema in the app's capabilities. The validator checks this on every render; the app checks it again on dispatch. Intents carry no authority.
- Widget state is persisted per placement and host scope, in the app's store (§7.4), or supplied explicitly by the host. The widget only ever receives it as input.
- **Re-runs are cacheable.** A host may skip a re-run, and the transfer, when the hash of the package (§7.3), `catalogId`, params, state, data, context and actions is unchanged; `/pack` publishes that key as `renderKey`, the SHA-256 of those inputs in canonical JSON, so inputs that differ only in key order share it. The key covers `actions` too (an absent `actions` hashes as `{}`). A widget that formats with `Intl` is cacheable only within one runtime build (§7.1).

**Rationale**

A widget is pure, so the same widget version and the same inputs always produce the same tree.

## 9. The UI tree (wire format)

**Rules**

1. Each render produces a **whole tree**.
2. A `revision` lower than the current one is ignored.

**Contract and examples**

An agent may emit element JSON (§7.2), but that document is converted on the backend; the wire format below is what a host serves and a renderer validates on arrival.

```ts
type UiTree = {
  format: "liveframe/1";
  catalogId: string;            // "acme.ui@1"
  surfaceId: string;
  revision: number;             // increases per render of this surface
  root: UiNode;
};
type UiNode = {
  id: string;                   // key path, stable across renders
  kind: string;                 // a catalog primitive
  variant?: string;
  props: Record<string, Json>;
  style?: Record<string, Json>; // declared style props only
  events?: Record<string, Intent | LocalIntent>;
  when?: Expr;                  // browser-evaluated; render only when true (§8)
  bind?: Record<string, Expr>;  // browser-evaluated prop overrides (§8)
  children?: UiNode[];
};
type Expr = Json;               // a tree expression (§8); data the renderer evaluates
type LocalIntent = { type: "setLocal"; key: string; value?: Json };  // applied by the renderer (§8)
type Intent =
  | { type: "setState"; key: string; value?: Json }   // value absent ⇒ the event's value
  | { type: "action"; name: string; args: Record<string, Json>; bind?: string; bindAll?: true; resultKey?: string }; // bind and bindAll are exclusive; resultKey names the key the host reports the status under (§8)
```

- `when`, `bind` and `setLocal` are optional fields of `liveframe/1`. A renderer that predates them fails closed (it rejects unknown node and intent fields), never ignores them. `Intent` is exactly what a host can dispatch (`setState` and `action`); `LocalIntent` is the renderer's own.
- Whole-tree transport remains valid. Hosts may instead transport `liveframe/tree-patch/1` against a previously validated tree. The renderer still receives a whole tree and reconciles by `id`, so unchanged nodes keep their DOM and local state.

- Optional patches follow the approved design in `decision-logs/2026-10-30-1928-tree-patch-format.md`.
- Interop with A2UI or other formats is possible through a converter. It is not part of v1.

**Rationale**

The format is deliberately minimal. Nothing in the model needs more.

### 9.1 Optional tree patches

**Rules**

1. Application is atomic: failures expose no partial result.
2. Application is structural only.
3. The host validates the complete result before accepting its revision, serving it or using it for dispatch checks; the renderer independently validates arrivals.

**Contract and examples**

```ts
type TreePatch = {
  readonly format: "liveframe/tree-patch/1";
  readonly catalogId: string;
  readonly surfaceId: string;
  readonly base: number;
  readonly revision: number;
  readonly ops: readonly PatchOp[];
};
type PatchOp =
  | { readonly op: "set"; readonly id: string; readonly kind: string;
      readonly variant?: string; readonly props: Readonly<Record<string, Json>>;
      readonly style?: Readonly<Record<string, Json>>;
      readonly events?: Readonly<Record<string, Intent | LocalIntent>>;
      readonly when?: Json; readonly bind?: Readonly<Record<string, Json>> }
  | { readonly op: "insert"; readonly parent: string; readonly index: number; readonly node: UiNode }
  | { readonly op: "remove"; readonly id: string }
  | { readonly op: "move"; readonly id: string; readonly index: number };
```

`validateTreePatch(patch: unknown): Result<TreePatch>` checks closed document and operation shapes, JSON values and `revision > base`. Revisions and indexes are nonnegative safe integers; revision gaps are allowed. Node fields, ids and intents follow the UI-tree constraints. The published schema checks standalone shape; sibling-number comparison is an additional validator check.

`applyPatch(base: UiTree, patch: unknown): Result<UiTree>` takes a previously validated base. It checks patch shape first, then identity, then applies operations in order against the preceding result. Wrong surface or base revision is `stale-patch` at `/surfaceId` or `/base`; catalog mismatch is `invalid-document` at `/catalogId`. Hosts must assign unique content to each catalog/surface/revision identity; there is no base hash.

- `set` replaces the complete kind/variant/props/style/events/when/bind payload; omitted optional fields are deleted. It preserves id and children exactly and may target the root.
- `insert` inserts a complete subtree before the current child at `index`; zero through child count is allowed, including append. Absent children count as zero. Subtree ids must follow the destination key path; application never rewrites them.
- `remove` deletes a non-root subtree and its descendants. Removing the last child omits the parent's children field.
- `move` reorders a non-root child within its current parent. Its final index is measured after detachment, from zero through the remaining child count. Moving to the same position is valid. Parent changes require remove plus insert with new ids.

Missing targets or parents are `not-found` at the op's `/id` or `/parent`. Malformed patches, non-increasing revisions, out-of-range indexes and root removal/move are `invalid-document`. An addressed ambiguous duplicate target is `duplicate-key`; other duplicate ids and catalog-specific checks are rejected by subsequent whole-tree validation. Errors point into the patch, except failures from whole-tree validation, which point into its result.

Success returns a new tree envelope retaining format/catalog/surface with the new revision; empty ops retain the root. Changed nodes and ancestors are copied, and untouched subtrees retain reference identity. Application neither mutates nor freezes caller objects. Hosts must keep served trees and nested values immutable while in use.

`diffTrees(prev: UiTree, next: UiTree): Result<TreePatch>` takes previously validated, immutable trees with matching catalog/surface and increasing revisions. Mismatches, non-increasing revisions, or explicit empty children anywhere in either input return `invalid-document` for unchanged whole-tree fallback. Other valid whole-tree representations remain accepted by whole-tree validation. Every successful diff round-trips exactly through `applyPatch`.

Diffing compares JSON objects independent of property insertion order and arrays in order. Walk retained parents in next-tree preorder: set changed own fields, remove absent children in reverse sibling order, then scan next children left to right, inserting absent subtrees or moving retained children to their next index and recursing. Emit no descendant ops beneath inserted or removed subtrees. Parent changes carry new key-path ids. Avoid redundant sets/moves; no minimal-edit or linear sibling-reorder guarantee is made. Identical logical inputs produce byte-identical canonical JSON.

  On any failure retain the last accepted tree and request a whole tree. `checkOffered` still checks the accepted revision; superseded origins fail as `version-conflict`. There is no renderer patch prop or incremental validation.

**Rationale**

Patches contain no widget code or authority.

## 10. Validation

**Rules**

1. The validator runs on every rendered tree before it leaves the app's backend.
2. It never uses `eval` or the `Function` constructor, which content security policies and some sandboxes forbid.
3. Document validators reject foreign-realm plain objects with `invalid-document` at the offending JSON Pointer and the message "Expected a JSON value created in this realm; this object was created in another realm (parse it inside the sandbox)". Parse transported JSON in the receiving realm before validating it. Same-realm plain objects and null-prototype objects remain accepted.

**Contract and examples**

It checks:

- every `kind` exists in the catalog
- props match their schemas, and strings and arrays are bounded
- children match the definition, and style props are declared and in range; a dimension that names a design value (`space.*`, `radius.*`, `size.*`, a breakpoint) fails when the app did not declare that name
- variants exist
- `when` and `bind` expressions and `setLocal` intents are well formed, bounded and fit the manifest's `local` schema and the kind's props (§8)
- event names are declared, `setState` keys exist in the state schema and their values match it, action names are in the manifest, action args match the action's schema in the app's capabilities, a scalar `bind` names a compatible argument, and object `bindAll` and implicit object `setState` satisfy the structural fit rule (§8)
- ids are unique and key-derived
- limits hold: node count (default 5,000), depth (default 64), and tree size in bytes (default 1 MiB), all configurable. Tree size is the UTF-8 length of the tree's `JSON.stringify` output, counted during the walk without serialising. String bounds count code points. The runner adds a time limit (§7.5)

**Errors.** Every validator returns `Result<T>`: `{ ok: true, value } | { ok: false, errors }`.

A failed validation returns every error it found, up to a bound (default 20), so an author or agent fixes them in one round.

Install-time APIs that have no value to return on failure throw `LiveframeFailure`, a subclass of `Error` whose `errors` is that same bounded `LiveframeError[]` and whose `message` is one `pointer: message` line per error.

`compileValidator` and `renderModule` identify a foreign catalog, capabilities document or manifest at `/catalog`, `/capabilities` or `/manifest`. Standalone install validators use pointers relative to their document. `validateTree`, `validateTreePatch`, `applyPatch`, `diffTrees` and `verifyPackage` use the same realm diagnostic; patch bases and diff inputs must already be validated, immutable trees.

`pack()`, `verifyPackage()`, `loadPlacement()` and `Runner.render()` use the same result and error bound; async operations wrap the result in a promise.

Each `LiveframeError` is `{ kind, pointer, message, expected?, nodeId? }`: `pointer` is a JSON Pointer into the document (the empty string at its root), `expected` is the rule that failed, in words an agent can act on, and `nodeId`, when present, is the key path of the UI node.

The complete kind list is:

| Kind | Meaning |
|---|---|
| `invalid-document` | Malformed structure or value, including a manifest, scenario or stored record; missing scenarios point at `/scenarios`. |
| `insufficient-contrast` | A theme contrast pair violates its minimum, maximum or strict ordering; the message names roles, pair indices and measured ratios to two decimals. |
| `unknown-name` | An undeclared name. |
| `incomplete-design-system` | A missing required recipe. |
| `colour-outside-theme` | A colour outside the theme's authority. |
| `catalog-mismatch` | A different catalog identity. |
| `cyclic-extends` | A derivation cycle. |
| `forbidden-import` | An import or re-export outside relative widget modules and the SDK, or any `require(…)`, `import.meta` or dynamic `import()` in widget code. |
| `transpile-failed` | A syntax error, with file and line in `pointer` (§7.3). |
| `hash-mismatch` | Package content differs from its declared hash. |
| `version-conflict` | A second hash under an existing package `(id, version)`. |
| `stale-patch` | A tree patch names a different surface or base revision. |
| `not-found` | A missing placement, package, patch target/parent, anchor or same-tree reference target. |
| `host-element` | A host element such as a raw HTML tag. |
| `unknown-component` | A component outside the catalog. |
| `invalid-prop` | A prop or placement param that fails its schema. |
| `invalid-children` | Children that violate the definition's rules. |
| `missing-key` | A repeated sibling without a key. |
| `duplicate-key` | Duplicate sibling keys or tree-unique anchors. |
| `undeclared-event` | An event outside the definition. |
| `undeclared-action` | An action outside the manifest. |
| `function-prop` | A function used as a prop. |
| `async-render` | A component returned a promise. |
| `render-failed` | A component threw or a runner failed to load or execute a widget. |
| `limit-exceeded` | A node, depth, byte, error-collection or runner time limit was reached. |

`kind` is open: a minor release may add kinds, so a consumer must handle an unknown kind by name — report it, never fail to compile or silently drop it. Removing a kind, or changing what one means, is a major change.

The validator is **compiled per catalog**: when the catalog, vocabulary, capabilities and manifest are loaded, each definition and schema becomes a closure over precomputed sets and checks, instead of schemas interpreted on every render. Its per-node checks are what `render()` calls while it builds the tree, with a deferred step for reference-bearing nodes; the same validator re-checks a whole tree on arrival. During its existing node walk, it records supplied string `refProps` and then checks them against the complete id set without traversing nodes again. A missing target is `not-found` at the referencing prop with the referring `nodeId`. Omitted optional references remain absent. The single-pass budget is recorded in `docs/model.md`, "Performance", and `decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md`.

It validates every other format on install: a catalog's definitions and schema language, the vocabulary, the capabilities, a manifest against its catalog and capabilities, a theme against the vocabulary (every role present and every declared contrast minimum, maximum and strict ordering satisfied, §6.5), and a design system against the catalog and vocabulary (values typed, every declared name defined, recipes complete after the cascade, and no colour outside the theme). The library publishes a JSON Schema for every format (§13).

The root export `capabilitiesFor(capabilities, manifest): Result<Capabilities>` selects exactly the manifest's actions and referenced sources from installed documents in linear time, preserving input map order and complete entries without mutation; unknown names return bounded `unknown-name` errors at manifest pointers, and compiling with the successful subset preserves validation behaviour while allowing hosts to prune before browser transfer.

**Rationale**

The renderer re-checks every tree on arrival with the app's compiled validator (§11), so it never trusts its transport.

## 11. Renderer

**Rules**

1. **The renderer never trusts its transport.**
2. Surfaces never nest.
3. Nodes render keyed by `id`, so focus, scroll and local state survive re-renders.
4. **The surface core is framework-independent.** Everything a renderer does before it draws lives in `@arnilo/liveframe/surface`; `@arnilo/liveframe/react` only maps the core's node contexts to elements.

**Contract and examples**

**The surface core**

`@arnilo/liveframe/surface` is host-API-free: it imports no framework and touches no DOM. A renderer for another framework is written on it; the library ships none besides React's (§14).

```ts
const core = createSurfaceCore({ catalog, validator, onIntent, confirm, domIdPrefix, onEvent });
const accepted = core.accept(tree);            // Result<SurfaceSnapshot>
core.subscribe(() => draw(core.snapshot()));   // after a local-state change
const detach = core.attach();                  // mounted: a confirmed intent may still dispatch
```

- **`core.accept(input)`** re-checks every arriving tree with the `validator`, compiled from the catalog, the capabilities and the widget's manifest (§10), before reading any tree field, including `surfaceId` or `revision`. It returns the accepted `SurfaceSnapshot` or the validation errors; a renderer draws its app's `fallback` for the whole surface when `snapshot().valid` is false, never part of an invalid tree and never nothing. After validation, a tree for the same `surfaceId` whose `revision` is lower than the current one is ignored; a different `surfaceId` replaces the current tree and resets local state. Accepting the same input twice does nothing, and `accept` never notifies subscribers, so a framework may call it while rendering.
- **`SurfaceSnapshot`** is `{ valid, errors, tree, root, local }`: a new frozen object whenever anything a renderer reads changes. `tree` stays the last accepted tree across an invalid arrival, so a later revision compares against it. `root` is the root's node context, or undefined before any tree or when the root's `when` is false.
- **`NodeContext`** is one drawable node, built once per tree node and cached by node object identity. It holds `id`, `kind`, `variant`, effective `props`, `domId`, `events`, `slot(name)`, `style`, `emit(event, value?)`, `items` (the child contexts that render) and `fault`, plus the tree `node` it came from. A renderer draws the contexts and adds only what its framework needs.
- **Node reuse.** After a whole tree passes validation, the core substitutes the accepted tree's node objects for every subtree that is deep-equal to it (object key order ignored, array order kept; `when` and `bind` included) when the `surfaceId` is unchanged, so a renderer skips those subtrees by identity and their local state, focus and scroll survive. Substitution only replaces a value with an equal one, so the drawn tree is exactly the validated arrival. Children match their previous values by `id` within the same parent. A node reported through `core.fail(node)` is never reused, nor are its ancestors, so a later arrival retries it.
- **Local state and bindings** (§8). The core holds the surface's `local` object, starting at the manifest's `initialLocal`. A `setLocal` event is applied by `emit` and never reaches `onIntent` or `confirm`: the value is checked against the local schema, written, and only the nodes whose `when` or `bind` read a changed key are evaluated again. Ancestors of a changed node get a new context and unaffected nodes keep theirs. A node whose `when` is false is absent from its parent's `items`. A bound value replaces its prop only after the validator's node check accepts the effective props; an evaluation error or a failed check gives that node a `fault` and leaves the surface valid, and a renderer draws the node fallback. A value outside the local schema throws like a `carries` mismatch.
- **Observability.** The optional `onEvent(event)` receives a frozen `SurfaceEvent` where the core makes each decision: `arrival-rejected` (`surfaceId?`, `errors`), `stale-revision` (`surfaceId`, `revision`, `current`), `emit-rejected` (`nodeId`, `event`, `reason`: `invalid-value` or `invalid-local`), `implementation-failed` (`nodeId`, `kind`, raised by `core.fail`), `binding-failed` (`nodeId`, `prop?`, `errors`, once per change) and `confirm-dropped` (`nodeId`: a single-flight drop, or approval after unmount). Events carry ids, kinds, event names, revisions and `LiveframeError`s, never prop, state or local values. The set of `type`s is open: a handler ignores one it does not know. `onEvent` is read when used; a throw or a rejected promise is contained; with no `onEvent` the core allocates no event. The library never logs on the render path.
- `emit(event, value?)` checks the event value against the definition's `carries` (`none`: no value; `string`; `boolean`; `number`: a finite number; `integer`: a finite integer; `{ object: ObjectSchema }`: the declared schema, compiled once per definition event in the renderer factory).

  A mismatch is an implementation bug: it throws and raises no intent.

  When the host's `onIntent` returns a promise, `emit` returns a `Promise<void>` that settles when the host's promise does (or, through `confirm`, after approval and the host call), so an implementation can set `aria-busy` until the host finishes; otherwise it returns `undefined`.

  The promise carries neither the host's value nor its rejection: a rejection is contained and never reaches the window as an unhandled rejection.

  `onIntent(intent, origin)` receives a frozen origin identifying the accepted tree's `surfaceId` and `revision`, the emitting `nodeId` and event name, including collection and portal nodes.

  Existing one-argument callbacks keep working.

  It receives fresh, deeply frozen complete intents: a `setState` without `value` gets the event's value; an action with `bind` gets `args[bind]` set to that value and `bind` removed; `bindAll: true` merges the emitted object into `args` and is removed.

  Explicit `setState` values are preserved, and the emitted object is copied before freezing.

  The app re-checks the filled intent (§8), re-runs the widget or dispatches the action, then passes the new tree back in.

- Optional `<Surface confirm={(intent, meta) => Promise<boolean>}>` awaits approval before `onIntent` for actions whose resolved `confirm` is true. It receives the completed frozen intent and readonly `{ confirm, irreversible }`. False, rejection or a throw emits nothing. Confirmation is single-flight per mounted surface: further confirmation-requiring emits are dropped while pending; other emits continue. Approval after unmount is dropped; otherwise the original origin is retained even if the tree changed. Without the hook, emission is unchanged. `irreversible` alone never gates emission. This is UI convenience: the host still re-checks the offered intent, schema, confirmation policy and authorisation on dispatch (§8).


**The React adapter**

`@arnilo/liveframe/react`:

```tsx
const { Surface } = createRenderer({ catalog, implementations }); // the registry check
const validator = compileValidator({ catalog, capabilities, manifest });
<Surface tree={tree} validator={validator} theme={theme} designSystem={designSystem} onIntent={onIntent} fallback={<Unavailable />} />;
```

- **`createRenderer({ catalog, implementations })`** runs the registry check once, at startup: it fails if a catalog kind has no implementation, two implementations bind one kind, or an implementation's definition differs from the catalog's. It returns `{ Surface }`; a failed check throws `RendererError`, a `LiveframeFailure` whose `errors` name each discrepancy (`catalog-mismatch`), so a host catches it with the same handler as every other install failure.
- **Several catalog majors.** To draw surfaces of several catalog majors on one page, pass `createRenderer({ catalogs: [{ catalog, implementations }, …] })`: the registry check runs per catalog (pointers prefixed `/catalogs/<n>`), an implementation may be listed under several catalogs only if its definition equals each catalog's, and two entries with one `catalogId` are `catalog-mismatch`. With several catalogs a `<Surface>` uses the catalog its `validator` was compiled with; a validator compiled for none of them draws the fallback and reports `arrival-rejected` with `catalog-mismatch` at `/validator`. With one catalog it serves every validator, as before. In every case a tree whose `catalogId` differs from the surface's catalog is refused with `catalog-mismatch` at `/catalogId` (and an `arrival-rejected` event).
- **`<Surface>`** draws one surface. `theme` and `designSystem` are `{ id, version }` identities for §6.4's scope attributes. `transparency` is `"auto"` (default) or `"reduced"`: it adds §6.4's `data-lf-transparency` attribute to the wrapper and portal container together and, when it changes, runs the same switching sequence as a theme change.
- **`implement(definition, Component)`** binds a primitive's React implementation. The implementation receives:
  - `props`: validated values
  - `slot(name)`: the single stable recipe class for that slot in its current variant (§6.4). The root slot also carries the node's style-prop classes; surface and container classes belong to the surface wrapper. Implementations expose state through the normative selector table there
  - `style`: the root's inline declarations from the node's style props (`styleDeclarations`, §6.4)
  - `emit(event, value?)`: raises the declared intent
  - `events`: a readonly map keyed by the definition's events, populated only for events offered by this node.

    Each entry is `{ type: "action" | "setLocal" | "setState", confirm: boolean, irreversible: boolean }`, resolved from the validator's compiled capabilities; `setLocal` and `setState` report both flags false.

    No action names, argument values or host `meta` reach implementations.

    The adapter caches each node context's element by the core context's identity.

    Untouched subtrees retain their contexts and elements across patches and across whole-tree arrivals whose values they already hold.

    Reused handlers read the currently accepted tree and current callbacks when emitting.
  - `domId`: a DOM id for this node's element, stable across re-renders and unique per `<Surface>` instance (the surface's `useId` prefix, percent-encoded, then `:` and the key-path id). It holds no whitespace, so it is valid in an `aria-*` id list. The renderer adds no wrapper: an implementation places `domId` on the element it renders, and a node that renders none is simply unreferenceable.
  - `props` carry each `refProps` value (§5) rewritten from the target's key-path id to the target's `domId`. An absent optional reference stays absent; a catalog without `refProps` keeps `props` unchanged.
  - `children`: already rendered
  - `items`: a node context for each child, with `id`, `domId`, `kind`, `variant`, `props`, `slot(name)`, `style`, `events`, `children` (already rendered), `render()` (the child drawn through its own implementation) and `emit(event, value?)`. Slots, styles, metadata and intents belong to that child, so collection primitives can draw its parts themselves
  - `portal`: the surface's scoped overlay container, or undefined when overlays use the top layer
- `<Surface>` runs one core per validator: replacing the validator starts a new core, so node reuse and local state never cross validators. It subscribes to the core with `useSyncExternalStore`, draws `fallback` for an invalid arrival, and reads `onIntent`, `confirm` and the optional `onEvent` through the core when it uses them.
- An implementation that throws renders the `fallback` at that node, through an error boundary and reports the node to the core. A node whose bindings failed renders the same fallback.
- Replacing the portal or turning diagnostics on or off resets the adapter's cached elements; a new `fallback` value or a new diagnostics list does not.
- `focusContinuity` defaults to `true` and keeps keyboard focus inside the surface across updates. With `<Surface>`, if the element focused inside the wrapper or portal container is disconnected by an update, focus moves to the next element in document order that was tabbable before the update and is still connected, else the closest previous one, else the wrapper, which carries `tabIndex={-1}` in this mode only; every move uses `focus({ preventScroll: true })`. Focus the host or a primitive has already placed elsewhere is never taken back, and moving focus emits no intent. With `focusContinuity={false}` the surface takes no snapshot, adds no attribute or `tabIndex` and installs no listener.
- Server-side rendering is supported. React error boundaries do not catch server rendering errors: if an implementation throws during `renderToString`, the host catches the error and supplies fallback markup. Hydrating that replacement markup can recover through client rendering; successful server renders and invalid-tree fallbacks hydrate without mismatch. The scoped `portal` container is supplied to implementations only after mounting, so it is undefined during SSR and the first client render.
- `<Surface>` renders its own wrapper element around the tree and a sibling `portal` container. Both carry `surfaceAttributes({ theme, designSystem, tree })`: §6.4's theme/design-system scope attributes, `lf_surface` and, when the tree uses responsive values, `lf_container`. Node slots do not carry these scope classes, and parents of responsive nodes do not gain containers. Changing `theme`, `designSystem` or `transparency` runs §6.4's switching sequence on the wrapper and portal container together; it preserves node identities and slot classes and runs no widget code.
- Host-only `wrapperProps` and `portalProps` accept `{ className?: string; style?: CSSProperties }`.

  Host classes append to the library classes and inline styles apply to their container; no other fields pass through, so scope attributes and `data-lf-portal` remain library-owned.

  Widget trees cannot supply these hooks.

  The base sheet emits `:where([data-lf-portal]){position:fixed;inset:0;pointer-events:none}` and `:where([data-lf-portal])>*{pointer-events:auto}`.

  The portal takes no grid track or flex gap, keeps a viewport-sized box for responsive containment and inherited scope variables, and allows clicks on overlay content.

  Responsive overlay values use viewport width, including in narrow preview cells, instead of the old block portal's host-dependent width.

  Host classes may override these zero-specificity defaults.

  Ancestors with `transform`, `filter` or layout/paint `contain` may establish a containing block instead of the viewport; hosts account for this and obey the backdrop rule below.
- Overlays stay within their surface's scope: use the top layer while retaining DOM ancestry, or the `portal` container. A backdrop slot and its overlay content are siblings. No backdrop ancestor may set opacity below 1 or a filter that creates a backdrop root; the backdrop must be able to sample the page behind it. Exit motion, scroll locking and making the background inert are part of the renderer contract: the renderer supplies the scoped container, and the app's implementations deliver the lifecycle (for example through React Aria). Browser tests and the renderer conformance suite (§13) prove it.
**Rationale**

Recommended, not required: build interactive primitives on a behaviour library such as React Aria, for accessibility.

## 12. First task: prove the primitive set on two real UIs

**Rules**

1. **Task.** Implement the primitive candidates (§5), both design systems as recipes, and the following four UIs as TSX widgets using **only** those primitives.
2. Composed components are allowed; new primitives are not, until the gap is recorded.
3. **Performance budgets.** The real renderer and validator must stay at or below 3 µs per node on the same benches (2 ms at 680 nodes), and the design-system switch at or below 16.67 ms, measured as span A (§6.4).

**Contract and examples**

1. **Synapta's agent-home queue**, matching the approved design (`synapta-core`: `design-artifacts/approved/agent-home-certified.html`, the `core.queue` widget at lines 1137–1245, the focus cards at 1247–1320, the states at 1324–1357 and the escalate dialog at 1368–1383, as of commit `91de29ed`):
   - a focus card with `Claim` / `Escalate…` on task cards, and `Acknowledge` / a `Snooze` menu / `Convert to task` on alert cards
   - selecting a row moves its card into the focus position
   - one "load more" control that advances three cursor chains
   - the approved DOM structure and look, in the Certified design system
2. **Synapta's `core.queue` widget at all four sizes** (`small`, `medium`, `large`, `full`), from `synapta-core`: `product-modules/ui/core/widgets/queue/`.
3. **Clay's git status panel** (`clay`: `packages/git/src/status.ts`, `buildGitStatusTree`) and **one Rack module panel**, in the Rack design system (`clay`: `packages/design-rack/package.json`, `uiDesignSystem`).
4. **One design system switch.** The same widget from (1) or (3), rendered under both Certified and Rack with no change to widget code.

**Acceptance criteria.**

- All four UIs render from widget code plus primitives only. Any primitive added during the task is listed with the reason it could not be composed.
- (1) matches the approved artifact in a side-by-side pixel and DOM comparison. Every intentional deviation is listed.
- All three interaction tiers are exercised: local (menus, tabs, inputs), `setState` (filter, paging, row selection), and actions (claim, escalate, acknowledge, snooze).
- Every style value in the widget code is a token or role; there are no literal colours or raw CSS.
- The output is a short report with four parts:
  - the final primitive list, with definitions
  - the style props that were needed
  - the gaps found, and how each was resolved
  - a go/no-go on the model

**Shortcuts allowed.** Fixture data instead of real backends. Widget code may run in-process in a test harness; a sandbox is not needed to answer this question. Only the parts of the SDK, validator and renderer that the four UIs need.

**If it fails**, meaning a UI can't be expressed without product-shaped primitives or raw styling, stop and revisit §5 and §6 before building anything else.

**Proof outcome.** Go: see `proof/REPORT.md` and `decision-logs/2026-10-22-1519-phase-0-go.md`.

Both source apps currently hit a wall here from opposite sides:

- **Synapta's components are too big.** Its approved home design is blocked because `Queue` locks its card layout, controls and paging inside one component.
- **Clay's primitives are too thin.** A `label` carries text, an icon and a few style variables.

**Rationale**

Before building the library, prove the model's central claim: **that a small primitive set, plus recipes and style props, can express real product UI with no product-shaped components.**

## 13. Tech stack and packages

**Rules**

1. TypeScript throughout.
2. Bun to build and test.
3. No WebAssembly, no Rust, no bundled isolation sandbox.
4. Split into separate packages only if a real consumer needs to version the parts independently.

**Contract and examples**

- One npm package, **`@arnilo/liveframe`**, with a subpath export for each part:

  | Import | Holds |
  |---|---|
  | `@arnilo/liveframe` | Definition, catalog, theme, design-system, UI-tree and tree-patch formats; `validateTreePatch`, `diffTrees` and `applyPatch`; the validator; `bindSources` (§7.1); `auditContrast` (§6.5); the recipe resolver; `LiveframeFailure`, `LiveframeError` and `NodeRef` |
  | `@arnilo/liveframe/sdk` | The JSX runtime (`/sdk/jsx-runtime`, `/sdk/jsx-dev-runtime`), intent helpers, `ref()`, `render()`, `renderElements()` and `streamElements()` |
  | `@arnilo/liveframe/sdk/gen` | The host-side emitters behind `liveframe gen`: `generate()`, `generateDefinitions()` and `generateElementsSchema()` |
  | `@arnilo/liveframe/surface` | Host-API-free `createSurfaceCore()` and its `NodeContext` and `SurfaceSnapshot` types: the framework-independent half of a renderer (§11) |
  | `@arnilo/liveframe/react` | The renderer: `createRenderer()`, `<Surface>` and `implement()` (§11). `react` and `react-dom` are optional peer dependencies used by the React subpaths |
  | `@arnilo/liveframe/css` | Pure, host-API-free projection into three scoped sheets, plus class, style, scope and variable helpers (§6.4); the host inserts sheets |
  | `@arnilo/liveframe/pack` | Package and scenario formats, structural validators, `pack()`, `verifyPackage()`, `checkPackages()` and `renderKey()` (§7.3, §8) |
  | `@arnilo/liveframe/store` | Record formats, the `Store` interface, `memoryStore()` and `loadPlacement()` (§7.4) |
  | `@arnilo/liveframe/host` | Host-API-free `renderPlacement()`, `handleIntent()` and `dependents()`: the ordered, stateless render and intent pipeline (§7.7), with its `Served`, `HostWiring` and `HostEvent` types |
  | `@arnilo/liveframe/store/fs` | `fileStore(dir)`, which reads and writes the file system |
  | `@arnilo/liveframe/preview` | The `Runner` interface, `inProcessRunner()`, `templateRunner()` and `createPreview()` (§7.5), plus the type-only `PreviewSession`, `PreviewBinding` and `AuthoringConfig` |
  | `@arnilo/liveframe/authoring` | Host-API-free `createAuthoring()` with eight typed authoring operations; requires the host's runner |
  | `@arnilo/liveframe/runner-kit` | Host-API-free `renderModule()`, `renderTemplatePackage()` and `linkPackage()`, the in-sandbox half of a runner (§7.5) |
  | `@arnilo/liveframe/template` | Host-API-free `validateTemplate()`, `renderTemplate()` and the expression language: `checkExpression()`, `evaluate()` and the `Template`, `TemplateNode` and `Expr` types (§7.6) |
  | `@arnilo/liveframe/runner-kit.bundle.js` | The same kit with the SDK and validator as one self-contained ES module: no `import()`, `import.meta`, relative or bare imports, and no `node:`/`bun:` references (checked with `acorn` by the archive gate). One namespace serves all three SDK specifiers. Not an isolation boundary |
  | `@arnilo/liveframe/validator.bundle.js` | The root exports as one self-contained ES module under the same archive checks. No SDK render path, `renderModule` or `linkPackage`: a validating host never runs widget code. Needs no non-ECMAScript globals |
  | `@arnilo/liveframe/preview/capture` | Host-API-free `capture()`, `CaptureBackend` and `playwrightBackend(playwright)` (§7.5) |
  | `@arnilo/liveframe/preview/worker` | `workerRunner()`, which needs the `Worker` global |
  | `@arnilo/liveframe/preview/react` | `<Preview>`. Like `/react`, it needs the optional `react` peer |
  | `@arnilo/liveframe/conformance` | Host-API-free catalog, design-system and store suites: `catalogSuite()`, `designSystemSuite()`, `storeSuite()`, plus `ConformanceCase` and `ConformanceFailure` |
  | `@arnilo/liveframe/conformance/react` | `rendererSuite()` (server cases), `rendererBrowserSuite()` (browser cases) and `conformancePage()` (the app's in-page host); needs the optional `react` and `react-dom` peers |

- `schemas/tree-patch.json` has `$id: urn:liveframe:tree-patch:1`.
- A JSON Schema for every format is published at `@arnilo/liveframe/schemas/<format>.json`, so apps and agents in any language can validate the documents. The element JSON Schema and the template authoring schema are the exceptions: they depend on one catalog, so they are generated per catalog with `liveframe gen --elements-schema` and `--template-schema` instead of shipped for all. Each document's `$id` is `urn:liveframe:<format>:1` — the format and its version, never a domain or a package version — and cross-document references use those ids, so registering the published schemas resolves them without a network fetch. The files ship inside the package; a format version is a new id, never a moved one.
- The data files resolve through `exports` as well: `@arnilo/liveframe/package.json`, `@arnilo/liveframe/conformance/corpus/<format>/<document>.json`, `@arnilo/liveframe/conformance/hash/<file>.json` and `@arnilo/liveframe/conformance/patch/<file>.json`. Each data directory is its own explicit pattern, never one `./conformance/*` that would overlap the `./conformance` and `./conformance/react` code subpaths. `import.meta.resolve` finds them under both Bun and Node, so a port needs no path into `node_modules`.
- What the package ships, and nothing else: `dist/` compiled ES2022 JavaScript with `.d.ts` declarations, `schemas/*.json`, `conformance/` (the language-neutral corpus, hash and patch vectors), `docs/*.md`, `README.md`, `CHANGELOG.md`, `SECURITY.md`, `LICENSE` and `package.json`. No `.ts` or `.tsx` sources, tests, fixtures or proof code. Each subpath's `exports` entry names its declaration and its JavaScript, and the binary is `dist/cli/liveframe.js`.
- Runtime matrix. The backend subpaths (`/store/fs`, `/preview/worker`, the in-process package loader and the CLI) need Bun ≥ 1.4.2. The host-API-free subpaths need ES2022 plus only the globals listed below. The browser subpaths (`/css`, `/react`, `/preview/react`, `/conformance/react`) need any ESM bundler. `react`/`react-dom`, `playwright` and `@modelcontextprotocol/server` are optional peers, each with a subpath that needs it.

| Host-API-free subpath | Non-ECMAScript globals |
|---|---|
| `.` | none |
| `sdk` | none |
| `css` | none |
| `authoring` | `TextEncoder`, `TextDecoder`, `URL`, `console` |
| `runner-kit` | none |
| `template` | none |
| `surface` | none |
| `host` | `console` |
| `preview/capture` | `TextEncoder`, `TextDecoder`, `URL` |
| `conformance` | `TextDecoder`, `console` |
| `pack` | `TextDecoder`, `console` |
| `store` | `console` |
| `preview` | `setTimeout`, `clearTimeout`, `TextDecoder`, `console` |

Paths are relative to `@arnilo/liveframe`; `.` is the root export. The `sdk` row includes `/sdk/gen` and both JSX runtimes; `/runner-kit.bundle.js` and `/validator.bundle.js` also need no non-ECMAScript globals. Entries include bundled dependencies: Acorn guards its unused `console` warning, and the packer's source-map codec optionally uses `TextDecoder` with a pure JavaScript fallback. Preview timers bound module loading; capture needs the Encoding and URL APIs. Authoring reaches capture. Source, compiled output and browser bundles are checked against this table in CI.

- Peer ranges start at the oldest version that passes the suites covering them: `react` and `react-dom` `^19.0.0`, `playwright` `^1.49.0` (the version that added `locator.ariaSnapshot()`) and `@modelcontextprotocol/server` `^2.0.0`. `scripts/release/peer-floors.ts` installs each floor into a temporary copy of the checkout and runs those suites; a range widens only when that run passes.
- One CLI, `liveframe`, exposed through the package's `bin` (`liveframe gen`, `liveframe gen --check`, `liveframe gen --implementations`, `liveframe gen --elements-schema`, `liveframe gen --template-schema`, `liveframe preview capture`, `liveframe mcp`). `liveframe gen` writes a widget's typed component module into the app (§7.2), `--elements-schema` writes the per-catalog agent JSON Schema, `--template-schema` writes the per-catalog JSON Schema of template widgets (§7.6, optionally narrowed by `--manifest` and `--capabilities`, and reduced for structured-output APIs by `--structured-subset`), and the same emitters are importable from `/sdk/gen`. `playwright` is an optional peer dependency, needed only by `preview capture`.
- **In-process authoring.** `/authoring` exports `createAuthoring({ catalog, capabilities, runner, limits?, preview?, capture?, maxCaptureCells?, exposeMeta? })`.

  Catalog and capabilities are validated documents; the runner is required.

  Its eight async operations return `Result<T>`: `listPrimitives({ kinds? })`, `listVocabulary()`, `listCapabilities()`, `generatedTypes({ module? })`, `packDraft({ files, entry, manifest, scenarios })`, `renderScenarios({ scenario?, state?, context?, outcomes? })`, `setState({ origin: { nodeId, event }, value? })` and `capturePreview({ scenarios?, widths?, themes?, designSystems?, layout?, media? })`.

  Their values, errors and bounds match the MCP tools below, except capture returns cells with coordinates, errors, `aria: string | null`, `png: Uint8Array` only when `layout: true` was asked, `layout: CellLayout | null`, and only when `media` was asked, `media: CaptureMedia`.

  It writes no files and loads neither MCP nor Playwright.

  Missing capture configuration returns `not-found`.
  The four draft operations share one arrival-order queue; catalog reads stay concurrent. The preview binding is lazy, reused after success, retried after rejection, and closed by `close()`; the host owns the runner. `outcomes: true` returns statuses after expanding each selected scenario with exactly one `sourceOutcome` source using `outcomeScenarios()` (§7.3); scenarios with none remain unchanged, and two is `invalid-document` at `/scenarios/<index>`. Expansion errors return before rendering anything. Expanded renders use a separate surface and revision sequence and leave the preview selection, state and package unchanged. Authoring grants no store, dispatcher, resolver, installation, placement or approval authority (law 4).
- **`liveframe mcp <config-module>`** is an authoring-time MCP server for coding agents, serving the MCP protocol over stdio. The module default-exports an `AuthoringConfig`: `{ catalog, capabilities, runner?, limits?, preview?, capture?, maxCaptureCells?, draftRoot? }`. The server validates `catalog` and `capabilities` on start; an invalid config prints typed `LiveframeError`s to stderr and exits 2. Stdout carries only the protocol.

  It holds one preview session (§7.5) for its lifetime, rendered by `config.runner`, or by `workerRunner()` when the config names none, so preview and production use the same runner. With the default, the server prints one stderr line at startup saying drafts run with this process's permissions and recommending an isolated runner for an untrusted agent.

  `AuthoringConfig.limits?` and `createAuthoring({ limits? })` use the preview session's `RenderLimits` contract (§7.5), including host validation and outcome expansion. Invalid limits throw `LiveframeFailure` at construction; the CLI prints the typed `invalid-document` error at `/limits` and exits 2. Tree limits do not change tool response or capture bounds.

  `AuthoringConfig.maxCaptureCells?` and `createAuthoring({ maxCaptureCells? })` set the per-call capture cell bound: an integer from 1 to 48, default 12. An invalid value is `invalid-document` at `/maxCaptureCells`: the CLI exits 2, and the synchronous `createAuthoring()` constructor throws `LiveframeFailure` carrying that error. The tool description states the configured bound. This bounds cells, not bytes; dense or tall pages may require narrower axes to fit a client's transport limit. The general `capture()` API's `maxCells` semantics are unchanged.

  `config.preview(binding)` binds the app's own `<Preview>` page to that session; the library ships no page (§3). It is called at most once — lazily, on the first capture, from a single shared promise so concurrent captures cannot bind twice, and a rejected binding is not cached — and the binding it returns is closed on shutdown. `pack_draft`, `render_scenarios`, `set_state` and `capture_preview` run one at a time in arrival order, so a capture always shows the draft packed before it; the catalog tools stay concurrent. Each capture reads its bytes directly from the library result. `config.capture?: CaptureBackend` overrides the CLI's lazy Playwright default; untagged backend failures map to `render-failed`.

  `tools/list` holds exactly eight tools, each returning JSON in one text block. Each tool advertises a `title` and explicit `readOnlyHint`, `destructiveHint`, `idempotentHint` and `openWorldHint` annotations as listed in [the MCP guide](mcp.md#the-tools). Annotations are client hints only: they never change execution or enforce permissions or isolation. All tools have `openWorldHint: false` for the configured app's authoring environment; host-supplied runners and backends retain their own authority:

  Every tool also advertises a self-contained `outputSchema` built from the published format schemas, with only local `$ref`s.

  Each successful result adds `structuredContent` equal to the JSON value in its first text block: the definitions array, vocabulary object, capabilities document, generated module object, draft summary, tree/status-array union, state tree or capture cell-metadata array described below.

  Existing text blocks remain byte-identical, including capture's accessibility text and image blocks; capture structured output contains coordinates and errors, plus `layout` when requested.

  Capability and draft `meta` obey `exposeMeta` in both representations.

  Error results retain `isError: true` and their text and omit `structuredContent`.

  SDK 2.4.0's `2026-07-28` codec returns values directly; for protocol `2025-11-25` it wraps non-object-root schemas and structured values as `{ result: value }` (`list_primitives`, `render_scenarios` even when returning a tree, and `capture_preview`).

  Object-root results stay unwrapped.

  - `list_primitives({ kinds? })` — every definition in full, or the named kinds: props schema, children, events with `carries`, variants, slots, style props, `description` and `deprecated`.
  - `list_vocabulary()` — `{ catalogId, vocabulary }`: the id a manifest must name, then the catalog's color, surface, fillable and typography roles, tones, `surfaceTypography`, and the `space`, `radius`, `size` and `bp` names.
  - `list_capabilities()` — each source's params and result schemas and each action's args schema. It never calls a resolver. Capability `meta` is omitted unless the config sets `exposeMeta: true`.
  - `generated_types({ module? })` — `{ note, types }`, with `types` byte-identical to the selected `liveframe gen` output: `"types"` (default), `"implementations"` (`--implementations`), `"elementsSchema"` (`--elements-schema`) or `"templateSchema"` (`--template-schema`, from the server's capabilities; the optional `manifest` argument adds the draft's own paths, state keys and actions, and a manifest that does not validate is `LiveframeError`s rooted at `/manifest`). The note names the file to save. Omitting `module` preserves the original result; an unknown selector is `invalid-document` at `/module`, with all four accepted values in `expected`.
  - `pack_draft({ files, entry, manifest, scenarios })`, `pack_draft({ template, manifest, scenarios })` for a template widget (§7.6), or `{ dir, entry? }` with `config.draftRoot` (a directory holding `template.json` is a template draft and takes no sources or `entry`) — inline input is `session.update()`'s input, returning `{ hash, id, version, description?, scenarios }` (and the manifest `meta` only when `exposeMeta` is true) or the pack errors; a failed pack keeps the previous package.
  - `render_scenarios({ scenario?, state?, context?, outcomes? })` — one scenario's tree of at most 256 KiB (262144 bytes of JSON; past that, `limit-exceeded` at `/scenario`, naming the size and the limit) or its `LiveframeError`s, or every scenario's status — `{ scenario, ok: true, nodes }` for each renderable scenario, plus each distinct error once as `{ ok: false, kind, pointer, message, expected?, scenarios }` — distinct by `kind`, `pointer`, `message` and `expected` — where `scenarios` names the scenarios that share it.

    The optional boolean `outcomes: true` expands each selected scenario's single `sourceOutcome` source into `ok`, `unauthorized`, `unavailable`, `stale` and `failed`, always returning statuses even with `scenario`.

    Scenarios with no outcome source render once; more than one is `invalid-document` at `/scenarios/<index>`.

    Non-boolean `outcomes` is `invalid-document` at `/outcomes`.

  - `set_state({ origin: { nodeId, event }, value? })` — applies an offered `setState` through `session.intent` and returns the new tree under the same 256 KiB bound.

    Only a successful single-scenario render establishes a selection; checks and outcome expansion leave it unchanged.

    A successful repack clears it; a failed pack retains it.

    Without one, return `not-found` with "Call render_scenarios with a scenario first".

    Unknown nodes/events return `not-found` at `/origin/nodeId` or `undeclared-event` at `/origin/event`.

    Actions are refused as `invalid-prop` at `/origin/event` before the session can log them.

    The server supplies the current surface/revision and completes the offered intent using its literal value or the supplied event value; invalid values retain the intent validation error.

    Missing or malformed origin is `invalid-document`.

    The bound page and capture preserve changed state when reading the same scenario.

  `config.draftRoot?: string` opts the CLI into directory reads.

  A relative root resolves from the server's working directory at startup; it is canonicalized and must name an existing directory, or startup reports `invalid-document` at `/draftRoot` and exits 2.

  `dir` must be a non-empty relative path with no `..` segment.

  The reader selects top-level `.ts`/`.tsx` files plus `manifest.json` and `scenarios.json`, defaults `entry` to `entry.tsx`, ignores unrelated files and never recurses or executes code.

  The canonical directory and every selected file must stay beneath the root at path boundaries; selected files must be regular files.

  Reads are limited to 128 sources and 1048576 aggregate bytes including JSON, checked before allocating contents and during reading.

  The packer's emitted-code limit remains separate.

  Directory reads join the draft queue before packing; `/authoring` stays inline-only.
  Every reader error points to `/dir`: `invalid-document` for invalid paths, escapes, malformed JSON, non-regular files or combining `dir` with `files`, `manifest` or `scenarios`; `not-found` for an unconfigured `draftRoot` or missing directory, JSON file or entry; `limit-exceeded` for read bounds. Document validation after reading keeps normal document-root pointers. The reader assumes host-controlled directories, not a sandbox against concurrent local file replacement.

  `pack_draft` and `render_scenarios` declare only a permissive top-level object — a description per argument and the published schemas in `$defs` for reference — and validate inside the handler with the same format validators the library uses. Each inline-required `pack_draft` property's description says "Required"; missing keys return `invalid-document` at `/files`, `/entry`, `/manifest` or `/scenarios`, reporting every missing key; a draft that names `template` is a template draft, and `files` or `entry` beside it is `invalid-document` at that key. Errors inside a template are rooted at `/template`. An argument error is therefore always a `LiveframeError[]` rooted at the document an agent edits (`/manifest/id`, `/scenarios/0/params`), never the MCP layer's own validation string. Non-object `arguments` (null, arrays, strings or numbers) are protocol errors rejected before the handler; omitted arguments reach it as an empty object.
  - `capture_preview({ scenarios?, widths?, themes?, designSystems?, layout?, media? })` — captures the bound page's cells, 12 per call by default (configurable up to 48), returning each cell's coordinates, accessibility snapshot, `LiveframeError`s and PNG as image content.

    With `layout: true` each cell's metadata also carries its structural `layout` (§7.5), so a row and a stack, or a row too wide for its cell, are told apart by numbers rather than image height; an oversize record is `limit-exceeded` at `/layout`.

    With `media` every requested value multiplies the cells, each cell metadata carries its own `media` point, and the axes, `textScale` validation and the `not-found` refusal are those of §7.5.

    Its own failures are typed: an undeclared axis value is `unknown-name`, exceeding `maxCaptureCells` is `limit-exceeded` before any screenshot, with the configured bound, `maxCaptureCells` and axis-narrowing arguments in the message, an unreachable or never-ready page, a missing `preview()` and missing Playwright or Chromium are `not-found` (with the install command), and anything else keeps its message as `render-failed`.

  The server is authoring-only (law 4): it has no store, dispatcher or data resolver; its only intent path, `set_state`, applies an offered `setState`; no tool runs, logs or dispatches an action. No tool installs, places or approves a widget or resolves real data. The bound page receives trees only, never draft code (law 1). The MCP SDK is an optional peer dependency, needed only by this command; a missing SDK is reported with how to install it, and `liveframe gen` runs without it.
- Everything outside `/react`, `/store/fs`, `/preview/worker`, `/preview/react`, `/conformance/react` and the CLI is host-API-free, and CI checks it. `/css` returns strings and plain objects; inserting a sheet through `<style>`, `<link>` or a CSP nonce is the host's job. Across the library subpaths, the only dynamic `import(` is the package loader in `/preview` (§7.5), and the scan names that file as its only exception. The CLI may lazily import command-specific optional peers: `playwright` for capture and the MCP SDK for `liveframe mcp`, and it may import the host's config module named on the `liveframe mcp` command line. `liveframe gen` must run without either peer installed.

**Conformance contracts.** The kit tests the app's side of the catalog, styling, renderer and store contracts; library-internal correctness stays in the library's own tests.

- Every suite returns `ConformanceCase[]`: `{ name: string; run(): Promise<void>; timeout?: number }`, with timeout in milliseconds. The app registers each case with its own runner's `test(name, fn, timeout)`. The kit imports no test runner or assertion library. A failing case rejects with `ConformanceFailure`, an `Error` whose `rule` names the case, `spec` identifies the enforced section, and `details` holds bounded strings or the library's `LiveframeError[]`.
- An app needs one import of the kit per environment. The host-API-free suites need no React installation; renderer suites and the page host use the React subpath.
- Browser cases run in the app's test process through an app-supplied Playwright `Page`. The app bundles and serves its own page, whose entry calls `conformancePage()` with its catalog, implementations and styles. The kit bundles and serves nothing, and uses Playwright types without loading it at runtime. The page host accepts UI trees and style identities, never widget code (law 1); it records intents without dispatching actions or granting authority (law 4).
- `catalogSuite` also fails a string prop named like a URL (`href`, `src`, `url`, or ending in `Href`, `Src`, `Url`; nested props included) that declares no `url` rule, `pattern` or `enum` (§5).
- Fixtures are app-supplied trees and locators. Coverage fails closed: every catalog `(kind, variant)` needs an example, and every value of every declared axis needs one (one axis at a time, not the product); missing examples fail the suite and name the missing pairs and values. Every `(kind, variant, state)` whose resolved recipe differs from rest in any installed design system needs a state fixture; a missing fixture fails and names the tuple. For a kind with axes the fixture key's variant is the class position `variant__value…` and the required combinations are the defaults plus each non-default value of one axis at a time. The app declares which kinds are overlays and text inputs and supplies the corresponding lifecycle and text-bound fixtures; the catalog does not mark these roles. The conformance guide must explain this declaration requirement.
- `conformance/corpus/tree-patch/` applies patches then validates the complete result, with support roles `base`, `catalog`, `capabilities` and `manifest`.
- `conformance/corpus/` holds committed language-neutral cases for every format, with shared documents under `conformance/corpus/common/`. Each case is `{ inputs, options, expect }`; errors match on `(kind, pointer)` only, as an unordered set inside the 20-error bound. The library's own suite runs the cases through the reference validators (the `package` cases through `verifyPackage`, so they also pin `hash-mismatch` and `forbidden-import`), and a case expectation changes only with a format version. The package ships the corpus so a port can execute it without TypeScript.
- `conformance/patch/diff.json` holds `{ name, prev, next, patch }` vectors pinning deterministic diff order and exact application round trips. Trees are inline documents; the library tests the vectors through public exports.
- `conformance/hash/` holds committed language-neutral vectors: accepted `{ value, canonical, sha256 }` and rejected `{ value, rejected }` entries, with tagged escapes for values JSON cannot carry. `sha256` is the lowercase hex digest of the UTF-8 canonical text, without the `sha256-` prefix. `packages.json` holds `{ package, hash }` entries, where `hash` is `sha256-` plus the digest of the canonical `{ format, manifest, code, scenarios }` (§7.3). The library's suite runs every vector through the canonicaliser and hash; the set includes RFC 8785 Appendix B and changes only with a format version.

**Rationale**

Subpath exports let hosts load the parts their environment needs.

## 14. Non-goals for v1

**Rules**

1. The exclusions below define the v1 boundary.
2. Runtime agent tools that install, place or approve widgets stay the app's (`decision-logs/2026-10-22-0902-authoring-mcp-server-for-coding-agents.md`).

**Contract and examples**

- Running widget code in the browser, including in preview.
- Shipping components, a design system, an isolation sandbox (the reference runners in §7.5 are not one), a storage backend (the reference stores in §7.4 are not one), authorisation, approval flows or layout shells.
- Migrating widget state with widget code, or between versions in any way other than the declarative `migrateState` mapping (§7.1, §7.4); a state it cannot map is reset to the initial state.
- Agent tooling beyond generated typed component modules for the catalog, structured validation errors, preview capture (§7.5) and the authoring MCP server (§13).
- Renderers other than React.
- A2UI or other wire interop.

**Rationale**

These boundaries keep runtime authority with the app.

## 15. Open decisions

**Rules**

1. There are no open decisions.
2. The library uses the MIT license (`decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md`).

**Contract and examples**

The settled contracts (`decision-logs/2026-10-22-1905-phase-1-format-scope.md`) are: the vocabulary's names are app-declared and its kinds library-fixed (§6.5); the primitive set stays per app (§5); an action intent may `bind` the event's value into one argument (§8, §9).

**Rationale**

The settled contracts retain their decision-log citations.
