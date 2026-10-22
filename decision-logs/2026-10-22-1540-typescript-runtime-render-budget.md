---
date: 2026-10-22 15:40
status: approved
decision_about: "Whether to move the runtime to a compiled language to meet the render budget"
proposed_by: "agent"
explicitly_approved_by_user: true
---

# Decision: The runtime stays one TypeScript implementation; the render budget is met by removing redundant work

## Decision

Liveframe does not move `render()` or the validator to a compiled language (Rust, WebAssembly or a native addon). Phase 1 and Phase 2 meet the 3 µs-per-node gate by removing work the proof does twice or needlessly. Building and validating become one pass, the validator is compiled per catalog (already roadmap Phase 1), input data is checked once, and the tree's byte size is counted without stringifying it.

## Context

Phase 0 closed as go with one unmet budget: the agent-home selection rerender (679 nodes) costs 5.75 ms against 2 ms, and the owner set Phase 1's gate at ≤ 3 µs per node (`decision-logs/2026-10-22-1519-phase-0-go.md`). The owner asked whether the runtime should be a compiled language instead, since the overrun is CPU-bound.

## Approval

- Proposed by: agent, in answer to the owner's question.
- Approved by user: Yes
- Approval evidence: "Let's go with your recommendation. Update the docs and roadmap accordingly".

## Alternatives Considered

1. **Rust compiled to WebAssembly for the validator, or for the whole render.** Rejected. The widget is TSX running in the host's JavaScript sandbox, so its element tree is born in JavaScript and would have to cross into WASM. Serialising the tree alone costs 0.64 µs per node, about a fifth of the budget, before any check runs. The founding decision already rejected a Rust/WASM core (`decision-logs/2026-10-21-2017-liveframe-founding-model.md`, alternative 2), and spec §13 rules out WebAssembly.
2. **A native addon.** Rejected. It breaks the host-API-free core: the SDK must run unchanged in any JavaScript runtime and any sandbox the host chooses (spec §7.2).
3. **Raise the budget.** Rejected. The owner set the per-node gate, and the measurement below shows that the overrun comes from library overhead, not from inherent cost.

## Rationale and Evidence

Measured 2026-10-22 on the agent-home bench's setup (50 rows, 679 nodes, 1,000 runs after 200 warm-ups, Bun 1.4.2, Linux). Each step was timed separately with a throwaway script that called the proof's own functions:

| Step | Mean | Per node |
| --- | --- | --- |
| Full `render()` | 5.62 ms | 8.3 µs |
| The widget function itself (author TSX, JSX elements) | 0.12 ms | 0.18 µs |
| `assertJson` over all inputs, every render | 0.19 ms | — |
| `validate()` re-walking the finished tree | ≈ 3.2 ms | 4.7 µs |
| The build pass (expansion, prop sorting, ids) | ≈ 2.1 ms | 3.1 µs |
| `JSON.stringify` of the tree (reference) | 0.43 ms | 0.64 µs |

The author's code is about 2% of the cost. The rest is redundant work in `proof/runtime/`:

- `render.ts` classifies and JSON-checks every prop, then `validate.ts` walks the whole tree again with a full `assertJson`.
- `checkTree` stringifies the tree and runs a Unicode regex over it to count bytes.
- `checkSchema` builds `new RegExp(schema.pattern)` on every string and spreads each string into an array to measure it.
- Children are copied with `push(...spread)`, and the catalog `Map` is built twice per render.

None of this would get faster by changing language. Removing it would.

## References

- `proof/runtime/render.ts`, `proof/runtime/validate.ts`, `proof/runtime/data.ts` — the proof's render path.
- `proof/tests/agent-home.bench.ts` — the bench whose setup the split reused. `timeout 120 bun proof/tests/agent-home.bench.ts` reproduces the 5.3–5.75 ms total.
- `proof/REPORT.md` §9 and `proof/GAPS.md` G32 — the recorded overrun.
- `decision-logs/2026-10-22-1519-phase-0-go.md` — the 3 µs-per-node gate.

## Consequences

- Roadmap Phase 1 and Phase 2 name single-pass build-and-validate, check-data-once and byte counting without stringifying as the expected route to the gate. `docs/model.md`'s performance section carries the new split.
- Revisit only if a Phase 1 or Phase 2 bench, after these changes, still misses 3 µs per node, and a profile shows the remaining cost is JavaScript execution rather than avoidable work.
