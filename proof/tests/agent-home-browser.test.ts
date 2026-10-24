import { afterAll, beforeAll, expect, test } from "bun:test";
import { type Browser, chromium, type Page, type Request } from "playwright";
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
const posted = async (page: Page, action: () => Promise<unknown>) => {
  const requests: Request[] = [];
  const record = (request: Request) => {
    if (new URL(request.url()).pathname === "/intent") requests.push(request);
  };
  page.on("request", record);
  const response = page.waitForResponse((response) => response.url().endsWith("/intent"));
  await action();
  const received = await response;
  expect(received.ok()).toBe(true);
  const request = received.request().postDataJSON();
  const result = await received.json();
  expect(result.tree.revision).toBe(request.revision + (request.intent.type === "setState" ? 1 : 0));
  if (request.intent.type === "action") expect(result.actions.at(-1)).toEqual(request.intent);
  page.off("request", record);
  expect(requests).toHaveLength(1);
};

for (const system of ["certified", "rack"])
  test(`agent_home_hydrates_selects_filters_pages_and_dispatches_card_controls_${system}`, async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    try {
      await page.goto(new URL("/ui/agent-home", server.url).toString());
      await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
      await page
        .getByRole("heading", { name: "Apply the vendor's revised delivery week to PO-1188", exact: true })
        .waitFor();
      await page.getByLabel("Design system").selectOption(system);
      const requests: unknown[] = [];
      page.on("request", (request) => {
        if (new URL(request.url()).pathname === "/intent") requests.push(request.postDataJSON());
      });
      const taskTitle = "Reassign the Hansen delivery milestone";
      await posted(page, () => page.getByRole("button", { name: taskTitle, exact: true }).click());
      await page.getByRole("heading", { name: taskTitle, exact: true }).waitFor();
      await posted(page, () => page.getByRole("button", { name: "Claim", exact: true }).click());
      await posted(page, () => page.getByRole("button", { name: "Escalate…", exact: true }).click());
      const dialog = page.getByRole("dialog", { name: "Escalate this task?" });
      await dialog.waitFor();
      expect(await dialog.getByRole("button", { name: "Escalate", exact: true }).isDisabled()).toBe(true);
      let posts = 0;
      page.on("request", (request) => {
        if (request.method() === "POST") posts++;
      });
      await dialog.getByRole("textbox", { name: "Reason" }).fill("Needs the portfolio owner.");
      expect(posts).toBe(0);
      await posted(page, () => dialog.getByRole("textbox", { name: "Reason" }).press("Tab"));
      const escalate = dialog.getByRole("button", { name: "Escalate", exact: true });
      await page.waitForFunction(() =>
        [...document.querySelectorAll("button")].some(
          (button) => button.textContent === "Escalate" && !button.disabled,
        ),
      );
      await posted(page, () => escalate.click());
      await posted(page, () => dialog.getByRole("button", { name: "Cancel", exact: true }).click());
      await dialog.waitFor({ state: "hidden" });
      await posted(page, () =>
        page.getByRole("button", { name: "Invoice INV-2099-438 was refused by the provider", exact: true }).click(),
      );
      await page.getByRole("button", { name: "Acknowledge", exact: true }).waitFor();
      await posted(page, () => page.getByRole("button", { name: "Acknowledge", exact: true }).click());
      const previous = posts;
      await page.getByRole("button", { name: "Snooze", exact: true }).click();
      await page.getByRole("menuitem", { name: "For 1 hour", exact: true }).waitFor();
      expect(posts).toBe(previous);
      await posted(page, () => page.getByRole("menuitem", { name: "For 1 hour", exact: true }).click());
      await posted(page, () => page.getByRole("button", { name: "Convert to task", exact: true }).click());
      await posted(page, () => page.getByRole("tab", { name: "Tasks 4", exact: true }).click());
      await page.getByRole("button", { name: "Claim", exact: true }).waitFor();
      expect(await page.getByRole("button", { name: "Acknowledge", exact: true }).count()).toBe(0);
      await posted(page, () => page.getByRole("button", { name: "Next", exact: true }).click());
      await page.getByText("Showing 4", { exact: true }).waitFor();
      await posted(page, () => page.getByRole("button", { name: "Next", exact: true }).click());
      expect(
        await page.getByRole("button", { name: "Reassign the Hansen delivery milestone", exact: false }).count(),
      ).toBeGreaterThan(0);
      expect(await page.getByRole("button", { name: "Next", exact: true }).count()).toBe(0);
      expect(requests).toHaveLength(13);
      const actions = JSON.parse((await page.locator("#actions").textContent()) ?? "null");
      expect(actions).toEqual([
        { type: "action", name: "tasks.claim", args: { id: "task-5531" } },
        { type: "action", name: "tasks.escalate", args: { id: "task-5531", reason: "Needs the portfolio owner." } },
        { type: "action", name: "alerts.acknowledge", args: { id: "alert-7302" } },
        { type: "action", name: "alerts.snooze", args: { id: "alert-7302", duration: "hour" } },
        { type: "action", name: "alerts.convert", args: { id: "alert-7302" } },
      ]);
      const bundle = await (await fetch(new URL("/client.js", server.url))).text();
      expect(bundle).not.toContain("AgentHomeQueue");
      expect(bundle).not.toContain("TaskCard");
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  }, 30000);

test("agent_home_scenarios_are_reachable_and_readonly_hides_actions", async () => {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  try {
    for (const [scenario, text] of [
      ["loading", "Loading"],
      ["empty", "Nothing else waits on you"],
      ["failed", "The queue did not load"],
    ] as const) {
      await page.goto(new URL(`/ui/agent-home?scenario=${scenario}`, server.url).toString());
      await page.getByRole("heading", { name: text, exact: true }).waitFor();
    }
    await posted(page, () => page.getByRole("button", { name: "Retry the queue" }).click());
    await page.goto(new URL("/ui/agent-home?scenario=read-only", server.url).toString());
    await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
    await posted(page, () =>
      page.getByRole("button", { name: "Reassign the Hansen delivery milestone", exact: true }).click(),
    );
    await page.getByRole("heading", { name: "Reassign the Hansen delivery milestone", exact: true }).waitFor();
    expect(await page.getByRole("button", { name: "Claim", exact: true }).count()).toBe(0);
    expect(await page.getByRole("button", { name: "Escalate…", exact: true }).count()).toBe(0);
    expect((await fetch(new URL("/ui/agent-home?scenario=unknown", server.url))).status).toBe(400);
  } finally {
    await page.close();
  }
}, 20000);
