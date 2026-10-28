import { afterAll, beforeAll, expect, test } from "bun:test";
import { type Browser, chromium } from "playwright";
import { renderToString } from "react-dom/server";
import { baseCss, designSystemCss, themeCss } from "../css/index.ts";
import type { Catalog, DesignSystem, Result, Theme } from "../index.ts";
import { hydrationTree, renderer, surfaceProps } from "./fixtures/react-surface.tsx";

const read = (name: string) => Bun.file(new URL(`./fixtures/proof/${name}.json`, import.meta.url)).json();
const catalog: Catalog = await read("catalog");
function css(result: Result<string>) {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
const sheets = [css(baseCss(catalog))];
for (const name of ["certified", "rack"]) {
  const theme: Theme = await read(`${name}.theme`);
  const system: DesignSystem = await read(`${name}.design-system`);
  sheets.push(css(themeCss(theme, catalog)), css(designSystemCss(system, { catalog, registry: {} })));
}

const { Surface } = renderer();

test("confirmation_is_single_flight_preserves_origin_and_drops_after_unmount", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(server.url.href);
    await page.waitForFunction(() => !!window.confirmationTest);
    await page.evaluate(() => window.confirmationTest.mount());
    await page.getByRole("button", { name: /^Confirm / }).click();
    await page.evaluate(() => window.confirmationTest.advance());
    await page.getByRole("button", { name: /^Confirm / }).click();
    expect(await page.evaluate(() => window.confirmationTest.requests())).toEqual([
      {
        intent: { type: "action", name: "tasks.escalate", args: { id: "t1", reason: "review" } },
        meta: { confirm: true, irreversible: true },
      },
    ]);
    expect(await page.evaluate(() => window.confirmationTest.emissions())).toEqual([]);
    await page.getByRole("button", { name: /^Direct / }).click();
    await page.getByRole("button", { name: /^State / }).click();
    await page.evaluate(() => window.confirmationTest.approve(true));
    await page.waitForFunction(() => window.confirmationTest.emissions().length === 3);
    expect(await page.evaluate(() => window.confirmationTest.emissions().map(({ origin }) => origin.revision))).toEqual(
      [2, 2, 1],
    );
    await page.getByRole("button", { name: /^Confirm / }).click();
    await page.evaluate(() => {
      window.confirmationTest.unmount();
      window.confirmationTest.approve(true);
    });
    expect(await page.evaluate(() => window.confirmationTest.emissions().length)).toBe(3);
  } finally {
    await page.close();
  }
});

test("unconfirmed_action_never_reaches_on_intent_and_confirm_throw_raises_nothing", async () => {
  for (const outcome of ["false", "reject", "throw", "disabled"]) {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    try {
      await page.goto(server.url.href);
      await page.waitForFunction(() => !!window.confirmationTest);
      await page.evaluate((outcome) => {
        window.confirmationTest.mount(outcome !== "disabled");
        if (outcome === "throw") window.confirmationTest.throwNext();
      }, outcome);
      await page.getByRole("button", { name: /^Confirm / }).click();
      await page.evaluate((outcome) => {
        if (outcome === "false") window.confirmationTest.approve(false);
        if (outcome === "reject") window.confirmationTest.reject();
      }, outcome);
      expect(await page.evaluate(() => window.confirmationTest.emissions().length)).toBe(
        outcome === "disabled" ? 1 : 0,
      );
      expect(errors).toEqual([]);
      if (outcome !== "disabled") {
        await page.getByRole("button", { name: /^Confirm / }).click();
        expect(await page.evaluate(() => window.confirmationTest.requests().length)).toBe(2);
      }
    } finally {
      await page.close();
    }
  }
});
test("form_submit_carries_all_fields", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(server.url.href);
    await page.waitForFunction(() => !!window.surfaceTest);
    await page.evaluate(() => window.surfaceTest.mountForm());
    await page.getByRole("textbox", { name: "Reason" }).fill("edited local draft");
    await page.getByRole("checkbox", { name: "Confirm" }).check();
    expect(await page.evaluate(() => window.surfaceTest.intents())).toEqual([]);
    await page.getByRole("button", { name: "Submit fields" }).click();
    expect(await page.evaluate(() => window.surfaceTest.intents())).toEqual([
      { type: "action", name: "form.submit", args: { id: "row", reason: "edited local draft", confirm: true } },
    ]);
  } finally {
    await page.close();
  }
});
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
    fetch: (request) => {
      const mode = new URL(request.url).searchParams.get("ssr");
      let markup = "";
      if (mode) {
        try {
          markup = renderToString(<Surface {...surfaceProps} tree={hydrationTree(mode)} />);
        } catch (error) {
          if (mode !== "throw") throw error;
          markup = renderToString(surfaceProps.fallback);
        }
      }
      return new URL(request.url).pathname === "/client.js"
        ? new Response(bundle, { headers: { "Content-Type": "text/javascript" } })
        : new Response(
            `<!doctype html><html lang="en"><head><title>Surface tests</title><style>${sheets.join("\n")}</style><style>
              #app:has(section){display:flex;gap:16px}section{position:relative;width:760px;flex-shrink:0}
              [role=dialog]{position:absolute;top:40px;left:40px;z-index:2}
              .lf_dialog_default_backdrop{position:absolute;inset:0;z-index:1}
            </style></head><body><div id="app">${markup}</div><script type="module" src="/client.js"></script></body></html>`,
            { headers: { "Content-Type": "text/html" } },
          );
    },
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

