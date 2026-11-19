# Phase 7 Part X: Interaction Capabilities

Depends on: plan [033](033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md) Task 1 (the scope decision places this plan in 0.4.0) and plan [036](036-Phase-7-Part-W-Internal-Structure-And-Parity.md) complete (the surface core and the SDK build pass are restructured first). Followed by plans [038](038-Phase-7-Part-Y-Rendering-Capabilities.md) and [039](039-Phase-7-Part-Z-Agent-Generated-UI.md). Source: findings F1–F4, G2 and two of the G3 backlog items of the 2026-11-15 review (table in plan 033).

## Objectives

- Approve one design for the interaction additions before any of them is built.
- Let one event write local state and raise its host intent, so a widget can show an immediate response.
- Let an intent carry values read from local state, so a multi-field form needs no form-shaped primitive.
- Let an event carry a bounded array of scalars.
- Let a tree say which node takes focus when a revision is drawn.
- Give `Store` a compare-and-set for state, and use it in `handleIntent`.
- Let a filtered list show an empty state without a round trip.
- Cover local state, bindings and the new behaviours in the renderer conformance suites.

## Expected Outcome

- `plans/evidence/037-interaction-design.md` and an approved decision log fix the wire forms, the validation rules, the limits and the spec text for every item below.
- A button press can set `local.saving` and dispatch `tasks.save` in one event; the local write is undone when the next revision is accepted, if the author asked for that.
- `action("tasks.create", {}, { fromLocal: { title: "title", due: "due" } })` sends two typed fields from local state, re-checked by the host.
- A multi-select primitive declares `carries: { array: … }` and its value fills an array argument or state key.
- A widget marks one node per tree to receive focus when a revision first draws it.
- Two processes writing one placement's state cannot lose a write when the store implements the new method.
- `rendererSuite()` and `rendererBrowserSuite()` fail a renderer that sends `setLocal` to the host, draws a hidden node or ignores a failed binding.

This plan implements the interaction part of the proposed 0.4.0 capability work in roadmap Phase 7. Every item adds optional fields to the existing `/1` formats, as 0.3.0's additions did (`docs/compatibility.md:29`): a 0.3.x validator rejects them fail-closed. The shapes written into Tasks 2–7 are the proposal Task 1 puts to the owner. If the decision changes a shape, the affected task's criteria, files and tests are amended before it starts. No version is bumped and nothing is published. Spec sections touched: §5 (events), §7.2 (SDK), §7.4 (storage), §7.6 (templates), §7.7 (host pipeline), §8 (interaction), §9 (wire format), §10 (validation), §11 (renderer), §13 (conformance).

## Rules for every task

1. **The four laws bound every design.** A local write never reaches the host as authority (law 4). A value read from local state is data the host re-checks against the capability schema (law 4). Nothing lets a widget run code in the browser (law 1): every addition is data the renderer evaluates with the bounded expression rules of spec §8.
2. **Format chores.** Each format addition changes its TS type and JSON Schema together, adds corpus cases under `conformance/corpus/`, adds its rejections to the validator with a test each, and updates `generate`, `generateDefinitions`, `generateElementsSchema` and `generateTemplateSchema` where the form is authorable there (`src/sdk/gen.ts:210`, `:254`, `:383`, `:797`).
3. **Register.** Each declaration change has an entry in `scripts/release/api/register-0.4.0.json`, created in Task 1.

## Tasks

