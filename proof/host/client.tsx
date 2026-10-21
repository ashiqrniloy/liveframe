import { hydrateRoot } from "react-dom/client";
import type { Intent } from "../runtime/types.ts";
import type { Snapshot } from "./state.ts";
import { ProofSurface } from "./view.tsx";

const container = document.getElementById("app");
const bootstrap = document.getElementById("bootstrap");
if (!container || !bootstrap) throw new Error("Missing proof host bootstrap");
let snapshot = JSON.parse(bootstrap.textContent ?? "null") as Snapshot;
let pending = Promise.resolve();
const status = document.getElementById("status");
const log = document.getElementById("actions");
const onIntent = (intent: Intent) => {
  // Inputs can commit and submit together; serialize requests against the latest revision.
  pending = pending
    .then(async () => {
      const response = await fetch("/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surfaceId: snapshot.tree.surfaceId, revision: snapshot.tree.revision, intent }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Intent rejected");
      snapshot = result;
      root.render(<ProofSurface snapshot={snapshot} onIntent={onIntent} />);
      if (log) log.textContent = JSON.stringify(snapshot.actions, null, 2);
      if (status) status.textContent = "";
    })
    .catch((error: unknown) => {
      if (status) status.textContent = error instanceof Error ? error.message : String(error);
    });
};
const root = hydrateRoot(container, <ProofSurface snapshot={snapshot} onIntent={onIntent} />);
const switcher = document.getElementById("design-system");
switcher?.addEventListener("change", () => {
  const sheet = document.getElementById("projection");
  if (sheet instanceof HTMLLinkElement && switcher instanceof HTMLSelectElement)
    sheet.href = `/styles/${switcher.value}.css`;
});
document.documentElement.dataset.ready = "true";
