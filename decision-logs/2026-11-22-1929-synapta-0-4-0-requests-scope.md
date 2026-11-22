---
date: 2026-11-22 19:29
status: approved
decision_about: "Synapta 0.4.0 request scope and backlog priorities"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Synapta 0.4.0 request scope

## Decision

Schedule LF-18 through LF-65 across 0.4.1, 0.5.0 and 0.6.0 in plans 041–056, and apply the seventeen backlog dispositions below. Each boundary and further conflict goes to Task 1 of its owning plan for a design and decision.

### Request dispositions

All 48 requests start as `open`. Plan 056 checks the adoption gate. Each request and raised backlog item must be `delivered` or `declined` with a decision log naming who owns the problem. A moved or deferred item stays `open`, and any open item keeps the gate unmet. A request split across releases stays open until both parts are settled.

| ID | Request | Plan | Approved release | Adoption status |
|---|---|---|---|---|
| LF-18 | Template render cost is not bounded by `limits.steps` | 041 | 0.4.1 | open |
| LF-19 | A placement cannot pin a package's content | [043](../plans/043-Phase-7-Part-AD-Release-0-5-0-Scope-Stored-Documents-And-Content-Integrity.md) | 0.5.0 | open |
| LF-20 | URL props have no host constraint | 043 | 0.5.0 | open |
| LF-21 | Widget-thrown text reaches host errors and `HostEvent`s | 041 | 0.4.1 | open |
| LF-22 | A `confirm` action can dispatch unconfirmed | [044](../plans/044-Phase-7-Part-AE-Intent-Boundary.md) | 0.5.0 | open |
| LF-23 | Intent identity: exactly-once dispatch and an idempotency key | 044 | 0.5.0 | open |
| LF-24 | `authorize` and `dispatch` receive no context | 044 | 0.5.0 | open |
| LF-25 | The A2UI converter's allocations are not bounded | 041 | 0.4.1 | open |
| LF-26 | Authoring runs drafts with host permissions and accepts unbounded drafts | 041 (bounds half); 043 (runner half) | 0.4.1; 0.5.0 | open |
| LF-27 | Hardening batch: six small defects | 041 | 0.4.1 | open |
| LF-28 | `Served` cannot be persisted | [045](../plans/045-Phase-7-Part-AF-Host-Session-Store-And-Transport.md) | 0.5.0 | open |
| LF-29 | Share one render across viewers with identical inputs | [050](../plans/050-Phase-7-Part-AK-Release-0-6-0-Scope-And-Host-Throughput.md) | 0.6.0 | open |
| LF-30 | Store reads are serial and a page has no batch | 045 | 0.5.0 | open |
| LF-31 | One tree is validated three or four times per request | 050 | 0.6.0 | open |
| LF-32 | Isolated-runner throughput | 050 | 0.6.0 | open |
| LF-33 | `Store` for multi-tenant database hosts | 045 | 0.5.0 | open |
| LF-34 | The validator cache holds eight catalogs | 041 | 0.4.1 | open |
| LF-35 | Incremental validation of patched trees | [046](../plans/046-Phase-7-Part-AG-Incremental-Validation-Streaming-And-Hydration.md) | 0.5.0 | open |
| LF-36 | The documented streaming loop is quadratic | [042](../plans/042-Phase-7-Part-AC-Release-0-4-1.md) (guide half); 046 (pull form, append patch, bench) | 0.4.1; 0.5.0 | open |
| LF-37 | A data channel beside the tree: typed resource handles | [051](../plans/051-Phase-7-Part-AL-Resource-Handles-View-State-And-Upload.md) | 0.6.0 | open |
| LF-38 | Finer patch operations | 050 | 0.6.0 | open |
| LF-39 | Hydration draws every node twice; no streaming server rendering | 046 | 0.5.0 | open |
| LF-40 | Embedding: a custom element, a DOM starter registry, style isolation | [052](../plans/052-Phase-7-Part-AM-Shortcuts-Drag-And-Drop-And-Embedding.md) | 0.6.0 | open |
| LF-41 | Benchmarks at adopter scale and a passing quiet-host gate | [049](../plans/049-Phase-7-Part-AJ-Release-0-5-0.md) | 0.5.0 | open |
| LF-42 | A second emit from one revision is dropped | 044 | 0.5.0 | open |
| LF-43 | Wider carriers: arrays in local state, selection sets, larger events | [047](../plans/047-Phase-7-Part-AH-Carriers-Navigation-And-Catalog-Structure.md); its handle-backed conformance case in 051 | 0.5.0 | open |
| LF-44 | Declared view state for primitives | 051 | 0.6.0 | open |
| LF-45 | Layout vocabulary gaps | [048](../plans/048-Phase-7-Part-AI-Layout-Recipes-Icons-And-Overlays.md) | 0.5.0 | open |
| LF-46 | Keyboard shortcuts | 052 | 0.6.0 | open |
| LF-47 | Drag and drop | 052 | 0.6.0 | open |
| LF-48 | A navigation intent and URL-bound state | 047 | 0.5.0 | open |
| LF-49 | File upload | 051 | 0.6.0 | open |
| LF-50 | Overlay behaviour in `/surface` | 048 | 0.5.0 | open |
| LF-51 | Recipe expressiveness and icon sets | 048 | 0.5.0 | open |
| LF-52 | Layouts as widgets: slot nodes, nested surfaces, cross-surface links | [053](../plans/053-Phase-7-Part-AN-Layouts-As-Widgets-And-Customization-Records.md) | 0.6.0 | open |
| LF-53 | Template language: sort, group, aggregate, format, dependencies | [054](../plans/054-Phase-7-Part-AO-Template-Language-Data-Bound-Surfaces-And-Stream-Repair.md) | 0.6.0 | open |
| LF-54 | Data-bound ephemeral surfaces | 054 | 0.6.0 | open |
| LF-55 | Customization records: placement revisions, scoped overrides, history | 053 | 0.6.0 | open |
| LF-56 | `classifyPackageChange` and placement rebase on upgrade | 053 | 0.6.0 | open |
| LF-57 | Editing an installed widget: read, patch, diff, propose | [055](../plans/055-Phase-7-Part-AP-Agent-Editing-Context-And-Evaluation.md) | 0.6.0 | open |
| LF-58 | Repair during a stream, not after it | 054 | 0.6.0 | open |
| LF-59 | Agent context: a digest by kind, strict-mode schemas, an element check | 055 | 0.6.0 | open |
| LF-60 | An agent evaluation harness with published success rates | 055 | 0.6.0 | open |
| LF-61 | Live-data preview | 055 | 0.6.0 | open |
| LF-62 | A client transport helper | 045 | 0.5.0 | open |
| LF-63 | Stability an adopter with stored documents can plan on | 043 | 0.5.0 | open |
| LF-64 | `hostSuite()`: conformance for an app's intent boundary | 044 | 0.5.0 | open |
| LF-65 | Security guide corrections and an adopter responsibility checklist | 042 | 0.4.1 | open |

