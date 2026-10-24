import type { Intent } from "@arnilo/liveframe";
import { flushSync } from "react-dom";
import { hydrateRoot } from "react-dom/client";
import type { Snapshot } from "./pages.ts";
import { ProofSurface } from "./view.tsx";

const container = document.getElementById("app");
const bootstrap = document.getElementById("bootstrap");
if (!container || !bootstrap) throw new Error("Missing proof host bootstrap");
let snapshot = JSON.parse(bootstrap.textContent ?? "null") as Snapshot;
let pending = Promise.resolve();
let designSystem = container.dataset.designSystem as "certified" | "rack";
const draw = () => <ProofSurface snapshot={snapshot} onIntent={onIntent} designSystem={designSystem} />;
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
      snapshot = { ...result, manifest: snapshot.manifest };
      root.render(draw());
      if (log) log.textContent = JSON.stringify(snapshot.actions, null, 2);
      if (status) status.textContent = "";
    })
    .catch((error: unknown) => {
      if (status) status.textContent = error instanceof Error ? error.message : String(error);
    });
};
const root = hydrateRoot(container, draw());
const switcher = document.getElementById("design-system");
const sheets = Array.from(document.querySelectorAll<HTMLLinkElement>("link[data-design-system]"));
await Promise.all(
  sheets.map((sheet) =>
    sheet.sheet
      ? Promise.resolve()
      : new Promise<void>((resolve, reject) => {
          sheet.addEventListener("load", () => resolve(), { once: true });
          sheet.addEventListener("error", () => reject(new Error(`Failed to load ${sheet.href}`)), { once: true });
        }),
  ),
);
if (switcher instanceof HTMLSelectElement) {
  switcher.addEventListener("change", () => {
    designSystem = switcher.value as "certified" | "rack";
    flushSync(() => root.render(draw()));
  });
  switcher.disabled = false;
}
document.documentElement.dataset.ready = "true";
