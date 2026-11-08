# Phase 7 Part P: Release 0.3.0 — Action Results, Local Bindings, the Surface Core and Observability

Depends on: plan [026](026-Phase-7-Part-M-Release-0-3-0-Scope-Spec-And-Breaking-Changes.md) (register, spec, focus default), plan [027](027-Phase-7-Part-N-Release-0-3-0-Formats-References-Extensions-Axes-And-Urls.md) (node references and axis classes the surface core must carry) and plan [028](028-Phase-7-Part-O-Release-0-3-0-Template-Widgets-And-Streaming.md) Task 2 (the expression language, reused here for browser-side bindings). Followed by plan [030](030-Phase-7-Part-Q-Release-0-3-0-Host-Pipeline-Evolution-And-Dependencies.md), whose host pipeline writes the action results defined here.

## Objectives

- Give tier 3 a feedback contract: a widget receives the status of its recent actions (`pending`, `ok`, `failed`, `refused`, with an optional reason and a typed result value) as a declared input, so "Saving…" and "Failed: name taken" stop being host improvisation (W3a).
- Remove the tier-1/tier-2 cliff for interactions that span nodes but need no data: manifest-declared **local state**, a `setLocal` intent the renderer applies without a round trip, and node-level `when` and `bind` expressions evaluated in the browser from the template expression subset (W3b). This is data, not code, so law 1 holds.
- Extract a framework-independent, host-API-free **surface core** (`@arnilo/liveframe/surface`) holding arrival validation, revision rules, node contexts, intent completion, confirmation, local state and node reuse; rebuild `/react` on it (W7a).
- Add observability hooks so hosts see rejected arrivals, rejected emits, failed implementations and failed bindings (L2, renderer side).
- State the localisation contract: where locale comes from and what determinism means when a widget formats text (L1).

## Expected Outcome

- `decision-logs/<date>-action-results-and-local-bindings.md` is approved, with `plans/evidence/029-interaction-design.md`.
- `WidgetProps` gains `actions: Readonly<Record<string, ActionStatus>>`; `action(name, args, { resultKey? })` lets a row key its own result; capabilities actions may declare `result` schemas; scenarios, `renderKey`, preview, authoring and templates (root `actions`) carry it.
- Manifests may declare `local` (a closed scalar object schema) and `initialLocal`; the tree may carry `when` and `bind` on nodes and `setLocal` intents; `<Surface>` applies `setLocal` without calling `onIntent` and re-evaluates bindings; a 30-row live filter has zero round trips.
- `@arnilo/liveframe/surface` ships; `/react` is a thin adapter over it; a test-only DOM renderer built on the core renders every proof scenario, proving the core has no React dependency.
- `<Surface onEvent>` and the core report typed observability events.
- `docs/localisation.md` exists and spec §7.1 states the determinism rule for locale-dependent formatting.

This plan implements roadmap Phase 7's 0.3.0 interaction and renderer work: spec §7.1–§7.2, §8 (tiers), §9 (tree), §10, §11 and §13. Two wire changes ride on existing format ids as optional, fail-closed fields: `liveframe/1` nodes gain `when`/`bind` and intents gain `setLocal` and `resultKey`; `liveframe/tree-patch/1` `set` ops carry them. Spec §14 keeps "renderers other than React" as a non-goal; the core makes one possible without the library shipping it. Nothing is published here.

## Tasks

