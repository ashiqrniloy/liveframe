# Liveframe Roadmap

Liveframe (`@arnilo/liveframe`) lets an app's UI change at runtime — by users, organisations or AI agents — without a deployment, while staying safe and looking native. The app ships primitives and a design system; everything above them is TSX widget code installed at runtime.

The normative design is [`docs/spec.md`](docs/spec.md). This roadmap orders the work and holds the execution state.

## Contents

1. Rules for every phase
2. Phases
3. Execution state

## 1. Rules for every phase

**Authority order.**
1. `docs/spec.md` is the single normative target.
2. Accepted decision logs in `decision-logs/` come next. A decision that changes the spec updates the spec in the same change.
3. Execution state (current phase, plan status, next free plan number) lives only in §3 of this file.

**The four laws** (spec §2). Every phase keeps all four:
1. Widget code never runs in the browser. Only the app's compiled primitives run there.
2. The UI tree is data, validated before the renderer reads it.
3. Widget code never sets colours or raw CSS. Look comes from the design system; layout comes from token-constrained style props.
4. A widget never holds authority. Data is resolved and actions are run by the app, as the viewer.

**Library rules.**
- **Primitives, not product components.** The library ships no components. Catalogs hold only primitives; anything composable from primitives is widget code.
- **Host-API-free core.** Everything outside `/react`, `/store/fs`, `/preview/worker`, `/preview/react` and the CLI imports no `node:`, `bun:`, DOM or `require`, and CI enforces it.
- **The problem class first.** Liveframe is designed for any app with this problem. Never bend it to ease one adopter's migration; record the adopter's gap instead.
- **No new runtime dependency** without an explicit plan task that justifies it.
- **Green after every task.** `bun run check` passes when each plan task ends.
- **Simplest thing that holds.** No feature the spec does not require; extras go to `plans/backlog.md`.
- **Budgets on realistic sizes.** Performance budgets are measured on the tree sizes a real surface shows (a page or window of rows, spec §7.1). Stress sizes are measured too, against their own limit. An optimisation (patches, compression, caching) is added only when a measurement calls for it (`docs/model.md`, "Performance").

## 2. Phases

Phases run in the order listed below. Phase numbers are stable names, not positions: Phase 8 runs before Phase 6 so that the MCP server ships in 0.1.0 (`decision-logs/2026-10-22-1836-mcp-server-in-0-1-0.md`). Each phase is one plan, or explicit Part A/B plans.

### Phase 0 — Primitive-set proof

- **Goal:** prove the spec's central claim before building the library: a small primitive set, plus recipes and style props, can express real product UI with no product-shaped components.
- **Why:** both source apps hit this wall. Synapta's components are too big (its approved home is blocked by `Queue`); Clay's primitives are too thin.
- **Scope:** spec §12 exactly — four reference UIs from Synapta and Clay built as TSX widgets on the candidate primitives, under the Certified and Rack design systems, with all three interaction tiers. Proof-grade code in `proof/`, not the published package.
- **Done:** the §12 report exists with the final primitive list, the style props needed, the gaps and how each was resolved, and a go/no-go. The spec is updated with what the proof changed.
- **If no-go:** stop and revisit spec §5–§6 before any later phase.

### Phase 1 — Formats and validator

Two plans: Part A (the formats, install-time validation and the recipe resolver), then Part B (the compiled tree validator). Scope: `decision-logs/2026-10-22-1905-phase-1-format-scope.md`.

- **Goal:** `@arnilo/liveframe` root export: the schema language; the vocabulary, definition, catalog, capabilities, manifest, theme and design-system formats; the UI tree and intent types; the error format; install-time validators; the recipe resolver (Part A); the compiled tree validator (spec §10, Part B); a published JSON Schema for every format.
- **Done:** every spec §10 check has a failing-case test; every format is validated on install; the formats are JSON Schema with TS types derived from them; the Phase 0 proof's catalog, themes, design systems, vocabulary and agent-home manifest are expressed in the new formats and validate. The validator is compiled per catalog (closures built when the catalog loads, with no `Function` constructor), and a bench shows it beats generic schema checking on a realistic tree. **The validator's share of the render budget is ≤ 1.5 µs per node** on the proof's 679-node agent-home tree; Phase 2 Part A holds the 3 µs-per-node total through `render()` (2 ms at the 680-node, 50-row selection tree), which the proof's 8.5 µs/node path does not (`decision-logs/2026-10-22-1519-phase-0-go.md`, `proof/GAPS.md` G32). The route is removing redundant work, not changing language. The author's code is ~2% of the proof's render, validation re-walks a tree the build pass already checked, and the bytes limit stringifies the tree. Build and validate in one pass with the compiled checks, and count bytes as nodes are emitted (`decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md`).

