# Liveframe demo host

A small Bun app that installs, places and persists Liveframe widgets. It is built only on the
installed `@arnilo/liveframe` package and its public subpaths, so it shows an outsider what a host
needs. It owns what the library never ships: a catalog, capabilities, primitives (React
implementations), one theme and one design system.

## Run it

From a checkout, pack the library and run the tests against the archive:

```sh
timeout 900s bun run demo:test        # at the repository root
```

To run the server, install the archive that `demo:test` leaves in `.pack/`, or the registry version
once it is published:

```sh
cd examples/demo-host
bun install
bun run start                         # http://127.0.0.1:3300
bun install-widget.ts widgets/hello   # in another terminal: install the hello widget
curl -X PUT http://127.0.0.1:3300/placements/hello -H 'content-type: application/json' \
  -d '{"slot":"home.main","widget":{"id":"hello","version":"1.0.0"},"params":{"name":"Ada"}}'
```

Open <http://127.0.0.1:3300/?placement=hello>. Press the buttons, then stop and restart the server:
the widget and its state are still there. Records live in `.data/` through `fileStore`.

A **template widget** installs the same way, with no code and no sandbox. `widgets/tasks/` is a
`template.json` that reads the host's `demo.tasks` source and pages through it with `state`:

```sh
bun install-widget.ts widgets/tasks
curl -X PUT http://127.0.0.1:3300/placements/tasks -H 'content-type: application/json' \
  -d '{"slot":"home.main","widget":{"id":"tasks","version":"1.0.0"},"params":{"pageSize":5}}'
```

Open <http://127.0.0.1:3300/?placement=tasks>. See [template widgets](../../docs/templates.md).

**Two placements that coordinate.** `widgets/queue/` is a code widget: a paged task list read from the host's
`tasks.page` source, a local filter, a `Claim` action and a `Select` action. `widgets/detail/` is a template widget that
shows the task `selection.current` names. Place both and open them on one page:

```sh
bun install-widget.ts widgets/queue && bun install-widget.ts widgets/detail
curl -X PUT http://127.0.0.1:3300/placements/list -H 'content-type: application/json' \
  -d '{"slot":"home.main","widget":{"id":"queue","version":"1.0.0"},"params":{"pageSize":5}}'
curl -X PUT http://127.0.0.1:3300/placements/panel -H 'content-type: application/json' \
  -d '{"slot":"home.side","widget":{"id":"detail","version":"1.0.0"},"params":{}}'
```

Open <http://127.0.0.1:3300/?placement=list&placement=panel>. `Select` changes the panel; `Claim` shows
`Claiming…` and then `Claimed by ada`; typing in the filter and pressing Enter hides rows without a request.

## What it does

`server.ts` keeps only transport and what is the app's: the viewer, the data behind each source (`reads`), the
operations behind each action (`dispatcher`), the policy (`authorize`) and where it stores each placement's last
frame. Everything between is `@arnilo/liveframe/host`, which fixes the order of the steps that must not be swapped
([the host pipeline](../../docs/host.md)).

| Route | Does |
| --- | --- |
| `POST /widgets` | `pack()`, `verifyPackage()`, then `putPackage()`. A second hash under an installed `(id, version)` is `409`. |
| `PUT /placements/:id` | Checks the widget is installed and the params fit its manifest, then stores the placement and its initial state. |
| `GET /surfaces/:id` | `renderPlacement()`: load the placement, bind its sources, resolve them as the viewer, skip the run when nothing changed (`renderKey`), run the widget with `workerRunner()`, validate the tree on the host and diff it against the last frame. With `?base=<revision>` a client that holds that revision gets the patch instead of the whole tree. |
| `POST /placements/:id/intents` | `handleIntent()` with `{ intent, origin }`: `checkOffered`, then `authorize`, then persist the state or dispatch the action and record its result. The answer is a stream of JSON lines, one frame each: a claim sends `pending` before the operation finishes and the result after. Then `dependents()` finds the other placements that read a source the action changed, and their fresh frames follow. A stale origin is `409`; a forged or unoffered intent is `400`. |

A frame is `{ placement, revision, manifest, tree | patch, actions }`. The page (`client.tsx`) applies a patch only to
the tree it was made from and fetches the whole tree otherwise, draws every tree with `<Surface>`, which validates each
arrival, and sends the user's intents back with the revisions it holds. It never runs widget code, and the server never
trusts a revision or a tree from the page (laws 1, 2 and 4). The reference runners are not sandboxes: see the
[security model](../../docs/security.md).

What the demo leaves to a real host, as [the host guide](../../docs/host.md) lists: one viewer and one state scope, so
no sessions, tenancy or approval; `authorize` is a placeholder for the app's policy; the claims and the selection live
in memory; mutations run one at a time (the library cannot tell two callers holding the same stale frame apart); and
`dispatch` has no timeout of its own.

## Preview and the agent

`/preview` mounts `<Preview>` over a `createPreview()` session that holds the `hello` draft and renders it
with the same `workerRunner()` as the surfaces. It draws two scenarios at two widths in two themes and two
design systems (the second of each is derived from the first in `app.ts`). The page records intents and
never dispatches them (law 4).

```sh
bunx liveframe preview capture http://127.0.0.1:3300/preview --out captures
bunx liveframe mcp mcp.config.ts      # seven authoring tools over stdio; capture_preview shows the same page
```

`mcp.config.ts` binds the same page (`preview.ts`) to the server's session, so an agent previews through
the tools exactly what `capture` shows. `liveframe mcp` runs drafts with this process's permissions
(see the [security model](../../docs/security.md)). It needs `@modelcontextprotocol/server`, and capture needs
Chromium.

## Files

- `catalog.json`, `capabilities.json`, `theme.json`, `design-system.json`: the app's documents,
  adapted from the proof (eight primitives). `app.ts` validates them once.
- `primitives/`: React implementations and their structural CSS. The dialog waits for the scoped
  portal before it mounts, so a dialog that arrives already open is modal and dismissable.
- `widgets/hello/`: a widget with a composed `ui.gen.ts` (made by `liveframe gen`), a manifest and two
  scenarios, one with its dialog open.
- `widgets/tasks/`: a template widget (`template.json`, a manifest and three scenarios) that pages through the
  `demo.tasks` source with its own state.
- `widgets/queue/`: a code widget with a paged source bound from `state.cursor`, a `tasks.claim` action with a
  `result` schema (read back from `actions`), a `selection.select` action and a local filter (`local`, `when`).
- `widgets/detail/`: a template widget that reads the `selection.current` source, so it follows the list.
- `preview.ts`, `preview.html`, `preview-client.tsx`: the preview routes (shared with `mcp.config.ts`) and page.
- `conformance-host.ts`, `conformance-client.tsx`: the page options and the page entry that calls
  `conformancePage`. Browser fixtures live in `tests/conformance-fixtures.ts`.
- `tests/`: restart persistence, intent re-checks, the orchestration (`orchestration.test.ts`: skipped re-runs,
  patches and the whole-tree fallback, a claim's pending and result frames, coordinated placements, and the local
  filter and selection in Chromium), the initially-open dialog in Chromium, a scan for non-public imports, preview capture and the MCP tools, and the conformance kit (`storeSuite` over
  `fileStore`, `catalogSuite`, `designSystemSuite`, `rendererSuite` and `rendererBrowserSuite`). Passing the
  kit does not prove isolation or authorisation.

Chromium for the dialog test: `bunx playwright install chromium chromium-headless-shell`.
