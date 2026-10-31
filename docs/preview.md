# Preview widgets before you publish them

Preview lets an author, or a coding agent, see a draft widget exactly as
production will draw it, with no storage, approval or action side effects. To
give a coding agent those steps as MCP tools, see [the agent guide](mcp.md). It has
three parts: a **session** on your backend, a **`<Preview>`** page in your app,
and **capture**, a command that turns every preview cell into files an agent can
read. Start with the [package guide](packages.md) for `pack()`, stores and runners.

**Draft code never reaches the browser (law 1).** The session runs it only
through your `Runner`, on your backend. The page receives validated UI trees.
**Preview never dispatches an action (law 4).** An action is checked, logged and
shown; nothing calls your operations.

**The reference runners are not a sandbox** ([security model](security.md)). Run only trusted drafts with
`inProcessRunner()` or `workerRunner()`. Both return only trees their own
validator accepted, and `workerRunner()` also ignores answers it did not ask
for: one worker serves every package, so a hostile draft can still answer a
later render with a tree that is valid for it. For hostile drafts, plug your
isolated runner into `createPreview`, and use that same runner in production.

## Run a session on the backend

`createPreview({ catalog, capabilities, runner })` is in `@arnilo/liveframe/preview`
and has no host dependencies. The example expects three host-provided values:
installed `catalog` and `capabilities` documents, and a `draft`
(`{ files, entry, manifest, scenarios }`, as in the package guide).

```ts
import type { Result } from "@arnilo/liveframe";
import { createPreview, inProcessRunner } from "@arnilo/liveframe/preview";
import { memoryStore } from "@arnilo/liveframe/store";
import { capabilities, catalog, draft } from "./host.ts";

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

// Use the runner your production backend uses: preview and production must agree.
const session = createPreview({ catalog, capabilities, runner: inProcessRunner() });

const pkg = value(session.update(draft)); // Packs the draft; nothing is stored.
const tree = value(await session.render({ scenario: "ready" })); // Send this tree to the browser.

// A cell's setState re-renders inside the session.
const filtered = value(await session.intent({ type: "setState", key: "filter", value: "tasks" }));

// An action is checked and logged. Preview never dispatches it.
await session.intent({ type: "action", name: "tasks.claim", args: { id: "t1" } });
const log = session.intents();

// Every scenario must render before you publish.
const checks = value(await session.check());
if (checks.some(({ result }) => !result.ok)) throw new Error("A scenario fails");

// Publishing stores exactly the package the session returned.
const store = memoryStore();
await store.putPackage(pkg);

export { filtered, log, pkg, store, tree };
```

- `update(draft)` packs the draft and returns `Result<WidgetPackage>`. A failed
  update keeps the previous package and session state, so the page keeps working
  while the author fixes errors. A successful update resets the selected
  scenario, state and intent log.
- `render({ scenario, context?, state?, preserveState? })` selects a scenario and returns
  `Promise<Result<UiTree>>`. State comes from the argument, then the scenario,
  then the manifest's `initialState`. Errors that belong to a node carry its
  `nodeId`.
  For host snapshots, opt in with `preserveState: true`: the same selected
  scenario retains state/context unless explicitly overridden. The default
  resets them, and switching scenario always uses its normal initial selection.
- `intent(intent, origin?)` takes what a cell emits. A `setState` is checked against the
  manifest's state schema and re-renders. An action is checked against the
  manifest and the capability's argument schema, then logged; the tree is
  returned unchanged. An invalid intent changes nothing. With an origin, the session also checks the current tree with `checkOffered` before changing state or logging an action. Without one, existing schema-only callers keep working.
- `intents()` returns the log. `check()` renders every scenario from its own
  initial state, without touching the current selection.
- Before a successful `update`, calls return `not-found`.

Publishing stores the package `update` returned, so its hash is the hash you
previewed. Tenancy, approval and placement stay yours.

The session passes the package's own scenario objects to the runner, and the
SDK freezes them in place on the first render. Scenario data grants no authority.

## Mount `<Preview>` in your page

