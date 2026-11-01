# Phase 7 Part I: Performance, Host Accessibility and Release 0.2.2

Depends on: plan [021](021-Phase-7-Part-H-Release-0-2-1.md) complete (0.2.1 published, impact findings disposed). Scope: [`decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md`](../decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md).

## Objectives

- Freeze the 0.2.1 public surface (exports, declarations, JSON Schemas, corpus and vectors) as a baseline. A gate fails on any change that the 0.2.2 API register does not classify as additive.
- Measure browser costs on a production React build before optimising, then cut whole-tree arrival cost:
  - reuse unchanged nodes in `<Surface>`;
  - reuse compiled catalogs across validators, in the core, the worker runner and the demo host.
- Give hosts pure helpers for request-time work they now hand-roll:
  - `bindSources()` evaluates `manifest.sources` bindings;
  - `renderKey()` computes the spec §8 re-run cache key.
- Close the accessibility gaps the library owns:
  - an opt-in recipe-derived contrast audit;
  - opt-in focus continuity in `<Surface>`;
  - the `pending`, `mixed`, `current` and `readonly` recipe states;
  - node references for `aria-describedby`, gated on a design approval;
  - text-scale, forced-colours and reduced-motion capture axes.
- Record the designs for extension recipe properties and multiple variant axes. They ship in 0.3.0, not here.
- Publish `0.2.2-rc.N`, verify it, review readiness with the owner, then publish and verify `0.2.2`.

## Expected Outcome

- `@arnilo/liveframe@0.2.2` is on npm with provenance under `latest`. `next` is at or above it.
- `src/__tests__/api-stability.test.ts` passes. Every 0.2.1 export still exists with an identical declaration, or with a change that `scripts/release/api/register-0.2.2.json` lists as additive with a reason and the host action needed (normally none). Every 0.2.1 corpus case, hash vector and patch vector is byte-identical.
- Arrival of a whole tree (LF-17 subject, `bench/streaming.bench.ts`) takes at most 5.0 ms median for validation plus React work in the development build, down from 10.7 ms. Patch mode does not regress. `plans/evidence/022-browser-profile.md` records production-build figures before and after.
- A second `compileValidator` call that reuses the same catalog and capabilities content costs at most 0.25 ms median on the proof catalog, down from 0.73 ms, and still returns a new validator object.
- A host that upgrades from 0.2.1 and changes nothing sees identical trees, CSS bytes, intents, origins, errors and focus behaviour. The only difference is fewer React renders of unchanged nodes, which is invisible to pure implementations. A host opts into each new capability by using it.
- `CHANGELOG.md`, `docs/compatibility.md` (0.2.2 section and Growth), `docs/adopters-0.2.md` and the outsider guides describe every addition. A "Deferred to 0.3.0" list carries, with a full migration entry, any item that a task found would break a contract.

This plan belongs to roadmap Phase 7 as its second patch release. It follows plan 021's release process (`docs/compatibility.md` § "Release process"). The owner approved the scope, the opt-in rule and the no-break rule on 2026-11-01; the decision log above records all three. R15 forbids breaking changes in a patch, so this plan enforces it mechanically. Task 1's gate runs inside `bun run check`, and every task carries a **Compatibility** criterion and updates the register in the same commit. If a task finds that an existing contract must break, it stops. It either redesigns the change additively or moves the item to 0.3.0. A move needs a register entry marked `deferred`, a migration entry in `docs/compatibility.md` § "Deferred to 0.3.0" (before/after, code sample, adopter checklist) and the owner's acknowledgement in the task notes. Existing test assertions are not edited or deleted unless the register names the edit. Task 10 waits for Task 9's owner-approved design. Task 12 writes decisions only. Publishing cannot be undone, so no tag is pushed without the owner's explicit go. Spec sections touched: §5 (schema language), §6.2–§6.4 (states, projection, forced colours), §7.1 (sources), §7.5 (capture), §8 (re-run cache), §10 (validation) and §11 (renderer).

## Compatibility rules for every task

Every task meets these rules. Its Compatibility criterion names the parts it touches.

1. **No removals or renames.** No export, subpath, format field, error kind, CLI flag, MCP tool or tool argument is removed or renamed.
2. **No changed meanings.** No existing function signature narrows its parameters or widens its return in a way that breaks existing callers. Optional parameters and fields may be added.
3. **No changed defaults.** No existing default changes, whether a prop, an option, a timeout, a bound or a behaviour. New behaviour that a host can observe is behind a new opt-in prop, option or function.
4. **No changed outcomes for valid inputs.** No input that is valid in 0.2.1 becomes invalid. No 0.2.1 output changes for the same input: trees, errors (`kind`, `pointer`), CSS bytes, hashes, intents and origins all stay the same. Widening to accept new inputs is additive (precedent: `deferOffscreen` in 0.2.1).
5. **Existing data stays byte-identical.** Every existing corpus case, hash vector, patch vector, JSON Schema `$id` and `fileStore` file stays byte-identical. A schema's content may widen only through a register entry.
6. **Every change is registered.** Every declaration or schema change has a register entry. Each entry gives `subpath`, `name`, `change` (`added` | `widened` | `deferred`), `reason`, `hostAction` (`none`, or exact instructions) and `task`.

## Tasks

