import {
  compileValidator,
  type Intent,
  type IntentOrigin,
  type Manifest,
  type Result,
  type UiTree,
  validateCapabilities,
} from "@arnilo/liveframe";
import { Preview, type PreviewCell } from "@arnilo/liveframe/preview/react";
import { createRenderer } from "@arnilo/liveframe/react";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import capabilities from "../../src/__tests__/fixtures/widgets/capabilities.json";
import { catalog } from "../css/fixtures.ts";
import { systems, themes } from "../css/sheets.ts";
import { implementations } from "../renderer/primitives/index.tsx";

type Snapshot = {
  session: string;
  manifest: Manifest;
  scenarios: [string, ...string[]];
  result: Result<UiTree>;
  intents: readonly Intent[];
};
const container = document.getElementById("app");
const bootstrap = document.getElementById("bootstrap");
if (!container || !bootstrap) throw new Error("Missing preview bootstrap");
const initial: Snapshot = JSON.parse(bootstrap.textContent ?? "null");
const url = new URL(window.location.href);
url.searchParams.set("session", initial.session);
window.history.replaceState(window.history.state, "", url);
const checked = validateCapabilities(capabilities);
if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
const validator = compileValidator({ catalog, capabilities: checked.value, manifest: initial.manifest });
const renderer = createRenderer({ catalog, implementations });
let scenario = url.searchParams.get("scenario") ?? initial.scenarios[0];
let generation = 0;
let pending = Promise.resolve();
function App() {
  const [snapshot, setSnapshot] = useState(initial);
  const [error, setError] = useState("");
  const request = (path: string, body?: { intent: Intent; origin: IntentOrigin }) => {
    const selected = scenario;
    const current = ++generation;
    pending = pending
      .then(async () => {
        const response = await fetch(
          `/preview/${path}${path.includes("?") ? "&" : "?"}session=${initial.session}`,
          body
            ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
            : undefined,
        );
        const next = await response.json();
        if (!response.ok) throw new Error(next.error ?? "Preview request failed");
        if (current === generation && selected === scenario) {
          setSnapshot((previous) => ({ ...previous, ...next }));
          setError("");
        }
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
  };
  return (
    <>
      <Preview
        scenarios={snapshot.scenarios}
        widths={[360, 768, 1280]}
        themes={[themes.certified, themes.rack]}
        designSystems={[systems.certified, systems.rack]}
        result={snapshot.result}
        intents={snapshot.intents}
        renderer={renderer}
        validator={validator}
        fallback={<p>Widget unavailable</p>}
        onSelect={(cell: PreviewCell) => {
          if (cell.scenario === scenario) return;
          scenario = cell.scenario;
          request(`render?scenario=${encodeURIComponent(scenario)}`);
        }}
        onIntent={(intent, origin) => request("intent", { intent, origin })}
      />
      <p role="alert">{error}</p>
    </>
  );
}
createRoot(container).render(<App />);
