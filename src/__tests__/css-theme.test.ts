import { expect, test } from "bun:test";
import { baseCss, colourVar, designSystemCss, themeCss, valueVar } from "../css/index.ts";
import { slotClass } from "../css/names.ts";
import type { Colour } from "../formats/dtcg.ts";
import { type Catalog, type DesignSystem, type Result, type Theme, validateCatalog, validateTheme } from "../index.ts";

const read = (name: string) => Bun.file(new URL(`./fixtures/proof/${name}.json`, import.meta.url)).json();
const catalog: Catalog = await read("catalog");
const themes: Theme[] = await Promise.all([read("certified.theme"), read("rack.theme")]);

function css(result: Result<string>): string {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

function failure(result: Result<unknown>) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected validation errors, received a value");
  return result;
}

function fixture(colour: Colour): { catalog: Catalog; theme: Theme } {
  // A one-role serialization fixture has no proof contrast pairs or backdrop.
  const { contrast: _, contrastBase: __, ...vocabulary } = catalog.vocabulary;
  return {
    catalog: {
      ...catalog,
      vocabulary: {
        ...vocabulary,
        colourRoles: ["ink"],
        surfaceRoles: [],
        fillableRoles: [],
        tones: {},
        typographyRoles: ["reading"],
        surfaceTypography: "reading",
      },
    },
    theme: {
      format: "liveframe-theme/1",
      id: "test",
      version: "1",
      colorScheme: "light",
      colours: { ink: colour },
      typography: {
        reading: { fontFamily: "system-ui", fontSize: { value: 1, unit: "rem" }, fontWeight: 400, lineHeight: 1.5 },
      },
    },
  };
}

test("names_are_injective", () => {
  const names = ["a.b-c", "a-b.c", ...Array.from({ length: 50 }, (_, i) => `a.b${i}-c.d`)];
  for (const encode of [colourVar, valueVar]) {
    expect(new Set(names.map(encode)).size).toBe(names.length);
  }
  expect(colourVar("a.b-c")).toBe("--lf-c-a_b-c");
  expect(valueVar("space.3")).toBe("--lf-v-space_3");
  const tuples: (readonly [string, string, string])[] = names.map((_, i) => [`kind-${i}`, "default", "root"]);
  tuples.push(["kind", "a-b", "c"], ["kind-a", "b", "c"]);
  expect(new Set(tuples.map(([kind, variant, slot]) => slotClass(kind, variant, slot))).size).toBe(tuples.length);
  expect(slotClass("button", "primary", "root")).toBe("lf_button_primary_root");
});

