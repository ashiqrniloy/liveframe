# Render validated trees with React

`@arnilo/liveframe/react` draws a UI tree with your app's primitive implementations.
It ships no primitives, behaviour library or visual style. Widget code runs on the
backend; the browser receives JSON trees and intent data. Use React and React DOM
matching the package's peer requirements (`^19.0.0`).

Your host supplies a catalog, implementations for every kind, the widget's manifest
and app capabilities, and theme/design-system CSS. Read [the model](model.md) for
ownership and [styling](styling.md) for generating and loading the three sheets.

Use the [conformance guide](conformance.md) to test your implementations with
server and browser cases, including the app-owned page and required fixtures.

## Build a renderer and mount a surface

This example uses your app's `vocabulary.json`, the token vocabulary shared by its
catalog and design systems (see [styling](styling.md)). The remaining documents are
small enough to show in full. In a real host, load the installed catalog,
capabilities and manifest, and receive `tree` from your backend. The literal tree
here shows the wire format without running a widget in the browser.

```tsx
import { type Catalog, compileValidator, defineComponent, type Intent, obj, str, type UiTree } from "@arnilo/liveframe";
import { createRenderer, implement } from "@arnilo/liveframe/react";
import vocabulary from "./vocabulary.json" with { type: "json" };

export const button = defineComponent({
  kind: "button",
  description: "Requests an operation.",
  props: obj({ label: str({ maxLength: 80 }) }),
  children: "none",
  variants: ["default"],
  defaultVariant: "default",
  slots: ["root", "label"],
  events: { onPress: { carries: "none", description: "Pressed." } },
  styleProps: [],
  a11y: { role: "button", name: "label" },
});
export const catalog = {
  format: "liveframe-catalog/1",
  catalogId: "acme.ui@1",
  description: "App primitives.",
  vocabulary,
  definitions: [button],
} as const satisfies Catalog;
export const capabilities = {
  format: "liveframe-capabilities/1",
  sources: {},
  actions: { "tasks.claim": { description: "Claim a task.", args: obj({ id: str({ maxLength: 128 }) }) } },
};
export const manifest = {
  format: "liveframe-manifest/1",
  id: "claim",
  version: "1.0.0",
  catalogId: catalog.catalogId,
  params: obj({}),
  state: obj({}),
  context: obj({}),
  initialState: {},
  sources: {},
  actions: ["tasks.claim"],
};

const Button = implement(button, ({ props, slot, style, emit }) => (
  <button type="button" className={slot("root")} style={style} onClick={() => emit("onPress")}>
    <span className={slot("label")}>{props.label}</span>
  </button>
));
const { Surface } = createRenderer({ catalog, implementations: [Button] });
export const validator = compileValidator({ catalog, capabilities, manifest });
export const tree: UiTree = {
  format: "liveframe/1",
  catalogId: catalog.catalogId,
  surfaceId: "claim-panel",
  revision: 1,
  root: {
    id: "root",
    kind: "button",
    props: { label: "Claim" },
    events: { onPress: { type: "action", name: "tasks.claim", args: { id: "t1" } } },
  },
};
export const identity = { id: "acme", version: "1.0.0" };

export function GuideSurface({ tree, onIntent }: { tree: unknown; onIntent: (intent: Intent) => void }) {
  return (
    <Surface
      tree={tree}
      validator={validator}
      theme={identity}
      designSystem={identity}
      onIntent={onIntent}
      fallback={<p>Unavailable</p>}
    />
  );
}
```

Create the renderer once, outside React rendering. It validates the catalog and
checks the entire registry at startup. Every catalog kind needs exactly one
binding. A missing or duplicate binding, a kind outside the catalog, or a binding
whose definition differs from the catalog throws a `RendererError`. Its `errors`
array contains `LiveframeError` entries with `kind`, JSON-pointer `pointer` and
`message`; registry discrepancies use `catalog-mismatch`. Invalid catalogs retain
the catalog validator's errors. Object key order does not affect comparison.
`RendererError` is a runtime export from `@arnilo/liveframe/react` that extends
`LiveframeFailure`, so `instanceof` works and the host catches it with the same
handler as every other install failure; report `error.errors`.

