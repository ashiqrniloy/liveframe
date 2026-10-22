# Phase 0: primitive-set proof

## Target

Spec §12, roadmap Phase 0, plan 001. The question to answer: can a small primitive set, plus recipes and style props, express real product UI with no product-shaped components?

The four reference UIs:
1. Synapta's agent-home queue, matching the approved design: focus card with task and alert controls, row selection, three-cursor "load more".
2. Synapta's `core.queue` widget at `small`, `medium`, `large` and `full`.
3. Clay's git status panel and one Rack module panel.
4. One widget under both Certified and Rack, with no widget-code change.

Source material (read-only, outside this repo):
- Synapta (`/home/arn/Projects/synapta-core`):
  - `design-artifacts/approved/agent-home-certified.html`: the `core.queue` widget (lines 1137–1245), the focus cards (1247–1320), the states (1324–1357) and the escalate dialog (1368–1383), as of commit `91de29ed`
  - `product-modules/ui/core/widgets/queue/`
  - `plans/200.4-SdkComponentsRendererAndQueue.md` T4b (the blocker)
  - the Certified tokens and styles: `web/app/styles/certified.css`
- Clay (`/home/arn/Projects/clay`):
  - `packages/git/src/status.ts` (`buildGitStatusTree`)
  - `packages/design-rack/package.json` (`uiDesignSystem`); Rack holds no colour or typography, so its theme comes from `packages/theme-modus-operandi`
  - the Rack module: `design-artifacts/approved/apps-and-containers-rack/index.html:1279–1323` (`agent-info`)
  - `crates/clay-server/src/shell/components.rs` (`ComponentKind`)

Rules:
- Copy what the proof needs into `proof/references/`, and record each source's commit SHA in `proof/references/SOURCES.md`. Never import across repos.
- Proof code is proof-grade. Build only what the four UIs need from the SDK, validator, renderer and CSS projection.
- A new primitive is allowed only after its gap is recorded, with the reason it could not be composed.
- Widget code uses tokens and roles only: no literal colours, no raw CSS.
- Pixel and DOM evidence stays local (`/evidence/`, gitignored). The report names the script that regenerates it.

Done means `proof/REPORT.md`: the final primitive list with definitions, the style props needed, the gaps and how each was resolved, and a go/no-go. The spec is updated with what changed.

## Today

**Phase 0 is done: go** (`decision-logs/2026-10-22-1519-phase-0-go.md`). Plans 001 and 002 built the four UIs, the proof SDK, validator, projection, renderer and host in `proof/` (`bun run proof`), and re-proved the approved design to **0.72% / 0.75% / 0.97%** of pixels at 1440 / 1024 / 390 px against the ≤ 1% bar. `proof/PARITY.md` holds the approved inventory of every remaining difference; `proof/REPORT.md` holds the definitions, the style-prop domains, the gap resolutions, the verdict and the budgets; `proof/GAPS.md` holds the numbered gaps.

Proof code is a museum piece, not a library: `src/` never imports it, and Phase 1 rewrites the formats, validator and projection for real. Two things are still worth reading before touching `proof/`:
- **The parity evidence is regenerable and cheap**: `bun proof/scripts/parity.ts --out evidence/parity` for the capture and diff, `bun proof/scripts/inventory.ts --dir evidence/parity` for the same capture grouped into causes. Images stay local under `/evidence/`.
- **One budget does not hold**: the render bench (`proof/GAPS.md` G32). The artifact's row needs 13.6 nodes, and the proof's render+validate path costs 8.5 µs per node, so 50 rows take 5.75 ms against 2 ms. Phase 1's exit criterion is ≤ 3 µs per node on the same benches; do not "fix" it in `proof/` by shrinking the tree — the pixel bar depends on that tree.

If a later phase needs a proof behaviour as prior art, copy the test, not the code: the conformance suites are seeded from `proof/tests/` (backlog, P3).
