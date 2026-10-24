# Phase 4 Part B: Preview

## Objectives

- Ship the preview loop of spec §7.5: `createPreview()` in `@arnilo/liveframe/preview`, `<Preview>` in `@arnilo/liveframe/preview/react`, and `liveframe preview capture`.
- Keep the loop on the production path. A session packs drafts with `pack()` and renders them through the host's `Runner`. Publishing stores exactly the package the session returned. The browser receives only trees.
- Keep preview free of side effects. `setState` stays in the session, and actions are logged and never dispatched.
- Give agents a captured, addressable view of every preview cell (PNG, accessibility snapshot, errors, JSON index), and prove the loop with a scripted agent that fixes a deliberate error from its own capture.

## Expected Outcome

- `createPreview({ catalog, capabilities, runner })` returns a session with `update(draft)` returning `Result<WidgetPackage>`, async `render({ scenario, context?, state? })` and `intent(intent)` returning `Result<UiTree>`, `intents()` returning `readonly Intent[]`, and async `check()` returning each scenario's typed result.
- `<Preview>` draws the selected scenario's tree in every width × theme × design-system cell, as sibling surfaces. It shows the intent log and the errors by node, and keeps the selected cell in the URL (`scenario`, `width`, `theme`, `designSystem`).
- `liveframe preview capture <url>` writes one PNG and one accessibility snapshot per requested cell, plus `index.json`, using the optional `playwright` peer.
- On the proof host's preview page, a scripted agent loop works end to end:
  - it updates a draft with a deliberate error, captures it, and reads the error and the PNG;
  - it fixes the draft and captures a clean result;
  - it publishes, and the stored package hash equals the last previewed one.
- Every proof scenario passes `check()`. Each is drawn in `<Preview>` at three container widths under both proof design systems. A `setState` re-renders within the session. An action appears in the log while the test dispatcher records no call. The browser bundle and the captured HTML contain no draft code. `/preview` stays host-API-free.

This plan implements roadmap Phase 4 Part B: spec §7.5 (preview sessions, `<Preview>`, capture), the `/preview`, `/preview/react` and CLI rows of §13, and the preview rules of `decision-logs/2026-10-22-1600-preview-and-runners.md` and `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md` (decisions 7–9). Task 1's refinements were approved by the owner's instruction to complete that task and are recorded in the decision log and spec.

**Depends on:** plan 008 (Part A) complete. `<Preview>` draws through `createRenderer`, and the preview page lives on the proof host plan 008 Task 7 moves onto packages, the runner and `/react`.

**Not in this plan:**
- `liveframe mcp` (Phase 8), which later wraps sessions and capture. Task 5 keeps capture callable as a function so Phase 8 does not shell out.
- Draft storage, approval flows and an isolation sandbox (spec §14).
- Previewing with live data. The app may do it (spec §7.5); this plan uses scenarios.

Probe answers that hold for every task, unless a task says otherwise:
- **Placement:**
  - `createPreview` lives in `src/preview/` and stays host-API-free. It imports `/pack` (sucrase and acorn are already allowed there) and the root export.
  - `<Preview>` lives in `src/preview/react/`, a React and DOM host-API exception like `/react`.
  - Capture lives in `src/cli/`. The CLI is outside the scan (`src/__tests__/portability.test.ts:57`).
- **Four laws:**
  - Law 1 is the centre of this plan: draft code runs only in the runner on the backend, and a bundle and HTML scan proves none reaches the browser.
  - Law 2: `<Preview>` re-checks trees through `<Surface>`.
  - Law 3: unchanged.
  - Law 4: preview never dispatches an action. The intent log holds requests, and a dispatcher spy proves no call.
- **Primitives only:** `<Preview>` is library chrome (cell grid, intent log, error list), not a catalog primitive. It holds no app look: it uses plain elements with minimal structural CSS and no colour, under the host's own page styles. The cells draw with the app's primitives.
- **Dependencies:** `playwright` becomes an optional peer dependency used only by `liveframe preview capture` (spec §13). It is already a dev dependency at 1.64.1. Task 6 justifies it. No new runtime dependency.
- **Reference hosts:** Synapta plugs its isolated runner into `createPreview`, which is the same runner it uses in production (`plans/backlog.md`, "Hand adopter gaps to Synapta and Clay"). Clay mounts `<Preview>` in its desktop shell.
- **Performance:** no new budget, since preview is an authoring path. Session renders cost what the runner costs (`src/__tests__/runner-in-process.test.ts` overhead). Task 4 records the time to draw a 12-cell matrix of the 679-node agent-home tree, and Task 5 records capture time per cell.
- **SDK data caveat:** until the backlog item "Scope SDK data validation caching to the source-schema contract" (P1, plan 005 F2) lands, a session hands the runner a fresh copy of scenario data on every render (`docs/sdk.md`). The fix landed after this plan and the copy was dropped: the session now passes the package's own scenario objects, which the SDK freezes in place.

## Tasks

