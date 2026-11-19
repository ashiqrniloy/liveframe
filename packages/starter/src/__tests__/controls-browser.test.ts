import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import type { Intent, UiNode } from "@arnilo/liveframe";
import type { Browser, Page } from "playwright";
import { browserName, launchBrowser } from "../../../../src/__tests__/fixtures/browser.ts";
import { styles } from "../styles.ts";
import { tree } from "./host.ts";

// The 0.4 controls in a real engine: each raises one complete intent of its carried type, and bad input draws safely.
let server: Bun.Server<undefined>;
let browser: Browser;
let page: Page;
beforeAll(async () => {
  const build = await Bun.build({
    entrypoints: [new URL("./controls-client.tsx", import.meta.url).pathname],
    target: "browser",
    conditions: ["liveframe:source"],
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
  });
  const [bundle] = build.outputs;
  if (!build.success || !bundle) throw new AggregateError(build.logs, "Controls page build failed");
  const sheets = Object.values(styles()).join("\n");
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) =>
      new URL(request.url).pathname === "/client.js"
        ? new Response(bundle, { headers: { "Content-Type": "text/javascript" } })
        : new Response(
            `<!doctype html><html lang="en"><head><title>Controls</title><style>${sheets}</style></head><body><script type="module" src="/client.js"></script></body></html>`,
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
  page.setDefaultTimeout(5000);
  await page.goto(server.url.href);
  await page.waitForFunction(() => !!window.controls);
});

const show = (...children: UiNode[]) =>
  page.evaluate(
    (json) => window.controls.mount(json),
    JSON.stringify(tree("controls", { id: "root", kind: "stack", props: {}, children })),
  );
const intents = () => page.evaluate(() => window.controls.intents) as Promise<Intent[]>;
const setState = (key: string) => ({ onChange: { type: "setState" as const, key } });
const radios: UiNode = {
  id: "root/radios",
  kind: "radioGroup",
  props: { label: "Priority", value: "low" },
  events: setState("priority"),
  children: [
    { id: "root/radios/low", kind: "radio", props: { label: "Low", value: "low" } },
    { id: "root/radios/high", kind: "radio", props: { label: "High", value: "high" } },
  ],
};

test(`each_new_control_raises_one_complete_intent (${browserName})`, async () => {
  await show(radios);
  // React Aria hides the native input; a user clicks the label.
  await page.getByText("High", { exact: true }).click();
  expect(await intents()).toEqual([{ type: "setState", key: "priority", value: "high" }]);

  // A key step ends a change at once; a drag would raise only where it is released.
  await show({ id: "root/level", kind: "slider", props: { label: "Level", value: 40 }, events: setState("level") });
  await page.getByRole("slider", { name: "Level" }).focus();
  await page.keyboard.press("ArrowRight");
  expect(await intents()).toEqual([{ type: "setState", key: "level", value: 41 }]);

  await show({
    id: "root/due",
    kind: "dateField",
    props: { label: "Due", value: "2026-11-19" },
    events: setState("due"),
  });
  const day = page.getByRole("spinbutton", { name: /day/i });
  await day.focus();
  await page.keyboard.press("ArrowUp");
  expect(await intents()).toEqual([{ type: "setState", key: "due", value: "2026-11-20" }]);
  // Clearing every segment raises the empty string. On the way, only complete dates were raised, never a partial one.
  for (const name of [/day/i, /month/i, /year/i])
    for (let i = 0; i < 4; i++) await page.getByRole("spinbutton", { name }).press("Backspace");
  const raised = (await intents()).map((intent) => (intent.type === "setState" ? intent.value : undefined));
  expect(raised.at(-1)).toBe("");
  for (const value of raised) expect(value).toMatch(/^(\d{4}-\d{2}-\d{2})?$/);

  // Progress raises nothing and exposes its value.
  await show({ id: "root/upload", kind: "progress", props: { label: "Upload", value: 30 } });
  expect(await page.getByRole("progressbar", { name: "Upload" }).getAttribute("aria-valuenow")).toBe("30");
});

test(`slider_with_inverted_bounds_clamps (${browserName})`, async () => {
  await show({ id: "root/level", kind: "slider", props: { label: "Level", minimum: 50, maximum: 10, value: 80 } });
  const slider = page.getByRole("slider", { name: "Level" });
  // A native range input: its value is the drawn value.
  expect(await slider.inputValue()).toBe("50");
  expect(await slider.isDisabled()).toBe(true);
  // A value outside a valid range is clamped too.
  await show({ id: "root/level", kind: "slider", props: { label: "Level", minimum: 0, maximum: 10, value: 80 } });
  expect(await page.getByRole("slider", { name: "Level" }).inputValue()).toBe("10");
});

test(`date_field_impossible_date_draws_empty (${browserName})`, async () => {
  // `2026-02-30` passes the catalog pattern but names no day.
  await show({ id: "root/due", kind: "dateField", props: { label: "Due", value: "2026-02-30" } });
  const segments = page.locator(".lf_dateField_default_segment[role=spinbutton]");
  expect(await segments.count()).toBe(3);
  for (const segment of await segments.all()) expect(await segment.getAttribute("data-placeholder")).not.toBeNull();
});

test(`stray_radio_is_contained (${browserName})`, async () => {
  page.on("pageerror", () => {});
  await show(
    { id: "root/text", kind: "text", props: { text: "Beside" } },
    { id: "root/stray", kind: "radio", props: { label: "Stray", value: "stray" } },
  );
  // The node's error boundary draws the fallback in its place; the rest of the surface stays.
  await page.getByText("Unavailable").waitFor();
  expect(await page.getByText("Beside").isVisible()).toBe(true);
  expect(await page.getByRole("radio").count()).toBe(0);
});
