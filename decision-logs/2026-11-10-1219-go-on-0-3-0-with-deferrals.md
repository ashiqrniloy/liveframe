---
date: 2026-11-10 12:19
status: approved
decision_about: "Carry the 0.3.0 readiness deferrals into 0.3.x and go"
proposed_by: agent
explicitly_approved_by_user: true
---

# Decision: Go on 0.3.0 and carry the deferred readiness items into 0.3.x

## Decision

`0.3.0` is approved for release. Three groups stay open past it, owning entries unchanged:

1. **23 deferred impact findings plus one split one**: 026 F2; 028 F4, F5, F6, F8; 029 F3, F4, F5, F6, F7; 030 F5–F11; 031 F1, F2 (its concurrency half), F5, F6, F7, F10, F11.
2. **The two open P1 backlog entries**: the Phase 1 validator gate at ≤ 1.5 µs/node and the demo host's initially-open dialog.
3. **The quiet-host benchmark proof** (scope row O1): its 36 acceptance rows stay `pending`, and the `template` 5% gate stays unconfirmed, because no stage sequence ran on a quiet host.

## Context

The readiness review (`plans/evidence/032-release-readiness-review.md`) joined every acceptance bullet of plans 026–031 to a proof: 378 pass, 36 pending, 12 n/a, 0 fail, 0 unmapped. All 31 scope rows are fixed except O1; O2 closed with Task 5. The 36 pending rows are exactly the budget bullets whose proof is the quiet-host record, which Task 3 could not obtain: the shared host never read quiet (best attempt peaked at 23.0% CPU), and the owner had already closed Task 3 on partial proof on 2026-11-09.

Nine of the deferred findings (028's four, 029's five) had been backlogged without a separate owner round trip, so they needed the owner's answer before they could be called approved deferrals.

## Approval

- Proposed by: agent (the review presented the three groups with their evidence).
- Approved by user: Yes.
- Approval evidence, verbatim: "We go and leave the 3 items identified as deferred".

## Alternatives Considered

1. **Hold 0.3.0 until a quiet host frees up** — rejected by the owner's answer; the shared host's load is outside the project's control and Task 3's proof was already closed on that basis on 2026-11-09.
2. **Fix the deferred findings before release** — rejected: they are backlog P3/P4 items, each with its own entry, and none blocks a shipped contract.
3. **Re-cut a new release candidate** — rejected: the only source change after `0.3.0-rc.1` is the MCP notice fix (`src/cli/mcp.ts`), covered by its own test and by the full check, and `0.3.0` publishes from source.

## Rationale and Evidence

- The release candidate is verified from the registry for all three packages: archive gates (15 / 2 / 2 steps), installed API equal to the checkout and to every baseline, the getting-started guide and the demo host installed from the registry, `npm audit signatures` clean, core provenance present.
- The two deferred P1s are unchanged in substance: Task 3's validator stage passed every gate on a quiet stage (9.7% CPU), and the demo host's dialog test passes in `demo:test`.
- The `template` gate's failure is disclosed rather than relaxed: it is a thin-margin ratio gate that failed on a host at 14.4% CPU, the same shape as the `pack-libraries` gate that proved a real defect, so it cannot be marked proven without a quiet run. `pack-libraries` itself was fixed in code and passes 30 of 30 runs.

## Consequences

- `0.3.0` ships with 24 impact findings and two P1 entries deferred, each with a backlog owner; `plans/backlog.md:510` still owns the quiet-host proof, and re-running `bun scripts/bench-quiet.ts` on an idle host followed by the acceptance script turns the 36 pending rows `pass`.
- The two companion packages' release candidate carries no provenance (first publish by token); `0.3.0` publishes from CI and restores it, provided the owner configures each package's trusted publisher on npmjs.com first.
