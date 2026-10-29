# Phase 7 Part F: Agent Surfaces, the Conformance Corpus and Other Engines

Depends on: [plan 018](018-Phase-7-Part-E-Runner-Kit-Capture-And-Authoring-Library.md) complete. Every format change of plans 014–017 must have landed before the corpus pins the formats (CL-06).

## Objectives

- Let an agent paint a one-off surface from JSON, with the same ids, validation and errors as `render()` (LF-16):
  - `renderElements()`;
  - `ephemeralManifest()`;
  - a per-catalog agent-facing JSON Schema with a drift check.
- Measure revision-per-update streaming on an adopter-sized agent surface, and record whether tree patches are needed (LF-17).
- Ship a language-neutral conformance corpus for every format, plus canonical-hash test vectors, run by the library's own tests (CL-06).
- Run the conformance suites in WebKit and Firefox, and smoke-test registration in another test runner, as Clay's top-priority backlog item asks (WebKit first).

## Expected Outcome

- `renderElements(json, { validator, surfaceId, revision, limits })` returns trees identical to `render()`'s for equivalent TSX in the SDK fixtures. Every validation error kind points into the JSON.
- `liveframe gen --elements-schema` emits a deterministic JSON Schema per catalog, and `--check` catches drift.
- A recorded benchmark and an accepted decision on patches. There is no API change unless the decision approves one.
- `conformance/corpus/` and `conformance/hash/` ship in the archive. CI runs every case through the TypeScript validators, and every format validator's error kinds have a failing case. RFC 8785 Appendix B's number examples are included, and `docs/compatibility.md` makes the corpus part of the format contract.
- The renderer browser suite passes in Chromium, WebKit and Firefox, or each failure is recorded and disposed of. The blocked-peer preload tests are re-proved under any runner they run in.

This plan implements spec §7.2 and §9 (trees, ids), §10 (validation), §13 (published schemas, conformance, the shipped files) and §7.3 (the package hash). Element JSON is a new input format: it gets a JSON Schema and a TS type, tested against each other, like every format. The corpus adds a directory to spec §13's "What the package ships" list.

## Tasks

