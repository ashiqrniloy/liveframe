# Plan 039 — Architectural Impact Analysis (Agent-Generated UI)

Date: 2026-11-20
Plan: [`plans/039-Phase-7-Part-Z-Agent-Generated-UI.md`](../039-Phase-7-Part-Z-Agent-Generated-UI.md)
Design: [`plans/evidence/039-agent-ui-design.md`](039-agent-ui-design.md); decision: [`decision-logs/2026-11-19-2034-agent-ui-additions-for-0-4-0.md`](../../decision-logs/2026-11-19-2034-agent-ui-additions-for-0-4-0.md)

This sweep covers the twelve impact areas in `.claude/skills/create-plan/references/liveframe.md` §5 across Tasks 2–6. Those tasks deliver four additions: `when`, `bind` and `setLocal` in element JSON with a caller-owned `local` (F9, Task 2); a generated Markdown catalog digest (F10, Task 3); the `@arnilo/liveframe-a2ui` converter (F11, Task 4); and eight starter kinds, five controls and three content kinds (F12, Tasks 5–6). Findings are in §2.

---

## 1. The Twelve Impact Areas

### 1. Spec (`docs/spec.md`)

- Every row of the design's spec text is in the spec:
  - §5: the starter's list grows in 0.4.0 and the proof set stays the proof's; the content kinds' `ariaRoles` limit (table roles are kinds, not `semantics` values).
  - §7.2: element JSON `when`/`bind`/`setLocal`, the caller-owned `local`, the tree expression bound that stops a build, the emitters and the digest paragraph. §8: the limits as element JSON meets them.
  - §9: the converter sentence. §13: the root exports (`checkUrl`, `UrlRule`), the `/sdk/gen` row, the CLI line, `generated_types` `digest`, the `@arnilo/liveframe-a2ui` row and the starter row with its new peer.
  - §14: both items answered "yes" and reworded as approved: the agent-tooling line now names the digest, and the wire-format line reads "Wire formats other than A2UI v0.9/v0.9.1 through `@arnilo/liveframe-a2ui`, and converting A2UI incrementally" (spec §14).
- `docs-spec-structure.test.ts` passes inside the full check.
- No gap found.

### 2. Public API and formats

- `scripts/release/api/register-0.4.0.json` has 60 entries, 9 of them tagged `039`: T2 five (`Elements`, `ephemeralManifest`, `generateElementsSchema`, `ElementsSchemaOptions`, `/authoring` `createAuthoring`), T3 two (`generateDigest`, `DigestOptions`; `createAuthoring` widened), T6 two (`checkUrl`, `UrlRule`). `register-0.4.0-starter.json` has 47 entries, 21 tagged `039` (T5: 11, T6: 10), plus the widened `primitiveCss`. `api-stability.test.ts` passes against both.
- New package `@arnilo/liveframe-a2ui` exports `fromA2ui` and five types. Its baseline `0.4.0-a2ui.json` is generated at release; until then `a2ui_package_exports_only_the_converter_until_its_baseline` holds it. The starter gains the `./catalog.digest.md` export, and the core gains no subpath.
- Format additions are all optional or fail closed: a 0.3.x validator rejects `when`/`bind` on element JSON it never accepted; `elements.schema.json` without `local` is byte-identical to the stored schema (`elements_schema_without_local_is_unchanged`).
- **Catalog compatibility:** the starter adds ten kinds (a minor change, `classifyCatalogChange`), so the id stays `starter.ui@1`, but a design system written for the 0.3.x starter fails `validateDesignSystem` at the new kinds' recipes. This is the case spec §5 and `docs/migration-0.4.md` already state (plan 038 F1), now widened to list the new kinds' slots, their focus overlays and a `textColor` per chart series slot.
- Lockstep: the new package is at `0.3.0` and peers on `~0.3.0` like the other companions, since no version is bumped. The 0.4.0 bump moves all four.
- Every register entry has a `CHANGELOG.md` "Unreleased" line (checked by reading the 039 entries against it).

### 3. The four laws

