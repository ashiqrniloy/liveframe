import type { Page } from "playwright";
import { renderToString } from "react-dom/server";
import { compileValidator } from "../../index.ts";
import { createRenderer } from "../../react/index.ts";
import { type ConformanceCase, check } from "../case.ts";
import { type BrowserFixtures, browserCases, browserSuiteCases } from "../renderer/browser.ts";
import type { PageOptions, Styles } from "./page.tsx";

export type { BrowserFixtures };

/** Cases drive the adopter's page; this module never launches a browser or a server. */
export function rendererBrowserSuite(
  options: PageOptions & {
    page(): Page | Promise<Page>;
    url: string;
    examples: readonly unknown[];
    fixtures: BrowserFixtures;
  },
): ConformanceCase[] {
  return browserSuiteCases(options, {
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
            async ({ markup, tree, styles }) =>
              (window.liveframeConformance.hydrate as NonNullable<typeof window.liveframeConformance.hydrate>)(
                markup,
                tree,
                styles,
              ),
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
    ...browserCases(options, {
      // The fallback as React renders it, parsed by the page as the wrapper's markup is.
      fallbackMarkup: (page) =>
        page.evaluate((markup) => {
          const template = document.createElement("template");
          template.innerHTML = markup;
          return template.innerHTML;
        }, renderToString(options.fallback)),
    }),
  });
}
