# 0.2.3 release readiness review

Prepared 2026-11-04 for plan 025 Task 10, against `c0c3b7a` plus the final version/changelog preparation. The RC's [registry verification](025-release-candidate.md) passes. Final publication completed under `latest`; registry provenance, archive and API checks pass. The owner's `next` dist-tag repair is pending.

## Review findings R1–R26

Split findings retain each disposition; fixing the patch-safe part does not claim the deferred part shipped. The owner approved the split rows and bundled sucrase with “Approve all” in [the scope decision](../../decision-logs/2026-11-03-1132-release-0-2-3-scope.md). Detailed criterion and test evidence is in [the acceptance record](025-acceptance.md).

| Row | Disposition | Evidence / remaining work |
| --- | --- | --- |
| R1 | fixed | Plan 023 T2: custom-runner invalid/cyclic tree tests in preview, authoring and MCP; host validation precedes counting. Configurable host limits remain backlog. |
| R2 | fixed | Plan 023 T3: module-rule tests reject top-level `await using`, including blocks and loops. |
| R3 | fixed | Plan 023 T3: failed links do not occupy module-cache slots; runner tests. |
| R4 | fixed; deferred to 0.3.0 | Plan 023 T4: changed top-level package fields trigger reverification. Nested freezing awaits the [immutability migration](../../docs/compatibility.md#deferred-to-030). |
| R5 | deferred to 0.3.0 | Caller-input ownership changes with the same immutability migration; 0.2.3 preserves freezing behavior. |
| R6 | fixed | Plan 023 T5: malformed worker failure envelopes become typed errors and recycle the worker. |
| R7 | fixed | Plan 023 T5: corrupt placement listings fail closed; file-store tests. |
| R8 | fixed; backlog | Plan 023 T6: draft errors contain relative paths. Handle-based reads remain P4 in [backlog](../backlog.md); trusted draftRoot requirement documented. Scope split approved above. |
| R9 | fixed; deferred to 0.3.0 | Plan 023 T7: dimension fractions deprecated; rejection awaits the [dimension migration](../../docs/compatibility.md#deferred-to-030). CSS bytes unchanged. |
| R10 | fixed | Plan 023 T8 and 025 T9: audits/SBOM, tag-only publish, required reviewer `ashiqrniloy` and `v*` environment policy; successful protected RC run. |
| R11 | fixed | Plan 023 T9: bundled transform, third-party licences, identical hashes/code; final pack comparison ratio 0.8359 in 025 T8. |
| R12 | fixed | [Surface reuse](024-surface-reuse.md); production remeasurement ratios 0.371 whole-tree / 0.357 patch in acceptance record. |
| R13 | fixed | Plan 024 T3: all 50 existing rows reused on head insertion; reorder and failed-child tests. |
| R14 | measured, no change | [Walk measurement](024-validator-walk.md): fused walk not built; 15% gain unproved. P4 validity-cost follow-up retained; owner disposition in plan 024 impact analysis. |
| R15 | fixed; deferred to 0.3.0; backlog | [Hash measurement](024-sha256.md): faster SHA/canonical JSON; final SHA ratio 0.700. Original 2× SHA and 5 ms packageHash targets missed/backlogged (024 impact F4). Verified-package cache awaits [migration/design](../../docs/compatibility.md#deferred-to-030). |
| R16 | fixed; measured, no change | [Seven hot spots](024-hot-spots.md): bundle, theme catalog cache and shuffled diff gains kept. Array early exit already present; JSON prototype and event-name substitutions not retained. Individual dispositions in backlog. |
| R17 | fixed | Plan 025 T1: dead constants/imports/proof leftovers removed; callers audited. |
| R18 | fixed | Plan 025 T1: four internal exports removed; API baseline unchanged. |
| R19 | fixed | Plan 025 T1: zero warnings, warnings-as-errors gate, fixture overrides with reasons. |
| R20 | fixed | Plan 025 T2: shared helpers plus duplicate guard, internal tests and cached findNode. JSON-string sizing and strict hash encoding deliberately preserve distinct semantics. |
| R21 | fixed | Plan 025 T3: one byte-budget owner; 1,000-tree agreement property test. |
| R22 | fixed | [Closure splits](025-closure-splits.md); retained hot-path complexity comment carries measured reason; declarations unchanged. |
| R23 | fixed | [Renderer/authoring splits](025-renderer-authoring-splits.md); hooks/dependencies unchanged, focused suites and production selection A/B pass. |
| R24 | fixed; backlog | Plan 025 T6: strict schema/checker differential suite, 200 mutations per seed and drift self-check. Single-source formats remain P3, scope split approved above. |
| R25 | measured, no change | [Hot spots](024-hot-spots.md): deleting identity cache costs 1.25–1.33×; final recheck 1.230, exceeding allowed 1.05. |
| R26 | measured, no change | Documented threat-model review: import checks are syntactic; reference runners are not a hostile-code sandbox. [Security guide](../../docs/security.md) and spec §7.5 retain host isolation responsibility; no sandbox claim. |

## Open proof and proposed release disposition

- Task 8 remains unchecked. The owner previously said “Leave the quiet-host requirement open”; that did not approve bypassing it for the final release. Full checks and installed RC gates pass, but no full check at load below 2 is recorded, full benchmark absolute gates fail under load, and cumulative validator/render ratios reach 1.064 / 1.096. Earlier task-boundary A/B evidence is retained; a release cannot be described as proving those outstanding budgets.
- Proposed: release 0.2.3 after the final-version release checklist passes, retaining Task 8 and the quiet-host backlog as open. Alternative: hold final publication until quiet-host evidence passes. No thresholds or tests are weakened.
- Task 11's final impact sweep is a separate unexecuted task. Roadmap status must describe the published release and remaining Tasks 8/11 accurately; it cannot mark plan 025 complete while those remain open.
- npm trusted-publisher dist-tag permission is owner-configured. The workflow attempts `next` promotion; a failure requires the documented owner repair and registry confirmation.

## Owner review

The owner answered **“Go: release with quiet-host proof open”** after reviewing the gaps above on 2026-11-04. [Approved release exception](../../decision-logs/2026-11-04-2116-release-0-2-3-with-quiet-host-proof-open.md). This authorizes the final tag push and protected-environment approval after release checks pass; Tasks 8 and 11 stay open. Publication and registry results are recorded in `025-release.md` after execution.

## Final-version local gates

`package.json` holds `0.2.3`; its changelog entry is dated 2026-11-04. `timeout 900s bun run check` passes (1,063 pass, four skip, zero fail; 120 files, 392.22 s of tests). The local installed-archive gate passes all 14 steps in 6.5 s. Host load before the check was 5.37, so this does not close quiet-host proof. Peer floors pass: React 19.0.0 (117 tests), Playwright 1.49.0 (23), MCP server 2.0.0 (78). Demo passes (53 tests). [Publication and registry verification](025-release.md) pass; the workflow's `next` promotion failed for lack of npm permission and owner repair is pending.

Regenerate logs with the release checklist in `docs/compatibility.md`; this execution's local-only logs are under `/evidence/025-task-10/`.
