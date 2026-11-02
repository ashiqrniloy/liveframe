# 0.2.2 release

`@arnilo/liveframe@0.2.2` is on npm under `latest`, published from tag `v0.2.2` by the trusted-publishing workflow with SLSA provenance, and verified from the registry. Plan 022 Task 16. **`next` is still at `0.2.2-rc.2`, below `latest`; moving it needs the owner's npm credentials (see "Open: the `next` dist-tag").**

## Owner go

- Readiness review ([022-release-readiness-review.md](022-release-readiness-review.md)): the owner was asked for a go on the four deferrals (D1–D4) and answered "Go, but fix cold compile first".
- After the fix (F1, F2), the owner answered the question "How should I proceed?" with "Publish rc.2, then 0.2.2", which approved both tag pushes.

## Rounds

| Tag | Published | Why |
| --- | --- | --- |
| `v0.2.2-rc.1` | yes, under `next` | Task 15; verified from the registry ([022-release-candidate.md](022-release-candidate.md)). Superseded: the review fixed runtime code (F1, F2). |
| `v0.2.2-rc.2` | yes, under `next` | Round 2 of the same record; verified from the registry. |
| `v0.2.2` | yes, under `latest` | Released from commit `46c04e3` after `rc.2`. Changes since `rc.2`: `package.json` version, `CHANGELOG.md` date, `README.md` current-release line. No runtime, schema or corpus change. |

## Registry facts

- `npm view @arnilo/liveframe@0.2.2 version` → `0.2.2`.
- `npm view @arnilo/liveframe dist-tags` → `{ latest: '0.2.2', next: '0.2.2-rc.2' }`.
- Published 2026-11-02T22:00:56Z (UTC; 2026-11-03 local) from tag commit `46c04e3`; the [Publish run](https://github.com/ashiqrniloy/liveframe/actions/runs/41531726855) published with shasum `14586bb8a016a3348e7d35071c8dd54047f988d9` and integrity `sha512-k5p48LUcsHbAqKVUpuiTvPXpClJbDfsDkU1mC7LTiD0MBSXPRvJ3Nn5TTollpv5fFUPUpOPIlI+mSqFfc+IjLw==`. It took about 1.5 minutes to appear in `npm view`.
- Provenance: `dist.attestations.provenance.predicateType` is `https://slsa.dev/provenance/v1`; `npm audit signatures --json --include-attestations` on an empty project with `@arnilo/liveframe@0.2.2` installed reports 0 invalid and 0 missing.

## Open: the `next` dist-tag

The workflow's last step, `npm dist-tag add @arnilo/liveframe@0.2.2 next`, failed with `E403 ... This trusted publisher cannot manage dist-tags. Ask a package maintainer to enable Allow npm dist-tag.` The step runs after `npm publish`, so `0.2.2` was already published; the run is marked failed because of it. This is the same condition 0.2.1 hit and is open as backlog P3 "Enable trusted-publisher dist-tag management on npmjs.com or update next tag". The plan's criterion "`next` at or above it" is therefore **not yet met**. The owner either runs, once, with npm auth:

```
npm dist-tag add @arnilo/liveframe@0.2.2 next
```

or enables **Allow npm dist-tag** on the package's trusted publisher in npmjs.com (after which later releases do it automatically). `npm whoami` is not logged in on this machine, so this was not run here. Until then `@next` installs `0.2.2-rc.2`, whose runtime is byte-identical to `0.2.2`.

## Registry-mode checks

| Check | Command | Result |
| --- | --- | --- |
| Version | `npm view @arnilo/liveframe@0.2.2 version` | `0.2.2` |
| Archive gate | `bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.2` | passed all 13 steps in 6.7 s |
| Provenance | `npm audit signatures --json --include-attestations` | 0 invalid, 0 missing; SLSA v1 |
| API stability | `readApiSurface` + `compareApiSurface` on the unpacked registry tarball, against `0.2.1.json` and the 20-entry `register-0.2.2.json` | `diffs: []` |
| Final archive vs `0.2.2-rc.2` | `diff -rq` on the two unpacked tarballs | differs only in `CHANGELOG.md`, `README.md` and `package.json` |
| Demo host from the registry | demo copied outside the repo, dependency set to `0.2.2`, `bun install`, `tsc --noEmit`, `bun test` twice | typecheck clean; 52 pass, 0 fail, both runs |
| Pre-tag gates | `bun run check` on the tagged tree | 1000 pass, 4 skip, 0 fail (371 s); `release:gate` 13/13. The workflow repeated `check`, the archive gate, the three peer floors and `demo:test` before `npm publish`. |

## Release files

- `package.json`: `version` `0.2.2` (from `0.2.2-rc.2`).
- `CHANGELOG.md`: `## 0.2.2-rc.2 — 2026-11-03` became `## 0.2.2 — 2026-11-03`.
- `README.md`: "`0.2.2` is the current release".
- `roadmap.md` §3, `plans/backlog.md`, plan 022 Task 16 notes: updated after publication.

## Handoff note

`@arnilo/liveframe@0.2.2` is published under `latest` and verified. Hosts that upgrade from 0.2.1 and change nothing see identical trees, CSS, intents, origins and errors, and fewer React renders of unchanged nodes. New capabilities are opt-in: `bindSources`, `renderKey`, `auditContrast`, `focusContinuity`, the four recipe states and the capture media axes. Node references, extension recipe properties and multiple variant axes ship in 0.3.0 (`docs/compatibility.md` § "Deferred to 0.3.0").
