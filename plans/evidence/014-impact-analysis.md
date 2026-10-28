# Plan 014 — architectural impact analysis

Reviewed 2026-10-28, verification completed 2026-10-29, against delivered
Tasks 1–7 (`4574639`…`ec088e0`),
spec §2, §5, §7.3 and §13, the accepted
[0.2.0 scope](../../decision-logs/2026-10-27-2028-release-0-2-0-scope-and-breaking-changes.md),
and all twelve impact areas in
`.agents/skills/create-plan/references/liveframe.md` §5.

## Impact areas

1. **Spec.** §5 describes minimum bounds, nullable forms, closed tagged unions,
   tag limits, errors and compatibility classification; §7.3 describes the
   optional outcome helpers and their concrete arguments. These match
   `src/schema.ts:3–113,161–223`, `src/validate/schema.ts:84–181` and
   `src/pack/outcome.ts:9–60`. No further normative change is required.

2. **Public API and formats.** Root exports add `union` and `sourceOutcome`;
   `/pack` adds `outcomeScenarios`. No subpath or runtime dependency was added.
   `LanguageSchema`, `Infer`, builders, generation, catalog comparison and the
   four published meta-schemas grew together. All format identifiers remain
   `/1`: omitted minimums mean zero and omitted nullable means false, preserving
   old documents. Meta-schemas validate schema structure; install validation owns
   minimum ≤ maximum and dynamic tag-property exclusion. The tests' equivalent
   value schemas are oracles, not a new public conversion API. The publish
   manifest strips source conditions recursively while checkout exports retain
   them (`scripts/release/publish-manifest.ts:9–62`); archive tests reject missing
   nested and wildcard targets before installation. No additional break or
   migration was found beyond the accepted register for later plans.

3. **The four laws.** Law 1: no widget execution or loading was added to the
   browser; existing browser-bundle and installed-archive checks remain. Law 2:
   malformed schemas, unknown tags and invalid outcome seeds fail closed; pack
   still checks complete scenarios. Law 3: no colour, CSS or recipe escape was
   introduced. Law 4: envelopes describe host-resolved outcomes; helpers neither
   resolve data nor dispatch actions. Manifest pattern rejection traverses union
   mappings (`src/formats/manifest.ts:89–106`), with a regression for the escaped
   keyword pointer and the published manifest schema. Nullable does not bypass
   install-time rejection of a pattern.

4. **Validation.** Both checkers enforce code-point minima, array minima and
   nullability, select only the tagged branch and retain closed-object checking
   and bounded error sinks. Install rejects cyclic/malformed mappings, nullable
   branches, tag declarations and out-of-range bounds. `outcomeScenarios` checks
   the declared alias, capability, serialized envelope shape, seed payload and
   generated names, returning existing typed errors. Covered by
   `compiled_and_interpreted_agree_on_minimums`,
   `nullable_accepts_null_only_when_declared`,
   `union_rejects_malformed_mapping`, `union_unknown_tag_fails_at_tag_pointer`,
   `union_checks_only_selected_entry` and the four outcome tests. No missing
   validation obligation was found in this plan's additions.

5. **Styling.** None — no theme roles, recipes, primitive implementations or CSS
   projection changed. Schema annotations grant no styling authority. Existing
   projection, completeness and browser switch checks remain applicable; plan
   016 owns the approved styling additions.

6. **Interaction tiers.** No tier changed. Union-shaped state/action values are
   checked explicitly and recognized as objects for binding compatibility
   (`src/validate/intent.ts:12–29`); implicit scalar events cannot supply a union.
   `union_state_and_action_arguments_require_explicit_valid_values` and
   `source_bindings_treat_union_values_as_objects` cover the affected consumers.
   Object-carrying events remain plan 015's approved work.

