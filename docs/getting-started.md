# Getting started

This guide takes you from an empty directory to a widget that is **installed at runtime and drawn in a
browser**, with no deployment between "the server is running" and "the widget is on the page". You will
build a small host (a few hundred lines), install a template widget into it, press its buttons, look at it in
`<Preview>` and, last, run a TSX widget in an isolated runner.

[CI runs this guide.](https://github.com/ashiqrniloy/liveframe/blob/main/scripts/getting-started-test.ts) It extracts every fenced block that names a
`file=` or is tagged `sh`, runs them in a fresh directory against the packed archives and checks the page in
a browser, so the code below is the code that is tested.

You need [Bun](https://bun.sh) 1.4.2 or later. Nothing else is installed globally; Chromium is only needed
if you want to repeat the browser check yourself.

## 1. Install

Make an empty directory and, inside it:

```sh
bun init -y
bun add @arnilo/liveframe @arnilo/liveframe-starter react react-dom react-aria-components
bun add -d @types/react @types/react-dom
```

Add `"DOM"` to `lib` in the `tsconfig.json` that `bun init` wrote, because two files below run in the browser.

`@arnilo/liveframe` is the library: formats, the validator, the host pipeline, the stores and runners. It
ships **no components and no look** (spec §3). `@arnilo/liveframe-starter` is a ready-made catalog of generic
primitives, their React implementations, three themes and a design system, so you can see every piece
working before you write your own. Copy it or replace it; it is not part of the contract.

## 2. Say what the app offers

A host installs a **catalog** (the primitives widgets may use) and **capabilities** (the data sources and
actions widgets may ask for). The starter supplies the catalog. The capabilities are yours: this app offers
one action, `demo.notify`.

```ts file=app.ts
import { type Result, validateCapabilities } from "@arnilo/liveframe";
import { catalog } from "@arnilo/liveframe-starter";

export { catalog };

function valid<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

/** What widgets may ask this app to do. A widget names an action; the app decides whether to run it (law 4). */
export const capabilities = valid(
  validateCapabilities({
    format: "liveframe-capabilities/1",
    sources: {},
    actions: {
      "demo.notify": {
        description: "Log a message on the server.",
        args: {
          type: "object",
          properties: { message: { type: "string", pattern: "^.+$", maxLength: 200 } },
          required: ["message"],
          additionalProperties: false,
        },
      },
    },
  }),
);
```

## 3. Write a widget

A **template widget** is JSON: element nodes plus a small expression language. It needs no sandbox because it
runs no author code, so it is the safest thing to let a user or an agent install. This one greets a name,
counts presses in its own `state` and can ask the host to run `demo.notify`.

The manifest says what the widget may read and write:

```json file=widget/manifest.json
{
  "format": "liveframe-manifest/1",
  "id": "hello",
  "version": "1.0.0",
  "catalogId": "starter.ui@1",
  "params": {
    "type": "object",
    "properties": { "name": { "type": "string", "maxLength": 40 } },
    "required": ["name"],
    "additionalProperties": false
  },
  "state": {
    "type": "object",
    "properties": { "count": { "type": "integer", "minimum": 0, "maximum": 1000000 } },
    "required": ["count"],
    "additionalProperties": false
  },
  "context": { "type": "object", "properties": {}, "required": [], "additionalProperties": false },
  "initialState": { "count": 0 },
  "sources": {},
  "actions": ["demo.notify"]
}
```

The template describes the tree. A button does not run a handler; it describes the intent it offers, and the
host decides what happens:

```json file=widget/template.json
{
  "format": "liveframe-template/1",
  "root": {
    "kind": "stack",
    "props": { "label": "Hello" },
    "style": { "gap": "space.3", "padding": "space.4" },
    "children": [
      { "kind": "heading", "props": { "text": { "$concat": ["Hello, ", { "$path": "params.name" }] }, "level": 2 } },
      { "kind": "text", "props": { "text": { "$concat": ["Pressed ", { "$text": { "$path": "state.count" } }, " times"] } } },
      {
        "kind": "button",
        "key": "press",
        "variant": "primary",
        "props": { "label": "Press" },
        "events": {
          "onPress": { "type": "setState", "key": "count", "value": { "$add": [{ "$path": "state.count" }, 1] } }
        }
      },
      {
        "kind": "button",
        "key": "notify",
        "props": { "label": "Notify" },
        "events": {
          "onPress": {
            "type": "action",
            "name": "demo.notify",
            "args": { "message": { "$concat": ["Hello from ", { "$path": "params.name" }] } }
          }
        }
      }
    ]
  }
}
```

Scenarios are example inputs. Installing the widget renders each one, so a widget that cannot draw is
refused before anyone sees it:

```json file=widget/scenarios.json
[
  { "name": "ada", "params": { "name": "Ada" }, "context": {}, "data": {} },
  { "name": "pressed", "params": { "name": "Grace" }, "state": { "count": 3 }, "context": {}, "data": {} }
]
```

A small helper reads a widget directory into a draft. A directory with a `template.json` is a template widget;
otherwise it holds TSX sources and an entry:

```ts file=widget.ts
import { readdir } from "node:fs/promises";
import { join } from "node:path";

/** Read a widget directory into the draft `pack()` takes: `template.json`, or the sources, plus manifest and scenarios. */
export async function readWidget(dir: string) {
  const manifest = await Bun.file(join(dir, "manifest.json")).json();
  const scenarios = await Bun.file(join(dir, "scenarios.json")).json();
  if (await Bun.file(join(dir, "template.json")).exists()) {
    return { template: await Bun.file(join(dir, "template.json")).json(), manifest, scenarios };
  }
  const files: Record<string, string> = {};
  for (const name of await readdir(dir)) {
    if (/\.tsx?$/.test(name)) files[name] = await Bun.file(join(dir, name)).text();
  }
  return { files, entry: "entry.tsx", manifest, scenarios };
}
```

## 4. Write the host

The host is the part you own. Its job, per request, is fixed by `@arnilo/liveframe/host`: load the
placement, read its data **as the viewer**, run the widget, **validate the tree it returns**, and answer
intents by checking, then authorising, then acting. The library gives you the steps in the right order;
everything it needs from your app is passed in once.

```ts file=server.ts
import { type Intent, type IntentOrigin, type Json } from "@arnilo/liveframe";
import { type Actions, type DispatchResult, handleIntent, renderPlacement, type Served } from "@arnilo/liveframe/host";
import { pack, verifyPackage } from "@arnilo/liveframe/pack";
import { createPreview, templateRunner } from "@arnilo/liveframe/preview";
import { validatePlacement, verifiedPackages } from "@arnilo/liveframe/store";
import { fileStore } from "@arnilo/liveframe/store/fs";
import { styles } from "@arnilo/liveframe-starter";
import { capabilities, catalog } from "./app.ts";
import { readWidget } from "./widget.ts";

// Law 1: the browser gets these bundles and validated trees. Widget code never reaches it.
// Each bundle is built on first request, so the preview page can be added after the server first runs.
const bundle = (entry: string) => {
  let built: Promise<Blob> | undefined;
  return () =>
    (built ??= Bun.build({ entrypoints: [entry], target: "browser" }).then((result) => {
      const [output] = result.outputs;
      if (!result.success || !output) throw new AggregateError(result.logs, `Could not build ${entry}`);
      return output;
    }));
};
const clientJs = bundle("./client.tsx");
const previewJs = bundle("./preview-client.tsx");
const css = Object.values(styles()).join("\n"); // base, primitives, themes, design system: in that order
const page = (script: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
  `<title>Liveframe</title><link rel="stylesheet" href="/styles.css"><style>body{margin:0;padding:1rem}</style></head>` +
  `<body><div id="app"></div><p id="status" role="alert"></p><script type="module" src="${script}"></script></body></html>`;
const html = (body: string) => new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
const script = async (build: () => Promise<Blob>) =>
  new Response(await build(), { headers: { "Content-Type": "text/javascript" } });

// The app's state. The library keeps none: it gets the last frame and the action statuses back on every call.
const store = fileStore(new URL("./.data/", import.meta.url).pathname);
const runner = templateRunner(); // Runs no author code. Section 9 swaps in an isolated runner for TSX widgets.
const served = new Map<string, Served>();
const results = new Map<string, Actions>();
const scope = ""; // The state scope: one viewer here. A multi-user app would use the user id.

/** Whoever the request is for. The library never looks inside it: it hands it to `resolve`, `authorize` and `dispatch`. */
type Viewer = { name: string; may: ReadonlySet<string> };
const viewer: Viewer = { name: "ada", may: new Set(["demo.notify"]) }; // A real app takes this from its session.

/**
 * THE APP'S POLICY (law 4): who may run which action. `handleIntent` has already checked that the tree offered
 * this intent, asks this for every action and `setState`, and treats anything but `true` (a throw too) as a refusal.
 */
const authorize = (intent: Intent, who: Viewer) => intent.type !== "action" || who.may.has(intent.name);

/** The app's operations, run as the viewer after the checks. Add a timeout to anything real. */
async function dispatch(intent: Intent, who: Viewer): Promise<DispatchResult> {
  if (intent.type === "action" && intent.name === "demo.notify") {
    console.log(`demo.notify by ${who.name}: ${String((intent.args as Record<string, Json>).message)}`);
    return { ok: true };
  }
  return { ok: false };
}

// Spread into every call. Nothing here is a service the library starts.
const wiring = {
  store,
  runner,
  installs: { [catalog.catalogId]: { catalog, capabilities } },
  resolve: async () => ({}), // This app has no data sources yet.
  verified: verifiedPackages(),
};

async function surface(id: string) {
  const previous = served.get(id);
  const rendered = await renderPlacement({
    ...wiring,
    placementId: id,
    catalogId: catalog.catalogId,
    scope,
    viewer,
    context: {},
    actions: results.get(id) ?? {},
    ...(previous ? { previous } : { revision: 1 }),
  });
  if (rendered.ok) served.set(id, rendered.value);
  return rendered;
}

/** What goes to the page: the validated tree and the manifest it was made for. */
async function frame(next: Served) {
  const pkg = await store.getPackage(next.package.id, next.package.version);
  return { tree: next.tree, manifest: pkg?.manifest };
}

// A preview session over the same runner, holding the widget draft. It never stores or dispatches anything.
const session = createPreview({ catalog, capabilities, runner });
const drafted = session.update(await readWidget("widget"));
if (!drafted.ok) throw new AggregateError(drafted.errors, "The widget does not pack");
const draft = drafted.value;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const record = (value: unknown): value is Record<string, Json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
/** A browser sends `Origin` on a cross-site POST; refuse it. (Scripts such as install.ts send none.) */
const foreign = (request: Request) => {
  const origin = request.headers.get("origin");
  return origin !== null && origin !== new URL(request.url).origin;
};

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 3410,
  maxRequestBodySize: 1 << 20,
  routes: {
    "/": () => html(page("/client.js")),
    "/preview": () => html(page("/preview-client.js")),
    "/client.js": () => script(clientJs),
    "/preview-client.js": () => script(previewJs),
    "/styles.css": () => new Response(css, { headers: { "Content-Type": "text/css" } }),

    // Install a widget at runtime: pack it (this renders its scenarios), verify it, store it.
    "/widgets": {
      POST: async (request) => {
        if (foreign(request)) return json({ error: "Cross-origin request" }, 403);
        const body: unknown = await request.json().catch(() => undefined);
        if (!record(body)) return json({ error: "Expected a JSON draft" }, 400);
        const packed = pack(body as Parameters<typeof pack>[0], { catalog, capabilities });
        if (!packed.ok) return json({ errors: packed.errors }, 422);
        const verified = verifyPackage(packed.value, { catalog, capabilities });
        if (!verified.ok) return json({ errors: verified.errors }, 422);
        await store.putPackage(verified.value);
        const { id, version } = verified.value.manifest;
        return json({ id, version, hash: verified.value.hash }, 201);
      },
    },

    // Put an installed widget somewhere: a placement names the widget version and its params.
    "/placements/:id": {
      PUT: async (request) => {
        if (foreign(request)) return json({ error: "Cross-origin request" }, 403);
        const body: unknown = await request.json().catch(() => undefined);
        const placement = validatePlacement({ ...(record(body) ? body : {}), id: request.params.id });
        if (!placement.ok) return json({ errors: placement.errors }, 422);
        const pkg = await store.getPackage(placement.value.widget.id, placement.value.widget.version);
        if (!pkg) return json({ error: "Install that widget version first" }, 404);
        await store.putPlacement(placement.value);
        served.delete(request.params.id);
        if ((await store.getState(request.params.id, scope)) === undefined)
          await store.putState(request.params.id, scope, pkg.manifest.initialState);
        return json({ id: request.params.id });
      },
    },

    // Render a placement as the viewer would see it now.
    "/surfaces/:id": async (request) => {
      const rendered = await surface(request.params.id);
      return rendered.ok ? json(await frame(rendered.value)) : json({ error: "Surface unavailable" }, 404);
    },

    // One intent from the page. It is a request: check, authorise, then act, in that order.
    "/placements/:id/intents": {
      POST: async (request) => {
        if (foreign(request)) return json({ error: "Cross-origin request" }, 403);
        const id = request.params.id;
        const current = served.get(id);
        const body: unknown = await request.json().catch(() => undefined);
        if (!current || !record(body) || !record(body.intent) || !record(body.origin))
          return json({ error: "Load the surface, then send { intent, origin }" }, 400);
        const handled = await handleIntent({
          ...wiring,
          served: current,
          origin: body.origin as IntentOrigin,
          intent: body.intent as Intent,
          viewer,
          context: {},
          actions: results.get(id) ?? {},
          authorize,
          dispatch,
        });
        if (!handled.ok) {
          const stale = handled.errors.some((error) => error.kind === "version-conflict");
          return json({ errors: handled.errors }, stale ? 409 : 400);
        }
        served.set(id, handled.value.served);
        results.set(id, handled.value.actions);
        return json(await frame(handled.value.served));
      },
    },

    // Preview: the draft's scenarios, drawn by the page. An action is logged and shown, never run (law 4).
    "/preview/render": async (request) => {
      const scenario = new URL(request.url).searchParams.get("scenario") ?? draft.scenarios[0]?.name ?? "";
      return json({
        result: await session.render({ scenario, preserveState: true }),
        manifest: draft.manifest,
        scenarios: draft.scenarios.map((entry) => entry.name),
        intents: session.intents(),
      });
    },
    "/preview/intent": {
      POST: async (request) => {
        if (foreign(request)) return json({ error: "Cross-origin request" }, 403);
        const body: unknown = await request.json().catch(() => undefined);
        if (!record(body)) return json({ error: "Expected an intent" }, 400);
        const result = await session.intent(body.intent as Intent, body.origin as IntentOrigin);
        return json({ result, intents: session.intents() });
      },
    },
  },
  error(cause) {
    console.error(cause);
    return json({ error: "The host failed to process the request" }, 500);
  },
});

console.log(`Liveframe is running at ${server.url}`);
```

`renderPlacement` and `handleIntent` are the whole pipeline. Nothing in them keeps state between calls: the
`served` map and the `results` map above are the app's, and are handed back as `previous`, `served` and
`actions`. [The host guide](host.md) covers patches, source data, tenancy and the events you can log.

## 5. Draw the tree in the page

The page never runs widget code. It receives a tree, and `<Surface>` validates the whole tree against the
widget's manifest on every arrival (law 2) before drawing it with the starter's React components, styled by
the starter's design system. Intents go back to the server, which re-checks every one.

```tsx file=client.tsx
import { compileValidator, type Intent, type IntentOrigin, type Manifest, type UiTree } from "@arnilo/liveframe";
import { createRenderer } from "@arnilo/liveframe/react";
import { designSystem, implementations, themes } from "@arnilo/liveframe-starter";
import { createRoot } from "react-dom/client";
import { capabilities, catalog } from "./app.ts";

type Frame = { tree: UiTree; manifest: Manifest };

const { Surface } = createRenderer({ catalog, implementations });
const container = document.getElementById("app");
const status = document.getElementById("status");
if (!container) throw new Error("Missing #app");
const root = createRoot(container);
const say = (message: string) => {
  if (status) status.textContent = message;
};
const placement = new URLSearchParams(location.search).get("placement") ?? "hello";
const validators = new Map<string, ReturnType<typeof compileValidator>>();

function validatorFor(manifest: Manifest) {
  const key = `${manifest.id}@${manifest.version}`;
  const known = validators.get(key);
  if (known) return known;
  const compiled = compileValidator({ catalog, capabilities, manifest });
  validators.set(key, compiled);
  return compiled;
}

function draw({ tree, manifest }: Frame) {
  root.render(
    <Surface
      tree={tree}
      validator={validatorFor(manifest)}
      theme={themes[0]}
      designSystem={designSystem}
      onIntent={send}
      fallback={<p>Widget unavailable</p>}
    />,
  );
  say("");
}

async function show(response: Response) {
  const body = (await response.json()) as Frame & { error?: string };
  if (response.ok) draw(body);
  else say(body.error ?? "The host refused that");
}

function send(intent: Intent, origin: IntentOrigin) {
  return fetch(`/placements/${encodeURIComponent(placement)}/intents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent, origin }),
  }).then(show);
}

