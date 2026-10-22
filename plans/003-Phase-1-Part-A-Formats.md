# Phase 1 Part A: Formats, Install-Time Validation and the Recipe Resolver

## Objectives

- Build the root export's contracts for every trust boundary in spec §5–§10: the schema language, the vocabulary, definitions and catalog, capabilities, the manifest, the theme, the design system, the UI tree and intents, and the shared error format.
- Validate every format on install with typed, bounded errors, and resolve design-system recipes into the flat table the CSS projection reads.
- Prove the formats are sufficient by expressing the Phase 0 proof in them.

## Expected Outcome

- `@arnilo/liveframe` exports:
  - the schema-language builders and `Infer<>`;
  - one TS type and one `validate…()` per format;
  - `classifyCatalogChange()` and `resolveRecipes()`;
  - the `LiveframeError` type.
- `schemas/*.json` holds a JSON Schema 2020-12 document per format, exported as `@arnilo/liveframe/schemas/<format>.json`. A test fails when a file drifts from its source.
- `src/__tests__/fixtures/proof/` holds the proof's catalog, vocabulary, capabilities, agent-home manifest, both themes and both design systems in the new formats, plus the trees Part B benchmarks. All of them validate, and the resolved recipes equal the proof's.
- `docs/formats.md` explains every format to an outsider, with an example of each.
- `bun run check` is green after every task.

This plan implements roadmap Phase 1 Part A: spec §5 (definitions, schema language, catalog, versioning), §6.1, §6.2 and §6.5 (theme, design system, vocabulary), §7.1 (capabilities, manifest), §9 (tree and intent types) and §10's install-time validation, under `decision-logs/2026-10-22-1905-phase-1-format-scope.md`. The spec already holds every decision; no task here changes its meaning, except Task 1, which writes the install-time error kinds into §10.

**Not in this plan:**
- The compiled tree validator and the 1.5 µs-per-node gate are Part B (`plans/004-Phase-1-Part-B-Compiled-Validator.md`), which depends on this plan.
- `render()` and the JSX runtime are Phase 2 Part A.
- The CSS projection is Phase 3, and it consumes `resolveRecipes()` output.
- Package, scenario and record formats are Phase 2 Part B. They reuse Task 1's schema language.

**Dependency:** plan 002 Task 9 (Phase 0 impact analysis) closes before this plan starts (`roadmap.md` §3).

Probe answers that hold for every task, unless a task says otherwise:
- **Placement:** `src/` root export only. Nothing here imports a host API (`node:`, `bun:`, DOM, `require`), `eval` or the `Function` constructor. Task 1's portability test enforces this. `src/` never imports `proof/`, while `proof/scripts/` may import `src/` (Task 8).
- **Four laws:** formats carry law 2 (validated data) and law 3 (colour only from the theme, no raw CSS). No task runs widget code (law 1) or grants authority (law 4): capabilities describe, the host authorises.
- **Primitives only:** the library ships no catalog. The only catalog is the proof fixture, under `src/__tests__/fixtures/`.
- **Dependencies:** one new **dev** dependency, `ajv@^8.20.0` (Task 1), used only by tests as an independent JSON Schema oracle. No runtime dependency.
- **Performance:** install-time only. Each validator states a non-regression bound on the proof fixtures, measured in its test. The render path is untouched until Part B.
- **Docs:** each task adds its format's section to `docs/formats.md`, written for outsiders.
- **Reference hosts:** any proof value a format cannot express is a finding. Record it in `plans/evidence/003-findings.md` and stop that task; never widen a format to fit one host.
- **Callers:** `src/index.ts` exports only `LIVEFRAME_FORMAT` today (`src/index.ts:2`), and its sole caller is `src/__tests__/index.test.ts`. No renames are planned.

Library documentation used throughout:
- **JSON Schema 2020-12** through Ajv 8.20.0's `Ajv2020` class (`ajv/dist/2020`), Context7 `/ajv-validator/ajv`, `lib/2020.ts`. Strict mode stays on.
- **DTCG Design Tokens 2025.10** (Context7 `/websites/designtokens_tr_2025_10`), `format` and `color` modules:
  - colour `{colorSpace, components, alpha?, hex?}`, with 14 colour spaces;
  - `dimension` in `px` or `rem`;
  - `duration` in `ms` or `s`;
  - `cubicBezier`, `shadow` and the `typography` composite.

## Tasks

