# Author, preview and install a widget in the demo host

This is the handoff for an agent given a running demo host and its
`examples/demo-host/mcp.config.ts`. The demo is an app in the public
[repository](https://github.com/ashiqrniloy/liveframe/tree/main/examples/demo-host),
provided by the host operator; its code is not part of the npm archive.
The steps below run from `examples/demo-host/`, with its dependencies installed
and its server running at `http://127.0.0.1:3300`.

The demo uses the reference worker runner with process permissions. Only run
trusted drafts; see the [security model](security.md). No step here dispatches
an action.

## Author through MCP

Register `liveframe mcp` with your coding agent as described in the
[MCP guide](mcp.md), using this installed binary and config:

```sh
./node_modules/.bin/liveframe mcp ./mcp.config.ts
```

The config supplies the host's shared library (`widgets/cards`, `acme.cards@1.0.0`) to every
draft. Call `list_libraries` to see its id, version, exports and import specifier; a draft imports
it as `import { TaskCard } from "liveframe:lib/acme.cards@1.0.0"` and the agent cannot add another
library (see [the MCP guide](mcp.md#libraries)). A draft that imports a library the host did not
supply fails `pack_draft` with `not-found`.

Use `list_vocabulary` for the manifest's catalog id and allowed style names,
`list_primitives` for props and `generated_types` for `ui.gen.ts`. Write a
widget with a default export and at least two scenarios. The
[SDK guide](sdk.md) explains TSX and keys; the [package guide](packages.md)
defines manifests, scenarios and draft files.

Save the exact `pack_draft` argument object as `draft.json`:
`{ "files": { "widget.tsx": "...", "ui.gen.ts": "..." }, "entry": "widget.tsx",
"manifest": { ... }, "scenarios": [ ... ] }`. Include generated types as source
text in `files`, rather than a file-system path. Choose a new widget id/version
and declare no actions or sources for this first exercise.

Call `pack_draft`, `render_scenarios`, then
`capture_preview({ "widths": [360] })`. With two scenarios, two themes and two
design systems this captures eight cells, below the twelve-cell tool limit.
Read the errors and images, fix the draft, save the same changes in
`draft.json`, and repeat until all scenarios render and captured cells have no
errors. Record the final `pack_draft` hash.

## Capture the same draft independently with the CLI

The running demo's `http://127.0.0.1:3300/preview` holds its built-in hello
draft. It has no draft-upload route or session-id API. To preview your own
draft, bind the demo's page to a new session using the supplied config's
documented `preview(binding)` function. This starts a separate local preview
server on an available port; it does not modify the running hello preview.

Save this as `capture-draft.ts` beside `mcp.config.ts`:

```ts
import { createPreview } from "@arnilo/liveframe/preview";
import { workerRunner } from "@arnilo/liveframe/preview/worker";
import config from "./mcp.config.ts";

// The demo uses this same runner implementation for production and MCP.
const runner = workerRunner();
let page: { url: string; close(): void | Promise<void> } | undefined;
try {
  const session = createPreview({
    catalog: config.catalog,
    capabilities: config.capabilities,
    runner,
  });
  const packed = session.update(await Bun.file("draft.json").json());
  if (!packed.ok) throw new Error(JSON.stringify(packed.errors));
  if (!config.preview) throw new Error("The host must supply preview(binding)");
  page = await config.preview({ session, package: () => packed.value });
  console.log(JSON.stringify({ hash: packed.value.hash, url: page.url }));
  process.exitCode = await Bun.spawn([
    "./node_modules/.bin/liveframe", "preview", "capture", page.url,
    "--out", "captures", "--width", "360",
  ], { stdout: "inherit", stderr: "inherit" }).exited;
} finally {
  await page?.close();
  runner.close();
}
```

Run `timeout 120s bun capture-draft.ts`. Read `captures/index.json`, its PNGs
and `.aria.yml` files. Correct `draft.json` and rerun until capture exits zero
and all cells are clean. The printed hash must equal the final MCP hash when
both paths receive the same draft. These steps need the optional Playwright
peer and Chromium installed, as described in the [preview guide](preview.md).

## Install and place the final draft

The demo's HTTP API is app-owned, separate from the authoring MCP tools.
`POST /widgets` accepts the **draft object** saved above, not a packed package:

```sh
timeout 10s curl --fail-with-body -sS -X POST http://127.0.0.1:3300/widgets \
  -H 'content-type: application/json' --data-binary @draft.json
```

Success is HTTP 201 with `{ id, version, hash }`. Compare `hash` with both last
preview hashes before placing. Reposting identical content is allowed; changing
content under an installed id/version returns 409, so use a new version.

Replace `my.widget`, `1.0.0` and `params` with your manifest's id, version and
one scenario's params. `my-placement` is a new placement id you choose:

```sh
timeout 10s curl --fail-with-body -sS -X PUT http://127.0.0.1:3300/placements/my-placement \
  -H 'content-type: application/json' \
  -d '{"slot":"home.main","widget":{"id":"my.widget","version":"1.0.0"},"params":{}}'
timeout 10s curl --fail-with-body -sS http://127.0.0.1:3300/surfaces/my-placement
```

Both return HTTP 200. Placement initializes state from the manifest; the surface
response contains `tree`, `manifest` and `actions`. Open
`http://127.0.0.1:3300/?placement=my-placement` to inspect the rendered surface.
A widget that imports a library needs that library installed first: post the library's
draft the same way (`bun install-widget.ts widgets/cards` posts the demo's own), then the
widgets that import it. `POST /widgets` reads the installed library packages it finds in the
draft's `liveframe:lib/…` imports and pins them by hash; a library that is not installed is
HTTP 422 with `not-found`. The library's own surface is its gallery scenarios, so place it only
if you want to see them.

Do not send intents during this exercise unless the operator asks you to; they dispatch actions.
`POST /placements/<id>/intents` takes `{ "intent": …, "origin": { surfaceId, revision, nodeId, event } }`
copied from the tree you just read and answers with a stream of JSON lines (`application/x-ndjson`),
one frame per line: an action first answers with a frame whose `actions` entry for it is `pending`,
then, when the operation finishes, a frame with `ok` (or the failure status), then a frame for each
other placement that reads a source the action changed. A stale origin is HTTP 409; a forged or
unoffered intent is 400. The demo stores the package,
placement and state in its local `fileStore`; restarting the host preserves them.
