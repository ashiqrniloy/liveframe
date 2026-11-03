# Plan 023 impact analysis

Executed 2026-11-03 against the checkout after Tasks 1–9 (HEAD `c277e31` plus this task's changes). The sweep covers the twelve impact areas in `.claude/skills/create-plan/references/liveframe.md` §5. Findings F1–F5 are listed at the end with the owner's disposition (given 2026-11-03, in answer to the questions of this task).

Method: each task's notes were re-read against the code and the docs; `api-stability`, `docs-links`, `portability`, `archive`, `sbom` and `build-pack-bundle` were re-run (40 pass; `shipped_docs_never_call_exports_planned` failed on its 200 ms time budget, 222 ms at load 16, the same budget failure plan 022 recorded). `scripts/release/api/register-0.2.3.json` is `[]`. The host was loaded throughout (load average 16–27 from two VMs and other test runs), which matters for area 7.

## Disposition of the review table

| Finding | Where | State |
|---|---|---|
| R1 custom runner trees | Task 2 | fixed |
| R2 top-level `await using` | Task 3 | fixed |
| R3 failed links cached | Task 3 | fixed |
| R4 hash cache | Task 4 | patch-safe part fixed; freeze is a 0.3.0 entry, written by plan 025 Task 7 |
| R5 `render()` freezes inputs | — | 0.3.0, plan 025 Task 7 |
| R6 worker error results | Task 5 | fixed |
| R7 `listPlacements` | Task 5 | fixed |
| R8 MCP draft paths | Task 6 | paths and trust model fixed; handle-based read is a P4 backlog entry |
| R9 `fr` on dimension props | Task 7 | deprecated; rejection is a `docs/compatibility.md` 0.3.0 entry (written) |
| R10 audit, SBOM, tag-only publish | Task 8 | done; owner actions open (F2) |
| R11 sucrase dependencies | Task 9 | done |
| R12–R25 | plans 024 and 025 | handed off, unchanged |
| R26 import ban is syntactic | — | no change, documented non-sandbox |

## 1. Spec

`docs/spec.md` describes what shipped. Plan 023 changed three statements: §7.1 and §7.3 now name `await using` beside `await` and `for await` (Task 3), and §6.3 marks fractions on the six dimension props as deprecated (Task 7). §7.5 and `docs/security.md` item 3 already promised host validation of every runner tree (Task 2) and the verified-hash assumption was added to item 3 (Task 4). Nothing else in the spec moved. The §13 package table lists subpaths, not internals, so it does not need to mention that `/pack` bundles its transform; no statement is false.

## 2. Public API and formats

No declaration, export, schema, corpus case or vector changed. `register-0.2.3.json` is `[]` and `baseline_0_2_2_matches_the_checkout_with_an_empty_register` passed at the end of every task. One surface did grow: the store conformance suite gained the case `store_lists_only_placement_records` (Task 5), which `exports.test.ts` and `conformance-store.test.ts` count (16→17 cases). That is an added conformance case, not a declaration, and no existing case changed. The published archive gained one file, `dist/pack/THIRD-PARTY-LICENSES` (plus `dist/pack/sucrase.js`, matched by the existing `dist/**/*.js` rule); `archive.test.ts` allows it by name. `dependencies` shrank from `acorn`, `sucrase` to `acorn` (CHANGELOG "Changed"). Versioning: no bump.

## 3. The four laws

1. **Widget code never runs in the browser.** Tighter: `checkModule` rejects top-level `await using`, which closes a way to leave a module suspended (Task 3). The bundled sucrase transform runs only at pack time on the host.
2. **The tree is validated data.** Tighter: every tree from a custom runner is validated on the host in `createPreview()` and `createAuthoring()` (Task 2); worker error results are shape-checked (Task 5); placement listings fail closed (Task 5).
3. **No colours or raw CSS from widgets.** Unchanged. `fr` on a dimension prop still projects to an inert declaration, now documented.
4. **A widget never holds authority.** Unchanged. The verified-hash cache now compares the content references it verified (Task 4), so a mutated package can no longer load new code under a verified hash.

No new path for a leak.

## 4. Validation

New inputs and their typed failures: runner trees (`invalid-prop`, `unknown-component` at the offending pointer); `await using` (`invalid-document`, expectation `synchronous`); malformed worker answers (`render-failed`, one message, worker recycled); corrupt placement records (`invalid-document` naming the file). Error `kind` and `pointer` are unchanged everywhere else; MCP draft messages no longer carry absolute paths (Task 6).

Known limit, recorded in Task 4 and `docs/security.md` item 3: mutation inside `manifest` or `scenarios` after verification is not detected. Freezing is the 0.3.0 contract.

## 5. Styling

None — no theme, recipe or projection change. Fractions on dimension props keep their bytes (`css-style-props.test.ts` unchanged apart from a comment).

## 6. Interaction tiers

None — no change to local, `setState` or action behaviour.

## 7. Performance

Task 2 adds one `validateTree` per preview render and per authoring scenario: the same work the worker runner's host re-validation already does (0.907 ms median on the proof catalog). It was not re-measured, and neither path is bench-gated. Task 9: median of 20 packs of the five proof widgets was 119.6–126.1 ms before and 87.8–103.1 ms after the sucrase bundle, within the 5% limit, but taken at load 20–27. The full `bun run check` failed wall-clock tests at load 16–27 in Tasks 5, 6, 8 and 9 (`in_process_warm_overhead_under_point_one_ms`, `validator_smoke_under_5us_per_node`, `verify_agent_home_under_20_ms`, `every_proof_scenario_passes_check`, `switch_*` browser cases, the docs-wording time budget). They pass on a quiet or lightly loaded host (Task 7's second run: 1018 pass, 0 fail) and none of them executes `dist/pack`. A clean full run on a quiet host is open (F4).

