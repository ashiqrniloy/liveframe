import { afterAll, beforeAll, expect, test } from "bun:test";
import { type Browser, chromium, type Page } from "playwright";
import { baseCss, designSystemCss, styleDeclarations, themeCss } from "../css/index.ts";
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

async function mountResponsive(page: Page, systems: DesignSystem[], input: Record<string, unknown>) {
  const { style, classes } = styleDeclarations(input, catalog);
  const sheets = [
    baseCss(catalog),
    themeCss(theme, catalog),
    ...systems.map((system) => designSystemCss(system, { catalog, registry: {} })),
  ]
    .map(css)
    .join("\n");
  await page.setContent(
    `<style>${sheets}</style><section class="lf_surface lf_container" data-lf-theme="${theme.id}@${theme.version}" data-lf-ds="${systems[0]!.id}@${systems[0]!.version}" style="width:300px"><div id="grid" class="${classes.join(" ")}" style="display:grid"><div>A</div><div>B</div></div></section>`,
  );
  await page.locator("#grid").evaluate((el, declarations) => {
    for (const [name, value] of Object.entries(declarations)) {
      if (name.startsWith("--")) (el as HTMLElement).style.setProperty(name, value);
      else Object.assign((el as HTMLElement).style, { [name]: value });
    }
  }, style);
}
const columnCount = (page: Page) =>
  page.locator("#grid").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);

test("responsive_value_holds_at_wider_breakpoints", async () => {
  const page = await browser.newPage();
  try {
    const system = {
      ...proofSystem,
      recipes,
      values: {
        ...proofSystem.values,
        "bp.sm": { kind: "breakpoint", value: { value: 400, unit: "px" } },
        "bp.md": { kind: "breakpoint", value: { value: 600, unit: "px" } },
      },
    } as DesignSystem;
    await mountResponsive(page, [system], { columns: { base: ["1fr"], "bp.sm": ["1fr", "1fr"] } });
    expect(await columnCount(page)).toBe(1);
    for (const width of [500, 800]) {
      await page.locator("section").evaluate((el, width) => {
        el.style.width = `${width}px`;
      }, width);
      expect(await columnCount(page)).toBe(2);
    }
  } finally {
    await page.close();
  }
});

test("breakpoints_follow_the_design_system", async () => {
  const page = await browser.newPage();
  try {
    const rack: DesignSystem = await read("rack.design-system");
    // Distinct thresholds prove the rule uses each installed system, with the same markup.
    const systems = [proofSystem, rack].map(
      (system, index) =>
        ({
          ...system,
          recipes,
          values: {
            ...system.values,
            "bp.sm": { kind: "breakpoint", value: { value: index ? 700 : 400, unit: "px" } },
          },
        }) as DesignSystem,
    );
    await mountResponsive(page, systems, { columns: { base: ["1fr"], "bp.sm": ["1fr", "1fr"] } });
    await page.locator("section").evaluate((el) => {
      el.style.width = "500px";
    });
    expect(await columnCount(page)).toBe(2);
    await page.locator("section").evaluate((el, id) => el.setAttribute("data-lf-ds", id), `${rack.id}@${rack.version}`);
    expect(await columnCount(page)).toBe(1);
    await page.locator("section").evaluate((el) => {
      el.style.width = "800px";
    });
    expect(await columnCount(page)).toBe(2);
  } finally {
    await page.close();
  }
});

test("sides_mirror_in_rtl", async () => {
  const page = await browser.newPage();
  try {
    await mount(page, {
      "button.default.root.rest": { borderLeftWidth: { value: 3, unit: "px" }, borderStyle: "solid" },
    });
    const { style } = styleDeclarations({ paddingLeft: "space.2", paddingRight: "space.0" }, catalog);
    await page.locator("#root").evaluate((el, style) => Object.assign((el as HTMLElement).style, style), style);
    const sides = () =>
      page.locator("#root").evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.paddingLeft, s.paddingRight, s.borderLeftWidth, s.borderRightWidth];
      });
    expect(await sides()).toEqual(["8px", "0px", "3px", "0px"]);
    await page.locator("section").evaluate((el) => el.setAttribute("dir", "rtl"));
    expect(await sides()).toEqual(["0px", "8px", "0px", "3px"]);
  } finally {
    await page.close();
  }
});

