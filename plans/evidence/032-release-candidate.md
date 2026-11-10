# 0.3.0-rc.1 release verification

## Authorization and source

Task 5 was requested by the owner on 2026-11-10 ("Complete Task 5: Publish `0.3.0-rc.1` of all three packages under `next` and verify from the registry"). As with plan 025 Task 9, that request authorizes the release-candidate tag and publication.

Version `0.3.0-rc.1` with the widened `~0.3.0-0` peer range is commit `af97604`. The tag `v0.3.0-rc.1` names it; the local checklist below ran on that commit.

Pre-publication blocker, recorded before the tag was pushed: neither companion package exists on the registry (`npm view @arnilo/liveframe-runner-quickjs` and `@arnilo/liveframe-starter` both return E404), so the CI job cannot be the first publisher. npm permits a trusted publisher configured ahead of a first publish, but it must exist on npmjs.com for each package name and allow `npm publish`; the maintainer token in `~/.npmrc` returns 401, so no manual publish is possible from this checkout. Awaiting the owner's confirmation of the two trusted publishers.

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

## Registry verification

Pending publication.
