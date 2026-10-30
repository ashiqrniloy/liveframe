# Plan 020 impact analysis

Executed 2026-10-30 against the released `@arnilo/liveframe@0.2.0`, after Tasks 1–9. The sweep is against what shipped, not what the plans intended. Files named here are the evidence for each disposition. Findings F1–F4 and F6 are fixed; F5 is handed to the backlog; F7–F9 keep an owner disposition already recorded.

## 1. Spec

`docs/spec.md` describes the shipped release: §7.1/§7.2 element JSON and the emitters, §7.3 `description`/`meta` and `sourceOutcome`, §7.4 scoped state and `verifyPlacementInputs`, §7.5 runners, capture and `/authoring`, §8 events with object `carries`, §11 `onIntent(intent, origin)`, `checkOffered`, `wrapperProps`/`portalProps`/`transparency` and `confirm`, §12 the unchanged budgets, §13 the package surface. The compatibility register's three breaks are the only ones `docs/migration-0.2.md` documents, and §9 keeps whole trees because no patch API shipped.

**F1, fixed.** §13's `/sdk/gen` row named `generate()` and `generateDefinitions()` and omitted `generateElementsSchema()`, which ships (`src/__tests__/exports.test.ts:194`), is documented (`docs/sdk.md:186`) and is named correctly in §13's prose (`docs/spec.md:380`). The row now names all three.

## 2. Public API and formats

`package.json` is `0.2.0`; the exports, `files` and subpaths are unchanged since rc.4 except the version string. The archive comparison below proves it: the published `0.2.0` and the verified `0.2.0-rc.4` differ in exactly two files, `package.json` (version) and `CHANGELOG.md` (the entry heading). No format, `$id`, `schemas/*.json`, corpus case or hash vector changed after rc.4, so a port that verified against rc.4 agrees with `0.2.0`.

The additions since 0.1.0 are all additive under the compatibility policy: subpaths `/sdk/gen`, `/preview/capture`, `/authoring`, `/runner-kit`, `/runner-kit.bundle.js`; exports `capabilitiesFor`, `checkOffered`, `verifyPlacementInputs`, `renderElements`, `ephemeralManifest`; `<Surface>` props `wrapperProps`, `portalProps`, `transparency`, `confirm`; optional format fields; and the new error kind `insufficient-contrast`, which `docs/compatibility.md` § Growth already classifies as additive.

**F7, retained.** `dist-tags` are `{ latest: '0.2.0', next: '0.2.0-rc.4' }`. `next` stays at the candidate because this machine has no npm auth for `npm dist-tag add` and trusted publishing covers only the workflow's publish — the same disposition 0.1.0 recorded. Recorded in `plans/evidence/020-release.md`; no action.

## 3. The four laws

No law weakened and no new path crosses one.

- **Law 1 (widget code never runs in the browser):** `<Surface>` and `<Preview>` receive trees only; the archive gate's browser-bundle step and `capture_page_and_bundle_hold_no_draft_code` still hold, and the agent acceptance recorded seven GETs with no draft-module request (`plans/evidence/020-agent-acceptance.md`).
- **Law 2 (the tree is validated data):** `checkOffered` re-validates the completed intent against the served tree, and arrival validation is unchanged; `renderElements` errors carry input pointers.
- **Law 3 (no colours or raw CSS from widgets):** the new styling surfaces are host-declared vocabulary — `"none"`, `{ role, alpha }`, `contrast` pairs, `placeholderColor` and the scrollbar pair resolve through the resolver, not through widget strings (`docs/styling.md`).
- **Law 4 (a widget never holds authority):** `confirm` and `irreversible` are metadata; `meta` is annotations; `/authoring` requires the host's runner and grants no store, dispatch, install or approval authority (§13).

The four laws are also re-checked by name, test by test, in `plans/evidence/020-request-acceptance.md` § "The four laws, re-checked by name".

## 4. Validation

Every new document and input has a validator and typed failures: `meta` (depth/bytes, closed), discriminators and `nullable` in widget-authored schemas, object `carries` (≤32 scalar properties), contrast pairs (`insufficient-contrast` with both ratios), scope strings (`invalid-document` at `/scope`, ≤128 code points), element JSON (pointers into the input) and capture axes (`unknown-name`, `limit-exceeded`). The language-neutral corpus exercises all ten formats and every validator error kind (`corpus_covers_every_validator_error_kind`, `corpus_cases_match_validators`), and the hash vectors pin canonical bytes. No error kind was added after rc.4.

## 5. Styling

Unchanged since rc.4. The 0.2.0 additions (`none`, alpha over the declared base, contrast `minimum`/`maximum`/`lessThan`, `placeholderColor`, `scrollbarThumbColor`/`scrollbarTrackColor`, `minHeight`/`maxHeight`, `transparency="reduced"`) all resolve through the catalog's vocabulary; the theme stays the colour authority and install-time WCAG contrast is enforced by `validateTheme`. Engine limits stay disclosed rather than papered over: older Safari/WebKitGTK keep native scrollbars (`docs/styling.md`), headless WebKit/Firefox cannot raster `backdrop-filter` (`plans/evidence/019-engines.md`), and the recipe catalogue is unchanged.