test("responsive_values_do_not_inherit_parent_overrides", async () => {
  const page = await browser.newPage();
  try {
    const parent = styleDeclarations({ gap: { base: "space.1", "bp.sm": "space.4" } }, catalog);
    const child = styleDeclarations({ gap: { base: "space.2" } }, catalog);
    await mountResponsive(page, [{ ...system }], { gap: { base: "space.1", "bp.sm": "space.4" } });
    await page.locator("section").evaluate((el) => {
      el.style.width = "900px";
    });
    await page.locator("#grid").evaluate(
      (el, { parent, child }) => {
        for (const [name, value] of Object.entries(parent.style)) (el as HTMLElement).style.setProperty(name, value);
        const inner = document.createElement("div");
        inner.id = "inner";
        inner.className = child.classes.join(" ");
        for (const [name, value] of Object.entries(child.style)) inner.style.setProperty(name, value);
        el.append(inner);
      },
      { parent, child },
    );
    expect(await page.locator("#grid").evaluate((el) => getComputedStyle(el).gap)).toBe("16px");
    expect(await page.locator("#inner").evaluate((el) => getComputedStyle(el).gap)).toBe("8px");
  } finally {
    await page.close();
  }
});

async function mountOverlay(page: Page) {
  const rack: DesignSystem = await read("rack.design-system");
  const rest: Recipe = { opacity: 0, translateY: { value: 4, unit: "px" } };
  const open: Recipe = {
    opacity: 1,
    translateY: { value: 0, unit: "px" },
    transitionDuration: { value: 140, unit: "ms" },
    transitionTiming: "expo-out",
  };
  const frost: Recipe = { ...rack.recipes["dialog.default.backdrop.rest"], backdropSaturate: 1.2 };
  const overlay: DesignSystem = {
    ...rack,
    recipes: {
      ...rack.recipes,
      "dialog.default.backdrop.rest": frost,
      "dialog.default.backdrop.open": frost,
      "popover.default.content.rest": frost,
      "popover.default.content.open": frost,
      "dialog.default.content.rest": rest,
      "dialog.default.content.open": open,
    },
  };
  const sheets = [
    baseCss(proofCatalog),
    themeCss(theme, proofCatalog),
    designSystemCss(overlay, { catalog: proofCatalog, registry: {} }),
  ]
    .map(css)
    .join("\n");
  await page.setContent(`<style>${sheets}
    body{margin:0;background:repeating-linear-gradient(90deg,#f00 0 4px,#00f 4px 8px)}
    #backdrop,#frost{position:absolute;top:20px;left:20px;width:160px;height:100px}
    #frost{left:200px}
    </style><section class="lf_surface" data-lf-theme="${theme.id}@${theme.version}" data-lf-ds="${rack.id}@${rack.version}">
    <div class="lf_dialog_default_root" data-open><div id="backdrop" class="lf_dialog_default_backdrop"></div></div>
    <div class="lf_popover_default_root" data-open><div id="frost" class="lf_popover_default_content"></div></div></section>`);
}

const backdropStyle = (page: Page, id = "backdrop") =>
  page.locator(`#${id}`).evaluate((el) => {
    const style = getComputedStyle(el);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Missing canvas context");
    context.fillStyle = style.backgroundColor;
    context.fillRect(0, 0, 1, 1);
    return { filter: style.backdropFilter, alpha: context.getImageData(0, 0, 1, 1).data[3] };
  });

test("backdrop_blurs_the_page_behind_it", async () => {
  const page = await browser.newPage();
  try {
    await mountOverlay(page);
    for (const id of ["backdrop", "frost"]) {
      expect(await backdropStyle(page, id)).toEqual({ filter: "blur(2px) saturate(1.2)", alpha: 189 });
      const element = page.locator(`#${id}`);
      const blurred = await element.screenshot();
      await element.evaluate((el) => (el as HTMLElement).style.setProperty("backdrop-filter", "none"));
      expect((await element.screenshot()).equals(blurred)).toBe(false);
    }
  } finally {
    await page.close();
  }
});

test("opacity_ancestor_breaks_blur_is_documented_contract", async () => {
  const page = await browser.newPage();
  try {
    await mountOverlay(page);
    await page.locator("section").evaluate((el) => {
      el.style.opacity = "0.99";
    });
    const element = page.locator("#backdrop");
    const blocked = await element.screenshot();
    await element.evaluate((el) => (el as HTMLElement).style.setProperty("backdrop-filter", "none"));
    expect((await element.screenshot()).equals(blocked)).toBe(true);
  } finally {
    await page.close();
  }
});

