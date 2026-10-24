# Plans

Numbered execution plans for the roadmap phases. Write them with the `create-plan` skill and execute them with `liveframe-execution`.

Run plans in number order, one at a time. Execution status lives in [`roadmap.md`](../roadmap.md) §3; this index lists what each plan delivers.

| Plan | Phase | Delivers |
| --- | --- | --- |
| [001](001-Phase-0-Primitive-Set-Proof.md) | 0 | Four reference UIs from Synapta and Clay built from candidate primitives under two design systems; the go/no-go report |
| [002](002-Phase-0-Parity-Re-Proof.md) | 0 | The Task 12 spec additions built into the proof, the artifact fonts, and agent-home parity at ≤ 1% pixels with an approved DOM inventory; the final Phase 0 verdict |
| [003](003-Phase-1-Part-A-Formats.md) | 1 | The schema language and every format (vocabulary, catalog, capabilities, manifest, theme, design system, UI tree) with install-time validators, the recipe resolver, published JSON Schemas, and the proof expressed in the new formats |
| [004](004-Phase-1-Part-B-Compiled-Validator.md) | 1 | The compiled tree validator: closures with no `Function`, every spec §10 rule tested, bounded agent-actionable errors, ≤ 1.5 µs per node |
| [005](005-Phase-2-Part-A-SDK.md) | 2 | `@arnilo/liveframe/sdk`: the JSX runtime, intents, one-pass `render()` with key-path ids and every §7.2 error kind, `liveframe gen` with `--check`, the proof widgets ported, and ≤ 3 µs per node through `render()` |
| [006](006-Phase-2-Part-B-Packages-Storage-Runners.md) | 2 | `/pack` (`pack()`, `verifyPackage()`), `/store` (record formats, `Store`, `memoryStore()`, `loadPlacement()`), `/store/fs` (`fileStore()`), and the in-process and worker runners |
| [007](007-Phase-3-CSS-Projection.md) | 3 | `/css`: base, theme and design-system sheets scoped per surface; one class per slot with ordered state rules; style props and container breakpoints; overlay blur, translucency and entry motion; reduced motion and transparency, forced colours, RTL and switching; the proof host on the real projection with parity re-proved |
| [008](008-Phase-4-Part-A-React-Renderer.md) | 4 | `/react`: `createRenderer()` with the startup registry check, `<Surface>` with arrival validation, id-keyed reconciliation, fallbacks, scoped overlays and switching, `implement()`, `onIntent`, SSR and hydration; the proof host on packages, the runner and `/react` with parity re-proved |
| [009](009-Phase-4-Part-B-Preview.md) | 4 | `createPreview()` sessions on `pack()` and the runner, `<Preview>` in `/preview/react`, `liveframe preview capture`, the proof host's preview page and a scripted agent loop that publishes the previewed hash |
| [010](010-Phase-5-Conformance-Kit.md) | 5 | `/conformance` (store, catalog and design-system suites) and `/conformance/react` (renderer server and browser suites, the page host), runner-agnostic cases that fail closed on missing coverage, both reference stores and the proof host passing, a failing mutant per suite, and `docs/conformance.md` |
| [011](011-Phase-8-Authoring-MCP-Server.md) | 8 | `liveframe mcp <config>`: seven authoring-only MCP tools (primitives, vocabulary, capabilities, generated types, pack, render, capture) on one preview session bound to the host's `<Preview>` page, the optional MCP SDK peer, `AuthoringConfig` types in `/preview`, a scripted agent loop through the tools only, and `docs/mcp.md` |
| [012](012-Phase-6-Part-A-Release-Hardening-And-API-Freeze.md) | 6 | Release hardening and API freeze: host-validated runner results, verified and bounded caches, no widget-schema patterns or top-level await, `Store.getPlacement` and storable ids, one typed `LiveframeFailure`, URN schema ids, settled MCP shapes and concurrency, composed-prop checks, a stable bench, a complexity gate, and the MIT license |
| [013](013-Phase-6-Part-B-Packaging-Demo-And-Release.md) | 6 | Compiled JS and declarations with an installed-archive gate, peer floors, outsider docs, the demo host, a repository audit, CI and trusted publishing, a release candidate, an agent acceptance run, the pre-release review of every readiness item, and the 0.1.0 publish |
