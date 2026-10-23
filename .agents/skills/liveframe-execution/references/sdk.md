# The SDK

## Target

Spec §7 (authoring), §8 (interaction). Roadmap Phase 2.

- `jsx`, `jsxs` and `Fragment` under `jsxImportSource: "@arnilo/liveframe/sdk"`, plus `/sdk/jsx-dev-runtime`. Elements are frozen records keyed by primitive kind.
- Widgets are pure and synchronous: `(params, state, data, context) → one root element`, with all inputs frozen. Time and randomness come only through `context`.
- Composed components are plain TSX functions, expanded when the widget runs. The tree holds primitives only.
- Ids are key paths. Elements in a list need a `key`.
- `state.set(key, value?)` and `action(name, args)` return frozen intent data. One intent per event.
- `render(widget, inputs, { validator, surfaceId, revision, limits?, maxErrors? })` takes a `CompiledValidator` from the root export and returns `Result<UiTree>` with bounded `LiveframeError[]` failures of the spec §7.2 kinds.
- `liveframe gen <catalog>` emits one typed component per definition. `--check` fails on drift.

Prior art to read (not to copy blindly): Synapta's `packages/synapta-widget-sdk/src/{jsx-runtime.ts,render.ts,intents.ts,errors.ts}` and `scripts/widgets/gen-sdk.ts`. Synapta uses positional ids; Liveframe uses key paths.

Rules:
- The runtime is host-API-free; a test bundles it and scans for `node:`, `bun:`, DOM globals and `require(`.
- Host elements (`<div>`), function props, promises and async renders are errors.

## Today

- `src/sdk/index.ts` exports `jsx`, `jsxs`, `Fragment`, `primitive`, `state`, `action`, `render`, and the types `Component`, `Element`, `DeepReadonly`, `Intent`, `Json`, `WidgetProps`, `RenderLimits`, `RenderOptions`. JSX runtime subpaths are `src/sdk/jsx-runtime.ts` and `src/sdk/jsx-dev-runtime.ts` (the latter exports `jsxDEV`); both expose the `JSX` type namespace with no intrinsic elements.
- `src/sdk/element.ts` owns private element branding and frozen primitive tags. `src/sdk/intents.ts` creates deep-frozen JSON intents, including carried event values and action argument binding.
- `src/sdk/render.ts` builds and validates in one pass using the compiled validator's internal `build` facts and shared structural/JSON checks. It emits key-path ids, expands components/fragments and bounds nodes, depth, bytes and errors (20 by default, plus a bound marker). Input failures use `invalid-prop` with an input pointer and no `nodeId`.
- Params, state and context are checked every call and deep-frozen in place. Data is checked/frozen once per object identity in a module-private `WeakSet`; reuse it only under the same source-schema contract, since the cache is shared across validators. Plain JSON inputs are required. The SDK enforces synchronous results; the host owns isolation and interruption.
- `src/sdk/gen.ts` is the internal host-free typed-source emitter. The Bun CLI `src/cli/liveframe.ts` implements `liveframe gen <catalog.json> --out <file> [--check]`. Output imports `primitive` from `/sdk` and is imported by relative path. `gen:check` runs in `bun run check` against `src/__tests__/fixtures/widgets/ui.gen.ts`.
- `docs/sdk.md` is the outsider guide. `src/__tests__/sdk-*.test.*`, `exports.test.ts` and `portability.test.ts` cover the API, all error kinds, generated types, browser bundles and the guide example. The four ported proof widgets and scenarios are in `src/__tests__/fixtures/widgets/`; `bench/render.bench.ts` gates total rendering at 3 µs/node.
