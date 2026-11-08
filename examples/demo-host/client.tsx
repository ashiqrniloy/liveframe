import type { Intent, IntentOrigin } from "@arnilo/liveframe";
import { applyPatch, type Manifest, type TreePatch, type UiTree } from "@arnilo/liveframe";
import { createRoot, type Root } from "react-dom/client";
import { DemoSurface } from "./view.tsx";

/** One line of the server's answer: a whole tree, or a patch for a client that holds its base. */
type Frame = {
  placement: string;
  manifest?: Manifest;
  tree?: UiTree;
  patch?: TreePatch;
  actions?: readonly unknown[];
  error?: string;
};
type View = { root: Root; tree?: UiTree; manifest?: Manifest };

const app = document.getElementById("app");
const status = document.getElementById("status");
const log = document.getElementById("actions");
if (!app) throw new Error("Missing #app");
// `?placement=list&placement=detail` shows several placements on one page. One draws straight into #app.
const names = new URLSearchParams(location.search).getAll("placement");
const ids = names.length ? names : ["hello"];
const views = new Map<string, View>(
  ids.map((id) => {
    let container = app;
    if (ids.length > 1) {
      app.classList.add("multi");
      container = app.appendChild(document.createElement("div"));
    }
    return [id, { root: createRoot(container) }];
  }),
);

const say = (message: string) => {
  if (status) status.textContent = message;
};
const revisions = () =>
  Object.fromEntries([...views].flatMap(([id, view]) => (view.tree ? [[id, view.tree.revision]] : [])));

function draw(id: string, view: View) {
  if (!view.tree || !view.manifest) return;
  view.root.render(
    <DemoSurface tree={view.tree} manifest={view.manifest} onIntent={(intent, origin) => send(id, intent, origin)} />,
  );
  if ([...views.values()].every((entry) => entry.tree)) document.documentElement.dataset.ready = "true";
}

/** Take a frame. A patch only applies to the tree it was made from; otherwise ask for the whole tree. */
function receive(frame: Frame): Promise<void> | undefined {
  const view = views.get(frame.placement);
  if (!view) return undefined;
  if (frame.error) return void say(frame.error);
  let tree = frame.tree;
  if (!tree) {
    const applied = view.tree && frame.patch ? applyPatch(view.tree, frame.patch) : undefined;
    if (!applied?.ok) return load(frame.placement);
    tree = applied.value;
  }
  // <Surface> validates every arrival against the manifest (law 2), patched or not.
  view.tree = tree;
  if (frame.manifest) view.manifest = frame.manifest;
  if (frame.actions && log) log.textContent = JSON.stringify(frame.actions, null, 2);
  say("");
  draw(frame.placement, view);
  return undefined;
}

async function load(id: string) {
  const response = await fetch(`/surfaces/${encodeURIComponent(id)}`);
  const body = await response.json();
  if (response.ok) await receive(body);
  else say(body.error ?? "Surface unavailable");
}

// Intents are requests: the server re-checks each one before it changes state or runs an action. Its answer is a
// stream of frames, so a claim shows `pending` first and the result when it settles.
let pending = Promise.resolve();
function send(id: string, intent: Intent, origin: IntentOrigin) {
  pending = pending
    .then(async () => {
      const response = await fetch(`/placements/${encodeURIComponent(id)}/intents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, origin, accepted: revisions() }),
      });
      if (!response.ok || !response.body) throw new Error((await response.json()).error ?? "Intent rejected");
      const lines = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffered = "";
      for (let chunk = await lines.read(); !chunk.done; chunk = await lines.read()) {
        const parts = (buffered + chunk.value).split("\n");
        buffered = parts.pop() ?? "";
        for (const line of parts) await receive(JSON.parse(line));
      }
    })
    .catch((cause: unknown) => say(cause instanceof Error ? cause.message : String(cause)));
}

await Promise.all(ids.map(load));
