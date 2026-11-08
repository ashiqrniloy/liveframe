import { afterAll, beforeAll, expect, test } from "bun:test";
import { compileValidator, type UiNode } from "@arnilo/liveframe";
import { createRenderer } from "@arnilo/liveframe/react";
import { renderToString } from "react-dom/server";
import type { Browser } from "playwright";
import { browserName, launchBrowser } from "../../../../src/__tests__/fixtures/browser.ts";
import { catalog } from "../catalog.ts";
import { implementations } from "../implementations.tsx";
import { styles } from "../styles.ts";
import { themes } from "../themes.ts";
import { capabilities, manifest, pageOptions, tree } from "./host.ts";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(() => browser?.close());

// Fifty rows: a title, a hint, a switch and two buttons each, the shape of a list widget.
const rows: UiNode[] = Array.from({ length: 50 }, (_, i) => ({
  id: `root/row${i}`,
  kind: "box",
  variant: "rule",
  props: {},
  children: [
    {
      id: `root/row${i}/line`,
      kind: "inline",
      props: {},
      style: { gap: "space.3" },
      children: [
        { id: `root/row${i}/line/title`, kind: "text", props: { text: `Row ${i}` }, style: { grow: 1 } },
        { id: `root/row${i}/line/hint`, kind: "hint", props: { text: "Updated just now" } },
        { id: `root/row${i}/line/on`, kind: "switch", props: { label: "On", checked: i % 2 === 0 } },
        { id: `root/row${i}/line/open`, kind: "button", props: { label: "Open" } },
        { id: `root/row${i}/line/drop`, kind: "button", variant: "ghost", props: { label: "Drop", tone: "critical" } },
      ],
    },
  ],
}));

// Span A (spec §6.4): from the first switching attribute change through style and layout of the switch frame, forced
// once. The theme and the design system flip together, as a host's preference change does.
test.skipIf(browserName !== "chromium")(
  "starter_switch_within_budget",
  async () => {
    const [light, dark] = themes;
    const [first, second] = pageOptions.designSystems;
    if (!light || !dark || !first || !second) throw new Error("Missing switch identities");
    const validator = compileValidator({ catalog, capabilities, manifest });
    const { Surface } = createRenderer({ catalog, implementations });
    const surface = tree("rows", { id: "root", kind: "stack", props: {}, children: rows });
    const html = renderToString(
      <Surface
        tree={surface}
        validator={validator}
        theme={light}
        designSystem={first}
        fallback={null}
        onIntent={() => {}}
      />,
    );
    const sheets = styles();
    const page = await browser.newPage();
    try {
      await page.setContent(
        `<!doctype html><html><head><style>${sheets.base}${sheets.primitives}${sheets.themes}${sheets.designSystem}</style></head><body>${html}</body></html>`,
      );
      const result = await page.evaluate(
        async ({ names, nodes }) => {
          const root = document.querySelector<HTMLElement>(".lf_surface");
          if (!root) throw new Error("Missing surface");
          const raf = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
          const samples: number[] = [];
          for (let i = 0; i < 12; i++) {
            await raf();
            const start = performance.now();
            const [theme, system] = names[i % 2] ?? [];
            root.setAttribute("data-lf-switching", "");
            root.setAttribute("data-lf-theme", theme ?? "");
            root.setAttribute("data-lf-ds", system ?? "");
            void root.offsetWidth;
            for (const el of document.querySelectorAll(nodes)) void getComputedStyle(el).backgroundColor;
            samples.push(performance.now() - start);
            await raf();
            root.removeAttribute("data-lf-switching");
          }
          return { cold: samples[0] ?? 0, warm: samples.slice(1), elements: document.querySelectorAll("*").length };
        },
        {
          // The surface's scope identities are `<id>@<version>`.
          names: [
            [`${dark.id}@${dark.version}`, `${second.id}@${second.version}`],
            [`${light.id}@${light.version}`, `${first.id}@${first.version}`],
          ],
          nodes: ".lf_surface *",
        },
      );
      console.log(
        `Starter switch (${result.elements} elements): cold ${result.cold.toFixed(2)} ms, warm max ${Math.max(...result.warm).toFixed(2)} ms`,
      );
      expect(Math.max(...result.warm)).toBeLessThanOrEqual(16.67);
    } finally {
      await page.close();
    }
  },
  60000,
);
