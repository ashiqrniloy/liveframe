# 037 Interaction design: compound local writes, `fromLocal`, array carries, focus mark, store CAS and filtered empty state

Design for plan 037 Task 1 (`0.4.0`). Extends `docs/spec.md` §5, §7.2, §7.4, §7.6, §7.7, §8, §9, §9.1, §10, §11 and §13, building on [`plans/evidence/029-interaction-design.md`](029-interaction-design.md) (`L1`–`L7`, `B1`–`B13`, `A1`–`A9`, `W1`–`W4`). Rules are numbered per capability (`F1.*`, `F2.*`, `F3.*`, `F4.*`, `G2.*`, `E.*`) so Tasks 2–8 can cite them directly.

---

## Summary of open questions (with decisions and reasons)

| Item | Question | Decision | Reason |
| --- | --- | --- | --- |
| **F1** | May a local write be marked to hold only until the next accepted revision? | **Yes** (`until?: "revision"`). | Local state survives revisions of the same `surfaceId` (`L5`) so filters are not wiped; without `until: "revision"`, optimistic flags like `local.saving = true` have no way to clear when the host replies with a new tree. |
| **F1** | What happens to local writes when the host refuses the intent? | **Confirmation refusal writes nothing; host refusal leaves permanent writes in place, and `until: "revision"` reverts on the next accepted revision (including a refusal re-render).** | `confirm` runs before `local` writes apply so cancelled actions leave no phantom state. `onIntent` returns no `Result` back to `<Surface>`; `handleIntent` re-renders with `actions[key] = { status: "refused" }`, which is an accepted revision that triggers the revert. Permanent local writes (no `until`) are browser UI state, not a host transaction. |
| **F1** | Does the completed intent the host receives show the local writes at all? | **No.** | Law 4 and `checkOffered`: `local` is browser-only state. `complete()` strips `local`, and `checkOffered` rejects any posted `local` field (`invalid-prop` at `/local`). |
| **F2** | May `setState` read from `local` as an action may? | **Yes** (`fromLocal?: string` on `setState`, mutually exclusive with literal `value` and event fill). | A tier-2 widget using `state` (such as a separate "Apply" button committing a `local` draft into persisted `state`) otherwise needs an extra action just to copy one local scalar. Reuses `complete()` and `checkOffered` with the same scalar fit and host re-check rules. |
| **F3** | What item types and `maxItems` does an array carry allow, and how does it fit `bind`, `bindAll` and implicit `setState`? | **Scalar `items` (`string` with `maxLength`, `boolean`, `number`, `integer`, each optionally `nullable`), `maxItems` 1–256.** Fits `bind` (array arg) and implicit `setState` (array state key); rejected for `bindAll` (`invalid-prop` at `/bindAll`) and implicit `setLocal` (`invalid-prop` at `/value`). | Matches the schema language's `256` item bound and bounds event payloads inside the intent's byte budget. Arrays have no named keys to merge into `args` (`bindAll`), and `local` holds scalars only (`L1`). |
| **F4** | When is a focus mark applied, and what happens when the marked node renders no element? | **Never on the first drawn tree of a surface load (or after `surfaceId` changes); applied only on subsequent accepted revisions of the same `surfaceId` when `tree.focus !== prev.focus` and `tree.focus !== undefined`.** Missing/unfocusable element is **skipped and reported via `onEvent` (`focus-missed`)**. | Persisted state (e.g. `state.adding === true`) or multi-widget dashboards and 12-cell `<Preview>` grids must not hijack focus on initial page load (WAI-ARIA APG). Skipping missing elements without throwing preserves surface availability while surfacing primitive `domId` bugs to hosts. |
| **G2** | What is `putStateIf`'s shape and how many times does `handleIntent` retry? | **`putStateIf?(placementId, scope, expected: Json \| undefined, next): Promise<boolean>`.** `handleIntent` tries **up to 4 attempts total** (1 initial + 3 retries), then fails with `version-conflict` at `/state` and `intent-refused` (`reason: "conflict"`). | Comparing canonical JSON avoids breaking `getState`'s return type or requiring a callback inside remote stores. Four attempts resolve a 4-way concurrent burst while bounding latency if a store always returns `false`. |
| **Empty state** | Which of the backlog's three candidates is taken? | **Candidate 1: bounded read-only sibling count as a third expression root `shown` (`{ $path: "shown" }` / `shown()`).** | Documenting `setState` keeps the round-trip cliff; an aggregate `local` key forces dummy writable keys and collides across two lists. A read-only root needs no new operator, stays data-only, and works across multiple lists. |

---

## Restated §8 Rule 1 (for owner approval)

Current `docs/spec.md` §8 Rule 1:
> 1. **One intent per event.**

Restated `docs/spec.md` §8 Rule 1:
> 1. **One host intent per event.** An event offers either one local write (`setLocal`), or one host intent (`setState` or `action`) with optional renderer-applied `local` writes that never reach the host.

---

## 1. F1 — Compound intents: local writes on a host intent

### Ruled-out compositions
- **Two events on one primitive (`onPress` + `onPressStart`):** Existing definitions expose one event per user interaction (e.g. `Button.onPress`); adding a second event per primitive is per-catalog, non-atomic, and breaks keyboard vs pointer parity.
- **Array of intents per event (`Intent[]`):** Ends "one host intent per event" and forces the host to define multi-intent ordering and partial failure semantics.
- **`setLocal` with a `then` intent:** Forces `checkOffered` and transport to look past a renderer-only wrapper to find the offered host intent.

### Wire form (`liveframe/1` and `liveframe/tree-patch/1`)
- Type additions (`src/formats/tree.ts`):
  ```ts
  export type LocalWrite = {
    readonly key: string;
    readonly value?: Json;
    readonly until?: "revision";
  };
  // Added as an optional field on both branches of Intent:
  // readonly local?: readonly LocalWrite[];
  ```
