# The SDK

## Target

Spec §7 (authoring), §8 (interaction). Roadmap Phase 2.

- `jsx`, `jsxs` and `Fragment` under `jsxImportSource: "@arnilo/liveframe/sdk"`, plus `/sdk/jsx-dev-runtime`. Elements are frozen records keyed by primitive kind.
- Widgets are pure and synchronous: `(params, state, data, context) → one root element`, with all inputs frozen. Time and randomness come only through `context`.
- Composed components are plain TSX functions, expanded when the widget runs. The tree holds primitives only.
- Ids are key paths. Elements in a list need a `key`.
- `state.set(key, value?)` and `action(name, args)` return frozen intent data. One intent per event.
- `render(widget, inputs, { catalog, actions })` returns a validated UI tree or a `WidgetError` of one of the spec §7.2 kinds.
- `liveframe gen <catalog>` emits one typed component per definition. `--check` fails on drift.

Prior art to read (not to copy blindly): Synapta's `packages/synapta-widget-sdk/src/{jsx-runtime.ts,render.ts,intents.ts,errors.ts}` and `scripts/widgets/gen-sdk.ts`. Synapta uses positional ids; Liveframe uses key paths.

Rules:
- The runtime is host-API-free; a test bundles it and scans for `node:`, `bun:`, DOM globals and `require(`.
- Host elements (`<div>`), function props, promises and async renders are errors.

## Today

Not built.
