# 0.2.0 release

`@arnilo/liveframe@0.2.0` is on npm under `latest`, published from tag `v0.2.0` by the trusted-publishing workflow with SLSA provenance, and verified from the registry. Plan 020 Task 9.

## Owner go

Task 8's review left the finding dispositions approved and the final release go open. The owner's instruction for this task is the go, verbatim:

> Complete - [ ] Task 9: Publish 0.2.0 and verify it from the registry from @plans/020-Phase-7-Part-G-Release-0-2-0.md and update the plan once done

That instruction is recorded as Task 8's go in the plan; it authorises the two tag pushes this task needed (the corrected candidate, then the release).

## Rounds

| Tag | Published | Why |
| --- | --- | --- |
| `v0.2.0-rc.4` | yes, under `next` | Task 8's owner-directed follow-up changed two shipped files: the four security reminders in `docs/migration-0.2.md` §5 and the WebKit limitation line in `CHANGELOG.md`. Task 7's archive-doc-change rule required a verified candidate containing them; rc.3 lacked both. |
| `v0.2.0` | yes, under `latest` | Version, changelog date, roadmap and request status lines. No package source change since rc.1. |

The `v0.2.0-rc.4` workflow failed on its first attempt and passed on a rerun with no code change: `switch_under_budget_with_blur_through_surface` measured 17.4 ms against the Chromium 16.67 ms ceiling on the 375 s CI run. That is the already-recorded load-sensitive outlier class (plan 020 T5 notes, backlog P1) and a Chromium run, not the deferred WebKit path. `gh run rerun <id> --failed` then passed every step, including both archive gates, the three peer floors and `demo:test`. No test, threshold or source file was touched. Local `bun run check` before the tag passed with 847 pass, 4 skip, 0 fail.

## Registry facts

- `npm view @arnilo/liveframe dist-tags` → `{ latest: '0.2.0', next: '0.2.0-rc.4' }`. `next` stays at the candidate, as it did after 0.1.0; this machine has no npm auth for `npm dist-tag add`, and trusted publishing covers the workflow's publish only.
- Published 2026-10-29T23:11:45Z from tag commit `524054b`; the [Publish run](https://github.com/ashiqrniloy/liveframe/actions/runs/40970192237) passed in 8 m 12 s on its first attempt, `Tag matches package.json` and `Publish` both `success`. The version appeared on the registry about two minutes after the run finished.
- shasum `52bcf4aa76ebf85c0ae299c6953036a9315af451`; integrity `sha512-u/KXE1WfrjLdGYiIqtHQmb5TwjEQTm4roRbq5XZ9cJB/36lkOaeTjp+Gea3D2s7IyiPrCokHpWbpi0T6dyv+lA==`. Registry metadata carries no `gitHead` for this release (neither does `0.2.0-rc.4`); the tag commit above is the provenance subject.
- Provenance: `dist.attestations.provenance.predicateType` is `https://slsa.dev/provenance/v1`; `npm audit signatures --include-attestations` in an installed copy reports "60 packages have verified registry signatures" and "17 packages have verified attestations". No token is stored (trusted publishing).

## Registry-mode checks

| Check | Command | Result |
| --- | --- | --- |
| Version | `npm view @arnilo/liveframe version` | `0.2.0` |
| Archive gate | `timeout 600s bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.0` | passed all 11 steps in 6.1 s |
| Corrected docs shipped | `npm pack @arnilo/liveframe@0.2.0`, unpack | `package/docs/migration-0.2.md` contains §5 "Keep the host's security boundaries"; `package/CHANGELOG.md` contains the WebKit limitation line; `package/package.json` version is `0.2.0` |
| Demo host from the registry | `examples/demo-host` copied to `/tmp/lf-demo-reg`, dependency set to `0.2.0`, `bun install`, `tsc --noEmit`, `bun test` | typecheck clean; 52 pass, 0 fail, 120 expect() calls across 7 files (32.7 s) |
| Demo gate on the checkout | `timeout 900s bun run demo:test` (packed archive from this commit) | 52 pass, 0 fail (32.6 s) |
| Provenance | `npm audit signatures --include-attestations` | signatures and attestations verified, above |

`0.2.0-rc.4` was checked the same way before the release tag: archive gate `--package @arnilo/liveframe@0.2.0-rc.4` passed all 11 steps in 6.1 s, the packed tarball contained both corrected files, and provenance was present. Its workflow run is [40967990789](https://github.com/ashiqrniloy/liveframe/actions/runs/40967990789) (attempt 2).

## Release files

- `package.json`: `version` `0.2.0` (from `0.2.0-rc.4`).
- `CHANGELOG.md`: `## Unreleased (0.2.0)` → `## 0.2.0 — 2026-10-30`; the candidate paragraph now records rc.3's missing reminders and rc.4's fix.
- `roadmap.md` §3: one line in the plan ledger for plan 020, and the release named in the current-phase line.
- `plans/requests/synapta-adoption-requests.md`, `plans/requests/clay-adoption-requests.md`: delivery status lines name the published `0.2.0` and the registry verification.

Commits: `350d388` (Task 8 review), `a645986` (rc.4), `524054b` (release 0.2.0). Each was pushed to `main` before its tag. Task 10's impact analysis and its archive-hash comparison remain the next task.

## Post-release finding: the bare-import loader test and Bun's auto-install

The first local `bun run check` after the publication failed `loader_leaves_noncanonical_sdk_imports_bare` (`src/__tests__/preview-load.test.ts`), which asserts that a bare `@arnilo/liveframe/sdk` import inside a loaded draft stays bare and therefore does not resolve. It resolved: Bun 1.4.4's default auto-install fetched the published `@arnilo/liveframe@0.2.0` from the registry and imported `dist/sdk/index.js`. Reproduced outside the suite (`bun probe.ts` in an empty `/tmp` directory prints the cache path), and independent of `BUN_INSTALL_CACHE_DIR` or `--no-install` passed to the parent, because the test spawns its own child.

This is an environment assumption, not shipped-code behaviour: the child probe in that test was the only spawn whose assertion depends on a specifier failing to resolve. `/tmp/bareprobe` and both `/tmp` probes above are local only. Fixed in the same task by passing `--no-install` to that child (`src/__tests__/preview-load.test.ts:127`), with a one-line comment on why. The test is unchanged otherwise. It is a repository test file, not part of the archive, so the published `0.2.0` contents are unaffected and no new candidate was required. Fresh `timeout 900s bun run check` after the fix: 847 pass, 4 skip, 0 fail across 107 files (287.75 s).
