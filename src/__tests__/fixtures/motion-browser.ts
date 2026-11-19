import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Browser, Page } from "playwright";
import { primitiveCss } from "../../../proof/renderer/primitives/base.ts";
import { baseCss, designSystemCss, themeCss } from "../../css/index.ts";
import type { Catalog, DesignSystem, Result, Theme } from "../../index.ts";
import { launchBrowser } from "./browser.ts";

// Design-system motion through an adapter (plan 038 Tasks 3 and 6, design M.11–M.16, §2.5), in the engine
// LIVEFRAME_BROWSER names. `/react` and `/dom` run the same cases against their own client page.
const read = (name: string) => Bun.file(new URL(`./proof/${name}.json`, import.meta.url)).json();
const catalog: Catalog = await read("catalog");
function css(result: Result<string>) {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
const certified: DesignSystem = await read("certified.design-system");
/** Certified, with rows that fade and move over a second: long enough to observe, short enough to wait for. */
const motion: DesignSystem = {
  ...certified,
  id: "motion",
  values: { ...certified.values, "motion.test": { kind: "motion-duration", value: { value: 1000, unit: "ms" } } },
  recipes: {
    ...certified.recipes,
    "text.default.root.rest": {
      ...certified.recipes["text.default.root.rest"],
      transitionDuration: "motion.test",
      motion: "fade-move",
    },
  },
};
const sheets = [css(baseCss(catalog)), css(designSystemCss(motion, { catalog, registry: {} }))];
for (const name of ["certified", "rack"]) {
  const theme: Theme = await read(`${name}.theme`);
  sheets.push(css(themeCss(theme, catalog)));
}
sheets.push(css(designSystemCss(certified, { catalog, registry: {} })));

/**
 * Registers the motion cases for one adapter's client page. Test names are `/react`'s; with a `prefix`, a leading
 * `react_` is dropped and the prefix added (`dom_tolerates_the_kept_element`).
 */
export function motionBrowserTests(client: string, prefix = ""): void {
  const named = (name: string) => (prefix ? `${prefix}${name.replace(/^react_/, "")}` : name);
  let server: ReturnType<typeof Bun.serve>;
  let browser: Browser;
  beforeAll(async () => {
    const build = await Bun.build({
      entrypoints: [client],
      target: "browser",
    });
    if (!build.success) throw new AggregateError(build.logs);
    const bundle = await build.outputs[0]?.text();
    server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: (request) =>
        new URL(request.url).pathname === "/client.js"
          ? new Response(bundle, { headers: { "Content-Type": "text/javascript" } })
          : new Response(
              `<!doctype html><html lang="en"><head><title>Motion tests</title><style>${primitiveCss}${sheets.join("\n")}</style></head><body><div id="app"></div><script type="module" src="/client.js"></script></body></html>`,
              { headers: { "Content-Type": "text/html" } },
            ),
    });
    browser = await launchBrowser();
  }, 30000);
  afterAll(async () => {
    await browser?.close();
    await server?.stop(true);
  });

  async function open(ids: readonly string[], designSystem = "motion"): Promise<Page> {
    const page = await browser.newPage();
    await page.goto(server.url.href);
    await page.waitForFunction(() => !!window.motionTest);
    await page.evaluate(([ids, designSystem]) => window.motionTest.mount(ids, designSystem), [
      ids,
      designSystem,
    ] as const);
    return page;
  }

  /**
   * The properties animating on a row: CSS transitions (enter) and the renderer's animations (exit, move). Read
   * after the frame callbacks that follow an update, where the renderer plays its motion, and before that frame
   * is painted.
   */
  function motions(page: Page, id: string): Promise<string[] | undefined> {
    return page.evaluate(
      (id) =>
        new Promise<string[] | undefined>((resolve) =>
          requestAnimationFrame(() =>
            resolve(
              window.motionTest
                .row(id)
                ?.getAnimations()
                .flatMap((animation) =>
                  "transitionProperty" in animation
                    ? [(animation as CSSTransition).transitionProperty]
                    : (animation.effect as KeyframeEffect)
                        .getKeyframes()
                        .flatMap((frame) =>
                          Object.keys(frame).filter(
                            (key) => !["offset", "computedOffset", "easing", "composite"].includes(key),
                          ),
                        ),
                )
                .filter((property, i, all) => all.indexOf(property) === i)
                .sort(),
            ),
          ),
        ),
      id,
    );
  }

  test(named("first_tree_plays_no_enter"), async () => {
    const page = await open(["a", "b"]);
    try {
      const marked = await page.evaluate(() =>
        [...document.querySelectorAll("#app [data-lf-ds]")].map((element) => element.hasAttribute("data-lf-motion")),
      );
      expect(marked).toEqual([true, true]);
      expect(await motions(page, "a")).toEqual([]);
      expect(await page.evaluate(() => getComputedStyle(window.motionTest.row("b") as HTMLElement).opacity)).toBe("1");
      // A later revision's new row enters.
      await page.evaluate(() => window.motionTest.arrive(["a", "c", "b"]));
      expect(await motions(page, "c")).toContain("opacity");
      expect(await motions(page, "a")).toEqual([]);
      // A new surface is a first tree again.
      await page.evaluate(() => window.motionTest.arrive(["d"], { surfaceId: "other" }));
      expect(await motions(page, "d")).toEqual([]);
      await page.evaluate(() => window.motionTest.arrive(["d", "e"], { surfaceId: "other" }));
      expect(await motions(page, "e")).toContain("opacity");
      expect(await page.evaluate(() => window.motionTest.errors())).toEqual([]);
    } finally {
      await page.close();
    }
  });

  test(named("removed_row_plays_its_exit_before_it_is_gone"), async () => {
    const page = await open(["a", "b", "c"]);
    try {
      await page.evaluate(() => window.motionTest.arrive(["a", "c"]));
      expect(await motions(page, "b")).toEqual(["opacity"]);
      expect(await page.evaluate(() => window.motionTest.order())).toEqual(["a", "b", "c"]);
      expect(await page.evaluate(() => window.motionTest.row("b")?.hasAttribute("data-lf-exiting"))).toBe(true);
      await page.waitForFunction(() => window.motionTest.row("b") === undefined, undefined, { timeout: 3000 });
      expect(await page.evaluate(() => window.motionTest.order())).toEqual(["a", "c"]);
      // The gap closes with a move rather than a jump.
      expect(await motions(page, "c")).toContain("translate");
    } finally {
      await page.close();
    }
  });

  test(named("exiting_row_is_inert_and_hidden"), async () => {
    const page = await open(["a", "b"]);
    try {
      await page.evaluate(() => window.motionTest.arrive(["a"]));
      expect(await motions(page, "b")).toEqual(["opacity"]);
      expect(
        await page.evaluate(() => {
          const row = window.motionTest.row("b");
          return { inert: row?.inert, hidden: row?.getAttribute("aria-hidden") };
        }),
      ).toEqual({ inert: true, hidden: "true" });
      expect(await page.getByText("Row b").isVisible()).toBe(true);
      // Hidden from the accessibility tree while it is still drawn.
      expect(await page.getByText("Row b").evaluate((element) => element.closest("[aria-hidden=true]") !== null)).toBe(
        true,
      );
    } finally {
      await page.close();
    }
  });

  test(named("reordered_row_moves"), async () => {
    const page = await open(["a", "b", "c"]);
    try {
      await page.evaluate(() => window.motionTest.arrive(["c", "b", "a"]));
      expect(await page.evaluate(() => window.motionTest.order())).toEqual(["c", "b", "a"]);
      expect(await motions(page, "a")).toEqual(["translate"]);
      expect(await motions(page, "c")).toEqual(["translate"]);
      // A row that kept its box does not move.
      expect(await motions(page, "b")).toEqual([]);
      // The adapter writes no inline style: the slide is an animation over the recipe's own timing.
      expect(await page.evaluate(() => window.motionTest.row("a")?.getAttribute("style") ?? "")).toBe("");
    } finally {
      await page.close();
    }
  });

  test(named("reduced_motion_removes_every_added_motion"), async () => {
    const page = await open(["a", "b", "c"]);
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(() => window.motionTest.arrive(["a", "c", "d"]));
      // The removed row goes at once, the new row does not fade in and nothing slides.
      for (const id of ["a", "c", "d"]) expect(await motions(page, id)).toEqual([]);
      expect(await page.evaluate(() => window.motionTest.order())).toEqual(["a", "c", "d"]);
      await page.evaluate(() => window.motionTest.arrive(["d", "c", "a"]));
      for (const id of ["a", "c", "d"]) expect(await motions(page, id)).toEqual([]);
    } finally {
      await page.close();
    }
  });

  test(named("switching_theme_plays_no_motion"), async () => {
    const page = await open(["a", "b", "c"]);
    try {
      // A row already exiting when the switch starts goes with it.
      await page.evaluate(() => window.motionTest.arrive(["a", "b"]));
      await page.evaluate(() => window.motionTest.arrive(["c", "a", "d"], { theme: "rack" }));
      // The commit before a switch plays nothing: the removed row is gone at once, and the switching
      // sequence suppresses the new row's enter.
      for (const id of ["a", "c", "d"]) expect(await motions(page, id)).toEqual([]);
      expect(await page.evaluate(() => window.motionTest.order())).toEqual(["c", "a", "d"]);
    } finally {
      await page.close();
    }
  });

  test(named("react_tolerates_the_kept_element"), async () => {
    const page = await open(["a", "b", "c", "d"]);
    try {
      await page.evaluate(() => {
        const { arrive } = window.motionTest;
        arrive(["a", "c", "d"]); // b exits
        arrive(["e", "a", "c", "d"]); // insert before
        arrive(["e", "a", "f", "c"]); // insert where b was kept; d exits too
        arrive(["c", "f", "a", "e"]); // reorder around both kept rows
        arrive(["c", "b", "f", "a", "e"]); // b comes back while its old element is still exiting
      });
      await motions(page, "c");
      const drawn = await page.evaluate(() => window.motionTest.order());
      expect(drawn.filter((id) => id !== "d")).toEqual(["c", "b", "f", "a", "e"]);
      expect(await page.evaluate(() => document.querySelectorAll("#app [data-lf-exiting]").length)).toBeLessThanOrEqual(
        1,
      );
      await page.waitForFunction(() => document.querySelectorAll("#app [data-lf-exiting]").length === 0, undefined, {
        timeout: 3000,
      });
      expect(await page.evaluate(() => window.motionTest.order())).toEqual(["c", "b", "f", "a", "e"]);
      // React keeps reconciling the parent after the kept element left it.
      await page.evaluate(() => window.motionTest.arrive(["e", "a"]));
      await page.waitForFunction(() => window.motionTest.order().join() === "e,a", undefined, { timeout: 3000 });
      expect(await page.evaluate(() => window.motionTest.errors())).toEqual([]);
    } finally {
      await page.close();
    }
  });

  test(named("system_without_motion_draws_revisions_at_once"), async () => {
    const page = await open(["a", "b", "c"], "certified");
    try {
      await page.evaluate(() => window.motionTest.arrive(["c", "a", "d"]));
      for (const id of ["a", "c", "d"]) expect(await motions(page, id)).toEqual([]);
      expect(await page.evaluate(() => window.motionTest.order())).toEqual(["c", "a", "d"]);
    } finally {
      await page.close();
    }
  });
}
