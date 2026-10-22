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
| `/css` | Theme and design system → CSS custom properties and classes | DOM optional |
| `/react` | `<Surface>`, `implement()`, reconciliation, `onIntent` | Yes (React, DOM) |
| `/conformance` | Shared suites for catalogs, design systems, renderers, stores | Test runner only |

Placement rules:
- The library never ships a primitive implementation, a design system or a product component. Those live in apps, a demo host, or `proof/`.
- `src/` never imports `proof/`.
- A capability an app can supply through a hook (isolation sandbox, data, actions, storage backend, auth) is the app's, never the library's. The app's sandbox plugs in as a `Runner`; the reference runners are not isolation boundaries (spec §7.5). Liveframe ships the record formats, the `Store` interface and two reference stores; the backend, tenancy and approval stay the app's (spec §7.4).

## Today

- `src/index.ts` exports the formats, schema language, install validators, compiled tree validator, catalog change classifier and recipe resolver. Core modules live in `src/formats/`, `src/validate/`, `src/schema.ts`, `src/errors.ts` and `src/resolve.ts`.
- `package.json` exports `.` and `./schemas/*`. The SDK, storage, preview, styling, renderer and conformance subpaths remain separate planned work; add each subpath when its implementation exists.
- Graft is the source of truth for file locations once code exists.
