import { compileValidator, type Intent, type Manifest, type Result, type UiTree } from "@arnilo/liveframe";
import { Preview, type PreviewCell } from "@arnilo/liveframe/preview/react";
import { createRenderer } from "@arnilo/liveframe/react";
import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { capabilities, catalog, designSystems, themes } from "./app.ts";
import { implementations } from "./primitives/index.tsx";

type Snapshot = {
  result: Result<UiTree>;
  manifest: Manifest;
  scenarios: [string, ...string[]];
  intents: readonly Intent[];
};

const container = document.getElementById("app");
if (!container) throw new Error("Missing #app");
const renderer = createRenderer({ catalog, implementations });
const fallback = <p>Widget unavailable</p>;

async function request(path: string, intent?: Intent) {
  const response = await fetch(
    path,
    intent
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(intent) }
      : undefined,
  );
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Preview request failed");
  return body;
}

function App({ initial }: { initial: Snapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [error, setError] = useState("");
  const scenario = useRef(new URLSearchParams(location.search).get("scenario") ?? initial.scenarios[0]);
  // One request at a time, so a late answer for a scenario the user left cannot overwrite the current one.
  const pending = useRef(Promise.resolve());
  const validator = compileValidator({ catalog, capabilities, manifest: snapshot.manifest });
  const send = (path: string, intent?: Intent) => {
    const selected = scenario.current;
    pending.current = pending.current
      .then(async () => {
        const next = await request(path, intent);
        if (selected !== scenario.current) return;
        setSnapshot((previous) => ({
          ...previous,
          ...(intent ? { result: next.result, intents: next.intents } : next),
        }));
        setError("");
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
  };
  return (
    <>
      <Preview
        scenarios={snapshot.scenarios}
        widths={[360, 768]}
        themes={themes}
        designSystems={designSystems}
        result={snapshot.result}
        intents={snapshot.intents}
        renderer={renderer}
        validator={validator}
        fallback={fallback}
        onSelect={(cell: PreviewCell) => {
          if (cell.scenario === scenario.current) return;
          scenario.current = cell.scenario;
          send(`/preview/render?scenario=${encodeURIComponent(cell.scenario)}`);
        }}
        onIntent={(intent) => send("/preview/intent", intent)}
      />
      <p role="alert">{error}</p>
    </>
  );
}

const first = new URLSearchParams(location.search).get("scenario");
const initial = await request(first ? `/preview/render?scenario=${encodeURIComponent(first)}` : "/preview/render");
createRoot(container).render(<App initial={initial} />);
