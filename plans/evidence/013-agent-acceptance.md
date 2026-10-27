# Plan 013 Task 11: agent acceptance from the published docs

Executed 2026-10-27 against the installed registry release `@arnilo/liveframe@0.1.0-rc.2`.

**Final result: PASS on rc.3 using only the corrected shipped docs and the documented opaque host config.** The original rc.2 run below exposed docs gaps; owner instruction was “Fix docs; require a new release candidate.” The replacement candidate shipped those fixes and a second fresh session passed. Default 100 ms rendering failed under heavy local load; the successful run used the documented per-render timeout override. Readiness P5 is closed; the separate pre-release review remains Task 12.

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
| D1 | Published docs omit the demo's HTTP install, placement and surface workflow, including that `POST /widgets` receives the draft object. The agent needed the unpublished demo README and inferred that request body from `pack()`. | Fixed in rc.3 by shipped `docs/demo-agent.md`; fresh docs-only acceptance passed. |
| D2 | Published `docs/preview.md` describes a proof-host session/upload flow. The running demo exposes neither a session id nor a documented way to replace its hello draft. The agent needed the opaque config binding workaround to capture its own draft independently through the CLI. | Fixed in rc.3: the walkthrough documents actual binding, and `docs/preview.md` identifies proof-host-only transport. Fresh docs-only acceptance passed. |
| D3 | SDK missing-key guidance discusses arrays/list items; repeated same-kind static siblings also need keys. Errors were actionable and both loops recovered using them. | Clarified in `docs/sdk.md`; no implementation defect. |
| D4 | The agent supplied standard MCP JSON-RPC initialization/framing and installed-binary resolution as client plumbing. The guide assumes an MCP-capable client. | Non-blocking client setup assumption; no product change required. |

The owner declined backlog disposition. The source fixes add the shipped walkthrough and links from README, MCP and preview guides; no runtime behavior changes. The rc.2 run is not an unqualified published-doc-only pass; the fresh rc.3 run below supplies the acceptance evidence.

## Validation and replacement candidate

