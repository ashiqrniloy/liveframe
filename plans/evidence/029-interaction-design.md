# 029 Interaction design: action results, local state and bindings

Design for plan 029 Task 1. It extends spec §8 (tiers), §9 (tree) and §11 (renderer) and reuses the expression machinery of plan 028 (`src/template/expr.ts`). Rules are numbered so Tasks 2–5 can cite them (`A3` = action rule 3). Where a rule differs from the plan's Task 1 text, it is listed under "Amendments to the plan" at the end.

## Prior art (recorded, not copied)

- **A2UI v0.9.1** (`/websites/a2ui`, a2ui.org/specification/v0.9.1-a2ui and a2ui.org/concepts/actions): input components read and write a client-side *data model* addressed by JSON Pointer. A write goes to the local model immediately, nothing is sent to the server until an *action* fires, and the server can also push `updateDataModel { surfaceId, path, value }`. Kept: local writes never touch the network; the local model reaches the backend only through an explicit action. Rejected: a whole-model JSON Pointer namespace that any component can write and the server can overwrite. Here the model is a small manifest-declared object, its only writer is a validated `setLocal` intent, and the host cannot push into it, so there is no second authority channel.
- **Plan 028 template design** (`plans/evidence/028-template-design.md`): the expression language, `checkExpression` and the type-fit rule (T13) are reused as they are.

## The gap, from the code

- A tier-3 widget cannot know that its last action is in flight or failed. `WidgetProps` has four inputs (`src/sdk/types.ts:15`); hosts that want "Saving…" would put it in `context` or `state`, each differently, and `state` is persisted (spec §8).
- A filter that needs no data still costs a round trip: `onIntent` is the only way out of a primitive (`raiseIntent`, `src/react/renderer.tsx:267`), and the host must return a new tree (`docs/renderer.md:380-396`).

## Action results (W3a)

**A1. Shape.**

```ts
type ActionStatus = {
  status: "pending" | "ok" | "failed" | "refused";
  action?: string;   // manifest action name; see A3
  reason?: string;   // ≤ 500 code points; display text, any status
  value?: Json;      // only with "ok"; checked against the action's `result` schema
  at?: string;       // ≤ 64 code units; opaque host text, never parsed by the library
}
```

The object is closed. `refused` means the host's offered-intent check (`checkOffered`, spec §8) or its authorisation rejected the intent; `failed` means the operation ran and failed. The library draws no other distinction.

**A2. The input.** `WidgetProps.actions: Readonly<Record<string, ActionStatus>>`, at most 64 entries. The key is the **result key**: the action name by default, or the `resultKey` of the intent (A5). Keys are opaque non-empty strings of at most 128 code points; row ids from data may appear in them, so the character set is not restricted. The host supplies `actions` exactly as it supplies `context`: it is an input, the library stores none of it, and an absent input is `{}`. It is part of `renderKey` (A8).

**A3. Checking `value`.** `value` is allowed only when `status` is `"ok"`, and it must match the `result` schema of the action it belongs to. A result key does not name that action when it is a row key, so the entry says which: `action` is the manifest action name. A key that is itself a manifest action name may omit `action` (it defaults to the key; if present it must equal the key). Any other key must carry `action`. An action that the manifest does not declare is `invalid-prop` at `/actions/<key>/action`. An `ok` entry for an action without a `result` schema must omit `value`. This is law 2 for the new input: a host bug cannot hand widget code an arbitrary shape.

**A4. Capabilities.** `liveframe-capabilities/1` actions gain optional `result: Schema` (the same schema language as source `result`). The manifest declares nothing new; the input schema is derived from the manifest's actions plus their capability `result` schemas, once per validator (`CompiledInputs`, `src/validate/compile.ts:78-83`). Input errors are `invalid-prop` at `/actions/<key>` (JSON Pointer escaped).

**A5. `resultKey`.** An `action` intent may carry `resultKey` (a string of at most 128 code points). It is a literal in the tree, like the action name and literal arguments, so it is *not* an argument and not a `bind` target. `complete()` (`src/validate/complete.ts`) copies it through unchanged, and `checkOffered` (`src/validate/offered.ts:29`) requires the completed intent to reproduce the offered `resultKey` exactly, exactly as it does for `name` and literal arguments. The host reads it from the intent to know which key to write its status under; the library gives it no other meaning. `setState` and `setLocal` intents do not carry it.

