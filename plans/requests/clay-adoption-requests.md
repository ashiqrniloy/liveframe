# Bug and feature requests from the Clay adoption analysis

- **Release scope update (2026-10-27):** the owner renumbered the release to **0.2.0**, including every LF/CL request and the backlog items both documents raise; this supersedes the original targets below ([scope decision](../../decision-logs/2026-10-27-2028-release-0-2-0-scope-and-breaking-changes.md)).
- **Source:** analysis of `@arnilo/liveframe@0.1.0` (the published tarball, `docs/`, `schemas/` and `dist/`; source at `9cc70e9`) against Clay's UI system (`clay`, branch `fix/language_support` at `944afbd8`):
  - SDUI: `crates/clay-server/src/shell/components.rs`, `crates/clay-server/src/server/ops/sdui.rs`, `frontend/src/sdui/*`;
  - styling: `packages/design-rack`, `crates/clay-protocol/src/protocol/design_system.rs`, `frontend/src/theme/*`;
  - execution: the host-tier extension host (`extension-host/`), the two `deno_core` trust domains and the bubblewrap third-party cohort;
  - the binding rules in `.agents/skills/clay-execution/references/`.
- **Date:** 2026-10-27
- **Status:** requests, not decisions. Each item states the general problem first; Clay is the evidence, not the reason. Settle each one with a decision log and a plan before building it.
- **Release target:** the owner has directed that every item here, and every existing request Clay depends on (§ "Existing requests Clay depends on"), ships in **0.1.1**. Clay's migration plan (`clay/plans/205-Liveframe-UI-Migration-Runtime-Composable-Surfaces.md`) does not start until that release is verified. Note one conflict: `docs/compatibility.md` allows only bug fixes, documentation and peer-range widening in a patch, and LF-06 changes the `Store` interface. Either amend R15 for this release or number it 0.2.0. Clay's plan accepts either number, provided every item is present.
- **Not repeated here:** the 17 Synapta requests (`synapta-adoption-requests.md`, LF-01 to LF-17) and the items already in `plans/backlog.md`. Where Clay needs one of them, the tables below add Clay's evidence and, in two cases, one acceptance item. Neither is a new request.

## Summary

| ID | Type | Title | Priority |
|---|---|---|---|
| CL-01 | Bug | `<Preview>` takes over the page URL and assumes the first result's scenario | P2 |
| CL-02 | Bug | `<Surface>` gives the host no hook on its wrapper and portal container | P2 |
| CL-03 | Bug (packaging) | The `liveframe:source` export condition names files the archive does not ship | P4 |
| CL-04 | Feature | A no-paint value for recipe colour properties | P1 |
| CL-05 | Feature | A pluggable capture backend for apps whose webview is not Chromium | P1 |
| CL-06 | Feature | A language-neutral conformance corpus and canonical-hash test vectors | P1 |
| CL-07 | Feature | `minHeight` and `maxHeight` style props | P2 |
| CL-08 | Feature | `carries: "number"` | P2 |
| CL-09 | Feature | A host-set reduced-transparency scope | P3 |

---

## CL-01 · Bug · `<Preview>` takes over the page URL and assumes the first result's scenario

- **Problem.** `<Preview>` always reads `scenario`, `width`, `theme` and `designSystem` from `window.location.search` on mount. On every selection it writes them back with `history.replaceState` (`dist/preview/react/preview.js:28-51`). Three consequences follow:
  - The keys have no prefix and there is no opt-out, so two `<Preview>`s on one page read and overwrite the same keys.
  - An app that owns its URL, or whose router is in-memory, gets its location rewritten by a library component.
  - The first `result` prop is recorded as the result of the URL's scenario (`received.scenario = selected.scenario`). If the host rendered `scenarios[0]` before reading the URL, the preview labels that tree as another scenario's result, and the "last good render" map is keyed wrongly.
