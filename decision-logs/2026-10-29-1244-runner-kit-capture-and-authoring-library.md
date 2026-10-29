---
date: 2026-10-29 12:44
status: approved
decision_about: "The runner kit, pluggable capture and authoring library: subpaths, APIs, defaults and bounds"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Runner kit, capture backend and authoring as a library

## Decision

Plan 018's four library surfaces are settled as follows.

- **LF-02.** `generate(catalog)` and `generateDefinitions(catalog)` ship from `@arnilo/liveframe/sdk/gen`. `capture()` ships from `@arnilo/liveframe/preview/capture` as a host-API-free core that drives a `CaptureBackend` and returns `{ index, files: Map<name, Uint8Array> }`. It writes nothing. `liveframe preview capture` keeps the only file-writing path; no `writeCapture` subpath is added in 0.2.0.
- **CL-05.** `CaptureBackend.open(url)` returns a `CaptureSession` with `waitReady(selector)`, `axes()`, `cells()`, `screenshot(cell)`, `ariaSnapshot(cell)` and `close()`. `playwrightBackend(playwright)` ships from `/preview/capture`, takes the Playwright module the caller imported, and keeps the library free of dynamic `import()`. The CLI keeps its lazy Playwright import. The snapshot is Playwright's default `locator.ariaSnapshot()` YAML, opaque to the library, on the existing `playwright ^1.49.0` peer floor; a missing snapshot is recorded as `snapshot: null` with no file.
- **LF-15.** `@arnilo/liveframe/authoring` exports `createAuthoring({ catalog, capabilities, runner, preview?, capture?, exposeMeta? })` with seven typed async operations matching the MCP tools. `runner` is required; `/authoring` never defaults to `workerRunner()`, loads no MCP SDK, Playwright or file system. `liveframe mcp` keeps only the SDK wiring, schemas and content mapping.
- **LF-13.** `@arnilo/liveframe/runner-kit` exports a synchronous `renderModule()` and a pure `linkPackage(code, resolve)`. `dist/runner-kit.bundle.js` is a self-contained ESM bundle built by `Bun.build`; CI proves it under Node 26's `vm.SourceTextModule`, using Node's current `linkRequests()`/`instantiate()` API. `renderMany` is documentation guidance, not API.
- **In-process memory.** `inProcessRunner({ maxModules? })` reports `stats().modules` and refuses a new hash past the bound with `limit-exceeded`; the bound is on the loader's process-wide module map. Default `maxModules` is 256.

This supersedes D3 of `decision-logs/2026-10-24-2330-authoring-mcp-server-contract.md` only. D1, D2, D4, D5 and D6 stand.

## Context

Plan 018's adopters (Clay and Synapta) call capture and authoring from a host build service or agent host, not from the CLI or an stdio MCP transport. That makes three 0.1.0 assumptions wrong at once: generation is CLI-only, capture is CLI-only, and authoring exists only as `src/cli/mcp.ts` internals. LF-13 adds a fourth surface: a runner kit that runs a packed widget outside the library's own runners, including in a non-Bun isolate.

The constraints are the existing laws and spec §7.5/§13:

- Law 1: widget code never reaches the browser.
- Law 2: the host validates every tree it serves.
- Law 4: authoring grants no store, dispatcher, resolver, approval or action.
- Spec §13: library subpaths are host-API-free unless named; the only dynamic `import(` in a library subpath is the package loader; the CLI may lazily import command-specific peers.
- D3 rejected a capture subpath because it would put Playwright and host APIs inside the library. The new decision keeps the core host-API-free by injecting the backend and moves the Playwright-shaped code behind a caller-supplied module.

Neither reference runner is an isolation boundary, and the kit is not one either. The log records that explicitly so adopters do not mistake the shared VM for a sandbox.

## Approval

- Proposed by: agent, following the recommendations written into plan 018.
- Approved by user: Yes.
- Approval evidence: on 2026-10-29 the user wrote, “Complete - [ ] Task 1: Record the runner, capture and authoring library decisions from @plans/018-Phase-7-Part-E-Runner-Kit-Capture-And-Authoring-Library.md and update the plan once done”. That instruction explicitly adopts the plan's recommended decisions as the record to finalize.

## Alternatives Considered

