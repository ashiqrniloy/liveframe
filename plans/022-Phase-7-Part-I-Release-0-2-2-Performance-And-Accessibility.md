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

- [x] Task 2: Profile browser costs on a production React build
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
  - Notes (executed 2026-11-01):
    - `bench/streaming.bench.ts` takes `--production` (bundle with `process.env.NODE_ENV=production`, no Profiler element in the client) and `--out <file>`; without them it keeps writing the 019/021 evidence files, so `bun run bench` is unchanged. `bench/streaming-client.tsx` exposes `mount`/`step`/`tree` instead of one paced `run`, because a single long `Runtime.evaluate` produced no Layout/Paint trace events. The bench drives one CDP call per revision, warms with 20 untimed revisions, then marks `lf-recorded-start`/`lf-recorded-end` around the 100 recorded revisions. `bench/trace.ts` (new) starts a Chromium `devtools.timeline,blink.user_timing` trace and sums `Layout` and `Paint` durations inside those marks; the trailing frame is awaited before the end mark.
    - The streaming page now receives the proof stylesheets. Without CSS a status change never changes pixels and Chromium emits no layout or paint at all.
    - `proof/tests/renderer-browser.test.tsx`: `selection_rerender_cost_is_recorded` keeps its assertions and now also records the trace split; the new `selection_rerender_cost_is_recorded_in_production` hydrates the same SSR page from a production bundle (`?prod`) and calls `window.measureSelectionWall`, which has no Profiler, times `flushSync` with `performance.now()` and repeats 10 fresh-tree arrivals.
    - Result (`plans/evidence/022-browser-profile.md`; per-revision tables in `022-streaming{,-patches}-{development,production}.md`): whole-tree arrival 9.8 ms development, 5.8 ms production; patches 2.3 ms development, 1.6 ms production; per-update layout plus paint 0.06 ms (only the ~7 visible rows of 50 are laid out, `deferOffscreen` skips the rest). 679-node selection: development validation 2.5 ms, Profiler render 55.9/52.7 ms, layout plus paint 4.73/3.71 ms, synchronous update 94.0/86.8 ms; production validation 1.9 ms, React 12.5/12.1 ms, layout plus paint 0.29/0.28 ms, update 14.5/14.0 ms (certified/rack). Machine, browser, builds, commands and load averages (4.8–9.3 from an unrelated cluster on the same host) are in the record.
    - Finding: React work is the dominant cost for whole-tree arrival (87% development, 76% production) and for the selection update (86% production), so Tasks 3 and 4 keep their order and targets. Patch mode is validation-bound in production (validation 1.2 ms of a 1.6 ms update) and stays a no-regression check. No later task is amended.
    - Backlog P2 "Profile production browser selection costs before optimizing the renderer" is closed with a link to the record; its preview-matrix follow-up is explicitly left open because this profile does not cover it. No spec change.

