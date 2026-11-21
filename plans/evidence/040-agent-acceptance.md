# Plan 040 Task 6: agent acceptance on the 0.4.0 paths

The run used the 0.4.0 release checkout at `0dd0cb3` plus Task 6's acceptance fixture. All four packages were installed
from staged `file:` archives. The archives still carried the checkout's `0.3.0` manifest version because Task 7 owns the
version bump. The host and MCP preview both used `quickjsRunner()`.

The TSX/A2UI agent started without inherited conversation and worked from the installed READMEs and docs, MCP,
the supplied A2UI input, and the running host. A second agent started without inherited conversation and saw only
the brief and the full CLI digest. Both agents received the input restrictions in their briefs. The raw calls,
answers, captures, and HTTP frames are local under `evidence/040-agent-acceptance/`.

## Digest-only authoring

The operator generated the unabridged 23,269-character digest with the installed `liveframe gen --digest`,
the packed starter catalog, the host capabilities, and the caller-owned schema `q: string ≤ 80`. The brief asked for
two tasks with a filter, a conditional empty state, and Claim buttons. The agent used `bind.value`, `setLocal`,
`$contains` over literal titles, and `$eq` over `shown`. It inferred that `setLocal.key` takes the bare key
`q` from the distinction between a key and an expression path. The first answer passed.

| Check | Result |
| --- | --- |
| `renderElements` with caller-owned `local` and `initialLocal: { q: "" }` | 12 nodes, one bound field, three gated nodes and two Claim buttons |
| `streamElements` | Eight intermediate trees, final root equal to the rendered root |
| Surface core | Accepted. Empty query showed both tasks, `Plan` showed only `root/tasks/t2`, and `zzz` showed only `root/tasks/empty`. Zero intents while filtering. |

The existing `digest-run.ts check` produced those results with the checkout. A scratch adaptation resolved its
imports through the installed archives and took the caller-owned schema from JSON. It produced identical reports.

## A2UI v0.9.1

The agent started with mappings for `Column`, `Text`, and `Button` and a single event mapping from `claim`
to `tasks.claim`. `fromA2ui` rejected the fixture with `unknown-component` at
`/1/updateComponents/components/1/component`. The agent added the app-specific `Summary` → `text` mapping,
then used the successful conversion's `origins` to map `/children/0/props/text` to
`/1/updateComponents/components/1/text` and `/children/1/events/onPress` to
`/1/updateComponents/components/2/action`.

The result passed `renderElements` and rendered to HTML with the packed starter renderer.
Its sole offered action was `tasks.claim` with `{ "id": "t1" }`. Replacing the input event name with `unmapped`
returned `unknown-name` at `/1/updateComponents/components/2/action/event/name`.

## Findings

- The standalone starter catalog exposes scalar selection. The acceptance host adds an app-owned `multiSelect`
  with a bounded array carry so the same widget can exercise this 0.4.0 path in preview and on the host.
- The installed MCP guide documents tool arguments. The operator's JSON batch wrapper takes
  `{ "tool": "...", "arguments": {...} }`. The agent initially used `name` and received a protocol error,
  then corrected the invocation. Its first malformed discovery JSON was also rewritten.
- The packed `docs/demo-agent.md` treats the surface GET as a single JSON response and describes frame
  `actions` as per-action statuses. The host returned NDJSON for the GET and used frame `actions` as a dispatch
  log. The agent recovered by decoding each line, applying subsequent patches, and reading the widget's status
  and result text. The release owner can dispose of this documentation finding before the candidate.

## TSX and MCP transcript

The final `acceptance.task-summary@1.0.0` draft used the app-owned `MultiSelect` with `state.set("selected")`,
`focus` on the Task ID field, and a filter with a `shown()` empty state. The Claim button uses
`fromLocal: { id: "taskId" }` and writes `sending: true` with `until: "revision"`.
The agent's earlier scalar-select draft served as a diagnostic, then the agent generated types again against
the extended catalog and rebuilt the draft with the array event.

