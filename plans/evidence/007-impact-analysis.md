# Plan 007 — architectural impact analysis

Reviewed 2026-10-24 against delivered Tasks 1–11, roadmap Phase 3, spec §2,
§6.1–§6.5, §11 and §13, and all twelve impact areas in
`.agents/skills/create-plan/references/liveframe.md` §5. The accepted
`decision-logs/2026-10-23-2314-css-projection-model.md` supplies the scoping,
preference, platform and exclusion decisions. This review changes no normative
design and introduces no runtime API or dependency.

## Impact areas

1. **Spec.** `docs/spec.md:224–270` describes three validated independent
   sheets, stable slot classes, state order, host-owned loading, preferences,
   forced colours and unsupported nesting. `src/css/design-system.ts:35–103`
   implements the recipe/state/container path; `src/css/theme.ts:75–97` and
   `src/css/base.ts:6–36` implement the other sheets. The renderer remains a
   target in §11, not a claim that `/react` has shipped. None — no normative
   correction is needed. **F2/F7** retain the existing renderer and nesting
   boundaries; **F1** corrects execution metadata only.

2. **Public API and formats.** `/css` exposes exactly eight functions through
   `src/css/index.ts`, with runtime names and return types pinned in
   `src/__tests__/exports.test.ts:46–78`. Required
   `vocabulary.surfaceTypography` ships with the catalog schema, fixtures,
   validator, major-change classification and author documentation (Task 2).
   `colourVar`, `valueVar` and `slotClass` encode installed identifiers rather
   than validating arbitrary strings; `surfaceAttributes` accepts installed
   identities and a validated tree. None — no new export or schema correction
   is needed. No publish/version bump; the existing release-archive gate must
   still exclude proof fixtures from `src/__tests__` before Phase 6.

3. **The four laws.** `/css` executes no widget and grants no authority. Law 3
   covers base, theme, recipe/state, forced-colour and layout output through
   `colour_authority_holds` (`src/__tests__/css-theme.test.ts:196`),
   `every_recipe_property_projects` (`css-design-system.test.ts:18`), and
   scalar/responsive style checks (`css-style-props.test.ts:57–94`). The sheet
   guard checks balanced forced-colour block boundaries, including shorthand
   system colours and negative controls. Layout tests independently assert
   role variables and reject literal/raw style values; responsive chains only
   forward validated values. Escaping and injective naming tests cover string,
   scope and helper output. Trusted app primitive CSS is explicitly outside
   the widget/installed-data boundary and must not interpolate widget text.
   None — no new colour, raw CSS, execution or authority leak found.

4. **Validation.** All three sheets validate before returning `Result<string>`
   with no partial output. Design-system installation/resolution retains
   closed properties, references, inheritance and completeness checks.
   `src/css/style-props.ts:89–120` reuses `compileStyles` and throws before
   returning invalid declarations; this is the documented helper contract,
   not a typed install result. It requires an installed immutable catalog and
   does not replace per-kind tree validation. Rejection tests include unknown
   props/roles/breakpoints, raw CSS, forbidden tracks and bounds. None — no
   undocumented input path or error-contract change is required. **F8** keeps
   the disclosed mixed-unit ordering limit visible.

5. **Styling.** All 27 recipe properties and 38 layout props have direct tests,
   including scalar/responsive forms, authored units, logical sides, cascade
   order, equal-state omission, entry and preferences. Browser tests prove
   state/disabled propagation, container fallback, RTL, overlay blur and
   forced-colour distinction for 64 Certified and 68 Rack differing recipes.
   `src/css/surface.ts:7–32` adds containment only for responsive trees.
   **F4/F5/F7/F8** retain strict CSP, native-part styling, unsupported nesting
   and mixed-unit limits. None — no missing mapping among supported properties.

6. **Interaction tiers.** CSS projects state selectors, not event handlers.
   The proof renderer passes interactions under both systems; it is not the
   published `/react` implementation. **F2** hands off native/data/ARIA state
   semantics, scoped portals, reduced-motion-aware exit/delayed unmounting,
   scroll locking, inertness and focus/scroll/local-state preservation to
   Phase 4 Part A (`docs/spec.md:590–605`). **F3** hands the independent scoped
   sheets to preview; actions remain logged without dispatch under the
   existing preview handoff. No interaction tier or authority is added here.

7. **Performance.** Tasks 5, 9 and 10 all have measured records (table below).
   The refreshed mapper gate passes; the full check exercises both scoped
   blur and hydrated host switch gates. The latter preserves markup, nodes,
   focus and widget output and makes no requests. Parity remains under 1% at
   all three widths and `proof_node_counts_hold` retains 679 nodes. **F1/F6**
   distinguish the accepted warm gate from G33's load-sensitive cold cost and
   from GPU paint/compositing. None — no new optimization is justified by the
   current measurements; generation time and bytes are observations, not gates.

