# Liveframe — Specification (v0.1 draft)

Published on npm as `@arnilo/liveframe`: one package, with subpath exports for each part (§13).

Drafted 2026-10-21 from two working implementations of the same idea:

- **Synapta**, a multi-tenant web platform: TSX widgets on an SDK, with three interaction tiers.
- **Clay**, a desktop editor on Tauri: server-driven UI with design-system recipes.

This library takes Synapta's authoring and interaction model and Clay's styling model, and combines them.

---

## 1. Purpose

A library for apps whose UI must change **at runtime** — by users, organisations or AI agents — **without a deployment**, while staying safe and looking exactly like the rest of the app.

The app ships a small set of trusted **primitive components** and a **design system**. Everything above that is ordinary TSX code, written by people or agents and installed at runtime:

- panels, widgets, cards, queues and whole screens
- the reusable components inside them

A new primitive is the only thing that needs a deployment. That happens only when the browser must *do* something new (a code editor, a chart engine, drag-and-drop).

## 2. The model

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

There are four rules, and none of them is optional:

1. Widget code never runs in the browser. Only the app's compiled primitives run there.
2. The UI tree is data, and it is validated before the renderer reads it.
3. Widget code never sets colours or raw CSS. Look comes from the design system; layout comes from token-constrained style props.
4. A widget never holds authority. Data is resolved and actions are run by the app, as the viewer.

## 3. What the library ships, and what the app provides

| The library ships | The app provides |
|---|---|
| The format for component definitions (props, children, events, variants, slots, style props) | Its primitive set: definitions plus React implementations |
| The format for themes and design systems (values, recipes), with a resolver and a CSS projection | Its themes and design systems |
| The TSX SDK: JSX runtime, intent helpers, a codegen CLI for typed components | Where widget code runs: its sandbox, plugged in as a runner (§7.5) |
| The validator for widget output | Its capabilities (§7.1): data sources, resolved as the viewer, and actions, each declared with schemas |
| The React renderer and the interaction plumbing | Actions, authorised and executed by the app |
| `pack()`, the record formats, the `Store` interface and two reference stores (§7.3–§7.4) | Its storage backend (database, tenancy, encryption), or a reference store |
| The preview: runners, preview sessions, `<Preview>` and `liveframe preview capture` (§7.5), plus the authoring MCP server `liveframe mcp` (§13) | A preview page that mounts `<Preview>` |
| A conformance test kit | Approval and placement of widgets |

The library ships **no components, no visual style, no isolation sandbox, no storage backend, no authorisation and no layout shell**.

## 4. Concepts

| Term | Meaning |
|---|---|
| **Primitive** | A component implemented in the app's renderer, compiled in. Small and composable (box, text, button, menu…) |
| **Definition** | The data contract of a primitive: props, children, events, variants, slots, style props |
| **Catalog** | The app's versioned set of definitions and its vocabulary (`catalogId`, for example `acme.ui@1`) |
| **Vocabulary** | The names the app declares for colour roles, typography roles, tones and design values (§6.5) |
| **Capabilities** | The app's declared actions and data sources, with descriptions and schemas (§7.1) |
| **Widget** | A TSX module plus a manifest: a pure function `(params, state, data, context) → element tree` |
| **Composed component** | A plain TSX function built from primitives and imported by widgets. Not a catalog entry |
| **UI tree** | The validated JSON tree the renderer draws |
| **Intent** | What an interaction asks for: `setState` or `action` |
| **Theme** | The only source of colour roles and typography roles |
| **Design system** | Geometry, material and motion values, plus **recipes** that map each primitive's variant, slot and state to styles |
| **Package** | An installed widget version: its manifest and compiled code, immutable and identified by a SHA-256 hash (§7.3) |
| **Placement** | One package version placed in one host slot, with its params. Each placement has its own state |
| **Store** | Where a host keeps packages, placements, state and installed styles across launches (§7.4) |
| **Scenario** | A named set of fixture inputs a package carries, such as `default`, `empty` or `failed`. Every package has at least one (§7.3) |
| **Runner** | Where widget code executes. The app's sandbox is one; preview and production use the same runner (§7.5) |

## 5. Component definitions

A definition is pure data. The SDK types, the validator, the renderer and the agent-facing docs are all generated from it.

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
- **`events`**: the events the primitive can raise, what value each carries (`none`, `string` or `boolean`) and a description. Each event takes exactly one intent.
- **`variants`** and **`defaultVariant`**: the closed variant axis that recipes key on, and the variant a node without one gets. The app chooses each kind's variants; a `box` may declare look variants such as `plate` or `rule` so that borders and rules stay recipe data.
- **`slots`**: the named parts of the primitive that recipes style.
- **`styleProps`**: which token-constrained layout props an author may set (see §6.3).
- **`a11y`**: the role, and which prop provides the accessible name.
- **`deprecated`** (optional): why the primitive or a prop is deprecated and what replaces it.

**The schema language.** Props, params, state, context, action arguments and data-source shapes all use one closed schema language based on JSON Schema 2020-12, with the discriminator form from JSON Type Definition (RFC 8927). Its forms are `string` (with `maxLength` in code points, and optional `minLength`, `pattern` and string `enum`), `number` and `integer` (with optional `minimum` and `maximum`), `boolean`, `array` (with `maxItems` and optional `minItems`) and `object` (closed: `additionalProperties: false`, with `required`). Every string and array is bounded: `maxLength` and `maxItems` are required. Length and item bounds are nonnegative integers; an omitted minimum is zero. Install validation rejects a minimum above its maximum as `invalid-document` at the minimum keyword's pointer. String bounds count Unicode code points in one pass. Any schema may carry `description`, `deprecated` and a boolean `nullable`. With `nullable: true`, `null` passes without checking the form; every other value must satisfy the form, including its enum and bounds. Omitting `nullable` or setting it to `false` rejects `null`. Nullability does not make a required property optional. The discriminator form is `{ discriminator: "<prop>", mapping: { "<tag>": ObjectSchema } }`, without `type`. It has 1–64 mapping entries, with string tags of at most 64 code points. Each entry is a closed object schema that neither declares the discriminator property nor sets `nullable: true` (RFC 8927 §2.2.8); nullability belongs on the union. Values require an own string tag property. A missing, non-string or unknown tag fails at that property's JSON Pointer with `expected` listing the allowed tags. A known tag selects only its entry through a precompiled Map; payload errors are rooted at the value. `Infer` and `liveframe gen` produce readonly tagged unions. Adding a tag is a minor catalog change; removing or narrowing one or changing the discriminator is major. Published meta-schemas describe the structure; install validation enforces the tag-property exclusion. Equivalent JSON Schema value validators use `oneOf` with a required `const` tag per closed object branch. A schema outside the language is rejected at install.

**Widget schemas carry no `pattern`.** The three schemas a widget manifest declares — `params`, `state` and `context` — are matched against values the app does not author: what a user types, what an intent carries, and what storage holds. A pattern there is widget code running on the host thread and in the browser, where one catastrophic backtrack on a short value costs seconds. So a `pattern` anywhere inside them is `invalid-document` at the keyword (`/state/properties/evil/pattern`), rejected before any value is matched, by `validateManifest`, `validateManifestShape` and the published manifest schema alike. Authors use `enum`, or ask the app for an action or source that checks the value where it is trusted. Catalog definitions and capabilities are the app's own documents and keep `pattern`.

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

The **primitive set is per app**: a catalog is the app's contract, and portability comes from the formats, not from one mandated set (`decision-logs/2026-10-22-1905-phase-1-format-scope.md`).

**Versioning.** A change that can break an existing widget or tree takes a new major `catalogId`: removing or renaming a kind, prop, variant, slot or event; narrowing a prop's type or bounds; making a prop required; changing an event's `carries`; or removing a vocabulary name. Adding a kind, an optional prop, a variant, a slot, an event or a vocabulary name keeps the id. The library classifies a change between two catalogs by these rules.

**Primitive set.** The Phase 0 proof (§12, `proof/REPORT.md`) built four real UIs from the first 23 candidates without adding a product-shaped primitive. It also showed which generic capabilities were missing. The set is:

- Layout: `box`, `stack`, `inline`, `grid`, `scroll`, `separator`
- Content: `text`, `heading`, `icon`, `image`, `link`
- Controls: `button`, `textField`, `select`, `checkbox`, `switch`
- Overlays: `menu` / `menuItem`, `popover`, `dialog`, `tooltip`
- Navigation: `tabs` / `tab`, `disclosure` (a summary label that expands its children locally, with `onToggle`)