- JSON Schema (`schemas/ui-tree.json`, `schemas/tree-patch.json`):
  - `$defs.localWrite`: closed object (`additionalProperties: false`), `required: ["key"]`, properties `{ key: name, value: json, until: { type: "string", enum: ["revision"] } }`.
  - Both `setState` and `action` branches of `$defs.intent.oneOf` gain optional property:
    `local: { type: "array", minItems: 1, maxItems: 4, items: { $ref: "#/$defs/localWrite" } }`.
- `TreePatch` `set` and `insert` carry node `events` unchanged, so `local` rides inside `events` with no patch-op schema change.

### SDK, element JSON and template form
- **TSX SDK (`src/sdk/intents.ts`, `src/sdk/bindings.ts`):**
  - `local.set(key, value?, options?)`: third optional argument `{ readonly until?: "revision" }`.
    - When `options?.until` is omitted: returns `LocalIntent` (`{ type: "setLocal", key, value? }`), valid both standalone (`onChange={local.set("q")}`) and inside `local: [...]`.
    - When `options?.until === "revision"`: returns `LocalWrite` (without `type: "setLocal"`), so TypeScript rejects passing `{ until: "revision" }` directly to an event prop that expects `TreeIntent`.
  - `action(name, args?, options?)` and `state.set(key, value?, options?)` accept `local?: readonly (LocalIntent | LocalWrite)[]` (1 to 4 entries; passing `until` on `LocalIntent` or `LocalWrite` normalizes to `{ key, ...(value !== undefined ? { value } : {}), ...(until ? { until } : {}) }`; an empty array or >4 throws `TypeError` at construction, and non-JSON values fail `assertJson`).
  - `liveframe gen` (`src/sdk/gen.ts`): manifest-typed `action` and `state.set` overloads constrain `local[i].key` to `keyof Manifest["local"]` and `value` to the property's type.
- **Template (`liveframe-template/1`, `src/template/document.ts`):**
  - `setState` and `action` intents in `events` may carry `local?: TemplateLocalWrite[]` (1 to 4 entries). Each entry has static `key`, optional `value?: Expr` (checked against `manifest.local.properties[key]`), and optional `until?: "revision"`. Expansion evaluates each `value` expression to a `Json` literal.
- **Element JSON (`generateElementsSchema` / `generateTemplateSchema`):** `intentSchemas()` adds `local` to `setState` and `action` schemas. (Ephemeral element-JSON manifests declare no `local`, so any `local` write there fails `unknown-name` at `key` until plan 039 Task 2 addresses `local` for element JSON.)

