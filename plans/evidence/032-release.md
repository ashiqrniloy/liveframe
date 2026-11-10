# Release 0.3.0

`@arnilo/liveframe@0.3.0`, `@arnilo/liveframe-runner-quickjs@0.3.0` and `@arnilo/liveframe-starter@0.3.0` published under `latest` from protected CI with verified provenance, and `next` moved to the same version, on 2026-11-10.

- Tag `v0.3.0` names commit `18f2fe1` ("Plan 032 T7: Bump all three packages to 0.3.0").
- Publish workflow [run 42832386313](https://github.com/ashiqrniloy/liveframe/actions/runs/42832386313): success, 14:16:19Z–14:31:11Z, after the owner approved the `release` environment.
- Readiness review and the owner's go: [032-release-readiness-review.md](032-release-readiness-review.md); the pre-release candidate record is [032-release-candidate.md](032-release-candidate.md).

## The tagged commit

`18f2fe1` bumps all three packages from `0.3.0-rc.1` to `0.3.0`, narrows both companions' peer range on `@arnilo/liveframe` back to `~0.3.0` (the rc widened it to `~0.3.0-0`, which a `~0.3.0` range cannot match), dates the changelog entry `0.3.0 — 2026-11-10`, restores the companion READMEs and `docs/compatibility.md` to `~0.3.0`, updates the workspace test fixture, and fixes the demo gate's packed-archive install (`bun pm pack` names the tarball `<name>-<version>.tgz`, so the check keeps the name it produced instead of pinning `arnilo-liveframe.tgz`).

Local gates on `18f2fe1`:

| Gate | Result |
| --- | --- |
| `timeout 1200 bun run check` | build, gen:check, typecheck, lint, format pass; 1,769 pass, 4 skip, 0 fail, 160 files, 491.81 s |
| `timeout 900 bun run release:gate` | 15 core steps, 2 runner steps, 2 starter steps pass; each archive installs outside the checkout |
| `timeout 900 bun scripts/release/peer-floors.ts` | React 19.0.0: 119 pass; Playwright 1.49.0: 23 pass; MCP server 2.0.0: 87 pass |
| `timeout 900 bun run demo:test` | 67 pass, 0 fail |
| `timeout 300 bun audit --prod --audit-level=high` | no vulnerabilities (20 packages) |
| `timeout 300 bun scripts/release/audit-bundled.ts` | no high or critical advisories in the 7 bundled packages |
| `bun run release:versions --tag v0.3.0` | `3 packages at 0.3.0` |

## Publication

Each package published from CI through npm trusted publishing, which attached provenance; the workflow then moved `next` for each.

| Package | Version | Shasum | Provenance log index |
| --- | --- | --- | --- |
| `@arnilo/liveframe` | `0.3.0` | `87ecd566c95ef90d28e6e0a83822254a9f07374f` | 3787607732 |
| `@arnilo/liveframe-runner-quickjs` | `0.3.0` | `9edb3a2492a27c37eacc988d507864bd4db18827` | 3787610874 |
| `@arnilo/liveframe-starter` | `0.3.0` | `e62c30f9474d4a7c6da3329d38d3ded010d7bdaa` | 3787612917 |

npm reported "being processed" for each version and for each dist-tag change; the versions and tags were readable from the registry about three minutes later. The `next` dist-tag step needed the companions' newly configured trusted publishers to allow `npm dist-tag`; all three succeeded, so `0.3.0` is the first release whose `next` moved without the owner running a command.

## Registry verification

| Check | Result |
| --- | --- |
| `npm view <package> dist-tags` | core `{ latest: '0.3.0', next: '0.3.0' }`; runner-quickjs and starter `{ latest: '0.3.0', next: '0.3.0' }` |
| Provenance, all three | `slsa.dev/provenance/v1` names repository `ashiqrniloy/liveframe` and ref `refs/tags/v0.3.0` |
| `bun scripts/release/archive-gate.ts --dir . --package @arnilo/liveframe@0.3.0` | 15 steps pass in 5.6 s, installed outside the checkout |
| `bun scripts/release/archive-gate.ts --dir packages/runner-quickjs --package @arnilo/liveframe-runner-quickjs@0.3.0` | 2 steps pass in 5.2 s |
| `bun scripts/release/archive-gate.ts --dir packages/starter --package @arnilo/liveframe-starter@0.3.0` | 2 steps pass in 2.0 s |
| Installed API against the baselines | core against `api/0.2.3.json` + `register-0.3.0.json`: no failures; each companion against `api/0.3.0-<package>.json` with `[]`: no failures |
| Installed API against the checkout | `compareApiSurface(checkout, installed, [])` reports nothing for all three |
| `bun scripts/getting-started-test.ts --registry` | guide passed in 3.2 s installing `0.3.0` of all three |
| `bun scripts/demo-test.ts --registry` | 67 pass, 0 fail, 33.3 s |
| `npm audit signatures --json --include-attestations` | `invalid: []`, `missing: []`; all three packages verified with attestation bundles (plus their dependencies) |

The signature check needed a clean npm cache: the local npm cache still held the companions' pre-`0.3.0` packument and answered `ETARGET` until the check ran with `--cache` pointing at an empty directory. The scripts and the API comparison read the registry directly and were unaffected.

## State after the release

- `latest` on all three packages is `0.3.0`; both companions left the `0.3.0-rc.1` version behind under no tag.
- The two companions carry provenance for the first time; the rc's manual first publish was the only publish outside CI.
- The MCP notice fix (`src/cli/mcp.ts`, `7e48ddc`) ships in `0.3.0` and was not in the rc.
- Deferred into 0.3.x by the owner: the 24 impact findings, the two open P1 backlog entries and the quiet-host proof. Recorded in [032-release-readiness-review.md](032-release-readiness-review.md) and `decision-logs/2026-11-10-1219-go-on-0-3-0-with-deferrals.md`.
- Plan 032 Task 8 (architectural impact analysis) remains.
