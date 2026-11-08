# Phase 7 Part R: Release 0.3.0 — Isolated Runner Package, Runner Conformance and the Starter

Depends on: plans [026](026-Phase-7-Part-M-Release-0-3-0-Scope-Spec-And-Breaking-Changes.md)–[030](030-Phase-7-Part-Q-Release-0-3-0-Host-Pipeline-Evolution-And-Dependencies.md) (the runner must render code packages, template packages and libraries; the starter uses the final 0.3.0 formats). Followed by plan [032](032-Phase-7-Part-S-Release-0-3-0.md) (the release).

## Objectives

- Ship a real isolation boundary as a **separate optional package**, `@arnilo/liveframe-runner-quickjs`, so a host can run hostile widget code without building its own sandbox (W1; owner decision 2026-11-05).
- Prove any runner against the `Runner` contract with a `runnerSuite()` in `/conformance`, including isolation cases a runner opts into (W1).
- Cut the cost of adopting Liveframe (W7b): a separate `@arnilo/liveframe-starter` package with a reference catalog, React implementations, themes and a design system that pass every conformance suite, plus a getting-started guide that is executed in CI.
- Turn the repository into a Bun workspace that builds, gates and publishes three packages in lockstep. Record the Bun-only runtime decision (W7c): no Node runtime support is maintained.

## Expected Outcome

- `decision-logs/2026-11-08-2310-isolated-runner-starter-and-workspace.md` is approved: package names, QuickJS (`quickjs-emscripten-core` + the release-sync wasm variant, pinned 0.32.0) hosted in a killable Bun child process as the isolation engine, the spec §13 "No WebAssembly" rule scoped to the core package, the Bun-only runtime, and lockstep versions.
- `packages/runner-quickjs/` and `packages/starter/` build, pass `bun run check` and their own archive gates; the root package stays `@arnilo/liveframe` with no new runtime dependency.
- `/conformance` exports `runnerSuite()`; `inProcessRunner`, `workerRunner` and `templateRunner` pass its contract cases; `quickjsRunner` passes contract **and** isolation cases.
- `quickjsRunner({ memoryBytes, stackBytes, timeoutMs, reuse })` renders every proof scenario byte-identically to `render()`, terminates infinite loops, memory bombs and uninterruptible native calls (by killing its child process) with `limit-exceeded`, recovers for the next render, and reaches no host global.
- `docs/getting-started.md` takes an outsider from `bun add` to a runtime-installed widget drawn in a browser; `scripts/getting-started-test.ts` runs its code blocks in a fresh directory in CI.

This plan implements roadmap Phase 7's 0.3.0 runner and adoption work: spec §3 (what the library ships), §7.5 (runners), §13 (packages, runtime matrix) and §14 (non-goals: "an isolation sandbox" is no longer a non-goal of the project, only of the core package). Laws: law 1 is unchanged (runners run on the backend); law 2 is strengthened (the runner's output is still re-validated on the host). The starter is not part of the core package, so the core still ships no components (§3). Nothing is published here; plan 032 publishes all three packages.

## Tasks

