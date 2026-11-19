import { Profiler, version as reactVersion } from "react";
import { flushSync } from "react-dom";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { catalog as starterCatalog } from "../packages/starter/src/catalog.ts";
import { designSystem as starterDesignSystem } from "../packages/starter/src/design-system.ts";
import { implementations as starterImplementations } from "../packages/starter/src/implementations.tsx";
import { styles as starterStyles } from "../packages/starter/src/styles.ts";
import { themes as starterThemes } from "../packages/starter/src/themes.ts";
import { validator as windowedValidator } from "../packages/starter/src/__tests__/windowed.tsx";
import { renderer, surfaceProps, validator } from "../src/__tests__/fixtures/react-surface.tsx";
import { applyPatch, type UiTree } from "../src/index.ts";
import { createRenderer } from "../src/react/index.ts";
import { shareNodes } from "../src/surface/share.ts";

type Sample = {
  readonly parseMs: number;
  readonly validationMs: number;
  readonly profilerMs: number;
  readonly commitMs: number;
  readonly wallMs: number;
  readonly applyMs: number;
  readonly endToEndMs: number;
  readonly reuseMs: number;
};

type MountSample = {
  readonly renders: number;
  readonly pass1Renders: number;
  readonly pass2Renders: number;
  readonly wallMs: number;
  readonly pass1Ms: number;
  readonly pass2Ms: number;
  readonly validationMs: number;
};

type MountOutcome = {
  readonly createRoot: readonly MountSample[];
  readonly hydrateRoot: readonly MountSample[];
};

type FocusSample = {
  readonly wallMs: number;
  readonly validationMs: number;
  readonly commitMs: number;
};

const production = process.env.NODE_ENV === "production";
const streamContainer = document.createElement("div");
streamContainer.id = "lf-stream";
document.body.append(streamContainer);
let root: Root | undefined = createRoot(streamContainer);
const { Surface } = renderer();

let trackingMount = false;
let mountPass1Count = 0;
let mountPass2Count = 0;
let mountPass2Start = 0;
const { Surface: MountSurface } = renderer((_kind, input) => {
  if (!trackingMount) return;
  if (input.portal === undefined) {
    mountPass1Count++;
  } else {
    if (mountPass2Start === 0) mountPass2Start = performance.now();
    mountPass2Count++;
  }
});

let validationMs = 0;

// `?inline-fallback`: the parent writes `fallback={<p>…</p>}` inline, a new element per render.
const inlineFallback = new URL(location.href).searchParams.has("inline-fallback");
// Production React runs without Profiler instrumentation and never calls onRender,
// so the timed span there is flushSync wall time.
function render(tree: UiTree, onRender?: (duration: number) => void) {
  if (!root) {
    root = createRoot(streamContainer);
  }
  const surface = (
    <Surface
      {...surfaceProps}
      {...(inlineFallback ? { fallback: <p>Unavailable</p> } : {})}
      validator={validator}
      tree={tree}
    />
  );
  flushSync(() =>
    root?.render(
      production ? (
        surface
      ) : (
        <Profiler id="stream" onRender={(_id, _phase, actualDuration) => onRender?.(actualDuration)}>
          {surface}
        </Profiler>
      ),
    ),
  );
}
const validateTree = validator.validateTree;
(validator as { validateTree: typeof validator.validateTree }).validateTree = (tree, options) => {
  const started = performance.now();
  try {
    const result = validateTree(tree, options);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    return result;
  } finally {
    validationMs += performance.now() - started;
  }
};

let previous: UiTree | undefined;
const noneFailed = { has: () => false };

function mount(initial: string | null) {
  previous = initial === null ? undefined : (JSON.parse(initial) as UiTree);
  if (previous) render(previous, () => {});
}