await show(await fetch(`/surfaces/${encodeURIComponent(placement)}`));
```

## 6. Run it, then install the widget

Start the server. In its own terminal:

```sh server
bun server.ts
```

Open <http://127.0.0.1:3410>. The page says "Surface unavailable": nothing is installed yet. Installing a
widget and placing it are the most privileged things this server does, and it protects them only by listening
on the loopback address and refusing cross-site browser requests. **Who may install or place a widget is your
app's policy**: a real app authenticates the caller and checks that they may, before `POST /widgets` or
`PUT /placements/:id` does anything. Now install the
widget **into the running server** and place it. This script is all an app's admin screen, or an agent's tool,
has to do:

```ts file=install.ts
import { readWidget } from "./widget.ts";

const host = "http://127.0.0.1:3410";
const send = async (method: string, path: string, body: unknown) => {
  const response = await fetch(new URL(path, host), {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log(method, path, response.status, await response.text());
  if (!response.ok) process.exit(1);
};

await send("POST", "/widgets", await readWidget("widget"));
await send("PUT", "/placements/hello", {
  slot: "home.main",
  widget: { id: "hello", version: "1.0.0" },
  params: { name: "Ada" },
});
```

```sh
bun install.ts
```

Reload the page. "Hello, Ada" is on screen, drawn by the starter's own components, and the server was never
restarted. The widget lives in `.data/` (the `fileStore`), so it survives a restart too.

## 7. Press the buttons

**Press** sends a `setState` intent: the host checks the tree really offered it, asks `authorize`, writes the
new `count` with the store, re-renders the template and sends the new tree. The count goes up, and a reload
keeps it. **Notify** sends an `action` intent: the same checks, then your `dispatch` runs as the viewer. Look
at the server's terminal for `demo.notify by ada: Hello from Ada`.

Try to cheat. Remove `demo.notify` from `viewer.may` in `server.ts` and press **Notify** again: the host
refuses it and nothing runs. A forged intent the tree never offered is refused before `authorize` is asked.
The widget has no authority of its own; the app decides (law 4).

## 8. Look at it in `<Preview>`

Authors, and coding agents, need to see a draft before it is installed. `<Preview>` draws every scenario at
several widths, in every theme and design system, from trees the backend produced. Its page needs the same
renderer and a way to ask the session for a scenario:

```tsx file=preview-client.tsx
import { compileValidator, type Intent, type IntentOrigin, type Manifest, type Result, type UiTree } from "@arnilo/liveframe";
import { Preview, type PreviewCell } from "@arnilo/liveframe/preview/react";
import { createRenderer } from "@arnilo/liveframe/react";
import { designSystem, implementations, themes } from "@arnilo/liveframe-starter";
import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { capabilities, catalog } from "./app.ts";

type Snapshot = {
  result: Result<UiTree>;
  manifest: Manifest;
  scenarios: [string, ...string[]];
  intents: readonly Intent[];
};

const renderer = createRenderer({ catalog, implementations });
const container = document.getElementById("app");
if (!container) throw new Error("Missing #app");

async function request(path: string, intent?: { intent: Intent; origin: IntentOrigin }): Promise<Snapshot> {
  const response = await fetch(
    path,
    intent
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(intent) }
      : undefined,
  );
  return response.json();
}

function App({ initial }: { initial: Snapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [rendered, setRendered] = useState(initial.scenarios[0]);
  const selected = useRef(initial.scenarios[0]);
  const validator = compileValidator({ catalog, capabilities, manifest: snapshot.manifest });
  return (
    <Preview
      scenarios={snapshot.scenarios}
      widths={[360, 768]}
      themes={themes}
      designSystems={[designSystem]}
      result={snapshot.result}
      resultScenario={rendered}
      intents={snapshot.intents}
      renderer={renderer}
      validator={validator}
      fallback={<p>Widget unavailable</p>}
      onSelect={async (cell: PreviewCell) => {
        if (cell.scenario === selected.current) return;
        selected.current = cell.scenario;
        const next = await request(`/preview/render?scenario=${encodeURIComponent(cell.scenario)}`);
        if (cell.scenario !== selected.current) return;
        setSnapshot(next);
        setRendered(cell.scenario);
      }}
      onIntent={async (intent, origin) => {
        const next = await request("/preview/intent", { intent, origin });
        setSnapshot((previous) => ({ ...previous, result: next.result, intents: next.intents }));
      }}
    />
  );
}

createRoot(container).render(<App initial={await request("/preview/render")} />);
```

Open <http://127.0.0.1:3410/preview>. Pick the `pressed` scenario, a width or a theme: each cell is the
same validated tree drawn another way. Pressing **Notify** here is logged and shown, never run.
`liveframe preview capture` turns the same page into screenshots an agent can read, and `liveframe mcp` hands
an agent the authoring tools; see [the preview guide](preview.md) and [the agent guide](mcp.md).

## 9. Run TSX widgets you do not trust

Templates cover layout, data and state. When a widget needs real code (a regular expression, `Intl`, a shared
helper), it is TSX, and TSX is code that must not run beside your server's secrets. The reference runners are
not sandboxes ([security model](security.md)). `@arnilo/liveframe-runner-quickjs` is: it runs widget code in
QuickJS (WebAssembly) inside a child process it can kill.

```sh
bun add @arnilo/liveframe-runner-quickjs
bunx liveframe gen node_modules/@arnilo/liveframe-starter/dist/catalog.json --out tsx/ui.gen.ts
```

The second line generates the typed components widget code imports (a package carries its own copy of them).
The widget is the same greeting, written as code:

```tsx file=tsx/entry.tsx
/** @jsxImportSource @arnilo/liveframe/sdk */
import { action, state, type WidgetProps } from "@arnilo/liveframe/sdk";
import { Button, Heading, Stack, Text } from "./ui.gen.ts";

type Params = { name: string };
type State = { count: number };

export default function Hello({ params, state: s }: WidgetProps<Params, State>) {
  return (
    <Stack gap="space.3" padding="space.4">
      <Heading text={`Hello, ${params.name}`} level={2} />
      <Text text={`Pressed ${s.count} times`} />
      <Button key="press" label="Press" variant="primary" onPress={state.set("count", s.count + 1)} />
      <Button key="notify" label="Notify" onPress={action("demo.notify", { message: `Hello from ${params.name}` })} />
    </Stack>
  );
}
```

Pack it and render it through the isolated runner and the in-process runner. Both must give the same tree, and
the host validates what the isolated runner returns before using it:

```ts file=check-tsx.ts
import { pack } from "@arnilo/liveframe/pack";
import { inProcessRunner } from "@arnilo/liveframe/preview";
import { quickjsRunner } from "@arnilo/liveframe-runner-quickjs";
import { capabilities, catalog } from "./app.ts";
import { readWidget } from "./widget.ts";

const base = await readWidget("widget");
const draft = {
  files: {
    "entry.tsx": await Bun.file("tsx/entry.tsx").text(),
    "ui.gen.ts": await Bun.file("tsx/ui.gen.ts").text(),
  },
  entry: "entry.tsx",
  manifest: { ...base.manifest, id: "hello-tsx" },
  scenarios: base.scenarios,
};
const packed = pack(draft, { catalog, capabilities });
if (!packed.ok) throw new Error(JSON.stringify(packed.errors));
const [scenario] = packed.value.scenarios;
if (!scenario) throw new Error("The package has no scenario");

const inputs = {
  params: scenario.params,
  state: packed.value.manifest.initialState,
  data: scenario.data ?? {},
  context: scenario.context ?? {},
};
const options = { catalog, capabilities, surfaceId: "check", revision: 1 };
const isolated = await quickjsRunner({ timeoutMs: 1000 });
try {
  const inside = await isolated.render(packed.value, inputs, options);
  const outside = await inProcessRunner().render(packed.value, inputs, options);
  if (!inside.ok || !outside.ok) throw new Error(JSON.stringify(inside.ok ? outside : inside));
  console.log(JSON.stringify(inside.value) === JSON.stringify(outside.value) ? "trees are identical" : "trees differ");
} finally {
  isolated.close(); // Kills the child process.
}
```

```sh expect="trees are identical"
bun check-tsx.ts
```

To serve TSX widgets, change one line in `server.ts`:

```ts
import { quickjsRunner } from "@arnilo/liveframe-runner-quickjs";
const runner = await quickjsRunner(); // renders templates too, on the host, with no sandbox needed
```

Everything else (`renderPlacement`, `handleIntent`, preview) takes any `Runner`. What QuickJS does and does not
protect against, its limits (`memoryBytes`, `stackBytes`, `timeoutMs`) and the cost of a render are in
[the runner README](https://github.com/ashiqrniloy/liveframe/blob/main/packages/runner-quickjs/README.md) and
[choosing a runner](packages.md#choosing-a-runner).

## Where to go next

- [How a surface is built](model.md): the whole model in one page.
- [The host pipeline](host.md): data sources, patches, tenancy, events.
- [Template widgets](templates.md) and [the SDK](sdk.md): writing widgets.
- [Catalogs, themes and design systems](formats.md) and [styling](styling.md): replace the starter with your own primitives.
- [Conformance](conformance.md): prove your catalog, design system, renderer, store and runner.
- [Security](security.md): what the library protects and what stays yours.
