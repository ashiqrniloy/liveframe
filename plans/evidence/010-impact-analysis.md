# Plan 010 — architectural impact analysis

Reviewed 2026-10-24 against delivered Tasks 1–9, roadmap Phase 5, spec §3,
§7.4, §11 and §13, and all twelve impact areas in
`.agents/skills/create-plan/references/liveframe.md` §5. The accepted conformance
contracts and state-target decisions remain unchanged.

## Impact areas

1. **Spec.** §13 describes runner-independent cases, two subpaths, an app-owned
   page and required example/state/declaration coverage. §11 now names the
   shipped overlay suite. None — no normative change is needed for this review.

2. **Public API and formats.** `src/conformance/index.ts:1–4` and
   `src/conformance/react/index.ts:1–3` expose the promised five suites, page
   host, failure/case and browser configuration types. `package.json` exports
   both subpaths; export tests pin them. None — no new format, version bump,
   dependency or public API is proposed. Installed-package proof remains F3.

3. **The four laws.** Law 1: the page's tree-only command guard is exercised by
   `conformance_page_accepts_trees_only_and_rejects_unknown_styles`
   (`src/__tests__/conformance-renderer-browser.test.tsx:103–137`); non-tree
   commands are rejected rather than evaluated. Law 2: invalid-arrival server
   cases count implementation calls and require fallback-only markup
   (`src/conformance/react/server.tsx:105–158`); browser cases prove recovery.
   Law 3: app-sheet literal-colour mutants fail
   (`src/__tests__/conformance-design-system.test.ts:60–85`). Law 4: wrong
   carried values/undeclared events fail the interaction case; background
   pointers cannot add an intent (`src/conformance/react/overlays.ts:177–230`).
   The page only records intents, never dispatches them. None — no authority or
   widget-execution path was added; passing conformance does not prove isolation
   or authorization. Law 1 has rejecting command controls rather than a mutable
   app implementation: code loading is not an adopter contract.

4. **Validation.** Catalog examples validate before traversal
   (`src/conformance/catalog.ts:56–74`); renderer examples validate before
   rendering; state/lifecycle fixtures validate and coverage failures name missing
   tuples/kinds. Suite runs wrap failures as bounded `ConformanceFailure` records
   (`src/conformance/case.ts:7–21`, `src/conformance/react/browser.tsx:241–265`).
   None — no second validator or unvalidated widget-data execution path found.

5. **Styling.** The suite reuses install validators and CSS projection
   (`src/conformance/design-system.ts:46–121`); reachability reuses resolved
   emitted declarations and the projection's state selectors
   (`src/conformance/react/states.ts:21–99`). The proof passes Certified/Rack
   themes and systems; Task 7 removed unreachable copied state recipes. None —
   no new projector or colour authority. The optional sheet scan checks supplied
   contents, not external imports; the guide states that limitation.

6. **Interaction tiers.** Interaction fixtures assert exact complete intents,
   including no intent for local changes (`src/conformance/react/browser.tsx:81–104`).
   Survival and switching cases preserve focus, scroll, draft and DOM identity.
   Overlay/text cases test inert backgrounds, exit completion, reduced motion and
   code-point bounds. F1: closed-then-open fixtures do not cover the proof
   dialog's initially-open relocation defect.

7. **Performance.** Task 1 is documentation only. Tasks 2–8 record suite wall
   times: stores 48.31/38.69 ms, catalog 38.14 ms, styling 115.63 ms, server
   935.73 ms, browser 8770.85 ms, states 57156.01 ms and overlay/text 10730.70 ms.
   Task 9 records its guide test at 653.53 ms (focused registration run 1.158 s).
   These are observations, not adopter budgets. None — the kit is off the runtime
   render/validation/style path and this review adds no runtime behavior.

8. **Portability.** The scan covers host-free `/conformance` and the DOM exception
   `/conformance/react`; Playwright imports are type-only and no test runner is
   imported by the kit. No proof imports enter published implementation modules.
   F2: Bun/Chromium execution does not establish Vitest/Jest or other-browser
   compatibility. Existing G29 remains the native-platform/AT release gate.

9. **Agent authoring.** Named cases, spec sections, bounded diagnostics and
   pointed library errors are actionable. Generated widget types are unchanged.
   None — spec §13's MCP scope is catalog/types/pack/preview/capture; it does not
   require running adopter conformance, whose browser page and fixtures are
   host-owned. Do not add a conformance MCP command without adopter demand.

10. **Docs and examples.** `docs/conformance.md` documents fresh store scopes,
    explicit overlay/text-input declarations, SSR-visible examples, deferred
    browser content, profiling builds and closed-then-open lifecycle fixtures.
    `src/__tests__/conformance-guide.test.ts` compiles/runs the examples and
    checks snippet agreement. Related guides link to it. None — current guide
    accurately states the tested scope; F1/F2 remain explicit limits.

11. **Conformance.** Both reference stores register the public store cases.
    `proof/tests/conformance.test.ts:10–42` runs catalog, styling and server
    cases; `proof/tests/conformance-browser.test.ts:19–58` runs browser, all
    styled states and lifecycle/text cases across both systems/themes. Broken
    stores, catalogs, styles and implementations fail named rules. F3: Phase 6
    still needs the demo to run the installed kit. F4: a custom runner still has
    no shared contract suite; that conditional P4 item already exists.