## 6. Interaction tiers

All three tiers work without new authority: local state inside React, `setState` through the host-visible state object (now scoped by `(placementId, scope)`), and actions through `onIntent(intent, origin)` with the optional `checkOffered` check before dispatch. Object-carrying events reach actions and `setState` without widening what a widget can do: `bindAll` merges a closed object, `emit` rejects `NaN`/infinities/non-integers, and the validator compares the event type with the target schema (`react-intents.test.tsx`, `unconfirmed_action_never_reaches_on_intent_and_confirm_throw_raises_nothing`). No tier gained network, storage or authorisation reach.

## 7. Performance

The released code is the code bench'd in Task 4: validator 0.819–1.370 µs/node (≤ 1.5), render 1.622–2.263 µs/node (≤ 3) with wall 0.26–1.07 ms (≤ 2), `styleDeclarations` 0.394 µs/node, and the warm switch on the Chromium sample gate (16.67 ms) via `switch_under_budget_with_blur_through_surface`. The validator and render numbers are pool medians that still carry the existing P1 variance investigation (backlog "Phase 1 performance gate: 3 µs per node"); no threshold moved in 0.2.0.

**F8, retained deferral.** Headless WebKit on Linux measured 18–22 ms against the 16.67 ms normative budget; its test ceiling is 25.1 ms, which the owner explicitly deferred on 2026-10-30 (`decision-logs/2026-10-30-0430-webkit-switching-budget-deferral.md`). The budget and the Chromium gate are unchanged, and `CHANGELOG.md` discloses it under Known limitations. The same test produced one 17.4 ms Chromium outlier on a 375 s CI run and passed on rerun with no code change; that is the recorded load-sensitivity, not a new finding.

## 8. Portability

The archive gate passes all 11 steps against the registry package: every exports target packed and present, consumer types under strict NodeNext, host-API-free subpaths under Node, `/runner-kit.bundle.js` self-contained and rendered under Node's `vm`, `/authoring` without the MCP SDK, capture without Playwright, and the corpus and vectors packed. The host-API-free core rule holds — nothing outside `/react`, `/store/fs`, `/preview/worker`, `/preview/react`, `/conformance/react` and the CLI imports `node:`, `bun:`, DOM globals or `require`, enforced by `src/__tests__/portability.test.ts` over source and `dist/`. Bun ≥ 1.4.2 remains required for the backend subpaths; the release workflow itself ran Bun 1.4.2 and passed check, both gates, the three peer floors and the demo gate.

**F6, fixed in Task 9.** `loader_leaves_noncanonical_sdk_imports_bare` asserted that a bare `@arnilo/liveframe/sdk` import does not resolve; after `0.2.0` became `latest`, Bun 1.4.4's auto-install fetched it into its cache and resolved it, so a developer machine with network failed `bun run check` while CI stayed green. That test's child now runs `--no-install` (`src/__tests__/preview-load.test.ts:127`); the assertion, the loader and the shipped package are unchanged. Detail in `plans/evidence/020-release.md` § "Post-release finding".

## 9. Agent authoring

Unchanged since rc.4 and exercised end to end by the fresh-install agent acceptance: `/sdk/gen` emits types and the per-catalog element schema byte-identically to the CLI (drift-checked by `gen:check`), `renderElements()` errors point into the agent's JSON, and the MCP and `/authoring` operations return the same typed `LiveframeError`s rooted at the document an agent edits. The acceptance run's two guesses were both answered by shipped docs, so no documentation change was required by it. `meta` stays host-only unless the authoring config opts in.

## 10. Docs and examples

