# Let a coding agent write widgets

`liveframe mcp <config-module>` is an [MCP](https://modelcontextprotocol.io) server
over stdio. Point a coding agent at it and the agent can read your catalog, write
a draft widget, render it, and look at screenshots — all without shell access to
your repo, your database or your preview page.

**It authoring only.** The server holds one preview session, so it can pack and
render drafts, but no tool installs, places or approves a widget, resolves real
data or runs an action (law 4). Draft code runs only inside your runner, on your
backend; the browser receives validated trees (law 1). The normative contract for
`liveframe mcp` is spec §13; sessions and pages are described in
[the preview guide](preview.md).

## Install the optional peers

```sh
bun add -d @modelcontextprotocol/server   # the server itself
bunx playwright install chromium          # only for capture_preview
```

Both are optional peers: `liveframe gen` works without either, and so do the
read-only tools. A missing MCP SDK prints how to install it and exits 1.

## Write the config module

The CLI imports the module you name and default-exports an `AuthoringConfig`.
`catalog` and `capabilities` are validated on start — a widget the agent writes
must use them, so they are checked once instead of on every tool call.

```ts
import type { AuthoringConfig } from "@arnilo/liveframe/preview";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import { capabilities, catalog, startApp } from "./host.ts";

const config: AuthoringConfig = {
  catalog,
  capabilities,
  runner: workerRunner(),
  // Your app's own <Preview> page, bound to the server's session. The library ships no page.
  async preview(binding) {
    const app = await startApp(binding);
    return { url: app.url, close: () => app.stop() };
  },
};

export default config;
```

- `catalog` and `capabilities` are the documents your app installs, not a fixture.
- `runner` is the runner production uses. Omit it and the server uses
  `workerRunner()`, which needs the `Worker` global (Bun has it). Preview and
  production must agree, so pass your own if you have one.
- `preview(binding)` is called once, after the first successful `pack_draft`, and
  gets `{ session, package }`: `session` is the preview session, `package()` is
  the draft that last packed. Start your `<Preview>` page there, attach the
  session to it, and return `{ url, close }`. The URL is what `capture_preview`
  opens. `close()` runs on shutdown.

**Neither reference runner is a sandbox.** `inProcessRunner()` and
`workerRunner()` run trusted code on your backend. For untrusted drafts, pass
your own isolated runner as `config.runner` — and use the same one in production.

The config module runs as host code, in the server's process, before any tool is
registered. Log to stderr only: stdout carries the protocol.

## The tools

`tools/list` holds exactly seven tools. Each returns JSON in one text block
(images excepted), and `isError: true` for a rejected call.

| Tool | Arguments | Result |
|---|---|---|
| `list_primitives` | `{ kinds? }` | Every definition in full, or the named kinds |
| `list_vocabulary` | — | Colours, surfaces, typography, tones and the `space`/`radius`/`size`/`bp` names |
| `list_capabilities` | — | Each source's params and result schema and each action's args schema |
| `generated_types` | — | The `liveframe gen` output, byte-identical |
| `pack_draft` | `{ files, entry, manifest, scenarios }` | `{ hash, id, version, scenarios }` |
| `render_scenarios` | `{ scenario?, state?, context? }` | One scenario's tree, or every scenario's status |
| `capture_preview` | `{ scenarios?, widths?, themes?, designSystems? }` | Each cell's coordinates, errors, accessibility snapshot and PNG |

`pack_draft` takes the same input as `session.update()`. A failed pack returns
the errors and keeps the previous package, so the agent can fix a draft without
losing the page it was looking at:

```json
[{ "kind": "catalog-mismatch", "pointer": "/manifest/catalogId", "message": "Catalog does not match" }]
```

`render_scenarios` without a `scenario` renders every scenario and reports each
one's node count; with one, it returns the tree or the errors:

```json
[{ "scenario": "ready", "ok": true, "nodes": 679 }, { "scenario": "empty", "ok": true, "nodes": 10 }]
```

Render errors carry a `pointer` into the tree and often an `expected` string that
names the allowed values, which is usually enough to fix the draft without
another tool call:

```json
{ "kind": "invalid-prop", "pointer": "/root/inline/style/gap", "nodeId": "root/inline",
  "message": "Expected one of: space.0, space.1, space.2, space.3",
  "expected": "one of: space.0, space.1, space.2, space.3" }
```

`capture_preview` captures every declared cell unless an argument narrows an
axis, at most 12 cells per call; more is `limit-exceeded`. The first block lists
the cells, then each cell's accessibility snapshot and its PNG as an image block:

```json
[{ "scenario": "loading", "width": 360, "theme": "certified@1.0.0", "designSystem": "rack@1.0.0", "errors": [] }]
```

Capturing before `pack_draft` is `not-found`, as is a missing Playwright. Laws 1
and 4 hold on this path too: the page gets trees, never draft code, and nothing
is dispatched.

## Register the server

The config module is the argument; the command is `liveframe`. Most clients take
a command and its arguments:

```json
{
  "mcpServers": {
    "liveframe": { "command": "bunx", "args": ["liveframe", "mcp", "./mcp.config.ts"] }
  }
}
```

That is `.mcp.json` for Claude Code, `mcpServers` in a Claude Desktop config, and
the same shape for other clients; consult your client's docs for the file it
reads. Use an absolute path if the client's working directory is not your app's.
The server speaks stdio, so it must be started by the client, once per session.

## Errors and exit codes

A rejected tool call is `isError: true`, in one of two shapes.

A malformed call — an argument of the wrong type, a missing field, an extra
property — is refused before the tool runs, with the schema's own message:

```
Input validation error: Invalid arguments for tool pack_draft: data/manifest/id must match pattern "^[a-z][a-zA-Z0-9.-]*$"
```

Anything past the schema is a JSON array of `LiveframeError`s in one text block
(`kind`, `pointer`, `message`, and `expected`/`nodeId` when known), with JSON
pointers from the document root rather than the tool arguments:

```json
[{ "kind": "undeclared-action", "pointer": "/root/inline/One/events/onPress/name",
   "message": "Expected an action in the manifest: decisions.review",
   "expected": "an action in the manifest: decisions.review", "nodeId": "root/inline/One" }]
```

The kinds you will see: `catalog-mismatch`, `transpile-failed`,
`invalid-document`, `invalid-prop`, `undeclared-action`, `unknown-component`,
`unknown-name`, `not-found`, `limit-exceeded`.

| Exit | When |
|---|---|
| 0 | stdin closed, or `SIGTERM`/`SIGINT` — the config's `preview` is closed first |
| 1 | the MCP SDK is missing (the message says how to install it) or the command line is wrong |
| 2 | the config module failed to load, or `catalog`/`capabilities` failed validation; the errors are on stderr and stdout stays empty |

Stdout carries only protocol messages, so a config that logs there breaks the
connection before the first tool call.
