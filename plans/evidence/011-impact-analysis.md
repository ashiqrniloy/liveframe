# Plan 011 — architectural impact analysis

Reviewed 2026-10-24 against the delivered Tasks 1–8, roadmap Phase 8, spec §7.5
and §13, `decision-logs/2026-10-24-2330-authoring-mcp-server-contract.md`
(D1–D6), and all twelve impact areas in
`.agents/skills/create-plan/references/liveframe.md` §5.

## Impact areas

1. **Spec.** §13 describes what shipped: the invocation, the `AuthoringConfig`
   fields, start-up validation with exit 2, the one-session lifetime, the default
   `workerRunner()`, `preview(binding)` called once after the first successful
   pack and closed on shutdown, the twelve-cell bound, the seven tools with their
   results, and that stdout carries only the protocol. §7.5 names
   `capture_preview`, and the `/preview` row lists the three type exports. Every
   clause has a test (see Verification). The spec sets no exit-code contract, so
   exit 0/1/2 live in `docs/mcp.md` (same split plan 009 chose for capture). One
   mismatch found in the docs, not the spec: the guide claimed every rejected
   call returns `LiveframeError` JSON (F1). None further.

2. **Public API and formats.** No new subpath: the server is `src/cli/mcp.ts`
   (D3), and `/preview` gains only the type-only `AuthoringConfig`,
   `PreviewBinding` and `PreviewSession` (`src/preview/authoring.ts`). No format,
   field or schema change; `pack_draft`'s and `render_scenarios`' input schemas
   are composed from the published `schemas/*.json` at start-up and the tests
   assert the embedding, so the tool schema cannot drift from the format. New
   optional peer `@modelcontextprotocol/server@2.4.0` in `package.json`
   (`peerDependenciesMeta.optional`), with `@modelcontextprotocol/client@2.4.0`
   as a dev-only dependency; runtime dependencies (`acorn`, `sucrase`) unchanged.
   `src/__tests__/exports.test.ts` pins the surfaces and passes.

3. **The four laws.** Law 1: drafts reach only the runner; the loop test fetches
   the bound page and `/preview-client.js` after every capture and rejects the
   draft-only marker while asserting the rendered heading is present, and Task 6
   does the same on the capture path. Law 2: every render goes through
   `session.render()`, so the validator runs; the attached page's trees go
   through the host's own `<Surface>` arrival check unchanged. Law 3: unchanged —
   the server projects no style. Law 4: no store, dispatcher, resolver or intent
   tool. `tools_list_is_exactly_the_authoring_set` fails on a rename or an extra
   tool, and `mcp_server_imports_no_store` rejects a `/store` import in
   `src/cli/mcp.ts`; `list_capabilities` returns declarations only and the config
   has no field a resolver could occupy. Attached sessions reject `PATCH`-style
   writes: `POST /preview/draft` and `/preview/publish` answer 405
   (`preview-attach.test.ts`). No new leak found.

4. **Validation.** `catalog` and `capabilities` are validated on start
   (`invalid_config_exits_2_with_errors_on_stderr_and_empty_stdout`, plus the two
   bad-document fixtures); a non-default-export module and a bad module path are
   rejected the same way. Drafts pass through `pack()`/`session.update()`, so
   schema and cross-reference errors are the packer's typed errors
   (`pack_errors_keep_the_previous_package`, `cross_reference_error_is_a_liveframe_error`).
   Capture narrows axes and validates them against the page's declarations;
   `maxCells` rejects an over-broad call with the declared values named. One gap:
   the MCP layer's own argument-schema rejection is a bare string, not a
   `LiveframeError` (F2), and the guide misstated it (F1).

5. **Styling.** None — the server returns trees and PNGs; recipes, theme
   authority and CSS projection are the page's. The captured cells reuse the
   proven `<Preview>` matrix.

6. **Interaction tiers.** Local: unchanged (browser). `setState`: reachable only
   as `render_scenarios({ state })`, which sets a scenario's starting state
   without an intent; there is no agent intent tool (F3). Action: an action
   binding is checked against the manifest and the capability's args schema
   during render, then shown and logged by the page; nothing dispatches (law 4),
   and the attached session has no dispatch path to add.

7. **Performance.** No budget was set for this authoring path (`plans/011`).
   Recorded in the task Notes: spawn to `initialize` 107/96/100 ms (Task 2);
   in-process `pack_draft` 38.8 ms and `render_scenarios` 5.1–6.3 ms on the
   19-file, 8-scenario agent-home draft (Task 4); capture 173–320 ms per cell,
   unchanged from plan 009 (Task 6); the whole three-loop agent run 2.3 s with
   the default `workerRunner()`, of which two four-cell captures are ~1.7 s
   (Task 7). Measured again in this task over stdio on the proof config:
   `render_scenarios({ scenario: "ready" })` returns the 679-node tree as
   115,851 bytes in 25.6 ms, all eight scenarios as 364 bytes in 16.4 ms, and a
   one-cell `capture_preview` in 2.26 s (process is warm; includes Chromium).
   `bun run bench` is untouched and its gates pass.

8. **Portability.** `src/preview/authoring.ts` is type-only and sits inside the
   host-API-free scan (`src_is_host_api_free` passes); `src/cli/` stays outside
   the scan, as §13 allows. The MCP SDK is imported only by the `mcp` command
   ("Only the CLI may lazily import command-specific optional peers"), Playwright
   only by capture; `gen_runs_without_the_mcp_sdk` proves `liveframe gen` still
   works with the SDK blocked. Runtime beyond Bun is untested, as before.

