# Release readiness review for 0.2.1

Prepared 2026-11-01 against `d78a151` (plan 021 Task 17), reviewing the registry-installed `0.2.1-rc.1` evidence, checkout test coverage, peer floors, bench gates, and MCP authoring additions. Task 18 owns the final version, release tag, publication, registry verification, and handoff to Clay.

All readiness items are **go**. The published release candidate `0.2.1-rc.1` is verified from npm, no shipping source or documentation has changed since that candidate was published, and all gates pass.

## Evidence key

All paths below are relative to the repository root unless linked otherwise.

- **P21**: [plan 021](../021-Phase-7-Part-H-Release-0-2-1.md), Tasks 1–17 execution notes, including recorded decisions and diagnostic records.
- **Requests**: [021-request-acceptance.md](021-request-acceptance.md), 120-test passing run, WebKit switching log, and release gate.
- **RC**: [021-release-candidate.md](021-release-candidate.md), registry publication, archive gate (13 steps), demo host outside repo (52 tests), provenance attestation, and installed-package acceptance rows.
- **Switching**: [021-webkit-switching.md](021-webkit-switching.md) (Task 13 diagnosis), [021-task-13-remedies.md](021-task-13-remedies.md) (Task 13.1–13.6 implementation), [021-task-14-switching.md](021-task-14-switching.md) (Task 14 assertion).
- **Patches**: [021-streaming-patches.md](021-streaming-patches.md) (Task 12 streaming benchmark with tree patches).
- **MCP**: [decision-logs/2026-10-31-2057-authoring-mcp-server-0-2-1-surface.md](../../decision-logs/2026-10-31-2057-authoring-mcp-server-0-2-1-surface.md) (M1–M9 design approval) and Tasks 14.2–14.10 records.
- **Backlog**: [plans/backlog.md](../backlog.md).

---

## Tasks 1–17

