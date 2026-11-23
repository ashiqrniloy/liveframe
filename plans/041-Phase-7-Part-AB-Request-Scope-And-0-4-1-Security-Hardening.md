# Phase 7 Part AB: Request Scope and 0.4.1 Security Hardening

Depends on: plan [040](040-Phase-7-Part-AA-Release-0-4-0.md) complete (0.4.0 published, the four `0.4.0*.json` baselines set). Followed by plan [042](042-Phase-7-Part-AC-Release-0-4-1.md) (security guide, streaming guide and the 0.4.1 release), then plans 043 to 056 for 0.5.0 and 0.6.0 (table below). Source: [`requests/synapta-0.4.0-requests.md`](requests/synapta-0.4.0-requests.md), an evaluation of `@arnilo/liveframe@0.4.0` at `93d20e7`. This plan holds its scope decision and LF-18, LF-21, LF-25, LF-26 (the draft bounds half), LF-27 and LF-34.

## Objectives

- Record the scope decision for the whole request document: a release and a plan for each of LF-18 to LF-65, the owner of each boundary decision, and the seventeen backlog priority raises.
- Bound a template render's work by its limits while it runs, not after it.
- Keep text a widget throws out of host errors and `HostEvent`s.
- Bound what the A2UI converter allocates, and make every failure a typed error.
- Refuse an oversized inline draft before any transpile.
- Fix six small defects in hashing, schema checks, element JSON, the intent boundary, draft directories and capture.
- Let a process hold more than eight compiled catalogs.

## Expected Outcome

- `decision-logs/<date>-synapta-0-4-0-requests-scope.md` is approved. It holds the four tables below with the owner's answer for each row.
- `plans/backlog.md` carries the approved priority on each of the seventeen raised entries.
- A template of sixteen components that fan out four ways returns `limit-exceeded` after emitting at most `limits.nodes + 1` elements, and `validateTemplate` rejects it at install.
- An operator that walks or builds a long string or array pays steps in proportion to that work, measured.
- A widget that throws `new Error(JSON.stringify(inputs))` produces a `render-failed` error and event with a fixed message under every runner. The thrown text is present only when the host asked for it.
- `fromA2ui` returns a typed error for a sparse index, an oversized formatted string and a deep pointer.
- `pack_draft` refuses a draft over the file-count or byte bound with `limit-exceeded`, and no transpile runs.
- Six regression tests, one per LF-27 defect, pass.
- Sixty-four `(catalog, capabilities)` pairs compile once each and then hit the cache.

This plan implements the first part of the approved 0.4.1 patch in roadmap Phase 7 (the bullet "Synapta's 0.4.0 evaluation"). Every task after Task 1 is patch-safe under the 0.4.x promise in `docs/compatibility.md` ("The 0.4.x promise"). No version is bumped and nothing is published here: plan 042 releases 0.4.1. `docs/security.md` is corrected in plan 042 (LF-65), which cites the tests this plan adds. The explicit-runner half of LF-26 breaks a default and waits for 0.5.0 in plan [043](043-Phase-7-Part-AD-Release-0-5-0-Scope-Stored-Documents-And-Content-Integrity.md). Spec sections touched: §7.5 (runners), §7.6 (templates), §7.7 (host pipeline), §10 (validation), §13 (packages and the MCP server).

### Approved request dispositions

The [scope decision](../decision-logs/2026-11-22-1929-synapta-0-4-0-requests-scope.md) approves these assignments. "Half" means the request spans two releases.

| ID | Request | Plan | Approved release |
|---|---|---|---|
| LF-18 | Template render cost is not bounded by `limits.steps` | 041 | 0.4.1 |
| LF-19 | A placement cannot pin a package's content | [043](043-Phase-7-Part-AD-Release-0-5-0-Scope-Stored-Documents-And-Content-Integrity.md) | 0.5.0 |
| LF-20 | URL props have no host constraint | 043 | 0.5.0 |
| LF-21 | Widget-thrown text reaches host errors and `HostEvent`s | 041 | 0.4.1 |
| LF-22 | A `confirm` action can dispatch unconfirmed | [044](044-Phase-7-Part-AE-Intent-Boundary.md) | 0.5.0 |
| LF-23 | Intent identity: exactly-once dispatch and an idempotency key | 044 | 0.5.0 |
| LF-24 | `authorize` and `dispatch` receive no context | 044 | 0.5.0 |
| LF-25 | The A2UI converter's allocations are not bounded | 041 | 0.4.1 |
| LF-26 | Authoring runs drafts with host permissions and accepts unbounded drafts | 041 (bounds half); 043 (runner half) | 0.4.1; 0.5.0 |
| LF-27 | Hardening batch: six small defects | 041 | 0.4.1 |
| LF-28 | `Served` cannot be persisted | [045](045-Phase-7-Part-AF-Host-Session-Store-And-Transport.md) | 0.5.0 |
| LF-29 | Share one render across viewers with identical inputs | [050](050-Phase-7-Part-AK-Release-0-6-0-Scope-And-Host-Throughput.md) | 0.6.0 |
| LF-30 | Store reads are serial and a page has no batch | 045 | 0.5.0 |
| LF-31 | One tree is validated three or four times per request | 050 | 0.6.0 |
| LF-32 | Isolated-runner throughput | 050 | 0.6.0 |
| LF-33 | `Store` for multi-tenant database hosts | 045 | 0.5.0 |
| LF-34 | The validator cache holds eight catalogs | 041 | 0.4.1 |
| LF-35 | Incremental validation of patched trees | [046](046-Phase-7-Part-AG-Incremental-Validation-Streaming-And-Hydration.md) | 0.5.0 |
| LF-36 | The documented streaming loop is quadratic | [042](042-Phase-7-Part-AC-Release-0-4-1.md) (guide half); 046 (pull form, append patch, bench) | 0.4.1; 0.5.0 |
| LF-37 | A data channel beside the tree: typed resource handles | [051](051-Phase-7-Part-AL-Resource-Handles-View-State-And-Upload.md) | 0.6.0 |
| LF-38 | Finer patch operations | 050 | 0.6.0 |
| LF-39 | Hydration draws every node twice; no streaming server rendering | 046 | 0.5.0 |
| LF-40 | Embedding: a custom element, a DOM starter registry, style isolation | [052](052-Phase-7-Part-AM-Shortcuts-Drag-And-Drop-And-Embedding.md) | 0.6.0 |
| LF-41 | Benchmarks at adopter scale and a passing quiet-host gate | [049](049-Phase-7-Part-AJ-Release-0-5-0.md) | 0.5.0 |
| LF-42 | A second emit from one revision is dropped | 044 | 0.5.0 |
| LF-43 | Wider carriers: arrays in local state, selection sets, larger events | [047](047-Phase-7-Part-AH-Carriers-Navigation-And-Catalog-Structure.md); its handle-backed conformance case in 051 | 0.5.0 |
| LF-44 | Declared view state for primitives | 051 | 0.6.0 |
| LF-45 | Layout vocabulary gaps | [048](048-Phase-7-Part-AI-Layout-Recipes-Icons-And-Overlays.md) | 0.5.0 |
| LF-46 | Keyboard shortcuts | 052 | 0.6.0 |
| LF-47 | Drag and drop | 052 | 0.6.0 |
| LF-48 | A navigation intent and URL-bound state | 047 | 0.5.0 |
| LF-49 | File upload | 051 | 0.6.0 |
| LF-50 | Overlay behaviour in `/surface` | 048 | 0.5.0 |
| LF-51 | Recipe expressiveness and icon sets | 048 | 0.5.0 |
| LF-52 | Layouts as widgets: slot nodes, nested surfaces, cross-surface links | [053](053-Phase-7-Part-AN-Layouts-As-Widgets-And-Customization-Records.md) | 0.6.0 |
| LF-53 | Template language: sort, group, aggregate, format, dependencies | [054](054-Phase-7-Part-AO-Template-Language-Data-Bound-Surfaces-And-Stream-Repair.md) | 0.6.0 |
| LF-54 | Data-bound ephemeral surfaces | 054 | 0.6.0 |
| LF-55 | Customization records: placement revisions, scoped overrides, history | 053 | 0.6.0 |
| LF-56 | `classifyPackageChange` and placement rebase on upgrade | 053 | 0.6.0 |
| LF-57 | Editing an installed widget: read, patch, diff, propose | [055](055-Phase-7-Part-AP-Agent-Editing-Context-And-Evaluation.md) | 0.6.0 |
| LF-58 | Repair during a stream, not after it | 054 | 0.6.0 |
| LF-59 | Agent context: a digest by kind, strict-mode schemas, an element check | 055 | 0.6.0 |
| LF-60 | An agent evaluation harness with published success rates | 055 | 0.6.0 |
| LF-61 | Live-data preview | 055 | 0.6.0 |
| LF-62 | A client transport helper | 045 | 0.5.0 |
| LF-63 | Stability an adopter with stored documents can plan on | 043 | 0.5.0 |
| LF-64 | `hostSuite()`: conformance for an app's intent boundary | 044 | 0.5.0 |
| LF-65 | Security guide corrections and an adopter responsibility checklist | 042 | 0.4.1 |

Plan [056](056-Phase-7-Part-AQ-Release-0-6-0.md) releases 0.6.0 and closes the adoption gate: every row delivered, or declined with a decision log that names who owns the problem.

### Boundary decisions and the plan that owns each

Each is designed and decided in Task 1 of the plan named. Task 1 confirmed the owning plans.

| Boundary | Requests | Decided in |
|---|---|---|
| Spec §14 "authorisation, approval flows, a storage backend": interfaces and reference implementations, no policy | LF-23; LF-28, LF-33; LF-55 | 044; 045; 053 |
| Spec §14 "layout shells" and nested surfaces | LF-52 | 053 |
| Spec §14 rule 2: tools that install, place or approve stay the app's | LF-57 | 055 |
| Law 2 and a second data path | LF-37 | 051 |
| Spec §5 "no product-shaped components" | LF-37, LF-43, LF-44 | 051 (LF-37, LF-44); 047 (LF-43) |
| The closed recipe and style-prop lists | LF-45, LF-51 | 048 |

