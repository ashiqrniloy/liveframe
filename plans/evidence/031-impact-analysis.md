# Plan 031 architectural impact analysis

Reviewed 2026-11-09 against the tree at `c70b1fb` (Tasks 1–7 committed) plus this task's own changes. Covers the twelve areas in `.claude/skills/create-plan/references/liveframe.md` §5 for the 0.3.0 isolated-runner batch: the Bun workspace with three lockstep packages, `runnerSuite()`, `@arnilo/liveframe-runner-quickjs`, `@arnilo/liveframe-starter` and the executed getting-started guide. It is not the 0.3.0 release (plan 032).

Method: read the plan and its seven notes; read `packages/runner-quickjs/src/{index,runtime,result,load,protocol,child}.ts` end to end for the isolation boundary; scanned the starter's implementations for raw colour, raw CSS and `href`/`src` handling; compared the decision log (`2026-11-08-2310`) with the code, spec §7.5/§13/§14, `docs/security.md`, `docs/packages.md` and the READMEs; grepped for stale phrases; ran the whole-plan verification; measured what earlier tasks recorded as "not measured" (`plans/evidence/031-soak.ts`).

**The machine was busy.** Other users' processes (`clay_server`, `rustc`, `qemu`) held the load average at 12–51 for the whole session. Wall-clock results are noise-bound, as in plans 026–030. The quiet-host proof stays with plan 032 Task 3.

## Whole-plan verification

| Command | Result |
| --- | --- |
| `timeout 900 bun run check` (load 8–21 rising to 51) | build, gen:check, typecheck, lint and format pass. Tests: **1745 pass, 11 fail**, 4 skip, 766 s (400 s in earlier tasks). All 11 are wall-clock gates or timeouts: `capture_after_pack_sees_that_pack`, `switch_under_budget_with_blur`, `…_with_a_two_axis_kind_installed`, `…_through_surface`, `verify_agent_home_under_20_ms`, `in_process_warm_overhead_under_point_one_ms`, `pack_errors_keep_the_previous_package`, `oversized_tree_is_refused_with_a_typed_error`, `mcp_capture_bound_defaults_and_configured_description`, `every_proof_scenario_passes_check` ("Render exceeded 100 ms") and the `format-schema-differential` 20 s bound (25.6 s) |
| the eight failing files, re-run one at a time at load 12–51 | `cli-mcp`, `css-scope-browser`, `preview-session` and `react-browser` pass at once; `mcp-capture`, `pack`, `runner-in-process` and `format-schema-differential` fail while the load is above 25 and **pass three times in a row at load 11** (0 fail in each file, tries 2 and 3) |
| `timeout 900 bun run bench` (load 12) | exits 1 at the first stage (validator `core-queue.*`, `compileValidator` reuse and `bindings: 50 when` gates), the known plan 022–030 failure; the chain never reaches the later stages. Finding F9 |
| `bun --conditions liveframe:source bench/runner.bench.ts` directly (load 14) | every budget passes. Median ms: `none` agent-home 85.9 (budget 110) and smallest 39.6 (60); `package` agent-home 57.2 (60) and smallest 5.3 (8); child cold start 19.0 (60); hold, kill, recover and next render 246 (300). Reference rows: in-process 2.1, worker 6.9, template 1.8 |
| `bun run release:gate` | passes for all three packages (core 15 steps in 6.8 s; runner 2 steps in 5.8 s, including the installed smoke that runs the isolation cases outside the checkout; starter 2 steps in 3.5 s) |
| `bun scripts/getting-started-test.ts` | passes in 5.2 s |
| `bun run demo:test` | 67 pass, 0 fail |
| `bun --conditions liveframe:source plans/evidence/031-soak.ts` | below |

### Soak: resident memory and kills (new; Task 1 and Task 4 had not measured them)

