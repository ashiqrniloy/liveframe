# Plan 032 Task 4: agent acceptance on the 0.3.0 paths

A fresh agent (a general-purpose subagent with no inherited conversation) was given **only** the installed
`README.md` and `docs/` of `@arnilo/liveframe`, the READMEs of `@arnilo/liveframe-starter` and
`@arnilo/liveframe-runner-quickjs`, a running host and the `liveframe mcp` tools. Its brief forbade reading `dist/`,
declarations, the host's own source, the changelog and the repository. Result: **steps 1, 2, 4 and 5 pass; step 3 passes
on the host and fails in MCP preview** because `liveframe mcp` has no way to supply a library package (finding F1). The
owner chose to fix that in 0.3.0 (follow-up Task 4a); step 3's library-in-preview half is proved there.

## What was run

`bun scripts/agent-acceptance/prepare.ts --out <dir outside the repo>` builds the host the agent worked against:

- the three packages packed exactly as published (`stagePackage` + `bun pm pack`) and installed as `file:` archives
  (checkout version `0.2.3`: Task 5 bumps the version, so this is the same code the rc will carry, not the registry copy;
  Task 5 repeats the registry check);
- the demo host's pipeline (`examples/demo-host`: `POST /widgets`, `PUT /placements/:id`, `GET /surfaces/:id`,
  `POST /placements/:id/intents`, the `tasks.page`, `tasks.claim`, `selection.*` and `demo.notify` capabilities) with
  three changes, all in the copy: the **starter** catalog, themes, design system and implementations replace the demo's;
  it renders with **`quickjsRunner()`**; and its preview draft is the getting-started guide's template widget;
- `mcp.config.ts`: the same catalog and capabilities, `runner: await quickjsRunner()`, and the host's own preview page;
- `mcp-session.ts` (`scripts/agent-acceptance/`): an agent cannot register an MCP server in its own session, so this
  runs an ordered list of tool calls in one `liveframe mcp` stdio session, saves images and appends every call to
  `transcript.jsonl`. It adds no authority: it forwards to the server.
- `agent/broken/`: a template widget broken on purpose. `pack_draft` on it returns exactly the two intended errors
  (`invalid-prop` at `/template/root/children/0/props/level`, `unknown-name` for `state.cuont`), verified by the operator
  before the run.

The host started clean (`GET /surfaces/<id>` 404, no `.data/`). The agent's working files, the transcript, 9 captured
images and its HTTP logs are local-only under `evidence/032-agent-acceptance/` (never committed). The agent was refused permission to write its own `report.md`; its report is the message it
returned, and this file is the operator's record of it, checked against the transcript and the host.

## Results

| Step | Outcome | Proof (checked by the operator) |
| --- | --- | --- |
| 1. Template `task-list@1.0.0`: source, pagination, scenarios | pass, 2 iterations | First `pack_draft` rejected `style.wrap: true` (`invalid-prop`, expected `nowrap, wrap`); fixed from the error. Then `pack_draft` ok (`sha256-1cc085ca…5de7`), `render_scenarios` ok for `first-page`, `last-page`, `empty`; `capture_preview` ok, 9 cells (3 scenarios × 3 themes × 1 design system), no errors. Transcript lines 4–9. |
| 2. Fix the broken template from static errors | pass, 1 fix | `pack_draft` returned the two errors; the agent fixed `level` to `2` and `state.cuont` to `state.count` from them alone (`fixed/template.json`); `pack_draft` ok (`sha256-cd4dd1d6…4b6e`), both scenarios render, 2 clean cells. |
| 3. TSX widget, shared library, local filter, on `quickjsRunner` | **partial** | Library `task-ui@1.0.0` (`exports: ["TaskRow"]`) packs, renders and captures clean after one `missing-key` fix. The widget `task-queue@1.0.0` imports `liveframe:lib/task-ui@1.0.0`; `pack_draft` answers `not-found: No library package was supplied for liveframe:lib/task-ui@1.0.0` (transcript: 5 calls, the first plain and four attempts to supply the library). The agent previewed a variant with the library source bundled in instead (3 scenarios ok, 3 clean cells). The installed widget renders on the host's QuickJS runner: `GET /surfaces/task-queue-main` 200, node ids equal to the preview's, `setLocal` on the filter field, `when` (`$contains` over `local.q`) on every row, so filtering needs no request. The filter was proved by tree shape, not typed into in a browser. |
| 4. Layout mistake from a captured preview with `layout: true` | pass | Clean capture first (`overflowX:false`, `overflowing:[]` at 360); the agent then introduced `width="60ch"` on the filter field on purpose, found it in the layout data (`overflowX:true`, `overflowing:["root/textField"]`, box width 480 in a 360 cell, all scenarios), removed it and re-captured at 360 and 768: 6 cells, all clean, pack hash back to `sha256-f48a586f…4d87`. The widget had no mistake of its own, and the agent said so. |
| 5. Install, place, act through the host | pass | `POST /widgets` 201 for `task-ui`, `task-queue`, `task-list` (hashes equal the MCP hashes where the content was the same); `PUT /placements/task-list-main` and `task-queue-main` 200; both `GET /surfaces/<id>` 200. `POST /placements/task-queue-main/intents` (`tasks.claim`, id `t1`) 200, `application/x-ndjson`; frames at 16:20:15.580 (rev 2) and 16:20:16.217 (rev 3), 637 ms apart, the host's deliberate delay, then the dependent `task-list-main` frame (rev 2). A later `GET` shows `t1` "claimed by ada". A second claim (`t2`) was captured raw: every Claim button reads `Claiming` and is disabled in the first frame, then a patch settles it. Host state after the run: `task-list-main` revision 3, `task-queue-main` revision 5, as the agent's two claims imply. |

