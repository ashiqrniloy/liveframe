# Phase 0: Primitive-Set Proof

## Objectives

- Prove or disprove the spec's central claim: a small primitive set, plus recipes and style props, can express real product UI with no product-shaped components (spec §12).
- Find the real primitive list, the style props it needs, and the gaps, before any library code is built.

## Expected Outcome

- Four reference UIs, built as TSX widgets on candidate primitives only, render in a local harness:
  1. Synapta's agent-home queue
  2. `core.queue` at four sizes
  3. Clay's git status panel and a Rack module panel
  4. a design-system switch
- Synapta's agent-home queue matches the approved Certified artifact in a side-by-side pixel and DOM comparison. Every deviation is listed.
- All three interaction tiers work: local, `setState` (re-run), and actions.
- `proof/REPORT.md` holds:
  - the final primitive list with definitions
  - the style props needed
  - the gaps and how each was resolved
  - a go/no-go
- `docs/spec.md` is updated with what the proof changed.

This plan implements roadmap Phase 0 and spec §12, using spec §5–§9 as the model under test. Everything it builds lives in `proof/`: proof-grade, never published, never imported by `src/`. It ships no library code, no `package.json` export, no version bump and no outsider docs; Phases 1–4 build the real formats, SDK, CSS projection and renderer.

Source material lives in two sibling repos, read-only:
- `/home/arn/Projects/synapta-core`, at `91de29ed` when this plan was written
- `/home/arn/Projects/clay`, at `adc7f64c`

The executor copies what is needed into `proof/references/` and records the commits actually used.

Sources checked on 2026-10-21:
- Both pinned commits still exist. Synapta is now at `88468a9b` and Clay at `7770d18c`, but every file this plan names is byte-identical between its pin and HEAD (`git diff --stat <pin> HEAD -- <paths>` is empty).
- Exact anchors in `agent-home-certified.html`, which tighten spec §12's approximate ranges:
  - the `core.queue` section: 1137–1245
  - the focus cards: 1247–1320
  - the home states: 1324–1357
  - the escalate dialog: 1368–1383
  - the `.sdk-specimen[data-size]` rules: 1036–1047
- **Synapta has since built around the blocker with a bigger component.** In `plans/200.4`, the T4 split (line 21) and the T4b–T4e ruling (line 179) describe the blocker. T4b–T4d then closed it by growing `Queue`: a `layout` prop, a closed `focus` schema with up to four controls, and multi-chain paging, across catalogs `synapta-harness-3` → `-5`. That is the product-shaped route this proof tests against. The current `web/app/components/ui/queue.tsx` is therefore the baseline that `REPORT.md` compares against.
- Rack holds no colours and no typography (`packages/design-rack/docs/index.md` §2). Colour comes from a Clay content theme package, and typography is owned by the user. Spec §6.1, by contrast, puts typography roles in the theme.

## Tasks