### Rules, validation, limits and host checks
- **F1.1 Validation (`compileIntents` in `src/validate/intent.ts`):**
  - Allowed only on `setState` and `action` (never on `setLocal`, which reports `invalid-prop` at `/until` or `/local` via closed field sets).
  - `local` must be an array (`invalid-prop` at `/local`), length `1..4`: `0` items is `invalid-prop` at `/local`; `> 4` items is `limit-exceeded` at `/local`.
  - Each item is a closed object `{ key, value?, until? }` (`invalid-prop` at `/local/<i>/<field>` for unknown fields or bad `until`).
  - `key` must exist in `manifest.local.properties` (`unknown-name` at `/local/<i>/key`).
  - If `value` is present: checked against `manifest.local.properties[key]` (`invalid-prop` at `/local/<i>/value`).
  - If `value` is absent: `carriesFits(carries, localProp.type)` must hold (`invalid-prop` at `/local/<i>/value`). (Multiple writes in one `local` array may omit `value`; each takes the event's carried value.)
- **F1.2 Emit order & atomicity (`src/surface/core.ts`):**
  1. Check `carries` on `value` (`emit-rejected` `"invalid-value"`, throws).
  2. If `confirm` is configured and `meta.confirm` is true, run `confirm` **before** applying `local` writes; if cancelled, thrown, or unmounted, write nothing and raise nothing.
  3. Validate **all** `local` writes against `manifest.local` schemas before mutating `core.local`; if any fails, emit `emit-rejected` (`"invalid-local"`), throw, mutate nothing, and do **not** call `onIntent`.
  4. Apply all `local` writes in array order in one state update (`core.local` updated once, bound nodes rebuilt once, subscribers notified once). For each write with `until: "revision"`, record the pre-write value of `key` in `pendingRevert` (preserving the earliest pre-write value if `key` was already pending revert); for any write *without* `until: "revision"`, delete `key` from `pendingRevert` (a newer permanent write supersedes any pending revert, as does a subsequent `setLocal` to that key).
  5. Strip `local` in `complete()` and call `raise(core, completed, origin, meta)`.
- **F1.3 Revision revert:** When `stage`/`commit` accepts a new arrival for the **same** `surfaceId` (`arrival.ok`, not `kept()`, not `stale-revision`), restore every key in `pendingRevert` to its recorded pre-write value and clear `pendingRevert` before building the new revision's contexts. Rejected arrivals, stale revisions, and identical repeated tree objects do **not** revert `pendingRevert`. A new `surfaceId` or validator resets `local` to `initialLocal` and clears `pendingRevert`.
- **F1.4 Host check (`checkOffered` in `src/validate/offered.ts`):**
  - `complete()` removes `local`.
  - `checkOffered` rejects any completed intent carrying `local` with `invalid-prop` at `/local` (`"Expected a completed intent"`).
  - `checkCompletion` compares `complete(offered, value, localProxy)` (which strips `offered.local`) against `intent`.
- **F1.5 0.3.x consumers:** `localFields` / `stateFields` / `actionFields` are closed sets in `0.3.x` `treeSchema` and `compileIntents`; a `0.3.x` validator rejects `/local` fail-closed (`invalid-prop`).

### Performance budget
- **Emit path:** An intent without `local` pays one falsy property read (`intent.local === undefined`); `bench/selection.bench.ts` within **2%**. With `local`, ≤ 4 schema checks and 1 tree rebuild regardless of array length.
- **Arrival path:** Zero cost when `pendingRevert.size === 0` (one integer check); with pending reverts, one shallow object spread.

### Security (Laws 1–4) and rejection tests
- **Law 1:** `local` writes are `{ key, value?, until? }` plain JSON data; no browser code runs.
- **Law 2:** Every write's key, literal value, or `carries` compatibility is checked on `render()`, `validateTemplate()`, and arrival before `emit` can run; at emit, values are re-checked against `manifest.local` before touching `core.local`.
- **Law 3:** `local` writes only update `manifest.local` scalars, which can never bind to `style` props or `variant`.
- **Law 4:** Local writes grant no authority and never leave the browser. `complete()` strips `local` before `onIntent`; `checkOffered` rejects any posted `local` field. Confirmed intents apply local writes only after user confirmation.
- **Rejection tests (Task 2):** undeclared key (`unknown-name` at `/local/0/key`); > 4 writes (`limit-exceeded` at `/local`); 0 writes (`invalid-prop` at `/local`); bad `until` (`invalid-prop` at `/local/0/until`); type-mismatched value or `carries` (`invalid-prop` at `/local/0/value`); `local` on `setLocal` (`invalid-prop`); posted `local` in `checkOffered` (`invalid-prop` at `/local`); runtime schema failure throws and raises no intent; unconfirmed intent writes nothing.

---

## 2. F2 — Intent values read from `local` (`fromLocal`)

### Ruled-out compositions
- **`{ $path: "local.title" }` inside `action.args`:** `args` are exact literals compared by `checkOffered`; putting expressions inside `args` would force the host to evaluate browser state it does not possess.
- **A `form` primitive with an object `carries`:** Violates "primitives only" by forcing one catalog primitive per form layout.

### Wire form (`liveframe/1` and `liveframe/tree-patch/1`)
- Type additions (`src/formats/tree.ts`):
  - On `setState`: `readonly fromLocal?: string;`
  - On `action`: `readonly fromLocal?: Readonly<Record<string, string>>;`
- JSON Schema (`schemas/ui-tree.json`, `schemas/tree-patch.json`):
  - `setState` branch: optional `fromLocal: name`, and `not: { required: ["value", "fromLocal"] }`.
  - `action` branch: optional `fromLocal: { type: "object", minProperties: 1, maxProperties: 16, additionalProperties: name }`.

### SDK, element JSON and template form
- **TSX SDK (`src/sdk/intents.ts`):**
  - `action(name, args, { ..., fromLocal?: Record<string, string> })`: validates `fromLocal` is a plain object of 1–16 nonempty ≤128-char strings (if `{}` is passed in options, throws `TypeError` or omits? Omit only if `undefined`; empty `{}` throws `TypeError` or is rejected at build — let's omit `fromLocal` when `undefined` and throw `TypeError("Expected 1 to 16 fromLocal entries")` if empty or >16!).
  - `state.set(key, value?, { ..., fromLocal?: string })`: `fromLocal` requires `value === undefined` (throws `TypeError` if both `value` and `fromLocal` are provided).
  - `liveframe gen`: manifest-typed `action` constrains `fromLocal` keys to `keyof ActionArgs` and values to compatible keys of `Manifest["local"]`; `state.set` constrains `fromLocal` to compatible keys of `Manifest["local"]`.
- **Template (`liveframe-template/1`):** `setState.fromLocal` (`string`) and `action.fromLocal` (`Record<string, string>`) are static strings checked at install against `manifest.local` and capability `args` / `manifest.state`.
- **Element JSON:** `intentSchemas()` adds `fromLocal` to `setState` and `action` schemas.

### Rules, validation, limits and host checks
- **F2.1 Validation (`compileIntents` in `src/validate/intent.ts`):**
  - On `setState`:
    - If `Object.hasOwn(value, "fromLocal")`:
      - Must be a non-empty string (`invalid-prop` at `/fromLocal`).
      - Mutually exclusive with `value` (`Object.hasOwn(value, "value")` -> `invalid-prop` at `/fromLocal`).
      - Key must exist in `manifest.local.properties` (`unknown-name` at `/fromLocal`).
      - Scalar fit rule: `localSchema` must fit `stateSchema` (`carriesFits(localProp.type, stateSchema.type)` and `localProp.nullable !== true || stateSchema.nullable === true`; `invalid-prop` at `/fromLocal` otherwise). (State properties that are objects or arrays never fit a scalar `local` property.)
  - On `action`:
    - `fromLocal` must be a plain object (`invalid-prop` at `/fromLocal`), `1..16` entries (`0` -> `invalid-prop` at `/fromLocal`; `> 16` -> `limit-exceeded` at `/fromLocal`).
    - For each `[arg, localKey]` in `Object.entries(fromLocal)`:
      - `localKey` must be a string (`invalid-prop` at `/fromLocal/<arg>`) and exist in `manifest.local.properties` (`unknown-name` at `/fromLocal/<arg>`).
      - `arg` must exist in `capabilities.actions[name].args.properties` (`invalid-prop` at `/fromLocal/<arg>`).
      - Scalar fit rule: `carriesFits(localProp.type, argSchema.type)` and `localProp.nullable !== true || argSchema.nullable === true` (`invalid-prop` at `/fromLocal/<arg>`).
      - No double-fill: `arg` must not be in `value.args` (`Object.hasOwn(value.args, arg)`), equal `value.bind`, or be in `carries.object.properties` when `value.bindAll === true` (`invalid-prop` at `/fromLocal/<arg>`).
    - Required action arguments supplied by `fromLocal` are omitted from the upfront `args` check (alongside `bind` and `bindAll`). An action may combine literal `args`, `bind` (or `bindAll`), and `fromLocal` as long as their filled argument sets are disjoint.
- **F2.2 Completion (`complete(intent, value?, local?)` in `src/validate/complete.ts`):**
  - `setState` with `fromLocal`: copies `value: local?.[intent.fromLocal]` and deletes `fromLocal`.
  - `action` with `fromLocal`: merges `{ [arg]: local?.[localKey] }` for each entry into `args` and deletes `fromLocal`.
  - `src/surface/core.ts` passes `core.local` (after any F1 `local` writes have updated `core.local`!) to `complete(intent, value, core.local)`.
    *(Order note: if one event carries both `local` writes (F1) and `fromLocal` (F2), F1 writes execute first, so `fromLocal` reads the updated `core.local`.)*
- **F2.3 Host check (`checkOffered` in `src/validate/offered.ts`):**
  - Completed intents carrying `fromLocal` are rejected (`invalid-prop` at `/fromLocal`).
  - `checkCompletion` builds the `localProxy` for `complete(offered, value, localProxy)` from the posted completed intent:
    - For `setState` with `offered.fromLocal`: `localProxy = { [offered.fromLocal]: intent.value }`.
    - For `action` with `offered.fromLocal`: `localProxy` maps each `localKey` in `offered.fromLocal` to `intent.args[arg]`. (Also verifies every `arg` in `offered.fromLocal` is `Object.hasOwn(intent.args, arg)`, and if two args in `offered.fromLocal` map to the same `localKey`, they must carry equal values.)
  - `difference(complete(offered, value, localProxy), intent)` ensures every literal arg, `name`, `resultKey`, `bind`/`bindAll` position, and key set matches `offered` exactly (no extra posted args, no altered literals).
  - `checks.intent(intent, ...)` validates the filled `intent.args` against the full capability `args` schema (`maxLength`, `minimum`, `maximum`, `enum`, `url`, `pattern`, `required`) or `intent.value` against `manifest.state[key]`.
- **F2.4 0.3.x consumers:** `treeSchema` and `compileIntents` reject `/fromLocal` fail-closed (`invalid-prop`).

### Performance budget
- **Emit path:** One `intent.fromLocal !== undefined` check when absent (unchanged); when present, at most 16 shallow property copies.
- **Arrival path:** Zero cost without `fromLocal`; in `checkOffered`, `handleIntent` overhead stays within **0.2 ms** on `bench/host.bench.ts`.

### Security (Laws 1–4) and rejection tests
- **Law 1:** `fromLocal` is a static string or string map; no expression or code runs to produce it.
- **Law 2:** Both static scalar compatibility (`render()`, arrival) and runtime capability bounds (`checkOffered` on the host) are enforced; a `fromLocal` value never bypasses `maxLength`, `minimum`, `maximum`, `enum`, `url`, or `pattern`.
- **Law 3:** Intents never touch styles or colours.
- **Law 4:** A hostile client can forge any value in the `fromLocal` positions of a posted completed intent, so `checkOffered` treats those positions exactly like `bind`: it checks every filled value against the host's capability schema (and `handleIntent` still runs `authorize` and `dispatch` as the viewer), while locking every literal argument and `resultKey`.
- **Rejection tests (Task 3):** undeclared `local` key (`unknown-name`); undeclared action argument (`invalid-prop`); scalar type mismatch e.g. `string` -> `integer` or nullable -> non-nullable (`invalid-prop`); > 16 entries (`limit-exceeded`); empty `fromLocal: {}` (`invalid-prop`); argument filled twice with literal/`bind`/`bindAll` (`invalid-prop`); `setState` with both `value` and `fromLocal` (`invalid-prop`); host `checkOffered` rejects posted `fromLocal` field (`invalid-prop` at `/fromLocal`), changed literal arg beside `fromLocal` (`invalid-prop`), extra unoffered arg (`invalid-prop`), and `handleIntent` refuses posted value exceeding capability `maxLength`/`maximum` (`refused`).

---

## 3. F3 — Bounded array carries (`carries: { array: { items, maxItems } }`)

### Ruled-out compositions
- **Comma-joined string carry:** Loses per-item type checking, item `maxLength`/`minimum`/`maximum`/`enum`/`url` bounds, and breaks when an item contains `,`.
- **Fixed keys `item0..itemN` in an object carry:** Bounded to 32 properties, forces artificial arity in schemas, and cannot represent variable-length multi-selection cleanly.

### Wire form (`liveframe-catalog/1`)
- Type addition (`src/formats/catalog.ts`):
  ```ts
  type ArrayCarry = {
    readonly items: ScalarLanguageSchema; // string (with maxLength), boolean, number, or integer
    readonly maxItems: number;            // integer 1..256
  };
  // Event carries becomes:
  // "none" | "string" | "boolean" | "number" | "integer" | { readonly object: ObjectSchema } | { readonly array: ArrayCarry }
  ```
- JSON Schema (`schemas/catalog.json`):
  - `carries.oneOf` gains a third branch: closed object `required: ["array"]`, `properties.array`: closed object `required: ["items", "maxItems"]`, `additionalProperties: false`, `maxItems: { type: "integer", minimum: 1, maximum: 256 }`, `items` restricted to scalar schemas (`string` with `maxLength`, `boolean`, `number`, `integer`, each optionally `nullable`, `description`, `deprecated`, with `string` allowing `minLength`/`pattern`/`url`/`enum` and numeric allowing `minimum`/`maximum`).

### SDK, implementation and template form
- **Implementations (`src/react/implement.ts`):** `Emit<D>` maps `{ readonly array: { readonly items: infer I extends LanguageSchema } }` to `[event: E, value: readonly Infer<I>[]]`.
- **TSX SDK & `liveframe gen` (`src/sdk/gen.ts`):**
  - `generate()` types `bind` on array-carrying events to require an array action argument whose items fit, and `state.set(key)` (without value) to require an array state property whose items fit.
  - `generateDefinitions()` emits literal `carries: { array: ... }` unchanged.
- **Templates (`liveframe-template/1`):** `checkBind` and `write` (`src/template/document.ts`) apply the same array fit rule for `bind` and implicit `setState`.

### Rules, validation, limits and host checks
- **F3.1 Catalog validation (`src/formats/catalog.ts`):**
  - `carries.array.maxItems` must be an integer `1..256` (`invalid-document` at event's `/carries/array/maxItems`).
  - `carries.array.items` must be a valid scalar schema (`string` with `maxLength`, `boolean`, `number`, `integer`) passing `schemaRelationships` (`minLength <= maxLength`, `minimum <= maximum`, `url` without `pattern`, etc.); anything else (nested `array`, `object`, `discriminator`, unbounded `string`, extra fields) is `invalid-document` at `/definitions/<i>/events/<name>/carries`.
  - `classifyCatalogChange`: changing `items` or `maxItems` (or switching between scalar/object/array) is a **major** change; adding an event with an array carry is **minor**.
- **F3.2 Intent fit (`src/validate/intent.ts`):**
  - `arrayFits(carries.array, target)`: `target.type === "array"`, `carriesFits(carries.array.items.type, target.items.type)`, and `carries.array.items.nullable !== true || target.items.nullable === true`.
  - Valid for `action` `bind` (`invalid-prop` at `/bind` if incompatible) and implicit `setState` (`invalid-prop` at `/value` if incompatible).
  - Invalid for `bindAll` (`invalid-prop` at `/bindAll`) and implicit `setLocal` (`invalid-prop` at `/value`, since `local` holds scalars only).
- **F3.3 Emit and host re-check:**
  - `src/surface/core.ts` (`specsFor`) and `src/validate/compile.ts` (`compileCatalog`) compile `{ type: "array", items: carries.array.items, maxItems: carries.array.maxItems }` with `compileSchema`.
  - `emit(event, value)` checks `value` against that compiled schema (`emit-rejected` `"invalid-value"` and throws on mismatch, e.g. > `maxItems`, wrong item type, or item exceeding `maxLength`).
  - `checkOffered` runs the same compiled `event.check` on the `bind` / `setState` slot, AND `checks.intent` validates the completed intent against the capability `args` / `manifest.state` schema (which checks target `minItems`, `maxItems`, and item bounds).
- **F3.4 0.3.x consumers:** `0.3.x` `catalog.json` and `validateCatalog` reject `{ array: ... }` fail-closed (`invalid-document` at `carries`).

### Performance budget
- **Emit path:** One pre-compiled `SchemaCheck` closure per array-carrying event; scalar events are untouched.
- **Arrival path:** Catalogs without array carries compile and validate unchanged; `bench/validator.bench.ts` within **2%**.

### Security (Laws 1–4) and rejection tests
- **Law 1:** Pure JSON schema and array data; no executable code.
- **Law 2:** Array length (`1..256`) and item schemas (including required `maxLength` on strings) are bounded at catalog install, enforced at `emit`, and bounded in trees by `DEFAULT_LIMITS.bytes`.
- **Law 3:** Events carry no styling data.
- **Law 4:** Every array received by the host in `bind` or `setState` is re-validated against both the catalog's `carries.array` schema (`checkOffered`) and the capability/manifest target schema before `authorize` or `dispatch`.
- **Rejection tests (Task 4):** `maxItems` `0` or `257` (`invalid-document`); nested array/object/unbounded string in `items` (`invalid-document`); `emit` with non-array, > `maxItems`, or wrong item type throws; `bind` to scalar arg or mismatched item type (`invalid-prop`); `bindAll` on array carry (`invalid-prop`); implicit `setLocal` on array carry (`invalid-prop`); `checkOffered` rejects array violating event bounds or capability `minItems`/`maxItems`/item bounds.

---

## 4. F4 — Tree focus mark (`focus?: string`)

### Ruled-out compositions
- **`autoFocus` prop on each focusable primitive:** Requires editing every primitive in every catalog and fires on every mount/reconciliation, stealing focus on unrelated re-renders.
- **Host-side `surface.focus(nodeId)` imperative API:** Requires the host to guess widget-internal key-path ids instead of the widget declaring focus declaratively in the tree.

### Wire form (`liveframe/1` and `liveframe/tree-patch/1`)
- `UiTree` (`src/formats/tree.ts`, `schemas/ui-tree.json`):
  ```ts
  export type UiTree = {
    readonly format: "liveframe/1";
    readonly catalogId: string;
    readonly surfaceId: string;
    readonly revision: number;
    readonly focus?: string;
    readonly root: UiNode;
  };
  ```
  - `focus` matches the `UiNode.id` key-path regex (`^root(?:/(?:[a-zA-Z0-9_.!~*'():-]|%[0-9A-F]{2})+)*$`).
- `TreePatch` (`src/formats/tree-patch.ts`, `schemas/tree-patch.json`):
  ```ts
  export type TreePatch = {
    // ...existing fields...
    readonly focus?: string | null; // omitted: preserve base.focus; string: set; null: clear
  };
  ```
  - `diffTrees(prev, next)`: omits `focus` when `prev.focus === next.focus`; sets `focus: next.focus` when changed to a string; sets `focus: null` when cleared (`prev.focus !== undefined && next.focus === undefined`).
  - `applyPatch(base, patch)`: preserves `base.focus` when `patch.focus === undefined`, sets `focus: patch.focus` when string, omits `focus` when `null`.

### SDK, element JSON and template form
- **TSX SDK (`src/sdk/render.ts`, `src/sdk/gen.ts`):**
  - `focus?: boolean` added to `NOT_PROPS` and generated primitive props (never forwarded as a DOM/primitive prop).
  - When `focus === true` on an element, sets the tree's `focus` to that node's key-path `id`. `false` or `undefined` does nothing.
- **Element JSON (`src/sdk/elements.ts`, `src/sdk/element-node.ts`):** `ELEMENT_KEYS` adds `"focus"`, `Elements<C>` adds `readonly focus?: boolean`, `generateElementsSchema` adds `focus: { type: "boolean" }`.
- **Template (`liveframe-template/1`, `src/template/document.ts`, `src/template/render.ts`):** `TemplateNode` adds optional `focus?: Expr` (checked against `{ type: "boolean" }` at install; evaluated during expansion and passed to the SDK element when `true`).
- **Fragments:** `focus` on a `fragment` is rejected (`invalid-prop`: `"no focus on a fragment"`).

### Rules, validation, limits and renderer behaviour
- **F4.1 Static & arrival validation (`src/validate/tree.ts`, `src/sdk/render.ts`, `src/sdk/stream.ts`):**
  - In `validateTree`: if `focus` is present and not a valid node-id string, `invalid-prop` at `/focus`. Post-walk (`checkReferences`):
    - Target must exist in `ctx.ids` (`not-found` at `/focus`, `nodeId: "root"`).
    - Target must not carry `when` or sit under a `when`-gated ancestor (`!isGated(ctx.gated, focus)`: `invalid-prop` at `/focus`, `nodeId: "root"`).
  - In `render()` / `renderElements()` / `streamElements()`:
    - Non-boolean `focus` attribute: `invalid-prop` at `${pointer}/focus`.
    - Second element with `focus: true`: `duplicate-key` at the second element's `${pointer}/focus`.
    - `focus: true` on a gated node (or under a gated ancestor): `invalid-prop` at `${pointer}/focus`.
- **F4.2 Surface core (`src/surface/core.ts`):**
  - `SurfaceSnapshot` exposes `readonly focus?: string` (equals `tree.focus` when `valid`, `undefined` otherwise).
- **F4.3 React renderer (`src/react/renderer.tsx`):**
  - Tracks `appliedFocusRef` holding `{ surfaceId: string; focus: string | undefined } | undefined` across commits where `drawTree && snapshot.valid && snapshot.tree`.
  - **First tree of a surface load (or when `surfaceId` changes):** initializes `appliedFocusRef.current = { surfaceId, focus: snapshot.focus }` and does **not** move focus.
  - **Subsequent accepted revisions of the same `surfaceId`:** if `snapshot.focus !== prev.focus`:
    - Updates `prev.focus = snapshot.focus`.
    - If `snapshot.focus !== undefined` (runs in `useLayoutEffect` after child `FocusContinuity.componentDidUpdate`):
      - Resolves `domId = \`${domIdPrefix}:${snapshot.focus}\`` via `document.getElementById(domId)` and verifies `[wrapper.current, portal].some((root) => root?.contains(target))`.
      - If no element is found inside the surface's wrapper or portal: skips focus and reports `onEvent({ type: "focus-missed", nodeId: snapshot.focus, reason: "no-element" })`.
      - Else calls `target.focus({ preventScroll: false })`. If `document.activeElement !== target && !target.contains(document.activeElement)`, reports `onEvent({ type: "focus-missed", nodeId: snapshot.focus, reason: "not-focusable" })`.
    - Moving focus emits no intent.
  - **When `snapshot.focus === prev.focus` (or `snapshot.focus === undefined`):** does nothing; `FocusContinuity` handles removed focused elements as today.
- **F4.4 0.3.x consumers:** `0.3.x` `treeFields` and `treePatchSchema` are closed; a `0.3.x` validator rejects `/focus` fail-closed (`invalid-prop`).

### Performance budget
- **Emit path:** `0` — `focus` is not on the emit path.
- **Arrival path:** A tree without `focus` pays one `Object.hasOwn(tree, "focus")` in `enterTree` and one `undefined` check in `useLayoutEffect`. When `focus` changes, one `Set.has` + `isGated` at validation and one `document.getElementById` + `contains` check after commit.

### Security (Laws 1–4) and rejection tests
- **Law 1:** `focus` is a single validated key-path string on `UiTree` (or boolean attribute in TSX/template); no code runs.
- **Law 2:** `focus` is validated against `ctx.ids` and `!isGated` before the renderer sees the tree.
- **Law 3:** Focus placement sets no CSS, colour, or style attribute.
- **Law 4:** Focus emits no intent and grants no authority. Cross-surface focus hijacking is impossible because `domId` includes the surface's `useId()` prefix AND `<Surface>` verifies `target` is contained inside `[wrapper.current, portal]`.
- **Rejection tests (Task 5):** `focus` naming a missing node (`not-found` at `/focus`); `focus` naming a `when`-gated node or descendant of one (`invalid-prop` at `/focus`); non-boolean `focus` in TSX/elements (`invalid-prop`); two `focus` marks in one tree (`duplicate-key`); `focus` on a fragment (`invalid-prop`); cross-surface sibling with identical node `id` never receives focus.

---

## 5. G2 — `Store` compare-and-set for state (`putStateIf`)

### Ruled-out compositions
- **Leaving concurrency solely to host-level per-placement locks:** Works in one process only; multi-process hosts sharing a database or KV store have no atomic primitive in `Store` to build on without inventing custom out-of-band locking.
- **Returning a version token from `getState`:** Breaking change to every existing `Store` implementation's `getState` signature.
- **`updateState(id, scope, fn)` callback:** Cannot execute remotely across HTTP/RPC stores.

### API & wire form
- No wire-format change (`liveframe/1` and records are unchanged).
- `Store` (`src/store/index.ts`):
  ```ts
  export interface Store {
    // ...existing methods...
    putStateIf?(
      placementId: string,
      scope: string,
      expected: Json | undefined,
      next: Json,
    ): Promise<boolean>;
  }
  ```
- `HostEvent` (`src/host/types.ts`): `intent-refused` `reason` widens to `"stale" | "not-offered" | "unauthorized" | "invalid-state" | "limit" | "conflict"`.

### Rules, validation, limits and host pipeline
- **G2.1 `putStateIf` contract (`docs/spec.md` §7.4):**
  - Calls `assertScope(scope)` first (`LiveframeFailure` `invalid-document` at `/scope`).
  - Atomically compares the currently stored state for `(placementId, scope)` against `expected`:
    - When `expected === undefined`: matches iff no state is stored for `(placementId, scope)`.
    - When `expected !== undefined`: matches iff stored state exists and `canonicalJson(stored) === canonicalJson(expected)` (key-order independent JSON equality).
  - If matched, stores a copy of `next` and resolves `true`; otherwise writes nothing and resolves `false`.
- **G2.2 Reference stores:**
  - `memoryStore()` (`src/store/memory.ts`): synchronous check-and-set inside one microtask-free step (`sameJson(existing, expected)`), storing `copy(next)`.
  - `fileStore(dir)` (`src/store/fs/index.ts`): serializes state operations through an in-process queue (matching `packages`), reads `statePath(id, scope)`, compares `sameJson(current, expected)`, and writes `next` atomically using its existing temp-file + `rename` pattern (`write`).
- **G2.3 `handleIntent` `applyState` (`src/host/intent.ts`):**
  - Step H3 (`authorize`) runs once first, before any store read.
  - If `args.store.putStateIf` is absent: runs existing single `loadPlacement` + `putState` path (documented in `docs/host.md` as single-writer / requiring host serialisation across processes).
  - If `args.store.putStateIf` is present:
    - Attempt 1 reads `raw = await args.store.getState(placementId, scope)` and passes `{ scope, state: raw }` to `loadPlacement` (one state read on the uncontended path!).
    - Computes `next = { ...current, [intent.key]: intent.value }` and checks `manifest.state` (`invalid-prop` at `/value` + `intent-refused` `"invalid-state"` if invalid).
    - Calls `await args.store.putStateIf(placementId, scope, raw, next)`.
    - On `false`, retries up to **3 more times** (**4 attempts total**): each retry re-reads `raw = await args.store.getState(placementId, scope)`, re-runs `verifyPlacementInputs(pkg, { params, state: raw })` (to re-apply state validation/migration/reset on the new stored value), overlays `intent.key`, re-checks `manifest.state`, and calls `putStateIf`.
    - If all 4 attempts return `false`: returns `{ ok: false, errors: [{ kind: "version-conflict", pointer: "/state", message: "State changed concurrently" }] }` and emits `intent-refused` with `reason: "conflict"`.
- **G2.4 `storeSuite` (`src/conformance/store.ts`):**
  - When `store.putStateIf` is defined, tests: `undefined` expected when empty vs present; canonical JSON equality ignoring object key order; rejecting mismatch and preserving stored state; scope isolation; invalid scope throwing `LiveframeFailure`.
- **G2.5 0.3.x consumers:** Optional method; existing `0.3.x` stores remain valid `Store` implementations and fall back to `putState`.

### Performance budget
- **Emit path:** `0`.
- **Arrival / host path:** Uncontended `handleIntent` `setState` performs **1 `getState` + 1 `putStateIf`** (identical read/write count to today); `bench/host.bench.ts` stays within budget.

### Security (Laws 1–4) and rejection tests
- **Law 1:** Server/store-only; no browser code.
- **Law 2:** Every candidate `next` state (including on retries) is checked against `manifest.state` before `putStateIf` is called.
- **Law 3:** No styling impact.
- **Law 4:** `checkOffered` and `authorize` still run before any store read or write; `putStateIf` enforces scope bounds (`assertScope`) and compares within `(placementId, scope)` only, never leaking across scopes or placements.
- **Rejection tests (Task 6):** concurrent `setState` on two keys keeps both; 4 consecutive `false` responses yield `version-conflict` at `/state` and `intent-refused` `"conflict"`; invalid scope on `putStateIf` throws `LiveframeFailure`; `storeSuite` fails a broken `putStateIf` that ignores `expected`.

---

## 6. Filtered-list empty state (`shown` third expression root)

### Ruled-out candidates
1. **Documenting the `setState` workaround (status quo):** Forces a backend round trip on every filter keystroke just to show `"No matches"`.
2. **Aggregate `local` key written by the core:** Forces widget authors to declare a dummy writable key they must never write themselves and collides across two lists in one widget.

### Chosen form, wire & SDK representation
- **Wire form (`liveframe/1`, `liveframe-template/1`):** No new `UiNode` field and no new operator. `shown` is added as a third top-level expression root alongside `local` and `self` in tree expressions (`when` and `bind`), referenced as `{ "$path": "shown" }` with schema `int({ minimum: 0 })` (always present, non-optional integer).
- **TSX SDK (`src/sdk/bindings.ts`):**
  ```ts
  export const shown = (): Expr => Object.freeze({ $path: "shown" });
  ```
  - Example:
    ```tsx
    {rows.map((r) => <Row key={r.id} when={ex.contains(r.title, local("q"))} title={r.title} />)}
    <Text when={ex.eq(shown(), 0)} text="No matches" />
    ```
    And a live count badge in the same parent:
    ```tsx
    <Text when={ex.gt(shown(), 0)} bind={{ text: ex.concat(ex.text(shown()), " matches") }} />
    ```
- **Templates (`liveframe-template/1`):** `{ "$path": "shown" }` works inside `when` and `bind` via `compileBindings` (`embed: true`). Outside `when`/`bind`, `shown` is not in template scope and fails `unknown-name`.

### Rules, validation, evaluation & limits
- **E.1 Scope & static checks (`src/validate/bindings.ts`):**
  - `rootScope({ local: facts.local, self: facts.props, shown: int({ minimum: 0 }) })`.
  - Dotted sub-paths (`shown.foo`) fail `unknown-name` (`"shown" has no properties`).
  - Readable in `when` and `bind` only (the only browser-evaluated expression positions in `UiTree`).
  - Parent child-count bounds (`compileStructure.counts`) already count every `when`-gated node against `max` and exclude every `when`-gated node from `min`; an empty-state node carrying `when` follows this rule unchanged.
- **E.2 Exact counting semantics (acyclic single extra pass):**
  - At parent `P`, `shown` equals the number of `P`'s direct children that:
    1. carry `when`,
    2. do **not** themselves read `shown` (in either `when` or `bind`), and
    3. evaluated `when` to `true` (a child whose `when` faulted is not counted as shown).
  - **Why readers of `shown` are excluded from the counted set:** If an empty-state node (`<Text when={ex.eq(shown(), 0)} />`) were counted, it becoming visible would change `shown` from `0` to `1`, creating a paradox and also causing a sibling count badge (`<Text bind={{ text: ex.text(shown()) }} />`) to show `"1"` when zero rows match. Excluding readers of `shown` from the counted set makes cycles impossible by construction, lets an empty-state node and a count badge coexist cleanly under the same parent, and bounds evaluation to **at most one extra pass** over only the reader children.
  - On `tree.root` (no parent, no siblings), `shown` evaluates to `0`.
- **E.3 Core evaluation & incremental cache (`src/surface/bindings.ts`, `src/surface/core.ts`):**
  - `compileBindings` detects whether a node's `when` or `bind` references `"shown"` (`readsShown: boolean`) and stores `slots: [localSlot, selfSlot, shownSlot]`.
  - `branch(node, ...)` runs Pass 1 over `node.children`:
    - Skips any child with `bindings?.readsShown === true`, recording it for Pass 2.
    - For every other child, builds it (`build(child, local, 0)`), and if `child.when !== undefined` and it produced a non-faulting context (shown), increments `shownCount`.
  - If no child reads `shown` (common case), Pass 2 does not run.
  - Otherwise, Pass 2 builds each recorded reader child in original child order with `build(child, local, shownCount)` and inserts visible contexts into `items` at their original positions.
  - `Entry` in `src/surface/core.ts` records `shown: number | undefined` (stored as `shownCount` for `readsShown` nodes, `undefined` otherwise). `build` reuses `before.context` iff `before.shown === (bindings?.readsShown ? shown : undefined)` AND all `before.seen` local values match. Thus a reader of `shown` that reads zero `local` keys directly still rebuilds whenever `shownCount` changes!
- **E.4 0.3.x consumers:** `0.3.x` `compileBindings` only places `local` and `self` in `rootScope`, so `{ "$path": "shown" }` fails closed with `unknown-name` on arrival in `0.3.x`.

### Performance budget
- **Emit path:** `0`.
- **Arrival & local-update path:** Parents with no `readsShown` child pay one boolean check (`bindings?.readsShown`) per child in `branch` (no second array, no second pass). A `bench/selection.bench.ts` live-filter row with 50 gated rows + 1 empty-state row keeps keystroke update within the existing **≤ 4 ms** median budget.

### Security (Laws 1–4) and rejection tests
- **Law 1:** Still plain JSON data using `TREE_OPERATORS` with the existing `256`-step fuel limit; no new operator, no iteration.
- **Law 2:** `shown` is statically typed as `int({ minimum: 0 })` and evaluated only inside `when`/`bind` (with bound `bind` values still re-checked by `checkNode`).
- **Law 3:** `shown` cannot bind to `style` props or `variant`.
- **Law 4:** Read-only derived integer; exposes only the count of visible gated siblings already sent in the widget's tree and triggers no host intent.
- **Rejection tests (Task 7):** `shown.foo` (`unknown-name`); `shown` outside `when`/`bind` in template props/`$if` (`unknown-name`); `shown` assigned to a `boolean` prop without comparison (`invalid-prop`); `shown` in `when` without boolean coercion (`invalid-prop`).

---

## 7. Spec sections to update (across Tasks 2–7)

| Section | Change |
| --- | --- |
| §5 | Add `{ array: { items, maxItems } }` to event `carries` (Task 4). |
| §7.2 / §7.6 | `local.set(..., { until })`, `fromLocal`, `focus`, `shown()` in SDK and templates (Tasks 2, 3, 5, 7). |
| §7.4 | Add optional `Store.putStateIf` contract (Task 6). |
| §7.7 | `applyState` uses `putStateIf` with up to 4 attempts, `version-conflict` / `intent-refused` `"conflict"` (Task 6). |
| §8 | Restate Rule 1; add `local` writes on host intents (`until: "revision"`), `fromLocal` on `action`/`setState`, array `carries` fit rules, and `shown` third expression root (Tasks 2–4, 7). |
| §9 / §9.1 | `UiTree.focus`, `TreePatch.focus`, `LocalWrite`, `fromLocal` (Tasks 2, 3, 5). |
| §10 | Validation rules for `local`, `fromLocal`, `focus` (`not-found`/`invalid-prop`), `shown` (Tasks 2, 3, 5, 7). |
| §11 | `SurfaceSnapshot.focus`, `focus` move on non-initial revision changes (`focus({ preventScroll: false })`, `focus-missed`), `shown` two-pass evaluation in `branch` (Tasks 5, 7). |
| §13 | `storeSuite` `putStateIf` cases (Task 6); `rendererSuite` & `rendererBrowserSuite` local-binding/F1/F2/F4 cases (Task 8). |
