# Plan 027 architectural impact analysis

Reviewed 2026-11-07 against `6d0e6da` (Tasks 1–7) plus Task 8's own changes. Covers all twelve areas in `.claude/skills/create-plan/references/liveframe.md` §5. This closes the formats batch of 0.3.0 (node references, extension properties, variant axes with role aliases, app-declared states and semantics, `url` strings); it is not the 0.3.0 release or plans 028–032. Existing edits to `plans/README.md` and `roadmap.md` and untracked plans 028–032 predate this task and are preserved.

Method: read the complete plan and its notes; compare `git diff 23ba39d~1..HEAD` (150 files, +11.3k/−0.2k lines under `src docs schemas conformance scripts`; five published schemas changed: `capabilities`, `catalog`, `design-system`, `manifest`, `schema-language`); re-check each new style input against law 3 in code; run the whole-plan verification; run the benchmarks alone, with a paired baseline for the one that failed.

## 1. Spec

`docs/spec.md` carries each addition: `$anchor`/`refProps`/`ref()` (§5, §10, SDK section), `vocabulary.extensions` and `--lf-p-` (§6.2, §6.4, §6.5), `axes`, the six-layer cascade and the seven alias rules (§5, §6.2, §6.4), `vocabulary.states`/`semantics` and `ariaRoles` (§5, §6.4), `url` (§5), `domId` (§11) and the `catalogSuite`/`rendererSuite`/`designSystemSuite` coverage (§13). The limits in the spec match the code (≤ 8 `refProps` `src/formats/catalog.ts:34`, three axes/16 values/256 combinations `src/formats/axes.ts:4-6`, ≤ 16 app states). One gap was found and closed by Task 8: the spec bounded combinations per kind only (F3, now also a catalog-wide total, §5). The `catalogSuite` URL-prop case (F4) is in §13.

## 2. Public API and formats

Every addition is an optional field under existing format ids, so a 0.2.x validator rejects it fail-closed (the 0.2.2 precedent). `scripts/release/api/register-0.3.0.json` has `added`/`widened` entries for `ref`, `NodeRef`, `extensionVar`, `ariaRoles`, the five schemas, `Vocabulary`, `Recipe`, `ResolvedRecipe`, `Definition`, `RecipeKey`, `slotClass`, `ImplementationProps`, `LanguageSchema`, `str`, and every corpus file. Two behaviours tightened and are registered `changed` with a migration section ("Semantics enums and recipe states follow the vocabulary"). Task 8 adds two corpus files (`catalog/axes-total-too-large.json` and its document) and one install rule. `catalogSuite` gains a case, which is a suite behaviour (not a declaration) change; it is documented in the migration guide, and no register entry applies because the declaration is unchanged. `api-stability.test.ts` passes in the full check.

## 3. The four laws

1. **Widget code never runs in the browser.** No path moves. References are derived ids; `domId` is computed by the renderer (`src/react/renderer.tsx:244,327,439`), not authored.
2. **The UI tree is validated data.** Reference values are checked against the same tree's id set after the walk (`src/validate/tree.ts`); a dangling reference is `not-found`. `url` is a closed keyword checked by one linear function shared by the compiled validator and `checkValue` (`src/url.ts:15`), with no `URL` global.
3. **Widget code never sets colours or raw CSS.** Reviewed against every new style input:
   - Extension names match `^[a-z][A-Za-z0-9-]*$` (no `;`, `}`, `/`, `_`, `.` or space), values are typed design values or theme roles, and a literal colour is `colour-outside-theme`.
   - Role aliases name only declared theme roles and are checked at install, including every rewritten role.
   - App states carry only `data-` attributes that must equal `data-<kebab-name>` and may not reuse a library state's attribute, so no selector text is authored. The semantics allowlist (`ariaRoles`) holds 29 roles and excludes widget roles.
   - Axis values and variants are tokens (`^[a-z][A-Za-z0-9-]*$`, `src/formats/catalog.ts:12`), so `__` in a resolved key or class cannot collide with a name, and a key never contains `.` or `:`.
   - Node ids are `^root(/...)*$` over the URI-unreserved set (`src/formats/tree.ts:94`); the DOM id adds `lf-` plus `encodeURIComponent(useId())`, so it contains no whitespace and is valid in an `aria-*` id list.
   - `url` is opt-in. A prop without it is a plain string; F4 adds a conformance case that surfaces URL-named props that declare nothing.
4. **A widget never holds authority.** No new hook, action or ambient capability. References and states grant nothing; focus and `domId` emit no intent.

No new bypass was identified. This is a targeted review of the plan's inputs, not a fresh whole-repository audit.

## 4. Validation