Additions the proof found necessary:

- **Semantics on layout primitives.** `box`, `stack`, `inline` and `grid` take an optional closed `semantics` prop (`section`, `article`, `aside`, `header`, `footer`, `nav`, `list`, `listItem`, `terms`, `term`, `detail`, `form`, `group`, `figure`, `status`, `alert`) and an optional accessible `label`. Landmarks, description lists, forms, groups, figures and live regions (`status`, `alert`) are structure, not styling. A live region must stay mounted for its text changes to be announced.
- **Selection state on `button`.** `current` and `pressed` expose a selected row or toggle to assistive technology.

The icon glyph set is the app's: status marks and brand marks are icons, not primitives.

Rule: **no product-shaped components in the catalog.** A queue, a metric card or a widget frame is a composed component written in TSX. If something can be built from primitives, it must be.

## 6. Styling (Clay's model)

Styling has three layers. Each one is inert data, validated, and installable at runtime.

### 6.1 Theme: the only colour source

A theme defines **colour roles** (`surface.base`, `surface.hover`, `text.primary`, `text.muted`, `border.hairline`, `accent.fill`, `status.critical`…) and **typography roles** (`body`, `label`, `heading.2`, `mono`…). A typography role sets family, size, weight and line height, and optionally `letterSpacing` (a bounded `em` value), `textTransform` (`none` or `uppercase`), `fontStretch` (a bounded percentage, for a face with width variants such as a mono at 87.5%) and `fontSizeAdjust` (an `ex-height` factor that normalises a face whose x-height differs from the design's, as `font-size-adjust` does). Matching an approved design is often a matter of these four fields, not of new primitives.

- A colour value is a DTCG 2025.10 colour object: `{ colorSpace, components, alpha?, hex? }`, in any colour space DTCG lists. The projection converts it to CSS. A typography role follows the DTCG `typography` composite (`fontFamily`, `fontSize`, `fontWeight`, `letterSpacing`, `lineHeight` as a multiplier), with dimensions in `px` or `rem` and `letterSpacing` also in `em`; the four fields above extend it.
- Nothing else in the system may introduce a colour.
- The app declares the required role names (§6.5); a theme that misses one fails validation.
- Light, dark and high-contrast are separate themes, or modes of one theme.
- In forced-colours mode, OS system colours override everything.
- The theme is the resolved set of roles. An app may assemble it from separate sources, such as a colour package and the user's own typography preferences. Whatever the sources, nothing outside the resolved theme introduces a colour or a typeface.

### 6.2 Design system: values and recipes

A design system contributes:

- **Values**: typed, named design values, written as DTCG 2025.10 values: `dimension` (`px` or `rem`) for radius, border width, spacing, size, breakpoint and backdrop blur; `duration` (`ms` or `s`); `cubicBezier` for easing; `number` for opacity and saturation; and `shadow`, whose colour names a theme role, never a literal. `radius.control: 7`, `border.hairline: 1`, `motion.fast: 140`, `opacity.disabled: 0.5`, `blur.veil: 2`, `size.rail: 352`, plus a spacing scale `space.1…space.n`. Types include `radius`, `border-width`, `spacing`, `size`, `motion-duration`, `easing`, `opacity`, `backdrop-blur`, `shadow`, and `breakpoint` (container widths that responsive style values key on, §6.3). A `size` is a bounded length the design system owns, for a dimension no spacing step fits.
- **Declared names.** The app declares the design-value names style props may reference: the `space.*` scale, the `radius.*` names, the `size.*` names and the breakpoint names. This mirrors how §6.1 declares required colour and typography roles. A design system that misses a declared name fails validation.
- **Recipes**: keyed `<kind>.<variant>.<slot>.<state>`, each mapping to a typed style object. `<variant>` may be `*`, meaning every variant of the kind.
- **Cascade.** The resolved style of `(kind, variant, slot, state)` merges, per property and in this order: `kind.*.slot.rest`, `kind.variant.slot.rest`, `kind.*.slot.state`, `kind.variant.slot.state`. A later entry wins.

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

- **States**: `rest`, `hover`, `active`, `focus`, `disabled`, `selected`, `invalid`, `open`.
- **Recipe properties** are a closed, typed list fixed by the library: colours, borders (width per side or all sides, style), outline, radius, padding, gap, typography role, opacity, shadow, backdrop blur and saturation, transition (a duration and an easing value), and a pressed offset (a `translateY` dimension). Every property's value type is fixed. Product-specific names, such as an easing called `expo-out` or a transform preset, are design values, not recipe vocabulary.
- **Recipes own the look; style props own the structure.** A recipe never sets display mode, flex or grid layout, tracks, content alignment, size or position: those are style props (§6.3) chosen by the widget. Structure must survive a design-system switch; look must change with it (`decision-logs/2026-10-22-0850-recipes-own-look-style-props-own-structure.md`).
- **Structural defaults belong to app primitives.** Headings' wrapping, an icon's box, controls' minimum heights and overlay positioning are trusted app implementation CSS. The library's base sheet supplies only a generic reset, surface typography, containment and environment overrides; it knows no app kinds. Law 3 constrains widget code and installed style data, not trusted app primitive CSS.
- **Projection semantics.** `borderLeftWidth` and `borderRightWidth` mean inline start and inline end in left-to-right text and project to logical sides, mirroring under `dir="rtl"`; top and bottom remain physical. Vertical writing modes are out of scope. `translateY` uses CSS `translate`, preserving a primitive's own `transform`. `backdropBlur` and `backdropSaturate` compose into one `backdrop-filter`. `backgroundOpacity` multiplies the background colour's alpha through `--lf-alpha`, which environment overrides may force to 1.
- **Entry motion.** A slot whose resolved `open` declarations differ from `rest` enters from its rest declarations through `@starting-style`, using its recipe transition. Equal states emit no entry rule. Exit motion requires renderer-managed delayed unmounting (§11).
- **Colour-typed properties accept theme roles only.** Other properties accept design values or bounded literals of the right type.
- **Not allowed:** raw CSS, selectors, scripts, or literal colours.
- **Derivation:** a design system may `extends` another and override individual recipes or values.
- **Completeness:** a design system is valid only if, after `extends` and the cascade, every `(kind, variant, slot)` the catalog declares has a `rest` style, and every kind that declares an event has a `focus` overlay. Other states are optional overlays on `rest`.

### 6.3 Style props: what authors may set

Widget authors never touch colour or recipes. They choose a primitive's **variant** and set its declared **style props**. Style props are layout-only and token-constrained:

| Style prop | Accepts |
|---|---|
| `padding`, `gap`, `margin` (per side or axis) | `space.*` |
| `direction`, `align`, `justify`, `wrap`, `textAlign` | Enums (`align` on `button` places its content) |
| `width`, `height`, `minWidth`, `maxWidth` | `space.*`, `size.*`, `fill`, `fit`, fractions, or bounded `ch` / `%` |
| `grow`, `shrink`, `basis` | Bounded numbers |
| `columns`, `rows`, `area` (grid) | Bounded track lists, or area names; each track a fraction, `space.*` or `size.*` |
| `position`, `inset*` | `static` or `sticky`; `space.*` |
| `surface` (box) | A theme surface role, such as `surface.raised` |
| `fill` (box) | A non-surface role the app declares fillable, such as a status or identity role, for small indicators |
| `radius` (box) | A declared `radius.*` name, or `full` |
| `textStyle`, `tone` (text) | A declared typography role; a declared tone, which the vocabulary maps to a colour role (§6.5) |

**Responsive values.** Any style prop may take an object keyed by the breakpoint names the app declares, `base` first, such as `columns={{ base: ["1fr"], "bp.md": ["2fr", "1fr"] }}`. Each value must be valid for that prop, and an unknown key is an error. A value set at one breakpoint **holds at every wider one**, so a prop needs only the breakpoints where it changes; the projection chains each value through all narrower breakpoints rather than letting a wider key's absence reset it. Breakpoints are design-system container widths, so the layout follows the container the widget is placed in, not the viewport.

`paddingLeft`/`paddingRight` and `marginLeft`/`marginRight` mean inline start/end in left-to-right text and project to logical properties, mirroring under `dir="rtl"`. Top and bottom remain physical. Field names stay unchanged.

The SDK types enforce these values, so `gap="space.3"` compiles and `gap="13px"` doesn't. The validator enforces them again on the output tree.

### 6.4 How styling reaches the screen

`@arnilo/liveframe/css` provides pure, deterministic functions returning `Result<string>`: `baseCss(catalog)`, `themeCss(theme, catalog)` and `designSystemCss(designSystem, { catalog, registry })`. Inputs are validated before output; invalid input produces typed errors and no partial sheet. The same input, independent of object key order, produces identical bytes. The output has three independent sheets:

| Sheet | Contents and scope |
|---|---|
| Base | Generic box-sizing, zero margin/border reset and inherited control fonts under `:where([data-lf-ds]) *`; surface typography, optional containment, preference and switching overrides |
| Theme | Colour and typography role variables and `color-scheme` under `:where([data-lf-theme="<id>@<version>"])` |
| Design system | Design-value variables, recipe rules and container rules under `:where([data-lf-ds="<id>@<version>"])` |

Design-system colours refer to theme roles through `var()`, so a fixed catalog needs N + M + 1 sheets for N themes and M design systems. Surface roots carry both scope attributes and `lf_surface`. **Surfaces do not nest**, including surfaces composed by the host. Overlays follow §11's scope contract.

Every surface root sets the theme's base typography from the app's vocabulary, and every slot that draws text has a typography role. Nothing inherits the host page's fonts. Only a surface whose tree uses responsive values gains `lf_container`, a named inline-size container `lf`. Responsive rules use `@container lf` with literal design-system breakpoint widths; values chain through narrower breakpoints (§6.3). A responsive surface supplies its own container rather than relying on a host container or viewport fallback.

**Classes and names.** Each slot carries one stable class, `lf_<kind>_<variant>_<slot>`, independent of theme, design system and state. Dots in role/value names encode as `_`; `__` separates fixed suffixes. Vocabulary, catalog and id names contain no `_`, making the encoding injective. Variables are `--lf-c-<role>`, `--lf-t-<role>__<field>`, `--lf-v-<name>` and `--lf-r-<prop>__<breakpoint>__<cssProperty>`. `slotClass`, `styleDeclarations`, `surfaceAttributes`, `colourVar` and `valueVar` provide classes, plain style objects, scope attributes and variable names without a DOM dependency. Installed strings are escaped and validated, never inserted as raw CSS.

**States and cascade.** Each recipe selector has specificity (0,1,0): the slot class contributes specificity, while scope, state and root qualifiers are inside `:where()`. Source order is `rest < hover < focus < active < open < selected < invalid < disabled`. A state whose resolved declarations equal rest emits no extra rule. A root's state also reaches its slots. Hover and active never apply to a disabled element, including a slot of a disabled root.

| State | Matches |
|---|---|
| hover | `:hover` only in `@media (hover: hover)`; `[data-hovered]` on every device |
| active | `:active`, `[data-pressed]` |
| focus | `:focus-visible`, `[data-focus-visible]`, `:has(:focus-visible)` |
| open | `[open]`, `[data-open]`, `[data-expanded]`, `[aria-expanded=true]`, `:popover-open` |
| selected | `[data-selected]`, `[aria-selected=true]`, `[aria-checked=true]` |
| invalid | `:user-invalid`, `[data-invalid]`, `[aria-invalid=true]` |
| disabled | `:disabled`, `[data-disabled]`, `[aria-disabled=true]` |

**Preferences and switching.** Reduced motion sets transition durations to zero and removes the pressed offset. Reduced transparency forces `--lf-alpha: 1` and disables `backdrop-filter`; this media query is a progressive enhancement on supporting browsers. Light, dark and high-contrast theme selection belongs to the host (§6.1); the theme sheet sets `color-scheme` from `theme.colorScheme`. To switch, the host preloads sheets, sets `data-lf-switching` on the scope element, changes the theme/design-system attributes atomically, then removes `data-lf-switching` on the next animation frame. While set, transitions are disabled on that element and its descendants. Switching changes no node, slot class or widget output and runs no widget code.

**Forced colours.** `forced-color-adjust` remains `auto`; the OS owns colours. Inside `@media (forced-colors: active)`, a generic state table restores cues only where a state's resolved recipe differs from rest, using the same precedence:

| State or cue | Override |
|---|---|
| selected | `Highlight` background, `HighlightText` text |
| disabled | `GrayText` text |
| focus | 2px solid `Highlight` outline |
| invalid | 2px dashed `CanvasText` outline |
| hover, active, open | 1px `Highlight` outline |
| Rest background with no positive border width | 1px `CanvasText` outline, offset inward |
| `fill` indicator (`lf_fill`) | 1px `CanvasText` outline, offset inward |

System colours occur only in that media block. The projection never emits `forced-color-adjust: none`.

**Host coexistence and platform.** Sheets are emitted outside cascade layers; a host may import them into its own layer. The reset targets surface descendants, never a class substring such as `[class*=lf-]`. The platform floor is Baseline 2024: custom properties, `:is`/`:where`/`:has`, `color-mix()`, `oklch()` and `color()`, container queries, `:user-invalid`, `:popover-open`, `@starting-style`, unprefixed `backdrop-filter`, `font-size-adjust` and `text-wrap: balance`. A non-CSS platform may implement the resolver output itself.

**Outside this projection:** shadow-DOM isolation, print styles, compound variants, `::before`/`::after` decoration, keyframes, `:nth-child`, design-system-controlled placeholder/scrollbar colours, `prefers-contrast` selection and an atomic-class CSP route. Native controls use the theme's `color-scheme`. Inline style attributes require a CSP allowing `style-src-attr 'unsafe-inline'`; hosts insert and authorize sheets themselves (§13).

### 6.5 The declared vocabulary

The app declares the **names** its widgets, themes and design systems share. The library fixes the **kinds** of name and their value types. This settles portability without imposing one naming scheme (`decision-logs/2026-10-22-1905-phase-1-format-scope.md`).

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
};
```

Fixed by the library: the kinds above, the states (§6.2), the recipe properties (§6.2), the style props and their value rules (§6.3), and the `semantics` values (§5). A theme must define every declared role, a design system every declared value name, and a catalog carries its vocabulary.

## 7. Authoring and installing (Synapta's model)

### 7.1 Widgets

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
  actions: Record<string, { description: string; args: ObjectSchema; confirm?: boolean }>;
  sources: Record<string, { description: string; params: ObjectSchema; result: Schema }>;
};
```

