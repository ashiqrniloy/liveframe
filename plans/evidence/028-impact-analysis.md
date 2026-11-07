# Plan 028 architectural impact analysis

Reviewed 2026-11-07 against `0c47e20` (Tasks 1–7) plus Task 8's own changes. Covers all twelve areas in `.claude/skills/create-plan/references/liveframe.md` §5. This closes the template and streaming batch of 0.3.0 (template widgets, template packages and runners, template authoring and codegen, `streamElements`); it is not the 0.3.0 release or plans 029–032. Many unrelated files were already modified in the working tree before this plan's tasks (formatting only); they are left as they were.

Method: read the whole plan and its notes and the design (`plans/evidence/028-template-design.md`, T1–T23); read the evaluator, scope, compile and stream code at the cited lines; probe hostile inputs with throwaway scripts (removed afterwards); run `bun run check`, `bun run demo:test`, each bench stage on its own, and a paired A/B of the render bench against the commit before the plan (`eedf1c1`, `bench/ab.ts`).

Whole-plan verification:

| Command | Result |
| --- | --- |
| `bun run check` | exit 0: 1492 pass, 4 skip, 0 fail across 136 files (406 s), before this task's three new tests |
| `bun run demo:test` | 57 pass, 0 fail (packed archive installed into the demo host) |
| `bun test --conditions liveframe:source src/__tests__/sdk-stream.test.ts` | 15 pass, after adding three hostile-input tests |
| `bun src/cli/liveframe.ts mcp …` template draft round trip | covered by `cli-mcp.test.ts` (`mcp_pack_draft_template_inline`, `_directory`, `generated_template_schema_matches_cli_bytes`), inside `check` |
| `bun run bench` | run stage by stage because one failing gate hides the rest (see §7) |

## 1. Spec

`docs/spec.md` §7.6 (template widgets: document, expressions, scope, bounds, static checking, rendering, packages), §7.2 (streamed element JSON), §7.3, §7.5 and §13 describe what shipped. **F1:** §3 and §4 still described a widget as TSX only and a package as "manifest and compiled code", although the plan said it amends them. Task 8 adds a row to the §3 table (template widgets; the app provides no isolation for them) and changes the §4 **Widget** and **Package** rows. §9 and §10 need no change: a tree is the same validated data whatever produced it, and the template limits live in §7.6 beside the rules they bound.

## 2. Public API and formats

- Added: subpath `/template` (`validateTemplate`, `renderTemplate`, `checkExpression`, `evaluate`, types; `package.json:134`), the 12th registered format `liveframe-template/1` with `schemas/template.json`, `templateRunner()` in `/preview`, `renderTemplatePackage()` in `/runner-kit`, `generateTemplateSchema()` in `/sdk/gen`, `streamElements()` in `/sdk`, the `limits.steps` field, corpus directory `conformance/corpus/template/` and the vector file `conformance/hash/template-packages.json`.
- Widened: `WidgetPackage` (optional `template`; exactly one of `code`/`template`), `schemas/widget-package.json` (no longer requires `code`), `pack`, `verifyPackage`, `createAuthoring`, MCP `pack_draft` and `generated_types`.
- A 0.2.x verifier rejects a template package fail-closed (`invalid-document` at `/code`), the same precedent as plans 026–027. A code package's hash is unchanged (`packageHash` adds `template` only when present), asserted by the hash vectors.
- `scripts/release/api/register-0.3.0.json` carries the entries and `api-stability.test.ts` passes inside `check`. Deviations from the task text (no `maxTemplates` option, a new vector file instead of an entry in `packages.json`, `{ code?; template? }` instead of a union) are recorded in the Task 5 notes.

## 3. The four laws

The explicit review the plan asks for: **no template operator reaches a global, a prototype or unbounded work.** Evidence, not assertion:

1. **Widget code never runs in the browser.** A template is data, evaluated by `renderTemplate` on the backend. No code from the document is ever compiled to a function: the evaluator is a fixed table of library closures (`OPERATORS`, `src/template/expr.ts:850`). A test scans `expr.ts`/`scope.ts` for `eval`, `Function`, `globalThis` and host imports.
2. **The UI tree is validated data.** `renderTemplate` expands to SDK `Element`s and calls the shared single-pass build (`renderExpansion`, `src/sdk/render.ts`), so every emitted node passes the same compiled validator as a TSX widget's. A binding whose type is statically known to be wrong fails at install; a `dynamic` value is checked at render. `streamElements` draws only trees whose nodes were validated by the same `openNode`/`closeNode` code and re-checks the tree it returns (`validateTree` on every tree in `stream_trees_are_valid_and_grow`).
3. **Widget code never sets colours or raw CSS.** A template can set only catalog props and the style props the kind declares; style values go through the same recipe and token checks. A literal colour is `colour-outside-theme` at install when constant and at render otherwise. No operator produces a CSS string that bypasses that check: `$concat`/`$text` build prop values, which are validated against the prop schema (or the style value rules) afterwards.
4. **A widget never holds authority.** A template's intents are data in its document. `type`, `key`, `name`, `bind`, `bindAll` are static (T14), so the set of actions a template can request is the static set in its document, each checked against the manifest and capability schemas at install and re-checked by the host on dispatch. MCP tools still never dispatch an action; `pack_draft` gained an input shape, not authority.

Probes (throwaway scripts, 2026-11-07, Bun 1.4.4):

| Probe | Result |
| --- | --- |
| `$path` `__proto__`, `constructor.name` | `invalid-document`, "unusable segment" (`src/template/scope.ts:187`) |
| `$path` `globalThis` | `unknown-name`: only the five roots and bound names exist |
| Own-property reads | `Object.hasOwn` at evaluation (`src/template/expr.ts:688`); arrays are indexed by in-range integers only |
| Two nested `$map`s over 1,000 items (1M iterations) | `limit-exceeded` at the step limit after 25.5 ms |
| 30 chained `$let` bindings doubling a 1,000-character string | `limit-exceeded` at the string cap after 1.9 ms |
| Hand-built hostile package (Task 5 test `template_runner_reaches_no_globals`) | renders an error, leaks nothing |
| `streamElements` fed 100–400 KB of one unclosed props array, 64 characters at a time | 0.9–3.6 ms: linear, no rescans |
| `streamElements` fed 1,000,000 nested `[` | `limit-exceeded` "JSON nested at most 1024 deep" at `/$stream/1052`, immediately |
| `streamElements` fed 3 MB of whitespace with `bytes: 100000` | `limit-exceeded` at `/$stream/400000` (four times the limit) |

Residual risk, stated in the design (T20) and now in `docs/security.md` (F2): `limits.steps` is the only time bound and `templateRunner()` has no wall-clock timeout. The default budget costs about 25 ms; a host with untrusted authors passes a lower `limits.steps` or uses `workerRunner()`.

This is a targeted review of the plan's inputs, not a fresh whole-repository audit.

## 4. Validation

