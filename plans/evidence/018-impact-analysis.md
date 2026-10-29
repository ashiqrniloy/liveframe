# Plan 018 — architectural impact analysis

Reviewed 2026-10-29 against delivered Tasks 1–7 (`6d1f082`, `bf7208e`, `4dfafff`,
`228aa2d`, `4d12c0a`, `c1541ba`, `0fecfbf`), spec §7.2, §7.5 and §13, the accepted
[runner kit, capture and authoring library decision](../../decision-logs/2026-10-29-1244-runner-kit-capture-and-authoring-library.md)
(which supersedes D3 of the authoring MCP server contract), and all twelve impact areas
in the plan reference §5.

## Impact areas

1. **Spec.** §7.2 (`generate()` and `generateDefinitions()` from `/sdk/gen`), §7.5
   (capture as a backend-driven function, the linker contract, the reference-runner
   caches and the `maxModules` bound) and §13 (the subpath table, the in-process
   authoring paragraph) describe what shipped. Two statements outside the spec were
   wrong: F1 (the decision log) and F2 (the agent skill references).

2. **Public API and formats.** Four new subpaths and one new bundle file, all
   additive, and no format or schema field changed:
   - `/sdk/gen`: `generate`, `generateDefinitions`;
   - `/preview/capture`: `capture`, `CaptureError`, `playwrightBackend` and the backend,
     session, axes, cell and result types;
   - `/authoring`: `createAuthoring` and its operation and result types;
   - `/runner-kit`: `renderModule`, `linkPackage`; `./runner-kit.bundle.js`: the same kit
     with the SDK and validator;
   - `/preview`: `InProcessRunner` (type) and `inProcessRunner({ maxModules? })`.
   `exports.test.ts` pins each surface and `every_export_has_types_and_default` allows
   the bundle as the one bare-file export. The registered 0.2.0 break is the capture
   move: `capture()` left the CLI and no longer writes files (D3 superseded). No runtime
   dependency was added; Playwright stays an optional peer.

3. **The four laws.**
   - Law 1: the kit, bundle and authoring run on the backend or in a sandbox. The
     portability scan and the bundle's acorn scan (no import, `import()`, `import.meta`,
     `node:` or `bun:`) keep them out of the browser path, and `/react` still imports no
     `/sdk`.
   - Law 2: every runner built on the kit goes through `renderWidget`, which validates
     before returning. The host still validates each result (docs repeat it), and
     `maxModules` fails closed with `limit-exceeded`.
   - Law 3: nothing here authors colour or CSS.
   - Law 4: `/authoring` grants no store, dispatcher, resolver or install path; the
     `runner` is required so it cannot default to a bypass, and the startup warning
     stayed in the CLI. `renderScenarios` expansion renders directly through the runner
     and leaves session state untouched.
   - The kit and the reference runners are **not** an isolation boundary; spec §7.5,
     `docs/packages.md` and `docs/security.md` say so.

4. **Validation.** Every new input is validated with a typed error: a malformed or
   duplicate SDK header (`invalid-document` at `/code`), a non-JSON manifest
   (`invalid-document` at `/manifest`), an ambiguous or invalid outcome source, authoring
   arguments (a `LiveframeError[]` at a document-root pointer), a capture axis name
   (`unknown-name`), a cell bound (`limit-exceeded` before any screenshot) and the
   module bound (`limit-exceeded`). Untagged backend errors map to `render-failed` in
   the authoring adapter. One narrower rule than the decision log first promised: an SDK
   import outside the header is not detected (F1).

5. **Styling.** None — no recipe, theme, design system or CSS path changed. The
   `data-lf-ready` wait and the keyed-scenario addressing capture already used are
   unchanged.

6. **Interaction tiers.** None — no tier changed. Capture and authoring observe trees
   and screenshots; they raise no intent.

7. **Performance.** Measured below. The validator gate failed twice at load ≈ 6 and
   the unmodified baseline fails identically (F4); render, CSS, runner and capture
   timings show no regression beyond load noise.

