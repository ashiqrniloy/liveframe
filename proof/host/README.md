# Local proof host

Run `bun run proof` and open <http://127.0.0.1:3000>. Stop with Ctrl+C.

Each reference link opens a fresh surface with independent state. Add
`?size=small`, `medium`, `large` or `full` to choose the widget context size.
The design-system selector swaps the Certified/Rack stylesheet without a widget
rerun. Action intents appear in the page's log; they never perform operations.

`/ui/agent-home` shows the primitive-composed Synapta queue. Select a subject to
show its card, filter with the tabs, or Load more to advance all three cursor
chains together. Task escalation takes a reason; leave the field or press Enter
to commit it before pressing Escalate. Claims, review, escalation, alert controls
and retry are logged only.

Use `/ui/agent-home?scenario=loading`, `empty`, `failed`, `read-only`, `no-alerts`
or `no-escalate` to inspect its fixture states. `/ui/core-queue` supports the same
scenarios and renders a decision metric at small, decision rows at medium, rows
plus a selectable focus card at large, and the grouped queue at full. Its host
placement uses the approved 21rem/36rem/54rem/100% specimen caps. Medium and large
page decisions only.

`/ui/git-status` shows synthetic Clay workspace roots with branch, dirty and
refresh labels and icons. Use `?scenario=empty` for no workspace roots.
`/ui/rack-module` shows the agent-info module's rail, header, file tabs, footer
and composer. Both pages start under Rack. Typing stays local; leave the message
field to commit the draft before Send. Files / OM / Context tabs rerun the widget;
OM has no source fixture and says so. Close container and Send log declared
actions without closing a container or contacting an agent. Model and effort
are readouts. The design-system page retains the smoke widget until Task 10.
Task 11 owns pixel and DOM parity evidence; known composition differences are
listed in `proof/GAPS.md`.

Widgets run in Bun. The browser bundle contains the compiled renderer and host
client; it receives only validated tree data and render options. POST `/intent`
sends `{ surfaceId, revision, intent }` and returns `{ tree, options, actions }`.
Requests must match the current revision and an offered intent. State and action
arguments are schema checked. A failed rerender leaves the prior state intact.
The client serializes commits to preserve revision order.

This is a localhost-only, trusted in-process proof. Surfaces and logs stay in
memory until shutdown, and reloads create fresh surfaces. There is no sandbox,
persistence, production authentication or real action dispatcher.

Verify with `timeout 300s bun run check`. The host tests include SSR/hydration,
three interaction tiers, dispatch rejection cases, isolated surfaces, stylesheet
switching and the local 50 ms HTTP round-trip budget. Chromium must be installed
with `timeout 120s bunx playwright install chromium`.
Run `timeout 120s bun proof/tests/agent-home.bench.ts` for the real queue's
50-row selection rerender budget (2 ms mean).

Run `timeout 120s bun proof/tests/core-queue.bench.ts` for the actual core queue
at each size (50 rows, 2 ms mean budget).

Run `timeout 120s bun proof/tests/clay.bench.ts` for Clay's git status (52 label
rows) and Rack module (50 files), both against the 2 ms mean budget.
