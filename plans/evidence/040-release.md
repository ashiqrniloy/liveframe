# Release 0.4.0

Tag `v0.4.0` points to `339f0239f16c458e2516360a2b62f2069169909d`. The [readiness review](040-release-readiness-review.md) records the owner's release go and the benchmark deferral.

## Tagged commit verification

| Gate | Result |
| --- | --- |
| `bun scripts/release/versions.ts --tag v0.4.0` | Four packages at `0.4.0` with stable companion peers `~0.4.0`. |
| `bun run check` | Build, generation, types, lint, format and tests passed. 2,129 passed, six skipped and zero failed. The candidate API baselines matched the stable checkout and required no regeneration. |
| `bun run release:gate` | All four local archives passed, with 15 core steps and two per companion. |
| `bun scripts/release/peer-floors.ts` | React and React DOM 19.0.0 passed 163 tests, Playwright 1.49.0 passed 23 and MCP server 2.0.0 passed 89. |
| `bun run demo:test` | 78 passed and zero failed. |

GitHub [Publish run 44954949161](https://github.com/ashiqrniloy/liveframe/actions/runs/44954949161) succeeded on the stable tag after approval of the protected `release` environment. The workflow published all four packages through npm trusted publishing and moved each `next` tag. [CI run 44954949057](https://github.com/ashiqrniloy/liveframe/actions/runs/44954949057) ran on the same commit on main. Chromium passed, then WebKit failed in `overlay_content_receives_pointer_events` while waiting for the overlay button to become actionable. The Firefox and later steps in that CI run were skipped. The protected publish job passed its own Chromium check, archive gate, peer floors and demo. See [Task 9 finding F6](040-impact-analysis.md#findings-and-dispositions) for the isolated WebKit reruns and backlog disposition.

## Registry verification

npm initially returned HTTP 404 while processing the release. Fresh public registry metadata and tarball checks then resolved all four stable versions.

| Package | `latest` and `next` | Registry tarball SHA-1 |
| --- | --- | --- |
| `@arnilo/liveframe` | `0.4.0` | `ca8c385641cea9172f7334462a9a614943d821b9` |
| `@arnilo/liveframe-a2ui` | `0.4.0` | `6ecc02c7baf5d6d6a0020a1a9077a8334614f28c` |
| `@arnilo/liveframe-runner-quickjs` | `0.4.0` | `fd4b055cdff8cfb29981163844235dcb831b98cb` |
| `@arnilo/liveframe-starter` | `0.4.0` | `2636eaee0c508bda6ec11128e388e77dab3c333b` |

| Check | Result |
| --- | --- |
| `bun scripts/release/archive-gate.ts --dir <dir> --package <name>@0.4.0` | Core passed 15 steps in 4.1 s. A2UI, QuickJS and starter each passed two steps in 0.1 s, 2.2 s and 0.5 s, respectively. Each ran from an independent install. |
| Fresh consumer `bun install --no-cache --ignore-scripts` and `readApiSurface` / `compareApiSurface` | All four installed manifests reported `0.4.0`, with zero API differences from the four release baselines. |
| `bun scripts/getting-started-test.ts --registry` | Passed in 2.5 s. |
| `bun scripts/demo-test.ts --registry` | 78 passed and zero failed in 38.98 s. |
| npm lockfile-only install and `npm audit signatures --json --include-attestations` using a fresh signature cache | No invalid or missing signatures. The audit verified provenance for each of the four exact versions. |
| Registry attestation payloads | Each version has two bundles. Each SLSA provenance statement identifies `https://github.com/ashiqrniloy/liveframe`, `.github/workflows/publish.yml` and `refs/tags/v0.4.0`. |
