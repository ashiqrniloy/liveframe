# Phase 7 Part Z: Agent-Generated UI

Depends on: plan [033](033-Phase-7-Part-T-Review-Defects-And-Release-Scope.md) Task 1 (the scope decision places this plan in 0.4.0 and answers whether the "A2UI or other wire interop" non-goal is lifted) and plan [037](037-Phase-7-Part-X-Interaction-Capabilities.md) complete (`register-0.4.0.json`; local writes, array carries and the sibling count, which element JSON and the new primitives use). Independent of plan [038](038-Phase-7-Part-Y-Rendering-Capabilities.md); run after it by number. Source: findings F9–F12 and one G3 backlog item of the 2026-11-15 review (table in plan 033).

## Objectives

- Approve one design for the agent-facing additions before any is built.
- Let an agent that writes element JSON ask for a live filter or a conditional node.
- Give an agent that is not on MCP a compact, deterministic description of a catalog.
- Convert A2UI documents to element JSON in a separate package, if the owner lifts the non-goal.
- Widen the starter with the primitives agent-written UI asks for first.

## Expected Outcome

- `plans/evidence/039-agent-ui-design.md` and an approved decision log fix the forms, rules, budgets and spec text for each item.
- `renderElements` and `streamElements` accept `when`, `bind` and `setLocal` with a `local` schema supplied beside the document; the published element schema describes them.
- `liveframe gen <catalog> --digest --out <file>` writes a digest under a stated size, checked for drift in CI, and the agent acceptance run uses it.
- `@arnilo/liveframe-a2ui` turns an A2UI document into element JSON through an app-supplied mapping, or the decision records that the non-goal stands and Task 4 is closed without code.
- `@arnilo/liveframe-starter` ships the controls and content primitives the design approves, each passing every conformance suite.

This plan implements the agent part of the proposed 0.4.0 capability work in roadmap Phase 7. Two items touch spec §14: a digest is "agent tooling beyond generated typed component modules", and a converter is "A2UI or other wire interop". Task 1 puts both to the owner; neither is built without the answer. The starter additions live in the starter package only: the core still ships no components (spec §3). The shapes in Tasks 2–6 are the proposal; a task is amended before it starts if the decision differs. No version is bumped and nothing is published. Spec sections touched: §5 (primitive set), §7.2 (element JSON, codegen), §8 (local bindings), §13 (packages), §14 (non-goals).

## Rules for every task

1. **An agent's output is hostile input.** Everything an agent writes passes the compiled validator before it is drawn (law 2, `docs/security.md:58`). A converter or a digest adds no path around it.
2. **Primitives only.** A starter kind is added only when the browser must do something no composition of existing kinds does (spec §1, §5). The design records that test for each kind, and a kind that fails it becomes a documented composition instead.
3. **No new runtime dependency** in the core. A starter or converter dependency needs the design's written justification (roadmap §1).
4. **Register and format chores** as in plan 037's rules 2–3; the companion packages' baselines (`scripts/release/api/0.3.0-starter.json`) gain successors.

## Tasks

