# 028 Template widgets: document, expression language and bounds

Design for plan 028 Task 1. It is derived from the three proof widgets (agent-home, `core.queue` at four sizes, git status) and the render pipeline as it stands (`src/sdk/render.ts`, `src/sdk/elements.ts`). Rules are numbered so Tasks 2–7 can cite them (`T3` = rule 3).

## Prior art (recorded, not copied)

- **A2UI v0.9.1** (`/websites/a2ui`, spec pages at a2ui.org/specification/v0.9.1-a2ui): bindings are JSON Pointer `path` objects; collections create a relative *child scope* per item; logic is `{ call, args }` over a fixed function list (`and`, `or`, `required`, `formatString`…). `formatString` interpolates `${/path}` inside a string, which needs a string parser. Kept: scope-per-item for iteration. Rejected: string interpolation.
- **Vercel `json-render` v0.21.1** (`/vercel-labs/json-render`): prop values may be `{ $state }`, `{ $cond, $then, $else }`, `{ $template: "Hello ${/user/name}" }` and `{ $computed: "fnName", args }`. `$computed` calls host-registered functions, so it needs a trusted host and is not sandbox-free. Kept: `$`-keyed JSON objects as expressions. Rejected: `$template` strings and registered functions.

## What the proof widgets require

`src/__tests__/fixtures/widgets/agent-home/queue.tsx` and the other proof widgets do much more than the plan's operator list covers. The table maps each construct to the operator that replaces it; every operator beyond the plan's list (marked **+**) is here because one of these constructs needs it.

| Construct (file) | Template form |
| --- | --- |
| `groups.filter(g => g.id !== "alerts" \|\| params.canViewAlerts)` (queue.tsx) | `$filter`, `$ne`, `$or` |
| derived `groups`/`visible`/`rows`/`focus` reused many times (queue.tsx) | **+** `$let` (node form and expression form) |
| `pages.findIndex(p => p.cursor === s.cursors[g.id])` | **+** `$findIndex`, `$get`, `$eq` |
| `pages.slice(0, i + 1).flatMap(p => p.rows)` | `$slice`, `$add`, `$map`, **+** `$flat` |
| `pages[i]?.nextCursor`, `rows[0]`, `rows.find(...) ?? rows[0]` | **+** `$at` (absent when out of range), `$get` (absent-propagating), `$coalesce` |
| `groups.reduce((s, g) => s + g.total, 0)` | **+** `$sum` over `$map` |
| `{ ...group, rows, next }` | **+** `$merge`; plain-object constructors |
| `cursors = { ...s.cursors }; cursors[g.id] = g.next` (for `state.set("cursors", cursors)`) | **+** `$fromEntries` over `$map`, then `$merge` |
| `groups.some(g => g.next)` | `$len` of `$filter` with **+** `$has`, `$gt` |
| `{...(selected ? { surface: "surface.well" } : {})}` | **+** `$omit` inside `$cond` (an absent prop is dropped) |
| `` `Checked ${data.checked}` ``, `String(total)` | `$concat`, `$text` |
| `meta.map((e, i) => … i === meta.length - 1 …)` | `$each.index`, `$len`, `$sub`, `$eq` |
| `Array.from(reason).length >= 1 && … <= 500` | `$len` on strings counts code points, `$and`, `$gte`, `$lte` |
| `foldedAlerts ?? 0`, `foldedAlerts ? a : b` | `$coalesce`, `$gt`, `$cond` |
| `["branch","detached","unborn"].includes(kind)` | `$contains` over an array literal |
| `workspaceRoot.split(/[\\/]/).filter(Boolean).pop()` (labels.ts) | **+** `$split` (literal separator), `$at` with `$sub($len …, 1)` |
| `data.status === "loading" ? … : … ? … : …` | sibling nodes with mutually exclusive `$if` |
| `<GitRoot key=…/>` returning a fragment of four keyed rows | `$each` + `$use` whose component root is a `fragment` node |
| `throw new Error("Unknown … cursor")`, `sanitizeText` (regex, control characters) | **Not expressible, by design.** The ports do not throw (an unknown cursor yields no rows); sanitization belongs in the source or in a TSX widget. Proof scenarios never exercise either (T22). |

## The document

**T1. Format.** `{ format: "liveframe-template/1", components?: Record<Name, Component>, root: TemplateNode }` where `Component = { params: ObjectSchema, root: TemplateNode }` and `Name` matches `^[A-Z][A-Za-z0-9]{0,63}$`. Unknown top-level fields are `invalid-document`.