**Law 4.** The transcript holds 42 calls: `list_capabilities` 1, `list_vocabulary` 1, `list_primitives` 1,
`generated_types` 1, `pack_draft` 16, `render_scenarios` 11, `capture_preview` 11. The server has no tool that installs,
places or dispatches, none was called, and the only action was sent by the agent to the host's intent route, where
`checkOffered` and `authorize` ran. Thirteen calls are marked errors: seven static pack errors (the wrong `wrap`, the two
broken-template errors, five `not-found` library probes in all), and six follow-on calls that correctly said "Call
pack_draft before …".

**Timing and iterations.** Task start 16:15:57 UTC, report end 16:21:07 UTC: 5 min 10 s, including reading the docs.
Step boundaries from the agent's `date -u` log: 16:17:04 (step 1 start), 16:17:16, 16:17:30, 16:19:24, 16:19:50 and 16:20:15 (first intent).
Content iterations: step 1 two, step 2 one, step 3 two for the library and one widget version plus four failed library
probes, step 4 one clean capture, one deliberate mistake, one fix, step 5 none.

**Forbidden reads.** None reported and none visible in the transcript. The agent re-read its own saved tool output from
the harness's results folder, not a product file.

## Findings

Every guess, gap or error the agent met, with the operator's disposition. "Fixed" means done in this task; "4a" is the
follow-up task added to the plan.

| # | Finding | Disposition |
| --- | --- | --- |
| F1 | **Capability gap, blocks step 3.** `createPreview`, `createAuthoring` and `liveframe mcp` take no libraries (`collectLibraries` in `src/preview/dependencies.ts` gets none from a session), so a widget importing `liveframe:lib/…` cannot be packed or previewed through the tools. Four attempts to supply one (a `libraries` argument as drafts and as names, `manifest.dependencies`, packing the library first in the session) all returned `not-found`. The host path works (`pack()` takes `libraries`; `renderPlacement` loads them). | **Owner: fix in 0.3.0** (answer to the Task 4 question). Task 4a. |
| F2 | Installing a library over HTTP, and that the host resolves it when a widget is installed, is documented only in the demo host README, which is not in the archive. `docs/demo-agent.md` covers widget drafts only. The agent guessed `POST /widgets` and was right. | 4a (documentation of libraries beside the preview change). |
| F3 | The agent took the intent route and `{ intent, origin }` body from `getting-started.md` and the origin shape from `adopters-0.2.md`/`spec.md`; `demo-agent.md` says to send no intents, so it was not told the route for this host. It worked first time. | Backlog (minor): say in `demo-agent.md` that the demo host takes intents at `POST /placements/:id/intents`. |
| F4 | The demo host's intent answer is `application/x-ndjson` (tree or patch frames, then dependents), which no doc describes; the getting-started host answers plain JSON. `pending` and `ok` are not named on the wire: the widget draws them from its `actions` input. `actions` in a frame is the offered-actions list, `actions` in `WidgetProps` is the statuses. `host.md` does say the widget gets a `pending` frame first. | 4a documents the frame stream in `demo-agent.md`; the `actions` naming is backlog. |
| F5 | `style.textAlign: "start"` was a guess that validated; `wrap: true` was wrong and the error's `expected` list fixed it. Allowed style values are in `list_primitives` and `generated_types` only. | No action: the tools are the contract and answered. |
| F6 | `docs/sdk.md` "Public exports" omitted `ex`, `local`, `self` and five type exports although the same page uses them. | **Fixed** (`docs/sdk.md`; docs tests pass). |
| F7 | `missing-key` is reported at the parent (`/root/open/stack`) and says "Expected siblings with distinct keys" without naming the children or the fix. The agent resolved it from the `sdk.md` error table. | Backlog (diagnostic quality). |
| F8 | `demo-agent.md` says two themes × two design systems = eight cells. This host has three starter themes and one design system, so the agent saw nine. | Not a docs error: the operator's host differs from the stock demo host. No action. |
| F9 | The `generated_types` note says to import from `"./ui.gen"`; the docs use `"./ui.gen.ts"`. Both work. | Backlog (minor wording). |
| F10 | The local filter was proved by tree shape only; no tool types into a browser. An empty pager `inline` (height 0) still adds a stack gap in the `empty` scenario, which the layout data does not flag. | Backlog. The browser proof of local filtering is `orchestration.test.ts` in the demo host (plan 029). |
| F11 | Agent process: it POSTed `task-queue@1.0.0` while probing library installs, before the layout step; a layout fix that changed the content would have needed a new version. The final content was identical (same hash both POSTs), so no `409`. | No action. |
| F12 | Agent process: frame contents of the first claim were truncated in its log; it recaptured a second claim raw. The first claim's outcome is proved by the later `GET`. | No action. |
| F13 | `README.md`, `preview.md` and `getting-started.md` point to `examples/demo-host`, `proof/` and CI scripts, none in the archive. These are repository links, not file references the reader needs. | No action (`docs-links` passes). |

## Reproduce

```sh
timeout 900 bun scripts/agent-acceptance/prepare.ts --out <empty directory outside the repository>
cd <out>/host && bun server.ts                          # http://127.0.0.1:3300
timeout 300 bun mcp-session.ts agent/calls.json --out agent/captures --transcript agent/transcript.jsonl
```

Compromises: the agent was a subagent of this session, not an independent person; it shares the model family with the
author of the docs. The operator hosts the three archives as `file:` dependencies at the checkout version; the registry
run is Task 5. The agent's report was relayed as text (its own Write to `report.md` was refused); the operator checked it
against `transcript.jsonl`, the host's state and its saved outputs, and states only what those support.
