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
      root.render(<ProofSurface snapshot={snapshot} onIntent={onIntent} portalContainer={container} />);
      if (log) log.textContent = JSON.stringify(snapshot.actions, null, 2);
      if (status) status.textContent = "";
    })
    .catch((error: unknown) => {
      if (status) status.textContent = error instanceof Error ? error.message : String(error);
    });
};
const root = hydrateRoot(
  container,
  <ProofSurface snapshot={snapshot} onIntent={onIntent} portalContainer={container} />,
);
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
    container.setAttribute("data-lf-switching", "");
    container.setAttribute("data-lf-theme", `${switcher.value}@1.0.0`);
    container.setAttribute("data-lf-ds", `${switcher.value}@1.0.0`);
    container.offsetWidth;
    requestAnimationFrame(() => container.removeAttribute("data-lf-switching"));
  });
  switcher.disabled = false;
}
document.documentElement.dataset.ready = "true";
