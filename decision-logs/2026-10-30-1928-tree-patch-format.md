---
date: 2026-10-30 19:28
status: approved
decision_about: "CL-15 optional tree-patch format, operations, validation and transport"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: Tree-patch format (CL-15)

## Decision

Add optional `liveframe/tree-patch/1`, four ordered, id-addressed operations, and host-API-free `diffTrees` and `applyPatch` in the root export. Keep whole-tree validation and `<Surface tree>`; the browser host applies patches before passing the resulting tree to the renderer. Add no base content hash, incremental validator, renderer patch prop, JSON Pointer engine or runtime dependency.

Two corrections to the plan are approved along with this design:

1. Diffing supports the SDK's existing representation: empty children are omitted. `diffTrees` returns `invalid-document` for either input containing an explicit empty `children` array; the host sends the unchanged whole-tree document instead. This restriction applies only to diffing, never to existing whole-tree validation. Every successful diff must round-trip exactly. Extend Task 10's corpus-pair checks to assert either exact round-trip for supported pairs or this explicit rejection and whole-tree fallback for unsupported pairs.
2. Remove Task 9's assertion that validated trees are frozen. They are not: `validateTree` returns the input object. Patching follows the existing readonly ownership contract, does not mutate or freeze its inputs, and preserves untouched subtree identity. Hosts must treat served trees and their nested values as immutable while in use, as the existing `checkOffered` caches already require. Runtime freezing is not a new guarantee.

These are limits of the proposed minimal design, not measured performance results or changes to existing formats. If exact diffing of every valid empty-array representation is required, the four-operation contract must be extended before implementation.

## Approval

- Proposed by: agent.
- Approved by user: Yes.
- Approval evidence: on 2026-10-30, the owner answered **“Approve the proposal and plan corrections”** to the request to approve the complete proposal then at `plans/evidence/021-tree-patch-design-proposal.md`, including no base hash, host-side application, whole-tree validation, SDK-form diff inputs with whole-tree fallback for explicit empty children, and readonly ownership without automatic freezing. That reviewed proposal is preserved in this accepted record.
- This approves the design and Task 9/10 corrections, not publication or measured performance claims. Tasks 9–12 implement this contract. Spec edits below remain drafts until Task 9 lands the format and updates the normative spec.

## Context, rationale and evidence

