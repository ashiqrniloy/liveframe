# Phase 7 Part N: Release 0.3.0 — Formats: Node References, Extension Properties, Variant Axes, App-Declared States and URL Strings

Depends on: plan [026](026-Phase-7-Part-M-Release-0-3-0-Scope-Spec-And-Breaking-Changes.md) Tasks 1–2 (scope decision, 0.3.0 register, restructured spec) and Task 9 (one source for checkers and schemas, so every format change here is made once). Followed by plan [028](028-Phase-7-Part-O-Release-0-3-0-Template-Widgets-And-Streaming.md).

## Objectives

- Ship node references: `ref()`, a tree-unique `$anchor`, per-definition `refProps`, `not-found` for dangling references, and `item.domId` in `<Surface>` (Q1).
- Ship extension recipe properties: `vocabulary.extensions`, a recipe's `extensions` map, and `--lf-p-<name>` for trusted primitive CSS (Q2).
- Revise the variant-axes design so an axis value can **re-alias colour roles**, which covers tone × emphasis without compound variants, then ship axes (Q3).
- Let an app declare its own recipe states and `semantics` values, so these lists stop being a library release bottleneck (W8a).
- Add a `url` string form with a scheme allowlist to the schema language, so no host has to hand-roll `javascript:` blocking (W8b).

## Expected Outcome

- A widget writes `<TextField describedBy={ref("hint")} />` and `<Hint $anchor="hint" … />`; the tree carries the resolved key-path id; a dangling reference is `not-found`; `<Surface>` gives each node a stable DOM id. The proof catalog's `textField.describedBy` plus a `hint` kind prove it.
- `vocabulary.extensions` and recipe `extensions` validate, resolve through the cascade and project to `--lf-p-<name>`. A design system without them projects byte-identical CSS.
- `definition.axes` marks enum props as recipe axes; recipes use `kind.axis:value.slot.state` overlays and the new `roles` alias map; `button tone="critical"` gives a red fill under `variant="primary"` and red text under `variant="ghost"` from two alias entries, with no compound rule.
- `vocabulary.states` and `vocabulary.semantics` extend the fixed lists with app names that map to data attributes and ARIA roles.
- `{ type: "string", maxLength, url: { schemes: ["https", "mailto"], relative?: boolean } }` validates in every schema position including widget schemas, rejecting a disallowed scheme with `invalid-prop`.
- Corpus cases, published schemas, generated types, the elements schema and the conformance suites cover every addition.

This plan implements the format work of 0.3.0 in roadmap Phase 7: spec §5 (definitions and the schema language), §6.2–§6.5 (recipes, projection, vocabulary), §9–§10 (tree and validation), §11 (renderer) and §13 (codegen, corpus). All additions are optional fields under the existing format ids, which 0.2.x validators reject fail-closed (the 0.2.2 precedent). Every addition gets a register entry (`added`/`widened`). Nothing is published here.

## Tasks

- [x] Task 1: Revise the variant-axes design to alias colour roles, and record the decision
  - Acceptance Criteria:
    - Functional:
      - Amend `plans/evidence/022-variant-axes-design.md` with §2.8 "Role aliases": an axis overlay may carry `roles: { "<role-prefix-or-role>": "<role-prefix-or-role>" }`, e.g. `"button.tone:critical.root.rest": { "roles": { "accent": "status.critical" } }`. Resolution: when a resolved recipe for `(kind, variant, axis values, slot, state)` references a colour role, the resolver rewrites it through the merged alias map of the active axis values (declared axis order; later axis wins; one rewrite step, no chains). Every rewritten role must be a declared theme role — checked at install, `unknown-name` at `/recipes/<key>/roles/<from>`. The alias map applies to colour-typed properties, `{ role, alpha }` objects, shadow colours and colour extensions.
      - Projection: aliasing is resolved at projection time into the flat recipe table, so the CSS remains one rule set per `(kind, variant, axes…, slot, state)` and no runtime variable rewriting is needed.
      - The worked example (primary/ghost × neutral/critical) resolves to the expected four colour pairs with two alias entries and zero product variants.
      - Write `decision-logs/<date>-variant-axes-role-aliases.md` with `create-decision-log`, amending 2026-11-02-2208. The owner approves before Task 5 starts.
    - Performance: n/a — design.
    - Code Quality: the design states the cascade order and the alias rules as numbered rules for the spec.
    - Security: law 3 — aliases name only declared theme roles; no literal colour can enter.
  - Approach:
    - Skills to Use: `create-decision-log`; `liveframe-execution` (styling reference).
    - Library Documentation to Check Before Implementation: Radix Themes colour/variant model via `find-docs` (prior art for accent indirection), recorded with version.
    - Documentation Retrieved (2026-11-06): Context7 `/radix-ui/themes`, indexed 3.x (no exact release pin returned); shared Button and colour props support independent `variant` and `color` choices. Sources and limits recorded in design §2.8.
    - Documentation Reviewed: `plans/evidence/022-variant-axes-design.md` §2.3–§2.4, §5 (compounds rejected); `src/resolve.ts:16` (`cascadeRecipes`); spec §6.2.
    - Options Considered:
      - Compound variants. Rejected again: another cascade dimension, completeness questions per pair.
      - Runtime CSS variable re-mapping per axis class. Rejected: a variant's state snapshot would shadow the axis variables in some orders, and it changes existing sheets.
      - Product variants (status quo). Rejected: the duplication the axes exist to remove.
    - Chosen Approach: resolve-time alias maps on axis overlays.
    - API Notes and Examples:
      ```jsonc
      "button.primary.root.rest": { "backgroundColor": "accent.fill", "textColor": "accent.on-fill" },
      "button.ghost.root.rest":   { "backgroundColor": "none", "textColor": "accent.text" },
      "button.tone:critical.root.rest": { "roles": { "accent": "status.critical" } }
      ```
    - Files to Create/Edit: `plans/evidence/022-variant-axes-design.md`; `decision-logs/2026-11-06-0035-variant-axes-role-aliases.md`; `docs/spec.md` §6.2 (approved-design cross-reference); this plan; `roadmap.md` §3 (execution status)
  - Test Cases to Write: n/a — design; Task 5 derives its tests from the worked example.
  - Notes (executed 2026-11-06):
    - Revised design §2.8 with seven numbered rules: axis-only maps, inheritance and cascade order, dot-boundary/longest-prefix matching, one-step rewriting, typed colour traversal, install validation and flat output. Added the four-pair example using two alias entries; corrected the stale proposal status and install-cost description.
    - Recorded the approved amendment in `decision-logs/2026-11-06-0035-variant-axes-role-aliases.md`; the user's explicit instruction to complete and record this decision supplies approval before Task 5. The 2026-11-02 record remains immutable.
    - Added an explicitly unimplemented design reference in spec §6.2. Published docs cannot link to files excluded from the archive, so the spec uses repository paths; the initially failing archive-link test passes after this correction.
    - Expanded Task 5's handoff to require §2.8's alias edge cases. No format, schema, resolver, renderer or public API implementation changes in this design task.
    - Verification: build, generated-file checks, typecheck, lint, format and local link checks passed. The first full `timeout 900s bun run check` ran 1,111 tests: the fixed documentation-link failure and an unrelated warm-runner timing failure (0.1173 ms versus <0.1 ms) prevented a green result. A second run passed the documentation-link test but hit unrelated MCP, benchmark subprocess and browser timeouts under host load (~58); stopped after those failures. Owner explicitly approved the verification exception: “Yes—complete and record the verification exception.” A focused rerun of `src/__tests__/docs-links.test.ts`, `src/__tests__/cli-mcp.test.ts` and `src/__tests__/runner-in-process.test.ts` passed all 91 tests. Task 1 is complete under that exception; a green full check remains outstanding and no test threshold was changed.

