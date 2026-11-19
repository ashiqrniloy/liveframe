# 039 Agent-generated UI design: element-JSON bindings, the catalog digest, the A2UI converter and starter primitives

Design for plan 039 Task 1 (`0.4.0`). Covers findings F9–F12 of the 2026-11-15 review and the G3 backlog item "Add `when` and `bind` to element JSON" (`plans/evidence/033-review-findings.md`; scope in `decision-logs/2026-11-15-1251-review-2026-11-15-scope.md`, which already lifts the spec §14 non-goal "A2UI or other wire interop" for F11). Extends `docs/spec.md` §5, §7.2, §8, §9, §13 and §14. Rules are numbered per item (`E.*` element-JSON bindings, `G.*` digest, `A.*` A2UI converter, `C.*` starter controls, `T.*` starter content kinds) so Tasks 2–6 can cite them.

Documentation checked on 2026-11-19:

- A2UI, fetched with `find-docs` (Context7 `/websites/a2ui`) and from a2ui.org: the version table (v0.9.1 **current**, v1.0 **candidate**, v0.9 stable, v0.8 legacy), the v0.9.1 specification (`/specification/v0.9.1-a2ui/`), the v0.9 basic catalog (`/specification/v0_9/catalogs/basic/catalog.json`) and `common_types.json`.
- React Aria Components, with `find-docs` (Context7 `/websites/react-aria_adobe`), checked against the locked `react-aria-components@1.22.1` type declarations in `node_modules/react-aria-components/dist/types/src/`. It exports `RadioGroup`, `Radio`, `RadioButton`, `Slider`, `SliderTrack`, `SliderThumb`, `SliderOutput`, `ProgressBar`, `Meter`, `DateField`, `DateInput`, `DateSegment` and `Table`. `RadioButton` appears in the current docs, but the design uses `Radio`, which the `^1.22.0` floor certainly has. RAC 1.22.1 depends on `@internationalized/date@^3.12.4` and does not re-export `parseDate`.

Measurements: a throwaway digest prototype gave 13,335 characters for the proof catalog with the fixture capabilities and 14,065 for the starter catalog. It did not yet include the envelope example or the grammar. For comparison, the proof `catalog.json` is 39,673 bytes and `elements.schema.json` is 75,467 bytes. The script was not kept, and Task 3's tests replace it.

---

## Summary of open questions (with decisions and reasons)

| Item | Question | Decision | Reason |
| --- | --- | --- | --- |
| **F9** | How do a `local` schema and its initial values come with an element JSON document? | **As `ephemeralManifest({ catalogId, actions, state?, local?, initialLocal? })` input, from the caller.** The document can never carry them. A `local` field on any element is `invalid-prop` at `/local` ("no such element field"), the error every unknown element field already gets. | `local` is the app's contract with the browser: it sets the bounds of what the renderer stores. If the agent declared it, the agent would choose its own bounds. The plan's proposed `invalid-document` is replaced by the existing unknown-field error, so there is no second rule for one case. |
| **F9** | Which plan 037 additions may element JSON use? | **All of them:** `setLocal`, `local` writes on a host intent (`until: "revision"`), `fromLocal`, the `shown` root, array carries, and `focus` (already accepted). | Each one is tree data that the compiled validator already checks against the manifest. Element JSON is another way of writing the same tree, so it needs no rule of its own. |
| **F9** | When does `streamElements` draw a node that has expressions? | **When its shell is drawn, with no new rule.** A shell is drawn only after all its own members are final (the members before `children`). `when` and `bind` are own members, so they are already complete. A member after `children` already stops further trees. | The plan's "only once the node is complete" would hold back every container with a `when` until all its rows arrive, and the stream's guarantees already make that unnecessary. Task 2's test is renamed. |
| **F9** | Does the element schema describe expressions without `local`? | **No.** Without `local`, `generateElementsSchema(catalog)` returns the 0.3.0 bytes. With `{ local }`, it adds `when`, `bind`, the tree grammar, `setLocal`, compound `local` writes and `fromLocal`. | It keeps the stored schema and its hash unchanged. Expressions that read only `self` stay legal in `renderElements` and are documented, but are rarely useful to an agent. |
| **F10** | What is the digest, and is it a §14 change? | **A Markdown text from `generateDigest(catalog, { capabilities?, local?, budget? })` and `liveframe gen --digest`.** It is a generated catalog module like `elementsSchema`. §14's item "agent tooling beyond generated typed component modules…" is **reworded to name the digest. The owner must answer this.** | It gives a non-MCP agent the facts it needs at about a quarter of the size of the element JSON schema. The §14 line currently names only typed modules, so a text digest needs an explicit amendment. |
| **F10** | Budget, and does MCP expose it? | **Proof catalog with its fixture capabilities ≤ 20,000 characters. Starter catalog ≤ 24,000 characters after F12.** `gen:check` enforces both with `--budget`. **MCP: yes**, as `module: "digest"` of the existing read-only `generated_types` tool. No new tool. | The prototype measured 13.3k and 14.1k. The headroom covers the envelope example, the grammar and the eight F12 kinds. An MCP agent already has `list_*`, but a host that forwards one document to a non-MCP agent can take it from the same server. |
| **F10** | How does an app keep things out of the digest? | **By passing only what it wants described.** The library never reads `meta` (spec §7.3, law 4), so "marked internal in `meta`" is dropped from Task 3. | Reading `meta` would break the published rule. The caller already chooses the capabilities document, and a filtered copy is one line of code. |
| **F11** | Which A2UI version? | **v0.9.1 (current production), and v0.9 (same component schema).** v0.8 and v1.0 (candidate) are `invalid-document` at `/<i>/version`. | v0.9.1 changed only the MIME type and the `surfaceId` rules. v1.0 is a release candidate, and the converter adds it when it ships. |
| **F11** | Shape of the converter? | **`fromA2ui(messages, mapping, options?)` → `Result<{ elements, initialLocal, origins }>`** in `@arnilo/liveframe-a2ui`. It works on a snapshot (the final component list and data model), not a stream. | It produces one element JSON document that the caller passes to `renderElements`. `origins` maps each element pointer back into the A2UI input, so the host can translate validation errors. A streaming converter is backlogged. |
| **F11** | What is refused? | **Every `FunctionCall` except `formatString` over data paths, `functionCall` actions, `checks`, `theme`, `sendDataModel: true`, `Icon.svgPath`, `weight`, `deleteSurface`, multiple surfaces, and a component referenced twice.** `theme`, `weight` and `checks` may be dropped knowingly through `mapping.drop`. | A2UI client functions are behaviour the browser would run (law 1). `theme` and `svgPath` are drawing data from the agent (law 3). `sendDataModel` sends state the manifest did not declare (law 4). Nothing is dropped unless the app named it. |
| **F12** | Which starter kinds? | **Controls: `radioGroup` + `radio`, `slider`, `progress`, `dateField`. Content: `richText`, `chart`, and `table` + `tableRow` + `tableCell`.** | Each passes the rule-2 test in §4. `meter` is backlogged, because its role differs from `progress` and nothing asks for it yet. |
| **F12** | Table structure: `semantics` values or kinds? | **Kinds.** | The `ariaRoles` allowlist admits only roles with no required context or owned elements (spec §6.5). `table`, `row`, `cell`, `columnheader` and `rowheader` all have such rules, so a `semantics` value cannot carry them. Column layout and header association also need a real `<table>`. |
| **F12** | Dependencies? | **One starter peer: `@internationalized/date` (`^3.12.4`, the range RAC 1.22.1 already installs), used only by `dateField`.** The core gains nothing. | `DateField` takes a `CalendarDate`, and only `parseDate` builds one from an ISO string. As a peer it shares RAC's copy instead of adding a second. A native `<input type="date">` was rejected: its picker and segments are drawn by the user agent, out of reach of recipes (law 3). |
| **F12** | Where does `richText` check its link targets? | **In the implementation, with `checkUrl(value, rule)`, newly exported from the root** together with the `UrlRule` type. | A link target inside a string prop is invisible to the validator, so the trusted implementation must apply the same check `url` props get. One exported check avoids a second copy of a security rule in the starter. |

