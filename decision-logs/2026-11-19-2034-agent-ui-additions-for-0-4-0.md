---
date: 2026-11-19 20:34
status: approved
decision_about: "The 0.4.0 agent-facing additions: element-JSON bindings, the catalog digest, the A2UI converter and starter primitives"
proposed_by: agent
explicitly_approved_by_user: true
---

# Decision: Four agent-facing additions for 0.4.0, with a caller-owned `local`, a Markdown digest, an A2UI v0.9.1 snapshot converter and eight starter kinds

## Decision

`0.4.0` adopts the design in `plans/evidence/039-agent-ui-design.md`:

- **F9:**
  - Element JSON accepts `when`, `bind` and `TreeIntent` events (`setLocal`, compound `local` writes, `fromLocal`), plus every plan 037 addition.
  - `local` and `initialLocal` come only from the caller, through `ephemeralManifest({ …, local?, initialLocal? })`. A document that carries `local` is `invalid-prop` ("no such element field").
  - `generateElementsSchema(catalog, { local? })` describes expressions only when `local` is given. Without it, the schema is byte-identical to 0.3.0.
  - `streamElements` needs no new rule: a shell is drawn with its own, already final, `when` and `bind`.
- **F10:**
  - `generateDigest(catalog, { capabilities?, local?, budget? })` and `liveframe gen --digest` produce a deterministic Markdown description.
  - Budgets: at most 20,000 characters for the proof catalog with its fixture capabilities, and 24,000 for the starter catalog.
  - The digest is drift-checked in `gen:check` and exposed as MCP `generated_types` `module: "digest"`.
  - It never reads `meta`: the app passes only what it wants described.
  - The spec §14 agent-tooling non-goal is reworded to name the digest.
- **F11:**
  - `@arnilo/liveframe-a2ui` exports `fromA2ui(messages, mapping, options?)` → `Result<{ elements, initialLocal, origins }>`. It converts A2UI v0.9 and v0.9.1 (current production), as a snapshot only, through an app-supplied mapping.
  - Always refused: client functions (except `formatString` over data paths), `functionCall` actions, `Icon.svgPath`, `sendDataModel: true`, `deleteSurface`, a second surface, shared or unreachable components, and context paths that are not mapped to `local`.
  - `theme`, `weight` and `checks` are refused unless the mapping's `drop` names them.
  - The output is validated by `renderElements` like any element JSON.
- **F12:**
  - The starter gains `radioGroup` + `radio`, `slider`, `progress`, `dateField`, `richText`, `chart` and `table` + `tableRow` + `tableCell`, each passing the rule-2 test recorded in the design.
  - It takes one new peer, `@internationalized/date` (`^3.12.4`), for `dateField`.
  - The root gains one export, `checkUrl(value, rule)` with `UrlRule`, so `richText` checks link targets with the library's own `url` rule.
  - No new core dependency, and no Markdown or charting library.

## Context

The 2026-11-15 review placed F9–F12 and the G3 backlog item "Add `when` and `bind` to element JSON" in `0.4.0` (`decision-logs/2026-11-15-1251-review-2026-11-15-scope.md`). That decision also lifted the spec §14 non-goal "A2UI or other wire interop" for F11. Plan 039 Task 1 required one design approved before anything is built, because F9 and F10 both define what an agent is told it may write and must agree. It also required the owner's answer on the two §14 items. The design states, for each item, its forms, rules with error kinds and pointers, budgets, spec text, 0.3.x behaviour, the tests each task writes, and a paragraph per law.

## Approval

- Proposed by: agent (`plans/evidence/039-agent-ui-design.md`)
- Approved by user: Yes
- Approval evidence: on 2026-11-19 the owner answered three questions.
  - On the design (F9–F12 as summarised): "Approve (Recommended)".
  - On the §14 agent-tooling line for F10: "Lift: reword §14 (Recommended)", so Task 3 builds the digest.
  - On the F11 scope trims (v0.9/v0.9.1 only, snapshot only, the refused list with `drop` for `theme`/`weight`/`checks`): "Confirm trims (Recommended)".

## Alternatives Considered

