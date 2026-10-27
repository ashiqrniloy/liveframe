---
date: 2026-10-28 00:24
status: approved
decision_about: "Object and numeric events, manifest metadata, scoped state and new semantics values"
proposed_by: "both"
explicitly_approved_by_user: true
---

# Decision: Events, manifests and state scope for 0.2.0

## Decision

Plan 015 implements LF-05 (option A), CL-08, LF-07, LF-06 and LF-09 as specified below. "Fits" means **structural fit**: names, required-ness and types are compared at build time, and bounds are checked on the value when it is filled. One rule serves `bindAll`, object `setState` and plan 017's `checkOffered`.

This records the design, not delivery. Format identifiers stay `/1`: every format change is additive. The one interface break, `Store` scope, is already in the [0.2.0 break register](2026-10-27-2028-release-0-2-0-scope-and-breaking-changes.md).

## Context

Plan 015 Task 1 asks for one log that settles each open detail, so that later tasks and plan 017's `checkOffered` implement a single rule. The 0.2.0 scope log fixed the direction (LF-05 option A, fail-closed scope isolation, the `fileStore` read promise); this log settles the details. The agent proposed the details; the owner chose the fit rule from three options and approved the rest as listed.

## Approval

- Proposed by: both. The owner supplied the direction (option A, fail-closed scope). The agent drafted the details.
- Approved by user: Yes.
- Approval evidence: on 2026-10-28 the user asked to complete plan 015 Task 1. They were shown every decision below and answered "Structural fit (Recommended)" for the fit rule and "Approve as listed" for the rest.

## Decisions

### LF-05 — object-carrying events (option A)

- `carries: { object: ObjectSchema }` is accepted only when the schema:
  - is closed (every `ObjectSchema` already is);
  - has at most 32 properties;
  - has only scalar property schemas (`string`, `number`, `integer`, `boolean`), each of which may be nullable;
  - keeps the usual string bounds (`maxLength` is required);
  - is **not** nullable at the top level.
  - Arrays and nested objects are rejected in 0.2.0. Allowing them later widens the accepted set, which is a minor change.
- Wire form: an action intent gains an optional `bindAll: true`. Only `true` is valid; the field is omitted otherwise. The SDK's `action(name, args, { bindAll: true })` produces it, and `complete()` merges the emitted object into `args`.
- `bind` and `bindAll` are mutually exclusive, in the SDK (throws) and in the validator (`invalid-prop`). `bindAll` needs an object carry, and `bind` needs a scalar carry.
- **Structural fit.** The event schema fits the target schema when:
  - every event property exists in the target, and the target is the action's argument schema minus the literal args;
  - every target property that is required is also required by the event;
  - property types match, except that `integer` fits `number`.
  - Bounds (`maxLength`, `minimum`, `enum`, …) are not compared. The filled value is checked against the target schema at preview `intent()` and at host dispatch, exactly as scalar `bind` works today.
  - A literal arg whose key is also an event property fails: it is a build-time `invalid-prop` at the arg's pointer. Literal args never silently win.
- `setState` with an object event replaces the whole key. The key must be declared with an object schema, and the event schema must fit it under the same rule.
- Any change to an event's `carries`, including its object schema, stays a major catalog change.
- Law 2: the object is validated at `emit` against a schema compiled once per definition event, again by the preview session's `intent()`, and again by the host on dispatch. Law 4: the host still re-checks before dispatch.

### CL-08 — numeric events (decided together with LF-05)

- `carries` also accepts `"number"` and `"integer"`.
- `number` binds only to a `number` argument or state key. `integer` binds to `integer` or `number`.
- Argument `minimum`/`maximum` apply to the filled value, not at build time.
- `emit` rejects a non-number, `NaN`, `±Infinity` and, for `integer`, a non-integer, raising no intent.

### LF-07 — manifest `description`, host `meta`, capability `meta`

- The manifest takes an optional `description` of at most 500 code points.
- `meta` is an optional JSON value of at most **8** levels of nesting and **4096** UTF-8 bytes of compact JSON, counted while walking (reusing `stringBytes`, with no serialisation). It is a manifest field, and also a field on each capability action and source.
- Over-bound values fail with `limit-exceeded` or `invalid-document` at the pointer.
- The package hash covers manifest `description` and `meta`. Capabilities are the host's own document and are not packaged, so capability `meta` is outside the hash. Plan 015's wording that the hash covers capability `meta` is corrected by this decision.
- The MCP `list_capabilities` omits capability `meta` unless `AuthoringConfig.exposeMeta` is true (default false). `pack_draft` shows `description` and never manifest `meta`, unless `exposeMeta` is set.
- Law 4: the library never interprets `meta`. It is untrusted on load, validated on install and by `verifyPackage`, and grants nothing.

### LF-06 — state keyed by `(placementId, scope)`

