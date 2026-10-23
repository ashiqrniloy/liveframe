# Plan 005 — architectural impact analysis

Reviewed 2026-10-24 against delivered Tasks 1–9, corrective Task 9a, roadmap
Phase 2 Part A, spec §2, §7.1–§7.5, §8–§10 and §13, and all twelve areas in
`.agents/skills/create-plan/references/liveframe.md` §5. The accepted Phase 2
SDK/package contracts and subsequent plan 006 loader amendment remain the
authority. No new architecture, dependency, public API or spec meaning is adopted.

## Impact areas

1. **Spec.** §7.2's generated source module, compiled-validator argument,
   bounded `Result<UiTree>` and input error pointers are delivered. Task 1's
   decisions are recorded in
   `decision-logs/2026-10-22-2330-phase-2-sdk-and-package-contracts.md`.
   `src/sdk/render.ts:150–175` previously treated shallow freezing as deep
   freezing; **F1** corrects this implementation gap against §7.1, without
   changing the spec. **F2/F3** retain disclosed cache and diagnostic limits.
   Plan 006 consumed the generated relative module, compiled render contract,
   catalog/capability arguments and approved Sucrase/Acorn dependency split.
   Its loader uses the subsequently approved canonical-header rewrite and
   dot-escaped data URL, rather than Task 1's original bare-import spike alone
   (`plans/evidence/006-impact-analysis.md`). None — no further spec edit.

2. **Public API and formats.** `package.json` exports `/sdk` and both JSX
   runtime subpaths; `src/__tests__/exports.test.ts:93–140` pins runtime names
   and exercises public types. `generate` and compiled build facts remain
   internal. The root retains format/validator ownership; no SDK component or
   product catalog is published as a library feature. There is no wire-format
   change, version bump or release. None — existing Phase 6 archive exclusion
   and installed SDK/worker resolution gates remain necessary (**F7**).

3. **The four laws.** SDK execution stays on the backend; browser bundling
   proves absence of host APIs, not permission to execute widgets there.
   `src/sdk/render.ts:244–566` builds primitives and checks each node with
   shared structural/JSON checks; it does not revalidate the finished tree.
   `render_error_kinds`, `class_name_and_style_strings_rejected`,
   `errors_are_bounded` and independent tree acceptance cover closed data,
   raw CSS rejection and manifest/capability intent checks. Widgets receive
   frozen input values after **F1**. The SDK neither resolves data nor
   dispatches operations; isolation and authorization remain host duties.
   None — no new execution, colour or authority surface. **F2** must be
   addressed before hosts share resolved objects across schema contracts.

4. **Validation.** `src/validate/compile.ts` compiles params/state/context and
   a closed data schema from manifest source bindings and capability results.
   `render.ts:98–175` checks plain acyclic finite JSON, bounded nesting and
   input schemas before widget execution. `sdk-inputs.test.tsx` covers pointed
   input failures, check-once identity reuse, freezing and determinism.
   **F1** was reproduced with shallow-frozen state/data and a frozen array;
   descendants remained mutable until Task 9a. **F2** is independently
   reproduced: data accepted under one manifest is accepted by identity under
   a manifest with no sources, while a fresh clone fails `/data/status`,
   `/data/checked`, `/data/stale` and `/data/groups`. **F3** records nested
   non-JSON rejection-kind precision plus a composed-input gap: a component
   discarding `{ payload: { callback: () => 0 } }` renders successfully because
   only top-level component props are checked before expansion. Its emitted
   tree is valid, but the non-JSON prop restriction is not fully enforced.
   The cache and diagnostic limits were already disclosed in the SDK guide;
   this review also hands off the reproduced composed-prop gap.

5. **Styling.** Generated types restrict vocabulary names and responsive
   forms; compiled checks enforce ranges, track grammar and raw CSS rejection
   again at runtime. No recipes, theme authority or CSS implementation moved
   into `/sdk`. **F6** closes the stale QueueRow handoff: plan 007 Task 10 made
   proof and SDK flex composition identical, removed exporter substitutions
   and layout exceptions, and recorded parity under both design systems.
   Certified changed pixels remain 0.72% / 0.75% / 0.97% at 1440 / 1024 / 390 px.
   This review reuses that evidence; it does not claim a fresh capture.

6. **Interaction tiers.** `src/sdk/intents.ts:46–93` emits frozen setState
   and action data, including carried values and argument binding. Generated
   event types distinguish no-value events; compiled checks retain manifest
   state/action compatibility. Stable key paths, including keyed composed
   fragments, are tested in `sdk-render.test.tsx`. None — local DOM behavior,
   reconciliation, event-value insertion, state persistence and dispatch-time
   authorization remain Phase 4/host obligations. Existing preview handoffs
   retain session-only state and inert action logging; no dispatcher is added.