**T2. Nodes.** A `TemplateNode` is an element-JSON node with these changes. Exactly one of `kind` or `$use` is present.

| Field | Type | Static or dynamic |
| --- | --- | --- |
| `kind` | catalog kind, or `"fragment"` | static string |
| `variant` | string | static (a conditional variant is two `$if` siblings) |
| `$anchor` | string | static |
| `key` | string or number | `Value` |
| `props`, `style` | `Record<string, Value>` | values are `Value`s |
| `events` | `Record<eventName, Intent template>` | see T14 |
| `children` | `TemplateNode[]` | |
| `$let` | `{ as: Name, value: Expr }[]` | sequential, once per expansion of the node |
| `$if` | `Expr` (boolean) | |
| `$each` | `{ in: Expr, as: Name, index?: Name, key: Expr }` | |
| `$use` | component name | static |
| `with` | `Record<string, Value>` | only with `$use`; must match the component's `params` |

A node with `$use` has no `kind`, `props`, `style`, `events`, `children`, `variant` or `$anchor`: those belong to the component root.

**T3. Directive order.** Per node: `$let` → `$if` → `$each` → the body (`kind` element or `$use`). `$let` is evaluated once and cannot see `$each` names; per-item derived values go in an expression `$let` or a component. `$if` false emits nothing. `$each` emits one body per item, flattened into the parent's children (like a fragment); `$each.key` is the key of each emitted body, and a node with `$each` must not have its own `key`. `$each` over an empty array emits nothing.

**T4. Keys and ids.** Ids are the SDK's key paths. A `$use` behaves exactly like a TSX composed component: it expands to the component's root and leaves no node, and the use-site key (or `$each.key`) wins over the root's own key (`key ??= element.key`, `src/sdk/render.ts:572`). A component root may be a `fragment`.

**T5. Values.** Wherever the language expects a `Value` or `Expr`:

- a string, number, boolean or `null` is a **literal**;
- an array is an **array constructor** of `Expr`s;
- an object with **no** `$`-key is an **object constructor** whose members are `Expr`s; a member that evaluates to *absent* is omitted;
- an object with **exactly one** `$`-key is an **operator application**; an object mixing a `$`-key with others, or with an unknown `$`-key, is `invalid-document` at that pointer;
- `{ "$lit": json }` is a literal that is never interpreted (the way to write an object that contains `$`-keys);
- array and object constructors **omit** a member that evaluates to absent, so `[key, optionalValue]` becomes `[key]`; `$fromEntries` accepts `[key]` and `[key, value]` and skips a key-only entry (Task 2).

This amends the plan's "expressions are objects with exactly one `$`-key": literals need no wrapper, which keeps LLM output small and removes the `$lit` noise that a bound intent such as `{ type: "setState", key: "filter", value: { $path: … } }` would otherwise need.

**T6. Key order never matters.** Package hashes use canonical JSON (keys sorted). No construct may depend on the order of object keys, so every ordered list is an array (`$let` is an array of `{ as, value }`; `$fromEntries` takes pairs).

## Expressions

**T7. Operators.** Operands are `Expr`s unless noted. "scalar" means string, number, boolean or `null`. An absent operand is a static error unless the operator says it accepts one.

| Group | Operator and operands | Result |
| --- | --- | --- |
| Reference | `$path: "a.b.0"` (string) | the value, or absent |
| | `$lit: json` | the JSON value |
| | `$ref: "anchor"` (static string) | the `{ $ref }` node-reference marker (plan 027) |
| | `$omit: null` | absent |
| | `$has: expr` | boolean: not absent |
| Compare | `$eq`, `$ne`: `[a, b]` scalars, absent allowed (absent equals only absent) | boolean |
| | `$lt $lte $gt $gte`: `[number, number]` | boolean |
| Logic | `$and`, `$or`: `[boolean, boolean, …]` (≥ 2, short-circuit) | boolean |
| | `$not: boolean` | boolean |
| Choice | `$cond: [boolean, then, else]` (lazy) | the chosen branch |
| | `$coalesce: [a, b, …]` (≥ 2, lazy) | first non-absent |
| Strings | `$len: string \| array` (strings count code points) | integer |
| | `$concat: [string, string, …]` | string |
| | `$join: [array of strings, separator]` | string |
| | `$text: number \| boolean \| null \| string` (ECMAScript `String`) | string |
| | `$contains: [string, string]` or `[array of scalars, scalar]` | boolean |
| | `$split: [string, separator]` (separator a non-empty literal) | array of strings |
| | `$slice: [array \| string, start, end?]` (strings by code point) | same type |
| Numbers | `$add`, `$mul`: `[number, number, …]`; `$sub`, `$div`: `[number, number]` | number |
| | `$round: [number, digits?]` (digits 0–6, half away from zero) | number |
| | `$sum: array of numbers` | number |
| Collections | `$filter: { in, as, index?, where }` | array |
| | `$map: { in, as, index?, value }` | array |
| | `$findIndex: { in, as, index?, where }` | integer, `-1` if none |
| | `$flat: array of arrays` (one level) | array |
| | `$at: [array, integer]` (absent when out of range or absent array) | element or absent |
| | `$get: [object, string]` (own property; absent if the object or key is absent) | value or absent |
| | `$merge: [object, object, …]` (shallow, right wins) | object |
| | `$fromEntries: array of [string, value]` (later wins; absent values skipped) | object |
| Binding | `$let: { bind: [{ as, value }, …], in }` | `in`'s value |

