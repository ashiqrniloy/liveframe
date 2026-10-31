# Task 14.9: actual 48-cell MCP capture

Measured 2026-10-31 with Bun 1.4.4, MCP SDK 2.4.0 and Playwright 1.64.1.
Regenerate from the repository root:

```sh
timeout 240s bun --conditions liveframe:source plans/evidence/021-task-14-9-capture.ts
```

The script starts `liveframe mcp` with the proof host binding and
`maxCaptureCells: 48`, packs the agent-home draft, and calls `capture_preview`.
It asserts the advertised bound, 48 PNGs, structured metadata and no cell errors.
No images are retained. The byte count is the serialized tool result (including
structured metadata), excluding the JSON-RPC envelope.

| Measurement | Task 14.1 core-capture baseline | Actual tool call |
| --- | ---: | ---: |
| Cells | 48 | 48 |
| Wall time | 9341.8 ms | 9756.6 ms |
| PNG bytes | 4845517 | 4854036 |
| JSON bytes including structured metadata | 6581786 | 6593153 |

Axes: four scenarios (`ready`, `host-ready`, `loading`, `empty`) × three widths
(360, 768, 1280) × two themes × two design systems. The negotiated protocol was
`2025-11-25`; its structured metadata is wrapped as `{ result: cells }`.

This single actual tool call took about 0.415 s longer (+4.4%) and returned
11367 more JSON bytes (+0.17%) than the baseline. The baseline measured core
capture and constructed the MCP result shape; this measurement includes the
stdio round trip and real adapter. Screenshot sizes and timings vary, so this
comparison does not isolate adapter overhead or establish a regression budget.
The ceiling bounds cells, not bytes. Tall or dense app pages can exceed a
client's transport limit; hosts may lower the bound and callers may narrow axes.