1. **Let the element JSON document declare its own `local`.** Rejected: the agent would set its own bounds, and the `local` schema is the app's contract with the renderer.
2. **Keep live filters to TSX and templates (status quo).** Rejected: an agent writing JSON cannot ask for one.
3. **Draw a streamed node with expressions only once it is complete.** Rejected: it holds back every gated container until all its rows arrive, and the shell rule already guarantees `when` and `bind` are final.
4. **Point agents at the generated `.d.ts` or the JSON Schemas instead of a digest.** Rejected: the `.d.ts` carries TypeScript machinery and no action or source descriptions, and the element schema (75,467 bytes for the proof catalog) is several times the digest's size for the same facts.
5. **Exclude digest entries an app marks internal in `meta`.** Rejected: the library never reads `meta` (spec §7.3, law 4).
6. **Target A2UI v1.0.** Rejected for now: it is a release candidate. v0.9.1 is the current production version, and v0.9 has the same component schema.
7. **Convert A2UI incrementally.** Backlogged: a snapshot converter plus `diffTrees` covers re-conversion, and a stream adds state the first version does not need.
8. **A2UI converter as a core subpath, or converting straight to a UI tree.** Rejected: the first ties the core's release to another project's format versions, and element JSON is the authoring form whose ids and rules the build pass owns.
9. **Table structure as `semantics` values on layout kinds.** Rejected: table roles need required context or owned elements, which the `ariaRoles` allowlist excludes by design. Header association also needs a real `<table>`.
10. **Native `<input type="date">` instead of React Aria `DateField`.** Rejected: its picker and segments are drawn by the user agent, out of reach of recipes (law 3).
11. **A Markdown or charting library for the content kinds.** Rejected: it adds a dependency and an HTML path for a subset a small, linear parser covers. An app with real charting needs brings its own primitive.
12. **Copy the URL check into the starter.** Rejected: a second copy of a security rule. One root export keeps the check in one place.

## Rationale and Evidence

- `src/sdk/element-node.ts:31` (`ELEMENT_KEYS`) rejects `when` and `bind` today as "no such element field". The build pass's `attachExpressions` (`src/sdk/render.ts:1040-1061`) and the validator's `compileBindings` (`src/validate/bindings.ts`) already check them for TSX, so element JSON reuses both and needs no second checker.
- The tree-expression bound of 10,000 nodes is counted per sink (`src/validate/bindings.ts:73-79`).
- A2UI facts come from a2ui.org, fetched with `find-docs` (Context7 `/websites/a2ui`) and directly on 2026-11-19:
  - The version table lists v0.9.1 as current and v1.0 as a candidate.
  - The v0.9.1 specification defines the four server messages, the flat component list with a `root` id, `ChildList` (an id list or a `{ componentId, path }` template), JSON Pointer data binding, `FunctionCall`, `Action` (`event` or `functionCall`) and `CheckRule`.
  - The basic catalog defines the component properties and functions named in the design.
- React Aria Components 1.22.1 (locked) exports `RadioGroup`, `Radio`, `Slider` with its track, thumb and output, `ProgressBar`, `DateField`, `DateInput` and `DateSegment`. It depends on `@internationalized/date@^3.12.4` and does not re-export `parseDate` (`bun.lock`; `node_modules/react-aria-components/dist/types/src/`).
- A throwaway digest prototype measured 13,335 characters for the proof catalog with its capabilities and 14,065 for the starter, which sets the 20,000 and 24,000 budgets with room for the example, the grammar and the F12 kinds.
- `src/url.ts` holds `checkUrl`, which is not yet a root export.

## References

- `plans/evidence/039-agent-ui-design.md`: the full design (rules `E.*`, `G.*`, `A.*`, `C.*`, `T.*`).
- `plans/039-Phase-7-Part-Z-Agent-Generated-UI.md`: Tasks 2–6, amended to match.
- `decision-logs/2026-11-15-1251-review-2026-11-15-scope.md`: the scope, and the lifted F11 non-goal.
- `decision-logs/2026-10-22-0902-authoring-mcp-server-for-coding-agents.md`: the MCP tools stay read-only and authoring-only.
- `plans/evidence/032-agent-acceptance.md`: the agent run Task 3 repeats with the digest.
- [A2UI specification v0.9.1](https://a2ui.org/specification/v0.9.1-a2ui/), [basic catalog v0.9](https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json), [common types v0.9](https://a2ui.org/specification/v0_9/common_types.json).
- [React Aria: RadioGroup](https://react-aria.adobe.com/RadioGroup), [Slider](https://react-aria.adobe.com/Slider).
- `docs/spec.md` §5, §6.5 (`ariaRoles`), §7.2, §8, §9, §13, §14.

## Consequences

- Tasks 2–6 execute as amended. Task 3 and Task 4 stay active.
- Spec §14 changes in two places when Tasks 3 and 4 execute: the agent-tooling line names the digest, and "A2UI or other wire interop" becomes "wire formats other than A2UI v0.9/v0.9.1, and converting A2UI incrementally".
- `register-0.4.0.json` gains `added` entries for:
  - The `ephemeralManifest` fields.
  - The `generateElementsSchema` options.
  - `generateDigest`.
  - `checkUrl` and `UrlRule`.
  - The widened `Elements` type.
- The starter's API baseline successor records the new kinds, `./catalog.digest.md` and the new peer.
- A fourth package joins the lockstep release.
- Backlogged by this decision: incremental A2UI conversion, A2UI v1.0, a `meter` kind, an interactive table, and parent rules for definitions (a `radio` outside a group is contained by the renderer, not rejected by the validator).
- Revisit the decision if A2UI v1.0 ships before 0.4.0 is released, if the digest does not improve the agent acceptance run, or if `@internationalized/date` leaves React Aria's dependency set.
