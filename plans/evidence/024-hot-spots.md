# Plan 024 Task 6 (R16, R25): the minor hot spots

Question: which of the seven minor candidates gains at least 10% on its own call, with byte-identical output?

Answer: three are kept. `bundle`'s AST walk (item 2) takes 0.79–0.81 of its 0.2.2 time, `diffTrees` reorders (item 6) take 0.57–0.59, and `themeCss` (item 5) takes 0.57 on a catalog it has already seen, with a one-off 0.19 ms extra on a new one. Item 3 was already in the code. Items 1, 4 and 7 are "no change".

Regenerate the figures with:

```bash
timeout 1800 bun --conditions liveframe:source plans/evidence/024-hot-spots.ts 31
```

The script loads each candidate file as it stood at the task's starting commit (`git show 8dac0fa:<file>`) as the base. The head is either a throwaway edit of that source (rejected items) or the live file (kept items). It writes both next to the original so their relative imports resolve, runs them interleaved in one process (31 rounds; each round times base, then head, after a warm-up), checks that outputs are identical before timing, and deletes the files it wrote. The ratio is the median of the paired head/base ratios. The `liveframe:source` condition makes the fixture widgets' SDK imports resolve to `src/`, as `bun run test` does. Without it, item 4 renders fail and the script stops.

## Results

Host load 6–14. The QEMU VM recorded in `024-baseline.md` still holds the CPU. Runs 1 and 2 were taken after items 2 and 6 were in place. Item 5 was built afterwards, at the owner's request (see below), and its figures come from run 3 (load 5→6) with the live code:

| # | Candidate | Micro-bench (smallest public call) | Run 1 ratio (load 10→8) | Run 2 ratio (load 8→6) | Outcome |
| --- | --- | --- | --- | --- | --- |
| 1 | `validateJson`: two comparisons instead of `[Object.prototype, null].includes(...)` | `validateJson(agent-home tree)` | 0.971 | 0.992 | no change |
| 2 | `bundle`'s walk: `for…in` and a `Set` instead of `Object.values` and `Array.includes` per node, and one walk per module | `bundle(agent-home widget, 7 files)` | 0.812 (4.77 → 3.78 ms) | 0.794 (4.16 → 3.33 ms) | **kept** |
| 3 | Array schema checks stop once invalid and the sink is full | n/a | — | — | already present |
| 4 | `render`: char-code test instead of `/^on[A-Z]/` | `render` over each proof widget's scenarios | 0.96–1.09 | 1.03–1.05 | no change |
| 5 | `themeCss`: a content-checked cache of `validateCatalog`'s acceptance | `themeCss(certified theme, proof catalog)`, catalog seen before | 0.516 (bare-cache upper bound) | 0.521 (bare-cache upper bound) | **kept**: run 3, 0.568 (0.99 → 0.56 ms) |
|   |   | the same call, cycling 9 distinct catalogs through 8 entries (every call misses) | — | — | run 3, 1.180 (0.99 → 1.18 ms) |
| 6 | `diffTrees`: a pointer to the first unplaced child instead of `indexOf` and `splice` | `diffTrees`: 1,000 rows shuffled | 0.575 (0.71 → 0.43 ms) | 0.567 (0.69 → 0.40 ms) | **kept** |
|   |   | `diffTrees`: one row changed in 1,000 | 0.977 | 0.964 | no regression |
|   |   | `diffTrees`: agent-home, unchanged | 1.005 | 0.997 | no regression |
| 7 | R25: drop the `runner-kit/cache.ts` identity layer and use only the content-keyed LRU | lookup + `validateTree(agent-home)` | 1.251 | 1.328 | no change |

Earlier runs agree. Before the bundle change was final, three runs at load 8–10 gave `for…in` alone 0.888, 0.915 and 0.899, and dropping the second walk entirely 0.853, 0.821 and 0.837. Two first-pass runs at load 48 and 80 are not used: they swung from 0.79 to 1.08. Item 4 was also tried through `bench/ab.ts HEAD bench/render.bench.ts --runs 9` at load 10–14. Most runs tripped a render budget, and the three subjects read 1.07, 0.91 and 0.71, which is noise in both directions.

## Kept

### Item 2: `src/pack/bundle.ts`

- `walk` iterates the node's keys with `for…in` and tests function types with a module-level `Set`. It no longer allocates an `Object.values` array and an `includes` array per node.
- `checkModule` takes an optional `also(node)` visitor that runs on every node of its walk. `bundle` uses it to record the first `__lf_` identifier, so the reserved-identifier rule no longer walks each module a second time. The error is raised where it was, after `checkModule` returns with no errors, as a single `invalid-document` at the first reserved identifier's line. Because of that, a module with both a module-rule error and a reserved identifier still reports only the module-rule errors. `checkModule` is not exported from any public entry point, so no declaration changes.
- Proof: the script compares base and head `bundle` output on the agent-home widget, and the existing `pack-bundle`, `pack` and `preview-load` tests pass unedited. The new `reserved_identifier_reported_alone_and_after_module_rules` (`src/__tests__/pack-bundle.test.ts`) pins the single error and its pointer when there are two reserved identifiers, and that a forbidden import hides the reserved identifier. It passes against both the 0.2.2 and the new `bundle.ts`.