### Boundary decisions

| Boundary | Requests | Decided in |
|---|---|---|
| Spec §14 "authorisation, approval flows, a storage backend": interfaces and reference implementations, no policy | LF-23; LF-28, LF-33; LF-55 | 044; 045; 053 |
| Spec §14 "layout shells" and nested surfaces | LF-52 | 053 |
| Spec §14 rule 2: tools that install, place or approve stay the app's | LF-57 | 055 |
| Law 2 and a second data path | LF-37 | 051 |
| Spec §5 "no product-shaped components" | LF-37, LF-43, LF-44 | 051 (LF-37, LF-44); 047 (LF-43) |
| The closed recipe and style-prop lists | LF-45, LF-51 | 048 |

### Further conflicts

| Conflict | Requests | Decided in |
|---|---|---|
| A stability rule for stored documents cannot hold for releases before it starts (0.3.0 broke stored documents on purpose) | LF-63 | 043 |
| Three items narrow `starter.ui@1`, which needs a starter catalog major: `image.src`, parent kinds, a declared icon set | LF-20, LF-51, backlog parent kinds | 043 (one decision for all three) |
| Spec §7.1, §8 and §11 make `confirm` the gate and `irreversible` presentation only; spec §7.7 says a stale origin is never rewritten | LF-22, LF-42 | 044 |
| Spec §7.7 Rule 1 and `decision-logs/2026-11-08-1115-stateless-host-pipeline.md` keep the host pipeline stateless | LF-28 | 045 |
| Spec §9.1 ("no incremental validation"), §7.2 (`push()` returns a tree) and §11 (hydration draws twice) | LF-35, LF-36, LF-39 | 046 |
| `decision-logs/2026-11-02-2208-multiple-variant-axes-for-0-3-0.md` offers no compound variants; `/surface` is host-API-free | LF-51, LF-50 | 048 |
| The quiet-host rule counts the benchmark itself and cannot pass in CI | LF-41 | 049 |
| `decision-logs/2026-11-19-1143-rendering-additions-for-0-4-0.md` rejected a custom element and starter DOM implementations; spec §2 names drag and drop as an app primitive's job; the Clay request recorded shortcuts as needing no library change | LF-40, LF-47, LF-46 | 052 |
| `docs/localisation.md`: the library ships no formatter | LF-53 | 054 |
| Spec §13: the authoring server has no store or data resolver | LF-57, LF-61 | 055 |

