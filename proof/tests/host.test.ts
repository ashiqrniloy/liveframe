import { afterAll, beforeAll, expect, test } from "bun:test";
import { type Browser, chromium } from "playwright";
import { startHost } from "../host/server.ts";
import { createSurface } from "../host/state.ts";
import { harnessActions, harnessInputs, harnessOptions, harnessWidget } from "../widgets/harness.tsx";

const surface = () => createSurface(harnessWidget, harnessInputs, harnessOptions, harnessActions);

test("set_state_reruns_widget_and_returns_new_tree", () => {
  const session = surface();
  const initial = session.snapshot();
  const next = session.dispatch(initial.tree.revision, { type: "setState", key: "selected", value: "task:1" });
  expect(next.tree.revision).toBe(initial.tree.revision + 1);
  expect(JSON.stringify(next.tree)).toContain("Selected: task:1");
  expect(initial.tree.revision).toBe(1);
  expect(surface().snapshot().tree.surfaceId).not.toBe(next.tree.surfaceId);
  expect(JSON.stringify(surface().snapshot().tree)).toContain("Selected: task:0");
});

test("action_is_logged_and_never_rerenders_by_itself", () => {
  const session = surface();
  const initial = session.snapshot();
  const next = session.dispatch(1, { type: "action", name: "tasks.claim", args: { id: "task:0" } });
  expect(next.tree).toBe(initial.tree);
  expect(next.actions).toEqual([{ type: "action", name: "tasks.claim", args: { id: "task:0" } }]);
  expect(initial.actions).toEqual([]);
});

test("dispatch_rechecks_state_actions_current_tree_and_revision", () => {
  const session = surface();
  for (const intent of [
    { type: "setState", key: "unknown", value: "x" },
    { type: "setState", key: "selected", value: 3 },
    { type: "setState", key: "selected", value: "unoffered" },
    { type: "setState", key: "query", value: "x".repeat(101) },
    { type: "setState", key: "query", value: "x", extra: true },
    { type: "action", name: "shell.exec", args: {} },
    { type: "action", name: "tasks.claim", args: { id: 1 } },
    { type: "action", name: "tasks.claim", args: { id: "not-rendered" } },
    { type: "action", name: "tasks.claim", args: { id: "task:0", extra: true } },
    null,
  ])
    expect(() => session.dispatch(1, intent)).toThrow();
  expect(() => session.dispatch(0, { type: "setState", key: "query", value: "ok" })).toThrow("revision");
  expect(session.snapshot().tree.revision).toBe(1);
  expect(session.snapshot().actions).toEqual([]);
  const next = session.dispatch(1, { type: "setState", key: "query", value: "committed" });
  expect(JSON.stringify(next.tree)).toContain("committed");
});

test("failed_rerender_rolls_back_state_and_action_schemas_are_checked", () => {
  const widget = (props: Parameters<typeof harnessWidget>[0]): unknown =>
    props.state.query === "fail" ? null : harnessWidget(props);
  const session = createSurface(widget, harnessInputs, harnessOptions, harnessActions);
  expect(() => session.dispatch(1, { type: "setState", key: "query", value: "fail" })).toThrow();
  expect(session.snapshot().tree.revision).toBe(1);
  const next = session.dispatch(1, { type: "setState", key: "selected", value: "task:1" });
  expect(next.tree.root.children?.find((node) => node.kind === "textField")?.props.value).toBe("");
  const restricted = createSurface(harnessWidget, harnessInputs, harnessOptions, {
    "tasks.claim": { type: "object", properties: {}, required: [], additionalProperties: false },
  });
  expect(() => restricted.dispatch(1, { type: "action", name: "tasks.claim", args: { id: "task:0" } })).toThrow();
  expect(restricted.snapshot().actions).toEqual([]);
});

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

async function openSurface(path = "harness") {
  const html = await (await fetch(new URL(`/ui/${path}`, server.url))).text();
  const json = html.match(/<script type="application\/json" id="bootstrap">(.*?)<\/script>/s)?.[1];
  if (!json) throw new Error("Missing bootstrap");
  return JSON.parse(json) as ReturnType<ReturnType<typeof surface>["snapshot"]>;
}
const post = (body: unknown, origin?: string) =>
  fetch(new URL("/intent", server.url), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  });

