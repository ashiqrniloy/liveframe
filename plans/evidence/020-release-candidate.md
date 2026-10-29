# 0.2.0 release candidate

`@arnilo/liveframe@0.2.0-rc.3` is on npm under `next`, published by the tag workflow with provenance. `latest` stays `0.1.0`.

## Rounds

| Tag | Published | Why |
| --- | --- | --- |
| `v0.2.0-rc.1` | no | CI's `demo:test` failed: on a clean checkout under Bun 1.4.2, `bun add --no-save file:…` installed the registry `0.1.0` over the packed archive, so the demo typecheck failed on `IntentOrigin`/`checkOffered`. My local Bun (1.4.4) with an existing `node_modules` did not show it. |
| `v0.2.0-rc.2` | no | The first fix (install the demo's dependencies, then `bun add`) still kept `0.1.0` on Bun 1.4.2. |
| `v0.2.0-rc.3` | yes | `scripts/demo-test.ts` now points the demo's `@arnilo/liveframe` dependency at the tarball for the run (`bun install`, then restores `package.json`). Verified locally under `mise exec bun@1.4.2` from a clean demo directory: 52 pass. |

rc.1 and rc.2 exist as tags on `origin` and never reached the registry. No package change between the three; only `scripts/demo-test.ts`, `package.json`'s version and the CHANGELOG note.

## Registry facts

- `npm view @arnilo/liveframe dist-tags` → `{ next: '0.2.0-rc.3', latest: '0.1.0' }`; the version took about two minutes to appear after the workflow printed `+ @arnilo/liveframe@0.2.0-rc.3`.
- Published 2026-10-29T20:34:34Z from tag commit `dee84eb`; shasum `26fc82d052b05cea8b22bf49b4cd095fdbf834f1`; integrity `sha512-UuaunVLjYk0Yhwf7+Uak7/oK7EO1s/yFWfGiappOEsBe6CRveyX7xvkd7R/C9pKyIP12oVnThg3F5ZXzXPMOPQ==`. Task 10 compares the final archive against this.
- The workflow repeated `bun run check`, the archive gate, the three peer floors and `demo:test`, then published with `--tag next`. No token is stored (trusted publishing).

## Registry-mode checks

| Check | Command | Result |
| --- | --- | --- |
| Archive gate | `bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.0-rc.3` (the plan's `release:gate -- --registry` flag does not exist; the flag is `--package`) | passed all 11 steps in 5.5 s |
| Demo host from the registry | demo copied outside the repo, dependency set to `0.2.0-rc.3`, `bun install`, `tsc --noEmit`, `bun test` | typecheck clean; 52 pass, 0 fail |
| Provenance | `npm i @arnilo/liveframe@0.2.0-rc.3` in an empty project, `npm audit signatures --json --include-attestations` | registry signatures verified; attestation `https://slsa.dev/provenance/v1` at `registry.npmjs.org/-/npm/v1/attestations/@arnilo%2fliveframe@0.2.0-rc.3`; sigstore log index 3575850826 |

## Installed-package acceptance rows

Run against that npm-installed copy, with neither `@modelcontextprotocol/server` nor `playwright` installed (optional peers, absent from `node_modules`).

| Row | Result |
| --- | --- |
| Subpath imports (LF-02.2) | `/`, `/sdk`, `/sdk/gen`, `/sdk/jsx-runtime`, `/sdk/jsx-dev-runtime`, `/pack`, `/store`, `/store/fs`, `/preview`, `/preview/worker`, `/preview/capture`, `/authoring`, `/runner-kit`, `/runner-kit.bundle.js`, `/conformance` import under Node. `/react`, `/preview/react` and `/conformance/react` need React, an optional peer not installed in this probe; the gate's consumer-types and demo steps cover them with React present. |
| `/authoring` without the MCP SDK | imports; also the gate's `liveframe mcp over stdio` step |
| Capture without Playwright (LF-02.4) | `/preview/capture` imports |
| Runner bundle under `vm` (LF-16) | gate step "runner bundle packed and self-contained" and "pack, store, reload and render through both runners" |
| Corpus and hash vectors present (CL-06) | `conformance/corpus` and `conformance/hash` in the installed package; gate steps "corpus packed", "hash vectors packed" |