### Phase 2 — SDK, packages and storage

Two plans: Part A (the SDK), then Part B (packages, storage and runners), which installs and runs what Part A renders.

**Part A — SDK**

- **Goal:** `@arnilo/liveframe/sdk`: the JSX runtime, `state.set` / `action`, `render()` with key-path ids and every spec §7.2 error kind, and the `liveframe gen` CLI with `--check`.
- **Done:** a widget renders to a validated tree in Bun with no host APIs; codegen output is checked for drift in CI. `render()` is deterministic (same widget version and inputs, byte-identical tree), tested, so a host can cache re-runs on a hash of the inputs (spec §8). Input data is checked once per resolution, not on every render, and the Phase 0 benches hold 3 µs per node through `render()`.

**Part B — Packages, storage and runners** (spec §7.3–§7.5)

- **Goal:** `@arnilo/liveframe/pack` (`pack()` with required scenarios, `verifyPackage()`), `@arnilo/liveframe/store` (the record formats, the `Store` interface, `memoryStore()`, `loadPlacement()`), `@arnilo/liveframe/store/fs` (`fileStore(dir)`), the `Runner` interface with `inProcessRunner()` in `@arnilo/liveframe/preview`, and `workerRunner()` in `@arnilo/liveframe/preview/worker`.
- **Why:** every runtime change is a record, so a host keeps changes across launches by storing records. Without this, each host rebuilds packaging, versioning and reload checks (`decision-logs/2026-10-22-1539-widget-packages-and-reference-stores.md`). Runners land here because loading a stored package and rendering it is the same path that production and preview share (`decision-logs/2026-10-22-1600-preview-and-runners.md`).
- **Scope:** no storage backend beyond the two reference stores, no approval states, and no isolation sandbox: the reference runners bound time and crashes, not capabilities. `pack()` never runs widget code. The transpiler is a new runtime dependency of `/pack` only: Part B's plan picks one that is pure JavaScript and host-API-free (no WebAssembly, spec §13) and justifies it.
- **Done:**
  - A proof widget with a composed component packs into one module that the Bun test host loads and renders. Packing the same input twice gives the same hash.
  - A forbidden import, a manifest whose initial state fails its schema, a package with no scenario or a scenario that fails the manifest's schemas, and a second hash under an existing `(id, version)` each fail with a typed error.
  - `workerRunner()` returns `limit-exceeded` for a widget that never returns, then renders the next request on a fresh worker. Both runners give the same tree as `render()` for every proof scenario.
  - `loadPlacement()` rejects a tampered package, params that don't fit, and a corrupt record. It resets and reports a state that no longer fits a new widget version.
  - A test writes a package, a placement and its state with `fileStore`, opens a fresh store on the same directory, and renders the same tree.
  - `/pack`, `/store` and `/preview` pass the host-API-free scan.

### Phase 3 — CSS projection

- **Goal:** `@arnilo/liveframe/css`: three independent scoped sheets (base, theme, design system), CSS custom properties and one stable class per `(kind, variant, slot)`, with ordered state selectors.
- **Done:** switching theme or design system swaps variables atomically with no widget re-render, within 16.67 ms per switch once the container-query cache is warm — the first flip on a page pays ~17 ms building it (`proof/GAPS.md`, Plan 002 Task 5); forced-colours mode is honoured.

### Phase 4 — React renderer and preview

Two plans: Part A (the renderer), then Part B (the preview), which draws drafts with it.

**Part A — React renderer**

- **Goal:** `@arnilo/liveframe/react`: `<Surface>`, `implement()`, the startup registry check, id-keyed reconciliation, the fallback, server-side rendering, and `onIntent`.
- **Done:** the three interaction tiers work end to end against a test host; focus, scroll and local state survive re-renders.

**Part B — Preview** (spec §7.5)

- **Goal:** `createPreview()` in `@arnilo/liveframe/preview`, `<Preview>` in `@arnilo/liveframe/preview/react`, and the `liveframe preview capture` CLI command.
- **Why:** a person or an agent iterates on a widget before publishing it, and needs to see it drawn with the app's real primitives and design system (`decision-logs/2026-10-22-1600-preview-and-runners.md`).
- **Scope:** no isolation sandbox, and no storage of drafts. Playwright becomes an optional peer dependency, used only by `preview capture`, and the plan justifies it. Actions are never dispatched from a session.
- **Done:**
  - A test host mounts `<Preview>`. A scripted agent loop updates a draft with a deliberate layout error, captures it, reads the error and the screenshot, fixes the draft, and captures a clean result. The published package's hash equals the last previewed draft's.
  - Every proof scenario renders through `check()`, at three container widths, under both proof design systems.
  - A `setState` re-renders within the session, and an action intent appears in the intent log while the test dispatcher records no call.
  - Capture writes one PNG and one accessibility snapshot per requested cell, plus a JSON index. The selected cell is addressable through the URL.
  - The browser bundle contains no draft code, and `/preview` passes the host-API-free scan.

