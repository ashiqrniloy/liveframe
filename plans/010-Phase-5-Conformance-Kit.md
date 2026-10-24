# Phase 5: Conformance Kit

## Objectives

- Ship `@arnilo/liveframe/conformance` and `@arnilo/liveframe/conformance/react`: shared suites an app runs to prove that its catalog, design systems, renderer implementations and store keep the spec's contracts (spec §3, §7.4, §11, §13).
- Test only the app's side of each contract. A case belongs in the kit only when the app's input can make it fail; the library's own correctness stays in `src/__tests__/`.
- Keep the kit independent of the app's test runner, bundler and server. Suites return plain cases that any `test(name, fn, timeout)` runner registers.
- Prove every suite both ways: it passes on real subjects (both reference stores, the proof catalog, Certified, Rack and the proof host's React Aria implementations), and it fails on a deliberately broken subject.

## Expected Outcome

- `@arnilo/liveframe/conformance` (host-API-free) exports `storeSuite()`, `catalogSuite()`, `designSystemSuite()`, `ConformanceCase` and `ConformanceFailure`.
- `@arnilo/liveframe/conformance/react` (React and DOM) exports `rendererSuite()` (server cases), `rendererBrowserSuite()` (cases that drive the app's page through a Playwright `Page`) and `conformancePage()` (the in-page host the app's page entry calls).
- An app proves each part with one import of the kit for that environment and one registration loop:
  ```ts
  for (const c of storeSuite({ create: () => myPostgresStore() })) test(c.name, c.run, c.timeout);
  ```
- `memoryStore()` and `fileStore()` pass the store suite; `src/__tests__/store-contract.ts` is gone.
- The proof catalog, Certified, Rack and the proof host's implementations pass every suite. A mutant of each subject fails the case that names its broken rule.
- Every styled state, overlay lifecycle rule and text bound is covered, or the suite fails and names the missing fixture.
- `docs/conformance.md` is the outsider guide, with a compiled, tested example.

This plan implements roadmap Phase 5: the `/conformance` row of spec §13, the store suite of §7.4, and the renderer-suite obligation of §11 and `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md` (decision 5: the overlay contract is "proved by browser tests, later by conformance suites"). The scope follows the analysis presented to the owner on 2026-10-24. Task 1 records its four decisions, and the spec change they imply, before any code. Library-internal behaviour (spec §10 validator rules, the 27 recipe properties and 38 style props, forced-colour CSS, JSON Schema agreement, React factory caching and frozen intents) is already tested and is not repeated here.

**Depends on:** plans 006 (stores, `loadPlacement()`), 007 (`/css`) and 008 (`/react`) complete. The browser cases seed from plan 008's `react-browser` and `proof/tests/renderer-browser` tests.

**Not in this plan:**
- A runner suite. It stays P4 in `plans/backlog.md` ("Evaluate a conformance suite for runners") and only applies if an adopter supplies its own runner.
- An SDK suite. The backlog rules it out.
- Performance budgets. Timing gates stay internal; app timing isn't a conformance promise.
- The look bar (`proof/scripts/parity.ts`, `inventory.ts`). It measures one adopter's pixel match, not a contract.
- G29's native Windows and assistive-technology audit (Phase 6), and nested surfaces (a recorded limitation).

Probe answers that hold for every task, unless a task says otherwise:
- **Placement:**
  - `src/conformance/` holds the store, catalog and design-system suites. It is host-API-free and imports the root export, `/pack`, `/store` and `/css` internals only.
  - `src/conformance/react/` holds the renderer suites and `conformancePage()`. Like `/react` it is a React and DOM exception. Its Playwright use is a type-only import (`import type { Page, Locator } from "playwright"`), so nothing loads Playwright at runtime.
  - `src/` never imports `proof/`. Positive runs against proof implementations live in `proof/tests/`.
- **Four laws:**
  - Law 1: the page host accepts trees only. No case sends widget code to the browser.
  - Law 2: the renderer cases assert that an invalid arrival renders only the fallback and calls no implementation.
  - Law 3: the design-system suite rejects colour in the app's own sheets.
  - Law 4: renderer cases assert that an interaction raises one complete intent and nothing else. Dispatch and authorisation stay the app's.
- **Primitives only:** the kit ships no primitive implementation, design system or product component. Fixtures are app-supplied data and locators.
- **Dependencies:** no new runtime or peer dependency. `react`, `react-dom` and `playwright` are already optional peers (`package.json`); `/conformance` needs none of them.
- **Performance:** the kit is not on the render, validation or style path. Each task records its suite's wall time. Runtime modules change only to export internals to the kit, with no behaviour change.
- **Reference hosts:** Synapta proves its own store over its database with `storeSuite`. Both Synapta and Clay prove their primitives with the renderer suites. Task 9 records what each must supply (fixtures, a page entry) in "Hand adopter gaps to Synapta and Clay"; nothing bends to either.
- **Case shape:** every suite returns `ConformanceCase[]`, `{ name: string; run(): Promise<void>; timeout?: number }`. A failing case rejects with `ConformanceFailure`, an `Error` with `rule` (the case name), `spec` (the spec section it enforces) and `details` (bounded strings, or `LiveframeError[]` where the library produced them). Case names are snake_case sentences, as in this repo's tests.

## Tasks

- [x] Task 1: Record the conformance contracts and write them into the spec
  - Acceptance Criteria:
    - Functional:
      - The owner approves, or amends, these decisions. They are recorded as a new decision log through `create-decision-log`:
        1. **Runner-agnostic cases.** Suites return `ConformanceCase[]` and the app registers them with its runner's `test(name, fn, timeout)`. Bun 1.4, Vitest 5 and Jest share this signature. The kit imports no test runner and no assertion library.
        2. **Two subpaths.** `/conformance` (catalog, design-system and store suites; host-API-free) and `/conformance/react` (renderer suites and `conformancePage()`; React and DOM). A store author never installs React. The roadmap's "one test import" reads as one import of the kit per environment.
        3. **Browser model.** Browser cases run in the app's test process and drive the app's page through a Playwright `Page` the app supplies. The app's page entry calls `conformancePage({...})`, which mounts surfaces on command and records intents and renders. The kit bundles nothing and serves nothing.
        4. **Coverage fails closed.** Fixtures are app data plus app locators. A suite fails, naming what's missing, when a kind or variant has no example, or a `(kind, variant, state)` that any installed design system styles differently from rest has no state fixture. Which kinds are overlays or text inputs is the app's declaration, because the catalog doesn't mark them; the guide says so.
      - Spec §13 adds a `/conformance/react` row and adds it to the host-API exception list. §3 and §7.4 stay as written. Every other copy of that exception list is updated in the same task: `roadmap.md:28`, `.agents/skills/liveframe-execution/SKILL.md:27`, its architecture reference's subpath table, and `.agents/skills/create-plan/references/liveframe.md:27` (probe 2). Re-run `grep -rn "preview/react" --include='*.md'` to catch any added since planning; decision logs and closed plans stay as written.
      - The roadmap's Phase 5 Done reads "one test import of the kit per environment" if the owner approves decision 2.
    - Performance: n/a — no code.
    - Code Quality: the spec states each rule once, with no internal names beyond the exports.
    - Security: the decisions keep laws 1 (trees only into the page) and 4 (intents are requests) normative for the kit.
  - Approach:
    - Skills to Use:
      - `create-decision-log` — owner approval before writing the log.
      - `liveframe-execution` — the architecture and renderer references.
    - Library Documentation to Check Before Implementation:
      - Vitest v5.0.3 `test(name, body?, timeout?)` (Context7 `/vitest-dev/vitest/v5.0.3`, checked while planning). Confirm Jest's `test(name, fn, timeout)` and Bun 1.4.4's `test` the same way.
    - Documentation Reviewed:
      - Spec §3, §7.4, §11 (the overlay sentence), §13; `decision-logs/2026-10-22-1539-widget-packages-and-reference-stores.md`, `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md`.
      - `plans/backlog.md` "Seed conformance suites from the proof tests" and "Evaluate a conformance suite for runners"; `src/__tests__/portability.test.ts:5–13` (the subpath table).
      - Execution check (2026-10-24): Context7 `/oven-sh/bun/bun-v1.4.2` (newest indexed Bun 1.4; 1.4.4 unavailable) and `/jestjs/jest` confirm promise-returning test bodies and numeric third-argument timeouts in milliseconds. The earlier Vitest v5.0.3 check above supplies its signature evidence; cross-runner execution remains later work.
    - Options Considered:
      - Suites that import `bun:test` and register themselves — rejected: they tie adopters to Bun, and Clay or Synapta may test with Vitest or Jest.
      - One `/conformance` subpath that imports `/react` — rejected: ESM imports are eager, so a Postgres store author would need React installed.
      - Cases that run inside the page with an input bridge — rejected: overlay and scroll-lock checks need real wheel, key and pointer input (`proof/tests/renderer-browser.test.tsx:291–330`), which page script can't produce. A test-process `Page` reuses the seeded tests almost unchanged.
      - The kit bundling the app's page with `Bun.build` — rejected: ties the kit to Bun and to one bundler.
      - Opt-in coverage (only the fixtures the app supplies) — rejected: an app could pass by leaving inputs out.
    - Chosen Approach:
      - Present the four decisions, record the answer, then edit the spec and every copy of the exception list together.
    - API Notes and Examples:
      ```ts
      type ConformanceCase = { name: string; run(): Promise<void>; timeout?: number };
      class ConformanceFailure extends Error { rule: string; spec: string; details: readonly unknown[] }
      ```
    - Files to Create/Edit:
      - `decision-logs/2026-10-24-HHMM-conformance-kit-contracts.md`: new (time set at execution).
      - `docs/spec.md` §13; `roadmap.md` §1 and Phase 5 Done.
      - `.agents/skills/liveframe-execution/SKILL.md`, `references/architecture.md`, `references/renderer.md`; `.agents/skills/create-plan/references/liveframe.md` (§2 placement row, probe 2).
      - This plan: approved contracts and Task 1 notes.
  - Test Cases to Write:
    - n/a — documentation; run `bun run check` and `git diff --check`.
  - Notes (executed 2026-10-24):
    - The owner's instruction to complete this named task authorizes its four decisions as written. Recorded them in `decision-logs/2026-10-24-1910-conformance-kit-contracts.md`: runner-independent cases, two subpaths, an app-owned browser host and coverage that fails closed.
    - Spec §13 now defines the contracts, public suite exports and `/conformance/react` host-API exception. Synchronized roadmap Phase 5 and all active copies of the placement rules in execution/planning references. Spec §3 and §7.4 are unchanged; §11's overlay wording remains for Task 8 when its suite ships. Historical logs and closed plans were left intact.
    - Verified runner signatures through Context7 as noted above; no conformance implementation or package exports were added. Later tasks remain unchanged.
    - Validation: `timeout 600s bun run check` passed (464 tests, 0 failures; test run 111.93s; lint reported 37 warnings). `git diff --check` passed. A Bun assertion check confirmed synchronized exception lists and unchanged spec §3/§7.4.

- [x] Task 2: Ship `/conformance` with the store suite, and run both reference stores on it
  - Acceptance Criteria:
    - Functional:
      - `package.json` exports `./conformance`. `src/conformance/case.ts` holds `ConformanceCase`, `ConformanceFailure` and a small internal `check(condition, rule, spec, details)` helper.
      - `storeSuite({ create, reopen? })` returns the §7.4 cases, grown from `src/__tests__/store-contract.ts:22–99`:
        - `store_opens_empty_and_returns_undefined_for_missing_records`
        - `store_rejects_a_second_hash_for_an_existing_version` (rejects with an error whose `kind` is `version-conflict`)
        - `store_ignores_a_same_hash_put`
        - `store_copies_every_record_on_put_and_get` (packages, placements, state and styles)
        - `store_lists_placements_sorted_and_replaces_by_id`
        - `store_keeps_null_and_false_state_distinct_from_missing`
        - `store_keys_styles_by_kind_id_and_version`
        - `store_deletes_state_with_its_placement` (including an orphan state)
        - `store_records_load_through_load_placement`: a package packed by `pack()` from a self-contained kit fixture (a minimal catalog, capabilities and manifest inside `src/conformance/`, not the proof's) loads, and a state that no longer fits is reset and reported
        - `store_records_survive_reopen`, only when `reopen` is given
      - `store-memory.test.ts` and `store-file.test.ts` register the public suite. `fileStore` passes `reopen`. `store-contract.ts` is deleted; the `pkg`/`placement` fixtures `store-file.test.ts` still needs move into that file.
      - Filesystem path, atomic-write and runner tests stay internal.
    - Performance: record the suite's wall time on both stores.
    - Code Quality: the suite is one module under ~200 lines; no assertion framework, no class hierarchy.
    - Security: law 4 and "a store is not trusted": the load case proves records a store returns go through `loadPlacement()`'s checks.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (storage) and `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - none — local contracts (`Store`, `pack`, `loadPlacement`).
    - Documentation Reviewed:
      - Spec §7.4; `src/__tests__/store-contract.ts`, `store-memory.test.ts`, `store-file.test.ts:22–36` (`file_store_survives_reopen`), `store-load.test.ts:12–80`; `src/store/memory.ts:24` (the conflict error).
      - `graft callers storeContract --depth all` before deleting it.
    - Options Considered:
      - Reuse the proof's manifest fixture in the kit — rejected: the kit is published and must not carry proof data.
      - A `persistent: boolean` flag instead of `reopen` — rejected: the suite still needs a way to open the same scope again.
    - Chosen Approach:
      - Move the contract into `src/conformance/store.ts`, swap `expect` for `check`, add the load and reopen cases, then point both store tests at it.
    - API Notes and Examples:
      ```ts
      import { storeSuite } from "@arnilo/liveframe/conformance";
      for (const c of storeSuite({ create: () => fileStore(dir()), reopen: (s) => fileStore(dirOf(s)) }))
        test(c.name, c.run, c.timeout);
      ```
    - Files to Create/Edit:
      - `src/conformance/{index.ts,case.ts,store.ts,fixture.ts}`: new.
      - `package.json`: `./conformance` export.
      - `src/__tests__/{store-memory,store-file}.test.ts`: register the suite; `src/__tests__/store-contract.ts`: delete.
      - `docs/packages.md:167–169`: the link to `store-contract.ts` becomes a pointer to `storeSuite` (Task 9 adds the guide link), so no doc points at a deleted file.
      - `src/__tests__/conformance-store.test.ts`: new, the mutant stores.
      - `src/__tests__/portability.test.ts`: a `conformance` row (`dependencies: true`, through `/pack`; host `none`).
      - `src/__tests__/exports.test.ts`: the new subpath surface.
      - `.agents/skills/liveframe-execution/references/storage.md` "Today".
      - This plan: Task 2 completion and execution notes; `roadmap.md` §3: task progress.
  - Test Cases to Write:
    - `memory_store_passes_the_store_suite` and `file_store_passes_the_store_suite`: every case resolves.
    - `store_suite_catches_broken_stores`: each mutant fails its named case — a store that returns stored objects by reference, overwrites a conflicting hash, keeps state after `deletePlacement`, returns placements unsorted, or loses records on `reopen`.
    - `conformance_is_host_api_free`: the portability scan covers `src/conformance/` outside `react/`.
  - Notes (executed 2026-10-24):
    - Shipped the host-API-free public `/conformance` subpath: `storeSuite`, `ConformanceCase` and `ConformanceFailure`. The suite supplies nine independent cases, plus persistence when `reopen` is supplied; failures name the rule and spec section and bound their details. JSON comparisons ignore object-key order so database serialization order does not affect conformance.
    - Both reference-store tests now register the public cases. Removed `store-contract.ts`, moved the filesystem-only fixtures into `store-file.test.ts`, and folded its reopen test into the public persistence case. Path encoding, corruption, atomic writes, concurrent package conflicts and reader tests remain internal. Updated the package guide, export checks, portability scan and storage reference.
    - The self-contained fixture uses `pack()` with a minimal validated catalog/capabilities/manifest and inert code that throws if executed. The load case proves package verification, valid state loading, and a reported invalid-state reset without writing it back. No proof imports, new dependencies or store implementation changes.
    - Mutants fail their named cases for shared references, conflicting-hash overwrites, same-hash overwrites, retained deleted state, unsorted placements, missing-value coercion, style-key collisions, corrupted packages and lost reopen records. Additional checks cover independent/concurrent cases, async factories/reopen, adapter-error wrapping and bounded diagnostics.
    - Performance: one standalone sequential run, including fixture packing and excluding cleanup, took 48.31 ms for memory (9 cases) and 38.69 ms for filesystem (10 cases); memory ran first in the process. No render, validator or style path changed.
    - Validation: final `timeout 600s bun run check` passed (483 tests across 74 files, 0 failures; tests 102.86s). Lint retained 37 existing warnings and 3 existing informational findings; none in the new suite/tests. `git diff --check` and `timeout 120s graft build` passed. No spec change or later-task amendment was needed; other runtimes/test runners remain untested.

- [x] Task 3: Add the catalog suite
  - Acceptance Criteria:
    - Functional:
      - `catalogSuite({ catalog, capabilities, manifest, examples, published? })` returns:
        - `catalog_installs`: `validateCatalog` (which checks the vocabulary it carries) passes.
        - `capabilities_install`: `validateCapabilities` passes.
        - `manifest_installs_against_the_catalog`: `validateManifest` passes.
        - `every_kind_and_variant_has_a_valid_example`: every example tree passes `compileValidator({ catalog, capabilities, manifest })`, and together the examples use every `(kind, variant)` in the catalog. A failure lists the uncovered pairs or the validator's `LiveframeError[]`.
        - `breaking_changes_take_a_new_major_catalog_id`, only when `published` is given: if `classifyCatalogChange(published, catalog)` is `major`, the name in `catalogId` stays and the major increases. Otherwise `catalogId` is unchanged. The failure lists the classifier's reasons.
      - The same `examples` feed the renderer suites (Tasks 5–8).
    - Performance: record wall time on the proof catalog.
    - Code Quality: reuse the root exports. No second validator or classifier.
    - Security: law 2 — examples are validated data before any renderer case reads them.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (formats).
    - Library Documentation to Check Before Implementation:
      - none — local.
    - Documentation Reviewed:
      - Spec §5 ("Versioning", the `catalogId` rule), §10; `src/formats/catalog.ts:99`, `:184–289` (`classifyCatalogChange`); `src/validate/compile.ts:12–16`, `:48`; `src/__tests__/catalog.test.ts:99–104`.
    - Options Considered:
      - One example node per kind — rejected: realistic trees (scenario trees) cover kinds in context and are what the renderer cases need.
      - Re-running spec §10's rule matrix against the app's catalog — rejected: library correctness, already covered in `validator-rules.test.ts`.
    - Chosen Approach:
      - Thin cases over the install validators, plus the two checks install validation can't make: coverage and versioning.
    - API Notes and Examples:
      ```ts
      catalogSuite({ catalog, capabilities, manifest, examples: [agentHomeTree, rackModuleTree], published });
      ```
    - Files to Create/Edit:
      - `src/conformance/catalog.ts`: new; `src/conformance/index.ts`: export.
      - `src/__tests__/conformance-catalog.test.ts`: new.
      - `src/__tests__/fixtures/conformance/`: new, example trees covering the proof catalog's remaining `(kind, variant)` pairs, if the proof trees don't (tentative until coverage is measured).
      - `src/__tests__/exports.test.ts`: pin the added public export.
      - This plan: Task 3 completion and execution notes; `roadmap.md` §3: task progress.
  - Test Cases to Write:
    - `proof_catalog_passes_the_catalog_suite`: the proof catalog, capabilities, a conformance manifest and the examples pass.
    - `catalog_suite_catches_broken_catalogs`: each fails its named case — a missing variant example, an invalid example, a removed prop under the same `catalogId`, and an added optional prop with a new major id.
  - Notes (executed 2026-10-24):
    - Exported `catalogSuite` from `/conformance`: four independent cases for catalog/capabilities/manifest installation and validated example coverage, plus the catalog-version case when `published` is supplied. Cases reuse the root validators/compiler/classifier and fail with `ConformanceFailure`, preserving pointed library errors or bounded missing-pair/classifier diagnostics. Trees are validated before traversal; omitted variants count as their declared default.
    - Measured the existing proof fixtures: 22 rendered scenario trees cover 20 of 31 catalog kind/variant pairs. Added one explicit supplemental tree for the remaining 11: grid, image, link, danger button, select, checkbox, switch, danger menu item, popover, dialog and tooltip. The shared fixture exports these 23 trees with validated capabilities and a conformance manifest combining the proof widgets' state fields and declared actions, ready for Tasks 5–8. New catalog pairs are not auto-generated into fixtures and still fail coverage.
    - Mutants fail their named cases for a missing danger-button example, an invalid tree after otherwise complete coverage, malformed catalog/vocabulary and capabilities, a mismatched manifest, a removed optional prop without a major bump, and an optional prop added with an unnecessary major bump. Version tests also cover accepted compatible additions and breaking increases, changed names, unchanged/decreasing versions, malformed published catalogs, and majors beyond the safe integer range. Version comparison uses integer precision rather than floating-point coercion.
    - Performance: a standalone sequential run of all five cases against the proof catalog (23 examples, 31 pairs; fixture preparation excluded) took 38.14 ms. No runtime render, validation or style path changed; no new dependencies, proof imports into the published suite, or spec changes.
    - Validation: `timeout 600s bun run check` passed (487 tests across 75 files, 0 failures; tests 113.25s). Lint retained 37 existing warnings and 3 existing informational findings; none in the new suite/tests/fixtures. Public-export and browser-portability checks passed, as did `git diff --check` and `timeout 120s graft build`. Other runtimes/test runners remain untested; later tasks need no amendment.

- [x] Task 4: Add the design-system suite
  - Acceptance Criteria:
    - Functional:
      - `designSystemSuite({ catalog, themes, designSystems, sheets? })` returns:
        - `every_theme_installs`: `validateTheme(theme, catalog.vocabulary)` passes for each theme.
        - `every_design_system_installs`: `validateDesignSystem` passes for each, with every installed design system in the registry (completeness after the cascade, no colour outside the theme, valid `extends`).
        - `every_theme_and_design_system_projects`: `baseCss`, `themeCss` and `designSystemCss` succeed for every pair.
        - `app_sheets_set_no_colour`, only when `sheets` is given: the app's own CSS (for example its primitives' structural CSS) has no colour value — hex, functional, named or system colour — on any colour-bearing property. A failure names the sheet and the declaration.
    - Performance: record wall time on Certified and Rack.
    - Code Quality: the colour scan is one small function in `src/conformance/`. Seed it from `colour_authority_holds` (`src/__tests__/css-theme.test.ts`) without changing that test.
    - Security: law 3 and spec §6.1 — the theme is the only colour source, including in app CSS around the primitives.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (styling).
    - Library Documentation to Check Before Implementation:
      - none — local.
    - Documentation Reviewed:
      - Spec §6.1, §6.2, §6.4; `src/formats/theme.ts:77`, `src/formats/design-system.ts:102–105`, `:314`; `src/css/{base.ts:6,theme.ts:75,design-system.ts:35}`; `proof/renderer/primitives/base.ts` (`primitiveCss`, a real app sheet).
    - Options Considered:
      - Browser forced-colour and state-precedence cases — rejected: the generic forced-colour table and selector order are library CSS (spec §6.4), already covered by `css-browser.test.ts`. App-dependent state reachability is in the renderer suite (Task 7).
      - Scanning the library's projected sheets — rejected: library-guaranteed for validated input.
    - Chosen Approach:
      - Install validation across the full set (a theme and a design system validate separately, so the pairs need their own case), plus the app-sheet colour scan.
    - API Notes and Examples:
      ```ts
      designSystemSuite({ catalog, themes: [certifiedTheme, rackTheme], designSystems: [certified, rack], sheets: [primitiveCss] });
      ```
    - Files to Create/Edit:
      - `src/conformance/design-system.ts`: new; `src/conformance/index.ts`: export.
      - `src/__tests__/conformance-design-system.test.ts`: new (proof JSON fixtures).
      - `proof/tests/conformance.test.ts`: new, runs the catalog and design-system suites with `primitiveCss` as an app sheet.
      - `src/__tests__/exports.test.ts`: pin the added public export.
      - This plan: Task 4 completion and execution notes; `roadmap.md` §3: task progress.
  - Test Cases to Write:
    - `proof_styles_pass_the_design_system_suite`: Certified and Rack, both themes and `primitiveCss` pass.
    - `design_system_suite_catches_broken_styles`: each fails its named case — a theme missing a role, a design system missing a rest recipe, a design system that `extends` an uninstalled one, and an app sheet with `color: #f00` or `background: red`.
  - Notes (executed 2026-10-24):
    - Exported `designSystemSuite` from `/conformance`: independent theme-install, design-system-install and projection cases, plus the app-sheet case only when `sheets` is supplied. Cases validate the catalog and reuse the format validators and CSS projectors, preserving library errors in bounded `ConformanceFailure` diagnostics. The inheritance registry includes the whole supplied set, including parents listed after children.
    - Added proof registrations for both catalog and design-system suites using the existing conformance examples, Certified and Rack, both themes and the real `primitiveCss`. The new suite imports no proof code, test runner, assertion library, host API or new dependency. The existing library colour-authority test is unchanged.
    - Broken subjects fail for missing theme roles, missing rest recipes, missing inheritance parents, literal recipe colours and malformed installation/projection inputs. Sheet tests cover hex, functional, named and system colours in direct properties, shorthands, gradients, shadows, filters, vendor properties, custom properties and variable fallbacks, including CSS comments, escapes and mixed case. Structural declarations, strings/URLs, transparent/currentColor and theme references pass. Sheet diagnostics identify the supplied sheet index and declaration.
    - The sheet scan checks supplied CSS contents, not external `@import` targets; adopters must pass every app sheet's contents. This limit is documented in the scanner. It does not scan the library's projected sheets or add browser/state-precedence cases; those retain their existing tests and later plan tasks.
    - Performance: a standalone sequential run of all four cases against Certified and Rack, both themes and `primitiveCss` took 115.63 ms, excluding fixture preparation. No runtime render, validation or style path changed.
    - Validation: `timeout 600s bun run check` passed (500 tests across 77 files, 0 failures; tests 105.76s). Lint retained 37 existing warnings and 3 existing informational findings; none in the new suite/tests. Focused suite, public-export and browser-portability tests passed, as did `git diff --check`, the final format check and `timeout 120s graft build`. No spec change or later-task amendment was needed; other runtimes/test runners remain untested.

- [ ] Task 5: Ship `/conformance/react` with the renderer server cases
  - Acceptance Criteria:
    - Functional:
      - `package.json` exports `./conformance/react`.
      - `rendererSuite({ catalog, capabilities, manifest, implementations, themes, designSystems, examples, fallback })` returns:
        - `registry_check_passes`: `createRenderer({ catalog, implementations })` does not throw.
        - `every_example_renders_on_the_server_under_every_design_system`: `renderToString(<Surface …/>)` succeeds for every example × theme × design system, and the wrapper carries `surfaceAttributes`.
        - `every_node_carries_its_root_slot_class_and_style`: for every `(kind, variant)` in an example, the markup holds at least as many `lf_<kind>_<variant>_root` elements as nodes, and every style-prop class and inline declaration the node's style produces (`styleDeclarations`) appears.
        - `invalid_arrival_renders_only_the_fallback`: an example with an unknown kind, and one with an undeclared event, render exactly the fallback markup, and no implementation is called (the kit wraps each implementation to count calls).
    - Performance: record wall time on the proof host's implementations.
    - Code Quality: the server cases are one module. The call-counting wrapper is the only internal use of the `implement()` binding shape.
    - Security: law 2 — an invalid tree never reaches an implementation.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (renderer), `find-docs` (React 19.3 `renderToString`).
    - Library Documentation to Check Before Implementation:
      - React DOM 19.3.1 `renderToString` (Context7).
    - Documentation Reviewed:
      - Spec §11; `src/react/{renderer.tsx,implement.ts}`; `src/__tests__/react-registry.test.tsx`, `react-surface.test.tsx` (`surface_renders_slot_classes_styles_and_scope`, `invalid_tree_renders_only_the_fallback`), `react-ssr.test.tsx`; `proof/tests/fixtures/renderer.ts`.
    - Options Considered:
      - Locating nodes by a DOM node id — rejected: `<Surface>` emits no per-node attribute (`src/react/`), and adding one for tests would widen the wire-to-DOM contract.
      - Repeating the registry's missing, duplicate and mismatch rejections — rejected: library behaviour, covered by `react-registry.test.tsx`.
    - Chosen Approach:
      - Server-only checks of what the app's implementations control: rendering without throwing, and putting `slot("root")` and `style` on their root element.
    - API Notes and Examples:
      ```ts
      import { rendererSuite } from "@arnilo/liveframe/conformance/react";
      for (const c of rendererSuite({ catalog, capabilities, manifest, implementations, themes, designSystems, examples, fallback: <Unavailable /> }))
        test(c.name, c.run, c.timeout);
      ```
    - Files to Create/Edit:
      - `src/conformance/react/{index.ts,server.tsx}`: new.
      - `package.json`: `./conformance/react` export.
      - `src/__tests__/conformance-renderer.test.tsx`: new, mutants on the `react-surface` fixture renderer.
      - `proof/tests/conformance.test.ts`: add the server cases on the proof host's implementations.
      - `src/__tests__/portability.test.ts`: a `conformance/react` row (host `DOM`); `src/__tests__/exports.test.ts`.
  - Test Cases to Write:
    - `proof_implementations_pass_the_renderer_server_cases`: every case resolves under Certified and Rack.
    - `renderer_server_cases_catch_broken_implementations`: each fails its named case — an implementation that drops `slot("root")`, one that ignores `style`, one that throws for a variant, and a catalog kind with no implementation.
  - Notes (executed <date>):

- [ ] Task 6: Add the page host and the arrival, intent, survival, hydration and switching browser cases
  - Acceptance Criteria:
    - Functional:
      - `conformancePage({ catalog, capabilities, manifest, implementations, themes, designSystems, fallback })`, called from the app's page entry, inserts the projected sheets and exposes `window.liveframeConformance` with `mount(tree, styles)`, `hydrate(markup, tree, styles)`, `switch(styles)`, `intents()` and `renders()`. It accepts trees and style identities only.
      - `rendererBrowserSuite({ page, url, examples, fixtures })` returns:
        - `every_example_hydrates_without_mismatch`: server markup from `rendererSuite`'s rendering hydrates with no recoverable error, under every design system.
        - `invalid_arrival_shows_only_the_fallback_and_recovers`: an invalid tree shows only the fallback; the next valid tree renders.
        - `interactions_raise_one_complete_intent`: for each `fixtures.interactions` entry `{ tree, act(page), intents }`, acting records exactly the expected complete intents. A local interaction records none.
        - `focus_scroll_and_local_state_survive_revisions`: for `fixtures.survival` `{ tree, next, focus, scroll?, input? }`, the focused element, scroll offset and uncommitted input survive `next` (a higher revision) and a stale arrival (a lower one).
        - `switching_keeps_nodes_and_focus_and_rerenders_nothing`: a theme and design-system switch keeps the focused element and node identity, and `renders()` doesn't change.
      - Fixtures name targets with app-supplied `(page: Page) => Locator` functions.
      - The proof host's page entry calls `conformancePage`, and `proof/tests/conformance-browser.test.ts` serves and drives it under Certified and Rack.
    - Performance: record the browser suite's wall time.
    - Code Quality: the page host is one module. Cases are seeded from the named tests in the backlog entry, with proof kind names, selectors, actions and HTTP wiring replaced by fixtures.
    - Security:
      - Law 1: `conformancePage` has no code-loading entry; a test proves it rejects anything that isn't a tree.
      - Law 4: intents are recorded, never dispatched.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (renderer), `find-docs` (Playwright 1.64.1, React DOM 19.3.1 `hydrateRoot` and `onRecoverableError`).
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64.1 `Page.evaluate`, `Locator.focus`, `Locator.evaluate`, `Page.keyboard`, `Page.mouse`, `Page.emulateMedia` (Context7 `/microsoft/playwright`, newest indexed; check the installed 1.64.1 types).
      - React DOM 19.3.1 `hydrateRoot(…, { onRecoverableError })`.
    - Documentation Reviewed:
      - Spec §8, §11; `src/__tests__/react-browser.test.tsx:20–70` (the harness) and its named cases; `proof/tests/renderer-browser.test.tsx` (`local_state_focus_scroll_and_ids_survive_new_and_stale_revisions`); `proof/tests/host.test.ts` (`tier_one_stays_local_and_tier_two_preserves_focus_scroll_and_local_state`); `src/__tests__/fixtures/react-client.tsx`.
    - Options Considered:
      - A kit-provided HTML document and server — rejected by decision 3: the app owns bundling and serving.
      - Asserting focus by `document.activeElement` identity across a page reload — rejected: survival is within one page; the kit tags the element in-page before the update and checks the tag after.
    - Chosen Approach:
      - Port the harness pattern of `react-browser.test.tsx` into a page host plus test-process cases, with the app's locators in place of proof selectors.
    - API Notes and Examples:
      ```ts
      // app page entry
      conformancePage({ catalog, capabilities, manifest, implementations, themes, designSystems, fallback: <Unavailable /> });
      // app test
      for (const c of rendererBrowserSuite({ page: () => browser.newPage(), url, examples, fixtures })) test(c.name, c.run, c.timeout);
      ```
    - Files to Create/Edit:
      - `src/conformance/react/{page.tsx,browser.ts}`: new; `src/conformance/react/index.ts`: export.
      - `proof/host/conformance-client.tsx`: new page entry; `proof/tests/conformance-browser.test.ts`, `proof/tests/fixtures/conformance.ts` (fixtures and locators): new.
      - `src/__tests__/conformance-renderer-browser.test.tsx`: new, mutants on the `react-surface` fixture renderer.
  - Test Cases to Write:
    - `proof_host_passes_the_renderer_browser_cases`: every case resolves under both design systems.
    - `renderer_browser_cases_catch_broken_implementations`: each fails its named case — an implementation whose markup differs between server and client, one that emits on an undeclared event or with the wrong value type, one that keys its children by index (state lost on reorder), and one that reads the design system from context and re-renders on switch.
    - `conformance_page_accepts_trees_only`: a call with a non-tree value fails and mounts nothing.
  - Notes (executed <date>):

- [ ] Task 7: Add the state-reachability browser case
  - Acceptance Criteria:
    - Functional:
      - `every_styled_state_is_reachable`: the kit computes every `(kind, variant, state)` for which some slot's resolved recipe differs from rest in any installed design system (`resolveRecipes`, compared as the projection compares them). Each needs a `fixtures.states["kind.variant.state"]` entry `{ tree, target, drive? }`. After `drive` (default: `target.hover()` for `hover`, a mouse press held for `active`; otherwise the tree's props put the node in the state), the target root element matches the spec §6.4 selector for that state.
      - A missing entry fails and lists every missing key, so coverage fails closed (decision 4).
    - Performance: record wall time on the proof host.
    - Code Quality: the selector table is the one in `src/css/design-system.ts:15–24`, exported internally to the kit, never copied. The required set uses the same rest comparison as the projection, not a second definition.
    - Security: n/a — styling reach, no authority path; law 3 is unaffected.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (styling, renderer), `find-docs` (Playwright `Locator.hover`, `Mouse.down`, `Locator.evaluate`).
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64.1 (as Task 6). React Aria Components 1.22.1 hover, press and focus-visible data attributes (Context7), for the proof fixtures.
    - Documentation Reviewed:
      - Spec §6.4 (states and the selector table); `src/css/design-system.ts:15–90`; `src/resolve.ts:15–73`; `src/__tests__/css-browser.test.ts` (`state_precedence_follows_the_fixed_order`, root-to-slot propagation).
    - Options Considered:
      - Comparing computed styles with the recipe — rejected: given a matching element, the library's CSS is already proved (`css-browser.test.ts`). What the app controls is whether its implementation reaches the selector.
      - Requiring a fixture for every `(kind, variant, state)` — rejected: states equal to rest emit no rule (spec §6.4), so they need no proof.
    - Chosen Approach:
      - Derive the required set from the app's own design systems, drive each state, assert `element.matches(selector)` on the root.
    - API Notes and Examples:
      ```ts
      fixtures.states["button.primary.hover"] = { tree, target: (page) => page.getByRole("button", { name: "Save" }) };
      fixtures.states["button.primary.disabled"] = { tree: disabledTree, target };
      ```
    - Files to Create/Edit:
      - `src/conformance/react/states.ts`: new; `src/css/design-system.ts`: export `stateSelectors` and the rest comparison internally (no public export change).
      - `proof/tests/fixtures/conformance.ts`, `proof/tests/conformance-browser.test.ts`: state fixtures for the proof primitives.
  - Test Cases to Write:
    - `proof_host_reaches_every_styled_state`: passes under Certified and Rack.
    - `state_case_catches_unreachable_states`: fails for an implementation that never sets `data-selected`/`aria-selected`, and lists the missing keys when a fixture is removed.
  - Notes (executed <date>):

