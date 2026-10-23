---
date: 2026-10-24 03:06
status: approved
decision_about: "Phase 4 renderer and preview API contracts"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: `createRenderer`, validator-checked surfaces and host-transported preview

## Decision

Adopt the following contracts for roadmap Phase 4, with the normative rules written into spec §7.5, §11 and §13 in this change.

**Part A — `/react`**

1. **Arrival check.** `<Surface>` takes the app's `CompiledValidator` (`compileValidator({ catalog, capabilities, manifest })`) and re-checks every arriving tree with it. No second, catalog-only validator.
2. **Renderer factory.** `createRenderer({ catalog, implementations })` runs the registry check once and throws on a missing, duplicate or mismatched kind. It returns `{ Surface }`. `<Surface>` takes `tree`, `validator`, `theme`, `designSystem`, `onIntent` and `fallback`.
3. **Implementation contract.** An implementation receives `props`; `slot(name)` (the slot's one recipe class; the root slot also carries the style-prop classes and the surface/container classes); `style` (the root's inline declarations from `styleDeclarations`); `emit(event, value?)`; `children`, already rendered; `items` (child nodes with their own `render()` and `emit()`, for collection primitives); and `portal` (the scoped container element, or undefined).
4. **Fallback.** A tree that fails validation renders `fallback` for the whole surface; no stale tree is kept. An implementation that throws is caught by an error boundary and renders `fallback` at that node. A lower `revision` is ignored.
5. **Overlays.** The renderer provides the scoped portal container and switches it with the surface. Exit motion, scroll locking and an inert background remain renderer-contract requirements, delivered by the app's implementations (for example through React Aria) and proved by browser tests, later by conformance suites.
6. **Switching.** Changing `theme` or `designSystem` makes `<Surface>` run spec §6.4's `data-lf-switching` sequence on the root and portal container together. Nodes and slot classes are unchanged and widget code does not re-run.

**Part B — preview**

7. **Session.** `createPreview({ catalog, capabilities, runner })` has no `styles` input. `update()` returns `Result<WidgetPackage>`; publishing stores exactly that package.
8. **`<Preview>` transport.** `<Preview>` receives the selected cell's result and the intent log from the host, calls back `onSelect(cell)` and `onIntent(intent)`, and draws with a renderer from `createRenderer`. The host owns the transport.
9. **Matrix proof.** The roadmap's Part B bullet splits: `check()` renders every scenario once on the backend; a browser test draws each scenario in `<Preview>` at three container widths under both proof design systems.

**Dispositions**

10. **Proof gaps.** G20's renderer half is enforced by the test host's `textField` (code-point limits), with an implementer note in the docs. G26 (app-owned icon sets) moves to Phase 7. G29 (real Windows forced-colours and assistive-technology audit) becomes a Phase 6 release gate.
11. **Test host.** The proof host adopts `/react`: the proof primitives move to the new `implement()`, `proof/renderer/surface.tsx` is removed, and parity is re-proved, as plan 007 Task 10 did for `/css`.

## Planning refinements (plan 008 Task 1)

Approved on 2026-10-24 by the user's instruction to complete Task 1 of `plans/008-Phase-4-Part-A-React-Renderer.md` and update the plan. That task explicitly specifies these three refinements and amendment of this log. This section supersedes Part A points 3, 4 and 6 where their wording differs.

1. **The surface wrapper carries the scope.** `<Surface>` renders a wrapper around the tree and a sibling portal container, both with `surfaceAttributes({ theme, designSystem, tree })`: scope attributes, `lf_surface` and, for responsive trees, `lf_container`. Root slots carry only recipe and style-prop classes. The renderer follows spec §6.4, rather than the proof's per-parent container rule. If Task 7 parity regresses, stop and bring the gap to the owner before changing data.
2. **Each item is a node context.** Every `items` entry exposes `id`, `kind`, `variant`, `props`, `slot(name)`, `style`, already rendered `children`, `render()` through its own implementation, and `emit(event, value?)` for that child.
3. **Intent completion and order.** Check event values against the definition's `carries`; a mismatch throws and raises no intent. Before calling `onIntent`, fill a missing `setState.value`, or set action `args[bind]` to the event value and remove `bind`. Preserve explicit state values. Validate arriving trees before reading fields or comparing revisions; invalid trees show whole-surface fallback. Only validated trees can be ignored as stale.