9. **Agent authoring.** The loop proves the errors are actionable: `pointer`,
   `nodeId` and `expected` let the agent repair a `gap` and an action from the
   text alone, and captures give a size the agent can compare. Three gaps: no
   tool returns `catalogId`, every render error repeats per scenario (F4, handed
   to the backlog in Task 8), and the input-schema rejection above (F2). The
   layout check is a pixel height threshold, not a structural assertion (F5).

10. **Docs and examples.** `docs/mcp.md` is new, written for outsiders, with its
    config example embedded verbatim and started by `mcp-guide.test.ts`; it links
    spec §13 and `docs/preview.md` rather than restating them. `docs/preview.md`
    and `README.md` link to it, and the execution skill's preview reference
    describes what shipped. F1 is a factual error in the new guide.

11. **Conformance.** Phase 5's suites cover app catalogs, design systems,
    renderers and stores. The authoring server consumes those formats and adds
    no contract an app must implement, so nothing joins the kit. None — no
    conformance change.

12. **Reference hosts.** Neither prototype is in this repo. Synapta passes its
    isolated runner as `config.runner` and binds its own page; Clay's desktop
    shell binds a local page — both need only `AuthoringConfig`, no proof-host
    code (D1). Not yet recorded in the adopters' backlog entry (F6).

## Findings and candidate sweep

Candidates named by the plan: the twelve-cell bound as a fixed number (F7), the
SDK's schema-check messages versus `LiveframeError` pointers (F2), running from
the installed package (already extended in Task 8's backlog edit; no new
finding), Synapta's runner and Clay's page as `AuthoringConfig` users (F6), and
size limits for `render_scenarios` trees (F8).

Presented to the owner in this table on 2026-10-24; the owner answered "accept
all", which adopts every recommended disposition. No decision-log amendment is
needed: F1 corrects a doc sentence, and F2–F8 are follow-ups that change no
accepted contract.

| ID | Finding and evidence | Recommended | Recorded disposition and result |
| --- | --- | --- | --- |
| F1 | `docs/mcp.md` said every rejected call was `isError` with `LiveframeError` JSON; argument-schema rejections are a bare text block: `Input validation error: Invalid arguments for tool pack_draft: data/manifest/id must match pattern "^[a-z][a-zA-Z0-9.-]*$"` (reproduced over stdio). | execute | `docs/mcp.md` now shows both shapes: the bare argument-validation message and the `LiveframeError[]` block with `/root/…` pointers. `mcp-guide.test.ts` passes. |
| F2 | MCP argument validation happens before the handler (`fromJsonSchema`), so those errors carry no `kind`, `expected` or `nodeId` and use `data/…` pointers, unlike every other failure (`LiveframeError[]` with `/manifest/…`). An agent must handle two error shapes. | backlog | P4 "Give the MCP tools one error shape". |
| F3 | No intent tool: an agent can seed state through `render_scenarios({ state })` but cannot run a `setState` intent, so tier-2 behaviour is only checkable per starting state. | backlog | P4 "Add a setState intent tool to the authoring MCP server" (added in Task 8). |
| F4 | A tree error repeats once per scenario because `render_scenarios` without `scenario` renders all of them; and no tool returns `catalogId`, so a manifest's `/catalogId` cannot be discovered (`catalog-mismatch` names no expected value). | backlog | P4 "Give agents the catalog id and one error set" (added in Task 8). |
| F5 | The layout proof is a PNG height threshold (133 px) rather than a structural check; it catches the shipped mistake but says nothing about a row that is too wide. | backlog | P4 "Prove layout mistakes structurally, not by pixel height". |
| F6 | Adopters' entry lacks the `AuthoringConfig` handoff: Synapta's isolated runner and Clay's local page, with the warning that a reference runner is not a sandbox. | backlog | Bullet added to "Hand adopter gaps to Synapta and Clay". |
| F7 | The twelve-cell bound is the literal `12` in `src/cli/mcp.ts` and a spec sentence; an app cannot raise it, and a 2×2×3 matrix is already 12. | backlog | P4 "Let an app raise the capture cell bound". |
| F8 | `render_scenarios` returns whole trees with no size bound (115,851 bytes for the 679-node proof tree); a much larger widget could exceed a client's tool-result limit. | backlog | P4 "Bound the tree size render_scenarios returns". |

## Verification

- `timeout 300s bun run check`: passes (590 tests, 0 failures, 87 files;
  typecheck, lint, format and generation drift included).
- `timeout 300s bun test src/__tests__/cli-mcp.test.ts src/__tests__/mcp-guide.test.ts`:
  25 pass, 0 fail — includes the seven-tool pin, the no-`/store` scan, the
  schema-embedding check, both exit codes and the guide's config.
- `timeout 300s bun test proof/tests/preview- proof/tests/mcp-`: preview-attach,
  preview-agent-loop, preview-capture, host and the three-loop agent test pass.
  The agent loop spends 2.3 s, the four `Inline` cells measure 102–113 px and the
  four `Stack` cells 163–177 px at width 360.
- `graft build`: passes.
- Roadmap Phase 8 Done clauses, each with a passing test:
  - "writes a widget with scenarios for a test host's catalog that validates and
    renders" — `scripted_agent_writes_fixes_and_lays_out_a_widget_through_mcp_tools_only`
    loop 1, from `list_primitives`, `list_vocabulary`, `list_capabilities` and
    `generated_types` alone;
  - "fixes a deliberately invalid widget from the returned errors" — loop 2,
    using only the `expected` strings;
  - "fixes a layout mistake from a captured preview" — loop 3, `Stack` row
    replaced by `Inline` against a measured threshold.
  Phase 8's Goal also names the capabilities tool (D4) and `workerRunner()` as
  the default, both covered by `cli-mcp.test.ts`.
- The spec's twelve-cell sentence is exercised by the `limit-exceeded` case, and
  law 1 by the per-capture marker scan.
