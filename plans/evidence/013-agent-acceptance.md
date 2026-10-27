# Plan 013 Task 11: agent acceptance from the published docs

Executed 2026-10-27 against the installed registry release `@arnilo/liveframe@0.1.0-rc.2`.

**Behavioral result on rc.2: passed with explicitly recorded extra host instructions. Published-doc-only gate: pending a new release candidate and fresh acceptance run.** Owner instruction: “Fix docs; require a new release candidate.” Task 11 stays unchecked until the corrected published guidance passes that run.

## Session boundary

A fresh agent with no inherited conversation received only the installed package's `README.md` and `docs/`, the running demo URL `http://127.0.0.1:3300`, and the opaque `examples/demo-host/mcp.config.ts` path. It did not read repository implementation, tests, declarations, skills, graph or config source, and did not reuse the scripted agent loop.

After it reported missing host instructions, the coordinator allowed two additional inputs, recorded as acceptance deviations: the unpublished `examples/demo-host/README.md`, and importing the opaque config as the documented `AuthoringConfig` to bind a separate CLI preview session. This authorization came from the coordinator, not the owner; it is not approval to defer the findings.

The new widget is `outsider.departure@1.0.0`, with two scenarios, `checklist` and `ready`. It uses the demo's Box, Stack, Heading and Text primitives, learned from MCP tools, and declares no actions, sources or events.

## Commands and results

Run from the repository root. Every command used a timeout; the acceptance scripts, request/response logs, drafts, screenshots and accessibility snapshots are local-only under `evidence/013-agent-acceptance/`.

```sh
# Discovery: initialize, tools/list, catalog, vocabulary, capabilities and generated types.
timeout 45s bun evidence/013-agent-acceptance/mcp-run.ts
# Bad draft, then corrected draft through pack_draft, render_scenarios and capture_preview.
timeout 100s bun evidence/013-agent-acceptance/mcp-author.ts
timeout 100s bun evidence/013-agent-acceptance/mcp-author-fixed.ts
# Separate session: bad draft, then corrected draft through the capture CLI.
timeout 120s bun evidence/013-agent-acceptance/cli-iterate.ts
# Assertions on capture results, hashes, preview/surface equality and empty actions.
timeout 10s bun evidence/013-agent-acceptance/verify.ts
```

Both MCP authoring scripts start the installed binary with:

```sh
examples/demo-host/node_modules/.bin/liveframe mcp examples/demo-host/mcp.config.ts
```

The CLI script imports public `createPreview` and the opaque host config, calls `config.preview({ session, package })`, and runs:

```sh
examples/demo-host/node_modules/.bin/liveframe preview capture <binding.url> \
  --out evidence/013-agent-acceptance/cli-2 --width 360
```

The observed binding URL was `http://127.0.0.1:45349/preview`; its ephemeral port changes on regeneration. It serves the demo's preview page bound to the authored draft. The original `:3300/preview` still holds the demo's hello draft; capturing that alone would not prove the authored widget.

| Path | Iteration 1 | Iteration 2 |
| --- | --- | --- |
| CLI capture | Exit 1; eight cells report `missing-key` at `/root/stack`. | Exit 0; eight clean cells. |
| MCP | Pack succeeds; both scenarios report `missing-key`; eight captured error cells. | Both scenarios render five nodes; eight clean captured cells. |

The agent corrected repeated static Text siblings by adding explicit keys. Each final matrix covers two scenarios × width 360 × two themes × two design systems. The agent visually inspected the final checklist and ready screenshots and found legible, unclipped content with no validation error chrome.

Authoring elapsed: **206 seconds**, `2026-10-27 06:45:28–06:48:54 UTC`. **Two iterations per path.**

## Install, place and compare

```sh
timeout 10s curl -sS -X POST http://127.0.0.1:3300/widgets \
  -H 'content-type: application/json' \
  --data-binary @evidence/013-agent-acceptance/draft-fixed.json
timeout 10s curl -sS -X PUT http://127.0.0.1:3300/placements/outsider-departure \
  -H 'content-type: application/json' \
  -d '{"slot":"home.main","widget":{"id":"outsider.departure","version":"1.0.0"},"params":{"ready":false}}'
timeout 10s curl -sS http://127.0.0.1:3300/surfaces/outsider-departure
```

Responses: `POST /widgets` **201**, `PUT /placements/outsider-departure` **200**, `GET /surfaces/outsider-departure` **200**. The surface root equals the last checklist preview root. Manifest actions and dispatched actions are empty; no intent endpoint was called. Drafts went only through backend pack/runner paths.

A separate browser check (`timeout 45s bun evidence/013-agent-acceptance/verify-surface.ts`) confirms the heading “Before you head out” and both expected copy lines are visible at `/?placement=outsider-departure`, with no page errors and an empty action log.

Initial invalid draft hash:

`sha256-441cc796d31efd6e82b14691f88258de0ddffacbc037415ad790d4777552c412`

**Final CLI preview = final MCP preview = published hash:**

`sha256-3e91a20c5f59175a8988bdaff174855d7389b7ed7aca35092eae577b245e53c1`

## Local evidence and regeneration

All paths below start at `evidence/013-agent-acceptance/`; images are ignored and never committed.

| Evidence | Regeneration script |
| --- | --- |
| `cli-1/index.json`, error PNGs and `.aria.yml` snapshots | `cli-iterate.ts` |
| `cli-2/checklist_360_demo@1.0.0_demo@1.0.0.png` and the other seven clean PNGs, snapshots and `index.json` | `cli-iterate.ts` |
| `mcp-1/cell-1.png` through `cell-8.png`, tool response JSON | `mcp-author.ts` |
| `mcp-2/cell-1.png` through `cell-8.png`, tool response JSON | `mcp-author-fixed.ts` |
| `verification.json` (all assertions pass) | `verify.ts` |
| `surface.png`, `surface-browser.json` (placed browser surface) | `verify-surface.ts` |

`transcript.md` records the full session summary, exact commands, image paths and deviations; `cli-command-{1,2}.json` retains exact argv. Regeneration needs the same registry package, peers, browser and host config. Reposting the identical draft is idempotent by hash; use a new placement id when preserving prior local state matters.

## Docs findings and disposition

| Id | Finding | Required disposition |
| --- | --- | --- |
| D1 | Published docs omit the demo's HTTP install, placement and surface workflow, including that `POST /widgets` receives the draft object. The agent needed the unpublished demo README and inferred that request body from `pack()`. | Fixed in source by `docs/demo-agent.md`; rc.3 publication and fresh acceptance pending. |
| D2 | Published `docs/preview.md` describes a proof-host session/upload flow. The running demo exposes neither a session id nor a documented way to replace its hello draft. The agent needed the opaque config binding workaround to capture its own draft independently through the CLI. | `docs/demo-agent.md` documents the actual binding workflow; `docs/preview.md` identifies the proof-host-only transport. rc.3 publication and fresh acceptance pending. |
| D3 | SDK missing-key guidance discusses arrays/list items; repeated same-kind static siblings also need keys. Errors were actionable and both loops recovered using them. | Clarified in `docs/sdk.md`; no implementation defect. |
| D4 | The agent supplied standard MCP JSON-RPC initialization/framing and installed-binary resolution as client plumbing. The guide assumes an MCP-capable client. | Non-blocking client setup assumption; no product change required. |

The owner declined backlog disposition. The source fixes add the shipped walkthrough and links from README, MCP and preview guides; no runtime behavior changes. This rc.2 evidence must not be presented as an unqualified published-doc-only pass or used to close readiness P5 yet.