Every new input has a typed error at a pointer into the template document: `unknown-name` (path, root, component, param, anchor), `unknown-component`, `undeclared-event`, `undeclared-action`, `duplicate-key`, `missing-key`, `invalid-children`, `invalid-prop` (binding, evaluation), `invalid-document` (shape, cyclic `$use`, unusable segment, directive placement) and `limit-exceeded` (T10 at install, T11 and the stream's text and nesting bounds at run). Every kind the validator can return has a failing corpus case (17 template cases plus 4 package cases). `streamElements` reports malformed JSON at `/$stream/<offset>`. **F3:** the stream's nesting bound, linear work and text bound had no test; Task 8 adds `stream_nesting_stops_at_1024`, `stream_work_is_linear_in_open_containers` and `stream_refuses_text_past_four_times_the_byte_limit`.

## 5. Styling

None — templates add no style input: style values are the kind's declared style props validated as for element JSON, and a template cannot name a theme role, recipe or CSS property the catalog does not declare. No recipe, theme, design-system or CSS-projection code changed in this plan.

## 6. Interaction tiers

Templates emit `setState` and `action` intents with bound values and arguments (T14): `setState` values are type-checked against the state schema, action args against the capability's `args`, and the completion rule for `bind`/`bindAll` is the one `render()` uses (`carriesFits`/`objectFits` are shared). The `actions` root resolves to `{}` until plan 029 Task 2 (`NO_ACTIONS`, `src/template/render.ts:147,406`); plan 029 says it replaces that placeholder and reuses `checkExpression`/`evaluate` for local bindings, so the tier-1 expression language is already shared. No local tier is added here.

## 7. Performance

Machine: Bun 1.4.4, Linux 7.3.0-4-cachyos, AMD Ryzen 9 PRO 7940HS, 16 logical CPUs, shared with unrelated VMs and builds. Load average 6–15 throughout, so **none of this is quiet-host proof**; plan 032 Task 3 owns that.

| Check | Result |
| --- | --- |
| Template expression evaluation | 16.0 ns/node over 15,840 nodes (target 50, recorded) |
| `renderTemplate`, agent-home template (679 nodes) | 1.445 ms, 2.128 µs/node (gate 3) |
| `templateRunner` over `renderTemplate` | −0.53% (gate 5%) |
| `streamElements`, 679 nodes in 64-character chunks | 4.417 ms = 2.76× `renderElements` (gate 3×; 2.4–2.9× across runs) |
| Template install validation, agent-home port | 0.9 ms warm in Task 3, 2.95 ms inside the full test run at load (budget 5) |
| First render of a template | about 15 ms compile plus about 11 ms once per catalog; later renders 1.3 ms (documented, F7) |
| Validator bench | `core-queue.full` fails its 1.5 µs gate at both `eedf1c1` and HEAD (1.51–1.72 µs at load 6–13) |
| Render bench, `bench/ab.ts eedf1c1 … --runs 9` at load 13 | render ratios HEAD/base 1.03–1.11 by fixture; the same runs give 1.01–1.08 for standalone `validateTree`, whose code this plan did not change |

**F4:** plan 028 did change `src/sdk/render.ts` (`emit` split into `openNode`/`closeNode`, a 20-line `renderExpansion` seam) and `src/validate/compile.ts` (helpers moved, one new field, compile path only). The A/B cannot separate a 0–4% render change from drift at this load. Disposition: backlog (extends the validator-gate entry), settled by plan 032 Task 3. The template and stream gates, which are new, pass.

## 8. Portability

`src/template/*` and `src/sdk/stream.ts` use no host API: the host-API-free scan covers `/template` and passed inside `check`; the expression modules import only `errors`, `internal`, `schema` and `formats/{capabilities,json,tree}`. Evaluation uses only ECMAScript built-ins and a fixed rounding table (no `Math.pow`, `Intl`, regex or time), so output is identical in every runtime (T8; `deterministic_text_of_numbers`). The runner kit bundle gained the template compiler and its size test passes. No dependency was added. Bun remains the only tool.

## 9. Agent authoring

An agent gets `unknown-name` with the valid names in `expected` for a wrong data path before anything renders (`Unknown name "globalThis"`, `expected: a name in scope; …`), `invalid-prop` at the binding for a type mismatch, and `undeclared-action` for an action the manifest does not list. `generateTemplateSchema` (`liveframe gen --template-schema`, `generated_types({ module: "templateSchema" })`, byte-identical) narrows `$path` and `setState` keys to the manifest when one is given, and `docs/templates.md` shows the real errors. **F6:** `--structured-subset` is deliberately modest and does not satisfy strict structured-output modes (found in Task 6 against OpenAI and Claude docs; Gemini unchecked); backlog. `streamElements` is a library function, not an MCP tool: MCP calls return whole results, so no agent-facing change is needed.

## 10. Docs and examples

New `docs/templates.md` (worked widget, document, operator table, real install errors, install and render, schema and structured-output notes, when to choose TSX); `docs/sdk.md#draw-agent-json-while-it-streams`; `docs/security.md` (template packages need no isolation runner); `docs/packages.md`, `docs/preview.md`, `docs/mcp.md`, `docs/formats.md`, `docs/migration-0.3.md`, README, CHANGELOG, and the demo host (a template widget reading a paged source, installed at runtime, tested in `demo:test`). Task 8 adds: the measured cost of `limits.steps` and the no-timeout statement to `docs/security.md` and `docs/templates.md` (**F2**), a "Streamed element JSON" security section (**F3**), the first-render compile cost and the warm-at-install advice to `docs/templates.md` (**F7**), and the spec §3/§4 rows (**F1**).

## 11. Conformance

Template coverage: the corpus (`conformance/corpus/template/` plus four package cases), the format-schema differential harness (`template` added), the hash vector `template-packages.json`, and `template-package.test.ts` (all four render paths byte-identical over every agent-home scenario). There is no `/conformance` suite for templates: a catalog, design-system or store suite has nothing template-specific to check, and the runner contract (a runner renders a template package to the same tree as `renderTemplate`) is owned by plan 031's `runnerSuite()`, which names `templateRunner`. `rendererSuite` and `catalogSuite` are unaffected: a template emits the same trees.

## 12. Reference hosts

- **Gap (recorded, not bent to):** the git-status proof widget sanitises labels with regular expressions (`sanitizeText`, `rootLabel`), which the language excludes by design (T22). A template version needs a source that returns cleaned labels, or stays TSX. Clay and Synapta panels that format text with `Intl`, dates or locale-aware sorting likewise stay TSX or take the formatted value from a source (locale reaches a widget through `context`, plan 029). The `when to choose TSX` section of `docs/templates.md` says so.
- Both hosts can install agent-authored widgets without an isolation runner for the cases templates cover (queues, lists, status panels, pagers), which is the W2a gap the plan named. `streamElements` closes W2b for the element-JSON path: a host can show an agent's document as it arrives, and patches via `diffTrees`.
- Installed 0.3.0 adoption, hostile-code isolation (plan 031) and the quiet-host proof (plan 032) remain later approved work.

## Findings and dispositions

| # | Finding | Area | Disposition |
| --- | --- | --- | --- |
| F1 | Spec §3 and §4 still describe TSX-only widgets and "compiled code" packages | Spec | **Executed** in Task 8 |
| F2 | `limits.steps` is the only time bound and `templateRunner` has no timeout; its cost and the advice for untrusted authors were not documented | Laws, docs | **Executed**: `docs/security.md`, `docs/templates.md` |
| F3 | The stream's nesting, linear-work and text bounds were untested and undocumented | Validation, docs | **Executed**: three tests in `sdk-stream.test.ts`, security section |
| F4 | Render/validator gates: A/B at load 13 cannot separate a 0–4% render change from drift; the validator gate fails at the pre-plan commit too | Performance | **Backlog** (P3, extends the validator-gate entry; plan 032 Task 3 settles it) |
| F5 | `streamElements` holds back `$ref` nodes and fragments until the end; bench margin 2.4–2.9× of 3× | Performance, agent authoring | **Backlog** (P4) |
| F6 | The template schema's structured subset is not strict-mode compatible; Gemini unchecked | Agent authoring | **Backlog** (P3) |
| F7 | First render of a template pays about 15 ms (plus 11 ms per catalog) | Performance, docs | **Executed** as documentation (warm at install); a pre-warm option belongs with `checkPackages` in plan 030 |
| F8 | `bun run bench` rewrites the tracked `plans/evidence/019-streaming-bench.md` | Release automation | **Backlog** (P4) |
| F9 | Regex-based sanitisation and `Intl` are not expressible | Reference hosts | **Recorded** (by design, T22); no change |
