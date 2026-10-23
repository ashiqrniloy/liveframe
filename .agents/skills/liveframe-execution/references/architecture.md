# Architecture and placement

## Target

Spec §2 (the model), §3 (library vs app), §13 (packages).

```
widget TSX ──(app backend, app's sandbox)──► render() ──► validate ──► UI tree (JSON)
                                                                         │
browser: <Surface> draws it with the app's primitives, styled by recipes ◄┘
interactions: local · setState (re-run) · action (app operation)
```

One npm package with subpath exports:

| Subpath | Owns | Host APIs allowed |
| --- | --- | --- |
| `@arnilo/liveframe` | Formats, types, JSON Schemas, validator, recipe resolver | No |
| `/sdk` | JSX runtime, intents, `render()`, `liveframe gen` | No (the CLI entry may read files) |
| `/pack` | `pack()`, `verifyPackage()` | No |
| `/store` | Record formats, `Store` interface, `memoryStore()`, `loadPlacement()` | No |
| `/store/fs` | `fileStore(dir)` | File system |
| `/preview` | `Runner` interface, `inProcessRunner()`, `createPreview()` | No |
| `/preview/worker` | `workerRunner()` | `Worker` global |
| `/preview/react` | `<Preview>` | Yes (React, DOM) |
| `/css` | Theme and design system → CSS custom properties and classes | No |
| `/react` | `<Surface>`, `implement()`, reconciliation, `onIntent` | Yes (React, DOM) |
| `/conformance` | Shared suites for catalogs, design systems, renderers, stores | Test runner only |

Placement rules:
- The library never ships a primitive implementation, a design system or a product component. Those live in apps, a demo host, or `proof/`.
- `src/` never imports `proof/`.
- A capability an app can supply through a hook (isolation sandbox, data, actions, storage backend, auth) is the app's, never the library's. The app's sandbox plugs in as a `Runner`; the reference runners are not isolation boundaries (spec §7.5). Liveframe ships the record formats, the `Store` interface and two reference stores; the backend, tenancy and approval stay the app's (spec §7.4).

## Today

- `src/index.ts` exports the formats, schema language, install validators, compiled tree validator, catalog change classifier and recipe resolver. Core modules live in `src/formats/`, `src/validate/`, `src/schema.ts`, `src/errors.ts` and `src/resolve.ts`.
- `package.json` exports `.`, `./schemas/*`, `./sdk`, `./sdk/jsx-runtime`, `./sdk/jsx-dev-runtime`, `./pack`, `./store`, `./store/fs`, `./preview`, `./preview/worker` and `./css`. `src/sdk/` owns elements, intents, the single-pass renderer and typed component generation; `src/cli/liveframe.ts` provides the Bun `liveframe gen` entry. The SDK has no host APIs or runtime dependencies.
- `src/pack/` ships inert packing and verification; `src/store/` ships record formats, `Store`, `memoryStore()` and `loadPlacement()`, with `fileStore(dir)` in `/store/fs`. `src/preview/` ships `Runner`, `RunnerOptions` and `inProcessRunner()`; `/preview/worker` ships `workerRunner()` with `close()`. Neither runner is a sandbox. Only `preview/load.ts` may dynamically import, for backend package loading. Sucrase 3.35.1 and Acorn 8.19.0 are runtime dependencies imported only by `pack/bundle.ts`.
- `src/css/` projects base/theme/design-system sheets and provides slot, style, scope and variable helpers. It has no host APIs or runtime dependencies; hosts insert/cache sheets and manage scope attributes. `docs/styling.md` covers loading, CSP, switching, preferences and the renderer contract. Proof-host adoption remains separate work.
- Preview sessions, renderer and conformance subpaths remain planned work. Other outsider guides are `docs/sdk.md` and `docs/packages.md`; proof widgets using the SDK live only in `src/__tests__/fixtures/widgets/`.
- Graft is the source of truth for file locations once code exists.