- [x] Task 1: Pin the preview details the decisions left open, and write them into the spec
  - Acceptance Criteria:
    - Functional:
      - The owner approves, or amends, these details. They are recorded as a "Planning refinements (plan 009 Task 1)" section in `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md` (owner approval to amend the log is part of the same answer), and spec §7.5 and §13 are updated to match:
        1. **Typed results.** Async `render()` returns `Result<UiTree>` whose `LiveframeError`s carry `nodeId` when attributable to a node. There is no library `WidgetError` type; spec §7.5 and roadmap Phase 8 use the existing type.
        2. **Session state.**
           - `render({ scenario, context?, state? })` selects a scenario by name and makes it the session's current scenario. Its state is the argument's, else the scenario's, else the manifest's `initialState`. The revision increases on every render, and `surfaceId` is fixed per session.
           - `intent(intent)` re-checks a `setState` key and value against the manifest state schema, then re-renders (`Result<UiTree>`). It re-checks an action against the manifest and the capability schema (`checkValue`), then appends it to the log and returns the current tree unchanged.
           - `intents()` returns the log.
           - A successful `update()` resets the current scenario, state and log; a failed pack preserves the previous package and session state.
        3. **The matrix.**
           - `<Preview>` draws the selected scenario's tree in every cell of `widths × themes × designSystems`, as sibling surfaces. A tree does not depend on width or styles, so only scenario changes need the host.
           - The selected cell is highlighted, mirrored in the URL (`scenario`, `width` in CSS px, `theme` and `designSystem` as `id@version`), and reported through `onSelect`.
           - Each cell is a sized container element with `data-lf-cell` naming its coordinates.
        4. **Errors on their node.** A failed render lists each error with its `nodeId` when present and `pointer`. If an earlier tree for the same scenario rendered, it is drawn dimmed and labelled "last good render", and nodes whose `id` matches an error get `data-lf-error`. Otherwise show the host fallback. The retained tree still passes through `<Surface>`'s arrival check. (Approved: the recommended last-good-render option.)
        5. **Capture.**
           - `liveframe preview capture <url> [--scenario <a,b>] [--width <n,m>] [--theme <id@v,…>] [--design-system <id@v,…>] --out <dir>` captures every cell the page declares (`<Preview>` publishes its axes in `data-lf-preview`) unless flags narrow it.
           - It writes `<dir>/<cell>.png`, `<dir>/<cell>.aria.yml` and `<dir>/index.json`:
             ```json
             { "url": "…", "cells": [{ "scenario": "…", "width": 360, "theme": "…", "designSystem": "…", "png": "…", "snapshot": "…", "errors": [] }] }
             ```
        6. **CLI loading.** Spec §13's single-`import(` rule is restated for the library subpaths. The CLI may lazily import its optional peers (`playwright` now, the MCP SDK in Phase 8), so `liveframe gen` runs without them installed.
      - The roadmap's Phase 8 goal says "`LiveframeError`s" instead of "`WidgetError`s". The `preview.md` skill reference matches.
    - Performance: n/a — no code.
    - Code Quality: the spec states each rule once, with no internal names.
    - Security: law 1 (cells draw trees only) and law 4 (the log never dispatches) are stated normatively.
  - Approach:
    - Skills to Use:
      - `create-decision-log` — owner approval before amending the log.
      - `liveframe-execution` — the preview reference.
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64.1 `locator.ariaSnapshot()` (YAML; `mode`, `depth`, `boxes`) and `locator.screenshot()` (Context7 `/microsoft/playwright/v1.63.0`, the newest indexed; verify against the installed 1.64.1 types).
    - Documentation Reviewed:
      - Spec §7.3, §7.5, §13; `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md`.
      - `src/preview/runner.ts`, `src/pack/pack.ts:8–16`, `src/formats/package.ts:12–28` (`Scenario`, `WidgetPackage`), `src/schema.ts` (`checkValue`).
      - `proof/host/README.md`: the proof's `?scenario=` and `?size=` prototype.
    - Options Considered:
      - Keep session state across `update()` — rejected: a new draft may change the state schema; resetting is simpler and always valid.
      - Only the selected cell drawn — rejected: the matrix and "sibling cells" acceptance need every width and style combination visible at once, and trees are style-independent.
      - Capture by navigating to each cell's URL — rejected for width and style axes (one page load per scenario is enough). Kept for the scenario axis.
    - Chosen Approach:
      - The owner's instruction to complete this task approves its listed refinements and amendment of the log, as for plan 008 Task 1. Edit the log, spec, preview reference and roadmap together.
    - API Notes and Examples:
      ```ts
      const session = createPreview({ catalog, capabilities, runner });
      const pkg = session.update(draft);                     // Result<WidgetPackage>
      const tree = await session.render({ scenario: "ready" }); // Result<UiTree>
      await session.intent({ type: "setState", key: "filter", value: "mine" });
      session.intents();                                     // readonly Intent[]
      await session.check();                                 // { scenario, result }[]
      ```
    - Files to Create/Edit:
      - `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md`: refinements.
      - `docs/spec.md` §7.5, §13; `roadmap.md` Phase 8 goal and §3 execution status.
      - `.agents/skills/liveframe-execution/references/preview.md`.
      - This plan: approved contracts, execution notes and Task 1 completion.
  - Test Cases to Write:
    - n/a — documentation; run `bun run check` and `git diff --check`.
  - Notes (executed 2026-10-24):
    - The owner's instruction to complete Task 1 approved its six listed refinements and amendment of the decision log, following plan 008 Task 1's precedent. Recorded them under "Planning refinements (plan 009 Task 1)" and updated spec §7.5 / §13, the preview skill reference, the Phase 8 error type and roadmap §3.
    - Selected the recommended dimmed "last good render" display, scoped to the same scenario and still checked by `<Surface>`. Task 3's test now names that choice without the list-only alternative.
    - Matched the actual public types: rendering and intents are async `Result<UiTree>` calls; node-attributable errors carry `nodeId`, while session/package errors may omit it. Corrected the Expected Outcome's blanket claim that every method returns a `Result` (`intents()` returns the log and `check()` returns per-scenario results).
    - Verified Playwright through Context7 `/microsoft/playwright/v1.63.0` (newest indexed) and installed 1.64.1 declarations: element PNG screenshots and full default YAML ARIA snapshots are supported, including optional `mode`, `depth` and `boxes`; no extra capture options added.
    - `timeout 600s bun run check` passed: generated types, typecheck, lint, format and all 432 tests (0 failures). `git diff --check` passed. No runtime code or dependencies changed; session, UI and capture implementation remain Tasks 2–8.

