# Phase 6 Part B: Packaging, Demo Host and Release

Depends on: [plan 012](012-Phase-6-Part-A-Release-Hardening-And-API-Freeze.md) complete (all tasks, including its impact analysis).

## Objectives

- Make `@arnilo/liveframe` installable and type-checkable by outsiders. Ship compiled ES2022 JavaScript with declarations, schemas, docs and the MIT license, and nothing else (decision R2).
- Prove the installed archive works outside this checkout: both runners, the loader and worker entry, the CLI, `liveframe mcp`, a bundled browser page, a default-strictness TypeScript consumer and the peer-dependency floors.
- Write the outsider docs a stranger needs: install, requirements, quickstart, the security model, the compatibility policy, a changelog and a security contact.
- Build the small demo host from roadmap Phase 6. It persists through `fileStore`, has a preview page and an MCP config, and runs the conformance kit, all from the installed package.
- Publish safely:
  - audit the repository before it goes public;
  - CI on GitHub Actions;
  - a trusted-publishing workflow with provenance;
  - a release candidate under `next`;
  - an agent acceptance run from the published docs;
  - a **pre-release review of every readiness item**;
  - then `0.1.0` as `latest`.

## Expected Outcome

- `bun pm pack` produces an archive holding only:
  - `dist/**/*.js` and `dist/**/*.d.ts`;
  - `schemas/*.json`;
  - `docs/*.md`;
  - `README.md`, `CHANGELOG.md`, `LICENSE` and `package.json`.
  It contains no `.ts` sources, tests, fixtures or `proof/`. A test asserts the list.
- `scripts/release/archive-gate.ts` installs that archive into a temporary project outside the repository and passes:
  - Bun host flows with both runners from another working directory;
  - a looping widget timed out and recovered;
  - `liveframe gen`;
  - `liveframe mcp` over stdio (seven tools, a draft packed and rendered);
  - a browser bundle of `/react`, `/preview/react`, `/css` and `/conformance/react`;
  - a `strict`/NodeNext `tsc` consumer of every subpath with zero errors;
  - a Node import of the host-API-free subpaths.
- Peer ranges are the oldest versions CI proves.
- `README.md` is npm-ready. The docs gain `docs/security.md` and `docs/compatibility.md`, plus `CHANGELOG.md` and `SECURITY.md`. Every guide uses the `liveframe` binary, never a `src/` path.
- `examples/demo-host/` runs from the installed package:
  - installs, places and gives state to a widget at runtime, and still has them after a restart;
  - serves a preview page that `liveframe preview capture` and `liveframe mcp` both use;
  - registers the conformance suites against its own subjects.
- The public GitHub repository has passed a content and secret audit. CI (`ci.yml`) and publishing (`publish.yml`) run on Actions, with npm used only in the publish job.
- `0.1.0-rc.N` is on npm under `next`, with provenance. The demo host and an agent acceptance run work from the registry.
- The pre-release review fills every row of `plans/evidence/012-release-readiness-review.md` and the owner says go.
- `0.1.0` is published as `latest`, with a GitHub release whose notes name the known limitations (G29, reference runners are not sandboxes, Bun-only backend).

This plan implements the remainder of roadmap Phase 6 (the first release), under `decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md` (R1–R2, R14–R20). It touches spec §13 (packaging, runtimes, peers, the binary) and adds no format or runtime behaviour. Plan 012 has frozen those. G29 (the native Windows forced-colours and assistive-technology audit) is deferred past 0.1.0 (R20). The plan is unusual in four ways:

- Several tasks need the owner to act on external accounts (GitHub, npm). Those steps are marked **Owner**, and the task cannot be ticked until the owner confirms.
- Task 12 is a full review that gates publishing.
- Task 13 bumps the version and publishes, which `.agents/skills/create-plan/references/liveframe.md` §6 allows only in Phase 6.
- The impact analysis runs after the publish, so anything it finds goes to 0.1.1.

## Tasks

