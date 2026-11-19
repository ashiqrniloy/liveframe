import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import type { UiNode } from "@arnilo/liveframe";
import type { Browser, Page } from "playwright";
import { browserName, launchBrowser } from "../../../../src/__tests__/fixtures/browser.ts";
import { styles } from "../styles.ts";
import { tree } from "./host.ts";

// The 0.4 content kinds in a real engine: the chart's name, text alternative and recipe-owned colours.
let server: Bun.Server<undefined>;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  const build = await Bun.build({
    entrypoints: [new URL("./controls-client.tsx", import.meta.url).pathname],
    target: "browser",
    conditions: ["liveframe:source"],
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
  });
  const [bundle] = build.outputs;
  if (!build.success || !bundle) throw new AggregateError(build.logs, "Content page build failed");
  const sheets = Object.values(styles()).join("\n");
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) =>
      new URL(request.url).pathname === "/client.js"
        ? new Response(bundle, { headers: { "Content-Type": "text/javascript" } })
        : new Response(
            `<!doctype html><html lang="en"><head><title>Content</title><style>${sheets}</style></head><body><script type="module" src="/client.js"></script></body></html>`,
            { headers: { "Content-Type": "text/html" } },
          ),
  });
  browser = await launchBrowser();
}, 60000);
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});
beforeEach(async () => {
  await page?.close();
  page = await browser.newPage();
  page.setDefaultTimeout(5000);
  await page.goto(server.url.href);
  await page.waitForFunction(() => !!window.controls);
});

const show = (node: UiNode, theme = 0) =>
  page.evaluate(([json, index]) => window.controls.mount(json, index), [
    JSON.stringify(tree("content", { id: "root", kind: "stack", props: {}, children: [node] })),
    theme,
  ] as const);
const chart: UiNode = {
  id: "root/chart",
  kind: "chart",
  props: {
    label: "Tasks closed per day",
    type: "bar",
    labels: ["Mon", "Tue"],
    series: [
      { name: "Closed", values: [3, 5] },
      { name: "Opened", values: [2, 4] },
    ],
    summary: "More closed than opened.",
  },
};

test(`chart_has_a_name_and_a_text_alternative (${browserName})`, async () => {
  await show(chart);
  const image = page.getByRole("img", { name: "Tasks closed per day" });
  expect(await image.count()).toBe(1);
  // The axes and legend repeat what the text alternative says, so only the image is in the accessibility tree.
  expect(await page.locator(".lf_surface:not([data-lf-portal])").ariaSnapshot()).toBe('- img "Tasks closed per day"');
  expect(await image.locator("desc").textContent()).toBe(
    "More closed than opened. Closed: Mon 3, Tue 5; Opened: Mon 2, Tue 4",
  );
  expect(await image.locator("title").textContent()).toBe("Tasks closed per day");
});

test(`chart_colours_come_from_the_design_system (${browserName})`, async () => {
  await show(chart, 0);
  const paint = () =>
    page.evaluate(() =>
      [1, 2].map((n) => {
        const series = document.querySelector(`.lf_chart_default_series${n}`);
        return series ? getComputedStyle(series).color : "";
      }),
    );
  const before = await paint();
  // Each series is a theme role, and the two differ.
  expect(before[0]).not.toBe(before[1]);
  // Mark the drawn plot; a theme switch must recolour it in place, without drawing it again.
  await page.evaluate(() => {
    (document.querySelector(".lf_chart_default_plot") as Element & { marked?: boolean }).marked = true;
  });
  await show(chart, 1);
  const after = await paint();
  expect(after).not.toEqual(before);
  expect(
    await page.evaluate(
      () => (document.querySelector(".lf_chart_default_plot") as Element & { marked?: boolean }).marked,
    ),
  ).toBe(true);
});

test(`chart_at_its_bound_draws_every_point (${browserName})`, async () => {
  const labels = Array.from({ length: 100 }, (_, i) => `d${i}`);
  const series = Array.from({ length: 4 }, (_, n) => ({
    name: `s${n}`,
    values: labels.map((_, i) => Math.sin(i / 7 + n) * 100),
  }));
  for (const type of ["bar", "line"] as const) {
    await show({ ...chart, props: { label: "Bound", type, labels, series } });
    if (type === "bar") expect(await page.locator(".lf_chart_default_plot rect").count()).toBe(400);
    else expect(await page.locator(".lf_chart_default_plot polyline").count()).toBe(4);
  }
});