- [x] Task 1: Design the interaction additions and record the decision
  - Notes (closed 2026-11-19, during Task 9):
    - `plans/evidence/037-interaction-design.md`, `scripts/release/api/register-0.4.0.json` and `register_0_4_0_is_read_by_the_api_gate` were delivered before Task 2. The restated §8 Rule 1 reached `docs/spec.md` in Task 2. The checkbox stayed open because no decision log recorded the owner's approval. Task 9's impact analysis found the gap (F1).
    - On 2026-11-19 the owner approved the design as implemented in Tasks 2–8, including Task 7's deviation (a `shown` reader is never counted, design E.2), and the restated Rule 1. Recorded in `decision-logs/2026-11-19-0154-interaction-additions-for-0-4-0.md`.
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/037-interaction-design.md` specifies, for each of F1, F2, F3, F4, G2 and the filtered-list empty state: the wire form, the SDK and template form, every validation rule with its error kind and pointer, the limits, what the host re-checks, what a 0.3.x consumer does with it, and the spec text.
      - It answers these open questions with a reason each: (F1) whether a local write may be marked to hold only until the next accepted revision, and what happens to it when the host refuses the intent; whether the completed intent the host receives shows the local writes at all. (F2) whether `setState` may read from local as an action may. (F3) the item types and the maximum length of an array carry, and how it fits `bind`, `bindAll` and implicit `setState`. (F4) when a focus mark is applied (never on the first tree of a page load, or always), and what happens when the marked node renders no element. (G2) the method's shape and how many times `handleIntent` retries. (Empty state) which of the backlog's candidates is taken.
      - A decision log, written with `create-decision-log` after the owner approves the design, records it. `docs/spec.md` §8 rule 1 ("One intent per event") is restated there as the owner approves it.
      - `scripts/release/api/register-0.4.0.json` exists as `[]`, and `api-stability.test.ts` reads it beside the newest patch baseline, as plan 033's decision directs.
    - Performance: the design states a budget for each addition on the emit path and the arrival path; the default (a tree that uses none of them) must cost nothing more.
    - Code Quality: no addition that a composition of existing forms already gives; the design names the composition it rules out for each.
    - Security: the design has a paragraph per law for each addition, and lists the rejection tests each task must write.
  - Approach:
    - Skills to Use:
      - `create-decision-log` — the wire forms and the restated §8 rule are decisions.
      - `liveframe-execution` — `references/formats.md` and `references/renderer.md`.
    - Library Documentation to Check Before Implementation:
      - none for the design itself; WAI-ARIA Authoring Practices on focus management after a dynamic update, for F4.
    - Documentation Reviewed:
      - Spec §8 (all of it), §9, §10, §11; `decision-logs/2026-11-07-1756-action-results-and-local-bindings.md`; `plans/evidence/029-interaction-design.md` (L1–L5, B1–B8, A1–A5: the rules these additions extend); `plans/backlog.md` "Let a filtered list know it is empty", "Small findings from the 0.3.0 agent acceptance run".
    - Options Considered:
      - Design each item inside its own task — rejected: F1, F2 and the empty state all extend what an expression or an intent may read, and must agree.
    - Chosen Approach:
      - One design file, one decision, then the tasks.
    - API Notes and Examples:
      ```ts
      // The proposal the design starts from:
      type Intent =
        | { type: "setState"; key: string; value?: Json; local?: LocalWrite[]; fromLocal?: string }
        | { type: "action"; name: string; args: Record<string, Json>; bind?: string; bindAll?: true;
            resultKey?: string; local?: LocalWrite[]; fromLocal?: Record<string, string> };
      type LocalWrite = { key: string; value?: Json; until?: "revision" };
      ```
    - Files to Create/Edit:
      - `plans/evidence/037-interaction-design.md`; `decision-logs/<date>-interaction-additions-for-0-4-0.md`.
      - `scripts/release/api/register-0.4.0.json`; `src/__tests__/api-stability.test.ts`.
      - This plan: Tasks 2–7 amended where the decision differs.
  - Test Cases to Write:
    - `register_0_4_0_is_read_by_the_api_gate`: fails when a declaration changes without an entry.

- [x] Task 2: Let one event write local state and raise its host intent (F1)
  - Notes (executed 2026-11-18):
    - Added `LocalWrite` (`{ key, value?, until?: "revision" }`) and optional `local?: readonly LocalWrite[]` (1–4 entries) on `setState` and `action` intents in `src/formats/tree.ts` (re-exported from `src/index.ts`, `src/sdk/types.ts`, `src/sdk/index.ts`) and regenerated `schemas/ui-tree.json`, `schemas/tree-patch.json`, and `schemas/template.json` (adding `$defs.localWrite` in `src/template/schema.ts`).
    - Updated `compileIntents` (`src/validate/intent.ts`) to check `local` (1–4 closed `{ key, value?, until? }` entries, `unknown-name` on undeclared `local` keys, `limit-exceeded` over 4, `invalid-prop` on empty/non-array/bad `until`/schema or `carries` mismatch, and `setLocal` still rejects `local`/`until`). Updated `complete` (`src/validate/complete.ts`) to strip `local`, and `checkOffered` (`src/validate/offered.ts`) to reject posted `local` (`invalid-prop` at `/local`).
    - Updated `src/surface/core.ts` so `emit` validates all `local` writes synchronously before confirmation/mutation (reusing `writeLocal` + `pendingRevert` in `CoreState`), runs `confirm` before applying writes, applies `1..4` writes in array order in one state update, strips `local` before `onIntent`, and restores `until: "revision"` keys on the next accepted revision of the same `surfaceId` inside `stage`/`commit` (unaffected by rejected arrivals, stale revisions, or identical repeated tree objects; superseded by later non-`until` writes). `surface_core_work_per_arrival_and_event_is_unchanged` passes with zero extra work when `local` / `pendingRevert` are unused.
    - Updated `src/sdk/intents.ts` (`local.set` third `{ until?: "revision" }` option returning `LocalWrite` without `type: "setLocal"`, `action`/`state.set` `local` option + `<L>` manifest-local generic constraint), `src/sdk/gen.ts` (optional `{ manifest }` on `generate()`, `local` in `intentSchemas()` and `templateIntent()`), `src/template/document.ts` (`TemplateLocalWrite`, `localWrites` validation), and `src/template/render.ts` (`localWrites` expression evaluation). Regenerated `src/__tests__/fixtures/widgets/elements.schema.json`, `template.schema.json`, and `src/__tests__/fixtures/mcp-texts.json`.
    - Added conformance corpus cases under `conformance/corpus/ui-tree/` (`compound-local-*.json`) and `conformance/corpus/tree-patch/` (`compound-local-valid.json`), unit/type tests in `surface-core.test.ts`, `offered.test.ts`, `local-bindings.test.tsx`, `sdk-types.test.tsx`, `sdk-gen.test.ts`, `template-document.test.ts`, and `scripts/release/api/register-0.4.0.json` entries (updating `register_0_4_0_is_read_by_the_api_gate` in `src/__tests__/api-stability.test.ts` and `"intent fields closed"` in `src/__tests__/fixtures/validator-baseline.json`).
    - Spec and docs updated: `docs/spec.md` §8 (restated Rule 1 and added compound local write contract), §9, §10 (matched in `src/__tests__/validator-rules.test.ts`), §11; `docs/sdk.md`, `docs/templates.md`, `docs/renderer.md`, `docs/formats.md`, `CHANGELOG.md`, and `docs/migration-0.4.md`.
    - Findings for later tasks: `register_0_4_0_is_read_by_the_api_gate` in `src/__tests__/api-stability.test.ts` previously assumed `register-0.4.0.json` was `[]` and ran it against the minimal `fixture`; it now verifies non-empty `register040` against `baseline` vs `current`. Task 3 (`fromLocal`) should run `complete(intent, value, core.local)` after `commitLocalWrites` on unconfirmed events (and after `onApprove` on confirmed events) so `fromLocal` reads the updated `core.local` as designed.
  - Acceptance Criteria:
    - Functional:
      - A `setState` or `action` intent may carry `local`: one to four writes, each `{ key, value?, until? }`. `key` names a `local` property (`unknown-name` otherwise); a literal `value` satisfies the property; an absent `value` takes the event's value under the `setLocal` fill rule.
      - On `emit`, the renderer applies the writes in order, then raises the host intent. The completed intent the host receives has no `local` field, and `checkOffered` rejects one that does (`invalid-prop` at `/local`).
      - A write with `until: "revision"` is undone when the surface next accepts a revision of the same `surfaceId`: the key returns to the value it had before the write, unless another write changed it since.
      - A confirmed intent applies its writes only after approval. A dropped or refused confirmation writes nothing.
      - A value that fails the local schema throws from `emit` and raises nothing, as `setLocal` does today (`src/surface/core.ts:294-297`).
      - `setLocal` alone is unchanged. An event still offers exactly one host intent.
    - Performance: an intent without `local` costs one `hasOwn` more on emit; `bench/selection.bench.ts` within 2%.
    - Code Quality: the writes reuse `writeLocal`; the revert list lives in the core state plan 036 Task 4 introduced.
    - Security: law 4. Local writes grant nothing and are never sent; the host sees and checks only the intent the tree offered. Tests: the host rejects a posted `local`; a refused intent's writes follow the rule the design sets.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/formats.md`, then `references/renderer.md`.
      - `typescript-advanced-types` — the `action()` and `state.set()` option types.
    - Library Documentation to Check Before Implementation:
      - none; read `src/formats/tree.ts:9-28`, `:100-111`; `src/validate/intent.ts:84-178`; `src/validate/complete.ts`; `src/validate/offered.ts:28-100`; `src/surface/core.ts:293-303`, `:344-363`; `src/sdk/intents.ts:71-130`.
    - Documentation Reviewed:
      - Spec §8 ("Local state and bindings", "Origin and offered intent check"), §9; Task 1's design.
    - Options Considered:
      - An array of intents per event — rejected: it ends "one intent per event", and the host would have to order and partially fail several effects.
      - `setLocal` with a `then` intent — rejected: the host's offered check would read through a renderer-only intent to find its own.
    - Chosen Approach:
      - Local writes as an optional preface on the host intent, stripped on completion like `bind`.
    - API Notes and Examples:
      ```tsx
      <Button label="Save" onPress={action("tasks.save", { id }, { local: [local.set("saving", true, { until: "revision" })] })} />
      <Text when={local("saving")} text="Saving…" />
      ```
    - Files to Create/Edit:
      - `src/formats/tree.ts`, `schemas/ui-tree.json`, `schemas/tree-patch.json`: the field.
      - `src/validate/intent.ts`, `src/validate/complete.ts`, `src/validate/offered.ts`: checks, stripping, the host rejection.
      - `src/surface/core.ts`: apply, raise, revert on accept.
      - `src/sdk/intents.ts`, `src/sdk/bindings.ts`: the option and `local.set`'s third argument.
      - `src/template/document.ts`, `src/template/schema.ts`: templates copy and check the field.
      - `src/sdk/gen.ts`: element and template schemas.
      - `conformance/corpus/ui-tree/`, `conformance/corpus/tree-patch/`: valid and invalid cases.
      - `docs/spec.md` §8, §9, §10, §11; `docs/sdk.md`; `docs/templates.md`; `docs/renderer.md`; `docs/formats.md`; `CHANGELOG.md`; the 0.4.0 migration notes.
  - Test Cases to Write:
    - `event_applies_local_writes_then_raises_one_intent`: order observed through a subscriber and `onIntent`.
    - `completed_intent_carries_no_local_field` and `host_rejects_a_posted_local_field`.
    - `until_revision_write_is_undone_by_the_next_accepted_revision`, and `…_survives_a_rejected_arrival` (a rejected arrival is not a revision).
    - `local_write_to_an_undeclared_key_is_unknown_name` (arrival and `render()`), `more_than_four_writes_is_rejected`.
    - `unconfirmed_intent_writes_nothing`.
    - Type-level: `action()` with a `local` write to a key the manifest lacks fails to compile where the manifest is typed (`src/__tests__/sdk-types.test.tsx`).