- [x] Task 1: Snapshot the reference material
  - Acceptance Criteria:
    - Functional: `proof/references/` holds copies of every source the four UIs are judged against, and `proof/references/SOURCES.md` records each file's origin repo, path, commit SHA and line range:
      - from Synapta:
        - `design-artifacts/approved/agent-home-certified.html` (whole file; it is self-contained)
        - `web/app/styles/certified.css`
        - `product-modules/ui/core/widgets/queue/{widget.json,widget.tsx}`
        - `web/app/components/ui/queue.tsx` (the grown, product-shaped baseline)
        - from `plans/200.4-SdkComponentsRendererAndQueue.md`: the T4 split (line 21), the T4b–T4e ruling (line 179) and the T4b–T4d completion notes
      - from Clay:
        - `packages/git/src/status.ts`
        - `packages/design-rack/package.json` and `packages/design-rack/docs/index.md`
        - `packages/theme-modus-operandi/package.json` (Rack's content theme for the proof)
        - `crates/clay-server/src/shell/components.rs`
        - `frontend/src/sdui/registry.tsx` and `frontend/src/components/text.tsx` (how Clay draws the git panel's labels)
        - `design-artifacts/approved/apps-and-containers-rack/{index.html,theme.css,README.md}`: the Rack module reference. The module is the `agent-info` container at `index.html:1279–1323`.
        - `design-artifacts/approved/rack-kit-and-pages/{kit.html,kit.css,rack.css,theme.css}`: Rack's component kit, for recipe translation
    - Performance: n/a — copies only.
    - Code Quality: snapshots are verbatim. `SOURCES.md` is the only file written by hand. Nothing in `proof/` imports from the sibling repos.
    - Security: the snapshots hold synthetic data only. Confirm no secrets or tenant data are present (the approved artifact states its data is synthetic).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/proof.md`: the source list and proof rules.
      - `graft` (run in the Clay repo): locate the frontend code that draws the git status panel and a Rack module.
    - Library Documentation to Check Before Implementation:
      - None external. Read `docs/spec.md` §12 and the T4b note in Synapta's Plan 200.4.
    - Documentation Reviewed:
      - Spec §12, and the exact artifact anchors under "Sources checked" above.
      - Clay's `agent-info` module (`index.html:1279–1323`). It was chosen because it uses primitives alone and needs no editor or terminal primitive. Its parts:
        - a rail with a patch jack and an ordinal
        - a plate head with a glyph, a title, a badge and a close button
        - segmented tabs
        - file rows with status letters
        - a footer
        - a composer with a textarea and parameter chips (a state lamp, model, and effort pips)
    - Options Considered:
      - Reference the sibling repos by path at runtime: rejected. The proof would break when those repos move on, and evidence would not be reproducible.
      - Copy only excerpts: rejected for the artifact, which needs its own CSS to render for comparison.
    - Chosen Approach:
      - Verbatim copies plus a provenance file.
      - Exclude `proof/references/` from Biome so copied source stays verbatim; proof implementation remains checked.
    - API Notes and Examples:
      ```bash
      git -C /home/arn/Projects/synapta-core rev-parse HEAD
      git -C /home/arn/Projects/clay rev-parse HEAD
      ```
    - Files to Create/Edit:
      - `proof/references/**`: snapshots.
      - `proof/references/SOURCES.md`: provenance.
      - `biome.json`: exclude inert reference snapshots from lint and formatting.
      - `roadmap.md` §3: mark plan 001 in progress.
  - Test Cases to Write:
    - None in code. The check is that `SOURCES.md` lists every file in `proof/references/` with a SHA, verified by a small script in Task 2's test suite (`references_are_all_attributed`).
  - Notes (executed 2026-10-21):
    - Copied all 20 required files verbatim from committed blobs into `proof/references/{synapta-core,clay}/`, preserving source paths. `SOURCES.md` attributes every file with its origin repo/path, full commit SHA, inclusive line range and relevant anchors. The entire Synapta Plan 200.4 is retained, including the T4 split, ruling and T4b–T4d completion notes.
    - Actual commits: Synapta `fc6df4b3a68e117c10120276193717e7213b07bf`; Clay `7770d18cfa27d2c7c52417f95c40cd81f6228981`. All UI sources match the original plan pins. Only Synapta Plan 200.4 changed, adding T5/T6 completion notes outside the required T4 passages; the T4 anchors remain unchanged.
    - Confirmed the Certified artifact's synthetic-data/no-live-operations statements at lines 1115 and 1387, reviewed Clay's static example panel, and scanned all snapshots for credential literals and cross-repo imports. No secrets, live tenant records or cross-repo imports were found.
    - Biome excludes `proof/references/` so snapshot bytes are never linted or reformatted; proof implementation remains included. The existing root typecheck includes only `src/`. No dependencies, exports, runtime code or spec meaning changed.
    - Verification: `timeout 30s bun /tmp/liveframe-task1-verify.ts` passed (complete 20-file inventory and attribution, byte equality against `git show`, line ranges, required anchors, synthetic labels and credential/import scans). `timeout 300s bun run check` passed (typecheck, lint, formatting and 1 test). Verification used a temporary Bun script; the permanent `references_are_all_attributed` test remains Task 2's responsibility.

- [x] Task 2: Set up the proof workspace and define the candidate primitives
  - Acceptance Criteria:
    - Functional:
      - `proof/catalog/definitions.ts` defines the spec §5 candidates as data in the spec §5 shape (`kind`, `props`, `children`, `events`, `variants`, `slots`, `styleProps`, `a11y`):
        - layout: `box`, `stack`, `inline`, `grid`, `scroll`, `separator`
        - content: `text`, `heading`, `icon`, `image`, `link`
        - controls: `button`, `textField`, `select`, `checkbox`, `switch`
        - overlays: `menu` / `menuItem`, `popover`, `dialog`, `tooltip`
        - navigation: `tabs` / `tab`
      - Style props follow spec §6.3.
      - `proof/tsconfig.json` typechecks the proof with `jsx: react-jsx`.
      - `bun run check` covers `proof/` (typecheck, lint, format, tests).
    - Performance: n/a.
    - Code Quality:
      - No product-shaped kind (queue, card, metric, frame) appears in the catalog.
      - Definitions are plain data with no functions.
    - Security: definitions admit no function props, no `className`, no `style` string and no colour-typed prop (law 3).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/formats.md` and `references/proof.md`.
      - `typescript-advanced-types`: prop types derived from the definitions for Task 4's SDK.
    - Library Documentation to Check Before Implementation:
      - TypeScript 7.0 `tsconfig` `jsx` / `jsxImportSource` options, via `find-docs`.
      - Bun 1.4 test runner (`bun test`) with a second tsconfig project.
    - Documentation Reviewed:
      - Spec §5, §6.3, §9.
      - Clay `ComponentKind` (snapshot), for the primitives Clay already has.
    - Options Considered:
      - Start from Synapta's 29-key catalog: rejected. It mixes primitives with product compositions, which is the hypothesis under test.
      - Start from Clay's ~17 kinds: used as a cross-check only. Its props are too thin.
    - Chosen Approach:
      - The spec's candidate list, defined fresh as data. Gaps are recorded, never patched silently.
      - `proof/` holds two JSX worlds: widgets use `proof/runtime`, and primitive implementations use React. `proof/tsconfig.json` sets `jsx: react-jsx` with React as the default source. Widget files opt into the proof runtime with a per-file `/** @jsxImportSource */` pragma, so neither world can type-check against the other.
    - API Notes and Examples:
      ```ts
      export const button = defineComponent({
        kind: "button", props: { label: str({ maxLength: 80 }), icon: optional(iconName()) },
        variants: ["default", "primary", "danger", "ghost"], slots: ["root", "label", "icon"],
        events: { onPress: { carries: "none" } }, styleProps: ["width", "grow"], children: "none",
        a11y: { role: "button", name: "label" },
      });
      ```
    - Files to Create/Edit:
      - `proof/tsconfig.json`: new.
      - `proof/catalog/{define.ts,definitions.ts}`: new.
      - `proof/tests/catalog.test.ts`: new.
      - `package.json`: the `typecheck` script also runs `tsc -p proof`.
      - `biome.json`: include `proof/` (it is already covered unless excluded).
  - Test Cases to Write:
    - `catalog_has_no_product_shaped_kind`: fails if a kind outside the allowed primitive list is added.
    - `definitions_admit_no_colour_or_raw_style_props`: fails if any prop is colour-typed or named `className` / `style`.
    - `references_are_all_attributed`: fails if a file in `proof/references/` is missing from `SOURCES.md`.
  - Notes (executed 2026-10-21):
    - Added all 23 spec §5 candidates in `proof/catalog/definitions.ts`, with closed JSON Schema objects, child constraints, event payload declarations, variants, slots, declared style-prop names and accessibility metadata. `define.ts` contains the proof's schema/definition types; `as const satisfies` preserves literal catalog data for Task 4 without a builder function or runtime dependency.
    - `proof/tsconfig.json` extends the strict root config, includes proof TS/TSX and excludes inert references. JSX uses `react-jsx` with React as the default import source; future widgets opt into the proof runtime per file. No JSX runtime or React dependency is needed until those implementations exist. The root `typecheck` script now checks both projects. Biome and Bun already discover proof implementation/tests, so their configuration needed no change.
    - Wrote the tests first and confirmed failure before the catalog existed. Tests enforce the exact candidate inventory, complete plain-data contracts, closed object schemas, declared accessibility-name props, valid child kinds, layout-only style-prop names, and no function/colour/raw-style schema escape. The permanent attribution test checks all 20 snapshots against the provenance table, including repo prefixes, full SHA syntax and inclusive line counts, without sibling-repo access.
    - Documentation checked via Context7: TypeScript `/microsoft/typescript/v7.0.2` JSX pragma/compiler examples and Bun `/oven-sh/bun/bun-v1.4.2` recursive test discovery and separate typechecking. The first TypeScript library lookup hit a transient Bun package-cache copy error; retry succeeded.
    - Task 4 handoff: style-prop value validation and catalog-derived JSX types remain there. Spec §6.3's table requires `space.*`, while its following sentence says `gap={3}` compiles; use the table's token constraint for this proof and resolve the inconsistent example when updating the spec. These candidates do not finalize the primitive set or change spec meaning; no decision log, public export or version change is needed.
    - Verification: `timeout 300s bun run check` passed (both typechecks, lint, formatting, 5 tests including the existing root test). Snapshot contents were not changed.

- [ ] Task 3: Express Certified and Rack as themes and design systems
  - Acceptance Criteria:
    - Functional:
      - `proof/styles/certified/` and `proof/styles/rack/` each hold a **theme** (colour and typography roles) and a **design system** (typed values plus recipes keyed `<kind>.<variant>.<slot>.<state>`, spec §6).
      - Certified comes from `certified.css` and the approved artifact.
      - Rack's design system comes from `uiDesignSystem` in `design-rack/package.json` (its values and 247 recipes). Its theme maps `@clay/theme-modus-operandi`'s colours onto the role names Rack's recipes use (`surface.case`, `surface.module`, `text.meta`, `accent.primary`, `patch.1`–`patch.5`, …).
      - Rack's typography is user-owned in Clay. The proof theme supplies typography roles, and the mismatch with spec §6.1 is logged in `proof/GAPS.md`.
      - Rack's kinds and variants that differ from the Task 2 catalog are mapped, and each mapping is listed in `GAPS.md`. Examples: `textInput` vs `textField`, and the `muted` and `ghostDanger` button variants.
      - Each design system is complete for the Task 2 catalog.
    - Performance: n/a.
    - Code Quality: one role vocabulary shared by both themes. Any role one system needs and the other lacks is recorded as a finding.
    - Security: no literal colour outside the two theme files (law 3).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/styling.md`.
    - Library Documentation to Check Before Implementation:
      - None external. Read the snapshots of `certified.css` and `design-rack/package.json`.
    - Documentation Reviewed:
      - Spec §6.
      - Clay decision `2026-08-28-2234` (theme as the sole colour authority).
    - Options Considered:
      - Keep Certified as its existing CSS: rejected. Recipes are the model under test.
      - Generate recipes automatically from CSS: rejected. Too clever for a proof; hand-written recipes expose the gaps.
    - Chosen Approach:
      - Hand-translate both systems into the spec §6 formats as TS data.
    - API Notes and Examples:
      ```ts
      "button.primary.root.hover": { backgroundColor: "accent.fill.hover", textColor: "text.on-accent",
        borderRadius: "radius.control", padding: "space.2", transitionDuration: "motion.fast" }
      ```
    - Files to Create/Edit:
      - `proof/styles/{types.ts,certified/theme.ts,certified/design-system.ts,rack/theme.ts,rack/design-system.ts}`: new.
      - `proof/tests/styles.test.ts`: new.
  - Test Cases to Write:
    - `design_systems_are_complete_for_the_catalog`: fails if any `(kind, variant, slot, state)` lacks a recipe.
    - `no_colour_outside_themes`: fails if a recipe or value holds a literal colour.
    - `recipes_reference_only_declared_roles_and_values`: fails on an unknown role or value name.

- [ ] Task 4: Build the proof SDK: JSX runtime, intents, render and validation
  - Acceptance Criteria:
    - Functional:
      - Under `jsxImportSource` pointing at `proof/runtime`, a widget `(params, state, data, context) → element` renders to a spec §9 tree with key-path ids.
      - `state.set` and `action` produce spec §9 intents.
      - The validator enforces the spec §10 checks the four UIs exercise: kinds, props, children, variants, style props, declared events and actions, keys and limits.
      - Composed components are plain functions expanded at render time.
    - Performance: rendering the Task 6 queue at `full` with 50 rows stays under 2 ms mean in Bun, measured by a bench test.
    - Code Quality:
      - The runtime is host-API-free; a test scans its sources.
      - Proof-grade: only what the four UIs need.
    - Security:
      - A host element, a function prop, an async render, an undeclared action and a missing key are each rejected (laws 1, 2 and 4).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/sdk.md` and `references/formats.md`.
      - `typescript-advanced-types`: the JSX namespace and catalog-derived props.
      - `karpathy-guidelines`: keep the runtime small.
    - Library Documentation to Check Before Implementation:
      - TypeScript 7.0 JSX: the `react-jsx` transform, `jsxImportSource`, and the `JSX` namespace (`IntrinsicElements`, `ElementChildrenAttribute`), via `find-docs`.
    - Documentation Reviewed:
      - Spec §7–§10.
      - Prior art: Synapta `packages/synapta-widget-sdk/src/{jsx-runtime.ts,render.ts,intents.ts,errors.ts}`. It uses positional ids; this uses key paths.
    - Options Considered:
      - Reuse Synapta's SDK by copying it: rejected. Its ids are positional and its catalog is the one under test. Read it as prior art only.
      - Render with React on the server and serialise the result: rejected (spec §7; it admits host elements).
    - Chosen Approach:
      - A small runtime in which elements are frozen records keyed by primitive kind, plus a tree builder and a validator.
    - API Notes and Examples:
      ```tsx
      /** @jsxImportSource ../runtime */
      export default ({ state: s, data }: WidgetProps<P, S, D, C>) => (
        <Stack gap="space.3">{data.rows.map((r) => <Button key={r.id} label={r.title} onPress={action("tasks.open", { id: r.id })} />)}</Stack>
      );
      ```
    - Files to Create/Edit:
      - `proof/runtime/{jsx-runtime.ts,jsx-dev-runtime.ts,intents.ts,render.ts,validate.ts,errors.ts,types.ts}`: new.
      - `proof/tests/runtime.test.ts`, `proof/tests/runtime.bench.ts`: new.
  - Test Cases to Write:
    - `ids_are_key_paths_and_stable_across_an_insert`: fails if inserting a row changes the ids of the rows after it.
    - `rejects_host_elements_function_props_async_and_missing_keys`: one case per error kind.
    - `undeclared_action_is_rejected`: fails if an action outside the manifest validates.
    - `runtime_sources_use_no_host_api`: fails on `node:`, `bun:`, DOM globals or `require(`.
    - `full_queue_renders_under_budget`: the 2 ms bench.

- [ ] Task 5: Build the proof CSS projection and React renderer, with primitive implementations
  - Acceptance Criteria:
    - Functional:
      - `proof/css` projects a theme and design system into CSS custom properties and one class per `(kind, variant, slot, state)`.
      - `proof/renderer` provides:
        - `<Surface tree onIntent fallback>`
        - `implement(definition, Component)`, with `props`, `slot()` and `emit()`
        - id-keyed reconciliation, with stale revisions ignored
        - the startup registry check
      - Every Task 2 primitive has a React implementation. Interactive ones (menu, popover, dialog, tabs, select, tooltip) are built on React Aria Components, so tier 1 behaviour and accessibility come built in.
    - Performance: switching design system changes only CSS variables and classes, with no widget re-run. A test asserts that the widget render count is unchanged.
    - Code Quality:
      - Primitives read only their slot classes and variables.
      - No primitive takes a colour.
      - The renderer imports nothing from `proof/styles/*`; style data arrives only through the projection.
    - Security: an unknown kind or invalid node renders the fallback; the renderer re-checks structure on arrival (law 2).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/renderer.md` and `references/styling.md`.
      - `find-docs`: React 19.3 and React Aria Components 1.22 APIs.
    - Library Documentation to Check Before Implementation:
      - React 19.3: `createRoot`, keys and reconciliation, `renderToString` for the SSR check.
      - React Aria Components 1.22: `Menu`, `Popover`, `Dialog`, `Tabs`, `Select`, `Tooltip` and their styling hooks (`className` render props, data attributes for states).
    - Documentation Reviewed:
      - Spec §6.4 and §11.
    - Options Considered:
      - Hand-rolled overlays: rejected. Accessibility and focus management are not what this proof tests.
      - A CSS-in-JS engine: rejected. The spec projects to CSS custom properties.
    - Chosen Approach:
      - React plus React Aria Components. State data attributes map to recipe states.
    - API Notes and Examples:
      ```tsx
      implement(button, ({ props, slot, emit }) => (
        <Button className={slot("root")} onPress={() => emit("onPress")}><span className={slot("label")}>{props.label}</span></Button>
      ));
      ```
    - Files to Create/Edit:
      - `proof/css/project.ts`: new.
      - `proof/renderer/{surface.tsx,implement.ts,registry.ts}`: new.
      - `proof/renderer/primitives/*.tsx`: new, one per primitive.
      - `proof/tests/renderer.test.tsx`: new.
      - `package.json`: dev dependencies `react@^19.3.1`, `react-dom@^19.3.1`, `react-aria-components@^1.22.1`, `@types/react@^19.3.0`. Proof-only; justified in this task.
  - Test Cases to Write:
    - `local_state_and_focus_survive_a_rerender`: fails if reconciliation remounts nodes with unchanged ids.
    - `design_system_switch_does_not_rerun_widgets`: fails if switching triggers a widget render.
    - `unknown_kind_renders_fallback`: fails if an invalid node renders nothing or throws.
    - `registry_check_fails_on_missing_implementation`.

- [ ] Task 6: Build the proof host harness
  - Acceptance Criteria:
    - Functional:
      - `proof/host` runs widgets in-process with fixture data, keeps per-surface state, re-runs a widget on `setState`, and logs actions.
      - It serves a page per reference UI with a design-system switch, using `Bun.serve` and `Bun.build`.
    - Performance: a `setState` round trip in the harness completes in under 50 ms locally.
    - Code Quality: fixtures are synthetic and shaped like the source apps' data. The harness holds no widget logic.
    - Security: widget code runs only in the harness process, never in the page (law 1). Actions are only logged (law 4).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/proof.md`.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4: `Bun.serve` routes and `Bun.build` for a browser bundle, via `find-docs`.
    - Documentation Reviewed:
      - Spec §8 (tiers) and §11 (`onIntent`).
    - Options Considered:
      - A full app framework (React Router): rejected. A proof needs one page per UI.
    - Chosen Approach:
      - A minimal Bun server that renders the tree server-side and hydrates `<Surface>`. Intents are POSTed back and the new tree is returned.
    - API Notes and Examples:
      ```ts
      Bun.serve({ routes: { "/ui/:name": page, "/intent": { POST: handleIntent } } });
      ```
    - Files to Create/Edit:
      - `proof/host/{server.ts,client.tsx,fixtures/*.ts,state.ts}`: new.
      - `proof/tests/host.test.ts`: new.
      - `package.json`: a `proof` script.
  - Test Cases to Write:
    - `set_state_reruns_widget_and_returns_new_tree`.
    - `action_is_logged_and_never_rerenders_by_itself`.

- [ ] Task 7: Build Synapta's agent-home queue from primitives
  - Acceptance Criteria:
    - Functional: a widget reproduces the approved queue (artifact lines 1137–1245, focus cards 1247–1320):
      - category tabs
      - subject-first rows beside a focus card
      - selecting a row moves its card into the focus position
      - task cards with `Claim` and `Escalate…` (opening a dialog that takes a reason of 1–500 characters)
      - alert cards with `Acknowledge`, a `Snooze` menu and `Convert to task`
      - one "load more" control that advances three cursor chains
      - the loading, empty, failed and read-only states (lines 1324–1357), and the escalate dialog (1368–1383)
    - Performance: re-render on row selection stays within the Task 4 budget.
    - Code Quality:
      - Only primitives and composed components (`TaskCard`, `AlertCard`, `QueueRow`).
      - Any new primitive is recorded in `proof/GAPS.md` with why it could not be composed.
    - Security: every control maps to a declared intent; there are no free-form actions (law 4).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/proof.md`.
      - `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - None beyond Task 5's.
    - Documentation Reviewed:
      - The artifact snapshot.
      - Synapta T4b's three blockers (focus-card controls, three-cursor paging, DOM parity).
    - Options Considered:
      - Add a `queue` primitive: forbidden. It is the hypothesis under test.
    - Chosen Approach:
      - Row selection, the tab filter and the three cursors are widget `state`. Claim, escalate, acknowledge, snooze and convert are actions.
    - API Notes and Examples:
      ```tsx
      <Grid columns={["1fr", "22rem"]} gap="space.5">
        <Stack>{rows.map((r) => <QueueRow key={r.id} row={r} selected={r.id === s.selected} onSelect={state.set("selected", r.id)} />)}</Stack>
        {focus && <TaskCard key={focus.id} task={focus} />}
      </Grid>
      ```
    - Files to Create/Edit:
      - `proof/widgets/agent-home/{queue.tsx,task-card.tsx,alert-card.tsx,queue-row.tsx,manifest.ts}`: new.
      - `proof/host/fixtures/queue.ts`: new.
      - `proof/GAPS.md`: new (gap log).
      - `proof/tests/agent-home.test.ts`: new.
  - Test Cases to Write:
    - `selecting_a_row_moves_its_card_to_focus`.
    - `load_more_advances_all_three_cursors`.
    - `escalate_requires_a_reason_of_1_to_500_chars`.
    - `widget_uses_only_catalog_primitives`.

- [ ] Task 8: Build `core.queue` at all four sizes
  - Acceptance Criteria:
    - Functional: one widget renders `small`, `medium`, `large` and `full` from `context.size`, matching the snapshot's intent (`widget.tsx`) and the artifact's size rules (`.sdk-specimen[data-size]`, lines 1036–1047).
    - Performance: every size stays within the Task 4 budget.
    - Code Quality: the size-specific trees share composed components from Task 7. Gaps are logged in `proof/GAPS.md`.
    - Security: same intents as Task 7, with nothing undeclared.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/proof.md`.
    - Library Documentation to Check Before Implementation:
      - None external.
    - Documentation Reviewed:
      - Snapshot of `product-modules/ui/core/widgets/queue/`.
    - Options Considered:
      - Four separate widgets: rejected. Per-size trees from one widget are the model.
    - Chosen Approach:
      - Branch on `context.size`, reusing Task 7's composed components.
    - API Notes and Examples:
      ```tsx
      if (context.size === "small") return <Metric label="Waiting on you" value={data.queue.total} />;
      ```
    - Files to Create/Edit:
      - `proof/widgets/core-queue/{widget.tsx,metric.tsx,manifest.ts}`: new.
      - `proof/tests/core-queue.test.ts`: new.
  - Test Cases to Write:
    - `renders_each_size_with_a_distinct_valid_tree`.
    - `size_outside_the_manifest_is_rejected`.

- [ ] Task 9: Build Clay's git status panel and a Rack module panel
  - Acceptance Criteria:
    - Functional:
      - A widget reproduces `buildGitStatusTree`'s output: per workspace root, its label, head, dirty state and refresh state, each with its icon, plus the empty state.
      - A second widget reproduces Clay's `agent-info` module (`apps-and-containers-rack/index.html:1279–1323`) in the Rack design system, covering all three tiers:
        - local: typing in the composer's textarea
        - `setState`: the Files / OM / Context tabs
        - actions: closing the container and sending the composer
      - The lamp, the patch jack and the effort pips are each composed from `box` / `icon` with role-only surfaces. If one cannot be, it is logged in `GAPS.md` before any primitive is added.
      - Both widgets render under Rack.
    - Performance: within the Task 4 budget.
    - Code Quality: only primitives and composed components. Gaps are logged in `proof/GAPS.md`, especially where Clay's thin `label` hid needed props.
    - Security: commands map to declared actions only.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/proof.md`.
    - Library Documentation to Check Before Implementation:
      - None external.
    - Documentation Reviewed:
      - The snapshots of `status.ts`, `components.rs` and the Clay frontend panel code.
    - Options Considered:
      - Port Clay's builder calls one-to-one: rejected. The point is TSX on richer primitives.
    - Chosen Approach:
      - Rewrite each as a TSX widget with fixtures shaped like Clay's data.
    - API Notes and Examples:
      ```tsx
      <Stack gap="space.1">{roots.map((r) => <GitRoot key={r.id} root={r} />)}</Stack>
      ```
    - Files to Create/Edit:
      - `proof/widgets/clay/{git-status.tsx,rack-module.tsx,manifest.ts}`: new.
      - `proof/host/fixtures/clay.ts`: new.
      - `proof/tests/clay.test.ts`: new.
  - Test Cases to Write:
    - `git_status_matches_builder_output_structure`: the same rows, labels and icons as `buildGitStatusTree` for the same fixture.
    - `empty_state_renders`.
    - `agent_info_tabs_and_close_map_to_declared_intents`: fails if a tab switch is not `setState`, or if close/send is not a declared action.

- [ ] Task 10: Prove the design-system switch
  - Acceptance Criteria:
    - Functional: the Task 7 queue and the Task 9 git panel each render under both Certified and Rack, switched live in the harness, with no change to widget code.
    - Performance: the switch triggers no widget re-run (Task 5 test) and completes in one frame locally.
    - Code Quality: any recipe or role that one system lacks for the other's widget is a logged gap, never a widget-code workaround.
    - Security: n/a — styling data only, already validated in Task 3.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/styling.md`.
    - Library Documentation to Check Before Implementation:
      - None external.
    - Documentation Reviewed:
      - Spec §6.4.
    - Options Considered:
      - None. This is a direct check of the spec.
    - Chosen Approach:
      - The harness toggles the projected stylesheet. A test asserts that the widget sources are identical across both renders.
    - API Notes and Examples:
      ```ts
      applyDesignSystem(project(rackTheme, rackDesignSystem));
      ```
    - Files to Create/Edit:
      - `proof/host/client.tsx`: add the switch.
      - `proof/tests/switch.test.ts`: new.
  - Test Cases to Write:
    - `switch_changes_computed_styles_not_dom_structure`: fails if the DOM tree differs between the two systems.

- [ ] Task 11: Capture parity evidence against the approved artifact
  - Acceptance Criteria:
    - Functional: a script renders the approved artifact snapshot and the Task 7 widget at the same viewport widths (1440, 1024 and 390 px), then produces:
      - screenshots of both
      - a pixel diff
      - a DOM-structure diff of the queue region
      - a computed-style diff for typography and spacing
    - Every difference above the threshold is listed in `proof/PARITY.md` as intended or as a gap.
    - Performance: n/a.
    - Code Quality: one reproducible script. Its output goes to `/evidence/` (gitignored) and the report names the script.
    - Security: the evidence holds synthetic data only. No screenshot is committed.
  - Approach:
    - Skills to Use:
      - `find-docs`: Playwright 1.64.
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64: `chromium.launch`, `page.screenshot`, `page.evaluate` for computed styles. Check that it runs under Bun. Chromium is installed once with `timeout 600 bunx playwright install chromium`.
    - Documentation Reviewed:
      - Spec §12 acceptance criteria.
    - Options Considered:
      - Visual inspection only: rejected. The spec demands a pixel and DOM comparison.
      - Run the browser on the host: acceptable here. If the owner wants a containerized browser as in Synapta, the executor asks before writing the script.
    - Chosen Approach:
      - Playwright with headless Chromium driven from a Bun script. Images are diffed per viewport.
    - API Notes and Examples:
      ```bash
      timeout 300 bun proof/scripts/parity.ts --out evidence/parity
      ```
    - Files to Create/Edit:
      - `proof/scripts/parity.ts`: new.
      - `proof/PARITY.md`: new.
      - `package.json`: dev dependency `playwright@^1.64.1`, proof-only.
  - Test Cases to Write:
    - None in the suite: the script is evidence tooling. Its run and output summary are recorded in this task's Notes.

- [ ] Task 12: Write the report, decide go or no-go, and update the spec
  - Acceptance Criteria:
    - Functional: `proof/REPORT.md` holds:
      - the final primitive list with each definition
      - the style props needed
      - every gap from `GAPS.md` and `PARITY.md` with its resolution
      - a comparison with Synapta's grown `Queue` (the snapshot baseline): what the composition expresses as widget code that Synapta added as catalog props
      - each interaction tier and where it was exercised
      - a go/no-go with its reasons
    - `docs/spec.md` §5–§6 (and any other section the proof changed) is updated, and a decision log records any change of meaning. §12's artifact line ranges are corrected to the exact anchors.
    - Performance: the report records the measured budgets from Tasks 4–6 and 10.
    - Code Quality: the report names the tests and scripts behind each claim.
    - Security: the report confirms that all four laws held across the four UIs, or names where one did not.
  - Approach:
    - Skills to Use:
      - `create-decision-log`: if the spec's meaning changes.
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - Every earlier task's Notes, `GAPS.md` and `PARITY.md`.
    - Options Considered:
      - Leave the spec unchanged and record findings only in the report: rejected. The spec is normative and must describe what was proven.
    - Chosen Approach:
      - Write the report first, then make the spec edits it calls for. Present the go/no-go to the owner before marking roadmap Phase 0 done.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `proof/REPORT.md`: new.
      - `docs/spec.md`: updated.
      - `decision-logs/<timestamp>-*.md`: if needed.
      - `roadmap.md` §3: plan status.
  - Test Cases to Write:
    - None. The report cites the existing tests.

- [ ] Task 13: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: every impact area in `.agents/skills/create-plan/references/liveframe.md` §5 is recorded in `plans/evidence/001-impact-analysis.md`, or marked `None — <reason>`. Every finding is executed above this task or backlogged, with the owner's answer recorded.
    - Performance: n/a.
    - Code Quality: findings name concrete files or spec sections.
    - Security: the "four laws" area is never `None` without evidence.
  - Approach:
    - Skills to Use:
      - `create-plan` § Final task.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - The delivered proof and report.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - Sweep, present one findings table to the owner, then dispose of each finding.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/001-impact-analysis.md`: new.
      - `plans/backlog.md`: if any finding is backlogged.
  - Test Cases to Write:
    - None.

## Verification (whole plan)

- `timeout 300 bun run check`
- `timeout 300 bun test proof`
- `timeout 120 bun proof/tests/runtime.bench.ts`
- `timeout 300 bun proof/scripts/parity.ts --out evidence/parity`
- A manual walk of the four UIs in the harness (`bun run proof`), recorded in Task 12's Notes.

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
