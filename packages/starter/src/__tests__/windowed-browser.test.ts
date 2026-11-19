import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import type { Intent } from "@arnilo/liveframe";
import type { Browser, Page } from "playwright";
import { browserName, launchBrowser } from "../../../../src/__tests__/fixtures/browser.ts";
import { styles } from "../styles.ts";
import { TOTAL, windowTree } from "./windowed.tsx";

// The windowed list in a real engine: the host loop is the test, which renders a tree for each range the page reports.
const ROW = 36; // `size.row` in the starter design system.

let server: Bun.Server<undefined>;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  const build = await Bun.build({
    entrypoints: [new URL("./windowed-client.tsx", import.meta.url).pathname],
    target: "browser",
    conditions: ["liveframe:source"],
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
  });
  const [bundle] = build.outputs;
  if (!build.success || !bundle) throw new AggregateError(build.logs, "Windowed page build failed");
  const sheets = Object.values(styles()).join("\n");
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) =>
      new URL(request.url).pathname === "/client.js"
        ? new Response(bundle, { headers: { "Content-Type": "text/javascript" } })
        : new Response(
            `<!doctype html><html lang="en"><head><title>Windowed</title><style>${sheets}</style></head><body><script type="module" src="/client.js"></script></body></html>`,
            { headers: { "Content-Type": "text/html" } },
          ),
  });
  browser = await launchBrowser();
}, 60000);
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});
beforeEach(async () => {
  await page?.close();
  page = await browser.newPage();
  await page.goto(server.url.href);
  await page.waitForFunction(() => !!window.windowed);
});

let revision = 0;
const show = (start: number, end: number) =>
  page.evaluate((json) => window.windowed.update(json), JSON.stringify(windowTree({ start, end }, ++revision)));
const viewport = () => page.getByRole("region", { name: "Rows" });
const scrollToRow = (row: number) =>
  viewport().evaluate((element, top) => {
    element.scrollTop = top;
  }, row * ROW);
/** Waits for the next range the page reports and returns it. */
async function nextRange(seen: number) {
  await page.waitForFunction((count) => window.windowed.intents.length > count, seen);
  const intents = (await page.evaluate(() => window.windowed.intents)) as Intent[];
  const intent = intents[seen];
  if (intent?.type !== "setState" || intent.key !== "range") throw new Error(`Unexpected ${JSON.stringify(intent)}`);
  return intent.value as { start: number; end: number };
}

test(`windowed_list_reserves_space_through_the_primitive (${browserName})`, async () => {
  await show(0, 0);
  const space = () =>
    viewport().evaluate((element) => ({
      height: element.scrollHeight,
      rows: element.querySelectorAll("button").length,
    }));
  expect(await space()).toEqual({ height: TOTAL * ROW, rows: 60 });
  // A window in the middle reserves the rows before and after it; the total does not change.
  await show(25_000, 25_010);
  expect(await space()).toEqual({ height: TOTAL * ROW, rows: 130 });
});

test(`rows_in_both_windows_keep_their_dom_nodes_and_focus (${browserName})`, async () => {
  await show(0, 0);
  // Near the end of the first slice: the page asks for the rows around 52–62 and the slice grows.
  await scrollToRow(52);
  const first = await nextRange(0);
  expect(first).toEqual({ start: 52, end: 62 });
  await show(first.start, first.end);
  // Further down the slice's edge comes near again; the next window drops rows 0–39.
  await scrollToRow(100);
  await page.getByRole("button", { name: "Open" }).nth(100).focus();
  await page.evaluate(() => {
    for (const [i, row] of document.querySelectorAll<HTMLElement>("section > div > *").entries())
      (row as HTMLElement & { mark?: number }).mark = i;
  });
  const second = await nextRange(1);
  expect(second).toEqual({ start: 100, end: 110 });
  await show(second.start, second.end);
  const kept = await page.evaluate(() => {
    const rows = [...document.querySelectorAll<HTMLElement & { mark?: number }>("section > div > *")];
    return {
      first: rows[0]?.textContent,
      marks: rows.map((row) => row.mark ?? -1),
      focused: document.activeElement?.closest("section > div > *")?.textContent,
    };
  });
  expect(kept.first).toBe("Row 40Open");
  // Rows 40–121 were drawn before and keep their elements; rows 122–169 are new.
  expect(kept.marks).toEqual([...Array.from({ length: 82 }, (_, i) => 40 + i), ...Array(48).fill(-1)]);
  expect(kept.focused).toBe("Row 100Open");
});

test(`scroll_position_is_stable_across_a_range_change (${browserName})`, async () => {
  await show(0, 0);
  await scrollToRow(52);
  const first = await nextRange(0);
  await show(first.start, first.end);
  await scrollToRow(100);
  const offset = () =>
    page.evaluate(() => {
      const view = document.querySelector("section");
      const row = [...document.querySelectorAll("section > div > *")].find(
        (element) => element.textContent === "Row 100Open",
      );
      if (!view || !row) throw new Error("Missing row 100");
      return { top: row.getBoundingClientRect().top - view.getBoundingClientRect().top, scrollTop: view.scrollTop };
    });
  const before = await offset();
  const range = await nextRange(1);
  await show(range.start, range.end);
  // Forty rows left above the visible ones; the padding that replaced them keeps row 100 where it was.
  const after = await offset();
  expect(Math.abs(after.top - before.top)).toBeLessThan(1);
  expect(after.scrollTop).toBe(before.scrollTop);
});
