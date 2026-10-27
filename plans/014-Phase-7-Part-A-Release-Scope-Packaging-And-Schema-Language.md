# Phase 7 Part A: Release Scope, Packaging Fixes and the Schema Language

Depends on: [plan 013](013-Phase-6-Part-B-Packaging-Demo-And-Release.md) complete (`@arnilo/liveframe@0.1.0` published). First of the seven 0.2.0 plans (014–020); [plan 020](020-Phase-7-Part-G-Release-0-2-0.md) publishes the release.

Sources: [`plans/requests/synapta-adoption-requests.md`](requests/synapta-adoption-requests.md) (LF-01 to LF-17) and [`plans/requests/clay-adoption-requests.md`](requests/clay-adoption-requests.md) (CL-01 to CL-09, plus the backlog items Clay raises). Both were moved there unchanged when these plans were written; Task 1 commits them.

## Objectives

- Record the owner's 0.2.0 scope: every LF and CL request, every backlog item the two documents raise, and LF-05 option A. Under R15 a minor release may break the public API, so the log lists each break and its migration.
- Fix the packaging bug CL-03: no `exports` condition names a file the archive does not ship.
- Fix the docs bug LF-03, and add a check that stops shipped docs calling exported APIs "planned".
- Grow the schema language (LF-04): `minLength`, `minItems`, `nullable` and discriminated unions. Cover the compiled validator, `checkValue`, `Infer`, `liveframe gen` and the published JSON Schemas.
- Ship the standard source-outcome envelope (LF-12): a `sourceOutcome()` schema helper, scenario expansion, and the documented convention.

## Expected Outcome

- `decision-logs/<date>-release-0-2-0-scope-and-breaking-changes.md` is accepted. `docs/compatibility.md` and roadmap Phase 7 describe the 0.2.0 scope and list its breaking changes.
- The packed archive's `package.json` has no `liveframe:source` condition. The archive gate fails on any `exports` target that is missing from the packed file list.
- `docs/model.md` and `docs/styling.md` describe shipped APIs as shipped, and a docs test pins it.
- A widget manifest can declare `minLength: 1`, `minItems: 1`, `nullable: true` and `{ discriminator, mapping }`. Each is rejected when malformed and checked in linear time, and each is inferred, generated and published as JSON Schema. `pattern` is still rejected in widget schemas.
- `sourceOutcome(result)` builds the envelope schema, `outcomeScenarios()` expands a scenario into one scenario per status, and `docs/formats.md` documents the convention as optional.

This plan implements roadmap Phase 7 ("collects the gaps they report and fixes them here"), spec §5 (the schema language), §13 (packaging) and §7.3 (scenarios). R15 is unchanged: 0.2.0 is a minor version, so breaking changes are allowed. It ships no release: plan 020 does. The schema-language growth is additive under `docs/compatibility.md` § Growth. Each `/1` format gains optional keywords, and documents valid under 0.1.0 keep their meaning. The formats stay `/1`, so no `$id` changes. Every later 0.2.0 plan depends on Task 1's decision log.

## Tasks

