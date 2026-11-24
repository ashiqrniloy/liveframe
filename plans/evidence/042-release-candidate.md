# 0.4.1-rc.1 release verification

## Local candidate

All four packages are at `0.4.1-rc.1`. The three companions peer on `~0.4.0-0`. No `0.4.1*.json` baseline is generated: the API gate still compares the checkout against the four `0.4.0*.json` baselines through the `register-0.4.1*.json` registers, and plan 043 generates the 0.4.1 baselines from the `v0.4.1` tag.

```sh
bun install --lockfile-only
bun run build
```

| Command | Result |
| --- | --- |
| `bun scripts/release/versions.ts --tag v0.4.1-rc.1` | `4 packages at 0.4.1-rc.1` |
| `bun test --conditions liveframe:source src/__tests__/workspace.test.ts src/__tests__/api-stability.test.ts` | 26 passed, zero failures. |
| `bun run check` | 2,196 passed, six skipped, zero failures (892 s, load about 3–5). |
| `bun run release:gate` | Core passed 15 steps. A2UI, QuickJS and starter each passed two steps. All four local archives installed outside the checkout. |
| `bun run guide:test` | Getting-started guide passed in 4.1 s against local archives. |
| `bun run demo:test` | 78 passed, zero failures in 43 s against the local core archive. |
| `bun pm pack`, then `tar tzf` | The core archive holds `package/docs/security-checklist.md` and `package/docs/security.md`. |

## Registry preflight

On 2026-11-24, `npm view <package> dist-tags --json --prefer-online` returned `latest` `0.4.0` and `next` `0.4.0` for all four packages, and `npm view <package>@0.4.1-rc.1 version` returned nothing for each.

## Publish