The surveys for plans 043 to 055 found further requests that contradict the spec or an accepted decision. The request document does not list them. Each is likewise decided in Task 1 of the plan named, and Task 1 recorded their owning plans.

| Conflict | Requests | Decided in |
|---|---|---|
| A stability rule for stored documents cannot hold for releases before it starts (0.3.0 broke stored documents on purpose) | LF-63 | 043 |
| Three items narrow `starter.ui@1`, which needs a starter catalog major: `image.src`, parent kinds, a declared icon set | LF-20, LF-51, backlog parent kinds | 043 (one decision for all three) |
| Spec §7.1, §8 and §11 make `confirm` the gate and `irreversible` presentation only; spec §7.7 says a stale origin is never rewritten | LF-22, LF-42 | 044 |
| Spec §7.7 Rule 1 and `decision-logs/2026-11-08-1115-stateless-host-pipeline.md` keep the host pipeline stateless | LF-28 | 045 |
| Spec §9.1 ("no incremental validation"), §7.2 (`push()` returns a tree) and §11 (hydration draws twice) | LF-35, LF-36, LF-39 | 046 |
| `decision-logs/2026-11-02-2208-multiple-variant-axes-for-0-3-0.md` offers no compound variants; `/surface` is host-API-free | LF-51, LF-50 | 048 |
| The quiet-host rule counts the benchmark itself and cannot pass in CI | LF-41 | 049 |
| `decision-logs/2026-11-19-1143-rendering-additions-for-0-4-0.md` rejected a custom element and starter DOM implementations; spec §2 names drag and drop as an app primitive's job; the Clay request recorded shortcuts as needing no library change | LF-40, LF-47, LF-46 | 052 |
| `docs/localisation.md`: the library ships no formatter | LF-53 | 054 |
| Spec §13: the authoring server has no store or data resolver | LF-57, LF-61 | 055 |

### Backlog priority raises

Headings are those in `plans/backlog.md`. Task 1 applied these dispositions to the existing entries.

| Backlog heading | Before approval | Approved disposition | Plan |
|---|---|---|---|
| Re-run the full benchmark suite on a quiet host | P3 (open) | P1 | 049 |
| Revisit scoping only if nested surfaces become required | P4 | P1 | 053 |
| Evaluate an atomic-class route for strict style CSP | P3 | P2 | 048 |
| Render concurrently in the QuickJS runner | P3 | P2 | 050 |
| Do not carry a prior render's `patch`, `reset` or `migrated` on a skipped `renderPlacement` | P4 | P2 | 045 |
| Report a thrown or rejected `onIntent` through `SurfaceEvent` | P4 | P2 | 044 |
| Carry the manifest on `Served` or document the lookup | P3 (open) | with LF-28 | 045 |
| Gate the remaining request-time pipeline budgets in `bench/host.bench.ts` | P3 (open) | P2 | 049 |
| Let definitions declare their parent kinds | P3 | P2 | 047 |
| Give live filters a case-insensitive match | P3 (open) | P2 | 054 |
| Make the template structured-output schema usable in strict modes | P3 | P2 | 055 |
| Draw `$ref` and fragment documents progressively in `streamElements` | P4 | P3 | 054 |
| Add a `meter` kind and an interactive table to the starter | P4 | P2 | 051 |
| Capture overlays that are open inside a preview cell | P4 (open) | P3 | 055 |
| Later-phase gaps from the Phase 0 reports, G29 (forced colours and assistive technology audit) | P2, run waived | P2, run required | 049 |
| Composition surface gaps from the parity re-proof (`position: relative`, `basis` units) | P3 | with LF-45 | 048 |
| Run the new packages on macOS and Windows | P3 (open) | P3 | 049 |

## Compatibility rules for every task

