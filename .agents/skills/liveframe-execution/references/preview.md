# Runners and preview

## Target

Spec §7.5 (runners and preview), §7.3 (scenarios). Roadmap Phase 2 Part B (runners), Phase 4 Part B (preview). Decision: `decision-logs/2026-10-22-1600-preview-and-runners.md`.

- `Runner.render(pkg, inputs, options)` returns a validated tree or a bounded `LiveframeError[]` in `Result<UiTree>`, and enforces a per-render time limit (default 100 ms → `limit-exceeded`).
- `inProcessRunner()` (`/preview`) is for tests and trusted code. `workerRunner()` (`/preview/worker`) terminates a worker on a timeout or crash and continues on a fresh one.
- `createPreview({ catalog, capabilities, runner })` returns a session (no styles: trees don't depend on them):
  - `update(draft)` packs the draft without storing it and returns `Result<WidgetPackage>`; publishing stores exactly that package. Success resets the current scenario, state and log; failure keeps the previous package and session state.
  - `render({ scenario, context?, state? })` selects the current scenario and returns `Promise<Result<UiTree>>`, with `LiveframeError`s carrying `nodeId` when attributable to a node. State comes from the argument, scenario or manifest `initialState`, in that order; context comes from the argument or scenario. The session has a fixed `surfaceId` and increases revision on every render.
  - `intent()` re-checks state keys and values against the manifest before updating and re-rendering. It checks actions against the manifest and capability schema (`checkValue`), then logs them and returns the current tree unchanged. It returns `Promise<Result<UiTree>>`; invalid intents change nothing, and actions are never dispatched.
  - `intents()` returns `readonly Intent[]`.
  - `check()` renders every scenario from its own initial state without changing the current scenario or state and returns each `{ scenario, result }`.
- `<Preview>` (`/preview/react`) is mounted by the app in its own page. The host passes the selected scenario's result and intent log and handles `onSelect(cell)` / `onIntent(intent)`. The component draws every width × theme × design-system combination as sibling surfaces through `createRenderer`; width and style changes reuse the tree. Selection is highlighted and mirrored in the URL (`scenario`, CSS-pixel `width`, `theme` and `designSystem` as `id@version`). Errors list `nodeId` when present and `pointer`; an earlier successful tree for that scenario is dimmed and labelled "last good render", with `data-lf-error` on matching nodes, or the host fallback is shown. The retained tree still passes through `<Surface>`'s arrival check. Contracts: spec §7.5 and `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md`, plan 009 Task 1 refinements.
- Capture contract: `data-lf-preview` publishes JSON axes, each sized `data-lf-cell` container publishes JSON coordinates, and `data-lf-ready` marks every cell mounted with the current result and errors. See spec §7.5 for the exact shapes.
- `liveframe preview capture <url> [--scenario <a,b>] [--width <n,m>] [--theme <id@v,…>] [--design-system <id@v,…>] --out <dir>` uses headless Chromium (Playwright, an optional peer). It captures all declared cells unless flags narrow them, navigating once per scenario. It writes each cell's PNG and YAML accessibility snapshot (`.aria.yml`) and `index.json` with URL, coordinates, relative paths and errors, as specified in §7.5.

Rules:
- No isolation sandbox in the library. Never describe a reference runner as a security boundary.
- Preview and production use the same runner. A published package's hash equals the last previewed draft's.
- Draft code never reaches the browser (law 1). Test it with a bundle scan.
- `liveframe mcp` (roadmap Phase 8, ships in 0.1.0) wraps sessions and capture as authoring tools. It never installs, places, approves or dispatches.
- Spec §13 limits dynamic import to the package loader across library subpaths; the CLI may lazily load command-specific optional peers so `liveframe gen` works without Playwright or the MCP SDK.
- Prior art: `proof/host/` (scenarios, sizes, design-system switch, logged actions) and `proof/scripts/parity.ts` (Playwright capture).

## Today

- Shipped runner half: `/preview` exports `inProcessRunner()` and types `Runner`, `RunnerOptions`; `/preview/worker` exports `workerRunner({ timeoutMs? })` returning a runner plus `close()`.
- `Runner.render(pkg, inputs, options)` returns `Promise<Result<UiTree>>`; inputs are SDK `WidgetProps`. Options require `catalog`, `capabilities`, `surfaceId`, `revision`, with optional SDK `limits` and `timeoutMs` (default 100 ms). Reference runners do not verify packages: use `verifyPackage` or `loadPlacement` first.
- In-process rendering caches modules by hash and validators by catalog identity, capabilities identity and hash. It reports slow code after it returns and cannot interrupt a loop. The worker serializes requests, terminates on deadline/crash, and starts fresh on the next request; the deadline includes startup. Per-render timeout overrides the worker default. `close()` settles active, queued and future calls as `render-failed`.
- Neither runner restricts code access. Run on the backend only, with trusted code or an app-supplied isolated runner. Only `src/preview/load.ts` may use dynamic import: canonical linker SDK headers resolve from the library installation, then a percent-encoded `data:` URL escapes dots as `%2E`. Non-canonical SDK imports remain bare; use packer output. Source-checkout loading is proved on Bun 1.4.2; published loader/worker resolution remains a Phase 6 gate.
- Outsider guides: `docs/packages.md` and `docs/preview.md`. Tests: `runner-in-process.test.ts`, `runner-worker.test.ts`, `preview-load.test.ts`, `phase-2-loop.test.ts`; browser portability scans cover the host-free entry without executing widgets there.
- Shipped preview half: `createPreview()`, `<Preview>`, the proof host's `/preview` page, and `capture(url, options)` in `src/cli/capture.ts` behind `liveframe preview capture` (lazy optional `playwright` peer; exit 1 on render errors or a missing peer, 2 on usage errors). Tests: `preview-session`, `preview-react`, `preview-capture`, `proof/tests/preview-browser.test.ts`. The scripted agent loop is `preview-agent-loop.test.ts`; the outsider guide is `docs/preview.md`, with its example run by `preview-guide.test.ts`. Phase 8's `liveframe mcp` calls `createPreview()` and `capture()` directly.
