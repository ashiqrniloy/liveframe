# Phase 4 Part A: React Renderer

## Objectives

- Ship `@arnilo/liveframe/react`: `createRenderer()` with the startup registry check, `<Surface>`, `implement()` and `onIntent`, built on the shipped validator and `/css` helpers.
- Make the renderer distrust its transport: re-check every arriving tree with the app's compiled validator, render the app's `fallback` instead of any part of an invalid tree, and ignore stale revisions.
- Keep focus, scroll and local (tier 1) state across re-renders by reconciling on node `id`, and keep overlays inside their surface's scope, including during theme and design-system switches.
- Support server-side rendering and hydration with no mismatch.
- Replace the proof renderer: drive the proof host with the SDK-ported widgets, the in-process runner and `/react`, then re-prove the three interaction tiers, agent-home parity and the switch budget on it.

## Expected Outcome

- `createRenderer({ catalog, implementations })` throws a typed error at startup for a missing, duplicate or mismatched implementation, and returns `{ Surface }`.
- `<Surface tree validator theme designSystem onIntent fallback />` draws a validated tree with the app's primitives. Each slot gets its recipe class and each node's style props become inline declarations and classes from `/css`. A wrapper element carries the surface's scope attributes and classes, and a sibling portal container carries the same ones.
- An invalid tree renders `fallback` for the whole surface. An implementation that throws renders `fallback` at that node only. A lower revision is ignored.
- `emit()` raises the node's declared intent, with event values checked against `carries`, `setState` values filled in and `bind` arguments filled, then hands it to `onIntent`.
- Changing `theme` or `designSystem` runs spec §6.4's switching sequence on the wrapper and the portal together. No node, class or widget output changes, and no transition runs.
- `renderToString` on Bun, then `hydrateRoot` in Chromium, produces no recoverable hydration error.
- The proof host renders all four reference UIs through packages, `inProcessRunner()` and `/react`. All three tiers work end to end. Focus, scroll and local state survive re-renders. Agent-home parity is ≤ 1% at 1440, 1024 and 390 px. A warm switch takes ≤ 16.67 ms. `proof/renderer/{surface.tsx,implement.ts,registry.ts}` are gone.
- `docs/renderer.md` explains, for outsiders, how a host builds a renderer, writes implementations, mounts surfaces, handles intents, switches styles and renders on the server.

This plan implements roadmap Phase 4 Part A: spec §11 (renderer), the renderer half of §8 (interaction tiers), §9's reconciliation and revision rules, and §10's arrival check. It also covers the renderer contract in §6.4 (slot classes, scope attributes, overlays, switching) and the `/react` row of §13. The contracts were settled by `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md`. The owner's request to complete Task 1 approves its three planning refinements and the decision-log amendment. The plan consumes the shipped validator (`src/validate/compile.ts:48`), `/css` (`src/css/index.ts`), `pack()` and `inProcessRunner()` without changing them. Plan 009 (Part B, the preview) depends on this plan.

**Not in this plan:**
- `createPreview()`, `<Preview>` and `liveframe preview capture`: Plan 009.
- The renderer conformance suite: Phase 5. Task 10 hands over the cases.
- App-owned icon sets (G26): Phase 7. The real Windows and assistive-technology audit (G29) is a Phase 6 release gate (`roadmap.md` Phase 6).
- A primitive set, a behaviour library or a design system in the published package. The proof's React Aria primitives stay in `proof/`.
- Tree patches, nested surfaces, other renderers.

Probe answers that hold for every task, unless a task says otherwise:
- **Placement:** `src/react/`, exported as `@arnilo/liveframe/react`. It may import React, `react-dom` and DOM APIs. It is one of the spec §13 host-API exceptions. It imports the root export, `/css` and nothing from `/sdk`, `/pack`, `/store` or `/preview`. Test-host primitives and the proof host stay in `proof/`. `src/` never imports `proof/` outside `src/__tests__/`, which `src/__tests__/portability.test.ts:52–76` enforces.
- **Four laws:**
  - Law 1: the renderer runs no widget code; it draws trees.
  - Law 2 is the one this phase enforces in the browser: no tree reaches an implementation before the validator accepts it.
  - Law 3: every class comes from `slotClass`/`styleDeclarations` and every inline style from `styleDeclarations`. The renderer writes no colour.
  - Law 4: `onIntent` only requests. The host authorises and re-checks every intent (spec §8).
- **Primitives only:** `/react` ships no implementations and knows no kind by name. Collection and overlay behaviour reaches it only through the generic `items` and `portal` inputs.
- **Dependencies:** no new runtime dependency. `react` and `react-dom` become optional peer dependencies (spec §13). They are already dev dependencies: React 19.3.1, react-dom 19.3.1, and react-aria-components 1.22.1 (proof only). Browser tests use the existing Playwright 1.64.1 dev dependency.
- **Reference hosts:** Synapta and Clay mount `<Surface>` with their own implementations. A host that cannot send a manifest to the browser cannot build the arrival validator. The decision records that as a revisit condition, and Task 11 sweeps it.
- **Performance:** spec §7.1's budgets are measured on realistic sizes. This plan re-runs the existing gates through the real renderer (Task 8): ≤ 16.67 ms warm switch and ≤ 50 ms host `setState` round trip. It records the browser-side arrival validation and React reconciliation time on the 679-node agent-home selection re-render; neither is a new budget.

