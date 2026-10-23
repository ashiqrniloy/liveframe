# Phase 2 Part B: Packages, Storage and Runners

## Objectives

- Ship `@arnilo/liveframe/pack`:
  - `pack()` turns widget TSX, a manifest and required scenarios into one immutable, content-addressed module, without running widget code;
  - `verifyPackage()` re-checks a package without executing it.
- Ship `@arnilo/liveframe/store`:
  - the package, placement, state and style record formats;
  - the async `Store` interface;
  - `memoryStore()`;
  - `loadPlacement()`, which treats every record read back as untrusted.
- Ship `@arnilo/liveframe/store/fs`: `fileStore(dir)`, one JSON file per record, written atomically.
- Ship the `Runner` interface with `inProcessRunner()` in `@arnilo/liveframe/preview`, and `workerRunner()` in `@arnilo/liveframe/preview/worker`. Both enforce a time limit, and neither is an isolation boundary.

## Expected Outcome

- A proof widget with composed components packs into one ES module. Packing it twice gives the same hash. The package is stored with `fileStore`, and a fresh store on the same directory loads it with `loadPlacement()` and renders the same tree through both runners as `render()` gives directly.
- Each of these fails with a typed error: a forbidden import, an initial state that fails its schema, no scenarios, a scenario outside the manifest's schemas, and a second hash under an existing `(id, version)`.
- `workerRunner()` returns `limit-exceeded` for a widget that never returns, then serves the next request on a fresh worker.
- `loadPlacement()` rejects a tampered package, params that don't fit and a corrupt record. When a state no longer fits, it resets the state and reports the reset.
- `/pack`, `/store` and `/preview` pass the host-API-free scan. `/store/fs` and `/preview/worker` are the named exceptions.
- `docs/packages.md` covers packing, storing, loading and running, for outsiders.

This plan implements roadmap Phase 2 Part B: spec §7.3 (packages), §7.4 (storage), the runner half of §7.5 and the re-run cache key of §8. It depends on `plans/005-Phase-2-Part-A-SDK.md`. From that plan it uses:
- `render()`, `compileValidator` with its input checks, and `liveframe gen`;
- the ported proof widgets with their scenarios (Task 7);
- the contracts recorded in plan 005 Task 1: the `{ catalog, capabilities }` arguments, `data:` URL loading, and sucrase plus acorn.

The scope comes from `decision-logs/2026-10-22-1539-widget-packages-and-reference-stores.md` and `decision-logs/2026-10-22-1600-preview-and-runners.md`.

**Not in this plan:**
- `createPreview()`, `<Preview>` and `liveframe preview capture`: Phase 4 Part B;
- the store conformance suite: Phase 5;
- any storage backend beyond the two reference stores, any approval state, and any isolation sandbox.

Probe answers that hold for every task, unless a task says otherwise:
- **Placement:**
  - `src/pack/`, `src/store/` and `src/preview/` are host-API-free.
  - `src/store/fs/` may use `node:fs`.
  - `src/preview/worker/` may use the `Worker` global.
  - Only `src/preview/load.ts` may contain `import(`, as plan 005 Task 1 decided.
  - The portability scan names each exception and its reason.
- **Four laws:**
  - Law 1: `pack()` and `verifyPackage()` never execute code. Code runs only inside a runner, on the backend.
  - Law 2: every tree a runner returns comes from `render()`'s validated path.
  - Law 4: a package carries no authority; placements and approval stay the app's.
  - Law 3 is untouched.
- **Primitives only:** n/a — packaging is catalog-agnostic.
- **Dependencies:** `sucrase` 3.35.1 and `acorn` 8.19.0, added and justified in Task 4, imported only by `src/pack/`. Nothing else.
- **Reference hosts:** Synapta needs a hostile-code sandbox; it supplies its own `Runner`. Clay is a desktop app and fits `fileStore`. Gaps are recorded, not accommodated.
- **Callers:** no existing callers. New code only.

## Tasks