Evidence: `src/css/surface.ts:7–32` already returns both scope classes; `proof/renderer/surface.tsx:17–58` attaches containers to parents instead; `proof/renderer/primitives/index.tsx:313–340,415–450` needs child slots, styles and rendered children for menu and tabs. Spec §8 requires the host to re-check filled action arguments. Spec §11, `docs/model.md` D2 and the renderer skill reference now match.

Alternatives: scope on the primitive root would require forwarding and make a responsive root query itself; limiting items to `render()` and `emit()` would duplicate renderer-owned slot/style logic in collections; passing `bind` through would make every host complete intents. These are rejected for the reasons above. Runtime and parity proof remain in later plan tasks; no renderer code changes in Task 1.

## Context

Phase 4 was scoped on 2026-10-24. Spec §11 and §7.5 were too thin to plan against:

- `compileValidator` needs a manifest (`src/validate/compile.ts:12–16`), but §10 only said the renderer "re-checks structure".
- `<Surface tree onIntent fallback />` named no registry, catalog, theme or design-system identity, yet `styleDeclarations(style, catalog)` and `surfaceAttributes({ theme, designSystem, tree })` (`src/css/surface.ts:7`) need them.
- The proof renderer passes `node`, `nodes`, `render`, `emitNode`, `layout` and `portalContainer` beyond §11's four inputs (`proof/renderer/implement.ts:5–16`). Collection primitives use them (`proof/renderer/primitives/index.tsx:313, 342, 415`); `layout` is used 49 times.
- "Unknown or invalid nodes render the fallback" conflicted with law 2 for partially invalid trees. The proof falls back for the whole tree (`proof/renderer/surface.tsx:59–67`).
- §11 assigned overlay exit motion, scroll lock and inert background to the renderer, while the app's implementations draw overlays and the library ships no components.
- The proof host switches by mutating attributes outside React (`proof/host/client.tsx`).
- `createPreview`'s `styles` input was undefined, `update()` returned only a hash although publishing must store the same package, and `<Preview>`'s transport was unspecified.
- Roadmap Phase 4 Part B asked `check()` to render "at three container widths under both design systems", but a tree does not depend on width or design system.
- `plans/backlog.md` assigned G20, G26 and G29 to Phase 4, though G20 and G26 are primitive implementations and G29 needs hardware and a person.

## Approval

- Proposed by: agent, as recommended options in the Phase 4 scope analysis.
- Approved by user: Yes.
- Approval evidence: the user said "Let's settle the decisions yes", chose the recommended option for each of the eleven questions, then answered "Approved — log it with updates" to the exact decision text above.

## Alternatives Considered

1. **Catalog-only structural validator for arrival** — rejected: new public API and weaker checks (no manifest-level action/state checks) for no gain; the manifest is safe data to send to the browser.
2. **Optional validator** — rejected: the renderer must never trust its transport (§10).
3. **Registry prop or React context provider** — rejected: a prop repeats the registry on every surface; a context hides a dependency and complicates isolated SSR tests. The factory gives "the registry check at startup" a concrete moment.
4. **Ship the proof's full implementation contract** — rejected: raw `node`, `nodes`, `render` and `emitNode` are a larger surface than primitives need. **Keep only §11's four inputs** — rejected: collection primitives on React Aria collections and style props without a wrapper element would not be possible, so parity would fail.
5. **Keep the last valid tree on an invalid one** — rejected: viewers would see stale UI with no signal. **Per-node fallback inside an invalid tree** — rejected: draws partially invalid data, against law 2.
6. **A library overlay hook** — rejected: duplicates behaviour libraries and adds reduced-motion handling to the library. **Renderer wraps overlay kinds** — rejected: the library would need to know which kinds are overlays, which is product-shaped knowledge.
7. **Host mutates scope attributes** — rejected: it fights React over attributes the renderer owns, and portal containers would have to be switched by hand.
8. **`styles` as matrix axes plus a sheet cache** — rejected: trees are independent of themes and design systems, so the backend session does not need them. **Keep `update()` → hash and add `package()`** — rejected: two calls for one result.
9. **`<Preview>` receives every cell's result** — rejected: heavier pages and unclear per-cell interaction state. **A library-defined HTTP protocol** — rejected: contradicts "receives trees through the app's transport".
10. **All three gaps in Part A** — rejected: G29 cannot run in CI and would block the plan on a person. **All to backlog** — rejected: G20 is cheap to cover in the test host now.
11. **A new minimal fixture host, or both hosts** — rejected: proves less, and the proof would keep a second renderer path.

