# Changelog

All notable changes to `@arnilo/liveframe` are recorded here. The project follows the compatibility policy in [`docs/compatibility.md`](docs/compatibility.md).

## Unreleased

Added:

- Several catalog majors in one renderer: `createRenderer({ catalogs: [{ catalog, implementations }, …] })` from `@arnilo/liveframe/react` runs the registry check per catalog, and a `<Surface>` draws with the catalog its `validator` was compiled for, so surfaces of two catalog majors share a page. A tree that names another catalog is now refused with `catalog-mismatch` at `/catalogId` (it was `invalid-prop`). [Two catalog majors on one page](docs/renderer.md#draw-two-catalog-majors-on-one-page).

- Package dependencies, format and packing: a code package whose manifest declares `exports` is a **library**, and a widget imports its names as `import { TaskCard } from "liveframe:lib/<id>@<version>"`. `pack(draft, { catalog, capabilities, libraries })` resolves the imports against supplied library packages (`unknown-name` for a name not exported, `not-found` for a library not supplied), does not copy library code, emits one `import * as __lf_lib<N> from "liveframe:lib/…";` line per library after the SDK lines and records `manifest.dependencies` (`{ id, version, hash }` pins, at most 16 direct, 32 in the graph, 4 deep, no cycle). The package hash covers the pins. `verifyPackage(pkg, { …, libraries })` re-checks pins, names and the graph, and without `libraries` checks that the code's library lines are the manifest's pins. `rebindDependencies(pkg, { libraries, version })` returns a new package whose pins moved to new library versions without transpiling again. Template packages may not declare `exports` or `dependencies`. Packing a widget with two libraries took about 0.4× the time of bundling the same components. See [sharing components](docs/packages.md#share-components-between-widgets).

- Declarative state migration: a manifest may declare `migrateState`, a map from a `state` key to a template expression whose only root is `previous`, the stored state. When a stored state fails the new version's schema, `loadPlacement`, `verifyPlacementInputs` and `renderPlacement` start from `initialState`, overlay each evaluated key and, if the result fits, return it with `migrated` (the original failures) instead of `reset`; `renderPlacement` raises `state-migrated` and `Served` carries `migrated`. A failed or non-fitting migration still resets. Install rejects a key outside the state schema and an expression that reads anything but `previous`. See [migrating state](docs/packages.md#migrating-state-across-versions).
- Catalog upgrade report: `checkPackages(packages, { catalog, capabilities, runner? })` from `@arnilo/liveframe/pack` runs `verifyPackage` over each stored package and, when a `runner` is supplied, renders every scenario and validates the tree on the host, returning `{ id, version, hash, ok, errors }` per package (scenario errors are prefixed `/scenarios/<n>`). It mutates and stores nothing and never defaults a runner, so a code package renders only through the runner the caller trusts. `liveframe check-packages <store-dir> --catalog <file> --capabilities <file>` prints the report as JSON for a `fileStore` (template packages are rendered with `templateRunner`; code packages are only verified, since the CLI never runs widget code) and exits 1 when any package fails. 1,000 template packages check in about 0.7 ms each. See [upgrading the catalog](docs/packages.md#upgrading-the-catalog).

- Stateless host pipeline (render): `@arnilo/liveframe/host` exports `renderPlacement(args)`, which fixes the order of load, bind, resolve-as-the-viewer, fit, skip, render, host validation and diff, and returns a `Served` the host stores and hands back as `previous`. The host injects `store`, `runner`, `resolve` and `onEvent`; the library keeps no state. A re-render with unchanged inputs is skipped, a runner's tree is validated on the host before it can be served, a failed source becomes the widget's `sourceOutcome` envelope (or fails the render at `/data/<alias>`) without copying the resolver's error text, and frozen `HostEvent`s carry ids and reasons, never values. Pipeline overhead is 0.13–0.16 ms beyond `loadPlacement`, the runner and the resolver. See [spec §7.7](docs/spec.md#77-the-host-pipeline) and [the host guide](docs/host.md).

- Stateless host pipeline (intents): `handleIntent(args)` from `@arnilo/liveframe/host` runs `checkOffered`, then either persists a `setState` write after re-checking it against the manifest, or calls the host's `authorize` and `dispatch` as the viewer, records the `ActionStatus` (`pending`, `ok`, `failed`, `refused`, at most 64 entries) and re-renders. A stale revision is refused, never rewritten; an offered but invalid action is recorded `refused` under the key the tree offered; a throwing `authorize` refuses and a throwing `dispatch` becomes `failed` with a fixed reason, so host text never reaches the widget. Ten `HostEvent`s now cover both functions. See [spec §7.7](docs/spec.md#77-the-host-pipeline) and [the host guide](docs/host.md#handle-an-intent).

- Stateless host pipeline (coordination): `dependents(placements, { source, params? })` from `@arnilo/liveframe/host` returns the ids of the placements whose bound sources a change touches, so one widget's action can refresh another's view through a shared capability, with no new format and no subscription registry. A pure linear scan over `Served.bound` (0.06 ms for 1,000 placements). See [coordinate placements](docs/host.md#coordinate-placements).

- Localisation contract: [spec §7.1](docs/spec.md#71-widgets) states that locale, direction and time zone reach a widget only through `context` (conventional keys `locale`, `direction`, `timeZone`), that a widget calling `Intl` is deterministic only within one runtime build so a cross-runtime `renderKey` cache is unsafe for it, and that templates have no locale-dependent operator. New [localisation guide](docs/localisation.md); the proof agent-home widget gains an optional `context.locale` and a `localised` scenario whose `queue.checked` source is bound to it.

- Observability events: `<Surface onEvent>` and `createSurfaceCore({ onEvent })` receive frozen `SurfaceEvent`s (`arrival-rejected`, `stale-revision`, `emit-rejected`, `implementation-failed`, `binding-failed`, `confirm-dropped`) carrying ids, kinds, event names, revisions and `LiveframeError`s, never prop values. A throwing handler is contained and nothing is built without one. See [watch what the surface rejects](docs/renderer.md#watch-what-the-surface-rejects).

- The surface core: `@arnilo/liveframe/surface` exports `createSurfaceCore({ catalog, validator, onIntent, confirm?, domIdPrefix? })`, the host-API-free half of a renderer. It validates arrivals and applies the revision rules, builds a `NodeContext` for each node (effective props, slot classes, style, events, `emit`), completes and gates intents with single-flight confirmation, keeps the surface's local state, applies `setLocal` without calling `onIntent`, and evaluates `when` and `bind` incrementally, re-validating every bound value before a renderer sees it. `<Surface>` is now a thin adapter over it and its public API is unchanged: it applies `setLocal`, hides nodes whose `when` is false, and draws the node fallback for a failed binding. A 50-row live filter flips 9 rows in 1.7 ms (production React build) with no `onIntent` call. See [spec §11](docs/spec.md#11-renderer) and [writing another renderer](docs/renderer.md#writing-another-renderer).

- Local state and bindings: a manifest may declare `local` and `initialLocal` (a closed object of at most 32 scalar properties); a tree node may carry `when` and `bind`, browser-evaluated expressions from the template language narrowed to 27 operators and two roots (`local`, `self`), and an event may carry `setLocal`, which the renderer applies without calling `onIntent` and `checkOffered` rejects. The validator checks every expression against the manifest and the kind's props, bounds them (16 levels, 64 nodes, 16 `bind` entries, 10,000 expression nodes per tree) and keeps `refProps` targets and child-count bounds intact under `when`. `/sdk` exports `local`, `self` and `ex` and accepts `when` and `bind` attributes; templates pass them through and embed values with `$embed`; `liveframe gen` types them; `LocalIntent` and `TreeIntent` join the root types and `diffTrees`/`applyPatch` carry the new fields. See [formats](docs/formats.md), [the SDK guide](docs/sdk.md) and [migration](docs/migration-0.3.md#local-state-and-bindings).

- Node reference authoring: `/sdk` exports `ref(anchor)`, JSX and element JSON accept `$anchor`, and generated reference props use the root `NodeRef` marker type. Catalog `refProps` declare same-tree relations; rendering resolves them to string ids and validation rejects missing targets with `not-found`. See [the SDK guide](docs/sdk.md#node-references).

- Node references in the renderer: implementations receive `domId`, a per-surface DOM id (unique across surfaces, stable across re-renders), and `<Surface>` rewrites `refProps` values to the target's `domId` before they reach an implementation. `rendererSuite` gains `ref_props_resolve_to_elements_in_the_surface`. See [the renderer guide](docs/renderer.md#write-primitive-implementations).

- Extension recipe properties: `vocabulary.extensions` declares app-owned properties (`colour`, or `value` with a design-value kind), a recipe's `extensions` map sets them (colours from theme roles only), they merge by name through `extends` and the cascade, and the projection emits `--lf-p-<name>` for trusted primitive CSS. `extensionVar` joins `/css`; `designSystemSuite` checks each set extension reaches the sheet. A design system without extensions projects byte-identical CSS. See [the styling guide](docs/styling.md#extension-properties).

- Variant axes: `definition.axes` marks up to three enum props as recipe axes; recipes address them with `kind.axis:value.slot.state` overlays (a six-layer cascade) and may alias colour roles with a `roles` map, so tone × emphasis needs no product variants. Kinds with axes get axis-suffixed slot classes (`lf_<kind>_<variant>__<value>_<slot>`, `slotClass(kind, variant, slot, axes?)`); kinds without axes keep their classes and CSS bytes. A catalog's kinds with axes together have at most 512 combinations. `auditContrast`, `catalogSuite` and the styled-state coverage know axes. See [the styling guide](docs/styling.md#variant-axes).

- App-declared states and semantics values: `vocabulary.states` adds recipe states selected by one data attribute (placed between `invalid` and `disabled`, with the forced-colours `hover` cue), `vocabulary.semantics` maps app `semantics` values to an allowlisted ARIA role (`ariaRoles` joins the root export), and `RecipeKey` ends in any state name. A definition's `semantics` enum may now hold only library values and declared names, and an undeclared recipe state is reported as `unknown-name` only. `rendererBrowserSuite` requires a fixture for each styled app state. See [app states](docs/styling.md#app-states) and [migration](docs/migration-0.3.md#app-declared-states-and-semantics-values).

- URL strings: a `string` schema accepts `url: { schemes, relative? }`, a scheme allowlist checked by one linear function (no `URL` global) in catalogs, capabilities and widget schemas. It rejects control characters and spaces anywhere, compares the scheme case-insensitively, and never accepts `//host` or backslash-led values; failure is `invalid-prop`. `liveframe gen` documents the schemes and the element and published schemas carry an equivalent `pattern`. See [formats](docs/formats.md#the-schema-language) and [migration](docs/migration-0.3.md#url-strings). `catalogSuite` adds `url_props_declare_a_url_rule` for URL-named props that declare no `url` rule, `pattern` or `enum`.

- Template widgets (format and validation): `liveframe-template/1` is element JSON plus a bounded, JSON-structured expression language (38 operators, no strings to parse, no globals, counted work). `@arnilo/liveframe/template` exports `validateTemplate(doc, { catalog, capabilities, manifest })`, `checkExpression`, `evaluate` and the `Template` types; `schemas/template.json` publishes the transport schema. Install checks every path, binding, intent, directive and component use against the manifest and reports `unknown-name`, `invalid-prop`, `invalid-children`, `missing-key` and the rest at pointers into the template. See [formats](docs/formats.md#template-widgets), [spec §7.6](docs/spec.md#76-template-widgets) and [migration](docs/migration-0.3.md#template-widgets).
- Template packages: `pack({ template, manifest, scenarios }, install)` returns a `liveframe-package/1` package whose `template` field replaces `code`; a package holds exactly one of the two, and a 0.2.x verifier rejects a template package fail-closed. The hash covers whichever is present (a code package's hash is unchanged), `verifyPackage()` re-validates the template, and stores, `loadPlacement()` and `renderKey()` need no change. `templateRunner()` (`/preview`) renders template packages without loading any code and refuses code packages; `inProcessRunner()`, `workerRunner()` and `renderTemplatePackage()` (`/runner-kit`) render them too, with identical trees. `RunnerOptions.limits` accepts `steps`. `conformance/hash/template-packages.json` and `conformance/corpus/package/template-*.json` are new. See [packages](docs/packages.md#template-packages), [spec §7.3](docs/spec.md#73-packages) and [migration](docs/migration-0.3.md#template-packages).
- Template widgets render: `renderTemplate(template, inputs, { validator, surfaceId, revision })` from `@arnilo/liveframe/template` expands a validated template and returns the same validated tree as `render()` (key-path ids, the single build pass, bounded errors). `limits.steps` (default 1,000,000) bounds evaluation; errors point into the template. A template port of each proof widget renders a tree equal to the TSX widget's over every proof scenario at 2 µs per output node. See [spec §7.6](docs/spec.md#76-template-widgets).

- Template widgets in preview and authoring: `createPreview().update`, `createAuthoring().packDraft` and the MCP `pack_draft` accept `{ template, manifest, scenarios }`, and `pack_draft({ dir })` reads a directory holding `template.json`. `generateTemplateSchema(catalog, { manifest?, capabilities?, structuredSubset? })` in `/sdk/gen`, `liveframe gen --template-schema [--manifest <file>] [--capabilities <file>] [--structured-subset]` and `generated_types({ module: "templateSchema", manifest? })` emit a per-catalog JSON Schema (`urn:liveframe:template-schema:1`) an LLM can target. The outsider guide is [docs/templates.md](docs/templates.md); the demo host installs a template widget that reads a source and pages through `state`.

- Streamed element JSON: `streamElements({ validator, surfaceId, revision?, limits?, maxErrors? })` in `/sdk` returns `{ push(chunk), end() }`. It reads element JSON incrementally (linear in the text, bounded by `limits.bytes`) and returns a valid tree of the nodes completed so far after each chunk that changed them; `end()` returns what `renderElements` returns for the whole text, and successive trees are valid `diffTrees` inputs. Malformed JSON is `invalid-document` at `/$stream/<offset>`. See [the SDK guide](docs/sdk.md#draw-agent-json-while-it-streams) and [spec §7.2](docs/spec.md#72-the-sdk).

- Action results: the host reports each action's status to a widget as the optional input `actions: Record<string, ActionStatus>` (`pending`, `ok`, `failed` or `refused`, with `reason`, `at`, `action` and an `ok` `value`), keyed by action name or by an intent's `resultKey` (`action(name, args, { resultKey })`). A capability may declare `result`, the shape of an `ok` value; `actions` is validated before the widget runs (`invalid-prop` at `/actions/<key>`) and an absent input is `{}`. `render()`, the runners, template widgets (root `actions`), scenarios, preview sessions and `render_scenarios` carry it, and `renderKey` hashes it, so every key differs from 0.2 (`conformance/hash/render-keys.json`). `WidgetProps` gains a required `actions` and `WidgetInputs` is its input form with `actions` optional. See [the renderer guide](docs/renderer.md#report-action-results), [spec §8](docs/spec.md#8-interaction-synaptas-three-tiers) and [migration](docs/migration-0.3.md#action-results).

- `/store` exports `verifiedPackages({ max? })`, an optional host-owned LRU passed as `{ verified }` to `loadPlacement`. Matching content and installation documents reuse package verification; stored structure, content hashes, placement identity, params and state are checked on every load.

- `createPreview()`, `createAuthoring()` and the MCP `AuthoringConfig` accept `limits` for node count, depth and tree bytes, enforced by both the runner and host validation. Defaults and authoring response bounds are unchanged.

Changed:

- Structural format validators and published JSON Schemas share one definition per format. Install-time references, recipe completeness and contrast remain separate checks; published schema bytes and public declarations are unchanged.

- `<Surface>` keeps keyboard focus by default when an update removes the focused element. Set `focusContinuity={false}` to retain the previous behaviour; see [the migration guide](docs/migration-0.3.md#surfaces-keep-focus-by-default).

- Document validators consistently reject foreign-realm plain objects with `invalid-document` and the instruction to parse inside the sandbox. Compile and module-render errors identify the input document. See [migration](docs/migration-0.3.md#foreign-realm-documents-are-rejected-everywhere).

- Dimension style props reject `fr` values, including responsive values, with `invalid-prop`. Grid tracks still accept fractions. See [migration](docs/migration-0.3.md#fractions-on-dimension-props-are-rejected).

- Packages and outcome scenarios are deeply frozen owned copies; rendering gives widgets frozen copies while preserving caller ownership. See [migration](docs/migration-0.3.md).
- **Specification layout:** the same numbered sections now open with rules, followed by contract details and rationale. Historical comparisons and proof results moved to `docs/compatibility.md`; the normative contracts and four laws are unchanged.

Fixed:

- SDK keys containing lone UTF-16 surrogates return a typed `invalid-prop` error instead of throwing `URIError` while building a primitive or fragment id. Valid surrogate pairs and key-path escaping are unchanged.

## 0.2.3 — 2026-11-04

A host upgrading from 0.2.2 needs no API or data migration; the API register is empty. See the [compatibility notes](docs/compatibility.md#023) for invalid-input outcomes and the [adopter notes](docs/adopters-0.2.md#023--review-fixes-and-simplification) for remaining limits.

Fixed:

- **Custom runner trees are validated on the host:** `createPreview()` and `createAuthoring()` now pass every tree a custom `Runner` returns through the draft's compiled validator before storing or reporting it. A runner that returned an invalid or cyclic tree used to be reported as `ok: true` by `session.render()`, `renderOutcomes` and the `render_scenarios` tool, and a cyclic tree could overflow the stack. They now report the validator's typed errors. Trees from `inProcessRunner()` and `workerRunner()` are unchanged. Only trees that already violated the spec change outcome.
- **Top-level `await using` is rejected:** `checkModule`, and so `pack()`, `bundle()` and `verifyPackage()`, now fail `await using` outside a function (also in a top-level block or `for (await using …)`) with the existing `invalid-document` error. A never-settling `Symbol.asyncDispose` could suspend a module like top-level `await`. `await using` inside an `async` function and synchronous `using` are accepted as before.
- **Failed module links no longer take a cache slot:** `loadModule` no longer caches a package whose SDK header cannot be linked, so such packages no longer count toward the `maxModules` bound.
- **A reassigned package field is no longer trusted as verified:** the reference runners remembered a verified package by object, so replacing `code` (or `hash`, `format`, `manifest`, `scenarios`) after verification loaded the new code under the old verified hash. They now remember the references they verified and hash again when any of them changed. Mutating inside `manifest` or `scenarios` is still not detected; freezing is planned for 0.3.0.
- **Worker error results are shape-checked:** `workerRunner()` re-validated every successful tree but passed a failed result through as sent. A result that is not `{ ok, value }` or `{ ok: false, errors }`, or whose `errors` list is empty, longer than 21 entries or holds a record with a non-string `kind`/`pointer`/`message`/`expected`/`nodeId` or any other field, now becomes one `render-failed` error ("Worker returned a malformed result") and the worker is recycled.
- **`fileStore().listPlacements()` fails closed on a corrupt record:** a placement file that holds `null`, an array, a scalar or an object without a string `id` made the listing return it, or throw a `TypeError` while sorting. It now throws the `invalid-document` `LiveframeFailure` that `read` already throws for invalid JSON, naming the file.

Added (tooling, not published):

- **Dependency audit and SBOM in CI:** CI and the publish job run `bun audit --prod --audit-level=high` and upload a CycloneDX 1.6 SBOM of the runtime closure (`scripts/release/sbom.ts`). A real publish now runs only from a `v*` tag, in the protected `release` environment. No published file changes.

Changed:

- **MCP draft-directory messages name only relative paths:** `pack_draft({ dir })` now reports `draft file "widget.tsx" in "a" not found`, `draft directory "a" not found`, or `… could not be read (EACCES)`, instead of an operating-system error containing an absolute host path. The `kind` and `pointer` are unchanged. `docs/mcp.md` states the `draftRoot` trust model.
- **`sucrase` is bundled into `dist/pack/`, so a consumer no longer installs its dependencies:** `@arnilo/liveframe` now depends only on `acorn`. `commander`, `mz`, `thenify`, `pirates`, `tinyglobby` and the other packages sucrase pulled in with caret ranges no longer reach `node_modules` through Liveframe. `pack()` output is byte-identical; `dist/pack/THIRD-PARTY-LICENSES` carries the licence text of every bundled package. A project that imported `sucrase` only because Liveframe installed it must now depend on it directly.
- **Simpler internals with the same public surface:** dead code and private exports removed, shared internal helpers and tree-byte accounting, and measured closure splits. Lint now fails on warnings. A deterministic differential suite checks install checkers against every published format schema; no schema drift was found.

Deprecated:

- **Fractions on dimension style props:** `width="2fr"` (and `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`) projects to `minmax(0, 2fr)`, which browsers ignore, so it has never had an effect. It is still accepted, and validation and CSS bytes are unchanged; 0.3.0 rejects it with `invalid-prop`. Use `grow={2}` with `basis={0}`, or put the fraction in the parent's `columns`/`rows`. See [`docs/compatibility.md`](docs/compatibility.md#deferred-to-030).

Added:

- **Store conformance case:** `storeSuite()` gains `store_lists_only_placement_records`, which fails a store whose `listPlacements()` returns anything but records with a string `id`. Existing cases are unchanged.

Performance (outputs, errors, hashes and declarations unchanged; ratios are paired interleaved runs on a loaded host, new/old):

- **`<Surface>` keeps node reuse with an inline `fallback` or a new `diagnostics` array:** the node cache now resets only when the validator or portal changes or diagnostics are turned on or off. With `fallback={<p>…</p>}` written inline and a parent that re-renders per arrival, unchanged primitives no longer re-render: whole-tree arrival plus React work 121 → 8.4 ms on the 679-node subject. A failed node still shows the current fallback.
- **Whole-tree reuse matches children by `id`:** inserting a row at the head of a list now reuses every existing row, where it used to reuse none. A reorder reuses the children but not their parent.
- **Faster hashing:** `sha256` 1.3–1.5×, `canonicalJson` 0.65–0.68, `packageHash` (512 KiB) 0.70–0.77. Benefits `pack()`, `verifyPackage()`, `loadPlacement()` and `renderKey()`.
- **`diffTrees` reorders in linear time:** 1,000 shuffled rows 0.57; unchanged and single-change diffs unaffected.
- **`bundle()` walks each module once:** 0.79–0.81 on the agent-home widget.
- **`themeCss` reuses a catalog it has already accepted:** a content-checked cache (8 entries) halves repeat calls (0.57); the first call per catalog content costs about 0.19 ms more.

## 0.2.3-rc.1 — 2026-11-04

Release candidate for the 0.2.3 changes above, published under the `next` dist-tag.

## 0.2.2 — 2026-11-03

This section shipped as `0.2.2-rc.2` first. `0.2.2-rc.1` was superseded before release: the release review brought the first-compile cost of `compileValidator` back inside 0.2.1's and fixed a stale catalog-cache hit.

[`docs/adopters-0.2.md`](docs/adopters-0.2.md#022--performance-and-accessibility-additions) maps 0.2.2 capabilities to what shipped. Under the [compatibility policy](docs/compatibility.md#022) (decision [2026-11-01-1747](https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md)), every addition and widening in 0.2.2 is additive under the opt-in and no-break rules.

Performance improvements include whole-tree node reuse in `<Surface>` (memoizing unchanged subtrees between whole trees on arrival) and compiled-validator caching in `compileValidator` (caching immutable catalog and capability closures across calls).

Added:

- **Source binding evaluation:** `bindSources(manifest, capabilities, { params, state, context })` evaluates manifest source bindings at request time without resolving data or granting authority.
- **Render cache key:** `renderKey({ hash, catalogId, params, state, data, context })` in `@arnilo/liveframe/pack` produces a stable SHA-256 hash in canonical JSON over a render's inputs, allowing hosts to skip re-renders and transfers when inputs are unchanged.
- **Recipe contrast audit:** `auditContrast({ theme, designSystem, catalog, registry?, minimums? })` and `ContrastFinding` in the root export resolve every `(kind, variant, slot, state)` recipe pair and measure contrast against WCAG 2.2 thresholds at install time.
- **Accessibility capture axes:** `CaptureMedia` and `CaptureMediaOptions` in `@arnilo/liveframe/preview/capture` define points and options on `textScale`, `forcedColors`, and `reducedMotion` media axes.

Widened:

- **Conformance contrast test:** `designSystemSuite` accepts optional `contrast: true | { minimums }` to fail on audit findings.
- **Focus continuity and async intents in renderer:** `createRenderer` / `SurfaceProps` gains an optional `focusContinuity` boolean to preserve keyboard focus on DOM element disconnection, and `SurfaceProps.onIntent` return type widens from `void` to `unknown` so a host callback may return a promise `emit` hands back.
- **Primitive async emit:** `ImplementationProps` widens `emit` to return `Promise<void> | undefined`: a promise that settles when the host's does when `onIntent` returns one, with the host's value dropped and a rejection contained.
- **Recipe states:** `states` and the recipe key pattern in `schemas/design-system.json` widen to include `current`, `mixed`, `pending`, and `readonly`, positioned in source order between `selected` and `invalid`.
- **Capture media axes:** `CaptureOptions`, `CaptureSession` (`emulate?(media)`), `CaptureCell`, `CapturedCell`, `CaptureInput` and `AuthoringCaptureCell` accept optional media axes and record media coordinates.

Deferred:

- **Node references:** Ratified in [decision 2026-11-02-1219](https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-11-02-1219-defer-node-references-to-0-3-0.md) and [`plans/evidence/022-node-reference-design.md`](https://github.com/ashiqrniloy/liveframe/blob/main/plans/evidence/022-node-reference-design.md); deferred to 0.3.0 under the no-break rule. Covers `./sdk` `ref`, root `NodeRef`, and `./schemas/*` `catalog.json` (`refProps`).

## 0.2.1 — 2026-11-01

This section shipped as `0.2.1-rc.1` first.

[`docs/adopters-0.2.md`](docs/adopters-0.2.md#021--clay-review-and-authoring-additions) maps Clay's 0.2.0 review requests (CL-10 to CL-16) and the authoring MCP review to what shipped. Under the [compatibility policy](docs/compatibility.md#021) (R15), every new export, error kind, corpus case, hash vector, optional format (`liveframe/tree-patch/1`), style prop (`deferOffscreen`) and MCP capability in 0.2.1 is additive: existing exports, format meanings, corpus expectations, hash vectors and whole-tree transport are unchanged. One visible MCP error-behaviour fix applies (Task 14.1 M2): a missing inline `pack_draft` key (`files`, `entry`, `manifest` or `scenarios`) now returns `isError: true` with a typed `LiveframeError[]` at that key's pointer instead of the MCP SDK's `Input validation error` string; non-object protocol `arguments` still fail at the protocol layer before the handler.

Added:

- **Validator bundle (CL-10):** `@arnilo/liveframe/validator.bundle.js` is a self-contained, import-free ES module re-exporting the root export (`compileValidator`, `checkOffered`, `capabilitiesFor`, `diffTrees`, `applyPatch`, `validateTreePatch`, every `validate*` format validator and the recipe resolver) with no SDK render path, `renderModule` or `linkPackage`, verified in a bare Node `vm` context with no globals added.
- **Package hash exports and vectors (CL-11):** `@arnilo/liveframe/pack` exports `canonicalJson` and `packageHash`, and `conformance/hash/packages.json` pins `{ package, hash }` vectors (`sha256-` plus lowercase hex SHA-256 of `canonicalJson({ format, manifest, code, scenarios })`).
- **Data `exports` (CL-13):** `./package.json`, `./conformance/corpus/*`, `./conformance/hash/*` and `./conformance/patch/*` resolve through package `exports` under Bun and Node without overlapping `./conformance` or `./conformance/react`.
- **Tree patches and subtree reuse (CL-15):** optional `liveframe/tree-patch/1` wire format (`@arnilo/liveframe/schemas/tree-patch.json`), `TreePatch`, `PatchOp`, `validateTreePatch`, `diffTrees(prev, next)`, `applyPatch(base, patch)` and the additive `stale-patch` `LiveframeError["kind"]` at the root export; corpus cases under `conformance/corpus/tree-patch/` and diff vectors under `conformance/patch/diff.json`; identity-keyed node context and element reuse in `<Surface>`. On the 679-node LF-17 streaming subject, patches measure 228 B gzip and 2.7 ms arrival validation plus React work (median).
- **Deferred offscreen style prop (CL-16):** the `deferOffscreen` style prop takes a `space.*` or `size.*` placeholder height (with responsive values). It projects to `content-visibility: auto` and `contain-intrinsic-block-size`, so a design-system switch on a long surface restyles and lays out only what is on screen. Existing trees are unchanged. A tree that uses it needs a 0.2.1 validator, because 0.2.0 rejects the unknown style prop.
- **Authoring MCP server and `/authoring`:**
  - `set_state({ origin: { nodeId, event }, value? })` and `/authoring` `setState()` apply an offered `setState` event through `session.intent` and return the re-rendered tree under the 256 KiB bound while refusing `action` events (law 4); `PreviewSession.render({ preserveState?: boolean })` lets bound preview pages and capture retain that state for the selected scenario.
  - `generated_types({ module? })` and `/authoring` `generatedTypes({ module? })` return `"types"` (default), `"implementations"` (`--implementations`) or `"elementsSchema"` (`--elements-schema`), byte-identical to `liveframe gen`.
  - `AuthoringConfig.draftRoot` opts the CLI's `pack_draft` into reading `{ dir, entry? }` draft directories with canonical real-path containment and 128-file / 1 MiB read bounds; `/authoring` stays inline-only and host-API-free.
  - Every MCP tool advertises a `title` and explicit `readOnlyHint`, `destructiveHint`, `idempotentHint` and `openWorldHint` annotations.
  - Every MCP tool declares a self-contained `outputSchema` and returns `structuredContent` on success alongside byte-identical 0.2.0 text blocks (using SDK 2.4.0's `{ result }` envelope for non-object roots on `2025-11-25` clients).
  - `AuthoringConfig.maxCaptureCells` and `createAuthoring({ maxCaptureCells })` configure the per-call capture cell bound from 1 to 48 (default 12).
  - `capture_preview({ layout: true })`, `/authoring` `capturePreview({ layout: true })`, `capture(url, { layout: true })` and `liveframe preview capture --layout` report each captured cell's structural `CellLayout` (`width`, `height`, `overflowX`, `overflowing` and per-node CSS-pixel boxes), and the proof agent loop checks layout structurally instead of by pixel height.

Fixed:

- **JSON-only intent cloning and runtime matrix (CL-10):** `complete()` copies and freezes intents in one JSON-only walk without `structuredClone`, `/authoring` counts UTF-8 bytes without `TextEncoder`, and the spec §13 and README runtime matrix lists the exact non-ECMAScript globals each host-API-free subpath needs, enforced by CI across source, `dist/` and bundles.
- **Foreign-realm error message (CL-12):** `validateJson` and `renderModule` detect when a rejected input object has another realm's plain `Object.prototype` and report that the JSON must be parsed inside the sandbox; `docs/packages.md` documents the realm requirement.
- **Package corpus integrity (CL-11):** `conformance/corpus/package/docs/valid.json` carries its real hash and package corpus cases run through `verifyPackage`, with failing `hash-mismatch` and `forbidden-import` cases.
- **Release dist-tags (CL-14):** `.github/workflows/publish.yml` and the `docs/compatibility.md` release checklist move `next` to the released version on non-prerelease publishes so `next` stays at or above `latest`.
- **Switching budget (CL-16):** answers 0.2.0's "Headless WebKit switching exceeds the 16.67 ms budget". The 16.67 ms budget is unchanged, and it now names its span: from the switching attribute change through style and layout of the switch frame (spec §6.4). The WebKit-only 25.1 ms test ceiling is gone, and every engine asserts 16.67 ms. Two changes made this hold in WebKit: the switching fixtures now load the app primitive CSS a host ships, and the agent-home queue rows defer offscreen rendering. On a quiet Linux machine, WebKit's slowest warm switch measured 9–11 ms on the CSS fixture and 13–14 ms through `<Surface>`. Under heavy concurrent load the WebKit tail still exceeds the budget.
- **Unadvertised `outcomes` argument (M1):** `render_scenarios` advertises its boolean `outcomes` argument in `tools/list`, matching `/authoring` and spec §13.
- **Missing-key error shape on `pack_draft` (M2):** removing top-level `required` from `pack_draft`'s input schema routes missing inline keys to handler validation so they return `LiveframeError[]` at `/files`, `/entry`, `/manifest` or `/scenarios` instead of the MCP SDK's validation string.

## 0.2.0 — 2026-10-30

This section shipped as `0.2.0-rc.4` first. `0.2.0-rc.1` and `0.2.0-rc.2` were tagged but never published: CI's `demo:test` ran on Bun 1.4.2, where `bun add --no-save` kept the registry `0.1.0` instead of the packed archive, and `scripts/demo-test.ts` now points the demo's dependency at the archive for the run. `0.2.0-rc.3` published without the four security reminders in the migration guide; `0.2.0-rc.4` adds them. No change to the package between any of the rounds.

[`docs/migration-0.2.md`](docs/migration-0.2.md) covers the three breaking changes; [`docs/adopters-0.2.md`](docs/adopters-0.2.md) maps every adopter request to what shipped.

Changed (breaking):

- **Breaking (0.2.0):** `<Preview>` requires `resultScenario`, the scenario its `result` was rendered for; it no longer infers the label from arrival order or the URL. New optional `selection` makes it controlled (`location` is neither read nor written) and `urlKey` prefixes the uncontrolled URL keys, so two previews can share a page. `data-lf-preview` publishes `urlKey` or `controlled: true`, and capture addresses a keyed page through `<urlKey>.scenario` (CL-01; see `docs/preview.md` for migration).
- **Breaking (0.2.0):** state storage now requires `(placementId, scope)`; pass `""` for shared state. Both reference stores isolate scopes and reject invalid scope strings. Placement deletion removes every scope. Existing 0.1.0 shared state files load without migration (LF-06).

Added:

- **Schema language (LF-04):** `minLength` and `minItems`, `nullable` on any form, and discriminated unions `{ discriminator, mapping }`, with `Infer` and `liveframe gen` producing nullable and tagged-union types. Both the compiled validator and the published JSON Schemas understand them; `pattern` stays rejected in widget-authored schemas.

- **Events (LF-05, CL-08):** `carries` gains `"number"`, `"integer"` and `{ object: <closed schema> }`; `bindAll` merges a carried object into the action's arguments, and `setState` writes it to an object-typed key. `emit` rejects `NaN`, infinities and a non-integer; the validator compares the event type with the target schema and points at the mismatch.

- **Semantics (LF-09):** `form`, `group`, `figure`, `status` and `alert` join the library-fixed list, so a widget can declare a form landmark, a labelled group, a figure or a live region that survives re-renders.

- **Manifests and capabilities (LF-07, LF-08):** an optional manifest `description` and closed `meta` (hashed, carried, never interpreted), capability `meta` per action and source, and `irreversible` beside `confirm`. `list_capabilities` shows the description; `meta` stays host-only unless the authoring config opts in.

- **Renderer (LF-01, LF-08, CL-02, CL-09):** `onIntent(intent, origin)` with `IntentOrigin`, and `checkOffered(tree, origin, intent, validator)` at the root export; an `events` map in the `implement()` context carrying `{ type, confirm, irreversible }`; `<Surface confirm={(intent, meta) => Promise<boolean>}>`; host `wrapperProps` and `portalProps`; and `transparency="reduced"`, which applies the reduced-transparency overrides per surface and suppresses the switch transition.

- **Styling (CL-04, LF-10, LF-11, CL-07):** the reserved `"none"` value on `backgroundColor`, `borderColor` and `outlineColor`; `{ role, alpha }` colour values with a declared `opacity` name or 0–1; vocabulary `contrast` pairs with `minimum`, `maximum` and `lessThan`, enforced by `validateTheme` as `insufficient-contrast`; `placeholderColor` and `scrollbarThumbColor`/`scrollbarTrackColor` recipe properties; and `minHeight`/`maxHeight` style props.

- **Validation and sources (LF-12, LF-14):** `capabilitiesFor(capabilities, manifest)` prunes a capabilities document to what one manifest names, with identical `compileValidator` results; `sourceOutcome(result)` builds the documented per-source outcome envelope, and preview and authoring render its named scenarios.

- **Agent surfaces (LF-16):** `/sdk` exports `renderElements()` and `ephemeralManifest()`, rendering element JSON into the same key-path trees as `render()` with errors pointing into the JSON; `generateElementsSchema()` emits the catalog's element JSON Schema from `/sdk/gen`, with a drift check.

- `inProcessRunner({ maxModules? })` reports its loaded-module count through `stats()` and refuses a new package past `maxModules` (default 256) with `limit-exceeded`; packages already loaded still render. The count is process-wide.

- `@arnilo/liveframe/runner-kit` exports `renderModule()` and a pure `linkPackage(code, resolve)` with a documented linker contract, the in-sandbox half of a host's own runner. `inProcessRunner()` and `workerRunner()` are rebuilt on it with unchanged results (LF-13).

- `@arnilo/liveframe/runner-kit.bundle.js` is a self-contained ES module of the SDK, validator and runner kit for sandboxes with no module resolution. The archive gate checks that it imports nothing, and a CI test renders a packed widget with it under Node's `vm` (LF-13).

- `@arnilo/liveframe/authoring` exports `createAuthoring()` with the seven typed authoring operations, an explicit host runner, injected capture and opt-in outcome checks. `liveframe mcp` adapts these operations without changing its tools (LF-15).

- `@arnilo/liveframe/preview/capture` exports host-independent `capture()` and pluggable `CaptureBackend`, with an explicit `playwrightBackend(playwright)` adapter. Results contain an in-memory file map; snapshots may be absent. CLI output is preserved, and MCP accepts `AuthoringConfig.capture` (CL-05, LF-02).

- `@arnilo/liveframe/sdk/gen` exposes `generate()`, `generateDefinitions()` and `generateElementsSchema()`, byte-identical to the CLI's output, for host build services (LF-02).

- `conformance/corpus/` ships 45 language-neutral cases across all ten formats and `conformance/hash/` ships 45 canonical-hash vectors, both executed by the library's own suite, so a port can prove it agrees on `(kind, pointer)` and on RFC 8785 bytes (CL-06).

- `loadPlacement` accepts optional `{ scope, state }`; explicit state bypasses the state read and follows the same reported-reset rules. `/store` exports `verifyPlacementInputs` for hosts keeping state elsewhere. Store conformance covers scope isolation, bounds and deletion.

Fixed:

- Strip development-only source export conditions from the published manifest and reject missing export targets in the archive gate (CL-03).
- Shipped docs no longer call shipped exports planned, and a CI test keeps it that way (LF-03).

Known limitations:

- **The reference runners are still not sandboxes.** `inProcessRunner()` runs code in the host's realm, and `workerRunner()` bounds time and crashes without restricting what code can reach. `/runner-kit` is the in-sandbox half of a runner, not an isolation boundary. Hostile code needs the app's own isolated `Runner`. See [`docs/security.md`](docs/security.md).
- **`liveframe mcp` still runs agent drafts with the process's permissions** unless the config names an isolated runner. The import ban is syntactic only.
- **Every backend subpath needs Bun ≥ 1.4.2.** `/store/fs`, `/preview/worker`, the in-process loader and the CLI have no Node implementation; the host-API-free and browser subpaths do run elsewhere. `/runner-kit.bundle.js` is the exception among runner artifacts: it runs on a plain ES2022 isolate, verified under Node's `vm`.
- **Capture ships one backend.** `playwrightBackend()` drives headless Chromium; another engine needs the app's own `CaptureBackend`, and a screenshot is only as faithful as that engine.
- **No native Windows forced-colours and assistive-technology audit.** G29's checklist is written (`plans/evidence/020-g29-audit.md`), and the owner waived the run for this release. The conformance kit covers the renderer's semantics, not that audit.
- **Headless WebKit switching exceeds the 16.67 ms budget.** The recorded Linux run measured 18–22 ms; WebKit tests permit 25.1 ms. The owner deferred this issue for 0.2.0; the normative budget remains 16.67 ms.
- **The contrast check is install-time WCAG 2.x.** It measures relative luminance with alpha composited over the declared base, and does not check APCA or re-measure after a theme is installed.
- **Widget-authored schemas cannot use `pattern`**, by design; use `enum` or an app capability instead. General `oneOf`/`anyOf` stay out of the schema language; pick `nullable` or a discriminated union.
- **URL-valued props are the catalog's problem.** The library passes prop values through and never parses one as a URL; constrain `link.href`, `image.src` and the like with a catalog `pattern` or sanitise them in the implementation that renders them. See [`docs/security.md`](docs/security.md).
- **No authorisation, approval flow, storage backend or layout shell ships.** Those stay the app's.

## 0.1.0-rc.4 — 2026-10-27

Restore boolean schema annotation types, apply a worker's configured timeout to
its inner evaluation and render, and repair links to repository-only files in
the installed guides. Check links against the packed file list. Run repository
benchmarks with the source module condition so they share one validator graph.

## 0.1.0-rc.3 — 2026-10-27

Add a shipped agent walkthrough for the demo's independent CLI preview binding,
MCP authoring and HTTP install/place workflow. Clarify host-owned preview
transport and keys on repeated static siblings. No runtime changes.

## 0.1.0-rc.2 — 2026-10-27

Second release candidate, the first published from CI through npm trusted publishing, with provenance. No code changes from rc.1.

## 0.1.0-rc.1 — 2026-10-27

First release candidate, published under the `next` tag to verify the package from the registry. It carries the 0.1.0 content below.

## 0.1.0 — 2026-10-27

The first release: runtime-composable UI for React apps that run widget code on their backend.

Added:

- **Formats and validation** (`@arnilo/liveframe`): component and catalog definitions, themes, design systems with recipes, capabilities, manifests, the UI tree and scenarios, with a published JSON Schema for each at `/schemas/<format>.json`; `validateCatalog()`, `compileValidator()` and a compiled tree validator.
- **SDK** (`/sdk`): a JSX runtime for widget TSX, `action()`/`state()` intent helpers, `render()`, and `liveframe gen` for typed components built from a catalog.
- **React renderer** (`/react`): `createRenderer()`, `<Surface>` and `implement()`, with intent handling, error fallbacks and portal slots.
- **Styling** (`/css`): recipes resolved to three scoped sheets — base, theme and design system — with class, style, scope and variable helpers.
- **Packages, stores and runners**: `pack()`, `verifyPackage()`, the `Store` interface with `memoryStore()`, `fileStore(dir)` and `loadPlacement()`, plus `inProcessRunner()`, `workerRunner()` and `createPreview()`.
- **Preview** (`/preview/react`, `/preview/worker`): `<Preview>` for an app's own page, backend runners for draft code, and `liveframe preview capture`.
- **Agent authoring**: `liveframe mcp <config-module>`, an MCP server with seven tools — `list_primitives`, `list_vocabulary`, `list_capabilities`, `generated_types`, `pack_draft`, `render_scenarios` and `capture_preview`.
- **Conformance kit** (`/conformance`, `/conformance/react`): catalog, design-system, store and renderer suites an app registers in its own test runner.

Known limitations:

- **The reference runners are not sandboxes.** `inProcessRunner()` runs code in the host's realm, and `workerRunner()` bounds time and crashes without restricting what code can reach; one worker serves every package. Hostile code needs the app's own isolated `Runner`. See [`docs/security.md`](docs/security.md).
- **`liveframe mcp` runs agent drafts with the process's permissions** unless the config names an isolated runner. The import ban is syntactic only.
- **Every backend subpath needs Bun ≥ 1.4.2.** `/store/fs`, `/preview/worker`, the in-process loader and the CLI have no Node implementation; the host-API-free and browser subpaths do run elsewhere.
- **No native Windows forced-colours and assistive-technology audit.** The roadmap item (G29) is deferred past this release; the conformance kit covers the renderer's semantics, not that audit.
- **Widget-authored schemas cannot use `pattern`**, by design; use `enum` or an app capability instead.
- **URL-valued props are the catalog's problem.** The library passes prop values through and never parses one as a URL; constrain `link.href`, `image.src` and the like with a catalog `pattern` or sanitise them in the implementation that renders them. See [`docs/security.md`](docs/security.md).
- **No authorisation, approval flow, storage backend or layout shell ships.** Those stay the app's.
