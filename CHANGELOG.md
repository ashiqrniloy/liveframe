# Changelog

All notable changes to `@arnilo/liveframe` are recorded here. The project follows the compatibility policy in [`docs/compatibility.md`](docs/compatibility.md).

## Unreleased (0.2.0)

This section ships as `0.2.0-rc.1` first. Locally that candidate passed the archive gate (11 steps, 5.9 s), the peer floors (React 19.0.0, Playwright 1.49.0, `@modelcontextprotocol/server` 2.0.0) and `bun run demo:test` against the packed tarball (52 tests).

[`docs/migration-0.2.md`](docs/migration-0.2.md) covers the three breaking changes; [`docs/adopters-0.2.md`](docs/adopters-0.2.md) maps every adopter request to what shipped.

Changed (breaking):

- **Breaking (0.2.0):** `<Preview>` requires `resultScenario`, the scenario its `result` was rendered for; it no longer infers the label from arrival order or the URL. New optional `selection` makes it controlled (`location` is neither read nor written) and `urlKey` prefixes the uncontrolled URL keys, so two previews can share a page. `data-lf-preview` publishes `urlKey` or `controlled: true`, and capture addresses a keyed page through `<urlKey>.scenario` (CL-01; see `docs/preview.md` for migration).
- **Breaking (0.2.0):** state storage now requires `(placementId, scope)`; pass `""` for shared state. Both reference stores isolate scopes and reject invalid scope strings. Placement deletion removes every scope. Existing 0.1.0 shared state files load without migration (LF-06).

Added:

- **Schema language (LF-04):** `minLength` and `minItems`, `nullable` on any form, and discriminated unions `{ discriminator, mapping }`, with `Infer` and `liveframe gen` producing nullable and tagged-union types. Both the compiled validator and the published JSON Schemas understand them; `pattern` stays rejected in widget-authored schemas.

- **Events (LF-05, CL-08):** `carries` gains `"number"`, `"integer"` and `{ object: <closed schema> }`; `bindAll` merges a carried object into the action's arguments, and `setState` writes it to an object-typed key. `emit` rejects `NaN`, infinities and a non-integer; the validator compares the event type with the target schema and points at the mismatch.

- **Semantics (LF-09):** `form`, `group`, `figure`, `status` and `alert` join the library-fixed list, so a widget can declare a form landmark, a labelled group, a figure or a live region that survives re-renders.

- **Manifests and capabilities (LF-07, LF-08):** an optional manifest `description` and closed `meta` (hashed, carried, never interpreted), capability `meta` per action and source, and `irreversible` beside `confirm`. `list_capabilities` shows the description; `meta` stays host-only unless the authoring config opts in.

- **Renderer (LF-01, LF-08, CL-02, CL-09):** `onIntent(intent, origin)` with `IntentOrigin`, and `checkOffered(tree, origin, intent, validator)` at the root export; an `events` map in the `implement()` context carrying `{ type, confirm, irreversible }`; `<Surface confirm={(intent, meta) => Promise<boolean>}>`; host `wrapperProps` and `portalProps`; and `transparency="reduced"`, which applies the reduced-transparency overrides per surface and suppresses the switch transition.

- **Styling (CL-04, LF-10, LF-11, CL-07):** the reserved `"none"` value on `backgroundColor`, `borderColor` and `outlineColor`; `{ role, alpha }` colour values with a declared `opacity` name or 0–1; vocabulary `contrast` pairs with `minimum`, `maximum` and `lessThan`, enforced by `validateTheme` as `insufficient-contrast`; `placeholderColor` and `scrollbarThumbColor`/`scrollbarTrackColor` recipe properties; and `minHeight`/`maxHeight` style props.

- **Validation and sources (LF-12, LF-14):** `capabilitiesFor(capabilities, manifest)` prunes a capabilities document to what one manifest names, with identical `compileValidator` results; `sourceOutcome(result)` builds the documented per-source outcome envelope, and preview and authoring render its named scenarios.

- **Agent surfaces (LF-16):** `/sdk` exports `renderElements()` and `ephemeralManifest()`, rendering element JSON into the same key-path trees as `render()` with errors pointing into the JSON; `generateElementsSchema()` emits the catalog's element JSON Schema from `/sdk/gen`, with a drift check.

