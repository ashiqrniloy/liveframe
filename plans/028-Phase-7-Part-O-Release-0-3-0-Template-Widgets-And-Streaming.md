# Phase 7 Part O: Release 0.3.0 — Template Widgets and Streamed Agent Documents

Depends on: plan [026](026-Phase-7-Part-M-Release-0-3-0-Scope-Spec-And-Breaking-Changes.md) (register, restructured spec, frozen packages, one-source formats) and plan [027](027-Phase-7-Part-N-Release-0-3-0-Formats-References-Extensions-Axes-And-Urls.md) Tasks 2 and 7 (node references and `url` strings, which templates must carry). Followed by plan [029](029-Phase-7-Part-P-Release-0-3-0-Interaction-Outcomes-Local-Bindings-And-Surface-Core.md), whose local bindings reuse this plan's expression language.

## Objectives

- Fill the hole between TSX widgets (a full language that needs a sandbox) and element JSON (static, unbound, ephemeral) with **template widgets**: element JSON plus a bounded, JSON-structured expression language, evaluated by the library in linear time with guaranteed termination. A template widget needs no sandbox, so a host can install agent- or user-authored templates without an isolation runner (W2a).
- Make templates first-class packages: packed, hashed, stored, placed, previewed, captured and authored through MCP exactly like TSX packages.
- Type-check templates at install against the manifest and capability schemas, so an agent gets `unknown-name` for a wrong data path before anything renders.
- Let a host draw an agent's element JSON progressively while it is still streaming (W2b).

## Expected Outcome

- `decision-logs/<date>-template-widgets.md` and `plans/evidence/028-template-design.md` are approved.
- A new host-API-free subpath `@arnilo/liveframe/template` exports `validateTemplate`, `renderTemplate`, `evaluate`, `checkExpression` and the `Template`/`Expr` types; `schemas/template.json` is published.
- `pack({ template, manifest, scenarios }, install)` returns a `liveframe-package/1` package whose `template` field replaces `code`; `verifyPackage`, the hash, stores and `loadPlacement` handle it.
- `templateRunner()` in `/preview` renders template packages and refuses code packages; both reference runners and the runner kit also render templates.
- `createPreview().update`, `createAuthoring().packDraft` and the MCP `pack_draft` accept template drafts; `liveframe gen --template-schema` and `generated_types({ module: "templateSchema" })` emit a per-catalog JSON Schema an LLM can target with structured output.
- `streamElements()` in `/sdk` turns a chunked element-JSON stream into a sequence of valid trees of the nodes completed so far.
- The demo host installs one template widget that reads a source and paginates through `state`.

This plan adds spec §7.6 (template widgets) and amends §3, §4 (concepts), §7.2–§7.5, §9, §10 and §13. A template changes nothing about the four laws: it is evaluated on the backend (law 1), its output is validated by the same single-pass build (law 2), it can only set catalog props and style props (law 3), and its intents are data the host re-checks (law 4). The package format keeps its id: `template` is an optional field and exactly one of `code`/`template` must be present, which a 0.2.x verifier rejects fail-closed. Nothing is published here.

## Tasks