### Backlog priority raises

| Backlog heading | Before approval | Approved disposition | Plan |
|---|---|---|---|
| Re-run the full benchmark suite on a quiet host | P3 (open) | P1 | 049 |
| Revisit scoping only if nested surfaces become required | P4 | P1 | 053 |
| Evaluate an atomic-class route for strict style CSP | P3 | P2 | 048 |
| Render concurrently in the QuickJS runner | P3 | P2 | 050 |
| Do not carry a prior render's `patch`, `reset` or `migrated` on a skipped `renderPlacement` | P4 | P2 | 045 |
| Report a thrown or rejected `onIntent` through `SurfaceEvent` | P4 | P2 | 044 |
| Carry the manifest on `Served` or document the lookup | P3 (open) | with LF-28 | 045 |
| Gate the remaining request-time pipeline budgets in `bench/host.bench.ts` | P3 (open) | P2 | 049 |
| Let definitions declare their parent kinds | P3 | P2 | 047 |
| Give live filters a case-insensitive match | P3 (open) | P2 | 054 |
| Make the template structured-output schema usable in strict modes | P3 | P2 | 055 |
| Draw `$ref` and fragment documents progressively in `streamElements` | P4 | P3 | 054 |
| Add a `meter` kind and an interactive table to the starter | P4 | P2 | 051 |
| Capture overlays that are open inside a preview cell | P4 (open) | P3 | 055 |
| Later-phase gaps from the Phase 0 reports, G29 (forced colours and assistive technology audit) | P2, run waived | P2, run required | 049 |
| Composition surface gaps from the parity re-proof (`position: relative`, `basis` units) | P3 | with LF-45 | 048 |
| Run the new packages on macOS and Windows | P3 (open) | P3 | 049 |

The manifest entry keeps its P3 priority and is scheduled with LF-28. The open composition gaps keep P3 and are scheduled with LF-45. G29 keeps P2 and requires a native audit in plan 049, subject to any later owner-approved decline recorded there.

## Context

Synapta evaluated 0.4.0 at `93d20e7` and made resolution of the 48 requests and seventeen existing backlog items a condition of adoption. The request document identifies six spec boundaries. The plan surveys identified ten further conflicts that need a decision in the plan that handles them.

## Approval

- Proposed by the draft of plan 041.
- Approved by the project owner through the instruction to complete plan 041 Task 1, record its scope decision and apply its backlog raises. This records the four tables as written. The instruction names no exceptions or moves.

## Alternatives Considered

1. Decide scope one release at a time. That would leave no approved schedule for all the items that control Synapta’s adoption.
2. Settle the boundary designs in this decision. That would require design evidence from plans that have yet to do that work.
3. Ship the whole scope in one minor. The patch-safe fixes and guide changes can reach adopters earlier, while changes that require migration or host redesign have dedicated minor releases.

## Rationale and Evidence

- The 0.4.x compatibility promise preserves the public API, formats, store layout, published schema meanings, corpus expectations and hash vectors. The existing four 0.4.0 baselines and additive register gate protect that promise. The draft bounds and streaming guide can ship in 0.4.1, with the explicit authoring runner and incremental streaming work following in 0.5.0.
- The 0.5.0 plans cover stored documents, host and intent contracts, streaming and hydration, carriers and layout. The 0.6.0 plans build on those contracts for throughput, resource handles, embedding and agent customization.
- The 0.4.0 handoff retained open proof gaps. Quiet-host evidence goes to plan 049 with the benchmark gate decision. The prior G29 waiver applied to the earlier release, whose audit result cells remain open.

## References

- [Synapta’s request document](../plans/requests/synapta-0.4.0-requests.md)
- [Plan 041 Task 1](../plans/041-Phase-7-Part-AB-Request-Scope-And-0-4-1-Security-Hardening.md)
- [0.4.x compatibility promise](../docs/compatibility.md#040)
- [Spec §14](../docs/spec.md#14-non-goals-for-v1)
- [0.4.0 API stability tests](../src/__tests__/api-stability.test.ts)
- [Existing backlog](../plans/backlog.md)
- [0.4.0 benchmark evidence](../plans/evidence/040-bench-attempt-best.md)
- [G29 audit record](../plans/evidence/020-g29-audit.md)
- [Plan 056 adoption gate](../plans/056-Phase-7-Part-AQ-Release-0-6-0.md)

## Consequences

- Plan 041 can proceed with patch-safe hardening. Each minor still records its detailed scope, and the boundary designs still require their own decisions.
- Plan 049 owns the quiet-host gate and G29 evidence. The adoption gate remains open until plan 056 verifies every row’s disposition.
- If the owner moves or declines an item, the owning plan and ledger need the new disposition. A decline records the owner of the remaining problem.