- [x] Task 1: Name the package, store and runner errors and the hash's canonical form
  - Acceptance Criteria:
    - Functional:
      - A decision log, written with `create-decision-log`, records the following and obtains the owner's explicit approval before anything else in this plan is implemented. The values below are the recommendation.
      - `pack`, `verifyPackage`, `loadPlacement` and `Runner.render` return `Result<…>` with a bounded `LiveframeError[]`, as `render()` does.
      - New error kinds, added to spec §10's list:
        - `forbidden-import`: a non-SDK import, `require(…)`, `import.meta` or a dynamic `import()`;
        - `transpile-failed`: a syntax error, with the file and line in `pointer`;
        - `hash-mismatch`;
        - `version-conflict`: a second hash under an existing `(id, version)`;
        - `not-found`: a missing placement or package.
      - A malformed manifest, scenario or record keeps using `invalid-document`. A missing scenario is `invalid-document` at `/scenarios`.
      - The canonical form: JSON with object keys sorted by UTF-16 code units, no whitespace, and ECMAScript number serialisation. That is RFC 8785 for the JSON this format allows.
      - The hash is `"sha256-" + lowercase hex` over the UTF-8 canonical form of `{ format, manifest, code, scenarios }`.
      - SHA-256 is a small internal pure-JS implementation, so `pack()` stays synchronous and needs no Web Crypto.
      - `docs/spec.md` §7.3, §7.4 and §10 are updated in this same task.
    - Performance: n/a — decision and documentation.
    - Code Quality: each kind is named once in spec §10.
    - Security: every new failure is typed, and none falls back silently (spec §7.4).
  - Approach:
    - Skills to Use:
      - `create-decision-log` — research, alternatives, explicit approval.
    - Library Documentation to Check Before Implementation:
      - RFC 8785 (JSON Canonicalization Scheme), §3.2.
      - FIPS 180-4 (SHA-256).
    - Documentation Reviewed:
      - Spec §7.3, §7.4, §10.
      - `src/errors.ts`: `LiveframeError` kinds.
      - `decision-logs/2026-10-22-1539-widget-packages-and-reference-stores.md`.
      - [RFC 8785 §3.2](https://www.rfc-editor.org/rfc/rfc8785.html#section-3.2): recursive UTF-16 key ordering, ECMAScript serialisation, UTF-8, unchanged array order and Unicode; reject non-finite numbers and lone surrogates.
      - [FIPS 180-4 §6.2](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf): SHA-256.
    - Options Considered:
      - Reuse `invalid-document` for everything — rejected: an agent or host can't tell a conflict from a tampered package without parsing messages.
      - Web Crypto `crypto.subtle.digest` — rejected: it is async, which would change the spec's synchronous `pack()`, and it is absent in some sandboxes the host may run.
      - Base64 (SRI style) — rejected: hex is filename- and URL-safe without escaping.
    - Chosen Approach:
      - The recommendation above, approved before Task 2 starts.
    - API Notes and Examples:
      ```ts
      { kind: "version-conflict", pointer: "", message: "queue@1.2.0 already stored with another hash", expected: "a new version for changed content" }
      ```
    - Files to Create/Edit:
      - `decision-logs/2026-10-23-1752-package-errors-and-hash.md`: new, approved contract and evidence.
      - `docs/spec.md`: §7.3, §7.4, §10.
      - `src/errors.ts`: add the kinds to the union, with a test that every kind is documented.
      - `src/__tests__/errors.test.ts`: new, compares the complete union with the spec §10 table.
      - `roadmap.md` §3: record plan 006 as in progress.
  - Test Cases to Write:
    - `error_kinds_match_spec`: the `LiveframeError["kind"]` union equals the list parsed from spec §10. Fails if they drift.
  - Notes (executed 2026-10-23):
    - Owner explicitly approved the recommended contract before implementation: “Approve the recommended contract”. Recorded the decision in `decision-logs/2026-10-23-1752-package-errors-and-hash.md`.
    - Added the five error kinds and a complete, single-entry-per-kind table in spec §10. Spec §7.3 now defines the exact canonical bytes and hash fields; §7.3–§7.4 and §10 use bounded `Result` failures consistently, including runner results.
    - `error_kinds_match_spec` failed before the spec table was added and passes with all 23 kinds. `timeout 600s bun run check` passed: 242 tests, zero failures, plus generated-code drift, typecheck, lint and format checks. Existing lint warnings remain.
    - Task 3 must preserve array order and Unicode without normalisation, reject lone surrogates and non-finite numbers, and sort every object's raw keys by UTF-16 code units. Hashing and runtime implementations remain in later tasks.

- [x] Task 2: Define the package, scenario and record formats with published JSON Schemas
  - Acceptance Criteria:
    - Functional:
      - Formats are written in the schema language, with TS types derived from them:
        - `WidgetPackage`: `format: "liveframe-package/1"`, `manifest`, bounded `code`, `scenarios` (1…64), and `hash` matching `^sha256-[0-9a-f]{64}$`;
        - `Scenario`: `name` (bounded, unique within a package), `params`, `context`, `state?`, `data`;
        - `Placement`: `{ id, slot, widget: { id, version }, params }`;
        - `StyleRecord`: `{ kind: "theme" | "designSystem", id, version, body }`;
        - state: any JSON value.
      - Each has a structural validator returning bounded, pointed errors.
      - They are registered in `src/formats/registry.ts`. `schemas/widget-package.json`, `schemas/placement.json` and `schemas/style-record.json` are published. The name avoids `schemas/package.json`, which would look like an npm manifest.
      - The code bound (default 1 MiB) and the scenario bound are written into spec §7.3.
    - Performance: n/a — install time.
    - Code Quality:
      - The format modules live in `src/formats/` and are exported only through `/pack` (package, scenario) and `/store` (records), per spec §13.
      - No root-export change.
    - Security: law 2 for stored documents. Malformed shapes are rejected before any semantic check.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/storage.md` and `references/formats.md`.
    - Library Documentation to Check Before Implementation:
      - Ajv 8.20.0 (dev only) for the schema agreement test, as `src/__tests__/schemas.test.ts` already does.
    - Documentation Reviewed:
      - Spec §7.3, §7.4, §13.
      - `src/formats/registry.ts:14-77`.
      - `scripts/schemas.ts`.
      - `src/__tests__/schemas.test.ts:22-33`.
    - Options Considered:
      - Put the formats in the root export — rejected: spec §13 places record formats in `/store` and packages in `/pack`.
    - Chosen Approach:
      - The plan 003 pattern: schema-language source, then derived types, published JSON Schema, and an agreement test.
      - Export the format-only `/pack` and `/store` entries in this task to meet the public-surface criterion; later tasks extend them. JSON Schema handles transport structure; runtime validators also check unique scenario names, UTF-8 bytes and non-JSON JavaScript inputs.
    - API Notes and Examples:
      ```ts
      validateWidgetPackageShape(doc); // Result<WidgetPackage>, structure only (no hash or manifest semantics)
      validatePlacement(doc);          // Result<Placement>
      ```
    - Files to Create/Edit:
      - `src/formats/package.ts`, `src/formats/records.ts`: new.
      - `src/formats/registry.ts`.
      - `src/formats/json.ts`: shared JSON-value check; `src/formats/manifest.ts`: internal transport-only manifest check using existing field schemas.
      - `src/pack/index.ts`, `src/store/index.ts`, `package.json`: format-only subpath exports.
      - `src/__tests__/schemas.test.ts`: include new format dependencies in the drift-test copy; `src/__tests__/exports.test.ts`: assert the format-only subpath surfaces.
      - `docs/formats.md`: transport formats, bounds and validation limits.
      - `schemas/{widget-package,placement,style-record}.json`: generated by `scripts/schemas.ts`.
      - `docs/spec.md` §7.3: the bounds.
      - `src/__tests__/package-format.test.ts`: new.
  - Test Cases to Write:
    - `published_schemas_match_sources` (existing test): now covers the three new files.
    - `package_format_rejects_malformed`: a missing hash, a bad hash pattern, zero scenarios, duplicate scenario names, oversized code and an extra field each give `invalid-document` at the right pointer.
    - `record_formats_reject_malformed`: a placement without `slot`, a style record with an unknown `kind`.
  - Notes (executed 2026-10-23):
    - Added schema-derived readonly package, scenario, placement and style record types, plus bounded structural validators; state accepts any JSON value. The internal JSON checker rejects cycles, sparse/undefined entries, class instances and non-finite numbers without recursive traversal.
    - Published three registered schemas: widget-package, placement and style-record. Scenario and JSON shapes are embedded; the package schema references the published manifest schema. The runtime checker also enforces unique scenario names and the 1 MiB UTF-8 code bound, which standard JSON Schema cannot express. Spec §7.3 and docs/formats.md document those limits and the 1–64 scenario count.
    - Added the format-only /pack and /store exports now, leaving the root export unchanged. Tasks 5 and 6 extend those existing entry points; Task 10 only adds the remaining three subpaths.
    - The new test first failed on missing format modules. After implementation, timeout 600s bun run check passed: 248 tests, zero failures, plus codegen drift, typecheck, lint and format checks. Added Ajv agreement, schema publishing/drift, malformed-input pointers, error bounds, Unicode byte boundaries and structural-versus-installation tests. Existing unrelated lint warnings remain.
    - Context7 lookup for Ajv hit its monthly quota; verified against the installed Ajv 8.20.0 package and existing Ajv2020 agreement-test pattern. No dependency was added.

- [x] Task 3: Hash packages over a canonical form
  - Acceptance Criteria:
    - Functional:
      - `canonicalJson(value)` follows Task 1: sorted keys and no whitespace. It rejects non-JSON values.
      - `sha256(bytes)` is pure JS, with UTF-8 encoding done in code. `TextEncoder` and Web Crypto are not used.
      - `packageHash({ format, manifest, code, scenarios })` returns `"sha256-<hex>"`.
      - Key order in the input never changes the hash.
    - Performance: hashing a 1 MiB code string takes under 50 ms in the test. This is an install-time cost.
    - Code Quality: one internal module, not exported, under 150 lines.
    - Security: the hash is an integrity check, not a signature. `docs/packages.md` (Task 11) says so.
  - Approach:
    - Skills to Use:
      - `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - FIPS 180-4 §6.2 and the NIST example vectors.
      - RFC 8785 §3.2.3 (key sorting).
    - Documentation Reviewed:
      - The Task 1 decision log.
      - RFC 8785 §3.2 and FIPS 180-4 §4.2.2, §5.3.3 and §6.2; NIST example vectors.
    - Options Considered:
      - A hashing dependency — rejected: about 100 lines of well-tested code doesn't justify a runtime dependency.
      - `Bun.CryptoHasher` — rejected: a host API in a host-API-free subpath. It is used only in tests, as an oracle.
    - Chosen Approach:
      - An internal SHA-256 cross-checked against NIST vectors and Bun's hasher.
    - API Notes and Examples:
      ```ts
      packageHash(pkgWithoutHash) // "sha256-ba7816bf…"
      ```
    - Files to Create/Edit:
      - `src/pack/hash.ts`: new.
      - `src/__tests__/pack-hash.test.ts`: new.
  - Test Cases to Write:
    - `sha256_nist_vectors`: `""`, `"abc"`, the 448-bit message and one million `a`s. Fails on any arithmetic error.
    - `sha256_matches_bun`: 500 seeded random strings, including non-BMP text, agree with `Bun.CryptoHasher`.
    - `canonical_json_is_order_independent`: permuted keys give an equal hash, changed package fields give a different hash, and the existing hash field is excluded.
    - `canonical_json_preserves_rfc8785_order_and_primitives`: UTF-16 and numeric-looking keys, arrays, ECMAScript primitives and unnormalised Unicode.
    - `canonical_json_rejects_non_json_and_lone_surrogates`: invalid JavaScript values, cycles, sparse arrays and lone surrogates in keys and values throw TypeError.
    - `package_hash_1_mib_under_50_ms`: the complete canonicalisation, UTF-8 and hashing path meets the budget.
  - Notes (executed 2026-10-23):
    - Added the internal 139-line `src/pack/hash.ts`: iterative RFC 8785 canonicalisation reuses the JSON validator, rejects lone surrogates, preserves array order and Unicode, and sorts raw UTF-16 keys (including numeric-looking keys). Manual UTF-8 and synchronous pure-JavaScript SHA-256 use no host APIs, dependency or public export. The hash includes exactly format, manifest, code and scenarios. No spec change was needed.
    - Tests first failed on the missing module. All four known SHA-256 vectors and 500 seeded Unicode strings plus 500 byte arrays now agree with the independent Bun oracle. Canonicalisation, malformed inputs, field coverage and the excluded hash field are covered.
    - Removed per-block iterator allocations to meet the performance gate: hashing a 1 MiB code package took 12.82 ms in the final full check (under 50 ms). `timeout 600s bun run check` passed: 254 tests, zero failures, plus generated-code drift, typecheck, lint and format checks. Existing unrelated lint warnings remain; both new files lint cleanly.
    - Task 5 must translate internal canonicalisation TypeErrors (including lone surrogates that structural validation permits) into bounded invalid-document results, as its fail-closed contract requires.

- [x] Task 4: Transpile and link a widget's files into one module
  - Acceptance Criteria:
    - Functional:
      - `bundle({ files, entry })` transforms each module reachable from `entry` with sucrase. The options are `transforms: ["typescript", "jsx"]`, `jsxRuntime: "automatic"`, `jsxImportSource: "@arnilo/liveframe/sdk"`, `production: true` and `filePath`.
      - `keepUnusedImports: true` retains unused runtime imports for the allowlist. `disableESTransforms: true` leaves optional calls intact for AST checks and keeps modern JavaScript syntax.
      - It parses each transformed module with acorn (`ecmaVersion: "latest"`, `sourceType: "module"`) and checks imports:
        - relative imports resolve within `files`, trying the exact path, then `.tsx`, `.ts`, `/index.tsx` and `/index.ts`;
        - the SDK specifiers (`@arnilo/liveframe/sdk`, `/sdk/jsx-runtime`, `/sdk/jsx-dev-runtime`) are allowed;
        - anything else is `forbidden-import`: another import or re-export, `require(…)`, `import.meta` or a dynamic `import()`, found anywhere in the AST.
      - It links the modules into one ES module:
        - SDK imports are hoisted and deduplicated at the top;
        - each dependency is wrapped in a function scope that returns its export namespace, in dependency post-order from the entry;
        - the entry's default export becomes the module's default export.
      - It rejects:
        - a missing file or an unresolved relative import (`invalid-document` at `/files/<path>`);
        - an import cycle (`invalid-document`, naming the cycle);
        - an entry without a default export;
        - identifiers in the reserved `__lf_` prefix.
      - A syntax error is `transpile-failed`, with the file and line.
      - The output is deterministic: the same files give a byte-identical module.
      - `package.json` `dependencies` gains `"sucrase": "3.35.1"` and `"acorn": "8.19.0"`, pinned exactly.
    - Performance: bundling the agent-home widget (six files) takes under 100 ms in the test. This is an install-time cost.
    - Code Quality:
      - `src/pack/bundle.ts` is the only importer of either dependency.
      - Source edits are string splices at acorn's `start`/`end` offsets, applied back to front. There is no code generator.
      - The AST walker is a small local function; `acorn-walk` is not added.
    - Security:
      - Law 1: nothing is evaluated. A test file whose top level would throw or set a global bundles without effect.
      - Fail closed: any import not allowed is rejected.
  - Approach:
    - Skills to Use:
      - `find-docs` for sucrase and acorn. Context7 was over quota when this plan was drafted, and the facts below come from the packages' own `dist/types` and a local spike.
      - `liveframe-execution` → `references/storage.md`.
    - Library Documentation to Check Before Implementation:
      - sucrase 3.35.1 `Options` (`dist/types/Options.d.ts`: `transforms`, `jsxRuntime`, `jsxImportSource`, `production`, `filePath`, `disableESTransforms`).
      - acorn 8.19.0 `parse(input, options)` (`dist/acorn.d.ts`: `ecmaVersion`, `sourceType`, node `start`/`end`).
    - Documentation Reviewed:
      - Spec §7.3 and §13 (no WebAssembly).
      - Execution lookup: Context7's monthly quota was exhausted. Verified Sucrase 3.35.1 against its installed README and `dist/types/{Options,index}.d.ts`, and Acorn 8.19.0 against `dist/acorn.d.ts` (`parse`, locations, node offsets and import/export node unions).
      - `decision-logs/2026-10-22-1539-widget-packages-and-reference-stores.md`, whose transpiler assumption this task checks.
      - Spike, 2026-10-22, Bun 1.4.2:
        - sucrase's core ESM entry bundles for `target: "browser"` to about 209 KB minified;
        - the forbidden-pattern scan finds only a `Buffer` use guarded by a `typeof Buffer` check (`@jridgewell/sourcemap-codec`), a `Buffer.isBuffer` inside an uncalled `ts-interface-checker` type, and an `eval` inside an emitted react-hot-loader string;
        - acorn bundles to about 119 KB with no host API;
        - sucrase's output for a widget keeps ESM imports and emits `_jsx` from `@arnilo/liveframe/sdk/jsx-runtime`.
    - Options Considered:
      - esbuild, swc or oxc — rejected: native or WebAssembly (spec §13).
      - `Bun.Transpiler` — rejected: a host API.
      - TypeScript 7 — rejected: the native Go port, not pure JS (confirm with `find-docs`).
      - `@babel/standalone` — rejected: about 6.5 MB.
      - sucrase's `imports` transform with pattern-matched `require` linking — rejected by the owner: it would depend on sucrase's output shape.
    - Chosen Approach:
      - sucrase for syntax, acorn for import facts and splice offsets, and a small linker.
      - Live bindings across modules are not preserved, because widgets are pure. This is documented.
    - API Notes and Examples:
      ```ts
      bundle({ files: { "queue.tsx": src, "task-card.tsx": card, "ui.gen.ts": ui }, entry: "queue.tsx" })
      // → Result<string>; SDK namespaces are hoisted once, with local aliases inside each module.
      ```
    - Files to Create/Edit:
      - `src/pack/bundle.ts`: new.
      - `package.json`: `dependencies`.
      - `bun.lock`.
      - `src/__tests__/portability.test.ts`: non-relative dependency imports are allowed only for `sucrase` and `acorn` in `src/pack/bundle.ts`. Its browser bundle is scanned now (the public `/pack` entry wires it in Task 5), allowing exact snippets for the two known Buffer paths and nine transform/parser strings, including the react-hot-loader eval string. Each snippet must occur and is removed once, so additional hits fail. The bundle's metafile inputs must exclude sucrase's CLI-only packages (`commander`, `tinyglobby`, `mz`, `pirates`).
      - `src/__tests__/pack-bundle.test.ts`: new.
  - Test Cases to Write:
    - `bundles_composed_components`: the agent-home fixture's six files link into one module, and its import list is SDK-only.
    - `rejects_forbidden_imports`: `import fs from "node:fs"`, `export * from "lodash"`, `require("x")`, `import.meta.url` and `await import("./x")` each give `forbidden-import` with file and line.
    - `rejects_unresolved_cycle_and_syntax`: a missing relative file, an `a → b → a` cycle and a syntax error (`transpile-failed`).
    - `bundle_is_deterministic`: two runs with the `files` keys in a different order are byte-equal.
    - `bundle_never_executes`: a file with `globalThis.__lfRan = true` at its top level bundles, and the global stays unset.
    - `pack_bundle_has_no_host_apis` (portability): as described under Files.
    - `links_import_export_forms_and_isolates_module_scopes`: default, named, namespace and star forms, destructured exports and independent local identifiers.
    - `resolves_relative_paths_in_order_and_does_not_escape_files`: exact/extension/index precedence and rejection of paths above the widget root.
    - `supports_default_declarations_namespace_reexports_and_sdk_reexports`: named default declarations and namespace re-exports from relative modules and the SDK.
    - `preserves_top_level_await_and_module_hashbangs`: valid module syntax stays valid inside wrappers.
  - Notes (executed 2026-10-23):
    - Added internal `src/pack/bundle.ts` with pinned Sucrase 3.35.1 and Acorn 8.19.0. It checks every transformed AST, resolves only reachable relative files, rejects cycles and reserved names, and splices syntax into dependency-ordered module scopes. SDK namespace imports are deduplicated. Import/export bindings are snapshots, not live bindings, as planned. No spec change was needed.
    - Tests first failed on the missing module. The linked agent-home fixture (six TSX files plus generated primitives) matches direct SDK rendering for all eight scenarios. Forbidden unused imports, re-exports, nested and optional require calls, dynamic imports, import.meta, missing files/default exports, cycles and syntax errors are covered. Bundling top-level throws/global writes causes no execution.
    - `timeout 600s bun run check` passed: 264 tests, zero failures, plus generated-code drift, typecheck, lint and format checks. Agent-home bundling took 62.76 ms, under 100 ms. New files lint cleanly; existing unrelated lint warnings remain. The browser dependency scan passes and its metafile excludes all four CLI-only packages.
    - Found a Bun 1.4.2 loader regression relevant to Task 8: importing `"data:text/javascript," + encodeURIComponent("const x = { value: 3 }; export default () => x.value;")` returns a string default export instead of a function, while a body without a dot works. Task 4's execution tests use temporary `.mjs` files, cleaned in finally; the production loader is not implemented or changed here. Added a pre-implementation gate to Task 8 so this invalidates the earlier spike explicitly and must be raised against the approved loader decision if it persists.

- [x] Task 5: Pack and verify widget packages
  - Acceptance Criteria:
    - Functional:
      - `pack({ files, entry, manifest, scenarios }, { catalog, capabilities })`:
        1. Validates the manifest with `validateManifest`. A different `catalogId` is `catalog-mismatch`, and an initial state that fails the state schema is `invalid-document` at `/manifest/initialState`.
        2. Checks the scenarios. There must be at least one, with unique names. `params`, `context` and `state` must match the manifest's schemas. `data` must hold exactly the manifest's data keys, each valid against its capability source's `result` schema.
        3. Bundles the files (Task 4).
        4. Hashes the result (Task 3).
        5. Returns `Result<WidgetPackage>`.
      - `verifyPackage(pkg, { catalog, capabilities })`:
        - re-checks the shape (Task 2), the manifest and the scenarios;
        - re-parses `code` with acorn and re-applies the import rule, so a hand-written package can't smuggle an import;
        - recomputes the hash; a difference is `hash-mismatch`.
      - Neither function executes code.
      - The scenario data rule follows spec §7.3 as plan 005 Task 1 rewrote it: data is always checked against the capabilities' source `result` schemas.
    - Performance: `verifyPackage` on the agent-home package takes under 20 ms in the test, because it runs on every load.
    - Code Quality:
      - The scenario checks reuse `compileSchema` closures from the manifest's schemas.
      - No second schema interpreter.
    - Security:
      - Law 1: never executes; there is a test.
      - Fail closed on every check, collecting up to 20 errors.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/storage.md`.
    - Library Documentation to Check Before Implementation:
      - None beyond Task 4.
    - Documentation Reviewed:
      - Spec §7.3.
      - `src/formats/manifest.ts:83`.
      - `src/validate/schema.ts`.
      - `proof/widgets/*/manifest.ts`.
      - Plan 005 Task 7 scenarios.
    - Options Considered:
      - Render each scenario inside `pack()` — rejected: `pack()` never runs code (spec §7.3), and rendering is the preview's job.
      - Let `verifyPackage` trust `code` because the hash covers it — rejected: the hash proves integrity, not origin.
    - Chosen Approach:
      - Compose Tasks 2–4 with the existing validators, in a fixed order that fails fast on shape before semantics.
      - Share the parsed-module import checker with the linker; linked packages permit only SDK imports, with no remaining relative dependencies. Reuse compiled schema closures across all scenarios, defaulting omitted state to the manifest's initial state.
    - API Notes and Examples:
      ```ts
      const r = pack({ files, entry: "queue.tsx", manifest, scenarios }, { catalog, capabilities });
      if (r.ok) verifyPackage(r.value, { catalog, capabilities }); // { ok: true }
      ```
    - Files to Create/Edit:
      - `src/pack/pack.ts`, `src/pack/verify.ts`: new; extend Task 2’s `src/pack/index.ts`.
      - `src/pack/bundle.ts`: share the AST import checker between bundling and verification.
      - `src/__tests__/exports.test.ts`: extend the exact `/pack` export list.
      - `src/__tests__/portability.test.ts`: scan the public `/pack` entry, and distinguish host module specifiers from the JSON Schema's `node:` property.
      - `docs/spec.md` §7.3: one sentence saying `verifyPackage` re-applies the import rule.
      - `src/__tests__/pack.test.ts`: new.
  - Test Cases to Write:
    - `pack_is_reproducible`: agent-home packed twice gives the same hash.
    - `pack_rejections`, one case each with kind and pointer asserted: a forbidden import, an initial state outside its schema, no scenarios, a scenario whose state, params, context or data fails, an undeclared data key, and a catalog mismatch.
    - `verify_detects_tampering`: changed code, a changed scenario or a changed manifest each give `hash-mismatch`. A hand-built package with a valid hash and a `node:fs` import gives `forbidden-import`.
    - `pack_and_verify_never_execute`: the `globalThis` marker stays unset.
    - `scenario_defaults_and_capability_result_schemas`: omitted state uses initialState, and data follows the installed capability result schema.
    - `package_failures_are_bounded_and_fail_closed`: malformed structure, non-JSON values, lone surrogates, oversized code and more than 20 scenario errors return bounded failures.
    - `verify_rechecks_manifest_and_scenarios`: installation checks run again on load, with escaped JSON Pointers preserved.
    - `verify_agent_home_under_20_ms`: the full verification path meets the load-time budget.
  - Notes (executed 2026-10-23):
    - Added public `pack()` and `verifyPackage()` in `/pack`. They compose structural and manifest validation, compiled scenario checks, linking and canonical hashing without executing code. Scenario data has exactly the manifest's source keys and uses the capabilities' result schemas; omitted state uses initialState. Failures remain pointed and bounded to 20, including canonicalisation TypeErrors for lone surrogates.
    - Extracted the linker's import validation into one shared parsed-module checker. Verification rejects remaining relative imports as well as non-SDK imports/re-exports, nested or optional require calls, dynamic imports and import.meta, even with a valid hash. Spec §7.3 now explicitly requires re-parsing and re-applying the import rule.
    - Tests first failed because the public functions were absent. Added reproducibility, schema and catalog rejection, tampering, non-execution, malformed/non-JSON input, code/scenario bounds, error bounds and escaped-pointer coverage. Exact exports and the browser portability scan now cover the public `/pack` entry; the scan distinguishes host specifiers from the JSON Schema's `node:` property. No dependency was added.
    - `timeout 600s bun run check` passed: 272 tests, zero failures, plus generated-code drift, typecheck, lint and format checks. Agent-home verification took 6.74 ms (under 20 ms), and composed-component bundling remained under 100 ms at 69.42 ms. Existing unrelated lint warnings remain. No later task needed amendment.

- [x] Task 6: Define the Store interface and ship memoryStore() and loadPlacement()
  - Acceptance Criteria:
    - Functional:
      - The `Store` interface is spec §7.4's, all async.
      - `memoryStore()`:
        - stores copies, so a caller mutating a value it put or got can't change the store;
        - `putPackage` with an existing `(id, version)` and the same hash is a no-op, and with a different hash rejects with `version-conflict`;
        - `deletePlacement` also removes that placement's state;
        - `listPlacements` is sorted by id.
      - `loadPlacement(store, id, { catalog, capabilities })` returns `Result<{ package, params, state, reset? }>`:
        - a missing placement or package is `not-found`;
        - a malformed placement is `invalid-document`;
        - a package whose manifest `(id, version)` differs from the placement's `widget` is `invalid-document`;
        - `verifyPackage` failures pass through;
        - params outside the package's params schema are `invalid-prop` at `/params/…`;
        - a missing state gives the manifest's initial state, with no `reset`;
        - a state that no longer fits gives the initial state, with `reset` holding the errors that triggered it.
    - Performance: n/a — the load path is dominated by `verifyPackage` (Task 5).
    - Code Quality:
      - The store is dumb: it checks only the `(id, version)` hash rule.
      - Copies are made with a JSON round trip, which is host-API-free; `structuredClone` is not used.
    - Security:
      - Spec §7.4 "a store is not trusted": every record is checked on read.
      - No silent fallback other than the reported state reset.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/storage.md`.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - Spec §7.4.
      - `decision-logs/2026-10-22-1539-widget-packages-and-reference-stores.md`.
    - Options Considered:
      - Validate records on `put` — rejected: the spec keeps the store dumb, and reads are untrusted anyway.
      - Keep state inside the placement record — rejected: spec §7.4 keys them separately.
    - Chosen Approach:
      - A `Map`-backed store, plus a loader that composes `verifyPackage` with compiled params and state checks.
    - API Notes and Examples:
      ```ts
      const store = memoryStore();
      await store.putPackage(pkg);
      await store.putPlacement({ id: "home-1", slot: "home.main", widget: { id: pkg.manifest.id, version: pkg.manifest.version }, params: {} });
      const r = await loadPlacement(store, "home-1", { catalog, capabilities });
      ```
    - Files to Create/Edit:
      - `src/store/memory.ts`, `src/store/load.ts`: new; extend Task 2’s `src/store/index.ts`.
      - `src/__tests__/store-memory.test.ts`, `src/__tests__/store-load.test.ts`: new.
      - `src/__tests__/exports.test.ts`: extend the exact `/store` runtime export list.
  - Test Cases to Write:
    - `memory_store_rules`: the version conflict, the idempotent same-hash put, delete removing state, isolation from caller mutation, and sorted listing.
    - `load_placement_rejections`: not found, a tampered package (`hash-mismatch`), params that don't fit, a corrupt placement, and a package/placement version mismatch.
    - `load_placement_resets_state`: a placement moved to a version whose state schema dropped a field gets the initial state and a `reset` report. A missing state gives the initial state with no report.
  - Notes (executed 2026-10-23):
    - Added spec §7.4's async `Store` interface and exported `memoryStore()` and `loadPlacement()` through the existing `/store` entry. No dependency, root export or spec change was needed.
    - The memory store copies every record on put and get with a JSON round trip, preserves same-hash packages unchanged, rejects different hashes with a typed `version-conflict`, sorts placements by id, and deletes their state alongside them. Tuple keys avoid ambiguous compound keys.
    - The loader validates listed placements, verifies package integrity and manifest semantics, checks package identity and params, and checks stored state as JSON against the compiled state schema. Missing state uses initial state without a reset report; incompatible state returns initial state with bounded, pointed reset errors. Loading never executes package code or writes the reset back to the store.
    - The tests first failed on the missing exports. Five new tests now cover all record copy boundaries, immutable packages, missing/corrupt records, package identity, verification-error passthrough, escaped params pointers, and a placement moved to a version that dropped a state field. Task 7 can extract the memory-store rules into its shared contract table.
    - `timeout 600s bun run check` passed: 277 tests, zero failures, plus generated-code drift, typecheck, lint and format checks. The focused storage/export/portability run passed all 14 tests; a browser-target build of `/store` also passed. Existing unrelated lint warnings remain.

- [ ] Task 7: Persist records with fileStore(dir)
  - Acceptance Criteria:
    - Functional:
      - `fileStore(dir)` implements `Store` with one JSON file per record:
        - `packages/<id>/<version>.json`
        - `placements/<id>.json`
        - `states/<id>.json`
        - `styles/<kind>/<id>/<version>.json`
      - Each path segment is encoded so that only `[a-z0-9_-]` stays literal. Every other byte, uppercase letters included, becomes `%XX`. So `..`, `/` and ids that differ only in case can't escape `dir` or collide on case-insensitive file systems.
      - Each write goes to a temporary file in the same directory, then renames over the target.
      - A record that fails `JSON.parse` comes back from the loader as `invalid-document`, naming the record.
      - Leftover temporary files are ignored when listing.
      - The rules match `memoryStore()`, and one shared test table runs against both stores.
    - Performance: n/a — the reference store for desktop and single-node hosts.
    - Code Quality:
      - `src/store/fs/` is the only `node:fs` user outside the CLI, and the portability test names it.
      - It assumes one writing process, and its doc comment says so.
    - Security: path traversal is impossible by construction, and a test proves it.
  - Approach:
    - Skills to Use:
      - `find-docs` for Bun 1.4.2's `node:fs/promises` (`writeFile`, `rename`, `mkdir` with `recursive`, `readdir`, `rm`). A rename within one directory is atomic on POSIX.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2 Node-compat `fs` docs (`node_modules/bun-types/docs/runtime/`).
    - Documentation Reviewed:
      - Spec §7.4.
      - The decision-log assumption that one process with atomic rename is enough.
    - Options Considered:
      - `encodeURIComponent` — rejected: it leaves `.`, `*` and case unchanged.
      - Hashed filenames — rejected: they make the directory unreadable to a person debugging it.
      - An fsync per write — deferred: the spec asks for atomic writes, not durability. Recorded in Further Actions if raised.
    - Chosen Approach:
      - A direct mapping with strict segment encoding, and temp-then-rename writes.
    - API Notes and Examples:
      ```ts
      import { fileStore } from "@arnilo/liveframe/store/fs";
      const store = fileStore("/var/lib/app/liveframe");
      ```
    - Files to Create/Edit:
      - `src/store/fs/index.ts`: new.
      - `src/__tests__/store-contract.ts`: a shared rule table used by both store tests. This is internal; Phase 5 grows it into the conformance suite.
      - `src/__tests__/store-file.test.ts`: new.
      - `src/__tests__/portability.test.ts`: the `src/store/fs/` exemption.
  - Test Cases to Write:
    - `file_store_meets_store_rules`: the shared table passes.
    - `file_store_survives_reopen`: write a package, a placement and its state, open a new `fileStore` on the same `dir`, and read equal records.
    - `file_store_paths_cannot_escape`: ids `../x`, `a/b` and `CON`, and the pair `Queue`/`queue`, all stay under `dir` and stay distinct.
    - `corrupt_file_is_typed_error`: a truncated `placements/<id>.json` makes `loadPlacement` return `invalid-document`.
  - Notes (executed <date>):

- [ ] Task 8: Define the Runner interface and ship inProcessRunner()
  - Acceptance Criteria:
    - Functional:
      - `interface Runner { render(pkg, inputs, options): Promise<Result<UiTree>> }`. `options` is `{ catalog, capabilities, surfaceId, revision, limits?, timeoutMs? }`, with `timeoutMs` defaulting to 100.
      - `inProcessRunner()`:
        - loads `pkg.code` once per hash, through `src/preview/load.ts`'s `import("data:text/javascript," + encodeURIComponent(code))`;
        - compiles the validator once per (catalog, capabilities, hash);
        - calls the SDK's `render()`.
      - A module without a function default export is `render-failed`.
      - The in-process runner can't interrupt a loop. A render that returns after `timeoutMs` is reported as `limit-exceeded`, and the docs say so.
      - The loader resolves the SDK import when the process's working directory is outside the package. A test spawns `bun` with another `cwd` to prove it. If resolution fails there, stop and raise it as a finding against plan 005 Task 1's decision; do not work around it.
      - Before implementing the loader, reproduce Task 4's percent-encoded `data:` regression with a module containing `x.value`, then with the actual linked agent-home module. The earlier simple-module spike is insufficient. If either loads as a string rather than a function, stop and raise the finding against plan 005 Task 1's approved loader decision; do not silently substitute a different loading scheme.
    - Performance: the runner adds under 0.1 ms per warm render over a direct `render()` call (module and validator cached). The test asserts a loose bound.
    - Code Quality:
      - `src/preview/load.ts` is the only file with `import(`. The scan allows exactly that file.
      - The runner doesn't verify packages: the app runs `verifyPackage` when it loads one (spec §7.3).
    - Security:
      - Law 1: code runs on the backend only.
      - The docs state that this runner is not an isolation boundary (spec §7.5).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/preview.md`.
      - `find-docs` for Bun's `data:` URL module support and its module cache.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2 module resolution (`node_modules/bun-types/docs/runtime/`).
      - ECMAScript `import()`.
    - Documentation Reviewed:
      - Spec §7.5.
      - `decision-logs/2026-10-22-1600-preview-and-runners.md`.
      - Spike, 2026-10-22: in Bun 1.4.2 a bare specifier inside a `data:` module resolved to the installed package, while rewriting it to a `file://` URL from `import.meta.resolve` did not behave as a module import.
    - Options Considered:
      - `Function` or `eval` — rejected: forbidden by the spec, CSP and sandboxes.
      - Blob URLs — rejected: they need `URL.createObjectURL`, a DOM API.
      - A host load hook — rejected by the owner (plan 005 Task 1).
    - Chosen Approach:
      - One small loader, with caches keyed by package hash.
    - API Notes and Examples:
      ```ts
      const runner = inProcessRunner();
      const r = await runner.render(pkg, inputs, { catalog, capabilities, surfaceId: "home", revision: 1 });
      ```
    - Files to Create/Edit:
      - `src/preview/index.ts`, `src/preview/runner.ts`, `src/preview/load.ts`, `src/preview/in-process.ts`: new.
      - `src/__tests__/portability.test.ts`: the `load.ts` exception.
      - `src/__tests__/runner-in-process.test.ts`: new.
  - Test Cases to Write:
    - `in_process_matches_render`: for every ported proof scenario, the runner's tree is deep-equal to a direct `render()` of the same widget.
    - `in_process_reports_slow_render`: a widget that busy-waits 150 ms gives `limit-exceeded`.
    - `bad_module_is_render_failed`: a package whose default export isn't a function.
    - `loader_resolves_sdk_from_other_cwd`: a subprocess with `cwd` set to a temp directory loads a package and renders.
  - Notes (executed <date>):

- [ ] Task 9: Bound time and crashes with workerRunner()
  - Acceptance Criteria:
    - Functional:
      - `workerRunner({ timeoutMs? })` returns a `Runner` plus `close()`. It starts its worker from `new URL("./entry.ts", import.meta.url)`, and the worker uses the same loader and `render()`.
      - Requests are serialised, one in flight.
      - A render that exceeds `timeoutMs` terminates the worker and returns `limit-exceeded`. A worker error or exit returns `render-failed`. Either way, the next request starts a fresh worker.
      - Inputs and trees cross by structured clone. The validator is compiled inside the worker and cached by hash.
    - Performance: a warm render's overhead is reported in Notes (structured clone both ways). It isn't gated, because the in-process path is the budgeted one.
    - Code Quality:
      - `src/preview/worker/` is the only user of `Worker` and `self`, and the scan names it.
      - The message protocol is one discriminated union type.
    - Security: the docs and the doc comment state that the worker bounds time and crashes, not what the code can reach (spec §7.5).
  - Approach:
    - Skills to Use:
      - `find-docs` for Bun 1.4.2 Workers (`new Worker(url)`, `postMessage`, `terminate()`, the `error` and `close` events).
    - Library Documentation to Check Before Implementation:
      - `node_modules/bun-types/docs/runtime/workers.mdx` (Bun 1.4.2).
      - `bun-types` `globals.d.ts:863` (`terminate`).
    - Documentation Reviewed:
      - Spec §7.5.
      - Spike, 2026-10-22: a Bun `Worker` loaded a `data:` module whose bare import resolved.
    - Options Considered:
      - A pool of workers — rejected: spec §7.5 needs only time and crash bounds. A pool goes to Further Actions if measured necessary.
      - `Atomics.wait`-based interruption — rejected: it can't stop a CPU-bound loop.
    - Chosen Approach:
      - One lazy worker, replaced after any timeout or crash.
    - API Notes and Examples:
      ```ts
      import { workerRunner } from "@arnilo/liveframe/preview/worker";
      const runner = workerRunner({ timeoutMs: 100 });
      await runner.render(loopingPkg, inputs, opts); // { ok: false, errors: [{ kind: "limit-exceeded", … }] }
      await runner.render(goodPkg, inputs, opts);    // ok, on a fresh worker
      runner.close();
      ```
    - Files to Create/Edit:
      - `src/preview/worker/index.ts`, `src/preview/worker/entry.ts`: new.
      - `src/__tests__/portability.test.ts`: the `src/preview/worker/` exemption.
      - `src/__tests__/runner-worker.test.ts`: new.
  - Test Cases to Write:
    - `worker_times_out_then_recovers`: `while (true) {}` gives `limit-exceeded` within `timeoutMs` + 500 ms, and the next good render succeeds.
    - `worker_crash_is_render_failed`: a module that throws at its top level gives `render-failed`, and the next render succeeds.
    - `worker_matches_render`: for every ported proof scenario, the worker's tree is deep-equal to `render()`'s.
  - Notes (executed <date>):

- [ ] Task 10: Prove the install, store, reload and render loop end to end
  - Acceptance Criteria:
    - Functional:
      - One test:
        1. Packs agent-home (with composed components) from its fixture files, twice, and gets the same hash.
        2. Writes the package, a placement and a state with `fileStore` in a temporary directory.
        3. Opens a fresh `fileStore` on that directory and runs `loadPlacement`.
        4. Renders the loaded placement through `inProcessRunner()` and `workerRunner()`.
        5. Gets trees deep-equal to a direct `render()`.
      - Every other ported widget packs and renders every scenario through both runners, equal to `render()`.
      - The roadmap's typed-error cases are asserted once more at this level, by name, so the Done list maps one to one onto tests.
    - Performance: n/a — integration.
    - Code Quality: the test reads fixtures from disk (tests may use host APIs) and uses only public subpath imports (`@arnilo/liveframe/pack`, `/store`, `/store/fs`, `/preview`, `/preview/worker`, `/sdk`).
    - Security: law 1 end to end. The only code execution happens inside the runners.
  - Approach:
    - Skills to Use:
      - `verify-and-stop` — prove the roadmap's Done list without adding scope.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - Roadmap Phase 2 Part B "Done".
    - Options Considered:
      - Rely on the per-task tests alone — rejected: the roadmap names an end-to-end path, and no single task covers it.
    - Chosen Approach:
      - One integration test file, organised by the Done bullets.
    - API Notes and Examples:
      ```bash
      timeout 120s bun test src/__tests__/phase-2-loop.test.ts
      ```
    - Files to Create/Edit:
      - `package.json` `exports`: add `./store/fs`, `./preview` and `./preview/worker` here, because this test imports them. Task 2 already exports the format-only `./pack` and `./store` entries.
      - `src/__tests__/phase-2-loop.test.ts`: new.
  - Test Cases to Write:
    - `packs_stores_reloads_and_renders`: the five steps above.
    - `every_proof_scenario_through_both_runners`.
    - `done_list_typed_errors`: a forbidden import, a bad initial state, no scenario, a bad scenario, a version conflict, a tampered package, params that don't fit, a corrupt record and a state reset.
  - Notes (executed <date>):

- [ ] Task 11: Publish the package, storage and runner surfaces and their documentation
  - Acceptance Criteria:
    - Functional:
      - `src/__tests__/exports.test.ts` asserts the exact export lists of `/pack`, `/store`, `/store/fs`, `/preview` and `/preview/worker`.
      - The portability test bundles `/pack`, `/store` and `/preview` for `target: "browser"` and scans them, with the per-subpath rules from Tasks 4, 7, 8 and 9 in one table.
      - `docs/packages.md` covers, for outsiders: packing and scenarios, hashes as integrity (not signatures), versions and rollback, the `Store` interface and writing your own store, `loadPlacement` and resets, the runners, their limits, and why neither is a sandbox.
      - `README.md` links it.
      - `.claude/skills/liveframe-execution/references/storage.md`, `preview.md` (the runner half) and `architecture.md` "Today" name the shipped API.
    - Performance: n/a.
    - Code Quality: every example in `docs/packages.md` is exercised by Task 10's test.
    - Security: the docs state law 1 and the non-isolation of the reference runners prominently.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
      - `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - `docs/sdk.md` (plan 005 Task 9).
      - `docs/formats.md`.
    - Options Considered:
      - Separate pages per subpath — rejected: one install path reads best as one page.
    - Chosen Approach:
      - One guide, the export tests, and the skill "Today" sections.
    - API Notes and Examples:
      ```ts
      import { pack, verifyPackage } from "@arnilo/liveframe/pack";
      ```
    - Files to Create/Edit:
      - `docs/packages.md`: new.
      - `README.md`.
      - `src/__tests__/exports.test.ts`, `src/__tests__/portability.test.ts`.
      - `.claude/skills/liveframe-execution/references/{storage,preview,architecture}.md`.
  - Test Cases to Write:
    - `subpath_export_surfaces`: exact lists for the five subpaths.
    - `host_api_free_subpaths_bundle_clean`: the three scans.
  - Notes (executed <date>):

- [ ] Task 12: Analyze architectural impact and dispose of every finding
  - Sweep the twelve impact areas of `.agents/skills/create-plan/references/liveframe.md` §5 against what was delivered. Record each, or `None — <reason>`, in `plans/evidence/006-impact-analysis.md`.
  - List every finding, present them to the owner in one table with a recommended disposition (`execute` or `backlog`), and record the answer.
  - `execute`: add a task above this one and do it. `backlog`: add the item to `plans/backlog.md` and list it under Further Actions.
  - Known areas to confirm:
    - Phase 4's plan builds `createPreview` on `{ catalog, capabilities }`, as spec §7.5 now says.
    - Phase 5's store suite starts from `src/__tests__/store-contract.ts`.
    - Phase 6 must check that the `.ts` worker entry and the `data:` loader work from the published package.
    - Synapta's sandbox runner and Clay's `fileStore` fit are recorded as reference-host notes.
  - Notes (executed <date>):

## Verification (whole plan)

- `timeout 600s bun run check`
- `timeout 120s bun test src/__tests__/phase-2-loop.test.ts`
- `timeout 300s bun bench/render.bench.ts` (non-regression of plan 005's gate)
- `timeout 60s bun pm ls --all | grep -E "sucrase|acorn"` (exactly the pinned versions)

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