- [x] Task 1: Freeze the 0.2.1 API surface and gate every change through a register
  - Acceptance Criteria:
    - Functional:
      - `scripts/release/api-surface.ts <packageRoot> [--out <file>]` emits a deterministic JSON document. For every `exports` subpath with `types`, it lists each exported name with its normalised declaration text, read through the TypeScript compiler API from that subpath's `.d.ts`. It also lists a SHA-256 for each file under `schemas/`, `conformance/corpus/`, `conformance/hash/` and `conformance/patch/`.
      - `scripts/release/api/0.2.1.json` is generated from the `v0.2.1` tag: a temporary `git worktree` at `v0.2.1`, `bun install`, `bun run build`, then the script. The command is recorded in the file's header field.
      - `src/__tests__/api-stability.test.ts` compares the current `dist/` and data files against the baseline and the register, and fails on each of these:
        - an export that has been removed;
        - a declaration whose text changed without a register entry;
        - a register entry whose change did not happen (so the register cannot go stale);
        - a schema change without a register entry;
        - any change to an existing corpus, hash or patch file, which is never allowed;
        - a register entry whose `change` is `deferred` while the declaration still changed. A deferred item must not ship.
      - `scripts/release/api/register-0.2.2.json` starts empty (`[]`).
    - Performance: n/a. This is a test and a release script; it is not on any render path. The test runs in under 10 s, reusing the build that `bun run check` already makes.
    - Code Quality: one script and one test. No new dependency: `typescript` is already a dev dependency. Normalisation (whitespace collapse, sorted keys) is documented in the script header. `docs/compatibility.md` gains a short "How 0.2.x stays compatible" paragraph pointing to the gate.
    - Security: n/a for the four laws. The gate is the mechanism that keeps law-enforcing contracts from changing silently.
    - Compatibility: adds no public surface. It is the enforcement mechanism for rules 1–6.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`: placement and the green-after-task rule.
      - `find-docs`: the TypeScript compiler API (`createProgram`, `TypeChecker.getExportsOfModule`, printing declarations).
    - Library Documentation to Check Before Implementation:
      - TypeScript (the checkout's version): the compiler API for module exports and declaration printing.
    - Documentation Reviewed:
      - `docs/compatibility.md` (Versions, Formats, Growth); `package.json` `exports`; `src/__tests__/exports.test.ts` (it checks export names, not declarations); `scripts/release/archive-gate.ts`.
    - Options Considered:
      - Extend `exports.test.ts` with names only. Rejected: it misses signature changes, which are the likeliest silent break.
      - Use API Extractor. Rejected: a new heavy dependency, and its report format is more than this needs.
      - Download the 0.2.1 tarball with npm. Rejected: npm runs only in the publish job (AGENTS.md). The git tag gives the same sources under Bun.
    - Chosen Approach:
      - Compare declaration text through the TypeScript compiler API, plus file hashes, against a committed baseline, with a JSON register that each task updates.
    - API Notes and Examples:
      ```json
      [{ "subpath": ".", "name": "states", "change": "widened",
         "reason": "adds pending, mixed, current, readonly (Task 8)",
         "hostAction": "Exhaustive Record<(typeof states)[number], T> maps: use Partial<…> or a default branch.",
         "task": 8 }]
      ```
    - Files to Create/Edit:
      - `scripts/release/api-surface.ts`; `scripts/release/api/0.2.1.json`; `scripts/release/api/register-0.2.2.json`
      - `src/__tests__/api-stability.test.ts`
      - `docs/compatibility.md` ("How 0.2.x stays compatible")
  - Test Cases to Write:
    - `baseline_matches_the_checkout_before_any_022_change`: with an empty register the test passes on the plan's starting commit. It fails if the baseline was generated from the wrong tag.
    - `removed_export_fails`, `changed_declaration_without_entry_fails`, `stale_register_entry_fails`, `changed_corpus_file_fails`, `deferred_entry_with_shipped_change_fails`: each runs the comparator on in-memory fixtures and fails if that rule is skipped.
  - Notes (executed 2026-11-01):
    - Implemented `scripts/release/api-surface.ts` using TypeScript's async compiler API (`typescript/unstable/async` and `typescript/unstable/ast`) to extract normalized declaration texts for all typed subpath exports along with transitive local helper declarations, plus SHA-256 hashes for all files in `schemas/`, `conformance/corpus/`, `conformance/hash/` and `conformance/patch/`.
    - Generated the baseline `scripts/release/api/0.2.1.json` from a temporary git worktree at `v0.2.1` with `bun install` and `bun run build`.
    - Initialized `scripts/release/api/register-0.2.2.json` as an empty array (`[]`).
    - Added `src/__tests__/api-stability.test.ts` testing matching baseline against current checkout (runs in ~450ms) and all failure modes on in-memory fixtures (removed exports, unrecorded declaration changes, stale entries, schema changes, tampering with corpus/hash/patch, and shipped deferred changes).
    - Documented the gate in `docs/compatibility.md` under "How 0.2.x stays compatible".
    - `bun run check` passed clean (952 pass, 4 skip, 0 fail; typecheck, lint, and format checks green). No spec changes required.

- [ ] Task 2: Profile browser costs on a production React build
  - Acceptance Criteria:
    - Functional:
      - `bench/streaming.bench.ts` and the renderer selection measurement in `proof/tests/renderer-browser.test.tsx` (`selection_rerender_cost_is_recorded`) gain a production mode. The client bundle is built with `NODE_ENV=production`, without Profiler instrumentation, and timed with `performance.now()` around `flushSync`.
      - `plans/evidence/022-browser-profile.md` records the following, in both development and production builds, warm and repeated, with machine, browser, build and load:
        - whole-tree and patch streaming on the LF-17 subject;
        - the 679-node selection update under both proof design systems.
        Each is split into JSON parse, arrival validation, React work, and layout plus paint (from the Chromium performance trace).
      - The record names the dominant cost. If it is not React work, Tasks 3 and 4 are re-ordered and amended here, with the reason written down.
      - The backlog entry "Profile production browser selection costs before optimizing the renderer" is closed with a link to the record.
    - Performance: measurement only. No budget changes, and existing bench gates are unchanged.
    - Code Quality: the production switch is a flag on the existing scripts, not a new harness.
    - Security: n/a. Measurement only, no runtime change.
    - Compatibility: n/a. No published file changes.
  - Approach:
    - Skills to Use:
      - `investigate-first`: evidence-ranked attribution before optimising.
      - `find-docs`: Playwright tracing and React production builds.
    - Library Documentation to Check Before Implementation:
      - Playwright (the checkout's version): `browser.startTracing` / CDP performance trace. React 19.3: production build behaviour and the absence of `<Profiler>` in production.
    - Documentation Reviewed:
      - `plans/evidence/021-streaming-patches.md`; plan 021 Task 12 notes (whole tree 10.7 ms, patches 2.7 ms, development build); backlog P2 entry; `bench/streaming-client.tsx`.
    - Options Considered:
      - Optimise straight from development-build numbers. Rejected: roadmap §1 requires measurement first, and development React inflates render cost.
    - Chosen Approach:
      - Add a production flag and a trace-based split to the existing benches.
    - API Notes and Examples:
      - `timeout 600 bun --conditions liveframe:source bench/streaming.bench.ts --production [--patches]`
    - Files to Create/Edit:
      - `bench/streaming.bench.ts`; `bench/streaming-client.tsx`; `proof/tests/renderer-browser.test.tsx` (an added production measurement; existing assertions untouched)
      - `plans/evidence/022-browser-profile.md`; `plans/backlog.md` (close the P2 entry)
  - Test Cases to Write:
    - n/a. This is evidence. The existing bench assertions (final-tree equality, every arrival validated) run in production mode too, and fail if the production bundle draws a different tree.
  - Notes (executed <date>):

- [ ] Task 3: Reuse unchanged nodes when a whole tree arrives
  - Acceptance Criteria:
    - Functional:
      - After a whole tree passes arrival validation, `<Surface>` substitutes the previously accepted tree's node objects for every subtree that is deep-equal to it (JSON equality, key order ignored, array order kept). Reuse requires the same `surfaceId` and the same validator. The resulting tree is deep-equal to the arrival.
      - React skips unchanged subtrees, because node contexts and elements are reused by identity (`renderer.tsx:217-311`).
      - A node whose implementation threw in the previous tree is never reused, nor are its ancestors. It retries on the next arrival exactly as in 0.2.1 (`Boundary` resets on a new node object, `renderer.tsx:58-60`).
      - Origins name the accepted revision. Focus, scroll and local state survive, as in patch mode.
    - Performance:
      - LF-17 whole-tree median validation plus React work is ≤ 5.0 ms (development build, from 10.7 ms). The production figure is recorded against Task 2's baseline.
      - The reuse pass is timed separately: ≤ 1.0 ms median at 679 nodes.
      - Patch mode is no worse than 2.7 ms + 10% median. `bun run bench` gates are unchanged.
    - Code Quality: one internal function in `src/react/` (`shareNodes(previous, next)`), with no export. No `React.memo` and no new component layer.
    - Security:
      - Law 2: reuse runs only after the arrival passes `validateTree`, and only substitutes deep-equal values, so the drawn tree is exactly the validated one.
      - Law 4: origins come from the accepted envelope.
      - A tree that fails validation never reaches reuse.
    - Compatibility:
      - No API change and no register entry.
      - Observable only to implementations that read state other than props during render: they render less often, as they already do under 0.2.1 patch mode. `docs/renderer.md` states this.
      - The retry behaviour after a failure is unchanged. A test proves it.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (renderer reference; new-renderer-behaviour chores); `karpathy-guidelines`; `find-docs` (React 19 element-identity bailout).
    - Library Documentation to Check Before Implementation:
      - React 19.3: "Memoizing individual JSX nodes" (react.dev `useMemo`) and "Preserving and resetting state". Context7 `/reactjs/react.dev`, already consulted for the decision log.
    - Documentation Reviewed:
      - `src/react/renderer.tsx:55-69,166-180,217-311`; spec §9 and §11; plan 021 Task 12 notes; `docs/renderer.md:139-150`.
    - Options Considered:
      - Ask hosts to diff and patch. Rejected: whole-tree transport is the default, and the gain should be automatic.
      - Export `shareTree()` from the root. Rejected for 0.2.2: it adds a public API that `<Surface>` makes unnecessary. Listed in Further Actions if a non-React renderer asks for it.
      - Fuse reuse into `validateTree`'s walk. Rejected: it would couple the validator to renderer state and change a public function's behaviour.
    - Chosen Approach:
      - A post-validation, bottom-up structural reuse against the accepted tree. Nodes known to have failed are excluded, using a `Set` that `Boundary` fills from `componentDidCatch`.
    - API Notes and Examples:
      - n/a (internal).
    - Files to Create/Edit:
      - `src/react/renderer.tsx`; `src/react/share.ts` (new, internal)
      - `src/__tests__/react-browser.test.tsx`; `src/__tests__/react-surface.test.tsx`
      - `docs/spec.md` §11 (whole-tree reuse sentence); `docs/renderer.md`; `plans/evidence/022-browser-profile.md` (after figures)
  - Test Cases to Write:
    - `whole_tree_arrival_reuses_unchanged_nodes`: render counters show that only the changed row and its ancestors render. It fails if reuse is skipped.
    - `reused_tree_deep_equals_the_arrival`: across corpus tree pairs, the accepted tree deep-equals the arrival. It fails on a wrong substitution.
    - `failed_node_retries_on_next_arrival`: an implementation that throws once recovers on the next deep-equal arrival, as in 0.2.1. It fails if the failed node is reused.
    - `different_surface_or_validator_reuses_nothing`.
    - Existing surface, intent, confirmation and patch tests run unchanged.
  - Notes (executed <date>):

- [ ] Task 4: Reuse compiled catalogs across validators
  - Acceptance Criteria:
    - Functional:
      - `compileValidator` keeps a bounded, least-recently-used cache of catalog-level work: catalog and capabilities validation, styles, structure, and per-kind checks. It is keyed by the canonical JSON of the catalog and of the capabilities. It always returns a new `CompiledValidator` object, and manifest-level checks are compiled per call.
      - Mutating an input document after a call never yields a stale validator, because the key is content, not object identity.
      - `workerRunner` re-validates each result with the runner-kit validator cache, keyed by package hash. This closes backlog "Record the worker host re-validation cost in a budget" (P4) with a measurement.
      - The demo host caches validators by package hash instead of compiling on every render (`examples/demo-host/server.ts:90`).
    - Performance:
      - A second call with an equal catalog and capabilities and a different manifest costs ≤ 0.25 ms median on the proof catalog (`bench/validator.bench.ts`, new case).
      - A cold call costs no more than 5% above the 0.2.1 figure.
      - The worker runner's host overhead per render of a repeated package is recorded.
    - Code Quality: reuse `canonicalJson` from `src/pack/hash.ts`. Check first that the root export can import it without pulling `/pack`'s bundler (Sucrase/Acorn). If it cannot, move `canonicalJson` to a shared internal module, with `/pack` re-exporting it unchanged (graft callers first). No new export.
    - Security: law 2. A cache hit is reached only after the content key matches canonical text that previously validated, so an invalid catalog can never hit. The cache is bounded (64 entries, as in runner-kit).
    - Compatibility:
      - `compileValidator`'s signature, thrown errors (`LiveframeFailure` with the same errors) and per-call identity are unchanged. A test proves each.
      - `/pack`'s `canonicalJson` export is unchanged. No register entry is needed unless a declaration moves; if it does, the entry records "re-export, identical declaration".
  - Approach:
    - Skills to Use:
      - `liveframe-execution`; `karpathy-guidelines`; `graft callers canonicalJson --depth all` before any move.
    - Library Documentation to Check Before Implementation:
      - none. Local: `src/validate/compile.ts:116-249`, `src/runner-kit/cache.ts`, `src/preview/worker/index.ts:72-80`, `src/pack/hash.ts:30-53`.
    - Documentation Reviewed:
      - `plans/requests/clay-adoption-requests.md:207` (0.73 ms per call); backlog P4 worker entry; spec §10 ("compiled per catalog").
    - Options Considered:
      - Return the same validator for identical input objects (WeakMap). Rejected: it changes per-call identity, which `<Surface>` uses to reset, and goes stale if inputs are mutated.
      - Add a public `compileCatalog()`. Rejected for 0.2.2: it adds API when an internal cache gives the same gain. Kept in Further Actions if a port asks for it.
    - Chosen Approach:
      - An internal, content-keyed catalog cache, with a fresh validator per call.
    - API Notes and Examples:
      - n/a (internal). The demo host change is example code.
    - Files to Create/Edit:
      - `src/validate/compile.ts`; possibly `src/canonical.ts` (tentative: only if the `/pack` import pulls the bundler)
      - `src/preview/worker/index.ts`; `examples/demo-host/server.ts`
      - `bench/validator.bench.ts`; `src/__tests__/validator-smoke.test.ts`; `src/__tests__/runner-worker.test.ts`
      - `docs/packages.md` (worker re-validation cost); `plans/backlog.md` (close P4)
  - Test Cases to Write:
    - `second_compile_reuses_catalog_work_and_returns_a_new_validator`: fails if identity is shared or the cache is skipped (verified through an internal counter that only tests read).
    - `mutated_catalog_compiles_fresh`: fails on an identity-keyed cache.
    - `invalid_catalog_never_hits_cache`: fails if the cache key is taken before validation.
    - `worker_runner_reuses_validator_per_package_hash`.
  - Notes (executed <date>):

- [ ] Task 5: Add `bindSources()` and `renderKey()`
  - Acceptance Criteria:
    - Functional:
      - `bindSources(manifest, capabilities, { params, state, context })` (root export) returns `Result<Readonly<Record<string, { source: string; params: Json }>>>`, with one entry per `manifest.sources` data key. It applies the following rules:
        - **Literals:** copied as they are.
        - **`{ from, path }` bindings:** read by walking the dotted path through the frozen input, with the same grammar as `manifest.ts:19-21`.
        - **Missing values:** a binding whose value is absent is omitted when the source parameter is optional. When the parameter is required, the result is an `invalid-prop` error at `/sources/<key>/params/<name>`.
        - **Final check:** each source's resolved parameters are checked against `capabilities.sources[name].params`, with errors pointed into `/sources/<key>/params`.
        - **Inputs:** the manifest and capabilities must be validated, exactly as `compileValidator` requires; invalid documents raise `LiveframeFailure`.
      - `renderKey({ hash, catalogId, params, state, data, context })` (`/pack`) returns the SHA-256 hex of the canonical JSON of those inputs. Two inputs that differ only in key order produce the same key.
      - Spec §7.1 names `bindSources` as the request-time evaluation of bindings. Spec §8 names `renderKey` as the key for the re-run cache.
    - Performance: `bindSources` is linear in the number of bound parameters. `renderKey` cost is recorded on the agent-home data in `bench/render.bench.ts` (informational, no gate).
    - Code Quality: `bindSources` lives in `src/formats/manifest.ts`, beside the binding grammar. `renderKey` lives in `src/pack/hash.ts` and reuses `canonicalJson`/`sha256`. Both are host-API-free (the portability scan covers them).
    - Security: law 4. The helpers resolve no data and run no action; they produce the arguments the host's own resolver authorises as the viewer. Values that are not JSON (accessors, functions, cycles) fail as `invalid-prop`, never throw.
    - Compatibility: two `added` register entries. No existing export changes.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (formats reference); `typescript-advanced-types` (inferring the result keys from the manifest is not required; keep it `string`).
    - Library Documentation to Check Before Implementation:
      - none. Local: `src/formats/manifest.ts:18-21,131-195`; `src/pack/hash.ts`; spec §7.1 and §8.
    - Documentation Reviewed:
      - The evaluation's "Host Integration Chasm" (`plans/liveframe-evaluation.md`); `examples/demo-host/server.ts:75-90`.
    - Options Considered:
      - A stateful `/host` surface controller. Rejected by the decision log: it holds storage and transport policy that belongs to the host.
      - Resolve sources inside `bindSources` through an injected resolver. Rejected: it mixes pure binding with host I/O. Hosts call their own resolver over the result.
    - Chosen Approach:
      - Two pure functions next to the semantics they evaluate.
    - API Notes and Examples:
      ```ts
      const bound = bindSources(pkg.manifest, capabilities, { params, state, context });
      if (!bound.ok) return fail(bound.errors);
      const data = Object.fromEntries(await Promise.all(Object.entries(bound.value)
        .map(async ([key, { source, params }]) => [key, await resolve(source, params, viewer)])));
      const key = renderKey({ hash: pkg.hash, catalogId, params, state, data, context });
      ```
    - Files to Create/Edit:
      - `src/formats/manifest.ts`; `src/index.ts`; `src/pack/hash.ts`; `src/pack/index.ts`
      - `src/__tests__/manifest.test.ts`; `src/__tests__/pack-hash.test.ts`; `src/__tests__/exports.test.ts`; `src/__tests__/portability.test.ts` (if file-listed)
      - `docs/spec.md` §7.1, §8; `docs/packages.md`; `docs/formats.md`
      - `scripts/release/api/register-0.2.2.json`
  - Test Cases to Write:
    - `binds_literals_params_state_and_context_paths`.
    - `missing_optional_binding_is_omitted_and_missing_required_is_invalid_prop`: checks the pointer as well as the outcome.
    - `bound_params_are_checked_against_the_source_schema`.
    - `non_json_input_fails_closed`.
    - `render_key_ignores_key_order_and_changes_with_any_input`.
  - Notes (executed <date>):

- [ ] Task 6: Add an opt-in, recipe-derived contrast audit
  - Acceptance Criteria:
    - Functional:
      - `auditContrast({ theme, designSystem, catalog, registry?, minimums? })` (root export) resolves every `(kind, variant, slot, state)` in the catalog. For each, it computes the effective pairs below, compositing alpha (role alpha, `backgroundOpacity`, theme alpha) with the spec §6.5 algorithm:
        - **Text:** `textColor` and `placeholderColor` over the effective background (the slot's `backgroundColor`, else the kind's root slot, else the vocabulary's `contrastBase`, else unresolved). The threshold is 4.5:1, or 3:1 for large text from the resolved typography role (≥ 24 px, or ≥ 18.66 px at weight ≥ 700).
        - **Non-text:** for kinds that declare events, `borderColor` at rest and `outlineColor` at focus, against the effective background, at 3:1.
      - It returns `Result<readonly ContrastFinding[]>`. Each finding carries the recipe key, the pair, the measured ratio to two decimals and the threshold. An unresolved background is reported as a finding of kind `unresolved-background`, never guessed.
      - Invalid inputs return the same typed errors as the existing validators.
      - `designSystemSuite` gains an optional `contrast: true | { minimums }` option that turns findings into failures. Without it, the suite is unchanged.
    - Performance: install-time only, never on the render path. Cost is recorded on the proof catalog × both proof design systems.
    - Code Quality: reuse `src/formats/contrast.ts` conversion and compositing and `cascadeRecipes` (`src/resolve.ts:16`). Do not reimplement either. One new module, `src/formats/audit.ts`.
    - Security: law 3 is unchanged. The audit reads roles; it introduces no colour.
    - Compatibility:
      - `validateTheme`, `validateDesignSystem` and `themeCss`/`designSystemCss` are unchanged. A design system that installs today still installs.
      - `designSystemSuite`'s existing cases and defaults are unchanged.
      - Register entries: `added` (`auditContrast`, `ContrastFinding`) and `widened` (the `designSystemSuite` options type, with `hostAction: none`).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (styling reference); `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - WCAG 2.2: the definitions of contrast ratio, large-scale text (1.4.3) and non-text contrast (1.4.11). W3C recommendation text, recorded with its date.
    - Documentation Reviewed:
      - Spec §6.2, §6.5; `src/formats/contrast.ts`; `src/resolve.ts:16-92`; `src/conformance/design-system.ts:46`.
    - Options Considered:
      - Fail installation on audit findings. Rejected by the opt-in rule: installs that pass today could start failing.
      - Guess an unknown background as `surface.base`. Rejected: the result would be silently wrong. Unresolved backgrounds are reported instead.
    - Chosen Approach:
      - A pure audit function plus an opt-in conformance option.
    - API Notes and Examples:
      ```ts
      const audit = auditContrast({ theme, designSystem, catalog });
      // audit.value: [{ key: "button.primary.label.hover", foreground: "text.muted",
      //   background: "accent.fill", ratio: 2.91, minimum: 4.5, kind: "text" }]
      ```
    - Files to Create/Edit:
      - `src/formats/audit.ts`; `src/index.ts`; `src/conformance/design-system.ts`
      - `src/__tests__/contrast-audit.test.ts`; `src/__tests__/conformance-design-system.test.ts`; `src/__tests__/exports.test.ts`
      - `docs/spec.md` §6.5 (audit paragraph); `docs/styling.md`; `docs/conformance.md`
      - `scripts/release/api/register-0.2.2.json`
  - Test Cases to Write:
    - `audit_reports_text_pair_from_recipe_not_declared_in_vocabulary`: the gap this task closes.
    - `large_text_uses_three_to_one`.
    - `alpha_and_background_opacity_composite_once`.
    - `focus_outline_non_text_contrast`.
    - `unresolved_background_is_reported`.
    - `suite_without_contrast_option_is_unchanged`: the existing proof subjects pass identically.
    - `suite_with_contrast_option_fails_on_finding`.
  - Notes (executed <date>):