| Run | Child resident memory (MiB) |
| --- | --- |
| `reuse: "none"`, five packages, 500 renders | start 52; 74 at 100, 200, 300, 400 and 500 |
| `reuse: "package"`, five packages, 1000 renders | start 52; 92, 90, 89, 90, 91 at 200–1000 |
| 15 holds of one uninterruptible native call (`timeoutMs` 50) | first kill-and-answer 151 ms, `limit-exceeded`; the next render succeeds; **0 children alive after `close()`** |

The child does not grow; the 52 → 74 MiB step is the first renders' wasm instances and the garbage collector settling.

### Orphan test (new)

A host killed with `SIGKILL` while its child was idle: the child exited at once (the `disconnect` handler). A host killed while the child was in the native hold: the child **stayed alive at 102% CPU** until killed by hand. This is the risk Task 4 recorded; it is now measured. Finding F1.

### Large answers (new)

A sandbox answer with a 1, 8 and 14 MiB text node is parsed on the host and refused by the validator (`invalid-prop`, "at most 10000 characters") in 285–346 ms including a fresh sandbox, so the parse cost is bounded by `memoryBytes` and the tree limits, not by the widget.

## 1. Spec

`docs/spec.md` describes what shipped. §7.5 states the isolated runner and its limits; §13 scopes rule 3 ("No WebAssembly") to `@arnilo/liveframe`, lists both optional packages with the lockstep rule and `engines.bun >= 1.4.2`, documents `runnerSuite()` and `conformance/runner/fixtures.json`, and describes the `liveframe mcp` notice; §14 no longer lists an isolation sandbox as a non-goal of the project. The runtime matrix row for `conformance` carries `setTimeout`, `clearTimeout` and `loader: true` (Task 3). Grep for "WebAssembly" across the docs, README, spec and skills finds only the intentionally scoped §13 rule 3 text, the runner's own descriptions and `.claude/skills/liveframe-execution/references/storage.md:19`, which is about the transpiler in `/pack` and stays true. **F8:** the backlog entry "Evaluate a conformance suite for runners" still said the work was conditional; it is now closed. `roadmap.md` §3 still read "planned" for plan 031; updated at close. **None beyond those.**

## 2. Public API and formats

- Added to the core: `runnerSuite`, `RunnerSuiteOptions` (`/conformance`), the `./conformance/runner/*` data export (`fixtures.json`). Both are in `scripts/release/api/register-0.3.0.json`; `api-surface.ts` hashes `conformance/runner` as an optional group (a 0.2.3 baseline has none).
- New packages: `@arnilo/liveframe-runner-quickjs` (`quickjsRunner`, `QuickJsRunnerOptions`, `QuickJsRunner`) and `@arnilo/liveframe-starter` (`catalog`, `implementations`, `themes`, `designSystem`, `styles`, `primitiveCss`, subpaths `/ui`, `/definitions`, `/catalog.json`). Their `0.3.0` API baselines are created at release (plan 032 Task 3); the core register does not list other packages.
- Unchanged: formats, schemas and every existing export. The root manifest gained `workspaces` and `bunfig.toml` pins the hoisted linker; neither is part of the published archive. The root archive has no new runtime dependency (`root_archive_has_no_wasm`).
- Carried to plan 032 (recorded in Task 2): `~0.3.0` does not match `0.3.0-rc.1`, so both peer ranges must become `~0.3.0-0` before the rc; the owner must configure npm trusted publishing for the two new names (open owner action).
- **None — no unregistered break found.**

## 3. The four laws

### Law 1 — widget code never runs in the browser

`quickjsRunner` runs on the backend, in a child process of the host. The starter's `implementations` render validated trees and never evaluate widget code. The getting-started guide runs a template widget (data) in the server and shows the `quickjsRunner()` switch for TSX; the browser bundle it serves contains `<Surface>` and `<Preview>` only. **None.**

### Law 2 — the tree is validated data

The boundary, step by step (`packages/runner-quickjs/src/index.ts:158-195`, `load.ts`, `result.ts`):

