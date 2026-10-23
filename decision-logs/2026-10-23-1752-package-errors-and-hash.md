---
date: 2026-10-23 17:52
status: approved
decision_about: "Package, store and runner errors and canonical package hashes"
proposed_by: agent
explicitly_approved_by_user: true
---

# Decision: Bounded typed results and canonical SHA-256 package hashes

## Decision

`pack()`, `verifyPackage()`, `loadPlacement()` and `Runner.render()` return `Result<T>` with bounded `LiveframeError[]` (default 20), wrapped in a promise for async operations. Add `forbidden-import`, `transpile-failed`, `hash-mismatch`, `version-conflict` and `not-found`; malformed manifests, scenarios and records retain `invalid-document`, with missing scenarios at `/scenarios`. Hash the UTF-8 RFC 8785 canonical JSON of exactly `{ format, manifest, code, scenarios }` with synchronous internal pure-JavaScript SHA-256, returning `sha256-` plus 64 lowercase hexadecimal digits.

## Context

Plan 006 Task 1 settles the contracts before package, store and runner implementation. Existing `Result<T>` and `LiveframeError` already serve validators and SDK rendering; packages need deterministic hashes and failures a host can distinguish without parsing messages. Spec §7.3 requires synchronous, host-API-free packing.

## Approval

- Proposed by: agent, following plan 006 Task 1's recommendation.
- Approved by user: Yes.
- Approval evidence: The user answered “Approve the recommended contract” to the question naming the bounded results, five error kinds, RFC 8785 canonical JSON, exact hash fields, hexadecimal encoding and synchronous pure-JavaScript SHA-256.

## Alternatives Considered

1. **Use `invalid-document` for every failure.** Rejected: callers cannot distinguish a version conflict, missing record or integrity failure without parsing messages.
2. **Web Crypto.** Rejected: its asynchronous digest would change synchronous packing and introduce a host capability requirement.
3. **Base64 digests.** Rejected: lowercase hex is directly usable in filenames and URLs without escaping.
4. **A hashing dependency or Bun's hasher.** Rejected: the former adds a runtime dependency for a small implementation; the latter violates the host-API-free core. Bun's hasher remains suitable as a test oracle.

## Rationale and Evidence

RFC 8785 §3.2 specifies recursive object-key sorting by unescaped UTF-16 code units, unchanged array order, no whitespace, ECMAScript primitive serialisation and UTF-8 output. Its input rules reject non-finite numbers and lone surrogates and preserve Unicode without normalisation. FIPS 180-4 §6.2 defines SHA-256; applying it to these canonical bytes makes object insertion order irrelevant to the package hash.

`format` participates in the hash and `hash` itself does not. Import violations include non-SDK external imports or re-exports, `require(…)`, `import.meta` and dynamic `import()`; relative widget modules may be bundled. Syntax errors carry their file and line in `pointer`. Stores retain the async interface in spec §7.4: `putPackage()` rejects with a typed version conflict, while missing placement/package reads become `not-found` through `loadPlacement()`.

## References

- [RFC 8785 §3.2](https://www.rfc-editor.org/rfc/rfc8785.html#section-3.2) — canonical JSON rules, reviewed for this task.
- [FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf), §6.2 — SHA-256 definition.
- `docs/spec.md` §7.3, §7.4, §7.5 and §10 — package, store, runner and error contracts.
- `src/errors.ts` — existing shared result shape and default error bound.
- `decision-logs/2026-10-22-1539-widget-packages-and-reference-stores.md` — immutable packages and untrusted store reads.
- `decision-logs/2026-10-22-1600-preview-and-runners.md` — required hashed scenarios and backend runners.
- `plans/006-Phase-2-Part-B-Packages-Storage-Runners.md`, Task 1 — recommended contract and approval gate.

## Consequences

- Spec §10 owns one complete error-kind list, checked against the TypeScript union by `error_kinds_match_spec`.
- Tasks 2–9 implement formats, hashing, packing, storage and runners against this contract; this task adds no hashing or runner implementation.
- The internal SHA-256 implementation requires known-vector and independent-oracle tests in Task 3. This decision does not claim NIST implementation validation.
- Hashes detect content changes; they do not authenticate origin or grant approval. Those remain the host's policy.