- [x] Task 1: Record the 0.2.0 scope and its breaking changes
  - Acceptance Criteria:
    - Functional:
      - An accepted decision log records the following:
        1. The owner's directive (2026-10-27) that the next release is **0.2.0**, not 0.1.1, and that it ships LF-01 to LF-17, CL-01 to CL-09 and every backlog item the two documents raise, as listed below.
        2. LF-05 option A (object-carrying events), chosen by the owner on 2026-10-27.
        3. Every breaking change, each with its migration:
           - the `Store` interface (LF-06);
           - the `<Preview>` props (CL-01);
           - capture's public home, which reopens plan 011's decision D3 (LF-02/CL-05);
           - anything later plans add.

           R15 allows breaking changes at a minor version. R15 also asks for a deprecation in an earlier release "where that is feasible": the log says, for each break, why no 0.1.x deprecation shipped first (0.1.0 is the only release).
        4. The plan map: 014 to 020, one per area, in dependency order.
        5. The `fileStore` layout. `docs/compatibility.md` promises it is stable only within 0.1.x. 0.2.0 still reads a 0.1.0 directory without an export, as § "`fileStore` layout" promises.
      - The backlog items it lists:
        - WebKit/Firefox and other-runner conformance verification;
        - placeholder and scrollbar recipe properties;
        - generated implementation types for JSON-loaded catalogs;
        - the in-process runner's module memory;
        - the git-status fixture decision;
        - G30 (icon tone), G31 (tab count slot), G29 (native forced-colours and AT audit) and G2 (Certified identity and diagnostic fill roles).
      - The two request documents in `plans/requests/` are committed.
      - `docs/compatibility.md` gains a "0.2.0" section that lists the breaking changes and links the decision. `roadmap.md` Phase 7 gains a "0.2.0 adopter-gap release" scope paragraph that names plans 014 to 020.
      - Both request documents carry a one-line note that the owner renumbered the release to 0.2.0.
    - Performance: n/a — a decision and docs only.
    - Code Quality: the decision log follows `create-decision-log`. Every break is named once, with its replacement.
    - Security:
      - No law changes. The log states that none of the 0.2.0 additions grants widget code authority (law 4) or a path to colour or CSS (law 3).
      - Ask the owner directly whether a custom `Store` that ignores scope must fail closed. The log records the answer. Recommend yes: the store suite gains a scope-isolation case.
  - Approach:
    - Skills to Use:
      - `create-decision-log`: it researches the alternatives, gets the owner's explicit approval and writes the log.
      - `karpathy-guidelines`: keep the list of breaking changes minimal and explicit.
    - Library Documentation to Check Before Implementation:
      - none. Local: `docs/compatibility.md`, and `decision-logs/2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md` R15 (line 48).
    - Documentation Reviewed:
      - Both request documents:
        - Clay's "Release target" bullet names the patch-versus-minor conflict and accepts either number, provided every item is present.
        - Synapta's "Why the targets are grouped" paragraph already calls for a minor release, because LF-06 changes the `Store` interface.
      - `docs/compatibility.md` § Versions and § Growth.
      - `roadmap.md` Phase 7.
    - Options Considered:
      - 0.1.1 with an R15 exception — rejected: the owner renumbered the release to 0.2.0, which R15 already allows.
      - Make the `Store` change additive with an optional trailing `scope` parameter — rejected as the default: a 0.1.0 store would silently ignore scope and share one viewer's state with another (fails open). The log records it as the alternative.
    - Chosen Approach:
      - One owner-approved log for the release scope and its breaking changes. Each later plan's first task logs that plan's own design choices.
    - API Notes and Examples:
      ```md
      ## 0.2.0
      Breaking: `Store.putState/getState` take a scope; `<Preview>` takes `resultScenario` and an optional controlled `selection`; capture moves to `/preview/capture`. Everything else is additive.
      ```
    - Files to Create/Edit:
      - `decision-logs/<date>-release-0-2-0-scope-and-breaking-changes.md` (new)
      - `plans/requests/synapta-adoption-requests.md`, `plans/requests/clay-adoption-requests.md` (moved from the repository root while planning; committed here)
      - `docs/compatibility.md`
      - `roadmap.md` (Phase 7 scope paragraph)
      - This plan (execution notes and task status).
  - Test Cases to Write:
    - `docs_links_resolve` (existing, `src/__tests__/docs-links.test.ts`): checks relative links in shipped docs against both the checkout and archive. The decision log is not packed, so its compatibility-doc link uses the existing GitHub URL convention; manually resolve that URL's repository path and the new roadmap, decision and request links locally.
  - Notes (executed 2026-10-27):
    - Accepted [the release-scope decision](../decision-logs/2026-10-27-2028-release-0-2-0-scope-and-breaking-changes.md): all LF-01–LF-17, CL-01–CL-09 and named backlog items, LF-05 option A, dependency map 014–020, and the three initial breaks with migrations and per-break reasons no earlier 0.1.x deprecation ships.
    - Asked the owner directly about scope isolation; answer: “Yes — require scope isolation and fail closed (recommended)”. Plan 015 must reject unsupported scopes rather than share state and prove isolation in `storeSuite`. Its existing criteria already require this handoff.
    - Updated compatibility and Phase 7 scope, added both request documents with one-line release-target overrides, and marked this plan in progress in the execution ledger. Preserved the 0.1.0 fileStore read promise; no runtime or normative spec change in this task. Later area tasks update the spec as they implement the additions and must extend the break register if they introduce another break.
    - Verification: `bun run check` passed on retry with a 900-second command limit; existing `docs_links_resolve` passed. Manually resolved all task-document links, including GitHub repository targets, and ran `git diff --check`. The initial 300-second run hit timing budgets and was interrupted by the command timeout; no test or threshold was changed.