- [x] Task 1: Design template widgets and their expression language, and record the decision
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/028-template-design.md` specifies, as numbered rules:
        - **Document.** `{ format: "liveframe-template/1", components?: Record<Name, { params: ObjectSchema, root: TemplateNode }>, root: TemplateNode }`. A `TemplateNode` is an element-JSON node (`kind`, `key?`, `variant?`, `props?`, `style?`, `events?`, `children?`, `$anchor?`) whose values may be expressions, plus directives `$if: Expr`, `$each: { in: Expr, as: Name, key: Expr }` and `$use: Name` with `with: Record<string, Expr>`.
        - **Expressions** are JSON objects with exactly one `$`-key, never parsed strings: `$path` (`"data.queue.rows"`, `"item.id"`, `"state.filter"`; segments are names or non-negative integers), `$lit` (any JSON), comparison (`$eq $ne $lt $lte $gt $gte`), logic (`$and $or $not`), `$cond` ([test, then, else]), `$coalesce`, `$len`, `$contains` (string or array), `$concat` (strings), `$join` (array, separator), `$text` (number/boolean/null to string by ECMAScript `String`), arithmetic `$add $sub $mul $div` (non-finite → evaluation error), `$round` (half-away-from-zero, 0–6 digits), `$slice` (array or string, bounded indexes), `$filter`/`$map` over arrays with a bound name, and `$get` (record lookup by computed key). No regex, no `Intl`, no time, no randomness: output is deterministic in every ECMAScript runtime.
        - **Scope.** Roots `params`, `state`, `data`, `context`, `actions` (action results from plan 029 Task 2; resolved to `{}` until then) and names bound by `$each`/`$filter`/`$map`/`$use` params. A name shadowing a root is rejected.
        - **Bounds.** Expression depth ≤ 32; ≤ 20,000 expression nodes per template; ≤ 64 components; `$use` graph acyclic and depth ≤ 16; `$each`, `$filter`, `$map` iterate only arrays from inputs, so evaluation work is bounded by input size × template size. Tree limits (§10) still apply to the output.
        - **Static checking** (`validateTemplate`): every `$path` resolves against the manifest's params/state/context schemas, the data schema built from source result schemas, or a bound name; each operator's operand types are inferred from schemas where known; a binding into a prop with a known type must be type-compatible (else `invalid-prop` at the binding); kinds, variants, events and style props are checked as for element JSON; intents' literal args and bound expressions are checked against action schemas.
        - **Errors.** Install errors point into the template document. Render-time evaluation errors (division by zero, out-of-range `$slice`, a value that fails its prop schema) are `invalid-prop` at the template pointer with the node id when known, collected up to `maxErrors`.
      - Write `decision-logs/<date>-template-widgets.md` with `create-decision-log`; the owner approves before Task 2.
    - Performance: the design sets the budget Task 4 must meet: ≤ 3 µs per output node through `renderTemplate` on a template version of the proof agent-home widget (the same bar as `render()`).
    - Code Quality: the design names the module layout (`src/template/expr.ts`, `document.ts`, `render.ts`, `stream.ts` is separate in `/sdk`).
    - Security: the design shows why templates need no sandbox — no host access, no loops beyond input arrays, no recursion, bounded work — and that law 4 holds (intents are data).
  - Approach:
    - Skills to Use: `create-decision-log`; `liveframe-execution` (formats, sdk references); `karpathy-guidelines` (smallest operator set that covers the proof widgets).
    - Library Documentation to Check Before Implementation: A2UI data-binding model and Vercel `json-render` via `find-docs`, recorded with versions, as prior art only.
    - Documentation Reviewed: spec §7.1–§7.2 (widgets, element JSON), §9; `src/sdk/elements.ts:207-260` (`renderElements`, `ephemeralManifest`); `src/formats/manifest.ts:304` (`bindSources` path grammar); the proof widgets under `src/__tests__/fixtures/widgets/` (which constructs the operator set must cover).
    - Options Considered:
      - A string expression syntax (`"{{ item.title }}"`). Rejected: needs a parser, adds ReDoS-style and injection concerns, and JSON objects are what structured LLM output produces reliably.
      - JSONata or JSON Logic. Rejected: a runtime dependency with features (regex, functions) the bound cannot cover; JSON Logic lacks static typing.
      - Run templates through the TSX runner. Rejected: defeats the point (no sandbox needed).
    - Chosen Approach: a closed JSON expression language with static checks and bounded evaluation.
    - API Notes and Examples:
      ```jsonc
      { "kind": "stack", "props": {}, "children": [
        { "$each": { "in": { "$path": "data.queue.rows" }, "as": "row", "key": { "$path": "row.id" } },
          "$use": "TaskCard", "with": { "task": { "$path": "row" } } },
        { "$if": { "$has": { "$path": "data.queue.nextCursor" } }, "kind": "button", "variant": "ghost",
          "props": { "label": "Load more" },
          "events": { "onPress": { "type": "setState", "key": "cursor", "value": { "$path": "data.queue.nextCursor" } } } }
      ] }
      ```
    - Files to Create/Edit: `plans/evidence/028-template-design.md`; `decision-logs/<date>-template-widgets.md`
  - Test Cases to Write: n/a — design; Tasks 2–7 derive their tests from its rules.
  - Notes (executed 2026-11-07):
    - Wrote `plans/evidence/028-template-design.md` (rules T1–T22) and, after owner approval, `decision-logs/2026-11-07-1200-template-widgets.md`. Prior art recorded: A2UI v0.9.1 and Vercel `json-render` v0.21.1, read through ctx7.
    - Porting the three proof widgets on paper showed the operator list here was too small. The design amends the plan as follows; Tasks 2–4 are amended below.
      1. Bare scalars are literals; arrays and objects without a `$`-key are constructors; `$lit` escapes (T5).
      2. Added operators: `$let` (node and expression forms), `$has`, `$omit`, `$findIndex`, `$at`, `$flat`, `$merge`, `$fromEntries`, `$sum`, `$split`, `$ref`, and an `index` binding (T7). Each is traced to a proof construct in the evidence table.
      3. Components are hermetic and names may not shadow (T9).
      4. Render-time fuel `limits.steps` (default 1,000,000) and string/array value caps replace "bounded by input size × template size", which nested loops and doubling `$let` chains break (T11).
      5. `$slice` clamps an end past the length (T8).
      6. A `dynamic` type binds anywhere and is checked at render; `$if` takes a boolean and presence is `$has`, so the example above changed (T13).
      7. `renderPrepared` skips input checking, so Task 4 adds an internal seam (T17).
      8. `throw` and regex sanitization are not expressible; parity is claimed over the proof scenarios, which exercise neither (T22).
    - Canonical hashing sorts keys, so no construct may depend on key order; every ordered list is an array (T6).

- [x] Task 2: The expression language: check, infer and evaluate
  - Acceptance Criteria:
    - Functional:
      - `src/template/expr.ts` exports `checkExpression(expr, scope): Result<ExprType>` (shape, bounds, path resolution, operand inference) and `compileExpression(expr, scope)` and `evaluate(expr, values, { steps? }): Result<Json | Absent>` (one table-driven evaluator: `evaluate` compiles and runs once; `renderTemplate` runs the compiled closures). The operator set is the design's T7 table, not the shorter list in the objectives. Every operator has accept and reject tests; every bound (T10 at install, T11 fuel and value caps at render) has an at-limit and over-limit test.
      - Inference uses the schema language: a path into an object schema yields the property schema; into a discriminated union, the union; from `$fromEntries` and similar, `dynamic`, which binds anywhere and is checked at render (design T12–T13); an optional expression does not bind to a required target, and `$has` narrows.
      - The module imports nothing outside the root export's internals, so `/react` can import it in plan 029 without pulling the SDK.
    - Performance: a micro-bench (`bench/template.bench.ts`) records evaluation cost per expression node; target ≤ 50 ns per node on the reference machine, recorded not gated.
    - Code Quality: one evaluator, table-driven operators; no `eval`/`Function`.
    - Security: no host API, no prototype access (`$path` segments `__proto__`, `constructor`, `prototype` are rejected at check time and own-property-only at evaluation).
    - Compatibility: `added` (new subpath, created in Task 3).
  - Approach:
    - Skills to Use: `liveframe-execution`; `typescript-advanced-types` (typed `Expr` union).
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: the design; `src/validate/schema.ts` (compiled schema checks reused for inference); `src/formats/json.ts` (JSON walk, realm rule).
    - Options Considered: evaluate without static checks. Rejected: agents need install-time errors.
    - Chosen Approach: check once at install, evaluate cheaply per render.
    - API Notes and Examples:
      ```ts
      checkExpression({ $len: { $path: "data.queue.rows" } }, scope); // { ok: true, value: { type: "integer" } }
      evaluate({ $cond: [{ $eq: [{ $path: "state.filter" }, { $lit: "all" }] }, { $lit: "All" }, { $lit: "Mine" }] }, values);
      ```
    - Files to Create/Edit: `src/template/expr.ts`; `src/template/scope.ts`; `bench/template.bench.ts`; `src/__tests__/template-expr.test.ts`
  - Test Cases to Write:
    - `every_operator_accepts_and_rejects` (table); `path_into_unknown_root_rejected`; `prototype_segments_rejected`; `fuel_exhaustion_is_limit_exceeded`; `let_doubling_hits_value_cap`; `name_shadowing_rejected`; `has_narrows_optional_path`; `round_half_away_from_zero_table`; `division_by_zero_is_evaluation_error`; `expression_depth_limit`; `deterministic_text_of_numbers` (`$text` of 0.1+0.2, -0, 1e21 matches ECMAScript).
  - Notes (executed 2026-11-07):
    - Added `src/template/scope.ts` (scope, `ExprType`, path typing, `joinSchemas`, `binds`, `narrowedBy`) and `src/template/expr.ts` (one walk that checks, infers and compiles to closures: `checkExpression`, `compileExpression`, `evaluate`, `analyzeExpression`, `OPERATORS`, `EXPR_LIMITS`, `absent`, `Frame`, `ExprFailure`). The T7 table is 38 operators, all covered by accept and reject tests (`template-expr.test.ts`, 170 tests). `bench/template.bench.ts` records 13–18 ns per node (target 50, not gated) and is already in the `bench` script, so Task 4 only adds its gate. The module imports only `errors`, `internal`, `schema` and `formats/{capabilities,json,tree}`; a test scans for `eval`, `Function`, `globalThis` and host imports.
    - Findings Tasks 3–4 build on:
      1. **Types** are `{ schema, optional, literal? }` where `schema` is a language schema or one of three markers (`dynamic`, `null`, `absent`). `literal` carries a constant's value, and `binds(type, targetSchema, required)` runs the real `checkValue` on constants (T13 rule 6) and the shape check otherwise. Task 3 calls `binds` for every prop, `setState` value and action arg, and reports `invalid-prop` at the binding.
      2. **Scope** is immutable: `rootScope({ params, state, data, context, actions })`, `componentScope(paramsSchema)`, `bindName`, `assume(scope, narrowedBy(test))`. Task 3 narrows a `$if` subtree with `assume(scope, narrowedBy(node.$if))`. One `Budget` (`nodes`, `slots`) is shared by every scope derived from a root, so the 20,000-node bound (T10) is per template as long as Task 3 passes one budget to the root scope and every component scope. After compiling, `scope.budget.slots` is the frame size.
      3. **Errors** go into a caller-supplied `documentChecks()` sink through `analyzeExpression(expr, scope, pointer, sink)`, so `validateTemplate` collects one bounded list (20 errors) across expressions. Operator pointers address the operator key (`/root/props/label/$concat/1`).
      4. **Frame**: `{ slots, steps }`, slot = scope size at binding time, so sibling scopes reuse slots. A component body is compiled against its own `componentScope` and run in its own frame; `$use` evaluates `with` in the caller's frame and fills the callee's slots (`scope.names.get(param).slot`).
      5. **Absent**: `absent` is a symbol, never JSON. Array and object constructors omit absent members, which is how `[key, optionalValue]` loses its value; `$fromEntries` therefore takes entries `[key]` or `[key, value]` and skips a key-only entry (T7 "absent values skipped"). Task 4 drops a prop whose value is `absent` (optional prop) and reports it for a required one.
      6. **Fuel**: every node costs one step, and linear-time operators on long values (`$len` of a string, `$concat`, `$join`, `$split`, `$slice`, `$contains`, `$flat`, `$sum`, `$merge`, `$fromEntries`) cost one more per 64 units, so a loop over big values cannot hide work in one step. This amends T11 and the design file records it.
      7. **Validation of the document** (cycles, accessors, foreign realms) stays with the caller: the expression modules guard shape and depth but do not call `validateJson`, so `validateTemplate` must run it first (Task 3).
      8. Inference falls back to `dynamic` (checked at render) for `$fromEntries`, mixed-kind arrays, unions in `$get`/`$merge`, and constructors holding a `null` or `dynamic` member. A path into a union resolves the tag as an enum and a property that every variant that has it agrees on (optional unless all variants require it).
    - No spec change in this task (spec §7.6 arrives with Task 3). `bun run check`: 1362 pass, 0 fail.

- [x] Task 3: The template format, its JSON Schema and install validation
  - Acceptance Criteria:
    - Functional:
      - `liveframe-template/1` is a registered format (one source, per plan 026 Task 9) with `schemas/template.json` (`$id: urn:liveframe:template:1`).
      - `validateTemplate(doc, { catalog, capabilities, manifest })` returns `Result<Template>`: structure, bounds, component graph acyclicity, directive placement and order (`$let`, `$if`, `$each`, then the body; `$each` needs `key` and the node has no `key` of its own; `$use` names a component and `with` matches its `params` schema; components are hermetic, design T3, T9), every expression checked with Task 2's scope, kinds/variants/events/style props/`refProps`/`url` props as for element JSON, intents checked against manifest actions and capability schemas (bound args type-checked).
      - Corpus: `conformance/corpus/template/` with valid and invalid cases (unknown path, cyclic `$use`, missing `$each.key`, type-mismatched binding, undeclared action).
      - `/template` subpath in `package.json` `exports` with `liveframe:source`, types and JS; host-API-free scan covers it; spec §13 table row added.
    - Performance: install validation of the agent-home template ≤ 5 ms, recorded.
    - Code Quality: reuses element-JSON node checks from `src/sdk/elements.ts` through a shared internal helper instead of copying them.
    - Security: law 2 — a template that could produce an invalid node type fails at install where statically knowable.
    - Compatibility: `added` for the subpath, schema and corpus directory.
  - Approach:
    - Skills to Use: `liveframe-execution` (formats).
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: the design; `src/formats/registry.ts`; `src/sdk/elements.ts:54-128`; `scripts/build.ts` (subpath build list); `src/__tests__/portability.test.ts`.
    - Options Considered: a template-specific node format. Rejected: element JSON is already what agents emit; templates extend it.
    - Chosen Approach: element JSON + directives + expressions as one registered format.
    - API Notes and Examples:
      ```ts
      import { validateTemplate } from "@arnilo/liveframe/template";
      validateTemplate(doc, { catalog, capabilities, manifest }); // Result<Template>
      ```
    - Files to Create/Edit: `src/template/document.ts`; `src/template/index.ts`; `src/formats/registry.ts`; `schemas/template.json`; `conformance/corpus/template/*`; `package.json` (`exports`, files); `scripts/build.ts`; `src/__tests__/portability.test.ts`; `src/__tests__/exports.test.ts`; `docs/spec.md` §7.6, §13; `register-0.3.0.json`
  - Test Cases to Write:
    - `template_unknown_path_unknown_name`; `template_cyclic_use_rejected`; `each_requires_key`; `use_with_must_match_params`; `binding_type_mismatch_invalid_prop`; `template_undeclared_action_rejected`; `template_subpath_host_api_free`; corpus runner covers `template/`.
  - Notes (executed 2026-11-07):
    - Added `src/template/document.ts` (types, `validateTemplate`, `validateTemplateShape`, `TEMPLATE_LIMITS`; one `Walk` class of small methods), `src/template/schema.ts` (the transport schema, kept apart so the schema publisher does not import validation code), `src/template/index.ts` (`validateTemplate`, `checkExpression`, `evaluate`, types), `schemas/template.json` (`urn:liveframe:template:1`, the 12th registered format), `package.json` `./template`, spec §7.6 and the §13 rows (subpath table, runtime matrix, README), formats and migration docs, CHANGELOG, 36 register entries.
    - Shared element-JSON checks: `src/sdk/element-node.ts` now owns `Reject`, `mergeSections` (props/style/events into one flat set, reserved and duplicate names), `rejectFragmentFields`, `rejectUnknownFields`; `renderElements` uses it with identical errors. `kindFacts`, `propTarget` and `dataSchema` moved to `validate/compile.ts` and `carriesFits`/`objectFits` are exported from `validate/intent.ts`, so templates classify a name and complete an intent exactly as `render()` and the tree validator do.
    - Tests: `template-document.test.ts` (40), the template corpus (17 cases; every error kind the validator can return has a failing case), the differential harness gained `template`. Install validation of the agent-home port (`fixtures/templates/agent-home.ts`, about 40% of the widget: header, status branches, groups/tabs/rows through `$use`, pager, stale, footer) takes **0.9 ms** warm (budget 5 ms; first call 11 ms including the per-catalog tables).
    - Findings for Tasks 4–6:
      1. `validateTemplate` takes **validated** `Catalog`, `Capabilities` and `Manifest` (as `validateManifest` does), not raw documents; per-catalog tables are cached in a `WeakMap`. `validateTemplateShape` (transport only, no context) is what Task 5's package shape check should call.
      2. Error kinds follow element JSON, not design T16's first draft: `unknown-component`, `undeclared-event`, `undeclared-action`, `duplicate-key`, `missing-key`, `invalid-children`; design T16 and a new T15a record this. A component root may not carry `$each` and the widget root no `$if`/`$each` or fragment, so `renderTemplate` expands a root to exactly one element and a component to at most one.
      3. `$if` is evaluated before `$each` (T3), so it cannot read `$each` names. `$let` entries and `$each` names are bound even when malformed, so one bad name reports once.
      4. A `dynamic` value binds anywhere, so Task 4 must check at render: `$if` is boolean, `$each.in` is an array, a key is a string or number of 1–128 characters, a prop value passes its schema, and a `$ref` marker resolves. Style values are checked at install only when constant.
      5. `$ref` uses are collected in the shared `Budget.refs` and resolved against the template's anchors after the walk; Task 4 should reuse the SDK's own reference resolution at render.
      6. Expression-node overflow is now reported once where it is crossed (it reported at every later node before).
      7. Structure rules are applied for statically known parents and children (through fragments and `$use` roots); child counts (min/max) are left to render because `$if` and `$each` change them.
      8. The agent-home fixture is a partial port. Task 4 extends it to full parity and re-measures install time.
    - `bun run check` passes.

- [x] Task 4: `renderTemplate`: expand, build and validate in one pass
  - Acceptance Criteria:
    - Functional:
      - `renderTemplate(template, inputs, { validator, surfaceId, revision, limits?, maxErrors? })` (`limits` gains `steps`, design T11) returns `Result<UiTree>` identical in shape and id rules to `render()`: key-path ids from `key`/`$each.key` values, `$use` expanded inline (components leave no node, like composed components), fragments for `$each` siblings, node references resolved, every emitted node validated as it is built through the existing SDK build pass (no second walk).
      - Inputs are checked against the manifest schemas once per call, as `render()` does; inputs are not mutated (plan 026 Task 3).
      - Render errors point into the template (`/root/children/0/$each/…`) and carry `nodeId` when one exists.
      - Determinism: same template and inputs → byte-identical canonical JSON tree; property test over the proof scenarios.
      - Parity: a template port of each proof widget (agent-home queue, `core.queue` at four sizes, git status panel) renders a tree deep-equal to the TSX widget's tree for every proof scenario.
    - Performance: `bench/template.bench.ts` holds ≤ 3 µs per output node on the agent-home template (680 nodes), gated in `bun run bench`.
    - Code Quality: expansion produces SDK `Element`s fed to `renderPrepared` (`src/sdk/render.ts:64`), so build/validate logic is shared, not reimplemented.
    - Security: law 2 — the output is validated by the same compiled validator; law 4 — bound action args are completed and checked like any intent.
    - Compatibility: `added` for `renderTemplate`.
  - Approach:
    - Skills to Use: `liveframe-execution` (sdk reference); `safe-refactor` if `renderPrepared` needs a small seam.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `src/sdk/render.ts:55-214,413-593`; `src/sdk/elements.ts:207`; spec §7.2.
    - Options Considered: emit `UiNode`s directly. Rejected: duplicates id, key and limit rules that `render()` owns.
    - Chosen Approach: expand to SDK elements, then the shared single-pass build.
    - API Notes and Examples:
      ```ts
      const tree = renderTemplate(template, { params, state, data, context }, { validator, surfaceId: "home", revision: 4 });
      ```
    - Files to Create/Edit: `src/template/render.ts`; `src/sdk/render.ts` (an internal seam so inputs are checked and frozen before expansion; `renderPrepared` currently passes none, design T17; export via `src/internal.ts`); `src/__tests__/fixtures/templates/*` (proof ports); `src/__tests__/template-render.test.ts`; `bench/template.bench.ts`; `package.json` `bench` script
  - Test Cases to Write:
    - `template_parity_with_tsx_proof_widgets` (every scenario); `each_key_builds_key_path_ids`; `use_leaves_no_node`; `if_false_emits_nothing`; `evaluation_error_points_into_template`; `template_render_deterministic`; `inputs_not_mutated`.
  - Notes (executed 2026-11-07):
    - Added `src/template/render.ts` (`renderTemplate`, `TemplateLimits`, `TemplateRenderOptions`; one `Compiler` class and a handful of runtime emitters), exported from `/template`. The only change to existing SDK code is a 20-line internal seam, `renderExpansion` in `src/sdk/render.ts`: it checks and copies the inputs as `render()` does, hands them to `expand`, and returns either the root `Element` (then the shared single build pass runs) or the errors that stopped expansion. `renderPrepared` is untouched. `buildFacts(validator)` gained `schemas` (the four input schemas), the one addition to `validate/compile.ts`.
    - **Compile.** A template is checked by `validateTemplateShape`, then compiled once per (frozen template, validator) into closures: `$let` → `$if` → `$each` → body, `$use` filling a callee frame, elements built as SDK `Element`s with a `WeakMap<Element, templatePointer>` so the build's errors point into the template. A first version compiled against dynamic names (no manifest needed) and failed on `$slice` with an end of `$add [index, 1]`: two dynamic operands make `$add` a `number`, not the `integer` `$slice` needs. Compiling against the validator's schemas runs exactly the install analysis, so it is the design (T23 in the design file). Cost: the first call of a template pays about 15 ms (compile) and later calls about 1.3 ms for 679 nodes.
    - **Parity.** The agent-home, core-queue (four sizes, `host-*` variants) and git-status ports render trees equal to the TSX widgets for all 19 proof scenarios (`template-render.test.ts`), plus 17 extra agent-home states: every row selected, every task escalating with an empty and a valid reason, each filter, second-page cursors. Fixtures: `fixtures/templates/{common,agent-home,core-queue,git-status}.ts`. The agent-home port is now complete (focus cards for decisions, tasks and alerts, the escalation dialog), and `core-queue` reuses it as a component through one `Entry` component whose fragment root picks exactly one branch.
    - **Finding, T22 was wrong.** git-status `ready` contains `safe\nroot` and `topic/private\nbranch`, which `labels.ts` sanitises with regular expressions the language does not have. The parity test gives the template labels already cleaned with the TSX `rootLabel` and `sanitizeText` (a source does that, per T22) and compares with the TSX tree from raw data. T22 in the design file is corrected. The plan's wording "for every proof scenario" holds with that one stated condition.
    - **Bench.** `bench/template.bench.ts` gates `renderTemplate` at ≤ 3 µs per output node on the agent-home template: 1.89–1.99 µs over 679 nodes (TSX `render()` on the same workload measures 2.1 µs). Under heavy load (load average 40) other gates in `bun run bench` (`validator.bench.ts` core-queue 1.5 µs, `render.bench.ts` agent-home wall time) flipped on one run and passed on the next; neither path changed.
    - **Public surface.** `renderTemplate`, `TemplateRenderOptions` and `TemplateLimits` are `added` in the 0.3.0 register; spec §7.6 gained the rendering rules; formats, migration, README and CHANGELOG updated.
    - Findings for Task 5: (1) the compile cache is keyed by the template object *and* the validator object, so runners must reuse one validator per (catalog, capabilities, manifest) or every render recompiles; `compileValidator` already caches per document, but the in-process and worker runners should hold the validator they build. (2) A frozen `Template` is what hits the cache: `pack()` returns deeply frozen packages, so `pkg.template` does. (3) `renderTemplate` takes `limits.steps`; the runners' `RunnerOptions.limits` must pass it through. (4) The runner kit bundle will now include `compileValidator`'s schemas export plus the template compiler; check the bundle-size test.
    - `bun run check`: 1447 pass, 0 fail.

- [x] Task 5: Template packages, stores and runners
  - Acceptance Criteria:
    - Functional:
      - `WidgetPackage` gains optional `template: Template`; exactly one of `code` and `template` is present (`invalid-document` at `/code` otherwise). The canonical hash covers whichever is present; `conformance/hash/packages.json` gains a template package vector (register entry names it).
      - `pack({ template, manifest, scenarios }, install)` validates the template (Task 3), checks scenarios as today, never transpiles, and returns a frozen package. `verifyPackage` re-validates the template against the install documents.
      - `templateRunner({ maxTemplates? })` in `/preview` implements `Runner` for template packages without loading any code; a code package is refused with `invalid-document` at `/code` and the message "templateRunner renders template packages only". `inProcessRunner`, `workerRunner` and `/runner-kit` (`renderTemplatePackage`) also render templates. All runners give byte-identical trees for the same template package and inputs.
      - `loadPlacement`, stores, `renderKey` and placements work unchanged for template packages (tests prove it).
      - `docs/security.md` adds: a template package needs no isolation runner; `templateRunner` is the recommended production runner for untrusted authors who only need templates.
    - Performance: `templateRunner` adds ≤ 5% over `renderTemplate` on the agent-home template.
    - Code Quality: one package-format change; runners dispatch on the presence of `template`.
    - Security: law 1 and the trust model — `templateRunner` executes no author code, proven by a test that a template package cannot reach `globalThis` properties (no operator reads globals).
    - Compatibility: `widened` for `widget-package.json`, `WidgetPackage`, `pack`, `verifyPackage`; `added` for `templateRunner`, `renderTemplatePackage`.
  - Approach:
    - Skills to Use: `liveframe-execution` (storage, preview references).
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `src/formats/package.ts:26-98`; `src/pack/pack.ts`; `src/pack/verify.ts:50`; `src/preview/runner.ts:19`; `src/preview/in-process.ts:44`; `src/preview/worker/index.ts:59`; `src/runner-kit/render.ts:71`; spec §7.3–§7.5.
    - Options Considered: a separate `liveframe-template-package/1` format. Rejected: every store, placement and hash path would branch on format; an optional field is the established pattern.
    - Chosen Approach: one package format with `code` xor `template`.
    - API Notes and Examples:
      ```ts
      const pkg = value(pack({ template, manifest, scenarios }, install));
      const runner = templateRunner();
      await runner.render(pkg, inputs, { catalog, capabilities, surfaceId, revision });
      ```
    - Files to Create/Edit: `src/formats/package.ts`; `src/pack/pack.ts`; `src/pack/verify.ts`; `src/pack/hash.ts` (vector); `src/preview/template.ts`; `src/preview/index.ts`; `src/preview/in-process.ts`; `src/preview/worker/*`; `src/runner-kit/*`; `scripts/runner-kit-bundle.ts`; `conformance/hash/packages.json`; schemas; `docs/spec.md` §7.3–§7.5; `docs/packages.md`; `docs/security.md`; `register-0.3.0.json`
  - Test Cases to Write:
    - `package_requires_exactly_one_of_code_or_template`; `template_package_hash_vector`; `template_runner_refuses_code_package`; `all_runners_agree_on_template_trees`; `template_package_round_trips_through_fileStore`; `template_runner_reaches_no_globals`.
  - Notes (executed 2026-11-07):
    - `WidgetPackage` gains `template?: Template` beside `code?: string`; `validateWidgetPackageShape` requires exactly one (`invalid-document` at `/code`), checks the template with the `urn:liveframe:template:1` transport schema and its 1 MiB bound (`limit-exceeded` at `/template`), and imports only `template/schema.ts` so the root export does not pull in the validator. `packageHash` hashes `{ format, manifest, scenarios }` plus whichever of `code`/`template` is present, so a code package's hash is unchanged. `schemas/widget-package.json` no longer requires `code`; the registry lists `template` before `widget-package` so Ajv resolves the reference.
    - `pack()` takes a code draft or `{ template, manifest, scenarios }`. The template is validated inside `validatePackageInputs` (so `verifyPackage` re-validates it against the install documents), with template errors keeping their kinds at `/template/…`; `verifyPackage` skips the module check for a template package.
    - Runners: `templateRunner()` (`src/preview/template.ts`) refuses a code package (`invalid-document` at `/code`, "templateRunner renders template packages only"), verifies the hash like the others, and renders through `renderTemplateRun`, which `renderPackage` also calls, so `inProcessRunner` and the worker entry dispatch on `pkg.template` with no second path. `/runner-kit` gains `renderTemplatePackage(template, inputs, options)` and an internal `renderTemplateWidget`; `renderModule` shares a small `manifestKeyOrErrors` helper with it. Template packages count toward neither `maxModules` nor `maxPackages`, since nothing is loaded. `RunnerOptions.limits` and `RenderModuleOptions.limits` now accept `steps` (design T11).
    - Deviations from the task text. (1) `templateRunner({ maxTemplates? })` takes no options: nothing is loaded, the template compile cache is a `WeakMap`, and the validator LRU is already bounded at 64, so there was nothing for a bound to protect. (2) The template hash vector is a new file, `conformance/hash/template-packages.json`, not an entry in `packages.json`: changing an existing vector file needs a `changed` break entry with a migration heading, and an `added` file does not; the vector's hash was computed independently in Python. Four package corpus cases (`template-valid`, `-and-code`, `-unknown-path`, `-hash-mismatch`) were added likewise. (3) The type is `{ code?: string; template?: Template }` rather than a discriminated union: `undefined`-typed union members broke `Json` assignability and spreads, and the shape check is the guarantee.
    - Tests: `template-package.test.ts` (17): exactly-one rule, frozen/verified package, hash covers the template, errors under `/template`, `templateRunner` refusals, all four render paths (templateRunner, inProcess, worker, runner kit) byte-identical over every agent-home scenario, `limits.steps`, one validator per package, no-global reach (install rejects `globalThis`/`process`/`constructor`/`__proto__` paths; a hand-built hostile package renders an error and leaks nothing), `memoryStore` and `fileStore` round trips through `loadPlacement`, `version-conflict`, `renderKey`. Hash-vector, corpus, schema, export-surface and API-stability tests were extended; 8 register entries plus 2 for `limits.steps`.
    - Bench: `bench/template.bench.ts` gates `templateRunner` at ≤ 5% over `renderTemplate` on the agent-home template: measured within noise (−5% to +1%).
    - Docs: spec §7.3 (type, hash, `pack`, `verifyPackage`), §7.5 (template packages need no isolation runner, `templateRunner`, `renderTemplatePackage`), §7.6 (Packages), §13 rows; `docs/security.md` (new section), `docs/packages.md#template-packages`, `docs/migration-0.3.md#template-packages`, `docs/formats.md`, `docs/preview.md`, README, CHANGELOG.
    - Findings for Task 6: `createPreview().update` and `packDraft` should call `pack()` with the new draft shape and need no other change, because `pack()` already returns the package and the runner is passed in; a preview session with `templateRunner()` works for template drafts only. `PreviewSession.update` types its draft as the code draft, so Task 6 widens it.
    - `bun run check`: 1464 pass, 0 fail.

- [ ] Task 6: Templates in preview, authoring, MCP and codegen
  - Acceptance Criteria:
    - Functional:
      - `createPreview().update` accepts `{ template, manifest, scenarios }`; `<Preview>` and capture are unchanged (trees only).
      - `createAuthoring().packDraft` and MCP `pack_draft` accept `{ template, manifest, scenarios }` inline and, with `draftRoot`, a directory holding `template.json`. Errors are `LiveframeError[]` rooted at the template document.
      - `generateTemplateSchema(catalog, { manifest?, capabilities? })` in `/sdk/gen` emits a self-contained per-catalog JSON Schema for templates (component props typed per kind; with a manifest, `$path` enumerations of known paths). `liveframe gen --template-schema` and `generated_types({ module: "templateSchema" })` expose it, byte-identical; drift checked by `gen:check`.
      - The schema is accepted by the structured-output subsets documented for current LLM APIs (checked with `find-docs`, recorded in the task notes); where a subset forbids a keyword, `--structured-subset` emits the reduced form.
      - `docs/templates.md`: an outsider guide with the full operator table, a worked queue widget, the static errors an agent will see, and when to choose TSX instead. The demo host gains one template widget installed at runtime.
    - Performance: n/a beyond Task 4's gate.
    - Code Quality: reuses the elements-schema emitter's structure.
    - Security: law 4 — MCP tools still never dispatch actions; templates add no new tool authority.
    - Compatibility: `widened` for `createPreview`, `createAuthoring`, `AuthoringConfig`, MCP `pack_draft` input schema, `generated_types`; `added` for `generateTemplateSchema`.
  - Approach:
    - Skills to Use: `liveframe-execution` (preview reference); `find-docs` (MCP SDK 2.4.0 tool schemas; LLM structured-output JSON Schema subsets).
    - Library Documentation to Check Before Implementation: `@modelcontextprotocol/server` 2.4.0 tool input schemas; current structured-output schema restrictions of major LLM APIs.
    - Documentation Reviewed: `src/authoring/index.ts:377`; `src/preview/session.ts:101-110`; `docs/mcp.md`; `src/sdk/gen.ts` (`generateElementsSchema`); spec §13 MCP tools.
    - Options Considered: a separate MCP tool for templates. Rejected: `pack_draft` is the draft entry point; one more input shape keeps eight tools.
    - Chosen Approach: widen the existing operations.
    - API Notes and Examples:
      ```sh
      liveframe gen catalog.json --template-schema --manifest manifest.json --capabilities capabilities.json --out template.schema.json
      ```
    - Files to Create/Edit: `src/preview/session.ts`; `src/authoring/*`; `src/cli/*` (MCP, gen); `src/sdk/gen.ts`; `package.json` `gen:check`; `src/__tests__/fixtures/widgets/template.schema.json`; `docs/templates.md`; `docs/mcp.md`; `docs/preview.md`; `docs/sdk.md`; `README.md`; `examples/demo-host/widgets/*`; `examples/demo-host/install-widget.ts`; `register-0.3.0.json`
  - Test Cases to Write:
    - `preview_session_renders_template_draft`; `mcp_pack_draft_template_inline`; `mcp_pack_draft_template_directory`; `template_schema_cli_matches_function`; `template_schema_validates_proof_templates` (ajv, test-only); `demo_installs_template_widget` (demo:test).
  - Notes (executed <date>):

- [ ] Task 7: Draw streamed element JSON progressively (W2b)
  - Acceptance Criteria:
    - Functional:
      - `/sdk` exports `streamElements({ validator, surfaceId, limits?, maxErrors? })` returning `{ push(chunk: string): Result<UiTree> | undefined; end(): Result<UiTree> }`. It parses JSON incrementally (host-API-free, linear, bounded by `limits.bytes`), and after each chunk returns a new tree (revision + 1) when the set of **completed** nodes changed: a node is included once its object closed and validated; an incomplete node and its siblings after it are omitted; a completed node whose required props fail is an error for `end()` but is omitted (not fatal) mid-stream.
      - `end()` returns the same result as `renderElements` on the whole document (property test over the proof element documents chunked at every byte boundary for small cases and random boundaries for large ones).
      - Successive trees are valid `diffTrees` inputs, so a host streams patches; `docs/sdk.md` shows the loop with `diffTrees` and `<Surface>`.
      - Malformed JSON is `invalid-document` at the byte offset (`/$stream/<offset>`), reported immediately.
    - Performance: total work over a stream is O(document size); bench a 680-node document in 64-byte chunks: total ≤ 3× `renderElements` on the whole document.
    - Code Quality: one incremental tokenizer in `src/sdk/stream.ts`; no dependency.
    - Security: law 2 — every emitted tree is a validated tree.
    - Compatibility: `added` for `streamElements`.
  - Approach:
    - Skills to Use: `liveframe-execution` (sdk reference).
    - Library Documentation to Check Before Implementation: none (ECMA-404 grammar).
    - Documentation Reviewed: spec §7.2 (element JSON), §9.1 (patches); `src/sdk/elements.ts`; `plans/evidence/021-streaming-patches.md`.
    - Options Considered: repair partial JSON by closing brackets and re-running `renderElements` per chunk. Rejected: O(n²) over a stream and includes half-written nodes.
    - Chosen Approach: incremental parse, include only completed nodes.
    - API Notes and Examples:
      ```ts
      const stream = streamElements({ validator, surfaceId: "chat-42" });
      for await (const chunk of llm) { const tree = stream.push(chunk); if (tree?.ok) send(diff(prev, tree.value)); }
      const final = stream.end();
      ```
    - Files to Create/Edit: `src/sdk/stream.ts`; `src/sdk/index.ts`; `bench/streaming.bench.ts`; `docs/sdk.md`; `docs/spec.md` §7.2; `register-0.3.0.json`
  - Test Cases to Write:
    - `stream_end_equals_renderElements` (property); `incomplete_node_omitted`; `malformed_json_reports_offset`; `stream_trees_diff_cleanly`; `stream_respects_byte_limit`.
  - Notes (executed <date>):

- [ ] Task 8: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: the twelve impact areas swept in `plans/evidence/028-impact-analysis.md`, with special attention to the trust model (templates without a sandbox) and agent authoring; findings presented, dispositions recorded and executed or backlogged.
    - Performance: `bun run bench` including the new template and streaming benches.
    - Code Quality: findings cite `file:line`.
    - Security: an explicit review that no template operator reaches a global, a prototype or unbounded work.
  - Approach:
    - Skills to Use: `create-plan`; `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: this plan's notes.
    - Options Considered: n/a.
    - Chosen Approach: the standard final task.
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `plans/evidence/028-impact-analysis.md`; `plans/backlog.md`.
  - Test Cases to Write: n/a.
  - Notes (executed <date>):

## Verification (whole plan)

- `timeout 900 bun run check`
- `timeout 900 bun run bench`
- `bun run demo:test`
- `bun src/cli/liveframe.ts mcp examples/demo-host/mcp.config.ts` driven by `cli-mcp.test.ts` (template draft round trip)

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