| Task | Title | Status and evidence |
| --- | --- | --- |
| Task 1 | Record 0.2.1 scope and patch-content decision | fixed — `decision-logs/2026-10-30-1914-release-0-2-1-scope-and-patch-content.md` records owner's verbatim answers. `docs/compatibility.md` updated. |
| Task 2 | Design tree-patch format (CL-15) | fixed — `decision-logs/2026-10-30-2212-tree-patch-format-and-operations.md` approved by owner. |
| Task 3 | JSON-only clone in `checkOffered` (CL-10) | fixed — `complete.ts` replaces `structuredClone` with `jsonClone`; tested under bare `vm`. |
| Task 4 | Runtime matrix and CI global scan (CL-10) | fixed — `docs/spec.md` §13 matrix updated; `portability.test.ts` scans all globals and disallows unlisted identifiers. |
| Task 5 | Self-contained validator bundle (CL-10) | fixed — `dist/validator.bundle.js` packed with no imports/host references; runs under bare Node `vm`. |
| Task 6 | Foreign realm error in runner bundle (CL-12) | fixed — `validate_json_names_foreign_realm` reports foreign-realm error when proto differs. |
| Task 7 | Data `exports` resolution (CL-13) | fixed — `package.json`, `conformance/corpus/*`, `conformance/hash/*`, `conformance/patch/*` resolve through exports. |
| Task 8 | Keep `next` at or above `latest` (CL-14) | fixed — `.github/workflows/publish.yml` updates `next` on `latest` release; release checklist in `docs/compatibility.md`. |
| Task 9 | Tree-patch types, schema and `applyPatch` (CL-15) | fixed — `src/tree-patch.ts`, `schemas/tree-patch.schema.json`, `applyPatch` with structural sharing. |
| Task 10 | Deterministic `diffTrees` (CL-15) | fixed — `diffTrees` deterministic output; passes round-trip on all corpus pairs. |
| Task 11 | Tree-patch conformance corpus and vectors (CL-15) | fixed — `conformance/corpus/tree-patch/` cases and `conformance/patch/diff.json` vectors checked. |
| Task 12 | Tree-patch streaming benchmark and React integration (CL-15) | fixed — `bench/streaming.bench.ts --patches` reaches 228 B gzip median and 2.7 ms arrival + commit; React skips unchanged subtrees. |
| Task 13 | Diagnose WebKit switching cost (CL-16) | fixed — [021-webkit-switching.md](021-webkit-switching.md) identifies headless blur, tab styling, and home-queue DOM costs. |
| Task 13.1 | Approve WebKit switching remedies (CL-16) | fixed — `decision-logs/2026-10-31-1554-webkit-switching-remedies.md` approved by owner. |
| Task 13.2 | Defer style and focus in inactive offscreen tabs (CL-16) | fixed — `tab_inactive_styles_deferred` in `src/__tests__/css-scope-browser.test.ts`. |
| Task 13.3 | Introduce `deferOffscreen` primitive (CL-16) | fixed — `deferOffscreen` style prop projects `content-visibility: auto` + `contain-intrinsic-size`. |
| Task 13.4 | Defer offscreen home-queue rows (CL-16) | fixed — `agent_home_rows_defer_offscreen` in `proof/tests/agent-home-browser.test.ts`. |
| Task 13.5 | Clean up headless WebKit blur (CL-16) | fixed — headless WebKit blur test fixture uses targeted layout containment. |
| Task 13.6 | Measure remedies together on WebKit (CL-16) | fixed — [021-task-13-remedies.md](021-task-13-remedies.md) records span A drops to 8–11 ms (CSS) and 11–14 ms (Surface). |
| Task 14 | Assert switching budget at 16.67 ms (CL-16) | fixed — `switch_under_budget_with_blur` and `switch_under_budget_with_blur_through_surface` assert span A ≤ 16.67 ms. |
| Task 14.1 | Decide authoring MCP server's 0.2.1 surface | fixed — `decision-logs/2026-10-31-2057-authoring-mcp-server-0-2-1-surface.md` approved by owner. |
| Task 14.2 | Advertise `outcomes` on `render_scenarios` (M1) | fixed — `tools_list_advertises_outcomes` in `src/__tests__/cli-mcp.test.ts`. |
| Task 14.3 | Typed `LiveframeError` for missing arguments (M2) | fixed — `pack_missing_keys_reports_each` and argument errors are typed. |
| Task 14.4 | Expose generated types modules (M3) | fixed — `generated_types({ module })` serves `types`, `implementations`, `elementsSchema`. |
| Task 14.5 | Add `set_state` tool for offered `setState` events (M4) | fixed — `set_state` tool dispatches offered events, bounds rerender, ignores unoffered/actions. |
| Task 14.6 | Support packing draft directories under `draftRoot` (M5) | fixed — `pack_draft({ dir })` resolves under opt-in `draftRoot` with path containment and bounds. |
| Task 14.7 | Add tool annotations (M6) | fixed — All 8 tools carry title, readOnly, idempotent, openWorld, destructive hints. |
| Task 14.8 | Add `structuredContent` and `outputSchema` (M7) | fixed — All 8 tools return structured output with valid JSON Schema definitions. |
| Task 14.9 | Configurable `maxCaptureCells` (M8) | fixed — Configurable up to 48 cells with typed pre-check errors. |
| Task 14.10 | Capture layout boxes and overflow (M9) | fixed — `capture_preview` with `layout: true` returns structural box metrics and overflow flags. |
| Task 15 | Update documentation and changelog | fixed — `CHANGELOG.md` 0.2.1 section, `docs/adopters-0.2.md`, `README.md`, `docs/compatibility.md`. |
| Task 16 | Prove every request's acceptance criteria against checkout | fixed — [021-request-acceptance.md](021-request-acceptance.md) proves all 120 test items, WebKit switching, and release gate. |
| Task 17 | Publish `0.2.1-rc.1` under `next` and verify from registry | fixed — [021-release-candidate.md](021-release-candidate.md); all 13 archive gate steps pass, demo passes, SLSA attestation verified. |