- [ ] Task 2: Ship no `exports` condition that names a missing file (CL-03)
  - Acceptance Criteria:
    - Functional:
      - The packed archive's `package.json` carries no `liveframe:source` condition. Every `exports` target (`types`, `default`, wildcard `./schemas/*`) resolves to a packed file.
      - The archive gate fails, naming the entry, when any `exports` condition names a path missing from the packed list.
      - The checkout keeps `--conditions liveframe:source` for `bun test`, `bench` and `tsconfig.json` `customConditions`.
    - Performance: the archive gate's added step costs under 1 s.
    - Code Quality: one place strips the condition. Nothing edits `package.json` in the working tree permanently.
    - Security: n/a — packaging only. The supply-chain surface is unchanged: provenance and trusted publishing are untouched.
  - Approach:
    - Skills to Use:
      - `find-docs`: check how `bun pm pack` (Bun 1.4.2) and `npm publish` (npm ≥ 11.5.1) run the `prepack` and `postpack` lifecycle scripts, and whether `npm publish <dir>` keeps provenance.
      - `surgical-patch`: the narrowest fix.
    - Library Documentation to Check Before Implementation:
      - Bun `pm pack` lifecycle scripts; npm `publish` lifecycle and folder publishing; TypeScript 7 `customConditions`.
    - Documentation Reviewed:
      - `package.json` `exports` (38–118), `files` and the `test`/`bench` scripts.
      - `tsconfig.json:7`.
      - `scripts/release/archive-gate.ts:60-72` (`bun pm pack`).
      - `.github/workflows/publish.yml:49`.
      - Spec §13: "No `.ts` or `.tsx` sources".
    - Options Considered:
      - Ship `src/` — rejected: spec §13 forbids sources in the archive.
      - Drop the condition and test against `dist/` — rejected: `bun test` would need a build first, and declarations lag edits during development.
      - A `prepack`/`postpack` pair that rewrites and restores `package.json` — viable if both packers run it. It leaves a dirty tree if packing crashes.
      - Pack from a staging directory that holds a stripped `package.json` — viable, and never mutates the checkout.
    - Chosen Approach:
      - Use the staging directory if `npm publish <dir>` keeps provenance, otherwise the lifecycle pair. Record the documentation evidence in the task notes. Either way, the gate's new check is the guarantee.
    - API Notes and Examples:
      ```ts
      // scripts/release/archive-gate.ts — new step
      step("every exports target is packed", () => assertExportsPacked(manifest.exports, packedFiles));
      ```
    - Files to Create/Edit:
      - `scripts/release/publish-manifest.ts` (new): writes the stripped manifest.
      - `scripts/release/archive-gate.ts`
      - `.github/workflows/publish.yml` (only if the staging directory is chosen)
      - `package.json` (scripts only)
      - `CHANGELOG.md` (Unreleased: Fixed)
  - Test Cases to Write:
    - `exports_targets_are_packed` (archive gate step): fails if a deliberately added bogus condition survives packing.
    - `published_manifest_has_no_source_condition` (`src/__tests__/archive.test.ts`): runs the strip function on the real `package.json`. Fails if any condition still names `./src/`.

