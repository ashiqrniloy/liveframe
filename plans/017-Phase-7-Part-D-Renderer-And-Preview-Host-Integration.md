# Phase 7 Part D: Renderer and Preview Host Integration

Depends on: [plan 016](016-Phase-7-Part-C-Styling-Paint-Alpha-Contrast-And-Native-Parts.md) complete. [Plan 015](015-Phase-7-Part-B-Events-Manifests-Capabilities-And-State.md) supplies the numeric and object carries and `bindAll`, which `checkOffered` must understand.

## Objectives

- Let a host check that the served tree offered an intent: `onIntent(intent, origin)` and `checkOffered(tree, origin, intent, validator)` (LF-01), on `<Surface>`, `<Preview>` and `createPreview().intent()`.
- Give primitives the resolved action metadata (`confirm`, `irreversible`), and let the host enforce confirmation in one place through `<Surface confirm>` (LF-08).
- Give the host a hook on `<Surface>`'s wrapper and portal container, with a portal default that adds no layout box (CL-02).
- Let the host turn translucency off for a scope: `transparency="reduced"` (CL-09).
- Make `<Preview>` safe for in-memory routers and for two previews on one page, and stop it inferring which scenario a result belongs to (CL-01).
- Generate implementation types for JSON-loaded catalogs (the backlog item Clay raises).

## Expected Outcome

