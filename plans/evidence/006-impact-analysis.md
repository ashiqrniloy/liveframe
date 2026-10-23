# Plan 006 — architectural impact analysis

Reviewed 2026-10-23 against delivered Tasks 1–11, roadmap Phase 2 Part B,
spec §2, §7.3–§7.5, §8, §10 and §13, and all twelve impact areas in
`.agents/skills/create-plan/references/liveframe.md` §5. Authority includes the
approved packages/reference-stores, preview/runners, package-errors/hash and
data-URL-loader decisions. This review changes no architecture or spec meaning.

## Impact areas

1. **Spec.** `src/pack/pack.ts:8–38` composes structure, installed manifest and
   scenario validation, inert linking and canonical hashing. `verifyPackage`
   (`src/pack/verify.ts:50–69`) repeats those checks and parses imports before
   comparing the hash. `src/store/load.ts:10–79` verifies stored documents,
   rejects identity/params failures and reports incompatible state resets.
   The runners follow §7.5's approved loading amendment. None — no normative
   change is required. The spec remains the target for unshipped preview and
   conformance work; the guide distinguishes what exists today. **F1** corrects
   execution metadata, not the design. **F2–F4** hand off the remaining phases.

2. **Public API and formats.** `package.json` exposes `/pack`, `/store`,
   `/store/fs`, `/preview` and `/preview/worker`, alongside the unchanged root
   and SDK entries. `exports.test.ts` fixes exact runtime surfaces and exercises
   public types. Package/scenario types belong to `/pack`; records and `Store`
   belong to `/store`. `widget-package.json`, `placement.json` and
   `style-record.json` are registered, published and covered by schema agreement
   and drift tests. `liveframe-package/1` retains its approved canonical hash;
   the package remains private at version 0.0.0. None — no export, version or
   format correction is needed. **F4** retains archive exclusion and installed
   subpath resolution as release gates.

3. **The four laws.** Packing, verification and loading remain inert, proved by
   `bundle_never_executes`, `pack_and_verify_never_execute` and
   `pack_store_and_reload_never_execute_widget_code`. Execution belongs on the
   backend. Both runners use SDK `render()` and the compiled validator; the
   worker reuses `inProcessRunner()` rather than building a second tree path.
   Proof-scenario parity, malformed inputs and SDK-limit tests cover law 2.
   No colours, raw CSS, primitive implementations or product catalogs enter
   the runtime library. Capabilities and scenarios grant no authority: runners
   neither dispatch actions nor resolve viewer data. None — no new law
   violation found. A browser-target bundle proves portability, not permission
   to execute widget code there. Reference runners are explicitly not sandboxes;
   **F2/F5** retain the preview/host obligations.

4. **Validation.** `validateWidgetPackageShape`
   (`src/formats/package.ts:63–97`) checks closed shapes, unique scenario names,
   1–64 scenarios and the UTF-8 code bound. Semantic checks compile existing
   schemas for params/context/state and capability-source results. Canonical
   hashing rejects non-JSON values and lone surrogates. AST import checks are
   shared by packing and verification. Store reads remain untrusted: loader
   errors cover missing records, package tampering, mismatched identities,
   corrupt JSON and invalid params. Missing state uses initial state without a
   reset; invalid state reports bounded errors without writing anything back.
   Malformed file JSON is an error, not a reset; unrelated I/O errors reject
   and must be handled by the host. Package/load failures are bounded to 20.
   None — these boundaries have named tests in package-format, pack, store-load,
   store-file and phase-2-loop tests. Stores intentionally persist without
   semantic validation; runners intentionally require prior verification.

5. **Styling.** Stores persist `StyleRecord` bodies as JSON and distinguish
   `(kind, id, version)`. Structural validation does not install a theme or
   design system. The guide requires existing install validators separately;
   active style selection stays with the host. None — no recipe, CSS projection,
   colour-authority or completeness behavior changed. Phase 3 and existing
   visual-parity backlog items keep their original scope.

6. **Interaction tiers.** Placement state is a separate host-owned record;
   deleting a placement deletes its state. Loading reports resets but leaves
   persistence decisions to the host. Runner parity preserves SDK intents as
   data and introduces no event dispatcher. None — no local primitive behavior,
   action execution or production rerun cache was added. **F2** records that
   Phase 4 sessions must keep `setState` local to the session and log actions
   without dispatch; the host remains responsible for production persistence,
   completed argument checks and authorization. Spec §8's full rerun-cache key
   includes package hash, catalogId and all inputs; module/validator caches
   are not that cache.

