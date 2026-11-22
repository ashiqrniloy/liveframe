# Bug and feature requests from Synapta's evaluation of 0.4.0

- **Source:** evaluation of `@arnilo/liveframe@0.4.0` (source at `93d20e7`, `docs/`, `dist/`, and the three companion packages) against the Synapta stages that build on it: S6 (runtime UI adoption), S7 (Control Center), S8 (Workspace, Operations app, Ask/Do/Run) and the Cockpit. Synapta's side is `synapta-core`: `roadmap.md` §3 (S6–S8, SP B4), `PRODUCT.md` L7, L11, §4–§7.4, and `docs/architecture/widget-runtime.md`.
- **Date:** 2026-11-22
- **Status:** requests, not decisions. Each item names the general problem first; Synapta is the evidence, not the reason. Settle each one with a decision log and a plan before you build it. Every proposal is a starting point, not a design.
- **Adoption gate:** the owner wants every item here settled in Liveframe before Synapta adopts it. Settled means delivered, or declined with a decision log that says who owns the problem instead.
- **How each claim was checked.** Every item says which of these applies:
  - **Reproduced:** a script run for this report (Bun 1.4.5, Linux, host not quiet, so timings are indicative).
  - **Read:** the cited code path was read end to end.
  - **Audit script:** a script run by one of the evaluation's audits and not re-run for this report.
  - **Recorded:** a number from this repository's own evidence files.
- **Earlier requests:** `synapta-adoption-requests.md` (LF-01 to LF-17), `clay-adoption-requests.md` (CL-01 to CL-09) and `clay-0.2.1-requests.md` (CL-10 to CL-16). All are recorded as shipped. `plans/liveframe-evaluation.md` proposed several of the features below (resource handles, a package change classifier, surface slots); those items say so.

## Decisions needed before any plan

Some requests cross a boundary the spec draws on purpose. Each needs its own decision log first.

