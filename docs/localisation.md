# Localisation

Liveframe ships no formatter and no message catalogs. The host knows the viewer's language, so
the host passes it in and a widget draws text it was given. This guide shows how locale,
direction and time zone reach a widget, where translated text comes from, and what stays
deterministic. [Spec §7.1](spec.md#71-widgets) states the rules.

## Pass the locale through `context`

A widget is pure, so it cannot read the browser's language or the clock. Anything that varies per
viewer arrives as an input, and for locale that input is `context`. Three keys are conventions,
not reserved names; declare the ones the widget uses in the manifest's `context` schema:

```ts
context: { locale: "de-DE", direction: "ltr", timeZone: "Europe/Berlin" }
```

```json
"context": {
  "type": "object",
  "properties": {
    "size": { "type": "string", "enum": ["small", "medium", "large", "full"] },
    "locale": { "type": "string", "maxLength": 35 },
    "direction": { "type": "string", "enum": ["ltr", "rtl"] },
    "timeZone": { "type": "string", "maxLength": 64 }
  },
  "required": ["size"],
  "additionalProperties": false
}
```

Schemas forbid `pattern`, so a `maxLength` or an `enum` bounds each value. Optional properties
stay optional: a host that sends no `locale` still renders.

## Let the host format

The reliable way to localise is to hand the widget finished text. Dates, numbers, plurals and
messages are data, and data comes from the host through a source ([spec §7.1](spec.md#71-widgets)).
Bind the source's `locale` parameter to `context.locale`:

```json
"sources": {
  "checked": { "source": "queue.checked", "params": { "locale": { "from": "context", "path": "locale" } } }
}
```

```ts
bindSources(manifest, capabilities, { context: { size: "full", locale: "de-DE" } });
// { checked: { source: "queue.checked", params: { locale: "de-DE" } } }
```

An absent `context.locale` omits the optional parameter, and the source answers in its default
language. The host resolves `queue.checked` as the viewer, formats the time with its own
tooling and returns `"28.09.2026 14:02 UTC"`; the widget draws `Checked ${data.checked}` and has
no locale code at all. The proof widget's `localised` scenario is exactly this.

The same pattern covers **message catalogs**: a source such as `messages.get` takes `locale` and
a list of keys and returns `{ "claim": "Übernehmen", "claiming": "Wird übernommen…" }`. The
widget reads `data.messages.claim`. Catalogs then stay with the host's translation pipeline, are
cached by the host, and need no library support. Plain text from a source is validated like any
other data, so a translator's mistake cannot reach the tree as anything but a string.

## What stays deterministic

The tree is a function of `params`, `state`, `data`, `context` and `actions`, so the same inputs
give the same tree and the same [`renderKey`](spec.md#8-interaction-synaptas-three-tiers). That
holds for every widget that only draws what it is given, and for every [template widget](templates.md):
templates have no locale-dependent operator, so their output is the same on every runtime.

A widget that calls `Intl.DateTimeFormat`, `Intl.NumberFormat`, `toLocaleString` or
`localeCompare` formats with the locale data of the runtime it runs on. ECMA-402 leaves which
locales exist and how they are formatted implementation-defined, and output differs between
engines and platform builds. Such a widget is deterministic only within one runtime build. If you
cache renders across runtimes (a worker pool with mixed builds, or a cache shared with another
host), do not trust the `renderKey` for these widgets; format in the host instead.

## Right-to-left

Direction is the host's. Set `dir="rtl"` on the element that holds the surface (or the document)
and the layout mirrors: left and right padding, margin and border widths project to logical
inline start and end ([spec §6.2–§6.3](spec.md#62-design-system-values-and-recipes),
[styling guide](styling.md)), while top and bottom stay physical. Author with those props and
the widget needs no direction logic. Pass `context.direction` only when the widget changes
content with it, such as choosing a mirrored icon name.

## Check translations at larger text

Translated text is rarely the same length. German often runs 30% longer than English, and
users also scale text. A capture with `--text-scale 1.5,2` renders each scenario at larger root
font sizes ([preview guide](preview.md#capture-media-variants)), so a translated scenario that
clips or overflows shows up in the screenshot and the accessibility snapshot. Capture does not
set the locale; the scenario's `context` does, so add one scenario per locale you ship.

```sh
liveframe preview capture <url> --scenario ready,localised --text-scale 1,1.5,2 --out ./captures
```
