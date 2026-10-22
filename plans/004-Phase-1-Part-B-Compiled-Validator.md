# Phase 1 Part B: The Compiled Tree Validator

## Objectives

- Compile a catalog, its vocabulary, the app's capabilities and a widget's manifest into a validator built from closures, with no `eval` and no `Function` constructor.
- Check every rule in spec §10 on a UI tree. Return every error, up to a bound, with a node id, a JSON Pointer and an agent-actionable `expected`.
- Hold the validator's share of the render budget: **≤ 1.5 µs per node** on the proof's 679-node agent-home tree. Show that it beats generic schema checking.

## Expected Outcome

- `@arnilo/liveframe` exports `compileValidator({ catalog, capabilities, manifest })`. It returns `{ validateTree(tree, options), checkNode }`:
  - `validateTree` is the whole-tree check that the backend runs before sending and the renderer runs on arrival.
  - `checkNode` holds the per-node checks that Phase 2's `render()` calls while building, so building and validating are one pass.
- One failing-case test per spec §10 rule, each asserting the error's kind, node id and pointer.
- `bench/validator.bench.ts` reports µs per node on the proof's tree fixtures and the speed-up over Part A's `checkValue` interpreter. It exits non-zero above 1.5 µs per node.
- `docs/formats.md` gains the Validation section, and the skill's `formats.md` "Today" names the shipped API.

This plan implements roadmap Phase 1 Part B: spec §10 (per-render checks, errors, limits, compilation) and the intent rules of §8 and §9, including `bind`. It depends on `plans/003-Phase-1-Part-A-Formats.md`, whose types, error format, schema language, interpreter and proof fixtures it uses unchanged. Scope and the 1.5 µs gate come from `decision-logs/2026-10-22-1905-phase-1-format-scope.md` and `decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md`. Phase 2 Part A keeps the 3 µs-per-node total through `render()`.

**Not in this plan:** the element builder, key-path id generation from JSX keys and `WidgetError` kinds raised while building (`host-element`, `function-prop`, `async-render`, `missing-key`), which are Phase 2 Part A. This plan validates trees that already have ids.

Probe answers that hold for every task, unless a task says otherwise:
- **Placement:** `src/validate/` inside the root export. It is host-API-free, with no `eval` or `Function`; Part A's `src_is_host_api_free` test already covers new files.
- **Four laws:**
  - Law 2 is this plan's subject.
  - Law 3 is enforced through style-prop and vocabulary checks.
  - Law 4 is enforced through manifest and capability checks on every intent.
  - Law 1 is untouched: the validator never runs widget code.
- **Primitives only:** n/a. The validator is driven by whatever catalog it is given.
- **Dependencies:** none new.
- **Public surface:** `compileValidator` and its option and result types. `package.json` `exports` is unchanged (root export).
- **Docs:** `docs/formats.md` "Validation" section, written for outsiders, in Task 6.
- **Reference hosts:** none. The proof fixtures stand in for both.
- **Callers:** no existing callers. The proof keeps its own validator in `proof/runtime/validate.ts`, untouched.

## Tasks