A capability carries no authority. The app still authorises every read and every action as the viewer. Capabilities are how an author, person or agent, learns what exists, and what lets the validator check action arguments before they reach the dispatcher.

A widget **manifest** declares:

- `id` and `version`
- the `catalogId` it targets
- schemas for `params` (set where the widget is placed), `state` (changed by `setState`) and `context` (host-provided, for example `size`), none of which may use `pattern` (§5)
- the **data sources** it reads: `sources: Record<dataKey, { source, params }>`. Each `source` names a declared capability, and each of its params is bound to a literal or to `{ from: "params" | "state" | "context", path }`, checked against the source's params schema. `data[dataKey]` holds the source's result
- the **actions** it may invoke, each a declared capability
- the **initial `state`**, valid against its schema, used for a new placement and when a stored state no longer fits (§7.4)

The widget function's rules:

- It is **pure and synchronous**. All four inputs are frozen. Time and randomness come only through `context`. A module may not suspend while it evaluates: top-level `await` and `for await` are rejected (§7.3), because a module that never settles would hold the runner. Inside functions they are ordinary async code, which the renderer never waits for.
- It returns **one root element**.
- It uses only catalog primitives and composed components. **Host elements are errors** (`<div>`, `<span>`), and so are function props, promises, async functions, and string `className` or `style`. Props are JSON at every depth: a composed component's props are walked before it runs, so a nested function or promise is rejected even if the component would discard it.
- Every element in a list needs a **`key`**. Node ids are key paths (`root/queue/row:4812/claim`), never positions, so the renderer keeps focus, scroll and local state across re-renders.
- **Long lists are paged or windowed.** A widget renders what a surface shows, and loads more through `setState`. Render cost grows with node count, and performance budgets are measured on these realistic sizes.
- **Composed components are ordinary functions** in the same bundle or in shared modules. They are expanded when the widget runs, and the UI tree contains only primitives.