- [ ] Task 3: Describe shipped APIs as shipped (LF-03)
  - Acceptance Criteria:
    - Functional:
      - `docs/model.md` A2 says `implement(definition, Component)` binds the primitive.
      - Sweep every shipped doc (`docs/*.md`, `README.md`) for "planned", "will", "remains planned" or "not yet" next to an exported name, and fix each. This includes the `docs/styling.md` sentence Clay quotes, if it is still present.
      - A docs test fails when "planned" appears within the same sentence as any name exported from a public subpath.
    - Performance: the test runs in under 200 ms.
    - Code Quality: the test derives the exported names from the real subpath modules, not from a hand list.
    - Security: n/a — docs only.
  - Approach:
    - Skills to Use:
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - none. Local: `src/__tests__/docs-links.test.ts` and `src/__tests__/exports.test.ts`, the patterns to reuse.
    - Documentation Reviewed:
      - `docs/model.md:42`.
      - `grep -rn 'planned' docs README.md` (only `model.md:42` at survey time). `docs/spec.md` is excluded: it is the normative design and legitimately says "planned" for future work.
    - Options Considered:
      - A CI grep — rejected: the existing docs tests run inside `bun run check`, and a TypeScript test can read the export names.
    - Chosen Approach:
      - Add a `shipped_docs_never_call_exports_planned` case beside `docs-links`.
    - API Notes and Examples:
      ```ts
      for (const sentence of sentences(doc)) if (/\bplanned\b/i.test(sentence) && exported.some((name) => sentence.includes(name))) fail(doc, sentence);
      ```
    - Files to Create/Edit:
      - `docs/model.md`; `docs/styling.md` (if hit); other hits
      - `src/__tests__/docs-wording.test.ts` (new)
  - Test Cases to Write:
    - `shipped_docs_never_call_exports_planned`: fails on the current `model.md:42` before the fix.

- [ ] Task 4: Add `minLength` and `minItems` to the schema language (LF-04)
  - Acceptance Criteria:
    - Functional:
      - `string` takes an optional `minLength` (code points, integer, 0 ≤ `minLength` ≤ `maxLength`). `array` takes an optional `minItems` (0 ≤ `minItems` ≤ `maxItems`).
      - `minLength > maxLength` or `minItems > maxItems` is rejected at install as `invalid-document` at the keyword's pointer.
      - Both keywords are allowed in widget schemas (`params`, `state`, `context`). `pattern` is still rejected there.
      - A value that is too short or too few fails, with an `expected` that names the bound ("a string of 1–500 characters").
      - `checkValue`, the compiled validator, `liveframe gen` and the published JSON Schemas agree.
      - Catalog change classification treats raising a minimum as narrowing (a major change) and lowering it as widening.
    - Performance:
      - `bun run bench` keeps the validator at ≤ 1.5 µs/node on the 679-node tree and `render()` at ≤ 3 µs/node.
      - The checks are O(length): code points are counted once, with no regex.
    - Code Quality: the keywords sit beside `maxLength`/`maxItems` in `src/schema.ts` and `src/validate/schema.ts`, with no new module.
    - Security: law 2. A malformed bound fails closed at install, and there is still no ReDoS surface.
  - Approach:
    - Skills to Use:
      - `liveframe-execution`: the format chore checklist.
      - `typescript-advanced-types`: `Infer` stays unchanged for these keywords; check that the type-level tests still hold.
    - Library Documentation to Check Before Implementation:
      - JSON Schema 2020-12 validation vocabulary (`minLength` counts code points; `minItems`); RFC 8927 has no length keywords. Record both.
    - Documentation Reviewed:
      - Spec §5 "The schema language".
      - `src/schema.ts:4-24` (types), `:100-105` (`codePointsWithin`), `:147-203` (keyword well-formedness), `:226-242` (`checkString`/`checkArray`).
      - `src/validate/schema.ts:84-151` (`compileSchema`).
      - `src/formats/catalog.ts:210-230` (`compareStringSchema`/`compareArraySchema`).
      - `src/formats/manifest.ts:89-101` (`rejectPatterns`).
      - `scripts/schemas.ts`.
    - Options Considered:
      - Allow `pattern` in widget schemas with a safe-regex subset — rejected: spec §5 bans it for a measured reason, and length bounds cover the non-empty case.
    - Chosen Approach:
      - Optional keywords with install-time ordering checks. Lengths are counted the same way as `maxLength`.
    - API Notes and Examples:
      ```ts
      str({ minLength: 1, maxLength: 500 }); arr(item, { minItems: 1, maxItems: 50 });
      ```
    - Files to Create/Edit:
      - `src/schema.ts`; `src/validate/schema.ts`; `src/formats/catalog.ts` (compare)
      - `scripts/schemas.ts`; `schemas/*.json` (regenerated)
      - `src/sdk/gen.ts` (only if generated docs comments print bounds)
      - `docs/spec.md` §5; `docs/formats.md`
  - Test Cases to Write:
    - `min_length_counts_code_points` (`schema.test.ts`): `"😀"` meets `minLength: 1` and fails `minLength: 2`. Fails if UTF-16 units are counted.
    - `min_above_max_is_rejected`: both keywords, with the pointer at the keyword.
    - `compiled_and_interpreted_agree_on_minimums` (`compiled-schema.test.ts`).
    - `widget_schema_accepts_min_length_rejects_pattern` (`manifest.test.ts`).
    - `published_schema_accepts_min_keywords` (`schemas.test.ts`, Ajv).
    - `raising_min_length_is_major` (`catalog.test.ts`).

