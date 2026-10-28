import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Preview } from "@arnilo/liveframe/preview/react";
import { type Browser, chromium } from "playwright";
import { renderToString } from "react-dom/server";
import { baseCss, designSystemCss } from "../css/index.ts";
import { validateDesignSystem } from "../index.ts";
import { capture } from "../cli/capture.ts";
import designSystem from "./fixtures/proof/certified.design-system.json" with { type: "json" };
import { catalog, identity, renderer, surfaceProps, tree } from "./fixtures/react-surface.tsx";

const props = {
  ...surfaceProps,
  scenarios: ["ready", "empty"],
  widths: [360, 768],
  themes: [identity, { id: "rack", version: "1.0.0" }],
  designSystems: [identity],
  renderer: renderer(),
  result: { ok: true, value: tree() } as const,
  resultScenario: "ready",
  intents: [{ type: "action", name: "tasks.claim", args: { id: "one" } }] as const,
  onSelect: () => {},
} as const;

test("preview_draws_every_cell_as_sibling_surfaces", () => {
  const html = renderToString(<Preview {...props} />);
  expect(html.match(/data-lf-cell=/g)).toHaveLength(4);
  expect(html.match(/width:360px/g)).toHaveLength(2);
  expect(html.match(/width:768px/g)).toHaveLength(2);
  expect(html.match(/Revision 1/g)).toHaveLength(4);
  expect(html).not.toContain("data-lf-ready");
});

test("intent_log_lists_every_entry_and_initial_errors_show_fallback", () => {
  const html = renderToString(
    <Preview {...props} result={{ ok: false, errors: [{ kind: "invalid-prop", pointer: "/root", message: "Bad" }] }} />,
  );
  expect(html).toContain("tasks.claim");
  expect(html).toContain("/root");
  expect(html.match(/Unavailable/g)).toHaveLength(4);
  expect(html).not.toContain("last good render");
});

let browser: Browser;
let server: ReturnType<typeof Bun.serve>;
beforeAll(async () => {
  const build = await Bun.build({
    entrypoints: [new URL("./fixtures/preview-client.tsx", import.meta.url).pathname],
    target: "browser",
  });
  if (!build.success || !build.outputs[0]) throw new AggregateError(build.logs);
  const bundle = await build.outputs[0].text();
  const base = baseCss(catalog);
  const installed = validateDesignSystem(designSystem, { catalog, registry: {} });
  if (!installed.ok) throw new Error("Invalid test design system");
  const system = designSystemCss(installed.value, { catalog, registry: {} });
  if (!base.ok || !system.ok) throw new Error("Invalid test styles");
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (request) =>
      new URL(request.url).pathname === "/client.js"
        ? new Response(bundle, { headers: { "Content-Type": "text/javascript" } })
        : new Response(
            `<!doctype html><style>${base.value}${system.value}</style><div id="app"></div><script type="module" src="/client.js"></script>`,
            {
              headers: { "Content-Type": "text/html" },
            },
          ),
  });
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});

test("selected_cell_round_trips_through_the_url_and_intents_reach_host", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${server.url}?scenario=ready&width=768&theme=rack@1.0.0&keep=yes#anchor`);
    await page.waitForSelector("[data-lf-ready]");
    expect(await page.locator('select[aria-label="Scenario"]').inputValue()).toBe("ready");
    expect(
      JSON.parse((await page.locator('[data-lf-selected="true"]').getAttribute("data-lf-cell")) ?? "null"),
    ).toEqual({ scenario: "ready", width: 768, theme: "rack@1.0.0", designSystem: "certified@1.0.0" });
    await page.locator("[data-lf-cell] button[aria-pressed]").first().click();
    expect(new URL(page.url()).searchParams.get("width")).toBe("360");
    expect(new URL(page.url()).searchParams.get("keep")).toBe("yes");
    expect(new URL(page.url()).hash).toBe("#anchor");
    await page.getByRole("button", { name: "Counter 0" }).first().click();
    expect(await page.locator('[aria-label="Intent log"]').textContent()).toContain("committed");
    expect(JSON.parse((await page.locator("output").getAttribute("data-origin")) ?? "null")).toEqual({
      surfaceId: "test",
      revision: 1,
      nodeId: "root/second",
      event: "onPress",
    });
    await page.locator('select[aria-label="Scenario"]').selectOption("empty");
    await page.waitForSelector("[data-lf-ready]");
    expect(new URL(page.url()).searchParams.get("scenario")).toBe("empty");
  } finally {
    await page.close();
  }
});