Each new input has a typed error at a pointer: `unknown-name`/`invalid-document`/`colour-outside-theme` at `/recipes/<key>/extensions/<name>`, `/recipes/<key>/roles/<from>` (with the `/registry/<id>` prefix for inherited entries), `duplicate-key` at the second `$anchor`, `not-found` at the referencing prop, `invalid-prop` for a rejected URL. Every cap multiplies enum sizes rather than expanding combinations, so a hostile catalog allocates nothing. F3 closes the one unbounded path: every kind could carry 256 combinations, so a 256-definition catalog could expand to ~65,000. Task 8 adds a catalog-wide total of 512 (`src/formats/axes.ts:8`, `src/formats/catalog.ts:197`), approved by the owner (`decision-logs/2026-11-07-0108-catalog-wide-axis-combination-limit.md`).

## 5. Styling

Kinds without axes, extensions or app states project byte-identical sheets (152,457 and 164,425 bytes, asserted). Recipe completeness is unchanged: axis overlays, extensions and app states are optional overlays, with `rest`/`focus` rules applying to the base layers. `auditContrast` checks every axis combination and ignores extensions (documented). Forced colours: an app state that differs from rest gets the 1px `Highlight` outline cue; a colour extension has no alpha modifier, so reduced transparency needs no recovery (pinned by `extension_recovers_under_reduced_transparency`).

## 6. Interaction tiers

None — no new local, `setState` or action contract. A reference resolves to a DOM id only; focus continuity from plan 026 is unchanged and `domId` is stable across re-renders (`dom_ids_stable_across_rerender`). Local bindings and action outcomes belong to plan 029.

## 7. Performance

Machine: Bun 1.4.4, Linux 7.3.0-4-cachyos, AMD Ryzen 9 PRO 7940HS, 16 logical CPUs. The host is shared: unrelated QEMU VMs hold about 220% CPU and unrelated Rust builds ran during the work, so the 1-minute load average was 2.5–3.3 at best and 8–80 at worst. **No run reached the below-2 load the quiet-host backlog entry requires**, so this is not quiet-host proof.

| Check | Result |
| --- | --- |
| Single `bun run bench` (load 3.2 → 3.2, 00:14:38–00:14:50) | exit 1 at `core-queue.full` 1.508 µs/node (limit 1.5); agent-home 1.449; the `&&` chain stopped before render, CSS and streaming |
| Paired A/B, six alternating runs against `ac85dc4` (plan 026 end), load 2.5–3.3 | baseline `core-queue.full` best 1.523, others 1.595–1.623; HEAD best 1.510, others 1.555–1.610; agent-home 1.337–1.377 vs 1.326–1.388. The same gate fails at both commits: no regression is attributable to plan 027 |
| Render bench, three runs (load ≈ 3.5–4) | pass: agent-home 1.855–2.168 µs/node, total ≤ 3, validation reservation ≤ 1.5 on agent-home |
| CSS bench | certified design system 23.8 ms/12.6 ms (rack), 152,457/164,425 bytes, unchanged from the byte baselines |
| Streaming bench (`agent-home`, 679 nodes, 100 revisions) | arrival validation 1.4 ms median (p95 1.7, max 2.2 vs the 8 ms threshold); gzipped whole tree 5,098 bytes |
| Extension projection time, three runs at load ≈ 3 | paired growth 15.3–20.1% on rack/certified (gate ≤ +20%); size +3.8%/+3.6% |
| Node references (Task 2 evidence) | +1.87% validation, +0.56% rendering (gate ≤ 2%) |
| Axes | 24-combination button doubles the proof sheets (+105%); projection time 0.93–1.06× linear; warm switch 3.5–5.7 ms of 16.67 |

F1: the validator gate sits within 1–2% of its limit at both commits, so noise decides it. Task 8 changes only how the bench measures, not the limit: `measure` now reports the median of five batches of 200 runs instead of one mean of 1,000, so one disturbed batch cannot decide a gate (`bench/validator.bench.ts:29`). Six runs after the change gave `core-queue.full` 1.468–1.520; two of the six still tripped some fixture's gate (load 3). A nine-batch variant was tried and dropped: it ran while an unrelated build pushed the load to 81, so its figures measure the machine. The threshold and the quiet-host requirement stay as they were.

## 8. Portability

`src/url.ts`, `src/formats/axes.ts` and `src/formats/vocabulary.ts` use no host API (the only `URL` in `src/url.ts` is a comment). The `url` check needs no non-ECMAScript global, so the root export, `validator.bundle.js` and the portability table in the README are unchanged; the bundle and source-versus-compiled portability tests pass in the full check. Bun remains the only runner. No dependency is added. WebKit and Firefox pass the CSS and React browser tests (61 pass/6 skip and 67 pass/0 fail), so `domId`, `--lf-p-` and axis classes are not Chromium-only.

## 9. Agent authoring

`liveframe gen` types a reference prop as `NodeRef`, so an agent that passes a string gets a type error, and element JSON accepts `{ "$ref": anchor }` markers. A top-level `url` prop gets a doc comment naming the allowed schemes; nested `url` strings are documented only by the schema (recorded in Task 7). Errors name the anchor in `expected` (`not-found`) or the allowed schemes (`invalid-prop`). Axis values are ordinary enum props, so generated types and element schemas needed no change. F4 gives an agent-authored catalog the same feedback at conformance time: the `url_props_declare_a_url_rule` message says to declare `url`, a `pattern` or an `enum` and lists each path.

