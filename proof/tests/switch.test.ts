import { afterAll, beforeAll, expect, test } from "bun:test";
import { type Browser, chromium } from "playwright";
import { openPage } from "../host/pages.ts";
import { startHost } from "../host/server.ts";

let server: Awaited<ReturnType<typeof startHost>>;
let browser: Browser;
beforeAll(async () => {
  server = await startHost(0);
  browser = await chromium.launch({ headless: true });
}, 30000);
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});

test("design_system_page_uses_the_unchanged_reference_queue", () => {
  expect(openPage("full", "design-system").snapshot().tree.root).toEqual(
    openPage("full", "agent-home").snapshot().tree.root,
  );
});

for (const name of ["agent-home", "git-status"]) {
  test(`switch_changes_computed_styles_not_dom_structure: ${name}`, async () => {
    const sources = new Bun.Glob("proof/widgets/**/*.{ts,tsx}");
    const hashes = new Map<string, string>();
    for await (const path of sources.scan(".")) hashes.set(path, Bun.hash(await Bun.file(path).text()).toString());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    try {
      await page.goto(new URL(`/ui/${name}`, server.url).toString());
      await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
      if (name === "agent-home") {
        const title = "Reassign the Hansen delivery milestone";
        await page.getByRole("button", { name: title, exact: true }).click();
        await page.getByRole("heading", { name: title, exact: true }).waitFor();
        await page.getByRole("button", { name: "Claim", exact: true }).focus();
      }
      await page.mouse.move(0, 0);
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      const requests: string[] = [];
      page.on("request", (request) => requests.push(`${request.method()} ${request.url()}`));
      const result = await page.evaluate(async () => {
        const app = document.getElementById("app");
        const select = document.getElementById("design-system");
        const heading = app?.querySelector("h2");
        if (!app || !heading || !(select instanceof HTMLSelectElement)) throw new Error("Missing reference UI");
        const html = app.innerHTML;
        const nodes = Array.from(app.querySelectorAll("*"));
        const focus = document.activeElement;
        const bootstrap = document.getElementById("bootstrap")?.textContent;
        const mutations: MutationRecord[] = [];
        const observer = new MutationObserver((records) => mutations.push(...records));
        observer.observe(app, { subtree: true, childList: true, attributes: true, characterData: true });
        const samples: number[] = [];
        const styles: Record<string, string> = {};
        let immediate = true;
        for (let i = 0; i < 10; i++) {
          const target = select.value === "certified" ? "rack" : "certified";
          const before = getComputedStyle(heading).fontSize;
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => {
              const start = performance.now();
              select.value = target;
              select.dispatchEvent(new Event("change", { bubbles: true }));
              const after = getComputedStyle(heading).fontSize;
              samples.push(performance.now() - start);
              styles[target] = after;
              immediate &&= before !== after;
              requestAnimationFrame(() => {
                immediate &&= getComputedStyle(heading).fontSize === after;
                resolve();
              });
            }),
          );
        }
        observer.disconnect();
        const after = Array.from(app.querySelectorAll("*"));
        return {
          samples,
          styles,
          immediate,
          sameMarkup: app.innerHTML === html,
          sameNodes: nodes.length === after.length && nodes.every((node, i) => node === after[i]),
          sameFocus: document.activeElement === focus,
          sameTree: document.getElementById("bootstrap")?.textContent === bootstrap,
          mutations: mutations.length,
        };
      });
      expect(result.styles).toEqual({ certified: "24.192px", rack: "18px" });
      expect(result.immediate).toBe(true);
      expect(result.sameMarkup).toBe(true);
      expect(result.sameNodes).toBe(true);
      expect(result.sameFocus).toBe(true);
      expect(result.sameTree).toBe(true);
      expect(result.mutations).toBe(0);
      expect(requests).toEqual([]);
      const max = Math.max(...result.samples);
      console.log(
        `${name} CSS switch: ${max.toFixed(2)} ms max (${result.samples.length} switches, 16.67 ms frame budget)`,
      );
      expect(max).toBeLessThan(1000 / 60);
      for (const [path, hash] of hashes) expect(Bun.hash(await Bun.file(path).text()).toString()).toBe(hash);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  }, 20000);
}
