---
date: 2026-11-01 17:47
status: approved
decision_about: "0.2.2 release scope (performance and host accessibility), opt-in rule for observable changes, and the no-break rule"
proposed_by: "both"
explicitly_approved_by_user: true
---

# Decision: Release 0.2.2 scope and API stability

## Decision

Release 0.2.2 ships performance and accessibility work as additive changes only. There are two groups:
- **Core:** a production-build browser profile, node reuse in `<Surface>` for whole trees, compiled-validator caching, the pure host helpers `bindSources()` and `renderKey()`, a recipe-derived contrast audit, and focus continuity.
- **Accessibility format additions:** the recipe states `pending`, `mixed`, `current` and `readonly`, a `nodeRef()` schema form (gated on its own design approval), and accessibility capture axes: text scale, forced colours and reduced motion.

Extension recipe properties and multiple variant axes get their design decisions during 0.2.2 and ship in 0.3.0.

**Opt-in rule.** Changes nobody can observe (node reuse, validator caching) are on by default. Changes a host can observe (focus continuity, the contrast audit) are opt-in in 0.2.2. Making any of them the default is a 0.3.0 decision with a migration entry.

**No-break rule.** If any task finds that an existing contract must break, it stops. It either redesigns the change additively, or moves the item to 0.3.0 with a full migration entry: before and after, a code sample and an adopter checklist.

## Context

On 2026-11-01 the owner asked for a review of `plans/liveframe-evaluation.md` (an untracked evaluation draft) and an independent assessment, with two goals:
1. Improve performance as far as possible.
2. Let hosts design any UI they want, both visually and for accessibility.

The review checked the evaluation's claims against code, the spec and the evidence. It found:
- **Where the time goes.** With whole-tree transport, React work dominates arrival cost, not validation. On the LF-17 subject (679 nodes, 50 rows), validation plus React work is **10.7 ms** median, against **2.7 ms** when the same updates arrive as patches (`plans/021-Phase-7-Part-H-Release-0-2-1.md` Task 12 notes; `plans/evidence/021-streaming-patches.md`). Both figures are from a development React build. The renderer already reuses work for nodes whose object is unchanged (`src/react/renderer.tsx:217-311`), but a freshly parsed whole tree has no unchanged objects, so nothing is reused. The development-build selection update measured 2.5–3.0 ms validation against 58.8 ms Profiler render (`plans/backlog.md`, "Profile production browser selection costs before optimizing the renderer", P2).
- **Repeated compilation.** `compileValidator` re-validates the catalog and capabilities and compiles every definition on every call (`src/validate/compile.ts:116-126`). That costs 0.73 ms per call on the 24-definition proof catalog (`plans/requests/clay-adoption-requests.md:207`). The demo host compiles a validator on every render (`examples/demo-host/server.ts:90`). The worker runner's host re-validation recompiles on every call (`plans/backlog.md`, "Record the worker host re-validation cost in a budget", P4).
- **No request-time source binding.** `manifest.sources` bindings are checked at install (`src/formats/manifest.ts:131-161`), but no library function evaluates them at request time. Spec §8 allows caching a re-run on an input hash, yet ships no helper that computes the key.
- **Accessibility gaps the library owns:**
  - Theme installation checks contrast only for declared pairs (`src/formats/theme.ts`). Nothing checks the pairs that recipes actually produce.
  - `<Surface>` has no focus handling, so focus falls to `<body>` when the focused node is removed (`src/react/renderer.tsx`).
  - Nodes cannot reference each other, so a field cannot point `aria-describedby` at its error text.
  - The state list (`src/formats/fixed.ts:4`) has no busy, mixed, current or read-only state.
  - Capture cannot emulate forced colours, reduced motion or enlarged text (`src/preview/capture/index.ts`).

The compatibility policy (`docs/compatibility.md`, R15) says a patch never breaks the public API, the formats or the `fileStore` layout. It allows additive exports, error kinds, corpus cases, vectors and optional format additions. 0.2.1 set the precedent: it added the `deferOffscreen` style prop to the exported `styleProps` tuple and to `liveframe-catalog/1` validation, and added tree patches, all in a patch release.

## Approval

- Proposed by: both. The owner set the two goals, the 0.2.2 target and the stability requirement; the agent proposed the scope options and rules.
- Approved by user: Yes.
- Approval evidence, 2026-11-01. The owner instructed: "Create the decision log and create the plan document targetting 0.2.2 … Keep in mind I want to keep API as stable as possible. Enforce this in the plan so that unnecessarily API contracts are not broken. If they are, must be documented in details so that hosts currently using liveframe can adopt easily". Asked three questions, the owner selected:
  - Scope: **"Core + a11y formats (Recommended)"**.
  - Observable changes: **"Opt-in in 0.2.2 (Recommended)"**.
  - A contract that must break: **"Stop, defer to 0.3.0 (Recommended)"**.

## Alternatives Considered