- [ ] Task 8: Add the overlay lifecycle and text-bound browser cases
  - Acceptance Criteria:
    - Functional:
      - For each `fixtures.overlays` entry `{ tree, open(page), close(page), content, backdrop, exitCss }`:
        - `overlay_keeps_surface_scope`: the open content sits inside the surface's scope element (wrapper or portal) or in the top layer with that DOM ancestry, and a backdrop ancestor has opacity 1 and no filter.
        - `overlay_exit_finishes_before_unmount`: with the app's `exitCss` injected, the overlay stays mounted while its exit animation runs and unmounts after it ends. Under reduced motion, no exit animation starts.
        - `open_overlay_locks_scroll_and_makes_background_inert`: wheeling over the page doesn't move it, the surface wrapper is inside `[inert]` or `[aria-hidden=true]`, and a pointer at a background control hits the backdrop and raises no intent.
      - For each `fixtures.textInputs` entry `{ tree, field, maxLength }`, `text_input_counts_code_points`: typing astral characters past the bound keeps exactly `maxLength` code points, in both the field and the raised intent.
      - The kit requires at least one overlay fixture when the app declares overlay kinds (`fixtures.overlayKinds`), and one text-input fixture per declared text-input kind.
      - Spec §11's overlay sentence says the renderer conformance suite proves the contract, replacing "later".
    - Performance: record wall time.
    - Code Quality: cases are seeded from `proof/tests/renderer-browser.test.tsx:237–330` and `text_field_counts_code_points` (`:654`), with proof classes and roles replaced by fixture locators. `exitCss` is app harness data, as in the proof.
    - Security: law 4 — a pointer on the inert background raises no intent.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` (renderer), `find-docs` (Playwright `Mouse.wheel`, `Page.emulateMedia({ reducedMotion })`, `Page.addStyleTag`).
    - Library Documentation to Check Before Implementation:
      - Playwright 1.64.1 (as Task 6).
    - Documentation Reviewed:
      - Spec §10 (code-point bounds), §11 (overlays); `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md` decision 5; the proof tests above.
    - Options Considered:
      - The kit detecting overlay kinds from the catalog — rejected: definitions don't mark overlays, and adding a field is a format change outside this phase. The app declares them (decision 4) and the guide says so.
      - Proving exit motion with the app's shipped recipes only — rejected: a design system with no exit motion would leave the rule untested; `exitCss` makes the lifecycle observable either way.
    - Chosen Approach:
      - Port the proof's lifecycle and code-point tests behind fixtures.
    - API Notes and Examples:
      ```ts
      fixtures.overlays = [{ tree, open: (p) => p.getByRole("button", { name: "Open" }).click(), close: (p) => p.keyboard.press("Escape"),
        content: (p) => p.getByRole("dialog"), backdrop: (p) => p.locator(".lf_dialog_default_backdrop"), exitCss }];
      ```
    - Files to Create/Edit:
      - `src/conformance/react/overlays.ts`: new; `src/conformance/react/browser.ts`: register the cases.
      - `docs/spec.md` §11: the overlay sentence.
      - `proof/tests/fixtures/conformance.ts`, `proof/tests/conformance-browser.test.ts`: overlay and text-input fixtures.
  - Test Cases to Write:
    - `proof_host_passes_the_overlay_and_text_cases`: passes under Certified and Rack.
    - `overlay_and_text_cases_catch_broken_implementations`: each fails its named case — a dialog without a modal underlay (background not inert, scroll not locked), a dialog that unmounts at once on close, and a text field bounded by native `maxlength` (UTF-16 units).
  - Notes (executed <date>):

- [ ] Task 9: Document the kit for outsiders and close the conformance backlog seed
  - Acceptance Criteria:
    - Functional:
      - `docs/conformance.md` explains, for an outsider: what each suite proves and doesn't, how to register cases with Bun, Vitest or Jest, what fixtures an app supplies, the page entry and test for the browser cases, and that overlay and text-input kinds are the app's declaration. Its examples compile and run as `src/__tests__/conformance-guide.test.ts`.
      - `docs/packages.md` (the store-suite pointer Task 2 left), `docs/renderer.md` and `docs/styling.md` link to the new guide.
      - The backlog entry "Seed conformance suites from the proof tests" is closed with a pointer to this plan. Cases deliberately left internal are listed there, with the reason.
      - "Hand adopter gaps to Synapta and Clay" lists what each adopter must supply: Synapta runs `storeSuite` on its own store, and both supply renderer fixtures and a page entry.
      - The liveframe-execution references' "Today" sections describe the kit.
    - Performance: n/a — docs.
    - Code Quality: the guide shows each API once, matching the exported types.
    - Security: the guide states that passing the kit doesn't prove isolation or authorisation (spec §14).
  - Approach:
    - Skills to Use:
      - `liveframe-execution`, `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - none — the Task 1 runner signatures.
    - Documentation Reviewed:
      - `docs/preview.md` and `src/__tests__/preview-guide.test.ts` (the tested-guide pattern); `docs/renderer.md`, `docs/packages.md`, `docs/styling.md`.
    - Options Considered:
      - Guide sections inside each existing guide — rejected: the kit spans four parts, and one page is what an adopter wiring CI reads.
    - Chosen Approach:
      - One guide, one tested example, links from the part guides.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `docs/conformance.md`, `src/__tests__/conformance-guide.test.ts`: new.
      - `docs/{packages,renderer,styling}.md`: links.
      - `plans/backlog.md`: the two entries above.
      - `.agents/skills/liveframe-execution/references/{architecture,renderer,storage,styling}.md`: "Today".
  - Test Cases to Write:
    - `conformance_guide_example_runs`: the guide's store and catalog examples run their suites on `memoryStore()` and the proof fixtures.
  - Notes (executed <date>):