- [ ] Task 7: Add opt-in focus continuity to `<Surface>`
  - Acceptance Criteria:
    - Functional:
      - With `<Surface focusContinuity>`, if the element focused inside the wrapper or portal container is disconnected by a tree update, focus moves to:
        1. the next tabbable element that was after it in document order before the update and is still connected;
        2. otherwise the previous one;
        3. otherwise the wrapper, which gains `tabIndex={-1}` only in this mode.
        The move uses `focus({ preventScroll: true })`.
      - Focus that has already moved outside the surface is never taken back.
      - Without the prop, behaviour is byte-for-byte that of 0.2.1: no `tabIndex`, no snapshot, no listeners.
    - Performance: with the prop off, there is no added work. With it on, the pre-commit snapshot is taken only while focus is inside the surface. Cost is recorded on the 679-node selection update.
    - Code Quality: the pre-commit snapshot uses a small class component (`getSnapshotBeforeUpdate`) or a layout effect. No per-node DOM markers and no new primitive contract.
    - Security: n/a for the laws. Focus movement emits no intent.
    - Compatibility:
      - A new optional prop only. Register entry `widened` for `SurfaceProps`, with `hostAction: none`.
      - The default is unchanged (opt-in rule). Making it the default is listed for 0.3.0 in Further Actions.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (renderer reference); `find-docs` (React 19 `getSnapshotBeforeUpdate` and `flushSync` semantics).
    - Library Documentation to Check Before Implementation:
      - React 19.3: class `getSnapshotBeforeUpdate` and `useLayoutEffect` ordering. MDN `HTMLElement.focus` `preventScroll`. The HTML spec's definition of the sequential focus navigation order, for "tabbable".
    - Documentation Reviewed:
      - `src/react/renderer.tsx:41-53,140-337` (no focus handling today); spec §11.
    - Options Considered:
      - Wrap every node in a `display: contents` marker to map DOM to node ids. Rejected: it changes the DOM structure host CSS relies on, such as child combinators.
      - A host callback only (`onFocusLost`). Rejected: the host has no node-to-element mapping either.
    - Chosen Approach:
      - Before each update, snapshot the document-order tabbables. After the commit, restore to the nearest connected neighbour.
    - API Notes and Examples:
      ```tsx
      <Surface tree={tree} validator={validator} theme={theme} designSystem={ds}
        onIntent={onIntent} fallback={<Unavailable />} focusContinuity />
      ```
    - Files to Create/Edit:
      - `src/react/renderer.tsx`
      - `src/__tests__/react-browser.test.tsx`; `src/__tests__/fixtures/react-client.tsx`
      - `docs/spec.md` §11; `docs/renderer.md`
      - `scripts/release/api/register-0.2.2.json`
  - Test Cases to Write:
    - `removed_focused_row_moves_focus_to_next_row`.
    - `last_row_removed_moves_focus_to_previous`.
    - `empty_surface_focuses_wrapper`.
    - `focus_outside_surface_is_left_alone`.
    - `portal_focus_is_continued`.
    - `default_surface_drops_focus_as_in_0_2_1`: proves the default did not change.
  - Notes (executed <date>):