| Addition | Law | What fails closed | Test that holds it |
|---|---|---|---|
| F9 expressions in element JSON | 1 | Only the closed tree-expression operator list, evaluated with fuel. The bound of 10,000 expression nodes stops the build | `stream_enforces_the_tree_expression_bound`, `element_json_live_filter_hides_rows_without_a_round_trip` |
| F9 `local` | 2, 4 | A document cannot declare `local` (`invalid-prop` at `/local`); an undeclared key is `unknown-name`; `setLocal` never reaches `onIntent` | `element_json_cannot_declare_local`, `expression_reading_an_undeclared_local_key_is_unknown_name` |
| F9 `when`/`bind`/`focus` as props | 2 | `mergeSections` refuses them in any section, so `props.when` is never read as the node's `when` | `when-in-props` corpus case |
| F10 digest | 3, 4 | Built from the installed documents only: no path, no capability implementation detail, no theme or design-system value, no `meta` | `digest_holds_no_paths_and_no_design_values` |
| F11 converter | 2, 4 | Output is unvalidated element JSON; an action maps only to a name the mapping lists and the manifest must declare it; every mapping lookup is an own-property lookup | `converted_action_must_be_declared_by_the_manifest`, `hostile_document_is_bounded_and_yields_no_tree` |
| F12 `richText` | 2 | Parsed to a token tree drawn as React elements: no string reaches the DOM as HTML; a link is drawn only if `checkUrl` passes (`https` or relative) and it holds no DEL or C1 character | `formatted_text_draws_no_html_from_its_string`, `link_outside_the_scheme_allowlist_is_drawn_as_text`, `starter_source_has_no_inner_html` |
| F12 `chart` | 3 | Series paint `currentColor` under slot classes; colours are recipe data, switched by theme with no redraw | `chart_colours_come_from_the_design_system` (three engines) |
| F12 controls | 2, 3 | Each carries the event's bounded type; every colour and size is a recipe; `dateField` raises only a complete date or the empty string | `each_new_control_raises_one_complete_intent`, `starter_passes_every_suite_with_the_new_controls` |

No new path lets widget code, a colour, raw CSS or authority through. The one new trust the app takes on is the A2UI mapping, which lets an app choose which actions an agent may offer; `docs/security.md` now says so (F1).

### 4. Validation

- Element JSON expressions go through the build pass's `attachExpressions` and the validator's `compileBindings` (one checker), with the same typed errors and pointers as a TSX widget (`unknown-name`, `invalid-prop`, `limit-exceeded`, binding type mismatch). `ephemeralManifest` checks `local` and `initialLocal` together (`TypeError` otherwise) and `compileValidator` holds `local` to the §7.1 rules. The CLI and MCP check a supplied `local` through `validateLocal`, with errors at `/local/...`.
- The digest is bounded: over `budget` it throws `LiveframeFailure` (`limit-exceeded` at `/digest`) and never truncates.
- The converter bounds its input (size, depth, nodes, text) before reading it, iteratively, and returns typed errors with A2UI pointers; it makes no claim about the tree, which `renderElements` validates (`origins_map_render_errors_back_to_a2ui`).
- `richText` input is bounded by `maxLength: 4000`, and `chart`/`table` by `maxItems` in their definitions; the tree validator enforces both. `dateField`'s value is checked by the host's declared state schema.

### 5. Styling

- Recipe completeness is enforced for the ten new kinds (`design_system_without_the_0_4_controls_fails_at_their_recipes`, `design_system_without_the_0_4_content_kinds_fails_at_their_rest_recipes`). `themes.ts` needed no new role.
- The contrast audit read the chart gridline as text and failed the designed `border.subtle` at 1.5:1, so it uses `text.muted` at `opacity.dim` (Task 6).
- Recipes cannot carry a structural field such as height, so the chart's 16rem default height lives in the starter's `primitiveCss`, with the `height` style prop as the override. This is by the rule (spec §6.2), not a gap.
- Starter design-system CSS, before and after plan 039: 155,269 → 195,139 (Task 5) → 205,802 bytes (+50,533, +32.5%); gzipped 8,073 → 9,655 → 10,164. About 5 KB per kind, below spec §5's estimate of 8 KB per kind and variant. `primitiveCss` grew by 2,587 bytes in total.

### 6. Interaction tiers

- **Local:** element JSON now reaches it. `setLocal` is applied by the renderer, checked against the caller's `local` schema, and never calls `onIntent`. An agent's filter box hides rows with no round trip (`gatedShown` in the acceptance run: 0 intents).
- **`setState`:** `slider`, `radioGroup` and `dateField` raise one complete `setState`-carryable value (`slider` from `onChangeEnd` only, never while dragging; `dateField` never a partial date). `progress`, `richText`, `chart` and the table kinds raise nothing.
- **Action:** the converter maps an A2UI action only to an action named in the mapping, and the manifest must declare it. No new tier.

