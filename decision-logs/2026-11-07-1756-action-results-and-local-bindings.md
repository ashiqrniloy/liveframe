---
date: 2026-11-07 17:56
status: approved
decision_about: "Action results as a host-supplied input, and local state with declarative bindings"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Tier 3 gets an `actions` input; tier 2 gets manifest-declared local state with data-only bindings

## Decision

Release 0.3.0 adds (1) a host-supplied `actions` widget input that carries the status of recent actions (`pending`, `ok`, `failed`, `refused`, with an optional reason, action name and schema-checked result value), keyed by action name or by an intent's `resultKey`; and (2) manifest-declared **local state** (`local`, `initialLocal`), a `setLocal` intent the renderer applies without calling `onIntent`, and node-level `when` and `bind` expressions evaluated in the browser from a restricted subset of the template expression language, with roots `local` and `self` only. The full rules (A1–A9, L1–L7, B1–B13, W1–W4, P1–P4) are in `plans/evidence/029-interaction-design.md`; this log fixes the choices below.

- `ActionStatus` is `{ status, action?, reason?, value?, at? }`, closed. `value` is allowed only with `ok` and is checked against the action's capability `result` schema; a result key that is not an action name must carry `action` so the value can be typed.
- `resultKey` is a literal on an `action` intent, preserved by `complete()` and reproduced by `checkOffered`. It is a label, not an argument.
- `local` is a closed object of at most 32 scalar or nullable-scalar properties, every one required, with bounded strings and no `pattern`. `setLocal` follows `setState`'s fill rules, never reaches `onIntent` or `confirm`, and `checkOffered` rejects it. Local state belongs to one mounted `<Surface>`, resets when `surfaceId` or the validator changes, and is never sent anywhere.
- `when` and `bind` are separate node fields, so `props` stays plain JSON validated as today and doubles as the static fallback. Expressions use an allow-list of the template operators (no iteration, no collection builders), bounded in depth, size and fuel. They are checked statically on arrival; each bound value is re-validated with `checkNode` before an implementation reads it; failure renders the node fallback and reports `binding-failed`.
- A `refProps` target may not be gated by `when`, and child-count rules hold with every `when` node present (maximum) and absent (minimum).
- The wire change rides on `liveframe/1` and `liveframe/tree-patch/1` as optional fields; the existing closed validators make older renderers fail closed.
- Templates carry `when` and `bind` verbatim and may embed template values into them with `{ "$embed": Expr }`, which never reaches the tree; `resultKey` may be a template `Value`.
- Budgets: a keystroke that flips up to 10 of 50 gated rows re-renders in ≤ 4 ms median (production React); a tree without bindings is within 1% on arrival and commit; 50 `when` expressions fit the validator's 1.5 µs/node share.

## Context

Plan 029 gives tier 3 a feedback contract and removes the cliff between tier 1 (inside a primitive) and tier 2 (a round trip to where widgets run) for interactions that span nodes but need no data. Today a widget cannot know its last action is in flight or failed, so hosts improvise "Saving…" through `context` or the persisted `state`; and a client-side filter over 30 rows costs a round trip, because `onIntent` is the only way out of a primitive (`src/react/renderer.tsx:267`, `docs/renderer.md:380-396`; `plans/liveframe-evaluation.md` §3.1). Law 1 forbids the usual fix, client-side code, so the behaviour must be data.

## Approval

- Proposed by: agent.
- Approved by user: Yes.
- Approval evidence: the owner chose "Approve as written (Recommended)" for the design in `plans/evidence/029-interaction-design.md`, including its eight amendments to the plan.

## Alternatives Considered

1. **Action results through `state`** — state is the widget's and persisted; results are transient host facts, and every host would encode them differently.
2. **Results keyed by action name only** — a list of rows that each show "Claim" needs a per-row status.
3. **Client-side JavaScript for local behaviour** — violates law 1.
4. **Optimistic `setState` in the browser** — the browser cannot compute the next tree without running widget code.
5. **Bound values inside `props` behind a marker** — props would stop being plain JSON checked by the prop schema, and consumers that do not evaluate bindings would see no valid static tree.
6. **An A2UI-style whole data model** (JSON Pointer paths, server-pushed `updateDataModel`) — a second authority channel from host to renderer state and an unbounded namespace; the manifest-declared object with one validated writer is smaller and bounded.
7. **The full template operator set in the browser** — iteration and collection builders add unbounded work for no binding that needs them.
8. **The plan's literal P1 gate (all 50 rows flip in ≤ 4 ms)** — flipping all 50 rows unmounts and remounts about 650 nodes, which plan 022's figures (about 12.5 ms to mount 679 nodes) show no React renderer meets; the gate is a keystroke that flips up to 10 rows, with the all-50 case recorded.

## Rationale and Evidence

- The input check, completion and offered-intent paths already exist and take the new fields without new mechanisms: `CompiledInputs` (`src/validate/compile.ts:78-83`), `complete()` (`src/validate/complete.ts`), `checkOffered` (`src/validate/offered.ts`).
- `checkExpression` and `evaluate` (`src/template/expr.ts:1099,1113`) already provide static typing, fuel and the compatibility rule, so bindings add a root scope and an operator allow-list, not a second checker.
- The renderer already has the pieces the core needs: id-keyed contexts (`context`, `src/react/renderer.tsx:296`), structural sharing (`src/react/share.ts:12`), node fallback boundaries and `FocusContinuity` for a focused element that a `when` hides.
- Prior art: A2UI v0.9.1 keeps input writes local until an action fires (`/websites/a2ui`, a2ui.org/concepts/actions), which is the property kept here.
- Information flow: expressions read only the tree and the surface's local state, so no browser-evaluated expression reaches data the widget did not put in the tree.
- Performance reference points: production selection update on 679 nodes 2.9 ms with 0.9 ms of React work, and about 12.5 ms to mount the tree (`plans/evidence/022-browser-profile.md`). The P1 budget is a hypothesis to be measured in Task 4; a miss is recorded with its split, not relaxed silently.

## References

- `plans/evidence/029-interaction-design.md` — the numbered design.
- `plans/029-Phase-7-Part-P-Release-0-3-0-Interaction-Outcomes-Local-Bindings-And-Surface-Core.md` — Tasks 2–7 derive from it.
- `decision-logs/2026-11-07-1200-template-widgets.md` and `plans/evidence/028-template-design.md` — the expression language reused here.
- `docs/spec.md` §8–§9, §11; `docs/renderer.md:380-396`; `plans/liveframe-evaluation.md` §3.1.
- A2UI specification v0.9.1 (a2ui.org/specification/v0.9.1-a2ui/, a2ui.org/concepts/actions/), read through ctx7 (`/websites/a2ui`).

## Consequences

- Tasks 2–5 follow the evidence; the plan is amended where it differs (the eight amendments are listed in the evidence file).
- `renderKey` changes for every widget (the `actions` input is hashed as `{}` when absent), so a hash vector and a register entry are required.
- `checkExpression` gains an optional operator allow-list; the template engine gains `$embed` in pass-through positions; plan 028's T14 is amended for `resultKey`.
- Hosts must stop dispatching on their own idea of pending state: the documented sequence is pending, re-render, ok or failed, re-render.
- Revisit if the P1 budget cannot be met after the split is recorded, if validating many distinct row expressions breaks the validator's 1.5 µs/node share (P3 names the first fallback: depth 8, nodes 32), or if a real widget needs a collection-valued or iterated binding.