8. **Portability.** `bun run check` re-ran the source and compiled portability scans,
   which pass. The only dynamic `import(` in library subpaths is the package loader:
   `graft`/`grep` over `src/` (excluding the CLI and tests) returns exactly
   `src/preview/load.ts:32`, over `dist/` exactly `dist/preview/load.js`, and
   `portability.test.ts` asserts that for every other file; `dist/runner-kit.bundle.js`
   has none. `/authoring`, `/runner-kit` and `/preview/capture` are scanned as
   host-API-free (`portability.test.ts` lists each with `host: "none"`); `no-mcp-sdk` and `no-playwright`
   preloads prove neither peer is loaded. The archive gate passes all nine steps,
   including the bundle's self-containment and the installed-package Node probe, which
   now also imports `/preview` (F3). The bundle runs under Node's `vm.SourceTextModule`
   in a context with no `Bun`, `process` or `require` (`node v26.11.1`); CI installs
   Node 26 explicitly so that test cannot skip silently.

9. **Agent authoring.** The MCP tool list is still the seven pinned tools; their inputs,
   outputs, bounds and error shapes are byte-identical through `createAuthoring()`
   (`authoring_operations_match_mcp_tools`). Errors an agent can act on:
   missing capture configuration is `not-found` (`docs/mcp.md`); a backend
   failure is `render-failed` with the backend's message; an unknown axis name is
   `unknown-name`; a cell overflow names the bound. The module bound's message says
   "use workerRunner() or raise maxModules". The snapshot is opaque Playwright YAML or
   `null`, and a `null` still returns PNG content. Agent skill references were stale
   (F2).

