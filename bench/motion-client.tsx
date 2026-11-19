import { version as reactVersion } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { catalog, renderer, surfaceProps } from "../src/__tests__/fixtures/react-surface.tsx";
import type { UiTree } from "../src/index.ts";

const { Surface } = renderer();

/** Times each callback the renderer defers to the next animation frame (design-system motion plays there). */
let deferring = false;
let deferredMs = 0;
const request = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (callback) =>
  deferring
    ? request((time) => {
        const started = performance.now();
        callback(time);
        deferredMs += performance.now() - started;
      })
    : request(callback);
/** The next frame's own style and layout, forced in a callback that runs after the renderer's. */
const frameLayout = (container: HTMLElement) =>
  new Promise<number>((resolve) =>
    request(() => {
      const started = performance.now();
      void container.offsetWidth;
      resolve(performance.now() - started);
    }),
  );
const raf = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

function rows(ids: readonly number[], revision: number, surfaceId: string): UiTree {
  return {
    format: "liveframe/1",
    catalogId: catalog.catalogId,
    surfaceId,
    revision,
    root: {
      id: "root",
      kind: "stack",
      props: {},
      children: ids.map((id) => ({ id: `root/r${id}`, kind: "text", props: { text: `Row ${id}` } })),
    },
  };
}

/**
 * One commit that removes 20 of 70 rows and reverses the other 50 (design §2's budget case): the commit timed
 * around `flushSync`, then the next frame's work up to layout (the renderer's deferred callbacks, then style
 * and layout). Each run mounts a fresh surface under `designSystem` and lets it settle first.
 */
async function measureMotion(
  designSystem: string,
  runs: number,
  warmup: number,
): Promise<{ readonly commitMs: number[]; readonly frameMs: number[] }> {
  const all = Array.from({ length: 70 }, (_, i) => i);
  const kept = all.filter((i) => i % 7 > 1).reverse();
  const commitMs: number[] = [];
  const frameMs: number[] = [];
  for (let i = 0; i < warmup + runs; i++) {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const props = { ...surfaceProps, designSystem: { id: designSystem, version: "1.0.0" } };
    try {
      flushSync(() => root.render(<Surface {...props} tree={rows(all, 1, `run-${i}`)} />));
      await raf();
      deferredMs = 0;
      deferring = true;
      const started = performance.now();
      flushSync(() => root.render(<Surface {...props} tree={rows(kept, 2, `run-${i}`)} />));
      const wall = performance.now() - started;
      deferring = false;
      const layout = await frameLayout(container);
      if (i >= warmup) {
        commitMs.push(wall);
        frameMs.push(deferredMs + layout);
      }
      await raf();
    } finally {
      flushSync(() => root.unmount());
      container.remove();
    }
  }
  return { commitMs, frameMs };
}

declare global {
  interface Window {
    motionBench: { measureMotion: typeof measureMotion; reactVersion: string; production: boolean };
  }
}
window.motionBench = { measureMotion, reactVersion, production: process.env.NODE_ENV === "production" };
