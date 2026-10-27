---
date: 2026-10-27 20:28
status: approved
decision_about: "0.2.0 scope, breaking changes and state-scope isolation"
proposed_by: "both"
explicitly_approved_by_user: true
---

# Decision: Release 0.2.0 scope and breaking changes

## Decision

The next release is **0.2.0**, not 0.1.1. It includes LF-01 to LF-17, CL-01 to CL-09 and every backlog item raised by the two adoption request documents, through plans 014–020 below. LF-05 uses option A: object-carrying events. Custom stores must isolate state by scope and fail closed if they cannot; silently ignoring scope is not conformant.

This records release scope, not completion or permission to publish. Each area's first task settles its remaining design choices; plan 020 proves acceptance against the checkout and the installed release candidate before the owner's release go.

## Context

The two adopters analysed the published 0.1.0 package. Clay's request document originally requested 0.1.1 but accepts 0.2.0 if every item is present. Synapta originally staged LF-13–LF-17 after 0.2.0. The owner's 2026-10-27 directive, recorded in plan 014 Task 1 and now authorized for execution, brings all of them into 0.2.0. The original target columns remain historical evidence, not the release schedule.

R15 permits public API breaks at a minor version during 0.x, with an earlier deprecation where feasible. 0.1.0 is the only stable release; no intervening 0.1.x deprecation release is planned. The format identifiers remain `/1`: the planned optional fields, schema forms and enum values are additive, and existing valid documents retain their meaning. A later task finding a conflict with that promise must resolve it explicitly rather than silently reinterpret a format.

## Approval

- Proposed by: both (the owner's release scope and option A; the agent's fail-closed recommendation).
- Approved by user: Yes.
- Approval evidence: on 2026-10-27 the user instructed, “Complete - [ ] Task 1: Record the 0.2.0 scope and its breaking changes” from plan 014. That task explicitly records the owner's same-day 0.2.0 directive and LF-05 option A choice.
- Asked directly whether a custom `Store` that ignores viewer scope must fail closed, the owner answered: “Yes — require scope isolation and fail closed (recommended)”. Plan 015's store suite must include the scope-isolation case, and both reference stores must pass it. An implementation unable to honor a requested scope must reject it instead of falling back to shared state. This is a store contract and conformance obligation; TypeScript signatures alone cannot prove a custom implementation isolates state.

## Plan map and scope

Execute in dependency order; each plan depends on its predecessor, and 020 requires 014–019 complete, including their impact analyses.

| Plan | Area and requests |
| --- | --- |
| [014](../plans/014-Phase-7-Part-A-Release-Scope-Packaging-And-Schema-Language.md) | Release scope; packaging (CL-03); shipped-docs wording (LF-03); schema minimums, nullable and discriminated unions (LF-04); source-outcome envelope and scenarios (LF-12). |
| [015](../plans/015-Phase-7-Part-B-Events-Manifests-Capabilities-And-State.md) | Object events, option A (LF-05); scoped state (LF-06); manifest description and host metadata (LF-07); semantics (LF-09); capability pruning (LF-14); height bounds (CL-07); numeric events, including integer (CL-08). |
| [016](../plans/016-Phase-7-Part-C-Styling-Paint-Alpha-Contrast-And-Native-Parts.md) | Contrast pairs, including Clay's upper bound and ordering requirement (LF-10); role alpha (LF-11); no-paint recipe value (CL-04); placeholder and scrollbar recipe properties; G30 icon tone, G31 tab count slot and G2 Certified identity and diagnostic fill roles. |
| [017](../plans/017-Phase-7-Part-D-Renderer-And-Preview-Host-Integration.md) | Intent origin and offered-intent checks (LF-01); irreversible actions and confirmation metadata (LF-08); controlled and URL-keyed Preview with explicit result scenario (CL-01); wrapper and portal hooks (CL-02); reduced transparency (CL-09); generated implementation types for JSON-loaded catalogs. |
| [018](../plans/018-Phase-7-Part-E-Runner-Kit-Capture-And-Authoring-Library.md) | Public generation and capture functions (LF-02); capture backend injection (CL-05); in-sandbox runner kit and single-file bundle (LF-13); authoring library (LF-15); cap or report the in-process runner's module memory. |
| [019](../plans/019-Phase-7-Part-F-Agent-Surfaces-Conformance-Corpus-And-Engines.md) | Ephemeral agent surfaces (LF-16); measure streaming updates and decide whether patches are justified (LF-17); language-neutral conformance corpus and canonical-hash vectors (CL-06); WebKit/Firefox and other-runner conformance verification, WebKit first. |
| [020](../plans/020-Phase-7-Part-G-Release-0-2-0.md) | Owner's git-status labels fixture decision; G29 native Windows forced-colours and assistive-technology audit; migration guide, adoption notes and per-request acceptance matrix; registry candidate, agent acceptance, readiness review and release. |

The table includes every named backlog item raised by the requests. Other-runner verification remains subject to the Bun-only tooling rule and an explicit recorded disposition if unavailable. G29 needs the owner's hardware/auditor; defects must be fixed or explicitly deferred by the owner and named in release notes. LF-17 requires measurements and an accepted patch decision, not an unconditional patch API. These are the existing acceptance gates, not blanket deferrals.

## Breaking changes and migrations

This is the initial break register. Each later plan must record any additional break with its migration and earlier-deprecation rationale here and in `docs/compatibility.md` before completion; plan 020 consolidates the final migration guide. Area logs settle implementation details without treating an unapproved new break as already authorized.

