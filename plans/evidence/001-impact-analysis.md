# Plan 001 impact analysis

Plan 001 Task 13, 2026-10-22. This sweeps the impact areas in `.agents/skills/create-plan/references/liveframe.md` §5 against what Plan 001 delivered: the `proof/` workspace, `proof/REPORT.md`, the spec edits from Task 12 and `decision-logs/2026-10-22-0033-phase-0-conditional-go.md`. Every finding is listed under its area and in the findings table, and each disposition is recorded there.

## Areas

1. **Spec.** `docs/spec.md` now describes capabilities that the proof does not yet have:
   - in §5: `disclosure`, layout `semantics`/`label`, button `current`/`pressed`;
   - in §6.2–§6.4: `breakpoint` values, responsive values, `position`/`inset`, box `fill`/`radius`, `textAlign`/button `align`, surface-root typography.

   This is intentional under the conditional go, but they still need proving (**F1**). Everything else in §5–§12 matches what was built. The proof's commit event is named `onChange`; the spec keeps `onCommit` (G19; see **F4**).
2. **Public API and formats.** None. `package.json` still exports only `.`, at version `0.0.0`, `private`. `src/` is unchanged and does not import `proof/`. The new dependencies (React, React DOM, React Aria Components, Playwright and their types) are dev-only, used by the proof alone. The format changes from Task 12 exist only as spec text until Phase 1.
3. **The four laws.** All four held across the four UIs (`proof/REPORT.md` §10, with named tests). The spec opens two new paths, and each needs a rejection test when built (**F1**, then Phase 1):
   - Law 3: the `fill` style prop admits non-surface theme roles. It must accept only roles the app declares fillable, never a literal.
   - Law 2: responsive style values are objects. Each breakpoint key and each value must be validated as closed data.
4. **Validation.** Proof validation is fail-closed for every input the four UIs use (`proof/tests/runtime.test.ts`, `host.test.ts`). Two items are not built:
   - the reusable install validator for untrusted themes and design systems (G28);
   - code-point enforcement of `maxLength` in the browser (G20).

   Both are later-phase work (**F4**).
5. **Styling.** Theme authority and recipe completeness are proven for 536 recipes per system (`proof/tests/styles.test.ts`), and so is the projection (`proof/tests/projection.test.ts`). Open items:
   - surface-root typography (G12);
   - per-surface projection scope (G27);
   - Certified's identity roles (G2; **F3**).

   The styling skill reference does not yet list `breakpoint` values or the assembled theme (**F2**).
6. **Interaction tiers.** All three were exercised end to end (`proof/REPORT.md` §4). Binding an event's value into an action argument is now an open decision in §15 (**F5**).
7. **Performance.** Every budget was met (`proof/REPORT.md` §9). The full core queue renders at 1.702 ms against a 2 ms mean budget, so the new props must be re-measured in the re-proof (**F1**).
8. **Portability.** None. `proof/tests/runtime.test.ts` (`runtime_sources_use_no_host_api`) scans the proof runtime sources and a browser-targeted bundle. `src/` has no host API.
9. **Agent authoring.** None. Typed `WidgetError` kinds with paths, and compile-time rejection of catalog-derived props, were proven (`runtime-jsx.test.tsx`). `liveframe gen` is Phase 2 scope.
10. **Docs and examples.** `README.md` is still accurate ("Phase 0 comes first"). `proof/host/README.md` documents the harness. Skill guidance is out of date (**F2**):
    - the "Today" section of `references/proof.md` still says "Nothing built";
    - `references/styling.md` predates the Task 12 §6 changes.
11. **Conformance.** None for now: Phase 5 has not started. The proof tests are prior art for its catalog, design-system and renderer suites (**F6**).
12. **Reference hosts.** Recorded in `proof/REPORT.md` §6:
    - Synapta: Certified lacks patch identity and diagnostic fill roles (G2).
    - Clay: Rack's docs claim 273 recipes, but there are 247 (G3); Rack has undeclared spacing and easing references (G5); Rack typography is user-owned (G1, resolved by spec §6.1).

    These need handing to the adopters (**F3**).

## Findings

| # | Finding | Area | Recommended | Owner's answer |
| --- | --- | --- | --- | --- |
| F1 | Follow-up plan: add the Task 12 spec additions to `proof/`, with rejection tests for `fill` and responsive values; snapshot the artifact fonts; re-run `proof/scripts/parity.ts` to ≤ 1% mismatch or an all-intended inventory; re-measure the render budgets. This closes Phase 0. | 1, 3, 7 | backlog (P1) | backlog: `plans/backlog.md` "Phase 0 parity re-proof" |
| F2 | Update the `liveframe-execution` references: the "Today" section of `proof.md`, and `styling.md` for `breakpoint` values and the assembled theme. | 5, 10 | execute | executed as Plan 001 Task 13 |
| F3 | Hand the adopter gaps to Synapta (G2) and Clay (G3, G5, G1). | 12 | backlog (P4) | backlog: "Hand adopter gaps to Synapta and Clay" |
| F4 | Track the gaps the report assigned to later phases: `onCommit` naming (G19) and the install validator (G28) in Phase 1; surface typography (G12) and per-surface projection (G27) in Phase 3; code-point `maxLength` (G20), app icon sets (G26) and a real-platform accessibility audit (G29) in Phases 3–4. | 1, 4, 5 | backlog (P2) | backlog: "Later-phase gaps from the Phase 0 report" |
| F5 | Decide the §15 open items before Phase 1 freezes the formats: whether the primitive set becomes a standard contract, and how an event's value binds into action arguments. | 6 | backlog (P2) | backlog: "Decide the spec §15 open items before Phase 1" |
| F6 | Seed the Phase 5 conformance suites from the proof's catalog, style, projection and renderer tests. | 11 | backlog (P3) | backlog: "Seed conformance suites from the proof tests" |

Owner's answer (2026-10-22): first the owner selected every finding for execution. When asked to confirm the scope (F1 is several large tasks, F4 pulls Phase 1/3/4 work forward, F3 writes into sibling repos), they chose "Execute F2; backlog rest". F2 was executed as Task 13; the rest are in `plans/backlog.md`.
