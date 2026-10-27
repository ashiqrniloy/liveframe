# Compatibility

What a version bump of `@arnilo/liveframe` may change. The policy is [decision R15](https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md); the formats themselves are normative in the [spec](spec.md).

## Versions

- **Patch (`0.1.x`)** never breaks the public API, the formats or the on-disk `fileStore` layout. Bug fixes, documentation and widening a peer range (only with the proof the [release task](https://github.com/ashiqrniloy/liveframe/blob/main/plans/013-Phase-6-Part-B-Packaging-Demo-And-Release.md) describes) can ship here.
- **Minor (`0.x`)** may break the public API. Every breaking change in `0.x` comes at a minor version, with a deprecation in an earlier release where that is feasible.
- **`1.0.0`** changes the rule above: from then on a breaking change needs a major version.

## Formats

- A format's meaning never changes within its `/N` version. `liveframe/manifest/1`, `liveframe-catalog/1` and the rest keep their fields, their required keys and their validation rules for as long as they are `/1`.
- A new format version is a new `$id` (`urn:liveframe:<format>:N`), never a moved one, and the published JSON Schema for the old version keeps describing the old version. The library may read old versions for a while, but nothing silently reinterprets a document.

## Growth

- **Error kinds may be added.** `LiveframeError["kind"]` is an open union in practice: a new release can report a new kind for a case that previously produced a different one or none. Switch on the kinds you act on and treat the rest generically; do not fail on an unknown kind.
- **Optional fields may be added** to results and documents, and exports may be added. Removing or renaming an export, a kind or a field is a minor (or, after `1.0.0`, major) change.

## `fileStore` layout

`fileStore(dir)` keeps packages, placements, state and styles as files under the directory it is given, and the layout is stable within `0.1.x` ([spec §7.4](spec.md#74-storage)). A later version may add files or a migration, but it will read an existing directory rather than require an export.

## Deprecation practice

A deprecated export or catalog field is marked (`@deprecated` in its declaration, `deprecated` on a catalog definition) and keeps working for at least one release before removal, which then follows the rule above. Deprecation text names the replacement.

## Release process

A `v*` tag runs `.github/workflows/publish.yml`. It repeats CI's checks, asserts the tag equals `package.json`'s `version`, builds, and publishes with `npm publish` through npm trusted publishing (OIDC, no stored token), which also attaches provenance. A version with a prerelease part (`0.1.0-rc.1`) publishes under `next`; any other version publishes under `latest`.