- [x] Task 1: Compile language schemas into closures
  - Acceptance Criteria:
    - Functional:
      - `compileSchema(schema)` returns `(value, at, sink) => boolean`. The check pushes `LiveframeError`s into `sink` up to its bound and returns whether the value passed.
      - It covers every form of the schema language with the same semantics as Part A's `checkValue`:
        - closed objects and required fields;
        - enums as precomputed `Set`s;
        - patterns compiled once at compile time;
        - `maxLength` in code points, counted only when `value.length > maxLength`.
      - `expected` describes the rule in plain words, for example `string of at most 80 characters` or `one of: all, mine`.
    - Performance: on a 1,000-value corpus, compiled checks are at least 3× faster than `checkValue`, asserted in the test with a warm-up.
    - Code Quality:
      - No `eval` and no `Function`: closures only.
      - Object checks iterate the value's own keys once, using a precomputed property map.
      - No allocation on the happy path beyond the boolean result.
    - Security: law 2. A schema the language rejects (Part A Task 1) can't reach `compileSchema`, because it accepts only the `LanguageSchema` type returned by `isLanguageSchema`.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/formats.md`.
      - `karpathy-guidelines`.
    - Library Documentation to Check Before Implementation:
      - Ajv 8.20.0 standalone docs (`/ajv-validator/ajv`, `docs/standalone.md`, `docs/security.md`), for why codegen is avoided at runtime.
    - Documentation Reviewed:
      - Spec §10.
      - `proof/runtime/validate.ts` `checkSchema`: a `new RegExp` per call, `[...value].length`, and `Object.entries` per object.
      - Part A `src/schema.ts`.
    - Options Considered:
      - Generate source and evaluate it with `Function`, like Ajv: rejected. It is forbidden under CSP and in some sandboxes.
      - Build-time code generation (Ajv standalone style): rejected for now. It would need a build step in every host for every catalog. Closures meet the budget unless Task 5 shows otherwise, in which case it becomes a Further Action.
    - Chosen Approach:
      - A recursive compiler that returns one specialised closure per schema node, over precomputed sets, regexes and maps.
    - API Notes and Examples:
      ```ts
      const check = compileSchema(obj({ label: str({ maxLength: 80 }) }));
      check({ label: "Claim" }, "/root/props", sink); // true
      ```
    - Files to Create/Edit:
      - `src/validate/schema.ts`: new.
      - `src/__tests__/compiled-schema.test.ts`: new.
  - Test Cases to Write:
    - `compiled_matches_interpreter`: a seeded 2,000-case corpus gets identical accept/reject results and error pointers from `compileSchema` and `checkValue`. Fails on any semantic drift.
    - `compiled_is_faster_than_interpreter`: a ≥ 3× ratio after warm-up. Fails if a closure falls back to interpretation.
    - `patterns_compile_once`: a spy on `RegExp` construction during 1,000 checks records zero new regexes. Fails if a pattern is compiled per call.
  - Notes (executed 2026-10-22):
    - Added internal `src/validate/schema.ts`: specialised closures over enum sets, Unicode regexes and a property map. Own enumerable keys are visited once; required properties use own-property checks. Successful checks build no paths or temporary collections. Code-point counting takes the UTF-16 length fast path and handles surrogate pairs without an iterator allocation.
    - `SchemaSink` carries `errors`, `maxErrors` and optional `nodeId`; failures use `invalid-prop`, actionable `expected` text and escaped JSON Pointers. A full sink still allows the boolean result to distinguish valid and invalid values. This internal compiler assumes install-validated schemas; Task 2 must validate documents before compiling them.
    - Tests were written first and failed on the missing compiler. The seeded 2,000-case parity corpus covers all language forms, nested errors, bounds, Unicode and prototype-sensitive properties. Additional checks cover bounded collection, full-sink results, expected text and zero regex construction across 1,000 validations.
    - `timeout 300s bun run check` passed: typecheck, lint, format and 149 tests. The warmed 1,000-value timing corpus measured **12.8×** faster in the full run (median 1.57 ms compiled versus 20.14 ms interpreted per 10,000 checks), exceeding the 3× gate on Bun 1.4.2. Focused run: 5 tests passed.
    - Reviewed Ajv's indexed standalone and security docs via Context7 (`/ajv-validator/ajv`); confirmed the rationale for avoiding runtime `Function` generation. No dependency, public-export or spec changes. Whole-tree budgets remain Task 5.

