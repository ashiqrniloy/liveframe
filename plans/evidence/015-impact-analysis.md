# Plan 015 — architectural impact analysis

Reviewed 2026-10-28 against delivered Tasks 1–8 (`b61b0a9`…`c148195`),
spec §2, §5–§11 and §13, the accepted
[event/metadata/scope decisions](../../decision-logs/2026-10-28-0024-events-manifests-and-state-scope.md),
and all twelve areas in `.agents/skills/create-plan/references/liveframe.md` §5.

## Impact areas

1. **Spec.** §5 lists the new semantics and numeric/object carries; §6.3 lists
   the height bounds; §7.3 describes manifest annotations; §7.4 describes scoped
   state and explicit inputs; §8–§11 describe binding, pruning and emit checks.
   Structural fit compares names, required fields, scalar types and nullability,
   allows integer → number, and leaves value bounds to completed-value checks.
   This matches `src/validate/intent.ts:12–61`. No additional normative decision
   is needed. “Never reads meta” means never interprets its contents: validation,
   hashing, transport and explicit MCP exposure necessarily inspect/copy it.

2. **Public API and formats.** Root adds `capabilitiesFor`; `/store` adds
   `verifyPlacementInputs` and requires scopes on state methods. `loadPlacement`
   accepts a fourth `{ scope?, state? }` argument. No subpath or dependency was
   added. Manifest/capability annotations, carries and `bindAll` are reflected in
   their published schemas and TS types; schema-agreement and export tests pin
   the surface. `/1` format identifiers remain unchanged for these additions.
   The accepted Store interface break is documented in `docs/compatibility.md`;
   package metadata remains at 0.1.0; plan 020 owns the 0.2.0 release.

3. **The four laws.** Law 1: no widget execution moved into the browser. Law 2:
   catalog installation rejects malformed carries; renderer emit checks payloads;
   Preview re-checks completed values; loading verifies packages and state.
   Law 3: height bounds use the existing dimension domain, with no colour/CSS
   escape. Law 4: annotations, pruned capability descriptions and scope strings
   grant nothing. Hosts still choose the scope and authorise reads/actions.
   `graft grep "meta"` found format checking, type/schema declarations, MCP
   filtering/opt-in exposure, tests and unrelated style names/`import.meta`.
   No library behaviour selects permissions, dispatch, styling or state scope
   from host metadata. Whole-manifest hashing and capability selection preserve
   annotations without interpreting them.

4. **Validation.** Object carries are closed, non-nullable at the top level,
   limited to 32 scalar properties, and use bounded strings. `bind`/`bindAll`
   conflict, literal/event overlap, wrong scalar types and nullability mismatch
   fail at build time. Emit rejects malformed objects and non-finite numbers;
   integer emit also rejects fractions. Metadata uses one depth/byte walk in
   `src/formats/capabilities.ts:143–170`, shared by both manifest validators and
   capabilities. Scope rejects non-strings and >128 code points with a typed
   `/scope` error before loader reads (`src/store/scope.ts:4–9`). Explicit state
   follows the same JSON/schema checks and reported reset as stored state
   (`src/store/load.ts:11–31,34–99`). `capabilitiesFor` assumes installed inputs,
   rejects unknown own names, and returns no partial result. Tests cover each
   rejection, escaped pointers and bounded errors. No new validation gap found.

5. **Styling.** `minHeight`/`maxHeight` use the same responsive dimension domain
   as width bounds and project to `min-height`/`max-height`, matching `height`.
   Only declared kinds accept them. Validator, SDK generation, projection and
   scrolling-browser tests cover the addition. Percentage height resolution is
   documented in `docs/styling.md`. No theme role, recipe or primitive component
   was added; plan 016 retains ownership of the approved styling work.

6. **Interaction tiers.** Local editing remains app-owned. Implicit `setState`
   accepts compatible numeric/object events and replaces the whole object key.
   Actions complete scalar bindings or merge `bindAll`, removing binding fields
   and cloning before freezing (`src/react/renderer.tsx:64–90`). Native-submit
   coverage proves the current text and checkbox values arrive together; emit
   tests prove local payloads remain editable and invalid values raise nothing.
   Preview checks the completed target bounds. Plan 017's offered-intent check
   is an existing handoff, detailed below; host authorisation remains required.

