# Plan 030 architectural impact analysis

Reviewed 2026-11-08 against the tree at `6930939` (Tasks 1–10 committed) plus this task's own changes. Covers the twelve areas in `.claude/skills/create-plan/references/liveframe.md` §5 for the 0.3.0 host-lifecycle batch: the stateless host pipeline (`renderPlacement`, `handleIntent`, `dependents`), `checkPackages`, several catalog majors in one renderer, declarative state migration, and content-addressed package dependencies. It is not the 0.3.0 release (plans 031–032).

Method: read the plan and its ten notes; read `src/host/*`, `src/store/load.ts`, `src/preview/dependencies.ts`, `src/pack/{libraries,rebind}.ts`; walked `handleIntent` step by step for law 4; compared the design (`plans/evidence/030-host-pipeline-design.md`, R1–R11, H1–H9, D1–D3) with the code, spec §7.7 and `docs/host.md`; grepped for stale spec text; ran the whole-plan verification.

**The machine was busy.** Load average was 12–37 for the whole session (other users' builds). Wall-clock figures below are noise-bound, as in plans 026–029. The quiet-host proof stays with plan 032 Task 3.

## Whole-plan verification

| Command | Result |
| --- | --- |
| `timeout 900 bun run check` (load 5 rising to 18) | build, gen:check, typecheck, lint, format pass. **1675 pass, 1 fail**, 4 skip. The failure is `verify_agent_home_under_20_ms` (208 ms in the run). |
| that test alone, 3 times | pass, fail (163 ms), pass |
| paired against `37affb0` (before Task 9), 14 samples each, load 13 | median **15.5 ms base, 15.0 ms head**; ranges 11–27 and 12–32 ms. Task 9's rewrite of `verifyPackage` is not slower; the test takes **one** sample against a 20 ms gate, so a descheduled run fails it. Finding F10 |
| `timeout 900 bun run bench` | exits 1 at the **first** stage: the validator bench's `core-queue.*` µs/node gates (1.5), which also fail at `6041e0b` and `eedf1c1` (plan 029 analysis), and `bindings: 50 when` at 2.07 µs/node against 1.75 at load 11. Because the stages are chained with `&&`, `host.bench.ts` and `pack-libraries.bench.ts` never run under `bun run bench`. Finding F10 |
| `bench/pack-libraries.bench.ts` directly | pack with two libraries 22.2 ms vs bundled 49.7 ms; render with libraries 0.336 ms vs bundled 0.371 ms (the 5% criterion holds) |
| `bench/host.bench.ts` directly, 5 runs at load 16–37 | pipeline gate (`skipped − load`) passed twice (−0.10 and 0.04 ms) and failed three times (0.386, 0.361, 0.341 ms against 0.2; `handleIntent` once). The two segments are timed separately, so one scheduling hiccup is a whole figure. Quiet-machine figures from Tasks 2–3 stand: 0.13–0.16 ms and −0.13 to +0.09 ms. `dependents` over 1,000 placements 0.08–0.22 ms (Task 4: 0.057 ms), `check_packages` 1.3–1.8 ms per package (Task 6: 0.66 ms), `validateTree` 0.010–0.022 ms, `diffTrees` 0.001–0.008 ms |
| `bun run demo:test` | 67 pass, 0 fail (before this task's `handleIntent` change; rerun below) |
| `bun src/cli/liveframe.ts check-packages examples/demo-host/.data --catalog … --capabilities …` | exit 0, both stored packages `ok` |

The bench stage did not rewrite `plans/evidence/019-streaming-bench.md` this time because it stopped before the streaming stage.

## 1. Spec

`docs/spec.md` describes what shipped: §7.1 (`migrateState`, `exports`, `dependencies`), §7.3 (libraries, the dependency graph, `rebindDependencies`, `checkPackages`), §7.4 (load rules, `migrated`, libraries), §7.5 (the linker contract with library lines), §7.7 (the host pipeline), §6.4 and §11 (several catalogs), §8, §10 (`forbidden-import`), §13 (tables), §14 (the non-goal now excludes only code-based migration). Grep for the retired phrases ("a package never depends on another", "beyond resetting") finds nothing in `docs/`, `README.md`, `src/` or the skills.

**F1 (spec text wrong): §7.7 rule 5 said `authorize` precedes every effect, but `setState` wrote state without calling it.** Corrected with the code (see the law 4 review). **F12: `roadmap.md` §3's row for plan 030 still said "Tasks 1–6"**; updated at plan close.

## 2. Public API and formats

- Added: subpath `/host` (`renderPlacement`, `handleIntent`, `dependents`, `Served`, `HostEvent`, `HostWiring`, `Installs`, `SourceCall`, `SourceResult`, `Actions`, `IntentArgs`, `DispatchResult`, `Handled`, `Dependent`); `/pack` `checkPackages`, `PackageCheck`, `rebindDependencies`; `/runner-kit` `LibrarySpecifier`; the `liveframe check-packages` command; `RunnerOptions.libraries`.
- Widened: manifest (`migrateState`, `exports`, `dependencies`), `schemas/manifest.json`, `pack`, `verifyPackage`, `loadPlacement` and `verifyPlacementInputs` results (`migrated`, `libraries`), `linkPackage`, `createRenderer` (`catalogs`).
- Changed: `<Surface>` reports `catalog-mismatch` at `/catalogId` where 0.2.3 said `invalid-prop` (migration guide, "Breaking changes"). `storeSuite` has 19 cases.
- The register (`scripts/release/api/register-0.3.0.json`) lists each; `api-stability` passes. Hash vectors for dependent packages are a new file (`conformance/hash/library-packages.json`), not an edit.
- A 0.2.x verifier rejects every new field fail-closed, the precedent of plans 026–029.
- **None — no unregistered break found.** `examples/` is typechecked by `demo:test` (plan 029 F1 is why that is in the verification list).

## 3. The four laws

### Law 4, step by step through `handleIntent` (`src/host/intent.ts`)

What can happen, in order, for each path. "Effect" means anything outside the function's own values: a store read or write, a source read, a widget run, a callback.

| Step | Code | Effect before it? |
| --- | --- | --- |
| H1 | `Object.hasOwn(installs, catalogId)` | none (a map read). Unknown catalog returns `catalog-mismatch` |
| H2 | `checkOffered(served.tree, origin, intent, served.validator)` | none. Pure over the host's own frame. Stale/future revision → `version-conflict`, returned as is |
| H2 fail, not an offered action | `refuseOffered` returns the errors | none |
| H2 fail, an offered action | records `refused` under the **tree's** key, then re-renders | the re-render reads the store, `resolve`s and may run the widget; it follows the check and runs nothing the viewer chose. Before F2 it ran on every repeat; now a repeat that changes nothing returns at once |
| H3 `setState` | **now `authorize` first (F1)**; then `loadPlacement`, `checkValue`, `putState`, render | before F1 the write followed only `checkOffered`; now `authorize` precedes `putState` and the load |
| H4 `action` | `admit` (a pure map operation, `limit-exceeded` before anything), then `authorize` | none |
| H5 pending | `render(pending)` and `publish`, only with `publish` | after `authorize` |
| H6 | `dispatch(intent, viewer)` | after `authorize` |
| H7–H9 | record, render, `publish`, return | after `dispatch` |

The `intent` handed to `authorize` and `dispatch` is the posted one, accepted only because `checkOffered` reproduced the offered intent exactly (type, key or name, literals, `resultKey`); `setLocal` cannot reach the host (`invalid-prop` at `/type`). `authorize` fails closed (`=== true`; a throw or rejection is a refusal; the thrower's text is never copied). A `dispatch` throw becomes `failed` with a fixed reason and an `action-failed` event with `error.name` only. The `result` value reaches the widget only after `checkValue` against the capability's schema, else it is dropped or the action is `failed`. Events hold ids, kinds, reasons and typed errors, never values (`events_carry_no_values`, `set_state_unauthorized_writes_nothing` for the new path).

**Conclusion: no path performs an effect before `checkOffered`; after F1, none performs a write or an operation before `authorize`.** The remaining read-only effect after a failed check (the refusal re-render) is bounded by F2.

Limits of the review, recorded as findings:

- **F3. `served` is trusted.** An action reads no store before `authorize`, so a frame the host kept after replacing, deleting or disabling the placement still dispatches what it offered. The host must drop it; `docs/host.md` and spec §7.7 now say so. `setState` loads the placement but applies the old tree's key to the installed package's schema (Task 3 finding); a stricter comparison of `served.package.hash` is left to the host (backlog not needed: the docs carry the rule).
- **F4. Double submit.** There is no in-flight guard: the library is stateless, `pending` is visible only to a push host, and the action can arrive twice. The docs now tell the host to make `dispatch` idempotent.
- A host that lets a client **choose** `served` (rather than storing it server-side) hands the client the validator and the tree `checkOffered` trusts. `Served` holds a process-local compiled validator, so it cannot be round-tripped through a client by accident; the docs keep it as a host-stored value.

### Dependencies and integrity

- **Pins:** `manifest.dependencies` is `(id, version, hash)`, in the package hash, ascending by id. `loadPlacement` reads each library by `(id, version)`, verifies it like any stored package (through the `verified` cache, whose key is hash + catalog + capabilities), and requires `hash === pin.hash` (`hash-mismatch`) or `not-found`. A runner repeats the check against what it is handed (`collectLibraries`) and re-hashes each library once per object — only when the object is frozen, so a mutated object is re-hashed (`verifyPackageHash`, `src/preview/cache.ts:15`).
- **Immutability:** a second hash under an existing `(id, version)` is refused by the store, so a pin cannot be repointed. A library change reaches a dependent only through `rebindDependencies`, which makes a **new version** with a new hash; the old placement keeps the old pins.
- **Bounds:** 16 direct, 32 in all, depth 4, acyclic, one version per id; enforced by `verifyPackage`, `loadPlacement` and both runners. Doctored cycles are caught by trail before recursion.
- **Authority:** a library is inert data until a runner links it, runs in the same realm and under the same limits as the dependent, and gets the same SDK lines. It adds no capability; law 1 is unchanged.
- **Gap, F6:** at load, the dependent is verified without the libraries, so the names it reads from a pinned library are checked at `pack()`/`verifyPackage(…, { libraries })` and at link time, not at `loadPlacement`. A doctored dependent with a recomputed hash that reads a missing name fails at link time (`render-failed`). Anyone able to write a package to the store can already store arbitrary code, so this is not an escalation; it is an earlier error.
- **Gap, F11:** a library's data URL is embedded in the dependent's module text (about 3× the library size per direct library) — measured render time unaffected.

### Laws 1–3

Law 1: reference runners still run code only on the backend; `templateRunner` and `checkPackages` render no code package without the runner the host supplies. Law 2: `renderPlacement` validates every runner tree on the host (`checkTree`) and the surface/revision pair before it can become `served`; `<Surface>` validates against the catalog of its validator and refuses a tree that names another (`catalog-mismatch`). `migrateState` expressions read only `previous` (root-scope check; `data`, `params`, `state`, `context` and `actions` are `unknown-name`). Law 3: no styling path changed.

## 4. Validation

Every new input has a typed error at a pointer: `unknown-name` (`migrateState` key or root, a library name), `invalid-document` (manifest fields, a template with `dependencies`, a cycle, `catalogs`), `limit-exceeded` (dependency bounds, 64 actions), `hash-mismatch` and `not-found` (pins), `catalog-mismatch` (`installs`, `catalogs`), `forbidden-import` (every bare specifier but a library import), `render-failed` (a bad source or runner answer, with fixed messages). Untrusted documents given to `checkPackages` are reported, never thrown. Corpus cases cover the manifest and tree rejections.

Two checks run late rather than at install (both recorded, neither an unvalidated input): **F7** `migrateState` results are validated against the state schema at load, so a wrong mapping shows as a reset at run time, not a failed install; **F6** above.

## 5. Styling

None — no recipe, theme or CSS-projection code changed. The two-catalog rule (a design system is compiled for one catalog) is spec §6.4 rule 4 and `docs/styling.md`; the browser test proves the page draws each major's own implementation, not the sheets (Task 7 note).

## 6. Interaction tiers

Tier 2 (`setState`) is now authorised like tier 3, which completes the host sequence for all three tiers: local (never leaves the browser), `setState` (offered check, authorise, schema re-check, write, render), action (offered check, authorise, pending, dispatch, record, render). `docs/model.md` (tier 2) and `docs/host.md` carry it. A refused `setState` has no `actions` entry to show the widget; it is silent to the widget by design (the frame comes back unchanged).

## 7. Performance

Budgets and what was measured are in the verification table. Standing results: pipeline overhead 0.13–0.16 ms beyond `loadPlacement` (budget 0.2, quiet host; gate noise-bound under load, **F10**); `handleIntent` within ±0.1 ms of an equal `renderPlacement`; `dependents` linear (0.06–0.2 ms for 1,000 placements); `checkPackages` 0.66–1.8 ms per package; a dependent with warm libraries within 5% of bundled; packing with libraries faster than bundling. F2 removes a per-request `loadPlacement` + `resolve` for a repeated refusal. **F11:** `loadLibraries` reads pins one at a time (up to 32 sequential store reads on a cold load, each through the verified cache); the pending frame re-resolves and re-runs the widget once per action with `publish` (Task 3); and a verified-cache hit still costs about 0.5 ms (existing backlog entry). All three are measured-and-deferred.

## 8. Portability

`/host` imports no `node:`, `bun:`, DOM or `require`; the portability matrix has its row (`console` only, because the bundle reaches acorn through the store). `src/preview/dependencies.ts` and `src/pack/*` are host-API-free; `loadModule` keeps the single allowed dynamic `import(` (a scan enforces it). `checkPackages` and its CLI wrapper use only Bun in the CLI. No dependency was added. **None.**

## 9. Agent authoring

Errors an agent can act on: `unknown-name` for a key outside the state schema at `/migrateState/<key>`, `unknown-name` at the `$path` for a forbidden root, `unknown-name` "does not export X" at `/manifest/dependencies/<i>` on rebinding, `forbidden-import` for any other bare specifier. **F5:** the authoring session, the MCP tools (`pack_draft`, `render_scenarios`), `<Preview>` and `liveframe gen` have no `libraries` input and generate no types for `liveframe:lib/<id>@<version>` (the demo hand-writes `widgets/libraries.d.ts`). An agent can write a `migrateState` map but cannot pack or preview a widget that imports a library. Backlog.

## 10. Docs and examples

New or updated: `docs/host.md` (new), `docs/packages.md` ("Upgrading the catalog", "Migrating state across versions", "Share components between widgets"), `docs/renderer.md` and `docs/styling.md` (two catalog majors), `docs/formats.md`, `docs/conformance.md`, `docs/migration-0.3.md`, the changelog, README, the skill references, `examples/demo-host` (server, README, widgets `queue`, `detail`, `cards`, `welcome`, `summary`, tests). This task adds the `setState` authorisation, `served` trust and double-submit rules to `docs/host.md`, spec §7.7, the changelog and the migration guide. The demo server grew from 253 to 416 lines (Task 5); it is the example outsiders copy and was left as it is.

## 11. Conformance

`storeSuite` covers pinned libraries (`loads_the_libraries_a_package_pins`, `reports_a_missing_library_as_not_found`); hash vectors cover a library and a dependent; corpus cases cover `migrateState`, library fields and `template-with-dependencies`. Plan 031's `runnerSuite` already lists "libraries (plan 030) load" in its contract cases. `rendererSuite` takes one catalog, which stays correct: multi-catalog selection is `createRenderer`'s concern and has its own eight tests. The host pipeline is library code that adopters call, not an interface they implement, so it has no adopter-run suite. **None — no gap beyond what plan 031 already carries.**

## 12. Reference hosts

- Synapta's hand-rolled orchestration (validator cache, surface builder, intent handler) is what `/host` replaces; the demo shows the shape. Recorded gaps, not bent to: **F9a** `Served` carries no manifest, so a client that compiles its own validator needs a host-kept `hash → manifest` map (Task 5); **F9b** `checkOffered` reports an unknown origin node as `not-found` at `/origin/nodeId`, the same kind a missing placement or package uses, so a host mapping error kinds to HTTP statuses must look at the pointer (Task 5). Both are backlog.
- Pending frames need a push transport; a request/response host cannot show them (the demo streams NDJSON).
- `actions` expiry and the choice of patch versus whole tree stay the host's, on purpose.
- Clay's use of `createRenderer({ catalog, implementations })` is unchanged.

## Findings and dispositions

Presented to the owner in one table on 2026-11-08; the owner chose "Authorize setState too" for F1 and accepted every recommended disposition.

| # | Finding | Area | Disposition |
| --- | --- | --- | --- |
| F1 | `setState` called `putState` without `authorize`; spec §7.7 rule 5, `docs/host.md` and the design said otherwise | Law 4, spec | **Executed**: `authorize` runs first for `setState`; a refusal returns `served` and `actions` unchanged with `intent-refused`; tests `set_state_unauthorized_writes_nothing`, and the call-order tests; spec, host guide, migration, changelog, register reason and design amended |
| F2 | A repeated crafted or forbidden action cost `loadPlacement` + `resolve` per request (the design's "one render" claim was wrong) | Law 4, performance | **Executed**: `finishRefusal` returns `served` unchanged when the recorded statuses do not change; tests `repeated_refusals_cost_no_render` and the extended `invalid_offered_action_recorded_refused_under_offered_key` |
| F3 | An action trusts `served` and reads no store; a stale frame still dispatches after a placement is replaced, deleted or disabled | Law 4 | **Executed (docs)**: `docs/host.md` "served is trusted", spec §7.7 rule 5 |
| F4 | No guard against the same action arriving twice | Interaction | **Executed (docs)**: `docs/host.md` "Double submits", spec §7.7 H9 |
| F5 | Authoring session, MCP, preview and `gen` cannot pack, preview or type a widget that imports a library | Agent authoring | **Backlog** P3 |
| F6 | `loadPlacement` does not re-check the names a dependent reads from its pinned libraries | Integrity | **Backlog** P4 |
| F7 | `migrateState` is not type-checked against the state property at install | Validation | **Backlog** P4 |
| F8 | A library `version` outside `[A-Za-z0-9._+-]` cannot be imported | Formats | **Backlog** P4 |
| F9 | `Served` carries no manifest; `not-found` serves both a client-fault origin and a host-fault missing record | Reference hosts | **Backlog** P3, two entries |
| F10 | Wall-clock gates fail under load (`verify_agent_home_under_20_ms`, `host.bench.ts` gates) and `bun run bench` never reaches the host benches | Performance, release automation | **Backlog** P3 (extends the intermittent-failure and quiet-host entries) |
| F11 | `loadLibraries` reads pins sequentially; the pending frame re-runs the widget and the resolver | Performance | **Backlog** P4 (extends the cache-hit entry) |
| F12 | `roadmap.md` §3 said "Tasks 1–6"; the plan's Compromises Made and Further Actions were empty | Docs, plan | **Executed** at plan close |