1. **Write capture files from the library** — rejected: `/preview/capture` must stay host-API-free, and a `Map<name, Uint8Array>` already carries every byte. A host that wants a directory writes the same short loop the CLI writes.
2. **A `writeCapture(dir, result)` helper in a node subpath** — deferred, not rejected on merit: it adds a subpath and a file-I/O surface for five lines of `mkdir` + `writeFile`. Revisit only if an adopter needs the same helper in two places.
3. **`playwrightBackend` in its own `/preview/capture/playwright` subpath** — rejected: the function only uses Playwright types, so the core subpath stays host-API-free without another export entry. A separate subpath would be more surface for no portability gain.
4. **Let the library dynamic-import Playwright when the backend is omitted** — rejected: spec §13 forbids it outside the CLI, and it would hide a heavy peer inside `/authoring` or `/preview/capture`.
5. **Record the ARIA snapshot as parsed data** — rejected: Playwright only promises YAML text, and its options grew across 1.49–1.64. Parsing would pin the library to one Playwright minor. The snapshot stays opaque text; consumers that parse it own the version pin.
6. **`/authoring` defaults `runner` to `workerRunner()`** — rejected: it would make `/authoring` host-API-bound and reintroduce the default-runner bypass Clay's LF-15 evidence names.
7. **Export authoring from `/preview`** — rejected: it grows a host-API-free subpath with authoring-only weight; LF-15 names a separate surface.
8. **Add `Runner.renderMany`** — rejected: the host still validates each result, so batching saves one call shape, not work. Docs explain packing once and rendering per scenario.
9. **Run the bundle under Deno in CI** — rejected as the default: it adds a tool. Node is already used by the archive gate's node probe. Deno remains a manual alternative.
10. **Unload in-process modules** — rejected: true unloading needs a fresh realm or a worker. Report and bound the count instead.
11. **Bound each `inProcessRunner` separately** — rejected: the loader caches by hash process-wide, and a second map would let two runners disagree about what is loaded. The bound is documented as process-wide.

## Rationale and Evidence

### LF-02: generation and capture as functions

`src/sdk/gen.ts` already exports `generate(catalog)` at `:76` and `generateDefinitions(catalog)` at `:216`. `src/cli/liveframe.ts:91` picks one by `--implementations`. The `/sdk/gen` subpath is therefore a re-export, not a move, and `liveframe gen` calls the same functions. A dedicated subpath keeps codegen out of every widget's import graph.

Capture's current core is `src/cli/capture.ts:5-146`. Only the edges are host-bound: `loadPlaywright()` at `:46` and the two `Bun.write` calls at `:136,141`. Everything the tests care about — axis narrowing, the controlled-preview rule, the cell bound, sanitised unique names, `[data-lf-preview]`/`[data-lf-cell]` parsing and error capture — is pure. Returning a `files` map makes `index.json` part of the result, so a caller can persist or stream the capture without a second format.

The CLI keeps the same flags and output because it is rebuilt on the function and writes `files` itself. That is the smallest complete split: no file I/O in the library, no new subpath, and the existing CLI tests keep their meaning.

`CaptureError`'s three kinds (`unknown-name`, `not-found`, `limit-exceeded`) stay unchanged. A backend failure that is not a `CaptureError` propagates through the core; the authoring adapter maps it to `render-failed`, which is what `src/cli/mcp.ts:495-499` already does.

### CL-05: the backend contract

The plan's first sketch had `open(url)` plus wait/cells/screenshot/aria methods. The core also needs the declared axes, the scenario a controlled preview shows, and each cell's coordinates and errors; otherwise every backend would reimplement the `data-lf-preview` and `data-lf-cell` decoding. The settled interface carries those on the session:

```ts
export type CaptureAxes = {
  scenarios: readonly string[];
  widths: readonly number[];
  themes: readonly string[];
  designSystems: readonly string[];
  urlKey?: string;
  controlled?: boolean;
  shown?: string; // the scenario a controlled preview displays
};

export type CaptureCell<Handle = unknown> = {
  handle: Handle;
  scenario: string;
  width: number;
  theme: string;
  designSystem: string;
  errors: readonly LiveframeError[];
};

export interface CaptureSession<Handle = unknown> {
  waitReady(selector: string): Promise<void>;
  axes(): Promise<CaptureAxes | null>;
  cells(): Promise<readonly CaptureCell<Handle>[]>;
  screenshot(cell: Handle): Promise<Uint8Array>;
  ariaSnapshot(cell: Handle): Promise<string | null>;
  close(): Promise<void>;
}

export interface CaptureBackend<Handle = unknown> {
  open(url: string): Promise<CaptureSession<Handle>>;
  close?(): Promise<void>;
}
```