---

## 1. F9 — `when`, `bind` and `setLocal` in element JSON

### Form

```ts
// src/sdk/elements.ts
export function ephemeralManifest(input: {
  readonly catalogId: string;
  readonly actions: readonly string[];
  readonly state?: Json;
  readonly local?: ObjectSchema;   // new: the app's local schema (spec §7.1 rules)
  readonly initialLocal?: Json;    // new: required with `local`, must satisfy it
}): Manifest;

// Elements<C>: each element gains
//   when?: Expr; bind?: { [bindable prop]?: Expr };
//   events?: { [E]?: TreeIntent }         // was Intent: setLocal, and `local`/`fromLocal` on intents

// src/sdk/gen.ts
generateElementsSchema(catalog, { local?: ObjectSchema }): string
```

```jsonc
// a live filter written by an agent; `local: { q: str({ maxLength: 80 }) }` and `initialLocal: { q: "" }` come from the caller
{ "kind": "stack", "children": [
  { "kind": "textField", "props": { "label": "Filter", "value": "" }, "bind": { "value": { "$path": "local.q" } },
    "events": { "onChange": { "type": "setLocal", "key": "q" } } },
  { "kind": "text", "key": "t1", "props": { "text": "Write the report" },
    "when": { "$contains": [{ "$path": "self.text" }, { "$path": "local.q" }] } },
  { "kind": "text", "key": "empty", "props": { "text": "Nothing matches" },
    "when": { "$eq": [{ "$path": "shown" }, 0] } }
] }
```

### Rules

