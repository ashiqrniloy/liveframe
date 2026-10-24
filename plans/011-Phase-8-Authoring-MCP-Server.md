# Phase 8: Authoring MCP Server for Coding Agents

## Objectives

- Ship `liveframe mcp <config>`, an authoring-time MCP server that lets a coding agent write widgets against an app's catalog, capabilities and design system: read the catalog, the vocabulary, the capabilities and the generated types; pack a draft; render its scenarios; and capture a preview.
- Add no new model. Every tool wraps code 0.1.0 already ships: `validateCatalog`, `validateCapabilities`, `generate()`, `createPreview()`, the runners and `capture()`.
- Keep the server authoring-only. No tool installs, places or approves a widget, resolves real data or runs an action, and tests prove it.
- Prove the roadmap's Done line with a scripted MCP client that uses only the tools.

## Expected Outcome

- `liveframe mcp <config-module>` starts an MCP server over stdio. The module default-exports an `AuthoringConfig` (`{ catalog, capabilities, runner?, preview? }`). The server validates the catalog and capabilities on start. An invalid config prints typed `LiveframeError`s to stderr and exits 2, and stdout carries only the protocol.
- `tools/list` contains exactly seven tools:
  - `list_primitives`, `list_vocabulary`, `list_capabilities` and `generated_types` (read-only);
  - `pack_draft` and `render_scenarios`, on one preview session per server, using `workerRunner()` unless the config names a runner;
  - `capture_preview`, which captures the host's `<Preview>` page bound to that same session. It returns the PNGs as image content, plus the accessibility snapshots and the cells' `LiveframeError`s.
- `@arnilo/liveframe/preview` gains the type-only exports `PreviewSession`, `PreviewBinding` and `AuthoringConfig`. No subpath is added. Capture stays in the CLI.
- `@modelcontextprotocol/server` is an optional peer, imported lazily by `liveframe mcp` only. `liveframe gen` and `liveframe preview capture` run without it.
- The proof host serves its preview page for an injected session. `proof/host/mcp.config.ts` is the test host's config.
- A scripted coding agent connects to `liveframe mcp proof/host/mcp.config.ts` and, using only the tools, does three things:
  - it writes a widget with scenarios that packs and renders;
  - it fixes a deliberately invalid widget from the returned errors;
  - it fixes a layout mistake that validation cannot catch, from a captured preview.
- `docs/mcp.md` documents the command, the config and the tools for outsiders, with a tested config example.

This plan implements roadmap Phase 8: spec §13 (`liveframe mcp`, the CLI loading rule, the `/preview` row) and the capture sentence of §7.5. It follows `decision-logs/2026-10-22-0902-authoring-mcp-server-for-coding-agents.md` (scope) and `decision-logs/2026-10-22-1836-mcp-server-in-0-1-0.md` (ships in 0.1.0). The owner approved scope decisions D1–D6 on 2026-10-24 ("For D1-D6, I agree with your recommendation"). Task 1 records them in a decision log and writes them into the spec and roadmap:
- **D1:** the host config binds its own `<Preview>` page to the server's session (`preview(binding)`).
- **D2:** `liveframe mcp <config-module>` imports a host-written config module.
- **D3:** capture stays in the CLI, with no new subpath, and `AuthoringConfig` is a type-only `/preview` export.
- **D4:** a read-only `list_capabilities` tool, and `pack_draft`'s input schema built from the published manifest and scenario schemas.
- **D5:** drafts are sent inline in `session.update()`'s shape.
- **D6:** the Done test's layout mistake is a valid draft that is visibly wrong in the capture.

**Depends on:** plan 010 closed (Task 10, its impact analysis, is open when this plan is written). Execution starts after plan 010's last task is committed. Nothing in this plan needs Phase 5's code.

**Not in this plan** (Task 8 adds each to `plans/backlog.md`):
- A `setState` intent tool for checking tier 2 from an agent. `render_scenarios` takes an explicit `state` instead.
- Drafts read from disk paths.
- Capturing an open overlay (existing backlog P4).
- Validating the page's published axes in capture (existing backlog P4).
- Live data. The server renders scenarios only.
- An HTTP transport. Stdio only.
- Running from the installed package. That is the existing Phase 6 P1 gate, "Verify installed-package loader and worker entry before release", which Task 8 extends to cover `liveframe mcp`.

Probe answers that hold for every task, unless a task says otherwise:
- **Placement:**
  - The server is `src/cli/mcp.ts`, imported lazily by `src/cli/liveframe.ts` like `./capture.ts`. The CLI is outside the host-API scan (`src/__tests__/portability.test.ts:63`).
  - The config types live in `src/preview/authoring.ts`. It is type-only and host-API-free, inside the scan.
  - Proof-host changes stay in `proof/host/`. Tests that import the proof host live in `proof/tests/`, never in `src/__tests__/`, because a `src` test that imports `proof/` broke typecheck in plan 009 (Compromises Made).
- **Four laws:**
  - Law 1: draft code runs only in the runner. The page gets trees through the host's own transport, and the marker scan from `proof/tests/preview-agent-loop.test.ts` runs on the captured page and its bundle.
  - Law 2: every render goes through the session, which validates in `render()`. `<Preview>` re-checks the trees on arrival.
  - Law 3: unchanged.
  - Law 4: the server has no store, no dispatcher, no data resolver and no intent tool. `tools/list` is pinned to the seven authoring tools, and a source scan keeps `/store` out of `src/cli/mcp.ts`.