| Step | Where | What can go wrong, and the answer |
| --- | --- | --- |
| Hash before loading | `render()` → `hashMatches` (`index.ts:200`) | A tampered package is `hash-mismatch` before anything reaches the child. The conformance probe is an infinite loop, so a runner that loads first fails |
| Library pins | `load.ts` `collect` | A missing library is `not-found`, a different hash `hash-mismatch`, a library whose content does not match its hash is refused, depth 4 and 32 libraries are enforced. The walk is a copy of the core's (F7) |
| Link | `load.ts` `link` | Only SDK and `liveframe:lib/…` specifiers survive; the sandbox's loader serves only those, `liveframe:kit` and the package (`runtime.ts:84-85`) |
| Request | `index.ts:167-175` | One JSON string; non-JSON inputs are `render-failed` on the host |
| Answer | `result.ts:119` `accept` | One JSON string, parsed on the host. A failure list is shape-checked (known kinds, at most 21 entries, text bounded to 1000 characters); a tree is validated by the host's own compiled validator, cached per `(catalog, capabilities, hash)`, LRU 64. Anything else is `render-failed` |
| Unrequested answer | `index.ts:97-100` | An answer for a render nobody asked for retires the child |
| Limit classification | `protocol.ts:33` | By message text: a widget that throws "interrupted" only turns its own failure into `limit-exceeded`. No effect on any tree |

The channel is not reachable from the realm: the parent talks to the child's `process`, the realm holds only ECMAScript built-ins (`runtime.ts:33-38` gives it one function it defines itself). `runner_isolation_channel_is_not_writable` and `…_render_cannot_answer_another` bite this, and `forged JSON.stringify answers re-validated` is a dedicated test.

### Law 3 — widget code never sets colour or raw CSS

`packages/starter` has no colour literal outside `themes.ts` (oklch role tables, validated against the vocabulary); the implementations pass only the `style` from `implement()` (design-system values) and two constant `overflow` values for the scroll viewport (`implementations.tsx:131-134`). The contrast audit passes for all three themes (`starter_passes_design_system_suite_with_contrast`). `href` and `src` come from props the catalog marks as `url`, which the validator checks before any implementation sees them. **None.**

### Law 4 — a widget never holds authority

The guide's `authorize` is explicit, labelled as the app's policy, and a forged intent is refused and never reaches `dispatch` (asserted by the guide test; mutation-checked). **F4:** the guide's install and placement routes were protected only by a loopback bind and an `Origin` check, and did not say that who may install is the app's policy. Fixed in the guide.

### What the isolated runner does and does not protect (matches `docs/security.md`)

**Isolates:** host capabilities (`fetch`, `process`, `Bun`, `Deno`, `require`, `WebAssembly`, timers, `console` are `undefined`; `eval`, `new Function`, `globalThis.constructor.constructor("return this")()` reach only the sandbox; no dynamic import beyond the linked modules); time (soft interrupt, then `SIGKILL` of the child 100 ms later); heap and stack; state between renders (new runtime and wasm instance by default); the answer channel; and the tree, which the host validates.

