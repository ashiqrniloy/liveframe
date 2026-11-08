# @arnilo/liveframe-starter

A starting point for a [Liveframe](https://github.com/ashiqrniloy/liveframe) host: a reference catalog, React implementations, three themes and a design system that pass every conformance suite. **Copy it or extend it; it is not part of the core contract.** The core package ships no components (spec §3) — this one is an app's worth of them, so you can see the pieces working before you write your own.

Requires Bun ≥ 1.4.2, `@arnilo/liveframe` `~0.3.0`, React 19 and `react-aria-components`.

```sh
bun add @arnilo/liveframe @arnilo/liveframe-starter react react-dom react-aria-components
```

```tsx
import { Surface } from "./surface"; // createRenderer({ catalog, implementations }).Surface
import { catalog, implementations, themes, designSystem, styles } from "@arnilo/liveframe-starter";
```

| Export | What it is |
| --- | --- |
| `catalog` | `starter.ui@1`: 25 generic primitives (below), validated. Its source of truth is `catalog.json` (`@arnilo/liveframe-starter/catalog.json`), which `liveframe gen` and the MCP config read |
| `implementations` | One React implementation per kind, built on React Aria Components. Pass them to `createRenderer({ catalog, implementations })` |
| `themes` | `starter-light`, `starter-dark`, `starter-high-contrast`. Colours live only here (law 3) |
| `designSystem` | `starter@1.0.0`: values and recipes for every kind. A `tone` axis on `button` (`neutral`, `critical`) is two role aliases, not product variants; the `sheen` extension property shows how an app adds a look the library does not name |
| `styles()` | `{ base, primitives, themes, designSystem }`: the four sheets to serve, in that order. Each theme and design system scopes itself to the surface that names it, so all three themes load at once and a switch is an attribute change |
| `primitiveCss` | The trusted structural CSS (display, flex, minimum heights) the recipes deliberately leave out |
| `@arnilo/liveframe-starter/ui` | The generated widget components (`liveframe gen`): `import { Stack, Button } from "…/ui"` in widget TSX |
| `@arnilo/liveframe-starter/definitions` | The generated literal definitions `implement()` infers props from |

## The primitives

Layout `box` `stack` `inline` `grid` `scroll` `separator`; content `text` `hint` `heading` `icon` `image` `link`; controls `button` `textField` `select` `checkbox` `switch`; overlays `menu` `menuItem` `popover` `dialog` `tooltip`; navigation `tabs` `tab` `disclosure`. All are in the spec §5 primitive set except `hint` (secondary text a control can reference with `describedBy`, a node reference). There is no queue, card, metric or widget frame: if it can be built from primitives, it is widget code.

It uses the 0.3.0 features worth copying: node references (`textField.describedBy`), a variant axis with role aliases (`button.tone`), an extension property (`sheen`), and `url` rules on `link.href` and `image.src` (`https` or relative).

## Conformance

`catalogSuite`, `designSystemSuite({ contrast: true })` for all three themes, `rendererSuite` and `rendererBrowserSuite` run against it in Chromium, Firefox and WebKit in this repository's CI (`packages/starter/src/__tests__`). Use those tests as the template for your own host.

## Extending it

- **A new kind:** add it to `catalog.json`, run `liveframe gen` (twice: components and `--implementations`), add recipes for it and an `implement(…)` binding. The suites tell you what is missing.
- **Your own look:** keep the catalog and replace `themes` and `designSystem`; the recipes name roles, so a theme swaps colours without touching them.
- **Your own icons:** `implementations` draws a small generic glyph set. Replace the `icon` binding with your registry.

The starter ships no capabilities: actions and sources are your app's.