**A6. Where the host writes it.**

1. `onIntent` receives the intent and origin; the host checks it with `checkOffered`, then writes `actions[key] = { status: "pending", action }` and re-renders the widget (or serves the cached tree for the new `renderKey`).
2. It dispatches the operation as the viewer.
3. It writes `ok` (with the typed `value`), `failed` (with `reason`) or `refused` (with `reason`) and re-renders.
4. It decides when an entry expires by omitting it from a later render. The library has no timers and no history.

**A7. Authority.** A result grants nothing and is not an intent. A widget reading `actions` can only change what it draws. `reason` is host text shown through ordinary text props, so it is subject to the same prop bounds as any other string.

**A8. Caching.** `renderKey` is the SHA-256 of canonical JSON of `{ hash, catalogId, params, state, data, context, actions }`. Adding a key changes every existing key, so a hash vector in `conformance/hash/` registers the change and `register-0.3.0.json` names it. Hosts that never supply `actions` still get distinct keys from 0.2: the input is hashed as `{}`.

**A9. Where it appears.** `render()`, `renderElements`, `renderTemplate` (the `actions` root of plan 028, resolved to `{}` until now), `renderModule` and the runners accept `actions`; scenarios gain optional `actions`; preview and authoring/MCP `render_scenarios` accept it per call; `liveframe gen` types it per manifest (a record whose entries carry the typed `value` for name-keyed actions).

## Local state (W3b)

**L1. Declaration.** A manifest may declare `local: ObjectSchema` and `initialLocal`. The schema is closed, has at most 32 properties, and every property is declared in `required`, so `local.<key>` is always present and needs no `$has` guard. Property schemas are `boolean`, `integer`, `number`, `string` (with `maxLength` ≤ 256 or an `enum`) or the nullable form of each. No arrays, objects, `pattern` or `format: "url"` (a `pattern` is rejected as in other widget schemas). `initialLocal` must satisfy `local`. When `local` is absent both default to the empty closed object.

**L2. The intent.** `{ type: "setLocal", key: string, value?: Json }`, offered in `events` like `setState`. `key` must be a property of `local` (`unknown-name` at the intent pointer otherwise). `value` absent means the event's value, with `setState`'s fill rules: a scalar event fills a scalar property, `integer` fills `integer` or `number`, a nullable event requires a nullable property, and the host-side `minimum`/`maximum`/`maxLength` checks apply to the filled value. A literal `value` must satisfy the property schema.

**L3. Applied by the renderer.** `emit()` checks the carried value as today, completes the intent, checks the filled value against the local schema, writes it to the surface's local state and re-evaluates bindings (B10). The intent never reaches `onIntent`, never asks `confirm`, and `events[event]` metadata reports `{ type: "setLocal", confirm: false, irreversible: false }`. A value that fails the local schema throws like a `carries` mismatch (`Invalid event value: kind.event`) and raises an `emit-rejected` event (Task 5).

**L4. The host never accepts it.** `checkOffered` rejects a `setLocal` intent with `invalid-prop` at `/type`, expected `a host-dispatchable intent`. A buggy or hostile client that posts one gets nothing, and the host never has a reason to implement it (law 4).

**L5. Lifetime.** Local state belongs to one mounted `<Surface>`. It starts at `initialLocal` from the validator's manifest and resets when `surfaceId` changes or the validator changes. It survives revisions of the same surface: that is the point, since the host's re-run must not reset a half-typed filter. It is not persisted and never sent to the backend. A widget that wants the host to know a value commits it with an ordinary `setState` event.

**L6. SSR.** The first paint evaluates bindings against `initialLocal`, so server and client render the same markup.