- **Evidence (Clay).** Clay's Tauri client uses React Router's in-memory router (`clay-execution/references/authority.md` → Client Architecture), and its window URL is app-global. Clay plans one preview per module, and two modules can show previews side by side.
- **Proposal.**
  - Add a controlled mode: `selection?: PreviewCell` with the existing `onSelect`. When `selection` is supplied, `<Preview>` neither reads nor writes the URL.
  - Keep URL sync as the uncontrolled default for the CLI capture path, behind `urlKey?: string` (default: today's bare keys) so two uncontrolled previews can coexist.
  - Tie each `result` to its scenario explicitly: `result: { scenario, value: Result<UiTree> }`, or a `resultScenario` prop. Never infer it.
- **Acceptance.**
  - A browser test mounts two previews with different `urlKey`s and different selections, and neither changes the other.
  - A controlled preview leaves `location.href` unchanged across selections.
  - A first `result` for scenario A, with the URL naming scenario B, is never shown or retained as B's.
  - `liveframe preview capture` and the MCP `capture_preview` still pass against the uncontrolled default.

## CL-02 · Bug · `<Surface>` gives the host no hook on its wrapper and portal container

- **Problem.** `<Surface>` returns a fragment of two sibling `div`s, the scope wrapper and the portal container (`dist/react/renderer.js:189`). It accepts no `className`, `style` or element choice for either. In a host layout:
  - The empty portal `div` is a normal block. In a grid it takes a track cell, and in a flex container it adds a `gap`.
  - The wrapper cannot be told to fill its parent (`block-size: 100%`, `min-block-size: 0`), which a scrolling body needs.

  Today a host can fix this only with global selectors on `.lf_surface` and `[data-lf-portal]`. That is host CSS reaching into library-owned markup.
- **Evidence (Clay).** A Clay module body is a bounded flex column with its own scroll (`components.md` → Module pages: "Their content scroll stays inside the view"). Clay's CSS-module and recipe-ownership gates (`frontend/src/test/design-system-consumption.test.ts`) reject unowned global selectors.
- **Proposal.**
  - `wrapperProps?: { className?: string; style?: CSSProperties }` and `portalProps?: { className?: string; style?: CSSProperties }`. They are merged after the scope attributes, which the host cannot override: `className` is appended to `lf_surface`, and `data-lf-*` stays the library's.
  - Document a default for the portal container that adds no layout box, such as `display: contents` (which keeps it an ancestor for scope), or `position: fixed; inset: 0; pointer-events: none` with `pointer-events: auto` on its children. Settle which in a decision log, because the overlay contract (spec §11) depends on it.
- **Acceptance.**
  - Renderer tests show the host class on both containers, and show that the scope attributes and `lf_surface`/`lf_container` survive a host `className`.
  - A browser test in a CSS grid shows the portal container occupies no track and an open overlay still resolves the surface's theme and design-system variables.
  - The switching test covers both containers carrying host classes.

## CL-03 · Bug (packaging) · The `liveframe:source` export condition names files the archive does not ship

- **Problem.** Every `exports` entry carries `"liveframe:source": "./src/…/*.ts"`, but `files` excludes `src/`, so the published archive has no such files. A consumer whose resolver enables that condition gets a missing-module error instead of the `default` entry. Such consumers include TypeScript `customConditions`, a bundler's `resolve.conditions`, or tooling that resolves every condition.
- **Evidence (Clay).** Clay builds with TypeScript 7 and Vite 7, and both support custom conditions. The condition isn't set today, but nothing stops a monorepo-wide condition list from picking it up.
- **Proposal.** Strip the `liveframe:source` condition in the published `package.json` (the build already writes `dist/`), or ship the sources it names. Add an archive-gate check that every path an `exports` condition names exists in the packed file list.
- **Acceptance.** The archive gate fails on an `exports` target that is missing from the packed list. The 0.1.1 archive has none.

## CL-04 · Feature · A no-paint value for recipe colour properties

- **Problem.** A colour-typed recipe property accepts only a declared theme role (`checkRecipeProperty`, `dist/formats/design-system.js`: "Colour must name a theme role"). After the cascade there are only two ways to express "this slot paints no background or border":
  - leave the property out, which fails as soon as a `*` or `rest` recipe sets it and a variant or state must clear it;
  - declare a zero-alpha role that every theme must define. Clearing paint then becomes a colour, it enters every theme's role set, and a contrast check (LF-10) has to exclude it by name.
- **Evidence (Clay).** `@clay/design-rack` (247 recipes) uses `backgroundColor: "transparent"` **109 times**, for example `button.default.root.rest`, where `hover` then sets `surface.hover`. Each of those is a state that clears paint a sibling recipe set. A port either adds a `surface.none` role to all four shipped themes, or rewrites the cascade per key.
- **Proposal.**
  - A library-fixed keyword, `"none"`, accepted by `backgroundColor`, `borderColor`, `outlineColor` and `textColor` (the last only if a decision log finds a use). It projects to `transparent` (or `currentColor` for text, if adopted).
  - It is not a colour: colour authority (law 3) is unchanged, because no hue can enter. Forced colours ignore it as they ignore every recipe colour, and the forced-colours edge rule (spec §6.4, "Rest background with no positive border width") treats `none` as no background.
  - `"none"` is reserved: a vocabulary may not declare a role with that name.
- **Acceptance.**
  - Validator tests accept `none` on the listed properties, reject it on non-colour properties, and reject a vocabulary role named `none`.
  - Projection tests show byte-stable output and the cascade clearing a background set by `kind.*.slot.rest`.
  - A forced-colours browser test shows the inward outline on a `none` background with no border.
  - The Rack proof styles (`proof/styles/rack/`) drop any zero-alpha role they used for this.

## CL-05 · Feature · A pluggable capture backend for apps whose webview is not Chromium

- **Problem.** `liveframe preview capture` and the MCP `capture_preview` tool drive headless Chromium through Playwright (spec §7.5). An app whose webview is another engine therefore gets screenshots and accessibility snapshots that are not what its users see: WebKitGTK on Linux, WKWebView on macOS, or WebView2 with different flags. Fonts, `backdrop-filter`, `@starting-style`, container queries and native control geometry all vary by engine. The renderer guide asks hosts to "verify these behaviours in a browser against your actual implementations"; the agent loop can't.
- **Evidence (Clay).** Clay's production webview is Tauri v2 on WebKitGTK (Linux is the required host, per `AGENTS.md`). Its end-to-end harness already drives that real webview over W3C WebDriver (`frontend/e2e/webdriver.ts`, `withApp` in `frontend/e2e/harness.ts`). Clay's zero-Node test policy forbids adding Playwright or another Node test runner (decision `2026-09-24-2328`). With Chromium-only capture, an agent iterating on a Clay widget sees a different engine from the one it is designing for.
- **Proposal.**
  - Define a `CaptureBackend` interface: `open(url) → Session`, `waitReady(selector)`, `cells() → CellHandle[]`, `screenshot(cell) → Uint8Array (PNG)`, `ariaSnapshot(cell) → string` (YAML, as today).
  - `AuthoringConfig.capture?: CaptureBackend`, used by `capture_preview` and by `/authoring` (LF-15), with LF-02's exported `capture()` taking `{ backend }`.
  - Keep the Playwright/Chromium backend as the default and the only one shipped. Liveframe still ships no browser driver for other engines.
  - Specify the accessibility-snapshot format the backend must return, so non-Playwright backends produce comparable output, or let the backend declare that it has none (`aria: null`) and say so in `index.json`.
- **Acceptance.**
  - A test backend that renders through a fake page passes the capture tests: axis narrowing, the cell bound, `data-lf-ready`, sanitised file names and `index.json`.
  - The MCP tests run with an injected backend.
  - Importing the capture subpath without Playwright succeeds when a backend is injected.
  - The docs state the snapshot format, and that screenshots are only as faithful as the backend's engine.

## CL-06 · Feature · A language-neutral conformance corpus and canonical-hash test vectors

- **Problem.** The formats have published JSON Schemas (spec §13) so that "apps and agents in any language can validate the documents", but most of the normative rules are not expressible in JSON Schema:
  - key-path ids and their uniqueness;
  - `carries` and `bind` agreement;
  - style-prop permission per kind, and declared design-value names;
  - recipe completeness after `extends` and the cascade;
  - the UTF-8 byte limit counted during the walk, and code-point string bounds;
  - the RFC 8785 canonical form behind the package hash.

  A host that must enforce these outside JavaScript can only port `src/validate/*` by reading it, with no way to prove the port agrees.
- **Evidence (Clay).** Clay's validation authority is its Rust kernel: "Host output passes the same publication validators as hook output. A host is a producer, never a validation bypass" (`clay-execution/references/kernel.md`). Rust re-hashes every stored package before load. Two paths are possible: vendor LF-13's bundle into Clay's trusted `deno_core` runtime, or later port the checks to Rust off the runtime thread. Either way Clay needs fixtures that pin the semantics. RFC 8785 number serialisation is the classic drift point: `1e21`, `-0`, `5e-324`, and integers above 2^53. `serde_json` does not emit ECMAScript form by default.
- **Proposal.**
  - Ship `conformance/corpus/` in the archive with one directory per format (`catalog`, `theme`, `design-system`, `capabilities`, `manifest`, `ui-tree`, `package`, `placement`, `style-record`). Each case is one JSON file: `{ "inputs": {…}, "options": {…}, "expect": { "ok": true } | { "ok": false, "errors": [{ kind, pointer }] } }`. The input documents a validator needs (catalog, capabilities, manifest) are referenced by relative file name.
  - Errors match on `kind` and `pointer` only, not on `message`, so a port can phrase messages itself. Order is not significant, but the 20-error bound is.
  - A `hash/` set: `{ value, canonical, sha256 }` triples covering key ordering by UTF-16 code units, every ECMAScript number-serialisation edge, escapes, non-BMP characters, and the rejected inputs (lone surrogates, non-finite numbers).
  - The library's own test suite runs the corpus, so it can never drift from `src/`.
- **Acceptance.**
  - CI runs every corpus case through the TypeScript validators and fails on any mismatch.
  - The archive gate checks the corpus is packed.
  - Every `LiveframeError` kind that a format validator can produce has at least one failing case.
  - The hash set includes RFC 8785 Appendix B's number examples.
  - The compatibility doc says the corpus is part of the format contract: a case's expectation changes only with a format version.

## CL-07 · Feature · `minHeight` and `maxHeight` style props

- **Problem.** The style props have `width`, `height`, `minWidth` and `maxWidth` (`dist/formats/fixed.js`, spec §6.3), but nothing bounds height. A widget can't cap a list at a visible height so a sibling stays reachable, or give an empty state a minimum height, without a product-shaped primitive or a fixed `height` that breaks when content is short.
- **Evidence (Clay).** Rack caps result lists by height. The completion pop-up shows at most 8 visible rows, and module content scrolls inside its view rather than spilling beneath the composer (`components.md` → Phase 20.5 and Module pages). A package page that lists items above a form needs `maxHeight` on its `scroll` child.
- **Proposal.** Add `minHeight` and `maxHeight`, with the same domain as `minWidth`/`maxWidth`: `space.*`, `size.*`, `fill`, `fit`, fractions, and bounded `ch`/`%`. They take responsive values like every other style prop. `%` resolves against the containing block, as CSS defines; the docs note that a percentage height needs a definite parent height.
- **Acceptance.**
  - Format, validator, `styleDeclarations` and generated-type tests cover both props, including responsive values and rejection of undeclared names.
  - `liveframe gen --check` output updates.
  - A browser test shows `maxHeight` plus a `scroll` primitive scrolling inside a fixed-height container.

## CL-08 · Feature · `carries: "number"`

- **Problem.** An event carries `none`, `string` or `boolean` (spec §5). LF-05 asks for object-carrying events for forms. A single numeric control still has to encode its value as a string, have the host parse it back, and declare the action argument as a string with no `minimum`/`maximum` check. Such controls include a slider, a stepper, a rating, a page-size select whose values are numbers, and a splitter ratio.
- **Evidence (Clay).** Clay's package state and layout contract has typed numeric values: split ratios validated to 0.25, 0.5 and 0.75 (`docs/design/194-package-state-and-layout-contract.proposed.md`), plus integer settings such as tab width and font size in `@clay/settings`.
- **Proposal.**
  - `carries: "number" | "integer"`. `emit` checks `typeof value === "number"`, `Number.isFinite(value)`, and `Number.isInteger(value)` for `integer`.
  - `bind` and `setState` validation compares the event's type with the argument or state schema (`number` binds to `number`; `integer` binds to `integer` or `number`). The argument's `minimum`/`maximum` then apply to the filled value as they do for a literal.
  - This is independent of LF-05. If LF-05's option A lands, its object schemas already admit numeric fields, so both decisions should be made together.
- **Acceptance.**
  - Renderer tests show `emit` throwing on `NaN`, `Infinity` and a non-integer for `integer`.
  - Validator tests show a `bind` mismatch (`number` into a `string` argument) failing with `invalid-prop` and a pointer.
  - A preview-session test shows `intent()` rejecting an out-of-range filled value.
  - The conformance renderer suite gains a numeric fixture.

## CL-09 · Feature · A host-set reduced-transparency scope

- **Problem.** The base sheet removes translucency only under `@media (prefers-reduced-transparency: reduce)`: it forces `--lf-alpha: 1` and disables `backdrop-filter` (spec §6.4). Some hosts must turn translucency off for reasons the media query can't express:
  - a compositor or window manager without blur;
  - a battery or low-power mode;
  - a user setting inside the app;
  - an engine that doesn't implement the query at all.

  The host can set `--lf-alpha` from its own CSS, but `backdrop-filter` sits in recipe rules, so overriding it means host selectors targeting library classes.
- **Evidence (Clay).** Clay's material tier is chosen at runtime from what the platform's compositor supports (`src-tauri/src/material.rs`, `frontend/src/theme/material-store.ts`, `applyMaterialTier`). Rack's translucency is "case-only", and an unsupported tier must render opaque. WebKitGTK does not implement `prefers-reduced-transparency`.
- **Proposal.**
  - The base sheet applies the same overrides as the media query under `:where([data-lf-transparency="reduced"])` on a scope container. `<Surface>` gets a `transparency?: "auto" | "reduced"` prop, which sets the attribute on the wrapper and the portal container together.
  - Switching it follows the existing `data-lf-switching` sequence, so no transition plays.
- **Acceptance.**
  - Projection tests show the attribute rule emitted once, in the base sheet, with byte-stable output.
  - A browser test shows `backdrop-filter: none` and alpha 1 on a recipe with `backdropBlur` and `backgroundOpacity` when the prop is `reduced`, including inside an open portal overlay.
  - The switch suppresses transitions.

---

## Existing requests Clay depends on

Each row is an existing request. The Clay column adds evidence; it does not refile the request. Clay's migration plan treats all of them as required in 0.1.1.

| ID | Clay priority | Clay evidence |
|---|---|---|
| LF-01 intent origin | **P0** | Clay's `SduiAction` already carries the node id and `uiVersion`, and its rule is that "the server refuses an entry it did not install" (`packages.md` → Transient menus). Adopting `<Surface>` without `origin` and `checkOffered` would weaken an existing check. Clay also needs `origin` from `<Preview>`, as LF-01 proposes. |
| LF-02 export `generate()` and `capture()` | P1 | `clay-agent` and Clay's install path call them as functions; together with CL-05, `capture()` must accept a backend. |
| LF-03 stale "planned" wording | P4 | The sweep should also catch `docs/styling.md`: "The CSS projection is implemented; the public React renderer remains planned work." |
| LF-04 schema `minLength`, `nullable`, unions | P1 | Plan 194 state values and settings fields (non-empty identifiers, optional values) and agent tool payloads. |
| LF-05 multi-value commit | P1 | `@clay/settings` pages and widget approval forms submit several fields at once. Decide together with CL-08. |
| LF-06 state scope | **P0** | Clay has seven state scopes (`package-global`, `user-config`, `workspace`, `document`, `pane`, `component`, `transient-overlay`), keyed by host-stamped instance identities (`docs/design/194-package-state-and-layout-contract.proposed.md` §4). An opaque `scope` string fits. The four upper scopes are host-persisted; the three shell scopes map onto tier-1 primitive state. |
| LF-07 manifest `description` and `meta` | P2 | Clay's placement and approval UI must name what is being placed, and provenance (package, agent session) has to bind to the hashed package. |
| LF-08 `irreversible` and confirmation metadata | P1 | Clay keeps approvals host-side (`authority.md` → Session Presentation Ownership: one approval prompt per server request). The `<Surface confirm>` hook lets the renderer hand confirmation to Clay's approval surface instead of a widget-drawn one. |
| LF-09 more `semantics` | P2 | Clay's `Diag` is an `alert` for errors and a `status` for warnings and neutral reports (`components.md` → Rack Host Primitives). Widgets need the same two live regions. |
| LF-10 contrast pairs | P1 | Clay's install gate measures composited pairs (text ≥ 4.5, UI ≥ 3.0, decorative hairline ≥ 1.2). It also requires the hairline to be **strictly quieter than** `border.subtle` on the same surface (`config.md` → Contrast gate). **Extra acceptance item:** a declared pair may also carry `maximum` (or an "at most another pair's ratio" constraint), so ordering rules like Clay's can be stated. Clay's Rust gate stays authoritative regardless. |
| LF-11 alpha modifier | P1 | Rack's selected fills are `accent.primary` at 0.15 (`menu.default.item.selected`, `dropdown.default.item.selected`), and Rack uses `backgroundOpacity` in 30 recipes. Borders and text need the same. |
| LF-12 source-outcome envelope | P3 | Clay's git status already reports `idle`, `refreshing`, `last-success` and `last-error` per root (`packages/git/src/status.ts`). |
| LF-13 in-sandbox runner kit and single-file bundle | **P0** | Clay runs third-party and agent widget code in a bubblewrap-confined Bun cohort, and wants to run the validator inside its trusted `deno_core` runtime. Neither can use the Bun-only `data:` URL loader. The single-file bundle is the artifact Clay would vendor. |
| LF-14 `capabilitiesFor(manifest)` | P2 | Clay ships validator inputs to the webview per placement. |
| LF-15 authoring as a library | **P0** | `clay-agent` exposes tools through Prism tool factories (`agent-host.md` → Prism Usage), not stdio MCP. Run with the default `workerRunner()`, `liveframe mcp` executes drafts with the process's permissions, which bypasses Clay's approval for agent writes outside the workspace (`agent-host.md` → Acceptance policy). |
| LF-16 ephemeral surfaces | P2 | Agent tool results in the transcript. Not needed for Clay's first migration. |
| LF-17 measure patches | P1 | Clay's SDUI sends incremental `SduiTreeUpdate`s against a 1 KiB update budget (`components.md` → Payload budgets). Whole-tree re-sends are a regression Clay must measure before accepting. |

## Existing backlog items Clay raises

| Backlog item (`plans/backlog.md`) | Clay priority | Clay evidence |
|---|---|---|
| Verify conformance registrations in other runners and browsers | **P1**, WebKit first | Clay's only production engine is WebKitGTK. The platform floor (Baseline 2024: `@starting-style`, `:user-invalid`, `font-size-adjust`, container queries) has not been executed in WebKit. |
| Evaluate placeholder and scrollbar recipe properties on adopter demand | P2 | This is the demand: Rack declares `scroll.default.scrollbarTrack.rest` and `scroll.default.scrollbarThumb.{rest,hover,active}`. |
| Evaluate generated implementation types for JSON-loaded catalogs | P2 | Clay's catalog is served by the Rust kernel as JSON, and its React implementations would otherwise lose inferred prop and slot types. |
| Cap or report the in-process runner's module memory | P2 | Clay's first-party UI host is long-lived and hot-reloads. Every reload of a changed widget is a new hash that the in-process loader can never unload. |
| Decide the Clay-derived git-status labels fixture | — | Clay and Liveframe have the same owner; this is the owner's decision, not a Clay requirement. |

## Considered and not filed

- **Reusing catalog compilation across manifests.** `compileValidator` re-validates and recompiles the whole catalog for each manifest. On the 24-definition proof catalog that costs 0.73 ms per call (Bun 1.4.4, Ryzen 9 PRO 7940HS, 200 iterations after warm-up). With Clay's expected tens of placements this is a few milliseconds at generation commit. Not filed until a Clay measurement shows it matters.
- **Keyboard shortcuts for widget controls.** Clay's keyboard-first law (every action has a key path shown in the UI) can be met by Clay's own catalog: a bounded `keys` prop on its primitives, dispatched through `emit`, with the host keymap owning conflicts. No library change is needed.
- **Live primitives (editor, terminal).** Implementations are ordinary React components, so they can read host context and take an opaque, host-issued handle prop. No library change is needed.
- **Nested surfaces.** Clay will host `<Preview>` in a host-compiled module body, never inside another surface.
- **A Node backend.** Clay's backend JavaScript runs in Bun 1.4.2 (`mise.toml`). LF-13 covers the non-Bun isolates Clay needs.
