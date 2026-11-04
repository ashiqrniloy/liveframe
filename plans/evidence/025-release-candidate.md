# 0.2.3 release candidate

## Status

`@arnilo/liveframe@0.2.3-rc.1` is published under `next`, with verified signatures and provenance. Task 9 is complete; `latest` remains `0.2.2`.

## Owner authorization

On 2026-11-04 the owner requested: “Complete - [ ] Task 9: Publish 0.2.3-rc.1 under `next` and verify it from the registry … and update the plan once done”. This authorizes the RC publication and its tag push after the pre-publish requirements pass. It does not close Task 8's quiet-host proof or authorize the final 0.2.3 release.

## Pre-publish protection checks

Checked 2026-11-04 using the authenticated repository administrator `ashiqrniloy`:

- `gh api repos/ashiqrniloy/liveframe/environments` returned `{"total_count":0,"environments":[]}`.
- `gh api repos/ashiqrniloy/liveframe/environments/release` returned HTTP 404. There is no protected `release` environment yet; the workflow declaration alone does not establish reviewers or tag rules.
- Owner chose “Reviewer ashiqrniloy + v* tags”. Created the environment with required reviewer user ID `104660512` (`ashiqrniloy`), then created a deployment policy of type `tag`, name `v*`. The environment API returns required-reviewer and branch-policy protections; its deployment policy list returns exactly that one tag rule, ID `65499502`. Branch dry runs are blocked; dispatch dry runs on a tag. Self-review is allowed so the sole owner can approve the release; administrators retain GitHub's default bypass setting.
- Owner answered “Confirmed” to the npm trusted-publisher configuration: repository `ashiqrniloy/liveframe`, workflow `publish.yml`, environment `release` if supported. This is owner-attested configuration; authenticated npm settings are unavailable here.

## Registry before publication

`curl -fsSL https://registry.npmjs.org/@arnilo%2fliveframe`, parsed with Bun, returned `latest: 0.2.2`, `next: 0.2.2-rc.2`; `0.2.3-rc.1` does not exist. No tag was pushed and no publish was attempted during this check.

## Verification

Local pre-tag gates passed on the RC checkout. Logs are local-only in `/evidence/025-task-9/`; regenerate with the release checklist commands in `docs/compatibility.md`.

- `timeout 900s bun run check`: build, generated files, types, lint, format and tests pass; 1,063 pass, four skip, zero fail, 120 files, 382.33 s of tests.
- `timeout 900s bun run release:gate`: all 14 steps pass (5.7 s).
- `timeout 900s bun scripts/release/peer-floors.ts`: React 19.0.0 (117), Playwright 1.49.0 (23) and MCP server 2.0.0 (78), all pass.
- `timeout 600s bun run demo:test`: 53 pass, zero fail.

## Tag workflow and environment approval

- Tag `v0.2.3-rc.1` points to `5413ab80367fceccf45372186c9dc32aa5a116e4`.
- [Publish run 41851529137](https://github.com/ashiqrniloy/liveframe/actions/runs/41851529137) succeeded. The job entered the `release` environment and waited for required review. Using the owner's explicit publication authorization, the agent submitted the review through the authenticated reviewer account `ashiqrniloy`; the pending-deployments API accepted it and returned deployment `7549226926`. The review comment records the owner authorization, passing local gates and confirmed publisher configuration.
- CI repeated the full check (1,063 pass, four skip, zero fail, 453.05 s), production and bundled audits, 14-step archive gate (6.8 s), three peer floors (117 / 23 / 78 passing tests) and demo (53 pass), then staged and published with `--tag next`.
- npm accepted the publication at `2026-11-04T15:03:32Z`, reporting that registry processing may take a few minutes. The initial registry lookup and archive installation failed because that version was not available yet; these are not passing registry checks.
- CI signed provenance and logged transparency entry [3690694075](https://search.sigstore.dev/?logIndex=3690694075). Registry attestation verification passed below.

## SBOM

[SBOM artifact 13335588098](https://github.com/ashiqrniloy/liveframe/actions/runs/41851529137/artifacts/13335588098), archive digest `sha256:06b2bd5511fb1f5b8c75a06641f6fce0e194470e23b3018059ffc1aa0613625c`. Downloaded using `gh run download 41851529137 --name sbom --dir evidence/025-task-9/ci-sbom`.

`sbom.cdx.json` identifies `@arnilo/liveframe@0.2.3-rc.1`, CycloneDX 1.6, acorn 8.19.0 and seven bundled components: sucrase, lines-and-columns, ts-interface-checker and the four `@jridgewell` mapping packages. The artifact is retained by CI; the downloaded copy stays local-only.

## Registry verification (2026-11-04)

The version became available by `15:06Z`, after the initial propagation failures. npm CLI 12.2.1 was run through Bun (`bunx --bun npm@12.2.1`) for the explicitly required npm verification commands; installs and the release harness use Bun.

| Check | Command | Result |
| --- | --- | --- |
| Dist-tags | `bunx --bun npm@12.2.1 view @arnilo/liveframe dist-tags --json` | `next: 0.2.3-rc.1`, `latest: 0.2.2` |
| Registry archive | `bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.3-rc.1 --keep` | All 14 steps pass, 5.5 s, installed outside the checkout. |
| API comparison | `readApiSurface(installedPackageRoot)` then `compareApiSurface(baseline022, installedSurface, register023)` | `register: []`, `failures: []`; declarations, exports, schemas, corpus and vectors pass against `scripts/release/api/0.2.2.json`. |
| Signatures and provenance | In an isolated project: `bun install`, `bunx --bun npm@12.2.1 install --package-lock-only --ignore-scripts`, `bunx --bun npm@12.2.1 audit signatures --json --include-attestations` | Exit 0, `invalid: []`, `missing: []`, verified entry for `@arnilo/liveframe@0.2.3-rc.1` with attestation bundles. |

The verified SLSA v1 provenance identifies `.github/workflows/publish.yml`, `refs/tags/v0.2.3-rc.1`, source commit `5413ab80367fceccf45372186c9dc32aa5a116e4`, GitHub's hosted runner and workflow run `41851529137/attempts/1`. Its transparency log index is `3690694075`; its SHA-512 subject digest matches the registry integrity below.

- Tarball: `https://registry.npmjs.org/@arnilo/liveframe/-/liveframe-0.2.3-rc.1.tgz`.
- SHA-1: `fce83cc8e08100d70722f3adeca4ee67f83cb671`.
- Integrity: `sha512-p2cEek0bnDfgkTddDPV0tc8wcayvnuhNWO/91EOomqMh7jVfzS4b24zmyslHnrmImCMb9VoPEUTb1DHa2HgNFg==`.

Raw verification JSON and logs are local-only under `/evidence/025-task-9/`. Regenerate the API snapshot with `bun scripts/release/api-surface.ts <installedPackageRoot> --out <surface.json>`, then compare it using `compareApiSurface` from that module and the baseline/register named above. Regenerate signatures in a fresh project depending only on the exact RC using the table's commands. The registry and CI links provide the durable artifacts.
