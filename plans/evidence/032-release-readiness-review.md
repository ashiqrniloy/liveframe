# Release readiness review for 0.3.0

Prepared 2026-11-10 against `7e48ddc` (plan 032 Task 6), reviewing the registry-installed `0.3.0-rc.1`, the checkout acceptance log of plans 026–031, the benchmark attempts of Task 3, the agent acceptance run of Task 4, and the gates of Task 5.

**Verdict: go.** Every scope row is fixed except the quiet-host proof (O1), which the owner deferred on 2026-11-09, and every finding is either fixed with evidence or deferred into the backlog. The owner approved the deferred set on 2026-11-10 with the wording recorded at the end of this file.

## Evidence key

- **ACC**: [032-acceptance.md](032-acceptance.md), the generated log of 426 acceptance bullets over plans 026–031 (`bun scripts/release/acceptance.ts --plans 026-031`), joined to proofs by [032-acceptance-map.json](032-acceptance-map.json). Regenerable; Task 3 explains how to refresh it after a quiet-host bench.
- **BENCH**: [032-bench-attempt-best.md](032-bench-attempt-best.md) (peak host CPU 23.0%) and [032-bench-attempt-not-quiet.md](032-bench-attempt-not-quiet.md); decision [2026-11-09-2106](../../decision-logs/2026-11-09-2106-close-plan-032-task-3-on-partial-quiet-host-proof.md) closes Task 3 on partial proof. `032-bench.md` is not written because no stage sequence was quiet throughout.
- **RC**: [032-release-candidate.md](032-release-candidate.md), registry publication of all three packages, archive gates, installed API comparison, guide and demo from the registry, signatures.
- **AGENT**: [032-agent-acceptance.md](032-agent-acceptance.md), the fresh-agent run on the 0.3.0 paths.
- **P26–P31**: the plan files' execution notes; **impacts**: `026`–`031-impact-analysis.md`.
- **P32**: [plan 032](../032-Phase-7-Part-S-Release-0-3-0.md).
- **Backlog**: [plans/backlog.md](../backlog.md).

---

## Checkout acceptance (Task 2)

| Plan | pass | pending | n/a | fail | unmapped |
| --- | --- | --- | --- | --- | --- |
| 026 | 70 | 5 | 6 | 0 | 0 |
| 027 | 61 | 9 | 1 | 0 | 0 |
| 028 | 59 | 6 | 1 | 0 | 0 |
| 029 | 52 | 4 | 2 | 0 | 0 |
| 030 | 75 | 8 | 2 | 0 | 0 |
| 031 | 61 | 4 | 0 | 0 | 0 |
| **all** | **378** | **36** | **12** | **0** | **0** |

374 named tests were found in one run and passed; every command passed (`gen:check` 0.4 s, `demo:test` 36.6 s, `build && release:gate` 12.2 s, the runner suite 13.2 s, the guide 3.5 s, the starter suite 65.7 s). The 36 `pending` rows are exactly the bullets whose proof is a gated budget in the quiet-host record: they are the performance half of the O1 deferral below. The 12 `n/a` rows are bullets the plans mark as not applicable.

The log was generated before the Task 3 runtime fix (`src/preview/in-process.ts`) and the Task 5 notice fix (`src/cli/mcp.ts`); each is covered by its own tests and by the full `bun run check` runs recorded in those tasks (1,769 pass, 4 skip, 0 fail on 2026-11-10).

## Scope rows (Q1–Q10, W1–W9, L1–L2, O1–O2)

