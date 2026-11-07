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

- [ ] Task 2: Action results end to end
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
  - Notes (executed <date>):

- [ ] Task 3: Local state and bindings in the formats, SDK and validator
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
  - Notes (executed <date>):

- [ ] Task 4: Extract the framework-independent surface core (`/surface`), with local bindings in it
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
    - Compatibility: `added` for `/surface` and its exports; `/react` declarations unchanged (gate proves it).
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
  - Notes (executed <date>):

- [ ] Task 5: Observability events from the surface core and `<Surface>`
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
  - Notes (executed <date>):

- [ ] Task 6: The localisation contract and guide (L1)
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
  - Notes (executed <date>):

- [ ] Task 7: Analyze architectural impact and dispose of every finding
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
  - Notes (executed <date>):

## Verification (whole plan)

- `timeout 900 bun run check`
- `LIVEFRAME_BROWSER=firefox` and `LIVEFRAME_BROWSER=webkit` runs of the renderer browser suites
- `timeout 900 bun run bench`
- `bun run demo:test`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
