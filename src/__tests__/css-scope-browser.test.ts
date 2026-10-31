// Regenerate the static server-rendered fixture: timeout 30s bun proof/scripts/capture-css-scope.ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import { baseCss, designSystemCss, styleDeclarations, themeCss } from "@arnilo/liveframe/css";
import type { Browser, Page } from "playwright";
import { primitiveCss } from "../../proof/renderer/primitives/base.ts";
import type { Catalog, DesignSystem, Result, Theme } from "../index.ts";
import { launchBrowser, measureSwitching } from "./fixtures/browser.ts";

const read = (name: string) => Bun.file(new URL(`./fixtures/proof/${name}.json`, import.meta.url)).json();
const catalog: Catalog = await read("catalog");
const themes: Theme[] = await Promise.all([read("certified.theme"), read("rack.theme")]);
const systems: DesignSystem[] = await Promise.all([read("certified.design-system"), read("rack.design-system")]);
function css(result: Result<string>) {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
// Hosts ship trusted primitive CSS before the projected sheets; without it the page is not one a host renders.
const sheets = [
  primitiveCss,
  css(baseCss(catalog)),
  ...themes.map((theme) => css(themeCss(theme, catalog))),
  ...systems.map((system) => css(designSystemCss(system, { catalog, registry: {} }))),
].join("\n");
const scope = (name: string) => `data-lf-theme="${name}@1.0.0" data-lf-ds="${name}@1.0.0"`;
const responsive = styleDeclarations({ position: { base: "static", "bp.md": "sticky" } }, catalog);
let browser: Browser;
let markup: string;
beforeAll(async () => {
  markup = await Bun.file(new URL("./fixtures/css/agent-home.html", import.meta.url)).text();
  // This CSS-only harness supplies its own scopes around the captured Surface markup.
  markup = markup.replace(/ data-lf-(?:theme|ds)="[^"]*"/g, "");
  browser = await launchBrowser();
});
afterAll(async () => browser?.close());

async function mount(page: Page) {
  page.setDefaultTimeout(5000);
  await page.setContent(`<style>${sheets}</style><style>
    body{display:flex;align-items:start;gap:16px}
    section{position:relative;flex-shrink:0;width:760px}
    .backdrop{position:absolute;inset:0;z-index:1}
    .dialog{position:absolute;top:40px;left:40px;z-index:2}
  </style><button id="host">Host</button>${["certified", "rack"]
    .map(
      (
        name,
        index,
      ) => `<section id="${index ? "b" : "a"}" class="lf_surface lf_container" ${scope(name)} data-lf-switching>
      ${markup}<button class="lf_button_primary_root probe">Probe</button>
      <div class="responsive ${responsive.classes.join(" ")}"></div>
      <div class="lf_dialog_default_root" data-open>
        <div class="backdrop lf_dialog_default_backdrop"></div>
        <div role="dialog" aria-label="Scope proof" class="dialog lf_dialog_default_content">Open dialog</div>
      </div>
      <div class="lf_popover_default_root" data-open>
        <div popover="manual" class="lf_popover_default_content">Open popover</div>
      </div></section>`,
    )
    .join("")}`);
  await page.evaluate((style) => {
    for (const el of document.querySelectorAll<HTMLElement>(".responsive")) {
      for (const [key, value] of Object.entries(style)) el.style.setProperty(key, value);
    }
    for (const el of document.querySelectorAll<HTMLElement>("[popover]")) el.showPopover();
    // Resolve initial styles with transitions suppressed, then permit ordinary transitions.
    document.body.offsetWidth;
    for (const root of document.querySelectorAll("section")) root.removeAttribute("data-lf-switching");
  }, responsive.style);
  await page.mouse.move(0, 0);
}

async function snapshot(page: Page, selector: string) {
  return page.locator(selector).evaluate((root) =>
    [root, ...root.querySelectorAll("*")].map((el) => {
      const s = getComputedStyle(el);
      return [s.fontFamily, s.fontSize, s.color, s.backgroundColor, s.borderRadius, s.display, s.backdropFilter];
    }),
  );
}

test("two_surfaces_keep_their_own_styles", async () => {
  const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
  try {
    await mount(page);
    const a = await snapshot(page, "#a");
    const b = await snapshot(page, "#b");
    expect(a[0]?.slice(0, 2)).not.toEqual(b[0]?.slice(0, 2));
    expect(await snapshot(page, "#a .probe")).not.toEqual(await snapshot(page, "#b .probe"));
    for (const id of ["a", "b"]) {
      const display = () => page.locator(`#${id} .responsive`).evaluate((el) => getComputedStyle(el).position);
      expect(await display()).toBe("sticky");
      await page.locator(`#${id}`).evaluate((el) => ((el as HTMLElement).style.width = "719px"));
      expect(await display()).toBe("static");
      await page.locator(`#${id}`).evaluate((el) => ((el as HTMLElement).style.width = "720px"));
      expect(await display()).toBe("sticky");
    }
    const host = await page.locator("#host").evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.getPropertyValue("--lf-c-accent_fill"), s.getPropertyValue("--lf-v-space_3"), s.boxSizing];
    });
    expect(host.slice(0, 2)).toEqual(["", ""]);
    // Removing the other scope cannot change either surface's computed projection.
    await page.locator("#b").evaluate((el) => el.remove());
    await page.locator("#a").evaluate((el) => ((el as HTMLElement).style.width = "760px"));
    expect(await snapshot(page, "#a")).toEqual(a);
    await mount(page);
    await page.locator("#a").evaluate((el) => el.remove());
    expect(await snapshot(page, "#b")).toEqual(b);
  } finally {
    await page.close();
  }
});

