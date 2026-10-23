import { afterAll, beforeAll, expect, test } from "bun:test";
import { type Browser, chromium } from "playwright";

let server: ReturnType<typeof Bun.serve>;
let browser: Browser;
beforeAll(async () => {
  const build = await Bun.build({
    entrypoints: [new URL("./fixtures/react-client.tsx", import.meta.url).pathname],
    target: "browser",
  });
  if (!build.success) throw new AggregateError(build.logs);
  const output = build.outputs[0];
  if (!output) throw new Error("Missing bundle");
  const bundle = await output.text();
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (request) =>
      new URL(request.url).pathname === "/client.js"
        ? new Response(bundle, { headers: { "Content-Type": "text/javascript" } })
        : new Response(
            '<!doctype html><html lang="en"><head><title>Surface tests</title></head><body><div id="app"></div><script type="module" src="/client.js"></script></body></html>',
            { headers: { "Content-Type": "text/html" } },
          ),
  });
  browser = await chromium.launch({ headless: true });
}, 30000);
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});

test("stale_revision_is_ignored_and_new_surface_replaces", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(server.url.href);
    await page.waitForSelector("button");
    await page.locator("button").click();
    await page.evaluate(() => window.surfaceTest.update(window.surfaceTest.tree(5)));
    expect(await page.locator("#app").textContent()).toContain("Revision 5");
    expect(await page.locator("button").textContent()).toContain("Counter 1");
    expect(await page.locator("button").evaluate((el) => el === document.activeElement)).toBe(true);
    await page.evaluate(() => {
      const next = window.surfaceTest.tree(5);
      window.surfaceTest.update({
        ...next,
        root: { ...next.root, children: [...(next.root.children ?? [])].reverse() },
      });
    });
    expect(await page.locator("button").textContent()).toContain("Counter 1");
    expect(await page.locator("button").evaluate((el) => el === document.activeElement)).toBe(true);
    await page.evaluate(() => window.surfaceTest.update(window.surfaceTest.tree(2)));
    expect(await page.locator("#app").textContent()).toContain("Revision 5");
    await page.evaluate(() => window.surfaceTest.update({ ...window.surfaceTest.tree(1), catalogId: "bad.ui@1" }));
    expect(await page.locator("#app").textContent()).toBe("Unavailable");
    await page.evaluate(() => window.surfaceTest.update(window.surfaceTest.tree(2)));
    expect(await page.locator("#app").textContent()).toContain("Revision 5");
    await page.evaluate(() => window.surfaceTest.update(window.surfaceTest.tree(0, "other")));
    expect(await page.locator("#app").textContent()).toContain("Revision 0");
    expect(await page.locator("button").textContent()).toContain("Counter 0");
  } finally {
    await page.close();
  }
});

test("validator_runs_once_per_tree", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(server.url.href);
    await page.waitForSelector("button");
    expect(await page.evaluate(() => window.surfaceTest.checks())).toBe(1);
    expect(await page.locator("[data-portal=mounted]").count()).toBe(2);
    await page.evaluate(() => {
      window.surfaceTest.redraw();
      window.surfaceTest.redraw();
    });
    expect(await page.evaluate(() => window.surfaceTest.checks())).toBe(1);
    await page.evaluate(() => window.surfaceTest.update(window.surfaceTest.tree(2)));
    expect(await page.evaluate(() => window.surfaceTest.checks())).toBe(2);
    await page.evaluate(() => window.surfaceTest.replaceValidator());
    expect(await page.evaluate(() => window.surfaceTest.checks())).toBe(3);
  } finally {
    await page.close();
  }
});

test("throwing_implementation_falls_back_at_that_node", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(server.url.href);
    await page.waitForSelector("button");
    for (const text of ["throw", "bad-slot"]) {
      await page.evaluate((text) => {
        const next = window.surfaceTest.tree(4);
        window.surfaceTest.update({
          ...next,
          root: {
            ...next.root,
            children: [{ id: "root/first", kind: "text", props: { text } }, ...(next.root.children?.slice(1) ?? [])],
          },
        });
      }, text);
      expect(await page.locator("#app p").textContent()).toBe("Unavailable");
      expect(await page.locator("button").count()).toBe(1);
      await page.evaluate(() => window.surfaceTest.update(window.surfaceTest.tree(4)));
      expect(await page.locator("#app").textContent()).toContain("Revision 4");
    }
  } finally {
    await page.close();
  }
});