- **Spec §14 "authorisation, approval flows, a storage backend".** LF-23, LF-28, LF-33 and LF-55 add interfaces and reference implementations for intent identity, served-tree storage and placement history. None adds a policy: `authorize` and approval stay the app's.
- **Spec §14 "layout shells" and nested surfaces.** LF-52 asks for layouts to be widgets with slot nodes. That lifts the non-goal in part and makes the backlog's "Revisit scoping only if nested surfaces become required" a requirement.
- **Spec §14 rule 2 (agent tools that install, place or approve stay the app's).** LF-57 keeps the rule: it asks for hooks the app implements, not tools that install.
- **Law 2 and a second data path.** LF-37 lets a primitive read pages of rows that are not in the tree. The decision must say how those pages are validated before an implementation reads them.
- **Spec §5 "no product-shaped components".** LF-37, LF-43 and LF-44 are the alternative to a monolithic grid kind: they give an app's own grid, chart and editor primitives a governed home.
- **The closed recipe and style-prop lists.** LF-45 and LF-51 grow both lists.

## Backlog items this adoption needs

These are already in `plans/backlog.md`. Raise the priority; do not file them again.

| Backlog heading | Now | Needed | Why |
|---|---|---|---|
| Re-run the full benchmark suite on a quiet host | open | P1 | The 0.4.0 record is "NOT a clean quiet-host pass" and the validator stage exited 1 (`plans/evidence/040-bench-attempt-best.md`). See LF-41. |
| Revisit scoping only if nested surfaces become required | P4 | P1 | LF-52 is that requirement. |
| Evaluate an atomic-class route for strict style CSP | P3 | P2 | Layout needs `style-src-attr 'unsafe-inline'` (`docs/styling.md:99`). Synapta's CSP allows it today (`web/app/server/security-headers.ts:53`) and cannot be tightened while this stands. |
| Render concurrently in the QuickJS runner | P3 | P2 | One slow widget stalls every render behind it. See LF-32. |
| Do not carry a prior render's `patch`, `reset` or `migrated` on a skipped `renderPlacement` | P4, deferred to 0.5.0 | P2 | A host that forgets the identity check resends an applied patch. LF-28 changes the shape anyway. |
| Report a thrown or rejected `onIntent` through `SurfaceEvent` | P4, deferred to 0.5.0 | P2 | LF-42's client queue needs to know an emit failed. |
| Carry the manifest on `Served` or document the lookup | open | with LF-28 | Same record. |
| Gate the remaining request-time pipeline budgets in `bench/host.bench.ts` | open | P2 | With LF-41. |
| Let definitions declare their parent kinds | P3 | P2 | A stray `tableCell` is a valid tree and a fallback at draw time, not a typed error an agent can repair. |
| Give live filters a case-insensitive match | open | P2 | With LF-53. |
| Make the template structured-output schema usable in strict modes | P3 | P2 | LF-59 extends it to the elements schema. |
| Draw `$ref` and fragment documents progressively in `streamElements` | P4 | P3 | With LF-58. |
| Add a `meter` kind and an interactive table to the starter | P4 | P2 | After LF-37, LF-43 and LF-44, which give an interactive table somewhere to keep its rows and state. |
| Capture overlays that are open inside a preview cell | open | P3 | With LF-61. |
| Later-phase gaps, G29 (forced colours and assistive technology audit) | run waived | P2 | Synapta's accessibility list makes forced colours and screen-reader behaviour acceptance, not polish. |
| Composition surface gaps (`position: relative`, `basis` units) | P3 | with LF-45 | Same list. |
| Run the new packages on macOS and Windows | open | P3 | Developer machines. |

## Summary

"Blocks" is the Synapta stage that cannot finish without the item. Targets are proposals for the owner.

| ID | Type | Title | Priority | Blocks | Target |
|---|---|---|---|---|---|
| LF-18 | Bug (security) | Template render cost is not bounded by `limits.steps` | P1 | S6 | 0.4.1 |
| LF-19 | Bug (security) | A placement cannot pin a package's content | P1 | S6 | 0.5.0 |
| LF-20 | Bug (security) | URL props have no host constraint | P1 | S6 | 0.5.0 |
| LF-21 | Bug (security) | Widget-thrown text reaches host errors and `HostEvent`s | P2 | S6 | 0.4.1 |
| LF-22 | Bug | A `confirm` action can dispatch unconfirmed, and the host cannot tell | P1 | S6 | 0.5.0 |
| LF-23 | Feature | Intent identity: exactly-once dispatch and an idempotency key | P1 | S6 | 0.5.0 |
| LF-24 | Feature | `authorize` and `dispatch` receive no context | P2 | S6 | 0.5.0 |
| LF-25 | Bug (security) | The A2UI converter's allocations are not bounded | P3 | none | 0.4.1 |
| LF-26 | Bug (security) | Authoring runs drafts with host permissions by default and accepts unbounded drafts | P2 | S8 | 0.4.1, 0.5.0 |
| LF-27 | Bug | Hardening batch: six small defects | P3 | S6 | 0.4.1 |
| LF-28 | Feature | `Served` cannot be persisted, so a multi-replica host has no session | P1 | S6 | 0.5.0 |
| LF-29 | Feature | Share one render across viewers with identical inputs | P2 | S7 | 0.6.0 |
| LF-30 | Performance | Store reads are serial and a page of placements has no batch | P2 | S6 | 0.5.0 |
| LF-31 | Performance | One tree is validated three or four times per request | P3 | S7 | 0.6.0 |
| LF-32 | Feature | Isolated-runner throughput | P2 | S8 | 0.6.0 |
| LF-33 | Feature | `Store` for multi-tenant database hosts | P2 | S6 | 0.5.0 |
| LF-34 | Bug | The validator cache holds eight catalogs | P3 | S6 | 0.4.1 |
| LF-35 | Feature | Incremental validation of patched trees | P1 | S7 | 0.5.0 |
| LF-36 | Bug (performance) | The documented streaming loop is quadratic | P1 | S8 | 0.4.1, 0.5.0 |
| LF-37 | Feature | A data channel beside the tree: typed resource handles | P1 | S7, Cockpit | 0.6.0 |
| LF-38 | Feature | Finer patch operations | P2 | S7 | 0.6.0 |
| LF-39 | Feature | Hydration draws every node twice; no streaming server rendering | P2 | S6 | 0.5.0 |
| LF-40 | Feature | Embedding: a custom element, a DOM starter registry, style isolation | P3 | Embed SDK | 0.6.0 |
| LF-41 | Feature | Benchmarks at adopter scale and a passing quiet-host gate | P1 | S6 | 0.5.0 |
| LF-42 | Bug (interaction) | A second emit from one revision is dropped | P1 | S6 | 0.5.0 |
| LF-43 | Feature | Wider carriers: arrays in local state, selection sets, larger events | P1 | S7 | 0.5.0 |
| LF-44 | Feature | Declared view state for primitives | P1 | S7 | 0.6.0 |
| LF-45 | Feature | Layout vocabulary gaps | P2 | S7 | 0.5.0 |
| LF-46 | Feature | Keyboard shortcuts | P2 | S7 | 0.6.0 |
| LF-47 | Feature | Drag and drop | P2 | S8 | 0.6.0 |
| LF-48 | Feature | A navigation intent and URL-bound state | P2 | S6 | 0.5.0 |
| LF-49 | Feature | File upload | P3 | S8 | 0.6.0 |
| LF-50 | Feature | Overlay behaviour in `/surface` | P2 | S6 | 0.5.0 |
| LF-51 | Feature | Recipe expressiveness and icon sets | P3 | S6 | 0.5.0 |
| LF-52 | Feature | Layouts as widgets: slot nodes, nested surfaces, cross-surface links | P1 | S7 | 0.6.0 |
| LF-53 | Feature | Template language: sort, group, aggregate, format, dependencies | P2 | S8 | 0.6.0 |
| LF-54 | Feature | Data-bound ephemeral surfaces | P1 | S8 | 0.6.0 |
| LF-55 | Feature | Customization records: placement revisions, scoped overrides, history | P1 | S7 | 0.6.0 |
| LF-56 | Feature | `classifyPackageChange` and placement rebase on upgrade | P1 | S7 | 0.6.0 |
| LF-57 | Feature | Editing an installed widget: read, patch, diff, propose | P1 | S8 | 0.6.0 |
| LF-58 | Feature | Repair during a stream, not after it | P2 | S8 | 0.6.0 |
| LF-59 | Feature | Agent context: a digest by kind, strict-mode schemas, an element check | P2 | S8 | 0.6.0 |
| LF-60 | Feature | An agent evaluation harness with published success rates | P2 | S8 | 0.6.0 |
| LF-61 | Feature | Live-data preview | P3 | S8 | 0.6.0 |
| LF-62 | Feature | A client transport helper | P2 | S6 | 0.5.0 |
| LF-63 | Feature | Stability an adopter with stored documents can plan on | P1 | S6 | 0.5.0 |
| LF-64 | Feature | `hostSuite()`: conformance for an app's intent boundary | P2 | S6 | 0.5.0 |
| LF-65 | Docs | Security guide corrections and an adopter responsibility checklist | P2 | S6 | 0.4.1 |

**Why the targets are grouped this way.**

- **0.4.1** holds defects that change no export and no format. Per `docs/compatibility.md`, a patch may fix bugs and add error kinds.
- **0.5.0** holds everything that changes what an adopter writes into stored documents or into its backend: placement records, the `Store` interface, the intent origin, URL rules, style props and local-state schemas. Packages are immutable and re-verified on every load, so these should land before Synapta stores its first catalog, package or placement.
- **0.6.0** holds dense-data primitives and the agent customization lifecycle. Synapta needs them for S7 and S8, not for the S6 proof widget, but the owner's gate puts them before adoption too.

---

# Security

## LF-18 · Bug (security) · Template render cost is not bounded by `limits.steps`

- **Problem.**
  - `limits.steps` counts expression operators only. Element emitters and `$use` charge nothing (`src/template/render.ts:281-291`, `:335-352`). The node limit applies after expansion (`src/sdk/render.ts:111-130`). Install bounds component nesting height at 16, not fan-out (`src/template/document.ts:256-281`).
  - **Reproduced.** A template of N components, each a `box` with four children that `$use` the next component, passes `validateTemplate`. `renderTemplate` with `limits: { steps: 1000 }`:

    | Components | Template size | Time | Resident memory growth | Result |
    |---|---|---|---|---|
    | 6 | 1,229 bytes | 6 ms | 3 MiB | error, after the work |
    | 8 | 1,597 bytes | 29 ms | 26 MiB | error, after the work |
    | 10 | 1,965 bytes | 416 ms | 259 MiB | error, after the work |

    Cost grows 4× per component. Sixteen components are allowed, which is 4^16 elements.
  - Templates render in the host process under every runner, including `quickjsRunner()` (`packages/runner-quickjs/src/index.ts:205-206`), so no timeout or heap limit applies.
  - String operators are priced per call, not by size. Fifty-eight `$slice` calls on a 1 MiB string fit the default budget and take about 0.5 s (`src/template/expr/operators.ts:169`; audit script).
  - `docs/security.md` says a template's "work is counted against `limits.steps`", that a lower budget can "cap the cost of one render at about 2.5 ms", and recommends `templateRunner()` for authors the host does not trust.
- **Evidence (Synapta).** Template widgets are the path for agent-created, data-bound widgets (`PRODUCT.md` §7.4), because they need no sandbox. They would run in Synapta's trusted TypeScript host.
- **Proposal.**
  - Charge one step per emitted element and per `$use`.
  - Enforce `limits.nodes` while emitting, and stop at the first element over the limit.
  - Charge string and array operators by the size of their output.
  - At install, reject a template whose expansion with no data already exceeds `limits.nodes`.
  - Correct the three statements in `docs/security.md`.
- **Acceptance.**
  - The reproduction returns `limit-exceeded` in under 5 ms with under 1 MiB of growth, at 10 and at 16 components, with default limits.
  - Hostile-template cases join `conformance/corpus/`: fan-out, a `$use` chain, and string doubling followed by `$slice`.
  - A bench gate records the worst render the default budget allows.
  - Every existing template fixture renders the same tree.

Reproduction, run with `bun --conditions liveframe:source` from outside the repository:

```ts
const depth = 10, fan = 4, components: Record<string, unknown> = {};
for (let i = 0; i < depth; i++) {
  const leaf = i === depth - 1 ? { kind: "separator" } : { $use: `C${i + 1}` };
  components[`C${i}`] = {
    params: { type: "object", properties: {}, required: [], additionalProperties: false },
    root: { kind: "box", children: Array.from({ length: fan }, () => leaf) },
  };
}
const template = { format: "liveframe-template/1", components, root: { kind: "box", children: [{ $use: "C0" }] } };
// validateTemplate(template, { catalog, capabilities, manifest }) is ok with the proof catalog and an ephemeral manifest;
// renderTemplate(template, inputs, { validator, surfaceId: "s", revision: 1, limits: { steps: 1000 } }) then does the work above.
```

## LF-19 · Bug (security) · A placement cannot pin a package's content

- **Problem.**
  - A placement is `{ id, slot, widget: { id, version }, params }` (`src/formats/records.ts:9`). `loadPlacement` fetches by `(id, version)` and `verifyPackage` checks the record against its own `hash` field (`src/store/load.ts:145-171`, `src/pack/verify.ts:165`).
  - A store that returns different code under the same `id@version`, with the hash recomputed, is accepted and rendered, even with a warm `verifiedPackages()` cache (`src/store/verified.ts:84-93`). Audit script.
  - `Served.package.hash` is known only after the code has run.
  - `docs/security.md` says tampered content is `hash-mismatch`. That holds for corruption only.
- **Evidence (Synapta).** L11 says layouts and widgets change at runtime "by approved AI proposals", and S6 requires packages "hashed and verified on load". An approval names a digest, so the load must be able to check that digest.
- **Proposal.**
  - An optional `widget.hash` on a placement. `loadPlacement` refuses a package whose hash differs, with `hash-mismatch`, before verification and before any runner.
  - An optional `admit(pkg: { id, version, hash })` hook on the host wiring, called before the runner for the package and each library. Signatures, allowlists and revocation stay the app's; the hook is where they plug in.
  - Fix the wording in `docs/security.md`.
- **Acceptance.**
  - The swap test is refused, and a runner spy shows no code ran.
  - A placement without `hash` loads as today.
  - `storeSuite` and the corpus cover the pinned case.
  - `admit` returning anything but `true` gives `load-failed`.

## LF-20 · Bug (security) · URL props have no host constraint

- **Problem.**
  - `UrlRule` is `{ schemes, relative? }` (`src/url.ts:2`). It cannot name hosts.
  - The starter allows any `https` URL for `image.src` and `link.href` (`packages/starter/src/ui.definitions.gen.ts:693-699`).
  - A tree can therefore carry `https://elsewhere.example/?d=<viewer data>` and the browser fetches it on draw. Untrusted widget code, or an agent steered by text in the data it reads, has a channel out.
  - Preview capture launches Chromium with no request blocking (`src/preview/capture/playwright.ts:9-18`), so the same URL is fetched from the authoring host. Read, not run.
  - The docs give no host-allowlist or `img-src` guidance.
- **Evidence (Synapta).** Agent-written surfaces hold governed data (L7, L11). Rows from customer databases and document text are attacker-influenced.
- **Proposal.**
  - `UrlRule.hosts?: readonly string[]`, with exact hosts and a leading-wildcard form. `checkUrl` enforces it.
  - `compileValidator({ urlHosts })` narrows the catalog's rule for one deployment, because the allowlist is deployment data.
  - The starter's `image.src` becomes relative-only by default.
  - The capture backend blocks requests outside the allowlist.
  - `docs/security.md` gains an `img-src` and `connect-src` section.
- **Acceptance.**
  - A tree with an off-list image or link fails with `invalid-prop` at the prop.
  - `checkUrl` cases cover userinfo, ports, trailing dots, internationalised hosts and mixed case.
  - A capture of a tree with an off-list image makes no network request.

## LF-21 · Bug (security) · Widget-thrown text reaches host errors and `HostEvent`s

- **Problem.**
  - A widget that throws `new Error(JSON.stringify(inputs))` puts its inputs into the `render-failed` event. The path is `errorMessage(error)` at `src/runner-kit/render.ts:72-76`, then `failed("render-failed", rendered.errors)` at `src/host/render.ts:222-225` and `:272`. Read; confirmed by audit script.
  - `src/host/types.ts:75-77` promises events hold "never state, params, source data, intent arguments or action values".
  - The in-process path is unbounded. The QuickJS path allows 21 errors of four 1,000-character fields (`packages/runner-quickjs/src/result.ts:58-82`).
- **Evidence (Synapta).** Host events go to logs and traces. Source data is governed and may be marked.
- **Proposal.**
  - A thrown non-`LiveframeFailure` becomes a fixed message plus the error's `name`.
  - The original text is available only through an opt-in `debug` field that the event type marks as untrusted.
- **Acceptance.**
  - The throwing widget yields an event with no input text, under every reference runner and the QuickJS runner.
  - The promise at `src/host/types.ts:75-77` has a test.

## LF-22 · Bug · A `confirm` action can dispatch unconfirmed, and the host cannot tell

- **Problem.**
  - The surface skips confirmation when the app passes no `confirm` callback: `if (!confirm || !meta?.confirm)` emits directly (`src/surface/core.ts:336`). An app that mounts `<Surface>` without `confirm` dispatches `confirm: true` and `irreversible` actions with no prompt.
  - `handleIntent` never learns whether the user confirmed. `checkOffered` and `authorize` see the same intent either way (`src/host/intent.ts:326-343`).
  - The docs do not say that `confirm: true` is unenforced on the host.
- **Evidence (Synapta).** Synapta's current boundary mints a one-time confirmation token for every irreversible action, bound to the session, widget and action (`docs/architecture/widget-runtime.md` § Server-side run, step 4). S6 lists "confirmation tokens" in the widget host.
- **Proposal.**
  - `createRenderer` or `<Surface>` refuses to emit a confirm-required action when no `confirm` is supplied, and raises a `SurfaceEvent`.
  - The intent origin gains `confirmed: true`, set only after `confirm` resolved true.
  - `handleIntent` refuses a confirm-required action whose origin is not confirmed, with reason `unconfirmed`.
  - With LF-23's intent id, the confirmation is one-time and bound to one offer.
- **Acceptance.**
  - A surface with no `confirm` cannot emit an irreversible action.
  - A posted irreversible intent without `confirmed` is refused before `authorize`.
  - The renderer conformance suites cover both.

## LF-23 · Feature · Intent identity: exactly-once dispatch and an idempotency key

- **Problem.**
  - The only replay guard is `origin.revision === tree.revision` (`src/validate/offered.ts:34`).
  - A skipped render keeps the revision (`src/host/render.ts:250-254`), so the same intent is accepted again.
  - `runAction` does not refuse a result key that is already pending (`src/host/intent.ts:295-319`), and two concurrent posts both dispatch.
  - `dispatch` has no timeout, so an action can stay pending for ever.
  - `docs/host.md` leaves double submits to the host. Every host then builds the same thing.
- **Evidence (Synapta).** Synapta's boundary derives an idempotency key from the intent: session subject, organization, widget, action and arguments (`docs/architecture/widget-runtime.md` § Client contract). S6 lists "derived idempotency".
- **Proposal.**
  - The surface core mints `origin.intentId` per emit.
  - An optional `Store.claimIntent(placementId, scope, intentId)`, atomic within one placement and scope, in the style of `putStateIf`. `handleIntent` claims before `authorize`; a duplicate returns the recorded outcome and dispatches nothing.
  - `handleIntent` derives an idempotency key from placement, scope, package hash, node, event and intent id, and hands it to `dispatch` (LF-24).
  - An action whose result key is pending is refused with reason `busy`.
  - A `dispatchTimeoutMs` option records `failed`.
- **Acceptance.**
  - The same intent posted twice, in sequence and concurrently, dispatches once under `memoryStore` and `fileStore`.
  - `storeSuite` covers `claimIntent`.
  - A store without `claimIntent` behaves as today, and the host guide says so.

## LF-24 · Feature · `authorize` and `dispatch` receive no context

- **Problem.** Both receive `(intent, viewer)` only (`src/host/intent.ts:270`, `:280`). A policy cannot see which placement, package hash, node or event raised the intent without a closure built per call.
- **Evidence (Synapta).** Synapta authorises on dual identity, user and agent and task (L7), and audits the widget and its digest with every action.
- **Proposal.** A third argument `{ origin, placementId, scope, package: { id, version, hash }, resultKey, idempotencyKey }`. It is additive.
- **Acceptance.** Two-argument callbacks still work, and the host guide's example uses the context.

## LF-25 · Bug (security) · The A2UI converter's allocations are not bounded

- **Problem.**
  - A numeric path segment in `updateDataModel` writes at that index (`packages/a2ui/src/index.ts:296-313`). A 517-character document allocated 155 MiB. Audit script.
  - `format` bounds its input, not its output (`:780-807`). 171 KB of input returned a 67 MB string as `ok`. Audit script.
  - `fromA2ui` catches only its own `Stop` (`:123-126`), so a deep pointer ends in an uncaught `RangeError`.
  - `docs/security.md` says a hostile A2UI document "is bounded (size, depth, node count) and yields errors, not a tree".
- **Evidence (Synapta).** None: S6 removes A2UI. Filed because the docs promise the bound.
- **Proposal.** Bound array indices and formatted output by `limits`, and turn every thrown error into a typed failure.
- **Acceptance.** The three inputs return errors in under 10 ms with under 1 MiB of growth.

## LF-26 · Bug (security) · Authoring runs drafts with host permissions by default and accepts unbounded drafts

- **Problem.**
  - `liveframe mcp` and `createAuthoring()` default to `workerRunner()` (`src/cli/mcp.ts:543`), which shares the process's permissions.
  - The import ban is syntactic (`src/pack/bundle.ts:82-99`). `process.getBuiltinModule`, an aliased `require`, `new Function("return import(...)")`, `Bun.spawnSync` and the environment are reachable. Audit script. The docs state this.
  - `pack_draft` has no size or file-count bound before transpiling (`src/authoring/index.ts:166-190`): 9 MiB was accepted with 1.4 GiB resident. Audit script.
- **Evidence (Synapta).** S8 runs authoring inside the agent runtime, where the draft author is a model.
- **Proposal.**
  - Bound draft files by count and bytes, as typed errors before any transpile.
  - Refuse to start authoring without an explicit `runner` or an explicit `trustDrafts: true`.
- **Acceptance.**
  - Oversized drafts are refused in constant memory.
  - Starting without a runner or the flag is a typed error that names both options.

## LF-27 · Bug · Hardening batch: six small defects

- **Problem.**
  1. A lone surrogate in resolver data makes `renderKey` throw, so one bad row fails the placement's render (`src/pack/hash.ts:3`, `src/host/render.ts:250`). Audit script.
  2. An app-authored `pattern` runs on a string that already failed its length check, including intent arguments (`src/validate/schema.ts:130-132`). Read.
  3. An own `__proto__` key in an element's `style` or `events` section replaces a local record's prototype (`src/sdk/element-node.ts:83-88`). Audit script. No global pollution.
  4. A crafted, refused intent overwrites the recorded status of the action its origin node offers and triggers a render (`src/host/intent.ts:174-178`). Read.
  5. A hard link inside `draftRoot` passes the containment check (`src/cli/draft-dir.ts:69-72`). Audit script.
  6. Capture errors return host text (`src/preview/capture/playwright.ts:14`, `:22`). Read.
- **Proposal.**
  1. Report a lone surrogate as the source's `failed` outcome or a typed error at `/data/<alias>`.
  2. Skip `pattern` when the length check failed.
  3. Reject `__proto__`, `constructor` and `prototype` as section names.
  4. Do not record a refusal over an existing entry for a not-offered intent.
  5. Open drafts through a handle and compare the real path.
  6. Return a fixed message.
- **Acceptance.** One regression test per defect.

---

# Host runtime

## LF-28 · Feature · `Served` cannot be persisted, so a multi-replica host has no session

- **Problem.**
  - `Served` holds a process-local `validator` that `checkOffered` trusts (`src/host/types.ts`, `Served`). The record cannot cross a process boundary.
  - A host with more than one replica, or one that restarts, loses `previous`. It then has no patch, no skip and no served tree to check an intent against.
  - The host must also serialise calls per placement and scope, and choose patch or tree per client. The demo host needs 533 lines for this (`examples/demo-host/server.ts`).
- **Evidence (Synapta).** The widget host is a stateless BFF behind a gateway, with several replicas (S6 "The BFF widget host and intent boundary").
- **Proposal.**
  - Split `Served` into a JSON `ServedRecord` and a `reviveServed(record, wiring)` that recompiles or reuses the validator and re-validates the tree once.
  - A `ServedStore` interface (`get`, compare-and-set `put`), with a memory reference implementation and a `servedSuite`.
  - A `createSession(wiring, servedStore)` helper that serialises per placement and scope and answers patch or tree from the client's last accepted revision. It stays a set of functions: no timers and no background work.
  - The manifest travels on the record, which closes the backlog item.
- **Acceptance.**
  - A two-process test renders in one process and handles the intent in the other, and the patch chain continues.
  - `renderPlacement` and `handleIntent` keep working without a session.

## LF-29 · Feature · Share one render across viewers with identical inputs

- **Problem.**
  - A render is skipped only against that placement's own `previous` (`src/host/render.ts:250-254`).
  - Two viewers with the same package, params, state, data, context and actions run the widget twice, though `renderKey` already proves their trees differ only by `surfaceId` and `revision`.
  - Recorded cost with the verified cache is 7.1 ms per render on the 679-node agent-home, so a thousand viewers of one shared surface cost about 7 s of CPU per data change (inferred from the recorded figure).
- **Evidence (Synapta).** Queue and Control Center surfaces show the same organisation-wide data to many operators.
- **Proposal.** An optional render cache on the wiring, keyed by `renderKey`, holding the validated tree body. The key hashes the viewer's resolved data, so a hit cannot serve another viewer's data.
- **Acceptance.**
  - N viewers with equal inputs invoke the runner once.
  - Viewers with different data never share a tree.
  - A bench covers 1,000 viewers.

## LF-30 · Performance · Store reads are serial and a page of placements has no batch

- **Problem.**
  - `loadPlacement` awaits the placement, then the package, then each library in turn, then state (`src/store/load.ts:134`, `:145`, `:173-176`). That is three or more sequential round trips on a database store.
  - A page with twelve placements calls `renderPlacement` twelve times, with twelve `resolve` calls.
- **Proposal.**
  - Read the package and state in parallel once the placement is known, and libraries in parallel.
  - An optional `Store.load(placementId, scope)` that returns everything in one round trip.
  - `renderPlacements([...])`, which loads in a batch and calls `resolve` once with every source call of the page.
- **Acceptance.**
  - A store spy shows one round of reads for a twelve-placement page when `Store.load` exists.
  - The results equal twelve separate calls.

## LF-31 · Performance · One tree is validated three or four times per request

- **Problem.** The tree is validated inside `render()`, again in the runner host (`packages/runner-quickjs/src/result.ts:137`, `src/preview/worker/runner.ts:117`), again in `renderPlacement` (`src/host/render.ts:276`) and again in the browser. Recorded: validation is 65–77% of render time.
- **Proposal.** When a tree was validated in the same realm by the same compiled validator, as with `templateRunner()` and `inProcessRunner()`, skip the host's repeat. The `validated` record that `checkOffered` already reads can carry this. Keep the host check for every runner that crosses a boundary.
- **Acceptance.** The law 2 tests still pass, the host bench shows the saving, and a forged tree from a cross-boundary runner is still rejected.

## LF-32 · Feature · Isolated-runner throughput

- **Problem.**
  - `quickjsRunner` renders one widget at a time through a single chain (`packages/runner-quickjs/src/index.ts:207-210`). Recorded: 79 ms median with a fresh runtime and 40.7 ms with reuse, so about 12 to 25 renders per second per runner.
  - It serialises the whole catalog and capabilities on every render (`:170`).
  - `Runner` has no batch call, so a page of N widgets crosses the boundary N times.
- **Evidence (Synapta).** Synapta's isolated runtime is `deno_core`, built on `runner-kit.bundle.js`, so the kit's own cost and a batch contract matter more than the QuickJS package.
- **Proposal.**
  - Send the configuration once per child or per configuration hash.
  - An optional `Runner.renderMany`, with each tree still validated on the host.
  - The pool is the backlog item raised above.
  - Publish a kit-only bench so an adopter's runner has a baseline.
- **Acceptance.** A bench reports renders per second at concurrency 1, 4 and 16, and `runnerSuite` covers `renderMany`.

## LF-33 · Feature · `Store` for multi-tenant database hosts

- **Problem.**
  - `Store` has no tenant in its keys (`src/store/index.ts:14-30`). The docs say to build one store per tenant, which leaves the isolation untested.
  - `listPlacements()` returns every placement, with no filter by slot and no paging.
  - There is no `listPackages`, `deletePackage` or version listing.
- **Evidence (Synapta).** One PostgreSQL store serves every organisation. Placement counts grow with customization (§7.4).
- **Proposal.**
  - Document the per-request store factory as the tenancy pattern and add a `storeSuite` case that proves two scopes cannot read each other's records.
  - `listPlacements({ slot?, cursor?, limit? })`.
  - Optional `listPackages`, `listVersions(id)` and `deletePackage`.
- **Acceptance.** `storeSuite` covers isolation, paging and the optional methods, and both reference stores pass.

## LF-34 · Bug · The validator cache holds eight catalogs

- **Problem.** `MAX_CATALOGS = 8` (`src/validate/compile.ts:241`). A process that serves more than eight catalog and capabilities pairs recompiles on most calls: recorded 0.72 ms on a miss against 0.19 ms on a hit.
- **Evidence (Synapta).** Capabilities differ per tenant, and catalogs per app major version.
- **Proposal.** Make the bound an option, or key the cache on the frozen document's identity.
- **Acceptance.** A bench with 64 pairs shows hits.

---

# Rendering and scale

## LF-35 · Feature · Incremental validation of patched trees

- **Problem.**
  - Every arrival is validated whole, including a tree produced by a one-node patch (`src/surface/core.ts:732-740`; `docs/adopters-0.2.md:68`).
  - The cost is linear at about 1.3 to 1.6 µs per node. Accepting a one-row patch at 4,903 nodes costs 7.9 ms before React, 6.6 ms of it validation (audit run).
  - It runs synchronously in React's render phase (`src/react/renderer.tsx:348`).
- **Evidence (Synapta).** The work queue updates live over SSE. A surface near the node cap at ten updates a second spends most of its budget revalidating unchanged rows.
- **Proposal.**
  - `validatePatched(base, patch, validator)`: when `base` was validated by the same validator, check only the nodes a patch touches.
  - Maintain the whole-tree budgets incrementally: node count, bytes, expression count, id uniqueness and the focus mark.
  - Fall back to whole validation whenever the base is unknown.
- **Acceptance.**
  - A one-row patch at 4,900 nodes is accepted in under 1 ms.
  - A differential test over the corpus and a fuzzed patch stream shows the incremental and whole results are equal, errors included.

## LF-36 · Bug (performance) · The documented streaming loop is quadratic

- **Problem.**
  - `streamElements` is linear, but it returns about one tree per closed node. The loop in `docs/sdk.md:289-306` then runs `diffTrees` on the host and `applyPatch` plus whole validation in the client for each one.
  - **Reproduced** with the documented loop, 4-character chunks:

    | Nodes | `streamElements` alone | Whole pipeline | Host `diffTrees` | Client apply and accept |
    |---|---|---|---|---|
    | 1,003 | 9 ms | 0.86 s | 0.17 s | 0.67 s |
    | 4,003 | 31 ms | 16.0 s | 3.4 s | 12.4 s |

  - Patch bytes summed to three times the document.
  - `bench/stream-elements.bench.ts` gates only the ratio of `streamElements` to `renderElements`.
- **Evidence (Synapta).** S8 draws agent-session surfaces as streamed element JSON.
- **Proposal.**
  - In 0.4.1, the guide coalesces: push every chunk, and take a snapshot at most once per frame.
  - A pull form: `push()` reports only that something changed, and `take()` builds the tree.
  - The stream emits its own append patch, since it knows what closed, instead of diffing two whole trees.
  - LF-35 removes the client cost.
- **Acceptance.**
  - An end-to-end bench gates the 4,003-node stream at under 500 ms in total.
  - Patch bytes stay under 1.5 times the document.

## LF-37 · Feature · A data channel beside the tree: typed resource handles

- **Problem.**
  - A primitive receives only what the tree carries (`src/react/implement.ts:12-31`). A tree is capped at 5,000 nodes and 1 MiB (`src/validate/tree.ts:30`), and every string and array prop needs a bound (`src/formats/language.ts:60`, `:65`).
  - The only answer for large collections is server windowing: the starter's `scroll` reports a range, the range is widget state, and the host renders about 200 fixed-height rows again (`docs/sdk.md:353-411`). Every scroll past the window is a full intent, render, validate and diff round trip.
  - The recorded answer for editors and terminals is an opaque string handle and host context (`plans/requests/clay-adoption-requests.md:209`). That has no schema, no validation and no visibility to the widget or an agent.
  - `plans/liveframe-evaluation.md` Tier C item 8 proposed typed handles. Nothing in `src` implements them.
- **Evidence (Synapta).** SP B4 names four new primitives: `chart`, `dataGrid`, `codeEditor` and `graph`. The Control Center shows dataset previews, data diffs, audit tables and a lineage graph (`PRODUCT.md` §4), and the Cockpit shows query results (§5). Synapta's rule is server-side truth: cursor chains with no total.
- **Proposal.**
  - A schema keyword for a handle to a paged collection, with the row schema and a page bound.
  - A source may answer a handle. The host issues it for the viewer; the library never reads inside it.
  - `<Surface resources>` is the app's fetcher. An implementation asks for a page by cursor, and the surface validates each page against the declared row schema before the implementation reads it. That is law 2 for this path.
  - The widget and an agent see the handle's declared shape, never the rows.
  - The starter's `table` accepts a handle.
- **Acceptance.**
  - A source of one million rows scrolls with no host intent per page.
  - A page that fails its schema draws the node fallback and raises a `SurfaceEvent`.
  - A handle of the wrong kind is `invalid-prop` at validation.
  - Renderer conformance covers both adapters, and a bench records scroll latency.

## LF-38 · Feature · Finer patch operations

- **Problem.**
  - A `set` operation replaces a node's whole props (`src/validate/patch.ts:217-218`). A chart whose series live in one prop re-sends and re-validates the full array for one point.
  - `applyPatch` copies the parent's child array per operation and re-indexes the tree on every chained apply (`src/validate/patch.ts:51`, `:64-67`, `:116`). Audit run: 200 operations on 5,000 rows take 6 ms.
- **Proposal.** A per-prop `set`, an array splice operation for array props, and an index carried from one applied tree to the next.
- **Acceptance.** Patch bytes and apply time for a one-point chart update are recorded, and the patch corpus gains the new operations.

## LF-39 · Feature · Hydration draws every node twice; no streaming server rendering

- **Problem.**
  - Recorded: `hydrateRoot` makes 1,358 renders in 44.5 ms where `createRoot` makes 679 in 15.8 ms (development build). `docs/adopters-0.4.md` P5 confirms that hydration keeps a separate post-mount draw.
  - Overlays wait for mount, because `portal` is undefined during server rendering (`docs/renderer.md:666-672`).
  - Server rendering is `renderToString` only. Nothing in `src` supports streaming or Suspense.
- **Evidence (Synapta).** The web app is React Router hybrid SSR. Its rule is that one GET reaches every panel and state, with no hydration-only nodes.
- **Proposal.**
  - Hydrate in a single draw.
  - Document and test `<Surface>` under `renderToPipeableStream` and inside a Suspense boundary.
  - State which overlay content, if any, is absent from server markup.
- **Acceptance.**
  - Hydration renders each node once, measured on the production build.
  - A streaming server-rendering test runs in the renderer suites.

## LF-40 · Feature · Embedding: a custom element, a DOM starter registry, style isolation

- **Problem.**
  - `/dom` has no server rendering and no starter registry, and no custom element ships (`docs/adopters-0.4.md`, "Not delivered").
  - Shadow DOM isolation is outside the CSS projection (`docs/spec.md:558`), so a host page's styles can reach a surface and a surface's sheets load into the host page.
- **Evidence (Synapta).** The embed SDK places the dock, queues and app widgets inside a customer's own web application, with host theming (`PRODUCT.md` §5).
- **Proposal.**
  - A packaged `<lf-surface>` element over `/dom`.
  - A DOM registry for the starter kinds.
  - An isolation mode: shadow root, or `@scope` with a reset.
- **Acceptance.** A page with hostile global CSS draws a conformant surface, and `domRendererBrowserSuite` runs inside the element.

## LF-41 · Feature · Benchmarks at adopter scale and a passing quiet-host gate

- **Problem.**
  - The largest benchmarked tree is 679 nodes and 50 rows. Nothing runs at the 5,000-node cap.
  - The only update rate measured is ten a second with one row changing.
  - No bench covers many viewers, many surfaces on one page, a network store, token streaming end to end, or memory per `Served`.
  - Hydration is measured on the development build only.
  - The 0.4.0 quiet-host run is recorded as "NOT a clean quiet-host pass", and the validator stage exited 1 (`plans/evidence/040-bench-attempt-best.md`).
- **Evidence (Synapta).** S6's exit evidence includes "a measured render and arrival budget".
- **Proposal.** Add these benches, each with a budget:
  - a tree at the cap;
  - a burst of patches and a full re-sort;
  - twelve surfaces on one page;
  - 1,000 viewers of one placement;
  - a store with simulated latency;
  - a stream end to end;
  - a production hydration.

  Run them on a host that passes the quiet rule, or change the rule to one that can pass.
- **Acceptance.** A clean recorded pass, and CI fails on a regression of any budget.

---

# Interaction and dense UI

## LF-42 · Bug (interaction) · A second emit from one revision is dropped

- **Problem.**
  - `checkOffered` refuses an origin whose revision is not the served one (`src/validate/offered.ts:34-35`).
  - `docs/renderer.md:505-507` says: "Two emits from one revision can race: after a state update the second is stale and must be retried by a fresh interaction with the new tree."
  - So a user who clicks two checkboxes quickly, or types while a state update is in flight, loses the second input. The slower the link, the more often.
  - No emit can declare a rate, so a filter field sends one intent per keystroke.
- **Evidence (Synapta).** Queue actions (claim, complete, snooze) are clicked in quick succession.
- **Proposal.**
  - The surface core queues an emit made while one is in flight. When the next revision arrives, it re-checks that the same node still offers the same event and sends the emit with the new revision. If not, it drops the emit with a `SurfaceEvent`.
  - A definition's event may declare `debounceMs` or `throttleMs`, bounded.
- **Acceptance.**
  - A browser test fires two fast emits under simulated latency and both take effect.
  - An emit whose node vanished is reported, not sent.
  - A debounced text field sends one intent per pause.

## LF-43 · Feature · Wider carriers: arrays in local state, selection sets, larger events

- **Problem.**
  - Local state holds at most 32 scalar properties, with strings up to 256 characters and no arrays (`src/formats/manifest.ts:123-127`).
  - An event carries a scalar, an object of at most 32 scalars, or an array of at most 256 scalars (`src/formats/catalog.ts:101`, `:116`, `:149`).
  - An array carry cannot feed `bindAll` or a local write (`docs/adopters-0.4.md`, F3).
  - Selecting more rows than 256, a column order or a set of expanded tree nodes has no carrier.
- **Evidence (Synapta).** Bulk actions over a queue, and multi-select in the access explorer and audit views.
- **Proposal.**
  - Bounded scalar arrays in local state, with local writes that add, remove and toggle a member.
  - A selection carry of the form include-these or all-except-these, so "select all" over a paged collection is one small value.
  - Array carries usable by `bindAll` and local writes.
- **Acceptance.**
  - The validator bounds every new form.
  - Renderer conformance covers a select-all over a handle-backed table (LF-37) and a bulk action that sends the selection.

## LF-44 · Feature · Declared view state for primitives

- **Problem.**
  - Column widths, column order, pinned columns, split-pane sizes, zoom and pan live only inside a primitive's component state.
  - Id-keyed reconciliation keeps that state across revisions, but it cannot be validated, restored after a reload, saved per user, or seen by the widget or an agent.
- **Evidence (Synapta).** The grid, the lineage graph and the SQL editor of SP B4, and saved views in the Cockpit (§5).
- **Proposal.**
  - A definition declares a `viewState` schema.
  - The surface gives the implementation the current value and a setter, and validates writes.
  - `<Surface viewState onViewState>` lets the app persist it per user and restore it. It never passes through an intent and grants nothing.
- **Acceptance.**
  - A resized column survives a reload through the app's callback.
  - An invalid stored value is dropped with a `SurfaceEvent`.
  - Renderer conformance covers both adapters.

## LF-45 · Feature · Layout vocabulary gaps

- **Problem.** The style props are a closed list of 41 (`src/formats/fixed.ts:99-141`, `src/validate/style.ts:83-125`). Missing for dense product UI:
  - `position` is `static` or `sticky`, with top and bottom insets only: no sticky inline start or end, so no pinned column, and no `relative`;
  - no overflow control outside the `scroll` kind;
  - no grid child placement or span;
  - no layer token for stacking;
  - `basis` in px only (`src/css/style-props.ts:75`);
  - container queries on minimum width only (`:172`);
  - no density axis.
- **Evidence (Synapta).** The target direction is a dense product-UI register (decision `2026-11-07-1702`). The exploratory Graphite recipes already carry a `density` map.
- **Proposal.** Add the missing props as token-constrained values, and express density as a variant axis the design system resolves. The backlog's `position: relative` and `basis` item folds in here.
- **Acceptance.**
  - Each new prop has validator, projection and browser tests.
  - The starter's table pins a column.

## LF-46 · Feature · Keyboard shortcuts

- **Problem.** Nothing in `src` or the starter binds a key to an event. The Clay request for it was deferred to a future catalog `keys` prop (`plans/requests/clay-adoption-requests.md:208`).
- **Evidence (Synapta).** Operators work the queue from the keyboard.
- **Proposal.**
  - A node may declare shortcuts that raise one of its own offered events, from a closed key grammar.
  - The surface owns dispatch and conflict rules, and exposes the list so the app can show a shortcut sheet.
  - A shortcut never fires while focus is in a text input unless it carries a modifier.
- **Acceptance.** Conformance covers dispatch, scope, conflicts and the text-input rule.

## LF-47 · Feature · Drag and drop

- **Problem.** No drag source, drop target or reorder event exists in the catalog format or the surface.
- **Evidence (Synapta).** §7.4 lets an organisation rearrange layouts, and rules and recipes hold ordered steps.
- **Proposal.**
  - A drag source declares a scalar payload, and a drop target declares an event that carries it.
  - A list reorder is one event that carries the moved key and its new neighbour.
  - Keyboard reordering is required for accessibility.
- **Acceptance.** Conformance covers pointer and keyboard reorder, and `checkOffered` accepts only payloads the tree offered.

## LF-48 · Feature · A navigation intent and URL-bound state

- **Problem.**
  - A widget can offer `setState` or an action, but not navigation. A row that opens a detail page needs an app-specific action.
  - State cannot be bound to the URL, so a filter or selected tab is not linkable and does not survive back and forward.
- **Evidence (Synapta).** Widget state is per viewer and URL-addressed today (`plans/archive/210-LiveframeUiMigration.md`, the LF-06 mapping).
- **Proposal.**
  - A `navigate` intent whose target passes a URL rule declared by the app (LF-20).
  - A manifest may mark state keys as URL-bound. The library gives the app a codec for them, and the app owns the router.
- **Acceptance.**
  - A navigation off the rule is `invalid-prop`.
  - URL-bound state round-trips through the codec and is validated on the way in.

## LF-49 · Feature · File upload

- **Problem.** No event can carry a file, and no primitive can hand bytes to the app.
- **Evidence (Synapta).** Documents and uploaded sources (`PRODUCT.md` §3.1).
- **Proposal.** The handle mechanism of LF-37 in reverse: the primitive gives bytes to an app-supplied uploader, receives an opaque handle, and the event carries the handle. The app checks type and size.
- **Acceptance.** An upload primitive in the starter, and an intent that carries a handle the app did not issue is refused.

## LF-50 · Feature · Overlay behaviour in `/surface`

- **Problem.**
  - The library gives a scoped portal and focus continuity. Focus trap and restore, scroll lock, background inertness, dismiss rules and exit motion are owed by each primitive (`docs/renderer.md:645-651`).
  - The starter gets them from `react-aria-components`. An app that writes its own primitives, or uses `/dom`, rebuilds them.
  - Overlay responsive values read the viewport, not the container (`docs/renderer.md:635-637`).
  - There is no toast or live-region surface.
- **Evidence (Synapta).** S6 writes every primitive in its own canon. Dialog traps are on its accessibility acceptance list.
- **Proposal.**
  - Framework-free overlay helpers in `/surface`, used by both adapters.
  - A surface-level announcement queue for toasts.
  - Overlay responsive values from the surface's container.
- **Acceptance.** The overlay conformance cases pass for a primitive built on the helpers with no other library, in both adapters.

## LF-51 · Feature · Recipe expressiveness and icon sets

- **Problem.**
  - Recipes are a closed property list (`src/formats/fixed.ts:143-175`). Gradients, background images, pseudo-element decoration, keyframes, `:nth-child` and compound variants are outside the projection (`docs/spec.md:558`).
  - Motion is four presets (`docs/formats.md:955`).
  - The starter's icons are eleven text glyphs, and an unknown name validates and draws a placeholder (`packages/starter/src/implementations.tsx:77-91`).
- **Evidence (Synapta).** The approved direction has a motif layer and a working indicator that animates only while work is in motion.
- **Proposal.**
  - A typed gradient value.
  - Named keyframe motions declared as design-system data.
  - Compound variants over declared axes.
  - A zebra rule for collections.
  - An icon-set contract: the app declares its names, and an unknown name is a validation error. This is backlog G26.
- **Acceptance.**
  - Each addition keeps colour authority with theme roles, with injection tests.
  - An unknown icon name fails validation.

## LF-52 · Feature · Layouts as widgets: slot nodes, nested surfaces, cross-surface links

- **Problem.**
  - Liveframe renders surfaces, never pages. Routes, shell and slot layout are the host's (`docs/model.md:18`, `docs/spec.md:65`).
  - A placement's `slot` is a name with no order, size or structure.
  - Nested surfaces are not delivered: nesting leaks unset properties by design, and a test pins that (backlog, "Revisit scoping only if nested surfaces become required").
  - Surfaces coordinate only through `dependents()`, a server-side scan (`src/host/dependents.ts:8-11`).
  - So a page layout cannot be validated, versioned, previewed or changed at runtime by the pipeline that changes a widget.
  - `plans/liveframe-evaluation.md` Tier C item 9 proposed surface slots and cross-surface bindings.
- **Evidence (Synapta).** L11: "Layouts and widgets can be changed at runtime by approved AI proposals." §7.4: "rearrange layouts, add or remove widgets".
- **Proposal.**
  - A catalog may declare a `slot` kind. A layout is then an ordinary widget whose tree contains slot nodes, and the app fills each slot with the placements bound to it.
  - A layout package is hashed, validated, previewed and replaced like any other package.
  - Positive isolation between a layout surface and the surfaces in its slots, with `@scope` or an equivalent.
  - A placement's params may bind to another placement's state key. The host resolves it, and the browser needs no coupling.
- **Acceptance.**
  - A layout widget with three slots renders three independent surfaces, each with its own validator and intents.
  - Replacing the layout package rearranges the page with no deployment.
  - The nesting test becomes a positive isolation suite.
  - A selection in one surface drives another through the host.

## LF-53 · Feature · Template language: sort, group, aggregate, format, dependencies

- **Problem.**
  - The language has 38 operators and no sort, group-by or aggregate (`docs/templates.md:158-176`).
  - `$contains` is case-sensitive (backlog).
  - It has no number or date formatting. The library has no formatter, and the host is told to format through sources (`docs/localisation.md:3-5`).
  - A template package cannot declare library dependencies (`docs/adopters-0.3.md:35`).
- **Evidence (Synapta).** Templates are the sandbox-free path for "create widgets from the app's governed data" (§7.4). A widget that totals or ranks rows needs code today.
- **Proposal.**
  - `$sort`, `$groupBy`, `$sum`, `$min`, `$max`, `$count` and case-insensitive matching, each charged by size under LF-18.
  - Deterministic `$formatNumber` and `$formatDate` that take the locale from `context`.
  - Template packages may depend on template libraries.
- **Acceptance.**
  - The static checker types each operator.
  - A hostile-cost test exists for each.
  - A template renders the same tree in every engine for a fixed locale.

---

# Agent authoring and live customization

## LF-54 · Feature · Data-bound ephemeral surfaces

- **Problem.**
  - `ephemeralManifest` sets `sources: {}` (`src/sdk/elements.ts:294`). Element JSON cannot read data.
  - An agent that shows data must write the values into the JSON as literals. The data passes through the model, costs tokens, can be altered on the way, and goes stale at once.
- **Evidence (Synapta).** L7: agents use governed tools with dual identity. A surface that shows query results should bind to an endpoint the host resolves as the viewer, not to numbers the model copied.
- **Proposal.**
  - `ephemeralManifest({ sources })`, and element JSON values that may be template expressions over `data`.
  - In effect, an ephemeral surface becomes a template document rendered with `renderTemplate` and streamed like element JSON.
  - The host resolves sources as the viewer, and the model sees shapes, not rows.
- **Acceptance.**
  - A streamed surface that binds a table to a source draws rows the model never emitted.
  - A source the manifest does not declare is `undeclared-source`.
  - The schema generators emit the bound form.

## LF-55 · Feature · Customization records: placement revisions, scoped overrides, history

- **Problem.**
  - The store holds immutable packages, placements, state and style records (`src/store/index.ts:14-30`).
  - A placement has no revision, no draft or live status, no audience and no history.
  - Changing a surface means overwriting the placement. Rollback means writing the old one back, and may reset state (`docs/packages.md:179-184`).
  - Per-organisation or per-user variation of one surface has no record.
- **Evidence (Synapta).** §7.4: each customization is a proposal, and it "survives app upgrades, or is flagged for review with a diff". §4 Apps: "app customizations and their history".
- **Proposal.**
  - A placement gains a monotonic `revision` and a compare-and-set write.
  - Optional `Store.placementHistory(id)`.
  - Scoped overrides: a base placement plus override records per scope, merged by one deterministic function along a scope chain the app supplies.
  - A structural `diffPlacement(a, b)`.
  - Approval stays the app's.
- **Acceptance.**
  - Concurrent placement writes do not lose an update.
  - Rollback restores an earlier revision without touching state.
  - The override merge has corpus cases.

## LF-56 · Feature · `classifyPackageChange` and placement rebase on upgrade

- **Problem.**
  - `checkPackages` classifies catalog evolution. Nothing classifies the change from `widget@1.0.0` to `widget@1.1.0`.
  - A host cannot tell a copy change from a new irreversible action without reading both manifests itself.
  - An override or placement written against the old version has no check against the new one.
  - `plans/liveframe-evaluation.md` Tier B item 5 proposed the classifier.
- **Evidence (Synapta).** Proposals route by effect class, and upgrades must keep or flag customizations (§7.4).
- **Proposal.**
  - `classifyPackageChange(prev, next, capabilities)` reports the privilege delta (new actions, new sources, `confirm` and `irreversible` escalations) and the contract delta (params, state, context, local).
  - `rebasePlacement(placement, nextPackage)` answers that the placement still fits, or needs review with pointers.
- **Acceptance.** Deterministic output with corpus cases, and every added action or source is reported.

## LF-57 · Feature · Editing an installed widget: read, patch, diff, propose

- **Problem.**
  - The authoring operations create drafts. None opens an installed package, reads the live tree, or compares two versions.
  - "Move this column" or "add a filter" means the agent writes a whole new package from nothing.
  - The MCP server and `/authoring` have no step after `pack_draft`. Install and place are the app's by spec §14 rule 2, with no seam to attach them.
- **Evidence (Synapta).** §7.4 customization by instruction, where each change is a proposal.
- **Proposal.**
  - `open(packageRef)` returns the sources or the template of an installed package to the draft session.
  - A structural patch for templates, validated like an install.
  - `diff(a, b)` returns the manifest delta (LF-56), a tree delta per scenario and a capture pair.
  - Optional `proposeInstall` and `proposePlacement` hooks on the authoring config. The library calls the app's function and returns its proposal id. It installs nothing.
- **Acceptance.**
  - An agent run changes one prop of an installed template through `open`, patch and `diff`, with no full rewrite.
  - Without the hooks, the operations report that the host does not offer them.

## LF-58 · Feature · Repair during a stream, not after it

- **Problem.**
  - An invalid node is left out mid-stream and its errors are discarded (`src/sdk/stream.ts:555-556`, `:657-662`).
  - The caller learns of it only at `end()`, as the failure of the whole document (`:693-698`).
  - A member after `children` stops progressive drawing (`:613-615`), and `$ref` nodes draw only at the end.
- **Evidence (Synapta).** A model that hears the error early can correct course in the same generation. One that hears it at the end regenerates everything.
- **Proposal.**
  - `push()` returns the errors of nodes it dropped, with pointers.
  - A policy option: stop at the first error, or continue and report.
  - The progressive `$ref` backlog item, raised above.
- **Acceptance.** A stream with one bad node reports it at the chunk that closed the node, and the final result is unchanged.

## LF-59 · Feature · Agent context: a digest by kind, strict-mode schemas, an element check

- **Problem.**
  - `generateDigest` covers the whole catalog and throws over budget (`src/sdk/gen.ts:1451-1458`). The starter's digest is 20 KB for 35 kinds, and a product catalog will be larger.
  - The template schema is not accepted by strict structured-output modes (backlog). The recursive elements schema has the same shape (inferred).
  - No authoring operation validates element JSON. An agent has to render to find out.
- **Proposal.**
  - `generateDigest({ kinds })` and a short index digest, so an agent reads the index first and details on demand.
  - A depth-limited, all-required schema form for elements and templates, with the provider it was checked against named.
  - A `check_elements` authoring operation.
- **Acceptance.**
  - `--check` drift tests for each generated form.
  - The strict form is accepted by at least one named provider, in a recorded run.

## LF-60 · Feature · An agent evaluation harness with published success rates

- **Problem.**
  - The 0.4.0 agent acceptance is one run per path (`plans/evidence/040-agent-acceptance.md`).
  - The agents were subagents of the authoring session, "one model family", unnamed (`plans/evidence/039-agent-acceptance.md:70`).
  - There are no success rates, no second model and no complex task.
- **Evidence (Synapta).** Synapta gates agents on evals (`PRODUCT.md` §3.5). Choosing element JSON, template or TSX for a task needs numbers.
- **Proposal.** A task set of surfaces at three sizes across the three authoring paths, a runner with a model adapter, and a report per release: first-pass validity, repair turns, tokens and errors by kind.
- **Acceptance.** A recorded run on at least two model families, and a regression in first-pass validity appears in release evidence.

## LF-61 · Feature · Live-data preview

- **Problem.** Previews render fixture scenarios only. An agent or a reviewer cannot see a draft against the data it will show. `plans/liveframe-evaluation.md` Tier D item 11 proposed a read-only hook.
- **Proposal.** An optional `resolvePreviewSource` on the authoring config: read-only, as the viewer, with action dispatch still disabled. Overlay capture is the backlog item raised above.
- **Acceptance.**
  - A draft renders against the hook's data.
  - No action can dispatch from a preview session.

---

# Adoption

## LF-62 · Feature · A client transport helper

- **Problem.** The browser side of a host is unwritten: applying a patch or a tree, tracking the accepted revision, asking for a whole tree after a gap, keeping the last valid view when a stream stops, and queueing emits (LF-42). `examples/demo-host/client.tsx` does it by hand.
- **Proposal.** A small framework-free client in `/surface` that takes a `send` function and a frame stream and drives a surface core.
- **Acceptance.** The demo host's client uses it, and a test drops and reorders frames.

## LF-63 · Feature · Stability an adopter with stored documents can plan on

- **Problem.**
  - `0.x` may break the public API at every minor (`docs/compatibility.md`). 0.3.0 and 0.4.0 both did, twenty days apart.
  - An adopter stores catalogs, packages, placements, themes and design systems. No statement says whether a document valid under one minor stays valid under the next, and nothing checks a set of documents against a new version before an upgrade.
- **Evidence (Synapta).** Synapta's Graphite themes and design system were written to the 0.2.3 spec and have never passed a validator (`design-artifacts/exploratory/215-data-platform-direction/README.md:58`). Its roadmap gate still reads "0.2.3 or later".
- **Proposal.**
  - A stated rule that a `/1` format document valid in one release is valid in every later release of that format version.
  - `liveframe check <dir>`, which validates an adopter's documents and reports each failure with its migration heading.
  - `liveframe migrate` for stored records, whenever a break needs one.
  - Stated criteria for 1.0.
- **Acceptance.**
  - The corpus is replayed against every release from 0.2.3 onward in CI.
  - `liveframe check` runs in the getting-started gate.

## LF-64 · Feature · `hostSuite()`: conformance for an app's intent boundary

- **Problem.** The conformance kit proves an app's catalog, styling, renderer, store and runner. It does not prove the app's backend refuses what it must: a stale revision, an intent the tree did not offer, an unconfirmed irreversible action, a duplicate, another viewer's surface.
- **Evidence (Synapta).** S6's exit evidence includes "intent-boundary refusal tests pass".
- **Proposal.** A suite that drives an app-supplied `post(intent, origin, session)` with the refusal cases and checks that each is refused and nothing was dispatched.
- **Acceptance.** The demo host passes, and a mutant host that skips `checkOffered` fails.

## LF-65 · Docs · Security guide corrections and an adopter responsibility checklist

- **Problem.**
  - `docs/security.md` is wrong on template bounds (LF-18), on what `hash-mismatch` covers (LF-19) and on the A2UI bound (LF-25).
  - It leaves these adopter duties unstated:
    - server-side confirmation and idempotency;
    - cross-site request forgery on the intent endpoint;
    - keying `Served` and action statuses per viewer session;
    - validating a widget author's literal action arguments against the viewer;
    - an image and link host policy;
    - personal data in trees, patches and events.
- **Proposal.** Correct the statements in 0.4.1. Add one checklist page of what the library checks and what the app must, each row linking to its test or its request.
- **Acceptance.** Each corrected statement cites a test, and the checklist is linked from the README and the host guide.
