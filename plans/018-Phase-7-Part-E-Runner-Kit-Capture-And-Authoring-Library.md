# Phase 7 Part E: Runner Kit, Pluggable Capture and Authoring as a Library

Depends on: [plan 017](017-Phase-7-Part-D-Renderer-And-Preview-Host-Integration.md) complete. `<Preview>`'s `urlKey` (CL-01) changes how capture addresses a page. Plan 014 Task 7's `outcomeScenarios` is used by `/authoring`.

## Objectives

- Export `generate()` and `capture()` as functions (LF-02), so a host's build service or agent host can call them without the CLI or stdio MCP.
- Make capture pluggable: a `CaptureBackend` interface, with Playwright/Chromium as the default and only shipped backend, and a specified accessibility-snapshot format (CL-05).
- Ship authoring as a library: `/authoring`'s `createAuthoring()` returns the seven MCP operations as typed functions, and `liveframe mcp` becomes a thin adapter (LF-15).
- Ship the in-sandbox half of a runner (LF-13):
  - `renderModule()`;
  - a pure `linkPackage()` with a documented linker contract;
  - a self-contained single-file ESM bundle that runs in a non-Bun isolate in CI;
  - the reference runners rebuilt on the kit.
- Bound or report the in-process runner's module memory (the backlog item Clay raises).

## Expected Outcome

- `import { generate } from "@arnilo/liveframe/sdk/gen"` and `import { capture } from "@arnilo/liveframe/preview/capture"` work. Neither import loads Playwright.
- A fake-page backend passes every capture test: axis narrowing, the cell bound, `data-lf-ready`, sanitised names and `index.json`. The MCP tests run with an injected backend.
- `createAuthoring({ catalog, capabilities, runner, preview?, capture? })` returns typed operations with the MCP tools' inputs, outputs, bounds and errors. `/authoring` does not load the MCP SDK, and `liveframe mcp`'s existing tests pass unchanged.
- `/runner-kit` exports `renderModule` and `linkPackage`. `dist/runner-kit.bundle.js` has no dynamic `import()`, no `import.meta` and no relative imports, and renders a proof widget under Node's `vm` with no Bun globals.
- `inProcessRunner()` reports (or bounds) its loaded-module count per the decision.

This plan implements spec §7.5 (runners, capture) and §13 (subpaths, host-API rules, CLI). It reopens decision D3 (`decision-logs/2026-10-24-2330-authoring-mcp-server-contract.md`: "no capture subpath") and amends spec §13's subpath table and host-API list. The capture move is a 0.2.0 breaking change named in plan 014 Task 1's log. Neither the kit nor the reference runners is an isolation boundary, and the docs repeat it.

## Tasks

