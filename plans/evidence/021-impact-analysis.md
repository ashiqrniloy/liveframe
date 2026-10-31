# Plan 021 impact analysis

Executed 2026-11-01 against the released `@arnilo/liveframe@0.2.1`, after Tasks 1–18. The sweep assesses the delivered package and documentation against all twelve impact areas. Findings F1–F5 are reviewed and disposed below.

## 1. Spec

`docs/spec.md` describes the shipped 0.2.1 release across all touched sections:
- **Patch format:** Spec §9 incorporates `liveframe/tree-patch/1` as an optional transport mechanism (`diffTrees`, `applyPatch`) alongside whole trees; spec §14 strikes "Tree patches" from non-goals while preserving "A2UI or other wire interop"; spec §13 lists `diffTrees` and `applyPatch` in the root export table and `schemas/tree-patch.1.json` in the JSON Schemas list.
- **Validator bundle:** Spec §13 adds `dist/validator.bundle.js` and export `./validator.bundle.js` as a self-contained bundle with zero dependencies that runs under bare Node `vm` contexts.
- **Runtime matrix:** Spec §13 specifies supported execution environments (Bun ≥ 1.4.2, Node ≥ 22.0.0, evergreen browser engines Chromium, WebKit, Firefox) verified by the archive gate and CI.
- **WebKit switching:** Spec §6.4 and §12 specify the library-owned span-A measurement (synchronous attribute update and layout work) holding the ≤ 16.67 ms frame budget.
- **Package hashing and data exports:** Spec §7.3 specifies deterministic canonical JSON hashing and exports `canonicalJson` and `packageHash` from `/pack`.
- **Authoring MCP server:** Spec §13 documents the eight-tool authoring surface, tool annotations, output schemas with structured content, offered `setState` handling (`set_state`), path containment (`draftRoot`), and structural layout checking.

## 2. Public API and formats

`package.json` is `0.2.1`. The exports, schemas and format definitions are additive and non-breaking:
- **Patch format:** Root export adds `diffTrees` and `applyPatch`; format identifier is `liveframe/tree-patch/1`; schema is published as `schemas/tree-patch.1.json`. New error kind `stale-patch` is classified as additive in `docs/compatibility.md`.
- **Validator bundle:** Root package exports `./validator.bundle.js` pointing to `dist/validator.bundle.js`, self-contained without dependencies or host requirements.
- **Runtime matrix:** Resolvable across Node 22+, Bun 1.4.2+, and standard ESM bundlers. Cross-realm checking in `validateJson` (`checkValue`) detects objects from foreign realms and produces clean `invalid-document` errors (CL-12).
- **Exports additions:**
  - `./package.json` is explicitly exported (CL-13).
  - Conformance data is resolvable through exports: `./conformance/corpus/*`, `./conformance/hash/*`, and `./conformance/patch/*`.
  - `/pack` exports `canonicalJson` and `packageHash`.
  - `/authoring` and `liveframe mcp` support all eight tools with behavior annotations and `outputSchema`.
- **Dist-tags:** `latest` is `0.2.1`; `next` remains temporarily at `0.2.1-rc.1` due to npmjs.com trusted publisher dist-tag toggle permissions (Finding F1).

## 3. The four laws

All four laws remain intact and strictly enforced:
- **Law 1 (widget code never runs in the browser):** `<Surface>` receives UI trees only. The tree-patch format is pure data; `applyPatch` operates on data trees and produces data trees. No widget code reaches the browser.
- **Law 2 (the tree is validated data):** A patched tree produced by `applyPatch` is validated whole with `validator.validateTree` before render. Malformed or stale patches reject closed without mutating base state.
- **Law 3 (no colours or raw CSS from widgets):** Native-part recipe styling, contrast pairs, and theme variables resolve strictly through the catalog's declared vocabulary.
- **Law 4 (a widget never holds authority):**
  - **`set_state` in MCP:** The MCP server's `set_state` tool only fires offered `setState` events on the preview session. Action intents remain strictly rejected with `invalid-argument`, so no action or mutation authority is granted to authoring agents.
  - Placements, permissions, and dispatch remain host-owned.

## 4. Validation

