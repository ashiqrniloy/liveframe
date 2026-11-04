# Plan 025 Task 4: closure splits (R22)

Base: `ba1d5ff` (Plan 025 T3), the task's starting commit. Paired head/base ratios come from `bun bench/ab.ts ba1d5ff <bench> --runs N`. Bun 1.4.4 on Linux 7.3.0-4-cachyos. An A/A run (HEAD against HEAD, 15 runs) in Task 3 put this host's noise at about ±2% on the per-node metrics.

## What was split

| Function | Before | After | Suppression |
| --- | --- | --- | --- |
| `renderValue` / `emit` (`src/sdk/render.ts`) | 549 / 277 lines, closures over locals | Module-level functions over one plain `RenderContext` object. `emit` (80 lines) runs `expand` (component expansion), `isValidKey`, `emitFragment`, `kindOf`, `siblingSegment` (key and sibling resolution), `admitNode` (id and budgets), `classifyProps` and `propTarget` (prop classification), `checkStructure`, `checkNode` and `countNode` (Task 3's byte rules). | removed |
| `compileTree` / `walk` (`src/validate/tree.ts`) | 243 / 124 lines, closures over locals | `compileTree` builds a plain `TreeContext`. `walk` dispatches to `enterNode`, `checkId`, `enterTree`, `walkItems`, `walkMembers` and `memberMode`. | removed |
| `generate` (`src/sdk/gen.ts`) | 105 lines | `styleTypes` (a module-level table), `prelude(vocabulary)` and `component(definition, names)` | none before |
| `jsonSchema`'s `form` (`src/sdk/gen.ts`) | one switch | `formSchema`, `stringSchema` and `objectSchema` | removed |

Plan 024 Task 4 had not restructured `walk`, so the split applied. No function in the three files is over 120 lines, and none carries a `noExcessiveCognitiveComplexity` suppression.

## Gates

### `render.bench.ts` per node, 15 runs, load 3.5 → 2.6

| Metric | Ratio |
| --- | --- |
| agent-home-elements.usPerNode | 0.985 |
| core-queue.full.renderUsPerNode | 0.997 |
| core-queue.large.renderUsPerNode | 1.013 |
| synthetic-queue.renderUsPerNode | 1.017 |
| rack-module.renderUsPerNode | 0.987 |
| git-status.renderUsPerNode | 0.984 |

This run had the render split and the `gen.ts` split, but not yet the tree split.

### `validator.bench.ts` compiled per node, 15 runs, load 2.2 → 3.0

| Metric | Ratio |
| --- | --- |
| agent-home | 1.013 |
| core-queue.full | 1.006 |
| core-queue.large | 1.016 |
| git-status | 1.037 |
| rack-module | 1.019 |
| synthetic-queue | 1.005 |
| mixed-feed.compiledMs | 1.009 |

Re-run at 21 runs (load 3.3 → 3.1): git-status 1.009, rack-module 0.990 and agent-home 1.012. The 1.037 did not reproduce.

### `liveframe gen` on the proof catalog (gate ≤ 1.05)

- In-process `generate()` on `src/__tests__/fixtures/proof/catalog.json`: base 292.1 µs, head 298.5 µs, paired ratio 1.020 (21 rounds of 500 calls). The outputs are byte-identical.
- The CLI wall time (`bun src/cli/liveframe.ts gen …`, base in a fresh worktree) gave 81 ms base against 17 ms head. That measures process startup in a cold worktree, not `gen`, so it is not used.
- `bun run gen:check` passes, so the generated fixtures are byte-identical.

## Verdict

Every split meets its gate, so no split was reverted.