| Row | Item | Evidence | pass | pending | Status |
| --- | --- | --- | --- | --- | --- |
| Q1 | Node references (`ref()`, `$anchor`, `refProps`) | `032-acceptance.md` 027 T2/T3 | 14 | 2 | fixed |
| Q2 | Extension recipe properties | `032-acceptance.md` 027 T4 | 5 | 1 | fixed |
| Q3 | Variant axes with role aliases | `032-acceptance.md` 027 T1/T5 | 13 | 1 | fixed |
| Q4 | Frozen packages, caller ownership | `032-acceptance.md` 026 T3 | 7 | 1 | fixed |
| Q5 | Reject `fr` on dimensions | `032-acceptance.md` 026 T4 | 6 | 1 | fixed |
| Q6 | Verified-package cache option | `032-acceptance.md` 026 T7 | 7 | 0 | fixed |
| Q7 | Validation `limits` on preview and authoring | `032-acceptance.md` 026 T6 | 5 | 0 | fixed |
| Q8 | One realm rule | `032-acceptance.md` 026 T5 | 8 | 0 | fixed |
| Q9 | One source for checkers and JSON Schemas | `032-acceptance.md` 026 T9 | 6 | 1 | fixed |
| Q10 | `focusContinuity` on by default | `032-acceptance.md` 026 T8 | 5 | 1 | fixed |
| W1 | Isolated QuickJS runner package | `032-acceptance.md` 031 T1–T5 | 38 | 3 | fixed |
| W2a | Template widgets | `032-acceptance.md` 028 T1–T6 | 42 | 4 | fixed |
| W2b | Progressive streaming render | `032-acceptance.md` 028 T7 | 7 | 1 | fixed |
| W3a | Action-outcome contract | `032-acceptance.md` 029 T1/T2 | 13 | 1 | fixed |
| W3b | Local bindings in the browser | `032-acceptance.md` 029 T1/T3/T4 | 23 | 2 | fixed |
| W4 | Stateless host pipeline (`/host`) | `032-acceptance.md` 030 T1–T3/T5 | 24 | 3 | fixed |
| W5a | Catalog impact report | `032-acceptance.md` 030 T6 | 6 | 1 | fixed |
| W5b | Several catalog majors in one renderer | `032-acceptance.md` 030 T7 | 7 | 1 | fixed |
| W5c | Declarative state migration | `032-acceptance.md` 030 T8 | 8 | 0 | fixed |
| W6a | Content-addressed package dependencies | `032-acceptance.md` 030 T9/T10 | 16 | 2 | fixed |
| W6b | Coordination through source dependents | `032-acceptance.md` 030 T4 | 6 | 0 | fixed |
| W7a | Framework-independent `/surface` core | `032-acceptance.md` 029 T4 | 8 | 1 | fixed |
| W7b | Starter package and getting-started guide | `032-acceptance.md` 031 T6/T7 | 15 | 0 | fixed |
| W7c | Bun-only runtime, recorded | `032-acceptance.md` 026 T1 | 7 | 0 | fixed |
| W8a | App-declared states and semantics | `032-acceptance.md` 027 T6 | 7 | 1 | fixed |
| W8b | `url` string form with a scheme allowlist | `032-acceptance.md` 027 T7 | 7 | 1 | fixed |
| W9 | Spec restructure | `032-acceptance.md` 026 T2 | 6 | 0 | fixed |
| L1 | Localisation guidance and determinism rule | `032-acceptance.md` 029 T6 | 5 | 0 | fixed |
| L2 | Observability hooks | `032-acceptance.md` 029 T5 | 7 | 0 | fixed |
| O1 | Quiet-host benchmark proof (carried from 025 T8) | `BENCH`; decision 2026-11-09-2106 | — | 36 | **deferred** (owner, 2026-11-09; re-approved 2026-11-10) |
| O2 | `next` dist-tag (carried from 025 T10) | `RC` registry state; plan 025 Task 10 closed | — | — | fixed |

---

## Open backlog P1 entries

| Entry | Why it stays open | Current evidence | Status |
| --- | --- | --- | --- |
| Phase 1 performance gate: 3 µs per node (`plans/backlog.md:7`) — the standalone validator share at ≤ 1.5 µs/node | Owner-retained P1 since 2026-10-25; the gate is load-sensitive by measurement, not by a code regression | Task 3's `validator` stage ran quiet at 9.7% host CPU and passed every gate, including `agent-home` ≤ 1.5 µs/node; the whole-suite absolute proof still needs a quiet host (`BENCH`) | **deferred** (owner, 2026-10-25; re-approved 2026-11-10) |
| Fix initially-open dialogs in the demo host (`plans/backlog.md:250`) | Owner-approved P1 backlog on 2026-10-25; it is a demo-host defect, not a shipped-contract one | `initially_open_dialog_is_dismissable` passes in `demo:test` (67 pass on 2026-11-10, including the registry-installed run); no change found by plan 030 Task 5 | **deferred** (owner, 2026-10-25; re-approved 2026-11-10) |

## Impact findings of plans 026–031

48 findings across the six impact analyses. Each row names the finding, its area, and its recorded disposition: `fixed` means the disposition was executed in the plan that found it; `deferred` means a backlog entry owns it. Rows truncated with `…` continue in the linked impact analysis. Owners' original answers: 026 chose "Execute the Runner.maxErrors correction now" for F3; 027 answered "Execute all four"; 030 and 031 accepted every recommended disposition; 028 and 029 recorded dispositions without a separate owner round trip, so their nine rows (028's four, 029's five) are covered by the 2026-11-10 approval below.