Shipped and current in the archive: `README.md` (subpaths), `docs/migration-0.2.md` (three breaks with before/after and §5's four security reminders), `docs/adopters-0.2.md` (26 request rows plus the five backlog items they raised, general problem first), `CHANGELOG.md` (`0.2.0` with Added, Changed (breaking), Fixed and nine Known limitations), `docs/compatibility.md` (§0.2.0 links both new guides) and the guides for preview, renderer, packages, security, styling, SDK, MCP and conformance. `docs-links` and `docs-wording` pass.

**F2, fixed.** `docs/compatibility.md` §0.2.0 still described the release in the future tense after it shipped — "The next planned release is 0.2.0", "These changes are not shipped yet", "implemented for the upcoming release". It now states the release, its migrations and the state compatibility as fact, and keeps the scope-decision link and both guide links.

**F3, fixed.** `docs/adopters-0.2.md` twice said the LF-17 measurement "decided against" tree patches. The approved decision (`decision-logs/2026-10-29-1737-streaming-tree-patches.md`) says the thresholds were exceeded and patches are warranted, with the design needing separate owner approval. Both the LF-17 row and the "Not delivered" bullet now say that.

**F4, fixed.** `README.md` described `0.1.0` as "the first release"; it now names `0.2.0` as the current release.

**F5, backlog.** F2–F4 and F1 are repository fixes that arrived after the `v0.2.0` tag, so the published `0.2.0` archive still carries the earlier wording. They ship in the next release; the entry "Ship the post-0.2.0 documentation corrections" carries the list.

## 11. Conformance

The kit covers the new surface without a new suite: `storeSuite()` gained scope isolation, bounds and deletion cases; `rendererSuite()` and `rendererBrowserSuite()` gained the semantics fixtures; the catalog and design-system suites absorbed `"none"`, alpha, contrast pairs and the new recipe properties. The language-neutral corpus (45 cases across ten formats) and the 45 canonical-hash vectors ship and are executed by the library's own tests. Apps that passed 0.1.0 and kept their fixtures pick these up by upgrading; the store suite fails loudly for a store that kept 0.1.0's two-argument methods, which is the documented migration signal.

## 12. Reference hosts

**What Synapta can now adopt:** intent origin with host-side `checkOffered` (LF-01), generated types and element JSON for its agent surface (LF-02, LF-16), scoped state on one placement (LF-06), object-carrying events and live-region semantics (LF-05, LF-09), manifest `description`/`meta` and per-action `irreversible` (LF-07, LF-08), contrast pairs and no-paint/alpha colours (LF-10, LF-11), `capabilitiesFor` and `sourceOutcome` (LF-12, LF-14), `/authoring` without the MCP SDK (LF-15), the runner kit and self-contained bundle (LF-13), and the tree-patch measurement that closes LF-17's question. `docs/adopters-0.2.md` gives the API, spec section and limitation per row.

**What Clay can now adopt:** the result-labelled, controlled, URL-keyed `<Preview>` (CL-01), wrapper and portal host hooks (CL-02), clean exports without the source condition (CL-03), the full styling set including scrollbar and placeholder recipe properties plus reduced transparency (CL-04, CL-07), pluggable capture (CL-05), corpus and hash vectors for its port (CL-06), object-carrying events (CL-08) and generated implementation definitions (CL-09).

**Remaining gaps, all already owned:**

- **G29**, the native Windows forced-colours and assistive-technology audit, is unrun. The checklist stands; the owner waived the run for 0.2.0 and `CHANGELOG.md` discloses it. Backlog entry open.
- **Tree patches** are warranted by measurement but unapproved as a design; no format or API ships (§9). Backlog P2 with its decision log.
- **No authorisation model, approval flow, storage backend or layout shell** ships; those stay the app's, and `docs/security.md` says so.
- **Adopter migrations themselves** are app-owned work in Synapta's and Clay's repositories; nothing here claims production adoption.

**F9, no new action.** These four are the same items the adoption notes and the readiness review already name; each has an owner disposition, so this analysis adds no entry beyond F5.

## Archive comparison (security criterion)

Packed both registry versions and compared every file's SHA-256 (`npm pack`, unpack, `find . -type f | sort | xargs sha256sum`):

- File lists are identical: no file was added or removed between `0.2.0-rc.4` and `0.2.0`.
- Exactly two contents differ: `package.json` (`"version": "0.2.0-rc.4"` → `"0.2.0"`) and `CHANGELOG.md` (`## Unreleased (0.2.0)` → `## 0.2.0 — 2026-10-30`).
- The archive holds no `src/`, tests or fixtures, so the task-9 test fix and this task's documentation fixes are not in the published package.

The published archive therefore matches the reviewed candidate, apart from the version string and the changelog heading. Integrity `sha512-u/KXE1WfrjLdGYiIqtHQmb5TwjEQTm4roRbq5XZ9cJB/36lkOaeTjp+Gea3D2s7IyiPrCokHpWbpi0T6dyv+lA==`, provenance `https://slsa.dev/provenance/v1`.

## Validation

- `timeout 900s bun run check` after the fixes: 847 pass, 4 skip, 0 fail across 107 files (296 s).
- `bun run format:check`, `docs-links` and `docs-wording` after the documentation edits: pass.
- `bun scripts/release/peer-floors.ts`: React 19.0.0/19.0.0 96 pass, Playwright 1.49.0 18 pass, MCP server 2.0.0 34 pass.
- `bun run bench` on the released code: validator 1.399–1.432 µs/node (≤ 1.5), render 1.711–2.299 µs/node (≤ 3), `styleDeclarations` 0.403 µs/node. One earlier validator run reported `core-queue.large` at 1.523 µs/node with the load average at 2.46–3.57 and passed on the immediate rerun; that is F8's recorded variance, not a regression.
- Registry facts (version, dist-tags, integrity, provenance, gate) come from `plans/evidence/020-release.md`, unchanged by this task.
