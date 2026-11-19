import type { Page } from "playwright";
import { createDomRenderer, type DomImplementation } from "../../dom/index.ts";
import type { ConformanceCase } from "../case.ts";
import { type BrowserFixtures, browserCases, browserSuiteCases, openPage } from "../renderer/browser.ts";
import type { Styles, SuiteOptions } from "../renderer/page.ts";
import { type StructureRenderer, structureCases, structureSuiteCases } from "../renderer/structure.ts";

export type DomSuiteOptions = SuiteOptions & {
  implementations: readonly DomImplementation[];
  page(): Page | Promise<Page>;
  /** The app-owned page that calls `domConformancePage()`. */
  url: string;
  examples: readonly unknown[];
  fixtures: BrowserFixtures;
};

const styles = (theme: Styles["theme"], designSystem: Styles["designSystem"]): Styles => ({
  theme: { id: theme.id, version: theme.version },
  designSystem: { id: designSystem.id, version: designSystem.version },
});

/**
 * The `/dom` conformance suite. `/dom` has no server rendering, so the structural cases of `rendererSuite()` run on
 * the app's page; the browser cases are `rendererBrowserSuite()`'s, without hydration. Cases drive the adopter's
 * page; this module never launches a browser or a server.
 */
export function domRendererBrowserSuite(options: DomSuiteOptions): ConformanceCase[] {
  const open = async () => {
    const page = await options.page();
    page.setDefaultTimeout(10000);
    await openPage(page, options.url);
    const renderer: StructureRenderer = {
      render: (tree, theme, designSystem) =>
        page.evaluate(
          ({ tree, styles }) =>
            (window.liveframeConformance.structure as NonNullable<typeof window.liveframeConformance.structure>)(
              tree,
              styles,
            ),
          { tree, styles: styles(theme, designSystem) },
        ),
      fallbackSurface: (tree, theme, designSystem) =>
        page.evaluate(
          ({ tree, styles }) =>
            (
              window.liveframeConformance.fallbackSurface as NonNullable<
                typeof window.liveframeConformance.fallbackSurface
              >
            )(tree, styles),
          { tree: tree as unknown, styles: styles(theme, designSystem) },
        ),
      fallbackMarkup: () =>
        page.evaluate(() =>
          (
            window.liveframeConformance.fallbackMarkup as NonNullable<typeof window.liveframeConformance.fallbackMarkup>
          )(true),
        ),
    };
    return { renderer, close: () => page.close() };
  };
  const structure = structureSuiteCases(
    {
      async registry_check_passes() {
        createDomRenderer(options);
      },
      ...structureCases(options, open),
    },
    "Drawing failed",
  ).map((c) => ({ ...c, timeout: 120000 }));
  const browser = browserSuiteCases(
    options,
    browserCases(options, {
      fallbackMarkup: (page) =>
        page.evaluate(() =>
          (
            window.liveframeConformance.fallbackMarkup as NonNullable<typeof window.liveframeConformance.fallbackMarkup>
          )(),
        ),
    }),
  );
  return [...structure, ...browser];
}