7. **Performance.** F1 retains the existing P1 performance investigation; see
   measurements below. Algorithm review found no new super-linear value check:
   `codePointsWithin` makes one bounded code-point pass (`src/schema.ts:138–144`),
   array minima add a length comparison, nullable adds a null short circuit,
   and compiled tagged unions use a prebuilt Map followed by one object branch.
   Mapping size is capped at 64. Schema compilation/installation is outside the
   timed validation loop. No timing threshold was changed.

8. **Portability.** New runtime logic uses ordinary JavaScript in the existing
   host-API-free root and `/pack`; filesystem staging remains in release scripts.
   `src_is_host_api_free`, `compiled_output_is_host_api_free` and browser bundling
   checks cover the additions. The archive gate checks installed consumers.
   Real publication/OIDC issuance was not repeated. The existing `/preview`
   Node-probe omission, alternative-engine verification and G29 hardware work
   remain their recorded follow-ups, rather than new findings from this plan.

9. **Agent authoring.** Generated nullable/tagged props, readonly inference and
   narrowing are covered by typechecks and generated-output tests. Errors retain
   pointers and expected tag sets. No MCP tool changed. Plan 018 Task 4 already
   requires opt-in outcome expansion: its implementation must pass the source
   alias, manifest and capabilities to the delivered helper, propagate typed
   failures and preserve scenario/package bounds rather than assume expansion
   always succeeds. This is an existing scheduled integration, not missing work
   in plan 014.

10. **Docs and examples.** Formats, packages and SDK guides describe the new
    forms and helpers, including seed requirements and optional convention.
    The model guide describes `implement` as shipped; the shipped-doc wording
    guard derives identifiers from actual public modules. Existing fixture
    generation remains byte-identical because its catalog uses none of the new
    keywords. Links, compiled examples and exported names are checked by the
    whole-plan gate. No further guide correction was found.

11. **Conformance.** Shared schema/compiler semantics belong in library tests,
    consistent with the existing conformance backlog boundary. Ajv agreement
    tests cover meta-schema structure and equivalent nullable/union value
    schemas. No new app implementation obligation needs a suite case here.
    Plan 019 Task 4 already requires the corpus after all 014–017 formats land;
    it must include minimum/nullable/tagged-union successes and failures, semantic
    install-only failures and nested widget-pattern rejection from these tests.
    That language-neutral corpus is scheduled work, not claimed delivered here.

12. **Reference hosts.** LF-03, LF-04 and LF-12 are delivered; CL-03 is fixed by
    staged packaging. This is checkout/archive evidence, not production adoption
    by Synapta or Clay. Their migrations remain in their repositories. All other
    requests and named backlog items retain their approved owners in plans
    015–020; no product component, status vocabulary beyond the generic outcome
    convention, or host authority was added to satisfy an adopter.

## Findings and disposition

| ID | Finding and evidence | Recommended disposition | Outcome |
| --- | --- | --- | --- |
| F1 | Validator timing varies across runs; earlier runs missed the budget. Tasks 4–6 also recorded failures on unchanged comparison checkouts; a timing miss alone does not establish a schema regression. Whole-plan measurements are recorded below. | backlog — extend the existing P1 “Phase 1 performance gate: 3 µs per node”; retain the strict ≤1.5 µs/node validator and ≤3 µs/node render limits, require controlled baseline/profile evidence, and keep plan 020's release gate binding. | Existing owner-approved P1 disposition retained (2026-10-25, recorded in `plans/backlog.md`); plan 014's source and measurements added to that entry. No new deferral or timing exception. |

No other new architectural finding requires execution or deferral. The plan
018/019 integration obligations above are already in the accepted release scope.
F1 is not a waiver of a budget or permission to release with a failing gate.
The table was presented to the owner during Task 8 on 2026-10-29; the retained
disposition comes from the existing approval, not a newly inferred approval.

## Verification and measurements