- [ ] Task 8: Add the `pending`, `mixed`, `current` and `readonly` recipe states
  - Acceptance Criteria:
    - Functional:
      - `states` gains `pending`, `mixed`, `current` and `readonly`. The recipe key pattern, `validateDesignSystem`, the published design-system JSON Schema and the `RecipeKey` type accept them.
      - The selectors are:

        | State | Selectors |
        | --- | --- |
        | `pending` | `[aria-busy=true]`, `[data-pending]` |
        | `mixed` | `[aria-checked=mixed]`, `[aria-pressed=mixed]`, `:indeterminate`, `[data-mixed]` |
        | `current` | `[aria-current]:not([aria-current=false])`, `[data-current]` |
        | `readonly` | `[aria-readonly=true]`, `[readonly]`, `[data-readonly]` |

      - Source order keeps the existing eight in their 0.2.1 relative order and places the new states between `selected` and `invalid`: `… < selected < current < mixed < pending < readonly < invalid < disabled`.
      - Hover and active still never apply when disabled. Pending suppresses hover and active the same way.
      - The forced-colours table gains a row for each new state, applied only when the state's recipe differs from rest:
        - `current`: 2px solid `Highlight` outline;
        - `mixed`: `Highlight` background with `HighlightText` text, as for selected;
        - `pending`: 1px dashed `CanvasText` outline;
        - `readonly`: `GrayText` border.
      - `emit` returns a promise when the host's `onIntent` (or the `confirm` hook followed by `onIntent`) returns one, and `undefined` otherwise, as in 0.2.1. An implementation can then set `aria-busy` while the host works. A rejection never escapes `emit`'s promise to the window, so there is no unhandled rejection.
      - Completeness rules are unchanged: new states are optional overlays.
    - Performance: `bun run bench` CSS gates are unchanged. A design system with none of the new states projects **byte-identical** CSS (both proof design systems are compared against the 0.2.1 output).
    - Code Quality: changes are limited to `src/formats/fixed.ts`, `src/css/design-system.ts` (`stateSelectors`, order), `src/css/forced-colours.ts`, `src/react/renderer.tsx` (`emit` return) and `src/react/implement.ts` (`Emit` return type).
    - Security: law 3 is unchanged. States are selectors from a fixed list that installed data cannot extend.
    - Compatibility:
      - Register entries:
        - `widened` for `states` and `RecipeKey`. `hostAction`: exhaustive `Record<(typeof states)[number], …>` maps use `Partial` or a default branch (precedent: `styleProps` in 0.2.1).
        - `widened` for the `liveframe-design-system/1` schema pattern.
        - `widened` for `Emit`'s return type, `void` → `Promise<void> | undefined`. `hostAction: none`: code that ignores the result, or assigns `emit` to a void-returning function type, still compiles. Proved by a type test.
        - `widened` for `SurfaceProps.onIntent`'s return type, `void | Promise<unknown>`. `hostAction: none`.
      - Existing corpus cases are unchanged. New corpus cases are added for each state (valid recipe) and for an unknown state name (still rejected).
      - `docs/compatibility.md` Growth names `states` as a growing vocabulary.
      - If the type test shows that the `Emit` widening breaks an existing implementation pattern, the `emit` return is moved to 0.3.0 under the no-break rule. The states still ship.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (styling and renderer references; the style and design-system chore list); `typescript-advanced-types` (the `Emit` return widening and its type tests).
    - Library Documentation to Check Before Implementation:
      - WAI-ARIA 1.2: `aria-busy`, `aria-checked`/`aria-pressed` `mixed`, `aria-current`, `aria-readonly`. CSS Selectors Level 4: `:indeterminate`, `:read-only` (rejected, see below). Record the versions.
    - Documentation Reviewed:
      - Spec §6.2 (states), §6.4 (state table, order, forced colours); `src/formats/fixed.ts:4`; `src/formats/design-system.ts:93-96,304`; `src/css/design-system.ts:25-34`; `src/react/implement.ts:8-22`.
    - Options Considered:
      - A separate `checked` state. Rejected: `[aria-checked=true]` already maps to `selected`, and remapping it would change 0.2.1 CSS.
      - `:read-only` for `readonly`. Rejected: it matches every non-editable element.
      - Track pending inside `<Surface>` and pass `pending` to each node. Rejected: it needs a subscription per node on the render path. The `emit` promise gives the primitive local state at no cost.
    - Chosen Approach:
      - Widen the fixed vocabulary, with byte-identical projection for unused states, and return the host's promise from `emit`.
    - API Notes and Examples:
      ```tsx
      const [busy, setBusy] = useState(false);
      <button className={slot("root")} aria-busy={busy || undefined}
        onClick={() => { const p = emit("onPress"); if (p) { setBusy(true); p.finally(() => setBusy(false)); } }} />
      ```
    - Files to Create/Edit:
      - `src/formats/fixed.ts`; `src/formats/design-system.ts`; `src/css/design-system.ts`; `src/css/forced-colours.ts`; `src/react/renderer.tsx`; `src/react/implement.ts`
      - `schemas/` (regenerated by `scripts/schemas.ts`)
      - `conformance/corpus/design-system/` (new cases only)
      - `src/__tests__/design-system.test.ts`; `src/__tests__/css-design-system.test.ts`; `src/__tests__/css-browser.test.ts`; `src/__tests__/react-intents.test.tsx`; `src/__tests__/react-types.test.tsx`; `src/__tests__/conformance-states.test.ts`
      - `docs/spec.md` §6.2, §6.4, §11; `docs/styling.md`; `docs/renderer.md`; `docs/compatibility.md` (Growth)
      - `scripts/release/api/register-0.2.2.json`
  - Test Cases to Write:
    - `new_states_validate_and_project_in_order`.
    - `unused_new_states_leave_css_byte_identical`: compares against 0.2.1 output for both proof design systems.
    - `unknown_state_still_rejected`.
    - `forced_colours_rows_for_new_states`: a browser test.
    - `emit_returns_host_promise_and_undefined_otherwise`.
    - `emit_rejection_is_contained`.
    - `void_emit_assignment_still_compiles`: a type test.
  - Notes (executed <date>):