### Phase 5 — Conformance kit

- **Goal:** `@arnilo/liveframe/conformance`: shared suites for catalogs, design systems, renderers and stores (spec §7.4).
- **Done:** an app can prove its catalog, design system, renderer and store conform with one test import. `memoryStore()` and `fileStore()` both pass the store suite.

### Phase 8 — Authoring MCP server for coding agents (runs before Phase 6)

- **Goal:** `liveframe mcp`, an MCP server that helps coding agents write widgets against an app's catalog and design system. Tools: list primitives with their definitions and docs; list the declared roles and design-value names; pack a draft and render its scenarios through a preview session (spec §7.5), returning the structured pack errors and `WidgetError`s; capture a preview, wrapping `liveframe preview capture`; show the generated types. Rendering uses `workerRunner()` unless the host's configuration names its own runner.
- **Why:** agents are first-class widget authors (spec §1). Typed components and structured errors (spec §7.2) are most useful when an agent can query and run them directly.
- **Scope:** authoring time only. No tool installs, places or approves a widget, resolves real data, or runs an action: those are the app's policy (`decision-logs/2026-10-21-2017-liveframe-founding-model.md`, alternative 4). The MCP SDK is an optional peer dependency used only by `liveframe mcp`, justified in the plan; it stays out of the core.
- **Done:** a coding agent, using only the MCP tools, writes a widget with scenarios for a test host's catalog that validates and renders, fixes a deliberately invalid widget from the returned errors, and fixes a layout mistake from a captured preview.
- Decisions: `decision-logs/2026-10-22-0902-authoring-mcp-server-for-coding-agents.md` (scope); `decision-logs/2026-10-22-1836-mcp-server-in-0-1-0.md` (ships in 0.1.0).

### Phase 6 — First release (0.1.0)

- **Goal:** license chosen, docs for outsiders, a small public demo host, and publish to npm. 0.1.0 ships every subpath of spec §13 (formats, SDK, packages, storage, runners, preview, CSS, renderer and conformance) and the `liveframe mcp` server.
- **Done:** `@arnilo/liveframe@0.1.0` installs and the demo host runs from the published package. The demo host persists through `fileStore`: a widget installed, placed and given state at runtime is still there after a restart. The demo host has a preview page, and an agent following only the published docs writes a widget with scenarios, iterates on it through `liveframe preview capture` and, separately, through the `liveframe mcp` tools, then publishes it and places it.

### Phase 7 — Reference hosts

- **Goal:** Synapta and Clay adopt Liveframe. The migrations run in their own repos; this phase collects the gaps they report and fixes them here.
- **Done:** both apps render at least one production surface through Liveframe.

## 3. Execution state

- **Current phase:** Phase 3 in progress — plan 007 Tasks 1–6 complete (projection decisions, surface typography vocabulary, base/theme sheets, ordered design-system state rules, responsive style-prop projection, overlay entry and preference/switch overrides); Tasks 7–12 remain. Phase 2 implementation is delivered: plan 005 (Part A) still needs Task 10's impact analysis; plan 006 (Part B) is complete. Plan 002 Task 9's owner gate remains recorded separately.
- **Next free plan number:** 008.

One line per plan. Detail lives in the plan file, never here.

| Plan | Phase | Status |
| --- | --- | --- |
| [001](plans/001-Phase-0-Primitive-Set-Proof.md) | 0 | complete (conditional go; closed by plan 002) |
| [002](plans/002-Phase-0-Parity-Re-Proof.md) | 0 | in progress (Task 8 approved: Phase 0 is go; Task 9 remains) |
| [003](plans/003-Phase-1-Part-A-Formats.md) | 1 | complete (Tasks 1–9; findings disposed in the impact analysis and backlog) |
| [004](plans/004-Phase-1-Part-B-Compiled-Validator.md) | 1 | complete (Tasks 1–7; findings disposed in the impact analysis and backlog) |
| [006](plans/006-Phase-2-Part-B-Packages-Storage-Runners.md) | 2 | complete (Tasks 1–12; findings disposed in the impact analysis and backlog) |
| [007](plans/007-Phase-3-CSS-Projection.md) | 3 | in progress (Tasks 1–6 complete; Tasks 7–12 remain) |