test("overlay_enters_from_rest", async () => {
  const page = await browser.newPage();
  try {
    await mountOverlay(page);
    // Insert already open: the root's state must reach its newly mounted content slot.
    const entry = await page.locator(".lf_dialog_default_root").evaluate((root) => {
      const el = document.createElement("div");
      el.id = "entry";
      el.className = "lf_dialog_default_content";
      root.append(el);
      const style = getComputedStyle(el);
      const initial = {
        opacity: style.opacity,
        translate: style.translate,
        duration: style.transitionDuration,
        timing: style.transitionTimingFunction,
      };
      const animations = el.getAnimations();
      return { initial, count: animations.length };
    });
    expect(entry.initial).toEqual({
      opacity: "0",
      translate: "0px 4px",
      duration: "0.14s",
      timing: "cubic-bezier(0.16, 1, 0.3, 1)",
    });
    expect(entry.count).toBe(2);
    await page.locator("#entry").evaluate(async (el) => {
      await Promise.all(el.getAnimations().map((animation) => animation.finished));
    });
    expect(await page.locator("#entry").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  } finally {
    await page.close();
  }
});

test("reduced_motion_removes_transitions", async () => {
  const page = await browser.newPage();
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mount(page, {
      "button.default.root.active": {
        translateY: { value: 3, unit: "px" },
        transitionDuration: { value: 140, unit: "ms" },
      },
    });
    await page.locator("#root").evaluate((el) => el.setAttribute("data-pressed", ""));
    expect(
      await page.locator("#root").evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.transitionDuration, s.translate, el.getAnimations().length];
      }),
    ).toEqual(["0s", "none", 0]);
    await mountOverlay(page);
    expect(
      await page.locator(".lf_dialog_default_root").evaluate((root) => {
        const el = document.createElement("div");
        el.className = "lf_dialog_default_content";
        root.append(el);
        const s = getComputedStyle(el);
        return [s.opacity, s.transitionDuration, s.translate, el.getAnimations().length];
      }),
    ).toEqual(["1", "0s", "none", 0]);
  } finally {
    await page.close();
  }
});

test("reduced_transparency_makes_backdrops_opaque", async () => {
  const page = await browser.newPage();
  try {
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
    });
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-transparency: reduce)").matches)).toBe(true);
    await mountOverlay(page);
    for (const id of ["backdrop", "frost"])
      expect(await backdropStyle(page, id)).toEqual({ filter: "none", alpha: 255 });
  } finally {
    await page.close();
  }
});

test("switching_suppresses_transitions", async () => {
  const page = await browser.newPage();
  try {
    await mount(page, {
      "button.default.root.rest": { textColor: "text.primary", transitionDuration: { value: 1000, unit: "ms" } },
    });
    const alternateColour = theme.colours["surface.base"];
    if (!alternateColour) throw new Error("Missing surface colour fixture");
    const alternate: Theme = {
      ...theme,
      id: "alternate",
      colours: { ...theme.colours, "text.primary": alternateColour },
    };
    await page.addStyleTag({ content: css(themeCss(alternate, catalog)) });
    await page.locator("section").evaluate((el) => {
      el.style.transition = "color 1s";
      const other = el.cloneNode(true) as HTMLElement;
      for (const child of other.querySelectorAll("[id]")) child.removeAttribute("id");
      other.id = "unchanged";
      el.after(other);
    });
    const before = await colour(page);
    const result = await page
      .locator("section")
      .first()
      .evaluate(async (el, themeId) => {
        el.setAttribute("data-lf-switching", "");
        el.setAttribute("data-lf-theme", themeId);
        const button = el.querySelector("button");
        if (!button) throw new Error("Missing button fixture");
        const result = {
          colour: getComputedStyle(button).color,
          transitions: [getComputedStyle(el).transitionDuration, getComputedStyle(button).transitionDuration],
          animations: el.getAnimations({ subtree: true }).length,
        };
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => {
            el.removeAttribute("data-lf-switching");
            resolve();
          }),
        );
        return result;
      }, `${alternate.id}@${alternate.version}`);
    expect(result.colour).not.toBe(before);
    expect(result.transitions).toEqual(["0s", "0s"]);
    expect(result.animations).toBe(0);
    expect(await page.locator("#unchanged button").evaluate((el) => getComputedStyle(el).color)).toBe(before);
    expect(
      await page
        .locator("section")
        .first()
        .evaluate((el) => el.getAnimations({ subtree: true }).length),
    ).toBe(0);
  } finally {
    await page.close();
  }
});
