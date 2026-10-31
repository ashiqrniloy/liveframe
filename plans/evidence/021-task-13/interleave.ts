/** Run from the repo root: LIVEFRAME_BROWSER=webkit timeout 300s bun --conditions liveframe:source plans/evidence/021-task-13/interleave.ts [variant...] */
import assert from "node:assert/strict";
import { cpus, loadavg, release } from "node:os";
import { version as playwright } from "playwright/package.json";
import { primitiveCss } from "../../../proof/renderer/primitives/base.ts";
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
const library = sheets.join("\n");
// The same font switch with no Liveframe CSS: the engine's own restyle and relayout cost for this DOM.
const floor = `#b{font:14px "Schibsted Grotesk",system-ui,sans-serif;line-height:1.4}
#b[data-lf-theme="rack@1.0.0"]{font:13px Geist,Satoshi,system-ui,Cantarell,sans-serif;line-height:1.3}
#b *{box-sizing:border-box;margin:0}`;
const rows = ".lf_box_rule_root{content-visibility:auto;contain-intrinsic-block-size:auto 90px}";
const variants: Record<string, { css: string; cls: string }> = {
  test: { css: library, cls: "lf_surface lf_container" },
  prim: { css: primitiveCss + library, cls: "lf_surface lf_container" },
  "prim-nocq": {
    css:
      primitiveCss.replace(/\.lf_container\{[^}]*\}/, "") +
      library.replace(/:where\(\[data-lf-ds\]\)\.lf_container\{[^}]*\}/, ""),
    cls: "lf_surface",
  },
  "prim-cv": { css: primitiveCss + library + rows, cls: "lf_surface lf_container" },
  // Task 13.5 upper bounds: removing a rule outright bounds what any styling-preserving rewrite could gain.
  "prim-noreset": {
    css:
      primitiveCss +
      library
        .replace(":where([data-lf-ds]) *{box-sizing:border-box;margin:0;border:0 solid}", "")
        .replace(":where([data-lf-ds]) :where(button,input,select,textarea){font:inherit}", ""),
    cls: "lf_surface lf_container",
  },
  "prim-notype": {
    css:
      primitiveCss +
      library.replace(/(\.lf_[\w-]+(?::where\([^{}]*\))?[^{}]*)\{([^{}]*)\}/g, (_, selector: string, body: string) =>
        selector.startsWith(".lf_surface")
          ? `${selector}{${body}}`
          : `${selector}{${body.replace(/(?:font-[\w-]+|line-height|letter-spacing|text-transform):[^;{}]+;?/g, "")}}`,
      ),
    cls: "lf_surface lf_container",
  },
  "prim-floor": { css: primitiveCss + floor, cls: "" },
  floor: { css: floor, cls: "" },
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(variants);
for (const name of names) assert(variants[name], `Unknown variant ${name}`);
const markup = (await Bun.file(new URL("css/agent-home.html", fixtures)).text()).replace(
  / data-lf-(?:theme|ds)="[^"]*"/g,
  "",
);
const responsive = styleDeclarations({ position: { base: "static", "bp.md": "sticky" } }, catalog);
const rounds = Number(process.env.ROUNDS ?? 8);
type Sample = { style: number; layout: number; total: number };
const results = new Map<string, { nodes: number; height: number; samples: Sample[] }>();

const browser = await launchBrowser();
try {
  console.log(
    JSON.stringify({
      date: new Date().toISOString(),
      engine: browserName,
      browser: browser.version(),
      bun: Bun.version,
      playwright,
      os: `${process.platform} ${release()}`,
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      load: loadavg(),
    }),
  );
  const pages = [];
  for (const name of names) {
    const variant = variants[name];
    assert(variant);
    const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
    page.setDefaultTimeout(15000);
    await page.setContent(`<style>${variant.css}</style><style>
      body{display:flex;align-items:start;gap:16px}section{position:relative;flex-shrink:0;width:760px}
      .backdrop{position:absolute;inset:0;z-index:1}.dialog{position:absolute;top:40px;left:40px;z-index:2}
      </style><button id="host">Host</button>${["certified", "rack"]
        .map(
          (system, index) => `
      <section id="${index ? "b" : "a"}" class="${variant.cls}" data-lf-theme="${system}@1.0.0" data-lf-ds="${system}@1.0.0">
        ${markup}<button class="lf_button_primary_root probe">Probe</button>
        <div class="responsive ${responsive.classes.join(" ")}"></div>
        <div class="lf_dialog_default_root" data-open><div class="backdrop lf_dialog_default_backdrop"></div>
          <div role="dialog" aria-label="Scope proof" class="dialog lf_dialog_default_content">Open dialog</div></div>
        <div class="lf_popover_default_root" data-open><div popover="manual" class="lf_popover_default_content">Open popover</div></div>
      </section>`,
        )
        .join("")}`);
    const shape = await page.evaluate((style) => {
      for (const el of document.querySelectorAll<HTMLElement>(".responsive"))
        for (const [key, value] of Object.entries(style)) el.style.setProperty(key, value);
      for (const el of document.querySelectorAll<HTMLElement>("[popover]")) el.showPopover();
      const root = document.querySelector("#b");
      if (!root) throw new Error("Missing surface");
      return { nodes: root.querySelectorAll("*").length + 1, height: Math.round(root.getBoundingClientRect().height) };
    }, responsive.style);
    assert(shape.nodes > 500, "Fixture must exceed 500 nodes");
    await page.mouse.move(0, 0);
    pages.push({ name, page });
    results.set(name, { ...shape, samples: [] });
  }
  // Round-robin, so machine-load drift affects every variant equally.
  for (let round = 0; round < rounds; round++)
    for (const { name, page } of pages) {
      await page.bringToFront();
      const samples = await page.evaluate(async () => {
        const root = document.querySelector<HTMLElement>("#b");
        if (!root) throw new Error("Missing surface");
        const raf = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
        const out: Sample[] = [];
        for (let i = 0; i < 6; i++) {
          const system = i % 2 ? "rack" : "certified";
          await raf();
          await raf();
          const start = performance.now();
          root.setAttribute("data-lf-switching", "");
          root.setAttribute("data-lf-theme", `${system}@1.0.0`);
          root.setAttribute("data-lf-ds", `${system}@1.0.0`);
          void getComputedStyle(root).color;
          const styled = performance.now();
          void root.offsetWidth;
          const laidOut = performance.now();
          out.push({ style: styled - start, layout: laidOut - styled, total: laidOut - start });
          await raf();
          root.removeAttribute("data-lf-switching");
        }
        return out.slice(1);
      });
      results.get(name)?.samples.push(...samples);
    }
} finally {
  await browser.close();
}

const quantile = (values: number[], q: number) =>
  values.toSorted((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))] ?? Number.NaN;
for (const [name, { nodes, height, samples }] of results) {
  assert.equal(samples.length, rounds * 5);
  assert(samples.every((sample) => Object.values(sample).every((value) => Number.isFinite(value) && value >= 0)));
  const summary = Object.fromEntries(
    (["style", "layout", "total"] as const).map((key) => {
      const values = samples.map((sample) => sample[key]);
      return [key, { p50: quantile(values, 0.5), p90: quantile(values, 0.9), max: quantile(values, 1) }];
    }),
  );
  console.log(JSON.stringify({ variant: name, nodes, height, samples: samples.length, summary }));
}
console.log(JSON.stringify({ loadAfter: loadavg() }));