- **Primitives only:** the server adds nothing to a catalog, and its tools describe the app's catalog without changing it.
- **Dependencies:**
  - `@modelcontextprotocol/server` becomes an optional peer and a dev dependency, pinned at 2.4.0 (published 2026-10-23; owner choice on 2026-10-24). Its own runtime dependency is `zod ^4.2.0`. Liveframe writes no Zod: tool schemas use `fromJsonSchema`.
  - `@modelcontextprotocol/client` 2.4.0 becomes a dev dependency, for tests only.
  - Task 2 justifies both.
- **Performance:** no budget, since this is an authoring path. Renders cost what the runner costs. Tasks 2, 4 and 6 record server start time and the time per tool call in their Notes. `bun run bench` is untouched.
- **Reference hosts:** Synapta passes its isolated runner as `config.runner` and binds its own preview page. Clay's desktop shell can bind a local page the same way. Neither needs the proof host's code. Task 9 records both in the adopter-gaps backlog entry.

## Tasks

- [x] Task 1: Record the authoring-server contract and write it into the spec
  - Acceptance Criteria:
    - Functional:
      - A decision log `decision-logs/2026-10-24-<HHMM>-authoring-mcp-server-contract.md` (status approved) records D1–D6, with the owner's approval quote and the rejected alternatives from the scope analysis:
        - D1: the server posting drafts to host routes (the library would need a route protocol, and the server would run two sessions); the server shipping its own page (it would bundle the app's primitives, which spec §3 forbids).
        - D2: JSON-only flags (they cannot carry a runner or a page).
        - D3: a `/preview/capture` subpath (it would need host APIs and Playwright in a library subpath).
        - D5: paths on disk (path checks, and agents without a file system).
      - Spec §13's `liveframe mcp` bullet states:
        - the invocation `liveframe mcp <config-module>`;
        - the `AuthoringConfig` shape and that the catalog and capabilities are validated on start;
        - the seven tools and what each returns;
        - the default runner `workerRunner()`;
        - that `preview(binding)` is called once, after the first successful `pack_draft`, and closed on shutdown;
        - the 12-cell bound per `capture_preview` call;
        - that stdout carries only the protocol.
      - Spec §13's CLI loading rule adds: the CLI may import the config module named on the `liveframe mcp` command line. The `/preview` table row lists the three type exports.
      - Spec §7.5's capture paragraph names `capture_preview`.
      - Roadmap Phase 8's Goal lists the capabilities tool (D4).
      - The decision logs `0902` and `1836` are not edited.
    - Performance: n/a — documentation.
    - Code Quality: the spec says each rule once. The tool list lives in §13, and §7.5 links to it.
    - Security: the spec states the authoring-only boundary (law 4): no store, dispatcher, resolver or intent tool. It also states that the bound page receives trees only (law 1).
  - Approach:
    - Skills to Use:
      - `create-decision-log` — the D1–D6 record, with approval already given;
      - `karpathy-guidelines` — say only what the plan builds.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Spec §3, §7.5 and §13–§14; the decision logs `0902`, `1836`, `1600` (alternative 5) and `2026-10-24-0306` (decision 6, CLI loading).
      - `plans/backlog.md`: "Give capture a public home for the authoring MCP server" and the Phase 8 note under "Build preview sessions…".
    - Options Considered:
      - Fold the contract into plan prose without a decision log — rejected: D2 changes the spec's CLI loading rule, and the backlog asks for a decision log on capture's home.
    - Chosen Approach:
      - One decision log, then one spec edit per section listed above.
    - API Notes and Examples:
      ```ts
      // src/preview/authoring.ts (type-only)
      export type PreviewSession = ReturnType<typeof createPreview>;
      export type PreviewBinding = { readonly session: PreviewSession; package(): WidgetPackage };
      export type AuthoringConfig = {
        readonly catalog: unknown; // a catalog document, validated on start
        readonly capabilities: unknown; // a capabilities document, validated on start
        readonly runner?: Runner; // default: workerRunner()
        readonly preview?: (binding: PreviewBinding) => Promise<{ readonly url: string; close(): Promise<void> }>;
      };
      ```
    - Files to Create/Edit:
      - `decision-logs/2026-10-24-<HHMM>-authoring-mcp-server-contract.md`: new.
      - `docs/spec.md`: §7.5 and §13.
      - `roadmap.md`: Phase 8 Goal.
  - Test Cases to Write:
    - n/a — documentation. Tasks 2–7 test each rule written here.
  - Notes (executed 2026-10-24):
    - Decision log written as `decision-logs/2026-10-24-2330-authoring-mcp-server-contract.md` (status approved, `proposed_by: agent`), recording D1–D6 with the owner's 2026-10-24 quote and the seven rejected alternatives from the scope analysis. The `0902` and `1836` logs are unedited.
    - Spec §13's `liveframe mcp` bullet now states the invocation, the `AuthoringConfig` shape, start-time validation with exit 2 and protocol-only stdout, the single session with `config.runner` or `workerRunner()`, `preview(binding)` called once after the first successful `pack_draft` and closed on shutdown, the seven tools with what each returns (including `capture_preview`'s 12-cell bound), and the authoring-only boundary (laws 1 and 4). The `/preview` table row lists the three type-only exports, and the CLI loading rule now also allows importing the config module named on the command line.
    - Spec §7.5's capture paragraph names `capture_preview`. Roadmap Phase 8's Goal lists the capabilities tool and the Decisions line cites the new log.
    - Validation: `bun run gen:check`, `bun run typecheck`, `bun run lint` and `bun run format:check` pass; `git diff --check` is clean. `bun run test` reported 16 failures, all in the render-budget, worker and browser-fixture suites (`limit-exceeded` on a 100 ms render, 5 s test timeouts) while the machine was at load average 38 on 16 cores; the only changes in the tree are documentation, and the same suites pass when re-run alone except the warm-overhead budget report. Task 2 re-runs `bun run check` on a quiet machine.
    - No code, package export or dependency was touched. Later tasks are unchanged.