`<Preview>` is in `@arnilo/liveframe/preview/react`. Your page owns transport and
selection; the component owns layout. It draws the selected scenario's tree in
every cell of `widths x themes x designSystems`, as sibling surfaces through your
`createRenderer()`. Each cell is as wide as its width, so responsive values follow
the cell, not the window.

```tsx
<Preview
  scenarios={snapshot.scenarios}     // [string, ...string[]]
  widths={[360, 768, 1280]}          // CSS px
  themes={[certified, rack]}         // { id, version }
  designSystems={[certifiedDs, rackDs]}
  result={snapshot.result}           // Result<UiTree> for resultScenario
  resultScenario={snapshot.scenario} // which scenario that result was rendered for
  intents={snapshot.intents}         // the session's log
  renderer={renderer}
  validator={validator}
  fallback={<p>Widget unavailable</p>}
  onSelect={(cell) => { /* fetch only when cell.scenario changes */ }}
  onIntent={(intent, origin) => { /* POST { intent, origin } to session.intent(intent, origin) */ }}
/>
```

Wire the callbacks like this:

- `resultScenario` is required. It labels the `result` you pass; the component
  never guesses. A result for scenario `A` is drawn only while `A` is selected,
  never under another scenario's name, and the retained "last good render" map is
  keyed by it too. Return the scenario name from your render route beside the
  result, as the proof host does.
- `onSelect(cell)` runs on mount and on every selection change in an uncontrolled
  preview; a controlled one calls it only for user selections. Width and style
  changes reuse the tree; fetch a new result only when `cell.scenario` changes.
- Hand `<Preview>` a **new result object** for every completed request, and
  discard responses for scenarios the user has already left.
- `onIntent(intent, origin)` goes to your route for `session.intent(intent, origin)`; put the returned
  result and `session.intents()` into the props.
- If a render fails, errors are listed with `nodeId` and `pointer`. An earlier
  good tree for that scenario is drawn dimmed and labelled "last good render",
  and its matching nodes get `data-lf-error`. Otherwise `fallback` shows.
- The chrome is plain elements with no colour. Your page's styles own its look.

`proof/host/preview.ts` (routes) and `proof/host/preview-client.tsx` (page) are a
complete working example.

## Address a cell by URL

By default the selected cell lives in the query string and is written with
`history.replaceState`: `scenario` (name), `width` (CSS px), `theme` and
`designSystem` (`id@version`). Missing or unknown values select the first entry
of each axis. Other query parameters and the hash are kept, so your own
`session` parameter survives.

Pass `urlKey="left"` to prefix every key with it (`left.scenario`,
`left.width`, ...). Do that whenever the page mounts more than one `<Preview>`:
two uncontrolled previews sharing bare keys would read and overwrite each other.

## Own the selection instead

If your app has its own router, or you keep the selection in memory, pass
`selection` and treat the preview as controlled:

```tsx
const [cell, setCell] = useState<PreviewCell>({ scenario: "ready", width: 360, theme: "certified@1.0.0", designSystem: "certified@1.0.0" });
const [result, setResult] = useState(snapshot.result);
const [rendered, setRendered] = useState(snapshot.scenario);

<Preview {...previewProps} selection={cell} result={result} resultScenario={rendered}
  onSelect={(next) => { setCell(next); setRendered(next.scenario); setResult(await fetchResult(next)); }} />
```

A controlled `<Preview>` neither reads nor writes `location`, so `location.href`
stays exactly as your page set it. `onSelect(cell)` still runs for user
selections, and you feed the new cell back through `selection`; a coordinate your
axes do not declare falls back to the first entry of its axis. Capture cannot
address a controlled preview by URL, so it captures the scenario the page shows
and rejects a request for any other (see below).

## Capture cells for agents

```sh
liveframe preview capture <url> --out <dir> \
  [--scenario a,b] [--width 360,768] [--theme id@v,...] [--design-system id@v,...]
```

The command opens your preview page in headless Chromium, reads the axes that
`<Preview>` publishes in `data-lf-preview`, and captures every declared cell
unless a flag narrows an axis. It loads the page once per scenario and waits for
`data-lf-ready`. For a keyed preview it sets `<urlKey>.scenario`; a controlled
preview ignores the URL, so it captures only the scenario the page shows and
raises `not-found` when a flag asks for another. For each cell it writes `<dir>/<cell>.png` (a screenshot of the
cell) and `<dir>/<cell>.aria.yml` (its accessibility snapshot), then
`<dir>/index.json`:

