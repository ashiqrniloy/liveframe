# Runners and preview

## Target

Spec §7.5 (runners and preview), §7.3 (scenarios). Roadmap Phase 2 Part B (runners), Phase 4 Part B (preview). Decision: `decision-logs/2026-10-22-1600-preview-and-runners.md`.

- `Runner.render(pkg, inputs, options)` returns a validated tree or a `WidgetError`, and enforces a per-render time limit (default 100 ms → `limit-exceeded`).
- `inProcessRunner()` (`/preview`) is for tests and trusted code. `workerRunner()` (`/preview/worker`) terminates a worker on a timeout or crash and continues on a fresh one.
- `createPreview({ catalog, runner, styles, sourceSchemas? })` returns a session:
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

Not built.
