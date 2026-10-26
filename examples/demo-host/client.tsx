import type { Intent, Manifest, UiTree } from "@arnilo/liveframe";
import { createRoot } from "react-dom/client";
import { DemoSurface } from "./view.tsx";

type Snapshot = { tree: UiTree; manifest: Manifest; actions: readonly Intent[] };

const container = document.getElementById("app");
const status = document.getElementById("status");
const log = document.getElementById("actions");
if (!container) throw new Error("Missing #app");
const placement = encodeURIComponent(new URLSearchParams(location.search).get("placement") ?? "hello");
const root = createRoot(container);

function draw(snapshot: Snapshot) {
  root.render(<DemoSurface tree={snapshot.tree} manifest={snapshot.manifest} onIntent={onIntent} />);
  if (log) log.textContent = JSON.stringify(snapshot.actions, null, 2);
  if (status) status.textContent = "";
  document.documentElement.dataset.ready = "true";
}

// Intents are requests: the server re-checks each one before it changes state or runs an action.
let pending = Promise.resolve();
function onIntent(intent: Intent) {
  pending = pending
    .then(async () => {
      const response = await fetch(`/placements/${placement}/intents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Intent rejected");
      draw(result);
    })
    .catch((error: unknown) => {
      if (status) status.textContent = error instanceof Error ? error.message : String(error);
    });
}

const response = await fetch(`/surfaces/${placement}`);
const body = await response.json();
if (response.ok) draw(body);
else if (status) status.textContent = body.error ?? "Surface unavailable";