**L7. Relation to tier 1.** Tier-1 state stays inside primitives (an open menu, a text field's caret). Local state is the declarative state *between* nodes. A primitive may emit `setLocal` and a sibling may bind to it; neither needs a round trip or widget code in the browser.

## Bindings (W3b)

**B1. Node fields.** `UiNode.when?: Expr` and `UiNode.bind?: Record<string, Expr>`. `props` stays plain JSON validated by the kind's prop schema exactly as today. `when` and `bind` are separate fields (rejected alternative: a marker inside `props`, which would make props stop being plain JSON). `props` is also the fallback: it must be a complete, valid props object on its own, and `bind` overrides named props at render. Consumers that do not evaluate bindings (a host diffing trees, `checkOffered`, capture without a renderer) see a valid static tree.

**B2. Roots.** An expression may read two roots: `local` (the manifest `local` object, always present) and `self` (the node's own `props` as sent in the tree, typed by the kind's prop schema; optional props are optional paths). There is no `data`, `state`, `params`, `context`, `actions`, iteration name or component use. `self` reads the tree's props, never another binding's result, so bindings cannot depend on each other and cannot cycle. An expression can therefore read only values already in the tree or in the surface's local state: nothing the widget did not put there.

**B3. Operators.** Expressions use the template language's conventions (T5, T8: a bare scalar is a literal, arrays and plain objects are constructors, one `$`-key is an operator, `$lit` escapes) and this allow-list:

| Group | Operators |
|---|---|
| Reference | `$path`, `$lit`, `$omit`, `$has` |
| Compare | `$eq`, `$ne`, `$lt`, `$lte`, `$gt`, `$gte` |
| Logic and choice | `$and`, `$or`, `$not`, `$cond`, `$coalesce` |
| Text | `$len`, `$concat`, `$text`, `$contains`, `$slice` |
| Numbers | `$add`, `$sub`, `$mul`, `$div`, `$round` |
| Lookup | `$get`, `$at` |

Excluded: `$let`, `$filter`, `$map`, `$findIndex`, `$flat`, `$sum`, `$fromEntries`, `$merge`, `$join`, `$split`, `$ref`. The first four are the iteration/binding forms (no loops in the browser); the rest build collections or objects no binding consumes. Using an excluded operator is `invalid-prop` at its pointer (`expected: "an operator allowed in a tree expression"`). `$contains` over a case-sensitive substring is the filter primitive; case-insensitive filtering folds the *literal* on the widget side and the user's text is matched as typed (no `Intl`, no locale; plan 028 T8).

**B4. Bounds.** Per expression: depth ≤ 16, nodes ≤ 64, evaluation fuel 256 steps (`evaluate`'s `steps` option; the `charge` extra step for long strings still applies). Per node: ≤ 16 `bind` entries. Per tree: ≤ 10,000 expression nodes in total, over which the validator reports `limit-exceeded` at the first expression past the limit. A tree of 679 nodes with 50 `when` expressions of about 10 nodes each uses 500.

**B5. Static checks (validator, on every arrival and in `render()`).**

1. Each expression is well formed and inside B3/B4.
2. `$path` roots are `local` or `self` only; `local.<key>` exists in the manifest `local` schema; `self.<prop>` exists in the kind's prop schema (`unknown-name`).
3. `when` infers a non-optional `boolean`.
4. Each `bind` target is a prop the kind declares (not `id`, `variant`, a style prop, an event, or a `refProps` prop) and the inferred type *binds* to that prop's schema by the plan 028 T13 shape rule (`invalid-prop` at `/…/bind/<prop>`). `dynamic` binds anywhere and is checked when evaluated (B7).
5. A `setLocal` intent names a declared `local` key and its literal `value` (if any) matches (`invalid-prop` at the intent pointer).
6. A `refProps` target may not be gated by `when` or sit under a gated ancestor (`invalid-prop` at the referencing prop): a hidden node has no DOM id for `aria-labelledby` to resolve.
7. Child-count rules (`children` min/max in the catalog) are checked with every `when` node present for the maximum and with only ungated nodes for the minimum, so a `when` can never push a parent outside its declared bounds.

Errors point at the node's own pointer with its `nodeId`, like any node error. The check is `checkExpression` with a scope built by `rootScope({ local, self })` plus an operator allow-list (the checker gains one optional parameter, the list from B3; no second checker).

**B6. `when`.** A node whose `when` evaluates to `false` is not rendered: its implementation is not called, its subtree is not mounted, and its parent's `children` and `items` omit it. `true` renders it. Anything else (only possible through a `dynamic` operand) is a binding failure (B8).

**B7. `bind`.** The evaluated value replaces the prop in the node's props before the implementation sees them. An absent result (`$omit`, an absent optional) removes the prop, which must be optional. The renderer re-validates the effective node with the validator's own `checkNode` (already public on `CompiledValidator`, `src/validate/compile.ts:84-87`), so a value that passes the shape rule but fails a bound (maxLength, enum, range, `url`) never reaches an implementation (law 2). Axis props recompute their slot classes from the effective values.

**B8. Failure.** An evaluation error (fuel, division by zero, a non-boolean `when`) or a failed re-validation renders the *node* fallback (the one an implementation failure already uses) and raises `binding-failed` (Task 5). It never fails the surface. The tree's static `props` are not substituted, because a stale value is worse than a visible failure.

**B9. Reference identity.** A node's effective form is a pure function of its tree node, the local state and the validator. When none changed, the core returns the same object, so React's reuse (`src/react/share.ts`) and memoised elements keep working.

**B10. Incremental evaluation.** While the core builds a node's context (one visit per node, as now) it records the node under each `local` key its expressions read (found statically at validation; `self` reads never change within a revision). A `setLocal` re-evaluates only those nodes. Ancestors of a changed node get a new identity (structural sharing), siblings keep theirs, and the adapter re-renders only the changed path. A tree with no `when`/`bind` pays one `undefined` property test per node.

**B11. Focus and scroll.** A focused element inside a node that `when` hides is handled by the surface's existing `FocusContinuity` (`src/react/renderer.tsx:155`), which restores focus to the nearest remaining element. Unaffected nodes keep DOM, focus, scroll and tier-1 state because their element identity is stable.

**B12. Templates.** A `TemplateNode` may carry `when` and `bind`. They are *tree* expressions, not template expressions: the template engine copies them verbatim (key order canonical), never evaluates them, and checks them with B5 against the manifest at install. The one connection to template scope is `{ "$embed": <template Expr> }`, valid only inside a `when`/`bind`, which the engine replaces with the evaluated value as a literal during expansion (so a row's title from data can sit in `{ "$contains": [{ "$embed": { "$path": "title" } }, { "$path": "local.q" }] }`). `$embed` never appears in a tree. TSX needs no such construct: `ex.contains(r.title, local("q"))` embeds the JavaScript string as a literal when the element is built.

**B13. TSX surface.** `/sdk` exports `local(key)` (the expression `{ $path: "local.key" }`), `self(prop)`, `local.set(key, value?)` (a `setLocal` intent), the `when` and `bind` element attributes (lifted into node fields like `key`, never emitted as props), and `ex` builders for the B3 operators. `liveframe gen` types `bind` per prop (the value type of the kind's prop) and `local(key)` per manifest (a typed expression).

## Wire and patches (W3a/W3b/W7)

**W1.** `liveframe/1` stays the format id. `UiNode.when`, `UiNode.bind`, intent `setLocal` and intent `resultKey` are optional fields. The validators already reject unknown node and intent fields, so an older renderer *fails closed* on a tree that uses them rather than ignoring them.

**W2.** `liveframe/tree-patch/1` `set` replaces `when` and `bind` as part of its payload; omitted means deleted, exactly as for `events`. `insert` carries them in its node. `diffTrees` compares them as JSON, independent of key order, and `applyPatch` carries them.

**W3.** Node sharing (`shareNode`, `src/react/share.ts:12`) compares `when` and `bind` with `sameJson` next to `props`, so a changed expression invalidates its node and ancestors only.

**W4.** `checkOffered` is unchanged for node fields; it adds the `setLocal` rejection (L4) and the `resultKey` reproduction (A5).

## Performance budgets

**P1. Live filter.** Workload: the agent-home subject (679 nodes, 50 rows), every row carrying a `when` that reads `local.q`. A keystroke that flips visibility of up to 10 rows re-renders in **≤ 4 ms median** in a production React build on the selection bench machine, with zero `onIntent` calls. Flipping all 50 rows is recorded as the worst case and not gated. Reference points from plan 022: the production selection update (one row) is 2.9 ms total with 0.9 ms of React work, and mounting the whole 679-node tree costs about 12.5 ms of React work, so the budget depends on unmounting and mounting being proportional to the rows that flip. If the first measurement misses, Task 4 records the split (evaluation, commit) and proposes a budget instead of relaxing this one silently.

**P2. No tax without bindings.** Arrival plus commit on the selection bench for a tree without `when`/`bind` is within **1%** of the Task 4 baseline (A/B pair, `bench/ab.ts`).

**P3. Validation.** 50 `when` expressions on the 679-node subject add at most the validator's 1.5 µs/node share in total, not per expression; a tree with none is non-regressing. Risk: every row's expression differs (it embeds the row title), so an expression cache keyed by content cannot reuse them. If the analysis cost of about 5 µs per expression breaks the share, Task 3 tightens B4 (depth 8, nodes 32) before it relaxes P3.

**P4. Actions input.** Checking `actions` on the agent-home render costs ≤ 1% of the render; an empty `actions` takes a fast path.

## Security review

- **Law 1.** No widget code reaches the browser. Expressions are data from a closed operator table with counted fuel; they cannot name functions, globals or prototypes (`$path` reads own properties only, plan 028 T8/T9, and `__proto__`, `constructor` and `prototype` are rejected as segments).
- **Law 2.** Every expression and its targets are validated before arrival is accepted; every bound value is re-validated before an implementation reads it (B7); `actions` and its `value` are validated before widget code reads them (A3).
- **Law 3.** Bindings cannot reach style props, `variant` or events (B5.4), so they cannot set a colour or raw CSS or rewrite an intent.
- **Law 4.** `setLocal` is not an authority: the renderer applies it, `onIntent` never sees it, `checkOffered` rejects it (L4), and local state is never sent. `actions` results are inputs that grant nothing (A7). `resultKey` is a label, not an argument.
- **Information flow.** An expression can read only the tree and the surface's own local state (B2). It cannot read data, state or context the widget did not put in the tree.
- **Denial of service.** B4 bounds the work per expression and per tree; the host's own tree limits (§10) bound the rest.

## Amendments to the plan

1. **A3, `ActionStatus.action`.** The plan's `ActionStatus` has no way to type `value` for a row-keyed result, since a result key such as `"claim:42"` names no action. The entry carries the action name; a name-keyed entry defaults it.
2. **A5, `resultKey` in templates.** Plan 028 T14 makes intent fields static. `resultKey` is a label and may be a `Value` in a template (per-row keys need it); `type`, `key`, `name`, `bind` and `bindAll` stay static.
3. **L1, every `local` property is required.** The plan says "a closed scalar object schema". Requiring every property keeps `local.<key>` always present.
4. **L4, `checkOffered` rejects `setLocal`.** The plan says `setLocal` never reaches `onIntent`; this adds that a posted one is rejected.
5. **B3, an operator allow-list.** The plan says "the template subset" without naming it. This one drops iteration and collection builders; the checker takes the list as a parameter.
6. **B5.6–B5.7, references and child counts.** Not in the plan; without them a `when` could leave a dangling `aria-*` reference or a parent outside its `children` bounds.
7. **B12, `$embed`.** Not in the plan. Needed so a template can put a row value into a browser-time expression.
8. **P1, workload.** The plan's "a `setLocal` that changes `when` on 50 rows" is read as: 50 rows carry `when`, a keystroke flips up to 10; the all-50 case is recorded. A flip of all 50 unmounts and remounts about 650 nodes and cannot be held to 4 ms by any React renderer.

## Module placement (for Tasks 2–5)

- `src/formats/manifest.ts`, `capabilities.ts`, `tree.ts`, `tree-patch.ts`: the fields and schemas.
- `src/validate/compile.ts`: `CompiledInputs.actions`; a `localFacts(validator)` WeakMap beside `actionFacts` for the local schema and initial value; node `when`/`bind` checks in `tree.ts`.
- `src/template/expr.ts`: `checkExpression` gains an optional operator allow-list; no other change.
- `src/surface/`: Task 4. It owns local state, `setLocal` application and binding evaluation; `/react` only subscribes.