- [ ] Task 2: Compile the catalog, vocabulary, capabilities and manifest into per-node checks
  - Acceptance Criteria:
    - Functional:
      - `compileValidator({ catalog, capabilities, manifest })` first runs Part A's install validators and fails with their errors if any document is invalid.
      - It then builds `checkNode(node, path, sink)` per kind. Each check covers:
        - the closed field set (`id`, `kind`, `variant`, `props`, `style`, `events`, `children`);
        - the variant in the definition's set;
        - the props through compiled schemas;
        - every style prop declared for the kind and valid by spec §6.3, using vocabulary names (`space`, `size`, `radius`, breakpoints, surface and fillable roles, tones, typography roles), with responsive values keyed by declared breakpoints and `base` first;
        - every event declared for the kind;
        - each intent:
          - `setState`: the key is in the state schema, and the value matches that key's compiled schema. When the value is absent, the event's `carries` must equal the key's type.
          - `action`: the name is in the manifest, and the args match the capability's compiled args schema. With `bind`, the arg must exist in the schema with a type equal to the event's `carries`, the args must omit it, and the remaining args must match the schema with that property treated as present.
          - Any other intent type is rejected.
      - Each failure is the matching spec §7.2 kind: `unknown-component`, `invalid-prop`, `undeclared-event`, `undeclared-action` or `invalid-children`.
    - Performance: compiling the proof fixtures takes under 20 ms in the test. This is a once-per-load cost.
    - Code Quality:
      - Kinds are looked up in a `Map`, and declared names in `Set`s. Nothing does a linear `includes` per node.
      - Style-prop checkers are one table from prop name to compiled checker, built from Part A's `src/formats/fixed.ts`.
    - Security:
      - Law 3: a style value outside the vocabulary, or a non-declared role, is rejected.
      - Law 4: an action outside the manifest, or with args outside the capability's schema, is rejected before it reaches any dispatcher.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/formats.md` and `styling.md`.
      - `typescript-advanced-types` for the compiled-validator option types.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - Spec §6.3, §8, §9, §10.
      - `proof/runtime/validate.ts` `checkStyle` and `checkIntent`, the behaviour being replaced: regexes per value, `includes` per node, and args checked only as "an object".
      - Part A `src/formats/{catalog,capabilities,manifest,fixed}.ts`.
    - Options Considered:
      - One generic node checker that reads the definition at check time: rejected. That is the proof's interpretive cost (`decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md`).
    - Chosen Approach:
      - Specialise per kind at compile time, so each node check is a closure that knows its kind's props, variants, events and style props.
    - API Notes and Examples:
      ```ts
      const v = compileValidator({ catalog, capabilities, manifest });
      v.checkNode(node, "/root/children/0", sink); // used by Phase 2's builder, and by validateTree
      ```
    - Files to Create/Edit:
      - `src/validate/compile.ts`: new.
      - `src/validate/style.ts`: new (style-prop checkers).
      - `src/validate/intent.ts`: new.
      - `src/index.ts`: export `compileValidator` and its types.
      - `src/__tests__/validator-node.test.ts`: new.
  - Test Cases to Write:
    - `node_rejects_undeclared_parts`: an unknown kind, an extra field, an unknown variant, an unknown prop, an undeclared event and an undeclared style prop each give their kind and pointer.
    - `style_values_follow_vocabulary`: `gap: "13px"`, an undeclared `space.9`, an unknown breakpoint key, a responsive value without `base`, a nested responsive value and an undeclared tone are each rejected.
    - `action_args_match_capability`: a missing required arg, a wrong arg type and an extra arg are each rejected with `invalid-prop` at `/…/events/onPress/args/<arg>`.
    - `bind_rules`: rejected when `bind` names a missing arg, when the arg is also present in `args`, or when `carries: "none"` meets a string arg. Accepted for a `string` event bound to a string arg.
    - `set_state_value_matches_schema`: a value outside the key's enum is rejected, and an absent value with a mismatched `carries` is rejected.

