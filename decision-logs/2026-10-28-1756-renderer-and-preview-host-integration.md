---
date: 2026-10-28 17:56
status: approved
decision_about: "Intent origin, confirmation metadata, host hooks, transparency scope, controlled Preview and implementation types"
proposed_by: "both"
explicitly_approved_by_user: true
---

# Decision: Renderer and preview host integration for 0.2.0

## Decision

Plan 017 Tasks 2–7 implement the contracts below: `origin` with `checkOffered` (LF-01), confirmation metadata and `<Surface confirm>` (LF-08), `wrapperProps` and `portalProps` with a fixed, box-free portal default (CL-02), `transparency="reduced"` (CL-09), a controlled, URL-keyed `<Preview>` with a required `resultScenario` (CL-01), and `liveframe gen --implementations` for JSON-loaded catalogs.

This records the design, not delivery. The `<Preview>` prop change is the one breaking change, already in the [0.2.0 break register](2026-10-27-2028-release-0-2-0-scope-and-breaking-changes.md). Every other change is additive. Format identifiers stay `/1`.

## Context

Plan 017 Task 1 asks for one log that settles each open detail, so Tasks 2–7 implement a single contract. The 0.2.0 scope log fixed the direction; [the plan 015 log](2026-10-28-0024-events-manifests-and-state-scope.md) fixed the completion rule that `checkOffered` reuses (`bind`, `bindAll`, object `setState`, numeric carries).

## Approval

- Proposed by: both. The agent drafted the details; the owner chose between the options marked below.
- Approved by user: Yes.
- Approval evidence: on 2026-10-28 the user asked to complete plan 017 Task 1 and record the decisions. They were shown the full list of non-contested decisions (§§1, 2, 4 merge rules, 5, 6) and four contested choices. They answered each of the four with the recommended option: portal `position: fixed; inset: 0; pointer-events: none`, an internal validator accessor, single-flight confirmation gated on `confirm` only, and a required `resultScenario` prop. They raised no objection to the listed decisions. Approval of the listed decisions is therefore the request itself plus that non-objection; it was not a separate "approve as listed" answer.

## Decisions

### 1. LF-01 — `origin` and `checkOffered`

- `origin = { surfaceId, revision, nodeId, event }`, all four required. `onIntent(intent, origin)` is additive: one-argument callbacks keep working. `origin.revision` and `origin.surfaceId` come from the accepted tree that drew the node, not from props.
- `checkOffered(tree, origin, intent): Result<void>` is exported from the root, beside the validator, and is host-API-free. Its rule, in order, with the first failure's kind and pointer:
  1. `tree.surfaceId` equals `origin.surfaceId` and `tree.revision` equals `origin.revision`: otherwise `version-conflict` at `/origin/surfaceId` or `/origin/revision`.
  2. A node with `origin.nodeId` exists: otherwise `not-found` at `/origin/nodeId`.
  3. `node.events[origin.event]` exists: otherwise `undeclared-event` at `/origin/event`.
  4. The offered intent, completed by the shared rule below with the *candidate's* filled values, equals the candidate intent: the same `type`, `key` or `name`, literal `args` and `bind`/`bindAll` marker. The only permitted differences are the fields completion fills (the `bind` argument, the keys of a `bindAll` object, or the `setState` value). Anything else is `invalid-prop` at the field's pointer.
  5. Each filled value satisfies its schema: the `bind` argument against the action's argument property, the `bindAll` keys against the event's object schema (no key outside it), the `setState` value against the manifest state schema. Failures are `invalid-prop`.
- No new error kind. A tree that is not the one that was served (a different surface or revision) is a conflict; the rest map to existing kinds.
- **One completion rule.** `complete()` moves from `src/react/renderer.tsx:64-90` to `src/validate/complete.ts`. The renderer and `checkOffered` both import it, so the host's check and the renderer's output cannot drift. `checkOffered` accepts every intent the renderer produces by construction.
- **Cost.** `checkOffered` is O(depth to the node) after an id map is built once per tree object (a `WeakMap` keyed by the tree), not per call.
- **Preview.** `createPreview().intent(intent, origin?)` checks `origin` against the session's current tree when it is supplied, and behaves as today when it is not (additive; existing hosts and the MCP server keep working). `<Preview>`'s `onIntent(intent, origin)` always supplies it. The conformance renderer suite records `origin` beside each intent.
- Law 4: forged and stale intents fail closed. `confirm` and `checkOffered` are renderer and host conveniences; the host still re-checks on dispatch.

