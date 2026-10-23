# Renderer and conformance

## Target

Spec §11 (renderer), §8 (interaction tiers). Roadmap Phase 4 (renderer) and Phase 5 (conformance).

- `createRenderer({ catalog, implementations })` runs the startup registry check (missing, duplicate or mismatched kind) and returns `{ Surface }`.
- `<Surface tree validator theme designSystem onIntent fallback />` draws one surface. `validator` is the app's `CompiledValidator`; every arriving tree is re-checked with it.
- `implement(definition, Component)` binds a primitive. The component receives:
  - `props`, validated
  - `slot(name)`, the one recipe class for that slot (the root slot adds style-prop classes only)
  - `style`, the root's inline style-prop declarations
  - `emit(event, value?)`
  - `children`, already rendered
  - `items`, child node contexts with `id`, `kind`, `variant`, `props`, `slot(name)`, `style`, rendered `children`, `render()` (through the child's implementation) and `emit(event, value?)`, for collection primitives
  - `portal`, the scoped overlay container or undefined
- `<Surface>` renders its own wrapper and sibling portal container, both carrying `surfaceAttributes({ theme, designSystem, tree })`: scope attributes, `lf_surface` and, for responsive trees, `lf_container`. Node slots and parents of responsive nodes gain no scope classes.
- Arrival order: validate before reading any tree field, then compare revisions. A lower `revision` for the same `surfaceId` is ignored; a different `surfaceId` replaces the tree. Nodes render keyed by `id`, so focus, scroll and local state survive re-renders.
- An invalid tree renders `fallback` for the whole surface (never part of an invalid tree). An implementation that throws renders `fallback` at that node through an error boundary.
- `emit()` checks values against the definition's `carries`; a mismatch throws and raises no intent. `onIntent` receives complete intents: fill a missing `setState.value`, or fill action `args[bind]` and remove `bind`. Preserve explicit state values; the host re-checks the filled intent.
- Changing `theme` / `designSystem` runs the §6.4 switching sequence on the wrapper and portal together. Overlay exit motion, scroll lock and inert background are delivered by the app's implementations (e.g. React Aria) and proved by browser tests.
- Contracts: `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md`.
- Server-side rendering is supported.
- Tier 1 lives inside primitives. `setState` and actions go to `onIntent`, and the app passes the new tree back.
- Conformance: shared suites (documents plus interactions) that an app runs against its catalog, design system and renderer.

Recommended, not required: build interactive primitives on React Aria for accessibility. Check its current API with `find-docs`.

## Today

Not built.