1. **Patch-safe only.** A task may add an optional field, option or export, each with an `added` or `widened` entry in `scripts/release/api/register-0.4.1.json` (or a companion's `register-0.4.1-<package>.json`, created and wired into `src/__tests__/api-stability.test.ts` when first needed). A task that needs `removed` or `changed` stops; the item moves to 0.5.0 with the owner's acknowledgement.
2. **Outcome changes only for wrong cases.** A task changes an outcome only where today's outcome is a defect named in the request. It names that case in its Functional criterion and in a CHANGELOG "Fixed" line.
3. **No existing corpus expectation, hash vector or published schema meaning changes.** New corpus cases are `added` entries.
4. **No wall-clock assertion in `bun run check`.** Time and memory figures from the request's acceptance go to `bench/` gates; tests assert counts and typed errors.

## Handoffs from sibling plans

The sixteen plans of this family were drafted in parallel from one request document. These are the points the other plans' surveys raised that bear on this one. Settle each before the task it names starts. Where a sibling plan has changed since, its file wins and this list is amended.

- **The adoption gate has three states** (plan [056](056-Phase-7-Part-AQ-Release-0-6-0.md)): `delivered`, `declined` (with a decision log that names who owns the problem) and `open` (moved or deferred). Task 1's decision uses the same three, and says the gate is not met while any row is `open`.
- **Commit the request document in Task 1.** `plans/requests/synapta-0.4.0-requests.md` is untracked. Plan [042](042-Phase-7-Part-AC-Release-0-4-1.md) links to it from `docs/` by absolute GitHub URL (the link test rejects relative links to files outside the archive), and plan [056](056-Phase-7-Part-AQ-Release-0-6-0.md) parses its tables in a test.
- **Leave the `docs/security.md` wording to plan [042](042-Phase-7-Part-AC-Release-0-4-1.md)** (LF-65). Tasks here add pointers only. Task 12's impact analysis lists the test and bench names delivered for LF-18, LF-21, LF-25, LF-26 and LF-34, because plan 042 cites them.
- **A companion package whose declarations change needs its own register.** Only `register-0.4.1.json` and `register-0.4.1-starter.json` exist. Task 6 or Task 7 creates `register-0.4.1-runner-quickjs.json` or `register-0.4.1-a2ui.json` in the task that needs it.
- **Keep the validator cache key in one function** (Task 11). Plan [043](043-Phase-7-Part-AD-Release-0-5-0-Scope-Stored-Documents-And-Content-Integrity.md) (LF-20) adds a deployment's `urlHosts` to that key.
- **Task 9's edit to `refuseOffered` lands before plan [044](044-Phase-7-Part-AE-Intent-Boundary.md)**, which edits the same function for LF-22 and LF-23.
- **Task 3's corrected `charge` rate is the one pricing scheme.** Plan [054](054-Phase-7-Part-AO-Template-Language-Data-Bound-Surfaces-And-Stream-Repair.md) (LF-53) prices its new operators with it.

## Tasks

- [x] Task 1: Record the scope decision for the request document and apply the backlog raises
  - Acceptance Criteria:
    - Functional:
      - Write `decision-logs/<date>-synapta-0-4-0-requests-scope.md` with `create-decision-log`. It holds the four tables above. The owner confirms each request's release and plan, each boundary's owning plan, the plan that decides each further conflict, and each backlog priority. The log is created only after that confirmation. A row the owner declines names who owns the problem instead.
      - `roadmap.md` §2 Phase 7 replaces the bullet "Synapta's 0.4.0 evaluation (proposed 2026-11-22, not yet approved)" with the approved scope and a link to the log. §3 rows 041 to 056 drop "proposed scope".
      - Each of the seventeen backlog entries carries its approved priority and a status line naming the plan that executes it.
      - If the owner moves a row, the affected plan's header and tasks are amended before that plan starts, and this plan's table is corrected.
    - Performance: n/a — documents.
    - Code Quality: one decision log for the scope. Designs are not decided here; each boundary decision stays with the plan that holds the request.
    - Security: n/a — no runtime path. The `register_0_4_1_holds_only_additive_entries` test already keeps a patch from breaking a contract.
  - Approach:
    - Skills to Use:
      - `create-decision-log` — the scope is a release decision and needs explicit approval.
      - `liveframe-execution` — authority order and the roadmap's state rules.
    - Library Documentation to Check Before Implementation:
      - none; read `docs/compatibility.md` ("Versions", "The 0.4.x promise") and `src/__tests__/api-stability.test.ts:1-98`.
    - Documentation Reviewed:
      - The request document's "Decisions needed before any plan", "Backlog items this adoption needs" and "Summary"; plan 033 Task 1 and plan 040 Task 1 (the same step for earlier scopes); spec §14.
      - `scripts/release/api/`: the four `0.4.0*.json` baselines, `register-0.4.1.json` (`[]`) and `register-0.4.1-starter.json` exist; `api-stability.test.ts:72-81` already gates the checkout through them.
    - Options Considered:
      - One decision log per release, written as each release starts — rejected as the only record: the owner's adoption gate covers all 48 rows, so one table must show where each row goes. Plans 043 and 050 still record their release's detailed scope.
      - Decide the six boundary questions here — rejected: each needs a design first, and the request says each needs its own log.
    - Chosen Approach:
      - One scope decision before any code, mirroring plan 033 Task 1. No baseline work: the 0.4.1 registers and gate shipped with 0.4.0.
    - API Notes and Examples: n/a.
    - Files to Create/Edit:
      - `decision-logs/<date>-synapta-0-4-0-requests-scope.md`: new.
      - `roadmap.md`: §2 Phase 7 bullet; §3 rows 041–056.
      - `plans/README.md`: rows 041–056, only if a row's content changed.
      - `plans/backlog.md`: priority and status line on the seventeen entries.
      - Plans 042–056: headers and tasks (tentative — only for rows the owner moves).
  - Test Cases to Write:
    - n/a — decision task. `docs_links_resolve` must still pass.
  - Notes (executed 2026-11-22):
    - The [approved scope](../decision-logs/2026-11-22-1929-synapta-0-4-0-requests-scope.md) records all 48 release and plan assignments, the six boundary owners, the ten further conflict owners, and all seventeen backlog dispositions. LF-26 and LF-36 retain their split releases. Every adoption item starts open.
    - Updated the Phase 7 roadmap and plan index and applied the seventeen backlog dispositions to existing entries. The manifest and composition entries retain P3 and are scheduled with LF-28 and LF-45. G29 retains P2 and is scheduled as a required audit in plan 049.
    - Verified the 48 source release targets, seventeen backlog entries and their owning-plan links. The 20 documentation-link and API-stability tests passed. A focused rerun of the browser scoping, streaming, proof formats and preview session files passed all 50 tests.
    - The first two full checks reached their 900-second cutoff. The first had runtime timeouts and browser-context errors under host load. The final `timeout -k 15s 1800s bun run check` passed with 2,129 tests passed, 6 skipped and 0 failed.

- [x] Task 2: Charge every emitted element and `$use`, and stop at the node limit while emitting (LF-18)
  - Acceptance Criteria:
    - Functional:
      - `renderTemplate` spends one step for each element it emits, each fragment and each `$use` it enters. Exhausting the steps is `limit-exceeded`, as for expressions.
      - The expansion counts emitted elements and stops at the first one over `limits.nodes` (default 5,000) with `limit-exceeded` at that element's template pointer. Nothing is emitted after it.
      - The changed case: the request's reproduction (N components, each a `box` of four `$use` children). Today it builds 4^N elements and then fails. It now fails after at most `limits.nodes + 1` elements, at 10 and at 16 components, with default limits and with `limits: { steps: 1000 }`.
      - Every existing template fixture renders the same tree, byte for byte. A fixture that already failed on the node limit keeps its error kind; record any pointer that moves.
      - Spec §7.6 "Rendering" states the new charges and that the node limit is enforced during expansion.
    - Performance: `bench/template.bench.ts` holds `agent-home` at ≤ 3 µs per node and `templateRunner` at ≤ 5% over `renderTemplate`. Record `agent-home`'s steps before and after.
    - Code Quality: one counter on `Run` and one `tick` in the two emitters of `src/template/render.ts`; no second walk. The build pass's own node check stays as the authority for code widgets.
    - Security: law 2 and the runner contract (spec §7.5): a template is data whose evaluation is bounded. The bound must hold in the host process, where no timeout applies.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/sdk.md` for the template renderer.
      - `surgical-patch` — the regression test first, then the two emitters.
    - Library Documentation to Check Before Implementation:
      - none; read `src/template/render.ts:47-104`, `:254-353`, `:470-533` and `src/template/expr/types.ts:41-54`.
    - Documentation Reviewed:
      - Confirmed: the `$use` emitter (`src/template/render.ts:281-291`) and the element emitter (`:335-352`) call neither `tick` nor `charge`. `expand` (`:470-496`) runs the whole expansion before `renderExpansion` (`src/sdk/render.ts:111-130`) hands the root to the build pass, which is where the node limit applies.
      - `guarded` (`:90-104`) turns an `ExprFailure` into a reported error, and `report` (`:82-87`) sets `run.stopped` on `limit-exceeded`, so a thrown limit already stops every later emitter.
      - Spec §7.6 (`docs/spec.md:1129`): "one step per expression node, plus one per 64 units of input".
    - Options Considered:
      - Only charge steps, no node counter — rejected: the default 1,000,000 steps would still allow 1,000,000 elements before the 5,000-node limit is read.
      - Only count nodes — rejected: a chain of `$use` with `$if`-guarded empty bodies does work and emits nothing.
      - Enforce the limit in `renderExpansion` by streaming elements to the build pass — rejected: it restructures the single build pass for a bound two counters give.
    - Chosen Approach:
      - `Run` gains `nodes` and `maxNodes`. Each element or fragment emission ticks the frame and increments `nodes`; over the limit it fails with `limit-exceeded` at the node's pointer. Each `$use` entry ticks. `expand` receives `limits.nodes ?? DEFAULT_LIMITS.nodes`.
    - API Notes and Examples:
      ```ts
      // src/template/render.ts, inside the element emitter
      tick(frame, pointer);
      if (++run.nodes > run.maxNodes) fail(pointer, `Expected at most ${run.maxNodes} nodes`, "limit-exceeded");
      ```
    - Files to Create/Edit:
      - `src/template/render.ts`: `Run`, the `$use` and element emitters, `expand`, `renderTemplate`.
      - `src/__tests__/template-render.test.ts`: the tests below.
      - `docs/spec.md` §7.6; `docs/templates.md:175-178` (what a step is).
      - `bench/template.bench.ts`: record the minimum step budget for the first `agent-home` selection outside the timed batches.
      - `CHANGELOG.md`: a "Fixed" line.
  - Test Cases to Write:
    - `fan_out_of_use_stops_at_the_node_limit`: bounded fixtures with 10 and 16 components and seven four-way branching levels exceed the default node budget and the 1,000-step budget.
    - `emitted_elements_and_fragments_spend_steps_and_nodes`: the exact budgets succeed, going one over identifies the correct node, and later siblings are skipped.
    - `empty_use_chain_spends_steps`: `$use` entries with nothing emitted exhaust a small step budget.
    - `template_parity_with_tsx_proof_widgets`: compare canonical JSON for every template fixture and its corresponding TSX scenario.
  - Notes (executed 2026-11-22):
    - Expansion charges elements, fragments and entered `$use` calls. A limit failure stops sibling traversal and pending ancestor emission. The SDK build pass continues to enforce the limits for code widgets.
    - `$use` now transfers fuel after evaluating its arguments and key, preserving those expression charges. The empty-chain regression covers the key. Spec §7.6, the template guide and the changelog describe the revised render-time budgets.
    - Four new cases failed before the fix and pass now. The default node limit points to `/components/Layer7/root` and `/components/Layer9/root` in the 10- and 16-component fixtures. The existing lower-node-budget fixture still reports `limit-exceeded` at `/root/children/0`. All fixture scenarios matched their TSX trees in canonical JSON.
    - The first `agent-home` selection used 5,403 steps before the fix and 6,135 after it. The post-check run met both Task 2 targets at 2.506 µs per node and 2.10% runner overhead. Timings varied across runs on this host. The separate install-validation row reported 5.007 ms against its 5 ms target on that run, and some reruns exceeded the render timing target.
    - The 50 focused template tests and `timeout 900s bun run check` passed. The full check reported 2,133 passed, 6 skipped and 0 failed.

- [x] Task 3: Price string and array operators by the work they do (LF-18)
  - Acceptance Criteria:
    - Functional:
      - Finding to settle first: the request says string operators are "priced per call, not by size". The code charges by size at one step per 64 units (`charge`, `src/template/expr/types.ts:50-54`), and nothing below 64 units. The request's measurement still holds, because the price is too low: 58 `$slice` calls on a 1 MiB string cost about 950,000 steps and 0.5 s. The task corrects the price, not a missing charge.
      - Each operator that walks or builds a string or array (`$len`, `$concat`, `$join`, `$contains`, `$split`, `$slice`, `$sum`, `$flat`, `$merge`, `$fromEntries`, and the collection forms in `src/template/expr/forms.ts`) charges for the units it reads and the units it writes, at a rate set from a measurement so that no operator does more than the reference time per step.
      - `$slice` on a string walks only to its `end`, not the whole string (`src/template/expr/operators.ts:168-171` builds `Array.from(source)` first).
      - Results are unchanged for every existing expression test. Only step consumption changes.
      - Spec §7.6 states the pricing rule in one sentence.
    - Performance: the new bench row "worst operator per step" shows every sized operator at or under the reference time per step (proposal: 25 ns, the figure `docs/security.md:22` already implies). `agent-home` stays ≤ 3 µs per node; its step count before and after is recorded.
    - Code Quality: one `charge` function with a per-operator rate, no second fuel counter. Rates are named constants next to `EXPR_LIMITS`.
    - Security: the runner contract (spec §7.5): `limits.steps` is the only bound on a template's running time, so one step must bound time.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/sdk.md`.
      - `investigate-first` — measure each operator before choosing a rate.
    - Library Documentation to Check Before Implementation:
      - none; read `src/template/expr/operators.ts:81-172`, `:224-259`, `:302-340` and `src/template/expr/forms.ts` at each `tick`.
    - Documentation Reviewed:
      - `src/template/scope.ts:20-21`: `MAX_STRING` is 1,048,576 and `MAX_ITEMS` 65,536, so one call may walk 1 MiB for 16,384 steps today.
      - `bench/template.bench.ts:17-18`: the 50 ns per expression node target, recorded and not gated.
    - Options Considered:
      - Charge by output size only, as the request proposes — rejected: `$contains` and `$len` read a whole string and write one scalar.
      - One step per unit for everything — rejected until measured: it would cut the largest string a default budget can handle by 64×, with no evidence every operator needs it.
      - Lower `MAX_STRING` — rejected: it changes a format bound, which a patch may not do.
    - Chosen Approach:
      - Measure nanoseconds per unit for each sized operator at 1 KiB, 64 KiB and 1 MiB. Set each operator's rate so its cost per step is at or under the reference. Rewrite `$slice` to stop at `end`.
    - API Notes and Examples:
      ```ts
      // UTF-16 units scanned plus units taken, at the operator's measured rate
      charge(f, p, scanned + taken, RATE.stringSlice);
      ```
    - Files to Create/Edit:
      - `src/template/expr/types.ts`: `charge` and the rates.
      - `src/template/expr/operators.ts`, `src/template/expr/forms.ts`: each sized operator.
      - `bench/template.bench.ts`: the per-operator row and its gate.
      - `src/__tests__/template-expr.test.ts`: the tests below.
      - `docs/spec.md` §7.6; `docs/templates.md`; `CHANGELOG.md`.
  - Test Cases to Write:
    - `sized_operators_spend_steps_in_proportion`: for each operator, doubling the input at least doubles the steps spent above the free threshold. Fails if an operator returns to a flat price.
    - `slice_of_a_long_string_reads_only_to_its_end`: a `$slice` of the first 8 units of a 1 MiB string spends fewer steps than one of the whole string.
    - `many_slices_of_a_large_string_exhaust_the_default_budget`: the request's 58 calls return `limit-exceeded` with default limits.
    - `expression_results_are_unchanged`: the existing expression table still passes.

  - Notes (executed 2026-11-22):
    - Operator-specific rates now charge the existing step counter for string units and collection entries read and written. Dynamic array guards charge before scanning, and `$findIndex` charges only visited entries. String `$slice` scans code points through the requested end. Native `$split` reserves fuel for its upper bound on output entries and caps its allocation at the first disallowed entry.
    - The scaling, short Unicode slice and 58-slice regressions failed on the baseline and pass with the new pricing. The expression suite also checks guard fuel before array reads and early exit in `$findIndex`. Spec §7.6, the template guide and the changelog describe the pricing rule.
    - At the three benchmark input sizes, the worst operator cost 15.00 ns per step against a 25 ns budget. The old 1 MiB Unicode slice measured 1,897.37 ns per step. The first `agent-home` selection used 6,135 steps before and 6,964 after, and the measured render cost was 2.650 µs per node against a 3 µs budget.
    - The separate install-validation benchmark measured 5.768 ms CPU on the baseline and 6.423 ms after the change against its 5 ms budget. Task 4 owns that gate. Task 5 owns the whole-render bound under the default step budget.
    - The focused expression suite passed all 176 tests. The full check passed with 2,138 tests and 6 skips using `timeout 1500s bun run check --timeout=15000 --retry=3 --bail=1`. Earlier runs hit MCP and browser timeouts under load. The affected MCP cases and browser scenario also passed in isolation.

- [x] Task 4: Reject at install a template whose data-free expansion exceeds the node limit (LF-18)
  - Acceptance Criteria:
    - Functional:
      - `validateTemplate` computes, per component, the fewest elements it always emits: an element counts one plus its unconditional children, a `$use` adds its callee's count, and anything under `$if` or `$each` counts zero. Arithmetic saturates at the limit plus one.
      - A template whose root count exceeds the limit is `limit-exceeded` at the `$use` or element that crosses it. The limit is `limits.nodes` when the caller passes one (a new optional field on the validation context), else the default 5,000.
      - `pack()` and `verifyPackage()` apply it, so the request's reproduction is refused at install and on load.
      - Finding to settle first: `verifyPackage` runs on every load. A host that renders with a raised `limits.nodes` and already stores a template between 5,000 and its limit would see that package refused on load. The executor confirms with the owner that `pack` and `verifyPackage` take the host's limit from their install argument, and documents it. If that needs a `changed` entry, the load-time half moves to 0.5.0 and only `validateTemplate` and `pack` ship here.
      - Spec §7.6 lists the check with the other install-time bounds.
    - Performance: warm `validateTemplate` on `agent-home` stays within its 5 ms CPU budget (`validateTemplate.agentHome.cpuMs` in `bench/template.bench.ts`). The count reuses the memo of `checkGraph`.
    - Code Quality: one more value in the per-component record `checkGraph` already builds (`src/template/document.ts:256-281`); no second traversal of the template.
    - Security: law 2 at install: a document that cannot render inside the limits is rejected before it is stored.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/formats.md` for install-time validators and corpus chores.
    - Library Documentation to Check Before Implementation:
      - none; read `src/template/document.ts:100-106`, `:245-281`, `:856-859` and `src/pack/verify.ts:27-67`.
    - Documentation Reviewed:
      - `TEMPLATE_LIMITS` (`src/template/document.ts:100-106`): `useDepth: 16`, `components: 64`, `nodes: 10_000` (document nodes, not emitted ones). The graph check bounds height only, as the request says.
      - `graft callers validateTemplate`: `validatePackageInputs` (`src/pack/verify.ts:27-67`), the corpus runner and the tests.
    - Options Considered:
      - Count the maximum expansion — rejected: it depends on data, and `$each` makes it unbounded.
      - Run `renderTemplate` with empty inputs at install — rejected: inputs must fit the manifest's schemas, so there is no "no data" render in general.
    - Chosen Approach:
      - Record unconditional emissions during the existing walk and sum them in the component graph memo. A component use contributes its minimum at the call site.
      - Use one optional install option for direct validation, packing and verification. Forward existing host and preview node limits and include the effective limit in the stored-package verification cache key.
    - API Notes and Examples:
      ```ts
      validateTemplate(template, { catalog, capabilities, manifest, limits: { nodes: 5000 } });
      // For an oversized component used at the widget root, the error points to "/root/$use".
      ```
    - Files to Create/Edit:
      - `src/template/document.ts`: the count and its rejection; the optional `limits` on `Context`.
      - `src/pack/verify.ts`, `src/pack/pack.ts`: share and document the optional install limit.
      - `src/host/render.ts`, `src/host/intent.ts`, `src/preview/session.ts`: forward the existing host or preview limit.
      - `src/store/verified.ts`: key verification results by the effective node limit.
      - `bench/template.bench.ts`: align install validation's runtime warmup with the render benchmark.
      - `src/__tests__/template-document.test.ts`, `src/__tests__/template-package.test.ts`, `src/__tests__/host-render.test.ts`: the tests below.
      - `scripts/release/api/register-0.4.1.json`: `widened` entries for `validateTemplate`, `pack` and `VerifyOptions`.
      - `docs/spec.md` §7.6; `docs/templates.md`; `CHANGELOG.md`.
  - Test Cases to Write:
    - `static_fan_out_over_the_node_limit_is_rejected_at_install`: the reproduction at 10 and 16 components fails `validateTemplate` with `limit-exceeded`. Fails if the count ignores `$use`.
    - `conditional_and_repeated_bodies_count_zero`: the same shape under `$if` or `$each` installs.
    - `a_raised_node_limit_admits_a_larger_template`: a 6,000-element static template fails by default and passes with `limits.nodes: 8000`.
    - `pack_refuses_a_template_over_the_limit`: `pack()` returns the same error.
    - `verify_and_load_use_the_install_node_limit_even_with_a_warm_cache`: verification accepts a raised limit and a cache entry from that limit cannot satisfy a lower one.
    - `preview_packing_uses_its_node_limit` and `host_applies_its_node_limit_before_invoking_the_runner`: the existing host and preview options apply before rendering.
    - `static_node_limit_points_to_the_first_crossing_element` and `invalid_install_node_limit_is_rejected`: report the crossing and reject malformed limits.

  - Notes (executed 2026-11-23):
    - The existing install walk records unconditional elements, fragments and component uses. The graph check memoizes each component's minimum and saturates the count at the node limit plus one. A component use reports its call-site pointer when its contribution crosses the limit.
    - Packing and verification share the optional install limit. The host pipeline and preview forward their configured limits, and stored-package verification keys include the effective budget. The API gate accepted the three widenings.
    - The install benchmark now takes 200 warmup calls, matching the render benchmark and moving runtime warmup outside the timed samples. The final template benchmark measured 2.034 ms CPU against the 5 ms install target and met its other thresholds.
    - All 224 focused tests passed. `bun run check` passed with 2,151 tests passed, 6 skipped and 0 failed.

- [x] Task 5: Add hostile-template corpus cases and gate the worst render the default budget allows (LF-18)
  - Acceptance Criteria:
    - Functional:
      - `conformance/corpus/template/` gains: a static fan-out (rejected at install by Task 4), a `$use` chain at the depth limit (valid) and one past it (`limit-exceeded`), and string doubling followed by `$slice`.
      - The string case installs successfully and fails at render. Its optional `render` member supplies widget inputs, optional limits and the expected outcome. The corpus test runs it through `renderTemplate` after install validation, as documented in `docs/conformance.md`.
      - `bench/template.bench.ts` gates the request's reproduction at 10 and 16 components: `limit-exceeded` with default limits, a warm median under 5 ms and median resident growth under 1 MiB per call. The maximum sampled resident growth is also recorded.
      - The bench records the slowest warm median across the hostile set (fan-out, nested `$map`s over 1,000 items, the `$slice` case) under the default budget and gates it at 50 ms. The evidence records the measured headroom.
    - Performance: this task is the gate. `plans/evidence/041-template-cost.md` holds the before and after tables in the request's format.
    - Code Quality: the hostile templates are built by one helper shared by the test and the bench; the reproduction script from the request is kept as that helper's source.
    - Security: the gate keeps the claim plan 042 writes into `docs/security.md`: a bound on one render's cost under the default budget.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/formats.md` for corpus chores.
      - `verify-and-stop` — this task proves Tasks 2–4; it changes no behaviour.
    - Library Documentation to Check Before Implementation:
      - none; read `docs/conformance.md` (the corpus case shape), `conformance/corpus/template/cyclic-use.json` and `bench/metrics.ts`.
    - Documentation Reviewed:
      - The request's reproduction and table (LF-18); `docs/security.md:18-22` (the three statements plan 042 corrects); `src/__tests__/api-stability.test.ts:348` (`new_corpus_case_accepts_only_an_added_register_entry`).
    - Options Considered:
      - Assert the 5 ms and 1 MiB figures in `bun run check` — rejected: plan 033 moved wall-clock assertions out of the check.
      - Keep the hostile cases as unit tests only — rejected for the install-time cases: ports of the validator need them, which is what the corpus is for.
    - Chosen Approach:
      - Corpus cases for the install boundaries and an optional `render` member for the string case. Deterministic tests assert budget failures, and the bench gates time and memory.
    - API Notes and Examples:
      ```bash
      timeout 300 bun --conditions liveframe:source bench/template.bench.ts
      ```
    - Files to Create/Edit:
      - `conformance/corpus/template/*.json` and `conformance/corpus/template/docs/*.json`: the new cases and their documents.
      - `src/__tests__/corpus.test.ts`: run the optional render expectation and assert which default budget each workload exhausts.
      - `src/__tests__/fixtures/hostile-templates.ts`: the shared builder.
      - `bench/template.bench.ts`: the gates.
      - `scripts/release/api/register-0.4.1.json`: `added` entries for the corpus files.
      - `docs/conformance.md`, `CHANGELOG.md` and `plans/evidence/041-template-cost.md`.
  - Test Cases to Write:
    - Corpus cases `expansion-over-node-limit`, `use-chain-at-depth-limit`, `use-chain-over-depth-limit`, `string-doubling-then-slice`: each fails if its bound is removed.
    - `hostile_template_set_is_bounded`: the shared render workloads return `limit-exceeded` for the intended node or step budget.
  - Notes (executed 2026-11-23):
    - Added four corpus cases and registered their eight new files as additive. The string case uses the optional render expectation to pin the `$slice` error pointer after a successful install. The shared fixtures drive the deterministic render test and the bench.
    - With default limits, the 10- and 16-component fan-out cases took 1.295 ms and 0.799 ms respectively, with median resident growth of 0.375 MiB and 0.000 MiB. The slowest workload was nested maps at 5.157 ms against the 50 ms gate. Plan 042 can cite the [measurement and its scope](evidence/041-template-cost.md) for LF-65.
    - The 317 focused tests, the template benchmark with gates enabled and `bun run check` passed. The full check reported 2,152 passed, 6 skipped and 0 failed.

- [x] Task 6: Keep text a widget throws out of host errors and events (LF-21)
  - Acceptance Criteria:
    - Functional:
      - A value thrown by widget code that is not a `LiveframeFailure` is reported as `render-failed` with `message: "Widget threw <name>"`. A top-level throw has pointer `""`. A composed component retains its node pointer and ID. `<name>` comes from a closed list of built-in error names, else `Error`; a thrown non-error is `a non-Error value`.
      - Widget code can assign any error name. Use only the closed list for public messages.
      - `RunnerOptions.debug?: boolean` (default off) asks for the original text. It arrives as `LiveframeError.debug`, at most 1,000 characters, documented on the type as untrusted author text. With `debug` off, runner results omit the field and `renderPlacement` drops any a runner returns.
      - Preview sessions, `/authoring`, the MCP tools and `checkPackages` scenario checks pass `debug: true`, because the draft's author is the reader, and return the text in `debug`.
      - The changed case: the widget that throws `new Error(JSON.stringify(inputs))`. Under `inProcessRunner`, `workerRunner`, `templateRunner` and `quickjsRunner`, the failure result and `HostEvent` hold no input text. `templateRunner` refuses the code package at `/code`.
      - The promise at `HostEvent` in `src/host/types.ts` has a test.
      - Finding to report: a runner that crosses a boundary returns errors the host cannot tell from widget-authored ones (a sandboxed widget can produce a typed error with any message; `packages/runner-quickjs/src/result.ts:58-82` bounds them at 21 errors of four 1,000-character fields but does not check content). Node ids also carry author-chosen keys. This task closes the thrown-text path the request names. The executor lists the remaining paths in `plans/evidence/041-impact-analysis.md` for plan 042's checklist (LF-65).
    - Performance: no work on the success path; `bench/host.bench.ts` and `bench/runner.bench.ts` hold their budgets.
    - Code Quality: the SDK, runner kit, in-process loader, worker crash handler and package checks share one thrown-value formatter. Host-authored errors retain their diagnostics. QuickJS classifies native limits before dropping unrequested debug text.
    - Security: default host results and events omit thrown widget text, which can contain state, params, source data, intent arguments or action values. An explicit debug opt-in is required to return it.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/storage.md` (runners and the host pipeline).
      - `surgical-patch` — the failing test first.
    - Library Documentation to Check Before Implementation:
      - none; read the SDK catch, loader and transport boundaries and the QuickJS result parser.
    - Documentation Reviewed:
      - Confirmed the request's path: `renderWidget`'s catch (`src/runner-kit/render.ts:72-78`), then `failed("render-failed", rendered.errors)` (`src/host/render.ts:222-225`, `:272`). `graft grep "errorMessage\("`: 17 hits in 9 files.
      - `runWidget` (`src/host/render.ts:120-135`) already replaces a thrown runner with the fixed "Runner failed".
    - Options Considered:
      - Strip messages in `renderPlacement` for every runner error — rejected here: it changes library-authored validation messages hosts log today, which is an outcome change beyond the named defect. Reported as a finding.
      - Put `debug` on the `HostEvent` only — rejected: the text has to travel from the runner in the error, so the field lives there and the event carries it.
      - Keep the message in preview and authoring — rejected: one rule for the field is simpler, and agents read `debug` from the same error object.
    - Chosen Approach:
      - A fixed message at every catch of widget-thrown values, an opt-in bounded `debug` field, on by default only where the author is the reader.
    - API Notes and Examples:
      ```ts
      await renderPlacement({ …, runOptions: { debug: true } });
      // → errors: [{ kind: "render-failed", pointer: "", message: "Widget threw TypeError", debug: "x is not a function" }]
      ```
    - Files to Create/Edit:
      - `src/internal.ts`: the helper. `src/errors.ts`: `debug` on `LiveframeError`. `src/preview/runner.ts`: `RunnerOptions.debug`.
      - `src/sdk/render.ts`, `src/runner-kit/render.ts`, `src/preview/in-process.ts`, `src/preview/worker/runner.ts` and `src/pack/check.ts` for exception and result handling.
      - `packages/runner-quickjs/src/{index,protocol,result,runtime}.ts` for sandbox exceptions, native limits and the bounded debug field.
      - `src/host/render.ts`: drop an unrequested `debug`. `src/host/types.ts`: the doc comment.
      - `src/preview/session.ts`, `src/authoring/{index,checks}.ts` and `src/cli/mcp.ts` for author diagnostics, error deduplication and MCP output schemas.
      - `scripts/release/api/register-0.4.1.json` for the widened options and error type.
      - `docs/{host,mcp,packages,preview,sdk}.md`, a pointer in `docs/security.md`, `docs/spec.md` §7.5, §7.7 and §10, `CHANGELOG.md` and `plans/evidence/041-impact-analysis.md`.
  - Test Cases to Write:
    - `thrown_widget_text_never_reaches_a_host_event`: for each reference runner, a widget throwing its inputs yields an event and result whose JSON contains no input value. Fails if any catch copies the message.
    - `quickjs_thrown_text_is_not_returned` (in the runner package): the same through `quickjsRunner`.
    - `worker_debug_returns_bounded_thrown_text_only_when_asked` and `render_placement_drops_unrequested_runner_debug`: requested debug has at most 1,000 characters and the host omits unrequested runner debug.
    - `thrown_name_outside_the_closed_list_is_Error`: a widget-set `name` is not echoed.
    - `preview_returns_thrown_text_in_debug`, `render_scenarios_returns_tree_or_errors` and `scenario_errors_keep_distinct_debug_text`: the draft author can still read each exception.
  - Notes (executed 2026-11-23):
    - Implemented fixed widget exception messages and the bounded debug opt-in across the SDK, host, reference runners and authoring surfaces. QuickJS uses its internal exception details to preserve native heap and stack limit classification. The host drops unsolicited debug without evaluating it.
    - Eighteen focused checks passed, including the host event regression, QuickJS, Worker, MCP and the 0.4.x API register. CPU-pinned runs of both benchmark gates passed. Host pipeline overhead measured 0.084 ms against 0.2 ms and the fresh QuickJS agent-home median measured 84.7 ms against 110 ms. The corresponding baseline observations were 0.143 ms and 115.1 ms under shared host load.
    - The full check remains open. During the aggregate run, `cli_prints_report` and `preview_session_packs_a_draft_that_imports_a_supplied_library` failed after retries. Both passed outside the aggregate run on the changed tree and the baseline. Aggregate runs also encountered browser harness timeouts, and the final run reached its 900-second shell deadline.
    - Structured-error channels for LF-65 are recorded in the [impact analysis](evidence/041-impact-analysis.md#task-6--widget-exception-diagnostics-lf-21).
    - The full check passed during Task 11's run. The working tree included this task's uncommitted changes. `timeout 1800 bun run check` passed with 2,181 tests passed, 6 skipped and 0 failed. The earlier aggregate failures did not recur.

- [x] Task 7: Bound the A2UI converter's allocations (LF-25)
  - Acceptance Criteria:
    - Functional:
      - `updateDataModel` refuses a numeric path segment beyond the end of the array it writes into, with a typed error at the message's pointer, and counts every written value against the existing value bound (`limits.nodes * 8`, `packages/a2ui/src/index.ts:154`).
      - `format` bounds its output: one formatted string and the conversion's total formatted text stay under the character bound the input already has (`4 * limits.bytes`, `:134-135`). Over it is `limit-exceeded`.
      - A pointer has a bounded number of segments, and any error thrown inside the conversion that is not the converter's own `Stop` becomes a typed error with a fixed message. `fromA2ui` throws only for a malformed `mapping` argument, as today.
      - Regression fixtures for the request's three failure modes return errors at the offending A2UI pointer.
    - Performance: `bench/a2ui.bench.ts` gates representative sparse-index, formatted-text and deep-pointer cases at median under 10 ms and under 1 MiB of resident growth, and retains the existing valid-surface row.
    - Code Quality: the bounds use the `Limits` the converter already resolves (`:113`); no new option.
    - Security: law 2 for the converter's input: a hostile document yields errors, not a tree and not an uncaught `RangeError`. This is the bound `docs/security.md:119` already promises.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — package rules for companions.
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - [A2UI v0.9](https://github.com/a2ui-project/a2ui/blob/v0.9/specification/v0_9/docs/a2ui_protocol.md#server-to-client-updates) and [v0.9.1](https://a2ui.org/specification/v0.9.1-a2ui/#server-to-client-updates) describe JSON Pointer upserts and give no rule requiring gaps in an array.
    - Documentation Reviewed:
      - Confirmed: `setIn` writes `copy[index]` for any numeric segment (`packages/a2ui/src/index.ts:296-313`); `format` joins unbounded parts (`:780-807`); `fromA2ui` rethrows anything but `Stop` (`:115-126`).
    - Options Considered:
      - Allow sparse writes up to the value bound and fill with `null` — rejected unless the A2UI text requires it: a hole is not JSON, and filling allocates what the bound exists to prevent.
      - Catch every error silently — rejected: the catch maps `RangeError` to `limit-exceeded` and anything else to one fixed `invalid-document`, so a converter bug is still visible as a failure.
    - Chosen Approach:
      - Allow replacement and dense append. Charge copied and inserted values as updates run. Bound read and write pointers before splitting them in full, and charge literal text and interpolated JSON before joining. Return typed failures for unexpected conversion errors.
    - API Notes and Examples:
      ```ts
      fromA2ui('{"updateDataModel":{"path":"/a/99999999","value":1}}', mapping);
      // → { ok: false, errors: [{ kind: "limit-exceeded", pointer: "/0/updateDataModel/path", … }] }
      ```
    - Files to Create/Edit:
      - `packages/a2ui/src/index.ts`: input collection, data-model writes and pointer reads, formatting, and the `fromA2ui` catch.
      - `packages/a2ui/src/__tests__/a2ui.test.ts`: the tests below.
      - `bench/a2ui.bench.ts`: the three gated rows.
      - `packages/a2ui/README.md` (the bounds); `CHANGELOG.md`.
  - Test Cases to Write:
    - `sparse_array_index_is_refused`: fails if `setIn` writes past the end.
    - `data_writes_share_a_value_budget`: successive updates exhaust one shared allowance.
    - `formatted_output_is_bounded` and `formatted_json_charges_escaped_characters`: enforce the character budget for one result and for aggregate output, including JSON escaping.
    - `deep_pointer_returns_a_typed_error`: no `RangeError` escapes.
    - `unexpected_conversion_errors_are_typed_and_hide_thrown_text`: failures return fixed messages and malformed mappings still throw.
    - The existing conversion fixtures give the same element JSON.
  - Notes (executed 2026-11-23):
    - Dense replacement and append still convert. The converter rejects sparse indices, counts allocated data-model values across updates, and limits data-model reads and writes to 128 pointer segments. A shared budget charges formatted output before joining it, including JSON escaping. Unexpected errors produce fixed typed diagnostics.
    - All 40 A2UI tests passed. The sparse-index, formatted-text and deep-pointer cases took median 0.019, 0.158 and 0.060 ms, with median RSS growth of 0, 256 and 0 KiB. The original audit inputs were unavailable. The benchmark uses representative fixtures and a 48 KiB byte setting. The 499-component row measured 2.533 ms at the baseline and 2.602 ms with the patch.
    - `bun run check` passed in an isolated checkout containing the Task 7 patch, with 2,158 passed, 6 skipped and 0 failed. The shared checkout's run had one mismatch in `text_results_match_expected_contract` from the Task 6 error-message changes. That test passed in the isolated checkout.

- [x] Task 8: Bound inline drafts by file count and bytes before any transpile (LF-26, bounds half)
  - Acceptance Criteria:
    - Functional:
      - `pack_draft` and every `/authoring` operation that takes an inline draft refuse, with `limit-exceeded` at `/files`, a draft with more than 64 source files or 1,048,576 aggregate bytes of UTF-8 source text. The manifest, scenarios and template share a separate 1,048,576-byte compact JSON budget, with up to 512 nested containers per document. The document that crosses a bound supplies the error pointer.
      - The check runs before `validateManifestShape`, before `pack()` and before any transpile. It checks source string lengths before scanning UTF-8 bytes and stops on budget exhaustion. It counts document bytes with the shared validator walker, without copying or stringifying input.
      - The changed case: a 9 MiB inline draft. Today it is transpiled. It is now refused.
      - Not in this task: refusing to start without an explicit `runner` or `trustDrafts`. That changes a default and is plan [043](043-Phase-7-Part-AD-Release-0-5-0-Scope-Stored-Documents-And-Content-Integrity.md) (LF-26). Finding for that plan: `mcp()` supplies the `workerRunner()` default (`src/cli/mcp.ts:543`), while `createAuthoring` reads `runner` from its options (`src/authoring/index.ts:472`); plan 043 confirms which of the two the request's claim covers.
    - Performance: source counting stops at the file or byte limit and rejects a source in constant time when its string length alone exceeds the remaining budget. The bench gates median resident growth below 1 MiB for a 9 MiB draft refusal.
    - Code Quality: one constant shared with `src/cli/draft-dir.ts`; the bounded byte counter the validator already uses, not a new walker.
    - Security: the authoring boundary (spec §13): draft text is untrusted input, bounded before the host spends memory on it.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/preview.md` (preview sessions, `/authoring` and the MCP server).
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - none; read `src/authoring/index.ts:138-191` and run `graft callers draftBodyErrors --depth all` to find every entry that accepts a draft.
    - Documentation Reviewed:
      - Confirmed: `packArguments` (`src/authoring/index.ts:166-190`) bounds scenarios at 64 and nothing else. Draft directories are bounded at 1 MiB (`src/cli/draft-dir.ts:74`, `:86`).
      - `validateTemplateShape` bounds a template at 1 MiB, but stringifies it to measure (`src/template/document.ts:832-846`).
    - Options Considered:
      - New `maxDraftBytes` and `maxDraftFiles` options — rejected: the directory path has a fixed bound and no host has asked to raise it; an option can be added later without a break.
      - Bound in the MCP transport — rejected: `/authoring` is also called directly.
    - Chosen Approach:
      - Preflight inline drafts in `packArguments` with the existing UTF-8 counter and the validator's JSON walker. Limit the recursive JSON walk to 512 levels so a small, deeply nested document returns a typed error. Share the byte constant with the directory reader, which marks inputs it has already bounded to preserve its existing 128-file and aggregate read limits.
    - API Notes and Examples:
      ```ts
      // → { ok: false, errors: [{ kind: "limit-exceeded", pointer: "/files", message: "Draft exceeds 1048576 aggregate bytes" }] }
      ```
    - Files to Create/Edit:
      - `src/authoring/index.ts`: the bound in `packArguments` and any sibling entry.
      - `src/authoring/draft-limits.ts` and `src/cli/draft-dir.ts`: the shared byte limit and internal directory marker.
      - `src/validate/structure.ts`: an optional depth ceiling for the existing JSON byte walk.
      - `src/__tests__/authoring.test.ts` and `src/__tests__/cli-mcp.test.ts`: inline limits and directory compatibility.
      - `bench/authoring.bench.ts`: memory growth during refusal.
      - `docs/mcp.md`, `docs/preview.md` (the bounds); `docs/spec.md` §13 if it lists draft limits; `CHANGELOG.md`.
  - Test Cases to Write:
    - `oversized_inline_draft_is_refused_before_transpile`: a transpiler spy records no call. Fails if the check moves after `pack()`.
    - `too_many_draft_files_is_limit_exceeded`: 65 one-byte files.
    - `draft_at_the_bound_packs`: exactly 1,048,576 bytes in 64 files still packs.
    - `oversized_manifest_scenarios_or_template_is_refused`: compact JSON escaping and the shared document budget report the field that crossed it.
    - `inline_draft_document_preflight_bounds_nesting`: deeply nested input returns a typed limit error.
    - `pack_draft_refuses_oversized_inline_files_and_keeps_the_current_draft` and the existing `pack_dir_accepts_exact_read_bounds`: tool propagation, draft retention and directory compatibility.
  - Notes (executed 2026-11-23):
    - Inline drafts now return typed limit errors before manifest validation and packing. The boundary counts 64 source files and 1 MiB of UTF-8 source, plus a separate 1 MiB of compact JSON across the draft documents. The JSON byte walk stops at 512 nested containers. Directory drafts retain their existing read limits.
    - Seven focused regressions passed. The transpiler and manifest validation spies recorded zero calls for the oversized draft, and `bench/authoring.bench.ts` measured 0 bytes of median RSS growth for the 9 MiB refusal.
    - `bun run check` passed on Task 8 in isolation with 2,164 passed, 6 skipped and 0 failed. The shared worktree's full run had one failure in `text_results_match_expected_contract` from the existing Task 6 diagnostics changes. The snapshot passed on the isolated Task 8 tree.

- [x] Task 9: Fix four core defects: lone surrogates, `pattern` after a failed length, `__proto__` sections, refusals over a recorded status (LF-27, items 1–4)
  - Acceptance Criteria:
    - Functional:
      1. A lone surrogate in one source's data no longer fails the placement. `renderPlacement` gives that alias the `failed` outcome, reports `source-failed` with reason `invalid-result`, and renders. One in `params`, `state` or `context` is a typed `render-failed` error with the pointer of the input that holds it. Today both end as `invalid-document` at `""` (`src/host/render.ts:301-305`).
      2. A string that fails its length check is not tested against `pattern` (`src/validate/schema.ts:130-132`). The value is still rejected, with the length error.
      3. `__proto__`, `constructor` and `prototype` are refused as names in an element's `props`, `style` and `events` sections, and `merge` (`src/sdk/element-node.ts:76-90`) cannot replace the merged record's prototype. The template emitter's `record[name] = value` (`src/template/render.ts:337-341`) is covered by the same test.
      4. `refuseOffered` (`src/host/intent.ts:167-179`) does not write a refusal over an action status that is already recorded under the key the node offers, and triggers no render in that case.
      - Each is the defect the request names; no valid input changes outcome.
    - Performance: item 1 adds no work to a render without a lone surrogate: the alias search runs only after the hash has thrown. Items 2–4 remove work. `bench/host.bench.ts` and `bench/validator.bench.ts` hold their budgets.
    - Code Quality: each fix is local to the cited lines. Item 2 must not change any existing corpus expectation: the executor greps the corpus for a case that expects both a length and a pattern error at one pointer, and stops under compatibility rule 3 if one exists.
    - Security: law 2 (items 2 and 3: validation cannot be made to do unbounded or prototype-changing work) and law 4 (item 4: a crafted intent cannot change what the host recorded for a real action).
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/storage.md` and `references/formats.md`.
      - `surgical-patch` — one regression test per defect, written first.
    - Library Documentation to Check Before Implementation:
      - none; read the cited lines, `fitData` (`src/host/render.ts:94-118`) and `admit` (`src/host/intent.ts:57-66`).
    - Documentation Reviewed:
      - `src/pack/hash.ts:3-17`: the lone-surrogate flag makes `digest` throw a `TypeError` after the walk; `renderKey` is called at `src/host/render.ts:250`.
      - `mergeSections` (`src/sdk/element-node.ts:96-111`) spreads `props` (safe) and assigns `style` and `events` names (the setter path).
      - Spec §7.7 R5 (source outcomes) and H2 (refusals).
    - Options Considered:
      - Test every data string for surrogates in `fitData` — rejected: a regular-expression pass over all data on every render, for an input that is almost never present.
      - Build the merged record with a null prototype — rejected as the only fix: later code may expect an ordinary object; rejecting the three names is the visible rule, and `Object.defineProperty` in `merge` is the backstop.
    - Chosen Approach:
      - Handle the hash failure where it is caught, skip `pattern` on an invalid length, refuse the three names, and check for an existing entry before `admit`.
    - API Notes and Examples:
      ```ts
      if (lengthFits && pattern && !pattern.test(value)) valid = reject(at, sink, patternExpected);
      ```
    - Files to Create/Edit:
      - `src/host/render.ts` and `src/pack/hash.ts` for hash recovery and identifying lone-surrogate errors.
      - `src/validate/schema.ts` and `src/schema.ts` for compiled validation and `checkValue`.
      - `src/sdk/element-node.ts` and `src/template/render.ts` for element JSON, template install validation and direct template rendering.
      - `src/host/intent.ts` for refusals of posted intents that fail the offered check.
      - `src/__tests__/host-render.test.ts`, `schema.test.ts`, `sdk-elements.test.ts`, `host-intent.test.ts`: one regression test each.
      - `docs/spec.md` §7.7 (R5 and H2 wording), §10 (reserved section names); `docs/host.md`; `CHANGELOG.md`.
  - Test Cases to Write:
    - `lone_surrogate_in_source_data_fails_that_source_only`: one bad row gives a rendered tree, a `failed` outcome for the alias and a `source-failed` event.
    - `pattern_is_not_run_on_a_string_over_its_length`: both schema checkers report only the length error for an out-of-bounds string that also fails the pattern. The host intent test exercises an out-of-bounds action argument.
    - `proto_section_names_are_refused`: an own `__proto__` key in `style` and in `events` is an error, and `Object.getPrototypeOf` of the merged record is unchanged.
    - `crafted_refusal_does_not_overwrite_a_recorded_action_status`: a pending status stays pending and a runner spy records no render.
  - Notes (executed 2026-11-23):
    - Canonical hashing recovers malformed source values with a schema-accepted `failed` outcome for each affected alias. Otherwise the host returns a typed error at the alias or affected render input. Both string validators skip `pattern` after a length failure. Element JSON and the template install and render paths reject the three prototype names. A failed offered check preserves the recorded action status and skips rendering.
    - All four regressions failed before the fixes. The Task 9-only focused rerun passed 97 tests, including the regressions, corpus cases, hash vectors and API stability. The shared-checkout `bun run check` passed with 2,174 passed, six skipped and zero failed. Later aggregate reruns hit MCP failures under load. All affected MCP cases passed when rerun in both checkouts.
    - The host benchmark passed at 0.111 ms of pipeline overhead against a 0.2 ms budget. Validator wall-clock misses occurred with the patch and at baseline `190e45d`. Validator CPU gates passed in the completed runs. Wall-clock confirmation remains open for the whole-plan verification.

- [x] Task 10: Fix two authoring defects: hard links under `draftRoot` and host text in capture errors (LF-27, items 5–6)
  - Acceptance Criteria:
    - Functional:
      5. `readDraftDirectory` opens each draft file, reads its status from the open handle, and reads the bytes from that handle. It refuses a file that is not regular, that has more than one link, or whose device and inode differ from the contained path it checked. A hard link inside `draftRoot` to a file outside it is `invalid-document`, and a symlink swapped between the check and the read cannot be followed.
      - Finding: the request proposes "open drafts through a handle and compare the real path". A hard link has a real path inside the root, so the path comparison cannot see it; the link count on the handle does. The handle read also closes backlog "Read draft directories through an open handle" (P4).
      6. `playwrightBackend` returns fixed messages for a missing browser and a page that cannot be opened (`src/preview/capture/playwright.ts:11-15`, `:21-23`). No Playwright error text, path or URL is appended. Error kinds stay `not-found`.
    - Performance: n/a — authoring-time file reads and error paths.
    - Code Quality: the reader keeps every error `kind` and `pointer` it has today. No new dependency.
    - Security: the authoring boundary (spec §13): a draft directory read never leaves `draftRoot`, and an MCP client never receives host paths.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — the CLI may use host APIs (`references/liveframe.md` §3 probe 2).
      - `find-docs` — Bun's `node:fs/promises` `open`, `FileHandle.stat` and `FileHandle.read`.
    - Library Documentation to Check Before Implementation:
      - Bun ≥ 1.4.2 (`engines.bun`): `node:fs/promises` `open()` and `FileHandle#stat()`/`#read()`; whether `O_NOFOLLOW` is honoured. Look up with `bunx ctx7@latest library Bun "node:fs/promises FileHandle stat"` before coding.
      - Playwright (peer `^1.49.0`): nothing new is called.
    - Documentation Reviewed:
      - `src/cli/draft-dir.ts:59-88`: `realpath`, `contained`, `lstat`, then a read by path. `plans/backlog.md` "Read draft directories through an open handle" (the `dev`/`ino` comparison and why not to look up a handle's path).
      - `docs/mcp.md` (the `draftRoot` trust model).
    - Options Considered:
      - Refuse any file with a link count above one without a handle — rejected: it leaves the check-then-read race the backlog entry describes.
      - Keep the Playwright text behind a debug option — rejected: the operator already sees it in the server's own logs; the tool result does not need it.
    - Chosen Approach:
      - One open per file, all checks on the handle, read from the handle; two fixed capture messages.
    - API Notes and Examples:
      ```ts
      const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      const info = await handle.stat();
      if (!info.isFile() || info.nlink !== 1 || info.ino !== checked.ino || info.dev !== checked.dev) return refuse();
      ```
    - Files to Create/Edit:
      - `src/cli/draft-dir.ts`; `src/preview/capture/playwright.ts`.
      - The test file that covers `readDraftDirectory` (tentative — find it with `graft callers readDraftDirectory`) and `src/__tests__/preview-capture.test.ts`.
      - `docs/mcp.md`; `plans/backlog.md` (close the handle entry); `CHANGELOG.md`.
  - Test Cases to Write:
    - `hard_link_inside_draft_root_is_refused`: a hard link to a file outside the root fails. Fails if only the real path is compared.
    - `symlink_swapped_after_the_check_is_not_followed`: the swap test the backlog entry asks for.
    - `capture_errors_hold_no_host_text`: a backend whose launch and `goto` reject with path-bearing messages returns the fixed text.
  - Notes (executed 2026-11-23):
    - `readDraftDirectory` now opens each selected file with `O_RDONLY | O_NOFOLLOW | O_NONBLOCK` after the `realpath` containment check and an `lstat` that must show a regular file. `openDraftFile` refuses a handle that is not a regular file, has `nlink !== 1`, or whose `dev`/`ino` differ from the checked path, and `readInto` reads every file from its handle into one `MAX_DRAFT_BYTES + 1` buffer, so the aggregate bound still holds if a file grows. Every error keeps its `kind` and `/dir` pointer. `O_NONBLOCK` was added because a FIFO swapped in after the `lstat` would otherwise block the open. Bun 1.4.5 honours `O_NOFOLLOW` (`ELOOP`) and reports `nlink`, `dev` and `ino` on `FileHandle#stat()` (probed; ctx7 lists `node:fs` as fully implemented).
    - `playwrightBackend` returns fixed messages for a missing browser and an unreachable page. The "never became ready" message no longer names the URL either, a small addition in the same channel.
    - Tests: `src/__tests__/draft-dir.test.ts` (new) holds `hard_link_inside_draft_root_is_refused` and `symlink_swapped_after_the_check_is_not_followed`. The swap test spies on `lstat` to replace the file with an outside symlink between the check and the open, so it is deterministic. Both failed against the previous reader. `capture_errors_hold_no_host_text` is in `src/__tests__/preview-capture.test.ts`, and it needs the `liveframe:source` condition, which `bun run test` sets.
    - `bun run check`: build, gen, typecheck, lint and format passed. Tests: 2,174 passed, six skipped, four failed, all in `conformance-renderer-browser.test.tsx` under the aggregate load. That file passed 30/30 when rerun on its own, the same load pattern Task 9 recorded.
    - Spec §13 (`liveframe mcp` directory reads) and `docs/mcp.md` now describe the handle checks and the narrower trust model: a swapped file is refused, but a directory swapped above it is not covered. The backlog entry "Read draft directories through an open handle" is closed.
    - For Task 12: `captureFailure` (`src/authoring/index.ts:310`) still forwards the message of any error that is not a `CaptureError`, for example a Playwright launch failure other than a missing browser, as `render-failed`. That is another channel for host text in a tool result.

- [x] Task 11: Let the validator cache hold sixty-four catalogs (LF-34)
  - Acceptance Criteria:
    - Functional:
      - The catalog-level cache of `compileValidator` holds 64 `(catalog, capabilities)` pairs, least recently used evicted first, with a lookup that does not scan every entry.
      - Sixty-four distinct pairs compiled twice in turn compile 64 times in all, by `catalogCompileCount()`.
      - A hit still proves the content: an entry whose documents were changed after compiling is dropped, as today (`src/validate/compile.ts:278-288`).
    - Performance: `bench/validator.bench.ts` gains a row with 64 pairs that shows hits and records the hit and miss cost (recorded today: 0.19 ms and 0.72 ms). The existing `compileValidator` gate (≤ 0.25 ms on a hit) holds.
    - Code Quality: a `Map` keyed by the two document texts replaces the array scan; no public option. `MAX_CATALOGS` stays one named constant.
    - Security: law 2: a cache hit never returns checks compiled from different content. The existing mutation test still passes.
  - Approach:
    - Skills to Use:
      - `liveframe-execution` — `references/formats.md` (the compiled validator).
      - `surgical-patch`.
    - Library Documentation to Check Before Implementation:
      - none; read `src/validate/compile.ts:236-300`.
    - Documentation Reviewed:
      - Confirmed `MAX_CATALOGS = 8` (`src/validate/compile.ts:241`) and the linear scan with `unshift` and `pop` (`:273-299`). The comment at `:236-240` ties the bound to the scan cost, which a keyed lookup removes.
      - `src/store/verified.ts` memoises a canonical key for deeply frozen install documents; `packages/runner-quickjs/src/result.ts:86-88` keeps 64 validators.
    - Options Considered:
      - An option on `compileValidator` — rejected: a per-call option for a process-wide cache lets two callers disagree.
      - Key on the frozen document's identity — not chosen now: `Object.isFrozen` is shallow, so identity needs the deep-frozen proof `verified.ts` has. It removes the bound and the hit's stringify cost; it goes to Further Actions unless the bench shows the hit cost matters at 64.
    - Chosen Approach:
      - Keep the content-keyed design, make lookup constant-time, raise the bound to 64.
    - API Notes and Examples:
      ```ts
      const MAX_CATALOGS = 64;
      const catalogs = new Map<string, Map<string, CatalogEntry>>(); // catalog text → capabilities text → entry
      ```
    - Files to Create/Edit:
      - `src/validate/compile.ts`: the cache.
      - `src/__tests__/validator-smoke.test.ts` (it already uses `catalogCompileCount`).
      - `bench/validator.bench.ts`: the 64-pair row.
      - `docs/model.md` ("Performance": the bound); `CHANGELOG.md`.
  - Test Cases to Write:
    - `sixty_four_catalog_pairs_all_hit`: fails if the bound is below 64 or eviction is wrong.
    - `sixty_fifth_pair_evicts_the_least_recently_used`: the oldest pair recompiles, the others do not.
    - `a_changed_document_never_hits`: the existing guard, kept.
  - Notes (executed 2026-11-23):
    - `src/validate/compile.ts`: the cache is one `Map` keyed by the catalog text and the capabilities text joined by a newline, which JSON text never contains. `Map` insertion order is the use order: a hit deletes and re-sets its entry, and a miss beyond `MAX_CATALOGS = 64` deletes the first key. Both content checks are unchanged. A key match whose content differs (an `undefined`-valued key) leaves the entry in place. A compiled entry whose documents were mutated is dropped and recompiled. The single map replaces the nested map in the API notes because one map gives a single eviction order.
    - Tests in `validator-smoke.test.ts`: `sixty_four_catalog_pairs_all_hit`, `sixty_fifth_pair_evicts_the_least_recently_used` and `a_changed_document_never_hits`. With the bound set to 63, the first two failed. The four existing cache tests still pass.
    - `bench/validator.bench.ts` gains the 64-pair row. It asserts through `catalogCompileCount()` that every pass after the first one is a hit, then records `compileValidator.sixtyFourPairsHitMedianMs` and `…MissMedianMs`. It adds no gate. Under host load of about 14, the row recorded a 0.25 ms hit and a 0.91 ms miss with the cache full. The existing reused-catalog gate held at 0.235 ms, below its 0.25 ms limit. Under that load, the `core-queue.full` per-node gate and the bindings gate failed in one run. Neither gate covers this change.
    - Identity keying (Options Considered) is not carried to Further Actions. A hit across 64 pairs costs the same as a hit on one pair, because the cost is the key's `JSON.stringify` and the manifest's compile, not the lookup.
    - Docs: the eight-pair bound was stated in `docs/formats.md` "Validation", not in `docs/model.md`, so the bound was updated there and `model.md` was left unchanged. `docs/adopters-0.2.md` keeps its historical "eight". The spec does not state this bound. CHANGELOG has a Fixed entry.
    - The first full check failed format on one line in `compile.ts`, which was then formatted. The second failed nine Playwright tests with `Target page, context or browser has been closed` and one proof host session under host load of about 16. Those two files then passed 26 of 26. The final `timeout 1800 bun run check` passed with 2,181 tests passed, 6 skipped and 0 failed.

- [x] Task 11a: Give every 0.4.1 register entry a CHANGELOG line (impact findings F1 and F2)
  - Acceptance Criteria:
    - Functional: `CHANGELOG.md` names each widened declaration in `scripts/release/api/register-0.4.1.json`: `limits.nodes` on `validateTemplate`, `pack` and `VerifyOptions` (Task 4) and `debug` on `RenderOptions`, `RenderModuleOptions`, `RunnerOptions` and `HostWiring.runOptions` (Task 6). The three reasons that read "Adds optional the debug opt-in" read "Adds the optional debug opt-in".
    - Performance: n/a — documents.
    - Code Quality: register `change`, `task` and `hostAction` fields are unchanged; only reason text changes.
    - Security: n/a — no runtime path.
  - Approach:
    - Skills to Use: `liveframe-execution`.
    - Library Documentation to Check Before Implementation: none.
    - Documentation Reviewed: `register-0.4.1.json`; the Unreleased CHANGELOG section; `docs/templates.md` "Expressions"; `docs/sdk.md` error table.
    - Options Considered: none.
    - Chosen Approach: two `Added` entries, one per request, linking the guides that document them.
    - API Notes and Examples: n/a.
    - Files to Create/Edit: `CHANGELOG.md`; `scripts/release/api/register-0.4.1.json`.
  - Test Cases to Write:
    - none new; `api-stability.test.ts` and `docs-links.test.ts` pass.
  - Notes (executed 2026-11-23):
    - `CHANGELOG.md` gains two `Added` entries. "Install-time node limits for templates" names `validateTemplate`, `pack` and `VerifyOptions`. "An opt-in for thrown widget text" names `RenderOptions`, `RenderModuleOptions`, `RunnerOptions` and `HostWiring.runOptions`. The three register reasons now read "Adds the optional debug opt-in for LF-21."
    - `api-stability.test.ts` and `docs-links.test.ts` passed 20 of 20. Full checks for Tasks 11a and 11b together: the first failed format on two lines, which were then formatted. The second, at load ~16, failed only `capture_returns_png_snapshot_and_errors_per_cell`, the load-sensitive case with its own backlog entry; it passed 10 of 10 on its own. The final `timeout 1800 bun run check` passed with 2,182 tests passed, 6 skipped and 0 failed.

- [ ] Task 12: Analyze architectural impact and dispose of every finding
  - Acceptance Criteria:
    - Functional: `plans/evidence/041-impact-analysis.md` records each of the twelve impact areas, or `None — <reason>`. Findings go to the owner in one table with a recommended disposition; `execute` findings become tasks above this one, `backlog` findings go to `plans/backlog.md` and Further Actions. The sweep carries the findings written into Tasks 3, 4, 5, 6 and 10, and lists the remaining channels for author text in host errors (Task 6) for plan 042's checklist.
    - Performance: the sweep lists the template, host, runner, validator and A2UI bench rows before and after.
    - Code Quality: the sweep checks that every register entry has a CHANGELOG line, that no existing corpus file, hash vector or schema changed, and that no task used `removed` or `changed`.
    - Security: the sweep states, per task, the law or boundary it holds and the test that rejects a violation.
  - Approach:
    - Skills to Use:
      - `create-plan` — "Final task: impact analysis".
    - Library Documentation to Check Before Implementation:
      - none.
    - Documentation Reviewed:
      - `references/liveframe.md` §5; Task 1's decision.
    - Options Considered:
      - none beyond the standard sweep.
    - Chosen Approach:
      - One sweep after Task 11, including the MCP server, the demo host and the three companion packages.
    - API Notes and Examples:
      ```bash
      timeout 900 bun run check && timeout 600 bun run bench && timeout 300 bun run demo:test && timeout 300 bun run guide:test
      ```
    - Files to Create/Edit:
      - `plans/evidence/041-impact-analysis.md`; `plans/backlog.md`; `roadmap.md` §3; this plan's Compromises Made and Further Actions.
  - Test Cases to Write:
    - none new.

## Verification (whole plan)

- `timeout 900 bun run check`
- `timeout 600 bun run bench` (on a loaded host, the single stages: `bench/template.bench.ts`, `bench/validator.bench.ts`, `bench/host.bench.ts`, `bench/a2ui.bench.ts`, `bench/runner.bench.ts`)
- `timeout 300 bun test --conditions liveframe:source ./src/__tests__/template-render.test.ts ./src/__tests__/template-document.test.ts ./src/__tests__/corpus.test.ts ./src/__tests__/api-stability.test.ts ./src/__tests__/host-render.test.ts ./src/__tests__/host-intent.test.ts`
- `timeout 60 bun --conditions liveframe:source bench/authoring.bench.ts`
- `timeout 300 bun test --conditions liveframe:source packages/a2ui packages/runner-quickjs`
- `timeout 300 bun run demo:test` and `timeout 300 bun run guide:test`
- `timeout 300 bun run release:gate`

## Compromises Made

- To be filled after tasks are completed and tests pass.

## Further Actions

- To be filled after task completion with improvements, rationale, and priority.