| Finding | Finding text | Area | Status | Disposition and evidence |
| --- | --- | --- | --- | --- |
| 026 F1 | Five implemented items still appear open in the backlog (`plans/backlog.md:518,544,580,590,600`) | Backlog | fixed | Closed the realm, session-limit, package/input ownership, dimension-fraction and verified-package-cache entries with Task 3–7 references. R24 was already closed by Task 9. Original request text… |
| 026 F2 | Absolute whole-suite proof remains missing; isolated Task 9 reference variance exceeds 2% (`package.json:150`,… | Performance | deferred | Updated “Re-run the full benchmark suite on a quiet host” (`plans/backlog.md:505`), pointing to this run and the Task 9 A/B report; carry into 032 T3 under the approved scope/previous owner… |
| 026 F3 | Spec asks runners to forward an absent `maxErrors` option | Spec, docs | fixed | Task 9a aligns `docs/spec.md:838` with `src/preview/runner.ts:9-16` and `docs/packages.md:361`; `src/runner-kit/render.ts:13-21` keeps its separate option. Owner: “Execute the Runner.maxErrors… |
| 026 F4 | Once-per-object hash prose omits mutable-package rechecks | Docs | fixed | Task 9a corrects `docs/spec.md` §7.5 and `docs/packages.md` § Runner limits and ownership to match `src/preview/cache.ts:15-24` and Task 3's approved frozen-package rule. No runtime change. |
| 027 F1 | `core-queue.full` ≤ 1.5 µs/node fails at both the plan 026 baseline and HEAD; `bun run bench` exits before the other stages… | Performance | fixed | Executed: measurement stabilized (median of five batches). The 1.5 limit and the quiet-host requirement are not changed; the existing backlog entry carries this run. The gate still trips on noise… |
| 027 F2 | `proof/scripts/export-formats.ts` fails its recipe round-trip on the 0.2.2 states, so the documented fixture regeneration path was broken | Proof, release | fixed | Executed: the round-trip compares the proof's own eight states and writes the library's full table; regenerating into a scratch directory matches the committed fixtures byte for byte (the three… |
| 027 F3 | Axis kinds expand eagerly (~8 KB CSS per combination) with only a per-kind cap | Formats, performance | fixed | Executed: catalog-wide total of 512 (`src/formats/axes.ts:8`, `src/formats/catalog.ts:197`), test `axis_combinations_are_bounded_across_the_catalog`, corpus case,… |
| 027 F4 | No conformance feedback for URL-named props that skip the `url` rule | Conformance | fixed | Executed: `url_props_declare_a_url_rule` in `catalogSuite` (`src/conformance/catalog.ts:22`), test `url_props_declare_a_url_rule`, conformance guide, spec §13, migration and changelog |
| 028 F1 | Spec §3 and §4 still describe TSX-only widgets and "compiled code" packages | Spec | fixed | **Executed** in Task 8 |
| 028 F2 | `limits.steps` is the only time bound and `templateRunner` has no timeout; its cost and the advice for untrusted authors were not documented | Laws, docs | fixed | **Executed**: `docs/security.md`, `docs/templates.md` |
| 028 F3 | The stream's nesting, linear-work and text bounds were untested and undocumented | Validation, docs | fixed | **Executed**: three tests in `sdk-stream.test.ts`, security section |
| 028 F4 | Render/validator gates: A/B at load 13 cannot separate a 0–4% render change from drift; the validator gate fails at the pre-plan commit too | Performance | deferred | **Backlog** (P3, extends the validator-gate entry; plan 032 Task 3 settles it) |
| 028 F5 | `streamElements` holds back `$ref` nodes and fragments until the end; bench margin 2.4–2.9× of 3× | Performance, agent… | deferred | **Backlog** (P4) |
| 028 F6 | The template schema's structured subset is not strict-mode compatible; Gemini unchecked | Agent authoring | deferred | **Backlog** (P3) |
| 028 F7 | First render of a template pays about 15 ms (plus 11 ms per catalog) | Performance, docs | fixed | **Executed** as documentation (warm at install); a pre-warm option belongs with `checkPackages` in plan 030 |
| 028 F8 | `bun run bench` rewrites the tracked `plans/evidence/019-streaming-bench.md` | Release automation | deferred | **Backlog** (P4) |
| 028 F9 | Regex-based sanitisation and `Intl` are not expressible | Reference hosts | fixed | **Recorded** (by design, T22); no change |
| 029 F1 | `UiNode.events` is `TreeIntent`; the demo host's `offeredIntent` returned it as `Intent` and `demo:test` failed to typecheck; `bun run check` does… | Public API | fixed | **Executed**: helper narrows `setLocal`; `demo:test` 57 pass |
| 029 F2 | `docs/model.md` tiers and `docs/security.md` omitted local bindings and action results | Docs, laws | fixed | **Executed** |
| 029 F3 | No quiet-host proof for the validator-with-bindings gate, the live-filter figures or the selection bench against 0.2.3 | Performance | deferred | **Backlog** (extends the quiet-host entry; plan 032 Task 3) |
| 029 F4 | Absolute-millisecond tests fail the full `check` at load 17–27 (8 failed, 6 pass alone) | Performance, release… | deferred | **Backlog** (extends the intermittent-failure entry) |
| 029 F5 | Element JSON has no `when`/`bind` | Agent authoring | deferred | **Backlog** (P4) |
| 029 F6 | No conformance case for `when`/`setLocal`/`binding-failed`, and none for a renderer built on `/surface` | Conformance | deferred | **Backlog** (P3) |
| 029 F7 | No way to express an empty state over filtered rows; local state is scalars only | Reference hosts | deferred | **Backlog** (P3) |
| 030 F1 | `setState` called `putState` without `authorize`; spec §7.7 rule 5, `docs/host.md` and the design said otherwise | Law 4, spec | fixed | **Executed**: `authorize` runs first for `setState`; a refusal returns `served` and `actions` unchanged with `intent-refused`; tests `set_state_unauthorized_writes_nothing`, and the call-order… |
| 030 F2 | A repeated crafted or forbidden action cost `loadPlacement` + `resolve` per request (the design's "one render" claim was wrong) | Law 4, performance | fixed | **Executed**: `finishRefusal` returns `served` unchanged when the recorded statuses do not change; tests `repeated_refusals_cost_no_render` and the extended… |
| 030 F3 | An action trusts `served` and reads no store; a stale frame still dispatches after a placement is replaced, deleted or disabled | Law 4 | fixed | **Executed (docs)**: `docs/host.md` "served is trusted", spec §7.7 rule 5 |
| 030 F4 | No guard against the same action arriving twice | Interaction | fixed | **Executed (docs)**: `docs/host.md` "Double submits", spec §7.7 H9 |
| 030 F5 | Authoring session, MCP, preview and `gen` cannot pack, preview or type a widget that imports a library | Agent authoring | deferred | **Backlog** P3 |
| 030 F6 | `loadPlacement` does not re-check the names a dependent reads from its pinned libraries | Integrity | deferred | **Backlog** P4 |
| 030 F7 | `migrateState` is not type-checked against the state property at install | Validation | deferred | **Backlog** P4 |
| 030 F8 | A library `version` outside `[A-Za-z0-9._+-]` cannot be imported | Formats | deferred | **Backlog** P4 |
| 030 F9 | `Served` carries no manifest; `not-found` serves both a client-fault origin and a host-fault missing record | Reference hosts | deferred | **Backlog** P3, two entries |
| 030 F10 | Wall-clock gates fail under load (`verify_agent_home_under_20_ms`, `host.bench.ts` gates) and `bun run bench` never reaches the host benches | Performance, release… | deferred | **Backlog** P3 (extends the intermittent-failure and quiet-host entries) |
| 030 F11 | `loadLibraries` reads pins sequentially; the pending frame re-runs the widget and the resolver | Performance | deferred | **Backlog** P4 (extends the cache-hit entry) |
| 030 F12 | `roadmap.md` §3 said "Tasks 1–6"; the plan's Compromises Made and Further Actions were empty | Docs, plan | fixed | **Executed** at plan close |
| 031 F1 | A host killed with `SIGKILL` while its child is in a native call leaves the child spinning at about 102% CPU (measured; an idle child exits) | Law 1 (backend),… | deferred | **Backlog** P3 "Stop a child the host orphaned while it was in a native call" |
| 031 F2 | One child renders one widget at a time: a hold delays queued renders by up to `timeoutMs` + 100 ms plus about 250 ms; undocumented | Performance, reference… | fixed (docs) + deferred | **Executed (docs)**: runner README and `docs/security.md`. **Backlog** P3 "Render concurrently in the QuickJS runner" |
| 031 F3 | Child memory and kill clean-up had never been measured | Performance, security | fixed | **Executed**: `plans/evidence/031-soak.ts`, the figures above, runner README and `docs/security.md` |
| 031 F4 | The guide's install and placement routes carried no statement that who may install is the app's policy | Law 4, docs | fixed | **Executed (docs)**: `docs/getting-started.md` § 6 |
| 031 F5 | The starter's peer floors (`react` 19.0.0, `react-aria-components` 1.22.0) are untested | Portability, release | deferred | **Backlog** P3 "Test the starter's peer floors" |
| 031 F6 | Runner and starter ran only on Linux | Portability | deferred | **Backlog** P3 "Run the new packages on macOS and Windows" |
| 031 F7 | `load.ts` copies the core's library-graph walk and bounds; no test notices drift | Validation, conformance | deferred | **Backlog** P4 "Share the library-graph walk between the core and the QuickJS runner" |
| 031 F8 | Backlog entry "Evaluate a conformance suite for runners" is delivered | Spec, backlog | fixed | **Executed**: entry closed with a status line |
| 031 F9 | `bun run bench` stops at its first stage (known), so the runner bench is not reached | Performance, release… | fixed | **Executed**: update line on the existing "Re-run the full benchmark suite on a quiet host" entry with this plan's runner figures |
| 031 F10 | The guide is run but not type-checked, and uses Chromium only | Docs, conformance | deferred | **Backlog** P4 "Type-check the getting-started guide and run it in more engines" |
| 031 F11 | The starter's switching case needs a derived second design system | Conformance | deferred | **Backlog** P4 "Let the starter's switching case take a second design system without a derived copy" |
| 031 F12 | `roadmap.md` §3 said "planned" for plan 031; the plan's Compromises Made and Further Actions were empty | Docs, plan | fixed | **Executed** at plan close |

---

## Budgets and performance (Task 3)

No quiet-host sequence was achieved: other processes held the host at 2.4–5.7 cores, and the owner stopped the VM workload only long enough for one 23.0%-peak attempt. The record is `BENCH`, and the owner closed Task 3 on partial proof on 2026-11-09 with no budget changed.

| Stage | Host CPU (avg / peak) | Result | Status |
| --- | --- | --- | --- |
| `validator` | 9.7 / 9.7% | quiet; every gate passed, `agent-home` ≤ 1.5 µs/node, 50 distinct `when` ≤ 1.75 | pass |
| `streaming` | 8.1 / 8.1% | quiet; every gate passed | pass |
| `render` | 11.7 / 11.7% | exit 0, not quiet | **pending** under O1 |
| `stream-elements` | 10.9 / 12.4% | exit 0, not quiet | **pending** under O1 |
| `host` | 13.6 / 13.6% | exit 0, not quiet | **pending** under O1 |
| `pack-libraries` | 12.1 / 15.7% | exit 0, not quiet; the 5% gate failed 4 of 13 runs at CPU pressure 0, the cause was `inProcessRunner.render` collecting the library set twice, fixed in code (`src/preview/in-process.ts`); 30 of 30 runs after the fix, ratio 0.994–1.048 | pass locally; quiet `pass` line pending under O1 |
| `css` | 15.2 / 23.0% | exit 0, not quiet | **pending** under O1 |
| `runner` | 20.4 / 20.7% | exit 0, not quiet | **pending** under O1 |
| `template` | 14.4 / 14.4% | exit 1: `templateRunner` 5.44% over `renderTemplate` against a 5% budget | **unconfirmed on a quiet host** — the same thin-margin ratio gate as `pack-libraries`, which was a real defect |

Two harness findings are part of the record: the 1-minute load average reads 1.0–1.3 as soon as a benchmark thread starts, so "load < 1.0" could never hold (the owner redefined quiet as whole-host CPU below 10%, benchmark included), and the `powersave` governor made the first validator measurement after an idle gap read 1.7× slow, fixed by a 5 s CPU spin before the first stage (a harness fix, not a threshold change).

## Registry verification of `0.3.0-rc.1` (Task 5)

| Check | Result | Status |
| --- | --- | --- |
| `dist-tags` | core `{ next: 0.3.0-rc.1, latest: 0.2.3 }`; both companions `{ latest: 0.3.0-rc.1, next: 0.3.0-rc.1 }` | pass |
| Core provenance | `npm/attestation` and `slsa.dev/provenance/v1` bundles; repo `ashiqrniloy/liveframe`, workflow `publish.yml`, ref `refs/tags/v0.3.0-rc.1`, log index 3781858285 | pass |
| Archive gates | core 15 steps, runner 2, starter 2, each installed outside the checkout | pass |
| Installed API | equal to the checkout and to every baseline (`0.2.3` + `register-0.3.0` for the core, the two `0.3.0` companion baselines) | pass |
| Getting-started guide from the registry | 3.0 s, installing all three `0.3.0-rc.1`; core lockfile integrity equals the registry's | pass |
| Demo host from the registry | 67 pass, 0 fail, 34.5 s | pass |
| `npm audit signatures` | `invalid: []`, `missing: []`; core verified with 2 bundles | pass |
| Companion attestations | 404 — a token publish cannot attest | **gap**: `0.3.0` publishes from CI and restores provenance |
| Local gates on the rc commit | check 1,769/4/0; peer floors 119/23/87; security audits clean | pass |

## Peer floors

| Peer suite | Environment | Result | Status |
| --- | --- | --- | --- |
| React floor | React and react-dom 19.0.0 | 119 pass, 0 fail | pass |
| Playwright floor | Playwright 1.49.0 | 23 pass, 0 fail | pass |
| MCP server floor | `@modelcontextprotocol/sdk` 2.0.0 | 87 pass, 0 fail | pass |

The two companion packages declare `@arnilo/liveframe` as `~0.3.0-0` in the rc; the final release narrows the range to `~0.3.0` before tagging, and both ranges accept `0.3.0`.

## The Four Laws

1. **Widget code never runs in the browser.** The isolated runner is a separate optional package (`packages/runner-quickjs`, plan 031) and the preview, authoring and MCP paths only validate, project and render trees; template widgets are data evaluated by the library (`028`), and the host-API-free `/surface` core (`029`) renders trees without touching browser host APIs. Task 4's agent transcript shows every widget reaching the host through the installed pipeline.
2. **The UI tree is validated data.** Every arrival is validated before render, including `when`, `bind`, local state and action results (`029`), streamed documents (`028` `streamElements` bounds), packages with pinned dependencies (`030`), and axis-resolved catalogs (`027`). The 426 acceptance bullets include the hostile-input probes and near-cap trees.
3. **Widget code never sets colours or raw CSS.** Recipe properties stay closed sets (`027` extension properties, `028` template styles), app states carry no styles, roles resolve to library tokens, and the `url` form only constrains strings. Law 3 was re-checked against every new style input in `027`'s impact review with no bypass found.
4. **A widget never holds authority.** `setState` now runs `authorize` before `putState` and a refusal returns `served` and `actions` unchanged (`030` F1, tests `set_state_unauthorized_writes_nothing` and the call-order tests); local bindings read only `local` and `self` through an operator allow-list with every bound value re-validated (`029`); the seven authoring MCP tools install, place and dispatch nothing (Task 4's 42 recorded calls).

## Release dispositions and risks

- **Source moved after the rc.** `7e48ddc` carries the MCP notice fix only (`src/cli/mcp.ts`); the published rc does not. It is covered by `mcp_notice_recommends_installed_quickjs_runner` and the 1,769-test check, and `0.3.0` publishes from source.
- **Two packages ship their first tagged release without provenance.** `0.3.0` publishes from CI, so provenance returns for all three; the companions' trusted publishers must be configured on npmjs.com first (repository `ashiqrniloy/liveframe`, workflow `publish.yml`, environment `release`, `npm publish` and `npm dist-tag` allowed), or the workflow stops at the same `ENEEDAUTH`.
- **`latest` on both companions is the rc** until `0.3.0` is published; npm sets `latest` on a first publish.
- **The `template` 5% gate is unconfirmed**, and `pack-libraries` has thin headroom (worst 1.048 of 1.05). Neither budget was relaxed; the quiet-host proof remains `plans/backlog.md:510`.
- **Wall-clock gates still flake under load.** Observed again on 2026-11-10: `switch_changes_computed_styles_not_dom_structure` failed at 6.3 s in one full check, then passed at 0.6 s alone and in the next full check (029 F4, 030 F10).
- **The 36 pending acceptance rows** are the budget bullets; re-running `bun scripts/bench-quiet.ts --out plans/evidence/032-bench.md` on an idle host and then the acceptance script turns them `pass`.

## Owner go

Verbatim, 2026-11-10, in answer to the review summary and the three deferred groups:

> We go and leave the 3 items identified as deferred

That approves: (1) the 23 deferred impact findings and the split one (031 F2), (2) the two open P1s, and (3) the quiet-host proof with its 36 pending rows and the unconfirmed `template` gate — all carried into 0.3.x.