- [x] Task 3: Let an intent carry values read from local state (F2)
  - Notes (executed 2026-11-18):
    - Added optional `fromLocal?: string` on `setState` intents (mutually exclusive with `value`) and `fromLocal?: Readonly<Record<string, string>>` (1–16 entries) on `action` intents in `src/formats/tree.ts` and `src/template/document.ts` (`TemplateIntent`), and regenerated `schemas/ui-tree.json`, `schemas/tree-patch.json`, `schemas/template.json`, `src/__tests__/fixtures/widgets/elements.schema.json`, `src/__tests__/fixtures/widgets/template.schema.json` and `src/__tests__/fixtures/mcp-texts.json`.
    - Updated `compileIntents` (`src/validate/intent.ts`, exporting `localFits` and extending `objectFits` with `supplied`) to validate `fromLocal` on `setState` and `action` (`unknown-name` for undeclared `local` keys, `limit-exceeded` past 16 entries, `invalid-prop` for empty/non-object `fromLocal`, undeclared action arguments, scalar type or nullability mismatch, `setState` with both `value` and `fromLocal`, and double-filled arguments across literal `args`, `bind`, `bindAll` and `fromLocal`, while omitting required arguments supplied by `fromLocal` from the upfront `args` check).
    - Extended `complete(intent, value?, local?)` (`src/validate/complete.ts`) to fill `setState.value` and `action.args` from `local` and strip `fromLocal`, updated `src/surface/core.ts` `emit` to pass `core.local` after applying compound `local` writes (including after `confirm` approval), and updated `checkOffered` (`src/validate/offered.ts`) to reject posted `fromLocal` (`invalid-prop` at `/fromLocal`), reproduce the candidate with a `localProxy` extracted from the posted values (requiring identical values when two arguments read the same `local` key), and validate the filled values against the capability `args` or manifest `state` schema.
    - Updated `src/sdk/intents.ts` (`action` and `state.set` `fromLocal` options typed by `<L>`), `src/sdk/gen.ts` (`manifestIntentPrelude`, `intentSchemas`, `templateIntent`), `src/template/document.ts` (`stateFromLocal`, `actionFromLocal`), and `src/template/render.ts`.
    - Added corpus cases under `conformance/corpus/ui-tree/` (`from-local-*.json`), unit and type tests in `src/__tests__/surface-core.test.ts`, `src/__tests__/local-bindings.test.tsx`, `src/__tests__/offered.test.ts`, `src/__tests__/host-intent.test.ts`, `src/__tests__/sdk-types.test.tsx` and `src/__tests__/sdk-gen.test.ts`, updated `scripts/release/api/register-0.4.0.json` and `src/__tests__/fixtures/validator-baseline.json`, and updated `docs/spec.md` §8–§10 (and `src/__tests__/validator-rules.test.ts`), `docs/sdk.md`, `docs/host.md`, `docs/formats.md`, `docs/templates.md`, `docs/migration-0.4.md` and `CHANGELOG.md`. `bench/host.bench.ts` `intentPipelineMs` measured at 0.037 ms (within the 0.2 ms budget).
  - Acceptance Criteria:
    - Functional:
      - An action intent may carry `fromLocal`: a map from argument name to local key, at most sixteen entries. On `emit`, each named argument is filled with the current local value and `fromLocal` is removed.
      - Arrival and `render()` check that each key is a `local` property, each argument exists in the action's schema, the two types fit under the scalar fit rule of spec §8 (`integer` fits `number`; a nullable source needs a nullable target), and no argument is filled twice (by a literal, `bind`, `bindAll` and `fromLocal` together): `invalid-prop` at the argument.
      - `checkOffered` reproduces the candidate from the offered intent with the posted values in the `fromLocal` positions, then checks those values against the capability schema. Any other difference is `invalid-prop`, as today.
      - If the design approves it, `setState` takes `fromLocal: "<key>"` under the same rules.
    - Performance: an intent without `fromLocal` is unchanged on emit and in `checkOffered`; `bench/host.bench.ts` `handleIntent` overhead stays within 0.2 ms.
    - Code Quality: filling extends `complete()` (`src/validate/complete.ts`), which the renderer and `checkOffered` already share; no second completion path.
    - Security: law 4. A local value is whatever the browser holds, so the host treats it exactly as it treats a `bind` value: bounds and enums are checked on the filled intent, never trusted from the tree. Tests cover a posted value outside the schema and a posted extra argument.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/formats.md`.
      - `typescript-advanced-types` — `fromLocal` keys typed from the manifest's `local` and the action's arguments.
    - Library Documentation to Check Before Implementation:
      - none; read `src/validate/intent.ts:23-72` (`carriesFits`, `objectFits`), `:140-178`; `src/validate/offered.ts:79-100`.
    - Documentation Reviewed:
      - Spec §8 ("Several values can commit together", "Inputs are local until they commit", the fit rules); Task 1's design.
    - Options Considered:
      - Expressions in `args` (`{ title: { $path: "local.title" } }`) — rejected: `args` are literals the host compares exactly; an expression there makes the offered check evaluate browser state it does not have.
      - A `form` primitive with an object carry — exists today and stays; it is a primitive per form shape, which is what this removes.
    - Chosen Approach:
      - A named map filled at completion.
    - API Notes and Examples:
      ```tsx
      <TextField label="Title" onChange={local.set("title")} />
      <Button label="Create" onPress={action("tasks.create", { list }, { fromLocal: { title: "title" } })} />
      ```
    - Files to Create/Edit:
      - `src/formats/tree.ts`, `schemas/ui-tree.json`, `schemas/tree-patch.json`.
      - `src/validate/intent.ts`, `src/validate/complete.ts`, `src/validate/offered.ts`.
      - `src/surface/core.ts`: `emit` passes the local state to `complete`.
      - `src/sdk/intents.ts`; `src/template/document.ts`; `src/sdk/gen.ts`.
      - `conformance/corpus/ui-tree/`.
      - `docs/spec.md` §8–§10; `docs/sdk.md`; `docs/host.md`; `docs/formats.md`; `CHANGELOG.md`.
  - Test Cases to Write:
    - `action_arguments_are_filled_from_local_state_at_emit`.
    - `from_local_type_mismatch_is_invalid_prop`: a string key into an integer argument.
    - `argument_filled_twice_is_invalid_prop`: a literal and `fromLocal` on one argument.
    - `host_checks_filled_values_against_the_capability_schema`: a posted value over `maxLength` is refused and recorded `refused`.
    - `host_rejects_a_changed_literal_beside_from_local`.

- [x] Task 4: Let an event carry a bounded array of scalars (F3)
  - Notes (executed 2026-11-18):
    - Added the third carry form `{ array: { items, maxItems } }` to `Definition["events"][string]["carries"]` (inline type, `src/formats/catalog.ts`) and to `catalogSchema` (`items`: `allOf` of the language `schema` and a scalar `type`; `maxItems`: integer 1–256; closed), regenerating `schemas/catalog.json`. `validateCatalog` runs `schemaRelationships` on `carries/array/items`. `classifyCatalogChange` now compares object and array carries through one `carriesSchema()` (`src/formats/events.ts`), so any array change is major, a form switch is major and an added array event is minor.
    - `carriesSchema()` turns an object or array carry into the schema `emit` and `checkOffered` compile; `carriesCheck()` (`src/validate/intent.ts`) compiles it once and replaces the two inline `compileSchema(carries.object)` sites in `src/surface/core.ts` (`specsFor`) and `src/validate/compile.ts` (`offered`). `carriesValue` is unchanged for scalars.
    - Fit (`src/validate/intent.ts`): `arrayFits` (target is an array whose `items` pass `localFits`) and `eventFits` (scalar or array carry against a target schema) back `bind` and implicit `setState`; `bindAll`, `fromLocal`'s `bindAll` overlap and `checkOffered`'s `bindAll` extraction now narrow on `"object" in carries`. Implicit `setLocal` and value-less `local` writes stay on `carriesFits`, which already rejects an array (`invalid-prop` at `/value`). Bind messages use `describeCarries()` (scalar messages unchanged). Templates (`src/template/document.ts`) use the same helpers; their `bind` message now names the carry without JSON quotes.
    - `Emit<D>` (`src/react/implement.ts`) maps an array carry to `[event, readonly Infer<items>[]]`. The generators needed no change: `generateDefinitions` copies the literal (`carries.definitions.gen.ts` gained `onSelect`), and the authoring intent types do not depend on the carry.
    - Fixtures: `src/__tests__/fixtures/widgets/carries.json` gains `onSelect` (the proof catalog fixture is exported from `proof/` and was left alone); `src/__tests__/fixtures/array-events.ts` is the array counterpart of `object-events.ts`. Tests: `src/__tests__/array-events.test.tsx` (definition validation, catalog change level, fit and `invalid-prop` pointers, `emit` rejections and copy, host re-check against carry and capability bounds, template fit) and `generated_definitions_infer_array_carries` in `react-types.test.tsx`. Corpus: `conformance/corpus/common/array-{catalog,capabilities,manifest}.json`, `catalog/array-carry*.json`, `ui-tree/array-*.json`.
    - Spec §5 (carry forms and bounds), §8 (new "An event can carry a bounded list" rule; `bind` takes scalar or array events), §10 (bullet matched in `validator-rules.test.ts`), §11 (`emit` compiles array carries). Docs: `docs/formats.md`, `docs/renderer.md`, `docs/sdk.md`, `CHANGELOG.md`, `docs/migration-0.4.md`. Register: `schemas/catalog.json`, `. Definition`, `./react ImplementationProps`.
    - Not done: the generated author types do not narrow `bind` to array arguments; this matches the object carry, where the validator alone checks the fit.
    - Also split the Task 3 `fromLocal` bullet in spec §8 at "On `emit`": it exceeded the 160-word paragraph limit in `docs-spec-structure.test.ts`.
    - Verification: build, `gen:check`, typecheck, lint and format pass. The full `bun run test` ran with a host load average of about 28 on 16 cores: the only non-environmental failures (the §10 rule text and the spec paragraph length) are fixed. The remaining failures were Playwright context crashes and timeouts, and all nine affected files pass when run on their own (122 pass, 0 fail). `bench/validator.bench.ts` was not measured on this host; re-run it with `bun run check` on a quiet machine.
  - Acceptance Criteria:
    - Functional:
      - A definition's event may declare `carries: { array: { items, maxItems } }`, where `items` is a `string` (with `maxLength`), `boolean`, `number` or `integer` schema and `maxItems` is 1 to 256. Anything else is `invalid-document` at the event's `carries`.
      - `emit` checks the value against it. `bind` fills an array argument, and implicit `setState` fills an array state key, when the item types fit; `bindAll` is not allowed (`invalid-prop`).
      - `classifyCatalogChange` treats a changed array carry as major and an added event as minor, as for other carries (`src/formats/catalog.ts:425-428`).
      - Generated types give `emit(event, value: readonly string[])` for implementations and the fitting intent types for authors.
      - The proof catalog's fixture gains one kind that uses it, in `src/__tests__/fixtures/` only.
    - Performance: catalogs without array carries compile and validate as today; `bench/validator.bench.ts` within 2%.
    - Code Quality: the check is a compiled schema like the object carry's (`src/surface/core.ts:143`); `carriesValue` stays for the scalar forms.
    - Security: law 2 — the array is bounded in length and item size, so an event cannot exceed the intent's own byte bounds; law 4 — the host re-checks the filled value.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/formats.md`.
      - `typescript-advanced-types` — `Emit<D>` in `src/react/implement.ts:13-27` and the generated intent types.
    - Library Documentation to Check Before Implementation:
      - none; read `src/formats/catalog.ts:53-54`, `:91-108`, `:264-265`, `:425-428`; `src/formats/events.ts`; `src/validate/intent.ts:21-72`.
    - Documentation Reviewed:
      - Spec §5 (`events`: "Nested objects and arrays are rejected"), §8; `src/__tests__/object-events.test.tsx`; Task 1's design.
    - Options Considered:
      - Arrays inside object carries — rejected for now: it reopens the 32-scalar bound and the `bindAll` fit rule together; the design may list it as a follow-up.
      - A comma-joined string — what authors do today; it loses types and bounds per item.
    - Chosen Approach:
      - A third carry form beside scalar and object.
    - API Notes and Examples:
      ```ts
      events: { onChange: { carries: { array: { items: str({ maxLength: 64 }), maxItems: 50 } }, description: "The selected ids." } }
      ```
    - Files to Create/Edit:
      - `src/formats/catalog.ts`, `schemas/catalog.json`, `src/validate/format-schema.ts`.
      - `src/formats/events.ts`, `src/validate/intent.ts`, `src/validate/offered.ts`, `src/surface/core.ts:128-152`.
      - `src/react/implement.ts`; `src/sdk/gen.ts`.
      - `conformance/corpus/catalog/`, `conformance/corpus/ui-tree/`.
      - `src/__tests__/fixtures/` (an array-carry fixture, as `object-events.ts` is for objects).
      - `docs/spec.md` §5, §8; `docs/formats.md`; `docs/renderer.md`; `CHANGELOG.md`.
  - Test Cases to Write:
    - `array_carry_definition_is_validated`: unbounded items, nested arrays and `maxItems` over 256 are `invalid-document`.
    - `emit_rejects_an_array_outside_its_carry`.
    - `array_event_fills_an_array_argument_and_state_key`, and `…_with_unfitting_items_is_invalid_prop`.
    - `changed_array_carry_is_a_major_catalog_change`.
    - Type-level: wrong item type to `emit` fails to compile (`src/__tests__/react-types.test.tsx`).

