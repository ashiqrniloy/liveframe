# Plan 039 Task 3: agent acceptance with the digest as the only description (design G.8)

A fresh agent (a general-purpose subagent with no inherited conversation and no tools) was given one request and a
digest of the starter catalog. It was asked to answer with element JSON and to list every point where it guessed.
The host rendered its answer with `renderElements` and `streamElements` and filtered it through a surface core.
Result: **pass on the first answer, with no fix.** The document validated, streamed to the same tree, and filtered
locally with no intent. Two of the agent's guesses were gaps in the digest, and the digest now states both.

## What was run

`scripts/agent-acceptance/digest-run.ts` is the operator side:

- `digest --out <dir>` writes `catalog.digest.md` from the starter catalog, the demo host's capabilities
  (`examples/demo-host/capabilities.json`) and `local = { q: string ≤ 80 }`, with `budget: 24000`. It measured
  17,763 characters.
- `check <answer.json> [query]` builds the validator from that catalog and capabilities and from
  `ephemeralManifest({ actions: ["tasks.claim"], local, initialLocal: { q: "" } })`. It renders the answer with
  `renderElements`, streams the same text in 64-character chunks through `streamElements`, and accepts the tree in
  `createSurfaceCore`. It then emits `onChange` on the element whose event is `setLocal`, once with `""` and once
  with `query`, and lists the gated elements that are drawn each time.

**The brief.** The request was for a task list (t1–t4, given titles), a filter box that hides non-matching tasks
without a round trip, a Claim button per task, "No tasks match" when nothing matches, and a heading. The host told
the agent it may use `tasks.claim` and a local key `q`, and has no `setState` keys. The digest was pasted inline.

**One deviation:** to shorten the brief, the operator removed the `style:` lines of the kinds from `select` onward and
the `tasks.digest` source line. The agent used no style prop on those kinds and no source, so the removal did not
affect its answer. The agent's JSON and its list of guesses are local-only under the session scratchpad and were not
committed. This file is the operator's record of them.

## Results

| Check | Outcome |
| --- | --- |
| `renderElements` | ok, 17 nodes (`stack`, `heading`, `textField`, `inline`, `text`, `button`), no errors |
| `streamElements` | 12 intermediate trees, final tree equal to the rendered one |
| Surface core accepts the tree | yes |
| Filter `""` | `t1`–`t4` drawn, `empty` hidden |
| Filter `plan` | `t2` only (case-sensitive: "Plan the team offsite" is hidden) |
| Filter `Fix` | `t3` only |
| Filter `fix`, `zzz` | `empty` ("No tasks match") only |
| Intents raised while filtering | 0 |
| Claim buttons | 4, each `{ "type": "action", "name": "tasks.claim", "args": { "id": "t<n>" } }` |

The agent used every part the brief needed without seeing an example of it: `bind` on `value` with `setLocal` on
`onChange`, `when` with `$contains` over a string literal and `local.q`, and an empty row gated on `shown`, placed
among the rows it counts.

## The agent's guesses, with the operator's disposition

| # | Guess | Disposition |
| --- | --- | --- |
| 1 | Is a bare string valid as `$contains`'s first operand? (The rows are `inline`s with no `text` prop, so `self.text` was not available.) | It is. **Fixed:** the digest now says "A string literal is a valid operand." |
| 2 | Is `$contains` case-sensitive? | It is (`String.prototype.includes`). **Fixed:** the digest now says so, and gives the operand order. |
| 3 | Is an empty part always contained? | Yes. **Fixed:** stated in the same line. |
| 4 | Does `shown` count only direct siblings? | Yes; the digest already said "siblings". No action. |
| 5 | Must a bound prop also appear in `props`? | It need not, if optional. The answer included it, which is valid. No action. |
| 6 | Does `setLocal` without `value` take the event's value? | Yes. **Fixed:** the digest's `setLocal` line now says so, as the `setState` line does. |
| 7 | How does the surface show an action's result? | Out of scope for element JSON: the result reaches the host, not the document. No action. |
| 8 | Which button labels are preferred? | A content choice. No action. |