- [ ] Task 3: Validate whole trees: structure, identity, limits and bounded error collection
  - Acceptance Criteria:
    - Functional:
      - `validateTree(tree, { limits?, maxErrors? })` checks:
        - the metadata (`format`, `catalogId` equal to the compiled catalog's, `surfaceId` at most 128 characters, `revision` a safe non-negative integer);
        - every node through `checkNode`;
        - children rules (`none`, `any`, or kinds with min and max) and the library's contextual rule (`terms` holds only `term`/`detail`, and those appear only inside `terms`);
        - every id is a key path under its parent and unique;
        - the node, depth and byte limits.
      - The byte count is the UTF-8 length of `JSON.stringify(tree)`, computed during the walk without serialising. Escapes (`"`, `\`, control characters) and non-ASCII characters are counted exactly.
      - Errors are collected up to `maxErrors` (default 20). Then the walk stops and reports `limit-exceeded` with `expected: "fix the errors above and validate again"`.
      - Valid trees return `{ ok: true, value: tree }` with the tree unchanged and not frozen.
    - Performance: Task 5 measures it. This task keeps one walk, and no `JSON.stringify` or `Object.entries` allocation per node on the happy path.
    - Code Quality: one recursive walk, with path strings built only when an error is recorded.
    - Security: law 2. Unbounded input fails closed. The node and depth limits are checked before recursing, and the byte count stops the walk once the limit is passed.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/formats.md`.
    - Library Documentation to Check Before Implementation:
      - ECMAScript `JSON.stringify` string escaping (QuoteJSONString), for the exact byte count. Check via `find-docs` or the ECMA-262 text.
    - Documentation Reviewed:
      - Spec §9, §10.
      - `proof/runtime/validate.ts` `checkTree`: a full `assertJson`, then `JSON.stringify` plus a Unicode regex for bytes, then `freeze`.
      - Part A `src/formats/tree.ts`.
    - Options Considered:
      - Keep `JSON.stringify` for the byte count: rejected. It costs about 0.64 µs per node, 43% of this plan's budget.
      - Freeze the validated tree as the proof does: rejected. The spec does not require it, it costs a full walk, and Phase 2's builder produces fresh objects. Recorded under Compromises if a renderer needs immutability.
    - Chosen Approach:
      - A single walk with incremental byte counting and a bounded error sink.
    - API Notes and Examples:
      ```ts
      const result = v.validateTree(tree, { maxErrors: 20 });
      if (!result.ok) result.errors; // [{ kind: "invalid-prop", nodeId: "root/queue/row:4812/claim", pointer: "/root/children/2/props/label", … }]
      ```
    - Files to Create/Edit:
      - `src/validate/tree.ts`: new.
      - `src/validate/bytes.ts`: new.
      - `src/__tests__/validator-tree.test.ts`: new.
  - Test Cases to Write:
    - `byte_count_equals_stringify`: on every proof tree fixture, and on trees with quotes, backslashes, control characters, emoji and CJK text, the count equals `new TextEncoder().encode(JSON.stringify(tree)).length`. Fails on any escaping mistake.
    - `identity_rules`: a duplicate id, an id not under its parent, and a root id other than `root` are each rejected.
    - `children_and_terms_rules`: children on a `none` kind, a disallowed child kind, a count outside min/max, a `term` outside `terms` and a foreign child in `terms` are each rejected.
    - `limits_fail_closed`: 5,001 nodes, depth 65 and a 1 MiB + 1 byte tree each give `limit-exceeded` without walking further. A spy on `checkNode` asserts the stop.
    - `errors_are_collected_and_bounded`: a tree with 25 independent faults returns 20 errors plus the stop entry, each with `nodeId` and `pointer`.
    - `valid_tree_returned_unchanged`: the result is the input object, not a copy and not frozen.

- [ ] Task 4: Give every spec §10 rule a failing-case test, and make the errors agent-actionable
  - Acceptance Criteria:
    - Functional:
      - `src/__tests__/validator-rules.test.ts` is a table with one row per bullet of spec §10 and per §8–§9 intent rule. Each row has a minimal invalid tree built from the proof fixtures, and the expected `kind`, `nodeId` and `pointer`.
      - Every error's `expected` text names the allowed values or bound, for example `one of: default, primary, danger, ghost`, or `a declared space name (space.0 … space.7)`. This is checked by a test that runs every row through a heuristic: no error has empty or generic `expected` text.
      - The roadmap's Phase 1 done criterion "every spec §10 check has a failing-case test" is met by this table, and the table cites each spec line it covers.
    - Performance: n/a.
    - Code Quality: the rows are data, and one loop asserts them. No per-row bespoke test logic.
    - Security: the table includes the four-laws rows: colour outside a role, raw CSS-like strings in style props, an undeclared action, and args outside the schema.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` → `references/formats.md`.
    - Library Documentation to Check Before Implementation:
      - A2UI v1.0 "Validation Error Format" (a2ui.org), the agent self-correction precedent.
    - Documentation Reviewed:
      - Spec §7.2 (kinds), §8, §9, §10.
    - Options Considered:
      - One test file per rule: rejected. A table makes a missing rule visible against the spec bullet list.
    - Chosen Approach:
      - A table plus a coverage assertion. The test also parses spec §10's bullet list and fails if a bullet has no row, so a new spec rule can't ship untested.
    - API Notes and Examples:
      ```ts
      { rule: "variants exist", mutate: (t) => (t.root.variant = "loud"), kind: "invalid-prop", pointer: "/root/variant" }
      ```
    - Files to Create/Edit:
      - `src/__tests__/validator-rules.test.ts`: new.
      - `src/validate/*.ts`: `expected` text where Task 2 or 3 left it generic.
  - Test Cases to Write:
    - `every_spec_rule_has_a_row`: fails if a spec §10 bullet has no table row.
    - `each_row_fails_as_specified`: fails if the kind, node id or pointer differs.
    - `expected_text_is_actionable`: fails on empty or generic `expected` text.

- [ ] Task 5: Measure the validator against its budget and against generic checking
  - Acceptance Criteria:
    - Functional:
      - `bench/validator.bench.ts` runs `validateTree` over the Part A tree fixtures: agent-home with 50 rows and 679 nodes; `core.queue` small, medium, large and full; git status with 52 rows; the Rack module; and the synthetic 353-node queue. It does 1,000 runs after 200 warm-ups and prints the mean ms and µs per node for each.
      - It also runs a generic baseline that walks the same tree with Part A's `checkValue` against the definitions' prop schemas, and prints the speed-up.
      - It exits non-zero if any fixture exceeds 1.5 µs per node, or if the speed-up on agent-home is below 2×.
    - Performance:
      - **≤ 1.5 µs per node** on every fixture (≤ 1.02 ms at 679 nodes).
      - Recorded in this task's Notes with the machine, Bun version and load average, as `proof/REPORT.md` §9 did.
    - Code Quality: the bench reuses committed fixtures and does not import `proof/`.
    - Security: n/a.
  - Approach:
    - Skills to Use:
      - `investigate-first`, if the budget is missed: profile before optimising.
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - Bun 1.4.2 profiling (`--cpu-prof`), via `find-docs`, only if the budget is missed.
    - Documentation Reviewed:
      - `proof/tests/agent-home.bench.ts` (warm-up and iteration pattern).
      - `decision-logs/2026-10-22-1540-typescript-runtime-render-budget.md` (the proof's 3.2 ms validate share).
    - Options Considered:
      - A `bun test` assertion on timing: rejected. Timings are load-sensitive (`proof/GAPS.md` Task 5 measured load average 12), so the bench is a separate script in the verification list, like the proof's.
    - Chosen Approach:
      - A bench script with a hard exit code, plus a loose `bun test` smoke assertion (≤ 5 µs per node) that catches order-of-magnitude regressions in CI.
    - API Notes and Examples:
      ```bash
      timeout 120 bun bench/validator.bench.ts
      ```
    - Files to Create/Edit:
      - `bench/validator.bench.ts`: new.
      - `src/__tests__/validator-smoke.test.ts`: new.
      - `package.json`: a `bench` script (`bun bench/validator.bench.ts`).
  - Test Cases to Write:
    - `validator_smoke_under_5us_per_node`: fails on a gross regression, for example a reintroduced `JSON.stringify` or a per-node regex build.

- [ ] Task 6: Publish the validator surface and its documentation
  - Acceptance Criteria:
    - Functional:
      - `src/index.ts` exports `compileValidator` and its option, result and error types.
      - `docs/formats.md` "Validation" explains, for an outsider:
        - when to compile and when to validate (per render on the backend, on arrival in the renderer);
        - the error shape;
        - limits and their defaults;
        - an example of an agent fixing a tree from the errors.
      - `.agents/skills/liveframe-execution/references/formats.md` "Today" lists the shipped modules.
      - `README.md` "Status" no longer says Phase 0 comes first.
    - Performance: n/a.
    - Code Quality: a test asserts the root export's names, so an accidental export fails.
    - Security: the docs state that validation is not authorisation, and that the host re-checks actions on dispatch (law 4).
  - Approach:
    - Skills to Use:
      - `liveframe-execution`.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - Spec §10, §13.
      - Part A `docs/formats.md`.
    - Options Considered:
      - Docs in the spec only: rejected. The spec is normative, while outsiders and agents need the worked guide.
    - Chosen Approach:
      - One guide section, plus an export-surface test.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `src/index.ts`.
      - `docs/formats.md`.
      - `README.md`.
      - `.agents/skills/liveframe-execution/references/formats.md`.
      - `src/__tests__/exports.test.ts`: new.
  - Test Cases to Write:
    - `root_export_surface`: fails if a name is added to or removed from the root export without updating the list.

- [ ] Task 7: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional:
      - Every impact area in `.agents/skills/create-plan/references/liveframe.md` §5 is recorded in `plans/evidence/004-impact-analysis.md`, or marked `None — <reason>`.
      - Every finding is executed above this task or backlogged, with the owner's answer recorded.
      - The backlog's "Phase 1 performance gate" entry is updated with the measured result, and Phase 2 Part A's share of the budget is stated.
      - The "Later-phase gaps" entry's G20 is updated, since the validator now counts code points; the renderer half remains Phase 4.
    - Performance: n/a.
    - Code Quality: findings name concrete files or spec sections.
    - Security: the four-laws area is never `None` without evidence. It must cover `bind`, action args and the arrival re-check.
  - Approach:
    - Skills to Use:
      - `create-plan` § Final task.
    - Library Documentation to Check Before Implementation:
      - None.
    - Documentation Reviewed:
      - The delivered `src/validate/`, `docs/formats.md`, the spec and the bench output.
    - Options Considered:
      - n/a.
    - Chosen Approach:
      - Sweep, present one findings table to the owner, then dispose of each finding.
    - API Notes and Examples:
      - n/a.
    - Files to Create/Edit:
      - `plans/evidence/004-impact-analysis.md`: new.
      - `plans/backlog.md`: update.
  - Test Cases to Write:
    - None.

## Verification (whole plan)

- `timeout 300 bun run check`
- `timeout 120 bun bench/validator.bench.ts` (≤ 1.5 µs per node on every fixture; ≥ 2× over generic checking on agent-home)
- `timeout 60 bun scripts/schemas.ts --check`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