- `inProcessRunner({ maxModules? })` reports its loaded-module count through `stats()` and refuses a new package past `maxModules` (default 256) with `limit-exceeded`; packages already loaded still render. The count is process-wide.

- `@arnilo/liveframe/runner-kit` exports `renderModule()` and a pure `linkPackage(code, resolve)` with a documented linker contract, the in-sandbox half of a host's own runner. `inProcessRunner()` and `workerRunner()` are rebuilt on it with unchanged results (LF-13).

- `@arnilo/liveframe/runner-kit.bundle.js` is a self-contained ES module of the SDK, validator and runner kit for sandboxes with no module resolution. The archive gate checks that it imports nothing, and a CI test renders a packed widget with it under Node's `vm` (LF-13).

- `@arnilo/liveframe/authoring` exports `createAuthoring()` with the seven typed authoring operations, an explicit host runner, injected capture and opt-in outcome checks. `liveframe mcp` adapts these operations without changing its tools (LF-15).

- `@arnilo/liveframe/preview/capture` exports host-independent `capture()` and pluggable `CaptureBackend`, with an explicit `playwrightBackend(playwright)` adapter. Results contain an in-memory file map; snapshots may be absent. CLI output is preserved, and MCP accepts `AuthoringConfig.capture` (CL-05, LF-02).

- `@arnilo/liveframe/sdk/gen` exposes `generate()`, `generateDefinitions()` and `generateElementsSchema()`, byte-identical to the CLI's output, for host build services (LF-02).

- `conformance/corpus/` ships 45 language-neutral cases across all ten formats and `conformance/hash/` ships 45 canonical-hash vectors, both executed by the library's own suite, so a port can prove it agrees on `(kind, pointer)` and on RFC 8785 bytes (CL-06).

- `loadPlacement` accepts optional `{ scope, state }`; explicit state bypasses the state read and follows the same reported-reset rules. `/store` exports `verifyPlacementInputs` for hosts keeping state elsewhere. Store conformance covers scope isolation, bounds and deletion.

Fixed:

- Strip development-only source export conditions from the published manifest and reject missing export targets in the archive gate (CL-03).
- Shipped docs no longer call shipped exports planned, and a CI test keeps it that way (LF-03).

Known limitations:

- **The reference runners are still not sandboxes.** `inProcessRunner()` runs code in the host's realm, and `workerRunner()` bounds time and crashes without restricting what code can reach. `/runner-kit` is the in-sandbox half of a runner, not an isolation boundary. Hostile code needs the app's own isolated `Runner`. See [`docs/security.md`](docs/security.md).
- **`liveframe mcp` still runs agent drafts with the process's permissions** unless the config names an isolated runner. The import ban is syntactic only.
- **Every backend subpath needs Bun ≥ 1.4.2.** `/store/fs`, `/preview/worker`, the in-process loader and the CLI have no Node implementation; the host-API-free and browser subpaths do run elsewhere. `/runner-kit.bundle.js` is the exception among runner artifacts: it runs on a plain ES2022 isolate, verified under Node's `vm`.
- **Capture ships one backend.** `playwrightBackend()` drives headless Chromium; another engine needs the app's own `CaptureBackend`, and a screenshot is only as faithful as that engine.
- **No native Windows forced-colours and assistive-technology audit.** G29's checklist is written (`plans/evidence/020-g29-audit.md`), and the owner waived the run for this release. The conformance kit covers the renderer's semantics, not that audit.
- **The contrast check is install-time WCAG 2.x.** It measures relative luminance with alpha composited over the declared base, and does not check APCA or re-measure after a theme is installed.
- **Widget-authored schemas cannot use `pattern`**, by design; use `enum` or an app capability instead. General `oneOf`/`anyOf` stay out of the schema language; pick `nullable` or a discriminated union.
- **URL-valued props are the catalog's problem.** The library passes prop values through and never parses one as a URL; constrain `link.href`, `image.src` and the like with a catalog `pattern` or sanitise them in the implementation that renders them. See [`docs/security.md`](docs/security.md).
- **No authorisation, approval flow, storage backend or layout shell ships.** Those stay the app's.

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