- `scope` is a string of at most 128 code points with no pattern. `""` is the shared scope.
- `fileStore` layout: `""` stays at `states/<id>.json`. Any other scope goes to `states/<enc(id)>/<enc(scope)>.json`, using the existing key-to-filename encoding, so no scope can escape the directory. `deletePlacement` removes the file and the directory. No rewrite of old directories.
- A scope over the bound is rejected with a typed `invalid-document` at `/scope`. A store that cannot honour a scope rejects it; it never falls back to shared state (the owner's fail-closed answer, recorded in the 0.2.0 scope log).
- `storeSuite` gains three cases, and both reference stores must pass them: scoped isolation (including that `""` and a named scope do not leak into each other), deletion of every scope with the placement, and the scope bound.
- `loadPlacement` and `verifyPlacementInputs` take scope and explicit state as host data, never as authority (Law 4). Explicit state is verified exactly like stored state (Law 2).

### LF-09 — new `semantics` values

| Value | Reference implementation |
| --- | --- |
| `form` | `<form aria-label={label}>`, native submit prevented |
| `group` | `role="group"` |
| `figure` | `<figure>` |
| `status` | `role="status"` |
| `alert` | `role="alert"` |

- No validator rule requires `label`. The schema language has no cross-prop rule, and `section` and `nav` already behave this way. `docs/formats.md` and `docs/renderer.md` say that a `form` needs a `label` to be exposed as a landmark.
- Live regions must stay mounted. Id-keyed reconciliation keeps them mounted, and `docs/renderer.md` says so.
- Tables stay a host primitive. The values live only in `src/formats/fixed.ts`.

## Alternatives Considered

1. **LF-05 option B (named bindings)** — rejected by the owner on 2026-10-27: it needs a new emitter contract.
2. **Fit as narrower-or-equal including bounds** — rejected: it duplicates what the filled-value check already enforces, and scalar `bind` and CL-08 check bounds on the value.
3. **Fit as strict equality** — rejected: the catalog and capabilities would have to be edited in lockstep.
4. **Nested objects and arrays in object events** — rejected for 0.2.0: they enlarge the merge and validation surface for no adopter need. Allowing them later is a minor widening.
5. **Literal args win on a `bindAll` conflict** — rejected: it hides an author error. `bind` already requires the bound argument to be omitted from `args`.
6. **`number` binds to `integer` with a runtime check** — rejected: the build-time type rule stays simple, and the filled-value check still catches bounds.
7. **A `scope` stored in the placement record** — rejected: a placement is shared by definition.
8. **An optional trailing `scope` parameter on `Store`** — rejected in the 0.2.0 scope log: old stores would ignore it and fail open.
9. **Open `additionalProperties` on the manifest** — rejected: the formats are closed by design.
10. **A validator rule requiring `label` on `form`** — rejected: there is no cross-prop rule in the schema language, and the existing landmark values behave the same way.

## Rationale and Evidence

- Scalar `bind` today compares types and checks the value on fill (`src/validate/intent.ts:49-56`, `checkAction`). Structural fit extends the same split to objects, so there is one mental model and one set of error messages.
- `ObjectSchema` is already closed with required bounds (`src/schema.ts`), and the catalog already compares schemas (`src/formats/catalog.ts:196-257`), so Tasks 5 and 6 add no second schema interpreter.
- `complete()` and `emit` (`src/react/renderer.tsx:62-78,187-195`) already clone and freeze the intent. Only the merge and the value check are new.
- The `fileStore` key encoding and hashing (`src/store/fs/index.ts:19-38`) already make any id safe as a path segment; scopes reuse it.
- The 128-code-point bound matches every other name in the formats (`src/formats/records.ts:7-9`).
- Not researched externally: the ARIA roles `status`, `alert`, `group`, `form` and the HTML elements `<form>` and `<figure>` come from WAI-ARIA 1.2 and HTML as cited in the plan; Task 2 verifies the browser accessibility output.

## References

- [0.2.0 scope and breaking changes](2026-10-27-2028-release-0-2-0-scope-and-breaking-changes.md) — LF-05 option A, fail-closed scope and the `fileStore` read promise.
- [Release 0.1.0 hardening](2026-10-25-0231-release-0-1-0-hardening-and-api-freeze.md) — storable ids for `fileStore`.
- `plans/015-Phase-7-Part-B-Events-Manifests-Capabilities-And-State.md` — the task list this log feeds.
- `docs/spec.md` §5, §7.3, §7.4, §8, §10 and §11.
- `src/formats/catalog.ts`, `src/validate/intent.ts`, `src/sdk/intents.ts`, `src/react/renderer.tsx`, `src/store/*`, `src/validate/bytes.ts`.

## Consequences

- Tasks 2–8 implement these decisions. Task 6 adds `bindAll` to the action intent's closed field set, and plan 017's `checkOffered` must understand `bindAll`, numeric carries and object carries by this rule.
- Readers of 0.1.0 reject the new `carries` values and `bindAll`, because their formats are closed. This forward-incompatibility is the usual additive-growth cost under `/1`.
- Unvalidated bounds on a filled object surface at preview or host dispatch, not at build time. Revisit if adopters hit late rejections often enough to justify bounds comparison.
- Nested event payloads, a `label` requirement for `form`, or capability `meta` in the package hash would each need a new log.
