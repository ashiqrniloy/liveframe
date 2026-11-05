# Plan 026 Task 5: validator realm evidence

The regression matrix in `src/__tests__/validator-bundle.test.ts` runs the actual self-contained validator bundle in a Bun `node:vm` context. Documents are parsed inside that context for the accepted setup; outer objects exercise every root document validator, compiler cache hits, tree and patch operations. Pack/store entry points and `renderModule` receive documents from the other realm separately. The validator bundle still omits pack and runner exports. Nested foreign objects, rejected node payloads, foreign catalog schema objects on a warm cache and throwing foreign accessors are covered. Same-realm and null-prototype documents retain their values; the existing conformance corpus supplies the broader acceptance and error regression proof.

Documentation checked with Context7: `/oven-sh/bun/bun-v1.4.2`, `docs/runtime/nodejs-compat.mdx`, confirms core `node:vm` APIs including `createContext`, `runInContext`, `runInNewContext` and `SourceTextModule`. Tests ran with Bun 1.4.4.

## Performance

The realm diagnostic is classified only after a prototype mismatch in existing JSON/tree walks. Install checkers previously lacked a uniform prototype boundary, so they now scan for foreign objects before reading document fields; their existing non-realm diagnostics remain owned by their original checks. This has an installation cost: the plan's original claim of zero cost for all accepted documents was too broad. There is no extra accepted-tree pass. A rejected node payload receives a cold realm scan so a schema failure cannot hide its foreign object.

`timeout 120s bun --conditions liveframe:source bench/validator.bench.ts` exceeded several absolute tree budgets on a loaded host (load at the end 9.04 / 12.80 / 8.16). Patch application was 0.2705 ms (0.5 ms budget), diff 0.8530 ms (1.5 ms budget), warm compilation 0.2160 ms (0.25 ms budget), and first compilation 1.3601 ms. That absolute run preceded removal of an unnecessary accepted-prop prototype check.

The paired tree-walk probe uses identical per-kind checks, asserts equal results, alternates baseline/head order for 15 rounds of 300 timed runs after 100 warm-ups, and reports the median paired ratio on the 679-node agent-home tree. Baseline is `cdcaf27458e5dc73dfc92ac344b71024914cb445` (Task 4). Result: **1.0158 head/baseline**, within the 2% non-regression allowance, with load 9.55 / 10.90 / 8.53. Absolute benchmark budgets on a quiet host remain unproven by this run.

Regenerate the paired result from the project root (use a fresh temporary worktree path):

```sh
timeout 10s git worktree add --detach /tmp/liveframe-t5-baseline cdcaf27458e5dc73dfc92ac344b71024914cb445
timeout 10s ln -s "$PWD/node_modules" /tmp/liveframe-t5-baseline/node_modules
timeout 60s bun build /tmp/liveframe-t5-baseline/src/index.ts --target browser --outfile /tmp/liveframe-t5-baseline.mjs
timeout 120s bun --conditions liveframe:source plans/evidence/026-validator-realm.ts /tmp/liveframe-t5-baseline.mjs
timeout 10s git worktree remove --force /tmp/liveframe-t5-baseline
timeout 10s rm /tmp/liveframe-t5-baseline.mjs
```