- [ ] Task 5: Add `nullable` to every schema form (LF-04)
  - Acceptance Criteria:
    - Functional:
      - Any form may carry `nullable: true`. `null` then passes, and every other value is checked by the form.
      - `nullable` that is not a boolean is rejected. `nullable: false` is the same as omitting it.
      - `Infer<S>` gives `T | null`.
      - `liveframe gen` prints `| null`.
      - The published JSON Schema expresses it as `anyOf: [<form>, { type: "null" }]` or a type array. The task notes record which, and why Ajv strict mode accepts it.
      - Making a prop nullable is a minor catalog change; removing `nullable` is major.
    - Performance: one extra `=== null` branch per nullable check. The benches hold their budgets.
    - Code Quality: no separate "nullable form". It is an annotation-like keyword handled in one place in each checker.
    - Security: law 2 — a manifest state of `null` is accepted only where declared.
  - Approach:
    - Skills to Use:
      - `typescript-advanced-types`: `Infer` for nullable, conditional on the literal `true`.
    - Library Documentation to Check Before Implementation:
      - RFC 8927 §2.2.1 (`nullable`); JSON Schema 2020-12 `type` arrays; Ajv 8 strict mode with `anyOf` and `type` unions.
    - Documentation Reviewed:
      - `src/schema.ts:28-42` (`Infer`), `:139-144` (`hasValidAnnotations`).
      - `src/sdk/gen.ts`.
      - `src/__tests__/sdk-gen-types.test.tsx`.
    - Options Considered:
      - A general `anyOf` — rejected by LF-04: it costs more and gives agents worse errors.
    - Chosen Approach:
      - The RFC 8927 keyword, as LF-04 proposes.
    - API Notes and Examples:
      ```ts
      str({ maxLength: 128, nullable: true }) // Infer → string | null
      ```
    - Files to Create/Edit:
      - `src/schema.ts`; `src/validate/schema.ts`; `src/formats/catalog.ts`
      - `src/sdk/gen.ts`; `src/__tests__/fixtures/widgets/ui.gen.ts` (regenerated)
      - `scripts/schemas.ts`; `schemas/*.json`
      - `docs/spec.md` §5; `docs/formats.md`; `docs/sdk.md`
  - Test Cases to Write:
    - `nullable_accepts_null_only_when_declared`.
    - `nullable_must_be_boolean`.
    - `infer_nullable_is_union` (type-level, `sdk-types.test.tsx`): assigning `null` to a non-nullable prop fails to compile.
    - `gen_prints_nullable`.
    - `published_schema_nullable_roundtrip` (Ajv).