**Does not protect against:** a defect in QuickJS or the wasm runtime (the child has the host's privileges and an empty environment, so an OS sandbox is advised); CPU side channels and contention (up to `timeoutMs` + 100 ms of one core per render); host memory pressure (measured 52/74/90 MiB resident, F3); head-of-line blocking behind a held render (**F2**, now documented); `reuse: "package"` module state; a child orphaned by a killed host while in a native call (**F1**, measured); platforms other than Linux (**F6**).

## 4. Validation

Every new input has a typed error at a pointer: runner options (`RangeError` for non-positive `memoryBytes`, `stackBytes`, `timeoutMs`, `maxRuntimes`), package hash, library pins and graph bounds (`hash-mismatch`, `not-found`, `limit-exceeded`, `invalid-document`), link failures (`forbidden-import` at `/code`), the sandbox's answer (see law 2), `runnerSuite` options (`timeoutMs` above 200 refused so the busy probe outlives it), the guide's POST bodies (400 with a message). Starter `catalog.json` is validated by `validateCatalog` in `catalog.ts` and the generated files are drift-checked by `gen:check`. **None.**

## 5. Styling

The starter's design system is a recipe table with `*` variants (about 150 recipes); `designSystemSuite({ contrast: true })` passes for the three themes; the completeness check and the "no colour outside the theme" check cover it. The `sheen` extension is a colour read by the primitive CSS and ignored by the audit by design (Task 6 deviation b). The backlog entry "Proof styles fail the opt-in contrast audit" still describes the proof systems, which this plan did not touch. **None.**

## 6. Interaction tiers

Not changed by this plan. The starter's kinds cover all three (it has `tabs`, `disclosure` and the event-bearing form kinds), and `rendererSuite` plus `rendererBrowserSuite` pass in Chromium, Firefox and WebKit. The guide exercises `setState` (survives a reload) and an action (reaches `dispatch` as the viewer). **None.**

## 7. Performance

Budgets and measurements are in the verification table: all runner budgets pass at load 14 with little margin (agent-home 85.9 of 110 ms, recovery 246 of 300 ms), so they are not quiet-host figures. The starter's span A on the 50-row surface was 7–13 ms in quiet runs and up to 50 ms at load 17–25 (Task 6); `starter_switch_within_budget` is a wall-clock gate and fails under load like the other switch tests. The guide takes 5.2 s. Three costs are known and accepted: a first render in a new child is 100–120 ms (documented; the default `timeoutMs` 250 holds), the package hash is re-computed on every runner render (Task 4 deviation 4; it is inside the agent-home figure), and renders are serial (**F2**). **F9:** `bun run bench` still stops at its first stage, so the runner bench only runs when called directly.

## 8. Portability

The core stays host-API-free: the `conformance` subpath now bundles `/preview` and so gains `setTimeout`, `clearTimeout` and one approved dynamic import (README, spec §13 and `portability.test.ts` updated in Task 3); the archive gate's Node probe still passes. Both new packages declare `engines.bun >= 1.4.2`; the core declares it too. The runner depends on Bun's `spawn` with IPC, `Bun.file`, `import.meta.resolve` and `process.execPath`; the starter needs a DOM only through React. **F6:** everything was run on Linux only (Linux 7.3, Bun 1.4.4); macOS and Windows are unmeasured and not claimed in the READMEs. The workspace needs the hoisted linker (`bunfig.toml`), recorded in Task 2.

## 9. Agent authoring

A widget stopped by a limit reports `limit-exceeded` with the reason (`timeout`, `memory`, `stack`), and a kill says how long it waited; other failures are `render-failed` with a message of at most 500 characters and no host path. `liveframe mcp` recommends the isolated runner with the exact config line when the package is installed and changes no default. The guide shows `liveframe gen` against the starter's `catalog.json` for the TSX types. The starter's `catalog.json` has written descriptions for every kind and prop, the text an agent reads. Gap: an agent whose widget needs more than the default 250 ms on a cold child sees `limit-exceeded` with a reason; the README and the packages guide say why the default is 250. **None.**

## 10. Docs and examples

New or updated: `docs/getting-started.md` (new; executed in CI), `docs/packages.md` § "Choosing a runner", `docs/security.md` § "What the QuickJS runner isolates", `docs/mcp.md`, `docs/conformance.md` § "Prove a runner", `docs/migration-0.3.md` § "Runner conformance", `docs/compatibility.md` (workspace and release checklist), both package READMEs, `README.md` (links the guide first), the skill architecture reference, spec §7.5/§13/§14. This task adds the head-of-line, memory and orphan facts to the runner README and `docs/security.md` (F2, F3) and the "who may install" note to the guide (F4). `docs_links_resolve` and `getting_started_guide_is_linked_first_and_extractable` cover the links. **Gap, F10:** the guide is run but never type-checked in CI.

## 11. Conformance

`runnerSuite()` has 17 cases when isolation is on; `inProcessRunner`, `workerRunner` and `templateRunner` pass the contract cases, `quickjsRunner` passes all 17 in the package's tests and in the installed-archive smoke, and `isolation_cases_fail_for_in_process_runner` proves the cases bite. The starter passes `catalogSuite`, `designSystemSuite` with contrast for three themes, `rendererSuite` and `rendererBrowserSuite` in three engines. Gaps: the forged-result probes post a worker-protocol envelope and common alternatives, so a runner with a different channel is covered only by "nothing named FORGED reaches the caller" (Task 3); the runner's copy of the library-graph bounds has no test against the core's (**F7**); the suites cannot prove concurrency (**F2**, pool); the switching case needs a second design system the starter derives (**F11**). The backlog entry for a runner suite is closed (**F8**).

## 12. Reference hosts

- The demo host and the guide use `renderPlacement` and `handleIntent` from `/host` with `templateRunner()`; the guide's last section checks that `quickjsRunner` and `inProcessRunner` return identical trees for a TSX widget.
- The backlog entry that `runnerSuite()` closed was conditional on an adopter (Synapta) supplying an isolated runner; `runnerSuite()` is what such a runner would run. Not bent to: a runner behind a different channel is covered only by the loose forged-answer probe.
- The starter derives from the proof catalog but drops `identity.*` and every product role, and has no product-shaped component (`starter_has_only_generic_primitives`); the proof directories are not imported. Clay's `createRenderer({ catalog, implementations })` use is unchanged.
- The runner's defaults (one child, serial renders, `timeoutMs` 250) suit one host process serving one tenant; a multi-tenant host wants a runner per tenant until the pool exists (**F2**).

## Findings and dispositions

Presented to the owner in one table on 2026-11-09; the owner chose "Accept all (Recommended)".

| # | Finding | Area | Disposition |
| --- | --- | --- | --- |
| F1 | A host killed with `SIGKILL` while its child is in a native call leaves the child spinning at about 102% CPU (measured; an idle child exits) | Law 1 (backend), portability | **Backlog** P3 "Stop a child the host orphaned while it was in a native call" |
| F2 | One child renders one widget at a time: a hold delays queued renders by up to `timeoutMs` + 100 ms plus about 250 ms; undocumented | Performance, reference hosts | **Executed (docs)**: runner README and `docs/security.md`. **Backlog** P3 "Render concurrently in the QuickJS runner" |
| F3 | Child memory and kill clean-up had never been measured | Performance, security | **Executed**: `plans/evidence/031-soak.ts`, the figures above, runner README and `docs/security.md` |
| F4 | The guide's install and placement routes carried no statement that who may install is the app's policy | Law 4, docs | **Executed (docs)**: `docs/getting-started.md` § 6 |
| F5 | The starter's peer floors (`react` 19.0.0, `react-aria-components` 1.22.0) are untested | Portability, release | **Backlog** P3 "Test the starter's peer floors" |
| F6 | Runner and starter ran only on Linux | Portability | **Backlog** P3 "Run the new packages on macOS and Windows" |
| F7 | `load.ts` copies the core's library-graph walk and bounds; no test notices drift | Validation, conformance | **Backlog** P4 "Share the library-graph walk between the core and the QuickJS runner" |
| F8 | Backlog entry "Evaluate a conformance suite for runners" is delivered | Spec, backlog | **Executed**: entry closed with a status line |
| F9 | `bun run bench` stops at its first stage (known), so the runner bench is not reached | Performance, release automation | **Executed**: update line on the existing "Re-run the full benchmark suite on a quiet host" entry with this plan's runner figures |
| F10 | The guide is run but not type-checked, and uses Chromium only | Docs, conformance | **Backlog** P4 "Type-check the getting-started guide and run it in more engines" |
| F11 | The starter's switching case needs a derived second design system | Conformance | **Backlog** P4 "Let the starter's switching case take a second design system without a derived copy" |
| F12 | `roadmap.md` §3 said "planned" for plan 031; the plan's Compromises Made and Further Actions were empty | Docs, plan | **Executed** at plan close |