## Tasks

- [x] Task 1: Pin the renderer details found while planning, and write them into the spec
  - Acceptance Criteria:
    - Functional:
      - The owner approves, or amends, three refinements of the 2026-10-24 decision. The answer is recorded as a "Planning refinements (plan 008 Task 1)" section in `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md` (owner approval to amend the log is part of the same answer), and spec §11 is updated to match:
        1. **The surface wrapper carries the scope.** `<Surface>` renders its own wrapper element with `surfaceAttributes({ theme, designSystem, tree })` (scope attributes, `lf_surface` and, for a responsive tree, `lf_container`), and a sibling portal container with the same attributes and classes. The root slot carries only the node's recipe and style-prop classes, so the line in §11 that says the root slot carries "the surface and container classes" is corrected. The proof instead marks every parent of a responsive node as a container (`proof/renderer/surface.tsx:19–23`), while spec §6.4 says only the surface gains `lf_container`. The renderer follows the spec. If parity regresses in Task 7, stop and bring the gap to the owner.
        2. **Each item is a node context.** Each entry of `items` has `id`, `kind`, `variant`, `props`, `slot(name)`, `style`, `children` (already rendered), `render()` (the item drawn through its own implementation) and `emit(event, value?)`. The proof's `menu` and `tabs` need the item's slots, style and children, not only `render()` and `emit()` (`proof/renderer/primitives/index.tsx:313–340, 415–450`).
        3. **Intent completion and order.** `onIntent` receives complete intents: a `setState` without `value` gets the event's value, and an action with `bind` gets `args[bind]` set to the event's value and `bind` removed. An event value that does not match the definition's `carries` raises no intent and throws (an implementation bug). The arrival order is: validate first, then compare revisions, so no unvalidated field is read.
      - `docs/model.md` D2 and the `renderer.md` skill reference match.
    - Performance: n/a — no code.
    - Code Quality: the spec says each rule once. No implementation detail (hook names, state shape) goes into the spec.
    - Security: law 2 — the arrival order and whole-surface fallback are stated normatively.
  - Approach:
    - Skills to Use:
      - `create-decision-log` — the owner approves the refinements before the log changes.
      - `liveframe-execution` — the renderer reference.
    - Library Documentation to Check Before Implementation:
      - none — spec and decision text.
    - Documentation Reviewed:
      - `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md`.
      - Spec §6.4 (scope, `lf_container`), §8 (bind), §9, §11.
      - `src/css/surface.ts:7–32` (`surfaceAttributes` already returns `lf_surface` and `lf_container`).
      - `proof/renderer/surface.tsx:17–67`, `proof/renderer/primitives/index.tsx:313–450`.
    - Options Considered:
      - Put scope attributes on the tree root's primitive element — rejected: the portal container needs the same attributes, a responsive root would query itself, and an implementation would have to forward them.
      - Keep `items` as `{ id, kind, variant, props, render, emit }` only — rejected: `tabs` draws each tab's children into panels and `menu` styles item slots, so they would rebuild slot and style logic the renderer owns.
      - Pass `bind` through to the host — rejected: spec §8 has the host re-check the "filled arguments"; a complete intent is simpler for every host.
    - Chosen Approach:
      - Use the owner's explicit request to complete this task as approval of its three specified refinements and log amendment; edit the log and spec together.
    - API Notes and Examples:
      ```tsx
      // Surface output (SSR-safe; no document access)
      <>
        <div className="lf_surface lf_container" data-lf-theme="certified@1.0.0" data-lf-ds="certified@1.0.0">{root}</div>
        <div className="lf_surface lf_container" data-lf-theme="certified@1.0.0" data-lf-ds="certified@1.0.0" data-lf-portal="" />
      </>
      ```
    - Files to Create/Edit:
      - `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md`: refinements section.
      - `docs/spec.md` §11: the three refinements.
      - `docs/model.md` D2, `.agents/skills/liveframe-execution/references/renderer.md`.
  - Test Cases to Write:
    - n/a — documentation; run `bun run check` and `git diff --check`.
  - Notes (executed 2026-10-24):
    - The owner's request to complete Task 1 approved the three specified refinements and amendment of the existing decision log; recorded them in its "Planning refinements (plan 008 Task 1)" section.
    - Spec §11 now puts scope on the wrapper and sibling portal, gives each collection item its own node context, completes intents before `onIntent`, and requires validation before any revision comparison. `docs/model.md` D2 and the renderer skill reference match.
    - `bun run check` and `git diff --check` passed. No runtime code changed. Task 7 still must prove parity with surface-only containment and escalate any regression to the owner.