## 10. Docs and examples

Spec, `docs/sdk.md`, `docs/formats.md`, `docs/styling.md` (extensions, variant axes, app states, app semantics), `docs/security.md` ("URL-valued props: declare `url`"), `docs/renderer.md`, `docs/conformance.md`, `docs/compatibility.md`, `docs/migration-0.3.md` and `CHANGELOG.md` cover every addition with before/after examples and adopter actions. Task 8 added the catalog-wide axis limit (spec §5, formats, styling cost paragraph, changelog, migration step) and the new conformance case (conformance guide, spec §13, migration, changelog). The proof and demo catalogs show `ref`/`hint` and `url` usage; the demo has no URL-valued prop, so it shows `url` only through the proof pair.

## 11. Conformance

Corpus cases cover every addition, including the Task 8 catalog-wide limit. `rendererSuite` checks `refProps` resolve to elements, `designSystemSuite` fails a missing `--lf-p-` variable or axis slot class, `catalogSuite` requires one example per axis value, and the styled-state fixtures derive from the catalog's states. F4 adds `url_props_declare_a_url_rule`. The suite case counts in `conformance-catalog.test.ts` (5 → 6, 4 → 5) are updated. The proof `export-formats.ts` fixture exporter (F2), which regenerates the shared fixtures behind these suites, had drifted and is fixed.

## 12. Reference hosts

- Clay and Synapta can use `ref` for `aria-describedby`/`labelledby` without positional ids, `axes` plus `roles` for tone × emphasis in place of product variants (Synapta's `foil` tone and similar), `vocabulary.states` for `dragging`/`dropTarget`-style states and `vocabulary.semantics` for toolbar-like containers, and `url` to retire hand-rolled `javascript:` blocking. None is a primitive or an exception for either host.
- The migration guide lists each adopter action. Adopters get one new suite failure on upgrade: a plain `href`/`src`/`url` prop. Installed 0.3.0 adoption, hostile-code isolation and the quiet-host proof remain later approved work.
- Environment note: `demo:test` could not run its browser tests until Chromium for the demo's own Playwright was installed (`bunx playwright install chromium` in `examples/demo-host`, done in this task). It then passed 54 of 54.

## Findings and dispositions

The owner answered **"Execute all four"** to the recommended dispositions (F2 execute; F1, F3, F4 backlog), then confirmed **"512 (Recommended)"** for F3's number.

| Finding | Recommended | Final disposition and evidence |
| --- | --- | --- |
| F1 — `core-queue.full` ≤ 1.5 µs/node fails at both the plan 026 baseline and HEAD; `bun run bench` exits before the other stages (`bench/validator.bench.ts`, `package.json:150`) | Backlog (P3, existing entry) | Executed: measurement stabilized (median of five batches). The 1.5 limit and the quiet-host requirement are not changed; the existing backlog entry carries this run. The gate still trips on noise because the measured value is within 1–2% of the limit |
| F2 — `proof/scripts/export-formats.ts` fails its recipe round-trip on the 0.2.2 states, so the documented fixture regeneration path was broken | Execute | Executed: the round-trip compares the proof's own eight states and writes the library's full table; regenerating into a scratch directory matches the committed fixtures byte for byte (the three `*.manifest.json` files come from a different path) |
| F3 — Axis kinds expand eagerly (~8 KB CSS per combination) with only a per-kind cap | Backlog (P4) | Executed: catalog-wide total of 512 (`src/formats/axes.ts:8`, `src/formats/catalog.ts:197`), test `axis_combinations_are_bounded_across_the_catalog`, corpus case, spec/formats/styling/migration/changelog updates, decision log 2026-11-07-0108 |
| F4 — No conformance feedback for URL-named props that skip the `url` rule | Backlog (P3) | Executed: `url_props_declare_a_url_rule` in `catalogSuite` (`src/conformance/catalog.ts:22`), test `url_props_declare_a_url_rule`, conformance guide, spec §13, migration and changelog |

## Verification

- `timeout 900 bun run check`: first full run (load 2.5–5.4) passed 1,188 tests, 4 existing skips, 0 failures (349 s of tests), before Task 8's changes. The final run after Task 8's changes passed 1,192 tests, 4 skips, 0 failures (390 s, load 5–12 from unrelated work). A mid-task run failed only `spec_paragraphs_stay_short` (a spec bullet made too long) and was fixed.
- `LIVEFRAME_BROWSER=webkit … css-browser.test.ts react-browser.test.tsx`: 61 pass, 6 skip, 0 fail. `LIVEFRAME_BROWSER=firefox`: 67 pass, 0 fail.
- `bun run demo:test`: 54 pass, 0 fail, after installing Chromium for the demo's Playwright.
- Benchmarks as in area 7. `plans/evidence/019-streaming-bench.md`, regenerated by the streaming bench, was restored to its committed content.
- No release, publish or external-host change was made.