### 7.2 The SDK

- `jsx`, `jsxs` and `Fragment` under `jsxImportSource: "@arnilo/liveframe/sdk"`. Elements are frozen records keyed by primitive kind.
- **Components come from a generated module.** `liveframe gen <catalog> --out <file>` writes a typed TypeScript module into the app, binding one component per definition with `primitive("<kind>")` from the SDK:

  ```ts
  export const Button = primitive<ButtonProps>("button");
  ```

  A widget imports it by relative path (`./ui.gen`, §7.1). It is source, not a `.d.ts`, so an unpacked widget still runs, and `pack()` bundles it like a composed component (§7.3). Props are readonly, each declared event becomes a typed event prop, docs come from the definition, and `liveframe gen --check` fails CI on drift.
- `state.set(key, value?)` and `action(name, args, { bind }?)` return frozen intent data. Without a value, `state.set(key)` sends the value the event produced.
- **`render(widget, inputs, { validator, surfaceId, revision, limits?, maxErrors? })`** runs the function, builds the tree with key-path ids, and validates each node as it is emitted, so building and validating are one pass (§10). `validator` is a `CompiledValidator` from `compileValidator`; `limits` bounds nodes, depth and bytes (§10); `maxErrors` is the error bound below.
  - It returns `Result<UiTree>`: `{ ok: true, value }` or `{ ok: false, errors }`, where `errors` is every error found, up to `maxErrors` (default 20, the bound §10 uses). Each is a `LiveframeError` (§10) whose `kind` is one of `host-element`, `unknown-component`, `invalid-prop`, `invalid-children`, `missing-key`, `duplicate-key`, `undeclared-event`, `undeclared-action`, `function-prop`, `async-render`, `render-failed`, `limit-exceeded`.
  - An input that fails its manifest schema is `invalid-prop`, with a pointer into the inputs (`/state/filter`) and no `nodeId`.
- The SDK runtime uses no host APIs (no `node:`, `bun:`, DOM or `require`), so it runs unchanged in any JS runtime and any sandbox the app chooses.

### 7.3 Packages

A widget is installed as a **package**: the unit the app stores, approves, places and loads into its sandbox. An author writes TSX, but a sandbox runs JavaScript, so installing starts with `pack()` (`@arnilo/liveframe/pack`):

