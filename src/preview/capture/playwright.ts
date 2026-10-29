import type * as Playwright from "playwright";
import { CaptureError, type CaptureAxes, type CaptureBackend } from "./index.ts";

/** Uses the caller's Playwright module; importing this adapter never loads the peer. */
export function playwrightBackend(playwright: typeof Playwright): CaptureBackend<Playwright.Locator> {
  let browser: Playwright.Browser | undefined;
  return {
    async open(url) {
      browser ??= await playwright.chromium.launch({ headless: true }).catch((error: Error) => {
        // Playwright has no dedicated missing-browser error class.
        if (!/Executable doesn't exist|playwright install/i.test(error.message)) throw error;
        throw new CaptureError(
          "not-found",
          `Chromium is not installed for Playwright: run \`bun add -d playwright && bunx playwright install chromium\`.\n${error.message}`,
        );
      });
      // Keep cookies and storage across the per-scenario sessions.
      const context = browser.contexts()[0] ?? (await browser.newContext());
      const page = await context.newPage();
      try {
        await page.goto(url).catch((error: Error) => {
          throw new CaptureError("not-found", `Cannot open ${url}: ${error.message}`);
        });
      } catch (error) {
        await page.close();
        throw error;
      }
      return {
        async waitReady(selector) {
          await page.waitForSelector(selector, { timeout: 30000 }).catch(() => {
            throw new CaptureError("not-found", `${url} never became ready: is it a <Preview> page?`);
          });
          await page.locator("html").evaluate((element) => element.ownerDocument.fonts.ready);
        },
        async axes() {
          const axes: CaptureAxes | null = JSON.parse(
            (await page.locator("[data-lf-preview]").getAttribute("data-lf-preview")) ?? "null",
          );
          if (!axes?.controlled) return axes;
          const shown = JSON.parse(
            (await page.locator("[data-lf-cell]").first().getAttribute("data-lf-cell")) ?? "null",
          )?.scenario;
          return { ...axes, shown };
        },
        async cells() {
          const elements = page.locator("[data-lf-cell]");
          const found = await elements.evaluateAll((all) =>
            all.map((element) => ({
              ...JSON.parse(element.getAttribute("data-lf-cell") ?? "null"),
              errors: JSON.parse(element.getAttribute("data-lf-errors") ?? "[]"),
            })),
          );
          return found.map((coordinates, index) => ({ ...coordinates, handle: elements.nth(index) }));
        },
        screenshot: (cell) => cell.screenshot({ type: "png" }),
        ariaSnapshot: (cell) => cell.ariaSnapshot(),
        close: () => page.close(),
      };
    },
    async close() {
      const previous = browser;
      browser = undefined;
      await previous?.close();
    },
  };
}