- [x] Task 1: Build the schema language, the error format and the schema publishing path
  - Acceptance Criteria:
    - Functional:
      - Builders `str`, `num`, `int`, `bool`, `arr` and `obj` produce plain JSON Schema 2020-12 objects in the spec §5 language. `Infer<typeof s>` gives the readonly TS type.
      - `checkValue(schema, value)` is the generic interpreter: install-time checks and Part B's comparison baseline. It returns every error up to a bound (default 20).
      - `isLanguageSchema(json)` rejects any schema outside the language. That includes:
        - a string without `maxLength`, or an array without `maxItems`;
        - `additionalProperties` other than `false`;
        - an unknown keyword or `$ref`;
        - a non-string enum;
        - a `pattern` that fails to compile or is over 256 characters.
      - `maxLength` counts code points. When `value.length <= maxLength` the count is skipped, since the code-point count can never exceed the UTF-16 length.
      - `LiveframeError` is `{ kind, pointer, message, expected?, nodeId? }`. Its install-time kinds are `invalid-document`, `unknown-name`, `incomplete-design-system`, `colour-outside-theme`, `catalog-mismatch` and `cyclic-extends`, added to spec §10 in this task. Every validator returns `{ ok: true, value } | { ok: false, errors }`.
      - Publishing: `scripts/schemas.ts` writes each registered format's JSON Schema to `schemas/<format>.json`, with `$schema` and `$id`. `package.json` gains the export `"./schemas/*": "./schemas/*"`. This task registers `schema-language.json`, the meta-schema of the language itself.
    - Performance: `checkValue` on a 1,000-property object with mixed forms takes under 5 ms in the test, as an install-time sanity bound.
    - Code Quality:
      - One module, `src/schema.ts`, with no class hierarchy.
      - The `Infer<>` type follows the proof's `SchemaValue` precedent (`proof/runtime/types.ts`).
      - Type-level tests use `// @ts-expect-error`, so `bun run typecheck` fails if a wrong value type-checks.
    - Security:
      - Law 2: an out-of-language schema is rejected, so no app or author can smuggle unbounded data.
      - The portability test fails closed on any host API, `eval` or `Function` in non-test `src/` files.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/formats.md`.
      - `typescript-advanced-types` — `Infer<>` over the builders.
      - `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - Ajv 8.20.0: `Ajv2020`, strict mode, and `unicodeRegExp: true`; code-point string length is built in (there is no `unicode` option), verified via `find-docs` against `/ajv-validator/ajv`.
    - Documentation Reviewed:
      - Spec §5 "The schema language", spec §10 "Errors".
      - `proof/catalog/define.ts:2–17` (`PropSchema`).
      - `proof/runtime/validate.ts` (`checkSchema`, which builds `new RegExp` per call and spreads each string).
      - RFC 8927 forms via the Ajv JTD docs.
    - Options Considered:
      - TypeBox or Zod as the source: rejected by the decision log (alternative 8). It adds a runtime dependency, and Zod is code rather than data.
      - JTD instead of a JSON Schema subset: rejected. JTD has no `maxLength`, `maxItems` or numeric bounds, and the spec mandates JSON Schema.
      - Ajv at runtime: rejected. It compiles with the `Function` constructor, and it would be a heavy runtime dependency.
    - Chosen Approach:
      - Small builders whose output *is* the JSON Schema object, so the type, the runtime value and the published file have one source.
      - Ajv is a test oracle only.
      - The format documents themselves need two forms the public language excludes: a bounded record keyed by name pattern, and a constant. They are internal builders (`record`, `literal`) that `isLanguageSchema` rejects.
    - API Notes and Examples:
      ```ts
      const Label = str({ maxLength: 80, description: "Visible text." });
      const Args = obj({ id: str({ maxLength: 128 }) }, { reason: str({ maxLength: 500 }) }); // required, optional
      type ArgsValue = Infer<typeof Args>; // { readonly id: string; readonly reason?: string }
      checkValue(Args, { id: "t-1", extra: 1 }); // { ok: false, errors: [{ kind: "invalid-document", pointer: "/extra", … }] }
      ```
    - Files to Create/Edit:
      - `src/schema.ts`: new.
      - `src/errors.ts`: new. `LiveframeError` and the `Result` type.
      - `src/formats/registry.ts`: new. Format name → schema, read by the publisher and the drift test.
      - `scripts/schemas.ts`: new. Writes `schemas/`; `--check` exits non-zero on drift.
      - `schemas/schema-language.json`: generated.
      - `src/index.ts`: export the builders, `Infer`, `checkValue`, `isLanguageSchema`, `LiveframeError`.
      - `package.json`: dev dependency `ajv`, the `./schemas/*` export, `"files"` to include `schemas`.
      - `docs/formats.md`: new. Introduction and the schema language.
      - `docs/spec.md` §10: the install-time error kinds.
      - `src/__tests__/schema.test.ts`, `src/__tests__/portability.test.ts`, `src/__tests__/schemas.test.ts`: new.
  - Test Cases to Write:
    - `language_rejects_unbounded_and_open_schemas`: a missing `maxLength`, a missing `maxItems`, an open object, `$ref`, a numeric enum and a bad pattern are each rejected. Fails if any rule is dropped.
    - `check_value_agrees_with_ajv`: a seeded corpus of 500 schema and value pairs gets the same accept/reject from `checkValue` and `Ajv2020` (with `unicodeRegExp: true` and built-in code-point string length). Fails on any semantic drift from JSON Schema.
    - `max_length_counts_code_points`: `"👍👍"` passes `maxLength: 2` and fails `maxLength: 1`. Fails if UTF-16 units are counted.
    - `errors_are_bounded_and_pointed`: an object with 30 bad fields yields exactly 20 errors, each with a JSON Pointer. Fails if collection stops at the first error or never stops.
    - `infer_types_match_schemas`: type-level only. A wrong value under `@ts-expect-error` must error, or typecheck fails.
    - `published_schemas_match_sources`: each registered format, regenerated in memory, equals its `schemas/` file, and Ajv compiles it in strict mode. Fails on drift or an invalid schema.
    - `src_is_host_api_free`: scans non-test `src/**/*.ts` for `node:`, `bun:`, `require(`, `document.`, `window.`, `eval(` and `Function(`. Fails on any hit.
  - Notes (executed 2026-10-22):
    - Added all six JSON Schema builders, readonly `Infer<>`, fail-closed language checking, and the bounded interpreter. Tests cover Unicode code points and patterns, escaped JSON Pointers, nested and optional values, prototype-like keys, cyclic schema rejection, required/optional overlap, and untrusted schema narrowing.
    - Added `LiveframeError` and `Result`, the root exports, Ajv 8.20.0 as a dev dependency, `schemas/schema-language.json`, the format registry, and `scripts/schemas.ts` with `--check`. The package exports and includes schema files. Drift tests prove changed and unregistered files fail without modifying the working copy.
    - Added `docs/formats.md` and updated spec §10 with the agreed install-time error kinds, optional `nodeId`, document pointers and the shared result shape. No additional design decision was needed.
    - Verified Ajv's current documentation through Context7: code-point length is built in, and Unicode patterns use `unicodeRegExp: true`, rather than the plan's nonexistent `unicode` option. The published meta-schema covers structure; `isLanguageSchema` additionally checks required-name membership. JSON Schema cannot express that cross-field relationship without extensions.
    - Validation: `timeout 300s bun run check` passed (91 tests, including the browser proof tests); the 500-pair Ajv comparison and the 1,000-property / 5 ms sanity gate passed. `timeout 20s bun scripts/schemas.ts --check` passed. Core portability is scanned and browser bundling passes. Refreshed graft after the additions.
    - Scope: executed only Task 1 as explicitly requested. The existing Plan 002 Task 9 impact report is present, but its checkbox and roadmap status remain a separate task; no proof files or its findings were changed here.
    - Commit scope: the pre-existing untracked spec and plan, and the already modified roadmap, were updated in place and left unstaged to avoid committing earlier documentation work. The task's implementation, new format documentation, generated schema and dependency changes are committed separately.

