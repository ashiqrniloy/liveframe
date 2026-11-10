# 0.3.0-rc.1 release verification

## Authorization and source

Task 5 was requested by the owner on 2026-11-10 ("Complete Task 5: Publish `0.3.0-rc.1` of all three packages under `next` and verify from the registry"). As with plan 025 Task 9, that request authorizes the release-candidate tag and publication.

Version `0.3.0-rc.1` with the widened `~0.3.0-0` peer range is commit `af97604`. The tag `v0.3.0-rc.1` names it; the local checklist below ran on that commit.

Pre-publication note: neither companion package existed on the registry (`npm view @arnilo/liveframe-runner-quickjs` and `@arnilo/liveframe-starter` both returned E404), so the CI job could not be their first publisher. The `release` environment is verified (reviewer `ashiqrniloy`, tag policy `v*`); the maintainer token in `~/.npmrc` returns 401, so no manual publish was possible from this checkout. The owner answered "Go" on 2026-11-10.

## 0.3.0 API baselines for the companion packages

Plan 031's hand-off: generate a baseline per companion so a 0.3.x patch has a gate for all three packages.

```sh
bun run build
bun scripts/release/api-surface.ts packages/runner-quickjs \
  --from "checkout at 536867c before the 0.3.0-rc.1 bump, after bun run build" \
  --out scripts/release/api/0.3.0-runner-quickjs.json
bun scripts/release/api-surface.ts packages/starter \
  --from "checkout at 536867c before the 0.3.0-rc.1 bump, after bun run build" \
  --out scripts/release/api/0.3.0-starter.json
```

`readApiSurface` assumed the core's layout (`schemas/`, `conformance/*`) and failed on a package that ships none; an absent directory now hashes as empty (`scripts/release/api-surface.ts`). The core gate is unaffected: its baseline holds the keys, so a missing directory still fails the comparison.

`baseline_0_3_0_matches_the_companion_packages` (`src/__tests__/api-stability.test.ts`) compares each companion checkout against its baseline with an empty register, so any declaration change in a patch release fails.

## Local release gates (commit `af97604`)

| Gate | Result |
| --- | --- |
| `bun scripts/release/versions.ts --tag v0.3.0-rc.1` | `3 packages at 0.3.0-rc.1` |
| `timeout 1200 bun run check` | build, gen:check, typecheck, lint, format pass; 1769 pass, 4 skip, 0 fail, 160 files, 478.85 s |
| `timeout 900 bun run release:gate` | all 15 core steps (6.2 s), 2 runner steps (5.5 s) and 2 starter steps (3.2 s) pass; each archive installs outside the checkout |
| `timeout 900 bun scripts/release/peer-floors.ts` | React 19.0.0: 119 pass; Playwright 1.49.0: 23 pass; MCP server 2.0.0: 87 pass; zero failures |
| `timeout 900 bun run demo:test` | 67 pass, zero fail |
| `timeout 300 bun audit --prod --audit-level=high` | no vulnerabilities (20 packages) |
| `timeout 300 bun scripts/release/audit-bundled.ts` | no high or critical advisories in the 7 bundled packages |

No quiet-host performance claim is made here; plan 032 Task 3 carries that proof.

## Protected publish workflow

The `release` environment has required reviewer `ashiqrniloy` (self-review allowed) and the custom tag policy `v*`, read from the GitHub API on 2026-11-10.

## Publication attempts

| Attempt | Tag commit | Run | Outcome |
| --- | --- | --- | --- |
| 1 | `af97604` | [42776596232](https://github.com/ashiqrniloy/liveframe/actions/runs/42776596232) | Failed at `bun run demo:test` before any publish. 6 of 58 tests failed: `Executable doesn't exist at …/chromium_headless_shell-1254/…`. The demo host is not a workspace and its install has no lockfile, so `playwright: ^1.64.1` resolved to 1.65.0 in CI while the workflow installs browsers for the root's pinned 1.64.1. Fixed by pinning the demo host to `1.64.1` (`examples/demo-host/package.json`, commit `f7a86f6`). |
| 2 | `f7a86f6` | [42778663441](https://github.com/ashiqrniloy/liveframe/actions/runs/42778663441) | Check, audits, archive gate, peer floors and demo pass. `@arnilo/liveframe@0.3.0-rc.1` published under `next` at 08:14:33Z with a signed provenance statement (transparency log 3781858285; 612 files, shasum `781c23cfe6b940e7ed02ff9d1b6b99e8328345e2`). `@arnilo/liveframe-runner-quickjs@0.3.0-rc.1` then failed with `npm error code ENEEDAUTH`: neither companion exists on the registry, so there is no trusted publisher to authenticate against. No companion version was published. |

Both failures are pre-publish or single-package: the core is the only version on the registry. The tag was moved (deleted and re-pushed) between attempts 1 and 2; nothing had been published at that point.

The publish step is now re-runnable (`.github/workflows/publish.yml`): it skips a package version the registry already holds, so completing the release publishes only the two companions and never republishes the core. `docs/compatibility.md` § Release process says so.

### Registry state after attempt 2

| Check | Result |
| --- | --- |
| `npm view @arnilo/liveframe dist-tags` | `{ next: '0.3.0-rc.1', latest: '0.2.3' }` (the version took about six minutes to propagate) |
| `@arnilo/liveframe-runner-quickjs`, `@arnilo/liveframe-starter` | E404, unpublished |
| Core `bin` in the published manifest | `{"liveframe":"dist/cli/liveframe.js"}` — npm normalised the `./` prefix and printed a `pkg fix` warning; nothing was dropped |

### What completes the release candidate

The owner configures a trusted publisher for each companion name on npmjs.com (repository `ashiqrniloy/liveframe`, workflow `publish.yml`, environment `release`, allowing `npm publish` and `npm dist-tag`), or performs one token publish of each. Then the tag is re-pushed on the re-runnable commit and the workflow publishes the two missing versions under `next` with provenance.

## Registry verification

Pending the two companion packages.
