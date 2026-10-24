import { afterAll, beforeAll, expect, test } from "bun:test";
import { type Browser, chromium } from "playwright";
import { renderToString } from "react-dom/server";
import { ConformanceFailure } from "../conformance/index.ts";
import { rendererBrowserSuite } from "../conformance/react/index.ts";
import { compileValidator } from "../index.ts";
import { createRenderer } from "../react/index.ts";
import { examples, fixtures, pageOptions } from "./fixtures/conformance-browser.tsx";
import { browserHost } from "./fixtures/conformance-browser-host.ts";

let server: Awaited<ReturnType<typeof browserHost>>;
let browser: Browser;
beforeAll(async () => {
  server = await browserHost(new URL("./fixtures/conformance-client.tsx", import.meta.url).pathname);
  browser = await chromium.launch();
}, 30000);
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});
const suite = (mode = "") =>
  rendererBrowserSuite({
    ...pageOptions,
    examples,
    fixtures,
    page: () => browser.newPage(),
    url: `${server.url.href}?mutant=${mode}`,
  });

test("reference_fixture_passes_all_browser_cases", async () => {
  for (const c of suite()) await c.run();
}, 120000);

for (const [mode, name] of [
  ["hydration", "every_example_hydrates_without_mismatch"],
  ["undeclared", "interactions_raise_one_complete_intent"],
  ["wrong-value", "interactions_raise_one_complete_intent"],
  ["index", "focus_scroll_and_local_state_survive_revisions"],
  ["context", "switching_keeps_nodes_and_focus_and_rerenders_nothing"],
] as const)
  test(`renderer_browser_cases_catch_${mode}`, async () => {
    const c = suite(mode).find((c) => c.name === name);
    expect(c).toBeDefined();
    try {
      await c?.run();
      throw new Error("Mutant passed");
    } catch (error) {
      expect(error).toBeInstanceOf(ConformanceFailure);
      expect((error as ConformanceFailure).rule).toBe(name);
    }
  }, 120000);

test("conformance_page_accepts_trees_only_and_rejects_unknown_styles", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(server.url.href);
    await page.waitForFunction(() => !!window.liveframeConformance);
    const result = await page.evaluate(() => {
      const styles = {
        theme: { id: "certified", version: "1.0.0" },
        designSystem: { id: "certified", version: "1.0.0" },
      };
      return [null, [], "code", 42, { code: "alert(1)" }, { format: "liveframe/1", root: {} }].map((value) => {
        try {
          window.liveframeConformance.mount(value, styles);
          return false;
        } catch {
          return true;
        }
      });
    });
    expect(result.every(Boolean)).toBe(true);
    expect(await page.locator("[data-lf-conformance] *").count()).toBe(0);
    const unknownStyles = page.evaluate(
      (serialized: string) =>
        window.liveframeConformance.mount(JSON.parse(serialized), {
          theme: { id: "missing", version: "1" },
          designSystem: { id: "certified", version: "1.0.0" },
        }),
      JSON.stringify(fixtures.survival.tree),
    );
    await expect(unknownStyles).rejects.toThrow("Unknown theme");
    expect(await page.evaluate(() => window.liveframeConformance.renders())).toBe(0);
  } finally {
    await page.close();
  }
});

test("missing_browser_fixtures_fail_with_the_named_rule", async () => {
  const c = rendererBrowserSuite({
    ...pageOptions,
    examples: [],
    fixtures,
    page: () => browser.newPage(),
    url: server.url.href,
  })[0];
  await expect(c?.run()).rejects.toMatchObject({ rule: "every_example_hydrates_without_mismatch" });
});

test("hydration_can_be_followed_by_updates_without_remounting", async () => {
  const { Surface } = createRenderer(pageOptions);
  const styles = { theme: { id: "certified", version: "1.0.0" }, designSystem: { id: "certified", version: "1.0.0" } };
  const markup = renderToString(
    <Surface
      {...styles}
      validator={compileValidator(pageOptions)}
      tree={fixtures.survival.tree}
      fallback={pageOptions.fallback}
      onIntent={() => {}}
    />,
  );
  const page = await browser.newPage();
  try {
    await page.goto(server.url.href);
    await page.waitForFunction(() => !!window.liveframeConformance);
    await page.evaluate(
      ({ markup, serialized, styles }) => window.liveframeConformance.hydrate(markup, JSON.parse(serialized), styles),
      { markup, serialized: JSON.stringify(fixtures.survival.tree), styles },
    );
    const field = fixtures.survival.focus(page);
    await field.fill("draft");
    const node = await field.elementHandle();
    await page.evaluate(({ serialized, styles }) => window.liveframeConformance.mount(JSON.parse(serialized), styles), {
      serialized: JSON.stringify(fixtures.survival.next),
      styles,
    });
    expect(await field.inputValue()).toBe("draft");
    expect(await field.evaluate((element, original) => element === original, node)).toBe(true);
    await page.evaluate(() =>
      window.liveframeConformance.switch({
        theme: { id: "rack", version: "1.0.0" },
        designSystem: { id: "rack", version: "1.0.0" },
      }),
    );
    expect(await field.evaluate((element, original) => element === original, node)).toBe(true);
    await node?.dispose();
  } finally {
    await page.close();
  }
});

test("production_without_profiling_fails_instead_of_hiding_renders", async () => {
  const production = await browserHost(
    new URL("./fixtures/conformance-client.tsx", import.meta.url).pathname,
    "",
    true,
  );
  try {
    const c = rendererBrowserSuite({
      ...pageOptions,
      examples,
      fixtures,
      page: () => browser.newPage(),
      url: production.url.href,
    }).find((c) => c.name === "switching_keeps_nodes_and_focus_and_rerenders_nothing");
    await expect(c?.run()).rejects.toMatchObject({
      rule: "switching_keeps_nodes_and_focus_and_rerenders_nothing",
      details: [expect.stringContaining("development or profiling React build")],
    });
  } finally {
    await production.stop(true);
  }
}, 30000);
