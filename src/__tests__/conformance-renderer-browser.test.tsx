import { afterAll, beforeAll, expect, test } from "bun:test";
import { type Browser, chromium } from "playwright";
import { renderToString } from "react-dom/server";
import { ConformanceFailure } from "../conformance/index.ts";
import { type BrowserFixtures, rendererBrowserSuite } from "../conformance/react/index.ts";
import { compileValidator } from "../index.ts";
import { createRenderer } from "../react/index.ts";
import { examples, fixtures, overlayFixtures, pageOptions, textFixtures } from "./fixtures/conformance-browser.tsx";
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

test("reference_fixture_passes_arrival_and_interaction_browser_cases", async () => {
  for (const c of suite().filter((c) => c.name !== "every_styled_state_is_reachable")) await c.run();
}, 120000);

const stateRule = "every_styled_state_is_reachable";
function stateCase(
  mode = "",
  states: BrowserFixtures["states"] = {
    "button.primary.selected": {
      tree: {
        ...fixtures.survival.tree,
        root: { id: "root", kind: "button", variant: "primary", props: { label: "Selected", pressed: true } },
      },
      target: (p: import("playwright").Page) => p.getByRole("button", { name: "Selected" }),
    },
  },
) {
  return rendererBrowserSuite({
    ...pageOptions,
    designSystems: pageOptions.designSystems.map((system) => ({
      ...system,
      recipes: {
        ...Object.fromEntries(
          Object.entries(system.recipes)
            .filter(([key]) => key.endsWith(".rest"))
            .flatMap(([key, value]) => [
              [key, value],
              [key.replace(/rest$/, "focus"), {}],
            ]),
        ),
        "button.primary.root.selected": { opacity: 0.5 },
      },
    })),
    examples,
    fixtures: { ...fixtures, states },
    page: () => browser.newPage(),
    url: `${server.url.href}?mutant=${mode}`,
  }).find((c) => c.name === stateRule);
}
test("state_case_reaches_selected_and_catches_an_unreachable_state", async () => {
  expect(stateCase()).toBeDefined();
  await stateCase()?.run();
  await expect(stateCase("selected")?.run()).rejects.toMatchObject({
    rule: stateRule,
    details: [expect.stringContaining("button.primary.selected")],
  });
}, 120000);
test("state_case_lists_missing_fixtures", async () => {
  await expect(stateCase("", {})?.run()).rejects.toMatchObject({
    rule: stateRule,
    details: [expect.stringContaining("button.primary.selected")],
  });
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

const lifecycleRules = [
  "overlay_keeps_surface_scope",
  "overlay_exit_finishes_before_unmount",
  "open_overlay_locks_scroll_and_makes_background_inert",
  "text_input_counts_code_points",
];
function lifecycleSuite(mode = "", extra: Partial<BrowserFixtures> = {}) {
  return rendererBrowserSuite({
    ...pageOptions,
    examples,
    fixtures: {
      ...fixtures,
      overlayKinds: ["dialog"],
      overlays: overlayFixtures,
      textInputKinds: ["textField"],
      textInputs: textFixtures,
      ...extra,
    },
    page: () => browser.newPage(),
    url: `${server.url.href}?mutant=${mode}`,
  }).filter((c) => lifecycleRules.includes(c.name));
}
test("overlay_and_text_cases_pass_on_reference_implementations", async () => {
  const cases = lifecycleSuite();
  expect(cases).toHaveLength(4);
  for (const c of cases) await c.run();
}, 120000);
async function fails(c: ReturnType<typeof lifecycleSuite>[number] | undefined, detail?: string) {
  if (!c) throw new Error("Missing lifecycle case");
  try {
    await c.run();
  } catch (error) {
    expect(error).toBeInstanceOf(ConformanceFailure);
    expect((error as ConformanceFailure).rule).toBe(c.name);
    if (detail) expect(JSON.stringify((error as ConformanceFailure).details)).toContain(detail);
    return;
  }
  throw new Error(`Mutant passed ${c.name}`);
}
for (const [mode, rule] of [
  ["scope", lifecycleRules[0]],
  ["instant-exit", lifecycleRules[1]],
  ["nonmodal", lifecycleRules[2]],
  ["utf16", lifecycleRules[3]],
  ["text-intent", lifecycleRules[3]],
])
  test(`overlay_and_text_cases_catch_${mode}`, async () => {
    await fails(lifecycleSuite(mode).find((c) => c.name === rule));
  }, 120000);
test("overlay_and_text_cases_name_missing_declared_kinds", async () => {
  for (const c of lifecycleSuite("", { overlays: [], textInputs: [] }))
    await fails(c, c.name.startsWith("text_") ? "textField" : "dialog");
  for (const c of lifecycleSuite("", { overlayKinds: ["dialog", "popover"], textInputKinds: ["textField", "other"] }))
    await fails(c, c.name.startsWith("text_") ? "other" : "popover");
}, 120000);
test("overlay_cases_catch_backdrop_ancestors_and_reduced_motion", async () => {
  for (const css of [".lf_surface { opacity: 0.8 }", ".lf_surface { filter: blur(0px) }"]) {
    await fails(
      lifecycleSuite("", { overlays: overlayFixtures.map((f) => ({ ...f, exitCss: f.exitCss + css })) }).find(
        (c) => c.name === lifecycleRules[0],
      ),
      "backdrop ancestor",
    );
  }
  await fails(
    lifecycleSuite("", {
      overlays: overlayFixtures.map((f) => ({
        ...f,
        exitCss: `${f.exitCss}@media (prefers-reduced-motion: reduce) {
      .lf_dialog_default_backdrop[data-exiting] { animation: conformance-exit 400ms linear !important }
    }`,
      })),
    }).find((c) => c.name === lifecycleRules[1]),
    "reducedMotion=true",
  );
}, 120000);
test("overlay_case_rejects_content_removed_during_exit", async () => {
  await fails(
    lifecycleSuite("", {
      overlays: overlayFixtures.map((f) => ({
        ...f,
        async close(p) {
          await f.close(p);
          await p.locator(".lf_dialog_default_backdrop[data-exiting]").waitFor();
          await f.content(p).evaluate((element) => element.remove());
        },
      })),
    }).find((c) => c.name === lifecycleRules[1]),
  );
}, 120000);

test("text_case_accepts_intents_emitted_while_typing", async () => {
  const c = lifecycleSuite("live-change").find((c) => c.name === lifecycleRules[3]);
  if (!c) throw new Error("Missing text case");
  await c.run();
}, 120000);