8. **Portability.** `src/__tests__/portability.test.ts:33–51` bundles `/css`
   for browsers and scans core source without a CSS exception. Projection
   uses strings/plain objects and no DOM APIs. Baseline 2024 and progressive
   reduced transparency remain the accepted contract; host loading, CSP and
   cache invalidation are documented. **F4/F6/F7** retain policy, real-platform
   audit and conditional platform-floor questions. None — no new dependency,
   host-API exception or portability fallback is needed. Checkout checks do
   not establish installed release behavior or every browser/runtime.

9. **Agent authoring.** The required typography role is reflected in fixtures,
   generated/schema agreement and error-pointer tests; generated-code drift
   checks pass. CSS offers no author permission or raw-style escape hatch.
   None — no new agent API or generator change is needed. The existing
   conformance and preview/MCP handoffs retain structured validation feedback.

10. **Docs and examples.** `docs/styling.md` explains the installed-input
    contract, sheets/cache/loading/CSP, scalar/responsive layout, container
    placement, state table, overlays, switch sequence, preferences and trusted
    primitives. `proof/PARITY.md:79–83` records adoption and Rack's deviation.
    **F1** corrects the execution references' stale "Today" descriptions and
    an older backlog statement; Task 12 reconciles roadmap §3 only for plan
    007, leaving plans 002/005 open and preserving existing owner edits.

11. **Conformance.** Task 11 already handed every Task 3–9 case to the existing
    “Seed conformance suites from the proof tests” backlog entry. It explicitly
    separates pure output from browser checks and internal performance gates,
    and preserves G29's manual audit. None — no additional conformance finding;
    Phase 5 still owns the public suite and `/conformance` export. This review
    neither duplicates the handoff nor claims a published suite exists.

12. **Reference hosts.** The migrated proof exercises all 39 host variants
    under both systems and preserves Certified parity; it does not migrate
    Synapta or Clay. **F9** adds Rack's native `color-scheme` scrollbar to the
    existing adopter handoff (`proof/GAPS.md:175–180`). **F2/F6** retain
    production overlay/accessibility obligations. No app-specific role or
    product component is added to the library to hide the deviation.

## Findings and dispositions

The table was presented to the owner during execution. The owner's request to
complete Task 12 and update the plan authorizes these maintenance and handoff
actions; no separate per-row response was received or is claimed. Backlog rows
retain existing phase assignments or accepted exclusions, rather than approve
new features or redesign the projection. No new architecture decision log is
needed. F1 is executed as Task 11a plus Task 12's backlog/ledger closure.

| ID | Finding and evidence | Recommended disposition | Recorded disposition and result |
| --- | --- | --- | --- |
| F1 | Execution architecture/styling references still describe proof adoption as pending; the older later-phase backlog treats G27 as open despite `proof/GAPS.md:175–180`. | execute | execute under Task 12 authorization; Task 11a corrects both shared skill references; Task 12 reconciles backlog and roadmap. |
| F2 | Production renderer must consume the scoped overlay/lifecycle contract (`docs/spec.md:590–605`, `docs/styling.md` renderer contract). | backlog | backlog P2, Phase 4 Part A: “Carry the CSS overlay contract into the production renderer”. |
| F3 | Preview matrix needs independent sheets, sibling scopes and per-cell containers (`docs/spec.md:224–238`, Task 9 browser proof). | backlog | backlog P2, Phase 4 Part B: extended “Build preview sessions on the shipped package and runner contracts”. |
| F4 | Current layouts require inline style attributes; sheet nonces do not solve strict attribute CSP (`docs/spec.md:270`, `src/css/style-props.ts:89–120`). | backlog | backlog P3, conditional extension: “Evaluate an atomic-class route for strict style CSP”. |
| F5 | Placeholder/scrollbar colours have no recipe properties (`docs/spec.md:270`, accepted decision 14). | backlog | backlog P4, conditional extension: “Evaluate placeholder and scrollbar recipe properties on adopter demand”. |
| F6 | Chromium automation cannot close G29's real Windows/assistive-technology gate (`proof/GAPS.md:178`). Cold G33 remains load-sensitive (`:167`). | backlog | backlog P2: updated “Later-phase gaps from the Phase 0 reports” with delivered G27, warm gate, conditional cold revisit and concrete manual audit evidence. |
| F7 | Attribute scoping does not isolate nested surfaces (`docs/spec.md:235`, negative nesting browser case). | backlog | backlog P4, conditional extension: “Revisit scoping only if nested surfaces become required”; evaluate `@scope` only with a new contract/platform decision. |
| F8 | Mixed px/rem query ordering assumes a 16px root (`src/css/design-system.ts:84–99` and documented shortcut). | backlog | backlog P3, conditional extension: “Revisit mixed-unit breakpoint ordering for non-16px roots”; single-unit values remain the documented workaround. |
| F9 | Rack uses native scrollbar appearance after migration (`proof/PARITY.md:83`, `proof/GAPS.md:180`). | backlog | backlog P4, Phase 7: extended “Hand adopter gaps to Synapta and Clay”. |