```ts
pack({ files, entry, manifest, scenarios }, { catalog, capabilities }) → Result<WidgetPackage>

type WidgetPackage = {
  format: "liveframe-package/1";
  manifest: Manifest;           // id, version, catalogId, schemas, initial state (§7.1)
  code: string;                 // one ES module; its default export is the widget function
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

Packages carry 1…64 scenarios with unique, non-empty names of at most 128 Unicode code points. Code is bounded to 1 MiB (1,048,576 UTF-8 bytes). The published JSON Schema also caps code at 1,048,576 code points; the structural validator enforces the byte bound and unique scenario names, which standard JSON Schema cannot express.

Optionally, the root `sourceOutcome(result)` helper declares the generic `ok` (required `value`, optional `checkedAt` bounded to 128 code points) and `unauthorized|unavailable|stale|failed` (optional `reason` bounded to 500 code points and optional `value`) union on `status`; `/pack`'s `outcomeScenarios(scenario, { source, manifest, capabilities })` returns `Result<readonly Scenario[]>`, expanding a declared source alias into `<name>.<status>` fixtures using the seed envelope's valid `value` for `ok` and status-only failure envelopes, with typed errors for unknown sources, schemas outside this convention, invalid seeds or generated names, while `pack()` retains all scenario checks.

`pack()`:

- checks the manifest: its `catalogId` is the catalog's, its schemas are well formed, and its initial state matches its state schema;
- checks the scenarios: at least one, unique names, params, state and context valid against the manifest's schemas, and data keyed by declared source names and valid against each named source's `result` schema;
- transpiles the TSX and bundles the entry's relative imports into one module. A composed component is bundled into every package that imports it, so a package never depends on another;
- rejects every other import except the SDK (`@arnilo/liveframe/sdk` and its JSX runtime), which the app's sandbox provides;
- rejects top-level `await` and `for await`: widget modules evaluate synchronously, so a suspension at that level would be a way to hold a runner forever;
- hashes the result.

**Canonical form and hash.** Hash exactly `{ format, manifest, code, scenarios }`, excluding `hash`. Canonical JSON follows [RFC 8785 §3.2](https://www.rfc-editor.org/rfc/rfc8785.html#section-3.2): sort object keys recursively by their unescaped UTF-16 code units, preserve array order, emit no whitespace, and use ECMAScript serialisation for strings, numbers and literals. Preserve Unicode without normalisation; reject non-JSON values, non-finite numbers and lone surrogates. Encode the canonical string as UTF-8, compute SHA-256 ([FIPS 180-4 §6.2](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf)), and prefix its lowercase hexadecimal digest with `sha256-`. An internal pure-JavaScript SHA-256 implementation keeps `pack()` synchronous and host-API-free, without Web Crypto. The hash checks integrity, not origin or approval.

`pack()` and `verifyPackage()` return `Result<WidgetPackage>` with bounded `LiveframeError[]` on failure (§10). A malformed manifest or scenario uses `invalid-document`; no scenarios points at `/scenarios`. Import and syntax failures use the distinct kinds in §10, with a file and line in `pointer` (a JSON Pointer such as `/files/queue.tsx/12`).

Rules:

- **`pack()` never runs widget code.** Rendering a draft is the preview's job (§7.5), through the app's runner and under the app's policy.
- **A package is immutable.** An `(id, version)` names exactly one hash, and storing different content under an existing pair is an error. A change is a new version, and rolling back means placing an older one.
- **`verifyPackage(pkg, { catalog, capabilities })`** re-checks the format, the manifest, the scenarios and the hash without executing anything. It re-parses the code and re-applies the module rules: only SDK imports may remain in a linked package, and no top-level `await` may remain in it. The app runs it on every package it loads.
- The package hash is the widget part of the re-run cache key (§8).
- `/pack` is host-API-free, so the app can pack wherever it installs widgets.

### 7.4 Storage

A runtime change never edits the app's code. Everything that changes is a record, and keeping changes across launches means storing these records and reading them back:

| Record | Holds | Key |
|---|---|---|
| Package | §7.3 | `(id, version)` |
| Placement | `{ id, slot, widget: { id, version }, params }`; `slot` is the app's own name for where the surface goes | `id` |
| State | The placement's widget state | placement `id` |
| Style | An installed theme or design system: `{ kind: "theme" \| "designSystem", id, version, body }` | `(kind, id, version)` |

`@arnilo/liveframe/store` defines the records and the interface every store implements:

```ts
interface Store {
  putPackage(pkg: WidgetPackage): Promise<void>;          // rejects a second hash for an existing (id, version)
  getPackage(id: string, version: string): Promise<WidgetPackage | undefined>;
  putPlacement(placement: Placement): Promise<void>;
  getPlacement(id: string): Promise<Placement | undefined>; // one read, whatever else is stored
  deletePlacement(id: string): Promise<void>;             // removes its state too
  listPlacements(): Promise<Placement[]>;
  putState(placementId: string, state: Json): Promise<void>;
  getState(placementId: string): Promise<Json | undefined>;
  putStyle(style: StyleRecord): Promise<void>;
  getStyle(kind: StyleRecord["kind"], id: string, version: string): Promise<StyleRecord | undefined>;
}
```

It also ships:

- **`memoryStore()`**, for tests and ephemeral hosts.
- **`fileStore(dir)`** (`@arnilo/liveframe/store/fs`), for a desktop or single-node app. It keeps one JSON file per record and writes each atomically: a temporary file, then a rename. It assumes one writing process. A key becomes a file name by percent-encoding every byte outside `a-z`, `0-9`, `_` and `-`; a key whose encoded form exceeds 200 bytes is named `~` plus the SHA-256 of its UTF-8 bytes instead, so every id the record formats allow is storable inside a 255-byte file-name limit. The layout is part of the 0.1.x compatibility promise.
- **`loadPlacement(store, id, { catalog, capabilities })`**, which reads a placement, its package and its state, verifies all three, and returns `Result<{ package, params, state, reset? }>`. Failures carry bounded `LiveframeError[]` (§10); `reset`, when present, holds the validation errors that caused a state reset.

Rules:

- **A store is not trusted.** Like a tree arriving at the renderer (§10), every record read back is checked: the package by `verifyPackage`, the params against the package's params schema, and the state against its state schema. A state that no longer fits, typically after a placement moves to a new widget version, is reset to the manifest's initial state, and `loadPlacement` reports the reset. Any other failure is an error, never a silent fallback.
- Missing placements or packages, conflicting package versions, malformed records and package integrity failures use the distinct typed errors in §10. `putPackage()` keeps its `Promise<void>` contract and rejects with a `LiveframeFailure` (§10) carrying the version-conflict error when an existing `(id, version)` has a different hash; a store rejects rather than returning a result, so the app catches it at the write boundary. `loadPlacement()` reads one placement by id and never lists, so a malformed sibling record cannot block a load.
- **A store holds one scope.** A multi-tenant app opens one store per tenant, or implements the interface over its own database and scopes it itself.
- **Approval is the app's.** A stored package is inert until the app puts a placement for it. Which theme and design system are active, per user or organisation, is also an app setting.
- **The conformance kit has a store suite** (§13), so an app's own store, for example over Postgres, proves it keeps these rules.

### 7.5 Runners and preview

Nobody publishes a widget blind. A person or an agent writes it, looks at it, changes it and looks again. Liveframe ships that loop; the app keeps the isolation.

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

- The app's sandbox is a runner. **Preview and production use the same runner**, so a preview shows what will run.
- A runner compiles the validator from `{ catalog, capabilities, pkg.manifest }` and calls `render()` (§7.2) with `surfaceId`, `revision`, `limits` and `maxErrors`.
- A runner enforces a time limit per render (`timeoutMs`, default 100 ms) and returns `limit-exceeded` when it trips.
- Liveframe ships two reference runners. **Neither is an isolation boundary**, and both return only trees their own validator accepted:
  - `inProcessRunner()` (`/preview`), for tests and trusted code. It cannot interrupt a loop; a render that returns after `timeoutMs` is reported as `limit-exceeded`.
  - `workerRunner()` (`/preview/worker`) runs packages in a worker and terminates it on a timeout or crash. It bounds time and crashes, not what the code can reach. Each render carries an id and only that id's result is accepted: a result with no pending render, the wrong id, or a second answer for one id terminates the worker, and the pending render fails with `render-failed`. A tree the host's validator rejects returns that validator's errors, and the worker is not reused.
- **Reference-runner caches.** A package's hash keys a module or validator cache only after `packageHash(pkg)` matched it, checked once per package object; a mismatch is `hash-mismatch` and nothing loads. Validators are kept per `(catalog, capabilities)` and hash, the 64 most recently used. Loaded modules cannot be unloaded, so `inProcessRunner()`'s memory grows with the distinct packages it renders, while `workerRunner({ maxPackages })` (default 64) restarts its worker once that many distinct hashes have been loaded.
- **A runner re-validates results produced outside the host's realm.** Widget code shares the worker's realm and can post its own messages, so `workerRunner()` keeps the trust anchor on the host, where the tree is validated again against the request's manifest. One worker still serves every package: a hostile widget can answer another render with a tree that is valid for that render's manifest. Hostile code needs the app's own isolated runner (§14).
- **How a reference runner loads a package.** Before importing, the loader rewrites only the canonical linker header lines (`import * as __lf_sdkN from "<sdk specifier>";`), resolving `@arnilo/liveframe/sdk`, `@arnilo/liveframe/sdk/jsx-runtime` and `@arnilo/liveframe/sdk/jsx-dev-runtime` with `import.meta.resolve` from the loader's own location. These imports resolve from the library's own installation, independently of the host's working directory. It imports the rewritten code with `import("data:text/javascript," + encodeURIComponent(code).replaceAll(".", "%2E"))`, escaping dots so Bun treats the URL as JavaScript. Stored package code retains its bare SDK specifiers. The dynamic-import restriction and CLI exception are defined in §13. A host whose sandbox cannot do this supplies its own `Runner`.

**Scenarios** are required (§7.3). They are an author's test cases and a reviewer's view of the empty, failed and full states. The app may preview with live data resolved as the viewer instead of a scenario's data.

**Preview sessions** (`/preview`, host-API-free). `createPreview({ catalog, capabilities, runner })` returns a session on the app's backend. Trees do not depend on themes or design systems, so the session takes none:

- `update({ files, entry, manifest, scenarios })` packs a draft, which is never stored, and returns `Result<WidgetPackage>`: the packed package, which carries its hash, or the pack errors. Success resets the current scenario, state and intent log. Failure keeps the previous package and session state;
- `render({ scenario, context?, state? })` selects a scenario by name as the current scenario and renders it through the runner, returning `Promise<Result<UiTree>>`. State comes from the explicit argument, else the scenario, else the manifest's `initialState`; context comes from the argument or scenario. The session keeps a fixed `surfaceId` and increases its revision on every render. Failures use `LiveframeError`s (§10), with `nodeId` when an error identifies a node;
- `intent(intent)` returns `Promise<Result<UiTree>>`. It re-checks a `setState` key and value against the manifest state schema, then updates the session state and re-renders with the current scenario and context. It re-checks an action against the manifest and the capability argument schema with `checkValue`, then appends it to the log and returns the current tree unchanged. Invalid intents change nothing. Actions are **never dispatched**;
- `intents()` returns the session's log as `readonly Intent[]`;
- `check()` renders every scenario from its own initial state and returns each `{ scenario, result }`, without changing the current scenario or state, so an app can require all of them to render before approval.

Publishing a previewed draft stores exactly the package `update()` returned, with the same hash. A draft is not a record. An app that keeps drafts across launches stores the draft's files itself.

**`<Preview>`** (`/preview/react`) is mounted by the app inside its own page, so the draft draws with the app's primitives, CSS and shell. The host passes the selected scenario's result and the session's intent log through its own transport. Draft code never reaches the browser (law 1). `<Preview>` draws that tree in every cell of `widths × themes × designSystems`, through a renderer from `createRenderer` (§11) with the app's validator. Cells are sibling surfaces, never nested, each in a container sized to its width. Width and style changes reuse the tree; selecting another scenario needs a host render.

The selected cell is highlighted, reported through `onSelect(cell)` and mirrored in the URL: `scenario` is the scenario name, `width` is in CSS px, and `theme` and `designSystem` are `id@version`. Invalid or absent selections default to the first entry of each axis. `<Preview>` reads the selection on mount and writes changes with `history.replaceState`. It reports cell intents through `onIntent(intent)` for the host to hand to the session.

It lists the intent log and each render error's `nodeId` (when present) and `pointer`. After a failed render, an earlier successful tree for the same scenario is drawn dimmed and labelled "last good render"; matching node elements receive `data-lf-error`. Without such a tree it shows the host's fallback. The retained tree still passes through `<Surface>`'s arrival check; this does not change §11's invalid-tree fallback rule.

For capture, `data-lf-preview` holds JSON axes `{ scenarios, widths, themes, designSystems }`, with scenario names, numeric widths and style `id@version` strings. Each cell's `data-lf-cell` holds its JSON coordinates `{ scenario, width, theme, designSystem }`. `data-lf-ready` is set once every cell for the current scenario has mounted with its result and errors.

**Capture** is for agents:

```sh
liveframe preview capture <url> [--scenario <a,b>] [--width <n,m>] [--theme <id@v,…>] [--design-system <id@v,…>] --out <dir>
```

It opens the app's preview page in headless Chromium and captures all declared cells unless flags narrow the axes. It navigates once per scenario, waits for `data-lf-ready`, and captures each requested cell element as `<dir>/<cell>.png` and `<dir>/<cell>.aria.yml` (the YAML accessibility snapshot from `locator.ariaSnapshot()`). Cell filenames are derived from their coordinates, sanitised to stay under `--out` and made unique with a numeric suffix if two cells sanitise alike. `<dir>/index.json` contains paths relative to that directory and the cell's `LiveframeError`s:

```json
{ "url": "…", "cells": [{ "scenario": "…", "width": 360, "theme": "…", "designSystem": "…", "png": "…", "snapshot": "…", "errors": [] }] }
```

Playwright is an optional peer dependency, used only by this command. The authoring MCP server (§13) exposes the same capture as its `capture_preview` tool, against a page its config bound to the server's own session.

## 8. Interaction (Synapta's three tiers)

| Tier | Example | Where it runs | Round trip | Author writes |
|---|---|---|---|---|
| **1. Local** | Open a menu, hover, type in a field, switch a tab that needs no new data, expand a row | Inside the primitive's React implementation | None | Nothing |
| **2. Declared state** | Change a filter, load the next page, select a row that changes what is shown | The app re-runs the widget with new `state`; the renderer reconciles the new tree by id | One, to where widgets run | `state.set(key, value?)` |
| **3. Action** | Claim a task, run a command, save a record | The app's dispatcher: authorises as the viewer, confirms if irreversible, executes | One, to the app | `action(name, args)` |

Rules:

- **One intent per event.** If a primitive needs two behaviours, it gets two events.
- **Inputs are local until they commit.** A `textField` keeps its value locally (tier 1). Its `onCommit` (Enter, blur, or a debounce the definition declares) carries the value as `setState`. To act on a typed value directly, an action intent names the argument the event's value fills: `action("tasks.escalate", { id }, { bind: "reason" })`. The validator checks that the event's `carries` type matches that argument's schema, and the app re-checks the filled arguments on dispatch.
- **The app re-checks every intent.** The intent must be declared by the widget's manifest, and its args must match the action's schema in the app's capabilities. The validator checks this on every render; the app checks it again on dispatch. Intents carry no authority.
- **State is owned by the app.** Widget state is persisted per placement, in the app's store (§7.4). The widget only ever receives it as input.
- **Re-runs are cacheable.** A widget is pure, so the same widget version and the same inputs always produce the same tree. A host may skip a re-run, and the transfer, when the hash of the package (§7.3), `catalogId`, params, state, data and context is unchanged.

## 9. The UI tree (wire format)

The format is deliberately minimal. Nothing in the model needs more.

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
  events?: Record<string, Intent>;
  children?: UiNode[];
};
type Intent =
  | { type: "setState"; key: string; value?: Json }   // value absent ⇒ the event's value
  | { type: "action"; name: string; args: Record<string, Json>; bind?: string }; // bind: the arg the event's value fills
```