7. **Performance.** Object event checks compile once per definition event in
   `createRenderer`; structural comparison occurs while building/checking an
   intent, with at most 32 event properties. Capability pruning is linear in
   input capabilities plus manifest names, preserves input order, and does not
   change `compileValidator`. Scope adds no state read; an own explicit `state`
   skips it. Whole-plan measurements and any existing performance carry-over
   are recorded below. No timing threshold is changed by this audit.

8. **Portability.** New format, SDK and loader logic stays in host-API-free
   modules. File operations remain in `/store/fs`; React/DOM behaviour remains
   in `/react` and app/test primitives. Source/compiled portability and browser
   bundle tests cover the boundaries; installed consumers are checked by the
   archive gate. No runtime dependency was added. Alternative-engine evidence
   and native Windows/AT audits remain their existing plan 019/020 obligations.

9. **Agent authoring.** Generated types include semantics, height dimensions,
   numeric/object emits and `bindAll`; no-value events exclude `bindAll`.
   Type-level tests reject incorrect props/payloads and incompatible bindings.
   Generated fixture checks remain binding. MCP exposes manifest description,
   hides capability/manifest `meta` by default and supports explicit
   `AuthoringConfig.exposeMeta`; `cli-mcp.test.ts` covers both paths. Metadata
   is not an instruction or authority channel interpreted by the library.

10. **Docs and examples.** Format, SDK, renderer, styling, package, MCP,
    security, compatibility and conformance guides describe the delivered
    surfaces. The demo uses explicit shared scope and passes its packaged
    verification. The legacy fixture generator is
    `bun scripts/fixtures/store-0.1.0.ts`; its committed v0.1.0 package, placement,
    state and style prove compatibility without rewriting the directory.
    Plan 020 Task 3 already owns the consolidated 0.2.0 changelog, migration
    guide and adopter notes. No new documentation follow-up is required here.

11. **Conformance.** `storeSuite` now checks isolated scopes, invalid-scope
    rejection, deletion of every scope and persistence after reopen
    (`src/conformance/store.ts:20–346`). Broken-adapter tests prove the cases
    detect leaks/incomplete deletion. Both reference stores run the suite.
    Catalog-independent renderer cases are exercised with numeric, object-form
    and semantics fixtures; internal emit/fit/type details stay in library tests.
    Plan 019 Task 4 owns the language-neutral corpus after formats settle; it
    must carry numeric/object-carry and `bindAll` successes/failures, metadata
    semantic bounds and scoped-state contract coverage where applicable.

12. **Reference hosts.** LF-05 A, LF-06, LF-07, LF-09, LF-14, CL-07 and CL-08
    have checkout evidence in Tasks 2–8. This establishes library support, not
    production adoption by Synapta/Clay. The proof's generic layout mappings
    keep live regions mounted; apps own accessible form labels and table
    primitives. The demo need not expand its catalog until a widget uses the
    new semantics. Native AT behaviour remains the existing G29 audit, and
    adopter migrations remain in their repositories. No product component or
    authority was added to close an adopter-specific gap.

## Findings and disposition

| ID | Finding and evidence | Recommended disposition | Recorded outcome |
| --- | --- | --- | --- |
| F1 | Render's separate validation measurements exceed the reserved 1.5 µs/node on agent-home and medium/large/full queues (1.505/1.616/1.622/1.776). The independent validator gate and total render gates pass. This diagnostic subtraction is not an in-render profile. | backlog — retain the existing P1 performance investigation; add these measurements without relaxing any threshold. | Existing owner-approved P1 disposition retained (2026-10-25, recorded in `plans/backlog.md`); current evidence and Plan 015 source added to that entry. No new deferral or timing exception requested. |