Every new document, input, and boundary is validated with typed errors:
- **Patch format:** `validatePatch` validates against `schemas/tree-patch.1.json`, requiring monotonic revisions (`revision > base`), valid operations (`set`, `insert`, `remove`, `move`), target existence (`not-found`), and matching surface/revision identity (`stale-patch`).
- **Validator bundle:** `dist/validator.bundle.js` executes identical schema validation, tree validation, and `checkOffered` logic under a bare Node `vm` context with no ambient globals.
- **Runtime matrix:** `validateJson` validates object structures across JavaScript realms, reporting realm mismatch as `invalid-document` at the root with clear diagnostic messages.
- **`draftRoot` path checks:** The `pack_draft` tool with `dir` checks that paths are strictly relative, non-empty, and resolve within the configured `draftRoot`. Paths containing `..`, absolute paths, and external symlinks fail closed with `LiveframeError`s.
- **MCP structured output:** Every MCP tool call produces `structuredContent` validated against the tool's registered `outputSchema`.
- **Capture `layout`:** The capture backend validates layout queries and bounds (`maxCaptureCells` up to 48), returning structured bounding box arrays and reporting overflow.

## 5. Styling

- **Theme authority:** Colors and tokens remain host-controlled. Theme inheritance, contrast constraints, and no-color rules are checked at install time.
- **WebKit switching remedies:** The span-A measurement in spec §6.4 and §12 isolates the library's synchronous attribute updates from browser font engine cascading. Agent-home rows use `deferOffscreen` to eliminate off-screen layout work while preserving keyboard focusability. Conformance switching fixtures use primitive CSS instead of inheriting host document styles.

## 6. Interaction tiers

- **Tier 1 (local):** Unchanged; React state remains within components.
- **Tier 2 (`setState`):** Scoped state isolation by `(placementId, scope)` verified. The `set_state` MCP tool enables preview inspection of offered state transitions without dispatch reach.
- **Tier 3 (action):** Action intents remain subject to host `checkOffered` verification, confirmation metadata checks, and explicit dispatch.

## 7. Performance

The released 0.2.1 code was measured across all standard benchmarks:
- **Standalone validator:** 0.893–1.450 µs/node across all fixtures (budget ≤ 1.5 µs/node).
- **SDK render:** 1.741–2.426 µs/node across all fixtures (budget ≤ 3.0 µs/node); agent-home 1.335 ms (budget ≤ 2.0 ms).
- **CSS declarations:** 0.449 µs/node (budget ≤ 1.5 µs/node).
- **Validator bundle:** Bundle validation speed under bare Node `vm` matches the root compiled validator within measurement noise (~1.3 µs/node).
- **Runtime matrix:** Verified across Bun 1.4.4, Node 22+, Playwright Chromium, WebKit, and Firefox.
- **WebKit switching cost:** Headless WebKit on Linux measured max 10 ms (CSS) and 11–13 ms (Surface) at load 3.6–4.4, passing well within the normative ≤ 16.67 ms frame budget.
- **Patch format & streaming (`plans/evidence/021-streaming-patches.md`):**
  - Host `diffTrees`: median 0.549 ms (budget ≤ 1.5 ms).
  - Browser `applyPatch`: median 0.123 ms (budget ≤ 0.5 ms).
  - Streaming updates: median 228 bytes gzip (budget ≤ 1024 bytes) and median 2.300 ms arrival validation + React commit (budget ≤ 8.0 ms).

## 8. Portability

- **Patch format:** `diffTrees` and `applyPatch` are pure algorithms with zero host dependencies, exported from the root `@arnilo/liveframe`.
- **Validator bundle:** `dist/validator.bundle.js` is bundled into a single file with zero runtime dependencies and verified under a bare Node `vm` context without globals.
- **Runtime matrix:** CI and release gates verify operation under Bun (≥ 1.4.2), Node (≥ 22.0.0), and evergreen browsers.
- **Host-API-free core:** `src/__tests__/portability.test.ts` scans all non-host subpaths (`src/`, `src/sdk`, `src/pack`, `src/store`, `src/css`) ensuring no imports of `node:`, `bun:`, DOM globals, or `require`.

## 9. Agent authoring

