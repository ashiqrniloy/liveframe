import { Profiler } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { UiTree } from "../src/index.ts";
import { renderer, surfaceProps, validator } from "../src/__tests__/fixtures/react-surface.tsx";

type Sample = {
  readonly parseMs: number;
  readonly validationMs: number;
  readonly profilerMs: number;
  readonly commitMs: number;
  readonly wallMs: number;
};

const root = createRoot(document.body);
const { Surface } = renderer();
let validationMs = 0;
const validateTree = validator.validateTree;
(validator as { validateTree: typeof validator.validateTree }).validateTree = (tree, options) => {
  const started = performance.now();
  try {
    return validateTree(tree, options);
  } finally {
    validationMs += performance.now() - started;
  }
};

async function run(revisions: readonly string[]): Promise<{ samples: readonly Sample[]; elapsedMs: number }> {
  const samples: Sample[] = [];
  const started = performance.now();
  let next = started;
  for (const json of revisions) {
    next += 100;
    const parseStarted = performance.now();
    const tree = JSON.parse(json) as UiTree;
    const parseMs = performance.now() - parseStarted;
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
    const measured = profilerMs ?? wallMs;
    samples.push({
      parseMs,
      validationMs,
      profilerMs: measured,
      commitMs: Math.max(0, measured - validationMs),
      wallMs,
    });
    const remaining = next - performance.now();
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  return { samples, elapsedMs: performance.now() - started };
}

declare global {
  interface Window {
    streamTest: { run(revisions: readonly string[]): ReturnType<typeof run> };
  }
}
window.streamTest = { run };