- **E.1 Fields.** `when` and `bind` join `ELEMENT_KEYS` (`src/sdk/element-node.ts:31`). `elementProps` copies them like `focus`, and the build pass's `attachExpressions` (`src/sdk/render.ts:1040-1061`) records them. A fragment still refuses them (`rejectFragmentFields`, already). No second expression checker exists: the validator's `compileBindings` (`src/validate/bindings.ts`) checks them as it does for TSX.
- **E.2 Checks.** These are spec §8's checks, unchanged: each expression is well formed and within 16 levels and 64 nodes; at most 16 `bind` entries per node; at most 10,000 expression nodes per tree (`limit-exceeded`); `local.<key>` must be declared (`unknown-name`); `shown` is read bare; `when` is a boolean; a `bind` target is bindable and fits its type (`invalid-prop`); and the `refProps` and child-count rules hold. Pointers point into the JSON (`/children/1/when/$contains/1`), as for every element error.
- **E.3 Without `local`.** An ephemeral manifest with no `local` gets the closed empty schema, as today. An expression may then read only `self` and `shown`, and `setLocal`, a `local` write or `fromLocal` is `unknown-name`. That is the existing rule, now reachable from JSON.
- **E.4 The document cannot declare state.** `local`, `initialLocal`, `state` or `manifest` on an element is `invalid-prop` at that field ("no such element field").
- **E.5 `ephemeralManifest`.** If `local` is given without `initialLocal`, or `initialLocal` fails `local`, the call throws `TypeError`, as an invalid `state` does today. `local` must meet §7.1's local rules. They are checked where every manifest is checked (`compileValidator`'s manifest check), so a too-wide `local` is `invalid-document` at `/local/...` with no extra code path.
- **E.6 Streaming.** A shell carries its `when` and `bind` (they are own members). The 10,000-node bound is counted across the whole document: each snapshot is a valid tree, and the bound applies to every tree drawn and to `end()`. Task 2 confirms that the stream's validation sink carries one `expressions` total per tree (`src/validate/bindings.ts:73-79`). If it does not, it adds one.
- **E.7 Schema.** With `{ local }`, every kind's element object gains:
  - `when`: `$ref: "#/$defs/expr"`.
  - `bind`: an object whose properties are that kind's bindable props (not `refProps`), each `$ref: "#/$defs/expr"`, with `maxProperties: 16`.
  - `$defs.expr`: the tree operator allow-list built by the template schema's `operatorOperands`, restricted to `TREE_OPERATORS`. Its `$path` is the enum of `local.<key>` plus `shown`, or a string matching `^self\.[a-z][A-Za-z0-9]*$`.
  - Intents gain `setLocal` (key enum), compound `local` (1–4 entries) and `fromLocal`.

  The schema stays a non-strict tool schema. The strict-mode question stays in its backlog entry.
- **E.8 CLI and MCP.** `liveframe gen <catalog> --elements-schema --local <file>` reads a JSON file holding the `local` object schema. MCP `generated_types` with `module: "elementsSchema"` takes an optional `local`. No MCP tool renders element JSON today, so no other tool changes.

### What a 0.3.x consumer does

A 0.3.x `renderElements` rejects `when` or `bind` with `invalid-prop` "no such element field" (fail-closed). A 0.3.x renderer given a 0.4.0 tree with expressions already evaluates them: trees have carried them since 0.3.0, so nothing new reaches the wire.

### Spec text

- §7.2 Agent element JSON: "`{ kind, key?, $anchor?, variant?, props?, style?, events?, when?, bind?, focus?, children? }`, with intents in the `TreeIntent` shape". And: "`ephemeralManifest({ catalogId, actions, state?, local?, initialLocal? })` … `local` and `initialLocal` are the caller's (§8): a document cannot declare them, and without them an expression reads `self` and `shown` only." And: "`generateElementsSchema(catalog, { local? })`: with `local` the schema describes `when`, `bind`, the tree expression grammar and the local intents. Without it the schema is unchanged."
- §8 Local state, after "Templates (§7.6) copy…": "**Element JSON (§7.2)** carries `when`, `bind` and local intents as written, checked against the `local` the caller supplied to `ephemeralManifest`."

### Budget

- A document without expressions costs what it costs today: `bench/stream-elements.bench.ts` and an A/B run of `renderElements` on agent-home within 2% (`bench/ab.ts`).
- A new bench row runs the agent-home document with a filter field and one `when` on each of its rows. There, `renderElements` takes at most 1.3× the expression-free document, and `streamElements` stays within its existing 3× budget of its own `renderElements`.

### Laws

- **Law 1:** expressions are the closed tree allow-list, evaluated with fuel (`src/surface/bindings.ts:14`). Nothing the agent writes runs as code.
- **Law 2:** the tree passes the compiled validator, and each bound value is re-validated before an implementation sees it (§8).
- **Law 3:** `bind` cannot reach `variant` or style props (§8, unchanged).
- **Law 4:** `local` belongs to the caller. `setLocal` never reaches the host, and `checkOffered` rejects a posted `local` or `fromLocal` (already).

### Tests Task 2 writes

`element_json_live_filter_hides_rows_without_a_round_trip`, `element_json_cannot_declare_local` (`invalid-prop` at `/local`), `expression_reading_an_undeclared_local_key_is_unknown_name`, `element_json_without_local_reads_self_only`, `ephemeral_manifest_requires_initial_local_with_local`, `stream_draws_a_bound_shell_with_its_expressions`, `stream_enforces_the_tree_expression_bound`, `element_json_accepts_from_local_and_compound_local_writes`, `elements_schema_without_local_is_unchanged`, `generated_schema_accepts_the_valid_corpus_and_rejects_the_invalid` (with `ajv`), and the type-level `elements_type_accepts_set_local_and_rejects_binding_a_ref_prop`.

---

## 2. F10 — A catalog digest for agents

### Form

```ts
// @arnilo/liveframe/sdk/gen
export function generateDigest(
  catalog: Catalog,
  options?: { readonly capabilities?: Capabilities; readonly local?: ObjectSchema; readonly budget?: number },
): string; // throws LiveframeFailure(limit-exceeded at "/digest") when over budget
```

```bash
liveframe gen <catalog> --digest [--capabilities <file>] [--local <file>] [--budget <chars>] --out <file> [--check]
```

### Contents, in this order (G.1)

