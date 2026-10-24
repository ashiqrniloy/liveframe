import type { Locator, Page } from "playwright";
import { renderToString } from "react-dom/server";
import { compileValidator, type UiTree, validateCatalog } from "../../index.ts";
import { createRenderer } from "../../react/index.ts";
import { type ConformanceCase, ConformanceFailure, check } from "../case.ts";
import type { PageOptions, Styles } from "./page.tsx";

type Target = (page: Page) => Locator;
export type BrowserFixtures = {
  interactions: readonly { tree: UiTree; act(page: Page): Promise<unknown>; intents: readonly unknown[] }[];
  survival: { tree: UiTree; next: UiTree; focus: Target; scroll?: Target; input?: Target };
};

/** Cases drive the adopter's page; this module never launches a browser or a server. */
export function rendererBrowserSuite(
  options: PageOptions & {
    page(): Page | Promise<Page>;
    url: string;
    examples: readonly unknown[];
    fixtures: BrowserFixtures;
  },
): ConformanceCase[] {
  const cases = {
    async every_example_hydrates_without_mismatch(page: Page, styles: Styles, rule: string) {
      const { Surface } = createRenderer(options);
      const validator = compileValidator(options);
      check(options.examples.length, rule, "§13", ["Missing hydration examples"]);
      for (const tree of options.examples) {
        const checked = validator.validateTree(tree);
        check(checked.ok, rule, "§11", checked.ok ? [] : checked.errors);
        const markup = renderToString(
          <Surface {...styles} validator={validator} tree={tree} fallback={options.fallback} onIntent={() => {}} />,
        );
        const messages: string[] = [];
        const capture = (message: { type(): string; text(): string }) => {
          if (message.type() === "error") messages.push(message.text());
        };
        page.on("console", capture);
        try {
          const result = await page.evaluate(
            async ({ markup, tree, styles }) => window.liveframeConformance.hydrate(markup, tree, styles),
            { markup, tree, styles },
          );
          check(!result.errors.length && result.retained && !messages.length, rule, "§11", [
            ...result.errors,
            ...messages,
            `Server nodes retained: ${result.retained}`,
          ]);
        } finally {
          page.off("console", capture);
        }
      }
    },
    async invalid_arrival_shows_only_the_fallback_and_recovers(page: Page, styles: Styles, rule: string) {
      const tree = options.fixtures.survival.tree;
      await mount(page, tree, styles);
      const before = await page.evaluate(() => window.liveframeConformance.renders());
      const catalog = validateCatalog(options.catalog);
      check(catalog.ok, rule, "§11", catalog.ok ? [] : catalog.errors);
      let kind = "conformanceUnknownKind";
      while (catalog.value.definitions.some((definition) => definition.kind === kind)) kind += "X";
      await mount(page, { ...tree, root: { ...tree.root, kind } }, styles);
      const fallback = await page.locator("[data-lf-conformance] > .lf_surface").first().innerHTML();
      const expected = await page.evaluate((markup) => {
        const template = document.createElement("template");
        template.innerHTML = markup;
        return template.innerHTML;
      }, renderToString(options.fallback));
      check(fallback === expected, rule, "§11", ["Invalid arrival must show only the fallback"]);
      check((await page.evaluate(() => window.liveframeConformance.renders())) === before, rule, "§11", [
        "Invalid arrival called an implementation",
      ]);
      await mount(page, { ...tree, revision: tree.revision + 1 }, styles);
      check((await page.evaluate(() => window.liveframeConformance.renders())) > before, rule, "§11", [
        "Valid arrival did not recover",
      ]);
    },
    async interactions_raise_one_complete_intent(page: Page, styles: Styles, rule: string) {
      check(options.fixtures.interactions.length, rule, "§13", ["Missing interaction fixtures"]);
      for (const fixture of options.fixtures.interactions) {
        // Start each interaction on a fresh page so local state and intents cannot leak.
        await open(page);
        await mount(page, fixture.tree, styles);
        const errors: string[] = [];
        const capture = (error: Error) => {
          errors.push(String(error));
        };
        page.on("pageerror", capture);
        try {
          await fixture.act(page);
          await settle(page);
          const actual = await page.evaluate(() => window.liveframeConformance.intents());
          check(!errors.length && equal(actual, fixture.intents), rule, "§8", [
            ...errors,
            `Expected ${JSON.stringify(fixture.intents)}; received ${JSON.stringify(actual)}`,
          ]);
        } finally {
          page.off("pageerror", capture);
        }
      }
    },
    async focus_scroll_and_local_state_survive_revisions(page: Page, styles: Styles, rule: string) {
      const f = options.fixtures.survival;
      check(f.next.surfaceId === f.tree.surfaceId && f.next.revision > f.tree.revision, rule, "§13", [
        "Survival next must have the same surfaceId and a higher revision",
      ]);
      await mount(page, f.tree, styles);
      if (f.input) await f.input(page).fill("uncommitted draft");
      await f.focus(page).focus();
      const focused = await f.focus(page).elementHandle();
      const input = f.input ? await f.input(page).inputValue() : undefined;
      let scroll: number | undefined;
      if (f.scroll) {
        scroll = await f.scroll(page).evaluate((element) => {
          element.scrollTop = 40;
          return element.scrollTop;
        });
        check(scroll > 0, rule, "§13", ["Survival scroll fixture must overflow"]);
      }
      let acceptedMarkup: string | undefined;
      for (const tree of [f.next, f.tree]) {
        await mount(page, tree, styles);
        const markup = await page.locator("[data-lf-conformance]").innerHTML();
        if (acceptedMarkup !== undefined)
          check(markup === acceptedMarkup, rule, "§11", ["Stale arrival changed the accepted DOM"]);
        acceptedMarkup = markup;
        check(
          await f
            .focus(page)
            .evaluate((element, previous) => element === previous && element === document.activeElement, focused),
          rule,
          "§11",
          ["Focus or node identity lost across revision/reorder"],
        );
        if (f.input) check((await f.input(page).inputValue()) === input, rule, "§11", ["Uncommitted input lost"]);
        if (f.scroll) {
          const actual = await f.scroll(page).evaluate((element) => element.scrollTop);
          check(actual === scroll, rule, "§11", [
            `Scroll offset lost: expected ${scroll}, received ${actual}, revision ${tree.revision}`,
          ]);
        }
      }
      await focused?.dispose();
    },
    async switching_keeps_nodes_and_focus_and_rerenders_nothing(page: Page, styles: Styles, rule: string) {
      check(
        new Set(options.themes.map((theme) => `${theme.id}@${theme.version}`)).size > 1 &&
          new Set(options.designSystems.map((system) => `${system.id}@${system.version}`)).size > 1,
        rule,
        "§13",
        ["Switching needs two theme and design-system identities"],
      );
      await mount(page, options.fixtures.survival.tree, styles);
      await options.fixtures.survival.focus(page).focus();
      const snapshot = await page.evaluateHandle(() => ({
        nodes: [...document.querySelectorAll("[data-lf-conformance] *")],
        focus: document.activeElement,
        renders: window.liveframeConformance.renders(),
      }));
      for (const theme of options.themes)
        for (const designSystem of options.designSystems) {
          await page.evaluate((styles) => window.liveframeConformance.switch(styles), {
            theme: { id: theme.id, version: theme.version },
            designSystem: { id: designSystem.id, version: designSystem.version },
          });
          await settle(page);
          check(
            await page
              .locator("[data-lf-conformance] > .lf_surface")
              .evaluateAll(
                (scopes, styles) =>
                  scopes.length === 2 &&
                  scopes.every(
                    (scope) =>
                      scope.getAttribute("data-lf-theme") === `${styles.theme.id}@${styles.theme.version}` &&
                      scope.getAttribute("data-lf-ds") === `${styles.designSystem.id}@${styles.designSystem.version}`,
                  ),
                { theme, designSystem },
              ),
            rule,
            "§6.4",
            ["Switch did not apply both scope identities"],
          );
          check(
            await page.evaluate(
              (previous) =>
                previous.nodes.every((node) => node.isConnected) &&
                previous.focus === document.activeElement &&
                previous.renders === window.liveframeConformance.renders(),
              snapshot,
            ),
            rule,
            "§6.4",
            ["Switch replaced nodes, lost focus or rendered an implementation"],
          );
        }
      await snapshot.dispose();
    },
  };
  async function mount(page: Page, tree: unknown, styles: Styles) {
    await page.evaluate(({ tree, styles }) => window.liveframeConformance.mount(tree, styles), { tree, styles });
    await settle(page);
  }
  async function settle(page: Page) {
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
  }
  async function open(page: Page) {
    await page.goto(options.url);
    await page.waitForFunction(() => !!window.liveframeConformance);
  }
  return Object.entries(cases).map(([name, run]) => ({
    name,
    timeout: 120000,
    async run() {
      let page: Page | undefined;
      try {
        check(options.themes.length && options.designSystems.length, name, "§13", ["Missing themes or design systems"]);
        page = await options.page();
        page.setDefaultTimeout(10000);
        for (const theme of options.themes)
          for (const designSystem of options.designSystems) {
            await open(page);
            await run(
              page,
              {
                theme: { id: theme.id, version: theme.version },
                designSystem: { id: designSystem.id, version: designSystem.version },
              },
              name,
            );
          }
      } catch (error) {
        if (error instanceof ConformanceFailure) throw error;
        throw new ConformanceFailure(name, "§11", [String(error)]);
      } finally {
        await page?.close();
      }
    },
  }));
}
function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.entries(a),
    right = Object.entries(b);
  return (
    left.length === right.length &&
    left.every(([key, value]) => Object.hasOwn(b, key) && equal(value, (b as Record<string, unknown>)[key]))
  );
}