| Calls, in order | Result |
| --- | --- |
| `list_vocabulary`, `list_capabilities`, `list_primitives` for `multiSelect, stack, text, textField, button`, `generated_types` | Starter catalog identity, host declarations, selected kinds and generated TSX types |
| `pack_draft` with `widget.tsx`, `ui.gen.ts`, manifest, and `pending` / `ready` scenarios | `sha256-276bb4c0ee70fe3c0672ad1db368fdc687c2ea4d0a2b0ce9f6e9317b98ab29d7` |
| `render_scenarios` for all scenarios, then `scenario: "pending"` and `scenario: "ready"` | Both passed. The trees carry `focus: "root/task-id"`, the compound Claim intent, the array-backed state write and the gated empty row. The German ready case showed “2 offene Aufgaben”, “Aufgaben auswählen”, “Claim status: ok” and “Claim owner: Viewer”. |
| `set_state` with origin `root/selected.onChange` and value `["t1", "t2"]` | Rendered “Selected tasks: t1, t2”. |
| `capture_preview` with `widths: [360]` | Six PNGs from two scenarios and three starter themes. Every cell reported `errors: []`. |

The MCP transcript contains discovery, pack, render, a state write and capture. No call dispatched an action.
An additional in-memory surface-core check observed `fromLocal` fill `id: "t2"` after a local edit, the
“Sending claim…” local write clear on the next accepted revision, and the filter remove the empty row.
The callback captured the completed intent in memory.

## Host transcript

All requests used the prepared host on loopback. The first draft of the agent's HTTP probe selected the scalar
pack hash from the mixed MCP transcript and failed its hash assertion. The agent adjusted it to use the final pack
hash and decoded the source and action as frame streams.

| Request | Observed response |
| --- | --- |
| `POST /widgets` with the final MCP draft | HTTP 201, final MCP pack hash matched |
| `PUT /placements/acceptance-task-summary` | HTTP 200 |
| First `GET /surfaces/acceptance-task-summary` | HTTP 200 NDJSON. Full revision 1 showed “Task digest pending” and patch revision 2 showed “12 of 12 tasks open”. |
| `POST /placements/acceptance-task-summary/intents` with the offered Claim origin and `id: "t1"` | HTTP 200 NDJSON. Full revision 4 showed “Claim status: pending”. Patch revision 5 showed “Claim status: ok” and “Claim owner: ada”. The dispatch log had exactly one `tasks.claim` for `t1`. |

A separate Chromium run on `acceptance-browser` selected both options and observed “Selected tasks: t1, t2”.
Leaving the filter field hid the empty state. Editing the Task ID to `t2` sent `{ "id": "t2" }`.
The browser probe held that request briefly to see “Sending claim…”, then let it reach the host and saw the
label reset on the pending revision before the action settled to ok. There were zero page errors.
The focus mark was present in the tree. The browser confirmed the documented behavior for the initial mark.

## Reproduce

```sh
timeout 900 bun scripts/agent-acceptance/prepare.ts --out <empty-dir-outside-repo>
cd <out>/host
timeout 900 bun -e 'import { startHost } from "./server.ts"; await startHost({ port: 34307, latencyMs: 650 });'
# In a second shell in the prepared host, use the agent's batch call file and HTTP probe.
timeout 300 bun mcp-session.ts agent/widget.calls.json --out agent/captures --transcript agent/transcript.jsonl
ACCEPTANCE_BASE=http://127.0.0.1:34307 timeout 30 bun agent/http-check.ts
timeout 30 bun agent/a2ui.tsx
# Optional Chromium interaction probe using a separate placement:
timeout 60 bun operator-browser.ts
# With the operator's local schema file (see digest/local.json in the evidence directory):
timeout 30 bun node_modules/.bin/liveframe gen node_modules/@arnilo/liveframe-starter/dist/catalog.json --digest --capabilities capabilities.json --local ../digest/local.json --budget 24000 --out ../digest/catalog.digest.md
# From the checkout, once an agent supplies answer.json:
timeout 45 bun --conditions liveframe:source scripts/agent-acceptance/digest-run.ts check <answer.json> Plan
```