`compileValidator({ catalog, capabilities, manifest })` validates those documents
and compiles the arrival checks. Reuse it while the installed documents stay the
same. Use the same catalog as the renderer and replace the validator when the
widget's manifest or capabilities change. **Send the manifest to the browser**
alongside the catalog and capabilities so it can independently re-check arrivals.
Before transfer, use `capabilitiesFor(capabilities, manifest)` from the root
export and send its successful `value` as the capabilities document. It removes
operations the manifest does not name while preserving validator behaviour;
handle its typed errors before sending. See [capability pruning](formats.md#capabilities).
Backend validation does not replace browser validation: the transport is untrusted.

Mount `<GuideSurface tree={tree} onIntent={sendIntent} />` in your app's React root;
`sendIntent` is your host transport, described below. Load the matching CSS before
displaying it. The example's server markup includes:

```html
<button type="button" class="lf_button_default_root"><span class="lf_button_default_label">Claim</span></button>
```

`Surface` surrounds that root with its own wrapper and adds a sibling empty portal
container. Both carry `lf_surface`, `data-lf-theme="acme@1.0.0"` and
`data-lf-ds="acme@1.0.0"`; the portal also carries `data-lf-portal=""`.
Responsive trees add `lf_container` to both scope containers. Node slots and
parents of responsive nodes do not gain container classes. Mount multiple surfaces
as siblings; surfaces must not nest.

Preview surfaces pass an optional `diagnostics` array of `LiveframeError`s. This
adds a `display: contents` wrapper per node with `data-lf-node`, and
`data-lf-error` when an error names that node. Ordinary surfaces omit this prop.
Diagnostic wrappers add no layout box, but remain elements for CSS child
selectors; host structural CSS must account for them when using preview.

Every new tree is checked before any field, including its revision, is read.
An invalid tree displays only `fallback` inside the wrapper; none of its nodes
reach implementations. For a valid tree with the same `surfaceId`, a lower
`revision` is ignored. A different surface replaces the current one. Nodes are
keyed by `id`, preserving focus, scroll and local state when their React identity
and ancestry remain stable. Replace tree objects when data changes: validation is
memoized on tree and validator identity, so mutating an existing tree is unsupported.

## Write primitive implementations

`implement(definition, Component)` creates an opaque binding for `createRenderer`.
With a literal `defineComponent` definition, TypeScript infers props from its
schema, slot names from `slots`, and event names and values from `events`.
JSON-loaded definitions use `Record<string, Json>` props and string names; an
explicit `implement<Definition, MyProps>` type argument can narrow their props.
Runtime arrival validation still establishes the contract.

| Input | What your component does with it |
| --- | --- |
| `props` | Read validated data; produce accessible native elements or app behaviour components. |
| `slot(name)` | Attach its stable recipe class to that slot. An undeclared name throws. The root slot also includes style-prop classes. |
| `style` | Forward the projected inline declarations to the primitive root. These contain token-constrained layout, not arbitrary widget CSS. |
| `emit(event, value?)` | Report the declared event with its carried value; do not invent or dispatch an action yourself. |
| `children` | Render the already rendered child nodes once for an ordinary container. |
| `items` | For collections, use each child's context: `id`, `kind`, `variant`, `props`, `slot`, `style`, `children`, `emit` and `render()`. |
| `portal` | Use this surface's scoped overlay container after mount; it is initially `undefined`. |

A collection can call `item.render()` to draw the child's implementation, or use
its slots, props and rendered children to build collection-specific parts such as
a tab and its panel. Use `item.id` as the key for parts you map yourself, and
`item.emit(...)` for that item's event. Drawing both `children` and `items.map(item
=> item.render())` would duplicate the children.

Forward `slot("root")` and `style` to the primitive root; attach other slot classes
to their corresponding elements. Keep classes unchanged across states, themes and
design systems. Colours and typography come from theme roles and recipes, not
widget props or ad hoc CSS. App CSS may provide primitive structure; see
[the styling contract](styling.md#renderer-contract).

Expose states through native semantics or this selector table, shared with the
styling contract:

| State | Matching selectors |
| --- | --- |
| hover | `:hover` on hover-capable devices; `[data-hovered]` on any device |
| active | `:active`, `[data-pressed]` |
| focus | `:focus-visible`, `[data-focus-visible]`, `:has(:focus-visible)` |
| open | `[open]`, `[data-open]`, `[data-expanded]`, `[aria-expanded=true]`, `:popover-open` |
| selected | `[data-selected]`, `[aria-selected=true]`, `[aria-checked=true]` |
| invalid | `:user-invalid`, `[data-invalid]`, `[aria-invalid=true]` |
| disabled | `:disabled`, `[data-disabled]`, `[aria-disabled=true]` |

Presence attributes such as `data-disabled` must be absent when false: the string
`"false"` still matches. ARIA attributes must describe the actual accessible
state. Keep the root class on the primitive root so states reach descendant slots.
State precedence is `rest < hover < focus < active < open < selected < invalid < disabled`.
A behaviour library can handle accessibility and state attributes; Liveframe does
not supply that behaviour.

## Handle intents at the host boundary

There are three interaction tiers. Typing drafts, opening menus and other local
primitive state stay inside the implementation without calling `emit`. A committed
`setState` requests a widget re-run. An action requests an app operation. One event
carries at most one intent.

`emit` only raises an intent present on that node's event map; an absent event is
a no-op. For an offered event, its value must match `carries`: no value for `none`,
a string for `string`, a boolean for `boolean`, a finite number for `number`,
or a finite integer for `integer`. `NaN` and infinities throw and raise no
intent. `implement()` requires a TypeScript `number` for either numeric event.
A mismatch throws and raises nothing. Event-handler exceptions are implementation
bugs and are not caught by React render error boundaries.

For `carries: { object: schema }`, `emit` checks the whole payload against a
schema compiled once per definition event in the renderer factory. `implement()`
infers the payload type from that schema. Keep drafts local and collect all current
field values on submit; no earlier `setState` is needed.

`onIntent` receives a fresh, frozen, complete intent:

- `{ type: "setState", key: "reason" }` emitted with `"Ready"` becomes
  `{ type: "setState", key: "reason", value: "Ready" }`. An explicit value is preserved.
- `{ type: "action", name: "tasks.escalate", args: { id: "t1" }, bind: "reason" }`
  emitted with `"Ready"` becomes
  `{ type: "action", name: "tasks.escalate", args: { id: "t1", reason: "Ready" } }`.
  `bind` is removed.
- An action with `bindAll: true` merges the emitted object into its literal
  `args` and removes `bindAll`. The validator rejects literal/event key overlap
  and incompatible property types or required fields before the tree renders.
  Object `setState` replaces the whole key. Delivered objects are copied before
  freezing, so the primitive's local payload remains editable.

Your transport should associate the intent with the authenticated placement,
surface and accepted revision. **The host re-checks every intent on dispatch**:
reject stale revisions and intents not offered by the current tree; check the
manifest's state keys and action allowlist, the filled value/argument schemas,
and the user's authorization. Browser checks grant no authority.

For `setState`, the host updates placement state, re-runs the widget on the backend,
and returns a validated tree with a newer revision. Pass that new object to
`Surface`. For an action, authorize and dispatch through the app's capability
handler; refresh data and return a new tree only if needed. Never execute widget
code or privileged operations in the renderer.

## Switch themes and design systems

Preload and cache the next theme and design-system sheets using
[the CSS helpers](styling.md#generate-three-independent-sheets). Pass their
`{ id, version }` identities as new `theme` and/or `designSystem` props to the same
`Surface`. Both identities can change in one render.

`Surface` marks the wrapper and portal with `data-lf-switching`, changes both
scope attributes before paint, resolves the new styles, then clears the markers
on the next animation frame. Transitions are suppressed during the switch.
An open overlay switches with its surface. Node identities, slot classes and
widget output stay the same; no widget code runs. Keep the tree, validator,
callback and fallback identities stable for style-only updates. The host still
owns theme selection and loading the corresponding sheets.

## Map layout semantics to elements

A layout primitive's `semantics` value picks its element or role. The reference
mapping is `form` → `<form aria-label={label}>` with native submit prevented,
`group` → `role="group"`, `figure` → `<figure>`, `status` → `role="status"` and
`alert` → `role="alert"`. A `form` is exposed as a landmark only with a `label`;
the validator does not require one.

Live regions must stay mounted: a screen reader announces a change inside an
existing `status` or `alert`, not a region that appears with its text.
Id-keyed reconciliation keeps a node mounted while its `id` and ancestry are
stable, so change the text of the same node rather than replacing it with one
that has a new id. Do not wrap such an implementation in a conditional that
unmounts the region.

## Keep overlays scoped and accessible

An overlay may use the browser's top layer while retaining DOM ancestry, or
portal into the supplied `portal` element. Do not portal into `document.body`:
it loses the surface's theme, typography and responsive scope. For portals,
return no overlay until `portal` exists; pass it to your app's behaviour library
or React's `createPortal(content, portal)`. The container exists only after mount.

Keep backdrop and overlay content as siblings. No backdrop ancestor may set
opacity below 1 or a filter that creates a backdrop root and prevents the
backdrop sampling the page behind it.

Your implementation owes the complete lifecycle: accessible naming, keyboard
operation, focus management and restoration, scroll locking, an inert background
while modal, exit motion and delayed unmounting until that motion finishes.
Reduced motion must skip the animation and still complete cleanup. Entry styling
from recipes does not implement exit handling. A behaviour library such as React
Aria is recommended; verify these behaviours in a browser against your actual
implementations.

## Text input bounds count code points

Schema `maxLength` counts Unicode code points. Native HTML `maxlength` counts
UTF-16 code units: a non-BMP character such as many emoji uses two units. Relying
on it alone rejects valid strings early. Use a controlled local draft and check
`Array.from(nextValue).length <= limit` before accepting changes, then emit the
committed string on your definition's commit events. Preserve composition/IME
behaviour and avoid splitting surrogate pairs. Three emoji fit a code-point
limit of three; a fourth does not. Grapheme clusters may contain multiple code
points. The host independently checks the committed string against its schema.

## Server rendering and hydration

Use the same implementations, installed documents, tree, identities and fallback
on the server and first client render. Implementations must render without DOM
access. `portal` is `undefined` during server rendering and the first client
render, so portal overlays wait until mount.

On the server, React's error boundaries do not catch implementation failures.
Catch around `renderToString` and supply fallback markup:

```tsx
import { renderToString } from "react-dom/server";

