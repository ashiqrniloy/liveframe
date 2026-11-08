# Phase 7 Part Q: Release 0.3.0 — Host Pipeline, Widget Evolution and Package Dependencies

Depends on: plans [026](026-Phase-7-Part-M-Release-0-3-0-Scope-Spec-And-Breaking-Changes.md) (verified-package cache, frozen packages), [028](028-Phase-7-Part-O-Release-0-3-0-Template-Widgets-And-Streaming.md) (template packages, the expression language reused for state migration) and [029](029-Phase-7-Part-P-Release-0-3-0-Interaction-Outcomes-Local-Bindings-And-Surface-Core.md) (action results the pipeline writes; observability event shape). Followed by plan [031](031-Phase-7-Part-R-Release-0-3-0-Isolated-Runner-Conformance-And-Starter.md).

## Objectives

- Close the production orchestration gap (W4) with a **stateless** host pipeline, `@arnilo/liveframe/host`: the library owns the order of the security-critical steps (load, bind, resolve as the viewer, render, validate, diff; then offered-intent check, authorise, persist or dispatch, record the result, re-render), while the host injects its store, runner, resolver, authoriser and dispatcher and keeps every piece of state.
- Let placements coordinate (W6b): compute which placements depend on a changed source, so one widget's action can refresh another's view without a new format.
- Make widgets evolvable (W5): a report of which installed packages break against a new catalog, several catalog majors in one renderer, and declarative state migration on a widget version change.
- Let widgets share runtime component libraries without giving up immutability (W6a): content-addressed package dependencies.
- Make the demo host show all of it, as the example outsiders copy.

## Expected Outcome

- `decision-logs/<date>-stateless-host-pipeline.md` is approved; it records why this does not reopen the stateful controller the 0.2.2 scope decision rejected.
- `/host` exports `renderPlacement`, `handleIntent` and `dependents`, host-API-free, with typed `onEvent` events.
- `/pack` exports `checkPackages`; `createRenderer` accepts several catalogs; manifests may declare `migrateState`; `loadPlacement` reports `migrated` before falling back to `reset`.
- Manifests may declare `exports` and `dependencies`; `pack()` links `liveframe:lib/<id>@<version>` imports against supplied library packages; runners and `loadPlacement` load dependencies by hash; `rebindDependencies` produces a new version against a new library version without re-transpiling.
- `examples/demo-host` uses `/host` end to end and `demo:test` covers sources, re-run skipping, patches with fallback, action results, local filtering, coordinated placements, a template widget, a migrated upgrade and a shared library.

This plan implements roadmap Phase 7's 0.3.0 host-lifecycle work: new spec §7.7 (the host pipeline) and amendments to §7.1, §7.3–§7.5, §8, §11 and §13. The pipeline is optional; every helper it composes stays public. Law 4 is the reason it exists: the library fixes the order of checks but never holds authority — `authorize` and `dispatch` are the host's. Nothing is published here.

## Tasks