---

## Clay 0.2.0 review items (CL-10 to CL-16)

| ID | Item | Evidence | Go / No-Go |
| --- | --- | --- | --- |
| CL-10 | JSON-only clone, runtime matrix, validator bundle | `validator.bundle.js` self-contained, bare Node `vm` test passes, runtime matrix matches allowlist, `jsonClone` in `checkOffered`. | **GO** |
| CL-11 | Corpus package cases and hash vectors | `verifyPackage` runs on package cases, `hash-mismatch` and `forbidden-import` fail appropriately, package hash vectors match through `/pack`. | **GO** |
| CL-12 | Foreign-realm error | Node `vm` outer-realm inputs report explicit realm-mismatch error instead of generic type failure. | **GO** |
| CL-13 | Data `exports` resolution | `./package.json`, `./conformance/corpus/*`, `./conformance/hash/*`, `./conformance/patch/*` resolve cleanly under Node. | **GO** |
| CL-14 | `next` at or above `latest` | Verified on `0.2.1-rc.1` (`next=0.2.1-rc.1` > `latest=0.2.0`). Automated dist-tag step in publish workflow ready for `0.2.1` release. | **GO** |
| CL-15 | Tree patches (`diffTrees`, `applyPatch`) | Spec §9, schema, corpus cases, hash vectors, round-trip proof on all corpus tree pairs, LF-17 benchmark: 228 B gzip, 2.7 ms arrival + commit. | **GO** |
| CL-16 | WebKit switching budget | Diagnosed; remedies implemented (`deferOffscreen`, tab containment); span A asserted ≤ 16.67 ms (measured max 11 ms CSS, 14 ms Surface). | **GO** |

---

## Authoring MCP server review items (M1 to M9)

| ID | Item | Evidence | Go / No-Go |
| --- | --- | --- | --- |
| M1 | `render_scenarios` advertises `outcomes` | Advertised in tool schema; outcomes execution matches library. | **GO** |
| M2 | Typed `LiveframeError` for missing arguments | Missing arguments produce structured `LiveframeError[]` at argument pointer. | **GO** |
| M3 | `generated_types` module selection | Returns CLI-equivalent bytes for `types`, `implementations`, `elementsSchema`. | **GO** |
| M4 | `set_state` tool | Applies offered `setState` event only; never dispatches actions; bounds tree. | **GO** |
| M5 | `pack_draft` with `dir` under `draftRoot` | Safe resolution, path containment, symlink checks, hash matches inline packing. | **GO** |
| M6 | Tool annotations | All eight tools declare complete behavior annotations. | **GO** |
| M7 | `structuredContent` and `outputSchema` | All eight tools return structured content; 0.2.0 text results byte-identical. | **GO** |
| M8 | Configurable `maxCaptureCells` | Configurable up to 48 cells; bounds enforced before screenshot calls. | **GO** |
| M9 | Structural capture layout | Returns wrapper box union, nested contents resolution, overflow flags. | **GO** |

---

## Post-0.2.0 documentation corrections

| Item | Document | Evidence | Go / No-Go |
| --- | --- | --- | --- |
| F1 | `docs/spec.md` §13 | `/sdk/gen` row names `generateElementsSchema()` | **GO** |
| F2 | `docs/compatibility.md` | Present-tense 0.2.0 and 0.2.1 versions sections | **GO** |
| F3 | `docs/adopters-0.2.md` | LF-17 row notes tree patches were warranted in 0.2.0 and ship in 0.2.1 | **GO** |
| F4 | `README.md` | Version updated to 0.2.1; table lists `/sdk/gen`, `/pack` and tree-patch exports | **GO** |

---

## Bench, streaming, and CSS gates