1. A header: `# <catalogId>`, a line saying the file is generated and must not be edited, and one sentence on what element JSON is.
2. **Writing element JSON:** the envelope `{ kind, key?, props?, style?, variant?, events?, when?, bind?, focus?, children? }`, a 10–15 line example built from the catalog's own first container and first text kind (so it is always valid for that catalog), the intent forms (`setState`, `action` with `bind`/`bindAll`/`fromLocal`, and `setLocal` only when `local` is given), and keys and `$ref`.
3. **Expressions,** only when `local` is given: the allowed operators in one line, the roots (`local.<keys>` with their types, `self.<prop>`, `shown`), and the limits.
4. **Style values:** each style prop's value rule once (for example "padding*, margin*, gap: space names `none, xs, sm, …`"; "surface: `canvas, raised, …`"), followed by breakpoints and the responsive form.
5. **Kinds,** in catalog order. For each kind:
   - `### kind` and `(deprecated: <reason>)` when it is deprecated.
   - The description.
   - `props:` as `name?: type` with bounds (`string≤80`, `integer 1..6`, enums as `a|b`, `url(https, relative)`, `ref` for `refProps`), deprecated props marked.
   - `variants:` and `axes:`.
   - `events:` with what each carries.
   - `children:` (`none`, `any`, or `kind min..max`).
   - `style:` as the names of the style props it takes.

   Slots and recipes are left out, because an agent cannot set them.
6. **Actions** and **sources,** when `capabilities` is given: name, description, `args` or `params` → `result` in the same type notation, and `confirm`/`irreversible` flags.

### Rules

- **G.2 Deterministic.** The bytes depend only on the documents' content, in catalog order for kinds and in sorted key order for props, actions and sources. A copy of the catalog with its object keys reordered gives the same text. Lines end in `\n`, and the file ends with one.
- **G.3 One source.** The digest reads the validated `Catalog`, `Capabilities` and `ObjectSchema`, the same definitions `generate()` reads. It shares `gen.ts`'s schema walk, and nothing is described by hand.
- **G.4 Budget.** `budget` counts characters (JavaScript string length). Over budget, the call throws `LiveframeFailure` with `limit-exceeded` at `/digest`, expected `at most <budget> characters, got <n>`. The CLI exits 1 with that message. The text is never cut.
- **G.5 What it never holds:** file paths, theme or design-system values (they are not inputs), recipe or slot data, capability `meta`, and implementation details. The app chooses what to describe by what it passes in (no `meta` reading, spec §7.3).
- **G.6 Drift.** `gen:check` checks `src/__tests__/fixtures/widgets/catalog.digest.md` (proof catalog with the fixture capabilities, `--budget 20000`) and `packages/starter/src/catalog.digest.md` (starter catalog, `--budget 24000`). The starter ships the file as `./catalog.digest.md` in `exports` and `files`.
- **G.7 MCP.** `generated_types` accepts `module: "digest"`, built from the server's catalog and capabilities. Its note names `catalog.digest.md`.
- **G.8 Acceptance.** `scripts/agent-acceptance/` gains a run where the agent's only description of the catalog is the digest. It writes element JSON for a filtered task list, which the host renders with `renderElements`. The outcome is recorded in `plans/evidence/039-agent-acceptance.md`.

### Spec text

- §7.2 emitters: "`generateDigest(catalog, { capabilities?, local?, budget? })`, and `liveframe gen --digest`, write a deterministic Markdown description of the catalog for an agent that writes element JSON without MCP: kinds, props with bounds, variants, events and their carries, child rules, style values, and the declared actions and sources. Over `budget` characters it fails and never truncates."
- §13 MCP: "`generated_types` also returns the digest (`module: "digest"`)."
- §14, the agent-tooling line becomes: "Agent tooling beyond generated catalog modules (typed components, definitions, JSON Schemas and the digest), structured validation errors, preview capture (§7.5) and the authoring MCP server (§13)." **The owner must answer.**

### Budget

Generation is one pass over the documents, linear in catalog size. The size budgets are in G.6. `bun run gen:check` grows by two runs of a few milliseconds each.

### Laws

- **Law 1:** nothing runs. The digest is text.
- **Law 2:** the digest grants nothing. Element JSON written from it still passes the compiled validator.
- **Law 3:** no theme or design-system values are included (G.5).
- **Law 4:** actions are described, not offered. A manifest still has to declare them, and the host authorises them.

### Tests Task 3 writes

`digest_names_every_kind_prop_variant_event_action_and_source`, `digest_is_deterministic` (two runs; a reordered-key copy), `digest_over_budget_fails_with_the_overrun`, `digest_holds_no_paths_and_no_design_values` (a scan for `/` absolute paths, `file:`, `#` hex colours and `--lf-`), `digest_example_renders_through_render_elements` (the example in section 2 parses and renders for the proof and starter catalogs), `digest_lists_local_keys_only_when_given`, `gen_check_detects_a_stale_digest`, and `mcp_generated_types_returns_the_digest`.

---

## 3. F11 — The A2UI converter (`@arnilo/liveframe-a2ui`)

### Form

