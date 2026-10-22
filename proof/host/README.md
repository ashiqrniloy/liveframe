# Local proof host

Run `bun run proof` and open <http://127.0.0.1:3000>. Stop with Ctrl+C.

Each reference link opens a fresh surface with independent state. Add
`?size=small`, `medium`, `large` or `full` to choose the widget context size.
The design-system selector activates the already loaded Certified/Rack stylesheet
without a request or widget rerun. It is enabled after both stylesheets load.
Action intents appear in the page's log; they never perform operations.

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
are readouts. `/ui/design-system` uses the unchanged agent-home queue; switch it
and `/ui/git-status` between both systems. `/ui/harness` keeps the synthetic
50-row smoke fixture used by the host protocol tests.
Plan 002 owns the pixel and DOM parity evidence: `timeout 300s bun
proof/scripts/parity.ts --out evidence/parity` captures and diffs the agent-home
queue against the approved artifact at 1440, 1024 and 390 px, and `timeout 60s bun
proof/scripts/inventory.ts --dir evidence/parity` groups that same capture into
causes. `proof/PARITY.md` records the approved result; known composition
differences and gaps are in `proof/GAPS.md`.

`#app` carries the artifact's page gutters: 32 px inline, 16 px below 900 px, so a
queue page's region measures 1376, 960 or 358 px wide as the artifact's does. The
parity script draws its widget region at the artifact's own page origin, not at
the host's, so sub-pixel glyph phases match and the number measures look rather
than antialiasing.

Widgets run in Bun. The browser bundle contains the compiled renderer and host
client; it receives only validated tree data and render options. POST `/intent`
sends `{ surfaceId, revision, intent }` and returns `{ tree, options, actions }`.
Requests must match the current revision and an offered intent. State and action
arguments are schema checked. A failed rerender leaves the prior state intact.
The client serializes commits to preserve revision order.

Fonts are a host asset, not widget or theme data. The host serves the Certified
faces from `proof/references/synapta-core/design-artifacts/fonts/` at `/fonts/…`
and declares their `@font-face` rules; the parity script's reference server
serves the same snapshot so the approved artifact loads its own faces.

The renderer adds the surface typography and, only when the tree uses a
responsive style value, the query container that `@container` breakpoint rules
read. A surface without responsive values stays a plain style target, so a
design-system switch keeps the Plan 001 activation budget.

This is a localhost-only, trusted in-process proof. Surfaces and logs stay in
memory until shutdown, and reloads create fresh surfaces. There is no sandbox,
persistence, production authentication or real action dispatcher.

Verify with `timeout 300s bun run check`. The host tests include SSR/hydration,
three interaction tiers, dispatch rejection cases, isolated surfaces, stylesheet
switching and the local 50 ms HTTP round-trip budget. Chromium must be installed
with `timeout 120s bunx playwright install chromium`.
Run `timeout 120s bun proof/tests/agent-home.bench.ts` for the real queue's
50-row selection rerender budget (2 ms mean). It is currently over that budget at
679 nodes; see `proof/GAPS.md` G32 for the per-node gate this becomes in Phase 1.

Run `timeout 120s bun proof/tests/core-queue.bench.ts` for the actual core queue
at each size (50 rows, 2 ms mean budget).

Run `timeout 120s bun proof/tests/clay.bench.ts` for Clay's git status (52 label
rows) and Rack module (50 files), both against the 2 ms mean budget.

Run `timeout 60s bun test proof/tests/switch.test.ts` for the real queue/Git
switch proof. It checks ten alternating switches per widget, immediate computed
typography through the next animation frame and a 16.67 ms local switch budget,
unchanged node identities/markup/focus/tree, no requests and unchanged widget
source hashes. This proves CSS activation, not reference pixel parity.
