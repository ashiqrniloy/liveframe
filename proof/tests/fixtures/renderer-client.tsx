import { compileValidator, type Intent, type UiTree, validateCapabilities } from "@arnilo/liveframe";
import { Profiler } from "react";
import { flushSync } from "react-dom";
import { hydrateRoot } from "react-dom/client";
import capabilities from "../../../src/__tests__/fixtures/widgets/capabilities.json";
import type { Snapshot } from "../../host/pages.ts";
import { catalog, Surface, scope, systems, themes } from "./renderer.ts";

declare global {
  interface Window {
    switchSystem: (system: string) => void;
    update: (tree: UiTree) => void;
    intents: Intent[];
    ready: boolean;
    measureSelection: (
      before: Snapshot,
      after: Snapshot,
    ) => { validation: number[]; render: number[]; commit: number[]; synchronous: number };
  }
}
const container = document.getElementById("app");
if (!container) throw new Error("Missing test container");
window.intents = [];
let designSystem: "certified" | "rack" = "certified";
const fallback = <p>Unavailable</p>;
const onIntent = (intent: Intent) => window.intents.push(intent);
const surface = (tree: UiTree) => (
  <Surface
    tree={tree}
    {...scope}
    theme={themes[designSystem]}
    designSystem={systems[designSystem]}
    fallback={fallback}
    onIntent={onIntent}
  />
);
let tree = JSON.parse(document.getElementById("tree")?.textContent ?? "null") as UiTree;
const root = hydrateRoot(container, surface(tree));
window.update = (next) => {
  tree = next;
  flushSync(() => root.render(surface(tree)));
};
window.switchSystem = (system) => {
  designSystem = system as typeof designSystem;
  flushSync(() => root.render(surface(tree)));
};
window.ready = true;

window.measureSelection = (before, after) => {
  const checked = validateCapabilities(capabilities);
  if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
  const compiled = compileValidator({ catalog, capabilities: checked.value, manifest: before.manifest });
  const validation: number[] = [];
  const render: number[] = [];
  const commit: number[] = [];
  const validateTree = compiled.validateTree;
  const validator = Object.assign(compiled, {
    validateTree: (...args: Parameters<typeof compiled.validateTree>) => {
      const start = performance.now();
      const result = validateTree(...args);
      validation.push(performance.now() - start);
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      return result;
    },
  });
  const measured = (snapshot: Snapshot) => (
    <Profiler
      id="selection"
      onRender={(_id, _phase, actualDuration, _base, _startTime, commitTime) => {
        render.push(actualDuration);
        commit.push(performance.now() - commitTime);
      }}
    >
      <Surface
        {...scope}
        validator={validator}
        tree={snapshot.tree}
        theme={themes[designSystem]}
        designSystem={systems[designSystem]}
        fallback={fallback}
        onIntent={onIntent}
      />
    </Profiler>
  );
  flushSync(() => root.render(measured(before)));
  validation.length = render.length = commit.length = 0;
  const start = performance.now();
  flushSync(() => root.render(measured(after)));
  return { validation, render, commit, synchronous: performance.now() - start };
};