test("host_css_does_not_restyle_surfaces", async () => {
  const page = await browser.newPage();
  try {
    await mount(page);
    const before = await Promise.all([snapshot(page, "#a"), snapshot(page, "#b")]);
    await page.addStyleTag({ content: "button { background: red }" });
    expect(await Promise.all([snapshot(page, "#a"), snapshot(page, "#b")])).toEqual(before);
    expect(await page.locator("#host").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 0, 0)");
  } finally {
    await page.close();
  }
});

test("switch_changes_one_surface_only", async () => {
  const page = await browser.newPage();
  try {
    await mount(page);
    const before = await snapshot(page, "#a");
    const other = await snapshot(page, "#b");
    const result = await page.evaluate(async () => {
      const root = document.querySelector("#a");
      if (!root) throw new Error("Missing switching surface");
      const nodes = [document.body, ...document.body.querySelectorAll("*")];
      const html = root.innerHTML;
      const sibling = document.querySelector("#b")?.outerHTML;
      const classes = nodes.map((node) => node.getAttribute("class"));
      const mutations: MutationRecord[] = [];
      const observer = new MutationObserver((records) => mutations.push(...records));
      observer.observe(document.body, { attributes: true, childList: true, subtree: true, characterData: true });
      let transitions = 0;
      document.body.addEventListener("transitionrun", () => transitions++);
      root.setAttribute("data-lf-switching", "");
      root.setAttribute("data-lf-theme", "rack@1.0.0");
      root.setAttribute("data-lf-ds", "rack@1.0.0");
      const durations = [root, ...root.querySelectorAll("*")].map((el) => getComputedStyle(el).transitionDuration);
      const animations = root.getAnimations({ subtree: true }).length;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => {
          root.removeAttribute("data-lf-switching");
          requestAnimationFrame(() => resolve());
        }),
      );
      observer.disconnect();
      const after = [document.body, ...document.body.querySelectorAll("*")];
      return {
        sameNodes: nodes.length === after.length && nodes.every((node, i) => node === after[i]),
        sameClasses: JSON.stringify(classes) === JSON.stringify(after.map((node) => node.getAttribute("class"))),
        sameMarkup: root.innerHTML === html && document.querySelector("#b")?.outerHTML === sibling,
        onlyScopeAttributes: mutations.every(
          (m) =>
            m.target === root &&
            m.type === "attributes" &&
            ["data-lf-switching", "data-lf-theme", "data-lf-ds"].includes(m.attributeName ?? ""),
        ),
        durations: [...new Set(durations)],
        animations,
        transitions,
        remainingAnimations: root.getAnimations({ subtree: true }).length,
      };
    });
    expect(result).toEqual({
      sameNodes: true,
      sameClasses: true,
      sameMarkup: true,
      onlyScopeAttributes: true,
      durations: ["0s"],
      animations: 0,
      transitions: 0,
      remainingAnimations: 0,
    });
    expect(await snapshot(page, "#a")).not.toEqual(before);
    expect(await snapshot(page, "#b")).toEqual(other);
    expect(await snapshot(page, "#a")).toEqual(other);
  } finally {
    await page.close();
  }
});

