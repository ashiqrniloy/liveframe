# Plan 019 impact analysis

Executed 2026-10-29 after Tasks 1–6. The sweep is against the delivered work, not
the plan's intentions. Files named here are the evidence for each disposition.

## 1. Spec

`docs/spec.md` §7.1/§7.2 describe element JSON, `renderElements()`,
`ephemeralManifest()`, `Elements<Catalog>` and the per-catalog `elements` schema;
§9 keeps whole trees and defers patches until a measurement calls for them; §10
holds the shared limits; §13 lists `/sdk/gen`, the CLI flag, the per-catalog
schema exception, `conformance/` and the hash vectors. The implementation and
the corpus agree with those sections. The one forward-looking statement is §9's
patch deferral: a measurement now calls for patches, but no patch format or API
exists, so §9 remains true until that design is approved and written.

## 2. Public API and formats

`/sdk` exports `renderElements`, `ephemeralManifest` and the `Elements` type;
`/sdk/gen` exports `generateElementsSchema`. `package.json` has both subpaths, and
`src/__tests__/exports.test.ts` pins the runtime export sets. `liveframe gen
--elements-schema` and `gen:check` are shipped and drift-checked. The new format
uses `urn:liveframe:elements:1` and is generated per catalog, as §13 says; no
published `schemas/elements.json` is claimed. `conformance/` and the hash vectors
are in `package.json` `files` and the release allowlist. No existing format,
subpath or export changed.

Finding F2 (below) is the one public-surface documentation gap found and fixed.

## 3. The four laws

Element JSON is untrusted agent output on the backend. `prepareElements()` checks
the JSON shape and converts it to internal elements, then `renderPrepared()`
runs the same emitter, id derivation, props/style/event/child checks and limits
as `render()`. It passes `validateInputs: false` only because an ephemeral
surface has no widget params/state/context/data to check; it does not skip node
checks. The renderer still receives trees only. `ephemeralManifest()` grants no
authority: `compileValidator` checks its declared actions against capabilities,
and the arrival check still validates the tree. No widget code, raw CSS, colour
literal or authority path was added. Tests: `render_elements_error_pointers_into_json`,
`ephemeral_manifest_validates`, the `elements` corpus cases and
`corpus_covers_every_validator_error_kind`.

## 4. Validation

Every new input has a validator and typed failures: element JSON through
`renderElements()`, the generated schema through `elements_type_and_schema_agree`,
the CLI output through `elements_schema_deterministic_and_drift_checked`, the
corpus through `corpus_cases_match_validators`, and the hash vectors through
`hash_vectors_match` and `rejected_inputs_rejected`. The corpus covers all 15
`LiveframeError` kinds emitted by format validators and separately classifies
the 9 kinds they never emit. Element JSON errors carry pointers into the input;
malformed roots and children are `invalid-prop` at the exact input pointer.
No new error kind was needed.

## 5. Styling

No styling or colour path changed. Plan 016's native-part and preference checks
were re-run in WebKit and Firefox. The Playwright WebKit 27.2/Linux forced-colour
mapping limitation and the headless WebKit/Firefox `backdrop-filter` raster
limitation are recorded in `docs/styling.md`, `docs/conformance.md` and
`plans/evidence/019-engines.md`; Chromium and Firefox prove the forced-colour
rules, and all three assert the computed backdrop value. No library work is
implied.

## 6. Interaction tiers

Element JSON emits the existing intent shape, so local state, `setState` and
actions keep their existing validation and authority model. No interaction tier
was added or changed. The corpus and renderer browser suites exercise the normal
renderer; the SDK fixture equivalence test compares element JSON trees with
`render()` trees, including events. No gap found.

## 7. Performance

`bun run bench` on 2026-10-29:

| Workload | Result | Budget |
| --- | --- | --- |
| Render agent-home, 679 nodes | 1.855 µs/node (1.2594 ms) | ≤ 3 µs/node |
| `renderElements` agent-home, 679 nodes | 2.414 µs/node (1.6391 ms) | ≤ 3 µs/node |
| Standalone validator agent-home | 1.249 µs/node | ≤ 1.5 µs/node |
| Streaming whole-tree JSON | 117,985 bytes median, 5,099 gzip median | — |
| Arrival validation + React commit | 12.1 ms median (Task 3 evidence) | ≤ 8 ms would avoid patches |
| Update rate | 9.90/s over the Task 3 run | 10/s target |