- [x] Task 2: Start `liveframe mcp` from a host config, behind an optional peer
  - Acceptance Criteria:
    - Functional:
      - `liveframe mcp <config>` imports the module and reads its default export. It validates `catalog` with `validateCatalog` and `capabilities` with `validateCapabilities`, then connects an `McpServer` over `StdioServerTransport`. No tools yet. Task 3 adds the first ones.
      - A missing argument prints the usage line. A module that fails to import, has no default export, or holds an invalid catalog or capabilities document prints `LiveframeError`s as JSON to stderr and exits 2. In every case stdout stays empty.
      - Without `@modelcontextprotocol/server`, the command prints how to install it (an `McpSdkMissing` error, like `PlaywrightMissing`) and exits 1. `liveframe gen` and `liveframe preview capture` keep working.
      - `src/preview/authoring.ts` exports the Task 1 types, and `/preview` re-exports them.
      - The server closes its own default `workerRunner()` on stdin end or SIGTERM. It never closes a runner the config supplied.
    - Performance: record the time from spawn to a completed `initialize` in the Notes.
    - Code Quality:
      - Argument parsing follows `src/cli/liveframe.ts`'s style, with no parser dependency.
      - The SDK is imported in one place, through an injectable loader like `capture()`'s `load`, so the missing-peer test needs no package removal.
    - Security: the config module is host code, run with the host's authority, as the app's own server would run it. The docs say so. It never receives widget code. Nothing writes to stdout except the transport.
  - Approach:
    - Skills to Use:
      - `find-docs` — MCP TypeScript SDK v2.4.0;
      - `liveframe-execution` — the CLI and the optional-peer pattern;
      - `typescript-advanced-types` — only if `AuthoringConfig` needs more than plain object types.
    - Library Documentation to Check Before Implementation:
      - MCP TypeScript SDK (`/modelcontextprotocol/typescript-sdk/v2.3.1`, the newest indexed docs, checked 2026-10-24; re-check against 2.4.0): `McpServer` from `@modelcontextprotocol/server`, `StdioServerTransport` from `@modelcontextprotocol/server/stdio`, and `server.connect(transport)`. Verify against the installed 2.4.0 that stdio works under Bun 1.4.2. If it does not, stop and record a finding; do not patch around it.
    - Documentation Reviewed:
      - `src/cli/liveframe.ts:1–99` (subcommands, the exit-2 JSON error shape) and `src/cli/capture.ts:33–50` (`PlaywrightMissing`, the lazy loader).
      - `proof/tests/preview-capture.test.ts:143` (the Bun `--preload` import block used by `gen_runs_without_playwright`).
    - Options Considered:
      - Hand-written JSON-RPC over stdio, with no dependency — rejected: the roadmap and spec §13 name the MCP SDK, and protocol negotiation and versioning are its job.
      - SDK v1 (`@modelcontextprotocol/sdk` 1.32.x) — rejected: v2 is the current line, and v1 takes Zod 3 or 4 raw shapes, where v2 takes `fromJsonSchema`.
      - A regular dependency — rejected: only one command needs it (spec §13).
    - Chosen Approach:
      - Lazy `import("./mcp.ts")` from the `mcp` subcommand. `mcp.ts` loads the SDK through `loadSdk()` and the config through `import(pathToFileURL(resolve(arg)).href)`.
      - Justification for the peer: MCP is the standard interface coding agents speak, and the SDK handles protocol versions and capability negotiation, which a hand-written server would have to track. An optional peer keeps it, and its `zod`, off every install that doesn't run `liveframe mcp`. The client package is test-only.
    - API Notes and Examples:
      ```bash
      timeout 30s bun src/cli/liveframe.ts mcp src/__tests__/fixtures/mcp.config.ts
      ```
    - Files to Create/Edit:
      - `src/cli/mcp.ts`: new. `src/cli/liveframe.ts`: the `mcp` subcommand.
      - `src/preview/authoring.ts`: new. `src/preview/index.ts`: type re-exports.
      - `package.json`:
        - `peerDependencies["@modelcontextprotocol/server"]` set to `2.4.0`, plus the optional meta;
        - `devDependencies` gain `@modelcontextprotocol/server` and `@modelcontextprotocol/client` at `2.4.0`.
      - `src/__tests__/fixtures/mcp.config.ts`: new. The proof fixture catalog and capabilities documents, with `inProcessRunner()`.
      - `src/__tests__/cli-mcp.test.ts`: new.
  - Test Cases to Write:
    - `mcp_server_initializes_over_stdio`: a `Client` over `StdioClientTransport` spawns the command and completes `initialize`. Fails if the transport or the config import breaks.
    - `invalid_config_exits_2_with_errors_on_stderr_and_empty_stdout`: one case each for a missing module, no default export, a bad catalog and bad capabilities.
    - `missing_mcp_sdk_reports_how_to_install`: an injected loader failure.
    - `gen_runs_without_the_mcp_sdk`: a preload blocks every `@modelcontextprotocol/*` import.
    - `default_worker_runner_is_closed_on_shutdown`: no live worker after stdin ends.

  - Notes (executed 2026-10-24):
    - `src/cli/mcp.ts` holds the whole command: `mcp(path, load = loadSdk)` lazily loads `McpServer` and `StdioServerTransport` through one injectable loader, imports the config with `pathToFileURL(resolve(path))`, validates the catalog and capabilities, connects over stdio, then waits for stdin end, `SIGTERM` or `SIGINT`, closes the server and closes the runner only when it created it (`workerRunner()`). Config errors print the `LiveframeError[]` JSON to stderr and return 2; a loader failure throws `McpSdkMissing`, which `liveframe.ts` turns into the install message and exit 1; a missing argument throws the usage line through the CLI's existing exit-2 catch. `liveframe.ts` gained only the `mcp` subcommand and the lazy `import("./mcp.ts")`.
    - `src/preview/authoring.ts` is type-only (`PreviewSession`, `PreviewBinding`, `AuthoringConfig`) and `/preview` re-exports the three names. `package.json` gained the optional `@modelcontextprotocol/server` peer at 2.4.0 and both MCP packages at 2.4.0 as dev dependencies; `bun.lock` follows. No subpath was added.
    - The server reports `name: "liveframe"` and the `package.json` version (read through a JSON import), so the handshake cannot drift from the release.
    - Findings. (1) MCP SDK 2.4.0's `McpServer` + `StdioServerTransport` + `connect()` work unchanged under Bun 1.4.4 over stdio, so the plan's stop-and-record branch did not trigger; 2.4.0 also offers `serveStdio(factory)`, which owns the 2025/2026 era decision, and the simpler `connect()` path is enough for Tasks 3–7 because a coding agent's client sends a normal `initialize`. (2) A Bun preload `plugin()` with `onResolve` does **not** intercept dynamic imports of bare specifiers under 1.4.4 — it only sees relative paths — so the existing `src/__tests__/fixtures/no-playwright.ts` never actually blocks Playwright, and plan 009's `gen_runs_without_playwright` passed trivially. `src/__tests__/fixtures/no-mcp-sdk.ts` therefore uses `mock.module` from `bun:test` in the preload, which does block; Task 8 now hands the `no-playwright.ts` fix to the backlog.
    - Extra fixtures beyond this task's file list: `mcp-worker.config.ts` (no runner), `mcp-runner-close.config.ts` (a config runner whose `close()` writes a marker, to prove it is never called), `mcp-bad-catalog.config.ts`, `mcp-bad-capabilities.config.ts`, `mcp-no-default.ts` and `no-mcp-sdk.ts`.
    - Performance: spawn to a completed `initialize` measured at 107, 96 and 100 ms over three runs on the loaded machine (client connect includes Bun's own start-up). No tools yet, so no per-call time.
    - Validation: `bun run check` passed (563 tests, 0 failures, 260 s), including `cli-mcp.test.ts` (6 tests) and the host-API-free scan for `/preview`. `git diff --check` is clean. No spec change was needed: Task 1 already wrote this behaviour into §13.

- [x] Task 3: Add the read-only catalog tools
  - Acceptance Criteria:
    - Functional:
      - `list_primitives({ kinds? })` returns each definition in full: kind, props schema, children, events with `carries` and description, variants, slots, style props, `description` and `deprecated`. Omitting `kinds` returns all of them. An unknown kind is `isError` with `unknown-component` and the list of known kinds.
      - `list_vocabulary()` returns `catalog.vocabulary`: colour, surface, fillable and typography roles, tones, `surfaceTypography`, and the `space`, `radius`, `size` and `bp` names.
      - `list_capabilities()` returns each source's params and result schemas and each action's args schema. It never calls a resolver; the config cannot supply one.
      - `generated_types()` returns `generate(catalog)` byte-identical to what `liveframe gen` writes, with a one-line note to save it as `ui.gen.ts` beside the widget and import from `./ui.gen`.
      - Results are JSON in one text content block. Every tool description says what the result is for.
    - Performance: n/a. The values are computed once at start, since the catalog is fixed per server.
    - Code Quality: one small handler per tool in `src/cli/mcp.ts`, with no tool framework of our own.
    - Security: read-only. No tool reads files, the network or real data.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (formats, SDK);
      - `find-docs` — `registerTool` and `fromJsonSchema` in v2.4.0.
    - Library Documentation to Check Before Implementation:
      - MCP SDK v2.4.0: `server.registerTool(name, { description, inputSchema: fromJsonSchema(...) }, handler)`, and no-argument tools.
    - Documentation Reviewed:
      - `src/formats/catalog.ts:47–55` (`Definition`, `Catalog`), `src/formats/vocabulary.ts:11–25`, `src/formats/capabilities.ts` and `src/sdk/gen.ts:47`.
    - Options Considered:
      - MCP resources instead of tools for the static lists — rejected: the roadmap names tools, and some clients don't surface resources.
      - Summaries instead of full definitions — rejected: the agent needs the exact props schema to write valid props, and `kinds` already narrows the list.
    - Chosen Approach:
      - Precompute four JSON values at start and register four handlers.
    - API Notes and Examples:
      ```ts
      server.registerTool("list_primitives", { description, inputSchema: fromJsonSchema(kindsSchema) }, ({ kinds }) => text(pick(kinds)));
      ```
    - Files to Create/Edit:
      - `src/cli/mcp.ts`, `src/__tests__/cli-mcp.test.ts`.
  - Test Cases to Write:
    - `list_primitives_returns_every_definition_or_the_named_ones`, and `unknown_kind_is_an_error_naming_known_kinds`.
    - `list_vocabulary_matches_the_catalog_vocabulary`.
    - `list_capabilities_lists_sources_and_actions_with_schemas`.
    - `generated_types_equals_liveframe_gen_output`: compared with `src/__tests__/fixtures/widgets/ui.gen.ts`, so a drift in either fails.

  - Notes (executed 2026-10-24):
    - `registerCatalogTools(sdk, server, catalog, capabilities)` in `src/cli/mcp.ts` registers the four handlers, each two to eight lines, over values fixed for the server's lifetime: `known` kinds, `catalog.vocabulary`, the validated capabilities document and `generate(catalog)` (`generated_types` computes it per call, which measured 1.7–2.1 ms). Two helpers, `text()` and `failure()`, keep every result one JSON text block. `loadSdk()` now also returns `fromJsonSchema`, so nothing else in the CLI imports the SDK and `gen` stays SDK-free. `loadConfig()` returns the validated `catalog` and `capabilities` beside the config, because `AuthoringConfig`'s fields are `unknown` until validated; Task 4 uses the same values.
    - `list_primitives` takes `{ kinds?: string[] }` through `fromJsonSchema<{ kinds?: string[] }>`, returns the definitions verbatim (in catalog order, filtered by `kinds`), and on an unknown kind returns `isError` with one `LiveframeError` per bad kind: `kind: "unknown-component"`, `pointer: "/kinds/<i>"`, the bad name in `message`, and the known kinds comma-joined in `expected`.
    - `list_capabilities` returns the validated capabilities document verbatim (format, actions with `args`, sources with `params` and `result`, descriptions, `confirm`). It calls nothing, and `Capabilities` has no slot for a resolver, so law 4 holds by type.
    - `generated_types` returns `{ note, types }` — JSON, like every other result — with `types` holding `generate(catalog)` unchanged, so the string is byte-identical. The test compares it with `fixtures/widgets/ui.gen.ts`, which `sdk-gen.test.ts` already holds to `generate()` and `liveframe gen`.
    - Findings. (1) `fromJsonSchema` in SDK 2.4.0 defaults to an Ajv validator, so `tools/list` advertises the real JSON Schema and bad arguments are rejected by the SDK before the handler — the path Task 4's second error test relies on. (2) The SDK's `fromJsonSchema<T>` infers the handler argument type, so no `unknown` casting is needed in the handlers. (3) Tool descriptions are the only place an agent learns each tool's purpose; each names what the result is for, and a test keeps them at least 20 characters so a placeholder description cannot pass.
    - Tests added to `src/__tests__/cli-mcp.test.ts` (12 tests total): `tools_list_has_the_four_read_only_tools` (names, descriptions, the `kinds` input schema), `list_primitives_returns_every_definition_or_the_named_ones`, `unknown_kind_is_an_error_naming_known_kinds`, `list_vocabulary_matches_the_catalog_vocabulary`, `list_capabilities_lists_sources_and_actions_with_schemas`, `generated_types_equals_liveframe_gen_output` — all through a real stdio client over the proof fixtures.
    - Performance: 130–133 ms spawn to completed `initialize`; per-call medians over 10 calls, twice: `list_primitives` 0.8 ms (17.9 KB), `list_vocabulary` 0.5–0.6 ms (2.2 KB), `list_capabilities` 0.3–0.4 ms (1.7 KB), `generated_types` 1.7–2.1 ms (35.7 KB) — sizes are the proof catalog's.
    - Validation: `bun run check` passed (569 tests, 0 failures, 234 s) at load average 50 on 16 cores, including `cli-mcp.test.ts` 12/12; `git diff --check` is clean.
    - Spec and roadmap need no change: Task 1 wrote these tools into §13.

- [ ] Task 4: Pack and render drafts on one preview session
  - Acceptance Criteria:
    - Functional:
      - The server holds one `createPreview({ catalog, capabilities, runner })` session for its lifetime.
      - `pack_draft({ files, entry, manifest, scenarios })` calls `session.update()`. It returns `{ hash, id, version, scenarios }` on success. On failure it returns `isError` with the pack errors, and the previous package stays current (spec §7.5).
      - `pack_draft`'s input schema is built from `schemas/manifest.json` and `schemas/widget-package.json#/$defs/scenario`, with `$defs` hoisted. This way `tools/list` shows the agent the exact shapes.
      - `render_scenarios({ scenario?, state?, context? })`:
        - with `scenario`, it calls `session.render()` and returns the tree or the `LiveframeError`s;
        - without `scenario`, it calls `session.check()` and returns, per scenario, `ok` with a node count, or the errors.
        - Before any successful pack, it returns `isError` saying to call `pack_draft` first.
      - With no runner in the config, the server uses `workerRunner()`. A config runner is used for every render, so preview and production use the same runner.
    - Performance: record per-call time for packing and checking the agent-home draft in the Notes. No budget.
    - Code Quality:
      - Results stay in spec §7.5's own shapes; nothing is wrapped again.
      - Arguments the MCP SDK's schema check rejects come back as the SDK's `isError` text, which includes a data pointer. Cross-reference errors come from `pack()` as `LiveframeError`s. Both paths are tested.
    - Security: laws 1, 2 and 4. Drafts go only to the runner, every tree passes `render()`'s validation, and no store is touched.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (preview);
      - `find-docs` — `fromJsonSchema` validator behaviour.
    - Library Documentation to Check Before Implementation:
      - MCP SDK v2.4.0, `docs/advanced/schema-libraries.md`: which validator `fromJsonSchema` uses under Bun, and whether it supports draft 2020-12 `$defs`. If it does not, fall back to `fromJsonSchema` with a validator backed by `validateManifest` and `validateScenario`, and record the change in this task's Approach.
    - Documentation Reviewed:
      - `src/preview/session.ts:12–128`, `src/pack/pack.ts:8`, and the `scenario` `$defs` of `schemas/widget-package.json`.
      - The `0306` decision log (preview contracts); `docs/preview.md` (session semantics).
    - Options Considered:
      - A loose `manifest: object` input with our validator as the only check — rejected by D4: the agent would not see the shape in `tools/list`.
      - One session per tool call — rejected: capture must see the draft the agent last packed (D1).
    - Chosen Approach:
      - One session, two handlers, and schemas taken from the published JSON so they never drift from `/schemas`.
    - API Notes and Examples:
      ```json
      { "name": "pack_draft", "arguments": { "files": { "widget.tsx": "…", "ui.gen.ts": "…" }, "entry": "widget.tsx", "manifest": { "format": "liveframe-manifest/1", "…": "…" }, "scenarios": [{ "name": "ready", "…": "…" }] } }
      ```
    - Files to Create/Edit:
      - `src/cli/mcp.ts`, `src/__tests__/cli-mcp.test.ts`.
  - Test Cases to Write:
    - `pack_draft_returns_the_hash_session_update_returns`: the same hash as `pack()` on the same draft.
    - `pack_errors_keep_the_previous_package`: a failing pack is followed by a render of the previous package.
    - `schema_rejection_names_the_pointer`, and `cross_reference_error_is_a_liveframe_error` (an undeclared action).
    - `render_scenarios_returns_tree_or_errors`, and `render_all_matches_session_check`.
    - `render_before_pack_says_to_pack_first`.
    - `config_runner_is_used_for_every_render`: a spy runner counts the calls.
    - `pack_draft_schema_embeds_the_published_schemas`: fails if `/schemas` changes and the tool's schema doesn't follow.

- [ ] Task 5: Bind the proof host's preview page to an injected session
  - Acceptance Criteria:
    - Functional:
      - `previewRoutes()` gains `attach(binding: PreviewBinding): string`. It serves the bound session's page and `/preview/render` under the returned id, reading the manifest and scenario names from `binding.package()`.
      - `startHost()` exposes `attach`.
      - The existing `GET /preview` session flow, its draft and publish routes, and every existing preview test are unchanged.
      - `proof/host/mcp.config.ts` default-exports an `AuthoringConfig`:
        - the proof catalog and capabilities documents;
        - `preview(binding)`, which starts the proof host on port 0, attaches the binding and returns `{ url: "<host>/preview?session=<id>", close }`.
      - An attached session takes no draft or publish requests from the page; the MCP tools are its only writer.
    - Performance: n/a — record the proof-host start time inside `preview()` in the Notes.
    - Code Quality: one `attach` path that reuses `snapshot()`, with no second page renderer.
    - Security: law 1 is unchanged, since the page gets trees from `render`. The bound host listens on 127.0.0.1 only, as today (`proof/host/server.ts`).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (proof);
      - `safe-refactor` — the existing preview flow keeps its behaviour.
    - Library Documentation to Check Before Implementation:
      - none — Bun.serve as already used in `proof/host/server.ts`.
    - Documentation Reviewed:
      - `proof/host/preview.ts:8–80` (`open()`, `snapshot()`, the session map), `proof/host/server.ts:11–60`, and `proof/host/preview-client.tsx:47–77`.
    - Options Considered:
      - Let the MCP server post to the proof host's draft route — rejected by D1.
      - Add a session getter to `createPreview` — rejected: `PreviewBinding.package()` meets the need without changing the session API.
    - Chosen Approach:
      - Register the external binding in the existing session map behind the same snapshot interface.
    - API Notes and Examples:
      ```ts
      const host = await startHost(0);
      const id = host.attach(binding);
      return { url: `${host.url}preview?session=${id}`, close: () => host.stop(true) };
      ```
    - Files to Create/Edit:
      - `proof/host/preview.ts`, `proof/host/server.ts`.
      - `proof/host/mcp.config.ts`: new.
      - `proof/tests/preview-attach.test.ts`: new.
  - Test Cases to Write:
    - `attached_session_page_shows_the_bound_package`: update the session directly, then fetch the page and find the new scenario names.
    - `attached_session_rejects_draft_and_publish_routes`.
    - The existing `proof/tests/preview-*.test.ts` stay green; this is the refactor's guard.

- [ ] Task 6: Add `capture_preview`
  - Acceptance Criteria:
    - Functional:
      - `capture_preview({ scenarios?, widths?, themes?, designSystems? })` works in four steps:
        1. On first use it calls `config.preview(binding)` and keeps the URL.
        2. It counts the cells requested against the page's declared axes. More than 12 is `isError`, with the count and the arguments to narrow by.
        3. It calls `capture(url, options)` into a per-server temporary directory, which is removed on shutdown.
        4. It returns, per cell, the coordinates, the `LiveframeError`s and the accessibility snapshot as text, with the PNG as an `image` content block.
      - Error cases:
        - before a successful pack: `isError` saying to call `pack_draft` first;
        - with no `config.preview`: `isError` naming the config field;
        - without Playwright: `PlaywrightMissing`'s message;
        - an axis value the page does not declare: `capture()`'s existing error text.
      - On shutdown the server calls `close()` on the binding the config returned.
    - Performance: record the time per cell in the Notes. Plan 009 measured 173–320 ms.
    - Code Quality: calls `capture()` from `src/cli/capture.ts` directly, never spawning `liveframe`. Adds no capture logic.
    - Security:
      - Capture is read-only and writes only under its temporary directory.
      - The bound page receives trees, never draft code (law 1).
      - The 12-cell bound keeps one call from flooding the agent's context.
  - Approach:
    - Skills to Use:
      - `find-docs` — MCP image content in v2.4.0;
      - `liveframe-execution` (preview).
    - Library Documentation to Check Before Implementation:
      - MCP SDK v2.4.0, `docs/servers/tools.md` "Return other content types": `{ type: "image", data: <base64>, mimeType: "image/png" }`.
    - Documentation Reviewed:
      - `src/cli/capture.ts:52–114`, and the `backlog.md` Phase 8 note (call `capture()` directly).
    - Options Considered:
      - Return file paths only — rejected: agents without a file system could not see the pixels.
      - No cell bound — rejected: the proof page declares 12 cells per scenario, and an unnarrowed call over four scenarios would return 48 images.
      - Spawn `liveframe preview capture` — rejected by the backlog note: a second process and a second parse of its output.
    - Chosen Approach:
      - Bind the page lazily, capture directly, return the images inline.
    - API Notes and Examples:
      ```json
      { "name": "capture_preview", "arguments": { "scenarios": ["ready"], "widths": [360] } }
      ```
    - Files to Create/Edit:
      - `src/cli/mcp.ts`.
      - `proof/tests/mcp-capture.test.ts`: new, against `proof/host/mcp.config.ts`.
  - Test Cases to Write:
    - `capture_returns_png_snapshot_and_errors_per_cell`: a PNG signature in the base64; the YAML names the cell's landmarks.
    - `capture_shows_the_draft_last_packed`: pack A, then pack B, then capture; the snapshot holds B's text.
    - `capture_over_12_cells_is_an_error_naming_the_narrowing_arguments`.
    - `capture_before_pack_and_without_preview_config_are_errors`.
    - `capture_page_and_bundle_hold_no_draft_code`: the law 1 marker scan.

- [ ] Task 7: Prove a coding agent works through the MCP tools only
  - Acceptance Criteria:
    - Functional: one test spawns `liveframe mcp proof/host/mcp.config.ts` with the default `workerRunner()`. A scripted client reads only tool results, never imports catalog or session internals, and runs three loops:
      1. **Write:**
         - it calls `list_primitives`, `list_vocabulary`, `list_capabilities` and `generated_types`;
         - it writes a small widget from them (a heading and a row of three buttons), importing `./ui.gen` from the returned text, with `ready` and `empty` scenarios;
         - `pack_draft` succeeds, and `render_scenarios` without `scenario` returns `ok` for both.
      2. **Fix invalid:**
         - it packs a draft that uses an undeclared action and a style value outside the vocabulary;
         - it reads the `LiveframeError`s (`kind`, `pointer`, `expected`);
         - it fixes the draft from that text alone, choosing the action from `list_capabilities` and the value from `expected`;
         - it re-packs and the scenarios render clean.
      3. **Fix layout (D6):**
         - it packs a valid draft whose button row is written as `stack` instead of `inline`; it renders with no errors;
         - `capture_preview` at width 360 returns a cell taller than the "one row" threshold, read from the PNG header's height;
         - it switches to `inline`, re-packs, captures again, and the height is within the threshold.
         - The threshold is fixed in the test at execution, from the fixed draft's measured height plus a margin, and recorded in the Notes.
      - After each capture, the law 1 marker scan runs on the page and its bundle.
      - `tools/list` equals exactly the seven tools.
    - Performance: record the loop's duration in the Notes. No budget.
    - Code Quality: the client's steps read like an agent's transcript. Helpers only parse tool results.
    - Security:
      - Law 4: the pinned tool list, plus `mcp_server_imports_no_store`, a source scan of `src/cli/mcp.ts` for `/store` imports.
      - Law 1: the marker scan.
  - Approach:
    - Skills to Use:
      - `verify-and-stop` — prove the loop without extending the server.
    - Library Documentation to Check Before Implementation:
      - MCP client v2.4.0: `Client`, `StdioClientTransport`, `listTools()`, `callTool()` and `isError` results (`docs/testing.md`).
    - Documentation Reviewed:
      - Roadmap Phase 8 Done, `proof/tests/preview-agent-loop.test.ts` (shape and marker scan), and the proof catalog's `stack` and `inline` definitions.
    - Options Considered:
      - A real LLM agent — rejected: not deterministic. Phase 6 runs a real agent from the published docs.
      - The layout mistake as an invalid style value — rejected by D6: loop 2 already covers validation errors.
    - Chosen Approach:
      - One deterministic end-to-end test over the real command and stdio.
    - API Notes and Examples:
      ```ts
      const client = new Client({ name: "scripted-agent", version: "0" });
      await client.connect(new StdioClientTransport({ command: "bun", args: ["src/cli/liveframe.ts", "mcp", "proof/host/mcp.config.ts"] }));
      ```
    - Files to Create/Edit:
      - `proof/tests/mcp-agent-loop.test.ts`: new.
      - `src/__tests__/cli-mcp.test.ts`: `tools_list_is_exactly_the_authoring_set` and `mcp_server_imports_no_store`.
  - Test Cases to Write:
    - `scripted_agent_writes_fixes_and_lays_out_a_widget_through_mcp_tools_only`.
    - `tools_list_is_exactly_the_authoring_set`: fails if a tool is added or renamed without a spec change.
    - `mcp_server_imports_no_store`.

- [ ] Task 8: Document `liveframe mcp` for outsiders and hand off the rest
  - Acceptance Criteria:
    - Functional:
      - `docs/mcp.md` covers:
        - what the server is and is not (authoring only);
        - installing the optional peers (`@modelcontextprotocol/server`, and Playwright for capture);
        - writing the config, including `runner` and `preview(binding)`, with the warning that a reference runner is not a sandbox;
        - each tool with an example result;
        - registering the server in a coding agent's MCP settings;
        - the error shapes and exit codes.
      - The guide's config example is `src/__tests__/fixtures/mcp-guide.config.ts`, embedded verbatim and started by a test.
      - `docs/preview.md` and `README.md` link to the guide.
      - The skill reference `.agents/skills/liveframe-execution/references/preview.md` "Today" section describes what shipped.
      - `plans/backlog.md` changes:
        - "Give capture a public home for the authoring MCP server" is closed, with resolution D3;
        - the Phase 8 note under "Build preview sessions…" is marked done;
        - "Verify installed-package loader and worker entry before release" adds `liveframe mcp` with its default `workerRunner()` from the installed package;
        - new P4 entries for the `setState` intent tool and disk-path drafts;
        - a new entry for `src/__tests__/fixtures/no-playwright.ts`, which a Bun preload `plugin()` cannot make effective (found in Task 2): rewrite it with `mock.module` like `no-mcp-sdk.ts`, and confirm `gen_runs_without_playwright` and a `preview capture` case fail when the peer is blocked.
    - Performance: n/a.
    - Code Quality: written for someone outside the repo. Each rule is stated once and links to spec §13.
    - Security: the guide states that the config runs as host code, that drafts never reach the browser, and that no tool installs, places, approves, resolves data or dispatches.
  - Approach:
    - Skills to Use:
      - `karpathy-guidelines`;
      - `create-plan` — the backlog format.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `docs/preview.md` and `src/__tests__/preview-guide.test.ts` (the tested-example pattern).
    - Options Considered:
      - Add a section to `docs/preview.md` — rejected: the MCP server has its own audience (agent setup), and preview's guide is about pages and sessions.
    - Chosen Approach:
      - One guide with a tested config.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `docs/mcp.md`: new.
      - `docs/preview.md`, `README.md`.
      - `src/__tests__/fixtures/mcp-guide.config.ts`, `src/__tests__/mcp-guide.test.ts`: new.
      - `.agents/skills/liveframe-execution/references/preview.md`, `plans/backlog.md`.
  - Test Cases to Write:
    - `mcp_guide_config_starts_and_lists_the_tools`.

- [ ] Task 9: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/011-impact-analysis.md` sweeps all twelve impact areas of the create-plan reference against what shipped, recording each one or `None — <reason>`.
      - Every finding is presented to the owner in one table with a recommended disposition (`execute` or `backlog`), and the answer is recorded. Each `execute` finding becomes a task above this one and is executed. Each `backlog` finding goes to `plans/backlog.md` and Further Actions.
      - Known candidates to sweep:
        - the 12-cell bound as a fixed number;
        - the SDK's schema-check messages compared with `LiveframeError` pointers;
        - running from the installed package (the Phase 6 gate);
        - Synapta's isolated runner and Clay's local page as `AuthoringConfig` users (the adopter-gaps entry);
        - whether `render_scenarios` trees need size limits for agents.
      - Roadmap Phase 8 is marked complete in §3 only if every Done clause has a passing test.
    - Performance: confirm the Task 2, 4, 6 and 7 measurements were recorded.
    - Code Quality: findings name files and spans.
    - Security: confirm laws 1 and 4 have a rejecting test on every new path.
  - Approach:
    - Skills to Use:
      - `create-plan` (final task), `graft`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/evidence/009-impact-analysis.md`: the format.
    - Options Considered:
      - n/a — required by the create-plan skill.
    - Chosen Approach:
      - Sweep, present, dispose.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/011-impact-analysis.md`: new.
      - `plans/backlog.md`, this plan's Compromises Made and Further Actions, `roadmap.md` §3.
  - Test Cases to Write:
    - n/a — analysis.

## Verification (whole plan)

- `timeout 600s bun install` (installs the new dev dependencies)
- `timeout 600s bunx playwright install chromium` (once per machine)
- `timeout 600s bun run check`
- `timeout 300s bun test src/__tests__/cli-mcp.test.ts src/__tests__/mcp-guide.test.ts`
- `timeout 300s bun test proof/tests/preview- proof/tests/mcp-`
- `timeout 120s graft build`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
