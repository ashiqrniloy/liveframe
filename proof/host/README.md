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
or `no-escalate` to inspect its fixture states. Its default `host-ready` scenario
keeps the approved six-subject parity fixture; `?scenario=ready` selects the
679-node, 50-task benchmark. `/ui/core-queue` has the package scenarios `small`,
`medium`, `large` and `full` for benchmarks, plus `host-small`, `host-medium`,
`host-large` and `host-full` for the paged reference data (defaults to
`host-<size>`). A scenario supplies its context size unless `?size=` overrides
it. It renders a decision metric at small, decision rows at medium, rows
plus a selectable focus card at large, and the grouped queue at full. Its host
placement uses the approved 21rem/36rem/54rem/100% specimen caps. Medium and large
page decisions only.

`/ui/git-status` shows synthetic Clay workspace roots with branch, dirty and
refresh labels and icons. Use `?scenario=empty` for no workspace roots or
`?scenario=benchmark` for 52 label rows.
`/ui/rack-module` shows the agent-info module's rail, header, file tabs, footer
and composer. `?scenario=benchmark` selects its 50-file fixture. Both pages start under Rack. Typing stays local; leave the message
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

The host builds each SDK fixture with `pack()` from the shared drafts in
`src/__tests__/fixtures/widgets/drafts.ts`, then runs it through
`inProcessRunner()` in Bun. A package scenario supplies params, state, data and
context; state falls back to the manifest initial state when omitted. The
browser bundle contains the app primitives and `@arnilo/liveframe/react`, and
receives `{ tree, manifest, actions }`. It compiles an arrival validator from
the installed catalog, capabilities and manifest before mounting `Surface`.
POST `/intent` sends `{ surfaceId, revision, intent }` and returns the same
snapshot shape. Requests must match the current revision and an offered intent.
The host checks state keys and values against the manifest, and action names
and completed arguments against the manifest and capability schemas. A failed rerender leaves the prior state intact.
The client serializes commits to preserve revision order; concurrent state
requests cannot overwrite an already accepted revision. Text fields count
Unicode code points without native `maxlength`: three emoji fit a limit of three.

Fonts are a host asset, not widget or theme data. The host serves the Certified
faces from `proof/references/synapta-core/design-artifacts/fonts/` at `/fonts/…`
and declares their `@font-face` rules; the parity script's reference server
serves the same snapshot so the approved artifact loads its own faces.

The renderer adds the surface typography and, only when the tree uses a
responsive style value, the query container that `@container` breakpoint rules
read, plus a sibling container for scoped overlays. Only the surface gains
`lf_container`, not each parent of a responsive node. A surface without responsive values stays a plain style target, so a
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

`/preview` opens an independent `createPreview()` session using the same
in-process runner and shared package drafts as the reference pages. It starts
with agent-home's `ready` scenario and draws 360, 768 and 1280 px containers
under all four combinations of the Certified/Rack themes and design systems.
Scenario and cell selection are mirrored in the URL. Only scenario changes
request another tree; state intents rerender the session, and actions enter its
log without calling a dispatcher.

The URL gains `session=<id>`. Keep that id when updating or revisiting a draft:

- `POST /preview/draft?session=<id>` accepts `{ files, entry, manifest, scenarios }`
  and returns `{ ok: true, hash }` or the pack errors. Failed updates preserve
  the previous package.
- `GET /preview/render?session=<id>&scenario=ready` returns the result, manifest,
  scenario names and intent log.
- `POST /preview/intent?session=<id>` accepts a completed intent and returns the
  result and intent log.
- `POST /preview/publish?session=<id>` accepts `{}`, stores the last successfully
  packed package in a shared `memoryStore()`, and returns its stored hash.
  Publishing different content at an already stored id/version returns 409.

POSTs require same-origin JSON. The host bounds request bodies at 1 MiB so shared
source drafts fit; the reference `/intent` route keeps its 64 KiB limit.
Reload `/preview?session=<id>&scenario=<name>` after updating a draft to mount
its new manifest and scenarios. Omit `session` for a fresh page/session. The
browser receives rendered data only; source code and packages stay on the
backend. These sessions and published packages last only until host shutdown.
Verify with `timeout 300s bun test proof/tests/preview-browser.test.ts`.