## 8. Portability

The host-API-free scan passes. `dist/pack/sucrase.js` is scanned with a stricter rule than before: it must import nothing, and its known generated-code strings (the pinned list now shared as `pinnedSnippets`) are removed before the forbidden-pattern check. Previously the same code lived in `node_modules` and was exempt from the dist scan. The build throws if the bundle imports `node:` or `bun:`. `bun run release:gate` passes all 14 steps, including the Node probe, with sucrase and its dependencies absent from `node_modules`. `sbom.ts` uses `Bun.JSONC.parse`; its test and `audit-bundled.ts` pass on Bun 1.4.2 (the CI pin) as well as 1.4.4 (checked with the official 1.4.2 binary, F3).

## 9. Agent authoring

An agent now gets typed errors where it used to get `ok: true`: `render_scenarios` reports the validator's `kind` and `pointer` for an invalid custom-runner tree (Task 2). MCP draft errors name the file and the agent's own `dir` without the host path (Task 6). Both are messages an agent can act on.

## 10. Docs and examples

Updated: `docs/spec.md` (§6.3, §7.1, §7.3), `docs/styling.md`, `docs/packages.md`, `docs/security.md`, `docs/mcp.md`, `docs/compatibility.md` (Deferred to 0.3.0, Release process) and `CHANGELOG.md` (Fixed, Added, Changed, Deprecated under Unreleased). Plan 025 Task 7 collects them into `## 0.2.3` and adds the `docs/adopters-0.2.md` note and the 0.3.0 entries for the freeze (R4, R5) and the verified-package cache option (R15). `docs-links` passes.

## 11. Conformance

One added store case (above). No corpus, hash or patch file changed. The synchronous-module rule has no corpus case: `conformance/corpus/package/` holds document-level cases only (Task 3). A port that implements packing would need the `await using` rule from the spec text; no port has asked.

## 12. Reference hosts

- A host that wrote its own runner and relied on `session.render()` reporting `ok: true` for any tree now gets the validator's errors for an invalid one. That is a correction, not a gap.
- A host that imported `sucrase` only because Liveframe installed it must depend on it directly (CHANGELOG "Changed").
- A host that raises its runner's limits cannot make the session validate against them (F5).
- A host sharing `draftRoot` with other writers needs the handle-based read (backlog P4, Task 6).
- No Synapta or Clay request is affected.

## Findings and dispositions

The owner's answers, 2026-11-03:

- **F1 — Bundled code left both the audit and the SBOM. Executed.** After Task 9 `sucrase` is a devDependency, so `bun audit --prod` and a closure-only SBOM no longer covered the code that ships in `dist/pack/sucrase.js`. Done in this task: `scripts/release/audit-bundled.ts` fails CI on a high or critical advisory in any bundled package, and `sbom.ts` now lists the seven bundled packages (property `liveframe:bundled`) beside `acorn`. Both read the `### name@version` headings of `dist/pack/THIRD-PARTY-LICENSES` and therefore run after the build; CI and the publish job run them after `bun run check`. Tests: `sbom_inventories_the_bundled_packages` and `bundled_advisories_fail_only_on_high_or_critical_bundled_packages`. `sbom.ts` fails when the licence file is missing, so the SBOM cannot silently omit bundled code. Limit: `audit-bundled.ts` reads `bun audit --json` as a map from package name to advisories and I could only test it on a synthetic map, because the project has no advisories.
- **F2 — The `release` environment and the npm trusted publisher are not set up. Handed to plan 025 Task 9** as pre-release blockers, with the dry-run trade-off: because the job declares the environment, a tag-only rule also blocks a `workflow_dispatch` dry run from a branch.
- **F3 — `Bun.JSONC` on CI's Bun 1.4.2. Executed.** The official `bun-v1.4.2` binary ran `sbom.ts` (output byte-identical to Bun 1.4.4's), `sbom.test.ts` (5 pass) and `audit-bundled.ts`.
- **F4 — No full `check` on a quiet host, and the pack-time figures were taken under load. Handed to plan 025 Task 8** (and appended to the backlog entry "Re-run the full benchmark suite on a quiet host").
- **F5 — `createPreview()`/`createAuthoring()` take no `limits`. Backlog P4**, a 0.3.0 candidate because it adds a declaration ("Let `createPreview()` and `createAuthoring()` take validation limits").

Every row of the disposition table is fixed, deferred with an entry, or handed to plans 024 and 025.
