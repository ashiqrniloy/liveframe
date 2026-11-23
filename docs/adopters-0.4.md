# What 0.4.0 gives adopters

Use the [migration guide](migration-0.4.md) for upgrade steps and the [compatibility policy](compatibility.md#040) for the patch promise. Sections in the tables refer to the [specification](spec.md).

## Interaction

| Scope | Problem | Shipped API or behavior | Spec | Limit |
|---|---|---|---|---|
| F1 | A submit button needs immediate local feedback. | A `setState` or `action` can include `local` writes, optionally with `until: "revision"`. | §8 | One host intent and up to four local writes. Revision-scoped writes revert on the next accepted revision of the same surface. |
| F2 | A form needs to submit values collected locally. | `fromLocal` fills action arguments or a state value at emit time. | §8 | The renderer strips the directive. The host validates the completed intent. |
| F3 | A multi-select reports several values at once. | `carries: { array: { items, maxItems } }` declares a scalar array. | §§5, 8 | One scalar item type. Array carries cannot feed `bindAll` or a local write. |
| F4 | A new input needs focus after a render. | A tree `focus` mark names one always-rendered node. | §§9, 11 | Applies only to a changed mark on a later revision, within the surface. Custom primitives supply the focusable `domId`. |
| G2 | Concurrent state updates can lose a write. | `Store.putStateIf` gives `handleIntent` compare-and-set. | §§7.4, 7.7 | Optional store method. Four unsuccessful compares return a conflict. |
| G3 | A filtered list needs an empty state. | The read-only `shown` root counts visible conditional siblings. | §9 | Direct siblings only. Conditions that read `shown` do not contribute to the count. |
| G3 | An adapter needs to prove its local behavior. | Renderer conformance exercises local bindings, compound intents, `fromLocal` and focus. | §11 | Browser suites require the corresponding fixtures. |

## Rendering

| Scope | Problem | Shipped API or behavior | Spec | Limit |
|---|---|---|---|---|
| F5 | A slow source needs an honest loading state. | `sourceOutcome(result, { pending: true })` and the `source-pending` host event. | §§5, 7.7 | Each source declares the variant. A pending answer carries no value. |
| F6 | A surface needs enter, exit and reorder transitions. | Root rest recipes accept `motion`. Both adapters project it through CSS. | §§6.2, 6.4, 11 | Closed presets and host-owned timing. Primitives put `domId` on the root slot. |
| F7 | Large collections exceed the tree budget. | Starter `scroll` windows using `itemCount`, `itemStart`, `itemSize`, `step` and `onRange`. | §§5, 9 | The widget selects the slice. The starter reserves space with a named fixed row size. |
| F8 | A browser host needs a renderer without a framework. | `/dom` exports `createDomRenderer`, `implement` and `place`. `/conformance/dom` proves a registry. | §11 | The app supplies DOM primitives. Browser mounting only. |

## Agent-generated UI

| Scope | Problem | Shipped API or behavior | Spec | Limit |
|---|---|---|---|---|
| F9 | A JSON surface needs live filters and local state. | `renderElements` and `streamElements` accept `when`, `bind` and tree intents. `ephemeralManifest` and `generateElementsSchema` take caller-owned local declarations. | §§7.2, 8, 9 | The JSON cannot declare its own schema or initial local state. The stream shell uses its final bindings from the start. |
| F10 | An agent needs a compact catalog reference. | `generateDigest`, `liveframe gen --digest` and MCP `generated_types` with `module: "digest"`. | §§7.2, 7.5 | Deterministic, budgeted Markdown. The host chooses which schemas to disclose. |
| F11 | A host has an A2UI surface to draw. | `fromA2ui` converts a v0.9 or v0.9.1 snapshot to elements, initial local values and origins. | §7.2 | One surface, explicit app mapping and action allowlist. Validate the output with `renderElements`. |
| F12 | An agent needs generic forms and structured content. | The starter adds `radioGroup`, `radio`, `slider`, `progress`, `dateField`, `richText`, `chart`, `table`, `tableRow` and `tableCell`. The root exports `checkUrl` and `UrlRule`. | §§5, 6 | Closed formats and recipe-owned styling. Custom starter design systems need recipes for the new kinds. |

## Review fixes folded into 0.4.0

| Finding | Problem | Shipped API or behavior | Spec | Limit |
|---|---|---|---|---|
| D1 | A revision floor can move a placement backwards. | `renderPlacement` preserves monotonic revisions across updates. | §7.7 | Unchanged inputs can still skip rendering. |
| D2 | A host can resend a patch after a skipped render. | The host guide guards publication with the skip result. | §§7.7, 9.1 | The prior patch can still be present on the returned snapshot. |
| D3 | A failed redraw can hide an already dispatched action. | `handleIntent` retains the action outcomes on follow-up failure. | §7.7 | The render error remains available to the host. |
| D4 | A stale arrival can revive an invalid surface. | The surface core keeps its invalid state on stale arrivals. | §11 | A newer valid arrival recovers the surface. |
| D5 | Larger validated trees and wrapped validators can fail at arrival. | Surface core, React, Preview and host rendering accept validation limits. Unreadable validators fail closed. | §§7.7, 10, 11 | Use a validator compiled by the same Liveframe copy. |
| D6 | Worker boot can exhaust the render deadline. | `workerRunner` gives startup a separate `startTimeoutMs` budget. | §7.5 | The reference worker shares host permissions. |
| D7 | A host callback can throw out of an unconfirmed intent. | The surface catches synchronous `onIntent` throws. | §§8, 11 | Reporting callback failures as a `SurfaceEvent` is deferred. |
| G1 | Host load can make correctness checks red. | Performance budgets run in the benchmark suite. | §13 | Quiet-host benchmark proof is a separate release gate. |
| P1 | Reading the same unchanged package repeats verification. | `verifiedPackages()` checks a cache hit by structural equality. | §§7.3, 7.4 | Changed content takes the full verification path. |
| P2 | Large render keys create temporary copies. | `renderKey` and `packageHash` stream canonical JSON into the hash. | §§7.3–7.5 | Canonical bytes and digests are preserved. |
| P3 | Nested composition repeats input checks. | `render()` recognises and reuses SDK-owned frozen input containers. | §7.2 | Caller-created containers still go through validation. |
| P4 | Focus continuity can scan and enter the host page. | React scopes focus recovery to the surface and portal. | §11 | It respects focus moved by the host during commit. |
| P5 | Client mount draws each primitive twice. | React mounts the wrapper and portal before the initial client draw. | §11 | Hydration still has a separate post-mount draw. |
| P6 | A warm QuickJS runtime repeatedly compiles its validator. | `quickjsRunner({ reuse: "package" })` retains unchanged configuration. | §7.5 | The optimisation is for package reuse. |
| A1 | Validator metadata is fragmented. | The compiler keeps one internal facts table. | §10 | Internal change. Public validation still fails closed. |
| A2 | SDK and arrival rules can disagree. | Generated and corpus parity checks cover TSX, element JSON and arrival validation. Malformed element kinds and children now agree. | §§7.2, 10 | Known pointer differences for child-count and byte limits remain tracked. |
| A3 | An interrupted React render can change accepted state. | React applies an arrival at commit. | §11 | An interrupted transition leaves the last committed tree and intent origin in place. |
| A4 | A rejected arrival can blank useful UI. | `<Surface invalid="keep-last">` can retain the accepted view. | §11 | Opt-in. The default is the invalid fallback, and the retained view cannot emit host intents. |
| A5 | Build, expression and surface behavior are hard to change safely. | Internal SDK, template and surface code separates those responsibilities. | §§7.2, 7.6, 11 | Public entry points remain the same. |
| A6 | Source comments depend on historical task numbers. | Comments describe the constraints they preserve. | §13 | Maintenance change with no API impact. |

## Synapta

- The live bindings and typed error alignment extend LF-16’s ephemeral JSON surfaces. The snapshot converter covers the A2UI input path named in that request. LF-16’s base element JSON path already shipped. [Synapta requests](https://github.com/ashiqrniloy/liveframe/blob/main/plans/requests/synapta-adoption-requests.md#lf-16--feature--unpackaged-ephemeral-surfaces-from-agent-json)
- `pending` extends the source outcome convention requested in LF-12. Compound writes, `fromLocal` and scalar selection arrays cover additional form flows related to LF-05. The original requests already had shipped APIs.

## Clay

- The renderer work addresses the focus scope and repeated mount costs on Clay’s browser path. The release gates exercise WebKit, including the new renderer cases. CL-16’s theme-switch fix shipped earlier. The new motion coverage concerns surface nodes. [Clay review](https://github.com/ashiqrniloy/liveframe/blob/main/plans/requests/clay-0.2.1-requests.md) · [Clay requests](https://github.com/ashiqrniloy/liveframe/blob/main/plans/requests/clay-adoption-requests.md)
- The digest is available through `createAuthoring()` as well as MCP, extending the library path requested in LF-15. Element JSON improvements also cover Clay’s LF-16 dependency for agent results. Both base APIs shipped earlier. LF-17’s 1 KiB target still needs measurement on Clay’s own stream.

## 0.4.1 — security hardening

Upgrading a host from 0.4.0 needs no API or stored-data change. The 0.4.1 register holds only additions and optional widenings, and no existing corpus expectation, hash vector or schema changed. The [changelog](../CHANGELOG.md#041--unreleased) lists each fix, and the [compatibility notes](compatibility.md#041) list the inputs whose outcome changed. Each item comes from [Synapta's evaluation of 0.4.0](https://github.com/ashiqrniloy/liveframe/blob/main/plans/requests/synapta-0.4.0-requests.md).

| Request | Problem | Shipped API or behavior | Spec | Limit |
|---|---|---|---|---|
| LF-18 | A template could spend host time far beyond `limits.steps`. | Every emitted element, fragment and `$use` spends a step, emission stops at `limits.nodes`, sized operators pay for the units they read or write, and install refuses a data-free expansion over the node limit. `validateTemplate`, `pack` and `VerifyOptions` accept an optional `limits.nodes`. | §7.6 | There is no wall-clock timeout. The worst measured render under the default budget is in the [security guide](security.md#template-packages-need-no-isolation-runner). Real widgets spend more steps than in 0.4.0. |
| LF-21 | Text a widget threw reached host errors and `HostEvent`s. | A thrown non-library error becomes a fixed `Widget threw <name>` message. `debug` on `RenderOptions`, `RenderModuleOptions`, `RunnerOptions` and `HostWiring.runOptions` returns up to 1,000 characters in `LiveframeError.debug`. | §§7.5, 10 | Typed errors a runner returns still carry author text, and node ids and pointers carry author keys. |
| LF-25 | A hostile A2UI document could make the converter allocate without bound. | `fromA2ui` refuses sparse indices, over-budget data-model writes, data pointers deeper than 128 segments and oversized formatted text, and returns every unexpected error as a typed failure. | §13 | The converter still accepts one bounded snapshot. |
| LF-26 | An inline draft could be any size before it was transpiled. | `pack_draft` and `authoring.packDraft()` refuse more than 64 source files, 1 MiB of source or 1 MiB of document JSON. | §13 | Drafts run in the runner the host supplies, and neither reference runner is an isolation boundary. |
| LF-27 | Six small defects in validation, the intent path and authoring. | Lone surrogates fail their source, `pattern` is skipped after a length failure, prototype names are refused as section keys, a refused intent keeps the recorded status, draft-directory files are read through a checked handle, and capture failures carry fixed messages. | §§7.7, 10, 13 | A directory swapped above a draft file is not covered; keep `draftRoot` writable only by trusted users. |
| LF-34 | A host serving more than eight catalogs recompiled them in turn. | `compileValidator` keeps the 64 most recently used catalog and capabilities pairs. | §10 | A cache hit is slightly slower than the old scan because it hashes the document text. |
| LF-36 | The documented streaming loop cost grew with the square of the document. | The [streaming guide](sdk.md#draw-agent-json-while-it-streams) sends at most one update per frame and once after `end()`. | §7.2 | Each update still diffs and validates the whole tree, and a source slower than one tree per frame still gets one update per tree. |
| LF-65 | The security guide overstated three bounds, and the app's duties were spread across pages. | The [security guide](security.md#041-audit) cites a test for each corrected statement, and the [security checklist](security-checklist.md) lists what the library checks and what the app must do. | §2 | The checklist names duties the app holds today; it adds no check. |

Host actions from the 0.4.1 register:

- Pass the host's node budget when it differs from the 5,000-node default.
- Use the same node budget for packing and subsequent verification.
- Pass the matching node budget when verifying or loading packages above the 5,000-node default.
- Use debug only for trusted diagnostic output.

## Not delivered

| Item | Status |
|---|---|
| [Synapta's 0.4.0 requests](https://github.com/ashiqrniloy/liveframe/blob/main/plans/requests/synapta-0.4.0-requests.md) LF-19, LF-20, LF-22, LF-23, LF-24, LF-26 (the runner half), LF-28, LF-30, LF-33, LF-35, LF-36 (the stream's own update form), LF-39, LF-41, LF-42, LF-43, LF-45, LF-48, LF-50, LF-51, LF-62, LF-63 and LF-64 | Scheduled for 0.5.0. The [security checklist](security-checklist.md) names the app's duty for each security item today. |
| [Synapta's 0.4.0 requests](https://github.com/ashiqrniloy/liveframe/blob/main/plans/requests/synapta-0.4.0-requests.md) LF-29, LF-31, LF-32, LF-37, LF-38, LF-40, LF-44, LF-46, LF-47, LF-49, LF-52 to LF-61 | Scheduled for 0.6.0. |
| Report thrown or rejected `onIntent` callbacks through `SurfaceEvent` | Deferred to 0.5.0. |
| Omit prior `patch`, `reset` and `migrated` on a skipped `renderPlacement` | Deferred to 0.5.0. |
| Focus scroll directives | The tree mark requests focus only. |
| DOM server rendering, a packaged custom element and a starter DOM registry | Apps provide DOM implementations and can wrap `mount` in a custom element. |
| A2UI incremental updates, client functions beyond path-based `formatString`, or function-call actions | The converter accepts a bounded snapshot and mapped action names. |
| Child-count and byte-limit pointer parity | The two pointer differences remain in the backlog. |