- [x] Task 1: Decide the isolated runner, the starter and the workspace layout
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/031-runner-options.md` compares, on Bun ≥ 1.4.2 with no Node runtime: `quickjs-emscripten` (WebAssembly interpreter, memory/stack limits, interrupt handler, module loader); a Deno subprocess with `--deny-*` permissions (needs Deno installed); `isolated-vm` (Node-only native addon, ruled out by the Bun-only decision); a Bun subprocess (no permission model); bubblewrap/seccomp (Linux-only). Criteria: isolation strength, limits, portability across Linux/macOS/Windows, cold-start and per-render cost (measured on a spike rendering the agent-home package), dependency weight and licence.
      - The decision log records: QuickJS chosen (expected outcome, to be confirmed by the measurement), package names, lockstep versioning with a peer range `@arnilo/liveframe: ~0.3.0`, spec §13's "No WebAssembly" rule scoped to `@arnilo/liveframe`, and **no Node runtime support**: backend subpaths and both new packages declare `engines.bun >= 1.4.2`; the archive gate's Node probe stays only as a portability check of host-API-free bundles.
      - Owner approval before Task 2. If the measurement shows QuickJS cannot meet the Task 5 budget, the task stops and presents the next option.
    - Performance: the spike's numbers are the evidence for the Task 5 budget.
    - Code Quality: the spike lives in `plans/evidence/031-spike/` and is not shipped.
    - Security: the comparison names what each option does not isolate (side channels, CPU contention, memory of the host process).
  - Approach:
    - Skills to Use: `create-decision-log`; `find-docs` (quickjs-emscripten current release: `newQuickJSWASMModule`/`getQuickJS`, `QuickJSRuntime.setMemoryLimit`, `setMaxStackSize`, `setInterruptHandler` with `shouldInterruptAfterDeadline`, `setModuleLoader`, `QuickJSContext.evalCode(code, filename, { type: "module" })`, `dispose`); `investigate-first` for the spike.
    - Library Documentation to Check Before Implementation: quickjs-emscripten (Context7 `/justjake/quickjs-emscripten`, version recorded); Bun workspaces (`workspaces` in package.json, `bun publish`/npm provenance per package); npm trusted publishing per package.
    - Documentation Reviewed: spec §7.5, §13, §14; `docs/security.md` "What is not protected"; `src/runner-kit/*` and `scripts/runner-kit-bundle.ts` (the self-contained, global-free bundle a sandbox loads); backlog "Evaluate a conformance suite for runners".
    - Options Considered: as listed above; plus shipping the runner inside the core package (rejected by the owner's decision and by §13's dependency rule).
    - Chosen Approach: decided by measurement against the stated criteria.
    - API Notes and Examples:
      ```ts
      import { quickjsRunner } from "@arnilo/liveframe-runner-quickjs";
      const runner = await quickjsRunner({ memoryBytes: 32 << 20, stackBytes: 256 << 10, timeoutMs: 250 });
      ```
    - Files to Create/Edit: `plans/evidence/031-runner-options.md`; `plans/evidence/031-spike/*`; `decision-logs/2026-11-08-2310-isolated-runner-starter-and-workspace.md`
  - Test Cases to Write: n/a — decision; the spike's measurements are recorded.
  - Notes (executed 2026-11-08):
    - Evidence: `plans/evidence/031-runner-options.md` (findings F1–F9, comparison, budget) and the spike in `plans/evidence/031-spike/` (`bash plans/evidence/031-spike/run-all.sh` regenerates `outputs/`). Decision log `2026-11-08-2310-isolated-runner-starter-and-workspace.md`, approved by the owner ("Approve and log (Recommended)"). Machine: Linux 7.3, Bun 1.4.4, quickjs-emscripten 0.32.0 (QuickJS 2025-09-13), Deno 2.9.6, bubblewrap 0.13.1.
    - QuickJS is confirmed as the engine, but **the plan's in-process design was wrong**: native builtins ignore the interrupt handler (one `String.prototype.indexOf` ran >60 s past a 100 ms deadline and a 64 MiB limit), and Bun 1.4.4's `Worker.terminate()` cannot stop a worker in such a call, while `SIGKILL` of a child process takes 5–10 ms. The decision therefore hosts QuickJS in a Bun child process the runner owns and kills. Cost: child cold start 21 ms, agent-home 69–71 ms per fresh render (30 ms of it fixed), 0.3–4 ms for the smallest surface with a kept runtime.
    - The default `stackBytes` of 1 MiB is unsafe on Bun (the host stack overflows inside wasm and `dispose()` then aborts); 256 KiB is safe. A `dispose()` abort also follows an interrupted `executePendingJobs()`; the runner never calls it and drops any wasm instance whose `dispose()` throws.
    - Amended below because of these findings: Objectives (expected outcome), Task 2 (archive gate), Task 3 (isolation cases), Task 4 (architecture, defaults, files, dependencies) and Task 5 (budget table). Not measured, so not claimed: macOS and Windows, `reuse: "package"` through the child, resident memory growth of a long-lived child, `isolated-vm`.
    - Spec changes are owed by later tasks (§13 rule 3 and packages table, §14, §7.5); none made here. The spike's `node_modules/` is gitignored; `bun.lock` is kept so the versions are reproducible.

- [x] Task 2: A Bun workspace that builds, gates and publishes three packages
  - Acceptance Criteria:
    - Functional:
      - Root `package.json` gains `"workspaces": ["packages/*"]`; `packages/runner-quickjs` and `packages/starter` each have `package.json` (`type: module`, `engines.bun`, `exports` with `liveframe:source`, `peerDependencies` on `@arnilo/liveframe` `~0.3.0`), `src/`, `tsconfig.json` and README.
      - `bun run check` runs build, gen check, typecheck, lint, format and tests across the workspace. `release:gate` (archive gate), the API surface baseline (a `0.3.0` baseline per package created at release), the bundled-dependency audit and the SBOM run per package.
      - `.github/workflows/ci.yml` and `publish.yml` build and publish all three from one tag with provenance, the same version, `next` for release candidates and `latest` plus `next` for finals; a version mismatch fails the job. The publish job keeps npm only in the publish step (AGENTS.md exception).
      - The owner configures npm trusted publishing for the two new package names (recorded as an owner action in the task notes; the workflow fails closed without it).
      - Archive gates prove the root package contains no WebAssembly and no starter components. The runner package's gate proves its archive contains the `.wasm` file and the compiled child entry `.js` (like the worker entry, a `sideEffects` file) and that both resolve when installed outside the checkout, as the root gate does for the worker (decision log 2026-11-08-2310).
    - Performance: `bun run check` wall time recorded before and after.
    - Code Quality: one release script parameterised by package directory; no copies.
    - Security: supply chain — every package gets the audit and SBOM steps; tag-only, protected-environment publishing for all three.
    - Compatibility: no change to the root package's API.
  - Approach:
    - Skills to Use: `liveframe-execution`; `find-docs` (Bun workspaces, `bun install` with workspaces, GitHub Actions OIDC trusted publishing for multiple packages).
    - Library Documentation to Check Before Implementation: Bun 1.4 workspaces; npm trusted publishing docs.
    - Documentation Reviewed: `package.json:148-162` (scripts); `scripts/release/*`; `.github/workflows/publish.yml:65-69`; `decision-logs/2026-11-04-2043-release-environment-tag-protection.md`.
    - Options Considered: separate repositories. Rejected: lockstep versions and shared tests are simpler in one repo. Independent versions. Rejected for 0.3.0 by the decision log; revisit only if a package needs its own cadence (spec §13's split rule).
    - Chosen Approach: one Bun workspace, lockstep releases.
    - API Notes and Examples:
      ```json
      { "name": "@arnilo/liveframe-runner-quickjs", "version": "0.3.0", "peerDependencies": { "@arnilo/liveframe": "~0.3.0" } }
      ```
    - Files to Create/Edit: `package.json`; `packages/runner-quickjs/{package.json,tsconfig.json,README.md,src/index.ts}`; `packages/starter/{…}`; `scripts/build.ts`; `scripts/release/*`; `.github/workflows/ci.yml`; `.github/workflows/publish.yml`; `tsconfig.json`; `biome.jsonc`; `docs/compatibility.md` (release checklist)
  - Test Cases to Write:
    - `workspace_packages_share_one_version`; `root_archive_has_no_wasm`; `each_package_archive_matches_exports`; `publish_workflow_fails_on_version_mismatch` (script unit test).
  - Notes (executed 2026-11-08):
    - Done: root `workspaces: ["packages/*"]` and `bunfig.toml` (`linker = "hoisted"`); `packages/runner-quickjs` and `packages/starter` (manifest, `tsconfig.json`, `tsconfig.build.json`, README, placeholder `src/index.ts` that exports nothing, versions equal to the core's 0.2.3 until plan 032 bumps all three). `bun run check` (build, gen, typecheck, lint, format, tests) now covers the workspace: `scripts/build.ts` compiles each package after the root (their types resolve through the root `dist/`; a package `build.ts`, if present, runs after tsc), the root `tsconfig.json` includes `packages/*/src`, and `bun test` takes `packages`.
    - Release scripts take a package directory, with no copies: `scripts/release/packages.ts` (workspace dirs, manifests, per-package archive rules), `publish-manifest.ts` (`stagePackage(destination, dir)`; `workspace:` dev dependencies are dropped from the published manifest, `bun pm pack` fails on them), `sbom.ts --dir`, `archive-gate.ts --dir <package>` / `--all` (`bun run release:gate` runs all three; a non-core package installs the core's packed archive beside its own), and `versions.ts` (`bun run release:versions [--tag v…]`: one version, `~` peer range, tag names the version). `peer-floors.ts` now copies `packages/` and `bunfig.toml` (it failed `--frozen-lockfile` otherwise). `audit-bundled.ts` stays core-only: only the core bundles third-party code, and `bun audit --prod` covers the workspace's runtime closure.
    - Workflows: CI and publish check versions, write one SBOM per package (artifact `sbom` holds three files), run the gate for all three; publish stages, publishes (core first, `npm publish` with provenance, `next` for prereleases) and moves `next` for finals per package. npm still runs only in the publish step. A tag that mismatches any package fails the job before install.
    - Tests (`src/__tests__/workspace.test.ts`): `workspace_packages_share_one_version`, `publish_workflow_fails_on_version_mismatch`, `root_archive_has_no_wasm`, `each_package_archive_matches_exports`, plus `archive_rules_forbid_and_require_files` and `workspace_lists_the_core_then_both_packages`. `bun run check` passes (1684 pass, 4 skip); `bun run release:gate` passes for all three; the react peer floor passes. Wall time of `bun run check`: 401 s, 397 s of it the test run; not re-measured before the change (two empty packages add about a second of tsc), so no regression is claimed beyond that.
    - Finding: Bun 1.4's default isolated linker leaves `bun-types` and the sucrase path (read by `scripts/build.ts`, the SBOM and the typecheck) out of the top-level `node_modules`; `bunfig.toml` pins the hoisted linker, which also keeps `node_modules/@arnilo/*` linked to the workspace packages.
    - Finding for plan 032 Task 5: `~0.3.0` does not match `0.3.0-rc.1`, so npm would refuse (ERESOLVE) to install an rc of a package beside an rc of the core. Before the rc, widen the peer range of both packages to `~0.3.0-0` (`>=0.3.0-0 <0.4.0`); `versionProblems` already accepts any `~` range. Not changed here: the decision log and Task 2 name `~0.3.0`.
    - Owner action (open): configure npm trusted publishing (repository `ashiqrniloy/liveframe`, workflow `publish.yml`, environment `release`, **Allow npm dist-tag**) for `@arnilo/liveframe-runner-quickjs` and `@arnilo/liveframe-starter`; the first publish needs the package names to exist or be claimed. The workflow fails closed without it.
    - Deferred to Task 4 (amended there): the runner's required archive files (its `.wasm` and `dist/child.js`) are not listed in `archiveRules` yet because the files do not exist; adding them now would turn CI red. The mechanism and its unit test exist, and the gate runs a package's optional `archive-smoke.ts` in the install directory, which Task 4 uses to prove the wasm and child entry resolve outside the checkout. The `0.3.0` API baseline per package is created at release (plan 032); `api-surface.ts` already takes any package root.

- [x] Task 3: `runnerSuite()` — conformance for any runner
  - Acceptance Criteria:
    - Functional:
      - `/conformance` exports `runnerSuite({ runner: () => Runner | Promise<Runner>, catalog, capabilities, packages, isolation?: boolean }): ConformanceCase[]`.
      - Contract cases (every runner): each scenario of each supplied package renders a tree deep-equal to `render()`/`renderTemplate()`; a package whose hash does not match is refused with `hash-mismatch` before loading; a widget that loops is `limit-exceeded` within `timeoutMs` + a declared slack and the next render succeeds; a thrown widget is `render-failed`; a non-function default is `render-failed`; libraries (plan 030) load; template packages render or are refused with `invalid-document` as the runner declares; the runner never returns `ok: true` for a tree its validator rejects.
      - Isolation cases (when `isolation: true`): widget code cannot read `fetch`, `process`, `Bun`, `Deno`, `require`, `import.meta`, `globalThis.constructor.constructor("return this")()` host globals; module state set by one render is not visible to a render of another package, nor (with `reuse: "none"`) to the next render of the same package; a memory bomb is `limit-exceeded`; a deep recursion is `limit-exceeded`; a render cannot answer another render; widget code cannot write to the runner's channel (a forged result is ignored or refused); a render held in one uninterruptible native call (for example `'a'.repeat(1e7).indexOf('a'.repeat(5e6) + 'b')`) is `limit-exceeded` within `timeoutMs` plus the declared slack and the next render succeeds (the spike showed a same-thread engine cannot pass this, `plans/evidence/031-runner-options.md` F5–F6).
      - Fixtures ship as language-neutral package documents under `conformance/runner/` (exports pattern added), built from proof widgets and hostile probes.
      - `inProcessRunner`, `workerRunner` and `templateRunner` pass the contract cases in the library's own tests; `docs/conformance.md` gains the runner section.
    - Performance: suite runtime recorded; cases carry timeouts.
    - Code Quality: follows the existing suite pattern (`ConformanceCase`, `ConformanceFailure`, no test-runner import).
    - Security: law 2 — every case validates on the host; isolation claims become testable instead of documented.
    - Compatibility: `added` for `runnerSuite` and the `conformance/runner/*` data export.
  - Approach:
    - Skills to Use: `liveframe-execution` (renderer reference, conformance contracts).
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: spec §13 conformance contracts; `src/conformance/store.ts` (pattern); `src/__tests__/preview-session.test.ts` (`every_proof_scenario_passes_check` seed); backlog entry.
    - Options Considered: isolation as the default for every runner. Rejected: the reference runners are documented non-isolating; the flag makes the claim explicit.
    - Chosen Approach: contract cases always, isolation cases opt-in.
    - API Notes and Examples:
      ```ts
      for (const c of runnerSuite({ runner: () => quickjsRunner(), catalog, capabilities, packages, isolation: true })) test(c.name, c.run, c.timeout);
      ```
    - Files to Create/Edit: `src/conformance/runner.ts`; `src/conformance/index.ts`; `conformance/runner/*`; `package.json` (`exports`); `src/__tests__/conformance-runner.test.ts`; `docs/conformance.md`; `docs/spec.md` §13; `register-0.3.0.json`
  - Test Cases to Write:
    - `reference_runners_pass_contract_cases`; `broken_runner_fails_named_rule` (a deliberately wrong runner fails `runner_returns_render_tree`, `runner_refuses_hash_mismatch`, `runner_bounds_time`); `isolation_cases_fail_for_in_process_runner` (proves the cases bite).
  - Notes (executed 2026-11-08):
    - Done: `runnerSuite({ runner, catalog, capabilities, packages, isolation?, accepts?, timeoutMs?, slackMs? })` in `src/conformance/runner.ts`, the fixtures and probe table in `src/conformance/runner-fixtures.ts`, and the language-neutral `conformance/runner/fixtures.json` (catalog, capabilities, packages, probe table), written and checked by `scripts/runner-fixtures.ts` (`gen:check` runs `--check`; `runner_fixture_document_matches_the_suite` also pins it). `./conformance/runner/*` is an export pattern; the archive gate packs and checks it; `api-surface.ts` hashes `conformance/runner` as an optional `runner` group (a 0.2.3 baseline has none). Register entries added for `runnerSuite`, `RunnerSuiteOptions` and `conformance/runner/fixtures.json`; `docs/migration-0.3.md` has a "Runner conformance" section; `docs/conformance.md` has a "Prove a runner" section and table row; spec §13 documents the cases and the fixture document.
    - Contract cases: `runner_returns_render_tree`, `runner_returns_render_tree_for_supplied_packages` (each scenario against `inProcessRunner`/`templateRunner` as the reference, compared canonically), `runner_refuses_hash_mismatch` (the tampered code is an infinite loop, so a runner that loads before verifying fails), `runner_reports_thrown_widget`, `runner_rejects_non_function_default`, `runner_never_accepts_invalid_tree`, `runner_bounds_time` (a 400 ms busy widget, so the in-process runner can pass it; the next render must succeed), `runner_loads_libraries` (also `not-found` without the library). Isolation cases: `runner_isolation_no_host_globals` (global scope, the `Function` constructor trick and `import.meta`), `…_no_state_between_renders`, `…_infinite_loop`, `…_memory_bomb`, `…_deep_recursion`, `…_native_hold`, `…_channel_is_not_writable`, `…_render_cannot_answer_another`. Timed probes must end within `timeoutMs` + `slackMs` and be followed by a successful render. A runner is built per case and closed afterwards.
    - Passing: `inProcessRunner`, `workerRunner` (both package kinds) and `templateRunner` (`accepts: "template"`, code packages refused with `invalid-document`) pass the contract cases; suite runtime 0.5–0.6 s for in-process and worker, 0.04 s for template. The isolation cases bite: the in-process runner fails the globals and state cases (it cannot be given the loop cases, which would hang it). `quickjsRunner` (Task 4) must pass them all; nothing here ran the loop, memory, recursion, native-hold or forged-channel probes against a real runner yet, so those are proved only by being well-formed packages (they pack and verify) until Task 4.
    - Findings: (1) the packer forbids `import.meta`, `require` and dynamic import, so the `import.meta` probe is a hand-linked, rehashed package (`packages.importMeta`). (2) The packer reserves `__lf_` identifiers, so state probes use `__probe_calls`. (3) The suite needs the reference renderers, so the `conformance` subpath now bundles `/preview` including its one approved dynamic import: the runtime matrix row for `conformance` gains `setTimeout`, `clearTimeout` and `loader: true` (README, spec §13 and `portability.test.ts` updated); the library stays host-API-free. (4) The fixtures are code, not hand-written JSON: pack output is deterministic, so the document is generated; a port in another language reads `fixtures.json`.
    - Not done, and why: the forged-result and cross-render probes post a worker-protocol envelope and common alternatives; a runner with a different channel is covered only by "nothing named FORGED reaches the caller". `timeoutMs` above 200 is refused so the 400 ms busy widget always outlives it. `bun run check`: 1688 pass, 4 skip; `bun run release:gate` passes for all three packages.

- [x] Task 4: `quickjsRunner()` in `@arnilo/liveframe-runner-quickjs`
  - Acceptance Criteria:
    - Functional:
      - `quickjsRunner(options?)` returns `Promise<Runner & { close(): void }>`. The runner owns a Bun child process (`Bun.spawn`, JSON IPC) that holds the QuickJS wasm module; the parent verifies, validates and keeps the deadline, and `SIGKILL`s the child when the hard deadline (`timeoutMs` + 100 ms) passes, then starts a new one for the next render. Per render, inside the child: a QuickJS runtime with `setMemoryLimit(memoryBytes)` (default 32 MiB), `setMaxStackSize(stackBytes)` (default **256 KiB**; 1 MiB overflows the host stack, decision log) and `setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + timeoutMs))` (default `timeoutMs` **250**; a per-render `options.timeoutMs` overrides it); a module loader that serves only `liveframe:kit` (the `runner-kit.bundle.js` text from `@arnilo/liveframe`), the linked package module and its linked libraries; no host function is exposed to the context. `executePendingJobs()` is never called; a wasm instance whose `dispose()` throws is dropped, never reused.
      - The host verifies the package hash (and library pins) before loading, links SDK and library specifiers with `linkPackage` to `liveframe:kit`/`liveframe:lib/…`, passes inputs and render options to the sandbox as one JSON string, receives the result as one JSON string, `JSON.parse`s it on the host and validates the tree with the host's compiled validator (law 2). A malformed result is `render-failed`.
      - `reuse: "none"` (default) gives every render a new runtime (and a new wasm instance, from a shared compiled `WebAssembly.Module`); `reuse: "package"` keeps one runtime per package hash in the child (bounded LRU, `maxRuntimes` default 16) for trusted-but-untested code. Template packages render on the host through `renderTemplateRun` (no author code, no IPC, identical trees); the decision log fixed this.
      - Errors: interrupt or the hard kill → `limit-exceeded` ("timeout"), out-of-memory → `limit-exceeded` ("memory"), stack overflow → `limit-exceeded` ("stack"), classified from QuickJS's `interrupted`, `out of memory` and `stack overflow` messages; a child that exits or aborts → `render-failed`; other exceptions → `render-failed` with a bounded message and no host paths.
      - Passes `runnerSuite` with `isolation: true` in the package's tests.
    - Performance: Task 5 sets and checks the budget.
    - Code Quality: one file per concern (`index.ts` host side, `child.ts` the child entry, `runtime.ts`, `load.ts`); handles always disposed (`using`/`try…finally`), checked by a leak test.
    - Security: no host global or function is reachable from widget code; the trust anchor stays on the host; the package README states what QuickJS does not protect against (CPU side channels, host-process memory pressure up to `memoryBytes` per render, a defect in QuickJS or the wasm runtime) and that the child runs with the host's privileges, so an OS sandbox around it (bubblewrap, a container) is the recommended defence in depth.
    - Compatibility: new package; no root API change.
  - Approach:
    - Skills to Use: `liveframe-execution` (preview reference); `find-docs` (quickjs-emscripten APIs listed in Task 1).
    - Library Documentation to Check Before Implementation: quickjs-emscripten (`quickjs-emscripten-core` and `@jitl/quickjs-wasmfile-release-sync`, each pinned exactly to 0.32.0 in `packages/runner-quickjs/package.json`; not the umbrella package); Bun `spawn` with `ipc` and `serialization: "json"`.
    - Documentation Reviewed: spec §7.5 (runner contract, linker contract); `src/runner-kit/render.ts:71`; `src/runner-kit/link.ts:27`; `src/preview/worker/index.ts:59` (host re-validation pattern).
    - Options Considered: one long-lived runtime for all packages. Rejected: the cross-package answer problem the worker runner has (spec §7.5). Same-thread QuickJS and QuickJS in a `Worker`. Rejected: neither can stop a native call (Task 1 evidence).
    - Chosen Approach: QuickJS in a killable child process; fresh runtime per render by default.
    - API Notes and Examples:
      ```ts
      const runner = await quickjsRunner({ timeoutMs: 100 });
      const tree = await runner.render(pkg, inputs, { catalog, capabilities, surfaceId: "home", revision: 1 });
      runner.close();
      ```
    - Files to Create/Edit: `packages/runner-quickjs/src/{index.ts,child.ts,runtime.ts,load.ts}`; `packages/runner-quickjs/src/__tests__/*`; `packages/runner-quickjs/README.md`; `packages/runner-quickjs/archive-smoke.ts` (imports the installed package and renders once, proving the wasm and child entry resolve); `scripts/release/packages.ts` (add `require: [/^dist\/child\.js$/, /\.wasm$/]` to the runner's archive rules, deferred from Task 2); `packages/runner-quickjs/build.ts` if the wasm or child entry needs more than tsc; `packages/runner-quickjs/package.json` (`sideEffects` for the child entry; dependencies `quickjs-emscripten-core` and `@jitl/quickjs-wasmfile-release-sync` pinned to 0.32.0, justified by the decision log: 1.6 MB, MIT)
  - Test Cases to Write:
    - `quickjs_matches_render_for_every_proof_scenario`; `quickjs_infinite_loop_limit_exceeded`; `quickjs_memory_bomb_limit_exceeded`; `quickjs_stack_overflow_limit_exceeded`; `quickjs_native_hold_is_killed_and_recovers`; `quickjs_dispose_abort_drops_the_wasm_instance`; `quickjs_never_runs_pending_jobs`; `quickjs_no_host_globals`; `quickjs_no_state_between_renders`; `quickjs_disposes_every_handle`; `quickjs_runner_suite_with_isolation`.
  - Notes (executed 2026-11-09):
    - Done: `packages/runner-quickjs/src/{index.ts (host: child lifecycle, serial queue, deadline, kill), child.ts (child entry), runtime.ts (QuickJS engine), load.ts (hash check, library walk, linking), result.ts (host re-validation, bounded error lists, validator LRU), protocol.ts (messages, limit classification)}`; `archive-smoke.ts`; README (what it isolates and does not). Tests in `src/__tests__/`: `runner-suite.test.ts` (the full `runnerSuite` with `isolation: true`, all 17 cases pass), `runner.test.ts` (every proof scenario equal to `inProcessRunner`, the limit cases with their reasons, native hold killed twice and recovered, globals, state, `reuse: "package"` per-package state with LRU eviction and drop after a failure, forged `JSON.stringify` answers re-validated, templates on the host, tampered package refused, `close()`, option validation) and `engine.test.ts` (dispose-abort taint, no pending jobs, unsettled top-level await, `disposes_every_handle` through the taint counter). 35 tests in the package; `bun run check` passes (1723 pass, 4 skip, 407 s); the archive gate for the package passes, including the installed smoke, which runs the isolation cases against the installed archive outside the checkout.
    - Design as built: one child, renders serial. The child reads the kit and the wasm itself (`import.meta.resolve` of `@arnilo/liveframe/runner-kit.bundle.js` and `@jitl/quickjs-wasmfile-release-sync/wasm`), compiles the wasm once and gives every runtime its own instance. The entry module defines `globalThis.__render(text)`, called once per render; the request and answer are single JSON strings. The child runs with an empty environment and ignored stdio, is `unref`'d, exits on `disconnect`, and is killed on host `exit`. Limits are classified by message in the host (`interrupted` → timeout, `stack overflow`/`Maximum call stack` → stack, `out of memory`/`too long`/`too large` → memory), so a hard kill, an interrupt and an engine error all arrive as `limit-exceeded`.
    - Deviations from the task text: (1) the wasm is **not copied into the archive**; it comes from the pinned `@jitl/quickjs-wasmfile-release-sync` dependency (exports `./wasm`), so the archive rule requires only `dist/child.js` and the installed smoke proves the wasm resolves; a copy would duplicate 0.5 MB. (2) A `result.ts` and a `protocol.ts` were added beside the four planned files. (3) The runner keeps its own library-graph walk in `load.ts` with the bounds (4 deep, 32 packages) as local constants, because the core's `collectLibraries` and `MAX_GRAPH_*` are internal and the plan allows no root API change; if the core's bounds change, `load.ts` must follow (the `runner_loads_libraries` case would not catch a different bound). (4) The package hash is re-computed on every render, not cached per object; Task 5's bench measures what it costs. (5) The task's `quickjs_no_host_globals`/`no_state` names are covered by both the suite and dedicated tests.
    - Findings: (a) a **first render in a freshly started child takes 100–120 ms** (engine warm-up), so the default `timeoutMs` 250 holds but a `timeoutMs` of 100 fails the render after a kill; the tests give the hostile probe 100 and every render that must succeed 5000, as the suite does. Task 5 should measure warming the child (one trivial render before `ready`) against the recovery budget. (b) The quickjs-emscripten package types describe its CommonJS build while Bun loads the ESM one, so the variant import is cast once in `runtime.ts`. (c) `packLanguage` refuses top-level `await`, syntax errors and `import()`, so the engine tests that need such code hand-build linked code. (d) The wasm abort on `dispose()` after a host stack overflow is reproduced at `stackBytes` 1 MiB and drops the instance (`tainted() === 1`), as the decision log predicted. (e) A child orphaned by a host that dies while the child is in a native call is only killed by the host's `exit` hook; a `SIGKILL` of the host leaves it spinning until it is killed by hand. Documented risk, not solved.
    - Not done: macOS/Windows, resident growth of a long-lived child, and the per-API-baseline entry for this package (created at release, plan 032; the core register does not list other packages). The performance budget and bench are Task 5.

- [ ] Task 5: QuickJS budget, authoring integration and the runner guide
  - Acceptance Criteria:
    - Functional:
      - `bench/runner.bench.ts` measures cold and warm render cost for the agent-home package across `inProcessRunner`, `workerRunner`, `templateRunner` (its template port) and `quickjsRunner` (`reuse: "none"` and `"package"`). The budget recorded in the decision log (from the Task 1 spike: `reuse: "none"` agent-home ≤ 110 ms and smallest surface ≤ 60 ms; `reuse: "package"` agent-home ≤ 60 ms and smallest ≤ 8 ms; child cold start ≤ 60 ms; hold, kill, recover and next render ≤ 300 ms) is re-baselined on a quiet host and then gated in the package's bench. The `reuse: "package"` and smallest-surface figures were derived, not measured through the child, so the bench measures them first.
      - `liveframe mcp`: when the config names no runner and `@arnilo/liveframe-runner-quickjs` is installed, the stderr notice recommends it with the exact config line; behaviour is otherwise unchanged (`workerRunner()` default). `docs/mcp.md` shows `runner: await quickjsRunner()`.
      - `docs/packages.md` § "Choosing a runner": a table of the four runners with isolation, limits, cost and when to use each (templates → `templateRunner`; hostile TSX → `quickjsRunner`; trusted code → worker/in-process).
      - `docs/security.md` updated: "The reference runners are not sandboxes" stays; a new section states what `quickjsRunner` isolates and what it does not, and that `templateRunner` executes no author code.
    - Performance: the gated budget.
    - Code Quality: docs only plus one bench.
    - Security: no default changes silently; recommendation only.
    - Compatibility: no API change.
  - Approach:
    - Skills to Use: `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none beyond Task 4.
    - Documentation Reviewed: `docs/mcp.md`; `docs/packages.md`; `docs/security.md`; spec §13 (MCP default runner and stderr line).
    - Options Considered: make `quickjsRunner` the MCP default when installed. Rejected: a change of the execution engine should be explicit config, not depend on what happens to be installed.
    - Chosen Approach: recommend, document, measure.
    - API Notes and Examples:
      ```ts
      export default { catalog, capabilities, runner: await quickjsRunner() } satisfies AuthoringConfig;
      ```
    - Files to Create/Edit: `bench/runner.bench.ts`; `package.json` (`bench`); `src/cli/*` (stderr notice); `docs/mcp.md`; `docs/packages.md`; `docs/security.md`; `docs/spec.md` §7.5, §13
  - Test Cases to Write:
    - `mcp_notice_recommends_installed_quickjs_runner`; `mcp_default_runner_unchanged`; bench gate in the runner package.
  - Notes (executed <date>):

- [ ] Task 6: `@arnilo/liveframe-starter` — a conforming reference catalog, primitives and styles
  - Acceptance Criteria:
    - Functional:
      - The package exports `catalog` (the spec §5 primitive set plus the `hint` kind and the 0.3.0 features: node references on `textField`, one kind with axes, `url` props on `link`/`image`), `implementations` (React 19, built on `react-aria-components` as an optional peer), `themes` (light, dark, high-contrast), `designSystem` (with an extension property and role-aliased tone axis), the generated `ui.gen.ts` and `ui.definitions.gen.ts`, and `styles()` returning the three sheets.
      - It passes `catalogSuite`, `designSystemSuite({ contrast: true })` for every theme, `rendererSuite` and `rendererBrowserSuite` in Chromium, Firefox and WebKit.
      - It contains no product-shaped component (law-of-the-library check: every kind is in the spec §5 set or justified in the README as a generic primitive).
      - The README says it is a starting point to copy or extend, not part of the core contract.
    - Performance: the starter's design system meets span A ≤ 16.67 ms on the 50-row proof surface in Chromium.
    - Code Quality: sources derived from the proof host and demo primitives, rewritten to the 0.3.0 API; `proof/` is not imported.
    - Security: law 3 — only theme roles and design values; the contrast audit passes.
    - Compatibility: new package.
  - Approach:
    - Skills to Use: `liveframe-execution` (styling, renderer references); `find-docs` (react-aria-components current major).
    - Library Documentation to Check Before Implementation: React Aria Components (version recorded); React 19.
    - Documentation Reviewed: spec §5 primitive set; `proof/` primitives; `examples/demo-host/primitives/*`; `docs/conformance.md`; backlog "Proof styles fail the opt-in contrast audit".
    - Options Considered: a `bun create` template instead of a package. Rejected for 0.3.0: a package can be conformance-tested and versioned with the core; the guide (Task 7) shows copying it.
    - Chosen Approach: a tested package.
    - API Notes and Examples:
      ```ts
      import { catalog, implementations, themes, designSystem, styles } from "@arnilo/liveframe-starter";
      ```
    - Files to Create/Edit: `packages/starter/src/*`; `packages/starter/src/__tests__/*`; `packages/starter/README.md`; `packages/starter/package.json`
  - Test Cases to Write:
    - `starter_passes_catalog_suite`; `starter_passes_design_system_suite_with_contrast`; `starter_passes_renderer_suites` (three engines); `starter_has_only_generic_primitives`; `starter_switch_within_budget`.
  - Notes (executed <date>):

- [ ] Task 7: A getting-started guide that CI executes
  - Acceptance Criteria:
    - Functional:
      - `docs/getting-started.md` goes from an empty Bun project to: install `@arnilo/liveframe` and the starter; serve the three sheets; mount `<Surface>`; install a template widget at runtime with `pack` + `fileStore`; render it through `/host`; handle an intent; open `<Preview>`; optionally switch to `quickjsRunner` for TSX widgets.
      - `scripts/getting-started-test.ts` extracts the guide's fenced blocks tagged `ts file=…`/`sh`, writes them into a fresh temporary directory, installs the packed local archives, runs the server and asserts with Playwright that the widget is drawn and an intent round-trips. It runs in CI.
      - `README.md` links the guide first.
    - Performance: guide test wall time recorded.
    - Code Quality: the guide's code is the test's code; no second copy.
    - Security: the guide's authoriser is explicit and labelled as the app's policy.
    - Compatibility: docs only.
  - Approach:
    - Skills to Use: `liveframe-execution`; `find-docs` (Playwright `^1.49` page APIs used by the test).
    - Library Documentation to Check Before Implementation: Playwright.
    - Documentation Reviewed: `README.md`; `docs/model.md`; `scripts/demo-test.ts` (pattern).
    - Options Considered: an untested guide. Rejected: the guide is the adoption path and must not drift.
    - Chosen Approach: an executed guide.
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `docs/getting-started.md`; `scripts/getting-started-test.ts`; `package.json` (script); `.github/workflows/ci.yml`; `README.md`; `src/__tests__/docs-links.test.ts` (coverage)
  - Test Cases to Write:
    - `getting_started_guide_runs_end_to_end` (CI script).
  - Notes (executed <date>):

- [ ] Task 8: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: the twelve impact areas swept in `plans/evidence/031-impact-analysis.md`, with portability reviewed for the workspace and the Bun-only decision, and security reviewed for the QuickJS boundary; findings presented, dispositions recorded and executed or backlogged.
    - Performance: `bun run bench` including the runner bench.
    - Code Quality: findings cite `file:line`.
    - Security: an explicit list of what the isolated runner does and does not protect, matching `docs/security.md`.
  - Approach:
    - Skills to Use: `create-plan`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: this plan's notes.
    - Options Considered: n/a.
    - Chosen Approach: the standard final task.
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `plans/evidence/031-impact-analysis.md`; `plans/backlog.md`.
  - Test Cases to Write: n/a.
  - Notes (executed <date>):

## Verification (whole plan)

- `timeout 900 bun run check` (whole workspace)
- `timeout 900 bun run bench`
- `bun run release:gate` for each package directory
- `bun scripts/getting-started-test.ts`
- `bun run demo:test`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
