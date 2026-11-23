# @arnilo/liveframe-a2ui

Convert an [A2UI](https://a2ui.org) v0.9 or v0.9.1 surface to [Liveframe](https://github.com/ashiqrniloy/liveframe) element JSON through a mapping you write. An agent that speaks A2UI can then draw with your catalog, your design system and your validator.

Requires Bun ≥ 1.4.2 and `@arnilo/liveframe` `~0.4.0`. It has no other dependency.

```sh
bun add @arnilo/liveframe @arnilo/liveframe-a2ui
```

```ts
import { compileValidator } from "@arnilo/liveframe";
import { ephemeralManifest, renderElements } from "@arnilo/liveframe/sdk";
import { fromA2ui } from "@arnilo/liveframe-a2ui";

const converted = fromA2ui(jsonl, mapping); // JSONL text, or the parsed messages
if (!converted.ok) return reply(converted.errors); // pointers into the A2UI input
const { elements, initialLocal, origins } = converted.value;

const manifest = ephemeralManifest({ catalogId: catalog.catalogId, actions: ["tasks.claim"], local, initialLocal });
const validator = compileValidator({ catalog, capabilities, manifest });
const tree = renderElements(elements, { validator, surfaceId: "chat", revision: 1 });
```

**The converter does not validate.** It checks the A2UI document's shape and writes element JSON. Kinds, props, bounds, URLs, actions and `local` keys are checked by `renderElements` against your compiled validator, as for any element JSON an agent writes, and the surface core checks the tree again on arrival. Treat the A2UI input as hostile: it is.

## What it reads

One surface, as a snapshot: one `createSurface`, any number of `updateComponents` (merged by `id`, later replacing earlier) and `updateDataModel` (applied in order). The tree starts at the component with id `root`. Each A2UI `id` becomes the element `key`, so ids stay stable when you convert again.

- **Data paths** (`{ "path": "/user/name" }`) are read from the data model at conversion. Inside a template, a relative path resolves against the item.
- **`formatString`** over data paths (`"Hello, ${/user/name}"`) is substituted at conversion. `\${` is a literal `${`.
- **Templates** (`{ "componentId": "row", "path": "/tasks" }`) expand once per item, at most 1,000, keyed `row-0`, `row-1`, ….
- **Inputs**: a component whose mapping names `input` and whose value is a path listed in `mapping.local` gets `bind` plus a `setLocal` event, so the browser filters or edits without a round trip. `initialLocal` holds the starting values; the `local` schema is yours, passed to `ephemeralManifest`.
- **Actions**: `action.event.name` must be in `mapping.actions`. Literal `context` values become `args`; a context path listed in `mapping.local` becomes `fromLocal`, read when the user acts.

## What it refuses

Every refusal is a typed error with a pointer into the input. Nothing is dropped silently.

| Construct | Error | Why |
| --- | --- | --- |
| Client functions other than `formatString` over data paths, in values, `${…}` or `context` | `unknown-name` at `…/call` | Agent-chosen behaviour would run in the browser (law 1) |
| `action.functionCall` | `invalid-document` | Same |
| `theme` on `createSurface` | `invalid-document` | Style comes from your design system (law 3) |
| `svgPath` anywhere | `invalid-document` | Drawing data from the agent (law 3); icons are yours |
| `sendDataModel: true` | `invalid-document` | State reaches the host only through declared intents (law 4) |
| `weight`, `checks` | `unknown-name` | No catalog meaning |
| A context path not in `mapping.local` | `unknown-name` | Resolving it now would send a stale value as the user's input |
| `deleteSurface`, a second surface or `createSurface` | `invalid-document` | One snapshot; surface lifecycle is your host's |
| A component referenced twice, a cycle, or one not reachable from `root` | `invalid-document` | One tree, nothing unused |
| A component, property, variant or event the mapping does not name | `unknown-component` / `unknown-name` | Your mapping is the allowlist |
| A version other than `v0.9` or `v0.9.1` | `invalid-document` at `/<i>/version` | |

`mapping.drop` may list `"theme"`, `"weight"` and `"checks"` to discard them knowingly.

Input has limits of 4 × `limits.bytes` characters, 8 × `limits.nodes` JSON values, and JSON depth 128. Data paths have at most 128 segments. An array write can replace an existing index or append at its length. The converter rejects indices that would leave gaps and budgets 8 × `limits.nodes` value writes across all data updates, including copied members. Element output is bounded by `limits.nodes` and `limits.depth`. All `formatString` results together have a budget of 4 × `limits.bytes` characters. Exceeding a bound returns `limit-exceeded`.

## Origins

`origins` maps element pointers (nodes, props, variants, events, binds) to the A2UI pointer that produced them, so you can answer the agent in its own terms:

```ts
const origin = (pointer: string): string | undefined => {
  for (let p = pointer; ; p = p.slice(0, p.lastIndexOf("/"))) {
    if (origins[p] !== undefined) return origins[p];
    if (p === "") return undefined;
  }
};
```

## A mapping for `@arnilo/liveframe-starter`

The package exports no mapping, so it never depends on a catalog. This one maps the A2UI v0.9 basic catalog onto the starter's primitives; the tests in `src/__tests__` run it.

```ts
import type { A2uiMapping } from "@arnilo/liveframe-a2ui";

export const mapping: A2uiMapping = {
  catalogId: "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json",
  components: {
    Column: { kind: "stack" },
    Row: { kind: "inline" },
    List: { kind: "stack" },
    Card: { kind: "box", variants: { default: "plate" } },
    Divider: { kind: "separator" },
    Text: { kind: "text", props: { text: "text" }, variants: { body: "default", caption: "default" } },
    Image: { kind: "image", props: { url: "src", "accessibility.label": "alt" } },
    Button: {
      kind: "button",
      lift: { child: "label" }, // the starter's button takes a label, not a child
      variants: { default: "default", primary: "primary", borderless: "ghost" },
      event: "onPress",
    },
    TextField: { kind: "textField", props: { label: "label", value: "value" }, input: { prop: "value", event: "onChange" } },
    CheckBox: { kind: "checkbox", props: { label: "label", value: "checked" }, input: { prop: "checked", event: "onChange" } },
    Tabs: {
      kind: "tabs",
      props: { "accessibility.label": "label" },
      items: { tabs: { kind: "tab", props: { title: "label" }, child: "child", index: "value" } },
    },
  },
  actions: { claim: "tasks.claim", search: "tasks.search" },
  local: { "/filter": "q" },
};
```

A component's fields:

| Field | Meaning |
| --- | --- |
| `kind` | The catalog kind |
| `props` | A2UI property, or `accessibility.<field>`, → catalog prop |
| `variants` | A2UI `variant` value → catalog variant |
| `children` | Properties holding a `ComponentId`, a list of them, or a template, in child order (default `["children", "child"]`) |
| `lift` | A `ComponentId` property → catalog prop that takes the referenced component's `text` (that component may carry only `text`) |
| `items` | An array-of-objects property (`Tabs.tabs`) → `{ kind, props, child, index }`: the element each item becomes, the field naming its child, and a prop that gets the item's position |
| `event` | The catalog event an A2UI `action` attaches to |
| `input` | `{ prop, event }`: the two-way bound value and its change event |

Children come in `children` order, then `items`. Not covered here, because the starter has no matching primitive: `Icon` (your icon registry), `Video`, `AudioPlayer`, `Modal`, `DateTimeInput`, `ChoicePicker` and `Slider`. Add them when your catalog has a kind for them.

## Not covered

Converting a stream incrementally, A2UI v1.0, and v0.8 are not supported. The component mapping, the `local` schema, transport and surface lifecycle stay your app's.