- **`set_state` (law 4):** Enables an authoring agent to simulate offered `setState` transitions without exposing action dispatch.
- **`draftRoot` path checks:** Guards against path traversal and symlink escapes when reading draft widgets from disk.
- **MCP structured output:** All eight tools expose structured output conforming to registered schemas, improving reliability for agent tool use.
- **Capture `layout`:** Structural bounding box inspection enables agents to detect overflow and layout issues programmatically without fragile pixel diffing.
- **Code generation:** `liveframe gen` emits TypeScript types, implementation templates, and element schemas with zero drift.

## 10. Docs and examples

- `docs/adopters-0.2.md`: Maps Clay review items CL-10 to CL-16 to delivered features and guidance.
- `docs/compatibility.md`: Adds the `## 0.2.1` section detailing additive exports and compatibility guarantees.
- `CHANGELOG.md`: Documents all 0.2.1 additions, fixes, and limitations under release date 2026-11-01.
- Outsider guides for MCP (`docs/mcp.md`), preview (`docs/preview.md`), SDK (`docs/sdk.md`), renderer (`docs/renderer.md`), and styling (`docs/styling.md`) reflect all 0.2.1 APIs.

## 11. Conformance

- **Patch format:** `conformance/corpus/patch/` contains positive and negative patch test fixtures; `conformance/patch/patches.json` contains canonical SHA-256 hash vectors.
- **Validator bundle:** The release gate tests `validator.bundle.js` under Node `vm`.
- **Runtime matrix:** Conformance data files are exported and resolvable through package exports (CL-13).
- **Package integrity:** `conformance/corpus/package/` includes `hash-mismatch` and `forbidden-import` test cases.

## 12. Reference hosts

### What Clay can now remove
- **Custom validator bundle:** Clay can remove its local bundling setup and import `@arnilo/liveframe/validator.bundle.js`.
- **Custom `structuredClone` shim:** Clay can remove its custom shim; `checkOffered` uses JSON-safe cloning.
- **Deep path imports:** Clay can replace imports of `dist/pack/hash.js` with public `/pack` exports `canonicalJson` and `packageHash`.

### What Clay can now adopt
- `diffTrees` and `applyPatch` for incremental streaming agent surfaces (CL-15).
- Clean package-relative exports resolution for conformance fixtures and schemas (CL-13).
- Validated WebKit switching performance within 16.67 ms (CL-16).

### Remaining gaps
- **G29:** Windows forced colors and assistive technology audit remains open in backlog (P2).
- **Production adoption:** Integration into Synapta and Clay production host environments remains app-owned.

## Archive comparison (security criterion)

The unpacked tarballs of `@arnilo/liveframe@0.2.1` and `@arnilo/liveframe@0.2.1-rc.1` were compared across all 357 packaged files (`plans/evidence/021-release.md`):
- All 357 packaged files match byte-for-byte with changes only in `package.json` (`"version": "0.2.1"`) and `CHANGELOG.md` (`2026-11-01`).
- The published package contains no `src/`, test files, or unpublished evidence files.
- Integrity: `sha512-6GqSLPjumVeQ5pX7jXW0r7j2Q2JitjC5+GkE1L7t/D62+zTjG9iHkW11z50B0dGfM/qJFidnv2UNtaUA==`.
- Provenance: SLSA v1 verified with Sigstore log index `3614764641`.

## Findings and Dispositions

| Finding | Description | Recommended Disposition | Action Taken |
| --- | --- | --- | --- |
| **F1** | Trusted publishing dist-tag add 403 on npmjs.com (`next` tag remains at `0.2.1-rc.1`). | `backlog` (P3) | Documented in `plans/backlog.md` and `plans/evidence/021-release.md` for manual maintainer update. |
| **F2** | Biome lint warnings for non-null assertions in `plans/evidence/021-task-14-10-layout.ts`. | `execute` | Cleaned up non-null assertions in checkout; `bun run lint` passes with 0 errors. |
| **F3** | WebKit switching budget closure. | `backlog` closure | Backlog P1 deferral item formally closed; verified ≤ 16.67 ms across all engines. |
| **F4** | Streaming tree patch design & implementation. | `backlog` closure | Backlog item "Design tree patches for streaming agent surfaces" formally closed. |
| **F5** | Post-0.2.0 doc corrections backlog item. | `backlog` closure | Backlog item "Ship the post-0.2.0 documentation corrections" formally closed. |
