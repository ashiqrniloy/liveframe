# Plan 009 — architectural impact analysis

Reviewed 2026-10-24 against delivered Tasks 1–7 and impact follow-up Task 7a,
roadmap Phase 4 Part B, spec §7.5 and §13, and all twelve impact areas in
`.agents/skills/create-plan/references/liveframe.md` §5. The approved
`decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md`
(decisions 7–9 and the plan 009 Task 1 refinements) supplies the contracts.

## Impact areas

1. **Spec.** §7.5 and §13 match the shipped session, `<Preview>` and capture
   contracts, including the `data-lf-*` attributes and the `index.json` shape.
   F3 found one gap, filename uniqueness, and Task 7a states it in §7.5. The
   exit codes (0, 1, 2) live in `docs/preview.md` and the skill reference, not
   in the spec, which sets no exit-code contract. None further.

2. **Public API and formats.** `package.json` exports `./preview/react`;
   `createPreview` joins `/preview`; `playwright ^1.64.1` is an optional peer.
   `src/__tests__/exports.test.ts` pins the surfaces. No format or schema
   change. `capture()` has no export, so the guide says capture is a command
   (F1 corrected the guide; F2 is the open public-API question).

3. **The four laws.** Law 1: drafts reach only the runner. The proof host's
   bundle, served HTML and hydrated DOM are scanned for a draft-only marker in
   `proof/tests/preview-browser.test.ts`, and again after every capture in
   `src/__tests__/preview-agent-loop.test.ts`. Law 2: every cell re-checks
   through `<Surface>`, including the retained last-good tree
   (`src/__tests__/preview-react.test.tsx`). Law 3: `<Preview>` chrome carries
   structural rules only, no colour or font. Law 4: no dispatcher exists in the
   session API; `set_state_rerenders_and_invalid_intents_change_nothing` and the
   browser test's dispatcher spy reject any call. Capture is read-only and
   writes only under `--out`. None — no new leak found.

4. **Validation.** `intent()` re-checks keys, values, manifest membership and
   capability args (`src/preview/session.ts`); `update()` returns `pack()`'s
   typed errors unchanged. The preview routes check origin, content type and
   size, with rejecting tests (`preview_routes_reject_bad_requests_and_isolate_sessions`).
   Capture validates its flags and rejects undeclared axis values. It trusts the
   page's `data-lf-preview` JSON (F4).

5. **Styling.** Cells are sibling surfaces scoped independently; computed styles
   and responsive grid columns are asserted per cell in both design systems
   (`responsive_values_and_design_system_recipes_are_scoped_to_each_cell`).
   None — no recipe or projection change.

6. **Interaction tiers.** `setState` re-renders within the session; an action is
   logged and never dispatched; local interactions stay in the browser. Tested
   in the session suite and the browser suite. None — no gap.

