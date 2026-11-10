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

The core took about six minutes from `npm publish` to appear; the companions took four. A 404 inside that window is propagation, not failure.

## Completing the publication by hand

A package that has never been published has no trusted publisher to authenticate against (`npm/cli#8544` is still open), so `ENEEDAUTH` could not be fixed from CI. With the owner's direction, the two companions were published once by hand on 2026-11-10 from the same staging script CI runs:

```sh
bun run build
bun run release:stage /tmp/lf/runner  packages/runner-quickjs
bun run release:stage /tmp/lf/starter packages/starter
npm publish /tmp/lf/runner  --access public --tag next
npm publish /tmp/lf/starter --access public --tag next
```

| Package | `0.0.0-stage` | `0.3.0-rc.1` | Files | Shasum |
| --- | --- | --- | --- | --- |
| `@arnilo/liveframe-runner-quickjs` | 09:25:25Z | 09:26:42Z | 15 | `9c14290188b2a914865b6bc0c8e20c19a46fdc7c` |
| `@arnilo/liveframe-starter` | 09:25:51Z | 09:27:29Z | 20 | `b8c9de9f73376e9c7ba8e06255fa0de3d7ab6872` |

The `0.0.0-stage` version claims the name before the release, as the core did on 2026-10-26 (`0.0.0-stage` at 20:09:23Z, `0.1.0-rc.1` a minute later), and stays on both packages. File counts match the CI staging the workflow logged in attempt 2 (15 and 20), so the published bits are the ones the gate proved.

A token publish cannot carry provenance, so the companions' rc has none: `registry.npmjs.org/-/npm/v1/attestations/<package>@0.3.0-rc.1` returns 404 for both. `0.3.0` publishes from CI and restores it. Once each name existed the owner can also configure its trusted publisher, so every later release is CI-only again.

This departs from Task 5's "no manual publish; CI only" criterion; the deviation and its reason are recorded, and no later release needs it.

## Registry state

| Check | Result |
| --- | --- |
| `npm view @arnilo/liveframe dist-tags` | `{ next: '0.3.0-rc.1', latest: '0.2.3' }` |
| `npm view @arnilo/liveframe-runner-quickjs dist-tags` | `{ latest: '0.3.0-rc.1', next: '0.3.0-rc.1' }` |
| `npm view @arnilo/liveframe-starter dist-tags` | `{ latest: '0.3.0-rc.1', next: '0.3.0-rc.1' }` |
| Core `bin` in the published manifest | `{"liveframe":"dist/cli/liveframe.js"}` — npm normalised the `./` prefix and printed a `pkg fix` warning; nothing was dropped |
| Core attestations (`registry.npmjs.org/-/npm/v1/attestations/@arnilo/liveframe@0.3.0-rc.1`) | `https://github.com/npm/attestation/tree/main/specs/publish/v0.1` and `https://slsa.dev/provenance/v1`; repository `https://github.com/ashiqrniloy/liveframe`, workflow path `.github/workflows/publish.yml`, ref `refs/tags/v0.3.0-rc.1` |

npm sets `latest` on a package's first publish, so both new packages show the rc under `latest` until `0.3.0` is published.

The tag stays on `f7a86f6`, the commit attempt 2 published from and the ref the core's provenance names. `11ad419` (re-runnable publish step), `d06740b` (this record) and the companion publishes touch no source the packages ship.

## Registry verification

Run from a fresh install of the three published versions, never the checkout's archives.

| Check | Result |
| --- | --- |
| `bun scripts/release/archive-gate.ts --dir . --package @arnilo/liveframe@0.3.0-rc.1` | 15 steps pass, 6.7 s, installed outside the checkout |
| `bun scripts/release/archive-gate.ts --dir packages/runner-quickjs --package @arnilo/liveframe-runner-quickjs@0.3.0-rc.1` | 2 steps pass, 5.6 s |
| `bun scripts/release/archive-gate.ts --dir packages/starter --package @arnilo/liveframe-starter@0.3.0-rc.1` | 2 steps pass, 2.0 s |
| Installed API against the baselines | core against `api/0.2.3.json` + `register-0.3.0.json`: no failures; each companion against `api/0.3.0-<package>.json` with `[]`: no failures |
| Installed API against the checkout | `compareApiSurface(checkout, installed, [])` reports nothing for all three |
| `bun scripts/getting-started-test.ts --registry` | guide passed in 3.0 s, installing `0.3.0-rc.1` of all three from the registry; the core's lockfile integrity `sha512-h5ud8Irj…` equals the registry's |
| `bun scripts/demo-test.ts --registry` | 67 pass, 0 fail, 34.5 s |
| `bunx --bun npm@12.2.1 audit signatures --json --include-attestations` | `invalid: []`, `missing: []`; `@arnilo/liveframe@0.3.0-rc.1` verified with 2 bundles |

`getting-started-test.ts` and `demo-test.ts` gained `--registry`, which installs the published versions instead of packing the checkout, so both checks run against the registry in one command.

### Finding from verification

`mcp_notice_recommends_installed_quickjs_runner` failed once the published runner was installed anywhere on this host: `Bun.resolveSync` answers from Bun's global install cache, so the MCP notice told a config outside any `node_modules` tree to use `quickjsRunner()`, a package it cannot import. `quickjsAdvice` now walks the config's ancestors for `node_modules/@arnilo/liveframe-runner-quickjs` instead (`src/cli/mcp.ts`). This is source-only and the published rc does not carry it; `0.3.0` will, after Task 6's review. Signature verification used the isolated exact-version project the 0.2.3 release used (`bun install`, then `--package-lock-only`, then `audit signatures`). The companions do not appear in `verified` because they carry no attestations; they are neither invalid nor missing.