7. **Performance.** All eight SDK render workloads pass ≤3 µs/node and the
   required agent-home / medium–full queue ≤2 ms gates after **F1**. Agent-home
   is 1.2233 ms / 1.802 µs/node; small queue is 2.722 µs/node. No second
   validation walk was introduced. **F8:** the independent validator benchmark
   failed on two runs, with different failing workloads, on Bun 1.4.4 under
   concurrent load. Validator code and its benchmark are unchanged. Prior
   passing Bun 1.4.2 results remain historical evidence, not proof of today's
   gate. Reopen the existing P1 performance item; do not relax or retry away
   the failure. Full numbers and limits appear below.

8. **Portability.** `src/__tests__/portability.test.ts:13–31` bundles and scans
   all three SDK entrypoints; the source scan covers the host-free emitter.
   File I/O stays in the explicitly exempt Bun CLI. SDK code has no runtime
   dependency; plan 006's Sucrase and Acorn imports remain in `/pack`.
   None — no new host API or exemption. Bun 1.4.4 and browser-target bundles
   were checked here; installed archives and other runtime execution remain
   unproved. Preserve the existing release gates (**F7**).

9. **Agent authoring.** `src/sdk/gen.ts:47–149` emits readonly catalog-derived
   props, event/variant/vocabulary types and escaped descriptions.
   Generator tests cover deterministic output, collisions, escaping, malformed
   catalogs, CLI write/check exits and positive/negative TSX cases.
   `gen --check` passes against the committed fixture. Bounded errors include
   pointers and repair information. **F3** retains diagnostic precision work;
   numeric bounds and grid grammar intentionally remain runtime checks.
   None — no new authoring API or MCP behavior is required by Part A.

10. **Docs and examples.** `docs/sdk.md` covers generation, typed widgets,
    intents, every error kind, ids, input freezing, cache restrictions and
    host responsibility. `sdk_guide_example_matches_documentation_and_renders`
    exercises the full guide example with independent tree validation.
    README and execution-skill SDK/architecture references name the shipped
    surface. Historical task notes stay historical; **F6/F7** update current
    plan closure and the roadmap ledger. None — no guide API correction.

11. **Conformance.** Internal SDK tests cover all proof scenarios, complete
    exported-tree equality, node counts, stable ids, bounded errors, exact byte
    limits, schema-derived types and portability. **F4** extends the existing
    Phase 5 handoff with these SDK cases and their boundary to future renderer
    tests. It does not invent a public SDK suite: `/conformance` still targets
    catalogs, design systems, renderers and stores. SDK implementation budgets
    and private branding remain internal regression tests.

12. **Reference hosts.** All four ported widget families and scenarios still
    pass SDK and both-runner integration tests. No production app is migrated.
    **F5** records Synapta's positional ids and in-SDK generated module as
    adoption differences: use stable keys and app-relative generated source;
    package it through the ordinary linker. Clay uses its own primitive
    implementations/design system. Neither host's migration changes library
    composition, isolation or authority boundaries.

## Findings and dispositions

The findings table was presented during execution, followed by F8 when the
validator verification failed. The owner's request to complete Task 10 and
dispose of every finding authorizes this corrective work and handoffs. There
was no separate per-row answer; this record does not claim one. Later-phase
items stay in their existing phases; no architecture approval is inferred.

| ID | Finding | Areas | Disposition | Execution record |
| --- | --- | --- | --- | --- |
| F1 | Shallow-frozen input ancestors can retain mutable descendants. | 1, 3, 4 | execute | Added and completed Task 9a, test first; private weak identity tracking now proves deep traversal before skipping it. |
| F2 | Data identity cache skips validation across different schema contracts. | 3, 4 | backlog, P1 | Added “Scope SDK data validation caching to the source-schema contract”. Same-contract reuse and JSON value properties remain required today. |
| F3 | Nested primitive values have broader diagnostics; discarded nested composed values can escape rejection. | 1, 4, 9 | backlog, P2 | Added “Reject nested non-JSON composed props and improve SDK diagnostics”; no implementation expansion in this review. |
| F4 | Phase 5 handoff omits SDK-derived conformance cases. | 11 | backlog, P3 | Extended “Seed conformance suites from the proof tests” with SDK evidence and renderer integration boundaries. |
| F5 | Synapta migration differs in ids and generated-module placement. | 12 | backlog, P4 | Extended “Hand adopter gaps to Synapta and Clay”; no compatibility rewrite or positional-id mode. |
| F6 | Plan's Further Actions still describes QueueRow parity as pending Phase 3. | 5, 10 | execute | Linked the existing closed grid-track item and plan 007 evidence; removed the stale active action. |
| F7 | Plan closure needs current Part B/release-boundary evidence and ledger reconciliation. | 1, 2, 8, 10 | execute | Confirmed Part B plus its approved loader amendment; completed this evidence/plan and roadmap §3. Retained existing archive exclusion and installed-loader release gates. |
| F8 | Standalone validator ≤1.5 µs/node gate is not reproducible on today's two runs. | 7 | backlog, P1 | Reopened “Phase 1 performance gate: 3 µs per node” with both failures and a controlled Bun/load follow-up; SDK total gate remains delivered. |

