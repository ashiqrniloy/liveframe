# Let a coding agent write widgets

`liveframe mcp <config-module>` is an [MCP](https://modelcontextprotocol.io) server
over stdio. Point a coding agent at it and the agent can read your catalog, write
a draft widget, render it, and look at screenshots — all without shell access to
your repo, your database or your preview page.

**It is authoring only.** The server holds one preview session, so it can pack and
render drafts, but no tool installs, places or approves a widget, resolves real
data or runs an action (law 4). Draft code runs only inside your runner, on your
backend; the browser receives validated trees (law 1). The normative contract for
`liveframe mcp` is spec §13; sessions and pages are described in
[the preview guide](preview.md).

For a running demo host, the [demo agent walkthrough](demo-agent.md) supplies
the CLI preview binding and HTTP install/place steps. MCP tools never perform
those host mutations.

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
- `exposeMeta` (default `false`) shows host `meta` to the agent: capability `meta`
  in `list_capabilities` and the manifest's `meta` in the `pack_draft` result.
  `meta` is the host's annotation, so an agent sees it only when you opt in; the
  manifest `description` is always shown.
- `preview(binding)` is called once, on the first capture (or never, if you never
  capture) — one promise is shared, so concurrent callers cannot bind twice, and a
  binding that fails is retried on the next call. It gets
  `{ session, package }`: `session` is the preview session, `package()` is
  the draft that last packed. Start your `<Preview>` page there, attach the
  session to it, and return `{ url, close }`. The URL is what `capture_preview`
  opens. `close()` runs on shutdown.

**Neither reference runner is a sandbox** ([security model](security.md)). `inProcessRunner()` and
`workerRunner()` run trusted code on your backend. For untrusted drafts, pass
your own isolated runner as `config.runner` — and use the same one in production.
The import ban is syntactic: a draft can still reach the file system, the network
and `Bun.spawn` through what it is allowed to import. When you omit `runner`, the
server says so on stderr once at startup:

```
liveframe mcp: no runner configured, so drafts run in workerRunner() with this process's permissions. Give an untrusted agent an isolated runner (config.runner).
```

`pack_draft`, `render_scenarios` and `capture_preview` run one at a time, in the
order they arrived, because they share the session and the bound page — so a
capture always shows the draft that packed before it, even if another call is
queued behind. The catalog reads stay concurrent.

The config module runs as host code, in the server's process, before any tool is
registered. Log to stderr only: stdout carries the protocol.

## The tools

`tools/list` holds exactly seven tools. Each returns JSON in one text block
(images excepted), and `isError: true` for a rejected call.

| Tool | Arguments | Result |
|---|---|---|
| `list_primitives` | `{ kinds? }` | Every definition in full, or the named kinds |
| `list_vocabulary` | — | `{ catalogId, vocabulary }`: the id a manifest must name, then colours, surfaces, typography, tones and the `space`/`radius`/`size`/`bp` names |
| `list_capabilities` | — | Each source's params and result schema and each action's args schema (capability `meta` only with `exposeMeta`) |
| `generated_types` | — | The typed component module (`liveframe gen` without `--implementations`), byte-identical |
| `pack_draft` | `{ files, entry, manifest, scenarios }` | `{ hash, id, version, description?, scenarios }` (plus `meta` with `exposeMeta`) |
| `render_scenarios` | `{ scenario?, state?, context? }` | One scenario's tree (at most 256 KiB), or every scenario's status and each distinct error once |
| `capture_preview` | `{ scenarios?, widths?, themes?, designSystems? }` | Each cell's coordinates, errors, accessibility snapshot and PNG |

`pack_draft` takes the same input as `session.update()`. A failed pack returns
the errors and keeps the previous package, so the agent can fix a draft without
losing the page it was looking at.

`list_vocabulary` answers with the catalog id as well as the vocabulary, because
a manifest's `catalogId` must match the running catalog exactly and there is no
other way to learn it:

```json
{ "catalogId": "proof.ui@1", "vocabulary": { "space": ["space.0", "space.1"], "radius": ["radius.0"] } }
```

```json
[{ "kind": "catalog-mismatch", "pointer": "/manifest/catalogId", "message": "Catalog does not match" }]
```

`render_scenarios` without a `scenario` renders every scenario and reports each
one's node count; with one, it returns the tree or the errors:

```json
[{ "scenario": "ready", "ok": true, "nodes": 679 }, { "scenario": "empty", "ok": true, "nodes": 10 }]
```

The same error often hits every scenario, so the all-scenarios form reports each
distinct `kind`/`pointer`/`message`/`expected` once and lists the scenarios that share it,
instead of repeating the array per scenario:

```json
[{ "ok": false, "kind": "undeclared-action", "pointer": "/root/inline/One/events/onPress/name",
   "message": "Expected an action in the manifest: decisions.review",
   "expected": "an action in the manifest: decisions.review", "scenarios": ["ready", "empty"] }]
```

One scenario's tree is capped at 256 KiB (262144 bytes of JSON). Past that the
call is `limit-exceeded` at `/scenario`, with the actual size in the message and
the limit in `expected`, rather than a truncated block: split the widget into
smaller ones, or render one scenario at a time.

Render errors carry a `pointer` into the tree and often an `expected` string that
names the allowed values, which is usually enough to fix the draft without
another tool call:

```json
{ "kind": "invalid-prop", "pointer": "/root/inline/style/gap", "nodeId": "root/inline",
  "message": "Expected one of: space.0, space.1, space.2, space.3",
  "expected": "one of: space.0, space.1, space.2, space.3" }
```

`AuthoringConfig.capture?: CaptureBackend` lets a host inject a capture engine
from `@arnilo/liveframe/preview/capture`; omitted, the CLI lazily uses Playwright.
A backend may return no accessibility snapshot; the tool then returns empty
snapshot text alongside its PNG. Captures use the returned bytes directly,
without temporary files. Untagged backend errors become `render-failed`.

`capture_preview` captures every declared cell unless an argument narrows an
axis, at most 12 cells per call. The first block lists the cells, then each
cell's accessibility snapshot and its PNG as an image block:

```json
[{ "scenario": "loading", "width": 360, "theme": "certified@1.0.0", "designSystem": "rack@1.0.0", "errors": [] }]
```

Its failures are typed too, so an agent can tell a typo from a limit:

| Kind | When |
|---|---|
| `unknown-name` | An axis value the page does not declare; the message lists what it does |
| `limit-exceeded` | More than 12 cells; the message names every axis you can narrow |
| `not-found` | Capturing before `pack_draft`, no `preview()` in the config, an unreachable page or one that never became ready, Playwright or Chromium missing (with the install command) |
| `render-failed` | Anything else, such as a file-system failure while writing cells |

Laws 1 and 4 hold on this path too: the page gets trees, never draft code, and
nothing is dispatched.

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

A rejected tool call is `isError: true`, with one shape for every tool: a JSON
array of `LiveframeError`s in one text block (`kind`, `pointer`, `message`, and
`expected`/`nodeId` when known). Pointers are rooted at the document you edit,
not at the tool arguments, so `/manifest/id` is where the fix goes even though
the manifest arrived as an argument:

```json
[{ "kind": "invalid-document", "pointer": "/manifest/id", "message": "Expected a string matching ^[a-z][a-zA-Z0-9.-]*$" }]
```

`pack_draft` and `render_scenarios` declare a permissive top-level object on
purpose — the required keys, a description per argument, and the published
schemas in `$defs` for reference — so that a malformed nested document reaches
the handler and comes back as these errors instead of the MCP layer's bare
string. The cost is that `tools/list` does not machine-validate a draft's
nested fields; read `$defs` for the shapes. Only a missing required key or a
non-object argument still fails before the handler, in the client's own words.

A render or pack failure looks the same:

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
