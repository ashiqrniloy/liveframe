---
date: 2026-11-07 12:00
status: approved
decision_about: "Template widgets: a closed JSON expression language over element JSON"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Template widgets are element JSON plus a closed, bounded JSON expression language

## Decision

Release 0.3.0 adds **template widgets**: a `liveframe-template/1` document of element-JSON nodes whose values may be expressions, evaluated by the library with a closed operator table, static type checks at install and explicit fuel at render. A template needs no sandbox. The full rules (T1–T22) are in `plans/evidence/028-template-design.md`; this log fixes the choices below.

- Expressions are JSON, never parsed strings. A string, number, boolean or `null` is a literal; an array or an object without a `$`-key is a constructor; an object with exactly one `$`-key is an operator application; `$lit` escapes.
- The operator set is the plan's list plus the operators the three proof widgets need: `$let` (node and expression forms), `$has`, `$omit`, `$findIndex`, `$at`, `$flat`, `$merge`, `$fromEntries`, `$sum`, `$split`, `$ref` and an `index` binding on `$each`/`$filter`/`$map`.
- Components (`$use`) are hermetic: they see only their declared params. No name may shadow a root or an earlier name.
- Evaluation has fuel (`limits.steps`, default 1,000,000) and value caps (strings 1,048,576 units, arrays 65,536 items), because nested loops and `$let` chains make "bounded by input size × template size" false.
- Type checking uses the existing schema language. A `dynamic` expression type (from `$fromEntries` and similar) binds anywhere and is checked at render; `optional` expressions do not bind to required targets, and `$has` narrows. `$if` takes a boolean.
- `$slice` clamps an end past the length; `$len` of a string counts code points; `$text` is ECMAScript `String`; no regex, `Intl`, time or randomness.
- `type`, `key`, `name`, `bind` and `bindAll` of intents are static, so the actions a template can request are the static set in its document.
- Proof parity is claimed over the proof scenarios; the ports neither throw nor sanitize with regex.

## Context

Plan 028 fills the gap between TSX widgets (a full language that needs a sandbox, spec §7.1) and element JSON (static, unbound, ephemeral, §7.2). Task 1 required the design to cover the proof widgets under `src/__tests__/fixtures/widgets/`. Porting `agent-home/queue.tsx`, `core-queue/widget.tsx` and `git-status/` on paper showed that the plan's list could not express derived values reused across the tree, `findIndex`, object construction for the `cursors` state value, optional props, or the last path segment of a root label. Each addition is traced to its construct in the evidence table.

## Approval

- Proposed by: agent.
- Approved by user: Yes.
- Approval evidence: the owner chose "Approve as written (Recommended)" for the design in `plans/evidence/028-template-design.md`, including its eight amendments to the plan.

## Alternatives Considered

1. **String expressions (`"{{ item.title }}"`, `${/path}`)** — needs a parser, adds ReDoS and injection concerns, and LLM structured output produces JSON objects more reliably. A2UI's `formatString` and json-render's `$template` take this route.
2. **JSONata or JSON Logic** — a runtime dependency with features (regex, functions) the bound cannot cover; JSON Logic has no static typing.
3. **Host-registered functions (json-render `$computed`)** — needs a trusted host and defeats "no sandbox".
4. **Run templates through the TSX runner** — defeats the point.
5. **Keep the plan's smaller operator list and weaken parity** — the proof widgets then could not be ported, and the evidence that templates cover real widgets would be missing.
6. **Components that see the widget's roots** — shorter `$use` sites, but components could not be typed from their `params` alone.
7. **No fuel, rely on input bounds** — unsound with nested loops and doubling `$let` chains.

## Rationale and Evidence

- Proof coverage: the construct-to-operator table in `plans/evidence/028-template-design.md` maps every construct of agent-home, core-queue and git status except `throw` and regex sanitization, which scenarios never exercise (T22).
- Canonical package hashing sorts object keys (spec §7.3), so no construct may depend on key order; ordered lists are arrays (T6).
- The schema language already carries `maxItems` on every array, so inputs are bounded; fuel and value caps bound what templates build from them.
- Prior art: A2UI v0.9.1 (child scope per collection item, fixed function list) and Vercel `json-render` v0.21.1 (`$state`, `$cond`, `$template`, `$computed`), recorded in the evidence file.

## References

- `plans/evidence/028-template-design.md` — the numbered design.
- `plans/028-Phase-7-Part-O-Release-0-3-0-Template-Widgets-And-Streaming.md` — Tasks 2–7 derive from it.
- `src/sdk/elements.ts`, `src/sdk/render.ts` (`renderPrepared`, `renderValue`), `src/formats/manifest.ts` (`bindSources`), `src/schema.ts`.
- `src/__tests__/fixtures/widgets/agent-home/`, `core-queue/`, `git-status/`.
- A2UI specification v0.9.1 (a2ui.org/specification/v0.9.1-a2ui/) and `vercel-labs/json-render` v0.21.1, read through ctx7.

## Consequences

- Tasks 2–7 follow the evidence; the plan's tasks are amended where it differs (see the plan's Task 1 notes).
- `RenderOptions.limits` gains `steps` for templates; `renderPrepared` needs an input-checking seam.
- The operator set is larger than the plan's, so Task 2's operator table tests grow with it.
- Revisit if the ≤ 3 µs per output node budget cannot be met with compiled closures (T19), if the 1,000,000 default fuel proves too tight or loose, or if a real template needs `throw`, regex or a conditional `variant`.
