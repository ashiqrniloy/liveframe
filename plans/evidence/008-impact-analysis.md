# Plan 008 — architectural impact analysis

Reviewed 2026-10-24 against delivered Tasks 1–10, roadmap Phase 4 Part A,
spec §2, §6.4, §8–§11 and §13, and all twelve impact areas in
`.agents/skills/create-plan/references/liveframe.md` §5. The approved
`decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md`
supplies the contracts. This closeout changes no normative design, runtime
code, public API, dependency or format.

## Impact areas

1. **Spec.** `docs/spec.md:590–616` matches the factory, manifest-backed
   arrival check, wrapper/portal scopes, item contexts, complete intents,
   revision handling and SSR exception. `src/react/renderer.tsx:84–225`
   implements them. Server implementation errors escape to the host; only
   successful SSR and invalid-tree fallbacks promise matching hydration.
   None — no normative correction required. F1 corrects obsolete backlog
   instructions, not the accepted contracts.

2. **Public API and formats.** `src/react/index.ts` exports exactly two runtime
   names, `createRenderer` and `implement`, plus types; Surface comes from the
   factory. `package.json` exports `./react` and declares optional React/React
   DOM peers. `src/__tests__/exports.test.ts` and `react-types.test.tsx` pin
   the runtime/type surface. No schema or wire-format change. None — no
   version bump, export or packaging change is needed. Existing Phase 6 archive
   and installed-package gates remain open; checkout tests do not close them.

3. **The four laws.** The browser draws trees, not widgets; package execution
   remains in the backend runner. Node contexts use only `/css` slot/style
   output (`src/react/renderer.tsx:171–210`), with no product kind, colour or
   raw-CSS escape hatch. Law 2 rejects malformed arrivals before implementations
   run (`src/__tests__/react-surface.test.tsx:38–66`), including unknown kinds,
   host elements, invalid props and undeclared events. Law 4 is enforced at
   dispatch (`proof/host/pages.ts:41–93`);
   `proof/tests/host.test.ts:30–50` rejects unknown/unoffered state and actions,
   invalid args, extra fields and stale revisions without changing state or
   logging actions. Bound arguments are requests, not authority
   (`src/__tests__/react-intents.test.tsx:115–128`). None — no new leak found.

4. **Validation.** Startup validates the catalog and collects typed registry
   errors (`src/react/renderer.tsx:84–114`). Surface validates before reading
   revisions (`:127–142`); invalid arrivals show only fallback, while replacing
   the validator drops the old contract's accepted tree. Browser tests cover
   invalid arrivals, stale revisions, recovery and implementation exceptions
   (`src/__tests__/react-browser.test.tsx:66–225`). Carries violations throw
   without emitting (`react-intents.test.tsx:55–73`); these are implementation
   bugs, not untyped transport failures. Installed documents, immutable tree
   identities and a validator compiled for the same catalog are host inputs,
   documented in `docs/renderer.md`. F3 retains the manifest prerequisite.
   Existing SDK data-cache/composed-prop findings remain in their own backlog;
   this renderer review does not close them.

5. **Styling.** Slots and inline declarations come from `/css`; wrapper and
   sibling portal share scope attributes. `src/react/renderer.tsx:144–170`
   suppresses transitions before applying scope changes and resolves styles
   before clearing suppression. `react-browser.test.tsx:226–395` proves portal
   scope, switching sequence, no primitive renders/transitions, stable focus,
   sibling isolation and the warm blur gate. Surface-only containment preserves
   parity; per-parent containers are unnecessary. F1 closes the old CSS handoff.
   None — no recipe/projection correction or containment exception is needed.

6. **Interaction tiers.** `proof/tests/host.test.ts:207–285` proves local controls
   send no request, state sends one request while retaining focus/draft/scroll/
   disclosure, and a bound action logs once without changing revision.
   `proof/tests/renderer-browser.test.tsx:236–383` proves exit completion,
   reduced motion, scroll lock and background blocking in both systems.
   App React Aria implementations provide lifecycle; the test supplies exit CSS
   because the proof recipes define none. None — no behaviour-library shortfall
   justifies library lifecycle code. F5 preserves conformance/manual audit work.

7. **Performance.** Required Task 5/7/8 measurements are recorded below.
   Existing warm-switch and HTTP state gates pass; 679-node validation and React
   observations exceed the 2 ms reporting threshold. F2 requires production-build
   profiling before choosing an optimization. Development Profiler durations
   are not isolated DOM mutation/paint time or a new budget, and the backend
   SDK render budget is not an end-to-end browser budget. The independent
   standalone validator-performance backlog remains open.