## Rationale and Evidence

- **One validator, one path.** `compileValidator` already meets ≤ 1.5 µs per node (plan 004) and returns errors with `nodeId`, so reusing it in the browser adds no code and keeps backend and arrival checks identical.
- **Inputs the projection already requires.** `styleDeclarations` returns `{ style, classes }` (`src/css/style-props.ts:89`) and `surfaceAttributes` needs theme and design-system identities, so `<Surface>` must receive them. `slot(name)` still yields exactly one recipe class per slot, as spec §6.4 and `docs/styling.md` ("Renderer contract") require.
- **Law 2 decides the fallback.** The validator rejects unknown components, so after validation the only node-level failure left is an implementation that throws.
- **Overlay lifecycle is available off the shelf.** React Aria (Context7 `/websites/react-aria_adobe`, styling and Modal docs, fetched 2026-10-24): components with entry/exit animation expose `data-entering` / `data-exiting`, and an exiting overlay "will … wait for any animations to complete before being removed from the DOM"; a modal "blocks interaction with elements outside it". The fetched docs did not describe scroll locking explicitly. **Assumption:** React Aria's modal prevents background scroll; Part A's browser tests must prove scroll lock and inertness rather than rely on this log. The proof already renders its overlays through React Aria with a portal container (`proof/renderer/primitives/index.tsx:233–407`).
- **Preview stays a backend loop.** `pack()` returns `Result<WidgetPackage>` (`src/pack/pack.ts:8–16`), so `update()` can return the package unchanged and the publish hash equals the preview hash by construction. Host-owned transport matches `<Surface>`'s model (`docs/model.md`, C5).
- **Proven adoption pattern.** Plan 007 Task 10 moved the proof host onto `/css` and re-proved parity at 0.72% / 0.75% / 0.97%; doing the same for `/react` reuses the existing browser tests and real UIs under both design systems.

## References

- `docs/spec.md` §6.4, §7.5, §10, §11, §13 — updated by this decision.
- `roadmap.md` Phase 4 — updated by this decision.
- `plans/backlog.md` — "Later-phase gaps from the Phase 0 reports", "Carry the CSS overlay contract into the production renderer", "Build preview sessions on the shipped package and runner contracts".
- `decision-logs/2026-10-23-2314-css-projection-model.md` — the projection, scope and overlay contract this builds on.
- `decision-logs/2026-10-22-1600-preview-and-runners.md` — the preview decision this refines.
- `src/validate/compile.ts:12–58`, `src/css/style-props.ts:89`, `src/css/surface.ts:7`, `src/pack/pack.ts:8–16`.
- `proof/renderer/{implement.ts,registry.ts,surface.tsx}`, `proof/renderer/primitives/index.tsx`, `proof/host/client.tsx`.
- React Aria documentation, https://react-aria.adobe.com/styling and https://react-aria.adobe.com/Modal (via Context7, 2026-10-24).

## Consequences

- Plan 008 (Part A) and plan 009 (Part B) can be drafted against a complete API; their first tasks no longer need to settle API shape.
- `/react` exports `createRenderer` and `implement`; `package.json` gains `./react`, `./preview/react` and optional `react`, `react-dom` and `playwright` peers when those plans build them.
- The proof renderer is deleted in Part A; `src/__tests__/css-scope-browser.test.ts` and the proof browser tests move to the real renderer.
- Phase 6 gains G29's audit as a release gate; Phase 7 owns G26.
- Revisit if a host cannot send manifests to the browser, if a behaviour library cannot meet the overlay lifecycle and the app needs library help, or if a collection primitive needs more than `items` exposes.
