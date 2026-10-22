# Packages and storage

## Target

Spec §7.3 (packages), §7.4 (storage), §8 (state, re-run cache). Roadmap Phase 2 Part B. Decision: `decision-logs/2026-10-22-1539-widget-packages-and-reference-stores.md`.

- `pack({ files, entry, manifest, scenarios }, catalog)` checks the manifest and at least one scenario (params, state and context against the manifest's schemas, data keyed by declared sources), transpiles the TSX, bundles relative imports into one ES module (default export: the widget) and hashes the canonical manifest, code and scenarios with SHA-256. Only the SDK may stay an import.
- `verifyPackage(pkg, catalog)` re-checks the format, the manifest and the hash. It never executes code.
- Records: package `(id, version)`, placement `id` (`{ id, slot, widget: { id, version }, params }`), state per placement, style `(kind, id, version)`.
- `Store` is async and dumb: it persists records and refuses a second hash under an existing `(id, version)`. `deletePlacement` removes the placement's state.
- `loadPlacement(store, id, catalog)` reads and verifies the placement, package and state. A state that no longer fits its schema is reset to the manifest's initial state, and the reset is reported. Every other failure is a typed error.
- `memoryStore()` lives in `/store`. `fileStore(dir)` lives in `/store/fs`: one JSON file per record, atomic writes (temp file, then rename), one writing process.

Rules:
- `pack()` never runs widget code. Liveframe ships no sandbox.
- A record read back from a store is untrusted until verified.
- No approval states, tenancy or database backend in the library. They belong to the app.
- The transpiler is a runtime dependency of `/pack` only. It must be pure JavaScript and host-API-free (no WebAssembly, spec §13), and justified in Part B's plan.

## Today

Not built.
