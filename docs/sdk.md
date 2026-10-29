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

`WidgetProps<P, S, D, C>` gives deeply readonly `params`, `state`, `data` and
`context`. A widget returns exactly one SDK element. Compose widgets with plain
TSX functions: they expand during `render()`, leaving only primitives in the
tree. `jsx` records a component without calling it. Elements, their props and
their children arrays are frozen; arbitrary nested prop objects are not
deep-frozen by JSX construction. Inputs and intent values are deep-frozen.
Text is a primitive prop such as `text="Hello"`; raw string children are invalid.

Compile once for a validated catalog/capabilities/manifest combination and reuse
the validator. `render(widget, inputs, options)` checks inputs, runs the widget,
and builds and validates nodes in one pass. It returns `Result<UiTree>`:
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
The same widget, inputs and render options give byte-identical serialized trees,
including across fresh validators. Changing `revision` changes the tree envelope.

`params`, `state` and `context` are checked every render. `data` is checked
against the manifest's bound sources and their capability `result` schemas,
then frozen in place. A module-private identity cache skips the data check and
freeze when that exact object is reused with the same compiled validator. Reuse
it for state-only rerenders; allocate a new data object for a new resolution. Supply plain JSON value
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
| `render-failed` | `() => { throw new Error("boom"); }` | Fix the widget exception. The message retains `boom`, without a stack, capped at 500 characters plus an ellipsis. |
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
`action` and `render`. Its type exports are `Component`, `Element`,
`DeepReadonly`, `Intent`, `Json`, `WidgetProps`, `RenderLimits` and `RenderOptions`.
`/sdk/jsx-runtime` exports `jsx`, `jsxs`, `Fragment` and the `JSX` type namespace;
`/sdk/jsx-dev-runtime` exports `jsxDEV`, `Fragment` and that namespace. The
generator implementation and element branding helpers are internal.

The complete example is checked verbatim and rendered by
[`sdk-guide.test.ts`](https://github.com/ashiqrniloy/liveframe/blob/main/src/__tests__/sdk-guide.test.ts). Error examples and ids
are exercised by [`sdk-render.test.tsx`](https://github.com/ashiqrniloy/liveframe/blob/main/src/__tests__/sdk-render.test.tsx).
[`sdk-inputs.test.tsx`](https://github.com/ashiqrniloy/liveframe/blob/main/src/__tests__/sdk-inputs.test.tsx) covers frozen inputs,
identity caching, schema errors and determinism;
[`sdk-gen-types.test.tsx`](https://github.com/ashiqrniloy/liveframe/blob/main/src/__tests__/sdk-gen-types.test.tsx) checks generated
props and carried-value intents. CLI and drift behavior are covered by
[`sdk-gen.test.ts`](https://github.com/ashiqrniloy/liveframe/blob/main/src/__tests__/sdk-gen.test.ts). These tests use local
fixtures; no screenshot or browser renderer is needed.
