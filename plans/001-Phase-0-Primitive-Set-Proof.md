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

- [x] Task 3: Express Certified and Rack as themes and design systems
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
      - Hand-translate Certified into spec §6 TS data. Preserve all 247 pinned Rack recipes and 14 values as typed TS data, replacing transparency with a theme role, then explicitly map source prefixes to catalog slots.
      - Require a rest recipe for each slot; materialize all eight spec states, merging state overrides over rest. Unpainted wrappers and inherited ink slots are explicit. Supply missing control families and source spacing/easing references; log each gap.
    - API Notes and Examples:
      ```ts
      "button.primary.root.hover": { backgroundColor: "accent.fill.hover", textColor: "text.on-accent",
        borderRadius: "radius.control", padding: "space.2", transitionDuration: "motion.fast" }
      ```
    - Files to Create/Edit:
      - `proof/styles/{types.ts,certified/theme.ts,certified/design-system.ts,rack/theme.ts,rack/design-system.ts}`: new.
      - `proof/styles/recipes.ts`: shared completeness expansion (no CSS generation or projection).
      - `proof/tests/styles.test.ts`: new.
      - `proof/GAPS.md`: ownership, vocabulary, catalog mapping and parity findings.
      - `roadmap.md` §3: Task 3 completion status.
  - Test Cases to Write:
    - `design_systems_are_complete_for_the_catalog`: fails if any `(kind, variant, slot, state)` lacks a recipe.
    - `no_colour_outside_themes`: fails if a recipe or value holds a literal colour.
    - `recipes_reference_only_declared_roles_and_values`: fails on an unknown role or value name.

  - Notes (executed 2026-10-21):
    - Added Certified light and Rack/Modus Operandi light themes with one vocabulary of 44 colour roles and seven typography roles. All colour literals are theme-owned, including transparency and Certified primary-hover mixing. Modus design tokens are copied exactly; primary text and scrollbar come from its text styles.
    - Added typed values and closed recipe properties. Each active design system has 536 recipes covering all 23 candidate kinds, every variant/slot and all eight states. The shared helper rejects missing rest slots and merges rest with state overrides. No product-shaped kinds were added.
    - Retained all 247 Rack source recipes (sole normalization: transparent becomes colour.transparent) and all 14 values, with exact-source equality tests. Explicit prefix mappings adapt textInput/dropdown/modal/seg/label/divider/flex and button.muted; source-only families/variants remain reference data. Added checkbox/switch recipes using existing Rack geometry and roles. Supplied source spacing/easing references and shared space.0–7 tokens.
    - Created proof/GAPS.md with the full mapping table, Rack typography ownership mismatch, missing Certified identity/soft-fill roles, source documentation count mismatch (273 claimed versus 247 actual), supplied control families and Task 5/10/11/12 handoffs. Updated Task 7 to append to the existing gap log. These are proof findings; no normative spec meaning, dependency, public export or version changed, and no decision log is required.
    - Tests were written first and failed on missing modules. Nine style tests now cover completeness and its rejection case, state inheritance, shared roles, colour authority, closed properties and typed references (including shadows), malformed data rejection, source preservation and theme provenance. Both systems and all translated Rack source recipes resolve against either theme.
    - Verification: timeout 300s bun run check passed (both typechecks, lint, formatting and 14 tests). Browser rendering, font availability, forced colours and pixel/DOM parity remain the later renderer/projection/evidence tasks; data completeness alone does not establish visual parity.