- [x] Task 2: Build preview sessions on `pack()` and the runner
  - Acceptance Criteria:
    - Functional:
      - `createPreview({ catalog, capabilities, runner })` is exported from `@arnilo/liveframe/preview`.
      - `update(draft)` calls `pack(draft, { catalog, capabilities })` and returns its `Result<WidgetPackage>` unchanged. A pack failure keeps the previous package, so the session still renders it, and returns the errors (`forbidden-import`, `transpile-failed`, `invalid-document` for missing scenarios).
      - `render`, `intent`, `intents` and `check` follow Task 1, refinement 2. Calling them before a successful `update` returns `not-found`. An unknown scenario returns `not-found` with pointer `/scenario`.
      - A `setState` with an undeclared key or a value outside the schema, and an action not in the manifest or with args outside its capability schema, return `invalid-prop` or `undeclared-action` and change nothing.
      - `check()` renders every scenario of the package, each from its own initial state, without changing the current scenario or state.
      - Each render gives the runner a fresh copy of the scenario's data (SDK caveat).
      - Publishing: `store.putPackage(pkg)` followed by `loadPlacement` and the same runner renders a tree equal to the session's for the same scenario and state, and `pkg.hash` is the stored hash.
    - Performance: no added walk of the tree. The session passes the runner's result through.
    - Code Quality: one closure-based factory in `src/preview/session.ts`, under 150 lines. No class hierarchy and no cache beyond the current package.
    - Security:
      - Law 1: drafts run only through `runner`.
      - Law 4: no dispatcher exists in the session API. Actions only append to the log.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (preview, storage) and `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - none — local contracts (`pack`, `Runner`, `Store`).
    - Documentation Reviewed:
      - `src/pack/pack.ts:8–16`, `src/preview/{runner.ts,in-process.ts:15–58}`, `src/store/index.ts:13–26`, `src/store/load.ts`.
      - `src/__tests__/phase-2-loop.test.ts:78–140`: pack, store, reload and render on both runners.
      - `plans/backlog.md`, "Build preview sessions on the shipped package and runner contracts", "Scope SDK data validation caching to the source-schema contract".
    - Options Considered:
      - Verify the package again before rendering (`verifyPackage`) — rejected: the session packed it itself, and `pack()` already validates scenarios against the manifest.
      - Compile a validator in the session — rejected: the runner compiles it (spec §7.5).
    - Chosen Approach:
      - A thin state machine over `pack()` and `runner.render()`, with intent re-checks through `checkValue`.
    - API Notes and Examples:
      - As in Task 1. `check()` returns `Promise<Result<readonly { scenario: string; result: Result<UiTree> }[]>>`: the outer result reports a missing package, and each inner result reports its scenario's render. `intents()` returns an empty array before an update or any logged action.
    - Files to Create/Edit:
      - `src/preview/session.ts`: new; `src/preview/index.ts`: export.
      - `src/__tests__/portability.test.ts`: `preview` entry gains `dependencies: true` (it now bundles `/pack`).
      - `src/__tests__/exports.test.ts`: `/preview` surface.
      - `src/__tests__/preview-session.test.ts`: new.
      - `roadmap.md` §3: Task 2 execution status.
  - Test Cases to Write:
    - `update_returns_the_packed_package_or_pack_errors`: the previous package survives a failed update.
    - `render_selects_scenario_state_and_increments_revision`.
    - `set_state_rerenders_within_the_session`; `invalid_set_state_changes_nothing`.
    - `action_is_logged_and_never_dispatched`: the log grows by the re-checked action and the tree is unchanged; the host-side dispatcher spy is Task 4's. `undeclared_or_invalid_action_is_rejected`.
    - `check_renders_every_scenario_without_changing_current_state`.
    - `every_proof_scenario_passes_check`: all four proof widgets (plus the harness) on `inProcessRunner()` and `workerRunner()`.
    - `published_package_matches_the_last_preview`: same hash, and an equal tree after `memoryStore` and `loadPlacement`.
    - `scenario_data_is_fresh_per_render`: a render that would mutate data (frozen input) cannot affect the next one.
    - `preview_bundles_without_host_apis` (existing `host_api_free_subpaths_bundle_clean: preview`).
    - `runner_errors_pass_through_including_node_ids`; `pending_render_cannot_restore_a_session_reset_by_update`.
  - Notes (executed 2026-10-24):
    - Exported `createPreview()` from `/preview`, implemented as a 131-line closure over the existing `pack()` and `Runner`. Failed updates preserve the package, selected scenario, state and action log; successful updates reset selection and log while preserving the session's surface id and increasing revision sequence.
    - State intents re-check the declared key and value; completed actions re-check manifest membership and capability args, append an isolated log entry, and return the current runner result without calling the runner or dispatching. Unknown scenarios and sessions without a draft/current render return pointed `not-found` errors. `intents()` stays an array; `check()` uses an outer `Result` for its missing-draft error.
    - Every runner call receives copied inputs, including fresh scenario data for the SDK cache caveat. Results and node-attributable errors pass through unchanged; scenario checks preserve current selection, state, context and result. A late result cannot restore a selection reset by `update()`.
    - Added ten session tests, including every scenario of all four proof widgets and the harness through both reference runners, frozen mutation attempts, invalid intents, and publish/reload hash and tree equality. Updated the export pin and enabled the existing packer-dependency allowance in the `/preview` portability scan.
    - Tests were written first and initially failed on the missing export. `timeout 600s bun run check` passed: generated types, typecheck, lint, format and all 442 tests (0 failures). No spec meaning or dependency changes. Preview UI, host wiring, capture and outsider documentation remain Tasks 3–7.

- [x] Task 3: Add `<Preview>` in `/preview/react`
  - Acceptance Criteria:
    - Functional:
      - `package.json` exports `./preview/react`.
      - `<Preview scenarios widths themes designSystems result intents renderer validator fallback onSelect onIntent />`:
        - reads the selected cell from the URL (`URLSearchParams` on mount; defaults are the first of each axis);
        - writes it back with `history.replaceState`;
        - draws Task 1, refinement 3's matrix with `renderer.Surface` per cell, each in a container sized to its width;
        - lists `intents`;
        - lists errors per Task 1, refinement 4;
        - calls `onSelect(cell)` on every change and `onIntent` for cell intents.
      - `data-lf-preview` holds the axes as JSON, and `data-lf-ready` is set once every cell has mounted, both for capture.
      - Cells are siblings, never nested surfaces. A responsive tree resolves against each cell's width, not the viewport.
    - Performance: record, in Task 4, the time to draw 12 cells of the 679-node agent-home tree.
    - Code Quality:
      - Plain elements and a few structural rules (grid, sizes), with no colour, font or theme value: the host page owns chrome look.
      - No React context.
      - Under 200 lines.
    - Security:
      - Law 1: `<Preview>` takes trees and results only; its props carry no code.
      - Law 2: every cell re-checks through `<Surface>`.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (preview, renderer); `find-docs` — React 19.3 effects for URL sync.
    - Library Documentation to Check Before Implementation:
      - React 19.3 `useSyncExternalStore` or `useEffect` for URL state (`/reactjs/react.dev`).
    - Documentation Reviewed:
      - Spec §6.4 (sibling surfaces, container widths), §7.5, §11.
      - `src/__tests__/css-scope-browser.test.ts` (sibling-surface isolation), `src/react/renderer.tsx` (plan 008).
    - Options Considered:
      - A router dependency for URL state — rejected: four query parameters need `URLSearchParams` and `replaceState` only.
      - Styling preview chrome with the app's design system — rejected: chrome is not a widget tree, and law 3 keeps the library from shipping visual style.
    - Chosen Approach:
      - A controlled component: the host owns data and transport, `<Preview>` owns layout and URL.
      - Non-empty axes are typed as tuples. Read the URL on mount, preserve unrelated query parameters and the hash, and notify the host after initialization. A scenario change waits for a new result identity before publishing readiness; width/style selection reuses the tree. The host supplies the initial URL scenario's result and ignores obsolete transport responses.
      - Retain successful results per scenario. Optional renderer diagnostics add `display: contents` node wrappers for error markers; ordinary surfaces retain their existing markup. Document that child selectors still see these wrappers.
    - API Notes and Examples:
      ```tsx
      <Preview scenarios={["ready", "empty"]} widths={[360, 768, 1280]}
        themes={[certified, rack]} designSystems={[certifiedDs, rackDs]}
        result={result} intents={log} renderer={renderer} validator={validator}
        fallback={<p>Unavailable</p>} onSelect={select} onIntent={send} />
      ```
    - Files to Create/Edit:
      - `src/preview/react/index.ts`, `src/preview/react/preview.tsx`: new.
      - `package.json`: `exports`.
      - `src/__tests__/portability.test.ts`: `preview/react` entry with the same DOM and React exception as `react/`.
      - `src/__tests__/exports.test.ts`.
      - `src/__tests__/preview-react.test.tsx`: new (server-rendered structure and Chromium effects/interactions).
      - `src/__tests__/fixtures/preview-client.tsx`: browser fixture for URL, readiness, error recovery, arrival validation, intents and responsive container widths.
      - `src/react/renderer.tsx`, `docs/renderer.md`: optional node diagnostics prerequisite and its DOM contract.
      - `roadmap.md` §3: Task 3 execution status.
  - Test Cases to Write:
    - `preview_draws_every_cell_as_sibling_surfaces`.
    - `selected_cell_round_trips_through_the_url`.
    - `errors_list_by_node_and_mark_the_last_good_tree`.
    - `intent_log_lists_every_entry`.
    - `preview_axes_and_ready_are_published_for_capture`.
    - `retained_tree_still_passes_surface_arrival_validation`; responsive gaps follow each cell's container width, and portal mounting finishes before readiness is observed.
  - Notes (executed 2026-10-24):
    - Implemented `/preview/react` with typed `PreviewProps` / `PreviewCell`, sibling width × theme × design-system surfaces, mount-only URL initialization, preserved query/hash/history state, selection callbacks, intent forwarding and the intent log. The component is 184 lines and adds no dependency or React context.
    - Successful results are retained per scenario; failures list pointers and node ids and dim/label the retained tree. Optional `<Surface diagnostics>` adds node/error markers through `display: contents` wrappers without changing ordinary surface markup. Retained trees still pass arrival validation; `docs/renderer.md` documents the child-selector caveat.
    - Published JSON axes, cell coordinates and per-cell `data-lf-errors`; readiness is withheld during scenario transitions and set after the current result commits. Task 4 now records the host's responsibility to fetch only scenario changes, supply fresh result objects and discard obsolete responses.
    - Tests were written first and initially failed on the missing subpath export. The focused preview/renderer/export/portability run passed 26 tests; all six preview tests also passed in each full run, covering SSR, URL initialization/defaults, selection, intent forwarding, last-good recovery, retained-tree arrival validation, container-responsive gaps and capture metadata/readiness.
    - Generated types, typecheck, lint, format and `git diff --check` passed. Three `timeout 600s bun run check` attempts failed existing timing/deadline gates (434/14, 433/15 plus one browser error, and 428/20 passing/failing tests). Failures include hashing/bundling/validation budgets, CSS switch frame budgets and runner renders exceeding 100 ms. Machine load exceeded 100 during verification; unrelated builds and VMs were active. Logs: `/tmp/liveframe-plan009-t3-check.log`, `/tmp/liveframe-plan009-t3-recheck.log`, `/tmp/liveframe-plan009-t3-final-check.log`.
    - Follow-up verification, authorized by the owner's instruction “Run the timing tests again. If confirmed that it is happening because of heavy load, close task 3”: the unchanged implementation's full check passed generated types, typecheck, lint, formatting and 447/448 tests in 76.04 s. All six preview tests and the previous runner, hashing, bundling and validator failures passed. Agent-home and git-status CSS switches peaked at 6.9 and 6.1 ms; warm runner overhead was 0.0178 ms. The only failure was `switch_under_budget_with_blur_through_surface`: 23 ms against 16.67 ms.
    - Compared that remaining test with an isolated checkout of pre-Task-3 commit `f195f82a409ffd05292b2a26ba6fe5182456f50d`, using the same installed dependencies and unchanged test/limits. Baseline failed at 22.7 ms; the current tree's isolated rerun failed at 26 ms, with most samples around 10–14 ms. Both drew 685 DOM nodes. Command in each checkout: `timeout 120s bun test src/__tests__/react-browser.test.tsx -t switch_under_budget_with_blur_through_surface`. Logs: `/tmp/liveframe-plan009-t3-load-retry.log`, `/tmp/liveframe-plan009-t3-baseline-timing.log`, `/tmp/liveframe-plan009-t3-current-timing.log`.
    - Load evidence: the earlier run exceeded load average 100 on 16 CPUs; follow-up CPU idle initially recovered to 71%, but contention returned during testing. The baseline comparison observed 30% CPU idle and roughly 81 MB/s swap-out. Recovery of the other timing gates with no code changes, and reproduction of the final failure on the baseline, attribute these failures to host contention rather than this task. Closed Task 3 under the owner's explicit timing exception; the full check is recorded as 447 pass / 1 fail, not green. No limits were relaxed and no unrelated workload was changed. No spec meaning changed. Proof-host wiring, matrix performance measurement, capture and the outsider guide remain later tasks.

- [x] Task 4: Mount the preview on the proof host
  - Acceptance Criteria:
    - Functional:
      - The proof host serves `/preview`, a page mounting `<Preview>` with the proof catalog, both themes and design systems, and widths 360, 768 and 1280.
      - Its backend holds one session per page load on `inProcessRunner()`, with routes for:
        - `POST /preview/draft` (files, entry, manifest, scenarios → `update`);
        - `GET /preview/render?scenario=` (→ `render`);
        - `POST /preview/intent` (→ `intent`);
        - `POST /preview/publish` (→ `memoryStore.putPackage` of the last package, returning its hash).
      - The routes apply the existing host checks (same origin, JSON content type, size limit). The page's draft defaults to the agent-home package.
      - The client bundle and the served HTML contain no draft code.
    - Performance: n/a — record the matrix draw time from Task 3 here.
    - Code Quality: the preview routes live in `proof/host/preview.ts`; the page entry is `proof/host/preview-client.tsx`. Both reuse plan 008's package helper.
    - Security:
      - Law 1: drafts reach only the backend.
      - Law 4: the host's real dispatcher is never wired to the preview routes, and a spy proves it.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (proof, preview).
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2 `Bun.serve` routes and `Bun.build` browser target (`find-docs` "Bun").
    - Documentation Reviewed:
      - `proof/host/server.ts:13–121` (the request checks and bundling), plan 008 Task 7's host.
    - Options Considered:
      - A separate preview host — rejected: spec §7.5 has the app mount `<Preview>` in its own page, with its primitives and CSS.
    - Chosen Approach:
      - Add routes and a page to the existing host.
      - Supply the initial URL scenario's result to `<Preview>`. `onSelect` also reports width/style changes: fetch only when the scenario changes, and discard obsolete responses before updating the result prop. Each completed request supplies a new result object.
    - API Notes and Examples:
      ```bash
      timeout 120s bun run proof   # then open http://127.0.0.1:3000/preview?scenario=ready&width=768
      ```
    - Files to Create/Edit:
      - `proof/host/preview.ts`, `proof/host/preview-client.tsx`: new.
      - `proof/host/server.ts`, `proof/host/README.md`: serve and document the page, routes and session URL.
      - `proof/host/pages.ts`: export the existing runner for reuse.
      - `roadmap.md` §3: Task 4 execution status.
      - `proof/tests/preview-browser.test.ts`: new.
  - Test Cases to Write:
    - `every_proof_scenario_draws_at_three_widths_under_both_design_systems`: every scenario of every proof widget draws all 12 cells with no error. Each cell's computed styles belong to its own theme and design system, and responsive values follow the cell width.
    - `set_state_rerenders_within_the_session_in_the_browser`.
    - `action_appears_in_the_log_and_the_dispatcher_records_no_call`.
    - `responsive_values_and_design_system_recipes_are_scoped_to_each_cell`.
    - `only_scenario_changes_fetch_and_obsolete_responses_are_discarded`.
    - `preview_routes_reject_bad_requests_and_isolate_sessions`.
    - `no_draft_code_reaches_the_browser_and_publish_stores_the_last_package`: a unique identifier placed only in draft code (never in a rendered string) is absent from the client bundle, the served HTML and the hydrated DOM.

  - Notes (executed 2026-10-24):
    - Mounted `/preview` with the proof primitives, catalog and arrival validator: 360/768/1280 px × both themes × both design systems. Each new page gets an independent backend session on the same exported in-process runner as the reference pages. The URL carries its session id; revisiting that id after a draft update mounts the new manifest and scenarios.
    - Added draft, render, intent and publish routes in `proof/host/preview.ts`. Draft updates return only their hash or pack errors; publishing puts the last successfully packed package in a shared memory store and returns the stored hash, with 409 for version conflicts. Browser bootstrap contains rendered data only. POSTs enforce same-origin JSON; requests are bounded at 1 MiB because the shared drafts measure 84–224 KB, while the reference `/intent` route retains its 64 KiB limit, including streamed bodies.
    - The client serializes host requests, fetches only for scenario changes, and discards obsolete responses. State intents rerender every cell; actions enter the session log without opening or dispatching a production surface. Draft source stays on the backend. The host README documents the HTTP shapes, session URL and reload workflow.
    - Wrote the tests first; the initial run failed waiting for the missing preview page. Seven browser tests now cover all 22 proof scenarios (264 cells), computed theme fonts and design-system recipes, responsive grid columns at each container width, state and action intents, dispatcher spies, isolated sessions, rejected requests, stale responses, source-marker exclusion from both bundles/HTML/hydrated DOM, and published hash equality. Corrected test assumptions about shared heading typography and Certified's 3 px control radius; no implementation contract changed.
    - The 679-node agent-home `ready` scenario's 12-cell navigation plus draw measured 1295.24 ms in the final full run (no budget). `timeout 600s bun run check` passed: generated types, both typechecks, lint, formatting and all 455 tests across 70 files (0 failures). `git diff --check` passed and `graft build` refreshed the local graph. No library API, spec meaning or dependency changes. Tasks 5–8 remain.

- [x] Task 5: Add `liveframe preview capture`
  - Acceptance Criteria:
    - Functional:
      - `liveframe preview capture <url> … --out <dir>` follows Task 1, refinement 5:
        - it opens the page in headless Chromium and waits for `data-lf-ready`;
        - for each scenario, it navigates to that scenario's URL;
        - for each requested cell, it writes a screenshot of the cell element and its `ariaSnapshot()`;
        - it writes `index.json` with each cell's errors, as read from the page.
      - Exit code 0 on success and 1 on a failed cell. An invalid flag or a missing or unreachable page prints a usage error.
      - Without `playwright` installed, the command prints how to install it and exits 1, and `liveframe gen` keeps working.
      - The command's core is `capture(url, options)` in `src/cli/capture.ts`, so Phase 8 can call it without spawning a process.
    - Performance: record capture time per cell in the Notes; no budget.
    - Code Quality: flag parsing follows `src/cli/liveframe.ts`'s existing style, and there is no argument-parser dependency.
    - Security: capture is read-only. It loads one host page and writes only under `--out`; paths come from cell coordinates, sanitised.
  - Approach:
    - Skills to Use:
      - `find-docs` — Playwright 1.64.1; `liveframe-execution` (preview).
    - Library Documentation to Check Before Implementation:
      - Playwright (`/microsoft/playwright`, 1.63.0 docs checked 2026-10-24; verify against installed 1.64.1): `chromium.launch`, `page.goto`, `locator.screenshot({ path })`, `locator.ariaSnapshot()` returning YAML.
    - Documentation Reviewed:
      - `proof/scripts/parity.ts`: font readiness and capture alignment.
      - `src/cli/liveframe.ts:5–42`: subcommands.
      - Spec §13 (the optional peer, and the CLI loading rule from Task 1).
    - Options Considered:
      - Ship a browser automation layer without Playwright — rejected: the spec names Playwright, and the proof already depends on it.
      - Make `playwright` a regular dependency — rejected: only one command needs it, and spec §13 makes it optional.
    - Chosen Approach:
      - Lazily import `playwright` from the capture subcommand; one page per scenario; per-cell element screenshots.
      - Justification for the optional peer: preview capture is the agent's only way to see pixels. Playwright 1.64.1 is already a pinned dev dependency here, and an optional peer keeps it off every other install.
    - API Notes and Examples:
      ```bash
      timeout 300s bun src/cli/liveframe.ts preview capture "http://127.0.0.1:3000/preview" --width 360,768 --out evidence/preview
      ```
    - Files to Create/Edit:
      - `src/cli/capture.ts`: new; `src/cli/liveframe.ts`: subcommand.
      - `package.json`: `peerDependencies.playwright` (`^1.64.1`) and `peerDependenciesMeta.playwright.optional`.
      - `proof/tests/preview-capture.test.ts`: new (against the proof host).
  - Test Cases to Write:
    - `capture_writes_png_snapshot_and_index_per_cell`: files exist; PNG signature; the YAML names the cell's landmarks; the index lists every cell once.
    - `flags_narrow_the_cells`.
    - `cell_errors_reach_the_index`.
    - `missing_playwright_reports_how_to_install` (simulated by an import failure in `capture.ts`'s loader).
    - `gen_runs_without_playwright`.

  - Notes (executed 2026-10-24):
    - Added `capture(url, options, load?)` in `src/cli/capture.ts` and the `liveframe preview capture` subcommand in `src/cli/liveframe.ts`. It opens the page once to read `data-lf-preview`, navigates once per scenario (`scenario` query parameter, other parameters such as `session` preserved), waits for `data-lf-ready` and fonts, then writes each requested cell's PNG, `.aria.yml` and an `index.json` carrying the errors read from `data-lf-errors`. Filenames come from the coordinates with every character outside `[\w.@-]` replaced, so they stay under `--out`.
    - Flags are parsed by hand in the existing style. An undeclared axis value, bad flag, non-URL or missing `--out` is a usage error (exit 2); an unreachable or non-`<Preview>` page throws a descriptive error. Exit 1 when any captured cell has render errors (index is still written) or Playwright is missing; the missing-peer message says how to install it. `playwright` is imported lazily from `capture.ts`, itself imported lazily by the subcommand, so `liveframe gen` never loads it (`gen_runs_without_playwright` blocks every `playwright` import with a Bun preload).
    - `package.json` gains `playwright ^1.64.1` as an optional peer. Justification as in the Approach: capture is the agent's only way to see pixels, and Playwright is already a pinned dev dependency.
    - Capture time: about 320 ms per cell (24 cells, 2 scenarios, one CLI process including browser launch).
    - Findings for later tasks: a bare `/preview` GET creates the session and puts its id in the bootstrap JSON, not in a redirect, so an agent must read the id from the page HTML (or pass `?session=`) to post drafts to the same session it captures. Task 6 does this. A deliberate layout error that always renders is `<Stack gap="space.99">` at the root of `agent-home/queue.tsx`; the same value in `decision-card.tsx` is not drawn in the `ready` scenario.
    - Verification: five new tests pass; `bun run lint`, `format:check` and `bun run test` pass (460 tests, 0 failures). `bun run typecheck` fails on six TS1543 JSON-import-attribute errors in `proof/css/*` and `proof/host/view.tsx`, files this task does not touch; they reproduce with this task's changes stashed, so `bun run check` is not green here for that reason. `src` typechecks clean. The cause is not investigated. Correction: the TS1543 typecheck errors were caused by this plan's own tests and are fixed (see Compromises Made).
    - Mistake corrected: a `biome --write` over all of `src` reformatted 33 unrelated files; they were restored from git with the owner's approval and are not part of this task.

- [x] Task 6: Prove the scripted agent loop
  - Acceptance Criteria:
    - Functional: a test drives the proof host as an agent would, using only HTTP and `capture()`:
      1. It posts a draft whose widget sets an undeclared style value on a layout node (a deliberate layout error, e.g. `gap: "space.99"`).
      2. It captures, then reads from `index.json` the `invalid-prop` error with its `nodeId` and pointer, and confirms the PNG exists.
      3. It fixes the draft from the error alone.
      4. It captures again and gets a clean index.
      5. It publishes, and the stored package hash equals the hash `update()` returned for the clean draft.
    - Performance: n/a — record the loop's duration.
    - Code Quality: the test reads only what an agent gets (HTTP responses, capture output), never session internals.
    - Security: law 1 — the same bundle and HTML scan as Task 4 runs on every captured page.
  - Approach:
    - Skills to Use:
      - `verify-and-stop` — prove the loop without extending it.
    - Library Documentation to Check Before Implementation:
      - none beyond Task 5.
    - Documentation Reviewed:
      - Roadmap Phase 4 Part B Done; `decision-logs/2026-10-22-1600-preview-and-runners.md` ("same runner, same result").
    - Options Considered:
      - A real LLM agent in the loop — rejected: non-deterministic; the scripted loop proves what the tools return.
    - Chosen Approach:
      - One deterministic end-to-end test.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `proof/tests/preview-agent-loop.test.ts`: new.
  - Test Cases to Write:
    - `scripted_agent_fixes_a_layout_error_from_its_capture_and_publishes_the_previewed_hash`.

  - Notes (executed 2026-10-24):
    - Added `proof/tests/preview-agent-loop.test.ts`: one deterministic test driving the proof host through HTTP (page GET for the session id, `POST /preview/draft`, `POST /preview/publish`) and `capture()`. A draft with `<Stack gap="space.99">` at the root of `agent-home/queue.tsx` is captured; `index.json` carries `invalid-prop` with `nodeId` `root/stack`, pointer `/root/stack/style/gap` and the allowed values in `expected`, and the PNG exists. The fix picks an allowed value from that `expected` text alone; the next capture has no errors in any cell; the published hash equals the hash the clean `update` returned.
    - Law 1: after each capture the test fetches the served page HTML and the client bundle and asserts a marker identifier that exists only in draft code is absent from both. The hydrated DOM was already scanned in Task 4.
    - The loop took about 4.8 s (two captures of four cells each, plus launch and publish). No implementation changed.
    - Verification: the new test passes; lint and format pass, and `src` typechecks clean. The full suite was last run before this test was added (460 pass, 0 fail). `bun run typecheck` still fails on the six pre-existing TS1543 errors in `proof/` recorded in Task 5. Correction: the TS1543 typecheck errors were caused by this plan's own tests and are fixed (see Compromises Made).

- [x] Task 7: Document the preview for outsiders and hand off to Phase 8
  - Acceptance Criteria:
    - Functional:
      - `docs/preview.md` covers:
        - sessions (with the runner caveat that reference runners are not a sandbox);
        - publishing the previewed package;
        - mounting `<Preview>` and wiring its callbacks;
        - URL addressing;
        - capture and its index format;
        - installing the optional Playwright peer.
      - `docs/packages.md` and `docs/model.md` link to it.
      - The `preview.md` skill reference's "Today" section describes what shipped.
      - The guide's example runs as a test.
      - `plans/backlog.md` "Build preview sessions on the shipped package and runner contracts" is closed. A Phase 8 note records that `liveframe mcp` should call `createPreview` and `capture()` directly.
    - Performance: n/a.
    - Code Quality: written for someone outside the repo.
    - Security: the docs state that actions are never dispatched from preview and that drafts never reach the browser.
  - Approach:
    - Skills to Use:
      - `karpathy-guidelines`; `create-plan` (backlog format).
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `docs/packages.md`, `docs/renderer.md` (plan 008), `src/__tests__/sdk-guide.test.ts`.
    - Options Considered:
      - Fold into `docs/packages.md` — rejected: preview has its own audience (app authors mounting a page, agents capturing).
    - Chosen Approach:
      - One guide with a tested example.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `docs/preview.md`: new; `docs/packages.md`, `docs/model.md`.
      - `.agents/skills/liveframe-execution/references/preview.md`.
      - `src/__tests__/fixtures/preview-guide.ts`, `src/__tests__/preview-guide.test.ts`: new.
      - `plans/backlog.md`.
  - Test Cases to Write:
    - `preview_guide_example_runs`.

  - Notes (executed 2026-10-24):
    - Added `docs/preview.md`: sessions (with the runner-is-not-a-sandbox caveat and laws 1 and 4), publishing the previewed package, mounting `<Preview>` and wiring `onSelect`/`onIntent`, URL addressing, capture with the `index.json` format and exit codes, calling `capture()` from code, and installing the optional Playwright peer. `docs/packages.md` (which no longer says preview is future work) and `docs/model.md` link to it; the preview skill reference's "Today" section describes what shipped.
    - The guide's backend example is `src/__tests__/fixtures/preview-guide.ts`, embedded verbatim in the guide and run by `preview-guide.test.ts` (tree, setState re-render, logged action, `check()`, and the stored package's hash). Its host-supplied values come from `preview-guide-host.ts`. The `<Preview>` mount snippet points to the proof host's page rather than duplicating it, so only the backend example is executed.
    - Writing the example showed the session's own state re-check working: my first `setState` value was outside the manifest's enum and the session rejected it with `invalid-prop` at `/value`.
    - Closed the backlog item "Build preview sessions on the shipped package and runner contracts" with its resolution, and recorded the Phase 8 note there: `liveframe mcp` should call `createPreview()` and `capture()` directly and keep the MCP SDK lazily imported.
    - Verification: lint, format and the full suite pass (462 tests, 0 failures); `src` typechecks clean. `bun run typecheck` still fails on the six pre-existing TS1543 errors in `proof/` recorded in Task 5. Correction: the TS1543 typecheck errors were caused by this plan's own tests and are fixed (see Compromises Made).

- [x] Task 7a: Fix the capture findings from the impact analysis
  - Acceptance Criteria:
    - Functional: `docs/preview.md` no longer implies `capture()` is importable (F1). Cells whose sanitised filenames collide keep distinct PNG and snapshot files, and spec §7.5 says so (F3).
    - Performance: n/a.
    - Code Quality: one `Set` in `capture()`; no new dependency.
    - Security: filenames still stay under `--out`.
  - Test Cases to Write:
    - `cells_whose_names_sanitise_alike_keep_distinct_files`.
  - Notes (executed 2026-10-24):
    - Scenarios `a b` and `a-b` sanitise alike, so their cells now get a `-2`, `-3` suffix; the test posts both to a draft and checks that all 8 cells have distinct, existing files. The guide and spec describe the suffix and tell readers to take paths from `index.json`. The guide says capture is a command, not a library export.

- [x] Task 8: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/009-impact-analysis.md` sweeps all twelve impact areas of the create-plan reference against what shipped, and records each one, or `None — <reason>`.
      - Every finding is presented to the owner in one table with a recommended disposition (`execute` or `backlog`), and the answer is recorded. Each `execute` finding becomes a task above this one and is executed. Each `backlog` finding goes to `plans/backlog.md` and Further Actions.
      - Known candidates to sweep:
        - draft persistence across launches (host-owned, spec §7.5);
        - live-data preview;
        - the matrix draw cost on large trees;
        - capture of overlays open inside a cell;
        - the SDK data-cache P1 once it lands (drop the fresh-copy workaround);
        - Phase 8's use of `capture()`;
        - Synapta's isolated runner in preview.
      - Roadmap Phase 4 is marked complete in §3 only if every Done bullet has a passing test.
    - Performance: confirm the Task 4–6 measurements were recorded.
    - Code Quality: findings name files and spans.
    - Security: confirm laws 1 and 4 have a rejecting test on every new path.
  - Approach:
    - Skills to Use:
      - `create-plan` (final task), `graft`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/evidence/008-impact-analysis.md`: the format.
    - Options Considered:
      - n/a — required by the create-plan skill.
    - Chosen Approach:
      - Sweep, present, dispose.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/009-impact-analysis.md`: new.
      - `plans/backlog.md`, this plan's Compromises Made and Further Actions, `roadmap.md` §3.
  - Test Cases to Write:
    - n/a — analysis.
  - Notes (executed 2026-10-24):
    - Wrote `plans/evidence/009-impact-analysis.md`, sweeping all twelve areas. Nine findings went to the owner in one table; the owner answered "Accept all", adopting the recommended dispositions. F1 and F3 became Task 7a above this task and are done. F2 and F4–F9 went to `plans/backlog.md` (four new entries and notes on three existing ones).
    - Every Done bullet of roadmap Phase 4 Part B has a passing test (listed in the analysis), so Phase 4 is marked complete in §3.
    - Performance evidence from Tasks 4–6 is recorded: matrix draw 1.35 s, capture 173–320 ms per cell, agent loop 4.6 s.
    - Whole-plan verification ran. `bun run check` stops at typecheck on the six pre-existing TS1543 errors in `proof/` (Task 5 Notes); the other gates pass. Task 3's timing exception stands as recorded. Correction: the TS1543 typecheck errors were caused by this plan's own tests and are fixed (see Compromises Made).

## Verification (whole plan)

- `timeout 600s bunx playwright install chromium` (once per machine)
- `timeout 600s bun run check`
- `timeout 300s bun test src/__tests__/preview- proof/tests/preview-`
- `timeout 300s bun test proof/tests/preview-browser.test.ts`
- `timeout 300s bun src/cli/liveframe.ts preview capture "http://127.0.0.1:3000/preview" --out evidence/preview` (with `bun run proof` running)
- `timeout 120s graft build`

## Compromises Made

- Task 3 closed with an owner-approved timing exception; its reproduction is in that task's Notes.
- Task 5 and 6 recorded a failing `bun run typecheck` as pre-existing. That was wrong: the six TS1543 errors came from this plan's own `preview-capture` and `preview-agent-loop` tests, which sat in `src/` and imported `proof/host/server.ts`, so the NodeNext `src` program followed into `proof/`. My stash comparison missed it because it left untracked files in place. The two tests now live in `proof/tests/`, and `bun run typecheck` passes.
- Capture is a command only. The library exports no `capture()` function (F2).
- Capture needs Bun and Chromium; no other browser or runtime was tested.

## Further Actions

- P2: give `capture()` a public home for the Phase 8 MCP server (F2).
- P2: profile the preview matrix with the renderer selection costs (F5).
- P4: validate the page's published axes (F4); capture open overlays (F6); a runner conformance suite (F9).
- P4 (existing): hand Synapta and Clay their preview adoption notes (F8).
