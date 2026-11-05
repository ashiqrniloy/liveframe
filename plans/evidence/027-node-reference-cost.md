# Plan 027 Task 2 — node reference cost

Regenerate with:

```sh
timeout 180s bun --conditions liveframe:source plans/evidence/027-node-reference-cost.ts
```

## Method

The real 679-node agent-home tree, with 50 text nodes referencing the root.
Both arms carry the same 50 string props on the wire and the same catalog string
schemas. The baseline treats those props as ordinary strings; the reference arm
enables `refProps`, same-tree membership checks, and author-side markers.
This isolates reference machinery from the cost of validating and transporting
50 extra props. Compile/setup are excluded. Rendering uses prebuilt SDK elements
to isolate emission; normal widget input validation/copying remains included.
The whole render benchmark separately covers actual widget execution.

After 300 alternating warmups, measure 15 alternating pairs of 300 calls each.
The gate is the median of the paired ratios (≤2% growth); absolute times below
are independent medians and can drift differently under shared-host load.

## Result (2026-11-06)

Bun 1.4.4; load average 6.24 / 4.75 / 6.55 when started.

| Path | Ordinary strings (ms) | References (ms) | Median paired growth | Gate |
| --- | ---: | ---: | ---: | --- |
| `validateTree` | 0.9179 | 0.9816 | 1.87% | pass |
| `render` | 1.4769 | 1.4946 | 0.56% | pass |

Early attempts exceeded the gate. Validation now captures path segments only
for supplied references and constructs error pointers only on failure. Rendering
defers schema checks only for nodes with supplied references, preserving locality
for nodes without them. The checks, error bounds and exact byte accounting remain
covered by `src/__tests__/node-references.test.tsx`.

This is local shared-host evidence, not a claim of timing precision across machines.

## Repository benchmark gates

The final full check passed: 1,119 tests passed, 4 existing skips, 0 failures.
The first `timeout 300s bun run bench` stopped on core-queue.full validation at
1.523 µs/node (limit 1.5). The unchanged validator rerun passed at 1.493 µs/node.
The render, CSS and streaming benchmark commands then each passed. No threshold
was changed. Agent-home full widget rendering measured 1.4731 ms (2.170 µs/node);
its standalone validation measured 1.0026 ms (1.477 µs/node).