- Each render sends the **whole tree**. The renderer reconciles by `id`, so unchanged nodes keep their DOM and local state.
- A `revision` lower than the current one is ignored.
- Compression comes before patches. The tree is repetitive JSON, so the transport's compression (gzip, brotli) shrinks it well. Patches are a later optimisation, added only if a measurement on a realistic tree shows they're needed.
- Interop with A2UI or other formats is possible through a converter. It is not part of v1.

## 10. Validation

The validator runs on every rendered tree before it leaves the app's backend. The renderer re-checks every tree on arrival with the app's compiled validator (§11), so it never trusts its transport.

It checks:

- every `kind` exists in the catalog
- props match their schemas, and strings and arrays are bounded
- children match the definition, and style props are declared and in range; a dimension that names a design value (`space.*`, `radius.*`, `size.*`, a breakpoint) fails when the app did not declare that name
- variants exist
- event names are declared, `setState` keys exist in the state schema and their values match it, action names are in the manifest, action args match the action's schema in the app's capabilities, and a `bind` names an argument whose type matches the event's `carries`
- ids are unique and key-derived
- limits hold: node count (default 5,000), depth (default 64), and tree size in bytes (default 1 MiB), all configurable. Tree size is the UTF-8 length of the tree's `JSON.stringify` output, counted during the walk without serialising. String bounds count code points. The runner adds a time limit (§7.5)

**Errors.** Every validator returns `Result<T>`: `{ ok: true, value } | { ok: false, errors }`. A failed validation returns every error it found, up to a bound (default 20), so an author or agent fixes them in one round. Install-time APIs that have no value to return on failure throw `LiveframeFailure`, a subclass of `Error` whose `errors` is that same bounded `LiveframeError[]` and whose `message` is one `pointer: message` line per error. `pack()`, `verifyPackage()`, `loadPlacement()` and `Runner.render()` use the same result and error bound; async operations wrap the result in a promise. Each `LiveframeError` is `{ kind, pointer, message, expected?, nodeId? }`: `pointer` is a JSON Pointer into the document (the empty string at its root), `expected` is the rule that failed, in words an agent can act on, and `nodeId`, when present, is the key path of the UI node. The complete kind list is:

| Kind | Meaning |
|---|---|
| `invalid-document` | Malformed structure or value, including a manifest, scenario or stored record; missing scenarios point at `/scenarios`. |
| `unknown-name` | An undeclared name. |
| `incomplete-design-system` | A missing required recipe. |
| `colour-outside-theme` | A colour outside the theme's authority. |
| `catalog-mismatch` | A different catalog identity. |
| `cyclic-extends` | A derivation cycle. |
| `forbidden-import` | An import or re-export outside relative widget modules and the SDK, or any `require(…)`, `import.meta` or dynamic `import()` in widget code. |
| `transpile-failed` | A syntax error, with file and line in `pointer` (§7.3). |
| `hash-mismatch` | Package content differs from its declared hash. |
| `version-conflict` | A second hash under an existing package `(id, version)`. |
| `not-found` | A missing placement or package. |
| `host-element` | A host element such as a raw HTML tag. |
| `unknown-component` | A component outside the catalog. |
| `invalid-prop` | A prop or placement param that fails its schema. |
| `invalid-children` | Children that violate the definition's rules. |
| `missing-key` | A repeated sibling without a key. |
| `duplicate-key` | Duplicate sibling keys. |
| `undeclared-event` | An event outside the definition. |
| `undeclared-action` | An action outside the manifest. |
| `function-prop` | A function used as a prop. |
| `async-render` | A component returned a promise. |
| `render-failed` | A component threw or a runner failed to load or execute a widget. |
| `limit-exceeded` | A node, depth, byte, error-collection or runner time limit was reached. |

`kind` is open: a minor release may add kinds, so a consumer must handle an unknown kind by name — report it, never fail to compile or silently drop it. Removing a kind, or changing what one means, is a major change.

The validator is **compiled per catalog**: when the catalog, vocabulary, capabilities and manifest are loaded, each definition and schema becomes a closure over precomputed sets and checks, instead of schemas interpreted on every render. It never uses `eval` or the `Function` constructor, which content security policies and some sandboxes forbid. Its per-node checks are what `render()` calls while it builds the tree, so building and validating are one pass; the same validator re-checks a whole tree on arrival. In the Phase 0 proof, validation is more than half of a render's cost, and building the tree checks the same props a second time. Build and validate become one pass (`docs/model.md`, "Performance"; `decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md`).

It validates every other format on install: a catalog's definitions and schema language, the vocabulary, the capabilities, a manifest against its catalog and capabilities, a theme against the vocabulary (every role present), and a design system against the catalog and vocabulary (values typed, every declared name defined, recipes complete after the cascade, and no colour outside the theme). The library publishes a JSON Schema for every format (§13).

## 11. Renderer

`@arnilo/liveframe/react`:

```tsx
const { Surface } = createRenderer({ catalog, implementations }); // the registry check
const validator = compileValidator({ catalog, capabilities, manifest });
<Surface tree={tree} validator={validator} theme={theme} designSystem={designSystem} onIntent={onIntent} fallback={<Unavailable />} />;
```

- **`createRenderer({ catalog, implementations })`** runs the registry check once, at startup: it fails if a catalog kind has no implementation, two implementations bind one kind, or an implementation's definition differs from the catalog's. It returns `{ Surface }`; a failed check throws `RendererError`, a `LiveframeFailure` whose `errors` name each discrepancy (`catalog-mismatch`), so a host catches it with the same handler as every other install failure.
- **`<Surface>`** draws one surface. `theme` and `designSystem` are `{ id, version }` identities for §6.4's scope attributes.
- **`implement(definition, Component)`** binds a primitive's React implementation. The implementation receives:
  - `props`: validated values
  - `slot(name)`: the single stable recipe class for that slot in its current variant (§6.4). The root slot also carries the node's style-prop classes; surface and container classes belong to the surface wrapper. Implementations expose state through the normative selector table there
  - `style`: the root's inline declarations from the node's style props (`styleDeclarations`, §6.4)
  - `emit(event, value?)`: raises the declared intent
  - `children`: already rendered
  - `items`: a node context for each child, with `id`, `kind`, `variant`, `props`, `slot(name)`, `style`, `children` (already rendered), `render()` (the child drawn through its own implementation) and `emit(event, value?)`. Slots, styles and intents belong to that child, so collection primitives can draw its parts themselves
  - `portal`: the surface's scoped overlay container, or undefined when overlays use the top layer