### 7. Performance

All numbers 2026-11-20, Bun 1.4.4, 16 cores, each script run alone. The host shared its cores with other projects' builds and two VMs, at load 5.5–9.3, so every row is a loaded-host reading.

| Row | Budget | Before (task notes) | Now | Verdict |
|---|---:|---:|---:|---|
| `renderElements` agent-home, 679 nodes | recorded | 2.783 µs/node (037) | 1.607 ms, 2.37 µs/node (render bench: 2.504) | recorded |
| `streamElements` ÷ `renderElements`, agent-home | ≤ 3× | 1.9–2.4× (T2) | 2.48× | pass |
| agent-home with a filter and a `when` per row: `renderElements` ÷ plain | ≤ 1.3× | 0.84–1.33× (T2) | 1.09× | pass |
| same, `streamElements` ÷ its `renderElements` | ≤ 3× | 1.9–2.4× (T2) | 2.00× | pass |
| `render` agent-home / `core-queue.full` | ≤ 3 µs/node | 2.348 / 2.780 (037) | 2.113 / 2.295 | pass |
| `css` certified / rack design system sheet | recorded | — | 152,457 / 164,425 bytes (11.4 / 13.5 ms) | recorded (proof systems; plan 039 adds only to the starter) |
| `template` `validateTemplate` agent-home | ≤ 5 ms | 4.725 (038) | 4.320 | pass |
| `host` `httpSetStateCpuMs` | ≤ 50 ms | 0.53 (038) | 0.581 | pass |
| `a2ui` convert 499 components (44,003 characters) | recorded | 1.8 ms (T4) | 1.791 ms | recorded |
| `richText` parse, 4,000 characters | recorded | 0.47 ms (T6) | 0.264 ms | recorded |
| `chart` 4 × 100 bars, production server render | < 16 ms frame | 1.19 ms (T6) | 0.605 ms | pass |
| starter switch (`starter_switch_within_budget`) | ≤ 16.67 ms | 6.20 / 5.30 (T6) | in the full check, green | pass |
| digest size, proof catalog with fixture capabilities | ≤ 20,000 | 16,198 | 16,198 | pass |
| digest size, starter alone | ≤ 24,000 | 14,943 (T3) | 20,210 | pass |
| digest size, starter + demo capabilities + `local.q` | ≤ 24,000 | 17,763 (T3) | **23,269** | pass, 97% (F3) |
| `validator` `core-queue.small/large/full`, agent-home | ≤ 1.5 µs/node | 1.485 / 1.492 (038) | fail in 3 runs at load 4.7–9.3 (1.50–1.60); pass in a fourth at load 6 (full 1.480, agent-home 1.336) | load-sensitive (F4) |