```json
{ "url": "...", "cells": [{ "scenario": "ready", "width": 360, "theme": "certified@1", "designSystem": "certified@1", "png": "ready_360_certified@1_certified@1.png", "snapshot": "ready_360_certified@1_certified@1.aria.yml", "errors": [] }] }
```

Paths are relative to `<dir>`. `errors` holds the cell's render errors (`kind`,
`pointer`, `message`, and `nodeId` when known), which is how an agent finds and
fixes a mistake. The command exits 0 when every captured cell is clean, 1 when a
cell has errors or capture could not run, and 2 on a usage error. A capture that
could not run says why on stderr: an axis value the page does not declare (and
what it does declare), an unreachable page or one that never became ready, or a
missing Playwright or Chromium with the install command. Inside the library that
failure is a `CaptureError` carrying a `kind`, so `liveframe mcp` maps it to a
typed tool error instead of parsing the message.

Cell filenames come from the coordinates with unsafe characters replaced; if two
cells sanitise to the same name, later ones get a `-2`, `-3` suffix. Read the
paths from `index.json`, not from the coordinates. A coding agent reaches the same
capture through the `capture_preview` tool ([agent guide](mcp.md)).

Call capture directly from a host service:

```ts
import { capture, playwrightBackend } from "@arnilo/liveframe/preview/capture";
import * as playwright from "playwright";

const { index, files } = await capture(url, {
  backend: playwrightBackend(playwright),
  scenarios: ["ready"],
  widths: [360],
  maxCells: 12,
});
// files is a Map<string, Uint8Array>, including index.json; persist or stream it yourself.
```

The library writes nothing and takes no `out`. Importing it does not load
Playwright. Supply any `CaptureBackend<Handle>`: `open(url)` returns a session
with `waitReady(selector)`, `axes()`, `cells()`, `screenshot(handle)`,
`ariaSnapshot(handle)` and `close()`. Cells carry their opaque handle,
coordinates and errors; axes carry `shown` for a controlled preview. Capture
closes each session and calls the optional `backend.close()` even on failure.
Use a backend per call; the Playwright backend reuses one Chromium instance
across that call's scenarios.

Snapshots use Playwright's default `locator.ariaSnapshot()` YAML format
(`playwright ^1.49.0`), kept as opaque text rather than parsed data. A backend
without snapshots returns `null`: the index records `snapshot: null` and the
file map contains no corresponding `.aria.yml`. A screenshot is only as
faithful as the backend's engine; another engine may render differently.

The capture URL must reach a session that holds the draft. Transport and draft
upload routes belong to the host; Liveframe defines no HTTP session API. For
the demo's separate bound preview and exact install/place requests, follow the
[demo agent walkthrough](demo-agent.md). In the repository's proof host only,
`GET /preview` creates a session and returns its id in the page, and
`?session=<id>` selects it. Post the draft to the same session, capture, read
`index.json`, post a fixed draft, and capture again.

### Install the optional Playwright peer

Capture is the only feature that needs Playwright; `liveframe gen` and sessions
work without it. Install it and a browser once:

```sh
bun add -d playwright
bunx playwright install chromium
```

Without Playwright, the command prints these steps and exits 1.

## Upgrading from 0.1.0

`<Preview>` now takes `resultScenario`, which names the scenario the `result`
prop was rendered for. Return that name from your render route beside the result:

```diff
- <Preview result={result} ... />
+ <Preview result={result} resultScenario={rendered} ... />
```

Then, as they apply to your page:

- **Own navigation?** Add `selection` and feed `onSelect(cell)` back, so the
  preview stops reading and writing `location` (controlled mode).
- **More than one preview on the page?** Give each a distinct `urlKey`; bare
  keys are shared today.
- **One uncontrolled preview?** Nothing else changes: the bare `scenario`,
  `width`, `theme` and `designSystem` keys stay the default, so
  `liveframe preview capture` and MCP `capture_preview` need no adjustment.