- [x] Task 4: Build the proof SDK: JSX runtime, intents, render and validation
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
      - A small runtime in which elements are frozen records keyed by primitive kind, plus a tree builder and a validator. Derive typed primitive functions from the literal catalog; keep the authoring entry in `proof/runtime/index.ts`.
      - Use Bun-compatible Bundler resolution in the proof tsconfig: NodeNext rejects the extensionless automatic import generated by a relative `jsxImportSource`. React remains the default JSX source; widgets opt in per file.
      - Measure a synthetic full queue (50 rows, composed from catalog primitives) until Tasks 6–8 supply the host and real widget; later tasks must rerun the budget against their actual queue.
    - API Notes and Examples:
      ```tsx
      /** @jsxImportSource ../runtime */
      export default ({ state: s, data }: WidgetProps<P, S, D, C>) => (
        <Stack gap="space.3">{data.rows.map((r) => <Button key={r.id} label={r.title} onPress={action("tasks.open", { id: r.id })} />)}</Stack>
      );
      ```
    - Files to Create/Edit:
      - `proof/runtime/{index.ts,jsx-runtime.ts,jsx-dev-runtime.ts,intents.ts,render.ts,validate.ts,errors.ts,types.ts,data.ts}`: new.
      - `proof/tsconfig.json`: proof-only Bundler module resolution for relative JSX import sources.
      - `roadmap.md` §3: Task 4 completion status.
      - `proof/tests/runtime.test.ts`, `proof/tests/runtime-jsx.test.tsx`, `proof/tests/runtime.bench.ts`: new.
  - Test Cases to Write:
    - `ids_are_key_paths_and_stable_across_an_insert`: fails if inserting a row changes the ids of the rows after it.
    - `rejects_host_elements_function_props_async_and_missing_keys`: one case per error kind.
    - `undeclared_action_is_rejected`: fails if an action outside the manifest validates.
    - `runtime_sources_use_no_host_api`: fails on `node:`, `bun:`, DOM globals or `require(`.
    - `full_queue_renders_under_budget`: the 2 ms bench.
    - `automatic_jsx_runtime_expands_typed_catalog_primitives`: actual TSX plus compile-time rejection cases for missing/unknown props, variants, events, children, style values and host tags.
    - Schema, transport, intent, fragment, default/configurable limit and UTF-8 byte boundary cases fail closed.

  - Notes (executed 2026-10-21):
    - Added the proof-only automatic JSX and development runtimes, a catalog-derived authoring entry with all 23 typed primitives, frozen `state.set`/`action` intents, synchronous composed-component expansion, `render`, and independently callable `validate`. The API returns a `UiTree` or a path-bearing `WidgetError` using all twelve spec §7.2 error kinds. Render options supply the catalog, declared action names and state schema; optional params/context schemas, surface id, revision and limits support the later host.
    - Dynamic arrays require explicit keys, including a single-row list. Static siblings use their primitive kind when unambiguous; repeated kinds need explicit keys. Composed components retain their outer key, fragments retain keyed group scopes, and URI-escaped key segments prevent slash/percent collisions. No position-derived ids are emitted. Inputs and returned wire data are deeply frozen; primitive descriptors expose only a frozen kind, never mutable catalog definitions.
    - Validation covers closed tree/node/prop/intent shapes, catalog schemas (nested objects/arrays, Unicode string lengths, enums, patterns and numeric bounds), child kinds/counts, variants, declared events/actions/state keys, event-value compatibility, unique key-path ids, and configurable 5,000-node/64-depth/1-MiB defaults. Functions, promises, host elements, non-JSON data, raw CSS and unknown fields fail closed. The host still owns dispatch-time action-argument validation and authorization, as specified in §8.
    - Proof style values use shared `space.0–7`, the installed surface/typography vocabulary, closed layout/tone enums, dimensions bounded to 0–12fr or 0–100ch/%, flex values 0–100, and track/area lists of at most 12 entries. These are proof bounds, not a finalized format. Task 2’s conflicting `gap={3}` spec example remains a Task 12 handoff; the normative token table is followed. Updated Task 7’s illustrative `22rem` track to bounded `40ch`; raw rem lengths are outside §6.3, and actual layout/parity remains that task’s work.
    - Checked TypeScript 7.0.2 documentation through Context7: automatic JSX, namespace/children/key typing and NodeNext’s extension requirement. The first real TSX fixture demonstrated that NodeNext rejects TypeScript’s generated relative JSX-runtime import. Only `proof/tsconfig.json` now uses ESNext/Bundler resolution, matching Bun; React remains the default JSX source. Read Synapta’s four SDK files as prior art without copying their positional-id model or adding cross-repo imports.
    - Tests were written first and failed on missing runtime modules. Runtime/TSX tests cover the rejection cases, keyed insertion stability, composition/fragments, development JSX, frozen data/descriptors, metadata, transport revalidation, default depth boundaries and UTF-8 byte limits. Compile-time assertions prove catalog-derived props stay closed. Portability checks scan every runtime source and a browser-targeted Bun bundle for host API references. No dependency, published export, version or normative spec meaning changed.
    - Performance: `timeout 120s bun proof/tests/runtime.bench.ts` passed at 1.791 ms mean over 1,000 renders after 200 warmups, including validation, for a synthetic full queue with 50 rows and 353 nodes. Tasks 6–8 must repeat the budget against their actual host/widget; those do not exist yet. Browser rendering and visual parity remain Tasks 5 and 11.
    - Verification: `timeout 300s bun run check` passed (both typechecks, lint, formatting, 27 tests); `timeout 120s bun proof/tests/runtime.bench.ts` passed; `timeout 120s bunx graft build` refreshed the local graph.

