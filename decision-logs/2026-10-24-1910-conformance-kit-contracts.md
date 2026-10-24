---
date: 2026-10-24 19:10
status: approved
decision_about: "Phase 5 conformance kit contracts"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Runner-independent conformance cases and an app-owned browser host

## Decision

Adopt the four contracts specified by plan 010 Task 1, now normative in spec §13:

1. **Runner-independent cases.** Every suite returns `ConformanceCase[]`, with `{ name: string; run(): Promise<void>; timeout?: number }`. Apps register cases with `test(name, fn, timeout)`; the kit imports no runner or assertion library. Failures use `ConformanceFailure`, carrying the rule, spec section and bounded diagnostic details.
2. **Two subpaths.** `/conformance` provides catalog, design-system and store suites without host APIs or React. `/conformance/react` provides renderer server and browser suites and `conformancePage()`, with React and DOM access. "One test import" means one kit import per environment.
3. **App-owned browser host.** Browser cases execute in the app's test process through its Playwright `Page`. The app bundles and serves a page whose entry calls `conformancePage()`. The kit bundles and serves nothing and uses type-only Playwright imports. The page accepts trees and style identities, never widget code, and records intents without executing actions.
4. **Coverage fails closed.** App trees and locators must cover every catalog kind and variant, plus every `(kind, variant, state)` styled differently from rest by any installed design system. Missing fixtures fail with the missing coverage named. Apps declare overlay and text-input kinds and supply their fixtures; the catalog does not identify these roles, and the guide must explain that limit.

## Context

Spec §3 promises a conformance kit, §7.4 requires a store suite, and §11 requires renderer overlay lifecycle proof. Plan 010 turns those obligations into shared suites that exercise app-controlled inputs rather than repeat library-internal tests. Task 1 settles the contracts before implementation; later tasks add the exports and suites.

## Approval

- Proposed by: agent, as the four decisions in plan 010 Task 1.
- Approved by user: Yes.
- Approval evidence: the user instructed, "Complete - [ ] Task 1: Record the conformance contracts and write them into the spec from plans/010-Phase-5-Conformance-Kit.md and update the plan once done". This explicitly directs execution of the named contract-recording task; all four decisions are adopted as written.

## Alternatives Considered

1. **Self-registering Bun tests** — rejected: couples adopters to one test runner.
2. **One eager React-dependent subpath** — rejected: store authors would need React for unrelated store tests.
3. **Browser cases executed entirely in page script** — rejected: lifecycle proof needs real keyboard, pointer and wheel input supplied by browser automation.
4. **Kit-owned bundler and server** — rejected: couples the kit to an app build stack and runtime.
5. **Only test supplied fixtures without completeness checks** — rejected: omitted kinds or styled states could produce a misleading pass.

## Rationale and Evidence

- The shared registration loop is documented by Bun, Jest and Vitest. Context7 fetched Bun 1.4.2's docs (newest indexed Bun 1.4 version) and Jest's current source docs on 2026-10-24, confirming promise-returning bodies and numeric third-argument timeouts in milliseconds. Plan 010 records its earlier Vitest v5.0.3 documentation check. These are signature checks, not proof that the future kit has run under all three runners. Bun 1.4.4 documentation was not available in the indexed versions.
- Spec §7.4 already defines the store contract; no storage rule changes here. Separating React tests preserves the host-API-free core required by §13.
- Spec §11 and the Phase 4 decision assign overlay lifecycle to app implementations. The browser suite must therefore drive those implementations through the app's own page.
- The catalog describes props, events, variants and slots, without overlay or text-input role markers (§5). App declarations avoid an unrelated format change while making the coverage limit explicit.
- Spec §2 laws 1 and 4 require trees alone to cross into the page and keep action execution with the app. Test plumbing preserves those boundaries.

## References

- `docs/spec.md` §2, §3, §5, §7.4, §11, §13 — existing obligations and the normative contracts updated here.
- `plans/010-Phase-5-Conformance-Kit.md` Task 1 — four decisions, alternatives and the earlier Vitest documentation check.
- `decision-logs/2026-10-22-1539-widget-packages-and-reference-stores.md` — store suite obligation.
- `decision-logs/2026-10-24-0306-phase-4-renderer-and-preview-contracts.md` — overlay lifecycle ownership and conformance follow-up.
- [Bun 1.4.2 test runtime behavior](https://github.com/oven-sh/bun/blob/bun-v1.4.2/docs/test/runtime-behavior.mdx) — async test bodies and numeric timeout, fetched through Context7.
- [Jest test API](https://github.com/jestjs/jest/blob/main/docs/GlobalAPI.md) — `test(name, fn, timeout)`, fetched through Context7.

## Consequences

- Spec §13 adds `/conformance/react` to the subpath table and host-API exceptions. Roadmap and active execution/planning references use the same placement rules; historical logs and closed plans remain unchanged.
- Plan 010's later tasks implement the cases, page host, complete coverage checks and outsider guide. This decision does not add package exports or runtime code.
- Passing the kit proves the exercised app contracts, not isolation or authorisation. Role declarations remain the app's responsibility; revisit catalog role markers only if adopter evidence justifies a format change.