- [ ] Task 1: Design the stateless host pipeline and record the decision
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/030-host-pipeline-design.md` specifies `renderPlacement`, `handleIntent` and `dependents` as numbered steps, each naming the existing public helper it calls (`loadPlacement`, `bindSources`, `renderKey`, `Runner.render`, `compileValidator`/`validateTree`, `diffTrees`, `checkOffered`, `verifyPlacementInputs`), the injected host functions (`resolve`, `authorize`, `dispatch`, `publish?`), the inputs the host must pass back (`served`: the last accepted tree, its key, revision and validator identity), and every failure's typed error and event.
      - It states what stays the host's: transport, sessions and viewer identity, concurrency and de-duplication of reads, caching beyond `renderKey`, approval, tenancy.
      - It explains the difference from the rejected controller: no long-lived object, no internal maps, no timers; every call is a pure function of its arguments plus the injected effects.
      - Write `decision-logs/<date>-stateless-host-pipeline.md` with `create-decision-log`; owner approval before Task 2.
    - Performance: the design budgets pipeline overhead at ≤ 0.2 ms per `renderPlacement` beyond the runner and the resolver, on the demo catalog.
    - Code Quality: the design names one module per function in `src/host/`.
    - Security: the design shows each law's enforcement point in the sequence (law 2: host validation before `served`; law 4: `checkOffered` then `authorize` before any effect).
  - Approach:
    - Skills to Use: `create-decision-log`; `liveframe-execution` (storage, preview, renderer references).
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `decision-logs/2026-11-01-1747-release-0-2-2-scope-and-api-stability.md` (alternative 5); `plans/liveframe-evaluation.md` Part II §1; `examples/demo-host/server.ts` (229 lines; `checkOffered` at `:168`); `docs/renderer.md:380-396`; `docs/model.md` Phase C.
    - Options Considered: a stateful controller (rejected in 0.2.2 and again here: state ownership belongs to the host); docs only (rejected: every adopter re-implements the security-critical order).
    - Chosen Approach: stateless functions with injected effects.
    - API Notes and Examples:
      ```ts
      const out = await renderPlacement({ store, runner, installs, placementId, scope, context, actions, resolve, previous: served });
      const next = await handleIntent({ served, origin, intent, store, runner, installs, resolve, authorize, dispatch, publish });
      ```
    - Files to Create/Edit: `plans/evidence/030-host-pipeline-design.md`; `decision-logs/<date>-stateless-host-pipeline.md`
  - Test Cases to Write: n/a — design.
  - Notes (executed <date>):

- [ ] Task 2: `renderPlacement`
  - Acceptance Criteria:
    - Functional:
      - `renderPlacement(args): Promise<Result<Served>>` where `Served = { tree, key, revision, validator, patch?, package: { id, version, hash }, state, reset?, migrated? }`. Steps: `loadPlacement` (with `verified` cache when given) → `bindSources` → `resolve(calls, viewerContext)` → each result validated against its source's `result` schema (a failing or throwing resolver yields a `sourceOutcome` failure envelope when the source declares one, else `render-failed` at `/data/<key>`) → `renderKey`; equal to `previous.key` returns `previous` unchanged with a `render-skipped` event → `runner.render` → host `validateTree` → `diffTrees(previous.tree, tree)` when `previous` matches surface and catalog; `invalid-document` from diffing yields a whole tree only.
      - `installs` maps `catalogId` → `{ catalog, capabilities }` (supports Task 7); an unknown `catalogId` is `catalog-mismatch`.
      - `onEvent` reports `render-skipped`, `state-reset`, `state-migrated`, `source-failed`, `tree-rejected`.
    - Performance: the Task 1 overhead budget, measured in `bench/host.bench.ts` with an in-memory store and a stub runner.
    - Code Quality: composes public helpers only; no copies of their logic.
    - Security: law 2 — runner output is validated on the host before it can become `served`; sources are resolved only through the injected `resolve`.
    - Compatibility: `added` for `/host` and its exports.
  - Approach:
    - Skills to Use: `liveframe-execution`; `lean-build`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `src/store/load.ts:34-99`; `src/formats/manifest.ts:304`; `src/pack/hash.ts:225`; `src/validate/patch.ts:174`; `src/schema.ts:106` (`sourceOutcome`).
    - Options Considered: resolve sources inside the runner. Rejected: data is resolved by the app as the viewer (law 4), outside widget code.
    - Chosen Approach: the designed sequence.
    - API Notes and Examples: see Task 1.
    - Files to Create/Edit: `src/host/render.ts`; `src/host/index.ts`; `package.json` (`./host`); `scripts/build.ts`; `bench/host.bench.ts`; `src/__tests__/host-render.test.ts`; `src/__tests__/portability.test.ts`; `docs/spec.md` §7.7, §13; `docs/host.md`; `register-0.3.0.json`
  - Test Cases to Write:
    - `skips_render_when_key_unchanged`; `patch_when_previous_matches_whole_tree_otherwise`; `resolver_failure_becomes_outcome_envelope`; `resolver_result_failing_schema_rejected`; `runner_tree_validated_on_host`; `unknown_catalog_id_catalog_mismatch`.
  - Notes (executed <date>):

- [ ] Task 3: `handleIntent`
  - Acceptance Criteria:
    - Functional:
      - `handleIntent(args): Promise<Result<{ served: Served; actions: Record<string, ActionStatus> }>>`. Steps: `checkOffered(served.tree, origin, intent, served.validator)` (failure → `refused` result for actions, typed error for `setState`; `intent-refused` event) → for `setState`: check value against the manifest state schema, `store.putState`, `renderPlacement` → for actions: `authorize(intent, viewer)` (false → `refused`), else set `pending`, call `publish` with a re-render if provided, `await dispatch(intent)` returning `{ ok: true, value? } | { ok: false, reason }`, validate `value` against the action's `result` schema, set `ok`/`failed`, re-render with updated `actions` and `publish`.
      - Concurrency rule from spec §11 holds: an intent from a superseded revision is refused, never rewritten to the latest revision.
      - `setLocal` intents reaching the host are `invalid-document` (they belong to the renderer).
    - Performance: overhead ≤ 0.2 ms beyond the injected calls.
    - Code Quality: one function; effects only through injected callbacks.
    - Security: law 4 — nothing runs before `checkOffered` and `authorize`; a `dispatch` throw becomes `failed` with a generic reason, never the host's stack.
    - Compatibility: `added`.
  - Approach:
    - Skills to Use: `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `src/validate/offered.ts:29`; spec §8 rules; plan 029 Task 2 (`ActionStatus`).
    - Options Considered: dispatch before re-checking the schema. Rejected: spec §8 requires the re-check.
    - Chosen Approach: the designed sequence.
    - API Notes and Examples: see Task 1.
    - Files to Create/Edit: `src/host/intent.ts`; `src/host/index.ts`; `src/__tests__/host-intent.test.ts`; `docs/host.md`; `docs/spec.md` §7.7, §8; `register-0.3.0.json`
  - Test Cases to Write:
    - `unoffered_intent_refused_no_effect`; `stale_revision_refused`; `authorize_false_refused`; `pending_then_ok_published_in_order`; `dispatch_throw_becomes_failed_without_leak`; `result_value_failing_schema_becomes_failed`; `set_state_persists_then_rerenders`; `set_local_at_host_rejected`.
  - Notes (executed <date>):

