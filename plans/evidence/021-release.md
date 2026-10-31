# 0.2.1 release

`@arnilo/liveframe@0.2.1` is on npm under `latest`, published from tag `v0.2.1` by the trusted-publishing workflow with SLSA provenance, and verified from the registry. Plan 021 Task 18.

## Owner go

Task 18 was triggered and authorized by the owner's instruction, verbatim:

> Complete - [ ] Task 18: Review readiness with the owner, then publish 0.2.1 and verify it from @[plans/021-Phase-7-Part-H-Release-0-2-1.md] and update the plan once done

All readiness items were confirmed [GO](021-release-readiness-review.md) before publishing.

## Rounds

| Tag | Published | Why |
| --- | --- | --- |
| `v0.2.1-rc.1` | yes, under `next` | Published on first attempt; verified from registry (Task 17; [021-release-candidate.md](021-release-candidate.md)). |
| `v0.2.1` | yes, under `latest` | Released directly from commit `e5b7b43` after readiness review. No runtime, schema, or documentation change was made after `0.2.1-rc.1` (only version strings, changelog date, roadmap, and backlog closure). |

## Registry facts

- `npm view @arnilo/liveframe version` → `0.2.1`.
- `npm view @arnilo/liveframe dist-tags` → `{ latest: '0.2.1', next: '0.2.1-rc.1' }`.
- Published 2026-10-31T19:29:42Z from tag commit `e5b7b43f4247c9e67d01fb6ee116b64d314a3fd8`; the [Publish run](https://github.com/ashiqrniloy/liveframe/actions/runs/41233689976) completed npm publish successfully with shasum `bf11eaff633202d58b70cba64f81b2a5163f6450` and integrity `sha512-6GqSLPjumVeQ5pX7jXW0r7j2Q2JitjC5+GkE1L7t/D62+zTjG9iHkW11z50B0dGfM/qJFidnv2UNtaUA==`.
- Trusted publishing dist-tag note: The automated `dist-tag add @arnilo/liveframe@0.2.1 next` command exited with 403 (`This trusted publisher cannot manage dist-tags. Ask a package maintainer to enable Allow npm dist-tag.`) as anticipated by Task 8's risk assessment and `docs/compatibility.md` § Release process step 4. `next` remains at `0.2.1-rc.1` until updated by the owner with npm auth or upon enabling the setting on npmjs.com.
- Provenance: `dist.attestations.provenance.predicateType` is `https://slsa.dev/provenance/v1`; Sigstore transparency log index `3614764641`; verified via `npm audit signatures --json --include-attestations`.

## Registry-mode checks

| Check | Command | Result |
| --- | --- | --- |
| Version | `npm view @arnilo/liveframe version` | `0.2.1` |
| Archive gate | `timeout 300s bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.1` | passed all 13 steps in 6.2 s |
| Corrected docs shipped | `npm pack @arnilo/liveframe@0.2.1`, unpack | `package/package.json` version is `0.2.1`; `package/CHANGELOG.md` dated `2026-11-01`; all 357 other archive files match `0.2.1-rc.1` byte-for-byte |
| Demo host from the registry | `examples/demo-host` copied to `/tmp/lf-demo-021`, dependency set to `0.2.1`, `bun install`, `tsc --noEmit`, `bun test` | typecheck clean; 52 pass, 0 fail across 7 files (32.02 s) |
| Provenance | `npm audit signatures --include-attestations` | signatures and SLSA v1 provenance verified |
| Archive comparison | `diff -rq --exclude="package.json" --exclude="CHANGELOG.md" /tmp/cmp-rc/package /tmp/cmp-rel/package` | identical across all 357 unpacked files |

## Release files

- `package.json`: `version` `0.2.1` (from `0.2.1-rc.1`).
- `CHANGELOG.md`: `## 0.2.1 — unreleased` → `## 0.2.1 — 2026-11-01`.
- `roadmap.md` §3: updated with 0.2.1 release.
- `plans/requests/clay-0.2.1-requests.md`: delivery status records 0.2.1 published and verified.
- `plans/requests/clay-adoption-requests.md`: delivery status points to 0.2.1 follow-ups.
- `plans/backlog.md`: closed "Design tree patches for streaming agent surfaces" and "Ship the post-0.2.0 documentation corrections".

## Handoff note for Clay

`@arnilo/liveframe@0.2.1` is published on npm under `latest` and verified. Clay can now re-run its release-review scripts against the published archive. Clay can remove its local validator bundle build, remove its custom `structuredClone` shim, replace deep path imports with `/pack`, and adopt `diffTrees`/`applyPatch` for incremental streaming surfaces.