test("local_interactions_stay_local_and_intents_use_the_current_handler", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(server.url.href);
    await page.waitForSelector("button");
    await page.locator("button").click();
    expect(await page.evaluate(() => window.surfaceTest.intents())).toEqual([]);
    await page.evaluate(() => {
      const next = window.surfaceTest.tree(2);
      window.surfaceTest.update({
        ...next,
        root: {
          ...next.root,
          children: [
            {
              id: "root/second",
              kind: "button",
              props: { label: "Commit" },
              events: { onPress: { type: "setState", key: "reason", value: "committed" } },
            },
          ],
        },
      });
      window.surfaceTest.emit();
    });
    const intent = { type: "setState", key: "reason", value: "committed" } as const;
    expect(await page.evaluate(() => window.surfaceTest.intents())).toEqual([intent]);
    const checks = await page.evaluate(() => window.surfaceTest.checks());
    await page.evaluate(() => {
      window.surfaceTest.replaceIntentHandler();
      window.surfaceTest.emit();
    });
    expect(await page.evaluate(() => window.surfaceTest.intents())).toEqual([intent]);
    expect(await page.evaluate(() => window.surfaceTest.checks())).toBe(checks);
    expect(await page.locator("button").textContent()).toContain("Commit 1");
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

test("browser_shows_fallbacks_for_invalid_tree_and_throwing_node_under_both_systems", async () => {
  for (const system of ["certified", "rack"]) {
    const page = await browser.newPage();
    try {
      await page.goto(server.url.href);
      await page.waitForSelector("button");
      await page.evaluate((system) => window.surfaceTest.setScope(system), system);
      await page.evaluate(() => window.surfaceTest.update({ ...window.surfaceTest.tree(2), catalogId: "bad.ui@1" }));
      expect(await page.locator("#app").textContent()).toBe("Unavailable");
      expect(await page.locator("#app button").count()).toBe(0);
      await page.evaluate(() => {
        const next = window.surfaceTest.tree(3);
        window.surfaceTest.update({
          ...next,
          root: {
            ...next.root,
            children: [
              { id: "root/first", kind: "text", props: { text: "throw" } },
              ...(next.root.children?.slice(1) ?? []),
            ],
          },
        });
      });
      expect(await page.locator("#app p").textContent()).toBe("Unavailable");
      expect(await page.locator("#app button").count()).toBe(1);
    } finally {
      await page.close();
    }
  }
});

async function mountSwitching() {
  const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
  await page.goto(server.url.href);
  await page.waitForSelector("button");
  await page.evaluate(() => window.surfaceTest.mountSwitching());
  await page.waitForSelector("#b [role=dialog]");
  return page;
}

test("portal_overlay_keeps_surface_scope", async () => {
  const page = await mountSwitching();
  try {
    const values = await page.locator("[role=dialog]").evaluateAll((dialogs) =>
      dialogs.map((el) => {
        const scope = el.closest("[data-lf-portal]");
        const style = getComputedStyle(el);
        return {
          sibling: scope?.previousElementSibling?.className === scope?.className,
          theme: scope?.getAttribute("data-lf-theme"),
          color: style.color,
          font: style.fontFamily,
          blur: el.previousElementSibling && getComputedStyle(el.previousElementSibling).backdropFilter,
        };
      }),
    );
    expect(values.map((value) => value.sibling)).toEqual([true, true]);
    expect(await page.locator("#a > .host-scope, #b > .host-scope").count()).toBe(4);
    expect(values.map((value) => value.theme)).toEqual(["certified@1.0.0", "rack@1.0.0"]);
    expect(values[0]?.font).not.toBe(values[1]?.font);
    expect(values[1]?.blur).toBe("blur(2px) saturate(1)");
    await page.evaluate(() => window.surfaceTest.switchStyles(0, "rack"));
    const switched = await page.locator("[role=dialog]").evaluateAll((dialogs) =>
      dialogs.map((el) => {
        const style = getComputedStyle(el);
        return [style.color, style.fontFamily, style.backgroundColor];
      }),
    );
    expect(switched[0]).toEqual(switched[1]);
  } finally {
    await page.close();
  }
});

test("portal_takes_no_grid_track_and_overlay_responsive_value_tracks_viewport", async () => {
  const page = await mountSwitching();
  try {
    await page.addStyleTag({ content: "#a{display:grid;width:300px;gap:20px}#b{display:none}" });
    const layout = await page.locator("#a").evaluate((el) => {
      const portal = el.querySelector<HTMLElement>("[data-lf-portal]")!;
      const style = getComputedStyle(portal);
      return {
        rows: getComputedStyle(el).gridTemplateRows.split(" ").length,
        width: portal.getBoundingClientRect().width,
        position: style.position,
        pointerEvents: style.pointerEvents,
        opacity: style.opacity,
        filter: style.filter,
        container: style.containerType,
      };
    });
    expect(layout).toEqual({
      rows: 1,
      width: 1700,
      position: "fixed",
      pointerEvents: "none",
      opacity: "1",
      filter: "none",
      container: "inline-size",
    });
    const responsive = page.locator("#a [role=dialog] > div");
    const wideGap = await responsive.evaluate((el) => getComputedStyle(el).gap);
    expect(wideGap).toBe("16px");
    await page.setViewportSize({ width: 500, height: 1000 });
    expect(await responsive.evaluate((el) => getComputedStyle(el).gap)).toBe("4px");
    await page.setViewportSize({ width: 1700, height: 1000 });
    expect(await responsive.evaluate((el) => getComputedStyle(el).gap)).toBe(wideGap);
    await page.addStyleTag({ content: ".host-scope[data-lf-portal]{position:absolute}" });
    expect(await page.locator("#a [data-lf-portal]").evaluate((el) => getComputedStyle(el).position)).toBe("absolute");
  } finally {
    await page.close();
  }
});

test("overlay_content_receives_pointer_events", async () => {
  const page = await mountSwitching();
  page.setDefaultTimeout(1500);
  try {
    await page.addStyleTag({ content: "#b{display:none}" });
    const button = page.locator("#a [data-lf-portal]").getByRole("button", { name: "Overlay focus" });
    await button.evaluate((el) => el.addEventListener("click", () => el.setAttribute("data-clicked", "true")));
    await button.click();
    expect(await button.getAttribute("data-clicked")).toBe("true");
    await page.locator("#a [data-lf-portal]").evaluate((el) => el.replaceChildren());
    const host = page.locator("#a > :not([data-lf-portal])").getByRole("button").first();
    await host.evaluate((el) => {
      el.setAttribute("style", "position:fixed;top:900px;left:10px");
      el.addEventListener("click", () => el.setAttribute("data-clicked", "true"));
    });
    await host.click();
    expect(await host.getAttribute("data-clicked")).toBe("true");
  } finally {
    await page.close();
  }
});

test("switch_runs_the_switching_sequence_on_root_and_portal", async () => {
  const page = await mountSwitching();
  try {
    const result = await page.evaluate(async () => {
      const scopes = [...document.querySelectorAll("#a > [data-lf-ds]")];
      const records: MutationRecord[] = [];
      const observer = new MutationObserver((batch) => records.push(...batch));
      for (const scope of scopes) observer.observe(scope, { attributes: true, attributeOldValue: true });
      window.surfaceTest.switchStyles(0, "rack");
      const marked = scopes.every((el) => el.hasAttribute("data-lf-switching"));
      const durations = [...document.querySelectorAll("#a button")].map(
        (el) => getComputedStyle(el).transitionDuration,
      );
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      observer.disconnect();
      return {
        marked,
        durations: [...new Set(durations)],
        removed: scopes.every((el) => !el.hasAttribute("data-lf-switching")),
        order: scopes.map((scope) =>
          records.filter((record) => record.target === scope).map((record) => record.attributeName),
        ),
      };
    });
    expect(result.marked).toBe(true);
    expect(result.removed).toBe(true);
    expect(result.durations).toEqual(["0s"]);
    expect(result.order).toEqual(
      Array(2).fill(["data-lf-switching", "data-lf-theme", "data-lf-ds", "data-lf-switching"]),
    );
  } finally {
    await page.close();
  }
});

test("switch_rerenders_no_implementation_and_keeps_focus", async () => {
  const page = await mountSwitching();
  try {
    await page.locator("#a [role=dialog] button").focus();
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    const result = await page.evaluate(async () => {
      const nodes = [...document.querySelectorAll("#a *")];
      const classes = nodes.map((el) => el.className);
      const focus = document.activeElement;
      const renders = window.surfaceTest.renders();
      let transitions = 0;
      document.addEventListener("transitionrun", () => transitions++);
      window.surfaceTest.switchStyles(0, "rack");
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const after = [...document.querySelectorAll("#a *")];
      return {
        renders: window.surfaceTest.renders() - renders,
        focus: focus === document.activeElement,
        nodes: nodes.every((node, i) => node === after[i]),
        classes: classes.every((value, i) => value === after[i]?.className),
        transitions,
      };
    });
    expect(result).toEqual({ renders: 0, focus: true, nodes: true, classes: true, transitions: 0 });
  } finally {
    await page.close();
  }
});

test("sibling_surfaces_switch_independently", async () => {
  const page = await mountSwitching();
  try {
    const snapshot = () =>
      page.locator("#b").evaluate((root) => ({
        html: root.innerHTML,
        styles: [...root.querySelectorAll("*")].map((el) => {
          const s = getComputedStyle(el);
          return [s.color, s.fontFamily, s.backgroundColor, s.backdropFilter];
        }),
      }));
    const before = await snapshot();
    for (const [theme, system, version] of [
      ["rack", "certified", "1.0.0"],
      ["rack", "rack", "1.0.0"],
      ["rack", "rack", "2.0.0"],
    ] as const) {
      await page.evaluate(([theme, system, version]) => window.surfaceTest.switchStyles(0, theme, system, version), [
        theme,
        system,
        version,
      ] as const);
      expect(await snapshot()).toEqual(before);
      expect(await page.locator("#a > [data-lf-theme]").first().getAttribute("data-lf-theme")).toBe(
        `${theme}@${version}`,
      );
      expect(await page.locator("#a > [data-lf-ds]").last().getAttribute("data-lf-ds")).toBe(`${system}@${version}`);
    }
    await page.evaluate(() => {
      window.surfaceTest.switchStyles(0, "certified");
      window.surfaceTest.unmount();
    });
    expect(await page.locator("#app").textContent()).toBe("");
  } finally {
    await page.close();
  }
});

test("switch_under_budget_with_blur_through_surface", async () => {
  const page = await mountSwitching();
  try {
    const result = await page.evaluate(async () => {
      const nodes = [...document.querySelectorAll("#b *")];
      const samples: number[] = [];
      let cold = 0;
      for (let i = 0; i < 11; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const start = performance.now();
        window.surfaceTest.switchStyles(1, i % 2 ? "rack" : "certified");
        for (const el of nodes) {
          const s = getComputedStyle(el);
          void s.fontSize;
          void s.backgroundColor;
          void s.backdropFilter;
          void s.display;
        }
        const elapsed = performance.now() - start;
        if (i === 0) cold = elapsed;
        else samples.push(elapsed);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      return { cold, samples, nodes: nodes.length };
    });
    console.log(`Surface two-surface switch with blur: ${JSON.stringify(result)}`);
    expect(result.nodes).toBeGreaterThan(500);
    expect(result.samples).toHaveLength(10);
    expect(Math.max(...result.samples)).toBeLessThanOrEqual(16.67);
  } finally {
    await page.close();
  }
}, 20000);

test("server_markup_hydrates_with_no_recoverable_error", async () => {
  const page = await browser.newPage();
  try {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${server.url}?ssr=valid`);
    await page.waitForSelector("[role=dialog]");
    await page.getByRole("button", { name: "Commit 0" }).press("Enter");
    expect(await page.getByRole("button").textContent()).toContain("Commit 1");
    expect(await page.evaluate(() => window.surfaceTest.intents())).toEqual([
      { type: "setState", key: "reason", value: "committed" },
    ]);
    const hydration = await page.evaluate(() => window.surfaceTest.hydration());
    expect(hydration.errors).toEqual([]);
    expect(hydration.retained).toBe(true);
    expect(await page.locator("#app > .lf_container").count()).toBe(2);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});

test("overlay_mounts_after_hydration_without_mismatch", async () => {
  const page = await browser.newPage();
  try {
    await page.route("**/client.js", (route) => route.abort());
    await page.goto(`${server.url}?ssr=valid`);
    expect(await page.getByRole("dialog").count()).toBe(0);
    expect(await page.locator("[data-lf-portal]").textContent()).toBe("");
    await page.unroute("**/client.js");
    await page.reload();
    await page.waitForSelector("[data-lf-portal] [role=dialog]");
    const hydration = await page.evaluate(() => window.surfaceTest.hydration());
    expect(hydration.firstPortals).toEqual({ stack: false, text: false, button: false, dialog: false });
    expect(hydration.errors).toEqual([]);
    expect(hydration.retained).toBe(true);
  } finally {
    await page.close();
  }
});

test("invalid_server_fallback_hydrates_without_mismatch", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${server.url}?ssr=invalid`);
    await page.waitForFunction(() => window.surfaceTest?.checks() === 1);
    expect(await page.locator("#app").textContent()).toBe("Unavailable");
    expect(await page.evaluate(() => window.surfaceTest.hydration())).toEqual({
      errors: [],
      firstPortals: {},
      retained: true,
    });
  } finally {
    await page.close();
  }
});

test("host_fallback_recovers_on_client_after_ssr_throw", async () => {
  const page = await browser.newPage();
  try {
    await page.route("**/client.js", (route) => route.abort());
    await page.goto(`${server.url}?ssr=throw`);
    expect(await page.locator("#app").innerHTML()).toBe("<p>Unavailable</p>");
    await page.unroute("**/client.js");
    await page.reload();
    await page.waitForSelector("[role=dialog]");
    expect(await page.locator("#app p").textContent()).toBe("Unavailable");
    await page.getByRole("button").press("Enter");
    expect(await page.getByRole("button").textContent()).toContain("Commit 1");
    expect((await page.evaluate(() => window.surfaceTest.hydration())).retained).toBe(false);
  } finally {
    await page.close();
  }
});

test("status_region_survives_text_change", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(server.url.href);
    await page.waitForSelector("button");
    const show = (text: string, revision: number) =>
      page.evaluate(
        ([text, revision]) => {
          const base = window.surfaceTest.tree(revision as number);
          window.surfaceTest.update({
            ...base,
            root: {
              ...base.root,
              children: [
                {
                  id: "root/status",
                  kind: "stack",
                  props: { semantics: "status", label: "Save status" },
                  children: [{ id: "root/status/text", kind: "text", props: { text } }],
                },
              ],
            },
          });
        },
        [text, revision],
      );
    await show("Saving", 2);
    const region = page.getByRole("status", { name: "Save status" });
    await region.evaluate((el) => {
      (window as unknown as { region: Element }).region = el;
    });
    await show("Saved", 3);
    expect(await region.evaluate((el) => el === (window as unknown as { region: Element }).region)).toBe(true);
    const snapshot = await region.ariaSnapshot();
    expect(snapshot).toContain("Saved");
    expect(snapshot.match(/Saved/g)).toHaveLength(1);
    expect(snapshot).not.toContain("Saving");
  } finally {
    await page.close();
  }
});

test("origin_for_portal_nodes_uses_the_accepted_revision", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(server.url.href);
    await page.waitForSelector("button");
    await page.evaluate(() => {
      const tree = window.surfaceTest.tree(7);
      window.surfaceTest.update({
        ...tree,
        root: {
          id: "root",
          kind: "dialog",
          props: { label: "Overlay", open: true },
          children: [
            {
              id: "root/press",
              kind: "button",
              props: { label: "Portal action" },
              events: { onPress: { type: "setState", key: "reason", value: "fixed" } },
            },
          ],
        },
      });
      window.surfaceTest.update(window.surfaceTest.tree(3));
    });
    await page.locator("[data-lf-portal]").getByRole("button", { name: "Portal action" }).click();
    expect(await page.evaluate(() => window.surfaceTest.origins())).toEqual([
      { surfaceId: "test", revision: 7, nodeId: "root/press", event: "onPress" },
    ]);
  } finally {
    await page.close();
  }
});
