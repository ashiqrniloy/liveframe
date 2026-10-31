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

## In-process authoring

Use `@arnilo/liveframe/authoring` to call the same operations from a backend service or agent host without MCP or stdio:

```ts
import { createAuthoring } from "@arnilo/liveframe/authoring";

// catalog and capabilities have already passed validateCatalog/validateCapabilities.
// runner, preview and capture are supplied by your host.
const authoring = createAuthoring({ catalog, capabilities, runner, preview, capture });
try {
  const packed = await authoring.packDraft({ files, entry, manifest, scenarios });
  if (!packed.ok) throw new Error(JSON.stringify(packed.errors));
  const checked = await authoring.renderScenarios();
  const captured = await authoring.capturePreview({ widths: [360] });
} finally {
  await authoring.close();
}
```

All eight methods return `Promise<Result<T>>`, with the same errors and bounds as the tools below. Their names are `listPrimitives`, `listVocabulary`, `listCapabilities`, `generatedTypes`, `packDraft`, `renderScenarios`, `setState` and `capturePreview`. A single-scenario render returns a tree of at most 256 KiB; an all-scenario render returns statuses with shared errors deduplicated. Capture returns at most 12 cells, each with `scenario`, `width`, `theme`, `designSystem`, `errors`, `aria: string | null` and `png: Uint8Array`. There are no output files or base64 conversions.

The runner is required and remains owned by your host. This subpath loads neither the MCP SDK nor Playwright. Capture needs both your `preview(binding)` factory and an injected `CaptureBackend`; missing configuration returns `not-found`. The factory starts lazily on the first capture, is reused after success and retried after failure. `close()` waits for queued draft operations and closes the bound page. The four draft methods share one queue; catalog reads stay concurrent. `exposeMeta` defaults to `false`, as in the CLI config.

`renderScenarios({ outcomes: true })` checks all five outcomes of each scenario with one `sourceOutcome` source. Add `scenario` to select a single seed, and optionally `state` or `context` to override its render inputs. Scenarios with no outcome source are checked once; two outcome sources in one scenario return `invalid-document` at `/scenarios/<index>`, so split the seeds. Invalid expansion returns errors before any scenario renders. Expanded renders use the injected runner without changing the page's current selection, state, intents or packed package. With `outcomes: true` the result is always scenario statuses.

These operations grant no store, dispatcher, resolver, installation, placement or approval authority. Keep authoring on your backend; neither reference runner is an isolation boundary.

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
- `draftRoot` optionally allows `pack_draft({ dir, entry? })` to read files from disk.
  It must name an existing directory; relative roots resolve from the server's
  working directory. Startup canonicalizes it and reports `invalid-document` at
  `/draftRoot` with exit 2 if invalid. Omit it to keep inline-only transport.
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

`tools/list` holds exactly eight tools. Each returns JSON in one text block
(images excepted), and `isError: true` for a rejected call.

| Tool | Arguments | Result |
|---|---|---|
| `list_primitives` | `{ kinds? }` | Every definition in full, or the named kinds |
| `list_vocabulary` | — | `{ catalogId, vocabulary }`: the id a manifest must name, then colours, surfaces, typography, tones and the `space`/`radius`/`size`/`bp` names |
| `list_capabilities` | — | Each source's params and result schema and each action's args schema (capability `meta` only with `exposeMeta`) |
| `generated_types` | `{ module? }` | `{ note, types }`: byte-identical `liveframe gen` output for `"types"` (default), `"implementations"` (`--implementations`) or `"elementsSchema"` (`--elements-schema`) |
| `pack_draft` | `{ files, entry, manifest, scenarios }` or `{ dir, entry? }` | `{ hash, id, version, description?, scenarios }` (plus `meta` with `exposeMeta`) |
| `render_scenarios` | `{ scenario?, state?, context?, outcomes? }` | One scenario's tree (at most 256 KiB), or scenario statuses and each distinct error once; `outcomes: true` expands source outcomes and always returns statuses |
| `set_state` | `{ origin: { nodeId, event }, value? }` | Applies an offered state event and returns its new tree (at most 256 KiB); refuses actions |
| `capture_preview` | `{ scenarios?, widths?, themes?, designSystems? }` | Each cell's coordinates, errors, accessibility snapshot and PNG |

Each tool advertises a display title and four behavior hints:

| Tool | Title | readOnlyHint | destructiveHint | idempotentHint | openWorldHint |
| --- | --- | --- | --- | --- | --- |
| `list_primitives` | List primitives | true | false | true | false |
| `list_vocabulary` | List vocabulary | true | false | true | false |
| `list_capabilities` | List capabilities | true | false | true | false |
| `generated_types` | Generate catalog module | true | false | true | false |
| `pack_draft` | Pack draft | false | false | true | false |
| `render_scenarios` | Render scenarios | false | false | true | false |
| `capture_preview` | Capture preview | true | false | true | false |
| `set_state` | Apply offered state event | false | false | false | false |

Annotations never change execution and are not a security boundary. All tools
operate in the configured app's authoring environment (`openWorldHint: false`);
the host's runner and capture backend retain their own authority. Packing replaces
the in-memory draft, and rendering changes the current selection. Idempotence means
repeating the same logical operation without intervening changes, not identical
revisions or screenshot bytes. `set_state` is conservative because rendering may
change the offered event.

`generated_types` keeps the generated content in `types` for every module; its
`note` names the file to save (`ui.gen.ts`, `ui.definitions.gen.ts` or
`elements.schema.json`). Omitting `module` preserves the original response.
An unknown selector returns `invalid-document` at `/module`, with all three
accepted values in `expected`. In-process callers use
`authoring.generatedTypes({ module: "implementations" })`, or omit the argument
for the typed components.

After `render_scenarios({ scenario: "ready" })`, call
`set_state({ origin: { nodeId, event }, value? })` using the node id and event
from that tree. In process, use `authoring.setState()` with the same input.
The server fills the current surface and revision, preserves literal intent
values and otherwise fills the event value, then checks the offered intent.
Unknown nodes/events fail at `/origin/nodeId` or `/origin/event`; invalid values
keep the intent validation error. Missing origin is `invalid-document`; actions
are `invalid-prop` at `/origin/event` and never enter the intent log. With no
current single-scenario render, it returns `not-found` and asks you to call
`render_scenarios` with a scenario first. Checks and outcome expansion preserve
the selection; successful repacking clears it, failed packing retains it.
The operation shares the draft queue and returns one tree capped at 256 KiB.
For page snapshots, call `session.render({ scenario, preserveState: true })`
so the same scenario retains changed state/context through reload and capture.
Explicit overrides win; choosing a different scenario starts from its initial state.

With `draftRoot: "./widgets"` in the CLI config, call:

```json
{ "name": "pack_draft", "arguments": { "dir": "hello", "entry": "entry.tsx" } }
```

`entry` defaults to `entry.tsx`. The reader loads top-level `.ts`/`.tsx` sources,
`manifest.json` and `scenarios.json`, then uses the same inline packer, with the
same hash for the same input. It ignores other files and does not recurse or run
code. It accepts at most 128 source files and 1048576 aggregate bytes including
the JSON documents; this read limit is separate from the packer's emitted-code
limit. Reads stay in arrival order with rendering and capture.

`dir` must be a non-empty relative path without `..` segments. Both the directory
and every selected file must resolve beneath the configured root, so escaping
symlinks are refused. Selected files must be regular files. Do not combine `dir`
with `files`, `manifest` or `scenarios`. Reader errors point to `/dir`:
`invalid-document` for those invalid inputs or malformed JSON, `not-found` for a
missing root configuration, directory, required JSON file or entry, and
`limit-exceeded` for read limits. Once read, document errors retain pointers such
as `/manifest/id`. These directories must be host-controlled: the reader is not
a sandbox against a local process replacing files concurrently. `/authoring`
continues to accept inline drafts only.

`pack_draft` takes the same inline input as `session.update()`. A failed pack returns
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

Set `outcomes: true` to check `ok`, `unauthorized`, `unavailable`, `stale` and
`failed` for each selected scenario's single `sourceOutcome` source. Add
`scenario` to select one seed; the result still contains statuses, never a tree.
Scenarios with no outcome source render once; more than one returns
`invalid-document` at `/scenarios/<index>`. A non-boolean `outcomes` returns
`invalid-document` at `/outcomes`. This matches `renderScenarios({ outcomes: true })`
above and preserves the preview selection and state.

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
purpose — a description per argument and the published
schemas in `$defs` for reference — so that a malformed nested document reaches
the handler and comes back as these errors instead of the MCP layer's bare
string. The cost is that `tools/list` does not machine-validate a draft's
nested fields; read `$defs` for the shapes. Each required `pack_draft` property
says "Required" in its description. Missing keys return `invalid-document` at
`/files`, `/entry`, `/manifest` or `/scenarios`, with every missing key reported.
Omitted arguments behave as an empty object. Non-object `arguments` (null,
arrays, strings or numbers) are protocol errors rejected before the handler.

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