- **The renderer never trusts its transport.** It re-checks every arriving tree with the `validator`, compiled from the catalog, the capabilities and the widget's manifest (§10), before reading any tree field, including `surfaceId` or `revision`. A tree that fails renders the app's `fallback` for the whole surface, never part of an invalid tree and never nothing. After validation, a tree for the same `surfaceId` whose `revision` is lower than the current one is ignored; a different `surfaceId` replaces the current tree.
- Nodes render keyed by `id`, so focus, scroll and local state survive re-renders. An implementation that throws renders the `fallback` at that node, through an error boundary.
- Server-side rendering is supported. React error boundaries do not catch server rendering errors: if an implementation throws during `renderToString`, the host catches the error and supplies fallback markup. Hydrating that replacement markup can recover through client rendering; successful server renders and invalid-tree fallbacks hydrate without mismatch. The scoped `portal` container is supplied to implementations only after mounting, so it is undefined during SSR and the first client render.
- `<Surface>` renders its own wrapper element around the tree and a sibling `portal` container. Both carry `surfaceAttributes({ theme, designSystem, tree })`: §6.4's theme/design-system scope attributes, `lf_surface` and, when the tree uses responsive values, `lf_container`. Node slots do not carry these scope classes, and parents of responsive nodes do not gain containers. Surfaces never nest. Changing `theme` or `designSystem` runs §6.4's switching sequence on the wrapper and portal container together; it preserves node identities and slot classes and runs no widget code.
- Overlays stay within their surface's scope: use the top layer while retaining DOM ancestry, or the `portal` container. A backdrop slot and its overlay content are siblings. No backdrop ancestor may set opacity below 1 or a filter that creates a backdrop root; the backdrop must be able to sample the page behind it. Exit motion, scroll locking and making the background inert are part of the renderer contract: the renderer supplies the scoped container, and the app's implementations deliver the lifecycle (for example through React Aria). Browser tests and the renderer conformance suite (§13) prove it.
- `emit(event, value?)` checks the event value against the definition's `carries` (`none`: no value; `string`; `boolean`). A mismatch is an implementation bug: it throws and raises no intent. `onIntent` receives complete intents: a `setState` without `value` gets the event's value; an action with `bind` gets `args[bind]` set to that value and `bind` removed. Explicit `setState` values are preserved. The app re-checks the filled intent (§8), re-runs the widget or dispatches the action, then passes the new tree back in.
- Recommended, not required: build interactive primitives on a behaviour library such as React Aria, for accessibility.

## 12. First task: prove the primitive set on two real UIs

Before building the library, prove the model's central claim: **that a small primitive set, plus recipes and style props, can express real product UI with no product-shaped components.** Both source apps currently hit a wall here from opposite sides:

- **Synapta's components are too big.** Its approved home design is blocked because `Queue` locks its card layout, controls and paging inside one component.
- **Clay's primitives are too thin.** A `label` carries text, an icon and a few style variables.

**Task.** Implement the primitive candidates (§5), both design systems as recipes, and the following four UIs as TSX widgets using **only** those primitives. Composed components are allowed; new primitives are not, until the gap is recorded.

1. **Synapta's agent-home queue**, matching the approved design (`synapta-core`: `design-artifacts/approved/agent-home-certified.html`, the `core.queue` widget at lines 1137–1245, the focus cards at 1247–1320, the states at 1324–1357 and the escalate dialog at 1368–1383, as of commit `91de29ed`):
   - a focus card with `Claim` / `Escalate…` on task cards, and `Acknowledge` / a `Snooze` menu / `Convert to task` on alert cards
   - selecting a row moves its card into the focus position
   - one "load more" control that advances three cursor chains
   - the approved DOM structure and look, in the Certified design system
   - The blocker this resolves is recorded in `synapta-core`: `plans/200.4-SdkComponentsRendererAndQueue.md`, task T4b.
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

**Outcome (2026-10-22): go.** See `proof/REPORT.md` and `decision-logs/2026-10-22-1519-phase-0-go.md`.

The first pass was a conditional go: all four UIs were built from the candidates and composed TSX, with no product-shaped primitive and no raw styling, all three tiers worked, and the switch needed no widget change, but the agent-home queue differed from the approved artifact by 36–50% of pixels because generic capabilities were missing. Plan 002 added them to §5 and §6.3–§6.4 and re-proved the comparison:

- **pixel mismatch 0.72% / 0.75% / 0.97%** at 1440 / 1024 / 390 px, against the ≤ 1% bar, at region sizes equal to the artifact's, with no diagnostics;
- every remaining difference listed and approved: ten DOM causes (each a markup choice of an existing primitive) and 32 style values (27 anchor correspondence, 3 recorded switch-budget choices, 2 not expressible with no visual effect), in `proof/PARITY.md`;
- the artifact's two font faces snapshotted with licences and SHA-256, so typography is compared with the real faces.

The one budget that does not hold is render cost: the artifact-faithful tree is 679 nodes at 50 rows (13.6 per row), and the proof's render path costs 8.5 µs per node, so its 50-row selection rerenders in 5.75 ms against a 2 ms bench. The owner accepted this as a rendering-path cost rather than a model finding, and made it Phase 1's exit criterion: **the real renderer and validator must stay at or below 3 µs per node** on the same benches (2 ms at 680 nodes), and the design-system switch at or below 16.67 ms.

Phase 0 is done and Phase 1 may freeze the §5–§8 formats.

## 13. Tech stack and packages

