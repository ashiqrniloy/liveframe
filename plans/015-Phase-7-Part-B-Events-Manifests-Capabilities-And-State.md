# Phase 7 Part B: Events, Manifests, Capabilities and State Scope

Depends on: [plan 014](014-Phase-7-Part-A-Release-Scope-Packaging-And-Schema-Language.md) complete. Its Task 1 decision log sets the 0.2.0 scope and lists its breaking changes, and its Tasks 4–6 add the schema forms this plan's object events reuse.

## Objectives

- Add the format additions adopters must have before they store records:
  - more `semantics` values (LF-09);
  - `minHeight`/`maxHeight` (CL-07);
  - manifest `description` and host `meta`, plus capability `meta` (LF-07);
  - numeric event values (CL-08);
  - object-carrying events for multi-value commits (LF-05, option A).
- Add `capabilitiesFor(capabilities, manifest)` (LF-14), so hosts send the browser only what a widget uses.
- Key widget state by `(placementId, scope)` (LF-06) across `Store`, `memoryStore`, `fileStore`, `loadPlacement` and `storeSuite`. Add `verifyPlacementInputs` for hosts that never store state. A 0.1.0 `fileStore` directory keeps loading.

## Expected Outcome

- A catalog may declare:
  - `semantics` values `form`, `group`, `figure`, `status` and `alert`;
  - `minHeight`/`maxHeight` on a kind;
  - events carrying `number`, `integer` or `{ object: ObjectSchema }`.
- `action(name, args, { bindAll: true })` merges an emitted object into the action's arguments. The validator rejects a mismatched object/argument pair at render time.
- Manifests carry `description` and `meta`. Capability actions and sources carry `meta`. The package hash covers the manifest's `description` and `meta` (capabilities are not packaged), and the MCP tools show `description` but never `meta` unless the host opts in.
- `capabilitiesFor` prunes deterministically, and `compileValidator` gives identical results with the pruned document.
- `Store.putState/getState` take a scope. `loadPlacement` accepts `{ scope?, state? }`. A 0.1.0 `fileStore` fixture directory loads under 0.2.0.

This plan implements spec §5 (definitions and events), §6.3 (style props), §7.3 (manifest), §7.4 (storage), §8 (interaction) and §10 (validation). Every format change is additive except the `Store` interface, a 0.2.0 breaking change listed in plan 014 Task 1's decision log. It touches the renderer only where an event value is checked (`emit`); renderer contracts proper are [plan 017](017-Phase-7-Part-D-Renderer-And-Preview-Host-Integration.md). `checkOffered` (LF-01, plan 017) must understand `bindAll` and the numeric and object carries that land here.

## Tasks

