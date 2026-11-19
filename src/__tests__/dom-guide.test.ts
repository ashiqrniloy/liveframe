import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Browser } from "playwright";
import { launchBrowser } from "./fixtures/browser.ts";
import { browserHost } from "./fixtures/conformance-browser-host.ts";

const fixture = new URL("./fixtures/dom-guide.ts", import.meta.url).pathname;
let server: Awaited<ReturnType<typeof browserHost>>;
let browser: Browser;
beforeAll(async () => {
  server = await browserHost(fixture);
  browser = await launchBrowser();
}, 30000);
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});

test("dom_guide_examples_run", async () => {
  const source = await Bun.file(fixture).text();
  const guide = await Bun.file(new URL("../../docs/renderer.md", import.meta.url)).text();
  for (const name of ["implement", "mount", "element"]) {
    const block = source.split(`// guide:${name}:start\n`)[1]?.split(`// guide:${name}:end`)[0];
    if (!block) throw new Error(`Missing guide block: ${name}`);
    expect(guide).toContain(block.trimEnd());
  }
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(server.url.href);
    await page.waitForFunction(() => !!window.domGuide);
    expect(await page.evaluate(() => window.domGuide.drawn)).toBe(true);
    // The theme switch has applied to both scopes.
    expect(await page.locator("main > .lf_surface[data-lf-theme='rack@1.0.0']").count()).toBe(2);
    await page.getByRole("button", { name: "Save" }).click();
    expect(await page.evaluate(() => window.domGuide.sent)).toEqual([
      { type: "setState", key: "reason", value: "saved" },
    ]);
    expect(await page.evaluate(() => window.domGuide.element())).toEqual({ text: "Inbox", disposed: true });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
}, 30000);
