# 0.2.3 release verification

## Authorization and source

The owner reviewed [R1–R26 and open proof](025-release-readiness-review.md) and answered “Go: release with quiet-host proof open”. [Approved exception](../../decision-logs/2026-11-04-2116-release-0-2-3-with-quiet-host-proof-open.md). Plan 025 Tasks 8 and 11 remain open.

Tag `v0.2.3` points to `f9458d8b8e17e9a6516eb07e4cd6077bb9965714`. The version and dated changelog were committed after the local checklist passed. The tag was pushed using this authorization; the main branch was not pushed.

## Local release gates

| Gate | Result |
| --- | --- |
| `timeout 900s bun run check` | 1,063 pass, four skip, zero fail; 120 files, 392.22 s of tests. Build, generated files, types, warnings-as-errors lint and format pass. Pre-run load 5.37; no quiet-host claim. |
| `timeout 900s bun run release:gate` | All 14 steps pass, 6.5 s. |
| `timeout 900s bun scripts/release/peer-floors.ts` | React 19.0.0: 117 pass; Playwright 1.49.0: 23 pass; MCP server 2.0.0: 78 pass. Zero failures. |
| `timeout 600s bun run demo:test` | 53 pass, zero fail. |
| Focused docs/API checks after preparation | 11 pass, zero fail; register remains `[]`. |

Local-only raw logs are under `/evidence/025-task-10/`. Regenerate with the commands above and `docs/compatibility.md`'s release checklist.

## Protected publish workflow

[Publish run 41858182585](https://github.com/ashiqrniloy/liveframe/actions/runs/41858182585) runs from the tag above in the `release` environment. Before the push, the API confirmed required reviewer `ashiqrniloy`, self-review allowed, and deployment policy `tag: v*`. After the job waited for review, the agent submitted approval using the authenticated reviewer and the owner's explicit go. GitHub accepted deployment `7550213717`. No protection rule was bypassed or weakened.

CI full check passes (1,063 pass, four skip, zero fail, 463.92 s), as do production/bundled audits, the 14-step archive gate (5.8 s), peer floors (117 / 23 / 78 tests) and demo (53 tests). npm accepted publication at `2026-11-04T15:42:19Z` under `latest` with provenance. The workflow subsequently failed only on `next` promotion: npm returned E403, “This trusted publisher cannot manage dist-tags. Ask a package maintainer to enable Allow npm dist-tag.” Publication succeeded and must not be retried. Owner repair was requested; next-tag verification is pending.

## SBOM

[SBOM artifact 13339850106](https://github.com/ashiqrniloy/liveframe/actions/runs/41858182585/artifacts/13339850106), archive digest `sha256:cbc91914c4baf2443bdc69ee2911d17cd836cef0dba9fc1ff3fdbd583c001272`.

Downloaded with `gh run download 41858182585 --name sbom --dir evidence/025-task-10/ci-sbom`. Asserted CycloneDX 1.6, package version `0.2.3`, and eight components: acorn 8.19.0 and seven bundled packages (sucrase, lines-and-columns, ts-interface-checker and four `@jridgewell` mapping packages). The downloaded copy stays local-only; the CI artifact is the durable record.

## Registry verification

Verified from the registry after propagation:

| Check | Result |
| --- | --- |
| Registry tags | `latest: 0.2.3`, `next: 0.2.3-rc.1` initially; maintainer repair pending. |
| `bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.3 --keep` | All 14 steps pass in 5.6 s; installed outside the checkout. |
| Installed API against `scripts/release/api/0.2.2.json` | `register-0.2.3.json: []`, comparison failures `[]`. |
| `npm audit signatures --json --include-attestations` | Exit 0; `invalid: []`, `missing: []`; verified package 0.2.3 and attestation bundles. |

Signature verification used an isolated exact-version project under `/evidence/025-task-10/signatures/`: `bun install`, `bunx --bun npm@12.2.1 install --package-lock-only --ignore-scripts`, then `bunx --bun npm@12.2.1 audit signatures --json --include-attestations`, as for the RC. All tool execution uses Bun.

Verified SLSA v1 provenance names `.github/workflows/publish.yml`, `refs/tags/v0.2.3`, source commit `f9458d8b8e17e9a6516eb07e4cd6077bb9965714`, GitHub hosted runners and run `41858182585/attempts/1`. Its SHA-512 subject digest matches registry integrity; transparency entry [3691156894](https://search.sigstore.dev/?logIndex=3691156894).

- Tarball: `https://registry.npmjs.org/@arnilo/liveframe/-/liveframe-0.2.3.tgz`.
- SHA-1: `b081f794492364224c4d0c0684c0ab745d6410c0`.
- Integrity: `sha512-oHWj1Ga7X1evbrOJkfwb2Ib1YDAj+xw1Ztlz2ZtaxjU4MbBSjrhzDCTv6FoIPvGNeASSd2VHD1RLh409r4zmZg==`.

Regenerate the installed API snapshot with `bun scripts/release/api-surface.ts <installedPackageRoot> --out <surface.json>`, then compare with `compareApiSurface` from that module, the 0.2.2 baseline and empty 0.2.3 register. Raw registry, signature, comparison and provenance JSON stays local-only under `/evidence/025-task-10/`.
