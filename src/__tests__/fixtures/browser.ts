import { type Browser, chromium, firefox, type LaunchOptions, type Page, webkit } from "playwright";

const engines = { chromium, firefox, webkit } as const;
export type BrowserName = keyof typeof engines;

const requested = process.env.LIVEFRAME_BROWSER ?? "chromium";
if (!Object.hasOwn(engines, requested))
  throw new Error(`LIVEFRAME_BROWSER must be chromium, firefox or webkit; got ${requested}`);
export const browserName = requested as BrowserName;

/** One engine parameter for every browser test; select it with LIVEFRAME_BROWSER. */
export function launchBrowser(options: LaunchOptions = {}): Promise<Browser> {
  return engines[browserName].launch({ headless: true, ...options });
}

/** Task 13's spans: attribute through layout, subsequent style probe, and double rAF. */
export async function measureSwitching(page: Page, fixture: "css" | "surface") {
  return page.evaluate(async (fixture) => {
    const root = document.querySelector<HTMLElement>(fixture === "css" ? "#b" : "#b .lf_surface");
    if (!root) throw new Error("Missing switching surface");
    const nodes = fixture === "css" ? [root, ...root.querySelectorAll("*")] : [...document.querySelectorAll("#b *")];
    const raf = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
    const samples: { library: number; probe: number; frame: number; callAndLayout: number }[] = [];
    const original = root.setAttribute;
    root.setAttribute = function (name, value) {
      if (name === "data-lf-switching") performance.mark("switch-attribute");
      original.call(this, name, value);
    };
    try {
      for (let i = 0; i < 11; i++) {
        await raf();
        performance.clearMarks();
        performance.clearMeasures();
        performance.mark("switch-start");
        const name = i % 2 ? "rack" : "certified";
        if (fixture === "surface") window.surfaceTest.switchStyles(1, name);
        else {
          root.setAttribute("data-lf-switching", "");
          root.setAttribute("data-lf-theme", `${name}@1.0.0`);
          root.setAttribute("data-lf-ds", `${name}@1.0.0`);
        }
        void root.offsetWidth;
        performance.mark("switch-layout");
        for (const el of nodes) {
          const style = getComputedStyle(el);
          void style.fontSize;
          void style.backgroundColor;
          void style.backdropFilter;
          void style.display;
        }
        performance.mark("switch-probe");
        await raf();
        if (fixture === "css") root.removeAttribute("data-lf-switching");
        performance.mark("switch-frame", { startTime: await raf() });
        const measure = (start: string, end: string) => performance.measure("switch", start, end).duration;
        const sample = {
          library: measure("switch-attribute", "switch-layout"),
          probe: measure("switch-layout", "switch-probe"),
          frame: measure("switch-start", "switch-frame"),
          callAndLayout: measure("switch-start", "switch-layout"),
        };
        if (Object.values(sample).some((duration) => !Number.isFinite(duration) || duration < 0))
          throw new Error("Invalid switching measurement");
        samples.push(sample);
      }
    } finally {
      delete (root as Partial<HTMLElement>).setAttribute;
    }
    return { cold: samples[0], samples: samples.slice(1), nodes: nodes.length };
  }, fixture);
}
