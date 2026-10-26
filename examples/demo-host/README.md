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

## What it does

| Route | Does |
| --- | --- |
| `POST /widgets` | `pack()`, `verifyPackage()`, then `putPackage()`. A second hash under an installed `(id, version)` is `409`. |
| `PUT /placements/:id` | Checks the widget is installed and the params fit its manifest, then stores the placement and its initial state. |
| `GET /surfaces/:id` | `loadPlacement()`, then renders with `workerRunner()` and returns the tree and manifest. |
| `POST /placements/:id/intents` | Re-renders the current tree and honours an intent only if some node offers it. `setState` must fit the manifest's state schema. `action` must be declared by the manifest, allowed by `capabilities.json` and have valid arguments. Then it dispatches in-process and logs it. |

The page (`client.tsx`) draws the tree with `<Surface>`, which validates every arrival, and sends the
user's intents back. It never runs widget code, and the server never trusts a revision or a tree from
the page (laws 1, 2 and 4). The reference runners are not sandboxes: see the
[security model](../../docs/security.md).

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
- `preview.ts`, `preview.html`, `preview-client.tsx`: the preview routes (shared with `mcp.config.ts`) and page.
- `conformance-host.ts`, `conformance-client.tsx`: the page options and the page entry that calls
  `conformancePage`. Browser fixtures live in `tests/conformance-fixtures.ts`.
- `tests/`: restart persistence, intent re-checks, the initially-open dialog in Chromium, a scan for
  non-public imports, preview capture and the MCP tools, and the conformance kit (`storeSuite` over
  `fileStore`, `catalogSuite`, `designSystemSuite`, `rendererSuite` and `rendererBrowserSuite`). Passing the
  kit does not prove isolation or authorisation.

Chromium for the dialog test: `bunx playwright install chromium chromium-headless-shell`.