1. **Core only, with no format additions.** Not selected. Hosts would still lack busy, mixed, current and read-only cues, node-to-node references, and accessibility capture until 0.3.0.
2. **Core plus every extension, including extension recipe properties and multiple variant axes.** Not selected. Those two are the largest format changes, and every port (such as Clay's Rust validator) would have to follow them in a patch. They get design decisions now and ship at the 0.3.0 minor.
3. **Observable changes on by default, with an opt-out.** Not selected. An upgrade would move focus without any host action.
4. **Allow breaks in 0.2.2 with owner approval.** Not selected. It contradicts R15's patch rule and would require amending the compatibility guide.
5. **Adopt the evaluation's roadmap as written.** Not selected. The evaluation:
   - proposes incremental validation and a `<Surface>` patch prop, both deliberately excluded by `decision-logs/2026-10-30-1928-tree-patch-format.md` ("revisit only with measured need");
   - aims performance work at validation, which is the smaller cost;
   - cites `clay-adoption-requests.md:209` for opaque handles, although that source says "No library change is needed";
   - leaves out the accessibility gaps above.

## Rationale and Evidence

- **Performance order follows measurement.** The production profile comes first because every browser figure on record is from a development build (roadmap §1: "An optimisation … is added only when a measurement calls for it").
- **Node reuse is the largest measured gain.** It closes most of the 10.7 ms → 2.7 ms gap for hosts that send whole trees, without any transport change. It adds no API. The node-object reuse `<Surface>` already performs (plan 021 Task 12) and React's rule that an unchanged element object is not re-rendered make it safe, because a reused subtree is deep-equal to the one that arrived. React's documentation confirms the bailout ("if React sees the same exact JSX as during the previous render, it won't try to re-render your component"; react.dev `useMemo`, "Memoizing individual JSX nodes", fetched through Context7 `/reactjs/react.dev`).
- **Validator caching must keep identity semantics.** The cache stores the compiled catalog keyed by its content and still returns a new validator object on every call. Nothing a caller can observe changes, including after a caller mutates its input documents.
- **The new pieces are additive and opt-in.**
  - `bindSources()` and `renderKey()` are pure additions that reuse existing semantics: the binding grammar in `manifest.ts`, and `canonicalJson`/`sha256` in `/pack`.
  - The contrast audit is a new function and an opt-in conformance option. It never changes theme or design-system installation, so no install that passes today can start failing.
- **Format additions follow the 0.2.1 precedent.** The new states widen `states`, the published recipe-key pattern and recipe validation. `deferOffscreen` widened `styleProps` and catalog validation in exactly the same way in 0.2.1. No existing corpus case, vector or document changes meaning. Every recipe that is valid today stays valid and projects byte-identical CSS when it uses none of the new states.
- **`nodeRef()` is gated.** Authors do not know the key-path ids that `render()` derives (spec §7.1), so the reference form needs its own design and owner approval before it is implemented. If no additive design holds, it moves to 0.3.0 under the no-break rule.
- **Capture axes follow the existing optional-method pattern** of `CaptureSession.layout?`, so custom capture backends keep compiling. Playwright's `page.emulateMedia` supports `forcedColors` (since 1.15) and `reducedMotion` (since 1.12), inside the existing `^1.49.0` peer floor (Context7 `/microsoft/playwright`, `class-page.md`). The `contrast` option needs 1.51, so it is out of scope: raising the floor would narrow the peer range.
- **Enforcement is mechanical.** The plan's first task freezes the 0.2.1 declaration surface into a baseline. A test then fails on any removed export or changed declaration that the release's API register does not classify, with a reason, as additive.

## References

- `plans/liveframe-evaluation.md` — the evaluation under review (untracked draft).
- `docs/compatibility.md` — R15 versions, formats and growth rules; the 0.2.1 section.
- [0.2.1 scope decision](2026-10-30-1914-release-0-2-1-scope-and-patch-content.md) — additive-in-patch precedent.
- [Tree-patch format](2026-10-30-1928-tree-patch-format.md) — incremental validation and a renderer patch prop deferred.
- `plans/evidence/021-streaming-patches.md`; plan 021 Task 12 notes — whole-tree and patch-mode arrival costs.
- `plans/backlog.md` — "Profile production browser selection costs before optimizing the renderer" (P2); "Record the worker host re-validation cost in a budget" (P4); "Revisit scoping only if nested surfaces become required" (P4); "Evaluate an atomic-class route for strict style CSP" (P3).
- `src/react/renderer.tsx:55-69,166-311`; `src/validate/compile.ts:116-249`; `src/runner-kit/cache.ts`; `src/formats/manifest.ts:18-21,131-195`; `src/formats/fixed.ts`; `src/preview/capture/index.ts:35-44`; `src/pack/hash.ts`.
- `plans/requests/clay-adoption-requests.md:205-212` — catalog recompilation cost; opaque handles need no library change.
- [Playwright `page.emulateMedia`](https://playwright.dev/docs/api/class-page#page-emulate-media) — `forcedColors`, `reducedMotion`, and `contrast` (1.51).
- [React `useMemo` — memoizing individual JSX nodes](https://react.dev/reference/react/useMemo#memoizing-individual-jsx-nodes) — element-identity bailout.

## Consequences

- Plan 022 implements this scope. Every task carries a Compatibility criterion and updates the 0.2.2 API register. `docs/compatibility.md` gains a 0.2.2 section, and a "Deferred to 0.3.0" list if any item is deferred.
- **Hosts upgrading from 0.2.1 change nothing.** Whole-tree hosts get node reuse automatically. A node whose implementation threw still retries on the next arrival, as in 0.2.1. Focus continuity, the contrast audit, the new states, `nodeRef()` and the capture axes take effect only when a host uses them.
- **Ports such as Clay's Rust validator** must accept the new recipe states and, if `nodeRef()` ships, its reference check. New corpus cases carry both. Existing cases are unchanged.
- **Code that exhaustively maps the exported `states` tuple** (for example `Record<(typeof states)[number], …>`) sees four new members. The 0.2.2 notes give the one-line fix (`Partial<Record<…>>` or a default branch), as with `styleProps` in 0.2.1. The compatibility guide's Growth section names `states` as a growing vocabulary.
- **Revisit** if:
  - the production profile shows React work is not the dominant cost, which reorders the performance tasks;
  - `nodeRef()` has no additive design, which moves it to 0.3.0;
  - any task finds a necessary break, which moves that item to 0.3.0 with a migration entry.
- This decision does not authorise publishing. 0.2.2 needs the release checklist and the owner's explicit go.
