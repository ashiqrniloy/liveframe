# Plan 022 impact analysis

Executed 2026-11-03 against the released `@arnilo/liveframe@0.2.2` (tag `v0.2.2`, commit `46c04e3`; registry `dist-tags` read the same day: `{ latest: '0.2.2', next: '0.2.2-rc.2' }`). The sweep assesses the delivered package, its documentation and the repository against all twelve impact areas from `.claude/skills/create-plan/references/liveframe.md` §5. Findings F1–F6 are listed at the end with the owner's disposition.

Method: the register, the readiness review and the acceptance record were re-read; `src/react/share.ts`, `src/react/renderer.tsx` (`settled`) and the demo host were read against the published wording; `api-stability`, `docs-links`, `docs-wording` and `portability` were re-run (25 pass; `shipped_docs_never_call_exports_planned` failed once on its 200 ms time budget at load 32 and passes alone in 141 ms); the full `bun run bench` was run once (area 7).

## 1. Spec

`docs/spec.md` describes what shipped: §6.2/§6.4 (the twelve states, their selectors, source order, pending suppression, forced-colours rows), §6.5 (recipe-derived audit), §7.1 (`bindSources`), §7.5 (capture media axes), §8 (`renderKey`) and §11 (whole-tree reuse, `focusContinuity`, `emit`'s promise). Three statements were wrong or missing and are fixed by Task 17 (F4):

- §11 said `emit` "returns the host's promise". It returns a derived `Promise<void>` that settles when the host's does and drops its value and rejection (`settled()` in `src/react/renderer.tsx`).
- §13's package table did not name `bindSources`, `auditContrast` or `renderKey`.
- Node reuse and the validator cache were described in the adopter notes with the wrong keys (area 10).

## 2. Public API and formats

`package.json` is `0.2.2`. The register has 20 entries: 6 `added`, 11 `widened`, 3 `deferred`. `api-stability.test.ts` passes (7 tests). It fails on a stale entry, an unregistered declaration change, a changed corpus, hash or patch file, and a `deferred` change that ships. The registry archive compared against the 0.2.1 baseline gave `diffs: []` for `rc.1`, `rc.2` and the final archive (`022-release-candidate.md`, `022-release.md`). The three `deferred` entries (`./sdk ref`, `. NodeRef`, `./schemas/* catalog.json` `refProps`) each have a full migration entry in `docs/compatibility.md` § "Deferred to 0.3.0" (before/after, code sample, adopter checklist). Format ids are unchanged: `states` widens a closed vocabulary, so a 0.2.1 validator rejects a design system that uses a new state (fails closed, noted in `docs/compatibility.md` Growth).

Open: the `next` dist-tag is `0.2.2-rc.2`, below `latest` (F1).

## 3. The four laws

No new path for widget code, colour, raw CSS or authority:

1. **Widget code never runs in the browser.** Nothing in 0.2.2 loads or runs widget code. `bindSources` and `renderKey` are pure functions of data the host passes in.
2. **The tree is validated data.** `shareNodes` runs only after `validateTree` accepted the arrival and substitutes only deep-equal values, so the drawn tree is the validated one. The catalog cache is reached only with a document that already passed install validation; `invalid_catalog_never_hits_cache` and `mutating_the_compiled_catalog_never_stales_an_equal_catalog` cover the two ways it could be wrong.
3. **No colours or raw CSS from widgets.** The four new states are selectors from a fixed list that installed data cannot extend; `auditContrast` reads roles and introduces none.
4. **A widget never holds authority.** `bindSources` resolves no data and runs no action. `emit`'s promise carries neither the host's value nor its rejection (`settled()`), so a primitive learns only that the host finished. Capture media axes stay authoring-only and dispatch no action.

## 4. Validation

Every new input is validated and fails with a typed error:

- `bindSources` validates its inputs with `validateJson` first (accessors, cycles, functions, non-finite numbers, foreign realms), then the capabilities and the manifest shape, then each resolved source parameter against the source's schema; a missing required binding is `invalid-prop` at `/sources/<key>/params/<name>`.
- `renderKey` throws `TypeError` on a non-JSON input, like `canonicalJson`.
- `auditContrast` returns the existing validators' typed errors for an invalid catalog, theme or design system and reports `unresolved-background` instead of guessing.
- Capture `media` values are checked before the page is touched: `unknown-name` at `/media/<axis>`, `not-found` at `/media` for a backend without `emulate`, and the cell bound `maxCells` counts the product before the first cell.
- The corpus gained `design-system/docs/new-states.json` and `unknown-state.json`; no existing case changed.

Gap found in the 0.2.1 line, still open: a compiled validator's `validateTree` reports the generic "a plain JSON object" error for a foreign-realm tree instead of the realm message (Clay's CL-17, F5).

## 5. Styling

