# Bug and feature requests from Clay's review of 0.2.0

- **Source:** Clay plan 205 task 1 (`clay/plans/205-Liveframe-UI-Migration-Runtime-Composable-Surfaces.md`, commit `c9e3b1cc`).
  - `npm pack @arnilo/liveframe@0.2.0` into an empty directory, then `bun add` of that archive into a second scratch project.
  - Bun 1.4.4, Node 26.11.1, Ryzen 9 PRO 7940HS.
  - Every check ran against the installed archive, not this repository. The scripts and their output are in Clay's `test-plan/artifacts/205-liveframe/release-review/`.
- **Date:** 2026-10-30
- **Delivery status (2026-11-01):** CL-10 to CL-16 are delivered and verified in `@arnilo/liveframe@0.2.1`, published to npm under `latest` with `next` kept at or above `latest`. [`docs/adopters-0.2.md`](../../docs/adopters-0.2.md#021--clay-review-and-authoring-additions) records, per ID, the shipped API, its spec section and its limitation; this document stays the request record.
- **Status:** requests, not decisions. Settle each one with a decision log and a plan before building it.
- **Release target:** **0.2.1**, as the owner directed. Two policy questions need the owner's answer (R15):
  - `docs/compatibility.md` allows bug fixes and documentation in a patch. It lists added cases, vectors and exports under § Growth as additive, but does not name them as patch content. That reading covers CL-10, CL-11 and CL-13.
  - CL-15 adds an optional wire format and lifts a spec §14 non-goal ("Tree patches, and A2UI or other wire interop"). It is additive, because whole trees keep working unchanged, but it is a new contract rather than a fix. It needs its own decision log before any plan.
  - Nothing here changes an existing export, format, corpus expectation or hash vector.
- **Clay's gate:** Clay re-runs its release-review scripts against the published 0.2.1 archive and checks each item's acceptance list below.
  - CL-10 to CL-14: Clay's plan 205 works around each today (it builds its own validator bundle and installs a JSON `structuredClone`), so these remove workarounds.
  - CL-15 and CL-16: Clay cannot work around these. Without CL-15, Clay accepts whole-tree re-sends as a measured regression. Without CL-16, Clay's only engine has no proof of the switching budget.
- **Earlier requests:** `clay-adoption-requests.md` (CL-01 to CL-09) and `synapta-adoption-requests.md` (LF-01 to LF-17). The review found all 26 shipped in 0.2.0, with their acceptance lists holding against the archive.

## Summary

| ID | Type | Title | Clay priority |
|---|---|---|---|
| CL-10 | Bug / feature | `checkOffered` needs `structuredClone`, "any ES2022 runtime" is not true, and no bundle exports the validator | P2 |
| CL-11 | Bug (conformance) | The corpus never checks a package hash | P2 |
| CL-12 | Bug (docs) | Validator inputs from another realm fail with a misleading error | P3 |
| CL-13 | Bug (packaging) | The corpus and `package.json` cannot be resolved through `exports` | P4 |
| CL-14 | Bug (release) | The `next` dist-tag is older than `latest` | P4 |
| CL-15 | Feature | Tree patches for incremental surface updates | P1 |
| CL-16 | Bug (performance) | Theme and system switching misses the 16.67 ms budget on WebKit | P2 |

---

## CL-10 · Bug / feature · `checkOffered` needs `structuredClone`, "any ES2022 runtime" is not true, and no bundle exports the validator

- **Problem.**
  - **Bug.** `checkOffered` calls `structuredClone` (`dist/validate/complete.js:17`). It throws `ReferenceError: structuredClone is not defined` in a bare `vm` context, and in a `deno_core` runtime without `deno_web`. `compileValidator` and `validateTree` work there.
  - **Bug (docs).** The README and spec §13 say "the host-API-free subpaths need any ES2022 runtime", and spec §13 says CI checks it. Several of those subpaths use WHATWG globals, which are not ES2022:
    - the root export (`checkOffered`) uses `structuredClone`;
    - `/authoring` uses `TextEncoder` and `TextDecoder`;
    - `/preview/capture` uses `TextEncoder` and `URL`;
    - `/preview` uses `setTimeout`.
  - **Feature.** `runner-kit.bundle.js` exports `renderModule`, `linkPackage`, `render`, `renderElements`, `ephemeralManifest` and the JSX runtime. It does not export `compileValidator`, `checkOffered` or `capabilitiesFor`. A host that checks trees and intents in a non-Bun isolate, apart from the sandbox that renders, has two choices: build its own bundle from the root export (69,734 B, no imports), or load `renderModule`, which runs widget code.
- **Evidence (Clay).** Clay's kernel validates every host-returned tree and checks every intent with `checkOffered` against the served tree. It does this inside its trusted `deno_core` 0.400 runtime, which has no `deno_web`. No widget code runs there (`kernel.md`: "a host is a producer, never a validation bypass").
- **Proposal.**
  - Replace `structuredClone` on JSON values with a JSON-only clone.
  - Either remove the WHATWG globals from the subpaths documented as host-API-free, or name the globals each one needs in the runtime matrix. Extend the CI scan to globals that are not ECMAScript.
  - Publish `/validator.bundle.js`, a self-contained ES module that exports `compileValidator`, `checkOffered`, `capabilitiesFor` and the `validate*` format functions, under the same archive-gate check as the runner-kit bundle. Clay prefers a separate file to growing `runner-kit.bundle.js`, because the kernel never renders.
- **Acceptance.**
  - The archive gate parses the validator bundle and finds no imports and no host references.
  - A bare `vm` test, with no globals added, validates a corpus tree and runs `checkOffered` with results identical to the root export.
  - The runtime matrix is true for each subpath it lists, and CI checks it.

## CL-11 · Bug (conformance) · The corpus never checks a package hash

- **Problem.**
  - `conformance/corpus/package/docs/valid.json` carries a placeholder hash (`sha256-aaaa…`), so the package cases test shape only.
  - No case produces `hash-mismatch` or `forbidden-import`, the kinds that `verifyPackage` raises.
  - The hash vectors pin RFC 8785 text, but no vector pins the package hash itself: `sha256-` plus the lowercase hex SHA-256 of `canonicalJson({ format, manifest, code, scenarios })`.
  - `canonicalJson` and `packageHash` are not exported, so a TypeScript host cannot run the vectors through the public API. Clay's review imported `dist/pack/hash.js` by path.

  CL-06's acceptance item "every `LiveframeError` kind that a format validator can produce has at least one failing case" is not met for the package format.
- **Evidence (Clay).** Clay's Rust kernel re-hashes every stored package before load (plan 205 task 19). It can match the canonical text today, but not the package-hash composition.
- **Proposal.**
  - Give `package/docs/valid.json` its real hash. Its expectation (`ok: true`) does not change, so this is not a format-version change.
  - Add a `hash-mismatch` case, and a `forbidden-import` case if `verifyPackage` is in the corpus's scope.
  - Add `hash/packages.json`, with `{ package, hash }` vectors.
  - Export `canonicalJson` and `packageHash` from `/pack`.
  - Say in `docs/conformance.md` which validator the package cases run through.
- **Acceptance.** The corpus test runs the package cases through `verifyPackage`, and the packed `valid.json` verifies. The package vectors pass through the public exports.

## CL-12 · Bug (docs) · Validator inputs from another realm fail with a misleading error

- **Problem.** In a `vm` context, `renderModule` rejects a manifest that was parsed in the outer realm with `invalid-document` at `/manifest`: "Manifest must be a JSON value". The same JSON parsed inside the context renders. The packages guide says to "pass the catalog, capabilities and manifest as plain JSON", but it does not say the JSON must be created in the isolate's realm.
- **Proposal.** Either document the realm requirement next to the bundle example, or accept plain objects from any realm. The second option would check the prototype's shape, not identity with the realm's `Object.prototype`. The error message should name the realm when that is the cause.
- **Acceptance.** The `vm` test covers outer-realm inputs, and either accepts them or reports a realm-specific message.

## CL-13 · Bug (packaging) · The corpus and `package.json` cannot be resolved through `exports`

- **Problem.** `exports` has no `./package.json` and no `./conformance/corpus/*` or `./conformance/hash/*` entry. Under Node, `import.meta.resolve("@arnilo/liveframe/package.json")` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`. A port's test harness therefore has to assume a `node_modules` layout to find the corpus it is meant to run.
- **Proposal.** Export `./package.json` and `./conformance/*` as data paths, as `./schemas/*` already is.
- **Acceptance.** The exports test resolves one corpus case and one hash file through the package name.

## CL-14 · Bug (release) · The `next` dist-tag is older than `latest`

- **Problem.** `latest` is `0.2.0`, but `next` is still `0.2.0-rc.4`. `npm i @arnilo/liveframe@next` therefore installs an older release candidate.
- **Proposal.** Move `next` to the final release when publishing it, or delete `next` between release cycles. Add the step to the release checklist.
- **Acceptance.** After 0.2.1 is published, `npm view @arnilo/liveframe dist-tags` shows `next` at or above `latest`.

## CL-15 · Feature · Tree patches for incremental surface updates

- **Problem.**
  - `2026-10-29-1737` measured whole-tree updates on LF-17's subject: a 679-node, 50-row agent-home surface at 10 revisions/s, changing one row's status per revision.
    - The median update is 117,985 B of JSON and 5,099 B gzipped, against a 1 KiB budget. The changed data is 8 to 11 bytes.
    - Arrival validation plus React commit is 12.1 ms median, against 8 ms.
  - The log found patches warranted, but it approved no patch API. 0.2.0 ships none, and spec §14 still lists tree patches as a v1 non-goal. A host's only update path is therefore a whole tree per revision, re-sent, re-parsed, re-validated and re-committed.
- **Evidence (Clay).**
  - Clay's SDUI sends incremental updates today, each under a 1 KiB budget.
  - A 64-row, 193-node Clay-shaped surface is already 16,790 B of JSON, over Clay's 16 KiB tree budget, before any agent-surface growth. The JSON parse plus `validateTree` p95 is 0.47 ms at that size and 3.00 ms at 1,501 nodes.
  - Clay's status cells, inspector and agent surfaces update at interactive rates (plan 205 task 27). Moving them to whole trees regresses both bytes on the wire and per-update work.
  - Clay's kernel validates every update in Rust and in its trusted `deno_core` runtime, and checks intents with `checkOffered` against the served tree. A patch format must therefore be language-neutral data, like the other formats.
- **Proposal.**
  - Lift the §14 non-goal with a decision log. Re-use the LF-17 subject and thresholds, which were fixed before the measurement.
  - Define an optional, versioned patch format (`liveframe/tree-patch/1`). A patch names its base `{ surfaceId, revision }` and the new revision, and carries operations addressed by node `id`: replace a node's props, insert, remove and move children. Node ids are already unique per tree.
  - Add three functions to the root export:
    - `diffTrees(prev, next)`, which produces a patch;
    - `applyPatch(base, patch)`, which returns `Result<UiTree>` and refuses a patch whose base is not the given tree (a `stale-patch` kind);
    - validation of the patched tree, at least as strict as `validateTree` on the whole result. Incremental validation of only the touched nodes is an optimisation the log can choose, provided the result is identical.
  - `<Surface>` accepts either a tree or a patch against its current tree. `checkOffered` semantics do not change: an origin names the revision the patch produced.
  - Add corpus cases and vectors for the patch format, so non-TypeScript hosts can conform.
  - Whole trees stay valid. A host that never sends a patch sees no change.
- **Acceptance.**
  - The LF-17 benchmark, re-run with patches on the same subject, is at or under 1 KiB gzip and 8 ms arrival validation plus commit per update.
  - `applyPatch(prev, diffTrees(prev, next))` deep-equals `next` for every corpus tree pair, and a patch against the wrong base fails with `stale-patch`.
  - The corpus has valid and invalid patch cases, run through the public API.
  - `checkOffered` accepts an intent from a patched revision and rejects one from the superseded revision.

## CL-16 · Bug (performance) · Theme and system switching misses the 16.67 ms budget on WebKit

- **Problem.**
  - Spec §12 sets a 16.67 ms budget for the design-system switch (the Phase 1 exit criterion). Chromium meets it.
  - Headless Playwright WebKit 27.2 measured 18 to 22 ms for the two-surface CSS switch (`plans/evidence/019-engines.md`). The WebKit test uses a 25.1 ms ceiling, so no WebKit test proves the budget.
  - `2026-10-30-0430` deferred the miss for 0.2.0 and kept the budget. The deferral log notes that no timing run or causal diagnosis supports it, so it is unknown whether the cost is the library's (attribute and style resolution) or headless WebKit's frame pacing.
- **Evidence (Clay).** Clay's only production engine is WebKitGTK. Theme switching is a user-visible path in Clay (Settings and the design-system picker), so the budget miss is on Clay's main path, not a secondary engine.
- **Proposal.**
  - Split the measurement: library time (from the switch call to the style and attribute changes being applied, via `performance.mark`) and frame time (to the next painted frame). Run it on headless and headed WebKit, under the controlled conditions the backlog item asks for.
  - If the library time exceeds the budget, fix it. If only frame time does, record the cause with evidence and make the WebKit test assert the library time against 16.67 ms rather than a looser whole-frame ceiling.
  - Clay supplies WebKitGTK measurements from a real window (plan 205 tasks 24 and 34) and adds them to this item.
- **Acceptance.**
  - A WebKit test asserts the budget at 16.67 ms on the measurement the diagnosis shows to be the library's, with no WebKit-only ceiling above the budget.
  - The evidence file records machine, engine versions, headless or headed, and the split timings.