test("overlays_keep_scope", async () => {
  const page = await browser.newPage();
  try {
    await mount(page);
    expect(await page.locator("#b .backdrop").evaluate((el) => getComputedStyle(el).backdropFilter)).toBe(
      "blur(2px) saturate(1)",
    );
    for (const selector of [".dialog", "[popover]"]) {
      expect(await snapshot(page, `#a ${selector}`)).not.toEqual(await snapshot(page, `#b ${selector}`));
      expect(await page.locator(`#b ${selector}`).evaluate((el) => el.closest("[data-lf-ds]")?.id)).toBe("b");
    }
    expect(await page.locator("#b [popover]").evaluate((el) => el.matches(":popover-open"))).toBe(true);
    expect(
      await page.locator("#b .backdrop").evaluate((el) => {
        for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const s = getComputedStyle(ancestor);
          if (s.opacity !== "1" || s.filter !== "none" || s.backdropFilter !== "none") return false;
        }
        return el.parentElement === el.parentElement?.querySelector("[role=dialog]")?.parentElement;
      }),
    ).toBe(true);
  } finally {
    await page.close();
  }
});

test("nested_surfaces_are_a_recorded_limitation", async () => {
  const page = await browser.newPage();
  try {
    // Unsupported by contract: Certified leaves backdrop-filter unset, so Rack leaks through.
    await page.setContent(`<style>${sheets}</style><section ${scope("rack")}>
      <section ${scope("certified")}><div id="nested" class="lf_dialog_default_backdrop"></div></section>
      </section><section ${scope("certified")}><div id="alone" class="lf_dialog_default_backdrop"></div></section>`);
    const filter = (id: string) => page.locator(`#${id}`).evaluate((el) => getComputedStyle(el).backdropFilter);
    expect(await filter("nested")).toBe("blur(2px) saturate(1)");
    expect(await filter("alone")).toBe("none");
  } finally {
    await page.close();
  }
});

test("agent_home_rows_defer_offscreen", () => {
  const rows = markup.match(/<[a-z]+ class="lf_box_rule_root"[^>]*>/g) ?? [];
  const deferred = rows.filter((tag) => tag.includes("content-visibility:auto"));
  // The 50 queue rows defer; the two non-row rules keep ordinary rendering.
  expect(deferred).toHaveLength(50);
  expect(rows).toHaveLength(52);
});

test("defer_offscreen_content_stays_focusable", async () => {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  try {
    const deferred = styleDeclarations({ deferOffscreen: "size.rail" }, catalog).style;
    await page.setContent(`<style>${sheets}</style><section ${scope("rack")} class="lf_surface">
      <div style="height:3000px"></div><div id="row" class="lf_box_rule_root"><button id="inner">Inner</button></div>
    </section>`);
    const state = await page.evaluate(async (style) => {
      const row = document.querySelector<HTMLElement>("#row");
      const inner = document.querySelector<HTMLElement>("#inner");
      if (!row || !inner) throw new Error("Missing row");
      Object.assign(row.style, style);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const visibility = getComputedStyle(row).contentVisibility;
      inner.focus();
      return { visibility, focused: document.activeElement === inner, tabIndex: inner.tabIndex };
    }, deferred);
    expect(state).toEqual({ visibility: "auto", focused: true, tabIndex: 0 });
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  } finally {
    await page.close();
  }
});

test("switching_fixture_loads_primitive_css", async () => {
  const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
  try {
    await mount(page);
    const icons = await page
      .locator("#b .lf_icon_default_root")
      .evaluateAll((els) =>
        els.map((el) => Math.max(el.getBoundingClientRect().width, el.getBoundingClientRect().height)),
      );
    expect(icons.length).toBeGreaterThan(0);
    expect(Math.max(...icons)).toBeLessThanOrEqual(16);
  } finally {
    await page.close();
  }
});

test("switch_under_budget_with_blur", async () => {
  const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
  try {
    await mount(page);
    expect(await page.locator("#b .backdrop").evaluate((el) => getComputedStyle(el).backdropFilter)).toBe(
      "blur(2px) saturate(1)",
    );
    const result = await measureSwitching(page, "css");
    console.log(`Two-surface CSS switch with blur: ${JSON.stringify(result)}`);
    expect(result.nodes).toBeGreaterThan(500);
    expect(result.samples).toHaveLength(10);
    expect(Math.max(...result.samples.map((sample) => sample.library))).toBeLessThanOrEqual(16.67);
  } finally {
    await page.close();
  }
}, 20000);
