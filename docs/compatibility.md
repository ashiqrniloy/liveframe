# Compatibility

What a version bump of `@arnilo/liveframe` may change. The policy is [decision R15](https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md); the formats themselves are normative in the [spec](spec.md).

## How 0.2.x stays compatible

`scripts/release/api/0.2.1.json` freezes the 0.2.1 public surface: every exported declaration of every typed subpath, plus a SHA-256 of each file under `schemas/`, `conformance/corpus/`, `conformance/hash/` and `conformance/patch/`. During 0.2.2, `src/__tests__/api-stability.test.ts` compared the built package against it on every `bun run check`. Each addition or widening needed an entry in `scripts/release/api/register-0.2.2.json` (`subpath`, `name`, `change`, `reason`, `hostAction`, `task`). The test rejected removed exports, unregistered declaration or schema changes, stale register entries, changed existing corpus or vector files, and shipped `deferred` entries.

0.2.3 also compared against `scripts/release/api/0.2.2.json`. Its stricter release rule allowed no declaration, schema, corpus or vector changes: `scripts/release/api/register-0.2.3.json` is `[]`.

## The 0.3.0 gate

The [approved scope](https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-11-05-0238-release-0-3-0-scope.md) permits documented breaks in this minor release. `scripts/release/api/0.2.3.json`, generated from `v0.2.3`, is now the single checkout baseline in `api-stability.test.ts`. The 0.2.1 and 0.2.2 comparisons are retired because 0.3.0 may break them by design; their baseline and register files remain as release history.

Every declaration or schema change needs an entry in `scripts/release/api/register-0.3.0.json`. Additions use `added`, compatible changes use `widened`, and breaks use `removed` or `changed` with a non-empty `migration` naming an exact heading in [the migration guide](migration-0.3.md). A removed target must disappear; a changed target must differ. Stale entries and shipped deferrals fail the gate. Existing corpus, hash and patch files may change only with a documented break entry naming the full file path under `./conformance/corpus/*`, `./conformance/hash/*` or `./conformance/patch/*`. Each break also needs its spec update, CHANGELOG line and adopter checklist in the same task. Behaviour-only changes need regression evidence as well: declaration comparison cannot detect them.

## Versions