### Item 6: `src/validate/patch.ts`

- The child pass moved into `diffChildren`, which keeps `visit` under the complexity limit. Removes are emitted in reverse order as before. Then, instead of splicing a working copy, it keeps `first`, a pointer into the kept children in their old order, and a set of the children a move has already taken. At index `i` the patched list is the `after` prefix followed by the kept children not yet taken, so `children[i]` in the old code is the first untaken kept child. A child equal to it advances `first` with no op. Any other kept child emits the same `move` and joins the taken set. An insert leaves both unchanged. That is O(n) per parent instead of O(n²).
- It relies on unique ids within a parent. Spec §9 and `docs/formats.md` require validated trees as `diffTrees` input, so the plan's "position map" was not needed: the pointer is simpler and does the same job.
- Proof: `src/__tests__/patch-differential.test.ts` compares the canonical text of the result against a frozen copy of the 0.2.2 function (`src/__tests__/fixtures/diff-trees-0.2.2.ts`). `diff_trees_ops_identical_on_generated_reorders` runs 1,000 seeded nested trees with removes, inserts, edits and shuffles at every level (over 1,000 moves in all) and also checks that `applyPatch` round-trips each one. `diff_trees_moves_a_large_shuffle_like_0_2_2` covers 2,000 shuffled rows. With the skip loop deleted from the new code, both tests fail. The `conformance/patch/` vectors (`tree-patch.test.ts`) and the corpus pass unedited.

### Item 5: `src/css/theme.ts`

- At first this was recorded as "no change". The plan allowed it only "through the content-checked cache plan 022 Task 4 built for `compileValidator`, if that applies". It does not apply: that cache is private to `src/validate/compile.ts`, keyed on the pair (catalog, capabilities), and stores compiled catalog work, while `themeCss` has no capabilities. The owner then asked for item 5 to be built, so `/css` has its own small cache, built to the same rules.
- `installedCatalog` keys on the catalog's `JSON.stringify` text. Only accepted catalogs are stored, and each entry is the cache's own `JSON.parse` of the key, so mutating the caller's object later cannot change an entry (plan 022 F2). A hit also requires `sameJson(entry, catalog)`, so values the text hides (`NaN`, `undefined`, a `Date`) never match a stored entry; such objects are validated directly. On a hit the result is `{ ok: true, value: catalog }`, exactly what `validateCatalog` returns for an accepted catalog. Failures are never stored, because their error arrays go back to the caller. At most 8 entries are kept, least recently used evicted first, as in `compile.ts`.
- JSON-content equality is enough for catalogs: `validateCatalog` reads no prototypes (`checkMeta`'s plain-prototype rule applies only to manifests and capabilities), and `compileValidator`'s cache relies on the same equivalence.
- Cost: a hit saves about 0.43 ms on the proof catalog. A miss pays the key, the parse and the comparison on top of validation, about 0.19 ms, once per catalog content.
- Proof: the existing `css-theme` tests pass unedited, and output identity is checked in the script. New tests in `src/__tests__/css-theme.test.ts`: `theme_css_revalidates_a_catalog_changed_after_it_passed` (an accepted catalog mutated to be invalid returns `validateCatalog`'s errors, and clearing a returned error array does not affect the next call) and `theme_css_cache_never_matches_values_json_text_hides` (a catalog whose JSON text matches an accepted one but which carries an `undefined` member gets `validateCatalog`'s errors). With the `sameJson` guard removed from the hit path, the second test fails.

## Not kept

- **Item 1**, `validateJson`: 0.97–0.99. The prototype test runs once per object, and the walk's stack, ancestor set and pointer strings dominate.
- **Item 3**, array schema checks: `compileSchema`'s array case (`src/validate/schema.ts:159`) already has `if (!valid && sink.errors.length >= sink.maxErrors) return false;`. Nothing to change.
- **Item 4**, `render`'s event-name regex: 0.96–1.09 across the five proof widgets, so within noise. The regex runs only for props the definition does not declare as events, and JavaScriptCore compiles the anchored pattern well.
- **Item 7**, R25: without the identity layer, every worker render pays `compileValidator`'s content lookup (`JSON.stringify` of the catalog and capabilities, then `sameJson`), `validateManifest` and the per-manifest compile. Re-validation costs 1.25–1.33× as much, far outside the 5% limit. `src/runner-kit/cache.ts` stays as it is.

Errors, trees, patches and hashes are unchanged, `register-0.2.3.json` stays `[]`, and no declaration changes.