- [ ] Task 6: Add discriminated unions to the schema language (LF-04)
  - Acceptance Criteria:
    - Functional:
      - `{ discriminator: "<prop>", mapping: { "<tag>": ObjectSchema, … } }` is a schema form.
      - Each mapping entry is a closed object that does not declare the tag property. Tags are bounded strings (≤ 64 code points) with 1–64 entries.
      - Install rejects: a mapping entry that declares the tag property, a non-object entry, an empty mapping, and a non-string tag.
      - A value with a missing or unknown tag fails at `<pointer>/<prop>`, with `expected` listing the tags. A value with a known tag is checked against that entry only, with errors rooted at the value.
      - `Infer` gives a tagged union. `liveframe gen` prints it.
      - The published JSON Schema uses `oneOf` with a `const` per tag. Ajv validates the same documents as the compiled validator on a shared fixture set.
      - Catalog classification: adding a tag is minor; removing or narrowing one is major.
    - Performance: the tag lookup is O(1) through a precompiled `Map`. The 679-node bench holds ≤ 1.5 µs/node. A new micro-bench case records a 500-element mixed feed.
    - Code Quality: the union compiles to a `Map<tag, ObjectCheck>`, reusing `objectCheck` (`src/validate/schema.ts:65-82`), with no new interpreter.
    - Security: law 2 — an unknown tag fails closed. A value never falls through to another mapping entry.
  - Approach:
    - Skills to Use:
      - `typescript-advanced-types`: a mapped tagged union over `mapping`.
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - RFC 8927 §2.2.8 (discriminator); JSON Schema 2020-12 `oneOf`/`const`; Ajv 8 `discriminator` option (record whether it is used).
    - Documentation Reviewed:
      - `src/schema.ts:19-26` (form union), `:117-130` (`isLanguageSchema`).
      - `src/validate/schema.ts:65-151`.
      - `src/formats/catalog.ts:246-257` (`compareSchemas`).
    - Options Considered:
      - General `oneOf`/`anyOf` — rejected: worse errors and O(n) branch trials.
      - Allowing the tag inside each mapping entry — rejected: RFC 8927 forbids it, and it creates two sources of truth.
    - Chosen Approach:
      - RFC 8927's form.
    - API Notes and Examples:
      ```ts
      union("kind", { task: obj({ title: str({ maxLength: 200 }) }), alert: obj({ level: str({ maxLength: 8, enum: ["info", "error"] }) }) })
      // Infer → { kind: "task"; title: string } | { kind: "alert"; level: "info" | "error" }
      ```
    - Files to Create/Edit:
      - `src/schema.ts` (form, `union()` builder, `Infer`, `checkValue`); `src/validate/schema.ts`; `src/formats/catalog.ts`
      - `src/index.ts` (export `union`); `src/sdk/gen.ts`
      - `scripts/schemas.ts`; `schemas/*.json`
      - `bench/validator.bench.ts` (feed case)
      - `docs/spec.md` §5; `docs/formats.md`; `docs/sdk.md`
      - `src/__tests__/exports.test.ts`
  - Test Cases to Write:
    - `union_rejects_tag_in_mapping`, `union_rejects_empty_mapping`.
    - `union_unknown_tag_fails_at_tag_pointer`.
    - `union_checks_only_selected_entry`.
    - `infer_union_is_tagged` (type-level): accessing `level` without narrowing fails to compile.
    - `published_union_matches_compiled` (Ajv, shared fixtures).
    - `adding_tag_is_minor_removing_is_major`.