- **Patch (`0.x.y`)** never breaks the public API, the formats or the on-disk `fileStore` layout. Bug fixes, documentation, additive exports, error kinds, corpus cases, hash vectors and new optional format versions can ship here, as can widening a peer range (only with the proof the [release task](https://github.com/ashiqrniloy/liveframe/blob/main/plans/013-Phase-6-Part-B-Packaging-Demo-And-Release.md) describes). Existing format meanings, corpus expectations and hash vectors remain fixed under the rules below.
- **Minor (`0.x`)** may break the public API. Every breaking change in `0.x` comes at a minor version, with a deprecation in an earlier release where that is feasible.
- **`1.0.0`** changes the rule above: from then on a breaking change needs a major version.

## 0.2.3

A host upgrading from 0.2.2 changes nothing: exports, declarations, format meanings, published schemas, corpus expectations, hash and patch vectors, and the on-disk store layout stay the same. The [scope decision](https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-11-03-1132-release-0-2-3-scope.md) requires an empty API register. Valid trees, CSS, hashes, patches and intents retain their bytes; performance and internal organization improve.

Inputs that already violated the contract change outcome:

- Invalid custom-runner trees, including cyclic trees, return typed validation errors from preview and authoring rather than being stored or reported as successful. Both use the default validation limits (5,000 nodes, depth 64, 1 MiB); a custom runner's higher limits do not raise the session's limits.
- Top-level `await using`, including inside top-level blocks and loop headers, is rejected with `invalid-document` by package module checking. Async functions may still use it.
- Reassigning a verified package's `hash`, `format`, `code`, `manifest` or `scenarios` causes the reference runners to verify it again. Nested mutation in `manifest` or `scenarios` remains undetected; keep packages immutable.
- Malformed worker results, including empty or malformed error lists, become `render-failed` and recycle the worker.
- Corrupt placement listings reject with an `invalid-document` `LiveframeFailure` instead of returning malformed records or throwing a sorting `TypeError`. Loading one placement still does not list its siblings.

Failed module links no longer occupy the reference loader's module cache. MCP draft-directory failures now name only relative paths, retaining their error kinds and pointers. `sucrase` is bundled rather than installed as a runtime dependency; declare it directly if your app imported the transitive dependency. Fractions on dimension props remain accepted but are deprecated for 0.3.0. See the [adopter notes](adopters-0.2.md#023--review-fixes-and-simplification) and migrations below.

## 0.2.2

The [0.2.2 scope and API stability decision](https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md) delivers performance optimizations and host accessibility enhancements as purely additive changes under the opt-in and no-break rules.

Performance improvements include whole-tree node reuse in `<Surface>` (memoizing unchanged subtrees to close the gap between whole-tree and patch arrival costs without wire changes), compiled-validator caching in `compileValidator` (reusing immutable catalog and capability closures across renders with identical identity semantics), pure request-time evaluation of manifest data sources via `bindSources()`, and stable re-run caching via `renderKey()`.

Accessibility additions include:
- `auditContrast` and `ContrastFinding`: a recipe-derived install-time contrast audit resolving every `(kind, variant, slot, state)` pair against WCAG 2.2 thresholds, with opt-in gating in `designSystemSuite({ contrast: true })`.
- Focus continuity: `<Surface focusContinuity>` preserves keyboard focus within the surface across updates, restoring focus to the nearest connected sibling or wrapper.
- Recipe states: four new state names (`current`, `mixed`, `pending`, `readonly`) inserted into `states`, the recipe key pattern, and design-system validation/projection, plus promise-returning `emit()` and widened `SurfaceProps.onIntent` allowing primitives to indicate busy state while asynchronous host operations complete.
- Accessibility capture axes: `capture()` gains optional `media` (`textScale`, `forcedColors`, `reducedMotion`), implemented via `CaptureSession.emulate?(media)` and surfaced through CLI flags and MCP tool parameters.

Per-request details and limitations: [`docs/adopters-0.2.md`](adopters-0.2.md#022--performance-and-accessibility-additions).

## 0.2.1

The [0.2.1 scope decision](https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-10-30-1914-release-0-2-1-scope-and-patch-content.md) adds a self-contained validator bundle (`/validator.bundle.js`), public `canonicalJson` and `packageHash` exports from `/pack`, package-integrity corpus cases and package-hash vectors, and resolvable `package.json` and conformance data paths (CL-10, CL-11, CL-13). Package corpus cases run through `verifyPackage`, including integrity verification and the SDK-only import rule, with `hash-mismatch` and `forbidden-import` cases. The release also includes the runtime and realm-message fixes, release-tag maintenance, the `deferOffscreen` style prop and WebKit switching-budget proof, and the post-0.2.0 documentation corrections (CL-10, CL-12, CL-14, CL-16).

CL-15's optional `liveframe/tree-patch/1` format, `validateTreePatch`, `diffTrees` and `applyPatch` functions, schema, corpus cases and vectors ship in 0.2.1 under the [approved patch design](https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-10-30-1928-tree-patch-format.md). Whole trees keep working unchanged. A patched tree is validated whole before the renderer reads it, preserving law 2, and `checkOffered` remains the host's dispatch check against the served tree.

The [authoring MCP surface decision](https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-10-31-2057-authoring-mcp-server-0-2-1-surface.md) ships eight tools in 0.2.1: an offered `setState`-only `set_state` tool (and matching `/authoring` `setState()`), advertised `outcomes`, all three generated modules from `generated_types({ module? })`, CLI draft directories under an opt-in `draftRoot`, behaviour annotations, and self-contained `outputSchema`s with `structuredContent` alongside existing text. Capture gains optional structural `layout` records and a matching `--layout` flag, plus `maxCaptureCells` (default 12, maximum 48). An optional `preserveState` session render flag lets host snapshots preserve the state set by the tool. These additions preserve 0.2.0 text results and existing defaults. The one deliberate error-behaviour fix is a missing inline `pack_draft` key: it returns a typed `LiveframeError[]` instead of the MCP SDK's validation string. Non-object protocol arguments still fail before the handler. Per-request details and limitations: [`docs/adopters-0.2.md`](adopters-0.2.md#021--clay-review-and-authoring-additions).

## 0.2.0

0.2.0 covers all Synapta LF-01–LF-17 and Clay CL-01–CL-09 requests and the backlog items they raise. The [scope decision and breaking-change register](https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-10-27-2028-release-0-2-0-scope-and-breaking-changes.md) records the owner's approval, plan map and rationale for proceeding without an intervening 0.1.x deprecation release.

The migrations it carries are:

- **Store:** replace `putState(placementId, state)` / `getState(placementId)` with `putState(placementId, scope, state)` / `getState(placementId, scope)`. Use `""` for shared state or an opaque host-selected scope for isolated state; pass `{ scope }` to `loadPlacement`. Update custom stores and run the scope-isolation conformance case. Unsupported scopes must fail closed, never silently share state. Placement deletion removes every scope.
- **Preview:** supply `resultScenario` alongside each `result`, naming the scenario actually rendered. Inference from the URL is removed because it can label a tree as the wrong scenario. The optional controlled `selection`/`onSelect` mode and per-preview `urlKey` support hosts that own navigation or mount multiple previews.
- **Capture:** use `capture` from `@arnilo/liveframe/preview/capture` with an injected backend and consume its returned `{ index, files }`. This reopens the CLI-only decision D3; 0.1.0 has no supported capture function export to deprecate. Existing CLI and MCP capture behavior is retained.

0.1.0 shipped before it. The Store break avoids an unsafe unscoped fallback, and the Preview break removes incorrect scenario inference; the scope decision explains why each proceeds at this minor boundary. A further break and its migration join the register and this section in the release that carries them. The additions preserve the existing `/1` document meanings.

Step-by-step migration, with the before and after of each break and an executable sample: [`docs/migration-0.2.md`](migration-0.2.md). Per-request shipped API and limitations: [`docs/adopters-0.2.md`](adopters-0.2.md).

0.2.0 reads a 0.1.0 `fileStore` directory without export/import: `states/<id>.json` remains shared scope `""`, and non-empty scopes use `states/<id>/<scope>.json` with safe filename encoding. This does not promise that 0.1.0 can read new scoped state.

Scope is required
on both state methods and must be a string of at most 128 Unicode code points;
invalid scopes reject with `invalid-document` at `/scope`. The optional fourth
argument to `loadPlacement` accepts `{ scope, state }`; supplying state skips the
state read. Hosts without stored state can use `verifyPlacementInputs` after
verifying the package. Explicit state follows the same reset rules as stored
state. The committed 0.1.0 directory is regenerated with
`bun scripts/fixtures/store-0.1.0.ts` using the `v0.1.0` code. No files are
rewritten during upgrade. A rollback to 0.1.0 retains shared state but cannot
access named scopes; stop scoped writes before rolling back.

## Spec history relocated for the normative layout

The spec restructure preserves the current contracts. These historical comparisons and proof results explain how they arose.

- §6.4 history: A system that declares no `pending` recipe projects exactly the CSS it did in 0.2.1.
- §7.4 history: The layout is part of the 0.1.x compatibility promise. `fileStore` reads and writes shared state at `states/<encoded-id>.json`, including directories written by 0.1.0.
- §11 history: When the host's `onIntent` returns a promise, `emit` returns a `Promise<void>` that settles when the host's promise does (or, through `confirm`, after approval and the host call), so an implementation can set `aria-busy` until the host finishes; otherwise it returns `undefined`, as in 0.2.1.
- §15 release status: None. 0.1.0 ships under the MIT license (`decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md`, R1).
- §9 history: LF-17 measured a realistic streaming surface beyond the compression and arrival budgets; optional patches follow the approved design in `decision-logs/2026-10-30-1928-tree-patch-format.md`.
- §6.3: dimension fractions remain deprecated; 0.3.0 rejects them.
- §5 proof history: The Phase 0 proof (§12, `proof/REPORT.md`) built four real UIs from the first 23 candidates without adding a product-shaped primitive. It also showed which generic capabilities were missing.
- §12 proof context: The blocker this resolves is recorded in `synapta-core`: `plans/200.4-SdkComponentsRendererAndQueue.md`, task T4b.
- §10 proof-era observation and requirement: In the Phase 0 proof, validation is more than half of a render's cost, and building the tree checks the same props a second time. Build and validate become one pass (`docs/model.md`, "Performance"; `decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md`). The library's build and validation now share one pass.

Drafted 2026-10-21 from two working implementations of the same idea:

- **Synapta**, a multi-tenant web platform: TSX widgets on an SDK, with three interaction tiers.
- **Clay**, a desktop editor on Tauri: server-driven UI with design-system recipes.

This library takes Synapta's authoring and interaction model and Clay's styling model, and combines them.

**Outcome (2026-10-22): go.** See `proof/REPORT.md` and `decision-logs/2026-10-22-1519-phase-0-go.md`.

The first pass was a conditional go: all four UIs were built from the candidates and composed TSX, with no product-shaped primitive and no raw styling, all three tiers worked, and the switch needed no widget change, but the agent-home queue differed from the approved artifact by 36–50% of pixels because generic capabilities were missing. Plan 002 added them to §5 and §6.3–§6.4 and re-proved the comparison:

- **pixel mismatch 0.72% / 0.75% / 0.97%** at 1440 / 1024 / 390 px, against the ≤ 1% bar, at region sizes equal to the artifact's, with no diagnostics;
- every remaining difference listed and approved: ten DOM causes (each a markup choice of an existing primitive) and 32 style values (27 anchor correspondence, 3 recorded switch-budget choices, 2 not expressible with no visual effect), in `proof/PARITY.md`;
- the artifact's two font faces snapshotted with licences and SHA-256, so typography is compared with the real faces.

The one budget that does not hold is render cost: the artifact-faithful tree is 679 nodes at 50 rows (13.6 per row), and the proof's render path costs 8.5 µs per node, so its 50-row selection rerenders in 5.75 ms against a 2 ms bench. The owner accepted this as a rendering-path cost rather than a model finding, and made it Phase 1's exit criterion: **the real renderer and validator must stay at or below 3 µs per node** on the same benches (2 ms at 680 nodes), and the design-system switch at or below 16.67 ms, measured as span A (§6.4).

Phase 0 is done and Phase 1 may freeze the §5–§8 formats.

## Formats

- A format's meaning never changes within its `/N` version. `liveframe/manifest/1`, `liveframe-catalog/1` and the rest keep their fields, their required keys and their validation rules for as long as they are `/1`.
- A new format version is a new `$id` (`urn:liveframe:<format>:N`), never a moved one, and the published JSON Schema for the old version keeps describing the old version. The library may read old versions for a while, but nothing silently reinterprets a document.
- A conformance corpus case's expected `(kind, pointer)` set changes only with a format version. Adding a case is additive; changing an existing case's expectation is a format-version change, not a patch, because ports rely on the corpus as executable data.
- A hash vector's expected `canonical` text or `sha256` changes only with a format version. Adding a vector is additive; changing an existing one is a format-version change, not a patch, because ports rely on the vectors as executable data.

## Deferred to 0.3.0

These are future contracts, not APIs available in 0.2.3. The review-fix deferrals below follow the approved 0.2.3 scope decision; implemented entries link to their final contracts.

- **Package and render-input immutability (R4, R5).** Implemented for 0.3.0; see [frozen packages](migration-0.3.md#packages-are-deeply-frozen) and [render input ownership](migration-0.3.md#render-inputs-keep-caller-ownership).
- **Verified-package cache option for `loadPlacement` (R15).** Implemented for 0.3.0 as `verifiedPackages({ max? })` and `{ verified }`; see [adopter notes](migration-0.3.md#optional-verified-package-cache) and [loading](packages.md#loading-and-state-resets). Stored content is freshly hashed on every load.
- **Node references (`ref`, `NodeRef`, `catalog.json` `refProps`).** The format, SDK, validator and renderer `domId` integration are implemented for 0.3.0. `ref("hint")` and `$anchor="hint"` author a relation; rendered props carry resolved key-path ids. `NodeRef` is an author-side marker, not a string alias. **Adopter checklist:** regenerate reference-bearing SDK types and element schemas; update catalog validators before using `refProps`. See [node reference authoring](sdk.md#node-references) and [catalog rules](formats.md#definitions-and-catalogs).
- **Extension recipe properties (`vocabulary.extensions`, a recipe's `extensions`).** Implemented for 0.3.0 as optional fields under the existing `/1` format ids, which a 0.2.x validator rejects fail-closed. A catalog or design system without extensions is unchanged and projects byte-identical CSS. **Adopter checklist:** update catalog and design-system validators (and any non-TypeScript port) before installing documents that use extensions; declare, set and read `--lf-p-<name>` as in the [migration guide](migration-0.3.md#extension-recipe-properties) and [extension properties](styling.md#extension-properties).
- **Fractions on dimension style props (implemented for 0.3.0).** The six dimension props now reject fractions with `invalid-prop`, including responsive values. Use `grow={2}` with `basis={0}`, or move fractions to the parent's `columns` / `rows`. The [migration checklist](migration-0.3.md#fractions-on-dimension-props-are-rejected) covers widgets, stored trees and generated types. 0.2.3 accepted these inert declarations and deprecated them; grid-track fractions are unchanged.

## Growth

- `stale-patch` is an additive error kind for an optional tree patch whose surface or base revision differs from the supplied tree. Whole-tree transport remains valid.

- `insufficient-contrast` is an additive error kind for a theme that violates a
  vocabulary-declared WCAG contrast minimum, maximum or strict pair ordering.
  Its message identifies the roles and measured ratios; declarations are optional.

- **`states` is a growing vocabulary.** The fixed state list gains names in a minor
  release — 0.2.2 adds `current`, `mixed`, `pending` and `readonly`. A recipe key
  is still `kind.variant.slot.state`; a design system that styles none of the new
  states projects the same CSS. A `Record<(typeof states)[number], …>` map written
  against an older list needs `Partial` or a default branch, as `styleProps` did.
- **`CaptureOptions.media` and `CaptureInput.media` are widened with optional media axes.**
  The `media` object accepts `textScale`, `forcedColors`, and `reducedMotion` arrays; absent
  `media` produces unchanged captures and indexes without coordinates.
- **`SurfaceProps.onIntent` and `ImplementationProps.emit` return types are widened for async handlers.**
  `onIntent` accepts callbacks returning `unknown` (including promises), and `emit` widens from
  `void` to `Promise<void> | undefined` to return the host's settled promise so primitives can track
  pending states while remaining assignable to void callbacks.
- **`designSystemSuite` options are widened with an opt-in `contrast` gate.**
  Hosts pass `contrast: true` or `contrast: { minimums }` to assert recipe-derived contrast; omitting the option runs the unchanged 0.2.1 suite.
- **Error kinds may be added.** `LiveframeError["kind"]` is an open union in practice: a new release can report a new kind for a case that previously produced a different one or none. Switch on the kinds you act on and treat the rest generically; do not fail on an unknown kind.
- **Optional fields may be added** to results and documents, and exports may be added. Removing or renaming an export, a kind or a field is a minor (or, after `1.0.0`, major) change.

## `fileStore` layout

`fileStore(dir)` keeps packages, placements, state and styles as files under the directory it is given, and the layout is stable within `0.1.x` ([spec §7.4](spec.md#74-storage)). A later version may add files or a migration, but it will read an existing directory rather than require an export.

## Deprecation practice

A deprecated export or catalog field is marked (`@deprecated` in its declaration, `deprecated` on a catalog definition) and keeps working for at least one release before removal, which then follows the rule above. Deprecation text names the replacement.

## Release process

A `v*` tag runs `.github/workflows/publish.yml`. It repeats CI's checks, asserts the tag equals `package.json`'s `version`, builds, and publishes with `npm publish` through npm trusted publishing (OIDC, no stored token), which also attaches provenance. A real publish runs only from a `v*` tag: the job's first step fails a non-dry-run dispatch from a branch, and the job runs in the protected `release` environment (repository settings: required reviewers and a `v*` tag rule; because the job declares the environment, a dry run from a branch is also subject to its rules). CI and the publish job run `bun audit --prod --audit-level=high`, which fails on a high or critical advisory in the runtime closure, and, after the build, `scripts/release/audit-bundled.ts` applies the same threshold to the packages bundled into `dist/pack/sucrase.js` (devDependencies at install time, so the production audit cannot see them). They upload a CycloneDX 1.6 SBOM (`bun scripts/release/sbom.ts --out <file>`, run after the build) of the runtime closure plus those bundled packages as the `sbom` workflow artifact. The SBOM is not in the npm archive. A version with a prerelease part (`0.1.0-rc.1`) publishes under `next`; any other version publishes under `latest`. A non-prerelease publish also moves `next` to the same version, so `npm i @arnilo/liveframe@next` never installs an older build than `latest`.

Release checklist, in order. Publishing cannot be undone, so the tag is pushed only after the owner's explicit go:

1. `bun run check`, `bun run release:gate`, `bun scripts/release/peer-floors.ts` and `bun run demo:test` pass on the commit to tag; `package.json` holds the version and `CHANGELOG.md` dates its entry.
2. The owner gives the go in words.
3. Push `v<version>`. The workflow publishes a prerelease under `next` and a release under `latest`, with provenance.
4. After a release, the workflow runs `npm dist-tag add @arnilo/liveframe@<version> next`. npm trusted publishing permits that command only when the trusted publisher has **Allow npm dist-tag** enabled (npmjs.com, the package's trusted publishers; a one-time owner setting, off by default) and the CLI is npm ≥ 11.21.0 (≥ 12.2.0 on 12.x), so the workflow pins npm 12.2.1 for it. If the step fails, the owner runs the same command once with npm auth.
5. Verify from the registry: `npm view @arnilo/liveframe version`, `npm view @arnilo/liveframe dist-tags` (`next` is the release or newer), `npm audit signatures --include-attestations`, and `bun scripts/release/archive-gate.ts --package @arnilo/liveframe@<version>`.

Behavior-only `changed` entries may retain the same declaration when they name an existing regression test in `behavior: { file, test }`. The full check runs that test; entries still require a migration heading. Entries without behavior evidence retain stale-declaration rejection. Schema and vector gates are unchanged.