- [x] Task 1: Record the agent-surface, corpus and engine-verification decisions
  - Acceptance Criteria:
    - Functional: an accepted decision log settles each question.
      - **LF-16:**
        - the element-JSON shape `{ kind, key?, variant?, props, style?, events?, children? }`, with intents in the existing `Intent` shape;
        - the key rules, which mirror the SDK's key-path ids;
        - its bounds (nodes, depth, bytes), which are `render()`'s limits;
        - where `renderElements` lives (`/sdk`, beside `render()`);
        - `ephemeralManifest({ catalogId, actions, state? })`: its fixed id and version convention, and that it is never stored as a package;
        - the generated schema's form, and the CLI flag.
      - **LF-17:**
        - the benchmark subject: a synthetic adopter-sized agent surface (state its node count against spec §7.1's realistic sizes);
        - the update rate;
        - the measurements: bytes before and after gzip, arrival-validation time, and React commit time;
        - the thresholds that would justify patches.
      - **CL-06:**
        - the corpus layout (one directory per format: `catalog`, `theme`, `design-system`, `capabilities`, `manifest`, `ui-tree`, `package`, `placement`, `style-record`, and `elements` from LF-16);
        - the case schema `{ inputs, options, expect }`;
        - errors that match on `kind` and `pointer` only, unordered, with the 20-error bound;
        - how inputs reference sibling files;
        - the `hash/` triple format `{ value, canonical, sha256 }` and how rejected inputs are encoded (lone surrogates, non-finite numbers — JSON cannot carry them, so they need an escape convention);
        - that the corpus is versioned with the formats.
      - **Engines:**
        - Playwright `webkit` and `firefox` projects for the browser suites;
        - which runner smoke-tests registration (Vitest run by Bun, `bunx --bun vitest`, only if it needs no Node-only tooling, per AGENTS.md; otherwise record why not and keep it in the backlog);
        - re-proving the `no-playwright`/`no-mcp-sdk` preloads, as the backlog note requires.
    - Performance: n/a — a decision only.
    - Code Quality: one log.
    - Security:
      - Law 2 — element JSON is untrusted agent output, and is validated in one pass exactly like `render()`'s output.
      - Law 1 — `renderElements` runs on the backend.
  - Approach:
    - Skills to Use:
      - `create-decision-log`.
      - `find-docs`: Playwright, Vitest, RFC 8785.
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64 browser projects and installing WebKit/Firefox on Linux CI.
      - Vitest (current) under Bun.
      - RFC 8785 §3.2.2.3 and Appendix B; ECMAScript `Number.prototype.toString`.
    - Documentation Reviewed:
      - Spec §7.1, §7.2, §9, §10 and §13.
      - `src/sdk/render.ts:51-583`; `src/pack/hash.ts`; `src/conformance/*`.
      - `src/__tests__/conformance-renderer-browser.test.tsx`; `src/__tests__/fixtures/no-playwright.ts`, `no-mcp-sdk.ts`.
      - Backlog "Verify conformance registrations in other runners and browsers" (with the plan 012 F4 note).
    - Options Considered:
      - An agent that emits `UiTree` directly — rejected by LF-16: ids are key paths the SDK derives.
      - Matching corpus errors on `message` — rejected by CL-06: ports phrase messages themselves.
    - Chosen Approach:
      - One log for the three areas.
    - API Notes and Examples:
      ```ts
      const manifest = ephemeralManifest({ catalogId: "acme.ui@1", actions: ["open"] });
      const validator = compileValidator({ catalog, capabilities, manifest });
      renderElements(agentJson, { validator, surfaceId: "chat-42", revision: 3 });
      ```
    - Files to Create/Edit:
      - `decision-logs/<date>-agent-surfaces-corpus-and-engines.md` (new)
  - Test Cases to Write:
    - None. The decision log is the record.
  - Notes (executed 2026-10-29): recorded in `decision-logs/2026-10-29-1552-agent-surfaces-corpus-and-engines.md`. Settled beyond the plan's sketch: `renderElements` takes `unknown` and reports input pointers with the derived `nodeId`; the key rule is "derived sibling segments must be unique" (JSON cannot tell static from dynamic children); `ephemeralManifest` lives in `/sdk` and derives its state schema from the `state` value; `generateElementsSchema` ships from `/sdk/gen` and uses `urn:liveframe:elements:1`; the streaming subject is 679 nodes at 10 revisions/s with a 1 KiB gzip or 8 ms validation+commit patch threshold; corpus cases are exactly `{ inputs, options, expect }` with an unordered `(kind, pointer)` set, and hash vectors use a `$liveframe` tagged escape for non-finite numbers and lone surrogates. Engines: one `LIVEFRAME_BROWSER` parameter (no Playwright Test runner); Vitest stays in the backlog because the two preloads need Bun's `mock.module`, and a Vitest re-proof would need Vite/Node tooling plus a second preload mechanism. Task 2's file list keeps `src/sdk/elements.ts`; Task 6's helper is `src/__tests__/fixtures/browser.ts`.

- [x] Task 2: Render ephemeral surfaces from agent JSON (LF-16)
  - Acceptance Criteria:
    - Functional:
      - `renderElements` builds the tree in one pass, with `render()`'s key-path ids, validation, limits and error kinds. Each error carries a JSON pointer into the input.
      - For every SDK fixture, equivalent element JSON gives an identical tree. A script generates the JSON from the fixtures, so the equivalence is not hand-maintained.
      - `ephemeralManifest` builds a manifest that `validateManifest` accepts, and the browser's arrival check is unchanged.
      - `liveframe gen --elements-schema <catalog> --out <file> [--check]` emits a deterministic JSON Schema, and Ajv validates fixture JSON against it. A TS type `Elements<Catalog>` and the schema are tested against each other.
      - `/authoring` gains no tool (scope): a host wires `renderElements` into its own agent tool. Documented in `docs/sdk.md`.
    - Performance: the 679-node equivalent through `renderElements` stays within the 3 µs/node render budget. This is a new bench case.
    - Code Quality: `renderElements` reuses `render()`'s emitter and validator plumbing in `src/sdk/render.ts`, with no second tree builder.
    - Security: law 2 — validated in the same pass. Law 4 — intents are data and the host re-checks them. Law 3 — style props are checked as in `render()`.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (new SDK surface: typed from the catalog, with a type-level test).
      - `typescript-advanced-types`.
    - Library Documentation to Check Before Implementation:
      - JSON Schema 2020-12 (`$defs`, `oneOf` by kind); Ajv 8.
    - Documentation Reviewed:
      - Task 1's log; `src/sdk/render.ts`; `src/sdk/gen.ts`; `src/formats/manifest.ts`.
    - Options Considered:
      - See Task 1.
    - Chosen Approach:
      - As decided in Task 1.
    - API Notes and Examples:
      ```json
      { "kind": "stack", "props": {}, "children": [{ "kind": "text", "props": { "text": "Done" } }, { "kind": "button", "key": "open", "props": { "label": "Open" }, "events": { "onPress": { "type": "action", "name": "open", "args": {} } } }] }
      ```
    - Files to Create/Edit:
      - `src/sdk/elements.ts` (new); `src/sdk/index.ts`; `src/sdk/gen.ts`; `src/cli/liveframe.ts`
      - `src/formats/manifest.ts` (`ephemeralManifest`, or `src/sdk` per Task 1)
      - `scripts/fixtures/elements.ts` (new); fixture outputs; `package.json` (a `gen:check` entry for the elements schema)
      - `bench/render.bench.ts`
      - `src/__tests__/sdk-elements.test.ts` (new), `exports.test.ts`
      - `docs/spec.md` §7.2/§9/§13; `docs/sdk.md`; `docs/formats.md`
  - Test Cases to Write:
    - `render_elements_matches_render_for_fixtures`.
    - `render_elements_error_pointers_into_json`: one case per kind.
    - `ephemeral_manifest_validates`.
    - `elements_schema_deterministic_and_drift_checked`.
    - `elements_type_and_schema_agree`.
  - Notes (executed 2026-10-29): `renderElements` reuses `render()`'s emitter through a small internal `renderPrepared`; element JSON is converted to internal SDK elements, and each carries its input pointer so emitted errors point into the JSON. Finding: a tree can carry ids from keyed fragments that have no node (the `git-status` fixture does), so element JSON gained one structural kind, `{ "kind": "fragment", key?, children }`. It has no props/style/events/variant, is in the generated schema and `Elements<Catalog>`, and the fixture script rebuilds fragment wrappers from id segments; without it, equivalent JSON could not reproduce the fixture's ids. `ephemeralManifest` lives in `/sdk`, derives its state schema from the initial value, and throws `TypeError` on `null`/non-JSON state. `generateElementsSchema` ships from `/sdk/gen` and the CLI, with `gen:check` and a fixture; the JSON-Schema fragments are rebuilt locally because importing `treeSchema` put the forbidden literal `node:` into the browser bundle. `scripts/fixtures/elements.ts` generates `src/__tests__/fixtures/elements.json` from `renderWorkloads()`. Bench: agent-home elements at 2.47 µs/node (gate 3). Docs updated in spec §7.2/§9/§13, `docs/sdk.md` and `docs/formats.md`. `bun run check`: 839 pass, 4 skip, 0 fail.

- [x] Task 3: Measure tree patches on a streaming agent surface (LF-17)
  - Acceptance Criteria:
    - Functional:
      - `bench/streaming.bench.ts` streams N revisions of the Task 1 subject through `renderElements` → JSON → `<Surface>` arrival validation → React commit. It records the Task 1 measurements.
      - The results go to `plans/evidence/019-streaming-bench.md`, with the machine, the Bun and browser versions, and the regeneration command.
      - An accepted decision log records whether patches are designed. There is no API change in this plan unless that decision approves one; if it does, the work becomes a new task above Task 7 with the owner's approval.
    - Performance: this task is the measurement.
    - Code Quality: the bench reuses the existing bench harness (`bench/*.bench.ts`) and the browser harness for the commit time.
    - Security: n/a — a measurement.
  - Approach:
    - Skills to Use:
      - `investigate-first`: evidence before design.
      - `create-decision-log`.
    - Library Documentation to Check Before Implementation:
      - React 19 Profiler API (`onRender` timings); Bun `gzipSync`.
    - Documentation Reviewed:
      - Spec §9 (patches deferred); `docs/model.md` "Performance"; roadmap §1 "Budgets on realistic sizes".
    - Options Considered:
      - Designing patches first — rejected by spec §9 and roadmap §1: an optimisation is added only when a measurement calls for it.
    - Chosen Approach:
      - Measure, then decide.
    - API Notes and Examples:
      ```sh
      bun --conditions liveframe:source bench/streaming.bench.ts
      ```
    - Files to Create/Edit:
      - `bench/streaming.bench.ts` (new); `plans/evidence/019-streaming-bench.md` (new)
      - `decision-logs/<date>-streaming-tree-patches.md` (new)
      - `package.json` (`bench` script, if it is added there)
  - Test Cases to Write:
    - None. The bench and evidence file are the record.
  - Notes (executed 2026-10-29): `bench/streaming.bench.ts` streams 100 revisions of the 679-node, 50-row agent-home subject at a 10/s target through `renderElements` → whole-tree JSON → `<Surface>` in Chromium, with `bench/streaming-client.tsx` timing arrival validation and the React Profiler. Each revision changes one row's status. Results are in `plans/evidence/019-streaming-bench.md` (machine, Bun 1.4.4, Chromium 156.0.8078.4, regeneration command): median 117,985 JSON bytes, 5,099 gzip bytes, 8–11 changed leaf bytes, 1.4 ms arrival validation, 10.3 ms React commit net of validation, 12.1 ms combined, 9.90 updates/s achieved. Both pre-agreed thresholds are exceeded. `decision-logs/2026-10-29-1737-streaming-tree-patches.md` records that patches are warranted; no patch API lands in this plan. The patch-format task above Task 7 is not added here because plan 019 requires the owner's explicit approval for it.

- [x] Task 4: Ship a language-neutral conformance corpus for every format (CL-06)
  - Acceptance Criteria:
    - Functional:
      - `conformance/corpus/<format>/*.json` holds cases per Task 1 for every listed format. They are generated where possible from the existing failing-case tests, and hand-written where needed.
      - A test runs every case through the TypeScript validators and fails on any mismatch of `ok`, the `(kind, pointer)` set, or the 20-error bound.
      - A coverage check fails unless every `LiveframeError` kind that a format validator can produce has at least one failing case. The kinds are enumerated from `src/errors.ts`, and the kinds no format validator emits are listed explicitly.
      - The archive packs the corpus, and the gate checks it.
      - `docs/conformance.md` documents the case format for ports.
      - `docs/compatibility.md` says a case's expectation changes only with a format version.
    - Performance: the corpus run stays under 2 s in `bun test`.
    - Code Quality: one runner, `src/__tests__/corpus.test.ts`, maps a directory name to a validator. Cases are plain JSON with no TypeScript.
    - Security: law 2 — the corpus pins the fail-closed cases, so a port cannot silently accept them.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none beyond Task 1.
    - Documentation Reviewed:
      - `src/errors.ts`; `src/formats/*` validators; `src/__tests__/validator-rules.test.ts`, `manifest.test.ts`, `theme.test.ts`, `design-system.test.ts` and `package-format.test.ts` (case sources).
    - Options Considered:
      - Generating the corpus at build time — rejected: it must be stable data, reviewed in diffs.
    - Chosen Approach:
      - Committed JSON, checked by the library's own suite.
    - API Notes and Examples:
      ```json
      { "inputs": { "doc": "manifest.json", "catalog": "../catalog/proof.json" }, "options": {}, "expect": { "ok": false, "errors": [{ "kind": "invalid-document", "pointer": "/state/properties/q/pattern" }] } }
      ```
    - Files to Create/Edit:
      - `conformance/corpus/**` (new); `src/__tests__/corpus.test.ts` (new)
      - `package.json` (`files`); `scripts/release/archive-gate.ts`
      - `docs/spec.md` §13 (ships list, conformance); `docs/conformance.md`; `docs/compatibility.md`
  - Test Cases to Write:
    - `corpus_cases_match_validators`.
    - `corpus_covers_every_validator_error_kind`.
    - Archive gate step `corpus packed`.
  - Notes (executed 2026-10-29): `conformance/corpus/` now holds 45 committed cases across all ten formats, with shared documents under `common/` and per-case failing documents under `<format>/docs/`. Cases use only `{ inputs, options, expect }`; `src/__tests__/corpus.test.ts` resolves relative inputs with a corpus-root guard, maps each directory to its reference validator, compares `(kind, pointer)` as an unordered set, and enforces the 20-error bound. The coverage test lists the 15 kinds format validators emit, the 9 kinds they never emit, and checks both against the union parsed from `src/errors.ts`; corpus run time is about 40 ms. Package `files` and the release allowlist include `conformance`, spec §13 lists the shipped corpus and its contract, `docs/conformance.md` documents the case format for ports, and `docs/compatibility.md` says a case expectation changes only with a format version. `scripts/release/archive-gate.ts` gained the `corpus packed` step, which compares every source JSON with the installed package and parses each one; `bun run release:gate` passes all 10 steps.

- [x] Task 5: Ship canonical-hash test vectors (CL-06)
  - Acceptance Criteria:
    - Functional:
      - `conformance/hash/*.json` holds `{ value, canonical, sha256 }` triples. They cover:
        - key ordering by UTF-16 code units, including non-BMP keys;
        - every ECMAScript number-serialisation edge: `1e21`, `1e-7`, `-0`, `5e-324`, `Number.MAX_SAFE_INTEGER + 2` and `0.1 + 0.2`;
        - escapes and non-BMP strings;
        - the rejected inputs (lone surrogates, non-finite numbers), in Task 1's encoding;
        - RFC 8785 Appendix B's number examples.
      - A test runs every vector through `src/pack/hash.ts`'s canonicaliser and hash.
      - The archive packs the vectors.
    - Performance: n/a.
    - Code Quality: vectors are data, and one test file runs them.
    - Security: package integrity (spec §7.3). A drifting port fails these vectors before it mis-verifies a stored package.
  - Approach:
    - Skills to Use:
      - `find-docs` (RFC 8785).
    - Library Documentation to Check Before Implementation:
      - RFC 8785 Appendix B; ECMA-262 `Number::toString`.
    - Documentation Reviewed:
      - `src/pack/hash.ts`; `src/__tests__/pack-hash.test.ts`.
    - Options Considered:
      - Reusing `pack-hash.test.ts` cases only — rejected: they are not language-neutral data.
    - Chosen Approach:
      - Committed vectors.
    - API Notes and Examples:
      ```json
      { "value": { "b": 1, "a": [1e21, -0] }, "canonical": "{\"a\":[1e+21,0],\"b\":1}", "sha256": "…" }
      ```
    - Files to Create/Edit:
      - `conformance/hash/**` (new); `src/__tests__/hash-vectors.test.ts` (new)
      - `package.json` (`files`); `scripts/release/archive-gate.ts`
      - `docs/packages.md`; `docs/conformance.md`
  - Test Cases to Write:
    - `hash_vectors_match`.
    - `hash_vectors_include_rfc8785_appendix_b`.
    - `rejected_inputs_rejected`.
  - Notes (executed 2026-10-29): `conformance/hash/` now holds 45 vectors: RFC 8785 Appendix B's 24 finite rows, 6 explicit number edges, 4 escape/non-BMP string cases, 3 UTF-16 key-ordering cases and 8 rejected inputs. Rejected values use the decision log's `$liveframe` tagged escape for lone surrogates and non-finite numbers; `-0` is written literally so it survives JSON parsing. `src/__tests__/hash-vectors.test.ts` decodes the tags, compares `canonicalJson` byte-for-byte, hashes the UTF-8 text and checks every rejected value throws `TypeError`; the Appendix B test pins all 24 canonical rows and the parsed `-0`. `docs/packages.md`, `docs/conformance.md`, `docs/compatibility.md` and spec §13 describe the vectors. The archive gate's corpus check became a shared conformance check and gained a `hash vectors packed` step; `bun run release:gate` passes all 11 steps.

- [ ] Task 6: Verify the conformance suites in WebKit, Firefox and another runner (backlog)
  - Acceptance Criteria:
    - Functional:
      - `rendererBrowserSuite` and the library's browser tests run under Playwright WebKit and Firefox, in CI and locally on Linux. That covers the platform floor: `@starting-style`, `:user-invalid`, `font-size-adjust`, container queries, `:popover-open` and `backdrop-filter`.
      - **Added by plan 016 Task 7 (F3), the styling features plan 016 shipped.** The browser run also proves, in each engine, the computed style that plan 016 Task 5 could prove only in Chromium: `scrollbar-color` (the thumb/track pair, `auto` under forced colours) and `::placeholder` colour with `opacity: 1`, plus `color-mix(in oklab, …, transparent)` for a `{ role, alpha }` colour, `transparent` for `none`, and the reduced-transparency recovery. `plans/evidence/019-engines.md` records the Playwright WebKit version. Spec §6.4 states that Safari before 26.2 and WebKitGTK before 2.52.3 lack `scrollbar-color` and keep native scrollbars: a Playwright WebKit older than that is an expected, recorded limitation, not a library defect, and the test asserts native scrollbars there rather than skipping.
      - Each failure is fixed if it is a library defect, or recorded as an engine limitation in `docs/styling.md`/`docs/conformance.md` with the owner's approval.
      - Registration is smoke-tested in the Task 1 runner, or Task 1's recorded reason keeps it in the backlog.
      - The `no-playwright` and `no-mcp-sdk` preload tests are shown to fail without their preloads under every runner used.
      - `plans/evidence/019-engines.md` records the engine versions and results.
      - The backlog entry is closed, or narrowed to what remains.
    - Performance: record the suite times per engine. No budget is set.
    - Code Quality: one Playwright browser parameter, threaded through the existing browser-test helpers, with no copied suites.
    - Security: n/a — verification only.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
      - `investigate-first`: per-engine failures.
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64 `webkit.launch`, `firefox.launch`, and Linux dependencies (`playwright install --with-deps webkit firefox`).
    - Documentation Reviewed:
      - Task 1's log; `src/__tests__/*-browser.test.ts*`; `proof/tests/*-browser.test.ts*`; `.github/workflows/ci.yml`.
    - Options Considered:
      - WebKitGTK through WebDriver (Clay's real engine) — rejected for the library CI: Playwright's WebKit build is the nearest portable engine. Clay verifies its own webview through CL-05's backend. This is recorded in the evidence.
    - Chosen Approach:
      - Playwright's engines.
    - API Notes and Examples:
      ```sh
      LIVEFRAME_BROWSER=webkit bun test --conditions liveframe:source src/__tests__/conformance-renderer-browser.test.tsx
      ```
    - Files to Create/Edit:
      - The browser-test helper (tentative: `src/__tests__/fixtures/browser.ts`); `.github/workflows/ci.yml`
      - `plans/evidence/019-engines.md` (new); `docs/conformance.md`; `docs/styling.md` (limitations); `plans/backlog.md`
  - Test Cases to Write:
    - The existing browser suites, parameterised by engine.
    - `preloads_are_effective` (re-proof): the preload tests fail without their preloads.

- [ ] Task 7: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/019-impact-analysis.md` records all 12 areas, especially area 11 (Conformance) and area 9 (Agent authoring).
      - Findings are presented to the owner and disposed of.
    - Performance: record the bench results, including `renderElements`.
    - Code Quality: n/a.
    - Security: confirm element JSON never bypasses the one-pass validator.
  - Approach:
    - Skills to Use:
      - `create-plan`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Reference §5.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - The standard sweep.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/019-impact-analysis.md` (new); `plans/backlog.md`; this plan.
  - Test Cases to Write:
    - None.

## Verification (whole plan)
- `bun run check`
- `bun run bench`
- `bun --conditions liveframe:source bench/streaming.bench.ts`
- `LIVEFRAME_BROWSER=webkit bun run test` and `LIVEFRAME_BROWSER=firefox bun run test` (browser suites)
- `bun run release:gate`

## Compromises Made
- To be filled after tasks are completed and tests pass.

## Further Actions
- To be filled after task completion with improvements, rationale, and priority.