- [x] Task 2: Define the vocabulary format and its validator
  - Acceptance Criteria:
    - Functional:
      - The `Vocabulary` type and schema follow spec §6.5. `validateVocabulary(doc)` checks that:
        - names match `^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$`, are at most 64 characters, and are unique within each list;
        - each list holds at most 256 names;
        - `surfaceRoles` and `fillableRoles` are subsets of `colourRoles`;
        - every tone maps to a declared colour role;
        - `space`, `radius`, `size` and `breakpoints` names use their family prefix (`space.`, `radius.`, `size.`, `bp.`).
      - Errors are `invalid-document` or `unknown-name`, each with a pointer.
    - Performance: the proof vocabulary validates in under 1 ms in the test.
    - Code Quality: the library-fixed lists (states, style props, `semantics` values, recipe properties) live in `src/formats/fixed.ts` as `as const` arrays. They are moved from `proof/styles/types.ts` and `proof/catalog/define.ts`, not imported from them.
    - Security: law 3. Only declared roles can later carry colour. A tone that maps to an undeclared role is rejected.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/styling.md`.
    - Library Documentation to Check Before Implementation:
      - None. This is a local format.
    - Documentation Reviewed:
      - Spec §6.5.
      - `proof/styles/types.ts:5–70` (roles) and `:112–117` (`valueNames`).
      - `proof/css/project.ts:322` (the tone map that moves into the vocabulary).
      - Adaptive Cards `HostConfig.md`: named scales under fixed categories.
    - Options Considered:
      - Prefix rules instead of explicit subsets for surface and fillable roles (`surface.*`): rejected. The proof's `colourRoles.filter(startsWith("surface."))` is an implicit convention, and explicit subsets are closed data.
    - Chosen Approach:
      - One closed document embedded in the catalog (Task 3). Validated alone so themes and design systems can be checked against it.
    - API Notes and Examples:
      ```ts
      validateVocabulary({ colourRoles: ["surface.base", "text.muted"], surfaceRoles: ["surface.base"], fillableRoles: [],
        tones: { muted: "text.muted" }, typographyRoles: ["body"], space: ["space.1"], radius: [], size: [], breakpoints: [] });
      ```
    - Files to Create/Edit:
      - `src/formats/fixed.ts`: new.
      - `src/formats/vocabulary.ts`: new.
      - `src/formats/registry.ts`: no standalone registration in Task 2. Task 3 embeds the exported `vocabularySchema` in `catalog.json`'s `$defs` and registers that document.
      - `src/index.ts`: exports.
      - `docs/formats.md`: Vocabulary section.
      - `src/__tests__/vocabulary.test.ts`: new.
      - `src/__tests__/fixtures/vocabulary.json`: snapshot of the proof vocabulary for the performance check; the complete proof exporter remains Task 8.
  - Test Cases to Write:
    - `vocabulary_subsets_must_be_declared`: a surface role or fillable role not in `colourRoles` is rejected. Fails if the subset check is dropped.
    - `tones_map_to_declared_roles`: `tones: { danger: "text.danger" }` without that role is rejected with `unknown-name`.
    - `vocabulary_names_are_bounded_and_unique`: a duplicate name, a 65-character name, a bad pattern, a 257-name list and a wrong family prefix are each rejected.
  - Notes (executed 2026-10-22):
    - Added readonly `Vocabulary`, the closed `vocabularySchema` and `validateVocabulary`, with required fields, bounded unique lists, family prefixes, bounded tone keys/values, explicit role subsets and tone references. Validation preserves the input on success and returns at most 20 JSON-Pointer errors; structural failures precede reference checks.
    - Added the library-fixed states, style props, semantics and recipe-property arrays under `src/formats/fixed.ts`, exported from the root. Lists are ported from the proof without importing or changing it; `translateY` replaces its `transformPreset` shorthand as required by spec §6.2. No spec change or new design decision was needed.
    - Added outsider-facing vocabulary documentation, seven tests and a snapshot of the proof vocabulary. Tests cover every requested rejection, escaped pointers, prototype-like names, empty categories, inclusive bounds, input identity, Ajv structural agreement and the proof vocabulary's under-1-ms validation gate.
    - Clarified the registry step: Task 3 embeds the exported schema in the catalog's `$defs` and registers `catalog.json`; Task 2 emits no standalone vocabulary schema. The full proof exporter remains Task 8.
    - Validation: `timeout 300s bun run check` passed (98 tests, including browser proof tests); `timeout 20s bun scripts/schemas.ts --check` passed. Existing proof lint warnings remain non-fatal. No proof files were changed.
    - Commit scope: implementation, tests, fixture and format documentation are committed separately. The pre-existing untracked plan and modified roadmap are updated in place and left unstaged, preserving the earlier documentation work.

- [x] Task 3: Define the definition and catalog formats, the install validator and change classification
  - Acceptance Criteria:
    - Functional:
      - `Definition` and `Catalog` follow spec §5, with `description`, `defaultVariant` and `deprecated`, and events with `carries` and a description. `validateCatalog(doc)` checks that:
        - `format` and the `catalogId` pattern (`^[a-z][a-z0-9.-]*@[1-9][0-9]*$`) are valid;
        - the vocabulary is valid (Task 2);
        - kinds are unique;
        - every prop schema passes `isLanguageSchema`;
        - `a11y.name` names a string prop;
        - children rules name declared kinds with `min <= max`;
        - `defaultVariant` is one of the variants;
        - event names match `^on[A-Z][A-Za-z]*$`;
        - `styleProps` are a subset of the fixed list;
        - every slot list includes `root`.
      - `classifyCatalogChange(prev, next)` returns `{ level: "major" | "minor" | "none", reasons }` by the spec §5 versioning rules, and states when the `catalogId` major must change.
    - Performance: the proof catalog (24 kinds) validates in under 5 ms in the test.
    - Code Quality: the definition helper in `src/formats/catalog.ts` is typed with `typescript-advanced-types`, so a catalog literal keeps its literal kinds, variants and events for Phase 2's `liveframe gen`.
    - Security: law 2. A catalog the validator rejects can never be compiled into Part B's validator. An undeclared style prop is rejected here, which keeps raw layout out (law 3).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/formats.md`.
      - `typescript-advanced-types`.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - Spec §5 (catalog, versioning).
      - `proof/catalog/define.ts:59–68`, `proof/catalog/definitions.ts` (24 kinds).
      - A2UI v1.0 catalog rules and versioning guidelines (a2ui.org/concepts/catalogs).
      - Custom Elements Manifest `CustomElementDeclaration`.
    - Options Considered:
      - Leave versioning to documentation only: rejected. An agent or CI can't check prose, while `classifyCatalogChange` lets a host's CI fail when it forgets a major bump.
      - A closed list of ARIA roles: rejected for now. The role is rendered by the app's own primitive, so a bounded token (`^[a-z]+$`, at most 32 characters) is enough to keep markup out. Recorded under Further Actions if Part B or Phase 4 needs more.
    - Chosen Approach:
      - Schema-check the document with Task 1's interpreter, then run the cross-reference checks in one pass over the definitions.
    - API Notes and Examples:
      ```ts
      classifyCatalogChange(v1, { ...v1, definitions: v1.definitions.filter((d) => d.kind !== "tooltip") });
      // { level: "major", reasons: ["kind tooltip removed"] }
      ```
    - Files to Create/Edit:
      - `src/formats/catalog.ts`: new.
      - `src/formats/registry.ts`: register `catalog.json` (with the vocabulary in `$defs`).
      - `schemas/catalog.json`: generated.
      - `src/index.ts`: exports.
      - `docs/formats.md`: Definitions and catalog section, including the versioning table.
      - `src/__tests__/catalog.test.ts`: new.
      - `src/__tests__/schemas.test.ts`: include the catalog module and its dependencies in the isolated publisher fixture.
      - `proof/scripts/export-catalog.ts`, `src/__tests__/fixtures/catalog.json`: reproducible 24-kind install-validation performance fixture; Task 8 reuses the conversion.
  - Test Cases to Write:
    - `catalog_rejects_each_malformed_definition`: table-driven, one case per rule above. Each case asserts the error kind and pointer.
    - `catalog_change_classification`:
      - Removing a kind, prop, variant, slot or event, narrowing a bound, making a prop required, changing `carries` and removing a vocabulary name are all `major`.
      - Adding a kind, an optional prop, a variant, a slot, an event or a name is `minor`.
      - Fails if any rule is misclassified.
    - `catalog_literal_types_survive`: type-level. The helper's result type keeps `"button"` and its variant union.
    - `nested_schema_changes_are_classified`, `child_style_and_tone_contract_changes_are_classified`: recursive object/array changes, numeric widening/narrowing, enums, patterns, requiredness, child counts, style props and tone mappings.
    - `catalog_schema_matches_structure`, `catalog_errors_are_bounded_and_escape_pointers`, `proof_catalog_validates_under_five_milliseconds`: strict Ajv acceptance, input identity, bounded pointed errors and the 24-kind performance gate.
  - Notes (executed 2026-10-22):
    - Added readonly `Definition` and `Catalog`, literal-preserving `defineComponent`, fail-closed `validateCatalog` and `classifyCatalogChange`, exported from the root. The validator checks closed structure before cross-references and returns at most 20 escaped JSON-Pointer errors.
    - Registered and published `schemas/catalog.json`, embedding the vocabulary and recursive schema language in `$defs`. Types and structural schemas share builder sources; cross-field references and count relationships remain install checks. Updated the isolated schema-publisher drift test for its new imports.
    - Classification follows spec §5 recursively through object and array props. Documentation/deprecation annotations and ordering do not affect compatibility. Removed style props, tightened child rules, changed default variants/accessibility contracts and remapped tones are conservatively breaking; a changed regex is conservatively breaking unless the pattern is removed. Docs explain that a major result requires a new catalogId major, while the classifier neither rewrites nor enforces ids. No spec change or additional design decision was needed.
    - Added the 24-kind fixture and `proof/scripts/export-catalog.ts` to regenerate it without importing proof code into src. Conversion derives maxLength for enum-only proof strings, adds descriptions/default variants and renames textField's onSubmit to onCommit in the fixture only. Task 8 should reuse this conversion for its full exporter; existing proof sources remain untouched.
    - Validation: `timeout 300s bun run check` passed (106 tests, including browser proof tests); `timeout 20s bun scripts/schemas.ts --check` passed. Strict Ajv accepts both the example and proof catalog, the proof catalog meets the under-5-ms gate, and regenerating the catalog fixture is byte-identical. Refreshed graft. Existing proof lint warnings remain non-fatal.
    - Scope: Task 3 only; no dependency, runtime tree validator or later format was added. As in Tasks 1–2, the pre-existing untracked plan and modified roadmap are updated in place and left unstaged; the task's implementation, tests, fixture, exporter and docs are committed separately.