function step(json: string, patchMode: boolean): Sample {
  const parseStarted = performance.now();
  const parsed: unknown = JSON.parse(json);
  const parseMs = performance.now() - parseStarted;
  let tree = parsed as UiTree;
  let applyMs = 0;
  if (patchMode) {
    if (!previous) throw new Error("Missing patch base");
    const applyStarted = performance.now();
    const applied = applyPatch(previous, parsed);
    applyMs = performance.now() - applyStarted;
    if (!applied.ok) throw new Error(JSON.stringify(applied.errors));
    tree = applied.value;
  }
  validationMs = 0;
  // The renderer runs this same pass inside flushSync; timing it here isolates its cost.
  const reuseStarted = performance.now();
  if (previous) shareNodes(previous, tree, noneFailed);
  const reuseMs = performance.now() - reuseStarted;
  let profilerMs: number | undefined;
  const commitStarted = performance.now();
  render(tree, (duration) => {
    profilerMs = duration;
  });
  const wallMs = performance.now() - commitStarted;
  const endToEndMs = performance.now() - parseStarted;
  previous = tree;
  if (!production && patchMode && profilerMs === undefined) {
    throw new Error("Missing development Profiler sample");
  }
  const measured = profilerMs ?? wallMs;
  return {
    parseMs,
    validationMs,
    profilerMs: measured,
    commitMs: Math.max(0, measured - validationMs),
    wallMs,
    applyMs,
    endToEndMs,
    reuseMs,
  };
}

function teardownStream() {
  if (root) {
    flushSync(() => root?.unmount());
    root = undefined;
  }
  streamContainer.remove();
}

const raf = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

async function measureMount(treeJson: string, ssrHtml: string, runs: number, warmup: number): Promise<MountOutcome> {
  teardownStream();
  const tree = JSON.parse(treeJson) as UiTree;
  const createSamples: MountSample[] = [];
  const hydrateSamples: MountSample[] = [];
  const total = warmup + runs;

  for (let i = 0; i < total; i++) {
    // (1) createRoot
    {
      const container = document.createElement("div");
      document.body.append(container);
      const cRoot = createRoot(container);
      mountPass1Count = 0;
      mountPass2Count = 0;
      mountPass2Start = 0;
      validationMs = 0;
      trackingMount = true;
      const started = performance.now();
      flushSync(() => cRoot.render(<MountSurface {...surfaceProps} validator={validator} tree={tree} />));
      const ended = performance.now();
      trackingMount = false;
      const wallMs = ended - started;
      const pass1Ms = mountPass2Count > 0 ? mountPass2Start - started : wallMs;
      const pass2Ms = mountPass2Count > 0 ? ended - mountPass2Start : 0;
      flushSync(() => cRoot.unmount());
      container.remove();
      if (i >= warmup) {
        createSamples.push({
          renders: mountPass1Count + mountPass2Count,
          pass1Renders: mountPass1Count,
          pass2Renders: mountPass2Count,
          wallMs,
          pass1Ms,
          pass2Ms,
          validationMs,
        });
      }
      await raf();
    }

    // (2) hydrateRoot
    {
      const container = document.createElement("div");
      container.innerHTML = ssrHtml;
      document.body.append(container);
      mountPass1Count = 0;
      mountPass2Count = 0;
      mountPass2Start = 0;
      validationMs = 0;
      let hydrationErrors = 0;
      let hRoot: Root | undefined;
      trackingMount = true;
      const started = performance.now();
      flushSync(() => {
        hRoot = hydrateRoot(container, <MountSurface {...surfaceProps} validator={validator} tree={tree} />, {
          onRecoverableError: () => {
            hydrationErrors++;
          },
        });
      });
      const ended = performance.now();
      trackingMount = false;
      if (hydrationErrors > 0) {
        throw new Error(`Hydration produced ${hydrationErrors} recoverable errors`);
      }
      const wallMs = ended - started;
      const pass1Ms = mountPass2Count > 0 ? mountPass2Start - started : wallMs;
      const pass2Ms = mountPass2Count > 0 ? ended - mountPass2Start : 0;
      flushSync(() => hRoot?.unmount());
      container.remove();
      if (i >= warmup) {
        hydrateSamples.push({
          renders: mountPass1Count + mountPass2Count,
          pass1Renders: mountPass1Count,
          pass2Renders: mountPass2Count,
          wallMs,
          pass1Ms,
          pass2Ms,
          validationMs,
        });
      }
      await raf();
    }
  }

  return { createRoot: createSamples, hydrateRoot: hydrateSamples };
}

function hostButtons(count: number): HTMLDivElement {
  const wrapper = document.createElement("div");
  for (let i = 0; i < count; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `Host ${i}`;
    wrapper.append(btn);
  }
  return wrapper;
}