- [x] Task 1: Record the runner, capture and authoring library decisions
  - Acceptance Criteria:
    - Functional: an accepted decision log settles each question, and supersedes D3 explicitly.
      - **LF-02:**
        - `generate` from `/sdk/gen`, which is host-API-free;
        - `capture` from `/preview/capture`, as a host-API-free core that drives a backend and returns `{ index, files: Map<name, Uint8Array> }`;
        - writing files moves to the CLI, or to a small `writeCapture(dir, result)` in a host-API subpath. The log decides which.
      - **CL-05:**
        - the `CaptureBackend` interface: `open(url)`, `waitReady(selector)`, `cells()`, `screenshot(cell)` returning PNG bytes, and `ariaSnapshot(cell)` returning YAML or `null`;
        - the default backend's home. Recommended: `playwrightBackend(playwright)`, which takes the Playwright module the caller imported, so no library subpath does a dynamic `import()` (spec §13). The CLI keeps its lazy import;
        - the snapshot format the backend must return (Playwright's aria-snapshot YAML, pinned to a version range), and `snapshot: null` recorded in `index.json`;
        - `AuthoringConfig.capture?: CaptureBackend`.
      - **LF-15:**
        - `/authoring` exports `createAuthoring({ catalog, capabilities, runner, preview?, capture? })`;
        - `runner` is required, so `/authoring` stays host-API-free and never defaults to `workerRunner()` (Clay's approval concern);
        - the seven operations' names and types;
        - the outcome-scenario expansion from plan 014 Task 7, as an opt-in argument to `renderScenarios`;
        - how `liveframe mcp` maps them onto tools unchanged.
      - **LF-13:**
        - the subpath name (`/runner-kit`);
        - `renderModule(widgetDefault, inputs, { catalog, capabilities, manifest, surfaceId, revision, limits, maxErrors })`, synchronous, with a bounded validator cache;
        - the linker contract: the exact header lines `pack()` emits, and `linkPackage(code, resolve)`;
        - the bundle's build tool (`Bun.build`) and the exact self-containment rules;
        - `renderMany` on `Runner`, or documented guidance only (recommended: guidance; the host still validates each result);
        - the non-Bun isolate used in CI. Recommended: Node's `vm.SourceTextModule`, because Node is already used by the archive gate's Node probe; record Deno as the alternative.
      - **In-process memory:** an observable `stats(): { modules }`, a warning threshold, or a recycle design. Recommended: `stats()` plus `maxModules` refusing new hashes past a bound with `limit-exceeded`, since true unloading needs a fresh realm.
    - Performance: n/a — a decision only.
    - Code Quality: one log, with D3 marked superseded in its own file.
    - Security:
      - Law 1 — the kit runs on the backend or in a sandbox, never in the browser.
      - The log states that the kit is not an isolation boundary, and that `/authoring` grants no store, dispatcher or resolver (law 4).
  - Approach:
    - Skills to Use:
      - `create-decision-log`.
      - `find-docs`: Playwright, Bun and Node APIs.
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64 (`locator.ariaSnapshot()` format stability, `page.screenshot`/`locator.screenshot` returning a `Buffer`).
      - Bun 1.4 `Bun.build` (`format: "esm"`, `splitting: false`, `target`), and removing `import.meta` from bundled code.
      - Node 26 `vm.SourceTextModule` and `--experimental-vm-modules`.
    - Documentation Reviewed:
      - Spec §7.5 and §13.
      - Decision D3.
      - `src/cli/capture.ts:5-146` (`Bun.write` at `:136,141`; Playwright at `:54,73-82`).
      - `src/cli/mcp.ts:283-325` (`createAuthoring` already exists, unexported), `:346-499`.
      - `src/preview/load.ts:11-25` (`import.meta.resolve` plus `data:` URL).
      - `src/preview/in-process.ts:36-85`; `src/preview/worker/*`.
      - `src/sdk/gen.ts`; `src/__tests__/portability.test.ts`.
      - `scripts/release/fixtures/node-probe.mjs`.
    - Options Considered:
      - Keep D3 (capture only through the CLI) — rejected: both adopters forbid MCP or CLI as an internal transport.
      - `/authoring` defaulting to `workerRunner()` — rejected: it would make `/authoring` host-API-bound, and it is the bypass Clay's LF-15 evidence names.
    - Chosen Approach:
      - One log for the four library surfaces.
    - API Notes and Examples:
      ```ts
      const result = await capture(url, { backend: playwrightBackend(playwright), maxCells: 12 }); // { index, files }
      const authoring = createAuthoring({ catalog, capabilities, runner: clayRunner, capture: webdriverBackend });
      const tree = renderModule(widget.default, inputs, { catalog, capabilities, manifest, surfaceId, revision });
      ```
    - Files to Create/Edit:
      - `decision-logs/<date>-runner-kit-capture-and-authoring-library.md` (new)
      - `decision-logs/2026-10-24-2330-authoring-mcp-server-contract.md` (a "superseded by" note on D3 only)
  - Test Cases to Write:
    - None. The decision log is the record.
  - Notes (executed 2026-10-29):
    - Wrote `decision-logs/2026-10-29-1244-runner-kit-capture-and-authoring-library.md` with all four surfaces and the in-process memory bound, and added a D3-only "superseded" note to `decision-logs/2026-10-24-2330-authoring-mcp-server-contract.md`; D1, D2, D4, D5 and D6 stand.
    - LF-02: `/sdk/gen` re-exports `generate()` and `generateDefinitions()`. `/preview/capture` returns `{ index, files: Map<name, Uint8Array> }` and writes nothing; `liveframe preview capture` keeps the only file-writing path, and no `writeCapture` subpath is added in 0.2.0. `CaptureError` keeps its three kinds.
    - CL-05: `CaptureBackend.open(url)` returns a session with `waitReady`, `axes`, `cells`, `screenshot`, `ariaSnapshot` and `close`; `axes` also carries a controlled preview's `shown` scenario. The optional `backend.close?.()` lets `playwrightBackend()` reuse one Chromium instance across scenarios. `playwrightBackend(playwright)` ships from `/preview/capture` with a type-only Playwright import; the CLI keeps its lazy import. The snapshot is Playwright's default `ariaSnapshot()` YAML on the `^1.49.0` peer floor, opaque and unparsed; a missing snapshot is `snapshot: null` with no file. `AuthoringConfig.capture?` is added.
    - LF-15: `createAuthoring({ catalog, capabilities, runner, preview?, capture?, exposeMeta? })`, with `catalog`/`capabilities` already validated and `runner` required. The seven operations return the library's `Result`; `capturePreview` returns PNG bytes and snapshot text, not files. `outcomes: true` expands a scenario only when exactly one of its sources is a `sourceOutcome` envelope; two is a typed `invalid-document`, and expanded scenarios render directly through the runner so session state is untouched. `liveframe mcp` keeps the schemas, content mapping, lazy Playwright and `workerRunner()` default.
    - LF-13: `renderModule` is synchronous and keyed to the canonical manifest JSON in the existing 64-entry LRU shape; `linkPackage(code, resolve)` takes a resolver because one string cannot map the three SDK specifiers, rewrites only canonical header lines and rejects malformed headers with typed errors. The bundle uses `Bun.build` with `format: "esm"`, `splitting: false`, `target: "browser"`, `minify: true`, and CI uses Node 26's `linkRequests()`/`instantiate()` (its `SourceTextModule` has no `link()`), verified on Node v26.11.1. `renderMany` is docs guidance only.
    - In-process memory: `inProcessRunner({ maxModules? })` defaults to 256, counts the loader's process-wide map, and refuses a new hash with `limit-exceeded`; loaded hashes still render.
    - Documentation checked through Context7: Playwright `ariaSnapshot`/`screenshot`, `Bun.build`, and Node `vm.SourceTextModule`; local versions were Bun 1.4.4, Node v26.11.1 and Playwright 1.64.1. No tests were added; the log is the record.

- [ ] Task 2: Export `generate()` (LF-02)
  - Acceptance Criteria:
    - Functional:
      - `@arnilo/liveframe/sdk/gen` exports `generate(catalog): string`, byte-identical to `liveframe gen`'s output. `liveframe gen` calls the exported function.
      - It also exports the implementations mode the CLI already uses (plan 017 Task 7), byte-identical to `liveframe gen --implementations`, with a test for each mode. A host build service can then generate either module without the CLI.
      - The exports test and the archive gate list and import the subpath from the installed package.
    - Performance: n/a.
    - Code Quality: the subpath re-exports `src/sdk/gen.ts`, with no code move.
    - Security: n/a — pure codegen. The portability scan covers the subpath.
  - Approach:
    - Skills to Use:
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `package.json` `exports`; `src/__tests__/exports.test.ts`; `scripts/release/archive-gate.ts`; `scripts/release/fixtures/node-probe.mjs`.
    - Options Considered:
      - Export it from `/sdk` — rejected: it would pull codegen into every widget's import graph.
    - Chosen Approach:
      - A dedicated subpath.
    - API Notes and Examples:
      ```ts
      import { generate } from "@arnilo/liveframe/sdk/gen";
      ```
    - Files to Create/Edit:
      - `package.json`; `src/sdk/gen.ts` (exports only); `src/cli/liveframe.ts`
      - `src/__tests__/exports.test.ts`, `portability.test.ts`; `scripts/release/fixtures/node-probe.mjs`
      - `docs/spec.md` §13; `docs/sdk.md`
  - Test Cases to Write:
    - `sdk_gen_subpath_matches_cli_output` (`sdk-gen.test.ts`), for both the component and definitions mode.
    - `exports_list_sdk_gen`.
    - Node probe imports `/sdk/gen`.

- [ ] Task 3: Make capture a pluggable library function (CL-05, LF-02)
  - Acceptance Criteria:
    - Functional:
      - `/preview/capture` exports `capture(url, { backend, scenarios?, widths?, themes?, designSystems?, maxCells? })` and the `CaptureBackend` type. It returns `{ index, files: Map<name, Uint8Array> }`, writes nothing, and takes no `out`.
      - `playwrightBackend(playwright)` lives where Task 1 decided.
      - A fake-page backend passes the capture tests: axis narrowing and `unknown-name`, the cell bound and `limit-exceeded`, the `data-lf-ready` wait, sanitised unique names, the `urlKey`-prefixed scenario, `index.json`, and `snapshot: null` recorded when the backend has none.
      - The MCP tests run with an injected backend.
      - Importing `/preview/capture` succeeds with Playwright blocked (`no-playwright` preload).
      - `liveframe preview capture` keeps its flags and output, and is rebuilt on the function.
      - `docs/preview.md` states the snapshot format, and that a screenshot is only as faithful as the backend's engine.
    - Performance: no regression in capture wall time on the existing browser test, recorded in the notes.
    - Code Quality:
      - The core does no file I/O and no dynamic `import()`. The portability scan covers it, or the spec's host-API list names it.
      - `CaptureError` kinds are unchanged.
    - Security: law 1 is unchanged, because the backend sees only the app's page. A backend error that is not a `CaptureError` is mapped to `render-failed` by the authoring/MCP adapter, never thrown raw into MCP.
  - Approach:
    - Skills to Use:
      - `safe-refactor`: extract the core from `src/cli/capture.ts` while the existing tests bracket it.
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64 locator screenshot and aria snapshot APIs.
    - Documentation Reviewed:
      - Task 1's log; `src/cli/capture.ts`; `src/cli/mcp.ts:432-499`.
      - `src/__tests__/fixtures/no-playwright.ts`; `proof/tests/preview-browser.test.ts`.
    - Options Considered:
      - See Task 1.
    - Chosen Approach:
      - As decided in Task 1.
    - API Notes and Examples:
      ```ts
      export interface CaptureBackend { open(url: string): Promise<CaptureSession>; close?(): Promise<void> }
      export interface CaptureSession { waitReady(selector: string): Promise<void>; axes(): Promise<CaptureAxes | null>; cells(): Promise<readonly CaptureCell[]>; screenshot(cell: Handle): Promise<Uint8Array>; ariaSnapshot(cell: Handle): Promise<string | null>; close(): Promise<void> }
      ```
    - Files to Create/Edit:
      - `src/preview/capture/index.ts` (new); `src/preview/capture/playwright.ts` (new, exporting `playwrightBackend`)
      - `src/cli/capture.ts` (thin); `src/cli/mcp.ts`; `src/preview/authoring.ts` (`capture?`)
      - `package.json` `exports`
      - `src/__tests__/exports.test.ts`, `portability.test.ts`, `cli-mcp.test.ts` and a new `preview-capture.test.ts`
      - `scripts/release/archive-gate.ts`
      - `docs/spec.md` §7.5/§13; `docs/preview.md`; `docs/mcp.md`; `CHANGELOG.md`
  - Test Cases to Write:
    - `capture_with_fake_backend_covers_contract` (`preview-capture.test.ts`): one case per behaviour.
    - `capture_records_null_snapshot`.
    - `capture_subpath_imports_without_playwright`.
    - `mcp_capture_with_injected_backend` (`cli-mcp.test.ts`).
    - Existing CLI capture tests pass unchanged.

- [ ] Task 4: Ship authoring as a library (LF-15)
  - Acceptance Criteria:
    - Functional:
      - `/authoring` exports `createAuthoring(config)` with seven typed async operations: `listPrimitives`, `listVocabulary`, `listCapabilities`, `generatedTypes`, `packDraft`, `renderScenarios` and `capturePreview`. They have the MCP tools' inputs, outputs, bounds, serialisation and `LiveframeError` shapes.
      - `packDraft`, `renderScenarios` and `capturePreview` keep their one-at-a-time ordering.
      - The preview binding is created lazily and once, and closed by `close()`.
      - `renderScenarios({ outcomes: true })` expands outcome-envelope sources via `outcomeScenarios`.
      - The existing MCP tests pass unchanged against `liveframe mcp`, which is now an adapter. New unit tests call `/authoring` directly. `/authoring` does not load the MCP SDK (`no-mcp-sdk` preload).
      - `docs/mcp.md` gains an "In-process authoring" section.
    - Performance: no regression in MCP test timings.
    - Code Quality:
      - Move `createAuthoring`, `checkAll`, `packArguments`, `renderArguments` and `serialize` from `src/cli/mcp.ts:192-343` into `src/authoring/`. `graft callers createAuthoring --depth all` lists the call sites.
      - `src/cli/mcp.ts` keeps only the SDK wiring.
    - Security: law 4 — no operation installs, places, approves, resolves data or dispatches. Runner choice is the host's (required). The startup warning about permissions moves to the CLI only.
  - Approach:
    - Skills to Use:
      - `safe-refactor`.
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none. The MCP SDK is untouched apart from the adapter.
    - Documentation Reviewed:
      - `src/cli/mcp.ts` (whole); `src/preview/authoring.ts`; `src/__tests__/cli-mcp.test.ts`; `src/__tests__/mcp-guide.test.ts`; `proof/tests/mcp-agent-loop.test.ts`.
    - Options Considered:
      - Export from `/preview` — rejected: it would grow a host-API-free subpath with authoring-only weight. A separate subpath matches LF-15.
    - Chosen Approach:
      - As decided in Task 1.
    - API Notes and Examples:
      ```ts
      import { createAuthoring } from "@arnilo/liveframe/authoring";
      const a = createAuthoring({ catalog, capabilities, runner, preview, capture });
      const packed = await a.packDraft({ files, entry, manifest, scenarios });
      ```
    - Files to Create/Edit:
      - `src/authoring/index.ts` (new) and moved modules; `src/cli/mcp.ts`; `src/preview/authoring.ts`
      - `package.json` `exports`
      - `src/__tests__/authoring.test.ts` (new), `exports.test.ts`, `portability.test.ts`
      - `scripts/release/archive-gate.ts`, node probe
      - `docs/spec.md` §13; `docs/mcp.md`; `README.md` (subpath list)
  - Test Cases to Write:
    - `authoring_operations_match_mcp_tools` (`authoring.test.ts`): same inputs give the same JSON.
    - `authoring_serializes_draft_operations`.
    - `authoring_without_mcp_sdk`.
    - `authoring_expands_outcome_scenarios`.
    - `mcp_adapter_tests_unchanged` (existing `cli-mcp.test.ts`).

- [ ] Task 5: Ship the runner kit and rebuild the reference runners on it (LF-13)
  - Acceptance Criteria:
    - Functional:
      - `/runner-kit` exports `renderModule` and `linkPackage`. `renderModule` is synchronous, compiles and caches the validator (bounded, LRU 64, like the runners), and calls `render()`.
      - `linkPackage(code, resolve)` rewrites exactly the canonical header lines `pack()` emits, and rejects a malformed or non-canonical SDK header with a typed error (code with no SDK imports is accepted unchanged).
      - `docs/packages.md` documents the linker contract (the exact lines).
      - `inProcessRunner` and `workerRunner` are rebuilt on the kit, with identical results on the existing runner tests (`runner-in-process.test.ts`, `runner-worker.test.ts`) and on every proof scenario.
      - Batching guidance (or `renderMany`) is documented per Task 1.
    - Performance: the render bench and runner tests show no regression. The worker host's re-validation cost is unchanged (recorded).
    - Code Quality:
      - `renderPackage` (`src/preview/in-process.ts:54-85`, `@internal`) is replaced by the kit.
      - The `data:` URL loader (`src/preview/load.ts`) uses `linkPackage` for its rewrite. `graft callers renderPackage --depth all` lists the call sites.
    - Security: law 2 — the host still validates every result. The docs repeat that the kit is not an isolation boundary.
  - Approach:
    - Skills to Use:
      - `safe-refactor`: bracket the change with the runner tests.
    - Library Documentation to Check Before Implementation:
      - none beyond Task 1.
    - Documentation Reviewed:
      - `src/preview/in-process.ts`; `src/preview/load.ts:11-25`; `src/preview/worker/*`; `src/preview/cache.ts`; `src/pack/bundle.ts` (header emission).
    - Options Considered:
      - See Task 1.
    - Chosen Approach:
      - As decided in Task 1.
    - API Notes and Examples:
      ```ts
      const linked = linkPackage(pkg.code, (specifier) => `sandbox:${specifier}`); // Result<string>
      ```
    - Files to Create/Edit:
      - `src/runner-kit/index.ts` (new); `src/preview/in-process.ts`; `src/preview/load.ts`; `src/preview/worker/*`; `src/preview/cache.ts`
      - `package.json`
      - `src/__tests__/runner-kit.test.ts` (new), `exports.test.ts`, `portability.test.ts`
      - `docs/spec.md` §7.5/§13; `docs/packages.md`; `docs/security.md`
  - Test Cases to Write:
    - `link_package_rewrites_only_canonical_header`.
    - `link_package_rejects_missing_header`.
    - `render_module_matches_render`.
    - `render_module_caches_validator_bounded`.
    - The existing runner suites, unchanged and passing.

- [ ] Task 6: Publish a self-contained single-file runner bundle and run it outside Bun (LF-13)
  - Acceptance Criteria:
    - Functional:
      - The build emits `dist/runner-kit.bundle.js`: SDK, validator and `renderModule`, ESM, with no dynamic `import()`, no `import.meta`, no relative or bare imports, and no `node:`/`bun:` references.
      - The archive gate checks self-containment by parsing with acorn (already a dependency) and checks that the bundle is packed.
      - A CI test runs the bundle under Node's `vm.SourceTextModule` (per Task 1) with no Bun globals, links a packed proof widget with `linkPackage`, and gets a tree equal to `render()`'s. The test records the runtime and version.
      - `docs/packages.md` documents embedding and snapshotting.
      - The `exports` map names the bundle file.
    - Performance: record the bundle size, gzipped, in the notes. No budget is set.
    - Code Quality: the bundle is built in `scripts/build.ts`, with no second build tool.
    - Security: the bundle includes no host API. `docs/security.md` repeats that it is not an isolation boundary.
  - Approach:
    - Skills to Use:
      - `find-docs`: `Bun.build`, Node `vm`.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4 `Bun.build` (`format`, `target: "browser"` versus `"node"` for host-API-free output, `define`); Node 26 `vm.SourceTextModule` linking.
    - Documentation Reviewed:
      - `scripts/build.ts`; `scripts/release/archive-gate.ts:128-131` (the Node probe pattern).
    - Options Considered:
      - Deno in CI — rejected as the default: it adds a tool. Node is already used by the probe.
    - Chosen Approach:
      - As decided in Task 1.
    - API Notes and Examples:
      ```sh
      node --experimental-vm-modules scripts/release/fixtures/vm-bundle.mjs dist/runner-kit.bundle.js
      ```
    - Files to Create/Edit:
      - `scripts/build.ts`; `package.json` (`exports`, `files` if needed)
      - `scripts/release/archive-gate.ts`; `scripts/release/fixtures/vm-bundle.mjs` (new)
      - `src/__tests__/runner-bundle.test.ts` (new; skips with a message if `node` is absent, mirroring the probe; CI has Node)
      - `.github/workflows/*.yml` (only if Node must be installed explicitly)
      - `docs/spec.md` §13 (ships list); `docs/packages.md`; `docs/security.md`
  - Test Cases to Write:
    - `bundle_is_self_contained` (acorn scan).
    - `bundle_renders_under_node_vm`: tree equality with `render()`.
    - Archive gate step `runner bundle packed and self-contained`.

- [ ] Task 7: Bound or report the in-process runner's module memory (backlog)
  - Acceptance Criteria:
    - Functional:
      - Per Task 1: `inProcessRunner({ maxModules? })` reports `stats().modules`, and past `maxModules` (default 256) refuses a new hash with `limit-exceeded` (an already-loaded hash still renders). The count is the loader's process-wide map.
      - The default is documented, and existing callers keep working.
      - Spec §7.5 and `docs/packages.md` replace "memory grows" with the bound.
      - The backlog entry is closed.
    - Performance: O(1) per render.
    - Code Quality: the count comes from the module map in `src/preview/load.ts:3`. There is no second map.
    - Security: a long-lived host gets bounded growth, and refusing fails closed.
  - Approach:
    - Skills to Use:
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Backlog "Cap or report the in-process runner's module memory"; `src/preview/load.ts`; `src/preview/in-process.ts:36-47`.
    - Options Considered:
      - See Task 1.
    - Chosen Approach:
      - As decided in Task 1.
    - API Notes and Examples:
      ```ts
      const runner = inProcessRunner({ maxModules: 256 }); runner.stats().modules;
      ```
    - Files to Create/Edit:
      - `src/preview/load.ts`; `src/preview/in-process.ts`; `src/preview/runner.ts` (types)
      - `src/__tests__/runner-in-process.test.ts`
      - `docs/spec.md` §7.5; `docs/packages.md`; `plans/backlog.md`
  - Test Cases to Write:
    - `in_process_runner_reports_module_count`.
    - `in_process_runner_refuses_past_max_modules`.

- [ ] Task 8: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/018-impact-analysis.md` records all 12 areas, especially area 8 (Portability) and area 9 (Agent authoring).
      - Findings are presented to the owner and disposed of.
      - Check the backlog item "Cover /preview in the archive gate's Node probe" against the new probe imports, and close it if covered.
    - Performance: record the runner and capture timings.
    - Code Quality: n/a.
    - Security: re-run the portability scan, and confirm the only dynamic `import(` in library subpaths is still the package loader.
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
      - `plans/evidence/018-impact-analysis.md` (new); `plans/backlog.md`; this plan.
  - Test Cases to Write:
    - None.

## Verification (whole plan)
- `bun run check`
- `bun run bench`
- `bun run release:gate`
- `bun run demo:test`

## Compromises Made
- To be filled after tasks are completed and tests pass.

## Further Actions
- To be filled after task completion with improvements, rationale, and priority.
