---
date: 2026-10-22 16:00
status: approved
decision_about: "How authors and agents see and iterate on a widget before publishing it"
proposed_by: "both"
explicitly_approved_by_user: true
---

# Decision: Liveframe ships a preview (runners, sessions, `<Preview>`, capture) and required fixture scenarios, but no isolation sandbox, all in 0.1.0

## Decision

Liveframe ships a **preview** for authoring:

- A `Runner` interface with two reference runners: in-process for tests and trusted code, and a worker runner that kills a render on timeout.
- A host-API-free preview session that packs a draft and renders it across scenarios, sizes, themes and design systems. It keeps state within the session and captures actions without running them.
- A `<Preview>` React component the host mounts in its own app.
- `liveframe preview capture`, which screenshots a host's preview page for agents.

Every widget package must carry **at least one fixture scenario**. Liveframe still ships no isolation sandbox. The host plugs its own sandbox in as a runner, and preview and production use the same runner. All of this, together with the packages and storage decision (`2026-10-22-1539`), ships in **0.1.0**.

## Context

The owner noted that a person or agent does not write a widget and push it blind: they look at it and iterate. The owner proposed shipping a sandbox for this.

"Sandbox" covers two things:

1. **An isolation boundary**, where untrusted code runs safely. It is platform-specific. Synapta already has two trust paths: in-process for its own widgets and a hostile-code sandbox for organisation and agent widgets (`proof/references/synapta-core/plans/200.4-SdkComponentsRendererAndQueue.md`, T5 notes).
2. **A preview loop**: draft, render, look, change, render again. It is built from parts Liveframe already owns: `pack()`, `render()`, the renderer and the CSS projection.

The authoring need is the second.

## Approval

- Proposed by: both. The owner raised the need and proposed a sandbox. The agent proposed a preview with runners instead, and asked two questions.
- Approved by user: Yes
- Approval evidence: "Confirmations: 1. Fixture scenarios required 2. Everything discussed so far should be shipped with 0.1.0 release including the preview".

## Alternatives Considered

1. **Ship an isolation sandbox (QuickJS, isolated-vm, SES or similar).** Rejected. A pure-JavaScript boundary would be a false promise, and the real ones are platform-specific or native. The founding decision already rejected bundling QuickJS (`decision-logs/2026-10-21-2017-liveframe-founding-model.md`, alternative 2), and spec §13 rules out a bundled sandbox.
2. **Run the draft in the browser (an iframe) for instant feedback.** Rejected. It breaks law 1, and the preview would run code on a path production never uses.
3. **A standalone preview app with its own primitives (Storybook-like).** Rejected. The look comes from the host's primitives and CSS, so a standalone app shows the wrong pixels. `<Preview>` mounts inside the host's app instead.
4. **Optional scenarios.** Rejected by the owner. Required scenarios become an agent's test cases and a reviewer's view of empty and error states.
5. **Keep preview capture in the post-release MCP server (Phase 8).** Rejected by the owner: the preview ships in 0.1.0. Capture becomes a CLI command in 0.1.0, and Phase 8's MCP server later exposes the same capability as a tool.

## Rationale and Evidence

- **Same runner, same result.** The preview renders through the runner the host uses in production, and approval stores exactly the previewed package (same hash). What was seen is what runs.
- **Law 1 holds.** Even in preview, draft code runs in a runner. The browser receives only trees.
- **Actions never run in preview.** An action intent is shown and recorded, never dispatched, so iterating has no side effects.
- **An agent needs a timeout.** An agent iterating will sometimes write a non-terminating loop. `render()` is synchronous and cannot interrupt itself. A worker can be terminated, so the reference worker runner bounds time and crashes. It does not restrict what the code can access, and the spec says so.
- **The shape is proven.** The proof host already behaves as a prototype: `?scenario=` fixtures, `?size=`, a design-system switch, and actions logged rather than executed (`proof/host/README.md`). Playwright already drives it for parity capture (`proof/scripts/parity.ts`).
- **Scenarios belong in the package.** They are validated against the manifest's schemas at pack time and covered by the hash, so a stored version can always be previewed and reviewed with the data it was written against.

Assumptions to check in the plans:

- The worker runner relies on the `Worker` global (Bun, Deno, browsers). A runtime without it uses the in-process runner or the host's own.
- Fixture data is JSON keyed by the manifest's data source names. It is checked against the host's data source schemas only when the host provides them, because the manifest names sources but does not declare their shapes.

## References

- `docs/spec.md` §3, §4, §7.3, §7.5, §13, §14 — updated by this decision.
- `docs/model.md` — the authoring and preview steps.
- `roadmap.md` — Phase 2 Part B, Phase 4 Part B, Phase 6 and Phase 8.
- `decision-logs/2026-10-22-1539-widget-packages-and-reference-stores.md` — packages and stores, also in 0.1.0.
- `decision-logs/2026-10-22-0902-authoring-mcp-server-for-coding-agents.md` — Phase 8, which now also wraps capture.
- `proof/host/README.md`, `proof/scripts/parity.ts` — the prototype and the capture pattern.

## Consequences

- `pack()` requires at least one scenario, and a package's hash covers its scenarios.
- New subpaths: `/preview` (runner interface, in-process runner, sessions), `/preview/worker` (worker runner) and `/preview/react` (`<Preview>`). The CLI gains `liveframe preview capture`, with Playwright as an optional peer dependency used only by that command.
- 0.1.0's scope grows to include packages, storage, runners and preview. The demo host must show the full loop: an agent writes a widget with scenarios, captures it, fixes it, publishes it, and it survives a restart.
- Revisit if a host needs preview without React, if a widely available isolation primitive appears that is host-API-free, or if required scenarios prove too heavy for very small widgets.
