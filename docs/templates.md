# Template widgets

A template widget is **element JSON plus a small expression language**. It reads
the widget's `params`, `state`, `data` and `context`, branches, loops over arrays
and sets `state` or requests an action when pressed. It is *data*: the library
evaluates it on your backend, with bounded work and no access to anything but
those inputs. A host can therefore install a template an agent or a user wrote
**without an isolation runner**. Compare the other two ways to make a widget:

| | Needs a sandbox | Bound to data and state | Installable and stored |
|---|---|---|---|
| TSX widget | yes ([security](security.md)) | yes | yes |
| Element JSON ([SDK guide](sdk.md#ephemeral-surfaces-from-agent-json)) | no | no, static | no, ephemeral |
| **Template widget** | **no** | **yes** | **yes** |

The normative rules are [spec §7.6](spec.md#76-template-widgets). This guide is
how to write, install and generate one.

## A worked widget: a paged task list

This is `examples/demo-host/widgets/tasks/`, the widget the demo host installs at
runtime. It reads a `demo.tasks` source and pages through it with `state`.

`manifest.json` (declares what the template may read and set):

```json
{
  "format": "liveframe-manifest/1",
  "id": "tasks",
  "version": "1.0.0",
  "catalogId": "demo.ui@1",
  "params": { "type": "object", "properties": { "pageSize": { "type": "integer", "minimum": 1, "maximum": 10 } },
              "required": ["pageSize"], "additionalProperties": false },
  "state": { "type": "object", "properties": { "page": { "type": "integer", "minimum": 0, "maximum": 1000 } },
             "required": ["page"], "additionalProperties": false },
  "context": { "type": "object", "properties": {}, "required": [], "additionalProperties": false },
  "initialState": { "page": 0 },
  "sources": { "tasks": { "source": "demo.tasks", "params": {} } },
  "actions": []
}
```

`template.json`:

```jsonc
{
  "format": "liveframe-template/1",
  "root": {
    "kind": "stack",
    "props": { "label": "Tasks" },
    "style": { "gap": "space.3", "padding": "space.4" },
    // $let binds names for this node and its children, in order.
    "$let": [
      { "as": "total", "value": { "$len": { "$path": "data.tasks" } } },
      { "as": "start", "value": { "$mul": [{ "$path": "state.page" }, { "$path": "params.pageSize" }] } },
      { "as": "end",   "value": { "$add": [{ "$path": "start" }, { "$path": "params.pageSize" }] } },
      { "as": "last",  "value": { "$cond": [{ "$lt": [{ "$path": "end" }, { "$path": "total" }] },
                                            { "$path": "end" }, { "$path": "total" }] } }
    ],
    "children": [
      { "kind": "heading", "props": { "text": "Tasks", "level": 2 } },
      // $each emits one node per item. Its key becomes the node's key, so ids stay stable.
      { "$each": { "in": { "$slice": [{ "$path": "data.tasks" }, { "$path": "start" }, { "$path": "end" }] },
                   "as": "task", "key": { "$path": "task.id" } },
        "kind": "text", "props": { "text": { "$path": "task.title" } } },
      // $if emits the node only when its boolean expression is true.
      { "kind": "hint", "key": "range", "$if": { "$gt": [{ "$path": "total" }, 0] },
        "props": { "text": { "$concat": ["Showing ", { "$text": { "$add": [{ "$path": "start" }, 1] } },
                                         " to ", { "$text": { "$path": "last" } },
                                         " of ", { "$text": { "$path": "total" } }] } } },
      { "kind": "button", "key": "previous", "variant": "ghost", "$if": { "$gt": [{ "$path": "state.page" }, 0] },
        "props": { "label": "Previous" },
        "events": { "onPress": { "type": "setState", "key": "page", "value": { "$sub": [{ "$path": "state.page" }, 1] } } } },
      { "kind": "button", "key": "next", "variant": "primary", "$if": { "$gt": [{ "$path": "total" }, { "$path": "end" }] },
        "props": { "label": "Next" },
        "events": { "onPress": { "type": "setState", "key": "page", "value": { "$add": [{ "$path": "state.page" }, 1] } } } }
    ]
  }
}
```

Pressing **Next** sends `setState page = page + 1`. The host checks it against the
manifest and re-renders the template, exactly as it does for a TSX widget. The
template never "runs" a button handler; it only describes the intent the button
offers.

## The document

```
{ format: "liveframe-template/1", components?: { Name: { params, root } }, root }
```

A **node** is an element-JSON node (`kind`, `key`, `variant`, `$anchor`, `props`,
`style`, `events`, `children`) whose values may be expressions, plus these
directives, which run in this order on one node:

| Directive | Meaning |
|---|---|
| `$let: [{ as, value }, …]` | Bind names for this node and its children, in order |
| `$if: <boolean expression>` | Emit the node only when true |
| `$each: { in, as, index?, key }` | Emit one body per item of an array; `key` is required |
| `$use: "Name"` + `with: { … }` | Expand a component in place (it leaves no node of its own) |

A **component** is `{ params, root }`: `params` is an object schema, and the body
sees only its own params. This is how a template reuses a row without the row
seeing the rest of the widget.

## Expressions

An expression is JSON, never a parsed string:

- a string, number, boolean or `null` is a **literal**;
- an array is an **array** of expressions; an object with no `$`-key is an
  **object** of expressions;
- an object with **exactly one `$`-key** is an **operator**;
- `{ "$lit": <json> }` is a literal that is never interpreted.

A `$path` is a dotted name: `state.page`, `data.tasks`, `task.id`, `rows.0.title`.
Its roots are `params`, `state`, `data`, `context`, plus names bound by `$let`,
`$each`, `$filter`, `$map`, `$findIndex` and `$use`. A bound name may not reuse an
existing name.

| Group | Operators |
|---|---|
| Values | `$path`, `$lit`, `$ref` (a [node reference](formats.md)), `$omit` (leave a prop out), `$has` (is it present) |
| Compare | `$eq`, `$ne` (scalars), `$lt`, `$lte`, `$gt`, `$gte` (numbers) |
| Logic | `$and`, `$or` (two or more booleans, short-circuit), `$not` |
| Choice | `$cond: [test, then, else]`, `$coalesce: [a, b, …]` (first present) |
| Text | `$len` (string or array; code points), `$concat`, `$join: [array, separator]`, `$text` (number/boolean/null to string), `$contains`, `$split: [text, separator]`, `$slice: [array or string, start, end?]` |
| Numbers | `$add`, `$mul` (two or more), `$sub`, `$div`, `$round: [number, digits?]` (half away from zero), `$sum` (array) |
| Collections | `$filter: { in, as, index?, where }`, `$map: { in, as, index?, value }`, `$findIndex: { in, as, index?, where }`, `$flat`, `$at: [array, index]`, `$get: [object, key]`, `$merge`, `$fromEntries` |
| Binding | `$let: { bind: [{ as, value }, …], in }` (the expression form of the node directive) |

There is no regular expression, no locale formatting, no time and no randomness:
the same template and inputs give the same tree in every runtime. Text that needs
cleaning belongs in the source (or in a TSX widget).

Limits (all checked at install): 1 MiB of JSON, 10,000 nodes, 20,000 expression
nodes, expression depth 32, 64 components, component nesting 16. At render, every
expression node costs one step of a fuel budget (`limits.steps`, default
1,000,000) and strings and arrays are capped, so a template cannot loop forever
or build an unbounded value.

## Install-time errors an agent will see

`pack()`, `createPreview().update()` and the MCP `pack_draft` check the template
against the manifest, the capabilities and the catalog before anything renders.
Errors are `LiveframeError`s whose `pointer` addresses the template document
(rooted at `/template` in a package or draft):

| Mistake | Error |
|---|---|
| `{ "$path": "state.pge" }` | `unknown-name` at `/template/root/$let/1/value/$mul/0/$path`: *No property "pge" on "state"*, expected *one of: page* |
| `"text": { "$len": … }` into a string prop | `invalid-prop` at `/template/root/children/0/props/text`: *Expected a string* |
| `{ "$length": … }` | `invalid-document` at the operator: *Unknown operator $length*, expected the list of operators |
| `$each` without `key` | `missing-key` at `…/$each/key` |
| `"kind": "paragraph"` | `unknown-component`: *Expected a catalog kind: box, stack, …* |
| `"colour": "red"` in a button's props | `invalid-prop` at `…/props/colour`: *Expected a declared prop of button: …* |
| An action the manifest does not list | `undeclared-action` |
| A `$use` cycle or past a limit | `invalid-document` / `limit-exceeded` |

An expression whose type is only known at render (for example a value built with
`$fromEntries`) is checked then, as `invalid-prop` at the template pointer with the
`nodeId` of the nearest node.

## Install and render

```ts
import { pack } from "@arnilo/liveframe/pack";
import { templateRunner } from "@arnilo/liveframe/preview";

const packed = pack({ template, manifest, scenarios }, { catalog, capabilities });
// A frozen liveframe-package/1 with `template` in place of `code`. Stores,
// placements, loadPlacement and the hash treat it like any other package.
const runner = templateRunner(); // renders template packages only, loads no code
await runner.render(packed.value, { params, state, data, context },
  { catalog, capabilities, surfaceId: "tasks", revision: 1 });
```

`templateRunner()` is the recommended production runner for authors you do not
trust who only need templates: it executes no author code. `inProcessRunner()`,
`workerRunner()` and the runner kit render template packages too, and all of them
give byte-identical trees. The host still resolves `data` from the manifest's
sources and re-checks every intent (laws 1 and 4): a template names its actions
statically and can bind their arguments, never compute which action runs.

The demo host (`examples/demo-host/` in the repository) installs the `tasks` widget at
runtime with `bun install-widget.ts widgets/tasks`, resolves its `demo.tasks`
source and serves it.

## Preview and agents

A template draft goes wherever a code draft goes:

- `createPreview(…).update({ template, manifest, scenarios })` (use a
  `templateRunner()` in the session, or any other runner).
- `createAuthoring().packDraft(…)` and the MCP `pack_draft({ template, manifest,
  scenarios })`, or `pack_draft({ dir })` for a directory holding `template.json`,
  `manifest.json` and `scenarios.json` (no source files, no `entry`).

### A JSON Schema for the model

```sh
liveframe gen catalog.json --template-schema \
  --capabilities capabilities.json --manifest manifest.json --out template.schema.json
```

`generateTemplateSchema(catalog, { manifest?, capabilities?, structuredSubset? })`
from `@arnilo/liveframe/sdk/gen` returns the same bytes, and the MCP
`generated_types({ module: "templateSchema", manifest? })` returns it from the
server's capabilities. The schema is JSON Schema 2020-12 with `$id`
`urn:liveframe:template-schema:1`:

- every kind, its variants, props (typed per prop), style names and event names come
  from the catalog;
- with a manifest, `$path` is one of the widget's own paths (or a bound name),
  `setState` keys are the manifest's state keys, and actions are its declared
  actions, with capability argument names when capabilities are given;
- it lists the 38 operators with their operand shapes.

The schema **guides** generation; it cannot express scope, types or bounds. The
install validator is the authority, and its errors above are the feedback loop.

**Structured-output APIs.** Checked against the OpenAI and Claude documentation
(2026-11): OpenAI strict mode supports `$ref`, recursion and `anyOf` but requires
every property to be required and every object closed; Claude's structured outputs
reject recursive schemas, numeric and string constraints and cap optional and
union parameters. A template language is recursive and has optional fields, so it
does not fit a strict mode. `--structured-subset` (`structuredSubset: true`) drops
the keywords those APIs reject (`minLength`, `maxLength`, `pattern`, `minimum`,
`maximum`, `minItems`, `maxItems`, `uniqueItems`, `patternProperties`,
`propertyNames`, `allOf`, `not`, `format`) and reads `oneOf` as `anyOf`, leaving the
shape unchanged. Use it where a provider accepts a recursive schema without those
keywords; otherwise give the model the full schema as a tool's `input_schema`, or
let it write JSON freely and rely on the install errors.

## When to choose TSX instead

Choose a TSX widget when you need something a closed expression language does not
have: text sanitised with a regular expression, `Intl` or time formatting, a
helper shared with other code, or logic that is easier to read as a function. It
needs an isolation runner for code you do not trust. Choose a template when the
widget is layout, data binding, branching, loops and state, especially when an
agent or a user authors it.