- Spec §9 defines a `root` node, stable key-path ids, optional `children`, monotonic per-surface revisions and whole-tree transport. §11 validates every arrival before reading tree metadata. §14 currently excludes patches.
- [LF-17's accepted measurement decision](2026-10-29-1737-streaming-tree-patches.md) warrants patches. Its [measurement](../plans/evidence/019-streaming-bench.md) fixes 679 nodes, 50 rows, 100 revisions at 10/s, changing one row's status each revision: 117,985 JSON bytes, 5,099 gzip bytes and 12.1 ms arrival validation plus commit, all medians. Whole-tree validation alone was 1.4 ms. These numbers motivate the design; they do not prove its future budgets.
- `src/formats/tree.ts:32` makes `children` optional; its schema allows an empty array. `src/sdk/render.ts:523` emits `children` only when nonempty. The proposed `set` preserves children, `insert` requires a parent, and `remove`/`move` cannot target the root. Consequently `{ id: "root", kind, props }` cannot become the same node with `children: []` using these four operations alone. Silently treating these JSON objects as equal would violate the exact round-trip criterion.
- `src/validate/tree.ts:271` returns the original tree after successful validation, without freezing it. The [formats execution reference](../.agents/skills/liveframe-execution/references/formats.md) states the same ownership behavior.
- `src/validate/offered.ts:50–99` checks surface/revision before indexing the served tree and caches validation/indexes by tree object. `src/react/renderer.tsx` validates arrivals and currently rebuilds node contexts per accepted tree; Task 12 optimises that only if Task 11 measures a miss.

## Wire shape and public signatures

```ts
type TreePatch = {
  readonly format: "liveframe/tree-patch/1";
  readonly catalogId: string;
  readonly surfaceId: string;
  readonly base: number;
  readonly revision: number;
  readonly ops: readonly PatchOp[];
};
type PatchOp =
  | { readonly op: "set"; readonly id: string; readonly kind: string;
      readonly variant?: string; readonly props: Readonly<Record<string, Json>>;
      readonly style?: Readonly<Record<string, Json>>;
      readonly events?: Readonly<Record<string, Intent>> }
  | { readonly op: "insert"; readonly parent: string; readonly index: number; readonly node: UiNode }
  | { readonly op: "remove"; readonly id: string }
  | { readonly op: "move"; readonly id: string; readonly index: number };

declare function validateTreePatch(patch: unknown): Result<TreePatch>;
declare function diffTrees(prev: UiTree, next: UiTree): Result<TreePatch>;
declare function applyPatch(base: UiTree, patch: unknown): Result<UiTree>;
```

`TreePatch` and `PatchOp` are root-export types. `validateTreePatch` is a structural format validator, following existing format practice; it cannot check targets without a base or catalog semantics without a compiled validator. The two tree-transforming functions are the only new transformation API. `schemas/tree-patch.json` has `$id: urn:liveframe:tree-patch:1` and ships through `./schemas/*`.

All document and op objects are closed. Reuse the UI-tree field constraints for catalog/surface ids, node fields, key-path ids, JSON and intents. Revisions and indexes are nonnegative safe integers; `revision > base`, but gaps are allowed. Reject non-JSON inputs and unknown formats/operations/fields. An empty `ops` list advances revision without changing the root.

The schema and structural validator agree on standalone shape checks. The cross-field inequality `revision > base` is additionally checked by the structural validator; standard JSON Schema cannot compare two arbitrary sibling numbers. Task 9's schema parity test must distinguish this semantic rejection from shape parity, as it does for base-dependent application checks.

## Ordered operation semantics

Resolve each op against the result of all earlier ops in the same patch. Never mutate the base or expose a partial result. Index maintenance must account for inserted and removed descendants; a later op can target an inserted node, and targeting an already removed node fails.

| Op | Meaning |
| --- | --- |
| `set` | Replace the complete own-field payload: required `kind` and `props`, optional `variant`, `style`, `events`. Omitted optional fields are deleted, not merged or retained. Preserve `id` and `children` exactly. Allowed on `root`; no id rename or children field in this op. |
| `insert` | Insert the complete subtree `node` under the existing `parent`, before its current child at `index`; `index == childCount` appends. An absent children array counts as zero. Accept indexes from zero through childCount. Ids in the subtree must follow the destination's key path; never rewrite ids automatically. |
| `remove` | Remove the existing target and all descendants. The root cannot be removed. When the last child is removed, omit the parent's `children` field, matching SDK output. |
| `move` | Detach an existing node, then insert it at `index` within the same parent. The index is its final zero-based position, from zero through the remaining child count. Moving to the same position is valid. The root cannot move. Descendant ids remain unchanged. |

Cross-parent changes use remove plus insert, carrying the new ids for the entire moved subtree. Catalog-specific kind, prop, style, event, child-policy, accessibility and capability checks belong to subsequent whole-tree validation. Duplicate ids are reported as `duplicate-key` by that validation; application must not silently select between ambiguous duplicate targets. Reject an ambiguous target with `duplicate-key` if it is addressed before final validation.

## Identity, errors and ownership

First validate patch shape and revision ordering; then check base identity; then process ops in order. Report paths into the patch (`/base`, `/ops/0/id`, etc.) using existing `LiveframeError` conventions.

- Additive `stale-patch`: `surfaceId` differs or `base !== tree.revision`.
- Existing `invalid-document`: malformed patch; non-increasing revision; catalog mismatch; out-of-range index; attempted root removal/move. `diffTrees` also uses this kind for mismatched catalog/surface, non-increasing revisions or either input containing explicit empty children.
- Existing `not-found`: target or parent absent at that operation's position.
- Existing `duplicate-key`: ambiguous duplicate target; otherwise the final compiled validator reports duplicate ids. Other final validation errors retain their existing kinds.

The base and both diff inputs are previously validated `UiTree` values owned by the host. The incoming patch is untrusted JSON. Structural application is not catalog validation: the host must validate the complete result before accepting its revision, serving it, using it for dispatch checks or passing it to the renderer. If any stage fails, retain the last accepted tree and request a whole tree. Renderer arrival validation still runs independently.

On success return a new tree envelope, retaining the base `format`, `catalogId` and `surfaceId`, and setting the new revision. Copy changed nodes and their ancestors; preserve reference identity of every untouched subtree. Do not mutate/freeze the base or patch. Do not treat the result as immutable merely because TypeScript declares it readonly; hosts retain the existing obligation not to mutate documents while in use.

No base hash. The host must assign one tree to each `(catalogId, surfaceId, revision)` and keep revision sequences monotonic; reuse of the same identity for different content is a host contract violation that this design cannot detect. A hash would require processing the entire 118 KB subject, without removing the whole-tree validation requirement. Its actual cost has not been measured, so the recommendation is based on avoiding redundant work, not a claimed benchmark win. This is identity checking, not authentication or authorisation.

## Deterministic diff

For supported inputs, require `applyPatch(prev, diffTrees(prev, next).value)` to deep-equal `next` exactly, including optional own-field presence. Compare JSON objects independent of property insertion order and arrays in order. Do not depend on locale sorting or object key insertion order.

Walk retained parents in next-tree preorder. For each parent, emit `set` if its own payload differs; remove children absent from the next parent's direct child ids in reverse current sibling order; then scan next children left to right. Insert absent children as complete subtrees, otherwise move retained children to their next index and recurse. Do not emit descendant ops for a newly inserted subtree or beneath a removed subtree. New-parent subtrees carry all their descendants and new ids. Avoid redundant sets and moves; no minimal-edit/LCS guarantee. This fixes operation ordering for language-neutral vectors, including independent sibling edits.

Use id maps and structural sharing; measure sibling reorder costs rather than claiming every array reorder is linear. Same logical inputs yield byte-identical canonical JSON, using the existing canonicalisation contract. JSON object property order in an in-memory result need not be identical.

## Transport and intent origin

The browser host runs `JSON.parse` → `applyPatch` → whole-result validation → `<Surface tree={result}>`. Keep `<Surface>`'s API and its independent arrival validation. A host may use renderer arrival validation as the browser render gate, but may advance its own accepted/served tree only after its own validation succeeds. Patches contain no code, CSS authority or dispatcher authority; laws 1–4 stay intact.

`checkOffered` has no semantic change: an origin names the accepted patched revision. The old revision fails with `version-conflict`. If Task 12 reuses node contexts, their emitters must read the current accepted revision, never a revision captured when that context was first built.

## Alternatives considered

1. **Whole trees only** — retain as fallback; the fixed LF-17 measurement exceeds both streaming thresholds.
2. **RFC 6902 JSON Patch** — rejected for this contract. It addresses locations with JSON Pointers and array indexes, and index shifts require pointer bookkeeping after insert/remove. Stable Liveframe ids avoid that translation. This is a design tradeoff, not a claim that JSON Patch cannot handle reorders. See [RFC 6902 §§3–4](https://www.rfc-editor.org/rfc/rfc6902).
3. **`patch` prop on `<Surface>`** — rejected: adds renderer state and error recovery API; host application exposes stale failures directly so the host can request a whole tree. This deliberately differs from Clay's suggested prop; the adoption notes must explain the supported host-side equivalent.
4. **Incremental validation** — deferred: the measured 1.4 ms whole-tree validation leaves room inside 8 ms; revisit only with measured need and identical results against whole-tree validation.
5. **Base hash** — rejected as above; reconsider only if a real transport cannot uphold unique revision identity.
6. **A fifth operation or extending `set` to children** — deferred; canonical SDK inputs and whole-tree fallback keep this format at four operations. Exact support for explicit empty children requires a separately approved extension.
7. **Freeze shared trees automatically** — rejected: changes existing caller-owned objects on success, or requires copying them and loses structural sharing. Keep the existing readonly ownership contract.

## Budgets and implementation follow-through

Tasks 9–12 must use the unchanged LF-17 subject, rate, load metadata and development Profiler measurement described in the accepted decision. Record median `applyPatch <= 0.5 ms` for one row on 679 nodes and host-side `diffTrees <= 1.5 ms`; the latter is recorded separately from Clay's arrival budget. Require median `gzip <= 1024 bytes` and arrival validation plus commit `<= 8 ms`. Record parse, application and end-to-end time separately so the two new transformations cannot hide costs. No threshold increase or production/development timing substitution. Preserve `019-streaming-bench.md`; new evidence goes in `021-streaming-patches.md`. Task 12 runs only if measurement calls for renderer reuse.

Task 9 supplies the format type/schema/validator, errors, application, corpus, exports, outsider docs and spec sync. Add tests for optional-field deletion, root set/root-op rejection, sequential addressing, insert/move bounds, duplicate ids, catalog mismatch, empty ops, non-mutation and readonly ownership. Test schema shape parity separately from revision ordering. Correct its freezing claim as proposed above.

Task 10 supplies deterministic diffs/vectors and `./conformance/patch/*`, public-export and archive checks. Add independent-edit ordering and property-order vectors, canonical-input round trips, and explicit-empty-children rejection with whole-tree fallback. Amend its current all-pairs criterion as proposed above, rather than silently weakening equality. Task 11 measures; Task 12 conditionally optimises. No implementation or new tests belong to this design-only task.

## Draft spec edits for Task 9

**§9, replace the whole-tree and compression bullets and add a patch subsection:**

> A render produces a whole `liveframe/1` tree. Whole-tree transport remains valid. Hosts may instead transport `liveframe/tree-patch/1` against a previously validated tree, after LF-17 demonstrated the need for patches. The renderer still receives a whole tree and reconciles by id. The host applies the patch and validates the complete result before accepting it; the renderer independently validates arrivals. A patch is never validated widget code and grants no authority.
>
> A patch is `{ format: "liveframe/tree-patch/1", catalogId, surfaceId, base, revision, ops }`. Revisions are nonnegative safe integers and `revision > base`. Its catalog must match the base tree; a mismatched surface or base revision is `stale-patch`. There is no content hash; a host must not reuse one surface revision for different contents. Operations are ordered and atomic: `set` replaces kind/variant/props/style/events while preserving id/children; `insert` inserts a subtree at a parent's current index; `remove` deletes a non-root subtree; `move` reorders a non-root child within its current parent, with index measured after detachment. Parent changes require remove plus insert with new key-path ids. Missing targets are `not-found`; malformed documents, invalid indexes and root removal/move are `invalid-document`. Duplicate ids fail as `duplicate-key`. The operation shapes, optional-field deletion and index bounds follow the approved decision recorded with this design.
>
> `diffTrees(prev, next)` deterministically produces a patch for matching catalog/surface identities and increasing revisions. It requires the SDK representation, which omits empty children arrays; other valid representations use whole-tree fallback. Every successful diff round-trips exactly through `applyPatch`. `applyPatch` is structural only, shares untouched subtrees, does not mutate inputs, and does not replace whole-tree validation. Served documents must be treated as immutable; runtime freezing is not promised. Intent origins continue to name the accepted revision, and `checkOffered` remains required on host dispatch.

Keep the lower-revision and A2UI bullets. Insert the full `TreePatch`/`PatchOp` declarations from this proposal beside the new subsection and link the final accepted decision there.

**§13:** extend the root row with “UI-tree and tree-patch formats, `validateTreePatch`, `diffTrees` and `applyPatch`”; name `schemas/tree-patch.json` and `urn:liveframe:tree-patch:1` in the schema paragraph. Extend the shipped conformance description with `conformance/corpus/tree-patch/` (application then complete-tree validation, support roles `base`, `catalog`, `capabilities`, `manifest`) and `conformance/patch/diff.json` (`{ prev, next, patch }` vectors). Name `./conformance/patch/*` beside the corpus and hash data exports when Task 10 ships it. Runtime requirements stay host-API-free for the new root functions.

**§14:** replace “Tree patches, and A2UI or other wire interop.” with “A2UI or other wire interop.”

## References

- [Plan 021](../plans/021-Phase-7-Part-H-Release-0-2-1.md), Task 2 and Tasks 9–12 — design acceptance and implementation obligations.
- [Release scope decision](2026-10-30-1914-release-0-2-1-scope-and-patch-content.md) — additive patch content and the separate design gate.
- [Clay CL-15](../plans/requests/clay-0.2.1-requests.md) — adopter request and acceptance criteria; host-side application is the approved alternative to its suggested renderer prop.
- [Spec](../docs/spec.md) §§9–11, 13–14 — existing format, validation, renderer and non-goals.
- [RFC 6902 §§3–4](https://www.rfc-editor.org/rfc/rfc6902) — sequential JSON Pointer operations; consulted 2026-10-30 for the rejected alternative.

## Consequences

- The format adds four operations, two transformations and the required structural format validator, without new renderer API or dependency. Whole-tree transport remains available for recovery and unsupported diff representations.
- Task 9 must distinguish shape-schema parity from cross-field and base-dependent validation, and retain readonly ownership rather than promise freezing. Task 10 must explicitly test supported exact round trips and unsupported empty-array fallback.
- Whole-result validation remains mandatory. Revision identity relies on host discipline and does not authenticate the transport. Patches do not detect two different contents deliberately assigned the same identity.
- The fixed performance budgets remain unproven until Tasks 9–12 measure them. Revisit incremental validation only with measured need and identical results; revisit empty-array representation support only through an approved extension.