`capture()` opens a session to read the axes, then once per scenario at `<urlKey>.scenario` (or the bare `scenario` key), calls `waitReady("[data-lf-ready]")`, filters `cells()` by the narrowed axes, and captures each selected handle. It closes every session and calls `backend.close?.()` in a `finally`. The optional `close` is what lets the default backend reuse one Chromium instance across scenarios instead of paying a launch per scenario; the current CLI launches once, so this is required to keep capture wall time flat.

`playwrightBackend(playwright)` lives in `src/preview/capture/playwright.ts` and is exported by `/preview/capture`. It imports Playwright with `import type` only, so the subpath has no runtime Playwright dependency and the portability scan passes. The caller does the import:

```ts
const capture = await import("@arnilo/liveframe/preview/capture");
const playwright = await import("playwright");
const result = await capture.capture(url, { backend: capture.playwrightBackend(playwright), maxCells: 12 });
```

The CLI keeps its own lazy import and its `PlaywrightMissing`/missing-Chromium `not-found` errors, so `liveframe gen` and `/sdk/gen` still run with no Playwright installed.

The snapshot format is Playwright's default `locator.ariaSnapshot()` YAML. Context7's Playwright API reference confirms `ariaSnapshot()` returns a YAML string and that `locator.screenshot()` returns a `Buffer`; the peer floor is `playwright ^1.49.0`, the release that introduced `ariaSnapshot()`. The backend calls it with no options, so it does not depend on `mode: "ai"` (1.59), `depth` (1.59) or `boxes` (1.60). The library never parses the YAML; a backend that returns `null` (for example a non-Playwright engine with no accessibility snapshot) gets `snapshot: null` in `index.json` and no `.aria.yml` file. A screenshot is only as faithful as the backend's engine; `docs/preview.md` must say so.

`AuthoringConfig.capture?: CaptureBackend` is added for the CLI config. The library's `createAuthoring` takes `capture?` directly. When neither supplies a backend, `capture_preview` fails with `not-found` explaining that the host must inject one; the library never assumes Playwright.

### LF-15: authoring as a library

`src/cli/mcp.ts` already has the shape: `createAuthoring` at `:283-325` holds the session, the last good package and the lazily bound page; `checkAll`, `packArguments`, `renderArguments` and `serialize` are pure helpers around it; `:346-499` are the tool handlers. The move is a refactor, not a redesign.

`/authoring`'s config takes validated documents, not unknown JSON, so the library does not duplicate the CLI's startup validation:

```ts
export type AuthoringOptions = {
  catalog: Catalog;
  capabilities: Capabilities;
  runner: Runner; // required
  preview?: (binding: PreviewBinding) => Promise<{ url: string; close(): Promise<void> }>;
  capture?: CaptureBackend;
  exposeMeta?: boolean;
};
```

`exposeMeta` is kept because `list_capabilities` and `pack_draft` already change their output with it; without it the CLI adapter would have to wrap two operations. Default `false`.

The seven operations are async and return the library's `Result<T>` rather than MCP content:

| Operation | Result value |
|---|---|
| `listPrimitives({ kinds? })` | full definitions or the named kinds; unknown kinds are `unknown-component` |
| `listVocabulary()` | `{ catalogId, vocabulary }` |
| `listCapabilities()` | `Capabilities`, with `meta` stripped unless `exposeMeta` |
| `generatedTypes()` | `{ note, types }`, `types` byte-identical to `liveframe gen` |
| `packDraft({ files, entry, manifest, scenarios })` | `{ hash, id, version, description?, meta?, scenarios }` or pack errors |
| `renderScenarios({ scenario?, state?, context?, outcomes? })` | one bounded tree or every scenario's statuses |
| `capturePreview({ scenarios?, widths?, themes?, designSystems? })` | at most 12 cells: coordinates, `LiveframeError`s, `aria: string \| null`, `png: Uint8Array` |

`close()` closes the bound page. `packDraft`, `renderScenarios` and `capturePreview` share one arrival-order queue, created by the existing `serialize()`. The catalog operations stay concurrent. The preview binding keeps the current lazy, once-only, rejected-not-cached rule.

`capturePreview` does no file I/O: it calls the core `capture()` and returns the bytes and snapshot text directly. The CLI adapter base64-encodes the PNG and emits the two content blocks the current tool emits, so `cli-mcp.test.ts` does not change.

