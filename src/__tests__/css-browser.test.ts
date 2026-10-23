import { afterAll, beforeAll, expect, test } from "bun:test";
import { type Browser, chromium, type Page } from "playwright";
import { baseCss, designSystemCss, themeCss } from "../css/index.ts";
import type { Catalog, DesignSystem, Recipe, Result, Theme } from "../index.ts";

const read = (name: string) => Bun.file(new URL(`./fixtures/proof/${name}.json`, import.meta.url)).json();
const proofCatalog: Catalog = await read("catalog");
const theme: Theme = await read("certified.theme");
const proofSystem: DesignSystem = await read("certified.design-system");
const button = proofCatalog.definitions.find((d) => d.kind === "button");
if (!button) throw new Error("Missing button fixture");
const catalog: Catalog = {
  ...proofCatalog,
  definitions: [{ ...button, variants: ["default"], slots: ["root", "label"] }],
};
const colours = [
  "surface.base",
  "surface.hover",
  "surface.active",
  "surface.selected",
  "surface.raised",
  "surface.scrim",
  "surface.well",
  "surface.case",
] as const;
const states = ["rest", "hover", "focus", "active", "open", "selected", "invalid", "disabled"] as const;
const recipes = Object.fromEntries(
  states.flatMap((state, index) =>
    ["root", "label"].map((slot) => [
      `button.default.${slot}.${state}`,
      { textColor: colours[index], ...(state === "active" ? { translateY: { value: 3, unit: "px" } } : {}) },
    ]),
  ),
) as DesignSystem["recipes"];
const system: DesignSystem = { ...proofSystem, recipes };
let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  await browser?.close();
});
function css(result: Result<string>): string {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}
async function mount(page: Page, overrides: Record<string, Recipe> = {}) {
  const sheets = [
    baseCss(catalog),
    themeCss(theme, catalog),
    designSystemCss({ ...system, recipes: { ...recipes, ...overrides } }, { catalog, registry: {} }),
  ]
    .map(css)
    .join("\n");
  await page.setContent(
    `<style>${sheets}</style><section class="lf_surface" data-lf-theme="${theme.id}@${theme.version}" data-lf-ds="${system.id}@${system.version}"><button id="root" class="lf_button_default_root" style="transform:translateX(7px)"><span id="label" class="lf_button_default_label">Button</span></button></section>`,
  );
  await page.mouse.move(700, 500);
}
const colour = (page: Page, id = "root") => page.locator(`#${id}`).evaluate((el) => getComputedStyle(el).color);
const expectedColour = (page: Page, index: number) =>
  page.locator("section").evaluate((el, role) => {
    el.style.color = `var(--lf-c-${role.replaceAll(".", "_")})`;
    return getComputedStyle(el).color;
  }, colours[index] ?? "surface.base");

test("state_precedence_follows_the_fixed_order", async () => {
  const page = await browser.newPage();
  try {
    await mount(page);
    const attrs = [
      "data-hovered",
      "data-focus-visible",
      "data-pressed",
      "data-open",
      "data-selected",
      "data-invalid",
      "data-disabled",
    ];
    for (let index = 0; index < attrs.length; index++) {
      await page.locator("#root").evaluate((el, attr) => el.setAttribute(attr, ""), attrs[index] ?? "");
      expect(await colour(page)).toBe(await expectedColour(page, index + 1));
    }
  } finally {
    await page.close();
  }
});

test("native_and_aria_selectors_match_the_state_table", async () => {
  const page = await browser.newPage();
  try {
    for (const [index, attributes] of [
      [4, ["open", "data-open", "data-expanded", "aria-expanded"]],
      [5, ["data-selected", "aria-selected", "aria-checked"]],
      [6, ["data-invalid", "aria-invalid"]],
      [7, ["disabled", "data-disabled", "aria-disabled"]],
    ] as const) {
      for (const attr of attributes) {
        await mount(page);
        await page.locator("#root").evaluate((el, attr) => el.setAttribute(attr, "true"), attr);
        expect(await colour(page)).toBe(await expectedColour(page, index));
        expect(await colour(page, "label")).toBe(await expectedColour(page, index));
      }
    }
    await mount(page);
    await page.keyboard.press("Tab");
    expect(await colour(page)).toBe(await expectedColour(page, 2));
    await page.locator("#root").hover();
    await page.mouse.down();
    expect(await colour(page)).toBe(await expectedColour(page, 3));
    await page.mouse.up();
    await mount(page);
    await page.locator("#root").evaluate((el) => {
      el.setAttribute("popover", "manual");
      (el as HTMLElement).showPopover();
    });
    expect(await colour(page)).toBe(await expectedColour(page, 4));
    await mount(page);
    await page.locator("#root").evaluate((el) => el.append(document.createElement("input")));
    await page.locator("input").focus();
    expect(await colour(page, "label")).toBe(await expectedColour(page, 2));
  } finally {
    await page.close();
  }
});

test("touch_has_no_sticky_hover", async () => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await mount(page);
    expect(await page.evaluate(() => matchMedia("(hover: hover)").matches)).toBe(false);
    const rest = await colour(page);
    await page.locator("#root").tap();
    // Remove the keyboard-focus cue independently of the hover state.
    await page.locator("#root").evaluate((el) => (el as HTMLElement).blur());
    expect(await colour(page)).toBe(rest);
    await page.locator("#root").evaluate((el) => el.setAttribute("data-hovered", ""));
    expect(await colour(page)).not.toBe(rest);
  } finally {
    await context.close();
  }
});

test("root_state_reaches_slots_and_disabled_roots_block_hover_and_active", async () => {
  const page = await browser.newPage();
  try {
    await mount(page, { "button.default.label.disabled": { textColor: colours[0] } });
    const rest = await colour(page, "label");
    await page.locator("#root").hover();
    expect(await colour(page, "label")).not.toBe(rest);
    for (const attr of ["disabled", "data-disabled", "aria-disabled"]) {
      await page.locator("#root").evaluate((el, attr) => {
        el.setAttribute(attr, "true");
        el.setAttribute("data-pressed", "");
      }, attr);
      await page.locator("#label").evaluate((el) => {
        el.setAttribute("data-hovered", "");
        el.setAttribute("data-pressed", "");
      });
      expect(await colour(page, "label")).toBe(rest);
      expect(await page.locator("#label").evaluate((el) => getComputedStyle(el).translate)).toBe("none");
      await page.locator("#root").evaluate((el, attr) => el.removeAttribute(attr), attr);
    }
  } finally {
    await page.close();
  }
});

test("pressed_offset_composes_with_transform", async () => {
  const page = await browser.newPage();
  try {
    await mount(page);
    await page.locator("#root").evaluate((el) => el.setAttribute("data-pressed", ""));
    expect(
      await page.locator("#root").evaluate((el) => {
        const style = getComputedStyle(el);
        return [style.translate, style.transform];
      }),
    ).toEqual(["0px 3px", "matrix(1, 0, 0, 1, 7, 0)"]);
  } finally {
    await page.close();
  }
});