- [x] Task 5: Build the proof CSS projection and React renderer, with primitive implementations
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
      - Context7 React (`/reactjs/react.dev`): `hydrateRoot`, SSR and stable component positions/keys. React Aria (`/websites/react-aria_adobe`): menu collections, select composition, modal hierarchy, tooltips and state data attributes. Playwright (`/microsoft/playwright`): Chromium launch, locators and forced-colours emulation. Installed versions are React/DOM 19.3.1, React Aria Components 1.22.1 and Playwright 1.64.1; Context7 supplied current unversioned React/Aria docs and Playwright upstream API docs.
    - Options Considered:
      - Hand-rolled overlays: rejected. Accessibility and focus management are not what this proof tests.
      - A CSS-in-JS engine: rejected. The spec projects to CSS custom properties.
    - Chosen Approach:
      - React plus React Aria Components. State data attributes map to recipe states.
      - Keep the small primitive bindings together in one proof-only module. Aria collections receive menu items and tabs directly, with panels rendered from validated child nodes; generic React wrappers are not collection items.
      - Bring Playwright forward from Task 11 to verify real browser focus, scroll, hydration, keyboard controls and overlays. Bundle only the compiled renderer/test host; the synthetic tree is supplied by Bun. Reuse this dependency in Task 11.
    - API Notes and Examples:
      ```tsx
      implement(button, ({ props, slot, emit }) => (
        <Button className={slot("root")} onPress={() => emit("onPress")}><span className={slot("label")}>{props.label}</span></Button>
      ));
      ```
    - Files to Create/Edit:
      - `proof/css/project.ts`: new.
      - `proof/renderer/{surface.tsx,implement.ts,registry.ts}`: new.
      - `proof/renderer/primitives/index.tsx`: all 23 small primitive bindings, sharing the catalog-derived implementation context.
      - `proof/tests/renderer.test.tsx`: new.
      - `proof/tests/{projection.test.ts,renderer-browser.test.tsx,fixtures/renderer-client.tsx}`: projection unit tests and a browser fixture with SSR/hydration.
      - `proof/tests/runtime.test.ts`: move two SDK fixture functions to module scope; installing React enables Biome's component-factory rule even for these SDK-only fixtures.
      - `package.json`, `bun.lock`: proof-only dev dependencies `react@^19.3.1`, `react-dom@^19.3.1`, `react-aria-components@^1.22.1`, `@types/react@^19.3.0`, `@types/react-dom@^19.3.0` and `playwright@^1.64.1`. Justified in this task.
      - `proof/GAPS.md`: renderer/projection limits and later-task handoffs.
      - `roadmap.md` §3: Task 5 completion status.
  - Test Cases to Write:
    - `local_state_and_focus_survive_a_rerender`: fails if reconciliation remounts nodes with unchanged ids.
    - `design_system_switch_does_not_rerun_widgets`: fails if switching triggers a widget render.
    - `unknown_kind_renders_fallback`: fails if an invalid node renders nothing or throws.
    - `registry_check_fails_on_missing_implementation`.
    - Projection tests cover all 536 stable recipe classes, typed layout/role mapping, missing recipes/references and CSS injection rejection.
    - Browser tests cover SSR hydration without errors; stable ids through insertion; local value/focus/scroll preservation; stale revisions; surface replacement; invalid-tree fallback; committed state/action dispatch; keyboard menus, select, tabs, checkbox, switch, tooltip and modal dismissal/focus containment; and forced-colours CSS behavior.
    - Renderer source-boundary test rejects direct imports of design-system data or widget authoring code.

  - Notes (executed 2026-10-21):
    - Added `proof/css/project.ts`: theme colour/typography and typed design-value custom properties, all 536 stable recipe classes per design system, native/Aria state selectors and internal-slot state propagation, layout/semantic style projection, native scrollbar styling and forced-colours support. Projection handles shadows, background opacity, blur/saturation, transitions, outlines and press transforms without raw widget CSS. Missing recipes/references and unsafe CSS serialization fail closed. The proof replaces one global projected stylesheet atomically; a reusable untrusted installation validator remains Phase 1.
    - Added catalog-derived `implement`, a registry that rejects missing/duplicate/mismatched bindings, and `<Surface tree options registry onIntent fallback>`. Surface revalidates transport data using the existing validator, renders fallback for malformed trees/unknown kinds, reconciles by node id, ignores lower revisions for the current surface, and resets local state when the surface id changes. Renderer modules import no design-system data or widget authoring code.
    - Implemented all 23 candidates in one small binding module, with React Aria handling buttons, inputs, selection, menus, popovers, dialogs, tooltips and tabs. Inputs keep local drafts and commit on blur/Enter; multiline submits with Ctrl/Cmd+Enter. Local selection/toggle/tab state survives unrelated revisions and accepts changed host values. Missing `setState.value` receives the event payload; action names/arguments are forwarded unchanged. No widget code runs in the browser and no primitive accepts a colour.
    - Installed proof-only React/DOM 19.3.1, React Aria Components 1.22.1, React/DOM types 19.3.0 and Playwright 1.64.1, recording the Bun lockfile. Playwright moved forward from Task 11 to verify behavior in Chromium. React installation enabled Biome's component-factory rule for two existing SDK test fixtures; moving those functions to module scope preserves their tests. No new runtime dependency or published surface was added.
    - Projection and renderer unit tests were written first and failed on the missing modules. Browser tests hydrate the Bun-generated SSR tree without console/page errors and verify local edits/focus/scroll through insertion, stale revisions, changed host values, surface replacement, invalid-tree fallback, committed state/actions, menu/select/tab keyboard behavior, checkbox/switch selection, tooltip focus, modal focus containment/dismissal, and computed-style switching without widget reruns or DOM changes. Forced colours are emulated in Chromium. Renderer source imports are checked for boundary violations.
    - Recorded proof limits in `proof/GAPS.md`: one global stylesheet, native scrollbar geometry, a small host glyph map, theme font availability, commit-event naming/dynamic action-argument binding, and remaining reference-widget/pixel parity work. Task 6 owns the live host, dispatch-time validation/authorization and actual reruns; Tasks 7–11 own reference composition and parity. No normative spec meaning, catalog primitive, package export or version changed.
    - Verification: `timeout 300s bun run check` passed (both typechecks, lint, formatting, 36 tests including three real Chromium tests); `timeout 10s git diff --check` passed. Chromium was installed with `timeout 120s bunx playwright install chromium`. No screenshots were generated or committed; pixel/DOM comparison remains Task 11.

