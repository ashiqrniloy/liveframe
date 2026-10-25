# Packages and storage

## Target

Spec §7.3 (packages), §7.4 (storage), §8 (state, re-run cache). Roadmap Phase 2 Part B. Decision: `decision-logs/2026-10-22-1539-widget-packages-and-reference-stores.md`.

- `pack({ files, entry, manifest, scenarios }, { catalog, capabilities })` checks the manifest and at least one scenario (params, state and context against the manifest's schemas, data keyed by declared sources), transpiles the TSX, bundles relative imports into one ES module (default export: the widget) and hashes the canonical manifest, code and scenarios with SHA-256. Only the SDK may stay an import.
- `verifyPackage(pkg, { catalog, capabilities })` re-checks the format, the manifest and the hash. It never executes code.
- Records: package `(id, version)`, placement `id` (`{ id, slot, widget: { id, version }, params }`), state per placement, style `(kind, id, version)`.
- `Store` is async and dumb: it persists records and refuses a second hash under an existing `(id, version)` with a `LiveframeFailure` (`version-conflict`). `deletePlacement` removes the placement's state. Reads are keyed: `getPlacement(id)` returns one placement or `undefined`.
- `loadPlacement(store, id, { catalog, capabilities })` reads one placement with `getPlacement()` — never `listPlacements()` — so a malformed sibling record cannot block a load (P6), then verifies the placement, package and state. A state that no longer fits its schema is reset to the manifest's initial state, and the reset is reported. Every other failure is a typed error.
- `memoryStore()` lives in `/store`. `fileStore(dir)` lives in `/store/fs`: one JSON file per record, atomic writes (temp file, then rename), one writing process. Segments are percent-encoded; a segment encoding to more than 200 bytes is named `~` + the SHA-256 hex of its UTF-8 bytes, so every id the formats allow (128 code points) fits `NAME_MAX` (255 bytes) — the layout is a 0.1.x compatibility promise.

Rules:
- `pack()` never runs widget code. Liveframe ships no sandbox.
- A record read back from a store is untrusted until verified.
- No approval states, tenancy or database backend in the library. They belong to the app.
- The transpiler is a runtime dependency of `/pack` only. It must be pure JavaScript and host-API-free (no WebAssembly, spec §13), and justified in Part B's plan.

## Today

- Shipped: `/pack` exports `pack`, `verifyPackage`, `validateScenario`, `validateWidgetPackageShape` and types `WidgetPackage`, `Scenario`. Results are `Result<WidgetPackage>`; failures are bounded to 20 errors. Verification also re-parses code and checks SDK-only imports. Neither executes code.
- `/store` exports `Store`, `Placement`, `StyleRecord`, `memoryStore`, `loadPlacement`, `validatePlacement`, `validateState` and `validateStyleRecord`. `/store/fs` exports `fileStore`. Stores isolate records from caller mutation, preserve same-hash packages, reject second hashes with `version-conflict`, sort placements and delete placement state with its placement.
- `loadPlacement` returns `Result<{ package, params, state, reset? }>`. Missing state uses initial state without a reset; invalid state reports validation errors in `reset`. Loading never writes a reset back. Missing records, bad params, identity mismatch and verification failures reject loading; other I/O failures can reject the promise.
- File paths encode every byte except lowercase ASCII letters, digits, underscore and hyphen as `%XX`. Writes use a same-directory temporary file and rename, assuming one writing process. This is not a multi-record transaction.
- Implementation: `src/pack/`, `src/store/`, `src/store/fs/`. Published transport schemas: `schemas/widget-package.json`, `placement.json`, `style-record.json`. SHA-256 checks integrity, not origin or approval; changes need new versions, rollback changes the placement reference.
- Outsider guide: `docs/packages.md`. `src/__tests__/phase-2-loop.test.ts` runs its example and proves the install/reload/render loop. `/conformance` exports `storeSuite`, `ConformanceCase` and `ConformanceFailure`. Both reference stores register its independent cases; `fileStore` supplies `reopen` to prove persistence. Each `create` must open a fresh, empty scope; the caller owns cleanup. See `docs/conformance.md` for registration and limits: passing does not prove tenant isolation, authorization or crash durability.
