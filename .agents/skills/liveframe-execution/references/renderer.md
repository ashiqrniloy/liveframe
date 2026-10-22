# Renderer and conformance

## Target

Spec §11 (renderer), §8 (interaction tiers). Roadmap Phase 4 (renderer) and Phase 5 (conformance).

- `<Surface tree onIntent fallback />` draws one surface.
- `implement(definition, Component)` binds a primitive. The component receives:
  - `props`, validated
  - `slot(name)`, the classes for that slot in its current variant and state
  - `emit(event, value?)`
  - children, already rendered
- At startup, a registry check fails if a catalog kind has no implementation.
- Nodes render keyed by `id`, so focus, scroll and local state survive re-renders. A tree with a lower `revision` is ignored.
- Unknown or invalid nodes render the app's `fallback`, never nothing. The renderer re-checks structure on arrival.
- Server-side rendering is supported.
- Tier 1 lives inside primitives. `setState` and actions go to `onIntent`, and the app passes the new tree back.
- Conformance: shared suites (documents plus interactions) that an app runs against its catalog, design system and renderer.

Recommended, not required: build interactive primitives on React Aria for accessibility. Check its current API with `find-docs`.

## Today

Not built.