All eight findings have a corrective execution record or a backlog owner. Plan
002's separate owner gate and later release gates remain open.

## Verification

- Regression first: `timeout 60s bun test src/__tests__/sdk-inputs.test.tsx`
  failed `shallow_frozen_inputs_are_deep_frozen` before the runtime correction.
- After correction, focused input/render tests: **14 pass, 0 fail**.
- `timeout 600s bun run check`: **375 pass, 0 fail, 109,966 assertions**,
  generation drift, both typechecks, lint and formatting pass. Existing
  non-fatal proof lint diagnostics remain.
- `timeout 60s bun src/cli/liveframe.ts gen src/__tests__/fixtures/proof/catalog.json --out src/__tests__/fixtures/widgets/ui.gen.ts --check`: exit 0.
- `timeout 300s bun bench/render.bench.ts`: exit 0, every total-render gate
  passes. Compilation/load/first data resolution excluded; 200 warm-ups and
  1,000 runs per implementation, selection/state changes included.

Machine: Bun **1.4.4**, Linux **7.2.7-1-cachyos**, AMD Ryzen 9 PRO 7940HS,
16 logical CPUs. Render load start **6.86 / 4.57 / 2.33**, end
**6.33 / 4.53 / 2.34**.

| Fixture | Mean nodes | Render ms | µs/node |
| --- | --- | --- | --- |
| agent-home | 679 | 1.2233 | 1.802 |
| core-queue.small | 5 | 0.0136 | 2.722 |
| core-queue.medium | 414 | 0.7983 | 1.928 |
| core-queue.large | 446 | 0.8900 | 1.995 |
| core-queue.full | 473 | 0.9537 | 2.016 |
| git-status | 145 | 0.2584 | 1.782 |
| rack-module | 236 | 0.3781 | 1.602 |
| synthetic-queue | 353 | 0.6257 | 1.773 |

The standalone validation split on emitted trees reaches 1.617 µs/node; it is
a comparison baseline, not an in-render profile. Agent-home's split is 1.428
validation / 0.373 estimated other µs/node. The independent validator script
has its own strict gate, checked below without changing inputs or thresholds.

`timeout 300s bun bench/validator.bench.ts`: **exit 1 on both runs**. Initial
load **4.18 / 4.26 / 2.36 → 5.17 / 4.48 / 2.45**; follow-up
**5.58 / 4.62 / 2.54 → 5.29 / 4.58 / 2.54**. The process list showed a busy
compiler and graph checks around the initial run, and a busy formatter around
the follow-up. Contention is plausible, not established as the sole cause;
Bun also differs from the historical 1.4.2 runs. No processes were stopped.

| Fixture | Initial µs/node | Follow-up µs/node |
| --- | --- | --- |
| agent-home | 1.451 | **1.513 (fail)** |
| core-queue.small | 1.159 | 1.173 |
| core-queue.medium | 1.447 | 1.197 |
| core-queue.large | **1.602 (fail)** | 1.309 |
| core-queue.full | **1.670 (fail)** | 1.384 |
| git-status | 1.107 | 0.859 |
| rack-module | 1.021 | 0.866 |
| synthetic-queue | 1.339 | 1.095 |

Agent-home equal-work props speedup remains **15.14× / 13.42×**, above 2×.
The full validator does more work than the generic props-only baseline; no
whole-validator speedup is claimed. F8 retains the unresolved gate explicitly.

F2's source-checkout probe rendered the first proof scenario with its original
validator, then with a validator whose manifest declared no sources. Reusing
the data produced `true / true`; cloning it for the second contract produced
`false` with the four `/data/...` pointers listed above. This checks the
documented restriction, not a new cache contract or a production migration.

F3's follow-up probe used `jsx(Component, { payload: { callback: () => 0 } })`
where `Component` returns a valid text primitive and ignores its argument.
`render()` returned success, confirming that emitted-tree validation alone
does not reject nested values discarded by composed code. This expanded F3's
handoff from diagnostic precision (P3) to input rejection (P2).

No published archive, other runtime execution, new parity capture, production
adoption or real hardware/assistive-technology audit was performed. Existing
plan 007 parity images remain local under `/evidence/`; regenerate them with
`timeout 600s bun proof/scripts/parity.ts --out evidence/parity`.

Final handoff verification: `timeout 600s bun run check` again passed all
**375 tests / 109,966 assertions**, generation drift, both typechecks, lint and
formatting after the guide/backlog/plan edits. Documentation assertions confirm
**12 areas, 8 findings**, all plan-to-backlog anchors and handoff sources;
`git diff --check` passes. The guide now discloses the composed-prop rejection
gap. Existing owner changes to Phase 4 contracts, skill references, the plan
index and unrelated roadmap/backlog sections are preserved and excluded from
the task commits. Plan 005 is closed with F2/F3/F4/F5/F8 explicitly backlogged;
completion does not claim the standalone validator gate passes.