- [x] Task 4: Define the capabilities and manifest formats and their validators
  - Acceptance Criteria:
    - Functional:
      - `Capabilities` follows spec §7.1. `validateCapabilities(doc)` checks:
        - action and source names match `^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$`;
        - `args` and `params` are language object schemas, and `result` is a language schema;
        - descriptions are at most 500 characters;
        - each document has at most 512 actions and sources.
      - `Manifest` carries `format: "liveframe-manifest/1"`, `id`, `version`, `catalogId`, the params, state and context schemas, `initialState`, `sources` with bindings, and `actions`. `validateManifest(doc, { catalog, capabilities })` checks that:
        - `catalogId` equals the catalog's (`catalog-mismatch`);
        - every source and action exists in the capabilities (`unknown-name`);
        - every binding's `path` resolves in the named schema, and its type equals the source param's schema type;
        - every required source param is bound;
        - `initialState` matches the state schema.
    - Performance: the proof's agent-home manifest validates in under 2 ms in the test.
    - Code Quality: binding paths are dot paths over object properties only (`cursors.tasks`), at most 8 segments. No array indices and no expressions.
    - Security: law 4. Capabilities describe and never authorise, and the docs say the host re-checks on dispatch. A manifest can't name an action the host did not declare.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/formats.md`.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - Spec §7.1, §8.
      - `proof/widgets/agent-home/manifest.ts:43–80`: the action argument schemas already exist there but reach the validator only as names.
      - json-render `defineCatalog` `ActionDefinition` (params and description).
    - Options Considered:
      - Bindings as template strings (`"$state.cursor"`): rejected. A second mini-language on the wire, while a structured `{ from, path }` is closed data.
      - Sources declared by name only, with binding left to the host: rejected. Spec §7.1 requires bound params, and agents can't see the data shape without a declared result schema.
    - Chosen Approach:
      - Two documents, two validators. The manifest validator takes the catalog and capabilities as context, mirroring how the manifest names them.
    - API Notes and Examples:
      ```ts
      sources: { queue: { source: "tasks.queue", params: { cursor: { from: "state", path: "cursors.tasks" }, limit: 50 } } }
      ```
    - Files to Create/Edit:
      - `src/formats/capabilities.ts`, `src/formats/manifest.ts`: new; shared internal document checks live with capabilities and preserve bounded, escaped errors for both validators.
      - `src/formats/registry.ts`: register both.
      - `schemas/capabilities.json`, `schemas/manifest.json`: generated.
      - `src/index.ts`: exports.
      - `docs/formats.md`: Capabilities and Manifest sections.
      - `src/__tests__/manifest.test.ts`: new. Includes the agent-home-shaped performance contract; Task 8 remains the reproducible full proof exporter.
      - `src/__tests__/schemas.test.ts`: copy the two new format modules into the isolated publisher drift fixture.
  - Test Cases to Write:
    - `manifest_names_only_declared_capabilities`: an undeclared action or source is rejected with `unknown-name`.
    - `bindings_resolve_and_match_types`: a path missing from the state schema, a type mismatch (boolean bound to a string param) and an unbound required param are each rejected.
    - `initial_state_matches_schema`: an invalid initial state is rejected at its pointer.
    - `manifest_catalog_must_match`: a different `catalogId` is rejected with `catalog-mismatch`.
    - `capability_schemas_are_in_language`: an unbounded `args` string is rejected.

  - Notes (executed 2026-10-22):
    - Added readonly Capabilities and Manifest types and their install validators, exported from the root. Capabilities validate bounded names/maps/descriptions, closed entries and language schemas. Manifests validate closed structure, catalog identity, declared operations, unique actions, required source params, literal values, object-property bindings and initial state. Both preserve input identity on success and return at most 20 escaped JSON-Pointer errors.
    - Registered and generated capabilities.json and manifest.json, embedding the schema language and JSON literal forms. Structural schemas reject malformed bindings; initial-state checks and cross-document references remain contextual install checks. Updated the isolated publisher fixture for the added imports.
    - Added nine tests covering the planned rejection cases, all three binding origins, unknown/extra fields, nested literal values, prototype-like names, invalid paths, bounded errors, strict Ajv structural agreement and an agent-home-shaped contract under the 2-ms budget. The performance contract mirrors the proof state and eight actions, with a representative paged source binding; Task 8 still owns the complete reproducible proof export.
    - Added outsider-facing docs and examples for both formats, including the host authorisation/dispatch responsibility and runtime bound checks for resolved source values. No spec change, new dependency or additional design decision was needed.
    - Validation: timeout 300s bun run check passed (115 tests, including browser proof tests); timeout 20s bun scripts/schemas.ts --check passed. Refreshed graft. Existing proof lint warnings remain non-fatal; no proof files were changed.
    - Scope: Task 4 only. As in Tasks 1–3, the pre-existing untracked plan and modified roadmap are updated in place and left unstaged; implementation, generated schemas, tests and format docs are committed separately.