- [x] Task 6: Build the proof host harness
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
      - Bun 1.4.2 installed; official [HTTP server](https://bun.sh/docs/runtime/http/server) and [bundler](https://bun.sh/docs/bundler) docs: browser-targeted builds, in-memory outputs, request handlers, localhost binding, request-size limits and ephemeral test ports. Context7's library lookup failed with its monthly quota exhausted; official docs were used instead.
    - Options Considered:
      - A full app framework (React Router): rejected. A proof needs one page per UI.
    - Chosen Approach:
      - A minimal Bun server that renders the tree server-side and hydrates `<Surface>`. Intents are POSTed back and the new tree is returned.
      - Reference compositions arrive in Tasks 7–9. Register their pages now with an explicitly labeled 50-row smoke widget, kept outside the host; later tasks replace those registrations. The design-system page exercises the smoke widget until Task 10.
      - Each page visit gets an isolated in-memory surface. Dispatch rechecks the current revision, offered intents, manifest state and action schemas. Actions are appended to a surface log, without executing operations or rerendering. Only validated successful rerenders commit state.
    - API Notes and Examples:
      ```ts
      Bun.serve({ routes: { "/ui/:name": page, "/intent": { POST: handleIntent } } });
      ```
    - Files to Create/Edit:
      - `proof/host/{server.ts,client.tsx,view.tsx,pages.ts,state.ts,README.md}`: server, hydration, shared compiled view, page registrations, dispatch and local usage.
      - `proof/host/fixtures/queue.ts`: synthetic 50-row work-page subset; Task 7 extends it.
      - `proof/widgets/harness.tsx`: smoke widget and manifest; no widget logic in the host.
      - `proof/tests/host.test.ts`: new.
      - `package.json`: a `proof` script.
      - `roadmap.md` §3: Task 6 completion status.
  - Test Cases to Write:
    - `set_state_reruns_widget_and_returns_new_tree`.
    - `action_is_logged_and_never_rerenders_by_itself`.
    - `dispatch_rechecks_state_actions_current_tree_and_revision`: malformed, undeclared, unoffered and stale intents fail closed.
    - `failed_rerender_rolls_back_state_and_action_schemas_are_checked`: failed renders leave the last valid state intact; offered action arguments still require their schema.
    - `host_serves_reference_pages_and_rejects_invalid_requests`: pages, isolated surfaces, invalid sizes/envelopes, cross-origin rejection and a browser bundle without the widget/server.
    - `browser_hydrates_posts_intents_logs_actions_and_switches_styles`: real Chromium, no hydration errors, local drafts, actual round trips, visible action log and CSS-only switching.
    - `set_state_http_round_trip_under_50_ms`: 25 measured local HTTP round trips after five warmups, with a 50-row fixture.
  - Notes (executed 2026-10-21):
    - Added the localhost Bun server, in-memory browser build, server rendering and hydration, reference-page registrations, context-size selection, CSS-only Certified/Rack switching and visible per-surface action logs. `bun run proof` starts at `http://127.0.0.1:3000/`; `proof/host/README.md` documents usage and boundaries. No dependency, package export, spec meaning or version changed.
    - Each visit creates an isolated surface with a random id. Requests are bounded, same-origin JSON with closed envelopes and current revisions. Dispatch accepts only currently offered intents, rechecks state and action schemas and commits state only after a valid rerender. Actions are logged as data and never executed or used to rerender. The client serializes commits against the latest revision.
    - The host contains no widget logic. A separate smoke widget uses a synthetic 50-item work-page subset and all three interaction tiers. Reference pages explicitly identify their pending tasks. Tasks 7–9 must replace the registrations in `proof/host/pages.ts` with their widgets/fixtures; Task 8 must replace the smoke size context with its actual size-dependent composition; Task 10 must prove the switch on the real queue/git widgets. This harness is not parity evidence.
    - Wrote host tests first and confirmed the missing-module failure. Seven tests cover reruns, isolated state, actions without reruns, malformed/unoffered/undeclared/stale intents, action-argument validation, failed-rerender rollback, HTTP boundaries, reference routes, sizes, browser-bundle isolation, Chromium hydration without console errors, local drafts, live intents/logging and switching without DOM changes or POSTs.
    - Performance: the HTTP test measured 25 local `setState` round trips after five warmups on the 50-row smoke widget, with a 5.14 ms maximum against the 50 ms budget. The unchanged synthetic 353-node render benchmark passed at 1.634 ms mean over 1,000 renders against 2 ms; actual reference-widget budgets remain Tasks 7–8.
    - Verification: `timeout 300s bun run check` passed (both typechecks, lint, formatting and 43 tests including four Chromium tests). `timeout 120s bun proof/tests/runtime.bench.ts` and `timeout 20s git diff --check` passed. `timeout 3s bun run proof` printed the localhost URL and was intentionally stopped by the timeout. No images were generated or committed.
    - Limits: trusted in-process widgets, logging-only actions, and memory-only surfaces/logs retained until shutdown. Persistence, sandboxing and a production dispatcher are outside this proof. Context7 quota prevented its documentation lookup; Bun's official server/bundler documentation was checked instead.

- [x] Task 7: Build Synapta's agent-home queue from primitives
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
      - Use opaque fixture cursor tokens, with cumulative pages in each of three unequal chains. Load more advances all permitted non-exhausted chains in one state intent, including while filtered; exhausted chains retain their cursor. Commit the escalation reason with the existing text-field event before offering a static, schema-checked action. Register this reference page in the host, keeping the smoke widget for the unfinished references and its existing tests.
    - API Notes and Examples:
      ```tsx
      <Grid columns={["1fr", "1fr"]} gap="space.5">
        {focus && <TaskCard key={focus.id} task={focus} params={params} current={s} />}
        <Stack>{rows.map((r) => <QueueRow key={r.id} id={r.id} title={r.title} status={r.status} meta={r.meta} foldedAlerts={r.foldedAlerts ?? 0} selected={r.id === focus?.id} />)}</Stack>
      </Grid>
      ```
    - Files to Create/Edit:
      - `proof/widgets/agent-home/{queue.tsx,task-card.tsx,alert-card.tsx,queue-row.tsx,manifest.ts}`: new.
      - `proof/host/fixtures/queue.ts`: retain the smoke fixture and add the synthetic reference queue with three cursor chains.
      - `proof/host/{pages.ts,server.ts,README.md}`: register the real agent-home widget, validate fixture scenarios and document its use.
      - `proof/tests/host.test.ts`: move smoke-specific HTTP/browser assertions to the still-smoke core-queue page.
      - `proof/GAPS.md`: append composition gaps to the Task 3 gap log.
      - `proof/tests/agent-home.test.ts`: new.
      - `proof/tests/agent-home-browser.test.ts`: real Chromium interactions and fixture-state checks.
      - `proof/tests/agent-home.bench.ts`: actual 50-row queue selection rerender budget.
      - `roadmap.md` §3: Task 7 completion status.
  - Test Cases to Write:
    - `selecting_a_row_moves_its_card_to_focus`.
    - `load_more_advances_all_three_cursors`.
    - `escalate_requires_a_reason_of_1_to_500_chars`.
    - `widget_uses_only_catalog_primitives`.
    - Filter/focus fallback, cumulative paging with exhausted chains, stable row ids and selection, rejection of old/forged cursors and actions, loading/empty/failed/read-only states, hidden Alerts and escalation controls, independent action-schema reason bounds including Unicode, and local input/menu behavior in Chromium.
    - `agent_home_selection_under_budget`: 50 rows, 200 warmups and 1,000 selection rerenders, under 2 ms mean.
  - Notes (executed 2026-10-21):
    - Built the queue and composed `TaskCard`, `AlertCard` and `QueueRow` using existing primitives only. Tabs, row selection/focus, task Claim/Escalate dialog, alert Acknowledge/Snooze/Convert, reference popovers, stale notice, widget options and loading/empty/failed/read-only states render in `/ui/agent-home`. The fixture has the approved subjects and totals, with three unequal opaque cursor chains; one Load more advances each permitted chain and accumulates rows. Showing reports actual loaded visible rows rather than the static artifact's total.
    - Added closed state/params/context and action schemas. The reason remains local until blur/Enter commits it; only a committed 1–500-code-point reason offers escalation, and the action schema checks the same bounds. Permissions hide mutation/escalation controls and unavailable alerts. The host rechecks currently offered intents and logs actions, including review/retry, without performing operations. Read-only/no-alerts/no-escalate scenarios are inspectable from the documented query parameter.
    - Wrote unit tests before the modules and confirmed the missing-module failure. Unit and Chromium tests cover focus/filtering, cursor accumulation/exhaustion, stable ids/selection, invalid/old/unoffered intents, Unicode reason limits, permission hiding, all task/alert controls, local draft/menu behavior, SSR hydration and no widget code in the browser bundle. Smoke-specific host tests now use the pending core-queue page; their original assertions remain intact.
    - Performance: the first actual 50-row benchmark exceeded 2 ms. Passing only display fields into rows and removing redundant row wrappers reduced the tree to 193 nodes and the measured mean to 1.630 ms over 1,000 changing-selection renders after 200 warmups. The reproducible check is `timeout 120s bun proof/tests/agent-home.bench.ts`.
    - Recorded composition differences in `proof/GAPS.md`: generic wrappers instead of article/aside/facts semantics, popovers instead of details, a separate row metadata/Selected text, fixed two-column layout without sticky/mobile behavior, missing source marker geometry and plate rules, and browser UTF-16 maxlength versus wire code-point bounds. These are explicit Task 11 measurement and Task 12 go/no-go inputs. No pixel/DOM parity claim or images were produced in this task. No primitive, catalog prop, recipe, dependency, public export, version or normative spec meaning changed.
    - Verification: `timeout 300s bun run check` passed (both typechecks, lint, formatting and 51 tests, including six Chromium tests). The actual queue benchmark and `timeout 20s git diff --check` passed. Task 8 can reuse the composed cards/rows and manifest without adding a queue primitive.

- [x] Task 8: Build `core.queue` at all four sizes
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
      - Branch on `context.size`, reuse Task 7’s rows and extracted decision card, and delegate full/unavailable states to the existing queue. Register the widget in the host; host placement supplies the artifact’s specimen width caps. Record source-data and responsive-layout limits in the gap log.
    - API Notes and Examples:
      ```tsx
      if (context.size === "small") return <Metric label="Waiting on you" value={data.queue.total} />;
      ```
    - Files to Create/Edit:
      - `proof/widgets/core-queue/{widget.tsx,metric.tsx,manifest.ts}`: new.
      - `proof/tests/core-queue.test.ts`, `proof/tests/core-queue-browser.test.ts`, `proof/tests/core-queue.bench.ts`: validation, browser integration and per-size performance.
      - `proof/widgets/agent-home/{decision-card.tsx,queue.tsx}`: extract and reuse the existing decision card.
      - `proof/host/{pages.ts,server.ts,README.md}`: registration, specimen placement and usage.
      - `proof/tests/host.test.ts`: keep smoke-only assertions on the pending git-status registration.
      - `proof/GAPS.md`: composition and source-data limitations.
      - `roadmap.md` §3: Task 8 completion status.
  - Test Cases to Write:
    - `renders_each_size_with_a_distinct_valid_tree`.
    - `size_outside_the_manifest_is_rejected`.
    - Decision-only selection/paging, current offered actions, permissions, all unavailable states and empty decisions.
    - Chromium hydration, specimen caps, live paging/selection/review and browser-bundle isolation at all four sizes.
    - Each actual size renders a 50-row fixture under 2 ms mean after 200 warmups over 1,000 renders.
  - Notes (executed 2026-10-21):
    - Built one core queue branching on context.size: small loaded-decision metric, medium decision rows, large selectable decision focus with rows, and full grouped Task 7 queue. Extracted the existing decision card without changing Task 7 behavior; reused rows, permissions, manifest schemas and declared actions. No catalog primitive, recipe, dependency, published export, version or normative spec meaning changed.
    - Registered /ui/core-queue with all existing fixture scenarios and host-owned approved specimen caps (21rem, 36rem, 54rem, 100%). Updated host usage. Smoke-specific host checks now target the pending git-status page; their assertions remain intact. The fixture normalization, state-based paging, per-source-status limit and missing responsive tracks are recorded in proof/GAPS.md for Task 12; no pixel/DOM parity claim is made.
    - Unit tests were written first and confirmed the missing-module failure. Tests prove four distinct valid primitive-only trees, manifest size rejection, host registration, decision paging/selection, offered-action rejection, read-only controls and loading/empty/failed/zero-decision states. Chromium verifies all four sizes hydrate without errors, use the specimen caps, page/select/review through actual HTTP intents and keep widget code out of the browser bundle.
    - Performance: timeout 120s bun proof/tests/core-queue.bench.ts passed with 50 rows, 200 warmups and 1,000 measured renders per size: small 0.188 ms, medium 1.263 ms, large 1.473 ms, full 1.816 ms, all below 2 ms mean. The existing actual agent-home selection benchmark also passed at 1.651 ms after the shared-card extraction.
    - Verification: timeout 300s bun run check passed (both typechecks, lint, formatting and all 56 tests, including seven Chromium tests). Both actual-widget benchmarks, timeout 20s git diff --check and timeout 120s graft build passed. No screenshots were produced; Task 11 retains parity evidence responsibility.

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
      - `package.json`: Playwright 1.64.1 is already installed by Task 5 for renderer browser tests; reuse it.
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