7. **Performance.** All new budget tests pass: hashing 1 MiB **12.61 ms**
   (<50), composed agent-home bundling **58.50 ms** (<100), verification
   **6.23 ms** (<20), warm in-process overhead **−0.0216 ms/render** (<0.1).
   The negative overhead is measurement noise, not a claimed speedup. Worker
   overhead is reported, not gated: **2.2354 ms/render**, direct 1.6208 versus
   worker 3.8562. The whole-plan render benchmark passes all eight total gates;
   the independent validator benchmark also passes all eight ≤1.5 µs/node gates
   and the equal-work ≥2× props gate. See measured tables below. None — no new
   optimization is justified. Worker pooling, cache eviction and storage
   throughput work are not introduced without a measured requirement.

8. **Portability.** `portability.test.ts` scans non-test sources and bundles
   the public `/pack`, `/store` and `/preview` entries for browsers. Filesystem
   host APIs stay in `/store/fs`, Worker/self in `/preview/worker`, and dynamic
   import only in `src/preview/load.ts:11–25`. The only syntax dependencies are
   pinned Sucrase 3.35.1 and Acorn 8.19.0, imported by `pack/bundle.ts` only;
   `/store` reaches them through verification. Bundle scans remove exact known
   dependency snippets and reject additional forbidden hits and CLI-only
   packages. The approved dot-escaped data URL and canonical SDK-header rewrite
   pass main-thread and Worker probes outside the repo on Bun 1.4.2. **F4**:
   these source-checkout results do not prove installed archive resolution or
   another runtime. No new portability exemption or loading fallback is adopted.

9. **Agent authoring.** Required scenarios, deterministic packages, file/line
   pointers, escaped JSON Pointers and typed failures support repair loops.
   Generated primitives bundle as ordinary relative modules; generation and
   its drift check are unchanged. Verification is inert and cannot prove a
   scenario renders, so both-runner scenario parity remains an explicit test.
   None — no additional authoring API is required here. **F2** carries the
   shipped contracts into Phase 4 preview and Phase 8 MCP work, with no tool
   authorized to install, approve, place or dispatch operations.

10. **Docs and examples.** `docs/packages.md` covers the complete install path,
    scenario/import rules, immutable versions/rollback, integrity versus trust,
    all Store methods, untrusted loads/reset reporting, limits and backend-only
    non-isolated execution. `package_guide_example_runs` executes its code block
    verbatim. README, SDK/formats guides and execution-skill architecture,
    storage and preview references describe the shipped APIs. **F1** fixes the
    stale roadmap ledger while retaining plan 005 Task 10 as open. None — no
    further guide or example correction was found.

11. **Conformance.** The internal `storeContract`
    (`src/__tests__/store-contract.ts`) already runs against both reference
    stores: hash conflicts/no-op, copy isolation, missing records/null, placement
    ordering, style tuple identity and state deletion. File tests add reopen,
    traversal/case-safe paths, atomic replacement and failure cleanup. Runner
    tests cover parity, serialization, configuration caching, clone failure,
    timeout/crash recovery and shutdown. **F3** extends the existing Phase 5
    handoff to start its published store suite from this shared contract;
    implementation-specific and load-integration tests remain distinct.
    No public `/conformance` export is claimed yet.

12. **Reference hosts.** All scenarios of all four ported proof widgets render
    equally through both runners. No source app is migrated by those tests.
    **F5** records that Synapta supplies isolation and tenant/approval policy;
    Clay fits the one-writing-process file store, with explicit reset/error
    handling. The file store guarantees atomic per-record replacement, not
    cross-record transactions, multiple writing processes or fsync durability.
    The linker snapshots bindings and rejects cycles; canonical header rewriting
    supports packer output, while non-canonical handwritten SDK imports may fail
    loading outside the installation. These approved/documented limits require
    no expansion here. No library behavior is bent to an adopter.

## Findings and dispositions

The owner requested completion of Task 12 and its plan update. The following
table was presented during execution. Maintenance and handoff dispositions use
that authorization; the owner did not separately approve each row. No new
architecture decision or decision log is implied. The backlog rows below retain
work in the phases already assigned by the spec, roadmap and approved decisions.