- [x] Task 1: Build compiled JavaScript and declarations and lay out the package
  - Acceptance Criteria:
    - Functional:
      - `tsconfig.build.json` compiles `src/**` except `src/__tests__/**` to `dist/` with TypeScript 7 (`tsc -p tsconfig.build.json`). It uses `declaration`, `rewriteRelativeImportExtensions`, `jsx: react-jsx`, `resolveJsonModule`, target ES2022, NodeNext. `bun run build` runs it after cleaning `dist/`.
      - Each `exports` entry is `{ "liveframe:source": "./src/<x>.ts", "types": "./dist/<x>.d.ts", "default": "./dist/<x>.js" }`, plus `./schemas/*`.
      - Repository scripts pass the custom condition:
        - `bun test --conditions liveframe:source`;
        - `tsconfig.json` sets `customConditions: ["liveframe:source"]`;
        - CLI subprocesses that tests spawn pass `--conditions liveframe:source`.
        So repo tests keep exercising `src/` with one module graph, and consumers resolve `dist/`.
      - The worker entry resolves in both layouts (`./entry.ts` from source, `./entry.js` from `dist`), derived from `import.meta.url`'s extension.
      - The CLI files `src/cli/mcp.ts` (`../../package.json`, `../../schemas/*.json`) still resolve from `dist/cli/`.
      - `package.json`:
        - `bin.liveframe` is `./dist/cli/liveframe.js`, and its `#!/usr/bin/env bun` shebang survives emit;
        - `files` is `["dist", "schemas", "docs", "CHANGELOG.md"]` (README and LICENSE are implicit);
        - `private` is removed;
        - it gains `publishConfig: { access: "public", tag: "next" }`, plus `repository`, `homepage`, `bugs`, `keywords` and `author`;
        - `sideEffects: false`, except the worker entry;
        - `engines.bun >= 1.4.2`;
        - `version` stays `0.0.0` until Task 10.
      - `dist/` is git-ignored (it already is).
      - Spec §13 states the shipped layout and the runtime matrix (R2). Readiness B1, B2, B4 (metadata).
    - Performance: n/a for runtime (the emitted JS is the same code). Record `bun run build` time.
    - Code Quality:
      - No new dependency (TypeScript 7 is already a dev dependency).
      - The portability scans (`src/__tests__/portability.test.ts`) also run over `dist/**/*.js`, so the compiled output is host-API-free where the source is.
    - Security:
      - Law 1: the browser bundle check still excludes draft code.
      - `dist/` contains no proof code (asserted).
  - Approach:
    - Skills to Use:
      - `liveframe-execution`;
      - `find-docs` (TypeScript 7 and Bun).
    - Library Documentation to Check Before Implementation:
      - TypeScript 7.0.2 (`/microsoft/typescript/v7.0.2`): `rewriteRelativeImportExtensions`, `customConditions` under NodeNext, declaration emit for `.tsx`, and JSON import attributes.
      - Bun 1.4 (`/websites/bun_sh`): `bun test --conditions`, whether `Worker` and `import.meta.resolve` honour the parent's `--conditions`, `bun pm pack` and `files`.
    - Documentation Reviewed:
      - `package.json`, `tsconfig.json`, `src/preview/worker/index.ts:45`, `src/preview/load.ts:18`, `src/cli/mcp.ts:5-7`, `src/__tests__/portability.test.ts`, `src/__tests__/exports.test.ts`.
      - The readiness packaging probe (81 TS5097 errors; Node `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`).
    - Options Considered:
      - Run every repo test against built `dist/` — rejected: tests that mix relative `src` imports with self-references would load two module graphs (`Element` identity breaks).
      - `bun build --no-bundle` plus a separate declaration step — rejected: two tools for what `tsc` 7 does in one pass.
      - Bundle each subpath — rejected: it duplicates shared modules across subpaths and breaks cross-subpath `instanceof` (`LiveframeFailure`).
    - Chosen Approach:
      - Compile per file with `tsc`, and use a custom condition for the repository's own source resolution.
      - If `Worker` or `import.meta.resolve` ignore `--conditions` (documentation check), the approach changes: record it here and choose between building before the worker and loader tests, or resolving the SDK specifier relative to the loader file.
    - API Notes and Examples:
      ```json
      "./sdk": { "liveframe:source": "./src/sdk/index.ts", "types": "./dist/sdk/index.d.ts", "default": "./dist/sdk/index.js" }
      ```
    - Files to Create/Edit:
      - `tsconfig.build.json` (new), `tsconfig.json`, `package.json`;
      - `src/preview/worker/index.ts`;
      - test helpers that spawn the CLI (`graft grep "src/cli/liveframe.ts"`);
      - `src/__tests__/exports.test.ts`, `src/__tests__/portability.test.ts`, `src/__tests__/archive.test.ts` (new);
      - `docs/spec.md` §13, `.gitignore` (if needed).
  - Test Cases to Write:
    - `archive_contains_only_the_release_files`: runs `bun pm pack --dry-run` (or inspects the packed tarball). Fails on any `src/`, `__tests__`, `proof/`, `.ts` non-declaration file or fixture, and on a missing `dist` entry for any export.
    - `every_export_has_types_and_default`.
    - `compiled_output_is_host_api_free`: the existing scans over `dist`.
  - Notes (executed 2026-10-25):
    - Build: new `tsconfig.build.json` (extends `tsconfig.json`; `noEmit: false`, `declaration`, `rewriteRelativeImportExtensions`, `resolveJsonModule`, `outDir: dist`, `rootDir: src`, excludes `src/__tests__`) plus new `scripts/build.ts`, which cleans `dist/`, runs `tsc -p tsconfig.build.json`, then rewrites declaration specifiers (finding 1). `bun run build`: 0.24 s cold (`dist/` removed) and warm, 81 `.js` and 81 `.d.ts` files. `bun run check` now starts with `bun run build`, so the archive and `dist` scans always see fresh output; the whole check is 4 m 21 s (637 tests, 88 files).
    - Finding 1 (deviation, recorded here as the plan requires): TypeScript 7.0.2 rewrites relative `.ts` specifiers in emitted `.js` but **leaves them in `.d.ts`** (verified on a two-file probe, with `declaration`, `emitDeclarationOnly` and `rewriteRelativeImportExtensions` all set). Left as-is, a strict NodeNext consumer would hit TS5097 inside the declarations. The one-pass `tsc` build therefore gained a 6-line post-pass in `scripts/build.ts` that applies the same rewrite to `dist/**/*.d.ts`. If a later TypeScript version rewrites declarations too, the pass becomes a no-op.
    - Finding 2 (affects repo only): Bun 1.4.4 honours `--conditions` in the test runner, the runtime, `Worker` and `import.meta.resolve` (verified), but **`Bun.build` does not** unless `conditions` is passed explicitly (Bun docs, `/websites/bun_sh`). After the `exports` change, bundled adopter-style entries resolved `dist/` while the test's own host code ran from `src/`, so `conformance_guide_renderer_examples_run` failed with `Cannot destructure property 'definition' of 'implementation[binding]'`. `conditions: ["liveframe:source"]` was added to the three in-repo `Bun.build` calls whose entries import the package by name (`src/__tests__/fixtures/conformance-browser-host.ts`, `proof/tests/renderer-browser.test.tsx`, `proof/host/server.ts`). No consumer-facing behaviour changes: the archive gate (Task 2) and the demo host (Task 5) bundle the installed package and must not pass the condition.
    - `--conditions liveframe:source` was added to every repository spawn of the CLI: `src/__tests__/cli-mcp.test.ts`, `src/__tests__/sdk-gen.test.ts`, `src/__tests__/mcp-guide.test.ts`, `proof/tests/mcp-agent-loop.test.ts`, `proof/tests/mcp-capture.test.ts`, `proof/tests/preview-capture.test.ts`, plus the out-of-repo child probes in `src/__tests__/preview-load.test.ts`, `src/__tests__/runner-in-process.test.ts` and the guide example in `src/__tests__/phase-2-loop.test.ts`. Without it the loader resolved the `dist` SDK and produced a valid tree whose elements failed `src`'s element identity check (`invalid-children`).
    - `exports`: all 14 subpaths are `{ "liveframe:source", "types", "default" }`; `./schemas/*` stays a bare map. `tsconfig.json` gains `customConditions: ["liveframe:source"]`. Self-reference resolution was checked in all three places: tests and `tsc` see `src/`, a plain `bun` process sees `dist/`.
    - Worker entry: `src/preview/worker/index.ts` derives the entry's extension from `import.meta.url` once at module load (`./entry.ts` in the repository, `./entry.js` in `dist`). Verified out of band: `dist`'s `workerRunner()` returned the same tree as `render()` for all 22 proof scenarios; the installed-archive proof stays Task 2's.
    - `package.json`: `private` removed; `bin.liveframe` → `./dist/cli/liveframe.js` (the `#!/usr/bin/env bun` shebang survives emit); `files: ["dist", "schemas", "docs", "CHANGELOG.md"]`; `publishConfig: { access: "public", tag: "next" }`; `sideEffects: ["./dist/preview/worker/entry.js"]`; `engines.bun: ">=1.4.2"`; `author` and `keywords` added; `repository`/`homepage`/`bugs` point at the existing `origin` remote, `github.com/ashiqrniloy/liveframe`, which Task 8's owner confirmation must match. `version` stays `0.0.0`.
    - `bun pm pack --dry-run` now lists 185 files, 1.15 MB (was 236 files, 4.18 MB): `dist/**/*.js`, `dist/**/*.d.ts`, `schemas/*.json`, `docs/*.md`, `LICENSE`, `README.md`, `package.json`. `CHANGELOG.md` is allowlisted and arrives in Task 4. The dist CLI resolves `../../package.json` and `../../schemas/*.json` from `dist/cli/`: `bun dist/cli/liveframe.js gen … --check` regenerates the fixture byte-identically and `bun dist/cli/liveframe.js mcp <config>` starts and exits cleanly.
    - New tests: `src/__tests__/archive.test.ts` (`archive_contains_only_the_release_files`, `every_export_has_types_and_default`, `package_metadata_is_publishable`, all reading the pack dry-run) and `compiled_output_is_host_api_free` in `src/__tests__/portability.test.ts`, which reuses the source scan (declarations skipped: they hold `import("./x.js")` type references only).
    - Spec §13 gained two bullets: what the package ships and nothing else, and the runtime matrix (Bun ≥ 1.4.2 backend, any ES2022 runtime for host-API-free subpaths, any ESM bundler for browser subpaths), with the optional peers named. No format or runtime behaviour changed.

