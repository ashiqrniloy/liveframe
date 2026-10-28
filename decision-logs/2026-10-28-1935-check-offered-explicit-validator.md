---
date: 2026-10-28 19:35
status: approved
decision_about: "Explicit schema context for checkOffered"
proposed_by: "both"
explicitly_approved_by_user: true
---

# Decision: Give checkOffered an explicit compiled validator

## Decision

`checkOffered(tree, origin, intent, validator): Result<void>` requires the host's compiled validator as its fourth argument. This supersedes the three-argument signature in [plan 017 Task 1's decision](2026-10-28-1756-renderer-and-preview-host-integration.md), §1. The origin and completion rules are unchanged.

## Context

The JSON `UiTree` carries event intents but no catalog event schemas, manifest state schemas or capability argument schemas. Three arguments cannot check filled values against those schemas without hidden context. Trees also cross runner and browser JSON transports.

## Approval

- Proposed by: both.
- Approved by user: Yes.
- Approval evidence: on 2026-10-28, the user selected “Add a required compiled validator argument; keeps the check explicit across JSON transports (recommended).”

## Alternatives Considered

1. **Three arguments with prior validation of the same tree object** — rejected by the user's choice; object identity does not survive JSON transport and creates a hidden prerequisite.
2. **Compare intent shape only** — rejected; it cannot enforce the approved filled-value schema checks.

## Rationale and Evidence

`src/formats/tree.ts` defines a transport tree without schemas. `src/validate/compile.ts` compiles the catalog, capabilities and manifest; `src/validate/intent.ts` already checks completed state values and action arguments. Reusing these checks with explicit context preserves the host-API-free core.

## References

- `plans/017-Phase-7-Part-D-Renderer-And-Preview-Host-Integration.md`, Task 2.
- `src/formats/tree.ts`, `src/validate/compile.ts`, `src/validate/intent.ts`.

## Consequences

- A host can check a JSON-loaded tree with its own validator.
- The first check validates and indexes the served tree; subsequent checks reuse the index and validation for that tree/validator pair. Hosts must treat served tree objects as immutable and replace them when changing a surface.
- Preview sessions retain a validator for their current package and pass it internally.