| ID | Finding | Areas | Disposition | Execution record |
| --- | --- | --- | --- | --- |
| F1 | Roadmap calls the delivered SDK planned and Part B only Task 1 complete. | 1, 10 | execute | Added and executed Task 11a; reconciled §3 while preserving owner edits and plan 005's open impact task. Task 12 closes only plan 006. |
| F2 | Preview/MCP planning needs the shipped package/runner contracts and inert action semantics. | 3, 6, 9 | backlog, P2 | Added “Build preview sessions on the shipped package and runner contracts” for Phase 4 Part B/Phase 8. |
| F3 | Existing conformance handoff omits the shared store contract and load cases. | 4, 11 | backlog, P3 | Extended “Seed conformance suites from the proof tests” with plan 006 as a source and both-store acceptance conditions. |
| F4 | Checkout loading does not prove installed SDK/worker resolution, and the archive still includes tests. | 2, 8 | backlog, P1 loader gate / P2 existing archive exclusion | Added “Verify installed-package loader and worker entry before release”; linked and extended the existing fixture-exclusion entry. Reopen Task 8.5 only on the approved revisit conditions. |
| F5 | Adopter handoff needs sandbox responsibility and file-store operational limits. | 3, 12 | backlog, P4 | Extended “Hand adopter gaps to Synapta and Clay”; no host migration, sandbox or new storage backend added. |

All five findings are disposed through Task 11a, the final ledger update and
`plans/backlog.md`. The plan's Compromises Made records accepted current limits;
Further Actions links each later-phase handoff. Plan 005 Task 10 and plan 002
Task 9 remain open.

## Verification

- `timeout 600s bun run check`: passed generation drift, typecheck, lint, format
  and **322 tests across 54 files**, zero failures. Existing non-fatal proof lint
  warnings remain. This includes schema publication drift, exact exports,
  host-free bundles, hash vectors, all package/store/runner budgets and parity.
  Repeated after the documentation/backlog edits: **322 pass**, zero failures.
- `timeout 120s bun test src/__tests__/phase-2-loop.test.ts`: **14 pass**, zero
  failures, including the guide example, reopen persistence, typed rejections,
  inert installation and worker timeout/recovery.
- `timeout 60s bun pm ls --all`: installed Acorn **8.19.0** and Sucrase
  **3.35.1**, matching the exact manifest pins. No dependency changed.
- `timeout 30s bun plans/evidence/006-task-8-loader-gate.ts`: all four probes
  print `defaultType: "function"`: property access, linked agent-home,
  outside-main agent-home and outside-worker agent-home.
- `timeout 300s bun bench/render.bench.ts`: all eight total render gates pass.
  Machine: Bun 1.4.2, Linux 7.2.7-1-cachyos, AMD Ryzen 9 PRO 7940HS, 16 logical
  CPUs. Load start **1.56/1.26/1.10**, end **1.62/1.28/1.11**. 200 warm-ups,
  1,000 runs; compile/load and initial data resolution excluded. Selection/state
  changes included.

| Fixture | Mean nodes | Render ms | µs/node |
| --- | --- | --- | --- |
| agent-home | 679 | 1.3108 | 1.930 |
| core-queue.small | 5 | 0.0147 | 2.935 |
| core-queue.medium | 414 | 0.8332 | 2.013 |
| core-queue.large | 446 | 0.9588 | 2.150 |
| core-queue.full | 473 | 0.9613 | 2.032 |
| git-status | 145 | 0.2786 | 1.922 |
| rack-module | 236 | 0.4011 | 1.700 |
| synthetic-queue | 353 | 0.6337 | 1.795 |

The render script's separate validation split ranged up to 1.688 µs/node;
it is not the independent validator gate or an in-render profile. Checked the
existing validator gate separately to resolve that measurement concern:
`timeout 120s bun bench/validator.bench.ts` passed every ≤1.5 µs/node gate and
equal-work props speedup ≥2×. Same machine; load start **1.26/1.24/1.10**, end
**1.32/1.25/1.10**; 200 warm-ups, 1,000 runs, compilation excluded.

| Fixture | Validation ms | µs/node | Equal-work props speedup |
| --- | --- | --- | --- |
| agent-home | 0.8137 | 1.198 | 12.91× |
| core-queue.small | 0.0056 | 1.119 | 11.01× |
| core-queue.medium | 0.4995 | 1.207 | 13.59× |
| core-queue.large | 0.5607 | 1.257 | 13.37× |
| core-queue.full | 0.6158 | 1.302 | 12.40× |
| git-status | 0.1342 | 0.925 | 13.83× |
| rack-module | 0.2118 | 0.897 | 10.70× |
| synthetic-queue | 0.3663 | 1.038 | 12.51× |

Timings are local and load-sensitive. The full validator does more work than
generic props-only interpretation; only the equal-work props comparison claims
a speedup. No published package, other runtime, visual parity capture or
production host adoption was checked. No image evidence or new runtime tests
are needed for these documentation and backlog changes.

Final documentation assertions confirm twelve impact areas, five finding rows,
all four backlog handoffs and valid backlog heading links. `git diff --check`
passes. Existing owner edits to the plan index and roadmap additions remain in
the working tree; task commits stage only their own ledger corrections.