12. **Reference hosts.** Task 9's adopter handoff lists fresh/reopened database
    scopes, examples, locators, declarations and app-owned page/server setup.
    None — no production adoption is claimed or library behavior bent for either
    host. Overlay/text-input catalog markers were considered: no evidence that
    the documented declarations proved error-prone warrants a format change.

## Findings and owner dispositions

Owner approved all four backlog dispositions on 2026-10-25 while executing
plan 012 Task 1: “Approve all eight dispositions” (these four and plan 002
F1–F4). F1 is P1 targeted at plan 013 Task 5: the demo host must fix it before
release; fixing the museum proof primitives is optional. F3 is scheduled in
plan 013 Task 6. F2 and F4 retain their stated priorities and evidence limits.

| ID | Finding and evidence | Approved disposition | Handoff |
| --- | --- | --- | --- |
| F1 | First-arrival `dialog.open: true` leaves the proof dialog under an inert ancestor and Escape does not dismiss it. `proof/renderer/primitives/index.tsx:367–392` passes an absent portal initially, then the mounted container; Task 8 only tests closed-then-open lifecycle. Reproduced below. | backlog | P1, before Phase 6 release: defer initial modal mounting until its portal exists; first add a regression for initially-open mounting, Escape/close intent and background inertness. Confirm SSR/hydration and the existing lifecycle suite still pass. The exact fix remains subject to diagnosis. |
| F2 | All executed suite registrations use Bun; browser proof uses Chromium (`proof/tests/conformance-browser.test.ts:1–12`). Signature documentation is not execution evidence. | backlog | P3: smoke-test runner registration in Vitest/Jest using Bun as tool runner, and run adopter-relevant Firefox/WebKit coverage; retain Bun/Chromium as the current evidence limit. No new dependency in this task. |
| F3 | The conformance guide runs checkout imports; Phase 6's external demo has not run the kit from an installed release archive (`src/__tests__/conformance-guide.test.ts`, `package.json` files/exports). | backlog | P2, Phase 6: extend the existing installed-package release gate to register store/catalog/styling/server/browser cases on the demo's own subjects and page, with optional-peer separation and archive contents checked. |
| F4 | A host-supplied isolated runner has no public shared suite. The existing “Evaluate a conformance suite for runners” entry already records this conditional work (`plans/backlog.md`). | backlog | Keep that P4 entry, attach this analysis as evidence and evaluate only when an adopter supplies a runner. Do not create an SDK suite. |

## Initial-open dialog reproduction

Task 10 ran this read-only probe from the repository root (no production edits).
It printed `{"inertAncestor":true,"dialogsAfterEscape":1,"intents":[]}`.
That confirms the observed defect, not a general root-cause proof for React Aria.

```sh
timeout 45s bun --eval '
import { chromium } from "playwright";
import { browserHost } from "./src/__tests__/fixtures/conformance-browser-host.ts";
import { fixtures, pageOptions } from "./proof/tests/fixtures/conformance.ts";
import { primitiveCss } from "./proof/renderer/primitives/base.ts";
const server = await browserHost(`${process.cwd()}/proof/host/conformance-client.tsx`, primitiveCss);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(server.url.href);
  await page.waitForFunction(() => !!window.liveframeConformance);
  const tree = structuredClone(fixtures.overlays[0].tree);
  tree.root.children.find(n => n.kind === "dialog").props.open = true;
  const styles = {theme: pageOptions.themes[0], designSystem: pageOptions.designSystems[0]};
  await page.evaluate(async ({tree, styles}) => window.liveframeConformance.mount(tree, styles), {tree, styles});
  const dialog = page.getByRole("dialog", {includeHidden: true});
  await dialog.waitFor({state: "attached"});
  const inert = await dialog.evaluate(e => !!e.closest("[inert]"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  console.log(JSON.stringify({inertAncestor: inert, dialogsAfterEscape: await dialog.count(),
    intents: await page.evaluate(() => window.liveframeConformance.intents())}));
} finally {
  await browser.close();
  server.stop(true);
}'
```

## Verification

- `timeout 600s bun run check` passed: generation drift, both typechecks,
  lint, formatting and 557 tests across 82 files, zero failures (228.39 s).
  Lint retained 37 existing warnings and 3 informational findings.
- `timeout 120s graft build` and `git diff --check` passed. Chromium is already
  installed; no installation or runtime dependency change was required.
- `timeout 300s bun test src/__tests__/conformance- src/__tests__/store- proof/tests/conformance`
  passed: 104 tests across 12 files, zero failures (112.31 s), including all
  three `proof/tests/conformance-browser.test.ts` registrations. The full check
  also ran those browser registrations; no third identical run was needed.
- Phase 5 Done evidence: public registrations above prove both stores and the
  proof catalog/styles/renderer; the compiled guide proves one kit import per
  environment. Owner dispositions were approved on 2026-10-25 as recorded above.
- Closure verification, 2026-10-25: `timeout 900s bun run check` passed
  (590 tests across 87 files; zero failures; 251.08s; 38 existing lint warnings
  and 3 informational findings), including the law rejection/mutant controls
  and every Phase 5 Done registration. Phase 5 is complete; deferred findings
  remain explicit backlog work rather than claimed fixes.