- [ ] Task 2: Add the `/react` subpath with `implement()` and the startup registry check
  - Acceptance Criteria:
    - Functional:
      - `package.json` exports `./react` (`./src/react/index.ts`) and declares `react` and `react-dom` (`^19.3.1`) as peer dependencies, optional through `peerDependenciesMeta`.
      - `implement(definition, Component)` returns an opaque binding.
      - `createRenderer({ catalog, implementations })` validates the catalog with `validateCatalog`. It throws one `RendererError` whose `errors: LiveframeError[]` names every problem, with `catalog-mismatch` for a missing kind, a duplicate binding, a definition that differs from the catalog's (canonical comparison, not key order), and a binding for a kind outside the catalog. It returns `{ Surface }`; Task 3 implements `Surface`.
      - Typing: for a definition declared with `defineComponent` (a `const` literal), `props` is inferred from its schema with `Infer`, `slot()` accepts only its slot names and `emit()` only its event names, with value types from `carries`. A definition loaded from JSON gives `Record<string, Json>` props and string names. An explicit type argument may narrow it.
    - Performance: the registry check runs once per `createRenderer`, never per render.
    - Code Quality:
      - `src/react/` holds `index.ts`, `implement.ts` and `renderer.tsx`. No base classes and no registry object beyond a `Map`.
      - Public names are pinned in `src/__tests__/exports.test.ts`.
    - Security: n/a — no tree or intent handling yet; the check fails closed (it throws, never renders).
  - Approach:
    - Skills to Use:
      - `typescript-advanced-types` — props, slot and event types derived from a `const` definition.
      - `liveframe-execution` — the architecture and renderer references.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2 `peerDependenciesMeta` handling (`find-docs` "Bun"), and React 19.3 `ComponentType` typing (`find-docs` `/reactjs/react.dev`).
    - Documentation Reviewed:
      - Spec §11, §13.
      - `proof/renderer/registry.ts:4–20`: the proof check, which compares with `JSON.stringify` and so depends on key order.
      - `proof/renderer/implement.ts:22–28`: the proof binding.
      - `src/formats/catalog.ts:47–58` (`Definition`, `defineComponent`), `src/schema.ts:25` (`Infer`).
      - `src/pack/hash.ts:11` (`canonicalJson`): a candidate for the comparison. It must not pull `/pack` into `/react`; if the import would, copy the comparison or move the helper to the root.
      - `src/__tests__/portability.test.ts:5–11, 52–76`.
    - Options Considered:
      - Generate implementation prop types with `liveframe gen` — rejected for this phase: implementations are written by app developers in TypeScript, and `defineComponent` already gives literal types. Task 11 sweeps it as a candidate.
      - Throw plain `Error` like the proof — rejected: agents and hosts act on typed `LiveframeError`s.
    - Chosen Approach:
      - A factory that validates once and returns a closure-bound `Surface`; types follow `defineComponent`.
    - API Notes and Examples:
      ```ts
      import { createRenderer, implement } from "@arnilo/liveframe/react";
      const button = implement(buttonDefinition, ({ props, slot, style, emit }) => (
        <button className={slot("root")} style={style} onClick={() => emit("onPress")}>
          <span className={slot("label")}>{props.label}</span>
        </button>
      ));
      const { Surface } = createRenderer({ catalog, implementations: [button /* … */] });
      ```
    - Files to Create/Edit:
      - `src/react/index.ts`, `src/react/implement.ts`, `src/react/renderer.tsx`: new.
      - `package.json`: `exports`, `peerDependencies`, `peerDependenciesMeta`.
      - `src/__tests__/portability.test.ts`: a `react` entry (host `DOM`). `src_is_host_api_free` (`:50–76`) currently requires every import to be relative and forbids `document`/`window`; under `react/` only, allow the external specifiers `react`, `react/jsx-runtime` and `react-dom` and DOM globals, and keep the no-`proof/` and no-`import(` rules.
      - `src/__tests__/exports.test.ts`: `/react` surface.
      - `src/__tests__/react-registry.test.tsx`, `src/__tests__/react-types.test.tsx`: new.
  - Test Cases to Write:
    - `registry_rejects_missing_duplicate_mismatched_and_extra_kinds`: each case alone, then all together in one `RendererError`; fails if any check is skipped.
    - `registry_ignores_definition_key_order`: the same definition with reordered keys binds; fails with a `JSON.stringify` comparison.
    - `registry_check_runs_once`: a spy on `validateCatalog` sees one call across several surfaces.
    - `implement_types_follow_const_definitions` (type-level, `// @ts-expect-error`): a wrong prop, an unknown slot, an undeclared event, and a boolean value for a `string` event fail to compile.
    - `react_export_surface`: `createRenderer` and `implement` only.