test("host_serves_reference_pages_and_rejects_invalid_requests", async () => {
  for (const name of ["agent-home", "core-queue", "git-status", "rack-module", "design-system", "harness"]) {
    expect((await openSurface(name)).tree.revision).toBe(1);
  }
  expect((await fetch(new URL("/ui/missing", server.url))).status).toBe(404);
  expect((await fetch(new URL("/ui/core-queue?size=huge", server.url))).status).toBe(400);
  for (const [path, bytes] of [
    ["/fonts/schibsted-grotesk/latin-wght-normal.woff2", 46752],
    ["/fonts/martian-mono/latin-wdth-normal.woff2", 38492],
  ] as const) {
    const response = await fetch(new URL(path, server.url));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("font/woff2");
    expect((await response.arrayBuffer()).byteLength).toBe(bytes);
  }
  expect((await fetch(new URL("/fonts/../SOURCES.md", server.url))).status).toBe(404);
  const page = await (await fetch(new URL("/ui/agent-home", server.url))).text();
  expect(page).toContain('font-family: "Schibsted Grotesk"');
  expect(page).toContain("font-stretch: 75% 112.5%");
  const first = await openSurface();
  const second = await openSurface();
  const body = {
    surfaceId: first.tree.surfaceId,
    revision: 1,
    intent: { type: "setState", key: "query", value: "first" },
  };
  expect((await post(body, "https://example.com")).status).toBe(403);
  expect((await post({ ...body, surfaceId: "missing" })).status).toBe(404);
  expect((await post({ ...body, extra: true })).status).toBe(400);
  const next = await (await post(body)).json();
  expect(next.tree.revision).toBe(2);
  expect((await post(body)).status).toBe(409);
  expect((await post({ ...body, surfaceId: second.tree.surfaceId })).status).toBe(200);
  const bundle = await (await fetch(new URL("/client.js", server.url))).text();
  expect(bundle).not.toContain("harnessWidget");
  expect(bundle).not.toContain("Bun.serve");
});

test("browser_hydrates_posts_intents_logs_actions_and_switches_styles", async () => {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  try {
    await page.goto(new URL("/ui/harness", server.url).toString());
    await page.waitForFunction(() => document.documentElement.dataset.ready === "true");
    let posts = 0;
    page.on("request", (request) => {
      if (request.method() === "POST") posts++;
    });
    const query = page.getByRole("textbox", { name: "Query" });
    await query.fill("local draft");
    expect(posts).toBe(0);
    const roundTrip = page.waitForResponse((response) => response.url().endsWith("/intent"));
    await page.getByRole("button", { name: "Select task:1", exact: true }).click();
    expect((await roundTrip).ok()).toBe(true);
    await page.getByText("Selected: task:1", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Claim task:0", exact: true }).click();
    await page.waitForFunction(() => document.getElementById("actions")?.textContent?.includes("tasks.claim"));
    const button = page.getByRole("button", { name: "Claim task:0", exact: true });
    const before = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.getByLabel("Design system").focus();
    await page.mouse.move(0, 0);
    const dom = await page.locator("#app").innerHTML();
    const postCount = posts;
    await page.getByLabel("Design system").selectOption("rack");
    await page.waitForFunction((colour) => {
      const el = document.querySelector(".lf-button-primary-root-rest");
      return el && getComputedStyle(el).backgroundColor !== colour;
    }, before);
    expect(await page.locator("#app").innerHTML()).toBe(dom);
    expect(posts).toBe(postCount);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
}, 20000);

test("set_state_http_round_trip_under_50_ms", async () => {
  const initial = await openSurface();
  let revision = initial.tree.revision;
  const samples: number[] = [];
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    const response = await post({
      surfaceId: initial.tree.surfaceId,
      revision,
      intent: { type: "setState", key: "selected", value: `task:${i % 50}` },
    });
    const next = await response.json();
    expect(response.status).toBe(200);
    revision = next.tree.revision;
    if (i >= 5) samples.push(performance.now() - start);
  }
  const max = Math.max(...samples);
  console.log(`host setState: ${max.toFixed(2)} ms max (${samples.length} local HTTP round trips, 50 rows)`);
  expect(max).toBeLessThan(50);
});