10. **Docs and examples.** `docs/spec.md`, `docs/sdk.md`, `docs/preview.md` (snapshot
    format, engine-dependent fidelity), `docs/mcp.md` ("In-process authoring"),
    `docs/packages.md` (linker contract, "Build a runner with the kit", "Embed the
    single-file bundle", batching guidance, the `maxModules` bound), `docs/security.md`,
    `README.md` and `CHANGELOG.md` describe the shipped surfaces. The executable
    examples (`preview-guide`, `mcp-guide`) pass in the check run.

11. **Conformance.** The format and renderer suites are unaffected. Nothing in
    `/conformance` covers a host-built runner or a `CaptureBackend`; both are
    host-supplied seams that now exist as public contracts. Recorded under F6 (extends
    the existing P4 runner-suite entry).

12. **Reference hosts.** LF-02, CL-05, LF-15 and LF-13 are delivered with library tests
    and an installed-package probe: a host can call `generate()` and `capture()` as
    functions (Clay, Synapta), inject a non-Playwright backend (Clay's webdriver), build
    `createAuthoring()` over its own required runner (Clay's approval concern), and run the
    bundle in a non-Bun isolate (Synapta's sandbox). The Node `vm` proof is checkout and
    fixture evidence, not production adoption; Deno remains a documented alternative and
    nothing here was bent to either host.

## Findings and disposition (owner-approved 2026-10-29)

| ID | Finding and evidence | Recorded outcome |
| --- | --- | --- |
| F1 | The decision log said `linkPackage` rejects an SDK specifier outside the header. Task 5 deliberately did not build that (detecting one needs a parse, and `loader_leaves_noncanonical_sdk_imports_bare` keeps it bare); the docs and spec already said so. | executed: the log's linker paragraph now states the narrower rule and records the correction |
| F2 | The agent skill references were stale: `architecture.md`'s subpath table lacked `/sdk/gen`, `/preview/capture`, `/authoring` and the bundle; `preview.md` placed `capture()` in `src/cli/capture.ts` and the MCP server over `createPreview()` and `capture()` directly; `sdk.md` called the emitters internal. | executed: all three references now describe the shipped locations |
| F3 | The backlog item "Cover /preview in the archive gate's Node probe" was not covered: the probe imported `/preview/capture` but never `/preview`. | executed: the probe imports `/preview`, renders the packed widget through `inProcessRunner()` under plain Node and calls `createPreview()`; the gate passes all nine steps; the backlog entry is closed |
| F4 | `bun run bench` failed the standalone validator gate at load ≈ 6 (`core-queue.full` 1.570 and 1.540 µs/node against 1.5). The unmodified baseline `05d6b7c` fails it too at load 6.33, and plan 018 touched no validator, format or render code. | executed: recorded on the existing P1 validator entry; thresholds and tests unchanged |
| F5 | Task 6 reported one unidentified failing test in one full check; all later full runs, including this one, were green. | backlog P4: "Identify the intermittent full-check failure seen in plan 018 Task 6" |
| F6 | No conformance suite exists for a host-built runner or a `CaptureBackend`. | backlog P4: the existing "Evaluate a conformance suite for runners" entry now covers the kit and the backend |
| F7 | The snapshot is documented for Playwright `^1.49.0` but only 1.64.1 is exercised. | backlog P4: "Test the capture snapshot format across the Playwright peer range" |

No code defect was found in Tasks 1–7. The runner kit, capture and authoring paths each
had a direct test that fails if the logic breaks, and the equivalent adapter tests
(`cli-mcp.test.ts`) pass unchanged.

## Verification and measurements

Bun 1.4.4, Node v26.11.1, Playwright 1.64.1, Linux 7.3.0-4-cachyos, AMD Ryzen 9 PRO
7940HS (16 logical CPUs). A QEMU virtual machine on the host held the 1-minute load at
6.0–8.9 throughout. Logs are text evidence in [`018-task-8/`](018-task-8/); no images
were produced.

| Run | Load (1 min) | Result |
| --- | --- | --- |
| `bun run check` (`check.log`) | 8.92 → 6.03 | passed: 833 pass, 4 existing skips, 0 fail, 837 tests across 102 files (291.52 s) |
| `bun run release:gate` (`release-gate.log`) | 6.03 | passed, all 9 steps in 6.3 s |
| `bun run release:gate`, after F3 | ≈ 6 | passed, all 9 steps in 5.4 s |
| `bun run demo:test` (`demo-test.log`) | 6.43 | passed: 52 pass, 0 fail (32.43 s), against the packed archive |
| `bun run bench` (`bench.log`) | 6.16 | **failed** the validator gate (`core-queue.full` 1.570 µs/node); the script stopped before render and CSS (`&&`) |
| validator bench, rerun (`bench-validator-rerun.log`) | 6.02 | **failed** again (`core-queue.full` 1.540) |
| validator bench at baseline `05d6b7c` (`bench-validator-baseline-05d6b7c.log`) | 6.33 | **failed** (`core-queue.large`, `core-queue.full` 1.507): not a regression |
| render and CSS benches (`bench-render-css.log`) | 6.09 | passed |

Render (median of 5 batches, load 6.09): agent-home 1.406 ms / 2.071 µs/node;
core-queue small / medium / large / full 2.236 / 2.073 / 2.208 / 2.484 µs/node (0.858 /
0.985 / 1.175 ms for the last three trees); git-status 1.973; rack-module 1.710;
synthetic-queue 1.811. Every workload ≤ 3 µs/node and every required tree ≤ 2 ms. Render's
separate validation diagnostic exceeds 1.5 µs/node on medium, large and full
(1.567 / 1.591 / 1.661), the same non-in-render subtraction recorded under plans 015 and
017. CSS: declarations 0.428 µs/node (0.291 ms per 679-node tree); base 0.501 ms / 1,287 B;
Certified system 9.329 ms / 150,656 B; Rack system 13.022 ms / 162,804 B. Byte sizes equal
plan 017's, so plan 018 changed no CSS output.

Runner (`runner-timing.log`, load 6.28): worker warm overhead 3.384 ms/render (direct
2.018, worker 5.402), against 3.14–3.38 ms before the kit in Task 5's paired runs; the
in-process warm median overhead is 0.0027 ms/render. 26 pass, 0 fail.

Capture (`capture-timing.log`, load 6.28, the eight-cell proof capture, two runs each):
pinned pre-extraction implementation 4878.92 / 4862.10 ms (mean 4870.5), current CLI
5001.83 / 4998.41 ms (mean 5000.1): +2.7 %. Task 3 measured +0.36 % at lower load
(4905.26 against 4922.87 ms). The gap sits inside the run-to-run spread under load 6 and
both implementations keep the same single Chromium launch, so I read it as noise and kept
Task 3's number as the reference; it is recorded here rather than dismissed.

Bundle: `dist/runner-kit.bundle.js` 57,352 bytes, 18,744 gzipped (Task 6).
