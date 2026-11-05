# Plan 026 architectural impact analysis

Reviewed 2026-11-05 against `5c7204c` (Tasks 1–9), followed by Task 9a's documentation corrections. Covers all twelve areas in `.agents/skills/create-plan/references/liveframe.md` §5. This closes the scope/spec/breaking-change batch, not the 0.3.0 release or plans 027–032.

Method: read the complete plan, its four evidence records, Phase 7 and execution ledger, the approved scope, prior impact dispositions and existing backlog; compare changes since `v0.2.3`; trace package ownership, input copies, session limits, content-keyed verification, structural compilation and runner options through graft. Review the migration/register and normative contracts against those implementations and their regression tests. Existing edits to `plans/README.md` and `roadmap.md`, and untracked plans 027–032, predate this task; preserve them.

## 1. Spec

The Task 2 preservation map accounts for all 1,268 baseline units, all section anchors, examples and four laws. Later tasks intentionally change §6.3 (dimension fractions), §7.2/§7.3 (ownership), §7.4 (verification cache), §7.5/§13 (session limits), §10 (realm diagnostics) and §11 (default focus recovery), with migration/register/changelog coverage. Task 9 changes the source of structural checks without changing the public widget schema language or normative format meaning.

Task 2's package-immutability ambiguity is resolved by Task 3. Its remaining runner ambiguity was real: `docs/spec.md:838` asked for `maxErrors` absent from `src/preview/runner.ts:9-16`. F3 corrects that prose to the existing contract; `/runner-kit`'s independent `RenderModuleOptions.maxErrors` (`src/runner-kit/render.ts:13-21`) remains supported. F4 corrects stale hash-cache prose in §7.5 and the package guide. No new API is chosen by this review.

## 2. Public API and formats

The 0.2.3 baseline and 0.3.0 register cover added `verifiedPackages`, widened `loadPlacement`/session options, and behavior-only breaks backed by named tests. The API test is `src/__tests__/api-stability.test.ts:43`; the schema-byte guard is `src/__tests__/schemas.test.ts:212`. Stale declaration entries remain rejected unless they carry explicit behavior evidence; migration headings remain mandatory for breaks.

The complete schema/corpus diff from `v0.2.3` is exactly `schemas/ui-tree.json` and the dimension-fraction corpus case/document. All three have register entries. No hash/patch vector, format id, package version, dependency or subpath changes in this review. Task 9's internal transport compiler is not an expansion of the public schema language.

## 3. The four laws

1. **Widget code never runs in the browser.** No widget-execution path moves. Reference runners remain backend mechanisms, explicitly not isolation boundaries. Hostile-code isolation is existing plan 031 work.
2. **The UI tree is validated data.** Owned frozen package copies (`src/pack/verify.ts:51-70`) prevent post-verification mutation. Mutable runner packages are rehashed (`src/preview/cache.ts:15-24`). Cache hits freshly hash stored content and include canonical installation documents (`src/store/verified.ts:31-53`); placement identity, params and state remain checked (`src/store/load.ts:35-100`). Sessions validate runner trees on the host with the same owned limits (`src/preview/session.ts:15-85`). Structural formats share the publisher's definitions, with relationship checks retained separately.
3. **Widget code never sets colours or raw CSS.** No new style escape, recipe authority or primitive implementation. Removing dimension fractions tightens an existing domain while preserving theme tokens and grid fractions.
4. **A widget never holds authority.** No new widget hook, action dispatch or ambient capability. Focus recovery emits no intent; host-owned verification-cache writes remain trusted host operations, never widget operations. Intent completion, offered-event checks and host authorization remain required.

No new law bypass was identified in this review; this is a targeted architectural review, not a fresh whole-repository security audit.

## 4. Validation

The foreign-realm entry-point matrix (`src/__tests__/validator-bundle.test.ts:34`) covers root validators and the actual VM bundle; pack/store/runner checks remain separate. Same-realm, null-prototype, nested foreign objects and foreign accessors retain explicit coverage. `checkInputs` (`src/sdk/render.ts:357-377`) copies during the existing JSON walk and reuses only deeply frozen values checked under the same schema.

Session limits are positive safe integers with unknown fields rejected at `/limits`; tests cover malicious runner nodes/depth/bytes and snapshots (`src/__tests__/session-limits.test.ts:48,76,105`). The private transport compiler uses closures and offline references (`src/validate/format-schema.ts:60-108`), rejects unsupported keywords, and keeps install relationships separate. The direct structural differential guard supplements, rather than replaces, corpus and diagnostic coverage.

