# @arnilo/liveframe-starter

A starting point for a [Liveframe](https://github.com/ashiqrniloy/liveframe) host: a reference catalog, React implementations, three themes and a design system that pass every conformance suite. **Copy it or extend it; it is not part of the core contract.** The core package ships no components (spec §3) — this one is an app's worth of them, so you can see the pieces working before you write your own.

Requires Bun ≥ 1.4.2, `@arnilo/liveframe` `~0.4.0-0`, React 19, `react-aria-components` and `@internationalized/date` (for `dateField`).

```sh
bun add @arnilo/liveframe @arnilo/liveframe-starter react react-dom react-aria-components @internationalized/date
```

```tsx
import { Surface } from "./surface"; // createRenderer({ catalog, implementations }).Surface
import { catalog, implementations, themes, designSystem, styles } from "@arnilo/liveframe-starter";
```

| Export | What it is |
| --- | --- |
| `catalog` | `starter.ui@1`: 30 generic primitives (below), validated. Its source of truth is `catalog.json` (`@arnilo/liveframe-starter/catalog.json`), which `liveframe gen` and the MCP config read |
| `implementations` | One React implementation per kind, built on React Aria Components. Pass them to `createRenderer({ catalog, implementations })` |
| `themes` | `starter-light`, `starter-dark`, `starter-high-contrast`. Colours live only here (law 3) |
| `designSystem` | `starter@1.0.0`: values and recipes for every kind. A `tone` axis on `button` (`neutral`, `critical`) is two role aliases, not product variants; the `sheen` extension property shows how an app adds a look the library does not name |
| `styles()` | `{ base, primitives, themes, designSystem }`: the four sheets to serve, in that order. Each theme and design system scopes itself to the surface that names it, so all three themes load at once and a switch is an attribute change |
| `primitiveCss` | The trusted structural CSS (display, flex, minimum heights) the recipes deliberately leave out |
| `@arnilo/liveframe-starter/ui` | The generated widget components (`liveframe gen`): `import { Stack, Button } from "…/ui"` in widget TSX |
| `@arnilo/liveframe-starter/definitions` | The generated literal definitions `implement()` infers props from |
| `@arnilo/liveframe-starter/catalog.digest.md` | The catalog's agent digest (`liveframe gen --digest`): the facts an agent needs to write element JSON for it, as Markdown. Regenerate it with your capabilities and `local` schema to describe those too |

## The primitives

Layout `box` `stack` `inline` `grid` `scroll` `separator`; content `text` `hint` `heading` `icon` `image` `link` `richText` `chart`; tables `table` `tableRow` `tableCell`; controls `button` `textField` `select` `checkbox` `switch` `radioGroup` `radio` `slider` `progress` `dateField`; overlays `menu` `menuItem` `popover` `dialog` `tooltip`; navigation `tabs` `tab` `disclosure`. All are in the spec §5 primitive set except `hint` (secondary text a control can reference with `describedBy`, a node reference). There is no queue, card, metric or widget frame: if it can be built from primitives, it is widget code.

The five controls added in 0.4.0 each do something no composition of the others can: a radio group's roving focus and group name, a slider's pointer tracking, a progress bar's value semantics and proportional fill, and a date field's locale-ordered segments.

- `radioGroup` (`label`, `value?`, `orientation?`, `disabled?`, `describedBy?`) holds 2–32 `radio` children (`label`, `value`, `disabled?`). Its `onChange` carries the chosen value. A `radio` outside a group throws, so its node draws the fallback.
- `slider` (`label`, `value`, `minimum?` 0, `maximum?` 100, `step?` 1, `valueText?`, `disabled?`) raises `onChange` with a number when a drag or key step ends, never while dragging. A `maximum` at or below `minimum` draws a disabled slider at `minimum`.
- `progress` (`label`, `value?`, `minimum?`, `maximum?`, `valueText?`) raises nothing. With no `value` it is indeterminate and styled by the `mixed` state.
- `dateField` (`label`, `value?`, `minimum?`, `maximum?`, `disabled?`, `readOnly?`, `describedBy?`) takes ISO dates (`YYYY-MM-DD`). `onChange` carries a complete date, or the empty string when every segment is cleared, and never a partial one. A value that names no day, such as `2026-02-30`, draws an empty field. A value outside `minimum`/`maximum` is `invalid`.

The fill of `slider` and `progress` is the only geometry an implementation computes: an inline end position, never a colour.

The five content kinds added in 0.4.0 lay out what no composition of `text` can: mixed emphasis and links in one text flow, geometry drawn from numbers, and column layout with header association. None raises an event.

- `richText` (`text` ≤ 4,000, `headingLevel?` 2–6, default 3) draws a closed subset: paragraphs split by blank lines, `#`–`###` headings (drawn from `headingLevel`), one level of `-`/`*`/`1.` lists, `**strong**`, `*em*` or `_em_`, `` `code` ``, `[label](target)` and backslash escapes. It renders elements, never HTML from the string, so `<script>` in the text is drawn as characters. A link target must pass the `link.href` rule (`https` or relative, no control characters, checked with the core's `checkUrl`); otherwise the whole `[label](target)` is drawn as text. An opener with no closer on its line is text.
- `chart` (`label`, `type` `bar`|`line`, `labels` ≤ 100, `series` 1–4 of `{ name, values ≤ 100 }`, `summary?`) draws SVG with a zero baseline and round ticks. It is one image named by `label`, whose description holds `summary` and a list of every drawn value. Each series paints `currentColor` under its `series1`…`series4` slot, so its colour is the design system's, and a theme switch recolours it. The root is 16rem high in the starter's primitive CSS; set the `height` style prop to change it. Shape the data (aggregation, ordering, units) before it reaches the chart; an app with real charting needs brings its own primitive.
- `table` (`label`, `caption?`) holds 1–500 `tableRow` children, each holding 1–32 `tableCell` children (`header?` `column`|`row`, `span?` 1–32, any children). It draws native `<table>`, `<tr>`, `<th scope>` and `<td>`: a static table with no grid focus or selection.

`scroll` also windows a long collection: with `itemCount`, `itemStart`, `itemSize` (a `size.*` name; the design system declares `size.row`) and optional `step`, it reserves the space of the rows not drawn and raises `onRange` with the visible rows. The list is widget code; see [Lists longer than the node limit](../../docs/sdk.md#lists-longer-than-the-node-limit).

It uses the 0.3.0 features worth copying: node references (`textField.describedBy`), a variant axis with role aliases (`button.tone`), an extension property (`sheen`), and `url` rules on `link.href` and `image.src` (`https` or relative).

## Conformance

`catalogSuite`, `designSystemSuite({ contrast: true })` for all three themes, `rendererSuite` and `rendererBrowserSuite` run against it in Chromium, Firefox and WebKit in this repository's CI (`packages/starter/src/__tests__`). Use those tests as the template for your own host.

## Extending it

- **A new kind:** add it to `catalog.json`, run `liveframe gen` (twice: components and `--implementations`), add recipes for it and an `implement(…)` binding. The suites tell you what is missing.
- **Your own look:** keep the catalog and replace `themes` and `designSystem`; the recipes name roles, so a theme swaps colours without touching them. Since 0.4.0 your design system must also declare `size.row` and give `scroll` a focus overlay; one written for 0.3.x fails without them ([migration](https://github.com/ashiqrniloy/liveframe/blob/v0.4.0/docs/migration-0.4.md#action-needed-your-own-design-system-for-starterui1)).
- **Your own icons:** `implementations` draws a small generic glyph set. Replace the `icon` binding with your registry.

The starter ships no capabilities: actions and sources are your app's.
