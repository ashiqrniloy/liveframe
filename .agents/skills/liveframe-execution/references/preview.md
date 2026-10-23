# Runners and preview

## Target

Spec §7.5 (runners and preview), §7.3 (scenarios). Roadmap Phase 2 Part B (runners), Phase 4 Part B (preview). Decision: `decision-logs/2026-10-22-1600-preview-and-runners.md`.

- `Runner.render(pkg, inputs, options)` returns a validated tree or a bounded `LiveframeError[]` in `Result<UiTree>`, and enforces a per-render time limit (default 100 ms → `limit-exceeded`).
- `inProcessRunner()` (`/preview`) is for tests and trusted code. `workerRunner()` (`/preview/worker`) terminates a worker on a timeout or crash and continues on a fresh one.
- `createPreview({ catalog, capabilities, runner, styles })` returns a session:
  - `update(draft)` packs the draft without storing it.
  - `render({ scenario, context?, state? })` renders it.
  - `intent()` updates session state on `setState`. An action goes to the intent log and is never dispatched.
  - `check()` renders every scenario.
- `<Preview>` (`/preview/react`) is mounted by the app in its own page. It shows a matrix of scenario × width × theme × design system, the intent log and errors on their nodes, with the selected cell in the URL (`scenario`, `width`, `theme`, `designSystem`).
- `liveframe preview capture <url>` drives a headless browser (Playwright, an optional peer dependency) over the requested cells and writes a PNG and an accessibility snapshot per cell, plus a JSON index.

Rules:
- No isolation sandbox in the library. Never describe a reference runner as a security boundary.
- Preview and production use the same runner. A published package's hash equals the last previewed draft's.
- Draft code never reaches the browser (law 1). Test it with a bundle scan.
- `liveframe mcp` (roadmap Phase 8, ships in 0.1.0) wraps sessions and capture as authoring tools. It never installs, places, approves or dispatches.
- Prior art: `proof/host/` (scenarios, sizes, design-system switch, logged actions) and `proof/scripts/parity.ts` (Playwright capture).

## Today

- Shipped runner half: `/preview` exports `inProcessRunner()` and types `Runner`, `RunnerOptions`; `/preview/worker` exports `workerRunner({ timeoutMs? })` returning a runner plus `close()`.
- `Runner.render(pkg, inputs, options)` returns `Promise<Result<UiTree>>`; inputs are SDK `WidgetProps`. Options require `catalog`, `capabilities`, `surfaceId`, `revision`, with optional SDK `limits` and `timeoutMs` (default 100 ms). Reference runners do not verify packages: use `verifyPackage` or `loadPlacement` first.
- In-process rendering caches modules by hash and validators by catalog identity, capabilities identity and hash. It reports slow code after it returns and cannot interrupt a loop. The worker serializes requests, terminates on deadline/crash, and starts fresh on the next request; the deadline includes startup. Per-render timeout overrides the worker default. `close()` settles active, queued and future calls as `render-failed`.
- Neither runner restricts code access. Run on the backend only, with trusted code or an app-supplied isolated runner. Only `src/preview/load.ts` may use dynamic import: canonical linker SDK headers resolve from the library installation, then a percent-encoded `data:` URL escapes dots as `%2E`. Non-canonical SDK imports remain bare; use packer output. Source-checkout loading is proved on Bun 1.4.2; published loader/worker resolution remains a Phase 6 gate.
- Outsider guide: `docs/packages.md`. Tests: `runner-in-process.test.ts`, `runner-worker.test.ts`, `preview-load.test.ts`, `phase-2-loop.test.ts`; browser portability scans cover the host-free entry without executing widgets there.
- Preview sessions, `<Preview>` and capture are not built; they remain Phase 4 Part B.