All nine findings are disposed. The existing Task 11 Phase 5 handoff remains
in Further Actions alongside F2–F9; no runtime feature is added to close an
explicitly deferred phase or exclusion.

## Performance evidence

| Task | Required gate | Delivered measurement and reproduction |
| --- | --- | --- |
| 5 | Layout mapping ≤ 1 µs/node over 679-node agent-home | Task 5: 0.737 µs/node, 0.500 ms/tree. Task 12 refresh: **0.389 µs/node, 0.264 ms/tree**; `timeout 300s bun bench/css.bench.ts`, 200 warm-ups / 1,000 runs. |
| 9 | Ten warm switches ≤ 16.67 ms with open blur; record cold | Task 9: 954 elements, 7.7 ms cold / 10.0 ms warm max. Migrated Task 10 fixture: 8.4 ms cold / 9.0 ms warm max. Task 12 check: **8.1 ms cold / 9.9 ms warm max**; `timeout 120s bun test src/__tests__/css-scope-browser.test.ts`. Attribute changes plus computed styles include overlay/backdrop; no GPU-paint claim. |
| 10 | Hydrated switches ≤ 16.67 ms warm, parity ≤ 1%, unchanged node count | Task 10 full check: agent-home 10.9 ms cold / 3.1 ms warm max, git-status 3.4 / 1.6 ms; earlier concurrent cold 25 ms remains recorded. `timeout 120s bun test proof/tests/switch.test.ts`; `proof_node_counts_hold` retains 679 nodes. Parity 0.72% / 0.75% / 0.97% at 1440 / 1024 / 390; `timeout 600s bun proof/scripts/parity.ts --out evidence/parity`. |

Task 12 sheet observations (same benchmark, validation/resolution included):
base **0.356 ms / 1,072 bytes**; Certified theme **0.768 ms / 7,754 bytes**,
system **9.705 ms / 148,165 bytes**; Rack theme **0.776 ms / 9,176 bytes**,
system **13.599 ms / 158,141 bytes**. Hosts cache by immutable inputs. Timings
are local/load-sensitive; the benchmark asserts the mapper gate, not sheet time.

## Verification

- Task 11a: `timeout 600s bun run check` passed generation drift, both
  typechecks, lint, formatting and **374 tests / 109,961 assertions**, zero
  failures. Existing non-fatal proof lint warnings remain. Shared skill copies
  compare equal and `git diff --check` passes.
- `timeout 300s bun test src/__tests__/css-`: **49 pass / 8,379 assertions**,
  zero failures. Scoped blur switch: **11.5 ms cold / 13.9 ms warm max**, all
  ten warm samples under 16.67 ms across 954 elements.
- `timeout 120s bun test proof/tests/switch.test.ts`: **4 pass / 403
  assertions**, zero failures, including all 39 route/scenario/size variants
  under both systems. Agent-home **11.1 ms cold / 3.7 ms warm max**; git-status
  **3.5 / 1.2 ms**. Both hydrated warm gates pass.
- `timeout 600s bun proof/scripts/parity.ts --out evidence/parity` reproduced
  **9,712 / 1,345,728**, **7,088 / 938,880**, **5,572 / 576,380** changed
  pixels: **0.72% / 0.75% / 0.97%**, with the approved 281 DOM / 32 style
  differences and empty diagnostics. The JSON `parity: false` refers to exact
  DOM/style equality, not the accepted pixel bar.
- Documentation assertions verify twelve areas, nine finding rows, all plan
  backlog anchors and identical shared skill references. No new test file is
  needed for these documentation corrections and handoffs.
- Final `timeout 600s bun run check` after the handoff/plan edits passed
  generation drift, both typechecks, lint, formatting and **374 tests /
  109,961 assertions**, zero failures. Existing non-fatal proof lint warnings
  remain. Final scoped blur switch: **8.2 ms cold / 8.8 ms warm max**.
  `git diff --check` passes. Plan 007 is closed; plans 002/005 retain their
  independent open impact/owner gates. Existing owner index and roadmap-row
  additions are preserved in the working tree and excluded from task commits.
- Evidence images stay local under `/evidence/`; parity regeneration uses
  `proof/scripts/parity.ts`. No published package, production host migration,
  real Windows hardware or assistive technology is claimed by this review.