- [x] Task 5: Define the theme format and its install validator
  - Acceptance Criteria:
    - Functional:
      - `Theme` is `{ format: "liveframe-theme/1", id, version, colorScheme: "light" | "dark", colours, typography }`. `validateTheme(doc, vocabulary)` checks that:
        - every declared colour and typography role is present, and no undeclared role is (`unknown-name`);
        - colours are DTCG objects: a `colorSpace` from the 14 DTCG spaces, three components that are finite numbers or `"none"` and inside the space's DTCG ranges, an optional `alpha` in `[0, 1]`, and an optional `hex` matching `^#[0-9a-fA-F]{6}$`;
        - typography is the DTCG composite (`fontFamily` as a string or a list of at most 8; `fontSize` and `letterSpacing` as dimensions, with `em` also allowed for `letterSpacing`; `fontWeight` in `[1, 1000]` or a DTCG alias; `lineHeight` as a number) plus the spec §6.1 extras, each bounded.
      - This closes G28 for themes (`proof/REPORT.md` G28).
    - Performance: each proof theme validates in under 2 ms in the test.
    - Code Quality: the colour-space component ranges are one table in `src/formats/theme.ts`, citing DTCG 2025.10 §4.2.
    - Security: law 3. The theme is the only document whose schema accepts a colour literal. A font family is a bounded plain string list, never a CSS fragment: `;`, `{`, `}` and `url(` are rejected.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/styling.md`.
    - Library Documentation to Check Before Implementation:
      - DTCG 2025.10 `color` (spaces, component ranges, `none`, `hex`) and `format` (typography, dimension, fontWeight aliases), via `find-docs` (`/websites/designtokens_tr_2025_10`).
    - Documentation Reviewed:
      - Spec §6.1.
      - `proof/styles/certified/theme.ts`, `proof/styles/rack/theme.ts` (oklch strings, which Task 8 converts).
      - `proof/styles/types.ts:71–85`.
    - Options Considered:
      - CSS colour strings: rejected by the decision log (alternative 5).
      - Light and dark modes inside one document: rejected for now. The spec allows "separate themes, or modes of one theme". Separate documents are simpler, and an app pairs them.
    - Chosen Approach:
      - Schema check, then a range check per colour space, then the vocabulary cross-check.
    - API Notes and Examples:
      ```ts
      colours: { "surface.base": { colorSpace: "oklch", components: [0.966, 0.01, 172] } }
      ```
    - Files to Create/Edit:
      - `src/formats/dtcg.ts`: new. Theme DTCG colour, dimension and typography types/schemas; Task 6 adds duration, cubicBezier and shadow when consumed.
      - `src/formats/theme.ts`: new.
      - `src/formats/registry.ts`, `schemas/theme.json`.
      - `src/index.ts`: exports.
      - `docs/formats.md`: Theme section.
      - `src/__tests__/theme.test.ts`: new, including strict Ajv agreement, bounds, error pointers and both proof-theme performance checks.
      - `src/__tests__/fixtures/{certified,rack}.theme.json`: snapshots for the performance checks. Task 8 replaces these with its reproducible full proof export.
      - `src/__tests__/schemas.test.ts`: include the new modules in the isolated publisher fixture.
  - Test Cases to Write:
    - `theme_must_cover_the_vocabulary`: a missing role and an extra role are each rejected.
    - `colour_values_follow_dtcg`: an unknown space, two components, an out-of-range oklch lightness, `alpha: 1.5` and a 3-digit hex are each rejected; `"none"` is accepted.
    - `font_family_is_not_css`: `"Inter; color: red"` and `url(x)` are rejected.

  - Notes (executed 2026-10-22):
    - Added readonly Theme and validateTheme root exports, a closed versioned theme document, required/undeclared vocabulary role checks, bounded role maps, input identity preservation and at most 20 escaped JSON-Pointer errors. The validator reuses Task 4's internal document checks and remains host-API-free.
    - Added theme-consumed DTCG types and schemas in dtcg.ts. Task 6 adds duration, cubicBezier and shadow when they have consumers. Typography supports font fallback lists, weight aliases, dimensions and all spec §6.1 extras; font families reject CSS delimiters, backslashes, control characters and case-insensitive url calls. Numeric limits and the numeric percentage representation for fontStretch are documented in docs/formats.md.
    - Verified DTCG 2025.10 through Context7 and its primary color/format reports. One table defines all 14 colour-space ranges and generates the published schema's component constraints. Hue excludes 360; Lab/OKLab axes and LCH/OKLCH chroma retain DTCG's theoretical unbounded ranges rather than treating its typical magnitudes as limits. No spec change, new dependency or additional project decision was needed.
    - Registered and generated theme.json, updated the isolated publisher drift fixture, and added seven tests covering role completeness, malformed colours, finite values, font safety, typography bounds, escaped/bounded errors, type-level shape checks and strict Ajv agreement across all 14 spaces.
    - Snapshotted both complete proof themes for the under-2-ms validation gates, without importing proof code into src. Converted hex/oklch/transparent to DTCG values, split fallback families, converted dimensions and fontStretch, and resolved Certified's same-hue OKLab hover mix by weighted lightness/chroma. Task 8 still owns the reproducible full exporter and replaces these preliminary snapshots; G28's theme-format limitation is closed, with proof/backlog disposition retained for Task 9.
    - Validation: timeout 300s bun run check passed (122 tests, including browser proof tests); timeout 20s bun scripts/schemas.ts --check passed. Existing proof lint warnings remain non-fatal. No proof files were changed.
    - Scope: Task 5 only. The pre-existing untracked plan and modified roadmap are updated in place and left unstaged, consistent with Tasks 1–4; only this task's implementation, schemas, tests, snapshots and format docs are committed.

- [x] Task 6: Define the design-system format, its install validator and the recipe resolver
  - Acceptance Criteria:
    - Functional:
      - `DesignSystem` is `{ format: "liveframe-design-system/1", id, version, extends?, values, recipes }`.
      - Values are named DTCG values with a Liveframe `kind`:
        - `radius`, `border-width`, `spacing`, `size`, `breakpoint` and `backdrop-blur` are `dimension`;
        - `motion-duration` is `duration`;
        - `easing` is `cubicBezier`;
        - `opacity` and `saturation` are `number`;
        - `shadow` is `shadow`, with each layer's colour a theme role name.
      - Recipes use keys `kind.variant|*.slot.state` and the closed property list of spec §6.2. Each property value is a reference to a name of the right kind (a colour role, typography role or design value) or an inline DTCG literal of the right type, bounded.
      - `validateDesignSystem(doc, { catalog, registry })` checks that:
        - every declared `space`, `radius`, `size` and breakpoint name is defined with the matching kind (`unknown-name`);
        - every key's kind, variant, slot and state exist;
        - every reference resolves;
        - colour properties name theme roles only (`colour-outside-theme` for any literal or unknown colour);
        - `extends` resolves through the registry without cycles (`cyclic-extends`);
        - the cascade completeness of spec §6.2 holds: `rest` for every `(kind, variant, slot)`, and `focus` for every kind with an event (`incomplete-design-system`, listing every gap up to the bound).
      - `resolveRecipes(ds, { catalog, registry })` returns the flat table `(kind, variant, slot, state) → resolved properties`, with value references replaced by DTCG literals and colours left as role names for the projection.
      - This closes G28 for design systems.
    - Performance: validating and resolving the proof's current Rack system (616 resolved recipes; the original plan recorded 536) takes under 50 ms in the test.
    - Code Quality: the cascade is one function used by both the validator and the resolver, so they can't disagree.
    - Security: law 3. No recipe property accepts a CSS string, selector or colour literal, and the property list is closed.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/styling.md`.
      - `typescript-advanced-types` for the recipe-key template type.
    - Library Documentation to Check Before Implementation:
      - DTCG 2025.10 `duration`, `cubicBezier` and `shadow`, via `find-docs`.
      - Panda CSS slot recipes (`/chakra-ui/panda`, `defineSlotRecipe`) for the base and variant model.
    - Documentation Reviewed:
      - Spec §6.2.
      - `proof/styles/types.ts:95–177`: the `transitionTiming: "expo-out"` and `transformPreset` enums that become values.
      - `proof/styles/recipes.ts` (the proof's rest-plus-state completion, which the cascade generalises).
      - `proof/styles/rack/design-system.ts` (2,774 lines).
    - Options Considered:
      - Keep "every state resolves" completeness: rejected by the decision log. It forces duplication, and the proof's `completeRecipes` already treats states as overlays on `rest`.
      - Resolve `extends` lazily in the projection: rejected. The validator needs the resolved table to check completeness, and one resolver serves both.
    - Chosen Approach:
      - Parse keys once into a typed index. Apply `extends` (the parent first, then the child's overrides), then the cascade.
    - API Notes and Examples:
      ```ts
      recipes: { "button.*.root.rest": { borderRadius: "radius.control", transitionTiming: "easing.out" },
                 "button.primary.root.rest": { backgroundColor: "accent.fill" },
                 "button.*.root.focus": { outlineColor: "focus.ring", outlineWidth: { value: 2, unit: "px" } } }
      ```
    - Files to Create/Edit:
      - `src/formats/dtcg.ts`: add bounded design dimensions, durations, cubicBezier and role-coloured shadow shapes.
      - `src/formats/design-system.ts`: new.
      - `src/resolve.ts`: new (`resolveRecipes`, the cascade).
      - `src/formats/registry.ts`, `schemas/design-system.json`.
      - `src/index.ts`: exports.
      - `docs/formats.md`: Design system section, including the cascade.
      - `src/__tests__/design-system.test.ts`, `src/__tests__/resolve.test.ts`: new.
      - `src/__tests__/schemas.test.ts`: include the new modules in the isolated publisher fixture.
      - `src/__tests__/fixtures/rack.design-system{,-vocabulary}.json`: preliminary performance snapshots; Task 8 replaces them with the reproducible proof export.
  - Test Cases to Write:
    - `colour_only_from_theme_roles`: a colour literal or unknown role in `backgroundColor`, and in a shadow layer's colour, are rejected with `colour-outside-theme`.
    - `completeness_after_cascade`: a missing `rest` for one slot, and a missing `focus` for `button`, are each reported, and a `*` rest satisfies every variant. Fails if `*` or the overlays are ignored.
    - `extends_cycles_rejected`: an A→B→A chain is rejected with `cyclic-extends`.
    - `references_match_value_kinds`: `borderRadius: "space.2"` is rejected (wrong kind).
    - `cascade_order`: `kind.*.slot.rest`, `kind.variant.slot.rest`, `kind.*.slot.hover` and `kind.variant.slot.hover` each set the same property. The resolved hover takes the last; the resolved rest takes the second.

  - Notes (executed 2026-10-22):
    - Added readonly DesignSystem, DesignValue, Recipe, RecipeKey and resolved recipe types, validateDesignSystem and resolveRecipes root exports, and the registered/generated design-system.json schema. No dependency, host API or spec change was needed.
    - Validates closed bounded documents, declared value kinds, catalog recipe axes, every reference, theme colour authority (including shadows), ancestor structure and registry identity, cycles, rest coverage and interactive focus coverage. Parent documents may be partial; child values and individual recipe properties override their parents. Errors are escaped JSON Pointers capped at 20.
    - One cascade supplies both completeness and flat resolution, with wildcard rest → variant rest → wildcard state → variant state. The resolver preserves theme/typography names, resolves design references, leaves its inputs unchanged and throws install errors on invalid inputs; callers should validate before resolving.
    - Verified DTCG 2025.10 duration, cubicBezier and shadow shapes through Context7. Geometry and signed offset bounds are 16384 (preserving the proof's 9999 pill radius), durations 60000, easing x coordinates 0–1/y coordinates −100–100, opacity 0–1, saturation 0–10 and shadows at most 16 layers. Published schemas and TypeScript share the constituent schemas. Panda's base/variant model remains prior art from the accepted format-scope decision; no Panda API or dependency is used.
    - Added 14 focused tests plus existing schema drift/oracle checks, covering all planned rejections, inheritance, invalid parents, complete bounded gap lists, prototype-name safety, colour-role/value-name collisions, signed literals, all value kinds, property-list agreement and resolver purity. The complete current Rack snapshot has 616 recipes; validation plus resolution averaged about 12.2 ms locally against the under-50-ms gate.
    - Rack shadows retain alpha through additional theme role names, keeping colours inside the theme. The performance vocabulary names these roles; Task 8 must generate their theme values and compare their expanded role/alpha meaning when proving recipe equivalence. Its scope is amended below accordingly.
    - Validation: timeout 300s bun run check passed (136 tests including browser proof tests); timeout 20s bun scripts/schemas.ts --check passed. Existing proof lint warnings remain non-fatal. No proof implementation files were changed.
    - Scope: Task 6 only. As in Tasks 1–5, the pre-existing untracked plan and modified roadmap are updated in place and left unstaged; implementation, generated schema, tests, snapshots and format docs are committed separately.

- [x] Task 7: Define the UI tree and intent formats
  - Acceptance Criteria:
    - Functional:
      - `UiTree`, `UiNode` and `Intent` (including the action's optional `bind`) follow spec §9 as TS types and as the catalog-independent `ui-tree.json` schema: the structure, the closed fields and the id pattern.
      - `LIVEFRAME_FORMAT` stays `"liveframe/1"`.
      - The catalog-specific checks are Part B's. This schema is what non-TS transports and agents use for a structural check.
    - Performance: n/a. The compiled per-render path is Part B. This task adds types and a published schema only.
    - Code Quality: the tree types live in `src/formats/tree.ts`. Part B's validator imports them, never re-declares them.
    - Security: law 2 and law 4. The structural schema rejects unknown node fields and unknown intent types. `bind` is a bounded name and carries no value.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/formats.md`.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - Spec §9, §8 (`bind`).
      - `proof/runtime/types.ts:5–25`.
    - Options Considered:
      - A recursive schema with `$ref` for `children`: needed. It is an internal publishing form, not part of the public language, and Ajv compiles it in strict mode.
    - Chosen Approach:
      - Types and schema from one builder source, like every other format.
    - API Notes and Examples:
      ```ts
      { type: "action", name: "tasks.escalate", args: { id: "t-4812" }, bind: "reason" }
      ```
    - Files to Create/Edit:
      - `src/formats/tree.ts`: new.
      - `src/formats/registry.ts`, `schemas/ui-tree.json`.
      - `src/index.ts`: exports.
      - `docs/formats.md`: UI tree and intents section.
      - `src/__tests__/tree.test.ts`: new.
      - `src/__tests__/schemas.test.ts`: include the new module in the isolated publisher fixture.
  - Test Cases to Write:
    - `tree_schema_rejects_unknown_fields`: an extra node field, an unknown intent `type`, a `bind` on `setState` and an id outside the key-path pattern are each rejected by Ajv against `ui-tree.json`.
    - `proof_trees_match_tree_schema`: every tree fixture from Task 8 passes Ajv against `ui-tree.json`. Tentative: this case lands in Task 8 once the fixtures exist.
  - Notes (executed 2026-10-22):
    - Added readonly `UiTree`, recursive `UiNode`, `Intent` and `Json` root exports. Intent and tree fields derive from the same builders as the structural schema; recursive JSON and node references use internal publishing forms. `LIVEFRAME_FORMAT` remains `"liveframe/1"`.
    - Registered and published `schemas/ui-tree.json`, with closed tree/node/intent fields, both intent variants, optional action-only `bind`, required object arguments, and the proof's encoded key-path grammar. Metadata names reuse existing catalog/capability bounds; surface ids, state keys and bind names are nonempty and bounded to 128 code points. Recursive values and children impose no fixed render limits; contextual validation remains Part B's responsibility.
    - Added outsider-facing docs and three tests covering typed valid trees, nested JSON, optional state values including explicit null, unknown fields/types, invalid envelopes and ids, bounded bind names and malformed arguments. Type-level assertions cover JSON-only values, required node props, action-only bind and readonly trees. Updated the isolated schema publisher fixture for the new import.
    - Validation: `timeout 300s bun run check` passed (139 tests including browser proof tests); `timeout 20s bun scripts/schemas.ts --check` passed. Published schemas compile with strict Ajv and match their sources. No spec change or new design decision was needed.
    - Scope: Task 7 only. The proof-tree fixture case remains in Task 8 as planned. No proof files were changed. As in Tasks 1–6, the pre-existing untracked plan and modified roadmap are updated in place and left unstaged; implementation, schema, tests and format docs are committed separately.

- [x] Task 8: Express the Phase 0 proof in the new formats
  - Acceptance Criteria:
    - Functional:
      - `proof/scripts/export-formats.ts` converts the proof's data and writes `src/__tests__/fixtures/proof/`:
        - `catalog.json`: 24 definitions plus the vocabulary, with `textField`'s commit event named `onCommit` (closes G19 for the fixture);
        - `capabilities.json` and `agent-home.manifest.json`, using the existing argument schemas from `proof/widgets/agent-home/manifest.ts`;
        - `certified.theme.json` and `rack.theme.json` (oklch strings converted to DTCG oklch objects; shadow layer opacity becomes additional theme roles with the corresponding alpha, declared in the vocabulary);
        - `certified.design-system.json` and `rack.design-system.json` (numbers converted to `px` dimensions and `ms` durations; `expo-out` to its cubicBezier; the press-shift preset to a `translateY` value);
        - trees: the 50-row agent-home selection tree (679 nodes), `core.queue` at small, medium, large and full, the 52-row git status and the Rack module.
      - The script asserts that every resolved recipe equals the proof's `completeRecipes` output after unit conversion and expansion of the generated shadow-alpha roles, and exits non-zero on any difference.
      - `proof_formats_validate`: every fixture validates with Tasks 2–7, and the trees pass `ui-tree.json`.
    - Performance: the export runs in under 30 s. The fixtures are committed JSON, not generated in tests.
    - Code Quality: the script lives in `proof/scripts/`, so `src/` still never imports `proof/`. A header comment names the script that regenerates the fixtures.
    - Security: the conversion introduces no colour outside the themes. The test asserts that no design-system fixture contains a colour literal.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/proof.md` and `references/formats.md`.
    - Library Documentation to Check Before Implementation:
      - None beyond Tasks 5–6.
    - Documentation Reviewed:
      - `proof/catalog/definitions.ts`, `proof/styles/{certified,rack}/*`, `proof/styles/recipes.ts`.
      - `proof/css/project.ts:315–358` (tones, easing, transforms).
      - `proof/tests/*.bench.ts` (how each tree is built).
    - Options Considered:
      - Hand-write the fixtures: rejected. They'd drift from the proof and can't prove equivalence.
      - Have `src` tests import `proof/`: rejected by the placement rule.
    - Chosen Approach:
      - A one-way exporter that asserts equivalence while it writes. It is the plan's sufficiency test: the formats are enough because the proof's four UIs survive the conversion unchanged. Any value that can't be expressed is a finding (stop rule above).
    - API Notes and Examples:
      ```bash
      timeout 60 bun proof/scripts/export-formats.ts --out src/__tests__/fixtures/proof
      ```
    - Files to Create/Edit:
      - `proof/scripts/export-formats.ts`: new.
      - `proof/scripts/export-catalog.ts`: expose its existing schema/catalog conversion without writing on import.
      - `src/__tests__/fixtures/proof/*.json`: generated and committed.
      - `src/__tests__/proof-formats.test.ts`: new.
      - `proof/GAPS.md`: G19 note (fixture renamed).
      - `src/__tests__/proof-formats.test.ts`: also holds Task 7's tentative proof-tree schema case, beside the fixture validation tests.
  - Test Cases to Write:
    - `proof_formats_validate`: all seven documents validate. Fails if any format can't express the proof.
    - `proof_recipes_round_trip`: `resolveRecipes` on both fixtures equals a committed snapshot of the proof's resolved table. Fails on any cascade or conversion drift.
    - `no_colour_literals_outside_themes`: scans the design-system and catalog fixtures for DTCG colour objects. Fails on any hit.
  - Notes (executed 2026-10-22):
    - Added the one-way exporter and 17 committed JSON fixtures: the catalog, vocabulary, capabilities, agent-home manifest, both themes and design systems, both resolved-recipe snapshots, and seven benchmark trees. Reused the existing catalog/schema conversion; importing it no longer runs its standalone writer. Existing isolated format-test snapshots remain separate from this complete proof set.
    - Converted oklch, hex, transparent and the proof's equal-hue OKLab colour mix to DTCG values, font stacks to lists, font stretch to percentages, typography spacing to em, dimensions to px, durations to ms, expo-out to cubicBezier, and press presets to translateY. Shadow-alpha roles are declared in the vocabulary and both themes; alpha multiplies the source role's alpha rather than replacing it.
    - The exporter validates documents before writing, asserts equality with completeRecipes after conversion and reference resolution, and independently expands generated shadow roles back to the proof's role/opacity layers. Both design systems resolve to 616 entries. Unknown source colour or transform forms fail rather than changing the formats.
    - Added five tests covering every install validator, strict published schemas, recipe snapshots and representative easing/transform values, shadow-alpha composition, absence of colour literals outside themes, every tree's catalog/event references and transport schema, the 679-node agent-home tree and 52-label git panel. Task 7's tentative tree case is covered here instead of duplicating fixture loading in tree.test.ts.
    - Validation: timeout 300s bun run check passed (144 tests, including browser proof tests); timeout 60s bun scripts/schemas.ts --check passed. Export runs in approximately 130 ms against the 30-second bound; exporting to a fresh temporary directory and comparing all 17 files with diff -rq passed. Refreshed graft. No spec change or new design decision was needed.
    - Recorded G19's fixture event rename in proof/GAPS.md. Task 9's architectural sweep and backlog dispositions remain outstanding. As in Tasks 1–7, pre-existing plan, roadmap and proof/GAPS.md edits are updated in place and left unstaged; only this task's exporter, tests and generated fixtures are committed.

- [x] Task 9: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - Every impact area in `.agents/skills/create-plan/references/liveframe.md` §5 is recorded in `plans/evidence/003-impact-analysis.md`, or marked `None — <reason>`.
      - Every finding is executed above this task or backlogged, with the owner's answer recorded.
      - Backlog entries this plan closes (G19, G28 in "Later-phase gaps") are updated.
      - `.agents/skills/liveframe-execution/references/formats.md` and `styling.md` "Today" sections are updated.
    - Performance: n/a.
    - Code Quality: findings name concrete files or spec sections.
    - Security: the four-laws area is never `None` without evidence. It must cover theme font families, recipe literals and capability descriptions.
  - Approach:
    - Skills to Use:
      - `create-plan` § Final task.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - The delivered `src/`, `schemas/`, `docs/formats.md` and the spec.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - Sweep, present one findings table to the owner, then dispose of each finding.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/003-impact-analysis.md`: new.
      - `plans/backlog.md`: update.
      - `.agents/skills/liveframe-execution/references/{formats,styling}.md`: update.
      - `.agents/skills/liveframe-execution/SKILL.md`, `.agents/skills/liveframe-execution/references/architecture.md`: remove stale scaffold descriptions found during the sweep.
      - `docs/formats.md`: correct the vocabulary schema's future-tense description.
      - This plan and `roadmap.md` §3: record the completed task and actual plan status.
  - Test Cases to Write:
    - None.
  - Notes (executed 2026-10-22):
    - Swept all twelve impact areas in `plans/evidence/003-impact-analysis.md`, with concrete source/spec references and four-laws evidence covering font families, recipe literals and capability descriptions. No runtime or normative spec change was required.
    - Disposed of all six findings: corrected stale execution/architecture/formats/styling guidance and vocabulary docs; reconciled delivered G19/G28 scope and the already settled primitive-set/bind decisions; handed the format suites to the existing Phase 5 conformance backlog entry and added a P2 release-package fixture exclusion gate for Phase 6. Findings and dispositions were presented during execution; the owner's request to complete this task authorises the maintenance and backlog work, without claiming separate per-row approval or a new architecture decision.
    - Filled Compromises Made and Further Actions, updated backlog sources and changed roadmap §3's plan 003 status to complete. Plan 002 Task 9's separate owner gate remains untouched; plan 004 remains planned, with semantic tree validation and its performance gate still outstanding.
    - Validation: `timeout 300s bun run check` passed (144 tests across 27 files, no failures; existing proof lint warnings remain non-fatal); `timeout 60s bun scripts/schemas.ts --check` passed; exporting all 17 proof fixtures took 132 ms and `git diff --exit-code -- src/__tests__/fixtures/proof` passed; `timeout 120s bun test src` passed (67 tests across 12 files). `git diff --check` passed. No new tests were needed for these documentation-only corrections.
    - Commit scope follows Tasks 1–8: task-local evidence and tracked format docs are committed separately. Pre-existing untracked plan/skill files and shared roadmap/backlog edits remain in the working tree, updated in place, so earlier documentation work is not swept into this task's commit.

## Verification (whole plan)

- `timeout 300 bun run check`
- `timeout 60 bun scripts/schemas.ts --check`
- `timeout 60 bun proof/scripts/export-formats.ts --out src/__tests__/fixtures/proof` followed by `git diff --exit-code src/__tests__/fixtures/proof` (the fixtures are reproducible)
- `timeout 120 bun test src` (the format suites alone)

## Compromises Made

- Published JSON Schemas cover structure; relationships such as vocabulary subsets, role coverage, initial state and source bindings require the install validators. `ui-tree.json` is catalog-independent; Part B owns semantic tree validation and traversal limits. These are documented scope boundaries, not completed tree-validation guarantees.
- The historical proof keeps its runtime/event format while the one-way exporter produces the new contracts, including `textField.onCommit` and theme-owned shadow-alpha roles. Isolated format-performance snapshots remain separate from the complete exported proof set; the exporter and round-trip tests check the full set.
- Catalog accessibility roles remain bounded tokens rather than a fixed ARIA-role enum (Task 3's chosen scope); app primitives own rendering semantics. No additional role vocabulary was introduced during this sweep.
- The private package's broad `src` file list includes test fixtures. Removing them from the release artifact is backlogged for Phase 6 (impact finding F6).

## Further Actions

- **P3 — Seed conformance suites from the proof tests (F5):** the existing `plans/backlog.md` entry now also names the Part A format suites, so Phase 5 can reuse the closed-data, error, versioning, font, colour, inheritance, schema and portability cases.
- **P2 — Exclude test fixtures from the release package (F6):** a new `plans/backlog.md` entry requires a Bun-generated archive check before Phase 6 publishing, preserving public source/schemas while excluding tests and app-specific fixtures.
- Existing phase scope remains: plan 004 validates trees and proves ≤1.5 µs/node; Phase 2 builds the SDK and holds the total render gate; Phase 3 projects DTCG values; Phase 4 implements the renderer/dispatch boundary. G19's fixture naming and G28's install validators are delivered; the backlog no longer asks for them again.
