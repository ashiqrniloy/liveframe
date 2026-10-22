---
date: 2026-10-22 23:30
status: approved
decision_about: "The SDK, gen output, render contract, package loading and transpiler for Phase 2"
proposed_by: "both"
explicitly_approved_by_user: true
---

# Decision: The Phase 2 SDK and package contracts

## Decision

Four contracts are fixed for Phase 2:

1. **Components.** `liveframe gen <catalog> --out <file>` writes a typed TypeScript module that a widget imports by relative path (`./ui.gen`). Each primitive is bound with `primitive("<kind>")` from the SDK. It is source, not a `.d.ts`, and `pack()` bundles it like a composed component.
2. **Render contract.** `render(widget, inputs, { validator, surfaceId, revision, limits?, maxErrors? })` returns a bounded `Result<UiTree>`. `pack`, `verifyPackage` and `loadPlacement` take `{ catalog, capabilities }`. `Runner.render` takes `{ catalog, capabilities, surfaceId, revision, limits?, timeoutMs? }`.
3. **Loading.** The reference runners load a package's `code` with `import()` of a `data:` URL. The bare `@arnilo/liveframe/sdk` import resolves to the host's installed SDK.
4. **Transpiler.** `/pack` depends on `sucrase` (TS/JSX) and `acorn` (import/export analysis for linking). Both are pure JavaScript with no WebAssembly.

## Context

Plans [`005`](../plans/005-Phase-2-Part-A-SDK.md) and [`006`](../plans/006-Phase-2-Part-B-Packages-Storage-Runners.md) were drafted against spec §7.1–§7.5, whose SDK text was a sketch: it named no `render()` signature, no gen output shape, and no loader. Four questions were put to the owner while the plans were written:

1. Should `gen` emit `.d.ts` types, or a typed module the app imports?
2. Should `render()` take documents or a compiled validator, and return one error or many?
3. How does a runner load a package's code without importing host APIs into the core?
4. Which transpiler does `/pack` depend on?

The answers decide the SDK's public surface, so they are recorded here once and plan 006 consumes them unchanged.

## Approval

- Proposed by: both. The agent presented the options for each question; the owner chose.
- Approved by user: Yes
- Approval evidence: the owner's answers on 2026-10-22, recorded in `plans/005-Phase-2-Part-A-SDK.md` ("Task 1 records the contracts the owner approved on 2026-10-22, in answer to four questions asked while this plan was written") and enumerated there as the acceptance criteria of Task 1: a typed module imported by relative path; `render()` taking a compiled validator and returning a bounded `Result`; reference runners using `import()` of a `data:` URL; and `/pack` depending on sucrase and acorn.

Written at plan execution (2026-10-23 01:35 local). The decision and its approval are dated 2026-10-22.

## Alternatives Considered

1. **`gen` emits `.d.ts`, and `pack()` rewrites the import.** Rejected by the owner: an unpacked widget could not run, and packing would depend on a source rewrite.
2. **Types inferred at compile time from `defineComponent` literals.** Rejected: a catalog arrives as JSON at runtime, so an app needs emitted source, not a type-level derivation. (Also rejected in plan 005 Task 6.)
3. **`render()` takes the documents and caches the compiled validator by identity.** Rejected: the caching would be hidden from the caller, and every call would carry documents it does not use.
4. **`render()` returns a single `WidgetError`.** Rejected: it breaks spec §10's "every error, up to a bound", so an author or agent would fix errors one round trip at a time.
5. **A host-supplied `load(code)` hook on the runner.** Rejected: every host and every test would need a loader, and the reference runners would not work out of the box.
6. **`@babel/standalone` for the transpile step.** Rejected: about 6.5 MB for a job sucrase does in a fraction of that.
7. **`sucrase` alone, with no import analysis.** Rejected: import and export detection would depend on sucrase's output shape, which is not a stable contract.

## Rationale and Evidence

- **A generated module keeps a widget runnable.** The generated file is ordinary TSX-adjacent source. A widget imports it, `pack()` bundles it like any composed component, and an unpacked widget still runs — no `.d.ts` paired with a runtime import that does not exist.
- **A compiled validator is the one-pass design.** `compileValidator({ catalog, capabilities, manifest })` already compiles the catalog, vocabulary, capabilities and manifest into per-node closures (`src/validate/compile.ts:19`). Passing it to `render()` means the build pass calls `checkNode` and the structural checks as each node is emitted, with no second walk. `validateManifest` already takes `{ catalog, capabilities }` (`src/formats/manifest.ts:83`), so the other entry points take the same pair.
- **Bounded errors, not fail-fast.** The proof throws on the first error. Spec §10 bounds a list, default 20, and agents benefit from fixing a render in one round. Input-schema failures are `invalid-prop` with a pointer into the inputs and no `nodeId`, because no node exists yet.
- **`data:` URL loading is measured, not assumed.** Spike, 2026-10-22, Bun 1.4.2: `import()` of a `data:` URL resolving a bare package import worked in-process and inside a `Worker`. The loader is the only place in the library that needs a dynamic `import(`; it lives in `/preview`, and the portability scan names that one exception so every other file still fails closed. A host whose sandbox forbids it supplies its own `Runner` — which it may do anyway, since the runners are not an isolation boundary.
- **sucrase and acorn are small and pure.** Both are plain JavaScript, no WebAssembly, so `/pack` stays host-API-free and runs wherever the app installs widgets. Justification and the exact versions are added with the dependency in plan 006 Task 4.

## References

- `plans/005-Phase-2-Part-A-SDK.md` — the task that records and applies these contracts.
- `plans/006-Phase-2-Part-B-Packages-Storage-Runners.md` — consumes them; adds sucrase and acorn in Task 4.
- `src/validate/compile.ts:19` — `compileValidator({ catalog, capabilities, manifest })`.
- `src/formats/manifest.ts:83` — `validateManifest(doc, { catalog, capabilities })`.
- `docs/spec.md` §7.1–§7.5, §13, §14 — updated by this decision.
- `docs/model.md` steps A3 and C4 — updated by this decision.
- `decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md` — why building and validating must be one pass.
- Synapta `scripts/widgets/gen-sdk.ts` — its generated module lives inside its SDK package; a reference-host gap, recorded rather than accommodated.

## Consequences

- `render()` is one pass over freshly built nodes: the budget is measured in plan 005 Task 8.
- Every render is deterministic given the same package, inputs and options; inputs are checked once per resolution.
- The reference runners depend on `data:` URL module loading. A runtime or sandbox without it needs a host `Runner`.
- `/pack` carries two new runtime dependencies. A dependency-free `/pack` would need a hand-written TS/JSX transform, which is not planned.
- Revisit if a sandbox cannot resolve a `data:` URL even with the host's own loader, or if a smaller pure-JS transpiler covers TS/JSX and import analysis.