async function measureFocus(
  treesJson: readonly string[],
  hostCount: number,
  focusContinuity: boolean,
  runs: number,
  warmup: number,
): Promise<readonly FocusSample[]> {
  teardownStream();
  const trees = treesJson.map((entry) => JSON.parse(entry) as UiTree);
  const initial = trees[0];
  if (!initial) throw new Error("Missing initial tree for focus scenario");

  const stage = document.createElement("div");
  const before = hostButtons(Math.floor(hostCount / 2));
  const surfaceContainer = document.createElement("div");
  const after = hostButtons(hostCount - Math.floor(hostCount / 2));
  stage.append(before, surfaceContainer, after);
  document.body.append(stage);

  const fRoot = createRoot(surfaceContainer);
  const samples: FocusSample[] = [];
  try {
    flushSync(() =>
      fRoot.render(
        <Surface {...surfaceProps} validator={validator} tree={initial} focusContinuity={focusContinuity} />,
      ),
    );
    await raf();
    const target = surfaceContainer.querySelector<HTMLElement>("button");
    if (!target) throw new Error("Missing focusable button inside surface");
    target.focus();
    if (!surfaceContainer.contains(document.activeElement)) {
      throw new Error("Focus did not enter surface before focus scenario");
    }

    const total = warmup + runs;
    for (let i = 0; i < total; i++) {
      await raf();
      if (!surfaceContainer.contains(document.activeElement)) {
        throw new Error(`Focus left surface before update ${i}`);
      }
      const nextTree = trees[1 + (i % (trees.length - 1))];
      if (!nextTree) throw new Error("Missing update tree");
      validationMs = 0;
      const started = performance.now();
      flushSync(() =>
        fRoot.render(
          <Surface {...surfaceProps} validator={validator} tree={nextTree} focusContinuity={focusContinuity} />,
        ),
      );
      const wallMs = performance.now() - started;
      if (!surfaceContainer.contains(document.activeElement)) {
        throw new Error(`Focus left surface after update ${i}`);
      }
      if (i >= warmup) {
        samples.push({
          wallMs,
          validationMs,
          commitMs: Math.max(0, wallMs - validationMs),
        });
      }
    }
  } finally {
    flushSync(() => fRoot.unmount());
    stage.remove();
  }
  return samples;
}

// The windowed list (plan 038 Task 4) is drawn by the starter, whose `scroll` reserves the undrawn rows' space.
const { Surface: StarterSurface } = createRenderer({
  catalog: starterCatalog,
  implementations: starterImplementations,
});

/**
 * Alternates two windows of the same list, scrolled into the middle, and times each whole-tree commit (arrival
 * validation, reuse and React work, by flushSync wall time).
 */
async function measureWindow(treesJson: readonly string[], runs: number, warmup: number): Promise<readonly number[]> {
  teardownStream();
  const [theme] = starterThemes;
  if (!theme) throw new Error("Missing starter theme");
  const sheet = document.createElement("style");
  sheet.textContent = Object.values(starterStyles()).join("\n");
  document.head.append(sheet);
  const container = document.createElement("div");
  document.body.append(container);
  const wRoot = createRoot(container);
  const trees = treesJson.map((entry) => JSON.parse(entry) as UiTree);
  const draw = (tree: UiTree) =>
    flushSync(() =>
      wRoot.render(
        <StarterSurface
          tree={tree}
          validator={windowedValidator}
          theme={theme}
          designSystem={starterDesignSystem}
          fallback={null}
          onIntent={() => {}}
        />,
      ),
    );
  const samples: number[] = [];
  try {
    const first = trees[0];
    if (!first) throw new Error("Missing window tree");
    draw(first);
    const view = container.querySelector("section");
    const start = (first.root.props.itemStart as number) + 30;
    if (view) view.scrollTop = start * Number.parseFloat(getComputedStyle(view).getPropertyValue("--lf-v-size_row"));
    for (let i = 0; i < warmup + runs; i++) {
      await raf();
      const tree = trees[(i % (trees.length - 1)) + 1];
      if (!tree) throw new Error("Missing window tree");
      const started = performance.now();
      draw(tree);
      if (i >= warmup) samples.push(performance.now() - started);
    }
  } finally {
    flushSync(() => wRoot.unmount());
    container.remove();
    sheet.remove();
  }
  return samples;
}

declare global {
  interface Window {
    streamTest: {
      mount: typeof mount;
      step: typeof step;
      measureMount: typeof measureMount;
      measureFocus: typeof measureFocus;
      measureWindow: typeof measureWindow;
      tree: () => UiTree | undefined;
      reactVersion: string;
      production: boolean;
    };
  }
}
window.streamTest = {
  mount,
  step,
  measureMount,
  measureFocus,
  measureWindow,
  tree: () => previous,
  reactVersion,
  production,
};
