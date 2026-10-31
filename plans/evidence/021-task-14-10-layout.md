# Task 14.10: layout cost on the 679-node tree

Measured 2026-10-31 with Bun 1.4.4 and Playwright 1.64.1. Regenerate from the repository root:

```sh
timeout 240s bun --conditions liveframe:source plans/evidence/021-task-14-10-layout.ts
```

The script posts the agent-home draft to the proof host, opens its `ready` scenario and times
`CaptureSession.layout()` on ten consecutive cells at width 360 (the four width-360 cells, cycled).
Each iteration also times the PNG screenshot of the same cell for comparison.

| Measurement | Result |
| --- | ---: |
| Nodes measured per cell | 674 |
| Layout median over 10 cells | 37.6 ms |
| Layout max | 52.1 ms |
| Screenshot median (same cells) | 144.9 ms |

The budget is at most 100 ms added per cell, as a median over ten cells: met. The page holds 674
`data-lf-node` wrappers against the tree's 679 nodes; the difference was not investigated. Timings
vary by machine.