- [ ] Task 4: Cross-placement coordination through source dependents (W6b)
  - Acceptance Criteria:
    - Functional:
      - `dependents(placements, change)` where `placements` are `{ placementId, bound: ReturnType<typeof bindSources> }` and `change` is `{ source, params? }`; returns the placement ids whose bound calls name the source and, when `params` is given, equal params by canonical JSON. Linear in total bound calls.
      - `docs/host.md` shows the coordination pattern: a "selection" capability (a source plus an action), two placements, `handleIntent` on one, `dependents` to re-render the other.
    - Performance: linear; benchmarked with 1,000 placements.
    - Code Quality: a pure function; no subscription registry.
    - Security: law 4 — coordination goes through declared capabilities only; no widget-to-widget channel.
    - Compatibility: `added`.
  - Approach:
    - Skills to Use: `liveframe-execution`; `lean-build`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `src/formats/manifest.ts:304`; `src/pack/hash.ts` (`canonicalJson`).
    - Options Considered: a new channel format and intent. Rejected: sources and actions already express shared host data; a new format adds a second path to the same thing.
    - Chosen Approach: compute dependents from existing bindings.
    - API Notes and Examples:
      ```ts
      for (const id of dependents(placements, { source: "selection.current" })) publish(await renderPlacement({ …, placementId: id }));
      ```
    - Files to Create/Edit: `src/host/dependents.ts`; `src/host/index.ts`; `src/__tests__/host-dependents.test.ts`; `docs/host.md`; `register-0.3.0.json`
  - Test Cases to Write:
    - `dependents_match_source_name`; `dependents_match_params_canonically`; `dependents_linear_scale`.
  - Notes (executed <date>):