7. **Performance.** No budget was set for this authoring path. Recorded: session
   renders cost the runner's overhead (0.0178 ms warm, Task 3); the 12-cell
   matrix of the 679-node tree takes 1.35 s navigation plus draw (Task 4,
   reproduced in this task); capture takes 173–320 ms per cell including launch
   (Task 5, 96 cells in this task's CLI run); the scripted agent loop takes 4.6 s
   (Task 6). F5 asks for a split of the matrix cost.

8. **Portability.** `/preview` bundles with no host APIs (the scan gives it the
   packer allowance); `/preview/react` shares `/react`'s DOM exception;
   `src/cli/` is outside the scan. Capture needs Bun and Chromium through
   Playwright; `liveframe gen` runs with Playwright blocked
   (`gen_runs_without_playwright`). Other browsers and runtimes are not tested.
   None — no portability claim beyond Bun and Chromium.

9. **Agent authoring.** Errors reach the agent as `kind`, `pointer`, `nodeId` and
   an `expected` list, which let the scripted loop fix `gap` from the capture
   alone. Missing Playwright prints install steps. F4 notes a raw `TypeError`
   for a malformed hand-built page.

10. **Docs and examples.** `docs/preview.md` is new and its backend example runs
    as `preview-guide.test.ts`; `docs/packages.md` and `docs/model.md` link to
    it. F1 fixed the sentence that implied `capture()` is importable.

11. **Conformance.** Phase 5's scope is catalogs, design systems, renderers and
    stores. Preview adds nothing to those suites. A custom isolated runner has
    no shared suite (F9).

12. **Reference hosts.** The proof host's preview page demonstrates the whole
    loop. Synapta's isolated runner in `createPreview` and Clay's `<Preview>`
    mount were not in the adopter handoff (F8).

## Findings and dispositions

Presented to the owner in one table on 2026-10-24; the owner answered "Accept
all", which adopts every recommended disposition. No decision-log amendment is
needed.

| ID | Finding and evidence | Recommended | Recorded disposition and result |
| --- | --- | --- | --- |
| F1 | `docs/preview.md` told readers to call `capture()` from the CLI module, with no package export (`package.json` exports). | execute | Task 7a rewrote the sentence: capture is a command and the library does not export it. |
| F2 | Phase 8 needs a public home for `capture()`; a subpath is a spec §13 decision. | backlog | P2: "Give capture a public home for the authoring MCP server". |
| F3 | Filenames that sanitise alike collide (`src/cli/capture.ts`), so one PNG overwrote another. | execute | Task 7a added a numeric suffix, the spec sentence and `cells_whose_names_sanitise_alike_keep_distinct_files`. |
| F4 | `data-lf-preview` JSON is trusted unvalidated. | backlog | P4: "Validate the page's published axes in capture". |
| F5 | 12-cell matrix of the 679-node tree takes 1.35 s with no cost split. | backlog | Added to "Profile production browser selection costs before optimizing the renderer". |
| F6 | Capture cannot show overlays open inside a cell. | backlog | P4: "Capture overlays that are open inside a preview cell". |
| F7 | The fresh-copy workaround stays until the SDK data-cache P1 lands. | backlog | Note added to "Scope SDK data validation caching to the source-schema contract". |
| F8 | The adopter handoff omits preview for Synapta and Clay. | backlog | Bullet added to "Hand adopter gaps to Synapta and Clay". |
| F9 | No suite checks a custom runner against the reference contract. | backlog | P4: "Evaluate a conformance suite for runners". |

Candidate sweep: draft persistence and live-data preview stay host-owned
(spec §7.5), so nothing is scheduled. Phase 8's use of `capture()` is F2.
Synapta's isolated runner is F8 and F9.

## Verification

- `timeout 590s bun run check`: generation drift passed; typecheck stopped on
  six TS1543 JSON-import-attribute errors in `proof/css/*` and
  `proof/host/view.tsx`. They reproduce with this plan's changes stashed and
  were not investigated. Lint, format and the full test suite pass separately
  (462 tests, 0 failures before Task 7a).
- `timeout 300s bun test src/__tests__/preview-`: 29 pass, 0 fail (before Task 7a).
- `timeout 300s bun test proof/tests/preview-browser.test.ts`: 7 pass, 0 fail;
  matrix draw 1,348 ms.
- Task 7a: `preview-capture` and `preview-guide` tests pass (7 tests); `src`
  typechecks clean.
- Real CLI capture of the proof host: exit 0, 96 cells, 173 ms per cell,
  written to the ignored `evidence/preview/`. Regenerate with
  `timeout 300s bun src/cli/liveframe.ts preview capture "<host url>/preview" --out evidence/preview`.
- `graft build` passed.
- Roadmap Phase 4 Part B Done bullets, each with a passing test: the scripted
  agent loop and published hash (`preview-agent-loop.test.ts`); every proof
  scenario through `check()` and drawn at three widths under both design
  systems (`preview-session.test.ts`, `preview-browser.test.ts`); `setState`
  and the action log with no dispatcher call (`preview-browser.test.ts`); one PNG
  and snapshot per cell plus the index and the URL-addressable cell
  (`preview-capture.test.ts`, `preview-react.test.tsx`); no draft code in the
  bundle and the host-API-free scan (`preview-browser.test.ts`,
  `portability.test.ts`).
- Task 3's closure and the timing failures it recorded are in that task's Notes.