The owner approved the push and the tag on 2026-11-24. [CI run 45351357593](https://github.com/ashiqrniloy/liveframe/actions/runs/45351357593) passed on `4c3c594`. The version gate passed again, and `v0.4.1-rc.1` was pushed at `4c3c594`. [Publish run 45359117456](https://github.com/ashiqrniloy/liveframe/actions/runs/45359117456) passed after the owner approved the protected `release` deployment. GitHub Actions reported a signed provenance statement and a publish under `next` for each of the four packages. npm's warning that `bin[liveframe]` "was invalid and removed" also appeared in the 0.4.0 publish. The registry manifest of `0.4.1-rc.1`, like that of `0.4.0`, still carries `bin.liveframe`.

## Registry verification

The versions were not readable for about a minute after the publish finished. The checks below ran once they were.

| Command or check | Result |
| --- | --- |
| `npm view <package> dist-tags --json --prefer-online` | All four: `next` is `0.4.1-rc.1`, `latest` is `0.4.0`. |
| `bun scripts/release/archive-gate.ts --dir . --package @arnilo/liveframe@0.4.1-rc.1` | 15 steps passed in 5.3 s. |
| `bun scripts/release/archive-gate.ts --dir packages/a2ui --package @arnilo/liveframe-a2ui@0.4.1-rc.1` | Two steps passed in 1.4 s. |
| `bun scripts/release/archive-gate.ts --dir packages/starter --package @arnilo/liveframe-starter@0.4.1-rc.1` | Two steps passed in 2.3 s. |
| `bun scripts/release/archive-gate.ts --dir packages/runner-quickjs --package @arnilo/liveframe-runner-quickjs@0.4.1-rc.1` | **Failed** on all four runs: installed package smoke, 15 of 16 runner conformance cases. `runner_isolation_deep_recursion (§7.5)`: "expected limit-exceeded, got render-failed: stack overflow". The same gate against the local archive passed twice. See the finding below. |
| `bun add` of the four exact versions in a fresh consumer, then `readApiSurface` and `compareApiSurface` against `0.4.0.json` with `register-0.4.1.json`, `0.4.0-starter.json` with `register-0.4.1-starter.json`, and `0.4.0-runner-quickjs.json` and `0.4.0-a2ui.json` with no register | All four installed at `0.4.1-rc.1` with zero differences. |
| The installed core's `docs/` | Holds `security-checklist.md` and `security.md`. |
| `bun scripts/getting-started-test.ts --registry` | Passed in 3.1 s. |
| `bun scripts/demo-test.ts --registry` | 78 passed and zero failures in 42 s. |
| `npm install --package-lock-only --ignore-scripts` of the four exact versions (npm 12.2.3) | **Failed** with `ERESOLVE`: "peer @arnilo/liveframe@"~0.4.0-0" from @arnilo/liveframe-runner-quickjs@0.4.1-rc.1" does not match `0.4.1-rc.1`. See the finding below. |
| `npm install --ignore-scripts --legacy-peer-deps`, then `npm audit signatures --json --include-attestations --cache <empty-directory>` | `invalid: []`, `missing: []`. All four `0.4.1-rc.1` packages were verified with attestations. |

## Finding: the companions' peer range admits a core they cannot run on

The candidate's peer range is `~0.4.0-0`, which `versions.ts` derives as `~X.Y.0-0`. Under semver, a prerelease satisfies a range only when a comparator names the same `X.Y.Z` tuple, so `~0.4.0-0` matches `0.4.0` and `0.4.0-rc.*` but not `0.4.1-rc.1`. This has two effects:

- npm refuses to install the four candidate packages together (`ERESOLVE`). Bun installs them.
- `archive-gate.ts --package` installs the core from the peer range (`archive-gate.ts:129`), so it paired runner `0.4.1-rc.1` with core `0.4.0`. In that pairing, deep recursion is reported as `render-failed` with the message "stack overflow" instead of `limit-exceeded`. Plan 041's LF-27 fix stopped classifying limits by message text, which a widget can forge. The runner now reads the limit from the `debug` text that core 0.4.1's runner kit returns (`packages/runner-quickjs/src/result.ts`, `sanitized`). Core 0.4.0's kit ignores `debug: true`. With core `0.4.1-rc.1` installed in the same directory, the smoke passed 16 of 16.

The released range for final 0.4.1, `~0.4.0`, admits core `0.4.0` in the same way. A host that upgrades only the runner would get the misclassification. The isolation still holds: the render stops within its deadline. Only the reported kind is wrong.

## 0.4.1-rc.2 local candidate

The owner chose the fix on 2026-11-24 ([decision](../../decision-logs/2026-11-24-1550-companion-peer-floor-is-the-release-patch.md)). Each companion peers on its own patch: `~X.Y.Z`, with `~X.Y.Z-0` for a prerelease. All four packages are at `0.4.1-rc.2`, and the companions peer on `~0.4.1-0`. `archive-gate.ts --package` now installs the core at the companion's own version or tag, not from the local manifest's peer range. Run against the published `0.4.1-rc.1` runner, it installed core `0.4.1-rc.1` and passed both steps in 2.7 s, where it had failed before.

| Command | Result |
| --- | --- |
| `bun scripts/release/versions.ts --tag v0.4.1-rc.2` | `4 packages at 0.4.1-rc.2` |
| `bun test` on the workspace, docs, API-stability and acceptance-script files | 42 passed, zero failures. The new test `version_problems_require_the_release_patch_as_the_peer_floor` failed first, until the manifests moved to `~0.4.1-0`. |
| `bun run check` | 2,197 passed, six skipped, zero failures (848 s). |
| `bun run release:gate` | Core passed 15 steps. A2UI, QuickJS and starter each passed two steps. |
| `bun run guide:test` | Passed in 4.5 s. |
| `bun run demo:test` | 78 passed, zero failures in 43 s. |

## 0.4.1-rc.2 publish

[CI run 45371937526](https://github.com/ashiqrniloy/liveframe/actions/runs/45371937526) passed on `0a8c0be`. The version gate passed (`4 packages at 0.4.1-rc.2`), and `v0.4.1-rc.2` was pushed at `0a8c0be`. [Publish run 45380067362](https://github.com/ashiqrniloy/liveframe/actions/runs/45380067362) passed after the owner approved the protected `release` deployment. It published all four packages under `next`, each with a signed provenance statement.

## 0.4.1-rc.2 registry verification

| Command or check | Result |
| --- | --- |
| `npm view <package> dist-tags --json --prefer-online` | All four: `next` is `0.4.1-rc.2`, `latest` is `0.4.0`. All three companions peer on `~0.4.1-0`. |
| `bun scripts/release/archive-gate.ts --dir . --package @arnilo/liveframe@0.4.1-rc.2` | 15 steps passed in 5.4 s. |
| `… --dir packages/a2ui --package @arnilo/liveframe-a2ui@0.4.1-rc.2` | Two steps passed in 1.2 s. |
| `… --dir packages/runner-quickjs --package @arnilo/liveframe-runner-quickjs@0.4.1-rc.2` | Two steps passed in 4.0 s, including 16 of 16 runner conformance cases. |
| `… --dir packages/starter --package @arnilo/liveframe-starter@0.4.1-rc.2` | Two steps passed in 2.4 s. |
| `bun add` of the four exact versions in a fresh consumer, then `readApiSurface` and `compareApiSurface` against the four `0.4.0*.json` baselines through the 0.4.1 registers, as for rc.1 | All four installed at `0.4.1-rc.2` with zero differences. |
| The installed core's `docs/` | Holds `security-checklist.md`. |
| `bun scripts/getting-started-test.ts --registry` | Passed in 2.8 s. |
| `bun scripts/demo-test.ts --registry` | 78 passed and zero failures in 43 s. |
| `npm install --package-lock-only --ignore-scripts` of the four exact versions (npm 12.2.3), without `--legacy-peer-deps` | Resolved, with zero vulnerabilities. |
| `npm install --ignore-scripts`, then `npm audit signatures --json --include-attestations --cache <empty-directory>` | `invalid: []`, `missing: []`. All four `0.4.1-rc.2` packages were verified with attestations. |
| npm registry provenance payloads (`/-/npm/v1/attestations/<package>@0.4.1-rc.2`) | Each `https://slsa.dev/provenance/v1` statement names `https://github.com/ashiqrniloy/liveframe`, `.github/workflows/publish.yml` and `refs/tags/v0.4.1-rc.2`. |
| `npm install --package-lock-only` of core `0.4.0` with runner `0.4.1-rc.2` | Refused with `ERESOLVE`. npm now rejects the pairing that failed in rc.1. |

`0.4.1-rc.1` stays on npm with its range `~0.4.0-0`. `next` no longer points to it.
