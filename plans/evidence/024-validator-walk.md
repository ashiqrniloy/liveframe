# Plan 024 Task 4 (R14): single-traversal tree walk — measured, no change

Question: can `compileTree`'s `walk` (`src/validate/tree.ts`) save the second traversal of each node's `props`, `style` and `events` (the compiled checks, then `walkJson` for JSON validity and bytes) by counting bytes inside the checks (design a) or by one fused JSON walk (design b), and reach the plan's 15% on `agent-home`?

Answer: no. Regenerate with `bun plans/evidence/024-validator-walk.ts 31`.

## Method

`plans/evidence/024-validator-walk.ts` writes four throwaway variants of `tree.ts`, runs them interleaved with the real walk on the 679-node `agent-home` tree (31 rounds of 300 runs, each variant once per round, ratio taken per round), and deletes the variants. The variants are bounds, not implementations; they return wrong results on invalid input.

| Variant | What it removes | What it bounds |
| --- | --- | --- |
| `ceiling` | the JSON pass for every value | no design can beat this |
| `props` | the pass for `props` only | counting inside `compileSchema` |
| `payload` | the pass for `style` and `events` | counting inside the style check and the manifest intent checks |
| `floor` | `walkJson` replaced by a bare recursive byte count (no validity checks, no cycle set, no path) | the cost of counting alone |

## Results

Host load 20–35 throughout (a QEMU VM holds the CPU), so the paired ratios carry about ±5 points of noise. Three separate runs:

| Variant | Run 1 (21 rounds) | Run 2 (31 rounds) | Run 3 (31 rounds, committed script) |
| --- | --- | --- | --- |
| `ceiling` | 0.667 | 0.631 | 0.668 |
| `props` | 0.950 | 0.938 | 0.885 |
| `payload` | — | 0.906 | 0.843 |
| `floor` | — | 0.832 | 0.917 |

An inline scalar fast path in the walk (skip the `walk` call for string, number and boolean members) measured 1.03 and 0.99, so it was dropped.

## Reading

- The whole JSON pass is about a third of the walk, so there is something to save, but most of it is the counting itself. Counting every value with no validation at all (`floor`) still costs 0.83–0.92 of the walk. A fused design keeps that cost and adds what the floor leaves out: the plain-object and cycle checks and the error pointer, plus counting code in three check families.
- Design (a) inside `compileSchema` reaches `props` only: at most 5–12%.
- Design (a) across the style check and the intent checks (`type`, `name`, `key`, `bind`, `args`, `value`, which `compileSchema` does not cover) reaches `payload` as well, and each intent shape needs its own hand count. The upper bound for all three is the ceiling less the floor: 8–17%, before overhead.
- Design (b) rewrites error generation (the compiled checks own pointers, ordering and the maximum-error cut-off) for the same upper bound.

Neither design is expected to reach the 15% target or even the plan's 5% fallback with identical errors, and each carries a hot-path rewrite with a differential test and a frozen copy. Per the plan, R14 is recorded as "measured, no change". `tree.ts` is unchanged.

## Left for later

What the floor does show: bare counting is cheaper than `walkJson` by 8–17%, so the validity machinery in `walkJson` (the cycle `Set` add and delete, `path.push` and `pop`, the shared-context field writes) costs about that much. `render()`'s builder shares `walkJson`, so a change there is measured against both users. Reconstructing the path on the failure unwind instead of pushing it on the way down is the candidate. It is not part of this plan's scope and is recorded in the backlog.