```ts
export function fromA2ui(
  messages: string | readonly unknown[],   // JSONL text (A2UI's stream form), or parsed messages
  mapping: A2uiMapping,
  options?: { readonly limits?: RenderLimits; readonly maxErrors?: number },
): Result<{
  readonly elements: Json;                          // element JSON, for renderElements
  readonly initialLocal: Readonly<Record<string, Json>>; // values for mapped local keys, read from the data model
  readonly origins: Readonly<Record<string, string>>;    // element pointer → A2UI pointer
}>;

export type A2uiMapping = {
  readonly catalogId: string;                                   // the A2UI catalogId createSurface must name
  readonly components: Readonly<Record<string, A2uiComponent>>; // A2UI component name → how to convert it
  readonly actions?: Readonly<Record<string, string>>;          // A2UI event name → manifest action name
  readonly local?: Readonly<Record<string, string>>;            // A2UI data path (JSON Pointer) → local key
  readonly drop?: readonly ("theme" | "weight" | "checks")[];   // constructs the app knowingly discards
};
export type A2uiComponent = {
  readonly kind: string;                                // catalog kind
  readonly props?: Readonly<Record<string, string>>;   // A2UI property (or "accessibility.label") → catalog prop
  readonly variants?: Readonly<Record<string, string>>; // A2UI variant value → catalog variant
  readonly children?: readonly string[];               // ComponentId / ChildList properties, in child order (default ["children", "child"])
  readonly lift?: Readonly<Record<string, string>>;    // ComponentId property → catalog prop taking the referenced component's `text`
  readonly items?: Readonly<Record<string, { kind: string; props?: Readonly<Record<string, string>>; child?: string }>>; // arrays of objects (Tabs.tabs)
  readonly event?: string;                             // the catalog event an A2UI `action` attaches to
  readonly input?: { readonly prop: string; readonly event: string }; // two-way bound value → bind + setLocal when the path is in `local`
};
```

```ts
const converted = fromA2ui(jsonl, {
  catalogId: "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json",
  components: {
    Column: { kind: "stack" },
    Text: { kind: "text", props: { text: "text" } },
    Button: { kind: "button", lift: { child: "label" }, variants: { primary: "primary", borderless: "ghost", default: "default" }, event: "onPress" },
  },
  actions: { claim: "tasks.claim" },
});
if (converted.ok) renderElements(converted.value.elements, { validator, surfaceId, revision });
```

### Rules

- **A.1 Input and bounds.**
  - A string is JSONL: one message per non-empty line, at most `4 × limits.bytes` characters before parsing (the bound `streamElements` uses), and each line is parsed with `JSON.parse`.
  - An array is walked once with a counter: at most `limits.nodes × 8` JSON values and depth 128.
  - Over a bound is `limit-exceeded` at `/`.
  - Pointers address the message array: `/<message index>/updateComponents/components/<j>/<prop>`.
- **A.2 Messages.**
  - Every message has `version` `"v0.9"` or `"v0.9.1"`; any other value is `invalid-document` at `/<i>/version`.
  - The input holds exactly one `createSurface`. Its `catalogId` must equal `mapping.catalogId` (`invalid-document` at `/<i>/createSurface/catalogId`), it may not set `sendDataModel: true`, and it may not carry `theme` unless `drop` lists `"theme"`.
  - `updateComponents` messages merge by `id`, later replacing earlier, as A2UI specifies.
  - `updateDataModel` messages apply in order: the value at `path`, default `/`, is set, or removed when `value` is absent.
  - `deleteSurface` and any second `surfaceId` are `invalid-document`.
- **A.3 Tree.**
  - The tree starts at the component with `id: "root"`; without one it is `not-found` at `/`.
  - Each component is reached through its mapping's `children`, `lift` and `items` properties. A component reached twice, or a cycle, is `invalid-document` at the second reference.
  - A component never reached is `invalid-document` at its pointer ("a component reachable from root"), so nothing is dropped silently.
  - The A2UI `id` becomes the element `key`, which keeps node ids stable across re-conversions.
- **A.4 Children templates.**
  - `{ componentId, path }` expands once per item of the data array at `path`, at most 1,000 items (`limit-exceeded`).
  - Relative paths inside the template resolve against the item, as A2UI specifies.
  - Keys are `<componentId>-<index>`.
- **A.5 Components and props.**
  - A component whose name is not in `mapping.components` is `unknown-component` at `/…/component`.
  - Each A2UI property other than `id`, `component`, the declared child properties and `action` must be renamed by `props`, or be `accessibility.label` mapped the same way. Otherwise it is `unknown-name` at that property ("a mapped property").
  - `weight` and `checks` may instead be named in `drop`.
  - A `variant` value missing from `variants` is `unknown-name`.
  - `Icon.name` given as `{ svgPath }` is always refused (`invalid-document`).
- **A.6 Dynamic values.**
  - A literal passes as itself.
  - `{ path }` resolves to the data model's value at conversion; an unresolved path is `not-found`.
  - `{ call: "formatString", args: { value } }` resolves at conversion, but only when every `${…}` inside it is a data path. A function call inside a `${…}` is refused.
  - Every other `call` is `unknown-name` at `/…/call` ("a function the converter evaluates: formatString over data paths").
- **A.7 Inputs.**
  - When a component maps `input` and its bound property is `{ path }` with that path in `mapping.local`, the element gets the resolved value in `props`, a `bind: { <prop>: { "$path": "local.<key>" } }` and `events[input.event] = { "type": "setLocal", "key": "<key>" }`.
  - `initialLocal[key]` takes the resolved value.
  - The caller supplies the `local` schema to `ephemeralManifest` (F9 E.5). The converter never writes one.
  - Without a `local` entry, the input gets only the literal initial value.