A Task 7 re-run during analysis measured 10.7 ms and 7.30/s, with gzip unchanged;
the machine was under heavier load. The committed Task 3 evidence remains the
recorded sample. Either sample exceeds both pre-agreed patch thresholds, so the
verdict does not depend on the noisy commit sample.

Finding F1 (below): patches are warranted but not designed or scheduled. This is
the only performance finding.

## 8. Portability

`src/sdk/elements.ts` and `src/sdk/gen.ts` add no host API or Node-only import to
the core or `/sdk`; the browser bundle check caught and removed a `node:` literal
during Task 2. The schema generator rebuilds the tree fragments locally instead
of importing a Node-facing schema module. Chromium, Firefox and WebKit pass the
browser suites; the full Bun suites pass. Vitest/Jest registration remains
backlogged because both blocked-peer preloads use Bun's `mock.module`; the
`preloads_are_effective` test re-proves the preloads under the only runner used.
No new portability gap.

## 9. Agent authoring

An agent receives a catalog-specific JSON Schema from
`generateElementsSchema()`/`liveframe gen --elements-schema`, a typed
`Elements<Catalog>` form, `ephemeralManifest()` for an arrival-compatible
manifest, and errors whose `pointer` addresses the agent's own JSON while
`nodeId` remains the derived id. The SDK guide documents the end-to-end loop and
the generated schema. Finding F2: the public-exports summary in `docs/sdk.md`
still omitted `renderElements`, `ephemeralManifest`, `Elements` and `/sdk/gen`;
it was corrected in this task.

## 10. Docs and examples

`docs/spec.md` §7.2/§9/§13, `docs/sdk.md`, `docs/formats.md`,
`docs/conformance.md`, `docs/compatibility.md`, `docs/packages.md` and
`docs/styling.md` describe the shipped surfaces, corpus, hash vectors, archive
and engine limits. The SDK guide examples are executable and covered by
`sdk-guide.test.ts`; the docs build has no separate site to update. The F2
correction is the only docs finding.

## 11. Conformance

`conformance/corpus/` has 45 committed cases across all ten formats, including
nine `elements` cases covering every kind that format can emit. The runner
compares unordered `(kind, pointer)` sets and the 20-error bound; the coverage
test derives the 15 emitted kinds from `src/errors.ts` and classifies the other
9. `conformance/hash/` has 45 vectors, including all 24 RFC 8785 Appendix B
rows, number edges, UTF-16 keys, escapes and rejected inputs. CI runs the corpus
and vectors on every check and runs the browser suites in WebKit and Firefox as
well as Chromium. No conformance gap found.

## 12. Reference hosts

Clay's agent-surface streaming need is now measured on a 679-node agent home: the
whole-tree gzip and validation-plus-commit medians exceed the agreed thresholds,
so its top-priority gap remains open until patches are designed. Synapta has no
new gap from this plan. Both reference hosts already use the ordinary
catalog/theme/design-system and conformance paths; no design was bent to either.
The streaming gap is F1.

## Findings and dispositions

| ID | Finding | Area | Recommendation | Disposition |
| --- | --- | --- | --- | --- |
| F1 | Streaming agent surfaces exceed both patch thresholds: 5,099 gzip bytes and 12.1 ms (re-run 10.7 ms), versus 1 KiB and 8 ms. Tree patches are warranted but no patch format or API exists; the approved decision log defers the design to a separate task with owner approval. | 7, 11, 12 | Backlog the design; do not add a patch API in plan 019. | `plans/backlog.md` — "Design tree patches for streaming agent surfaces"; owner approval still required before implementation. |
| F2 | `docs/sdk.md`'s public-export summary omitted `renderElements`, `ephemeralManifest`, `Elements` and the `/sdk/gen` exports. | 2, 9, 10 | Execute (docs-only). | Fixed in `docs/sdk.md`; no API or behaviour change. |

No finding requires a new task above Task 7. F1 is deferred by the already
approved streaming decision and is recorded in Further Actions and the backlog.
F2 is executed here because it is a documentation correction with no new
surface.
