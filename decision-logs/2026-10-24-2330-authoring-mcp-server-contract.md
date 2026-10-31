---
date: 2026-10-24 23:30
status: approved
decision_about: "The authoring MCP server's contract: page binding, config, capture home, tool set, draft shape"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: The authoring MCP server's contract (D1–D6)

## Decision

`liveframe mcp <config-module>` is specified with six decisions. D1: the host's config binds its own `<Preview>` page to the server's session, through `preview(binding)`. D2: the command takes a host-written config module, not flags. D3: capture stays in the CLI, with no new subpath, and `AuthoringConfig` is a type-only `/preview` export. D4: the tools include a read-only `list_capabilities`, and `pack_draft`'s input schema is built from the published manifest and scenario schemas. D5: drafts are sent inline, in `session.update()`'s shape. D6: the Phase 8 Done test's layout mistake is a valid draft that is visibly wrong in the capture.

> **D3 superseded (2026-10-29):** `decision-logs/2026-10-29-1244-runner-kit-capture-and-authoring-library.md` adds `/preview/capture` and `AuthoringConfig.capture?: CaptureBackend`, keeping the core host-API-free by injecting the backend. D1, D2, D4, D5 and D6 remain in force.

> **D5 amended (2026-10-31):** [The 0.2.1 MCP surface decision](2026-10-31-2057-authoring-mcp-server-0-2-1-surface.md), M5, adds CLI-only directory drafts under an opt-in `draftRoot`, with path containment and bounded reads. Inline drafts remain supported; `/authoring` remains inline-only and host-API-free. M4 also replaces the no-intent-tool restriction with offered `setState` only; actions remain prohibited.

## Context

`decision-logs/2026-10-22-0902-authoring-mcp-server-for-coding-agents.md` fixed the scope (authoring only, after v1) and `decision-logs/2026-10-22-1836-mcp-server-in-0-1-0.md` moved it into 0.1.0 with preview capture added. The preview contracts are in `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md`, which also allows the CLI to lazily load command-specific optional peers (its decision 6). What neither record settles is how the server reaches a preview page, how a host configures it, where capture lives, and what exactly the tools take and return.

Plan `plans/011-Phase-8-Authoring-MCP-Server.md` resolves those as D1–D6. The owner approved all six on 2026-10-24; Task 1 writes them into spec §13, §7.5 and the roadmap.

The constraints behind them:

- Spec §3: the library bundles none of the app's primitives. A page the server shipped itself would have to.
- Law 1: widget code never reaches the browser. The page must get trees, from the host's own transport.
- Law 4: no tool installs, places or approves a widget, resolves data or runs an action.
- Spec §13's dynamic-import rule and the CLI exception to it.

## Approval

- Proposed by: agent.
- Approved by user: Yes
- Approval evidence: "For D1-D6, I agree with your recommendation" (2026-10-24), after the six decisions and their rejected alternatives were presented.

## Alternatives Considered

1. **D1 — the server posts drafts to host routes.** Rejected: the library would need a route protocol (a new contract for every host), and the server would then run two sessions, one for the draft and one for the page.
2. **D1 — the server ships its own page.** Rejected: it would bundle the app's primitives, which spec §3 forbids.
3. **D2 — JSON-only flags (`--catalog`, `--capabilities`, …).** Rejected: flags cannot carry a runner or a page, and D1 needs both.
4. **D3 — a `/preview/capture` subpath.** Rejected: it would need host APIs and Playwright inside a library subpath, which the host-API-free scan and spec §13 forbid.
5. **D4 — summaries instead of full definitions, and a `<Subpath>/manifest` import instead of the published schemas.** Rejected: the agent needs the exact schema to write valid props, and the published `/schemas` are the shape the CLI already validates against, so using them keeps one source of truth in `tools/list`.
6. **D5 — paths on disk.** Rejected: the server would have to check paths, and agents without a file system could not use it.
7. **D6 — the layout mistake as an invalid style value.** Rejected: validation errors are already loop 2 of the Done test; D6 proves that a draft can be valid and still wrong, which is what capture is for.

## Rationale and Evidence

- D1 keeps law 1 intact: the binding receives a session and returns a URL, so the page renders trees through the host's transport. The server holds one session for its lifetime, so a capture shows the draft the agent last packed. `<Preview>`'s existing host-page contract (`src/preview/react`) already accepts that arrangement; only the proof host needed an `attach()` path.
- D2 matches how hosts already configure the library: a config module can hold a runner and a page factory, and it runs with the host's own authority, like the app's server.
- D3 keeps Playwright and the browser out of the package. `capture()` already exists in the CLI, so the tool calls that function directly instead of spawning a second process. `AuthoringConfig`, `PreviewSession` and `PreviewBinding` are types only, which adds no runtime surface to `/preview`.
- D4's `list_capabilities` is the only way an agent learns which actions and sources the app declares: without it, loop 2's "choose the action from `list_capabilities`" is impossible. Building `pack_draft`'s schema from `schemas/manifest.json` and `schemas/widget-package.json#/$defs/scenario` means `tools/list` shows the real shapes and cannot drift from what `pack()` validates.
- D5 uses `session.update()`'s own shape, so the tool takes the drafts the session already accepts, inline in the agent's arguments.
- D6 gives capture a purpose in the Done line that validation cannot cover.

## References

- `plans/011-Phase-8-Authoring-MCP-Server.md` — D1–D6, the tasks that build them and the tests that prove them.
- `docs/spec.md` §3, §7.5, §13, §14 — updated by this decision.
- `decision-logs/2026-10-22-0902-authoring-mcp-server-for-coding-agents.md` — authoring-only scope; unedited.
- `decision-logs/2026-10-22-1836-mcp-server-in-0-1-0.md` — ships in 0.1.0; unedited.
- `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md` — preview session and `<Preview>` contracts; its decision 6 is the CLI optional-peer rule D2 and D3 rely on.
- `plans/backlog.md` — "Give capture a public home for the authoring MCP server", resolved by D3.

## Consequences

- The spec gains the full `liveframe mcp` contract in §13, a pointer from §7.5's capture paragraph, and the three type exports in the `/preview` row; the roadmap's Phase 8 Goal gains the capabilities tool.
- Hosts that want an agent-visible preview write a config module and an `attach` path for their own page (the proof host's pattern in `proof/host/`); the library ships neither.
- `pack_draft` and `render_scenarios` are pinned to `session.update()` and `session.render()`/`session.check()` shapes, so a change to either session method changes a tool.
- Follow-up work is recorded in `plans/backlog.md` by Task 8: a `setState` intent tool, drafts read from disk paths, capturing an open overlay, and validating the page's published axes in capture.
- Revisit D4 or D5 if agents need a different draft transport, or if `fromJsonSchema` cannot express the published schemas in MCP SDK 2.4.0 (Task 4's fallback).
