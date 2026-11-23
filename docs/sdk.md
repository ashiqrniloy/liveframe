# Writing widgets with the SDK

The SDK turns a synchronous TSX function into a validated JSON UI tree. Run it on
the app's backend or in the app's sandbox. The browser receives the tree and
draws it with the app's primitive implementations. The SDK supplies no visual
components or design system.

The package is pre-1.0. This guide covers the implemented SDK and `gen`
command; see the [package guide](packages.md) for packing, storage and runners. See the
[format guide](formats.md) for catalogs, capabilities, manifests and validation,
and [spec §7](spec.md#7-authoring-and-installing-synaptas-model) for the contract.

## Generate the app's components

Obtain the app's validated `catalog.json`, `capabilities.json` and widget
`manifest.json`. The manifest declares params, state, context, source bindings
and allowed action names. Validate these documents at installation before
compiling a validator; `compileValidator` expects validated documents.

Generate the components next to your widget:

```bash
bunx liveframe gen catalog.json --out ui.gen.ts
bunx liveframe gen catalog.json --out ui.gen.ts --check
bunx liveframe gen catalog.json --implementations --out ui.definitions.gen.ts
```

`--implementations` writes literal `as const` definitions instead of the
component module, one export per definition. Import them where the app implements
a primitive itself: `implement()` then infers props, slots, event names and carry
value types from the JSON catalog as it does from a hand-written
`defineComponent`. The file is app-side, never widget code (primitives are the
app's, §11); the generator imports no SDK and generates no implementation.
`--check` drift-checks either mode.

A host build service can generate the same modules without the CLI:

```ts
import { generate, generateDefinitions } from "@arnilo/liveframe/sdk/gen";

const components = generate(validatedCatalog);
const definitions = generateDefinitions(validatedCatalog);
```

Both take a validated `Catalog` and return the exact text of the corresponding
CLI mode. The subpath needs only ES2022, with no non-ECMAScript globals (see the [runtime matrix](spec.md#13-tech-stack-and-packages)).

The package installs this as the `liveframe` binary, so a project that depends on
it can run `liveframe gen catalog.json --out ui.gen.ts [--check]` directly.
`--check` never writes: it exits 0 for matching output and 1 for missing or changed output, reporting the
first differing line. Invalid catalogs, JSON, usage or file operations exit 2.
Put both check commands in your CI (`--check` per generated file); this repo
includes them in `bun run check`.

`liveframe gen` emits readonly tagged unions for `union(discriminator, mapping)`, including nested properties and array items. Narrow on the tag before reading a branch-specific field.

`liveframe gen` emits `| null` for schemas declaring `nullable: true`, including
nested object properties and array items. Required nullable props still have to
be supplied; omitting `nullable` or setting it to `false` keeps the original type.

`ui.gen.ts` is executable TypeScript source. It imports `primitive` from the SDK
and exports one component per catalog definition, with a PascalCase name and
the definition's description. Import it by relative path. Props are readonly;
variants, style vocabulary and responsive breakpoints are closed unions. Events
take intents, and primitives that forbid children have no `children` prop.
Numeric bounds and manifest-specific intent compatibility are runtime checks.
For example, `gap="13px"` and an unknown variant fail typechecking.

Use `"jsx": "react-jsx"` and `"jsxImportSource": "@arnilo/liveframe/sdk"` in your
TypeScript configuration, or the per-file directive shown below. React is not
needed to author or run these widgets.

## Write and render a widget

This complete example uses the repo's proof catalog, capabilities and
agent-home manifest, copied locally under the names above. Its inputs fit that
manifest; another app supplies its own schemas, vocabulary and primitives.
Save it as `widget.tsx` beside `ui.gen.ts` and run `bun widget.tsx`.

```tsx
/** @jsxImportSource @arnilo/liveframe/sdk */
import { compileValidator, LiveframeFailure } from "@arnilo/liveframe";
import { action, render, state, type WidgetProps } from "@arnilo/liveframe/sdk";
import manifest from "./manifest.json" with { type: "json" };
import capabilities from "./capabilities.json" with { type: "json" };
import catalog from "./catalog.json" with { type: "json" };
import { Button, Stack, Text } from "./ui.gen.ts";

export function Claim({ state: s }: WidgetProps<unknown, { selected: string }>) {
  return (
    <Stack gap="space.2">
      <Text text={s.selected} />
      <Button key="select" label="Select" onPress={state.set("selected", "t1")} />
      <Button key="claim" label="Claim" onPress={action("tasks.claim", { id: "t1" })} />
    </Stack>
  );
}

export const validator = compileValidator({ catalog, capabilities, manifest });
export const inputs = {
  params: { canAct: true, canEscalate: false, canViewAlerts: true },
  state: manifest.initialState,
  data: {},
  context: { size: "small" },
};
export const result = render(Claim, inputs, { validator, surfaceId: "home", revision: 1 });
if (!result.ok) throw new LiveframeFailure(result.errors);
// result.value is a validated UiTree containing primitives and intent data.
```

A validator works only with the library copy that compiled it: `render()`,
`renderElements()` and `renderTemplate()` given a wrapper object, or a validator
from a second bundled copy, throw `LiveframeFailure` with one `invalid-document`
error ("Expected a validator compiled by this copy of `compileValidator`").

`WidgetProps<P, S, D, C>` gives deeply readonly `params`, `state`, `data` and
`context`. A widget returns exactly one SDK element. Compose widgets with plain
TSX functions: they expand during `render()`, leaving only primitives in the
tree. `jsx` records a component without calling it. Elements, their props and
their children arrays are frozen; arbitrary nested prop objects are not
deep-frozen by JSX construction. Inputs and intent values are deep-frozen.
Text is a primitive prop such as `text="Hello"`; raw string children are invalid.

Compile once for a validated catalog/capabilities/manifest combination and reuse
the validator. `render(widget, inputs, options)` checks inputs, runs the widget,
and builds and validates nodes in one walk, followed by reference resolution. It returns `Result<UiTree>`:
`{ ok: true, value }` or `{ ok: false, errors }`. Each error has `kind`, `pointer`
and `message`, with `expected` and `nodeId` where applicable. Handle the failure
branch before using the tree; an invalid partial tree is never returned.

Options require `validator`, a nonempty `surfaceId` and a nonnegative integer
`revision`. Optional `limits` override `nodes` (default 5,000), `depth` (64,
root at depth 1) and `bytes` (1,048,576 UTF-8 JSON bytes). `maxErrors` defaults
to 20. Reaching that bound appends a `limit-exceeded` marker, so a bounded error
result can contain 21 entries with the default. Limits also bound component
expansion and nested child arrays. `render()` is synchronous; it cannot stop a
widget's infinite loop. The host owns execution isolation and time limits.

## Ephemeral surfaces from agent JSON

A chat agent can answer with a one-off surface as JSON instead of authoring a
package. `renderElements(json, options)` takes the same options as `render()` and
returns the same `Result<UiTree>`:

```ts
import { ephemeralManifest, renderElements } from "@arnilo/liveframe/sdk";

const json = {
  kind: "stack",
  props: {},
  children: [
    { kind: "text", props: { text: "Done" } },
    {
      kind: "button",
      key: "open",
      props: { label: "Open" },
      events: { onPress: { type: "action", name: "tasks.claim", args: { id: "t1" } } },
    },
  ],
};

const manifest = ephemeralManifest({
  catalogId: catalog.catalogId,
  actions: ["tasks.claim"],
  state: { selected: "t1" },
});
const validator = compileValidator({ catalog, capabilities, manifest });
const result = renderElements(json, { validator, surfaceId: "chat", revision: 1 });
```

Each element is `{ kind, key?, $anchor?, variant?, props?, style?, events?, when?, bind?, focus?, children? }`.
Intents use the tree's `TreeIntent` shape. `renderElements()` derives the same
key-path ids as `render()`, applies the same props, style, event, child, limit
and error checks in one walk plus reference resolution, and reports every error with a JSON pointer into
the input. A `fragment` element (`{ kind: "fragment", key?, children }`) groups
keyed children without adding a tree node.

`ephemeralManifest()` returns a manifest with fixed `id: "ephemeral"` and
`version: "0"`, empty params and context, and the state schema derived from the
initial `state` value. It is not stored. The host still validates the document
with `validateManifest()` and still re-checks the tree on arrival; an ephemeral
surface grants nothing.

### Live filters in agent JSON

An agent can ask for browser-side interaction (spec §8) with `when`, `bind` and
`setLocal`, as a TSX widget does with `local()` and `local.set()`. The `local`
schema and its starting values are yours, passed to `ephemeralManifest`; a
document can never declare them (`local` on an element is `invalid-prop`
"no such element field"), so an agent cannot choose its own bounds:

```ts
const manifest = ephemeralManifest({
  catalogId: catalog.catalogId,
  actions: [],
  local: obj({ q: str({ maxLength: 80 }) }),
  initialLocal: { q: "" },
});
const json = {
  kind: "stack",
  children: [
    {
      kind: "textField",
      props: { label: "Filter", value: "" },
      bind: { value: { $path: "local.q" } },
      events: { onChange: { type: "setLocal", key: "q" } },
    },
    {
      kind: "text",
      key: "t1",
      props: { text: "Write the report" },
      when: { $contains: [{ $path: "self.text" }, { $path: "local.q" }] },
    },
    { kind: "text", key: "empty", props: { text: "Nothing matches" }, when: { $eq: [{ $path: "shown" }, 0] } },
  ],
};
```

`local` and `initialLocal` come together, and `initialLocal` must fit `local`
(`TypeError` otherwise). Expressions, compound `local` writes on an intent and
`fromLocal` reads are checked exactly as for TSX: an undeclared key is
`unknown-name` with a pointer into the JSON (`/children/1/when/$contains/1/$path`).
Without `local`, an expression may read only `self` and `shown`. `when`, `bind`
and `focus` belong on the element, never inside `props`, `style` or `events`.

The typed form is `Elements<Catalog>`. To give an agent tool a JSON Schema,
generate one per catalog:

```sh
bunx liveframe gen catalog.json --elements-schema --out elements.schema.json
```

`generateElementsSchema(catalog)` from `@arnilo/liveframe/sdk/gen` produces the
same bytes. Pass the same `local` schema (`--local local.json`, or
`generateElementsSchema(catalog, { local })`) and the schema also describes
`when`, `bind`, the tree expression grammar and the local intents over your keys;
without it the schema is unchanged. The schema uses JSON Schema 2020-12, has the id
`urn:liveframe:elements:1`, and is drift-checked like the other generated files.
`/authoring` exposes no tool for this path; wire `renderElements()` into your own
agent tool.

### Describe the catalog to an agent

An agent that is not on MCP needs the catalog's facts in its prompt. The digest is
one Markdown file with them, at about a quarter of the element schema's size: how
to write element JSON (with an example built from your catalog's own kinds), each
kind's props with their bounds, variants, events and what they carry, child rules,
style values, and, when you pass them, your actions and sources and the expression
grammar over your `local` keys:

```sh
bunx liveframe gen catalog.json --digest --capabilities capabilities.json --local local.json --budget 20000 --out catalog.digest.md
```

`generateDigest(catalog, { capabilities, local, budget })` from
`@arnilo/liveframe/sdk/gen` returns the same text. The bytes depend only on the
documents (`--check` catches drift). It never holds file paths, theme or
design-system values, recipes or capability `meta`; to leave an action out, pass a
capabilities document without it. Over `budget` characters it throws
`LiveframeFailure` (`limit-exceeded` at `/digest`; the CLI exits 1) instead of
cutting the text. Nothing an agent writes from it is trusted: `renderElements` still
validates the document. `@arnilo/liveframe-starter/catalog.digest.md` is the
starter's, without capabilities or `local`.

A *template widget* (data-bound, installable, no sandbox) has its own
per-catalog schema, `liveframe gen catalog.json --template-schema`; see
[template widgets](templates.md#a-json-schema-for-the-model).

### Convert an A2UI document

An agent that speaks [A2UI](https://a2ui.org) (v0.9 or v0.9.1) can draw through
`@arnilo/liveframe-a2ui`, a separate package. `fromA2ui(messages, mapping)` turns one
surface into element JSON through a mapping you write (A2UI component to your kind,
property to prop, action name to your action). It checks only the A2UI document's
shape and refuses what it cannot map with a pointer into the input; kinds, props,
bounds, URLs and actions are checked by `renderElements` like any element JSON, so a
converted action must still be in your manifest. See the
[converter's guide](https://github.com/ashiqrniloy/liveframe/tree/main/packages/a2ui#readme)
for the mapping, the refusal table and a worked starter mapping.

## Draw agent JSON while it streams

An agent that writes element JSON token by token can be drawn before it finishes.
`streamElements({ validator, surfaceId })` returns `{ push, end }`. Feed it each
chunk of the text; it returns a new tree whenever the nodes completed so far
changed (and `undefined` when they did not), numbered `revision + 1`, `revision + 2`,
and so on. That is about one tree per closed node, far more than a screen can show,
so the loop below keeps only the newest tree and sends at most one update per frame,
plus the final tree after `end()`. `now` is your clock (`() => performance.now()`
on a server); the loop starts no timer:

```ts
import { diffTrees, type UiTree } from "@arnilo/liveframe";
import { streamElements } from "@arnilo/liveframe/sdk";

const FRAME_MS = 16; // at most one update per display frame
const stream = streamElements({ validator, surfaceId: "chat-42" });
let latest: UiTree | undefined; // the newest tree; most are never sent
let shown: UiTree | undefined; // the tree the client holds
let sentAt = Number.NEGATIVE_INFINITY;
const flush = () => {
  if (!latest || latest === shown) return;
  const patch = shown && diffTrees(shown, latest);
  send(patch?.ok ? { patch: patch.value } : { tree: latest });
  shown = latest;
  sentAt = now();
};
for await (const chunk of llm) {
  const next = stream.push(chunk);
  if (!next) continue; // nothing new has completed
  if (!next.ok) break; // malformed JSON or a limit: `next.errors` says where
  latest = next.value;
  if (now() - sentAt >= FRAME_MS) flush();
}
const final = stream.end(); // the same result `renderElements` gives the whole text
if (final.ok) send({ tree: final.value });
```

Every tree `push` returns has passed the compiled validator, and the client still
validates each update it receives, so dropping the trees between frames never
sends an unvalidated one. A patch that `diffTrees` cannot make is sent as the whole
tree, so the client never falls behind `shown`. After a failure the loop sends
nothing more.

A tree holds each node whose object has closed and passed every check
`renderElements` makes, and the shells of the nodes still open (their own fields
are in; their `children` are arriving). A half-written node, and the siblings after
it, are left out until it closes, and a shell that the catalog's child rules would
reject yet (a `list` that needs an item, before the first item closes) waits for its
first valid child. Every tree is a validated tree, so `<Surface tree={shown}>` can
draw each one, and successive trees are valid inputs to `diffTrees`, so the loop
above can send a patch from any tree it sent to any later one.

Things to know:

- **Order.** Progressive drawing needs `children` after the element's other members,
  which is the order `generateElementsSchema` gives. A member written after
  `children` stops further trees for that stream; `end()` is still exact.
- **Invalid nodes.** A node that fails its checks is left out of the trees, not fatal.
  `end()` returns the errors, as `renderElements` would, with pointers into the text.
- **References.** A node with a `$ref` is drawn when the text ends, when the reference
  can be resolved.
- **Expressions.** A shell carries its own `when` and `bind`, which are written before
  its `children`, so a filtered list is drawn filtered from its first row.
- **Failure.** Malformed JSON is `invalid-document` at `/$stream/<offset>`, reported
  once the value that holds the fault closes. A tree past `limits.bytes`, `limits.nodes`,
  `limits.depth` or 10,000 expression nodes, or a text longer than four times `limits.bytes` characters, is
  `limit-exceeded`. After a failure `push` and `end` keep returning it; the stream
  holds nothing more.
- **Cost.** The work inside `streamElements` over a whole stream is linear in the
  text: about 2.8 times one `renderElements` of the same 679-node document fed in
  64-byte chunks (`bun run bench` gates it at 3 times). Each update the loop sends
  costs more than that: one `diffTrees` of two whole trees on the host, then one
  `applyPatch` and a validation of the whole tree in the client. Sending one per
  closed node makes the whole loop grow with the square of the document, which is
  why the loop sends per frame and not per tree.

## Sources that may be pending

A source the app declares with `sourceOutcome(result, { pending: true })` may
arrive as `{ status: "pending" }`: the host has not read it yet and will render
the widget again when it has. Narrow on `status` before reading `value`:
`Infer` of the source's `result` makes an unnarrowed read a compile error, and
includes `pending` only for sources that declare it:

```tsx
export default function Digest({ data }: WidgetProps<{}, {}, { digest: Infer<typeof digestResult> }>) {
  if (data.digest.status === "pending") return <Hint text="Counting…" />;
  return <Text text={data.digest.status === "ok" ? data.digest.value.summary : "Unavailable"} />;
}
```

## Lists longer than the node limit

A tree holds at most 5,000 nodes, and every node costs time on the host, the
wire and the browser. A list of 50,000 rows therefore draws only the rows
around the ones the user sees. The widget never measures anything: a
`scroll` primitive that windows reports the visible range, the range is
widget state, and the source reads only the rows around it. The starter's
`scroll` does this (the repository's `packages/starter/src/__tests__/windowed.tsx`
is the tested example):

```tsx
const range = obj({ start: int({ minimum: 0, maximum: 1_000_000_000 }), end: int({ minimum: 0, maximum: 1_000_000_000 }) });
const manifest = {
  // …
  state: obj({ range }),
  initialState: { range: { start: 0, end: 0 } },
  sources: {
    rows: {
      source: "rows.window", // the app's: { total, offset, rows } around [start, end), at most 200 rows
      params: { start: { from: "state", path: "range.start" }, end: { from: "state", path: "range.end" } },
    },
  },
};

export function WindowedList({ data }: WidgetProps<object, { range: Range }, { rows: Page }, object>) {
  const { total, offset, rows } = data.rows;
  return (
    <Scroll label="Rows" height="size.panel" itemCount={total} itemStart={offset} itemSize="size.row" onRange={state.set("range")}>
      {rows.slice(0, 200).map((row) => (
        <Inline key={row.id} height="size.row">
          <Text text={row.title} />
        </Inline>
      ))}
    </Scroll>
  );
}
```

- **`itemCount`, `itemStart` and `itemSize`** tell the primitive how many rows
  the collection has, which one the first child is, and the design value one
  row is tall. The implementation reserves the undrawn rows' space from that
  value in its own CSS, so the tree names no length (law 3). Without `itemSize`
  the scroll draws as before.
- **`onRange`** carries `{ start, end }`, the visible rows (end exclusive),
  when they come within `step` rows (default 20) of either edge of the drawn
  slice. `state.set("range")` stores it and the host renders again.
- **The source decides the window.** Bindings carry values, not expressions,
  so the app's source widens the visible range by its overscan, clamps it to
  the collection and to the row budget, and returns `offset`. The widget passes
  `offset` as `itemStart` and caps the slice.
- **Rows are the scroll's direct children, have stable keys and are exactly one
  `itemSize` tall.** A row present in two windows keeps its key-path id, so the
  patch between them holds only the rows that entered and left, and the browser
  keeps those rows' elements, focus and scroll position. Rows of varying height
  are the app's to handle.
- **Every window is a whole validated tree, and the range is state** the host
  checks against the manifest's schema like any `setState` value (law 2,
  law 4). The round-trip latency of a range change is the transport's; the
  overscan hides it for short scrolls.

## Intents and author constraints

An event prop carries one frozen intent, never a callback:

- `state.set("selected", "t1")` requests an explicit state value.
- `state.set("filter")` uses the event's carried value, for example a tab's
  `onChange`. It needs a compatible state schema and a value-carrying event.
- `action("tasks.claim", { id: "t1" })` requests an app operation. Arguments
  default to `{}` when omitted.
- `action("search", {}, { bind: "query" })` leaves `query` for the event to
  supply. The event must carry a compatible value, `query` must be declared by
  that action's argument schema, and `args` must omit the bound key. The app must
  declare and allow `search` before this intent can render.
- `action("escalate", { id }, { bindAll: true })` fills several arguments from
  one object event, such as a form's current local fields. Literal and event keys
  must not overlap, and `bind` cannot accompany `bindAll`. The validator checks
  property names, required fields and scalar types; `integer` can fill `number`.
  The host and Preview check bounds and enums after completion. An object event
  can also replace a whole object state key with `state.set("draft")`.
- An event that carries an array (a multi-select's `carries: { array: … }`)
  fills one array argument with `bind`, or a whole array state key with
  `state.set("picked")`, when the target's items take the carried scalar. It
  cannot use `bindAll` or fill `local`, which holds scalars only.

- `action("tasks.claim", { id }, { resultKey: "claim:" + id })` names the key
  the host reports this intent's status under. Without it the key is the action
  name. A widget reads the status from `actions`:

  ```tsx
  export default function Queue({ data, actions }: WidgetProps<Params, State, Data, Ctx>) {
    const claim = actions["tasks.claim"];
    return <Button label={claim?.status === "pending" ? "Claiming…" : "Claim"} onPress={action("tasks.claim", { id })} />;
  }
  ```

  `actions` is `{}` until the host reports something. Each entry has a `status`
  (`pending`, `ok`, `failed` or `refused`), and optionally `reason`, `at`, `action`
  and an `ok` `value` that matches the capability's `result` schema. Type a widget's
  `actions` with the fifth parameter of `WidgetProps`, using `ActionStatus<Value>`.

- `local.set("q")` writes the surface's local state from an event, and `when`
  and `bind` read it, so a filter over rows already in the tree needs no round
  trip. The manifest declares the state (`local`, `initialLocal`); the renderer
  applies the write and never calls `onIntent`. A `setState` or `action` intent
  can also carry `local` (1 to 4 writes, e.g. `local.set("saving", true, { until: "revision" })`),
  which the renderer applies before raising the host intent and strips from what the
  host sees; `{ until: "revision" }` undoes the write on the next accepted revision.
  To send values held in local state when an intent fires, pass `fromLocal`
  (`{ arg: "localKey" }` on `action`, up to 16 entries, or `"localKey"` on
  `state.set(key, undefined, { fromLocal })`); the renderer fills the values on
  `emit` and the host re-checks them against the capability or state schema:

  ```tsx
  <TextField label="Filter" onChange={local.set("q")} />
  <Button
    label="Save"
    onPress={action(
      "tasks.escalate",
      { id },
      { fromLocal: { reason: "q" }, local: [local.set("saving", true, { until: "revision" })] },
    )}
  />
  {rows.map((r) => (
    <Row key={r.id} when={ex.contains(r.title, local("q"))}>
      <Text text={r.title} bind={{ text: ex.concat(r.title, "!") }} />
    </Row>
  ))}
  ```

  `local(key)` and `self(prop)` build expressions (the node's own props are the
  `self` root), `shown()` reads how many siblings that carry a `when` are drawn
  (siblings that read `shown` are not counted, so `when={ex.eq(shown(), 0)}` is an
  empty state for a filtered list), and `ex` has one builder per operator an expression may use
  (`eq ne lt lte gt gte and or not cond coalesce len concat text contains slice add
  sub mul div round get at lit has omit`). A bare string, number or boolean is a
  literal operand; wrap an object or array in `ex.lit`. `when` and `bind` are node
  fields, not props, so a kind cannot declare props with those names. `bind`
  overrides a prop's static value (still sent in `props` as the fallback) and cannot
  reach `variant`, style props, events or `refProps` props. The validator and
  `render()` check each expression statically; `liveframe gen` types `when` and
  `bind` per prop. Expressions are data the renderer evaluates, never widget code.
- `focus` (a boolean, also a node field) marks the element a later revision moves
  focus to: `<TextField focus={state.adding} … />` puts that node's id on the tree's
  `focus`. Mark at most one element (a second is `duplicate-key`), never one under a
  `when` (`invalid-prop`); `false` marks nothing. Element JSON takes the same
  `focus: true` field. The renderer moves focus only when the mark changes between
  revisions, never on the first tree.

The helpers produce data; they do not update state or dispatch actions. They
reject functions, promises, class instances, cycles and non-finite numbers with
a `TypeError` naming the offending path. A helper exception inside the widget is
reported as `render-failed`. The compiled validator checks state keys and values,
events, action permissions and argument schemas against the app's declarations.

The four laws apply directly to authors:

1. Widget code runs on the backend; the browser gets validated data.
2. Return catalog primitives and valid props; the tree must pass validation.
3. Use declared style names, roles and variants. Raw CSS, colours, `className`
   and string `style` props are rejected; the app's theme owns colours.
4. Request actions through intents. The app retains authorization, data access,
   state ownership and dispatch authority. A manifest is not a grant of authority.

## Stable ids and deterministic inputs

The root id is `root`. Each child adds its key, or otherwise its primitive kind:
the example produces `root/text`, `root/select` and `root/claim`. Give every list
item a stable, nonempty key. Unkeyed siblings of the same kind are also an error.
Reordering keyed items preserves their ids. A key can be a bounded string or a
finite number; the encoded segment preserves colons (`row:4812`) and escapes
slashes, spaces and Unicode characters.

An unkeyed fragment adds no node or path segment. A keyed fragment scopes its
children's paths without emitting a node; a keyed composed component that
returns a fragment preserves that scope. Fragments may group children, but the
expanded widget still needs exactly one primitive root.

Widgets must be pure and synchronous. Supply time and randomness through
`context`; do not read clocks, random generators or external mutable state.
Locale, direction and time zone come the same way (`context.locale`, `direction`,
`timeZone`), and text is best formatted by the host and passed as data: a widget
that calls `Intl` is deterministic only within one runtime build. See the
[localisation guide](localisation.md).
The same widget, inputs and render options give byte-identical serialized trees,
including across fresh validators. Changing `revision` changes the tree envelope.

All four input fields are checked every render and copied during the JSON walk.
The widget receives deeply frozen copies, including the input envelope; caller objects remain untouched.
Mutable data is rechecked even when its identity is reused. Proven deeply frozen inputs may reuse checked frozen copies under the same schema. Supply plain JSON value
properties, not accessors. The cache remembers which compiled validator
accepted the object, so another validator with a different source-schema
contract checks the same object again. It does not cache the tree or skip widget
execution.

Input failures have pointers such as `/state/filter`, use `invalid-prop`, have
no `nodeId`, and prevent widget execution. Node errors use paths such as
`/root/claim/props/label`, based on ids rather than child positions.

## Render errors

These examples use the proof primitives from above. Invalid TSX is deliberately
shown here as inline examples: generated types reject many cases before runtime.

| Kind | Example that fails | Repair |
| --- | --- | --- |
| `host-element` | `() => <div />` | Use a generated primitive. |
| `unknown-component` | `primitive("nope")` used as a tag | Use a kind in the catalog; composed functions must return SDK elements. |
| `invalid-prop` | `<Text />` | Supply required `text`; also check input schemas, style names and prop types. |
| `invalid-children` | `<Text text="a"><Text text="b" /></Text>` | Follow the primitive's child rules; return one root. |
| `missing-key` | `<Stack><Text text="a" /><Text text="b" /></Stack>` | Give repeated same-kind siblings distinct keys, including static siblings and array items. |
| `duplicate-key` | Two sibling `<Text key="a" text="a" />` elements | Use distinct sibling keys. |
| `undeclared-event` | A button with `onHover={action("tasks.claim", { id: "t" })}` | Use an event declared by the definition. |
| `undeclared-action` | `<Button label="a" onPress={action("nope", {})} />` | Declare and allow the action, or use an allowed one. |
| `function-prop` | `<Text text={() => "a"} />` or a function nested in a composed component's props | Pass JSON data. A composed component's props are checked at every depth before it runs. |
| `async-render` | `async () => <Text text="a" />` | Resolve data in the host; return synchronously. A promise prop, at any depth in a composed component's props, fails too. |
| `render-failed` | `() => { throw new Error("boom"); }` | The message is `Widget threw Error`. Pass `debug: true` to `render()` to receive `boom` in `error.debug`, capped at 1,000 characters. |
| `limit-exceeded` | A stack with a text child rendered with `limits: { nodes: 1 }` | Reduce output or have the host choose an appropriate budget. |

Before a composed component runs, its props are walked as data — at every depth,
within the same 128-level bound as widget inputs — so a function or promise the
component would discard is still rejected, with `function-prop` or
`async-render` at its escaped pointer and the component's node id. JSX
`children` are exempt: they are elements, expanded afterwards. A primitive's own
JSON props keep their classification: a nested function there is `invalid-prop`,
because the prop's schema rejects the value first.

## Public exports and executable examples

`@arnilo/liveframe/sdk` exports `jsx`, `jsxs`, `Fragment`, `primitive`, `state`,
`action`, `ex`, `local`, `self`, `shown`, `ref`, `render`, `renderElements`, `streamElements` and `ephemeralManifest`. Its type exports are
`ActionStatus`, `ActionStatuses`, `Component`, `DeepReadonly`, `Element`, `ElementStream`, `Elements`, `Expr`,
`Intent`, `Json`, `LocalIntent`, `LocalWrite`, `RenderLimits`, `RenderOptions`, `StreamElementsOptions`, `TreeIntent`,
`WidgetInputs` and `WidgetProps`. `/sdk/gen` exports `generate`,
`generateDefinitions`, `generateElementsSchema` and `generateTemplateSchema`. `/sdk/jsx-runtime` exports
`jsx`, `jsxs`, `Fragment` and the `JSX` type namespace; `/sdk/jsx-dev-runtime`
exports `jsxDEV`, `Fragment` and that namespace. Element branding helpers are
internal.

The complete example is checked verbatim and rendered by
[`sdk-guide.test.ts`](https://github.com/ashiqrniloy/liveframe/blob/main/src/__tests__/sdk-guide.test.ts). Error examples and ids
are exercised by [`sdk-render.test.tsx`](https://github.com/ashiqrniloy/liveframe/blob/main/src/__tests__/sdk-render.test.tsx).
[`sdk-inputs.test.tsx`](https://github.com/ashiqrniloy/liveframe/blob/main/src/__tests__/sdk-inputs.test.tsx) covers frozen inputs,
identity caching, schema errors and determinism;
[`sdk-gen-types.test.tsx`](https://github.com/ashiqrniloy/liveframe/blob/main/src/__tests__/sdk-gen-types.test.tsx) checks generated
props and carried-value intents. CLI and drift behavior are covered by
[`sdk-gen.test.ts`](https://github.com/ashiqrniloy/liveframe/blob/main/src/__tests__/sdk-gen.test.ts). These tests use local
fixtures; no screenshot or browser renderer is needed.

## Node references

A catalog can declare string props as `refProps`. Generated component types require
`NodeRef` from the root export for these props. Import `ref` from `/sdk`:

```tsx
<TextField label="Reason" describedBy={ref("reason-hint")} />
<Hint $anchor="reason-hint" text="At most 200 characters" />
```

`ref()` returns a frozen `{ "$ref": "reason-hint" }` marker. Element JSON uses
that same object in `props.describedBy` and puts `$anchor` alongside `kind` on
the target. Anchors are unique across the tree, including composed components
and keyed fragments. A composed component forwards `$anchor` to its target primitive.

Both emitters resolve forward references after the node walk. The wire carries
only string key-path ids; anchors and markers do not appear in the tree.
Duplicate anchors are `duplicate-key` at the second `$anchor`; missing anchors
are `not-found` at the referencing prop, with the anchor in `expected`.
The resolved id must satisfy the catalog's string constraints, and byte budgets
count the resolved string exactly. A reference cannot address another tree.
