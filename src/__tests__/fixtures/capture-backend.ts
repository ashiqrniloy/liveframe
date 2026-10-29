import type { CaptureAxes, CaptureBackend } from "../../preview/capture/index.ts";

export function fakeCapture(
  axes: CaptureAxes = {
    scenarios: ["ready", "empty"],
    widths: [360, 768],
    themes: ["light"],
    designSystems: ["plain"],
  },
  snapshot: string | null = '- text "Hello"',
) {
  const opened: string[] = [];
  const waited: string[] = [];
  const closed: string[] = [];
  let shots = 0;
  let backendClosed = 0;
  const backend: CaptureBackend<number> = {
    async open(url) {
      opened.push(url);
      const scenario = axes.controlled
        ? axes.shown!
        : (new URL(url).searchParams.get(axes.urlKey ? `${axes.urlKey}.scenario` : "scenario") ?? axes.scenarios[0]!);
      return {
        async waitReady(selector) {
          waited.push(selector);
        },
        async axes() {
          return axes;
        },
        async cells() {
          return axes.widths.flatMap((width) =>
            axes.themes.flatMap((theme) =>
              axes.designSystems.map((designSystem) => ({
                handle: width,
                scenario,
                width,
                theme,
                designSystem,
                errors: [],
              })),
            ),
          );
        },
        async screenshot() {
          shots++;
          return new Uint8Array([137, 80, 78, 71]);
        },
        async ariaSnapshot() {
          return snapshot;
        },
        async close() {
          closed.push(url);
        },
      };
    },
    async close() {
      backendClosed++;
    },
  };
  return {
    backend,
    opened,
    waited,
    closed,
    get shots() {
      return shots;
    },
    get backendClosed() {
      return backendClosed;
    },
  };
}