## Reproduce

```sh
bun --conditions liveframe:source scripts/agent-acceptance/digest-run.ts digest --out <dir>
# give <dir>/catalog.digest.md and the brief above to an agent; save its JSON as <dir>/answer.json
bun --conditions liveframe:source scripts/agent-acceptance/digest-run.ts check <dir>/answer.json plan
```

Compromises: as in plan 032's run, the agent was a subagent of this session and shares a model family with the
digest's author. The filter was proved through the surface core (`emit` on the field's `onChange`), not by typing
into a browser. The browser proof of local filtering is the renderer conformance case
`set_local_redraws_and_never_reaches_the_host`.

## Rerun at plan end (Task 7, 2026-11-20)

The run was repeated on the finished tree, with the content kinds in the brief. A fresh general-purpose subagent was told to read only the digest file and to use no other tool, and used one `Read` call. This differs from Task 3's run, where the digest was pasted into the brief and the agent had no tools. The digest was the full 23,269 characters (starter, the demo capabilities, `local.q`), with no line removed.

**The brief.** A weekly team report: a heading; formatted text with a bold phrase and an `https` link; a bar chart of two series over Monday to Friday with a summary; a table of three tasks with a header row and the title as a row header; a filter box above the table that hides rows whose title does not contain the typed text, with no round trip; and a Claim button on each open task's row.

**Result: pass on the first answer, with no fix.** `bun scripts/agent-acceptance/digest-run.ts check <answer> Plan`:

| Check | Outcome |
| --- | --- |
| `renderElements` | ok, 41 nodes: `stack`, `heading`, `richText`, `chart`, `textField`, `table`, `tableRow`, `tableCell`, `text`, `button` |
| `streamElements` | 22 intermediate trees, final tree equal to the rendered one |
| Surface core accepts the tree | yes |
| Filter `""` | `t1`, `t2`, `t3` drawn |
| Filter `Plan` | `t2` only |
| Intents raised while filtering | 0 |
| Claim buttons | 2 (open tasks only), each an action intent for `tasks.claim` |

The agent used `richText` with `**…**` and a link, `chart` with `type`, `labels` and `series`, a `table` with `header: "column"` and `header: "row"` cells, `bind` on the field's `value` with `setLocal` on `onChange`, and a `when` with `$contains` over a string literal and `local.q` on each `tableRow`.

**The agent's twelve guesses**, with the operator's disposition:

| # | Guess | Disposition |
| --- | --- | --- |
| 1 | `tableRow` has no props, so a row's title is a literal in its `when`. Is that the pattern? | It is the only one, since a row has no text. No action. |
| 2 | `$contains` is case-sensitive; there is no case-insensitive form | True. Backlogged (F7 of plan 039's impact analysis). |
| 3 | Is `when` allowed on `tableRow`? | Yes: the digest says every element may carry `when`. No action. |
| 4 | A fourth Claim column needs a header the request did not give | A content choice. No action. |
| 5 | May a `tableCell` have no `children`? | Yes (the answer validated). No action. |
| 6 | Is `bind` on `value` needed beside `setLocal`? | It keeps the box in step with `local.q`; harmless. No action. |
| 7 | Does `local.q` read as `""` before typing? | Yes, `initialLocal` is `{ q: "" }`, and the digest says so. No action. |
| 8 | Keys may repeat among different parents | They need to be unique only among siblings, as the digest says. No action. |
| 9 | Showing the claim result | Out of scope for element JSON, as in Task 3. No action. |
| 10 | Does `richText` count as the "link" and bold the request asked for? | A content choice; the `link` kind cannot sit inside a paragraph. No action. |
| 11, 12 | Wording and the page root's `semantics` and style values | Content choices. No action. |

The digest needed no change. The one finding is that the digest is 97% of its budget (F3).