- [ ] Task 5: The demo host shows the full orchestration
  - Acceptance Criteria:
    - Functional:
      - `examples/demo-host/server.ts` uses `renderPlacement`/`handleIntent`/`dependents` and keeps only transport and its own resolver/dispatcher/authoriser.
      - New demo capabilities and widgets: a task source with paging (`bindSources` from `state.cursor`), a `tasks.claim` action with a `result` schema, a "selection" source/action shared by a list and a detail placement, a TSX widget with local filtering (`when`), a template widget, and an upgraded widget version exercising `migrateState` (Task 8) and a shared library (Tasks 9–10) once those land — this task adds the first five; Tasks 8–10 extend the demo in their own steps.
      - `demo:test` asserts: a re-render with unchanged inputs is skipped; a state change ships a patch and a stale base falls back to a whole tree; a claim shows pending then ok; selecting in the list re-renders the detail; typing in the filter sends no request.
      - Resolves backlog "Show request-time orchestration in the demo host" and "Fix initially-open dialogs in the demo host" if the latter blocks these flows (else left in the backlog with a note).
    - Performance: n/a — example; `demo:test` time recorded.
    - Code Quality: the demo server shrinks; the README walks through it.
    - Security: the demo's authoriser is explicit and documented as a placeholder for the app's policy.
    - Compatibility: n/a — example code.
  - Approach:
    - Skills to Use: `liveframe-execution`; `run` (drive the demo host to confirm).
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `examples/demo-host/*`; backlog entries named above.
    - Options Considered: a separate second example. Rejected: hosts copy the demo; one complete example beats two partial ones.
    - Chosen Approach: upgrade the demo in place.
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `examples/demo-host/server.ts`; `capabilities.json`; `widgets/*`; `catalog.json` (if a primitive like `textField` with `onInput` is needed); `primitives/*`; `tests/*`; `README.md`; `scripts/demo-test.ts`; `plans/backlog.md`
  - Test Cases to Write:
    - `demo_skips_unchanged_render`; `demo_patch_and_stale_fallback`; `demo_claim_pending_then_ok`; `demo_selection_coordinates_placements`; `demo_filter_sends_no_request`.
  - Notes (executed <date>):

