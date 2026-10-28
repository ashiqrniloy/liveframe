import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Intent, IntentOrigin, Result, UiTree } from "../../index.ts";
import { Preview, type PreviewCell } from "../../preview/react/index.ts";
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
const passed = (): Result<UiTree> => ({ ok: true, value: input });
type Identity = { id: string; version: string };
const axes = {
  scenarios: ["ready", "empty"] as [string, ...string[]],
  widths: [360, 768] as [number, ...number[]],
  themes: [identity, { id: "rack", version: "1.0.0" }] as [Identity, ...Identity[]],
  designSystems: [identity] as [Identity, ...Identity[]],
};

/** The host a preview page normally has: a result for the scenario it asked for, and stale answers dropped. */
function App({ urlKey }: { urlKey?: string }) {
  const prefix = urlKey ? `${urlKey}.` : "";
  const scenario = useRef(new URLSearchParams(window.location.search).get(`${prefix}scenario`) ?? "ready");
  const [rendered, setRendered] = useState(scenario.current);
  const [result, setResult] = useState<Result<UiTree>>(scenario.current === "empty" ? { ...failure } : passed());
  const [origin, setOrigin] = useState<IntentOrigin>();
  const [intents, setIntents] = useState<Intent[]>([]);
  const [rejected, setRejected] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setResult({ ...failure })}>
        Fail render
      </button>
      <button type="button" onClick={() => setResult(passed())}>
        Recover
      </button>
      <button type="button" onClick={() => setRejected(true)}>
        Reject retained
      </button>
      <output data-origin={JSON.stringify(origin)} />
      <Preview
        {...surfaceProps}
        validator={rejected ? { ...surfaceProps.validator, validateTree: () => failure } : surfaceProps.validator}
        {...axes}
        {...(urlKey ? { urlKey } : {})}
        result={result}
        resultScenario={rendered}
        intents={intents}
        renderer={drawing}
        onSelect={(cell) => {
          if (cell.scenario === scenario.current) return;
          scenario.current = cell.scenario;
          setRendered(cell.scenario);
          setResult(cell.scenario === "empty" ? { ...failure } : passed());
        }}
        onIntent={(intent, origin) => {
          setIntents([...intents, intent]);
          setOrigin(origin);
        }}
      />
    </>
  );
}

/** A host that keeps the first result while the URL names another scenario. */
function Stale() {
  return (
    <Preview
      {...surfaceProps}
      {...axes}
      result={passed()}
      resultScenario="ready"
      intents={[]}
      renderer={drawing}
      onSelect={() => {}}
      onIntent={() => {}}
    />
  );
}

/** A host with its own router: the preview never touches `location`. */
function Controlled() {
  const [selection, setSelection] = useState<PreviewCell>({
    scenario: "ready",
    width: 360,
    theme: "certified@1.0.0",
    designSystem: "certified@1.0.0",
  });
  const [rendered, setRendered] = useState("ready");
  const [result, setResult] = useState<Result<UiTree>>(passed());
  return (
    <>
      <button
        type="button"
        onClick={() => setSelection({ scenario: "missing", width: 10, theme: "no@1", designSystem: "no@1" })}
      >
        Invalid selection
      </button>
      <Preview
        {...surfaceProps}
        {...axes}
        selection={selection}
        result={result}
        resultScenario={rendered}
        intents={[]}
        renderer={drawing}
        onSelect={(cell) => {
          setSelection(cell);
          setRendered(cell.scenario);
          setResult(cell.scenario === "empty" ? { ...failure } : passed());
        }}
        onIntent={() => {}}
      />
    </>
  );
}

/** Two uncontrolled previews on one page, each on its own URL keys. */
function Two() {
  return (
    <>
      <App urlKey="left" />
      <App urlKey="right" />
    </>
  );
}

const mode = new URLSearchParams(window.location.search).get("mode");
const root = document.getElementById("app");
if (!root) throw new Error("Missing app");
createRoot(root).render(
  mode === "stale" ? (
    <Stale />
  ) : mode === "controlled" ? (
    <Controlled />
  ) : mode === "two" ? (
    <Two />
  ) : mode === "keyed" ? (
    <App urlKey="main" />
  ) : (
    <App />
  ),
);
