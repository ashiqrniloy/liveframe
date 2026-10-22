# Plan 002 impact analysis

Plan 002 Task 9, 2026-10-22. This sweeps the impact areas in `.agents/skills/create-plan/references/liveframe.md` §5 against what Plan 002 delivered: the `proof/` workspace, `proof/PARITY.md`, `proof/REPORT.md`, the spec changes, and `decision-logs/2026-10-22-1519-phase-0-go.md`. Every finding is listed under its area and in the findings table, with its disposition.

## Areas

1. **Spec.** `docs/spec.md` now describes what shipped, with four gaps found and closed here (**F1**, **F2**):
   - §6.1 listed only `letterSpacing` and `textTransform` as optional typography fields. The parity work needed `fontStretch` (the mono at 87.5%) and `fontSizeAdjust` (Martian Mono's x-height), both of which the proof now requires and validates. Closed.
   - §6.3's responsive example used `{ base, md }`, while the implemented and validated keys are declared value names (`bp.sm`, `bp.md`), and the inheritance rule that made the layout converge — a value holds at every wider breakpoint, so a missing wider key never resets a narrower one — was unstated. Both closed.
   - §6.4 did not say that the query container is emitted only for surfaces that use responsive values, which is what keeps a plain surface inside the switch budget. Closed.
   - §10 did not say that a dimension naming an undeclared design value fails. Closed.

   `proof/REPORT.md` and `proof/GAPS.md` said "25 kinds" where the catalog has **24** (**F2**); both corrected, as was the decision log.

2. **Public API and formats.** None published: `package.json` is still `private`, version `0.0.0`, exporting only `.`, and `src/` does not import `proof/`. Four format surfaces did change in the proof and are all now spec text: typography's optional fields (§6.1), declaration of `size.*` and breakpoint names (§6.2), responsive values plus `position`/`inset`, `fill`, `radius`, `textAlign` and button `align` (§6.3), and the projection's container rule (§6.4). The two §15 open items survive this plan: whether the set is a standard contract, and event-value binding into action arguments. Neither touches the catalog, so neither blocks the freeze (**F5**).

3. **The four laws.** No new leak path (`proof/REPORT.md` §10 re-confirms each law against the new surfaces with named tests):
   - Law 3: `fill` takes only roles the app declares fillable; a literal and an undeclared role both fail (`fill_accepts_only_declared_fillable_roles`, `definitions_admit_no_colour_or_raw_style_props`, `no_colour_outside_themes`).
   - Law 2: responsive values are closed objects — unknown keys, wrong value domains and nested objects fail (`responsive_style_values_are_closed_data`), and `semantics` is a closed enum whose `terms`/`term`/`detail` rules are enforced (`semantics_are_a_closed_enum_with_terms_child_rules`).
   - Law 4: `aria-current`/`aria-pressed` come from the `current`/`pressed` props and carry no authority; disclosure's `onToggle` is tier 1, so it raises no intent.
   - Law 1: the browser bundle is unchanged in what it may contain; the disclosure, tabs and menu primitives are React Aria, and the switch still sends no request (`switch.test.ts`).

   None — no new path, with the tests above as the evidence.

4. **Validation.** Every new input is validated as closed data with typed errors: the `semantics` enum and its child rules, `current`/`pressed` booleans, `fill` against the declared fillable subset, `radius` against declared names or `full`, `textAlign`/`align` enums, and responsive values per key and per value domain. Undeclared `space.*`/`radius.*`/`size.*`/breakpoint names fail projection, not silently fall back (`projection_rejects_injection_missing_recipes_and_unresolved_values`, `style_values_reference_declared_value_names`). The install validator for untrusted themes remains later-phase work (G28; **F5**).

5. **Styling.** Theme authority and recipe completeness hold for both systems (`recipes_reference_only_declared_roles_and_values`, `themes_keep_reference_colour_authority`, `design_systems_are_complete_for_the_catalog`). The projection gained a base block (`[class*=lf-] { box-sizing; margin: 0; border: 0 }`), per-side border widths, the breakpoint fallback chain, and dedupe of state rules that repeat a slot's rest declarations — each with a test (`per_side_border_widths_project_to_their_css_sides`, `responsive_values_project_to_fixed_rules_and_custom_properties`, `projects_every_recipe_to_stable_classes_and_variables`). Choices the look forced are recorded rather than hidden: the wrapping `inline` instead of a container-query grid, and 4 px tab padding (`GAPS.md`, `PARITY.md`). Certified's tuned data must be ported back to Synapta (**F6**).

6. **Interaction tiers.** All three still work, and the plan added a fourth tier-1 path: `disclosure` renders native `details`/`summary` with local open state and `onToggle` (`semantics_and_disclosure_render_their_elements`, `agent_home_hydrates_selects_filters_pages_and_dispatches_card_controls`). A current row exposes `aria-current`; a pressed button exposes `aria-pressed`.

7. **Performance.** One budget does not hold: the render bench (**F3**). The artifact-faithful tree is 679 nodes at 50 rows and the proof's render path costs 8.5 µs per node, so the 50-row selection rerender is 5.75 ms and `core.queue` 3.02–4.18 ms from medium, against 2 ms. The other budgets pass: `runtime.bench` 1.75 ms, `clay.bench` 0.79/1.30 ms, the host round trip 7.67 ms against 50 ms, and the switch 3.80/0.80 ms against 16.67 ms warm. The owner converted the failing bench into Phase 1's exit criterion (≤ 3 µs per node) instead of raising it. The cold container-query flip (~17 ms once per page) is Phase 3's (**F4**).

8. **Portability.** None. `proof/tests/runtime.test.ts` (`runtime_sources_use_no_host_api`) still scans the proof runtime sources and a browser-targeted bundle; the new code lives in the projection and renderer, which are allowed host APIs, and in widget files that only run in Bun.

9. **Agent authoring.** None yet. The catalog's new surface — 12 `semantics` values with a `label`, `current`/`pressed`, `disclosure`'s three slots, the `box` look variants, and responsive objects on every style prop — is exactly what `liveframe gen` (Phase 2) must type. The proof already proves the mapping through the typed JSX runtime (`automatic_jsx_runtime_expands_typed_catalog_primitives`), so no action now beyond keeping it in the Phase 2 scope.

10. **Docs and examples.** Three drifts, all closed here:
    - `proof/host/README.md` still credited Task 11 with the parity evidence and did not mention the page gutters, the capture alignment, the inventory script, or that the agent-home bench is over budget (**F7**).
    - `.agents/skills/liveframe-execution/references/proof.md` still said "conditional go" and "Phase 0 stays open", which would send an agent to redo finished work (**F8**).
    - `references/styling.md` was already current from Task 6 (typography optionals, responsive values, `fill`) and needed no change.

11. **Conformance.** Phase 5 has not started. The proof's suites and both scripts are the prior art, and the backlog entry now names the Plan 002 additions: the closed-data tests, the disclosure/`aria-current`/semantics browser test, and the parity plus inventory scripts (**F6**).

12. **Reference hosts.** Gaps for the adopters, in `proof/REPORT.md` §6 and `proof/GAPS.md`:
    - Synapta: Certified lacks five-patch identity and diagnostic fill roles (G2), and now also has to receive the look data the parity work proved (typography roles, `fontSizeAdjust`, `foil`, `size.glyph`, `bp.sm`, the `plate`/`rule`/`callout` recipes) (**F6**).
    - Clay: Rack's recipe count discrepancy (G3), undeclared spacing and easing references (G5), user-owned typography (G1, allowed by §6.1), and its `box.default` padding, which clamps the lamp and pips to 24 px instead of the declared 8/4 px (**F6**).

    These are the adopters' own gaps or data to port; the library is not bent to them.

## Findings

| # | Finding | Area | Disposition | Owner's answer |
| --- | --- | --- | --- | --- |
| F1 | Spec drift on four surfaces the re-proof made normative: typography's `fontStretch`/`fontSizeAdjust` (§6.1), responsive key names and the hold-at-wider rule (§6.3), the container-only-when-responsive rule (§6.4), and undeclared-value rejection (§10). | 1, 2, 4 | execute | executed in this task (`docs/spec.md` §6.1, §6.3, §6.4, §10) |
| F2 | The report, `GAPS.md` and the decision log said 25 kinds; the catalog has 24 (`proof/catalog/definitions.ts`). | 1 | execute | executed (all three corrected; `GAPS.md` §"terms" note included) |
| F3 | The render bench is over budget (679 nodes, 5.75 ms vs 2 ms; `core.queue` from medium up). Carry it as Phase 1's exit criterion (≤ 3 µs per node) rather than raising it. | 7 | execute (roadmap) + backlog (P1) | roadmap Phase 1 "Done" now carries it; backlog "Phase 1 performance gate: 3 µs per node" |
| F4 | The cold container-query flip (~17 ms once per page) is a projection cost, not a look requirement. | 5, 7 | backlog (P2) | backlog "Later-phase gaps" → Phase 3 (G33) |
| F5 | The two spec §15 open items (standard contract; event-value binding) survive the freeze and are format questions. | 2, 4 | backlog (P2) | backlog "Decide the spec §15 open items" |
| F6 | Adopter handoff: Synapta needs Certified's proven look data ported and still lacks identity/diagnostic fill roles; Clay needs its Rack recipe-count, undeclared-value and bare-box gaps recorded. | 5, 11, 12 | backlog (P4) | backlog "Hand adopter gaps to Synapta and Clay", plus the conformance entry naming the Plan 002 tests and scripts |
| F7 | `proof/host/README.md` was stale: parity ownership, gutters, capture alignment, inventory script, bench status. | 10 | execute | executed |
| F8 | `references/proof.md` still described Phase 0 as open with a conditional go. | 10 | execute | executed ("Today" rewritten) |
| F9 | G30 (icon hue), G31 (tab count), `position: relative` and px-only `basis` are look/expressiveness gaps inside the pixel bar. | 5 | backlog (P3) | backlog "Composition surface gaps from the parity re-proof" |
| F10 | G30–G33 were cited by the report, the decision log and the plan but existed only as prose in `GAPS.md`; the numbers now have a register. | 1, 10 | execute | executed (`GAPS.md` "Plan 002 gap numbers") |

Owner's answer (2026-10-22): pending in this task's gate — the ten findings were presented with the dispositions above, and the answer will be recorded here before the task is ticked.

Areas with no finding: 3 (four laws — evidence above), 8 (portability), 9 (agent authoring — Phase 2 scope).