- [x] Task 2: Prove the installed archive outside the checkout
  - Acceptance Criteria:
    - Functional: `bun scripts/release/archive-gate.ts [--tarball <path>]` builds and packs (or takes a tarball, or an npm spec such as `@arnilo/liveframe@next` in Task 10). It installs into a fresh temporary directory outside the repository, adds the peers, and from a different working directory:
      1. packs a two-file widget with a composed component, stores it with `fileStore`, reopens the store and loads it. It renders the same tree with `inProcessRunner()` and `workerRunner()`, and the loader resolves all three SDK entry points through the installed package's exports.
      2. times out a looping widget with `workerRunner()`, then renders the next request.
      3. runs `liveframe gen` and `liveframe gen --check` through the installed binary.
      4. starts `liveframe mcp <config>` over stdio with the default runner, lists exactly seven tools, and packs and renders one draft.
      5. `Bun.build`s a browser page importing `/react`, `/preview/react`, `/css` and `/conformance/react` with the installed `react`/`react-dom`.
      6. type-checks a consumer importing every subpath's public types with `{ strict, module/moduleResolution: NodeNext, skipLibCheck: false }` and zero errors.
      7. if `node` is on `PATH`, imports `.`, `/sdk`, `/css`, `/pack`, `/store` and `/conformance` under Node and calls one function from each.
    - It exits non-zero naming the failed step.
    - The backlog entries "Verify installed-package loader and worker entry before release" and "Exclude test fixtures from the release package" are closed with pointers here. Readiness B1 and B2 (proof), T2 (archive).
    - Performance: record the gate's wall time. No budget.
    - Code Quality:
      - Bun only. Step 7 runs the system `node` if present and never installs it.
      - The temporary directory is removed, unless `--keep` is passed.
    - Security:
      - Law 1: step 5's bundle contains no draft code (the same marker scan as `preview-react` tests).
      - Law 2: step 1's trees pass host re-validation.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`, `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4: `bun pm pack --destination`, `bun add <tarball>`, `Bun.build` targets.
      - `@modelcontextprotocol/client` 2.4.0, the stdio client (already a dev dependency).
    - Documentation Reviewed:
      - `src/__tests__/cli-mcp.test.ts` (stdio client pattern), `src/__tests__/phase-2-loop.test.ts`, `src/__tests__/runner-worker.test.ts`.
      - The backlog entries cited above.
    - Options Considered:
      - Fold it into `bun test` — rejected: installing takes network and minutes, so it belongs to a release script run by CI (Task 8) and before publishing.
    - Chosen Approach:
      - One script with numbered steps, reused by CI and by the registry verification in Task 10.
    - API Notes and Examples:
      ```sh
      timeout 900s bun scripts/release/archive-gate.ts
      timeout 900s bun scripts/release/archive-gate.ts --package @arnilo/liveframe@next
      ```
    - Files to Create/Edit:
      - `scripts/release/archive-gate.ts` (new), `scripts/release/fixtures/` (new: the widget, MCP config, consumer `main.ts`, browser page);
      - `package.json` (`release:gate` script), `plans/backlog.md`.
  - Test Cases to Write:
    - The gate is the test. Deliberately break step inputs once while developing (for example, remove `dist/preview/worker/entry.js` from a copy) and record that the step fails, in the Notes.
  - Notes (executed 2026-10-25):
    - `scripts/release/archive-gate.ts` runs seven named steps and exits non-zero naming the failed one. Setup: `bun run build` then `bun pm pack --destination <temp>/pack`, `bun add <tarball> <peers> @types/react @types/react-dom @types/node @modelcontextprotocol/client` in a `mkdtemp` directory, fixtures copied there, `liveframe.config.ts` written. `--tarball <path>` and `--package <spec>` skip the build; the registry path is exercised in Task 10. Peers come from `package.json` `peerDependencies`, so Task 3's floors flow into the gate without edits.
    - Steps: (1) pack the two-file composed widget, `verifyPackage`, `fileStore` write, store reopened, `loadPlacement`, both runners render equal trees; the linked code is asserted to import all three SDK entry points. (2) a looping draft times out with `limit-exceeded`, then the next render succeeds on the same worker. (3) `gen` then `gen --check` through `node_modules/.bin/liveframe`. (4) `Client` + `StdioClientTransport` against `bun node_modules/.bin/liveframe mcp <config>`: exactly seven tools, `pack_draft`, `render_scenarios`. (5) `Bun.build` of a browser page importing `/react`, `/preview/react`, `/css`, `/conformance/react`, metafile-checked to reach only `dist/` inputs and scanned for the draft marker (Law 1). (6) the repository's `bun node_modules/typescript/lib/tsc.js -p fixtures/consumer` with `{ strict, NodeNext, skipLibCheck: false }` over a consumer importing every subpath's types. (7) `node` on `PATH` runs a probe calling one function from `.`, `/sdk`, `/css`, `/pack`, `/store`, `/conformance`; skipped when node is absent.
    - Wall time: 3.1 s warm; 8.4 s with a cold Bun install cache (5.6 s of that is `bun add`), against the 900 s timeout. No budget is set.
    - Negative check (recorded as the plan requires): packing the archive, deleting `dist/preview/worker/entry.js` from the extracted copy, repacking and passing it with `--tarball` made step 1 fail and exit 1 with `BuildMessage: ModuleNotFound resolving ".../dist/preview/worker/entry.js" (entry point)` and `archive gate: step failed: pack, store, reload and render through both runners`.
    - Deviations: the consumer project also installs `@types/node` and uses `lib: [ESNext, DOM, DOM.Iterable]`, because `@types/react`'s Playwright declarations need `Buffer` and `Symbol.asyncDispose` even with `skipLibCheck: false`; the gate installs nothing else. `tsconfig.json` now includes `scripts` so `bun run typecheck` covers the gate and the build script (both were previously unchecked); `tsconfig.build.json` still compiles `src` only, so nothing new reaches `dist`. Fixtures reference the repository's proof catalog and capabilities (copied into the archive's temp dir) instead of duplicating 100 KB of JSON.
    - `package.json` gains `release:gate`. Both backlog entries are closed with pointers here. `bun run check` passes below; the gate is not part of it because it installs from the registry cache and takes seconds to minutes.

- [ ] Task 3: Prove and widen the peer-dependency floors
  - Acceptance Criteria:
    - Functional:
      - Each peer range starts at the oldest version that passes its suites:
        - `react`/`react-dom` (candidate `^19.0.0`): renderer, preview and conformance-react tests;
        - `playwright` (candidate `^1.49.0`, where `locator.ariaSnapshot()` landed): capture tests;
        - `@modelcontextprotocol/server` (candidate `^2.4.0` unless an older 2.x passes): MCP tests.
      - `scripts/release/peer-floors.ts` installs the floor versions into a temporary copy and runs those suites. Readiness B5, R14.
      - Spec §13 states the ranges.
    - Performance: n/a.
    - Code Quality: dev dependencies stay at current versions. Only `peerDependencies` change.
    - Security: n/a.
  - Approach:
    - Skills to Use:
      - `find-docs` (React 19.0 vs 19.3 APIs used: `onCaughtError`/`onUncaughtError` on `hydrateRoot`, which are 19.0+; Playwright `ariaSnapshot`).
    - Library Documentation to Check Before Implementation:
      - React 19 release notes (`/facebook/react`).
      - Playwright release notes for `ariaSnapshot` (`/microsoft/playwright`).
      - The MCP SDK changelog for `fromJsonSchema` and `StdioServerTransport` (`@modelcontextprotocol/server`).
    - Documentation Reviewed:
      - `package.json` peers.
      - `src/conformance/react/page.tsx:134-138` (React 19 root options).
      - `src/cli/capture.ts:111` (`ariaSnapshot`), `src/cli/mcp.ts:27-45`.
    - Options Considered:
      - Keep the current narrow ranges — rejected (R14): adopters on React 19.0–19.2 get peer conflicts.
    - Chosen Approach:
      - Measured floors.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `scripts/release/peer-floors.ts` (new), `package.json`, `docs/spec.md` §13.
  - Test Cases to Write:
    - The floor run is the test. The Notes record each floor tried and the first passing version.

- [ ] Task 4: Write the outsider docs
  - Acceptance Criteria:
    - Functional:
      - `README.md` is npm-ready:
        - what Liveframe is (four laws in one line each);
        - install (`bun add @arnilo/liveframe`, optional peers per subpath);
        - requirements and the runtime matrix (R2);
        - a quickstart from catalog to rendered `<Surface>` that compiles under the guide test pattern;
        - the subpath table, links to every guide, the license and the compatibility policy.
      - `docs/security.md` states the trust model:
        - what is validated where (pack, verify, load, runner, arrival);
        - reference runners are not sandboxes, with the residual cross-package risk;
        - `liveframe mcp` runs agent drafts with the process's permissions;
        - stores are untrusted;
        - widget schemas cannot use patterns;
        - URL-valued props need catalog patterns or implementation sanitising (readiness S3 docs, S5).
      - `docs/compatibility.md` states R15 (patch, minor, format `/N`, `fileStore` layout, error-kind growth) and the deprecation practice.
      - `CHANGELOG.md` has a `0.1.0` entry (Unreleased until Task 13) with the known limitations: G29 deferred, reference runners not sandboxes, Bun-only backend.
      - `SECURITY.md` names the reporting route (GitHub private vulnerability reporting).
      - Every guide replaces `bun ./node_modules/@arnilo/liveframe/src/cli/liveframe.ts` with `liveframe` / `bunx liveframe`. `graft grep "src/cli/liveframe.ts"` finds no doc hit.
      - The existing guide tests still compile their examples.
      - A new test checks that every relative link in `README.md` and `docs/*.md` resolves.
    - Performance: n/a.
    - Code Quality: each fact is stated once and linked from elsewhere; the spec stays normative.
    - Security: the guide says that passing the conformance kit does not prove isolation or authorisation (spec §14).
  - Approach:
    - Skills to Use:
      - `liveframe-execution`, `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - GitHub docs: private vulnerability reporting (`/websites/github`).
    - Documentation Reviewed:
      - `README.md`, every `docs/*.md`.
      - The guide tests (`src/__tests__/*-guide.test.ts*`).
      - Decision R15, R20.
    - Options Considered:
      - Docs only on GitHub — rejected: the archive ships `docs/` so agents with only `node_modules` can read them (Task 11).
    - Chosen Approach:
      - Ship the guides with the package and keep links relative.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `README.md`, `docs/security.md` (new), `docs/compatibility.md` (new), `CHANGELOG.md` (new), `SECURITY.md` (new);
      - `docs/sdk.md`, `docs/preview.md`, `docs/mcp.md`, `docs/packages.md`, `docs/renderer.md`, `docs/conformance.md`, `docs/styling.md`, `docs/formats.md`;
      - `src/__tests__/readme-guide.test.ts` (new: quickstart), `src/__tests__/docs-links.test.ts` (new).
  - Test Cases to Write:
    - `readme_quickstart_runs`: fails if the README example stops compiling or rendering.
    - `docs_links_resolve`: fails on a broken relative link.

- [ ] Task 5: Build the demo host: an app that installs, places and persists widgets
  - Acceptance Criteria:
    - Functional:
      - `examples/demo-host/` is its own Bun project, depending on `@arnilo/liveframe` through the packed archive (`file:` tarball from Task 2's script). Task 10 switches it to the registry version.
      - It holds its own catalog, capabilities, primitives (React implementations), one theme and one design system. They are app code, copied or adapted from `proof/` (allowed: an app owns primitives). The spec §2 placement rule is kept: nothing here is imported by `src/`.
      - The primitives fix plan 010 F1: a dialog that arrives already open mounts in the scoped portal with an inert background, and Escape raises its close intent (readiness D8b).
      - A Bun server:
        - `POST /widgets` packs with `pack()`, verifies with `verifyPackage()` and stores with `putPackage()`;
        - `PUT /placements/:id` stores a placement after checking params;
        - `POST /placements/:id/intents` re-checks the intent as the viewer, applies `setState` to stored state, and dispatches demo actions in-process with an action log;
        - `GET /surfaces/:id` loads with `loadPlacement()`, renders with `workerRunner()` and returns the tree plus the manifest;
        - a page draws it with `<Surface>`.
      - All records persist in `fileStore(<data dir>)`.
      - `examples/demo-host/README.md` explains running it.
    - Performance: record a cold start and one surface render. No budget.
    - Code Quality: the demo uses only public exports (a test fails on any deep import). No library change.
    - Security:
      - Law 1: no draft code reaches the page (scan).
      - Law 4: actions dispatch only after the server re-checks the intent against the manifest and capabilities.
      - Law 2: `<Surface>` validates every arrival.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (renderer, storage), `lean-build`.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4 `Bun.serve` routes and HTML imports (`/websites/bun_sh`).
      - React Aria 1.22 modal/portal behaviour for the dialog fix (`/adobe/react-spectrum`).
    - Documentation Reviewed:
      - `proof/host/server.ts`, `proof/host/client.tsx`, `proof/renderer/primitives/index.tsx:367-392`.
      - `plans/evidence/010-impact-analysis.md` F1 reproduction, `docs/packages.md`, `docs/renderer.md`.
    - Options Considered:
      - Reuse `proof/host` directly — rejected: proof code imports repo internals and fixtures, and the demo must run from the installed package.
      - A framework (Next, Vite) — rejected: no new tool, and Bun serves pages.
    - Chosen Approach:
      - A minimal Bun app shaped like the proof host but built only on public exports.
    - API Notes and Examples:
      ```sh
      cd examples/demo-host && bun install && bun run start   # http://localhost:3300
      ```
    - Files to Create/Edit:
      - `examples/demo-host/**` (new: `package.json`, `server.ts`, `client.tsx`, `catalog.json`, `capabilities.json`, `theme.json`, `design-system.json`, `primitives/*.tsx`, `widgets/hello/*`, `tests/*.test.ts`, `README.md`);
      - `biome.json` (include examples);
      - the root `package.json` script `demo:test`.
  - Test Cases to Write:
    - `state_survives_restart`: install, place, set state, stop the server, start it on the same data dir, and get the same tree with the same state.
    - `initially_open_dialog_is_dismissable` (F1): fails on the proof's current behaviour.
    - `intents_are_rechecked_before_dispatch`: an undeclared action is refused and logs nothing.
    - `demo_uses_public_exports_only`.

- [ ] Task 6: Give the demo host a preview page, an MCP config and the conformance kit
  - Acceptance Criteria:
    - Functional:
      - The demo serves a preview page that mounts `<Preview>` over a `createPreview()` session with the same runner as production.
      - `liveframe preview capture <url> --out <dir>` captures it from the installed binary.
      - `examples/demo-host/mcp.config.ts` default-exports an `AuthoringConfig` binding that page.
      - `liveframe mcp examples/demo-host/mcp.config.ts` lists the seven tools and captures one cell.
      - The demo's tests register `storeSuite` (its `fileStore`), `catalogSuite`, `designSystemSuite`, `rendererSuite` and `rendererBrowserSuite` (its own page entry calling `conformancePage`) from the installed package, and they pass (plan 010 F3).
    - Performance: record capture time per cell.
    - Code Quality: public exports only.
    - Security:
      - Law 1: the preview page and its bundle contain no draft code (marker scan).
      - Law 4: the page records intents and never dispatches.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (preview, renderer).
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64 `Page` for the browser suite.
    - Documentation Reviewed:
      - `docs/preview.md`, `docs/mcp.md`, `docs/conformance.md`, `proof/host/preview.ts`, `proof/host/mcp.config.ts`, `proof/tests/conformance-browser.test.ts`.
    - Options Considered:
      - Skip conformance in the demo — rejected: plan 010 F3 asks that the kit be proved from an installed archive.
    - Chosen Approach:
      - The demo is the outsider's reference for every subpath.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `examples/demo-host/preview.ts`, `preview-client.tsx`, `mcp.config.ts`, `conformance-client.tsx`, `tests/conformance*.test.ts`, `tests/preview.test.ts`, `README.md`.
  - Test Cases to Write:
    - `demo_preview_captures_every_cell`.
    - `demo_mcp_lists_seven_tools_and_captures`.
    - The conformance registrations, all passing.
    - `preview_bundle_has_no_draft_code`.

- [ ] Task 7: Audit the repository before it goes public
  - Acceptance Criteria:
    - Functional:
      - **Owner** decides, per item, whether `proof/references/synapta-core/**` and `proof/references/clay/**` (source and design snapshots of other projects) may be public. Items not approved are removed from the tree *and* from history before the first push (`git filter-repo`; the snapshot SHA-256s in `proof/references/SOURCES.md` stay as evidence, with the files themselves kept out of the repository).
      - Tests that read removed files are changed to skip with a named reason, or are moved to a local-only harness, keeping `bun run check` green.
      - The OFL fonts keep their licence texts (`OFL-*.txt`).
      - A secret scan over the full history (every commit's tree) finds no credential. The tool and command are recorded.
      - `.gitignore` still excludes `/evidence/`, `/.local/` and `/graft/`.
      - Readiness P6.
    - Performance: n/a.
    - Code Quality: the audit result is written to `plans/evidence/013-repository-audit.md`: files reviewed, owner decisions, the scan command and its output summary.
    - Security: no secret or unapproved third-party material in any public commit.
  - Approach:
    - Skills to Use:
      - `investigate-first` (if the scan finds anything).
    - Library Documentation to Check Before Implementation:
      - gitleaks (`/gitleaks/gitleaks`) or trufflehog (`/trufflesecurity/trufflehog`): history scan usage. Prefer a single static binary run once, not a project dependency.
      - `git filter-repo` docs (`/newren/git-filter-repo`): path removal.
    - Documentation Reviewed:
      - `proof/references/SOURCES.md`, `git log -- proof/references` (first added in `4a5a3c9 Plan 001 T1`), `.gitignore`.
    - Options Considered:
      - Keep the repository private — rejected (R16): provenance requires a public repository.
      - Make it public without an audit — rejected: history cannot be un-published.
    - Chosen Approach:
      - Audit and decide before the first push. No remote exists today, so a history rewrite is cheap.
    - API Notes and Examples:
      ```sh
      git filter-repo --path proof/references/synapta-core --invert-paths   # only for owner-rejected paths
      ```
    - Files to Create/Edit:
      - `plans/evidence/013-repository-audit.md` (new);
      - tentative: `proof/references/**`, the proof tests that read them, `proof/references/SOURCES.md`.
  - Test Cases to Write:
    - None beyond keeping `bun run check` green after any removal.

- [ ] Task 8: Run CI on GitHub Actions
  - Acceptance Criteria:
    - Functional:
      - **Owner** creates the public GitHub repository and pushes the audited history. The `repository`, `homepage` and `bugs` fields match it.
      - `.github/workflows/ci.yml` runs on pull requests and on pushes to `main`:
        - `oven-sh/setup-bun` pinned to `1.4.2` (the `packageManager` version);
        - `bun install --frozen-lockfile`;
        - `bunx playwright install --with-deps chromium`;
        - `bun run check`;
        - `bun scripts/release/archive-gate.ts`;
        - `bun scripts/release/peer-floors.ts`;
        - the demo host tests;
        - `bun run bench` as an informational step that never fails the job (CI machines are noisy; the gates stay local release checks).
      - Actions are pinned by commit SHA, and permissions are `contents: read`.
      - A badge in the README. Readiness B3 (CI).
    - Performance: record the workflow duration.
    - Code Quality: Bun only in CI.
    - Security: no secrets in `ci.yml`; minimal permissions.
  - Approach:
    - Skills to Use:
      - `find-docs` (GitHub Actions, setup-bun).
    - Library Documentation to Check Before Implementation:
      - `oven-sh/setup-bun` (`/oven-sh/setup-bun`): `bun-version` input.
      - GitHub Actions `permissions` and pinning (`/websites/github`).
      - Playwright CI install (`/microsoft/playwright`).
    - Documentation Reviewed:
      - `package.json` scripts, `mise.toml`.
    - Options Considered:
      - Gate CI on the bench — rejected: shared runners make µs gates flaky; the bench stays a local release gate (Task 12).
    - Chosen Approach:
      - One workflow, one job, ordered steps.
    - API Notes and Examples:
      ```yaml
      - uses: oven-sh/setup-bun@<sha> # v2
        with: { bun-version: 1.4.2 }
      ```
    - Files to Create/Edit:
      - `.github/workflows/ci.yml` (new), `README.md` (badge), `package.json` (repository fields).
  - Test Cases to Write:
    - CI's first green run on `main` is the evidence; link it in the Notes.

- [ ] Task 9: Add the trusted-publishing workflow
  - Acceptance Criteria:
    - Functional:
      - `.github/workflows/publish.yml` runs on tags `v*`:
        - it repeats CI's checks;
        - it asserts the tag equals `package.json` `version`;
        - it runs `bun run build`;
        - it installs Node ≥ 22.14 and npm ≥ 11.5.1 via `actions/setup-node`, in this job only;
        - it runs `npm publish --access public --tag <next|latest>`, the tag derived from whether the version has a prerelease part.
      - It has `permissions: { contents: read, id-token: write }` and no `NPM_TOKEN`.
      - AGENTS.md records the one exception: "npm runs only in the publish job, for trusted publishing and provenance; Bun remains the only tool everywhere else."
      - **Owner** configures the trusted publisher on npmjs.com (organisation/user, repository, `publish.yml`), or with `npm trust github @arnilo/liveframe --file publish.yml --repo <owner>/<repo> --allow-publish`.
      - If npm cannot configure a trusted publisher before the package exists, the owner publishes the first release candidate once with a short-lived granular token, then configures trusted publishing and revokes the token. Recorded in the Notes (R17).
    - Performance: n/a.
    - Code Quality: the tag derivation is a few lines of shell, with no extra action.
    - Security: no long-lived token. Provenance is generated automatically (public package from a public repository). Actions are pinned by SHA.
  - Approach:
    - Skills to Use:
      - `find-docs` (npm trusted publishing).
    - Library Documentation to Check Before Implementation:
      - npm docs (`/websites/npmjs`): trusted publishers; `npm trust github`; provenance conditions; first-publish requirements.
      - Bun docs: a package's first version also gets `latest`.
    - Documentation Reviewed:
      - Decision R17, R18.
    - Options Considered:
      - `bun publish` — rejected: it cannot generate provenance.
      - Token-based `npm publish --provenance` — rejected as the steady state: a long-lived secret.
    - Chosen Approach:
      - OIDC trusted publishing.
    - API Notes and Examples:
      ```yaml
      permissions: { contents: read, id-token: write }
      - run: npm publish --access public --tag "$TAG"
      ```
    - Files to Create/Edit:
      - `.github/workflows/publish.yml` (new), `AGENTS.md`, `docs/compatibility.md` (release process paragraph).
  - Test Cases to Write:
    - Run the workflow in a dry-run mode (`npm publish --dry-run` behind an input flag) on a `v0.0.0-dry.1` tag on a branch, and link the run in the Notes.

- [ ] Task 10: Publish a release candidate under `next` and verify it from the registry
  - Acceptance Criteria:
    - Functional:
      - `version` becomes `0.1.0-rc.1` and `CHANGELOG.md` gains its entry. A `v0.1.0-rc.1` tag publishes through Task 9.
      - `npm view @arnilo/liveframe dist-tags` shows `next` at rc.1. As the package's first version it is also `latest`; note it, since Task 13 moves `latest`.
      - Provenance is visible (`npm view @arnilo/liveframe@0.1.0-rc.1 --json` shows attestations, or the npm page shows "Provenance").
      - `bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.1.0-rc.1` passes against the registry.
      - `examples/demo-host` switches its dependency to `0.1.0-rc.1`, and its tests pass from the registry install.
      - Any defect found means a fix, `rc.N+1`, and a re-run.
    - Performance: n/a.
    - Code Quality: the version bump touches only `package.json`, `CHANGELOG.md` and the demo's dependency.
    - Security: the published tarball's file list matches Task 1's allowlist (`npm view … dist.fileCount` and the gate's content check).
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - none beyond Task 9.
    - Documentation Reviewed:
      - R18.
    - Options Considered:
      - Publish 0.1.0 directly — rejected (R18): the registry install is the only real proof.
    - Chosen Approach:
      - An rc, verified from the registry.
    - API Notes and Examples:
      ```sh
      git tag v0.1.0-rc.1 && git push origin v0.1.0-rc.1
      ```
    - Files to Create/Edit:
      - `package.json`, `CHANGELOG.md`, `examples/demo-host/package.json`, `examples/demo-host/bun.lock`.
  - Test Cases to Write:
    - The registry gate and demo tests are the evidence; record the commands and outputs in the Notes.

- [ ] Task 11: Run the agent acceptance test from the published docs
  - Acceptance Criteria:
    - Functional: a fresh coding-agent session gets only the installed package's `README.md` and `docs/` (and the npm page), plus a running demo host, and writes a widget with at least two scenarios for the demo catalog. It then:
      1. iterates through `liveframe preview capture` against the demo's preview page until clean;
      2. separately, iterates through the `liveframe mcp examples/demo-host/mcp.config.ts` tools until clean;
      3. publishes the package to the demo host (`POST /widgets`) and places it (`PUT /placements/:id`). The surface renders, and the published hash equals the last previewed hash.
    - Every point where the agent had to guess, or read anything other than the published docs, is recorded as a docs finding. Each finding is fixed in the docs (and a new rc if the archive's docs change) or approved by the owner for the backlog.
    - The transcript summary, with commands, hashes and captured image paths, goes to `plans/evidence/013-agent-acceptance.md`. Readiness P5.
    - Performance: record the elapsed time and the number of iterations per path.
    - Code Quality: n/a.
    - Security: law 4 — the agent never dispatches an action. Law 1 — drafts reach only the runner.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
      - If the owner chooses to run the session as a subagent, use the Agent tool with an explicit "use only these files" brief.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Roadmap Phase 6 Done; `proof/tests/mcp-agent-loop.test.ts` (scripted precedent).
    - Options Considered:
      - Reuse the scripted MCP agent loop — rejected: it proves the tools, not that the docs suffice.
    - Chosen Approach:
      - A real agent with only the docs.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/013-agent-acceptance.md` (new); docs files as findings require.
  - Test Cases to Write:
    - None. The evidence file is the record.

- [ ] Task 12: Review every readiness item before release
  - Acceptance Criteria:
    - Functional:
      - Re-run the whole readiness review against the release candidate's commit:
        - `bun run check`;
        - three `bun run bench` runs on an idle machine;
        - `bun test --coverage`;
        - `bun audit`;
        - the readiness probes (appendix of `plans/evidence/012-release-readiness-review.md`), which must show the fixed behaviour;
        - the archive and registry gates;
        - the consumer `tsc` and Node checks;
        - a public-surface diff of every subpath's exports and the `.d.ts` against plan 012's frozen surface (`exports.test.ts`);
        - a fresh sweep of `src/` changed since `f253c21` for new defects and complexity.
      - Fill the `Pre-release status` column for **every** row of `plans/evidence/012-release-readiness-review.md` (B1–B5, S1–S5, D1–D8, A1–A8, T1–T3, C1–C3, P1–P6): `fixed — <test name or evidence>` or `deferred — <owner approval quote> (<backlog entry>)`. No row may be empty or "partial".
      - New findings from the sweep are added as rows with ids `N1…`, each fixed (a new rc if code changes) or deferred with owner approval.
      - The owner sees the completed table and answers **go** or **no-go**. The answer is recorded verbatim. No-go returns to the named fixes.
    - Performance: the bench gates pass (validator ≤ 1.5 µs per node; render ≤ 3 µs per node and agent-home ≤ 2 ms) on all three runs. A failure is a no-go unless the owner approves it with the numbers in view.
    - Code Quality: every status cites a concrete test name, command or evidence file.
    - Security: S1–S5 each cite a passing regression test or doc section. The probes P1–P6 are re-run and recorded.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`, `code-review`, `security-review`, `graft`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/evidence/012-release-readiness-review.md`, `plans/evidence/012-impact-analysis.md`, every plan 013 task's Notes.
    - Options Considered:
      - Rely on the two impact analyses — rejected (owner instruction): a dedicated review just before release must check every item.
    - Chosen Approach:
      - The original review's checklist, completed row by row, plus a fresh sweep.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/012-release-readiness-review.md` (fill the status column; append a "Pre-release review" section with commands, outputs and the owner's answer).
  - Test Cases to Write:
    - None. The review re-runs every existing gate.

- [ ] Task 13: Publish 0.1.0
  - Acceptance Criteria:
    - Functional:
      - Only after Task 12's recorded **go**:
        - `version` becomes `0.1.0`;
        - `CHANGELOG.md` dates the entry;
        - the `v0.1.0` tag publishes through Task 9 with the `latest` tag.
      - `npm view @arnilo/liveframe dist-tags` shows `latest: 0.1.0`, and `next` moves to `0.1.0` (`npm dist-tag add` through the trusted publisher, or left at the rc with a note).
      - The registry gate passes against `@arnilo/liveframe@0.1.0`. The demo host switches to `0.1.0` and its tests pass.
      - A GitHub release `v0.1.0` carries the changelog notes and the known limitations: G29 deferred, reference runners not sandboxes, Bun-only backend, URL props guidance.
      - Roadmap §3 marks Phase 6 complete. The backlog's G29 entry states it is deferred past 0.1.0 by R20.
    - Performance: n/a.
    - Code Quality: the version bump commit touches only release files.
    - Security: provenance is present on 0.1.0.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - npm `dist-tag` (`/websites/npmjs`).
    - Documentation Reviewed:
      - R18.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - The same workflow as the rc.
    - API Notes and Examples:
      ```sh
      git tag v0.1.0 && git push origin v0.1.0
      ```
    - Files to Create/Edit:
      - `package.json`, `CHANGELOG.md`, `examples/demo-host/package.json`, `examples/demo-host/bun.lock`, `roadmap.md` §3, `plans/backlog.md`.
  - Test Cases to Write:
    - The registry gate on `0.1.0` is the evidence.

- [ ] Task 14: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/013-impact-analysis.md` sweeps all twelve impact areas against what shipped, recording each one or `None — <reason>`.
      - Every finding is presented to the owner in one table with a recommended disposition, and the answer is recorded. Work found after the publish goes to the backlog targeted at 0.1.1, or becomes an `execute` task above this one that ships as `0.1.1` through the same workflow.
      - Compromises Made and Further Actions are filled and handed to `plans/backlog.md`.
    - Performance: confirm each task recorded its numbers.
    - Code Quality: findings name files and spans.
    - Security: confirm laws 1, 2 and 4 were re-proved from the installed package (Tasks 2, 5, 6, 11).
  - Approach:
    - Skills to Use:
      - `create-plan` (final task), `graft`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/evidence/012-impact-analysis.md` (format).
    - Options Considered:
      - n/a — required.
    - Chosen Approach:
      - Sweep, table, dispose.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/013-impact-analysis.md` (new), `plans/backlog.md`, `roadmap.md` §3.
  - Test Cases to Write:
    - None.

## Verification (whole plan)

- `timeout 900s bun run check`
- `timeout 120s bun run build`
- `timeout 900s bun scripts/release/archive-gate.ts`
- `timeout 900s bun scripts/release/peer-floors.ts`
- `cd examples/demo-host && timeout 900s bun test`
- `timeout 600s bun run bench` (three runs)
- `timeout 900s bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.1.0`
- `npm view @arnilo/liveframe dist-tags` (or `bun pm view`)
- `timeout 120s graft build` and `git diff --check`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