let html: string;
try {
  html = renderToString(<GuideSurface tree={tree} onIntent={() => {}} />);
} catch (error) {
  reportError(error); // Your server's error reporter.
  html = renderToString(<p>Unavailable</p>);
}
```

`reportError` is host-owned. Insert `html` into your app's root using its normal
HTML response path. Transfer the tree and validator documents with your framework's
safe JSON serialization, and load the matching styles. For a successful server
render, the client hydrates that root:

```tsx
import { hydrateRoot } from "react-dom/client";

hydrateRoot(container, <GuideSurface tree={tree} onIntent={sendIntent} />, {
  onRecoverableError: reportError,
});
```

`container`, `sendIntent` and `reportError` belong to your host. Successful renders
and invalid-tree fallbacks hydrate with matching markup. If an implementation
threw on the server and you substituted the bare fallback, hydrating `Surface`
can report a recoverable mismatch and switch to client rendering. Do not treat
that replacement path as mismatch-free hydration. On the client, an implementation
render failure shows `fallback` at that node; healthy siblings remain visible.

React documents [error-boundary limitations](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
and [matching hydration output](https://react.dev/reference/react-dom/client/hydrateRoot#caveats).
The executable example is [renderer-guide.tsx](https://github.com/ashiqrniloy/liveframe/blob/main/src/__tests__/fixtures/renderer-guide.tsx);
its test checks that this page includes it verbatim, validates its tree and checks
server markup and invalid-tree fallback. Existing renderer browser tests exercise
hydration, state retention, overlays and switching.