- A forged or stale intent is rejected by `checkOffered` with a typed error. The renderer guide's host example uses it, and the conformance renderer suite records `origin` alongside intents.
- `implement()` receives `events` metadata. With `confirm` supplied, an unconfirmed `confirm: true` action never reaches `onIntent`.
- `wrapperProps` and `portalProps` add a host class and style without overriding the library's scope attributes. In a CSS grid the portal takes no track, while overlays still resolve the surface's variables.
- `transparency="reduced"` disables `backdrop-filter` and forces alpha 1 on the wrapper and portal, without transitions.
- A controlled `<Preview>` never touches `location`. Two uncontrolled previews with different `urlKey`s coexist. Results are labelled by `resultScenario`, never inferred. Capture still passes.
- `liveframe gen --implementations` (or Task 7's chosen form) emits literal definitions, so `implement()` infers props, slots and events from a JSON catalog.

This plan implements spec §6.4 (preferences, switching), §7.5 (`<Preview>`, sessions), §8 (interaction tiers) and §11 (renderer, overlays), plus capabilities in §7.3. The `<Preview>` prop change (CL-01) is a 0.2.0 breaking change named in plan 014 Task 1's log. Every other change is additive. Primitive implementations stay the app's: the library ships none.

## Tasks

- [x] Task 1: Record the renderer and preview contract decisions
  - Acceptance Criteria:
    - Functional: an accepted decision log settles each open question.
      - **LF-01:**
        - `origin = { surfaceId, revision, nodeId, event }`;
        - `checkOffered` lives in the root export (host-API-free, beside the validator);
        - its rule: `surfaceId` and `revision` match, the node exists, `events[event]` exists, and the completed intent equals the offered one except for the fields completion fills. Those are the `bind` argument, the `bindAll` object's keys, or the `setState` value. The filled values must also satisfy their schemas.
      - **LF-08:**
        - the `events` map shape on `ImplementationProps` and `Item`: `{ [event]: { type, confirm, irreversible } }`, with no argument values;
        - where the renderer reads the metadata: a read-only `actions` view on `CompiledValidator`, or a new `capabilities` prop;
        - `<Surface confirm={(intent, meta) => Promise<boolean>}>` semantics: what happens on rejection or throw (nothing is raised), concurrent emits while a confirm is pending, and `irreversible` without `confirm`.
      - **CL-02:**
        - merge rules: the host `className` is appended, and the host `style` cannot set scope attributes, which stay the library's;
        - the portal default. Compare `display: contents` (no box, still a DOM ancestor, so custom properties inherit, but it cannot be a size container for `lf_container`) with `position: fixed; inset: 0; pointer-events: none`, which keeps a box sized to the viewport.
        - Record the consequence for responsive values inside overlays, and spec §11's backdrop rule ("no backdrop ancestor may set opacity below 1 or a filter").
      - **CL-09:** `transparency?: "auto" | "reduced"`; the attribute `data-lf-transparency="reduced"` on the wrapper and portal; switching reuses the `data-lf-switching` sequence.
      - **CL-01:**
        - controlled `selection?: PreviewCell`, so the URL is neither read nor written;
        - `urlKey?: string`, the key prefix for uncontrolled mode (default: today's bare keys, for capture);
        - `resultScenario: string`, required, so the result's scenario is never inferred;
        - how capture addresses a prefixed preview;
        - migration notes for the breaking prop.
      - **JSON-catalog implementation types:** the generator form. Options: `liveframe gen --implementations` emitting `as const` definitions, or extending the existing module. Either keeps drift checks and type-level rejection tests and imports no SDK into `/react`.
    - Performance: n/a — a decision only.
    - Code Quality: one log.
    - Security:
      - Law 4 — `origin` and `checkOffered` strengthen the host check. `confirm` is UI convenience and never replaces the host's re-check on dispatch; the log says so.
      - Law 1 — `wrapperProps` carry host data only, never widget data.
  - Approach:
    - Skills to Use:
      - `create-decision-log`.
      - `find-docs`: React 19 (`useSyncExternalStore` and controlled-versus-uncontrolled patterns, if used); MDN `display: contents` (accessibility and containment); React Router in-memory history (Clay's evidence).
    - Library Documentation to Check Before Implementation:
      - React 19 component docs; MDN `display: contents`, `container-type` and `position: fixed` containing blocks.
    - Documentation Reviewed:
      - Spec §11 (whole) and §7.5 (`<Preview>`, capture).
      - `src/react/renderer.tsx:15-23` (`SurfaceProps`), `:62-78` (`complete`), `:148-167` (switching), `:187-195` (`emit`), `:219-227` (wrapper and portal).
      - `src/react/implement.ts:20-35`.
      - `src/preview/react/preview.tsx:6-24,42-57,66-96`.
      - `src/preview/session.ts:50-92`.
      - `src/cli/capture.ts:85-95` (scenario is set through the URL).
      - `src/css/base.ts:32`.
    - Options Considered:
      - `result: { scenario, value }` (CL-01's first form) — the log compares it with `resultScenario`. Both break the props, so pick the smaller diff for hosts.
      - Keeping inference when `resultScenario` is absent — rejected: inference is the bug.
    - Chosen Approach:
      - One log for the renderer and preview contracts.
    - API Notes and Examples:
      ```tsx
      <Surface … onIntent={(intent, origin) => send({ intent, origin })} confirm={approve} transparency={tier === "opaque" ? "reduced" : "auto"}
               wrapperProps={{ className: styles.body }} portalProps={{ className: styles.overlays }} />
      // backend
      const offered = checkOffered(servedTree, origin, intent, validator); if (!offered.ok) return reject(offered.errors);
      ```
    - Files to Create/Edit:
      - `decision-logs/<date>-renderer-and-preview-host-integration.md` (new)
  - Test Cases to Write:
    - None. The decision log is the record.
  - Notes (executed 2026-10-28):
    - Recorded the [approved renderer and preview contracts](../decision-logs/2026-10-28-1756-renderer-and-preview-host-integration.md). The owner chose four contested points, each the recommended option: the portal default (`position: fixed; inset: 0; pointer-events: none`), an internal validator accessor for the metadata, single-flight confirmation gated on `confirm` only, and a required `resultScenario` prop. The log says the listed decisions were approved by the request plus non-objection, not by a separate "approve as listed" answer.
    - `checkOffered` uses existing error kinds (`version-conflict`, `not-found`, `undeclared-event`, `invalid-prop`), with no new kind. `complete()` moves to `src/validate/complete.ts` and both sides import it. `createPreview().intent(intent, origin?)` checks only when `origin` is supplied; `<Preview>` always supplies it.
    - The fixed portal keeps `lf_container` working, so responsive overlay content resolves against the **viewport** width instead of the old block `div`'s host-dependent width. This is a documented behaviour change; Task 4 now tests and documents it, along with the host-ancestor `transform`/`filter`/`contain` caveat and the spec §11 backdrop rule.
    - Capture: `data-lf-preview` gains `urlKey` or `controlled: true`. A controlled page captures only the scenario it shows, and asking for another raises a typed `not-found`. Task 6 now includes this.
    - Task 7's form is a separate `--implementations` output file with its own `--check`, so `/react` stays free of SDK imports.
    - Documentation: MDN via `ctx7` (`/mdn/content`) confirmed `display: contents` removes the box, which is why it was rejected. No runtime, schema, spec or doc changes in this decision-only task.

- [x] Task 2: Report an intent's origin and check it was offered (LF-01)
  - Acceptance Criteria:
    - Functional:
      - `onIntent(intent, origin)` receives `origin` with the right `nodeId` and `event` for nested, collection (`items[i].emit`) and portal-rendered nodes. One-argument callbacks keep working.
      - `checkOffered(tree, origin, intent, validator): Result<void>` rejects each of the following with a typed error and pointer:
        - a wrong `surfaceId` or `revision`;
        - an unknown node;
        - an undeclared event;
        - changed literal args;
        - a filled argument other than `bind`, or keys outside the `bindAll` schema;
        - a `setState` key that differs from the offered one;
        - a filled value that fails its schema.
      - It accepts every schema-valid intent the renderer produced in the existing intent tests. The intentionally invalid completed values in `host_must_recheck_filled_arguments` and the numeric/object bound tests remain rejected at the host boundary.
      - `<Preview>`'s `onIntent` and `createPreview().intent(intent, origin?)` carry and apply the same check: the session rejects a non-offered intent.
      - The conformance renderer suite records `origin` with each intent.
      - `docs/renderer.md` § "Handle intents at the host boundary" uses `checkOffered`.
    - Performance: The first `checkOffered` call validates and indexes the tree in O(nodes); later calls reuse validation per tree/validator pair and the id map per tree, with no whole-tree walk. Intent payload validation still applies. Render bench non-regression.
    - Code Quality: `checkOffered` reuses the intent completion rule. Move `complete()` from `src/react/renderer.tsx:62-78` to a host-API-free module, `src/validate/complete.ts`, that both `/react` and the root import. `graft callers complete` lists the callers.
    - Security: law 4 — this closes the forged-intent path that manifest checks alone leave open. Unknown or mismatched origins fail closed.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (renderer behaviour chore).
      - `safe-refactor`: moving `complete()`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Task 1's log; the renderer and preview files in Task 1.
      - `src/__tests__/react-intents.test.tsx`; `src/conformance/react/*`.
    - Options Considered:
      - See Task 1.
    - Chosen Approach:
      - As decided in Task 1, with the [explicit validator argument approved during execution](../decision-logs/2026-10-28-1935-check-offered-explicit-validator.md). JSON trees contain no schemas, so the host supplies its compiled validator. Trees are immutable; the first call validates and indexes them, and later calls reuse that context.
    - API Notes and Examples:
      ```ts
      export function checkOffered(tree: UiTree, origin: IntentOrigin, intent: Intent, validator: CompiledValidator): Result<void>;
      ```
    - Files to Create/Edit:
      - `src/validate/complete.ts` (new); `src/validate/offered.ts` (new); `src/validate/compile.ts`; `src/formats/tree.ts`; `src/index.ts`
      - `src/react/renderer.tsx`; `src/preview/react/preview.tsx`; `src/preview/session.ts`; `src/preview/authoring.ts`; `src/preview/index.ts` (types)
      - `src/conformance/react/*`
      - `src/__tests__/exports.test.ts`; `src/__tests__/offered.test.ts` (new); intent, preview/session, browser and compiled-guide tests/fixtures
      - `examples/demo-host/*` (uses it); `proof/host/*` (if it handles intents)
      - `docs/spec.md` §8/§11/§7.5; `docs/renderer.md`; `docs/preview.md`; `docs/conformance.md`; `examples/demo-host/README.md`
  - Test Cases to Write:
    - `origin_for_nested_and_collection_nodes` (`react-intents.test.tsx`); `origin_for_portal_nodes_uses_the_accepted_revision` (`react-browser.test.tsx`).
    - `check_offered_rejects_each_forgery`: one case per rejection.
    - Existing intent tests check valid renderer output through `checkOffered`; `check_offered_caches_validation_and_accepts_json_transport` proves explicit context works across JSON transport.
    - `session_rejects_unoffered_and_stale_intents_without_mutation` and `session_rejects_unoffered_action_without_logging_it` (`preview-session.test.ts`).
    - The conformance browser interaction case records `{ intent, origin }` emissions and checks each with `checkOffered`; preview browser coverage asserts the forwarded origin.
    - `queued_intent_keeps_its_origin_and_is_rejected_after_a_revision_change` (`proof/tests/host.test.ts`); the demo host rejects stale and wrong-node origins.

  - Notes (executed 2026-10-28):
    - Added root-exported `IntentOrigin` and `checkOffered(tree, origin, intent, validator)`. The owner explicitly approved the fourth argument because transported trees contain no schemas; the [superseding decision](../decision-logs/2026-10-28-1935-check-offered-explicit-validator.md) records the evidence and alternative. The original Task 1 log remains historical.
    - Moved `complete()` unchanged to the host-API-free validator layer. The helper uses it to preserve literal intent fields, allows only declared completion fields, and checks completed state/action values plus event schemas. Origins, unknown nodes/events, uncompleted markers, extra arguments and invalid values fail closed with existing typed errors and pointers. It validates once per immutable tree/validator pair and indexes node ids once per tree. JSON-transport and cache tests cover the explicit schema context.
    - Renderer callbacks capture the accepted tree's identity/revision and the emitting node/event, including nested collection items and portals; origins are frozen. One-argument callbacks remain valid. Preview forwards the origin, sessions optionally check it without changing legacy origin-free calls, and both reference hosts carry the captured origin through transport. The demo checks its last served snapshot instead of rendering a new revision before dispatch. Conformance records `{ intent, origin }` through `emissions()`, retains `intents()` compatibility, and checks every interaction emission.
    - Synced spec §§7.5/8/11 and renderer, preview, conformance and demo-host docs. The known intentionally schema-invalid renderer-output tests still produce their original intents, which the host correctly rejects; the acceptance criterion now says schema-valid output.
    - Integration finding: blur and click can emit twice from one revision. The queued second intent must remain stale rather than having its revision rewritten. Added a deterministic browser regression proving rejection, documented the retry requirement, and separated draft commit from the happy-path button test. Later confirmation work must likewise retain the original origin (as Task 1 already decided).
    - Verification: `bun run check` passed (768 pass, 4 existing skips, 0 fail); `bun run demo:test` passed against the packed archive (52 pass); the render bench passed at 1.81–2.51 µs/node (agent-home 1.64 ms). The unchanged switch timing gate passed at 8.5 ms. Earlier full runs hit the 100 ms runner limit and isolated 17.6/17.8 ms switch spikes; the unchanged final run passed, and no limits were relaxed.
    - The broader `bun run bench` stopped at standalone validator timing gates. An isolated archive of pre-task commit `0a2144f` also failed those gates (core-queue large/full 1.551/1.536 µs/node against 1.5). No validator hot-path or timing-budget change was made for this task; the task's render bench passed. Whole-plan release verification remains for Task 8.

- [x] Task 3: Mark irreversible actions and expose confirmation metadata to primitives (LF-08)
  - Acceptance Criteria:
    - Functional:
      - Capability actions accept optional `irreversible: boolean`, covered by the format and JSON Schema tests.
      - `implement()` receives `events: { [event]: { type, confirm, irreversible } }` for its node, and each `items[i]` carries its own, including nested and collection nodes. `setState` events report `type: "setState"` with `confirm: false` and `irreversible: false`.
      - With `<Surface confirm>`:
        - the renderer awaits it before `onIntent` for `confirm: true` actions;
        - `false`, a rejection or a throw raises nothing;
        - concurrency follows Task 1.
      - Without `confirm`, behaviour is unchanged.
      - `docs/renderer.md` repeats that the host still re-checks on dispatch.
    - Performance: the metadata is built once per accepted tree, inside the existing `useMemo` (`src/react/renderer.tsx:168-218`). Render bench non-regression.
    - Code Quality: the metadata comes from the internal validator accessor Task 1 chose. No argument values, action names or `meta` reach implementations. `confirm` is single-flight per surface and gates on `confirm` only; `irreversible` is metadata.
    - Security: law 4 — confirmation is enforced in the renderer for convenience, and the host remains authoritative.
  - Approach:
    - Skills to Use:
      - `typescript-advanced-types`: the `events` type keyed by the definition's events.
    - Library Documentation to Check Before Implementation:
      - React 19 (async handlers in event callbacks; no Suspense needed).
    - Documentation Reviewed:
      - `src/formats/capabilities.ts:17`; `src/validate/compile.ts` (`CompiledValidator`); `src/react/implement.ts:27-35`.
      - React 19 cleanup guidance, fetched through Context7 `/reactjs/react.dev`: [ignoring stale asynchronous results](https://react.dev/learn/synchronizing-with-effects), including Strict Mode setup/cleanup.
    - Options Considered:
      - See Task 1.
    - Chosen Approach:
      - As decided in Task 1.
    - API Notes and Examples:
      ```tsx
      implement(Button, ({ emit, events, slot }) => <button className={slot("root")} data-irreversible={events.onPress?.irreversible || undefined} onClick={() => emit("onPress")} />);
      ```
    - Files to Create/Edit:
      - `src/formats/capabilities.ts`; `schemas/capabilities.json`
      - `src/validate/compile.ts` (internal WeakMap accessor beside `buildFacts`, per Task 1; not on the public `CompiledValidator` type); `src/react/renderer.tsx`; `src/react/implement.ts`
      - The proof `button` implementation (demonstrates the label); `src/conformance/react/*` (if the suite records metadata)
      - `src/__tests__/schemas.test.ts`; `react-intents.test.tsx`; `react-types.test.tsx`; `react-browser.test.tsx`; `fixtures/confirmation.tsx` (new); `fixtures/react-client.tsx`; `proof/tests/renderer.test.tsx`; `proof/tests/fixtures/renderer-client.tsx` (instrument the compiled validator without copying away its identity)
      - `docs/spec.md` §7.3/§11; `docs/renderer.md`; `docs/formats.md`
  - Test Cases to Write:
    - `events_metadata_reaches_nested_and_collection_nodes`.
    - `unconfirmed_action_never_reaches_on_intent_and_confirm_throw_raises_nothing` (browser): false, rejection, throw, lock release and no-hook compatibility.
    - `confirmation_is_single_flight_preserves_origin_and_drops_after_unmount` (browser, Strict Mode): further confirmation emits are dropped across revisions, unrelated actions and state emit immediately, approval retains the original origin, and unmount discards approval.
    - `irreversible_in_capabilities_schema` (`schemas.test.ts`).
    - `events_type_keyed_by_definition` (type-level).
    - `proof_button_labels_irreversible_actions`: visible label and presence attribute match the action metadata.
    - Existing `retained_tree_still_passes_surface_arrival_validation`: metadata uses the validator paired with the accepted tree during validator replacement, so a rejected arrival still renders fallback.

  - Notes (executed 2026-10-29):
    - Added optional boolean `irreversible` to capabilities and regenerated the published schema. Format/schema tests accept both booleans independently of `confirm` and reject non-booleans with the field pointer.
    - Added the internal WeakMap-backed action metadata accessor beside `buildFacts`; no public validator property or export was added. The renderer builds frozen, definition-keyed `events` metadata inside its existing tree memo for every node and collection item. Only `type`, `confirm` and `irreversible` reach implementations; state events report both flags false. Metadata is read from the validator paired with the accepted tree, preserving Preview's fallback during validator replacement. The two instrumentation fixtures now wrap the compiled validator in place instead of copying away its identity.
    - Added optional `<Surface confirm>` with single-flight confirmation per surface. False, rejection and throw cancel emission; unrelated actions and state still emit. Approval retains the completed frozen intent and original origin across revisions, and approval after unmount is discarded. Browser tests exercise Strict Mode, cancellation, failure, lock release, concurrent emits, stale origins and no-hook compatibility. Type tests reject undeclared event keys and metadata mutation/access to private fields.
    - The proof button exposes `data-irreversible` and a visible “(irreversible)” label, covered by its server test. Synced spec §§7.3/11 and format/renderer docs, including the host's continued responsibility for offered-intent checks, argument validation, confirmation policy and authorisation. Conformance records no metadata, so its public fixture shape stays unchanged; existing conformance and Preview rejection tests pass.
    - Verification: `bun run check` passed (774 pass, 4 existing skips, 0 fail); `bun --conditions liveframe:source bench/render.bench.ts` passed at 1.837–2.363 µs/node, with agent-home at 1.454 ms. Final switch gates passed at 7.1 ms (agent-home) and 6.0 ms (git-status). An earlier run saw an 18.5 ms switch spike; no timing limit was changed. The benchmark's validation split still exceeds its reserved 1.5 µs/node on some workloads, matching the existing validator-performance backlog; this task does not change validation hot-path checks. Whole-plan demo/release gates remain for Task 8.

- [x] Task 4: Give the host a hook on the wrapper and portal container (CL-02)
  - Acceptance Criteria:
    - Functional:
      - `wrapperProps` and `portalProps` (`{ className?, style? }`) apply as Task 1 decided:
        - `lf_surface`, `lf_container` and every `data-lf-*` attribute survive a host `className`;
        - the host cannot override scope attributes.
      - The portal default from Task 1 is emitted by the base sheet, not inline, so a host class can still change it: `:where([data-lf-portal]){position:fixed;inset:0;pointer-events:none}` and `:where([data-lf-portal])>*{pointer-events:auto}`.
      - A browser test shows an overlay's responsive value resolves against the viewport width (the Task 1 consequence), and that clicks reach overlay content despite `pointer-events:none` on the portal. `docs/renderer.md` records that consequence, the host-ancestor `transform`/`filter`/`contain` caveat, and the spec §11 backdrop rule for host classes.
      - A browser test in a CSS grid shows the portal takes no track, and that an open overlay still resolves the surface's theme and design-system variables.
      - The switching test covers both containers carrying host classes.
    - Performance: n/a — props merge. Switch timing is unchanged.
    - Code Quality: one `mergeHostProps(scope, host)` helper in `src/react/renderer.tsx`.
    - Security: law 3 — host styles come from the host's own CSS, not from widget data. A test shows a tree cannot set either prop.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (renderer browser tests; the overlay contract).
    - Library Documentation to Check Before Implementation:
      - MDN `display: contents`, or `position: fixed`, per Task 1.
    - Documentation Reviewed:
      - `src/react/renderer.tsx:219-227`; `src/css/base.ts`; `src/__tests__/react-browser.test.tsx`; `src/__tests__/css-scope-browser.test.ts`.
      - MDN via Context7 `/mdn/content`: fixed containing blocks, `container-type: inline-size` containment and descendant `pointer-events: auto` under a `none` ancestor.
    - Options Considered:
      - See Task 1.
    - Chosen Approach:
      - As decided in Task 1.
    - API Notes and Examples:
      ```tsx
      <Surface … wrapperProps={{ className: "body", style: { blockSize: "100%", minBlockSize: 0 } }} />
      ```
    - Files to Create/Edit:
      - `src/react/renderer.tsx`; `src/css/base.ts`
      - `src/__tests__/react-surface.test.tsx`, `react-browser.test.tsx`
      - `src/__tests__/fixtures/react-client.tsx` (host-class switching and responsive overlay fixture); `src/__tests__/css-theme.test.ts` (base rules emitted once)
      - `docs/spec.md` §11; `docs/renderer.md`
  - Test Cases to Write:
    - `host_class_appended_scope_survives` (`react-surface.test.tsx`).
    - `portal_takes_no_grid_track` (`react-browser.test.tsx`).
    - `overlay_resolves_scope_variables_with_host_classes`.
    - `switching_with_host_classes`.
    - `overlay_responsive_value_tracks_viewport` and `overlay_content_receives_pointer_events` (`react-browser.test.tsx`).
  - Notes (executed 2026-10-29):
    - Added host-only `wrapperProps` and `portalProps` accepting `className` and React `style`, applied by one `mergeHostProps` helper. Classes append to the library classes; other host fields are ignored, so scope attributes, children and the portal marker remain library-owned. Widget trees cannot supply the hooks.
    - The base sheet emits the approved fixed/inset/pointer-events portal rules once. Browser coverage proves the portal takes no grid track, stays viewport-sized inside a 300 px host, keeps responsive containment and scope variables, receives overlay clicks and lets clicks through when empty. A host class can override the defaults. Existing overlay, switching, focus and hydration tests now exercise host classes.
    - Updated spec §11 and the renderer guide with the hooks, viewport-width responsive overlay behavior, transformed/filtered/contained ancestor caveat and the backdrop opacity/filter rule. No new decision or dependency was needed; Task 1's approved contract is unchanged.
    - Verification: the new merge and base-sheet assertions failed before implementation; focused surface/browser tests then passed (28 pass). `bun run check` passed (778 pass, 4 existing skips, 0 fail), including build, generated-file drift, typecheck, lint, formatting and all tests. The first full run hit the five-minute command timeout without a test failure; the completed rerun used a ten-minute limit. Whole-plan bench, demo and release gates remain for Task 8.

- [ ] Task 5: Let the host reduce transparency for a scope (CL-09)
  - Acceptance Criteria:
    - Functional:
      - The base sheet applies the reduced-transparency overrides under `:where([data-lf-transparency="reduced"])`, emitted once, byte-stable, next to the existing media query (`src/css/base.ts:32`).
      - `<Surface transparency="reduced">` sets the attribute on the wrapper and portal together.
      - A browser test shows `backdrop-filter: none` and alpha 1 on a recipe with `backdropBlur` and `backgroundOpacity`, including inside an open portal overlay.
      - **Amended by plan 016 Task 7 (F2).** LF-11 does not route its modifier through `--lf-alpha`: a `{ role, alpha }` colour projects `color-mix(in oklab, var(--lf-c-…) N%, transparent)` with a literal percentage, and the design-system sheet restores the unmodified role reference only inside `@media (prefers-reduced-transparency:reduce)` (`src/css/design-system.ts`, the `reduced` list; spec §6.4 "Preferences and switching"). The attribute must give the same result as the media query for every recipe colour, shadow layer and native-part colour (`placeholderColor`, `scrollbar*Color`), including alpha 0, while intrinsic theme alpha and explicit `none` stay unchanged. The task must therefore also emit those recovery rules under the attribute for design systems that use a modifier, byte-stable, and decide the selector form (the attribute sits on the wrapper that carries `data-lf-ds`, and on the portal). A browser test proves a `borderColor`, `textColor`, shadow and `placeholderColor` modifier, including alpha 0, recover under `transparency="reduced"` with the OS preference off.
      - Changing the prop runs the `data-lf-switching` sequence, so no transition plays.
    - Performance: the base sheet gains no per-design-system rule. A design system gains attribute recovery rules only for slots that use an alpha modifier, so one without modifiers is byte-identical. Record the Certified and Rack sheet sizes before and after (`bun bench/css.bench.ts`). Switch timing is unchanged.
    - Code Quality: the switching effect (`src/react/renderer.tsx:148-167`) gains `transparency` in its scope identity. There is no second effect.
    - Security: n/a — a preference only. Law 3 is untouched.
  - Approach:
    - Skills to Use:
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Spec §6.4 "Preferences and switching"; `src/__tests__/css-browser.test.ts`.
    - Options Considered:
      - Host CSS that sets `--lf-alpha` — rejected by CL-09: `backdrop-filter` lives in recipe rules.
    - Chosen Approach:
      - An attribute, as CL-09 proposes.
    - API Notes and Examples:
      ```css
      :where([data-lf-transparency="reduced"]) *{--lf-alpha:1 !important;backdrop-filter:none !important}
      ```
    - Files to Create/Edit:
      - `src/css/base.ts`; `src/css/surface.ts` (if attributes are built there); `src/react/renderer.tsx`
      - `docs/spec.md` §6.4/§11; `docs/styling.md`; `docs/renderer.md`
  - Test Cases to Write:
    - `base_sheet_has_transparency_attribute_rule_once` (`css-*.test.ts`).
    - `attribute_recovers_alpha_modifiers_like_the_media_query` (`css-design-system.test.ts`): the attribute rules carry the same declarations as the media block; fails if only the media query is extended.
    - `reduced_transparency_prop_in_portal` (`react-browser.test.tsx`).
    - `transparency_switch_suppresses_transitions`.

- [ ] Task 6: Make `<Preview>` safe for in-memory routers and multiple previews (CL-01)
  - Acceptance Criteria:
    - Functional:
      - With `selection` supplied, `<Preview>` neither reads nor writes `location`, and `location.href` is unchanged across selections.
      - Without it, URL sync works under `urlKey`. Two uncontrolled previews with different `urlKey`s and different selections do not change each other.
      - `resultScenario` labels each result. A first result for scenario A, with the URL naming B, is never shown or retained as B's, and the "last good render" map is keyed by `resultScenario` only.
      - `data-lf-preview` publishes the `urlKey` (uncontrolled) or `controlled: true`, so `capture()` sets the prefixed key `<urlKey>.scenario`. For a controlled page it captures only the scenario shown and raises a typed `CaptureError("not-found")` for any other requested scenario.
      - An invalid controlled coordinate falls back to the first value of its axis.
      - `liveframe preview capture` and MCP `capture_preview` still pass against the uncontrolled default.
      - The demo host and proof host are updated.
      - `docs/preview.md` gains a migration note.
    - Performance: n/a.
    - Code Quality:
      - The mount-time URL read (`src/preview/react/preview.tsx:66-84`) and the write (`:86-92`) run only in uncontrolled mode.
      - The `received` bookkeeping (`:48-57`) keys on `resultScenario`.
    - Security: n/a — law 1 is untouched: trees only.
  - Approach:
    - Skills to Use:
      - `surgical-patch`.
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - React 19 controlled-component guidance.
    - Documentation Reviewed:
      - The `<Preview>` lines above; `src/cli/capture.ts:85-95`; `src/__tests__/preview-react.test.tsx`; `proof/tests/preview-browser.test.ts`.
    - Options Considered:
      - See Task 1.
    - Chosen Approach:
      - As decided in Task 1.
    - API Notes and Examples:
      ```tsx
      <Preview … selection={cell} onSelect={setCell} result={result} resultScenario={rendered} />
      ```
    - Files to Create/Edit:
      - `src/preview/react/preview.tsx`; `src/cli/capture.ts`
      - `examples/demo-host/*`; `proof/host/*`
      - `src/__tests__/preview-react.test.tsx`; `proof/tests/preview-browser.test.ts`
      - `docs/spec.md` §7.5; `docs/preview.md`; `CHANGELOG.md`
  - Test Cases to Write:
    - `two_previews_with_url_keys_are_independent` (browser).
    - `controlled_preview_leaves_location_unchanged`.
    - `first_result_never_relabelled`.
    - `capture_with_url_key` (`cli-capture`/`preview-browser`).
    - `capture_controlled_preview_rejects_other_scenario`.

- [ ] Task 7: Generate implementation types for JSON-loaded catalogs (backlog)
  - Acceptance Criteria:
    - Functional:
      - `--implementations` (Task 1) writes a second, separate file of literal (`as const`) definitions for a JSON catalog. With them, `implement()` infers props, slot names and event names, and the value types for numeric and object carries.
      - `--check` detects drift.
      - A type-level test shows a wrong prop, slot or event fails to compile with the generated definitions.
      - The backlog entry is closed with a resolution.
    - Performance: n/a — codegen.
    - Code Quality: the generator stays in `src/sdk/gen.ts` (or a sibling); `/react` imports nothing from `/sdk`.
    - Security: n/a.
  - Approach:
    - Skills to Use:
      - `typescript-advanced-types`.
    - Library Documentation to Check Before Implementation:
      - TypeScript 7 `as const` and declaration emit for large literal objects.
    - Documentation Reviewed:
      - Backlog "Evaluate generated implementation types for JSON-loaded catalogs"; `src/react/implement.ts:4-18`; `src/sdk/gen.ts`.
    - Options Considered:
      - See Task 1.
    - Chosen Approach:
      - As decided in Task 1.
    - API Notes and Examples:
      ```sh
      liveframe gen catalog.json --implementations --out src/ui.definitions.gen.ts --check
      ```
    - Files to Create/Edit:
      - `src/sdk/gen.ts`; `src/cli/liveframe.ts`
      - `src/__tests__/sdk-gen.test.ts`, `react-types.test.tsx`
      - A fixture output under `src/__tests__/fixtures/widgets/`; `package.json` `gen:check` (add the second check)
      - `docs/sdk.md`; `docs/renderer.md`; `docs/spec.md` §7.2/§13 (CLI line); `plans/backlog.md`
  - Test Cases to Write:
    - `gen_implementations_literal_and_drift_checked`.
    - `generated_definitions_reject_wrong_prop_slot_event` (type-level).

- [ ] Task 8: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/017-impact-analysis.md` records all 12 areas, especially area 6 (Interaction tiers) and area 3 (law 4).
      - Findings are presented to the owner and disposed of.
    - Performance: record the render bench and switch timing.
    - Code Quality: n/a.
    - Security: confirm that no intent reaches `onIntent` without completion through the shared `complete()`.
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
      - `plans/evidence/017-impact-analysis.md` (new); `plans/backlog.md`; this plan.
  - Test Cases to Write:
    - None.

## Verification (whole plan)
- `bun run check`
- `bun run bench`
- `bun run demo:test`
- `bun run release:gate`

## Compromises Made
- To be filled after tasks are completed and tests pass.

## Further Actions
- To be filled after task completion with improvements, rationale, and priority.
