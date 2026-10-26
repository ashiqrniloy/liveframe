import { afterAll, beforeAll, expect, test } from "bun:test";
import { type Browser, chromium } from "playwright";
import { startHost } from "../server.ts";
import { cleanup, client, find, type Host, hello, offeredIntent, tempDir } from "./host.ts";

let dir: string;
let host: Host;
let browser: Browser;
beforeAll(async () => {
  dir = await tempDir();
  host = await startHost({ dataDir: dir, port: 0 });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  await host?.stop();
  await cleanup(dir);
});

// Plan 010 F1: a dialog that arrives already open must mount in the scoped portal, with the page behind it inert,
// and Escape must raise its close intent.
test("initially_open_dialog_is_dismissable", async () => {
  const api = client(host);
  await api.install(await hello());
  await api.place("open", { name: "Ada" });
  const closed = await api.surface("open");
  await api.intent("open", offeredIntent(closed, "root/help", "onPress"));
  expect(find((await api.surface("open")).tree.root, "root/dialog")?.props).toMatchObject({ open: true });

  const page = await browser.newPage();
  try {
    await page.goto(new URL("/?placement=open", host.url).href);
    const dialog = page.getByRole("dialog", { name: "Help" });
    await dialog.waitFor({ state: "visible", timeout: 15000 });
    const hidden = "[inert], [aria-hidden='true']";
    expect(await dialog.evaluate((element, selector) => !!element.closest(selector), hidden)).toBe(false);
    const background = page.locator("#app > div:not([data-lf-portal])");
    expect(await background.evaluate((element, selector) => !!element.closest(selector), hidden)).toBe(true);

    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached", timeout: 15000 });
    // The close intent reaches the host, which stores the new state.
    const isOpen = async () => find((await api.surface("open")).tree.root, "root/dialog")?.props.open;
    for (let attempt = 0; attempt < 50 && (await isOpen()) !== false; attempt++) await Bun.sleep(100);
    expect(await isOpen()).toBe(false);
  } finally {
    await page.close();
  }
}, 60000);
