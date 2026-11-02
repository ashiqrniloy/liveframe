# 0.2.2 release candidate

`@arnilo/liveframe@0.2.2-rc.1` is on npm under `next`, published by the tag workflow with SLSA provenance. `latest` stays `0.2.1`.

## Rounds

| Tag | Published | Why |
| --- | --- | --- |
| `v0.2.2-rc.1` | yes | Published on the first round from tag commit `e58a5412e87c0ffcc124feef29d06b6df522fa97`. Local pre-tag gates passed clean (`bun run check` 999 pass / 4 skip / 0 fail, `release:gate` 13/13, peer floors React 19.0.0 / Playwright 1.49.0 / MCP server 2.0.0, and `demo:test` 52 pass). |

## Registry facts

- `npm view @arnilo/liveframe dist-tags` → `{ next: '0.2.2-rc.1', latest: '0.2.1' }`; the version propagated within ~2 minutes of publication.
- Published 2026-11-02T20:04:08.476Z (CI publish step finished 19:58:58Z) from tag commit `e58a5412e87c0ffcc124feef29d06b6df522fa97`; shasum `ce50298d9c0d147460da01e5e951e62eed7f0116`; integrity `sha512-tf5IDHC39VFiRo6LclV6q16kAMrgJtJPFMQuNZNhFEOeQruGuqZLYNwq2bvijSENMA4ijx0QzCltauyrGwsDoA==`. Task 16 compares the final archive against this.
- The workflow (run ID `41513280017`) repeated `bun run check`, the archive gate (13 steps), the three peer floors (React 19.0.0, Playwright 1.49.0, MCP server 2.0.0) and `demo:test`, then published with `--tag next`. No token is stored (trusted publishing).

## Registry-mode checks

| Check | Command | Result |
| --- | --- | --- |
| Dist-tags | `npm view @arnilo/liveframe dist-tags` | `{ next: '0.2.2-rc.1', latest: '0.2.1' }` |
| Archive gate | `bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.2-rc.1` | passed all 13 steps in 6.2 s |
| API stability comparison | `readApiSurface` and `compareApiSurface` against unpacked registry tarball | passed: 0 diffs against 0.2.1 baseline and `register-0.2.2.json` (`[]`) |
| Demo host from the registry | demo copied outside the repo, dependency set to `0.2.2-rc.1`, `bun install`, `tsc --noEmit`, `bun test` | typecheck clean; 52 pass, 0 fail across 7 files (34.1 s) |
| Provenance | `npm i @arnilo/liveframe@0.2.2-rc.1` in an empty project, `npm audit signatures --json --include-attestations` | registry signatures verified; attestation `https://slsa.dev/provenance/v1` at `registry.npmjs.org/-/npm/v1/attestations/@arnilo%2fliveframe@0.2.2-rc.1`; Sigstore transparency log index 3648402012 / bundle tlog index 3648497426 |

## Installed-package acceptance rows

Run against that npm-installed copy, with neither `@modelcontextprotocol/server` nor `playwright` installed (optional peers, absent from `node_modules`).

| Row | Result |
| --- | --- |
| Subpath imports (LF-02.2) | `/`, `/sdk`, `/sdk/gen`, `/sdk/jsx-runtime`, `/sdk/jsx-dev-runtime`, `/pack`, `/store`, `/store/fs`, `/preview`, `/preview/worker`, `/preview/capture`, `/authoring`, `/runner-kit`, `/runner-kit.bundle.js`, `/conformance` import under Node. `/react`, `/preview/react` and `/conformance/react` need React, an optional peer not installed in this probe; the gate's consumer-types and demo steps cover them with React present. |
| Validator bundle under bare `vm` (CL-10) | `dist/validator.bundle.js` is self-contained with no imports; executes in bare Node `vm`, exports `compileValidator`, `auditContrast`, `diffTrees`, `applyPatch`, and widened `states` including `pending`, `mixed`, `current`, `readonly`. Gate step "validator bundle packed and self-contained". |
| Data `exports` resolution (CL-13) | `./package.json`, `./conformance/corpus/*`, `./conformance/hash/*` and `./conformance/patch/*` resolve through `exports` under Node. Gate steps "corpus packed", "hash vectors packed", "patch vectors packed" and "host-API-free subpaths under node". |
| Package vectors through `/pack` (CL-11) | `canonicalJson` and `packageHash` match all `conformance/hash/packages.json` vectors through public exports. Gate steps "hash vectors packed" and "host-API-free subpaths under node". |
| Tree patches and diff vectors (CL-15) | `diffTrees`, `applyPatch`, `validateTreePatch`, and `conformance/patch/diff.json` verified through public exports and gate step "patch vectors packed". |
| Authoring MCP server tools (M4.2) | Gate step "liveframe mcp over stdio" lists all eight tools from the installed `bin`. |

