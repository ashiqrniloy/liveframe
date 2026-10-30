# Compatibility

What a version bump of `@arnilo/liveframe` may change. The policy is [decision R15](https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md); the formats themselves are normative in the [spec](spec.md).

## Versions

- **Patch (`0.x.y`)** never breaks the public API, the formats or the on-disk `fileStore` layout. Bug fixes, documentation, additive exports, error kinds, corpus cases, hash vectors and new optional format versions can ship here, as can widening a peer range (only with the proof the [release task](https://github.com/ashiqrniloy/liveframe/blob/main/plans/013-Phase-6-Part-B-Packaging-Demo-And-Release.md) describes). Existing format meanings, corpus expectations and hash vectors remain fixed under the rules below.
- **Minor (`0.x`)** may break the public API. Every breaking change in `0.x` comes at a minor version, with a deprecation in an earlier release where that is feasible.
- **`1.0.0`** changes the rule above: from then on a breaking change needs a major version.

## 0.2.1

The [0.2.1 scope decision](https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-10-30-1914-release-0-2-1-scope-and-patch-content.md) adds a self-contained validator bundle, public `canonicalJson` and `packageHash` exports from `/pack`, package-integrity corpus cases and package-hash vectors, and resolvable `package.json` and conformance data paths (CL-10, CL-11, CL-13). Package corpus cases will run through `verifyPackage`, including integrity verification and the SDK-only import rule, with `hash-mismatch` and `forbidden-import` cases. The release scope also includes the runtime and realm-message fixes, release-tag maintenance, WebKit switching-budget proof and post-0.2.0 documentation corrections (CL-10, CL-12, CL-14, CL-16).

CL-15's optional `liveframe/tree-patch/1` format, diff/apply functions, schema, corpus cases and vectors are in this same release scope, gated on the separate design approval in plan 021 Task 2. Whole trees keep working unchanged. A patched tree must be validated whole before the renderer reads it, preserving law 2. This section records release scope; the later plan tasks provide implementation and release evidence.

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

## Formats

- A format's meaning never changes within its `/N` version. `liveframe/manifest/1`, `liveframe-catalog/1` and the rest keep their fields, their required keys and their validation rules for as long as they are `/1`.
- A new format version is a new `$id` (`urn:liveframe:<format>:N`), never a moved one, and the published JSON Schema for the old version keeps describing the old version. The library may read old versions for a while, but nothing silently reinterprets a document.
- A conformance corpus case's expected `(kind, pointer)` set changes only with a format version. Adding a case is additive; changing an existing case's expectation is a format-version change, not a patch, because ports rely on the corpus as executable data.
- A hash vector's expected `canonical` text or `sha256` changes only with a format version. Adding a vector is additive; changing an existing one is a format-version change, not a patch, because ports rely on the vectors as executable data.

## Growth

- `insufficient-contrast` is an additive error kind for a theme that violates a
  vocabulary-declared WCAG contrast minimum, maximum or strict pair ordering.
  Its message identifies the roles and measured ratios; declarations are optional.

- **Error kinds may be added.** `LiveframeError["kind"]` is an open union in practice: a new release can report a new kind for a case that previously produced a different one or none. Switch on the kinds you act on and treat the rest generically; do not fail on an unknown kind.
- **Optional fields may be added** to results and documents, and exports may be added. Removing or renaming an export, a kind or a field is a minor (or, after `1.0.0`, major) change.

## `fileStore` layout

`fileStore(dir)` keeps packages, placements, state and styles as files under the directory it is given, and the layout is stable within `0.1.x` ([spec §7.4](spec.md#74-storage)). A later version may add files or a migration, but it will read an existing directory rather than require an export.

## Deprecation practice

A deprecated export or catalog field is marked (`@deprecated` in its declaration, `deprecated` on a catalog definition) and keeps working for at least one release before removal, which then follows the rule above. Deprecation text names the replacement.

## Release process

A `v*` tag runs `.github/workflows/publish.yml`. It repeats CI's checks, asserts the tag equals `package.json`'s `version`, builds, and publishes with `npm publish` through npm trusted publishing (OIDC, no stored token), which also attaches provenance. A version with a prerelease part (`0.1.0-rc.1`) publishes under `next`; any other version publishes under `latest`. A non-prerelease publish also moves `next` to the same version, so `npm i @arnilo/liveframe@next` never installs an older build than `latest`.

Release checklist, in order. Publishing cannot be undone, so the tag is pushed only after the owner's explicit go:

1. `bun run check`, `bun run release:gate`, `bun scripts/release/peer-floors.ts` and `bun run demo:test` pass on the commit to tag; `package.json` holds the version and `CHANGELOG.md` dates its entry.
2. The owner gives the go in words.
3. Push `v<version>`. The workflow publishes a prerelease under `next` and a release under `latest`, with provenance.
4. After a release, the workflow runs `npm dist-tag add @arnilo/liveframe@<version> next`. npm trusted publishing permits that command only when the trusted publisher has **Allow npm dist-tag** enabled (npmjs.com, the package's trusted publishers; a one-time owner setting, off by default) and the CLI is npm ≥ 11.21.0 (≥ 12.2.0 on 12.x), so the workflow pins npm 12.2.1 for it. If the step fails, the owner runs the same command once with npm auth.
5. Verify from the registry: `npm view @arnilo/liveframe version`, `npm view @arnilo/liveframe dist-tags` (`next` is the release or newer), `npm audit signatures --include-attestations`, and `bun scripts/release/archive-gate.ts --package @arnilo/liveframe@<version>`.
