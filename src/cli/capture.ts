import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { LiveframeError } from "../index.ts";

export type CaptureOptions = {
  readonly out: string;
  readonly scenarios?: readonly string[] | undefined;
  readonly widths?: readonly number[] | undefined;
  readonly themes?: readonly string[] | undefined;
  readonly designSystems?: readonly string[] | undefined;
};
export type CapturedCell = {
  readonly scenario: string;
  readonly width: number;
  readonly theme: string;
  readonly designSystem: string;
  readonly png: string;
  readonly snapshot: string;
  readonly errors: readonly LiveframeError[];
};
export type CaptureIndex = { readonly url: string; readonly cells: readonly CapturedCell[] };
type Playwright = typeof import("playwright");
type Axes = {
  readonly scenarios: readonly string[];
  readonly widths: readonly number[];
  readonly themes: readonly string[];
  readonly designSystems: readonly string[];
};

export class PlaywrightMissing extends Error {
  override name = "PlaywrightMissing";
  constructor() {
    super("Playwright is required: run `bun add -d playwright && bunx playwright install chromium`.");
  }
}

const loadPlaywright = (): Promise<Playwright> => import("playwright");
const sanitise = (cell: Omit<CapturedCell, "png" | "snapshot" | "errors">) =>
  [cell.scenario, cell.width, cell.theme, cell.designSystem].join("_").replace(/[^\w.@-]/g, "-");
function narrow<T>(axis: string, declared: readonly T[], wanted: readonly T[] | undefined): readonly T[] {
  if (!wanted) return declared;
  const missing = wanted.filter((value) => !declared.includes(value));
  if (missing.length) throw new Error(`The page declares no ${axis} ${missing.join(", ")}`);
  return wanted;
}

/** Captures every requested cell of an app's `<Preview>` page into `options.out`. Read-only. */
export async function capture(
  url: string,
  options: CaptureOptions,
  load: () => Promise<Playwright> = loadPlaywright,
): Promise<CaptureIndex> {
  const playwright = await load().catch(() => {
    throw new PlaywrightMissing();
  });
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const open = async (scenario?: string) => {
      const target = new URL(url);
      if (scenario) target.searchParams.set("scenario", scenario);
      await page.goto(target.href).catch((error: Error) => {
        throw new Error(`Cannot open ${target.href}: ${error.message}`);
      });
      await page.waitForSelector("[data-lf-ready]", { timeout: 30000 }).catch(() => {
        throw new Error(`${target.href} never became ready: is it a <Preview> page?`);
      });
      await page.evaluate(() => document.fonts.ready);
    };
    await open();
    const declared: Axes = JSON.parse(
      (await page.locator("[data-lf-preview]").getAttribute("data-lf-preview")) ?? "null",
    );
    const scenarios = narrow("scenario", declared.scenarios, options.scenarios);
    const widths = narrow("width", declared.widths, options.widths);
    const themes = narrow("theme", declared.themes, options.themes);
    const designSystems = narrow("design system", declared.designSystems, options.designSystems);
    await mkdir(options.out, { recursive: true });

    const cells: CapturedCell[] = [];
    const taken = new Set<string>();
    for (const scenario of scenarios) {
      await open(scenario);
      const elements = page.locator("[data-lf-cell]");
      const found = await elements.evaluateAll((all) =>
        all.map((element) => ({
          coordinates: JSON.parse(element.getAttribute("data-lf-cell") ?? "null"),
          errors: JSON.parse(element.getAttribute("data-lf-errors") ?? "[]"),
        })),
      );
      for (const [index, { coordinates, errors }] of found.entries()) {
        if (
          !widths.includes(coordinates.width) ||
          !themes.includes(coordinates.theme) ||
          !designSystems.includes(coordinates.designSystem)
        )
          continue;
        // Coordinates that differ only in unsafe characters sanitise alike: keep every cell's files distinct.
        let name = sanitise(coordinates);
        for (let n = 2; taken.has(name); n++) name = `${sanitise(coordinates)}-${n}`;
        taken.add(name);
        const cell = elements.nth(index);
        await cell.screenshot({ path: join(options.out, `${name}.png`) });
        await Bun.write(join(options.out, `${name}.aria.yml`), `${await cell.ariaSnapshot()}\n`);
        cells.push({ ...coordinates, png: `${name}.png`, snapshot: `${name}.aria.yml`, errors });
      }
    }
    const index = { url, cells };
    await Bun.write(join(options.out, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
    return index;
  } finally {
    await browser.close();
  }
}