- [ ] Task 9: Design node references (decision log; owner approval)
  - Acceptance Criteria:
    - Functional:
      - A proposal in `plans/evidence/022-node-reference-design.md` settles the following:
        - **Authoring:** how a widget author names the target. Candidates are a sibling-relative key path, an SDK `ref(key)` resolved during the build pass, and a tree-unique `anchor` prop. Authors do not know the derived key-path ids (spec §7.1).
        - **Wire form:** what `nodeRef()` carries in the UI tree (the resolved target id).
        - **Validation:** the check that the target exists in the same tree. It must cover `render()`'s one pass, `renderElements`, `validateTree` and patched trees.
        - **Renderer:** how `<Surface>` exposes per-surface DOM ids (for example `item.domId(nodeId)`), unique across sibling surfaces.
        - **Codegen:** generated types and the elements JSON Schema.
        - **Ports and corpus:** what ports must implement, and the corpus cases that prove it.
      - The proposal shows that every 0.2.1 input keeps its meaning, and lists the register entries it would add.
      - The owner approves a design, recorded with `create-decision-log`, or the item is deferred to 0.3.0 under the no-break rule with a "Deferred to 0.3.0" entry.
    - Performance: the proposal states the validation cost (one id-set lookup per reference after the walk) and the measurement Task 10 must meet: no regression beyond 2% on `bun run bench` validator and render gates.
    - Code Quality: design only. No code.
    - Security: laws 2 and 4. A reference is data, validated against the same tree. It carries no authority and cannot address another surface.
    - Compatibility: the proposal must be additive under rules 1–6, or recommend deferral.
  - Approach:
    - Skills to Use:
      - `create-decision-log`; `liveframe-execution` (formats, SDK and renderer references).
    - Library Documentation to Check Before Implementation:
      - WAI-ARIA 1.2 relationship attributes (`aria-describedby`, `aria-errormessage`, `aria-controls`, `aria-labelledby`); React 19 `useId` (for surface-unique prefixes).
    - Documentation Reviewed:
      - Spec §5 (schema language), §7.1 (key-path ids), §7.2 (`render`, `renderElements`), §9.1 (patches), §10, §11; `src/sdk/render.ts`; `src/validate/tree.ts:31-273`.
    - Options Considered:
      - Recorded in the proposal: at least the three authoring candidates above, each with a rejection reason or the choice.
    - Chosen Approach:
      - Decided by the owner.
    - API Notes and Examples:
      - In the proposal.
    - Files to Create/Edit:
      - `plans/evidence/022-node-reference-design.md`; `decision-logs/<timestamp>-node-references.md` (on approval); this plan's Task 10 (amended to the approved design)
  - Test Cases to Write:
    - n/a. Design task. Task 10 carries the tests.
  - Notes (executed <date>):

