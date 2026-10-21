import { afterAll, beforeAll, expect, test } from "bun:test";
import { type Browser, chromium, type Page } from "playwright";
import { renderToString } from "react-dom/server";
import { definitions } from "../catalog/definitions.ts";
import { project } from "../css/project.ts";
import { implementations } from "../renderer/primitives/index.tsx";
import { registry } from "../renderer/registry.ts";
import { Surface } from "../renderer/surface.tsx";
import type { RenderOptions, UiNode, UiTree } from "../runtime/types.ts";
import { certifiedDesignSystem } from "../styles/certified/design-system.ts";
import { certifiedTheme } from "../styles/certified/theme.ts";
import { rackDesignSystem } from "../styles/rack/design-system.ts";
import { rackTheme } from "../styles/rack/theme.ts";

const options: RenderOptions = {
  catalog: { catalogId: "proof@1", definitions },
  actions: ["save", "close"],
  state: {
    type: "object",
    properties: {
      query: { type: "string", maxLength: 100 },
      selected: { type: "string", maxLength: 100 },
      enabled: { type: "boolean" },
    },
    required: [],
    additionalProperties: false,
  },
};
const registered = registry(options.catalog, implementations);
let widgetRenders = 0;
function widget(revision = 1): UiTree {
  widgetRenders++;
  const node = (id: string, kind: string, props: UiNode["props"], extra: Partial<UiNode> = {}): UiNode => ({
    id: `root/${id}`,
    kind,
    props,
    ...extra,
  });
  return {
    format: "liveframe/1",
    catalogId: "proof@1",
    surfaceId: "test",
    revision,
    root: {
      id: "root",
      kind: "stack",
      props: {},
      style: { gap: "space.2" },
      children: [
        node(
          "scroll",
          "scroll",
          { label: "Results" },
          {
            style: { height: "space.7" },
            children: [
              node(
                "scroll/query",
                "textField",
                { label: "Query", value: "initial" },
                {
                  events: {
                    onChange: { type: "setState", key: "query" },
                    onSubmit: { type: "action", name: "save", args: { source: "query" } },
                  },
                },
              ),
              ...Array.from({ length: 10 }, (_, i) => node(`scroll/row${i}`, "text", { text: `Row ${i}` })),
            ],
          },
        ),
        node(
          "save",
          "button",
          { label: "Save" },
          { variant: "primary", events: { onPress: { type: "action", name: "save", args: {} } } },
        ),
        node("check", "checkbox", { label: "Enabled" }, { events: { onChange: { type: "setState", key: "enabled" } } }),
        node("switch", "switch", { label: "Power" }),
        node(
          "select",
          "select",
          {
            label: "Category",
            options: [
              { value: "one", label: "One" },
              { value: "two", label: "Two" },
            ],
          },
          { events: { onChange: { type: "setState", key: "selected" } } },
        ),
        node(
          "menu",
          "menu",
          { label: "Actions" },
          {
            children: [
              node(
                "menu/save",
                "menuItem",
                { label: "Save item" },
                { events: { onPress: { type: "action", name: "save", args: { from: "menu" } } } },
              ),
            ],
          },
        ),
        node(
          "popover",
          "popover",
          { label: "Details" },
          { children: [node("popover/text", "text", { text: "Popover content" })] },
        ),
        node(
          "tabs",
          "tabs",
          { label: "Views", value: "first" },
          {
            events: { onChange: { type: "setState", key: "selected" } },
            children: [
              node(
                "tabs/first",
                "tab",
                { label: "First", value: "first" },
                { children: [node("tabs/first/text", "text", { text: "First panel" })] },
              ),
              node(
                "tabs/second",
                "tab",
                { label: "Second", value: "second" },
                { children: [node("tabs/second/text", "text", { text: "Second panel" })] },
              ),
            ],
          },
        ),
        node(
          "tooltip",
          "tooltip",
          { text: "Helpful information" },
          { children: [node("tooltip/text", "text", { text: "Help" })] },
        ),
        node(
          "dialog",
          "dialog",
          { label: "Confirm", open: false },
          {
            events: { onClose: { type: "action", name: "close", args: {} } },
            children: [node("dialog/text", "text", { text: "Dialog content" })],
          },
        ),
      ],
    },
  };
}
const initial = widget();
const certified = project(certifiedTheme, certifiedDesignSystem);
const rack = project(rackTheme, rackDesignSystem);
let server: ReturnType<typeof Bun.serve>;
let browser: Browser;
beforeAll(async () => {
  const build = await Bun.build({
    entrypoints: [new URL("./fixtures/renderer-client.tsx", import.meta.url).pathname],
    target: "browser",
  });
  if (!build.success) throw new AggregateError(build.logs);
  const output = build.outputs[0];
  if (!output) throw new Error("Missing browser bundle");
  const bundle = await output.text();
  const html = renderToString(
    <Surface
      tree={initial}
      options={options}
      registry={registered}
      fallback={<p>Unavailable</p>}
      onIntent={() => {}}
    />,
  );
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (request) =>
      new URL(request.url).pathname === "/client.js"
        ? new Response(bundle, { headers: { "Content-Type": "text/javascript" } })
        : new Response(
            `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Renderer test</title><style id="projection">${certified}</style></head><body><div id="app">${html}</div><script type="application/json" id="tree">${JSON.stringify(initial).replaceAll("<", "\\u003c")}</script><script type="module" src="/client.js"></script></body></html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          ),
  });
  browser = await chromium.launch({ headless: true });
}, 30000);
afterAll(async () => {
  await browser?.close();
  await server?.stop(true);
});

async function visit(run: (page: Page, errors: string[]) => Promise<void>) {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  try {
    await page.goto(server.url.toString());
    await page.waitForFunction(() => window.ready);
    await run(page, errors);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
}

async function update(page: Page, tree: UiTree) {
  await page.evaluate((json) => window.update(JSON.parse(json)), JSON.stringify(tree));
}

test(
  "local_state_focus_scroll_and_ids_survive_new_and_stale_revisions",
  () =>
    visit(async (page) => {
      const field = page.getByRole("textbox", { name: "Query" });
      await field.fill("local draft");
      await page.getByRole("region", { name: "Results" }).evaluate((el) => {
        el.scrollTop = 12;
      });
      const scroll = await page.getByRole("region", { name: "Results" }).evaluate((el) => el.scrollTop);
      const next = widget(2);
      const inserted: UiNode = { id: "root/inserted", kind: "text", props: { text: "Inserted" } };
      await update(page, { ...next, root: { ...next.root, children: [inserted, ...(next.root.children ?? [])] } });
      await page.getByText("Inserted", { exact: true }).waitFor();
      expect(await field.inputValue()).toBe("local draft");
      expect(await field.evaluate((el) => el === document.activeElement)).toBe(true);
      expect(await page.getByRole("region", { name: "Results" }).evaluate((el) => el.scrollTop)).toBe(scroll);
      const stale = widget(1);
      await update(page, stale);
      expect(await page.getByText("Inserted", { exact: true }).isVisible()).toBe(true);
      const changed = widget(3);
      await update(page, {
        ...changed,
        root: {
          ...changed.root,
          children: (changed.root.children ?? []).map((node) =>
            node.kind === "scroll"
              ? {
                  ...node,
                  children: (node.children ?? []).map((child) =>
                    child.kind === "textField" ? { ...child, props: { ...child.props, value: "server value" } } : child,
                  ),
                }
              : node,
          ),
        },
      });
      await page.waitForFunction(() => document.querySelector("input")?.value === "server value");
      expect(await field.inputValue()).toBe("server value");
      await update(page, { ...initial, surfaceId: "replacement" });
      expect(await field.inputValue()).toBe("initial");
      await update(page, { ...initial, root: { ...initial.root, kind: "unknown" } });
      expect(await page.getByText("Unavailable", { exact: true }).isVisible()).toBe(true);
    }),
  15000,
);

test(
  "three_interaction_tiers_overlays_and_keyboard_controls",
  () =>
    visit(async (page) => {
      await page.getByRole("textbox", { name: "Query" }).fill("committed");
      expect(await page.evaluate(() => window.intents)).toEqual([]);
      await page.getByRole("textbox", { name: "Query" }).press("Enter");
      expect(await page.evaluate(() => window.intents.slice(0, 2))).toEqual([
        { type: "setState", key: "query", value: "committed" },
        { type: "action", name: "save", args: { source: "query" } },
      ]);
      await page.getByRole("button", { name: "Actions", exact: true }).click();
      await page.getByRole("menuitem", { name: "Save item" }).press("Enter");
      expect(await page.evaluate(() => window.intents.at(-1))).toEqual({
        type: "action",
        name: "save",
        args: { from: "menu" },
      });
      await page.getByRole("button", { name: "Details", exact: true }).click();
      expect(await page.getByRole("dialog", { name: "Details" }).isVisible()).toBe(true);
      await page.keyboard.press("Escape");
      await page.getByRole("tab", { name: "First", exact: true }).focus();
      await page.keyboard.press("ArrowRight");
      expect(await page.getByRole("tab", { name: "Second", exact: true }).getAttribute("aria-selected")).toBe("true");
      expect(await page.getByRole("tabpanel").textContent()).toBe("Second panel");
      await page.getByRole("button", { name: "Category" }).click();
      await page.getByRole("option", { name: "Two", exact: true }).click();
      expect(await page.evaluate(() => window.intents.at(-1))).toEqual({
        type: "setState",
        key: "selected",
        value: "two",
      });
      await page.getByRole("checkbox", { name: "Enabled" }).focus();
      await page.keyboard.press("Space");
      expect(await page.getByRole("checkbox", { name: "Enabled" }).isChecked()).toBe(true);
      expect(await page.evaluate(() => window.intents.at(-1))).toEqual({
        type: "setState",
        key: "enabled",
        value: true,
      });
      await page.getByRole("switch", { name: "Power" }).focus();
      await page.keyboard.press("Space");
      expect(await page.getByRole("switch", { name: "Power" }).isChecked()).toBe(true);
      await page.locator(".lf-tooltip-default-trigger-rest").focus();
      await page.getByRole("tooltip").waitFor();
      expect(await page.getByRole("tooltip").textContent()).toBe("Helpful information");
      const next = widget(2);
      const children = (next.root.children ?? []).map((node) =>
        node.kind === "dialog" ? { ...node, props: { ...node.props, open: true } } : node,
      );
      await update(page, { ...next, root: { ...next.root, children } });
      await page.getByRole("dialog", { name: "Confirm" }).waitFor();
      await page.keyboard.press("Tab");
      expect(
        await page.getByRole("dialog", { name: "Confirm" }).evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
      await page.keyboard.press("Escape");
      expect(await page.evaluate(() => window.intents.at(-1))).toEqual({ type: "action", name: "close", args: {} });
    }),
  20000,
);

test(
  "design_system_switch_changes_styles_without_widget_or_dom_rerender_and_honours_forced_colours",
  () =>
    visit(async (page) => {
      const count = widgetRenders;
      const button = page.getByRole("button", { name: "Save", exact: true });
      const before = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
      const dom = await page.locator("#app").innerHTML();
      await page.evaluate((css) => {
        const style = document.getElementById("projection");
        if (!style) throw new Error("Missing projection");
        style.textContent = css;
      }, rack);
      await page.waitForFunction((colour) => {
        const button = document.querySelector(".lf-button-primary-root-rest");
        return button && getComputedStyle(button).backgroundColor !== colour;
      }, before);
      expect(widgetRenders).toBe(count);
      expect(await page.locator("#app").innerHTML()).toBe(dom);
      await page.emulateMedia({ forcedColors: "active" });
      expect(await button.evaluate((el) => getComputedStyle(el).forcedColorAdjust)).toBe("auto");
      expect(await button.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
    }),
  15000,
);