test("errors_list_by_node_and_mark_the_last_good_tree", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(server.url.href);
    await page.waitForSelector("[data-lf-ready]");
    await page.getByRole("button", { name: "Fail render", exact: true }).click();
    expect(await page.locator('[data-lf-node="root/first"][data-lf-error]').count()).toBe(4);
    expect(await page.locator("[data-lf-cell]").first().textContent()).toContain("last good render");
    expect(await page.locator('[aria-label="Render errors"]').first().textContent()).toContain("/root/props/gap");
    await page.getByRole("button", { name: "Recover", exact: true }).click();
    expect(await page.locator("[data-lf-error]").count()).toBe(0);
    await page.locator('select[aria-label="Scenario"]').selectOption("empty");
    await page.waitForSelector("[data-lf-ready]");
    expect(await page.locator("[data-lf-cell]").first().textContent()).toContain("Unavailable");
    expect(await page.locator("[data-lf-cell]").first().textContent()).not.toContain("last good render");
  } finally {
    await page.close();
  }
});

test("retained_tree_still_passes_surface_arrival_validation", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(server.url.href);
    await page.waitForSelector("[data-lf-ready]");
    await page.getByRole("button", { name: "Fail render", exact: true }).click();
    await page.getByRole("button", { name: "Reject retained", exact: true }).click();
    expect(await page.locator("[data-lf-cell]").first().textContent()).toContain("Unavailable");
    expect(await page.locator("[data-lf-cell]").first().textContent()).not.toContain("Revision");
  } finally {
    await page.close();
  }
});

test("preview_axes_and_ready_are_published_for_capture_and_invalid_url_defaults", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${server.url}?scenario=missing&width=10&theme=no&designSystem=no`);
    await page.waitForSelector("[data-lf-ready]");
    expect(JSON.parse((await page.locator("[data-lf-preview]").getAttribute("data-lf-preview")) ?? "null")).toEqual({
      scenarios: ["ready", "empty"],
      widths: [360, 768],
      themes: ["certified@1.0.0", "rack@1.0.0"],
      designSystems: ["certified@1.0.0"],
    });
    expect(await page.locator("[data-lf-cell] [data-lf-cell]").count()).toBe(0);
    expect(new URL(page.url()).searchParams.get("scenario")).toBe("ready");
    expect(
      await page
        .locator("[data-lf-cell]")
        .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().width)),
    ).toEqual([360, 360, 768, 768]);
    const gaps = await page
      .locator("[data-lf-cell] .lf_stack_default_root")
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).gap));
    expect(gaps[0]).toBe(gaps[1]);
    expect(gaps[2]).toBe(gaps[3]);
    expect(gaps[0]).not.toBe(gaps[2]);
    expect(gaps).not.toContain("normal");
    expect(await page.locator('[data-portal="absent"]').count()).toBe(0);
  } finally {
    await page.close();
  }
});

test("controlled_preview_leaves_location_unchanged", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${server.url}?mode=controlled`);
    await page.waitForSelector("[data-lf-ready]");
    const published = JSON.parse((await page.locator("[data-lf-preview]").getAttribute("data-lf-preview")) ?? "null");
    expect(published.controlled).toBe(true);
    expect(published.urlKey).toBeUndefined();
    const before = page.url();
    const selected = () =>
      page.locator('[data-lf-selected="true"]').evaluate((el) => JSON.parse(el.getAttribute("data-lf-cell") ?? "null"));
    await page.locator("[data-lf-cell] > button").nth(2).click();
    await page.getByLabel("Scenario", { exact: true }).selectOption("empty");
    await page.waitForSelector("[data-lf-ready]");
    expect(page.url()).toBe(before);
    expect(await selected()).toEqual({
      scenario: "empty",
      width: 768,
      theme: "certified@1.0.0",
      designSystem: "certified@1.0.0",
    });
    // A coordinate the host owns but the axes do not declare falls back to each axis' first entry.
    await page.getByRole("button", { name: "Invalid selection" }).click();
    expect(await selected()).toEqual({
      scenario: "ready",
      width: 360,
      theme: "certified@1.0.0",
      designSystem: "certified@1.0.0",
    });
    expect(page.url()).toBe(before);
  } finally {
    await page.close();
  }
});