- [ ] Task 7: Ship the source-outcome envelope (LF-12)
  - Acceptance Criteria:
    - Functional:
      - `sourceOutcome(result)` returns a discriminated-union schema: `ok` → `{ value, checkedAt? }`, and `unauthorized|unavailable|stale|failed` → `{ reason?, value? }`. `reason` is bounded (≤ 500 code points). `checkedAt` is a bounded string.
      - Its output passes `isLanguageSchema` and the published capabilities schema.
      - `outcomeScenarios(scenario, { source })` returns one scenario per status, named `<scenario>.<status>`, with that source's data replaced by a minimal valid envelope. It returns typed errors if the source is undeclared or not built by `sourceOutcome`.
      - A preview-session test renders the generated scenarios through `check()`.
      - `docs/formats.md` documents the envelope as an optional convention.
    - Performance: n/a — install-time helpers. They are pure and deterministic.
    - Code Quality: `sourceOutcome` sits in the root export beside the schema builders; `outcomeScenarios` sits in `/pack` with the scenario format. Neither is product-shaped: statuses are generic.
    - Security: law 4 — the envelope describes outcomes the host resolved; it grants nothing. Law 2 — generated scenarios still pass `pack()`'s scenario checks.
  - Approach:
    - Skills to Use:
      - `lean-build`: a helper, not a framework.
    - Library Documentation to Check Before Implementation:
      - none. Local: `src/pack/pack.ts` (scenario validation) and `src/preview/session.ts:13-138` (`check()`).
    - Documentation Reviewed:
      - LF-12 (Synapta resolver shape).
      - `src/__tests__/fixtures/widgets/core-queue/widget.tsx` (`data.status`, invented by the proof).
    - Options Considered:
      - A format change that adds an envelope to capabilities — rejected: LF-12 says no format change is needed once LF-04 lands.
      - MCP auto-expansion — deferred to the authoring library (plan 018), which calls `outcomeScenarios`. Recorded there.
    - Chosen Approach:
      - Two pure helpers and docs.
    - API Notes and Examples:
      ```ts
      sources: { queue: { params, result: sourceOutcome(arr(row, { maxItems: 50 })) } }
      outcomeScenarios(scenarios[0], { source: "queue" }) // → [..."full.unauthorized", "full.stale", …]
      ```
    - Files to Create/Edit:
      - `src/schema.ts` or `src/formats/outcome.ts` (new; tentative — keep it beside `union` if it is under 30 lines)
      - `src/index.ts`; `src/pack/index.ts`; `src/pack/outcome.ts` (new)
      - `src/__tests__/exports.test.ts`
      - `docs/formats.md`; `docs/packages.md`; `docs/spec.md` §7.3 (one sentence on optional expansion)
  - Test Cases to Write:
    - `source_outcome_is_language_schema`.
    - `outcome_scenarios_one_per_status`.
    - `outcome_scenarios_reject_unknown_source`.
    - `preview_checks_generated_outcomes` (`preview-session.test.ts`).

- [ ] Task 8: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/014-impact-analysis.md` records all 12 impact areas against the delivered work.
      - Findings are presented to the owner in one table with recommended dispositions. `execute` items become tasks above this one; `backlog` items go to `plans/backlog.md` and Further Actions.
    - Performance: record the final bench numbers.
    - Code Quality: n/a.
    - Security: re-check that widget schemas still carry no `pattern`, and that no new keyword introduces super-linear checks.
  - Approach:
    - Skills to Use:
      - `create-plan` (final-task rules); `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - Impact areas in `.claude/skills/create-plan/references/liveframe.md` §5.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - The standard sweep.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/014-impact-analysis.md` (new); `plans/backlog.md` (if needed); this plan.
  - Test Cases to Write:
    - None.

## Verification (whole plan)
- `bun run check`
- `bun run bench`
- `bun run release:gate`
- `bun src/cli/liveframe.ts gen src/__tests__/fixtures/proof/catalog.json --out src/__tests__/fixtures/widgets/ui.gen.ts --check`

## Compromises Made
- To be filled after tasks are completed and tests pass.

## Further Actions
- To be filled after task completion with improvements, rationale, and priority.
