# 0.2.1 release candidate

`@arnilo/liveframe@0.2.1-rc.1` is on npm under `next`, published by the tag workflow with SLSA provenance. `latest` stays `0.2.0`.

## Rounds

| Tag | Published | Why |
| --- | --- | --- |
| `v0.2.1-rc.1` | yes | Published on the first round. A defect in `scripts/release/peer-floors.ts` was caught before tagging: it omitted `examples` and `conformance` when copying the repo to `/tmp`, causing `pack_dir_matches_inline_hash` to fail in the server peer floor when importing `examples/demo-host/widgets/draft.ts`. Fixed in `peer-floors.ts` before the tag commit. |

## Registry facts

- `npm view @arnilo/liveframe dist-tags` → `{ next: '0.2.1-rc.1', latest: '0.2.0' }`; the version took about two minutes to propagate after the workflow published.
- Published 2026-10-31T18:48:58Z from tag commit `c712dc2163c4abd2fd9f9d7b642d71e56875bf5f`; shasum `bbf0a46fb77c4e9088a4af94b6c3c37153c071df`; integrity `sha512-arY2OWiIm33XMa6y6PBmFrI2+4NRcwn6BPnpNANgDGl3IvA80YUhXTS3WDxejOiG4OXPoDSkSPkHnYfFrZ7BzQ==`. Task 18 compares the final archive against this.
- The workflow repeated `bun run check`, the archive gate (13 steps), the three peer floors (React 19.0.0, Playwright 1.49.0, MCP server 2.0.0) and `demo:test`, then published with `--tag next`. No token is stored (trusted publishing).

## Registry-mode checks

| Check | Command | Result |
| --- | --- | --- |
| Archive gate | `bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.1-rc.1` | passed all 13 steps in 5.9 s |
| Demo host from the registry | demo copied outside the repo, dependency set to `0.2.1-rc.1`, `bun install`, `tsc --noEmit`, `bun test` | typecheck clean; 52 pass, 0 fail across 7 files (32.0 s) |
| Provenance | `npm i @arnilo/liveframe@0.2.1-rc.1` in an empty project, `npm audit signatures --json --include-attestations` | registry signatures verified; attestation `https://slsa.dev/provenance/v1` at `registry.npmjs.org/-/npm/v1/attestations/@arnilo%2fliveframe@0.2.1-rc.1`; sigstore log index 3614671877 |

## Installed-package acceptance rows

Run against that npm-installed copy, with neither `@modelcontextprotocol/server` nor `playwright` installed (optional peers, absent from `node_modules`).

| Row | Result |
| --- | --- |
| Subpath imports (LF-02.2) | `/`, `/sdk`, `/sdk/gen`, `/sdk/jsx-runtime`, `/sdk/jsx-dev-runtime`, `/pack`, `/store`, `/store/fs`, `/preview`, `/preview/worker`, `/preview/capture`, `/authoring`, `/runner-kit`, `/runner-kit.bundle.js`, `/conformance` import under Node. `/react`, `/preview/react` and `/conformance/react` need React, an optional peer not installed in this probe; the gate's consumer-types and demo steps cover them with React present. |
| Validator bundle under bare `vm` (CL-10) | `dist/validator.bundle.js` is self-contained with no imports; executes in bare Node `vm`, compiles validator with sandbox-parsed JSON inputs, validates corpus tree, and runs `checkOffered` successfully. Gate step "validator bundle packed and self-contained". |
| Data `exports` resolution (CL-13) | `./package.json`, `./conformance/corpus/*`, `./conformance/hash/*` and `./conformance/patch/*` resolve through `exports` under Node. Gate steps "corpus packed", "hash vectors packed", "patch vectors packed" and "host-API-free subpaths under node". |
| Package vectors through `/pack` (CL-11) | `canonicalJson` and `packageHash` match all `conformance/hash/packages.json` vectors through public exports. Gate steps "hash vectors packed" and "host-API-free subpaths under node". |
| Tree patches and diff vectors (CL-15) | `diffTrees`, `applyPatch`, `validateTreePatch`, and `conformance/patch/diff.json` verified through public exports and gate step "patch vectors packed". |
| Authoring MCP server tools (M4.2) | Gate step "liveframe mcp over stdio" lists all eight tools from the installed `bin`. |