- [ ] Task 10: Add `nodeRef()` (only with Task 9's approval)
  - Acceptance Criteria:
    - Functional: as amended by Task 9. At minimum:
      - a catalog prop declared with `nodeRef()` accepts only the id of a node in the same tree;
      - a dangling reference is `invalid-prop` at the prop's pointer, in `render()`, `renderElements` and `validateTree`;
      - `<Surface>` gives implementations a surface-unique DOM id for any node id;
      - generated types and the elements schema express the form.
      - If Task 9 deferred the item, this task is marked `n/a — deferred to 0.3.0 (Task 9)`.
    - Performance: no regression beyond 2% on `bun run bench` gates. Trees without `nodeRef()` props pay nothing extra.
    - Code Quality: one schema form in `src/schema.ts`. Reference checks run after the existing walk, from the id set it already builds.
    - Security: law 2. A reference to another surface or a missing node fails closed.
    - Compatibility: register entries as listed by Task 9. Existing catalogs, trees and corpus cases are unchanged. New corpus cases cover valid and dangling references for ports.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (formats, SDK, renderer); `typescript-advanced-types` (codegen typing).
    - Library Documentation to Check Before Implementation:
      - As listed by Task 9.
    - Documentation Reviewed:
      - Task 9's decision log.
    - Options Considered:
      - Settled in Task 9.
    - Chosen Approach:
      - Task 9's approved design.
    - API Notes and Examples:
      - From Task 9.
    - Files to Create/Edit (tentative until Task 9):
      - `src/schema.ts`; `src/validate/tree.ts`; `src/sdk/render.ts`; `src/sdk/elements.ts`; `src/sdk/gen.ts`; `src/react/renderer.tsx`; `src/react/implement.ts`; `src/index.ts`
      - `conformance/corpus/` (new cases); `schemas/`; `src/__tests__/fixtures/widgets/*.gen.ts` (regenerated)
      - `docs/spec.md` §5, §10, §11; `docs/sdk.md`; `docs/renderer.md`; `docs/formats.md`
      - `scripts/release/api/register-0.2.2.json`
  - Test Cases to Write:
    - `dangling_reference_is_invalid_prop_in_render_elements_and_tree`.
    - `reference_survives_patch_and_whole_tree_revalidation`.
    - `dom_ids_are_unique_across_sibling_surfaces`.
    - `field_error_described_by_is_announced`: a browser test, read from the ARIA snapshot.
    - `catalog_without_noderef_unchanged`.
  - Notes (executed <date>):

- [ ] Task 11: Add accessibility capture axes
  - Acceptance Criteria:
    - Functional:
      - `capture()` takes optional `media?: { textScale?: readonly number[]; forcedColors?: readonly ("none" | "active")[]; reducedMotion?: readonly ("no-preference" | "reduce")[] }`. Each requested value multiplies the cells. `maxCells` counts the product and refuses an over-large call before any cell is captured, as today.
      - `CaptureSession` gains an optional `emulate?(media)`. `playwrightBackend` implements it:
        - `forcedColors` and `reducedMotion` through `page.emulateMedia`;
        - `textScale` by setting the root `font-size` percentage before readiness.
      - A backend without `emulate` refuses a call that requests media, with a typed `CaptureError` naming the axis. A call without media never calls `emulate`.
      - Captured cells and the index record their media coordinates. They gain the `media` field only when media was requested.
      - The CLI (`liveframe preview capture --text-scale 1,2 --forced-colors active --reduced-motion reduce`), `/authoring` and the MCP `capture_preview` tool gain matching optional arguments, `outputSchema` fields and descriptions.
    - Performance: captures without media options are unchanged in count and time.
    - Code Quality: follow the optional `layout?` pattern (`src/preview/capture/index.ts:35-44`). No new dependency. The `contrast` media option is excluded because it needs Playwright 1.51 and the peer floor is `^1.49.0`.
    - Security: n/a for the laws. Capture remains authoring-only, with no action dispatch.
    - Compatibility:
      - All additions are optional. Custom `CaptureBackend` implementations still compile.
      - 0.2.1 MCP text results and CLI output for calls without the new arguments are byte-identical. A test proves it.
      - Register entries are `widened`, for `CaptureOptions`, `CaptureSession`, `CapturedCell` and the authoring options and result types, all with `hostAction: none`.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (preview reference); `find-docs` (Playwright `emulateMedia`; already fetched for the decision log: `forcedColors` since 1.15, `reducedMotion` since 1.12, `contrast` since 1.51).
    - Library Documentation to Check Before Implementation:
      - Playwright ≥ 1.49 (peer floor) and 1.64.1 (dev): `page.emulateMedia`. Chromium forced-colours emulation support.
    - Documentation Reviewed:
      - Spec §7.5 (capture), §6.4 (preferences, forced colours); `src/preview/capture/index.ts`; `src/preview/capture/playwright.ts`; `src/cli/capture.ts`; `src/cli/mcp.ts:255,401-415`; `src/authoring/index.ts:51-63,168-181`.
    - Options Considered:
      - Bundle axe-core. Rejected for 0.2.2: a new optional peer outside the approved scope; listed in Further Actions.
      - Browser zoom for text scale. Rejected: Playwright has no zoom emulation, and root `font-size` is what WCAG 1.4.4 text resizing exercises.
    - Chosen Approach:
      - Optional media axes, through an optional backend method.
    - API Notes and Examples:
      ```ts
      await capture({ backend, url, out, media: { textScale: [1, 2], forcedColors: ["active"] } });
      ```
    - Files to Create/Edit:
      - `src/preview/capture/index.ts`; `src/preview/capture/playwright.ts`; `src/cli/capture.ts`; `src/cli/liveframe.ts`; `src/cli/mcp.ts`; `src/authoring/index.ts`
      - `src/__tests__/preview-capture.test.ts`; `src/__tests__/cli-mcp.test.ts`; `src/__tests__/authoring.test.ts`
      - `docs/spec.md` §7.5; `docs/preview.md`; `docs/mcp.md`
      - `scripts/release/api/register-0.2.2.json`
  - Test Cases to Write:
    - `media_axes_multiply_cells_and_respect_max_cells`.
    - `forced_colors_cell_differs_and_reports_media`: a browser test.
    - `text_scale_two_doubles_root_font`.
    - `backend_without_emulate_refuses_media_with_typed_error`.
    - `calls_without_media_are_byte_identical_to_0_2_1`: compares the MCP text result and the CLI index.
  - Notes (executed <date>):

- [ ] Task 12: Design extension recipe properties and multiple variant axes for 0.3.0 (decision logs only)
  - Acceptance Criteria:
    - Functional:
      - Two proposals, `plans/evidence/022-extension-properties-design.md` and `plans/evidence/022-variant-axes-design.md`. Each states:
        - **Format change:** the document change, and whether a format version bump is needed (for example `liveframe-catalog/2`) or optional fields suffice;
        - **Law 3:** how law 3 holds. Extension values are typed tokens (roles, design values, bounded enums), never raw CSS;
        - **Projection:** the projection, for example `--lf-p-<name>` per slot and state, read by the host's trusted primitive CSS;
        - **Cascade and completeness:** cascade and completeness rules, including how variant axes combine in the cascade;
        - **Compatibility:** the effect on `classifyCatalogChange`, the corpus, ports and the CSS byte-identity of existing systems;
        - **Migration:** a full migration entry for any break, with before/after, a code sample and an adopter checklist.
      - Each is recorded with `create-decision-log` after explicit owner approval, or declined, with the reason recorded in the backlog.
      - Approved designs are added to the roadmap as 0.3.0 scope. No code ships in 0.2.2.
    - Performance: each proposal states its expected projection-size and validation cost, and the benchmark 0.3.0 must meet.
    - Code Quality: design only.
    - Security: law 3 analysis is mandatory in each proposal.
    - Compatibility: nothing ships. The register gains no entry. The api-stability test proves there is no declaration change.
  - Approach:
    - Skills to Use:
      - `create-decision-log`; `liveframe-execution` (styling and formats references).
    - Library Documentation to Check Before Implementation:
      - CSS Custom Properties Level 1 and `@property` (Baseline status, recorded with its date); CSS Cascade 5.
    - Documentation Reviewed:
      - Spec §6.2–§6.4; `decision-logs/2026-10-22-0850-recipes-own-look-style-props-own-structure.md`; `src/formats/fixed.ts` (`recipeProperties`); `src/formats/catalog.ts` (`classifyCatalogChange`).
    - Options Considered:
      - Recorded in each proposal.
    - Chosen Approach:
      - Decided by the owner.
    - API Notes and Examples:
      - In the proposals.
    - Files to Create/Edit:
      - the two evidence proposals; decision logs (on approval); `roadmap.md` (0.3.0 scope line, on approval); `plans/backlog.md` (if declined)
  - Test Cases to Write:
    - n/a. Design task.
  - Notes (executed <date>):

- [ ] Task 13: Write the 0.2.2 documentation and compatibility notes
  - Acceptance Criteria:
    - Functional:
      - `CHANGELOG.md` has a 0.2.2 entry listing every register entry, grouped as Added, Widened and Deferred.
      - `docs/compatibility.md` gains:
        - a `## 0.2.2` section linking the decision log;
        - Growth lines for `states` and the other widened unions;
        - a `## Deferred to 0.3.0` section, with a full migration entry for each `deferred` register entry, or "None" if there are none.
      - `docs/adopters-0.2.md` gains a 0.2.2 section mapping each capability to its API, with one copy-paste example each and a "nothing to do" line for hosts that upgrade without opting in.
      - The outsider guides touched by Tasks 3–11 are current, and the docs-links and docs-wording tests pass.
    - Performance: n/a. Documentation only.
    - Code Quality: the docs read for outsiders. No internal plan references in published docs, except decision-log links.
    - Security: `docs/security.md` is checked for anything 0.2.2 changes. The expected answer is nothing, and that is recorded.
    - Compatibility: every register entry's `hostAction` appears verbatim in the adopter notes.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`; `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - none. Local: the docs listed.
    - Documentation Reviewed:
      - `docs/compatibility.md` 0.2.1 section (model); `docs/adopters-0.2.md` 0.2.1 section.
    - Options Considered:
      - A separate migration guide. Rejected unless an item is deferred; 0.2.2 needs no migration.
    - Chosen Approach:
      - Extend the existing pages.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `CHANGELOG.md`; `docs/compatibility.md`; `docs/adopters-0.2.md`; the guides named by Tasks 3–11
  - Test Cases to Write:
    - `src/__tests__/docs-links.test.ts` and `src/__tests__/docs-wording.test.ts` cover the new sections.
    - `register_host_actions_appear_in_adopter_notes`: a small assertion added to `api-stability.test.ts`.
  - Notes (executed <date>):

- [ ] Task 14: Prove every acceptance bullet against the checkout
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/022-acceptance.md` names a passing test or evidence record for every Expected Outcome bullet and every task criterion.
      - `git diff v0.2.1 -- src/__tests__ proof/tests conformance` shows only additions, or edits that the register names.
      - `bun run check`, `bun run bench`, `bun run release:gate`, `bun scripts/release/peer-floors.ts` and `bun run demo:test` pass.
    - Performance: every bench gate passes, and the Task 3 and Task 4 targets are re-measured and recorded.
    - Code Quality: n/a. This is verification.
    - Security: the host-API-free scan and the law tests pass unchanged.
    - Compatibility: `api-stability.test.ts` passes. A scratch host built against the 0.2.1 demo host code, upgraded to the checkout's package with no code change, passes `demo:test`.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - this plan; `plans/evidence/021-request-acceptance.md` (model).
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - One acceptance table.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/022-acceptance.md`
  - Test Cases to Write:
    - n/a. Runs the existing and new tests.
  - Notes (executed <date>):

- [ ] Task 15: Publish 0.2.2-rc.1 under `next` and verify it from the registry
  - Acceptance Criteria:
    - Functional:
      - `package.json` is `0.2.2-rc.1` and `CHANGELOG.md` has a dated rc entry.
      - The owner's go is recorded before the tag is pushed.
      - After the workflow publishes, the following run from the registry and their results are recorded in `plans/evidence/022-release-candidate.md`:
        - `npm view @arnilo/liveframe dist-tags`;
        - `npm audit signatures --include-attestations`;
        - `bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.2-rc.1`;
        - the api-stability comparison run against the installed archive.
    - Performance: n/a. Release task.
    - Code Quality: follows `docs/compatibility.md` § "Release process".
    - Security: provenance verified.
    - Compatibility: the installed rc passes the api-stability comparison against the 0.2.1 baseline.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - plan 021 Task 17 (model).
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - The documented release process.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `package.json`; `CHANGELOG.md`; `plans/evidence/022-release-candidate.md`
  - Test Cases to Write:
    - n/a.
  - Notes (executed <date>):

- [ ] Task 16: Review readiness with the owner, then publish 0.2.2 and verify it
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/022-release-readiness-review.md` lists every register entry, every deferred item and every open finding as `fixed` with evidence or `deferred` with the owner's approval.
      - The owner answers go, in words.
      - `0.2.2` is published under `latest`, with `next` at or above it, and the registry verification is recorded in `plans/evidence/022-release.md`.
    - Performance: n/a.
    - Code Quality: as Task 15.
    - Security: provenance verified.
    - Compatibility: as Task 15, against the final archive.
  - Approach:
    - Skills to Use:
      - `verify-and-stop`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - plan 021 Task 18 (model).
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - The documented release process.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `package.json`; `CHANGELOG.md`; `plans/evidence/022-release-readiness-review.md`; `plans/evidence/022-release.md`; `roadmap.md` §3
  - Test Cases to Write:
    - n/a.
  - Notes (executed <date>):

- [ ] Task 17: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - Sweep all twelve impact areas (`.claude/skills/create-plan/references/liveframe.md` §5) against the delivered work. Record each, or `None — <reason>`, in `plans/evidence/022-impact-analysis.md`.
      - Present every finding to the owner in one table, with a recommended disposition (`execute` or `backlog`), and record the answer.
      - `execute` findings become new tasks above this one and are executed. `backlog` findings go to `plans/backlog.md` and Further Actions.
    - Performance: area 7 records the final bench figures against the 0.2.1 baseline.
    - Code Quality: n/a.
    - Security: area 3 confirms no new path for widget code, colour, raw CSS or authority.
    - Compatibility: area 2 confirms that the register is complete and that every `deferred` item has its migration entry.
  - Approach:
    - Skills to Use:
      - `create-plan` (final task, execution updates).
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/evidence/021-impact-analysis.md` (model).
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - The standard sweep.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/022-impact-analysis.md`; `plans/backlog.md`; this plan (Compromises, Further Actions)
  - Test Cases to Write:
    - n/a.
  - Notes (executed <date>):

## Verification (whole plan)

- `timeout 1200 bun run check`
- `timeout 600 bun run bench`
- `timeout 600 bun --conditions liveframe:source bench/streaming.bench.ts --production`
- `timeout 600 bun --conditions liveframe:source bench/streaming.bench.ts --production --patches`
- `timeout 300 bun test --conditions liveframe:source src/__tests__/api-stability.test.ts`
- `timeout 600 bun run release:gate`
- `timeout 300 bun scripts/release/peer-floors.ts`
- `timeout 600 bun run demo:test`
- `git diff --stat v0.2.1 -- src/__tests__ proof/tests conformance` (additions only, or register-named edits)

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- Known at drafting, for 0.3.0 consideration:
  - focus continuity on by default;
  - a public `shareTree()` and `compileCatalog()` if a non-React renderer or a port asks for them;
  - axe-core as an optional capture peer;
  - the `contrast` capture axis once the Playwright peer floor reaches 1.51.
- To be completed after task completion with improvements, rationale and priority.
