# Changelog

All notable changes to `@arnilo/liveframe` are recorded here. The project follows the compatibility policy in [`docs/compatibility.md`](docs/compatibility.md).

## Unreleased

Changed:

- **Breaking (0.2.0):** `<Preview>` requires `resultScenario`, the scenario its `result` was rendered for; it no longer infers the label from arrival order or the URL. New optional `selection` makes it controlled (`location` is neither read nor written) and `urlKey` prefixes the uncontrolled URL keys, so two previews can share a page. `data-lf-preview` publishes `urlKey` or `controlled: true`, and capture addresses a keyed page through `<urlKey>.scenario` (CL-01; see `docs/preview.md` for migration).
- **Breaking (0.2.0):** state storage now requires `(placementId, scope)`; pass `""` for shared state. Both reference stores isolate scopes and reject invalid scope strings. Placement deletion removes every scope. Existing 0.1.0 shared state files load without migration (LF-06).

Added:

- `@arnilo/liveframe/sdk/gen` exposes `generate()` and `generateDefinitions()`, byte-identical to `liveframe gen` and `liveframe gen --implementations`, for host build services (LF-02).
- `loadPlacement` accepts optional `{ scope, state }`; explicit state bypasses the state read and follows the same reported-reset rules. `/store` exports `verifyPlacementInputs` for hosts keeping state elsewhere. Store conformance covers scope isolation, bounds and deletion.

Fixed:

- Strip development-only source export conditions from the published manifest and reject missing export targets in the archive gate (CL-03).

## 0.1.0-rc.4 — 2026-10-27

Restore boolean schema annotation types, apply a worker's configured timeout to
its inner evaluation and render, and repair links to repository-only files in
the installed guides. Check links against the packed file list. Run repository
benchmarks with the source module condition so they share one validator graph.

## 0.1.0-rc.3 — 2026-10-27

Add a shipped agent walkthrough for the demo's independent CLI preview binding,
MCP authoring and HTTP install/place workflow. Clarify host-owned preview
transport and keys on repeated static siblings. No runtime changes.

## 0.1.0-rc.2 — 2026-10-27

Second release candidate, the first published from CI through npm trusted publishing, with provenance. No code changes from rc.1.

## 0.1.0-rc.1 — 2026-10-27

First release candidate, published under the `next` tag to verify the package from the registry. It carries the 0.1.0 content below.

## 0.1.0 — 2026-10-27

The first release: runtime-composable UI for React apps that run widget code on their backend.

Added:

- **Formats and validation** (`@arnilo/liveframe`): component and catalog definitions, themes, design systems with recipes, capabilities, manifests, the UI tree and scenarios, with a published JSON Schema for each at `/schemas/<format>.json`; `validateCatalog()`, `compileValidator()` and a compiled tree validator.
- **SDK** (`/sdk`): a JSX runtime for widget TSX, `action()`/`state()` intent helpers, `render()`, and `liveframe gen` for typed components built from a catalog.
- **React renderer** (`/react`): `createRenderer()`, `<Surface>` and `implement()`, with intent handling, error fallbacks and portal slots.
- **Styling** (`/css`): recipes resolved to three scoped sheets — base, theme and design system — with class, style, scope and variable helpers.
- **Packages, stores and runners**: `pack()`, `verifyPackage()`, the `Store` interface with `memoryStore()`, `fileStore(dir)` and `loadPlacement()`, plus `inProcessRunner()`, `workerRunner()` and `createPreview()`.
- **Preview** (`/preview/react`, `/preview/worker`): `<Preview>` for an app's own page, backend runners for draft code, and `liveframe preview capture`.
- **Agent authoring**: `liveframe mcp <config-module>`, an MCP server with seven tools — `list_primitives`, `list_vocabulary`, `list_capabilities`, `generated_types`, `pack_draft`, `render_scenarios` and `capture_preview`.
- **Conformance kit** (`/conformance`, `/conformance/react`): catalog, design-system, store and renderer suites an app registers in its own test runner.

Known limitations:

- **The reference runners are not sandboxes.** `inProcessRunner()` runs code in the host's realm, and `workerRunner()` bounds time and crashes without restricting what code can reach; one worker serves every package. Hostile code needs the app's own isolated `Runner`. See [`docs/security.md`](docs/security.md).
- **`liveframe mcp` runs agent drafts with the process's permissions** unless the config names an isolated runner. The import ban is syntactic only.
- **Every backend subpath needs Bun ≥ 1.4.2.** `/store/fs`, `/preview/worker`, the in-process loader and the CLI have no Node implementation; the host-API-free and browser subpaths do run elsewhere.
- **No native Windows forced-colours and assistive-technology audit.** The roadmap item (G29) is deferred past this release; the conformance kit covers the renderer's semantics, not that audit.
- **Widget-authored schemas cannot use `pattern`**, by design; use `enum` or an app capability instead.
- **URL-valued props are the catalog's problem.** The library passes prop values through and never parses one as a URL; constrain `link.href`, `image.src` and the like with a catalog `pattern` or sanitise them in the implementation that renders them. See [`docs/security.md`](docs/security.md).
- **No authorisation, approval flow, storage backend or layout shell ships.** Those stay the app's.