### 2. LF-08 — `irreversible`, `events` metadata and `<Surface confirm>`

- Capability actions gain optional `irreversible: boolean` (`liveframe-capabilities/1`, additive). `irreversible` without `confirm` is valid: the two are independent.
- `ImplementationProps` and `Item` gain `events: { readonly [event]: { type, confirm, irreversible } }`, keyed by the *definition's* declared events but populated only for events the node actually carries. `type` is `"action" | "setState"`. An event whose intent is `setState` reports `confirm: false` and `irreversible: false`. No argument values, action names or `meta` appear. `items[i].events` is that child's own. Built once per accepted tree inside the existing `useMemo`.
- **Source (owner's choice).** The renderer reads the metadata through an internal WeakMap-backed accessor beside `buildFacts` in `src/validate/compile.ts`. It is not on the public `CompiledValidator` type and `<Surface>` gains no `capabilities` prop. The metadata therefore always comes from the same capabilities the validator was compiled with.
- **`<Surface confirm={(intent, meta) => Promise<boolean>}>`** (owner's choice):
  - It is awaited before `onIntent` for an action whose resolved `confirm` is `true`. `meta` is `{ confirm, irreversible }` for that action. Without the prop, behaviour is unchanged.
  - A `false` result, a rejection or a throw raises nothing: no `onIntent`, no error escapes the event handler.
  - **Single-flight.** While a confirmation is pending, further `confirm: true` emits on that surface are dropped. Emits that need no confirmation are unaffected.
  - An approval that arrives after the surface unmounted is dropped. Otherwise the intent is delivered with the origin captured at emit time; a host that has since moved to another revision rejects it with `checkOffered`.
  - `irreversible` is metadata. It never forces confirmation and never changes what `confirm` gates.
- Law 4: confirmation in the renderer is UI convenience. The host re-checks and authorises on dispatch, and `docs/renderer.md` says so.

### 3. CL-02 — `wrapperProps`, `portalProps` and the portal default

- `wrapperProps` and `portalProps` are `{ className?: string; style?: CSSProperties }`. One `mergeHostProps(scope, host)` helper applies them: the host `className` is *appended* to the library's classes, and the host `style` is applied as inline style. `lf_surface`, `lf_container`, `data-lf-*` and `data-lf-portal` are the library's and cannot be overridden: only these two fields are read from the prop, so no other attribute passes through.
- **Portal default (owner's choice).** `:where([data-lf-portal]){position:fixed;inset:0;pointer-events:none}` and `:where([data-lf-portal])>*{pointer-events:auto}`, in the base sheet, not inline. A host class can therefore still change either rule. The portal is out of flow, so it takes no grid track and adds no flex gap; it keeps a viewport-sized box, so `container-type: inline-size` from `lf_container` still applies and the portal still carries the scope attributes and custom properties its overlays resolve.
- **Consequence for responsive values inside overlays.** Container queries inside overlay content resolve against the portal's width, which is now the viewport width rather than whatever width the host layout gave the old block `div`. A narrow preview cell therefore evaluates responsive overlay content against the viewport, not the cell. Docs state this. It is deterministic, where the old width depended on the host's layout.
- **Spec §11 backdrop rule.** The portal sets no `opacity` and no `filter`, and `pointer-events` does not create a backdrop root, so the backdrop can still sample the page behind it. A host class that adds either breaks the rule; `docs/renderer.md` says so.
- **Containing blocks.** A fixed portal with `container-type` applies layout containment, so it contains its own fixed descendants. Its box is the viewport, so overlay placement is unchanged. A host ancestor with `transform`, `filter` or `contain` still becomes the containing block for the portal; that is host-owned and documented.
- Law 3: the props carry host data only; a tree cannot set them (tested).

### 4. CL-09 — reduced transparency

- `transparency?: "auto" | "reduced"` on `<Surface>`, default `"auto"`. `"reduced"` sets `data-lf-transparency="reduced"` on the wrapper and the portal together.
- The base sheet applies the media query's overrides under `:where([data-lf-transparency="reduced"])`, emitted once and byte-stable. Design-system sheets that use an alpha modifier also emit the attribute's recovery rules (plan 016 Task 7's amendment to plan 017 Task 5); a design system without modifiers is byte-identical.
- The switching effect's scope identity gains `transparency`, so changing it runs the `data-lf-switching` sequence on both containers. There is no second effect.

### 5. CL-01 — controlled, URL-keyed `<Preview>`

- `selection?: PreviewCell` makes the preview controlled: it neither reads nor writes `location`. User selections still call `onSelect(cell)`; the host feeds the new cell back. A coordinate outside the declared axes falls back to the first value of that axis, as the URL default does.
- `urlKey?: string` is the key prefix for uncontrolled mode. With it, the query keys are `<urlKey>.scenario`, `<urlKey>.width`, `<urlKey>.theme` and `<urlKey>.designSystem`. Without it they are today's bare keys, so `liveframe preview capture` and MCP `capture_preview` work unchanged. Two uncontrolled previews with different `urlKey`s do not touch each other's keys.
- **`resultScenario: string` is required (owner's choice).** It names the scenario the `result` prop was rendered for. Inference is removed. The "last good render" map is keyed by `resultScenario` only. A first result for scenario A while the URL or selection names B is shown for A only, never relabelled B.
- **Capture.** `data-lf-preview` gains `urlKey` (uncontrolled, when set) or `controlled: true`. `capture()` sets `<urlKey>.scenario` for a prefixed preview. For a controlled preview it captures only the scenario the page shows and raises a typed `CaptureError("not-found")` if a different scenario is requested, because a URL cannot select one.
- **Migration** (`docs/preview.md`, `CHANGELOG.md`): add `resultScenario={…}` beside `result`. Hosts that own navigation add `selection` and `onSelect`. Hosts with more than one preview add distinct `urlKey`s. The unprefixed default is unchanged for a single uncontrolled preview.

### 6. JSON-catalog implementation types

- `liveframe gen <catalog.json> --implementations --out <file>` emits a second, separate file of literal definitions (`export const button = { … } as const`) in `src/sdk/gen.ts` (or a sibling). With them `implement()` infers props, slot names, event names and the numeric and object carry value types, as it does for hand-written literal definitions.
- `--check` detects drift for this file, as it does for the typed-components module. `package.json`'s `gen:check` gains the second check. A type-level test shows a wrong prop, slot or event fails to compile.
- `/react` imports nothing from `/sdk`. No runtime primitive implementation is generated. The backlog item "Evaluate generated implementation types for JSON-loaded catalogs" closes with this resolution.

## Alternatives Considered

1. **Portal `display: contents`** — rejected by the owner's choice. A box-free element cannot be a size container, so `lf_container` becomes a no-op on the portal, container queries inside overlays find no `lf` container and fall back to the narrowest value, and MDN warns of accessibility-tree bugs with `display: contents`. It would have been one declaration instead of two.
2. **A public `actions` view on `CompiledValidator`, or a `capabilities` prop on `<Surface>`** — rejected: the first widens the public type and a hand-built validator could supply a different view; the second can drift from the capabilities the validator was compiled with and burdens every caller.
3. **Queueing confirmations** — rejected: a user could stack prompts and approve stale actions.
4. **Gating on `confirm` or `irreversible`** — rejected: the request separates the two on purpose ("a reversible action can need confirmation, and an irreversible one must say so on the control"). The hook receives `irreversible` and can choose.
5. **`result: { scenario, value }`** — rejected: both forms break the props, and `resultScenario` is the smaller diff for hosts.
6. **Keeping inference when `resultScenario` is absent** — rejected: inference is the bug.
7. **A new `intent-not-offered` error kind** — rejected: the existing kinds name every failure, and adding a kind widens a closed union and its JSON Schema.
8. **Requiring `origin` on `createPreview().intent()`** — rejected: it would break existing session callers and the MCP server for no gain, since the session never dispatches an action. `<Preview>` always supplies it.
9. **Extending the existing typed-components module for implementation types** — rejected: that module serves the SDK. A separate file keeps `/react` free of SDK imports and lets the two drift checks fail independently.
10. **Capture driving a controlled preview through the URL** — rejected: a controlled preview ignores the URL by contract.

## Rationale and Evidence

- `src/react/renderer.tsx:64-90` already completes and freezes intents, and `emit` at `:210-219` passes only `complete(intent, value)` to the host. Moving `complete()` to a host-API-free module gives `checkOffered` the same rule with no second implementation. The plan 015 log already says "one rule serves `bindAll`, object `setState` and plan 017's `checkOffered`".
- The renderer is handed a validator compiled from `{ catalog, capabilities, manifest }` (`src/validate/compile.ts:104-114`), which is the only place the resolved `confirm` for an action name is available; `buildFacts` (`:52-56`) is the precedent for keeping facts off the public type.
- `src/css/base.ts:29` already makes `lf_container` a size container, and `src/css/surface.ts:28` puts it on the portal for responsive trees. MDN: `display: contents` removes the element's box, so no `container-type` applies (verified with `ctx7` against `/mdn/content`: "These elements don't produce a specific box by themselves", plus the accessibility-tree warning). An out-of-flow `position: fixed` element takes no grid track and is not a flex item.
- `src/preview/react/preview.tsx:48-57,66-92` reads the URL on mount, writes it on every selection, and labels the first `result` with the URL's scenario; `src/cli/capture.ts:85-95` selects the scenario by setting the `scenario` query key. `data-lf-preview` already publishes the axes capture reads (`preview.tsx:104`).
- `src/preview/session.ts:100-140` already holds the current render result and rejects bad intents with existing error kinds, so the origin check adds one call there.
- Not verified in a browser at this stage: the pointer-events and container behaviour of the portal. Task 4 proves them in `react-browser.test.tsx` and `css-scope-browser.test.ts`.

## References

- [0.2.0 scope and breaking changes](2026-10-27-2028-release-0-2-0-scope-and-breaking-changes.md) — the `<Preview>` break and plan 017's scope.
- [Events, manifests and state scope](2026-10-28-0024-events-manifests-and-state-scope.md) — the completion rule `checkOffered` reuses.
- [Phase 4 renderer and preview contracts](2026-10-24-0306-phase-4-renderer-and-preview-contracts.md) — the contracts this extends.
- `plans/requests/synapta-adoption-requests.md` (LF-01, LF-08), `plans/requests/clay-adoption-requests.md` (CL-01, CL-02, CL-09), `plans/backlog.md` (implementation types).
- `docs/spec.md` §6.4, §7.3, §7.5, §8, §11.
- `src/react/renderer.tsx`, `src/react/implement.ts`, `src/preview/react/preview.tsx`, `src/preview/session.ts`, `src/cli/capture.ts`, `src/css/base.ts`, `src/css/surface.ts`, `src/validate/compile.ts`, `src/validate/intent.ts`, `src/formats/capabilities.ts`.
- [MDN `display: contents`](https://developer.mozilla.org/en-US/docs/Web/CSS/display) (via `ctx7` `/mdn/content`) — box removal and the accessibility-tree caveat.

## Consequences

- Tasks 2–7 implement these decisions. Task 4's base-sheet rules and Task 5's attribute rules both live in `src/css/base.ts`; Task 5 stays byte-stable.
- A host that relied on the old block portal's width for responsive overlay content sees viewport-width evaluation. This is a documented behaviour change under the additive CL-02 hook, and Task 4's docs and tests record it.
- A host ancestor with `transform`, `filter` or `contain` changes where the fixed portal sits. Docs name it.
- Hosts must add `resultScenario` to every `<Preview>`: the one breaking change, in the register.
- Revisit if an adopter needs overlay responsive values to track the surface rather than the viewport (a second container element would be needed), or if `irreversible` should force confirmation.