## 5. Styling

All six dimension properties reject fractions across runtime validation, SDK generation, CSS projection and the published tree schema (`src/__tests__/dimension-fraction.test.ts:46`). Grid tracks and tokens ending in `fr` remain valid. Patch transport stays shape-only and application validates the resulting tree. No recipe, colour role, style dependency or visual component is added. Existing completeness, contrast and CSS checks remain applicable.

## 6. Interaction tiers

No new local, `setState` or action contract. Default focus recovery (`src/react/renderer.tsx:414`) restores focus after a disappearing node; explicit `false` preserves the previous behavior. Browser coverage retains successor/predecessor/wrapper/outside-focus/portal paths and asserts no intent emission. Preview limits apply to intent rerenders and authoring outcome expansion; host authorization remains unchanged. Local bindings and action outcomes belong to plan 029, not this plan.

## 7. Performance

One sequential `bun run bench` invocation was made, without concurrent checks or benchmark retries. It exited 1 at `core-queue.full`: **1.509 µs/node against 1.5**. The script's `&&` chain consequently did not run render, CSS or streaming benchmarks (`package.json:150`). This is not a whole-suite pass or quiet-host proof (F2).

Machine: Bun 1.4.4, Linux 7.3.0-4-cachyos, AMD Ryzen 9 PRO 7940HS, 16 logical CPUs. Local start/end: 2026-11-05 21:42:33–21:42:45 +06:00. Load averages (1/5/15 minutes): **4.02 / 4.39 / 4.91 before**, **4.01 / 4.37 / 4.90 after**. Regenerate with:

```sh
date -Is
cat /proc/loadavg
timeout 900s bun run bench
cat /proc/loadavg
date -Is
```

| Validator metric | Observed |
| --- | --- |
| agent-home | 1.398 µs/node |
| core-queue.small / medium / large / full | 1.304 / 1.374 / 1.495 / 1.509 µs/node |
| git-status / rack-module / synthetic-queue | 1.211 / 0.962 / 1.199 µs/node |
| agent-home equal-work props speedup | 26.05× |
| applyPatch / diffTrees | 0.1062 / 0.5011 ms |
| reused / first compilation | 0.1407 / 0.6273 ms |

Retain the task-specific evidence without upgrading its claims: Task 3's frozen-host-input render comparison is 1.0134, not a promise for mutable resolved data; Task 5's accepted-tree ratio is 1.0158, with nonzero install scans. Task 7 proves 100× fewer full verifications, not fewer hashes or lower elapsed time (the small cached fixture was slower). Task 8 records 0.6 ms added over 50 arrivals and production/development arrivals within 8 ms. Task 9's nine-pair whole-tree/patch/diff/compilation/install comparisons pass their relative gates; isolated interpreted/props reference metrics reach 1.085/1.037. Those reference paths are not shipping whole-tree acceptance targets; the variance does not establish a regression in the budgeted paths, nor prove every submetric within 2%.

F2 retains the existing quiet-host follow-up and records this variance for the release gate. No threshold, fixture, benchmark script or performance claim is changed by Task 10.

## 8. Portability

No new host API, dependency, browser widget execution or generated-function compiler. The transport compiler and caches remain internal host-API-free modules. Existing source/compiled portability and validator/runner bundle checks cover them. Development/release execution stays Bun-only; Node archive checks remain portability probes under the approved scope. This review does not independently repeat installed-archive or cross-runtime checks; plan 032 owns release artifacts.

## 9. Agent authoring

Generated dimension types, demo/SDK fixtures and MCP snapshots were updated with Task 4. Realm errors instruct agents to parse JSON in the receiving realm. Configured limits reach preview, authoring, outcomes and MCP; response/capture limits remain independent. The generated public widget schema language does not acquire transport-only keywords. No new authoring operation or runner option is needed for F3.

## 10. Docs and examples

SDK, packages, styling, preview, renderer, security and MCP guides describe the implemented changes; the 0.3 migration guide has before/after examples and adopter actions. Task 9 documents structural-versus-relationship ownership. F1 closes five stale backlog entries whose implementations and evidence already exist. F3/F4 correct actual contract prose, leaving Task 2's historical preservation record intact. Existing request-time demo orchestration remains planned in 030 T5; nothing here claims that feature shipped.