8. **Portability.** `src/__tests__/portability.test.ts:5–12,54–105` restricts
   React/DOM allowances to `/react`, preserves the no-proof import rule and
   keeps host APIs out of core. No new runtime dependency; peers are optional.
   `react-ssr.test.tsx` and `react-browser.test.tsx:397–476` cover Bun SSR and
   Chromium hydration, including the documented server-error replacement path.
   None — other browsers/runtimes, installed archives and real platform/AT
   behavior are not established by this checkout's tests (F5).

9. **Agent authoring.** `src/react/implement.ts:4–52` derives props, slots and
   carries from literal definitions; type tests reject incorrect use. JSON-loaded
   definitions deliberately use JSON records/string names and allow explicit
   narrowing. F4 records conditional implementation-type codegen demand without
   changing `liveframe gen` or blocking the shipped API. Registry errors retain
   pointers and `catalog-mismatch`; event errors identify kind and event.

10. **Docs and examples.** `docs/renderer.md` covers installed inputs, all
    implementation inputs, the state table, complete intents/host checks,
    switching, overlay obligations, Unicode code points and SSR/hydration.
    `src/__tests__/fixtures/renderer-guide.tsx` is compiled and server-tested
    by `renderer-guide.test.tsx`; model/styling docs and execution references
    link to the delivered renderer. F1 reconciles three stale backlog handoffs.
    None — no additional outsider-guide change is needed.

11. **Conformance.** Task 10 already updated “Seed conformance suites from the
    proof tests” with named registry, arrival, fallback, completion, tiers,
    survival, overlay, switch and hydration cases. It separates browser/server
    execution and app-supplied implementations/drivers from internal React
    caching/type/performance checks. F5 retains this Phase 5 assignment;
    `/conformance` is not claimed to exist. No duplicate handoff is needed.

12. **Reference hosts.** The package-backed proof covers all four reference UIs
    under both systems; `proof/host/view.tsx:23–39` compiles a manifest-backed
    validator. It does not migrate production Synapta or Clay. F3 adds the
    manifest/scoped-portal/host-authorization requirements to their existing
    handoff. G20 is closed in the proof field with Unicode limits and docs;
    G26 icon sets remain Phase 7 and G29 remains a Phase 6 release gate (F5).
    Existing Certified/Rack/native-scrollbar gaps remain adopter work.

## Findings and dispositions

Presented to the owner in one table during Task 11. The owner's instruction to
complete Task 11 and update the plan authorizes the maintenance and backlog
handoffs below; no separate per-row answer was received or is claimed. These
actions preserve accepted contracts and phase assignments, and approve no new
API or architecture. No decision-log amendment is needed.

| ID | Finding and evidence | Recommended disposition | Recorded disposition and result |
| --- | --- | --- | --- |
| F1 | Backlog still calls lifecycle renderer-owned, leaves G20 pending and gives preview a removed `styles` input, contrary to spec §7.5/§11 and Tasks 7–8. | execute | Task 11a corrects the three existing entries and closes the CSS overlay handoff; Task 11 reconciles execution metadata. |
| F2 | 679-node browser arrival/React measurements exceed the 2 ms reporting threshold (`proof/GAPS.md:228–240`, timing test `proof/tests/renderer-browser.test.tsx:214–234`). | backlog | P2: “Profile production browser selection costs before optimizing the renderer”; retain observations and separate validation, React, layout and paint before proposing changes. |
| F3 | Hosts need the manifest in the browser to build the accepted validator (`proof/host/view.tsx:23–39`, spec §11). No current host is shown unable to supply it. | backlog | Existing “Hand adopter gaps to Synapta and Clay” gains the concrete prerequisite and conditional decision-revisit trigger; no catalog-only bypass. |
| F4 | JSON-loaded definitions cannot infer literal implementation prop types (`src/react/implement.ts:4–18,46–52`). | backlog | P4: “Evaluate generated implementation types for JSON-loaded catalogs”, conditional on adopter demand; explicit prop narrowing already works. |
| F5 | Automated proof cannot supply the public conformance suite or native Windows/AT evidence (`proof/GAPS.md:248–249`). | backlog | Existing Phase 5 “Seed conformance suites from the proof tests” and Phase 6 G29 “Later-phase gaps from the Phase 0 reports”; no duplicate entries or changed release gate. |

All five findings are disposed through execution or named backlog entries.
Candidate sweep: streaming SSR has no demonstrated host requirement and
`renderToString` satisfies the accepted contract, so no speculative streaming
feature is scheduled. Overlay lifecycle passes; parity needs no per-parent
container exception. These are explicit no-finding outcomes, not unfinished work.

## Performance evidence

Delivered measurements are historical observations from the named tasks, not
fresh production-build measurements. Commands regenerate the corresponding
checks; images remain local under `/evidence/`.