| Gate | Budget / Target | Measured | Go / No-Go |
| --- | --- | --- | --- |
| Tree patch gzip | ≤ 1,024 B median | **228 B** | **GO** |
| Tree patch arrival + commit | ≤ 8.0 ms median | **2.7 ms** | **GO** |
| WebKit switching (CSS) | ≤ 16.67 ms span A | **11 ms** max of 10 warm samples | **GO** |
| WebKit switching (Surface) | ≤ 16.67 ms span A | **14 ms** max of 10 warm samples | **GO** |
| Chromium switching | ≤ 16.67 ms span A | **4.7 ms** (CSS), **6.4 ms** (Surface) | **GO** |
| MCP round-trip cost | ≤ +5 ms median | **+1.855 ms** | **GO** |
| MCP layout calculation | ≤ 100 ms per cell | **37.6 ms** median | **GO** |

---

## Peer floors

| Peer suite | Environment | Result | Go / No-Go |
| --- | --- | --- | --- |
| React floor | React 19.0.0, react-dom 19.0.0 | 96 pass, 0 fail (71 s) | **GO** |
| Playwright floor | Playwright 1.49.0 | 18 pass, 0 fail (68 s) | **GO** |
| MCP Server floor | `@modelcontextprotocol/sdk` 1.0.1 | 34 pass, 0 fail (25 s) | **GO** |

---

## Release candidate verification (`0.2.1-rc.1`)

| Check | Command | Result | Go / No-Go |
| --- | --- | --- | --- |
| Registry tag | `npm view @arnilo/liveframe dist-tags` | `{ next: '0.2.1-rc.1', latest: '0.2.0' }` | **GO** |
| Archive gate | `bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.1-rc.1` | All 13 steps passed in 5.9 s | **GO** |
| External demo test | Demo host copied outside repo, installed `0.2.1-rc.1` from npm | Typecheck clean; 52 pass, 0 fail in 32.0 s | **GO** |
| Provenance | `npm audit signatures --json --include-attestations` | SLSA v1 attestation verified; Sigstore log index 3614671877 | **GO** |
| Installed acceptance | Installed archive probed without optional peers | Node subpath imports, data `exports`, package hash vectors, bare `vm` validator bundle, 8 MCP tools all verified | **GO** |

---

## The Four Laws

1. **Widget code never runs in the browser:** `validator.bundle.js` excludes render paths; `pack_draft({ dir })` packs and validates without executing draft code in the browser host.
2. **The UI tree is validated data:** Patches apply to create a full tree that undergoes full arrival validation (`validator.validateTree`) before render.
3. **Widget code never sets colours or raw CSS:** `deferOffscreen` accepts strictly typed design system values (`"auto"` or boolean); raw CSS properties remain impossible.
4. **A widget never holds authority:** `set_state` only accepts offered `setState` events with valid origins; actions are strictly rejected and never dispatched.

---

## Release dispositions

- **Shipped files match RC:** No shipping code, schemas, or docs were modified following the publication of `0.2.1-rc.1`.
- **Finding dispositions:** All findings from Clay's review (CL-10 through CL-16) and the MCP authoring review (M1 through M9) are resolved and verified.
- **Backlog entries ready to close on publish:**
  - "Design tree patches for streaming agent surfaces" -> closed by CL-15.
  - "Ship the post-0.2.0 documentation corrections" -> closed by doc updates in Task 15.
- **Handoff note for Clay:**
  `@arnilo/liveframe@0.2.1` resolves all items from Clay's 0.2.0 review (CL-10 to CL-16). Clay can re-run its release-review scripts against the published archive. Clay can remove its local validator bundle build, remove its custom `structuredClone` shim, replace deep path imports with `/pack`, and adopt `diffTrees`/`applyPatch` for incremental streaming surfaces.

---

## Owner go

- Owner instruction triggering Task 18 review and release:
  > Complete - [ ] Task 18: Review readiness with the owner, then publish 0.2.1 and verify it from @[plans/021-Phase-7-Part-H-Release-0-2-1.md] and update the plan once done
