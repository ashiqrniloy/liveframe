import { validateCatalog, validateTheme, validateDesignSystem, type DesignSystem, type Result } from "../index.ts";
import { baseCss, themeCss, designSystemCss } from "../css/index.ts";
import { check, type ConformanceCase } from "./case.ts";

// CSS named and system colours; keywords such as currentColor and transparent introduce no colour.
const colourNames = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood " +
    "cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet " +
    "deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon " +
    "lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred " +
    "midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen " +
    "accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext field fieldtext graytext highlight highlighttext linktext mark marktext selecteditem selecteditemtext visitedtext " +
    "activeborder activecaption appworkspace background buttonhighlight buttonshadow captiontext inactiveborder inactivecaption inactivecaptiontext infobackground infotext menu menutext scrollbar threeddarkshadow threedface threedhighlight threedlightshadow threedshadow window windowframe windowtext"
  ).split(" "),
);

function sheetColours(sheet: string): string[] {
  const css = sheet
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\\([\da-f]{1,6}\s?|[^\r\n\f])/gi, (_, escaped: string) =>
      /^[\da-f]/i.test(escaped)
        ? String.fromCodePoint(Math.min(Number.parseInt(escaped, 16) || 0xfffd, 0x10ffff))
        : escaped,
    )
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|url\([^)]*\)/gi, "");
  const failures: string[] = [];
  // shortcut: this scans supplied declarations, not @import targets; pass every app sheet's contents.
  for (const match of css.matchAll(/(?:^|[;{}])\s*([\w-]+)\s*:\s*([^;{}]*)/g)) {
    const property = (match[1] ?? "").toLowerCase();
    const value = (match[2] ?? "").replace(/--[\w-]+/g, "");
    const bearing =
      /(?:-color$|-filter$)|^(?:--|color$|background|border|outline|fill$|stroke|box-shadow$|text-shadow$|text-decoration|text-emphasis|caret|accent|scrollbar|column-rule|flood|lighting|stop|filter$|-webkit-text-(?:fill|stroke))/.test(
        property,
      );
    if (
      /(?:#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|device-cmyk)\s*\()/i.test(value) ||
      (bearing && (value.toLowerCase().match(/[a-z][\w-]*/g) ?? []).some((word) => colourNames.has(word)))
    )
      failures.push(`${property}: ${match[2]?.trim()}`);
  }
  return failures;
}

/** Check installed app styles and optional structural sheets without a test-runner dependency. */
export function designSystemSuite({
  catalog,
  themes,
  designSystems,
  sheets,
}: {
  readonly catalog: unknown;
  readonly themes: readonly unknown[];
  readonly designSystems: readonly unknown[];
  readonly sheets?: readonly string[];
}): ConformanceCase[] {
  function value<T>(result: Result<T>, rule: string, spec: string): T {
    check(result.ok, rule, spec, result.ok ? [] : result.errors);
    return result.value;
  }
  function context(rule: string) {
    const installed = value(validateCatalog(catalog), rule, "§5");
    const registry: Record<string, DesignSystem> = Object.create(null);
    for (const system of designSystems)
      if (typeof system === "object" && system !== null && "id" in system && typeof system.id === "string")
        registry[system.id] = system as DesignSystem;
    return { catalog: installed, registry };
  }
  const cases: ConformanceCase[] = [
    {
      name: "every_theme_installs",
      async run() {
        const rule = "every_theme_installs";
        const { catalog } = context(rule);
        for (const theme of themes) value(validateTheme(theme, catalog.vocabulary), rule, "§6.1");
      },
    },
    {
      name: "every_design_system_installs",
      async run() {
        const rule = "every_design_system_installs";
        const options = context(rule);
        for (const system of designSystems) value(validateDesignSystem(system, options), rule, "§6.2");
      },
    },
    {
      name: "every_theme_and_design_system_projects",
      async run() {
        const rule = "every_theme_and_design_system_projects";
        const options = context(rule);
        value(baseCss(options.catalog), rule, "§6.4");
        const installedThemes = themes.map((theme) =>
          value(validateTheme(theme, options.catalog.vocabulary), rule, "§6.1"),
        );
        const installedSystems = designSystems.map((system) =>
          value(validateDesignSystem(system, options), rule, "§6.2"),
        );
        for (const theme of installedThemes) {
          value(themeCss(theme, options.catalog), rule, "§6.4");
          for (const system of installedSystems) value(designSystemCss(system, options), rule, "§6.4");
        }
      },
    },
  ];
  if (sheets !== undefined)
    cases.push({
      name: "app_sheets_set_no_colour",
      async run() {
        for (const [index, sheet] of sheets.entries()) {
          const failures = sheetColours(sheet);
          check(
            !failures.length,
            "app_sheets_set_no_colour",
            "§6.1",
            failures.map((declaration) => `sheets[${index}]: ${declaration}`),
          );
        }
      },
    });
  return cases;
}