- [ ] Task 3: Draw a validated tree with `<Surface>`
  - Acceptance Criteria:
    - Functional:
      - `<Surface tree validator theme designSystem onIntent fallback />` validates `tree` with `validator.validateTree` (memoized on the `tree` and `validator` identities). A failure renders `fallback` alone, inside the wrapper, and never draws part of the tree. A tree from another `surfaceId` replaces the current one. For the same `surfaceId`, a valid tree with a lower `revision` than the accepted one is ignored.
      - The wrapper and the portal container follow Task 1, refinement 1. The portal container is a sibling element rendered by `<Surface>`, so neither SSR nor rendering needs `document`.
      - Each node renders its kind's implementation, keyed by `id`, with:
        - `props`;
        - `slot(name)`: `slotClass(kind, variant ?? definition.defaultVariant, name)`, plus `styleDeclarations(style, catalog).classes` on `root`; an undeclared slot throws;
        - `style` from `styleDeclarations(style, catalog).style`;
        - `children` (rendered);
        - `items` (Task 1, refinement 2);
        - `portal` (the container element once mounted, `undefined` during SSR and the first render).
      - An implementation that throws while rendering is caught by an error boundary around that node, which renders `fallback` in its place. Its siblings keep rendering.
    - Performance: validation runs once per tree, not per React render. A re-render with an unchanged `tree` prop calls no validator.
    - Code Quality: one recursive `Node` component, one error boundary class and one wrapper. No context beyond what `items` and `portal` need. No per-kind code.
    - Security: law 2 — an unknown kind, an invalid prop, an undeclared event or a host element (each rejected by the validator) never reaches an implementation. Law 3 — classes and styles come only from `/css`.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (renderer, styling) and `karpathy-guidelines`.
      - `find-docs` — React error boundaries and `key` reconciliation.
    - Library Documentation to Check Before Implementation:
      - React 19.3 (`/reactjs/react.dev`): `getDerivedStateFromError`, `componentDidCatch`. They do not catch event-handler or SSR errors (checked 2026-10-24); Task 6 handles SSR.
      - `useMemo`, `useState`, and preserving state by `key`.
    - Documentation Reviewed:
      - `proof/renderer/surface.tsx:17–67`: recursion, `slot`, the revision rule (`accepted.revision > checked.revision`) and the whole-tree fallback.
      - `src/validate/tree.ts:22` (`TreeValidator`), `src/css/{names.ts,style-props.ts:89,surface.ts:7}`.
      - Spec §6.4 "Classes and names", §9, §10, §11.
    - Options Considered:
      - Keep the last valid tree on a failure — rejected by the decision.
      - Validate in an effect after the first paint — rejected: an unvalidated tree would paint.
      - A context carrying the registry — rejected: the factory closure already holds it.
    - Chosen Approach:
      - Port the proof's recursion onto library helpers, with the decision's fallback and order rules.
    - API Notes and Examples:
      ```tsx
      <Surface tree={tree} validator={validator} theme={{ id: "certified", version: "1.0.0" }}
        designSystem={{ id: "certified", version: "1.0.0" }} onIntent={send} fallback={<p>Unavailable</p>} />
      ```
    - Files to Create/Edit:
      - `src/react/renderer.tsx`: `Surface`, `Node`, the boundary.
      - `src/__tests__/react-surface.test.tsx`: new. Server-rendered markup through `react-dom/server` in Bun, using small inline implementations bound to `src/__tests__/fixtures/proof/catalog.json`. These are test-local stand-ins; the real test host arrives in Task 7.
  - Test Cases to Write:
    - `surface_renders_slot_classes_styles_and_scope`: classes and inline styles equal the `/css` helpers' output, and the wrapper and portal carry the same attributes.
    - `responsive_tree_gains_container_on_wrapper_only`.
    - `invalid_tree_renders_only_the_fallback`: one case each for unknown component, invalid prop, host element and wrong `catalogId`; no implementation is called (spy).
    - `stale_revision_is_ignored_and_new_surface_replaces`.
    - `throwing_implementation_falls_back_at_that_node`: the siblings still render.
    - `validator_runs_once_per_tree`.
    - `undeclared_slot_throws`.
    - `items_expose_child_node_contexts`: `items[n].slot/style/children/render/emit` equal what that child's own implementation receives.

- [ ] Task 4: Raise intents through `emit()` and `onIntent`
  - Acceptance Criteria:
    - Functional:
      - `emit(event, value?)` and `items[n].emit` look up `node.events[event]`. An event the node does not carry raises nothing. A value that does not match the definition's `carries` (`none`: no value; `string`; `boolean`) throws and calls nothing.
      - A `setState` intent with `value` passes unchanged; one without `value` gets the event's value.
      - An action intent passes with `args[bind]` set to the event's value and `bind` removed (Task 1, refinement 3).
      - `onIntent` receives a fresh, frozen object; mutating it cannot change the tree.
      - Tier 1 interactions call `onIntent` never; tier 2 and 3 interactions call it exactly once per event (spec §8, "one intent per event").
    - Performance: n/a — event path only.
    - Code Quality: one `complete(intent, value)` function, shared by `emit` and `items`.
    - Security: law 4 — the renderer adds no authority. Intents are requests; the docs and a test state that the host re-checks the filled arguments.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (renderer, formats).
    - Library Documentation to Check Before Implementation:
      - none — local formats.
    - Documentation Reviewed:
      - Spec §8 rules, §9 `Intent`.
      - `proof/renderer/surface.tsx:27–36` (`emitNode`).
      - `src/validate/intent.ts:11–81` (how the validator checks `carries` against `bind`).
    - Options Considered:
      - Validate filled args against the action schema in the browser — rejected: the browser has no capabilities authority; the host re-checks on dispatch (spec §8).
    - Chosen Approach:
      - Complete the intent exactly as spec §8–§9 describe, then hand it over.
    - API Notes and Examples:
      ```ts
      // events: { onCommit: { type: "action", name: "tasks.escalate", args: { id: "t-1" }, bind: "reason" } }
      emit("onCommit", "blocked on review");
      // onIntent({ type: "action", name: "tasks.escalate", args: { id: "t-1", reason: "blocked on review" } })
      ```
    - Files to Create/Edit:
      - `src/react/renderer.tsx`.
      - `src/__tests__/react-intents.test.tsx`: new.
  - Test Cases to Write:
    - `set_state_without_value_takes_the_event_value`.
    - `action_bind_fills_the_named_argument`.
    - `undeclared_event_raises_nothing`.
    - `wrong_carries_type_throws_and_raises_nothing`: one case each for `none`, `string` and `boolean`.
    - `item_emit_raises_the_item_intent`.
    - `intent_objects_are_fresh_and_frozen`.