- [ ] Task 6: Report which installed packages break against a new catalog (W5a)
  - Acceptance Criteria:
    - Functional:
      - `/pack` exports `checkPackages(packages, { catalog, capabilities }): readonly PackageCheck[]` with `{ id, version, hash, ok, errors }` per package, running `verifyPackage` plus a render of every scenario through an optional `runner` argument (`templateRunner` needs no sandbox; code packages need the host's runner). It never mutates or stores.
      - `liveframe check-packages <store-dir> --catalog <file> --capabilities <file>` prints the report as JSON (Bun CLI; reads a `fileStore`).
      - `docs/packages.md` § "Upgrading the catalog": classify with `classifyCatalogChange`, run `checkPackages`, decide per package.
    - Performance: linear in packages; 1,000 template packages checked in a bench, recorded.
    - Code Quality: composes `verifyPackage` and runners.
    - Security: law 1 — code packages render only through the supplied runner; none is defaulted.
    - Compatibility: `added` for `checkPackages` and the CLI command.
  - Approach:
    - Skills to Use: `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `src/formats/catalog.ts:416` (`classifyCatalogChange`); `src/pack/verify.ts:50`; `src/cli/*`.
    - Options Considered: automatic migration of packages. Rejected: changing code is an author's act; the report feeds that work.
    - Chosen Approach: a pure report plus a CLI wrapper.
    - API Notes and Examples:
      ```ts
      // The Store interface has no package listing; the host passes the packages it keeps
      // (the CLI enumerates a fileStore's documented packages/ layout).
      const report = await checkPackages(installedPackages, { catalog: next, capabilities, runner: templateRunner() });
      ```
    - Files to Create/Edit: `src/pack/check.ts`; `src/pack/index.ts`; `src/cli/liveframe.ts`; `src/__tests__/pack-check.test.ts`; `docs/packages.md`; `docs/spec.md` §7.3, §13; `register-0.3.0.json`
  - Test Cases to Write:
    - `removed_kind_breaks_dependent_package`; `minor_catalog_change_keeps_packages_ok`; `scenario_render_failure_reported`; `cli_prints_report`.
  - Notes (executed <date>):

- [ ] Task 7: Several catalog majors in one renderer (W5b)
  - Acceptance Criteria:
    - Functional:
      - `createRenderer({ catalogs: [{ catalog, implementations }, …] })` runs the registry check per catalog (an implementation may serve several catalogs only if its definition equals each catalog's); `createRenderer({ catalog, implementations })` keeps working.
      - `<Surface>` selects the catalog by the arriving tree's `catalogId`, which must equal the validator's; a mismatch renders the fallback with `catalog-mismatch` (and an `arrival-rejected` event).
      - Spec §6.4 adds: a design system is compiled for one catalog; surfaces of two catalog majors on one page use distinct design-system identities. `designSystemCss` already takes the catalog; docs show two sheets side by side.
      - `/host` `installs` (Task 2) routes by `catalogId`. A browser test renders an `acme.ui@1` and an `acme.ui@2` surface on one page with different `button` definitions.
    - Performance: selection by id is O(1); arrival budget unchanged.
    - Code Quality: the surface core (plan 029) takes a catalog lookup instead of one catalog.
    - Security: law 2 — a tree validated against the wrong catalog cannot render.
    - Compatibility: `widened` for `createRenderer` and `createSurfaceCore`.
  - Approach:
    - Skills to Use: `liveframe-execution` (renderer reference).
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `src/react/renderer.tsx:350-400` (registry check); spec §5 (versioning), §6.4, §11.
    - Options Considered: one renderer per catalog. Works today but forces hosts to route surfaces themselves; the multi-catalog form keeps one registry.
    - Chosen Approach: an additive `catalogs` form.
    - API Notes and Examples:
      ```ts
      const { Surface } = createRenderer({ catalogs: [{ catalog: v1, implementations: implsV1 }, { catalog: v2, implementations: implsV2 }] });
      ```
    - Files to Create/Edit: `src/react/renderer.tsx`; `src/surface/*`; `src/host/render.ts`; `src/__tests__/react-registry.test.tsx`; `src/__tests__/react-browser.test.tsx`; `docs/renderer.md`; `docs/styling.md`; `docs/spec.md` §6.4, §11; `register-0.3.0.json`
  - Test Cases to Write:
    - `registry_check_per_catalog`; `shared_implementation_requires_equal_definitions`; `two_catalog_majors_on_one_page` (browser); `catalog_id_mismatch_falls_back`.
  - Notes (executed <date>):

- [ ] Task 8: Declarative state migration (W5c)
  - Acceptance Criteria:
    - Functional:
      - A manifest may declare `migrateState: Record<stateKey, Expr>` using the template expression language with one root, `previous` (the stored state, type `unknown`). Install checks expression shape, bounds and that each key exists in the state schema.
      - `loadPlacement` and `verifyPlacementInputs`: when stored state fails the schema and the manifest declares `migrateState`, build `initialState` overlaid with each evaluated key; if that validates, return it with `migrated: LiveframeError[]` (the original failures) and no `reset`; otherwise reset as today. A host persists the migrated state if it wants.
      - Templates and TSX widgets both use it; the demo's upgraded widget migrates `filter: "mine"` to `scope: { owner: "me" }`.
      - Spec §14's "beyond resetting" non-goal is replaced by this rule.
    - Performance: runs only on the failure path.
    - Code Quality: evaluation via `/template`'s `evaluate`; no new interpreter.
    - Security: law 4 — migration reads only the stored state; no data, no host access.
    - Compatibility: `widened` for `manifest.json`, `loadPlacement`, `verifyPlacementInputs` result types.
  - Approach:
    - Skills to Use: `liveframe-execution` (storage reference).
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `src/store/load.ts:11-99`; spec §7.4, §14.
    - Options Considered: a `migrate` function in package code. Rejected: needs the runner (a sandbox) at load time and the stored state has no version tag; a declarative mapping needs neither.
    - Chosen Approach: declarative per-key mapping from `previous`.
    - API Notes and Examples:
      ```jsonc
      "migrateState": { "scope": { "$cond": [{ "$eq": [{ "$path": "previous.filter" }, { "$lit": "mine" }] }, { "$lit": { "owner": "me" } }, { "$lit": { "owner": null } }] } }
      ```
    - Files to Create/Edit: `src/formats/manifest.ts`; `src/store/load.ts`; `src/store/index.ts`; schemas; corpus; `examples/demo-host/widgets/*`; `docs/packages.md`; `docs/spec.md` §7.4, §14; `register-0.3.0.json`
  - Test Cases to Write:
    - `migration_applies_when_state_fails`; `failed_migration_falls_back_to_reset`; `migrate_key_not_in_state_schema_rejected`; `migration_cannot_read_data_root`.
  - Notes (executed <date>):

- [ ] Task 9: Content-addressed package dependencies — format and packing (W6a, part 1)
  - Acceptance Criteria:
    - Functional:
      - A **library package** is an ordinary code package whose manifest declares `exports: string[]` (named composed components, ≤ 64) besides its default export, which renders its scenarios as a gallery; all existing package rules apply.
      - A widget imports `liveframe:lib/<id>@<version>` named exports. `pack(input, { …, libraries })` resolves each such import against a supplied, verified library package, checks the names are in its `exports`, records `manifest.dependencies: [{ id, version, hash }]` (≤ 16 direct; the transitive graph ≤ 32 packages, depth ≤ 4, acyclic) and emits canonical linker header lines `import * as __lf_lib<N> from "liveframe:lib/<id>@<version>";` after the SDK lines. Library code is **not** copied into the dependent.
      - The package hash covers `manifest.dependencies` (so a dependency hash change is a new dependent hash). `verifyPackage(pkg, { …, libraries })` re-checks pins and names.
      - `rebindDependencies(pkg, { libraries, version })` returns a new frozen package with a new `version`, the same `code`, and dependency pins moved to the supplied library versions, provided every used name is still exported; otherwise `unknown-name`. Template packages may not declare dependencies in 0.3.0 (`invalid-document`).
      - Spec §7.3 replaces "a package never depends on another" with these rules; `forbidden-import` keeps rejecting every other bare specifier.
    - Performance: pack time for a widget with two libraries ≤ pack time of the same widget with the components bundled.
    - Code Quality: header lines follow the existing linker contract's shape (`src/runner-kit/link.ts:27`).
    - Security: integrity by hash pins; a library is inert data until a runner links it; law 1 unchanged.
    - Compatibility: `widened` for `manifest.json`, `pack`, `verifyPackage`; `added` for `rebindDependencies`; a hash vector for a dependent package (register entry).
  - Approach:
    - Skills to Use: `liveframe-execution` (storage reference); `find-docs` (acorn 8.19.0 import-declaration AST for named imports).
    - Library Documentation to Check Before Implementation: acorn 8.19.0 `ImportDeclaration`/`ImportSpecifier`; sucrase 3.35.1 import preservation.
    - Documentation Reviewed: `src/pack/bundle.ts:59` (`checkModule`); `src/runner-kit/link.ts`; spec §7.3, §7.5 (linker contract).
    - Options Considered: semver ranges. Rejected: a package's tree must be determined by its hash. Copy libraries in (status quo). Rejected: updating a shared component means repacking every widget from source the host may not keep.
    - Chosen Approach: exact hash pins plus `rebindDependencies`.
    - API Notes and Examples:
      ```tsx
      import { TaskCard } from "liveframe:lib/acme.cards@3.1.0";
      ```
    - Files to Create/Edit: `src/formats/manifest.ts`; `src/pack/pack.ts`; `src/pack/bundle.ts`; `src/pack/verify.ts`; `src/pack/rebind.ts`; `src/pack/index.ts`; schemas; `conformance/hash/packages.json`; corpus; `docs/packages.md`; `docs/spec.md` §7.3; `register-0.3.0.json`
  - Test Cases to Write:
    - `import_of_unexported_name_rejected`; `dependency_cycle_rejected`; `library_code_not_copied`; `dependency_pin_in_hash`; `rebind_moves_pins_and_version`; `rebind_missing_name_unknown_name`; `template_with_dependencies_rejected`.
  - Notes (executed <date>):

- [ ] Task 10: Content-addressed package dependencies — linking, runners and stores (W6a, part 2)
  - Acceptance Criteria:
    - Functional:
      - `linkPackage(code, resolve)` accepts `__lf_lib<N>` header lines and resolves them through the same callback (`resolve(specifier)` receives `liveframe:lib/<id>@<version>`). The runner kit's `renderModule` is unchanged.
      - `Runner.render(pkg, inputs, { …, libraries? })`: the reference runners load each library by hash before the dependent, verify each hash once, and count libraries toward `maxModules`/`maxPackages`. The QuickJS runner (plan 031) implements the same.
      - `loadPlacement` loads `manifest.dependencies` from the store by `(id, version)`, verifies hashes against the pins (`hash-mismatch` on difference, `not-found` when missing) and returns them as `libraries`. The verified-package cache covers libraries.
      - `renderPlacement` passes libraries through. The demo installs a shared `acme.cards` library used by two widgets, then upgrades it and rebinds both without repacking source.
      - `storeSuite` gains dependency cases.
    - Performance: rendering a dependent with warm libraries is within 5% of the bundled equivalent on the in-process runner.
    - Code Quality: one dependency loader shared by both reference runners.
    - Security: a pin mismatch never loads; law 2 unchanged (trees validated on the host).
    - Compatibility: `widened` for `linkPackage`, `Runner` options, `loadPlacement` result.
  - Approach:
    - Skills to Use: `liveframe-execution` (preview, storage references).
    - Library Documentation to Check Before Implementation: Bun dynamic `import()` of `data:` URLs (current loader behaviour) via `find-docs`.
    - Documentation Reviewed: `src/preview/load.ts`; `src/preview/in-process.ts:44`; `src/preview/worker/index.ts:59`; `src/store/load.ts`.
    - Options Considered: inline libraries at load time into one module. Rejected: loses per-library module caching and identity.
    - Chosen Approach: link by specifier, load by hash.
    - API Notes and Examples:
      ```ts
      const loaded = value(await loadPlacement(store, id, install));
      await runner.render(loaded.package, inputs, { …, libraries: loaded.libraries });
      ```
    - Files to Create/Edit: `src/runner-kit/link.ts`; `src/preview/load.ts`; `src/preview/in-process.ts`; `src/preview/worker/*`; `src/preview/runner.ts`; `src/store/load.ts`; `src/conformance/store.ts`; `src/host/render.ts`; `scripts/runner-kit-bundle.ts`; `examples/demo-host/*`; `docs/packages.md`; `docs/spec.md` §7.4–§7.5; `register-0.3.0.json`
  - Test Cases to Write:
    - `link_rewrites_library_header_lines`; `runner_loads_library_before_dependent`; `pin_mismatch_hash_mismatch`; `missing_library_not_found`; `both_runners_agree_with_libraries`; `demo_rebinds_shared_library`.
  - Notes (executed <date>):

- [ ] Task 11: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: the twelve impact areas swept in `plans/evidence/030-impact-analysis.md`, with law 4 reviewed step by step through `handleIntent` and integrity reviewed for dependencies; findings presented, dispositions recorded and executed or backlogged.
    - Performance: `bun run bench` including `host.bench.ts`.
    - Code Quality: findings cite `file:line`.
    - Security: an explicit review that no pipeline path performs an effect before `checkOffered` and `authorize`.
  - Approach:
    - Skills to Use: `create-plan`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: this plan's notes.
    - Options Considered: n/a.
    - Chosen Approach: the standard final task.
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `plans/evidence/030-impact-analysis.md`; `plans/backlog.md`.
  - Test Cases to Write: n/a.
  - Notes (executed <date>):

## Verification (whole plan)

- `timeout 900 bun run check`
- `timeout 900 bun run bench`
- `bun run demo:test`
- `bun src/cli/liveframe.ts check-packages examples/demo-host/.data --catalog examples/demo-host/catalog.json --capabilities examples/demo-host/capabilities.json`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