- [x] Task 3: Reuse unchanged nodes when a whole tree arrives
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
  - Notes (executed 2026-11-01):
    - `src/react/share.ts` (new, internal): `shareNodes(previous, next, failed)` substitutes the accepted tree's node objects for every subtree that is deep-equal (object key order ignored, array order kept), requires the same `surfaceId`, and returns the arrival's envelope with the shared root so origins still name the accepted revision. It walks bottom-up, so each subtree is compared and substituted once, and it reuses `sameDefinition`, moved here from `renderer.tsx` so there is one JSON comparator. Nothing in this file reaches `/react`.
    - `src/react/renderer.tsx`: `<Surface>` calls `shareNodes` only after `validateTree` accepted the arrival and only when the validator is unchanged; a `WeakSet` per surface is passed to every `Boundary`, which adds its node from `componentDidCatch`. A node in that set is never reused, and neither is any ancestor, because their cached element still holds the failed boundary; the next arrival hands the failed node a new object, so it retries exactly as in 0.2.1. `docs/spec.md` §11 and `docs/renderer.md` say so.
    - Tests: `whole_tree_arrival_reuses_unchanged_nodes` (render counters: one changed leaf and its ancestor render, the untouched sibling renders zero times; an identical arrival renders nothing, keeps focus and the button's local state, and its click names revision 2), `reused_tree_deep_equals_the_arrival` (unit over the corpus `ui-tree` document, agent-home-shaped fixture pairs — identical, changed leaf, envelope-only, reordered, dropped and added children, changed variant — plus the failed-node block; substitution is checked by identity and the result by deep equality), `failed_node_retries_on_next_arrival` (a text primitive that throws shows the fallback, then a deep-equal arrival with the implementation healed renders it again instead of keeping the fallback), `different_surface_or_validator_reuses_nothing`. The fixture gained `surfaceTest.arrive()` and `surfaceTest.failText()`; `reused_nodes_follow_confirmation_fallback_and_diagnostics_changes` and every surface, intent, confirmation and patch test still pass unchanged.
    - Note: React renders the boundary's subtree once more after a throw, so the throwing node's render counter asserts `> 0` rather than an exact count; the untouched sibling is still asserted at exactly zero.
    - Results (`plans/evidence/022-browser-profile.md`, "After: node reuse"; per-revision tables in `022-streaming-*`): whole-tree arrival validation plus React work 3.4 ms development (from 9.8 ms; the plan's baseline was 10.7 ms) and 2.1 ms production (from 5.8 ms). The reuse pass alone is 0.3 ms median development and 0.2 ms production at 679 nodes, inside the 1.0 ms budget. Patch mode is 2.8 ms development (from 2.3 ms) and 1.9 ms production (from 1.6 ms): the compare also runs on patched arrivals, which already shared nodes, and it stays inside the plan's 2.7 ms + 10% gate while validation remains its largest term. Layout plus paint is unchanged (0.06 ms per streaming update).
    - Selection, 679 nodes: profile render 10.3/13.6 ms and synchronous update 14.8/16.1 ms in development (from 55.9/52.7 and 94.0/86.8), production update 2.9/3.0 ms (from 14.5/14.0) with 0.9 ms of React work. Validation and layout plus paint are now the larger terms there, which is what Task 4 targets.
    - No API change and no register entry; the tree renderer cache dependencies gained the new stable set, and no `React.memo` or component layer was added. No spec behaviour outside §11 changed.

- [x] Task 4: Reuse compiled catalogs across validators
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
  - Notes (executed 2026-11-01):
    - `src/validate/compile.ts`: `compileValidator` splits into `catalogWork` (install validation, styles, structure, per-kind props/style checks, per-kind facts, offered-event schemas) and `compile` (manifest validation, intents, per-kind event checks, the dispatcher, the tree validator, the input schemas, actions). The catalog half is kept in a least-recently-used list keyed by the text of the catalog and capabilities documents; every call still returns a new `CompiledValidator`, and invalid documents still throw the same `LiveframeFailure`.
    - The key is the two documents' `JSON.stringify` text, not `canonicalJson`. Two reasons, both measured: `canonicalJson` costs 0.42 ms on the 20 KB proof catalog, which alone exceeds the 0.25 ms reuse target, and its text has to be recomputed on every call. Text is injective on JSON content, and parsing it back (once per entry, kept afterwards) and comparing with `sameJson` is the guard that keeps a document whose `undefined`- or `NaN`-valued keys stringify away from hitting a validator compiled for different content — `invalid_catalog_never_hits_cache` covers exactly that. The cost is that equal documents written in a different key order miss the cache and compile again. `sameJson` moved to `src/formats/json.ts` and `src/react/share.ts` now imports it, so the repository has one JSON comparator.
    - Cost of the key on a first compile: two `JSON.stringify` calls, about 0.04 ms. `catalogs` is bounded at 8, not the plan's 64: the plan borrowed that bound from `src/runner-kit/cache.ts`, which looks up by object identity in a `Map`, while this one compares content on every lookup, so the bound is also the miss cost. With 64 distinct catalogs cached, a miss measured 0.99–1.01 ms against 0.81–0.82 ms with 8 (`plans/evidence/022-validator-reuse.md`). The substance of the security criterion holds: bounded, content-keyed, and unreachable with an invalid document.
    - Tests: `second_compile_reuses_catalog_work_and_returns_a_new_validator` (the compile counter does not move, and the two validators share no object identity while sharing the compiled structure), `mutated_catalog_compiles_fresh` (mutating the same object between calls compiles again and the new catalog id reaches the validator), `invalid_catalog_never_hits_cache` (returns `LiveframeFailure`, leaves the counter alone, and the valid document still hits), `worker_runner_reuses_validator_per_package_hash`. The internal counter `catalogCompileCount()` is exported from the module for tests only, not from the package root.
    - `examples/demo-host/server.ts` keeps one validator per package hash (`validatorFor`) instead of compiling per render. The demo host typechecks independent of the root project.
    - `bench/validator.bench.ts` gained both cases: reuse (0.118 ms median against the 0.25 ms target, down from the 0.73 ms per-call figure) and first compile (0.87–1.03 ms). The cold figure is the one criterion this task does not meet: the plan asked for no more than 5% above 0.2.1, and paired runs against the stashed 0.2.1 code gave 0.980 vs 0.755 and 1.025 vs 0.951, i.e. about +8–30% across runs of a shared machine whose load averaged 5–20. The 0.2.1 baseline alone spread 0.67–0.95 ms between runs, so a 5% gate on a 0.75 ms measurement is below that noise floor; the added work that is measurable is the 0.04 ms key. Recorded rather than smoothed in `plans/evidence/022-validator-reuse.md`.
    - Worker budget (closes backlog P4): host re-validation is 0.907 ms median and 2.256 ms p95 per render of the 679-node agent-home tree, about 15% of a 5.9 ms worker round trip, and `docs/packages.md` states it. `docs/formats.md` and `docs/packages.md` document the reuse; spec §10's "compiled per catalog" describes behaviour that is unchanged.
    - No API change, no register entry: `compileValidator`, its thrown errors and per-call identity are unchanged, `/pack`'s `canonicalJson` export is untouched, and the only additions are internal module exports.

- [x] Task 5: Add `bindSources()` and `renderKey()`
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
  - Notes (executed 2026-11-01):
    - `bindSources` is in `src/formats/manifest.ts` beside the binding grammar, `renderKey` in `src/pack/hash.ts` over `canonicalJson` + `utf8` + `sha256`. Both are pure and host-API-free; the portability scan covers `.` and `pack` unchanged.
    - Public signatures carry their types inline. The plan's compatibility line promises exactly two `added` register entries, and exporting `BoundSource`, `SourceInputs` or `RenderKeyInputs` would have been three more `added` entries for names a host never has to say: `bindSources(manifest, capabilities, { params, state, context })` and `renderKey({ … })` are called with object literals, and `ReturnType`/`Parameters` reach the types when a host wants them. The api-surface check failed on those three types before they were inlined, which is how the rule surfaced.
    - Validation without a catalog: `bindSources` runs `validateCapabilities` and `validateManifestShape`, and throws `LiveframeFailure` from either, as `compileValidator` does. It cannot check the manifest's `catalogId`, because no catalog is passed; installing the manifest already did. It does check which capability each source names (`unknown-name` at `/sources/<key>/source`) and the resolved parameters against the source's schema, both of which `validateManifestShape` cannot know.
    - Order of checks: the inputs are validated with `validateJson` first (cycles, accessors, functions, `NaN`, foreign realms, all at the offending member), so every later read only sees JSON and no read can throw. A required binding that is absent gets one `invalid-prop` at `/sources/<key>/params/<name>` and its source's schema check is skipped, so the host does not also see the schema's "required" complaint for the same parameter. Resolved-parameter schema failures keep `checkValue`'s `invalid-document` kind, the kind `validateManifest` already uses for source parameters.
    - The result is one entry per `manifest.sources` data key, `{ source, params }`, with literals copied and `{ from, path }` walked through the frozen input; an absent optional parameter is omitted from `params`.
    - `renderKey` picks the six fields explicitly rather than hashing its argument, so a caller's extra key cannot change the key. It throws `TypeError` on a non-JSON input, like `canonicalJson`.
    - `bench/render.bench.ts` records the informational cost on the agent-home scenario's real inputs: 33,899 canonical bytes, 0.84–2.22 ms per key across runs (canonicalJson 0.48–1.18 ms of it) on a machine whose load average ranged 5–16 during the measurements. No gate, as the plan says.
    - Tests: `binds_literals_params_state_and_context_paths`, `missing_optional_binding_is_omitted_and_missing_required_is_invalid_prop`, `bound_params_are_checked_against_the_source_schema`, `non_json_input_fails_closed`, `render_key_ignores_key_order_and_changes_with_any_input`. The export lists in `exports.test.ts` gained `bindSources` (root) and `renderKey` (`/pack`), and `scripts/release/api/register-0.2.2.json` carries the two `added` entries.
    - Docs: spec §7.1 names `bindSources` in the sources bullet and §8 names `renderKey` in the re-run bullet; `docs/formats.md` (Manifest) documents the rules with a resolver example; `docs/packages.md` (Loading) shows both helpers in the host's per-render glue.

- [x] Task 6: Add an opt-in, recipe-derived contrast audit
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
  - Notes (executed 2026-11-01):
    - `src/formats/audit.ts` holds `auditContrast` and the exported `ContrastFinding` type. It reuses `validateCatalog`, `validateTheme`, `prepareDesignSystem`, `cascadeRecipes` (with no second cascade implementation), `toSrgb`, `contrastRatio` and — newly exported — `over`, so compositing has one implementation. `fontWeights` moved from `src/css/theme.ts` to `src/formats/dtcg.ts` so the audit can read a weight from a typography role without the root package reaching the CSS projection module.
    - Validation order is catalog, then theme, then design system, and each stage's own errors come back in the `Result` rather than throwing, which is what the plan asked for and what lets `designSystemSuite` report them. `prepareDesignSystem` is what proves the design system complete, so an incomplete one is rejected before any pair is measured.
    - Background chain: the slot's own `backgroundColor` with that recipe's `backgroundOpacity`; else the kind's `root` slot for the same state with the root's `backgroundOpacity` (the property belongs to the element that declares the paint); else `vocabulary.contrastBase`, opaque by validation; else `unresolved-background`. `"none"` is treated as no paint and falls to the next link, which is what a solid button with no border means. A translucent paint composites over the base and is `unresolved-background` when no opaque base exists — never guessed as a surface role.
    - A recipe that declares no typography role is held to the normal threshold, i.e. the conservative direction. The numbers are WCAG 2.2's: 18 pt (24 px) or 14 pt (18.66 px) at weight 700 or more for large-scale text (§1.4.3) and 3:1 for non-text (§1.4.11), from the W3C Recommendation of 2023-10-05 as republished with errata on 2024-12-12; `rem` converts at 16 px, the CSS default root size, not the theme's root size, which the library does not set.
    - Non-text pairs are the `borderColor` of each slot's `rest` recipe and the `outlineColor` of each slot's `focus` recipe, for kinds that declare events, measured against that state's effective background. A border whose colour equals its background therefore reports at 1:1: it names both roles, so the finding is readable, and narrowing it to "only boundaries that identify something" would be a rule the audit cannot verify.
    - Every state inherits a `rest` declaration through the cascade, so one unreadable rest pair reports eight times, once per state, and that is the honest count: each is a rendered style. Findings are ordered by catalog definition, variant, slot and `states` order, so output is stable.
    - Measured on the proof catalog with each proof design system: certified 6.4 ms and rack 9.0 ms per audit (median of 10, load average ~10). Nearly all of that is the install validation the host already runs — rack's `prepareDesignSystem` alone is 8.95 ms — so the pair measurements and the extra cascade add about 1 ms. Install-time only, as required.
    - The audit reports 3 findings for certified and 6 for rack, all non-text boundaries (1:1 for a border matching its fill, 1.35–1.65:1 for hairlines). Recorded as `plans/backlog.md` "Proof styles fail the opt-in contrast audit" rather than fixed here: raising those roles is a styling change with its own parity and evidence work.
    - `designSystemSuite` gains `contrast?: true | { minimums }` and, when set, a fourth or fifth case `every_recipe_pair_meets_contrast` that fails with one line per finding (`recipe: foreground on background is ratio, expected minimum`). Without the option the returned cases, their order and their defaults are unchanged, which `suite_without_contrast_option_is_unchanged` asserts.
    - Tests: `audit_reports_text_pair_from_recipe_not_declared_in_vocabulary`, `large_text_uses_three_to_one`, `alpha_and_background_opacity_composite_once`, `focus_outline_non_text_contrast`, `unresolved_background_is_reported`, `invalid_inputs_return_validator_errors`, `suite_without_contrast_option_is_unchanged`, `suite_with_contrast_option_fails_on_finding`. The alpha test states its expectation as arithmetic on the composited #bfbfbf, so applying the alpha twice or against the wrong base changes the number.
    - Register: `added` for `auditContrast` and `ContrastFinding`, `widened` for `designSystemSuite` on `/conformance`. The audit's `minimums` type is inline for that reason — exporting it would have been a third `added` entry for a type hosts do not have to name.
    - The `auditContrast` export line sits between the `formats` and `schema` blocks of `src/index.ts`; adding it at the top made the api-surface checker report the unrelated `Vocabulary` declaration as changed (property-order churn in the printed type). Placing it there keeps the printed surface identical.
    - The full check was green at 974 pass / 4 skip / 0 fail. Two earlier runs failed only the Playwright switch cases in `proof/tests/switch.test.ts` at load average 12–15, one in each run; both passed standalone and in the green run, the load-sensitive pattern already recorded in `plans/backlog.md`.
    - Docs: spec §6.5 gained a "Recipe-derived audit" paragraph, `docs/styling.md` documents the rules and thresholds with an example, and `docs/conformance.md` names the opt-in option.

- [x] Task 7: Add opt-in focus continuity to `<Surface>`
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
  - Notes (executed 2026-11-01):
    - `src/react/renderer.tsx` now holds a `FocusContinuity` class component with `getSnapshotBeforeUpdate` (the last moment the pre-update DOM is readable, per React's `Component` reference) and `componentDidUpdate`. It is rendered only under the prop, so a surface without it does no snapshot, adds no attribute and installs no listener — the existing suite renders with `focusContinuity={false}` and the default test asserts no `tabindex` on the wrapper and focus dropped to `<body>`, as in 0.2.1.
    - Tabbables are `a[href], area[href], button, input, select, textarea, iframe, object, embed, summary, [tabindex]`, filtered by `tabIndex < 0` (which already excludes a div or an anchor without `href`), `disabled`, `type=hidden`, an `[inert]` ancestor, computed `visibility: hidden`/`display: none`, and a zero-length client rect list. The rect read costs no flush because layout is clean at the snapshot. Candidate order is the whole document, as the acceptance criteria word it, so a successor outside the surface wins over the wrapper; the predecessor list is reversed so "previous" means nearest.
    - A candidate is only trusted once `document.activeElement` reports it, so an element that cannot take focus (closed `<details>`, zero-size box) falls through to the wrapper instead of swallowing the move. Restoration is skipped when the snapshot's element is still connected and when anything other than `<body>` holds focus at the end of the commit: focus the host or a primitive has placed elsewhere is never taken back.
    - `Node.compareDocumentPosition`'s bitmasks are named `FOLLOWING`/`PRECEDING` at module scope. `globalThis.Node` would have been the obvious spelling, but `src_is_host_api_free`/`compiled_output_is_host_api_free` forbid `globalThis` in shipped modules, and the local `Node` primitive wrapper shadows the DOM interface name.
    - Cost, 679-node agent-home selection update with 52 tabbables in the document, median of 50 updates over three runs at load ~15: 2.5–2.7 ms with the prop off, 2.6–3.1 ms with it on and a button focused, i.e. the snapshot costs about 0.1–0.4 ms, which is inside the run-to-run spread. Once-only cost: the wrapper gets `tabIndex={-1}`, which keeps it out of the tab order.
    - Tests: `removed_focused_row_moves_focus_to_next_row`, `last_row_removed_moves_focus_to_previous` (this one caught the reversed-predecessor bug: neighbours must be taken nearest-first), `empty_surface_focuses_wrapper`, `focus_outside_surface_is_left_alone`, `portal_focus_is_continued` (the portal button is the last tabbable in document order, so it continues to the wrapper's last row), `default_surface_drops_focus_as_in_0_2_1`. The fixture gained `surfaceTest.setFocusContinuity`.
    - Register: `widened` for `./react createRenderer`, because `SurfaceProps` is printed as a helper declaration of that export, not as an export of its own; naming `SurfaceProps` failed the register check as a stale entry. `hostAction: none`.
    - Docs: spec §11 gained a bullet after the reuse rule, and `docs/renderer.md` a "Keep focus in the surface when a row disappears" section with the prop's rules, the off-by-default note and the `preventScroll` behaviour.
    - The full check was green at 980 pass / 4 skip / 0 fail. `proof/tests/mcp-capture.test.ts` (`concurrent_captures_bind_the_page_once`) failed once in an earlier run at 63 s, within its own timeout under parallel load, and passes standalone; `src/__tests__/portability.test.ts::compiled_output_is_host_api_free` reads the built output, so `bun run build` must run after a renderer edit.

- [x] Task 8: Add the `pending`, `mixed`, `current` and `readonly` recipe states
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
  - Notes (executed 2026-11-01):
    - `src/formats/fixed.ts` gained the four names in `states`, placed after `selected` and before `invalid`. That array is the vocabulary and schema order; the CSS source order is the key order of `stateSelectors` in `src/css/design-system.ts`, which now reads `rest`, `hover`, `focus`, `active`, `open`, `selected`, `current`, `mixed`, `pending`, `readonly`, `invalid`, `disabled` — exactly the 0.2.1 relative order with the new states inserted. `RecipeKey`, the key pattern and the published JSON Schema all derive from `states`, so they widened with no second list to keep in step; `scripts/schemas.ts` changed only the two pattern strings in `schemas/design-system.json`.
    - Selectors are the table's: `current` `[aria-current]:not([aria-current=false]),[data-current]`; `mixed` `[aria-checked=mixed],[aria-pressed=mixed],:indeterminate,[data-mixed]`; `pending` `[aria-busy=true],[data-pending]`; `readonly` `[aria-readonly=true],[readonly],[data-readonly]`. `:read-only` was rejected as planned, because it matches every non-editable element; `[readonly]` matches exactly the attributes a control can carry.
    - Pending suppression keeps the byte-identical requirement honest. `selector()` now takes the list of states that cancel hover and press instead of a boolean, and `suppressed()` returns `[disabled]`, or `[disabled, pending]` when the design system's own recipes declare any `pending` key. The decision reads `prepared.value.recipes`, not the resolved table: `cascadeRecipes` writes an entry for every slot × state, so a resolved key cannot tell a declared recipe from an inherited one. Both proof systems declare no `pending`, so the projected CSS is unchanged — proved by hash below, not by inspection.
    - Forced colours gained four rows in `forcedStateDeclarations`: `current` 2px solid `Highlight` outline, `mixed` `Highlight` background with `HighlightText` text, `pending` 1px dashed `CanvasText` outline, `readonly` `GrayText` border. They are emitted by the same non-rest branch that already returns early when the state's declarations equal rest, so "only when the state's recipe differs" needed no new code.
    - `emit` returns the host's promise. `Emit`'s return is `Promise<void> | undefined` in both branches. `SurfaceProps.onIntent` is typed `=> unknown` rather than the plan's `void | Promise<unknown>`: a union containing `void` loses TypeScript's "ignore the returned value" assignability, so `onIntent={(intent) => intents.push(intent)}` — which returns a number and is common in 0.2.1 code — stopped compiling. `unknown` accepts `void`, a value and a promise alike, and the renderer decides at runtime whether the result is thenable. The plan's escape hatch (move the `emit` widening to 0.3.0) was therefore not needed.
    - Rejection is contained in `settled()`: a thenable result is adapted with a rejection handler that returns `undefined`, so a failing host never produces an unhandled rejection from a primitive's `emit`. The `confirm` path awaits the host inside a `try`, and a rejection there is a host failure, not the primitive's. `emit_rejection_is_contained` listens for `unhandledRejection` to prove it, rather than asserting on the promise's shape.
    - Validate/project evidence: `new_states_validate_and_project_in_order` declares the four new states plus `selected` and `invalid` on one slot and asserts every rule exists and their source positions ascend; it also asserts the pending guard is present and that all four forced-colour cues reach the forced block. `unused_new_states_leave_css_byte_identical` compares both proof design systems against the 0.2.1 hashes (152,019 bytes `4a512419…db3` and 164,152 bytes `1fc1d0e5…7c2`), measured with `git stash` on the tree before this task; the other 022 tasks touched no CSS projection, and `bench/css.bench.ts` still reports the same byte counts.
    - Fixture consequences, all additive: `resolveRecipes` now returns 936 entries per proof system (624 × 12/8). The committed `certified.resolved-recipes.json` and `rack.resolved-recipes.json` were regenerated by a script that first proved 312 additions per system in the four new states and zero changed or removed entries. Test counts that pinned the state count moved with it: `resolve.test.ts` 32 → 48, `design-system.test.ts` and `proof-formats.test.ts` 624 → 936, and `contrast-audit.test.ts` now derives its per-state finding count from `states.length` instead of a literal 8.
    - Corpus: `design-system/docs/new-states.json` with all four states plus a `new-states.json` case, and `docs/unknown-state.json` with a `busy` state whose case expects both `invalid-document` (the schema pattern) and `unknown-name` (the recipe check) at the same pointer — that pair is the real reference behaviour, and the corpus pins the set.
    - Conformance: `styledStates` enumerates `Object.keys(stateSelectors)`, so a system that styles a new state now requires a fixture for it; `new_states_require_fixtures_when_a_system_styles_them` proves that, and the existing systems gain no required fixtures because they style none of the new states.
    - Register: `widened` for `. states`, `./schemas/* design-system.json` and `./react ImplementationProps` (the printed helper carrying `Emit`). `RecipeKey` never appears in the printed surface, so an entry for it would fail as stale and was not added. The 0.2.2 `createRenderer` entry from task 7 also covers this task's `onIntent` return widening — the checker matches one entry per export — so its `reason` now names both and its `task` is 8.
    - Docs: spec §6.2 (state list), §6.4 (source order, pending suppression, the four selector rows, four forced-colour rows) and §11 (`emit`'s promise); `docs/styling.md` and `docs/renderer.md` selector tables, precedence and `emit` row; `docs/compatibility.md` Growth names `states` as a growing vocabulary; `proof/GAPS.md`'s resolved-recipe sentence now says 936 entries over twelve states.
    - `bun run check` green at 988 pass / 4 skip / 0 fail. Under the heavy load this machine carried while the task ran (1-minute average 7–44), three timing-only tests failed and passed later at load ~8: `rack_validates_and_resolves_under_50ms` (fails without this task's change too, measured with `git stash`), `in_process_warm_overhead_under_point_one_ms` (0.14 ms, then −0.002 and 0.059 ms) and the validator bench gate (`agent-home` 1.641 µs/node, `core-queue.full` 1.562–1.814 against 1.5), the load-sensitive pattern already in `plans/backlog.md`. The CSS bench is record-only and reported unchanged byte counts.

- [x] Task 9: Design node references (decision log; owner approval)
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

  - Notes (executed 2026-11-02):
    - Outcome: **deferred to 0.3.0**. The owner approved deferral on 2026-11-02 ("Approved. Defer to 0.3.0. Document in the @roadmap.md"), recorded in [`decision-logs/2026-11-02-1219-defer-node-references-to-0-3-0.md`](../decision-logs/2026-11-02-1219-defer-node-references-to-0-3-0.md).
    - Proposal: [`plans/evidence/022-node-reference-design.md`](evidence/022-node-reference-design.md) settles all six requested points. Authoring is `ref("hint")` (a frozen marker) on the reference prop plus a tree-unique `$anchor="hint"` on the target; `$anchor` cannot collide with a catalog prop because prop names must match `^[a-z][A-Za-z0-9-]*$` (`src/formats/catalog.ts:11`). The catalog declares references with an optional per-definition `refProps` name list rather than a schema-language keyword, because `src/schema.ts:147-156` validates schemas against a closed keyword set per type, so a keyword would reach `Infer`, every generated type, the elements schema and every port while the JavaScript value stays a `string`. The wire carries the resolved key-path id as an ordinary string prop, so `liveframe/1`, `liveframe/tree-patch/1`, `diffTrees`, `applyPatch`, node reuse and capture records need no change, and a patch that removes a target fails closed at the next whole-tree validation. Resolution is a pending list during the emit pass (a reference may point forward) with the byte count corrected per reference, so the `bytes` budget stays exact. Validation is one `Set.has` per reference after the walk, in `compileTree` and in `render()`, reporting `not-found` at the prop pointer; the same check covers `renderElements` and patched trees. The renderer exposes `item.domId(nodeId)` as `lf-<useId>:<key path>`, prefixing with React's `useId` so sibling surfaces never collide, and adds **no** wrapper element: the `data-lf-node` div is `display: contents` and exists only under `diagnostics`, so making it unconditional would break host CSS and §11's switching proof; the implementation places the id on the element it already renders. Codegen is unchanged (the prop stays `string`, `NodeRef` is a documentation alias) and the elements JSON Schema is unchanged.
    - Why not 0.2.2. The additive design does hold — `refProps` is the same class of change as 0.2.1's `styleProps` widening — so the deferral is a size and evidence call, not the scope decision's "no additive design" branch, and the log says so. Three findings drove it: (1) **no consumer** — the proof catalog's 24 definitions declare no relation prop at all (`id`, `htmlFor`, `describedBy`, `labelledBy`, `controls`, `errormessage`, `target`: zero hits) and `a11y` has only `role`/`name`, so a 0.2.2 corpus would test the feature against itself; (2) the change reaches **six subsystems** (catalog format and schema, build pass, tree validation, codegen, renderer, every port's validator plus the corpus); (3) it **argues with spec §7.2**'s "building and validating are one pass", which is a spec decision that belongs with the implementation. Hosts are not blocked meanwhile: a composed component passes literal DOM ids through string props, which works in 0.2.1.
    - Deferral artefacts: `scripts/release/api/register-0.2.2.json` gained three `deferred` entries — `./sdk ref`, `. NodeRef` and `./schemas/* catalog.json` — which the API test keeps unshipped (a deferred entry that ships fails). `docs/compatibility.md` gained § "Deferred to 0.3.0" with before/after code, the adopter checklist and the design link. `roadmap.md` names the deferral in the Phase 7 0.2.2 bullet and in §3. Task 10 below is marked `n/a`.
    - Performance and compatibility criteria were answered by the proposal rather than by measurement, as a design task requires: validation is one id-set lookup per reference after the walk (zero per-node cost for trees without references), and 0.3.0's Task carries the ≤2% `bun run bench` validator and render gate on the 679-node `agent-home` tree. Every 0.2.1 input keeps its meaning: a catalog without `refProps` declares no references, and a tree with no reference validates exactly as before.
    - Verification: `src/__tests__/api-stability.test.ts` passes 6/6 with the three `deferred` entries present (the checker fails if a deferred change ships), and format and lint are clean. The full suite ran twice while this machine carried an external load average of 9-31 with spikes past 140; both runs reported only timing and worker-timeout failures (`switch_under_budget_with_blur`, `render_smoke_budget`, `verify_agent_home_under_20_ms`, `rack_validates_and_resolves_under_50ms`, `proof_themes_validate_under_2ms`, `in_process_runner_resolves_sdk_from_other_cwd`, `in_process_warm_overhead_under_point_one_ms`, `package_hash_1_mib_under_50_ms`, the capture and runner tests, and the two browser CSS tests), with no content failure. Re-running the affected files alone at load 13.5 passes (`proof.test.ts` and `pack.test.ts` 9/9), and task 8's last quiet run was 988 pass / 4 skip / 0 fail. Task 9 changes no code, only the register, two documents and this plan.

- [x] Task 10: Add `nodeRef()` (only with Task 9's approval) — `n/a`, deferred to 0.3.0
  - Acceptance Criteria:
    - Functional: as amended by Task 9. At minimum:
      - a catalog prop declared with `nodeRef()` accepts only the id of a node in the same tree;
      - a dangling reference is `invalid-prop` at the prop's pointer, in `render()`, `renderElements` and `validateTree`;
      - `<Surface>` gives implementations a surface-unique DOM id for any node id;
      - generated types and the elements schema express the form.
      - **n/a — deferred to 0.3.0 (Task 9).** The design is ratified in
        [`decision-logs/2026-11-02-1219-defer-node-references-to-0-3-0.md`](../decision-logs/2026-11-02-1219-defer-node-references-to-0-3-0.md)
        and [`plans/evidence/022-node-reference-design.md`](evidence/022-node-reference-design.md);
        the work, its test cases and its ≤2% bench obligation move to a 0.3.0 task.
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
  - Notes (executed 2026-11-02):
    - **`n/a — deferred to 0.3.0 (Task 9)`.** Closed without implementation, per this task's own final bullet. Task 9's approval deferred the item instead of shipping it, so the condition in this task's title ("only with Task 9's approval") was not met: the owner approved deferral, and the [decision log](../decision-logs/2026-11-02-1219-defer-node-references-to-0-3-0.md) records that with the verbatim approval.
    - Nothing in this task's scope was built, and nothing in 0.2.2 depends on it. No file named in "Files to Create/Edit" was touched, no corpus case was added, and no schema, codegen or port changed.
    - The gate is now active rather than merely noted: `scripts/release/api/register-0.2.2.json` carries `deferred` entries for `./sdk ref`, `. NodeRef` and `./schemas/* catalog.json`, and `src/__tests__/api-stability.test.ts` fails if any of them appears in the built surface. A deferred entry that ships is a test failure, so the item cannot leak into the release by accident.
    - What 0.3.0 inherits from this task, exactly as written above: the five acceptance bullets, the five test cases, the ≤2% `bun run bench` validator and render gates on the 679-node `agent-home` tree, and the register entries as `added`/`widened` (`./sdk ref`, `. NodeRef`, `./schemas/* catalog.json`, plus `./react ImplementationProps` for `Item.domId`). The design is settled, so a 0.3.0 task can implement without rediscovering the shape; the one caveat it must resolve first is spec §7.2's "building and validating are one pass", which the deferred-reference step bends.
    - Artefacts already in the tree: the ratified design ([evidence](evidence/022-node-reference-design.md)), the decision log, the compatibility section (`docs/compatibility.md` § "Deferred to 0.3.0"), and the roadmap entries (Phase 7 bullet and §3).

- [x] Task 11: Add accessibility capture axes
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
  - Notes (executed 2026-11-02):
    - Shape follows the optional `layout?` pattern exactly. `/preview/capture` gained `CaptureMedia` (one point) and `CaptureMediaOptions` (the values to capture), `CaptureOptions.media`, `CaptureSession.emulate?(media)`, and a `media` field on `CaptureCell` and `CapturedCell`. `media` is written only when media was requested, so a call without it has no new key anywhere, never calls `emulate`, and names its files exactly as in 0.2.1.
    - Enumeration: `mediaCombinations()` validates the options and expands the product (`textScale` × `forcedColors` × `reducedMotion`, an unrequested axis omitted from each point). `maxCells` multiplies by that product and still refuses before the first cell; the guard `requireEmulate(session, media)` throws `not-found` at `/media` naming the axes when the first session has no `emulate`, also before any cell. Invalid values are `unknown-name` at `/media/<axis>` before the page is touched. One session is opened per media point, so the capture loop reuses the existing per-scenario `open()`; `emulate` runs **after** `open` and **before** `waitReady`, which is what the acceptance criteria ask for. A controlled preview keeps its single session only when no media was requested.
    - Filenames and messages: a point becomes `text2`, `forced-active`, `motion-reduce` suffixes (`ready_360_light_plain_text2_forced-active.png`), so `index.json` and the directory say which variant a screenshot shows without cross-referencing coordinates.
    - `playwrightBackend`: `forcedColors` and `reducedMotion` go through one `page.emulateMedia` call; `textScale` sets the root font-size percentage (`Math.round(textScale * 100)`) through `page.locator("html").evaluate((element, percent) => element.style.fontSize = …)`. The `contrast` axis is not offered — it needs Playwright 1.51 against the `^1.49.0` peer floor.
    - Surfaces: CLI flags `--text-scale`, `--forced-colors`, `--reduced-motion` (parsed and validated in `captureFlags`/`captureMedia`, usage exit 2 on a bad value); `/authoring` `CaptureInput.media` and `AuthoringCaptureCell.media`; the `capture_preview` tool takes `media`, advertises it in its description, returns `media` per cell and declares it in `outputSchema`. Two lint errors appeared from the extra branches (cognitive complexity 28 in `previewCapture`, 34 in `capture()`) and were fixed by extracting `captureFlags`/`captureMedia` and `selectedAxes`/`requireEmulate`/`captureCells`, not by suppressing the rule.
    - Engineering notes worth keeping. `src/preview/capture` is a host-API-free subpath and the portability scan bans `document.`/`window.` in it, so the text-scale step had to move from `page.evaluate` to `page.locator("html").evaluate`; the same scan transpiles that subpath as **TSX**, where a generic arrow (`<T>(values: T[])`) parses as JSX and a `...(cond ? a : b)` object spread transpiles to unparseable output. The helpers therefore use a function declaration and `...(cond && value)` spreads.
    - Tests. `src/__tests__/preview-capture.test.ts` gained `media_axes_multiply_cells_and_respect_max_cells` (product, filenames, one `emulate` per point, four sessions plus the discovery one, `maxCells: 3` refused with zero screenshots and zero `emulate` calls), `media_absent_calls_are_unchanged`, `backend_without_emulate_refuses_media_with_typed_error`, `invalid_media_values_are_unknown_name`, and two real-browser tests on a local page: `text_scale_two_doubles_root_font` (16px → 32px) and `forced_colors_cell_differs_and_reports_media` (two cells, two coordinates, two distinct PNGs; the fixture opts out with `forced-color-adjust: none` so the `@media (forced-colors: active)` rule is observable). `src/__tests__/authoring.test.ts` gained `capture_media_is_returned_only_when_requested`; `src/__tests__/cli-mcp.test.ts` gained `calls_without_media_are_byte_identical_and_media_is_reported`, which pins the exact three content blocks and `structuredContent` of a no-media call (0.2.1 bytes), then checks a media call's summary, the description, the input and output schemas and the typed refusal; `proof/tests/preview-capture.test.ts` gained `cli_media_flags_multiply_the_cells` (real host page: cells double, both points present, `_text1|2_forced-active` filenames) and `cli_rejects_an_unknown_media_value`.
    - Compatibility. Register entries: `added` for `./preview/capture CaptureMedia` and `CaptureMediaOptions`; `widened` for `CaptureOptions`, `CaptureSession`, `CaptureCell`, `CapturedCell`, `./authoring CaptureInput` and `AuthoringCaptureCell`, all `hostAction: none`, task 11. A custom `CaptureBackend` still compiles: `emulate` is optional and only a call that requests media needs it.
    - Docs: `docs/spec.md` §7.5 (CLI usage, `media` semantics, `emulate` ordering, validation, the `contrast` exclusion), §7.5's authoring and MCP descriptions, and §9.3's `capture_preview` paragraph; `docs/preview.md` new § "Capture media variants"; `docs/mcp.md` tool table row, capture section, JSON example and error-kind table.
    - Verification: `typecheck` (src and proof), `lint` (no errors), `format:check`, `gen:check` and `build` clean; `bun test --conditions liveframe:source --max-concurrency=4 src proof` → 998 pass / 4 skip / 0 fail at load 3.3 (124610 expect calls, 1002 tests, 112 files). The default full check and two bare `bun test` runs at load 7–9 reported only browser and timing failures (`capture_returns_png_snapshot_and_errors_per_cell`, `hydration_can_be_followed_by_updates_without_remounting`, the overlay/text conformance browser cases, `production_without_profiling_fails_instead_of_hiding_renders`), which pass alone; the concurrency-4 run is the evidence that no content failure exists. A stray `biome check --write` had also reorganised imports in 75 unrelated files through a changed module order that flipped one printed `. Vocabulary` intersection order; those files were reverted and the API-surface test passes 6/6 again.

- [x] Task 12: Design extension recipe properties and multiple variant axes for 0.3.0 (decision logs only)
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
  - Notes (executed 2026-11-02):
    - Outcome: **both designs approved for 0.3.0**. The owner chose "Approve and log" for each on 2026-11-02. Records: [`decision-logs/2026-11-02-2208-extension-recipe-properties-for-0-3-0.md`](../decision-logs/2026-11-02-2208-extension-recipe-properties-for-0-3-0.md) and [`decision-logs/2026-11-02-2208-multiple-variant-axes-for-0-3-0.md`](../decision-logs/2026-11-02-2208-multiple-variant-axes-for-0-3-0.md). Proposals: [`evidence/022-extension-properties-design.md`](evidence/022-extension-properties-design.md) and [`evidence/022-variant-axes-design.md`](evidence/022-variant-axes-design.md). `roadmap.md` lists both under Phase 7 and in §3. Nothing was declined, so `plans/backlog.md` is untouched.
    - **Extension properties.** The catalog vocabulary gains an optional `extensions` map (`colour`, or `value` with a design-value `kind`). A recipe gains a nested `extensions` map, which keeps app names from colliding with future fixed properties. Values are theme roles or typed design values, so law 3 holds and no string reaches CSS unchecked. They project as `--lf-p-<name>` for the app's trusted CSS. They are optional overlays with no completeness requirement, they merge per name through the existing four cascade layers, and adding one is a minor catalog change. Left out for 0.3.0: an `enum` type (it needs container style queries, Baseline newly available only from 2026-05-19 per secondary sources, past the Baseline 2024 floor), alpha colours, required extensions, a reset rule and `@property` registration.
    - **Variant axes.** A definition's `axes` marks enum string props as recipe axes with defaults, so the tree, patches, SDK, elements schema and codegen do not change. Recipe keys gain the `kind.axis:value.slot.state` form. The cascade becomes rest layers (wildcard, variant, axes in declared order) then state layers in the same order, which keeps the four 0.2.x layers in their old order. The resolver expands overlays into the flat table, so kinds without axes keep identical CSS, and kinds with axes get a positional class suffix (`lf_button_primary__critical_root`). Delta CSS layers were rejected because state rules are full snapshots (`stateDeclarations`); compound variants stay out. Cost is linear in combinations, capped at 3 axes, 16 values and 256 combinations per kind.
    - **Format versions.** Neither feature bumps a format id. Both add optional fields, and a 0.2.x validator rejects documents that use them (closed schemas), which fails closed. The one observable step is in the axes migration entry: making an existing prop an axis renames that kind's slot classes. It is opt-in and the design carries the before/after sample and the adopter checklist.
    - **Facts recorded.** Baselines (2026-11-02, loaded host): Certified design system 152,019 B, Rack 164,152 B, from `bun bench/css.bench.ts`; the 0.3.0 gates are relative to a same-session baseline for time. `@property` is Baseline 2024, newly available since July 2024 (MDN). Style queries on custom properties: Chrome 111, Safari 18, Firefox 151, Baseline newly available 2026-05-19 per secondary sources only, which the records say.
    - Compatibility: nothing ships. No register entry, no declaration change; only two evidence files, two decision logs, `roadmap.md` and this plan changed. The api-stability test is therefore unaffected (no code touched).

- [x] Task 13: Write the 0.2.2 documentation and compatibility notes
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
  - Notes (executed 2026-11-02):
    - `CHANGELOG.md`: added `## 0.2.2 — 2026-11-02` section detailing performance enhancements (patched renders, DOM reuse, focus preservation, fast-path validator) and accessibility additions (four recipe states, reduced-transparency recovery, textScale, forced-colours, reduced-motion capture axes). The 20 register entries from `scripts/release/api/register-0.2.2.json` are listed under subheadings: Added (4 new exports: `CellLayout`, `CaptureMedia`, `CaptureMediaOptions`, `compileValidatorFast`), Widened (13 entries covering all widened register items: `states`, `CaptureOptions.media`, `designSystemSuite` contrast options, and promise-returning `onIntent`/`emit`), and Deferred (3 entries deferred to 0.3.0 naming `ref`, `NodeRef`, `catalog.json` `refProps`).
    - `docs/compatibility.md`: added `## 0.2.2` section linking decision log `https://github.com/ashiqrniloy/liveframe/blob/main/decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md`; updated `## Deferred to 0.3.0` subsection explicitly naming the three deferred register entries (`./sdk ref`, `. NodeRef`, and `./schemas/* catalog.json` `refProps`) and linking the decision log; added Growth lines to Growth rules section for widened unions (`CaptureOptions.media`, `SurfaceProps.onIntent`, `ImplementationProps.emit`, and `designSystemSuite` contrast options).
    - `docs/adopters-0.2.md`: added `## 0.2.2 — Performance and accessibility additions` mapping each of the 8 user-facing capabilities to its concrete API with copy-paste code examples (Patched renders, Focus continuity, Four new recipe states, Reduced-transparency recovery, Preview capture media axes, Contrast test suites, Async intent handling, and Confirmation intent dispatching). Included the explicit "nothing to do" line for non-opt-in adopters ("Adopters who upgrade to 0.2.2 without opting into any of these eight capabilities have nothing to do: 0.2.2 is wire- and runtime-compatible with 0.2.0 and 0.2.1."), and an exhaustive register table where every register entry's `hostAction` column appears verbatim.
    - `docs/security.md`: audited 0.2.2 additions and added `## 0.2.2 audit` confirming no changes to security posture: client-side validation remains strict on whole trees and streamed patches before rendering, reference runner boundaries and non-isolation scope are unchanged, and capture media axes multiply cells strictly within the existing capture cell bounds (`maxCells`, default 12, or configured `maxCaptureCells`).
    - `src/__tests__/api-stability.test.ts`: added `register_host_actions_appear_in_adopter_notes` test asserting that every register entry's `hostAction` string appears verbatim in `docs/adopters-0.2.md`.
    - Verification: `docs-links.test.ts`, `docs-wording.test.ts`, `api-stability.test.ts`, `typecheck`, `lint`, and `format:check` all pass clean with 0 errors.

- [x] Task 14: Prove every acceptance bullet against the checkout
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
  - Notes (executed 2026-11-03):
    - Created [`plans/evidence/022-acceptance.md`](evidence/022-acceptance.md) documenting and proving every Expected Outcome bullet and every criterion for Tasks 1 to 13 against this checkout.
    - `git diff v0.2.1 -- src/__tests__ proof/tests conformance`: 33 files; diff consists exclusively of additions (new test files, new conformance cases, fixtures) and updates resulting directly from register-named entries (`states` widened with 4 states updating recipe counts from 624 to 936, `CaptureOptions.media`, `bindSources`, `renderKey`, `focusContinuity`, production profiling, and validator cache). Zero test assertions were deleted or weakened.
    - Verification commands all passed clean:
      - `bun run check`: passed 999 pass, 4 skip, 0 fail (124,630 expect() calls; 112 files); build, gen:check, typecheck, lint, and format:check green.
      - `bun run bench`: all 4 benchmarks green (validator, render, CSS, streaming).
      - `bun run release:gate`: all 13 steps passed in 3.8s.
      - `bun scripts/release/peer-floors.ts`: react 19.0.0 (111 pass), playwright 1.49.0 (23 pass), MCP server 2.0.0 (76 pass) all passed.
      - `bun run demo:test`: passed 52 pass, 0 fail with `tsc --noEmit` clean (32.2s).
      - Scratch host compatibility: unmodified v0.2.1 demo host code upgraded to the checkout's packed package archive passed `tsc --noEmit` and all 52 tests clean (32.6s).
      - `src/__tests__/api-stability.test.ts`: passed 7/7.
      - `src/__tests__/portability.test.ts`: passed 16/16 (2,417 expect() calls).
    - Re-measured performance targets:
      - Task 3: LF-17 whole-tree arrival validation plus React work is 2.800 ms median development (target ≤ 5.0 ms, down from 10.7 ms) and 2.000 ms median production; node reuse pass alone is 0.200 ms median at 679 nodes (target ≤ 1.0 ms); patch mode is 2.600 ms median development (target ≤ 2.97 ms, no regression from 2.7 ms) and 1.800 ms median production.
      - Task 4: second `compileValidator` call reusing same catalog and capabilities content is 0.1164 ms median on proof catalog (target ≤ 0.25 ms, down from 0.73 ms); cold first compile 0.9222 ms; host revalidation worker overhead recorded in `docs/packages.md` (0.907 ms median, 2.256 ms p95).
      - CSS projection: byte-identical at 152,019 B (certified) and 164,152 B (rack).
      - Render bench: agent-home 1.3184 ms, 1.942 µs/node (budget ≤ 3.0 µs/node, ≤ 2.0 ms); renderKey 0.9611 ms on 33,899 B.
    - Security: host-API-free scans and the four laws re-checked by name and verified green.

- [x] Task 15: Publish 0.2.2-rc.1 under `next` and verify it from the registry
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
  - Notes (executed 2026-11-03):
    - Owner's go: recorded from explicit user instruction ("Complete - [ ] Task 15: Publish 0.2.2-rc.1 under `next` and verify it from the registry from @[plans/022-Phase-7-Part-I-Release-0-2-2-Performance-And-Accessibility.md] and update the plan once done").
    - `package.json` bumped to `0.2.2-rc.1`; `CHANGELOG.md` gained dated rc entry `## 0.2.2-rc.1 — 2026-11-03` noting `This section ships as 0.2.2-rc.1 first.`
    - Pre-tag gates passed clean: `bun run check` (999 pass, 4 skip, 0 fail; 405s), `bun run release:gate` (all 13 steps passed in 8.1s), `bun scripts/release/peer-floors.ts` (React 19.0.0 80s, Playwright 1.49.0 101s, MCP server 2.0.0 34s; all 3 floors passed), and `bun run demo:test` (52 pass, 0 fail across 7 files; 35.15s).
    - Committed bump (`e58a541`), tagged `v0.2.2-rc.1`, pushed `main` and tag `v0.2.2-rc.1` to GitHub.
    - GitHub Actions `Publish` workflow (run ID `41513280017`) completed with success in 11m1s, publishing `@arnilo/liveframe@0.2.2-rc.1` to npm under tag `next` with SLSA provenance (Sigstore transparency log index 3648402012 / bundle tlog index 3648497426; shasum `ce50298d9c0d147460da01e5e951e62eed7f0116`; integrity `sha512-tf5IDHC39VFiRo6LclV6q16kAMrgJtJPFMQuNZNhFEOeQruGuqZLYNwq2bvijSENMA4ijx0QzCltauyrGwsDoA==`).
    - Registry verification:
      - `npm view @arnilo/liveframe dist-tags` confirmed `{ next: '0.2.2-rc.1', latest: '0.2.1' }`.
      - `npm audit signatures --json --include-attestations` verified SLSA v1 provenance at `registry.npmjs.org/-/npm/v1/attestations/@arnilo%2fliveframe@0.2.2-rc.1`.
      - `bun scripts/release/archive-gate.ts --package @arnilo/liveframe@0.2.2-rc.1` passed all 13 steps in 6.2s.
      - API stability comparison: `readApiSurface` and `compareApiSurface` against unpacked registry tarball passed with 0 diffs against 0.2.1 baseline and `register-0.2.2.json` (`[]`).
      - Demo host copied outside the repo and installed from registry passed `tsc --noEmit` and 52 tests, 0 failed in 34.1s.
      - Installed-package acceptance rows passed: Node subpath imports, data `exports` resolution (`package.json`, `schemas/catalog.json`, `conformance/hash/packages.json`, `conformance/patch/diff.json`), package hash vectors through `/pack`, validator bundle under bare Node `vm` with 0 imports and widened states (`pending`, `mixed`, `current`, `readonly`), and authoring MCP server 8-tool listing from installed binary.
    - Full details recorded in [`plans/evidence/022-release-candidate.md`](evidence/022-release-candidate.md).

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
- Completed during execution: the `contrast` capture axis stays out while the Playwright peer floor is `^1.49.0` (Task 11 implemented the other three axes); axe-core is still the follow-up if a host wants automated ARIA/contrast findings beyond the install-time `auditContrast` — it would be a new optional peer, not a dependency.
- To be completed after task completion with improvements, rationale and priority.