- [ ] Task 5: Keep overlays in scope and switch styles from `<Surface>` props
  - Acceptance Criteria:
    - Functional:
      - After mount, `portal` is the sibling container. An overlay portalled into it computes the surface's theme and design-system values (`getComputedStyle`).
      - Changing `theme` and/or `designSystem` runs spec §6.4's sequence on the wrapper and the portal together, in one layout effect: set `data-lf-switching`, render the new scope attributes, and remove `data-lf-switching` on the next animation frame. It also holds when the switch happens while an overlay is open.
      - A switch re-renders no implementation (render spy), changes no node or slot class, and runs no transition (`transitionrun` count 0). Focus stays on the same element.
      - Two sibling surfaces on one page switch independently. `src/__tests__/css-scope-browser.test.ts` keeps passing.
    - Performance: a warm switch of a 50-row two-surface page with an open blurred dialog takes ≤ 16.67 ms (the `switch_under_budget_with_blur` method), with the renderer driving it.
    - Code Quality: the switch is attribute output plus one layout effect; no DOM mutation from outside React.
    - Security: law 3 — scope attributes come only from `surfaceAttributes`.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (styling, renderer).
      - `find-docs` — React `useLayoutEffect` timing.
    - Library Documentation to Check Before Implementation:
      - React 19.3 `useLayoutEffect`, `createPortal` (`/reactjs/react.dev`).
      - React Aria Components 1.22.1 `UNSTABLE_portalContainer` (Context7 `/websites/react-aria_adobe`; the proof uses it at `proof/renderer/primitives/index.tsx:252`).
    - Documentation Reviewed:
      - Spec §6.4 "Preferences and switching", §11 overlays.
      - `proof/host/client.tsx`: the manual switch this replaces.
      - `src/__tests__/css-scope-browser.test.ts`: `two_surfaces_keep_their_own_styles`, `switch_changes_one_surface_only`, `overlays_keep_scope`.
    - Options Considered:
      - Create the portal container with `document.createElement` — rejected: it breaks SSR and lives outside React's ownership.
      - Leave switching to the host — rejected by the decision.
    - Chosen Approach:
      - The portal and the wrapper share one attribute object; one layout effect brackets the change with `data-lf-switching`.
    - API Notes and Examples:
      ```tsx
      <Surface … theme={next.theme} designSystem={next.designSystem} />  // switch = prop change
      ```
    - Files to Create/Edit:
      - `src/react/renderer.tsx`.
      - `src/__tests__/react-browser.test.tsx`: new browser suite (Bun-built client and Playwright Chromium, following `src/__tests__/css-scope-browser.test.ts`), with test-local implementations.
      - `src/__tests__/fixtures/react-client.tsx`: new browser entry.
  - Test Cases to Write:
    - `portal_overlay_keeps_surface_scope`.
    - `switch_runs_the_switching_sequence_on_root_and_portal`.
    - `switch_rerenders_no_implementation_and_keeps_focus`.
    - `sibling_surfaces_switch_independently`.
    - `switch_under_budget_with_blur_through_surface`: ≤ 16.67 ms warm; records the cold value.

- [ ] Task 6: Render on the server and hydrate without mismatch
  - Acceptance Criteria:
    - Functional:
      - `renderToString(<Surface …/>)` in Bun produces markup that `hydrateRoot` adopts in Chromium. `onRecoverableError` is called zero times for every proof scenario (Task 7 adds the full set; this task uses the test-local implementations).
      - The server render validates the tree and draws `fallback` for an invalid one, exactly as the client does.
      - An implementation that throws during SSR is not caught there (React error boundaries do not run on the server). Its handling is specified and tested in one of two ways. Either `<Surface>` documents that `renderToString` throws and the host renders `fallback` markup in its place, and the client recovers; or a fix with equal or smaller surface keeps the node-level fallback on the server. The executor proves which holds with React 19.3 and records it in `docs/renderer.md`.
      - `portal` is `undefined` during SSR and on the first client render, and overlays mount after hydration without a mismatch.
    - Performance: n/a — no new budget; record the agent-home SSR time in the Notes.
    - Code Quality: no `typeof window` branches in render paths; mount-only state lives in effects.
    - Security: law 2 holds on the server: the same validator check runs before markup is produced.
  - Approach:
    - Skills to Use:
      - `find-docs` — React 19.3 `renderToString`, `hydrateRoot` options and their error semantics.
    - Library Documentation to Check Before Implementation:
      - React 19.3 `react-dom/server` `renderToString`, `react-dom/client` `hydrateRoot` `onRecoverableError`, `onCaughtError` (`/reactjs/react.dev`; checked 2026-10-24).
    - Documentation Reviewed:
      - `proof/host/server.ts:100–115` and `proof/tests/fixtures/renderer-client.tsx`: the proof's SSR and hydration.
      - `proof/tests/renderer.test.tsx:33` (`server_rendering_and_transport_revalidation`).
    - Options Considered:
      - Streaming SSR (`renderToReadableStream`) — rejected for now: the spec only requires support, the proof host and tests use `renderToString`, and streaming adds Suspense semantics no widget has. Task 11 sweeps it if a host asks.
    - Chosen Approach:
      - Prove `renderToString` plus `hydrateRoot` on the renderer's own markup, and specify the SSR throw path.
    - API Notes and Examples:
      ```ts
      const html = renderToString(<Surface {...props} />);
      hydrateRoot(container, <Surface {...props} />, { onRecoverableError: (e) => errors.push(e) });
      ```
    - Files to Create/Edit:
      - `src/react/renderer.tsx` (only if a mismatch is found).
      - `src/__tests__/react-ssr.test.tsx`: new (server half).
      - `src/__tests__/react-browser.test.tsx`, `src/__tests__/fixtures/react-client.tsx` (hydration half).
  - Test Cases to Write:
    - `server_markup_hydrates_with_no_recoverable_error`.
    - `server_renders_fallback_for_invalid_tree`.
    - `ssr_throw_path_is_specified`: asserts the documented behaviour; fails if it silently renders nothing.
    - `overlay_mounts_after_hydration_without_mismatch`.

