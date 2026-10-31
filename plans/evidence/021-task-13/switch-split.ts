/** Run from the repo root: timeout 180s bun --conditions liveframe:source plans/evidence/021-task-13/switch-split.ts [--headed] */
import assert from "node:assert/strict";
import { cpus, loadavg, release } from "node:os";
import { version as playwright } from "playwright/package.json";
import { browserName, launchBrowser } from "../../../src/__tests__/fixtures/browser.ts";
import { baseCss, designSystemCss, styleDeclarations, themeCss } from "../../../src/css/index.ts";
import type { Catalog, DesignSystem, Result, Theme } from "../../../src/index.ts";

const fixtures = new URL("../../../src/__tests__/fixtures/", import.meta.url);
const read = (name: string) => Bun.file(new URL(`proof/${name}.json`, fixtures)).json();
const catalog: Catalog = await read("catalog");
const css = (result: Result<string>) => {
  assert(result.ok, JSON.stringify(result));
  return result.value;
};
const sheets = [css(baseCss(catalog))];
for (const name of ["certified", "rack"]) {
  const theme: Theme = await read(`${name}.theme`);
  const system: DesignSystem = await read(`${name}.design-system`);
  sheets.push(css(themeCss(theme, catalog)), css(designSystemCss(system, { catalog, registry: {} })));
}
// The React test loads this third sheet even though switching never selects it.
const rack: DesignSystem = await read("rack.design-system");
const px = { value: 1, unit: "px" } as const;
const modifiers = css(
  designSystemCss(
    {
      ...rack,
      id: "modifiers",
      recipes: {
        ...rack.recipes,
        "button.default.root.rest": {
          backgroundColor: "surface.base",
          borderColor: { role: "border.hairline", alpha: 0 },
          textColor: { role: "text.primary", alpha: 0 },
          shadow: [{ color: { role: "surface.base", alpha: 0.25 }, offsetX: px, offsetY: px, blur: px, spread: px }],
        },
        "button.default.label.rest": { placeholderColor: { role: "text.muted", alpha: 0 } },
      },
    },
    { catalog, registry: {} },
  ),
);
const markup = (await Bun.file(new URL("css/agent-home.html", fixtures)).text()).replace(
  / data-lf-(?:theme|ds)="[^"]*"/g,
  "",
);
const responsive = styleDeclarations({ position: { base: "static", "bp.md": "sticky" } }, catalog);
const build = await Bun.build({ entrypoints: [new URL("react-client.tsx", fixtures).pathname], target: "browser" });
assert(build.success, build.logs.map(String).join("\n"));
assert(build.outputs[0]);
const bundle = await build.outputs[0].text();
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (request) =>
    new URL(request.url).pathname === "/client.js"
      ? new Response(bundle, { headers: { "Content-Type": "text/javascript" } })
      : new Response(
          `<!doctype html><html><head><style>${sheets.join("\n")}${modifiers}</style><style>
      #app:has(section){display:flex;gap:16px}section{position:relative;width:760px;flex-shrink:0}
      [role=dialog]{position:absolute;top:40px;left:40px;z-index:2}
      .lf_dialog_default_backdrop{position:absolute;inset:0;z-index:1}
      </style></head><body><div id="app"></div><script type="module" src="/client.js"></script></body></html>`,
          { headers: { "Content-Type": "text/html" } },
        ),
});
const headed = process.argv.includes("--headed");
try {
  const browser = await launchBrowser({ headless: !headed });
  try {
    console.log(
      JSON.stringify({
        date: new Date().toISOString(),
        engine: browserName,
        browser: browser.version(),
        headed,
        bun: Bun.version,
        playwright,
        os: `${process.platform} ${release()}`,
        cpu: cpus()[0]?.model,
        logicalCpus: cpus().length,
        load: loadavg(),
        display: process.env.DISPLAY,
      }),
    );
    for (const fixture of ["css", "surface"] as const) {
      const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
      try {
        page.setDefaultTimeout(15000);
        if (fixture === "surface") {
          await page.goto(server.url.href);
          await page.waitForSelector("button");
          await page.evaluate(() => window.surfaceTest.mountSwitching());
          await page.waitForSelector("#b [role=dialog]");
        } else {
          await page.setContent(`<style>${sheets.join("\n")}</style><style>
            body{display:flex;align-items:start;gap:16px}section{position:relative;flex-shrink:0;width:760px}
            .backdrop{position:absolute;inset:0;z-index:1}.dialog{position:absolute;top:40px;left:40px;z-index:2}
            </style><button id="host">Host</button>${["certified", "rack"]
              .map(
                (name, index) => `
            <section id="${index ? "b" : "a"}" class="lf_surface lf_container"
              data-lf-theme="${name}@1.0.0" data-lf-ds="${name}@1.0.0" data-lf-switching>
              ${markup}<button class="lf_button_primary_root probe">Probe</button>
              <div class="responsive ${responsive.classes.join(" ")}"></div>
              <div class="lf_dialog_default_root" data-open><div class="backdrop lf_dialog_default_backdrop"></div>
                <div role="dialog" aria-label="Scope proof" class="dialog lf_dialog_default_content">Open dialog</div></div>
              <div class="lf_popover_default_root" data-open><div popover="manual" class="lf_popover_default_content">Open popover</div></div>
            </section>`,
              )
              .join("")}`);
          await page.evaluate((style) => {
            for (const el of document.querySelectorAll<HTMLElement>(".responsive"))
              for (const [key, value] of Object.entries(style)) el.style.setProperty(key, value);
            for (const el of document.querySelectorAll<HTMLElement>("[popover]")) el.showPopover();
            void document.body.offsetWidth;
            for (const root of document.querySelectorAll("section")) root.removeAttribute("data-lf-switching");
          }, responsive.style);
          await page.mouse.move(0, 0);
        }
        const result = await page.evaluate(async (fixture) => {
          const root = document.querySelector<HTMLElement>(fixture === "css" ? "#b" : "#b .lf_surface");
          if (!root) throw new Error("Missing surface");
          const nodes =
            fixture === "css" ? [root, ...root.querySelectorAll("*")] : [...document.querySelectorAll("#b *")];
          if (nodes.length <= 500) throw new Error("Fixture must exceed 500 nodes");
          const raf = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
          const probe = () => {
            for (const el of nodes) {
              const s = getComputedStyle(el);
              void s.fontSize;
              void s.backgroundColor;
              void s.backdropFilter;
              void s.display;
            }
          };
          const rows: Record<string, number | string>[] = [];
          // Mark the actual attribute boundary; the React call also has synchronous work before it.
          const original = root.setAttribute;
          root.setAttribute = function (name, value) {
            if (name === "data-lf-switching") performance.mark("attribute");
            original.call(this, name, value);
          };
          try {
            for (const mode of ["legacy", "split"] as const) {
              if (fixture === "surface") window.surfaceTest.switchStyles(1, "rack");
              else {
                root.setAttribute("data-lf-theme", "rack@1.0.0");
                root.setAttribute("data-lf-ds", "rack@1.0.0");
              }
              await raf();
              await raf();
              for (let i = 0; i < 11; i++) {
                await raf();
                performance.clearMarks();
                performance.clearMeasures();
                const name = i % 2 ? "rack" : "certified";
                performance.mark("start");
                if (fixture === "surface") window.surfaceTest.switchStyles(1, name);
                else {
                  root.setAttribute("data-lf-switching", "");
                  root.setAttribute("data-lf-theme", `${name}@1.0.0`);
                  root.setAttribute("data-lf-ds", `${name}@1.0.0`);
                }
                if (mode === "split") {
                  // One root layout flush, as in the renderer; no per-node reads in A.
                  void root.offsetWidth;
                  performance.mark("layout");
                }
                probe();
                performance.mark("probe");
                const firstFrame = await raf();
                if (fixture === "css") root.removeAttribute("data-lf-switching");
                const secondFrame = await raf();
                performance.mark("frame", { startTime: secondFrame });
                const measure = (name: string, start: string, end: string) =>
                  performance.measure(name, start, end).duration;
                const row: Record<string, number | string> = {
                  mode,
                  sample: i,
                  total: measure("total", "start", "probe"),
                  frame: measure("frame", "start", "frame"),
                  frameGap: secondFrame - firstFrame,
                };
                if (mode === "split") {
                  row.library = measure("library", "attribute", "layout");
                  row.callAndLayout = measure("callAndLayout", "start", "layout");
                  row.probe = measure("probe", "layout", "probe");
                }
                rows.push(row);
              }
            }
          } finally {
            root.setAttribute = original;
          }
          return { nodes: nodes.length, rows };
        }, fixture);
        for (const mode of ["legacy", "split"]) {
          const warm = result.rows.filter((row) => row.mode === mode && row.sample !== 0);
          assert.equal(warm.length, 10);
          const summary: Record<string, { median: number; max: number }> = {};
          for (const span of mode === "split"
            ? ["library", "callAndLayout", "probe", "total", "frame", "frameGap"]
            : ["total", "frame", "frameGap"]) {
            const samples = warm.map((row) => Number(row[span])).sort((a, b) => a - b);
            assert(samples.every((value) => Number.isFinite(value) && value >= 0));
            summary[span] = { median: (Number(samples[4]) + Number(samples[5])) / 2, max: Number(samples[9]) };
          }
          console.log(JSON.stringify({ fixture, mode, nodes: result.nodes, summary }));
        }
        console.log(JSON.stringify({ fixture, samples: result.rows, load: loadavg() }));
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
} finally {
  await server.stop(true);
}