- [x] Task 1: Record the event, manifest and state-scope format decisions
  - Acceptance Criteria:
    - Functional: an accepted decision log settles each open detail.
      - **LF-05 A:**
        - `carries: { object: ObjectSchema }` must be closed and bounded, and may not be nullable at the top level.
        - The `bindAll` rule: the event's schema must equal the action's argument schema minus the literal args, property by property, in required-ness and type. Settle whether "fits" means equal or narrower-or-equal.
        - `setState` with an object event writes only to an object-typed state key whose schema the event schema fits.
        - `bind` and `bindAll` are mutually exclusive.
      - **CL-08:** `number` binds only to `number`. `integer` binds to `integer` or `number`. Argument `minimum`/`maximum` apply to the filled value. Record that the request decides this together with LF-05.
      - **LF-07:**
        - `description` ≤ 500 code points;
        - `meta` is a JSON value with a bounded depth (proposal 8) and bounded UTF-8 bytes (proposal 4 KiB), counted while walking;
        - capability `meta` uses the same bounds;
        - the MCP opt-in is a config flag.
      - **LF-06:**
        - the `scope` string bounds (proposal: the storable-id rules of plan 012, ≤ 128 code points; `""` is the shared scope);
        - the `fileStore` layout: `""` stays at `states/<id>.json`, and other scopes go to `states/<id>/<scope>.json`;
        - the store-suite isolation case, including the owner's fail-closed answer from plan 014 Task 1.
      - **LF-09:** the five new values and the element or role each maps to in a reference implementation (`form` → `<form>` with an accessible name, `group` → `role=group`, `figure` → `<figure>`, `status` → `role=status`, `alert` → `role=alert`). Tables stay a host primitive.
    - Performance: n/a — a decision only.
    - Code Quality: one log, and each decision gives its rejected alternative.
    - Security:
      - Law 4 — `meta` is untrusted on load and grants nothing.
      - Law 2 — object events are validated twice: at emit, and in the host's re-check.
  - Approach:
    - Skills to Use:
      - `create-decision-log`.
    - Library Documentation to Check Before Implementation:
      - WAI-ARIA 1.2 roles `status`, `alert`, `group` and `form` (the `form` role needs an accessible name to be a landmark); HTML `<figure>`/`<figcaption>`.
    - Documentation Reviewed:
      - Spec §5, §8 and §11 (the `emit` paragraph).
      - `src/formats/catalog.ts:22` (`carries` enum) and `:101-113` (`checkEvents`).
      - `src/validate/intent.ts:11-85` (`compileIntents`, `bindExpected` at `:49-56`).
      - `src/sdk/intents.ts:83-95` (`action`).
      - `src/react/renderer.tsx:62-78` (`complete`) and `:187-195` (`emit`).
      - `src/store/index.ts:13-24`, `src/store/load.ts:57-67` and `src/store/fs/index.ts:100-103,120-121`.
    - Options Considered:
      - LF-05 option B (named bindings) — rejected by the owner on 2026-10-27: it needs a new emitter contract.
      - A `scope` stored inside the placement record — rejected: a placement is shared by definition.
    - Chosen Approach:
      - One log, so plan 017's `checkOffered` has a single rule to implement.
    - API Notes and Examples:
      ```ts
      events: { onSubmit: { carries: { object: obj({ reason: str({ minLength: 1, maxLength: 500 }), confirm: bool() }) }, description: "…" } }
      <Form onSubmit={action("escalate", { id }, { bindAll: true })} />
      ```
    - Files to Create/Edit:
      - `decision-logs/<date>-events-manifests-and-state-scope.md` (new)
  - Test Cases to Write:
    - None. The decision log is the record.
  - Notes (executed 2026-10-28):
    - Accepted [the decision log](../decision-logs/2026-10-28-0024-events-manifests-and-state-scope.md). The owner chose **structural fit** for `bindAll` and object `setState` (names, required-ness and types compared at build time; bounds checked on the filled value) and approved the rest as listed: object carries are closed, at most 32 scalar properties, never top-level nullable; `bindAll: true` on the wire; literal/event key overlap is a build-time error; `meta` at most 8 levels and 4096 bytes; scope at most 128 code points with `fileStore` layout `states/<id>.json` for `""` and `states/<enc(id)>/<enc(scope)>.json` otherwise; five semantics values with the element/role mapping, and no validator rule requiring `label`.
    - Amended this plan: capability `meta` is outside the package hash because capabilities are not packaged. Only the manifest `description` and `meta` change the hash. Task 4's `meta_changes_hash` test covers the manifest.
    - Handoffs: plan 017's `checkOffered` implements the same fit rule and must understand `bindAll`, numeric and object carries. Task 6 adds `bindAll` to the action intent's closed field set in `src/validate/intent.ts` (`actionFields`).
    - No runtime, spec or format change in this task, so `bun run check` was not re-run; verification is that the log and plan links resolve.