test("two_previews_with_url_keys_are_independent", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${server.url}?mode=two&left.width=768&right.width=360`);
    await page.waitForSelector("[data-lf-ready]");
    const previews = page.locator("[data-lf-preview]");
    expect(await previews.count()).toBe(2);
    expect(
      await previews.evaluateAll((all) =>
        all.map((el) => JSON.parse(el.getAttribute("data-lf-preview") ?? "null").urlKey),
      ),
    ).toEqual(["left", "right"]);
    const selected = () =>
      previews.evaluateAll((all) =>
        all.map((el) =>
          JSON.parse(el.querySelector('[data-lf-selected="true"]')?.getAttribute("data-lf-cell") ?? "null"),
        ),
      );
    expect(await selected()).toEqual([
      { scenario: "ready", width: 768, theme: "certified@1.0.0", designSystem: "certified@1.0.0" },
      { scenario: "ready", width: 360, theme: "certified@1.0.0", designSystem: "certified@1.0.0" },
    ]);
    // The right preview's second cell: 360px under the second theme.
    await previews.nth(1).locator("[data-lf-cell] > button").nth(1).click();
    expect(await selected()).toEqual([
      { scenario: "ready", width: 768, theme: "certified@1.0.0", designSystem: "certified@1.0.0" },
      { scenario: "ready", width: 360, theme: "rack@1.0.0", designSystem: "certified@1.0.0" },
    ]);
    const url = new URL(page.url()).searchParams;
    expect([
      url.get("left.width"),
      url.get("left.theme"),
      url.get("right.width"),
      url.get("right.theme"),
      url.get("scenario"),
    ]).toEqual(["768", "certified@1.0.0", "360", "rack@1.0.0", null]);
  } finally {
    await page.close();
  }
});

test("first_result_never_relabelled", async () => {
  const page = await browser.newPage();
  try {
    // The URL names "empty" while the host's only result is for "ready".
    await page.goto(`${server.url}?mode=stale&scenario=empty`);
    await page.waitForSelector("[data-lf-cell]");
    expect(await page.locator("[data-lf-cell]").first().textContent()).toContain("Unavailable");
    expect(await page.getByText("Revision 1").count()).toBe(0);
    expect(await page.locator("[data-lf-cell]").first().textContent()).not.toContain("last good render");
    expect(await page.locator("[data-lf-ready]").count()).toBe(0);
    // The same tree is shown once the host names it: the label, not the arrival order, decides.
    await page.getByLabel("Scenario", { exact: true }).selectOption("ready");
    await page.waitForSelector("[data-lf-ready]");
    expect(await page.getByText("Revision 1").count()).toBe(4);
  } finally {
    await page.close();
  }
});

test("capture_with_url_key", async () => {
  const out = await mkdtemp(join(tmpdir(), "liveframe-keyed-"));
  try {
    const index = await capture(`${server.url}?mode=keyed`, { out, scenarios: ["empty"], widths: [360] });
    expect(index.cells).toHaveLength(2);
    for (const cell of index.cells) {
      expect(cell.scenario).toBe("empty");
      expect(cell.width).toBe(360);
      expect(cell.errors.map((error) => error.pointer)).toEqual(["/root/props/gap"]);
    }
  } finally {
    await rm(out, { recursive: true });
  }
}, 60000);

test("capture_controlled_preview_rejects_other_scenario", async () => {
  const out = await mkdtemp(join(tmpdir(), "liveframe-controlled-"));
  try {
    const error = await capture(`${server.url}?mode=controlled`, { out, scenarios: ["empty"] }).catch(
      (cause: unknown) => cause,
    );
    expect(error).toMatchObject({ kind: "not-found" });
    expect((error as Error).message).toContain("controlled and shows ready");
    // Without a scenario request it captures only the scenario the page shows.
    const index = await capture(`${server.url}?mode=controlled`, { out });
    expect(index.cells).toHaveLength(4);
    expect(new Set(index.cells.map((cell) => cell.scenario))).toEqual(new Set(["ready"]));
    expect(index.cells.every((cell) => cell.errors.length === 0)).toBe(true);
  } finally {
    await rm(out, { recursive: true });
  }
}, 60000);