- [ ] Task 7: Drive the proof host with packages, the in-process runner and `/react`
  - Acceptance Criteria:
    - Functional:
      - `proof/renderer/primitives/index.tsx` binds every primitive with `implement()` against the library catalog (`src/__tests__/fixtures/proof/catalog.json`, the `proof.ui@1` definitions). Its behaviour and DOM stay the same:
        - `menu` and `tabs` use `items`;
        - overlays use `portal`;
        - `layout` becomes `style`;
        - `textField` uses the library's events (`onChange` / `onCommit`).
      - G20's renderer half: the test host's `textField` counts `maxLength` in Unicode code points. It never uses the native `maxlength` attribute, which counts UTF-16 units. It refuses input beyond the limit, and an emoji at the limit commits.
      - The proof host builds a package per page from the SDK-ported widgets (`src/__tests__/fixtures/widgets/`). It renders each request through `inProcessRunner()`, and `?scenario=` selects a package scenario. The page's state is the scenario's state, then `setState` updates. It sends `{ tree, manifest }`. The client compiles the arrival validator from the catalog, the capabilities and that manifest, and mounts `<Surface>` with the page's theme and design system.
      - The host re-checks every intent:
        - a `setState` key must be in the manifest state schema;
        - an action must be declared by the manifest, and its args must pass `checkValue` against the capability schema;
        - the revision must be current.
        Actions are logged, never run.
      - The harness page is ported to the SDK as a fixture widget with a manifest and one scenario, so the host protocol tests keep a 50-row smoke page.
      - `proof/renderer/{surface.tsx,implement.ts,registry.ts}` and `proof/host/state.ts` are deleted. Their callers (`proof/host/{server.ts,client.tsx,view.tsx}`, `proof/tests/{renderer.test.tsx,renderer-browser.test.tsx,host.test.ts,switch.test.ts}`, `proof/tests/fixtures/renderer-client.tsx`, `proof/css/sheets.ts`) move to `/react`, packages and the runner in this task. `proof/runtime/` stays for the proof benches and the historical proof tests that still use it.
      - Parity: `timeout 600s bun proof/scripts/parity.ts --out evidence/parity` reports ≤ 1% at 1440, 1024 and 390 px. If the surface wrapper or the container rule (Task 1, refinement 1) moves a pixel, stop and bring it to the owner before changing data.
    - Performance: ≤ 1% parity; `proof_node_counts_hold` unchanged (679 nodes); ≤ 16.67 ms warm switch (`proof/tests/switch.test.ts`); ≤ 50 ms `set_state_http_round_trip_under_50_ms`.
    - Code Quality: one package-building helper, shared by the host and the tests. `src/__tests__/phase-2-loop.test.ts:34–56` builds the same drafts; move that to `src/__tests__/fixtures/widgets/drafts.ts` and import it from both. No second renderer path remains.
    - Security:
      - Law 1: widgets run only in the runner on the server.
      - Law 2: the browser re-checks every tree.
      - Law 4: the host re-checks every intent, and the proof's existing rejection tests (`dispatch_rechecks_state_actions_current_tree_and_revision`) still pass on the new host.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (proof, renderer, storage) and `karpathy-guidelines`.
      - `investigate-first` — if parity or a browser test regresses, find the cause before changing data.
    - Library Documentation to Check Before Implementation:
      - React Aria Components 1.22.1 collections (`items` with render functions) and `TextField` controlled input (Context7 `/websites/react-aria_adobe`).
      - Playwright 1.64.1 screenshot and font readiness, as in plan 007 Task 10.
    - Documentation Reviewed:
      - `proof/renderer/primitives/index.tsx:1–470`: all 24 bindings; `textField` at 201–232, `menu` 313–340, `tabs` 415–450, overlays 233–413.
      - `proof/host/{server.ts,client.tsx,state.ts,pages.ts,view.tsx}`.
      - `proof/scripts/export-formats.ts:258–277`: the proof-to-library tree conversion (catalog id, `onSubmit`→`onCommit`), which shows the proof runtime's trees are not library trees.
      - `src/__tests__/sdk-proof-widgets.test.ts:27–83`: SDK ports render the same trees as the exports.
      - `src/__tests__/phase-2-loop.test.ts:34–56, 105`: drafts and `every_proof_scenario_through_both_runners`.
      - `plans/007-Phase-3-CSS-Projection.md` Task 10: the adoption pattern.
    - Options Considered:
      - Keep the proof runtime on the server and convert its trees — rejected: a conversion layer is a second wire format, and it would not exercise packages or the runner.
      - A new minimal fixture host — rejected by the decision.
      - Render with `render()` directly instead of the runner — rejected: spec §7.5 has preview and production share the runner, and Plan 009 mounts the preview on this host.
    - Chosen Approach:
      - Swap the server to packages plus the runner and the client to `/react`. Port the primitives in place and delete the proof renderer in the same task, so the tree stays green.
    - API Notes and Examples:
      ```bash
      timeout 600s bun proof/scripts/parity.ts --out evidence/parity
      timeout 300s bun test proof/tests/
      ```
    - Files to Create/Edit:
      - `proof/renderer/primitives/index.tsx`: ported bindings and the code-point `textField`.
      - `proof/renderer/{surface.tsx,implement.ts,registry.ts}`, `proof/host/state.ts`: deleted.
      - `proof/host/{server.ts,client.tsx,view.tsx,pages.ts}`: packages, runner, validator, `/react`.
      - `src/__tests__/fixtures/widgets/drafts.ts`: new; `src/__tests__/phase-2-loop.test.ts`: imports it.
      - `src/__tests__/fixtures/widgets/harness/`: new SDK harness widget, manifest and scenario; `src/__tests__/fixtures/widgets/index.ts`.
      - `proof/tests/{renderer.test.tsx,renderer-browser.test.tsx,host.test.ts,switch.test.ts}`, `proof/tests/fixtures/renderer-client.tsx`, `proof/css/sheets.ts`: callers.
      - `proof/host/README.md`; evidence in `proof/PARITY.md` and `proof/GAPS.md` (G20's renderer half closed in the test host).
  - Test Cases to Write:
    - Existing `proof/tests/*` (moved to `/react`) are the regression suite.
    - `text_field_counts_code_points`: 3 emoji with `maxLength: 3` commit; a fourth is refused; fails with native `maxlength`.
    - `host_rechecks_intents_against_manifest_and_capabilities`: an undeclared action, bad args, an unknown state key and a stale revision are each rejected.
    - `host_pages_render_through_packages_and_runner`: every page and scenario returns a tree equal to `render()` of the same package.

- [ ] Task 8: Prove the three tiers, survival and overlays end to end, and re-run the gates
  - Acceptance Criteria:
    - Functional (proof host, Chromium, under both design systems):
      - Tier 1: open a menu, type in a field, switch a local tab, expand a disclosure — no request leaves the browser (request log empty).
      - Tier 2: change a filter, load the next page, select a row — one `/intent` request each, then a new revision drawn by `id`.
      - Tier 3: claim, escalate with a bound reason, send — one logged action each with filled args; nothing re-renders by itself.
      - Survival: after a tier 2 re-render, the focused element, the scroll offset of a `scroll` region, a typed-but-uncommitted field value and an open disclosure are unchanged. A stale revision changes nothing.
      - Overlays:
        - a dialog's exit animation completes before it unmounts (`data-exiting` observed, then removal);
        - with the dialog open, the page does not scroll and content outside it is inert to pointer and assistive technology (`aria-hidden` or `inert` on outside content);
        - reduced motion skips the exit transition.
        These hold through the test host's React Aria implementations. If one does not, record it and bring the gap to the owner; the renderer does not add lifecycle code without a decision.
      - The invalid-tree and throwing-implementation fallbacks show in the browser.
    - Performance:
      - ≤ 16.67 ms warm switch on agent-home and git-status;
      - ≤ 50 ms host `setState` round trip;
      - record the arrival-validation time (in Chromium) and React commit time for the 679-node selection re-render in the Notes and `proof/GAPS.md`. They are not budgets; flag any value above 2 ms to the owner as a finding.
    - Code Quality: tests reuse the host and the Task 5 harness; no test-only renderer path.
    - Security: law 2 in the browser (fallback cases); law 4 (logged actions, host re-checks).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (renderer, proof); `verify-and-stop` — prove, don't extend.
    - Library Documentation to Check Before Implementation:
      - React Aria Components 1.22.1 Modal / ModalOverlay `data-entering` / `data-exiting` and interaction blocking (Context7 `/websites/react-aria_adobe`; checked 2026-10-24, scroll lock not stated in the fetched docs).
      - Playwright 1.64.1 request interception (`page.on("request")`) and `emulateMedia({ reducedMotion })`.
    - Documentation Reviewed:
      - `proof/tests/renderer-browser.test.tsx:232–450`: survival, tiers, disclosure and switch cases to carry over.
      - `proof/tests/host.test.ts:128–190`.
      - Spec §8, §11.
    - Options Considered:
      - Assert React Aria's internals (`usePreventScroll`) — rejected: tests observe behaviour, since another app's behaviour library must pass the same checks later (Phase 5).
    - Chosen Approach:
      - Behavioural browser tests on the real host, written so Phase 5 can lift them into the renderer suite.
    - API Notes and Examples:
      ```bash
      timeout 300s bun test proof/tests/renderer-browser.test.tsx proof/tests/host.test.ts proof/tests/switch.test.ts
      ```
    - Files to Create/Edit:
      - `proof/tests/renderer-browser.test.tsx`, `proof/tests/host.test.ts`: new cases.
      - `proof/GAPS.md`: measurements.
  - Test Cases to Write:
    - `three_interaction_tiers_end_to_end` (both systems).
    - `focus_scroll_local_state_and_disclosure_survive_rerender`.
    - `stale_revision_changes_nothing`.
    - `dialog_exit_animates_then_unmounts`; `open_dialog_locks_scroll_and_makes_background_inert`; `reduced_motion_skips_exit`.
    - `browser_shows_fallbacks_for_invalid_tree_and_throwing_node`.
    - `selection_rerender_cost_is_recorded` (records, asserts only that it ran).

- [ ] Task 9: Document the renderer for outsiders
  - Acceptance Criteria:
    - Functional:
      - `docs/renderer.md` covers:
        - `createRenderer` and the registry errors;
        - writing an implementation (`props`, `slot`, `style`, `emit`, `children`, `items`, `portal`) with the state-attribute table from `docs/styling.md`;
        - mounting `<Surface>` and building the arrival validator;
        - handling `onIntent` (complete intents; the host re-checks);
        - switching;
        - overlays and the lifecycle an implementation owes;
        - SSR and hydration, including the Task 6 throw path;
        - G20's code-point note for text inputs.
      - `docs/styling.md` "Renderer contract" and `docs/model.md` D2 point to it.
      - The skill references' "Today" sections (`renderer.md`, `architecture.md`) describe what shipped.
      - A docs example compiles: `src/__tests__/fixtures/renderer-guide.tsx`, run by a test, like `sdk-guide`.
    - Performance: n/a.
    - Code Quality: written for someone outside the repo; no plan or task references in `docs/`.
    - Security: the docs state laws 2 and 4 for hosts: send the manifest so the browser can re-check, and re-check every intent on dispatch.
  - Approach:
    - Skills to Use:
      - `karpathy-guidelines`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none beyond Tasks 2–8.
    - Documentation Reviewed:
      - `docs/sdk.md`, `docs/styling.md`, `src/__tests__/sdk-guide.test.ts` (the guide-test pattern).
    - Options Considered:
      - Fold into `docs/styling.md` — rejected: the renderer is its own subpath with its own audience.
    - Chosen Approach:
      - One guide plus a compiled example.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `docs/renderer.md`: new.
      - `docs/styling.md`, `docs/model.md`.
      - `.agents/skills/liveframe-execution/references/{renderer.md,architecture.md}`.
      - `src/__tests__/fixtures/renderer-guide.tsx`, `src/__tests__/renderer-guide.test.tsx`: new.
  - Test Cases to Write:
    - `renderer_guide_example_runs`: the guide's example renders server-side and matches the documented markup.

- [ ] Task 10: Hand the renderer cases to the conformance backlog
  - Acceptance Criteria:
    - Functional: the "Seed conformance suites from the proof tests" entry in `plans/backlog.md` names the cases a Phase 5 renderer suite reuses. It says which need a browser and which run against any app's implementations (tiers, survival, overlay lifecycle, scope and switching, fallbacks, intent completion, hydration):
      - `react-registry`, `react-surface`, `react-intents`, `react-ssr`;
      - `react-browser`;
      - the Task 8 cases.
    - Performance: n/a.
    - Code Quality: one updated entry, not a new one.
    - Security: n/a.
  - Approach:
    - Skills to Use:
      - `create-plan` (backlog format).
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/backlog.md` "Seed conformance suites from the proof tests"; plan 007 Task 11.
    - Options Considered:
      - n/a — required handoff.
    - Chosen Approach:
      - Update the entry in place.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/backlog.md`.
  - Test Cases to Write:
    - n/a — documentation.

- [ ] Task 11: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/008-impact-analysis.md` sweeps all twelve impact areas of the create-plan reference against what shipped, and records each one, or `None — <reason>`.
      - Every finding is presented to the owner in one table with a recommended disposition (`execute` or `backlog`), and the answer is recorded. Each `execute` finding becomes a task above this one and is executed. Each `backlog` finding goes to `plans/backlog.md` and Further Actions.
      - Known candidates to sweep:
        - hosts that cannot send a manifest to the browser;
        - `liveframe gen` emitting implementation prop types;
        - streaming SSR;
        - the overlay lifecycle if a behaviour library falls short;
        - the per-parent container rule if parity needed it;
        - the Task 8 cost measurements;
        - Synapta and Clay gaps;
        - "Carry the CSS overlay contract into the production renderer" (close it or narrow it).
    - Performance: confirm every Task 5, 7 and 8 measurement was recorded.
    - Code Quality: findings name files and spans.
    - Security: confirm laws 2 and 4 have a rejecting test on every new path.
  - Approach:
    - Skills to Use:
      - `create-plan` (final task), `graft` — check the delivered surface.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/evidence/007-impact-analysis.md`: the format.
    - Options Considered:
      - n/a — required by the create-plan skill.
    - Chosen Approach:
      - Sweep, present, dispose.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/008-impact-analysis.md`: new.
      - `plans/backlog.md`, this plan's Compromises Made and Further Actions, `roadmap.md` §3.
  - Test Cases to Write:
    - n/a — analysis.

## Verification (whole plan)

- `timeout 600s bunx playwright install chromium` (once per machine)
- `timeout 600s bun run check`
- `timeout 300s bun test src/__tests__/react-`
- `timeout 300s bun test proof/tests/`
- `timeout 120s bun test src/__tests__/css-scope-browser.test.ts proof/tests/switch.test.ts`
- `timeout 600s bun proof/scripts/parity.ts --out evidence/parity`
- `timeout 120s graft build`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