| Break | Migration from 0.1.0 | Why no earlier 0.1.x deprecation |
| --- | --- | --- |
| **Store state methods (LF-06).** `putState(placementId, scope, state)` and `getState(placementId, scope)` replace `putState(placementId, state)` and `getState(placementId)`. Deleting a placement deletes every scope. | Update custom stores and every caller. Use `""` for intentionally shared state; otherwise use an opaque host-selected viewer/session scope. Pass `{ scope }` to `loadPlacement`, or supply explicit `{ state }` to use its validation/reset rules without reading stored state. Run `storeSuite`, including scope isolation and deletion across scopes. Reject unsupported scopes; never silently ignore them. | An optional trailing parameter would let old stores silently share viewer state. With only 0.1.0 released, retaining that unsafe fallback for a deprecation cycle is rejected; a required signature and isolation proof land together at the permitted minor boundary. |
| **Preview result props (CL-01).** Results require an explicit `resultScenario`; their scenario is no longer inferred from the current URL/selection. | Pair each `result` with the scenario actually rendered. Hosts owning navigation supply `selection` and `onSelect`; multiple uncontrolled previews supply distinct `urlKey`s. Controlled selection and URL keys are additive; explicit result labeling is the breaking requirement. | The inferred scenario is the bug: retaining it during a deprecation cycle can mislabel or retain scenario A's tree as B's. Fix it at this minor release instead of publishing an intermediate 0.1.x that preserves inference. |
| **Capture's public home (LF-02/CL-05).** Reopen plan 011 decision D3, which kept capture CLI-only; the core becomes `/preview/capture` with an injected backend and returned artifacts. | Replace source/deep-import integrations with `import { capture } from "@arnilo/liveframe/preview/capture"`, provide the backend and consume `{ index, files }`. The CLI and MCP adapters keep their existing user-facing capture behavior. `/sdk/gen` separately exposes generation as an additive export. | 0.1.0 exports no capture function or subpath, so there is no supported function to mark deprecated. Record the architectural/API-home break now; plan 018 explicitly supersedes D3 and settles the backend interface. |

## `fileStore` layout

The compatibility promise makes the layout stable within 0.1.x, but also promises later releases can read an existing directory without an export. 0.2.0 preserves `states/<id>.json` as shared scope `""`; non-empty scopes use `states/<id>/<scope>.json`, with the existing safe key-to-filename encoding. Other stored records retain their meaning. Plan 015 pins legacy reads with a script-generated 0.1.0 fixture and tests deletion across all scopes. No bulk rewrite or export/import is required. This is a forward-read promise, not a promise that 0.1.0 understands new scoped files.

## Alternatives Considered

1. **0.1.1 with an R15 exception** — rejected by the owner's 0.2.0 directive; the existing minor-version rule already permits the interface breaks.
2. **Leave LF-13–LF-17 at their original later targets** — rejected by the directive to include every request before adopter migration.
3. **Optional trailing Store scope** — rejected because old implementations can accept the call while ignoring scope and exposing another viewer's state.
4. **LF-05 option B, named bindings** — rejected by the owner's option A choice; object-carrying events reuse the schema language rather than introduce another emitter contract.
5. **Keep capture CLI-only under D3** — rejected for this scope: both adopters need function calls and an injected backend rather than CLI/MCP as internal transport. Plan 018 records the detailed replacement.

## Rationale and Evidence

The request documents describe general gaps using adopter evidence; their acceptance bullets, including Clay's extra LF-10 contrast constraints, remain binding inputs to the later plans. R15 and `docs/compatibility.md` already distinguish minor API breaks from stable format meanings. The plan map assigns every request and named backlog item to concrete work, while plan 020 requires checkout and installed-candidate evidence rather than treating this scope record as proof of delivery.

None of these additions grants widget code authority (law 4) or a path to colours or raw CSS (law 3). Scope and metadata are host data, never authorization. Object events and ephemeral trees remain validated data, and runner-kit code does not supply an isolation boundary. Laws 1 and 2 also remain unchanged.

## References

- [Synapta requests](../plans/requests/synapta-adoption-requests.md) — LF-01–LF-17 and G30/G31/G29/G2.
- [Clay requests](../plans/requests/clay-adoption-requests.md) — CL-01–CL-09, extra acceptance items and five backlog items.
- [R15](2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md) — compatibility and earlier deprecation where feasible.
- [Plan 011 D3](2026-10-24-2330-authoring-mcp-server-contract.md) — capture's CLI-only decision, reopened here for plan 018.
- [Compatibility](../docs/compatibility.md) — versions, growth and legacy directory reads.
- [Spec](../docs/spec.md) §2, §5, §7.4, §7.5 and §13 — laws, schema language, storage, runners and packaging.
- [Roadmap](../roadmap.md) Phase 7 and §3 — reference-host scope and execution ledger.

## Consequences

- Adopters can target one verified minor release before storing the new records and integrating the new APIs.
- Store implementers and Preview hosts must migrate; unsafe scope fallback is forbidden. Existing fileStore directories remain readable.
- New keywords and surfaces are implemented and documented by their own tasks; this decision does not describe them as shipped today.
- Any additional API break or conflict with `/1` semantics requires an explicit recorded resolution and migration. Publishing, the git-status fixture choice and audit dispositions remain gated by their later owner decisions.