`renderScenarios({ outcomes: true })` expands each packed scenario whose data names exactly one manifest source whose capability result is a `sourceOutcome()` envelope, using `/pack`'s `outcomeScenarios(scenario, { source, manifest, capabilities })`. Scenarios with no such source stay as they are. A scenario with two outcome-envelope sources is ambiguous and returns `invalid-document` at `/scenarios/<n>`; authors split it. Expanded scenarios render directly through the configured `runner` with the authoring library's own fixed surface id and increasing revision, not through the session, so the current package and scenario are untouched. An invalid expansion is a typed `LiveframeError`, never a partial status list.

`liveframe mcp` keeps `loadConfig`, `loadSdk`, the JSON schemas, `text`/`failure`, the `workerRunner()` default with its startup warning, and the lazy `playwright` import. Its handlers call the seven operations and map results to content. `/authoring` imports no MCP SDK, no Playwright and no `node:` module; a `no-mcp-sdk` preload proves the first.

Law 4 stays explicit: no operation installs, places, approves, resolves data or dispatches. The page receives trees only (law 1).

### LF-13: the runner kit

The subpath is `@arnilo/liveframe/runner-kit`. `renderModule` is synchronous because a widget module is synchronous (spec §7.1) and the kit is used inside an isolate where an event loop is not guaranteed:

```ts
renderModule(
  widgetDefault: unknown,
  inputs: WidgetProps,
  options: {
    catalog: Catalog;
    capabilities: Capabilities;
    manifest: Manifest;
    surfaceId: string;
    revision: number;
    limits?: RenderLimits;
    maxErrors?: number;
  },
): Result<UiTree>
```

It compiles and caches the validator, then calls `render()`. The cache mirrors `src/preview/cache.ts`: scoped by `(catalog, capabilities)` with `WeakMap`s, LRU-bounded at the same `MAX_VALIDATORS = 64`. It is keyed by the canonical JSON of the manifest because the kit's signature has no package hash; a manifest is immutable for a render, so the text is stable. A thrown widget or render error becomes `render-failed`, matching the runners.

`linkPackage` rewrites only the canonical linker header `pack()` emits (`src/pack/bundle.ts:296`): lines of exactly `import * as __lf_sdk<N> from "<sdk specifier>";`, in order, for the three SDK specifiers. Its signature is:

```ts
linkPackage(
  code: string,
  resolve: (specifier: SdkSpecifier) => string,
): Result<string>
```

The plan's example showed a single string; a single string cannot map three distinct specifiers (the main SDK, the JSX runtime and the JSX dev runtime), and a sandbox may resolve them differently. `resolve` returns the URL or specifier the isolate uses. Non-header text stays byte-identical. Code with no SDK imports is accepted unchanged (a hand-built package can have an empty header). A malformed header, a duplicate or out-of-sequence `__lf_sdkN`, or a repeated specifier returns a typed `LiveframeError`, not a string rewrite. An SDK import outside the header is neither rewritten nor detected: finding one needs a parse, and the loader contract (`loader_leaves_noncanonical_sdk_imports_bare`) keeps it bare. (Corrected 2026-10-29 after plan 018 Task 5, which implemented this narrower rule; the earlier text promised a rejection that was never built.) `src/preview/load.ts:11-25` uses it for the data-URL rewrite.

The bundle is built in `scripts/build.ts` (no second build tool) from a kit entry that re-exports the SDK surface, the validator and both kit functions. `Bun.build` uses `format: "esm"`, `splitting: false`, `target: "browser"` and `minify: true`. The browser target keeps `node:`/`bun:` built-ins out; self-containment is checked by parsing the output with `acorn` (already a dependency) for dynamic `import()`, `import.meta`, relative/bare imports and `node:`/`bun:` references. The bundle's module namespace serves all three SDK specifiers because `/sdk` already re-exports `jsx`, `jsxs` and `Fragment`; the kit entry also exports `jsxDEV`, so one VM module satisfies the dev runtime too. Gzipped size is recorded in Task 6's notes, with no budget.

CI runs the bundle under Node 26's `vm.SourceTextModule` with `--experimental-vm-modules`, links a packed proof widget with `linkPackage`, and compares the tree to `render()`'s. The local runtime is Node v26.11.1, whose `vm.SourceTextModule` exposes `linkRequests()`, `instantiate()`, `moduleRequests` and `dependencySpecifiers`; its prototype has no `link()`. The fixture must use the Node 26 API, not the older `link()` example. Node is already installed for the archive gate's node probe, so Deno is only a documented alternative.