- **A.8 Actions.**
  - `action.event.name` must be in `mapping.actions` (`unknown-name`). The action is attached to `mapping.components[X].event` (`invalid-document` when there is none) as `{ type: "action", action: <mapped name>, args }`.
  - Each literal `context` value becomes an argument.
  - A `context` value that is a `{ path }` listed in `mapping.local` becomes `fromLocal: { <arg>: <key> }`.
  - Any other `{ path }` in a context is `unknown-name` at that value ("a path mapped to a local key"). Resolving it at conversion would send a stale value as if it were the user's input.
  - `action.functionCall` is refused (`invalid-document`).
- **A.9 Output.** The result is element JSON and nothing else. The converter checks shape only. Kinds, props, bounds, actions and `local` keys are checked by `renderElements` against the app's validator, and the README says so. `origins` lets the host rewrite a `renderElements` pointer to the A2UI pointer that produced it.
- **A.10 Package.**
  - `packages/a2ui` releases in lockstep with the core and peers on `@arnilo/liveframe` `~0.4.0`. It imports only `@arnilo/liveframe` and `/sdk` types, and it has no runtime dependency.
  - The core gains no A2UI knowledge and no export.
  - The README carries a worked mapping for the starter catalog. The package does not export one, so it never depends on the starter.

### Spec text

- §9, the converter sentence becomes: "`@arnilo/liveframe-a2ui` converts an A2UI v0.9/v0.9.1 document to element JSON through an app-supplied mapping (§13). Its output is validated like any element JSON."
- §13: "Four packages, one version", adding the `@arnilo/liveframe-a2ui` row: "`fromA2ui(messages, mapping)`: A2UI v0.9.1 → element JSON, snapshot only. Client functions, themes, SVG paths and data-model upload are refused."
- §14: remove "A2UI or other wire interop." Add: "Wire formats other than A2UI v0.9/v0.9.1 through `@arnilo/liveframe-a2ui`, and converting A2UI incrementally."

### Budget

Conversion is linear in input size plus template expansion, which `limits.nodes` bounds. A bench row converts a 500-component document, a test asserts the operation count is linear (plan 033 Task 9 style, no timer), and a bench row records the time.

### Laws

- **Law 1:** no A2UI function runs anywhere. `formatString` over data paths is string substitution at conversion, and everything else is refused (A.6, A.8).
- **Law 2:** the output passes the app's compiled validator before it is drawn (A.9). The converter is not trusted to validate.
- **Law 3:** `theme`, `svgPath` and `weight` never reach the tree (A.2, A.5). Style comes only from the catalog's style props, which the validator checks.
- **Law 4:** an A2UI event maps only to an action the app's mapping names, and the manifest must declare it (`undeclared-action` otherwise). `sendDataModel` is refused. Context paths become `fromLocal`, which the host re-checks (`checkOffered`).

### What stays the app's