Commands use the temporary project-pinned Bun 1.4.2 binary at
`/tmp/liveframe-bun-1.4.2/bun-linux-x64/bun`, placed first on `PATH`; the installed
Bun 1.4.4 was not replaced. Machine: AMD Ryzen 9 PRO 7940HS, 16 logical CPUs,
Linux 7.3.0-4-cachyos. Logs are text evidence in `014-task-8/`; no screenshots
were produced.

- Initial `timeout 180s bun run bench`: failed the validator gate; render and CSS
  were short-circuited by the script. It overlapped `bun run check`, so is not an
  isolated comparison. Start/end load: 5.05/5.36 (one minute). Validator
  agent-home: 1.546 µs/node; small/medium/large/full queues:
  1.608/1.464/1.606/1.599 µs/node; git-status/rack/synthetic:
  1.067/1.016/1.348 µs/node. Agent-home equal-work compiled props: 22.80× over
  `checkValue`. Mixed tagged feed: 500 elements, 0.0391 ms, 0.078 µs/element.
  See `014-task-8/bench-overlapping.log`.
- `timeout 900s bun run check` on 2026-10-28 at `ec088e0`: **passed**, build,
  generated-fixture check, typecheck, lint, format check and tests: 669 pass,
  4 existing reference-dependent skips, 0 fail, 115,736 assertions (269.62 s).
  See `014-task-8/check.log`. Browser warm switches passed: agent-home max
  5.60 ms, git-status 3.30 ms, below 16.67 ms.
- `timeout 180s bun run bench` on 2026-10-29: **passed** in an isolated checkout
  of `ec088e0`, sequentially without another verification command from this task.
  The working repository had advanced to plan 017 with unrelated uncommitted
  changes; none were included in these measurements. Start load: 5.40/2.85/3.11
  (1/5/15 minutes); end render load: 6.79/3.33/3.27. See
  `014-task-8/bench-sequential.log`. Every standalone validator fixture is
  ≤1.5 µs/node, every render fixture ≤3 µs/node, and all required large trees
  render within 2 ms. This passing run does not erase the initial failure or
  establish a cause for timing variation.
- `timeout 300s bun run release:gate` on that isolated checkout: **passed**,
  all 8 installed-package steps in 6.2 s, including the export-target checks,
  pack/store/both runners, timeout recovery, generation, MCP, browser bundle,
  strict consumer types and existing Node probes. See `014-task-8/release.log`.
- `timeout 30s bun src/cli/liveframe.ts gen src/__tests__/fixtures/proof/catalog.json --out src/__tests__/fixtures/widgets/ui.gen.ts --check`:
  **passed**, exit 0, no generated-fixture changes.

| Workload | Standalone validation (µs/node) | Render (µs/node) | Render (ms/tree) |
| --- | --- | --- | --- |
| agent-home | 1.347 | 1.935 | 1.3138 |
| core-queue.small | 1.211 | 2.376 | 0.0119 |
| core-queue.medium | 1.387 | 2.225 | 0.9210 |
| core-queue.large | 1.374 | 2.244 | 1.0008 |
| core-queue.full | 1.472 | 2.572 | 1.2167 |
| git-status | 0.908 | 2.086 | 0.3024 |
| rack-module | 0.931 | 1.718 | 0.4054 |
| synthetic-queue | 1.199 | 1.826 | 0.6446 |

Agent-home equal-work compiled props checking: 25.37× over `checkValue` (not a
full-validation speedup). Mixed tagged feed: 500 elements, 0.0389 ms,
0.078 µs/element. Render's separate validation diagnostic exceeds the reserved
1.5 µs/node on medium/large/full queues (1.708/1.642/1.789); it is not an
in-render profile. F1 retains this evidence in the same P1 investigation.
CSS declarations: 0.399 µs/node, 0.271 ms per 679-node tree. Base,
Certified theme/system and Rack theme/system sheets:
0.435/0.997/10.722/1.020/16.197 ms; sizes:
1,072/7,754/142,845/9,176/148,619 bytes.