Theme authority is unchanged. Source order is `rest < hover < focus < active < open < selected < current < mixed < pending < readonly < invalid < disabled`, and a system that styles none of the new states projects the same bytes as 0.2.1 (152,019 B Certified, 164,152 B Rack; `unused_new_states_leave_css_byte_identical`). Pending suppresses hover and active only when the system declares a `pending` recipe, which keeps that byte identity. The four forced-colours rows apply only when the state differs from rest. The opt-in audit reports nine non-text findings on the two proof design systems (3 Certified, 6 Rack); nothing fails because the audit is opt-in (F3).

## 6. Interaction tiers

- **Local:** `emit` now returns a promise a primitive may use for `aria-busy`; ignoring it behaves as in 0.2.1. Focus continuity is opt-in and moves focus only; it emits no intent.
- **`setState`:** unchanged. Reuse keeps focus, scroll and local state across whole-tree arrivals, as patch mode already did.
- **Action:** unchanged. `onIntent`'s return type is `unknown` so a host callback may return a promise; the confirmation path awaits the host inside its own `try`.

## 7. Performance

Last clean run (Task 14, `rc.1` code, quiet host) against the 0.2.1 figures:

| Gate | 0.2.1 | 0.2.2 | Budget |
| --- | --- | --- | --- |
| LF-17 whole-tree arrival, development | 10.7 ms | 2.8 ms (production 2.0 ms) | ≤ 5.0 ms |
| Node-reuse pass, 679 nodes | n/a | 0.2 ms | ≤ 1.0 ms |
| Patch arrival, development | 2.7 ms | 2.6 ms (production 1.8 ms) | ≤ 2.97 ms |
| Second `compileValidator`, same catalog | 0.73 ms | 0.118 ms (0.15–0.19 ms with the F2 guard, under load) | ≤ 0.25 ms |
| First `compileValidator`, unseen catalog | baseline | 0.961–0.985 of 0.2.1 (nine interleaved runs) | ≤ 1.05 of 0.2.1 |
| `agent-home` validation | 0.893–1.450 µs/node | 1.314 µs/node | ≤ 1.5 µs/node |
| `agent-home` SDK render | 1.335 ms | 1.318 ms, 1.942 µs/node | ≤ 2.0 ms, ≤ 3.0 µs/node |
| `diffTrees` / `applyPatch` | 0.549 / 0.123 ms | 0.560 / 0.129 ms | ≤ 1.5 / ≤ 0.5 ms |
| CSS projection | 152,019 B / 164,152 B | 152,019 B / 164,152 B | byte-identical |
| 679-node selection update, production | 14.5 / 14.0 ms | 2.9 / 3.0 ms | recorded |

**Today's full `bun run bench` is not a valid measurement.** It ran at 04:13 with a host load average of 38.7 (1 min) and failed the validator gate on every fixture and on `applyPatch` (0.649 ms against 0.5 ms). The generic baseline, which no 0.2.2 change touches, measured 5.756 µs/node on `agent-home` (about 5× its normal 1.0–1.4), and the standalone validator measured 24.9 µs/node, 19× the clean figure. A run with the baseline itself that slow measures the machine, not the code. What changed after the last clean run (Task 14) is install-time only (`pointerAt` in `src/schema.ts`, the catalog-cache lookup in `src/validate/compile.ts`); `validateTree`, `applyPatch`, `diffTrees`, the renderer and the CSS projection are byte-identical to the code Task 14 measured. The clean re-run remains open (F2), as the readiness review recorded.

## 8. Portability

The host-API-free scan passes (16 tests, 2,417 expectations). Placement matches the rule: `bindSources` is in `src/formats/manifest.ts`, `renderKey` in `src/pack/hash.ts`, `auditContrast` in `src/formats/audit.ts` (`fontWeights` moved from `src/css/theme.ts` to `src/formats/dtcg.ts` so the root does not import the CSS projection), and `src/react/share.ts` is internal to `/react`. Focus continuity names `Node.compareDocumentPosition`'s bitmasks as module constants because the scan forbids `globalThis` and DOM globals in shipped modules. Capture's `textScale` uses `page.locator("html").evaluate` for the same reason. `peer-floors.ts` passed on React 19.0.0, Playwright 1.49.0 and the MCP server 2.0.0.

## 9. Agent authoring

`capture_preview` takes `media` and advertises it in its description, input schema and `outputSchema`; a call without it returns the 0.2.1 text and structured content byte for byte (`calls_without_media_are_byte_identical_and_media_is_reported`). A backend without `emulate` gets a typed refusal naming the axis, and an invalid value names its pointer, so an agent can act on either. `auditContrast` findings name the recipe key, both roles, the ratio and the threshold. Node references, which agents most need for `aria-describedby`, are deferred (D1); hosts keep passing literal DOM ids through string props.

## 10. Docs and examples