- [ ] Task 2: Add form, group, figure and live-region semantics (LF-09)
  - Acceptance Criteria:
    - Functional:
      - `semantics` gains `form`, `group`, `figure`, `status` and `alert`. The format, the published schema, generated types and `liveframe gen` output all list them.
      - The proof catalog's layout primitives accept them, and the proof implementations render each one as decided in Task 1.
      - A browser test shows that a `status` node whose text changes keeps its element (it is not remounted), and that the accessibility snapshot shows the new text once.
      - The conformance renderer suite gains semantics fixtures.
      - `docs/renderer.md` documents that live regions must stay mounted, and that id-keyed reconciliation keeps them mounted.
    - Performance: n/a — an enum extension.
    - Code Quality: the values live only in `src/formats/fixed.ts:4-16`; every other list derives from it.
    - Security: n/a — accessibility semantics grant nothing. Law 3 is untouched.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`: the renderer behaviour chore, with a test per tier where relevant.
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64 `locator.ariaSnapshot()` output for `status`/`alert`; React Aria (if the proof's box uses it) for live regions.
    - Documentation Reviewed:
      - Spec §5 "Additions the proof found necessary".
      - `src/formats/fixed.ts:4-16`; `src/index.ts:12`.
      - `src/__tests__/fixtures/proof/catalog.json`.
      - The proof implementations under `proof/renderer/` (tentative: confirm with `graft ask "box semantics implementation"`).
    - Options Considered:
      - Making the semantics list catalog-extensible — rejected: it is library-fixed so that agents and conformance can rely on it, per spec §5.
    - Chosen Approach:
      - Extend the fixed list.
    - API Notes and Examples:
      ```tsx
      <Stack semantics="status" label="Save status"><Text>{saved ? "Saved" : "Saving…"}</Text></Stack>
      ```
    - Files to Create/Edit:
      - `src/formats/fixed.ts`; `schemas/*.json` (regenerated)
      - `src/__tests__/fixtures/proof/catalog.json`; `src/__tests__/fixtures/widgets/ui.gen.ts`
      - The proof box/stack implementations
      - `src/conformance/react/*` fixtures (tentative)
      - `docs/spec.md` §5; `docs/renderer.md`; `docs/formats.md`
  - Test Cases to Write:
    - `semantics_lists_live_regions` (`vocabulary.test.ts` or `catalog.test.ts`).
    - `status_region_survives_text_change` (`react-browser.test.tsx`): asserts element identity and an aria snapshot containing `status`. Fails if the node remounts.
    - `conformance_semantics_fixtures_render` (`conformance-renderer.test.tsx`).

- [ ] Task 3: Add `minHeight` and `maxHeight` style props (CL-07)
  - Acceptance Criteria:
    - Functional:
      - `minHeight` and `maxHeight` take the same domain as `minWidth`/`maxWidth`, including responsive values.
      - They project to `min-block-size`/`max-block-size`, or to `min-height`/`max-height`, matching what `height` uses. The notes record which.
      - Undeclared names and out-of-domain values are rejected by the validator and fail to compile in the SDK.
      - `liveframe gen --check` output updates.
      - A browser test shows `maxHeight` on a `scroll` primitive scrolling inside a fixed-height container.
      - `docs/styling.md` notes that a percentage height needs a definite parent height.
    - Performance: n/a — one more entry in each style table. The CSS bench holds.
    - Code Quality: add entries next to `minWidth`/`maxWidth` in `src/formats/fixed.ts:40-41`, `src/validate/style.ts:105-106`, `src/css/style-props.ts:63-64` and `src/sdk/gen.ts:76-77`.
    - Security: law 3 — the values stay token-constrained.
  - Approach:
    - Skills to Use:
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - MDN `min-block-size`/`max-block-size` and percentage resolution against the containing block.
    - Documentation Reviewed:
      - Spec §6.3 table.
      - The files above; `src/__tests__/css-style-props.test.ts`.
    - Options Considered:
      - A `maxRows` prop — rejected: product-shaped.
    - Chosen Approach:
      - Mirror the width pair.
    - API Notes and Examples:
      ```tsx
      <Scroll maxHeight="size.list" />
      ```
    - Files to Create/Edit:
      - The four files above; `schemas/*.json`
      - `src/__tests__/fixtures/proof/catalog.json` (`scroll` declares both); `ui.gen.ts`
      - `docs/spec.md` §6.3; `docs/styling.md`
  - Test Cases to Write:
    - `min_max_height_validate_and_project` (`css-style-props.test.ts`, `validator-rules.test.ts`): covers responsive values and undeclared names.
    - `max_height_rejects_undeclared` (type-level, `sdk-types.test.tsx`).
    - `scroll_max_height_scrolls` (`css-browser.test.ts`).

- [ ] Task 4: Add manifest `description` and `meta`, and capability `meta` (LF-07)
  - Acceptance Criteria:
    - Functional:
      - The manifest takes an optional `description` (≤ 500 code points) and an optional `meta` (bounded JSON, per Task 1).
      - Capability actions and sources each take an optional `meta`.
      - Over-bound values are rejected with `limit-exceeded` or `invalid-document` at the pointer.
      - `pack()` and `verifyPackage()` carry both fields. Changing `meta` changes the package hash.
      - The MCP `list_capabilities` output omits capability `meta` unless `AuthoringConfig.exposeMeta` is true. `pack_draft`'s result includes the manifest `description`.
      - `docs/formats.md` and `docs/security.md` say that `meta` grants nothing and is untrusted on load.
    - Performance: the meta walk is bounded and linear.
    - Code Quality: one `boundedJson(depth, bytes)` check shared by the manifest and capabilities, reusing the byte counting in `src/validate/bytes.ts`.
    - Security:
      - Law 4 — `meta` is never interpreted by the library.
      - Law 2 — it is validated on install and on load (`verifyPackage`).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (format chore checklist).
    - Library Documentation to Check Before Implementation:
      - none. Local: `src/pack/hash.ts` (the canonical form covers every manifest field).
    - Documentation Reviewed:
      - `src/formats/manifest.ts:16` (`Json`), `:181-239`.
      - `src/formats/capabilities.ts:17` (`actionFields`), `:110-133`.
      - `src/cli/mcp.ts:91-141` (`registerCatalogTools`).
      - `src/preview/authoring.ts` (`AuthoringConfig`).
    - Options Considered:
      - Open `additionalProperties` on the manifest — rejected: the formats are closed by design.
    - Chosen Approach:
      - Named optional fields.
    - API Notes and Examples:
      ```json
      { "id": "core.queue", "description": "Pending decisions for the viewer.", "meta": { "sizes": ["m", "l"], "provenance": { "scope": "org" } } }
      ```
    - Files to Create/Edit:
      - `src/formats/manifest.ts`; `src/formats/capabilities.ts`; `src/formats/json.ts` (bounded JSON, tentative)
      - `scripts/schemas.ts`; `schemas/*.json`
      - `src/cli/mcp.ts`; `src/preview/authoring.ts`
      - `docs/spec.md` §7.3 and §13 (`list_capabilities`); `docs/formats.md`; `docs/mcp.md`; `docs/security.md`
  - Test Cases to Write:
    - `manifest_description_bounded`, `meta_depth_and_bytes_bounded` (`manifest.test.ts`).
    - `capability_meta_bounded`.
    - `meta_changes_hash` (`pack-hash.test.ts`).
    - `list_capabilities_hides_meta_by_default` (`cli-mcp.test.ts`).
    - `published_manifest_schema_accepts_meta` (`schemas.test.ts`).

- [ ] Task 5: Carry numbers on events (CL-08)
  - Acceptance Criteria:
    - Functional:
      - `carries` accepts `"number"` and `"integer"`.
      - `emit` throws, raising no intent, on a non-number, `NaN`, `±Infinity`, or (for `integer`) a non-integer.
      - The build-time `bind`/`setState` checks follow Task 1's rule. `number` into a `string` argument is `invalid-prop` with a pointer.
      - The preview session's `intent()` rejects an out-of-range filled value against the argument's `minimum`/`maximum`.
      - `implement()`'s `Emit` type requires a `number` value for these events.
      - Changing `carries` stays a major catalog change.
      - The conformance renderer suite gains a numeric fixture.
    - Performance: n/a — one more case on the emit path. The render bench holds.
    - Code Quality: one `carriesValue(carries, value)` predicate, shared by `/react` and the preview session.
    - Security: law 2 — non-finite numbers never reach `onIntent` or the JSON transport.
  - Approach:
    - Skills to Use:
      - `typescript-advanced-types`: extend `Emit` (`src/react/implement.ts:8-18`).
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `src/formats/catalog.ts:22`; `src/validate/intent.ts:38-76`.
      - `src/react/renderer.tsx:62-78,187-195`.
      - `src/preview/session.ts:50-92`.
      - `src/sdk/intents.ts`.
    - Options Considered:
      - `number` only, with `integer` as a schema refinement — rejected: Task 1 records CL-08's split.
    - Chosen Approach:
      - Both values, with one shared predicate.
    - API Notes and Examples:
      ```ts
      events: { onChange: { carries: "integer", description: "Page size." } }
      ```
    - Files to Create/Edit:
      - `src/formats/catalog.ts`; `src/validate/intent.ts`; `src/validate/checks.ts` (shared predicate, tentative)
      - `src/react/renderer.tsx`; `src/react/implement.ts`; `src/preview/session.ts`
      - `schemas/*.json`; `src/conformance/react/*`
      - `docs/spec.md` §5, §8, §11; `docs/renderer.md`; `docs/formats.md`
  - Test Cases to Write:
    - `emit_rejects_nan_infinity_and_fraction_for_integer` (`react-intents.test.tsx`).
    - `bind_number_into_string_fails` (`validator-rules.test.ts`).
    - `preview_intent_rejects_out_of_range_number` (`preview-session.test.ts`).
    - `emit_type_requires_number` (`react-types.test.tsx`).
    - `conformance_numeric_fixture` (`conformance-renderer.test.tsx`).

- [ ] Task 6: Commit several values in one intent with object-carrying events (LF-05, option A)
  - Acceptance Criteria:
    - Functional:
      - `carries: { object: ObjectSchema }` is accepted when the schema is closed and bounded, and rejected otherwise.
      - `action(name, args, { bindAll: true })` merges the emitted object into `args` in `complete()`. Literal args win on conflict only if Task 1 says so; otherwise a conflicting key is a build-time error.
      - At build time the validator checks:
        - that the event schema fits the argument schema minus the literal args, failing with `invalid-prop` and a pointer;
        - that `bind` and `bindAll` are not combined;
        - that a `setState` with an object event names an object-typed key that fits.
      - `emit` throws on a value that fails the declared object schema.
      - A renderer browser test shows one submit carrying every field's current local value, with no prior `setState`.
      - The preview session's `intent()` re-checks the filled args.
      - The conformance renderer suite gains a "form submits its fields" fixture.
      - SDK and implementation types give `emit("onSubmit", value)` the inferred object type.
    - Performance:
      - The emit-time check uses a schema compiled once per definition event (cached in the renderer factory), not per call.
      - The render bench holds.
    - Code Quality: reuse `compileSchema` and the schema comparison in `src/formats/catalog.ts:196-257`. No second schema interpreter.
    - Security: law 2 — the object is validated at emit and again by the host. Law 4 — the host still re-checks before dispatch (`docs/renderer.md`).
  - Approach:
    - Skills to Use:
      - `typescript-advanced-types`: infer the object type from `carries.object` through `Infer`.
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - React Aria `Form` (proof form implementation, if used) for collecting field values on submit.
    - Documentation Reviewed:
      - Task 1's decision log.
      - The files in Task 5.
      - `src/sdk/intents.ts:83-95`.
    - Options Considered:
      - See Task 1. Option B was rejected by the owner.
    - Chosen Approach:
      - Option A, as decided.
    - API Notes and Examples:
      ```ts
      action("escalate", { id: row.id }, { bindAll: true }) // intent.args = { id, reason, confirm } after emit
      ```
    - Files to Create/Edit:
      - `src/formats/catalog.ts`; `src/validate/intent.ts`; `src/sdk/intents.ts`; `src/sdk/types.ts`
      - `src/react/renderer.tsx`; `src/react/implement.ts`; `src/preview/session.ts`
      - The proof form primitive implementation and catalog entry (tentative; the proof catalog may need a generic `form` container kind; confirm it is a primitive, not product-shaped)
      - `src/conformance/react/*`; `schemas/*.json`
      - `docs/spec.md` §5, §8, §11; `docs/sdk.md`; `docs/renderer.md`
  - Test Cases to Write:
    - `object_carries_must_be_closed_and_bounded`.
    - `bind_all_schema_mismatch_fails_with_pointer`.
    - `bind_and_bind_all_exclusive`.
    - `emit_rejects_invalid_object`.
    - `form_submit_carries_all_fields` (`react-browser.test.tsx`): fails if any field value is stale.
    - `preview_rechecks_bind_all_args`.
    - `conformance_form_fixture`.
    - `emit_object_type_inferred` (type-level).

- [ ] Task 7: Prune capabilities to what a manifest uses (LF-14)
  - Acceptance Criteria:
    - Functional:
      - `capabilitiesFor(capabilities, manifest)` returns a capabilities document holding exactly the actions and sources the manifest names.
      - It is pure and deterministic, with keys sorted as in the input.
      - An unknown name is a typed error, never a silent drop.
      - `compileValidator` gives identical results with the pruned document on every proof manifest and its scenario trees.
      - `docs/renderer.md` recommends pruning before transfer.
    - Performance: O(names).
    - Code Quality: root export, beside `validateCapabilities`.
    - Security: law 4 — pruning removes descriptions of operations the widget cannot raise. Law 2 — the validator is unchanged.
  - Approach:
    - Skills to Use:
      - `lean-build`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `src/formats/capabilities.ts:110-133`; `src/formats/manifest.ts:106-114,152-178`.
    - Options Considered:
      - Pruning inside `compileValidator` — rejected: the point is to prune before the document is sent.
    - Chosen Approach:
      - A standalone pure function.
    - API Notes and Examples:
      ```ts
      const shipped = capabilitiesFor(capabilities, manifest); // Result<Capabilities>
      ```
    - Files to Create/Edit:
      - `src/formats/capabilities.ts`; `src/index.ts`; `src/__tests__/exports.test.ts`
      - `docs/renderer.md`; `docs/formats.md`; `docs/spec.md` §10 (one sentence)
  - Test Cases to Write:
    - `capabilities_for_equivalence_on_proof_manifests`.
    - `capabilities_for_rejects_unknown_name`.
    - `capabilities_for_is_deterministic`.

- [ ] Task 8: Key widget state by placement and scope (LF-06)
  - Acceptance Criteria:
    - Functional:
      - `Store.putState(placementId, scope, state)` and `getState(placementId, scope)` replace the two-argument forms. `deletePlacement` removes every scope.
      - `memoryStore` and `fileStore` implement them. `fileStore` reads a 0.1.0 directory's `states/<id>.json` as scope `""`, and writes other scopes per Task 1's layout.
      - `loadPlacement(store, id, options, { scope?, state? })`: with `state` given, the store is not read, and the same check-and-reset rules apply and are reported in `reset`.
      - `verifyPlacementInputs(pkg, { params, state })` returns `Result<{ params, state, reset? }>`.
      - `storeSuite` covers scoped isolation, deletion across scopes, and the scope bound. Both stores pass it.
      - A 0.1.0 `fileStore` fixture directory, committed and generated by a script from the 0.1.0 code path, loads under 0.2.0.
      - `docs/compatibility.md` § 0.2.0 records the interface change and its migration.
    - Performance: n/a — store I/O. `loadPlacement` does no extra reads.
    - Code Quality: `loadPlacement` delegates its param and state checks to `verifyPlacementInputs` (one implementation). Callers are updated in the same task; `graft callers putState --depth all` and `graft callers getState --depth all` list them.
    - Security:
      - Law 4 — scope is a host string and grants nothing.
      - Law 2 — explicit state is verified exactly like stored state.
      - The storable-id bound stops path traversal in `fileStore`.
  - Approach:
    - Skills to Use:
      - `migration`: compatibility-safe reads of the 0.1.0 layout.
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none. Local: `src/store/fs/index.ts:19-38` (key-to-file encoding).
    - Documentation Reviewed:
      - Spec §7.4.
      - `src/store/index.ts:13-24`; `src/store/load.ts:10-83`; `src/store/memory.ts`; `src/store/fs/index.ts:71-125`.
      - `src/conformance/store.ts`; the demo host's state calls under `examples/demo-host/`.
    - Options Considered:
      - An optional trailing `scope` parameter — rejected in plan 014 Task 1 (it fails open).
      - A migration that rewrites old files — rejected: `docs/compatibility.md` promises to read an existing directory.
    - Chosen Approach:
      - The interface change, with legacy reads for scope `""`.
    - API Notes and Examples:
      ```ts
      await store.putState("home", "viewer:42", { filter: "open" });
      await loadPlacement(store, "home", { catalog, capabilities }, { scope: "viewer:42" });
      await loadPlacement(store, "home", { catalog, capabilities }, { state: fromUrl });
      ```
    - Files to Create/Edit:
      - `src/store/index.ts`; `src/store/load.ts`; `src/store/memory.ts`; `src/store/fs/index.ts`
      - `src/conformance/store.ts`
      - `src/__tests__/fixtures/store-0.1.0/` (new) and `scripts/fixtures/store-0.1.0.ts` (new, regenerates it)
      - `examples/demo-host/*` (callers); `proof/host/*` (callers, if any)
      - `docs/spec.md` §7.4; `docs/packages.md`; `docs/compatibility.md`; `docs/conformance.md`; `CHANGELOG.md`
  - Test Cases to Write:
    - `scoped_state_is_isolated`, `delete_placement_removes_all_scopes`, `scope_bound_enforced` (store suite, run by `conformance-store.test.ts` for both stores).
    - `file_store_reads_0_1_0_directory` (`store-file.test.ts`).
    - `load_placement_explicit_state_resets_like_stored` (`store-load.test.ts`).
    - `verify_placement_inputs_matches_load_placement`.

- [ ] Task 9: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/015-impact-analysis.md` records all 12 areas.
      - Findings are presented to the owner in one table and disposed of (`execute` or `backlog`).
      - Plan 017's `checkOffered` inputs (`bindAll`, numeric and object carries) are listed as a handoff.
    - Performance: record the bench numbers.
    - Code Quality: n/a.
    - Security: confirm that `meta` is never read by library code: `graft grep "meta"`.
  - Approach:
    - Skills to Use:
      - `create-plan`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Reference §5.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - The standard sweep.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/015-impact-analysis.md` (new); `plans/backlog.md`; this plan.
  - Test Cases to Write:
    - None.

## Verification (whole plan)
- `bun run check`
- `bun run bench`
- `bun run release:gate`
- `bun run demo:test`

## Compromises Made
- To be filled after tasks are completed and tests pass.

## Further Actions
- To be filled after task completion with improvements, rationale, and priority.