| Task | Required evidence | Recorded result and reproduction |
| --- | --- | --- |
| 5 | Warm switch ≤ 16.67 ms with blurred overlay and sibling surface; cold recorded | 685 elements: **8.8 ms cold / 7.9 ms warm maximum** over ten switches. `timeout 300s bun test src/__tests__/react-browser.test.tsx`. |
| 6 | Agent-home SSR observation, no budget | **16.91 ms**, test-local implementations. `timeout 300s bun test src/__tests__/react-ssr.test.tsx`. |
| 7 | HTTP state ≤ 50 ms, warm switch ≤ 16.67 ms, parity ≤ 1%, unchanged node count | State **1.36 ms maximum** / 25 warm samples; agent-home/git-status warm maxima **6.4 / 3.8 ms**, cold **13.4 / 4.7 ms**. Parity **0.72% / 0.75% / 0.97%** at 1440/1024/390 px; **679 nodes** unchanged. `timeout 300s bun test proof/tests/host.test.ts proof/tests/switch.test.ts`; `timeout 600s bun proof/scripts/parity.ts --out evidence/parity`. |
| 8 | Same hard gates; report browser validation/React costs above 2 ms | State **1.59 ms maximum**; warm switches **7.4 / 3.6 ms**, cold **10.6 / 4.8 ms**. Certified/Rack validation **2.5 / 3.0 ms**, Profiler render **58.8 / 59.5 ms** plus nested **1.1 / 1.2 ms**, commit-start-to-callback **6.1 + 0.2 / 7.0 + 0.2 ms**, synchronous update **81.8 / 84.6 ms**. `timeout 300s bun test proof/tests/renderer-browser.test.tsx proof/tests/host.test.ts proof/tests/switch.test.ts`. |

Parity counts remain **9,712 / 7,088 / 5,572** changed pixels, with the approved
281 DOM / 32 style differences and no diagnostics. Exact DOM/style equality is
not the accepted pixel bar. Timing samples include development/instrumentation
overhead and depend on machine/load; F2 does not invent a browser budget or
weaken any existing gate.

## Verification

- Task 11a: `timeout 600s bun run check` passed generation drift, both
  typechecks, lint, formatting and **432 tests / 110,355 assertions**, zero
  failures. `git diff --check` passed.
- Whole-plan verification: Chromium installation passed; focused React suites
  passed **37 tests / 193 assertions**, proof suites **86 / 16,731**, and
  CSS-scope/switch suites **10 / 280**, all with zero failures. `graft build`
  passed. Parity capture reproduced **9,712 / 7,088 / 5,572** changed pixels
  (**0.72% / 0.75% / 0.97%**) and empty diagnostics at all three widths.
- Focused refresh: blurred Surface switch **11.2 ms cold / 7.9 ms warm max**;
  host state **1.32 ms max**; agent-home/git-status warm switches **5.7 / 3.4 ms**
  (cold **10.4 / 4.3 ms**). All existing limits passed. The development selection
  sample remained above the reporting threshold: validation **2.3 / 2.4 ms**,
  render **53.6 + 1.2 / 54.1 + 1.1 ms**, commit callback intervals
  **6.0 + 0.3 / 6.7 + 0.3 ms**, synchronous **77.5 / 77.5 ms**. F2 remains open.
- A later full check failed seven existing runner timing/timeout cases:
  in-process overhead **0.6587 ms** against **0.1 ms**, plus worker renders
  exceeding **100 ms** in runner/install-loop cases. No renderer/browser case
  failed. At inspection, load average was **9.59 / 7.14 / 5.70**, with concurrent
  VM processes; contention is a hypothesis, not a proved cause. All **30 affected
  runner/install-loop tests** then passed in isolation, including **0.0776 ms**
  in-process overhead. No code or threshold was changed. A confirming full check
  is recorded below; this failed run is retained rather than hidden.
- One-off Bun assertions confirmed twelve impact areas, five disposition rows,
  every Further Actions backlog anchor and removal of all four legacy renderer/
  host-state files. No new runtime test was needed for documentation changes.
- The confirming `timeout 600s bun run check` passed generation drift, both
  typechecks, lint, formatting and **432 tests / 110,355 assertions**, zero
  failures, in **54.58 s**. `git diff --check` passed. Task 11 and plan 008 are
  complete; roadmap §3 now leaves plan 009 planned as the next phase. Unrelated
  concurrent edits to shared skill references, the plans index and plan 009
  are preserved and excluded from the task commits.
- No production host migration, installed-package proof, streaming SSR, native
  Windows/AT audit or production-build profiling is claimed by this review.
