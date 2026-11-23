# Streaming loop baseline (plan 042 Task 4, LF-36)

The cost of the loop in `docs/sdk.md` "Draw agent JSON while it streams", end to end: host `streamElements`
and `diffTrees`, then client `JSON.parse`, `applyPatch` (or the whole tree) and `validateTree` of every update.
This is the baseline plan 046 must beat. The stage is informational in 0.4.1 and sets no budget.

Regenerate:

```sh
timeout 600 bun --conditions liveframe:source bench/stream-loop.bench.ts
```

## Inputs

- Documents from `streamLoopDocument(rows)` (`src/__tests__/fixtures/stream-loop.ts`): a stack holding a title
  text and a stack of `rows` text rows, so `rows + 3` nodes. 1,003 nodes are 55,954 characters; 4,003 nodes are
  229,954 characters.
- 4-character chunks, fed as fast as the host reads them (a replayed or buffered stream).
- The 0.4.0 loop sends one update per tree `push` returns. The coalescing loop sends at most one per 16 ms frame
  on the host's clock, plus the final tree after `end()`. The bench keeps the client's time off the host's clock,
  as if the client ran on another machine.
- "Sent" sums the JSON text of every message sent, including the final whole tree, over the document's length.

## The request's reproduction (Synapta, 0.4.0 loop)

| Nodes | `streamElements` alone | Whole pipeline | Host `diffTrees` | Client apply and accept | Patch bytes |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1,003 | 9 ms | 0.86 s | 0.17 s | 0.67 s | — |
| 4,003 | 31 ms | 16.0 s | 3.4 s | 12.4 s | 3× the document |

## This host (2026-11-23)

Bun 1.4.5; Linux 7.3.5-2-cachyos; AMD Ryzen 9 PRO 7940HS; load average about 10 (not a quiet host). Two runs;
the second is shown, the first in brackets.

| Loop | Nodes | Total | Host | Client | Updates | Sent |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.4.0, per tree | 1,003 | 822 ms (1,168) | 274 ms (428) | 548 ms (740) | 1,003 | 5.54× |
| coalescing | 1,003 | 11 ms (16.5) | 10 ms (15.0) | 1.1 ms (1.6) | 2 | 1.17× |
| 0.4.0, per tree | 4,003 | 17.7 s (16.7) | 6.06 s (5.68) | 11.6 s (11.1) | 4,003 | 5.48× |
| coalescing | 4,003 | 120 ms (130) | 70 ms (70) | 49 ms (60) | 5 | 2.47× (2.62) |

The 0.4.0 loop reproduces the request's figures. Its "sent" ratio is higher than the request's 3× because this
count includes each message's wrapper and the final whole tree.

## What the numbers do not show

- With a source faster than the loop, coalescing sends a handful of updates, so the total falls near the cost of
  `streamElements` plus one final tree. With a source slower than one tree per frame (a model writing one small
  node every few frames), the loop sends every tree, as the 0.4.0 loop did. Each update then still costs one
  `diffTrees` of two whole trees and one whole validation in the client, so its cost grows with the document. At
  4,003 nodes the 0.4.0 loop spent about 4.4 ms per update. That is the part plan 046 removes, with the stream's
  own append patch and incremental validation.
- The coalescing loop's patch bytes at 4,003 nodes (2.47×) exceed plan 046's 1.5× target because the final tree
  is sent whole. Plan 046's gate measures its own loop.