No other new architectural finding requires execution or deferral. The table
was presented to the owner during Task 9. F1 retains an already approved
disposition; the integration work below retains its accepted 0.2.0 plan owners
from the [release-scope decision](../../decision-logs/2026-10-27-2028-release-0-2-0-scope-and-breaking-changes.md).
This audit does not claim production adoption, native AT verification, or closure
of the existing performance investigation from one passing benchmark run.

## Existing handoffs

- **Plan 017 Tasks 1–2 (`checkOffered`).** Use the accepted structural-fit rule
  for numeric/object carries, integer → number, nullable scalar properties,
  implicit object `setState` and `bindAll`. Completed actions omit `bind` and
  `bindAll`; compare literal arguments exactly, reject literal/event overlap or
  extra payload keys, and check both the event payload and completed target
  schema, including narrower bounds. Check origin/revision/node/event before
  dispatch. Reuse completion logic when extracting it from `/react`; do not
  infer that emit-time checking replaces host checking. Existing proof dispatch
  only implements scalar binding and must use the new shared check when that
  scheduled integration lands.
- **Plan 019 Task 4.** Include the additions above in the checked-in corpus;
  published JSON Schemas alone do not enforce metadata depth/byte limits or all
  event/schema relationships.
- **Plan 020 Tasks 1 and 3.** Preserve G29/native accessibility audit ownership,
  aggregate the new surfaces in release/adopter notes, and show Store migration
  with explicit shared/named scopes and fail-closed custom adapters. Existing
  0.1.0 files remain readable; rolling back cannot read new named scopes.

## Verification and measurements

Commands ran sequentially on Bun 1.4.4, Linux 7.3.0-4-cachyos,
AMD Ryzen 9 PRO 7940HS (16 logical CPUs). Benchmark load averaged
4.76/9.20/6.08 (1/5/15 minutes) initially and 3.90/8.64/5.97 after render.
No evidence images were produced. Complete benchmark output is in
[`015-task-9/bench.log`](015-task-9/bench.log), regenerated with
`timeout 180s bun run bench`.

- `timeout 600s bun run check`: **passed**, build, generation, typecheck, lint,
  format check and 724 tests (720 pass, 4 skip, 0 fail; tests took 278.95 s).
- `timeout 180s bun run bench`: **passed**, all validator/render gates and CSS
  measurements. No retries or changed thresholds.
- `timeout 300s bun run release:gate`: **passed**, all 8 installed-archive steps
  in 6.4 s: pack/store/reload/both runners, worker timeout/recovery, generation,
  MCP stdio, browser bundle, strict consumer types and existing Node probes.
  The existing `/preview` Node-probe backlog item remains open.
- `timeout 180s bun run demo:test`: **passed**, 51 tests across 7 files,
  0 failures (31.11 s), through the packaged demo host.

| Workload | Standalone validation (µs/node) | Render (µs/node) | Render (ms/tree) |
| --- | --- | --- | --- |
| agent-home | 1.253 | 1.934 | 1.3131 |
| core-queue.small | 1.227 | 2.091 | 0.0105 |
| core-queue.medium | 1.237 | 2.145 | 0.8880 |
| core-queue.large | 1.359 | 2.010 | 0.8966 |
| core-queue.full | 1.366 | 2.346 | 1.1097 |
| git-status | 0.864 | 1.951 | 0.2829 |
| rack-module | 0.895 | 1.581 | 0.3731 |
| synthetic-queue | 1.117 | 1.759 | 0.6209 |

Agent-home equal-work compiled props checking was 20.37× faster than
`checkValue`; this is a props-only comparison, not a full-validation speedup.
The mixed tagged feed took 0.0377 ms for 500 elements (0.075 µs/element).
CSS declarations took 0.369 µs/node (0.250 ms/679-node tree); base,
Certified theme/system and Rack theme/system sheets took
0.416/0.937/9.773/0.990/15.032 ms respectively. Every standalone validator
fixture remained ≤1.5 µs/node, every render fixture ≤3 µs/node and all required
large-tree renders ≤2 ms. F1 preserves the distinction between these enforced
gates and the separate diagnostic validation reservation.
