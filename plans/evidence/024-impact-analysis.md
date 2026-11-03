# Plan 024 impact analysis

Executed 2026-11-04 against the checkout after Tasks 1–6 (HEAD `6d7f4c5` plus this task's changes). The sweep covers the twelve impact areas in `.agents/skills/create-plan/references/liveframe.md` §5. Findings F1–F4 are listed at the end with the owner's disposition (given 2026-11-04, in answer to this task's questions).

Method: each task's notes and evidence record were re-read against `git diff 6886e4b HEAD` (33 files: `src/` changes in `react/renderer.tsx`, `react/share.ts`, `pack/hash.ts`, `pack/bundle.ts`, `validate/patch.ts` and `css/theme.ts`; the rest benches, tests and evidence) and against the spec and docs. `docs-links` and `api-stability` were re-run (9 pass). `scripts/release/api/register-0.2.3.json` is `[]`. Host load during this task: 4.2–6.0 (`uptime`, 02:30 local), still above the quiet-host limit of 2.

## Disposition of the review findings handed to this plan

| Finding | Where | State |
|---|---|---|
| R12 `<Surface>` reuse lost on inline `fallback` / new `diagnostics` | Task 2 | fixed (121 → 8.4 ms, ratio 0.068) |
| R13 index-aligned child sharing | Task 3 | fixed; head insert reuses all 50 rows |
| R14 two traversals in the tree walk | Task 4 | measured, no change (8–17% upper bound against a 15% target); backlog P4 "Cut the validity cost inside `walkJson`" |
| R15 SHA-256 and `canonicalJson` | Task 5 | patch-safe part done, 2× missed (1.3–1.5×); backlog P4; package cache is a 0.3.0 entry for plan 025 Task 7 |
| R16 minor hot spots | Task 6 | items 2, 5, 6 kept; 3 already present; 1 and 4 no change |
| R25 runner-kit identity cache | Task 6 | measured, no change (1.25–1.33× without it) |

## Load averages in the records

Every record carries them: `024-baseline.md` (`uptime` lines, 13–15), `024-surface-reuse.md` (12–17, spike 30), `024-validator-walk.md` (20–35), `024-sha256.md` (25–39), `024-hot-spots.md` (5–14). Task 3's A/B has no separate record; its notes in the plan carry the load (18–32 and 19–32).

## 1. Spec

One stale statement, fixed here (F1). §11 (`docs/spec.md`, the `events` bullet of the implementation contract) said "validator, fallback, portal or diagnostics changes reset reuse". After Task 2 only the validator, the portal and diagnostics on/off reset it; plan 024 Task 2 had wrongly said §11 does not state the rule. The sentence now gives the new rule and says children are matched by `id` within their parent (Task 3). §10 validation budgets, §7.3 hashing and §6.4 CSS determinism are implemented faster, not differently.

## 2. Public API and formats

No declaration, export, schema, corpus case, hash vector or patch vector changed. `register-0.2.3.json` is `[]`, and `baseline_0_2_2_matches_the_checkout_with_an_empty_register` passes. `checkModule` gained an optional `also(node)` visitor (Task 6, item 2), but it is internal and not exported. `/css` holds a new module-level cache of at most 8 accepted catalogs (Task 6, item 5); `themeCss` stays pure in its outputs.

## 3. The four laws

1. **Widget code never runs in the browser.** Unchanged. `bundle()`'s reserved-identifier check rides on `checkModule`'s walk but still runs after it and raises the same single error.
2. **The tree is validated data.** Unchanged. Reuse (Tasks 2, 3) runs only after arrival validation and substitutes only deep-equal values; the parent also requires each child's previous node at the same index, so a reorder never draws the old order.
3. **No colours or raw CSS from widgets.** Unchanged. The `themeCss` cache stores only accepted catalogs as its own parse of the key text, and a hit also requires `sameJson`, so a catalog mutated after it passed is validated again (plan 022 F2 guard; `theme_css_revalidates_a_catalog_changed_after_it_passed`).
4. **A widget never holds authority.** Unchanged. Hashes key the module and validator caches; `sha256` is proven against the native hasher on 10,000 random inputs plus 1 MiB and 16 MiB, and every vector passes unedited.

No new path for a leak.

## 4. Validation

None — no new input. Error lists are unchanged: `canonicalJson` still throws the same `TypeError`s in the same precedence (Task 5), `diffTrees` emits byte-identical ops (differential test against a frozen 0.2.2 copy, Task 6), and `bundle`'s errors are pinned by `reserved_identifier_reported_alone_and_after_module_rules`.

## 5. Styling

`themeCss` caches catalog acceptance (above). Output bytes, errors and the §6.4 rule "inputs are validated before output" hold: a miss validates in full, failures are never stored. No theme, recipe or projection change.

## 6. Interaction tiers

None — handlers on reused nodes still read the currently accepted tree and callbacks. `failed_node_retries_on_next_arrival` and `reused_nodes_follow_confirmation_fallback_and_diagnostics_changes` pass unedited; a failed node now reads the current fallback through a context (`replacing_fallback_updates_failed_nodes`).

## 7. Performance

The plan's subject. Met: R12 (0.068), R13 (50 of 50 rows reused; reuse pass ratio 1.10, at the limit and below the bench's 0.1 ms resolution), `diffTrees` reorders (0.57), `bundle` (0.79–0.81), `themeCss` hit (0.57). Missed and backlogged: `sha256` 2× (1.3–1.5×), `packageHash` ≤ 5 ms (0.2.2 itself reads 68–80 ms on this host), R14 15% (no change). Every figure is a paired ratio on a loaded host; no quiet-host `bun run bench` was possible (`024-baseline.md`). Bench tooling: `validator.bench.ts`'s `compileValidator` 0.25 ms gate never failed the process (Task 1 finding) and now does (F3). Quiet-host runs of `bun run bench` and `bun run check` remain owed to plan 025 Task 8.

## 8. Portability

None — `hash.ts`, `patch.ts`, `bundle.ts`, `theme.ts` and `share.ts` use no host API; the host-API-free scan passes. `node:crypto`/`Bun.CryptoHasher` appear only in tests; `bench/` and `plans/evidence/*.ts` are dev tooling, not published.

## 9. Agent authoring

None — no generated type or error message changed.

## 10. Docs and examples

`docs/renderer.md` states the new reset rule (Task 2) and now says children are matched by `id` (F1). `CHANGELOG.md` Unreleased gains a Performance block with the measured ratios (F2); plan 025 Task 7 collects it into `## 0.2.3`. `docs-links` passes.

## 11. Conformance

None — no corpus, hash or patch file changed, and `conformance/react` passes unedited. Render counts are not part of any suite (plan 022 decision: invisible to pure implementations).

## 12. Reference hosts

- A host that memoised `fallback` or `diagnostics` to keep reuse no longer needs to; nothing breaks if it keeps doing so.
- A host that relied on a new `fallback` element to force every node to re-render loses that side effect. Render counts are not a contract (plan 022 decision), so this is not a break.
- No Synapta or Clay request is affected.

## Findings and dispositions

The owner's answers, 2026-11-04:

- **F1 — §11 stated the old reset rule. Executed.** `docs/spec.md` §11 and `docs/renderer.md` now give the Task 2 reset rule and the Task 3 id matching.
- **F2 — No CHANGELOG lines for plan 024. Executed.** `CHANGELOG.md` Unreleased has a Performance block.
- **F3 — The `compileValidator` bench gate never failed the run. Executed.** `bench/validator.bench.ts` sets `process.exitCode` after the last gate. Bench only; not part of `bun run check`.
- **F4 — Three 024 targets were missed. Plan 025 Task 8 amended:** its acceptance table cites the 024 evidence as "missed, backlogged" and re-measures against the achieved figures; the misses are listed in plan 024's Compromises, and the fixed gate is named in Task 8's performance criterion.