The component mapping, the `local` schema, transport, surface lifecycle (`createSurface`/`deleteSurface` on the host's own routes) and the A2UI catalog it negotiates with the agent.

### Tests Task 4 writes

- `a2ui_document_converts_and_renders_through_the_starter_catalog`, `a2ui_template_children_expand_with_stable_keys`, `a2ui_input_with_a_mapped_path_becomes_a_local_binding` and `unmapped_component_is_a_typed_error_with_its_pointer`.
- One test per refused construct: `function_call`, `functionCall action`, `checks`, `theme`, `sendDataModel`, `svgPath`, `weight`, `deleteSurface`, `two surfaces`, `shared component`, `unreachable component`, `unsupported version`, and `context path without local`.
- `dropped_constructs_are_only_those_named`, `hostile_document_is_bounded_and_yields_no_tree` (deep nesting, a huge string, 10⁶ components, script-like values carried as inert strings), `converted_action_must_be_declared_by_the_manifest` (`undeclared-action`), `origins_map_render_errors_back_to_a2ui`, `conversion_is_linear` (operation count), and `package_archives_and_installs`.

---

## 4. F12 — Starter primitives

### The rule-2 test

A kind is added only when the browser must do something no composition of existing kinds can do.

| Kind | What the browser must do | Composition rejected because |
| --- | --- | --- |
| `radioGroup` + `radio` | Roving focus, arrow-key selection, one tab stop, and the group's accessible name (`role="radiogroup"`/`radio`) | `button` with `pressed` gives one tab stop per option and no group semantics |
| `slider` | Pointer drag, keyboard steps, and `role="slider"` with `aria-valuenow`/`min`/`max`/`valuetext` | No kind tracks a pointer |
| `progress` | `role="progressbar"` with its value and an indeterminate state, and a fill proportional to the value | `progressbar` needs value state, so it is outside the `ariaRoles` allowlist. A widget cannot size a fill, because style props take only design-value names (law 3) |
| `dateField` | Locale-ordered editable date segments, keyboard increment and validation | `textField` gives no segments, no locale order and no date semantics |
| `richText` | Inline mixed emphasis, code, links and lists inside one text flow, with the right elements | `inline` of `text` nodes is a flex row: it breaks line wrapping and has no `<em>`/`<strong>`/`<code>`/list semantics |
| `chart` | Drawing SVG geometry from numbers | No kind draws geometry |
| `table` + `tableRow` + `tableCell` | Column layout and header association (`<th scope>`) | The roles need required context, so `semantics` cannot carry them, and `grid` cannot associate headers |

### 4.1 Controls (Task 5)

Every control has `label` (required, `str ≤ 80`) and `disabled?: bool`, slots `root` and `label`, `a11y` naming the role, the `default` variant only, and form-control style props like `select`'s.

- **C.1 `radioGroup`.**
  - Props: `value?: str ≤ 128 | null`, `orientation?: vertical|horizontal` (default `vertical`), and `describedBy` (`refProps`, like `textField`).
  - Children: `radio`, 2..32.
  - Event: `onChange` carries `str ≤ 128`. It is raised when the selection changes, and it is the group's only event.
  - Implementation: `Aria.RadioGroup`.
  - States: `focus` (within), `disabled`, `invalid`.
- **C.2 `radio`.**
  - Props: `value: str ≤ 128` (required), `label`, `disabled?`.
  - Children: none. Events: none.
  - Slots: `root`, `indicator`, `label`.
  - Implementation: `Aria.Radio`. The catalog format has child rules but no parent rules, so a `box` (`children: "any"`) can hold a stray `radio`. Outside a group, the implementation draws nothing and throws, and the renderer's per-node error containment (§11) reports it. A test pins this. A "parent rule" for definitions is backlogged, not built.
  - States: `selected` (`[data-selected]`), `hover`, `active` (`[data-pressed]`), `focus` (`[data-focus-visible]`), `disabled`.
- **C.3 `slider`.**
  - Props: `value: num` (required), `minimum?: num` (default 0), `maximum?: num` (default 100), `step?: num ≥ 0.000001` (default 1), `valueText?: str ≤ 80`.
  - Event: `onChange` carries `num`. It is raised from RAC's `onChangeEnd` (pointer release or each key step), never while dragging (tier 1 keeps the drag local).
  - The host checks the target's bounds (§8).
  - Slots: `root`, `label`, `track`, `fill`, `thumb`, `output`.
  - Implementation: `Aria.Slider`/`SliderTrack`/`SliderThumb`/`SliderOutput`. The thumb's `isDragging` is exposed as `data-pressed`, so `active` styles it.
  - The fill is the one geometry the implementation computes: inline `inset-inline-end: <100−p>%`, no colour, as plan 038 F7's scroll spacer computes geometry.
  - A `minimum ≥ maximum` cannot be checked by a schema. The implementation clamps and draws `minimum`, and a renderer test pins this.
- **C.4 `progress`.**
  - Props: `value?: num | null` (absent or null ⇒ indeterminate), `minimum?`, `maximum?` (defaults 0, 100), `valueText?: str ≤ 80`.
  - Events: none.
  - Slots: `root`, `label`, `track`, `fill`.
  - Implementation: `Aria.ProgressBar`, with fill geometry as in C.3.
  - Indeterminate state: `mixed` styles it, because the implementation sets `data-mixed` when `isIndeterminate`. Its animation comes from the recipe's own transition, and reduced motion removes it (§6.4).
- **C.5 `dateField`.**
  - Props: `value?: str | null` (`maxLength: 10`, `pattern: "^\\d{4}-\\d{2}-\\d{2}$"`, an ISO 8601 calendar date), `minimum?` and `maximum?` (same form), `readOnly?`, `describedBy`.
  - Event: `onChange` carries `str ≤ 10` with the same pattern, or `null` when cleared. It is raised only for a complete date (RAC gives `null` while segments are incomplete, which raises nothing). The host's schema checks it.
  - Slots: `root`, `label`, `input`, `segment`.
  - Implementation: `Aria.DateField`/`DateInput`/`DateSegment`, with `parseDate` from `@internationalized/date` and `granularity="day"`.
  - A `value` that `parseDate` rejects (for example `2026-02-30`, which passes the pattern) draws an empty field, never a stale or guessed date.
  - States: `focus`, `invalid` (`[data-invalid]`), `readonly`, `disabled`.
- **C.6 Recipes and suites.** The starter design system gains recipes for every declared variant, slot and state, plus examples for every kind and styled state. `catalogSuite`, `designSystemSuite`, `rendererSuite` and `rendererBrowserSuite` pass, and `classifyCatalogChange` reports a minor change (added kinds).

### 4.2 Content kinds (Task 6)

- **T.1 `richText`.**
  - Props: `text: str ≤ 4000` (required) and `headingLevel?: int 2..6` (default 3, the level `#` maps to).
  - Children: none. Slots: `root`, `paragraph`, `heading`, `list`, `item`, `code`, `link`.
- **T.2 Subset,** a closed token set in `packages/starter/src/rich-text.ts`:
  - Paragraphs split by blank lines.
  - Headings: `#`, `##`, `###` at line start, which become `headingLevel` + 0, 1 and 2, capped at 6.
  - Lists: one level of `- `/`* ` (unordered) or `1. ` (ordered) items.
  - Inline: `**strong**`, `*em*`/`_em_`, `` `code` ``, `[label](target)`.
  - Backslash escapes for `\ * _ ` [ ] ( ) #`.
  - Nothing else: no HTML, images, tables, block quotes, nesting beyond strong-around-em, or autolinks.
  - An opener with no closer on its line is literal text.
- **T.3 Linear parse.** One pass from the end of each line records the next position of each delimiter, so every opener finds its closer in O(1). The parse is O(n), and a test counts operations (no timer).
- **T.4 No HTML path.**
  - The parser returns a token tree, and the implementation renders React elements from it, so every character of the string reaches the DOM as text.
  - A link target is drawn as an `<a>` only when `checkUrl(target, { schemes: ["https"], relative: true })` (the starter `link.href` rule) passes and the target holds no control characters (C0/C1/DEL, which `checkUrl` already rejects). Otherwise the whole `[label](target)` is drawn as text.
  - A source-scan test fails on `dangerouslySetInnerHTML`, `innerHTML` or `outerHTML` anywhere under `packages/starter/src`.
- **T.5 `chart`.**
  - Props: `label: str ≤ 80` (required, the accessible name), `type: bar|line` (required), `labels: arr(str ≤ 24, maxItems 100)` (required), `series: arr(obj({ name: str ≤ 40, values: arr(num, maxItems 100) }), minItems 1, maxItems 4)` (required) and `summary?: str ≤ 500`.
  - Children: none. Events: none.
  - Slots: `root`, `plot`, `axis`, `gridline`, `series1`…`series4`, `legend`.
  - Implementation: SVG with `role="img"`, `aria-label={label}`, `<title>` holding the label and `<desc>` holding the `summary` followed by a generated text alternative ("<series>: <label> <value>, …", bounded by the 400-point maximum). It uses a `viewBox` with width 100%, and its height comes from the root recipe's `height` (a `size.*` value).
  - Scales are computed in the implementation, with a zero baseline and nice ticks. A series shorter than `labels` draws only its points. Non-finite values cannot arrive, because the schema rejects them.
  - Each series group carries its slot class and draws with `currentColor`, so the colour is recipe data (law 3) and a theme switch recolours it with no re-render.
  - No drawing option exists beyond these props.
- **T.6 Table kinds.**
  - `table`: props `label: str ≤ 80` (required, `aria-label`) and `caption?: str ≤ 200` (a visible `<caption>`); children `tableRow` 1..500; slots `root`, `caption`.
  - `tableRow`: children `tableCell` 1..32; slot `root`.
  - `tableCell`: props `header?: column|row` (`<th scope="col|row">`, else `<td>`) and `span?: int 1..32` (`colSpan`); children `any`; slot `root`.
  - All three use native `<table>`, `<tr>`, `<th>` and `<td>`. React Aria `Table` is not used: it is an interactive grid with selection and cell focus, and a static data table needs none of that. An interactive table is backlogged.
- **T.7 Dependency.** None.

### Budget

The starter design system's projected CSS grows by an amount Task 5 and Task 6 each record (spec §5 cites about 8 KB per kind and variant in the proof systems). The switch budget of `packages/starter/src/__tests__/switch.test.tsx` holds. `richText` at 4,000 characters parses in linear operations. A `chart` at 4 × 100 points renders within one frame (16 ms) in the production profile, recorded in a bench row.

### Laws

- **Law 1:** the implementations are trusted host code. No widget code reaches the browser.
- **Law 2:** every prop is schema-bounded. `richText` draws text, never HTML (T.4). Link targets pass `checkUrl`, and `dateField` values are pattern-checked and parsed (C.5).
- **Law 3:** every colour and dimension comes from recipes. The implementations compute geometry only (fill positions and chart scales) and never a colour. The completeness and "no colour outside the theme" checks cover the new kinds.
- **Law 4:** controls raise only their declared events, each carrying the declared type. The host re-checks the filled intent.

### What stays the app's

Primitives beyond this list (`meter`, an interactive table, a full Markdown renderer, a real charting engine), chart data shaping (aggregation, ordering, units), and any icon set.

### Tests Tasks 5–6 write

- Task 5: `starter_passes_every_suite_with_the_new_controls` (server and browser), `each_new_control_raises_one_complete_intent`, `each_new_control_exposes_its_states_through_the_selector_table`, `adding_the_controls_is_a_minor_catalog_change`, `slider_with_inverted_bounds_clamps`, `date_field_impossible_date_draws_empty` and the type-level wrong-value test.
- Task 6: `starter_passes_every_suite_with_the_content_kinds`, `formatted_text_draws_no_html_from_its_string`, `link_outside_the_scheme_allowlist_is_drawn_as_text`, `rich_text_parse_is_linear`, `chart_has_a_name_and_a_text_alternative`, `chart_colours_come_from_the_design_system`, `table_headers_carry_their_scope` and `starter_source_has_no_inner_html`.

### Spec text

- §5 (primitive set): a sentence saying that the starter's primitive list grows in 0.4.0 and is the starter's, not the library's. The core still ships no components (§3).
- §7.2 or the root-exports list: "`checkUrl(value, rule)` and `UrlRule`: the `url` check (§5) for a trusted implementation that draws a link from text."
- `docs/security.md`: what `richText` accepts and how it draws links.

---

## 5. Register and packages

- `scripts/release/api/register-0.4.0.json` gains `added` entries for:
  - `ephemeralManifest`'s `local` and `initialLocal`.
  - `generateElementsSchema`'s options.
  - `generateDigest`.
  - `checkUrl` and `UrlRule`.
  - The widened `Elements` type.
- The starter's baseline successor records the eight kinds, `./catalog.digest.md` and the `@internationalized/date` peer.
- `scripts/release/api/0.4.0-a2ui.json` is generated at release, with a placeholder rule until then.

## 6. Owner questions

1. Approve the design (F9–F12 as summarised in the table).
2. The §14 agent-tooling line: reword it to name the digest (F10 goes ahead), or keep it (Task 3 closes without code).
3. The F11 non-goal: already lifted on 2026-11-15. Confirm the scope trims (v0.9/v0.9.1 only, snapshot only, the refused list).