**T8. Semantics that must be identical in every runtime.**

- `$text` and `$concat` use ECMAScript `String`: `$text(0.1 + 0.2)` is `"0.30000000000000004"`, `$text(-0)` is `"0"`, `$text(1e21)` is `"1e+21"`.
- Arithmetic results that are not finite are an evaluation error; `-0` is normalised to `0`.
- `$round(x, d)` is `sign(x) * floor(abs(x) * 10^d + 0.5) / 10^d` with `10^d` from the exact table `[1, 10, …, 1e6]`. It does not call `Math.pow`.
- `$slice` indexes must be integers ≥ 0, else an evaluation error; an end past the length clamps; start ≥ end gives empty. This amends the plan, which listed "out-of-range `$slice`" as an error: clamping matches `Array.prototype.slice` for the proof use `slice(0, i + 1)` and an error there would make a short list fail.
- `$len` of a string counts code points, so it agrees with the schema language's `maxLength` and with `Array.from(s).length`.
- `$eq`/`$ne` compare scalars with `===`, never objects or arrays; `NaN` cannot occur (T8 arithmetic).
- `$get` and `$path` read own properties only (`Object.hasOwn`); arrays are indexed only by in-range integers.
- No regex, no `Intl`, no locale, no time, no randomness, no `Date`.

**T9. Scope.**

- Roots in the widget `root` body: `params`, `state`, `data`, `context`, `actions` (action results, plan 029 Task 2; resolved to `{}` until then). A path may be a bare root (`"state"`).
- Names enter scope through `$let`, `$each.as`/`index`, `$filter`/`$map`/`$findIndex` `as`/`index`, and expression `$let`.
- **Components are hermetic.** A component body sees only its declared `params` (as bare names) and the names it binds itself, never the widget's roots. This is how a component is typed from its `params` schema alone and how it stays reusable. Because no roots exist there, a component param may be named `params`, `state` and so on (the agent-home port passes `params`, `state` and `data` into one component this way).
- A name may not equal a root visible in the same scope, nor a name already in scope (no shadowing). Names match `^[a-z][A-Za-z0-9]{0,31}$`.
- `$`-prefixed or prototype names (`__proto__`, `constructor`, `prototype`) are rejected as path segments at check time (`invalid-document`), and `$path` never reads inherited properties at evaluation.

**T10. Bounds (checked at install).**

| Bound | Limit |
| --- | --- |
| Expression depth | 32 |
| Expression nodes per template | 20,000 |
| Template nodes (`TemplateNode`s) | 10,000 |
| Components | 64 |
| `$use` depth | 16 (graph acyclic) |
| `$let` bindings per node or expression | 32 |
| Template document size | 1 MiB canonical UTF-8 JSON, like package code |

**T11. Bounds (enforced at render).** The plan's "work is bounded by input size × template size" is true only without nested loops: a `$filter` inside a `$map` inside a `$filter` is polynomial in the array bounds, and a `$let` chain that concatenates a string with itself doubles it per binding. So evaluation has explicit fuel and value caps:

- `limits.steps` (new, default 1,000,000): one step per expression node evaluated. Exhaustion is `limit-exceeded` at the expression's pointer. The agent-home widget needs about 10⁴ steps; the default leaves a hundred-fold margin.
- Operators that walk a long value (`$len` of a string, `$concat`, `$join`, `$split`, `$slice`, `$contains`, `$flat`, `$sum`, `$merge`, `$fromEntries`) cost one extra step per 64 units of input, so nested work cannot hide in one step (Task 2).
- A string result is at most 1,048,576 UTF-16 units and an array result at most 65,536 items (`limit-exceeded`).
- Inputs are bounded by their schemas (arrays always carry `maxItems`), so `$each`/`$map` iterate bounded arrays; the tree limits of §10 apply to the output as for `render()`.

Termination follows: there is no recursion (T10), no unbounded loop (loops iterate input-bounded arrays), no function values, and every step is counted.

## Static checking

**T12. Types.** The checker infers `ExprType = { schema: LanguageSchema | "dynamic", optional: boolean }` using the schema language, so no new type system exists. Literal strings infer a one-value `enum`; `$cond`/`$coalesce` over literals join their enums; computed scalars infer `str`/`num`/`int`/`bool` with the maximum bound; array and object constructors infer `arr`/`obj` from members; a path into an object yields the property schema (optional when not in `required`); into an array index, the item schema (optional); into a discriminated union, the union. `dynamic` arises from `$fromEntries`, a dynamic-key `$get` over mixed property types, and a `$merge` of dynamic objects.

**T13. Compatibility (`from` binds to a `to` schema).** The check is *shape*, not constraints:

1. `dynamic` binds anywhere and is checked against the target schema when evaluated (render-time `invalid-prop`). This amends the plan, which allowed `unknown` only where the target accepts any JSON; that would make `$fromEntries` (the only way to build the `cursors` state value) unusable.
2. An `optional` expression does not bind to a required target. `$has` guards narrow a `$path` to present inside a `$if` subtree, a `$cond`'s then-branch and later operands of `$and`; `$coalesce` removes optionality. This replaces the plan example's bare `"$if": { "$path": "data.queue.nextCursor" }`: the test must be boolean, so the example becomes `"$if": { "$has": { "$path": "data.queue.nextCursor" } }`.
3. Same JSON type; `integer` binds to `number`, not the reverse; `nullable` binds only to `nullable`.
4. `string` with an `enum` binds only to a target whose enum contains all its values; a plain string does not bind to an enum target (map it with `$cond`). `url` and `pattern` strings are checked at render.
5. Objects: every required target property is present and compatible, and the source has no property the target lacks (targets are closed). Arrays: item compatibility. Unions: each source variant must bind.
6. If the whole expression is a literal (no paths), it is checked with the real schema check (`checkValue`), so `maxLength`, ranges and `url` rules apply at install.
7. Value constraints (lengths, ranges, patterns) of non-literal bindings are checked at render time by the same single-pass build as for TSX (law 2).

**T14. Intents.** In `events`, `type`, `key`, `name`, `bind` and `bindAll` are static; `value` and `args` members are `Value`s. At install: a `setState` key must exist in the manifest state schema and `value` must bind to that property's schema (T13); an `action` name must be one of the manifest's actions and `args` must match the capability's `args` schema (known names only, bound members compatible, required members present unless `bind`/`bindAll` supplies them, the same completion rule as element JSON); an event name must exist on the kind. The intent shape is unchanged, so a template can never compute an action name: the set of actions a template can request is the static set in its document.

**T15a. Placement of roots (Task 3).** The widget root renders exactly one element, so it takes no `$if` or `$each` and is not a fragment. A component root emits at most one node: it may take `$let` and `$if` but not `$each` (a fragment root is the way to emit several). The `$if` of a node is evaluated before its `$each`, so it cannot read `$each` names. A child kind is checked against its parent's `children` rules where both are statically known, through fragments and through a `$use` (placed by the component root's kind); minimum and maximum counts depend on `$if` and `$each` and are left to render.

**T15. Everything else, as for element JSON.** Kinds, variants, props, style names (including `url` and `refProps` props), `$anchor` uniqueness and the `fragment` rules are checked by one shared helper extracted from `src/sdk/elements.ts` (Task 3). `$anchor` directly under an `$each` body is rejected; an anchor repeated through a reused component surfaces as a render-time `duplicate-key`. A `$ref` must name an anchor declared somewhere in the same document (`unknown-name` otherwise).

**T16. Errors.**

