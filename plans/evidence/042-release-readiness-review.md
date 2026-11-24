# Release readiness review for 0.4.1

The review uses candidate `0.4.1-rc.2` at commit `0a8c0be`, green [CI run 45371937526](https://github.com/ashiqrniloy/liveframe/actions/runs/45371937526) and protected [publish run 45380067362](https://github.com/ashiqrniloy/liveframe/actions/runs/45380067362). The [acceptance log](042-acceptance.md) links each scope row to its tests and commands. The [registry record](042-release-candidate.md) covers the published candidate.

## Owner go

The owner answered the two review questions on 2026-11-24:

> Deferrals: "Approve all (Recommended)"

> Release: "Go"

Every item marked **Deferral proposed** below is therefore deferred with owner approval. [Decision log](../../decision-logs/2026-11-24-2000-go-on-0-4-1.md). A1–A3 are in the backlog entry [Make the streaming guide's loop self-contained and exact](../backlog.md#make-the-streaming-guides-loop-self-contained-and-exact) (plan 046), and A4–A6 in [Give limit errors the size that tripped them](../backlog.md#give-limit-errors-the-size-that-tripped-them). The [stable registry verification](042-release.md) completes Task 10.

## Release scope

The 0.4.1 rows of the [Synapta 0.4.0 request scope](../../decision-logs/2026-11-22-1929-synapta-0-4-0-requests-scope.md) (plan 041 Task 1). Plan 041 implemented the fixes and plan 042 the documentation.

| Row | Scope | Status and evidence |
| --- | --- | --- |
| LF-18 | Template render cost is not bounded by `limits.steps` | Fixed in [plan 041](../041-Phase-7-Part-AB-Request-Scope-And-0-4-1-Security-Hardening.md) T2–T5. Emitted elements and `$use` spend steps and nodes, sized operators spend steps in proportion, install rejects a static fan-out past `limits.nodes`, and four hostile corpus cases were added. The worst render the default budget allows is 5.192 ms against 50 ms on a loaded host ([Task 7](042-bench-attempt-loaded.md)). [Acceptance](042-acceptance.md). |
| LF-21 | Widget-thrown text reaches host errors and `HostEvent`s | Fixed in plan 041 T6. A fixed `Widget threw <name>` message, with thrown text only through an explicit `debug` opt-in (`thrown_widget_text_never_reaches_a_host_event`, `quickjs_thrown_text_is_not_returned`). [Acceptance](042-acceptance.md). |
| LF-25 | The A2UI converter's allocations are not bounded | Fixed in plan 041 T7. Sparse indices, deep pointers and formatted output return typed errors. The hostile rows run under 1 ms and 256 KiB. [Acceptance](042-acceptance.md). |
| LF-26 (bounds half) | Authoring accepts unbounded drafts | Fixed in plan 041 T8. Inline drafts are bounded by file count and bytes before any transpile, with 0 bytes of RSS growth for a 9 MiB refusal. The runner half is plan 043 (0.5.0), as scheduled. [Acceptance](042-acceptance.md). |
| LF-27 | Six small hardening defects | Fixed in plan 041 T9–T10 and T11b. Each has its regression test. [Acceptance](042-acceptance.md). |
| LF-34 | The validator cache holds eight catalogs | Fixed in plan 041 T11. All 64 pairs hit (`sixty_fifth_pair_evicts_the_least_recently_used`, and the bench gate in [Task 7](042-bench-attempt-loaded.md)). [Acceptance](042-acceptance.md). |
| LF-36 (guide half) | The documented streaming loop is quadratic | Fixed in plan 042 T4. The coalescing loop is executed in a test, and the [agent run](042-agent-acceptance.md) sent 503 updates under a frame bound of 660. The pull form, append patch and bench are plan 046 (0.5.0), as scheduled. |
| LF-65 | Security guide corrections and an adopter responsibility checklist | Fixed in plan 042 T2–T3. `docs/security-checklist.md` ships in the installed core archive ([registry record](042-release-candidate.md)). |
| Peer floor | `0.4.1-rc.1` companions admitted core `0.4.0` | Fixed by the [peer-floor decision](../../decision-logs/2026-11-24-1550-companion-peer-floor-is-the-release-patch.md). The final companions peer on `~0.4.1`. |

## Open P1 backlog

| Item | Status and evidence |
| --- | --- |
| [Phase 1 performance gate, 3 µs per node](../backlog.md#phase-1-performance-gate-3-µs-per-node) | **Deferral proposed.** Unchanged by 0.4.1: the standalone validator gate fails under load, as at 0.4.0. Carried with the quiet-host proof to plan 049 (LF-41). |
| [Re-run the full benchmark suite on a quiet host](../backlog.md#re-run-the-full-benchmark-suite-on-a-quiet-host) | Deferred with owner approval: [Task 7 decision](../../decision-logs/2026-11-24-0103-close-plan-042-task-7-on-partial-benchmark-evidence.md). Scheduled in plan 049. |
| [Revisit scoping only if nested surfaces become required](../backlog.md#revisit-scoping-only-if-nested-surfaces-become-required) | Deferred with owner approval in the scope decision. Scheduled in plan 053 (0.6.0). |
| [Fix initially-open dialogs in the demo host](../backlog.md#fix-initially-open-dialogs-in-the-demo-host) | **Deferral proposed**, as at 0.4.0. The registry demo passed 78 of 78 against `0.4.1-rc.2`, including `initially_open_dialog_is_dismissable`. 0.4.1 changed no renderer or demo code. |

## Impact findings of plan 041

The owner approved every disposition on 2026-11-23 ([impact analysis](041-impact-analysis.md)).

| Finding | Status |
| --- | --- |
| F1 CHANGELOG lacked lines for five register entries | Fixed in 041 T11a. `changelog_0_4_1_has_a_line_for_every_register_entry` now gates it. |
| F2 Three register reasons misworded | Fixed in 041 T11a. |
| F3 Host text in capture failures | Fixed in 041 T11b. |
| F4 Runner-authored and author-keyed error channels remain open | Deferred with owner approval, backlog P3. Named as a limit in `docs/security-checklist.md`. |
| F5 Catalog-cache hit 3–16% slower | Deferred with owner approval, backlog P3. |
| F6 Wall-clock gates failed under load at both checkouts | Deferred with owner approval, quiet-host backlog (plan 049). |
| F7 Aggregate `bun run check` flakes under load | Deferred with owner approval, the MCP-capture and browser-wall-time backlog entries. |

## Task 7 budget evidence

Closed on partial evidence by the [owner decision](../../decision-logs/2026-11-24-0103-close-plan-042-task-7-on-partial-benchmark-evidence.md). The [loaded-host record](042-bench-attempt-loaded.md) ran all 16 stages at 34–99% host CPU.

| Gate | Result |
| --- | --- |
| LF-18 worst render (`template`) | Held: `nestedMaps` 5.192 ms against 50 ms; worst operator 9.38 ns/step against 25. |
| LF-34 64 pairs (`validator`) | Held: every pair hit; hit 0.4114 ms, full-cache miss 1.3741 ms. |
| `stream-loop` (informational) | Exit 0. |
| `streaming`, `motion`, `dom`, `template`, `stream-elements`, `host`, `hash`, `selection`, `a2ui`, `starter-content` | Exit 0 under load. |
| `validator`, `render`, `css`, `runner` | Exit 1 on absolute wall-clock gates known to fail under load since 0.2.2. Deferred with owner approval to plan 049. |
| `pack-libraries`; `render` composed-6-layers ratio | Exit 1 under load; each passed on a single rerun at load 15–19. |

No budget failed on a quiet host, so no plan 041 task was reopened and no threshold changed.

## Task 8 findings

From the [agent acceptance run](042-agent-acceptance.md). All four paths passed. None blocks the release.

| ID | Finding | Proposed disposition |
| --- | --- | --- |
| A1 | The streaming snippet uses `validator`, `send`, `now` and `llm` without defining them, and does not say an element stream's validator comes from `ephemeralManifest`. | **Deferral proposed**: backlog for plan 046, which rewrites the loop. |
| A2 | The guide says `end()` gives "the same result" as `renderElements`; the roots match but the revision differs. | **Deferral proposed**: backlog for plan 046 ("the same tree"). |
| A3 | The loop sends the final tree whole and tells the client nothing after a failure. | **Deferral proposed**: backlog for plan 046, whose gate measures patch bytes. |
| A4 | The inline-draft `limit-exceeded` names the bound but not the draft's size. | **Deferral proposed**: backlog P3. |
| A5 | The template `limit-exceeded` points at the outer `$use` and omits the computed minimum. | **Deferral proposed**: backlog P3, with A6. |
| A6 | `docs/templates.md`'s error table has no example for the limit row and never shows a `scenarios.json`. | **Deferral proposed**: backlog P3, with A5. |
| A7 | The installed `package.json` said `0.4.0` during the run. | Fixed: Task 9 bumped the versions. |
| A8 | The checklist's proof links name an adopter's request document. | No action: plan rule 2 links to the request that tracks the gap. |

## Task 9 registry verification

Against `0.4.1-rc.2` ([record](042-release-candidate.md)).

| Check | Status |
| --- | --- |
| Protected publish and dist-tags | Fixed. `next` is `0.4.1-rc.2` and `latest` is `0.4.0` on all four packages. |
| Archive gates and installed API | Fixed. Four archive gates passed (QuickJS 16 of 16 runner cases), and the installed API compares with zero differences against the 0.4.0 baselines through the registers. |
| Consumer checks | Fixed. The registry getting-started guide passed, the registry demo passed 78 of 78, and a plain `npm install` of the four packages resolves. |
| Peer floor | Fixed. npm refuses core `0.4.0` with runner `0.4.1-rc.2`. |
| Signatures and provenance | Fixed. `npm audit signatures` reports no invalid or missing signatures; each provenance statement names the repository, `publish.yml` and `refs/tags/v0.4.1-rc.2`. |

`0.4.1-rc.1` stays on npm with its broken range; `next` no longer points to it. Task 10 repeats these checks for `0.4.1`.

## Four laws

| Law | Status and evidence |
| --- | --- |
| 1. Widget code never runs in the browser | Unchanged by 0.4.1. The archive gate's browser probe passed on the candidate. LF-26's bounds act before any transpile, in the host. |
| 2. The UI tree is validated data | Strengthened. Template expansion is bounded at install and at render (LF-18), A2UI input fails with typed errors (LF-25), lone surrogates and `__proto__` sections are refused (LF-27), and a cache hit never returns checks compiled from other content (LF-34, `a_changed_document_never_hits`). |
| 3. Widgets never set colours or raw CSS | Unchanged. No 0.4.1 change touched themes, recipes or CSS projection (041 impact area 5). |
| 4. Widgets never hold authority | Strengthened. A crafted refusal no longer overwrites a recorded action status, and widget-thrown text never reaches a `HostEvent` (LF-21, LF-27). The agent run's 13 MCP calls were all `pack_draft` or `render_scenarios`. The remaining error channels (041 F4) are listed as limits in the checklist. |
