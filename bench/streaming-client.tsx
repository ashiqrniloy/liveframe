import { Profiler, version as reactVersion } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderer, surfaceProps, validator } from "../src/__tests__/fixtures/react-surface.tsx";
import { applyPatch, type UiTree } from "../src/index.ts";

type Sample = {
  readonly parseMs: number;
  readonly validationMs: number;
  readonly profilerMs: number;
  readonly commitMs: number;
  readonly wallMs: number;
  readonly applyMs: number;
  readonly endToEndMs: number;
};

const production = process.env.NODE_ENV === "production";
const root = createRoot(document.body);
const { Surface } = renderer();
let validationMs = 0;

// Production React runs without Profiler instrumentation and never calls onRender,
// so the timed span there is flushSync wall time.
function render(tree: UiTree, onRender?: (duration: number) => void) {
  flushSync(() =>
    root.render(
      production ? (
        <Surface {...surfaceProps} validator={validator} tree={tree} />
      ) : (
        <Profiler id="stream" onRender={(_id, _phase, actualDuration) => onRender?.(actualDuration)}>
          <Surface {...surfaceProps} validator={validator} tree={tree} />
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
  };
}

declare global {
  interface Window {
    streamTest: {
      mount: typeof mount;
      step: typeof step;
      tree: () => UiTree | undefined;
      reactVersion: string;
      production: boolean;
    };
  }
}
window.streamTest = { mount, step, tree: () => previous, reactVersion, production };