- [x] Task 5: Let a tree say which node takes focus (F4)
  - Notes (executed 2026-11-18):
    - Wire: optional `focus?: string` on `UiTree` (`src/formats/tree.ts`, a shared node-id schema) and `focus?: string | null` on `TreePatch` (`src/formats/tree-patch.ts`); regenerated `schemas/ui-tree.json`, `schemas/tree-patch.json`, `schemas/template.json`. `validateTree` (`src/validate/tree.ts`) checks the id shape (`invalid-prop` at `/focus`, new `isNodeId`) and after the walk resolves it like a `refProps` target (`checkFocus`: `not-found`, or `invalid-prop` when it or an ancestor carries `when`). `applyPatch` keeps, sets or clears the mark; `diffTrees` emits it only on change (`null` when removed).
    - Authoring: `focus` joins `NOT_PROPS` in `src/sdk/render.ts`; `markFocus` records one marked element (`duplicate-key` at the second's `/focus`, `invalid-prop` for non-boolean or gated), and `conclude` counts its bytes and puts it on the tree. Streamed partial trees (`StreamBuild.tree`) carry no mark; the finished tree does. Element JSON: `ELEMENT_KEYS` and `Elements<C>` gain `focus`; fragments reject it (`rejectFragmentFields`). Templates: `TemplateNode.focus` (an `Expr` checked as a boolean at install; rejected on `$use` and fragments), evaluated in `src/template/render.ts`. `liveframe gen` reserves `focus`, adds `focus?: boolean` to generated primitives and `focus` to the elements and template schemas.
    - Core and React: `SurfaceSnapshot.focus` (set in `snapshotOf` while valid); `SurfaceEvent` gains `focus-missed` (`no-element` | `not-focusable`). `<Surface>` (`src/react/renderer.tsx`) runs `useFocusMark` (a layout effect, after `FocusContinuity.componentDidUpdate`): it records the first drawn tree per `surfaceId` without moving focus, and on a later accepted revision with a changed mark calls `focus({ preventScroll: false })` on `${domIdPrefix}:${id}` only when that element is inside the wrapper or portal; otherwise it reports `focus-missed`. Extracted as a hook to keep `Surface` within Biome's complexity limit.
    - Tests: `src/__tests__/focus-mark.test.tsx` (validator, byte budget agreement between `render()` and `validateTree`, TSX, element JSON, stream, template, patch round trip, core snapshot); browser cases in `react-browser.test.tsx` (`changed_focus_mark_moves_focus_once`, `focus_mark_on_the_first_tree_follows_the_decided_rule`, `focus_mark_cannot_reach_another_surface`, `focus_mark_without_a_focusable_element_is_reported`), with a `mountPair` helper in `fixtures/react-client.tsx` and `domId` placed on the test renderer's elements in `fixtures/react-surface.tsx`; §10 matrix rows in `validator-rules.test.ts` (baseline regenerated); corpus `conformance/corpus/ui-tree/focus-{valid,missing,gated,malformed}.json`; new patch vectors `conformance/patch/focus.json` (a new file, so existing patch hashes are unchanged) read by `tree-patch.test.ts`.
    - Register: `UiTree`, `TreePatch`, `./sdk Elements`, `./surface SurfaceEvent`, `./surface SurfaceSnapshot`, `./template TemplateNode` and the three schema entries in `register-0.4.0.json`. The starter's generated `./ui` primitives gain `focus`, so the companion-package gate now reads a new `scripts/release/api/register-0.4.0-starter.json` (25 `widened` entries) instead of `[]`; `docs/compatibility.md` names both registers.
    - Spec: §7.6 (template `focus`), §9 (tree field, authoring forms, reserved name, streams), §9.1 (patch field and `diffTrees`), §10 (new bullet "a tree's `focus` names a node …"), §11 (snapshot `focus`, `focus-missed`, and two bullets on the move: first-tree rule with the WAI-ARIA reason, and resolution inside the surface). Docs: `docs/formats.md`, `docs/sdk.md`, `docs/templates.md`, `docs/renderer.md` (new "Move focus to a node the widget names" and the event table), `CHANGELOG.md`, `docs/migration-0.4.md`. `src/__tests__/fixtures/mcp-texts.json` regenerated (the elements schema gained `focus`).
    - Parity: `tree-rule-parity.test.ts` now carries the tree's `focus` into the element form as `focus: true` on the marked node and maps the walk's `/focus` to that element's field; `focus-missing` and `focus-malformed` are walk-only (`CORPUS_WALK_ONLY`), since element JSON cannot mark a node that does not exist. `fixtures/widgets/references.gen.ts` regenerated (it has no `gen:check` entry).
    - Verification: build, `gen:check`, typecheck, lint and format pass. The full `bun run test` ran 1,945 tests (1,934 pass); its two failures (the parity test and `references.gen.ts`) are fixed above and both files pass again. No bench was run; the arrival path for a tree without `focus` adds one `hasOwn` in `enterTree` and one property read in `snapshotOf`.
    - Findings: the design's `not-focusable` check accepts focus already inside the target, so a container mark whose subtree holds focus is not reported (tested). Element JSON still reads a `focus` inside `props` as the mark, as it does for `when` (`mergeSections` reserves only `key`, `children`, `variant`, `$anchor`); no reserved-name check exists in `validateCatalog` for `when`, `bind` or `focus` (only `liveframe gen` refuses them). Task 8 can reuse `mountPair` and the `focus-missed` event for its focus case.
  - Acceptance Criteria:
    - Functional:
      - A tree may carry `focus`: the id of one node. Arrival and `render()` check that the node exists and is not under a `when` (`not-found`, `invalid-prop`), with the rules `refProps` targets follow (`src/validate/tree.ts:121-139`).
      - In TSX and templates the author sets a `focus` attribute on one element; a second is `duplicate-key` at the second element.
      - `<Surface>` moves focus to the element with that node's `domId` after the commit that first draws the revision, when the tree's `focus` differs from the previous accepted tree's, and under the rule Task 1 sets for a first tree. It uses `focus({ preventScroll: false })` so the node is revealed. It emits no intent.
      - A node that renders no element with its `domId` is skipped and reported through `onEvent` (the event type the design names).
      - Focus continuity (spec §11) still applies when no mark changes.
    - Performance: a tree without `focus` costs nothing more; with it, one `getElementById` per changed mark.
    - Code Quality: the mark is a tree field, not a prop of every kind; primitives need no change beyond placing `domId`, which they do for references already.
    - Security: law 3 and law 4 — a focus move is neither style nor authority. A widget cannot focus outside its surface: the id resolves only among this surface's `domId`s.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/formats.md`, then `references/renderer.md`.
      - `find-docs` — React effect timing.
    - Library Documentation to Check Before Implementation:
      - React 19.3.1: `useLayoutEffect` after commit, and its order relative to `FocusContinuity.componentDidUpdate` (`src/react/renderer.tsx:171-187`).
    - Documentation Reviewed:
      - Spec §9 (tree fields), §11 (`domId`, focus continuity); `decision-logs/2026-11-02-1219-defer-node-references-to-0-3-0.md`; Task 1's design.
    - Options Considered:
      - An `autoFocus` prop on each focusable kind — rejected: it is per catalog and applies on every mount, which steals focus on re-render.
      - A host-side API (`surface.focus(nodeId)`) — rejected: the host does not know which node the widget means; the widget does.
    - Chosen Approach:
      - One tree-level mark, applied when it changes.
    - API Notes and Examples:
      ```tsx
      <TextField focus={state.adding} label="New task" onCommit={action("tasks.add", {}, { bind: "title" })} />
      // wire: { format: "liveframe/1", …, focus: "root/list/new", root: { … } }
      ```
    - Files to Create/Edit:
      - `src/formats/tree.ts`, `schemas/ui-tree.json`, `src/formats/tree-patch.ts`, `schemas/tree-patch.json` (how a patch changes the mark is in the design).
      - `src/validate/tree.ts`, `src/validate/patch.ts`; `src/sdk/render.ts` (`NOT_PROPS`, `:1064`), `src/sdk/elements.ts`, `src/template/render.ts`.
      - `src/surface/core.ts` (the snapshot exposes the mark); `src/react/renderer.tsx` (the move).
      - `src/sdk/gen.ts`; `conformance/corpus/ui-tree/`, `conformance/patch/`.
      - `docs/spec.md` §9–§11; `docs/sdk.md`; `docs/renderer.md`; `CHANGELOG.md`.
  - Test Cases to Write:
    - `focus_mark_to_a_missing_or_gated_node_is_rejected`.
    - `two_focus_marks_in_one_tree_is_duplicate_key`.
    - `changed_focus_mark_moves_focus_once`: a second revision with the same mark does not move it again while the user is elsewhere (browser test).
    - `focus_mark_on_the_first_tree_follows_the_decided_rule`.
    - `focus_mark_cannot_reach_another_surface`: two sibling surfaces with equal node ids.
    - `diffed_and_applied_patch_round_trips_the_mark`.

- [x] Task 6: Give `Store` a compare-and-set for state (G2)
  - Notes (executed 2026-11-18):
    - `Store` (`src/store/index.ts`) gains optional `putStateIf(placementId, scope, expected, next): Promise<boolean>`. The comparison is the new `sameState` (`src/store/same.ts`): `undefined` matches only no stored state, anything else matches by `canonicalJson`. `memoryStore()` checks the scope, then compares and writes with no `await` between them (one shared `setState` helper with `putState`). `fileStore()` checks the scope, then runs the read, compare and atomic temp-file-and-rename write inside a module-level `states` queue, as `putPackage` does with `packages`.
    - `applyState` (`src/host/intent.ts`): `authorize` still runs first. With the method, the raw state is read once with `getState` and passed to `loadPlacement` as `state`, so the uncontended path is one state read and one `putStateIf`, as before. On `false` it re-reads, re-runs `verifyPlacementInputs` (the same check, migrate and reset rules), overlays the key, re-checks `manifest.state` (`withKey`) and tries again. After `STATE_ATTEMPTS = 4` it returns `version-conflict` at `/state` and raises `intent-refused` with the new reason `conflict` (`HostEvent` in `src/host/types.ts`). Without the method the path is unchanged (`putState`).
    - `storeSuite()` gains `store_put_state_if_compares_by_canonical_json` and `store_put_state_if_is_scoped`. The case list is built before a store exists, so both are always listed and return early for a store without the method (19 → 21 cases, 22 with `reopen`). Both reference stores pass them.
    - Tests: `concurrent_set_state_on_two_keys_keeps_both` (a barrier makes both calls read before either writes; it also shows that the same interleaving through `putState` loses a key), `contended_write_gives_up_with_version_conflict` (exactly four attempts, nothing written or rendered), `store_without_the_method_behaves_as_before` and `set_state_with_compare_and_set_reads_and_writes_state_once` in `host-intent.test.ts`. That file's fixture store now wraps `putStateIf`, so two existing log expectations read `putStateIf`. `store_suite_checks_compare_and_set_when_present` in `conformance-store.test.ts` uses one broken store that ignores `expected` and one that crosses scopes; each fails its own rule, and a store without the method passes both.
    - Register: `./store Store` and `./host HostEvent` (`widened`) in `register-0.4.0.json`.
    - Spec §7.4 (the interface, the `putStateIf` contract, `fileStore`), §7.7 (the `setState` step, the `conflict` reason, and a line in "What stays the host's" saying CAS does not serialise `served`/`actions`). Docs: `docs/host.md` (the `setState` step, events, multi-process guidance under Concurrency), `docs/packages.md` (the method's table row, `fileStore`, custom stores), `docs/conformance.md` (the `storeSuite` row), `CHANGELOG.md`, `docs/migration-0.4.md`, and the storage reference in the `liveframe-execution` skill.
    - Verification: build, `gen:check`, typecheck, lint and format pass. The full `bun run test` run (1,956 tests, host load average about 20) failed only `source_comments_cite_no_plan_or_decision_ids` (a plan id in a comment) and `subpath_export_surfaces` (the `storeSuite` case count in `exports.test.ts`); both are fixed and their files pass. An earlier run killed by its timeout also showed Playwright failures in `proof/tests/styles.test.ts`, `switch.test.ts` and `conformance-browser.test.ts`; those three files pass on their own (16 pass). `bench/host.bench.ts`: `intentPipelineMs` 0.026 ms (budget 0.2 ms), `httpSetStateCpuMs` 0.63 ms (budget 50 ms).
    - Finding: `bun --conditions liveframe:source test <file>` runs the package `test` script, which is the whole suite, not the named file. To run one file, use `bun test --conditions liveframe:source ./<file>`. The plan's Verification line uses the first form, so it runs everything.
  - Acceptance Criteria:
    - Functional:
      - `Store` gains an optional method (proposed: `putStateIf(placementId, scope, expected, next): Promise<boolean>`, where `expected` is the state last read or `undefined` for none) that writes only if the stored state equals `expected` by canonical JSON.
      - `memoryStore()` and `fileStore()` implement it; `fileStore()`'s write stays atomic on one machine (its existing rename).
      - `handleIntent`'s `setState` path (`src/host/intent.ts:182-202`) uses it when the store has it: on `false` it re-reads, re-applies the one key, re-checks the state schema and tries again, at most the number of times the design sets, then returns `version-conflict` at `/state` with an `intent-refused` event.
      - A store without the method behaves as today, and `docs/host.md` says what that means for a multi-process host.
      - `storeSuite()` gains cases that run when the method is present.
    - Performance: one read and one write on the uncontended path, as today; `bench/host.bench.ts` within budget.
    - Code Quality: one optional method; no lock, lease or version counter in the library.
    - Security: law 4 — the write still follows `checkOffered` and `authorize`. Spec §7.4's isolation rule holds: the comparison is within one `(placementId, scope)`.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/storage.md`.
      - `find-docs` — Bun file APIs for the atomic write.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2+: `node:fs/promises` `rename` and `open` with `wx` as `src/store/fs/index.ts` uses them.
    - Documentation Reviewed:
      - Spec §7.4, §7.7 ("What stays the host's": "serialising calls per placement and scope"); `src/store/index.ts`; `src/store/memory.ts`; `src/conformance/store.ts`; `decision-logs/2026-11-08-1115-stateless-host-pipeline.md`.
    - Options Considered:
      - A version number returned by `getState` — rejected: it changes `getState`'s return type, a break every store must absorb.
      - An `updateState(id, scope, fn)` that runs a callback inside the store — rejected: a remote store cannot run the host's function atomically.
      - Leave it to hosts — the status quo; the interface gives them nothing to build on across processes.
    - Chosen Approach:
      - An optional compare-and-set by value, used when present.
    - API Notes and Examples:
      ```ts
      interface Store {
        putStateIf?(placementId: string, scope: string, expected: Json | undefined, next: Json): Promise<boolean>;
      }
      ```
    - Files to Create/Edit:
      - `src/store/index.ts`, `src/store/memory.ts`, `src/store/fs/index.ts`.
      - `src/host/intent.ts`: `applyState`.
      - `src/host/types.ts`: the `intent-refused` reason, if the design adds one.
      - `src/conformance/store.ts`; `docs/conformance.md`.
      - `docs/spec.md` §7.4, §7.7; `docs/host.md`; `docs/packages.md`; `CHANGELOG.md`.
  - Test Cases to Write:
    - `concurrent_set_state_on_two_keys_keeps_both`: two `handleIntent` calls interleaved at the read; both keys are stored. Fails with `putState`.
    - `contended_write_gives_up_with_version_conflict`: a store whose method always answers `false`.
    - `store_without_the_method_behaves_as_before`.
    - `store_suite_checks_compare_and_set_when_present`: a broken implementation that ignores `expected` fails its named rule.

- [x] Task 7: Let a filtered list show an empty state without a round trip
  - Notes (executed 2026-11-19):
    - Implemented the design's candidate 1 (`plans/evidence/037-interaction-design.md` §6, E.1–E.4): a third read-only expression root `shown`, typed `{ type: "integer", minimum: 0 }` (`SHOWN` in `src/validate/bindings.ts`), added to the `when`/`bind` scope of `compileBindings` in `src/validate/bindings.ts` (so arrival, `render()` and template install all see it) and `src/surface/bindings.ts`. Template scope is unchanged, so props, `$if`, `$let` and `$embed` reading `shown` stay `unknown-name`. No operator was added.
    - **Deviation from the criterion above, following the design (E.2):** a reader of `shown` is never counted, rather than "a reader counted by another reader is `invalid-prop`". Excluding readers removes the cycle by construction, lets an empty row and a count badge share a parent, and keeps evaluation to one extra pass over the readers. So `two_readers_counting_each_other_is_rejected` became `two_readers_do_not_count_each_other` (both readers accepted, both read the same count).
    - Counting: `shown` is the number of a node's direct children that carry `when`, built to a non-fault context, and do not read `shown`; the root reads 0. Core (`src/surface/core.ts`): the per-node `subtreeReads` cache became `subtrees` (`Subtree`: `reads`, `readsShown`, `readers`), filled in the same walk; `Entry` carries `readers` and the `shown` count a reader last read, so `build(node, local, shown = 0)` reuses a reader only while its count is unchanged. `branch` builds its children in one pass when `readers` is empty, else `countedItems` builds the other children, counts and then builds readers in child order. `compileBindings` (surface) records `readsShown` and uses frame slots fixed once per module (`SLOTS`): this drops one scope build per compiled node, so `surface_core_work_per_arrival_and_event_is_unchanged` was updated to the lower counts (`mapGet` 927→827 and 922→822, `sets` 256→206 and 254→204; every other count unchanged).
    - SDK: `shown()` in `src/sdk/bindings.ts`, exported from `./sdk` (`exports.test.ts`; register entry `./sdk shown`). Element JSON already accepts `{ "$path": "shown" }` in `when`/`bind`, since it shares the validator; plan 039 Task 2 needs nothing extra.
    - Tests: `src/__tests__/shown-root.test.tsx` (core: `empty_row_appears_when_every_filtered_sibling_is_hidden`, `empty_row_disappears_when_one_shows`, unchanged count keeps the reader's context, two readers, ungated and faulted siblings not counted, root reads 0, direct children only; validator: `shown.n` `unknown-name`, `shown` as a `when` or string `bind` `invalid-prop`; SDK `render()`; templates: `sibling_count_is_not_readable_outside_when_and_bind` and copying into the tree). Browser: `empty_row_appears_when_every_filtered_sibling_is_hidden_and_disappears_when_one_shows` in `react-browser.test.tsx`, with `mountFiltered()` in `fixtures/react-client.tsx`. Corpus: `conformance/corpus/ui-tree/shown-{valid,no-properties,not-boolean,bind-type-mismatch}.json`. `fixtures/validator-baseline.json` and the §10 row in `validator-rules.test.ts` updated for the new root.
    - Bench: `live_filter_50_rows_no_round_trip` (`proof/tests/renderer-browser.test.tsx`) also measures the 50 rows beside an empty row, and `bench/selection.bench.ts` records `liveFilter.emptyRow.medianMs` with the same 4 ms budget. Measured 2.00 ms with the empty row against 2.15 ms without it, on a host at load average ~22 on 16 cores (a first run under that load also put the existing row over 4 ms; rerun on a quiet machine).
    - Spec: §7.6 (template `when`/`bind` may read `shown`), §8 (three roots; new "A list can know how many rows it draws" rule; checks; TSX `shown()`), §10 (bullet now names the three roots), §11 (new `shown` bullet beside "Local state and bindings"). Docs: `docs/sdk.md`, `docs/templates.md`, `docs/formats.md`, `CHANGELOG.md`, `docs/migration-0.4.md`. Backlog entry "Let a filtered list know it is empty" closed.
    - Verification: build, `gen:check`, typecheck, lint and format pass; the full `bun run check` passed (1,958 pass, 9 skip, 0 fail).
  - Acceptance Criteria:
    - Functional:
      - The candidate Task 1 chose is implemented. The proposal: a third expression root, readable only in `when` and `bind` of a node, giving the number of that node's siblings that carry a `when` and are currently shown.
      - It is bounded: no iteration, one integer, evaluated after the siblings, with the fuel rule of `src/surface/bindings.ts:14`. A node that reads it may not itself be counted by a sibling that reads it (`invalid-prop`), so evaluation needs one extra pass at most.
      - The parent's child-count bounds still hold with every `when` child present and absent (spec §8).
      - TSX, templates and, after plan 039 Task 2, element JSON can write it.
    - Performance: a parent with no reader is unchanged; with one, the extra pass touches only the readers. `bench/selection.bench.ts` gains a live-filter row with a budget.
    - Code Quality: the count comes from `branch()`'s `items` (`src/surface/core.ts:371-385`), which already holds the shown children.
    - Security: law 1 — still data evaluated by the renderer; the allow-list in `src/validate/bindings.ts` gains one root and no operator.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/renderer.md`.
    - Library Documentation to Check Before Implementation:
      - none; read `src/surface/bindings.ts`, `src/validate/bindings.ts`, `src/template/scope.ts:193-225`.
    - Documentation Reviewed:
      - Spec §8 ("Expressions", "Checked on arrival and in `render()`"); `plans/backlog.md` "Let a filtered list know it is empty" (the three candidates); `plans/evidence/029-impact-analysis.md` F7.
    - Options Considered:
      - An aggregate `local` key the core writes — rejected: the widget would declare a key it must never set, and two lists would need two keys.
      - Document the `setState` workaround — the status quo: a round trip for an empty state.
    - Chosen Approach:
      - A read-only sibling count, as the design confirms.
    - API Notes and Examples:
      ```tsx
      {rows.map((r) => <Row key={r.id} when={ex.contains(r.title, local("q"))} title={r.title} />)}
      <Text when={ex.eq(shown(), 0)} text="No matches" />
      ```
    - Files to Create/Edit:
      - `src/validate/bindings.ts`, `src/surface/bindings.ts`, `src/surface/core.ts`.
      - `src/sdk/bindings.ts`; `src/template/scope.ts`, `src/template/document.ts`.
      - `conformance/corpus/ui-tree/`.
      - `docs/spec.md` §8; `docs/sdk.md`; `docs/templates.md`; `plans/backlog.md` (close the entry).
  - Test Cases to Write:
    - `empty_row_appears_when_every_filtered_sibling_is_hidden` and `…_disappears_when_one_shows` (core and browser).
    - `two_readers_counting_each_other_is_rejected`.
    - `sibling_count_is_not_readable_outside_when_and_bind`.

- [x] Task 8: Cover local state, bindings and the additions in the renderer conformance suites
  - Notes (executed 2026-11-19):
    - Server (`src/conformance/react/server.tsx`): `failed_binding_draws_the_node_fallback` (§8, events §11). It needs no fixture. For each example it gives the first root child the validator accepts (or else the root) `when: { $eq: [{ $div: [1, 0] }, 1] }`, which passes the static checks and faults when evaluated. It then expects the node fallback markup in the output, the root's slot class still drawn, no implementation call for that node and a `binding-failed` event for it. `each()`'s render callback now takes an optional `onEvent`.
    - Browser (`src/conformance/react/browser.tsx`): `when_false_node_is_not_drawn` (absent, drawn, absent again), `set_local_redraws_and_never_reaches_the_host` (drawn after `show`; `emissions()` empty: the first law 4 conformance case), `local_writes_apply_with_one_complete_host_intent` (exact complete intents, `checkOffered` passes, the write's node drawn), `from_local_intent_arrives_complete` and `focus_mark_moves_focus_once` (blur, mount `next`: focus inside `target`; blur, mount a higher revision with the same mark: focus stays out). They read four new optional `BrowserFixtures` fields, `local`, `compound`, `fromLocal` and `focus`. A missing field fails its case and names it, as missing `states` keys do. Each case also checks that its fixture tree uses the feature (a `when`, a `setLocal`, `local` on a host intent, `fromLocal`). The interaction loop became a shared `interact()` helper. `conformancePage()` (`page.tsx`) records `onEvent` and exposes `events()`, which the focus case uses to report `focus-missed`.
    - **Deviation:** the failed-binding case lives only in `rendererSuite` and the other five only in `rendererBrowserSuite`. With the library's renderer, an implementation cannot draw a hidden node on the server or forward `setLocal` there. On the client the subject is the app's page, which the browser cases drive.
    - Broken subjects. These are implementation modes in `fixtures/conformance-browser.tsx` and page wrappers in `fixtures/conformance-client.tsx`, not under `fixtures/conformance/` (that directory holds the catalog suite's data): `forward-local` (buttons post their `setLocal` to the host channel), `stale-children` (a stack keeps drawing removed children), `post-local` (the compound action arrives with `local`), `unfilled` (the fromLocal action arrives with `fromLocal` and without its argument) and `no-dom-id` (the text field drops `domId`). The server's `proxy-text` mode (`conformance-renderer.test.tsx`) is a stack that draws text children from their props, so it ignores a failed binding. `renderer_that_forwards_set_local_fails_its_rule`, `renderer_that_draws_a_hidden_node_fails_its_rule` and `renderer_that_ignores_a_failed_binding_fails_its_rule` check that only their own case fails. The other three modes are in the mutant table, and `missing_local_fixtures_fail_with_the_named_rule` checks the fixture messages.
    - Fixtures. The library fixture's manifest gains `local: { open, title }`, and its text field places `domId`. The proof host gains a `local` manifest block (`proof/tests/fixtures/renderer.ts`), the four fixtures (`proof/tests/fixtures/conformance.ts`) and `id={domId}` on its text field input (`proof/renderer/primitives/index.tsx`). The starter gains the same (`packages/starter/src/__tests__/host.ts`, `browser-fixtures.ts`); its implementations already placed `domId`.
    - Time: on the proof host, under load average ~11 on 16 cores, the five browser cases took 1.6, 1.4, 1.9, 1.9 and 1.3 s (about 8 s in all, across four theme × design-system pairs). No case waits on a fixed delay; each uses `settle()` (two animation frames).
    - Register: `./conformance/react BrowserFixtures` (`widened`). Docs: `docs/conformance.md` (suite rows, `events()`, four fixture rows), spec §13 "Conformance contracts" (a new bullet), `docs/migration-0.4.md` (CI action needed), `CHANGELOG.md`. The backlog entry "Cover the surface core and local bindings in the renderer conformance suites" is closed. A `/surface` suite stays with plan 038 Task 6.
    - Verification: `bun run check` passes (1,972 pass, 9 skip, 0 fail). That includes the starter (`browser.test.ts`, `suites.test.ts`) and proof host (`conformance-browser.test.ts`, `conformance.test.ts`) runs of the new cases, and `conformance-guide.test.ts`.
  - Acceptance Criteria:
    - Functional:
      - `rendererSuite()` and `rendererBrowserSuite()` gain cases, each with a rule name and spec section: a `when`-false node is not mounted; `setLocal` changes what is drawn and never calls `onIntent`; a failed binding draws the node fallback and reports `binding-failed`; local writes on a host intent apply before it is raised (Task 2); a `fromLocal` intent arrives complete (Task 3); a focus mark moves focus once (Task 5).
      - A broken subject for each case fails exactly its rule (`src/__tests__/fixtures/conformance/`).
      - The starter and the proof host pass; `docs/conformance.md` lists the cases; its compiled guide test passes.
    - Performance: the browser suite's added time is recorded; no case waits on a fixed delay.
    - Code Quality: cases use the suites' existing fixtures and `mount`/`settle` helpers (`src/conformance/react/browser.tsx:231-240`).
    - Security: law 4 has a conformance case for the first time: a renderer that forwards `setLocal` to the host fails the suite.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/renderer.md`.
      - `find-docs` — Playwright locators and focus assertions.
    - Library Documentation to Check Before Implementation:
      - Playwright 1.49 (peer floor) to 1.64 (locked): `page.evaluate`, `locator.focus`, `expect.poll`.
    - Documentation Reviewed:
      - Spec §13; `docs/conformance.md`; `src/conformance/react/server.tsx:36-240`, `browser.tsx:18-260`; `plans/backlog.md` "Cover the surface core and local bindings in the renderer conformance suites".
    - Options Considered:
      - A separate `/conformance/surface` suite for adapters on `/surface` — deferred to plan 038 Task 6, which needs it for the DOM adapter.
    - Chosen Approach:
      - Extend the two React suites; the cases are written against observable DOM and `onIntent`, so plan 038 can reuse them.
    - API Notes and Examples:
      ```ts
      rendererSuite({ renderer, catalog, fixtures }).forEach(({ name, run }) => test(name, run));
      ```
    - Files to Create/Edit:
      - `src/conformance/react/server.tsx`, `browser.tsx`, `page.tsx`.
      - `src/__tests__/fixtures/conformance/`: broken subjects.
      - `src/__tests__/conformance-renderer.test.tsx`, `conformance-renderer-browser.test.tsx`; `packages/starter/src/__tests__/suites.test.ts`, `browser.test.ts`.
      - `docs/conformance.md`; `plans/backlog.md` (close the entry).
  - Test Cases to Write:
    - `renderer_that_forwards_set_local_fails_its_rule`, `renderer_that_draws_a_hidden_node_fails_its_rule`, `renderer_that_ignores_a_failed_binding_fails_its_rule`: each broken subject fails only its own case.
    - `starter_and_proof_host_pass_the_new_cases`.

- [x] Task 8a: Let the MCP `set_state` tool apply a `fromLocal` state event
  - Notes (executed 2026-11-19, from Task 9 F2):
    - `src/authoring/index.ts` `setState` passes `{ [offered.fromLocal]: value }` to `complete()` when the offered event reads `fromLocal`, because a preview session holds no browser local state. Before this, `complete()` ignored `value` for such an event, and the preview session refused the value-less intent at `/value`.
    - The tool's description and its `value` description (`src/cli/mcp.ts`), `docs/mcp.md` and the `fromLocal` line in `CHANGELOG.md` say so.
    - Test: `set_state_applies_a_from_local_event_with_value_as_the_local_read` (`src/__tests__/authoring.test.ts`). It adds an "Apply" button with `state.set("query", undefined, { fromLocal: "draft" })` to the harness draft, then checks that the value lands in state and that a value outside the state schema is `invalid-prop` at `/value`. It failed before the change. `cli-mcp.test.ts` passes (85).
  - Acceptance Criteria:
    - Functional: an offered `setState` with `fromLocal` applies `value` as the local read; `checkOffered` and the state schema still check it.
    - Performance: n/a — one object per `set_state` call.
    - Code Quality: reuses `complete()`'s local parameter; no second completion path.
    - Security: law 4 — the value is re-checked by `checkOffered` and the preview session's state schema.
  - Test Cases to Write:
    - `set_state_applies_a_from_local_event_with_value_as_the_local_read`.

- [x] Task 8b: Give the demo host the renderer conformance fixtures Task 8 added
  - Notes (executed 2026-11-19, from Task 9 F10):
    - `bun run demo:test` failed the five new `rendererBrowserSuite` cases with "Missing local fixture" (71 pass, 5 fail). Task 8 had updated the starter and the proof host but not `examples/demo-host`.
    - `examples/demo-host/conformance-host.ts` adds a `local` block to the manifest (`open`, `title`) and `initialLocal`. `examples/demo-host/primitives/index.tsx` places `domId` on the text field's input. `examples/demo-host/tests/conformance-fixtures.ts` adds `local`, `compound`, `fromLocal` and `focus`, written like the starter's. The demo field emits `onChange` on blur, so clicking Save writes the title before the press.
    - `bun run demo:test`: 76 pass, 0 fail, including the demo's typecheck against the packed archive.
  - Acceptance Criteria:
    - Functional: the demo host passes every `rendererBrowserSuite` case.
    - Performance: n/a — fixtures only.
    - Code Quality: the same fixture shapes as the starter's; no new helper.
    - Security: the law 4 case `set_local_redraws_and_never_reaches_the_host` now runs against the demo's renderer.
  - Test Cases to Write:
    - none new; the five suite cases run.

- [x] Task 9: Analyze architectural impact and dispose of every finding
  - Notes (executed 2026-11-19):
    - `plans/evidence/037-impact-analysis.md` records all twelve areas, the per-addition law table, the emit- and arrival-path bench rows before and after, the register-to-changelog check, and the unchanged 0.3.x corpus (no existing file under `conformance/` modified; 61 added).
    - The owner accepted every recommended disposition on 2026-11-19. Executed: F1 (decision log; Task 1 closed), F2 (Task 8a), F3 (`.agents/skills/liveframe-execution/references/formats.md` and `renderer.md` describe the new intent, carry, focus and `shown` forms), F4 (this plan's Verification line now uses `bun test --conditions liveframe:source ./<files>`), and F10 (Task 8b). Backlogged: F5 (a "Measured" line on "Phase 1 performance gate: 3 µs per node"), F7 (P3), F8 (P4) and F9 (P4). F6: the owner chose not to commit.
    - Verification results are in the impact analysis §3.
  - Acceptance Criteria:
    - Functional: `plans/evidence/037-impact-analysis.md` records each of the twelve impact areas, or `None — <reason>`. Findings go to the owner in one table with a recommended disposition; `execute` findings become tasks above this one, `backlog` findings go to `plans/backlog.md` and Further Actions.
    - Performance: the sweep lists the emit-path and arrival-path bench rows before and after.
    - Code Quality: the sweep checks that every register entry has a migration or changelog line and that the 0.3.x corpus expectations are unchanged.
    - Security: the sweep states, per addition, the law it touches and the rejection test that holds it.
  - Approach:
    - Skills to Use:
      - `create-plan` — "Final task: impact analysis".
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `references/liveframe.md` §5; Task 1's design and decision.
    - Options Considered:
      - none beyond the standard sweep.
    - Chosen Approach:
      - One sweep after Task 8, including the MCP tools (`src/cli/mcp.ts`) and the demo host as agent-authoring and example surfaces.
    - API Notes and Examples:
      ```bash
      bun run check && bun run bench && bun run demo:test && bun run guide:test
      ```
    - Files to Create/Edit:
      - `plans/evidence/037-impact-analysis.md`; `plans/backlog.md`; `roadmap.md` §3; this plan's Compromises Made and Further Actions.
  - Test Cases to Write:
    - none new.

## Verification (whole plan)

- `bun run check`
- `bun run bench`
- `bun test --conditions liveframe:source ./src/__tests__/corpus.test.ts ./src/__tests__/offered.test.ts ./src/__tests__/local-bindings.test.tsx ./src/__tests__/host-intent.test.ts ./src/__tests__/conformance-store.test.ts ./src/__tests__/conformance-renderer.test.tsx` (the `bun --conditions … test <files>` form runs the package `test` script, the whole suite)
- `LIVEFRAME_BROWSER=webkit bun run test` and `LIVEFRAME_BROWSER=firefox bun run test`
- `bun run demo:test` and `bun run guide:test`
- `bun run release:gate`

## Compromises Made

- Task 1's approval was recorded after Tasks 2–8 were built, not before. The design was followed throughout, and the owner approved it as implemented (`decision-logs/2026-11-19-0154-interaction-additions-for-0-4-0.md`).
- Task 7: a `shown` reader is never counted, rather than a mutual count being `invalid-prop` (design E.2).
- Task 8: the failed-binding case is in `rendererSuite` only, and the other five cases are in `rendererBrowserSuite` only.
- Task 4's `bench/validator.bench.ts` 2% criterion and the whole-plan `bun run bench` were not proved on a quiet host. Three wall-clock rows fail narrowly at load 4–9 (impact analysis F5). No per-plan A/B base exists, because plans 033–037 are uncommitted together (F6).
- Nothing is committed. The owner chose to leave plans 033–037 uncommitted.

## Further Actions

- Reserve `when`, `bind` and `focus` as prop names in catalogs and element JSON `props` — P3 (`plans/backlog.md`, F7).
- Narrow generated `bind` types to the argument a carry fits — P4 (F8).
- Show the 0.4.0 interaction additions in the demo host — P4 (F9).
- Run the whole `bun run bench` on a host under load 3 — P1, on the existing entry "Phase 1 performance gate: 3 µs per node" (F5).