test("every_dtcg_colour_space_serializes", () => {
  const cases: readonly (readonly [Colour["colorSpace"], Colour["components"], string])[] = [
    ["srgb", [0.1, 0.2, 0.3], "color(srgb 0.1 0.2 0.3 / 0.5)"],
    ["srgb-linear", [0.1, 0.2, 0.3], "color(srgb-linear 0.1 0.2 0.3 / 0.5)"],
    ["hsl", [120, 25, 75], "hsl(120 25% 75% / 0.5)"],
    ["hwb", [120, 25, 75], "hwb(120 25% 75% / 0.5)"],
    ["lab", [50, -25, 30], "lab(50 -25 30 / 0.5)"],
    ["lch", [50, 25, 120], "lch(50 25 120 / 0.5)"],
    ["oklab", [0.5, -0.2, 0.3], "oklab(0.5 -0.2 0.3 / 0.5)"],
    ["oklch", [0.5, 0.2, 120], "oklch(0.5 0.2 120 / 0.5)"],
    ...(["display-p3", "a98-rgb", "prophoto-rgb", "rec2020", "xyz-d65", "xyz-d50"] as const).map(
      (space) => [space, [0.1, 0.2, 0.3], `color(${space} 0.1 0.2 0.3 / 0.5)`] as const,
    ),
  ];
  for (const [colorSpace, components, expected] of cases) {
    const f = fixture({ colorSpace, components, alpha: 0.5, hex: "#ffffff" });
    const sheet = css(themeCss(f.theme, f.catalog));
    expect(sheet).toContain(`--lf-c-ink:${expected}`);
    expect(sheet).not.toContain("#ffffff");
    const missing = fixture({ colorSpace, components: ["none", "none", "none"], alpha: 0 });
    expect(css(themeCss(missing.theme, missing.catalog))).toContain(
      `--lf-c-ink:${["hsl", "hwb", "lab", "lch", "oklab", "oklch"].includes(colorSpace) ? `${colorSpace}(` : `color(${colorSpace} `}none none none / 0)`,
    );
  }
  const f = fixture({ colorSpace: "srgb", components: [0, 0, 0] });
  expect(css(themeCss(f.theme, f.catalog))).toContain("--lf-c-ink:color(srgb 0 0 0)");
});

test("font_families_are_quoted_and_escaped", () => {
  const f = fixture({ colorSpace: "srgb", components: [0, 0, 0] });
  const reading = f.theme.typography.reading;
  if (!reading) throw new Error("Missing test typography");
  f.theme = { ...f.theme, typography: { reading: { ...reading, fontFamily: ['Inter "Display"', "system-ui"] } } };
  expect(css(themeCss(f.theme, f.catalog))).toContain('--lf-t-reading__fontFamily:"Inter \\"Display\\"",system-ui');
  for (const family of [
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "ui-serif",
    "ui-sans-serif",
    "ui-monospace",
    "ui-rounded",
    "emoji",
    "math",
    "fangsong",
    "SYSTEM-UI",
  ]) {
    f.theme = { ...f.theme, typography: { reading: { ...reading, fontFamily: family } } };
    expect(css(themeCss(f.theme, f.catalog))).toContain(`--lf-t-reading__fontFamily:${family}`);
  }
  f.theme = { ...f.theme, typography: { reading: { ...reading, fontFamily: "inherit" } } };
  expect(css(themeCss(f.theme, f.catalog))).toContain('--lf-t-reading__fontFamily:"inherit"');
});

test("typography_preserves_units_and_resets_optional_fields", () => {
  const f = fixture({ colorSpace: "srgb", components: [0, 0, 0] });
  const reading = f.theme.typography.reading;
  if (!reading) throw new Error("Missing test typography");
  let sheet = css(themeCss(f.theme, f.catalog));
  for (const entry of [
    "fontSize:1rem",
    "lineHeight:1.5",
    "letterSpacing:0",
    "textTransform:none",
    "fontStretch:100%",
    "fontSizeAdjust:none",
  ]) {
    expect(sheet).toContain(`--lf-t-reading__${entry}`);
  }
  f.theme = {
    ...f.theme,
    typography: {
      reading: {
        ...reading,
        letterSpacing: { value: -0.02, unit: "em" },
        textTransform: "uppercase",
        fontStretch: 90,
        fontSizeAdjust: 0.52,
      },
    },
  };
  sheet = css(themeCss(f.theme, f.catalog));
  for (const entry of [
    "letterSpacing:-0.02em",
    "textTransform:uppercase",
    "fontStretch:90%",
    "fontSizeAdjust:ex-height 0.52",
  ]) {
    expect(sheet).toContain(`--lf-t-reading__${entry}`);
  }
  for (const [fontWeight, expected] of [
    ["thin", 100],
    ["ultra-light", 200],
    ["light", 300],
    ["book", 400],
    ["medium", 500],
    ["demi-bold", 600],
    ["bold", 700],
    ["extra-bold", 800],
    ["heavy", 900],
    ["extra-black", 950],
    [425, 425],
  ] as const) {
    f.theme = { ...f.theme, typography: { reading: { ...reading, fontWeight } } };
    expect(css(themeCss(f.theme, f.catalog))).toContain(`--lf-t-reading__fontWeight:${expected}`);
  }
});

test("theme_sheet_sets_color_scheme", () => {
  for (const theme of themes) {
    expect(css(themeCss({ ...theme, colorScheme: "dark" }, catalog))).toStartWith(
      `:where([data-lf-theme="${theme.id}@${theme.version}"]){color-scheme:dark;`,
    );
  }
});

test("surface_typography_comes_from_the_vocabulary", () => {
  const f = fixture({ colorSpace: "srgb", components: [0, 0, 0] });
  const sheet = css(baseCss(f.catalog));
  expect(sheet).toContain(":where([data-lf-ds]) *{box-sizing:border-box;margin:0;border:0 solid}");
  expect(sheet).toContain("font:inherit");
  expect(sheet).toContain(".lf_surface{");
  expect(sheet).toContain("font-family:var(--lf-t-reading__fontFamily)");
  expect(sheet).toContain("font-size:var(--lf-t-reading__fontSize)");
  expect(sheet).toContain("container-name:lf;container-type:inline-size");
  expect(sheet.split(":where([data-lf-portal]){position:fixed;inset:0;pointer-events:none}")).toHaveLength(2);
  expect(sheet.split(":where([data-lf-portal])>*{pointer-events:auto}")).toHaveLength(2);
  expect(sheet).not.toContain("body");
  expect(sheet).not.toContain("surface.scrollbar");
  expect(sheet).not.toContain(":root");
});

test("colour_authority_holds", async () => {
  function check(sheet: string) {
    const forcedRanges = [...sheet.matchAll(/@media \(forced-colors:active\)\{/g)].map((match) => {
      let end = match.index + match[0].length;
      let depth = 1;
      while (depth && end < sheet.length) {
        if (sheet[end] === "{") depth++;
        if (sheet[end] === "}") depth--;
        end++;
      }
      return [match.index, end] as const;
    });
    for (const match of sheet.matchAll(/(?:[;{])([\w-]+):([^;{}]+)/g)) {
      const [, property, value] = match;
      const systemColour = /\b(?:CanvasText|HighlightText|Highlight|GrayText)\b/.test(value ?? "");
      if (systemColour)
        expect(forcedRanges.some(([start, end]) => match.index > start && match.index < end)).toBe(true);
      if (property?.startsWith("--lf-c-")) continue;
      expect(value).not.toMatch(/(?:#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\()/i);
      if (property === "color" || property?.endsWith("-color")) {
        const responsive =
          /^(?:var\(--lf-r-(?:surface|fill|tone)__[\w]+__(?:backgroundColor|color),)*var\(--lf-r-(?:surface|fill|tone)__[\w]+__(?:backgroundColor|color)\)\)*$/;
        // A role, or a role under an alpha modifier; `none` is `transparent`.
        const role = String.raw`(?:var\(--lf-c-[\w-]+\)|color-mix\(in oklab, var\(--lf-c-[\w-]+\) [\d.]+%, transparent\))`;
        const oneColour = String.raw`(?:${role}|transparent|currentColor|color-mix\(in srgb, ${role} calc\(var\(--lf-alpha\) \* 100%\), transparent\))`;
        const themeColour = new RegExp(`^${property === "scrollbar-color" ? `${oneColour} ${oneColour}` : oneColour}$`);
        expect(
          themeColour.test(value ?? "") ||
            (property === "scrollbar-color" && value === "auto") ||
            responsive.test(value ?? "") ||
            /^(?:CanvasText|HighlightText|Highlight|GrayText)$/.test(value ?? ""),
        ).toBe(true);
      }
    }
  }
  for (const theme of themes) {
    const base = css(baseCss(catalog));
    const projected = css(themeCss(theme, catalog));
    check(base + projected);
    for (const [, name] of (base + projected).matchAll(/--lf-c-([\w-]+)/g)) {
      expect(catalog.vocabulary.colourRoles.map((role) => role.replaceAll(".", "_"))).toContain(name ?? "");
    }
  }
  // No shipped recipe puts an alpha modifier on a colour property, so Rack carries one of every value form.
  const rack: DesignSystem = await read("rack.design-system");
  const opacity = Object.keys(rack.values ?? {}).find((name) => name.startsWith("opacity."));
  if (!opacity) throw new Error("Missing proof opacity value");
  const viewport = "scroll.default.viewport.rest";
  const everyForm: DesignSystem = {
    ...rack,
    recipes: {
      ...rack.recipes,
      [viewport]: {
        ...rack.recipes?.[viewport],
        backgroundColor: { role: "surface.raised", alpha: 0.25 },
        backgroundOpacity: 0.5,
        textColor: { role: "text.primary", alpha: opacity },
        borderColor: { role: "border.hairline", alpha: 0 },
        outlineColor: "none",
        placeholderColor: { role: "text.muted", alpha: 0.5 },
        scrollbarThumbColor: { role: "surface.scrollbar", alpha: 1 },
        scrollbarTrackColor: "none",
      },
    },
  };
  const projectedForms = css(designSystemCss(everyForm, { catalog, registry: {} }));
  for (const form of [
    "border-color:color-mix(in oklab, var(--lf-c-border_hairline) 0%, transparent)",
    "color:color-mix(in oklab, var(--lf-c-text_primary)",
    "outline-color:transparent",
    "background-color:color-mix(in srgb, color-mix(in oklab, var(--lf-c-surface_raised) 25%, transparent)",
    "scrollbar-color:color-mix(in oklab, var(--lf-c-surface_scrollbar) 100%, transparent) transparent",
  ])
    expect(projectedForms).toContain(form);
  for (const [name, system] of [
    ["certified", await read("certified.design-system")],
    ["rack", rack],
    ["every form", everyForm],
  ] as const) {
    const projected = name === "every form" ? projectedForms : css(designSystemCss(system, { catalog, registry: {} }));
    check(projected);
    for (const [, role] of projected.matchAll(/--lf-c-([\w-]+)/g))
      expect(catalog.vocabulary.colourRoles.map((role) => role.replaceAll(".", "_"))).toContain(role ?? "");
  }
  expect(() => check(".leak{color:red}")).toThrow();
  expect(() => check(".leak{scrollbar-color:red blue}")).toThrow();
  expect(() => check(".leak{scrollbar-color:Highlight transparent}")).toThrow();
  expect(() => check(".leak{color:Highlight}")).toThrow();
  expect(() => check(".leak{outline:1px solid CanvasText}")).toThrow();
  expect(() => check("@media (forced-colors:active){.ok{color:GrayText}}.leak{color:Highlight}")).toThrow();
  expect(() => check(".leak{box-shadow:0 0 1px rgb(0 0 0)}")).toThrow();
  expect(() => check(".leak{border-color:color-mix(in oklab, red 50%, transparent)}")).toThrow();
  expect(() => check(".leak{border-color:color-mix(in oklab, var(--lf-c-ink) 50%, red)}")).toThrow();
  expect(() => check(".leak{color:color-mix(in oklab, #fff 50%, transparent)}")).toThrow();
});

test("projection_is_deterministic", () => {
  const shuffle = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(shuffle);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .reverse()
          .map(([key, entry]) => [key, shuffle(entry)]),
      );
    }
    return value;
  };
  for (const theme of themes) {
    const before = JSON.stringify({ theme, catalog });
    expect(themeCss(theme, catalog)).toEqual(themeCss(theme, catalog));
    expect(themeCss(shuffle(theme) as Theme, shuffle(catalog) as Catalog)).toEqual(themeCss(theme, catalog));
    expect(baseCss(shuffle(catalog) as Catalog)).toEqual(baseCss(catalog));
    expect(JSON.stringify({ theme, catalog })).toBe(before);
  }
});

test("invalid_theme_fails_closed", () => {
  const theme = themes[0];
  if (!theme) throw new Error("Missing proof theme");
  const invalid = { ...theme, colours: {} };
  expect(failure(themeCss(invalid, catalog))).toEqual(failure(validateTheme(invalid, catalog.vocabulary)));
  const invalidCatalog = { ...catalog, vocabulary: { ...catalog.vocabulary, surfaceTypography: "undeclared" } };
  expect(failure(baseCss(invalidCatalog))).toEqual(failure(validateCatalog(invalidCatalog)));
  expect(failure(themeCss(theme, invalidCatalog))).toEqual(failure(validateCatalog(invalidCatalog)));
  for (const fontFamily of ["bad; color:red", "url(evil)", "bad\\font"]) {
    const f = fixture({ colorSpace: "srgb", components: [0, 0, 0] });
    const reading = f.theme.typography.reading;
    if (!reading) throw new Error("Missing test typography");
    f.theme = { ...f.theme, typography: { reading: { ...reading, fontFamily } } };
    expect(failure(themeCss(f.theme, f.catalog))).toEqual(failure(validateTheme(f.theme, f.catalog.vocabulary)));
    expect(themeCss(f.theme, f.catalog).ok).toBe(false);
  }
});

test("installed_strings_cannot_escape_css_or_style_elements", () => {
  const f = fixture({ colorSpace: "srgb", components: [0, 0, 0] });
  const reading = f.theme.typography.reading;
  if (!reading) throw new Error("Missing test typography");
  const attack = '</style><script>alert("x")</script>';
  f.theme = { ...f.theme, version: '1"\\\t]', typography: { reading: { ...reading, fontFamily: attack } } };
  const sheet = css(themeCss(f.theme, f.catalog));
  expect(sheet).toStartWith(':where([data-lf-theme="test@1\\"\\\\\\9 ]"])');
  expect(sheet).not.toContain("</style>");
  expect(sheet).toContain("\\3c /style>");
});