- The `validator` bench failed in the first three runs (load 9.3, 4.8, 4.7) and passed in a fourth. It exits at the first row over 1.5 µs/node, which at this load is 1.50–1.60 on `core-queue.large` and `.full` (agent-home 1.37–1.38). The generic comparison path, which plan 039 did not touch, reads 1.49–1.56 in the same runs, and the compiled/generic ratio stays 0.95–1.09. This matches the open P1 entry's load-sensitive pattern (plans 018, 036–038) and no run isolates plan 039. No run isolates plan 039, which shares its tree with 033–038.
- A host that uses none of the additions pays nothing: an element document without expressions costs what it cost (the stream row's 2.48× is in the 1.9–3.2× range it moved through with and without Task 2); a digest and the converter are separate imports and run only when called; the starter's new kinds are code in a package the app imports, and a tree that does not use them draws nothing new.
- Task 2's claim "A/B within 2%" was not decided on a quiet host (`bench/ab.ts` called its control unusable), and no base ref isolates plan 039, because plans 033–039 share one uncommitted working tree. Backlog (F4).

### 8. Portability

- The core imports no host API and has no A2UI or starter knowledge: `grep` of `src` outside tests finds neither word, and the core's `package.json` diff holds only the two `/dom` subpaths and the `bench` and `gen:check` scripts, so it gained no dependency.
- `@arnilo/liveframe-a2ui` imports only types from the core's public subpaths, has no runtime import and no dependency (`workspace_lists_the_core_then_both_packages` over four packages; the archive gate installs it with only the core).
- The starter gained one peer, `@internationalized/date` (`^3.12.4`; RAC 1.22.0 and 1.22.1 both depend on that range). The starter's `rich-text.ts` and `content.tsx` import no host global, and a source scan rejects `innerHTML`.
- The digest generator builds `self.<prop>` with a join and says "per surface", because the portability scans match those strings in source (Task 3 finding). The finding is recorded in the task note for later emitters.
- Browsers: the content, controls and starter browser tests pass in Chromium, Firefox and WebKit (Task 6: 23 of 23 each). Full-suite runs per engine are in §3.

### 9. Agent authoring

- This plan is the agent-authoring plan. Generated schemas: `generateElementsSchema(catalog, { local })` describes expressions and the allowed `local` keys, and `liveframe gen --elements-schema --local <file>` and MCP `generated_types` take the same `local`. The digest is `liveframe gen --digest` and MCP `generated_types` `module: "digest"`.
- Errors an agent can act on: `invalid-prop` at `/local` ("no such element field"), `unknown-name` for an undeclared local key, `limit-exceeded` at `/digest`, and for the converter `unknown-component`, `refused construct` and the other typed errors, each with a pointer into the A2UI input and `origins` to map render errors back.
- **Acceptance run on the finished tree** (`plans/evidence/039-agent-acceptance.md`, "Rerun at plan end"): a fresh agent with only the 23,269-character digest (starter, demo capabilities, `local.q`) wrote a weekly report with formatted text and a link, a bar chart, a table with column and row headers and a filter box that hides rows. `renderElements` accepted it on the first answer with no fix, `streamElements` reached the same tree in 22 drawn trees, and the surface core hid the non-matching rows with no intent. Its twelve noted guesses needed no digest change (the digest already says `when` goes on any element, and string literals are valid operands).
- Gap (F7): the agent asked for case-insensitive matching in both runs (Task 3 guess 2, this run's guess 2). `$contains` is case-sensitive and the allowed operator list has no folding form.

### 10. Docs and examples

- Outsider docs are current for the additions: `docs/sdk.md` ("Live filters in agent JSON", "Describe the catalog to an agent", streaming notes), `docs/mcp.md`, `docs/demo-agent.md`, the starter README (the new kinds with their rules, and the new peer), `docs/getting-started.md`, `docs/security.md` (formatted text and links), `docs/migration-0.4.md`, `docs/compatibility.md` (four packages), the converter's README (refusal table, origins, a worked starter mapping), and `CHANGELOG.md`.
- Gaps (F1, F2, executed): `docs/security.md` had no section for the agent additions and did not say that an A2UI mapping chooses which actions an agent may offer; and no guide in `docs/` or the root README linked to the converter's README, which is the only place that explains it. Both are added in this task.
- `bun run demo:test` (78) and `bun run guide:test` pass. The demo host shows none of the plan 039 additions beyond the starter itself. The agent-written element JSON and A2UI flows are proved by the tests, the acceptance run and the executed guide, so this is not a finding; plan 037's backlog entry "Show the 0.4.0 interaction additions in the demo host" already covers showing the additions there.

### 11. Conformance

- The four starter suites (`catalogSuite`, `designSystemSuite`, `rendererSuite`, `rendererBrowserSuite`) run over the whole widened starter with examples and state fixtures for every new kind (`starter_passes_every_suite_with_the_new_controls`, `starter_passes_every_suite_with_the_content_kinds`), and the 17 + 2 new state fixtures are checked by `every_styled_state_is_reachable`.
- `conformance/corpus/elements/` gained six cases with expressions (`expressions-valid`, `local-field`, `when-unknown-local`, `set-local-without-local`, `bind-type-mismatch`, `when-in-props`), and the generated schema accepts the valid corpus and rejects the invalid (`generated_schema_accepts_the_valid_corpus_and_rejects_the_invalid`).
- The converter has 34 package tests but no shared suite: it is an app-mapped converter, and its output is held by the existing element corpus through `renderElements`. A converter suite would test the app's mapping, which the library cannot supply. Recorded, not a finding.
- Existing backlog entry "Cover the surface core and local bindings in the renderer conformance suites" is unchanged: element JSON reaches the same surface core.

### 12. Reference hosts

- **Synapta and Clay:**
  - Both can let an agent write a filter without a TSX widget (F9) by supplying `local` to `ephemeralManifest`, and can describe their catalog to a non-MCP agent in one file (F10). Neither needs A2UI today; the converter stays opt-in.
  - A host that wrote its own design system for `starter.ui@1` must add the ten kinds' recipes on upgrade (documented; see area 2).
  - `dateField` raises the empty string when cleared, not `null`, because the catalog's scalar `carries` take no bounds and no null (Task 5). A host that stores the date declares its state with `maxLength: 10`, optionally a pattern that allows `""`. Backlog (F6).
- No migration bent the design.

---

## 2. Findings and Disposition

Presented to the owner on 2026-11-20: "Accept all (Recommended)".

| # | Finding | Area | Recommended | Disposition |
|---|---|---|---|---|
| F1 | `docs/security.md` had no section for the agent additions, and did not say that the A2UI mapping decides which actions an agent may offer | 3, 10 | **execute**: a "0.4.0 audit: agent-written UI" section and a "What is not protected" bullet | **execute**, done in this task |
| F2 | No guide in `docs/` or the root README linked to `packages/a2ui/README.md`, the only explanation of the converter | 10 | **execute**: a "Convert an A2UI document" section in `docs/sdk.md` and a README link | **execute**, done in this task |
| F3 | The starter digest with the demo capabilities and `local` is 23,269 characters, 97% of its 24,000 budget, and `gen:check` gates only the starter's own digest (20,210). One more kind or a few more actions passes the budget unnoticed until a host builds it | 7, 9 | **backlog** P3: decide the budget a host's digest is held to and gate a representative one |  **backlog** P3 |
| F4 | `validator` bench fails at load 4.7–9.3 (1.50–1.60 µs/node), and Task 2's "within 2%" A/B for `renderElements` was not decided (the control was unusable). No base isolates plan 039 | 7 | **backlog**: add the measures to the existing P1 entry "Phase 1 performance gate" and to "Let `bench/ab.ts` decide 2% on a host that is never idle" |  **backlog** (both entries extended) |
| F5 | The starter's `radio` uses React Aria's `Radio`, which 1.22.1 marks deprecated in favour of `RadioField` and `RadioButton`; the `^1.22.0` floor may not have the replacement | 2, 8 | **backlog** P3 |  **backlog** P3 |
| F6 | `dateField` raises `""`, not `null`, when cleared, because scalar `carries` take no bound and no null. A nullable scalar or an object carry would fix it, and is a format change | 2, 12 | **backlog** P4 |  **backlog** P4 |
| F7 | `$contains` is case-sensitive; agents ask for case-insensitive filters in both acceptance runs and the operator list has no folding form | 9 | **backlog** P3 |  **backlog** P3 |
| F8 | Task 1's handoff list is open: incremental A2UI conversion, A2UI v1.0, a `meter` kind, an interactive table, and parent rules for definitions | all | **backlog** (P3 for incremental conversion and parent rules, P4 for the rest) |  **backlog** (three entries) |
| F9 | Plans 033–039 are uncommitted in one working tree, so no task commits alone by path and no per-plan bench base exists (as plan 038 F5) | 7 | recorded; the owner chooses the commit strategy |  recorded; stays uncommitted |

---

## 3. Verification

All runs on 2026-11-20, Bun 1.4.4, 16 cores, at load 4–9.

| Command | Result |
|---|---|
| `bun run check` (build, `gen:check`, typecheck, lint, format, tests) | Pass: 2,122 pass, 9 skip, 0 fail (185 files, 799 s). The one before-fix failure of Task 6 (`docs_links_resolve`, `source_comments_cite_no_plan_or_decision_ids`) is in this run and passes. |
| `bun run demo:test` | 78 pass, 0 fail. |
| `bun run guide:test` | Pass (6.8 s). |
| `bun run release:gate` | Pass: archive rules and installed smoke test for all four packages. |
| each `bun run bench` script, run alone | `render`, `css`, `template`, `stream-elements`, `host`, `a2ui`, `starter-content` exit 0. `validator` exited 1 in three runs at load 4.7–9.3 and 0 in a fourth at load 6 (F4). |
| `LIVEFRAME_BROWSER=webkit bun run test` | Pass: 2,115 pass, 16 skip, 0 fail (842 s). |
| `LIVEFRAME_BROWSER=firefox bun run test` | Pass: 2,121 pass, 10 skip, 0 fail (930 s). |
| After F1 and F2: `docs-links`, `docs-wording`, `docs-spec-structure` | Pass (12 tests), and `bun run format:check` passes. The doc edits are Markdown only, so the full suite was not rerun. |