## 11. Conformance

The rejected dimension-fraction corpus case is the only added language-neutral case, and published schema/corpus changes are registered. Existing renderer server expectations now include default focus wrapper behavior; browser tests retain explicit opt-out behavior. Shared format differential/corpus, generated-type, session-limit, integrity and law tests cover the remaining surfaces. Public runner conformance remains the approved 031 T3 scope; this plan does not claim it already exists or require it to close documentation work.

## 12. Reference hosts

Clay's foreign-realm diagnostic gap is closed in the checkout, with receiving-realm parsing still required. Larger preview/authoring trees can use configured limits on both sides of the runner boundary. Hosts retain ownership of render inputs, must copy frozen packages before editing, can opt into bounded package-verification reuse, and can opt out of default focus recovery when they own it. No Synapta/Clay-specific primitive or exception is added. Installed 0.3.0 adoption, hostile-code isolation, request-time orchestration, quiet-host proof and dist-tag repair remain later approved work; no external host or registry was modified.

## Findings and dispositions

The scope decision already authorizes the implemented 0.3.0 items and carries quiet-host proof into plan 032. The existing release exception explicitly leaves that proof open. Presented the recommended dispositions to the owner during this task. The owner answered **“Execute the Runner.maxErrors correction now”**, replacing the proposed F3 backlog disposition with execution. Routine F1 bookkeeping and F4 documentation sync complete the requested impact task without a new architectural decision.

| Finding | Recommended disposition | Final disposition and evidence |
| --- | --- | --- |
| F1 — Five implemented items still appear open in the backlog (`plans/backlog.md:518,544,580,590,600`) | Execute bookkeeping | Closed the realm, session-limit, package/input ownership, dimension-fraction and verified-package-cache entries with Task 3–7 references. R24 was already closed by Task 9. Original request text remains historical. |
| F2 — Absolute whole-suite proof remains missing; isolated Task 9 reference variance exceeds 2% (`package.json:150`, `plans/evidence/026-format-sources.md:70`) | Retain existing backlog, P3 | Updated “Re-run the full benchmark suite on a quiet host” (`plans/backlog.md:505`), pointing to this run and the Task 9 A/B report; carry into 032 T3 under the approved scope/previous owner exception. No new deferral or relaxed gate. |
| F3 — Spec asks runners to forward an absent `maxErrors` option | Backlog proposed; owner selected execute | Task 9a aligns `docs/spec.md:838` with `src/preview/runner.ts:9-16` and `docs/packages.md:361`; `src/runner-kit/render.ts:13-21` keeps its separate option. Owner: “Execute the Runner.maxErrors correction now”. No API widening. |
| F4 — Once-per-object hash prose omits mutable-package rechecks | Execute documentation sync | Task 9a corrects `docs/spec.md` §7.5 and `docs/packages.md` § Runner limits and ownership to match `src/preview/cache.ts:15-24` and Task 3's approved frozen-package rule. No runtime change. |

All findings have an execution or existing-backlog destination. The draft-directory handle race, broader host pipeline, runner isolation/conformance and registry tag repair retain their existing entries/plans; no duplicate follow-up is created.

## Verification

- Final clean `timeout 900s bun run check` passed build, generated-file/API/schema gates, typecheck, warnings-as-errors lint, formatting and **1,107 tests, four existing skips, zero failures**, 171,104 assertions across 124 files (339.66 seconds of tests). Local 21:51:51–21:57:33 +06:00; load before 6.34 / 10.41 / 7.84, after 4.41 / 5.71 / 6.45. This is not quiet-host proof. An earlier accidental broad-test invocation overlapped a check and produced browser failures; both were stopped before this fresh run. No assertion, deadline or threshold changed.
- Focused spec structure, document links/wording and runner integrity checks: 19 pass, zero failures. No new test is needed for the prose corrections. Task 9a committed as `61734cd`.
- Schema/corpus/vector diff: exactly the three registered dimension-fraction files described above.
- API baseline comparison: covered by the final full check's `baseline_0_2_3_matches_the_checkout_through_the_0_3_0_register` test.
- Benchmark: one invocation, exit 1, load and results above. No retries; later stages were not reached.
- No release, publish, installed-archive rebuild, external-host adoption test or manual platform accessibility audit was performed.
