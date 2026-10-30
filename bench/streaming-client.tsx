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

const root = createRoot(document.body);
const { Surface } = renderer();
let validationMs = 0;
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

async function run(revisions: readonly string[], initial: string | null) {
  const samples: Sample[] = [];
  let previous: UiTree | undefined;
  if (initial !== null) {
    previous = JSON.parse(initial) as UiTree;
    flushSync(() =>
      root.render(
        <Profiler id="stream" onRender={() => {}}>
          <Surface {...surfaceProps} validator={validator} tree={previous} />
        </Profiler>,
      ),
    );
  }
  const started = performance.now();
  let next = started;
  for (const json of revisions) {
    next += 100;
    const parseStarted = performance.now();
    const parsed: unknown = JSON.parse(json);
    const parseMs = performance.now() - parseStarted;
    let tree = parsed as UiTree;
    let applyMs = 0;
    if (initial !== null) {
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
    flushSync(() =>
      root.render(
        <Profiler
          id="stream"
          onRender={(_id, _phase, actualDuration) => {
            profilerMs = actualDuration;
          }}
        >
          <Surface {...surfaceProps} validator={validator} tree={tree} />
        </Profiler>,
      ),
    );
    const wallMs = performance.now() - commitStarted;
    const endToEndMs = performance.now() - parseStarted;
    previous = tree;
    if (initial !== null && profilerMs === undefined) throw new Error("Missing development Profiler sample");
    const measured = profilerMs ?? wallMs;
    samples.push({
      parseMs,
      validationMs,
      profilerMs: measured,
      commitMs: Math.max(0, measured - validationMs),
      wallMs,
      applyMs,
      endToEndMs,
    });
    const remaining = next - performance.now();
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  return { samples, elapsedMs: performance.now() - started, finalTree: previous, reactVersion };
}

declare global {
  interface Window {
    streamTest: { run: typeof run };
  }
}
window.streamTest = { run };