`CHANGELOG.md`, `docs/compatibility.md` (`## 0.2.2`, Growth, Deferred to 0.3.0), `docs/adopters-0.2.md` (eight capabilities, the register table with every `hostAction` verbatim, checked by `register_host_actions_appear_in_adopter_notes`), `docs/security.md` (0.2.2 audit: nothing changes), `docs/renderer.md`, `docs/styling.md`, `docs/formats.md`, `docs/packages.md`, `docs/preview.md`, `docs/mcp.md` and `docs/conformance.md` cover the release, and `docs-links` and `docs-wording` pass. Reading the shipped wording against the code found four inaccuracies, fixed by Task 17 (F4): the validator cache was described as keyed by "content hash" (it is the JSON text of the two documents, so equal documents with different key order miss), `emit` as returning "the host's promise", node reuse as matching "by key path", and focus continuity as moving to a "sibling". Task 13's execution notes also named capabilities that do not exist (`compileValidatorFast`, reduced-transparency recovery, "confirmation intent dispatching"); the published docs do not, and Task 13's notes are corrected. The published 0.2.2 archive carries the old wording until the next release, as for 0.2.0's documentation corrections.

The demo host does not show `bindSources`, `renderKey` or diff-with-fallback (area 12, F6).

## 11. Conformance

- `designSystemSuite` gained the opt-in `every_recipe_pair_meets_contrast` case, and `suite_without_contrast_option_is_unchanged` pins the default.
- `styledStates` enumerates `Object.keys(stateSelectors)`, so a system that styles a new state now needs a fixture for it (`new_states_require_fixtures_when_a_system_styles_them`); the existing systems need none.
- Corpus: two new design-system cases; every 0.2.1 corpus, hash and patch file is byte-identical (`api-stability`). Ports must accept the four new state names in the recipe key pattern; unknown names stay rejected.
- Not covered by a language-neutral suite: `bindSources` and `renderKey`. `renderKey` is `canonicalJson` plus SHA-256, which the hash vectors already pin; `bindSources` has TypeScript tests only. A port implementing `manifest.sources` evaluation would need vectors; no port has asked.

## 12. Reference hosts

### What Clay and Synapta can now adopt

- `renderKey` and `bindSources` replace hand-rolled cache keys and binding evaluation (the evaluation's "Host Integration Chasm").
- `Surface` reuse makes whole-tree transport cost about what patches cost (2.8 ms against 2.6 ms); a host that moved to patches only for speed can move back.
- `auditContrast`, `focusContinuity`, the four states and capture media axes are opt-in.

### Remaining gaps

- **Foreign-realm `validateTree` message (CL-17, Clay P4).** Filed in Clay's 0.2.1 release review and never dispositioned. Clay creates every input inside its isolate, so it is unaffected (F5).
- **Host orchestration (the evaluation's other chasm items).** Per-viewer served-tree tracking for `checkOffered`, concurrent read de-duplication and diff-with-`stale-patch`-fallback are still hand-built. The decision log rejects a stateful `/host` controller, so the answer is a documented recipe, not an API; the demo host passes `data: {}`, declares no sources and does not call `renderKey` or `diffTrees` (F6).
- **CL-14, again.** `next` stays at `0.2.2-rc.2` for the second release running (F1).
- G29 (the native Windows forced-colours and assistive-technology audit) is unchanged and stays in the backlog.

## Findings and dispositions

The owner chose "Accept as recommended" on 2026-11-03.

| Finding | Description | Recommended | Disposition |
| --- | --- | --- | --- |
| **F1** | `next` is `0.2.2-rc.2`, below `latest`: the Publish workflow's `dist-tag add` step returned E403 again, after `npm publish` succeeded. Owner command: `npm dist-tag add @arnilo/liveframe@0.2.2 next`, or enable "Allow npm dist-tag". | backlog | **backlog** — existing P3 "Enable trusted-publisher dist-tag management", already records the recurrence |
| **F2** | The full `bun run bench` has no clean run since Task 14. Today's run at load 35–39 is invalid (generic baseline 5× slow). | backlog | **backlog** — existing P3 "Re-run the full benchmark suite on a quiet host", updated with today's attempt |
| **F3** | The proof design systems fail the opt-in contrast audit (9 non-text findings). | backlog | **backlog** — existing P3 "Proof styles fail the opt-in contrast audit" |
| **F4** | Published 0.2.2 wording misstated the validator cache key and order sensitivity, `emit`'s promise, node-reuse matching and focus fallback; spec §13 omitted the new exports; Task 13's notes named capabilities that do not exist. | execute | **executed** — Task 17 (docs only; `bindSources`, `renderKey`, `auditContrast` rows added to §13). Ships with the next release. |
| **F5** | Clay's CL-17: `validateTree` reports a generic message for a foreign-realm tree; no backlog entry. | backlog | **backlog** — new P4 "Name the realm mismatch in a compiled validator's `validateTree`" |
| **F6** | The demo host does not show `bindSources`, `renderKey` or diff-with-fallback, and the evaluation's remaining orchestration gaps have no entry. | backlog | **backlog** — new P4 "Show request-time orchestration in the demo host" |

## Archive comparison (security criterion)

Recorded in `plans/evidence/022-release.md`: the final `0.2.2` archive differs from `0.2.2-rc.2` only in `package.json`, `CHANGELOG.md` and `README.md`; the registry's SLSA v1 provenance verifies for `0.2.2`. Task 17's edits are repository-only and do not change the published archive.