- [x] Task 1: Design the agent-facing additions and record the decision
  - Acceptance Criteria:
    - Functional:
      - `plans/evidence/039-agent-ui-design.md` specifies each of F9–F12: forms, rules with error kinds and pointers, budgets, spec text.
      - It answers, with a reason each: (F9) how a `local` schema and its initial values accompany an element JSON document (proposed: fields of `ephemeralManifest`'s input, never fields the agent writes into the document), and which of plan 037's additions element JSON may use. (F10) what the digest contains, its format, its size budget on the proof and starter catalogs, and whether the MCP server exposes it. (F11) the A2UI version targeted, read from its current specification, which of its constructs map to element JSON, which are refused, and how an app supplies the component mapping. (F12) the list of starter kinds, each with the rule-2 test, its definition sketch, its accessibility pattern and its dependency, if any.
      - A decision log, written with `create-decision-log` after the owner approves, records the design and the owner's answer on each of the two §14 non-goals. A "no" closes the matching task with that reference.
    - Performance: the design sets the digest's size budget and the element-JSON arrival budget with expressions present.
    - Code Quality: the design names what stays the app's: the A2UI component mapping, the chart's data shaping, any primitive beyond the list.
    - Security: a paragraph per law for each item; for F11, that the converter's output is validated like any element JSON; for the content primitives, that no HTML or URL reaches the DOM unchecked.
  - Approach:
    - Skills to Use:
      - `create-decision-log`.
      - `liveframe-execution` — `references/sdk.md`.
      - `find-docs` — the A2UI specification and React Aria Components.
    - Library Documentation to Check Before Implementation:
      - A2UI: the current specification and version, fetched at design time; nothing about its format is assumed from memory.
      - React Aria Components at the starter's peer floor `^1.22.0` and the locked version: which of the candidate controls it provides (radio group, slider, date field, meter and progress bar, table).
    - Documentation Reviewed:
      - Spec §1, §3, §5 (primitive set), §7.2 (element JSON, `liveframe gen`), §13, §14; `decision-logs/2026-10-22-0902-authoring-mcp-server-for-coding-agents.md`; `plans/evidence/032-agent-acceptance.md`; `plans/backlog.md` "Add `when` and `bind` to element JSON", "Small findings from the 0.3.0 agent acceptance run", "Make the template structured-output schema usable in strict modes".
    - Options Considered:
      - Decide each item in its task — rejected: F9 and F10 both define what an agent is told it may write, and must agree.
    - Chosen Approach:
      - One design file, one decision, then the tasks.
    - API Notes and Examples:
      ```bash
      liveframe gen catalog.json --digest --capabilities capabilities.json --out catalog.digest.md   # F10 proposal
      ```
    - Files to Create/Edit:
      - `plans/evidence/039-agent-ui-design.md`; `decision-logs/<date>-agent-ui-additions-for-0-4-0.md`.
      - This plan: Tasks 2–6 amended where the decision differs.
  - Test Cases to Write:
    - none; the design lists the tests each task must write.
  - Notes (executed 2026-11-19):
    - Wrote `plans/evidence/039-agent-ui-design.md` (rules `E.*`, `G.*`, `A.*`, `C.*`, `T.*`). Sources: A2UI from a2ui.org via `find-docs` (Context7 `/websites/a2ui`) and direct fetches of the v0.9.1 specification, the v0.9 basic catalog and `common_types.json`; React Aria Components via `find-docs` (`/websites/react-aria_adobe`), checked against the locked 1.22.1 declarations.
    - The owner approved the design, the §14 rewording for the digest and the A2UI scope trims. Recorded in `decision-logs/2026-11-19-2034-agent-ui-additions-for-0-4-0.md`. Both §14 items are answered "yes", so Tasks 3 and 4 stay active.
    - **F9 (differs from the proposal):** `ephemeralManifest` gains `local` and `initialLocal`. A document that carries `local` is `invalid-prop` at `/local` ("no such element field", the existing unknown-field error), not `invalid-document`. `streamElements` needs no "only once complete" rule: a shell is drawn only after its own members, `when` and `bind` included, are final. Every plan 037 addition is allowed. MCP has no element-JSON tool, so only `generated_types` `elementsSchema` takes `local`. Task 2 amended.
    - **F10 (differs from the proposal):** Markdown, with budgets of 20,000 characters (proof catalog with its fixture capabilities) and 24,000 (starter after Tasks 5–6), from a prototype measuring 13,335 and 14,065. MCP exposes it as `generated_types` `module: "digest"`. It takes `local` too. The "internal in `meta`" rule is dropped, because the library never reads `meta` (spec §7.3). Task 3 amended.
    - **F11:** `fromA2ui(messages, mapping, options?)` → `Result<{ elements, initialLocal, origins }>` for A2UI v0.9 and v0.9.1, as a snapshot only. Refused: client functions except `formatString` over data paths, `functionCall` actions, `svgPath`, `sendDataModel`, `deleteSurface`, a second surface, and shared or unreachable components. `theme`, `weight` and `checks` are refused unless `drop` names them. Task 4 amended.
    - **F12 (differs from the proposal):** the controls are as proposed. The content kinds are `richText`, `chart` and a kind triple `table` + `tableRow` + `tableCell`: the `ariaRoles` allowlist excludes the table roles, so a `semantics` value cannot carry them. There is one new starter peer, `@internationalized/date`, for `dateField`, and one new root export, `checkUrl` with `UrlRule`, for `richText` links. Tasks 5–6 amended.
    - Backlog handoff at plan end: incremental A2UI conversion, A2UI v1.0, a `meter` kind, an interactive table, and parent rules for definitions.
    - Not committed (plans 033–038 remain uncommitted together). `bun run check` was not affected: only plan, evidence and decision-log Markdown changed.

- [x] Task 2: Accept `when`, `bind` and `setLocal` in element JSON (F9)
  - Acceptance Criteria:
    - Functional:
      - An element JSON node may carry `when` and `bind`, and an event may offer `setLocal`, checked by the same rules a TSX widget's are (spec §8): well formed, bounded, `local.<key>` declared, `bind` targets bindable and type-fitting.
      - The `local` schema and `initialLocal` come from the caller, through `ephemeralManifest({ catalogId, actions, state?, local?, initialLocal? })` (`src/sdk/elements.ts:245`). `initialLocal` is required with `local` (design E.5). A document cannot declare them: `local` on an element is `invalid-prop` at `/local` (E.4). Without a supplied `local`, an expression may read `self` only and `setLocal` is `unknown-name`, as today's rules give.
      - `streamElements` draws a shell with its `when` and `bind`. They are own members, final before `children` (E.6), so no new hold-back rule is needed. It applies the per-tree expression bound (10,000 expression nodes) to every tree drawn and to `end()`.
      - `Elements<C>` gains `when`, `bind` (bindable props only) and `TreeIntent` events.
      - `generateElementsSchema(catalog, { local })` describes the expression grammar and the allowed `local` keys (E.7). Without `local`, the schema it writes is byte-identical to today's.
      - Every plan 037 addition is accepted under its own rules: local writes on an intent, `fromLocal`, the `shown` sibling count, array carries and `focus`.
    - Performance: a document without expressions costs what it costs today in `bench/stream-elements.bench.ts`, and an A/B run of `renderElements` (`bench/ab.ts`) is within 2%. A new row runs agent-home with a filter field and a `when` on each row: `renderElements` at most 1.3× the expression-free document, and `streamElements` within its 3× budget.
    - Code Quality: element JSON reuses the build pass's attachment (`src/sdk/render.ts:1040-1061`) and the validator's binding check; no second expression checker.
    - Security: law 1 — expressions are the closed tree-expression allow-list, evaluated with fuel (`src/surface/bindings.ts:14`); law 2 — the tree still passes the compiled validator. An agent cannot widen `local`: it is the caller's.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/sdk.md`.
    - Library Documentation to Check Before Implementation:
      - none; read `src/sdk/elements.ts:168-260`, `src/sdk/stream.ts`, `src/sdk/gen.ts:383-455`, `src/validate/bindings.ts`.
    - Documentation Reviewed:
      - Spec §7.2 (element JSON), §8 ("Local state and bindings", the limits); `docs/security.md:58`; `plans/backlog.md` "Add `when` and `bind` to element JSON" (the question this answers); `src/__tests__/sdk-elements.test.ts`, `sdk-stream.test.ts`.
    - Options Considered:
      - Let the document carry its own `local` schema — rejected: the agent would set its own bounds; the schema is the app's contract.
      - Keep live filters to TSX and templates — the status quo: an agent writing JSON cannot ask for one.
    - Chosen Approach:
      - Caller-supplied `local`, the same checks, one schema option.
    - API Notes and Examples:
      ```ts
      const manifest = ephemeralManifest({ catalog, local: obj({ q: str({ maxLength: 80 }) }), initialLocal: { q: "" } });
      renderElements(doc, { validator: compileValidator({ catalog, capabilities, manifest }), surfaceId, revision });
      ```
    - Files to Create/Edit:
      - `src/sdk/element-node.ts` (`ELEMENT_KEYS`), `src/sdk/elements.ts`, `src/sdk/stream.ts`: the fields.
      - `src/sdk/gen.ts`: the schema option; `src/cli/liveframe.ts`: a `--local <file>` flag for `--elements-schema`.
      - `src/cli/mcp.ts` and `src/authoring/`: `generated_types` `module: "elementsSchema"` takes an optional `local`. No MCP tool renders element JSON (E.8).
      - `src/__tests__/fixtures/widgets/elements.schema.json` (regenerated by `gen:check`).
      - `conformance/corpus/elements/`: cases with expressions.
      - `scripts/release/api/register-0.4.0.json`.
      - `docs/spec.md` §7.2, §8; `docs/sdk.md`; `docs/mcp.md`; `plans/backlog.md` (close the entry); `CHANGELOG.md`.
  - Test Cases to Write:
    - `element_json_live_filter_hides_rows_without_a_round_trip`: rendered, accepted by a surface core, a `setLocal` emit hides the non-matching rows.
    - `element_json_cannot_declare_local`: a document with a `local` field is `invalid-prop` at `/local`.
    - `expression_reading_an_undeclared_local_key_is_unknown_name`, `element_json_without_local_reads_self_only` and `ephemeral_manifest_requires_initial_local_with_local`.
    - `stream_draws_a_bound_shell_with_its_expressions` and `stream_enforces_the_tree_expression_bound`.
    - `element_json_accepts_from_local_and_compound_local_writes`.
    - Type-level: `elements_type_accepts_set_local_and_rejects_binding_a_ref_prop`.
    - `elements_schema_without_local_is_unchanged`: equal to the stored 0.3.0 schema.
    - `generated_schema_accepts_the_valid_corpus_and_rejects_the_invalid` (with `ajv`, a dev dependency already).
  - Notes (executed 2026-11-19):
    - `when` and `bind` joined `ELEMENT_KEYS`; `elementProps` copies them with `focus` onto the element, so the build pass's `attachExpressions` and the validator's `compileBindings` check them unchanged (no second checker). `ephemeralManifest` takes `local` and `initialLocal` (both or neither, `initialLocal` checked with `compileSchema`, `TypeError` otherwise); `compileValidator` holds `local` to the §7.1 rules. `Elements<C>` gained `when`, `bind` (bindable props only) and `TreeIntent` events.
    - `generateElementsSchema(catalog, { local })` (new `ElementsSchemaOptions`) adds `when`, `bind`, `$defs.expr`/`operator` (the template operands filtered by `TREE_OPERATORS`, `$path` limited to `local.<key>`, `shown` and `self.<prop>`), a `setLocal` branch and the declared keys in `local` writes and `fromLocal`. Without `local` the bytes are unchanged; the stored fixture is the one plan 037 already widened, not 0.3.0's, so the test compares with the stored file. `liveframe gen --elements-schema --local <file>` and MCP `generated_types` `local` check the schema through a new internal `validateLocal` (`src/formats/manifest.ts`), with errors at `/local/...`. `main` in the CLI and `generatedTypes` were split (`genOutput`, `elementsSchemaModule`) to stay under the lint complexity bound.
    - Finding (E.6): the build carried one expression total per tree, but a node over the 10,000 bound only failed itself, so `streamElements` went on drawing later nodes into trees a surface then rejected. The bound now stops the build like the byte budget (`checkNode` in `src/sdk/render.ts`): `render()`, `renderElements` and `streamElements` report it once and build nothing past it. Spec §7.2 and §8 say so.
    - Finding: `mergeSections` reserved only `key`, `children`, `variant` and `$anchor`, so `props.when` was read as the node's `when`. `when`, `bind` and `focus` are now refused in any section (`invalid-prop` at the member), in element JSON and templates. The backlog entry "Reserve `when`, `bind` and `focus` as prop names in catalogs" is marked partly done; its catalog half remains. `tree-rule-parity.test.ts` had relied on that path (it moved a tree's `when`/`bind` into `props`); it now writes them as element fields, and the walk, build and stream give the same pointers (`/children/0/bind/text`). The reserved check uses an array, not a `Set`, so `sdk-build-work.test.ts`'s recorded `setHas` count is unchanged.
    - Corpus: `conformance/corpus/elements/` gains `expressions-valid`, `local-field`, `when-unknown-local`, `set-local-without-local`, `bind-type-mismatch` and `when-in-props`; `unknown-name` joined the elements kinds in `corpus.test.ts`.
    - Tests: `src/__tests__/elements-bindings.test.ts` holds the eleven listed tests; `cli-mcp.test.ts` gained `elements_schema_with_local_matches_cli_bytes`. The schema test accepts `bind-type-mismatch`: types stay the validator's, as the design says.
    - Bench: `bench/stream-elements.bench.ts` gained the agent-home row with a filter field and a `when` on each of its 56 keyed row boxes (`stream.agentHomeFiltered.*`, budgets 1.3× and 3×); it is skipped on an A/B base that takes no `when`. The host ran unrelated Rust builds and VMs throughout (load 18–28 on 16 cores). Single runs gave a filtered/plain ratio of 0.84–1.33× and the stream at 1.9–2.4× its render; the existing stream row moved between 2.2× and 3.2× with and without this change. An A/B (`bench/ab.ts`, 7 rounds, base = this tree with the Task 2 core edits reverted) gave head/base CPU 0.930 [0.805, 0.993] for `renderElements` and 0.956 [0.833, 1.011] for the stream, a control the driver called unusable. No regression showed, but the 2% claim needs a rerun on a quiet host (Task 7's sweep).
    - Docs: spec §7.2, §8, §13 (`liveframe gen`, `generated_types`); `docs/sdk.md` ("Live filters in agent JSON", streaming notes); `docs/mcp.md`; `CHANGELOG.md`; `plans/backlog.md` (closed "Add `when` and `bind` to element JSON"); `register-0.4.0.json` (`Elements`, `ephemeralManifest`, `generateElementsSchema`, `ElementsSchemaOptions`, `/authoring` `createAuthoring`; `renderElements` and `streamElements` keep their declarations, so the API gate wants no entry for them).
    - `bun run check`: build, `gen:check`, typecheck, lint and format pass; 2,056 tests pass. The one failure in the last full run was the starter's chromium `switching_keeps_nodes_and_focus_and_rerenders_nothing` (a Playwright `focus` timeout of 10 s at host load 13–28). It passed in the earlier full run and passes alone (`packages/starter/src/__tests__/browser.test.ts`, 16/16), and it touches no element JSON.
    - Not committed, like Task 1 (plans 033–038 remain uncommitted together).

- [x] Task 3: Generate a catalog digest for agents (F10)
  - Acceptance Criteria:
    - Functional:
      - Approved, with §14 reworded (`decision-logs/2026-11-19-2034-agent-ui-additions-for-0-4-0.md`). `generateDigest(catalog, { capabilities?, local?, budget? })` in `/sdk/gen` returns one Markdown document holding the sections of design G.1, in order: header; writing element JSON, with an example built from the catalog's own kinds; expressions (only with `local`); style values; kinds with descriptions, props with types and bounds, variants and axes, events with their carries, and child rules; actions and sources with their schemas.
      - It is deterministic: the same documents give the same bytes, in catalog order.
      - `liveframe gen <catalog> --digest [--capabilities <file>] [--local <file>] --out <file> [--check]` writes or checks it. With `--budget <chars>` it fails, naming the overrun, when the digest is longer (`LiveframeFailure`, `limit-exceeded` at `/digest`). It never truncates silently.
      - MCP `generated_types` accepts `module: "digest"`, built from the server's catalog and capabilities (G.7).
      - `gen:check` covers a digest of the proof catalog and of the starter catalog. The starter ships its digest.
      - `scripts/agent-acceptance/` runs once with the digest as the agent's only description of the catalog; the outcome is recorded in `plans/evidence/039-agent-acceptance.md`.
      - `deprecated` kinds and props are marked. The library never reads `meta` (spec §7.3): the app passes only the documents it wants described (G.5).
    - Performance: generation is linear in catalog size. The proof catalog's digest with its fixture capabilities is at most 20,000 characters, and the starter's at most 24,000 after Tasks 5–6. `gen:check` enforces both with `--budget`.
    - Code Quality: it reads the same definitions `generate()` reads (`src/sdk/gen.ts:210`); no second description of the catalog is maintained by hand.
    - Security: the digest is built from the app's own installed documents; it includes no file path, no capability implementation detail and no theme or design-system values. A test scans it for absolute paths.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/sdk.md`.
    - Library Documentation to Check Before Implementation:
      - none; read `src/sdk/gen.ts:210-455`, `src/cli/liveframe.ts:117-283`, `scripts/agent-acceptance/`.
    - Documentation Reviewed:
      - Spec §7.2 (`liveframe gen`), §13 (the MCP tools that list primitives), §14; `docs/mcp.md`; `docs/demo-agent.md`; `plans/evidence/032-agent-acceptance.md`.
    - Options Considered:
      - Point agents at the generated `.d.ts` — rejected: it carries TypeScript machinery an agent writing JSON does not need, and no descriptions of actions or sources.
      - Point agents at the JSON Schemas — rejected: several times the size for the same facts.
    - Chosen Approach:
      - One generated text, size-checked, drift-checked.
    - API Notes and Examples:
      ```ts
      import { generateDigest } from "@arnilo/liveframe/sdk/gen";
      const text = generateDigest(catalog, { capabilities, budget: 12_000 });
      ```
    - Files to Create/Edit:
      - `src/sdk/gen.ts`: `generateDigest`.
      - `src/cli/liveframe.ts`: the flags; `package.json` `gen:check`.
      - `src/cli/mcp.ts` and `src/authoring/`: the `digest` module of `generated_types`.
      - `src/__tests__/fixtures/widgets/catalog.digest.md`, `packages/starter/src/catalog.digest.md` (generated).
      - `packages/starter/package.json` `exports` and `files`.
      - `scripts/agent-acceptance/`: the digest run.
      - `scripts/release/api/register-0.4.0.json`.
      - `docs/spec.md` §7.2, §14; `docs/sdk.md`; `docs/mcp.md`; `docs/demo-agent.md`; `README.md`; `CHANGELOG.md`.
  - Test Cases to Write:
    - `digest_names_every_kind_prop_variant_event_action_and_source`: fails when a catalog entry is missing from the text.
    - `digest_is_deterministic`: two runs, equal bytes; a reordered-key copy of the catalog gives the same text.
    - `digest_over_budget_fails_with_the_overrun`.
    - `digest_holds_no_paths_and_no_design_values`.
    - `gen_check_detects_a_stale_digest`.
    - `digest_example_renders_through_render_elements`, `digest_lists_local_keys_only_when_given` and `mcp_generated_types_returns_the_digest`.
  - Notes (executed 2026-11-19):
    - `generateDigest(catalog, { capabilities?, local?, budget? })` and the `DigestOptions` type were added to `src/sdk/gen.ts`. They read the same validated definitions as the other emitters. The style section groups style props by `styleTypes`, the existing emitted-type table. The operator arity lines come from `operatorOperands`, filtered by `TREE_OPERATORS`, and the limits come from `TREE_EXPRESSION`, `MAX_BINDINGS`, `MAX_TREE_EXPRESSION_NODES` and `DEFAULT_LIMITS`. Nothing is described by hand.
    - Kinds keep catalog order. Props, events, axes, tones, union tags, actions and sources are sorted. Event descriptions are left out because every catalog's are boilerplate ("The onPress event."). Prop descriptions are kept.
    - The example takes the first non-deprecated `children: "any"` kind and the first leaf with a required plain string prop. Their required props get sample values. With `local`, each row gets a `$contains` `when` over `self.<prop>` and the first string local key. If the catalog has no such pair, the example is omitted.
    - CLI: `liveframe gen --digest [--capabilities] [--local] [--budget]`. `--capabilities` and `--local` are now accepted with `--digest`. An over-budget digest exits 1 with the `limit-exceeded` error. A bad flag exits 2. MCP `generated_types` accepts `module: "digest"` with an optional `local`, using the server's capabilities. Its note names `catalog.digest.md`.
    - `gen:check` writes and checks both stored digests: `src/__tests__/fixtures/widgets/catalog.digest.md` (16,198 characters, `--budget 20000`) and `packages/starter/src/catalog.digest.md` (14,943, `--budget 24000`). With the demo capabilities and `local`, the starter digest measured 17,763 before Tasks 5–6.
    - The starter ships its digest as `./catalog.digest.md`. tsc does not copy the file, so a new `packages/starter/build.ts` copies it into `dist/`. This uses the per-package hook `scripts/build.ts` already runs. `archive-smoke.ts` resolves the file and checks its header.
    - Finding: the host-API scans (`portability.test.ts`) match `\bself\s*[.[]` and `document.` anywhere in `src` and the bundles, including string literals and comments. The digest builds `self.<prop>` with `["self", name].join(".")`, and its limits line says "per surface" rather than "per document." Later emitters that write `self.` paths or "document." must do the same.
    - Agent acceptance (`plans/evidence/039-agent-acceptance.md`): a fresh, tool-less agent had only a starter digest built with the demo capabilities and `local.q`. Its element JSON for a filtered task list rendered with no fix on the first answer. It streamed to the same tree and filtered through a surface core with no intent. Of its eight guesses, three were digest gaps, and all three are fixed in the expressions text: `$contains` is case-sensitive and takes `[text, part]`, an empty part always matches, and a string literal is a valid operand. A fourth was fixed in the intents text: `setLocal` without `value` takes the event's value. To shorten the brief, the operator trimmed some per-kind `style:` lines and one source line. The evidence file records this.
    - Tests: `src/__tests__/sdk-digest.test.ts` holds the seven listed digest tests. `cli-mcp.test.ts` gained `mcp_generated_types_returns_the_digest`. The unknown-module `expected` strings in `cli-mcp.test.ts` and `authoring.test.ts` now list five modules. `exports.test.ts` lists `generateDigest`.
    - Docs: spec §7.2 (emitters, a new digest paragraph), §13 (the CLI line, `generated_types`, the `/sdk/gen` row) and §14 (the agent-tooling line reworded as approved). Also `docs/sdk.md` ("Describe the catalog to an agent"), `docs/mcp.md`, `docs/demo-agent.md`, `README.md`, `packages/starter/README.md` and `CHANGELOG.md`. `register-0.4.0.json` gains `generateDigest` and `DigestOptions`, and its `createAuthoring` entry is widened. The starter's register needs no entry: its API baseline covers TypeScript subpaths only.
    - `bun run check` passes: build, `gen:check` (both digests within budget), typecheck, lint and format; 2,065 tests pass, 0 fail.
    - Not committed, like Tasks 1–2 (plans 033–038 remain uncommitted together).

- [x] Task 4: Convert A2UI documents to element JSON in a separate package (F11)
  - Acceptance Criteria:
    - Functional:
      - The non-goal was lifted on 2026-11-15, and the scope trims were confirmed on 2026-11-19. A workspace package `@arnilo/liveframe-a2ui` exports `fromA2ui(messages, mapping, options?)` → `Result<{ elements, initialLocal, origins }>` for A2UI v0.9 and v0.9.1, as a snapshot only (design A.1–A.10). `messages` is JSONL text or parsed messages. `origins` maps element pointers back to A2UI pointers.
      - `mapping` is the app's: `catalogId`; `components` (kind, `props`, `variants`, `children`, `lift`, `items`, `event`, `input`); `actions`; `local` (data path to local key); `drop` (`theme`, `weight`, `checks` only). A component with no mapping is `unknown-component`. Every refused construct (A.2, A.5, A.6, A.8) is a typed error with a pointer into the A2UI input. Nothing is dropped silently.
      - The output is element JSON and nothing else. The caller passes it to `renderElements`, which validates it; the converter performs no validation of its own beyond shape, and the guide says so.
      - The package releases in lockstep with the core and peers on it, like the two existing companions.
    - Performance: conversion is linear in document size, with the input bounded as `streamElements` bounds its text (`docs/security.md:58`).
    - Code Quality: the core gains no A2UI knowledge and no export; the package depends only on the core's public subpaths.
    - Security: law 2 — the converted tree passes the app's compiled validator before it is drawn; law 4 — an A2UI action maps only to an action the app's mapping names, and the manifest must declare it. A test feeds a hostile document (deep nesting, huge strings, unknown components, script-like values).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/sdk.md` and `references/architecture.md` (a new workspace package).
      - `find-docs` — the A2UI specification.
    - Library Documentation to Check Before Implementation:
      - A2UI at the version Task 1 recorded: document shape, component model, data binding and action constructs, re-read at execution.
      - Bun 1.4.2+ workspaces and `bun pm pack`, as `packages/starter` uses them.
    - Documentation Reviewed:
      - Spec §9 ("Interop with A2UI or other formats is possible through a converter"), §13 ("Three packages, one version"), §14; `decision-logs/2026-11-08-2310-isolated-runner-starter-and-workspace.md`; `scripts/release/packages.ts`, `versions.ts`, `archive-gate.ts`, `publish-manifest.ts`; `packages/starter/package.json`, `archive-smoke.ts`.
    - Options Considered:
      - A subpath of the core — rejected: it ties the core's release to another project's format versions.
      - Convert to the UI tree directly — rejected: element JSON is the authoring form whose ids, bytes and rules the build pass owns.
    - Chosen Approach:
      - A companion package that outputs element JSON.
    - API Notes and Examples:
      ```ts
      const converted = fromA2ui(jsonl, {
        catalogId: "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json",
        components: { Column: { kind: "stack" }, Text: { kind: "text", props: { text: "text" } }, Button: { kind: "button", lift: { child: "label" }, event: "onPress" } },
        actions: { claim: "tasks.claim" },
      });
      if (converted.ok) renderElements(converted.value.elements, { validator, surfaceId, revision });
      ```
    - Files to Create/Edit:
      - `packages/a2ui/package.json`, `README.md`, `tsconfig.json`, `tsconfig.build.json`, `archive-smoke.ts`, `src/index.ts`, `src/__tests__/`.
      - `scripts/release/packages.ts`, `versions.ts`, `archive-gate.ts`, `publish-manifest.ts`; `.github/workflows/publish.yml`.
      - `scripts/release/api/0.4.0-a2ui.json` (generated at release; a placeholder rule in `api-stability.test.ts` until then).
      - `src/__tests__/workspace.test.ts`.
      - `docs/spec.md` §9, §13, §14; `docs/compatibility.md`; `README.md`; `CHANGELOG.md`.
  - Test Cases to Write:
    - `a2ui_document_converts_and_renders_through_the_starter_catalog`.
    - `unmapped_component_is_a_typed_error_with_its_pointer`; one test per refused construct.
    - `hostile_document_is_bounded_and_yields_no_tree`.
    - `converted_action_must_be_declared_by_the_manifest`: `renderElements` rejects it with `undeclared-action`.
    - `a2ui_template_children_expand_with_stable_keys`, `a2ui_input_with_a_mapped_path_becomes_a_local_binding`, `dropped_constructs_are_only_those_named`, `origins_map_render_errors_back_to_a2ui` and `conversion_is_linear` (an operation count).
    - `package_archives_and_installs` (the archive gate's smoke test).
  - Notes (executed 2026-11-19):
    - A2UI re-read at execution (Context7 `/websites/a2ui`: the v0.9 message reference, the v0.9.1 `formatString`, collection-scope and `ChildList` sections, and the `action.event` examples). Nothing differed from the design.
    - New workspace package `packages/a2ui` (`@arnilo/liveframe-a2ui`): `src/index.ts` exports `fromA2ui` and the types `A2uiMapping`, `A2uiComponent`, `A2uiItem`, `A2uiOptions` and `A2uiConversion`. It imports only types from `@arnilo/liveframe` and `/sdk`, so it has no runtime import at all, and it has no dependency. The work runs in phases, and each phase returns its errors before the next one starts. (1) The input is bounded (A.1) with an iterative walk, so deep nesting cannot overflow the stack. (2) The messages are read (A.2). Data-model writes are copy-on-write, so the caller's messages are never mutated, and `__proto__` keys are written with `defineProperty`. (3) A static reference graph from `root` finds shared, cyclic, dangling and unreachable components (A.3) before any data is read. (4) The conversion (A.4–A.8) is bounded by `limits.nodes` and `limits.depth`. Every mapping lookup is an own-property lookup, so a document naming `__proto__` or `constructor` reaches nothing.
    - Deviations from the design, all small. Design A.8 writes `{ type: "action", action, args }`, but the tree's `Intent` field is `name` (`src/formats/tree.ts`), so the converter emits `name`. An item mapping gains `index` (the catalog prop that gets the item's position), because a starter `tab` requires `value` and A2UI `Tabs.tabs` carries none. The default child properties leave out any property the mapping lifts, so a Button's `child` is not also read as a child. A lifted component may carry only `text`. The package is at `0.3.0` and peers on `~0.3.0` like the other companions, since this plan bumps no version; the 0.4.0 bump moves all four. Errors stop at `maxErrors` (default 20), with no bound marker.
    - Release wiring: the packages are discovered by the workspace glob, so `versions.ts`, `archive-gate.ts` and `publish-manifest.ts` needed no change. `scripts/release/packages.ts` gained the a2ui archive rules, and the core now also forbids `a2ui` files. `publish.yml` changed in its comments only, because it already loops over `packages/*`. `workspace.test.ts` lists four packages. `api-stability.test.ts` gained the placeholder `a2ui_package_exports_only_the_converter_until_its_baseline`; `0.4.0-a2ui.json` is generated at release. `bun scripts/release/archive-gate.ts --dir packages/a2ui` passes: the archive rules hold, and the smoke installs the package with only the core, converts a surface, renders it through the proof catalog and checks that a refused construct fails.
    - Tests: `packages/a2ui/src/__tests__/a2ui.test.ts`, 34 cases. Beyond the listed ones there is one `refuses_*` case per refused construct, plus unmapped event, property and variant, an unresolved path, another catalog and no root. There are also `context_path_mapped_to_local_becomes_from_local`, `tabs_items_become_tab_elements_with_their_children`, `later_component_updates_replace_earlier_and_data_updates_apply_in_order` and `malformed_jsonl_line_is_an_error_at_its_message`. The tests use the README's starter mapping through a dev-only `workspace:` link to the starter, which staging strips. `conversion_is_linear` counts `Object.hasOwn` and `Map.get` calls for 250 and 500 rows, and the ratio must lie between 1.8 and 2.2.
    - Bench: `bench/a2ui.bench.ts` (added to `bun run bench`) converts 499 components (44,003 characters of JSONL) in 1.8 ms. It is recorded, not gated.
    - Docs: spec §9 (the converter sentence), §13 (the package row) and §14 (the A2UI line replaced as designed); `docs/compatibility.md` (four packages, the placeholder baseline); `README.md`; `CHANGELOG.md`; `packages/a2ui/README.md` (the refusal table, origins lookup, the worked starter mapping); the `liveframe-execution` architecture reference.
    - `bun run check` passes: build, `gen:check`, typecheck, lint and format; 2,100 tests pass, 9 skip, 0 fail. The first full run failed `acceptance_map_covers_every_bullet_of_plans_026_to_031`, because `plans/evidence/032-acceptance-map.json` cites `workspace_lists_the_core_then_both_packages` by name. The test keeps that name, now over four packages.
    - Not committed, like Tasks 1–3 (plans 033–038 remain uncommitted together).

- [x] Task 5: Add the control primitives to the starter (F12, part 1)
  - Acceptance Criteria:
    - Functional:
      - The starter catalog gains `radioGroup` with `radio`, `slider`, `progress` and `dateField` (design C.1–C.5), each with a definition (description, bounded props, variants, slots, events, style props, `a11y`), a React implementation, recipes for every declared variant, slot and state in the starter design system, and examples for the conformance suites.
      - `slider` carries a number, raised from RAC's `onChangeEnd` and never while dragging. `radioGroup` carries a string of at most 128 characters. `dateField` carries an ISO 8601 calendar date (`maxLength: 10`, pattern `^\d{4}-\d{2}-\d{2}$`), or `null` when cleared, and only for a complete date. `progress` raises nothing, and an absent `value` makes it indeterminate. Fill geometry is the only thing the implementation computes, as a position with no colour (C.3).
      - Each implementation follows the accessibility pattern the design recorded and exposes its states through the selector table of spec §6.4.
      - `catalogSuite`, `designSystemSuite`, `rendererSuite` and `rendererBrowserSuite` pass for the whole starter. `classifyCatalogChange` reports the change as minor (added kinds), so the starter's `catalogId` major is unchanged.
      - The getting-started guide and the starter README list the kinds; `ui.gen.ts` and `ui.definitions.gen.ts` are regenerated and `gen:check` passes.
    - Performance: the starter design system's projected CSS grows by an amount the task records (about 8 KB per kind-and-variant in the proof systems, spec §5); the switch budget of `packages/starter/src/__tests__/switch.test.tsx` holds.
    - Code Quality: one implementation per kind in `packages/starter/src/implementations.tsx`, or a sibling file if it passes 600 lines. No control is built from a third-party widget library beyond React Aria Components, the starter's existing peer. Use `Radio`, not `RadioButton`, which the `^1.22.0` floor may lack. One new starter peer, `@internationalized/date` (`^3.12.4`, the range RAC 1.22.1 installs), supplies `parseDate` for `dateField`; check at the task that RAC 1.22.0 installs a compatible range.
    - Security: law 3 — every colour and dimension comes from recipes; the completeness and "no colour outside the theme" checks cover the new kinds. Law 2 — `dateField`'s value is a bounded string the validator checks; the implementation never trusts its own input beyond the event's `carries`.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/renderer.md` and `references/styling.md`.
      - `find-docs` — React Aria Components.
    - Library Documentation to Check Before Implementation:
      - React Aria Components at `^1.22.0` and the locked version: `RadioGroup`, `Slider`, `ProgressBar` or `Meter`, `DateField`; each one's data attributes for hover, focus, pressed, selected, disabled and invalid, to map onto spec §6.4's table.
    - Documentation Reviewed:
      - Spec §5, §6.2 (recipe completeness), §6.4, §12 (the primitive-set rule); `packages/starter/src/catalog.json`, `implementations.tsx`, `design-system.ts`, `themes.ts`; `docs/conformance.md` (coverage requires kind and variant examples and styled states); `docs/getting-started.md`.
    - Options Considered:
      - Compose a radio group from `button` with `pressed` — rejected: it loses roving focus and the group's name, which the browser must provide.
      - Put the kinds in the proof catalog too — rejected: the proof's set is fixed by §12's report; the starter is where an app starts.
    - Chosen Approach:
      - Four controls, each proven by the suites.
    - API Notes and Examples:
      ```tsx
      <RadioGroup label="Priority" value={state.priority} onChange={state.set("priority")}>
        <Radio value="low" label="Low" /><Radio value="high" label="High" />
      </RadioGroup>
      ```
    - Files to Create/Edit:
      - `packages/starter/package.json` (the `@internationalized/date` peer and dev dependency), `src/catalog.json`, `implementations.tsx`, `design-system.ts`, `themes.ts` (only if a role is missing), `ui.gen.ts`, `ui.definitions.gen.ts`.
      - `packages/starter/src/__tests__/browser-fixtures.ts`, `suites.test.ts`, `browser.test.ts`, `generic.test.ts`.
      - `packages/starter/README.md`; `docs/getting-started.md`; `CHANGELOG.md`.
      - The starter's API baseline successor in `scripts/release/api/`.
  - Test Cases to Write:
    - `starter_passes_every_suite_with_the_new_controls` (server and browser).
    - `each_new_control_raises_one_complete_intent`: one case per control with its carried type.
    - `each_new_control_exposes_its_states_through_the_selector_table`: the styled-state case reaches every declared state.
    - `adding_the_controls_is_a_minor_catalog_change`.
    - `slider_with_inverted_bounds_clamps`, `date_field_impossible_date_draws_empty` and `stray_radio_is_contained` (a `radio` outside a group is caught by per-node error containment, C.2).
    - Type-level: wrong value types to each control fail to compile (`packages/starter/src/__tests__/generic.test.ts`).
  - Notes (executed 2026-11-20):
    - React Aria Components re-read through `find-docs` (`/websites/react-aria_adobe`: `Slider`/`SliderTrack`/`SliderThumb`, `ProgressBar`, `DateField`/`DateInput`/`DateSegment`, `RadioGroup`/`Radio`) and checked against the locked 1.22.1 declarations and `react-stately`'s `useDateFieldState`. RAC 1.22.0 also depends on `@internationalized/date` `^3.12.4`, so the new peer `^3.12.4` fits the whole `^1.22.0` floor. `Radio` is marked deprecated in 1.22.1 in favour of `RadioField` + `RadioButton`; it is used as planned, with a comment.
    - `catalog.json` gains `radioGroup`, `radio`, `slider`, `progress` and `dateField` after `switch`, each with the `select` style props, slots and `a11y` of design C.1–C.5 (`radiogroup`, `radio`, `slider`, `progressbar`; `dateField` is `group`, the role RAC's segment container has). `radioGroup` and `dateField` take `describedBy` as a `refProps`. The defaults (0, 100, 1) are in prop descriptions, since the catalog format has no `default` keyword. Kind descriptions are kept within 100 characters: biome rewraps a longer `description:` line in `ui.definitions.gen.ts`, and `gen:check` then fails.
    - **Deviation (carries):** the catalog's scalar `carries` take no bounds and no null (`"string"`, `"number"`), so `radioGroup` carries `"string"` (the 128-character bound is the host target's schema, as for `select`), and `dateField` raises the **empty string**, not `null`, when every segment is cleared. RAC raises `onChange(null)` only then; a partly cleared or impossible date only changes the display, so a partial date is never raised. A host that stores the date declares its state as `maxLength: 10` (optionally a pattern that also allows `""`). The design's `null` would need an object carry or a nullable scalar carry, which is a format change outside this task.
    - Implementations live in a sibling file, `packages/starter/src/controls.tsx` (`implementations.tsx` would have passed 600 lines), spread into `implementations`. `useValue` moved to `src/use-value.ts` for both. `slider` raises from `onChangeEnd` only and sets `data-pressed` on the thumb while `state.isThumbDragging(0)`; RAC derives `aria-valuetext` from number formatting only, so a supplied `valueText` is set on the thumb's input after each commit and shown in `output`. `range()` collapses a `maximum` at or below `minimum` onto `minimum` and draws a disabled slider there (RAC needs a non-empty span, so it gets `minimum + 1`). `progress` sets `data-mixed` when indeterminate. `dateField` parses with `parseDate` (`calendarDate()`, null for an impossible date) and uses `validationBehavior="aria"`, so a value outside `minimum`/`maximum` is `invalid` as it arrives. A `radio` outside a group throws, and the node's error boundary draws the fallback. The fill is an inline `inset-inline-end`, no colour.
    - Recipes: every slot has a `rest` recipe; styled states are `focus` and `disabled` on `radioGroup`; `hover`, `active`, `focus`, `disabled` on `radio` with `selected` on its indicator; `hover`, `active`, `focus`, `disabled` on the slider thumb with `disabled` on its root and fill; `mixed` on the progress fill; `hover`, `focus`, `readonly`, `invalid`, `disabled` on the date input and `focus` on its segments. RAC exposes no way to set a radio group `invalid`, so no `invalid` recipe is declared for it. `themes.ts` needed no new role. `primitiveCss` gains 13 structural rules (1,261 bytes).
    - CSS: the starter design-system sheet grows from 155,269 to 195,139 bytes (+39,870, about 8 KB per kind, as spec §5 estimates), 8,073 to 9,655 bytes gzipped. The switch budget holds (`starter_switch_within_budget`: cold 5.30 ms, warm max 5.20 ms, 757 elements). The starter digest is 17,783 characters, within its 24,000 budget.
    - Tests: `packages/starter/src/__tests__/controls-browser.test.ts` (with `controls-client.tsx`) holds `each_new_control_raises_one_complete_intent` (one case per control and its carried type, including a cleared date raising `""` and never a partial date), `slider_with_inverted_bounds_clamps`, `date_field_impossible_date_draws_empty` and `stray_radio_is_contained`. `generic.test.ts` holds `adding_the_controls_is_a_minor_catalog_change` (the catalog without the five kinds against the catalog with them) and the type-level `wrong_value_types_to_each_control_fail_to_compile` (`@ts-expect-error` on props and on `emit`). `starter_passes_every_suite_with_the_new_controls` is the existing four suites over the widened examples (`host.ts`, a node per kind, both progress states) and 17 new state fixtures (`browser-fixtures.ts`, `controlStateFixtures`), which `every_styled_state_is_reachable` checks. `suites.test.ts` gains `design_system_without_the_0_4_controls_fails_at_their_recipes`. Chromium, Firefox and WebKit pass the new browser tests and the starter browser suite.
    - Finding: `docs/migration-0.4.md` said a 0.3.x design system for `starter.ui@1` fails with exactly two errors. It now also fails at the new kinds' recipes; the section lists them. Plan 038's `design_system_without_the_0_4_additions_fails_with_the_two_documented_errors` still holds, since it removes only the 038 additions.
    - Docs: `packages/starter/README.md` (30 primitives, the five controls, the new peer in the install line), `docs/getting-started.md` (install line and a pointer to the kinds), spec §5 (the proof set is the proof's; the starter's list grows in 0.4.0) and §13 (the starter row and its peers), `docs/migration-0.4.md` and `CHANGELOG.md`. `scripts/release/api/register-0.4.0-starter.json` gains `added` entries for the five kinds in `./ui` and `./definitions`.
    - `bun run check`: build, `gen:check`, typecheck, lint and format pass. The full test run gave 2,105 pass and 2 fail, both from this task, and both are fixed: `docs_links_resolve` (the getting-started guide linked to the starter README by a relative path the core archive does not ship; it now uses the repository URL) and `baseline_0_3_0_matches_the_companion_packages` (`primitiveCss` changed without a register entry; `register-0.4.0-starter.json` gains a `widened` entry). After the fixes, those two tests, format and lint pass; the 12-minute full run was not repeated.
    - Not committed, like Tasks 1–4 (plans 033–038 remain uncommitted together).

- [x] Task 6: Add the content primitives to the starter (F12, part 2)
  - Acceptance Criteria:
    - Functional:
      - The starter catalog gains `richText`, `chart` and `table` + `tableRow` + `tableCell` (design T.1–T.6), each with definition, implementation, recipes and suite examples as in Task 5.
      - `richText` takes `text` (at most 4,000 characters) and `headingLevel`, in T.2's closed subset: paragraphs, `#`–`###` headings, one level of `-`/`*`/`1.` lists, `**strong**`, `*em*`/`_em_`, `` `code` ``, `[label](target)` and backslash escapes. It renders elements, never HTML from the string. A link's target passes `checkUrl(target, { schemes: ["https"], relative: true })`, the starter `link.href` rule, or the whole link is drawn as text.
      - The root gains `checkUrl(value, rule)` and `UrlRule` (from `src/url.ts`), so the starter applies the library's own check (decision 2026-11-19-2034).
      - `chart` takes `label`, `type` (`bar`/`line`), `labels` (at most 100), `series` (1–4, at most 100 values each) and `summary`, and draws SVG itself. It has `role="img"`, a `<title>` from `label` and a `<desc>` from `summary` plus a generated text alternative. Each series draws with `currentColor` under its `series1`…`series4` slot class, so colours are recipe data (spec §6.2).
      - Table structure is the kinds `table` (`label`, `caption`; children `tableRow` 1..500), `tableRow` (children `tableCell` 1..32) and `tableCell` (`header?: column|row`, `span?`; children `any`), drawn as a native `<table>`. `semantics` cannot carry table roles: the `ariaRoles` allowlist excludes them. React Aria `Table` is not used, since a static table needs no grid focus (T.6).
      - No dependency is added unless the design justified it; the proposal uses none.
    - Performance: formatted text parses in linear time with its input bounded by `maxLength`; a chart at its `maxItems` bound renders within a frame in the production profile. Both recorded.
    - Code Quality: the text parser is one module with a closed token set; the chart computes scales in the implementation and exposes no drawing options beyond its definition's props.
    - Security: law 3 — the chart's series colours are recipe data, not props. Law 2 and the `url` rule — a `javascript:` link, a control character in a link and raw HTML in the string each have a test showing they are drawn inert. No `dangerouslySetInnerHTML` appears in the starter (a source scan).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/renderer.md` and `references/styling.md`.
      - `find-docs` — React Aria Components `Link`, if the implementation uses it.
    - Library Documentation to Check Before Implementation:
      - React Aria Components at the starter's versions: `Link`. HTML `<table>`/`<th scope>`. SVG accessibility: `role="img"` with `aria-label`, and `<title>`/`<desc>`.
    - Documentation Reviewed:
      - Spec §1 ("a chart engine" is the example of a primitive), §5 (`url` strings, `semantics`, the icon set is the app's), §6.2 (extension recipe properties, variant axes), §6.5 (vocabulary); `src/url.ts`; `docs/security.md`; `docs/styling.md`.
    - Options Considered:
      - A Markdown library — rejected unless the design justified it: a dependency and an HTML path for a subset a small parser covers.
      - A charting library — rejected for the same reason; the starter's chart is deliberately small, and an app with real charting needs brings its own primitive.
    - Chosen Approach:
      - Three small kinds with closed inputs.
    - API Notes and Examples:
      ```tsx
      <RichText text={"**Done.** See the [report](https://example.com/r)."} />
      <Chart label="Tasks closed per day" type="bar" series={[{ name: "Closed", values: data.closed }]} labels={data.days} />
      ```
    - Files to Create/Edit:
      - `src/index.ts` (export `checkUrl`, `UrlRule`), `scripts/release/api/register-0.4.0.json`, `docs/spec.md` (root exports).
      - `packages/starter/src/catalog.json`, `implementations.tsx` (or `content.tsx`), `rich-text.ts`, `design-system.ts`, `ui.gen.ts`, `ui.definitions.gen.ts`, `catalog.digest.md` (regenerated, within 24,000 characters).
      - `packages/starter/src/__tests__/browser-fixtures.ts`, `suites.test.ts`, `browser.test.ts`, `rich-text.test.ts`.
      - `packages/starter/README.md`; `docs/getting-started.md`; `docs/security.md` (what formatted text accepts); `CHANGELOG.md`.
      - Amended by Task 5: `docs/migration-0.4.md` "Action needed" (add the content kinds' slots and focus overlays to the list), `scripts/release/api/register-0.4.0-starter.json` (`added` entries in `./ui` and `./definitions`, and `primitiveCss` if it changes), and the kind list in `packages/starter/src/__tests__/generic.test.ts`. Keep each kind description within 100 characters, or biome rewraps it in `ui.definitions.gen.ts` and `gen:check` fails.
  - Test Cases to Write:
    - `starter_passes_every_suite_with_the_content_kinds`.
    - `formatted_text_draws_no_html_from_its_string`: `<img onerror>` and `<script>` in the text appear as characters.
    - `link_outside_the_scheme_allowlist_is_drawn_as_text`: `javascript:`, a tab inside the scheme, `//host`.
    - `rich_text_parse_is_linear`: an operation count, not a timer (plan 033 Task 9).
    - `chart_has_a_name_and_a_text_alternative` (accessibility snapshot) and `chart_colours_come_from_the_design_system` (a theme switch changes them with no re-render).
    - `starter_source_has_no_inner_html`: a scan.
    - `table_headers_carry_their_scope`.
  - Notes (executed 2026-11-20):
    - Core: the root exports `checkUrl` and `UrlRule` from `src/url.ts`. `exports.test.ts` lists `checkUrl`, `register-0.4.0.json` gains two `added` entries, and spec §13's root row names them.
    - `catalog.json` gains `richText`, `chart`, `table`, `tableRow` and `tableCell` after `dateField`, with T.1, T.5 and T.6's props, slots and child rules. Their `a11y` roles are `generic`, `img` (name `label`), `table` (name `label`), `row` and `cell`. `tableCell` adds the `textAlign` style prop for numeric columns. None declares an event, so the completeness rule needs no focus overlay. `ui.gen.ts`, `ui.definitions.gen.ts` and `catalog.digest.md` are regenerated. The digest is 20,210 characters, within the 24,000 budget. Biome also rewraps a prop `description:` line over 120 columns in `ui.definitions.gen.ts`, so `text`'s description is short and the full subset is in the kind description and the README.
    - `packages/starter/src/rich-text.ts` holds the parser (T.2–T.3). Escapes are applied first. Then one pass from the end of each line records the next unescaped `*`, `**`, `_`, `` ` ``, `]` and `)`, so each opener finds its closer in O(1). The parser returns blocks of inline tokens: strong (with emphasis inside), emphasis, code, link and text. Three choices the design left open: an `_` opens only after a non-word character and closes only before one, so `snake_case_name` stays text; a line inside a paragraph joins the next as text, which the browser draws as a space; and an ordered list does not keep its first number. `checkUrl` already rejects C0 and space. The parser also refuses DEL and C1 (0x7F–0x9F) in a target, as T.4 requires. An optional `Meter` counts steps for the linearity test.
    - `packages/starter/src/content.tsx` holds the three implementations, spread into `implementations`. They draw mapped content with `createElement(type, props, ...children)`. Positional children need no keys, and the content has no other identity. Biome's `noArrayIndexKey` and `useJsxKeyInIterable` rule out the alternatives. `richText` links use `Aria.Link`, like the `link` kind, so `hover` and `focus` match its `data-*` attributes.
    - **Deviations (chart):** (1) Recipes have no `height` (a recipe never gains a structural field, spec §6.2). The chart's 16rem default height is therefore in the starter's primitive CSS, and the `height` style prop overrides it. (2) The root is a `div`, not a `figure`. An unnamed `figure` added an empty landmark above the image in the accessibility tree. (3) The design's `chart.gridline` colour `border.subtle` fails the design-system suite's contrast audit at 1.5:1, because the audit reads every `textColor`, and `currentColor` makes the gridline's paint a text colour. The gridline is `text.muted` at `opacity.dim` instead. Axis labels and the legend are `aria-hidden`, because the `desc` text alternative already holds every value.
    - Recipes: a `rest` recipe for every slot. A `richText` link also has `hover` and `focus`, which the browser suite reaches through two new state fixtures. The series are `accent.fill`, `diagnostic.info`, `diagnostic.success` and `diagnostic.warning`. `primitiveCss` gains 17 rules (1,326 bytes) for text-flow margins, the chart's area, ticks, labels, legend and swatch, and table collapse.
    - CSS: the starter design-system sheet grows from 195,139 to 205,802 bytes (+10,663), and from 9,655 to 10,164 bytes gzipped (+509).
    - Bench: `bench/starter-content.bench.ts`, added to `bun run bench`, is recorded and not gated. Parsing 4,000 characters takes 0.47 ms. A 4 × 100 bar chart takes 1.19 ms through a production-React server render of the surface, within one 16 ms frame. That is the React work a client frame also pays. The browser test draws the same chart at its bound (400 bars, then 4 polylines) in all three engines.
    - Tests: `packages/starter/src/__tests__/rich-text.test.ts` holds `formatted_text_draws_no_html_from_its_string`, `link_outside_the_scheme_allowlist_is_drawn_as_text` (`javascript:`, a tab inside the scheme, `//host`, `http:`, DEL and C1), `rich_text_parse_is_linear` (six adversarial shapes, step ratio 1.8–2.2 from 2,000 to 4,000 characters), `table_headers_carry_their_scope`, `starter_source_has_no_inner_html` (every `.ts`/`.tsx` under `packages/starter/src` except the scanning test itself), `rich_text_parses_the_closed_subset`, `rich_text_leaves_unclosed_and_escaped_delimiters_as_text`, `rich_text_headings_start_at_heading_level`, `chart_scale_has_a_zero_baseline_and_round_ticks` and `chart_marks_paint_current_colour_under_their_series_slot`. `content-browser.test.ts` holds `chart_has_a_name_and_a_text_alternative` (an `ariaSnapshot` of exactly one named image), `chart_colours_come_from_the_design_system` (a theme switch changes both series colours, and the plot element is unchanged) and `chart_at_its_bound_draws_every_point`. It shares `controls-client.tsx`, whose `mount` now takes a theme index. `starter_passes_every_suite_with_the_content_kinds` is the four suites over the widened examples (`host.ts`: formatted text, a 4-series bar chart, a line chart, and a table with column and row headers and a span). `generic.test.ts` gains `adding_the_content_kinds_is_a_minor_catalog_change`. `suites.test.ts` gains `design_system_without_the_0_4_content_kinds_fails_at_their_rest_recipes`. Chromium, Firefox and WebKit pass the content browser tests and the starter browser suite.
    - Docs: `packages/starter/README.md` (the kinds and their rules), `docs/getting-started.md`, spec §5 and §13, `docs/security.md` (what formatted text accepts and how it draws links), `docs/migration-0.4.md` (the content kinds' slots, and a `textColor` per series slot) and `CHANGELOG.md`. `register-0.4.0-starter.json` gains `added` entries for the five kinds in `./ui` and `./definitions`, and its `primitiveCss` entry is widened. `bun scripts/release/archive-gate.ts --dir packages/starter` passes.
    - `bun run check`: build, `gen:check`, typecheck, lint and format pass. The full test run gave 2,120 pass, 9 skip and 2 fail, both from this task, and both are fixed. `docs_links_resolve` read `[label](target)` in `docs/security.md` as a link, so the text now says "Markdown-style links". `source_comments_cite_no_plan_or_decision_ids` caught design references in the comments of `rich-text.ts` and `content.tsx`, which are removed. Those two tests and the format check pass after the fixes; the 13-minute full run was not repeated. The starter switch budget holds (`starter_switch_within_budget`: cold 6.20 ms, warm max 5.30 ms, 757 elements). Firefox and WebKit pass the content, controls and starter browser tests (23 of 23 each) on the final tree.
    - Not committed, like Tasks 1–5 (plans 033–038 remain uncommitted together).

- [x] Task 7: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: `plans/evidence/039-impact-analysis.md` records each of the twelve impact areas, or `None — <reason>`. Findings go to the owner in one table with a recommended disposition; `execute` findings become tasks above this one, `backlog` findings go to `plans/backlog.md` and Further Actions.
    - Performance: the sweep lists the stream and arrival bench rows and the starter's CSS size before and after.
    - Code Quality: the sweep confirms the core's `package.json` gained no dependency and no A2UI or starter knowledge.
    - Security: the sweep states, per addition, the law it touches and the test that holds it, and re-reads `docs/security.md`'s list of remaining exposures against what shipped.
  - Approach:
    - Skills to Use:
      - `create-plan` — "Final task: impact analysis".
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `references/liveframe.md` §5 (area 9, agent authoring, in particular); Task 1's design and decision; `plans/evidence/039-agent-acceptance.md`.
    - Options Considered:
      - none beyond the standard sweep.
    - Chosen Approach:
      - One sweep after Task 6, with the agent acceptance run repeated on the finished tree.
    - API Notes and Examples:
      ```bash
      bun run check && bun run demo:test && bun run guide:test && bun run release:gate
      ```
    - Files to Create/Edit:
      - `plans/evidence/039-impact-analysis.md`; `plans/backlog.md`; `roadmap.md` §3; this plan's Compromises Made and Further Actions.
  - Test Cases to Write:
    - none new.
  - Notes (executed 2026-11-20):
    - `plans/evidence/039-impact-analysis.md` records the twelve areas and nine findings. The owner answered "Accept all (Recommended)": F1 and F2 executed, F3–F8 backlogged, F9 recorded.
    - F1 (executed): `docs/security.md` had no section for the agent additions. It now has "0.4.0 audit: agent-written UI" (the four laws for expressions in element JSON, the digest, the converter and the starter kinds) and a "What is not protected" bullet saying the A2UI mapping decides which actions an agent may offer. F2 (executed): nothing in `docs/` or the root README linked to `packages/a2ui/README.md`; `docs/sdk.md` gains "Convert an A2UI document" and the README a link.
    - Backlog (`plans/backlog.md`): a gate for a digest built with capabilities and `local` keys (the demo digest is 23,269 characters, 97% of its 24,000 budget; F3), the deprecated React Aria `Radio` (F5), a nullable or bounded scalar carry (F6), a case-insensitive filter match (F7), and three Task 1 handoff entries: incremental A2UI conversion and v1.0, a `meter` kind and an interactive table, and parent rules for definitions (F8). F4 extends the existing P1 bench entry and the `bench/ab.ts` entry.
    - Agent acceptance rerun on the finished tree (`plans/evidence/039-agent-acceptance.md`): a fresh agent with only the 23,269-character digest wrote a report with formatted text, a chart, a table and a filter. It rendered and streamed on the first answer with no fix, and the filter hid rows with no intent. The digest needed no change. The agent had one `Read` call on the digest file, where Task 3's agent had the digest pasted and no tools; the evidence says so.
    - Performance (rows in the evidence, §1 area 7): the stream, filtered-document, render, template, host, converter and starter-content rows pass or are recorded at load 5–9. `validator` failed in three runs at load 4.7–9.3 (1.50–1.60 µs/node) and passed in a fourth at load 6; the generic path moved with it, so it is the open load-sensitive pattern. The starter's design-system sheet grew from 155,269 to 205,802 bytes (+32.5%, about 5 KB per new kind). The core's `package.json` gained no dependency and the core holds no A2UI or starter knowledge.
    - Verification: `bun run check` passes (2,122 pass, 9 skip, 0 fail); `demo:test` (78), `guide:test` and `release:gate` pass; WebKit 2,115 pass and Firefox 2,121 pass, each with 0 fail. After the doc edits, the doc tests and `format:check` pass; the full suite was not rerun for Markdown-only changes.
    - Not committed (plans 033–039 remain uncommitted together).

## Verification (whole plan)

- `bun run check`
- `bun run bench`
- `bun --conditions liveframe:source test src/__tests__/sdk-elements.test.ts src/__tests__/sdk-stream.test.ts src/__tests__/sdk-gen.test.ts src/__tests__/corpus.test.ts src/__tests__/workspace.test.ts packages`
- `LIVEFRAME_BROWSER=webkit bun run test` and `LIVEFRAME_BROWSER=firefox bun run test`
- `bun run demo:test` and `bun run guide:test`
- `bun run release:gate`

## Compromises Made

- **Chart height:** recipes cannot set a height, so the starter's structural CSS holds the chart's 16rem default (Task 6).
- **Chart gridline colour:** `text.muted` at `opacity.dim` instead of the designed `border.subtle`, which failed the contrast audit at 1.5:1 (Task 6).
- **`dateField` carries `""`, not `null`**, when cleared, because the catalog's scalar carries take no bound and no null (Task 5; backlog P4).
- **The converter's package version** is `0.3.0` and peers on `~0.3.0`, since no version is bumped; the 0.4.0 bump moves all four packages (Task 4).
- **Task 2's 2% A/B** for `renderElements` was not decided on a quiet host; the evidence is equal-work ratios in `bench/stream-elements.bench.ts` (backlog, existing entries).
- **Uncommitted:** plans 033–039 share one working tree, so no task has a commit of its own.

## Further Actions

All handed off to `plans/backlog.md` (source: this plan, Task 7):

- P3: gate a catalog digest built with capabilities and `local` keys. The demo host's is 97% of the 24,000-character budget.
- P3: move the starter's `radio` off React Aria's deprecated `Radio`.
- P3: a case-insensitive match for live filters.
- P3: incremental A2UI conversion and A2UI v1.0.
- P3: parent rules for definitions.
- P4: a nullable or bounded scalar carry, so `dateField` can say "cleared" as `null`.
- P4: a `meter` kind and an interactive table for the starter.
- Existing entries extended: "Phase 1 performance gate" (a whole `bun run bench` on a quiet host) and "Let `bench/ab.ts` decide 2% on a host that is never idle".