- `timeout 900s bun run check`: build, generated types, both typechecks, lint and format passed; tests finished in 814.49 seconds with **545 pass, 4 skip, 90 fail, 5 errors**. Local load rose from about 29 to 57 on 16 cores while unrelated compilation/VM work ran. Failures include render/module 100 ms deadlines, performance budgets, browser timeouts and cascading closed-browser errors. No runtime code changed in this task. This is a failed local check, not a green result.
- Focused docs checks (`docs-links`, `sdk-guide`, `mcp-guide`, `readme-guide`): **4 pass, 0 fail**. The existing `preview-guide` example failed its 100 ms render limit both in the combined docs run and a separate retry. Catalog-only retry: **8 pass, 1 fail**, the 5 ms timing assertion measured 17.88 ms.
- The new walkthrough's extracted capture script executed and produced the expected final package hash and eight capture records, but captures hit the same 100 ms render limit on this host. The fresh registry run below proves clean capture using the documented per-render timeout adjustment.
- Replacement candidate `0.1.0-rc.3`, commit `a62c70a`, tag `v0.1.0-rc.3`: [trusted-publishing run](https://github.com/ashiqrniloy/liveframe/actions/runs/40464259877) **passed**. `bun run check`: **635 pass, 4 skip, 0 fail**, 639 tests across 90 files, 272.28 seconds. The built-archive gate passed all seven steps in 3.9 seconds; peer-floor and demo gates passed before publishing. The demo gate's existing script installed rc.2 (the known script/dependency mismatch recorded in Task 10 remains assigned to Task 13); the fresh acceptance host was separately installed and restarted on rc.3.
- Registry metadata confirms rc.3 has **190 files** and a `https://slsa.dev/provenance/v1` attestation. `timeout 120s bun add @arnilo/liveframe@0.1.0-rc.3 --exact --no-cache` in `examples/demo-host` installed it from npm; the new guide exists inside the installed archive. The first install attempt preceded registry propagation and returned no matching version; the retry succeeded. The host restarted on rc.3 before the fresh session.

## Fresh rc.3 acceptance: corrected shipped docs only

A second fresh agent, with no inherited conversation or prior acceptance artifacts, read the installed rc.3 README and the demo-agent, MCP, package, SDK and preview guides. It did not read repository source/tests/docs, installed implementation/declarations, demo README or config source. Catalog definitions and generated types came from the seven MCP tools; the server identified itself as rc.3. The opaque supplied config was imported only through its documented public interface. Standard MCP client framing and public browser automation were client plumbing; no extra unpublished host instructions were needed.

New widget: `outsider.field-notebook.rc3.20261027@1.0.0`, placement `outsider-field-notebook-rc3`. Scenarios `observations` and `quiet` render six nodes each. The widget uses only the demo's primitives and token styles, with no sources, actions or events.

Measured proof and representative-image review: **2026-10-27 07:09:16–07:14:38 UTC, 322 seconds**, excluding initial README/walkthrough reads and later reporting. Each path used **two authoring iterations**, one deliberate invalid-gap draft then its correction. Environmental retries did not change either draft:

1. The default CLI and MCP paths captured `Render exceeded 100 ms`, retained as failed environmental attempts.
2. A longer worker default alone still exposed 100 ms module-evaluation/render deadlines.
3. An evidence-local Runner adapter passed the documented per-render `timeoutMs: 10000`. Both independent paths then diagnosed the invalid `space.unknown` token at `/root/stack/style/gap`, with the allowed vocabulary, before capturing the corrected `space.3` draft cleanly.

The decisive CLI run exits 1 for eight invalid-gap cells, then 0 for eight clean cells. MCP reports both corrected scenarios successful, six nodes each, and eight clean captured cells. Each matrix is two scenarios × one width (360) × two themes × two design systems. Representative CLI, MCP and placed images were viewed and found readable and unclipped.

All three final hashes match:

`sha256-4f33a1529376900e5a578c2ae6565134c8efcb5593b158dfd9e716fa938ed12a`

`POST /widgets`, `PUT /placements/outsider-field-notebook-rc3` and `GET /surfaces/outsider-field-notebook-rc3` return **201/200/200**. The browser at `http://127.0.0.1:3300/?placement=outsider-field-notebook-rc3` shows Field notebook, Riverside meadow and seven observations. Browser inspection records seven GET requests, zero page/console errors, no interactions or intent endpoint calls, and an empty action log. Draft code ran through backend runner paths only.

Local-only artifacts now start at `evidence/013-agent-acceptance-rc3/` (E); the demo working directory is `examples/demo-host/` (H). The exact expanded argv, requests, responses, status codes and input audit are retained in `E/transcript.md` and its JSON artifacts. Decisive regeneration commands, with E/H expanded to absolute paths:

```sh
timeout 360s env ACCEPT_CONFIG=E/mcp-loaded-render.config.ts ACCEPT_PREFIX=mcp-loaded-render bun E/mcp-run.ts
timeout 150s env ACCEPT_TIMEOUT=10000 ACCEPT_RENDER_TIMEOUT=10000 ACCEPT_PREFIX=cli-loaded-render bun E/capture-draft.ts bad
timeout 150s env ACCEPT_TIMEOUT=10000 ACCEPT_RENDER_TIMEOUT=10000 ACCEPT_PREFIX=cli-loaded-render bun E/capture-draft.ts clean
timeout 100s bun E/install.ts
timeout 100s bun E/browser.ts
timeout 15s bun E/verify.ts
```

| Evidence under E | Regeneration script |
| --- | --- |
| `cli-loaded-render-bad/index.json`, eight invalid-gap PNGs/snapshots | `capture-draft.ts bad`, with the decisive environment above |
| `cli-loaded-render-clean/quiet_360_demo-warm@1.0.0_demo-round@1.0.0.png`, seven other clean PNGs/snapshots and `index.json` | `capture-draft.ts clean`, same environment |
| `mcp-loaded-render-clean-1.png` through `-8.png`, corresponding bad images and tool JSON | `mcp-run.ts`, with the decisive config/prefix above |
| `published.png`, `browser.json` | `browser.ts` |
| `draft-bad.json`, `draft.json`, authored widget | `author.ts`, using saved MCP-generated types |
| `verification.json` | `verify.ts` |

`verify.ts` exits zero and asserts the intended bad-token diagnostics, clean final cells, scenario/render counts, CLI/MCP/install hash equality, HTTP statuses, surface identity/actions, expected browser text and GET-only traffic. No remaining host-docs gap blocked the run. D1–D3 are resolved by the published guidance; D4 remains ordinary client setup, not an undocumented host contract.

To satisfy the sequence explicitly, the agent repeated `install.ts`, `browser.ts` and `verify.ts` **after both clean capture paths completed**. This ordered follow-up ran **07:17:56–07:18:36 UTC, 40 seconds**; total elapsed from the first recorded observation through final proof was **560 seconds**, including intermediate reporting/cleanup but excluding the initial documentation prelude. `verification-final.json` passes with the same hash and eight clean cells per path. Final install/place/surface statuses are again 201/200/200; the placed screenshot was viewed again.

The two evidence-local MCP processes using custom runner adapters saved all responses but stayed alive after stdin closed; the agent stopped those two owned processes after capture completion. The original-config MCP exited normally. This custom-runner teardown observation was not investigated as a product defect, and no verification was interrupted.

Limits: the default deadlines did not pass on this loaded machine; this proves successful docs-guided timeout adjustment rather than default-performance reliability. Broader widths, interactions, action dispatch, hostile-code isolation and a new persistence/restart audit were not part of this authoring test. The earlier task evidence and Task 12 retain those separate gates. All screenshots remain ignored and uncommitted.