- [x] Task 2: Node references in the format, SDK and validator (Q1, part 1)
  - Acceptance Criteria:
    - Functional:
      - `catalog.json` definitions gain optional `refProps: string[]`; each name must be a `string` prop (else `unknown-name`), at most 8 per definition.
      - `/sdk` exports `ref(anchor)` and the `$anchor` element attribute. `render()` and `renderElements()` resolve each `ref` to the target's key-path id after the walk; the tree carries a plain string. Duplicate anchors are `duplicate-key` at the second anchor; a dangling reference is `not-found` at the referencing prop with the anchor name in `expected`.
      - The compiled validator's `validateTree` checks every `refProps` value names an id present in the same tree (`not-found`), post-walk, without a second traversal of nodes.
      - Root export type `NodeRef`; codegen types `refProps` as `NodeRef` in `liveframe gen` output and the elements schema (`{ "$ref": anchor }` in element JSON).
      - Corpus cases: valid reference, dangling reference, reference in a responsive or nested composed component.
    - Performance: ≤ 2% render and validation cost on the agent-home bench (the design's gate, `plans/evidence/022-node-reference-design.md` §5).
    - Code Quality: follows the ratified design exactly; any deviation stops and goes to the owner.
    - Security: law 2 — references resolve only within the same validated tree; law 4 unchanged.
    - Compatibility: `added` for `ref`, `NodeRef`; `widened` for `catalog.json`, `render`, `renderElements`.
  - Approach:
    - Skills to Use: `liveframe-execution` (formats, sdk references); `typescript-advanced-types` (typed `ref` props).
    - Library Documentation to Check Before Implementation: none beyond the design.
    - Documentation Reviewed: `plans/evidence/022-node-reference-design.md` §2.1–§2.8; `decision-logs/2026-11-02-1219-defer-node-references-to-0-3-0.md`; `src/sdk/render.ts:413-492` (`emit`); `src/validate/tree.ts:198-239`.
    - Options Considered: as rejected in the design §6.
    - Chosen Approach: the ratified design with the owner-approved authoring amendment in `decision-logs/2026-11-06-0109-node-reference-authoring-markers.md`: `NodeRef` is a marker, generated reference props require it, and element schemas accept markers. Wire values stay strings. Deferred references use empty string placeholders, correcting their two counted bytes to the resolved id's exact byte count; this avoids rejecting author markers whose spelling is longer than the wire id.
    - API Notes and Examples:
      ```tsx
      <TextField label="Reason" describedBy={ref("reason-hint")} />
      <Hint $anchor="reason-hint" text="At most 200 characters" />
      ```
    - Files to Create/Edit: `src/formats/catalog.ts`; `src/sdk/` (`ref`, element attribute, render resolution); `src/sdk/elements.ts`; `src/validate/tree.ts`; `src/sdk/gen.ts`; `src/index.ts`; `schemas/catalog.json`; `conformance/corpus/ui-tree/…`; `docs/spec.md` §5, §7.2, §10; `docs/sdk.md`; `docs/formats.md`; `scripts/release/api/register-0.3.0.json`; `docs/compatibility.md`; `docs/migration-0.3.md`; dedicated reference catalog and elements corpus; `src/__tests__/node-references.test.tsx`; generated reference type fixture; `plans/evidence/027-node-reference-cost.ts`; authoring decision log and amended design; `CHANGELOG.md`; `src/__tests__/exports.test.ts`; `src/__tests__/schemas.test.ts`; MCP response fixture; `plans/evidence/027-node-reference-cost.md`
  - Test Cases to Write:
    - `ref_resolves_to_target_key_path`; `dangling_ref_not_found`; `duplicate_anchor_duplicate_key`; `refProps_must_name_string_props`; `validateTree_rejects_ref_to_missing_id`; `generated_type_requires_NodeRef` (type-level).
  - Notes (executed 2026-11-06):
    - Implemented the owner-approved authoring amendment: root `NodeRef` is a marker, `/sdk` exports frozen `ref(anchor)`, and generated props and element JSON schemas use markers. The approval and superseded design clauses are recorded in `decision-logs/2026-11-06-0109-node-reference-authoring-markers.md`.
    - Added optional, unique `refProps` (at most eight string prop names), install-time `unknown-name` checks, and catalog-change classification for changed reference semantics. `$anchor` resolves globally across composed components and keyed groups; duplicate and dangling errors retain source pointers. Wire props remain ordinary strings.
    - Both emitters resolve pending references after the walk with exact byte correction; the arrival validator collects only supplied references and checks the completed id set without another node traversal. Arrival-reference error pointers are materialized only on failure. Optional absent references and catalogs without `refProps` retain their contracts.
    - Added valid/dangling UI-tree and responsive, nested element corpus cases; generated type, packaging, malformed marker, same-tree membership, error-bound and exact-byte regression coverage. Updated schema generation, SDK exports, MCP response snapshots, spec, guides, adopter notes and API register. The schema guard now accepts registered widenings while preserving migration requirements for breaking changes. No runtime dependency added.
    - Verification: final `timeout 900s bun run check` passed (1,119 passed, 4 existing skips, 0 failed). The first full run exposed the export snapshot, MCP schema snapshot and overly narrow schema-register assertion; all three were corrected and pass. Export/MCP focused checks passed all 98 tests; schema/reference focused checks passed all 22 tests.
    - Performance: the 679-node, 50-reference paired gate passed at +1.87% validation and +0.56% rendering; method, limits and regeneration script are in `plans/evidence/027-node-reference-cost.md` and `.ts`. All repository benchmark components passed individually. The initial `bun run bench` stopped at core-queue.full validation (1.523 µs/node versus 1.5); its unchanged rerun passed at 1.493 µs/node. Render, CSS and streaming then passed; no thresholds were changed. Agent-home full widget render was 1.4731 ms (2.170 µs/node).
    - Renderer DOM ids, the proof primitive pair and renderer conformance remain Task 3.

- [x] Task 3: Node references in the renderer, the proof pair and conformance (Q1, part 2)
  - Acceptance Criteria:
    - Functional:
      - `<Surface>` gives every item a `domId` (stable across re-renders, unique per surface instance via `useId`), and rewrites `refProps` values from key-path ids to the target's `domId` before passing props to implementations.
      - The proof catalog gains `textField.describedBy` and a `hint` kind with implementations in the proof host and the demo host; a browser test asserts `aria-describedby` points at the hint element, survives a re-render and two surfaces with the same tree do not collide.
      - `rendererSuite` gains a case that every `refProps` value resolves to an element in the surface.
    - Performance: no arrival-budget regression (selection bench).
    - Code Quality: `domId` lives in the node context; implementations need no new API to use it.
    - Security: law 1 — no widget code; ids are derived, not authored HTML.
    - Compatibility: `widened` for `ImplementationProps`/item context.
  - Approach:
    - Skills to Use: `liveframe-execution` (renderer reference).
    - Library Documentation to Check Before Implementation: React 19 `useId` via `find-docs`.
    - Documentation Reviewed: design §2.6; `src/react/renderer.tsx:276-348` (`context`).
    - Options Considered: expose key-path ids as DOM ids. Rejected: collide across surfaces and leak structure into global id space.
    - Chosen Approach: per-surface `useId` prefix plus the key path.
    - API Notes and Examples:
      ```tsx
      implement(TextField, ({ props, item }) => <input aria-describedby={props.describedBy} id={item.domId} />)
      ```
    - Files to Create/Edit: `src/react/renderer.tsx`; `src/react/implement.ts`; `src/conformance/react/`; `src/__tests__/fixtures/proof/catalog.json`; proof host and `examples/demo-host/primitives/`; `docs/renderer.md`; `docs/conformance.md`
  - Test Cases to Write:
    - `describedBy_points_at_hint_element` (browser); `dom_ids_unique_across_two_surfaces`; `dom_ids_stable_across_rerender`; conformance `ref_props_resolve`.
  - Notes (executed 2026-11-06):
    - `<Surface>` derives one prefix per instance, `lf-` plus `encodeURIComponent(useId())`, and every node's `domId` is `<prefix>:<key-path id>`. It is deterministic per surface and key path, contains no whitespace (valid in an `aria-*` id list), and is built in the existing per-node context, which is cached by node identity. Reference props are rewritten to the target's `domId` only for definitions that declare `refProps`, only when the value is a string, so catalogs without `refProps` and absent optional references keep `props` identical. No wrapper element is added; the implementation places `domId` on its own element, as the design (§2.6) says.
    - `domId` is a field of `ImplementationProps`, not a separate `item` object. Implementations destructure it (`({ props, domId }) => <p id={domId}>`), collection `items[n].domId` carries each child's. The plan's `item.domId` example was shorthand for this; no new API is needed. Register entry: `./react ImplementationProps` `widened`.
    - Proof catalog now has 25 kinds: `hint` (text, `default` variant, root slot) and `textField.describedBy` with `refProps`. Recipes were added to both proof design systems (certified; rack aliased to `label.caption`), the proof and demo primitives, and the demo catalog and design system (`widgets/hello/ui.gen.ts` regenerated). The count-dependent fixtures (catalog counts 24→25, recipe totals 632/948, validator baseline messages, MCP texts, CSS byte baselines) were updated. The CSS baseline test keeps its second assertion (no new-state selectors) and now records that the `hint` kind grew each sheet (certified 152,019→152,457 bytes, rack 164,152→164,425).
    - `proof/scripts/export-formats.ts` had already drifted before this task: its recipe round-trip assertion does not know the 0.2.2 states (`current`, `mixed`, `pending`, `readonly`), which the committed `resolved-recipes` fixtures include. I regenerated the fixtures by running a temporary copy of the exporter with that assertion removed and `resolved-recipes` taken from `resolveRecipes` output; the diff against the committed fixtures was additions only. The script itself is unchanged and still fails; logged for Task 8's backlog.
    - `rendererSuite` gains `ref_props_resolve_to_elements_in_the_surface`: it records every reference value an implementation receives and requires an element with that `id` in the server markup (with HTML entities decoded). A requirement that an example must carry a reference was tried and dropped, because fixtures that reuse the proof catalog declare `refProps` without using them; the case is vacuous for those. Mutant test: an implementation that omits `domId` fails the case.
    - Tests: `src/__tests__/react-dom-ids.test.tsx` (rewrite to the target's id, uniqueness across two surfaces in one render, id-list validity); proof browser test `describedBy_points_at_hint_element` in both design systems (the input's `aria-describedby` resolves to the unique `<p>` with the hint text, and the id survives a re-render; hydration is covered by the harness's hydrated page). Conformance fixtures gained a `hint` and a reference in the supplemental example and the demo host's examples. `docs/spec.md` §11, `docs/renderer.md`, `docs/conformance.md`, `docs/migration-0.3.md`, `CHANGELOG.md` and the register were updated.
    - Verification: `timeout 900 bun run check` passed (1,124 passed, 4 existing skips, 0 failed). Two earlier full runs each failed only timing budgets that pass alone under load (`switch_changes_computed_styles_not_dom_structure` at 22.2 ms against a 16.7 ms frame in the first, `render_smoke_budget` at 11.7 against 10 µs per node in the second; the latter passed three focused reruns). The SDK render path was not changed by this task; no threshold was changed. Selection bench (679 nodes, development): validation 2.1–2.3 ms, render 10.5 ms, commit 0.7 ms, unchanged in kind from earlier runs; focus-continuity medians 2.4/3.0 ms.
    - `bun run demo:test`: 41 passed, 4 failed. All four failures are this machine's missing Playwright Chromium for the demo's own Playwright version (`chromium_headless_shell-1254` not installed), so the demo's browser tests and the MCP capture test could not run; its server conformance and typecheck against the packed archive passed with the new `hint` kind. This is an unverified exception, not a pass: run `bunx playwright install chromium` in `examples/demo-host` and rerun `bun run demo:test`. The whole-plan WebKit and Firefox runs were not run in this task.

- [x] Task 4: Extension recipe properties (Q2)
  - Acceptance Criteria:
    - Functional: exactly `plans/evidence/022-extension-properties-design.md` §2.1–§2.6: `vocabulary.extensions` (≤ 64, `colour` or `value` with a design-value kind), recipe `extensions` map, `unknown-name`/`invalid-prop` at `/recipes/<key>/extensions/<name>`, cascade by name, `--lf-p-<name>` emitted per slot rule, reduced-transparency and forced-colours handling for colour extensions, `colour-outside-theme` for literals. Design systems without extensions project byte-identical CSS (asserted against 0.2.3 fixtures).
      - `auditContrast` ignores extensions (they are not text/border pairs) and says so in its docs.
      - `designSystemSuite` covers an extension-bearing design system; `docs/styling.md` shows trusted primitive CSS reading `var(--lf-p-sheen)`.
    - Performance: `designSystemCss` bench non-regression; CSS size growth reported.
    - Code Quality: extensions use the existing property-schema helpers (`src/formats/design-system.ts:116`).
    - Security: law 3 — colours only from theme roles; values only typed design values.
    - Compatibility: `widened` for `catalog.json`, `design-system.json`, `Vocabulary`, `Recipe` types.
  - Approach:
    - Skills to Use: `liveframe-execution` (styling reference).
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: the design; `src/css/design-system.ts:41,255`; spec §6.2, §6.4, §6.5.
    - Options Considered: the design's §5.
    - Chosen Approach: the approved design.
    - API Notes and Examples: see the design §2.1.
    - Files to Create/Edit: `src/formats/vocabulary.ts`; `src/formats/design-system.ts`; `src/resolve.ts`; `src/css/design-system.ts`; `src/css/` variable helpers (`extensionVar`); `src/conformance/design-system.ts`; schemas; corpus; `docs/spec.md` §6; `docs/styling.md`; `docs/formats.md`; `register-0.3.0.json`
  - Test Cases to Write:
    - `extension_unknown_name_rejected`; `extension_colour_literal_rejected`; `extension_projects_lf_p_variable`; `no_extensions_byte_identical_css`; `extension_recovers_under_reduced_transparency`; `extension_cascades_by_name`.
  - Notes (executed 2026-11-06):
    - Implemented the approved design §2.1–§2.6 as written. `vocabulary.extensions` (≤ 64, names `^[a-z][A-Za-z0-9-]*$`) holds `{ type: "colour" }` or `{ type: "value", kind }` with `kind` from the new `extensionKinds` list (spacing, radius, border-width, size, opacity, motion-duration, saturation, backdrop-blur); a recipe's nested `extensions` map sets them. The two published schemas widened (`catalog.json`, `design-system.json`) and use the existing helpers (`record`, `obj`, `roleName`, `designDimension`, `duration`); the static recipe schema only fixes the shapes an extension value can take, and the kind-specific literal check runs on install against the catalog (`checkFormat` on the declared kind's literal schema).
    - Errors use the design-system validator's existing kinds, not `invalid-prop` (which is a tree-validation kind and is absent from the design-system corpus list): an undeclared name is `unknown-name`, a colour that is not a theme role (including a literal such as `#fff`) is `colour-outside-theme`, a wrong-shaped or out-of-range literal or an `{ role, alpha }` object is `invalid-document`, and a value reference of the wrong kind is `unknown-name`, all at `/recipes/<key>/extensions/<name>`. A name containing `;`, `}`, `/`, `_`, `.` or a space fails the closed name pattern. Shape errors that duplicate the literal check are dropped.
    - Cascade: extensions merge by name through the four layers in `cascadeRecipes` (and through `extends` in `mergeChain`), with value names replaced by their literals and colours kept as roles; the resolved key is omitted when empty, so `resolveRecipes` output and the 0.2.3 fixtures are unchanged. Projection appends `--lf-p-<name>:…` after the fixed declarations, sorted by name (`extensionVar` in `names.ts`, exported from `/css`). `classifyCatalogChange` adds `compareExtensions`: adding is minor, removing or changing `type`/`kind` is major, description-only changes are ignored, and the map no longer falls into `compareNames`.
    - The plan's "reduced-transparency and forced-colours handling" needs no code, as design §2.3 says: a colour extension has no alpha modifier, so there is nothing to recover, and the projection never writes `forced-color-adjust`. `extension_recovers_under_reduced_transparency` pins it (the reduced block holds no `--lf-p-` declaration, and the browser test checks the computed variable is unchanged under `data-lf-transparency="reduced"`). `unmodifiedColours` already drops non-colour fields, so the reduced rules never repeat an extension. `auditContrast` reads named recipe fields only, so it ignores extensions; this is stated in the spec, `docs/styling.md` and the migration guide.
    - `designSystemSuite` covers extension-bearing design systems inside the existing `every_theme_and_design_system_projects` case, which now fails when a set extension is missing from the sheet as `--lf-p-<name>`. A new case would have changed the pinned suite case list (`suite_without_contrast_option_is_unchanged`), so none was added; install rules (unknown name, literal colour) are exercised through `every_design_system_installs`.
    - Tests: `src/__tests__/extension-properties.test.ts` (the six plan cases plus name injection, wrong kind and shape, inherited recipes, `extends` merging, catalog classification and the closed vocabulary), a browser test in `css-browser.test.ts` (computed variables, inheritance, state override, reduced transparency), a conformance test with an extension-bearing design system, and six corpus cases (valid catalog, `value` without `kind`, valid design system, unknown name, colour outside theme, wrong-kind literal) with a shared `common/extensions-catalog.json`. `recipe_schema_uses_the_fixed_property_vocabulary` now expects the nested `extensions` key beside the fixed list; `every_recipe_property_projects` excludes it from `Required<ResolvedRecipe>`.
    - Docs and registers: `docs/spec.md` §6.2, §6.4, §6.5; `docs/styling.md` "Extension properties" (trusted CSS reading `var(--lf-p-sheen)`); `docs/formats.md`; `docs/conformance.md`; `docs/migration-0.3.md`; `docs/compatibility.md` (and its stale "renderer DOM-id integration remains Task 3" wording, corrected); `CHANGELOG.md`; `register-0.3.0.json` (`Vocabulary`, `Recipe`, `ResolvedRecipe` widened; `./css extensionVar` added; `design-system.json` widened and the `catalog.json` reason extended; thirteen corpus files added).
    - Cost (`plans/evidence/027-extension-cost.md`): no-extension sheets stay byte-identical (152,457 and 164,425 B, asserted); one colour extension on every authored recipe adds +3.8% / +3.6% bytes (gate ≤ +16%). The time gate (≤ +20%) is marginal on this host: paired growth ranged 13–27% across runs under a load of 3–43 from unrelated builds, centred near 21%, and the absolute cost is 1.5–2.9 ms on a 10–12 ms projection. The no-extension path measured +3% against a `HEAD` worktree on the same host (first implementation +20%: per-state layer arrays, rest destructuring and eager pointer strings, all removed). Not a clean pass of the worst-case time gate; rerun `plans/evidence/027-extension-cost.ts` on a quiet host in Task 8.
    - Verification: `bun run build`, `gen:check`, typecheck, lint and format check pass. The test suite passed except timing budgets under host load: one full run was killed at the 890 s limit with 20+ proof browser failures that were timeouts (load average 29–43), and the next full run (load ~11) failed only `check_value_handles_1000_mixed_properties_under_5ms` (8.2 ms against 5 ms), which passed three isolated reruns; `schema.ts` is untouched. No threshold was changed. A last clean full `bun run check` on a quiet host remains outstanding for the whole-plan verification.

- [x] Task 5: Multiple variant axes with role aliases (Q3)
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/022-variant-axes-design.md` §2.1–§2.8 as amended by Task 1: `definition.axes` (≤ 3 axes, ≤ 16 values, ≤ 256 combinations per kind), recipe keys `kind.axis:value.slot.state`, the six-layer cascade, axis-suffixed slot classes `lf_<kind>_<variant>__<v1>__<v2>_<slot>` only for kinds with axes, `slotClass(kind, variant, slot, axes?)`, `<Surface>` computing the class from node props and defaults, and `roles` alias maps.
      - Kinds without axes keep byte-identical classes and CSS.
      - The worked example from Task 1 renders the four expected colour pairs in a browser test under the proof design systems.
      - `designSystemSuite` and `rendererSuite` cover axis classes; conformance fixtures require one example per axis value.
    - Performance: CSS size per kind with axes is reported; `designSystemCss` and switching span A stay within budget on the proof design systems with one 2-axis kind added.
    - Code Quality: the resolver expands overlays into the existing flat table; projection code paths are reused.
    - Security: law 3 — aliases checked against declared roles at install.
    - Compatibility: `widened` for `catalog.json`, `design-system.json`, `slotClass`, `Definition`.
  - Approach:
    - Skills to Use: `liveframe-execution` (styling, renderer references); `typescript-advanced-types`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: amended design §2.8 (including its proof obligations); `decision-logs/2026-11-06-0035-variant-axes-role-aliases.md`; `src/resolve.ts:16`; `src/react/renderer.tsx:306-310` (`slot`).
    - Options Considered: as in the design and Task 1.
    - Chosen Approach: the amended design.
    - API Notes and Examples:
      ```tsx
      <Button variant="ghost" tone="critical" label="Delete" />
      ```
    - Files to Create/Edit: `src/formats/catalog.ts`; `src/formats/design-system.ts`; `src/resolve.ts`; `src/css/design-system.ts`; `src/css/` class helpers; `src/react/renderer.tsx`; `src/sdk/gen.ts`; `src/conformance/`; schemas; corpus; proof fixtures; `docs/spec.md` §5, §6; `docs/styling.md`; `docs/formats.md`; `register-0.3.0.json`
  - Test Cases to Write:
    - `axis_must_name_enum_prop`; `axis_default_in_enum`; `axis_combination_limit`; `axis_overlay_cascade_order`; `role_alias_to_undeclared_role_rejected`; `tone_by_emphasis_four_pairs` (browser); `kinds_without_axes_byte_identical`; the alias edge cases listed in design §2.8 (matching, one-step rewriting, inheritance/state/axis precedence, placement, alpha, shadows, colour extensions and audit).
  - Notes (executed 2026-11-06):
    - Implemented the amended design (§2.1–§2.8) as written. `definition.axes` (≤ 3 axes, ≤ 16 values per axis, ≤ 256 combinations, enum string prop, default in the enum, values are tokens) is checked in `validateCatalog`; recipe keys accept `axis:value` in the variant position; an axis overlay may carry `roles`. `classifyCatalogChange` gains an axes branch: adding an axis or value is minor, removing an axis or changing a default is major. The shared helpers (`axisCombinations`, `variantKeys`, `nodeAxisValues`, `singleAxisKeys`) live in `src/formats/axes.ts`.
    - **Resolved-table key.** An axis kind's entries are keyed `<kind>.<variant>__<v1>__<v2>.<slot>.<state>` (axis values in declared order, defaults filled in): the same string the slot class carries, so the projection, `auditContrast` and the state-fixture conformance reuse the flat-table code unchanged, and kinds without axes keep their keys. `slotClass(kind, variant, slot, axes?)` appends the values; `<Surface>` computes them once per node from its props and the definition's defaults. `cascadeRecipes` fills each combination through `fillSlot`/`axisLayers` (two merged halves of the six-layer cascade, so the no-axes path and its hot loop are untouched); aliases are applied once to the resolved copy, never to shared shadow values.
    - **Error kinds.** The design names `invalid-prop` for malformed maps; following Task 4, the format validators keep their corpus-listed kinds: an axis that is not an enum string prop, an undeclared axis or value in a key, and an undeclared alias source, target or rewritten role are `unknown-name`; a default outside the enum, a non-name value, a cap overflow, a malformed `roles` map and `roles` on a wildcard or variant key are `invalid-document`. Alias errors point at `/recipes/<key>/roles/<from>`, prefixed `/registry/<id>` for an entry inherited from a parent (`inheritedPointer`). A cap check multiplies enum sizes instead of expanding combinations, so a hostile catalog cannot force a large allocation.
    - Alias edge cases pinned (`variant-axes.test.tsx`): the four tone × emphasis pairs; dot-boundary and longest-source matching (`accent` never touches `accented.fill`); one-step rewriting and identity entries; same-source precedence across axes (later axis wins), states (state beats rest, rest also rewrites the hover snapshot) and `extends` (child entry replaces the parent's, other sources inherited); alpha preservation including value-referenced alpha; inline and shared named-shadow colours; colour extensions rewritten and value extensions, typography and spacing untouched; rewrite to a role the vocabulary lacks (a declared family is not enough); literal colours rejected; aliased combinations audited. The install check found a real adoption edge while building the cost fixture: `accent.fill` also covers `accent.fill.hover`, so a catalog that declares both needs both sources aliased.
    - Conformance: `catalogSuite`'s example rule also requires one example per axis value (one axis at a time); `designSystemSuite` fails when an axis combination's slot class is not projected; the styled-state fixtures for an axis kind are keyed by the class position and required for the defaults plus each non-default value one axis at a time; `rendererSuite`'s root-class case includes axis values. The proof catalog is left without axes (adding one would renumber the shared proof fixtures); the browser four-pairs test and the cost fixture use the proof Certified theme and a derived catalog (`src/__tests__/fixtures/axes.ts`).
    - Tests: `src/__tests__/variant-axes.test.tsx` (the plan's cases, the §2.8 edge cases, SSR classes, off-enum rendering the fallback only), `tone_by_emphasis_four_pairs` in `css-browser.test.ts` (four distinct computed colour pairs from two alias entries), `switch_under_budget_with_a_two_axis_kind_installed` in `css-scope-browser.test.ts`, and 10 corpus cases (valid and invalid catalogs and design systems, an off-enum and a valid axis tree, three shared documents). Existing `recipe_schema_uses_the_fixed_property_vocabulary` now expects `roles`; the schema-publisher test copies `src/formats/axes.ts`.
    - Docs and registers: spec §5 (`axes`), §6.2 (the six-layer cascade, variant axes and the seven alias rules, replacing the "pending implementation" paragraph), §6.4 (class suffix), §13 (example and fixture coverage); `docs/formats.md`, `docs/styling.md` ("Variant axes"), `docs/conformance.md`, `docs/migration-0.3.md`, `docs/compatibility.md`, `CHANGELOG.md`; `register-0.3.0.json` (reasons extended for `catalog.json`, `design-system.json`, `Definition`, `Recipe`; `./css slotClass` widened with the host action; 20 corpus files added); regenerated `schemas/catalog.json` and `schemas/design-system.json`. `liveframe gen` needed no change: an axis is an ordinary enum prop, so generated types and element schemas already carry it.
    - Cost (`plans/evidence/027-axes-cost.md`): kinds without axes project byte-identical sheets (152,457 and 164,425 B) at the same time as `HEAD` within noise; a 24-combination button (4 variants × 3 × 2) grows the proof sheets by +104.5% / +105.8% (about 8 KB per added combination, 91% of it the expansion itself); projection time is 0.93×–1.06× the linear extrapolation (gate ≤ 1.1×); the warm switch stays 3.5–5.7 ms (budget 16.67 ms) with the axis kind installed. The `agent-home` 2% validator/render gate is re-run with Task 8's `bun run bench`: the validator does not read `axes` and the renderer adds work only for definitions that declare them.
    - Verification: `timeout 900 bun run check` passed (1,163 passed, 4 existing skips, 0 failed); build, `gen:check`, typecheck, lint and format check pass. No threshold was changed. WebKit and Firefox runs remain in the whole-plan verification.

- [x] Task 6: App-declared recipe states and semantics values (W8a)
  - Acceptance Criteria:
    - Functional:
      - `vocabulary.states?: Record<name, { attribute: "data-<name>", description }>` adds app states. Names must not collide with library states, match `^[a-z][a-zA-Z0-9]*$`, ≤ 16 per catalog. Recipes may key them; the projection matches only `[data-<name>]` (and `:where()` wrapping as for library states); source order places app states after `invalid` and before `disabled`, in declared order. Forced colours: an app state whose resolved recipe differs from rest gets the `hover/active/open` cue (1px `Highlight` outline). Completeness is unchanged (states stay optional overlays).
      - `vocabulary.semantics?: Record<name, { role: <ARIA role from a fixed allowlist>, description }>` widens the `semantics` prop domain on layout primitives. The library's ARIA role allowlist is published; implementations decide the element.
      - Write `decision-logs/<date>-app-declared-states-and-semantics.md` (owner approval) before implementing, recording the source-order and forced-colours choices.
      - `designSystemSuite` requires a state fixture for each app state that differs from rest, as it does for library states.
    - Performance: CSS projection non-regression; no render-path cost.
    - Code Quality: library states and app states share one ordered list built at catalog compile time.
    - Security: law 3 — app states only select on data attributes; no selector text is authored.
    - Compatibility: `widened` for vocabulary, design-system recipe keys, `semantics` validation.
  - Approach:
    - Skills to Use: `create-decision-log`; `liveframe-execution` (styling).
    - Library Documentation to Check Before Implementation: WAI-ARIA 1.2 role list via `find-docs` (for the allowlist).
    - Documentation Reviewed: `src/formats/fixed.ts:9-41`; spec §5 (semantics), §6.2 (states), §6.4 (state table, forced colours).
    - Options Considered: arbitrary selectors per state. Rejected: law 3 (no authored selectors). App states before `hover`. Rejected: states must beat rest-like interactions; after `invalid` keeps `disabled` last.
    - Chosen Approach: data-attribute-only app states; ARIA-role-mapped semantics.
    - API Notes and Examples:
      ```jsonc
      "states": { "dragging": { "attribute": "data-dragging", "description": "Being dragged." } },
      "semantics": { "toolbar": { "role": "toolbar", "description": "A set of controls." } }
      ```
    - Files to Create/Edit: `src/formats/vocabulary.ts`; `src/formats/fixed.ts`; `src/formats/design-system.ts`; `src/css/design-system.ts`; `src/validate/` semantics check; `src/conformance/design-system.ts`; schemas; corpus; `docs/spec.md` §5, §6; `docs/styling.md`; `docs/formats.md`; `register-0.3.0.json`; decision log
  - Test Cases to Write:
    - `app_state_collides_with_library_state_rejected`; `app_state_projects_data_attribute_selector`; `app_state_source_order`; `app_state_forced_colours_cue`; `app_semantics_value_accepted`; `unknown_semantics_still_rejected`; `aria_role_outside_allowlist_rejected`.
  - Notes (executed 2026-11-06):
    - **Decision.** `decision-logs/2026-11-06-1711-app-declared-states-and-semantics.md` records the source-order and forced-colours choices as the task specified them, plus the answer to a question the task left open. The library enforced no `semantics` enum before this task (`fixed.ts` only exported a list; each catalog declares its own enum), so "widen the prop domain" had no code to widen. The owner chose the **declarative contract**: `vocabulary.semantics` is validated install data, and a definition's string enum prop named `semantics` may hold only library values and declared names (`unknown-name` at the enum item).
    - **States.** `vocabulary.states` (≤ 16, `^[a-z][a-zA-Z0-9]*$`, not a library state) maps a name to `{ attribute, description }`; `attribute` must equal `data-` plus the kebab-case name (`dragOver` → `data-drag-over`, `stateAttribute`) and must not be a library state's attribute (`libraryStateAttributes`). The recipe key's state token in the published schema is now any name; install checks it against `isCatalogState`, so an undeclared state is `unknown-name` only (0.2.3 also reported `invalid-document`). `RecipeKey` ends in any string. One list, `catalogStates(vocabulary)`, serves the cascade (`cascadeRecipes`, axis layers), the audit and the projection; a catalog without app states gets the library array itself, so resolved tables and CSS bytes are unchanged (the existing CSS byte baselines pass).
    - **Projection.** `stateSelectorsFor(vocabulary)` inserts `[data-<attr>]` after `invalid` and before `disabled` in declared order; app states join no hover/press suppression. Forced colours: `forcedStateCue(state)` returns the library cue, else the 1px `Highlight` outline that `hover`, `active` and `open` use; an app state equal to rest emits no rule and no cue. `rendererBrowserSuite` (`styledStates`) now derives its required fixtures and selectors from the catalog, so a styled app state needs a fixture keyed `<kind>.<variant>.<state>`; no new `designSystemSuite` case was needed, because installing and projecting an app-state design system already runs through its existing cases.
    - **Semantics.** `ariaRoles` (29 ARIA 1.2 landmark, document-structure and live-region roles that need no required state or accessible-name rule; no `heading`, `img` or widget roles) joins the root export. Entries use `{ role, description }`; a name colliding with a library value or a role outside the allowlist is `invalid-document`. Documentation Retrieved: Context7 `/w3c/aria-practices` returned the landmark and live-region pages; the role names are the ARIA 1.2 taxonomy, not read from the spec text through a tool.
    - **Catalog classification.** `classifyCatalogChange` treats adding a state or semantics value as minor, removing one or changing a state `attribute` or a semantics `role` as major, and a description-only change as none.
    - **Tests.** `src/__tests__/app-states.test.ts` (the plan's seven cases plus name bounds, cascade, classification, the no-app-state projection); `app_states_are_audited_like_library_states` (contrast audit); `app_state_matches_its_data_attribute_and_disabled_still_wins` (Chromium); `app_states_require_fixtures_when_a_system_styles_them` (conformance); a corpus set of 17 files (valid catalog and design system, five rejected catalogs, an undeclared-state design system, a shared `common/app-states-catalog.json`). `design_system_structure_agrees_with_schema` now states that the schema accepts any state token and install rejects `busy`; the typed-key assertion `States are fixed` became `A key ends in a state`.
    - **Breaking-aware changes recorded.** Two tightenings affect existing documents and are registered and documented: the `semantics` enum check, and the unknown-state error set. The existing corpus case `design-system/unknown-state.json` therefore changed (it now expects `unknown-name` only), registered as `changed` with the migration section "Semantics enums and recipe states follow the vocabulary" (Before/After/checklist). Other register entries: `ariaRoles` added, `RecipeKey` widened, `Vocabulary`/`Recipe`/`catalog.json`/`design-system.json` reasons extended, 17 new corpus files added.
    - **Docs.** Spec §5 (vocabulary type, allowlist and checks, layout `semantics` note), §6.2 (states), §6.4 (source order, app-state paragraph, forced-colours row), "fixed by the library" sentence; `docs/formats.md`, `docs/styling.md` ("App states", "App semantics"), `docs/conformance.md`, `docs/migration-0.3.md`, `docs/compatibility.md`, `CHANGELOG.md`.
    - **Verification.** `timeout 890 bun run check` passed (1,178 passed, 0 failed). Two earlier full runs failed on the migration-guide and spec-structure documentation tests and the register host-action test, all fixed; lint's complexity limit for `slotRules` led to moving the cue lookup into `forcedStateCue`. Not run: the performance bench (`designSystemCss`; Task 8 runs `bun run bench` once), WebKit/Firefox and `demo:test` (whole-plan verification). The demo catalog, proof catalog and corpus proof catalog still validate.

- [x] Task 7: A `url` string form with a scheme allowlist (W8b)
  - Acceptance Criteria:
    - Functional:
      - The schema language's string form gains `url?: { schemes: string[]; relative?: boolean }` (1–16 lowercase schemes matching RFC 3986 `scheme`). It is allowed in catalogs, capabilities **and** widget schemas (it is not a regex).
      - The check is hand-written and host-API-free (no `URL` global in the root export). It rejects C0 controls, space, tab and newline anywhere in the value, which removes every input a browser would strip or rewrite before reading the scheme. It then reads the scheme (`ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )` before the first `:`) and compares it case-insensitively with the allowlist. A value with no scheme passes only with `relative: true`. A protocol-relative value (`//host…`) and a backslash-led value (`\\host…`) are always rejected. Failure is `invalid-prop` with `expected` naming the allowed schemes.
      - `Infer` maps it to `string`; `liveframe gen` documents the schemes in the prop doc; JSON Schema output is `{ type: "string", pattern: <generated, linear anchored pattern>, … }` so external validators agree; a corpus case pins `javascript:`, `JaVaScRiPt:`, `java\tscript:`, `//evil.example` and `data:` as rejected under `["https"]`.
      - `docs/security.md` "URL-valued props" changes from "the catalog's problem" to "declare `url`"; the proof and demo catalogs use it on `link.href` and `image.src`.
    - Performance: linear in string length; validator bench non-regression.
    - Code Quality: one `checkUrl` function shared by the compiled validator and install validation.
    - Security: closes the `javascript:` XSS class for catalogs that declare it; law 2.
    - Compatibility: `widened` for `schema-language.json`, `StringSchema`.
  - Approach:
    - Skills to Use: `liveframe-execution` (formats); `typescript-advanced-types`.
    - Library Documentation to Check Before Implementation: WHATWG URL Standard scheme state (tab/newline stripping) via `find-docs`; RFC 3986 §3.1.
    - Documentation Reviewed: spec §5 (schema language, widget schemas carry no `pattern`); `docs/security.md`; `src/schema.ts:6-14,163-195,265-288`.
    - Options Considered: `format: "uri"`. Rejected: JSON Schema's `format` is annotation-only by default and has no scheme allowlist. Use the `URL` global. Rejected: the root export needs no non-ECMAScript globals (§13).
    - Chosen Approach: a closed keyword with a hand-written linear check.
    - API Notes and Examples:
      ```ts
      href: str({ maxLength: 2048, url: { schemes: ["https", "mailto"], relative: true } })
      ```
    - Files to Create/Edit: `src/schema.ts`; `src/validate/schema.ts`; `src/formats/` schema-language source; `src/sdk/gen.ts`; `schemas/schema-language.json`; corpus; `src/__tests__/fixtures/proof/catalog.json`; `examples/demo-host/catalog.json`; `docs/spec.md` §5; `docs/security.md`; `docs/formats.md`; `register-0.3.0.json`
  - Test Cases to Write:
    - `url_rejects_disallowed_scheme_case_insensitive`; `url_rejects_embedded_tab_and_newline`; `url_rejects_protocol_relative`; `url_relative_only_when_allowed`; `url_allowed_in_widget_schema`; `url_json_schema_agrees_with_checker` (differential over the corpus).
  - Notes (executed 2026-11-06):
    - **Keyword.** `url?: { schemes: string[]; relative?: boolean }` on the string form (1–16 unique lowercase RFC 3986 schemes, at most 32 characters each). The meta-schema (`src/formats/language.ts`) carries it in both `languageForms(true)` and `languageForms(false)`, so widget schemas keep it while still refusing `pattern`. Published `schema-language.json`, `catalog.json`, `capabilities.json` and `manifest.json` regenerated.
    - **One check.** `src/url.ts` holds `checkUrl`, shared by the compiled validator (`src/validate/schema.ts`) and `checkValue` (`src/schema.ts`). One linear pass: any byte `<= 0x20` rejects; the scheme is read up to the first `:` and compared after ASCII lowercasing; no scheme passes only with `relative: true`, and never when the value starts `//`, `/\` or `\\`. Compiled failures are `invalid-prop` with `expected` naming the schemes; `checkValue` reports `invalid-document` as for every keyword. No `URL` global.
    - **Decision beyond the plan.** `url` and `pattern` may not appear on the same schema (`invalid-document` at `/url`), so the JSON Schema output has one unambiguous `pattern`. A value starting `/\` is rejected with `//` (a browser treats the backslash as a slash). Not logged as a decision: both tighten only a new keyword.
    - **JSON Schema agreement.** `urlPattern(rule)` generates an anchored pattern (a control-class lookahead, then an allowed scheme or the negation of "starts with a scheme" and of the protocol-relative starts); `liveframe gen --elements-schema` emits it. `url_json_schema_agrees_with_checker` runs 34 values over four rules through the checker, a `u`-flag `RegExp` and Ajv strict mode, and `url_pattern_is_linear` times a 200k-character near miss.
    - **Gen.** A top-level `url` prop gets the doc comment `/** Expects a URL with scheme https or a relative reference. */` in `ui.gen.ts`. Nested `url` strings (inside an object or array prop) are documented only by the schema, not by a comment.
    - **Catalog classification.** `classifyCatalogChange` compares `url` by parts: adding the rule, removing a scheme or dropping `relative` is major; removing the rule, adding a scheme or enabling `relative` is minor.
    - **Catalogs.** The proof catalog (`proof/catalog/definitions.ts`, regenerated into `src/__tests__/fixtures/catalog.json` and `fixtures/proof/catalog.json`, then `ui.gen.ts`, `ui.definitions.gen.ts`, `elements.schema.json` and the MCP text golden) uses `{ schemes: ["https"], relative: true }` on `image.src` and `link.href`; it replaces the old hand-written patterns, so bare relative paths such as `a/b.png` now pass. The Phase 0 proof runtime's `checkSchema` calls `checkUrl`. The demo catalog (`examples/demo-host/catalog.json`) declares no URL-valued prop, so it has nothing to change. The frozen corpus `common/proof-catalog.json` is untouched.
    - **Tests.** `src/__tests__/url.test.ts` (the plan's six names plus `url_keyword_is_closed`, `url_pattern_is_linear`, gen documentation and classification); corpus: `common/url-catalog.json`, `ui-tree/url-valid`, `ui-tree/url-scheme-rejected` (pins `javascript:`, `JaVaScRiPt:`, `java\tscript:`, `//evil.example`, `data:` and `\\evil.example` under `["https"]`), `catalog/url`, `catalog/url-with-pattern` (9 files, registered `added`). `schema_publisher_detects_drift` copies its source list, so `src/url.ts` joined it.
    - **Register.** `widened`: `schemas/{capabilities,manifest,schema-language}.json`, `LanguageSchema`, `str`; `catalog.json`'s reason extended. No `changed` entries: nothing existing becomes invalid. `StringSchema` is not exported, so it needs none.
    - **Docs.** Spec §5 (schema-language forms, new "URL strings" paragraphs, widget-schema note), `docs/security.md` ("URL-valued props: declare `url`"), `docs/formats.md` (builder table, URL paragraph, widget schemas, classification), `docs/migration-0.3.md` (Compatible additions "URL strings"), `CHANGELOG.md`.
    - **Verification.** `timeout 600 bun run check` passed (1,188 passed, 0 failed, 4 skipped). Not run: `bun run bench` (Task 8 runs it once; the string check adds one pass only to props that declare `url`), WebKit/Firefox and `demo:test` (whole-plan verification).

- [ ] Task 8: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: the twelve impact areas swept against Tasks 1–7 in `plans/evidence/027-impact-analysis.md`; findings presented, dispositions recorded and executed or backlogged.
    - Performance: `bun run bench` once (switch span A, CSS, validator, render).
    - Code Quality: findings cite `file:line`.
    - Security: law 3 reviewed against every new style input.
  - Approach:
    - Skills to Use: `create-plan`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: this plan's notes.
    - Options Considered: n/a.
    - Chosen Approach: the standard final task.
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `plans/evidence/027-impact-analysis.md`; `plans/backlog.md`.
  - Test Cases to Write: n/a.
  - Notes (executed <date>):

## Verification (whole plan)

- `timeout 900 bun run check`
- `LIVEFRAME_BROWSER=webkit timeout 900 bun test --conditions liveframe:source src/__tests__/css-browser.test.ts src/__tests__/react-browser.test.tsx` and the same for `firefox`
- `timeout 900 bun run bench`
- `bun run demo:test`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
