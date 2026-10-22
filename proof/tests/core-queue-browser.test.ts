import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { startHost } from "../host/server.ts";

test("core_queue_sizes_hydrate_with_specimen_caps_and_live_selection", async () => {
  const server = await startHost(0);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(5000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  try {
    for (const [size, cap] of [
      ["small", "336px"],
      ["medium", "576px"],
      ["large", "864px"],
      ["full", "100%"],
    ] as const) {
      await page.goto(new URL(`/ui/core-queue?size=${size}`, server.url).toString());
      await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
      expect(await page.locator("#app").evaluate((el) => getComputedStyle(el).maxWidth)).toBe(cap);
      expect(await page.getByRole("tablist").count()).toBe(size === "full" ? 1 : 0);
      if (size === "small") {
        await page.getByText("Current page · not a queue total", { exact: true }).waitFor();
        continue;
      }
      const response = page.waitForResponse((response) => response.url().endsWith("/intent"));
      // The full size is the agent-home queue, whose pager reads "Next".
      await page.getByRole("button", { name: size === "full" ? "Next" : "Load more", exact: true }).click();
      expect((await response).ok()).toBe(true);
      const title = "Approve the revised supplier terms";
      await page.getByRole("button", { name: title, exact: true }).waitFor();
      const selected = page.waitForResponse((response) => response.url().endsWith("/intent"));
      await page.getByRole("button", { name: title, exact: true }).click();
      expect((await selected).ok()).toBe(true);
      if (size === "large" || size === "full") {
        await page.getByRole("heading", { name: title, exact: true }).waitFor();
        const action = page.waitForResponse((response) => response.url().endsWith("/intent"));
        await page.getByRole("button", { name: "Review and decide", exact: true }).click();
        expect((await action).ok()).toBe(true);
        await page.waitForFunction(() => document.getElementById("actions")?.textContent?.includes("decisions.review"));
      }
    }
    const bundle = await (await fetch(new URL("/client.js", server.url))).text();
    expect(bundle).not.toContain("CoreQueue");
    expect(bundle).not.toContain("DecisionCard");
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await server.stop(true);
  }
}, 30000);
