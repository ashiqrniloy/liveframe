# 0.4.0-rc.1 release verification

## Local candidate

All four packages are at `0.4.0-rc.1`. The three companions peer on `~0.4.0-0`.

```sh
bun install --lockfile-only
bun run build
for pair in .: packages/runner-quickjs:-runner-quickjs packages/starter:-starter packages/a2ui:-a2ui; do
  bun scripts/release/api-surface.ts "${pair%:*}" \
    --out "scripts/release/api/0.4.0${pair#*:}.json" --from "v0.4.0-rc.1 checkout"
done
```

| Command | Result |
| --- | --- |
| `bun run release:versions --tag v0.4.0-rc.1` | `4 packages at 0.4.0-rc.1` |
| `bun test src/__tests__/api-stability.test.ts src/__tests__/workspace.test.ts` | 26 passed, zero failures. All four built APIs match their baselines. |
| `bun run check` | 2,129 passed, six skipped, zero failures. |
| `bun run release:gate` | Core passed 15 steps. A2UI, QuickJS and starter each passed two steps. All four local archives installed outside the checkout. |
| `bun run guide:test` | Getting-started guide passed in 3.3 s against local archives. |
| `bun run demo:test` | 78 passed, zero failures against the local core archive. |

## Registry preflight

On 2026-11-21, public npm registry metadata requests for the four package names returned the following results. The exact A2UI request, `curl -fsS https://registry.npmjs.org/@arnilo%2Fliveframe-a2ui/0.0.0-stage`, returned HTTP 404.

| Package | `latest` | `next` | `0.4.0-rc.1` |
| --- | --- | --- | --- |
| `@arnilo/liveframe` | `0.3.0` | `0.3.0` | Absent |
| `@arnilo/liveframe-runner-quickjs` | `0.3.0` | `0.3.0` | Absent |
| `@arnilo/liveframe-starter` | `0.3.0` | `0.3.0` | Absent |
| `@arnilo/liveframe-a2ui` | Package absent | Package absent | Absent |

## A2UI name claim

The owner completed npm browser login and approved interactive publication. The direct publish stayed at the authentication step and the registry continued returning 404, so it was interrupted. Using the authenticated npm session, `npm stage publish --access public --tag stage --registry https://registry.npmjs.org` staged a minimal `@arnilo/liveframe-a2ui@0.0.0-claim.1` and npm created its public `0.0.0-stage` placeholder. The exact-version registry endpoint returned HTTP 200. The staged `0.0.0-claim.1` was left unapproved, and `0.4.0-rc.1` was left available for CI.

Commit `f71f90d` was pushed to `main`, starting [CI run 44929075938](https://github.com/ashiqrniloy/liveframe/actions/runs/44929075938). The owner confirmed the trusted publisher setup for all four packages, including both publish and dist-tag permissions. CI passed on the candidate commit. The version gate passed again, and `v0.4.0-rc.1` was pushed at `f71f90d`. [Publish run 44933932159](https://github.com/ashiqrniloy/liveframe/actions/runs/44933932159) passed after the owner approved the protected `release` deployment. GitHub Actions reported a signed provenance statement and a successful publish under `next` for each of the four packages.

## Registry verification

npm reported each publish as processing. The tags and provenance appeared before the core download was available. The first archive and consumer checks returned HTTP 404 for the core tarball. The checks below were rerun after it became available.

| Command or check | Result |
| --- | --- |
| `npm view <package> dist-tags --json --prefer-online` | All four `next` tags read `0.4.0-rc.1`. The core, QuickJS and starter `latest` tags read `0.3.0`. A2UI, with no previous release, also reported `latest` as `0.4.0-rc.1`. |
| `bun scripts/release/archive-gate.ts --dir . --package @arnilo/liveframe@0.4.0-rc.1` | 15 steps passed in 4.5 s. |
| `bun scripts/release/archive-gate.ts --dir packages/a2ui --package @arnilo/liveframe-a2ui@0.4.0-rc.1` | Two steps passed in 0.5 s. |
| `bun scripts/release/archive-gate.ts --dir packages/runner-quickjs --package @arnilo/liveframe-runner-quickjs@0.4.0-rc.1` | Two steps passed in 3.1 s. |
| `bun scripts/release/archive-gate.ts --dir packages/starter --package @arnilo/liveframe-starter@0.4.0-rc.1` | Two steps passed in 1.4 s. |
| `bun install` in a fresh consumer with four exact-version dependencies, followed by `readApiSurface` and `compareApiSurface` | Installed manifests reported `0.4.0-rc.1`. All four API comparisons against the matching `0.4.0*.json` baselines returned zero differences. |
| `bun scripts/getting-started-test.ts --registry` | Passed in 2.4 s. |
| `bun scripts/demo-test.ts --registry` | 78 passed and zero failures in 40.62 s. |
| `npm install --package-lock-only --ignore-scripts`, then `npm audit signatures --json --include-attestations --cache <empty-directory>` | `invalid: []`, `missing: []`. All four exact versions were verified with two attestation bundles each. |
| npm registry provenance payloads | Each `https://slsa.dev/provenance/v1` statement names `https://github.com/ashiqrniloy/liveframe`, `.github/workflows/publish.yml` and `refs/tags/v0.4.0-rc.1`. |