## Round 2: `0.2.2-rc.2` (Task 16)

The release readiness review (Task 16) asked for the first-compile cost of `compileValidator` to be brought within 5% of 0.2.1, and found a stale-cache defect on the way ([022-validator-reuse.md](022-validator-reuse.md), follow-up). Both fixes change runtime code, so `0.2.2-rc.1` no longer matched what would ship and a second candidate was published. The owner approved the rc.2 and 0.2.2 pushes in words ("Publish rc.2, then 0.2.2").

| Check | Command | Result |
| --- | --- | --- |
| Pre-tag gates | `bun run check`, `bun run release:gate`, `bun scripts/release/peer-floors.ts`, `bun run demo:test` | check 1000 pass / 4 skip / 0 fail (377 s); release gate 13/13; floors React 19.0.0, Playwright 1.49.0 (23 pass), MCP server 2.0.0 (76 pass); demo 52 pass |
| Publish | tag `v0.2.2-rc.2`, commit `41ca14f`, run `41523611933` | success; `npm publish --tag next` at 21:04:22Z (UTC, 2026-11-02) |
| Dist-tags | `npm view @arnilo/liveframe dist-tags` | `{ latest: '0.2.1', next: '0.2.2-rc.2' }` (visible after ~1.5 min; a check at 24 s returned E404) |
| Archive | `npm view @arnilo/liveframe@0.2.2-rc.2 dist.shasum dist.integrity` | shasum `2fad7ce6e8ad4bbe85f243410cb609f211d25d04`; integrity `sha512-vZo+UH+ZiPrtwjH/ASgqoKZdpTF/0f2kIibRAH2I75/+MUsc4QQMYrlHOqI/5iAln1tj+GdNvDesk9FUZ7YRnQ==` |
| Archive gate | `bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.2-rc.2` | passed all 13 steps in 7.6 s |
| Provenance | `npm i @arnilo/liveframe@0.2.2-rc.2` in an empty project, `npm audit signatures --json --include-attestations` | 0 invalid, 0 missing; `dist.attestations.provenance.predicateType` is `https://slsa.dev/provenance/v1`; the DSSE subject is `pkg:npm/%40arnilo/liveframe@0.2.2-rc.2` built from `refs/tags/v0.2.2-rc.2`, commit `41ca14f5db060933677a7052f942cf6c90b8bab1` |
| API stability | `readApiSurface` + `compareApiSurface` on the unpacked registry tarball, against `scripts/release/api/0.2.1.json` and the real 20-entry `register-0.2.2.json` | `diffs: []` |
| Against rc.1 | `diff -rq --exclude=package.json --exclude=CHANGELOG.md` on the two unpacked tarballs | differs only in `dist/schema.js`, `dist/validate/compile.js`, `dist/validator.bundle.js`, `dist/runner-kit.bundle.js`, which are the files the fixes touch |
| Demo host from the registry | demo copied outside the repo, dependency set to `0.2.2-rc.2`, `bun install`, `tsc --noEmit`, `bun test` | typecheck clean. First `bun test`: 51 pass, **1 fail** (the failing test was not captured; the host's load average was 8.7–11 from unrelated VMs). Six further runs: 52 pass, 0 fail each. The same demo passes 52/52 from the checkout's archive in `demo:test`. |
