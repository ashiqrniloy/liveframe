# Plan 042 Task 8: agent acceptance on the 0.4.1 paths

The run used `main` at `674fcc2` plus this task's fixtures. `scripts/agent-acceptance/prepare.ts` packed all four
packages and built the host outside the repository. The archives still carry the `0.4.0` manifest version, because
Task 9 owns the version bump. The MCP server used `quickjsRunner()`.

One agent started without inherited conversation. It could read only the installed READMEs, `docs/` and `.d.ts`
files, the prepared host, and `liveframe mcp` through `mcp-session.ts`. It was not given the repository, the compiled
JavaScript or the web. The run took 193 s and 21 tool uses. Its notes, call files, scripts and MCP transcript are
local under `evidence/042-agent-acceptance/agent/`, and the host build log is `evidence/042-agent-acceptance/prepare.log`.

Fixtures, written by `prepare.ts` step 6:

- `stream/session.elements.json` holds `streamLoopDocument(1_000)`, the stream-loop bench's own document: 1,003
  nodes in 55,954 characters.
- `drafts/notes/` is a template widget. Its manifest caps `notes` at 50 items, and its `many` scenario carries 3,000
  notes. `scenarios.json` is 1,393,970 bytes, over the 1 MiB inline bound.

## 1. Streaming loop from the guide

The agent copied the loop in `docs/sdk.md` "Draw agent JSON while it streams" unchanged. It supplied `validator`
(`compileValidator` with `ephemeralManifest` and the host's catalog and capabilities), `now` (`performance.now`),
and an `llm` that yields 4-character chunks and sleeps 4 ms after every 6. Its `send` serialises each update,
applies it to a client copy with `applyPatch`, and checks it with `validateTree`.

| Measure | Result |
| --- | --- |
| Chunks | 13,989 |
| Trees returned by `push` | 1,002 |
| Updates sent | 503: 501 patches and 2 whole trees (the first and the final) |
| Bytes sent | 250,063 |
| Stream duration | 10,520 ms |
| Bound, at one per 16 ms frame plus the first and final updates | ⌈10,520 / 16⌉ + 2 = 660, so 503 is within it |
| Final client root against `renderElements` of the whole text | Equal |

## 2. The inline draft bound

| Call | Result |
| --- | --- |
| `pack_draft` with the fixture inline | `limit-exceeded` at `/scenarios`: "Draft documents exceed 1048576 aggregate bytes" |
| `pack_draft` with `many` cut to the manifest's `maxItems` of 50 notes | Packed `sha256-3a82a9ba…af84c` |
| `render_scenarios` | `few` ok with 4 nodes, and `many` ok with 52 |
| Probe: `pack_draft` with 3,000 notes shortened to 20 characters | `invalid-document` at `/scenarios/1/params/notes`: "Expected an array of at most 50 items" |

The agent ran the probe after the fix. It showed that the byte bound is checked before the draft's schema, so the
first error hid the `maxItems` violation. This is the order the bound needs: it refuses a draft before parsing work
(`authoring.test.ts`, `oversized_inline_draft_is_refused_before_transpile`).

## 3. The template node limit through `$use`

The agent generated components `L0`…`Ln`. Each is a `stack` that uses the next component four times, and the last
level is a `text`.

| Call | Result |
| --- | --- |
| `pack_draft`, first attempt | `invalid-document` at `/scenarios/0/context` and `/scenarios/0/data`, and the same for scenario 1. The agent's scenarios lacked both members. |
| `pack_draft`, 7 levels × 4 (data-free minimum 5,463) | `limit-exceeded` at `/template/root/children/1/$use`: "Expected at most 5000 nodes" |
| `pack_draft`, 6 levels × 4 | Packed `sha256-ea15355c…a510b` |
| `render_scenarios` | Both scenarios ok, 1,367 nodes each |

Both repaired drafts passed through the same `pack_draft` checks as any other draft before they rendered.

## 4. The security checklist

The agent read `docs/security-checklist.md` alone and found that no duty is fully handled by the library. Its answers
match the page. Two duties are "partly" because the library does check one half:

| Duty | Host must implement? | Row text the agent quoted |
| --- | --- | --- |
| Server-side confirmation | Yes | "`handleIntent` cannot tell whether the user confirmed" |
| Idempotency and double submits | Partly. A stale revision is refused. | "Nothing stops the same intent arriving twice for the current revision" |
| CSRF on the intent endpoint | Yes | "Not checked by the library" |
| Keying `Served` and action statuses | Yes | "the library keeps neither" |
| Literal action arguments | Yes | "It does not know whether the viewer may use those values" |
| Image and link hosts | Yes | "Hosts are not checked" |
| Personal data | Partly. `HostEvent`s carry no values. | "Trees and patches carry whatever the widget renders" |

## Law 4

The MCP transcript has 13 calls, all `pack_draft` or `render_scenarios`. No call wrote state, dispatched an action or
captured. The streaming loop ran in the agent's own process, and its element document declares no actions.

## Findings

The owner decides whether each is fixed before the candidate. The recommendation is in the last column.

| # | Finding | Recommendation |
| --- | --- | --- |
| A1 | The streaming snippet uses `validator`, `send`, `now` and `llm` without defining them, and it does not say that an element stream's validator comes from `ephemeralManifest` (the previous section does). | Backlog for plan 046, which rewrites the guide's loop. The 0.4.1 loop worked unchanged once these were supplied. |
| A2 | The guide says `end()` gives "the same result `renderElements` gives the whole text". The roots are equal, but the revision differs, because the stream numbers each tree `revision + 1`, `+ 2`, and so on. | Backlog for plan 046: say "the same tree". |
| A3 | The loop sends the final tree whole, about 26% of the bytes here. After a failure it stops without telling the client. | Backlog for plan 046, whose gate measures patch bytes. The guide already says "After a failure the loop sends nothing more". |
| A4 | The inline-draft `limit-exceeded` names the bound but not the draft's size or the largest document. The 256 KiB `render_scenarios` error does give the size. | Backlog. Adding the size to a message is patch-safe, but no adopter needs it to repair the draft. |
| A5 | The template `limit-exceeded` points to the outer `$use` in the root and does not give the computed minimum (5,463). | Backlog, with A6. |
| A6 | In `docs/templates.md`, the error table's "A `$use` cycle or past a limit" row has no example pointer or message. The guide never shows a `scenarios.json` or says `context` and `data` are required. | Backlog, with A5. The getting-started guide does show a `scenarios.json`. |
| A7 | The installed `package.json` says `0.4.0`. | None: Task 9 bumps the version. |
| A8 | The checklist's proof links name an adopter's request document. | None: plan rule 2 sets absolute links to the request that tracks the gap. |

## Reproduce

```sh
timeout 900 bun scripts/agent-acceptance/prepare.ts --out <empty dir outside the repo>
cd <out>/host
timeout 300 bun mcp-session.ts agent/draft-2.calls.json --out agent/captures --transcript agent/transcript.jsonl
timeout 300 bun mcp-session.ts agent/fanout-3.calls.json --out agent/captures --transcript agent/transcript.jsonl
timeout 120 bun agent/stream-loop.ts
```

The `agent/` files come from `evidence/042-agent-acceptance/agent/`.
