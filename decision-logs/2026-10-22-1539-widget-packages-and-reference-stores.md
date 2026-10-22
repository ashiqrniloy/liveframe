---
date: 2026-10-22 15:39
status: approved
decision_about: "How runtime changes persist across app launches"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Liveframe ships widget packaging, record formats and a storage interface with reference stores, not a database

## Decision

Liveframe takes over the install path a host would otherwise rebuild. It adds three pieces:

- `pack()` turns widget TSX and a manifest into an immutable, content-addressed **widget package**.
- **Record formats** for packages, placements, placement state and installed themes and design systems.
- A small async **`Store` interface** with two reference stores, `memoryStore()` and `fileStore(dir)`, plus a conformance suite any host store can run.

The host still chooses the backend (its database, tenancy, encryption) and keeps approval and authorisation. This replaces the v1 non-goal "no storage" with "no storage backend".

## Context

The owner asked how a host keeps the changes made at runtime, so that the next launch shows them, and whether Liveframe could ship that so each host doesn't have to.

Every runtime change in Liveframe is a document, never an edit to the app's code: widget source and manifest, a theme or design system, a placement (`widget@version` plus params in a host slot) and per-placement state (spec §8). Persisting changes therefore means storing those documents and reloading them at startup. Before this decision the spec left all of it to the host (spec §3, §14), so every host would define its own record shapes, versioning and reload rules.

Review also found a gap: an author writes `.tsx`, but a sandbox runs JavaScript. The spec named no step that transpiles a widget and bundles its composed components, so each host would have had to build one.

## Approval

- Proposed by: agent, in answer to the owner's question.
- Approved by user: Yes
- Approval evidence: "Let's go with your recommendation. Update the docs and roadmap accordingly".

## Alternatives Considered

1. **Status quo: formats and storage stay entirely the host's.** Not chosen. Each host would reinvent the package shape, versioning, transpiling and reload checks. Liveframe's guarantees (immutable versions, hash-keyed re-run caching, validation) would hold only where a host rebuilt them correctly.
2. **Formats only (package and record formats plus `pack()`, no `Store` interface).** Not chosen. Hosts would still each write the same read/write and validate-on-load glue, and there would be nothing to run a shared conformance suite against.
3. **Full storage: Liveframe owns a database layer with tenancy, migrations and approval states.** Rejected. Tenancy, authorisation and approval are policy that differs per app. A multi-tenant web platform (Synapta) and a desktop editor (Clay) need different backends. This is the same reasoning as the founding decision's alternative 4, which kept placement and approval policy out of the library.

## Rationale and Evidence

- **Runtime changes are already data.** Spec §2 keeps widget code out of the app's build, and §6 makes themes and design systems inert data, so persistence is document storage and needs no code-generation or migration machinery.
- **Immutable, content-addressed packages fit the existing model.** Spec §8 already caches re-runs on a hash of the widget id, version and inputs. A package whose `(id, version)` maps to exactly one SHA-256 makes that hash trustworthy, and rollback becomes pointing a placement at an older version.
- **`pack()` never executes widget code.** Liveframe ships no sandbox (spec §3), so `pack()` only checks the manifest, transpiles, bundles relative imports and hashes. A test render belongs to the host, in its sandbox, as part of its approval.
- **A stored record is untrusted.** The renderer already re-checks trees it receives (spec §10). Records read from a store are re-verified the same way: package hash and manifest, placement against the package's params schema, and state against its state schema. A tampered file or row is rejected, not run.
- **The interface is small and the backends are the host's.** One interface plus two reference stores covers tests, desktop and single-node hosts, and gives a multi-tenant host a contract and a conformance suite for its own database store.
- **Subpaths keep the core host-API-free.** `/pack` and `/store` import no host APIs. Only `/store/fs` reads the file system, as `/react` and `/css` are the existing exceptions.

Assumptions, to be checked in the phase's plan:

- A transpiler that is pure JavaScript and host-API-free exists and is small enough to justify as a new runtime dependency (roadmap rule). Spec §13 rules out WebAssembly, so a WASM build doesn't qualify. The plan must pick and justify one.
- A file store that writes atomically (write a temporary file, then rename) is enough for a single-process host. Concurrent writers across processes are out of scope for the reference store.

## References

- `docs/spec.md` §3, §7.3–§7.4, §8, §13, §14 — updated by this decision.
- `docs/model.md` — install-time and relaunch steps, and the ownership table.
- `roadmap.md` §2 — Phase 2 Part B, Phase 5 and Phase 6.
- `decision-logs/2026-10-21-2017-liveframe-founding-model.md`, alternative 4 — placement and approval policy stays the app's.
- `proof/widgets/agent-home/manifest.ts` — the proof keeps the widget's initial state (`initialQueueState`) beside its schemas. The spec's manifest now declares it, because a new placement and a reset both need it.

## Consequences

- Spec §3 and §14 change from "no storage" to "no storage backend". New spec §7.3 (packages) and §7.4 (storage) are normative.
- The roadmap's Phase 2 gains Part B (packages and storage). Phase 5 adds a store suite. Phase 6's demo host persists through `fileStore` and must show a widget, its placement and its state surviving a restart.
- A transpiler becomes a runtime dependency of `/pack` only, justified in Part B's plan.
- Revisit if a reference host needs cross-package shared modules (today each package bundles its own copy), migrations of state between widget versions beyond reject-and-reset, or concurrent multi-process writes to a file store.
