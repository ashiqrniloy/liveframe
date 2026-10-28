import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Intent, IntentOrigin, Result, UiTree } from "../../index.ts";
import { Preview } from "../../preview/react/index.ts";
import { identity, renderer, surfaceProps, tree } from "./react-surface.tsx";

const drawing = renderer();
const initial = tree();
const input: UiTree = {
  ...initial,
  root: {
    ...initial.root,
    style: { gap: { base: "space.1", "bp.md": "space.2" } },
    children: (initial.root.children ?? []).map((node, index) =>
      index === 1 ? { ...node, events: { onPress: { type: "setState", key: "reason", value: "committed" } } } : node,
    ),
  },
};
const failure: Result<UiTree> = {
  ok: false,
  errors: [{ kind: "invalid-prop", nodeId: "root/first", pointer: "/root/props/gap", message: "Bad gap" }],
};
function App() {
  const scenario = useRef(new URLSearchParams(window.location.search).get("scenario") ?? "ready");
  const [result, setResult] = useState<Result<UiTree>>({ ok: true, value: input });
  const [origin, setOrigin] = useState<IntentOrigin>();
  const [intents, setIntents] = useState<Intent[]>([]);
  const [rejected, setRejected] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setResult({ ...failure })}>
        Fail render
      </button>
      <button type="button" onClick={() => setResult({ ok: true, value: input })}>
        Recover
      </button>
      <button type="button" onClick={() => setRejected(true)}>
        Reject retained
      </button>
      <output data-origin={JSON.stringify(origin)} />
      <Preview
        {...surfaceProps}
        validator={rejected ? { ...surfaceProps.validator, validateTree: () => failure } : surfaceProps.validator}
        scenarios={["ready", "empty"]}
        widths={[360, 768]}
        themes={[identity, { id: "rack", version: "1.0.0" }]}
        designSystems={[identity]}
        result={result}
        intents={intents}
        renderer={drawing}
        onSelect={(cell) => {
          if (cell.scenario === scenario.current) return;
          scenario.current = cell.scenario;
          setResult(cell.scenario === "empty" ? { ...failure } : { ok: true, value: input });
        }}
        onIntent={(intent, origin) => {
          setIntents([...intents, intent]);
          setOrigin(origin);
        }}
      />
    </>
  );
}
const root = document.getElementById("app");
if (!root) throw new Error("Missing app");
createRoot(root).render(<App />);