- Install errors are `LiveframeError`s whose `pointer` addresses the template document (`/root/children/2/props/label/$path`): `unknown-name` for a path, root, component, component param or anchor; `invalid-prop` for a binding that is not compatible or a literal that fails its schema; `invalid-children`, `missing-key` (`$each` without `key`), `cyclic-extends` is *not* reused (a `$use` cycle is `invalid-document` with `expected: "an acyclic component graph"`); `limit-exceeded` for T10. Amended in Task 3: kinds, events and actions keep the kinds element JSON and trees already use, so a consumer handles a template error as it handles any other: `unknown-component` for an undeclared kind, `undeclared-event` and `undeclared-action` for an event or action the catalog or manifest does not declare, and `duplicate-key` for a repeated `$anchor`.
- Render errors are `invalid-prop` at the template pointer (division by zero, a bad `$slice`, a value failing its prop schema), `limit-exceeded` for T11. `nodeId` is the key-path id of the nearest enclosing node whose keys are already evaluated, using the SDK's id encoder through the internal seam. Errors are collected up to `maxErrors`, then the usual bound marker is added.

## Rendering

**T17. Pipeline.** `renderTemplate` checks and freezes inputs as `render()` does (`renderValue` with `validateInputs`; the existing `renderPrepared` skips that step, so Task 4 adds an internal seam that passes inputs through), expands the template into SDK `Element`s with a `WeakMap<Element, templatePointer>` for error pointers (the mechanism `elements.ts` already uses), and calls the shared single-pass build. There is no second walk of the output and no second validator.

**T18. Compile once.** A frozen `Template` is compiled to closures once and cached in a `WeakMap` (the key is the frozen object, like the runners' hash cache); an unfrozen one compiles per call. Paths are pre-split and names resolve to slots at compile time. There is one evaluator: `evaluate(expr, values)` compiles and runs once, and `renderTemplate` runs the compiled closures. No `eval`, no `Function`.

**T19. Budget.** ≤ 3 µs per output node through `renderTemplate` on the agent-home template, split as `render()` splits it: ≤ 1.5 µs expansion plus evaluation and ≤ 1.5 µs build plus validation. Expression evaluation targets ≤ 50 ns per node (recorded, not gated). If Task 4 cannot meet the bar with closures, it records the measured split in the Task 4 notes and proposes a budget; it does not silently relax it.

## Why a template needs no sandbox

**T20.** The only inputs to evaluation are the frozen JSON inputs of T9. The operators are a closed table of library functions; the language has no function values, no names outside the scope, and no way to reach `globalThis`, a prototype, a module or a host API (T9, T8). All work is counted (T11). Output is plain JSON built by the library and validated by the same compiled validator as every tree (law 2). A template can set only catalog props and style props, and style values are validated by the same recipe and token rules (law 3). It can request only the actions named statically in its document, each re-checked by the host on dispatch (law 4, T14). It cannot run before or outside `renderTemplate`, so it is as safe in the app's backend process as the SDK is. The residual risks are the ones TSX also has: text a viewer may see is rendered into the tree, and a hostile template can spend up to its fuel (about 50 ms at the default) per render.

## Module layout

- `src/template/expr.ts`: `Expr` types, `checkExpression`, `compileExpression`, `evaluate` (operator table).
- `src/template/scope.ts`: scope, `ExprType`, inference and `compatible`.
- `src/template/document.ts`: `Template` types, `validateTemplate`, the registered format.
- `src/template/render.ts`: `renderTemplate` (expansion to `Element`s).
- `src/template/index.ts`: the `/template` subpath.
- `src/sdk/stream.ts`: `streamElements` (Task 7), separate.

## Amendments to the plan

1. T5: bare scalars are literals; arrays and objects are constructors (plan: every expression is a `$`-object).
2. T7: 12 operators added for the proof widgets: `$let`, `$has`, `$omit`, `$findIndex`, `$at`, `$flat`, `$merge`, `$fromEntries`, `$sum`, `$split`, plus `$ref` and the `index` binding.
3. T9: components are hermetic; no shadowing.
4. T11: render-time fuel (`limits.steps`) and value caps replace "bounded by input size × template size".
5. T8: `$slice` clamps rather than erroring on an end past the length.
6. T13: `dynamic` binds anywhere and is checked at render; `$if` takes a boolean, and presence is `$has`.
7. T17: `renderPrepared` needs an input-checking seam.
8. Out of scope by design: `throw`, regex sanitization (T22).

**T22.** Proof parity is claimed over the proof scenarios only. The ports do not throw on an unknown cursor and do not sanitize git labels; the scenarios contain neither an unknown cursor nor control characters or path-like names that sanitization would change.