- [ ] Task 10: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/010-impact-analysis.md` sweeps all twelve impact areas of the create-plan reference against what shipped, and records each one, or `None — <reason>`.
      - Every finding is presented to the owner in one table with a recommended disposition (`execute` or `backlog`), and the answer is recorded. Each `execute` finding becomes a task above this one and is executed. Each `backlog` finding goes to `plans/backlog.md` and Further Actions.
      - Known candidates to sweep:
        - the runner suite (existing P4 entry);
        - a catalog marker for overlay and text-input kinds, if fixtures proved error-prone;
        - Phase 8's use of the kit (for example `liveframe mcp` reporting conformance);
        - Phase 6's demo host running the kit from the published package;
        - suites that only Bun and Chromium have run.
      - Roadmap Phase 5 is marked complete in §3 only if every Done bullet has a passing test.
    - Performance: confirm each task's wall time was recorded.
    - Code Quality: findings name files and spans.
    - Security: confirm each law the kit enforces has a mutant that fails.
  - Approach:
    - Skills to Use:
      - `create-plan` (final task), `graft`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `plans/evidence/009-impact-analysis.md`: the format.
    - Options Considered:
      - n/a — required by the create-plan skill.
    - Chosen Approach:
      - Sweep, present, dispose.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/010-impact-analysis.md`: new.
      - `plans/backlog.md`, this plan's Compromises Made and Further Actions, `roadmap.md` §3.
  - Test Cases to Write:
    - n/a — analysis.
  - Notes (executed <date>):

## Verification (whole plan)

- `timeout 600s bunx playwright install chromium` (once per machine)
- `timeout 600s bun run check`
- `timeout 300s bun test src/__tests__/conformance- src/__tests__/store- proof/tests/conformance`
- `timeout 300s bun test proof/tests/conformance-browser.test.ts`
- `timeout 120s graft build`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
