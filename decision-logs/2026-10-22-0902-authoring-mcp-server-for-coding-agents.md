---
date: 2026-10-22 09:02
status: approved
decision_about: "An authoring MCP server for coding agents on the roadmap"
proposed_by: "both"
explicitly_approved_by_user: true
---

# Decision: Liveframe will ship an authoring-time MCP server for coding agents, after v1

## Decision

The roadmap gains Phase 8: `liveframe mcp`, an MCP server that helps coding agents write widgets against an app's catalog and design system. It lists primitives, roles and design-value names, shows generated types, and validates and renders widgets with fixture inputs, returning structured errors. It is authoring-time only: it never installs, places or approves widgets, resolves real data, or runs actions. It follows the 0.1.0 release (Phase 6) and the reference-host phase (Phase 7).

## Context

The owner asked to add "creation of an MCP server for coding agents" to the roadmap. Two earlier records constrain it:

- Spec §14 lists agent tooling beyond generated `.d.ts` and structured errors as a v1 non-goal.
- The founding decision rejected "layers, regions, MCP agent tools and proposals inside the library" because they are each app's policy (`decision-logs/2026-10-21-2017-liveframe-founding-model.md`, alternative 4).

An authoring server for coding agents differs from what the founding decision rejected. The rejected tools were runtime tools that act inside an app: proposing, placing or installing widgets. Authoring tools only read the catalog and run the SDK and validator locally, which the library already owns.

## Approval

- Proposed by: both. The owner asked for the roadmap item; the agent proposed the authoring-only scope and the placement after v1.
- Approved by user: Yes
- Approval evidence: "I would also add creation of an MCP server for coding agents in the roadmap."

## Alternatives Considered

1. **Include it in v1 (before Phase 6).** Not chosen: it widens the v1 scope that spec §14 fixes, and it needs the SDK (Phase 2) and the renderer (Phase 4) first. It can be moved earlier by a later decision.
2. **A runtime MCP server that installs and places widgets in an app.** Rejected: the founding decision makes that app policy.
3. **No MCP server; rely on generated types and errors.** Not chosen: agents are first-class authors (spec §1), and direct query-and-validate tools shorten their feedback loop.

## Rationale and Evidence

- Agents author widgets (spec §1). The library already produces what they need: definitions, generated types and typed `WidgetError`s (spec §7.2). An MCP server exposes these through a standard agent interface.
- Keeping it authoring-only keeps the four laws intact. The server never touches real data, authority or the browser.

## References

- `roadmap.md` §2, Phase 8.
- `docs/spec.md` §1, §7.2, §14.
- `decision-logs/2026-10-21-2017-liveframe-founding-model.md`, alternative 4.

## Consequences

- Spec §14 now points to Phase 8.
- The MCP SDK will be a new runtime dependency, justified in Phase 8's plan and kept out of the core export.
- Revisit if agents need it before v1 ships, or if a host asks for runtime tools. Runtime tools stay that host's own work.