- TypeScript throughout. Bun to build and test. No WebAssembly, no Rust, no bundled isolation sandbox.
- One npm package, **`@arnilo/liveframe`**, with a subpath export for each part:

  | Import | Holds |
  |---|---|
  | `@arnilo/liveframe` | Definition, catalog, theme and design-system formats; the validator; the recipe resolver; `LiveframeFailure` and `LiveframeError` |
  | `@arnilo/liveframe/sdk` | The JSX runtime (`/sdk/jsx-runtime`, `/sdk/jsx-dev-runtime`), intent helpers, and `render()` |
  | `@arnilo/liveframe/react` | The renderer: `createRenderer()`, `<Surface>` and `implement()` (§11). `react` and `react-dom` are optional peer dependencies used by the React subpaths |
  | `@arnilo/liveframe/css` | Pure, host-API-free projection into three scoped sheets, plus class, style, scope and variable helpers (§6.4); the host inserts sheets |
  | `@arnilo/liveframe/pack` | Package and scenario formats, structural validators, `pack()` and `verifyPackage()` (§7.3) |
  | `@arnilo/liveframe/store` | Record formats, the `Store` interface, `memoryStore()` and `loadPlacement()` (§7.4) |
  | `@arnilo/liveframe/store/fs` | `fileStore(dir)`, which reads and writes the file system |
  | `@arnilo/liveframe/preview` | The `Runner` interface, `inProcessRunner()` and `createPreview()` (§7.5), plus the type-only `PreviewSession`, `PreviewBinding` and `AuthoringConfig` |
  | `@arnilo/liveframe/preview/worker` | `workerRunner()`, which needs the `Worker` global |
  | `@arnilo/liveframe/preview/react` | `<Preview>`. Like `/react`, it needs the optional `react` peer |
  | `@arnilo/liveframe/conformance` | Host-API-free catalog, design-system and store suites: `catalogSuite()`, `designSystemSuite()`, `storeSuite()`, plus `ConformanceCase` and `ConformanceFailure` |
  | `@arnilo/liveframe/conformance/react` | `rendererSuite()` (server cases), `rendererBrowserSuite()` (browser cases) and `conformancePage()` (the app's in-page host); needs the optional `react` and `react-dom` peers |

- A JSON Schema for every format is published at `@arnilo/liveframe/schemas/<format>.json`, so apps and agents in any language can validate the documents. Each document's `$id` is `urn:liveframe:<format>:1` — the format and its version, never a domain or a package version — and cross-document references use those ids, so registering the published schemas resolves them without a network fetch. The files ship inside the package; a format version is a new id, never a moved one.
- What the package ships, and nothing else: `dist/` compiled ES2022 JavaScript with `.d.ts` declarations, `schemas/*.json`, `docs/*.md`, `README.md`, `CHANGELOG.md`, `SECURITY.md`, `LICENSE` and `package.json`. No `.ts` or `.tsx` sources, tests, fixtures or proof code. Each subpath's `exports` entry names its declaration and its JavaScript, and the binary is `dist/cli/liveframe.js`.
- Runtime matrix. The backend subpaths (`/store/fs`, `/preview/worker`, the in-process package loader and the CLI) need Bun ≥ 1.4.2. The host-API-free subpaths need any ES2022 runtime. The browser subpaths (`/css`, `/react`, `/preview/react`, `/conformance/react`) need any ESM bundler. `react`/`react-dom`, `playwright` and `@modelcontextprotocol/server` are optional peers, each with a subpath that needs it.
- Peer ranges start at the oldest version that passes the suites covering them: `react` and `react-dom` `^19.0.0`, `playwright` `^1.49.0` (the version that added `locator.ariaSnapshot()`) and `@modelcontextprotocol/server` `^2.0.0`. `scripts/release/peer-floors.ts` installs each floor into a temporary copy of the checkout and runs those suites; a range widens only when that run passes.
- One CLI, `liveframe`, exposed through the package's `bin` (`liveframe gen`, `liveframe gen --check`, `liveframe preview capture`, `liveframe mcp`). `liveframe gen` writes a widget's typed component module into the app (§7.2). `playwright` is an optional peer dependency, needed only by `preview capture`.
- **`liveframe mcp <config-module>`** is an authoring-time MCP server for coding agents, serving the MCP protocol over stdio. The module default-exports an `AuthoringConfig`: `{ catalog, capabilities, runner?, preview? }`. The server validates `catalog` and `capabilities` on start; an invalid config prints typed `LiveframeError`s to stderr and exits 2. Stdout carries only the protocol.

  It holds one preview session (§7.5) for its lifetime, rendered by `config.runner`, or by `workerRunner()` when the config names none, so preview and production use the same runner. With the default, the server prints one stderr line at startup saying drafts run with this process's permissions and recommending an isolated runner for an untrusted agent.

  `config.preview(binding)` binds the app's own `<Preview>` page to that session; the library ships no page (§3). It is called at most once — lazily, on the first capture, from a single shared promise so concurrent captures cannot bind twice, and a rejected binding is not cached — and the binding it returns is closed on shutdown. `pack_draft`, `render_scenarios` and `capture_preview` run one at a time in arrival order, so a capture always shows the draft packed before it; the catalog tools stay concurrent. Each capture writes into its own temporary directory, removed once its content is read.

  `tools/list` holds exactly seven tools, each returning JSON in one text block:

  - `list_primitives({ kinds? })` — every definition in full, or the named kinds: props schema, children, events with `carries`, variants, slots, style props, `description` and `deprecated`.
  - `list_vocabulary()` — `{ catalogId, vocabulary }`: the id a manifest must name, then the catalog's color, surface, fillable and typography roles, tones, `surfaceTypography`, and the `space`, `radius`, `size` and `bp` names.
  - `list_capabilities()` — each source's params and result schemas and each action's args schema. It never calls a resolver.
  - `generated_types()` — the `liveframe gen` output, byte-identical.
  - `pack_draft({ files, entry, manifest, scenarios })` — `session.update()`'s input, returning `{ hash, id, version, scenarios }` or the pack errors; a failed pack keeps the previous package.
  - `render_scenarios({ scenario?, state?, context? })` — one scenario's tree of at most 256 KiB (262144 bytes of JSON; past that, `limit-exceeded` at `/scenario`, naming the size and the limit) or its `LiveframeError`s, or every scenario's status — `{ scenario, ok: true, nodes }` for each renderable scenario, plus each distinct error once as `{ ok: false, kind, pointer, message, expected?, scenarios }` — distinct by `kind`, `pointer`, `message` and `expected` — where `scenarios` names the scenarios that share it.

  `pack_draft` and `render_scenarios` declare only a permissive top-level object — required keys, a description per argument, and the published schemas in `$defs` for reference — and validate inside the handler with the same format validators the library uses. An argument error is therefore always a `LiveframeError[]` rooted at the document an agent edits (`/manifest/id`, `/scenarios/0/params`), never the MCP layer's own validation string; only a missing required key or a non-object argument still fails before the handler.
  - `capture_preview({ scenarios?, widths?, themes?, designSystems? })` — captures the bound page's cells, at most 12 per call, returning each cell's coordinates, accessibility snapshot, `LiveframeError`s and PNG as image content. Its own failures are typed: an undeclared axis value is `unknown-name`, more than 12 cells is `limit-exceeded`, an unreachable or never-ready page, a missing `preview()` and missing Playwright or Chromium are `not-found` (with the install command), and anything else keeps its message as `render-failed`.

  The server is authoring-only (law 4): it has no store, dispatcher, data resolver or intent tool, and no tool installs, places or approves a widget, resolves real data or runs an action. The bound page receives trees only, never draft code (law 1). The MCP SDK is an optional peer dependency, needed only by this command; a missing SDK is reported with how to install it, and `liveframe gen` runs without it.
- Everything outside `/react`, `/store/fs`, `/preview/worker`, `/preview/react`, `/conformance/react` and the CLI is host-API-free, and CI checks it. `/css` returns strings and plain objects; inserting a sheet through `<style>`, `<link>` or a CSP nonce is the host's job. Across the library subpaths, the only dynamic `import(` is the package loader in `/preview` (§7.5), and the scan names that file as its only exception. The CLI may lazily import command-specific optional peers: `playwright` for capture and the MCP SDK for `liveframe mcp`, and it may import the host's config module named on the `liveframe mcp` command line. `liveframe gen` must run without either peer installed.
- Split into separate packages only if a real consumer needs to version the parts independently.

**Conformance contracts.** The kit tests the app's side of the catalog, styling, renderer and store contracts; library-internal correctness stays in the library's own tests.

- Every suite returns `ConformanceCase[]`: `{ name: string; run(): Promise<void>; timeout?: number }`, with timeout in milliseconds. The app registers each case with its own runner's `test(name, fn, timeout)`. The kit imports no test runner or assertion library. A failing case rejects with `ConformanceFailure`, an `Error` whose `rule` names the case, `spec` identifies the enforced section, and `details` holds bounded strings or the library's `LiveframeError[]`.
- An app needs one import of the kit per environment. The host-API-free suites need no React installation; renderer suites and the page host use the React subpath.
- Browser cases run in the app's test process through an app-supplied Playwright `Page`. The app bundles and serves its own page, whose entry calls `conformancePage()` with its catalog, implementations and styles. The kit bundles and serves nothing, and uses Playwright types without loading it at runtime. The page host accepts UI trees and style identities, never widget code (law 1); it records intents without dispatching actions or granting authority (law 4).
- Fixtures are app-supplied trees and locators. Coverage fails closed: every catalog `(kind, variant)` needs an example; missing examples fail the suite and name the missing pairs. Every `(kind, variant, state)` whose resolved recipe differs from rest in any installed design system needs a state fixture; a missing fixture fails and names the tuple. The app declares which kinds are overlays and text inputs and supplies the corresponding lifecycle and text-bound fixtures; the catalog does not mark these roles. The conformance guide must explain this declaration requirement.

## 14. Non-goals for v1

- Running widget code in the browser, including in preview.
- Shipping components, a design system, an isolation sandbox (the reference runners in §7.5 are not one), a storage backend (the reference stores in §7.4 are not one), authorisation, approval flows or layout shells.
- Migrating widget state between versions beyond resetting it to the initial state (§7.4).
- Agent tooling beyond generated typed component modules for the catalog, structured validation errors, preview capture (§7.5) and the authoring MCP server (§13). Runtime agent tools that install, place or approve widgets stay the app's (`decision-logs/2026-10-22-0902-authoring-mcp-server-for-coding-agents.md`).
- Renderers other than React.
- Tree patches, and A2UI or other wire interop.

## 15. Open decisions

- None. 0.1.0 ships under the MIT license (`decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md`, R1).

Settled before Phase 1 (`decision-logs/2026-10-22-1905-phase-1-format-scope.md`): the vocabulary's names are app-declared and its kinds library-fixed (§6.5); the primitive set stays per app (§5); an action intent may `bind` the event's value into one argument (§8, §9).
