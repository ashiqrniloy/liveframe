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
    ) => Promise<{ validation: number[]; render: number[]; commit: number[]; synchronous: number }>;
    measureSelectionWall: (
      before: Snapshot,
      after: Snapshot,
      rounds?: number,
      focusContinuity?: boolean,
    ) => Promise<{ samples: { validation: number; react: number; wall: number }[]; production: boolean }>;
  }
}
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
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

window.measureSelection = async (before, after) => {
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
  await nextFrame();
  // Layout and paint of the update happen on the next frame, so the trace window
  // opens after the setup render settles and closes after the update's frame.
  performance.mark("lf-recorded-start");
  const start = performance.now();
  flushSync(() => root.render(measured(after)));
  const synchronous = performance.now() - start;
  await nextFrame();
  performance.mark("lf-recorded-end");
  return { validation, render, commit, synchronous };
};

// Production-mode measurement: no Profiler, React work is the flushSync wall span
// net of arrival validation. The transition is repeated so warm samples only count.
window.measureSelectionWall = async (before, after, rounds = 10, focusContinuity) => {
  const checked = validateCapabilities(capabilities);
  if (!checked.ok) throw new Error(JSON.stringify(checked.errors));
  const compiled = compileValidator({ catalog, capabilities: checked.value, manifest: before.manifest });
  const validation: number[] = [];
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
    <Surface
      {...scope}
      validator={validator}
      tree={snapshot.tree}
      theme={themes[designSystem]}
      designSystem={systems[designSystem]}
      fallback={fallback}
      onIntent={onIntent}
      {...(focusContinuity === undefined ? {} : { focusContinuity })}
    />
  );
  flushSync(() => root.render(measured(before)));
  flushSync(() => root.render(measured(after)));
  await nextFrame();
  container.querySelector<HTMLButtonElement>("button")?.focus();
  // Fresh object graphs per round, like whole-tree arrivals; cloning stays outside the timed span.
  const arrivals = Array.from({ length: rounds }, () => structuredClone(after.tree));
  const samples: { validation: number; react: number; wall: number }[] = [];
  performance.mark("lf-recorded-start");
  for (let round = 0; round < rounds; round++) {
    const arrival = arrivals[round];
    if (!arrival) throw new Error("Missing arrival");
    validation.length = 0;
    const start = performance.now();
    flushSync(() => root.render(measured({ ...after, tree: arrival })));
    const wall = performance.now() - start;
    const checkedMs = validation.reduce((sum, value) => sum + value, 0);
    samples.push({ validation: checkedMs, react: Math.max(0, wall - checkedMs), wall });
    await nextFrame();
  }
  performance.mark("lf-recorded-end");
  return { samples, production: process.env.NODE_ENV === "production" };
};
