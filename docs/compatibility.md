# Compatibility

What a version bump of `@arnilo/liveframe` may change. The policy is [decision R15](https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md); the formats themselves are normative in the [spec](spec.md).

## Versions

- **Patch (`0.1.x`)** never breaks the public API, the formats or the on-disk `fileStore` layout. Bug fixes, documentation and widening a peer range (only with the proof the [release task](https://github.com/ashiqrniloy/liveframe/blob/main/plans/013-Phase-6-Part-B-Packaging-Demo-And-Release.md) describes) can ship here.
- **Minor (`0.x`)** may break the public API. Every breaking change in `0.x` comes at a minor version, with a deprecation in an earlier release where that is feasible.
- **`1.0.0`** changes the rule above: from then on a breaking change needs a major version.

## 0.2.0

The next planned release is 0.2.0, covering all Synapta LF-01–LF-17 and Clay CL-01–CL-09 requests and the backlog items they raise. The [scope decision and breaking-change register](https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-10-27-2028-release-0-2-0-scope-and-breaking-changes.md) records the owner's approval, plan map and rationale for proceeding without an intervening 0.1.x deprecation release.

The planned migrations are:

- **Store:** replace `putState(placementId, state)` / `getState(placementId)` with `putState(placementId, scope, state)` / `getState(placementId, scope)`. Use `""` for shared state or an opaque host-selected scope for isolated state; pass `{ scope }` to `loadPlacement`. Update custom stores and run the scope-isolation conformance case. Unsupported scopes must fail closed, never silently share state. Placement deletion removes every scope.
- **Preview:** supply `resultScenario` alongside each `result`, naming the scenario actually rendered. Inference from the URL is removed because it can label a tree as the wrong scenario. The optional controlled `selection`/`onSelect` mode and per-preview `urlKey` support hosts that own navigation or mount multiple previews.
- **Capture:** use `capture` from `@arnilo/liveframe/preview/capture` with an injected backend and consume its returned `{ index, files }`. This reopens the CLI-only decision D3; 0.1.0 has no supported capture function export to deprecate. Existing CLI and MCP capture behavior is retained.

Only 0.1.0 has shipped. The Store break avoids an unsafe unscoped fallback, and the Preview break removes incorrect scenario inference; the scope decision explains why each proceeds at this minor boundary. Later plans must add any further break and migration to the register and this section. Other planned additions preserve existing `/1` document meanings. These changes are not shipped yet.

Step-by-step migration, with the before and after of each break and an executable sample: [`docs/migration-0.2.md`](migration-0.2.md). Per-request shipped API and limitations: [`docs/adopters-0.2.md`](adopters-0.2.md).

0.2.0 will read a 0.1.0 `fileStore` directory without export/import: `states/<id>.json` remains shared scope `""`, and non-empty scopes use `states/<id>/<scope>.json` with safe filename encoding. This does not promise that 0.1.0 can read new scoped state.

The Store migration is implemented for the upcoming release. Scope is required
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

A `v*` tag runs `.github/workflows/publish.yml`. It repeats CI's checks, asserts the tag equals `package.json`'s `version`, builds, and publishes with `npm publish` through npm trusted publishing (OIDC, no stored token), which also attaches provenance. A version with a prerelease part (`0.1.0-rc.1`) publishes under `next`; any other version publishes under `latest`.