- [x] Task 1: Design action results and local bindings, and record the decision
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/029-interaction-design.md` specifies as numbered rules:
        - **Action results.** `ActionStatus = { status: "pending" | "ok" | "failed" | "refused"; reason?: string (≤ 500 code points); value?: Json; at?: string (≤ 64) }`. `value` is allowed only for `ok` and must match the action's optional capability `result` schema. The input `actions` is a record of ≤ 64 entries keyed by a result key: the action name, or the intent's `resultKey` (≤ 128 code points, a literal in the tree). The manifest declares nothing new; the validator derives the input schema from the manifest's actions. The host supplies `actions` like `context`; the library stores none of it. `refused` means the host's offered-intent check or authorisation rejected the intent.
        - **Local state.** A manifest may declare `local: ObjectSchema` (≤ 32 properties, scalar or nullable scalar, strings bounded) and `initialLocal`. A `setLocal` intent `{ type: "setLocal", key, value? }` follows `setState`'s fill rules but is applied by the renderer and never reaches `onIntent`. Local state belongs to one mounted surface, resets when `surfaceId` changes or the validator changes, and is never sent to the backend; a widget commits a value with an ordinary `setState` event.
        - **Bindings.** A node may carry `when: Expr` (render the node only when truthy) and `bind: Record<prop, Expr>` (override a prop with the evaluated value). Expressions use the template subset whose roots are `local` and `self` (the node's own validated props); no data, state, iteration or component use. The validator checks each expression statically against the local schema and the prop schema; the renderer re-validates each bound value with the compiled prop check before passing it to the implementation, and on failure renders the node fallback and reports a `binding-failed` event.
        - **Wire and patches.** `UiNode.when?`, `UiNode.bind?`, intent `setLocal`, intent `resultKey?`; patch `set` replaces them as part of the node payload; `diffTrees` compares them.
      - Write `decision-logs/<date>-action-results-and-local-bindings.md` with `create-decision-log`; owner approval before Task 2.
    - Performance: the design sets budgets: a `setLocal` that changes `when` on 50 rows re-renders in ≤ 4 ms (production React build, selection bench machine); a tree without `when`/`bind` pays nothing measurable (≤ 1% arrival).
    - Code Quality: the design reuses `checkExpression`/`evaluate` from `/template`.
    - Security: law 1 — no widget code reaches the browser, only bounded data expressions; law 2 — bound values are validated before an implementation reads them; law 4 — `setLocal` carries no authority and never reaches the host.
  - Approach:
    - Skills to Use: `create-decision-log`; `liveframe-execution` (renderer, sdk references).
    - Library Documentation to Check Before Implementation: A2UI client-side data model (prior art) via `find-docs`, version recorded.
    - Documentation Reviewed: spec §8 (tiers, rules), §9, §11 (`emit`, `onIntent`, confirmation); `docs/renderer.md:380-396` (host intent handling, "return a new tree only if needed"); `plans/liveframe-evaluation.md` §3.1 (the interactivity cliff).
    - Options Considered:
      - Action results through `state`. Rejected: state is the widget's and persisted; results are transient host facts, and every host would encode them differently.
      - Client-side JS for local behaviour. Rejected: law 1.
      - Optimistic `setState` in the browser. Rejected: the browser cannot compute the next tree without running widget code.
    - Chosen Approach: a host-supplied `actions` input; local state with declarative bindings.
    - API Notes and Examples:
      ```tsx
      <Button label={s.actions["claim:" + r.id]?.status === "pending" ? "Claiming…" : "Claim"}
              onPress={action("tasks.claim", { id: r.id }, { resultKey: "claim:" + r.id })} />
      <TextField label="Filter" onInput={local.set("q")} />
      <Row when={ex.contains(r.title, local("q"))} … />
      ```
    - Files to Create/Edit: `plans/evidence/029-interaction-design.md`; `decision-logs/<date>-action-results-and-local-bindings.md`
  - Test Cases to Write: n/a — design.
  - Notes (executed 2026-11-07): Design in `plans/evidence/029-interaction-design.md` (rules A1–A9 actions, L1–L7 local state, B1–B13 bindings, W1–W4 wire, P1–P4 budgets, a security review); owner approved it as written, including eight amendments; decision log `decision-logs/2026-11-07-1756-action-results-and-local-bindings.md`. A2UI v0.9.1 read through ctx7 (`/websites/a2ui`). Findings that change later tasks (the tasks below are amended accordingly):
    - `ActionStatus` gains `action?` (A3): a row-keyed result key names no action, so `value` could not be typed without it.
    - `resultKey` may be a template `Value` (A5, amends plan 028 T14); `type`, `key`, `name`, `bind`, `bindAll` stay static.
    - Every `local` property is required (L1). `checkOffered` rejects `setLocal` with `invalid-prop` at `/type` (L4), and reproduces `resultKey` (A5).
    - Bindings use an operator allow-list (B3, no iteration or collection builders); `checkExpression` gains an optional allow-list parameter and no second checker is written. A `refProps` target may not be gated, and child-count rules hold with every `when` present (max) and absent (min) (B5.6–B5.7).
    - Templates pass `when`/`bind` through verbatim and embed template values with `{ "$embed": Expr }` (B12).
    - P1 is a keystroke flipping up to 10 of 50 gated rows in ≤ 4 ms median; the all-50 flip is recorded, not gated. P3 names its fallback: tighten bounds to depth 8 and 32 nodes before relaxing the validator share.
    - The plan's `CompiledInputs` citation `compile.ts:36-41` is stale; the type is at `src/validate/compile.ts:78-83`.

- [x] Task 2: Action results end to end
  - Acceptance Criteria:
    - Functional:
      - `capabilities.json` actions gain optional `result: Schema`. `action()` gains `{ resultKey }`; the intent carries it; `checkOffered` and completion preserve it and `checkOffered` requires the completed intent to reproduce it (design A5). `ActionStatus` carries `action?` so a row-keyed `value` is typed (A3); `resultKey` may be a template `Value` (amends plan 028 T14).
      - `WidgetProps` gains `actions`; `render()`, `renderElements`, `renderTemplate` (root `actions`, replacing the placeholder from plan 028), `renderModule` and the runners check it against the derived schema (`invalid-prop` at `/actions/<key>`), defaulting to `{}` when absent so existing hosts keep working.
      - `Scenario` gains optional `actions`; `pack()` checks it; `renderKey` includes `actions` (a vector in `conformance/hash/` registers the change).
      - Preview sessions: `render({ actions? })`; `intent(action)` still only logs. Authoring/MCP `render_scenarios` accepts `actions` per call. The proof agent-home widget shows a pending and a failed claim in new scenarios.
      - Spec §8 tier 3 states the contract; `docs/renderer.md` shows the host sequence (pending → re-render → ok/failed → re-render).
    - Performance: input check cost on the agent-home render ≤ 1%.
    - Code Quality: one derived schema per manifest in the compiled validator's inputs (`CompiledInputs`, `src/validate/compile.ts:36-41`).
    - Security: law 4 — results grant nothing; `value` is schema-checked so a host bug cannot inject arbitrary shapes into widget code.
    - Compatibility: `widened` for `WidgetProps`, `Scenario`, `capabilities.json`, `Intent`, `action`, `renderKey`, preview/authoring inputs; register names the hash vector.
  - Approach:
    - Skills to Use: `liveframe-execution` (sdk, formats); `typescript-advanced-types` (typed `actions` from capabilities in generated types).
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `src/sdk/types.ts:15`; `src/sdk/render.ts:348-373`; `src/validate/compile.ts:28-41`; `src/validate/offered.ts:29`; `src/pack/hash.ts:225`; `src/formats/capabilities.ts`.
    - Options Considered: per-action-name results only. Rejected: a list of rows each with "Claim" needs per-row status.
    - Chosen Approach: name-keyed by default, `resultKey` when the widget needs finer grain.
    - API Notes and Examples:
      ```ts
      renderKey({ hash, catalogId, params, state, data, context, actions });
      ```
    - Files to Create/Edit: `src/formats/capabilities.ts`; `src/formats/package.ts` (scenario); `src/sdk/types.ts`; `src/sdk/intents.ts` (or where `action` lives); `src/sdk/render.ts`; `src/sdk/elements.ts`; `src/template/render.ts`; `src/validate/compile.ts`; `src/validate/complete.ts`; `src/pack/*`; `src/preview/session.ts`; `src/authoring/*`; `src/cli/` MCP schemas; `src/sdk/gen.ts`; schemas; `conformance/hash/*`; proof widgets and scenarios; `docs/spec.md` §7–§8; `docs/renderer.md`; `docs/sdk.md`; `register-0.3.0.json`
  - Test Cases to Write:
    - `actions_input_defaults_to_empty`; `actions_value_must_match_result_schema`; `result_key_survives_completion_and_checkOffered`; `renderKey_changes_with_actions`; `proof_pending_and_failed_claim_scenarios_render`; `typed_actions_in_generated_props` (type-level).
  - Notes (executed 2026-11-08): Implemented design A1–A9. `bun run check` passes (1513 tests); `gen:check` passes. What changed:
    - Formats: capability actions take `result` (`src/formats/capabilities.ts`); action intents take `resultKey` (`src/formats/tree.ts`, checked in `src/validate/intent.ts`; completion and `checkOffered` preserve it through the existing exact-difference check); `Scenario.actions` (`src/formats/package.ts`, checked by `pack()` via `src/pack/verify.ts`); `ActionStatus` lives in `formats/tree.ts` and is re-exported by `/sdk`. Schemas regenerated (`capabilities`, `ui-tree`, `tree-patch`, `template`, `widget-package`).
    - Input: `src/validate/actions.ts` compiles the `actions` check (64 entries, 128-char keys, closed entries, `action` defaulting to a name-keyed key, `value` only with `ok` and typed by the capability `result`) and the template-typing schema; `CompiledInputs.actions` and `InputSchemas.actions` hold them (at `compile.ts`, not the stale `:36-41`). `render()` defaults an absent `actions` to a frozen `{}`.
    - Types: `WidgetProps` gains a fifth generic `A` and a required `actions`; new `WidgetInputs` (actions optional) is what `render`, `renderModule`, `renderTemplate`, the runners and the worker protocol accept. Existing hosts that build `WidgetProps` literals must switch, so that is registered `changed` with a migration heading.
    - Templates: root `actions` is typed by the manifest's actions (one optional status per action name); `resultKey` is an expression in template intents. Action names contain dots, so a template reads a status with `$get`, not `$path`. `liveframe gen`'s known paths include `actions`.
    - Preview and authoring: `render({ actions })` on sessions, `actions` on `render_scenarios` (MCP schema text updated), per-scenario default.
    - `renderKey` hashes `actions` (absent as `{}`); new `conformance/hash/render-keys.json` plus a public-export test.
    - Proof: agent-home's task card draws `Claiming…` and `Could not claim: <reason>`; scenarios `claim-pending` and `claim-failed` added; the template port and the core-queue template carry `actions` through (parity tests hold).
    - Register: 17 entries ("029 T2") including `WidgetProps` and `renderKey` as `changed`; `docs/migration-0.3.md` gains "Render keys and widget props include actions" and "Action results"; spec §7.1, §8, §9; renderer, SDK, formats, packages, conformance guides and CHANGELOG updated.
    - Findings that affect later tasks: (1) `liveframe gen` generates no per-manifest widget props today, so "typed `actions` in generated props" is delivered as the `WidgetProps` fifth generic and `ActionStatus<V>`, not as generated code (Compromise). (2) `src/validate/intent.ts` `checkAction` sits at the complexity limit, so Task 3 must add `setLocal` as its own function. (3) A new intent kind reaches `checkOffered`, `complete`, `tree-patch` and the template intent schema; Task 3 should mirror how `resultKey` was threaded. (4) `renderElements` has no widget inputs, so it needed no change.

- [x] Task 3: Local state and bindings in the formats, SDK and validator
  - Acceptance Criteria:
    - Functional:
      - `manifest.json` gains `local` and `initialLocal` (initial must satisfy `local`; `pattern` forbidden as in other widget schemas; every property required, ≤ 32 properties, design L1). `checkOffered` rejects a `setLocal` intent with `invalid-prop` at `/type` (L4).
      - Expressions use the design's B3 operator allow-list and B4 bounds; `checkExpression` gains an optional allow-list parameter. A `refProps` target may not be gated by `when`, and child-count rules hold with every `when` node present (max) and absent (min) (B5.6–B5.7). Template `when`/`bind` pass through verbatim and may embed template values with `{ "$embed": Expr }`, which never reaches the tree (B12).
      - `ui-tree.json`/`UiNode` gain `when?` and `bind?`; `Intent` gains `setLocal`. The compiled validator checks: expressions well-formed and within bounds, roots only `local` and `self`, `local` paths exist in the manifest's `local` schema, each `bind` target is a declared prop whose schema accepts the inferred type, `setLocal` keys exist and values match. Violations are `invalid-prop` at `/…/when`, `/…/bind/<prop>` or the intent pointer.
      - `/sdk` exports `local(key)` (an expression), `local.set(key, value?)` (a `setLocal` intent), the `when` and `bind` element attributes, and `ex` builders for the allowed operators; `liveframe gen` types `when`/`bind` per prop.
      - Templates may emit `when`/`bind` on nodes (pass-through, statically checked with the same rules).
      - `diffTrees`/`applyPatch` carry `when`/`bind`; patch vectors added with register entries.
      - Corpus cases for each rejection.
    - Performance: validator bench non-regression for trees without bindings; a tree with 50 `when` expressions validates within the 1.5 µs/node validator share.
    - Code Quality: expression checks come from `/template`'s `checkExpression` with a restricted scope; no second checker.
    - Security: law 2 — expressions and their targets are validated before arrival; law 1 — expressions are data.
    - Compatibility: `widened` for `manifest.json`, `ui-tree.json`, `tree-patch.json`, `UiNode`, `Intent`, SDK exports; `added` for `local`, `ex`.
  - Approach:
    - Skills to Use: `liveframe-execution` (formats, sdk); `typescript-advanced-types`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: the Task 1 design; `src/validate/tree.ts:245-388`; `src/validate/patch.ts:39,174`; `src/formats/manifest.ts`.
    - Options Considered: put bound values inside `props` with a marker. Rejected: props would stop being plain JSON validated by the prop schema; a separate `bind` field keeps prop validation unchanged.
    - Chosen Approach: separate `when`/`bind` fields with restricted expressions.
    - API Notes and Examples:
      ```tsx
      <Text text="No matches" when={ex.eq(local("matches"), 0)} />
      <Disclosure bind={{ open: local("expanded") }} onToggle={local.set("expanded")} />
      ```
    - Files to Create/Edit: `src/formats/manifest.ts`; `src/formats/tree.ts`; `src/formats/tree-patch.ts`; `src/validate/tree.ts`; `src/validate/compile.ts`; `src/validate/patch.ts`; `src/sdk/*`; `src/template/*`; schemas; corpus; patch vectors; `docs/spec.md` §7–§9; `docs/sdk.md`; `docs/formats.md`; `register-0.3.0.json`
  - Test Cases to Write:
    - `when_with_data_root_rejected`; `bind_to_undeclared_prop_rejected`; `bind_type_mismatch_rejected`; `set_local_unknown_key_rejected`; `initial_local_must_match_schema`; `patch_set_replaces_when_and_bind`; `diff_detects_bind_change`.
  - Notes (executed 2026-11-08): Implemented design L1–L7 (validator side), B1–B5, B12–B13 and W1–W3. `bun run check` passes (1544 tests); `bun run bench` section for bindings added to `bench/validator.bench.ts`. What changed:
    - Formats: `manifest.json` gains `local` and `initialLocal` (`Manifest.local?`, `initialLocal?`; `NO_LOCAL` is the empty schema). `local` names follow the template name rule (`^[a-z][A-Za-z0-9]{0,31}$`, because `local.<key>` is a path); scalars only, `url` rejected, strings ≤ 256 characters or an `enum`, every property required, ≤ 32. `UiNode` gains `when?` and `bind?`; `tree-patch` `set` carries them; `template.json` nodes carry them and intents gain `setLocal`. Schemas regenerated.
    - Types (amends design W1/Compatibility): `Intent` stays `setState | action`, exactly what `onIntent` receives, so no host narrowing breaks. `setLocal` is a new `LocalIntent`, and `UiNode.events` holds `TreeIntent = Intent | LocalIntent`. Root and `/sdk` export both. Register: `Manifest` and `UiNode` widened, `LocalIntent`, `TreeIntent`, `Expr`, `ex`, `local`, `self` added.
    - Expressions: `checkExpression`, `compileExpression` and the new `Scope.restrict` take a `Restriction { operators, depth, nodes }` (the one parameter B3/B4 asked for; no second checker). `$embed` is a placeholder operator of unknown type valid only when the restriction lists it (template install). `src/validate/bindings.ts` owns `TREE_OPERATORS` (27 operators), `TREE_EXPRESSION` (16 levels, 64 nodes), `compileBindings` (scope built lazily per kind), `isGated`, `MAX_BINDINGS` and the 10,000-node tree total (a running count on `SchemaSink.expressions`, kept by the tree walk and `render()`).
    - Validator: node `when`/`bind` check inside the kind's node check (so `checkNode`, `render()` and the tree walk share it); `setLocal` in `compileIntents` (own function; `unknown-name` at `/key` for an undeclared key, `invalid-prop` for a value that does not fit); `checkOffered` rejects it with `invalid-prop` at `/type` whether offered or posted. `refProps` targets may not be gated (tree walk and `render()`; ancestors found by id prefix) and `CompiledStructure.counts` takes the per-kind gated counts so the minimum ignores `when` children (`newTally`/`tallyKind`). The "one setState or action intent" messages gain "setLocal" only when the manifest declares `local`, so existing error text is unchanged.
    - `render()` lifts `when` and `bind` out of element attributes like `variant` (`NOT_PROPS`), counts their bytes (`WHEN_MEMBER_BYTES`, `BIND_MEMBER_BYTES`; the byte-agreement test holds) and checks them with the same code. `diffTrees` compares them; `applyPatch` already carried them through `set`.
    - SDK: `/sdk` exports `local(key)`, `local.set(key, value?)`, `self(prop)`, `ex` (one builder per allowed operator), `Expr`, `LocalIntent`, `TreeIntent`. `liveframe gen` emits `when?: _Expr` and a per-prop `bind` type, accepts `_LocalIntent` on event props, and the template schema (`generateTemplateSchema`) lists `when`, `bind` and `setLocal`. The generated import header is now multi-line.
    - Templates: `when`/`bind` pass through verbatim (`Compiler.embedded`), `{ "$embed": Expr }` becomes `{ "$lit": value }` during expansion, install checks every `$embed` operand as a template expression and the rest as a tree expression with `$embed` of unknown type. `setLocal` is written like `setState` (`Walk.write`). A `$use` node and a fragment take neither field.
    - Tests and vectors: `src/__tests__/local-bindings.test.tsx` (31 tests: the plan's seven names plus references, child counts, bounds, byte budget, SDK and templates); `conformance/corpus` gains 10 ui-tree and 4 manifest cases and `common/local-manifest.json`; `conformance/patch/bindings.json` (a new file, because changing `diff.json` would need a "changed" register entry); `validator-rules` gains an `expressions` row for the new spec §10 bullet.
    - Docs: spec §4, §7.1, §7.6, §8 (local state and bindings), §9, §9.1, §10; formats, SDK, templates and migration guides; CHANGELOG; register entries with the corpus and vector files.
    - Findings that affect later tasks:
      1. **Task 4**: the React renderer ignores a `setLocal` event (`src/react/renderer.tsx` returns before `complete`). `ImplementationProps.events[...].type` now includes `"setLocal"` (a declaration widening in `/react`; `react-types.test.tsx` updated), so the "`/react` declarations unchanged" gate needs a register entry or the type must stay as it was. The core evaluates with `compileExpression(expr, scope, "", TREE_EXPRESSION)` over `rootScope({ local, self })`, charges 256 steps (`Frame.steps`), re-validates with `checkNode`, and finds gated ids with `isGated`; `shareNode` must compare `when` and `bind` (W3).
      2. **Task 4**: the P1 live-filter bench needs trees whose rows carry `when`; `bench/validator.bench.ts` already builds such a tree (50 distinct `when` on the 679-node subject).
      3. **Task 5**: `binding-failed` can carry the evaluation `LiveframeError`, which holds a pointer and expected text but no values.
      4. `renderElements`/`streamElements` element JSON does not accept `when`/`bind` (an ephemeral manifest has no `local`, so it could only gate on `self`); that is unchanged and recorded as a Further Action candidate.
    - Performance: validator 679 nodes without bindings 1.26–1.35 µs/node (baseline 1.28), so the tax is the two `hasOwn` tests. With 50 distinct `when` it is 1.47–1.57 µs/node (+0.2 µs/node, about 3.7 µs per expression), over the 1.5 share by up to 5%. Profile split: about 45% walking and byte-counting the expression JSON, 25% analysis (`constantType`, `analyze`; 0.9 µs for a typical expression measured alone), the rest bookkeeping. B4's tighter bounds would not help (the expressions are small), so P3 is relaxed for this section only: the bench gates at 1.75 µs/node and records the figure.

- [x] Task 4: Extract the framework-independent surface core (`/surface`), with local bindings in it
  - Acceptance Criteria:
    - Functional:
      - `src/surface/` (host-API-free; no React, no DOM) exports `createSurfaceCore({ catalog, implementations: kinds-only facts, validator, onIntent, confirm?, onEvent? })` owning: arrival validation and revision rules (spec §11 "never trusts its transport"), node-context construction (props, `slot()` classes including axis suffixes, style declarations, `events` metadata, `domId` seed), intent completion and `emit` carry checks, confirmation single-flight, local state and `setLocal` application, `when`/`bind` evaluation with per-value re-validation, and the node-sharing algorithm now in `src/react/share.ts`.
      - `/react` keeps its public API (`createRenderer`, `<Surface>`, `implement`, `ImplementationProps`) and becomes an adapter that maps core node contexts to React elements, error boundaries, portals and focus continuity. Every existing renderer, preview and conformance test passes unedited except where they assert internals.
      - `<Surface>` applies `setLocal` without calling `onIntent`, re-evaluates only nodes whose expressions reference changed keys, and keeps focus, scroll and local React state of unaffected nodes.
      - A test-only renderer in `src/__tests__/fixtures/dom-renderer.ts` (plain DOM, not shipped) renders every proof scenario through the core and produces the same `data-lf-node` structure and slot classes as `/react` (compared in a browser test).
      - `package.json` exports `./surface`; spec §11 splits into "the surface core" and "the React adapter"; spec §13 table row added; `docs/renderer.md` gains "Writing another renderer".
    - Performance: arrival + commit on the selection bench (production profile, plan 022) within 5% of 0.2.3, and a tree without `when`/`bind` within 1% of the core-extraction baseline (design P2); the live-filter budget holds as the design defines it (P1): 50 gated rows, a keystroke flipping up to 10 of them, ≤ 4 ms median, zero `onIntent` calls; the all-50 flip is recorded, not gated. A miss is recorded with its split (evaluation, commit) and a proposed budget.
    - Code Quality: the move is a refactor with behaviour fixed by the existing suites; graft `callers` run for every moved symbol; no duplicated logic left in `/react`.
    - Security: law 2 — the core validates arrivals and bound values before any adapter reads them; law 4 — confirmation and completion rules move unchanged.
    - Compatibility: `added` for `/surface` and its exports; `/react` declarations unchanged (gate proves it) except `ImplementationProps` event metadata, whose `type` gained `"setLocal"` in Task 3 (the API gate did not flag it; register it here if Task 4 changes that type further).
  - Approach:
    - Skills to Use: `safe-refactor`; `liveframe-execution` (renderer reference); `graft callers --depth all` before every move.
    - Library Documentation to Check Before Implementation: React 19 `useSyncExternalStore` (core-to-React subscription for local state) via `find-docs`.
    - Documentation Reviewed: `src/react/renderer.tsx:193-519` (`acceptTree`, `raiseIntent`, `context`, `Surface`); `src/react/share.ts`; `src/react/implement.ts`; spec §11.
    - Options Considered: ship a Web Components renderer now. Rejected for 0.3.0: the core is the prerequisite and spec §14 keeps other renderers a non-goal; recorded as a Further Action candidate.
    - Chosen Approach: extract the core, keep `/react`'s API, prove independence with a test-only DOM renderer.
    - API Notes and Examples:
      ```ts
      const core = createSurfaceCore({ catalog, kinds, validator, onIntent, onEvent });
      const accepted = core.accept(tree);          // Result<SurfaceSnapshot>
      core.subscribe(() => draw(core.snapshot())); // local-state changes
      ```
    - Files to Create/Edit: `src/surface/*`; `src/react/renderer.tsx`; `src/react/share.ts` (moved); `src/react/implement.ts`; `src/conformance/react/*` (if internals referenced); `src/__tests__/fixtures/dom-renderer.ts`; `src/__tests__/surface-core.test.ts`; `src/__tests__/surface-dom-parity.test.ts`; `package.json`; `scripts/build.ts`; `src/__tests__/portability.test.ts`; `docs/spec.md` §11, §13; `docs/renderer.md`; `register-0.3.0.json`
  - Test Cases to Write:
    - `core_has_no_react_or_dom_imports` (portability); `dom_renderer_matches_react_structure` (browser, every proof scenario); `set_local_never_calls_onIntent`; `live_filter_50_rows_no_round_trip` (browser, timed); `bound_value_failing_schema_renders_node_fallback`; `local_state_resets_on_surface_change`; existing renderer suites unchanged.
  - Notes (executed 2026-11-08): `src/surface/` is the core and `/react` is an adapter over it. `bun run check` passes (1569 tests, 0 fail); the new parity test also passes under `LIVEFRAME_BROWSER=firefox` and `webkit`. What changed:
    - Core (`src/surface/core.ts`, `bindings.ts`, `share.ts`, `index.ts`): `createSurfaceCore({ catalog, validator, onIntent, confirm?, domIdPrefix? })` returns `{ accept, snapshot, subscribe, attach, fail }`. `accept(input)` validates, applies the revision rules, shares nodes and builds contexts, returns `Result<SurfaceSnapshot>`, is idempotent per input object and never notifies, so a framework may call it while rendering. `SurfaceSnapshot = { valid, errors, tree, root, local }` is a new frozen object only when something a renderer reads changed; `tree` survives an invalid arrival. `NodeContext` holds `node, id, kind, variant, props` (bound, re-validated, `refProps` rewritten), `domId, events, slot, style, emit, items, fault`. `emit` owns the `carries` check, `setLocal` application, completion, origin and single-flight confirmation (moved unchanged from `/react`). `onIntent` and `confirm` are read at use, so the adapter passes accessors and never rebuilds the core for a new callback.
    - Local state and bindings: local starts at `initialLocal` and resets on a different `surfaceId`; a `setLocal` write is checked against `localFacts(validator).checks` (a new `LocalFacts` beside `actionFacts` in `validate/compile.ts`), then `build` runs again. Each tree node caches `{ reads, seen, context, props }`; `reads` is the union of the local keys read by the node and its subtree (found by scanning `$path` operands, whole-object reads count as all keys), so an unrelated node returns its cached context after one `every` over an empty array, and an unchanged result keeps its identity at every level (structural sharing). `when` false removes the node from `items`; a failed evaluation, a non-boolean `when` or a failed `checkNode` of the effective props gives the node a `fault` and leaves the surface valid. Expressions compile once per tree node over `rootScope({ local, self })` with a fresh budget per expression and 256 steps of fuel.
    - Adapter (`src/react/renderer.tsx`, 546 → 387 lines): one core per validator held in state (a new validator starts a new core), `useSyncExternalStore` for snapshots, a per-context element cache reset on portal or diagnostics change, `Boundary` keyed on the context (so a rebound value retries a failed node) reporting through `core.fail`, and a node `fault` drawing the node fallback. `ImplementationProps`, `createRenderer`, `implement` and the `Surface` props are unchanged; no `/react` declaration changed beyond Task 3's `"setLocal"` in `events[...].type`. `share.ts` moved with `git mv`; its importers (`react-surface.test.tsx`, `bench/streaming-client.tsx`) now point at `src/surface/share.ts`. `shareNode` now also compares `when` and `bind` (design W3), which Task 3 left out. `graft callers` for `shareNodes`, `referencedProps` and `settled` shows no caller left in `/react`.
    - Surface facts are read lazily (`actionFacts`, `localFacts`): `preview-react.test.tsx` passes `<Preview>` a spread copy of a validator whose `validateTree` always fails, and the old renderer never looked such a validator up. `a_wrapped_validator_that_rejects_every_arrival_needs_no_facts` pins it.
    - Tests: `src/__tests__/surface-core.test.ts` (20 tests: arrival and revision rules, idempotence, identity reuse, `set_local_never_calls_onIntent`, `when` hiding with unrelated identities kept, same-value writes, schema rejection, `local_state_resets_on_surface_change`, hidden root, `bind`, `bound_value_failing_schema_renders_node_fallback`, evaluation errors, recovery, intent completion and origin, carries mismatch, inert while invalid, single-flight confirmation dropped after detach, `core_has_no_react_or_dom_imports`). `src/__tests__/fixtures/dom-renderer.ts` (about 80 lines of plain DOM on the core) and `surface-dom-parity.test.ts`: `dom_renderer_matches_react_structure` compares `data-lf-node` structure, slot classes, style declarations and effective props with `/react` for every proof scenario (a mutation of the DOM renderer fails it), and `dom_renderer_matches_react_after_local_state_changes` types into a bound filter and compares after each write with zero intents on both sides. `proof/tests/renderer-browser.test.tsx` gains `live_filter_50_rows_no_round_trip` (production build, real React Aria primitives, window helper `measureLiveFilter`).
    - Registrations: `./surface` in `package.json`, `portability.test.ts` and both runtime-matrix tables (README, spec §13), `exports.test.ts`, 7 `added` register entries ("029 T4"), spec §11 split into "The surface core" and "The React adapter" (new rule 4), `docs/renderer.md` "Writing another renderer", migration "The surface core", CHANGELOG, and the architecture and renderer skill references.
    - Performance. P1, live filter (production React 19.3.1, Chromium 156, 679 nodes, 50 gated rows, Enter on the filter field commits a `setLocal`): a keystroke flipping 9 of 50 rows takes a median **1.60–1.65 ms** over 50 keystrokes against the 4 ms budget, with zero `onIntent` calls; flipping all 50 rows takes **4.25–4.35 ms**, recorded and not gated. P2, no tax without bindings, paired `bench/ab.ts` on the selection bench: against the pre-extraction tree (`a63fb65`, 9 runs, default focus continuity) React work 1.000 and 0.968, wall 1.029 and 0.986 (certified, rack) and the unchanged validation phase read 1.026 in the same runs, so about 3% is the noise floor; focus-continuity wall medians were 2.4/2.4 and 3.0/3.1 ms. A 15-run repeat with focus continuity off on both sides (`5732f87`, which is `a63fb65` with that one test argument changed) gave certified React 1.000, wall 1.000, rack React 1.071, wall 1.020 with identical or one-timer-step medians (rack wall 2.50 → 2.60 ms; `performance.now` steps are 0.05 ms). The 1% bar cannot be resolved below that step: no regression is visible, and none is claimed beyond it. Against 0.2.3 (9 runs, focus continuity off on both sides, same bench): React work 1.000 and 1.143, wall 1.040 and 1.078 (0.75 vs 0.70 ms and 2.65 vs 2.50 ms medians for certified). With default settings the head is 1.31× 0.2.3 on wall, which is the registered default change (`focusContinuity` now `true`, 0.6 ms of `getComputedStyle` work per update, `focusContinuity.false` 2.4 ms vs `true` 3.0 ms); the remaining 4–8% sits on the same timer step and predates this task (head vs `a63fb65` is 1.00–1.02), so it is Task 2 and 3 validation, which this task did not touch. Recorded for the Task 7 sweep.
    - Findings that affect later tasks: (1) Task 5 hooks: `arrival-rejected` and `stale-revision` belong in `accept` (idempotent, so one event per arrival), `binding-failed` where `build` receives a `fault` (it carries `evaluated.fault`'s `LiveframeError`s, and a faulty context is reused while its errors are equal, so it fires once per change), `emit-rejected` at the two `throw`s in `emit` and `writeLocal`, `implementation-failed` in `core.fail`, `confirm-dropped` in `raise` when approval arrives after `detach`; the option should be read at use like the callbacks, so the adapter passes an accessor. The plan's `onEvent?` in Task 4's option list is therefore not implemented here. (2) The option list also named `implementations: kinds-only facts`; the core takes only the catalog and the validator because it needs no implementation, so the registry check stays in `createRenderer` and an adapter for another framework does its own. (3) The proof `textField` commits on blur or Enter, not per keystroke, so the live-filter measurement drives Enter after each input event; a primitive that emits per change would add one core `build` per character, the same cost measured here.

- [x] Task 5: Observability events from the surface core and `<Surface>`
  - Acceptance Criteria:
    - Functional:
      - `onEvent(event)` on `createSurfaceCore` and `<Surface>` receives frozen events: `{ type: "arrival-rejected", surfaceId?, errors }`, `{ type: "stale-revision", surfaceId, revision, current }`, `{ type: "emit-rejected", nodeId, event, reason }`, `{ type: "implementation-failed", nodeId, kind }`, `{ type: "binding-failed", nodeId, prop?, errors }`, `{ type: "confirm-dropped", nodeId }`. The union is open (spec §10's rule for kinds applies).
      - A throwing `onEvent` is contained and never breaks rendering.
      - `docs/renderer.md` shows wiring events to a host logger.
    - Performance: no cost when `onEvent` is absent (no event objects allocated).
    - Code Quality: events raised where the decisions are made in the core; no wrapper layer.
    - Security: events carry ids, kinds and `LiveframeError`s only — never prop values (which may hold user data).
    - Compatibility: `widened` for `SurfaceProps`; `added` for `SurfaceEvent`.
  - Approach:
    - Skills to Use: `liveframe-execution`; `lean-build`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: Task 4's core; spec §11.
    - Options Considered: console logging. Rejected: hosts need structured data and the library never logs on the render path.
    - Chosen Approach: one optional typed callback.
    - API Notes and Examples:
      ```tsx
      <Surface onEvent={(e) => telemetry.record("liveframe", e)} … />
      ```
    - Files to Create/Edit: `src/surface/*`; `src/react/renderer.tsx`; `docs/renderer.md`; `docs/spec.md` §11; `register-0.3.0.json`
  - Test Cases to Write:
    - `arrival_rejected_event_carries_errors`; `implementation_failed_event_names_node`; `throwing_onEvent_contained`; `events_carry_no_prop_values`; `no_allocation_without_onEvent` (spy).
  - Notes (executed 2026-11-08): `<Surface onEvent>` and `createSurfaceCore({ onEvent })` report six frozen events. `bun run check` passes (1580 tests, 0 fail). What changed:
    - Core (`src/surface/core.ts`): `SurfaceEvent` (exported from `/surface`) and the `onEvent` option, read at use like `onIntent` and `confirm`. One `notify` freezes the event and calls the handler through the existing `settled`, so a throw or a rejected promise is contained. Every site guards with `if (options.onEvent)` before building the event, so nothing is allocated without a handler. Sites: `arrival-rejected` and `stale-revision` in `accept` (idempotent per input, so one event per arrival); `emit-rejected` in a new `rejected()` that replaces both `throw`s in `emit` and `writeLocal` (`invalid-value` for a `carries` mismatch, `invalid-local` for a local-schema miss; the thrown message is unchanged); `binding-failed` where `build` creates a faulty context, so it fires once per change and not for a reused fault (`prop` is read from the first error's `/bind/<prop>` or `/props/<prop>` pointer); `implementation-failed` in `core.fail`; `confirm-dropped` for the single-flight drop and for approval after detach.
    - Adapter (`src/react/renderer.tsx`): `SurfaceProps.onEvent`, passed to the core through the same accessor-on-a-ref as `onIntent` and `confirm`, so an inline arrow needs no memoising and no new core.
    - Decisions: `arrival-rejected.surfaceId` is the surface on screen (from the last accepted tree), because the plan says to validate before reading any field of the rejected input; it is absent before the first tree. The TypeScript union is closed and the docs say hosts must ignore unknown `type`s, which is how the "open" requirement is met. `SurfaceEvent` is exported from `/surface` only; `/react` hosts import the type from there.
    - Tests: `surface-core.test.ts` gains an "observability events" block (10 tests: the five names in the plan plus stale revision, emit reasons, binding once-per-change, confirm drops and frozen events). `no_allocation_without_onEvent` spies on `Object.freeze` (`notify` freezes before it checks for a handler, so an event built without one is seen) and was checked by mutation: forcing one guard open fails it. `events_carry_no_prop_values` sends a secret through an invalid arrival, a failing binding, a rejected emit and a stale revision, and finds it in no event. `react-browser.test.tsx` gains `implementation_failed_event_names_node` (a throwing primitive then a rejected arrival, through `<Surface onEvent>`).
    - Docs and register: spec §11 (core signature, an "Observability" bullet, the adapter's accessor list), `docs/renderer.md` ("Watch what the surface rejects" with a table and logger wiring, plus the "Writing another renderer" snippet), migration "Observability events", CHANGELOG, and one register entry (`SurfaceEvent`, `added`). `SurfaceProps` is not an exported name, so the `<Surface>` prop is covered by the migration heading and the CHANGELOG; the API gate raised nothing for it.
    - Findings: (1) A React host's `onEvent` runs during render for `arrival-rejected` and `stale-revision` (the adapter calls `accept` while rendering), so a handler must not set state; the guide says so. (2) `LiveframeError` carries a pointer and expected text, never the value, which `events_carry_no_prop_values` pins. (3) Plain `bun test` resolves `@arnilo/liveframe/*` to `dist`; run tests with `--conditions liveframe:source` (the `test` script does).

- [x] Task 6: The localisation contract and guide (L1)
  - Acceptance Criteria:
    - Functional:
      - Spec §7.1 adds: locale, direction and time zone reach a widget only through `context` (recommended keys `locale`, `direction`, `timeZone`, documented as conventions, not reserved); a widget that calls `Intl` or `toLocale*` is deterministic only within one runtime build, so `renderKey` caching across runtimes is unsafe for such widgets; templates have no locale-dependent operator, so their output is runtime-independent.
      - `docs/localisation.md` (outsider guide): passing locale via `context`, pre-formatting through data sources, message catalogs as a data source, RTL via `dir` on the host and the logical-side projection rules (§6.2–§6.3), and what changes in capture (`--text-scale`).
      - The proof agent-home widget gets a `context.locale` scenario rendering a localised label through a source, as the worked example; `docs-links` covers the guide.
    - Performance: n/a — documentation and fixtures.
    - Code Quality: no new API.
    - Security: n/a for the laws.
    - Compatibility: spec clarification only; no register entry.
  - Approach:
    - Skills to Use: `liveframe-execution`.
    - Library Documentation to Check Before Implementation: ECMA-402 note on implementation-defined output via `find-docs`.
    - Documentation Reviewed: spec §6.2–§6.3 (logical sides), §7.1, §8 (re-runs are cacheable).
    - Options Considered: a library formatting API. Rejected: formatting data is the host's (law 4 spirit: data comes from the app), and a built-in formatter would need ICU data.
    - Chosen Approach: a stated contract plus a guide.
    - API Notes and Examples:
      ```ts
      context: { locale: "de-DE", direction: "ltr", timeZone: "Europe/Berlin" }
      ```
    - Files to Create/Edit: `docs/spec.md` §7.1, §8; `docs/localisation.md`; `docs/sdk.md`; `src/__tests__/fixtures/widgets/*` (scenario); `README.md` (guide link)
  - Test Cases to Write:
    - `localised_scenario_renders` ; `docs-links` covers the new guide.
  - Notes (executed 2026-11-08): Documentation and fixtures only; no API or format change. `bun run check` passes (1583 tests, 0 fail). What changed:
    - Spec §7.1 gains a "Locale, direction and time zone" bullet: they reach a widget only through `context` (conventional keys `locale`, `direction`, `timeZone`, declared by the manifest if wanted, not reserved); a widget calling `Intl` or `toLocale*` is deterministic only within one runtime build (ECMA-402 leaves supported locales and output implementation-defined, read through ctx7 `/tc39/ecma402`), so a cross-runtime `renderKey` cache is unsafe for it; the portable pattern is host-formatted data; templates have no locale-dependent operator (checked: nothing under `src/template` or `src/validate` calls `Intl`, `toLocale*` or `localeCompare`); direction is the host's `dir`, with logical sides per §6.2–§6.3. The §8 "Re-runs are cacheable" bullet points back to it.
    - `docs/localisation.md`: context keys with a manifest schema, host formatting through a source bound to `context.locale` (`bindSources` example), message catalogs as a source, the determinism rule, RTL via `dir` and logical sides, and `--text-scale` captures with one scenario per locale (capture does not set the locale; the scenario's `context` does). Linked from the README guide list and `docs/sdk.md`; `docs_links_resolve` covers it. CHANGELOG entry added; no register entry (clarification only).
    - Proof fixture: agent-home's manifest `context` gains an optional `locale` (`maxLength` 35), the `queue.checked` capability an optional `locale` parameter, and the fixture's `checked` source binds it from `context.locale`. New scenario `localised` (`context.locale: "de-DE"`, `data.checked` `"28.09.2026 14:02 UTC"`). `sdk-proof-widgets.test.ts` gains `localised_scenario_renders` (binding carries `de-DE`, an absent locale omits the param, the host-formatted text is drawn) and the inventory lists the scenario. `fixtures/mcp-texts.json` carries the new capability text.
    - Findings: (1) The widget itself is unchanged, so the localised thing is the source's value (`checked`), not the hard-coded "Checked" prefix or other labels; a real message catalog source would need a required `data` key on every scenario of every manifest that shares agent-home's source overlay, which was out of proportion for a worked example. (2) `template-document.test.ts` `install_validation_of_agent_home_within_budget` (5 ms) failed once under full-suite load and measures 2.07 ms alone; it is a timing flake that predates this task.

- [x] Task 7: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: the twelve impact areas swept in `plans/evidence/029-impact-analysis.md`, with law 1 reviewed against bindings and law 4 against `setLocal` and action results; findings presented, dispositions recorded and executed or backlogged.
    - Performance: `bun run bench` and the production-profile selection bench.
    - Code Quality: findings cite `file:line`.
    - Security: explicit review that no expression evaluated in the browser can reach data the widget did not put in the tree.
  - Approach:
    - Skills to Use: `create-plan`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: this plan's notes.
    - Options Considered: n/a.
    - Chosen Approach: the standard final task.
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `plans/evidence/029-impact-analysis.md`; `plans/backlog.md`.
  - Test Cases to Write: n/a.
  - Notes (executed 2026-11-08): All twelve areas swept in `plans/evidence/029-impact-analysis.md` (seven findings, F1–F7). Law 1 reviewed against bindings and law 4 against `setLocal` and action results; the explicit review found no path for a browser-evaluated expression to reach data the widget did not put in the tree (frame holds only `local` and `self`; operator allow-list; `Object.hasOwn` reads; every bound value re-validated), backed by hostile-input probes and a near-cap tree (about 1,200 gated and bound rows: arrival 90–130 ms, keystroke 2–15 ms at load 17). Dispositions:
    - **Executed.** F1: the demo host's `offeredIntent` returned a node's event (now `TreeIntent`) as `Intent`, so `demo:test` failed to typecheck (`bun run check` does not cover `examples/`); the helper now narrows out `setLocal` and `demo:test` passes (57). F2: `docs/model.md` (Phase E: local state, the action outcome step) and `docs/security.md` ("Local bindings run in the browser", with the bounds).
    - **Backlog.** F3 (no quiet-host proof of the bindings validator gate, the live-filter figures, the `actions` input check or the selection bench's 4–8% against 0.2.3; extends the quiet-host entry, plan 032 Task 3), F4 (absolute-millisecond tests fail the full `check` at load 17–27; extends the intermittent-failure entry), F5 (element JSON `when`/`bind`, P4), F6 (no renderer-conformance case for `when`, `setLocal` or `binding-failed`, none for a renderer on `/surface`, P3), F7 (no way to express an empty state over filtered rows; local state scalars only, P3).
    - Verification: `bun run check` **passes (1583 tests, 0 fail)** on its third run; the first two ran at host load 17–27 (shared machine, unrelated work) and failed 4 and 8 tests, all gated on absolute milliseconds or a 5 s timeout, six of the eight passing alone (backlog F4). Firefox renderer browser suites 57 pass; WebKit 56 pass and one CSS theme-switch frame gate (156 ms vs 16.67) fails at load 19–40; `demo:test` 57 pass after F1. `bun run bench` stage by stage at load 6–8: the 50-`when` validator gate passes (1.687 vs 1.75 µs/node), `core-queue.large`/`core-queue.full` fail the known 1.5 gate (1.57), render and template absolute budgets read high; paired against `6041e0b` (load 8–9): `renderTemplate` 1.013, render 0.95–1.07 (median about 1.02) with validation 0.92–1.00. Not quiet-host proof, so F3 stays open.

## Verification (whole plan)

- `timeout 900 bun run check`
- `LIVEFRAME_BROWSER=firefox` and `LIVEFRAME_BROWSER=webkit` runs of the renderer browser suites
- `timeout 900 bun run bench`
- `bun run demo:test`

## Compromises Made

- Task 2: `liveframe gen` does not generate typed widget props from a manifest (it never did), so typed `actions` are the `WidgetProps` fifth generic and `ActionStatus<V>`. A template cannot address row-keyed statuses by path; it uses `$get` with a computed key, typed as the join of all action statuses.
- Task 3: the 50-`when` validator bench gates at 1.75 µs/node, not the design's 1.5 (measured 1.47–1.57; the cost is walking and counting the expression JSON). `intent` error text mentions `setLocal` only when a manifest declares `local`. `Intent` excludes `setLocal` (it never reaches a host); `TreeIntent` covers a node's events. Element JSON (`renderElements`, `streamElements`) takes no `when`/`bind`.
- Task 4: `createSurfaceCore` takes no `implementations` or `onEvent` (see Notes; the latter is Task 5). The 1% no-tax bar is not resolvable below the 0.05 ms timer step of the selection bench; the paired A/B shows no regression above it. A selection-bench A/B against 0.2.3 reads 4–8% slower with focus continuity off on both sides, a difference that predates this task and is left to the Task 7 sweep.
- Task 5: `SurfaceEvent`'s union is closed in TypeScript (hosts ignore unknown `type`s by convention) rather than carrying an open `{ type: string }` member that would defeat narrowing. `arrival-rejected.surfaceId` names the surface on screen, not the rejected input's.
- Task 6: the `localised` proof scenario localises one host-formatted value (`checked`), not the widget's fixed English labels; a catalog-source example is documented in `docs/localisation.md` but not built into the proof widget.
- Task 7: `bun run check` passes, but `bun run bench` does not pass as one command (the known `core-queue` validator gate and noise-bound render budgets at load 6–19 from unrelated work), and no quiet-host proof was obtained; that moves to plan 032 Task 3 (backlog F3).

## Further Actions

- P3: quiet-host paired proof of the bindings validator gate (1.75 µs/node), the live-filter keystroke, the `actions` input check and the selection bench against `v0.2.3` (backlog, plan 032 Task 3).
- P3: renderer-conformance cases for `when`, `setLocal` and `binding-failed`, and a suite for renderers written on `/surface` (backlog).
- P3: an empty-state answer for filtered lists (backlog).
- P3: make absolute-millisecond tests load-aware so a loaded host cannot fail `check` (backlog, extends the intermittent-failure entry).
- P4: `when`/`bind` for element JSON (backlog).
- Candidate, not queued: a shipped Web Components renderer on `/surface` (Task 4 Options Considered; spec §14 keeps it a non-goal).