`renderMany` is not added. `docs/packages.md` explains packing once and calling the runner per scenario; the host still validates each result (law 2). The docs also state that the kit is not an isolation boundary.

### In-process module memory

`inProcessRunner()` currently documents "memory grows with every distinct package" at `src/preview/in-process.ts:34-38`. True unloading needs a fresh realm, so the smallest safe answer is observability plus a bound:

```ts
const runner = inProcessRunner({ maxModules: 256 });
runner.stats(); // { modules: number }
```

`src/preview/load.ts:3` owns the only module map. `stats()` reads its size, and `maxModules` is checked before inserting a new hash. A new hash at the bound returns `limit-exceeded` (fails closed); an already-loaded hash still renders. The default is 256, counted process-wide because the loader is process-wide; the docs say so, and existing callers keep working. `workerRunner({ maxPackages })` keeps its 64-package recycle and is unchanged. Spec §7.5 and `docs/packages.md` replace the "memory grows" sentence with the reported count and bound.

## References

- Plan [`plans/018-Phase-7-Part-E-Runner-Kit-Capture-And-Authoring-Library.md`](../plans/018-Phase-7-Part-E-Runner-Kit-Capture-And-Authoring-Library.md) — the tasks this log unblocks.
- `docs/spec.md` §7.5 (runners, preview sessions, capture), §13 (subpaths, host-API rules, CLI, MCP server), §14 (non-goals).
- `decision-logs/2026-10-24-2330-authoring-mcp-server-contract.md` — D3 is superseded; D1, D2, D4–D6 stand.
- `decision-logs/2026-10-27-2028-release-0-2-0-scope-and-breaking-changes.md` — capture's move is part of the approved 0.2.0 breaking scope.
- `src/sdk/gen.ts:76,216`; `src/cli/liveframe.ts:91` — generation already exists; `/sdk/gen` re-exports it.
- `src/cli/capture.ts:5-146` (`loadPlaywright` at `:46`, `Bun.write` at `:136,141`) — the core/edge split.
- `src/cli/mcp.ts:283-325` (`createAuthoring`, `serialize`), `:346-499` (tool handlers), `:495-499` (render-failed mapping).
- `src/preview/load.ts:3,11-25`; `src/preview/in-process.ts:34-38`; `src/preview/cache.ts` (`MAX_VALIDATORS = 64`); `src/pack/bundle.ts:296` (canonical header).
- `src/preview/authoring.ts`; `src/preview/session.ts`; `src/preview/runner.ts` — existing authoring and runner contracts.
- [Playwright `Locator.ariaSnapshot`](https://playwright.dev/docs/api/class-locator#locator-aria-snapshot) — returns YAML text; `mode`/`depth`/`boxes` are newer options, not used. [Playwright `Locator.screenshot`](https://playwright.dev/docs/api/class-locator#locator-screenshot) — returns a `Buffer`.
- [Bun `Bun.build`](https://bun.sh/docs/bundler) — `format`, `target`, `splitting` and `define` semantics used for the bundle.
- [Node `vm.SourceTextModule`](https://nodejs.org/api/vm.html#class-vmmodule) — `linkRequests()`/`instantiate()` under `--experimental-vm-modules`; verified against local Node v26.11.1.
- Local tool versions at decision time: Bun 1.4.4, Node v26.11.1, Playwright 1.64.1, peer floor `playwright ^1.49.0`.

## Consequences

- `package.json` gains `./sdk/gen`, `./preview/capture`, `./authoring`, `./runner-kit`, and the bundle file. The spec §13 subpath table, host-API list and runtime matrix are amended by tasks 2–6.
- `AuthoringConfig` gains `capture?: CaptureBackend`; the `/preview` type export grows by that field only.
- `index.json`'s cell `snapshot` becomes `string | null`; `capture()`'s result changes shape from `CaptureIndex` to `{ index, files }`, a 0.2.0 breaking change already scoped by the release decision.
- `inProcessRunner` gains an options argument and `stats()`; the default 256 is a process-wide bound on the loader's map.
- The authoring library's `Result`-returning operations become the source of truth for tool behaviour; `liveframe mcp` must stay a thin adapter or the two can drift.
- Revisit D3's successor if an adopter needs capture files on disk from the library, if Playwright's YAML format changes enough that an opaque snapshot is no longer useful, or if a host needs multiple outcome sources expanded in one scenario.
- Revisit `maxModules` if a long-lived in-process host legitimately renders more than 256 distinct packages; the correct answer then is `workerRunner()` or a fresh realm, not an unbounded map.
